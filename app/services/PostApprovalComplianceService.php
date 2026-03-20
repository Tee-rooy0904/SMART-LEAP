<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class PostApprovalComplianceService
{
    public function stateForApplicant(int $userId): array
    {
        $context = $this->resolveApplicantContext($userId);
        if ($context === null) {
            return $this->emptyState();
        }

        $this->ensureRequiredTaskTypes();
        $latestUnlockAt = $this->findLatestUnlockAt((int) $context['applicant_profile_id']);
        $this->ensureUnlockedTaskSet((int) $context['beneficiary_profile_id'], $latestUnlockAt, $userId);
        $tasks = $this->fetchTasks((int) $context['beneficiary_profile_id'], $context);

        return [
            'isUnlocked' => $latestUnlockAt !== null || $tasks !== [],
            'unlockedAt' => $latestUnlockAt,
            'beneficiaryProfileId' => (int) $context['beneficiary_profile_id'],
            'tasks' => $tasks,
            'summary' => $this->buildSummary($tasks),
        ];
    }

    public function taskForApplicant(int $userId, string $code): ?array
    {
        $context = $this->resolveApplicantContext($userId);
        if ($context === null) {
            return null;
        }

        $this->ensureRequiredTaskTypes();
        $latestUnlockAt = $this->findLatestUnlockAt((int) $context['applicant_profile_id']);
        $this->ensureUnlockedTaskSet((int) $context['beneficiary_profile_id'], $latestUnlockAt, $userId);

        $task = $this->findTaskByCode((int) $context['beneficiary_profile_id'], $code);
        if ($task === null) {
            return null;
        }

        return $this->mapTask($task, $context);
    }

    public function saveApplicantTask(int $userId, string $code, array $payload): array
    {
        $context = $this->resolveApplicantContext($userId);
        if ($context === null) {
            return ['ok' => false, 'errors' => ['general' => 'Applicant record not found.']];
        }

        $task = $this->findTaskByCode((int) $context['beneficiary_profile_id'], $code);
        if ($task === null) {
            return ['ok' => false, 'errors' => ['task' => 'Post-approval task not found.']];
        }

        $definition = $this->taskDefinitions()[$code] ?? null;
        if ($definition === null) {
            return ['ok' => false, 'errors' => ['task' => 'Unsupported post-approval task.']];
        }
        if (!(bool) ($definition['interactive'] ?? false)) {
            return ['ok' => false, 'errors' => ['task' => 'This task is not yet available as a digital form.']];
        }

        $status = $this->normalizeStatus((string) $task['status']);
        if (in_array($status, [POST_APPROVAL_STATUS_SUBMITTED, POST_APPROVAL_STATUS_VERIFIED], true)) {
            return ['ok' => false, 'errors' => ['task' => 'This form cannot be edited right now.']];
        }

        $validation = $this->validatePayload($code, $payload, $context, false);
        if ($validation['errors'] !== []) {
            return ['ok' => false, 'errors' => $validation['errors']];
        }

        $persistedPayload = $this->mergePersistedPayload($task, $validation['payload']);

        try {
            db()->prepare(
                'UPDATE post_approval_tasks
                 SET form_payload = :form_payload,
                     status = :status,
                     applicant_started_at = COALESCE(applicant_started_at, NOW()),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            )->execute([
                'form_payload' => json_encode($persistedPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'status' => POST_APPROVAL_STATUS_IN_PROGRESS,
                'id' => (int) $task['id'],
            ]);
        } catch (\Throwable $exception) {
            log_database_query_failure('post_approval.save_draft', $exception, ['task_code' => $code, 'task_id' => (int) $task['id']]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to save this form right now.']];
        }

        return ['ok' => true];
    }

    public function submitApplicantTask(int $userId, string $code, array $payload): array
    {
        $context = $this->resolveApplicantContext($userId);
        if ($context === null) {
            return ['ok' => false, 'errors' => ['general' => 'Applicant record not found.']];
        }

        $task = $this->findTaskByCode((int) $context['beneficiary_profile_id'], $code);
        if ($task === null) {
            return ['ok' => false, 'errors' => ['task' => 'Post-approval task not found.']];
        }

        $definition = $this->taskDefinitions()[$code] ?? null;
        if ($definition === null) {
            return ['ok' => false, 'errors' => ['task' => 'Unsupported post-approval task.']];
        }
        if (!(bool) ($definition['interactive'] ?? false)) {
            return ['ok' => false, 'errors' => ['task' => 'This task is not yet available as a digital form.']];
        }

        $status = $this->normalizeStatus((string) $task['status']);
        if ($status === POST_APPROVAL_STATUS_VERIFIED) {
            return ['ok' => false, 'errors' => ['task' => 'This form has already been verified.']];
        }
        if ($status === POST_APPROVAL_STATUS_SUBMITTED) {
            return ['ok' => false, 'errors' => ['task' => 'This form has already been submitted and is awaiting review.']];
        }

        $validation = $this->validatePayload($code, $payload, $context, true);
        if ($validation['errors'] !== []) {
            return ['ok' => false, 'errors' => $validation['errors']];
        }

        $persistedPayload = $this->mergePersistedPayload($task, $validation['payload']);

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $pdo->prepare(
                'UPDATE post_approval_tasks
                 SET form_payload = :form_payload,
                     status = :status,
                     applicant_started_at = COALESCE(applicant_started_at, NOW()),
                     applicant_submitted_at = NOW(),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            )->execute([
                'form_payload' => json_encode($persistedPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'status' => POST_APPROVAL_STATUS_SUBMITTED,
                'id' => (int) $task['id'],
            ]);

            $pdo->prepare(
                'INSERT INTO post_approval_submissions
                 (post_approval_task_id, submission_kind, file_path, original_name, payload_json, submitted_by_user_id, review_status, submitted_at)
                 VALUES (:post_approval_task_id, :submission_kind, :file_path, :original_name, :payload_json, :submitted_by_user_id, :review_status, :submitted_at)'
            )->execute([
                'post_approval_task_id' => (int) $task['id'],
                'submission_kind' => 'form',
                'file_path' => null,
                'original_name' => null,
                'payload_json' => json_encode($persistedPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'submitted_by_user_id' => $userId,
                'review_status' => POST_APPROVAL_STATUS_SUBMITTED,
                'submitted_at' => date('Y-m-d H:i:s'),
            ]);

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            log_database_query_failure('post_approval.submit', $exception, ['task_code' => $code, 'task_id' => (int) $task['id']]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to submit this form right now.']];
        }

        (new NotificationService())->createInApp(
            $userId,
            $definition['title'] . ' submitted',
            'Your post-approval form was submitted successfully and is now awaiting review.',
            'post_approval'
        );

        return ['ok' => true];
    }

    public function saveApplicantUpload(int $userId, string $code, string $fieldKey, array $file): array
    {
        $context = $this->resolveApplicantContext($userId);
        if ($context === null) {
            return ['ok' => false, 'errors' => ['general' => 'Applicant record not found.']];
        }

        $task = $this->findTaskByCode((int) $context['beneficiary_profile_id'], $code);
        if ($task === null) {
            return ['ok' => false, 'errors' => ['task' => 'Post-approval task not found.']];
        }

        $definition = $this->taskDefinitions()[$code] ?? null;
        if ($definition === null || !(bool) ($definition['interactive'] ?? false)) {
            return ['ok' => false, 'errors' => ['task' => 'Unsupported post-approval task.']];
        }

        $status = $this->normalizeStatus((string) $task['status']);
        if (in_array($status, [POST_APPROVAL_STATUS_SUBMITTED, POST_APPROVAL_STATUS_VERIFIED], true)) {
            return ['ok' => false, 'errors' => ['task' => 'This form cannot be edited right now.']];
        }

        $allowed = $this->allowedApplicantUploadFields()[$code] ?? [];
        if (!isset($allowed[$fieldKey])) {
            return ['ok' => false, 'errors' => ['field' => 'Unsupported upload field.']];
        }

        try {
            $metadata = (new UploadService())->storePostApprovalAsset((string) $allowed[$fieldKey], $file);
        } catch (\Throwable $exception) {
            log_database_query_failure('post_approval.upload', $exception, ['task_code' => $code, 'field_key' => $fieldKey]);
            return ['ok' => false, 'errors' => ['general' => $exception->getMessage() ?: 'Unable to upload file.']];
        }

        $persistedPayload = $this->mergePersistedPayload(
            $task,
            $this->payloadWithFieldValue($fieldKey, $metadata)
        );

        try {
            db()->prepare(
                'UPDATE post_approval_tasks
                 SET form_payload = :form_payload,
                     status = :status,
                     applicant_started_at = COALESCE(applicant_started_at, NOW()),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            )->execute([
                'form_payload' => json_encode($persistedPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'status' => in_array($status, [POST_APPROVAL_STATUS_UNLOCKED, 'Pending'], true) ? POST_APPROVAL_STATUS_IN_PROGRESS : $status,
                'id' => (int) $task['id'],
            ]);
        } catch (\Throwable $exception) {
            log_database_query_failure('post_approval.persist_upload', $exception, ['task_code' => $code, 'field_key' => $fieldKey, 'task_id' => (int) $task['id']]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to save this upload right now.']];
        }

        return ['ok' => true, 'upload' => $metadata];
    }

    private function resolveApplicantContext(int $userId): ?array
    {
        $statement = db()->prepare(
            'SELECT
                users.id AS user_id,
                users.full_name,
                users.email,
                applicant_profiles.id AS applicant_profile_id,
                applicant_profiles.contact_number,
                applicant_profiles.address_line,
                applicant_profiles.birthdate,
                applicant_profiles.age,
                applicant_profiles.business_name,
                applicant_profiles.livelihood_type,
                applicant_profiles.is_4ps,
                barangays.name AS barangay_name,
                beneficiary_profiles.id AS beneficiary_profile_id
             FROM users
             INNER JOIN applicant_profiles ON applicant_profiles.user_id = users.id
             LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
             LEFT JOIN beneficiary_profiles ON beneficiary_profiles.applicant_profile_id = applicant_profiles.id
             WHERE users.id = :user_id
             LIMIT 1'
        );
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        if (!is_array($row) || $row['beneficiary_profile_id'] === null) {
            return null;
        }

        return $row;
    }

    private function ensureRequiredTaskTypes(): void
    {
        $statement = db()->prepare(
            'INSERT INTO post_approval_task_types (code, label, description)
             VALUES (:code, :label, :description)
             ON DUPLICATE KEY UPDATE
                label = VALUES(label),
                description = VALUES(description),
                updated_at = CURRENT_TIMESTAMP'
        );

        foreach ($this->taskDefinitions() as $code => $definition) {
            $statement->execute([
                'code' => $code,
                'label' => $definition['title'],
                'description' => $definition['summary'],
            ]);
        }
    }

    private function findLatestUnlockAt(int $applicantProfileId): ?string
    {
        $statement = db()->prepare(
            'SELECT MAX(post_approval_unlocked_at)
             FROM training_invitees
             WHERE applicant_profile_id = :applicant_profile_id'
        );
        $statement->execute(['applicant_profile_id' => $applicantProfileId]);
        $value = $statement->fetchColumn();

        return is_string($value) && trim($value) !== '' ? $value : null;
    }

    private function ensureUnlockedTaskSet(int $beneficiaryProfileId, ?string $unlockedAt, int $actorUserId): void
    {
        if ($unlockedAt === null) {
            return;
        }

        db()->prepare(
            'UPDATE post_approval_tasks
             SET status = :status, updated_at = CURRENT_TIMESTAMP
             WHERE beneficiary_profile_id = :beneficiary_profile_id
               AND LOWER(status) = "pending"'
        )->execute([
            'status' => POST_APPROVAL_STATUS_UNLOCKED,
            'beneficiary_profile_id' => $beneficiaryProfileId,
        ]);

        $typeMap = $this->taskTypeIdMap();
        $statement = db()->prepare(
            'INSERT INTO post_approval_tasks
             (beneficiary_profile_id, task_type_id, status, assigned_by_user_id)
             VALUES (:beneficiary_profile_id, :task_type_id, :status, :assigned_by_user_id)
             ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP'
        );

        foreach (array_keys($this->taskDefinitions()) as $code) {
            if (!isset($typeMap[$code])) {
                continue;
            }

            $statement->execute([
                'beneficiary_profile_id' => $beneficiaryProfileId,
                'task_type_id' => $typeMap[$code],
                'status' => POST_APPROVAL_STATUS_UNLOCKED,
                'assigned_by_user_id' => $actorUserId,
            ]);
        }
    }

    private function taskTypeIdMap(): array
    {
        $rows = db()->query('SELECT id, code FROM post_approval_task_types')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $map = [];
        foreach ($rows as $row) {
            $map[(string) $row['code']] = (int) $row['id'];
        }

        return $map;
    }

    private function fetchTasks(int $beneficiaryProfileId, array $context): array
    {
        $statement = db()->prepare(
            'SELECT
                post_approval_tasks.id,
                post_approval_tasks.status,
                post_approval_tasks.due_date,
                post_approval_tasks.form_payload,
                post_approval_tasks.applicant_started_at,
                post_approval_tasks.applicant_submitted_at,
                post_approval_tasks.reviewed_at,
                post_approval_tasks.reviewer_remarks,
                post_approval_task_types.code,
                post_approval_task_types.label
             FROM post_approval_tasks
             INNER JOIN post_approval_task_types ON post_approval_task_types.id = post_approval_tasks.task_type_id
             WHERE post_approval_tasks.beneficiary_profile_id = :beneficiary_profile_id
               AND post_approval_task_types.code <> "seminar_attendance"
             ORDER BY FIELD(
                  post_approval_task_types.code,
                  "availment_form",
                  "validation_form",
                  "mungkahing_proyekto",
                  "business_plan",
                  "buhat_sa_pagpanumpa"
              ), post_approval_tasks.id ASC'
        );
        $statement->execute(['beneficiary_profile_id' => $beneficiaryProfileId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn (array $row): array => $this->mapTask($row, $context), $rows);
    }

    private function findTaskByCode(int $beneficiaryProfileId, string $code): ?array
    {
        $statement = db()->prepare(
            'SELECT
                post_approval_tasks.id,
                post_approval_tasks.status,
                post_approval_tasks.due_date,
                post_approval_tasks.form_payload,
                post_approval_tasks.applicant_started_at,
                post_approval_tasks.applicant_submitted_at,
                post_approval_tasks.reviewed_at,
                post_approval_tasks.reviewer_remarks,
                post_approval_task_types.code,
                post_approval_task_types.label
             FROM post_approval_tasks
             INNER JOIN post_approval_task_types ON post_approval_task_types.id = post_approval_tasks.task_type_id
             WHERE post_approval_tasks.beneficiary_profile_id = :beneficiary_profile_id
               AND post_approval_task_types.code = :code
             LIMIT 1'
        );
        $statement->execute([
            'beneficiary_profile_id' => $beneficiaryProfileId,
            'code' => $code,
        ]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    private function mapTask(array $row, array $context): array
    {
        $code = (string) $row['code'];
        $definition = $this->taskDefinitions()[$code] ?? [
            'title' => $row['label'] ?? ucfirst(str_replace('_', ' ', $code)),
            'summary' => '',
            'helpText' => '',
            'interactive' => false,
            'applicantSections' => [],
            'staffSections' => [],
        ];

        $payload = $this->decodePayload($row['form_payload'] ?? null) ?? $this->defaultPayload($code, $context);
        $status = $this->normalizeStatus((string) ($row['status'] ?? POST_APPROVAL_STATUS_UNLOCKED));

        return [
            'id' => (int) $row['id'],
            'code' => $code,
            'title' => $definition['title'],
            'summary' => $definition['summary'],
            'helpText' => $definition['helpText'],
            'status' => $status,
            'interactive' => (bool) ($definition['interactive'] ?? false),
            'staged' => !((bool) ($definition['interactive'] ?? false)),
            'dueDate' => $row['due_date'],
            'startedAt' => $row['applicant_started_at'],
            'submittedAt' => $row['applicant_submitted_at'],
            'reviewedAt' => $row['reviewed_at'],
            'reviewerRemarks' => $row['reviewer_remarks'],
            'applicantSections' => $definition['applicantSections'],
            'staffSections' => $definition['staffSections'],
            'payload' => $payload,
            'completion' => $this->completionForTask($code, $payload),
        ];
    }

    private function buildSummary(array $tasks): array
    {
        $summary = [
            'total' => count($tasks),
            'unlocked' => 0,
            'inProgress' => 0,
            'submitted' => 0,
            'verified' => 0,
            'needsCorrection' => 0,
            'rejected' => 0,
        ];

        foreach ($tasks as $task) {
            switch ($task['status']) {
                case POST_APPROVAL_STATUS_UNLOCKED:
                    $summary['unlocked']++;
                    break;
                case POST_APPROVAL_STATUS_IN_PROGRESS:
                    $summary['inProgress']++;
                    break;
                case POST_APPROVAL_STATUS_SUBMITTED:
                    $summary['submitted']++;
                    break;
                case POST_APPROVAL_STATUS_VERIFIED:
                    $summary['verified']++;
                    break;
                case POST_APPROVAL_STATUS_NEEDS_CORRECTION:
                    $summary['needsCorrection']++;
                    break;
                case POST_APPROVAL_STATUS_REJECTED:
                    $summary['rejected']++;
                    break;
            }
        }

        return $summary;
    }

    private function validatePayload(string $code, array $payload, array $context, bool $strict): array
    {
        return match ($code) {
            POST_APPROVAL_TASK_AVAILMENT_FORM => $this->validateAvailmentPayload($payload, $context, $strict),
            POST_APPROVAL_TASK_VALIDATION_FORM => $this->validateValidationPayload($payload, $context, $strict),
            POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO => $this->validateMungkahingPayload($payload, $context, $strict),
            POST_APPROVAL_TASK_BUSINESS_PLAN => $this->validateBusinessPlanPayload($payload, $context, $strict),
            POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA => $this->validateBuhatSaPagpanumpaPayload($payload, $context, $strict),
            default => ['payload' => $payload, 'errors' => ['task' => 'Unsupported digital form.']],
        };
    }

    private function validateAvailmentPayload(array $payload, array $context, bool $strict): array
    {
        $rows = [];
        foreach (($payload['familyEnterprise']['members'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? ''));
            $age = trim((string) ($row['age'] ?? ''));
            $activities = trim((string) ($row['activities'] ?? ''));
            if ($name === '' && $age === '' && $activities === '') {
                continue;
            }
            $rows[] = ['name' => $name, 'age' => $age, 'activities' => $activities];
        }

        $incomeRows = [];
        foreach (($payload['incomeEligibility']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $memberName = trim((string) ($row['memberName'] ?? ''));
            $cashIncome = trim((string) ($row['cashIncome'] ?? ''));
            $nonCashIncome = trim((string) ($row['nonCashIncome'] ?? ''));
            $totalIncome = trim((string) ($row['totalIncome'] ?? ''));
            if ($memberName === '' && $cashIncome === '' && $nonCashIncome === '' && $totalIncome === '') {
                continue;
            }
            $incomeRows[] = [
                'memberName' => $memberName,
                'cashIncome' => $cashIncome,
                'nonCashIncome' => $nonCashIncome,
                'totalIncome' => $totalIncome,
            ];
        }

        $clean = [
            'clientIdentifyingData' => [
                'name' => trim((string) ($payload['clientIdentifyingData']['name'] ?? ($context['full_name'] ?? ''))),
                'age' => trim((string) ($payload['clientIdentifyingData']['age'] ?? ($context['age'] ?? ''))),
                'address' => trim((string) ($payload['clientIdentifyingData']['address'] ?? $this->buildDefaultAddress($context))),
                'spouseName' => trim((string) ($payload['clientIdentifyingData']['spouseName'] ?? '')),
                'city' => 'Butuan City',
            ],
            'familyEnterprise' => [
                'members' => $rows,
            ],
            'individualAssistance' => [
                'clienteleCategory' => trim((string) ($payload['individualAssistance']['clienteleCategory'] ?? '')),
                'natureOfDifficultCircumstances' => trim((string) ($payload['individualAssistance']['natureOfDifficultCircumstances'] ?? '')),
            ],
            'incomeEligibility' => [
                'rows' => $incomeRows,
                'totalFamilyIncome' => trim((string) ($payload['incomeEligibility']['totalFamilyIncome'] ?? '')),
            ],
            'clientCommitment' => [
                'agreedToPolicies' => !empty($payload['clientCommitment']['agreedToPolicies'] ?? false),
                'agreedToRollBackSchedule' => !empty($payload['clientCommitment']['agreedToRollBackSchedule'] ?? ($payload['clientCommitment']['agreedToSavingsCommitment'] ?? false)),
                'agreedToWeeklySavings' => !empty($payload['clientCommitment']['agreedToWeeklySavings'] ?? ($payload['clientCommitment']['agreedToSavingsCommitment'] ?? false)),
                'notes' => trim((string) ($payload['clientCommitment']['notes'] ?? '')),
            ],
            'applicantSignature' => [
                'signedName' => trim((string) ($payload['applicantSignature']['signedName'] ?? ($context['full_name'] ?? ''))),
                'signedDate' => trim((string) ($payload['applicantSignature']['signedDate'] ?? date('Y-m-d'))),
                'signatureUpload' => $this->normalizeUploadMetadata($payload['applicantSignature']['signatureUpload'] ?? null),
            ],
        ];

        $errors = [];
        if ($strict) {
            if ($clean['clientIdentifyingData']['name'] === '') {
                $errors['clientIdentifyingData.name'] = 'Client name is required.';
            }
            if ($clean['clientIdentifyingData']['age'] === '') {
                $errors['clientIdentifyingData.age'] = 'Age is required.';
            }
            if ($clean['clientIdentifyingData']['address'] === '') {
                $errors['clientIdentifyingData.address'] = 'Address is required.';
            }
            if ($clean['individualAssistance']['clienteleCategory'] === '') {
                $errors['individualAssistance.clienteleCategory'] = 'Clientele category is required.';
            }
            if ($clean['individualAssistance']['natureOfDifficultCircumstances'] === '') {
                $errors['individualAssistance.natureOfDifficultCircumstances'] = 'Nature of difficult circumstances is required.';
            }
            if ($clean['incomeEligibility']['rows'] === []) {
                $errors['incomeEligibility.rows'] = 'Add at least one family income row.';
            }
            if (!$clean['clientCommitment']['agreedToPolicies']) {
                $errors['clientCommitment.agreedToPolicies'] = 'You must acknowledge the SMART LEAP policies.';
            }
            if (!$clean['clientCommitment']['agreedToRollBackSchedule']) {
                $errors['clientCommitment.agreedToRollBackSchedule'] = 'You must acknowledge the roll-back schedule commitment.';
            }
            if (!$clean['clientCommitment']['agreedToWeeklySavings']) {
                $errors['clientCommitment.agreedToWeeklySavings'] = 'You must acknowledge the weekly savings commitment.';
            }
            if ($clean['applicantSignature']['signedName'] === '') {
                $errors['applicantSignature.signedName'] = 'Type the applicant name for the signature block.';
            }
            if ($clean['applicantSignature']['signedDate'] === '') {
                $errors['applicantSignature.signedDate'] = 'Date signed is required.';
            }
            if ($clean['applicantSignature']['signatureUpload'] === null) {
                $errors['applicantSignature.signatureUpload'] = 'Upload the applicant e-signature file.';
            }
        }

        return ['payload' => $clean, 'errors' => $errors];
    }

    private function validateValidationPayload(array $payload, array $context, bool $strict): array
    {
        $name = $this->splitName((string) ($context['full_name'] ?? ''));
        $clean = [
            'applicantDetails' => [
                'validationDate' => trim((string) ($payload['applicantDetails']['validationDate'] ?? date('Y-m-d'))),
                'lastName' => trim((string) ($payload['applicantDetails']['lastName'] ?? $name['lastName'])),
                'firstName' => trim((string) ($payload['applicantDetails']['firstName'] ?? $name['firstName'])),
                'middleName' => trim((string) ($payload['applicantDetails']['middleName'] ?? $name['middleName'])),
                'purok' => trim((string) ($payload['applicantDetails']['purok'] ?? '')),
                'barangay' => trim((string) ($payload['applicantDetails']['barangay'] ?? ($context['barangay_name'] ?? ''))),
                'birthdate' => trim((string) ($payload['applicantDetails']['birthdate'] ?? ($context['birthdate'] ?? ''))),
                'educationalAttainment' => trim((string) ($payload['applicantDetails']['educationalAttainment'] ?? '')),
                'contactNumber' => trim((string) ($payload['applicantDetails']['contactNumber'] ?? ($context['contact_number'] ?? ''))),
            ],
            'membershipChecklist' => [
                'pantawidMember' => $this->normalizeYesNo((string) ($payload['membershipChecklist']['pantawidMember'] ?? (((int) ($context['is_4ps'] ?? 0)) === 1 ? 'Yes' : 'No'))),
                'pantawidSpecify' => trim((string) ($payload['membershipChecklist']['pantawidSpecify'] ?? '')),
                'slpaMember' => $this->normalizeYesNo((string) ($payload['membershipChecklist']['slpaMember'] ?? '')),
                'slpaSpecify' => trim((string) ($payload['membershipChecklist']['slpaSpecify'] ?? '')),
            ],
            'participantSignature' => [
                'signedName' => trim((string) ($payload['participantSignature']['signedName'] ?? ($context['full_name'] ?? ''))),
                'signedDate' => trim((string) ($payload['participantSignature']['signedDate'] ?? date('Y-m-d'))),
                'signatureUpload' => $this->normalizeUploadMetadata($payload['participantSignature']['signatureUpload'] ?? null),
            ],
        ];

        $errors = [];
        if ($strict) {
            foreach (['validationDate', 'lastName', 'firstName', 'barangay', 'birthdate', 'contactNumber'] as $field) {
                if ($clean['applicantDetails'][$field] === '') {
                    $errors['applicantDetails.' . $field] = 'This field is required.';
                }
            }
            foreach (['pantawidMember', 'slpaMember'] as $field) {
                if ($clean['membershipChecklist'][$field] === '') {
                    $errors['membershipChecklist.' . $field] = 'Select Yes or No.';
                }
            }
            if ($clean['participantSignature']['signedName'] === '') {
                $errors['participantSignature.signedName'] = 'Type the participant name for the signature block.';
            }
            if ($clean['participantSignature']['signedDate'] === '') {
                $errors['participantSignature.signedDate'] = 'Date signed is required.';
            }
            if ($clean['participantSignature']['signatureUpload'] === null) {
                $errors['participantSignature.signatureUpload'] = 'Upload the participant e-signature file.';
            }
        }

        return ['payload' => $clean, 'errors' => $errors];
    }

    private function validateMungkahingPayload(array $payload, array $context, bool $strict): array
    {
        $modalityRows = [];
        foreach (($payload['modalityApplications']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $fundSource = trim((string) ($row['fundSource'] ?? ''));
            $contributionType = trim((string) ($row['contributionType'] ?? ''));
            $amount = trim((string) ($row['amount'] ?? ''));
            if ($fundSource === '' && $contributionType === '' && $amount === '') {
                continue;
            }
            $modalityRows[] = [
                'fundSource' => $fundSource,
                'contributionType' => $contributionType,
                'amount' => $amount,
            ];
        }

        $materialsRows = [];
        foreach (($payload['businessOperation']['materials']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $material = trim((string) ($row['material'] ?? ''));
            $quality = trim((string) ($row['quality'] ?? ''));
            $unit = trim((string) ($row['unit'] ?? ''));
            $unitPrice = trim((string) ($row['unitPrice'] ?? ''));
            $cycles = trim((string) ($row['cyclesPerProduction'] ?? ''));
            $projectedCost = trim((string) ($row['projectedCost'] ?? ''));
            if ($material === '' && $quality === '' && $unit === '' && $unitPrice === '' && $cycles === '' && $projectedCost === '') {
                continue;
            }
            $materialsRows[] = [
                'material' => $material,
                'quality' => $quality,
                'unit' => $unit,
                'unitPrice' => $unitPrice,
                'cyclesPerProduction' => $cycles,
                'projectedCost' => $projectedCost,
            ];
        }

        $laborRows = [];
        foreach (($payload['businessOperation']['labor']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $workerName = trim((string) ($row['workerName'] ?? ''));
            $position = trim((string) ($row['position'] ?? ''));
            $dailyWage = trim((string) ($row['dailyWage'] ?? ''));
            if ($workerName === '' && $position === '' && $dailyWage === '') {
                continue;
            }
            $laborRows[] = [
                'workerName' => $workerName,
                'position' => $position,
                'dailyWage' => $dailyWage,
            ];
        }

        $equipmentRows = [];
        foreach (($payload['businessOperation']['toolsEquipment']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $equipment = trim((string) ($row['equipment'] ?? ''));
            $capacity = trim((string) ($row['capacity'] ?? ''));
            $unit = trim((string) ($row['unit'] ?? ''));
            $quantityOrPrice = trim((string) ($row['quantityOrPrice'] ?? ''));
            $projectedAmount = trim((string) ($row['projectedAmount'] ?? ''));
            $usefulLifeDays = trim((string) ($row['usefulLifeDays'] ?? ''));
            $productionCycle = trim((string) ($row['productionCycle'] ?? ''));
            $depreciationCost = trim((string) ($row['depreciationCost'] ?? ''));
            if ($equipment === '' && $capacity === '' && $unit === '' && $quantityOrPrice === '' && $projectedAmount === '' && $usefulLifeDays === '' && $productionCycle === '' && $depreciationCost === '') {
                continue;
            }
            $equipmentRows[] = [
                'equipment' => $equipment,
                'capacity' => $capacity,
                'unit' => $unit,
                'quantityOrPrice' => $quantityOrPrice,
                'projectedAmount' => $projectedAmount,
                'usefulLifeDays' => $usefulLifeDays,
                'productionCycle' => $productionCycle,
                'depreciationCost' => $depreciationCost,
            ];
        }

        $rawExpenseRows = $payload['businessOperation']['operatingExpenses']['rows'] ?? [];
        $expenseRows = [];
        foreach ($this->defaultMungkahingExpenseRows() as $index => $defaultExpense) {
            $row = is_array($rawExpenseRows[$index] ?? null) ? $rawExpenseRows[$index] : [];
            $expenseRows[] = [
                'expenseName' => $defaultExpense['expenseName'],
                'paymentFrequency' => trim((string) ($row['paymentFrequency'] ?? '')),
                'projectedCost' => trim((string) ($row['projectedCost'] ?? '')),
            ];
        }

        $salesRows = [];
        foreach (($payload['businessOperation']['salesProjection']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $product = trim((string) ($row['product'] ?? ''));
            $capacity = trim((string) ($row['capacity'] ?? ''));
            $unit = trim((string) ($row['unit'] ?? ''));
            $sellingPrice = trim((string) ($row['sellingPrice'] ?? ''));
            $projectedSales = trim((string) ($row['projectedSales'] ?? ''));
            if ($product === '' && $capacity === '' && $unit === '' && $sellingPrice === '' && $projectedSales === '') {
                continue;
            }
            $salesRows[] = [
                'product' => $product,
                'capacity' => $capacity,
                'unit' => $unit,
                'sellingPrice' => $sellingPrice,
                'projectedSales' => $projectedSales,
            ];
        }

        $spendingRows = [];
        foreach (($payload['spendingPlan']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $expense = trim((string) ($row['expense'] ?? ''));
            $amount = trim((string) ($row['amount'] ?? ''));
            $usageSchedule = trim((string) ($row['usageSchedule'] ?? ''));
            if ($expense === '' && $amount === '' && $usageSchedule === '') {
                continue;
            }
            $spendingRows[] = [
                'expense' => $expense,
                'amount' => $amount,
                'usageSchedule' => $usageSchedule,
            ];
        }

        $projectTitle = trim((string) ($payload['projectInformation']['projectTitle'] ?? ($context['business_name'] ?? '')));
        $projectedAmount = trim((string) ($payload['projectInformation']['projectedAmount'] ?? ''));

        $clean = [
            'projectInformation' => [
                'participantName' => trim((string) ($payload['projectInformation']['participantName'] ?? ($context['full_name'] ?? ''))),
                'projectTitle' => $projectTitle,
                'projectLocation' => trim((string) ($payload['projectInformation']['projectLocation'] ?? $this->buildDefaultAddress($context))),
                'projectDate' => trim((string) ($payload['projectInformation']['projectDate'] ?? date('Y-m-d'))),
                'projectedAmount' => $projectedAmount,
                'cswddAmount' => trim((string) ($payload['projectInformation']['cswddAmount'] ?? '')),
                'otherFundingSource' => trim((string) ($payload['projectInformation']['otherFundingSource'] ?? '')),
                'savingsAccountNumber' => trim((string) ($payload['projectInformation']['savingsAccountNumber'] ?? 'NONE')),
            ],
            'sectoralClassification' => [
                'pantawid' => [
                    'sexFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['sexFemale'] ?? false),
                    'sexMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['sexMale'] ?? false),
                    'seniorFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['seniorFemale'] ?? false),
                    'seniorMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['seniorMale'] ?? false),
                    'pwdFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['pwdFemale'] ?? false),
                    'pwdMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['pwdMale'] ?? false),
                    'ipFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['ipFemale'] ?? false),
                    'ipMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['ipMale'] ?? false),
                    'soloParentFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['soloParentFemale'] ?? false),
                    'soloParentMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['pantawid']['soloParentMale'] ?? false),
                ],
                'nonPantawid' => [
                    'sexFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['sexFemale'] ?? false),
                    'sexMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['sexMale'] ?? false),
                    'seniorFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['seniorFemale'] ?? false),
                    'seniorMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['seniorMale'] ?? false),
                    'pwdFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['pwdFemale'] ?? false),
                    'pwdMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['pwdMale'] ?? false),
                    'ipFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['ipFemale'] ?? false),
                    'ipMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['ipMale'] ?? false),
                    'soloParentFemale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['soloParentFemale'] ?? false),
                    'soloParentMale' => $this->normalizeBooleanFlag($payload['sectoralClassification']['nonPantawid']['soloParentMale'] ?? false),
                ],
            ],
            'rationale' => trim((string) ($payload['rationale'] ?? '')),
            'modalityApplications' => [
                'rows' => $modalityRows,
            ],
            'businessOperation' => [
                'materials' => [
                    'rows' => $materialsRows,
                    'totalCost' => trim((string) ($payload['businessOperation']['materials']['totalCost'] ?? '')),
                ],
                'labor' => [
                    'rows' => $laborRows,
                    'totalDailyWage' => trim((string) ($payload['businessOperation']['labor']['totalDailyWage'] ?? '')),
                    'totalProductionCycleWage' => trim((string) ($payload['businessOperation']['labor']['totalProductionCycleWage'] ?? '')),
                ],
                'toolsEquipment' => [
                    'rows' => $equipmentRows,
                    'totalCost' => trim((string) ($payload['businessOperation']['toolsEquipment']['totalCost'] ?? '')),
                ],
                'operatingExpenses' => [
                    'rows' => $expenseRows,
                    'grandTotal' => trim((string) ($payload['businessOperation']['operatingExpenses']['grandTotal'] ?? '')),
                ],
                'salesProjection' => [
                    'rows' => $salesRows,
                    'grossSales' => trim((string) ($payload['businessOperation']['salesProjection']['grossSales'] ?? '')),
                ],
                'incomeComputation' => [
                    'projectedIncomePerCycle' => trim((string) ($payload['businessOperation']['incomeComputation']['projectedIncomePerCycle'] ?? '')),
                    'rawMaterialsCost' => trim((string) ($payload['businessOperation']['incomeComputation']['rawMaterialsCost'] ?? '')),
                    'manpowerLaborCost' => trim((string) ($payload['businessOperation']['incomeComputation']['manpowerLaborCost'] ?? '')),
                    'depreciationCost' => trim((string) ($payload['businessOperation']['incomeComputation']['depreciationCost'] ?? '')),
                    'otherExpenses' => trim((string) ($payload['businessOperation']['incomeComputation']['otherExpenses'] ?? '')),
                    'totalOperatingCost' => trim((string) ($payload['businessOperation']['incomeComputation']['totalOperatingCost'] ?? '')),
                    'grossProfit' => trim((string) ($payload['businessOperation']['incomeComputation']['grossProfit'] ?? '')),
                    'netProfit' => trim((string) ($payload['businessOperation']['incomeComputation']['netProfit'] ?? '')),
                ],
            ],
            'spendingPlan' => [
                'rows' => $spendingRows,
            ],
            'applicantSignature' => [
                'signedName' => trim((string) ($payload['applicantSignature']['signedName'] ?? ($context['full_name'] ?? ''))),
                'signedDate' => trim((string) ($payload['applicantSignature']['signedDate'] ?? date('Y-m-d'))),
                'signatureUpload' => $this->normalizeUploadMetadata($payload['applicantSignature']['signatureUpload'] ?? null),
            ],
        ];

        $errors = [];
        if ($strict) {
            foreach ([
                'participantName' => 'Participant name is required.',
                'projectTitle' => 'Project title is required.',
                'projectLocation' => 'Project location is required.',
                'projectDate' => 'Project date is required.',
                'projectedAmount' => 'Projected amount is required.',
            ] as $field => $message) {
                if ($clean['projectInformation'][$field] === '') {
                    $errors['projectInformation.' . $field] = $message;
                }
            }
            if ($clean['rationale'] === '') {
                $errors['rationale'] = 'Project rationale is required.';
            }
            if ($clean['modalityApplications']['rows'] === []) {
                $errors['modalityApplications.rows'] = 'Add at least one partner or participant contribution row.';
            }
            if ($clean['businessOperation']['materials']['rows'] === []) {
                $errors['businessOperation.materials.rows'] = 'Add at least one materials row.';
            }
            if ($clean['applicantSignature']['signedName'] === '') {
                $errors['applicantSignature.signedName'] = 'Type the participant name for the signature block.';
            }
            if ($clean['applicantSignature']['signedDate'] === '') {
                $errors['applicantSignature.signedDate'] = 'Date signed is required.';
            }
            if ($clean['applicantSignature']['signatureUpload'] === null) {
                $errors['applicantSignature.signatureUpload'] = 'Upload the participant e-signature file.';
            }
        }

        return ['payload' => $clean, 'errors' => $errors];
    }

    private function validateBusinessPlanPayload(array $payload, array $context, bool $strict): array
    {
        $products = [];
        foreach (($payload['productsServices']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $name = trim((string) ($row['name'] ?? ''));
            $description = trim((string) ($row['description'] ?? ''));
            $price = trim((string) ($row['price'] ?? ''));
            $targetMarket = trim((string) ($row['targetMarket'] ?? ''));
            if ($name === '' && $description === '' && $price === '' && $targetMarket === '') {
                continue;
            }
            $products[] = [
                'name' => $name,
                'description' => $description,
                'price' => $price,
                'targetMarket' => $targetMarket,
            ];
        }

        $scheduleRows = [];
        foreach (($payload['implementationSchedule']['rows'] ?? []) as $row) {
            if (!is_array($row)) {
                continue;
            }
            $activity = trim((string) ($row['activity'] ?? ''));
            $targetDate = trim((string) ($row['targetDate'] ?? ''));
            $responsiblePerson = trim((string) ($row['responsiblePerson'] ?? ''));
            if ($activity === '' && $targetDate === '' && $responsiblePerson === '') {
                continue;
            }
            $scheduleRows[] = [
                'activity' => $activity,
                'targetDate' => $targetDate,
                'responsiblePerson' => $responsiblePerson,
            ];
        }

        $clean = [
            'overview' => [
                'businessName' => trim((string) ($payload['overview']['businessName'] ?? ($context['business_name'] ?? ''))),
                'ownerName' => trim((string) ($payload['overview']['ownerName'] ?? ($context['full_name'] ?? ''))),
                'businessAddress' => trim((string) ($payload['overview']['businessAddress'] ?? $this->buildDefaultAddress($context))),
                'contactNumber' => trim((string) ($payload['overview']['contactNumber'] ?? ($context['contact_number'] ?? ''))),
                'businessGoal' => trim((string) ($payload['overview']['businessGoal'] ?? '')),
            ],
            'executiveSummary' => trim((string) ($payload['executiveSummary'] ?? '')),
            'productsServices' => [
                'rows' => $products,
            ],
            'marketStrategy' => [
                'customerProfile' => trim((string) ($payload['marketStrategy']['customerProfile'] ?? '')),
                'competitors' => trim((string) ($payload['marketStrategy']['competitors'] ?? '')),
                'marketingApproach' => trim((string) ($payload['marketStrategy']['marketingApproach'] ?? '')),
                'salesChannel' => trim((string) ($payload['marketStrategy']['salesChannel'] ?? '')),
            ],
            'operationsPlan' => [
                'businessLocation' => trim((string) ($payload['operationsPlan']['businessLocation'] ?? '')),
                'productionProcess' => trim((string) ($payload['operationsPlan']['productionProcess'] ?? '')),
                'equipmentNeeded' => trim((string) ($payload['operationsPlan']['equipmentNeeded'] ?? '')),
                'staffingPlan' => trim((string) ($payload['operationsPlan']['staffingPlan'] ?? '')),
            ],
            'financialPlan' => [
                'startupCapital' => trim((string) ($payload['financialPlan']['startupCapital'] ?? '')),
                'monthlySalesProjection' => trim((string) ($payload['financialPlan']['monthlySalesProjection'] ?? '')),
                'monthlyExpenseProjection' => trim((string) ($payload['financialPlan']['monthlyExpenseProjection'] ?? '')),
                'projectedNetIncome' => trim((string) ($payload['financialPlan']['projectedNetIncome'] ?? '')),
                'breakEvenNotes' => trim((string) ($payload['financialPlan']['breakEvenNotes'] ?? '')),
            ],
            'riskManagement' => [
                'risks' => trim((string) ($payload['riskManagement']['risks'] ?? '')),
                'mitigation' => trim((string) ($payload['riskManagement']['mitigation'] ?? '')),
            ],
            'implementationSchedule' => [
                'rows' => $scheduleRows,
            ],
            'applicantSignature' => [
                'signedName' => trim((string) ($payload['applicantSignature']['signedName'] ?? ($context['full_name'] ?? ''))),
                'signedDate' => trim((string) ($payload['applicantSignature']['signedDate'] ?? date('Y-m-d'))),
                'signatureUpload' => $this->normalizeUploadMetadata($payload['applicantSignature']['signatureUpload'] ?? null),
            ],
        ];

        $errors = [];
        if ($strict) {
            foreach ([
                'businessName' => 'Business name is required.',
                'ownerName' => 'Owner name is required.',
                'businessAddress' => 'Business address is required.',
                'contactNumber' => 'Contact number is required.',
                'businessGoal' => 'Business goal is required.',
            ] as $field => $message) {
                if ($clean['overview'][$field] === '') {
                    $errors['overview.' . $field] = $message;
                }
            }
            if ($clean['executiveSummary'] === '') {
                $errors['executiveSummary'] = 'Executive summary is required.';
            }
            if ($clean['productsServices']['rows'] === []) {
                $errors['productsServices.rows'] = 'Add at least one product or service row.';
            }
            if ($clean['marketStrategy']['customerProfile'] === '') {
                $errors['marketStrategy.customerProfile'] = 'Customer profile is required.';
            }
            if ($clean['operationsPlan']['productionProcess'] === '') {
                $errors['operationsPlan.productionProcess'] = 'Production or service process is required.';
            }
            if ($clean['financialPlan']['startupCapital'] === '') {
                $errors['financialPlan.startupCapital'] = 'Startup capital is required.';
            }
            if ($clean['implementationSchedule']['rows'] === []) {
                $errors['implementationSchedule.rows'] = 'Add at least one implementation schedule row.';
            }
            if ($clean['applicantSignature']['signedName'] === '') {
                $errors['applicantSignature.signedName'] = 'Type the applicant name for the signature block.';
            }
            if ($clean['applicantSignature']['signedDate'] === '') {
                $errors['applicantSignature.signedDate'] = 'Date signed is required.';
            }
            if ($clean['applicantSignature']['signatureUpload'] === null) {
                $errors['applicantSignature.signatureUpload'] = 'Upload the applicant e-signature file.';
            }
        }

        return ['payload' => $clean, 'errors' => $errors];
    }

    private function validateBuhatSaPagpanumpaPayload(array $payload, array $context, bool $strict): array
    {
        $beneficiaryAddress = trim((string) ($payload['beneficiary']['addressLine'] ?? ($context['address_line'] ?? '')));
        $beneficiaryBarangay = trim((string) ($payload['beneficiary']['barangay'] ?? ($context['barangay_name'] ?? '')));
        $beneficiaryCity = trim((string) ($payload['beneficiary']['city'] ?? 'Butuan City'));
        $coMakerAddress = trim((string) ($payload['coMaker']['addressLine'] ?? ''));
        $coMakerBarangay = trim((string) ($payload['coMaker']['barangay'] ?? ''));
        $coMakerCity = trim((string) ($payload['coMaker']['city'] ?? ''));
        $agreementDate = trim((string) ($payload['agreement']['dateSigned'] ?? date('Y-m-d')));
        $agreementYear = trim((string) ($payload['agreement']['yearSigned'] ?? date('Y')));

        $clean = [
            'beneficiary' => [
                'fullName' => trim((string) ($payload['beneficiary']['fullName'] ?? ($context['full_name'] ?? ''))),
                'age' => trim((string) ($payload['beneficiary']['age'] ?? ($context['age'] ?? ''))),
                'addressLine' => $beneficiaryAddress,
                'barangay' => $beneficiaryBarangay,
                'city' => $beneficiaryCity,
            ],
            'project' => [
                'programName' => trim((string) ($payload['project']['programName'] ?? 'SMART LEAP')),
                'projectName' => trim((string) ($payload['project']['projectName'] ?? ($context['business_name'] ?? ''))),
                'amountReceived' => trim((string) ($payload['project']['amountReceived'] ?? '')),
            ],
            'coMaker' => [
                'fullName' => trim((string) ($payload['coMaker']['fullName'] ?? '')),
                'addressLine' => $coMakerAddress,
                'barangay' => $coMakerBarangay,
                'city' => $coMakerCity,
            ],
            'agreement' => [
                'dateSigned' => $agreementDate,
                'yearSigned' => $agreementYear,
            ],
            'applicantSignature' => [
                'signedName' => trim((string) ($payload['applicantSignature']['signedName'] ?? ($context['full_name'] ?? ''))),
                'signatureUpload' => $this->normalizeUploadMetadata($payload['applicantSignature']['signatureUpload'] ?? null),
            ],
            'coMakerSignature' => [
                'signedName' => trim((string) ($payload['coMakerSignature']['signedName'] ?? '')),
                'signatureUpload' => $this->normalizeUploadMetadata($payload['coMakerSignature']['signatureUpload'] ?? null),
            ],
        ];

        $errors = [];
        if ($strict) {
            foreach ([
                'beneficiary.fullName' => 'Beneficiary name is required.',
                'beneficiary.age' => 'Beneficiary age is required.',
                'beneficiary.addressLine' => 'Beneficiary address is required.',
                'project.programName' => 'Program name is required.',
                'project.projectName' => 'Project name is required.',
                'project.amountReceived' => 'Amount received is required.',
                'coMaker.fullName' => 'Co-maker name is required.',
                'agreement.dateSigned' => 'Date signed is required.',
                'agreement.yearSigned' => 'Year signed is required.',
                'applicantSignature.signedName' => 'Beneficiary signature name is required.',
                'coMakerSignature.signedName' => 'Co-maker signature name is required.',
            ] as $field => $message) {
                if ($this->arrayGet($clean, $field) === '') {
                    $errors[$field] = $message;
                }
            }

            if ($clean['applicantSignature']['signatureUpload'] === null) {
                $errors['applicantSignature.signatureUpload'] = 'Upload the beneficiary e-signature file.';
            }
            if ($clean['coMakerSignature']['signatureUpload'] === null) {
                $errors['coMakerSignature.signatureUpload'] = 'Upload the co-maker e-signature file.';
            }
        }

        return ['payload' => $clean, 'errors' => $errors];
    }

    private function defaultPayload(string $code, array $context): array
    {
        return match ($code) {
            POST_APPROVAL_TASK_AVAILMENT_FORM => [
                'clientIdentifyingData' => [
                    'name' => $context['full_name'] ?? '',
                    'age' => $context['age'] !== null ? (string) $context['age'] : '',
                    'address' => $this->buildDefaultAddress($context),
                    'spouseName' => '',
                    'city' => 'Butuan City',
                ],
                'familyEnterprise' => ['members' => [['name' => '', 'age' => '', 'activities' => '']]],
                'individualAssistance' => [
                    'clienteleCategory' => '',
                    'natureOfDifficultCircumstances' => '',
                ],
                'incomeEligibility' => [
                    'rows' => [['memberName' => '', 'cashIncome' => '', 'nonCashIncome' => '', 'totalIncome' => '']],
                    'totalFamilyIncome' => '',
                ],
                'clientCommitment' => [
                    'agreedToPolicies' => false,
                    'agreedToRollBackSchedule' => false,
                    'agreedToWeeklySavings' => false,
                    'notes' => '',
                ],
                'applicantSignature' => [
                    'signedName' => $context['full_name'] ?? '',
                    'signedDate' => date('Y-m-d'),
                    'signatureUpload' => null,
                ],
                'staffReview' => [
                    'pageOneCertification' => [
                        'eligibilityStatementName' => $context['full_name'] ?? '',
                        'directWorkerName' => '',
                        'directWorkerTitle' => '',
                        'signedDate' => '',
                        'signatureUpload' => null,
                    ],
                    'physicalRequirements' => [
                        'healthAgeRows' => [['requirement' => '', 'age' => '', 'healthStatus' => '']],
                        'foodRelatedCertification' => [
                            'applicantName' => $context['full_name'] ?? '',
                            'requiresMedicalClearance' => '',
                            'medicalCheckupCompleted' => '',
                            'medicallyFit' => '',
                            'certifyingOfficerName' => '',
                            'certifyingOfficerTitle' => '',
                            'signedDate' => '',
                            'signatureUpload' => null,
                        ],
                    ],
                    'psychoSocialRequirements' => [
                        'residencyAndCharacter' => [
                            'residentName' => $context['full_name'] ?? '',
                            'barangay' => $context['barangay_name'] ?? '',
                            'isBonaFideResident' => '',
                            'goodMoralCharacter' => '',
                            'hasNoAdverseReputation' => '',
                            'certifyingOfficerName' => '',
                            'certifyingOfficerTitle' => '',
                            'signedDate' => '',
                            'signatureUpload' => null,
                        ],
                        'familyRelationshipsWorkHabitsAspiration' => [
                            'applicantName' => $context['full_name'] ?? '',
                            'positiveRelationships' => '',
                            'goodWorkHabitsAndAttitude' => '',
                            'adequateEconomicAspiration' => '',
                            'findingText' => '',
                            'directWorkerName' => '',
                            'directWorkerTitle' => '',
                            'signedDate' => '',
                            'signatureUpload' => null,
                        ],
                        'socialResponsibility' => [
                            'abidePolicies' => '',
                            'payRollBackOnTime' => '',
                            'generateWeeklySavings' => '',
                            'acknowledgementText' => '',
                        ],
                    ],
                ],
            ],
            POST_APPROVAL_TASK_VALIDATION_FORM => [
                'applicantDetails' => [
                    'validationDate' => date('Y-m-d'),
                    'lastName' => $this->splitName((string) ($context['full_name'] ?? ''))['lastName'],
                    'firstName' => $this->splitName((string) ($context['full_name'] ?? ''))['firstName'],
                    'middleName' => $this->splitName((string) ($context['full_name'] ?? ''))['middleName'],
                    'purok' => '',
                    'barangay' => $context['barangay_name'] ?? '',
                    'birthdate' => $context['birthdate'] ?? '',
                    'educationalAttainment' => '',
                    'contactNumber' => $context['contact_number'] ?? '',
                ],
                'membershipChecklist' => [
                    'pantawidMember' => ((int) ($context['is_4ps'] ?? 0)) === 1 ? 'Yes' : 'No',
                    'pantawidSpecify' => '',
                    'slpaMember' => '',
                    'slpaSpecify' => '',
                ],
                'participantSignature' => [
                    'signedName' => $context['full_name'] ?? '',
                    'signedDate' => date('Y-m-d'),
                    'signatureUpload' => null,
                ],
                'staffReview' => [
                    'validatorRecommendation' => '',
                    'eligibilityAssessment' => [
                        'residentName' => $context['full_name'] ?? '',
                        'age' => $context['age'] !== null ? (string) $context['age'] : '',
                        'barangay' => $context['barangay_name'] ?? '',
                        'understandsAssistanceProcess' => '',
                        'assistanceProcessUnderstanding' => '',
                        'eligibilityDecision' => '',
                    ],
                    'validatorIdentity' => [
                        'validatorName' => '',
                        'validatorTitle' => '',
                        'signedDate' => '',
                        'signatureUpload' => null,
                    ],
                ],
            ],
            POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO => [
                'projectInformation' => [
                    'participantName' => $context['full_name'] ?? '',
                    'projectTitle' => $context['business_name'] ?? '',
                    'projectLocation' => $this->buildDefaultAddress($context),
                    'projectDate' => date('Y-m-d'),
                    'projectedAmount' => '',
                    'cswddAmount' => '',
                    'otherFundingSource' => '',
                    'savingsAccountNumber' => 'NONE',
                ],
                'sectoralClassification' => [
                    'pantawid' => [
                        'sexFemale' => false,
                        'sexMale' => false,
                        'seniorFemale' => false,
                        'seniorMale' => false,
                        'pwdFemale' => false,
                        'pwdMale' => false,
                        'ipFemale' => false,
                        'ipMale' => false,
                        'soloParentFemale' => false,
                        'soloParentMale' => false,
                    ],
                    'nonPantawid' => [
                        'sexFemale' => false,
                        'sexMale' => false,
                        'seniorFemale' => false,
                        'seniorMale' => false,
                        'pwdFemale' => false,
                        'pwdMale' => false,
                        'ipFemale' => false,
                        'ipMale' => false,
                        'soloParentFemale' => false,
                        'soloParentMale' => false,
                    ],
                ],
                'rationale' => '',
                'modalityApplications' => [
                    'rows' => [
                        ['fundSource' => 'Sumasalmot/Partisipante', 'contributionType' => '', 'amount' => ''],
                        ['fundSource' => 'Katimbang nga Ahensya/Institusyon', 'contributionType' => '', 'amount' => ''],
                    ],
                ],
                'businessOperation' => [
                    'materials' => [
                        'rows' => [['material' => '', 'quality' => '', 'unit' => '', 'unitPrice' => '', 'cyclesPerProduction' => '', 'projectedCost' => '']],
                        'totalCost' => '',
                    ],
                    'labor' => [
                        'rows' => [['workerName' => '', 'position' => '', 'dailyWage' => '']],
                        'totalDailyWage' => '',
                        'totalProductionCycleWage' => '',
                    ],
                    'toolsEquipment' => [
                        'rows' => [[
                            'equipment' => '',
                            'capacity' => '',
                            'unit' => '',
                            'quantityOrPrice' => '',
                            'projectedAmount' => '',
                            'usefulLifeDays' => '',
                            'productionCycle' => '',
                            'depreciationCost' => '',
                        ]],
                        'totalCost' => '',
                    ],
                    'operatingExpenses' => [
                        'rows' => $this->defaultMungkahingExpenseRows(),
                        'grandTotal' => '',
                    ],
                    'salesProjection' => [
                        'rows' => [['product' => '', 'capacity' => '', 'unit' => '', 'sellingPrice' => '', 'projectedSales' => '']],
                        'grossSales' => '',
                    ],
                    'incomeComputation' => [
                        'projectedIncomePerCycle' => '',
                        'rawMaterialsCost' => '',
                        'manpowerLaborCost' => '',
                        'depreciationCost' => '',
                        'otherExpenses' => '',
                        'totalOperatingCost' => '',
                        'grossProfit' => '',
                        'netProfit' => '',
                    ],
                ],
                'spendingPlan' => [
                    'rows' => [['expense' => '', 'amount' => '', 'usageSchedule' => '']],
                ],
                'applicantSignature' => [
                    'signedName' => $context['full_name'] ?? '',
                    'signedDate' => date('Y-m-d'),
                    'signatureUpload' => null,
                ],
                'staffReview' => [
                    'recommendation' => [
                        'projectName' => $context['business_name'] ?? '',
                        'recommendedAmount' => '',
                        'recommendationText' => '',
                        'approverName' => '',
                        'approverTitle' => 'CSWDO',
                        'approvedDate' => '',
                        'signatureUpload' => null,
                    ],
                ],
            ],
            POST_APPROVAL_TASK_BUSINESS_PLAN => [
                'overview' => [
                    'businessName' => $context['business_name'] ?? '',
                    'ownerName' => $context['full_name'] ?? '',
                    'businessAddress' => $this->buildDefaultAddress($context),
                    'contactNumber' => $context['contact_number'] ?? '',
                    'businessGoal' => '',
                ],
                'executiveSummary' => '',
                'productsServices' => [
                    'rows' => [[
                        'name' => '',
                        'description' => '',
                        'price' => '',
                        'targetMarket' => '',
                    ]],
                ],
                'marketStrategy' => [
                    'customerProfile' => '',
                    'competitors' => '',
                    'marketingApproach' => '',
                    'salesChannel' => '',
                ],
                'operationsPlan' => [
                    'businessLocation' => '',
                    'productionProcess' => '',
                    'equipmentNeeded' => '',
                    'staffingPlan' => '',
                ],
                'financialPlan' => [
                    'startupCapital' => '',
                    'monthlySalesProjection' => '',
                    'monthlyExpenseProjection' => '',
                    'projectedNetIncome' => '',
                    'breakEvenNotes' => '',
                ],
                'riskManagement' => [
                    'risks' => '',
                    'mitigation' => '',
                ],
                'implementationSchedule' => [
                    'rows' => [[
                        'activity' => '',
                        'targetDate' => '',
                        'responsiblePerson' => '',
                    ]],
                ],
                'applicantSignature' => [
                    'signedName' => $context['full_name'] ?? '',
                    'signedDate' => date('Y-m-d'),
                    'signatureUpload' => null,
                ],
                'staffReview' => [
                    'approval' => [
                        'reviewSummary' => '',
                        'recommendedAction' => '',
                        'approverName' => '',
                        'approverTitle' => 'CSWDO',
                        'approvedDate' => '',
                        'signatureUpload' => null,
                    ],
                ],
            ],
            POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA => [
                'beneficiary' => [
                    'fullName' => $context['full_name'] ?? '',
                    'age' => $context['age'] !== null ? (string) $context['age'] : '',
                    'addressLine' => trim((string) ($context['address_line'] ?? '')),
                    'barangay' => trim((string) ($context['barangay_name'] ?? '')),
                    'city' => 'Butuan City',
                ],
                'project' => [
                    'programName' => 'SMART LEAP',
                    'projectName' => $context['business_name'] ?? '',
                    'amountReceived' => '',
                ],
                'coMaker' => [
                    'fullName' => '',
                    'addressLine' => '',
                    'barangay' => '',
                    'city' => '',
                ],
                'agreement' => [
                    'dateSigned' => date('Y-m-d'),
                    'yearSigned' => date('Y'),
                ],
                'applicantSignature' => [
                    'signedName' => $context['full_name'] ?? '',
                    'signatureUpload' => null,
                ],
                'coMakerSignature' => [
                    'signedName' => '',
                    'signatureUpload' => null,
                ],
                'staffReview' => [
                    'verification' => [
                        'reviewerName' => '',
                        'reviewerTitle' => '',
                        'reviewerDate' => '',
                        'remarks' => '',
                        'signatureUpload' => null,
                    ],
                ],
            ],
            default => [],
        };
    }

    private function completionForTask(string $code, array $payload): int
    {
        $required = match ($code) {
            POST_APPROVAL_TASK_AVAILMENT_FORM => [
                'clientIdentifyingData.name',
                'clientIdentifyingData.age',
                'clientIdentifyingData.address',
                'individualAssistance.clienteleCategory',
                'individualAssistance.natureOfDifficultCircumstances',
                'clientCommitment.agreedToPolicies',
                'clientCommitment.agreedToRollBackSchedule',
                'clientCommitment.agreedToWeeklySavings',
                'applicantSignature.signedName',
                'applicantSignature.signedDate',
            ],
            POST_APPROVAL_TASK_VALIDATION_FORM => [
                'applicantDetails.validationDate',
                'applicantDetails.lastName',
                'applicantDetails.firstName',
                'applicantDetails.barangay',
                'applicantDetails.birthdate',
                'applicantDetails.contactNumber',
                'membershipChecklist.pantawidMember',
                'membershipChecklist.slpaMember',
                'participantSignature.signedName',
                'participantSignature.signedDate',
            ],
            POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO => [
                'projectInformation.participantName',
                'projectInformation.projectTitle',
                'projectInformation.projectLocation',
                'projectInformation.projectDate',
                'projectInformation.projectedAmount',
                'rationale',
                'applicantSignature.signedName',
                'applicantSignature.signedDate',
            ],
            POST_APPROVAL_TASK_BUSINESS_PLAN => [
                'overview.businessName',
                'overview.ownerName',
                'overview.businessAddress',
                'overview.contactNumber',
                'overview.businessGoal',
                'executiveSummary',
                'marketStrategy.customerProfile',
                'operationsPlan.productionProcess',
                'financialPlan.startupCapital',
                'applicantSignature.signedName',
                'applicantSignature.signedDate',
            ],
            POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA => [
                'beneficiary.fullName',
                'beneficiary.age',
                'beneficiary.addressLine',
                'project.programName',
                'project.projectName',
                'project.amountReceived',
                'coMaker.fullName',
                'agreement.dateSigned',
                'agreement.yearSigned',
                'applicantSignature.signedName',
                'coMakerSignature.signedName',
            ],
            default => [],
        };

        if ($required === []) {
            return 0;
        }

        $completed = 0;
        foreach ($required as $path) {
            $value = $this->arrayGet($payload, $path);
            if (is_bool($value)) {
                $completed += $value ? 1 : 0;
                continue;
            }
            if (is_string($value) && trim($value) !== '') {
                $completed++;
            }
        }

        return (int) round(($completed / count($required)) * 100);
    }

    private function normalizeStatus(string $status): string
    {
        foreach (POST_APPROVAL_ALLOWED_STATUSES as $allowed) {
            if (strtolower($allowed) === strtolower(trim($status))) {
                return $allowed;
            }
        }
        if (strtolower(trim($status)) === 'pending') {
            return POST_APPROVAL_STATUS_UNLOCKED;
        }
        return $status === '' ? POST_APPROVAL_STATUS_UNLOCKED : $status;
    }

    private function decodePayload(mixed $value): ?array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || trim($value) === '') {
            return null;
        }

        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : null;
    }

    private function normalizeYesNo(string $value): string
    {
        $value = strtolower(trim($value));
        return match ($value) {
            'yes', 'y', 'true', '1' => 'Yes',
            'no', 'n', 'false', '0' => 'No',
            default => '',
        };
    }

    private function buildDefaultAddress(array $context): string
    {
        $address = trim((string) ($context['address_line'] ?? ''));
        $barangay = trim((string) ($context['barangay_name'] ?? ''));
        if ($address !== '' && $barangay !== '' && !str_contains(strtolower($address), strtolower($barangay))) {
            return $address . ', ' . $barangay;
        }

        return $address !== '' ? $address : $barangay;
    }

    private function splitName(string $fullName): array
    {
        $parts = preg_split('/\s+/', trim($fullName)) ?: [];
        if ($parts === []) {
            return ['firstName' => '', 'middleName' => '', 'lastName' => ''];
        }
        if (count($parts) === 1) {
            return ['firstName' => $parts[0], 'middleName' => '', 'lastName' => ''];
        }

        $lastName = array_pop($parts);
        $firstName = array_shift($parts);
        $middleName = implode(' ', $parts);

        return [
            'firstName' => $firstName,
            'middleName' => $middleName,
            'lastName' => (string) $lastName,
        ];
    }

    private function arrayGet(array $payload, string $path): mixed
    {
        $segments = explode('.', $path);
        $value = $payload;
        foreach ($segments as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                return null;
            }
            $value = $value[$segment];
        }
        return $value;
    }

    private function mergePersistedPayload(array $task, array $newPayload): array
    {
        $existingPayload = $this->decodePayload($task['form_payload'] ?? null) ?? [];
        if ($existingPayload === []) {
            return $newPayload;
        }

        return array_replace_recursive($existingPayload, $newPayload);
    }

    private function normalizeUploadMetadata(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }

        $filePath = trim((string) ($value['file_path'] ?? ''));
        if ($filePath === '') {
            return null;
        }

        return [
            'file_path' => $filePath,
            'original_name' => trim((string) ($value['original_name'] ?? basename($filePath))),
            'mime_type' => trim((string) ($value['mime_type'] ?? '')),
            'file_size' => (int) ($value['file_size'] ?? 0),
            'uploaded_at' => trim((string) ($value['uploaded_at'] ?? '')),
        ];
    }

    private function payloadWithFieldValue(string $path, mixed $value): array
    {
        $payload = [];
        $segments = explode('.', $path);
        $cursor =& $payload;
        foreach ($segments as $index => $segment) {
            $isLast = $index === count($segments) - 1;
            if ($isLast) {
                $cursor[$segment] = $value;
                break;
            }

            if (!isset($cursor[$segment]) || !is_array($cursor[$segment])) {
                $cursor[$segment] = [];
            }
            $cursor =& $cursor[$segment];
        }

        return $payload;
    }

    private function normalizeBooleanFlag(mixed $value): bool
    {
        if (is_bool($value)) {
            return $value;
        }

        $normalized = strtolower(trim((string) $value));
        return in_array($normalized, ['1', 'true', 'yes', 'on', 'checked'], true);
    }

    private function defaultMungkahingExpenseRows(): array
    {
        return [
            ['expenseName' => 'Renta sa himuanan sa produkto/opisina', 'paymentFrequency' => '', 'projectedCost' => ''],
            ['expenseName' => 'Kuryente', 'paymentFrequency' => '', 'projectedCost' => ''],
            ['expenseName' => 'Tubig', 'paymentFrequency' => '', 'projectedCost' => ''],
            ['expenseName' => 'Pamilite', 'paymentFrequency' => '', 'projectedCost' => ''],
            ['expenseName' => 'Permit sa pag-operate', 'paymentFrequency' => '', 'projectedCost' => ''],
            ['expenseName' => 'Lain pang mga gastohanan', 'paymentFrequency' => '', 'projectedCost' => ''],
        ];
    }

    private function allowedApplicantUploadFields(): array
    {
        return [
            POST_APPROVAL_TASK_AVAILMENT_FORM => [
                'applicantSignature.signatureUpload' => 'applicant-signature',
            ],
            POST_APPROVAL_TASK_VALIDATION_FORM => [
                'participantSignature.signatureUpload' => 'applicant-signature',
            ],
            POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO => [
                'applicantSignature.signatureUpload' => 'applicant-signature',
            ],
            POST_APPROVAL_TASK_BUSINESS_PLAN => [
                'applicantSignature.signatureUpload' => 'applicant-signature',
            ],
            POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA => [
                'applicantSignature.signatureUpload' => 'applicant-signature',
                'coMakerSignature.signatureUpload' => 'applicant-signature',
            ],
        ];
    }

    private function emptyState(): array
    {
        return [
            'isUnlocked' => false,
            'unlockedAt' => null,
            'beneficiaryProfileId' => null,
            'tasks' => [],
            'summary' => [
                'total' => 0,
                'unlocked' => 0,
                'inProgress' => 0,
                'submitted' => 0,
                'verified' => 0,
                'needsCorrection' => 0,
                'rejected' => 0,
            ],
        ];
    }

    private function taskDefinitions(): array
    {
        return [
            POST_APPROVAL_TASK_AVAILMENT_FORM => [
                'title' => 'SMART LEAP Availment Form',
                'summary' => 'Client identifying data, project type, income eligibility, and applicant commitment for SMART LEAP availment.',
                'helpText' => 'Complete the applicant-editable parts first. Certification sections remain reserved for CSWDD staff.',
                'interactive' => true,
                'applicantSections' => [
                    [
                        'id' => 'clientIdentifyingData',
                        'title' => 'Client Identifying Data',
                        'description' => 'Basic applicant information taken from the paper availment form.',
                    ],
                    [
                        'id' => 'familyEnterprise',
                        'title' => 'Type of Project: Family Enterprise',
                        'description' => 'List family members who will participate in the project and their activities.',
                    ],
                    [
                        'id' => 'individualAssistance',
                        'title' => 'Type of Project: Individual Assistance',
                        'description' => 'State the clientele category and describe the difficult circumstances relevant to this availment.',
                    ],
                    [
                        'id' => 'incomeEligibility',
                        'title' => 'Income Eligibility Requirement',
                        'description' => 'Provide the family income details required by the form.',
                    ],
                    [
                        'id' => 'clientCommitment',
                        'title' => 'Social Responsibility and Willingness to Save',
                        'description' => 'Acknowledge the exact policy, roll-back, and weekly savings commitments from the paper form.',
                    ],
                ],
                'staffSections' => [
                    [
                        'title' => 'Physical Requirements',
                        'description' => 'Health and age requirement rows plus food-related project medical certification are staff-only review fields from page 2.',
                    ],
                    [
                        'title' => 'Psycho-Social Requirements',
                        'description' => 'Residency/character, work habits/aspirations, and social responsibility assessments are staff-only review fields from page 2.',
                    ],
                    [
                        'title' => 'Signatures and Uploads',
                        'description' => 'Applicant e-signature upload is required. Direct worker and certifying officer sign-off uploads remain staff-only.',
                    ],
                ],
            ],
            POST_APPROVAL_TASK_VALIDATION_FORM => [
                'title' => 'SMART LEAP Validation Form',
                'summary' => 'Applicant profile details and checklist data required before validator assessment.',
                'helpText' => 'Enter your personal details and checklist answers. Recommendation and eligibility determination remain validator-only.',
                'interactive' => true,
                'applicantSections' => [
                    [
                        'id' => 'applicantDetails',
                        'title' => 'Applicant Details',
                        'description' => 'Fill the participant information block from the validation form.',
                    ],
                    [
                        'id' => 'membershipChecklist',
                        'title' => 'Checklist',
                        'description' => 'Answer the Pantawid and SLPA membership items and add specifics when applicable.',
                    ],
                ],
                'staffSections' => [
                    [
                        'title' => 'Validator Recommendation and Eligibility',
                        'description' => 'Validator recommendation, assistance-process assessment, ANGAYAN/DILI ANGAYAN decision, and validator identity remain staff-only.',
                    ],
                    [
                        'title' => 'Signatures and Uploads',
                        'description' => 'Participant e-signature upload is required. Validator signature upload remains staff-only.',
                    ],
                ],
            ],
            POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO => [
                'title' => 'Mungkahing Proyekto',
                'summary' => 'Structured project proposal tables based on the paper SMART LEAP proposal form.',
                'helpText' => 'Complete the project proposal tables and rationale first. Recommendation and approval remain reserved for staff review.',
                'interactive' => true,
                'applicantSections' => [
                    [
                        'id' => 'projectInformation',
                        'title' => 'Kinatibuk-an Impormasyon Bahin sa Proyekto',
                        'description' => 'Participant details, project title, location, date, and funding amounts from page 1.',
                    ],
                    [
                        'id' => 'sectoralClassification',
                        'title' => 'Sectoral Classification',
                        'description' => 'Pantawid and Non-Pantawid sectoral counts exactly as shown in the proposal table.',
                    ],
                    [
                        'id' => 'rationale',
                        'title' => 'Rationale of the Proposed Project',
                        'description' => 'State the project rationale in the same section order as the paper form.',
                    ],
                    [
                        'id' => 'modalityApplications',
                        'title' => 'Detalye sa Modality Application/s',
                        'description' => 'List the participant and counterpart contributions under SEA-K modality.',
                    ],
                    [
                        'id' => 'businessOperation',
                        'title' => 'Pagdumala sa Negosyo',
                        'description' => 'Materials, labor, tools and equipment, operating expenses, sales, and income computation tables from pages 1 to 3.',
                    ],
                    [
                        'id' => 'spendingPlan',
                        'title' => 'Iskedyul o Plano sa Paggasto sa SEA-K Capital Fund',
                        'description' => 'List the planned expenses, amounts, and usage schedule.',
                    ],
                    [
                        'id' => 'applicantSignature',
                        'title' => 'Participant Sign-off',
                        'description' => 'Attach the participant signature for the proposal package.',
                    ],
                ],
                'staffSections' => [
                    [
                        'title' => 'Rekomendasyon',
                        'description' => 'CSWDD recommendation, recommended amount, and approval sign-off remain staff-only review fields from page 3.',
                    ],
                ],
            ],
            POST_APPROVAL_TASK_BUSINESS_PLAN => [
                'title' => 'Business Plan',
                'summary' => 'Business plan narrative and operating tables based on the provided CSWDD business plan copy.',
                'helpText' => 'Complete the business plan narrative, operations, financial, and schedule sections first. Approval remains reserved for staff review.',
                'interactive' => true,
                'applicantSections' => [
                    [
                        'id' => 'overview',
                        'title' => 'Business Profile',
                        'description' => 'Business name, owner details, address, contact number, and goal of the plan.',
                    ],
                    [
                        'id' => 'executiveSummary',
                        'title' => 'Executive Summary',
                        'description' => 'Provide the short narrative summary of the proposed business direction.',
                    ],
                    [
                        'id' => 'productsServices',
                        'title' => 'Products and Services',
                        'description' => 'List what the business will offer, the description, price point, and target market.',
                    ],
                    [
                        'id' => 'marketStrategy',
                        'title' => 'Market Strategy',
                        'description' => 'Describe customer profile, competitors, marketing approach, and sales channel.',
                    ],
                    [
                        'id' => 'operationsPlan',
                        'title' => 'Operations Plan',
                        'description' => 'State the location, process, equipment needed, and staffing plan.',
                    ],
                    [
                        'id' => 'financialPlan',
                        'title' => 'Financial Plan',
                        'description' => 'Provide startup capital, sales projection, expense projection, projected income, and break-even notes.',
                    ],
                    [
                        'id' => 'riskManagement',
                        'title' => 'Risk Management',
                        'description' => 'Identify risks and the mitigation strategy for the business.',
                    ],
                    [
                        'id' => 'implementationSchedule',
                        'title' => 'Implementation Schedule',
                        'description' => 'List key activities, target dates, and responsible persons.',
                    ],
                    [
                        'id' => 'applicantSignature',
                        'title' => 'Applicant Sign-off',
                        'description' => 'Attach the applicant signature for the business plan submission.',
                    ],
                ],
                'staffSections' => [
                    [
                        'title' => 'Business Plan Approval',
                        'description' => 'Review summary, recommended action, and PDO/Admin approval sign-off remain staff-only.',
                    ],
                ],
            ],
            POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA => [
                'title' => 'Buhat sa Pagpanumpa',
                'summary' => 'Beneficiary oath and undertaking form for SMART LEAP.',
                'helpText' => 'Complete the oath undertaking and upload both the beneficiary and co-maker signatures before submitting. Staff verification remains reviewer-only.',
                'interactive' => true,
                'applicantSections' => [
                    [
                        'id' => 'beneficiary',
                        'title' => 'Impormasyon sa Benepisyaryo',
                        'description' => 'Beneficiary identity details shown in the introductory oath paragraph.',
                    ],
                    [
                        'id' => 'project',
                        'title' => 'Detalye sa Programa ug Proyekto',
                        'description' => 'Program name, project name, and amount received referenced in the oath clauses.',
                    ],
                    [
                        'id' => 'coMaker',
                        'title' => 'Detalye sa Co-maker',
                        'description' => 'Co-maker identity used in the joint undertaking and signature block.',
                    ],
                    [
                        'id' => 'agreement',
                        'title' => 'Petsa sa Kasabutan',
                        'description' => 'Date and year used in the sworn undertaking closing statement.',
                    ],
                    [
                        'id' => 'applicantSignature',
                        'title' => 'Pirma sa Benepisyaryo',
                        'description' => 'Type the beneficiary name and upload the beneficiary e-signature.',
                    ],
                    [
                        'id' => 'coMakerSignature',
                        'title' => 'Pirma sa Co-maker',
                        'description' => 'Type the co-maker name and upload the co-maker e-signature.',
                    ],
                ],
                'staffSections' => [
                    [
                        'title' => 'Verification',
                        'description' => 'Reviewer verification name, title, date, remarks, and signature remain staff-only in the review workflow.',
                    ],
                ],
            ],
        ];
    }
}

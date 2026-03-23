<?php

declare(strict_types=1);

namespace App\Services;

use PDO;
use Throwable;

class PostApprovalReviewService
{
    public function stateForReviewer(int $userId): array
    {
        $reviewer = $this->resolveReviewer($userId);
        if ($reviewer === null) {
            return ['ok' => false, 'message' => 'Reviewer access is not allowed.'];
        }

        return [
            'ok' => true,
            'reviewer' => $reviewer,
            'tasks' => $this->listTasks($reviewer),
            'summary' => $this->buildSummary($reviewer),
        ];
    }

    public function taskForReviewer(int $userId, int $taskId): ?array
    {
        $reviewer = $this->resolveReviewer($userId);
        if ($reviewer === null) {
            return null;
        }

        $task = $this->findScopedTask($reviewer, $taskId);
        if ($task === null) {
            return null;
        }

        return $this->mapTask($task, true);
    }

    public function reviewTask(int $userId, int $taskId, string $decision, string $remarks, string $applicantVisibleRemark, array $staffForm): array
    {
        $reviewer = $this->resolveReviewer($userId);
        if ($reviewer === null) {
            return ['ok' => false, 'errors' => ['general' => 'Reviewer access is not allowed.']];
        }

        $task = $this->findScopedTask($reviewer, $taskId);
        if ($task === null) {
            return ['ok' => false, 'errors' => ['task' => 'Post-approval task not found.']];
        }

        $status = $this->normalizeDecision($decision);
        if ($status === null) {
            return ['ok' => false, 'errors' => ['status' => 'Select Verified, Rejected, or Needs Correction.']];
        }

        if (!in_array((string) $task['status'], [POST_APPROVAL_STATUS_SUBMITTED, POST_APPROVAL_STATUS_NEEDS_CORRECTION, POST_APPROVAL_STATUS_REJECTED, POST_APPROVAL_STATUS_VERIFIED], true)) {
            return ['ok' => false, 'errors' => ['task' => 'Only submitted or previously reviewed forms can be reviewed.']];
        }

        $staffValidation = $this->validateStaffPayload((string) $task['code'], $staffForm);
        if ($staffValidation['errors'] !== []) {
            return ['ok' => false, 'errors' => $staffValidation['errors']];
        }

        $remarks = trim($remarks);
        $applicantVisibleRemark = trim($applicantVisibleRemark);
        if (in_array($status, [POST_APPROVAL_STATUS_REJECTED, POST_APPROVAL_STATUS_NEEDS_CORRECTION], true) && $applicantVisibleRemark === '') {
            return ['ok' => false, 'errors' => ['applicantVisibleRemark' => 'Applicant-visible remark is required for rejection or correction.']];
        }

        $mergedPayload = $this->mergeStaffPayload($task, $staffValidation['payload']);
        $pdo = db();
        $pdo->beginTransaction();

        try {
            $pdo->prepare(
                'UPDATE post_approval_tasks
                 SET status = :status,
                     form_payload = :form_payload,
                     reviewed_by_user_id = :reviewed_by_user_id,
                     reviewed_at = NOW(),
                     reviewer_remarks = :reviewer_remarks,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            )->execute([
                'status' => $status,
                'form_payload' => json_encode($mergedPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'reviewed_by_user_id' => $userId,
                'reviewer_remarks' => $remarks !== '' ? $remarks : null,
                'id' => $taskId,
            ]);

            $pdo->prepare(
                'UPDATE post_approval_submissions
                 SET review_status = :review_status,
                     reviewer_remarks = :reviewer_remarks,
                     reviewed_by_user_id = :reviewed_by_user_id,
                     reviewed_at = NOW(),
                     updated_at = CURRENT_TIMESTAMP
                 WHERE post_approval_task_id = :post_approval_task_id
                   AND submission_kind = "form"
                 ORDER BY id DESC
                 LIMIT 1'
            )->execute([
                'review_status' => $status,
                'reviewer_remarks' => $remarks !== '' ? $remarks : null,
                'reviewed_by_user_id' => $userId,
                'post_approval_task_id' => $taskId,
            ]);

            $pdo->commit();
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            log_database_query_failure('post_approval.review', $exception, ['task_id' => $taskId, 'status' => $status]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to save the review right now.']];
        }

        $this->notifyApplicant($task, $status, $applicantVisibleRemark);
        (new AuditLogService())->record(
            $userId,
            'post_approval.reviewed',
            'post_approval_tasks',
            $taskId,
            ['status' => $status, 'code' => $task['code']]
        );

        return ['ok' => true];
    }

    public function uploadTaskAsset(int $userId, int $taskId, string $fieldKey, array $file): array
    {
        $reviewer = $this->resolveReviewer($userId);
        if ($reviewer === null) {
            return ['ok' => false, 'errors' => ['general' => 'Reviewer access is not allowed.']];
        }

        $task = $this->findScopedTask($reviewer, $taskId);
        if ($task === null) {
            return ['ok' => false, 'errors' => ['task' => 'Post-approval task not found.']];
        }

        $allowed = $this->allowedReviewerUploadFields()[(string) $task['code']] ?? [];
        if (!isset($allowed[$fieldKey])) {
            return ['ok' => false, 'errors' => ['field' => 'Unsupported upload field.']];
        }

        try {
            $metadata = (new UploadService())->storePostApprovalAsset((string) $allowed[$fieldKey], $file);
        } catch (Throwable $exception) {
            log_database_query_failure('post_approval.review_upload', $exception, ['task_id' => $taskId, 'field_key' => $fieldKey]);
            return ['ok' => false, 'errors' => ['general' => $exception->getMessage() ?: 'Unable to upload file.']];
        }

        $mergedPayload = $this->mergeStaffPayload($task, $this->payloadWithFieldValue($fieldKey, $metadata));

        try {
            db()->prepare(
                'UPDATE post_approval_tasks
                 SET form_payload = :form_payload,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = :id'
            )->execute([
                'form_payload' => json_encode($mergedPayload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                'id' => $taskId,
            ]);
        } catch (Throwable $exception) {
            log_database_query_failure('post_approval.review_upload_persist', $exception, ['task_id' => $taskId, 'field_key' => $fieldKey]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to save this upload right now.']];
        }

        return ['ok' => true, 'upload' => $metadata];
    }

    private function resolveReviewer(int $userId): ?array
    {
        $statement = db()->prepare(
            'SELECT users.id, users.full_name, users.email, roles.name AS role, staff_profiles.id AS staff_profile_id
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             LEFT JOIN staff_profiles ON staff_profiles.user_id = users.id
             WHERE users.id = :user_id
             LIMIT 1'
        );
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return null;
        }

        if (!in_array((string) $row['role'], [ROLE_ADMIN, ROLE_PROJECT_OFFICER, ROLE_SOCIAL_WORKER], true)) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'name' => $row['full_name'],
            'email' => $row['email'],
            'role' => $row['role'],
            'staffProfileId' => $row['staff_profile_id'] !== null ? (int) $row['staff_profile_id'] : null,
        ];
    }

    private function listTasks(array $reviewer): array
    {
        $statement = $this->buildScopedTaskStatement($reviewer, false);
        $statement->execute($this->scopedParams($reviewer));
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn (array $row): array => $this->mapTask($row, false), $rows);
    }

    private function buildSummary(array $reviewer): array
    {
        $statement = $this->buildScopedTaskStatement($reviewer, true);
        $statement->execute($this->scopedParams($reviewer));
        $row = $statement->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total' => (int) ($row['total'] ?? 0),
            'submitted' => (int) ($row['submitted'] ?? 0),
            'verified' => (int) ($row['verified'] ?? 0),
            'needsCorrection' => (int) ($row['needs_correction'] ?? 0),
            'rejected' => (int) ($row['rejected'] ?? 0),
        ];
    }

    private function buildScopedTaskStatement(array $reviewer, bool $summary): \PDOStatement
    {
        $scopeJoin = '';
        $scopeWhere = '';
        if ($reviewer['role'] !== ROLE_ADMIN) {
            $scopeJoin = '
                INNER JOIN staff_barangay_assignments ON staff_barangay_assignments.barangay_id = applicant_profiles.barangay_id
                    AND staff_barangay_assignments.staff_profile_id = :staff_profile_id
                    AND staff_barangay_assignments.ended_at IS NULL';
        }

        if ($summary) {
            return db()->prepare(
                'SELECT
                    COUNT(post_approval_tasks.id) AS total,
                    SUM(CASE WHEN post_approval_tasks.status = "Submitted" THEN 1 ELSE 0 END) AS submitted,
                    SUM(CASE WHEN post_approval_tasks.status = "Verified" THEN 1 ELSE 0 END) AS verified,
                    SUM(CASE WHEN post_approval_tasks.status = "Needs Correction" THEN 1 ELSE 0 END) AS needs_correction,
                    SUM(CASE WHEN post_approval_tasks.status = "Rejected" THEN 1 ELSE 0 END) AS rejected
                 FROM post_approval_tasks
                 INNER JOIN post_approval_task_types ON post_approval_task_types.id = post_approval_tasks.task_type_id
                 INNER JOIN beneficiary_profiles ON beneficiary_profiles.id = post_approval_tasks.beneficiary_profile_id
                 INNER JOIN applicant_profiles ON applicant_profiles.id = beneficiary_profiles.applicant_profile_id
                 INNER JOIN users AS applicant_users ON applicant_users.id = applicant_profiles.user_id'
                 . $scopeJoin .
                ' WHERE post_approval_task_types.code IN ("availment_form", "validation_form", "mungkahing_proyekto", "business_plan", "buhat_sa_pagpanumpa")
                  AND post_approval_tasks.status IN ("Submitted", "Needs Correction", "Rejected", "Verified")'
            );
        }

        return db()->prepare(
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
                post_approval_task_types.label,
                applicant_users.full_name AS applicant_name,
                applicant_users.email AS applicant_email,
                applicant_profiles.contact_number,
                applicant_profiles.business_name,
                barangays.name AS barangay_name,
                reviewer_users.full_name AS reviewer_name
             FROM post_approval_tasks
             INNER JOIN post_approval_task_types ON post_approval_task_types.id = post_approval_tasks.task_type_id
             INNER JOIN beneficiary_profiles ON beneficiary_profiles.id = post_approval_tasks.beneficiary_profile_id
             INNER JOIN applicant_profiles ON applicant_profiles.id = beneficiary_profiles.applicant_profile_id
             INNER JOIN users AS applicant_users ON applicant_users.id = applicant_profiles.user_id
             LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
             LEFT JOIN users AS reviewer_users ON reviewer_users.id = post_approval_tasks.reviewed_by_user_id'
             . $scopeJoin .
            ' WHERE post_approval_task_types.code IN ("availment_form", "validation_form", "mungkahing_proyekto", "business_plan", "buhat_sa_pagpanumpa")
              AND post_approval_tasks.status IN ("Submitted", "Needs Correction", "Rejected", "Verified")
             ORDER BY FIELD(post_approval_tasks.status, "Submitted", "Needs Correction", "Rejected", "Verified", "In Progress", "Unlocked"), post_approval_tasks.updated_at DESC, post_approval_tasks.id DESC'
        );
    }

    private function scopedParams(array $reviewer): array
    {
        if ($reviewer['role'] === ROLE_ADMIN) {
            return [];
        }

        return ['staff_profile_id' => (int) $reviewer['staffProfileId']];
    }

    private function findScopedTask(array $reviewer, int $taskId): ?array
    {
        $sql = 'SELECT
                    post_approval_tasks.id,
                    post_approval_tasks.status,
                    post_approval_tasks.due_date,
                    post_approval_tasks.form_payload,
                    post_approval_tasks.applicant_started_at,
                    post_approval_tasks.applicant_submitted_at,
                    post_approval_tasks.reviewed_at,
                    post_approval_tasks.reviewer_remarks,
                    post_approval_tasks.beneficiary_profile_id,
                    post_approval_task_types.code,
                    post_approval_task_types.label,
                    applicant_users.id AS applicant_user_id,
                    applicant_users.full_name AS applicant_name,
                    applicant_users.email AS applicant_email,
                    applicant_profiles.id AS applicant_profile_id,
                    applicant_profiles.contact_number,
                    applicant_profiles.address_line,
                    applicant_profiles.age,
                    applicant_profiles.business_name,
                    barangays.name AS barangay_name,
                    reviewer_users.full_name AS reviewer_name
                FROM post_approval_tasks
                INNER JOIN post_approval_task_types ON post_approval_task_types.id = post_approval_tasks.task_type_id
                INNER JOIN beneficiary_profiles ON beneficiary_profiles.id = post_approval_tasks.beneficiary_profile_id
                INNER JOIN applicant_profiles ON applicant_profiles.id = beneficiary_profiles.applicant_profile_id
                INNER JOIN users AS applicant_users ON applicant_users.id = applicant_profiles.user_id
                LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
                LEFT JOIN users AS reviewer_users ON reviewer_users.id = post_approval_tasks.reviewed_by_user_id';

        $params = ['task_id' => $taskId];
        if ($reviewer['role'] !== ROLE_ADMIN) {
            $sql .= '
                INNER JOIN staff_barangay_assignments ON staff_barangay_assignments.barangay_id = applicant_profiles.barangay_id
                    AND staff_barangay_assignments.staff_profile_id = :staff_profile_id
                    AND staff_barangay_assignments.ended_at IS NULL';
            $params['staff_profile_id'] = (int) $reviewer['staffProfileId'];
        }

        $sql .= '
            WHERE post_approval_tasks.id = :task_id
              AND post_approval_task_types.code IN ("availment_form", "validation_form", "mungkahing_proyekto", "business_plan", "buhat_sa_pagpanumpa")
              AND post_approval_tasks.status IN ("Submitted", "Needs Correction", "Rejected", "Verified")
            LIMIT 1';

        $statement = db()->prepare($sql);
        $statement->execute($params);
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    private function mapTask(array $row, bool $withSubmissions): array
    {
        $payload = json_decode((string) ($row['form_payload'] ?? ''), true);
        if (!is_array($payload)) {
            $payload = [];
        }

        $task = [
            'id' => (int) $row['id'],
            'code' => $row['code'],
            'title' => $row['label'],
            'status' => $row['status'],
            'submittedAt' => $row['applicant_submitted_at'],
            'startedAt' => $row['applicant_started_at'],
            'reviewedAt' => $row['reviewed_at'],
            'reviewerRemarks' => $row['reviewer_remarks'],
            'reviewerName' => $row['reviewer_name'],
            'applicant' => [
                'userId' => isset($row['applicant_user_id']) ? (int) $row['applicant_user_id'] : null,
                'name' => $row['applicant_name'] ?? '',
                'email' => $row['applicant_email'] ?? '',
                'barangay' => $row['barangay_name'] ?? '',
                'contactNumber' => $row['contact_number'] ?? '',
                'businessName' => $row['business_name'] ?? '',
                'address' => $row['address_line'] ?? '',
                'age' => $row['age'] ?? null,
            ],
            'payload' => $payload,
        ];

        if ($withSubmissions) {
            $task['submissions'] = $this->fetchSubmissions((int) $row['id']);
        }

        return $task;
    }

    private function fetchSubmissions(int $taskId): array
    {
        $statement = db()->prepare(
            'SELECT
                post_approval_submissions.id,
                post_approval_submissions.review_status,
                post_approval_submissions.reviewer_remarks,
                post_approval_submissions.submitted_at,
                post_approval_submissions.reviewed_at,
                users.full_name AS submitted_by_name,
                reviewer_users.full_name AS reviewed_by_name
             FROM post_approval_submissions
             LEFT JOIN users ON users.id = post_approval_submissions.submitted_by_user_id
             LEFT JOIN users AS reviewer_users ON reviewer_users.id = post_approval_submissions.reviewed_by_user_id
             WHERE post_approval_submissions.post_approval_task_id = :task_id
             ORDER BY post_approval_submissions.id DESC'
        );
        $statement->execute(['task_id' => $taskId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'reviewStatus' => $row['review_status'],
                'reviewerRemarks' => $row['reviewer_remarks'],
                'submittedAt' => $row['submitted_at'],
                'reviewedAt' => $row['reviewed_at'],
                'submittedByName' => $row['submitted_by_name'],
                'reviewedByName' => $row['reviewed_by_name'],
            ];
        }, $rows);
    }

    private function validateStaffPayload(string $code, array $payload): array
    {
        if ($code === POST_APPROVAL_TASK_AVAILMENT_FORM) {
            $clean = [
                'pageOneCertification' => [
                    'eligibilityStatementName' => trim((string) ($payload['pageOneCertification']['eligibilityStatementName'] ?? '')),
                    'directWorkerName' => trim((string) ($payload['pageOneCertification']['directWorkerName'] ?? '')),
                    'directWorkerTitle' => trim((string) ($payload['pageOneCertification']['directWorkerTitle'] ?? '')),
                    'signedDate' => trim((string) ($payload['pageOneCertification']['signedDate'] ?? '')),
                    'signatureUpload' => $this->normalizeUploadMetadata($payload['pageOneCertification']['signatureUpload'] ?? null),
                ],
                'physicalRequirements' => [
                    'healthAgeRows' => [],
                    'foodRelatedCertification' => [
                        'applicantName' => trim((string) ($payload['physicalRequirements']['foodRelatedCertification']['applicantName'] ?? '')),
                        'requiresMedicalClearance' => trim((string) ($payload['physicalRequirements']['foodRelatedCertification']['requiresMedicalClearance'] ?? '')),
                        'medicalCheckupCompleted' => trim((string) ($payload['physicalRequirements']['foodRelatedCertification']['medicalCheckupCompleted'] ?? '')),
                        'medicallyFit' => trim((string) ($payload['physicalRequirements']['foodRelatedCertification']['medicallyFit'] ?? '')),
                        'certifyingOfficerName' => trim((string) ($payload['physicalRequirements']['foodRelatedCertification']['certifyingOfficerName'] ?? '')),
                        'certifyingOfficerTitle' => trim((string) ($payload['physicalRequirements']['foodRelatedCertification']['certifyingOfficerTitle'] ?? '')),
                        'signedDate' => trim((string) ($payload['physicalRequirements']['foodRelatedCertification']['signedDate'] ?? '')),
                        'signatureUpload' => $this->normalizeUploadMetadata($payload['physicalRequirements']['foodRelatedCertification']['signatureUpload'] ?? null),
                    ],
                ],
                'psychoSocialRequirements' => [
                    'residencyAndCharacter' => [
                        'residentName' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['residentName'] ?? '')),
                        'barangay' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['barangay'] ?? '')),
                        'isBonaFideResident' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['isBonaFideResident'] ?? '')),
                        'goodMoralCharacter' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['goodMoralCharacter'] ?? '')),
                        'hasNoAdverseReputation' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['hasNoAdverseReputation'] ?? '')),
                        'certifyingOfficerName' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['certifyingOfficerName'] ?? '')),
                        'certifyingOfficerTitle' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['certifyingOfficerTitle'] ?? '')),
                        'signedDate' => trim((string) ($payload['psychoSocialRequirements']['residencyAndCharacter']['signedDate'] ?? '')),
                        'signatureUpload' => $this->normalizeUploadMetadata($payload['psychoSocialRequirements']['residencyAndCharacter']['signatureUpload'] ?? null),
                    ],
                    'familyRelationshipsWorkHabitsAspiration' => [
                        'applicantName' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['applicantName'] ?? '')),
                        'positiveRelationships' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['positiveRelationships'] ?? '')),
                        'goodWorkHabitsAndAttitude' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['goodWorkHabitsAndAttitude'] ?? '')),
                        'adequateEconomicAspiration' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['adequateEconomicAspiration'] ?? '')),
                        'findingText' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['findingText'] ?? '')),
                        'directWorkerName' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['directWorkerName'] ?? '')),
                        'directWorkerTitle' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['directWorkerTitle'] ?? '')),
                        'signedDate' => trim((string) ($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['signedDate'] ?? '')),
                        'signatureUpload' => $this->normalizeUploadMetadata($payload['psychoSocialRequirements']['familyRelationshipsWorkHabitsAspiration']['signatureUpload'] ?? null),
                    ],
                    'socialResponsibility' => [
                        'abidePolicies' => trim((string) ($payload['psychoSocialRequirements']['socialResponsibility']['abidePolicies'] ?? '')),
                        'payRollBackOnTime' => trim((string) ($payload['psychoSocialRequirements']['socialResponsibility']['payRollBackOnTime'] ?? '')),
                        'generateWeeklySavings' => trim((string) ($payload['psychoSocialRequirements']['socialResponsibility']['generateWeeklySavings'] ?? '')),
                        'acknowledgementText' => trim((string) ($payload['psychoSocialRequirements']['socialResponsibility']['acknowledgementText'] ?? '')),
                    ],
                ],
            ];

            foreach (($payload['physicalRequirements']['healthAgeRows'] ?? []) as $row) {
                if (!is_array($row)) {
                    continue;
                }
                $requirement = trim((string) ($row['requirement'] ?? ''));
                $age = trim((string) ($row['age'] ?? ''));
                $healthStatus = trim((string) ($row['healthStatus'] ?? ''));
                if ($requirement === '' && $age === '' && $healthStatus === '') {
                    continue;
                }
                $clean['physicalRequirements']['healthAgeRows'][] = [
                    'requirement' => $requirement,
                    'age' => $age,
                    'healthStatus' => $healthStatus,
                ];
            }

            return ['payload' => $clean, 'errors' => []];
        }

        if ($code === POST_APPROVAL_TASK_VALIDATION_FORM) {
            $decision = trim((string) ($payload['eligibilityAssessment']['eligibilityDecision'] ?? ''));
            $clean = [
                'validatorRecommendation' => trim((string) ($payload['validatorRecommendation'] ?? '')),
                'eligibilityAssessment' => [
                    'residentName' => trim((string) ($payload['eligibilityAssessment']['residentName'] ?? '')),
                    'age' => trim((string) ($payload['eligibilityAssessment']['age'] ?? '')),
                    'barangay' => trim((string) ($payload['eligibilityAssessment']['barangay'] ?? '')),
                    'understandsAssistanceProcess' => trim((string) ($payload['eligibilityAssessment']['understandsAssistanceProcess'] ?? '')),
                    'assistanceProcessUnderstanding' => trim((string) ($payload['eligibilityAssessment']['assistanceProcessUnderstanding'] ?? '')),
                    'eligibilityDecision' => $decision,
                ],
                'validatorIdentity' => [
                    'validatorName' => trim((string) ($payload['validatorIdentity']['validatorName'] ?? '')),
                    'validatorTitle' => trim((string) ($payload['validatorIdentity']['validatorTitle'] ?? '')),
                    'signedDate' => trim((string) ($payload['validatorIdentity']['signedDate'] ?? '')),
                    'signatureUpload' => $this->normalizeUploadMetadata($payload['validatorIdentity']['signatureUpload'] ?? null),
                ],
            ];

            $errors = [];
            if ($decision !== '' && !in_array($decision, ['ANGAYAN', 'DILI ANGAYAN'], true)) {
                $errors['eligibilityAssessment.eligibilityDecision'] = 'Select ANGAYAN or DILI ANGAYAN.';
            }

            return ['payload' => $clean, 'errors' => $errors];
        }

        if ($code === POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO) {
            $clean = [
                'recommendation' => [
                    'projectName' => trim((string) ($payload['recommendation']['projectName'] ?? '')),
                    'recommendedAmount' => trim((string) ($payload['recommendation']['recommendedAmount'] ?? '')),
                    'recommendationText' => trim((string) ($payload['recommendation']['recommendationText'] ?? '')),
                    'approverName' => trim((string) ($payload['recommendation']['approverName'] ?? '')),
                    'approverTitle' => trim((string) ($payload['recommendation']['approverTitle'] ?? '')),
                    'approvedDate' => trim((string) ($payload['recommendation']['approvedDate'] ?? '')),
                    'signatureUpload' => $this->normalizeUploadMetadata($payload['recommendation']['signatureUpload'] ?? null),
                ],
            ];

            return ['payload' => $clean, 'errors' => []];
        }

        if ($code === POST_APPROVAL_TASK_BUSINESS_PLAN) {
            $clean = [
                'approval' => [
                    'reviewSummary' => trim((string) ($payload['approval']['reviewSummary'] ?? '')),
                    'recommendedAction' => trim((string) ($payload['approval']['recommendedAction'] ?? '')),
                    'approverName' => trim((string) ($payload['approval']['approverName'] ?? '')),
                    'approverTitle' => trim((string) ($payload['approval']['approverTitle'] ?? '')),
                    'approvedDate' => trim((string) ($payload['approval']['approvedDate'] ?? '')),
                    'signatureUpload' => $this->normalizeUploadMetadata($payload['approval']['signatureUpload'] ?? null),
                ],
            ];

            return ['payload' => $clean, 'errors' => []];
        }

        if ($code === POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA) {
            $clean = [
                'verification' => [
                    'reviewerName' => trim((string) ($payload['verification']['reviewerName'] ?? '')),
                    'reviewerTitle' => trim((string) ($payload['verification']['reviewerTitle'] ?? '')),
                    'reviewerDate' => trim((string) ($payload['verification']['reviewerDate'] ?? '')),
                    'remarks' => trim((string) ($payload['verification']['remarks'] ?? '')),
                    'signatureUpload' => $this->normalizeUploadMetadata($payload['verification']['signatureUpload'] ?? null),
                ],
            ];

            return ['payload' => $clean, 'errors' => []];
        }

        return ['payload' => [], 'errors' => []];
    }

    private function mergeStaffPayload(array $task, array $staffPayload): array
    {
        $existing = json_decode((string) ($task['form_payload'] ?? ''), true);
        if (!is_array($existing)) {
            $existing = [];
        }

        $existing['staffReview'] = array_replace_recursive($existing['staffReview'] ?? [], $staffPayload);
        return $existing;
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

    private function allowedReviewerUploadFields(): array
    {
        return [
            POST_APPROVAL_TASK_AVAILMENT_FORM => [
                'pageOneCertification.signatureUpload' => 'staff-signature',
                'physicalRequirements.foodRelatedCertification.signatureUpload' => 'staff-signature',
                'psychoSocialRequirements.residencyAndCharacter.signatureUpload' => 'staff-signature',
                'psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.signatureUpload' => 'staff-signature',
            ],
            POST_APPROVAL_TASK_VALIDATION_FORM => [
                'validatorIdentity.signatureUpload' => 'staff-signature',
            ],
            POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO => [
                'recommendation.signatureUpload' => 'staff-signature',
            ],
            POST_APPROVAL_TASK_BUSINESS_PLAN => [
                'approval.signatureUpload' => 'staff-signature',
            ],
            POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA => [
                'verification.signatureUpload' => 'staff-signature',
            ],
        ];
    }

    private function normalizeDecision(string $value): ?string
    {
        $value = trim($value);
        return in_array($value, [POST_APPROVAL_STATUS_VERIFIED, POST_APPROVAL_STATUS_REJECTED, POST_APPROVAL_STATUS_NEEDS_CORRECTION], true)
            ? $value
            : null;
    }

    private function notifyApplicant(array $task, string $status, string $remarks): void
    {
        $title = match ($status) {
            POST_APPROVAL_STATUS_VERIFIED => $task['label'] . ' verified',
            POST_APPROVAL_STATUS_REJECTED => $task['label'] . ' rejected',
            POST_APPROVAL_STATUS_NEEDS_CORRECTION => $task['label'] . ' needs correction',
            default => $task['label'] . ' reviewed',
        };

        $message = match ($status) {
            POST_APPROVAL_STATUS_VERIFIED => 'Your submitted form was reviewed and verified by CSWDD staff.',
            POST_APPROVAL_STATUS_REJECTED => 'Your submitted form was reviewed and rejected. Please read the reviewer remarks.',
            POST_APPROVAL_STATUS_NEEDS_CORRECTION => 'Your submitted form needs correction. Review the staff remarks and resubmit.',
            default => 'Your submitted form was reviewed by CSWDD staff.',
        };

        if ($remarks !== '') {
            $message .= ' Remarks: ' . $remarks;
        }

        (new NotificationService())->createInApp((int) $task['applicant_user_id'], $title, $message, 'post_approval_review');
    }
}

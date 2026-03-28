<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class ApplicationService
{
    private const REQUIREMENT_LABELS = [
        'validId' => 'Valid ID',
        'healthCertificate' => 'Health Certificate',
        'cedula' => 'Cedula',
    ];

    private const APPLICATION_FORM_DEFINITIONS = [
        POST_APPROVAL_TASK_AVAILMENT_FORM => 'Availment Form',
        POST_APPROVAL_TASK_VALIDATION_FORM => 'Validation Form',
        POST_APPROVAL_TASK_MUNGKAHING_PROYEKTO => 'Mungkahing Proyekto',
        POST_APPROVAL_TASK_BUSINESS_PLAN => 'Business Plan',
        POST_APPROVAL_TASK_BUHAT_SA_PAGPANUMPA => 'Buhat sa Pagpanumpa',
        POST_APPROVAL_TASK_FUND_RELEASE_EVIDENCE => 'Proof of Fund Release',
    ];

    private ?array $initialRequirementFileColumns = null;

    public function getApplicantEntryState(int $userId): array
    {
        $user = $this->fetchUser($userId);
        $profile = $this->fetchApplicantProfile($userId);
        $application = $profile ? $this->fetchLatestApplication((int) $profile['id']) : null;
        $requirements = $application ? $this->fetchRequirementFiles((int) $application['id']) : [];

        return [
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['full_name'],
                'email' => $user['email'],
                'role' => $user['role'],
            ],
            'profile' => $profile,
            'application' => $application,
            'requirements' => $requirements,
            'requirementDefinitions' => self::REQUIREMENT_LABELS,
        ];
    }

    public function saveApplicantProfile(int $userId, array $input, array $documentBag, bool $submit): array
    {
        $errors = $this->validateProfileInput($input, $submit);
        $uploadService = new UploadService();
        $documents = $uploadService->normalizeDocumentFiles($documentBag);
        $existingProfile = $this->fetchApplicantProfile($userId);
        $existingApplication = $existingProfile ? $this->fetchLatestApplication((int) $existingProfile['id']) : null;
        $existingRequirements = $existingApplication ? $this->fetchRequirementFiles((int) $existingApplication['id']) : [];

        if ($submit) {
            $errors = array_merge($errors, $this->validateRequirementSubmission($documents, $existingRequirements));
        }

        if ($errors !== []) {
            return ['ok' => false, 'errors' => $errors];
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $barangayId = $this->resolveBarangayId((string) $input['barangay']);
            $profileId = $this->upsertApplicantProfile($userId, $barangayId, $input, $submit);
            $applicationId = $this->upsertApplication($profileId, $barangayId, $submit);

            $this->ensureRequirementTypes();
            foreach ($documents as $key => $file) {
                $meta = $uploadService->storeRequirementDocument($key, $file);
                $this->replaceRequirementFile($applicationId, $key, $meta);
            }

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            log_database_query_failure('application.save_applicant_profile', $exception, ['user_id' => $userId]);

            return [
                'ok' => false,
                'errors' => ['general' => $exception->getMessage()],
            ];
        }

        return [
            'ok' => true,
            'message' => $submit ? 'Profile submitted for verification.' : 'Draft saved.',
            'data' => $this->getApplicantEntryState($userId),
        ];
    }

    public function listApplications(array $filters, array $actor): array
    {
        $actorRole = strtolower((string) ($actor['role'] ?? ''));
        $isProjectOfficer = str_contains($actorRole, 'project');
        $params = [];
        $joins = [
            'INNER JOIN applicant_profiles ON applicant_profiles.id = applications.applicant_profile_id',
            'INNER JOIN users AS applicant_users ON applicant_users.id = applicant_profiles.user_id',
            'LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id',
            'LEFT JOIN staff_profiles AS assigned_staff ON assigned_staff.id = applications.assigned_staff_profile_id',
            'LEFT JOIN users AS assigned_users ON assigned_users.id = assigned_staff.user_id',
        ];
        $conditions = ['1 = 1'];

        if ($isProjectOfficer) {
            $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
            if ($staffProfileId === null) {
                return [
                    'applications' => [],
                    'summary' => $this->emptyApplicationSummary(),
                    'barangays' => [],
                    'assignedPdos' => [],
                    'scopeBarangays' => [],
                ];
            }

            $joins[] = 'INNER JOIN staff_barangay_assignments AS scope_assignments
                        ON scope_assignments.barangay_id = applicant_profiles.barangay_id
                       AND scope_assignments.staff_profile_id = :scope_staff_profile_id
                       AND scope_assignments.ended_at IS NULL';
            $params['scope_staff_profile_id'] = $staffProfileId;
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '') {
            $conditions[] = 'LOWER(REPLACE(applications.status, "_", " ")) = :status';
            $params['status'] = strtolower($status);
        }

        $barangayId = (int) ($filters['barangayId'] ?? 0);
        if ($barangayId > 0) {
            $conditions[] = 'barangays.id = :barangay_id';
            $params['barangay_id'] = $barangayId;
        }

        $assignedPdoId = (int) ($filters['assignedPdoId'] ?? 0);
        if ($assignedPdoId > 0) {
            $conditions[] = 'assigned_staff.id = :assigned_staff_profile_id';
            $params['assigned_staff_profile_id'] = $assignedPdoId;
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $conditions[] = '(applicant_users.full_name LIKE :search OR applicant_users.email LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }

        $sql = '
            SELECT
                applications.id,
                applications.status,
                applications.submitted_at,
                applications.reviewed_at,
                applications.assigned_staff_profile_id,
                applications.updated_at,
                applicant_users.full_name AS applicant_name,
                applicant_users.email AS applicant_email,
                applicant_profiles.business_name,
                applicant_profiles.contact_number,
                applicant_profiles.household_size,
                applicant_profiles.sector,
                applicant_profiles.livelihood_type,
                applicant_profiles.address_line,
                applicant_profiles.birthdate,
                applicant_profiles.age,
                applicant_profiles.gender,
                applicant_profiles.is_4ps,
                barangays.id AS barangay_id,
                barangays.name AS barangay_name,
                assigned_users.full_name AS assigned_pdo_name,
                (
                    SELECT COUNT(*)
                    FROM initial_requirement_files AS files
                    WHERE files.application_id = applications.id
                ) AS uploaded_requirement_count,
                (
                    SELECT COUNT(*)
                    FROM initial_requirement_files AS files
                    WHERE files.application_id = applications.id
                      AND LOWER(files.review_status) = "verified"
                ) AS verified_requirement_count,
                (
                    SELECT COUNT(*)
                    FROM initial_requirement_types AS requirement_types
                    WHERE requirement_types.is_required = 1
                ) AS total_required_documents
            FROM applications
            ' . implode("\n", $joins) . '
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY applications.updated_at DESC, applications.id DESC
        ';

        $statement = db()->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue(':' . $key, $value);
        }
        $statement->execute();
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $applications = array_map(fn (array $row): array => $this->mapApplicationRow($row), $rows);

        return [
            'applications' => $applications,
            'summary' => $this->buildApplicationSummary($applications),
            'barangays' => $this->availableBarangays($actor),
            'assignedPdos' => $isProjectOfficer ? [] : $this->availableAssignedPdos(),
            'scopeBarangays' => $isProjectOfficer ? $this->assignedBarangaysForUser((int) $actor['id']) : [],
        ];
    }

    public function getApplicationDetail(int $applicationId, array $actor): ?array
    {
        $row = $this->findApplicationRow($applicationId, $actor);
        if ($row === null) {
            return null;
        }

        $detail = $this->mapApplicationRow($row);
        $detail['requirements'] = array_values($this->fetchRequirementFiles($applicationId));
        $detail['formRequirements'] = $this->fetchFormRequirementsForApplication($applicationId, $actor);
        $detail['comments'] = $this->fetchApplicationComments($applicationId);
        $detail['history'] = $this->fetchApplicationHistory($applicationId);
        $detail['assessment'] = $this->fetchLatestAssessment($applicationId);
        $detail['trainingReadiness'] = $this->fetchTrainingReadiness($this->findApplicantProfileIdForApplication($applicationId));
        $detail['approvalReadiness'] = $this->buildApprovalReadiness(
            $detail['requirements'],
            $detail['formRequirements'],
            $detail['trainingReadiness']
        );
        $detail['computedStatus'] = $detail['approvalReadiness']['overallStatus'] ?? $detail['status'];

        return $detail;
    }

    public function reviewRequirement(int $applicationId, array $payload, array $actor): array
    {
        $application = $this->findApplicationRow($applicationId, $actor);
        if ($application === null) {
            return ['ok' => false, 'errors' => ['applicationId' => 'Application not found or not accessible.']];
        }

        $requirementKey = trim((string) ($payload['requirementKey'] ?? ''));
        $decision = trim((string) ($payload['decision'] ?? ''));
        $remarks = trim((string) ($payload['staffRemarks'] ?? $payload['remarks'] ?? ''));
        $applicantRemark = trim((string) ($payload['applicantRemark'] ?? ''));
        $normalizedStatus = match (strtolower($decision)) {
            'approve', 'approved', 'verified' => 'verified',
            'reject', 'rejected' => 'rejected',
            default => null,
        };

        if ($requirementKey === '' || !array_key_exists($requirementKey, self::REQUIREMENT_LABELS)) {
            return ['ok' => false, 'errors' => ['requirementKey' => 'Requirement not found.']];
        }
        if ($normalizedStatus === null) {
            return ['ok' => false, 'errors' => ['decision' => 'Select Approved or Rejected.']];
        }
        if ($normalizedStatus === 'rejected' && $applicantRemark === '') {
            return ['ok' => false, 'errors' => ['applicantRemark' => 'Applicant-visible remark is required when rejecting a requirement.']];
        }

        $typeCode = $this->frontendKeyToCode($requirementKey);
        $statement = db()->prepare(
            'SELECT initial_requirement_files.id
             FROM initial_requirement_files
             INNER JOIN initial_requirement_types ON initial_requirement_types.id = initial_requirement_files.requirement_type_id
             WHERE initial_requirement_files.application_id = :application_id
               AND initial_requirement_types.code = :code
             LIMIT 1'
        );
        $statement->execute([
            'application_id' => $applicationId,
            'code' => $typeCode,
        ]);
        $fileId = $statement->fetchColumn();
        if ($fileId === false) {
            return ['ok' => false, 'errors' => ['requirementKey' => 'This requirement has not been submitted yet.']];
        }

        try {
            $supportsReviewColumns = $this->hasInitialRequirementReviewColumns();
            $sql = 'UPDATE initial_requirement_files
                    SET review_status = :review_status, updated_at = NOW()';
            $params = [
                'review_status' => $normalizedStatus,
                'id' => (int) $fileId,
            ];

            if ($supportsReviewColumns) {
                $sql .= ',
                    reviewer_remarks = :reviewer_remarks,
                    reviewed_by_user_id = :reviewed_by_user_id,
                    reviewed_at = NOW()';
                $params['reviewer_remarks'] = $remarks !== '' ? $remarks : null;
                $params['reviewed_by_user_id'] = (int) $actor['id'];
            }

            $sql .= ' WHERE id = :id';
            db()->prepare($sql)->execute($params);
        } catch (\Throwable $exception) {
            log_database_query_failure('application.review_requirement', $exception, [
                'application_id' => $applicationId,
                'requirement_key' => $requirementKey,
                'actor_user_id' => (int) ($actor['id'] ?? 0),
            ]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to save this requirement review right now.']];
        }

        if ($applicantRemark !== '') {
            $this->createApplicationComment(
                $applicationId,
                (int) $actor['id'],
                self::REQUIREMENT_LABELS[$requirementKey] . ' (' . ucfirst($normalizedStatus) . '): ' . $applicantRemark,
                'applicant'
            );
        }

        return ['ok' => true, 'application' => $this->getApplicationDetail($applicationId, $actor)];
    }

    public function reviewApplication(int $applicationId, array $payload, array $actor): array
    {
        $application = $this->findApplicationRow($applicationId, $actor);
        if ($application === null) {
            return ['ok' => false, 'errors' => ['applicationId' => 'Application not found or not accessible.']];
        }

        $decision = trim((string) ($payload['decision'] ?? ''));
        $remarks = trim((string) ($payload['remarks'] ?? ''));
        $actorRole = strtolower((string) ($actor['role'] ?? ''));
        $nextStatus = $this->resolveNextStatus($decision, $actorRole);
        $detail = $this->getApplicationDetail($applicationId, $actor);

        if ($nextStatus === null) {
            return ['ok' => false, 'errors' => ['decision' => 'Invalid application decision.']];
        }
        if ($decision === 'approve' && is_array($detail) && !($detail['approvalReadiness']['canApprove'] ?? false)) {
            return ['ok' => false, 'errors' => ['decision' => 'This applicant is not yet ready for approval.']];
        }
        if ($nextStatus === APPLICATION_STATUS_APPROVED_FOR_TRAINING) {
            $assessment = $detail['assessment'] ?? null;
            if (!is_array($assessment) || strtolower((string) ($assessment['recommendation'] ?? '')) !== 'approved') {
                return ['ok' => false, 'errors' => ['decision' => 'A completed approved assessment is required before training approval.']];
            }
        }

        if (in_array($nextStatus, [APPLICATION_STATUS_REJECTED, APPLICATION_STATUS_FLAGGED, APPLICATION_STATUS_NEEDS_CORRECTION], true)
            && $remarks === '') {
            return ['ok' => false, 'errors' => ['remarks' => 'Remarks are required for this decision.']];
        }

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $statusService = new ApplicationStatusService();
            $statusService->transition($applicationId, $nextStatus, (int) $actor['id'], $remarks !== '' ? $remarks : null, $remarks !== '');

            if (str_contains($actorRole, 'project')) {
                $staffProfileId = $this->findStaffProfileIdForUser((int) $actor['id']);
                if ($staffProfileId !== null) {
                    $pdo->prepare(
                        'UPDATE applications SET assigned_staff_profile_id = :assigned_staff_profile_id WHERE id = :id'
                    )->execute([
                        'assigned_staff_profile_id' => $staffProfileId,
                        'id' => $applicationId,
                    ]);
                }
            }

            if (in_array($nextStatus, [APPLICATION_STATUS_APPROVED, APPLICATION_STATUS_APPROVED_FOR_TRAINING], true)) {
                (new BeneficiaryProfileService())->ensureForApplicantProfile($this->findApplicantProfileIdForApplication($applicationId));
            }

            (new AuditLogService())->record(
                (int) $actor['id'],
                'application.reviewed',
                'applications',
                $applicationId,
                ['decision' => $decision, 'status' => $nextStatus]
            );
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            log_database_query_failure('application.review', $exception, [
                'application_id' => $applicationId,
                'actor_user_id' => (int) ($actor['id'] ?? 0),
                'decision' => $decision,
            ]);

            return ['ok' => false, 'errors' => ['general' => 'Unable to update application status right now.']];
        }

        return ['ok' => true, 'application' => $this->getApplicationDetail($applicationId, $actor)];
    }

    public function saveAssessment(int $applicationId, array $payload, array $actor): array
    {
        $application = $this->findApplicationRow($applicationId, $actor);
        if ($application === null) {
            return ['ok' => false, 'errors' => ['applicationId' => 'Application not found or not accessible.']];
        }

        $role = strtolower((string) ($actor['role'] ?? ''));
        if (!str_contains($role, 'social') && !str_contains($role, 'admin') && !str_contains($role, 'project')) {
            return ['ok' => false, 'errors' => ['general' => 'You are not allowed to submit eligibility assessments.']];
        }

        $recommendation = strtolower(trim((string) ($payload['recommendation'] ?? '')));
        $allowedRecommendations = ['approved', 'needs_correction', 'rejected'];
        if (!in_array($recommendation, $allowedRecommendations, true)) {
            return ['ok' => false, 'errors' => ['recommendation' => 'Select a valid assessment recommendation.']];
        }

        $criteria = [
            'identityResidency' => trim((string) ($payload['identityResidency'] ?? '')),
            'documentValidity' => trim((string) ($payload['documentValidity'] ?? '')),
            'livelihoodConfirmation' => trim((string) ($payload['livelihoodConfirmation'] ?? '')),
            'programFit' => trim((string) ($payload['programFit'] ?? '')),
            'readinessCommitment' => trim((string) ($payload['readinessCommitment'] ?? '')),
        ];
        foreach ($criteria as $field => $value) {
            if (!in_array(strtolower($value), ['pass', 'needs clarification', 'fail'], true)) {
                return ['ok' => false, 'errors' => [$field => 'Assessment criteria must be marked as Pass, Needs Clarification, or Fail.']];
            }
        }

        $remarks = trim((string) ($payload['remarks'] ?? ''));
        if ($remarks === '') {
            return ['ok' => false, 'errors' => ['remarks' => 'Assessment remarks are required.']];
        }

        $this->ensureAssessmentTable();
        $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
        $directWorkerUserId = (int) ($payload['directWorkerUserId'] ?? ($actor['id'] ?? 0));
        $certifyingOfficerUserId = (int) ($payload['certifyingOfficerUserId'] ?? ($actor['id'] ?? 0));
        $directWorkerName = trim((string) ($payload['directWorkerName'] ?? $this->resolveUserName($directWorkerUserId)));
        $certifyingOfficerName = trim((string) ($payload['certifyingOfficerName'] ?? $this->resolveUserName($certifyingOfficerUserId)));
        $nextStatus = match ($recommendation) {
            'approved' => APPLICATION_STATUS_APPROVED_FOR_TRAINING,
            'needs_correction' => APPLICATION_STATUS_NEEDS_CORRECTION,
            'rejected' => APPLICATION_STATUS_REJECTED,
        };

        $pdo = db();
        $pdo->beginTransaction();
        try {
            $pdo->prepare(
                'INSERT INTO application_assessments (
                    application_id,
                    assessor_user_id,
                    assessor_staff_profile_id,
                    identity_residency_status,
                    document_validity_status,
                    livelihood_confirmation_status,
                    program_fit_status,
                    readiness_commitment_status,
                    recommendation,
                    remarks,
                    direct_worker_user_id,
                    direct_worker_name,
                    certifying_officer_user_id,
                    certifying_officer_name
                ) VALUES (
                    :application_id,
                    :assessor_user_id,
                    :assessor_staff_profile_id,
                    :identity_residency_status,
                    :document_validity_status,
                    :livelihood_confirmation_status,
                    :program_fit_status,
                    :readiness_commitment_status,
                    :recommendation,
                    :remarks,
                    :direct_worker_user_id,
                    :direct_worker_name,
                    :certifying_officer_user_id,
                    :certifying_officer_name
                )'
            )->execute([
                'application_id' => $applicationId,
                'assessor_user_id' => (int) $actor['id'],
                'assessor_staff_profile_id' => $staffProfileId,
                'identity_residency_status' => $criteria['identityResidency'],
                'document_validity_status' => $criteria['documentValidity'],
                'livelihood_confirmation_status' => $criteria['livelihoodConfirmation'],
                'program_fit_status' => $criteria['programFit'],
                'readiness_commitment_status' => $criteria['readinessCommitment'],
                'recommendation' => $recommendation,
                'remarks' => $remarks,
                'direct_worker_user_id' => $directWorkerUserId > 0 ? $directWorkerUserId : null,
                'direct_worker_name' => $directWorkerName !== '' ? $directWorkerName : null,
                'certifying_officer_user_id' => $certifyingOfficerUserId > 0 ? $certifyingOfficerUserId : null,
                'certifying_officer_name' => $certifyingOfficerName !== '' ? $certifyingOfficerName : null,
            ]);

            (new ApplicationStatusService())->transition($applicationId, $nextStatus, (int) $actor['id'], $remarks, true);
            if ($nextStatus === APPLICATION_STATUS_APPROVED_FOR_TRAINING) {
                (new BeneficiaryProfileService())->ensureForApplicantProfile($this->findApplicantProfileIdForApplication($applicationId));
            }

            (new AuditLogService())->record(
                (int) $actor['id'],
                'application.assessed',
                'application_assessments',
                (int) $pdo->lastInsertId(),
                ['application_id' => $applicationId, 'recommendation' => $recommendation]
            );

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            log_database_query_failure('application.save_assessment', $exception, [
                'application_id' => $applicationId,
                'assessor_user_id' => (int) ($actor['id'] ?? 0),
            ]);

            return ['ok' => false, 'errors' => ['general' => 'Unable to save the assessment right now.']];
        }

        return ['ok' => true, 'application' => $this->getApplicationDetail($applicationId, $actor)];
    }

    public function currentProjectOfficerRoster(array $actor): array
    {
        $data = $this->listApplications([], $actor);

        $roster = array_map(static function (array $application): array {
            return [
                'id' => $application['id'],
                'name' => $application['applicantName'],
                'barangay' => $application['barangay'],
                'status' => $application['status'],
                'businessName' => $application['businessName'],
            ];
        }, $data['applications']);

        return [
            'summary' => [
                'applications' => count($data['applications']),
                'pending' => $data['summary']['pending'],
            ],
            'roster' => $roster,
            'applications' => $data['applications'],
            'scopeBarangays' => $data['scopeBarangays'],
        ];
    }

    private function validateProfileInput(array $input, bool $submit): array
    {
        $required = ['birthdate', 'gender', 'contactNumber', 'address', 'barangay', 'is4ps', 'householdSize', 'sector', 'livelihood', 'businessName'];
        $errors = [];

        foreach ($required as $field) {
            if ($submit && trim((string) ($input[$field] ?? '')) === '') {
                $errors[$field] = 'This field is required.';
            }
        }

        if (!empty($input['birthdate'])) {
            $birthdate = strtotime((string) $input['birthdate']);
            if ($birthdate === false) {
                $errors['birthdate'] = 'Birthdate is invalid.';
            }
        }

        $contactNumber = preg_replace('/\D+/', '', (string) ($input['contactNumber'] ?? ''));
        if ($submit && ($contactNumber === '' || strlen($contactNumber) < 10 || strlen($contactNumber) > 13)) {
            $errors['contactNumber'] = 'Enter a valid contact number.';
        }

        $householdSize = (int) ($input['householdSize'] ?? 0);
        if ($submit && $householdSize < 1) {
            $errors['householdSize'] = 'Household size must be at least 1.';
        }

        return $errors;
    }

    private function validateRequirementSubmission(array $documents, array $existingRequirements): array
    {
        $errors = [];

        foreach (array_keys(self::REQUIREMENT_LABELS) as $key) {
            $hasNewUpload = isset($documents[$key]);
            $hasExistingUpload = !empty($existingRequirements[$key]['file']['path']);

            if (!$hasNewUpload && !$hasExistingUpload) {
                $errors[$key] = self::REQUIREMENT_LABELS[$key] . ' is required.';
            }
        }

        return $errors;
    }

    private function fetchUser(int $userId): array
    {
        $statement = db()->prepare(
            'SELECT users.id, users.full_name, users.email, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $userId]);
        $user = $statement->fetch();
        if (!is_array($user)) {
            throw new \RuntimeException('User not found.');
        }

        return $user;
    }

    private function fetchApplicantProfile(int $userId): ?array
    {
        $statement = db()->prepare(
            'SELECT applicant_profiles.*, barangays.name AS barangay_name
             FROM applicant_profiles
             LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
             WHERE applicant_profiles.user_id = :user_id
             LIMIT 1'
        );
        $statement->execute(['user_id' => $userId]);
        $profile = $statement->fetch();
        if (!is_array($profile)) {
            return null;
        }

        return [
            'id' => (int) $profile['id'],
            'birthdate' => $profile['birthdate'],
            'age' => $profile['age'],
            'gender' => $profile['gender'],
            'contactNumber' => $profile['contact_number'],
            'address' => $profile['address_line'],
            'barangay' => $profile['barangay_name'],
            'is4ps' => ((int) $profile['is_4ps']) === 1 ? 'Yes' : 'No',
            'householdSize' => $profile['household_size'],
            'sector' => $profile['sector'],
            'livelihood' => $profile['livelihood_type'],
            'businessName' => $profile['business_name'],
            'status' => $profile['profile_status'],
        ];
    }

    private function fetchLatestApplication(int $profileId): ?array
    {
        $statement = db()->prepare(
            'SELECT * FROM applications WHERE applicant_profile_id = :profile_id ORDER BY id DESC LIMIT 1'
        );
        $statement->execute(['profile_id' => $profileId]);
        $application = $statement->fetch();
        if (!is_array($application)) {
            return null;
        }

        return [
            'id' => (int) $application['id'],
            'status' => $application['status'],
            'submittedAt' => $application['submitted_at'],
            'reviewedAt' => $application['reviewed_at'],
            'updatedAt' => $application['updated_at'],
        ];
    }

    private function fetchRequirementFiles(int $applicationId): array
    {
        $reviewerRemarksSelect = $this->hasInitialRequirementReviewColumns()
            ? 'initial_requirement_files.reviewer_remarks, initial_requirement_files.reviewed_at,'
            : 'NULL AS reviewer_remarks, NULL AS reviewed_at,';
        $statement = db()->prepare(
            'SELECT initial_requirement_types.code, initial_requirement_types.label, initial_requirement_types.is_required,
                    initial_requirement_files.file_path, initial_requirement_files.original_name, initial_requirement_files.mime_type,
                    initial_requirement_files.file_size, initial_requirement_files.review_status, '
                    . $reviewerRemarksSelect . '
                    initial_requirement_files.updated_at
             FROM initial_requirement_files
             INNER JOIN initial_requirement_types ON initial_requirement_types.id = initial_requirement_files.requirement_type_id
             WHERE initial_requirement_files.application_id = :application_id
             ORDER BY initial_requirement_types.label ASC'
        );
        $statement->execute(['application_id' => $applicationId]);
        $rows = $statement->fetchAll();

        $mapped = [];
        foreach ($rows as $row) {
            $key = $this->codeToFrontendKey((string) $row['code']);
            $mapped[$key] = [
                'key' => $key,
                'label' => $row['label'],
                'typeLabel' => 'Upload Requirement',
                'isRequired' => ((int) ($row['is_required'] ?? 1)) === 1,
                'status' => $row['review_status'],
                'reviewerRemarks' => $row['reviewer_remarks'] ?? null,
                'reviewedAt' => $row['reviewed_at'] ?? null,
                'file' => [
                    'name' => $row['original_name'],
                    'type' => $row['mime_type'],
                    'size' => (int) $row['file_size'],
                    'path' => $row['file_path'],
                    'url' => $this->publicUploadUrl((string) $row['file_path']),
                ],
                'updatedAt' => $row['updated_at'],
            ];
        }

        foreach (self::REQUIREMENT_LABELS as $frontendKey => $label) {
            if (!isset($mapped[$frontendKey])) {
                $mapped[$frontendKey] = [
                    'key' => $frontendKey,
                    'label' => $label,
                    'typeLabel' => 'Upload Requirement',
                    'isRequired' => true,
                    'status' => 'missing',
                    'reviewerRemarks' => null,
                    'reviewedAt' => null,
                    'file' => null,
                    'updatedAt' => null,
                ];
            }
        }

        return $mapped;
    }

    private function resolveBarangayId(string $barangayName): int
    {
        $statement = db()->prepare('SELECT id FROM barangays WHERE name = :name LIMIT 1');
        $statement->execute(['name' => $barangayName]);
        $barangayId = $statement->fetchColumn();
        if ($barangayId !== false) {
            return (int) $barangayId;
        }

        $insert = db()->prepare('INSERT INTO barangays (name) VALUES (:name)');
        $insert->execute(['name' => $barangayName]);
        return (int) db()->lastInsertId();
    }

    private function upsertApplicantProfile(int $userId, int $barangayId, array $input, bool $submit): int
    {
        $existing = $this->fetchApplicantProfile($userId);
        $profileStatus = $submit ? 'submitted' : 'draft';
        $age = trim((string) ($input['age'] ?? ''));
        $age = $age !== '' ? (int) $age : null;

        if ($existing !== null) {
            $statement = db()->prepare(
                'UPDATE applicant_profiles
                 SET barangay_id = :barangay_id, contact_number = :contact_number, business_name = :business_name,
                     address_line = :address_line, birthdate = :birthdate, age = :age, gender = :gender,
                     is_4ps = :is_4ps, household_size = :household_size, sector = :sector, livelihood_type = :livelihood_type,
                     profile_status = :profile_status, completion_submitted_at = :completion_submitted_at, updated_at = NOW()
                 WHERE user_id = :user_id'
            );
            $statement->execute([
                'barangay_id' => $barangayId,
                'contact_number' => $input['contactNumber'] ?: null,
                'business_name' => $input['businessName'],
                'address_line' => $input['address'],
                'birthdate' => $input['birthdate'] ?: null,
                'age' => $age,
                'gender' => $input['gender'] ?: null,
                'is_4ps' => strtolower((string) $input['is4ps']) === 'yes' ? 1 : 0,
                'household_size' => ($input['householdSize'] ?? '') !== '' ? (int) $input['householdSize'] : null,
                'sector' => $input['sector'] ?: null,
                'livelihood_type' => $input['livelihood'] ?: null,
                'profile_status' => $profileStatus,
                'completion_submitted_at' => $submit ? date('Y-m-d H:i:s') : null,
                'user_id' => $userId,
            ]);

            return (int) $existing['id'];
        }

        $statement = db()->prepare(
            'INSERT INTO applicant_profiles
             (user_id, barangay_id, contact_number, business_name, address_line, birthdate, age, gender, is_4ps, household_size, sector, livelihood_type, profile_status, completion_submitted_at)
             VALUES (:user_id, :barangay_id, :contact_number, :business_name, :address_line, :birthdate, :age, :gender, :is_4ps, :household_size, :sector, :livelihood_type, :profile_status, :completion_submitted_at)'
        );
        $statement->execute([
            'user_id' => $userId,
            'barangay_id' => $barangayId,
            'contact_number' => $input['contactNumber'] ?: null,
            'business_name' => $input['businessName'],
            'address_line' => $input['address'],
            'birthdate' => $input['birthdate'] ?: null,
            'age' => $age,
            'gender' => $input['gender'] ?: null,
            'is_4ps' => strtolower((string) $input['is4ps']) === 'yes' ? 1 : 0,
            'household_size' => ($input['householdSize'] ?? '') !== '' ? (int) $input['householdSize'] : null,
            'sector' => $input['sector'] ?: null,
            'livelihood_type' => $input['livelihood'] ?: null,
            'profile_status' => $profileStatus,
            'completion_submitted_at' => $submit ? date('Y-m-d H:i:s') : null,
        ]);

        return (int) db()->lastInsertId();
    }

    private function upsertApplication(int $profileId, int $barangayId, bool $submit): int
    {
        $current = $this->fetchLatestApplication($profileId);
        $status = $submit ? APPLICATION_STATUS_SUBMITTED : APPLICATION_STATUS_DRAFT;
        $assignedStaffProfileId = $this->resolveAssignedProjectOfficerProfileId($barangayId);

        if ($current !== null) {
            $statement = db()->prepare(
                'UPDATE applications
                 SET status = :status, submitted_at = :submitted_at, assigned_staff_profile_id = :assigned_staff_profile_id, updated_at = NOW()
                 WHERE id = :id'
            );
            $statement->execute([
                'status' => $status,
                'submitted_at' => $submit ? date('Y-m-d H:i:s') : null,
                'assigned_staff_profile_id' => $assignedStaffProfileId,
                'id' => $current['id'],
            ]);

            return (int) $current['id'];
        }

        $statement = db()->prepare(
            'INSERT INTO applications (applicant_profile_id, status, submitted_at, assigned_staff_profile_id)
             VALUES (:applicant_profile_id, :status, :submitted_at, :assigned_staff_profile_id)'
        );
        $statement->execute([
            'applicant_profile_id' => $profileId,
            'status' => $status,
            'submitted_at' => $submit ? date('Y-m-d H:i:s') : null,
            'assigned_staff_profile_id' => $assignedStaffProfileId,
        ]);

        return (int) db()->lastInsertId();
    }

    private function ensureRequirementTypes(): void
    {
        $types = [
            'valid_id' => 'Valid ID',
            'health_certificate' => 'Health Certificate',
            'cedula' => 'Cedula',
        ];

        $statement = db()->prepare(
            'INSERT INTO initial_requirement_types (code, label, is_required)
             VALUES (:code, :label, 1)
             ON DUPLICATE KEY UPDATE label = VALUES(label), is_required = VALUES(is_required)'
        );

        foreach ($types as $code => $label) {
            $statement->execute(['code' => $code, 'label' => $label]);
        }
    }

    private function replaceRequirementFile(int $applicationId, string $key, array $meta): void
    {
        $code = $this->frontendKeyToCode($key);
        $typeStatement = db()->prepare('SELECT id FROM initial_requirement_types WHERE code = :code LIMIT 1');
        $typeStatement->execute(['code' => $code]);
        $requirementTypeId = (int) $typeStatement->fetchColumn();

        $delete = db()->prepare(
            'DELETE FROM initial_requirement_files WHERE application_id = :application_id AND requirement_type_id = :requirement_type_id'
        );
        $delete->execute([
            'application_id' => $applicationId,
            'requirement_type_id' => $requirementTypeId,
        ]);

        $insert = db()->prepare(
            'INSERT INTO initial_requirement_files
             (application_id, requirement_type_id, file_path, original_name, mime_type, file_size, review_status)
             VALUES (:application_id, :requirement_type_id, :file_path, :original_name, :mime_type, :file_size, :review_status)'
        );
        $insert->execute([
            'application_id' => $applicationId,
            'requirement_type_id' => $requirementTypeId,
            'file_path' => $meta['file_path'],
            'original_name' => $meta['original_name'],
            'mime_type' => $meta['mime_type'],
            'file_size' => $meta['file_size'],
            'review_status' => 'pending',
        ]);
    }

    private function fetchFormRequirementsForApplication(int $applicationId, array $actor): array
    {
        $applicantProfileId = $this->findApplicantProfileIdForApplication($applicationId);
        if ($applicantProfileId <= 0) {
            return [];
        }

        $beneficiaryProfileId = $this->ensureApplicationFormTasks($applicantProfileId, (int) ($actor['id'] ?? 0));
        if ($beneficiaryProfileId === null) {
            return [];
        }

        $params = ['beneficiary_profile_id' => $beneficiaryProfileId];
        $scopeJoin = '';
        $role = strtolower((string) ($actor['role'] ?? ''));
        if (str_contains($role, 'project')) {
            $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
            if ($staffProfileId === null) {
                return [];
            }
            $scopeJoin = '
                INNER JOIN applicant_profiles ON applicant_profiles.id = beneficiary_profiles.applicant_profile_id
                INNER JOIN staff_barangay_assignments AS scope_assignments
                    ON scope_assignments.barangay_id = applicant_profiles.barangay_id
                   AND scope_assignments.staff_profile_id = :scope_staff_profile_id
                   AND scope_assignments.ended_at IS NULL';
            $params['scope_staff_profile_id'] = $staffProfileId;
        }

        $statement = db()->prepare(
            'SELECT
                post_approval_tasks.id,
                post_approval_tasks.status,
                post_approval_tasks.reviewer_remarks,
                post_approval_tasks.applicant_started_at,
                post_approval_tasks.applicant_submitted_at,
                post_approval_tasks.reviewed_at,
                post_approval_task_types.code,
                post_approval_task_types.label
             FROM post_approval_tasks
             INNER JOIN post_approval_task_types ON post_approval_task_types.id = post_approval_tasks.task_type_id
             INNER JOIN beneficiary_profiles ON beneficiary_profiles.id = post_approval_tasks.beneficiary_profile_id'
             . $scopeJoin .
            ' WHERE post_approval_tasks.beneficiary_profile_id = :beneficiary_profile_id
              AND post_approval_task_types.code IN ("availment_form", "validation_form", "mungkahing_proyekto", "business_plan", "buhat_sa_pagpanumpa", "fund_release_evidence")
             ORDER BY FIELD(post_approval_task_types.code, "availment_form", "validation_form", "mungkahing_proyekto", "business_plan", "buhat_sa_pagpanumpa", "fund_release_evidence"), post_approval_tasks.id ASC'
        );
        $statement->execute($params);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            $status = (string) ($row['status'] ?? POST_APPROVAL_STATUS_UNLOCKED);
            return [
                'id' => (int) $row['id'],
                'key' => (string) $row['code'],
                'label' => (string) $row['label'],
                'type' => 'form',
                'typeLabel' => 'Fill-up Form Requirement',
                'isRequired' => true,
                'gatesApproval' => (string) $row['code'] !== POST_APPROVAL_TASK_FUND_RELEASE_EVIDENCE,
                'status' => $status,
                'reviewerRemarks' => $row['reviewer_remarks'] ?? null,
                'submittedAt' => $row['applicant_submitted_at'] ?? null,
                'reviewedAt' => $row['reviewed_at'] ?? null,
                'canReview' => in_array($status, [POST_APPROVAL_STATUS_SUBMITTED, POST_APPROVAL_STATUS_NEEDS_CORRECTION, POST_APPROVAL_STATUS_REJECTED, POST_APPROVAL_STATUS_VERIFIED], true),
                'reviewUrl' => app_url('post-approval-review?task_id=' . (int) $row['id'] . '&embed=1'),
            ];
        }, $rows);
    }

    private function ensureApplicationFormTasks(int $applicantProfileId, int $actorUserId): ?int
    {
        $beneficiaryProfileId = (new BeneficiaryProfileService())->ensureForApplicantProfile($applicantProfileId);
        if ($beneficiaryProfileId === null) {
            return null;
        }

        $typeStatement = db()->prepare(
            'INSERT INTO post_approval_task_types (code, label, description)
             VALUES (:code, :label, :description)
             ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description)'
        );

        foreach (self::APPLICATION_FORM_DEFINITIONS as $code => $label) {
            $typeStatement->execute([
                'code' => $code,
                'label' => $label,
                'description' => 'Application-stage fill-up form requirement.',
            ]);
        }

        $fetchTypes = db()->query('SELECT id, code FROM post_approval_task_types');
        $typeMap = [];
        foreach (($fetchTypes->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
            $typeMap[(string) $row['code']] = (int) $row['id'];
        }

        $insertTask = db()->prepare(
            'INSERT INTO post_approval_tasks
             (beneficiary_profile_id, task_type_id, status, assigned_by_user_id)
             VALUES (:beneficiary_profile_id, :task_type_id, :status, :assigned_by_user_id)
             ON DUPLICATE KEY UPDATE updated_at = updated_at'
        );

        foreach (array_keys(self::APPLICATION_FORM_DEFINITIONS) as $code) {
            if (!isset($typeMap[$code])) {
                continue;
            }
            $insertTask->execute([
                'beneficiary_profile_id' => $beneficiaryProfileId,
                'task_type_id' => $typeMap[$code],
                'status' => $code === POST_APPROVAL_TASK_FUND_RELEASE_EVIDENCE
                    ? POST_APPROVAL_STATUS_LOCKED
                    : POST_APPROVAL_STATUS_UNLOCKED,
                'assigned_by_user_id' => $actorUserId > 0 ? $actorUserId : null,
            ]);
        }

        return $beneficiaryProfileId;
    }

    private function fetchTrainingReadiness(int $applicantProfileId): array
    {
        if ($applicantProfileId <= 0) {
            return ['status' => TRAINING_STATUS_NOT_SCHEDULED, 'completed' => false, 'note' => 'No training schedule found yet.'];
        }

        $statement = db()->prepare(
            'SELECT training_invitees.invite_status, attendance_records.attendance_status
             FROM training_invitees
             LEFT JOIN attendance_records ON attendance_records.training_invitee_id = training_invitees.id
             WHERE training_invitees.applicant_profile_id = :applicant_profile_id
             ORDER BY training_invitees.updated_at DESC, training_invitees.id DESC
             LIMIT 1'
        );
        $statement->execute(['applicant_profile_id' => $applicantProfileId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($row)) {
            return ['status' => TRAINING_STATUS_NOT_SCHEDULED, 'completed' => false, 'note' => 'No training schedule found yet.'];
        }

        $status = (string) ($row['attendance_status'] ?: $row['invite_status'] ?: TRAINING_STATUS_NOT_SCHEDULED);
        $completed = in_array($status, [TRAINING_STATUS_ATTENDED, TRAINING_STATUS_COMPLETED], true);

        return [
            'status' => $status,
            'completed' => $completed,
            'note' => $completed ? 'Training attendance requirement is complete.' : 'Training attendance is still pending.',
        ];
    }

    private function buildApprovalReadiness(array $requirements, array $formRequirements, array $trainingReadiness): array
    {
        $missingUploads = [];
        $rejectedUploads = [];
        $pendingUploads = [];
        foreach ($requirements as $requirement) {
            $status = strtolower((string) ($requirement['status'] ?? 'missing'));
            $label = (string) ($requirement['label'] ?? 'Requirement');
            $hasFile = !empty($requirement['file']['path']);
            if (!$hasFile) {
                $missingUploads[] = $label;
                continue;
            }
            if (in_array($status, ['rejected'], true)) {
                $rejectedUploads[] = $label;
                continue;
            }
            if (!in_array($status, ['verified', 'approved'], true)) {
                $pendingUploads[] = $label;
            }
        }

        $missingForms = [];
        $rejectedForms = [];
        $verifiedForms = 0;
        $pendingForms = [];
        foreach ($formRequirements as $requirement) {
            if (!($requirement['gatesApproval'] ?? true)) {
                continue;
            }
            $status = strtolower((string) ($requirement['status'] ?? POST_APPROVAL_STATUS_UNLOCKED));
            $label = (string) ($requirement['label'] ?? 'Form requirement');
            if (in_array($status, ['verified'], true)) {
                $verifiedForms++;
                continue;
            }
            if (in_array($status, ['rejected', 'needs correction'], true)) {
                $rejectedForms[] = $label;
                continue;
            }
            if (in_array($status, ['submitted'], true)) {
                $pendingForms[] = $label;
                continue;
            }
            $missingForms[] = $label;
        }

        $approvedUploads = count($requirements) - count($missingUploads) - count($rejectedUploads) - count($pendingUploads);
        $blockers = [];
        foreach ($missingUploads as $label) {
            $blockers[] = 'Missing: ' . $label;
        }
        foreach ($rejectedUploads as $label) {
            $blockers[] = 'Rejected: ' . $label;
        }
        foreach ($pendingUploads as $label) {
            $blockers[] = 'Pending review: ' . $label;
        }
        foreach ($missingForms as $label) {
            $blockers[] = 'Missing: ' . $label;
        }
        foreach ($rejectedForms as $label) {
            $blockers[] = 'Rejected: ' . $label;
        }
        foreach ($pendingForms as $label) {
            $blockers[] = 'Pending review: ' . $label;
        }
        if (!($trainingReadiness['completed'] ?? false)) {
            $blockers[] = 'Training attendance not completed';
        }

        $overallStatus = 'Under Review';
        if ($missingUploads !== [] || $missingForms !== []) {
            $overallStatus = 'Needs Documents';
        } elseif ($rejectedUploads !== [] || $rejectedForms !== []) {
            $overallStatus = 'Needs Correction';
        } elseif ($blockers === []) {
            $overallStatus = 'Approved';
        }

        return [
            'uploadSummary' => [
                'approved' => max(0, $approvedUploads),
                'total' => count($requirements),
            ],
            'formSummary' => [
                'approved' => $verifiedForms,
                'total' => count($formRequirements),
            ],
            'trainingStatus' => $trainingReadiness,
            'blockers' => $blockers,
            'canApprove' => $blockers === [],
            'overallStatus' => $overallStatus,
        ];
    }

    private function fetchLatestAssessment(int $applicationId): ?array
    {
        $this->ensureAssessmentTable();

        try {
            $statement = db()->prepare(
                'SELECT
                    application_assessments.id,
                    application_assessments.identity_residency_status,
                    application_assessments.document_validity_status,
                    application_assessments.livelihood_confirmation_status,
                    application_assessments.program_fit_status,
                    application_assessments.readiness_commitment_status,
                    application_assessments.recommendation,
                    application_assessments.remarks,
                    application_assessments.direct_worker_name,
                    application_assessments.certifying_officer_name,
                    application_assessments.created_at,
                    users.full_name AS assessor_name
                 FROM application_assessments
                 INNER JOIN users ON users.id = application_assessments.assessor_user_id
                 WHERE application_assessments.application_id = :application_id
                 ORDER BY application_assessments.id DESC
                 LIMIT 1'
            );
            $statement->execute(['application_id' => $applicationId]);
            $row = $statement->fetch(PDO::FETCH_ASSOC);
        } catch (\Throwable $exception) {
            log_database_query_failure('application.fetch_assessment', $exception, ['application_id' => $applicationId]);
            return null;
        }

        if (!is_array($row)) {
            return null;
        }

        return [
            'id' => (int) $row['id'],
            'identityResidency' => $row['identity_residency_status'],
            'documentValidity' => $row['document_validity_status'],
            'livelihoodConfirmation' => $row['livelihood_confirmation_status'],
            'programFit' => $row['program_fit_status'],
            'readinessCommitment' => $row['readiness_commitment_status'],
            'recommendation' => $row['recommendation'],
            'remarks' => $row['remarks'],
            'assessorName' => $row['assessor_name'],
            'directWorkerName' => $row['direct_worker_name'],
            'certifyingOfficerName' => $row['certifying_officer_name'],
            'createdAt' => $row['created_at'],
        ];
    }

    private function ensureAssessmentTable(): void
    {
        static $ensured = false;
        if ($ensured) {
            return;
        }

        db()->exec(
            'CREATE TABLE IF NOT EXISTS application_assessments (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                application_id BIGINT UNSIGNED NOT NULL,
                assessor_user_id BIGINT UNSIGNED NOT NULL,
                assessor_staff_profile_id BIGINT UNSIGNED NULL,
                identity_residency_status VARCHAR(40) NOT NULL,
                document_validity_status VARCHAR(40) NOT NULL,
                livelihood_confirmation_status VARCHAR(40) NOT NULL,
                program_fit_status VARCHAR(40) NOT NULL,
                readiness_commitment_status VARCHAR(40) NOT NULL,
                recommendation VARCHAR(40) NOT NULL,
                remarks TEXT NOT NULL,
                direct_worker_user_id BIGINT UNSIGNED NULL,
                direct_worker_name VARCHAR(160) NULL,
                certifying_officer_user_id BIGINT UNSIGNED NULL,
                certifying_officer_name VARCHAR(160) NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_application_assessments_application FOREIGN KEY (application_id) REFERENCES applications(id),
                CONSTRAINT fk_application_assessments_assessor_user FOREIGN KEY (assessor_user_id) REFERENCES users(id),
                CONSTRAINT fk_application_assessments_assessor_staff FOREIGN KEY (assessor_staff_profile_id) REFERENCES staff_profiles(id),
                CONSTRAINT fk_application_assessments_direct_worker FOREIGN KEY (direct_worker_user_id) REFERENCES users(id),
                CONSTRAINT fk_application_assessments_certifying_officer FOREIGN KEY (certifying_officer_user_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $ensured = true;
    }

    private function initialRequirementFileColumns(): array
    {
        if ($this->initialRequirementFileColumns !== null) {
            return $this->initialRequirementFileColumns;
        }

        try {
            $rows = db()->query('SHOW COLUMNS FROM initial_requirement_files')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('application.initial_requirement_columns', $exception);
            $this->initialRequirementFileColumns = [];
            return $this->initialRequirementFileColumns;
        }

        $this->initialRequirementFileColumns = array_map(
            static fn (array $row): string => (string) ($row['Field'] ?? ''),
            $rows
        );

        return $this->initialRequirementFileColumns;
    }

    private function hasInitialRequirementReviewColumns(): bool
    {
        $columns = $this->initialRequirementFileColumns();
        return in_array('reviewer_remarks', $columns, true)
            && in_array('reviewed_by_user_id', $columns, true)
            && in_array('reviewed_at', $columns, true);
    }

    private function frontendKeyToCode(string $key): string
    {
        return match ($key) {
            'validId' => 'valid_id',
            'healthCertificate' => 'health_certificate',
            'cedula' => 'cedula',
            default => throw new \RuntimeException('Unknown requirement key.'),
        };
    }

    private function codeToFrontendKey(string $code): string
    {
        return match ($code) {
            'valid_id' => 'validId',
            'health_certificate' => 'healthCertificate',
            'cedula' => 'cedula',
            default => $code,
        };
    }

    private function resolveAssignedProjectOfficerProfileId(int $barangayId): ?int
    {
        $statement = db()->prepare(
            'SELECT staff_profiles.id
             FROM staff_barangay_assignments
             INNER JOIN staff_profiles ON staff_profiles.id = staff_barangay_assignments.staff_profile_id
             INNER JOIN users ON users.id = staff_profiles.user_id
             INNER JOIN roles ON roles.id = users.role_id
             WHERE staff_barangay_assignments.barangay_id = :barangay_id
               AND staff_barangay_assignments.ended_at IS NULL
               AND staff_profiles.status = :status
               AND users.is_active = 1
               AND users.is_disabled = 0
               AND roles.name = :role_name
             ORDER BY staff_barangay_assignments.assigned_at ASC, staff_barangay_assignments.id ASC
             LIMIT 1'
        );
        $statement->execute([
            'barangay_id' => $barangayId,
            'status' => 'active',
            'role_name' => ROLE_PROJECT_OFFICER,
        ]);
        $value = $statement->fetchColumn();
        return $value !== false ? (int) $value : null;
    }

    private function findApplicationRow(int $applicationId, array $actor): ?array
    {
        $actorRole = strtolower((string) ($actor['role'] ?? ''));
        $isProjectOfficer = str_contains($actorRole, 'project');

        $params = ['application_id' => $applicationId];
        $joins = [
            'INNER JOIN applicant_profiles ON applicant_profiles.id = applications.applicant_profile_id',
            'INNER JOIN users AS applicant_users ON applicant_users.id = applicant_profiles.user_id',
            'LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id',
            'LEFT JOIN staff_profiles AS assigned_staff ON assigned_staff.id = applications.assigned_staff_profile_id',
            'LEFT JOIN users AS assigned_users ON assigned_users.id = assigned_staff.user_id',
        ];
        $conditions = ['applications.id = :application_id'];

        if ($isProjectOfficer) {
            $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
            if ($staffProfileId === null) {
                return null;
            }

            $joins[] = 'INNER JOIN staff_barangay_assignments AS scope_assignments
                        ON scope_assignments.barangay_id = applicant_profiles.barangay_id
                       AND scope_assignments.staff_profile_id = :scope_staff_profile_id
                       AND scope_assignments.ended_at IS NULL';
            $params['scope_staff_profile_id'] = $staffProfileId;
        }

        $sql = '
            SELECT
                applications.id,
                applications.status,
                applications.submitted_at,
                applications.reviewed_at,
                applications.assigned_staff_profile_id,
                applications.updated_at,
                applicant_users.full_name AS applicant_name,
                applicant_users.email AS applicant_email,
                applicant_profiles.business_name,
                applicant_profiles.contact_number,
                applicant_profiles.household_size,
                applicant_profiles.sector,
                applicant_profiles.livelihood_type,
                applicant_profiles.address_line,
                applicant_profiles.birthdate,
                applicant_profiles.age,
                applicant_profiles.gender,
                applicant_profiles.is_4ps,
                barangays.id AS barangay_id,
                barangays.name AS barangay_name,
                assigned_users.full_name AS assigned_pdo_name,
                (
                    SELECT COUNT(*)
                    FROM initial_requirement_files AS files
                    WHERE files.application_id = applications.id
                ) AS uploaded_requirement_count,
                (
                    SELECT COUNT(*)
                    FROM initial_requirement_files AS files
                    WHERE files.application_id = applications.id
                      AND LOWER(files.review_status) = "verified"
                ) AS verified_requirement_count,
                (
                    SELECT COUNT(*)
                    FROM initial_requirement_types AS requirement_types
                    WHERE requirement_types.is_required = 1
                ) AS total_required_documents
            FROM applications
            ' . implode("\n", $joins) . '
            WHERE ' . implode(' AND ', $conditions) . '
            LIMIT 1
        ';

        $statement = db()->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue(':' . $key, $value);
        }
        $statement->execute();
        $row = $statement->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    private function mapApplicationRow(array $row): array
    {
        return [
            'id' => (int) $row['id'],
            'status' => $this->normalizeStoredStatus((string) $row['status']),
            'submittedAt' => $row['submitted_at'],
            'reviewedAt' => $row['reviewed_at'],
            'updatedAt' => $row['updated_at'],
            'applicantName' => $row['applicant_name'],
            'email' => $row['applicant_email'],
            'businessName' => $row['business_name'],
            'contactNumber' => $row['contact_number'],
            'householdSize' => $row['household_size'] !== null ? (int) $row['household_size'] : null,
            'sector' => $row['sector'],
            'livelihood' => $row['livelihood_type'],
            'address' => $row['address_line'],
            'birthdate' => $row['birthdate'],
            'age' => $row['age'] !== null ? (int) $row['age'] : null,
            'gender' => $row['gender'],
            'is4ps' => ((int) ($row['is_4ps'] ?? 0)) === 1,
            'barangayId' => $row['barangay_id'] !== null ? (int) $row['barangay_id'] : null,
            'barangay' => $row['barangay_name'],
            'assignedPdoName' => $row['assigned_pdo_name'],
            'assignedStaffProfileId' => $row['assigned_staff_profile_id'] !== null ? (int) $row['assigned_staff_profile_id'] : null,
            'uploadedRequirementCount' => (int) $row['uploaded_requirement_count'],
            'verifiedRequirementCount' => (int) $row['verified_requirement_count'],
            'requiredRequirementCount' => (int) $row['total_required_documents'],
        ];
    }

    private function buildApplicationSummary(array $applications): array
    {
        $summary = $this->emptyApplicationSummary();
        foreach ($applications as $application) {
            $summary['total']++;
            if ($application['status'] === APPLICATION_STATUS_SUBMITTED) {
                $summary['submitted']++;
            }
            if ($application['status'] === APPLICATION_STATUS_UNDER_REVIEW) {
                $summary['underReview']++;
            }
            if ($application['status'] === APPLICATION_STATUS_CHECKED_BY_PDO) {
                $summary['checkedByPdo']++;
            }
            if (in_array($application['status'], [APPLICATION_STATUS_REQUIREMENTS_VERIFIED, APPLICATION_STATUS_FOR_ASSESSMENT], true)) {
                $summary['checkedByPdo']++;
            }
            if ($application['status'] === APPLICATION_STATUS_APPROVED) {
                $summary['approved']++;
            }
            if ($application['status'] === APPLICATION_STATUS_APPROVED_FOR_TRAINING) {
                $summary['approved']++;
            }
            if (in_array($application['status'], [APPLICATION_STATUS_FLAGGED, APPLICATION_STATUS_NEEDS_CORRECTION], true)) {
                $summary['needsAttention']++;
            }
            if (in_array($application['status'], [APPLICATION_STATUS_SUBMITTED, APPLICATION_STATUS_UNDER_REVIEW, APPLICATION_STATUS_FOR_ASSESSMENT], true)) {
                $summary['pending']++;
            }
        }

        return $summary;
    }

    private function emptyApplicationSummary(): array
    {
        return [
            'total' => 0,
            'pending' => 0,
            'submitted' => 0,
            'underReview' => 0,
            'checkedByPdo' => 0,
            'approved' => 0,
            'needsAttention' => 0,
        ];
    }

    private function availableBarangays(array $actor): array
    {
        $actorRole = strtolower((string) ($actor['role'] ?? ''));
        if (str_contains($actorRole, 'project')) {
            return $this->assignedBarangaysForUser((int) $actor['id']);
        }

        $statement = db()->query('SELECT id, name FROM barangays ORDER BY name ASC');
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static fn (array $row): array => ['id' => (int) $row['id'], 'name' => $row['name']], $rows);
    }

    private function availableAssignedPdos(): array
    {
        $statement = db()->prepare(
            'SELECT staff_profiles.id, users.full_name
             FROM staff_profiles
             INNER JOIN users ON users.id = staff_profiles.user_id
             INNER JOIN roles ON roles.id = users.role_id
             WHERE roles.name = :role_name
             ORDER BY users.full_name ASC'
        );
        $statement->execute(['role_name' => ROLE_PROJECT_OFFICER]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(static fn (array $row): array => ['id' => (int) $row['id'], 'name' => $row['full_name']], $rows);
    }

    private function assignedBarangaysForUser(int $userId): array
    {
        return (new BarangayAssignmentService())->assignedBarangaysForUser($userId);
    }

    private function findStaffProfileIdForUser(int $userId): ?int
    {
        $statement = db()->prepare('SELECT id FROM staff_profiles WHERE user_id = :user_id LIMIT 1');
        $statement->execute(['user_id' => $userId]);
        $value = $statement->fetchColumn();
        return $value !== false ? (int) $value : null;
    }

    private function findApplicantProfileIdForApplication(int $applicationId): int
    {
        $statement = db()->prepare('SELECT applicant_profile_id FROM applications WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $applicationId]);
        $value = $statement->fetchColumn();
        return $value !== false ? (int) $value : 0;
    }

    private function fetchApplicationComments(int $applicationId): array
    {
        $statement = db()->prepare(
            'SELECT application_comments.id, application_comments.comment_text, application_comments.visibility, application_comments.created_at,
                    users.full_name AS actor_name
             FROM application_comments
             INNER JOIN users ON users.id = application_comments.user_id
             WHERE application_comments.application_id = :application_id
             ORDER BY application_comments.created_at DESC'
        );
        $statement->execute(['application_id' => $applicationId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'comment' => $row['comment_text'],
                'visibility' => $row['visibility'],
                'actorName' => $row['actor_name'],
                'createdAt' => $row['created_at'],
            ];
        }, $rows);
    }

    private function fetchApplicationHistory(int $applicationId): array
    {
        $statement = db()->prepare(
            'SELECT application_status_history.id, application_status_history.from_status, application_status_history.to_status,
                    application_status_history.remarks, application_status_history.created_at, users.full_name AS actor_name
             FROM application_status_history
             INNER JOIN users ON users.id = application_status_history.changed_by_user_id
             WHERE application_status_history.application_id = :application_id
             ORDER BY application_status_history.created_at DESC, application_status_history.id DESC'
        );
        $statement->execute(['application_id' => $applicationId]);
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'fromStatus' => $row['from_status'] !== null ? $this->normalizeStoredStatus((string) $row['from_status']) : null,
                'toStatus' => $this->normalizeStoredStatus((string) $row['to_status']),
                'remarks' => $row['remarks'],
                'actorName' => $row['actor_name'],
                'createdAt' => $row['created_at'],
            ];
        }, $rows);
    }

    private function createApplicationComment(int $applicationId, int $userId, string $comment, string $visibility = 'internal'): void
    {
        db()->prepare(
            'INSERT INTO application_comments (application_id, user_id, comment_text, visibility)
             VALUES (:application_id, :user_id, :comment_text, :visibility)'
        )->execute([
            'application_id' => $applicationId,
            'user_id' => $userId,
            'comment_text' => $comment,
            'visibility' => $visibility,
        ]);
    }

    private function resolveNextStatus(string $decision, string $actorRole): ?string
    {
        return match ($decision) {
            'approve' => str_contains($actorRole, 'project') ? APPLICATION_STATUS_REQUIREMENTS_VERIFIED : APPLICATION_STATUS_APPROVED_FOR_TRAINING,
            'reject' => APPLICATION_STATUS_REJECTED,
            'flag' => APPLICATION_STATUS_FLAGGED,
            'needs_correction' => APPLICATION_STATUS_NEEDS_CORRECTION,
            'start_review' => APPLICATION_STATUS_UNDER_REVIEW,
            'for_assessment' => APPLICATION_STATUS_FOR_ASSESSMENT,
            default => null,
        };
    }

    private function normalizeStoredStatus(string $status): string
    {
        return match (strtolower(trim($status))) {
            'draft' => APPLICATION_STATUS_DRAFT,
            'submitted' => APPLICATION_STATUS_SUBMITTED,
            'under review', 'under_review', 'underreview' => APPLICATION_STATUS_UNDER_REVIEW,
            'checked by pdo', 'checked_by_pdo', 'checkedbypdo' => APPLICATION_STATUS_CHECKED_BY_PDO,
            'requirements verified', 'requirements_verified', 'requirementsverified' => APPLICATION_STATUS_REQUIREMENTS_VERIFIED,
            'for assessment', 'for_assessment', 'forassessment' => APPLICATION_STATUS_FOR_ASSESSMENT,
            'approved' => APPLICATION_STATUS_APPROVED,
            'approved for training', 'approved_for_training', 'approvedfortraining' => APPLICATION_STATUS_APPROVED_FOR_TRAINING,
            'rejected' => APPLICATION_STATUS_REJECTED,
            'flagged' => APPLICATION_STATUS_FLAGGED,
            'needs correction', 'needs_correction', 'needscorrection' => APPLICATION_STATUS_NEEDS_CORRECTION,
            'training ongoing', 'training_ongoing', 'trainingongoing' => APPLICATION_STATUS_TRAINING_ONGOING,
            'completed' => APPLICATION_STATUS_COMPLETED,
            default => $status,
        };
    }

    private function resolveUserName(int $userId): string
    {
        if ($userId < 1) {
            return '';
        }

        $statement = db()->prepare('SELECT full_name FROM users WHERE id = :id LIMIT 1');
        $statement->execute(['id' => $userId]);
        $name = $statement->fetchColumn();
        return is_string($name) ? trim($name) : '';
    }

    private function publicUploadUrl(string $path): string
    {
        $trimmed = ltrim(str_replace('\\', '/', $path), '/');
        return app_url($trimmed);
    }
}

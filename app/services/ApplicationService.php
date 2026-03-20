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
        $detail['comments'] = $this->fetchApplicationComments($applicationId);
        $detail['history'] = $this->fetchApplicationHistory($applicationId);

        return $detail;
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

        if ($nextStatus === null) {
            return ['ok' => false, 'errors' => ['decision' => 'Invalid application decision.']];
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

            if ($nextStatus === APPLICATION_STATUS_APPROVED) {
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
        $statement = db()->prepare(
            'SELECT initial_requirement_types.code, initial_requirement_types.label, initial_requirement_files.file_path,
                    initial_requirement_files.original_name, initial_requirement_files.mime_type, initial_requirement_files.file_size,
                    initial_requirement_files.review_status, initial_requirement_files.updated_at
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
                'status' => $row['review_status'],
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
                    'status' => 'missing',
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
            if ($application['status'] === APPLICATION_STATUS_APPROVED) {
                $summary['approved']++;
            }
            if (in_array($application['status'], [APPLICATION_STATUS_FLAGGED, APPLICATION_STATUS_NEEDS_CORRECTION], true)) {
                $summary['needsAttention']++;
            }
            if (in_array($application['status'], [APPLICATION_STATUS_SUBMITTED, APPLICATION_STATUS_UNDER_REVIEW], true)) {
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

    private function resolveNextStatus(string $decision, string $actorRole): ?string
    {
        return match ($decision) {
            'approve' => str_contains($actorRole, 'project') ? APPLICATION_STATUS_CHECKED_BY_PDO : APPLICATION_STATUS_APPROVED,
            'reject' => APPLICATION_STATUS_REJECTED,
            'flag' => APPLICATION_STATUS_FLAGGED,
            'needs_correction' => APPLICATION_STATUS_NEEDS_CORRECTION,
            'start_review' => APPLICATION_STATUS_UNDER_REVIEW,
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
            'approved' => APPLICATION_STATUS_APPROVED,
            'rejected' => APPLICATION_STATUS_REJECTED,
            'flagged' => APPLICATION_STATUS_FLAGGED,
            'needs correction', 'needs_correction', 'needscorrection' => APPLICATION_STATUS_NEEDS_CORRECTION,
            default => $status,
        };
    }

    private function publicUploadUrl(string $path): string
    {
        $trimmed = ltrim(str_replace('\\', '/', $path), '/');
        return app_url($trimmed);
    }
}

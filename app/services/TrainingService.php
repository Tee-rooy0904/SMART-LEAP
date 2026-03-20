<?php

declare(strict_types=1);

namespace App\Services;

use PDO;

class TrainingService
{
    private ?string $cachedSchemaError = null;

    public function schemaError(): ?string
    {
        if ($this->cachedSchemaError !== null) {
            return $this->cachedSchemaError;
        }

        $required = [
            'training_programs' => ['what_to_bring', 'instructions'],
            'training_invitees' => ['applicant_profile_id', 'remarks', 'notified_at', 'last_notice_sent_at', 'updated_by_user_id', 'post_approval_unlocked_at'],
            'attendance_records' => ['training_invitee_id', 'applicant_profile_id', 'remarks', 'recorded_by_user_id'],
        ];

        foreach ($required as $table => $columns) {
            try {
                $statement = db()->query('SHOW COLUMNS FROM ' . $table);
                $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $exception) {
                log_database_query_failure('training.schema_check', $exception, ['table' => $table]);
                $this->cachedSchemaError = 'Unable to verify the training database schema right now.';
                return $this->cachedSchemaError;
            }

            $existing = array_map(static fn (array $row): string => (string) ($row['Field'] ?? ''), $rows);
            $missing = array_values(array_diff($columns, $existing));
            if ($missing !== []) {
                $this->cachedSchemaError = 'Training database update required. Import or run database/migrations/027_alter_training_workflow_foundation.sql before using the training module.';
                return $this->cachedSchemaError;
            }
        }

        return null;
    }

    public function listPrograms(array $filters, array $actor): array
    {
        if ($this->schemaError() !== null) {
            return $this->emptyListing();
        }

        $params = [];
        $joins = [];
        $conditions = ['1 = 1'];

        if ($this->isProjectOfficer($actor)) {
            $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
            if ($staffProfileId === null) {
                return $this->emptyListing();
            }

            $joins[] = 'INNER JOIN training_invitees ON training_invitees.training_program_id = training_programs.id';
            $joins[] = 'INNER JOIN applicant_profiles ON applicant_profiles.id = training_invitees.applicant_profile_id';
            $joins[] = 'INNER JOIN staff_barangay_assignments AS scope_assignments
                        ON scope_assignments.barangay_id = applicant_profiles.barangay_id
                       AND scope_assignments.staff_profile_id = :scope_staff_profile_id
                       AND scope_assignments.ended_at IS NULL';
            $params['scope_staff_profile_id'] = $staffProfileId;
        }

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '') {
            $conditions[] = 'LOWER(training_programs.status) = :status';
            $params['status'] = strtolower($status);
        }

        $name = trim((string) ($filters['programName'] ?? ''));
        if ($name !== '') {
            $conditions[] = 'training_programs.title LIKE :program_name';
            $params['program_name'] = '%' . $name . '%';
        }

        $date = trim((string) ($filters['date'] ?? ''));
        if ($date !== '') {
            $conditions[] = 'DATE(training_programs.starts_at) = :program_date';
            $params['program_date'] = $date;
        }

        $sql = '
            SELECT DISTINCT
                training_programs.id,
                training_programs.title,
                training_programs.description,
                training_programs.venue,
                training_programs.starts_at,
                training_programs.ends_at,
                training_programs.what_to_bring,
                training_programs.instructions,
                training_programs.status,
                training_programs.created_by_user_id,
                training_programs.created_at,
                users.full_name AS created_by_name,
                (
                    SELECT COUNT(*) FROM training_invitees WHERE training_invitees.training_program_id = training_programs.id
                ) AS participant_count,
                (
                    SELECT COUNT(*)
                    FROM training_invitees
                    WHERE training_invitees.training_program_id = training_programs.id
                      AND training_invitees.invite_status IN ("Attended", "Completed")
                ) AS completed_count,
                (
                    SELECT COUNT(*)
                    FROM training_invitees
                    WHERE training_invitees.training_program_id = training_programs.id
                      AND training_invitees.invite_status = "Attended"
                ) AS attended_count,
                (
                    SELECT COUNT(*)
                    FROM training_invitees
                    WHERE training_invitees.training_program_id = training_programs.id
                      AND training_invitees.invite_status = "Notified"
                ) AS notified_count
            FROM training_programs
            LEFT JOIN users ON users.id = training_programs.created_by_user_id
            ' . implode("\n", $joins) . '
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY training_programs.starts_at DESC, training_programs.id DESC
        ';

        try {
            $statement = db()->prepare($sql);
            foreach ($params as $key => $value) {
                $statement->bindValue(':' . $key, $value);
            }
            $statement->execute();
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('training.list_programs', $exception, ['filters' => $filters]);
            return $this->emptyListing();
        }

        $programs = array_map(fn (array $row): array => $this->mapProgramRow($row), $rows);

        return [
            'programs' => $programs,
            'eligibleInvitees' => $this->eligibleInvitees($actor),
            'summary' => $this->buildSummary($programs),
            'statuses' => TRAINING_ALLOWED_STATUSES,
        ];
    }

    public function saveProgram(array $payload, array $actor, ?int $programId = null): array
    {
        if ($this->schemaError() !== null) {
            return ['ok' => false, 'errors' => ['general' => $this->schemaError()]];
        }

        if (!$this->isAdmin($actor)) {
            return ['ok' => false, 'errors' => ['general' => 'Only administrators can manage training programs.']];
        }

        $input = $this->validateProgramPayload($payload);
        if ($input['errors'] !== []) {
            return ['ok' => false, 'errors' => $input['errors']];
        }

        $startsAt = $input['data']['date'] . ' ' . $input['data']['startTime'] . ':00';
        $endsAt = $input['data']['date'] . ' ' . $input['data']['endTime'] . ':00';

        try {
            if ($programId !== null && $programId > 0) {
                $statement = db()->prepare(
                    'UPDATE training_programs
                     SET title = :title, description = :description, venue = :venue, starts_at = :starts_at, ends_at = :ends_at,
                         what_to_bring = :what_to_bring, instructions = :instructions, status = :status, updated_at = NOW()
                     WHERE id = :id'
                );
                $statement->execute([
                    'title' => $input['data']['programName'],
                    'description' => $input['data']['description'] ?: null,
                    'venue' => $input['data']['venue'] ?: null,
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'what_to_bring' => $input['data']['whatToBring'] ?: null,
                    'instructions' => $input['data']['instructions'] ?: null,
                    'status' => $input['data']['status'],
                    'id' => $programId,
                ]);
            } else {
                $statement = db()->prepare(
                    'INSERT INTO training_programs
                     (title, description, venue, starts_at, ends_at, what_to_bring, instructions, status, created_by_user_id)
                     VALUES (:title, :description, :venue, :starts_at, :ends_at, :what_to_bring, :instructions, :status, :created_by_user_id)'
                );
                $statement->execute([
                    'title' => $input['data']['programName'],
                    'description' => $input['data']['description'] ?: null,
                    'venue' => $input['data']['venue'] ?: null,
                    'starts_at' => $startsAt,
                    'ends_at' => $endsAt,
                    'what_to_bring' => $input['data']['whatToBring'] ?: null,
                    'instructions' => $input['data']['instructions'] ?: null,
                    'status' => $input['data']['status'],
                    'created_by_user_id' => (int) $actor['id'],
                ]);
                $programId = (int) db()->lastInsertId();
            }
        } catch (\Throwable $exception) {
            log_database_query_failure('training.save_program', $exception, ['program_id' => $programId]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to save training program right now.']];
        }

        (new AuditLogService())->record((int) $actor['id'], 'training.program_saved', 'training_programs', $programId, [
            'status' => $input['data']['status'],
        ]);

        return ['ok' => true, 'programId' => $programId];
    }

    public function getProgramDetail(int $programId, array $actor): ?array
    {
        if ($this->schemaError() !== null) {
            return null;
        }

        $program = $this->findProgram($programId, $actor);
        if ($program === null) {
            return null;
        }

        return $program + [
            'invitees' => $this->programInvitees($programId, $actor),
        ];
    }

    public function syncInvitees(int $programId, array $applicantProfileIds, array $actor): array
    {
        if ($this->schemaError() !== null) {
            return ['ok' => false, 'errors' => ['general' => $this->schemaError()]];
        }

        if (!$this->isAdmin($actor)) {
            return ['ok' => false, 'errors' => ['general' => 'Only administrators can assign training participants.']];
        }

        $program = $this->findProgram($programId, $actor);
        if ($program === null) {
            return ['ok' => false, 'errors' => ['program' => 'Training program not found.']];
        }

        $eligible = $this->eligibleInvitees($actor);
        $eligibleMap = [];
        foreach ($eligible as $invitee) {
            $eligibleMap[(int) $invitee['applicantProfileId']] = $invitee;
        }

        $targetIds = array_values(array_unique(array_filter(array_map('intval', $applicantProfileIds))));
        foreach ($targetIds as $applicantProfileId) {
            if (!isset($eligibleMap[$applicantProfileId])) {
                return ['ok' => false, 'errors' => ['invitees' => 'One or more selected applicants are not eligible for training.']];
            }
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $existingStatement = $pdo->prepare('SELECT id, applicant_profile_id FROM training_invitees WHERE training_program_id = :training_program_id');
            $existingStatement->execute(['training_program_id' => $programId]);
            $existingRows = $existingStatement->fetchAll(PDO::FETCH_ASSOC) ?: [];
            $existingMap = [];
            foreach ($existingRows as $row) {
                $existingMap[(int) $row['applicant_profile_id']] = (int) $row['id'];
            }

            $insert = $pdo->prepare(
                'INSERT INTO training_invitees
                 (training_program_id, applicant_profile_id, beneficiary_profile_id, invite_status, updated_by_user_id)
                 VALUES (:training_program_id, :applicant_profile_id, :beneficiary_profile_id, :invite_status, :updated_by_user_id)'
            );

            foreach ($targetIds as $applicantProfileId) {
                if (isset($existingMap[$applicantProfileId])) {
                    continue;
                }

                $insert->execute([
                    'training_program_id' => $programId,
                    'applicant_profile_id' => $applicantProfileId,
                    'beneficiary_profile_id' => $eligibleMap[$applicantProfileId]['beneficiaryProfileId']
                        ?: (new BeneficiaryProfileService())->ensureForApplicantProfile($applicantProfileId),
                    'invite_status' => TRAINING_STATUS_SCHEDULED,
                    'updated_by_user_id' => (int) $actor['id'],
                ]);
            }

            if ($existingMap !== []) {
                if ($targetIds !== []) {
                    $placeholders = implode(',', array_fill(0, count($targetIds), '?'));

                    $deleteAttendance = $pdo->prepare(
                        "DELETE attendance_records FROM attendance_records
                         INNER JOIN training_invitees ON training_invitees.id = attendance_records.training_invitee_id
                         WHERE training_invitees.training_program_id = ?
                           AND training_invitees.applicant_profile_id NOT IN ($placeholders)"
                    );
                    $deleteAttendance->bindValue(1, $programId, PDO::PARAM_INT);
                    foreach ($targetIds as $index => $id) {
                        $deleteAttendance->bindValue($index + 2, $id, PDO::PARAM_INT);
                    }
                    $deleteAttendance->execute();

                    $deleteInvitees = $pdo->prepare(
                        "DELETE FROM training_invitees
                         WHERE training_program_id = ?
                           AND applicant_profile_id NOT IN ($placeholders)"
                    );
                    $deleteInvitees->bindValue(1, $programId, PDO::PARAM_INT);
                    foreach ($targetIds as $index => $id) {
                        $deleteInvitees->bindValue($index + 2, $id, PDO::PARAM_INT);
                    }
                    $deleteInvitees->execute();
                } else {
                    $pdo->prepare(
                        'DELETE attendance_records FROM attendance_records
                         INNER JOIN training_invitees ON training_invitees.id = attendance_records.training_invitee_id
                         WHERE training_invitees.training_program_id = :training_program_id'
                    )->execute(['training_program_id' => $programId]);

                    $pdo->prepare('DELETE FROM training_invitees WHERE training_program_id = :training_program_id')
                        ->execute(['training_program_id' => $programId]);
                }
            }

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            log_database_query_failure('training.sync_invitees', $exception, ['program_id' => $programId]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to sync training invitees right now.']];
        }

        (new AuditLogService())->record((int) $actor['id'], 'training.invitees_synced', 'training_programs', $programId, [
            'invitee_count' => count($targetIds),
        ]);

        return ['ok' => true];
    }

    public function sendNotices(int $programId, array $inviteeIds, array $actor): array
    {
        if ($this->schemaError() !== null) {
            return ['ok' => false, 'errors' => ['general' => $this->schemaError()]];
        }

        if (!$this->isAdmin($actor) && !$this->isProjectOfficer($actor)) {
            return ['ok' => false, 'errors' => ['general' => 'You are not allowed to send training notices.']];
        }

        $program = $this->findProgram($programId, $actor);
        if ($program === null) {
            return ['ok' => false, 'errors' => ['program' => 'Training program not found.']];
        }

        $invitees = $this->programInvitees($programId, $actor);
        $ids = array_values(array_unique(array_filter(array_map('intval', $inviteeIds))));
        $selected = $ids === []
            ? $invitees
            : array_values(array_filter($invitees, static fn (array $invitee): bool => in_array((int) $invitee['id'], $ids, true)));

        if ($selected === []) {
            return ['ok' => false, 'errors' => ['invitees' => 'No eligible training participants were found for notice sending.']];
        }

        $notificationService = new NotificationService();
        $sentCount = 0;

        try {
            $statement = db()->prepare(
                'UPDATE training_invitees
                 SET invite_status = :invite_status,
                     notified_at = COALESCE(notified_at, NOW()),
                     last_notice_sent_at = NOW(),
                     updated_by_user_id = :updated_by_user_id,
                     updated_at = NOW()
                 WHERE id = :id'
            );

            foreach ($selected as $invitee) {
                $sent = $notificationService->sendTrainingNotice(
                    $invitee['user'],
                    $program,
                    $invitee + ['updatedByUserId' => (int) $actor['id']]
                );

                $statement->execute([
                    'invite_status' => TRAINING_STATUS_NOTIFIED,
                    'updated_by_user_id' => (int) $actor['id'],
                    'id' => (int) $invitee['id'],
                ]);

                if ($sent) {
                    $sentCount++;
                }
            }
        } catch (\Throwable $exception) {
            log_database_query_failure('training.send_notices', $exception, ['program_id' => $programId]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to send training notices right now.']];
        }

        return ['ok' => true, 'sentCount' => $sentCount];
    }

    public function updateAttendance(int $trainingInviteeId, string $status, ?string $remarks, array $actor): array
    {
        if ($this->schemaError() !== null) {
            return ['ok' => false, 'errors' => ['general' => $this->schemaError()]];
        }

        if (!$this->isAdmin($actor) && !$this->isProjectOfficer($actor)) {
            return ['ok' => false, 'errors' => ['general' => 'You are not allowed to update training attendance.']];
        }

        $invitee = $this->findScopedInvitee($trainingInviteeId, $actor);
        if ($invitee === null) {
            return ['ok' => false, 'errors' => ['invitee' => 'Training participant not found in your scope.']];
        }

        $attendanceService = new AttendanceService();
        $result = $attendanceService->updateInviteeAttendance((int) $invitee['id'], $status, $remarks, (int) ($actor['id'] ?? 0));
        if ($result['ok'] ?? false) {
            (new AuditLogService())->record((int) ($actor['id'] ?? 0), 'training.attendance_updated', 'training_invitees', (int) $invitee['id'], [
                'status' => $status,
            ]);
        }

        return $result;
    }

    public function eligibleInvitees(array $actor): array
    {
        $params = [];
        $joins = [];
        $conditions = ['LOWER(applications.status) IN ("approved", "approved for training", "approvedfortraining")'];

        if ($this->isProjectOfficer($actor)) {
            $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
            if ($staffProfileId === null) {
                return [];
            }

            $joins[] = 'INNER JOIN staff_barangay_assignments AS scope_assignments
                        ON scope_assignments.barangay_id = applicant_profiles.barangay_id
                       AND scope_assignments.staff_profile_id = :scope_staff_profile_id
                       AND scope_assignments.ended_at IS NULL';
            $params['scope_staff_profile_id'] = $staffProfileId;
        }

        $sql = '
            SELECT
                applicant_profiles.id AS applicant_profile_id,
                applicant_profiles.business_name,
                applicant_profiles.barangay_id,
                applicant_profiles.sector,
                applicant_profiles.livelihood_type,
                applicant_profiles.contact_number,
                users.id AS user_id,
                users.full_name,
                users.email,
                barangays.name AS barangay_name,
                beneficiary_profiles.id AS beneficiary_profile_id,
                applications.status AS application_status
            FROM applications
            INNER JOIN applicant_profiles ON applicant_profiles.id = applications.applicant_profile_id
            INNER JOIN users ON users.id = applicant_profiles.user_id
            LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
            LEFT JOIN beneficiary_profiles ON beneficiary_profiles.applicant_profile_id = applicant_profiles.id
            ' . implode("\n", $joins) . '
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY users.full_name ASC
        ';

        try {
            $statement = db()->prepare($sql);
            foreach ($params as $key => $value) {
                $statement->bindValue(':' . $key, $value);
            }
            $statement->execute();
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('training.eligible_invitees', $exception, []);
            return [];
        }

        return array_map(static function (array $row): array {
            return [
                'applicantProfileId' => (int) $row['applicant_profile_id'],
                'beneficiaryProfileId' => $row['beneficiary_profile_id'] !== null ? (int) $row['beneficiary_profile_id'] : null,
                'name' => $row['full_name'],
                'email' => $row['email'],
                'barangay' => $row['barangay_name'],
                'businessName' => $row['business_name'],
                'sector' => $row['sector'],
                'status' => $row['application_status'],
                'applicationStatus' => $row['application_status'],
                'userId' => (int) $row['user_id'],
            ];
        }, $rows);
    }

    public function programInvitees(int $programId, array $actor): array
    {
        $program = $this->findProgram($programId, $actor);
        if ($program === null) {
            return [];
        }

        $params = ['training_program_id' => $programId];
        $joins = [];
        $conditions = ['training_invitees.training_program_id = :training_program_id'];

        if ($this->isProjectOfficer($actor)) {
            $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
            if ($staffProfileId === null) {
                return [];
            }

            $joins[] = 'INNER JOIN staff_barangay_assignments AS scope_assignments
                        ON scope_assignments.barangay_id = applicant_profiles.barangay_id
                       AND scope_assignments.staff_profile_id = :scope_staff_profile_id
                       AND scope_assignments.ended_at IS NULL';
            $params['scope_staff_profile_id'] = $staffProfileId;
        }

        $sql = '
            SELECT
                training_invitees.id,
                training_invitees.invite_status,
                training_invitees.remarks,
                training_invitees.notified_at,
                training_invitees.last_notice_sent_at,
                training_invitees.post_approval_unlocked_at,
                training_invitees.applicant_profile_id,
                training_invitees.beneficiary_profile_id,
                users.id AS user_id,
                users.full_name,
                users.email,
                applicant_profiles.business_name,
                applicant_profiles.sector,
                applicant_profiles.livelihood_type,
                barangays.name AS barangay_name,
                attendance_records.attendance_status,
                attendance_records.remarks AS attendance_remarks,
                attendance_records.checked_in_at,
                updated_by.full_name AS updated_by_name
            FROM training_invitees
            INNER JOIN applicant_profiles ON applicant_profiles.id = training_invitees.applicant_profile_id
            INNER JOIN users ON users.id = applicant_profiles.user_id
            LEFT JOIN beneficiary_profiles ON beneficiary_profiles.id = training_invitees.beneficiary_profile_id
            LEFT JOIN barangays ON barangays.id = applicant_profiles.barangay_id
            LEFT JOIN attendance_records ON attendance_records.training_invitee_id = training_invitees.id
            LEFT JOIN users AS updated_by ON updated_by.id = training_invitees.updated_by_user_id
            ' . implode("\n", $joins) . '
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY users.full_name ASC
        ';

        try {
            $statement = db()->prepare($sql);
            foreach ($params as $key => $value) {
                $statement->bindValue(':' . $key, $value);
            }
            $statement->execute();
            $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $exception) {
            log_database_query_failure('training.program_invitees', $exception, ['program_id' => $programId]);
            return [];
        }

        return array_map(static function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'applicantProfileId' => (int) $row['applicant_profile_id'],
                'beneficiaryProfileId' => $row['beneficiary_profile_id'] !== null ? (int) $row['beneficiary_profile_id'] : null,
                'status' => $row['attendance_status'] ?: $row['invite_status'],
                'inviteStatus' => $row['invite_status'],
                'remarks' => $row['attendance_remarks'] ?: $row['remarks'],
                'notifiedAt' => $row['notified_at'],
                'lastNoticeSentAt' => $row['last_notice_sent_at'],
                'postApprovalUnlockedAt' => $row['post_approval_unlocked_at'],
                'checkedInAt' => $row['checked_in_at'],
                'barangay' => $row['barangay_name'],
                'businessName' => $row['business_name'],
                'sector' => $row['sector'],
                'livelihood' => $row['livelihood_type'],
                'updatedByName' => $row['updated_by_name'],
                'user' => [
                    'id' => (int) $row['user_id'],
                    'name' => $row['full_name'],
                    'email' => $row['email'],
                ],
            ];
        }, $rows);
    }

    private function emptyListing(): array
    {
        return [
            'programs' => [],
            'eligibleInvitees' => [],
            'summary' => $this->buildSummary([]),
            'statuses' => TRAINING_ALLOWED_STATUSES,
            'schemaError' => $this->cachedSchemaError,
        ];
    }

    private function validateProgramPayload(array $payload): array
    {
        $normalizedDate = $this->normalizeDate((string) ($payload['date'] ?? ''));
        $normalizedStartTime = $this->normalizeTime((string) ($payload['startTime'] ?? ''));
        $normalizedEndTime = $this->normalizeTime((string) ($payload['endTime'] ?? ''));

        $data = [
            'programName' => trim((string) ($payload['programName'] ?? '')),
            'description' => trim((string) ($payload['description'] ?? '')),
            'venue' => trim((string) ($payload['venue'] ?? '')),
            'date' => $normalizedDate,
            'startTime' => $normalizedStartTime,
            'endTime' => $normalizedEndTime,
            'whatToBring' => trim((string) ($payload['whatToBring'] ?? '')),
            'instructions' => trim((string) ($payload['instructions'] ?? '')),
            'status' => trim((string) ($payload['status'] ?? TRAINING_STATUS_SCHEDULED)),
        ];

        $errors = [];
        if ($data['programName'] === '') {
            $errors['programName'] = 'Program name is required.';
        }
        if ($data['date'] === '') {
            $errors['date'] = 'Training date is required.';
        } elseif ($normalizedDate === '') {
            $errors['date'] = 'Training date format is invalid.';
        }
        if ($data['startTime'] === '' || $data['endTime'] === '') {
            $errors['time'] = 'Start and end time are required.';
        }
        if (($payload['startTime'] ?? '') !== '' && $normalizedStartTime === '') {
            $errors['time'] = 'Start time format is invalid.';
        }
        if (($payload['endTime'] ?? '') !== '' && $normalizedEndTime === '') {
            $errors['time'] = 'End time format is invalid.';
        }
        if ($data['date'] !== '' && $data['startTime'] !== '' && $data['endTime'] !== '') {
            $startStamp = strtotime($data['date'] . ' ' . $data['startTime']);
            $endStamp = strtotime($data['date'] . ' ' . $data['endTime']);
            if ($startStamp === false || $endStamp === false) {
                $errors['time'] = 'Training schedule could not be interpreted.';
            } elseif ($startStamp >= $endStamp) {
                $errors['time'] = 'End time must be after start time.';
            }
        }
        if (!in_array($data['status'], TRAINING_ALLOWED_STATUSES, true)) {
            $errors['status'] = 'Invalid training status.';
        }

        return ['data' => $data, 'errors' => $errors];
    }

    private function normalizeDate(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $formats = ['Y-m-d', 'm/d/Y', 'n/j/Y'];
        foreach ($formats as $format) {
            $date = \DateTimeImmutable::createFromFormat('!' . $format, $value);
            if ($date instanceof \DateTimeImmutable) {
                return $date->format('Y-m-d');
            }
        }

        $timestamp = strtotime($value);
        return $timestamp === false ? '' : date('Y-m-d', $timestamp);
    }

    private function normalizeTime(string $value): string
    {
        $value = trim($value);
        if ($value === '') {
            return '';
        }

        $formats = ['H:i', 'H:i:s', 'g:i A', 'g:i a', 'h:i A', 'h:i a'];
        foreach ($formats as $format) {
            $time = \DateTimeImmutable::createFromFormat('!' . $format, $value);
            if ($time instanceof \DateTimeImmutable) {
                return $time->format('H:i');
            }
        }

        $timestamp = strtotime($value);
        return $timestamp === false ? '' : date('H:i', $timestamp);
    }

    private function buildSummary(array $programs): array
    {
        $summary = [
            'total' => count($programs),
            'scheduled' => 0,
            'notified' => 0,
            'completed' => 0,
            'participants' => 0,
            'attended' => 0,
        ];

        foreach ($programs as $program) {
            $status = strtolower((string) ($program['status'] ?? ''));
            if ($status === strtolower(TRAINING_STATUS_SCHEDULED)) {
                $summary['scheduled']++;
            }
            if ($status === strtolower(TRAINING_STATUS_NOTIFIED)) {
                $summary['notified']++;
            }
            if ($status === strtolower(TRAINING_STATUS_COMPLETED)) {
                $summary['completed']++;
            }
            $summary['participants'] += (int) ($program['participantCount'] ?? 0);
            $summary['attended'] += (int) ($program['completedCount'] ?? 0);
        }

        return $summary;
    }

    private function mapProgramRow(array $row): array
    {
        $startsAt = (string) ($row['starts_at'] ?? '');
        $endsAt = (string) ($row['ends_at'] ?? '');

        return [
            'id' => (int) $row['id'],
            'programName' => $row['title'],
            'title' => $row['title'],
            'description' => $row['description'],
            'venue' => $row['venue'],
            'date' => $startsAt !== '' ? substr($startsAt, 0, 10) : null,
            'startTime' => $startsAt !== '' ? substr($startsAt, 11, 5) : null,
            'endTime' => $endsAt !== '' ? substr($endsAt, 11, 5) : null,
            'startsAt' => $startsAt,
            'endsAt' => $endsAt,
            'whatToBring' => $row['what_to_bring'],
            'instructions' => $row['instructions'],
            'status' => $this->deriveProgramStatus($row),
            'createdBy' => $row['created_by_name'],
            'participantCount' => (int) $row['participant_count'],
            'completedCount' => (int) $row['completed_count'],
            'attendedCount' => (int) ($row['attended_count'] ?? 0),
            'notifiedCount' => (int) ($row['notified_count'] ?? 0),
            'createdAt' => $row['created_at'],
        ];
    }

    private function deriveProgramStatus(array $row): string
    {
        $participants = (int) ($row['participant_count'] ?? 0);
        $completed = (int) ($row['completed_count'] ?? 0);
        $attended = (int) ($row['attended_count'] ?? 0);
        $notified = (int) ($row['notified_count'] ?? 0);

        if ($participants === 0) {
            return $this->normalizeStatus((string) $row['status']);
        }
        if ($completed > 0 && $completed === $participants) {
            return TRAINING_STATUS_COMPLETED;
        }
        if (($completed + $attended) > 0) {
            return TRAINING_STATUS_ATTENDED;
        }
        if ($notified > 0) {
            return TRAINING_STATUS_NOTIFIED;
        }

        return TRAINING_STATUS_SCHEDULED;
    }

    private function findProgram(int $programId, array $actor): ?array
    {
        $list = $this->listPrograms([], $actor)['programs'];
        foreach ($list as $program) {
            if ((int) $program['id'] === $programId) {
                return $program;
            }
        }

        return null;
    }

    private function findScopedInvitee(int $trainingInviteeId, array $actor): ?array
    {
        $params = ['id' => $trainingInviteeId];
        $joins = [];

        if ($this->isProjectOfficer($actor)) {
            $staffProfileId = $this->findStaffProfileIdForUser((int) ($actor['id'] ?? 0));
            if ($staffProfileId === null) {
                return null;
            }

            $joins[] = 'INNER JOIN applicant_profiles ON applicant_profiles.id = training_invitees.applicant_profile_id';
            $joins[] = 'INNER JOIN staff_barangay_assignments AS scope_assignments
                        ON scope_assignments.barangay_id = applicant_profiles.barangay_id
                       AND scope_assignments.staff_profile_id = :scope_staff_profile_id
                       AND scope_assignments.ended_at IS NULL';
            $params['scope_staff_profile_id'] = $staffProfileId;
        }

        $sql = '
            SELECT training_invitees.id
            FROM training_invitees
            ' . implode("\n", $joins) . '
            WHERE training_invitees.id = :id
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

    private function normalizeStatus(string $status): string
    {
        foreach (TRAINING_ALLOWED_STATUSES as $allowed) {
            if (strtolower($allowed) === strtolower($status)) {
                return $allowed;
            }
        }

        return $status;
    }

    private function findStaffProfileIdForUser(int $userId): ?int
    {
        $statement = db()->prepare('SELECT id FROM staff_profiles WHERE user_id = :user_id LIMIT 1');
        $statement->execute(['user_id' => $userId]);
        $value = $statement->fetchColumn();
        return $value !== false ? (int) $value : null;
    }

    private function isAdmin(array $actor): bool
    {
        return str_contains(strtolower((string) ($actor['role'] ?? '')), 'admin');
    }

    private function isProjectOfficer(array $actor): bool
    {
        return str_contains(strtolower((string) ($actor['role'] ?? '')), 'project');
    }
}

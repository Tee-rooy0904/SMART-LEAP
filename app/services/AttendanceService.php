<?php

declare(strict_types=1);

namespace App\Services;

class AttendanceService
{
    private const UNLOCK_STATUSES = [
        TRAINING_STATUS_ATTENDED,
        TRAINING_STATUS_COMPLETED,
    ];

    public function updateInviteeAttendance(int $trainingInviteeId, string $status, ?string $remarks, int $actorUserId): array
    {
        if (!in_array($status, TRAINING_ALLOWED_STATUSES, true)) {
            return ['ok' => false, 'errors' => ['status' => 'Invalid training attendance status.']];
        }

        $invitee = $this->findInvitee($trainingInviteeId);
        if ($invitee === null) {
            return ['ok' => false, 'errors' => ['invitee' => 'Training participant not found.']];
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $checkedInAt = in_array($status, [TRAINING_STATUS_ATTENDED, TRAINING_STATUS_COMPLETED], true) ? date('Y-m-d H:i:s') : null;

            $statement = $pdo->prepare(
                'INSERT INTO attendance_records
                 (training_invitee_id, training_program_id, applicant_profile_id, beneficiary_profile_id, attendance_status, remarks, recorded_by_user_id, checked_in_at)
                 VALUES (:training_invitee_id, :training_program_id, :applicant_profile_id, :beneficiary_profile_id, :attendance_status, :remarks, :recorded_by_user_id, :checked_in_at)
                 ON DUPLICATE KEY UPDATE
                    attendance_status = VALUES(attendance_status),
                    remarks = VALUES(remarks),
                    recorded_by_user_id = VALUES(recorded_by_user_id),
                    checked_in_at = VALUES(checked_in_at),
                    updated_at = CURRENT_TIMESTAMP'
            );
            $statement->execute([
                'training_invitee_id' => $trainingInviteeId,
                'training_program_id' => (int) $invitee['training_program_id'],
                'applicant_profile_id' => (int) $invitee['applicant_profile_id'],
                'beneficiary_profile_id' => $invitee['beneficiary_profile_id'] !== null ? (int) $invitee['beneficiary_profile_id'] : null,
                'attendance_status' => $status,
                'remarks' => $remarks ?: null,
                'recorded_by_user_id' => $actorUserId,
                'checked_in_at' => $checkedInAt,
            ]);

            $pdo->prepare(
                'UPDATE training_invitees
                 SET invite_status = :invite_status, remarks = :remarks, updated_by_user_id = :updated_by_user_id, updated_at = NOW()
                 WHERE id = :id'
            )->execute([
                'invite_status' => $status,
                'remarks' => $remarks ?: null,
                'updated_by_user_id' => $actorUserId,
                'id' => $trainingInviteeId,
            ]);

            if (in_array($status, self::UNLOCK_STATUSES, true)) {
                $this->unlockPostApproval($invitee, $actorUserId);
            } else {
                $this->revokePostApproval($invitee, $actorUserId);
            }

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            log_database_query_failure('training.update_attendance', $exception, [
                'training_invitee_id' => $trainingInviteeId,
                'status' => $status,
            ]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to update attendance right now.']];
        }

        return ['ok' => true];
    }

    private function unlockPostApproval(array $invitee, int $actorUserId): void
    {
        $beneficiaryProfileId = $invitee['beneficiary_profile_id'] !== null
            ? (int) $invitee['beneficiary_profile_id']
            : (new BeneficiaryProfileService())->ensureForApplicantProfile((int) $invitee['applicant_profile_id']);

        if ($beneficiaryProfileId !== null && $beneficiaryProfileId > 0 && (int) $invitee['beneficiary_profile_id'] !== $beneficiaryProfileId) {
            db()->prepare(
                'UPDATE training_invitees
                 SET beneficiary_profile_id = :beneficiary_profile_id, updated_by_user_id = :updated_by_user_id, updated_at = NOW()
                 WHERE id = :id'
            )->execute([
                'beneficiary_profile_id' => $beneficiaryProfileId,
                'updated_by_user_id' => $actorUserId,
                'id' => (int) $invitee['id'],
            ]);

            db()->prepare(
                'UPDATE attendance_records
                 SET beneficiary_profile_id = :beneficiary_profile_id, recorded_by_user_id = :recorded_by_user_id, updated_at = CURRENT_TIMESTAMP
                 WHERE training_invitee_id = :training_invitee_id'
            )->execute([
                'beneficiary_profile_id' => $beneficiaryProfileId,
                'recorded_by_user_id' => $actorUserId,
                'training_invitee_id' => (int) $invitee['id'],
            ]);
        }

        db()->prepare(
            'UPDATE training_invitees
             SET post_approval_unlocked_at = COALESCE(post_approval_unlocked_at, NOW()), updated_by_user_id = :updated_by_user_id, updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'updated_by_user_id' => $actorUserId,
            'id' => (int) $invitee['id'],
        ]);

        if ($beneficiaryProfileId === null || $beneficiaryProfileId <= 0) {
            return;
        }

        $taskTypeIds = $this->ensurePostApprovalTaskTypes();
        $statement = db()->prepare(
            'INSERT INTO post_approval_tasks (beneficiary_profile_id, task_type_id, status, assigned_by_user_id)
             VALUES (:beneficiary_profile_id, :task_type_id, :status, :assigned_by_user_id)
             ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP'
        );

        foreach ($taskTypeIds as $taskTypeId) {
            $statement->execute([
                'beneficiary_profile_id' => $beneficiaryProfileId,
                'task_type_id' => $taskTypeId,
                'status' => 'pending',
                'assigned_by_user_id' => $actorUserId,
            ]);
        }
    }

    private function revokePostApproval(array $invitee, int $actorUserId): void
    {
        db()->prepare(
            'UPDATE training_invitees
             SET post_approval_unlocked_at = NULL, updated_by_user_id = :updated_by_user_id, updated_at = NOW()
             WHERE id = :id'
        )->execute([
            'updated_by_user_id' => $actorUserId,
            'id' => (int) $invitee['id'],
        ]);

        if ($invitee['beneficiary_profile_id'] === null) {
            return;
        }

        $definitions = ['business_plan', 'availment_form', 'validation_form', 'mungkahing_proyekto', 'buhat_sa_pagpanumpa', 'seminar_attendance'];
        $placeholders = implode(',', array_fill(0, count($definitions), '?'));

        $delete = db()->prepare(
            "DELETE post_approval_tasks
             FROM post_approval_tasks
             INNER JOIN post_approval_task_types ON post_approval_task_types.id = post_approval_tasks.task_type_id
             LEFT JOIN post_approval_submissions ON post_approval_submissions.post_approval_task_id = post_approval_tasks.id
             WHERE post_approval_tasks.beneficiary_profile_id = ?
               AND post_approval_task_types.code IN ($placeholders)
               AND post_approval_tasks.status = 'pending'
               AND post_approval_submissions.id IS NULL"
        );
        $delete->bindValue(1, (int) $invitee['beneficiary_profile_id'], \PDO::PARAM_INT);
        foreach ($definitions as $index => $code) {
            $delete->bindValue($index + 2, $code, \PDO::PARAM_STR);
        }
        $delete->execute();
    }

    private function ensurePostApprovalTaskTypes(): array
    {
        $definitions = [
            'business_plan' => 'Business Plan',
            'availment_form' => 'SMART LEAP Availment Form',
            'validation_form' => 'SMART LEAP Validation Form',
            'mungkahing_proyekto' => 'Mungkahing Proyekto',
            'buhat_sa_pagpanumpa' => 'Buhat sa Pagpanumpa',
            'seminar_attendance' => 'Attendance to seminars/trainings conducted',
        ];

        $insert = db()->prepare(
            'INSERT INTO post_approval_task_types (code, label)
             VALUES (:code, :label)
             ON DUPLICATE KEY UPDATE label = VALUES(label), updated_at = CURRENT_TIMESTAMP'
        );
        foreach ($definitions as $code => $label) {
            $insert->execute(['code' => $code, 'label' => $label]);
        }

        $query = db()->query('SELECT id, code FROM post_approval_task_types');
        $rows = $query->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        $ids = [];
        foreach ($rows as $row) {
            if (isset($definitions[$row['code']])) {
                $ids[] = (int) $row['id'];
            }
        }

        return $ids;
    }

    private function findInvitee(int $trainingInviteeId): ?array
    {
        $statement = db()->prepare(
            'SELECT id, training_program_id, applicant_profile_id, beneficiary_profile_id
             FROM training_invitees
             WHERE id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $trainingInviteeId]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }
}

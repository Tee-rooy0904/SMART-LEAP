<?php

declare(strict_types=1);

namespace App\Services;

class BarangayAssignmentService
{
    public function syncAssignments(int $staffUserId, array $barangayIds, int $actorUserId): array
    {
        $staff = $this->findStaffProfile($staffUserId);
        if ($staff === null) {
            return ['ok' => false, 'errors' => ['staffId' => 'Staff profile not found.']];
        }

        if ((string) $staff['role_name'] !== ROLE_PROJECT_OFFICER) {
            return ['ok' => false, 'errors' => ['staffId' => 'Only project officers can receive barangay assignments.']];
        }

        $cleanBarangayIds = array_values(array_unique(array_filter(array_map(static fn ($id): int => (int) $id, $barangayIds))));
        $validBarangayIds = $this->filterExistingBarangayIds($cleanBarangayIds);
        $existingBarangayIds = $this->currentAssignmentBarangayIds((int) $staff['staff_profile_id']);
        $affectedBarangayIds = array_values(array_unique(array_merge($existingBarangayIds, $validBarangayIds)));

        $pdo = db();
        $pdo->beginTransaction();

        try {
            if ($validBarangayIds !== []) {
                $placeholders = implode(',', array_fill(0, count($validBarangayIds), '?'));
                $statement = $pdo->prepare(
                    "UPDATE staff_barangay_assignments
                     SET ended_at = NOW(), updated_at = NOW()
                     WHERE staff_profile_id = ?
                       AND ended_at IS NULL
                       AND barangay_id NOT IN ($placeholders)"
                );
                $statement->bindValue(1, (int) $staff['staff_profile_id'], \PDO::PARAM_INT);
                foreach ($validBarangayIds as $index => $barangayId) {
                    $statement->bindValue($index + 2, $barangayId, \PDO::PARAM_INT);
                }
                $statement->execute();
            } else {
                $pdo->prepare(
                    'UPDATE staff_barangay_assignments
                     SET ended_at = NOW(), updated_at = NOW()
                     WHERE staff_profile_id = :staff_profile_id AND ended_at IS NULL'
                )->execute(['staff_profile_id' => (int) $staff['staff_profile_id']]);
            }

            $insert = $pdo->prepare(
                'INSERT INTO staff_barangay_assignments (staff_profile_id, barangay_id, assigned_at)
                 VALUES (:staff_profile_id, :barangay_id, NOW())'
            );

            foreach ($validBarangayIds as $barangayId) {
                if (in_array($barangayId, $existingBarangayIds, true)) {
                    continue;
                }

                $insert->execute([
                    'staff_profile_id' => (int) $staff['staff_profile_id'],
                    'barangay_id' => $barangayId,
                ]);
            }

            $this->refreshAssignedStaffForBarangays($affectedBarangayIds);
            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            log_database_query_failure('team.sync_barangay_assignments', $exception, [
                'staff_user_id' => $staffUserId,
                'barangay_ids' => $validBarangayIds,
            ]);

            return ['ok' => false, 'errors' => ['general' => 'Unable to update barangay assignments right now.']];
        }

        (new AuditLogService())->record(
            $actorUserId,
            'staff.assignments_synced',
            'staff_profiles',
            (int) $staff['staff_profile_id'],
            ['barangay_ids' => $validBarangayIds]
        );

        return ['ok' => true];
    }

    public function refreshAssignedStaffForBarangays(array $barangayIds): void
    {
        $this->reassignApplicationsForBarangays($barangayIds);
    }

    public function assignedBarangaysForUser(int $userId): array
    {
        $staff = $this->findStaffProfile($userId);
        if ($staff === null) {
            return [];
        }

        $statement = db()->prepare(
            'SELECT barangays.id, barangays.name
             FROM staff_barangay_assignments
             INNER JOIN barangays ON barangays.id = staff_barangay_assignments.barangay_id
             WHERE staff_barangay_assignments.staff_profile_id = :staff_profile_id
               AND staff_barangay_assignments.ended_at IS NULL
             ORDER BY barangays.name ASC'
        );
        $statement->execute(['staff_profile_id' => (int) $staff['staff_profile_id']]);
        $rows = $statement->fetchAll(\PDO::FETCH_ASSOC) ?: [];

        return array_map(
            static fn (array $row): array => ['id' => (int) $row['id'], 'name' => $row['name']],
            $rows
        );
    }

    private function findStaffProfile(int $userId): ?array
    {
        $statement = db()->prepare(
            'SELECT staff_profiles.id AS staff_profile_id, users.id AS user_id, roles.name AS role_name
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             INNER JOIN staff_profiles ON staff_profiles.user_id = users.id
             WHERE users.id = :user_id
             LIMIT 1'
        );
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function filterExistingBarangayIds(array $barangayIds): array
    {
        if ($barangayIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($barangayIds), '?'));
        $statement = db()->prepare("SELECT id FROM barangays WHERE id IN ($placeholders)");
        foreach ($barangayIds as $index => $barangayId) {
            $statement->bindValue($index + 1, $barangayId, \PDO::PARAM_INT);
        }
        $statement->execute();

        return array_map('intval', $statement->fetchAll(\PDO::FETCH_COLUMN) ?: []);
    }

    private function currentAssignmentBarangayIds(int $staffProfileId): array
    {
        $statement = db()->prepare(
            'SELECT barangay_id
             FROM staff_barangay_assignments
             WHERE staff_profile_id = :staff_profile_id AND ended_at IS NULL'
        );
        $statement->execute(['staff_profile_id' => $staffProfileId]);

        return array_map('intval', $statement->fetchAll(\PDO::FETCH_COLUMN) ?: []);
    }

    private function reassignApplicationsForBarangays(array $barangayIds): void
    {
        if ($barangayIds === []) {
            return;
        }

        $placeholders = implode(',', array_fill(0, count($barangayIds), '?'));
        $sql = "
            UPDATE applications
            INNER JOIN applicant_profiles ON applicant_profiles.id = applications.applicant_profile_id
            SET applications.assigned_staff_profile_id = (
                SELECT sba.staff_profile_id
                FROM staff_barangay_assignments AS sba
                INNER JOIN staff_profiles AS sp ON sp.id = sba.staff_profile_id
                INNER JOIN users AS staff_users ON staff_users.id = sp.user_id
                INNER JOIN roles AS staff_roles ON staff_roles.id = staff_users.role_id
                WHERE sba.barangay_id = applicant_profiles.barangay_id
                  AND sba.ended_at IS NULL
                  AND sp.status = 'active'
                  AND staff_users.is_active = 1
                  AND staff_users.is_disabled = 0
                  AND staff_roles.name = ?
                ORDER BY sba.assigned_at ASC, sba.id ASC
                LIMIT 1
            )
            WHERE applicant_profiles.barangay_id IN ($placeholders)
        ";
        $statement = db()->prepare($sql);
        $statement->bindValue(1, ROLE_PROJECT_OFFICER);
        foreach ($barangayIds as $index => $barangayId) {
            $statement->bindValue($index + 2, $barangayId, \PDO::PARAM_INT);
        }
        $statement->execute();
    }
}

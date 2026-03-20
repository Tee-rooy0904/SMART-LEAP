<?php

declare(strict_types=1);

namespace App\Services;

use PDO;
use PDOException;

class TeamService
{
    private const DEFAULT_BARANGAYS = [
        'Ag-ao', 'Agusan Pequeno', 'Ambago', 'Ampayon', 'Anticala', 'Baan KM 3', 'Baan Riverside',
        'Babag', 'Bading', 'Banza', 'Bayanihan', 'Bilay', 'Bitan-agan', 'Bonbon', 'Bugsukan',
        'Buhangin', 'Cabcabon', 'Doongan', 'Dulag', 'Florida', 'Fort Poyohon', 'Golden Ribbon',
        'Holy Redeemer', 'Imadejas', 'J.P. Rizal', 'Kinamlutan', 'Lapu-Lapu', 'Libertad', 'Limaha',
        'Los Angeles', 'Lumbocan', 'Macabalan', 'Mahay', 'Mahogany', 'Maon', 'Maug', 'New Society Village',
        'Nonoy', 'Obrero', 'Ong Yiu', 'Pagatpatan', 'Pianing', 'San Mateo', 'San Vicente', 'Sto. Nino',
        'Sumilihon', 'Tagabaca', 'Taguibo', 'Taligaman', 'Tandang Sora', 'Tiniwisan', 'Tungao', 'Villa Kananga',
    ];

    private const ROLE_MAP = [
        'admin' => ROLE_ADMIN,
        'pdo' => ROLE_PROJECT_OFFICER,
        'social_worker' => ROLE_SOCIAL_WORKER,
    ];

    private const STATUS_MAP = [
        'active' => ['is_active' => 1, 'is_disabled' => 0, 'profile_status' => 'active'],
        'inactive' => ['is_active' => 0, 'is_disabled' => 0, 'profile_status' => 'inactive'],
        'disabled' => ['is_active' => 0, 'is_disabled' => 1, 'profile_status' => 'disabled'],
    ];

    public function listStaff(array $filters = []): array
    {
        $params = [];
        $conditions = ['roles.name IN (:role_admin, :role_pdo, :role_social_worker)'];
        $params['role_admin'] = ROLE_ADMIN;
        $params['role_pdo'] = ROLE_PROJECT_OFFICER;
        $params['role_social_worker'] = ROLE_SOCIAL_WORKER;

        $roleFilter = trim((string) ($filters['role'] ?? ''));
        if ($roleFilter !== '' && isset(self::ROLE_MAP[$roleFilter])) {
            $conditions[] = 'roles.name = :filter_role';
            $params['filter_role'] = self::ROLE_MAP[$roleFilter];
        }

        $statusFilter = trim((string) ($filters['status'] ?? ''));
        if ($statusFilter !== '' && isset(self::STATUS_MAP[$statusFilter])) {
            $conditions[] = 'staff_profiles.status = :filter_status';
            $params['filter_status'] = $statusFilter;
        }

        $search = trim((string) ($filters['search'] ?? ''));
        if ($search !== '') {
            $conditions[] = '(users.full_name LIKE :search OR users.email LIKE :search)';
            $params['search'] = '%' . $search . '%';
        }

        $sql = '
            SELECT
                users.id,
                users.full_name,
                users.email,
                users.is_active,
                users.is_disabled,
                users.last_login_at,
                roles.name AS role_name,
                staff_profiles.id AS staff_profile_id,
                staff_profiles.contact_number,
                staff_profiles.position_title,
                staff_profiles.status AS staff_status
            FROM users
            INNER JOIN roles ON roles.id = users.role_id
            INNER JOIN staff_profiles ON staff_profiles.user_id = users.id
            WHERE ' . implode(' AND ', $conditions) . '
            ORDER BY users.full_name ASC
        ';

        $statement = db()->prepare($sql);
        foreach ($params as $key => $value) {
            $statement->bindValue(':' . $key, $value);
        }
        $statement->execute();
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $assignmentMap = $this->fetchAssignmentMap(array_map(static fn (array $row): int => (int) $row['staff_profile_id'], $rows));

        return array_map(function (array $row) use ($assignmentMap): array {
            $staffProfileId = (int) $row['staff_profile_id'];
            $roleSlug = $this->roleNameToSlug((string) $row['role_name']);
            $status = (string) $row['staff_status'];

            return [
                'id' => (int) $row['id'],
                'staffProfileId' => $staffProfileId,
                'name' => $row['full_name'],
                'email' => $row['email'],
                'role' => $roleSlug,
                'roleLabel' => $row['role_name'],
                'status' => $status,
                'contactNumber' => $row['contact_number'],
                'positionTitle' => $row['position_title'],
                'assignedBarangays' => $assignmentMap[$staffProfileId] ?? [],
                'lastLoginAt' => $row['last_login_at'],
            ];
        }, $rows);
    }

    public function createStaff(array $payload, int $actorUserId): array
    {
        $input = $this->validateStaffPayload($payload, true);
        if ($input['errors'] !== []) {
            return ['ok' => false, 'errors' => $input['errors']];
        }

        $roleName = self::ROLE_MAP[$input['data']['role']];
        $roleId = $this->findRoleIdByName($roleName);
        if ($roleId === null) {
            return ['ok' => false, 'errors' => ['role' => 'Selected role is not configured.']];
        }

        if ($this->findUserByEmail($input['data']['email']) !== null) {
            return ['ok' => false, 'errors' => ['email' => 'Email already exists.']];
        }

        $statusFlags = self::STATUS_MAP[$input['data']['status']];
        $passwordHash = (new PasswordService())->hash($input['data']['password']);

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $statement = $pdo->prepare(
                'INSERT INTO users (role_id, full_name, email, password_hash, verification_status, is_active, is_disabled)
                 VALUES (:role_id, :full_name, :email, :password_hash, :verification_status, :is_active, :is_disabled)'
            );
            $statement->execute([
                'role_id' => $roleId,
                'full_name' => $input['data']['name'],
                'email' => $input['data']['email'],
                'password_hash' => $passwordHash,
                'verification_status' => 'verified',
                'is_active' => $statusFlags['is_active'],
                'is_disabled' => $statusFlags['is_disabled'],
            ]);

            $userId = (int) $pdo->lastInsertId();
            $staffStatement = $pdo->prepare(
                'INSERT INTO staff_profiles (user_id, contact_number, position_title, status)
                 VALUES (:user_id, :contact_number, :position_title, :status)'
            );
            $staffStatement->execute([
                'user_id' => $userId,
                'contact_number' => $input['data']['contactNumber'] ?: null,
                'position_title' => $input['data']['positionTitle'] ?: $roleName,
                'status' => $input['data']['status'],
            ]);

            $staffProfileId = (int) $pdo->lastInsertId();
            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            log_database_query_failure('team.create_staff', $exception, ['email' => $input['data']['email']]);

            return ['ok' => false, 'errors' => ['general' => 'Unable to create staff account right now.']];
        }

        (new AuditLogService())->record(
            $actorUserId,
            'staff.created',
            'users',
            $userId,
            [
                'role' => $input['data']['role'],
                'status' => $input['data']['status'],
                'staff_profile_id' => $staffProfileId,
            ]
        );

        return ['ok' => true];
    }

    public function updateStaff(array $payload, int $actorUserId): array
    {
        $staffId = (int) ($payload['staffId'] ?? 0);
        if ($staffId < 1) {
            return ['ok' => false, 'errors' => ['staffId' => 'Invalid staff account.']];
        }

        $existing = $this->findStaffByUserId($staffId);
        if ($existing === null) {
            return ['ok' => false, 'errors' => ['staffId' => 'Staff account not found.']];
        }

        $input = $this->validateStaffPayload($payload, false);
        if ($input['errors'] !== []) {
            return ['ok' => false, 'errors' => $input['errors']];
        }

        $roleName = self::ROLE_MAP[$input['data']['role']];
        $roleId = $this->findRoleIdByName($roleName);
        if ($roleId === null) {
            return ['ok' => false, 'errors' => ['role' => 'Selected role is not configured.']];
        }

        $duplicate = $this->findUserByEmail($input['data']['email']);
        if ($duplicate !== null && (int) $duplicate['id'] !== $staffId) {
            return ['ok' => false, 'errors' => ['email' => 'Email already exists.']];
        }

        $statusFlags = self::STATUS_MAP[$input['data']['status']];
        $previousBarangayIds = $this->currentAssignmentBarangayIds((int) $existing['staff_profile_id']);
        $pdo = db();
        $pdo->beginTransaction();

        try {
            $fields = [
                'role_id = :role_id',
                'full_name = :full_name',
                'email = :email',
                'is_active = :is_active',
                'is_disabled = :is_disabled',
                'updated_at = NOW()',
            ];
            $params = [
                'role_id' => $roleId,
                'full_name' => $input['data']['name'],
                'email' => $input['data']['email'],
                'is_active' => $statusFlags['is_active'],
                'is_disabled' => $statusFlags['is_disabled'],
                'id' => $staffId,
            ];

            if ($input['data']['password'] !== '') {
                $fields[] = 'password_hash = :password_hash';
                $params['password_hash'] = (new PasswordService())->hash($input['data']['password']);
            }

            $statement = $pdo->prepare('UPDATE users SET ' . implode(', ', $fields) . ' WHERE id = :id');
            $statement->execute($params);

            $staffStatement = $pdo->prepare(
                'UPDATE staff_profiles
                 SET contact_number = :contact_number, position_title = :position_title, status = :status, updated_at = NOW()
                 WHERE user_id = :user_id'
            );
            $staffStatement->execute([
                'contact_number' => $input['data']['contactNumber'] ?: null,
                'position_title' => $input['data']['positionTitle'] ?: $roleName,
                'status' => $input['data']['status'],
                'user_id' => $staffId,
            ]);

            if ($input['data']['role'] !== 'pdo') {
                $pdo->prepare(
                    'UPDATE staff_barangay_assignments
                     SET ended_at = NOW(), updated_at = NOW()
                     WHERE staff_profile_id = :staff_profile_id AND ended_at IS NULL'
                )->execute([
                    'staff_profile_id' => (int) $existing['staff_profile_id'],
                ]);
            }

            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            log_database_query_failure('team.update_staff', $exception, ['staff_id' => $staffId]);

            return ['ok' => false, 'errors' => ['general' => 'Unable to update staff account right now.']];
        }

        if ($input['data']['role'] !== 'pdo' && $previousBarangayIds !== []) {
            (new BarangayAssignmentService())->refreshAssignedStaffForBarangays($previousBarangayIds);
        }

        (new AuditLogService())->record(
            $actorUserId,
            'staff.updated',
            'users',
            $staffId,
            [
                'role' => $input['data']['role'],
                'status' => $input['data']['status'],
            ]
        );

        return ['ok' => true];
    }

    public function updateStaffStatus(int $staffId, string $status, int $actorUserId): array
    {
        if ($staffId < 1 || !isset(self::STATUS_MAP[$status])) {
            return ['ok' => false, 'errors' => ['status' => 'Invalid staff status update.']];
        }

        $existing = $this->findStaffByUserId($staffId);
        if ($existing === null) {
            return ['ok' => false, 'errors' => ['staffId' => 'Staff account not found.']];
        }

        $flags = self::STATUS_MAP[$status];
        $affectedBarangayIds = $this->currentAssignmentBarangayIds((int) $existing['staff_profile_id']);
        $pdo = db();
        $pdo->beginTransaction();

        try {
            $pdo->prepare(
                'UPDATE users SET is_active = :is_active, is_disabled = :is_disabled, updated_at = NOW() WHERE id = :id'
            )->execute([
                'is_active' => $flags['is_active'],
                'is_disabled' => $flags['is_disabled'],
                'id' => $staffId,
            ]);

            $pdo->prepare(
                'UPDATE staff_profiles SET status = :status, updated_at = NOW() WHERE user_id = :user_id'
            )->execute([
                'status' => $status,
                'user_id' => $staffId,
            ]);

            $pdo->commit();
        } catch (PDOException $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            log_database_query_failure('team.update_status', $exception, ['staff_id' => $staffId, 'status' => $status]);
            return ['ok' => false, 'errors' => ['general' => 'Unable to update status right now.']];
        }

        if ($affectedBarangayIds !== []) {
            (new BarangayAssignmentService())->refreshAssignedStaffForBarangays($affectedBarangayIds);
        }

        (new AuditLogService())->record(
            $actorUserId,
            'staff.status_updated',
            'users',
            $staffId,
            ['status' => $status]
        );

        return ['ok' => true];
    }

    public function teamMetadata(): array
    {
        $this->ensureBarangaysSeeded();
        $statement = db()->query('SELECT id, name FROM barangays ORDER BY name ASC');
        $barangays = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'roles' => [
                ['value' => 'admin', 'label' => ROLE_ADMIN],
                ['value' => 'pdo', 'label' => ROLE_PROJECT_OFFICER],
                ['value' => 'social_worker', 'label' => ROLE_SOCIAL_WORKER],
            ],
            'statuses' => [
                ['value' => 'active', 'label' => 'Active'],
                ['value' => 'inactive', 'label' => 'Inactive'],
                ['value' => 'disabled', 'label' => 'Disabled'],
            ],
            'barangays' => array_map(
                static fn (array $row): array => ['id' => (int) $row['id'], 'name' => $row['name']],
                $barangays
            ),
        ];
    }

    private function ensureBarangaysSeeded(): void
    {
        $count = (int) db()->query('SELECT COUNT(*) FROM barangays')->fetchColumn();
        if ($count > 0) {
            return;
        }

        $statement = db()->prepare('INSERT INTO barangays (name) VALUES (:name)');
        foreach (self::DEFAULT_BARANGAYS as $barangay) {
            $statement->execute(['name' => $barangay]);
        }
    }

    private function validateStaffPayload(array $payload, bool $isCreate): array
    {
        $data = [
            'name' => trim((string) ($payload['name'] ?? '')),
            'email' => strtolower(trim((string) ($payload['email'] ?? ''))),
            'role' => trim((string) ($payload['role'] ?? '')),
            'status' => trim((string) ($payload['status'] ?? 'active')),
            'contactNumber' => trim((string) ($payload['contactNumber'] ?? '')),
            'positionTitle' => trim((string) ($payload['positionTitle'] ?? '')),
            'password' => (string) ($payload['password'] ?? ''),
        ];

        $errors = [];
        if (mb_strlen($data['name']) < 3) {
            $errors['name'] = 'Enter the full staff name.';
        }
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Enter a valid email address.';
        }
        if (!isset(self::ROLE_MAP[$data['role']])) {
            $errors['role'] = 'Select a valid staff role.';
        }
        if (!isset(self::STATUS_MAP[$data['status']])) {
            $errors['status'] = 'Select a valid staff status.';
        }
        if ($isCreate && strlen($data['password']) < 8) {
            $errors['password'] = 'Password must be at least 8 characters.';
        }
        if (!$isCreate && $data['password'] !== '' && strlen($data['password']) < 8) {
            $errors['password'] = 'Password must be at least 8 characters.';
        }

        return ['data' => $data, 'errors' => $errors];
    }

    private function roleNameToSlug(string $roleName): string
    {
        return array_search($roleName, self::ROLE_MAP, true) ?: 'admin';
    }

    private function fetchAssignmentMap(array $staffProfileIds): array
    {
        $staffProfileIds = array_values(array_filter(array_unique($staffProfileIds)));
        if ($staffProfileIds === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($staffProfileIds), '?'));
        $statement = db()->prepare(
            "SELECT staff_profile_id, barangays.id AS barangay_id, barangays.name
             FROM staff_barangay_assignments
             INNER JOIN barangays ON barangays.id = staff_barangay_assignments.barangay_id
             WHERE ended_at IS NULL AND staff_profile_id IN ($placeholders)
             ORDER BY barangays.name ASC"
        );
        foreach ($staffProfileIds as $index => $staffProfileId) {
            $statement->bindValue($index + 1, $staffProfileId, PDO::PARAM_INT);
        }
        $statement->execute();
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $map = [];
        foreach ($rows as $row) {
            $map[(int) $row['staff_profile_id']][] = [
                'id' => (int) $row['barangay_id'],
                'name' => $row['name'],
            ];
        }

        return $map;
    }

    private function findRoleIdByName(string $roleName): ?int
    {
        $statement = db()->prepare('SELECT id FROM roles WHERE name = :name LIMIT 1');
        $statement->execute(['name' => $roleName]);
        $value = $statement->fetchColumn();
        return $value !== false ? (int) $value : null;
    }

    private function findUserByEmail(string $email): ?array
    {
        $statement = db()->prepare('SELECT id, email FROM users WHERE email = :email LIMIT 1');
        $statement->execute(['email' => $email]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function findStaffByUserId(int $userId): ?array
    {
        $statement = db()->prepare(
            'SELECT users.id, staff_profiles.id AS staff_profile_id
             FROM users
             INNER JOIN staff_profiles ON staff_profiles.user_id = users.id
             WHERE users.id = :user_id
             LIMIT 1'
        );
        $statement->execute(['user_id' => $userId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    private function currentAssignmentBarangayIds(int $staffProfileId): array
    {
        $statement = db()->prepare(
            'SELECT barangay_id FROM staff_barangay_assignments WHERE staff_profile_id = :staff_profile_id AND ended_at IS NULL'
        );
        $statement->execute(['staff_profile_id' => $staffProfileId]);
        return array_map('intval', $statement->fetchAll(PDO::FETCH_COLUMN) ?: []);
    }
}

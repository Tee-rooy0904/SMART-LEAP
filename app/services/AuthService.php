<?php

declare(strict_types=1);

namespace App\Services;

use PDOException;

class AuthService
{
    public function attempt(string $email, string $password, string $entryPoint = 'staff'): array
    {
        if ($email === '' || $password === '') {
            return [
                'ok' => false,
                'message' => 'Email and password are required.',
            ];
        }

        try {
            $statement = db()->prepare(
                'SELECT users.id, users.full_name, users.email, users.password_hash, users.is_active, users.is_disabled, users.verification_status, roles.name AS role
                 FROM users
                 INNER JOIN roles ON roles.id = users.role_id
                 WHERE users.email = :email
                 LIMIT 1'
            );
            $statement->execute(['email' => strtolower($email)]);
            $user = $statement->fetch();
        } catch (PDOException) {
            return [
                'ok' => false,
                'message' => 'Unable to reach the authentication database.',
            ];
        }

        if (!is_array($user)) {
            return [
                'ok' => false,
                'message' => 'Invalid credentials.',
            ];
        }

        if (!(bool) $user['is_active']) {
            return [
                'ok' => false,
                'message' => 'This account is inactive.',
            ];
        }

        if ((bool) $user['is_disabled']) {
            return [
                'ok' => false,
                'message' => 'This account is disabled. Contact the administrator.',
            ];
        }

        $passwordService = new PasswordService();
        if (!$passwordService->verify($password, (string) $user['password_hash'])) {
            return [
                'ok' => false,
                'message' => 'Invalid credentials.',
            ];
        }

        $authUser = [
            'id' => (int) $user['id'],
            'name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'verification_status' => $user['verification_status'],
        ];

        $roleAccess = $this->checkEntryPointAccess((string) $user['role'], $entryPoint);
        if ($roleAccess !== null) {
            return [
                'ok' => false,
                'message' => $roleAccess,
            ];
        }

        $this->recordLogin((int) $user['id']);

        return [
            'ok' => true,
            'user' => $authUser,
            'redirect' => $this->redirectPathFor($authUser),
        ];
    }

    public function registerApplicant(string $fullName, string $email, string $password): array
    {
        $errors = [];
        $fullName = trim($fullName);
        $email = strtolower(trim($email));

        if (mb_strlen($fullName) < 3) {
            $errors['fullName'] = 'Enter your complete name.';
        }

        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $errors['email'] = 'Enter a valid email address.';
        }

        if (strlen($password) < 8) {
            $errors['password'] = 'Password must be at least 8 characters.';
        } elseif (!preg_match('/[A-Z]/', $password) || !preg_match('/[a-z]/', $password) || !preg_match('/\d/', $password)) {
            $errors['password'] = 'Password must include uppercase, lowercase, and a number.';
        }

        if ($errors !== []) {
            return ['ok' => false, 'errors' => $errors];
        }

        if ($this->findUserByEmail($email) !== null) {
            return [
                'ok' => false,
                'errors' => ['email' => 'This email is already registered.'],
            ];
        }

        $roleId = $this->findRoleIdByName(ROLE_APPLICANT);
        if ($roleId === null) {
            return [
                'ok' => false,
                'errors' => ['general' => 'Applicant role is not configured in the database.'],
            ];
        }

        $passwordService = new PasswordService();
        $passwordHash = $passwordService->hash($password);

        try {
            $statement = db()->prepare(
                'INSERT INTO users (role_id, full_name, email, password_hash, verification_status, is_active, is_disabled)
                 VALUES (:role_id, :full_name, :email, :password_hash, :verification_status, 1, 0)'
            );
            $statement->execute([
                'role_id' => $roleId,
                'full_name' => $fullName,
                'email' => $email,
                'password_hash' => $passwordHash,
                'verification_status' => 'pending',
            ]);
        } catch (PDOException) {
            return [
                'ok' => false,
                'errors' => ['general' => 'Unable to create the account right now.'],
            ];
        }

        $userId = (int) db()->lastInsertId();

        return [
            'ok' => true,
            'user' => [
                'id' => $userId,
                'name' => $fullName,
                'email' => $email,
                'role' => ROLE_APPLICANT,
                'verification_status' => 'pending',
            ],
            'redirect' => 'applicant-dashboard?welcome=1#profile-page',
        ];
    }

    public function redirectPathFor(array $user): string
    {
        $role = strtolower((string) ($user['role'] ?? ''));

        if (str_contains($role, 'admin')) {
            return 'admin';
        }
        if (str_contains($role, 'project')) {
            return 'project-officer';
        }
        if (str_contains($role, 'social')) {
            return 'social-worker';
        }
        if (str_contains($role, 'beneficiary')) {
            return 'beneficiary-dashboard';
        }

        if (str_contains($role, 'applicant')) {
            return 'applicant-dashboard';
        }

        return 'portal';
    }

    public function currentUserFromSession(): ?array
    {
        return auth_user();
    }

    private function checkEntryPointAccess(string $role, string $entryPoint): ?string
    {
        $entryPoint = strtolower(trim($entryPoint));
        $role = strtolower(trim($role));

        if ($entryPoint === 'portal') {
            if (str_contains($role, 'applicant') || str_contains($role, 'beneficiary')) {
                return null;
            }

            return 'This sign-in page is for applicants and beneficiaries only.';
        }

        if ($entryPoint === 'staff') {
            if (str_contains($role, 'admin') || str_contains($role, 'project')) {
                return null;
            }

            return 'This login page is for administrators and project officers only.';
        }

        return null;
    }

    private function recordLogin(int $userId): void
    {
        $statement = db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
        $statement->execute(['id' => $userId]);
    }

    private function findUserByEmail(string $email): ?array
    {
        $statement = db()->prepare(
            'SELECT users.id, users.full_name, users.email, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.email = :email
             LIMIT 1'
        );
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();
        return is_array($user) ? $user : null;
    }

    private function findRoleIdByName(string $name): ?int
    {
        $statement = db()->prepare('SELECT id FROM roles WHERE name = :name LIMIT 1');
        $statement->execute(['name' => $name]);
        $roleId = $statement->fetchColumn();
        return $roleId !== false ? (int) $roleId : null;
    }
}

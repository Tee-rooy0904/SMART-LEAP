<?php

declare(strict_types=1);

namespace App\Services;

use PDO;
use PDOException;

class AuthService
{
    private const VERIFICATION_EXPIRY_MINUTES = 10;
    private const VERIFICATION_RESEND_COOLDOWN_SECONDS = 60;
    private const VERIFICATION_MAX_ATTEMPTS = 5;
    private const CHALLENGE_TYPE_ACCOUNT_ACTIVATION = 'account_activation';
    private const CHALLENGE_TYPE_LOGIN = 'login_2fa';

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

        if ($this->requiresAccountActivation($authUser)) {
            $challenge = $this->issueVerificationChallenge(
                (int) $user['id'],
                (string) $user['email'],
                (string) $user['full_name'],
                self::CHALLENGE_TYPE_ACCOUNT_ACTIVATION
            );

            if (!$challenge['ok']) {
                return [
                    'ok' => false,
                    'message' => $challenge['message'] ?? 'Unable to start account verification right now.',
                ];
            }

            return [
                'ok' => false,
                'requiresVerification' => true,
                'message' => 'Account verification is required before you can continue.',
                'redirect' => 'verify-account?email=' . urlencode((string) $user['email']) . '&mode=activation&entryPoint=' . urlencode($entryPoint),
            ];
        }

        if (!$this->requiresLoginTwoFactor($authUser)) {
            $this->recordLogin((int) $user['id']);

            return [
                'ok' => true,
                'user' => $authUser,
                'redirect' => $this->redirectPathFor($authUser),
            ];
        }

        $challenge = $this->startLoginChallenge((int) $user['id'], (string) $user['email'], (string) $user['full_name']);
        if (!$challenge['ok']) {
            return $challenge;
        }

        return [
            'ok' => false,
            'requiresVerification' => true,
            'message' => 'A verification code was sent to your email. Enter it to complete sign-in.',
            'redirect' => 'verify-account?email=' . urlencode((string) $user['email']) . '&mode=login&entryPoint=' . urlencode($entryPoint),
        ];
    }

    private function startLoginChallenge(int $userId, string $email, string $fullName): array
    {
        $challenge = $this->issueVerificationChallenge(
            $userId,
            $email,
            $fullName,
            self::CHALLENGE_TYPE_LOGIN
        );

        if (!$challenge['ok']) {
            return [
                'ok' => false,
                'message' => $challenge['message'] ?? 'Unable to start two-factor authentication right now.',
            ];
        }

        return ['ok' => true];
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
        $challenge = $this->issueVerificationChallenge($userId, $email, $fullName, self::CHALLENGE_TYPE_ACCOUNT_ACTIVATION);
        if (!$challenge['ok']) {
            return [
                'ok' => false,
                'errors' => ['general' => $challenge['message'] ?? 'Account created, but verification could not be started.'],
            ];
        }

        return [
            'ok' => true,
            'message' => 'Account created. Enter the verification code sent to your email to activate your portal access.',
            'requiresVerification' => true,
            'redirect' => 'verify-account?email=' . urlencode($email) . '&mode=activation&entryPoint=portal',
        ];
    }

    public function redirectPathFor(array $user): string
    {
        $role = strtolower((string) ($user['role'] ?? ''));
        $userId = (int) ($user['id'] ?? 0);

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
            if ($this->needsProfileCompletion($userId)) {
                return 'profile-completion';
            }
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
            if (str_contains($role, 'admin') || str_contains($role, 'project') || str_contains($role, 'social')) {
                return null;
            }

            return 'This login page is for administrators, project officers, and social workers only.';
        }

        return null;
    }

    public function verifyChallenge(string $email, string $code, string $mode = 'activation', string $entryPoint = 'portal'): array
    {
        $email = strtolower(trim($email));
        $code = trim($code);
        $mode = $this->normalizeChallengeMode($mode);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $code === '') {
            return ['ok' => false, 'message' => 'Enter your registered email and six-digit verification code.'];
        }

        $user = $this->findUserByEmail($email);
        if ($user === null) {
            return ['ok' => false, 'message' => 'No SMART LEAP account was found for that email address.'];
        }

        if ($mode === self::CHALLENGE_TYPE_ACCOUNT_ACTIVATION && strtolower((string) ($user['verification_status'] ?? '')) === 'verified') {
            $freshUser = $this->sessionPayloadForUser((int) $user['id']);
            return [
                'ok' => true,
                'message' => 'Your account is already verified.',
                'user' => $freshUser,
                'redirect' => $this->redirectPathFor($freshUser),
            ];
        }

        $this->ensureVerificationChallengeTable();
        $statement = db()->prepare(
            'SELECT id, code_hash, expires_at, attempts, consumed_at
             FROM account_verification_codes
             WHERE user_id = :user_id
               AND challenge_type = :challenge_type
             ORDER BY id DESC
             LIMIT 1'
        );
        $statement->execute([
            'user_id' => (int) $user['id'],
            'challenge_type' => $mode,
        ]);
        $challenge = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($challenge)) {
            return ['ok' => false, 'message' => 'No active verification challenge was found. Request a new code.'];
        }

        if ($challenge['consumed_at'] !== null) {
            return ['ok' => false, 'message' => 'That verification code has already been used. Request a new code.'];
        }

        if (strtotime((string) $challenge['expires_at']) < time()) {
            return ['ok' => false, 'message' => 'That verification code has expired. Request a new code.'];
        }

        if ((int) $challenge['attempts'] >= self::VERIFICATION_MAX_ATTEMPTS) {
            return ['ok' => false, 'message' => 'Too many failed verification attempts. Request a new code.'];
        }

        if (!password_verify($code, (string) $challenge['code_hash'])) {
            db()->prepare(
                'UPDATE account_verification_codes
                 SET attempts = attempts + 1, updated_at = NOW()
                 WHERE id = :id'
            )->execute(['id' => (int) $challenge['id']]);

            return ['ok' => false, 'message' => 'The verification code is incorrect.'];
        }

        $pdo = db();
        $pdo->beginTransaction();

        try {
            $pdo->prepare(
                'UPDATE account_verification_codes
                 SET consumed_at = NOW(), updated_at = NOW()
                 WHERE id = :id'
            )->execute(['id' => (int) $challenge['id']]);

            if ($mode === self::CHALLENGE_TYPE_ACCOUNT_ACTIVATION) {
                $pdo->prepare(
                    'UPDATE users
                     SET verification_status = "verified", updated_at = NOW()
                     WHERE id = :id'
                )->execute(['id' => (int) $user['id']]);
            }

            $pdo->commit();
        } catch (\Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            return ['ok' => false, 'message' => 'Unable to complete account verification right now.'];
        }

        $freshUser = $this->sessionPayloadForUser((int) $user['id']);
        $this->recordLogin((int) $user['id']);

        return [
            'ok' => true,
            'message' => $mode === self::CHALLENGE_TYPE_LOGIN ? 'Two-factor authentication complete.' : 'Your account has been verified.',
            'user' => $freshUser,
            'redirect' => $this->redirectPathFor($freshUser),
        ];
    }

    public function resendVerificationCode(string $email, string $mode = 'activation'): array
    {
        $email = strtolower(trim($email));
        $mode = $this->normalizeChallengeMode($mode);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            return ['ok' => false, 'message' => 'Enter a valid email address.'];
        }

        $user = $this->findUserByEmail($email);
        if ($user === null) {
            return ['ok' => false, 'message' => 'No SMART LEAP account was found for that email address.'];
        }

        if ($mode === self::CHALLENGE_TYPE_ACCOUNT_ACTIVATION && strtolower((string) ($user['verification_status'] ?? '')) === 'verified') {
            return ['ok' => true, 'message' => 'This account is already verified. You can sign in now.'];
        }

        return $this->issueVerificationChallenge((int) $user['id'], (string) $user['email'], (string) $user['full_name'], $mode);
    }

    private function requiresAccountActivation(array $user): bool
    {
        $role = strtolower((string) ($user['role'] ?? ''));
        $status = strtolower((string) ($user['verification_status'] ?? 'pending'));

        return (str_contains($role, 'beneficiary') || str_contains($role, 'applicant')) && $status !== 'verified';
    }

    private function requiresLoginTwoFactor(array $user): bool
    {
        $role = strtolower((string) ($user['role'] ?? ''));
        return str_contains($role, 'beneficiary') || str_contains($role, 'applicant');
    }

    private function issueVerificationChallenge(int $userId, string $email, string $name, string $challengeType): array
    {
        $this->ensureVerificationChallengeTable();

        $statement = db()->prepare(
            'SELECT id, created_at
             FROM account_verification_codes
             WHERE user_id = :user_id
               AND challenge_type = :challenge_type
               AND consumed_at IS NULL
             ORDER BY id DESC
             LIMIT 1'
        );
        $statement->execute([
            'user_id' => $userId,
            'challenge_type' => $challengeType,
        ]);
        $existing = $statement->fetch(PDO::FETCH_ASSOC);
        if (is_array($existing) && isset($existing['created_at'])) {
            $createdAt = strtotime((string) $existing['created_at']);
            if ($createdAt !== false && (time() - $createdAt) < self::VERIFICATION_RESEND_COOLDOWN_SECONDS) {
                return [
                    'ok' => false,
                    'message' => 'Please wait a moment before requesting another verification code.',
                ];
            }
        }

        $code = (string) random_int(100000, 999999);
        $codeHash = password_hash($code, PASSWORD_DEFAULT);
        $expiresAt = date('Y-m-d H:i:s', time() + (self::VERIFICATION_EXPIRY_MINUTES * 60));

        try {
            db()->prepare(
                'INSERT INTO account_verification_codes (user_id, challenge_type, code_hash, expires_at, attempts)
                 VALUES (:user_id, :challenge_type, :code_hash, :expires_at, 0)'
            )->execute([
                'user_id' => $userId,
                'challenge_type' => $challengeType,
                'code_hash' => $codeHash,
                'expires_at' => $expiresAt,
            ]);
        } catch (\Throwable $exception) {
            return [
                'ok' => false,
                'message' => 'Unable to create a verification challenge right now.',
            ];
        }

        $subject = $challengeType === self::CHALLENGE_TYPE_LOGIN
            ? 'SMART LEAP two-factor authentication code'
            : 'SMART LEAP verification code';
        $body = sprintf(
            '<p>Good day %s,</p><p>Your SMART LEAP %s code is <strong style="font-size:1.2rem; letter-spacing:0.18em;">%s</strong>.</p><p>This code expires in %d minutes.</p><p>If you did not request this action, you can ignore this message.</p>',
            htmlspecialchars($name !== '' ? $name : 'Applicant', ENT_QUOTES),
            htmlspecialchars($challengeType === self::CHALLENGE_TYPE_LOGIN ? 'two-factor authentication' : 'verification', ENT_QUOTES),
            htmlspecialchars($code, ENT_QUOTES),
            self::VERIFICATION_EXPIRY_MINUTES
        );
        (new MailService())->send($email, $subject, $body, $userId);
        (new NotificationService())->createInApp(
            $userId,
            $challengeType === self::CHALLENGE_TYPE_LOGIN ? 'Two-factor authentication required' : 'Account verification required',
            $challengeType === self::CHALLENGE_TYPE_LOGIN
                ? 'Enter the six-digit code sent to your email to complete your SMART LEAP sign-in.'
                : 'Enter the six-digit code sent to your email to activate your SMART LEAP portal account.',
            $challengeType === self::CHALLENGE_TYPE_LOGIN ? 'login_2fa' : 'account_verification'
        );

        return [
            'ok' => true,
            'message' => $challengeType === self::CHALLENGE_TYPE_LOGIN
                ? 'A fresh two-factor authentication code was sent to your registered email.'
                : 'A fresh verification code was sent to your registered email.',
        ];
    }

    private function ensureVerificationChallengeTable(): void
    {
        static $ensured = false;
        if ($ensured) {
            return;
        }

        db()->exec(
            'CREATE TABLE IF NOT EXISTS account_verification_codes (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT UNSIGNED NOT NULL,
                challenge_type VARCHAR(40) NOT NULL DEFAULT "account_activation",
                code_hash VARCHAR(255) NOT NULL,
                attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
                expires_at DATETIME NOT NULL,
                consumed_at DATETIME NULL,
                created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                CONSTRAINT fk_account_verification_codes_user FOREIGN KEY (user_id) REFERENCES users(id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );

        $ensured = true;
    }

    private function normalizeChallengeMode(string $mode): string
    {
        $normalized = strtolower(trim($mode));
        return $normalized === 'login' || $normalized === self::CHALLENGE_TYPE_LOGIN
            ? self::CHALLENGE_TYPE_LOGIN
            : self::CHALLENGE_TYPE_ACCOUNT_ACTIVATION;
    }

    private function recordLogin(int $userId): void
    {
        $statement = db()->prepare('UPDATE users SET last_login_at = NOW() WHERE id = :id');
        $statement->execute(['id' => $userId]);
    }

    private function findUserByEmail(string $email): ?array
    {
        $statement = db()->prepare(
            'SELECT users.id, users.full_name, users.email, users.verification_status, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.email = :email
             LIMIT 1'
        );
        $statement->execute(['email' => $email]);
        $user = $statement->fetch();
        return is_array($user) ? $user : null;
    }

    private function sessionPayloadForUser(int $userId): array
    {
        $statement = db()->prepare(
            'SELECT users.id, users.full_name, users.email, users.verification_status, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => $userId]);
        $user = $statement->fetch(PDO::FETCH_ASSOC);
        if (!is_array($user)) {
            throw new \RuntimeException('User session payload could not be resolved.');
        }

        return [
            'id' => (int) $user['id'],
            'name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'verification_status' => $user['verification_status'],
        ];
    }

    private function findRoleIdByName(string $name): ?int
    {
        $statement = db()->prepare('SELECT id FROM roles WHERE name = :name LIMIT 1');
        $statement->execute(['name' => $name]);
        $roleId = $statement->fetchColumn();
        return $roleId !== false ? (int) $roleId : null;
    }

    private function needsProfileCompletion(int $userId): bool
    {
        if ($userId <= 0) {
            return false;
        }

        $statement = db()->prepare(
            'SELECT applicant_profiles.id
             FROM applicant_profiles
             WHERE applicant_profiles.user_id = :user_id
             LIMIT 1'
        );
        $statement->execute(['user_id' => $userId]);

        return $statement->fetchColumn() === false;
    }
}

<?php

declare(strict_types=1);

function auth_user(): ?array
{
    $sessionUser = session_get('auth.user');
    if (!is_array($sessionUser) || !isset($sessionUser['id'])) {
        return null;
    }

    try {
        $statement = db()->prepare(
            'SELECT users.id, users.full_name, users.email, users.verification_status, users.is_active, users.is_disabled, roles.name AS role
             FROM users
             INNER JOIN roles ON roles.id = users.role_id
             WHERE users.id = :id
             LIMIT 1'
        );
        $statement->execute(['id' => (int) $sessionUser['id']]);
        $user = $statement->fetch();
    } catch (\Throwable) {
        return $sessionUser;
    }

    if (!is_array($user) || !(bool) $user['is_active'] || (bool) $user['is_disabled']) {
        logout_user();
        return null;
    }

    $freshUser = [
        'id' => (int) $user['id'],
        'name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role'],
        'verification_status' => $user['verification_status'],
    ];
    session_put('auth.user', $freshUser);

    return $freshUser;
}

function is_authenticated(): bool
{
    return auth_user() !== null;
}

function login_user(array $user): void
{
    session_put('auth.user', $user);
}

function logout_user(): void
{
    session_forget('auth.user');
}

function has_role(string ...$roles): bool
{
    $user = auth_user();
    if (!$user) {
        return false;
    }

    $role = $user['role'] ?? null;
    return is_string($role) && in_array($role, $roles, true);
}

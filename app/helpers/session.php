<?php

declare(strict_types=1);

function ensure_session_started(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $session = config('session');
    session_name($session['name']);
    session_set_cookie_params([
        'lifetime' => $session['lifetime'],
        'path' => $session['path'],
        'domain' => $session['domain'],
        'secure' => $session['secure'],
        'httponly' => $session['httponly'],
        'samesite' => $session['samesite'],
    ]);

    session_start();
}

function session_get(string $key, mixed $default = null): mixed
{
    ensure_session_started();
    return $_SESSION[$key] ?? $default;
}

function session_put(string $key, mixed $value): void
{
    ensure_session_started();
    $_SESSION[$key] = $value;
}

function session_forget(string $key): void
{
    ensure_session_started();
    unset($_SESSION[$key]);
}
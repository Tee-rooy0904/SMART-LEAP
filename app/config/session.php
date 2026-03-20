<?php

declare(strict_types=1);

return [
    'name' => $_ENV['SESSION_NAME'] ?? 'smartleap_session',
    'lifetime' => (int) ($_ENV['SESSION_LIFETIME'] ?? 7200),
    'path' => '/',
    'domain' => $_ENV['SESSION_DOMAIN'] ?? '',
    'secure' => filter_var($_ENV['SESSION_SECURE'] ?? false, FILTER_VALIDATE_BOOL),
    'httponly' => true,
    'samesite' => $_ENV['SESSION_SAMESITE'] ?? 'Lax',
];
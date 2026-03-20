<?php

declare(strict_types=1);

use App\Controllers\AuthController;

return [
    'POST /auth/login' => ['handler' => [AuthController::class, 'login']],
    'POST /auth/logout' => ['handler' => [AuthController::class, 'logout'], 'middleware' => ['auth']],
];

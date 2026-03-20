<?php

declare(strict_types=1);

use App\Controllers\StaffAssignmentController;
use App\Controllers\TeamController;

return [
    'GET /api/team' => ['handler' => [TeamController::class, 'index'], 'middleware' => ['auth', 'admin']],
    'POST /api/team' => ['handler' => [TeamController::class, 'store'], 'middleware' => ['auth', 'admin']],
    'POST /api/team/update' => ['handler' => [TeamController::class, 'update'], 'middleware' => ['auth', 'admin']],
    'POST /api/team/status' => ['handler' => [TeamController::class, 'updateStatus'], 'middleware' => ['auth', 'admin']],
    'POST /api/team/assignments' => ['handler' => [StaffAssignmentController::class, 'sync'], 'middleware' => ['auth', 'admin']],
];

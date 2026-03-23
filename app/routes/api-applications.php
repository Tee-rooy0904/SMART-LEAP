<?php

declare(strict_types=1);

use App\Controllers\ApplicationController;

return [
    'GET /api/applications' => ['handler' => [ApplicationController::class, 'index'], 'middleware' => ['auth']],
    'GET /api/applications/dashboard' => ['handler' => [ApplicationController::class, 'dashboard'], 'middleware' => ['auth', 'project_officer']],
    'GET /api/applications/show' => ['handler' => [ApplicationController::class, 'show'], 'middleware' => ['auth']],
    'POST /api/applications/review' => ['handler' => [ApplicationController::class, 'review'], 'middleware' => ['auth']],
    'POST /api/applications/review-requirement' => ['handler' => [ApplicationController::class, 'reviewRequirement'], 'middleware' => ['auth']],
];

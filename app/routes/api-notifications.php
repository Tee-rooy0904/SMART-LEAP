<?php

declare(strict_types=1);

use App\Controllers\NotificationController;

return [
    'GET /api/notifications' => ['handler' => [NotificationController::class, 'index'], 'middleware' => ['auth']],
];

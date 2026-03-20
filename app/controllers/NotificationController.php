<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\NotificationService;

class NotificationController extends Controller
{
    public function index(): never
    {
        $user = auth_user();
        if (!$user) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.', 'redirect' => 'login'], 401);
        }

        $service = new NotificationService();
        response_json([
            'ok' => true,
            'notifications' => $service->listForUser((int) $user['id']),
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\TeamService;

class TeamController extends Controller
{
    public function index(): never
    {
        $service = new TeamService();
        response_json([
            'ok' => true,
            'staff' => $service->listStaff($_GET),
            'meta' => $service->teamMetadata(),
        ]);
    }

    public function store(): never
    {
        $service = new TeamService();
        $result = $service->createStaff($_POST, (int) (auth_user()['id'] ?? 0));
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json([
            'ok' => true,
            'staff' => $service->listStaff(),
        ], 201);
    }

    public function update(): never
    {
        $service = new TeamService();
        $result = $service->updateStaff($_POST, (int) (auth_user()['id'] ?? 0));
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json([
            'ok' => true,
            'staff' => $service->listStaff(),
        ]);
    }

    public function updateStatus(): never
    {
        $service = new TeamService();
        $result = $service->updateStaffStatus(
            (int) ($_POST['staffId'] ?? 0),
            trim((string) ($_POST['status'] ?? '')),
            (int) (auth_user()['id'] ?? 0)
        );
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json([
            'ok' => true,
            'staff' => $service->listStaff(),
        ]);
    }
}

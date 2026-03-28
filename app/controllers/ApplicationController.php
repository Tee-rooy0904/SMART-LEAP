<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\ApplicationService;

class ApplicationController extends Controller
{
    private function authorizeReviewer(): array
    {
        $user = auth_user() ?? [];
        $role = strtolower((string) ($user['role'] ?? ''));
        if (!str_contains($role, 'admin') && !str_contains($role, 'project') && !str_contains($role, 'social')) {
            response_json(['ok' => false, 'message' => 'Forbidden.'], 403);
        }

        return $user;
    }

    public function index(): never
    {
        $service = new ApplicationService();
        $user = $this->authorizeReviewer();
        response_json([
            'ok' => true,
            'data' => $service->listApplications($_GET, $user),
        ]);
    }

    public function dashboard(): never
    {
        $service = new ApplicationService();
        response_json([
            'ok' => true,
            'data' => $service->currentProjectOfficerRoster(auth_user() ?? []),
        ]);
    }

    public function show(): never
    {
        $applicationId = (int) ($_GET['id'] ?? 0);
        $service = new ApplicationService();
        $detail = $service->getApplicationDetail($applicationId, $this->authorizeReviewer());
        if ($detail === null) {
            response_json(['ok' => false, 'message' => 'Application not found.'], 404);
        }

        response_json([
            'ok' => true,
            'application' => $detail,
        ]);
    }

    public function review(): never
    {
        $applicationId = (int) ($_POST['applicationId'] ?? 0);
        $service = new ApplicationService();
        $result = $service->reviewApplication($applicationId, $_POST, $this->authorizeReviewer());
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }

    public function reviewRequirement(): never
    {
        $applicationId = (int) ($_POST['applicationId'] ?? 0);
        $service = new ApplicationService();
        $result = $service->reviewRequirement($applicationId, $_POST, $this->authorizeReviewer());
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }

    public function saveAssessment(): never
    {
        $applicationId = (int) ($_POST['applicationId'] ?? 0);
        $service = new ApplicationService();
        $result = $service->saveAssessment($applicationId, $_POST, $this->authorizeReviewer());
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }

}

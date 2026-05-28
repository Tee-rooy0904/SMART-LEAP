<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\StageOneRegistrationService;

class StageOneRegistrationController extends Controller
{
    public function show(): never
    {
        $this->view('public/stage-one-registration');
    }

    public function submit(): never
    {
        $service = new StageOneRegistrationService();
        $result = $service->submit($_POST, $_FILES);
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result, 201);
    }

    public function index(): never
    {
        response_json([
            'ok' => true,
            'data' => (new StageOneRegistrationService())->validationState(),
        ]);
    }

    public function showRecord(): never
    {
        $registrationId = (int) ($_GET['id'] ?? 0);
        $record = (new StageOneRegistrationService())->getRegistrationDetail($registrationId);
        if ($record === null) {
            response_json(['ok' => false, 'message' => 'Stage 1 registration not found.'], 404);
        }

        response_json([
            'ok' => true,
            'registration' => $record,
        ]);
    }

    public function review(): never
    {
        $registrationId = (int) ($_POST['registrationId'] ?? 0);
        $action = (string) ($_POST['action'] ?? '');
        $result = (new StageOneRegistrationService())->reviewRegistration($registrationId, $action, auth_user() ?? []);
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }

    public function resendSelectionEmail(): never
    {
        $registrationId = (int) ($_POST['registrationId'] ?? 0);
        $result = (new StageOneRegistrationService())->resendSelectionEmail($registrationId, auth_user() ?? []);
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }
}

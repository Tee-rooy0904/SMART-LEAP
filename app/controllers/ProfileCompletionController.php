<?php

declare(strict_types=1);

namespace App\Controllers;

class ProfileCompletionController extends Controller
{
    public function show(): never
    {
        if (!is_authenticated()) {
            $this->redirectTo('login');
        }

        $target = 'applicant-dashboard#profile-page';
        if (isset($_GET['welcome']) && trim((string) $_GET['welcome']) !== '') {
            $target = 'applicant-dashboard?welcome=' . urlencode((string) $_GET['welcome']) . '#profile-page';
        }

        $this->redirectTo($target);
    }

    public function state(): never
    {
        $user = auth_user();
        if ($user === null) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $service = new \App\Services\ApplicationService();
        response_json([
            'ok' => true,
            'data' => $service->getApplicantEntryState((int) $user['id']),
        ]);
    }

    public function saveDraft(): never
    {
        $this->persist(false);
    }

    public function submit(): never
    {
        $this->persist(true);
    }

    private function persist(bool $submit): never
    {
        $user = auth_user();
        if ($user === null) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $service = new \App\Services\ApplicationService();
        $result = $service->saveApplicantProfile(
            (int) $user['id'],
            $_POST,
            $_FILES['documents'] ?? [],
            $submit
        );

        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }
}

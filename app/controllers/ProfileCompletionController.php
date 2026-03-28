<?php

declare(strict_types=1);

namespace App\Controllers;

class ProfileCompletionController extends Controller
{
    public function show(): never
    {
        $user = auth_user();
        if ($user === null) {
            $this->redirectTo('login');
        }

        if (str_contains(strtolower((string) ($user['role'] ?? '')), 'beneficiary')) {
            $this->redirectTo('beneficiary-dashboard');
        }

        $this->view('public/profile-completion');
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

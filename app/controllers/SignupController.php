<?php

declare(strict_types=1);

namespace App\Controllers;

class SignupController extends Controller
{
    public function show(): never
    {
        $this->view('public/signup');
    }

    public function register(): never
    {
        $service = new \App\Services\AuthService();
        $result = $service->registerApplicant(
            (string) ($_POST['fullName'] ?? ''),
            (string) ($_POST['email'] ?? ''),
            (string) ($_POST['password'] ?? '')
        );

        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result, 201);
    }
}

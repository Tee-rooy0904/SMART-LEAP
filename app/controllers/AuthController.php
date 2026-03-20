<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;

class AuthController extends Controller
{
    public function showLogin(): never
    {
        $service = new AuthService();
        $currentUser = $service->currentUserFromSession();
        if ($currentUser !== null) {
            $this->redirectTo($service->redirectPathFor($currentUser));
        }

        $this->view('public/login');
    }

    public function login(): never
    {
        $service = new AuthService();
        $email = trim((string) ($_POST['email'] ?? ''));
        $password = (string) ($_POST['password'] ?? '');
        $entryPoint = trim((string) ($_POST['entryPoint'] ?? 'staff'));

        $result = $service->attempt($email, $password, $entryPoint);
        if (!$result['ok']) {
            response_json($result, 422);
        }

        ensure_session_started();
        session_regenerate_id(true);
        login_user($result['user']);

        response_json($result);
    }

    public function logout(): never
    {
        $service = new AuthService();
        $currentUser = $service->currentUserFromSession();
        $redirect = $this->logoutRedirectPathFor($currentUser);

        ensure_session_started();
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $params = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'], $params['httponly']);
        }
        session_destroy();

        $expectsJson = str_contains(strtolower((string) ($_SERVER['HTTP_ACCEPT'] ?? '')), 'application/json')
            || strtolower((string) ($_SERVER['HTTP_X_REQUESTED_WITH'] ?? '')) === 'xmlhttprequest';

        if ($expectsJson) {
            response_json(['ok' => true, 'redirect' => $redirect]);
        }

        redirect($redirect);
    }

    private function logoutRedirectPathFor(?array $user): string
    {
        $role = strtolower((string) ($user['role'] ?? ''));

        if (str_contains($role, 'applicant') || str_contains($role, 'beneficiary')) {
            return 'portal';
        }

        return 'login';
    }
}

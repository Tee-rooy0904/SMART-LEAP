<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\ApplicantDashboardService;
use App\Services\CertificateService;

class ApplicantDashboardController extends Controller
{
    public function show(): never
    {
        $this->view('dashboards/applicant', [
            'authUser' => auth_user(),
        ]);
    }

    public function showPostApproval(): never
    {
        $this->redirectTo('applicant-dashboard#application-forms');
    }

    public function showPostApprovalForm(): never
    {
        $code = trim((string) ($_GET['code'] ?? ''));
        if ($code === '' || !preg_match('/^[a-z0-9_]+$/i', $code)) {
            $this->redirectTo('applicant-dashboard#application-forms');
        }

        $this->view('dashboards/post-approval-form', [
            'authUser' => auth_user(),
            'taskCode' => $code,
        ]);
    }

    public function state(): never
    {
        $user = auth_user();
        if ($user === null) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.', 'redirect' => 'portal'], 401);
        }

        $service = new ApplicantDashboardService();
        response_json([
            'ok' => true,
            'state' => $service->stateForUser((int) $user['id']),
        ]);
    }

    public function downloadCertificate(): never
    {
        $user = auth_user();
        if ($user === null) {
            $this->redirectTo('portal');
        }

        $dashboard = (new ApplicantDashboardService())->stateForUser((int) $user['id']);
        $certificateState = $dashboard['certificate'] ?? [];
        if (!($certificateState['eligible'] ?? false)) {
            http_response_code(403);
            header('Content-Type: text/plain; charset=UTF-8');
            echo 'Certificate is not available yet.';
            exit;
        }

        $certificate = (new CertificateService())->generatePdf($certificateState);
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="' . addslashes((string) ($certificate['fileName'] ?? 'smart-leap-certificate.pdf')) . '"');
        header('Content-Length: ' . strlen((string) $certificate['contents']));
        echo $certificate['contents'];
        exit;
    }
}

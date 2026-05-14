<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\BeneficiaryProfileService;
use App\Services\CoMakerRegistrationService;
use App\Services\ApplicationService;
use App\Services\RepaymentLedgerService;
use App\Services\ReportService;

class ProjectOfficerController extends Controller
{
    public function show(): never
    {
        $authUser = auth_user();
        $this->view('dashboards/project-officer', [
            'authUser' => $authUser,
            'overview' => $authUser !== null ? (new ApplicationService())->currentProjectOfficerRoster($authUser) : [],
            'repaymentData' => $authUser !== null ? (new RepaymentLedgerService())->listForProjectOfficer($authUser) : ['payments' => []],
        ]);
    }

    public function updateBeneficiaryStatus(): never
    {
        $user = auth_user();
        if ($user === null) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $beneficiaryProfileId = (int) ($_POST['beneficiaryProfileId'] ?? $_POST['beneficiary_profile_id'] ?? 0);
        $status = trim((string) ($_POST['status'] ?? ''));

        $result = (new BeneficiaryProfileService())->updateProjectOfficerRecord($user, $beneficiaryProfileId, $status);
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }

    public function recordBeneficiaryAssistanceReceived(): never
    {
        $user = auth_user();
        if ($user === null) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $beneficiaryProfileId = (int) ($_POST['beneficiaryProfileId'] ?? $_POST['beneficiary_profile_id'] ?? 0);
        $result = (new BeneficiaryProfileService())->recordAssistanceReceivedForProjectOfficerRecord($user, $beneficiaryProfileId);
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }

    public function reviewCoMakerRegistration(): never
    {
        $user = auth_user();
        if ($user === null) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $registrationId = (int) ($_POST['registrationId'] ?? $_POST['coMakerRegistrationId'] ?? 0);
        $decision = trim((string) ($_POST['decision'] ?? ''));
        $result = (new CoMakerRegistrationService())->reviewForActor($user, $registrationId, $decision);
        if (!$result['ok']) {
            response_json($result, 422);
        }

        response_json($result);
    }

    public function reportData(): never
    {
        $user = auth_user();
        if ($user === null) {
            response_json(['ok' => false, 'message' => 'Unauthenticated.'], 401);
        }

        $overview = (new ApplicationService())->currentProjectOfficerRoster($user);
        $beneficiaryIds = array_values(array_filter(array_map(
            static fn(array $row): int => (int) ($row['id'] ?? 0),
            is_array($overview['beneficiaryRoster'] ?? null) ? $overview['beneficiaryRoster'] : []
        )));

        response_json([
            'ok' => true,
            'data' => (new ReportService())->buildForBeneficiaryIds($beneficiaryIds, $this->reportFiltersFromRequest()),
        ]);
    }

    private function reportFiltersFromRequest(): array
    {
        return [
            'from' => $_GET['from'] ?? '',
            'to' => $_GET['to'] ?? '',
            'barangay' => $_GET['barangay'] ?? '',
            'serviceType' => $_GET['serviceType'] ?? ($_GET['businessType'] ?? ''),
            'businessType' => $_GET['businessType'] ?? ($_GET['serviceType'] ?? ''),
            'sector' => $_GET['sector'] ?? '',
            'gender' => $_GET['gender'] ?? '',
            'ageGroup' => $_GET['ageGroup'] ?? '',
            'pdo' => $_GET['pdo'] ?? '',
            'repayment' => $_GET['repayment'] ?? '',
            'period' => $_GET['period'] ?? '',
            'month' => $_GET['month'] ?? '',
            'quarter' => $_GET['quarter'] ?? '',
            'year' => $_GET['year'] ?? '',
        ];
    }
}

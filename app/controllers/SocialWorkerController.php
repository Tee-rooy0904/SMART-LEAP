<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\DashboardMetricsService;

class SocialWorkerController extends Controller
{
    public function show(): never
    {
        $this->view('dashboards/social-worker', [
            'authUser' => auth_user(),
            'overview' => (new DashboardMetricsService())->socialWorkerOverview(),
        ]);
    }
}

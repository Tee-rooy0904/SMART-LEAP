<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Services\DashboardMetricsService;

class AdminDashboardController extends Controller
{
    public function show(): never
    {
        $this->view('dashboards/admin', [
            'authUser' => auth_user(),
            'overview' => (new DashboardMetricsService())->adminOverview(),
        ]);
    }
}

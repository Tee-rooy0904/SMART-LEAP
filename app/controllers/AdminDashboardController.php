<?php

declare(strict_types=1);

namespace App\Controllers;

class AdminDashboardController extends Controller
{
    public function show(): never
    {
        $this->view('dashboards/admin');
    }
}
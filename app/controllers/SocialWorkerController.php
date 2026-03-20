<?php

declare(strict_types=1);

namespace App\Controllers;

class SocialWorkerController extends Controller
{
    public function show(): never
    {
        $this->view('dashboards/social-worker');
    }
}
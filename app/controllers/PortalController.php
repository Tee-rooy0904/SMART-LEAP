<?php

declare(strict_types=1);

namespace App\Controllers;

class PortalController extends Controller
{
    public function show(): never
    {
        $this->view('public/portal');
    }
}
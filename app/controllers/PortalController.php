<?php

declare(strict_types=1);

namespace App\Controllers;

class PortalController extends Controller
{
    public function show(): never
    {
        $this->view('public/portal');
    }

    public function showGuide(): never
    {
        $this->view('public/guide');
    }

    public function showRequirements(): never
    {
        $requirements = [];
        try {
            $requirements = \App\Models\InitialRequirementType::all();
        } catch (\Throwable $e) {
            // Graceful fallback
        }
        $this->view('public/requirements', ['requirements' => $requirements]);
    }

    public function showHowItWorks(): never
    {
        $this->view('public/how-it-works');
    }

    public function showHelp(): never
    {
        $this->view('public/help');
    }
}

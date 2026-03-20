<?php

declare(strict_types=1);

namespace App\Controllers;

class ProjectOfficerController extends Controller
{
    public function show(): never
    {
        $this->view('dashboards/project-officer', [
            'authUser' => auth_user(),
        ]);
    }
}

<?php

declare(strict_types=1);

use App\Controllers\AdminDashboardController;
use App\Controllers\ApplicantDashboardController;
use App\Controllers\AuthController;
use App\Controllers\BeneficiaryDashboardController;
use App\Controllers\PortalController;
use App\Controllers\PostApprovalReviewController;
use App\Controllers\ProfileCompletionController;
use App\Controllers\ProjectOfficerController;
use App\Controllers\SignupController;
use App\Controllers\SocialWorkerController;

return [
    'GET /' => ['handler' => [AuthController::class, 'showLogin'], 'middleware' => ['guest']],
    'GET /login' => ['handler' => [AuthController::class, 'showLogin'], 'middleware' => ['guest']],
    'GET /portal' => ['handler' => [PortalController::class, 'show']],
    'GET /portal/guide' => ['handler' => [PortalController::class, 'showGuide']],
    'GET /portal/requirements' => ['handler' => [PortalController::class, 'showRequirements']],
    'GET /portal/how-it-works' => ['handler' => [PortalController::class, 'showHowItWorks']],
    'GET /portal/help' => ['handler' => [PortalController::class, 'showHelp']],
    'GET /signup' => ['handler' => [SignupController::class, 'show'], 'middleware' => ['guest']],
    'POST /signup' => ['handler' => [SignupController::class, 'register'], 'middleware' => ['guest']],
    'GET /profile-completion' => ['handler' => [ProfileCompletionController::class, 'show'], 'middleware' => ['auth', 'applicant']],
    'GET /profile-completion/state' => ['handler' => [ProfileCompletionController::class, 'state'], 'middleware' => ['auth', 'applicant']],
    'POST /profile-completion/save' => ['handler' => [ProfileCompletionController::class, 'saveDraft'], 'middleware' => ['auth', 'applicant']],
    'POST /profile-completion/submit' => ['handler' => [ProfileCompletionController::class, 'submit'], 'middleware' => ['auth', 'applicant']],
    'GET /admin' => ['handler' => [AdminDashboardController::class, 'show'], 'middleware' => ['auth', 'admin']],
    'GET /project-officer' => ['handler' => [ProjectOfficerController::class, 'show'], 'middleware' => ['auth', 'project_officer']],
    'GET /social-worker' => ['handler' => [SocialWorkerController::class, 'show'], 'middleware' => ['auth', 'social_worker']],
    'GET /applicant-dashboard' => ['handler' => [ApplicantDashboardController::class, 'show'], 'middleware' => ['auth', 'applicant']],
    'GET /applicant-dashboard/state' => ['handler' => [ApplicantDashboardController::class, 'state'], 'middleware' => ['auth', 'applicant']],
    'GET /applicant-dashboard/certificate/download' => ['handler' => [ApplicantDashboardController::class, 'downloadCertificate'], 'middleware' => ['auth', 'applicant']],
    'GET /post-approval' => ['handler' => [ApplicantDashboardController::class, 'showPostApproval'], 'middleware' => ['auth', 'applicant']],
    'GET /post-approval-form' => ['handler' => [ApplicantDashboardController::class, 'showPostApprovalForm'], 'middleware' => ['auth', 'applicant']],
    'GET /post-approval-review' => ['handler' => [PostApprovalReviewController::class, 'show'], 'middleware' => ['auth']],
    'GET /beneficiary-dashboard' => ['handler' => [BeneficiaryDashboardController::class, 'show'], 'middleware' => ['auth', 'beneficiary']],
];

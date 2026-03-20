<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<?php /** @var string $taskCode */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Post-Approval Form</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/applicant.css">
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/post-approval.css">
</head>
<body class="post-approval-form-page">
    <script>
        window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        window.SMARTLEAP_POST_APPROVAL_CODE = <?= json_encode($taskCode, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    </script>

    <div class="dashboard-shell">
        <aside class="dash-sidebar" aria-label="Applicant navigation">
            <div class="sidebar-brand">
                <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="sidebar-logo">
                <div class="sidebar-brand__copy">
                    <strong class="sidebar-title">SMART LEAP</strong>
                </div>
            </div>

            <div class="sidebar-user">
                <div class="sidebar-avatar" id="sidebarAvatar" aria-hidden="true">A</div>
                <div class="sidebar-user__meta">
                    <span class="sidebar-user__name" id="sidebarUserName">Applicant</span>
                    <span class="sidebar-user__biz" id="sidebarUserBusiness">Form workspace</span>
                </div>
            </div>

            <button type="button" class="btn-outline sidebar-toggle" id="sidebarToggle">Menu</button>

            <nav class="sidebar-nav">
                <a class="sidebar-link" href="<?= $baseUrl ?>/applicant-dashboard#overview"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M3 11.5L12 4l9 7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5V20h13V10.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Overview</span></a>
                <a class="sidebar-link" href="<?= $baseUrl ?>/applicant-dashboard#profile-summary"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><circle cx="12" cy="8" r="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20a8 8 0 0116 0" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Profile</span></a>
                <a class="sidebar-link" href="<?= $baseUrl ?>/applicant-dashboard#requirements-progress"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M8 7h8" stroke-linecap="round"/><path d="M8 12h8" stroke-linecap="round"/><path d="M8 17h5" stroke-linecap="round"/><rect x="5" y="3" width="14" height="18" rx="2" stroke-linejoin="round"/></svg></span><span>Requirements</span></a>
                <a class="sidebar-link" href="<?= $baseUrl ?>/applicant-dashboard#application-status"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M6 12l4 4L18 8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Status &amp; Remarks</span></a>
                <a class="sidebar-link" href="<?= $baseUrl ?>/applicant-dashboard#training-progress"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M3 9l9-4 9 4-9 4-9-4z" stroke-linejoin="round"/><path d="M7 11v5c0 1.66 2.91 3 5 3s5-1.34 5-3v-5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Training</span></a>
                <a class="sidebar-link is-active" href="<?= $baseUrl ?>/post-approval"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M12 3l7 4v5c0 4.5-2.6 7.9-7 9-4.4-1.1-7-4.5-7-9V7l7-4z" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Post-Approval</span></a>
                <a class="sidebar-link" href="<?= $baseUrl ?>/applicant-dashboard#notifications-panel"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M6 9a6 6 0 1112 0v4l2 3H4l2-3V9z" stroke-linecap="round" stroke-linejoin="round"/><path d="M10 19a2 2 0 004 0" stroke-linecap="round"/></svg></span><span>Notifications</span></a>
                <a class="sidebar-link" href="<?= $baseUrl ?>/applicant-dashboard#support-panel"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M7 7h10a3 3 0 013 3v4a3 3 0 01-3 3h-3l-3 4-3-4H7a3 3 0 01-3-3v-4a3 3 0 013-3z" stroke-linejoin="round"/></svg></span><span>Support</span></a>
            </nav>

            <button type="button" class="btn-outline sidebar-logout" id="logoutButton">Logout</button>
        </aside>

        <div class="dash-content">
            <header class="dash-banner post-banner post-banner--workspace">
                <div class="banner-profile">
                    <div class="banner-avatar" id="bannerAvatar" aria-hidden="true">A</div>
                    <div class="banner-copy">
                        <p class="banner-eyebrow">SMART LEAP Applicant</p>
                        <h1 class="banner-greeting" id="formPageTitle">Post-Approval Form</h1>
                        <p class="banner-email" id="formPageSubtitle">Use this dedicated workspace to complete and submit your post-approval form.</p>
                    </div>
                </div>
                <ul class="banner-stats">
                    <li><span class="label">Task status</span><strong id="formPageStatus">Loading</strong></li>
                    <li><span class="label">Completion</span><strong id="formPageCompletion">0%</strong></li>
                    <li><span class="label">Review state</span><strong id="formPageReview">Awaiting draft</strong></li>
                    <li><span class="label">Task code</span><strong id="formPageCode"><?= htmlspecialchars($taskCode, ENT_QUOTES, 'UTF-8') ?></strong></li>
                </ul>
            </header>

            <main class="dash-main post-main">
                <section class="panel post-form-panel">
                    <div class="post-form-toolbar">
                        <a class="btn-outline post-back-link" href="<?= $baseUrl ?>/post-approval">Back to tasks</a>
                        <span class="chip" id="postApprovalWorkspaceStatus">Loading</span>
                    </div>

                    <div class="post-approval-workspace post-approval-workspace--page">
                        <div class="post-approval-workspace__header">
                            <div>
                                <h2 id="postApprovalWorkspaceTitle">Loading task</h2>
                                <p id="postApprovalWorkspaceSubtitle">Fetching the selected post-approval form.</p>
                            </div>
                        </div>
                        <div class="post-approval-notice" id="postApprovalWorkspaceNotice">
                            Loading form workspace...
                        </div>
                        <form id="postApprovalForm" class="post-approval-form is-hidden">
                            <div class="post-approval-form__sections" id="postApprovalFormSections"></div>
                            <div class="post-approval-form__staff" id="postApprovalStaffSections"></div>
                            <div class="form-actions post-approval-form__actions">
                                <button type="button" class="btn-outline" id="postApprovalSaveButton">Save progress</button>
                                <button type="submit" class="btn-primary" id="postApprovalSubmitButton">Submit form</button>
                            </div>
                        </form>
                    </div>
                </section>
            </main>

            <footer class="dash-footer">
                <p>SMART LEAP - City Government of Butuan &amp; CSWDD - Empowering homegrown enterprises.</p>
            </footer>
        </div>
    </div>

    <div class="toast-stack" id="toastStack" aria-live="polite" aria-atomic="true"></div>

    <script src="<?= $baseUrl ?>/assets/js/dashboards/post-approval-form.js" defer></script>
</body>
</html>

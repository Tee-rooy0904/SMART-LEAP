<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<?php /** @var array $overview */ ?>
<?php
$adminCssVersion = @filemtime(base_path('public/assets/css/dashboards/admin.css')) ?: time();
$adminComponentsCssVersion = @filemtime(base_path('public/assets/css/dashboards/admin-components.css')) ?: time();
$adminReportsCssVersion = @filemtime(base_path('public/assets/css/dashboards/admin-reports.css')) ?: time();
$socialWorkerCssVersion = @filemtime(base_path('public/assets/css/dashboards/social-worker.css')) ?: time();
$notificationsCssVersion = @filemtime(base_path('public/assets/css/components/notifications.css')) ?: time();
$reportsModuleJsVersion = @filemtime(base_path('public/assets/js/modules/reports.js')) ?: time();
$socialWorkerJsVersion = @filemtime(base_path('public/assets/js/dashboards/social-worker.js')) ?: time();
$notificationsJsVersion = @filemtime(base_path('public/assets/js/shared/notifications.js')) ?: time();

$applicationSummary = $overview['applicationSummary'] ?? [];
$assessmentQueue = $overview['assessmentQueue'] ?? [];
$recentApplications = $overview['recentApplications'] ?? [];
$trainingSummary = $overview['trainingSummary'] ?? [];
$beneficiarySummary = $overview['beneficiarySummary'] ?? [];
$beneficiaryRosterSummary = $overview['beneficiaryRosterSummary'] ?? [];
$repaymentSummary = $overview['repaymentSummary'] ?? [];
$generatedAt = date(DATE_ATOM);
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMART LEAP | Social Worker</title>
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin.css?v=<?= urlencode((string) $adminCssVersion) ?>">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin-components.css?v=<?= urlencode((string) $adminComponentsCssVersion) ?>">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin-reports.css?v=<?= urlencode((string) $adminReportsCssVersion) ?>">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/social-worker.css?v=<?= urlencode((string) $socialWorkerCssVersion) ?>">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/components/notifications.css?v=<?= urlencode((string) $notificationsCssVersion) ?>">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
</head>
<body class="admin-control-body social-worker-body">
  <script>
    window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    window.SMARTLEAP_SOCIAL_WORKER_OVERVIEW = <?= json_encode($overview ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    window.SMARTLEAP_REPORT_EXPORT_BASE = 'social-worker/reports/export';
  </script>

  <div id="mainSystem" class="admin-shell social-worker-shell" data-sidebar-open="false">
      <aside id="adminSidebar" class="admin-sidebar" aria-label="Social worker navigation" aria-hidden="false">
        <div class="sidebar-brand">
          <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP logo" class="brand-logo">
          <div class="brand-copy">
            <h1 class="brand-title">SMART LEAP</h1>
            <span class="brand-tag">Social Worker</span>
          </div>
        </div>

        <nav class="sidebar-nav" aria-label="Social worker navigation">
        <button class="nav-link active" type="button" data-section="dashboard">
          <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13h6V4H4v9Zm10 7h6V4h-6v16ZM4 20h6v-5H4v5Z"/></svg><span>Dashboard</span>
        </button>
        <button class="nav-link" type="button" data-section="applications">
          <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6V3Zm7 1.5V8h3.5L13 4.5ZM8.5 12h6v1.5h-6V12Zm0 4H13v1.5H8.5V16Z"/></svg><span>Applicants</span><span class="nav-badge" data-section-badge="applications"></span>
        </button>
        <button class="nav-link" type="button" data-section="beneficiaries">
          <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm8 0a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM8 13c-3 0-5.5 1.6-5.5 3.6V20h11v-3.4C13.5 14.6 11 13 8 13Zm8 0c-.9 0-1.8.1-2.5.4 1.2.9 2 2 2 3.2V20h6v-3.4C21.5 14.6 19 13 16 13Z"/></svg><span>Beneficiaries</span>
        </button>
        <button class="nav-link" type="button" data-section="reports">
          <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 19h16v2H4v-2Zm2-2h3V9H6v8Zm5 0h3V4h-3v13Zm5 0h3v-6h-3v6Z"/></svg><span>Reports</span>
        </button>
        <button class="nav-link" type="button" data-section="support">
          <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a8 8 0 0 0-8 8v4a3 3 0 0 0 3 3h1v-7H6a6 6 0 0 1 12 0h-2v7h1.2A4.8 4.8 0 0 1 12.5 21H11v-2h1.5a2.8 2.8 0 0 0 2.7-2H16v-6h2v-1a6 6 0 0 0-12 0v1h2v6H7a1 1 0 0 1-1-1v-5a6 6 0 0 1 12 0v5a1 1 0 0 1-1 1h-1v1h-1.2A4.8 4.8 0 0 1 12.5 21H11v-2h1.5a2.8 2.8 0 0 0 2.7-2H16v-6h2v-1a6 6 0 0 0-6-7Z"/></svg><span>Help Desk</span><span class="nav-badge" data-section-badge="support"></span>
        </button>
      </nav>

    </aside>

    <div class="sidebar-backdrop" data-sidebar-close></div>

    <div class="content-area">
      <header class="content-header admin-topbar">
        <button type="button" class="sidebar-toggle" aria-label="Toggle navigation menu" aria-expanded="false" aria-controls="adminSidebar">
          <span class="sidebar-toggle-icon" aria-hidden="true"></span>
        </button>

        <div class="content-headline">
          <span id="swSectionEyebrow" class="admin-topbar__eyebrow">Welcome back</span>
          <h1 id="swSectionTitle"><?= htmlspecialchars((string) ($authUser['name'] ?? 'Social Worker'), ENT_QUOTES) ?></h1>
        </div>

        <div class="admin-topbar__actions">
          <button type="button" class="app-btn-outline admin-refresh-button" id="swRefreshButton" aria-label="Refresh social worker dashboard">
            <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h8V3l-3.3 3.3Z"/></svg>
          </button>
          <div class="admin-account-menu staff-account-menu">
            <button type="button" class="app-btn-outline admin-account-menu__trigger" id="swAccountMenuTrigger" aria-expanded="false">
              <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"/></svg>
              <span>Account</span>
            </button>
            <div class="admin-account-menu__panel" id="swAccountMenuPanel" hidden>
              <div class="admin-account-menu__actions">
                <button type="button" class="app-btn-ghost admin-account-menu__action" id="swAccountProfile">
                  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z"/></svg>
                  <span>Profile</span>
                </button>
                <button type="button" class="app-btn-ghost admin-account-menu__action" id="swAccountPassword">
                  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1.5A1.5 1.5 0 0 1 20 11.5v8A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5v-8A1.5 1.5 0 0 1 5.5 10H7Zm2 0h6V8a3 3 0 0 0-6 0v2Z"/></svg>
                  <span>Change Password</span>
                </button>
                <button type="button" class="app-btn-outline app-btn-outline--danger admin-account-menu__action admin-account-menu__action--danger" id="sw-logout">
                  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h8v2H6v12h6v2H4V4Zm12.6 4.4L21.2 13l-4.6 4.6-1.4-1.4 2.2-2.2H10v-2h7.4l-2.2-2.2 1.4-1.4Z"/></svg>
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main class="content-main">
        <section id="dashboard-section" class="admin-section is-active" data-role-section>
          <div class="sw-page-stack">
            <section class="sw-summary-strip sw-summary-strip--overview sw-dashboard-kpi-strip" aria-label="Social Worker oversight summary">
              <article class="metric-card metric-card--soft sw-dashboard-kpi sw-dashboard-kpi--applications">
                <div class="sw-dashboard-kpi__eyebrow">Applications</div>
                <div class="sw-dashboard-kpi__main">
                  <div class="sw-dashboard-kpi__copy">
                    <strong class="metric-card__value" id="swDashApplicationsTotal"><?= (int) ($applicationSummary['total'] ?? 0) ?></strong>
                  </div>
                  <span class="sw-dashboard-kpi__icon" aria-hidden="true"><i class="fas fa-folder-open"></i></span>
                </div>
              </article>
              <article class="metric-card metric-card--soft sw-dashboard-kpi sw-dashboard-kpi--repayments">
                <div class="sw-dashboard-kpi__eyebrow">Repayments</div>
                <div class="sw-dashboard-kpi__main">
                  <div class="sw-dashboard-kpi__copy">
                    <strong class="metric-card__value" id="swDashRepaymentsPending"><?= (int) (($repaymentSummary['fullyPaid'] ?? $repaymentSummary['fully_paid'] ?? 0) + ($repaymentSummary['partialPaid'] ?? $repaymentSummary['partial_paid'] ?? 0) + ($repaymentSummary['underReview'] ?? $repaymentSummary['under_review'] ?? 0) + ($repaymentSummary['noUploadYet'] ?? $repaymentSummary['no_upload_yet'] ?? 0)) ?></strong>
                  </div>
                  <span class="sw-dashboard-kpi__icon" aria-hidden="true"><i class="fas fa-receipt"></i></span>
                </div>
              </article>
              <article class="metric-card metric-card--soft sw-dashboard-kpi sw-dashboard-kpi--beneficiaries">
                <div class="sw-dashboard-kpi__eyebrow">Beneficiaries</div>
                <div class="sw-dashboard-kpi__main">
                  <div class="sw-dashboard-kpi__copy">
                    <strong class="metric-card__value" id="swDashBeneficiariesTotal"><?= (int) ($beneficiarySummary['active'] ?? $beneficiarySummary['total'] ?? 0) ?></strong>
                  </div>
                  <span class="sw-dashboard-kpi__icon" aria-hidden="true"><i class="fas fa-users"></i></span>
                </div>
              </article>
              <article class="metric-card metric-card--soft sw-dashboard-kpi sw-dashboard-kpi--training">
                <div class="sw-dashboard-kpi__eyebrow">Training</div>
                <div class="sw-dashboard-kpi__main">
                  <div class="sw-dashboard-kpi__copy">
                    <strong class="metric-card__value" id="swDashTrainingTotal"><?= (int) ($trainingSummary['programs'] ?? $trainingSummary['total'] ?? 0) ?></strong>
                  </div>
                  <span class="sw-dashboard-kpi__icon" aria-hidden="true"><i class="fas fa-graduation-cap"></i></span>
                </div>
              </article>
            </section>

            <section class="sw-dashboard-chart-grid" aria-label="Social Worker dashboard charts">
              <article class="admin-layout-card sw-dashboard-chart-card">
                <h2>Applicants by Status</h2>
                <div class="sw-dashboard-chart" id="swApplicantsStatusChart"></div>
              </article>
              <article class="admin-layout-card sw-dashboard-chart-card">
                <h2>Repayment Verification Rate</h2>
                <div class="sw-dashboard-chart" id="swRepaymentVerificationRateChart"></div>
              </article>
            </section>
          </div>
        </section>

        <section id="applications-section" class="admin-section" data-role-section hidden>
          <div class="sw-page-stack">
            <section class="admin-layout-card">
              <div class="sw-filter-bar">
                <label>
                  <span>Search</span>
                  <input type="search" id="swApplicationSearch" placeholder="Search applicant, email, or business">
                </label>
                <label>
                  <span>Status</span>
                  <select id="swApplicationStatus">
                    <option value="">All application statuses</option>
                    <option value="requirements verified">Requirements Verified</option>
                    <option value="for assessment">For Assessment</option>
                    <option value="under review">Under Review</option>
                    <option value="needs correction">Needs Correction</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </label>
                <button type="button" class="app-btn-outline" id="swApplicationRefresh">
                  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h8V3l-3.3 3.3Z"/></svg>
                  <span>Refresh</span>
                </button>
              </div>
            </section>

            <section class="admin-layout-card">
              <div class="section-header admin-section__header">
                <span class="admin-inline-pill" data-sw-application-count>0 cases</span>
              </div>
              <div class="table-wrapper sw-table-wrapper">
                <table class="admin-data-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Business</th>
                      <th>Barangay</th>
                      <th>Status</th>
                      <th>Requirements</th>
                      <th>Updated</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody data-sw-applications-body>
                    <tr><td colspan="7">Loading applications...</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>

        <section id="beneficiaries-section" class="admin-section" data-role-section hidden>
          <div class="sw-page-stack">
            <section class="admin-layout-card">
              <div class="section-header admin-section__header">
                <span class="admin-inline-pill" data-sw-beneficiary-count>0 beneficiaries</span>
              </div>
              <div class="sw-filter-bar sw-filter-bar--beneficiaries">
                <label>
                  <span>Search</span>
                  <input type="search" id="swBeneficiarySearch" placeholder="Search beneficiary, business, barangay, or PDO">
                </label>
                <label>
                  <span>Repayment</span>
                  <select id="swBeneficiaryRepayment">
                    <option value="">All repayment states</option>
                    <option value="no_upload">No Upload Yet</option>
                    <option value="under_review">Under Review</option>
                    <option value="needs_follow_up">Needs Follow-up</option>
                    <option value="partial_paid">Partial Paid</option>
                    <option value="fully_paid">Fully Paid</option>
                  </select>
                </label>
              </div>
            </section>

            <section class="admin-layout-card">
              <div class="section-header admin-section__header">
                <span class="admin-inline-pill"><?= (int) ($beneficiaryRosterSummary['active'] ?? 0) ?> active</span>
              </div>
              <div class="table-wrapper sw-table-wrapper">
                <table class="admin-data-table">
                  <thead>
                    <tr>
                      <th>Beneficiary</th>
                      <th>Gender</th>
                      <th>Age Group</th>
                      <th>Service Type</th>
                      <th>Barangay</th>
                      <th>Assigned PDO</th>
                      <th>Repayment</th>
                      <th>Verified Amount</th>
                      <th>Rate</th>
                      <th class="actions">Action</th>
                    </tr>
                  </thead>
                  <tbody data-sw-beneficiaries-body>
                    <tr><td colspan="10">Loading beneficiaries...</td></tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>

        <section id="support-section" class="admin-section" data-role-section hidden>
          <div class="sw-page-stack">
            <section class="admin-layout-card">
              <div class="section-header admin-section__header">
                <button type="button" class="app-btn-outline" id="swSupportRefresh">
                  <svg class="admin-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.7 6.3A8 8 0 1 0 20 12h-2a6 6 0 1 1-1.8-4.2L13 11h8V3l-3.3 3.3Z"/></svg>
                  <span>Refresh</span>
                </button>
              </div>
            </section>
            <section class="sw-support-grid">
              <article class="admin-layout-card">
                <div class="section-header admin-section__header">
                  <div>
                    <span class="admin-section-eyebrow">Assigned Tickets</span>
                    <h2>Concern Queue</h2>
                  </div>
                  <span class="admin-inline-pill" data-sw-ticket-count>0 tickets</span>
                </div>
                <div class="sw-ticket-list" data-sw-ticket-list>
                  <p class="sw-empty">Loading support concerns...</p>
                </div>
              </article>
              <article class="admin-layout-card sw-ticket-detail" data-sw-ticket-detail>
                <p class="sw-empty">Select a concern to review the conversation and reply.</p>
              </article>
            </section>
          </div>
        </section>

        <section id="reports-section" class="admin-section" data-role-section hidden>
          <div class="admin-reports-loading">Loading reports.</div>
        </section>
      </main>

      <div id="swModalRoot"></div>
    </div>
  </div>

  <script src="<?= $baseUrl ?>/assets/js/shared/notifications.js?v=<?= urlencode((string) $notificationsJsVersion) ?>" defer></script>
  <script src="<?= $baseUrl ?>/assets/js/modules/reports.js?v=<?= urlencode((string) $reportsModuleJsVersion) ?>" defer></script>
  <script src="<?= $baseUrl ?>/assets/js/dashboards/social-worker.js?v=<?= urlencode((string) $socialWorkerJsVersion) ?>" defer></script>
</body>
</html>

<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<?php /** @var array $overview */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMART LEAP | Social Worker</title>
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin.css?v=20260326">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/social-worker.css?v=20260326">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
</head>
<body>
  <script>
    window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <div id="mainSystem" class="admin-shell social-worker-shell" data-sidebar-open="false">
    <aside id="adminSidebar" class="admin-sidebar" aria-label="Social worker navigation" aria-hidden="false">
      <div class="sidebar-brand">
        <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="brand-logo">
        <div class="brand-copy">
          <span class="brand-tag">City Government of Butuan</span>
          <h1 class="brand-title">Social Worker Console</h1>
        </div>
      </div>
      <nav class="sidebar-nav">
        <button type="button" class="nav-link active" data-section="dashboard"><i class="fas fa-gauge"></i><span>Dashboard</span></button>
        <button type="button" class="nav-link" data-section="assessment"><i class="fas fa-clipboard-check"></i><span>Assessment Queue</span></button>
        <button type="button" class="nav-link" data-section="reports"><i class="fas fa-file-lines"></i><span>Reports</span></button>
      </nav>
      <div class="sidebar-footer">
        <span>Signed in as</span>
        <strong><?= htmlspecialchars((string) (($authUser['name'] ?? 'Social Worker')), ENT_QUOTES) ?></strong>
      </div>
    </aside>

    <div class="sidebar-backdrop" data-sidebar-close></div>

    <div class="content-area">
      <header class="content-header">
        <button type="button" class="sidebar-toggle" aria-expanded="false" aria-controls="adminSidebar">
          <span class="sidebar-toggle-icon" aria-hidden="true"></span>
          <span class="sidebar-toggle-label">Menu</span>
        </button>
        <div class="content-headline">
          <h1>Eligibility assessment workspace</h1>
          <p>Review readiness, confirm assessment decisions, and monitor the queue moving toward training approval.</p>
        </div>
        <div class="header-actions">
          <a class="app-btn-outline header-link-button" href="<?= $baseUrl ?>/project-officer"><i class="fas fa-briefcase"></i><span>Open PDO Workspace</span></a>
          <button type="button" class="app-btn-danger" id="sw-logout"><i class="fas fa-arrow-right-from-bracket"></i><span>Logout</span></button>
        </div>
      </header>

      <main class="content-main">
        <section id="dashboard-section" class="content-card admin-section" data-role-section>
          <div class="metric-grid">
            <article class="metric-card">
              <span class="metric-card__label">Assessment queue</span>
              <strong class="metric-card__value"><?= count($overview['assessmentQueue'] ?? []) ?></strong>
              <p class="metric-card__meta">Cases waiting for eligibility evaluation</p>
            </article>
            <article class="metric-card">
              <span class="metric-card__label">Under review</span>
              <strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['underReview'] ?? 0) ?></strong>
              <p class="metric-card__meta">Applications still moving through document checks</p>
            </article>
            <article class="metric-card">
              <span class="metric-card__label">Approved for training</span>
              <strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['approvedForTraining'] ?? 0) ?></strong>
              <p class="metric-card__meta">Applicants cleared for training invitation</p>
            </article>
            <article class="metric-card">
              <span class="metric-card__label">Training records</span>
              <strong class="metric-card__value"><?= (int) ($overview['trainingSummary']['invitees'] ?? 0) ?></strong>
              <p class="metric-card__meta">Invitee records already logged in the training module</p>
            </article>
          </div>
        </section>

        <section id="assessment-section" class="content-card admin-section" data-role-section style="display:none;">
          <div class="section-header admin-section__header">
            <div>
              <h2>Assessment queue</h2>
              <p class="section-subtitle">These applications are the clearest candidates for eligibility review.</p>
            </div>
          </div>
          <div class="table-wrapper">
            <table class="admin-data-table">
              <thead>
                <tr>
                  <th>Applicant</th>
                  <th>Business</th>
                  <th>Barangay</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <?php if (!empty($overview['assessmentQueue'])): ?>
                  <?php foreach (($overview['assessmentQueue'] ?? []) as $application): ?>
                    <tr>
                      <td><?= htmlspecialchars((string) $application['applicantName'], ENT_QUOTES) ?></td>
                      <td><?= htmlspecialchars((string) ($application['businessName'] ?: 'No business name yet'), ENT_QUOTES) ?></td>
                      <td><?= htmlspecialchars((string) $application['barangay'], ENT_QUOTES) ?></td>
                      <td><span class="table-status-chip"><?= htmlspecialchars((string) $application['status'], ENT_QUOTES) ?></span></td>
                      <td><?= htmlspecialchars((string) $application['updatedAt'], ENT_QUOTES) ?></td>
                    </tr>
                  <?php endforeach; ?>
                <?php else: ?>
                  <tr><td colspan="5">No applications are waiting in the assessment queue.</td></tr>
                <?php endif; ?>
              </tbody>
            </table>
          </div>
        </section>

        <section id="reports-section" class="content-card admin-section" data-role-section style="display:none;">
          <div class="section-header admin-section__header">
            <div>
              <h2>Workflow report</h2>
              <p class="section-subtitle">Use this summary when coordinating with PDOs and administrators on workload and readiness.</p>
            </div>
          </div>
          <div class="metric-grid metric-grid--compact">
            <article class="metric-card metric-card--soft"><span class="metric-card__label">Submitted</span><strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['submitted'] ?? 0) ?></strong></article>
            <article class="metric-card metric-card--soft"><span class="metric-card__label">Under review</span><strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['underReview'] ?? 0) ?></strong></article>
            <article class="metric-card metric-card--soft"><span class="metric-card__label">Queued for assessment</span><strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['forAssessment'] ?? 0) ?></strong></article>
            <article class="metric-card metric-card--soft"><span class="metric-card__label">Approved for training</span><strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['approvedForTraining'] ?? 0) ?></strong></article>
          </div>
        </section>
      </main>
    </div>
  </div>

  <script src="<?= $baseUrl ?>/assets/js/dashboards/social-worker.js?v=20260326" defer></script>
</body>
</html>

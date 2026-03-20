<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMART LEAP &bull; Project Officer</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer" />
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" crossorigin="anonymous">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin.css">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/project-officer.css">
</head>
<body>
  <script>
    window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
  </script>
  <div id="mainSystem" class="admin-shell project-officer-shell" data-sidebar-open="false">
    <aside id="adminSidebar" class="admin-sidebar" aria-label="Project officer navigation" aria-hidden="false">
      <div class="sidebar-brand">
        <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="brand-logo">
        <div class="brand-copy">
          <span class="brand-tag">City Government of Butuan</span>
          <h1 class="brand-title">Project Officer Console</h1>
        </div>
      </div>
      <nav class="sidebar-nav">
        <button type="button" class="nav-link active" data-section="clients"><i class="fas fa-user-gear"></i><span>Beneficiaries</span></button>
        <button type="button" class="nav-link" data-section="applications"><i class="fas fa-file-circle-check"></i><span>Application Check</span></button>
        <button type="button" class="nav-link" data-section="repayments"><i class="fas fa-receipt"></i><span>Repayments</span></button>
        <button type="button" class="nav-link" data-section="training"><i class="fas fa-chalkboard-user"></i><span>Training Pipeline</span></button>
        <a class="nav-link nav-link--external" href="<?= $baseUrl ?>/post-approval-review"><i class="fas fa-clipboard-check"></i><span>Post-Approval Review</span></a>
      </nav>
      <div class="sidebar-footer">
        <span>Logged in as</span>
        <strong id="po-identity">Project Officer</strong>
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
          <h1>Welcome back, Project Officer</h1>
          <p>Oversee beneficiary journeys, reconcile repayments, and coordinate the SMART LEAP training pipeline.</p>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-ghost" id="po-refresh"><i class="fas fa-rotate"></i><span>Refresh</span></button>
          <button type="button" class="btn-primary" id="po-new-client"><i class="fas fa-user-plus"></i><span>Add beneficiary</span></button>
          <a class="btn-ghost header-link-button" href="<?= $baseUrl ?>/post-approval-review"><i class="fas fa-clipboard-check"></i><span>Post-Approval Review</span></a>
          <button type="button" class="btn-danger" id="po-logout"><i class="fas fa-arrow-right-from-bracket"></i><span>Logout</span></button>
        </div>
      </header>

      <main class="content-main">
        <section id="clients-section" class="content-card" data-role-section>
          <div class="summary-grid" aria-label="Case metrics">
            <article class="summary-card">
              <h4>Total beneficiaries</h4>
              <p class="metric" id="poSummaryClients">0</p>
              <p class="meta">Profiles on record</p>
            </article>
            <article class="summary-card">
              <h4>Pending applications</h4>
              <p class="metric" id="poSummaryApplications">0</p>
              <p class="meta">Awaiting review</p>
            </article>
          </div>

          <div class="po-case-grid">
            <section class="po-card">
              <header class="po-card-header">
                <h2>Applicant roster</h2>
                <div class="po-search-control">
                  <i class="fas fa-magnifying-glass"></i>
                  <input id="po-search" type="search" placeholder="Search applicant or barangay">
                </div>
              </header>
              <div class="po-table-wrapper">
                <table class="table table-striped align-middle" id="po-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Beneficiary</th>
                      <th>Status</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </section>
          </div>
        </section>

        <section id="applications-section" class="content-card" data-role-section style="display:none;">
          <div class="section-card">
            <header class="section-card__header">
              <div>
                <h2>Applications</h2>
                <p>Review submissions and keep statuses up-to-date.</p>
              </div>
              <div class="section-actions">
                <select id="po-app-filter" class="section-filter">
                  <option value="">All statuses</option>
                  <option value="Submitted">Submitted</option>
                  <option value="Under Review">Under Review</option>
                  <option value="Checked by PDO">Checked by PDO</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Flagged">Flagged</option>
                  <option value="Needs Correction">Needs Correction</option>
                </select>
                <button type="button" class="btn-ghost" id="po-app-refresh"><i class="fas fa-rotate"></i><span>Refresh</span></button>
              </div>
            </header>
            <div class="data-table-card">
              <header class="data-table-card__header">
                <h3>Scoped applications</h3>
                <span class="chip" id="po-app-count">0 records</span>
              </header>
              <div class="data-table-wrapper">
                <table class="data-table" id="po-app-table">
                  <thead>
                    <tr>
                      <th>Applicant</th>
                      <th>Business Type</th>
                      <th>Requirements</th>
                      <th>Status</th>
                      <th>Submitted</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="repayments-section" class="content-card" data-role-section style="display:none;">
          <div class="section-card">
            <header class="section-card__header">
              <div>
                <h2>Repayments</h2>
                <p>Verify digital receipts and reconcile with hard-copy submissions.</p>
              </div>
              <div class="section-actions">
                <button type="button" class="btn-pill" id="po-repay-refresh"><i class="fas fa-rotate"></i><span>Refresh</span></button>
              </div>
            </header>
            <div class="data-table-card">
              <header class="data-table-card__header">
                <h3>Beneficiaries</h3>
                <span class="chip" id="po-repay-count">0 records</span>
              </header>
              <div class="data-table-wrapper">
                <table class="data-table" id="po-repay-table">
                  <thead>
                    <tr>
                      <th>Beneficiary</th>
                      <th>Progress</th>
                      <th>Pending</th>
                      <th>Last receipt</th>
                      <th>Status</th>
                      <th class="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody></tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section id="training-section" class="content-card" data-role-section style="display:none;">
          <div class="section-card">
            <header class="section-card__header">
              <div>
                <h2>Training Pipeline</h2>
                <p>Assign SMART LEAP modules, monitor attendance, and coordinate certifications.</p>
              </div>
              <div class="section-actions">
                <button type="button" class="btn-ghost" id="po-training-refresh"><i class="fas fa-rotate"></i><span>Refresh</span></button>
              </div>
            </header>

            <div class="training-switcher" role="tablist">
              <button type="button" class="training-switcher__btn is-active" data-training-panel="sessions">
                <i class="fas fa-calendar-alt"></i><span>Sessions</span>
              </button>
              <button type="button" class="training-switcher__btn" data-training-panel="attendance">
                <i class="fas fa-clipboard-check"></i><span>Attendance</span>
              </button>
            </div>

            <div class="training-view is-active" data-panel="sessions">
              <div class="training-summary" id="po-training-summary"></div>
              <form class="training-filters" id="training-filter-form">
                <label>
                  <span>Facilitator</span>
                  <select id="training-filter-facilitator" name="facilitator"></select>
                </label>
                <label>
                  <span>Topic</span>
                  <select id="training-filter-focus" name="focus"></select>
                </label>
                <label>
                  <span>Starting month</span>
                  <input type="month" id="training-filter-month" name="month">
                </label>
                <button type="button" class="btn-ghost" id="training-filter-reset"><i class="fas fa-broom"></i><span>Clear</span></button>
              </form>

              <section class="training-admin-panel" id="training-schedule-panel"></section>

              <div class="table-card">
                <div class="table-toolbar">
                  <h4>Beneficiary roster</h4>
                  <div class="toolbar-actions">
                    <span class="chip">0 participants</span>
                  </div>
                </div>
                <div class="table-wrapper">
                  <table class="data-table" id="training-roster-table">
                    <thead>
                      <tr>
                        <th>Beneficiary</th>
                        <th>Attendance</th>
                        <th>Progress</th>
                        <th>Remarks</th>
                        <th class="actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </div>
              </div>
            </div>

            <div class="training-view" data-panel="attendance">
              <section class="training-admin-panel" id="training-attendance-panel"></section>
            </div>
          </div>
        </section>
      </main>

      <footer class="content-footer">
        <span>SMART LEAP &bull; City Government of Butuan &amp; CSWDD</span>
      </footer>
    </div>
  </div>

  <div class="modal fade" id="poApplicationModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <div>
            <h5 class="modal-title" id="po-app-modal-title">Application</h5>
            <small class="text-muted">Submitted on <span id="po-app-modal-submitted">--</span></small>
          </div>
          <div class="d-flex align-items-center gap-2">
            <span class="badge bg-secondary" id="po-app-modal-status">Pending</span>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
        </div>
        <div class="modal-body">
          <input type="hidden" id="po-app-modal-id">
          <div class="row g-3 mb-3">
            <div class="col-md-4">
              <p class="mb-1 text-muted">Business type</p>
              <p class="mb-0" id="po-app-modal-business">--</p>
            </div>
            <div class="col-md-4">
              <p class="mb-1 text-muted">Email / Contact</p>
              <p class="mb-0">
                <span id="po-app-modal-email">--</span><br>
                <small class="text-muted" id="po-app-modal-contact">--</small>
              </p>
            </div>
            <div class="col-md-4">
              <p class="mb-1 text-muted">Program</p>
              <select id="po-app-modal-program" class="form-select form-select-sm">
                <option value="4Ps">4Ps</option>
                <option value="Non-4Ps">Non-4Ps</option>
              </select>
            </div>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-md-4">
              <p class="mb-1 text-muted">Sector</p>
              <p class="mb-0" id="po-app-modal-sector">--</p>
            </div>
            <div class="col-md-4">
              <p class="mb-1 text-muted">Barangay</p>
              <p class="mb-0" id="po-app-modal-barangay">--</p>
            </div>
            <div class="col-md-4">
              <p class="mb-1 text-muted">Household size</p>
              <p class="mb-0" id="po-app-modal-household">--</p>
            </div>
          </div>
          <div class="row g-3 mb-3">
            <div class="col-md-4">
              <p class="mb-1 text-muted">Monthly income</p>
              <p class="mb-0" id="po-app-modal-income">--</p>
            </div>
            <div class="col-md-8">
              <p class="mb-1 text-muted">Main livelihood</p>
              <p class="mb-0" id="po-app-modal-livelihood">--</p>
            </div>
          </div>
          <div>
            <h6 class="text-muted text-uppercase small mb-2">Requirements</h6>
            <ul id="po-app-modal-requirements" class="list-group list-group-flush"></ul>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
          <button type="button" class="btn btn-outline-warning" id="po-app-modal-flag">Needs documents</button>
          <button type="button" class="btn btn-danger" id="po-app-modal-reject">Reject</button>
          <button type="button" class="btn btn-success" id="po-app-modal-approve">Approve</button>
        </div>
      </div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
  <script src="<?= $baseUrl ?>/assets/js/dashboards/project-officer.js" defer></script>
</body>
</html>








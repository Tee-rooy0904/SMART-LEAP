<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMART LEAP • Project Officer</title>
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
          <h1 class="brand-title">Project Officer Workspace</h1>
        </div>
      </div>

      <nav class="sidebar-nav">
        <button type="button" class="nav-link active po-nav-link" data-section="clients">
          <i class="fas fa-users"></i>
          <span class="po-nav-copy"><strong>Beneficiaries</strong></span>
        </button>
        <button type="button" class="nav-link po-nav-link" data-section="applications">
          <i class="fas fa-file-circle-check"></i>
          <span class="po-nav-copy"><strong>Application Review</strong></span>
        </button>
        <button type="button" class="nav-link po-nav-link" data-section="training">
          <i class="fas fa-chalkboard-user"></i>
          <span class="po-nav-copy"><strong>Training Pipeline</strong></span>
        </button>
        <button type="button" class="nav-link po-nav-link" data-section="repayments">
          <i class="fas fa-receipt"></i>
          <span class="po-nav-copy"><strong>Repayments</strong></span>
        </button>
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
        <div class="po-header-shell">
          <div class="content-headline">
            <span class="po-header-kicker">Project Officer</span>
            <h1>Project Officer Workspace</h1>
            <div class="po-header-meta">
              <span class="po-header-chip"><i class="fas fa-location-dot"></i><span id="poHeaderBarangays">No assigned barangays</span></span>
              <span class="po-header-chip"><i class="fas fa-user-check"></i><span id="poHeaderScope">0 scoped applicants</span></span>
            </div>
          </div>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-ghost" id="po-refresh"><i class="fas fa-rotate"></i><span>Refresh</span></button>
          <button type="button" class="btn-primary" id="po-new-client"><i class="fas fa-user-plus"></i><span>Add beneficiary</span></button>
          <button type="button" class="btn-danger" id="po-logout"><i class="fas fa-arrow-right-from-bracket"></i><span>Logout</span></button>
        </div>
      </header>

      <main class="content-main">
        <section id="clients-section" class="content-card" data-role-section>
          <div class="po-home-shell">
            <section class="po-briefing-panel">
              <div class="po-briefing-panel__intro">
                <span class="po-panel-label">Daily Briefing</span>
                <h2>Assigned case operations</h2>
              </div>
              <div class="po-kpi-grid" aria-label="Case metrics">
                <article class="po-kpi-card">
                  <span class="po-kpi-card__label">Scoped Applicants</span>
                  <strong class="po-kpi-card__value" id="poSummaryClients">0</strong>
                </article>
                <article class="po-kpi-card">
                  <span class="po-kpi-card__label">Pending Review</span>
                  <strong class="po-kpi-card__value" id="poSummaryApplications">0</strong>
                </article>
                <article class="po-kpi-card">
                  <span class="po-kpi-card__label">Ready for Decision</span>
                  <strong class="po-kpi-card__value" id="poSummaryReady">0</strong>
                </article>
                <article class="po-kpi-card">
                  <span class="po-kpi-card__label">Training Programs</span>
                  <strong class="po-kpi-card__value" id="poSummaryTraining">0</strong>
                </article>
              </div>
            </section>

            <section class="po-operations-board">
              <div class="po-operations-board__main">
                <section class="po-panel po-panel--board">
                  <header class="po-panel__header">
                    <div>
                      <span class="po-panel-label">Beneficiary Queue</span>
                      <h2>Scoped roster</h2>
                    </div>
                    <span class="po-inline-pill" id="poRosterCount">0 records</span>
                  </header>
                  <div class="po-panel__body">
                    <div class="po-roster-toolbar">
                      <label class="po-search-control" aria-label="Search applicant or barangay">
                        <i class="fas fa-magnifying-glass"></i>
                        <input id="po-search" type="search" placeholder="Search applicant or barangay">
                      </label>
                    </div>
                    <div class="po-table-wrapper">
                      <table class="table align-middle" id="po-table">
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
                  </div>
                </section>
              </div>

              <aside class="po-operations-board__side">
                <section class="po-panel po-panel--board">
                  <header class="po-panel__header">
                    <div>
                      <span class="po-panel-label">Review Queue</span>
                      <h3>Priority queue</h3>
                    </div>
                  </header>
                  <div class="po-panel__body">
                    <ul class="po-queue-list" id="poPriorityQueue">
                      <li class="po-empty">No applications loaded yet.</li>
                    </ul>
                  </div>
                </section>
                <section class="po-panel po-panel--board po-scope-panel">
                  <header class="po-panel__header">
                    <div>
                      <span class="po-panel-label">Coverage</span>
                      <h3>Assigned barangays</h3>
                    </div>
                  </header>
                  <div class="po-panel__body">
                    <div class="po-barangay-list" id="poBarangayList">
                      <span class="po-mini-chip">No assignments yet</span>
                    </div>
                  </div>
                </section>
              </aside>
            </section>
          </div>
        </section>

        <section id="applications-section" class="content-card" data-role-section style="display:none;">
          <div class="po-section-shell">
            <section class="po-section-intro">
              <div>
                <span class="po-panel-label">Operations Queue</span>
                <h2>Application Review</h2>
                <p>Review queued applications, identify incomplete requirements, and open case files for final readiness decisions.</p>
              </div>
            </section>

            <section class="po-section-board">
              <div class="po-application-toolbar">
                <div class="po-application-toolbar__summary">
                  <article class="po-application-stat">
                    <span>Scoped Queue</span>
                    <strong id="po-app-count">0 records</strong>
                  </article>
                  <article class="po-application-stat">
                    <span>Ready for Action</span>
                    <strong id="po-app-ready-count">0 cases</strong>
                  </article>
                  <article class="po-application-stat">
                    <span>Needs Follow-up</span>
                    <strong id="po-app-attention-count">0 cases</strong>
                  </article>
                </div>
                <div class="po-application-toolbar__controls">
                  <label class="po-filter-field" for="po-app-filter">
                    <span>Status Filter</span>
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
                  </label>
                  <button type="button" class="btn-ghost" id="po-app-refresh"><i class="fas fa-rotate"></i><span>Refresh Queue</span></button>
                </div>
              </div>

              <div class="data-table-card">
                <header class="data-table-card__header">
                  <h3>Scoped applications</h3>
                  <span class="chip" id="po-app-table-caption">Queue review list</span>
                </header>
                <div class="data-table-wrapper">
                  <table class="data-table" id="po-app-table">
                    <thead>
                      <tr>
                        <th>Applicant</th>
                        <th>Barangay</th>
                        <th>Uploads</th>
                        <th>Application Status</th>
                        <th>Readiness</th>
                        <th>Submitted</th>
                        <th class="text-end">Actions</th>
                      </tr>
                    </thead>
                    <tbody></tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section id="training-section" class="content-card" data-role-section style="display:none;">
          <div class="po-section-shell">
            <section class="po-section-intro">
              <div>
                <span class="po-panel-label">Program Operations</span>
                <h2>Training Pipeline</h2>
                <p>Coordinate schedules, speakers, attendance records, and notice actions for scoped training programs.</p>
              </div>
            </section>

            <section class="po-section-board">
              <header class="section-card__header">
                <div></div>
              <div class="section-actions">
                <button type="button" class="btn-ghost" id="po-training-refresh"><i class="fas fa-rotate"></i><span>Refresh</span></button>
              </div>
              </header>

              <div class="po-training-summary" id="po-training-summary"></div>

              <div class="po-training-grid">
                <section class="data-table-card">
                  <header class="data-table-card__header">
                    <h3>Training Schedule</h3>
                    <span class="chip" id="po-training-program-count">0 programs</span>
                  </header>
                  <div class="data-table-wrapper">
                    <table class="data-table" id="po-training-program-table">
                      <thead>
                        <tr>
                          <th>Program</th>
                          <th>Speaker</th>
                          <th>Date</th>
                          <th>Venue</th>
                          <th>Status</th>
                          <th>Participants</th>
                          <th class="actions">Actions</th>
                        </tr>
                      </thead>
                      <tbody></tbody>
                    </table>
                  </div>
                </section>

                <section class="data-table-card">
                  <header class="data-table-card__header">
                    <h3>Program Workspace</h3>
                    <span class="chip" id="po-training-active-chip">No program selected</span>
                  </header>
                  <div id="po-training-program-detail" class="po-training-detail"></div>
                </section>
              </div>
            </section>
          </div>
        </section>

        <section id="repayments-section" class="content-card" data-role-section style="display:none;">
          <div class="section-card">
            <header class="section-card__header">
              <div>
                <h2>Repayments</h2>
              </div>
            </header>
            <div class="po-placeholder-panel">
              Repayment tracking remains parked while the backend repayment workflow is still incomplete.
            </div>
          </div>
        </section>
      </main>

      <footer class="content-footer">
        <span>SMART LEAP • City Government of Butuan • CSWDD</span>
      </footer>
    </div>
  </div>

  <div class="modal fade" id="poApplicationModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-dialog-scrollable po-review-modal-dialog">
      <div class="modal-content po-review-modal">
        <div class="modal-header">
          <div class="po-modal-title-block">
            <span class="po-panel-label po-modal-eyebrow">Application Case</span>
            <h5 class="modal-title" id="po-app-modal-title">Application Review</h5>
            <small class="po-modal-subtitle">Submitted on <span id="po-app-modal-submitted">--</span></small>
          </div>
          <div class="po-modal-header-actions">
            <span class="po-status-chip" id="po-app-modal-status">Pending</span>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
        </div>
        <div class="modal-body">
          <input type="hidden" id="po-app-modal-id">

          <section class="po-case-grid">
            <article class="po-case-card"><span>Applicant</span><strong id="po-app-modal-applicant">--</strong></article>
            <article class="po-case-card"><span>Barangay</span><strong id="po-app-modal-barangay">--</strong></article>
            <article class="po-case-card"><span>Business</span><strong id="po-app-modal-business">--</strong></article>
            <article class="po-case-card"><span>Contact</span><strong id="po-app-modal-contact">--</strong></article>
            <article class="po-case-card"><span>Sector</span><strong id="po-app-modal-sector">--</strong></article>
            <article class="po-case-card"><span>Main livelihood</span><strong id="po-app-modal-livelihood">--</strong></article>
          </section>

          <section class="po-readiness-panel">
            <div class="po-readiness-panel__header">
              <div>
                <span class="po-panel-label">Readiness Summary</span>
                <h6 id="po-app-readiness-status">Under Review</h6>
              </div>
              <span class="po-status-chip" id="po-app-training-chip">Training Pending</span>
            </div>
            <div class="po-readiness-grid">
              <article class="po-readiness-card"><span>Upload Requirements</span><strong id="po-app-upload-summary">0 / 0</strong></article>
              <article class="po-readiness-card"><span>Fill-up Form Requirements</span><strong id="po-app-form-summary">0 / 0</strong></article>
              <article class="po-readiness-card"><span>Training Status</span><strong id="po-app-training-status">--</strong></article>
            </div>
            <div class="po-blocker-box">
              <span class="po-panel-label">Blocking Reasons</span>
              <ul id="po-app-readiness-blockers" class="po-blocker-list">
                <li>No blocking reasons.</li>
              </ul>
            </div>
          </section>

          <section class="po-review-section">
            <div class="po-review-section__header">
              <div>
                <span class="po-panel-label">Requirement Review</span>
                <h6>Upload Requirements</h6>
              </div>
              <span class="po-status-chip is-muted" id="po-upload-review-count">0 items</span>
            </div>
            <div class="data-table-wrapper">
              <table class="data-table po-review-table" id="po-upload-review-table">
                <thead>
                  <tr>
                    <th>Requirement</th>
                    <th>Type</th>
                    <th>Submission State</th>
                    <th>Requirement Status</th>
                    <th>Staff Remarks</th>
                    <th>Applicant-visible Remark</th>
                    <th>Open</th>
                    <th class="actions">Review Action</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </section>

          <section class="po-review-section">
            <div class="po-review-section__header">
              <div>
                <span class="po-panel-label">Requirement Review</span>
                <h6>Fill-up Form Requirements</h6>
              </div>
              <span class="po-status-chip is-muted" id="po-form-review-count">0 items</span>
            </div>
            <div class="data-table-wrapper">
              <table class="data-table po-review-table" id="po-form-review-table">
                <thead>
                  <tr>
                    <th>Requirement</th>
                    <th>Type</th>
                    <th>Submission State</th>
                    <th>Requirement Status</th>
                    <th>Staff Remarks</th>
                    <th>Applicant-visible Remark</th>
                    <th>Open</th>
                    <th class="actions">Review Action</th>
                  </tr>
                </thead>
                <tbody></tbody>
              </table>
            </div>
          </section>

          <section class="po-decision-panel">
            <label for="po-app-modal-remarks" class="po-panel-label">Application-level Remarks</label>
            <textarea id="po-app-modal-remarks" rows="4" placeholder="Record application-level remarks for the next status action."></textarea>
          </section>
        </div>
        <div class="modal-footer">
          <div class="po-decision-rail">
            <div class="po-decision-rail__summary">
              <span class="po-panel-label">Decision Control</span>
              <strong id="po-decision-status-note">Review readiness is pending.</strong>
              <small id="po-decision-blocker-note">Resolve any blocking requirement or training issue before approval.</small>
            </div>
            <div class="po-decision-rail__actions">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
              <button type="button" class="btn btn-outline-warning" id="po-app-modal-flag">Needs Documents</button>
              <button type="button" class="btn btn-outline-primary" id="po-app-modal-correct">Needs Correction</button>
              <button type="button" class="btn btn-danger" id="po-app-modal-reject">Reject</button>
              <button type="button" class="btn btn-success" id="po-app-modal-approve">Approve</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="modal fade" id="poApprovalSummaryModal" tabindex="-1" aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-scrollable">
      <div class="modal-content po-summary-modal">
        <div class="modal-header">
          <div>
            <h5 class="modal-title">Approval Readiness Summary</h5>
            <small id="po-summary-applicant">Applicant</small>
          </div>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="po-summary-grid">
            <article class="po-summary-card"><span>Barangay</span><strong id="po-summary-barangay">--</strong></article>
            <article class="po-summary-card"><span>Upload Requirements</span><strong id="po-summary-upload">0 / 0</strong></article>
            <article class="po-summary-card"><span>Fill-up Form Requirements</span><strong id="po-summary-form">0 / 0</strong></article>
            <article class="po-summary-card"><span>Training Status</span><strong id="po-summary-training">--</strong></article>
          </div>
          <div class="po-summary-state" id="po-summary-readiness-text">Review readiness is pending.</div>
          <ul class="po-summary-checklist" id="po-summary-checklist"></ul>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Back</button>
          <button type="button" class="btn btn-success" id="po-summary-confirm">Confirm Approval</button>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js" crossorigin="anonymous"></script>
  <script src="<?= $baseUrl ?>/assets/js/dashboards/project-officer.js" defer></script>
</body>
</html>

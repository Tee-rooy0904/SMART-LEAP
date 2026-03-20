<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Admin Control Center</title>
<link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin.css?v=20260209ai">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
</head>
<body>
    <div id="mainSystem" class="admin-shell" data-sidebar-open="false">
        <aside id="adminSidebar" class="admin-sidebar" aria-hidden="false">
            <div class="sidebar-brand">
                <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="Butuan logo" class="brand-logo">
                <div class="brand-copy">
                    <h1 class="brand-title">SMART LEAP Command Center</h1>
                </div>
            </div>
            <nav class="sidebar-nav" aria-label="Admin navigation">
                <button class="nav-link active" type="button" data-section="dashboard"><i class="fas fa-gauge"></i><span>Dashboard</span></button>
                <button class="nav-link" type="button" data-section="applications"><i class="fas fa-file-signature"></i><span>Applications</span></button>
                <button class="nav-link" type="button" data-section="repayments"><i class="fas fa-receipt"></i><span>Repayments</span></button>
                <button class="nav-link" type="button" data-section="training"><i class="fas fa-chalkboard-user"></i><span>Training</span></button>
                <a class="nav-link nav-link--external" href="<?= $baseUrl ?>/post-approval-review"><i class="fas fa-clipboard-check"></i><span>Post-Approval Review</span></a>
                <button class="nav-link" type="button" data-section="reports"><i class="fas fa-chart-pie"></i><span>Reports &amp; Analytics</span></button>
                <button class="nav-link" type="button" data-section="users"><i class="fas fa-user-group"></i><span>Team</span></button>
            </nav>
            <div class="sidebar-footer">
                <span>Need assistance?</span>
                <strong>smartleap@butuan.gov.ph</strong>
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
                    <h1>Welcome back, Admin</h1>
                    <p>Run live application review, staff assignments, and training operations from one control center.</p>
                </div>
                <div class="header-actions">
                    <button type="button" class="app-btn-primary" id="open-training-workspace"><i class="fas fa-chalkboard-user"></i><span>Open Training Workspace</span></button>
                    <a class="app-btn-outline header-link-button" href="<?= $baseUrl ?>/post-approval-review"><i class="fas fa-clipboard-check"></i><span>Post-Approval Review</span></a>
                    <form method="post" action="<?= $baseUrl ?>/auth/logout" class="logout-form">
                        <button type="submit" class="app-btn-danger" id="system-logout"><i class="fas fa-arrow-right-from-bracket"></i><span>Logout</span></button>
                    </form>
                </div>
            </header>

            <main class="content-main">
                <section id="dashboard-section" class="content-card admin-placeholder-section">
                    <div class="admin-placeholder">
                        <div class="admin-placeholder__icon"><i class="fas fa-gauge-high"></i></div>
                        <div class="admin-placeholder__copy">
                            <span class="admin-placeholder__eyebrow">Admin audit result</span>
                            <h3>Dashboard overview is not yet live.</h3>
                            <p>The old summary cards were powered by mock records. They have been intentionally removed from active use until real dashboard metrics are connected to the database.</p>
                            <ul class="admin-placeholder__list">
                                <li>Use <strong>Applications</strong> for live review decisions.</li>
                                <li>Use <strong>Training</strong> for real program scheduling and notices.</li>
                                <li>Use <strong>Team</strong> for live staff and barangay assignment management.</li>
                            </ul>
                        </div>
                    </div>
                </section>
                <section id="applications-section" class="content-card" style="display:none;"></section>
                <section id="repayments-section" class="content-card admin-placeholder-section" style="display:none;">
                    <div class="admin-placeholder admin-placeholder--muted">
                        <div class="admin-placeholder__icon"><i class="fas fa-receipt"></i></div>
                        <div class="admin-placeholder__copy">
                            <span class="admin-placeholder__eyebrow">Not yet live</span>
                            <h3>Repayment operations are still in transition.</h3>
                            <p>This section previously showed demo repayment records. It is kept visible as a placeholder only until the real beneficiary repayment backend is connected.</p>
                        </div>
                    </div>
                </section>
                <section id="training-section" class="content-card" style="display:none;"></section>
                <section id="reports-section" class="content-card admin-placeholder-section" style="display:none;">
                    <div class="admin-placeholder admin-placeholder--muted">
                        <div class="admin-placeholder__icon"><i class="fas fa-chart-pie"></i></div>
                        <div class="admin-placeholder__copy">
                            <span class="admin-placeholder__eyebrow">Not yet live</span>
                            <h3>Reports and analytics are disabled for now.</h3>
                            <p>The previous charts depended on mock trend data. They are intentionally hidden behind this placeholder until real reporting queries are implemented.</p>
                        </div>
                    </div>
                </section>
                <section id="users-section" class="content-card" style="display:none;"></section>
            </main>

            <footer class="content-footer">
                <span>SMART LEAP | City Government of Butuan &amp; CSWDD</span>
            </footer>
            <div id="modal-root"></div>
        </div>
    </div>

    <!-- Beneficiary modal -->
    <div class="modal fade" id="beneficiaryModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <form id="beneficiary-form" class="needs-validation" novalidate>
            <div class="modal-header">
              <h5 class="modal-title" id="beneficiary-modal-title">Add Beneficiary</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="b-id">
              <div class="row g-3">
                <div class="col-md-6">
                  <label for="b-name" class="form-label">Full name</label>
                  <input type="text" class="form-control" id="b-name" data-initial-focus="true" required>
                </div>
                <div class="col-md-6">
                  <label for="b-email" class="form-label">Email</label>
                  <input type="email" class="form-control" id="b-email" placeholder="name@example.com" required>
                </div>
                <div class="col-md-6">
                  <label for="b-contact" class="form-label">Contact number</label>
                  <input type="tel" class="form-control" id="b-contact" placeholder="09xx xxx xxxx" required>
                </div>
                <div class="col-md-6">
                  <label for="b-gender" class="form-label">Gender</label>
                  <select id="b-gender" class="form-select">
                    <option value="">Select gender</option>
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label for="b-barangay" class="form-label">Barangay</label>
                  <input type="text" class="form-control" id="b-barangay" placeholder="Barangay Ampayon" required>
                </div>
                <div class="col-md-6">
                  <label for="b-purok" class="form-label">Purok / Sitio</label>
                  <input type="text" class="form-control" id="b-purok" placeholder="Purok 3">
                </div>
                <div class="col-12">
                  <label for="b-address" class="form-label">Complete address</label>
                  <input type="text" class="form-control" id="b-address" placeholder="House no., street, barangay">
                </div>
                <div class="col-md-6">
                  <label for="b-birthday" class="form-label">Birthdate</label>
                  <input type="date" class="form-control" id="b-birthday">
                </div>
                <div class="col-md-6">
                  <label for="b-age" class="form-label">Age</label>
                  <input type="number" class="form-control" id="b-age" min="18" max="100" placeholder="18">
                </div>
                <div class="col-12">
                  <label for="b-business" class="form-label">Type of business</label>
                  <input type="text" class="form-control" id="b-business" placeholder="e.g., Sari-sari store" required>
                </div>
                <div class="col-md-6">
                  <label for="b-sector" class="form-label">Sector</label>
                  <select id="b-sector" class="form-select">
                    <option value="">Select sector</option>
                    <option value="Pantawid">Pantawid (4Ps)</option>
                    <option value="Senior Citizen">Senior Citizen</option>
                    <option value="PWD">Person with Disability (PWD)</option>
                    <option value="Solo Parent">Solo Parent</option>
                    <option value="IP">Indigenous Peoples (IP)</option>
                    <option value="None">None of the above</option>
                  </select>
                </div>
                <div class="col-md-6">
                  <label for="b-status" class="form-label">Application status</label>
                  <select id="b-status" class="form-select">
                    <option value="Submitted">Submitted</option>
                    <option value="Pending Verification">Pending Verification</option>
                    <option value="UnderReview">Under Review</option>
                    <option value="ForValidation">For Validation</option>
                    <option value="PendingRequirements">Pending Requirements</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="ApprovedForTraining">Approved for Training</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Dropped">Dropped</option>
                  </select>
                </div>
              </div>
              <div class="requirement-upload-card mt-4" id="beneficiary-requirements-upload"></div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save beneficiary</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="modal fade" id="beneficiaryProfileModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header beneficiary-profile-header">
            <div>
              <h5 class="modal-title">Beneficiary profile</h5>
              <p class="profile-subtitle" id="profile-summary-line">Review beneficiary details and compliance.</p>
            </div>
            <button type="button" class="btn-close profile-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body profile-modal-body">
            <section class="profile-section profile-overview">
              <div class="profile-grid">
                <div class="profile-item">
                  <span class="profile-label">Name</span>
                  <span class="profile-value" id="profile-name">Beneficiary name</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Business Type</span>
                  <span class="profile-value" id="profile-business">Business type</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Address</span>
                  <span class="profile-value" id="profile-location">Location</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Phone</span>
                  <span class="profile-value" id="profile-contact">Contact</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Email</span>
                  <span class="profile-value" id="profile-email">Email</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Pantawid / Non-Pantawid</span>
                  <span class="profile-value" id="profile-sector">Sector</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Status</span>
                  <span class="profile-chip" id="profile-status">Status</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Release Date</span>
                  <span class="profile-value" id="profile-release">Not released yet</span>
                </div>
                <div class="profile-item">
                  <span class="profile-label">Notes</span>
                  <span class="profile-value" id="profile-notes">No notes recorded.</span>
                </div>
              </div>
            </section>

            <section class="profile-section">
              <div class="profile-section__header">
                <h6>Requirements</h6>
                <span class="profile-count" id="profile-req-summary">0/0 verified</span>
              </div>
              <ul id="profile-requirements" class="profile-checklist"></ul>
            </section>

            <section class="profile-section">
              <div class="profile-section__header">
                <h6>Repayments</h6>
              </div>
              <div class="repayment-summary-grid">
                <div class="repayment-summary-item">
                  <span>Completed</span>
                  <strong id="profile-repayment-completed">0/24</strong>
                </div>
                <div class="repayment-summary-item">
                  <span>Completion rate</span>
                  <strong id="profile-repayment-rate">0%</strong>
                </div>
                <div class="repayment-summary-item">
                  <span>Overdue</span>
                  <strong id="profile-repayment-overdue">0</strong>
                </div>
                <div class="repayment-summary-item">
                  <span>Last payment date</span>
                  <strong id="profile-repayment-last">--</strong>
                </div>
              </div>
              <div class="repayment-table">
                <div class="repayment-table__head">
                  <span>Month</span>
                  <span>Amount</span>
                  <span>Status</span>
                </div>
                <div id="profile-repayments" class="repayment-table__body"></div>
              </div>
              <button type="button" class="btn btn-outline-secondary repayment-toggle" id="profile-repayments-toggle">View all</button>
            </section>
          </div>
          <div class="modal-footer">
              <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal fade" id="applicationModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <h5 class="modal-title" id="app-modal-title">Application</h5>
              <small class="text-muted">Submitted on <span id="app-modal-submitted">--</span></small>
            </div>
            <div class="d-flex align-items-center gap-2 app-modal-actions">
              <span class="badge bg-secondary" id="app-modal-status">Pending</span>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
          </div>
          <div class="modal-body">
            <input type="hidden" id="app-modal-id">
            <div class="row g-3 mb-3">
              <div class="col-md-4">
                <p class="mb-1 text-muted">Business type</p>
                <p class="mb-0" id="app-modal-business">--</p>
              </div>
              <div class="col-md-4">
                <p class="mb-1 text-muted">Email / Contact</p>
                <p class="mb-0"><span id="app-modal-email">--</span><br><small class="text-muted" id="app-modal-contact">--</small></p>
              </div>
              <div class="col-md-4">
                <p class="mb-1 text-muted">Program</p>
                <select id="app-modal-program" class="form-select form-select-sm">
                  <option value="4Ps">4Ps</option>
                  <option value="Non-4Ps">Non-4Ps</option>
                </select>
              </div>
            </div>
            <div class="row g-3 mb-3">
              <div class="col-md-4">
                <p class="mb-1 text-muted">Sector</p>
                <p class="mb-0" id="app-modal-sector">--</p>
              </div>
              <div class="col-md-4">
                <p class="mb-1 text-muted">Barangay</p>
                <p class="mb-0" id="app-modal-barangay">--</p>
              </div>
              <div class="col-md-4">
                <p class="mb-1 text-muted">Household size</p>
                <p class="mb-0" id="app-modal-household">--</p>
              </div>
            </div>
            <div class="row g-3 mb-3">
              <div class="col-md-4">
                <p class="mb-1 text-muted">Monthly income</p>
                <p class="mb-0" id="app-modal-income">--</p>
              </div>
              <div class="col-md-8">
                <p class="mb-1 text-muted">Main livelihood</p>
                <p class="mb-0" id="app-modal-livelihood">--</p>
              </div>
            </div>
            <div>
              <h6 class="text-muted text-uppercase small mb-2">Requirements</h6>
              <ul id="app-modal-requirements" class="list-group list-group-flush"></ul>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Close</button>
            <button type="button" class="btn btn-outline-warning" id="app-modal-flag">Needs documents</button>
            <button type="button" class="btn btn-danger" id="app-modal-reject">Reject</button>
            <button type="button" class="btn btn-success" id="app-modal-approve">Approve</button>
          </div>
        </div>
      </div>
    </div>

            <div class="modal fade" id="repaymentModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <h5 class="modal-title">Repayment log</h5>
              <small class="text-muted">For <span id="repayment-beneficiary-name">--</span></small>
            </div>
            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
          </div>
          <div class="modal-body repayment-modal-body">
            <input type="hidden" id="repayment-beneficiary-id">
            <div class="repayments-detail">
              <div class="detail-header">
                <div>
                  <h4 id="repayment-modal-name">--</h4>
                  <div class="detail-meta">
                    <span id="repayment-modal-location">--</span>
                    <span id="repayment-modal-contact">--</span>
                    <span id="repayment-modal-email">--</span>
                  </div>
                </div>
                <div class="detail-actions">
                  <button type="button" class="app-btn-ghost" id="repayment-view-profile"><i class="fas fa-id-card"></i><span>View profile</span></button>
                  <button type="button" class="app-btn-primary" id="repayment-scroll-form"><i class="fas fa-upload"></i><span>Log receipt</span></button>
                </div>
              </div>
              <div class="detail-summary-grid">
                <div class="detail-summary-card">
                  <h6>Assistance</h6>
                  <strong id="repayment-summary-assistance">?0</strong>
                  <span><span class="badge-theme" id="repayment-summary-status">Pending</span></span>
                </div>
                <div class="detail-summary-card">
                  <h6>Progress</h6>
                  <strong id="repayment-summary-progress">0/0 months</strong>
                  <span id="repayment-summary-progress-meta">?0 verified</span>
                </div>
                <div class="detail-summary-card">
                  <h6>Pending receipts</h6>
                  <strong id="repayment-summary-pending">0</strong>
                  <span id="repayment-summary-pending-meta">0 verified</span>
                </div>
                <div class="detail-summary-card">
                  <h6>Balance</h6>
                  <strong id="repayment-summary-balance">?0</strong>
                  <span id="repayment-summary-balance-meta">Last payment: --</span>
                </div>
              </div>
              <div class="table-card light repayment-history-card">
                <div class="table-toolbar">
                  <h4>Payment history</h4>
                  <div class="toolbar-actions">
                    <span class="chip" id="repayment-summary-count">0 receipts logged</span>
                  </div>
                </div>
                <div class="table-wrapper">
                  <table class="data-table" id="repayment-history">
                    <thead>
                      <tr>
                        <th>Month</th>
                        <th>Payment date</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>OR / Proof</th>
                        <th class="actions">Actions</th>
                      </tr>
                    </thead>
                    <tbody id="repayment-table-body"></tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="admin-modal" id="repaymentReviewModal" aria-hidden="true">
      <div class="admin-modal__backdrop" data-modal-close></div>
      <div class="admin-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="repayment-review-title">
        <header class="admin-modal__header">
          <div>
            <h3 id="repayment-review-title">Receipt Review ï¿½ <span id="review-beneficiary-name">--</span></h3>
            <div class="review-subtitle">
              <span class="status-badge pending" id="review-status-badge">Pending</span>
              <span id="review-beneficiary-meta">--</span>
            </div>
          </div>
          <button type="button" class="icon-button admin-modal__close" data-modal-close aria-label="Close">
            <i class="fas fa-xmark"></i>
          </button>
        </header>
        <div class="admin-modal__body">
          <div class="review-grid">
            <div class="review-column review-column--left">
              <div class="review-card">
                <h4>Beneficiary</h4>
                <div class="review-list">
                  <div><span>Name</span><strong id="review-name">--</strong></div>
                  <div><span>Address</span><strong id="review-address">--</strong></div>
                  <div><span>Phone</span><strong id="review-phone">--</strong></div>
                  <div><span>Email</span><strong id="review-email">--</strong></div>
                  <div><span>Sector</span><strong id="review-sector">--</strong></div>
                </div>
              </div>
              <div class="review-card">
                <h4>Assistance & Balance</h4>
                <div class="review-list">
                  <div><span>Assistance</span><strong id="review-assistance">--</strong></div>
                  <div><span>Balance</span><strong id="review-balance">--</strong></div>
                  <div><span>Last payment</span><strong id="review-last-payment">--</strong></div>
                </div>
              </div>
              <div class="review-card review-history">
                <div class="review-card__head">
                  <h4>Payment history</h4>
                  <span class="chip" id="review-receipt-count">0 receipts</span>
                </div>
                <div class="review-history-list" id="review-history-list">
                  <div class="review-empty">No receipts logged yet.</div>
                </div>
              </div>
            </div>
            <div class="review-column review-column--right">
              <div class="review-card">
                <h4>Receipt actions</h4>
                <div class="review-form-grid">
                  <label>
                    <span>Month</span>
                    <select id="review-month">
                      <option value="">Select month</option>
                    </select>
                  </label>
                  <label>
                    <span>Payment date</span>
                    <input type="date" id="review-date">
                  </label>
                  <label>
                    <span>Amount</span>
                    <input type="number" id="review-amount" min="0" step="50">
                  </label>
                  <label>
                    <span>OR number</span>
                    <input type="text" id="review-or" placeholder="OR-0000">
                    <small>Format: OR-0000</small>
                  </label>
                  <label class="review-full">
                    <span>Notes</span>
                    <textarea id="review-notes" rows="2" placeholder="Optional notes from beneficiary"></textarea>
                  </label>
                  <div class="review-full">
                    <span class="review-label">Proof of payment</span>
                    <div class="review-proof-upload">
                      <input type="file" id="review-proof-input" accept="image/*,.pdf">
                      <div class="review-proof-preview" id="review-proof-preview">
                        <div class="review-empty">No proof uploaded yet.</div>
                      </div>
                      <button type="button" class="app-btn-outline" id="review-open-proof" hidden>Open file</button>
                    </div>
                  </div>
                  <label class="review-full">
                    <span>Admin remarks</span>
                    <textarea id="review-remarks" rows="3" placeholder="Add remarks for audit trail"></textarea>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
        <footer class="admin-modal__footer">
          <button type="button" class="app-btn-ghost" data-modal-close>Cancel</button>
          <button type="button" class="app-btn-outline" id="review-save-draft">Save Draft</button>
          <button type="button" class="app-btn-danger" id="review-reject">Reject</button>
          <button type="button" class="app-btn-primary" id="review-verify">Verify</button>
        </footer>
      </div>
    </div>

    <div class="admin-modal admin-modal--sm" id="proofPreviewModal" aria-hidden="true">
      <div class="admin-modal__backdrop" data-modal-close></div>
      <div class="admin-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="proof-preview-title">
        <header class="admin-modal__header">
          <div>
            <h3 id="proof-preview-title">Proof of Payment</h3>
            <p class="review-subtitle">File preview</p>
          </div>
          <button type="button" class="icon-button admin-modal__close" data-modal-close aria-label="Close">
            <i class="fas fa-xmark"></i>
          </button>
        </header>
        <div class="admin-modal__body">
          <div class="proof-preview-content" id="proof-preview-content">
            <div class="review-empty">No proof uploaded yet.</div>
          </div>
        </div>
        <footer class="admin-modal__footer">
          <button type="button" class="app-btn-ghost" data-modal-close>Close</button>
        </footer>
      </div>
    </div>

    <div class="modal fade" id="userModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-scrollable">
        <div class="modal-content">
          <form id="user-form">
            <div class="modal-header">
              <h5 class="modal-title">Team member</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
            </div>
            <div class="modal-body">
              <input type="hidden" id="u-id">
              <div class="mb-3">
                <label for="u-name" class="form-label">Full name</label>
                <input type="text" class="form-control" id="u-name" required>
              </div>
              <div class="mb-3">
                <label for="u-email" class="form-label">Email</label>
                <input type="email" class="form-control" id="u-email" required>
              </div>
              <div class="mb-0">
                <label for="u-role" class="form-label">Role</label>
                <select id="u-role" class="form-select">
                  <option value="Administrator">Administrator</option>
                  <option value="Project Officer">Project Officer</option>
                  <option value="Social Worker">Social Worker</option>
                  <option value="Validator">Validator</option>
                </select>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button>
              <button type="submit" class="btn btn-primary">Save member</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div id="modal-root"></div>

    <script>
        window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES) ?>;
    </script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/shared/dom.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/shared/format.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/shared/state.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/shared/nav.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/modules/applications.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/modules/team.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/modules/training.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/dashboards/admin.js"></script>
</body>
</html>

























































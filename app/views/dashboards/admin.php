<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<?php /** @var array $overview */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP Admin Control Center</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin.css?v=20260326c">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css" crossorigin="anonymous" referrerpolicy="no-referrer">
</head>
<body>
    <script>
        window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        window.SMARTLEAP_ADMIN_OVERVIEW = <?= json_encode($overview ?? [], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    </script>

    <div id="mainSystem" class="admin-shell" data-sidebar-open="false">
        <aside id="adminSidebar" class="admin-sidebar" aria-hidden="false">
            <div class="sidebar-brand">
                <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP logo" class="brand-logo">
                <div class="brand-copy">
                    <span class="brand-tag">City Government of Butuan</span>
                    <h1 class="brand-title">SMART LEAP Control Center</h1>
                </div>
            </div>

            <div class="admin-sidebar-role">Administrator</div>

            <nav class="sidebar-nav" aria-label="Admin navigation">
                <button class="nav-link active" type="button" data-section="dashboard"><i class="fas fa-gauge"></i><span>Dashboard</span></button>
                <button class="nav-link" type="button" data-section="applications"><i class="fas fa-file-signature"></i><span>Applications</span></button>
                <button class="nav-link" type="button" data-section="training"><i class="fas fa-chalkboard-user"></i><span>Training</span></button>
                <button class="nav-link" type="button" data-section="team"><i class="fas fa-user-group"></i><span>Team</span></button>
                <button class="nav-link" type="button" data-section="beneficiaries"><i class="fas fa-people-group"></i><span>Beneficiaries</span></button>
                <button class="nav-link" type="button" data-section="repayments"><i class="fas fa-receipt"></i><span>Repayments</span></button>
                <button class="nav-link" type="button" data-section="reports"><i class="fas fa-chart-pie"></i><span>Reports</span></button>
                <button class="nav-link" type="button" data-section="notifications"><i class="fas fa-bell"></i><span>Notifications</span></button>
            </nav>

            <div class="sidebar-footer">
                <span>Live sections</span>
                <strong>Dashboard, Applications, Training, Team</strong>
            </div>
        </aside>

        <div class="sidebar-backdrop" data-sidebar-close></div>

        <div class="content-area">
            <header class="content-header admin-topbar">
                <button type="button" class="sidebar-toggle" aria-expanded="false" aria-controls="adminSidebar">
                    <span class="sidebar-toggle-icon" aria-hidden="true"></span>
                    <span class="sidebar-toggle-label">Menu</span>
                </button>

                <div class="content-headline">
                    <span id="adminSectionEyebrow" class="admin-topbar__eyebrow">Admin Workspace</span>
                    <h1 id="adminSectionTitle">Dashboard</h1>
                </div>

                <div class="admin-topbar__actions">
                    <div class="admin-topbar__status">
                        <span id="adminSectionStateBadge" class="admin-state-badge">Live Overview</span>
                        <span class="admin-inline-pill"><?= htmlspecialchars(date('F j, Y'), ENT_QUOTES) ?></span>
                    </div>
                    <button type="button" class="app-btn-outline admin-icon-button" id="adminNotificationsButton" data-section-target="notifications" aria-label="Open notifications">
                        <i class="fas fa-bell"></i>
                    </button>
                    <div class="admin-account-menu">
                        <button type="button" class="app-btn-outline admin-account-menu__trigger" id="adminAccountMenuTrigger" aria-expanded="false">
                            <i class="fas fa-circle-user"></i>
                            <span>Account</span>
                        </button>
                        <div class="admin-account-menu__panel" id="adminAccountMenuPanel" hidden>
                            <div class="admin-account-menu__meta">
                                <strong><?= htmlspecialchars((string) (($authUser['name'] ?? 'Administrator')), ENT_QUOTES) ?></strong>
                                <span>Administrator</span>
                            </div>
                            <button type="button" class="admin-account-menu__item" id="system-logout">
                                <i class="fas fa-arrow-right-from-bracket"></i>
                                <span>Logout</span>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main class="content-main">
                <section id="dashboard-section" class="content-card admin-section" data-role-section>
                    <section class="admin-overview-hero">
                        <div class="admin-overview-hero__copy">
                            <span class="admin-overview-hero__eyebrow">SMART LEAP Control Center</span>
                        </div>
                        <div class="admin-overview-hero__stats">
                            <article class="admin-overview-stat">
                                <span>Review Queue</span>
                                <strong><?= (int) (($overview['applicationSummary']['underReview'] ?? 0) + ($overview['applicationSummary']['forAssessment'] ?? 0)) ?></strong>
                            </article>
                            <article class="admin-overview-stat">
                                <span>Training Load</span>
                                <strong><?= (int) ($overview['trainingSummary']['scheduled'] ?? 0) ?></strong>
                            </article>
                            <article class="admin-overview-stat">
                                <span>Live Staff</span>
                                <strong><?= (int) ($overview['staffSummary']['active'] ?? 0) ?></strong>
                            </article>
                        </div>
                    </section>

                    <div class="section-header admin-layout-header">
                        <div>
                            <h2>Dashboard</h2>
                        </div>
                        <div class="admin-layout-header__chips">
                            <span class="admin-inline-pill admin-inline-pill--live">Live metrics</span>
                            <span class="admin-inline-pill">No mock widgets</span>
                        </div>
                    </div>

                    <div class="metric-grid admin-kpi-grid">
                        <button type="button" class="metric-card metric-card--link" data-section-link="applications">
                            <span class="metric-card__label">Total Applicants</span>
                            <strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['total'] ?? 0) ?></strong>
                        </button>
                        <button type="button" class="metric-card metric-card--link" data-section-link="applications">
                            <span class="metric-card__label">Under Review</span>
                            <strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['underReview'] ?? 0) ?></strong>
                        </button>
                        <button type="button" class="metric-card metric-card--link" data-section-link="training">
                            <span class="metric-card__label">Approved for Training</span>
                            <strong class="metric-card__value"><?= (int) ($overview['applicationSummary']['approvedForTraining'] ?? 0) ?></strong>
                        </button>
                        <button type="button" class="metric-card metric-card--link" data-section-link="beneficiaries">
                            <span class="metric-card__label">Active Beneficiaries</span>
                            <strong class="metric-card__value"><?= (int) ($overview['beneficiarySummary']['active'] ?? 0) ?></strong>
                        </button>
                        <button type="button" class="metric-card metric-card--link <?= !($overview['repaymentSummary']['isLive'] ?? false) ? 'metric-card--muted' : '' ?>" data-section-link="repayments">
                            <span class="metric-card__label">Pending Repayment Verifications</span>
                            <strong class="metric-card__value"><?= ($overview['repaymentSummary']['isLive'] ?? false) ? (int) ($overview['repaymentSummary']['pendingVerification'] ?? 0) : '--' ?></strong>
                        </button>
                        <button type="button" class="metric-card metric-card--link" data-section-link="team">
                            <span class="metric-card__label">Active Staff</span>
                            <strong class="metric-card__value"><?= (int) ($overview['staffSummary']['active'] ?? 0) ?></strong>
                        </button>
                    </div>

                    <section class="admin-surface">
                        <div class="section-header admin-layout-header">
                            <div>
                                <h3>Urgent Action Panel</h3>
                            </div>
                        </div>
                        <div class="table-wrapper">
                            <table class="admin-data-table">
                                <thead>
                                    <tr>
                                        <th>Label</th>
                                        <th>Record</th>
                                        <th>Barangay</th>
                                        <th>Status</th>
                                        <th>Timestamp</th>
                                        <th class="actions">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <?php if (!empty($overview['assessmentQueue'])): ?>
                                        <?php foreach (array_slice(($overview['assessmentQueue'] ?? []), 0, 5) as $queueItem): ?>
                                            <tr>
                                                <td>Application Review</td>
                                                <td>
                                                    <strong><?= htmlspecialchars((string) $queueItem['applicantName'], ENT_QUOTES) ?></strong>
                                                    <div class="table-subcopy"><?= htmlspecialchars((string) ($queueItem['businessName'] ?: 'No business name yet'), ENT_QUOTES) ?></div>
                                                </td>
                                                <td><?= htmlspecialchars((string) $queueItem['barangay'], ENT_QUOTES) ?></td>
                                                <td><span class="table-status-chip"><?= htmlspecialchars((string) $queueItem['status'], ENT_QUOTES) ?></span></td>
                                                <td><?= htmlspecialchars((string) $queueItem['updatedAt'], ENT_QUOTES) ?></td>
                                                <td class="actions">
                                                    <button type="button" class="action-button" data-section-link="applications">
                                                        <i class="fas fa-folder-open"></i>
                                                        <span>Open Review</span>
                                                    </button>
                                                </td>
                                            </tr>
                                        <?php endforeach; ?>
                                    <?php else: ?>
                                        <tr>
                                            <td colspan="6">No urgent live records are currently surfaced from the applications queue.</td>
                                        </tr>
                                    <?php endif; ?>
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section class="admin-surface">
                        <div class="section-header admin-layout-header">
                            <div>
                                <h3>Workflow Overview</h3>
                            </div>
                        </div>
                        <div class="workflow-strip">
                            <article class="workflow-stage"><span>Submitted</span><strong><?= (int) ($overview['applicationSummary']['submitted'] ?? 0) ?></strong></article>
                            <article class="workflow-stage"><span>Under Review</span><strong><?= (int) ($overview['applicationSummary']['underReview'] ?? 0) ?></strong></article>
                            <article class="workflow-stage"><span>Checked by PDO</span><strong><?= (int) ($overview['applicationSummary']['forAssessment'] ?? 0) ?></strong></article>
                            <article class="workflow-stage"><span>Approved</span><strong><?= (int) ($overview['applicationSummary']['approvedForTraining'] ?? 0) ?></strong></article>
                            <article class="workflow-stage"><span>Training Scheduled</span><strong><?= (int) ($overview['trainingSummary']['scheduled'] ?? 0) ?></strong></article>
                            <article class="workflow-stage"><span>Training Completed</span><strong><?= (int) ($overview['trainingSummary']['completed'] ?? 0) ?></strong></article>
                            <article class="workflow-stage workflow-stage--muted"><span>Post-Approval Compliance</span><strong>--</strong></article>
                            <article class="workflow-stage"><span>Beneficiary Active</span><strong><?= (int) ($overview['beneficiarySummary']['active'] ?? 0) ?></strong></article>
                        </div>
                    </section>

                    <div class="admin-dashboard-grid">
                        <section class="admin-surface">
                            <div class="section-header admin-layout-header">
                                <div>
                                    <h3>Recent Activity</h3>
                                </div>
                            </div>
                            <ul class="activity-feed">
                                <?php if (!empty($overview['recentActivity'])): ?>
                                    <?php foreach (($overview['recentActivity'] ?? []) as $activity): ?>
                                        <li class="activity-feed__item">
                                            <div class="activity-feed__copy">
                                                <strong><?= htmlspecialchars((string) $activity['actor'], ENT_QUOTES) ?></strong>
                                                <span><?= htmlspecialchars((string) $activity['action'], ENT_QUOTES) ?></span>
                                                <small><?= htmlspecialchars((string) $activity['target'], ENT_QUOTES) ?></small>
                                            </div>
                                            <time><?= htmlspecialchars((string) $activity['timestamp'], ENT_QUOTES) ?></time>
                                        </li>
                                    <?php endforeach; ?>
                                <?php else: ?>
                                    <li class="activity-feed__item activity-feed__item--empty">No live activity feed entries are available yet.</li>
                                <?php endif; ?>
                            </ul>
                        </section>

                        <section class="admin-surface">
                            <div class="section-header admin-layout-header">
                                <div>
                                    <h3>Quick Actions</h3>
                                </div>
                            </div>
                            <div class="quick-actions-grid">
                                <button type="button" class="app-btn-outline" data-section-link="applications">Review Applications</button>
                                <button type="button" class="app-btn-outline" data-quick-action="create-training">Create Training Program</button>
                                <button type="button" class="app-btn-outline" data-quick-action="assign-pdo">Assign PDO Barangay</button>
                                <button type="button" class="app-btn-outline" data-quick-action="add-staff">Add Staff</button>
                                <button type="button" class="app-btn-outline" data-section-link="repayments">Open Pending Repayments</button>
                                <button type="button" class="app-btn-outline" data-section-link="notifications">View Notifications</button>
                            </div>
                        </section>
                    </div>
                </section>

                <section id="applications-section" class="content-card admin-section" data-role-section hidden></section>
                <section id="training-section" class="content-card admin-section" data-role-section hidden></section>
                <section id="team-section" class="content-card admin-section" data-role-section hidden></section>

                <section id="beneficiaries-section" class="content-card admin-section" data-role-section hidden>
                    <div class="section-header admin-layout-header">
                        <div>
                            <h2>Beneficiaries</h2>
                        </div>
                        <div class="admin-layout-header__chips">
                            <span class="admin-inline-pill admin-inline-pill--draft">Structured only</span>
                        </div>
                    </div>
                    <div class="admin-prep-stack">
                        <div class="filters-row admin-structural-row">
                            <div class="filter-group">
                                <span class="filter-label">Search</span>
                                <div class="filter-search"><i class="fas fa-search"></i><input type="search" placeholder="Search beneficiary name" disabled></div>
                            </div>
                            <div class="filter-group"><span class="filter-label">Barangay</span><select class="filter-select" disabled><option>All barangays</option></select></div>
                            <div class="filter-group"><span class="filter-label">Assigned PDO</span><select class="filter-select" disabled><option>All PDOs</option></select></div>
                            <div class="filter-group"><span class="filter-label">Compliance Status</span><select class="filter-select" disabled><option>All compliance states</option></select></div>
                            <div class="filter-group"><span class="filter-label">Repayment Status</span><select class="filter-select" disabled><option>All repayment states</option></select></div>
                        </div>
                        <div class="placeholder-shell">
                            <div class="placeholder-card">
                                <strong>Prepared structure</strong>
                            </div>
                            <div class="placeholder-card placeholder-card--soft">
                                <strong>Current live signal</strong>
                                <span><?= (int) ($overview['beneficiarySummary']['active'] ?? 0) ?> active beneficiary records</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section id="repayments-section" class="content-card admin-section" data-role-section hidden>
                    <div class="section-header admin-layout-header">
                        <div>
                            <h2>Repayments</h2>
                        </div>
                        <div class="admin-layout-header__chips">
                            <span class="admin-inline-pill <?= ($overview['repaymentSummary']['isLive'] ?? false) ? 'admin-inline-pill--partial' : 'admin-inline-pill--draft' ?>">
                                <?= ($overview['repaymentSummary']['isLive'] ?? false) ? 'Partial live signals' : 'Structured only' ?>
                            </span>
                        </div>
                    </div>
                    <div class="metric-grid metric-grid--compact">
                        <article class="metric-card metric-card--soft">
                            <span class="metric-card__label">Pending Verification</span>
                            <strong class="metric-card__value"><?= ($overview['repaymentSummary']['isLive'] ?? false) ? (int) ($overview['repaymentSummary']['pendingVerification'] ?? 0) : '--' ?></strong>
                        </article>
                        <article class="metric-card metric-card--soft">
                            <span class="metric-card__label">Verified This Month</span>
                            <strong class="metric-card__value"><?= ($overview['repaymentSummary']['isLive'] ?? false) ? (int) ($overview['repaymentSummary']['verifiedThisMonth'] ?? 0) : '--' ?></strong>
                        </article>
                        <article class="metric-card metric-card--soft">
                            <span class="metric-card__label">Overdue Accounts</span>
                            <strong class="metric-card__value"><?= ($overview['repaymentSummary']['isLive'] ?? false) ? (int) ($overview['repaymentSummary']['overdue'] ?? 0) : '--' ?></strong>
                        </article>
                        <article class="metric-card metric-card--soft">
                            <span class="metric-card__label">Credited / Overpaid Cases</span>
                            <strong class="metric-card__value"><?= ($overview['repaymentSummary']['isLive'] ?? false) ? (int) ($overview['repaymentSummary']['credited'] ?? 0) : '--' ?></strong>
                        </article>
                    </div>
                    <div class="placeholder-shell">
                        <div class="placeholder-card">
                            <strong>Prepared structure</strong>
                        </div>
                    </div>
                </section>

                <section id="reports-section" class="content-card admin-section" data-role-section hidden>
                    <div class="section-header admin-layout-header">
                        <div>
                            <h2>Reports</h2>
                        </div>
                        <div class="admin-layout-header__chips">
                            <span class="admin-inline-pill admin-inline-pill--draft">Structured only</span>
                        </div>
                    </div>
                    <div class="filters-row admin-structural-row">
                        <div class="filter-group"><span class="filter-label">Date Range</span><select class="filter-select" disabled><option>Custom date range</option></select></div>
                        <div class="filter-group"><span class="filter-label">Barangay</span><select class="filter-select" disabled><option>All barangays</option></select></div>
                        <div class="filter-group"><span class="filter-label">Program</span><select class="filter-select" disabled><option>All programs</option></select></div>
                        <div class="filter-group"><span class="filter-label">Status</span><select class="filter-select" disabled><option>All statuses</option></select></div>
                    </div>
                    <div class="placeholder-shell placeholder-shell--grid">
                        <div class="placeholder-card"><strong>Applications</strong></div>
                        <div class="placeholder-card"><strong>Training</strong></div>
                        <div class="placeholder-card"><strong>Beneficiary Compliance</strong></div>
                        <div class="placeholder-card"><strong>Repayments</strong></div>
                    </div>
                </section>

                <section id="notifications-section" class="content-card admin-section" data-role-section hidden>
                    <div class="section-header admin-layout-header">
                        <div>
                            <h2>Notifications</h2>
                        </div>
                        <div class="admin-layout-header__chips">
                            <span class="admin-inline-pill admin-inline-pill--draft">Structured only</span>
                        </div>
                    </div>
                    <div class="filters-row admin-structural-row">
                        <div class="filter-group"><span class="filter-label">Tabs</span><select class="filter-select" disabled><option>In-App / Email / Failed / Sent / By Module</option></select></div>
                    </div>
                    <div class="placeholder-shell">
                        <div class="placeholder-card">
                            <strong>Prepared structure</strong>
                        </div>
                    </div>
                </section>

            </main>

            <div id="modal-root"></div>
        </div>
    </div>

    <script src="<?= $baseUrl ?>/assets/js/shared/dom.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/shared/format.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/shared/state.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/modules/applications.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/modules/training.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/modules/team.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/dashboards/admin.js?v=20260326c" defer></script>
</body>
</html>

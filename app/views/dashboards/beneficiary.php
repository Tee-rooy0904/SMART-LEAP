<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Beneficiary Dashboard</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/applicant.css">
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/beneficiary.css">
    <script>
        window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    </script>
</head>
<body>
    <div class="dashboard-shell">
        <aside class="dash-sidebar" id="appSidebar" aria-label="Beneficiary portal navigation">
            <div class="sidebar-drawer__top">
                <div class="sidebar-brand">
                    <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="sidebar-logo">
                    <div class="sidebar-brand__copy">
                        <strong class="sidebar-title">SMART LEAP</strong>
                    </div>
                </div>
                <button type="button" class="sidebar-drawer__close" id="sidebarClose" aria-label="Close navigation">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="sidebar-user">
                <div class="sidebar-avatar" id="sidebarAvatar" aria-hidden="true">M</div>
                <div class="sidebar-user__meta">
                    <span class="sidebar-user__name" id="sidebarUserName">Beneficiary</span>
                    <span class="sidebar-user__biz" id="sidebarUserBusiness">Your livelihood</span>
                </div>
            </div>
            <nav class="sidebar-nav">
                <a class="sidebar-link is-active" href="#overview">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M3 11.5L12 4l9 7.5" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M5.5 10.5V20h13V10.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Overview</span>
                </a>
                <a class="sidebar-link" href="#profile" data-role="beneficiary">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <circle cx="12" cy="8" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M4 20a8 8 0 0116 0" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Profile</span>
                </a>
                <a class="sidebar-link" href="#profile-editor" data-role="applicant">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <circle cx="12" cy="8" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M4 20a8 8 0 0116 0" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Profile</span>
                </a>
                <a class="sidebar-link" href="#repayments" data-role="beneficiary">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <rect x="6" y="4" width="12" height="16" rx="2" stroke-linejoin="round"/>
                            <path d="M9 9h6" stroke-linecap="round"/>
                            <path d="M9 12h6" stroke-linecap="round"/>
                            <path d="M9 15h3" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span>Repayments</span>
                </a>
                <a class="sidebar-link" href="#support-feedback">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M7 7h10a3 3 0 013 3v4a3 3 0 01-3 3h-3l-3 4-3-4H7a3 3 0 01-3-3v-4a3 3 0 013-3z" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Support</span>
                </a>
                <a class="sidebar-link" href="#activity-log" data-role="beneficiary">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M5 6h14" stroke-linecap="round"/>
                            <path d="M5 12h14" stroke-linecap="round"/>
                            <path d="M5 18h8" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span>Activity</span>
                </a>
            </nav>

            <button type="button" class="btn-outline sidebar-logout" id="logoutButton">Logout</button>
        </aside>
        <button type="button" class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true" tabindex="-1"></button>
        <div class="portal-loader" id="portalLoader" aria-live="polite">
            <div class="portal-loader__orb" aria-hidden="true"></div>
            <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="" class="portal-loader__logo">
            <strong class="portal-loader__title">SMART LEAP</strong>
            <p class="portal-loader__copy" id="portalLoaderCopy">Loading your beneficiary portal...</p>
        </div>
        <div class="dash-content">
            <header class="mobile-topbar" aria-label="Beneficiary portal mobile navigation">
                <div class="mobile-topbar__brand">
                    <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="mobile-topbar__logo">
                    <strong class="mobile-topbar__title">SMART LEAP</strong>
                </div>
                <button
                    type="button"
                    class="mobile-topbar__menu"
                    id="sidebarToggle"
                    aria-label="Open navigation"
                    aria-controls="appSidebar"
                    aria-expanded="false"
                >
                    <span class="mobile-topbar__menu-box" aria-hidden="true">
                        <span></span>
                        <span></span>
                        <span></span>
                    </span>
                </button>
            </header>
            <main class="dash-main">
                <section id="overview" class="dash-page dash-page--home dash-section" aria-labelledby="overviewHeading">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Dashboard</p>
                            <h2 id="overviewHeading">Beneficiary dashboard</h2>
                            <p class="dash-page__lead">Review your repayment status, profile details, and support updates in one consistent workspace.</p>
                        </div>
                    </div>
                    <header class="dash-banner" aria-label="Beneficiary overview snapshot">
                        <div class="banner-profile">
                            <div class="banner-avatar" id="bannerAvatar" aria-hidden="true">M</div>
                            <div class="banner-copy">
                                <p class="banner-eyebrow">Welcome back</p>
                                <h1 class="banner-greeting" id="bannerGreeting">Hello, Beneficiary!</h1>
                                <p class="banner-email" id="userEmail">you@gmail.com</p>
                            </div>
                        </div>
                        <ul class="banner-stats">
                            <li>
                                <span class="label" id="bannerLabelOutstanding">Outstanding balance</span>
                                <strong id="bannerOutstanding">&#8369;0.00</strong>
                            </li>
                            <li>
                                <span class="label" id="bannerLabelProgress">Repayment progress</span>
                                <strong id="bannerProgress">0/24 months</strong>
                            </li>
                            <li>
                                <span class="label" id="bannerLabelNextDue">Next due date</span>
                                <strong id="bannerNextDue">--</strong>
                            </li>
                            <li>
                                <span class="label" id="bannerLabelRate">Repayment rate</span>
                                <strong id="bannerRate">0%</strong>
                            </li>
                        </ul>
                    </header>
                    <section class="panel dash-section panel--summary" aria-labelledby="beneficiaryOverviewWorkspaceHeading">
                        <div class="panel-header">
                            <h3 id="beneficiaryOverviewWorkspaceHeading">Overview</h3>
                            <p class="panel-subtitle">Status snapshots for your SMART LEAP account.</p>
                        </div>
                        <div class="overview-layout" data-role="beneficiary">
                            <div class="overview-profile-card">
                                <div class="overview-profile__meta">
                                    <h3 id="overviewName">Beneficiary name</h3>
                                    <p id="overviewBusiness">Business name</p>
                                    <p id="overviewEmail">email@example.com</p>
                                </div>
                                <div class="overview-profile__chip">Beneficiary</div>
                            </div>
                            <div class="overview-progress-grid">
                                <article class="overview-panel">
                                    <span class="overview-panel__label">Outstanding balance</span>
                                    <strong class="overview-panel__value" id="overviewOutstanding">&#8369;0.00</strong>
                                </article>
                                <article class="overview-panel">
                                    <span class="overview-panel__label">Repayment progress</span>
                                    <strong class="overview-panel__value" id="overviewProgress">0/24 months</strong>
                                </article>
                                <article class="overview-panel">
                                    <span class="overview-panel__label">Next due date</span>
                                    <strong class="overview-panel__value" id="overviewDue">--</strong>
                                </article>
                                <article class="overview-panel">
                                    <span class="overview-panel__label">Repayment rate</span>
                                    <strong class="overview-panel__value" id="overviewRate">0%</strong>
                                </article>
                                <button type="button" class="btn-primary overview-panel__action" id="overviewRepaymentsBtn">Go to Repayments</button>
                            </div>
                            <div class="overview-quick-actions">
                                <h3>Quick actions</h3>
                                <ul>
                                    <li id="overviewReminder">Upload OR for --</li>
                                    <li id="overviewAccountAlert">Account updates will appear here.</li>
                                    <li id="overviewSupport">Need help? Contact your PDO.</li>
                                </ul>
                            </div>
                        </div>
                        <div class="overview-grid" data-role="applicant">
                            <article class="overview-card">
                                <span class="overview-label">Account status</span>
                                <strong class="overview-value" id="overviewStatus">Active</strong>
                                <p class="overview-meta" id="overviewStatusNote">Repayment monitoring is ongoing.</p>
                            </article>
                            <article class="overview-card">
                                <span class="overview-label">Requirement progress</span>
                                <strong class="overview-value" id="overviewRequirementsPercent">0/8</strong>
                                <p class="overview-meta" id="overviewRequirementsNote">Continue submitting complete requirements.</p>
                            </article>
                            <article class="overview-card">
                                <span class="overview-label">Next repayment</span>
                                <strong class="overview-value" id="overviewNextDue">--</strong>
                                <p class="overview-meta" id="overviewNextDueNote">Upload monthly OR after payment.</p>
                            </article>
                        </div>
                    </section>
                </section>

                <section id="profile" class="dash-page dash-section" aria-labelledby="beneficiaryProfileHeading" data-role="beneficiary">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Profile</p>
                            <h2 id="beneficiaryProfileHeading">Beneficiary profile</h2>
                            <p class="dash-page__lead">Update your profile details and verify your assigned PDO.</p>
                        </div>
                    </div>
                    <section class="panel dash-section profile-editor-workspace">
                    <div class="profile-card">
                        <div class="profile-photo">
                            <div class="profile-photo__frame">
                                <img id="profilePhotoPreview" src="" alt="Profile photo preview" class="is-hidden">
                                <div class="profile-photo__placeholder" id="profilePhotoPlaceholder">No photo</div>
                            </div>
                            <label class="btn-outline profile-photo__upload">
                                Upload photo
                                <input type="file" id="profilePhotoInput" accept=".jpg,.jpeg,.png" hidden>
                            </label>
                            <p class="profile-photo__note">JPG or PNG, max 2MB.</p>
                        </div>
                        <form id="beneficiaryProfileForm" class="form-grid">
                            <label class="form-field">
                                <span>Full name *</span>
                                <input type="text" id="beneficiaryName" name="fullName" required>
                            </label>
                            <label class="form-field">
                                <span>Business name *</span>
                                <input type="text" id="beneficiaryBusiness" name="businessName" required>
                            </label>
                            <label class="form-field">
                                <span>Email *</span>
                                <input type="email" id="beneficiaryEmail" name="email" required>
                            </label>
                            <label class="form-field">
                                <span>Contact number *</span>
                                <input type="tel" id="beneficiaryContact" name="contact" required>
                            </label>
                            <label class="form-field">
                                <span>Barangay</span>
                                <input type="text" id="beneficiaryBarangay" name="barangay">
                            </label>
                            <div class="form-field">
                                <span>Assigned PDO</span>
                                <div class="profile-readonly">
                                    <strong id="assignedPDOName">Project Officer</strong>
                                    <span id="assignedPDOContact">projectofficer@smartleap.gov.ph</span>
                                </div>
                            </div>
                            <div class="form-actions full">
                                <button type="submit" class="btn-primary">Save changes</button>
                            </div>
                        </form>
                    </div>
                    </section>
                </section>

                <section id="profile-editor" class="dash-page dash-section" aria-labelledby="profileHeading" data-role="applicant">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Profile</p>
                            <h2 id="profileHeading">Applicant profile editor</h2>
                            <p class="dash-page__lead">Keep your personal information up to date for verification.</p>
                        </div>
                    </div>
                    <section class="panel dash-section profile-editor-workspace">
                    <form id="profileForm" class="form-grid">
                        <label class="form-field">
                            <span>Full name *</span>
                            <input type="text" id="profileName" name="fullName" required>
                        </label>
                        <label class="form-field">
                            <span>Email *</span>
                            <input type="email" id="profileEmail" name="email" required>
                        </label>
                        <label class="form-field">
                            <span>Barangay *</span>
                            <input type="text" id="profileBarangay" name="barangay" required>
                        </label>
                        <label class="form-field">
                            <span>Contact number *</span>
                            <input type="tel" id="profileContact" name="contact" required>
                        </label>
                        <div class="form-actions full">
                            <button type="submit" class="btn-primary">Save profile</button>
                        </div>
                    </form>
                    </section>
                </section>

                <section id="requirements-progress" class="dash-page dash-section" aria-labelledby="requirementsHeading" data-role="applicant-extra">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Application</p>
                            <h2 id="requirementsHeading">Requirement progress</h2>
                            <p class="dash-page__lead">Track which documents are complete, missing, or need revision.</p>
                        </div>
                    </div>
                    <section class="panel dash-section panel--summary">
                    <div class="requirements-progress">
                        <div class="requirements-progress__meta">
                            <strong id="requirementsProgressCount">0/8 requirements</strong>
                            <span id="requirementsProgressStatus">Pending review</span>
                        </div>
                        <div class="requirements-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                            <div class="requirements-progress__fill" id="requirementsProgressFill"></div>
                            <span class="requirements-progress__marker" data-value="3">3/8</span>
                            <span class="requirements-progress__marker" data-value="7">7/8</span>
                            <span class="requirements-progress__marker" data-value="8">8/8</span>
                        </div>
                        <ul class="requirements-list" id="requirementsList">
                            <li class="empty">Requirement uploads will appear once reviewed.</li>
                        </ul>
                    </div>
                    </section>
                </section>

                <section id="notifications-panel" class="dash-page dash-section" aria-labelledby="notificationsHeading" data-role="applicant-extra">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Application</p>
                            <h2 id="notificationsHeading">Notifications</h2>
                            <p class="dash-page__lead">PDO messages, repayment reminders, and approval updates.</p>
                        </div>
                    </div>
                    <section class="panel dash-section panel--summary">
                    <ul class="notification-list" id="notificationList">
                        <li class="empty">No notifications yet.</li>
                    </ul>
                    </section>
                </section>

                <section id="repayments" class="dash-page dash-section" aria-labelledby="progressHeading" data-role="beneficiary">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Repayments</p>
                            <h2 id="progressHeading">Repayment workspace</h2>
                            <p class="dash-page__lead">Track your repayment progress, receipts, and verification updates.</p>
                        </div>
                    </div>
                    <div class="repayments-stack">
                        <section class="panel dash-section panel--summary repayment-block" aria-labelledby="repaymentTrackerHeading">
                            <div class="panel-header panel-header--compact">
                                <h3 id="repaymentTrackerHeading">Repayment tracker</h3>
                                <p class="panel-subtitle">Monitor verified months, pending receipts, and overdue follow-ups.</p>
                            </div>
                            <div class="progress-body">
                                <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                                    <div class="progress-bar__fill" id="progressFill"></div>
                                </div>
                                <ul class="progress-stats">
                                    <li><span class="dot verified"></span><strong id="progressVerified">0 months verified</strong></li>
                                    <li><span class="dot pending"></span><strong id="progressPending">0 pending verification</strong></li>
                                    <li><span class="dot uploaded"></span><strong id="progressUploaded">0 uploaded</strong></li>
                                    <li><span class="dot overdue"></span><strong id="progressOverdue">0 overdue</strong></li>
                                </ul>
                            </div>
                        </section>

                        <section class="panel dash-section panel--info repayment-block repayment-actions" data-access="released" aria-labelledby="repaymentActionsHeading">
                            <div class="panel-header panel-header--compact">
                                <h3 id="repaymentActionsHeading">Actions</h3>
                                <p class="panel-subtitle">Submit receipts and keep your repayment records complete.</p>
                            </div>
                            <div class="repayment-actions__grid">
                                <div class="repayment-action-card">
                                    <h4>Upload receipt</h4>
                                    <p>Submit your monthly OR for verification.</p>
                                    <form id="uploadForm" class="form-grid">
                                        <label class="form-field">
                                            <span>OR month *</span>
                                            <input type="month" id="uploadMonth" name="month" required>
                                        </label>
                                        <label class="form-field">
                                            <span>Amount paid *</span>
                                            <input type="number" id="uploadAmount" name="amount" min="0" step="0.01" placeholder="&#8369;625.00" required>
                                        </label>
                                        <label class="form-field">
                                            <span>Payment date *</span>
                                            <input type="date" id="uploadDate" name="paymentDate" required>
                                        </label>
                                        <label class="form-field">
                                            <span>OR number *</span>
                                            <input type="text" id="uploadOr" name="or" placeholder="e.g., OR-2025-0003" required>
                                        </label>
                                        <label class="form-field">
                                            <span>Upload OR (JPEG / PNG / PDF) *</span>
                                            <input type="file" id="uploadFile" name="file" accept=".jpg,.jpeg,.png,.pdf" required>
                                        </label>
                                        <label class="form-field full">
                                            <span>Notes for verifier</span>
                                            <textarea id="uploadNotes" name="notes" rows="3" placeholder="Optional message"></textarea>
                                        </label>
                                        <div class="form-actions full">
                                            <button type="submit" class="btn-primary">Submit receipt</button>
                                        </div>
                                    </form>
                                </div>
                                <div class="repayment-action-card">
                                    <h4>Need help?</h4>
                                    <ul>
                                        <li>Review your repayment schedule in the Support section.</li>
                                        <li>Keep digital and hard copies of your OR.</li>
                                        <li>Contact your PDO for verification follow-ups.</li>
                                    </ul>
                                </div>
                            </div>
                        </section>

                        <section class="panel dash-section panel--review repayment-block history repayment-history-block" aria-labelledby="historyHeading">
                            <div class="panel-header">
                                <div class="breadcrumb">Repayments &gt; History</div>
                                <h2 id="historyHeading">Repayment history</h2>
                                <p class="panel-subtitle">Official log of OR submissions and their status.</p>
                                <span class="panel-counter" id="historyCounter">0 receipts</span>
                            </div>
                            <div class="history-filters">
                                <label>
                                    <span>Status</span>
                                    <select id="historyFilterStatus">
                                        <option value="">All</option>
                                        <option value="verified">Verified</option>
                                        <option value="pending">Pending</option>
                                        <option value="rejected">Rejected</option>
                                    </select>
                                </label>
                                <label>
                                    <span>Month</span>
                                    <input type="month" id="historyFilterMonth">
                                </label>
                            </div>
                            <div class="history-metrics" role="list">
                                <article class="history-metric history-metric--verified" role="listitem">
                                    <span class="history-metric__label">Verified receipts</span>
                                    <strong class="history-metric__value" id="historyVerifiedCount">0 receipts</strong>
                                </article>
                                <article class="history-metric history-metric--pending" role="listitem">
                                    <span class="history-metric__label">Pending verification</span>
                                    <strong class="history-metric__value" id="historyPendingCount">0 receipts</strong>
                                </article>
                                <article class="history-metric history-metric--uploaded" role="listitem">
                                    <span class="history-metric__label">Uploaded online</span>
                                    <strong class="history-metric__value" id="historyUploadedCount">0 receipts</strong>
                                </article>
                            </div>
                            <div class="table-responsive">
                                <table class="table history-table">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th>Paid on</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                            <th>OR / Proof</th>
                                            <th>Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody id="historyTableBody">
                                        <tr class="empty">
                                            <td colspan="6">No receipts yet. Log your first OR to begin.</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    </div>
                </section>

                <section id="support-feedback" class="dash-page dash-section" aria-label="Support and feedback">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Support</p>
                            <h2 id="supportPageHeading">Support and feedback</h2>
                            <p class="dash-page__lead">Reach your project officer, review reminders, and send feedback in the same consistent workspace.</p>
                        </div>
                    </div>
                    <div class="insight-grid">
                    <section class="panel dash-section panel--summary feedback" aria-labelledby="feedbackHeading">
                        <div class="panel-header">
                            <h2 id="feedbackHeading">Send feedback</h2>
                            <p class="panel-subtitle">Tell us how SMART LEAP can better support your livelihood.</p>
                        </div>
                        <form id="feedbackForm" class="form-grid">
                            <label class="form-field full">
                                <span>Your message *</span>
                                <textarea id="feedbackMessage" name="message" rows="4" placeholder="Share your suggestion or concern" required></textarea>
                            </label>
                            <div class="form-actions full">
                                <button type="submit" class="btn-primary">Send feedback</button>
                            </div>
                        </form>
                        <ul id="feedbackList" class="feedback-list">
                            <li class="empty">No feedback submitted yet.</li>
                        </ul>
                    </section>

                    <section class="panel dash-section panel--support support" aria-labelledby="supportHeading">
                        <div class="support-card">
                            <div class="support-card__header panel-header">
                                <h2 id="supportHeading">Need assistance?</h2>
                                <p class="panel-subtitle">Quick reminders and ways to reach the SMART LEAP team.</p>
                            </div>
                            <div class="support-card__grid">
                                <section class="support-card__section" data-role="beneficiary">
                                    <span class="support-card__eyebrow">Next repayment</span>
                                    <strong class="support-card__primary" id="supportNextDue">--</strong>
                                    <p class="support-card__meta" id="supportOutstanding">Outstanding &#8369;0</p>
                                    <p class="support-card__meta" id="supportRate">Completion 0%</p>
                                </section>
                                <section class="support-card__section">
                                    <span class="support-card__eyebrow">Project officer</span>
                                    <ul class="support-card__list">
                                        <li>Email: <a href="mailto:projectofficer@smartleap.gov.ph">projectofficer@smartleap.gov.ph</a></li>
                                        <li>Mobile: 0917 555 1234</li>
                                        <li>Office hours: Mon-Fri, 8 AM - 5 PM</li>
                                    </ul>
                                </section>
                            </div>
                            <section class="support-card__section support-card__section--checklist" data-role="beneficiary">
                                <span class="support-card__eyebrow">Checklist</span>
                                <ul class="support-card__list support-card__list--bullets">
                                    <li>Upload OR within 3 days of payment.</li>
                                    <li>Bring the physical OR to CSWDD for verification.</li>
                                    <li>Coordinate with your PDO for account and repayment updates.</li>
                                </ul>
                            </section>
                        </div>
                    </section>
                    </div>
                </section>

                <section id="activity-log" class="dash-page dash-section" aria-labelledby="auditHeading" data-role="beneficiary">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Activity</p>
                            <h2 id="auditHeading">Activity log</h2>
                            <p class="dash-page__lead">Recent actions recorded by project officers and administrators.</p>
                        </div>
                    </div>
                    <section class="panel dash-section panel--review">
                        <ul id="auditList" class="audit-list">
                            <li class="empty">No activity yet.</li>
                        </ul>
                    </section>
                </section>
            </main>

            <footer class="dash-footer">
            </footer>
        </div>
    </div>

    <div class="toast-stack" id="toastStack" aria-live="polite" aria-atomic="true"></div>

    <script src="<?= $baseUrl ?>/assets/js/dashboards/beneficiary.js" defer></script>
</body>
</html>






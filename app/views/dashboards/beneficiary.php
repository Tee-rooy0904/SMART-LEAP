<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Beneficiary Dashboard</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/beneficiary.css">
</head>
<body>
    <div class="dashboard-shell">
        <aside class="dash-sidebar" aria-label="Beneficiary navigation">
            <div class="sidebar-brand">
                <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="sidebar-logo">
                <div class="sidebar-brand__copy">
                    <strong class="sidebar-title">SMART LEAP</strong>
                </div>
            </div>

            <div class="sidebar-user">
                <div class="sidebar-avatar" id="sidebarAvatar" aria-hidden="true">M</div>
                <div class="sidebar-user__meta">
                    <span class="sidebar-user__name" id="sidebarUserName">Beneficiary</span>
                    <span class="sidebar-user__biz" id="sidebarUserBusiness">Your livelihood</span>
                </div>
            </div>
            <button type="button" class="btn-outline sidebar-toggle" id="sidebarToggle">Menu</button>

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
                <a class="sidebar-link" href="#training-progress">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M3 9l9-4 9 4-9 4-9-4z" stroke-linejoin="round"/>
                            <path d="M7 11v5c0 1.66 2.91 3 5 3s5-1.34 5-3v-5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Training</span>
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

        <div class="dash-content">
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

            <main class="dash-main">
                <section id="overview" class="panel dash-section" aria-labelledby="overviewHeading">
                    <div class="panel-header">
                        <h2 id="overviewHeading">Overview</h2>
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
                                <li id="overviewTrainingAlert">Training session updates will appear here.</li>
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
                            <span class="overview-label">Training completion</span>
                            <strong class="overview-value" id="overviewTrainingPercent">0%</strong>
                            <p class="overview-meta" id="overviewTrainingNote">Awaiting next session schedule.</p>
                        </article>
                        <article class="overview-card">
                            <span class="overview-label">Next repayment</span>
                            <strong class="overview-value" id="overviewNextDue">--</strong>
                            <p class="overview-meta" id="overviewNextDueNote">Upload monthly OR after payment.</p>
                        </article>
                    </div>
                </section>

                <section id="profile" class="panel dash-section" aria-labelledby="beneficiaryProfileHeading" data-role="beneficiary">
                    <div class="panel-header">
                        <h2 id="beneficiaryProfileHeading">Profile</h2>
                        <p class="panel-subtitle">Update your profile details and verify your assigned PDO.</p>
                    </div>
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

                <section id="profile-editor" class="panel dash-section" aria-labelledby="profileHeading" data-role="applicant">
                    <div class="panel-header">
                        <h2 id="profileHeading">Profile editor</h2>
                        <p class="panel-subtitle">Keep your personal information up to date for verification.</p>
                    </div>
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

                <section id="requirements-progress" class="panel dash-section" aria-labelledby="requirementsHeading" data-role="applicant-extra">
                    <div class="panel-header">
                        <h2 id="requirementsHeading">Requirement progress</h2>
                        <p class="panel-subtitle">Track which documents are complete, missing, or need revision.</p>
                    </div>
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

                <section id="notifications-panel" class="panel dash-section" aria-labelledby="notificationsHeading" data-role="applicant-extra">
                    <div class="panel-header">
                        <h2 id="notificationsHeading">Notifications</h2>
                        <p class="panel-subtitle">PDO messages, training reminders, and approval updates.</p>
                    </div>
                    <ul class="notification-list" id="notificationList">
                        <li class="empty">No notifications yet.</li>
                    </ul>
                </section>

                <section id="repayments" class="panel progress dash-section" aria-labelledby="progressHeading" data-role="beneficiary">
                    <div class="panel-header">
                        <div class="breadcrumb">Repayments</div>
                        <h2 id="progressHeading">Repayments</h2>
                        <p class="panel-subtitle">Track your repayment progress, receipts, and verification updates.</p>
                    </div>
                    <div class="repayments-stack">
                        <div class="repayment-block">
                            <h3>Repayment tracker</h3>
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
                        </div>

                        <div class="repayment-block repayment-actions" data-access="released">
                            <h3>Actions</h3>
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
                        </div>

                        <div class="repayment-block history repayment-history-block" aria-labelledby="historyHeading">
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
                        </div>
                    </div>
                </section>

                <section id="training-progress" class="panel training dash-section training-overview" aria-labelledby="trainingHeading">
                    <div class="panel-header">
                        <h2 id="trainingHeading">Training progress</h2>
                        <p class="panel-subtitle">Monitor modules completed, upcoming sessions, and attendance requirements.</p>
                    </div>
                    <div class="training-completed-card is-hidden" id="trainingCompletedCard">
                        <h3>Training completed</h3>
                        <p id="trainingCompletedMeta">8 modules completed</p>
                        <div class="training-completed__stats">
                            <span id="trainingCompletedAttendance">Attendance: 100%</span>
                            <span id="trainingCertificateIssued">Certificate issued on --</span>
                        </div>
                        <button type="button" class="btn-outline" id="trainingViewCertificate">View certificate</button>
                    </div>
                    <div class="training-tabs" id="trainingTabs" role="tablist" aria-label="Training views">
                        <button class="training-tab is-active" type="button" data-training-tab="schedule" role="tab" aria-selected="true">Sessions</button>
                        <button class="training-tab" type="button" data-training-tab="attendance" role="tab" aria-selected="false">Attendance</button>
                    </div>
                    <div class="training-dashboard">
                        <div class="training-dashboard__primary">
                            <div class="training-ring" id="trainingRing" style="--progress: 0deg;">
                                <div class="training-ring__value" id="trainingPercent">0%</div>
                                <div class="training-ring__label">complete</div>
                            </div>
                            <p class="training-dashboard__hint" id="trainingSummaryNote">Training assignments will appear here once scheduled.</p>
                        </div>
                        <div class="training-dashboard__stats">
                            <div class="training-stat">
                                <span class="training-stat__label">Completed</span>
                                <span class="training-stat__value" id="trainingCompletedCount">0 modules</span>
                            </div>
                            <div class="training-stat">
                                <span class="training-stat__label">Upcoming</span>
                                <span class="training-stat__value" id="trainingPendingCount">0 modules</span>
                            </div>
                            <div class="training-stat">
                                <span class="training-stat__label">Absent</span>
                                <span class="training-stat__value" id="trainingAbsenceCount">0</span>
                            </div>
                            <div class="training-stat">
                                <span class="training-stat__label">Excused</span>
                                <span class="training-stat__value" id="trainingExcusedCount">0</span>
                            </div>
                        </div>
                        <div class="training-dashboard__next is-empty" id="trainingNextCard">
                            <h3>Next session</h3>
                            <p class="training-next__title" id="trainingNextTitle">No upcoming session scheduled</p>
                            <p class="training-next__meta" id="trainingNextMeta"></p>
                        </div>
                    </div>
                    <div class="training-progress-track">
                        <div class="training-progress-fill" id="trainingProgressFill"></div>
                    </div>
                    <p class="training-progress-meta" id="trainingProgressMeta">0% attendance completion</p>
                    <span class="training-streak" id="trainingStreakBadge">Streak: 0</span>
                    <div class="training-checklist">
                        <h3>Training requirement checklist</h3>
                        <ul id="trainingChecklist">
                            <li class="empty">Training checklist will appear once sessions are scheduled.</li>
                        </ul>
                    </div>
                    <div class="training-panel is-active" data-training-panel="schedule" role="tabpanel">
                        <div class="panel-header">
                            <h2 id="scheduleHeading">Upcoming sessions</h2>
                            <p class="panel-subtitle">Dates, venues, and facilitators for your SMART LEAP cohort.</p>
                        </div>
                        <div class="training-schedule-grid" id="trainingScheduleGrid">
                            <article class="training-schedule-empty">No training schedule yet. Coordinate with your project officer.</article>
                        </div>
                    </div>
                    <div class="training-panel" data-training-panel="attendance" role="tabpanel">
                        <div class="panel-header">
                            <h2 id="attendanceHeading">Attendance log</h2>
                            <p class="panel-subtitle">Monitor attendance tags set by your project officer.</p>
                        </div>
                        <div class="attendance-metrics" role="list">
                            <article class="attendance-metric" role="listitem">
                                <span class="attendance-metric__label">Present</span>
                                <strong class="attendance-metric__value" id="attendancePresentCount">0</strong>
                            </article>
                            <article class="attendance-metric" role="listitem">
                                <span class="attendance-metric__label">Late</span>
                                <strong class="attendance-metric__value" id="attendanceLateCount">0</strong>
                            </article>
                            <article class="attendance-metric" role="listitem">
                                <span class="attendance-metric__label">Absent</span>
                                <strong class="attendance-metric__value" id="attendanceAbsentCount">0</strong>
                            </article>
                            <article class="attendance-metric" role="listitem">
                                <span class="attendance-metric__label">Upcoming</span>
                                <strong class="attendance-metric__value" id="attendancePendingCount">0</strong>
                            </article>
                        </div>
                        <div class="table-wrapper table-wrapper--soft">
                            <table class="attendance-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Session</th>
                                        <th scope="col">Date &amp; Time</th>
                                        <th scope="col">Status</th>
                                        <th scope="col">Remarks</th>
                                        <th scope="col">Proof</th>
                                    </tr>
                                </thead>
                                <tbody id="attendanceTableBody">
                                    <tr class="empty">
                                        <td colspan="5">Attendance updates will appear once sessions begin.</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>



                <section id="support-feedback" class="insight-grid dash-section" aria-label="Support and feedback">
                    <div class="panel feedback" aria-labelledby="feedbackHeading">
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
                    </div>

                    <div class="panel support" aria-labelledby="supportHeading">
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
                                    <li>Coordinate with your PDO for training updates.</li>
                                </ul>
                            </section>
                        </div>
                    </div>
                </section>

                <section id="activity-log" class="panel audit dash-section" aria-labelledby="auditHeading" data-role="beneficiary">
                    <div class="panel-header">
                        <h2 id="auditHeading">Activity log</h2>
                        <p class="panel-subtitle">Recent actions recorded by project officers and administrators.</p>
                    </div>
                    <ul id="auditList" class="audit-list">
                        <li class="empty">No activity yet.</li>
                    </ul>
                </section>
                <section id="training-certificate" class="panel dash-section training-certificate" aria-labelledby="certificateHeading" data-role="applicant-extra">
                    <div class="panel-header">
                        <h2 id="certificateHeading">Certificate of completion</h2>
                        <p class="panel-subtitle">Upload your training certificate after completing all sessions.</p>
                    </div>
                    <div class="certificate-grid">
                        <div class="certificate-status">
                            <strong id="certificateStatus">Not available</strong>
                            <p id="certificateNote">Complete all training sessions to unlock certificate uploads.</p>
                        </div>
                        <form id="certificateForm" class="form-grid certificate-form">
                            <label class="form-field">
                                <span>Certificate file (PDF / PNG / JPG) *</span>
                                <input type="file" id="certificateFile" name="certificateFile" accept=".pdf,.png,.jpg,.jpeg" required>
                            </label>
                            <div class="form-actions full">
                                <button type="submit" class="btn-primary" id="certificateSubmit">Upload certificate</button>
                            </div>
                        </form>
                    </div>
                </section>
            </main>

            <footer class="dash-footer">
            </footer>
        </div>
    </div>

    <div class="toast-stack" id="toastStack" aria-live="polite" aria-atomic="true"></div>

    <script src="<?= $baseUrl ?>/assets/js/modules/training-shared.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/modules/training-components.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/dashboards/beneficiary.js" defer></script>
</body>
</html>






<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Applicant Dashboard</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/applicant.css">
</head>
<body>
    <script>
        window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
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
                <a class="sidebar-link" href="#profile-summary">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <circle cx="12" cy="8" r="4" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M4 20a8 8 0 0116 0" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Profile</span>
                </a>
                <a class="sidebar-link" href="#requirements-progress">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M8 7h8" stroke-linecap="round"/>
                            <path d="M8 12h8" stroke-linecap="round"/>
                            <path d="M8 17h5" stroke-linecap="round"/>
                            <rect x="5" y="3" width="14" height="18" rx="2" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Requirements</span>
                </a>
                <a class="sidebar-link" href="#application-status">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M6 12l4 4L18 8" stroke-linecap="round" stroke-linejoin="round"/>
                            <circle cx="12" cy="12" r="9" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Status &amp; Remarks</span>
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
                <a class="sidebar-link" href="<?= $baseUrl ?>/post-approval">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M12 3l7 4v5c0 4.5-2.6 7.9-7 9-4.4-1.1-7-4.5-7-9V7l7-4z" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Post-Approval</span>
                </a>
                <a class="sidebar-link" href="#notifications-panel">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M6 9a6 6 0 1112 0v4l2 3H4l2-3V9z" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M10 19a2 2 0 004 0" stroke-linecap="round"/>
                        </svg>
                    </span>
                    <span>Notifications</span>
                </a>
                <a class="sidebar-link" href="#support-panel">
                    <span class="sidebar-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" role="presentation">
                            <path d="M7 7h10a3 3 0 013 3v4a3 3 0 01-3 3h-3l-3 4-3-4H7a3 3 0 01-3-3v-4a3 3 0 013-3z" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>Support</span>
                </a>
            </nav>

            <button type="button" class="btn-outline sidebar-logout" id="logoutButton">Logout</button>
        </aside>

        <div class="dash-content">
            <header class="dash-banner" aria-label="Applicant overview snapshot">
                <div class="banner-profile">
                    <div class="banner-avatar" id="bannerAvatar" aria-hidden="true">A</div>
                    <div class="banner-copy">
                        <p class="banner-eyebrow">SMART LEAP Applicant</p>
                        <h1 class="banner-greeting" id="bannerGreeting">Hello, Applicant!</h1>
                        <p class="banner-email" id="userEmail">you@example.com</p>
                    </div>
                </div>
                <ul class="banner-stats">
                    <li>
                        <span class="label">Application status</span>
                        <strong id="bannerStatus">Draft</strong>
                    </li>
                    <li>
                        <span class="label">Profile completion</span>
                        <strong id="bannerProfileCompletion">0%</strong>
                    </li>
                    <li>
                        <span class="label">Training status</span>
                        <strong id="bannerTrainingStatus">Not Scheduled</strong>
                    </li>
                    <li>
                        <span class="label">Next step</span>
                        <strong id="bannerNextStep">Complete your profile</strong>
                    </li>
                </ul>
            </header>

            <main class="dash-main">
                <section id="overview" class="panel dash-section" aria-labelledby="overviewHeading">
                    <div class="panel-header">
                        <h2 id="overviewHeading">Overview</h2>
                        <p class="panel-subtitle">Real-time status snapshots from your SMART LEAP applicant record.</p>
                    </div>
                    <div class="overview-grid">
                        <article class="overview-card">
                            <span class="overview-label">Application status</span>
                            <strong class="overview-value" id="overviewStatus">Draft</strong>
                            <p class="overview-meta" id="overviewStatusNote">Your application has not been submitted yet.</p>
                        </article>
                        <article class="overview-card">
                            <span class="overview-label">Requirements</span>
                            <strong class="overview-value" id="overviewRequirements">0/3 uploaded</strong>
                            <p class="overview-meta" id="overviewRequirementsNote">Upload the required files in profile completion.</p>
                        </article>
                        <article class="overview-card">
                            <span class="overview-label">Training progress</span>
                            <strong class="overview-value" id="overviewTrainingStatus">Not Scheduled</strong>
                            <p class="overview-meta" id="overviewTrainingNote">No training schedule has been assigned yet.</p>
                        </article>
                        <article class="overview-card">
                            <span class="overview-label">Current next step</span>
                            <strong class="overview-value" id="overviewNextStepTitle">Complete your applicant profile</strong>
                            <p class="overview-meta" id="overviewNextStepDescription">Your next required action will appear here.</p>
                        </article>
                    </div>
                </section>

                <section id="profile-summary" class="panel dash-section" aria-labelledby="profileHeading">
                    <div class="panel-header">
                        <h2 id="profileHeading">Profile summary</h2>
                        <p class="panel-subtitle">This reflects the profile currently linked to your authenticated applicant account.</p>
                    </div>
                    <form id="profileSummaryForm" class="form-grid">
                        <label class="form-field">
                            <span>Full name</span>
                            <input type="text" id="profileName" readonly>
                        </label>
                        <label class="form-field">
                            <span>Email</span>
                            <input type="email" id="profileEmail" readonly>
                        </label>
                        <label class="form-field">
                            <span>Barangay</span>
                            <input type="text" id="profileBarangay" readonly>
                        </label>
                        <label class="form-field">
                            <span>Contact number</span>
                            <input type="text" id="profileContact" readonly>
                        </label>
                        <label class="form-field">
                            <span>Address</span>
                            <input type="text" id="profileAddress" readonly>
                        </label>
                        <label class="form-field">
                            <span>Business name</span>
                            <input type="text" id="profileBusinessName" readonly>
                        </label>
                        <label class="form-field">
                            <span>Main livelihood</span>
                            <input type="text" id="profileLivelihood" readonly>
                        </label>
                        <label class="form-field">
                            <span>Sector</span>
                            <input type="text" id="profileSector" readonly>
                        </label>
                        <label class="form-field">
                            <span>Household size</span>
                            <input type="text" id="profileHouseholdSize" readonly>
                        </label>
                        <label class="form-field">
                            <span>Gender</span>
                            <input type="text" id="profileGender" readonly>
                        </label>
                        <label class="form-field">
                            <span>Birthdate</span>
                            <input type="text" id="profileBirthdate" readonly>
                        </label>
                        <label class="form-field">
                            <span>4Ps membership</span>
                            <input type="text" id="profile4ps" readonly>
                        </label>
                        <div class="form-actions full">
                            <button type="button" class="btn-primary" id="openProfileCompletion">Open profile completion</button>
                        </div>
                    </form>
                </section>

                <section id="requirements-progress" class="panel dash-section" aria-labelledby="requirementsHeading">
                    <div class="panel-header">
                        <h2 id="requirementsHeading">Initial requirements</h2>
                        <p class="panel-subtitle">Only the real uploaded requirement records from your application are shown here.</p>
                    </div>
                    <div class="requirements-progress">
                        <div class="requirements-progress__meta">
                            <strong id="requirementsProgressCount">0/3 requirements</strong>
                            <span id="requirementsProgressStatus">No uploaded requirements yet.</span>
                        </div>
                        <div class="requirements-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
                            <div class="requirements-progress__fill" id="requirementsProgressFill"></div>
                        </div>
                        <ul class="requirements-list" id="requirementsList">
                            <li class="empty">No requirement records available yet.</li>
                        </ul>
                    </div>
                </section>

                <section id="application-status" class="panel dash-section" aria-labelledby="applicationStatusHeading">
                    <div class="panel-header">
                        <h2 id="applicationStatusHeading">Application status and reviewer remarks</h2>
                        <p class="panel-subtitle">Track the real review history, assigned PDO, and visible remarks on your application.</p>
                    </div>
                    <div class="overview-grid status-summary-grid">
                        <article class="overview-card">
                            <span class="overview-label">Current status</span>
                            <strong class="overview-value" id="applicationStatusValue">Draft</strong>
                            <p class="overview-meta" id="applicationStatusDates">Not submitted yet.</p>
                        </article>
                        <article class="overview-card">
                            <span class="overview-label">Assigned project officer</span>
                            <strong class="overview-value" id="assignedPdoName">Not assigned</strong>
                            <p class="overview-meta" id="assignedPdoEmail">Assigned PDO details will appear here.</p>
                        </article>
                        <article class="overview-card">
                            <span class="overview-label">Requirement review</span>
                            <strong class="overview-value" id="requirementReviewValue">0 verified</strong>
                            <p class="overview-meta" id="requirementReviewNote">No requirement review activity yet.</p>
                        </article>
                        <article class="overview-card">
                            <span class="overview-label">Post-approval compliance</span>
                            <strong class="overview-value" id="postApprovalValue">Locked</strong>
                            <p class="overview-meta" id="postApprovalNote">Training completion has not unlocked post-approval tasks yet.</p>
                        </article>
                    </div>
                    <div class="status-panels">
                        <div class="status-panel">
                            <h3>Status history</h3>
                            <ul class="timeline-list" id="historyList">
                                <li class="empty">No status history yet.</li>
                            </ul>
                        </div>
                        <div class="status-panel">
                            <h3>Visible remarks</h3>
                            <ul class="timeline-list" id="remarksList">
                                <li class="empty">No applicant-visible remarks yet.</li>
                            </ul>
                        </div>
                    </div>
                </section>

                <section id="training-progress" class="panel training dash-section training-overview" aria-labelledby="trainingHeading">
                    <div class="panel-header">
                        <h2 id="trainingHeading">Training progress</h2>
                        <p class="panel-subtitle">Only real training assignments, notices, and attendance records appear here.</p>
                    </div>
                    <div class="training-dashboard">
                        <div class="training-dashboard__primary">
                            <div class="training-ring" id="trainingRing" style="--progress: 0deg;">
                                <div class="training-ring__value" id="trainingPercent">0%</div>
                                <div class="training-ring__label">complete</div>
                            </div>
                            <p class="training-dashboard__hint" id="trainingSummaryNote">No training assignment has been recorded yet.</p>
                        </div>
                        <div class="training-dashboard__stats">
                            <div class="training-stat">
                                <span class="training-stat__label">Scheduled</span>
                                <span class="training-stat__value" id="trainingScheduledCount">0</span>
                            </div>
                            <div class="training-stat">
                                <span class="training-stat__label">Notified</span>
                                <span class="training-stat__value" id="trainingNotifiedCount">0</span>
                            </div>
                            <div class="training-stat">
                                <span class="training-stat__label">Attended</span>
                                <span class="training-stat__value" id="trainingAttendedCount">0</span>
                            </div>
                            <div class="training-stat">
                                <span class="training-stat__label">Completed</span>
                                <span class="training-stat__value" id="trainingCompletedCount">0</span>
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
                    <p class="training-progress-meta" id="trainingProgressMeta">0% completion</p>
                    <div class="training-checklist">
                        <h3>Assigned sessions</h3>
                        <ul id="trainingChecklist">
                            <li class="empty">No training sessions have been assigned yet.</li>
                        </ul>
                    </div>
                    <div class="training-panel is-active" data-training-panel="schedule" role="tabpanel">
                        <div class="panel-header">
                            <h2>Training schedule</h2>
                            <p class="panel-subtitle">Schedule details and instructions for your assigned SMART LEAP sessions.</p>
                        </div>
                        <div class="training-schedule-grid" id="trainingScheduleGrid">
                            <article class="training-schedule-empty">No training schedule yet. Wait for CSWDD notice updates.</article>
                        </div>
                    </div>
                    <div class="panel-header" style="margin-top: 24px;">
                        <h2>Attendance log</h2>
                        <p class="panel-subtitle">Attendance is shown exactly as recorded by the assigned project officer or administrator.</p>
                    </div>
                    <div class="attendance-metrics" role="list">
                        <article class="attendance-metric" role="listitem">
                            <span class="attendance-metric__label">Scheduled</span>
                            <strong class="attendance-metric__value" id="attendanceScheduledCount">0</strong>
                        </article>
                        <article class="attendance-metric" role="listitem">
                            <span class="attendance-metric__label">Notified</span>
                            <strong class="attendance-metric__value" id="attendanceNotifiedCount">0</strong>
                        </article>
                        <article class="attendance-metric" role="listitem">
                            <span class="attendance-metric__label">Missed</span>
                            <strong class="attendance-metric__value" id="attendanceMissedCount">0</strong>
                        </article>
                        <article class="attendance-metric" role="listitem">
                            <span class="attendance-metric__label">Completed</span>
                            <strong class="attendance-metric__value" id="attendanceCompletedCount">0</strong>
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
                                    <th scope="col">Notice</th>
                                </tr>
                            </thead>
                            <tbody id="attendanceTableBody">
                                <tr class="empty">
                                    <td colspan="5">Attendance updates will appear once sessions are assigned.</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="training-certificate-card">
                        <div class="training-certificate-card__copy">
                            <h3>Certificate of completion</h3>
                            <p class="panel-subtitle" id="certificateNote">Complete all required trainings and post-approval forms to unlock your certificate.</p>
                        </div>
                        <div class="training-certificate-card__status">
                            <strong id="certificateStatus">Locked</strong>
                            <p id="certificateMeta">0/0 trainings completed · 0/0 verified forms</p>
                        </div>
                        <div class="training-certificate-card__actions">
                            <button type="button" class="btn-primary" id="downloadCertificateButton" disabled>Download certificate (PDF)</button>
                        </div>
                    </div>
                </section>

                <section id="post-approval-compliance" class="panel dash-section" aria-labelledby="postApprovalHeading">
                    <div class="panel-header">
                        <h2 id="postApprovalHeading">Post-approval compliance</h2>
                        <p class="panel-subtitle">Track your unlocked CSWDD forms and open the dedicated post-approval task workspace when you are ready to continue.</p>
                    </div>
                    <div class="post-approval-summary">
                        <article class="post-approval-metric">
                            <span class="overview-label">Unlock state</span>
                            <strong class="overview-value" id="postApprovalUnlockState">Locked</strong>
                            <p class="overview-meta" id="postApprovalUnlockMeta">Training completion has not unlocked post-approval forms yet.</p>
                        </article>
                        <article class="post-approval-metric">
                            <span class="overview-label">Task progress</span>
                            <strong class="overview-value" id="postApprovalProgressValue">0/0 ready</strong>
                            <p class="overview-meta" id="postApprovalProgressMeta">No post-approval tasks available yet.</p>
                        </article>
                        <article class="post-approval-metric">
                            <span class="overview-label">Immediate priority</span>
                            <strong class="overview-value" id="postApprovalPriority">Await training unlock</strong>
                            <p class="overview-meta" id="postApprovalPriorityMeta">Availment and Validation forms will appear here once unlocked.</p>
                        </article>
                    </div>
                    <div class="post-approval-launcher">
                        <div class="post-approval-launcher__copy">
                            <h3>Required tasks</h3>
                            <p id="postApprovalLauncherMeta">Open the dedicated task tracker to review unlocked forms, statuses, and next actions.</p>
                        </div>
                        <div class="post-approval-launcher__actions">
                            <span class="chip" id="postApprovalTaskCount">0 tasks</span>
                            <button type="button" class="btn-primary" id="openPostApprovalTracker">Open task tracker</button>
                        </div>
                    </div>
                    <div class="post-approval-preview">
                        <div class="post-approval-preview__header">
                            <h3>Task preview</h3>
                            <p class="panel-subtitle">A quick status preview only. Full forms now open in the dedicated post-approval pages.</p>
                        </div>
                        <div class="post-approval-taskcards post-approval-taskcards--compact" id="postApprovalTaskCards">
                            <article class="post-approval-taskcard is-empty">Post-approval tasks will appear here after training completion.</article>
                        </div>
                    </div>
                </section>

                <section id="notifications-panel" class="panel dash-section" aria-labelledby="notificationsHeading">
                    <div class="panel-header">
                        <h2 id="notificationsHeading">Notifications</h2>
                        <p class="panel-subtitle">Training notices, review updates, and applicant-facing reminders from the backend.</p>
                    </div>
                    <ul class="notification-list" id="notificationList">
                        <li class="empty">No notifications yet.</li>
                    </ul>
                </section>

                <section id="support-panel" class="insight-grid dash-section" aria-label="Applicant next steps and support">
                    <div class="panel">
                        <div class="panel-header">
                            <h2>Next step</h2>
                            <p class="panel-subtitle">Your next recommended action is generated from your real application and training status.</p>
                        </div>
                        <div class="next-step-card">
                            <span class="support-card__eyebrow">Action guidance</span>
                            <strong class="support-card__primary" id="nextStepTitle">Complete your applicant profile</strong>
                            <p class="support-card__meta" id="nextStepDescription">Use the profile completion page to submit your application for review.</p>
                            <div class="form-actions">
                                <button type="button" class="btn-primary" id="nextStepAction">Open profile completion</button>
                            </div>
                        </div>
                    </div>

                    <div class="panel support" aria-labelledby="supportHeading">
                        <div class="support-card">
                            <div class="support-card__header panel-header">
                                <h2 id="supportHeading">Need assistance?</h2>
                                <p class="panel-subtitle">CSWDD support details and your assigned officer information.</p>
                            </div>
                            <div class="support-card__grid">
                                <section class="support-card__section">
                                    <span class="support-card__eyebrow">Assigned project officer</span>
                                    <strong class="support-card__primary" id="supportPdoName">Not assigned yet</strong>
                                    <p class="support-card__meta" id="supportPdoEmail">Assigned PDO details will appear once scoped.</p>
                                </section>
                                <section class="support-card__section">
                                    <span class="support-card__eyebrow">General support</span>
                                    <ul class="support-card__list">
                                        <li>Email: <a href="mailto:smartleap@butuan.gov.ph">smartleap@butuan.gov.ph</a></li>
                                        <li>Office hours: Mon-Fri, 8 AM - 5 PM</li>
                                        <li>Barangay and review notices will be posted in your notifications.</li>
                                    </ul>
                                </section>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            <footer class="dash-footer">
                <p>SMART LEAP - City Government of Butuan &amp; CSWDD - Empowering homegrown enterprises.</p>
            </footer>
        </div>
    </div>

    <div class="toast-stack" id="toastStack" aria-live="polite" aria-atomic="true"></div>

    <script src="<?= $baseUrl ?>/assets/js/dashboards/applicant.js" defer></script>
</body>
</html>

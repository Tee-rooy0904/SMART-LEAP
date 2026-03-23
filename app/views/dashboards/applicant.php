<?php /** @var string $baseUrl */ ?>
<?php /** @var array|null $authUser */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SMART LEAP | Applicant Dashboard</title>
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/applicant.css">
    <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/post-approval.css">
</head>
<body>
    <script>
        window.SMARTLEAP_AUTH_USER = <?= json_encode($authUser ?? null, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
        window.SMARTLEAP_BASE_URL = <?= json_encode($baseUrl, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?>;
    </script>
    <div class="dashboard-shell">
        <aside class="dash-sidebar" id="appSidebar" aria-label="Applicant navigation">
            <div class="sidebar-drawer__top">
                <div class="sidebar-brand">
                    <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="sidebar-logo">
                    <div class="sidebar-brand__copy"><strong class="sidebar-title">SMART LEAP</strong></div>
                </div>
                <button type="button" class="sidebar-drawer__close" id="sidebarClose" aria-label="Close navigation">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="sidebar-user">
                <div class="sidebar-avatar" id="sidebarAvatar" aria-hidden="true">A</div>
                <div class="sidebar-user__meta">
                    <span class="sidebar-user__name" id="sidebarUserName">Applicant</span>
                    <span class="sidebar-user__biz" id="sidebarUserBusiness">Your livelihood</span>
                </div>
            </div>
            <nav class="sidebar-nav">
                <a class="sidebar-link is-active" href="#dashboard-home"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M3 11.5L12 4l9 7.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.5 10.5V20h13V10.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Dashboard</span></a>
                <a class="sidebar-link" href="#profile-page"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><circle cx="12" cy="8" r="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 20a8 8 0 0116 0" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Profile</span></a>
                <a class="sidebar-link" href="#application-page"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M8 7h8" stroke-linecap="round"/><path d="M8 12h8" stroke-linecap="round"/><path d="M8 17h5" stroke-linecap="round"/><rect x="5" y="3" width="14" height="18" rx="2" stroke-linejoin="round"/></svg></span><span>Application</span></a>
                <a class="sidebar-link" href="#training-page"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M3 9l9-4 9 4-9 4-9-4z" stroke-linejoin="round"/><path d="M7 11v5c0 1.66 2.91 3 5 3s5-1.34 5-3v-5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>Training</span></a>
                <a class="sidebar-link" href="#support-page"><span class="sidebar-icon" aria-hidden="true"><svg viewBox="0 0 24 24" role="presentation"><path d="M7 7h10a3 3 0 013 3v4a3 3 0 01-3 3h-3l-3 4-3-4H7a3 3 0 01-3-3v-4a3 3 0 013-3z" stroke-linejoin="round"/></svg></span><span>Support</span></a>
            </nav>
            <button type="button" class="btn-outline sidebar-logout" id="applicantLogoutButton">Logout</button>
        </aside>
        <button type="button" class="sidebar-overlay" id="sidebarOverlay" aria-hidden="true" tabindex="-1"></button>
        <div class="dash-content">
            <header class="mobile-topbar" aria-label="Applicant mobile navigation">
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
                <section id="dashboard-home" class="dash-page dash-page--home" aria-labelledby="dashboardHomeHeading">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Dashboard</p>
                            <h2 id="dashboardHomeHeading">Your guided applicant journey</h2>
                            <p class="dash-page__lead">Start with the current step, then review what needs attention and what comes next.</p>
                        </div>
                    </div>
                    <section class="panel dash-section panel--hero applicant-current-step" aria-labelledby="nextStepHeading">
                        <div class="applicant-current-step__main">
                            <div class="panel-header panel-header--compact">
                                <h3 id="nextStepHeading">Current step</h3>
                                <p class="panel-subtitle">This is the one action that matters most right now.</p>
                            </div>
                            <span class="journey-pill" id="nextStepStatus">Loading current status</span>
                            <strong class="applicant-current-step__title" id="nextStepTitle">Loading your next step</strong>
                            <p class="applicant-current-step__copy" id="nextStepDescription">Please wait while your applicant workspace checks your current workflow stage.</p>
                            <div class="applicant-current-step__actions">
                                <button type="button" class="btn-primary" id="nextStepAction" disabled>Loading</button>
                            </div>
                        </div>
                        <aside class="applicant-current-step__aside" aria-label="Current step context">
                            <div class="current-step-meta">
                                <span class="overview-label">Current workflow status</span>
                                <strong class="overview-value" id="dashboardSnapshotStatus">Loading</strong>
                                <p class="overview-meta" id="dashboardSnapshotDate">Checking your latest workflow record.</p>
                            </div>
                            <div class="current-step-meta">
                                <span class="overview-label">What happens next</span>
                                <strong class="overview-value" id="dashboardSnapshotPdo">Loading</strong>
                                <p class="overview-meta" id="dashboardSnapshotRemark">Preparing your current-step guidance.</p>
                            </div>
                        </aside>
                    </section>
                    <section id="overview" class="panel dash-section dash-section--summary panel--summary applicant-journey-panel" aria-labelledby="overviewHeading">
                        <div class="panel-header">
                            <h3 id="overviewHeading">Journey progress</h3>
                            <p class="panel-subtitle">Four milestones from profile completion to certificate release.</p>
                        </div>
                        <div class="applicant-journey-strip" role="list" aria-label="Applicant journey milestones">
                            <article class="journey-step" id="journeyStepProfile" role="listitem">
                                <span class="journey-step__index">1</span>
                                <div class="journey-step__body">
                                    <span class="journey-step__label">Profile</span>
                                    <strong class="journey-step__value" id="dashboardProfileCompletion">0%</strong>
                                    <p class="journey-step__meta" id="dashboardProfileCompletionNote">Keep your profile updated.</p>
                                </div>
                            </article>
                            <article class="journey-step" id="journeyStepApplication" role="listitem">
                                <span class="journey-step__index">2</span>
                                <div class="journey-step__body">
                                    <span class="journey-step__label">Application review</span>
                                    <strong class="journey-step__value" id="dashboardRequirementsSummary">0/3 uploaded</strong>
                                    <p class="journey-step__meta" id="dashboardRequirementsSummaryNote">Upload progress and verification.</p>
                                </div>
                            </article>
                            <article class="journey-step" id="journeyStepTraining" role="listitem">
                                <span class="journey-step__index">3</span>
                                <div class="journey-step__body">
                                    <span class="journey-step__label">Training</span>
                                    <strong class="journey-step__value" id="dashboardTrainingCompletion">0% complete</strong>
                                    <p class="journey-step__meta" id="dashboardTrainingCompletionNote">Sessions and attendance are grouped in Training.</p>
                                </div>
                            </article>
                            <article class="journey-step" id="journeyStepCertificate" role="listitem">
                                <span class="journey-step__index">4</span>
                                <div class="journey-step__body">
                                    <span class="journey-step__label">Certificate</span>
                                    <strong class="journey-step__value" id="dashboardCertificateStatus">Locked</strong>
                                    <p class="journey-step__meta" id="dashboardCertificateStatusNote">Available after your training and application requirements are complete.</p>
                                </div>
                            </article>
                        </div>
                    </section>
                    <section class="dashboard-attention-grid">
                        <section class="panel dash-section panel--review applicant-alerts-panel" aria-labelledby="importantUpdatesHeading">
                            <div class="panel-header">
                                <h3 id="importantUpdatesHeading">Important updates</h3>
                                <p class="panel-subtitle">Only items that need attention or explain the next movement in your application.</p>
                            </div>
                            <ul class="attention-list" id="applicantAlertList">
                                <li class="attention-list__empty">High-value updates will appear here as your application moves.</li>
                            </ul>
                        </section>
                    </section>
                </section>
                <section id="profile-page" class="dash-page" aria-labelledby="profilePageHeading">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Profile</p>
                            <h2 id="profilePageHeading">Edit your profile</h2>
                            <p class="dash-page__lead">Update and save your personal information here. Use Application for requirements, review, and submission.</p>
                        </div>
                    </div>
                    <section class="dash-section profile-editor-workspace" aria-labelledby="profileWorkspaceHeading">
                        <div class="status-bar" aria-live="polite">
                            <div>
                                <span class="status-label">Status</span>
                                <strong id="statusValue">Draft</strong>
                                <span class="status-dot" aria-hidden="true"></span>
                                <span class="status-updated">Last update: <span id="statusUpdated">--</span></span>
                            </div>
                            <div class="status-remark" id="statusRemark" hidden></div>
                        </div>

                        <section class="panel profile-editor-panel profile-editor-intro" aria-labelledby="profileWorkspaceHeading">
                            <div class="panel-header panel-header--compact">
                                <h3 id="profileWorkspaceHeading">Profile information</h3>
                                <p class="panel-subtitle">Use this page to update your personal and livelihood details. Uploads and final submission now belong to Application.</p>
                            </div>
                            <div class="profile-editor-intro__grid">
                                <article class="profile-editor-intro__item">
                                    <span class="overview-label">Profile owner</span>
                                    <strong class="overview-value" id="profilePageName">Applicant</strong>
                                    <p class="overview-meta" id="profilePageEmail">--</p>
                                </article>
                                <article class="profile-editor-intro__item">
                                    <span class="overview-label">Application status</span>
                                    <strong class="overview-value" id="profileWorkspaceApplicationStatus">Draft</strong>
                                    <p class="overview-meta" id="profileWorkspaceApplicationNote">Your profile changes affect the same application record shown in Application.</p>
                                </article>
                                <article class="profile-editor-intro__item">
                                    <span class="overview-label">What to do next</span>
                                    <strong class="overview-value" id="profileWorkspaceCompletion">Keep details updated</strong>
                                    <p class="overview-meta" id="profileWorkspaceCompletionNote">Save your profile changes here, then go to Application for required uploads and submission.</p>
                                </article>
                            </div>
                        </section>

                        <form id="profileCompletionForm" class="profile-form" novalidate>
                            <section class="panel profile-editor-panel profile-editor-panel--personal">
                                <div class="panel-header">
                                    <h2>Personal Information</h2>
                                    <p class="panel-subtitle">Update the details used across your applicant record. Fields marked with * are required.</p>
                                </div>
                                <div class="form-grid">
                                    <label class="form-field">
                                        <span>Birthdate <em>*</em></span>
                                        <input type="date" id="profileBirthdate" name="birthdate" required>
                                        <small data-error-for="profileBirthdate"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Age <em>Auto-filled</em></span>
                                        <input type="number" id="profileAge" name="age" readonly>
                                        <small class="field-helper">Auto-calculated from birthdate.</small>
                                        <small data-error-for="profileAge"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Gender <em>*</em></span>
                                        <select id="profileGender" name="gender" required>
                                            <option value="">Select gender</option>
                                            <option value="Female">Female</option>
                                            <option value="Male">Male</option>
                                            <option value="Non-binary">Non-binary</option>
                                            <option value="Prefer not to say">Prefer not to say</option>
                                        </select>
                                        <small data-error-for="profileGender"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Contact number <em>*</em></span>
                                        <input type="tel" id="profileContactNumber" name="contactNumber" placeholder="09xxxxxxxxx" required>
                                        <small data-error-for="profileContactNumber"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Complete address <em>*</em></span>
                                        <input type="text" id="profileAddress" name="address" placeholder="House no., street, city" required>
                                        <small data-error-for="profileAddress"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Barangay <em>*</em></span>
                                        <select id="profileBarangay" name="barangay" required>
                                            <option value="">Select barangay</option>
                                            <option>Ag-ao</option>
                                            <option>Agusan Pequeño</option>
                                            <option>Ambago</option>
                                            <option>Ampayon</option>
                                            <option>Anticala</option>
                                            <option>Babag</option>
                                            <option>Bad-as</option>
                                            <option>Banza</option>
                                            <option>Bayawan</option>
                                            <option>Bitan-agan</option>
                                            <option>Buhangin</option>
                                            <option>Cabcabon</option>
                                            <option>Doongan</option>
                                            <option>Dulag</option>
                                            <option>Florida</option>
                                            <option>Fort Poyohon</option>
                                            <option>Golden Ribbon</option>
                                            <option>Holy Redeemer</option>
                                            <option>Imadejas</option>
                                            <option>J.P. Rizal</option>
                                            <option>Kinamlutan</option>
                                            <option>Lapu-Lapu</option>
                                            <option>Libertad</option>
                                            <option>Limaha</option>
                                            <option>Los Angeles</option>
                                            <option>Lumbocan</option>
                                            <option>Masao</option>
                                            <option>Maon</option>
                                            <option>Maug</option>
                                            <option>Nonong</option>
                                            <option>Obrero</option>
                                            <option>Ong Yiu</option>
                                            <option>Pagatpatan</option>
                                            <option>Pianing</option>
                                            <option>San Mateo</option>
                                            <option>San Vicente</option>
                                            <option>Sto. Niño</option>
                                            <option>Sumilihon</option>
                                            <option>Tagabaca</option>
                                            <option>Taguibo</option>
                                            <option>Taligaman</option>
                                            <option>Tiniwisan</option>
                                            <option>Tungao</option>
                                            <option>Villa Kananga</option>
                                        </select>
                                        <small data-error-for="profileBarangay"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>4Ps membership <em>*</em></span>
                                        <select id="profile4ps" name="is4ps" required>
                                            <option value="">Select</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                        <small data-error-for="profile4ps"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Household size <em>*</em></span>
                                        <input type="number" id="profileHouseholdSize" name="householdSize" min="1" required>
                                        <small data-error-for="profileHouseholdSize"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Sector <em>*</em></span>
                                        <select id="profileSector" name="sector" required>
                                            <option value="">Select sector</option>
                                            <option value="Indigenous People">Indigenous People</option>
                                            <option value="Senior Citizen">Senior Citizen</option>
                                            <option value="Solo Parent">Solo Parent</option>
                                            <option value="PWD">PWD</option>
                                            <option value="None">None</option>
                                        </select>
                                        <small data-error-for="profileSector"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Livelihood / Business type <em>*</em></span>
                                        <input type="text" id="profileLivelihood" name="livelihood" placeholder="e.g., Sari-sari store" required>
                                        <small data-error-for="profileLivelihood"></small>
                                    </label>
                                    <label class="form-field">
                                        <span>Microbusiness name <em>*</em></span>
                                        <input type="text" id="profileBusinessName" name="businessName" placeholder="e.g., Maria's Sari-sari Store" required>
                                        <small data-error-for="profileBusinessName"></small>
                                    </label>
                                </div>
                                <div class="notice" id="profileFormNotice" hidden></div>
                                <div class="panel-actions panel-actions--profile">
                                    <button type="button" class="btn-outline" data-open-application-workspace>Go to Application</button>
                                    <button type="button" class="btn-primary" id="saveProfileChangesButton">Save Changes</button>
                                </div>
                            </section>
                        </form>
                    </section>
                </section>
                <section id="application-page" class="dash-page" aria-labelledby="applicationPageHeading">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Application</p>
                            <h2 id="applicationPageHeading">Application workspace</h2>
                            <p class="dash-page__lead">Use this page for all application requirements, review updates, visible remarks, and notifications. Edit personal details through Profile.</p>
                        </div>
                    </div>
                    <section class="panel dash-section panel--summary application-profile-reminder" aria-labelledby="profileHeading">
                        <div class="application-profile-reminder__copy">
                            <h3 id="profileHeading">Need to update your personal details?</h3>
                            <p class="panel-subtitle">Use Profile to edit your name, contact details, address, and livelihood information.</p>
                        </div>
                        <div class="application-profile-reminder__actions">
                            <button type="button" class="btn-primary" data-open-profile-editor>Edit Profile</button>
                        </div>
                    </section>
                    <section class="panel dash-section panel--summary application-upload-panel" aria-labelledby="applicationUploadsHeading">
                        <div class="panel-header">
                                    <h3 id="applicationUploadsHeading">Upload requirements</h3>
                                    <p class="panel-subtitle">Upload the files needed for your application here. PDF, PNG, or JPG only. Max 5 MB per file.</p>
                            <p class="panel-meta">
                                <span>Required: <span class="docs-total-count">3</span> documents (Valid ID, Health Certificate, Cedula)</span>
                                <span class="meta-sep">&bull;</span>
                                <span class="meta-badge">Uploaded: <span id="docsUploadedCount">0</span>/<span class="docs-total-count">3</span></span>
                            </p>
                        </div>
                        <div class="doc-grid" id="docGrid"></div>
                        <div class="review-block application-upload-panel__review">
                            <h3>Document checklist</h3>
                            <div class="review-list" id="reviewDocs"></div>
                        </div>
                        <div class="notice" id="formNotice" hidden></div>
                        <div class="action-bar application-action-bar">
                            <button type="button" class="btn-outline" id="saveDraftButton">Save Draft</button>
                            <button type="button" class="btn-primary" id="submitProfileButton">Submit for verification</button>
                        </div>
                    </section>
                    <div class="application-focus-grid application-focus-grid--workspace">
                        <section id="requirements-progress" class="panel dash-section panel--summary application-workspace-panel application-requirements-panel" aria-labelledby="requirementsHeading">
                            <div class="panel-header"><h3 id="requirementsHeading">Requirements checklist</h3><p class="panel-subtitle">See what is uploaded, what is being checked, and what still needs action.</p></div>
                            <div class="requirements-progress">
                                <div class="requirements-progress__meta"><strong id="requirementsProgressCount">0/3 requirements</strong><span id="requirementsProgressStatus">No uploaded requirements yet.</span></div>
                                <div class="requirements-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="requirements-progress__fill" id="requirementsProgressFill"></div></div>
                                <ul class="requirements-list" id="requirementsList"><li class="empty">No requirement records available yet.</li></ul>
                            </div>
                        </section>
                        <section id="application-status" class="panel dash-section panel--review application-workspace-panel application-status-panel" aria-labelledby="applicationStatusHeading">
                            <div class="panel-header"><h3 id="applicationStatusHeading">Review updates</h3><p class="panel-subtitle">See what happened, what needs fixing, and what to do next.</p></div>
                            <div class="overview-grid status-summary-grid">
                                <article class="overview-card"><span class="overview-label">Current status</span><strong class="overview-value" id="applicationStatusValue">Draft</strong><p class="overview-meta" id="applicationStatusDates">Not submitted yet.</p></article>
                                <article class="overview-card"><span class="overview-label">Assigned project officer</span><strong class="overview-value" id="assignedPdoName">Not assigned</strong><p class="overview-meta" id="assignedPdoEmail">Assigned PDO details will appear here.</p></article>
                                <article class="overview-card"><span class="overview-label">Checked so far</span><strong class="overview-value" id="requirementReviewValue">0 verified</strong><p class="overview-meta" id="requirementReviewNote">No requirement review activity yet.</p></article>
                                <article class="overview-card overview-card--soft"><span class="overview-label">Need to fix</span><strong class="overview-value" id="applicationRemarkCount">0 remarks</strong><p class="overview-meta" id="applicationRemarkNote">Applicant-visible review notes will be summarized here.</p></article>
                            </div>
                            <div class="status-panels">
                                <div class="status-panel"><h3>What happened</h3><ul class="timeline-list" id="historyList"><li class="empty">No status history yet.</li></ul></div>
                                <div class="status-panel"><h3>Messages for you</h3><ul class="timeline-list" id="remarksList"><li class="empty">No applicant-visible remarks yet.</li></ul></div>
                            </div>
                        </section>
                    </div>
                    <section id="application-forms" class="panel dash-section panel--summary application-forms-panel post-tracker-shell" aria-labelledby="applicationFormsHeading">
                        <div class="post-tracker-shell__hero">
                            <div class="post-tracker-shell__copy">
                                <div class="panel-header panel-header--compact">
                                    <h3 id="applicationFormsHeading">Fill-up form requirements</h3>
                                    <p class="panel-subtitle" id="applicationFormsSubtitle">Complete the fill-up form requirements connected to your application record here.</p>
                                </div>
                                <strong class="post-tracker-shell__priority" id="applicationFormsPriority">Waiting for fill-up form requirements</strong>
                                <p class="post-tracker-shell__next" id="applicationFormsNextAction">The next required form will be shown here.</p>
                            </div>
                            <div class="post-tracker-shell__summary post-approval-summary">
                                <article class="post-approval-metric">
                                    <span class="overview-label">Requirement release</span>
                                    <strong class="overview-value" id="applicationFormsUnlockedAt">Not available yet</strong>
                                    <p class="overview-meta" id="applicationFormsUnlockMeta">Fill-up form requirements will appear here when your application record reaches that step.</p>
                                </article>
                                <article class="post-approval-metric">
                                    <span class="overview-label">Form requirements</span>
                                    <strong class="overview-value" id="applicationFormsTaskCount">0 forms</strong>
                                    <p class="overview-meta" id="applicationFormsProgressMeta">No fill-up form requirements are currently available.</p>
                                </article>
                                <article class="post-approval-metric">
                                    <span class="overview-label">Need to fix</span>
                                    <strong class="overview-value" id="applicationFormsFeedbackSummary">No remarks</strong>
                                    <p class="overview-meta" id="applicationFormsFeedbackMeta">Reviewer instructions and correction notes will be summarized here.</p>
                                </article>
                            </div>
                        </div>
                        <div class="tracker-list-head">
                            <div>
                                <h3>Form requirements in order</h3>
                                <p class="panel-subtitle">These fill-up form requirements are part of your application stage.</p>
                            </div>
                            <span class="chip" id="applicationFormsTaskChip">0 forms</span>
                        </div>
                        <div class="post-approval-taskcards tracker-taskcards" id="applicationFormsTaskCards">
                            <article class="post-approval-taskcard is-empty">Fill-up form requirements will appear here when available.</article>
                        </div>
                    </section>
                    <section id="notifications-panel" class="panel dash-section panel--summary application-notifications-panel" aria-labelledby="notificationsHeading">
                        <div class="application-feed-header">
                            <div class="application-feed-header__copy">
                                <h3 id="notificationsHeading">Updates for you</h3>
                                <p class="panel-subtitle">Quick reminders, schedule notices, review updates, and completed steps.</p>
                            </div>
                            <button type="button" class="btn-outline small is-hidden" id="notificationsToggle">Show more</button>
                        </div>
                        <ul class="notification-list" id="notificationList"><li class="empty">No notifications yet.</li></ul>
                    </section>
                </section>
                <section id="training-page" class="dash-page" aria-labelledby="trainingPageHeading">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Training</p>
                            <h2 id="trainingPageHeading">Training journey</h2>
                            <p class="dash-page__lead">See the next session first, then your progress, attendance record, schedule, and certificate outcome.</p>
                        </div>
                    </div>
                    <section id="training-progress" class="panel dash-section panel--hero training-hero-panel" aria-labelledby="trainingHeading">
                        <div class="training-hero-panel__main">
                            <div class="panel-header panel-header--compact"><h3 id="trainingHeading">Upcoming or current session</h3><p class="panel-subtitle">Your next live training schedule appears here first.</p></div>
                            <div class="training-dashboard__next training-dashboard__next--hero is-empty" id="trainingNextCard"><h3>Next session</h3><p class="training-next__title" id="trainingNextTitle">No upcoming session scheduled</p><p class="training-next__meta" id="trainingNextMeta"></p></div>
                            <p class="training-dashboard__hint" id="trainingSummaryNote">No training assignment has been recorded yet.</p>
                        </div>
                        <aside class="training-hero-panel__aside">
                            <div class="training-ring" id="trainingRing" style="--progress: 0deg;"><div class="training-ring__value" id="trainingPercent">0%</div><div class="training-ring__label">complete</div></div>
                            <p class="training-progress-meta" id="trainingProgressMeta">0% completion</p>
                            <div class="training-progress-track"><div class="training-progress-fill" id="trainingProgressFill"></div></div>
                        </aside>
                    </section>
                    <section class="panel dash-section panel--summary training-metrics-panel" aria-labelledby="trainingMetricsHeading">
                        <div class="panel-header panel-header--compact"><h3 id="trainingMetricsHeading">Progress and attendance metrics</h3><p class="panel-subtitle">A quick read on your assigned sessions and attendance record.</p></div>
                        <div class="training-dashboard__stats training-dashboard__stats--workspace">
                            <div class="training-stat"><span class="training-stat__label">Sessions</span><span class="training-stat__value" id="trainingScheduledCount">0</span></div>
                            <div class="training-stat"><span class="training-stat__label">Notified</span><span class="training-stat__value" id="trainingNotifiedCount">0</span></div>
                            <div class="training-stat"><span class="training-stat__label">Completed</span><span class="training-stat__value" id="trainingCompletedCount">0</span></div>
                            <div class="training-stat"><span class="training-stat__label">Missed</span><span class="training-stat__value" id="trainingMissedCount">0</span></div>
                        </div>
                    </section>
                    <div class="training-flow-grid training-flow-grid--workspace">
                        <section class="panel dash-section training-subsection training-subsection--assigned panel--summary" aria-labelledby="trainingAssignedHeading">
                            <div class="panel-header"><h3 id="trainingAssignedHeading">Assigned sessions</h3><p class="panel-subtitle">A quick sequence of the sessions tied to your training record.</p></div>
                            <div class="training-checklist"><ul id="trainingChecklist"><li class="empty">No training sessions have been assigned yet.</li></ul></div>
                        </section>
                        <section class="panel dash-section training-subsection training-subsection--schedule panel--info" aria-labelledby="trainingScheduleHeading">
                            <div class="panel-header"><h3 id="trainingScheduleHeading">Schedule list</h3><p class="panel-subtitle">Dates, venues, and preparation notes for each assigned session.</p></div>
                            <div class="training-schedule-grid" id="trainingScheduleGrid"><article class="training-schedule-empty">No training schedule yet. Wait for CSWDD notice updates.</article></div>
                        </section>
                    </div>
                    <section class="panel dash-section panel--records training-attendance-panel" aria-labelledby="trainingAttendanceHeading">
                        <div class="panel-header panel-header--spaced"><h3 id="trainingAttendanceHeading">Attendance</h3><p class="panel-subtitle">Attendance remains readable on mobile and reflects the latest recorded status.</p></div>
                        <div class="attendance-metrics" role="list">
                            <article class="attendance-metric" role="listitem"><span class="attendance-metric__label">Scheduled</span><strong class="attendance-metric__value" id="attendanceScheduledCount">0</strong></article>
                            <article class="attendance-metric" role="listitem"><span class="attendance-metric__label">Notified</span><strong class="attendance-metric__value" id="attendanceNotifiedCount">0</strong></article>
                            <article class="attendance-metric" role="listitem"><span class="attendance-metric__label">Missed</span><strong class="attendance-metric__value" id="attendanceMissedCount">0</strong></article>
                            <article class="attendance-metric" role="listitem"><span class="attendance-metric__label">Completed</span><strong class="attendance-metric__value" id="attendanceCompletedCount">0</strong></article>
                        </div>
                        <div class="table-wrapper table-wrapper--soft">
                            <table class="attendance-table">
                                <thead><tr><th scope="col">Session</th><th scope="col">Date &amp; Time</th><th scope="col">Status</th><th scope="col">Remarks</th><th scope="col">Notice</th></tr></thead>
                                <tbody id="attendanceTableBody"><tr class="empty"><td colspan="5">Attendance updates will appear once sessions are assigned.</td></tr></tbody>
                            </table>
                        </div>
                    </section>
                    <section class="panel dash-section panel--milestone training-certificate-panel" aria-labelledby="trainingCertificateHeading">
                        <div class="training-certificate-card">
                            <div class="training-certificate-card__copy"><h3 id="trainingCertificateHeading">Certificate milestone</h3><p class="panel-subtitle" id="certificateNote">Complete your training and application requirements to receive your certificate.</p></div>
                            <div class="training-certificate-card__status"><strong id="certificateStatus">Locked</strong><p id="certificateMeta">0/0 trainings completed · 0/0 verified forms</p></div>
                            <div class="training-certificate-card__actions"><button type="button" class="btn-primary" id="downloadCertificateButton" disabled>Download certificate (PDF)</button></div>
                        </div>
                    </section>
                </section>
                <section id="support-page" class="dash-page" aria-labelledby="supportPageHeading">
                    <div class="dash-page__header">
                        <div>
                            <p class="dash-page__eyebrow">Support</p>
                            <h2 id="supportPageHeading">Support path</h2>
                            <p class="dash-page__lead">Support stays available, but it should not compete with your main workflow.</p>
                        </div>
                    </div>
                    <section id="support-panel" class="panel dash-section panel--support support-page-panel" aria-labelledby="supportHeading">
                        <div class="support-card support-card--quiet">
                            <div class="support-card__header panel-header"><h3 id="supportHeading">Guidance and contacts</h3><p class="panel-subtitle">Use this page when you need your assigned contact, current guidance, or general help details.</p></div>
                            <div class="support-card__grid support-card__grid--triple">
                                <section class="support-card__section support-card__section--primary"><span class="support-card__eyebrow">Assigned project officer</span><strong class="support-card__primary" id="supportPdoName">Not assigned yet</strong><p class="support-card__meta" id="supportPdoEmail">Assigned PDO details will appear once scoped.</p></section>
                                <section class="support-card__section support-card__section--guidance"><span class="support-card__eyebrow">Current guidance</span><strong class="support-card__primary" id="supportGuidanceTitle">Applicant guidance</strong><p class="support-card__meta" id="supportGuidanceText">We will point you to the right applicant area based on your live status.</p><ul class="support-card__list support-card__list--bullets"><li>Check Application for upload requirements, fill-up form requirements, reviewer remarks, and notifications.</li><li>Use Training for schedules, attendance, and certificate progress.</li><li>Use Profile only for personal information updates.</li></ul></section>
                                <section class="support-card__section support-card__section--secondary"><span class="support-card__eyebrow">General support</span><ul class="support-card__list"><li>Email: <a href="mailto:smartleap@butuan.gov.ph">smartleap@butuan.gov.ph</a></li><li>Office hours: Mon-Fri, 8 AM - 5 PM</li><li>Barangay and review notices will be posted in your notifications.</li></ul></section>
                            </div>
                        </div>
                    </section>
                </section>
            </main>
            <div class="modal" id="previewModal" hidden>
                <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="previewTitle">
                    <div class="modal-header">
                        <div>
                            <h3 id="previewTitle">Document preview</h3>
                            <div class="modal-status">
                                <span class="doc-status">Not uploaded</span>
                            </div>
                        </div>
                    </div>
                    <div class="modal-body" id="previewBody"></div>
                    <div class="modal-footer">
                        <button type="button" class="btn-outline" id="replacePreview">Replace</button>
                        <button type="button" class="btn-primary" id="closePreviewFooter">Close</button>
                    </div>
                </div>
            </div>
            <footer class="dash-footer"></footer>
        </div>
    </div>
    <div class="toast-stack" id="toastStack" aria-live="polite" aria-atomic="true"></div>
    <script src="<?= $baseUrl ?>/assets/js/dashboards/applicant.js" defer></script>
    <script src="<?= $baseUrl ?>/assets/js/public/profile-completion.js" defer></script>
</body>
</html>

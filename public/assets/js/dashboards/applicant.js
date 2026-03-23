(function () {
    const state = {
        baseUrl: window.SMARTLEAP_BASE_URL || '',
        authUser: window.SMARTLEAP_AUTH_USER || null,
        dashboard: null,
        nextStepPath: null,
        notificationsExpanded: false,
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        bindStaticEvents();
        await loadDashboardState();
    }

    function bindStaticEvents() {
        document.getElementById('applicantLogoutButton')?.addEventListener('click', handleLogout);
        document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebarMenu);
        document.getElementById('sidebarClose')?.addEventListener('click', closeSidebarMenuOnMobile);
        document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebarMenuOnMobile);
        document.addEventListener('click', handleWorkspaceShortcuts);
        document.getElementById('notificationsToggle')?.addEventListener('click', () => {
            state.notificationsExpanded = !state.notificationsExpanded;
            renderNotifications();
        });
        document.addEventListener('smartleap:profile-state', handleProfileStateSync);
        document.getElementById('downloadCertificateButton')?.addEventListener('click', () => {
            const path = state.dashboard?.certificate?.downloadPath;
            if (path) {
                window.location.href = routeUrl(path);
            }
        });
        document.getElementById('nextStepAction')?.addEventListener('click', () => {
            if (state.nextStepPath) {
                navigateToPath(state.nextStepPath);
            }
        });

        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.addEventListener('click', (event) => {
                const hash = link.getAttribute('href') || '#dashboard-home';
                if (!hash.startsWith('#')) {
                    closeSidebarMenuOnMobile();
                    return;
                }

                event.preventDefault();
                document.querySelectorAll('.sidebar-link').forEach((item) => item.classList.remove('is-active'));
                link.classList.add('is-active');
                window.location.hash = hash;
                applyRouteVisibility();
                closeSidebarMenuOnMobile();
            });
        });

        window.addEventListener('hashchange', applyRouteVisibility);
        window.addEventListener('resize', syncSidebarMenuState);
        document.addEventListener('keydown', handleGlobalKeydown);
        syncSidebarMenuState();
    }

    async function loadDashboardState() {
        try {
            const payload = await fetchJson('applicant-dashboard/state');
            if (!payload.ok) {
                throw new Error(payload.message || 'Unable to load applicant dashboard.');
            }

            state.dashboard = payload.state || null;
            renderDashboard();
            applyRouteVisibility();
        } catch (error) {
            renderFatalState(error.message || 'Unable to load applicant dashboard.');
        }
    }

    function renderDashboard() {
        if (!state.dashboard) {
            renderFatalState('Applicant dashboard state is unavailable.');
            return;
        }

        renderIdentity();
        renderOverview();
        renderProfile();
        renderRequirements();
        renderApplication();
        renderTraining();
        renderApplicationForms();
        renderCertificate();
        renderNotifications();
        renderSupport();
        renderJourney();
        renderAlerts();
    }

    function handleProfileStateSync(event) {
        if (!state.dashboard) {
            return;
        }

        const detail = event.detail || {};
        if (detail.profile) {
            state.dashboard.profile = {
                ...(state.dashboard.profile || {}),
                ...detail.profile,
            };
            setText('sidebarUserBusiness', detail.profile.businessName || detail.profile.livelihood || 'Applicant profile');
        }

        if (detail.application) {
            state.dashboard.application = {
                ...(state.dashboard.application || {}),
                ...detail.application,
            };
        }

        renderProfile();
        renderApplication();
        renderOverview();
        renderSupport();
    }

    function renderIdentity() {
        const authUser = state.dashboard.authUser || state.authUser || {};
        const profile = state.dashboard.profile || {};
        const displayName = authUser.name || 'Applicant';
        const businessName = profile.businessName || profile.livelihood || 'Applicant profile';
        const initial = (displayName.trim().charAt(0) || 'A').toUpperCase();

        setText('sidebarUserName', displayName);
        setText('sidebarUserBusiness', businessName);
        setText('profilePageName', displayName);

        const avatarIds = ['sidebarAvatar'];
        avatarIds.forEach((id) => {
            const node = document.getElementById(id);
            if (node) {
                node.textContent = initial;
            }
        });
    }

    function renderOverview() {
        const profile = state.dashboard.profile;
        const application = state.dashboard.application;
        const training = state.dashboard.training || {};
        const certificate = state.dashboard.certificate || {};
        const nextStep = state.dashboard.nextStep || {};
        const requirements = state.dashboard.requirements || [];
        const uploadedCount = requirements.filter((item) => item.file && item.file.path).length;
        const verifiedCount = requirements.filter((item) => String(item.status || '').toLowerCase() === 'verified').length;

        const status = application?.status || 'No application yet';
        const profileCompletion = profile?.completionPercent ?? 0;
        const trainingSummary = training.summary || {};
        setText('nextStepStatus', status);

        setText('dashboardProfileCompletion', `${profileCompletion}%`);
        setText(
            'dashboardProfileCompletionNote',
            profileCompletion >= 100
                ? 'Your applicant profile is complete and ready for current workflow steps.'
                : 'Keep your applicant profile complete.'
        );
        setText('dashboardRequirementsSummary', `${uploadedCount}/${requirements.length || 3} uploaded`);
        setText(
            'dashboardRequirementsSummaryNote',
            verifiedCount > 0
                ? `${verifiedCount} requirement${verifiedCount === 1 ? '' : 's'} verified so far.`
                : 'Requirement review will appear here once CSWDD checks your uploads.'
        );
        setText('dashboardTrainingCompletion', `${Math.round((((trainingSummary.attended || 0) + (trainingSummary.completed || 0)) / Math.max(1, training.invitees?.length || 0)) * 100)}% complete`);
        setText('dashboardTrainingCompletionNote', buildTrainingOverviewNote(trainingSummary, training));
        setText('dashboardCertificateStatus', certificate.statusLabel || 'Locked');
        setText('dashboardCertificateStatusNote', sanitizeCertificateNote(certificate.note || 'Available after your training and application requirements are complete.'));
        setText('nextStepTitle', sanitizeApplicantWording(nextStep.title || 'Complete your applicant profile'));
        setText('nextStepDescription', workflowActionDescription(nextStep.actionPath, nextStep.description || 'Your next required action will appear here.'));
    }

    function renderProfile() {
        const profile = state.dashboard.profile || {};
        const application = state.dashboard.application || null;
        const completionPercent = profile.completionPercent ?? 0;

        setText('profilePageEmail', state.dashboard.authUser?.email || state.authUser?.email || '--');
        setText('profileWorkspaceCompletion', `${completionPercent}% complete`);
        setText(
            'profileWorkspaceCompletionNote',
            completionPercent >= 100
                ? 'Your personal details look complete. Use Application for uploads and submission.'
                : 'Complete missing personal details here, then continue in Application.'
        );
        setText('profileWorkspaceApplicationStatus', application?.status || 'No application yet');
        setText('profileWorkspaceApplicationNote', buildProfileApplicationNote(application));
    }

    function renderRequirements() {
        const requirements = state.dashboard.requirements || [];
        const list = document.getElementById('requirementsList');
        const uploadedCount = requirements.filter((item) => item.file && item.file.path).length;
        const total = requirements.length || 3;
        const percent = total > 0 ? Math.round((uploadedCount / total) * 100) : 0;
        const issues = requirements.filter((item) => isRequirementIssue(item.status)).length;
        const verified = requirements.filter((item) => String(item.status || '').toLowerCase() === 'verified').length;

        setText('requirementsProgressCount', `${uploadedCount}/${total} requirements`);
        setText(
            'requirementsProgressStatus',
            issues > 0
                ? 'One or more requirements need attention.'
                : verified === total && total > 0
                    ? 'All current requirements are verified.'
                    : 'Requirement review is still in progress.'
        );

        const fill = document.getElementById('requirementsProgressFill');
        fill && (fill.style.width = `${percent}%`);
        fill?.parentElement?.setAttribute('aria-valuenow', String(percent));

        if (!list) {
            return;
        }

        if (requirements.length === 0) {
            list.innerHTML = '<li class="empty">No requirement records available yet.</li>';
            return;
        }

        list.innerHTML = requirements.map((item) => {
            const statusClass = requirementStatusClass(item.status);
            const statusText = normalizeRequirementStatusSimple(item);
            const fileName = item.file?.name ? escapeHtml(item.file.name) : 'No uploaded file yet';
            const fileMeta = item.updatedAt ? `Last update: ${formatDate(item.updatedAt)}` : 'You can upload this in the Application page.';
            const reviewerNote = item.reviewerRemarks || item.remarks || item.note || '';
            const actionHref = item.file?.url ? escapeAttribute(item.file.url) : '#application-page';
            const actionLabel = item.file?.url ? 'View file' : 'Open Application';
            const actionAttrs = item.file?.url ? 'target="_blank" rel="noopener"' : 'data-open-application-workspace';

            return `
                <li class="requirement-card">
                    <div class="requirement-card__main">
                        <div class="requirement-card__header">
                            <strong>${escapeHtml(item.label || item.key || 'Requirement')}</strong>
                            <span class="requirement-status ${statusClass}">${escapeHtml(statusText)}</span>
                        </div>
                        <p class="requirement-card__copy">${escapeHtml(buildRequirementHelpText(item))}</p>
                        <div class="requirement-file-meta">${fileName}</div>
                        <div class="requirement-file-meta">${escapeHtml(fileMeta)}</div>
                        ${reviewerNote ? `<p class="requirement-card__note"><strong>Reviewer note:</strong> ${escapeHtml(truncateText(reviewerNote, 120))}</p>` : ''}
                    </div>
                    <div class="requirement-actions">
                        <a class="btn-outline small requirement-action-link" href="${actionHref}" ${actionAttrs}>${actionLabel}</a>
                    </div>
                </li>
            `;
        }).join('');
    }

    function renderApplication() {
        const application = state.dashboard.application;
        const remarks = application?.remarks || [];
        const latestRemark = remarks[0] || null;

        setText('applicationStatusValue', application?.status || 'No application yet');
        setText('applicationStatusDates', buildApplicationDateMeta(application));
        const assignedPdo = application?.assignedPdo || null;
        setText('assignedPdoName', assignedPdo?.name || 'Not assigned');
        setText('assignedPdoEmail', assignedPdo?.email || 'Assigned PDO details will appear here once scoped.');
        setText('supportPdoName', assignedPdo?.name || 'Not assigned yet');
        setText('supportPdoEmail', assignedPdo?.email || 'Assigned PDO details will appear once scoped.');

        const reviewSummary = application?.reviewSummary || { verified: 0, total: 0, pending: 0, issues: 0 };
        setText('requirementReviewValue', `${reviewSummary.verified || 0} verified`);
        setText(
            'requirementReviewNote',
            reviewSummary.issues > 0
                ? `${reviewSummary.issues} requirement${reviewSummary.issues === 1 ? '' : 's'} need attention.`
                : `${reviewSummary.pending || 0} requirement${reviewSummary.pending === 1 ? '' : 's'} still pending review.`
        );
        setText(
            'applicationRemarkCount',
            `${remarks.length} remark${remarks.length === 1 ? '' : 's'}`
        );
        setText(
            'applicationRemarkNote',
            latestRemark
                ? `${latestRemark.actorName || 'CSWDD'}: ${truncateText(latestRemark.comment || 'Applicant-visible note available.', 92)}`
                : 'Applicant-visible review notes will be summarized here.'
        );
        setText('dashboardSnapshotStatus', application?.status || 'Draft');
        setText('dashboardSnapshotDate', buildApplicationDateMeta(application));
        setText('dashboardSnapshotPdo', assignedPdo?.name || 'Not assigned yet');
        setText(
            'dashboardSnapshotRemark',
            latestRemark
                ? `${latestRemark.actorName || 'CSWDD'} | ${truncateText(latestRemark.comment || '', 110)}`
                : 'Reviewer remarks will appear here once visible to you.'
        );

        renderTimelineList('historyList', application?.history || [], renderHistoryItem, 'No status history yet.');
        renderTimelineList('remarksList', application?.remarks || [], renderRemarkItem, 'No applicant-visible remarks yet.');
    }

    function renderTraining() {
        const training = state.dashboard.training || {};
        const summary = training.summary || {};
        const invitees = training.invitees || [];
        const nextSession = training.nextSession || null;

        const progressPercent = invitees.length > 0
            ? Math.round((((summary.attended || 0) + (summary.completed || 0)) / invitees.length) * 100)
            : 0;

        setText('trainingPercent', `${progressPercent}%`);
        setText(
            'trainingSummaryNote',
            invitees.length === 0
                ? 'No training assignment has been recorded yet.'
                : `${invitees.length} training assignment${invitees.length === 1 ? '' : 's'} recorded for your applicant profile.`
        );
        setText('trainingScheduledCount', String(summary.scheduled || 0));
        setText('trainingNotifiedCount', String(summary.notified || 0));
        setText('trainingCompletedCount', String(summary.completed || 0));
        setText('trainingMissedCount', String(summary.missed || 0));
        setText('attendanceScheduledCount', String(summary.scheduled || 0));
        setText('attendanceNotifiedCount', String(summary.notified || 0));
        setText('attendanceMissedCount', String(summary.missed || 0));
        setText('attendanceCompletedCount', String(summary.completed || 0));
        setText('trainingProgressMeta', `${progressPercent}% completion`);

        const ring = document.getElementById('trainingRing');
        if (ring) {
            ring.style.setProperty('--progress', `${Math.max(0, Math.min(100, progressPercent)) * 3.6}deg`);
        }
        const fill = document.getElementById('trainingProgressFill');
        fill && (fill.style.width = `${progressPercent}%`);

        const nextCard = document.getElementById('trainingNextCard');
        if (nextSession) {
            nextCard?.classList.remove('is-empty');
            setText('trainingNextTitle', nextSession.program?.programName || 'Training session');
            setText('trainingNextMeta', buildTrainingMeta(nextSession));
        } else {
            nextCard?.classList.add('is-empty');
            setText('trainingNextTitle', 'No upcoming session scheduled');
            setText('trainingNextMeta', '');
        }

        renderTrainingChecklist(invitees);
        renderTrainingSchedule(invitees);
        renderAttendanceTable(invitees);
    }

    function renderCertificate() {
        const certificate = state.dashboard?.certificate || {};
        const statusButton = document.getElementById('downloadCertificateButton');

        setText('certificateStatus', certificate.statusLabel || 'Locked');
        const trainingCompleted = certificate.trainingCompleted || 0;
        const trainingTotal = certificate.trainingTotal || 0;
        const postApprovalVerified = certificate.postApprovalVerified || 0;
        const postApprovalTotal = certificate.postApprovalTotal || 0;
        setText('certificateMeta', `${trainingCompleted}/${trainingTotal} trainings completed • ${postApprovalVerified}/${postApprovalTotal} verified application requirements`);
        setText('certificateNote', sanitizeCertificateNote(certificate.note || 'Certificate availability will be shown here once your training and application requirements are complete.'));

        if (statusButton) {
            statusButton.disabled = !certificate.eligible;
            statusButton.textContent = certificate.eligible
                ? 'Download certificate (PDF)'
                : 'Certificate locked';
        }
    }

    function renderApplicationForms() {
        const postApproval = state.dashboard.postApproval || {};
        const tasks = Array.isArray(postApproval.tasks) ? postApproval.tasks : [];
        const unlocked = Boolean(postApproval.isUnlocked);
        const firstActionable = tasks.find((task) => task.interactive && ['Unlocked', 'In Progress', 'Needs Correction', 'Rejected'].includes(task.status))
            || tasks.find((task) => task.interactive)
            || tasks[0]
            || null;
        const remarkTask = tasks.find((task) => task.reviewerRemarks);
        const summary = postApproval.summary || {};
        const container = document.getElementById('applicationFormsTaskCards');

        setText('applicationFormsSubtitle', unlocked
            ? 'Open the form requirement marked available now. Waiting forms cannot be opened yet.'
            : 'Fill-up form requirements will appear here when your application record reaches that step.');
        setText('applicationFormsPriority', firstActionable ? firstActionable.title : 'Waiting for fill-up form requirements');
        setText('applicationFormsNextAction', firstActionable
            ? (firstActionable.interactive ? 'What to do next: open the available form requirement below.' : 'What to do next: wait for the earlier requirement to finish.')
            : 'The next required form will be shown here.');
        setText('applicationFormsUnlockedAt', unlocked && postApproval.unlockedAt ? formatDateTime(postApproval.unlockedAt) : 'Not available yet');
        setText('applicationFormsUnlockMeta', unlocked
            ? `Available in your application workspace${postApproval.unlockedAt ? ` on ${formatDateTime(postApproval.unlockedAt)}` : ''}.`
            : 'Fill-up form requirements will appear here when your application record reaches that step.');
        setText('applicationFormsTaskCount', `${tasks.length} form${tasks.length === 1 ? '' : 's'}`);
        setText('applicationFormsTaskChip', `${tasks.length} form${tasks.length === 1 ? '' : 's'}`);
        setText('applicationFormsProgressMeta', tasks.length > 0
            ? `${(summary.submitted || 0) + (summary.inProgress || 0) + (summary.needsCorrection || 0)} form${(((summary.submitted || 0) + (summary.inProgress || 0) + (summary.needsCorrection || 0)) === 1) ? '' : 's'} still need action or review.`
            : 'No fill-up form requirements are currently available.');
        setText('applicationFormsFeedbackSummary', remarkTask ? 'Please review' : 'No fix needed');
        setText('applicationFormsFeedbackMeta', remarkTask ? remarkTask.reviewerRemarks : 'If a reviewer asks for changes, the note will appear here.');

        if (!container) {
            return;
        }

        if (tasks.length === 0) {
            container.innerHTML = '<article class="post-approval-taskcard is-empty">Fill-up form requirements will appear here when available.</article>';
            return;
        }

        container.innerHTML = tasks.map((task, index) => {
            const href = task.interactive
                ? routeUrl(`post-approval-form?code=${encodeURIComponent(task.code)}`)
                : '';
            const summaryText = task.summary || task.helpText || 'Form details will appear here.';
            const progressText = buildTaskProgressText(task);
            const primaryState = buildTaskPrimaryState(task);

            return `
                <article class="post-approval-taskcard ${task.interactive ? 'is-clickable' : 'is-disabled'}" ${task.interactive ? '' : 'aria-disabled="true"'}>
                    <div class="post-approval-taskcard__meta">
                        <span class="post-approval-taskcard__index">Requirement ${index + 1}</span>
                        <span class="post-approval-taskcard__status status-${slugify(task.status)}">${escapeHtml(task.status)}</span>
                        <span class="post-approval-taskcard__badge ${task.interactive ? '' : 'is-muted'}">${escapeHtml(primaryState)}</span>
                    </div>
                    <strong>${escapeHtml(task.title)}</strong>
                    <p>${escapeHtml(summaryText)}</p>
                    <div class="post-approval-taskcard__footer">
                        <span>${escapeHtml(progressText)}</span>
                        <span class="post-approval-taskcard__actions">
                            ${task.reviewerRemarks ? '<span class="post-approval-taskcard__issue">Reviewer remarks</span>' : ''}
                            ${task.interactive ? '<span class="tracker-task-open">Open requirement</span>' : '<span class="post-approval-taskcard__locked-note">Unavailable</span>'}
                        </span>
                    </div>
                    ${task.interactive ? `<a class="post-approval-taskcard__overlay" href="${escapeAttribute(href)}" aria-label="Open ${escapeAttribute(task.title)}"></a>` : ''}
                </article>
            `;
        }).join('');
    }

    function renderNotifications() {
        const notifications = state.dashboard.notifications || [];
        const list = document.getElementById('notificationList');
        const toggle = document.getElementById('notificationsToggle');
        if (!list) {
            return;
        }

        if (notifications.length === 0) {
            list.innerHTML = '<li class="empty">No notifications yet.</li>';
            toggle?.classList.add('is-hidden');
            return;
        }

        const preparedNotifications = prepareNotifications(notifications);
        const prioritizedNotifications = dedupeNotifications(preparedNotifications);
        const visibleLimit = 4;
        const collapsedNotifications = prioritizedNotifications.slice(0, visibleLimit);
        const visibleNotifications = state.notificationsExpanded
            ? preparedNotifications
            : collapsedNotifications;
        const hiddenCount = Math.max(0, preparedNotifications.length - collapsedNotifications.length);
        const canExpand = hiddenCount > 0;

        if (toggle) {
            toggle.classList.toggle('is-hidden', !canExpand);
            toggle.textContent = state.notificationsExpanded ? 'Show fewer' : `Show ${hiddenCount} more`;
        }

        list.innerHTML = visibleNotifications.map((item) => {
            const summary = item.summary ? truncateText(item.summary, 96) : '';

            return `
                <li class="notification-card notification-card--${item.tone} ${item.requiresAction ? 'notification-card--action' : 'notification-card--info'}">
                    <div class="notification-main">
                        <div class="notification-top">
                            <span class="notification-type">${escapeHtml(notificationToneLabel(item.tone))}</span>
                            ${item.requiresAction ? '<span class="notification-flag">Needs your attention</span>' : ''}
                        </div>
                        <div class="notification-title">${escapeHtml(item.title)}</div>
                        ${summary ? `<p class="notification-copy">${escapeHtml(summary)}</p>` : ''}
                        ${item.meta ? `<p class="notification-hint">${escapeHtml(item.meta)}</p>` : ''}
                        ${item.actionHref ? `<a class="btn-outline small notification-action" href="${escapeAttribute(routeMaybeAbsolute(item.actionHref))}">${escapeHtml(notificationActionLabel(item.tone, item.requiresAction))}</a>` : ''}
                    </div>
                    <div class="notification-meta">${escapeHtml(formatDateTime(item.dateValue))}</div>
                </li>
            `;
        }).join('');
    }

    function renderSupport() {
        const nextStep = state.dashboard.nextStep || {};
        const application = state.dashboard.application || {};
        state.nextStepPath = nextStep.actionPath || null;

        setText('nextStepTitle', sanitizeApplicantWording(nextStep.title || 'Complete your applicant profile'));
        setText('nextStepDescription', workflowActionDescription(nextStep.actionPath, nextStep.description || 'Your next required action will appear here.'));
        setText('supportGuidanceTitle', 'Guidance for your current step');
        setText(
            'supportGuidanceText',
            application?.status
                ? `${workflowActionDescription(nextStep.actionPath, nextStep.description || 'Your next required action will appear here.')} Current application status: ${application.status}.`
                : 'Your next required action will appear here once your applicant record updates.'
        );

        const nextStepAction = document.getElementById('nextStepAction');
        if (nextStepAction) {
            nextStepAction.textContent = workflowActionLabel(nextStep.actionPath, nextStep.actionLabel || 'Refresh dashboard');
            nextStepAction.disabled = !nextStep.actionPath;
        }
    }

    function renderJourney() {
        const profile = state.dashboard.profile || {};
        const application = state.dashboard.application || {};
        const training = state.dashboard.training || {};
        const certificate = state.dashboard.certificate || {};

        setJourneyState('journeyStepProfile', (profile.completionPercent || 0) >= 100 ? 'complete' : 'current');

        const applicationStatus = String(application.status || '').toLowerCase();
        const applicationReady = ['approved', 'for training', 'training', 'post-approval', 'completed'].includes(applicationStatus);
        setJourneyState('journeyStepApplication', applicationReady ? 'complete' : ((profile.completionPercent || 0) >= 100 ? 'current' : 'upcoming'));

        const trainingSummary = training.summary || {};
        const trainingStarted = (training.invitees || []).length > 0;
        const trainingComplete = (trainingSummary.totalPrograms || 0) > 0 && (trainingSummary.completed || 0) >= (trainingSummary.totalPrograms || 0);
        setJourneyState('journeyStepTraining', trainingComplete ? 'complete' : (trainingStarted ? 'current' : 'upcoming'));
        setJourneyState('journeyStepCertificate', certificate.eligible ? 'complete' : (trainingComplete ? 'current' : 'upcoming'));
    }

    function renderAlerts() {
        const list = document.getElementById('applicantAlertList');
        if (!list) {
            return;
        }

        const requirements = state.dashboard.requirements || [];
        const application = state.dashboard.application || {};
        const training = state.dashboard.training || {};
        const alerts = [];

        const requirementIssue = requirements.find((item) => isRequirementIssue(item.status) || String(item.status || '').toLowerCase() === 'missing');
        if (requirementIssue) {
            alerts.push({
                label: 'Requirement',
                title: requirementIssue.label || requirementIssue.key || 'Requirement needs attention',
                copy: String(requirementIssue.status || '').toLowerCase() === 'missing'
                    ? 'A required file is still missing from your application.'
                    : `Current requirement status: ${normalizeRequirementStatus(requirementIssue.status)}.`,
            });
        }

        const latestRemark = (application.remarks || [])[0];
        if (latestRemark) {
            alerts.push({
                label: 'Reviewer remark',
                title: latestRemark.actorName || 'CSWDD',
                copy: truncateText(latestRemark.comment || 'Applicant-visible reviewer note available.', 120),
            });
        }

        if (training.nextSession) {
            alerts.push({
                label: 'Training schedule',
                title: training.nextSession.program?.programName || 'Upcoming session',
                copy: buildTrainingMeta(training.nextSession),
            });
        }

        const certificate = state.dashboard.certificate || {};
        if (certificate.eligible) {
            alerts.push({
                label: 'Certificate',
                title: 'Certificate ready',
                copy: 'Your certificate is ready to download from the Training page.',
            });
        }

        if (alerts.length === 0) {
            list.innerHTML = '<li class="attention-list__empty">High-value updates will appear here as your application moves.</li>';
            return;
        }

        list.innerHTML = alerts.slice(0, 4).map((item) => `
            <li class="attention-item">
                <span class="attention-item__label">${escapeHtml(item.label)}</span>
                <strong class="attention-item__title">${escapeHtml(item.title)}</strong>
                <p class="attention-item__copy">${escapeHtml(item.copy)}</p>
            </li>
        `).join('');
    }

    function renderTrainingChecklist(invitees) {
        const list = document.getElementById('trainingChecklist');
        if (!list) {
            return;
        }

        if (invitees.length === 0) {
            list.innerHTML = '<li class="empty">No training sessions have been assigned yet.</li>';
            return;
        }

        list.innerHTML = invitees.map((invitee) => `
            <li>
                <span>${escapeHtml(invitee.program?.programName || 'Training session')}</span>
                <span>${escapeHtml(invitee.status || 'Not Scheduled')}</span>
            </li>
        `).join('');
    }

    function renderTrainingSchedule(invitees) {
        const grid = document.getElementById('trainingScheduleGrid');
        if (!grid) {
            return;
        }

        if (invitees.length === 0) {
            grid.innerHTML = '<article class="training-schedule-empty">No training schedule yet. Wait for CSWDD notice updates.</article>';
            return;
        }

        grid.innerHTML = invitees.map((invitee) => {
            const program = invitee.program || {};
            return `
                <article class="training-schedule-card">
                    <span class="training-schedule-label">${escapeHtml(invitee.status || 'Not Scheduled')}</span>
                    <h3>${escapeHtml(program.programName || 'Training session')}</h3>
                    <div class="training-schedule-meta">
                        <span>${escapeHtml(formatDate(program.startsAt))}</span>
                        <span>${escapeHtml(formatTimeRange(program.startsAt, program.endsAt))}</span>
                        <span>${escapeHtml(program.venue || 'Venue to be announced')}</span>
                    </div>
                    <div class="training-schedule-status">
                        <span>${escapeHtml(program.whatToBring || 'No what-to-bring note yet.')}</span>
                    </div>
                    <div class="muted">${escapeHtml(program.instructions || 'No additional instructions yet.')}</div>
                </article>
            `;
        }).join('');
    }

    function renderAttendanceTable(invitees) {
        const body = document.getElementById('attendanceTableBody');
        if (!body) {
            return;
        }

        if (invitees.length === 0) {
            body.innerHTML = '<tr class="empty"><td colspan="5">Attendance updates will appear once sessions are assigned.</td></tr>';
            return;
        }

        body.innerHTML = invitees.map((invitee) => {
            const program = invitee.program || {};
            return `
                <tr>
                    <td>
                        <div class="table-primary">${escapeHtml(program.programName || 'Training session')}</div>
                        <div class="table-secondary">${escapeHtml(program.venue || 'Venue TBA')}</div>
                    </td>
                    <td>
                        <div>${escapeHtml(formatDate(program.startsAt))}</div>
                        <small class="table-secondary">${escapeHtml(formatTimeRange(program.startsAt, program.endsAt))}</small>
                    </td>
                    <td><span class="badge-status ${attendanceBadgeClass(invitee.status)}">${escapeHtml(invitee.status || 'Not Scheduled')}</span></td>
                    <td>${escapeHtml(invitee.remarks || 'No remarks yet.')}</td>
                    <td>${escapeHtml(buildNoticeMeta(invitee))}</td>
                </tr>
            `;
        }).join('');
    }

    function renderTimelineList(id, items, renderer, emptyCopy) {
        const list = document.getElementById(id);
        if (!list) {
            return;
        }

        if (!items || items.length === 0) {
            list.innerHTML = `<li class="empty">${escapeHtml(emptyCopy)}</li>`;
            return;
        }

        list.innerHTML = items.map(renderer).join('');
    }

    function renderHistoryItem(item) {
        const transition = item.fromStatus
            ? `${item.fromStatus} -> ${item.toStatus}`
            : item.toStatus;

        return `
            <li>
                <div class="timeline-main">
                    <div class="timeline-title">${escapeHtml(transition)}</div>
                    <div class="timeline-copy">${escapeHtml(item.remarks || 'No remarks recorded for this status update.')}</div>
                </div>
                <div class="timeline-meta">${escapeHtml(item.actorName || 'System')} | ${escapeHtml(formatDateTime(item.createdAt))}</div>
            </li>
        `;
    }

    function renderRemarkItem(item) {
        return `
            <li>
                <div class="timeline-main">
                    <div class="timeline-title">${escapeHtml(item.actorName || 'CSWDD')}</div>
                    <div class="timeline-copy">${escapeHtml(item.comment || 'No remark text.')}</div>
                </div>
                <div class="timeline-meta">${escapeHtml(formatDateTime(item.createdAt))}</div>
            </li>
        `;
    }

    function renderFatalState(message) {
        showToast(message, 'warning');
        document.querySelectorAll('.dash-page').forEach((page) => {
            page.classList.add('is-route-hidden');
        });
        const dashboardHome = document.getElementById('dashboard-home');
        dashboardHome?.classList.remove('is-route-hidden');
        if (dashboardHome) {
            dashboardHome.innerHTML = `
                <div class="panel-header">
                    <h2>Applicant dashboard unavailable</h2>
                    <p class="panel-subtitle">${escapeHtml(message)}</p>
                </div>
            `;
        }
    }

    async function handleLogout() {
        try {
            const payload = await fetchJson('auth/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            window.location.href = routeUrl(payload.redirect || 'portal');
        } catch (error) {
            showToast(error.message || 'Unable to log out right now.', 'warning');
        }
    }

    async function fetchJson(path, options = {}) {
        const response = await fetch(routeUrl(path), {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                ...options.headers,
            },
            ...options,
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            if (response.redirected) {
                window.location.href = response.url;
                throw new Error('Redirecting...');
            }

            throw new Error(`Unexpected response from ${path}.`);
        }

        const payload = await response.json();
        if (!response.ok) {
            if (payload.redirect) {
                window.location.href = routeUrl(payload.redirect);
                throw new Error('Redirecting...');
            }

            throw new Error(payload.message || 'Request failed.');
        }

        if (payload.redirect) {
            window.location.href = routeUrl(payload.redirect);
            throw new Error('Redirecting...');
        }

        return payload;
    }

    function applyRouteVisibility() {
        const pages = Array.from(document.querySelectorAll('.dash-page'));
        const routeMap = {
            overview: 'dashboard-home',
            'dashboard-home': 'dashboard-home',
            'profile-page': 'profile-page',
            'requirements-progress': 'application-page',
            'application-status': 'application-page',
            'notifications-panel': 'application-page',
            'application-forms': 'application-page',
            'application-page': 'application-page',
            'training-progress': 'training-page',
            'training-page': 'training-page',
            'support-panel': 'support-page',
            'support-page': 'support-page',
        };
        const rawHash = (window.location.hash || '#dashboard-home').replace('#', '');
        const targetId = routeMap[rawHash] || 'dashboard-home';
        const target = document.getElementById(targetId) || document.getElementById('dashboard-home');

        pages.forEach((page) => {
            page.classList.toggle('is-route-hidden', page !== target);
        });

        document.querySelectorAll('.sidebar-link').forEach((link) => {
            const href = (link.getAttribute('href') || '').replace('#', '');
            link.classList.toggle('is-active', href === target?.id);
        });

        syncSidebarMenuState();
    }

    function openSection(id) {
        const targetId = id || 'dashboard-home';
        window.location.hash = `#${targetId}`;
        applyRouteVisibility();
    }

    function navigateToPath(path) {
        if (!path) {
            return;
        }

        if (isProfileEditorPath(path)) {
            openSection('profile-page');
            return;
        }

        if (isApplicationFormsPath(path)) {
            openSection('application-forms');
            return;
        }

        window.location.href = routeUrl(path);
    }

    function toggleSidebarMenu() {
        const sidebar = document.querySelector('.dash-sidebar');
        if (!sidebar) {
            return;
        }

        sidebar.classList.toggle('is-open');
        syncSidebarMenuState();
    }

    function closeSidebarMenuOnMobile() {
        if (window.innerWidth > 960) {
            return;
        }

        const sidebar = document.querySelector('.dash-sidebar');
        sidebar?.classList.remove('is-open');
        syncSidebarMenuState();
    }

    function handleGlobalKeydown(event) {
        if (event.key === 'Escape') {
            closeSidebarMenuOnMobile();
        }
    }

    function handleWorkspaceShortcuts(event) {
        const profileTrigger = event.target.closest('[data-open-profile-editor]');
        if (profileTrigger) {
            event.preventDefault();
            openSection('profile-page');
            return;
        }

        const applicationTrigger = event.target.closest('[data-open-application-workspace]');
        if (applicationTrigger) {
            event.preventDefault();
            openSection('application-page');
        }
    }

    function syncSidebarMenuState() {
        const sidebar = document.querySelector('.dash-sidebar');
        const toggle = document.getElementById('sidebarToggle');
        const overlay = document.getElementById('sidebarOverlay');
        const closeButton = document.getElementById('sidebarClose');
        if (!sidebar || !toggle) {
            return;
        }

        if (window.innerWidth > 960) {
            sidebar.classList.remove('is-open');
            document.body.classList.remove('drawer-open');
            toggle.setAttribute('aria-expanded', 'false');
            overlay?.classList.remove('is-visible');
            overlay?.setAttribute('aria-hidden', 'true');
            sidebar.removeAttribute('aria-modal');
            sidebar.removeAttribute('aria-hidden');
            closeButton?.setAttribute('tabindex', '-1');
            return;
        }

        const isOpen = sidebar.classList.contains('is-open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        overlay?.classList.toggle('is-visible', isOpen);
        overlay?.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        if (isOpen) {
            sidebar.setAttribute('aria-modal', 'true');
        } else {
            sidebar.removeAttribute('aria-modal');
        }
        document.body.classList.toggle('drawer-open', isOpen);
        closeButton?.setAttribute('tabindex', isOpen ? '0' : '-1');
    }

    function routeUrl(path) {
        const base = state.baseUrl || '';
        return `${base}/${String(path || '').replace(/^\/+/, '')}`;
    }

    function isProfileEditorPath(path) {
        const normalized = String(path || '').trim().toLowerCase().replace(/^\/+/, '');
        return normalized === 'profile-completion'
            || normalized === 'applicant-dashboard#profile-page'
            || normalized === 'applicant-dashboard/?welcome=1#profile-page'
            || normalized === 'applicant-dashboard?welcome=1#profile-page'
            || normalized.endsWith('#profile-page');
    }

    function workflowActionLabel(path, fallback) {
        if (isProfileEditorPath(path)) {
            return 'Edit Profile';
        }

        if (isApplicationFormsPath(path)) {
            return 'Open Application';
        }

        return fallback;
    }

    function workflowActionDescription(path, fallback) {
        if (isProfileEditorPath(path)) {
            return 'Open your Profile page to update your personal details. Use Application for uploads, review, and submission.';
        }

        if (isApplicationFormsPath(path)) {
            return 'Open the Application page to complete your requirements, fill-up forms, and review updates.';
        }

        return sanitizeApplicantWording(fallback);
    }

    function isApplicationFormsPath(path) {
        const normalized = String(path || '').trim().toLowerCase().replace(/^\/+/, '');
        return normalized === 'post-approval'
            || normalized === 'applicant-dashboard#application-forms'
            || normalized.endsWith('#application-forms');
    }

    function buildTaskProgressText(task) {
        const normalized = String(task.status || '').toLowerCase();
        if (normalized === 'verified') return 'Done';
        if (normalized === 'submitted') return 'Sent and waiting for review';
        if (normalized === 'needs correction') return 'Needs correction before it can move forward';
        if (normalized === 'rejected') return 'Returned for changes';
        if (normalized === 'locked') return 'Waiting for the earlier requirement';
        return `${task.completion || 0}% complete`;
    }

    function buildTaskPrimaryState(task) {
        const normalized = String(task.status || '').toLowerCase();
        if (normalized === 'verified') return 'Done';
        if (task.interactive) return 'Available now';
        return 'Waiting for earlier step';
    }

    function setJourneyState(id, stateName) {
        const node = document.getElementById(id);
        if (!node) {
            return;
        }

        node.dataset.state = stateName || 'upcoming';
    }

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = value ?? '';
        }
    }

    function setTexts(ids, value) {
        ids.forEach((id) => setText(id, value));
    }

    function formatDate(value) {
        if (!value) {
            return '--';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(value) {
        if (!value) {
            return '--';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function formatTimeRange(start, end) {
        if (!start && !end) {
            return '--';
        }

        const parts = [start, end].map((value) => {
            const date = value ? new Date(value) : null;
            if (!date || Number.isNaN(date.getTime())) {
                return '--';
            }
            return date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
        });

        return `${parts[0]} - ${parts[1]}`;
    }

    function normalizeRequirementStatus(status) {
        const value = String(status || 'missing').trim().toLowerCase();
        if (value === 'verified') return 'Verified';
        if (value === 'pending') return 'Pending';
        if (value === 'missing') return 'Missing';
        if (value === 'flagged') return 'Flagged';
        if (value === 'rejected') return 'Rejected';
        if (value === 'needs correction' || value === 'needs_correction') return 'Needs Correction';
        return status || 'Pending';
    }

    function requirementStatusClass(status) {
        const value = normalizeRequirementStatus(status).toLowerCase();
        if (value === 'verified') return 'requirement-status--complete';
        if (value === 'missing') return 'requirement-status--missing';
        if (value === 'flagged' || value === 'rejected' || value === 'needs correction') return 'requirement-status--issue';
        return 'requirement-status--pending';
    }

    function isRequirementIssue(status) {
        return ['flagged', 'rejected', 'needs correction', 'needs_correction'].includes(String(status || '').toLowerCase());
    }

    function buildOverviewStatusNote(application) {
        if (!application) {
            return 'Complete profile completion first so your application enters the review workflow.';
        }

        const dates = [];
        if (application.submittedAt) {
            dates.push(`Submitted ${formatDate(application.submittedAt)}`);
        }
        if (application.reviewedAt) {
            dates.push(`Last reviewed ${formatDate(application.reviewedAt)}`);
        }
        return dates.join(' | ') || 'Application is waiting for the next workflow update.';
    }

    function buildTrainingOverviewNote(summary, training) {
        if ((summary.totalPrograms || 0) === 0) {
            return 'No training schedule has been assigned yet.';
        }

        if ((summary.completed || 0) > 0) {
            return `${summary.completed} completed session${summary.completed === 1 ? '' : 's'} recorded.`;
        }

        if ((summary.notified || 0) > 0) {
            return `${summary.notified} session notice${summary.notified === 1 ? ' has' : 's have'} been sent.`;
        }

        if (training.nextSession) {
            return `Next session: ${formatDate(training.nextSession.program?.startsAt)}.`;
        }

        return 'Training activity is available in your applicant record.';
    }

    function buildApplicationDateMeta(application) {
        if (!application) {
            return 'Application has not been submitted yet.';
        }

        const parts = [];
        if (application.submittedAt) {
            parts.push(`Submitted ${formatDate(application.submittedAt)}`);
        }
        if (application.reviewedAt) {
            parts.push(`Reviewed ${formatDate(application.reviewedAt)}`);
        }
        if (application.updatedAt) {
            parts.push(`Updated ${formatDate(application.updatedAt)}`);
        }
        return parts.join(' | ') || 'Awaiting workflow timestamps.';
    }

    function buildProfileApplicationNote(application) {
        if (!application || !application.status || application.status === 'Draft') {
            return 'Keep these details updated before you upload or submit application requirements.';
        }

        return 'Your Application page uses the same profile details shown here.';
    }

    function sanitizeCertificateNote(note) {
        return sanitizeApplicantWording(note)
            .replace(/verified application forms/gi, 'verified application requirements')
            .replace(/application forms/gi, 'application requirements');
    }

    function sanitizeApplicantWording(text) {
        return String(text || '')
            .replace(/post-approval compliance/gi, 'application requirements')
            .replace(/post-approval phase/gi, 'application requirements')
            .replace(/post-approval tasks/gi, 'application requirements')
            .replace(/post-approval forms/gi, 'application requirements')
            .replace(/application forms/gi, 'application requirements')
            .replace(/compliance/gi, 'requirements');
    }

    function buildTrainingMeta(invitee) {
        const program = invitee.program || {};
        const parts = [
            formatDate(program.startsAt),
            formatTimeRange(program.startsAt, program.endsAt),
            program.venue || '',
        ].filter(Boolean);
        return parts.join(' | ');
    }

    function buildNoticeMeta(invitee) {
        if (invitee.lastNoticeSentAt) {
            return `Last sent ${formatDateTime(invitee.lastNoticeSentAt)}`;
        }
        if (invitee.notifiedAt) {
            return `Notified ${formatDateTime(invitee.notifiedAt)}`;
        }
        return 'No notice sent yet';
    }

    function buildRequirementHelpText(item) {
        const label = String(item.label || item.key || 'requirement').toLowerCase();
        if (label.includes('id')) return 'Make sure the file is clear and the name matches your current details.';
        if (label.includes('barangay')) return 'This helps confirm your current address and local residency.';
        if (label.includes('certificate')) return 'Upload a readable copy so the reviewer can check it quickly.';
        return 'This file is needed before your application can move to the next step.';
    }

    function normalizeRequirementStatusSimple(item) {
        const raw = String(item.status || '').toLowerCase();
        if (raw === 'verified') return 'Approved';
        if (raw === 'pending') return item.file?.path ? 'Under review' : 'Not uploaded';
        if (raw === 'missing') return 'Not uploaded';
        if (raw === 'flagged' || raw === 'needs correction' || raw === 'needs_correction' || raw === 'rejected') return 'Needs correction';
        return item.file?.path ? 'Uploaded' : 'Not uploaded';
    }

    function notificationTone(item) {
        const source = `${item.title || ''} ${item.message || ''}`.toLowerCase();
        if (source.includes('correction') || source.includes('fix') || source.includes('remark')) return 'correction';
        if (source.includes('schedule') || source.includes('training') || source.includes('session')) return 'schedule';
        if (source.includes('approved') || source.includes('completed') || source.includes('verified')) return 'success';
        if (source.includes('review') || source.includes('status')) return 'review';
        return 'reminder';
    }

    function notificationToneLabel(tone) {
        if (tone === 'correction') return 'Correction needed';
        if (tone === 'schedule') return 'Schedule';
        if (tone === 'review') return 'Review update';
        if (tone === 'success') return 'Completed';
        return 'Reminder';
    }

    function notificationActionLabel(tone, requiresAction) {
        if (tone === 'schedule') return 'View schedule';
        if (tone === 'correction') return 'Review changes';
        if (tone === 'review') return 'View update';
        if (tone === 'success') return 'Review result';
        if (requiresAction) return 'Open details';
        return 'Open';
    }

    function prepareNotifications(notifications) {
        return notifications
            .map(buildNotificationModel)
            .sort((left, right) => {
                const dateDifference = notificationDateValue(right) - notificationDateValue(left);
                if (dateDifference !== 0) {
                    return dateDifference;
                }

                return notificationPriority(right) - notificationPriority(left);
            });
    }

    function dedupeNotifications(notifications) {
        const seen = new Set();
        return notifications.filter((item) => {
            const key = item.dedupeKey;
            if (!key || seen.has(key)) {
                return !key;
            }

            seen.add(key);
            return true;
        });
    }

    function buildNotificationModel(item) {
        const tone = notificationTone(item);
        const title = sanitizeNotificationTitle(item.title || 'Notification', tone);
        const summary = sanitizeNotificationMessage(item.message || '', title);
        const subject = notificationSubject(item, title, summary);
        const dateValue = item.sentAt || item.createdAt || item.updatedAt || '';
        const requiresAction = tone === 'correction' || hasActionPhrase(summary);

        return {
            tone,
            title,
            summary,
            meta: buildNotificationMeta(item, tone),
            dateValue,
            actionHref: item.actionPath || item.path || item.url || '',
            requiresAction,
            dedupeKey: `${tone}:${subject}`,
        };
    }

    function sanitizeNotificationTitle(title, tone) {
        const cleanTitle = sanitizeApplicantWording(title)
            .replace(/\bverified\b/gi, tone === 'correction' ? 'needs changes' : 'approved')
            .replace(/\bsubmitted\b/gi, 'received')
            .replace(/\bchecked by pdo\b/gi, 'reviewed by PDO')
            .trim();

        return cleanTitle || 'Application update';
    }

    function sanitizeNotificationMessage(message, title) {
        const cleanMessage = sanitizeApplicantWording(message)
            .replace(/your submitted form/gi, 'your submitted requirement')
            .replace(/is now awaiting revi\w*/gi, 'is now waiting for review')
            .replace(/was reviewed and verified by cswdd staff/gi, 'was reviewed by CSWDD staff')
            .replace(/remarks:\s*/gi, 'Note: ')
            .trim();

        if (!cleanMessage || cleanMessage === title) {
            return '';
        }

        return cleanMessage;
    }

    function notificationSubject(item, title, summary) {
        const source = `${item.title || ''} ${title} ${summary}`;
        const match = source.match(/(business plan|valid id|health certificate|cedula|training|session|certificate|barangay certificate)/i);
        if (match) {
            return match[1].toLowerCase();
        }

        return String(title || 'notification').toLowerCase().replace(/\b(received|approved|needs changes|reviewed by pdo|application update)\b/g, '').trim();
    }

    function buildNotificationMeta(item, tone) {
        const actor = item.actorName || item.senderName || item.source || '';
        if (tone === 'schedule') {
            return 'Check the Training page for the full schedule and attendance details.';
        }
        if (tone === 'correction') {
            return actor ? `Latest review note from ${actor}.` : 'A reviewer left instructions for this requirement.';
        }
        if (tone === 'review') {
            return actor ? `Latest update from ${actor}.` : 'This requirement is moving through review.';
        }
        if (tone === 'success') {
            return 'This requirement has reached a completed review step.';
        }

        return '';
    }

    function notificationPriority(item) {
        const tone = item.tone || notificationTone(item);
        if (tone === 'correction') return 4;
        if (tone === 'schedule') return 3;
        if (tone === 'review') return 2;
        if (tone === 'success') return 1;
        return 0;
    }

    function notificationDateValue(item) {
        const value = new Date(item.dateValue || item.sentAt || item.createdAt || item.updatedAt || 0).getTime();
        return Number.isNaN(value) ? 0 : value;
    }

    function hasActionPhrase(text) {
        return /need|fix|correct|update|required|action/i.test(String(text || ''));
    }

    function routeMaybeAbsolute(path) {
        if (/^https?:\/\//i.test(String(path || ''))) {
            return path;
        }
        return routeUrl(path);
    }

    function attendanceBadgeClass(status) {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'attended' || normalized === 'completed') return 'present';
        if (normalized === 'missed') return 'absent';
        if (normalized === 'notified') return 'late';
        return 'pending';
    }

    function slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function showToast(message, tone) {
        const stack = document.getElementById('toastStack');
        if (!stack) {
            return;
        }

        const toast = document.createElement('div');
        toast.className = `toast ${tone || 'info'}`;
        toast.textContent = message;
        stack.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2600);
        setTimeout(() => {
            toast.remove();
        }, 3400);
    }

    function escapeHtml(value) {
        const node = document.createElement('div');
        node.textContent = value == null ? '' : String(value);
        return node.innerHTML;
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/"/g, '&quot;');
    }

    function truncateText(value, limit) {
        const text = String(value || '').trim();
        if (text.length <= limit) {
            return text;
        }
        return `${text.slice(0, Math.max(0, limit - 1)).trimEnd()}...`;
    }
})();

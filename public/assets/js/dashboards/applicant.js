(function () {
    const state = {
        baseUrl: window.SMARTLEAP_BASE_URL || '',
        authUser: window.SMARTLEAP_AUTH_USER || null,
        dashboard: null,
        nextStepPath: null,
        activePostApprovalCode: null,
        activePostApprovalPayload: null,
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        bindStaticEvents();
        await loadDashboardState();
    }

    function bindStaticEvents() {
        document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
        document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebarMenu);
        document.getElementById('openProfileCompletion')?.addEventListener('click', () => {
            window.location.href = routeUrl('profile-completion');
        });
        document.getElementById('openPostApprovalTracker')?.addEventListener('click', () => {
            window.location.href = routeUrl('post-approval');
        });
        document.getElementById('downloadCertificateButton')?.addEventListener('click', () => {
            const path = state.dashboard?.certificate?.downloadPath;
            if (path) {
                window.location.href = routeUrl(path);
            }
        });
        document.getElementById('nextStepAction')?.addEventListener('click', () => {
            if (state.nextStepPath) {
                window.location.href = routeUrl(state.nextStepPath);
            }
        });
        document.getElementById('postApprovalTaskCards')?.addEventListener('click', handlePostApprovalCardClick);

        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.addEventListener('click', (event) => {
                const hash = link.getAttribute('href') || '#overview';
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
        renderPostApproval();
        renderCertificate();
        renderNotifications();
        renderSupport();
    }

    function renderIdentity() {
        const authUser = state.dashboard.authUser || state.authUser || {};
        const profile = state.dashboard.profile || {};
        const displayName = authUser.name || 'Applicant';
        const businessName = profile.businessName || profile.livelihood || 'Applicant profile';
        const email = authUser.email || '--';
        const initial = (displayName.trim().charAt(0) || 'A').toUpperCase();

        setText('sidebarUserName', displayName);
        setText('sidebarUserBusiness', businessName);
        setText('bannerGreeting', `${displayName}${businessName ? ` - ${businessName}` : ''}`);
        setText('userEmail', email);
        setText('profileName', displayName);
        setText('profileEmail', email);

        const avatarIds = ['sidebarAvatar', 'bannerAvatar'];
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
        const nextStep = state.dashboard.nextStep || {};
        const requirements = state.dashboard.requirements || [];
        const uploadedCount = requirements.filter((item) => item.file && item.file.path).length;
        const verifiedCount = requirements.filter((item) => String(item.status || '').toLowerCase() === 'verified').length;

        const status = application?.status || 'No application yet';
        const profileCompletion = profile?.completionPercent ?? 0;
        const trainingStatus = training.currentStatus || 'Not Scheduled';
        const trainingSummary = training.summary || {};

        setText('bannerStatus', status);
        setText('bannerProfileCompletion', `${profileCompletion}%`);
        setText('bannerTrainingStatus', trainingStatus);
        setText('bannerNextStep', nextStep.title || 'Complete your profile');

        setText('overviewStatus', status);
        setText('overviewStatusNote', buildOverviewStatusNote(application));
        setText('overviewRequirements', `${uploadedCount}/${requirements.length || 3} uploaded`);
        setText(
            'overviewRequirementsNote',
            verifiedCount > 0
                ? `${verifiedCount} requirement${verifiedCount === 1 ? '' : 's'} verified so far.`
                : 'Requirement review activity will appear here once CSWDD checks your uploads.'
        );
        setText('overviewTrainingStatus', trainingStatus);
        setText('overviewTrainingNote', buildTrainingOverviewNote(trainingSummary, training));
        setText('overviewNextStepTitle', nextStep.title || 'Complete your applicant profile');
        setText('overviewNextStepDescription', nextStep.description || 'Your next required action will appear here.');
    }

    function renderProfile() {
        const profile = state.dashboard.profile || {};
        setInputValue('profileBarangay', profile.barangay || '--');
        setInputValue('profileContact', profile.contactNumber || '--');
        setInputValue('profileAddress', profile.address || '--');
        setInputValue('profileBusinessName', profile.businessName || '--');
        setInputValue('profileLivelihood', profile.livelihood || '--');
        setInputValue('profileSector', profile.sector || '--');
        setInputValue('profileHouseholdSize', profile.householdSize != null ? String(profile.householdSize) : '--');
        setInputValue('profileGender', profile.gender || '--');
        setInputValue('profileBirthdate', formatDate(profile.birthdate));
        setInputValue('profile4ps', profile.is4ps || '--');
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
            const fileName = item.file?.name ? escapeHtml(item.file.name) : 'No uploaded file';
            const fileMeta = item.updatedAt ? `Updated ${formatDate(item.updatedAt)}` : 'Awaiting upload';
            const fileLink = item.file?.url
                ? `<a href="${escapeAttribute(item.file.url)}" target="_blank" rel="noopener">Open file</a>`
                : '<span class="muted">No file</span>';

            return `
                <li>
                    <div>
                        <strong>${escapeHtml(item.label || item.key || 'Requirement')}</strong>
                        <div class="requirement-file-meta">${fileName}</div>
                        <div class="requirement-file-meta">${escapeHtml(fileMeta)}</div>
                    </div>
                    <div class="requirement-actions">
                        ${fileLink}
                        <span class="requirement-status ${statusClass}">${escapeHtml(normalizeRequirementStatus(item.status))}</span>
                    </div>
                </li>
            `;
        }).join('');
    }

    function renderApplication() {
        const application = state.dashboard.application;
        const postApproval = state.dashboard.postApproval || {};

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

        const unlocked = Boolean(postApproval.isUnlocked) || postApproval.totalTasks > 0 || Boolean(state.dashboard.training?.latestUnlockedAt);
        setText('postApprovalValue', unlocked ? 'Eligible' : 'Locked');
        setText(
            'postApprovalNote',
            unlocked
                ? postApproval.totalTasks > 0
                    ? `${postApproval.pendingTasks} pending post-approval task${postApproval.pendingTasks === 1 ? '' : 's'} available.`
                    : `Training completion unlock was recorded${postApproval.unlockedAt ? ` on ${formatDateTime(postApproval.unlockedAt)}` : ''}.`
                : 'Training completion has not unlocked post-approval tasks yet.'
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
        setText('trainingAttendedCount', String(summary.attended || 0));
        setText('trainingCompletedCount', String(summary.completed || 0));
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
        setText(
            'certificateMeta',
            `${certificate.trainingCompleted || 0}/${certificate.trainingTotal || 0} trainings completed · ${certificate.postApprovalVerified || 0}/${certificate.postApprovalTotal || 0} verified forms`
        );
        setText('certificateNote', certificate.note || 'Certificate availability will be shown here once all requirements are complete.');

        if (statusButton) {
            statusButton.disabled = !certificate.eligible;
            statusButton.textContent = certificate.eligible
                ? 'Download certificate (PDF)'
                : 'Certificate locked';
        }
    }

    function renderPostApproval() {
        const postApproval = state.dashboard.postApproval || {};
        const tasks = Array.isArray(postApproval.tasks) ? postApproval.tasks : [];
        const unlocked = Boolean(postApproval.isUnlocked);
        const interactiveTask = tasks.find((task) => task.interactive);
        const nextTask = tasks.find((task) => task.interactive && ['Unlocked', 'In Progress', 'Needs Correction', 'Rejected'].includes(task.status))
            || interactiveTask
            || tasks[0]
            || null;

        setText('postApprovalUnlockState', unlocked ? 'Unlocked' : 'Locked');
        setText(
            'postApprovalUnlockMeta',
            unlocked
                ? `Unlocked${postApproval.unlockedAt ? ` on ${formatDateTime(postApproval.unlockedAt)}` : ''} after your training completion.`
                : 'Training completion has not unlocked post-approval forms yet.'
        );
        setText('postApprovalProgressValue', `${postApproval.completedTasks || 0}/${postApproval.totalTasks || 0} verified`);
        setText(
            'postApprovalProgressMeta',
            tasks.length > 0
                ? `${postApproval.pendingTasks || 0} task${(postApproval.pendingTasks || 0) === 1 ? '' : 's'} still need action or review.`
                : 'No post-approval tasks are available yet.'
        );
        setText(
            'postApprovalPriority',
            interactiveTask
                ? interactiveTask.title
                : unlocked
                    ? 'Next digital form rollout pending'
                    : 'Await training unlock'
        );
        setText(
            'postApprovalPriorityMeta',
            interactiveTask
                ? 'Start with the highest-priority live digital form in this phase.'
                : unlocked
                    ? 'Additional post-approval forms remain staged for the next implementation pass.'
                    : 'Availment and Validation forms will appear here once unlocked.'
        );
        setText('postApprovalTaskCount', `${tasks.length} task${tasks.length === 1 ? '' : 's'}`);
        setText(
            'postApprovalLauncherMeta',
            nextTask
                ? `Open the dedicated task tracker to continue with ${nextTask.title}.`
                : 'Open the dedicated task tracker to review unlocked forms, statuses, and next actions.'
        );

        renderPostApprovalTaskCards(tasks);
    }

    function renderPostApprovalTaskCards(tasks) {
        const container = document.getElementById('postApprovalTaskCards');
        if (!container) {
            return;
        }

        if (tasks.length === 0) {
            container.innerHTML = '<article class="post-approval-taskcard is-empty">Post-approval tasks will appear here after training completion.</article>';
            return;
        }

        container.innerHTML = tasks.map((task) => `
            <button type="button" class="post-approval-taskcard" data-task-code="${escapeAttribute(task.code)}">
                <div class="post-approval-taskcard__meta">
                    <span class="post-approval-taskcard__status status-${slugify(task.status)}">${escapeHtml(task.status)}</span>
                    ${task.interactive ? '<span class="post-approval-taskcard__badge">Open tracker</span>' : '<span class="post-approval-taskcard__badge is-muted">Staged next</span>'}
                </div>
                <strong>${escapeHtml(task.title)}</strong>
                <p>${escapeHtml(task.summary || task.helpText || '')}</p>
                <div class="post-approval-taskcard__footer">
                    <span>${escapeHtml(`${task.completion || 0}% complete`)}</span>
                    ${task.reviewerRemarks ? '<span class="post-approval-taskcard__issue">Has remarks</span>' : '<span class="post-approval-taskcard__badge">View task</span>'}
                </div>
            </button>
        `).join('');
    }

    function renderPostApprovalWorkspace(task) {
        const title = document.getElementById('postApprovalWorkspaceTitle');
        const subtitle = document.getElementById('postApprovalWorkspaceSubtitle');
        const status = document.getElementById('postApprovalWorkspaceStatus');
        const notice = document.getElementById('postApprovalWorkspaceNotice');
        const form = document.getElementById('postApprovalForm');
        const sections = document.getElementById('postApprovalFormSections');
        const staffSections = document.getElementById('postApprovalStaffSections');
        const saveButton = document.getElementById('postApprovalSaveButton');
        const submitButton = document.getElementById('postApprovalSubmitButton');

        if (!task) {
            title && (title.textContent = 'Select a task');
            subtitle && (subtitle.textContent = 'Choose a task card to open the applicant form workspace.');
            status && (status.textContent = 'Locked');
            notice && (notice.textContent = 'No unlocked form selected yet.');
            form?.classList.add('is-hidden');
            if (sections) sections.innerHTML = '';
            if (staffSections) staffSections.innerHTML = '';
            return;
        }

        title && (title.textContent = task.title);
        subtitle && (subtitle.textContent = task.summary || task.helpText || '');
        status && (status.textContent = task.status);

        if (!task.interactive) {
            notice && (notice.textContent = task.helpText || 'This task is staged for a later digital form pass.');
            form?.classList.add('is-hidden');
            if (sections) sections.innerHTML = '';
            if (staffSections) staffSections.innerHTML = renderStaffSections(task.staffSections || [], task.reviewerRemarks);
            return;
        }

        notice && (notice.textContent = buildPostApprovalNotice(task));
        form?.classList.remove('is-hidden');
        if (sections) {
            sections.innerHTML = task.code === 'availment_form'
                ? renderAvailmentSections(state.activePostApprovalPayload || task.payload || {})
                : renderValidationSections(state.activePostApprovalPayload || task.payload || {});
        }
        if (staffSections) {
            staffSections.innerHTML = renderStaffSections(task.staffSections || [], task.reviewerRemarks);
        }
        if (saveButton) {
            saveButton.disabled = task.status === 'Submitted' || task.status === 'Verified';
        }
        if (submitButton) {
            submitButton.disabled = task.status === 'Submitted' || task.status === 'Verified';
        }
    }

    function renderAvailmentSections(payload) {
        const data = payload || {};
        const familyMembers = Array.isArray(data.familyEnterprise?.members) && data.familyEnterprise.members.length > 0
            ? data.familyEnterprise.members
            : [{ name: '', age: '', activities: '' }];
        const incomeRows = Array.isArray(data.incomeEligibility?.rows) && data.incomeEligibility.rows.length > 0
            ? data.incomeEligibility.rows
            : [{ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' }];

        return `
            <section class="post-form-section">
                <div class="post-form-section__header">
                    <h4>Client identifying data</h4>
                    <p>Applicant-entered details from the SMART LEAP Availment Form.</p>
                </div>
                <div class="form-grid">
                    ${renderField('Client name', 'clientIdentifyingData.name', data.clientIdentifyingData?.name || '', 'text')}
                    ${renderField('Age', 'clientIdentifyingData.age', data.clientIdentifyingData?.age || '', 'number')}
                    ${renderField('Address', 'clientIdentifyingData.address', data.clientIdentifyingData?.address || '', 'text', true)}
                    ${renderField('Name of spouse', 'clientIdentifyingData.spouseName', data.clientIdentifyingData?.spouseName || '', 'text')}
                    ${renderReadOnlyField('City', data.clientIdentifyingData?.city || 'Butuan City')}
                </div>
            </section>
            <section class="post-form-section">
                <div class="post-form-section__header">
                    <h4>Type of project: Family Enterprise</h4>
                    <p>List all family members participating in the enterprise and what each one will do.</p>
                </div>
                <div class="repeatable-group" data-repeatable="familyMembers">
                    ${familyMembers.map((row, index) => renderFamilyMemberRow(row, index)).join('')}
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-outline small" data-row-action="add-family">Add family member</button>
                </div>
            </section>
            <section class="post-form-section">
                <div class="post-form-section__header">
                    <h4>Type of project: Individual Assistance</h4>
                    <p>Capture the applicant-facing narrative fields from the paper form.</p>
                </div>
                <div class="form-grid">
                    ${renderField('Clientele category', 'individualAssistance.clienteleCategory', data.individualAssistance?.clienteleCategory || '', 'text')}
                    ${renderTextarea('Nature of difficult circumstances', 'individualAssistance.natureOfDifficultCircumstances', data.individualAssistance?.natureOfDifficultCircumstances || '', true, 'Describe the circumstance that supports the availment request.')}
                </div>
            </section>
            <section class="post-form-section">
                <div class="post-form-section__header">
                    <h4>Income eligibility requirement</h4>
                    <p>Provide the working family members and their monthly income details.</p>
                </div>
                <div class="repeatable-group repeatable-group--income" data-repeatable="incomeRows">
                    ${incomeRows.map((row, index) => renderIncomeRow(row, index)).join('')}
                </div>
                <div class="form-actions form-actions--split">
                    <button type="button" class="btn-outline small" data-row-action="add-income">Add income row</button>
                    ${renderField('Total family income', 'incomeEligibility.totalFamilyIncome', data.incomeEligibility?.totalFamilyIncome || '', 'number')}
                </div>
            </section>
            <section class="post-form-section">
                <div class="post-form-section__header">
                    <h4>Social responsibility and willingness to save</h4>
                    <p>This covers the applicant commitment statements from the paper availment form. Signature lines are still excluded in this pass.</p>
                </div>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToPolicies" ${data.clientCommitment?.agreedToPolicies ? 'checked' : ''}>
                    <span>I agree to abide by the SMART LEAP policies and guidelines set by CSWDD.</span>
                </label>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToSavingsCommitment" ${data.clientCommitment?.agreedToSavingsCommitment ? 'checked' : ''}>
                    <span>I will generate the required savings and comply with the SMART LEAP roll-back commitment.</span>
                </label>
                ${renderTextarea('Optional applicant note', 'clientCommitment.notes', data.clientCommitment?.notes || '', false, 'Add any clarifying note related to your availment commitment.')}
            </section>
        `;
    }

    function renderValidationSections(payload) {
        const data = payload || {};
        return `
            <section class="post-form-section">
                <div class="post-form-section__header">
                    <h4>Applicant details</h4>
                    <p>Fill the applicant-side information block from the SMART LEAP Validation Form.</p>
                </div>
                <div class="form-grid">
                    ${renderField('Date of validation', 'applicantDetails.validationDate', data.applicantDetails?.validationDate || '', 'date')}
                    ${renderField('Last name', 'applicantDetails.lastName', data.applicantDetails?.lastName || '', 'text')}
                    ${renderField('First name', 'applicantDetails.firstName', data.applicantDetails?.firstName || '', 'text')}
                    ${renderField('Middle name', 'applicantDetails.middleName', data.applicantDetails?.middleName || '', 'text')}
                    ${renderField('Purok', 'applicantDetails.purok', data.applicantDetails?.purok || '', 'text')}
                    ${renderField('Barangay', 'applicantDetails.barangay', data.applicantDetails?.barangay || '', 'text')}
                    ${renderField('Birthdate', 'applicantDetails.birthdate', data.applicantDetails?.birthdate || '', 'date')}
                    ${renderField('Educational attainment', 'applicantDetails.educationalAttainment', data.applicantDetails?.educationalAttainment || '', 'text')}
                    ${renderField('Contact number', 'applicantDetails.contactNumber', data.applicantDetails?.contactNumber || '', 'text')}
                </div>
            </section>
            <section class="post-form-section">
                <div class="post-form-section__header">
                    <h4>Checklist</h4>
                    <p>Answer the membership checklist items exactly as required by the paper form.</p>
                </div>
                <div class="form-grid">
                    ${renderSelectField('Pantawid member', 'membershipChecklist.pantawidMember', data.membershipChecklist?.pantawidMember || '', ['','Yes','No'])}
                    ${renderField('Pantawid specify', 'membershipChecklist.pantawidSpecify', data.membershipChecklist?.pantawidSpecify || '', 'text')}
                    ${renderSelectField('SLPA member', 'membershipChecklist.slpaMember', data.membershipChecklist?.slpaMember || '', ['','Yes','No'])}
                    ${renderField('SLPA specify', 'membershipChecklist.slpaSpecify', data.membershipChecklist?.slpaSpecify || '', 'text')}
                </div>
            </section>
        `;
    }

    function renderStaffSections(sections, reviewerRemarks) {
        const cards = sections.map((section) => `
            <article class="post-approval-staffcard">
                <strong>${escapeHtml(section.title || 'Staff section')}</strong>
                <p>${escapeHtml(section.description || '')}</p>
            </article>
        `).join('');

        const remarks = reviewerRemarks
            ? `<article class="post-approval-staffcard is-warning"><strong>Reviewer remarks</strong><p>${escapeHtml(reviewerRemarks)}</p></article>`
            : '';

        return cards + remarks;
    }

    function renderReadOnlyField(label, value) {
        return `
            <label class="form-field">
                <span>${escapeHtml(label)}</span>
                <input type="text" value="${escapeAttribute(value ?? '')}" readonly>
            </label>
        `;
    }

    function renderField(label, name, value, type, full = false) {
        return `
            <label class="form-field ${full ? 'full' : ''}">
                <span>${escapeHtml(label)}</span>
                <input type="${escapeAttribute(type || 'text')}" name="${escapeAttribute(name)}" value="${escapeAttribute(value ?? '')}">
            </label>
        `;
    }

    function renderTextarea(label, name, value, full = false, hint = '') {
        return `
            <label class="form-field ${full ? 'full' : ''}">
                <span>${escapeHtml(label)}</span>
                <textarea name="${escapeAttribute(name)}" rows="4">${escapeHtml(value ?? '')}</textarea>
                ${hint ? `<small class="field-hint">${escapeHtml(hint)}</small>` : ''}
            </label>
        `;
    }

    function renderSelectField(label, name, value, options) {
        return `
            <label class="form-field">
                <span>${escapeHtml(label)}</span>
                <select name="${escapeAttribute(name)}">
                    ${options.map((option) => `<option value="${escapeAttribute(option)}" ${String(value) === String(option) ? 'selected' : ''}>${escapeHtml(option || 'Select')}</option>`).join('')}
                </select>
            </label>
        `;
    }

    function renderFamilyMemberRow(row, index) {
        return `
            <div class="repeatable-row">
                <div class="form-grid">
                    ${renderField('Family member', `familyEnterprise.members.${index}.name`, row.name || '', 'text')}
                    ${renderField('Age', `familyEnterprise.members.${index}.age`, row.age || '', 'number')}
                    ${renderField('Activities', `familyEnterprise.members.${index}.activities`, row.activities || '', 'text', true)}
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-outline small" data-row-action="remove-family" data-row-index="${index}">Remove</button>
                </div>
            </div>
        `;
    }

    function renderIncomeRow(row, index) {
        return `
            <div class="repeatable-row">
                <div class="form-grid">
                    ${renderField('Working family member', `incomeEligibility.rows.${index}.memberName`, row.memberName || '', 'text')}
                    ${renderField('Cash income', `incomeEligibility.rows.${index}.cashIncome`, row.cashIncome || '', 'number')}
                    ${renderField('Non-cash income', `incomeEligibility.rows.${index}.nonCashIncome`, row.nonCashIncome || '', 'number')}
                    ${renderField('Total income', `incomeEligibility.rows.${index}.totalIncome`, row.totalIncome || '', 'number')}
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-outline small" data-row-action="remove-income" data-row-index="${index}">Remove</button>
                </div>
            </div>
        `;
    }

    function renderNotifications() {
        const notifications = state.dashboard.notifications || [];
        const list = document.getElementById('notificationList');
        if (!list) {
            return;
        }

        if (notifications.length === 0) {
            list.innerHTML = '<li class="empty">No notifications yet.</li>';
            return;
        }

        list.innerHTML = notifications.map((item) => `
            <li>
                <div class="notification-title">${escapeHtml(item.title || 'Notification')}</div>
                <div>${escapeHtml(item.message || '')}</div>
                <div class="notification-meta">${escapeHtml(formatDateTime(item.sentAt || item.createdAt))}</div>
            </li>
        `).join('');
    }

    function renderSupport() {
        const nextStep = state.dashboard.nextStep || {};
        state.nextStepPath = nextStep.actionPath || null;
        setText('nextStepTitle', nextStep.title || 'Complete your applicant profile');
        setText('nextStepDescription', nextStep.description || 'Your next required action will appear here.');

        const nextStepAction = document.getElementById('nextStepAction');
        if (nextStepAction) {
            nextStepAction.textContent = nextStep.actionLabel || 'Refresh dashboard';
            nextStepAction.disabled = !nextStep.actionPath;
        }
    }

    function handlePostApprovalCardClick(event) {
        const button = event.target.closest('[data-task-code]');
        if (!button) {
            return;
        }

        const code = button.getAttribute('data-task-code');
        if (!code) {
            return;
        }

        window.location.href = routeUrl(`post-approval-form?code=${encodeURIComponent(code)}`);
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
                <div class="timeline-title">${escapeHtml(transition)}</div>
                <div>${escapeHtml(item.remarks || 'No remarks recorded for this status update.')}</div>
                <div class="timeline-meta">${escapeHtml(item.actorName || 'System')} | ${escapeHtml(formatDateTime(item.createdAt))}</div>
            </li>
        `;
    }

    function renderRemarkItem(item) {
        return `
            <li>
                <div class="timeline-title">${escapeHtml(item.actorName || 'CSWDD')}</div>
                <div>${escapeHtml(item.comment || 'No remark text.')}</div>
                <div class="timeline-meta">${escapeHtml(formatDateTime(item.createdAt))}</div>
            </li>
        `;
    }

    function renderFatalState(message) {
        showToast(message, 'warning');
        setText('bannerGreeting', 'Applicant dashboard unavailable');
        setText('userEmail', '');
        document.querySelectorAll('.dash-section').forEach((section) => {
            section.classList.add('is-route-hidden');
        });
        const overview = document.getElementById('overview');
        overview?.classList.remove('is-route-hidden');
        if (overview) {
            overview.innerHTML = `
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
        const sections = Array.from(document.querySelectorAll('.dash-section'));
        const hash = (window.location.hash || '#overview').replace('#', '');
        let target = document.getElementById(hash);
        if (!target || !target.classList.contains('dash-section')) {
            target = document.getElementById('overview');
        }

        sections.forEach((section) => {
            section.classList.toggle('is-route-hidden', section !== target);
        });

        document.querySelectorAll('.sidebar-link').forEach((link) => {
            const href = (link.getAttribute('href') || '').replace('#', '');
            link.classList.toggle('is-active', href === target?.id);
        });

        syncSidebarMenuState();
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

    function syncSidebarMenuState() {
        const sidebar = document.querySelector('.dash-sidebar');
        const toggle = document.getElementById('sidebarToggle');
        if (!sidebar || !toggle) {
            return;
        }

        if (window.innerWidth > 960) {
            sidebar.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            return;
        }

        toggle.setAttribute('aria-expanded', sidebar.classList.contains('is-open') ? 'true' : 'false');
    }

    function routeUrl(path) {
        const base = state.baseUrl || '';
        return `${base}/${String(path || '').replace(/^\/+/, '')}`;
    }

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = value ?? '';
        }
    }

    function setInputValue(id, value) {
        const node = document.getElementById(id);
        if (node) {
            node.value = value ?? '';
        }
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

    function attendanceBadgeClass(status) {
        const normalized = String(status || '').toLowerCase();
        if (normalized === 'attended' || normalized === 'completed') return 'present';
        if (normalized === 'missed') return 'absent';
        if (normalized === 'notified') return 'late';
        return 'pending';
    }

    function buildPostApprovalNotice(task) {
        if (task.reviewerRemarks) {
            return `Reviewer remarks: ${task.reviewerRemarks}`;
        }
        if (task.status === 'Submitted') {
            return 'This form has been submitted and is awaiting review.';
        }
        if (task.status === 'Verified') {
            return 'This form has already been verified by CSWDD.';
        }
        if (task.staged) {
            return task.helpText || 'This task is staged for a later digital form pass.';
        }
        return task.helpText || 'Complete the required fields below, save progress anytime, then submit when ready.';
    }

    function setNestedValue(target, path, value) {
        const segments = path.split('.');
        let cursor = target;
        segments.forEach((segment, index) => {
            const isLast = index === segments.length - 1;
            const nextSegment = segments[index + 1];
            const isArrayIndex = /^\d+$/.test(segment);

            if (isLast) {
                if (isArrayIndex && Array.isArray(cursor)) {
                    cursor[Number(segment)] = value;
                } else {
                    cursor[segment] = value;
                }
                return;
            }

            const containerIsArray = /^\d+$/.test(nextSegment);
            if (isArrayIndex) {
                const numericIndex = Number(segment);
                if (!Array.isArray(cursor)) {
                    return;
                }
                if (cursor[numericIndex] == null) {
                    cursor[numericIndex] = containerIsArray ? [] : {};
                }
                cursor = cursor[numericIndex];
                return;
            }

            if (!(segment in cursor)) {
                cursor[segment] = containerIsArray ? [] : {};
            }
            cursor = cursor[segment];
        });
    }

    function structuredCloneSafe(value) {
        try {
            return JSON.parse(JSON.stringify(value ?? {}));
        } catch (error) {
            return {};
        }
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
})();

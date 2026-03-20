(function () {
    const FORCED_ROLE_VIEW = 'beneficiary';
    const STORAGE_KEYS = {
        user: 'smartleap_sample_user',
        payments: 'smartleap_sample_payments',
        feedback: 'smartleap_sample_feedback',
        users: 'smartleap_users_v2',
        session: 'smartleap_session_v1',
        applications: 'smartleap_admin_applications_v3',
        beneficiaries: 'smartleap_admin_beneficiaries_v3',
        notifications: 'smartleap_user_notifications_v1',
        certificate: 'smartleap_certificate_uploads_v1',
        profilePhotos: 'smartleap_profile_photos_v1'
    };

    const SAMPLE_USER = {
        name: 'Maria Lopez',
        email: 'maria.lopez@gmail.com',
        business: "Maria's Sari-sari Store",
        beneficiaryId: 101,
        role: 'Beneficiary',
        authenticatedAt: new Date().toISOString()
    };

    const BASE_PAYMENTS = [
        {
            month: '2025-01',
            paymentDate: '2025-01-12',
            amount: 625,
            stage: 'verified',
            verifiedBy: 'Admin L. Cruz',
            verifiedAt: '2025-01-18',
            notes: 'Hard copy received'
        },
        {
            month: '2025-02',
            paymentDate: '2025-02-15',
            amount: 625,
            stage: 'verified',
            verifiedBy: 'Project Officer D. Reyes',
            verifiedAt: '2025-02-20',
            notes: 'Barangay visit completed'
        },
        {
            month: '2025-03',
            paymentDate: '',
            amount: 625,
            stage: 'pending',
            verifiedBy: '',
            verifiedAt: '',
            notes: 'Awaiting upload'
        }
    ];

    let user = SAMPLE_USER;
    let payments = [];
    let feedbackEntries = [];
    let applicationRecord = null;
    let beneficiaryRecord = null;
    let notifications = [];
    let beneficiaryId = SAMPLE_USER.beneficiaryId || null;
    let roleView = 'beneficiary';
    let certificateUploads = {};
    let profilePhotos = {};
    let trainingState = null;
    let trainingUnsubscribe = null;
    let trainingPercent = 0;

    const REQUIREMENT_ITEMS = [
        { key: 'validId', label: 'Valid ID' },
        { key: 'healthCertificate', label: 'Health Certificate' },
        { key: 'cedula', label: 'Cedula' },
        { key: 'mungkahingProyekto', label: 'Project proposal' },
        { key: 'businessPlan', label: 'Business plan' },
        { key: 'individualProfile', label: 'Individual profile' },
        { key: 'availmentForm', label: 'Availment form' },
        { key: 'validationForm', label: 'Validation form' }
    ];

    const TRAINING_REQUIREMENT_MAP = [
        { match: 'sub-project identification', requirements: ['Project proposal', 'Individual profile'] },
        { match: 'project planning', requirements: ['Business plan', 'Validation form'] },
        { match: 'financial management', requirements: ['Business plan', 'Availment form'] },
        { match: 'accountability reporting', requirements: ['Validation form', 'Cedula'] },
        { match: 'project documentation', requirements: ['Valid ID', 'Cedula'] },
        { match: 'implementation preparation', requirements: ['Health Certificate', 'Availment form'] },
        { match: 'turnover', requirements: ['Certificate upload'] }
    ];

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        loadState();
        bindEvents();
        initTraining();
        renderAll();
        greetIfSample();
    }

    function loadState() {
        const sessionUser = getSessionUser();
        try {
            const storedUser = sessionStorage.getItem(STORAGE_KEYS.user);
            if (storedUser) user = JSON.parse(storedUser);
        } catch (err) {
            console.warn('Unable to read stored user', err);
        }
        if (sessionUser) {
            user = { ...user, ...sessionUser };
        }
        beneficiaryRecord = findBeneficiaryRecord(user);
        applicationRecord = findApplicationRecord(user, beneficiaryRecord);
        roleView = resolveRoleView(user, applicationRecord, beneficiaryRecord);
        roleView = FORCED_ROLE_VIEW;
        if (user) {
            user.role = roleView === 'beneficiary' ? 'Beneficiary' : 'Applicant';
        }
        beneficiaryId = Number(beneficiaryRecord?.id || user?.beneficiaryId || SAMPLE_USER.beneficiaryId || 0) || null;

        try {
            const storedPayments = localStorage.getItem(STORAGE_KEYS.payments);
            if (storedPayments) payments = JSON.parse(storedPayments) || [];
        } catch (err) {
            console.warn('Unable to read stored payments', err);
        }
        if (!Array.isArray(payments) || !payments.length) {
            payments = [...BASE_PAYMENTS];
        }

        try {
            const storedFeedback = localStorage.getItem(STORAGE_KEYS.feedback);
            if (storedFeedback) feedbackEntries = JSON.parse(storedFeedback) || [];
        } catch (err) {
            console.warn('Unable to read stored feedback', err);
        }
        if (!Array.isArray(feedbackEntries)) {
            feedbackEntries = [];
        }

        try {
            const storedNotifications = localStorage.getItem(STORAGE_KEYS.notifications);
            if (storedNotifications) notifications = JSON.parse(storedNotifications) || [];
        } catch (err) {
            console.warn('Unable to read stored notifications', err);
        }
        if (!Array.isArray(notifications)) {
            notifications = [];
        }

        try {
            const storedCertificates = localStorage.getItem(STORAGE_KEYS.certificate);
            if (storedCertificates) certificateUploads = JSON.parse(storedCertificates) || {};
        } catch (err) {
            console.warn('Unable to read certificate uploads', err);
        }
        if (!certificateUploads || typeof certificateUploads !== 'object') {
            certificateUploads = {};
        }

        try {
            const storedPhotos = localStorage.getItem(STORAGE_KEYS.profilePhotos);
            if (storedPhotos) profilePhotos = JSON.parse(storedPhotos) || {};
        } catch (err) {
            console.warn('Unable to read profile photos', err);
        }
        if (!profilePhotos || typeof profilePhotos !== 'object') {
            profilePhotos = {};
        }
    }

    function bindEvents() {
        document.getElementById('uploadForm')?.addEventListener('submit', handleUploadSubmit);
        document.getElementById('feedbackForm')?.addEventListener('submit', handleFeedbackSubmit);
        document.getElementById('profileForm')?.addEventListener('submit', handleProfileSubmit);
        document.getElementById('beneficiaryProfileForm')?.addEventListener('submit', handleBeneficiaryProfileSubmit);
        document.getElementById('profilePhotoInput')?.addEventListener('change', handleProfilePhotoChange);
        document.getElementById('certificateForm')?.addEventListener('submit', handleCertificateSubmit);
        document.getElementById('trainingViewCertificate')?.addEventListener('click', handleViewCertificate);
        document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            document.querySelector('.dash-sidebar')?.classList.toggle('is-open');
        });
        document.getElementById('historyFilterStatus')?.addEventListener('change', renderHistory);
        document.getElementById('historyFilterMonth')?.addEventListener('change', renderHistory);
        initTrainingTabs();
        document.getElementById('historyTableBody')?.addEventListener('click', handleHistoryTableClick);
        document.getElementById('overviewRepaymentsBtn')?.addEventListener('click', () => {
            window.location.hash = '#repayments';
            applyRouteVisibility();
        });

        document.querySelectorAll('.sidebar-link').forEach((link) => {
            link.addEventListener('click', (event) => {
                event.preventDefault();
                document.querySelectorAll('.sidebar-link').forEach((item) => item.classList.remove('is-active'));
                link.classList.add('is-active');
                const targetId = (link.getAttribute('href') || '').replace('#', '');
                if (targetId) {
                    window.location.hash = `#${targetId}`;
                    applyRouteVisibility();
                }
            });
        });

        initRouting();
    }

    function renderAll() {
        renderUser();
        applyRoleVisibility();
        renderSummary();
        renderOverview();
        renderTrainingPanels();
        renderRequirements();
        renderNotifications();
        renderCertificatePanel();
        renderProfileEditor();
        renderBeneficiaryProfile();
        if (roleView === 'beneficiary') {
            renderProgress();
            renderHistory();
            renderFeedback();
            renderAudit();
        }
    }

    function renderUser() {
        const name = user.name || SAMPLE_USER.name;
        const email = user.email || SAMPLE_USER.email;
        const business = user.businessName
            || user.business
            || applicationRecord?.businessName
            || applicationRecord?.profile?.businessName
            || beneficiaryRecord?.businessName
            || beneficiaryRecord?.businessType
            || applicationRecord?.businessType
            || user.barangay
            || user.location
            || (roleView === 'applicant' ? 'Applicant profile' : '')
            || SAMPLE_USER.business
            || 'Your livelihood';
        const firstName = (name || '').split(' ')[0] || name || 'Beneficiary';
        const avatarInitial = (name || 'B').trim().charAt(0)?.toUpperCase() || 'B';

        const headerIdentity = business ? `${name || firstName} - ${business}` : `Hello, ${name || firstName}!`;
        setText('bannerGreeting', headerIdentity);
        setText('userEmail', email);
        setText('sidebarUserName', name);
        setText('sidebarUserBusiness', business || 'Your livelihood');

        const bannerAvatar = document.getElementById('bannerAvatar');
        if (bannerAvatar) bannerAvatar.textContent = avatarInitial;
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        if (sidebarAvatar) sidebarAvatar.textContent = avatarInitial;
    }

    function renderSummary() {
        if (roleView === 'beneficiary') {
            const verifiedPayments = payments.filter((p) => p.stage === 'verified');
            const totalVerifiedAmount = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const outstanding = Math.max(15000 - totalVerifiedAmount, 0);
            const verifiedMonths = verifiedPayments.length;
            const repaymentRate = Math.round((verifiedMonths / 24) * 100);

            const nextPending = payments.find((p) => p.stage !== 'verified');
            const nextDue = nextPending ? formatMonth(padMonth(nextPending.month)) : 'Completed';
            const rateDisplay = Math.min(100, Math.max(0, repaymentRate));

            setText('bannerLabelOutstanding', 'Outstanding balance');
            setText('bannerLabelProgress', 'Repayment progress');
            setText('bannerLabelNextDue', 'Next due date');
            setText('bannerLabelRate', 'Repayment rate');
            setText('bannerOutstanding', formatCurrency(outstanding));
            setText('bannerProgress', `${verifiedMonths}/24 months`);
            setText('bannerNextDue', nextDue);
            setText('bannerRate', `${rateDisplay}%`);

            setText('supportNextDue', nextDue);
            setText('supportOutstanding', `Outstanding ${formatCurrency(outstanding)}`);
            setText('supportRate', `Completion ${rateDisplay}%`);
            return;
        }

        const requirementSummary = (!applicationRecord && !beneficiaryRecord)
            ? { completed: 0, total: 8, issueCount: 0 }
            : calculateRequirementSummary(applicationRecord, beneficiaryRecord);
        const completed = requirementSummary.completed;
        const total = requirementSummary.total || 8;
        const statusLabel = requirementSummary.issueCount > 0
            ? 'Action needed'
            : completed >= total
                ? 'Ready for approval'
                : 'Pending review';
        const nextSession = trainingState && window.TrainingShared ? TrainingShared.getUpcomingSession() : null;
        const nextSessionLabel = nextSession ? formatDate(nextSession.start) : 'No session yet';

        setText('bannerLabelOutstanding', 'Requirement status');
        setText('bannerLabelProgress', 'Training completion');
        setText('bannerLabelNextDue', 'Next session');
        setText('bannerLabelRate', 'Approval status');
        setText('bannerOutstanding', `${completed}/${total} submitted`);
        setText('bannerProgress', `${Math.round(trainingPercent)}% complete`);
        setText('bannerNextDue', nextSessionLabel);
        setText('bannerRate', statusLabel);
    }

    function renderProgress() {
        const verified = payments.filter((p) => p.stage === 'verified').length;
        const pending = payments.filter((p) => p.stage === 'pending').length;
        const uploaded = payments.filter((p) => p.stage === 'uploaded').length;
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const overdue = payments.filter((payment) => {
            if ((payment.stage || '').toLowerCase() === 'verified') return false;
            const monthDate = parseMonth(payment.month);
            return monthDate ? monthDate < startOfMonth : false;
        }).length;
        const percent = Math.round((verified / 24) * 100);

        const fill = document.getElementById('progressFill');
        if (fill) {
            fill.style.width = `${Math.min(100, percent)}%`;
            fill.parentElement?.setAttribute('aria-valuenow', String(percent));
        }
        setText('progressVerified', `${verified} months verified`);
        setText('progressPending', `${pending} pending verification`);
        setText('progressUploaded', `${uploaded} uploaded`);
        setText('progressOverdue', `${overdue} overdue`);
    }

    function renderHistory() {
        const tbody = document.getElementById('historyTableBody');
        const counter = document.getElementById('historyCounter');
        if (!tbody) return;

        const verifiedCount = payments.filter((p) => (p.stage || '').toLowerCase() === 'verified').length;
        const pendingCount = payments.filter((p) => (p.stage || '').toLowerCase() === 'pending').length;
        const uploadedCount = payments.filter((p) => (p.stage || '').toLowerCase() === 'uploaded').length;
        setText('historyVerifiedCount', formatCount(verifiedCount, 'receipt'));
        setText('historyPendingCount', formatCount(pendingCount, 'receipt'));
        setText('historyUploadedCount', formatCount(uploadedCount, 'receipt'));

        tbody.innerHTML = '';
        if (!payments.length) {
            tbody.innerHTML = '<tr class="empty"><td colspan="6">No receipts yet. Log your first OR to begin.</td></tr>';
            counter && (counter.textContent = '0 receipts');
            return;
        }

        const statusFilter = (document.getElementById('historyFilterStatus')?.value || '').toLowerCase();
        const monthFilter = document.getElementById('historyFilterMonth')?.value || '';
        const filtered = payments.filter((payment) => {
            const status = (payment.stage || '').toLowerCase();
            const statusMatch = !statusFilter || status.includes(statusFilter);
            const monthMatch = !monthFilter || (payment.month || '') === monthFilter;
            return statusMatch && monthMatch;
        });

        const sorted = filtered.slice().sort((a, b) => (b.month || '').localeCompare(a.month || ''));
        const rows = sorted
            .map((payment) => {
                const statusInfo = getPaymentStatus(payment);
                const proof = payment.proof || '';
                const proofAction = proof
                    ? `<button type="button" class="btn-outline small" data-action="view-proof" data-proof="${escapeHtml(proof)}">View file</button>`
                    : '<span class="muted">No file</span>';
                const remarks = payment.adminRemarks || payment.notes || '-';
                return `
                <tr>
                    <td>${formatMonth(padMonth(payment.month))}</td>
                    <td>${formatDate(payment.paymentDate)}</td>
                    <td>${formatCurrency(payment.amount)}</td>
                    <td><span class="status-badge ${statusInfo.className}">${statusInfo.label}</span></td>
                    <td>${proofAction}</td>
                    <td>${escapeHtml(remarks)}</td>
                </tr>`;
            })
            .join('');
        tbody.innerHTML = rows || '<tr class="empty"><td colspan="6">No receipts yet. Log your first OR to begin.</td></tr>';
        counter && (counter.textContent = `${filtered.length} ${filtered.length === 1 ? 'receipt' : 'receipts'}`);
    }

    function renderFeedback() {
        const list = document.getElementById('feedbackList');
        if (!list) return;
        list.innerHTML = '';
        if (!feedbackEntries.length) {
            list.innerHTML = '<li class="empty">No feedback submitted yet.</li>';
            return;
        }
        feedbackEntries.slice().reverse().forEach((entry) => {
            const item = document.createElement('li');
            item.innerHTML = `<div>${escapeHtml(entry.message)}</div><span>${formatDateTime(entry.timestamp)}</span>`;
            list.appendChild(item);
        });
    }

    function renderAudit() {
        const auditList = document.getElementById('auditList');
        if (!auditList) return;
        const auditEntries = buildAuditFromPayments(payments);
        auditList.innerHTML = '';
        if (!auditEntries.length) {
            auditList.innerHTML = '<li class="empty">No activity yet.</li>';
            return;
        }
        auditEntries.forEach((entry) => {
            const item = document.createElement('li');
            item.innerHTML = `<div>${entry.message}</div><span>${formatDateTime(entry.timestamp)}</span>`;
            auditList.appendChild(item);
        });
    }

    function applyRoleVisibility() {
        const isBeneficiary = roleView === 'beneficiary';
        document.querySelectorAll('[data-role="beneficiary"]').forEach((element) => {
            element.classList.toggle('is-hidden', !isBeneficiary);
        });
        document.querySelectorAll('[data-role="applicant"]').forEach((element) => {
            element.classList.toggle('is-hidden', isBeneficiary);
        });
        document.querySelectorAll('[data-role="applicant-extra"]').forEach((element) => {
            element.classList.add('is-hidden');
        });
        const status = beneficiaryRecord?.applicationStatus || beneficiaryRecord?.status || applicationRecord?.status || user?.status || '';
        const isReleased = isReleasedStatus(status);
        document.querySelectorAll('[data-access="released"]').forEach((element) => {
            element.classList.toggle('is-hidden', !isReleased);
        });

        const activeLink = document.querySelector('.sidebar-link.is-active');
        if (activeLink?.classList.contains('is-hidden')) {
            activeLink.classList.remove('is-active');
            const firstVisible = Array.from(document.querySelectorAll('.sidebar-link')).find((link) => !link.classList.contains('is-hidden'));
            firstVisible?.classList.add('is-active');
        }

        applyRouteVisibility();
    }


    function initRouting() {
        window.addEventListener('hashchange', applyRouteVisibility);
        applyRouteVisibility();
    }

    function applyRouteVisibility() {
        const sidebarLinks = Array.from(document.querySelectorAll('.sidebar-link'));
        const sections = Array.from(document.querySelectorAll('.dash-section'));
        const visibleLinks = sidebarLinks.filter((link) => !link.classList.contains('is-hidden'));
        const hashId = window.location.hash.replace('#', '');
        const targetLink = visibleLinks.find((link) => (link.getAttribute('href') || '').replace('#', '') === hashId);
        const fallbackLink = visibleLinks[0];
        const activeLink = targetLink || fallbackLink;
        const activeId = (activeLink?.getAttribute('href') || '').replace('#', '');
        const banner = document.querySelector('.dash-banner');

        sidebarLinks.forEach((link) => link.classList.toggle('is-active', link === activeLink));
        sections.forEach((section) => {
            const shouldShow = section.id === activeId && !section.classList.contains('is-hidden');
            section.classList.toggle('is-route-hidden', !shouldShow);
        });
        if (banner) {
            banner.classList.toggle('is-route-hidden', activeId !== 'overview');
        }

        if (activeLink && hashId !== activeId) {
            window.history.replaceState(null, '', `#${activeId}`);
        }
    }

    function renderOverview() {
        if (roleView === 'beneficiary') {
            const nameEl = document.getElementById('overviewName');
            const bizEl = document.getElementById('overviewBusiness');
            const emailEl = document.getElementById('overviewEmail');
            const outstandingEl = document.getElementById('overviewOutstanding');
            const progressEl = document.getElementById('overviewProgress');
            const dueEl = document.getElementById('overviewDue');
            const rateEl = document.getElementById('overviewRate');
            const reminderEl = document.getElementById('overviewReminder');
            const trainingAlertEl = document.getElementById('overviewTrainingAlert');
            const supportEl = document.getElementById('overviewSupport');
            if (!nameEl || !bizEl || !emailEl || !outstandingEl || !progressEl || !dueEl || !rateEl) return;

            const name = user.fullName || user.name || beneficiaryRecord?.name || SAMPLE_USER.name;
            const business = user.businessName || user.business || beneficiaryRecord?.businessName || beneficiaryRecord?.businessType || SAMPLE_USER.business;
            const email = user.email || beneficiaryRecord?.email || SAMPLE_USER.email;
            nameEl.textContent = name;
            bizEl.textContent = business;
            emailEl.textContent = email;

            const verifiedPayments = payments.filter((p) => p.stage === 'verified');
            const totalVerifiedAmount = verifiedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
            const outstanding = Math.max(15000 - totalVerifiedAmount, 0);
            const verifiedMonths = verifiedPayments.length;
            const repaymentRate = Math.round((verifiedMonths / 24) * 100);
            const nextPending = payments.find((p) => p.stage !== 'verified');
            const nextDue = nextPending ? formatMonth(padMonth(nextPending.month)) : 'Completed';

            outstandingEl.textContent = formatCurrency(outstanding);
            progressEl.textContent = `${verifiedMonths}/24 months`;
            dueEl.textContent = nextDue;
            rateEl.textContent = `${Math.min(100, Math.max(0, repaymentRate))}%`;

            if (reminderEl) {
                reminderEl.textContent = nextPending ? `Upload OR for ${formatMonth(padMonth(nextPending.month))}` : 'No pending OR uploads.';
            }
            if (trainingAlertEl) {
                const nextSession = trainingState && window.TrainingShared ? TrainingShared.getUpcomingSession() : null;
                trainingAlertEl.textContent = nextSession
                    ? `Session on ${formatDate(nextSession.start)} \u2013 Confirm attendance.`
                    : 'No upcoming training sessions.';
            }
            if (supportEl) supportEl.textContent = 'Need help? Contact your PDO.';
            return;
        }

        const statusEl = document.getElementById('overviewStatus');
        const statusNoteEl = document.getElementById('overviewStatusNote');
        const trainingEl = document.getElementById('overviewTrainingPercent');
        const trainingNoteEl = document.getElementById('overviewTrainingNote');
        const nextDueEl = document.getElementById('overviewNextDue');
        const nextDueNoteEl = document.getElementById('overviewNextDueNote');
        if (!statusEl || !trainingEl || !nextDueEl) return;

        const status = beneficiaryRecord?.applicationStatus || beneficiaryRecord?.status || applicationRecord?.status || user?.status || 'Active';
        statusEl.textContent = status;
        if (statusNoteEl) {
            statusNoteEl.textContent = 'Awaiting approval and release status.';
        }

        trainingEl.textContent = `${Math.round(trainingPercent)}%`;
        if (trainingNoteEl) {
            trainingNoteEl.textContent = trainingPercent >= 100
                ? 'Training complete. Upload your certificate.'
                : 'Stay updated on scheduled modules.';
        }

        const nextSession = trainingState && window.TrainingShared ? TrainingShared.getUpcomingSession() : null;
        nextDueEl.textContent = nextSession ? formatDate(nextSession.start) : 'No session yet';
        if (nextDueNoteEl) nextDueNoteEl.textContent = 'Check training schedules for updates.';
    }

    function renderProfileEditor() {
        const form = document.getElementById('profileForm');
        if (!form) return;
        const nameInput = document.getElementById('profileName');
        const emailInput = document.getElementById('profileEmail');
        const barangayInput = document.getElementById('profileBarangay');
        const contactInput = document.getElementById('profileContact');
        if (!nameInput || !emailInput || !barangayInput || !contactInput) return;

        const fullName = user.fullName || user.name || applicationRecord?.applicantName || beneficiaryRecord?.name || '';
        const email = user.email || applicationRecord?.email || beneficiaryRecord?.email || '';
        const barangay = user.barangay || applicationRecord?.barangay || beneficiaryRecord?.barangay || beneficiaryRecord?.location || '';
        const contact = user.contactNumber || user.contact || applicationRecord?.contactNumber || beneficiaryRecord?.contact || '';

        nameInput.value = fullName;
        emailInput.value = email;
        barangayInput.value = barangay;
        contactInput.value = contact;
    }

    function renderBeneficiaryProfile() {
        if (roleView !== 'beneficiary') return;
        const form = document.getElementById('beneficiaryProfileForm');
        if (!form) return;
        const nameInput = document.getElementById('beneficiaryName');
        const businessInput = document.getElementById('beneficiaryBusiness');
        const emailInput = document.getElementById('beneficiaryEmail');
        const contactInput = document.getElementById('beneficiaryContact');
        const barangayInput = document.getElementById('beneficiaryBarangay');
        const pdoName = document.getElementById('assignedPDOName');
        const pdoContact = document.getElementById('assignedPDOContact');
        if (!nameInput || !businessInput || !emailInput || !contactInput || !barangayInput) return;

        nameInput.value = user.fullName || user.name || beneficiaryRecord?.name || '';
        businessInput.value = user.businessName || user.business || beneficiaryRecord?.businessName || beneficiaryRecord?.businessType || '';
        emailInput.value = user.email || beneficiaryRecord?.email || '';
        contactInput.value = user.contactNumber || user.contact || beneficiaryRecord?.contact || '';
        barangayInput.value = user.barangay || beneficiaryRecord?.barangay || '';

        if (pdoName) pdoName.textContent = beneficiaryRecord?.pdoName || 'Project Officer';
        if (pdoContact) pdoContact.textContent = beneficiaryRecord?.pdoContact || 'projectofficer@smartleap.gov.ph';

        const emailKey = (user.email || '').toLowerCase();
        const photo = emailKey ? profilePhotos[emailKey] : null;
        setProfilePhotoPreview(photo);
    }

    function renderRequirements() {
        const list = document.getElementById('requirementsList');
        const countEl = document.getElementById('requirementsProgressCount');
        const statusEl = document.getElementById('requirementsProgressStatus');
        const fillEl = document.getElementById('requirementsProgressFill');
        const barEl = document.querySelector('.requirements-progress__bar');
        if (!list || !countEl || !statusEl || !fillEl || !barEl) return;

        if (!applicationRecord && !beneficiaryRecord) {
            countEl.textContent = '0/8 requirements';
            statusEl.textContent = 'Pending review';
            fillEl.style.width = '0%';
            barEl.setAttribute('aria-valuenow', '0');
            list.innerHTML = '<li class="empty">Requirement uploads will appear once reviewed.</li>';
            document.querySelectorAll('.requirements-progress__marker').forEach((marker) => {
                const value = Number(marker.dataset.value || 0);
                marker.style.left = `${Math.min(100, Math.max(0, (value / 8) * 100))}%`;
            });
            return;
        }

        const summary = calculateRequirementSummary(applicationRecord, beneficiaryRecord);
        const total = summary.total || 8;
        const completed = Math.min(summary.completed, total);
        const percent = total ? Math.round((completed / total) * 100) : 0;

        countEl.textContent = `${completed}/${total} requirements`;
        statusEl.textContent = summary.issueCount > 0
            ? 'Action needed'
            : completed >= total
                ? 'Ready for approval'
                : 'Pending review';
        fillEl.style.width = `${percent}%`;
        barEl.setAttribute('aria-valuenow', String(percent));

        list.innerHTML = '';
        if (!summary.items.length) {
            list.innerHTML = '<li class="empty">Requirement uploads will appear once reviewed.</li>';
            return;
        }
        summary.items.forEach((item) => {
            const entry = document.createElement('li');
            entry.innerHTML = `<span>${escapeHtml(item.label)}</span><span class="requirement-status ${item.statusClass}">${escapeHtml(item.statusLabel)}</span>`;
            list.appendChild(entry);
        });

        document.querySelectorAll('.requirements-progress__marker').forEach((marker) => {
            const value = Number(marker.dataset.value || 0);
            marker.style.left = `${Math.min(100, Math.max(0, (value / total) * 100))}%`;
        });
    }

    function renderNotifications() {
        const list = document.getElementById('notificationList');
        if (!list) return;
        const items = buildNotificationFeed();
        list.innerHTML = '';
        if (!items.length) {
            list.innerHTML = '<li class="empty">No notifications yet.</li>';
            return;
        }
        items.slice(0, 8).forEach((item) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <div class="notification-title">${escapeHtml(item.title)}</div>
                <div>${escapeHtml(item.message)}</div>
                <div class="notification-meta">${escapeHtml(item.meta)}</div>
            `;
            list.appendChild(li);
        });
    }

    function renderCertificatePanel() {
        const statusEl = document.getElementById('certificateStatus');
        const noteEl = document.getElementById('certificateNote');
        const fileInput = document.getElementById('certificateFile');
        const submitBtn = document.getElementById('certificateSubmit');
        if (!statusEl || !noteEl || !fileInput || !submitBtn) return;

        const key = (user.email || '').toLowerCase();
        const record = key ? certificateUploads[key] : null;
        const unlocked = trainingPercent >= 100 && (trainingState?.sessions?.length || 0) > 0;

        fileInput.disabled = !unlocked;
        submitBtn.disabled = !unlocked;

        if (record) {
            statusEl.textContent = `Uploaded: ${record.fileName || 'Certificate'}`;
            noteEl.textContent = `Last updated ${formatDateTime(record.uploadedAt)}`;
        } else if (unlocked) {
            statusEl.textContent = 'Ready for upload';
            noteEl.textContent = 'Upload your certificate of completion.';
        } else {
            statusEl.textContent = 'Not available';
            noteEl.textContent = 'Complete all training sessions to unlock certificate uploads.';
        }
    }

    function handleProfileSubmit(event) {
        event.preventDefault();
        const form = event.target;
        if (!form.reportValidity()) return;

        const name = form.fullName.value.trim();
        const email = form.email.value.trim().toLowerCase();
        const barangay = form.barangay.value.trim();
        const contact = form.contact.value.trim();

        user = {
            ...user,
            name,
            fullName: name,
            email,
            barangay,
            contactNumber: contact,
            contact
        };

        if (applicationRecord) {
            applicationRecord.applicantName = name;
            applicationRecord.email = email;
            applicationRecord.barangay = barangay;
            applicationRecord.contactNumber = contact;
        }
        if (beneficiaryRecord) {
            beneficiaryRecord.name = name;
            beneficiaryRecord.email = email;
            beneficiaryRecord.barangay = barangay;
            beneficiaryRecord.contact = contact;
        }

        persistProfileUpdate();
        renderUser();
        showToast('Profile updated.', 'success');
    }

    function handleBeneficiaryProfileSubmit(event) {
        event.preventDefault();
        const form = event.target;
        if (!form.reportValidity()) return;

        const previousEmail = (user.email || '').toLowerCase();
        const name = form.fullName.value.trim();
        const businessName = form.businessName.value.trim();
        const email = form.email.value.trim().toLowerCase();
        const contact = form.contact.value.trim();
        const barangay = form.barangay.value.trim();

        user = {
            ...user,
            name,
            fullName: name,
            businessName,
            email,
            barangay,
            contactNumber: contact,
            contact
        };

        if (beneficiaryRecord) {
            beneficiaryRecord.name = name;
            beneficiaryRecord.businessName = businessName;
            beneficiaryRecord.email = email;
            beneficiaryRecord.contact = contact;
            beneficiaryRecord.barangay = barangay;
        }

        if (applicationRecord) {
            applicationRecord.applicantName = name;
            applicationRecord.businessName = businessName;
            applicationRecord.email = email;
            applicationRecord.barangay = barangay;
            applicationRecord.contactNumber = contact;
        }

        persistProfileUpdate();
        if (previousEmail && previousEmail !== email && profilePhotos[previousEmail]) {
            profilePhotos[email] = profilePhotos[previousEmail];
            delete profilePhotos[previousEmail];
            persistProfilePhotos();
        }
        renderUser();
        renderOverview();
        renderBeneficiaryProfile();
        showToast('Profile updated.', 'success');
    }

    function handleProfilePhotoChange(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        const isValidType = ['image/jpeg', 'image/png'].includes(file.type);
        if (!isValidType) {
            showToast('Upload a JPG or PNG file only.', 'warning');
            event.target.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            showToast('Photo must be 2MB or less.', 'warning');
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            const emailKey = (user.email || '').toLowerCase();
            if (!emailKey) return;
            profilePhotos[emailKey] = reader.result;
            persistProfilePhotos();
            setProfilePhotoPreview(reader.result);
            showToast('Profile photo updated.', 'success');
        };
        reader.readAsDataURL(file);
    }

    function setProfilePhotoPreview(dataUrl) {
        const img = document.getElementById('profilePhotoPreview');
        const placeholder = document.getElementById('profilePhotoPlaceholder');
        if (!img || !placeholder) return;
        if (dataUrl) {
            img.src = dataUrl;
            img.classList.remove('is-hidden');
            placeholder.classList.add('is-hidden');
        } else {
            img.src = '';
            img.classList.add('is-hidden');
            placeholder.classList.remove('is-hidden');
        }
    }

    function handleCertificateSubmit(event) {
        event.preventDefault();
        const form = event.target;
        if (!form.reportValidity()) return;
        const file = document.getElementById('certificateFile')?.files?.[0];
        if (!file) return;

        const key = (user.email || '').toLowerCase();
        if (!key) return;
        certificateUploads[key] = {
            fileName: file.name,
            uploadedAt: new Date().toISOString()
        };
        persistCertificates();
        renderCertificatePanel();
        showToast('Certificate uploaded for review.', 'success');
        form.reset();
    }

    function handleUploadSubmit(event) {
        event.preventDefault();
        const form = event.target;
        if (!form.reportValidity()) return;

        const formData = new FormData(form);
        const month = String(formData.get('month') || '');
        const paymentDate = String(formData.get('paymentDate') || '');
        const amount = Number(formData.get('amount') || 0);
        const orNumber = String(formData.get('or') || '').trim();
        const notes = String(formData.get('notes') || '').trim();
        const file = formData.get('file');

        const newPayment = {
            month,
            paymentDate,
            amount,
            stage: 'uploaded',
            verifiedBy: '',
            verifiedAt: '',
            notes: notes || (file && file.name ? `Uploaded file: ${file.name}` : ''),
            orNumber
        };

        payments = payments.filter((p) => p.month !== month).concat([newPayment]);
        persistPayments();
        renderSummary();
        renderProgress();
        renderHistory();
        renderAudit();
        showToast('Receipt uploaded. Pending verification.', 'info');
        form.reset();
    }

    function handleFeedbackSubmit(event) {
        event.preventDefault();
        const form = event.target;
        if (!form.reportValidity()) return;
        const message = form.feedbackMessage.value.trim();
        if (!message) return;
        const entry = {
            message,
            timestamp: new Date().toISOString()
        };
        feedbackEntries.push(entry);
        persistFeedback();
        renderFeedback();
        showToast('Thanks! Feedback received.', 'success');
        form.reset();
    }

    function handleLogout() {
        sessionStorage.removeItem(STORAGE_KEYS.user);
        showToast('Signed out.', 'info');
        setTimeout(() => {
            window.location.href = 'portal';
        }, 600);
    }

    function handleHistoryTableClick(event) {
        const button = event.target.closest('button[data-action="view-proof"]');
        if (!button) return;
        const proof = button.getAttribute('data-proof') || '';
        if (!proof) return;
        const win = window.open('', '_blank', 'noopener');
        if (!win) return;
        if (proof.startsWith('data:') || proof.startsWith('http')) {
            win.location.href = proof;
            return;
        }
        win.document.write(`<pre>${escapeHtml(proof)}</pre>`);
    }

    function getSessionUser() {
        try {
            const sessionRaw = localStorage.getItem(STORAGE_KEYS.session);
            const session = sessionRaw ? JSON.parse(sessionRaw) : null;
            if (!session?.email) return null;
            const users = getStoredUsers();
            const match = users.find((entry) => (entry.email || '').toLowerCase() === session.email.toLowerCase());
            if (!match) return null;
            return {
                id: match.id,
                name: match.fullName || match.name || match.email,
                fullName: match.fullName || match.name || '',
                email: match.email,
                contactNumber: match.contactNumber || match.contact || '',
                businessName: match.businessName || '',
                role: match.role || session.role || 'Applicant'
            };
        } catch (err) {
            console.warn('Unable to resolve session user', err);
            return null;
        }
    }

    function getStoredUsers() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.users);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function findBeneficiaryRecord(currentUser) {
        if (!currentUser) return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.beneficiaries);
            const list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) return null;
            const email = (currentUser.email || '').toLowerCase();
            const id = currentUser.beneficiaryId || currentUser.id;
            return list.find((item) => (email && (item.email || '').toLowerCase() === email) || (id && String(item.id) === String(id))) || null;
        } catch {
            return null;
        }
    }

    function findApplicationRecord(currentUser, beneficiary) {
        if (!currentUser && !beneficiary) return null;
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.applications);
            const list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) return null;
            const email = (currentUser?.email || beneficiary?.email || '').toLowerCase();
            const id = beneficiary?.id || currentUser?.beneficiaryId;
            return list.find((item) => (email && (item.email || '').toLowerCase() === email) || (id && String(item.beneficiaryId) === String(id))) || null;
        } catch {
            return null;
        }
    }

    function resolveRoleView(currentUser, application, beneficiary) {
        const role = normalizeStatus(currentUser?.role || '');
        if (role.includes('beneficiary')) return 'beneficiary';
        if (role.includes('applicant')) return 'applicant';
        const status = normalizeStatus(
            beneficiary?.applicationStatus ||
            beneficiary?.status ||
            application?.status ||
            currentUser?.status ||
            currentUser?.role
        );
        if (!status) return 'applicant';
        if (status.includes('released') || status.includes('beneficiary') || status.includes('active') || status.includes('disbursed')) {
            return 'beneficiary';
        }
        return 'applicant';
    }

    function normalizeStatus(value) {
        return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    }

    function calculateRequirementSummary(application, beneficiary) {
        const requirements = application?.requirements || beneficiary?.requirements || {};
        const items = [];
        let completed = 0;
        let issueCount = 0;
        const total = REQUIREMENT_ITEMS.length;

        REQUIREMENT_ITEMS.forEach((req) => {
            const entry = requirements?.[req.key] || {};
            const files = Array.isArray(entry.files) ? entry.files : [];
            const status = normalizeStatus(entry.status || '');
            const hasFiles = files.length > 0;
            const isComplete = hasFiles && (status === 'verified' || status === 'approved' || status === 'complete');
            const isMissing = !hasFiles || status === 'missing';
            const isIssue = status === 'invalid' || status === 'incorrect' || status === 'rejected';

            let statusLabel = 'Uploaded';
            let statusClass = 'requirement-status--pending';
            if (isComplete) {
                statusLabel = 'Complete';
                statusClass = 'requirement-status--complete';
                completed += 1;
            } else if (isMissing) {
                statusLabel = 'Missing';
                statusClass = 'requirement-status--missing';
                issueCount += 1;
            } else if (isIssue) {
                statusLabel = 'Incorrect';
                statusClass = 'requirement-status--issue';
                issueCount += 1;
            }

            items.push({
                key: req.key,
                label: req.label,
                statusLabel,
                statusClass
            });
        });

        return {
            completed,
            total,
            issueCount,
            items
        };
    }

    function buildNotificationFeed() {
        const items = [];
        const status = applicationRecord?.status || beneficiaryRecord?.applicationStatus || beneficiaryRecord?.status || 'Pending';
        const statusMeta = applicationRecord?.reviewedAt || beneficiaryRecord?.releaseDate || '';
        items.push({
            title: 'Approval status',
            message: `Current status: ${status}`,
            meta: statusMeta ? formatDateTime(statusMeta) : 'Awaiting review'
        });

        const pdoMessage = applicationRecord?.pdoMessage || applicationRecord?.notes || beneficiaryRecord?.notes;
        if (pdoMessage) {
            items.push({
                title: 'PDO message',
                message: pdoMessage,
                meta: 'Project Development Officer'
            });
        }

        const nextSession = trainingState && window.TrainingShared ? TrainingShared.getUpcomingSession() : null;
        if (nextSession) {
            const windowCopy = TrainingShared.formatSessionWindow(nextSession);
            items.push({
                title: 'Training reminder',
                message: `${nextSession.title || nextSession.label || 'Training session'} - ${windowCopy.dateText} ${windowCopy.timeRange}`,
                meta: nextSession.venue || 'Venue to be confirmed'
            });
        }

        if (Array.isArray(notifications) && notifications.length) {
            notifications.forEach((entry) => {
                items.push({
                    title: entry.title || 'Update',
                    message: entry.message || '',
                    meta: entry.timestamp ? formatDateTime(entry.timestamp) : 'Just now'
                });
            });
        }

        return items;
    }

    function persistProfileUpdate() {
        try {
            sessionStorage.setItem(STORAGE_KEYS.user, JSON.stringify(user));
        } catch (err) {
            console.warn('Unable to persist session user', err);
        }

        try {
            const users = getStoredUsers();
            const index = users.findIndex((entry) => entry.id === user.id || (entry.email || '').toLowerCase() === (user.email || '').toLowerCase());
            if (index >= 0) {
                users[index] = {
                    ...users[index],
                    fullName: user.fullName || user.name,
                    email: user.email,
                    contactNumber: user.contactNumber,
                    businessName: user.businessName || user.business || users[index].businessName || '',
                    updatedAt: new Date().toISOString()
                };
                localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
            }
        } catch (err) {
            console.warn('Unable to update stored users', err);
        }

        try {
            const applications = JSON.parse(localStorage.getItem(STORAGE_KEYS.applications) || '[]');
            if (Array.isArray(applications)) {
                const match = applications.find((app) => app.id === applicationRecord?.id || (app.email || '').toLowerCase() === (user.email || '').toLowerCase());
                if (match) {
                    match.applicantName = user.fullName || user.name;
                    match.contactNumber = user.contactNumber || user.contact;
                    match.barangay = user.barangay;
                    if (user.businessName) {
                        match.businessName = user.businessName;
                    }
                    localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify(applications));
                }
            }
        } catch (err) {
            console.warn('Unable to update application profile', err);
        }

        try {
            const beneficiaries = JSON.parse(localStorage.getItem(STORAGE_KEYS.beneficiaries) || '[]');
            if (Array.isArray(beneficiaries)) {
                const match = beneficiaries.find((entry) => entry.id === beneficiaryRecord?.id || (entry.email || '').toLowerCase() === (user.email || '').toLowerCase());
                if (match) {
                    match.name = user.fullName || user.name;
                    match.contact = user.contactNumber || user.contact;
                    match.barangay = user.barangay;
                    if (user.businessName) {
                        match.businessName = user.businessName;
                    }
                    if (user.email) {
                        match.email = user.email;
                    }
                    localStorage.setItem(STORAGE_KEYS.beneficiaries, JSON.stringify(beneficiaries));
                }
            }
        } catch (err) {
            console.warn('Unable to update beneficiary profile', err);
        }

        try {
            localStorage.setItem('currentUser', JSON.stringify({
                role: user.role || 'Applicant',
                email: user.email,
                fullName: user.fullName || user.name
            }));
        } catch (err) {
            console.warn('Unable to update current user', err);
        }
    }

    function persistCertificates() {
        try {
            localStorage.setItem(STORAGE_KEYS.certificate, JSON.stringify(certificateUploads));
        } catch (err) {
            console.warn('Unable to persist certificate uploads', err);
        }
    }

    function persistProfilePhotos() {
        try {
            localStorage.setItem(STORAGE_KEYS.profilePhotos, JSON.stringify(profilePhotos));
        } catch (err) {
            console.warn('Unable to persist profile photos', err);
        }
    }

    function greetIfSample() {
        if (!user || user.email !== SAMPLE_USER.email) return;
        showToast('Signed in to sample SMART LEAP account.', 'info');
    }

    function persistPayments() {
        try {
            localStorage.setItem(STORAGE_KEYS.payments, JSON.stringify(payments));
        } catch (err) {
            console.warn('Unable to save payments', err);
        }
    }

    function persistFeedback() {
        try {
            localStorage.setItem(STORAGE_KEYS.feedback, JSON.stringify(feedbackEntries));
        } catch (err) {
            console.warn('Unable to save feedback', err);
        }
    }

    function buildAuditFromPayments(list) {
        const verifiedAudits = list
            .filter((p) => p.stage === 'verified')
            .map((p) => ({
                message: `${p.verifiedBy || 'Admin'} verified ${formatMonth(padMonth(p.month))} receipt (${formatCurrency(p.amount)}).`,
                timestamp: p.verifiedAt || new Date().toISOString()
            }));

        const uploadedAudits = list
            .filter((p) => p.stage === 'uploaded')
            .map((p) => ({
                message: `Uploaded OR ${p.orNumber || ''} for ${formatMonth(padMonth(p.month))}. Awaiting validation.`,
                timestamp: new Date().toISOString()
            }));

        return verifiedAudits.concat(uploadedAudits).slice(0, 12);
    }

    function getPaymentStatus(payment) {
        const stage = (payment.stage || '').toLowerCase();
        if (stage === 'verified') return { label: 'Verified', className: 'status-verified' };
        if (stage === 'uploaded') return { label: 'Pending', className: 'status-uploaded' };
        if (stage.includes('rejected') || stage.includes('flag')) return { label: 'Rejected', className: 'status-overdue' };
        if (stage === 'pending') {
            const due = parseMonth(payment.month);
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            if (due && due < startOfMonth) {
                return { label: 'Overdue', className: 'status-overdue' };
            }
            return { label: 'Pending', className: 'status-pending' };
        }
        return { label: 'Pending', className: 'status-pending' };
    }

    function mapAttendanceBadge(status) {
        const key = String(status || 'pending').toLowerCase();
        const map = {
            present: { label: 'Present', className: 'present' },
            absent: { label: 'Absent', className: 'absent' },
            late: { label: 'Late', className: 'late' },
            excused: { label: 'Late', className: 'late' },
            pending: { label: 'Pending', className: 'pending' }
        };
        return map[key] || map.pending;
    }

    function resolveAttendanceStatus(value) {
        if (!value) return 'pending';
        if (typeof value === 'string') return value;
        return value.status || value.state || 'pending';
    }

    function formatVerification(payment) {
        if (payment.stage === 'verified') {
            const dateText = formatDate(payment.verifiedAt);
            return `${payment.verifiedBy || 'Admin'}${dateText ? ` - ${dateText}` : ''}${payment.notes ? ` - ${escapeHtml(payment.notes)}` : ''}`;
        }
        if (payment.stage === 'uploaded') {
            return payment.notes ? escapeHtml(payment.notes) : 'Uploaded. Bring hard copy for verification.';
        }
        return 'For upload';
    }

    function initTraining() {
        const overviewSection = document.querySelector('.training-overview');

        if (!window.TrainingShared || !window.TrainingComponents) {
            overviewSection?.classList.add('is-hidden');
            return;
        }

        trainingUnsubscribe = TrainingShared.onChange((snapshot) => {
            trainingState = snapshot;
            renderTrainingPanels();
            renderSummary();
            renderOverview();
            renderNotifications();
            renderCertificatePanel();
        });

        trainingState = TrainingShared.getSnapshot ? TrainingShared.getSnapshot() : trainingState;

        window.addEventListener('beforeunload', () => {
            try { trainingUnsubscribe?.(); } catch (err) { console.warn(err); }
        });
    }

    function renderTrainingPanels() {
        if (!trainingState || !window.TrainingComponents) return;
        renderTrainingOverview();
        renderTrainingSchedule();
        renderTrainingAttendance();
        renderTrainingChecklist();
        updateTrainingCompletionUI();
    }

    function renderTrainingOverview() {
        const ring = document.getElementById('trainingRing');
        const percentEl = document.getElementById('trainingPercent');
        const noteEl = document.getElementById('trainingSummaryNote');
        const completedEl = document.getElementById('trainingCompletedCount');
        const pendingEl = document.getElementById('trainingPendingCount');
        const absenceEl = document.getElementById('trainingAbsenceCount');
        const excusedEl = document.getElementById('trainingExcusedCount');
        const nextCard = document.getElementById('trainingNextCard');
        const nextTitleEl = document.getElementById('trainingNextTitle');
        const nextMetaEl = document.getElementById('trainingNextMeta');
        if (!ring || !percentEl || !noteEl || !completedEl || !pendingEl || !absenceEl || !excusedEl || !nextCard || !nextTitleEl || !nextMetaEl) {
            return;
        }

        const progress = beneficiaryId ? TrainingShared.getBeneficiaryProgress(beneficiaryId) : { sessionCount: trainingState.sessions?.length || 0 };
        const totalSessions = progress.sessionCount || (trainingState.sessions?.length ?? 0);
        const completed = progress.present || 0;
        const absences = progress.absent || 0;
        const excused = progress.excused || 0;
        const pending = progress.pending != null ? progress.pending : Math.max(totalSessions - completed - absences - excused, 0);
        const percent = totalSessions ? Math.round((completed / totalSessions) * 100) : 0;
        trainingPercent = percent;

        percentEl.textContent = `${percent}%`;
        ring.style.setProperty('--progress', `${Math.min(100, percent) * 3.6}deg`);
        const progressFill = document.getElementById('trainingProgressFill');
        if (progressFill) progressFill.style.width = `${Math.min(100, percent)}%`;
        setText('trainingProgressMeta', `${percent}% attendance completion`);
        setText('trainingStreakBadge', `Streak: ${computeAttendanceStreak()} sessions`);

        setText('trainingCompletedCount', formatCount(completed, 'module'));
        setText('trainingPendingCount', formatCount(pending, 'upcoming module', 'upcoming modules'));
        setText('trainingAbsenceCount', formatCount(absences, 'absence'));
        setText('trainingExcusedCount', formatCount(excused, 'excused absence'));

        setText('attendancePresentCount', String(completed));
        setText('attendancePendingCount', String(pending));
        setText('attendanceAbsentCount', String(absences));
        setText('attendanceLateCount', String(excused));

        if (!totalSessions) {
            noteEl.textContent = 'Training assignments will appear here once scheduled.';
        } else if (percent >= 100) {
            noteEl.textContent = 'All training modules complete. Await certification updates from your officer.';
        } else if (pending > 0) {
            noteEl.textContent = `You have ${formatCount(pending, 'module')} left to attend.`;
        } else {
            noteEl.textContent = 'Great job maintaining your attendance. Keep reviewing your modules.';
        }

        const nextSession = TrainingShared.getUpcomingSession();
        if (!nextSession) {
            nextCard.classList.add('is-empty');
            setText('trainingNextTitle', 'No upcoming session scheduled');
            setText('trainingNextMeta', '');
        } else {
            nextCard.classList.remove('is-empty');
            const windowCopy = TrainingShared.formatSessionWindow(nextSession);
            const parts = [
                windowCopy?.dateText || formatDate(nextSession.start),
                windowCopy?.timeRange || '',
                nextSession.venue || '',
                nextSession.facilitator ? `Facilitator: ${nextSession.facilitator}` : ''
            ].filter(Boolean);
            setText('trainingNextTitle', nextSession.title || nextSession.label || 'Training session');
            setText('trainingNextMeta', parts.join(' | '));
        }
    }

    function renderTrainingSchedule() {
        const grid = document.getElementById('trainingScheduleGrid');
        if (!grid) return;
        const sessions = trainingState.sessions || [];
        grid.innerHTML = TrainingComponents.buildScheduleGrid(sessions, {
            emptyCopy: 'Training schedule will appear here once assigned.'
        });
    }

    function renderTrainingAttendance() {
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;
        const sessions = trainingState.sessions || [];
        const attendanceMap = beneficiaryId ? TrainingShared.getAttendanceMap(beneficiaryId) : {};
        tbody.innerHTML = buildAttendanceRows(sessions, attendanceMap);
    }

    function buildAttendanceRows(sessions, attendanceMap) {
        if (!sessions.length) {
            return '<tr class="empty"><td colspan="5">Attendance updates will appear once sessions begin.</td></tr>';
        }
        return sessions.map((session) => {
            const statusValue = resolveAttendanceStatus(attendanceMap?.[session.id]);
            const badge = mapAttendanceBadge(statusValue);
            const windowCopy = TrainingShared?.formatSessionWindow
                ? TrainingShared.formatSessionWindow(session)
                : { dateText: formatDate(session.start), timeRange: '' };
            const remarks = session.remarks || session.focus || '-';
            const proofLink = statusValue === 'present' ? '<span class="muted">No file</span>' : '<span class="muted">--</span>';
            return `
                <tr>
                    <td>
                        <div class="table-primary">${escapeHtml(session.title || session.label || 'Training session')}</div>
                        <div class="table-secondary">${escapeHtml(session.facilitator || 'Facilitator TBA')}</div>
                    </td>
                    <td>
                        <div>${escapeHtml(windowCopy.dateText || '--')}</div>
                        <small class="table-secondary">${escapeHtml(windowCopy.timeRange || '')}</small>
                    </td>
                    <td><span class="badge-status ${badge.className}">${badge.label}</span></td>
                    <td>${escapeHtml(remarks)}</td>
                    <td>${proofLink}</td>
                </tr>
            `;
        }).join('');
    }

    function renderTrainingChecklist() {
        const list = document.getElementById('trainingChecklist');
        if (!list) return;
        const sessions = trainingState.sessions || [];
        list.innerHTML = '';
        if (!sessions.length) {
            list.innerHTML = '<li class="empty">Training checklist will appear once sessions are scheduled.</li>';
            return;
        }

        sessions.forEach((session) => {
            const label = session.title || session.label || 'Training session';
            const requirements = resolveTrainingRequirements(label);
            const item = document.createElement('li');
            item.innerHTML = `<span>${escapeHtml(label)}</span><span>${escapeHtml(requirements.join(', '))}</span>`;
            list.appendChild(item);
        });
    }

    function updateTrainingCompletionUI() {
        const completedCard = document.getElementById('trainingCompletedCard');
        const tabs = document.getElementById('trainingTabs');
        const dashboard = document.querySelector('.training-dashboard');
        const progressTrack = document.querySelector('.training-progress-track');
        const progressMeta = document.getElementById('trainingProgressMeta');
        const streak = document.getElementById('trainingStreakBadge');
        const checklist = document.querySelector('.training-checklist');
        const panels = Array.from(document.querySelectorAll('.training-panel'));
        if (!completedCard) return;

        const sessions = trainingState?.sessions || [];
        const progress = beneficiaryId ? TrainingShared.getBeneficiaryProgress(beneficiaryId) : { sessionCount: sessions.length };
        const totalSessions = progress.sessionCount || sessions.length;
        const completed = progress.present || 0;
        const percent = totalSessions ? Math.round((completed / totalSessions) * 100) : 0;
        const isComplete = totalSessions > 0 && percent >= 100;

        completedCard.classList.toggle('is-hidden', !isComplete);
        tabs?.classList.toggle('is-hidden', isComplete);
        dashboard?.classList.toggle('is-hidden', isComplete);
        progressTrack?.classList.toggle('is-hidden', isComplete);
        progressMeta?.classList.toggle('is-hidden', isComplete);
        streak?.classList.toggle('is-hidden', isComplete);
        checklist?.classList.toggle('is-hidden', isComplete);
        panels.forEach((panel) => panel.classList.toggle('is-hidden', isComplete));

        if (isComplete) {
            const completedMeta = document.getElementById('trainingCompletedMeta');
            const attendanceMeta = document.getElementById('trainingCompletedAttendance');
            const certificateMeta = document.getElementById('trainingCertificateIssued');
            const viewBtn = document.getElementById('trainingViewCertificate');
            const key = (user.email || '').toLowerCase();
            const record = key ? certificateUploads[key] : null;
            if (completedMeta) completedMeta.textContent = `${totalSessions} modules completed`;
            if (attendanceMeta) attendanceMeta.textContent = 'Attendance: 100%';
            if (certificateMeta) {
                certificateMeta.textContent = record?.uploadedAt
                    ? `Certificate issued on ${formatDate(record.uploadedAt)}`
                    : 'Certificate pending upload';
            }
            if (viewBtn) viewBtn.disabled = !record;
        }
    }

    function handleViewCertificate() {
        const key = (user.email || '').toLowerCase();
        const record = key ? certificateUploads[key] : null;
        if (!record) {
            showToast('No certificate on file yet.', 'info');
            return;
        }
        showToast(`Certificate ready: ${record.fileName || 'Certificate'}`, 'success');
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function showToast(message, tone = 'info') {
        const stack = document.getElementById('toastStack');
        if (!stack) return;
        const toast = document.createElement('div');
        toast.className = `toast ${tone}`;
        toast.textContent = message;
        stack.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('fade');
            toast.style.opacity = '0';
        }, 2800);
        setTimeout(() => {
            toast.remove();
        }, 3600);
    }

    function setProgressBar(id, percent) {
        const bar = document.getElementById(id);
        if (bar) {
            const safe = Math.max(0, Math.min(100, Math.round(percent)));
            bar.style.width = `${safe}%`;
        }
    }

    function formatCount(count, singular, plural) {
        const value = Number(count) || 0;
        const label = value === 1 ? (singular || '') : (plural || `${singular || ''}s`);
        return `${value} ${label}`.trim();
    }

    function formatCurrency(value) {
        const amount = Number(value || 0);
        return `\u20B1${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }

    function formatDate(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function formatMonth(value) {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    }

    function padMonth(monthText) {
        if (!monthText) return '';
        const [year, month] = monthText.split('-');
        if (!year || !month) return monthText;
        return `${year}-${month.padStart(2, '0')}-01`;
    }

    function parseMonth(monthText) {
        if (!monthText) return null;
        const date = new Date(padMonth(monthText));
        if (Number.isNaN(date.getTime())) return null;
        return date;
    }

    function initTrainingTabs() {
        const tabs = Array.from(document.querySelectorAll('.training-tab'));
        const panels = Array.from(document.querySelectorAll('.training-panel'));
        if (!tabs.length || !panels.length) return;

        const setActive = (target) => {
            const tabName = target?.dataset?.trainingTab;
            if (!tabName) return;
            tabs.forEach((tab) => {
                const isActive = tab.dataset.trainingTab === tabName;
                tab.classList.toggle('is-active', isActive);
                tab.setAttribute('aria-selected', String(isActive));
            });
            panels.forEach((panel) => {
                panel.classList.toggle('is-active', panel.dataset.trainingPanel === tabName);
            });
        };

        tabs.forEach((tab) => {
            tab.addEventListener('click', () => setActive(tab));
        });

        setActive(tabs[0]);
    }

    function computeAttendanceStreak() {
        const sessions = trainingState?.sessions || [];
        if (!sessions.length || !beneficiaryId) return 0;
        const attendanceMap = TrainingShared.getAttendanceMap(beneficiaryId) || {};
        const sorted = sessions.slice().sort((a, b) => {
            const aTime = new Date(a.start || 0).getTime();
            const bTime = new Date(b.start || 0).getTime();
            return bTime - aTime;
        });
        let streak = 0;
        for (const session of sorted) {
            const status = resolveAttendanceStatus(attendanceMap[session.id]);
            if (String(status).toLowerCase() === 'present') {
                streak += 1;
            } else {
                break;
            }
        }
        return streak;
    }

    function resolveTrainingRequirements(label) {
        const normalized = String(label || '').toLowerCase();
        const match = TRAINING_REQUIREMENT_MAP.find((entry) => normalized.includes(entry.match));
        if (match) return match.requirements;
        return ['Attendance sheet', 'Certificate upload'];
    }

    function isReleasedStatus(status) {
        const normalized = normalizeStatus(status);
        return normalized.includes('released') || normalized.includes('beneficiary');
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = value ?? '';
        return div.innerHTML;
    }
})();


















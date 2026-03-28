(function () {
    const AUTH_USER = window.SMARTLEAP_AUTH_USER || null;
    const STORAGE_KEYS = {
        payments: 'smartleap_beneficiary_payments_v1',
        feedback: 'smartleap_beneficiary_feedback_v1',
        notifications: 'smartleap_user_notifications_v1',
        profilePhotos: 'smartleap_profile_photos_v1'
    };
    const PORTAL_LOADER_MIN_MS = 3000;

    let user = {
        id: AUTH_USER?.id || null,
        name: AUTH_USER?.name || '',
        fullName: AUTH_USER?.name || '',
        email: AUTH_USER?.email || '',
        role: AUTH_USER?.role || 'Beneficiary'
    };
    let payments = [];
    let feedbackEntries = [];
    let applicationRecord = null;
    let beneficiaryRecord = null;
    let notifications = [];
    let beneficiaryId = Number(AUTH_USER?.id || 0) || null;
    let roleView = 'beneficiary';
    let profilePhotos = {};
    let loaderStartedAt = Date.now();

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

    document.addEventListener('DOMContentLoaded', init);

    function init() {
        loadState();
        bindEvents();
        renderAll();
        markPortalReady();
    }

    function loadState() {
        user = {
            ...user,
            id: AUTH_USER?.id || user.id || null,
            name: AUTH_USER?.name || user.name || '',
            fullName: AUTH_USER?.name || user.fullName || user.name || '',
            email: AUTH_USER?.email || user.email || '',
            role: AUTH_USER?.role || user.role || 'Beneficiary'
        };
        beneficiaryRecord = null;
        applicationRecord = null;
        roleView = 'beneficiary';
        beneficiaryId = Number(user?.id || 0) || null;

        try {
            const storedPayments = localStorage.getItem(STORAGE_KEYS.payments);
            if (storedPayments) payments = JSON.parse(storedPayments) || [];
        } catch (err) {
            console.warn('Unable to read stored payments', err);
        }
        if (!Array.isArray(payments)) {
            payments = [];
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
        document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
        document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebarMenu);
        document.getElementById('sidebarClose')?.addEventListener('click', closeSidebarMenuOnMobile);
        document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebarMenuOnMobile);
        document.getElementById('historyFilterStatus')?.addEventListener('change', renderHistory);
        document.getElementById('historyFilterMonth')?.addEventListener('change', renderHistory);
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

    function toggleSidebarMenu() {
        const sidebar = document.querySelector('.dash-sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const toggle = document.getElementById('sidebarToggle');
        if (!sidebar) return;

        const isOpen = !sidebar.classList.contains('is-open');
        sidebar.classList.toggle('is-open', isOpen);
        overlay?.classList.toggle('is-visible', isOpen);
        toggle?.setAttribute('aria-expanded', String(isOpen));
    }

    function closeSidebarMenuOnMobile() {
        const sidebar = document.querySelector('.dash-sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        const toggle = document.getElementById('sidebarToggle');
        sidebar?.classList.remove('is-open');
        overlay?.classList.remove('is-visible');
        toggle?.setAttribute('aria-expanded', 'false');
    }

    function renderAll() {
        renderUser();
        applyRoleVisibility();
        renderSummary();
        renderOverview();
        renderRequirements();
        renderNotifications();
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
        const name = user.fullName || user.name || 'Beneficiary';
        const email = user.email || '--';
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
        setText('bannerLabelOutstanding', 'Requirement status');
        setText('bannerLabelProgress', 'Requirements progress');
        setText('bannerLabelNextDue', 'Current stage');
        setText('bannerLabelRate', 'Approval status');
        setText('bannerOutstanding', `${completed}/${total} submitted`);
        setText('bannerProgress', `${completed}/${total} complete`);
        setText('bannerNextDue', statusLabel);
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
        const sections = Array.from(document.querySelectorAll('.dash-main > section[id]'));
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
            const accountAlertEl = document.getElementById('overviewAccountAlert');
            const supportEl = document.getElementById('overviewSupport');
            if (!nameEl || !bizEl || !emailEl || !outstandingEl || !progressEl || !dueEl || !rateEl) return;

            const name = user.fullName || user.name || beneficiaryRecord?.name || 'Beneficiary';
            const business = user.businessName || user.business || beneficiaryRecord?.businessName || beneficiaryRecord?.businessType || 'Your livelihood';
            const email = user.email || beneficiaryRecord?.email || '--';
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
            if (accountAlertEl) {
                accountAlertEl.textContent = payments.some((payment) => payment.stage === 'pending' || payment.stage === 'uploaded')
                    ? 'Receipt verification updates will appear here.'
                    : 'Account updates will appear here.';
            }
            if (supportEl) supportEl.textContent = 'Need help? Contact your PDO.';
            return;
        }

        const statusEl = document.getElementById('overviewStatus');
        const statusNoteEl = document.getElementById('overviewStatusNote');
        const requirementsEl = document.getElementById('overviewRequirementsPercent');
        const requirementsNoteEl = document.getElementById('overviewRequirementsNote');
        const nextDueEl = document.getElementById('overviewNextDue');
        const nextDueNoteEl = document.getElementById('overviewNextDueNote');
        if (!statusEl || !requirementsEl || !nextDueEl) return;

        const status = beneficiaryRecord?.applicationStatus || beneficiaryRecord?.status || applicationRecord?.status || user?.status || 'Active';
        const summary = calculateRequirementSummary(applicationRecord, beneficiaryRecord);
        statusEl.textContent = status;
        if (statusNoteEl) {
            statusNoteEl.textContent = 'Awaiting approval and release status.';
        }

        requirementsEl.textContent = `${summary.completed}/${summary.total || 8}`;
        if (requirementsNoteEl) {
            requirementsNoteEl.textContent = summary.issueCount > 0
                ? 'Some requirements still need correction.'
                : 'Continue submitting complete requirements.';
        }

        nextDueEl.textContent = status;
        if (nextDueNoteEl) nextDueNoteEl.textContent = 'Review the application and notifications pages for updates.';
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

    function showPortalLoader(copy) {
        const loader = document.getElementById('portalLoader');
        const copyNode = document.getElementById('portalLoaderCopy');
        if (!loader) {
            return;
        }

        if (copyNode && copy) {
            copyNode.textContent = copy;
        }

        loaderStartedAt = Date.now();
        loader.hidden = false;
        document.body.classList.remove('portal-ready');
    }

    function hidePortalLoader() {
        const loader = document.getElementById('portalLoader');
        if (!loader) {
            document.body.classList.add('portal-ready');
            return;
        }

        loader.setAttribute('hidden', 'hidden');
        document.body.classList.add('portal-ready');
    }

    function markPortalReady() {
        const remaining = Math.max(0, PORTAL_LOADER_MIN_MS - (Date.now() - loaderStartedAt));
        window.setTimeout(hidePortalLoader, remaining);
    }

    async function handleLogout() {
        showPortalLoader('Signing you out of SMART LEAP...');
        try {
            const response = await fetch(`${window.SMARTLEAP_BASE_URL || ''}/auth/logout`, {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                credentials: 'same-origin',
            });
            const payload = await response.json().catch(() => ({}));
            const remaining = Math.max(0, PORTAL_LOADER_MIN_MS - (Date.now() - loaderStartedAt));
            window.setTimeout(() => {
                window.location.href = `${window.SMARTLEAP_BASE_URL || ''}/${String(payload.redirect || 'portal').replace(/^\/+/, '')}`;
            }, remaining);
        } catch (error) {
            hidePortalLoader();
            showToast('Unable to log out right now.', 'warning');
        }
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

        const nextPendingPayment = payments.find((payment) => payment.stage !== 'verified');
        if (nextPendingPayment) {
            items.push({
                title: 'Repayment reminder',
                message: `Prepare the OR for ${formatMonth(padMonth(nextPendingPayment.month))}.`,
                meta: 'Upload your receipt once payment is made'
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
        renderUser();
        renderOverview();
    }

    function persistProfilePhotos() {
        try {
            localStorage.setItem(STORAGE_KEYS.profilePhotos, JSON.stringify(profilePhotos));
        } catch (err) {
            console.warn('Unable to persist profile photos', err);
        }
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
            excused: { label: 'Excused', className: 'excused' },
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


















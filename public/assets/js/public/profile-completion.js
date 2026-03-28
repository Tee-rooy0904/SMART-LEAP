(function () {
    const REQUIRED_FILES = [
        { key: 'validId', label: 'Valid ID' },
        { key: 'healthCertificate', label: 'Health Certificate' },
        { key: 'cedula', label: 'Cedula' }
    ];

    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
    const form = document.getElementById('profileCompletionForm');

    if (!form) return;

    let currentUser = null;
    let currentState = null;
    let docState = {};
    let boundPreviewEvents = false;
    let activePreviewUrl = null;
    let activePreviewKey = null;
    let formLocked = false;

    document.addEventListener('DOMContentLoaded', () => {
        init().catch((error) => {
            console.error('Profile completion init failed', error);
            showNotices('Unable to load your profile right now.', true);
        });
    });

    function publicBase() {
        const match = window.location.pathname.match(/^(.*\/public)(?:\/.*)?$/);
        return match ? match[1] : '';
    }

    function routeUrl(path) {
        const trimmed = String(path || '').replace(/^\/+/, '');
        return `${publicBase()}/${trimmed}`;
    }

    function isDashboardEmbedded() {
        return Boolean(document.querySelector('.dashboard-shell') || document.getElementById('dashboard-home'));
    }

    async function init() {
        initDocState();
        bindEvents();

        const state = await fetchState();
        currentState = state;
        currentUser = state.user;

        hydrateHeader();
        hydrateExistingApplication(state);
        syncAgeFromBirthdate();
        renderStatusBar(state.application);
        renderDocs();
        updateDocsCounter();
        renderReview();
        checkStatusAndRoute();
        updateSubmitState();
        dispatchDashboardProfileState();
    }

    async function fetchState() {
        const response = await fetch(routeUrl('profile-completion/state'), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin'
        });
        const payload = await response.json();

        if (response.status === 401) {
            window.location.href = routeUrl('portal');
            throw new Error('Unauthenticated.');
        }

        if (!response.ok || !payload.ok) {
            throw new Error(payload.message || 'Unable to load profile state.');
        }

        return payload.data;
    }

    function initDocState() {
        docState = REQUIRED_FILES.reduce((acc, doc) => {
            acc[doc.key] = {
                status: 'Not uploaded',
                file: null,
                fileObj: null,
                error: ''
            };
            return acc;
        }, {});
    }

    function bindEvents() {
        document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
        document.getElementById('saveProfileChangesButton')?.addEventListener('click', () => persistProfile(false, 'profile'));
        document.getElementById('saveDraftButton')?.addEventListener('click', () => persistProfile(false, 'application'));
        document.getElementById('submitProfileButton')?.addEventListener('click', handleSubmitClick);
        document.getElementById('profileBirthdate')?.addEventListener('change', handleBirthdateChange);

        form.addEventListener('submit', (event) => {
            event.preventDefault();
        });

        form.addEventListener('input', (event) => {
            if (!event.target.matches('input, select')) {
                return;
            }

            validateField(event.target);
            renderReview();
            updateSubmitState();
        });

        bindPreviewEventsOnce();
    }

    function hydrateHeader() {
        const name = currentUser?.name || 'Applicant';
        const email = currentUser?.email || '--';
        setText('profilePageName', name);
        setText('profilePageEmail', email);
    }

    function hydrateExistingApplication(state) {
        const profile = state.profile;
        if (profile) {
            setValue('profileBirthdate', profile.birthdate);
            setValue('profileAge', profile.age);
            setValue('profileGender', profile.gender);
            setValue('profileContactNumber', profile.contactNumber);
            setValue('profileAddress', profile.address);
            setValue('profileBarangay', profile.barangay);
            setValue('profile4ps', profile.is4ps);
            setValue('profileHouseholdSize', profile.householdSize);
            setValue('profileSector', profile.sector);
            setValue('profileLivelihood', profile.livelihood);
            setValue('profileBusinessName', profile.businessName);
        }

        REQUIRED_FILES.forEach((doc) => {
            const entry = state.requirements?.[doc.key];
            if (entry?.file) {
                docState[doc.key] = {
                    status: entry.status || 'Uploaded',
                    file: entry.file,
                    fileObj: null,
                    error: ''
                };
            }
        });
    }

    function syncAgeFromBirthdate() {
        const birthdate = getValue('profileBirthdate');
        const ageValue = getValue('profileAge');
        if (!birthdate || ageValue) return;
        const computedAge = calculateAge(birthdate);
        if (computedAge !== '') {
            setValue('profileAge', String(computedAge));
        }
    }

    function handleBirthdateChange(event) {
        const age = calculateAge(event.target.value);
        const ageInput = document.getElementById('profileAge');
        if (ageInput) {
            ageInput.value = age ? String(age) : '';
        }
        validateField(ageInput);
        renderReview();
        updateSubmitState();
    }

    function calculateAge(dateString) {
        if (!dateString) return '';
        const birth = new Date(dateString);
        if (Number.isNaN(birth.getTime())) return '';

        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age -= 1;
        }
        return age;
    }

    function validateField(field) {
        if (!field) return true;
        const errorEl = document.querySelector(`[data-error-for="${field.id}"]`);
        if (!errorEl) return true;

        if (field.required && !field.value) {
            errorEl.textContent = 'This field is required.';
            return false;
        }

        errorEl.textContent = '';
        return true;
    }

    function renderDocs() {
        const grid = document.getElementById('docGrid');
        if (!grid) return;

        grid.innerHTML = '';
        REQUIRED_FILES.forEach((doc) => {
            const entry = docState[doc.key];
            const isUploaded = Boolean(entry?.file);
            const previewDisabled = !entry?.fileObj;
            const tile = document.createElement('div');
            tile.className = 'doc-tile';
            tile.dataset.docKey = doc.key;
            tile.innerHTML = `
                <div class="doc-header">
                    <strong>${doc.label}</strong>
                    <span class="doc-status ${isUploaded ? 'is-uploaded' : ''}">${isUploaded ? 'Uploaded' : 'Not uploaded'}</span>
                </div>
                <div class="doc-meta">${isUploaded ? formatFileMeta(entry.file) : 'No file selected.'}</div>
                <small data-error-for="file-${doc.key}">${entry?.error || ''}</small>
                <div class="doc-actions">
                    <button type="button" class="btn-outline" data-doc-upload="${doc.key}" ${formLocked ? 'disabled' : ''}>Upload</button>
                    <button type="button" class="btn-outline" data-doc-preview="${doc.key}" ${previewDisabled ? 'disabled' : ''}>
                        ${previewDisabled ? 'Re-upload to preview' : 'Preview'}
                    </button>
                    ${isUploaded && !formLocked ? `<button type="button" class="btn-outline" data-doc-remove="${doc.key}">Remove</button>` : ''}
                </div>
                <input class="doc-input" type="file" data-doc-input="${doc.key}" accept=".pdf,.png,.jpg,.jpeg" ${formLocked ? 'disabled' : ''}>
            `;
            grid.appendChild(tile);
        });

        grid.querySelectorAll('[data-doc-upload]').forEach((btn) => {
            btn.addEventListener('click', () => {
                grid.querySelector(`[data-doc-input="${btn.dataset.docUpload}"]`)?.click();
            });
        });

        grid.querySelectorAll('[data-doc-input]').forEach((input) => {
            input.addEventListener('change', handleDocChange);
        });

        grid.querySelectorAll('[data-doc-remove]').forEach((btn) => {
            btn.addEventListener('click', () => removeDoc(btn.dataset.docRemove));
        });
    }

    function handleDocChange(event) {
        const key = event.target.dataset.docInput;
        const file = event.target.files?.[0];
        if (!key || !file) return;

        const error = validateFile(file);
        if (error) {
            docState[key] = { ...docState[key], error };
        } else {
            docState[key] = {
                status: 'Uploaded',
                file: buildFileMeta(file),
                fileObj: file,
                error: ''
            };
        }

        renderDocs();
        updateDocsCounter();
        renderReview();
        updateSubmitState();
    }

    function validateFile(file) {
        if (!ALLOWED_TYPES.includes(file.type)) {
            return 'Only PDF, PNG, or JPG files are allowed.';
        }
        if (file.size > MAX_FILE_SIZE) {
            return 'File size must be 5 MB or less.';
        }
        return '';
    }

    function buildFileMeta(file) {
        return {
            name: file.name,
            size: file.size,
            type: file.type,
            uploadedAt: new Date().toISOString()
        };
    }

    function formatFileMeta(file) {
        if (!file) return 'No file selected.';
        const size = file.size ? `${Math.round(file.size / 1024)} KB` : 'Saved';
        return `${file.name} | ${size} | ${file.type || 'file'}`;
    }

    function removeDoc(key) {
        docState[key] = {
            status: 'Not uploaded',
            file: null,
            fileObj: null,
            error: ''
        };
        renderDocs();
        updateDocsCounter();
        renderReview();
        updateSubmitState();
    }

    function renderReview() {
        const docsList = document.getElementById('reviewDocs');

        if (docsList) {
            docsList.innerHTML = REQUIRED_FILES.map((doc) => {
                const entry = docState[doc.key];
                return `<div><strong>${doc.label}:</strong> ${entry?.file ? 'Uploaded' : 'Missing'}</div>`;
            }).join('');
        }
    }

    function updateSubmitState() {
        const submitBtn = document.getElementById('submitProfileButton');
        if (!submitBtn) return;
        submitBtn.disabled = formLocked || !(validateProfile(false) && isDocsComplete());
    }

    function validateProfile(showErrors) {
        const requiredIds = [
            'profileBirthdate',
            'profileGender',
            'profileContactNumber',
            'profileAddress',
            'profileBarangay',
            'profile4ps',
            'profileHouseholdSize',
            'profileSector',
            'profileLivelihood',
            'profileBusinessName'
        ];

        let valid = true;
        requiredIds.forEach((id) => {
            const field = document.getElementById(id);
            const errorEl = document.querySelector(`[data-error-for="${id}"]`);
            if (field?.required && !field.value) {
                if (showErrors && errorEl) {
                    errorEl.textContent = 'This field is required.';
                }
                valid = false;
            } else if (errorEl) {
                errorEl.textContent = '';
            }
        });

        return valid;
    }

    function isDocsComplete() {
        return REQUIRED_FILES.every((doc) => docState[doc.key]?.file && !docState[doc.key]?.error);
    }

    function updateDocsCounter() {
        const uploaded = REQUIRED_FILES.filter((doc) => docState[doc.key]?.file && !docState[doc.key]?.error).length;
        document.querySelectorAll('.docs-total-count').forEach((el) => {
            el.textContent = String(REQUIRED_FILES.length);
        });
        setText('docsUploadedCount', String(uploaded));
        document.querySelectorAll('.meta-badge').forEach((badge) => {
            badge.classList.toggle('is-complete', uploaded === REQUIRED_FILES.length);
        });
    }

    async function handleSubmitClick() {
        if (!validateProfile(true) || !isDocsComplete()) {
            showNotices('Please complete all required profile fields and uploads before submitting.', true, ['formNotice']);
            return;
        }

        await persistProfile(true, 'application');
    }

    function buildProfilePayload() {
        return {
            birthdate: getValue('profileBirthdate'),
            age: getValue('profileAge'),
            gender: getValue('profileGender'),
            contactNumber: getValue('profileContactNumber'),
            address: getValue('profileAddress'),
            barangay: getValue('profileBarangay'),
            is4ps: getValue('profile4ps'),
            householdSize: getValue('profileHouseholdSize'),
            sector: getValue('profileSector'),
            livelihood: getValue('profileLivelihood'),
            businessName: getValue('profileBusinessName')
        };
    }

    async function persistProfile(submit, origin) {
        if (formLocked && submit) return;

        clearServerErrors();
        toggleBusyState(true, submit);

        const formData = new FormData();
        Object.entries(buildProfilePayload()).forEach(([key, value]) => {
            formData.append(key, value);
        });

        REQUIRED_FILES.forEach((doc) => {
            const file = docState[doc.key]?.fileObj;
            if (file) {
                formData.append(`documents[${doc.key}]`, file);
            }
        });

        try {
            const response = await fetch(routeUrl(submit ? 'profile-completion/submit' : 'profile-completion/save'), {
                method: 'POST',
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
                body: formData
            });
            const payload = await response.json();

            if (response.status === 401) {
                window.location.href = routeUrl('portal');
                return;
            }

            if (!response.ok || !payload.ok) {
                applyServerErrors(payload.errors || {});
                showNotices(payload.errors?.general || payload.message || 'Unable to save your profile.', true, noticeTargets(origin, submit));
                return;
            }

            currentState = payload.data;
            hydrateExistingApplication(currentState);
            renderDocs();
            updateDocsCounter();
            renderReview();
            renderStatusBar(currentState.application);
            updateSubmitState();
            dispatchDashboardProfileState();
            showNotices(payload.message || successMessage(submit, origin), false, noticeTargets(origin, submit));

            if (submit) {
                lockForm();
            }
        } catch (error) {
            console.error('Profile save failed', error);
            showNotices('Unable to save your profile right now.', true, noticeTargets(origin, submit));
        } finally {
            toggleBusyState(false, submit);
        }
    }

    function successMessage(submit, origin) {
        if (submit) {
            return 'Application submitted for verification.';
        }
        if (origin === 'profile') {
            return 'Profile updated.';
        }
        return 'Application draft saved.';
    }

    function noticeTargets(origin, submit) {
        if (submit || origin === 'application') {
            return ['formNotice'];
        }
        return ['profileFormNotice'];
    }

    function renderStatusBar(application) {
        const app = application || currentState?.application;
        const status = app?.status || 'Draft';
        setText('statusValue', status);
        setText('statusUpdated', app?.updatedAt ? formatDate(app.updatedAt) : '--');

        const remark = document.getElementById('statusRemark');
        if (remark) {
            remark.textContent = app?.remarks || '';
            remark.hidden = !app?.remarks;
        }
    }

    function dispatchDashboardProfileState() {
        document.dispatchEvent(new CustomEvent('smartleap:profile-state', {
            detail: {
                profile: currentState?.profile || null,
                application: currentState?.application || null
            }
        }));
    }

    function checkStatusAndRoute() {
        const status = normalizeStatus(currentState?.application?.status || '');
        const role = normalizeStatus(currentState?.user?.role || '');

        if (!isDashboardEmbedded() && role === 'beneficiary') {
            window.location.href = routeUrl('beneficiary-dashboard');
            return;
        }

        if (!isDashboardEmbedded() && (status === 'approved' || status === 'active' || status === 'released')) {
            window.location.href = routeUrl(role === 'beneficiary' ? 'beneficiary-dashboard' : 'applicant-dashboard');
            return;
        }
        if (status === 'submitted' || status === 'pendingverification') {
            lockForm();
        } else if (status === 'rejected') {
            unlockForm();
        }
    }

    function setFormControlsDisabled(disabled) {
        document.querySelectorAll('#profileCompletionForm input, #profileCompletionForm select, #saveProfileChangesButton, #saveDraftButton, #submitProfileButton, [data-doc-upload], [data-doc-preview], [data-doc-remove], [data-doc-input]').forEach((el) => {
            el.disabled = disabled;
        });
    }

    function lockForm() {
        formLocked = true;
        setFormControlsDisabled(true);
        renderDocs();
        updateSubmitState();
    }

    function unlockForm() {
        formLocked = false;
        setFormControlsDisabled(false);
        renderDocs();
        updateSubmitState();
    }

    function bindPreviewEventsOnce() {
        if (boundPreviewEvents) return;
        boundPreviewEvents = true;

        const grid = document.getElementById('docGrid');
        const modal = document.getElementById('previewModal');
        const closeFooter = document.getElementById('closePreviewFooter');
        const replaceBtn = document.getElementById('replacePreview');

        grid?.addEventListener('click', (event) => {
            const btn = event.target.closest('[data-doc-preview]');
            if (!btn || btn.disabled) return;
            openPreview(btn.dataset.docPreview);
        });

        closeFooter?.addEventListener('click', closePreview);
        replaceBtn?.addEventListener('click', () => {
            if (!activePreviewKey || formLocked) return;
            document.querySelector(`[data-doc-input="${activePreviewKey}"]`)?.click();
        });

        modal?.addEventListener('click', (event) => {
            if (event.target === modal) {
                closePreview();
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                closePreview();
            }
        });
    }

    function openPreview(key) {
        const modal = document.getElementById('previewModal');
        const body = document.getElementById('previewBody');
        const entry = docState[key];
        if (!modal || !body || !entry?.file) return;

        activePreviewKey = key;
        const label = REQUIRED_FILES.find((doc) => doc.key === key)?.label || 'Document';
        setText('previewTitle', label);

        const statusBadge = modal.querySelector('.modal-status .doc-status');
        if (statusBadge) {
            statusBadge.textContent = entry.fileObj ? 'Uploaded' : 'Re-upload to preview';
            statusBadge.classList.toggle('is-uploaded', Boolean(entry.fileObj));
        }

        if (!entry.fileObj) {
            body.innerHTML = '<p>Preview unavailable for previously uploaded files. Re-upload to preview locally.</p>';
        } else {
            if (activePreviewUrl) {
                URL.revokeObjectURL(activePreviewUrl);
            }
            activePreviewUrl = URL.createObjectURL(entry.fileObj);
            if ((entry.file.type || '').startsWith('image/')) {
                body.innerHTML = `<img src="${activePreviewUrl}" alt="${label} preview">`;
            } else {
                body.innerHTML = `<object data="${activePreviewUrl}" type="application/pdf" aria-label="${label} preview"></object>`;
            }
        }

        modal.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    function closePreview() {
        if (activePreviewUrl) {
            URL.revokeObjectURL(activePreviewUrl);
        }
        activePreviewUrl = null;
        activePreviewKey = null;

        const body = document.getElementById('previewBody');
        const modal = document.getElementById('previewModal');
        if (body) body.innerHTML = '';
        if (modal) modal.hidden = true;
        document.body.style.overflow = '';
    }

    async function handleLogout() {
        try {
            const response = await fetch(routeUrl('auth/logout'), {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                credentials: 'same-origin'
            });
            const payload = await response.json().catch(() => ({}));
            window.location.href = routeUrl(payload.redirect || 'portal');
        } finally {
            // Redirect is handled from the logout response or falls back to portal.
        }
    }

    function applyServerErrors(errors) {
        clearServerErrors();

        const fieldMap = {
            birthdate: 'profileBirthdate',
            age: 'profileAge',
            gender: 'profileGender',
            contactNumber: 'profileContactNumber',
            address: 'profileAddress',
            barangay: 'profileBarangay',
            is4ps: 'profile4ps',
            householdSize: 'profileHouseholdSize',
            sector: 'profileSector',
            livelihood: 'profileLivelihood',
            businessName: 'profileBusinessName'
        };

        Object.entries(fieldMap).forEach(([key, id]) => {
            const errorEl = document.querySelector(`[data-error-for="${id}"]`);
            if (errorEl && errors[key]) {
                errorEl.textContent = errors[key];
            }
        });

        REQUIRED_FILES.forEach((doc) => {
            if (errors[doc.key]) {
                docState[doc.key] = { ...docState[doc.key], error: errors[doc.key] };
            }
        });

        renderDocs();
        updateDocsCounter();
    }

    function clearServerErrors() {
        document.querySelectorAll('[data-error-for]').forEach((el) => {
            if (String(el.getAttribute('data-error-for') || '').startsWith('profile')) {
                el.textContent = '';
            }
        });

        REQUIRED_FILES.forEach((doc) => {
            docState[doc.key] = { ...docState[doc.key], error: '' };
        });

        hideNotices();
    }

    function toggleBusyState(isBusy, submit) {
        const saveProfileButton = document.getElementById('saveProfileChangesButton');
        const saveDraftButton = document.getElementById('saveDraftButton');
        const submitButton = document.getElementById('submitProfileButton');

        if (saveProfileButton) {
            saveProfileButton.disabled = isBusy || formLocked;
            saveProfileButton.textContent = isBusy && !submit ? 'Saving...' : 'Save Changes';
        }

        if (saveDraftButton) {
            saveDraftButton.disabled = isBusy || formLocked;
            saveDraftButton.textContent = isBusy && !submit ? 'Saving...' : 'Save Draft';
        }

        if (submitButton) {
            submitButton.disabled = isBusy || formLocked || !validateProfile(false) || !isDocsComplete();
            submitButton.textContent = isBusy && submit ? 'Submitting...' : 'Submit for verification';
        }
    }

    function formatDate(value) {
        if (!value) return '--';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '--';
        return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el && value != null) el.value = value;
    }

    function getValue(id) {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function showNotices(message, isError, targets = ['profileFormNotice', 'formNotice']) {
        targets.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = message;
            el.hidden = false;
            el.classList.toggle('error', Boolean(isError));
        });
    }

    function hideNotices() {
        ['profileFormNotice', 'formNotice'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.hidden = true;
            el.textContent = '';
            el.classList.remove('error');
        });
    }

    function normalizeStatus(value) {
        return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
    }
})();

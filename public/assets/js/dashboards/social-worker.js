(function () {
  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');
  const authUser = window.SMARTLEAP_AUTH_USER || {};
  const overview = window.SMARTLEAP_SOCIAL_WORKER_OVERVIEW || {};

  const state = {
    section: 'dashboard',
    applications: Array.isArray(overview.assessmentQueue) ? overview.assessmentQueue.slice() : [],
    beneficiaries: Array.isArray(overview.beneficiaryRoster) ? overview.beneficiaryRoster.slice() : [],
    repayments: [],
    recentApplications: Array.isArray(overview.recentApplications) ? overview.recentApplications.slice() : [],
    tickets: [],
    activeTicketId: null,
    reportsInitialized: false,
    busy: false,
  };

  const sectionMeta = {
    dashboard: ['', 'Dashboard'],
    applications: ['', 'Applications'],
    beneficiaries: ['', 'Beneficiaries'],
    reports: ['', 'Reports'],
    support: ['', 'Support'],
  };

  function routeUrl(path) {
    return `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }
    console[type === 'error' ? 'error' : 'log'](message);
  }

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = String(value);
  }

  function normalizeKey(value) {
    return String(value || 'Unspecified').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unspecified';
  }

  function titleCase(value) {
    return String(value || 'Unspecified')
      .replace(/[_-]+/g, ' ')
      .trim()
      .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
  }

  function normalizeGenderLabel(value) {
    const key = String(value || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
    if (['male', 'lalaki', 'lalake'].includes(key)) return 'Male';
    if (['female', 'babaye', 'babae'].includes(key)) return 'Female';
    if (['non binary', 'nonbinary'].includes(key)) return 'Non-binary';
    if (['prefer not to say', 'dili gustong mosulti'].includes(key)) return 'Prefer not to say';
    return value || 'Unspecified';
  }

  function countBy(items, resolver) {
    return items.reduce((map, item) => {
      const raw = resolver(item);
      const key = normalizeKey(raw);
      const label = titleCase(raw || key);
      const entry = map.get(key) || { key, label, count: 0 };
      entry.count += 1;
      map.set(key, entry);
      return map;
    }, new Map());
  }

  function renderDashboardChart(rootId, entries, options = {}) {
    const root = document.getElementById(rootId);
    if (!root) return;
    const palette = ['#1d4ed8', '#16a34a', '#f97316', '#7c3aed', '#dc2626', '#0891b2', '#be185d', '#4d7c0f'];
    const horizontal = options.horizontal === true;
    const limit = Number(options.limit || (horizontal ? 8 : 24));
    const items = entries.filter((item) => safeNumber(item.count) > 0).slice(0, limit);
    if (!items.length) {
      root.innerHTML = '<div class="sw-dashboard-empty-chart">No records available.</div>';
      return;
    }
    const max = Math.max(...items.map((item) => safeNumber(item.count)), 1);
    const denseClass = !horizontal && items.length > 8 ? ' is-dense' : '';
    root.innerHTML = `
      <div class="sw-dashboard-chart__plot ${horizontal ? 'is-horizontal' : 'is-vertical'}${denseClass}" style="--bar-count:${items.length};">
        ${items.map((item, index) => {
          const count = safeNumber(item.count);
          const size = Math.max((count / max) * 100, count > 0 ? 8 : 0);
          const color = palette[index % palette.length];
          return horizontal
            ? `<article class="sw-dashboard-bar-row"><span>${escapeHtml(item.label)}</span><div class="sw-dashboard-bar-track"><i style="width:${size}%; --bar-color:${color}"></i></div><strong>${count}</strong></article>`
            : `<article class="sw-dashboard-column"><div class="sw-dashboard-column__track"><i style="height:${size}%; --bar-color:${color}"></i></div><span>${escapeHtml(item.label)}</span><strong>${count}</strong></article>`;
        }).join('')}
      </div>
    `;
  }

  function renderDashboardSummary() {
    const applicationSummary = overview.applicationSummary || {};
    const trainingSummary = overview.trainingSummary || {};
    const repaymentSummary = overview.repaymentSummary || {};
    const activeBeneficiaries = state.beneficiaries.slice();
    const applicationCounts = countBy(state.applications, (application) => application.status || application.applicationStatus || 'Draft');
    const repaymentCounts = countBy(activeBeneficiaries, (beneficiary) => beneficiary.repayment?.label || beneficiary.repayment?.key || 'No Upload Yet');
    const barangayCounts = countBy(activeBeneficiaries, (beneficiary) => beneficiary.barangay || 'Unassigned');
    const genderCounts = countBy(activeBeneficiaries, (beneficiary) => normalizeGenderLabel(beneficiary.gender));
    const appValue = (key) => safeNumber(applicationCounts.get(normalizeKey(key))?.count);
    const repaymentValue = (key) => safeNumber(repaymentCounts.get(normalizeKey(key))?.count);

    setText('swDashApplicationsTotal', safeNumber(applicationSummary.total) || state.applications.length);
    setText('swDashBeneficiariesTotal', activeBeneficiaries.length);
    setText('swDashTrainingTotal', safeNumber(trainingSummary.programs) || safeNumber(trainingSummary.total));

    const repaymentTotal = (repaymentValue('Fully Paid') || repaymentValue('Fully Verified'))
      + (repaymentValue('Partial Paid') || repaymentValue('Partially Verified'))
      + repaymentValue('Under Review')
      + repaymentValue('No Upload Yet');
    setText('swDashRepaymentsPending', repaymentTotal);

    renderDashboardChart('swApplicantsStatusChart', Array.from(applicationCounts.values()));
    renderDashboardChart('swRepaymentVerificationRateChart', Array.from(repaymentCounts.values()));
  }

  async function request(path, options = {}) {
    const response = await fetch(routeUrl(path), {
      credentials: 'same-origin',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...(options.headers || {}) },
      ...options,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false || payload.success === false) {
      const firstError = payload.errors && typeof payload.errors === 'object'
        ? Object.values(payload.errors).find(Boolean)
        : '';
      throw new Error(payload.message || firstError || 'Request failed.');
    }
    return payload;
  }

  async function loadRepayments() {
    try {
      const payload = await request('api/repayments');
      state.repayments = Array.isArray(payload.data?.payments) ? payload.data.payments : [];
      renderBeneficiaries();
      renderDashboardSummary();
    } catch (error) {
      console.warn('Unable to load Social Worker repayment records', error);
    }
  }

  function setSection(section) {
    state.section = sectionMeta[section] ? section : 'dashboard';
    document.querySelectorAll('[data-role-section]').forEach((panel) => {
      const active = panel.id === `${state.section}-section`;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    document.querySelectorAll('.admin-sidebar .nav-link[data-section]').forEach((link) => {
      link.classList.toggle('active', link.dataset.section === state.section);
    });
    const eyebrowNode = document.getElementById('swSectionEyebrow');
    const titleNode = document.getElementById('swSectionTitle');
    if (eyebrowNode) {
      eyebrowNode.textContent = 'Welcome back';
      eyebrowNode.hidden = false;
    }
    if (titleNode) titleNode.textContent = authUser?.name || 'Social Worker';

    if (state.section === 'support' && state.tickets.length === 0) {
      loadSupportTickets();
    }
    if (state.section === 'reports') {
      initReports();
    }
  }

  function initNavigation() {
    document.querySelectorAll('.admin-sidebar .nav-link[data-section], [data-section-jump]').forEach((control) => {
      control.addEventListener('click', (event) => {
        event.preventDefault();
        setSection(control.dataset.section || control.dataset.sectionJump || 'dashboard');
        closeSidebar();
      });
    });
  }

  function initSidebar() {
    const shell = document.getElementById('mainSystem');
    const toggle = document.querySelector('.sidebar-toggle');
    const backdrop = document.querySelector('[data-sidebar-close]');
    const setOpen = (open) => {
      shell?.setAttribute('data-sidebar-open', open ? 'true' : 'false');
      toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    toggle?.addEventListener('click', () => {
      setOpen(shell?.getAttribute('data-sidebar-open') !== 'true');
    });
    backdrop?.addEventListener('click', () => setOpen(false));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) setOpen(false);
    });
  }

  function closeSidebar() {
    const shell = document.getElementById('mainSystem');
    const toggle = document.querySelector('.sidebar-toggle');
    shell?.setAttribute('data-sidebar-open', 'false');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  function initAccountMenu() {
    const trigger = document.getElementById('swAccountMenuTrigger');
    const panel = document.getElementById('swAccountMenuPanel');
    const profileButton = document.getElementById('swAccountProfile');
    const passwordButton = document.getElementById('swAccountPassword');
    if (!trigger || !panel) return;

    const setExpanded = (expanded) => {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      panel.hidden = !expanded;
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      setExpanded(trigger.getAttribute('aria-expanded') !== 'true');
    });
    profileButton?.addEventListener('click', () => {
      setExpanded(false);
      openProfileModal();
    });
    passwordButton?.addEventListener('click', () => {
      setExpanded(false);
      openPasswordModal();
    });
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.staff-account-menu')) setExpanded(false);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
        closeModal();
      }
    });
  }

  function initLogout() {
    const button = document.getElementById('sw-logout');
    button?.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await fetch(routeUrl('auth/logout'), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
      } catch (error) {
        console.warn('Social worker logout failed', error);
      } finally {
        window.location.href = routeUrl('login');
      }
    });
  }

  function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('approved') || value.includes('resolved')) return 'is-approved';
    if (value.includes('waiting') || value.includes('correction') || value.includes('review')) return 'is-warning';
    if (value.includes('reject') || value.includes('closed')) return 'is-rejected';
    if (value.includes('referred')) return 'is-referred';
    return '';
  }

  function renderApplicationRows(target, applications, columns = 7) {
    const body = document.querySelector(target);
    if (!body) return;
    if (!applications.length) {
      body.innerHTML = `<tr><td colspan="${columns}">No applicant records found.</td></tr>`;
      return;
    }
    body.innerHTML = applications.map((application) => {
      const id = Number(application.id || application.applicationId || 0);
      const applicant = application.applicantName || application.name || 'Unnamed applicant';
      const business = application.businessName || 'No business name yet';
      const requirements = `${Number(application.verifiedRequirementCount || 0)} / ${Number(application.requiredRequirementCount || application.uploadedRequirementCount || 0)}`;
      if (columns === 5) {
        return `
          <tr>
            <td><div class="sw-applicant-cell"><strong>${escapeHtml(applicant)}</strong><span>${escapeHtml(business)}</span></div></td>
            <td>${escapeHtml(application.barangay || '--')}</td>
            <td><span class="sw-status ${statusClass(application.status)}">${escapeHtml(application.status || '--')}</span></td>
            <td>${escapeHtml(formatDate(application.updatedAt || application.submittedAt))}</td>
            <td class="actions"><button type="button" class="app-btn-outline" data-open-case="${id}"><i class="fas fa-folder-open"></i><span>Open Case</span></button></td>
          </tr>
        `;
      }
      return `
        <tr>
          <td><div class="sw-applicant-cell"><strong>${escapeHtml(applicant)}</strong><span>${escapeHtml(application.email || '')}</span></div></td>
          <td>${escapeHtml(business)}</td>
          <td>${escapeHtml(application.barangay || '--')}</td>
          <td><span class="sw-status ${statusClass(application.status)}">${escapeHtml(application.status || '--')}</span></td>
          <td>${escapeHtml(requirements)}</td>
          <td>${escapeHtml(formatDate(application.updatedAt || application.submittedAt))}</td>
          <td class="actions"><button type="button" class="app-btn-outline" data-open-case="${id}"><i class="fas fa-folder-open"></i><span>Open Case</span></button></td>
        </tr>
      `;
    }).join('');
  }

  function renderApplications() {
    const search = String(document.getElementById('swApplicationSearch')?.value || '').toLowerCase();
    const status = String(document.getElementById('swApplicationStatus')?.value || '').toLowerCase();
    const filtered = state.applications.filter((application) => {
      const haystack = [
        application.applicantName,
        application.email,
        application.businessName,
        application.barangay,
        application.status,
      ].join(' ').toLowerCase();
      const statusValue = String(application.status || '').toLowerCase();
      return (!search || haystack.includes(search)) && (!status || statusValue === status);
    });

    renderApplicationRows('[data-sw-applications-body]', filtered, 7);
    renderApplicationRows('[data-sw-priority-body]', filtered.slice(0, 5), 5);
    const count = document.querySelector('[data-sw-application-count]');
    if (count) count.textContent = `${filtered.length} ${filtered.length === 1 ? 'case' : 'cases'}`;
    const applicationsBadge = document.querySelector('[data-section-badge="applications"]');
    if (applicationsBadge) applicationsBadge.textContent = filtered.length ? String(filtered.length) : '';

    renderRecentApplications();
    renderDashboardSummary();
  }

  function renderRecentApplications() {
    const recent = state.recentApplications.length ? state.recentApplications : state.applications.slice(0, 8);
    const body = document.querySelector('[data-sw-recent-body]');
    if (!body) return;
    if (!recent.length) {
      body.innerHTML = '<tr><td colspan="4">No recent applications loaded.</td></tr>';
      return;
    }
    body.innerHTML = recent.map((application) => `
      <tr>
        <td><div class="sw-applicant-cell"><strong>${escapeHtml(application.applicantName || 'Unnamed applicant')}</strong><span>${escapeHtml(application.businessName || '')}</span></div></td>
        <td>${escapeHtml(application.barangay || '--')}</td>
        <td><span class="sw-status ${statusClass(application.status)}">${escapeHtml(application.status || '--')}</span></td>
        <td>${escapeHtml(formatDate(application.updatedAt || application.submittedAt))}</td>
      </tr>
    `).join('');
  }

  async function loadApplications() {
    try {
      const payload = await request('api/applications');
      const data = payload.data || {};
      state.applications = Array.isArray(data.applications) ? data.applications : state.applications;
      state.recentApplications = state.applications.slice(0, 8);
      renderApplications();
    } catch (error) {
      showToast(error.message || 'Unable to load Social Worker applications.', 'error');
      renderApplications();
    }
  }

  function initApplicationFilters() {
    document.getElementById('swApplicationSearch')?.addEventListener('input', renderApplications);
    document.getElementById('swApplicationStatus')?.addEventListener('change', renderApplications);
    document.getElementById('swApplicationRefresh')?.addEventListener('click', loadApplications);
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-open-case]');
      if (!button) return;
      openCase(Number(button.dataset.openCase || 0));
    });
  }

  function renderBeneficiaries() {
    const body = document.querySelector('[data-sw-beneficiaries-body]');
    if (!body) return;

    const search = String(document.getElementById('swBeneficiarySearch')?.value || '').toLowerCase();
    const repayment = String(document.getElementById('swBeneficiaryRepayment')?.value || '').toLowerCase();
    const filtered = state.beneficiaries.filter((beneficiary) => {
      const repaymentKey = String(beneficiary.repayment?.key || '').toLowerCase();
      const haystack = [
        beneficiary.name,
        beneficiary.businessName,
        beneficiary.barangay,
        beneficiary.assignedPdo,
        beneficiary.gender,
        beneficiary.ageGroup,
        beneficiary.serviceType,
        beneficiary.repayment?.label,
      ].join(' ').toLowerCase();

      return (!search || haystack.includes(search)) && (!repayment || repaymentKey === repayment);
    });

    const count = document.querySelector('[data-sw-beneficiary-count]');
    if (count) {
      count.textContent = `${filtered.length} ${filtered.length === 1 ? 'beneficiary' : 'beneficiaries'}`;
    }

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="10">No beneficiaries matched the current filters.</td></tr>';
      renderDashboardSummary();
      return;
    }

    body.innerHTML = filtered.map((beneficiary) => {
      const repayment = beneficiary.repayment || {};
      const repaymentRecord = repaymentForBeneficiary(beneficiary);
      const rate = Number.isFinite(Number(repayment.repaymentRate)) ? `${Number(repayment.repaymentRate)}%` : '0%';
      const verified = money(repayment.paidAmount || repayment.verifiedAmount || 0);
      const action = repaymentRecord
        ? `<button type="button" class="app-btn-outline" data-edit-repayment="${Number(repaymentRecord.id || 0)}">Edit Repayment</button>`
        : '<span class="sw-muted-action">No repayment record</span>';
      return `
        <tr>
          <td><div class="sw-applicant-cell"><strong>${escapeHtml(beneficiary.name || 'Unnamed beneficiary')}</strong><span>${escapeHtml(beneficiary.businessName || '')}</span></div></td>
          <td>${escapeHtml(beneficiary.gender || '--')}</td>
          <td>${escapeHtml(beneficiary.ageGroup || '--')}</td>
          <td>${escapeHtml(beneficiary.serviceType || beneficiary.businessType || '--')}</td>
          <td>${escapeHtml(beneficiary.barangay || '--')}</td>
          <td>${escapeHtml(beneficiary.assignedPdo || 'Unassigned')}</td>
          <td><span class="sw-status ${statusClass(repayment.label || repayment.key)}">${escapeHtml(repayment.label || 'No Upload Yet')}</span></td>
          <td>${escapeHtml(verified)}</td>
          <td>${escapeHtml(rate)}</td>
          <td class="actions">${action}</td>
        </tr>
      `;
    }).join('');
    renderDashboardSummary();
  }

  function repaymentForBeneficiary(beneficiary) {
    const beneficiaryId = Number(beneficiary.id || beneficiary.beneficiaryId || 0);
    if (!beneficiaryId) return null;
    const matches = state.repayments
      .filter((repayment) => Number(repayment.beneficiaryId || 0) === beneficiaryId)
      .sort((a, b) => new Date(b.submittedAt || b.paymentDate || 0) - new Date(a.submittedAt || a.paymentDate || 0));
    return matches[0] || null;
  }

  function initBeneficiaryFilters() {
    document.getElementById('swBeneficiarySearch')?.addEventListener('input', renderBeneficiaries);
    document.getElementById('swBeneficiaryRepayment')?.addEventListener('change', renderBeneficiaries);
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-edit-repayment]');
      if (!button) return;
      openRepaymentCorrection(Number(button.dataset.editRepayment || 0));
    });
  }

  function money(value) {
    const amount = Number(value);
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0);
  }

  function initReports() {
    const reports = window.App?.modules?.reports;
    if (!reports || typeof reports.init !== 'function') {
      return;
    }
    if (state.reportsInitialized) {
      if (typeof reports.render === 'function') reports.render();
      return;
    }
    state.reportsInitialized = true;
    reports.init();
  }

  async function openCase(applicationId) {
    if (!applicationId) return;
    openModal(`
      <div class="sw-modal__header">
        <div><span class="admin-section-eyebrow">Application Case</span><h2>Loading case...</h2><p>Please wait while the applicant record loads.</p></div>
        <button type="button" class="sw-modal__close" data-close-modal aria-label="Close">&times;</button>
      </div>
      <div class="sw-modal__body"><p class="sw-empty">Loading application detail...</p></div>
    `);
    try {
      const payload = await request(`api/applications/show?id=${encodeURIComponent(applicationId)}`);
      renderCaseModal(payload.application || payload.data || {});
    } catch (error) {
      openModal(`
        <div class="sw-modal__header">
          <div><span class="admin-section-eyebrow">Application Case</span><h2>Unable to load case</h2><p>${escapeHtml(error.message)}</p></div>
          <button type="button" class="sw-modal__close" data-close-modal aria-label="Close">&times;</button>
        </div>
        <div class="sw-modal__body"><p class="sw-empty">The selected application could not be loaded right now.</p></div>
      `);
    }
  }

  function renderCaseModal(application) {
    openModal(`
      <div class="sw-modal__header">
        <div>
          <span class="admin-section-eyebrow">Application Case</span>
          <h2>${escapeHtml(application.applicantName || 'Applicant')}</h2>
          <p>${escapeHtml(application.businessName || 'No business name yet')} | ${escapeHtml(application.barangay || '--')}</p>
        </div>
        <button type="button" class="sw-modal__close" data-close-modal aria-label="Close">&times;</button>
      </div>
      <div class="sw-modal__body sw-modal__body--correction-only">
        ${renderApplicantDataCorrectionForm(application)}
      </div>
      <div class="sw-modal__footer">
        <button type="button" class="app-btn-outline" data-close-modal>Close</button>
      </div>
    `);

    document.querySelector('[data-applicant-correction-form]')?.addEventListener('submit', saveApplicantDataCorrection);
  }

  function renderApplicantDataCorrectionForm(application) {
    return `
      <details class="sw-correction-card" open>
        <summary>
          <span>
            <span class="admin-section-eyebrow">Applicant Input Corrections</span>
            <strong>Edit Applicant Data</strong>
            <small>Correct wrong information inputted by the applicant or beneficiary. A correction reason is required and every save is audit logged.</small>
          </span>
          <span class="sw-correction-card__chevron">Correction editor</span>
        </summary>
        <form class="sw-correction-form" data-applicant-correction-form data-application-id="${Number(application.id || 0)}">
          <div class="sw-correction-grid">
            ${textInput('applicantName', 'Applicant name', application.applicantName)}
            ${textInput('businessName', 'Business name', application.businessName)}
            ${textInput('contactNumber', 'Contact number', application.contactNumber)}
            ${textInput('barangay', 'Barangay', application.barangay)}
            ${textInput('address', 'Address', application.address)}
            ${textInput('birthdate', 'Birthdate', application.birthdate, 'date')}
            ${textInput('age', 'Age', application.age, 'number', 'min="1" max="120"')}
            ${textInput('gender', 'Gender', application.gender)}
            ${textInput('householdSize', 'Household size', application.householdSize, 'number', 'min="1" max="99"')}
            ${textInput('educationalAttainment', 'Educational attainment', application.educationalAttainment)}
            ${textInput('sector', 'Sector', application.sector)}
            ${textInput('livelihood', 'Livelihood', application.livelihood)}
            <label class="sw-checkbox-field">
              <input type="checkbox" name="is4ps" value="1"${application.is4ps ? ' checked' : ''}>
              <span>4Ps household</span>
            </label>
            <label class="full">
              <span>Correction reason</span>
              <textarea name="correctionReason" rows="3" required minlength="10" placeholder="Explain what was wrong and why this correction is being made."></textarea>
            </label>
            <p class="sw-inline-error full" data-correction-error></p>
          </div>
          <div class="sw-correction-actions">
            <button type="submit" class="app-btn-primary">Save Applicant Data Correction</button>
          </div>
        </form>
      </details>
    `;
  }

  function textInput(name, label, value, type = 'text', attributes = '') {
    return `
      <label>
        <span>${escapeHtml(label)}</span>
        <input type="${escapeHtml(type)}" name="${escapeHtml(name)}" value="${escapeHtml(value ?? '')}" ${attributes}>
      </label>
    `;
  }

  async function saveApplicantDataCorrection(event) {
    event.preventDefault();
    if (state.busy) return;
    const form = event.currentTarget;
    const errorNode = form.querySelector('[data-correction-error]');
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    data.append('applicationId', form.dataset.applicationId || '');
    state.busy = true;
    if (button) button.disabled = true;
    if (errorNode) errorNode.textContent = '';
    try {
      const payload = await request('api/applications/update-applicant-data', { method: 'POST', body: data });
      showToast(payload.message || 'Applicant data corrected.', 'success');
      renderCaseModal(payload.application || {});
      await loadApplications();
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message || 'Unable to update applicant data.';
      showToast(error.message || 'Unable to update applicant data.', 'error');
    } finally {
      state.busy = false;
      if (button) button.disabled = false;
    }
  }

  function openRepaymentCorrection(repaymentId) {
    const repayment = state.repayments.find((record) => Number(record.id || 0) === Number(repaymentId));
    if (!repayment) {
      showToast('Repayment record not found.', 'error');
      return;
    }

    openModal(`
      <div class="sw-modal__header">
        <div>
          <span class="admin-section-eyebrow">Repayment Input Correction</span>
          <h2>${escapeHtml(repayment.beneficiaryName || 'Beneficiary')}</h2>
          <p>${escapeHtml(repayment.beneficiaryBusiness || 'No business name')} | ${escapeHtml(repayment.beneficiaryBarangay || '--')}</p>
        </div>
        <button type="button" class="sw-modal__close" data-close-modal aria-label="Close">&times;</button>
      </div>
      <div class="sw-modal__body sw-modal__body--correction-only">
        <details class="sw-correction-card" open>
          <summary>
            <span>
              <span class="admin-section-eyebrow">Pre-PDO Repayment Data</span>
              <strong>Edit Repayment Data</strong>
              <small>Correct repayment information only when the submitted record has not yet been checked by PDO/Admin. The backend will reject locked records.</small>
            </span>
            <span class="sw-correction-card__chevron">Correction editor</span>
          </summary>
          <form class="sw-correction-form" data-repayment-correction-form data-repayment-id="${Number(repayment.id || 0)}">
            <div class="sw-correction-grid">
              ${textInput('month', 'Coverage month', repayment.month || repayment.coverageFrom, 'month')}
              ${textInput('paymentDate', 'Payment date', repayment.paymentDate, 'date')}
              ${textInput('amount', 'Submitted amount', repayment.amount, 'number', 'min="1" step="0.01"')}
              ${textInput('orNumber', 'OR number', repayment.orNumber)}
              <label>
                <span>Hard copy office status</span>
                <select name="hardCopyOfficeStatus">
                  ${hardCopyOption('not_submitted', 'Not Submitted', repayment.hardCopyOfficeStatus)}
                  ${hardCopyOption('submitted_to_office', 'Submitted to Office', repayment.hardCopyOfficeStatus)}
                  ${hardCopyOption('confirmed_by_office', 'Confirmed by Office', repayment.hardCopyOfficeStatus)}
                </select>
              </label>
              <label class="full">
                <span>Correction reason</span>
                <textarea name="correctionReason" rows="3" required minlength="10" placeholder="Explain what was wrong and why this repayment correction is being made."></textarea>
              </label>
              <p class="sw-inline-error full" data-repayment-correction-error></p>
            </div>
            <div class="sw-correction-actions">
              <button type="submit" class="app-btn-primary">Save Repayment Data Correction</button>
            </div>
          </form>
        </details>
      </div>
      <div class="sw-modal__footer">
        <button type="button" class="app-btn-outline" data-close-modal>Close</button>
      </div>
    `);

    document.querySelector('[data-repayment-correction-form]')?.addEventListener('submit', saveRepaymentDataCorrection);
  }

  function hardCopyOption(value, label, selectedValue) {
    return `<option value="${escapeHtml(value)}"${String(selectedValue || '') === value ? ' selected' : ''}>${escapeHtml(label)}</option>`;
  }

  async function saveRepaymentDataCorrection(event) {
    event.preventDefault();
    if (state.busy) return;
    const form = event.currentTarget;
    const errorNode = form.querySelector('[data-repayment-correction-error]');
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    const payload = {
      repaymentId: Number(form.dataset.repaymentId || 0),
      month: data.get('month') || '',
      paymentDate: data.get('paymentDate') || '',
      amount: data.get('amount') || '',
      orNumber: data.get('orNumber') || '',
      hardCopyOfficeStatus: data.get('hardCopyOfficeStatus') || '',
      correctionReason: data.get('correctionReason') || '',
    };

    state.busy = true;
    if (button) button.disabled = true;
    if (errorNode) errorNode.textContent = '';
    try {
      const response = await request('api/repayments/update-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast(response.message || 'Repayment data corrected.', 'success');
      closeModal();
      await loadRepayments();
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message || 'Unable to update repayment data.';
      showToast(error.message || 'Unable to update repayment data.', 'error');
    } finally {
      state.busy = false;
      if (button) button.disabled = false;
    }
  }

  async function loadSupportTickets() {
    const list = document.querySelector('[data-sw-ticket-list]');
    if (list) list.innerHTML = '<p class="sw-empty">Loading support concerns...</p>';
    try {
      const payload = await request('staff/support/tickets');
      state.tickets = Array.isArray(payload.tickets) ? payload.tickets : (payload.data?.tickets || []);
      renderTickets();
    } catch (error) {
      if (list) list.innerHTML = `<p class="sw-empty">${escapeHtml(error.message || 'Unable to load support concerns.')}</p>`;
    }
  }

  function renderTickets() {
    const list = document.querySelector('[data-sw-ticket-list]');
    const count = document.querySelector('[data-sw-ticket-count]');
    const badge = document.querySelector('[data-section-badge="support"]');
    if (count) count.textContent = `${state.tickets.length} ${state.tickets.length === 1 ? 'ticket' : 'tickets'}`;
    if (badge) badge.textContent = state.tickets.length ? String(state.tickets.length) : '';
    if (!list) return;
    if (!state.tickets.length) {
      list.innerHTML = '<p class="sw-empty">No Social Worker support concerns are assigned right now.</p>';
      return;
    }
    list.innerHTML = state.tickets.map((ticket) => `
      <button type="button" class="sw-ticket-card ${String(ticket.id) === String(state.activeTicketId) ? 'is-active' : ''}" data-open-ticket="${Number(ticket.id || 0)}">
        <span class="sw-ticket-card__top">
          <strong>${escapeHtml(ticket.ticketNo || ticket.ticket_no || 'Ticket')}</strong>
          <span class="sw-status ${statusClass(ticket.status)}">${escapeHtml(ticket.status || 'New')}</span>
        </span>
        <h3>${escapeHtml(ticket.subject || 'Support concern')}</h3>
        <p>${escapeHtml(ticket.category || 'Other')} | ${escapeHtml(ticket.assignedRole || ticket.assigned_role || 'Social Worker')}</p>
        <span class="sw-ticket-card__meta">
          <small>${escapeHtml(formatDate(ticket.updatedAt || ticket.updated_at || ticket.createdAt))}</small>
          ${ticket.unreadForStaff || ticket.unread_for_staff ? '<span class="sw-status is-warning">Unread</span>' : ''}
        </span>
      </button>
    `).join('');
  }

  function initSupport() {
    document.getElementById('swSupportRefresh')?.addEventListener('click', loadSupportTickets);
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-open-ticket]');
      if (button) openTicket(Number(button.dataset.openTicket || 0));
    });
  }

  async function openTicket(ticketId) {
    if (!ticketId) return;
    state.activeTicketId = ticketId;
    renderTickets();
    const detail = document.querySelector('[data-sw-ticket-detail]');
    if (detail) detail.innerHTML = '<p class="sw-empty">Loading conversation...</p>';
    try {
      const payload = await request(`staff/support/ticket?id=${encodeURIComponent(ticketId)}`);
      const detailData = payload.data || payload;
      const ticket = detailData.ticket || payload.ticket || {};
      renderTicketDetail({ ...ticket, messages: detailData.messages || payload.messages || [] });
    } catch (error) {
      if (detail) detail.innerHTML = `<p class="sw-empty">${escapeHtml(error.message || 'Unable to load ticket detail.')}</p>`;
    }
  }

  function renderTicketDetail(ticket) {
    const detail = document.querySelector('[data-sw-ticket-detail]');
    if (!detail || !ticket) return;
    const messages = Array.isArray(ticket.messages) ? ticket.messages : [];
    const closed = String(ticket.status || '').toLowerCase() === 'closed';
    detail.innerHTML = `
      <div class="section-header admin-section__header">
        <div>
          <span class="admin-section-eyebrow">${escapeHtml(ticket.ticketNo || ticket.ticket_no || 'Ticket')}</span>
          <h2>${escapeHtml(ticket.subject || 'Support concern')}</h2>
          <p class="section-subtitle">${escapeHtml(ticket.category || 'Other')} | Assigned to ${escapeHtml(ticket.assignedRole || 'Social Worker')}</p>
        </div>
        <span class="sw-status ${statusClass(ticket.status)}">${escapeHtml(ticket.status || 'New')}</span>
      </div>
      <div class="sw-ticket-thread">
        ${messages.length ? messages.map(renderMessage).join('') : '<p class="sw-empty">No messages recorded yet.</p>'}
      </div>
      ${closed ? '<p class="sw-empty">This concern is closed.</p>' : `
        <form class="sw-ticket-reply" data-ticket-reply data-ticket-id="${Number(ticket.id || 0)}">
          <textarea name="message" rows="4" required placeholder="Write a public reply to the applicant or beneficiary."></textarea>
          <select name="nextStatus">
            <option value="">Keep current status</option>
            <option value="In Review">In Review</option>
            <option value="Resolved">Resolved</option>
            <option value="Closed">Closed</option>
          </select>
          <p class="sw-inline-error" data-ticket-error></p>
          <div class="sw-ticket-reply__actions">
            <button type="submit" class="app-btn-primary">Send Reply</button>
          </div>
        </form>
      `}
    `;
    detail.querySelector('[data-ticket-reply]')?.addEventListener('submit', sendTicketReply);
  }

  function renderMessage(message) {
    const isStaff = String(message.senderType || '').toLowerCase() !== 'beneficiary' && String(message.senderType || '').toLowerCase() !== 'applicant';
    return `
      <article class="sw-ticket-message ${isStaff ? 'is-staff' : ''}">
        <div class="sw-ticket-message__meta">
          <strong>${escapeHtml(message.senderName || message.senderType || 'Sender')}</strong>
          <span>${escapeHtml(message.senderType || '')}</span>
          <span>${escapeHtml(formatDate(message.timestamp || message.createdAt))}</span>
        </div>
        <p>${escapeHtml(message.body || message.message || '')}</p>
      </article>
    `;
  }

  async function sendTicketReply(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const ticketId = Number(form.dataset.ticketId || 0);
    const errorNode = form.querySelector('[data-ticket-error]');
    const nextStatus = form.nextStatus?.value || '';
    const data = new FormData(form);
    data.delete('nextStatus');
    data.append('ticket_id', String(ticketId));
    try {
      await request('staff/support/ticket/messages', { method: 'POST', body: data });
      if (nextStatus) {
        const statusData = new FormData();
        statusData.append('ticket_id', String(ticketId));
        statusData.append('status', nextStatus);
        await request('staff/support/ticket/status', { method: 'POST', body: statusData });
      }
      showToast('Reply sent.', 'success');
      await loadSupportTickets();
      await openTicket(ticketId);
    } catch (error) {
      if (errorNode) errorNode.textContent = error.message || 'Unable to send reply.';
      showToast(error.message || 'Unable to send reply.', 'error');
    }
  }

  function openProfileModal() {
    let staff = null;
    let error = '';
    let saving = false;
    let photoBusy = false;

    const splitNameParts = (fullName) => {
      const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
      return {
        firstName: parts.shift() || '',
        middleName: parts.length > 1 ? parts.slice(0, -1).join(' ') : '',
        lastName: parts.length ? parts[parts.length - 1] : '',
      };
    };
    const composeFullName = (parts = {}) => [parts.firstName, parts.middleName, parts.lastName].map((value) => String(value || '').trim()).filter(Boolean).join(' ');

    const render = () => {
      if (!staff) {
        openModal(`
          <div class="sw-modal__header">
            <div><h2>Loading profile...</h2><p>Please wait while your account details are loaded.</p></div>
            <button type="button" class="sw-modal__close" data-close-modal aria-label="Close">&times;</button>
          </div>
          <div class="sw-modal__body"><p class="sw-empty">${escapeHtml(error || 'Loading account details...')}</p></div>
        `);
        return;
      }

      const nameParts = splitNameParts(staff?.name || '');
      const initials = (staff?.name || authUser?.name || 'SW')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'SW';
      openModal(`
        <div class="modal-card admin-profile-modal" role="dialog" aria-modal="true" aria-labelledby="swProfileModalTitle">
          <div class="modal-header">
            <div class="po-modal-title-block">
              <h2 class="modal-title" id="swProfileModalTitle">Profile</h2>
            </div>
            <button type="button" class="modal-close" data-close-modal aria-label="Close profile modal">&times;</button>
          </div>
          <form id="swProfileForm" class="modal-body admin-profile-modal__form">
            <section class="admin-record-sheet admin-record-sheet--account">
              <div class="admin-record-sheet__hero">
                <div class="admin-record-sheet__avatar-wrap">
                  <div class="admin-profile-modal__avatar admin-record-sheet__avatar ${staff?.photo ? 'has-photo' : ''}" ${staff?.photo ? `style="background-image:url('${escapeHtml(staff.photo)}')"` : ''} aria-hidden="true">${staff?.photo ? '' : escapeHtml(initials)}</div>
                  <label class="admin-profile-photo-action">
                    <input type="file" id="swProfilePhotoInput" accept=".jpg,.jpeg,.png" hidden ${photoBusy ? 'disabled' : ''}>
                    <span class="app-btn-outline">${photoBusy ? 'Uploading...' : 'Change Photo'}</span>
                  </label>
                </div>
                <div class="admin-record-sheet__identity">
                  <span class="admin-record-sheet__eyebrow">User Profile</span>
                  <h3>${escapeHtml(staff?.name || 'Social Worker')}</h3>
                  <p>Social Worker</p>
                </div>
              </div>
              ${error ? `<div class="notice danger admin-profile-modal__notice">${escapeHtml(error)}</div>` : ''}
              <section class="admin-record-sheet__section admin-record-sheet__section--violet">
                <div class="admin-record-sheet__section-head"><span>User Information</span></div>
                <div class="admin-record-sheet__grid admin-record-sheet__grid--two">
                  <label class="admin-record-sheet__field">
                    <span class="admin-profile-modal__label">First Name</span>
                    <input class="admin-profile-modal__input" type="text" name="firstName" value="${escapeHtml(nameParts.firstName)}" required>
                  </label>
                  <label class="admin-record-sheet__field">
                    <span class="admin-profile-modal__label">Middle Name</span>
                    <input class="admin-profile-modal__input" type="text" name="middleName" value="${escapeHtml(nameParts.middleName)}">
                  </label>
                  <label class="admin-record-sheet__field">
                    <span class="admin-profile-modal__label">Last Name</span>
                    <input class="admin-profile-modal__input" type="text" name="lastName" value="${escapeHtml(nameParts.lastName)}" required>
                  </label>
                  <article class="admin-record-sheet__field">
                    <span class="admin-profile-modal__label">Role</span>
                    <span class="admin-profile-modal__value">Social Worker</span>
                  </article>
                </div>
              </section>
              <section class="admin-record-sheet__section admin-record-sheet__section--aqua">
                <div class="admin-record-sheet__section-head"><span>Contact Information</span></div>
                <div class="admin-record-sheet__grid admin-record-sheet__grid--two">
                  <label class="admin-record-sheet__field admin-record-sheet__field--wide">
                    <span class="admin-profile-modal__label">Email Address</span>
                    <input class="admin-profile-modal__input" type="email" name="email" value="${escapeHtml(staff?.email || '')}" required readonly>
                  </label>
                  <label class="admin-record-sheet__field">
                    <span class="admin-profile-modal__label">Contact Number</span>
                    <input class="admin-profile-modal__input" type="text" name="contactNumber" value="${escapeHtml(staff?.contactNumber || '')}">
                  </label>
                </div>
              </section>
            </section>
          </form>
          <div class="modal-footer">
            <button type="button" class="app-btn-outline" data-close-modal>Back</button>
            <button type="submit" form="swProfileForm" class="app-btn-primary"${saving ? ' disabled' : ''}>${saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </div>
      `);
      document.getElementById('swProfileForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (saving) return;
        const form = event.currentTarget;
        const formData = new FormData(form);
        const payload = {
          firstName: formData.get('firstName') || '',
          middleName: formData.get('middleName') || '',
          lastName: formData.get('lastName') || '',
          email: formData.get('email') || '',
          contactNumber: formData.get('contactNumber') || '',
        };
        saving = true;
        error = '';
        render();
        try {
          const body = new URLSearchParams(payload);
          const response = await request('api/team/self', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
            body,
          });
          staff = response.staff || { ...staff, ...payload, name: composeFullName(payload) };
          if (authUser) {
            authUser.name = staff.name || composeFullName(payload);
            authUser.email = staff.email || payload.email;
          }
          saving = false;
          showToast(response.message || 'Profile updated.', 'success');
          render();
        } catch (saveError) {
          saving = false;
          error = saveError.message || 'Unable to save your profile.';
          render();
        }
      });
      document.getElementById('swProfilePhotoInput')?.addEventListener('change', async (event) => {
        const input = event.currentTarget;
        const file = input?.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          error = 'Profile photo must be 5 MB or less.';
          return render();
        }
        photoBusy = true;
        error = '';
        render();
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const response = await request('account/profile-photo', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json;charset=UTF-8' },
              body: JSON.stringify({ photoDataUrl: String(reader.result || '') }),
            });
            staff = { ...(staff || {}), ...(response.data?.user || {}), photo: response.data?.user?.photo || staff?.photo || null };
            if (authUser) {
              authUser.photo = response.data?.user?.photo || authUser.photo;
            }
            photoBusy = false;
            showToast(response.message || 'Profile photo updated.', 'success');
            render();
          } catch (uploadError) {
            photoBusy = false;
            error = uploadError.message || 'Unable to save the profile photo.';
            render();
          }
        };
        reader.readAsDataURL(file);
      });
    };

    render();
    request('api/team/self')
      .then((response) => {
        staff = response.staff || null;
        render();
      })
      .catch((loadError) => {
        error = loadError.message || 'Unable to load your profile.';
        showToast(error, 'error');
        render();
      });
  }

  function openPasswordModal() {
    openModal(`
      <div class="modal-card admin-profile-modal" role="dialog" aria-modal="true" aria-labelledby="swPasswordTitle">
        <div class="modal-header">
          <div class="po-modal-title-block">
            <h2 class="modal-title" id="swPasswordTitle">Change Password</h2>
          </div>
          <button type="button" class="modal-close" data-close-modal aria-label="Close password modal">&times;</button>
        </div>
        <form id="swPasswordForm" class="modal-body admin-profile-modal__form">
          <section class="admin-record-sheet admin-record-sheet--account">
            <section class="admin-record-sheet__section admin-record-sheet__section--amber">
              <div class="admin-record-sheet__section-head"><span>Social Worker</span></div>
              <div class="admin-record-sheet__grid">
                <label class="admin-record-sheet__field admin-record-sheet__field--wide">
                  <span class="admin-profile-modal__label">Current Password</span>
                  <input class="admin-profile-modal__input" type="password" name="currentPassword" required>
                </label>
                <label class="admin-record-sheet__field admin-record-sheet__field--wide">
                  <span class="admin-profile-modal__label">New Password</span>
                  <input class="admin-profile-modal__input" type="password" name="newPassword" minlength="8" required>
                </label>
                <label class="admin-record-sheet__field admin-record-sheet__field--wide">
                  <span class="admin-profile-modal__label">Confirm New Password</span>
                  <input class="admin-profile-modal__input" type="password" name="confirmPassword" minlength="8" required>
                </label>
                <div class="notice danger admin-profile-modal__notice" id="swPasswordError" hidden></div>
              </div>
            </section>
          </section>
        </form>
        <div class="modal-footer">
          <button type="button" class="app-btn-outline" data-close-modal>Back</button>
          <button type="submit" form="swPasswordForm" class="app-btn-primary">Save Password</button>
        </div>
      </div>
    `);
    document.getElementById('swPasswordForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const errorNode = document.getElementById('swPasswordError');
      const submitButton = document.querySelector('[form="swPasswordForm"]');
      submitButton.disabled = true;
      if (errorNode) {
        errorNode.hidden = true;
        errorNode.textContent = '';
      }
      const body = new URLSearchParams();
      body.set('currentPassword', String(form.currentPassword?.value || ''));
      body.set('newPassword', String(form.newPassword?.value || ''));
      body.set('confirmPassword', String(form.confirmPassword?.value || ''));
      try {
        const response = await fetch(routeUrl('account/change-password'), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
          },
          credentials: 'same-origin',
          body: body.toString(),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || !payload.ok) {
          throw new Error(payload.message || 'Unable to change password.');
        }
        showToast(payload.message || 'Password updated.', 'success');
        closeModal();
      } catch (requestError) {
        if (errorNode) {
          errorNode.hidden = false;
          errorNode.textContent = requestError.message || 'Unable to change password.';
        }
      } finally {
        submitButton.disabled = false;
      }
    });
  }

  function openModal(content) {
    const root = document.getElementById('swModalRoot');
    if (!root) return;
    const isSharedModalCard = /class=["'][^"']*\bmodal-card\b/.test(content);
    root.innerHTML = `
      <div class="sw-modal" role="dialog" aria-modal="true">
        <div class="sw-modal__backdrop" data-close-modal></div>
        ${isSharedModalCard ? content : `<div class="sw-modal__dialog">${content}</div>`}
      </div>
    `;
    root.querySelectorAll('[data-close-modal]').forEach((button) => {
      button.addEventListener('click', closeModal);
    });
  }

  function closeModal() {
    const root = document.getElementById('swModalRoot');
    if (root) root.innerHTML = '';
  }

  function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function labelize(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function initRefresh() {
    document.getElementById('swRefreshButton')?.addEventListener('click', async () => {
      await Promise.allSettled([loadApplications(), loadSupportTickets()]);
      await loadRepayments();
      renderBeneficiaries();
      showToast('Social Worker workspace refreshed.', 'success');
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSidebar();
    initAccountMenu();
    initLogout();
    initApplicationFilters();
    initBeneficiaryFilters();
    initSupport();
    initRefresh();
    renderApplications();
    renderBeneficiaries();
    renderDashboardSummary();
    setSection('dashboard');
    loadApplications();
    loadRepayments();
  });
})();

(function () {
  const authUser = window.SMARTLEAP_AUTH_USER || null;
  const baseUrl = String(window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');
  const trainingStatuses = ['Not Scheduled', 'Scheduled', 'Notified', 'Attended', 'Excused', 'Missed', 'Completed'];
  const state = { applications: [], roster: [], summary: {}, scopeBarangays: [], activeApplication: null, activePreviewToken: '', searchTimers: {}, training: { view: 'overview', programs: [], summary: {}, eligibleInvitees: [], selectedProgramId: null, activeProgram: null, lastUpdatedInviteeId: null, lastNotifiedInviteeId: null, savingProgram: false, syncingInvitees: false, sendingProgramNotice: '', removingProgramId: null, confirmRemoveProgramId: null, busyInvitees: {}, rosterSearch: '', rosterFilter: '' } };
  const routeUrl = (path) => `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    if (!authUser || !String(authUser.role || '').toLowerCase().includes('project')) {
      window.location.href = `${baseUrl}/login`;
      return;
    }
    bind();
    setText('po-identity', authUser.email ? `${authUser.name} - ${authUser.email}` : (authUser.name || 'Project Officer'));
    showSection(new URLSearchParams(window.location.search).get('section') || 'clients');
    loadDashboard();
    loadTraining();
  }

  function bind() {
    document.querySelectorAll('[data-section]').forEach((button) => button.addEventListener('click', () => { showSection(button.dataset.section || 'clients'); closeSidebar(); }));
    document.querySelector('.sidebar-toggle')?.addEventListener('click', toggleSidebar);
    document.querySelector('[data-sidebar-close]')?.addEventListener('click', closeSidebar);
    document.getElementById('po-refresh')?.addEventListener('click', async () => { await loadDashboard(); await loadTraining(); });
    document.getElementById('po-training-add-session')?.addEventListener('click', openNewTrainingSession);
    document.getElementById('po-training-refresh')?.addEventListener('click', loadTraining);
    document.getElementById('po-training-session-refresh')?.addEventListener('click', () => state.training.selectedProgramId ? loadTrainingProgram(state.training.selectedProgramId, false) : renderTrainingSessionView());
    document.getElementById('po-training-back')?.addEventListener('click', () => switchTrainingView('overview'));
    document.getElementById('po-search')?.addEventListener('input', () => debounceRender('overview-search', renderRosterTable));
    document.getElementById('po-app-search')?.addEventListener('input', () => debounceRender('application-search', renderApplicationsTable));
    document.getElementById('po-app-filter')?.addEventListener('change', renderApplicationsTable);
    document.getElementById('po-logout')?.addEventListener('click', handleLogout);
    document.querySelector('#po-table tbody')?.addEventListener('click', handleApplicationClick);
    document.querySelector('#po-app-table tbody')?.addEventListener('click', handleApplicationClick);
    document.getElementById('poApplicationModal')?.addEventListener('click', handleReviewClick);
    document.getElementById('po-app-modal-flag')?.addEventListener('click', () => submitApplicationDecision('flag'));
    document.getElementById('po-app-modal-correct')?.addEventListener('click', () => submitApplicationDecision('needs_correction'));
    document.getElementById('po-app-modal-reject')?.addEventListener('click', () => submitApplicationDecision('reject'));
    document.getElementById('po-app-modal-approve')?.addEventListener('click', openApprovalSummary);
    document.getElementById('po-summary-confirm')?.addEventListener('click', async () => { bootstrap.Modal.getOrCreateInstance(document.getElementById('poApprovalSummaryModal')).hide(); await submitApplicationDecision('approve'); });
    document.getElementById('training-section')?.addEventListener('click', handleTrainingClick);
    document.getElementById('training-section')?.addEventListener('submit', handleTrainingSubmit);
    document.getElementById('training-section')?.addEventListener('input', handleTrainingInput);
    document.getElementById('training-section')?.addEventListener('change', handleTrainingInput);
  }

  function toggleSidebar() {
    const shell = document.getElementById('mainSystem');
    const next = shell?.dataset.sidebarOpen !== 'true';
    if (shell) shell.dataset.sidebarOpen = next ? 'true' : 'false';
    document.querySelector('.sidebar-toggle')?.setAttribute('aria-expanded', next ? 'true' : 'false');
  }

  function closeSidebar() {
    const shell = document.getElementById('mainSystem');
    if (shell) shell.dataset.sidebarOpen = 'false';
    document.querySelector('.sidebar-toggle')?.setAttribute('aria-expanded', 'false');
  }

  function showSection(section) {
    const allowedSections = new Set(['clients', 'applications', 'training']);
    const nextSection = allowedSections.has(section) ? section : 'clients';
    if (nextSection === 'training') switchTrainingView('overview');
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === nextSection));
    document.querySelectorAll('[data-role-section]').forEach((panel) => { panel.style.display = panel.id === `${nextSection}-section` ? 'block' : 'none'; });
    const url = new URL(window.location.href);
    url.searchParams.set('section', nextSection);
    window.history.replaceState({}, '', url.toString());
  }

  async function apiGet(path, params = {}) {
    const query = new URLSearchParams(params);
    const url = query.toString() ? `${routeUrl(path)}?${query}` : routeUrl(path);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin' });
      return await parseJson(response);
    } catch (error) {
      return { ok: false, message: 'Unable to reach the server right now.' };
    }
  }

  async function apiPost(path, payload) {
    const body = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => Array.isArray(value) ? value.forEach((item) => body.append(`${key}[]`, item)) : body.append(key, value ?? ''));
    try {
      const response = await fetch(routeUrl(path), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, credentials: 'same-origin', body: body.toString() });
      return await parseJson(response);
    } catch (error) {
      return { ok: false, message: 'Unable to reach the server right now.' };
    }
  }

  async function apiFormPost(path, formData) {
    try {
      const response = await fetch(routeUrl(path), {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        body: formData,
      });
      return await parseJson(response);
    } catch (error) {
      return { ok: false, message: 'Unable to reach the server right now.' };
    }
  }

  async function apiJsonPost(path, payload) {
    try {
      const response = await fetch(routeUrl(path), { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json;charset=UTF-8' }, credentials: 'same-origin', body: JSON.stringify(payload || {}) });
      return await parseJson(response);
    } catch (error) {
      return { ok: false, message: 'Unable to reach the server right now.' };
    }
  }

  async function parseJson(response) {
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) return { ok: false, message: response.status === 401 ? 'Your session has expired. Please sign in again.' : 'Unexpected server response.' };
    return response.json();
  }

  async function loadDashboard() {
    const response = await apiGet('api/applications/dashboard');
    if (!response.ok) return renderLoadError(response.message || 'Unable to load the project officer dashboard.');
    state.applications = response.data?.applications || [];
    state.roster = response.data?.roster || [];
    state.summary = response.data?.summary || {};
    state.scopeBarangays = response.data?.scopeBarangays || [];
    const scopeText = state.scopeBarangays.length ? state.scopeBarangays.map((item) => item.name).join(', ') : 'No assigned barangays';
    setText('poSummaryClients', String(state.summary.applications || 0));
    setText('poSummaryApplications', String(state.summary.pending || 0));
    setText('poSummaryReady', String(state.applications.filter((item) => ['Checked by PDO', 'Requirements Verified', 'For Assessment', 'Approved', 'Approved for Training'].includes(item.status)).length));
    setText('poHeaderBarangays', scopeText);
    setText('poHeaderScope', `${state.roster.length} scoped applicant${state.roster.length === 1 ? '' : 's'}`);
    const barangayList = document.getElementById('poBarangayList');
    if (barangayList) barangayList.innerHTML = state.scopeBarangays.length ? state.scopeBarangays.map((item) => `<span class="po-mini-chip">${escapeHtml(item.name)}</span>`).join('') : '<span class="po-mini-chip">No assignments yet</span>';
    renderAttentionStrip();
    renderRosterTable();
    renderApplicationsTable();
    renderPriorityQueueCards();
  }

  function renderLoadError(message) {
    const roster = document.querySelector('#po-table tbody');
    const applications = document.querySelector('#po-app-table tbody');
    if (roster) roster.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${escapeHtml(message)}</td></tr>`;
    if (applications) applications.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${escapeHtml(message)}</td></tr>`;
  }

  function renderAttentionStrip() {
    const root = document.getElementById('poAttentionStrip');
    if (!root) return;
    const priorities = state.applications
      .slice()
      .sort((left, right) => priorityWeight(right) - priorityWeight(left) || toTime(left.submittedAt) - toTime(right.submittedAt))
      .slice(0, 3);
    root.innerHTML = priorities.length
      ? priorities.map((item) => `<article class="po-attention-card"><div class="po-attention-card__meta"><strong>${escapeHtml(item.applicantName || '--')}</strong><span>${escapeHtml(item.barangay || '--')}</span></div><div class="po-attention-card__status"><span class="po-status-pill po-status-pill--workflow ${statusClass(item.status)}">${escapeHtml(item.status || '--')}</span><span class="po-status-pill po-status-pill--readiness ${readinessBadgeClass(item.status)}">${escapeHtml(readinessLabel(item.status))}</span></div><button type="button" class="action-button po-case-action" data-open-application="${item.id}"><i class="fas fa-folder-open"></i><span>Open Review</span></button></article>`).join('')
      : '<div class="po-empty">No priority cases loaded.</div>';
  }

  function renderRosterTable() {
    const tbody = document.querySelector('#po-table tbody');
    if (!tbody) return;
    const search = String(document.getElementById('po-search')?.value || '').toLowerCase();
    const filtered = state.roster.filter((item) => rosterMatchesSearch(item, search));
    tbody.innerHTML = filtered.map((item) => `<tr class="po-table-row po-table-row--clickable" data-open-application="${item.id}"><td><div class="po-application-identity"><div class="table-primary">${escapeHtml(item.name || '--')}</div><div class="table-secondary">${escapeHtml(item.businessName || 'No business name recorded')}</div><div class="table-tertiary">${escapeHtml(item.email || item.contactNumber || 'No secondary detail')}</div></div></td><td><div class="po-location-cell"><strong>${escapeHtml(item.barangay || '--')}</strong><span>${escapeHtml(item.address || 'Assigned barangay')}</span></div></td><td><span class="po-status-pill po-status-pill--workflow ${statusClass(item.status)}">${escapeHtml(item.status || 'Pending')}</span></td><td><span class="po-status-pill po-status-pill--readiness ${readinessBadgeClass(item.status)}">${escapeHtml(readinessLabel(item.status))}</span></td><td><div class="po-date-cell"><strong>${formatDate(item.updatedAt || item.lastUpdatedAt || item.submittedAt)}</strong><span>latest case update</span></div></td><td class="text-end"><button type="button" class="action-button" data-open-application="${item.id}"><i class="fas fa-folder-open"></i><span>Open</span></button></td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">No scoped applicants found.</td></tr>';
    setText('poRosterCount', `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`);
  }

  function renderApplicationsTable() {
    const tbody = document.querySelector('#po-app-table tbody');
    if (!tbody) return;
    const filter = String(document.getElementById('po-app-filter')?.value || '');
    const search = String(document.getElementById('po-app-search')?.value || '').toLowerCase();
    const filtered = state.applications.filter((item) => (!filter || item.status === filter) && applicationMatchesSearch(item, search));
    tbody.innerHTML = filtered.map((item) => `<tr><td><div class="po-application-identity"><div class="table-primary">${escapeHtml(item.applicantName)}</div><div class="table-secondary">${escapeHtml(item.businessName || 'No business name recorded')}</div><div class="table-tertiary">${escapeHtml(item.email || item.contactNumber || '--')}</div></div></td><td><div class="po-location-cell"><strong>${escapeHtml(item.barangay || '--')}</strong><span>${escapeHtml(item.contactNumber || 'No contact number')}</span></div></td><td><div class="po-progress-cell"><strong>${item.verifiedRequirementCount || 0} / ${item.requiredRequirementCount || 0}</strong><span>verified of required requirements</span></div></td><td><span class="po-status-pill po-status-pill--workflow ${statusClass(item.status)}">${escapeHtml(item.status || '--')}</span></td><td><span class="po-status-pill po-status-pill--readiness ${readinessBadgeClass(item.status)}">${escapeHtml(readinessLabel(item.status))}</span></td><td><div class="po-date-cell"><strong>${formatDate(item.submittedAt)}</strong><span>submission date</span></div></td><td class="text-end"><button type="button" class="action-button po-case-action" data-open-application="${item.id}"><i class="fas fa-folder-open"></i><span>Open Review</span></button></td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">No scoped applications found.</td></tr>';
    setText('po-app-count', `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`);
    setText('po-app-ready-count', `${filtered.filter((item) => readinessLabel(item.status) === 'Ready').length} cases`);
    setText('po-app-attention-count', `${filtered.filter((item) => ['Needs Documents', 'Needs Correction', 'Training Pending', 'Under Review'].includes(readinessLabel(item.status))).length} cases`);
    setText('po-app-table-caption', filter ? `${filter} queue` : 'Queue review list');
  }

  function renderPriorityQueue() {
    const queue = document.getElementById('poPriorityQueue');
    if (!queue) return;
    const priorities = state.applications.slice().sort((a, b) => toTime(a.submittedAt) - toTime(b.submittedAt)).slice(0, 5);
    queue.innerHTML = priorities.length ? priorities.map((item) => `<li class="po-queue-item"><strong>${escapeHtml(item.applicantName)}</strong><span>${escapeHtml(item.barangay || '--')}</span><small>${escapeHtml(item.status || '--')} • Submitted ${formatDate(item.submittedAt)}</small></li>`).join('') : '<li class="po-empty">No applications loaded yet.</li>';
  }

  function renderPriorityQueueCards() {
    const queue = document.getElementById('poPriorityQueue');
    if (!queue) return;
    const priorities = state.applications.slice().sort((a, b) => toTime(a.submittedAt) - toTime(b.submittedAt)).slice(0, 5);
    queue.innerHTML = priorities.length
      ? priorities.map((item) => `<li class="po-queue-item"><div class="po-queue-item__header"><strong>${escapeHtml(item.applicantName)}</strong><span class="po-status-pill ${readinessBadgeClass(item.status)}">${escapeHtml(readinessLabel(item.status))}</span></div><span>${escapeHtml(item.barangay || '--')}</span><small>${escapeHtml(item.status || '--')} • Submitted ${formatDate(item.submittedAt)}</small><button type="button" class="action-button po-queue-action" data-open-application="${item.id}"><i class="fas fa-folder-open"></i><span>Open Review</span></button></li>`).join('')
      : '<li class="po-empty">No applications loaded yet.</li>';
  }

  async function handleApplicationClick(event) {
    const button = event.target.closest('[data-open-application]');
    if (!button) return;
    const response = await apiGet('api/applications/show', { id: Number(button.dataset.openApplication) });
    if (!response.ok || !response.application) return showToast(response.message || 'Unable to load the application.', 'warning');
    state.activeApplication = response.application;
    renderApplicationModal();
    bootstrap.Modal.getOrCreateInstance(document.getElementById('poApplicationModal')).show();
  }

  function renderApplicationModal() {
    const app = state.activeApplication;
    const ready = app.approvalReadiness || {};
    setText('po-app-modal-applicant', app.applicantName || '--');
    setText('po-app-modal-submitted', formatDate(app.submittedAt));
    setText('po-app-modal-status', app.status || '--');
    setStatusChipClass('po-app-modal-status', app.status);
    setText('po-app-modal-barangay', app.barangay || '--');
    setText('po-app-modal-business', app.businessName || '--');
    setText('po-app-modal-contact', app.contactNumber || app.email || '--');
    setText('po-app-modal-sector', app.sector || '--');
    setText('po-app-modal-livelihood', app.livelihood || '--');
    setText('po-app-readiness-status', ready.overallStatus || 'Under Review');
    setText('po-app-upload-summary', `${ready.uploadSummary?.approved || 0} / ${ready.uploadSummary?.total || 0}`);
    setText('po-app-form-summary', `${ready.formSummary?.approved || 0} / ${ready.formSummary?.total || 0}`);
    setText('po-app-training-status', ready.trainingStatus?.status || '--');
    setText('po-app-training-chip', ready.trainingStatus?.completed ? 'Training Completed' : 'Training Pending');
    setStatusChipClass('po-app-training-chip', ready.trainingStatus?.completed ? 'Completed' : 'Pending');
    setText('po-upload-review-count', formatRequirementCount(app.requirements || []));
    setText('po-form-review-count', formatRequirementCount(app.formRequirements || []));
    setText('po-review-total-count', formatRequirementCount([...(app.requirements || []), ...(app.formRequirements || [])]));
    const blockerList = document.getElementById('po-app-readiness-blockers');
    if (blockerList) blockerList.innerHTML = (ready.blockers || []).length
      ? ready.blockers.map((item) => `<li class="po-blocker-item"><span class="po-blocker-item__icon" aria-hidden="true">!</span><span>${escapeHtml(item)}</span></li>`).join('')
      : '<li class="po-blocker-item po-blocker-item--clear"><span class="po-blocker-item__icon" aria-hidden="true">OK</span><span>Ready for approval action. No blocking reasons recorded.</span></li>';
    setText('po-decision-status-note', ready.canApprove ? 'Application is ready for approval.' : 'Approval is currently blocked.');
    setText('po-decision-blocker-note', ready.canApprove
      ? 'All required upload requirements, fill-up form requirements, and training conditions are satisfied.'
      : ((ready.blockers || []).slice(0, 2).join(' | ') || 'Resolve any blocking requirement or training issue before approval.'));
    const approveButton = document.getElementById('po-app-modal-approve');
    if (approveButton) approveButton.disabled = !ready.canApprove;
    ensureActivePreview(app);
    renderRequirementNavigator();
    renderPreviewPanel();
    renderRequirementInspector();
    const remarks = document.getElementById('po-app-modal-remarks');
    if (remarks) remarks.value = '';
  }

  function formatRequirementCount(items) {
    const total = items.length || 0;
    return `${total} ${total === 1 ? 'item' : 'items'}`;
  }

  function renderRequirementTable(selector, items, kind) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;
    tbody.innerHTML = items.map((item) => {
      const itemKey = String(kind === 'upload' ? item.key : item.id);
      const previewToken = `${kind}:${itemKey}`;
      const statusLabel = requirementStatusLabel(item.status);
      const collapseStaffRemarks = statusLabel === 'Approved';
      const staffRemarksField = collapseStaffRemarks
        ? `<details class="po-staff-note-toggle"><summary>${escapeHtml(item.reviewerRemarks ? 'View internal note' : 'Add internal note')}</summary><textarea class="po-inline-remarks" data-${kind}-staff-remarks="${escapeHtml(itemKey)}" rows="2" placeholder="Internal note for staff only.">${escapeHtml(item.reviewerRemarks || '')}</textarea></details>`
        : `<textarea class="po-inline-remarks" data-${kind}-staff-remarks="${escapeHtml(itemKey)}" rows="2" placeholder="Internal note for staff only.">${escapeHtml(item.reviewerRemarks || '')}</textarea>`;

      return `<tr class="${state.activePreviewToken === previewToken ? 'is-previewing' : ''}"><td><strong>${escapeHtml(item.label || '--')}</strong></td><td>${escapeHtml(item.typeLabel || '--')}</td><td><span class="po-status-pill ${kind === 'upload' ? (item.file?.url ? 'is-info' : 'is-danger') : (['submitted', 'verified', 'rejected', 'needs correction'].includes(String(item.status || '').toLowerCase()) ? 'is-info' : 'is-danger')}">${escapeHtml(kind === 'upload' ? (item.file?.url ? 'Submitted' : 'Missing') : (['submitted', 'verified', 'rejected', 'needs correction'].includes(String(item.status || '').toLowerCase()) ? 'Submitted' : 'Missing'))}</span></td><td><span class="po-status-pill ${requirementStatusClass(item.status)}">${escapeHtml(statusLabel)}</span></td><td>${staffRemarksField}</td><td><textarea class="po-inline-remarks" data-${kind}-applicant-remarks="${escapeHtml(itemKey)}" rows="2" placeholder="Shown to the applicant when needed."></textarea></td><td>${(kind === 'upload' ? item.file?.url : item.reviewUrl) ? `<div class="po-open-actions"><button type="button" class="action-button action-button--quiet ${state.activePreviewToken === previewToken ? 'is-active' : ''}" data-open-preview="${escapeHtml(previewToken)}">Preview</button>${kind === 'upload' ? `<a class="action-link" href="${escapeHtml(item.file.url)}" target="_blank" rel="noopener">New tab</a>` : `<a class="action-link" href="${escapeHtml(item.reviewUrl)}" target="_blank" rel="noopener">New tab</a>`}</div>` : '<span class="muted-cell">Unavailable</span>'}</td><td class="actions"><div class="table-actions"><button type="button" class="action-button" data-review-${kind}="${escapeHtml(itemKey)}" data-decision="approve">Approve</button><button type="button" class="action-button action-button--danger" data-review-${kind}="${escapeHtml(itemKey)}" data-decision="reject">Reject</button></div></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="text-center text-muted">No requirements found.</td></tr>';
  }

  function ensureActivePreview(app) {
    if (resolvePreviewItem(state.activePreviewToken, app)) return;
    const firstUpload = (app.requirements || []).find((item) => item.file?.url);
    if (firstUpload) {
      state.activePreviewToken = `upload:${String(firstUpload.key)}`;
      return;
    }
    const firstForm = (app.formRequirements || []).find((item) => item.reviewUrl);
    state.activePreviewToken = firstForm ? `form:${String(firstForm.id)}` : '';
  }

  function resolvePreviewItem(token, app = state.activeApplication) {
    if (!token || !app) return null;
    const [kind, rawId] = String(token).split(':');
    if (kind === 'upload') return (app.requirements || []).find((item) => String(item.key) === rawId) ? { kind, item: (app.requirements || []).find((item) => String(item.key) === rawId) } : null;
    if (kind === 'form') return (app.formRequirements || []).find((item) => String(item.id) === rawId) ? { kind, item: (app.formRequirements || []).find((item) => String(item.id) === rawId) } : null;
    return null;
  }

  function renderPreviewPanel() {
    const root = document.getElementById('po-app-preview');
    if (!root) return;
    const preview = resolvePreviewItem(state.activePreviewToken);
    if (!preview) {
      setText('po-preview-title', 'Select a requirement');
      setText('po-preview-chip', 'No preview');
      root.innerHTML = '<div class="po-preview-empty">Select an uploaded requirement or fill-up form to review it here.</div>';
      return;
    }

    const item = preview.item;
    const submittedLabel = preview.kind === 'upload' ? (item.file?.name || item.label || '--') : (item.label || '--');
    setText('po-preview-title', submittedLabel);
    setText('po-preview-chip', preview.kind === 'upload' ? 'Upload Requirement' : 'Fill-up Form Requirement');

    if (preview.kind === 'upload') {
      const url = item.file?.url || '';
      const mime = String(item.file?.type || '').toLowerCase();
      if (!url) {
        root.innerHTML = '<div class="po-preview-empty">No file was submitted for this requirement.</div>';
        return;
      }
      if (mime.startsWith('image/')) {
        root.innerHTML = `<div class="po-preview-frame po-preview-frame--image"><img src="${escapeHtml(url)}" alt="${escapeHtml(item.label || 'Requirement preview')}"></div>`;
        return;
      }
      if (mime.includes('pdf') || mime.startsWith('text/')) {
        root.innerHTML = `<div class="po-preview-frame"><iframe src="${escapeHtml(url)}" title="${escapeHtml(item.label || 'Requirement preview')}"></iframe></div>`;
        return;
      }
      root.innerHTML = `<div class="po-preview-file-card"><strong>${escapeHtml(item.file?.name || item.label || 'Requirement file')}</strong><span>${escapeHtml(item.file?.type || 'File preview is not available in-panel.')}</span><a class="action-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open file</a></div>`;
      return;
    }

    if (!item.reviewUrl) {
      root.innerHTML = '<div class="po-preview-empty">Form preview is not available for this requirement.</div>';
      return;
    }
    root.innerHTML = `<div class="po-native-form-preview"><div class="po-preview-loading">Loading form…</div><iframe class="po-native-form-loader" src="${escapeHtml(item.reviewUrl)}" title="${escapeHtml(item.label || 'Fill-up form review')}"></iframe><div class="po-native-form-content"></div></div>`;
    hydrateNativeFormPreview(root, item.reviewUrl, state.activePreviewToken);
  }

  function hydrateNativeFormPreview(root, url, token) {
    const iframe = root.querySelector('.po-native-form-loader');
    const content = root.querySelector('.po-native-form-content');
    const loading = root.querySelector('.po-preview-loading');
    if (!iframe || !content || !loading) return;
    iframe.addEventListener('load', () => {
      window.setTimeout(() => {
        if (state.activePreviewToken !== token) return;
        try {
          const doc = iframe.contentDocument;
          const applicantCard = doc?.querySelector('#reviewApplicantCard');
          const applicantSections = doc?.querySelector('#reviewApplicantSections');
          if (!applicantSections) {
            loading.textContent = 'Unable to render this form in-panel.';
            return;
          }
          content.innerHTML = `${applicantCard?.innerHTML ? `<div class="applicant-card">${applicantCard.innerHTML}</div>` : ''}<div class="workspace-sections">${applicantSections.innerHTML}</div>`;
          loading.remove();
          iframe.remove();
        } catch (error) {
          loading.textContent = 'Unable to render this form in-panel.';
        }
      }, 60);
    }, { once: true });
  }

  function requirementSubmissionLabel(kind, item) {
    if (kind === 'upload') return item.file?.url ? 'Submitted' : 'Missing';
    return ['submitted', 'verified', 'rejected', 'needs correction'].includes(String(item.status || '').toLowerCase()) ? 'Submitted' : 'Missing';
  }

  function requirementSubmissionClass(kind, item) {
    return requirementSubmissionLabel(kind, item) === 'Submitted' ? 'is-info' : 'is-danger';
  }

  function getReviewItems(app = state.activeApplication) {
    if (!app) return [];
    return [
      ...(app.requirements || []).map((item) => ({ token: `upload:${String(item.key)}`, kind: 'upload', item })),
      ...(app.formRequirements || []).map((item) => ({ token: `form:${String(item.id)}`, kind: 'form', item })),
    ];
  }

  function renderRequirementNavigator() {
    const root = document.getElementById('po-requirement-nav');
    if (!root) return;
    const items = getReviewItems();
    if (!items.length) {
      root.innerHTML = '<div class="po-preview-empty">No requirements loaded.</div>';
      return;
    }
    root.innerHTML = items.map(({ token, kind, item }) => {
      const selected = state.activePreviewToken === token;
      return `<button type="button" class="po-requirement-card ${selected ? 'is-active' : ''}" data-select-requirement="${escapeHtml(token)}"><div class="po-requirement-card__top"><strong>${escapeHtml(item.label || '--')}</strong><span class="po-status-pill ${requirementStatusClass(item.status)}">${escapeHtml(requirementStatusLabel(item.status))}</span></div><div class="po-requirement-card__meta"><span>${escapeHtml(item.typeLabel || '--')}</span><span class="po-status-pill ${requirementSubmissionClass(kind, item)}">${escapeHtml(requirementSubmissionLabel(kind, item))}</span></div></button>`;
    }).join('');
  }

  function renderRequirementInspector() {
    const root = document.getElementById('po-review-inspector');
    if (!root) return;
    const preview = resolvePreviewItem(state.activePreviewToken);
    if (!preview) {
      setText('po-inspector-title', 'Select a requirement');
      setText('po-inspector-chip', 'No selection');
      root.innerHTML = '<div class="po-preview-empty">Select a requirement from the navigator to review it.</div>';
      return;
    }
    const { kind, item } = preview;
    const itemKey = String(kind === 'upload' ? item.key : item.id);
    const statusLabel = requirementStatusLabel(item.status);
    setText('po-inspector-title', item.label || 'Requirement');
    setText('po-inspector-chip', item.typeLabel || '--');
    root.innerHTML = `<div class="po-inspector-summary"><div class="po-inspector-summary__row"><span>Submission State</span><strong><span class="po-status-pill ${requirementSubmissionClass(kind, item)}">${escapeHtml(requirementSubmissionLabel(kind, item))}</span></strong></div><div class="po-inspector-summary__row"><span>Requirement Status</span><strong><span class="po-status-pill ${requirementStatusClass(item.status)}">${escapeHtml(statusLabel)}</span></strong></div></div><label class="po-inspector-field"><span>Staff Remarks</span><textarea class="po-inline-remarks" data-${kind}-staff-remarks="${escapeHtml(itemKey)}" rows="4" placeholder="Internal note for staff only.">${escapeHtml(item.reviewerRemarks || '')}</textarea></label><label class="po-inspector-field"><span>Applicant-visible Remark</span><textarea class="po-inline-remarks" data-${kind}-applicant-remarks="${escapeHtml(itemKey)}" rows="4" placeholder="Shown to the applicant when needed."></textarea></label><div class="po-inspector-links">${(kind === 'upload' ? item.file?.url : item.reviewUrl) ? `${kind === 'upload' ? `<a class="action-link" href="${escapeHtml(item.file.url)}" target="_blank" rel="noopener">Open file in new tab</a>` : `<a class="action-link" href="${escapeHtml(item.reviewUrl)}" target="_blank" rel="noopener">Open form in new tab</a>`}` : '<span class="muted-cell">No external preview available.</span>'}</div><div class="po-inspector-actions"><button type="button" class="action-button" data-review-${kind}="${escapeHtml(itemKey)}" data-decision="approve">Approve Requirement</button><button type="button" class="action-button action-button--danger" data-review-${kind}="${escapeHtml(itemKey)}" data-decision="reject">Reject Requirement</button></div>`;
  }

  async function handleReviewClick(event) {
    const select = event.target.closest('[data-select-requirement]');
    if (select) {
      state.activePreviewToken = select.dataset.selectRequirement || '';
      renderRequirementNavigator();
      renderPreviewPanel();
      renderRequirementInspector();
      return;
    }
    const preview = event.target.closest('[data-open-preview]');
    if (preview) {
      state.activePreviewToken = preview.dataset.openPreview || '';
      renderRequirementNavigator();
      renderPreviewPanel();
      renderRequirementInspector();
      return;
    }
    const upload = event.target.closest('[data-review-upload]');
    if (upload) return reviewUpload(upload.dataset.reviewUpload, upload.dataset.decision);
    const form = event.target.closest('[data-review-form]');
    if (form) return reviewForm(Number(form.dataset.reviewForm), form.dataset.decision);
  }

  async function reviewUpload(requirementKey, decision) {
    const staffRemarks = String(document.querySelector(`[data-upload-staff-remarks="${cssEscape(requirementKey)}"]`)?.value || '').trim();
    const applicantRemark = String(document.querySelector(`[data-upload-applicant-remarks="${cssEscape(requirementKey)}"]`)?.value || '').trim();
    if (decision === 'reject' && !applicantRemark) return showToast('Applicant-visible remark is required when rejecting a requirement.', 'warning');
    const response = await apiPost('api/applications/review-requirement', {
      applicationId: state.activeApplication.id,
      requirementKey,
      decision,
      staffRemarks,
      applicantRemark,
    });
    await refreshAfterReview(response, 'Unable to save the requirement review.');
  }

  async function reviewForm(taskId, decision) {
    const staffRemarks = String(document.querySelector(`[data-form-staff-remarks="${taskId}"]`)?.value || '').trim();
    const applicantVisibleRemark = String(document.querySelector(`[data-form-applicant-remarks="${taskId}"]`)?.value || '').trim();
    if (decision === 'reject' && !applicantVisibleRemark) return showToast('Applicant-visible remark is required when rejecting a requirement.', 'warning');
    const response = await apiJsonPost('api/post-approval-review/review', {
      taskId,
      status: decision === 'approve' ? 'Verified' : 'Rejected',
      remarks: staffRemarks,
      applicantVisibleRemark,
      staffForm: {},
    });
    if (!response.ok) return showToast(firstError(response.errors) || response.message || 'Unable to save the form review.', 'warning');
    await refreshActiveApplication();
  }

  async function refreshAfterReview(response, fallbackMessage) {
    if (!response.ok) return showToast(firstError(response.errors) || response.message || fallbackMessage, 'warning');
    if (response.application) {
      state.activeApplication = response.application;
      renderApplicationModal();
    } else {
      await refreshActiveApplication();
    }
    await loadDashboard();
  }

  async function refreshActiveApplication() {
    if (!state.activeApplication?.id) return;
    const response = await apiGet('api/applications/show', { id: state.activeApplication.id });
    if (response.ok && response.application) {
      state.activeApplication = response.application;
      renderApplicationModal();
    }
    await loadDashboard();
  }

  function openApprovalSummary() {
    if (!state.activeApplication) return;
    const ready = state.activeApplication.approvalReadiness || {};
    setText('po-summary-applicant', state.activeApplication.applicantName || 'Applicant');
    setText('po-summary-barangay', state.activeApplication.barangay || '--');
    setText('po-summary-upload', `${ready.uploadSummary?.approved || 0} / ${ready.uploadSummary?.total || 0}`);
    setText('po-summary-form', `${ready.formSummary?.approved || 0} / ${ready.formSummary?.total || 0}`);
    setText('po-summary-training', ready.trainingStatus?.status || '--');
    setText('po-summary-readiness-text', ready.canApprove ? 'All required application requirements and training conditions are satisfied.' : `Approval cannot proceed. ${(ready.blockers || []).join(' • ') || 'Readiness is incomplete.'}`);
    const list = document.getElementById('po-summary-checklist');
    if (list) {
      list.innerHTML = [
        ...(state.activeApplication.requirements || []).map((item) => `<li>${escapeHtml(item.label)}: ${escapeHtml(requirementStatusLabel(item.status))}</li>`),
        ...(state.activeApplication.formRequirements || []).map((item) => `<li>${escapeHtml(item.label)}: ${escapeHtml(requirementStatusLabel(item.status))}</li>`),
        `<li>Training: ${escapeHtml(ready.trainingStatus?.status || '--')}</li>`,
      ].join('');
    }
    const confirm = document.getElementById('po-summary-confirm');
    if (confirm) confirm.disabled = !ready.canApprove;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('poApprovalSummaryModal')).show();
  }

  async function submitApplicationDecision(decision) {
    if (!state.activeApplication) return;
    const response = await apiPost('api/applications/review', { applicationId: state.activeApplication.id, decision, remarks: document.getElementById('po-app-modal-remarks')?.value || '' });
    if (!response.ok) return showToast(firstError(response.errors) || response.message || 'Unable to update the application.', 'warning');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('poApplicationModal')).hide();
    await loadDashboard();
    await loadTraining();
  }

  async function loadTraining() {
    const response = await apiGet('api/training');
    if (!response.ok) return renderTrainingError(response.message || 'Unable to load training records.');
    state.training.programs = response.data?.programs || [];
    state.training.summary = response.data?.summary || {};
    state.training.eligibleInvitees = response.data?.eligibleInvitees || [];
    setText('poSummaryTraining', String(state.training.summary.total || state.training.programs.length || 0));
    setText('po-training-program-count', `${state.training.programs.length} ${state.training.programs.length === 1 ? 'program' : 'programs'}`);
    if (!state.training.programs.some((item) => item.id === state.training.selectedProgramId)) {
      state.training.selectedProgramId = null;
      state.training.activeProgram = null;
      state.training.view = 'overview';
    }
    if (state.training.view === 'session' && state.training.selectedProgramId) {
      renderTrainingOverview();
      return loadTrainingProgram(state.training.selectedProgramId, false);
    }
    renderTrainingOverview();
  }

  async function loadTrainingProgram(programId, showError = true) {
    const response = await apiGet('api/training/show', { id: programId });
    if (!response.ok) {
      if (showError) renderTrainingError(response.message || 'Unable to load training program detail.');
      return;
    }
    state.training.selectedProgramId = programId;
    state.training.activeProgram = response.program || null;
    switchTrainingView('session');
  }

  function renderTrainingOverview() {
    switchTrainingView('overview', false);
    syncTrainingOverviewActions();
    renderTrainingSummary();
    renderTrainingQueue();
  }

  function syncTrainingOverviewActions() {
    const addButton = document.getElementById('po-training-add-session');
    if (addButton) addButton.disabled = state.training.savingProgram && state.training.activeProgram?.isDraft;
  }

  function renderTrainingSummary() {
    const s = state.training.summary || {};
    const root = document.getElementById('po-training-summary');
    if (!root) return;
    root.innerHTML = `<article class="po-training-card"><span>Programs</span><strong>${s.total || 0}</strong></article><article class="po-training-card"><span>Participants</span><strong>${s.participants || 0}</strong></article><article class="po-training-card"><span>Attended</span><strong>${s.attended || 0}</strong></article><article class="po-training-card"><span>Excused</span><strong>${s.excused || 0}</strong></article><article class="po-training-card"><span>Completed</span><strong>${s.completed || 0}</strong></article>`;
  }

  function renderTrainingQueue() {
    const root = document.getElementById('po-training-program-list');
    if (!root) return;
    root.innerHTML = state.training.programs.map((program) => {
      const confirmingRemove = state.training.confirmRemoveProgramId === program.id;
      const removing = state.training.removingProgramId === program.id;
      return `<article class="po-training-program-card ${state.training.selectedProgramId === program.id ? 'is-active' : ''}"><div class="po-training-program-card__top"><strong>${escapeHtml(program.programName || '--')}</strong><span class="po-status-pill ${statusClass(program.status)}">${escapeHtml(program.status || '--')}</span></div><div class="po-training-program-card__details"><div class="po-training-program-card__detail"><span>Date</span><strong>${escapeHtml(formatDate(program.date || program.startsAt))}</strong></div><div class="po-training-program-card__detail"><span>Venue</span><strong>${escapeHtml(program.venue || '--')}</strong></div><div class="po-training-program-card__detail"><span>Coverage</span><strong>${escapeHtml(trainingModeLabel(program.trainingMode))}</strong></div><div class="po-training-program-card__detail"><span>Participant Count</span><strong>${escapeHtml(`${program.participantCount || 0}`)}</strong></div><div class="po-training-program-card__detail"><span>Speaker</span><strong>${escapeHtml(program.speaker || '--')}</strong></div></div><div class="po-training-program-card__actions"><button type="button" class="action-button po-case-action" data-training-open="${program.id}" ${removing ? 'disabled' : ''}>Open Session</button><button type="button" class="action-button action-button--danger" data-training-remove="${program.id}" ${removing ? 'disabled' : ''}>${removing ? 'Removing...' : (confirmingRemove ? 'Confirm Remove' : 'Remove Session')}</button></div></article>`;
    }).join('') || '<div class="po-empty">No scoped training programs found.</div>';
  }

  function renderTrainingSessionView() {
    const root = document.getElementById('po-training-program-detail');
    if (!root) return;
    const program = state.training.activeProgram;
    if (!program) {
      root.innerHTML = '<div class="po-empty">Open a session to review details, notices, and attendance.</div>';
      return;
    }
    const invitees = program.invitees || [];
    root.innerHTML = `<div class="po-training-detail-shell">${buildTrainingSessionHeader(program, invitees)}<form id="po-training-session-form" class="po-training-session-form" data-program-id="${program.id || ''}">${buildSessionSetup(program, invitees)}${buildParticipantEssentials(program)}<div class="po-training-session-actions"><button type="submit" class="action-button po-case-action" data-training-save-program ${state.training.savingProgram ? 'disabled' : ''}>${state.training.savingProgram ? (program.isDraft ? 'Creating Session...' : 'Saving Session Details...') : 'Save Session Details'}</button></div></form>${program.isDraft ? buildDraftSessionNotice() : `${buildParticipantAssignment(program, invitees)}${buildAnnouncementPanel(program, invitees)}${buildTrainingSessionRosterSummary(invitees)}${buildParticipantRoster(invitees)}`}</div>`;
  }

  function buildTrainingSessionHeader(program, invitees) {
    return `<section class="po-training-session-hero"><div class="po-training-session-hero__head"><div><span class="po-panel-label">Selected Session</span><h3>${escapeHtml(program.programName || 'New Training Session')}</h3><p>${escapeHtml(formatDate(program.date || program.startsAt))} • ${escapeHtml(program.venue || '--')}</p></div><span class="po-status-pill ${statusClass(program.status)}">${escapeHtml(program.status || 'Scheduled')}</span></div><div class="po-training-session-hero__meta"><div><span>Date</span><strong>${escapeHtml(formatDate(program.date || program.startsAt))}</strong></div><div><span>Venue / Place</span><strong>${escapeHtml(program.venue || '--')}</strong></div><div><span>Speaker / Facilitator</span><strong>${escapeHtml(program.speaker || '--')}</strong></div><div><span>Mode</span><strong>${escapeHtml(trainingModeLabel(program.trainingMode))}</strong></div><div><span>Participant Count</span><strong>${escapeHtml(String(invitees.length))}</strong></div></div></section>`;
  }

  function buildSessionSetup(program, invitees) {
    const trainingMode = program.trainingMode || 'all';
    const batchNote = trainingMode === 'batch'
      ? `Batch mode auto-sorts selected participants into 3 groups of up to 85 each, regardless of barangay.`
      : 'All mode can include the full SMART LEAP roster without a training cap.';
    return `<section class="po-training-work-block"><div class="po-training-work-block__header"><div><span class="po-panel-label">Session Setup</span><h4>Session Setup</h4></div></div><div class="po-training-setup"><label class="po-training-field po-training-setup__identity"><span>Program Name</span><input class="section-filter" type="text" name="program.programName" value="${escapeHtml(program.programName || '')}" placeholder="Program Name"></label><div class="po-training-setup__grid"><label class="po-training-field"><span>Date</span><input class="section-filter" type="date" name="program.date" value="${escapeHtml(normalizeDateInput(program.date || program.startsAt))}"></label><label class="po-training-field"><span>Venue / Place</span><input class="section-filter" type="text" name="program.venue" value="${escapeHtml(program.venue || '')}" placeholder="Venue / Place"></label><label class="po-training-field"><span>Start Time</span><input class="section-filter" type="time" name="program.startTime" value="${escapeHtml(normalizeTimeInput(program.startTime))}"></label><label class="po-training-field"><span>Speaker / Facilitator</span><input class="section-filter" type="text" name="program.speaker" value="${escapeHtml(program.speaker || '')}" placeholder="Speaker / Facilitator"></label><label class="po-training-field"><span>End Time</span><input class="section-filter" type="time" name="program.endTime" value="${escapeHtml(normalizeTimeInput(program.endTime))}"></label><label class="po-training-field"><span>Training Coverage</span><select class="section-filter" name="program.trainingMode"><option value="all" ${trainingMode === 'all' ? 'selected' : ''}>All participants</option><option value="batch" ${trainingMode === 'batch' ? 'selected' : ''}>By batch</option></select></label><div class="po-training-field po-training-field--readonly"><span>Batch Structure</span><strong>${trainingMode === 'batch' ? '3 groups × 85' : 'No cap'}</strong></div><div class="po-training-field po-training-field--readonly"><span>Participant Count</span><strong>${escapeHtml(String(invitees.length))}</strong></div></div><p class="table-secondary">${escapeHtml(batchNote)}</p></div></section>`;
  }

  function buildDraftSessionNotice() {
    return `<section class="po-training-work-block po-training-draft-note"><div class="po-training-work-block__header"><div><span class="po-panel-label">Session Workspace</span><h4>Save session details first</h4></div></div><p>Complete the new training session details and save them first. Participant notice preview and roster controls will become available after the session is created.</p></section>`;
  }

  function buildParticipantEssentials(program) {
    return `<section class="po-training-work-block"><div class="po-training-work-block__header"><div><span class="po-panel-label">Participant Essentials</span><h4>Participant Essentials</h4></div></div><div class="po-training-essentials"><label class="po-training-field po-training-field--stacked"><span>What to Bring</span><textarea class="po-inline-remarks po-training-compact-textarea" name="program.whatToBring" rows="3" placeholder="What to Bring">${escapeHtml(program.whatToBring || '')}</textarea></label><label class="po-training-field po-training-field--stacked"><span>Instructions / Reminders</span><textarea class="po-inline-remarks po-training-compact-textarea" name="program.instructions" rows="3" placeholder="Instructions / Reminders">${escapeHtml(program.instructions || '')}</textarea></label></div></section>`;
  }

  function buildParticipantAssignment(program, invitees) {
    const eligible = state.training.eligibleInvitees || [];
    const selectedIds = new Set(invitees.map((invitee) => Number(invitee.applicantProfileId)));
    const ordered = eligible.slice().sort((left, right) => {
      const leftSelected = selectedIds.has(Number(left.applicantProfileId)) ? 1 : 0;
      const rightSelected = selectedIds.has(Number(right.applicantProfileId)) ? 1 : 0;
      if (leftSelected !== rightSelected) return rightSelected - leftSelected;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

    const batchHint = (program.trainingMode || 'all') === 'batch'
      ? '<p class="table-secondary">Batch sessions auto-assign selected participants to Groups 1, 2, and 3 with a maximum of 85 per group.</p>'
      : '<p class="table-secondary">All sessions can include the full approved roster. Barangay does not limit participant selection here.</p>';
    return `<section class="po-training-work-block po-training-assignment"><div class="po-training-work-block__header"><div><span class="po-panel-label">Participant Assignment</span><h4>Assign Participants</h4></div><span class="chip">${escapeHtml(`${invitees.length} selected`)}</span></div><form id="po-training-invitees-form" class="po-training-assignment__form" data-program-id="${program.id}"><div class="po-training-assignment__summary"><div><span>Eligible Applicants</span><strong>${escapeHtml(String(eligible.length))}</strong></div><div><span>Assigned to Session</span><strong>${escapeHtml(String(invitees.length))}</strong></div><div><span>Training Coverage</span><strong>${escapeHtml(trainingModeLabel(program.trainingMode))}</strong></div></div>${batchHint}${ordered.length ? `<div class="po-training-assignment__list">${ordered.map((invitee) => `<label class="po-training-assignment__item"><input type="checkbox" name="invitees.applicantProfileIds[]" value="${invitee.applicantProfileId}" ${selectedIds.has(Number(invitee.applicantProfileId)) ? 'checked' : ''} ${state.training.syncingInvitees ? 'disabled' : ''}><span class="po-training-assignment__copy"><strong>${escapeHtml(invitee.name || '--')}</strong><small>${escapeHtml(invitee.businessName || 'No business name recorded')}</small><small>${escapeHtml(invitee.barangay || 'No barangay recorded')}</small></span></label>`).join('')}</div>` : '<div class="po-empty">No eligible applicants are available for this session yet.</div>'}<div class="po-training-session-actions"><button type="submit" class="action-button po-case-action" ${state.training.syncingInvitees || !ordered.length ? 'disabled' : ''}>${state.training.syncingInvitees ? 'Saving Participants...' : 'Save Participants'}</button></div></form></section>`;
  }

  function buildAnnouncementPanel(program, invitees) {
    const lastNoticeSent = latestNoticeDate(invitees);
    const busySendAll = state.training.sendingProgramNotice === 'send';
    const busyResend = state.training.sendingProgramNotice === 'resend';
    const disabled = busySendAll || busyResend || invitees.length === 0;
    return `<section class="po-training-work-block po-training-announcement"><div class="po-training-work-block__header"><div><span class="po-panel-label">Announcement</span><h4>Participant Notice Preview</h4></div></div><div class="po-training-announcement__preview"><strong>${escapeHtml(program.programName || '--')}</strong><div class="po-training-preview-grid"><div><span>Date</span><strong>${escapeHtml(formatDate(program.date || program.startsAt))}</strong></div><div><span>Time</span><strong>${escapeHtml(formatTimeRange(program.startTime, program.endTime))}</strong></div><div><span>Venue</span><strong>${escapeHtml(program.venue || '--')}</strong></div><div><span>Speaker</span><strong>${escapeHtml(program.speaker || '--')}</strong></div><div><span>Coverage</span><strong>${escapeHtml(trainingModeLabel(program.trainingMode))}</strong></div></div><div class="po-training-preview-copy"><div><span>What to Bring</span><p>${escapeHtml(program.whatToBring || 'No items recorded.')}</p></div><div><span>Instructions / Reminders</span><p>${escapeHtml(program.instructions || 'No reminders recorded.')}</p></div></div></div><div class="po-training-announcement__meta"><div><span>Participant Count</span><strong>${escapeHtml(String(invitees.length))}</strong></div><div><span>Last Notice Sent</span><strong>${escapeHtml(lastNoticeSent || 'Pending notice')}</strong></div></div><div class="po-training-announcement__actions"><button type="button" class="action-button po-case-action" data-training-send-program="send" ${disabled ? 'disabled' : ''}>${busySendAll ? 'Sending Notice...' : 'Send Notice to All'}</button><button type="button" class="action-button action-button--quiet" data-training-send-program="resend" ${disabled ? 'disabled' : ''}>${busyResend ? 'Resending Notice...' : 'Resend Notice'}</button></div></section>`;
  }

  function buildTrainingSessionRosterSummary(invitees) {
    const notified = invitees.filter((invitee) => ['Notified', 'Attended', 'Completed'].includes(String(invitee.status || ''))).length;
    const attended = invitees.filter((invitee) => String(invitee.status || '') === 'Attended').length;
    const excused = invitees.filter((invitee) => String(invitee.status || '') === 'Excused').length;
    const completed = invitees.filter((invitee) => String(invitee.status || '') === 'Completed').length;
    return `<section class="po-training-roster-summary"><article class="po-training-card"><span>Participants</span><strong>${invitees.length}</strong></article><article class="po-training-card"><span>Notified</span><strong>${notified}</strong></article><article class="po-training-card"><span>Attended</span><strong>${attended}</strong></article><article class="po-training-card"><span>Excused</span><strong>${excused}</strong></article><article class="po-training-card"><span>Completed</span><strong>${completed}</strong></article></section>`;
  }

  function buildParticipantRoster(invitees) {
    const search = state.training.rosterSearch.toLowerCase();
    const filter = state.training.rosterFilter;
    const filtered = invitees.filter((invitee) => {
      const matchesSearch = !search || [invitee.user?.name, invitee.businessName, invitee.barangay].some((value) => String(value || '').toLowerCase().includes(search));
      const normalizedStatus = String(invitee.status || '');
      const noticeState = invitee.lastNoticeSentAt || invitee.notifiedAt ? 'Notified' : 'Pending Notice';
      const matchesFilter = !filter || normalizedStatus === filter || (filter === 'Pending Notice' && noticeState === 'Pending Notice');
      return matchesSearch && matchesFilter;
    });
    return `<section class="po-training-attendance-panel"><div class="po-training-attendance-panel__header"><div><span class="po-panel-label">Attendance Control</span><h4>Participant Roster</h4></div><span class="chip">${escapeHtml(`${invitees.length} ${invitees.length === 1 ? 'participant' : 'participants'}`)}</span></div><div class="po-training-roster-toolbar"><label class="po-search-control" aria-label="Search participant, business, or barangay"><i class="fas fa-magnifying-glass"></i><input id="po-training-roster-search" type="search" placeholder="Search participant, business, or barangay" value="${escapeHtml(state.training.rosterSearch)}"></label><label class="po-filter-field" for="po-training-roster-filter"><span>Filter</span><select id="po-training-roster-filter" class="section-filter"><option value="">All</option><option value="Pending Notice" ${filter === 'Pending Notice' ? 'selected' : ''}>Pending Notice</option><option value="Notified" ${filter === 'Notified' ? 'selected' : ''}>Notified</option><option value="Attended" ${filter === 'Attended' ? 'selected' : ''}>Attended</option><option value="Excused" ${filter === 'Excused' ? 'selected' : ''}>Excused</option><option value="Missed" ${filter === 'Missed' ? 'selected' : ''}>Absent</option><option value="Completed" ${filter === 'Completed' ? 'selected' : ''}>Completed</option></select></label></div><div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Participant</th><th>Business</th><th>Barangay</th><th>Group</th><th>Notice</th><th>Attendance</th><th>Proof</th><th>Remarks</th><th class="actions">Actions</th></tr></thead><tbody>${filtered.map((invitee) => {
      const notifyBusy = !!state.training.busyInvitees[`invitee-${invitee.id}`];
      const saveBusy = !!state.training.busyInvitees[`attendance-${invitee.id}`];
      const proof = invitee.proofAttachment;
      return `<tr class="${state.training.lastUpdatedInviteeId === invitee.id ? 'is-updated' : ''}"><td><div class="table-primary">${escapeHtml(invitee.user?.name || '--')}</div><div class="table-secondary">${escapeHtml(invitee.contactNumber || invitee.user?.email || '')}</div></td><td>${escapeHtml(invitee.businessName || '--')}</td><td>${escapeHtml(invitee.barangay || '--')}</td><td>${invitee.batchGroupNumber ? `Group ${escapeHtml(String(invitee.batchGroupNumber))}` : '<span class="table-secondary">All</span>'}</td><td><div class="po-date-cell"><strong>${invitee.lastNoticeSentAt || invitee.notifiedAt ? formatDate(invitee.lastNoticeSentAt || invitee.notifiedAt) : 'Pending notice'}</strong><span>${state.training.lastNotifiedInviteeId === invitee.id ? 'Just updated' : (invitee.lastNoticeSentAt || invitee.notifiedAt ? 'Notice sent' : 'Pending notice')}</span></div></td><td><select class="section-filter po-attendance-select" data-training-status-select="${invitee.id}" ${saveBusy ? 'disabled' : ''}>${trainingStatuses.map((status) => `<option value="${status}" ${status === invitee.status ? 'selected' : ''}>${escapeHtml(status === 'Missed' ? 'Absent' : status)}</option>`).join('')}</select></td><td><div class="po-training-proof-cell">${proof?.file_path ? `<a class="action-button action-button--quiet" href="${escapeHtml(routeUrl(proof.file_path))}" target="_blank" rel="noopener">View proof</a>` : '<span class="table-secondary">No proof</span>'}<input type="file" class="section-filter" data-training-proof="${invitee.id}" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${saveBusy ? 'disabled' : ''}></div></td><td><textarea class="po-inline-remarks po-training-compact-textarea" data-training-remarks="${invitee.id}" rows="2" placeholder="Remarks or proof note" ${saveBusy ? 'disabled' : ''}>${escapeHtml(invitee.remarks || '')}</textarea></td><td class="actions"><div class="table-actions"><button type="button" class="action-button action-button--quiet" data-training-send-invitee="${invitee.id}" ${notifyBusy || saveBusy ? 'disabled' : ''}>${notifyBusy ? 'Sending...' : 'Notify'}</button><button type="button" class="action-button po-case-action" data-training-save-status="${invitee.id}" ${saveBusy || notifyBusy ? 'disabled' : ''}>${saveBusy ? 'Saving...' : 'Save'}</button></div></td></tr>`;
    }).join('') || '<tr><td colspan="9" class="text-center text-muted">No invitees assigned yet.</td></tr>'}</tbody></table></div></section>`;
  }

  function renderTrainingError(message) {
    const summary = document.getElementById('po-training-summary');
    const list = document.getElementById('po-training-program-list');
    const detail = document.getElementById('po-training-program-detail');
    if (summary) summary.innerHTML = `<article class="po-training-card"><span>Training</span><strong>--</strong></article>`;
    if (list) list.innerHTML = `<div class="po-empty">${escapeHtml(message)}</div>`;
    if (detail) detail.innerHTML = `<div class="po-empty">${escapeHtml(message)}</div>`;
  }

  function switchTrainingView(view, rerender = true) {
    state.training.view = view === 'session' ? 'session' : 'overview';
    const overviewView = document.getElementById('po-training-overview-view');
    const sessionView = document.getElementById('po-training-session-view');
    if (overviewView) overviewView.style.display = state.training.view === 'overview' ? 'grid' : 'none';
    if (sessionView) sessionView.style.display = state.training.view === 'session' ? 'grid' : 'none';
    if (!rerender) return;
    if (state.training.view === 'session') {
      renderTrainingSessionView();
      return;
    }
    renderTrainingOverview();
  }

  function handleTrainingInput(event) {
    const search = event.target.closest('#po-training-roster-search');
    if (search) {
      state.training.rosterSearch = String(search.value || '');
      return renderTrainingSessionView();
    }
    const filter = event.target.closest('#po-training-roster-filter');
    if (filter) {
      state.training.rosterFilter = String(filter.value || '');
      return renderTrainingSessionView();
    }
  }

  async function handleTrainingClick(event) {
    const open = event.target.closest('[data-training-open]');
    if (open) {
      state.training.confirmRemoveProgramId = null;
      return loadTrainingProgram(Number(open.dataset.trainingOpen));
    }
    const remove = event.target.closest('[data-training-remove]');
    if (remove) return handleTrainingRemove(Number(remove.dataset.trainingRemove));
    const sendProgram = event.target.closest('[data-training-send-program]');
    if (sendProgram && state.training.activeProgram) return sendTrainingNotices(state.training.activeProgram.id, [], String(sendProgram.dataset.trainingSendProgram || 'send'));
    const sendInvitee = event.target.closest('[data-training-send-invitee]');
    if (sendInvitee && state.training.activeProgram) return sendTrainingNotices(state.training.activeProgram.id, [Number(sendInvitee.dataset.trainingSendInvitee)]);
    const save = event.target.closest('[data-training-save-status]');
    if (save) return updateTrainingAttendance(Number(save.dataset.trainingSaveStatus));
  }

  async function handleTrainingSubmit(event) {
    const inviteeForm = event.target.closest('#po-training-invitees-form');
    if (inviteeForm && state.training.activeProgram?.id && !state.training.syncingInvitees) {
      event.preventDefault();
      const formData = new FormData(inviteeForm);
      const applicantProfileIds = formData.getAll('invitees.applicantProfileIds[]').map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
      state.training.syncingInvitees = true;
      renderTrainingSessionView();
      const response = await apiPost('api/training/invitees', { programId: state.training.activeProgram.id, applicantProfileIds });
      state.training.syncingInvitees = false;
      if (!response.ok) {
        renderTrainingSessionView();
        return showToast(firstError(response.errors) || response.message || 'Unable to save participants.', 'warning');
      }
      showToast('Session participants updated.', 'success');
      await loadTrainingProgram(state.training.activeProgram.id, false);
      await loadTraining();
      return;
    }

    const form = event.target.closest('#po-training-session-form');
    if (!form || !state.training.activeProgram || state.training.savingProgram) return;
    event.preventDefault();
    const formData = new FormData(form);
    const payload = {
      programId: state.training.activeProgram.id,
      programName: String(formData.get('program.programName') || ''),
      description: state.training.activeProgram.description || '',
      date: String(formData.get('program.date') || ''),
      startTime: String(formData.get('program.startTime') || ''),
      endTime: String(formData.get('program.endTime') || ''),
      venue: String(formData.get('program.venue') || ''),
      speaker: String(formData.get('program.speaker') || ''),
      whatToBring: String(formData.get('program.whatToBring') || ''),
      instructions: String(formData.get('program.instructions') || ''),
      trainingMode: String(formData.get('program.trainingMode') || 'all'),
      status: state.training.activeProgram.status || 'Scheduled',
    };
    state.training.savingProgram = true;
    renderTrainingSessionView();
    const response = await apiPost(state.training.activeProgram.isDraft ? 'api/training' : 'api/training/update', payload);
    state.training.savingProgram = false;
    if (!response.ok) {
      renderTrainingSessionView();
      return showToast(firstError(response.errors) || response.message || 'Unable to save session details.', 'warning');
    }
    showToast(state.training.activeProgram.isDraft ? 'Training session created.' : 'Session details updated.', 'success');
    if (response.programId) {
      state.training.selectedProgramId = Number(response.programId);
      state.training.activeProgram = null;
      await loadTrainingProgram(Number(response.programId), false);
      await loadTraining();
      return;
    }
    if (state.training.selectedProgramId) await loadTrainingProgram(state.training.selectedProgramId, false);
    await loadTraining();
  }

  async function sendTrainingNotices(programId, inviteeIds = [], mode = 'send') {
    const busyKey = inviteeIds.length === 1 ? `invitee-${inviteeIds[0]}` : `program-${mode}`;
    if (state.training.busyInvitees[busyKey]) return;
    state.training.busyInvitees[busyKey] = true;
    if (inviteeIds.length !== 1) {
      state.training.sendingProgramNotice = mode;
    }
    renderTrainingSessionView();
    const response = await apiPost('api/training/notices', { programId, inviteeIds });
    if (!response.ok) {
      delete state.training.busyInvitees[busyKey];
      state.training.sendingProgramNotice = '';
      renderTrainingSessionView();
      return showToast(firstError(response.errors) || response.message || 'Unable to send notices.', 'warning');
    }
    state.training.lastNotifiedInviteeId = inviteeIds.length === 1 ? inviteeIds[0] : null;
    showToast(inviteeIds.length === 1 ? 'Participant notice sent.' : 'Training notices sent.', 'success');
    await loadTrainingProgram(programId, false);
    await loadTraining();
    delete state.training.busyInvitees[busyKey];
    state.training.sendingProgramNotice = '';
    renderTrainingSessionView();
  }

  async function handleTrainingRemove(programId) {
    if (state.training.removingProgramId === programId) return;
    if (state.training.confirmRemoveProgramId !== programId) {
      state.training.confirmRemoveProgramId = programId;
      return renderTrainingQueue();
    }

    state.training.removingProgramId = programId;
    renderTrainingQueue();
    const response = await apiPost('api/training/delete', { programId });
    state.training.removingProgramId = null;
    state.training.confirmRemoveProgramId = null;
    if (!response.ok) {
      renderTrainingQueue();
      return showToast(firstError(response.errors) || response.message || 'Unable to remove training session.', 'warning');
    }

    if (state.training.selectedProgramId === programId) {
      state.training.selectedProgramId = null;
      state.training.activeProgram = null;
      state.training.view = 'overview';
    }

    showToast('Training session removed.', 'success');
    await loadTraining();
  }

  async function updateTrainingAttendance(trainingInviteeId) {
    const select = document.querySelector(`[data-training-status-select="${trainingInviteeId}"]`);
    const remarks = String(document.querySelector(`[data-training-remarks="${trainingInviteeId}"]`)?.value || '').trim();
    const proofInput = document.querySelector(`[data-training-proof="${trainingInviteeId}"]`);
    if (state.training.busyInvitees[`attendance-${trainingInviteeId}`]) return;
    state.training.busyInvitees[`attendance-${trainingInviteeId}`] = true;
    renderTrainingSessionView();
    const formData = new FormData();
    formData.append('trainingInviteeId', String(trainingInviteeId));
    formData.append('status', select?.value || 'Scheduled');
    formData.append('remarks', remarks);
    const proofFile = proofInput instanceof HTMLInputElement ? proofInput.files?.[0] : null;
    if (proofFile) {
      formData.append('proofAttachment', proofFile);
    }
    const response = await apiFormPost('api/training/attendance', formData);
    if (!response.ok) {
      delete state.training.busyInvitees[`attendance-${trainingInviteeId}`];
      renderTrainingSessionView();
      return showToast(firstError(response.errors) || response.message || 'Unable to update attendance.', 'warning');
    }
    showToast('Attendance record updated.', 'success');
    state.training.lastUpdatedInviteeId = trainingInviteeId;
    if (state.training.selectedProgramId) await loadTrainingProgram(state.training.selectedProgramId, false);
    await loadTraining();
    delete state.training.busyInvitees[`attendance-${trainingInviteeId}`];
    renderTrainingSessionView();
  }

  function openNewTrainingSession() {
    state.training.selectedProgramId = null;
    state.training.rosterSearch = '';
    state.training.rosterFilter = '';
    state.training.activeProgram = {
      id: null,
      isDraft: true,
      programName: '',
      description: '',
      date: '',
      startTime: '',
      endTime: '',
      venue: '',
      speaker: '',
      whatToBring: '',
      instructions: '',
      trainingMode: 'all',
      status: 'Scheduled',
      invitees: [],
    };
    switchTrainingView('session');
  }

  async function handleLogout() {
    try {
      await fetch(`${baseUrl}/auth/logout`, { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin' });
    } finally {
      window.location.href = `${baseUrl}/login`;
    }
  }

  function readinessLabel(status) {
    if (status === 'Flagged') return 'Needs Documents';
    if (status === 'Needs Correction') return 'Needs Correction';
    if (status === 'Submitted' || status === 'Under Review' || status === 'Pending') return 'Under Review';
    if (status === 'Checked by PDO' || status === 'Requirements Verified' || status === 'For Assessment' || status === 'Approved' || status === 'Approved for Training') return 'Ready';
    return 'Under Review';
  }

  function rosterMatchesSearch(item, search) {
    if (!search) return true;
    return [item.name, item.barangay, item.businessName].some((value) => String(value || '').toLowerCase().includes(search));
  }

  function applicationMatchesSearch(item, search) {
    if (!search) return true;
    return [item.applicantName, item.barangay, item.businessName, item.email, item.contactNumber].some((value) => String(value || '').toLowerCase().includes(search));
  }

  function priorityWeight(item) {
    const readiness = readinessLabel(item.status);
    if (readiness === 'Ready') return 5;
    if (readiness === 'Needs Correction') return 4;
    if (readiness === 'Needs Documents') return 3;
    if (readiness === 'Training Pending') return 2;
    return 1;
  }

  function debounceRender(key, callback, delay = 140) {
    window.clearTimeout(state.searchTimers[key]);
    state.searchTimers[key] = window.setTimeout(callback, delay);
  }

  function latestNoticeDate(invitees) {
    const values = invitees.map((invitee) => invitee.lastNoticeSentAt || invitee.notifiedAt).filter(Boolean).sort((left, right) => toTime(right) - toTime(left));
    return values.length ? formatDate(values[0]) : '';
  }

  function normalizeDateInput(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
  }

  function normalizeTimeInput(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    return raw.length >= 5 ? raw.slice(0, 5) : raw;
  }

  function formatTimeRange(start, end) {
    const startLabel = formatTimeLabel(start);
    const endLabel = formatTimeLabel(end);
    if (!startLabel && !endLabel) return '--';
    if (!endLabel) return startLabel;
    if (!startLabel) return endLabel;
    return `${startLabel} - ${endLabel}`;
  }

  function formatTimeLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const parts = raw.slice(0, 5).split(':');
    if (parts.length !== 2) return raw;
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return raw;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }

  function showToast(message, type = 'info') {
    const root = document.getElementById('poToastStack');
    if (!root) return;
    const toast = document.createElement('div');
    toast.className = `po-toast po-toast--${type}`;
    toast.textContent = message;
    root.appendChild(toast);
    window.setTimeout(() => toast.classList.add('is-visible'), 10);
    window.setTimeout(() => {
      toast.classList.remove('is-visible');
      window.setTimeout(() => toast.remove(), 220);
    }, 2800);
  }

  function requirementStatusLabel(status) {
    const value = String(status || '').toLowerCase();
    if (['verified', 'approved'].includes(value)) return 'Approved';
    if (['rejected', 'needs correction'].includes(value)) return 'Rejected';
    if (['submitted', 'pending', 'unlocked', 'in progress'].includes(value)) return 'Pending';
    return value === 'missing' ? 'Missing' : (status || 'Pending');
  }

  function requirementStatusClass(status) {
    const value = requirementStatusLabel(status).toLowerCase();
    if (value === 'approved') return 'is-success';
    if (value === 'rejected' || value === 'missing') return 'is-danger';
    if (value === 'pending') return 'is-warning';
    return 'is-muted';
  }

  function statusClass(status) {
    const value = String(status || '').toLowerCase();
    if (['approved', 'checked by pdo', 'verified', 'completed', 'attended'].includes(value)) return 'is-success';
    if (['excused'].includes(value)) return 'is-warning';
    if (['rejected', 'flagged', 'missing', 'missed'].includes(value)) return 'is-danger';
    if (['needs correction', 'notified', 'scheduled', 'submitted', 'under review', 'pending'].includes(value)) return 'is-warning';
    return 'is-muted';
  }

  function trainingModeLabel(mode) {
    return String(mode || '').toLowerCase() === 'batch' ? 'Batch (3 groups × 85)' : 'All participants';
  }

  function readinessBadgeClass(status) {
    const value = String(status || '').toLowerCase();
    if (value.includes('approved') || value.includes('ready') || value.includes('checked by pdo')) return 'is-success';
    if (value.includes('needs correction') || value.includes('needs documents') || value.includes('flagged')) return 'is-danger';
    return 'is-warning';
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  function setStatusChipClass(id, status) {
    const node = document.getElementById(id);
    if (!node) return;
    node.classList.remove('is-success', 'is-warning', 'is-danger', 'is-muted', 'po-status-chip--header');
    node.classList.add('po-status-chip--header', statusClass(status));
  }

  function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function toTime(value) {
    const date = new Date(value || 0);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  function firstError(errors) {
    if (!errors || typeof errors !== 'object') return '';
    const values = Object.values(errors);
    return values.length ? values[0] : '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function cssEscape(value) {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/"/g, '\\"');
  }
})();

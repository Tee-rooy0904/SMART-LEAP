(function () {
  const authUser = window.SMARTLEAP_AUTH_USER || null;
  const baseUrl = String(window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');
  const trainingStatuses = ['Not Scheduled', 'Scheduled', 'Notified', 'Attended', 'Missed', 'Completed'];
  const state = { applications: [], roster: [], summary: {}, scopeBarangays: [], activeApplication: null, training: { programs: [], summary: {}, selectedProgramId: null, activeProgram: null } };
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
    document.getElementById('po-app-refresh')?.addEventListener('click', loadDashboard);
    document.getElementById('po-training-refresh')?.addEventListener('click', loadTraining);
    document.getElementById('po-search')?.addEventListener('input', renderRosterTable);
    document.getElementById('po-app-filter')?.addEventListener('change', renderApplicationsTable);
    document.getElementById('po-logout')?.addEventListener('click', handleLogout);
    document.getElementById('po-new-client')?.addEventListener('click', () => alert('Beneficiary creation is not part of this backend pass yet.'));
    document.querySelector('#po-table tbody')?.addEventListener('click', handleApplicationClick);
    document.querySelector('#po-app-table tbody')?.addEventListener('click', handleApplicationClick);
    document.getElementById('poApplicationModal')?.addEventListener('click', handleReviewClick);
    document.getElementById('po-app-modal-flag')?.addEventListener('click', () => submitApplicationDecision('flag'));
    document.getElementById('po-app-modal-correct')?.addEventListener('click', () => submitApplicationDecision('needs_correction'));
    document.getElementById('po-app-modal-reject')?.addEventListener('click', () => submitApplicationDecision('reject'));
    document.getElementById('po-app-modal-approve')?.addEventListener('click', openApprovalSummary);
    document.getElementById('po-summary-confirm')?.addEventListener('click', async () => { bootstrap.Modal.getOrCreateInstance(document.getElementById('poApprovalSummaryModal')).hide(); await submitApplicationDecision('approve'); });
    document.getElementById('training-section')?.addEventListener('click', handleTrainingClick);
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
    document.querySelectorAll('[data-section]').forEach((button) => button.classList.toggle('active', button.dataset.section === section));
    document.querySelectorAll('[data-role-section]').forEach((panel) => { panel.style.display = panel.id === `${section}-section` ? 'block' : 'none'; });
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
    setText('poSummaryReady', String(state.applications.filter((item) => ['Checked by PDO', 'Approved'].includes(item.status)).length));
    setText('poHeaderBarangays', scopeText);
    setText('poHeaderScope', `${state.roster.length} scoped applicant${state.roster.length === 1 ? '' : 's'}`);
    const barangayList = document.getElementById('poBarangayList');
    if (barangayList) barangayList.innerHTML = state.scopeBarangays.length ? state.scopeBarangays.map((item) => `<span class="po-mini-chip">${escapeHtml(item.name)}</span>`).join('') : '<span class="po-mini-chip">No assignments yet</span>';
    renderRosterTable();
    renderApplicationsTable();
    renderPriorityQueueCards();
  }

  function renderLoadError(message) {
    const roster = document.querySelector('#po-table tbody');
    const applications = document.querySelector('#po-app-table tbody');
    if (roster) roster.innerHTML = `<tr><td colspan="4" class="text-center text-muted">${escapeHtml(message)}</td></tr>`;
    if (applications) applications.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${escapeHtml(message)}</td></tr>`;
  }

  function renderRosterTable() {
    const tbody = document.querySelector('#po-table tbody');
    if (!tbody) return;
    const search = String(document.getElementById('po-search')?.value || '').toLowerCase();
    const filtered = state.roster.filter((item) => item.name.toLowerCase().includes(search) || String(item.barangay || '').toLowerCase().includes(search));
    tbody.innerHTML = filtered.map((item, index) => `<tr><td>${index + 1}</td><td><div class="table-primary">${escapeHtml(item.name)}</div><div class="table-secondary">${escapeHtml(item.barangay || '--')}</div></td><td><span class="po-status-pill ${statusClass(item.status)}">${escapeHtml(item.status || 'Pending')}</span></td><td class="text-end"><button type="button" class="action-button" data-open-application="${item.id}"><i class="fas fa-folder-open"></i><span>Open</span></button></td></tr>`).join('') || '<tr><td colspan="4" class="text-center text-muted">No scoped applicants found.</td></tr>';
    setText('poRosterCount', `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`);
  }

  function renderApplicationsTable() {
    const tbody = document.querySelector('#po-app-table tbody');
    if (!tbody) return;
    const filter = String(document.getElementById('po-app-filter')?.value || '');
    const filtered = state.applications.filter((item) => !filter || item.status === filter);
    tbody.innerHTML = filtered.map((item) => `<tr><td><div class="po-application-identity"><div class="table-primary">${escapeHtml(item.applicantName)}</div><div class="table-secondary">${escapeHtml(item.businessName || 'No business name recorded')}</div><div class="table-tertiary">${escapeHtml(item.email || '--')}</div></div></td><td><div class="po-location-cell"><strong>${escapeHtml(item.barangay || '--')}</strong><span>${escapeHtml(item.contactNumber || 'No contact number')}</span></div></td><td><div class="po-progress-cell"><strong>${item.verifiedRequirementCount || 0} / ${item.requiredRequirementCount || 0}</strong><span>verified requirements</span></div></td><td><span class="po-status-pill ${statusClass(item.status)}">${escapeHtml(item.status || '--')}</span></td><td><span class="po-status-pill ${readinessBadgeClass(item.status)}">${escapeHtml(readinessLabel(item.status))}</span></td><td><div class="po-date-cell"><strong>${formatDate(item.submittedAt)}</strong><span>submission date</span></div></td><td class="text-end"><button type="button" class="action-button po-case-action" data-open-application="${item.id}"><i class="fas fa-folder-open"></i><span>Open Review</span></button></td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">No scoped applications found.</td></tr>';
    setText('po-app-count', `${filtered.length} ${filtered.length === 1 ? 'record' : 'records'}`);
    setText('po-app-ready-count', `${filtered.filter((item) => readinessLabel(item.status) === 'Ready').length} cases`);
    setText('po-app-attention-count', `${filtered.filter((item) => ['Needs Documents', 'Needs Correction', 'Pending'].includes(readinessLabel(item.status))).length} cases`);
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
    if (!response.ok || !response.application) return alert(response.message || 'Unable to load the application.');
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
    renderRequirementTable('#po-upload-review-table tbody', app.requirements || [], 'upload');
    renderRequirementTable('#po-form-review-table tbody', app.formRequirements || [], 'form');
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
      const statusLabel = requirementStatusLabel(item.status);
      const collapseStaffRemarks = statusLabel === 'Approved';
      const staffRemarksField = collapseStaffRemarks
        ? `<details class="po-staff-note-toggle"><summary>${escapeHtml(item.reviewerRemarks ? 'View internal note' : 'Add internal note')}</summary><textarea class="po-inline-remarks" data-${kind}-staff-remarks="${escapeHtml(itemKey)}" rows="2" placeholder="Internal note for staff only.">${escapeHtml(item.reviewerRemarks || '')}</textarea></details>`
        : `<textarea class="po-inline-remarks" data-${kind}-staff-remarks="${escapeHtml(itemKey)}" rows="2" placeholder="Internal note for staff only.">${escapeHtml(item.reviewerRemarks || '')}</textarea>`;

      return `<tr><td><strong>${escapeHtml(item.label || '--')}</strong></td><td>${escapeHtml(item.typeLabel || '--')}</td><td><span class="po-status-pill ${kind === 'upload' ? (item.file?.url ? 'is-info' : 'is-danger') : (['submitted', 'verified', 'rejected', 'needs correction'].includes(String(item.status || '').toLowerCase()) ? 'is-info' : 'is-danger')}">${escapeHtml(kind === 'upload' ? (item.file?.url ? 'Submitted' : 'Missing') : (['submitted', 'verified', 'rejected', 'needs correction'].includes(String(item.status || '').toLowerCase()) ? 'Submitted' : 'Missing'))}</span></td><td><span class="po-status-pill ${requirementStatusClass(item.status)}">${escapeHtml(statusLabel)}</span></td><td>${staffRemarksField}</td><td><textarea class="po-inline-remarks" data-${kind}-applicant-remarks="${escapeHtml(itemKey)}" rows="2" placeholder="Shown to the applicant when needed."></textarea></td><td>${kind === 'upload' ? (item.file?.url ? `<a class="action-link" href="${escapeHtml(item.file.url)}" target="_blank" rel="noopener">Open file</a>` : '<span class="muted-cell">No file</span>') : (item.reviewUrl ? `<a class="action-link" href="${escapeHtml(item.reviewUrl)}" target="_blank" rel="noopener">Open form</a>` : '<span class="muted-cell">Unavailable</span>')}</td><td class="actions"><div class="table-actions"><button type="button" class="action-button" data-review-${kind}="${escapeHtml(itemKey)}" data-decision="approve">Approve</button><button type="button" class="action-button action-button--danger" data-review-${kind}="${escapeHtml(itemKey)}" data-decision="reject">Reject</button></div></td></tr>`;
    }).join('') || '<tr><td colspan="8" class="text-center text-muted">No requirements found.</td></tr>';
  }

  async function handleReviewClick(event) {
    const upload = event.target.closest('[data-review-upload]');
    if (upload) return reviewUpload(upload.dataset.reviewUpload, upload.dataset.decision);
    const form = event.target.closest('[data-review-form]');
    if (form) return reviewForm(Number(form.dataset.reviewForm), form.dataset.decision);
  }

  async function reviewUpload(requirementKey, decision) {
    const staffRemarks = String(document.querySelector(`[data-upload-staff-remarks="${cssEscape(requirementKey)}"]`)?.value || '').trim();
    const applicantRemark = String(document.querySelector(`[data-upload-applicant-remarks="${cssEscape(requirementKey)}"]`)?.value || '').trim();
    if (decision === 'reject' && !applicantRemark) return alert('Applicant-visible remark is required when rejecting a requirement.');
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
    if (decision === 'reject' && !applicantVisibleRemark) return alert('Applicant-visible remark is required when rejecting a requirement.');
    const response = await apiJsonPost('api/post-approval-review/review', {
      taskId,
      status: decision === 'approve' ? 'Verified' : 'Rejected',
      remarks: staffRemarks,
      applicantVisibleRemark,
      staffForm: {},
    });
    if (!response.ok) return alert(firstError(response.errors) || response.message || 'Unable to save the form review.');
    await refreshActiveApplication();
  }

  async function refreshAfterReview(response, fallbackMessage) {
    if (!response.ok) return alert(firstError(response.errors) || response.message || fallbackMessage);
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
    if (!response.ok) return alert(firstError(response.errors) || response.message || 'Unable to update the application.');
    bootstrap.Modal.getOrCreateInstance(document.getElementById('poApplicationModal')).hide();
    await loadDashboard();
    await loadTraining();
  }

  async function loadTraining() {
    const response = await apiGet('api/training');
    if (!response.ok) return renderTrainingError(response.message || 'Unable to load training records.');
    state.training.programs = response.data?.programs || [];
    state.training.summary = response.data?.summary || {};
    setText('poSummaryTraining', String(state.training.summary.total || state.training.programs.length || 0));
    setText('po-training-program-count', `${state.training.programs.length} ${state.training.programs.length === 1 ? 'program' : 'programs'}`);
    renderTrainingSummary();
    renderTrainingProgramTable();
    if (!state.training.programs.some((item) => item.id === state.training.selectedProgramId)) state.training.selectedProgramId = state.training.programs[0]?.id || null;
    if (state.training.selectedProgramId) return loadTrainingProgram(state.training.selectedProgramId, false);
    state.training.activeProgram = null;
    renderTrainingDetail();
  }

  async function loadTrainingProgram(programId, showError = true) {
    const response = await apiGet('api/training/show', { id: programId });
    if (!response.ok) {
      if (showError) renderTrainingError(response.message || 'Unable to load training program detail.');
      return;
    }
    state.training.selectedProgramId = programId;
    state.training.activeProgram = response.program || null;
    renderTrainingProgramTable();
    renderTrainingDetail();
  }

  function renderTrainingSummary() {
    const s = state.training.summary || {};
    const root = document.getElementById('po-training-summary');
    if (!root) return;
    root.innerHTML = `<article class="po-training-card"><span>Programs</span><strong>${s.total || 0}</strong></article><article class="po-training-card"><span>Participants</span><strong>${s.participants || 0}</strong></article><article class="po-training-card"><span>Attended</span><strong>${s.attended || 0}</strong></article><article class="po-training-card"><span>Completed</span><strong>${s.completed || 0}</strong></article>`;
  }

  function renderTrainingProgramTable() {
    const tbody = document.querySelector('#po-training-program-table tbody');
    if (!tbody) return;
    tbody.innerHTML = state.training.programs.map((program) => `<tr class="${state.training.activeProgram?.id === program.id ? 'is-selected' : ''}"><td><div class="table-primary">${escapeHtml(program.programName || '--')}</div><div class="table-secondary">${escapeHtml(program.description || 'No description recorded.')}</div></td><td>${escapeHtml(program.speaker || '--')}</td><td>${formatDate(program.date || program.startsAt)}</td><td>${escapeHtml(program.venue || '--')}</td><td><span class="po-status-pill ${statusClass(program.status)}">${escapeHtml(program.status || '--')}</span></td><td>${program.participantCount || 0}</td><td class="actions"><div class="table-actions"><button type="button" class="action-button" data-training-open="${program.id}">Open</button><button type="button" class="action-button" data-training-send-program="${program.id}">Send notices</button></div></td></tr>`).join('') || '<tr><td colspan="7" class="text-center text-muted">No scoped training programs found.</td></tr>';
  }

  function renderTrainingDetail() {
    const root = document.getElementById('po-training-program-detail');
    if (!root) return;
    const program = state.training.activeProgram;
    if (!program) {
      setText('po-training-active-chip', 'No program selected');
      root.innerHTML = '<div class="po-empty">Open a training program to review attendance, notices, and completion tracking.</div>';
      return;
    }
    const invitees = program.invitees || [];
    setText('po-training-active-chip', program.programName || 'Program workspace');
    root.innerHTML = `<div class="po-program-meta"><article class="po-program-meta__card"><span>Schedule</span><strong>${escapeHtml(formatDate(program.date || program.startsAt))}</strong><small>${escapeHtml((program.startTime || '--') + ' - ' + (program.endTime || '--'))}</small></article><article class="po-program-meta__card"><span>Venue</span><strong>${escapeHtml(program.venue || '--')}</strong><small>${escapeHtml(program.status || '--')}</small></article><article class="po-program-meta__card"><span>Speaker</span><strong>${escapeHtml(program.speaker || '--')}</strong><small>Name of speaker</small></article><article class="po-program-meta__card"><span>What to bring</span><strong>${escapeHtml(program.whatToBring || '--')}</strong><small>Participant guidance</small></article></div><div class="po-program-notes"><article class="po-note-panel"><span class="po-panel-label">Instructions</span><p>${escapeHtml(program.instructions || 'No instructions recorded.')}</p></article></div><div class="data-table-wrapper"><table class="data-table"><thead><tr><th>Participant</th><th>Barangay</th><th>Attendance Record</th><th>Remarks</th><th>Notice</th><th class="actions">Actions</th></tr></thead><tbody>${invitees.map((invitee) => `<tr><td><div class="table-primary">${escapeHtml(invitee.user?.name || '--')}</div><div class="table-secondary">${escapeHtml(invitee.businessName || '--')}</div></td><td>${escapeHtml(invitee.barangay || '--')}</td><td><select class="section-filter po-attendance-select" data-training-status-select="${invitee.id}">${trainingStatuses.map((status) => `<option value="${status}" ${status === invitee.status ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}</select></td><td><textarea class="po-inline-remarks" data-training-remarks="${invitee.id}" rows="2" placeholder="Attendance record remarks.">${escapeHtml(invitee.remarks || '')}</textarea></td><td>${invitee.lastNoticeSentAt || invitee.notifiedAt ? formatDate(invitee.lastNoticeSentAt || invitee.notifiedAt) : 'Pending notice'}</td><td class="actions"><div class="table-actions"><button type="button" class="action-button" data-training-send-invitee="${invitee.id}">Notify</button><button type="button" class="action-button" data-training-save-status="${invitee.id}">Save</button></div></td></tr>`).join('') || '<tr><td colspan="6" class="text-center text-muted">No invitees assigned yet.</td></tr>'}</tbody></table></div>`;
  }

  function renderTrainingError(message) {
    const summary = document.getElementById('po-training-summary');
    const table = document.querySelector('#po-training-program-table tbody');
    const detail = document.getElementById('po-training-program-detail');
    if (summary) summary.innerHTML = `<article class="po-training-card"><span>Training</span><strong>--</strong></article>`;
    if (table) table.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${escapeHtml(message)}</td></tr>`;
    if (detail) detail.innerHTML = `<div class="po-empty">${escapeHtml(message)}</div>`;
  }

  async function handleTrainingClick(event) {
    const open = event.target.closest('[data-training-open]');
    if (open) return loadTrainingProgram(Number(open.dataset.trainingOpen));
    const sendProgram = event.target.closest('[data-training-send-program]');
    if (sendProgram) return sendTrainingNotices(Number(sendProgram.dataset.trainingSendProgram));
    const sendInvitee = event.target.closest('[data-training-send-invitee]');
    if (sendInvitee && state.training.activeProgram) return sendTrainingNotices(state.training.activeProgram.id, [Number(sendInvitee.dataset.trainingSendInvitee)]);
    const save = event.target.closest('[data-training-save-status]');
    if (save) return updateTrainingAttendance(Number(save.dataset.trainingSaveStatus));
  }

  async function sendTrainingNotices(programId, inviteeIds = []) {
    const response = await apiPost('api/training/notices', { programId, inviteeIds });
    if (!response.ok) return alert(firstError(response.errors) || response.message || 'Unable to send notices.');
    await loadTrainingProgram(programId, false);
    await loadTraining();
  }

  async function updateTrainingAttendance(trainingInviteeId) {
    const select = document.querySelector(`[data-training-status-select="${trainingInviteeId}"]`);
    const remarks = String(document.querySelector(`[data-training-remarks="${trainingInviteeId}"]`)?.value || '').trim();
    const response = await apiPost('api/training/attendance', { trainingInviteeId, status: select?.value || 'Scheduled', remarks });
    if (!response.ok) return alert(firstError(response.errors) || response.message || 'Unable to update attendance.');
    if (state.training.selectedProgramId) await loadTrainingProgram(state.training.selectedProgramId, false);
    await loadTraining();
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
    if (status === 'Checked by PDO' || status === 'Approved') return 'Ready';
    return 'Under Review';
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
    if (['rejected', 'flagged', 'missing', 'missed'].includes(value)) return 'is-danger';
    if (['needs correction', 'notified', 'scheduled', 'submitted', 'under review', 'pending'].includes(value)) return 'is-warning';
    return 'is-muted';
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

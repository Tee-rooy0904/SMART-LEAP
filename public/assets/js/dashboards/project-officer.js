(function () {
  const authUser = window.SMARTLEAP_AUTH_USER || null;
  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');
  const trainingStatuses = ['Not Scheduled', 'Scheduled', 'Notified', 'Attended', 'Missed', 'Completed'];
  const state = {
    applications: [],
    roster: [],
    summary: { applications: 0, pending: 0 },
    scopeBarangays: [],
    activeApplication: null,
    training: {
      programs: [],
      summary: {},
      selectedProgramId: null,
      activeProgram: null,
      notifications: [],
    },
  };

  const routeUrl = (path) => `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;

  const parseJson = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        message: response.status === 401 ? 'Your session has expired. Please sign in again.' : 'Unexpected server response.',
      };
    }
    return response.json();
  };

  const apiGet = async (path, params = {}) => {
    const query = new URLSearchParams(params);
    const url = query.toString() ? `${routeUrl(path)}?${query}` : routeUrl(path);
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
      return await parseJson(response);
    } catch (error) {
      return { ok: false, message: 'Unable to reach the server right now.' };
    }
  };

  const apiPost = async (path, payload) => {
    const body = new URLSearchParams();
    Object.entries(payload || {}).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => body.append(`${key}[]`, item));
        return;
      }
      body.append(key, value ?? '');
    });

    try {
      const response = await fetch(routeUrl(path), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        credentials: 'same-origin',
        body: body.toString(),
      });
      return await parseJson(response);
    } catch (error) {
      return { ok: false, message: 'Unable to reach the server right now.' };
    }
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    guard();
    bind();
    setupNavigation();
    setupTrainingPanels();
    showIdentity();
    showSection('clients');
    loadDashboard();
    loadTraining();
    renderRepaymentsPlaceholder();
  }

  function guard() {
    const role = String(authUser?.role || '').toLowerCase();
    if (!authUser || !role.includes('project')) {
      window.location.href = `${baseUrl}/login`;
    }
  }

  function bind() {
    document.getElementById('po-refresh')?.addEventListener('click', loadDashboard);
    document.getElementById('po-app-refresh')?.addEventListener('click', loadDashboard);
    document.getElementById('po-training-refresh')?.addEventListener('click', loadTraining);
    document.getElementById('po-app-filter')?.addEventListener('change', renderApplicationsTable);
    document.getElementById('po-search')?.addEventListener('input', renderRosterTable);
    document.getElementById('po-logout')?.addEventListener('click', handleLogout);
    document.getElementById('training-filter-reset')?.addEventListener('click', resetTrainingFilters);
    document.getElementById('po-new-client')?.addEventListener('click', () => {
      alert('Beneficiary creation is not part of this backend pass yet.');
    });
    document.getElementById('po-app-table')?.addEventListener('click', handleApplicationClick);
    document.getElementById('po-table')?.addEventListener('click', handleApplicationClick);
    document.getElementById('po-app-modal-approve')?.addEventListener('click', () => submitDecision('approve'));
    document.getElementById('po-app-modal-reject')?.addEventListener('click', () => submitDecision('reject'));
    document.getElementById('po-app-modal-flag')?.addEventListener('click', () => submitDecision('needs_correction'));
    document.getElementById('training-section')?.addEventListener('click', handleTrainingClick);
  }

  function setupNavigation() {
    document.querySelectorAll('[data-section]').forEach((button) => {
      button.addEventListener('click', () => showSection(button.dataset.section));
    });
  }

  function setupTrainingPanels() {
    document.querySelectorAll('[data-training-panel]').forEach((button) => {
      button.addEventListener('click', () => {
        document.querySelectorAll('[data-training-panel]').forEach((item) => item.classList.toggle('is-active', item === button));
        document.querySelectorAll('.training-view').forEach((panel) => {
          panel.classList.toggle('is-active', panel.dataset.panel === button.dataset.trainingPanel);
        });
      });
    });

    const facilitator = document.getElementById('training-filter-facilitator');
    const focus = document.getElementById('training-filter-focus');
    if (facilitator && !facilitator.options.length) {
      facilitator.innerHTML = '<option value="">All coordinators</option>';
    }
    if (focus && !focus.options.length) {
      focus.innerHTML = '<option value="">All topics</option>';
    }
  }

  function resetTrainingFilters() {
    const ids = ['training-filter-facilitator', 'training-filter-focus', 'training-filter-month'];
    ids.forEach((id) => {
      const input = document.getElementById(id);
      if (input) {
        input.value = '';
      }
    });
  }

  function showSection(id) {
    document.querySelectorAll('[data-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.section === id);
    });
    document.querySelectorAll('[data-role-section]').forEach((section) => {
      section.style.display = section.id === `${id}-section` ? 'block' : 'none';
    });
  }

  function showIdentity() {
    const node = document.getElementById('po-identity');
    if (node) {
      node.textContent = authUser?.email ? `${authUser.name} - ${authUser.email}` : (authUser?.name || 'Project Officer');
    }
  }

  async function loadDashboard() {
    const response = await apiGet('api/applications/dashboard');
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      renderLoadError(response.message || 'Unable to load the project officer dashboard.');
      return;
    }

    state.applications = response.data?.applications || [];
    state.roster = response.data?.roster || [];
    state.summary = response.data?.summary || state.summary;
    state.scopeBarangays = response.data?.scopeBarangays || [];

    renderSummary();
    renderRosterTable();
    renderApplicationsTable();
  }

  function renderLoadError(message) {
    const appTable = document.querySelector('#po-app-table tbody');
    const rosterTable = document.querySelector('#po-table tbody');
    if (appTable) {
      appTable.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${escapeHtml(message)}</td></tr>`;
    }
    if (rosterTable) {
      rosterTable.innerHTML = `<tr><td colspan="4" class="text-center text-muted">${escapeHtml(message)}</td></tr>`;
    }
  }

  function renderSummary() {
    const scopeText = state.scopeBarangays.length
      ? state.scopeBarangays.map((item) => item.name).join(', ')
      : 'No assigned barangays';
    document.getElementById('poSummaryClients').textContent = String(state.summary.applications || 0);
    document.getElementById('poSummaryApplications').textContent = String(state.summary.pending || 0);
    const headline = document.querySelector('.content-headline p');
    if (headline) {
      headline.textContent = `Assigned barangays: ${scopeText}`;
    }
  }

  function renderRosterTable() {
    const tbody = document.querySelector('#po-table tbody');
    if (!tbody) return;
    const search = String(document.getElementById('po-search')?.value || '').toLowerCase();

    const rows = state.roster
      .filter((item) => item.name.toLowerCase().includes(search) || String(item.barangay || '').toLowerCase().includes(search))
      .map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>
            <div class="table-primary">${escapeHtml(item.name)}</div>
            <div class="table-secondary">${escapeHtml(item.barangay || '--')}</div>
          </td>
          <td><span class="status-pill">${escapeHtml(item.status)}</span></td>
          <td class="text-end">
            <div class="table-actions">
              <button type="button" class="action-button" data-open-application="${item.id}">
                <i class="fas fa-folder-open"></i><span>Open</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="4" class="text-center text-muted">No scoped applicants found.</td></tr>';
  }

  function renderApplicationsTable() {
    const tbody = document.querySelector('#po-app-table tbody');
    if (!tbody) return;
    const filter = document.getElementById('po-app-filter')?.value || '';
    const rows = state.applications
      .filter((item) => !filter || item.status === filter)
      .map((item) => `
        <tr>
          <td>
            <div class="table-primary">${escapeHtml(item.applicantName)}</div>
            <div class="table-secondary">${escapeHtml(item.email)}</div>
          </td>
          <td>
            <div class="table-primary">${escapeHtml(item.businessName || '--')}</div>
            <div class="table-secondary">${escapeHtml(item.barangay || '--')}</div>
          </td>
          <td>${item.uploadedRequirementCount}/${item.requiredRequirementCount} uploaded</td>
          <td><span class="badge-theme">${escapeHtml(item.status)}</span></td>
          <td>${formatDate(item.submittedAt)}</td>
          <td class="text-end">
            <div class="table-actions">
              <button type="button" class="action-button" data-open-application="${item.id}">
                <i class="fas fa-folder-open"></i><span>Open</span>
              </button>
            </div>
          </td>
        </tr>
      `).join('');

    tbody.innerHTML = rows || '<tr><td colspan="6" class="text-center text-muted">No scoped applications found.</td></tr>';
    const count = document.getElementById('po-app-count');
    if (count) {
      count.textContent = `${state.applications.length} ${state.applications.length === 1 ? 'record' : 'records'}`;
    }
  }

  async function handleApplicationClick(event) {
    const button = event.target.closest('[data-open-application]');
    if (!button) return;
    await openApplication(button.dataset.openApplication);
  }

  async function openApplication(applicationId) {
    const response = await apiGet('api/applications/show', { id: applicationId });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) return;
    state.activeApplication = response.application;
    fillModal(response.application);
    bootstrap.Modal.getOrCreateInstance(document.getElementById('poApplicationModal')).show();
  }

  function fillModal(application) {
    document.getElementById('po-app-modal-title').textContent = application.applicantName;
    document.getElementById('po-app-modal-submitted').textContent = formatDate(application.submittedAt);
    document.getElementById('po-app-modal-status').textContent = application.status;
    document.getElementById('po-app-modal-id').value = application.id;
    document.getElementById('po-app-modal-business').textContent = application.businessName || '--';
    document.getElementById('po-app-modal-email').textContent = application.email || '--';
    document.getElementById('po-app-modal-contact').textContent = application.contactNumber || '--';
    document.getElementById('po-app-modal-sector').textContent = application.sector || '--';
    document.getElementById('po-app-modal-barangay').textContent = application.barangay || '--';
    document.getElementById('po-app-modal-household').textContent = application.householdSize ?? '--';
    document.getElementById('po-app-modal-income').textContent = '--';
    document.getElementById('po-app-modal-livelihood').textContent = application.livelihood || '--';
    const requirements = document.getElementById('po-app-modal-requirements');
    const requirementItems = (application.requirements || []).map((item) => `
      <li class="list-group-item d-flex justify-content-between align-items-start">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <div class="text-muted small">${escapeHtml(item.status || 'missing')}</div>
        </div>
        ${item.file?.url ? `<a href="${escapeHtml(item.file.url)}" target="_blank" rel="noopener">Open</a>` : '<span>No file</span>'}
      </li>
    `).join('');
    const historyItems = (application.history || []).map((entry) => `
      <li class="list-group-item">
        <strong>${escapeHtml(entry.toStatus)}</strong>
        <div class="text-muted small">${escapeHtml(entry.actorName)} | ${formatDate(entry.createdAt)}</div>
        <div>${escapeHtml(entry.remarks || '--')}</div>
      </li>
    `).join('');
    const commentItems = (application.comments || []).map((entry) => `
      <li class="list-group-item">
        <strong>${escapeHtml(entry.actorName)}</strong>
        <div class="text-muted small">${formatDate(entry.createdAt)}</div>
        <div>${escapeHtml(entry.comment || '--')}</div>
      </li>
    `).join('');
    requirements.innerHTML = `
      ${requirementItems || '<li class="list-group-item">No requirement files found.</li>'}
      <li class="list-group-item active">Status History</li>
      ${historyItems || '<li class="list-group-item">No status history yet.</li>'}
      <li class="list-group-item active">Comments</li>
      ${commentItems || '<li class="list-group-item">No comments yet.</li>'}
    `;
  }

  async function submitDecision(decision) {
    if (!state.activeApplication) return;
    const remarks = prompt('Enter remarks for this decision:') || '';
    const response = await apiPost('api/applications/review', {
      applicationId: state.activeApplication.id,
      decision,
      remarks,
    });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      alert(firstError(response.errors) || 'Unable to update application.');
      return;
    }
    bootstrap.Modal.getOrCreateInstance(document.getElementById('poApplicationModal')).hide();
    await loadDashboard();
    await loadTraining();
  }

  async function loadTraining() {
    const [trainingResponse, notificationResponse] = await Promise.all([
      apiGet('api/training'),
      apiGet('api/notifications'),
    ]);

    if (trainingResponse.redirect || notificationResponse.redirect) {
      window.location.href = routeUrl(trainingResponse.redirect || notificationResponse.redirect);
      return;
    }

    if (!trainingResponse.ok) {
      renderTrainingError(trainingResponse.message || 'Unable to load training records.');
      return;
    }

    state.training.programs = trainingResponse.data?.programs || [];
    state.training.summary = trainingResponse.data?.summary || {};
    state.training.notifications = notificationResponse.ok ? (notificationResponse.notifications || []) : [];

    const selectedProgramStillExists = state.training.programs.some((item) => item.id === state.training.selectedProgramId);
    if (!selectedProgramStillExists) {
      state.training.selectedProgramId = state.training.programs[0]?.id || null;
    }

    if (state.training.selectedProgramId) {
      await loadTrainingProgram(state.training.selectedProgramId, false);
    } else {
      state.training.activeProgram = null;
      renderTraining();
    }
  }

  async function loadTrainingProgram(programId, showError = true) {
    const response = await apiGet('api/training/show', { id: programId });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      if (showError) {
        renderTrainingError(response.message || 'Unable to load training program details.');
      }
      return;
    }

    state.training.selectedProgramId = programId;
    state.training.activeProgram = response.program || null;
    renderTraining();
  }

  function renderTraining() {
    const summaryRoot = document.getElementById('po-training-summary');
    const schedulePanel = document.getElementById('training-schedule-panel');
    const rosterTable = document.querySelector('#training-roster-table tbody');
    const attendancePanel = document.getElementById('training-attendance-panel');
    if (!summaryRoot || !schedulePanel || !rosterTable || !attendancePanel) return;

    const summary = state.training.summary || {};
    summaryRoot.innerHTML = `
      <article class="summary-card">
        <h4>Programs</h4>
        <p class="metric">${summary.total || 0}</p>
        <p class="meta">Scoped training schedules</p>
      </article>
      <article class="summary-card">
        <h4>Participants</h4>
        <p class="metric">${summary.participants || 0}</p>
        <p class="meta">Assigned to your barangays</p>
      </article>
      <article class="summary-card">
        <h4>Attended</h4>
        <p class="metric">${summary.attended || 0}</p>
        <p class="meta">Ready for post-approval unlock</p>
      </article>
    `;

    const programRows = state.training.programs.map((program) => `
      <tr>
        <td>
          <div class="table-primary">${escapeHtml(program.programName)}</div>
          <div class="table-secondary">${escapeHtml(program.venue || '--')}</div>
        </td>
        <td>${formatDate(program.date)}</td>
        <td>${escapeHtml(program.startTime || '--')} - ${escapeHtml(program.endTime || '--')}</td>
        <td><span class="status-pill">${escapeHtml(program.status)}</span></td>
        <td>${program.participantCount || 0}</td>
        <td class="text-end">
          <div class="table-actions">
            <button type="button" class="action-button" data-training-open="${program.id}">
              <i class="fas fa-folder-open"></i><span>Open</span>
            </button>
            <button type="button" class="action-button" data-training-send-program="${program.id}">
              <i class="fas fa-paper-plane"></i><span>Send notices</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    schedulePanel.innerHTML = `
      <div class="table-card">
        <div class="table-toolbar">
          <h4>Scheduled sessions</h4>
          <div class="toolbar-actions">
            <span class="chip">${state.training.programs.length} programs</span>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Program</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Participants</th>
                <th class="actions">Actions</th>
              </tr>
            </thead>
            <tbody>${programRows || '<tr><td colspan="6">No scoped training programs found.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `;

    const program = state.training.activeProgram;
    const invitees = program?.invitees || [];
    const chip = document.querySelector('#training-section .toolbar-actions .chip');
    if (chip) {
      chip.textContent = `${invitees.length} participants`;
    }

    rosterTable.innerHTML = invitees.map((invitee) => `
      <tr>
        <td>
          <div class="table-primary">${escapeHtml(invitee.user.name)}</div>
          <div class="table-secondary">${escapeHtml(invitee.barangay || '--')}</div>
        </td>
        <td><span class="status-pill">${escapeHtml(invitee.status)}</span></td>
        <td>${invitee.postApprovalUnlockedAt ? 'Unlocked' : 'Pending completion'}</td>
        <td>${escapeHtml(invitee.remarks || '--')}</td>
        <td class="actions">
          <div class="table-actions">
            <button type="button" class="action-button" data-training-send-invitee="${invitee.id}">
              <i class="fas fa-bell"></i><span>Notify</span>
            </button>
            <button type="button" class="action-button" data-training-update="${invitee.id}">
              <i class="fas fa-clipboard-check"></i><span>Update</span>
            </button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5">Open a training program to manage participant attendance.</td></tr>';

    attendancePanel.innerHTML = `
      <div class="table-card">
        <div class="table-toolbar">
          <h4>${program ? escapeHtml(program.programName) : 'Attendance updates'}</h4>
          <div class="toolbar-actions">
            <span class="chip">${invitees.filter((item) => ['Attended', 'Completed'].includes(item.status)).length} attended/completed</span>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Current status</th>
                <th>Last notice</th>
                <th>Attendance</th>
                <th class="actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${invitees.map((invitee) => `
                <tr>
                  <td>${escapeHtml(invitee.user.name)}</td>
                  <td>${escapeHtml(invitee.status)}</td>
                  <td>${formatDate(invitee.lastNoticeSentAt || invitee.notifiedAt)}</td>
                  <td>
                    <select class="section-filter" data-training-status-select="${invitee.id}">
                      ${trainingStatuses.map((status) => `<option value="${status}" ${status === invitee.status ? 'selected' : ''}>${status}</option>`).join('')}
                    </select>
                  </td>
                  <td class="actions">
                    <button type="button" class="action-button" data-training-save-status="${invitee.id}">
                      <i class="fas fa-floppy-disk"></i><span>Save</span>
                    </button>
                  </td>
                </tr>
              `).join('') || '<tr><td colspan="5">No invitees assigned yet.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
      <div class="table-card light">
        <div class="table-toolbar">
          <h4>Recent training notifications</h4>
        </div>
        <ul class="list-group list-group-flush">
          ${(state.training.notifications || [])
            .filter((item) => String(item.channel || '').includes('training'))
            .slice(0, 5)
            .map((item) => `<li class="list-group-item"><strong>${escapeHtml(item.title)}</strong><div>${escapeHtml(item.message)}</div><small class="text-muted">${formatDate(item.createdAt)}</small></li>`)
            .join('') || '<li class="list-group-item">No training notifications logged yet.</li>'}
        </ul>
      </div>
    `;
  }

  function renderTrainingError(message) {
    const schedulePanel = document.getElementById('training-schedule-panel');
    const rosterTable = document.querySelector('#training-roster-table tbody');
    const attendancePanel = document.getElementById('training-attendance-panel');
    const summaryRoot = document.getElementById('po-training-summary');
    if (summaryRoot) {
      summaryRoot.innerHTML = `<article class="summary-card"><h4>Training</h4><p class="meta">${escapeHtml(message)}</p></article>`;
    }
    if (schedulePanel) {
      schedulePanel.innerHTML = `<div class="table-card"><p>${escapeHtml(message)}</p></div>`;
    }
    if (rosterTable) {
      rosterTable.innerHTML = `<tr><td colspan="5">${escapeHtml(message)}</td></tr>`;
    }
    if (attendancePanel) {
      attendancePanel.innerHTML = `<div class="table-card"><p>${escapeHtml(message)}</p></div>`;
    }
  }

  async function handleTrainingClick(event) {
    const openButton = event.target.closest('[data-training-open]');
    if (openButton) {
      await loadTrainingProgram(Number(openButton.dataset.trainingOpen));
      return;
    }

    const sendProgram = event.target.closest('[data-training-send-program]');
    if (sendProgram) {
      await sendTrainingNotices(Number(sendProgram.dataset.trainingSendProgram));
      return;
    }

    const sendInvitee = event.target.closest('[data-training-send-invitee]');
    if (sendInvitee && state.training.activeProgram) {
      await sendTrainingNotices(state.training.activeProgram.id, [Number(sendInvitee.dataset.trainingSendInvitee)]);
      return;
    }

    const saveStatus = event.target.closest('[data-training-save-status]');
    if (saveStatus) {
      await updateTrainingAttendance(Number(saveStatus.dataset.trainingSaveStatus));
      return;
    }

    const quickUpdate = event.target.closest('[data-training-update]');
    if (quickUpdate) {
      await updateTrainingAttendance(Number(quickUpdate.dataset.trainingUpdate));
    }
  }

  async function sendTrainingNotices(programId, inviteeIds = []) {
    const response = await apiPost('api/training/notices', { programId, inviteeIds });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      alert(firstError(response.errors) || 'Unable to send notices.');
      return;
    }

    await loadTrainingProgram(programId, false);
    await loadTraining();
  }

  async function updateTrainingAttendance(trainingInviteeId) {
    const select = document.querySelector(`[data-training-status-select="${trainingInviteeId}"]`);
    const status = select?.value || 'Scheduled';
    const remarks = prompt('Enter attendance remarks (optional):') || '';
    const response = await apiPost('api/training/attendance', {
      trainingInviteeId,
      status,
      remarks,
    });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      alert(firstError(response.errors) || 'Unable to update attendance.');
      return;
    }

    if (state.training.selectedProgramId) {
      await loadTrainingProgram(state.training.selectedProgramId, false);
    }
    await loadTraining();
  }

  function renderRepaymentsPlaceholder() {
    const tbody = document.querySelector('#po-repay-table tbody');
    if (tbody) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Repayment backend is intentionally out of scope for this pass.</td></tr>';
    }
  }

  async function handleLogout() {
    try {
      await fetch(`${baseUrl}/auth/logout`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      });
    } finally {
      window.location.href = `${baseUrl}/login`;
    }
  }

  function formatDate(value) {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function firstError(errors) {
    if (!errors || typeof errors !== 'object') return '';
    const values = Object.values(errors);
    return values.length ? values[0] : '';
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();

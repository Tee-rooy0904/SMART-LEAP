(function () {
  const { qs, on, setHTML } = window.App.dom;
  const { formatDate } = window.App.format;

  const state = {
    filters: { status: '', date: '', programName: '' },
    data: { programs: [], eligibleInvitees: [], summary: {}, statuses: [] },
    activeProgram: null,
    editingId: null,
    searchTimer: null,
  };

  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');

  const routeUrl = (path) => `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;

  const section = () => qs('#training-section');

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

  const apiFormPost = async (path, formData) => {
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
  };

  const renderShell = () => {
    const target = section();
    if (!target) return;

    setHTML(target, `
      <div class="training-workspace">
        <section class="training-hero">
          <div class="training-hero__copy">
            <span class="training-hero__eyebrow">Admin Training Workspace</span>
            <h3>Manage approved applicants from scheduling to attendance completion.</h3>
          </div>
          <div class="training-hero__actions">
            <button type="button" class="app-btn-primary" id="training-focus-create">
              <i class="fas fa-plus"></i>
              <span>Create Training Program</span>
            </button>
            <button type="button" class="app-btn-outline" id="training-refresh">
              <i class="fas fa-rotate-right"></i>
              <span>Refresh</span>
            </button>
          </div>
        </section>

        <div class="notice" id="training-notice" hidden></div>

        <div class="training-shell-grid">
          <section class="training-panel training-panel--form" id="training-program-form"></section>
          <section class="training-panel training-panel--summary" id="training-kpis"></section>
        </div>

        <section class="training-panel training-panel--filters" id="training-filters"></section>
        <section class="training-panel training-panel--table" id="training-program-table"></section>
        <section class="training-panel training-panel--detail" id="training-program-detail"></section>
      </div>
    `);
  };

  const renderSummary = () => {
    const summary = state.data.summary || {};
    const root = qs('#training-kpis');
    if (!root) return;

    setHTML(root, `
      <div class="training-panel__header">
        <div>
          <span class="training-panel__eyebrow">Live training status</span>
          <h4>Operational summary</h4>
        </div>
      </div>
      <div class="training-kpi-grid">
        ${renderKpi('Programs', summary.total || 0)}
        ${renderKpi('Scheduled', summary.scheduled || 0)}
        ${renderKpi('Notified', summary.notified || 0)}
        ${renderKpi('Participants', summary.participants || 0)}
        ${renderKpi('Attended', summary.attended || 0)}
        ${renderKpi('Excused', summary.excused || 0)}
        ${renderKpi('Completed', summary.completed || 0)}
      </div>
    `);
  };

  const renderFilters = () => {
    const root = qs('#training-filters');
    if (!root) return;

    const statuses = [''].concat(state.data.statuses || []);
    setHTML(root, `
      <div class="training-panel__header training-panel__header--compact">
        <div>
          <span class="training-panel__eyebrow">Program filters</span>
          <h4>Find a training schedule quickly</h4>
        </div>
      </div>
      <div class="applications-filters training-filters">
        <div class="filter-group">
          <span class="filter-label">Status</span>
          <select id="training-filter-status" class="filter-select">
            ${statuses.map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${escapeHtml(status || 'All statuses')}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">Date</span>
          <input type="date" id="training-filter-date" class="filter-select" value="${escapeHtml(state.filters.date)}">
        </div>
        <label class="filter-search applications-search">
          <i class="fas fa-search"></i>
          <input type="search" id="training-filter-name" placeholder="Search training program name" value="${escapeHtml(state.filters.programName)}">
        </label>
        <div class="filter-actions">
          <button class="app-btn-ghost" id="training-filter-reset">Reset</button>
        </div>
      </div>
    `);
  };

  const renderProgramForm = () => {
    const root = qs('#training-program-form');
    if (!root) return;

    const editing = (state.data.programs || []).find((item) => item.id === state.editingId) || null;
    const statuses = state.data.statuses || [];

    setHTML(root, `
      <div class="training-panel__header">
        <div>
          <span class="training-panel__eyebrow">${editing ? 'Update program' : 'Create training program'}</span>
          <h4>${editing ? escapeHtml(editing.programName) : 'Schedule a new SMART LEAP training session'}</h4>
        </div>
        ${editing ? '<button class="app-btn-ghost" id="training-cancel-edit">Cancel edit</button>' : ''}
      </div>
      <form id="training-program-save-form" class="training-form-grid">
        <input type="hidden" name="programId" value="${editing ? editing.id : ''}">
        <label>
          <span>Program name</span>
          <input type="text" name="programName" value="${escapeHtml(editing?.programName || '')}" required>
        </label>
        <label>
          <span>Venue</span>
          <input type="text" name="venue" value="${escapeHtml(editing?.venue || '')}" placeholder="CSWDD Training Hall">
        </label>
        <label>
          <span>Speaker</span>
          <input type="text" name="speaker" value="${escapeHtml(editing?.speaker || '')}" placeholder="Name of speaker or facilitator">
        </label>
        <label>
          <span>Date</span>
          <input type="date" name="date" value="${escapeHtml(editing?.date || '')}" required>
        </label>
        <label>
          <span>Status</span>
          <select name="status">
            ${statuses.map((status) => `<option value="${status}" ${status === (editing?.status || 'Scheduled') ? 'selected' : ''}>${escapeHtml(status)}</option>`).join('')}
          </select>
        </label>
        <label>
          <span>Training coverage</span>
          <select name="trainingMode">
            <option value="all" ${(editing?.trainingMode || 'all') === 'all' ? 'selected' : ''}>All participants</option>
            <option value="batch" ${(editing?.trainingMode || 'all') === 'batch' ? 'selected' : ''}>By batch</option>
          </select>
        </label>
        <label>
          <span>Start time</span>
          <input type="time" name="startTime" value="${escapeHtml(editing?.startTime || '')}" required>
        </label>
        <label>
          <span>End time</span>
          <input type="time" name="endTime" value="${escapeHtml(editing?.endTime || '')}" required>
        </label>
        <label class="training-form-grid__wide">
          <span>Description</span>
          <textarea name="description" rows="3" placeholder="Summarize the session objectives and flow.">${escapeHtml(editing?.description || '')}</textarea>
        </label>
        <label class="training-form-grid__wide">
          <span>What to bring</span>
          <textarea name="whatToBring" rows="2" placeholder="List requirements participants should bring on the day.">${escapeHtml(editing?.whatToBring || '')}</textarea>
        </label>
        <label class="training-form-grid__wide">
          <span>Instructions</span>
          <textarea name="instructions" rows="3" placeholder="Add arrival instructions, dress code, or attendance guidance.">${escapeHtml(editing?.instructions || '')}</textarea>
        </label>
        <div class="training-form-grid__wide training-inline-note">
          ${(editing?.trainingMode || 'all') === 'batch'
            ? 'Batch mode uses 3 groups with 85 participants each, regardless of barangay.'
            : 'All mode can include the full SMART LEAP training roster without a participant cap.'}
        </div>
        <div class="training-form-grid__actions">
          <button type="submit" class="app-btn-primary">${editing ? 'Save program changes' : 'Create training program'}</button>
        </div>
      </form>
    `);
  };

  const renderProgramTable = () => {
    const root = qs('#training-program-table');
    if (!root) return;

    const programs = state.data.programs || [];
    const rows = programs.map((program) => `
      <tr class="${state.activeProgram && state.activeProgram.id === program.id ? 'is-selected' : ''}">
        <td>
          <div class="applicant-cell">
            <strong>${escapeHtml(program.programName)}</strong>
            <span>${escapeHtml(program.description || '--')}</span>
          </div>
        </td>
        <td>${formatDate(program.date)}</td>
        <td>${escapeHtml(program.venue || '--')}</td>
        <td>${escapeHtml(program.speaker || '--')}</td>
        <td>${escapeHtml(program.startTime || '--')} - ${escapeHtml(program.endTime || '--')}</td>
        <td>${escapeHtml(trainingModeLabel(program.trainingMode))}</td>
        <td><span class="status-badge ${statusClass(program.status)}">${escapeHtml(program.status)}</span></td>
        <td>${program.participantCount || 0}</td>
        <td>${program.completedCount || 0}</td>
        <td class="actions">
          <button class="app-btn-outline" data-training-open="${program.id}">Open workspace</button>
          <button class="app-btn-ghost" data-training-edit="${program.id}">Edit</button>
        </td>
      </tr>
    `).join('');

    setHTML(root, `
      <div class="training-panel__header">
        <div>
          <span class="training-panel__eyebrow">Program registry</span>
          <h4>Training programs</h4>
        </div>
        <span class="chip">${programs.length} ${programs.length === 1 ? 'program' : 'programs'}</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Program</th>
              <th>Date</th>
              <th>Venue</th>
              <th>Speaker</th>
              <th>Time</th>
              <th>Coverage</th>
              <th>Status</th>
              <th>Participants</th>
              <th>Completed</th>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10"><div class="training-empty training-empty--inline">No training programs found yet.</div></td></tr>'}</tbody>
        </table>
      </div>
    `);
  };

  const renderProgramDetail = () => {
    const root = qs('#training-program-detail');
    if (!root) return;

    const program = state.activeProgram;
    if (!program) {
      setHTML(root, `
        <div class="training-empty">
          <div class="training-empty__icon"><i class="fas fa-chalkboard-user"></i></div>
          <h4>Select a training program</h4>
        </div>
      `);
      return;
    }

    const invitees = Array.isArray(program.invitees) ? program.invitees : [];
    const selectedInvitees = new Set(invitees.map((item) => String(item.applicantProfileId)));
    const eligibleRows = (state.data.eligibleInvitees || []).map((invitee) => `
      <label class="training-picklist__item">
        <input type="checkbox" name="applicantProfileIds" value="${invitee.applicantProfileId}" ${selectedInvitees.has(String(invitee.applicantProfileId)) ? 'checked' : ''}>
        <span class="training-picklist__text">
          <strong>${escapeHtml(invitee.name)}</strong>
          <small>${escapeHtml(invitee.barangay || '--')} | ${escapeHtml(invitee.businessName || '--')} | ${escapeHtml(invitee.status || '--')}</small>
        </span>
      </label>
    `).join('');
    const participantRows = invitees.map((invitee) => `
      <tr>
        <td>
          <div class="applicant-cell">
            <strong>${escapeHtml(invitee.user?.name || '')}</strong>
            <span>${escapeHtml(invitee.barangay || '--')}</span>
          </div>
        </td>
        <td>${escapeHtml(invitee.businessName || '--')}</td>
        <td>${invitee.batchGroupNumber ? `Group ${escapeHtml(String(invitee.batchGroupNumber))}` : 'All'}</td>
        <td><span class="status-badge ${statusClass(invitee.status)}">${escapeHtml(trainingStatusLabel(invitee.status))}</span></td>
        <td>${invitee.lastNoticeSentAt || invitee.notifiedAt ? '<span class="training-pill training-pill--info">Notice sent</span>' : '<span class="training-pill">Pending notice</span>'}</td>
        <td>${formatDate(invitee.lastNoticeSentAt || invitee.notifiedAt)}</td>
        <td>${formatDate(invitee.checkedInAt)}</td>
        <td>
          <select class="filter-select" data-training-status-select="${invitee.id}">
            ${['Scheduled', 'Notified', 'Attended', 'Excused', 'Missed', 'Completed'].map((status) => `<option value="${status}" ${status === invitee.status ? 'selected' : ''}>${escapeHtml(status === 'Missed' ? 'Absent' : status)}</option>`).join('')}
          </select>
        </td>
        <td>
          <textarea class="filter-select" data-training-remarks="${invitee.id}" rows="2" placeholder="Remarks or proof note">${escapeHtml(invitee.remarks || '')}</textarea>
        </td>
        <td>
          <div class="training-proof-cell">
            ${invitee.proofAttachment?.file_path ? `<a class="app-btn-ghost" href="${escapeHtml(routeUrl(invitee.proofAttachment.file_path))}" target="_blank" rel="noopener">View proof</a>` : '<span class="table-subcopy">No proof</span>'}
            <input type="file" data-training-proof="${invitee.id}" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf">
          </div>
        </td>
        <td class="actions">
          <button class="app-btn-outline" data-training-send-invitee="${invitee.id}">Send notice</button>
          <button class="app-btn-primary" data-training-save-attendance="${invitee.id}">Save</button>
        </td>
      </tr>
    `).join('');
    const attendanceSummary = summarizeAttendance(invitees);

    setHTML(root, `
      <div class="training-panel__header">
        <div>
          <span class="training-panel__eyebrow">Program workspace</span>
          <h4>${escapeHtml(program.programName)}</h4>
        </div>
        <div class="training-workspace__status">
          <span class="status-badge ${statusClass(program.status)}">${escapeHtml(program.status)}</span>
          <span class="chip">${invitees.length} participants</span>
        </div>
      </div>

      <div class="training-detail-overview">
        <article class="training-overview-card">
          <span class="training-overview-card__label">Schedule</span>
          <strong>${formatDate(program.date)}</strong>
          <small>${escapeHtml(program.startTime || '--')} - ${escapeHtml(program.endTime || '--')}</small>
        </article>
        <article class="training-overview-card">
          <span class="training-overview-card__label">Venue</span>
          <strong>${escapeHtml(program.venue || '--')}</strong>
          <small>${escapeHtml(program.description || '--')}</small>
        </article>
        <article class="training-overview-card">
          <span class="training-overview-card__label">Speaker</span>
          <strong>${escapeHtml(program.speaker || '--')}</strong>
        </article>
        <article class="training-overview-card">
          <span class="training-overview-card__label">Coverage</span>
          <strong>${escapeHtml(trainingModeLabel(program.trainingMode))}</strong>
          <small>${program.trainingMode === 'batch' ? '3 groups of up to 85 each' : 'No participant cap for all-mode sessions'}</small>
        </article>
        <article class="training-overview-card">
          <span class="training-overview-card__label">What to bring</span>
          <strong>${escapeHtml(program.whatToBring || '--')}</strong>
        </article>
        <article class="training-overview-card">
          <span class="training-overview-card__label">Instructions</span>
          <strong>${escapeHtml(program.instructions || '--')}</strong>
        </article>
      </div>

      <div class="training-detail-grid">
        <section class="training-subpanel">
          <div class="training-subpanel__header">
            <div>
              <span class="training-panel__eyebrow">Eligible applicants</span>
              <h5>Assign approved participants</h5>
            </div>
            <span class="chip">${(state.data.eligibleInvitees || []).length} eligible</span>
          </div>
          <form id="training-invitee-form" class="training-picklist">
            <input type="hidden" name="programId" value="${program.id}">
            <div class="training-picklist__body">
              ${eligibleRows || '<div class="training-empty training-empty--inline">No approved applicants are eligible for training yet.</div>'}
            </div>
            <div class="training-picklist__actions">
              <button type="submit" class="app-btn-primary">Save participant list</button>
            </div>
          </form>
        </section>

        <section class="training-subpanel">
          <div class="training-subpanel__header">
            <div>
              <span class="training-panel__eyebrow">Notice actions</span>
              <h5>Send or resend training notices</h5>
            </div>
          </div>
          <div class="training-action-stack">
            <div class="training-action-card">
              <strong>Bulk notice dispatch</strong>
              <button class="app-btn-primary" data-training-send-program="${program.id}">Send notices to all invitees</button>
            </div>
            <div class="training-action-card">
              <strong>Attendance overview</strong>
              <div class="training-attendance-list">
                ${Object.entries(attendanceSummary).map(([label, count]) => `
                  <div class="training-attendance-item">
                    <span>${label}</span>
                    <strong>${count}</strong>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section class="training-subpanel training-subpanel--participants">
        <div class="training-subpanel__header">
          <div>
            <span class="training-panel__eyebrow">Program participants</span>
            <h5>Invitees, notice status, and attendance visibility</h5>
          </div>
          <span class="chip">${invitees.length} assigned</span>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Business</th>
                <th>Group</th>
                <th>Attendance status</th>
                <th>Notice state</th>
                <th>Last notice</th>
                <th>Attendance recorded</th>
                <th>Update status</th>
                <th>Remarks</th>
                <th>Excuse proof</th>
                <th class="actions">Actions</th>
              </tr>
            </thead>
            <tbody>${participantRows || '<tr><td colspan="11"><div class="training-empty training-empty--inline">No participants assigned yet.</div></td></tr>'}</tbody>
          </table>
        </div>
      </section>
    `);
  };

  const renderKpi = (label, value, meta = '') => `
    <article class="training-kpi-card">
      <span class="training-kpi-card__label">${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
      ${meta ? `<small>${escapeHtml(meta)}</small>` : ''}
    </article>
  `;

  const summarizeAttendance = (invitees) => {
    const summary = {
      Scheduled: 0,
      Notified: 0,
      Attended: 0,
      Excused: 0,
      Missed: 0,
      Completed: 0,
    };

    invitees.forEach((invitee) => {
      const key = String(invitee.status || '');
      if (Object.prototype.hasOwnProperty.call(summary, key)) {
        summary[key] += 1;
      }
    });

    return summary;
  };

  const load = async () => {
    clearNotice();
    const response = await apiGet('api/training', state.filters);
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(response.message || 'Unable to load training programs.', 'danger');
      return;
    }

    state.data = response.data || state.data;

    if (state.activeProgram && !(state.data.programs || []).some((item) => item.id === state.activeProgram.id)) {
      state.activeProgram = null;
    }

    renderSummary();
    renderFilters();
    renderProgramForm();
    renderProgramTable();

    if (state.activeProgram) {
      await loadProgramDetail(state.activeProgram.id, false);
      return;
    }

    renderProgramDetail();
  };

  const loadProgramDetail = async (programId, showNoticeOnError = true) => {
    const response = await apiGet('api/training/show', { id: programId });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      if (showNoticeOnError) {
        showNotice(response.message || 'Unable to load training program details.', 'danger');
      }
      return;
    }

    state.activeProgram = response.program || null;
    renderProgramTable();
    renderProgramDetail();
  };

  const submitProgramForm = async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      showNotice('Unable to read the training form.', 'danger');
      return;
    }

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());
    const response = await apiPost(payload.programId ? 'api/training/update' : 'api/training', payload);
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(firstError(response.errors) || 'Unable to save training program.', 'danger');
      return;
    }

    state.editingId = null;
    showNotice('Training program saved.', 'success');
    await load();
    if (response.programId) {
      await loadProgramDetail(response.programId, false);
    }
  };

  const submitInviteeForm = async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      showNotice('Unable to read the participant assignment form.', 'danger');
      return;
    }

    const formData = new FormData(form);
    const payload = {
      programId: formData.get('programId') || '',
      applicantProfileIds: formData.getAll('applicantProfileIds'),
    };
    const response = await apiPost('api/training/invitees', payload);
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(firstError(response.errors) || 'Unable to save training participants.', 'danger');
      return;
    }

    showNotice('Training participants updated.', 'success');
    await load();
    if (payload.programId) {
      await loadProgramDetail(Number(payload.programId), false);
    }
  };

  const sendNotices = async (programId, inviteeIds = []) => {
    const response = await apiPost('api/training/notices', { programId, inviteeIds });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(firstError(response.errors) || 'Unable to send training notices.', 'danger');
      return;
    }

    showNotice(`Training notices processed. ${response.sentCount || 0} sent or logged.`, 'success');
    await loadProgramDetail(programId, false);
    await load();
  };

  const updateAttendance = async (trainingInviteeId) => {
    const statusSelect = qs(`[data-training-status-select="${trainingInviteeId}"]`, section());
    const remarksField = qs(`[data-training-remarks="${trainingInviteeId}"]`, section());
    const proofField = qs(`[data-training-proof="${trainingInviteeId}"]`, section());
    const payload = new FormData();
    payload.append('trainingInviteeId', String(trainingInviteeId));
    payload.append('status', String(statusSelect?.value || 'Scheduled'));
    payload.append('remarks', String(remarksField?.value || ''));
    if (proofField instanceof HTMLInputElement && proofField.files?.[0]) {
      payload.append('proofAttachment', proofField.files[0]);
    }

    const response = await apiFormPost('api/training/attendance', payload);
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(firstError(response.errors) || 'Unable to update training attendance.', 'danger');
      return;
    }

    showNotice('Attendance updated.', 'success');
    if (state.activeProgram?.id) {
      await loadProgramDetail(state.activeProgram.id, false);
    }
    await load();
  };

  const showNotice = (message, tone = 'info') => {
    const notice = qs('#training-notice');
    if (!notice) return;

    notice.hidden = false;
    notice.className = `notice ${tone}`;
    notice.textContent = message;
    notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const clearNotice = () => {
    const notice = qs('#training-notice');
    if (!notice) return;

    notice.hidden = true;
    notice.textContent = '';
    notice.className = 'notice';
  };

  const focusCreateForm = () => {
    state.editingId = null;
    renderProgramForm();
    const target = qs('#training-program-form');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const bind = () => {
    const target = section();
    if (!target || target.dataset.trainingBound === 'true') return;
    target.dataset.trainingBound = 'true';

    on(target, 'change', (event) => {
      if (event.target.id === 'training-filter-status') {
        state.filters.status = event.target.value;
        load();
      }

      if (event.target.id === 'training-filter-date') {
        state.filters.date = event.target.value;
        load();
      }
    });

    on(target, 'input', (event) => {
      if (event.target.id !== 'training-filter-name') {
        return;
      }

      state.filters.programName = event.target.value;
      clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(() => {
        load();
      }, 200);
    });

    on(target, 'click', async (event) => {
      if (event.target.closest('#training-filter-reset')) {
        state.filters = { status: '', date: '', programName: '' };
        await load();
        return;
      }

      if (event.target.closest('#training-cancel-edit')) {
        state.editingId = null;
        renderProgramForm();
        return;
      }

      if (event.target.closest('#training-focus-create')) {
        focusCreateForm();
        return;
      }

      if (event.target.closest('#training-refresh')) {
        await load();
        return;
      }

      const edit = event.target.closest('[data-training-edit]');
      if (edit) {
        state.editingId = Number(edit.dataset.trainingEdit);
        renderProgramForm();
        focusCreateForm();
        return;
      }

      const open = event.target.closest('[data-training-open]');
      if (open) {
        await loadProgramDetail(Number(open.dataset.trainingOpen));
        qs('#training-program-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const sendProgram = event.target.closest('[data-training-send-program]');
      if (sendProgram) {
        await sendNotices(Number(sendProgram.dataset.trainingSendProgram));
        return;
      }

      const sendInvitee = event.target.closest('[data-training-send-invitee]');
      if (sendInvitee && state.activeProgram) {
        await sendNotices(state.activeProgram.id, [Number(sendInvitee.dataset.trainingSendInvitee)]);
        return;
      }

      const saveAttendance = event.target.closest('[data-training-save-attendance]');
      if (saveAttendance) {
        await updateAttendance(Number(saveAttendance.dataset.trainingSaveAttendance));
      }
    });

    on(target, 'submit', (event) => {
      if (event.target.id === 'training-program-save-form') {
        submitProgramForm(event);
      }

      if (event.target.id === 'training-invitee-form') {
        submitInviteeForm(event);
      }
    });
  };

  const statusClass = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'completed' || value === 'attended') return 'is-success';
    if (value === 'excused') return 'is-warning';
    if (value === 'missed') return 'is-danger';
    if (value === 'notified' || value === 'scheduled') return 'is-warning';
    return 'is-muted';
  };

  const trainingModeLabel = (mode) => String(mode || '').toLowerCase() === 'batch'
    ? 'Batch (3 groups × 85)'
    : 'All participants';

  const trainingStatusLabel = (status) => String(status || '') === 'Missed' ? 'Absent' : String(status || '--');

  const firstError = (errors) => {
    if (!errors || typeof errors !== 'object') return '';
    const values = Object.values(errors);
    return values.length ? values[0] : '';
  };

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const init = () => {
    if (!section()) return;
    renderShell();
    bind();
    load();
  };

  window.App.modules = window.App.modules || {};
  window.App.modules.training = { init };
})();

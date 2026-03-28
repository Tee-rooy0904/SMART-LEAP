(function () {
  const { qs, on, setHTML } = window.App.dom;
  const { formatDate } = window.App.format;

  const state = {
    filters: { role: '', status: '', barangayId: '', search: '' },
    staff: [],
    meta: { roles: [], statuses: [], barangays: [] },
    editingId: null,
  };

  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');

  const routeUrl = (path) => `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;
  const teamSection = () => qs('#team-section');
  const teamModalHost = () => {
    let host = document.getElementById('team-modal-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'team-modal-host';
      document.body.appendChild(host);
    }
    return host;
  };

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

  const escapeHtml = (value) => String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const firstError = (errors) => {
    if (!errors || typeof errors !== 'object') return '';
    const values = Object.values(errors);
    return values.length ? values[0] : '';
  };

  const getRoleLabel = (role) => {
    const match = (state.meta.roles || []).find((item) => item.value === role);
    return match ? match.label : role;
  };

  const statusClass = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'active') return 'is-success';
    if (value === 'disabled') return 'is-danger';
    return 'is-warning';
  };

  const nextStatus = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'active') return 'inactive';
    if (value === 'inactive') return 'disabled';
    return 'active';
  };

  const buttonLabel = (status) => {
    const target = nextStatus(status);
    return target === 'inactive' ? 'Inactivate' : target === 'disabled' ? 'Disable' : 'Activate';
  };

  const roleDescription = (role) => {
    return '';
  };

  const getVisibleStaff = () => {
    const barangayId = String(state.filters.barangayId || '');
    return (state.staff || []).filter((item) => {
      if (!barangayId) return true;
      return (item.assignedBarangays || []).some((barangay) => String(barangay.id) === barangayId);
    });
  };

  const getSummary = () => {
    const visible = getVisibleStaff();
    return {
      total: visible.length,
      active: visible.filter((item) => String(item.status).toLowerCase() === 'active').length,
      inactive: visible.filter((item) => String(item.status).toLowerCase() === 'inactive').length,
      disabled: visible.filter((item) => String(item.status).toLowerCase() === 'disabled').length,
      pdo: visible.filter((item) => String(item.role).toLowerCase() === 'pdo').length,
      socialWorker: visible.filter((item) => String(item.role).toLowerCase() === 'social_worker').length,
    };
  };

  const renderShell = () => {
    const section = teamSection();
    if (!section) return;

    setHTML(section, `
      <div class="applications-header team-header">
        <div>
          <h3>Team</h3>
        </div>
        <div class="applications-header__actions">
          <button type="button" class="app-btn-primary" id="team-focus-form">Add Staff</button>
        </div>
      </div>
      <div id="team-summary-strip"></div>
      <div class="applications-filters" id="team-filters"></div>
      <div class="team-workspace-grid">
        <div class="table-card team-table-shell" id="team-table-card"></div>
      </div>
      <div class="team-status-strip" id="team-status-strip"></div>
      <div class="notice" id="team-notice" hidden></div>
    `);
    renderModalShell();
  };

  const renderModalShell = () => {
    setHTML(teamModalHost(), `
      <div class="team-modal" id="team-modal" hidden>
        <div class="team-modal__backdrop" data-team-modal-close></div>
        <div class="team-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
          <div id="team-form-card"></div>
        </div>
      </div>
    `);
  };

  const renderSummary = () => {
    const root = qs('#team-summary-strip');
    if (!root) return;
    const summary = getSummary();

    setHTML(root, `
      <div class="metric-grid metric-grid--compact">
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Total Staff</span>
          <strong class="metric-card__value">${summary.total}</strong>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Active</span>
          <strong class="metric-card__value">${summary.active}</strong>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Inactive</span>
          <strong class="metric-card__value">${summary.inactive}</strong>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Disabled</span>
          <strong class="metric-card__value">${summary.disabled}</strong>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">PDO Count</span>
          <strong class="metric-card__value">${summary.pdo}</strong>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Social Worker Count</span>
          <strong class="metric-card__value">${summary.socialWorker}</strong>
        </article>
      </div>
    `);
  };

  const renderFilters = () => {
    const root = qs('#team-filters');
    if (!root) return;

    const roleOptions = (state.meta.roles || []).map((role) => `
      <option value="${role.value}" ${state.filters.role === role.value ? 'selected' : ''}>${role.label}</option>
    `).join('');
    const statusOptions = (state.meta.statuses || []).map((status) => `
      <option value="${status.value}" ${state.filters.status === status.value ? 'selected' : ''}>${status.label}</option>
    `).join('');
    const barangayOptions = (state.meta.barangays || []).map((barangay) => `
      <option value="${barangay.id}" ${String(state.filters.barangayId) === String(barangay.id) ? 'selected' : ''}>${barangay.name}</option>
    `).join('');

    setHTML(root, `
      <div class="filter-group">
        <span class="filter-label">Role</span>
        <select id="team-filter-role" class="filter-select">
          <option value="">All roles</option>
          ${roleOptions}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Status</span>
        <select id="team-filter-status" class="filter-select">
          <option value="">All statuses</option>
          ${statusOptions}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Barangay</span>
        <select id="team-filter-barangay" class="filter-select">
          <option value="">All barangays</option>
          ${barangayOptions}
        </select>
      </div>
      <div class="filter-search applications-search">
        <i class="fas fa-search"></i>
        <input type="search" id="team-filter-search" placeholder="Search staff by name or email" value="${escapeHtml(state.filters.search)}">
      </div>
      <div class="filter-actions">
        <button class="app-btn-ghost" id="team-filter-reset">Reset</button>
      </div>
    `);
  };

  const renderTable = () => {
    const root = qs('#team-table-card');
    if (!root) return;

    const rows = getVisibleStaff().map((item) => `
      <tr>
        <td>
          <div class="applicant-cell">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.email)}</span>
          </div>
        </td>
        <td>${escapeHtml(item.roleLabel || getRoleLabel(item.role))}</td>
        <td>${item.assignedBarangays.length ? item.assignedBarangays.map((barangay) => escapeHtml(barangay.name)).join(', ') : '--'}</td>
        <td><span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
        <td>${formatDate(item.lastLoginAt)}</td>
        <td class="actions">
          <button class="team-action-button team-action-button--soft" data-team-edit="${item.id}">View</button>
          <button class="team-action-button team-action-button--primary" data-team-edit="${item.id}">Edit</button>
          ${String(item.role).toLowerCase() === 'pdo' ? `<button class="team-action-button team-action-button--soft" data-team-edit="${item.id}">Assign Barangay</button>` : ''}
          <button class="team-action-button team-action-button--outline" data-team-status="${item.id}" data-next-status="${nextStatus(item.status)}">${buttonLabel(item.status)}</button>
        </td>
      </tr>
    `).join('');

    setHTML(root, `
      <div class="table-toolbar">
        <h4>Staff Accounts</h4>
        <span class="chip">${getVisibleStaff().length} records</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table team-roster-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Role</th>
              <th>Assigned Barangay(s)</th>
              <th>Status</th>
              <th>Last Active</th>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6">No staff accounts found for the current filter set.</td></tr>'}</tbody>
        </table>
      </div>
    `);
  };

  const renderForm = () => {
    const root = qs('#team-form-card');
    if (!root) return;

    const editing = state.staff.find((item) => item.id === state.editingId) || null;
    const roleValue = editing ? editing.role : 'pdo';
    const statusValue = editing ? editing.status : 'active';
    const assignedIds = new Set((editing?.assignedBarangays || []).map((item) => String(item.id)));
    const isPdo = roleValue === 'pdo';
    const selectedRoleLabel = getRoleLabel(roleValue);
    const modalTitle = editing ? 'Edit Staff Account' : 'Add Staff Account';

    setHTML(root, `
      <div class="team-form-header">
        <div>
          <span class="team-form-kicker">${modalTitle}</span>
          <h4>${editing ? escapeHtml(editing.name) : 'Create a new staff profile'}</h4>
        </div>
        <button class="team-action-button team-action-button--soft" id="team-cancel-edit" type="button" aria-label="Close add staff modal">Close</button>
      </div>
      <form id="team-form" class="team-form-layout">
        <input type="hidden" name="staffId" value="${editing ? editing.id : ''}">
        <aside class="team-form-side">
          <div class="team-form-side__card">
            <span class="team-form-side__eyebrow">Role Snapshot</span>
            <strong id="team-role-summary">${escapeHtml(selectedRoleLabel)}</strong>
            <div class="team-role-pills">
              <span class="team-role-pill ${isPdo ? 'is-active' : ''}">PDO Assignment ${isPdo ? 'Enabled' : 'Hidden'}</span>
              <span class="team-role-pill">${editing ? 'Editing Existing Staff' : 'New Staff Setup'}</span>
            </div>
          </div>
        </aside>

        <div class="team-form-main">
          <section class="team-form-panel">
            <div class="team-form-panel__header">
              <div>
                <span class="team-form-panel__eyebrow">Identity</span>
                <h5>Staff profile</h5>
              </div>
            </div>
            <div class="team-form-grid">
              <label>
                <span>Full Name</span>
                <input type="text" name="name" value="${editing ? escapeHtml(editing.name) : ''}" required>
              </label>
              <label>
                <span>Email</span>
                <input type="email" name="email" value="${editing ? escapeHtml(editing.email) : ''}" required>
              </label>
              <label>
                <span>Optional Contact Info</span>
                <input type="text" name="contactNumber" value="${editing?.contactNumber ? escapeHtml(editing.contactNumber) : ''}">
              </label>
              <label>
                <span>Position Title</span>
                <input type="text" name="positionTitle" value="${editing?.positionTitle ? escapeHtml(editing.positionTitle) : ''}">
              </label>
            </div>
          </section>

          <section class="team-form-panel">
            <div class="team-form-panel__header">
              <div>
                <span class="team-form-panel__eyebrow">Access Control</span>
                <h5>Role and portal status</h5>
              </div>
            </div>
            <div class="team-form-grid">
              <label>
                <span>Role</span>
                <select name="role" id="team-role-select">
                  ${(state.meta.roles || []).map((role) => `<option value="${role.value}" ${role.value === roleValue ? 'selected' : ''}>${role.label}</option>`).join('')}
                </select>
              </label>
              <label>
                <span>Status</span>
                <select name="status">
                  ${(state.meta.statuses || []).map((status) => `<option value="${status.value}" ${status.value === statusValue ? 'selected' : ''}>${status.label}</option>`).join('')}
                </select>
              </label>
              <label class="team-form-grid__wide">
                <span>${editing ? 'Password Reset (optional)' : 'Password'}</span>
                <input type="password" name="password" ${editing ? '' : 'required'}>
              </label>
            </div>
          </section>

          <section class="team-form-panel team-assignment-panel" id="team-assignment-block" ${isPdo ? '' : 'hidden'}>
            <div class="team-assignment-panel__header">
              <div>
                <span class="team-form-panel__eyebrow">Barangay Assignment</span>
                <h5>PDO coverage</h5>
              </div>
            </div>
            <div class="team-assignment-grid">
              ${(state.meta.barangays || []).map((barangay) => `
                <label class="team-assignment-option ${assignedIds.has(String(barangay.id)) ? 'is-selected' : ''}">
                  <input type="checkbox" name="barangayIds" value="${barangay.id}" ${assignedIds.has(String(barangay.id)) ? 'checked' : ''}>
                  <span>${barangay.name}</span>
                </label>
              `).join('')}
            </div>
          </section>

          <div class="team-form-actions">
            <button type="button" class="team-action-button team-action-button--soft" id="team-form-cancel">Cancel</button>
            <button type="submit" class="team-action-button team-action-button--primary">${editing ? 'Save Changes' : 'Create Account'}</button>
          </div>
        </div>
      </form>
    `);
  };

  const renderStatusStrip = () => {
    const root = qs('#team-status-strip');
    if (!root) return;

    setHTML(root, `
      <div class="team-status-explainer">
        <div class="placeholder-card placeholder-card--soft">
          <strong>Active</strong>
        </div>
        <div class="placeholder-card placeholder-card--soft">
          <strong>Inactive</strong>
        </div>
        <div class="placeholder-card placeholder-card--soft">
          <strong>Disabled</strong>
        </div>
      </div>
    `);
  };

  const showNotice = (message, tone = 'info') => {
    const notice = qs('#team-notice');
    if (!notice) return;
    notice.hidden = false;
    notice.className = `notice ${tone}`;
    notice.textContent = message;
  };

  const load = async () => {
    const response = await apiGet('api/team', {
      role: state.filters.role,
      status: state.filters.status,
      search: state.filters.search,
    });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(response.message || 'Unable to load staff accounts.', 'danger');
      return;
    }

    state.staff = response.staff || [];
    state.meta = response.meta || state.meta;
    renderSummary();
    renderFilters();
    renderTable();
    renderForm();
    renderStatusStrip();
  };

  const createOrUpdate = async (event) => {
    event.preventDefault();
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      showNotice('Unable to read the team form.', 'danger');
      return;
    }

    const formData = new FormData(form);
    const payload = {
      staffId: formData.get('staffId') || '',
      name: formData.get('name') || '',
      email: formData.get('email') || '',
      role: formData.get('role') || '',
      status: formData.get('status') || 'active',
      contactNumber: formData.get('contactNumber') || '',
      positionTitle: formData.get('positionTitle') || '',
      password: formData.get('password') || '',
      barangayIds: formData.getAll('barangayIds'),
    };

    const isEditing = Boolean(payload.staffId);
    const response = await apiPost(isEditing ? 'api/team/update' : 'api/team', payload);
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(firstError(response.errors) || 'Unable to save staff account.', 'danger');
      return;
    }

    if (payload.role === 'pdo') {
      const targetStaff = (response.staff || []).find((item) => String(item.id) === String(payload.staffId))
        || (response.staff || []).find((item) => item.email === payload.email);
      if (targetStaff) {
        const assignmentResponse = await apiPost('api/team/assignments', {
          staffId: targetStaff.id,
          barangayIds: payload.barangayIds,
        });
        if (assignmentResponse.redirect) {
          window.location.href = routeUrl(assignmentResponse.redirect);
          return;
        }
        if (!assignmentResponse.ok) {
          showNotice(firstError(assignmentResponse.errors) || 'Staff saved, but barangay assignment failed.', 'danger');
          await load();
          return;
        }
      }
    }

    state.editingId = null;
    showNotice(isEditing ? 'Staff account updated.' : 'Staff account created.', 'success');
    closeFormModal();
    await load();
  };

  const updateStatusAction = async (staffId, status) => {
    const response = await apiPost('api/team/status', { staffId, status });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(firstError(response.errors) || 'Unable to update staff status.', 'danger');
      return;
    }

    showNotice('Staff status updated.', 'success');
    await load();
  };

  const openFormModal = () => {
    if (!qs('#team-modal')) {
      renderModalShell();
      renderForm();
    }
    const modal = qs('#team-modal');
    if (!modal) return;
    modal.hidden = false;
    modal.classList.add('is-open');
    document.body.classList.add('team-modal-open');
  };

  const closeFormModal = () => {
    const modal = qs('#team-modal');
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.hidden = true;
    document.body.classList.remove('team-modal-open');
  };

  const bind = () => {
    const section = teamSection();
    if (!section || section.dataset.teamBound === 'true') return;
    section.dataset.teamBound = 'true';

    on(section, 'change', (event) => {
      if (event.target.id === 'team-filter-role') {
        state.filters.role = event.target.value;
        load();
      }
      if (event.target.id === 'team-filter-status') {
        state.filters.status = event.target.value;
        load();
      }
      if (event.target.id === 'team-filter-barangay') {
        state.filters.barangayId = event.target.value;
        renderSummary();
        renderTable();
      }
    });

    on(section, 'input', (event) => {
      if (event.target.id === 'team-filter-search') {
        state.filters.search = event.target.value;
        load();
      }
    });

    on(section, 'click', async (event) => {
      const reset = event.target.closest('#team-filter-reset');
      if (reset) {
        state.filters = { role: '', status: '', barangayId: '', search: '' };
        await load();
        return;
      }

      if (event.target.closest('#team-focus-form')) {
        state.editingId = null;
        renderForm();
        openFormModal();
        return;
      }

      const edit = event.target.closest('[data-team-edit]');
      if (edit) {
        state.editingId = Number(edit.dataset.teamEdit);
        renderForm();
        openFormModal();
        return;
      }

      const statusButton = event.target.closest('[data-team-status]');
      if (statusButton) {
        await updateStatusAction(statusButton.dataset.teamStatus, statusButton.dataset.nextStatus);
        return;
      }

    });

    on(document, 'change', (event) => {
      if (event.target.id === 'team-role-select') {
        const assignmentBlock = qs('#team-assignment-block');
        const roleSummary = qs('#team-role-summary');
        const roleDescriptionText = qs('#team-role-description');
        if (assignmentBlock) {
          assignmentBlock.hidden = event.target.value !== 'pdo';
        }
        if (roleSummary) {
          roleSummary.textContent = getRoleLabel(event.target.value);
        }
        if (roleDescriptionText) {
          roleDescriptionText.textContent = roleDescription(event.target.value);
        }
      }

      const assignmentOption = event.target.closest('.team-assignment-option');
      if (assignmentOption) {
        assignmentOption.classList.toggle('is-selected', event.target.checked);
      }
    });

    on(document, 'click', (event) => {
      if (event.target.closest('#team-cancel-edit') || event.target.closest('#team-form-cancel') || event.target.closest('[data-team-modal-close]')) {
        state.editingId = null;
        renderForm();
        closeFormModal();
      }
    });

    on(document, 'keydown', (event) => {
      if (event.key === 'Escape') {
        state.editingId = null;
        renderForm();
        closeFormModal();
      }
    });

    on(document, 'submit', (event) => {
      if (event.target.id === 'team-form') {
        createOrUpdate(event);
      }
    });
  };

  const init = () => {
    if (!teamSection()) return;
    renderShell();
    bind();
    load();
  };

  window.App.modules = window.App.modules || {};
  window.App.modules.team = { init };
})();

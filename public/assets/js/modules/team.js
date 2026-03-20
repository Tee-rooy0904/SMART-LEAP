(function () {
  const { qs, on, setHTML } = window.App.dom;
  const { formatDate } = window.App.format;

  const state = {
    filters: { role: '', status: '', search: '' },
    staff: [],
    meta: { roles: [], statuses: [], barangays: [] },
    editingId: null,
  };

  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');

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

  const teamSection = () => qs('#users-section');

  const getRoleLabel = (role) => {
    const match = (state.meta.roles || []).find((item) => item.value === role);
    return match ? match.label : role;
  };

  const renderShell = () => {
    const section = teamSection();
    if (!section) return;

    setHTML(section, `
      <div class="applications-header">
        <div>
          <h3>Team Management</h3>
          <p>Create staff accounts, update statuses, and assign barangays to project officers.</p>
        </div>
      </div>
      <div class="applications-filters" id="team-filters"></div>
      <div class="table-card" id="team-form-card"></div>
      <div class="table-card" id="team-table-card"></div>
      <div class="notice" id="team-notice" hidden></div>
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
      <div class="filter-search applications-search">
        <i class="fas fa-search"></i>
        <input type="search" id="team-filter-search" placeholder="Search staff by name or email" value="${state.filters.search}">
      </div>
      <div class="filter-actions">
        <button class="app-btn-ghost" id="team-filter-reset">Reset</button>
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

    setHTML(root, `
      <div class="table-toolbar">
        <h4>${editing ? 'Edit staff account' : 'Create staff account'}</h4>
        ${editing ? '<button class="app-btn-ghost" id="team-cancel-edit">Cancel</button>' : ''}
      </div>
      <form id="team-form" class="review-form-grid">
        <input type="hidden" name="staffId" value="${editing ? editing.id : ''}">
        <label>
          <span>Full name</span>
          <input type="text" name="name" value="${editing ? escapeHtml(editing.name) : ''}" required>
        </label>
        <label>
          <span>Email</span>
          <input type="email" name="email" value="${editing ? escapeHtml(editing.email) : ''}" required>
        </label>
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
        <label>
          <span>Contact number</span>
          <input type="text" name="contactNumber" value="${editing?.contactNumber ? escapeHtml(editing.contactNumber) : ''}">
        </label>
        <label>
          <span>Position title</span>
          <input type="text" name="positionTitle" value="${editing?.positionTitle ? escapeHtml(editing.positionTitle) : ''}">
        </label>
        <label class="review-full">
          <span>${editing ? 'New password (optional)' : 'Password'}</span>
          <input type="password" name="password" ${editing ? '' : 'required'}>
        </label>
        <div class="review-full" id="team-assignment-block" ${isPdo ? '' : 'hidden'}>
          <span class="review-label">Assigned barangays</span>
          <div class="app-action-panel__checklist">
            ${(state.meta.barangays || []).map((barangay) => `
              <label class="app-check">
                <input type="checkbox" name="barangayIds" value="${barangay.id}" ${assignedIds.has(String(barangay.id)) ? 'checked' : ''}>
                <span>${barangay.name}</span>
              </label>
            `).join('')}
          </div>
        </div>
        <div class="review-full app-action-panel__actions">
          <button type="submit" class="app-btn-primary">${editing ? 'Save changes' : 'Create account'}</button>
        </div>
      </form>
    `);
  };

  const renderTable = () => {
    const root = qs('#team-table-card');
    if (!root) return;

    const rows = state.staff.map((item) => `
      <tr>
        <td>
          <div class="applicant-cell">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${escapeHtml(item.email)}</span>
          </div>
        </td>
        <td>${escapeHtml(item.roleLabel || getRoleLabel(item.role))}</td>
        <td><span class="status-badge ${statusClass(item.status)}">${escapeHtml(item.status)}</span></td>
        <td>${item.assignedBarangays.length ? item.assignedBarangays.map((barangay) => escapeHtml(barangay.name)).join(', ') : '--'}</td>
        <td>${formatDate(item.lastLoginAt)}</td>
        <td class="actions">
          <button class="app-btn-outline" data-team-edit="${item.id}">Edit</button>
          <button class="app-btn-ghost" data-team-status="${item.id}" data-next-status="${nextStatus(item.status)}">${buttonLabel(item.status)}</button>
        </td>
      </tr>
    `).join('');

    setHTML(root, `
      <div class="table-toolbar">
        <h4>Staff Accounts</h4>
        <span class="chip">${state.staff.length} records</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff</th>
              <th>Role</th>
              <th>Status</th>
              <th>Assigned barangay</th>
              <th>Last login</th>
              <th class="actions">Actions</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6">No staff accounts found.</td></tr>'}</tbody>
        </table>
      </div>
    `);
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
    return target === 'inactive' ? 'Set inactive' : target === 'disabled' ? 'Disable' : 'Activate';
  };

  const showNotice = (message, tone = 'info') => {
    const notice = qs('#team-notice');
    if (!notice) return;
    notice.hidden = false;
    notice.className = `notice ${tone}`;
    notice.textContent = message;
  };

  const load = async () => {
    const response = await apiGet('api/team', state.filters);
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
    renderFilters();
    renderForm();
    renderTable();
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
      if (event.target.id === 'team-role-select') {
        const assignmentBlock = qs('#team-assignment-block');
        if (assignmentBlock) {
          assignmentBlock.hidden = event.target.value !== 'pdo';
        }
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
        state.filters = { role: '', status: '', search: '' };
        await load();
        return;
      }

      const edit = event.target.closest('[data-team-edit]');
      if (edit) {
        state.editingId = Number(edit.dataset.teamEdit);
        renderForm();
        return;
      }

      const statusButton = event.target.closest('[data-team-status]');
      if (statusButton) {
        await updateStatusAction(statusButton.dataset.teamStatus, statusButton.dataset.nextStatus);
        return;
      }

      if (event.target.closest('#team-cancel-edit')) {
        state.editingId = null;
        renderForm();
      }
    });

    on(section, 'submit', (event) => {
      if (event.target.id === 'team-form') {
        createOrUpdate(event);
      }
    });
  };

  const init = () => {
    renderShell();
    bind();
    load();
  };

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

  window.App.modules = window.App.modules || {};
  window.App.modules.team = { init };
})();

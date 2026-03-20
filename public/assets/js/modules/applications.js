(function () {
  const { qs, on, setHTML } = window.App.dom;
  const { formatDate } = window.App.format;

  const state = {
    filters: { status: '', barangayId: '', assignedPdoId: '', search: '' },
    data: { applications: [], summary: {}, barangays: [], assignedPdos: [] },
    activeApplication: null,
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
    Object.entries(payload || {}).forEach(([key, value]) => body.append(key, value ?? ''));
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

  const section = () => qs('#applications-section');

  const renderShell = () => {
    const target = section();
    if (!target) return;
    setHTML(target, `
      <div class="applications-header">
        <div>
          <h3>Application Review</h3>
          <p>Review applicant submissions, inspect requirements, and update decision history.</p>
        </div>
      </div>
      <div id="applications-kpis"></div>
      <div class="applications-filters" id="applications-filters"></div>
      <div id="applications-table"></div>
      <div class="notice" id="applications-notice" hidden></div>
    `);
  };

  const renderSummary = () => {
    const summary = state.data.summary || {};
    const root = qs('#applications-kpis');
    if (!root) return;
    setHTML(root, `
      <div class="applications-kpis">
        <div class="summary-chip">Total <strong>${summary.total || 0}</strong></div>
        <div class="summary-chip">Submitted <strong>${summary.submitted || 0}</strong></div>
        <div class="summary-chip">Under Review <strong>${summary.underReview || 0}</strong></div>
        <div class="summary-chip">Checked by PDO <strong>${summary.checkedByPdo || 0}</strong></div>
        <div class="summary-chip">Approved <strong>${summary.approved || 0}</strong></div>
        <div class="summary-chip">Needs Attention <strong>${summary.needsAttention || 0}</strong></div>
      </div>
    `);
  };

  const renderFilters = () => {
    const root = qs('#applications-filters');
    if (!root) return;

    const statuses = ['', 'Submitted', 'Under Review', 'Checked by PDO', 'Approved', 'Rejected', 'Flagged', 'Needs Correction'];
    setHTML(root, `
      <div class="filter-group">
        <span class="filter-label">Status</span>
        <select id="applications-status" class="filter-select">
          ${statuses.map((status) => `<option value="${status}" ${state.filters.status === status ? 'selected' : ''}>${status || 'All statuses'}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Barangay</span>
        <select id="applications-barangay" class="filter-select">
          <option value="">All barangays</option>
          ${(state.data.barangays || []).map((barangay) => `<option value="${barangay.id}" ${String(state.filters.barangayId) === String(barangay.id) ? 'selected' : ''}>${barangay.name}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">Assigned PDO</span>
        <select id="applications-assigned-pdo" class="filter-select">
          <option value="">All PDOs</option>
          ${(state.data.assignedPdos || []).map((pdo) => `<option value="${pdo.id}" ${String(state.filters.assignedPdoId) === String(pdo.id) ? 'selected' : ''}>${pdo.name}</option>`).join('')}
        </select>
      </div>
      <div class="filter-search applications-search">
        <i class="fas fa-search"></i>
        <input type="search" id="applications-search" placeholder="Search applicant by name or email" value="${escapeHtml(state.filters.search)}">
      </div>
      <div class="filter-actions">
        <button class="app-btn-ghost" id="applications-reset">Reset</button>
      </div>
    `);
  };

  const renderTable = () => {
    const root = qs('#applications-table');
    if (!root) return;
    const rows = (state.data.applications || []).map((application) => `
      <tr>
        <td>
          <div class="applicant-cell">
            <strong>${escapeHtml(application.applicantName)}</strong>
            <span>${escapeHtml(application.email)}</span>
          </div>
        </td>
        <td>${escapeHtml(application.barangay || '--')}</td>
        <td>${escapeHtml(application.assignedPdoName || '--')}</td>
        <td>${application.uploadedRequirementCount}/${application.requiredRequirementCount} uploaded</td>
        <td><span class="status-badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td>
        <td>${formatDate(application.submittedAt)}</td>
        <td class="actions">
          <button class="app-btn-outline" data-open-application="${application.id}">Open</button>
        </td>
      </tr>
    `).join('');

    setHTML(root, `
      <div class="table-card">
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Barangay</th>
                <th>Assigned PDO</th>
                <th>Requirements</th>
                <th>Status</th>
                <th>Submitted</th>
                <th class="actions">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="7">No applications found.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `);
  };

  const renderModal = (application) => {
    const root = qs('#modal-root');
    if (!root || !application) return;

    setHTML(root, `
      <div class="modal-overlay application-review-modal" data-app-modal>
        <div class="modal-card" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="app-modal-title">
              <h3>${escapeHtml(application.applicantName)}</h3>
              <div class="app-modal-meta">
                <span>${escapeHtml(application.barangay || '--')}</span>
                <span class="app-meta-dot"></span>
                <span>${escapeHtml(application.status)}</span>
                <span class="app-meta-dot"></span>
                <span>Assigned PDO: ${escapeHtml(application.assignedPdoName || '--')}</span>
              </div>
            </div>
            <button class="modal-close" type="button" data-close-modal aria-label="Close">&times;</button>
          </div>
          <div class="modal-body application-modal__grid">
            <div class="application-modal__col detail-summary-stack">
              <div class="detail-summary-card">
                <h6>Profile</h6>
                <strong>${escapeHtml(application.businessName || '--')}</strong>
                <span>${escapeHtml(application.livelihood || '--')}</span>
                <span>${escapeHtml(application.address || '--')}</span>
              </div>
              <div class="detail-summary-card">
                <h6>Applicant Details</h6>
                <span>Contact: ${escapeHtml(application.contactNumber || '--')}</span>
                <span>Sector: ${escapeHtml(application.sector || '--')}</span>
                <span>Household: ${application.householdSize ?? '--'}</span>
              </div>
            </div>
            <div class="application-modal__col">
              <div class="table-card light">
                <div class="table-toolbar"><h4>Requirements</h4></div>
                <ul class="profile-checklist">
                  ${(application.requirements || []).map((requirement) => `
                    <li>
                      <div>
                        <strong>${escapeHtml(requirement.label)}</strong>
                        <div>${escapeHtml(requirement.status || 'missing')}</div>
                      </div>
                      ${requirement.file?.url ? `<a href="${escapeHtml(requirement.file.url)}" target="_blank" rel="noopener">Open file</a>` : '<span>No file</span>'}
                    </li>
                  `).join('')}
                </ul>
              </div>
              <div class="table-card light">
                <div class="table-toolbar"><h4>Status History</h4></div>
                <ul class="profile-checklist">
                  ${(application.history || []).map((entry) => `
                    <li>
                      <div>
                        <strong>${escapeHtml(entry.toStatus)}</strong>
                        <div>${escapeHtml(entry.actorName)} • ${formatDate(entry.createdAt)}</div>
                      </div>
                      <span>${escapeHtml(entry.remarks || '--')}</span>
                    </li>
                  `).join('') || '<li>No status history yet.</li>'}
                </ul>
              </div>
              <div class="table-card light">
                <div class="table-toolbar"><h4>Reviewer Comments</h4></div>
                <ul class="profile-checklist">
                  ${(application.comments || []).map((entry) => `
                    <li>
                      <div>
                        <strong>${escapeHtml(entry.actorName)}</strong>
                        <div>${formatDate(entry.createdAt)}</div>
                      </div>
                      <span>${escapeHtml(entry.comment || '--')}</span>
                    </li>
                  `).join('') || '<li>No comments yet.</li>'}
                </ul>
              </div>
              <div class="table-card light">
                <div class="table-toolbar"><h4>Review Action</h4></div>
                <div class="review-form-grid">
                  <label class="review-full">
                    <span>Remarks / Comment</span>
                    <textarea id="application-review-remarks" rows="4" placeholder="Add internal remarks or reviewer notes"></textarea>
                  </label>
                  <div class="review-full app-action-panel__actions">
                    <button class="app-btn-ghost" data-review-action="flag">Flag</button>
                    <button class="app-btn-outline" data-review-action="needs_correction">Needs correction</button>
                    <button class="app-btn-danger" data-review-action="reject">Reject</button>
                    <button class="app-btn-primary" data-review-action="approve">Approve</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `);
  };

  const load = async () => {
    const response = await apiGet('api/applications', state.filters);
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(response.message || 'Unable to load applications.', 'danger');
      return;
    }
    state.data = response.data || state.data;
    renderSummary();
    renderFilters();
    renderTable();
  };

  const openApplication = async (applicationId) => {
    const response = await apiGet('api/applications/show', { id: applicationId });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (!response.ok) {
      showNotice(response.message || 'Unable to load application details.', 'danger');
      return;
    }
    state.activeApplication = response.application;
    renderModal(state.activeApplication);
  };

  const submitReview = async (decision) => {
    if (!state.activeApplication) return;
    const remarks = qs('#application-review-remarks')?.value || '';
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
      showNotice(firstError(response.errors) || 'Unable to update application.', 'danger');
      return;
    }
    showNotice('Application updated.', 'success');
    closeModal();
    await load();
  };

  const closeModal = () => {
    setHTML(qs('#modal-root'), '');
    state.activeApplication = null;
  };

  const showNotice = (message, tone = 'info') => {
    const notice = qs('#applications-notice');
    if (!notice) return;
    notice.hidden = false;
    notice.className = `notice ${tone}`;
    notice.textContent = message;
  };

  const bind = () => {
    const target = section();
    if (!target || target.dataset.applicationsBound === 'true') return;
    target.dataset.applicationsBound = 'true';

    on(target, 'change', (event) => {
      if (event.target.id === 'applications-status') {
        state.filters.status = event.target.value;
        load();
      }
      if (event.target.id === 'applications-barangay') {
        state.filters.barangayId = event.target.value;
        load();
      }
      if (event.target.id === 'applications-assigned-pdo') {
        state.filters.assignedPdoId = event.target.value;
        load();
      }
    });

    on(target, 'input', (event) => {
      if (event.target.id === 'applications-search') {
        state.filters.search = event.target.value;
        load();
      }
    });

    on(target, 'click', async (event) => {
      const reset = event.target.closest('#applications-reset');
      if (reset) {
        state.filters = { status: '', barangayId: '', assignedPdoId: '', search: '' };
        await load();
        return;
      }

      const openButton = event.target.closest('[data-open-application]');
      if (openButton) {
        await openApplication(openButton.dataset.openApplication);
      }
    });

    on(document, 'click', (event) => {
      if (event.target.closest('[data-close-modal]') || (event.target.matches('[data-app-modal]'))) {
        closeModal();
        return;
      }

      const action = event.target.closest('[data-review-action]');
      if (action) {
        submitReview(action.dataset.reviewAction);
      }
    });
  };

  const statusClass = (status) => {
    const value = String(status || '').toLowerCase();
    if (value === 'approved') return 'is-success';
    if (value === 'rejected') return 'is-danger';
    if (value === 'flagged' || value === 'needs correction') return 'is-warning';
    return 'is-muted';
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

  const init = () => {
    renderShell();
    bind();
    load();
  };

  window.App.modules = window.App.modules || {};
  window.App.modules.applications = { init };
})();

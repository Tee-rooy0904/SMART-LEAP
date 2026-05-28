/*
 * SMART LEAP FILE GUIDE
 * Shared applications module for reviewer dashboards.
 * Builds application KPIs, filters, lists, and the detailed application modal used in admin and social worker applicant-review sections.
 */
(function () {
  const { qs, on, setHTML } = window.App.dom;
  const { formatDate } = window.App.format;

  const state = {
    filters: { status: '', barangayId: '', assignedPdoId: '', livelihoodCategory: '', search: '' },
    data: { applications: [], summary: {}, barangays: [], assignedPdos: [] },
    activeApplication: null,
    activePreviewToken: '',
  };
  const livelihoodCategories = ['Establishment', 'Livestock', 'Buy & Sell', 'Agriculture', 'Food and Beverages', 'Other'];

  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');

  const routeUrl = (path) => `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;

  const formatBatchNo = (value) => {
    const text = String(value || '').trim();
    if (!text) return 'Batch 1';
    return /^\d+$/.test(text) ? `Batch ${text}` : text;
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

  const apiJsonPost = async (path, payload) => {
    try {
      const response = await fetch(routeUrl(path), {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json;charset=UTF-8',
        },
        credentials: 'same-origin',
        body: JSON.stringify(payload || {}),
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

  const section = () => qs('#applications-section');

  const renderShell = () => {
    const target = section();
    if (!target) return;
    setHTML(target, `
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
      <section class="applications-kpis metric-grid">
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">In Progress</span>
          <div class="metric-card__body">
            <strong class="metric-card__value">${summary.inProgress || 0}</strong>
          </div>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Ready for Review</span>
          <div class="metric-card__body">
            <strong class="metric-card__value">${summary.readyForReview || 0}</strong>
          </div>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Approved</span>
          <div class="metric-card__body">
            <strong class="metric-card__value">${summary.approved || 0}</strong>
          </div>
        </article>
        <article class="metric-card metric-card--soft">
          <span class="metric-card__label">Needs Correction</span>
          <div class="metric-card__body">
            <strong class="metric-card__value">${summary.needsCorrection || 0}</strong>
          </div>
        </article>
      </section>
    `);
  };

  const renderFilters = () => {
    const root = qs('#applications-filters');
    if (!root) return;

    const statuses = ['', 'Submitted', 'Under Review', 'Requirements Verified', 'For Assessment', 'Approved for Training', 'Rejected', 'Needs Documents', 'Needs Correction'];
    setHTML(root, `
      <div class="filter-group filter-group--search">
        <span class="filter-label">Search</span>
        <div class="filter-search applications-search">
          <i class="fas fa-search"></i>
          <input type="search" id="applications-search" placeholder="Search applicant by name or email" value="${escapeHtml(state.filters.search)}">
        </div>
      </div>
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
      <div class="filter-group">
        <span class="filter-label">Livelihood Category</span>
        <select id="applications-livelihood-category" class="filter-select">
          <option value="">All categories</option>
          ${livelihoodCategories.map((category) => `<option value="${category}" ${state.filters.livelihoodCategory === category ? 'selected' : ''}>${category}</option>`).join('')}
        </select>
      </div>
      <div class="filter-actions filter-actions--inline">
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
        <td><span class="batch-badge">${escapeHtml(formatBatchNo(application.batchNo))}</span></td>
        <td>${escapeHtml(application.assignedPdoName || '--')}</td>
        <td>${application.uploadedRequirementCount}/${application.requiredRequirementCount} uploaded</td>
        <td><span class="status-badge ${statusClass(application.status)}">${escapeHtml(application.status)}</span></td>
        <td>${formatDate(application.submittedAt)}</td>
        <td class="actions">
          <button class="action-button action-button--review" data-open-application="${application.id}">
            <i class="fas fa-folder-open"></i>
            <span>Open Review</span>
          </button>
        </td>
      </tr>
    `).join('');

    setHTML(root, `
      <div class="table-card applications-table-shell">
        <div class="table-wrapper">
          <table class="data-table">
            <colgroup>
              <col class="applications-table__col--applicant">
              <col class="applications-table__col--barangay">
              <col class="applications-table__col--batch">
              <col class="applications-table__col--pdo">
              <col class="applications-table__col--requirements">
              <col class="applications-table__col--status">
              <col class="applications-table__col--submitted">
              <col class="applications-table__col--actions">
            </colgroup>
            <thead>
              <tr>
                <th>Applicant</th>
                <th>Barangay</th>
                <th>Batch</th>
                <th>Assigned PDO</th>
                <th>Requirements</th>
                <th>Status</th>
                <th>Submitted</th>
                <th class="actions">Actions</th>
              </tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="8">No applications found.</td></tr>'}</tbody>
          </table>
        </div>
      </div>
    `);
  };

  const renderModal = (application) => {
    const root = qs('#modal-root');
    if (!root || !application) return;
    setHTML(root, buildModalMarkup(application));
    ensureActivePreview(application);
    renderRequirementNavigator();
    renderPreviewPanel();
    renderRequirementInspector();
  };

  const buildModalMarkup = (application) => {
    const readiness = application.approvalReadiness || {};
    const uploadSummary = readiness.uploadSummary || { approved: 0, total: 0 };
    const formSummary = readiness.formSummary || { approved: 0, total: 0 };
    const trainingStatus = readiness.trainingStatus || {};
    const blockers = (readiness.blockers || []).length
      ? readiness.blockers.map((item) => `<li class="po-blocker-item"><span class="po-blocker-item__icon" aria-hidden="true">!</span><span>${escapeHtml(item)}</span></li>`).join('')
      : '<li class="po-blocker-item po-blocker-item--clear"><span class="po-blocker-item__icon" aria-hidden="true">OK</span><span>Ready for approval action. No blocking reasons recorded.</span></li>';

    return `
      <div class="modal-overlay application-review-modal" data-app-modal>
        <div class="modal-card application-review-modal__card po-review-modal" role="dialog" aria-modal="true">
          <div class="modal-header">
            <div class="po-modal-title-block">
              <span class="po-panel-label po-modal-eyebrow">Application Case</span>
              <h3 class="modal-title">${escapeHtml(application.applicantName || '--')}</h3>
              <small class="po-modal-subtitle">Submitted on <span>${formatDate(application.submittedAt)}</span></small>
            </div>
            <div class="po-modal-header-actions">
              <span class="po-status-chip po-status-chip--header ${statusClass(application.status)}">${escapeHtml(application.status || '--')}</span>
              <button class="modal-close" type="button" data-close-modal aria-label="Close">&times;</button>
            </div>
          </div>
          <div class="modal-body">
            <section class="po-case-identity">
              <article class="po-case-identity__block">
                <span class="po-panel-label">Applicant</span>
                <strong>${escapeHtml(application.applicantName || '--')}</strong>
                <div class="po-case-identity__row"><span>Business</span><strong>${escapeHtml(application.businessName || '--')}</strong></div>
                <div class="po-case-identity__row"><span>Barangay</span><strong>${escapeHtml(application.barangay || '--')}</strong></div>
                <div class="po-case-identity__row"><span>Batch</span><strong>${escapeHtml(formatBatchNo(application.batchNo))}</strong></div>
                <div class="po-case-identity__row"><span>Assigned PDO</span><strong>${escapeHtml(application.assignedPdoName || '--')}</strong></div>
              </article>
              <article class="po-case-identity__block">
                <span class="po-panel-label">Case Details</span>
                <div class="po-case-identity__row"><span>Contact</span><strong>${escapeHtml(application.contactNumber || application.email || '--')}</strong></div>
                <div class="po-case-identity__row"><span>Sector</span><strong>${escapeHtml(application.sector || '--')}</strong></div>
                <div class="po-case-identity__row"><span>Livelihood</span><strong>${escapeHtml(application.livelihood || '--')}</strong></div>
                <div class="po-case-identity__row"><span>Household</span><strong>${escapeHtml(String(application.householdSize ?? '--'))}</strong></div>
              </article>
            </section>
            <section class="po-readiness-panel">
              <div class="po-readiness-panel__header">
                <div>
                  <span class="po-panel-label">Readiness Summary</span>
                  <h6>${escapeHtml(readiness.overallStatus || 'Under Review')}</h6>
                </div>
                <span class="po-status-chip ${trainingStatus.completed ? 'is-success' : 'is-warning'}">${trainingStatus.completed ? 'Training Completed' : 'Training Pending'}</span>
              </div>
              <div class="po-readiness-grid">
                <article class="po-readiness-card"><span>Upload Requirements</span><strong>${uploadSummary.approved || 0} / ${uploadSummary.total || 0}</strong></article>
                <article class="po-readiness-card"><span>Fill-up Form Requirements</span><strong>${formSummary.approved || 0} / ${formSummary.total || 0}</strong></article>
                <article class="po-readiness-card"><span>Training Status</span><strong>${escapeHtml(trainingStatus.status || '--')}</strong></article>
              </div>
              <div class="po-blocker-box">
                <span class="po-panel-label">Blocking Reasons</span>
                <ul class="po-blocker-list">${blockers}</ul>
              </div>
            </section>
            <section class="po-review-workspace">
              <article class="po-requirement-nav">
                <div class="po-review-section__header">
                  <div>
                    <span class="po-panel-label">Requirement Navigator</span>
                    <h6>All Requirements</h6>
                  </div>
                  <span class="po-status-chip is-muted">${formatRequirementCount([...(application.requirements || []), ...(application.formRequirements || [])])}</span>
                </div>
                <div id="admin-requirement-nav" class="po-requirement-nav__list"></div>
              </article>
              <article class="po-preview-panel">
                <div class="po-review-section__header">
                  <div>
                    <span class="po-panel-label">Requirement Viewer</span>
                    <h6 id="admin-preview-title">Select a requirement</h6>
                  </div>
                  <span class="po-status-chip is-muted" id="admin-preview-chip">No preview</span>
                </div>
                <div id="admin-app-preview" class="po-preview-surface"></div>
              </article>
              <article class="po-review-inspector">
                <div class="po-review-section__header">
                  <div>
                    <span class="po-panel-label">Requirement Details</span>
                    <h6 id="admin-inspector-title">Select a requirement</h6>
                  </div>
                  <span class="po-status-chip is-muted" id="admin-inspector-chip">No selection</span>
                </div>
                <div id="admin-review-inspector" class="po-review-inspector__body"></div>
              </article>
            </section>
            <section class="po-readiness-panel">
              <div class="po-review-section__header">
                <div>
                  <span class="po-panel-label">Status History</span>
                  <h6>Application Timeline</h6>
                </div>
              </div>
              <ul class="profile-checklist profile-checklist--timeline">
                ${(application.history || []).map((entry) => `<li><div><strong>${escapeHtml(entry.toStatus)}</strong><div>${escapeHtml(entry.actorName)} • ${formatDate(entry.createdAt)}</div></div><span>${escapeHtml(entry.remarks || '--')}</span></li>`).join('') || '<li>No status history yet.</li>'}
              </ul>
            </section>
          </div>
          <div class="modal-footer">
            <div class="po-decision-rail">
              <div class="po-decision-rail__summary">
                <span class="po-panel-label">Decision Control</span>
                <strong>${readiness.canApprove ? 'Application is ready for approval.' : 'Approval is currently blocked.'}</strong>
                <small>${readiness.canApprove ? 'All required upload requirements, fill-up form requirements, and training conditions are satisfied.' : escapeHtml((readiness.blockers || []).slice(0, 2).join(' | ') || 'Resolve any blocking requirement or training issue before approval.')}</small>
              </div>
              <div class="po-decision-rail__actions">
                <button type="button" class="btn btn-outline-secondary" data-close-modal>Close</button>
                <button type="button" class="btn btn-danger" data-review-action="reject">Reject</button>
                <button type="button" class="btn btn-success" data-review-action="approve" ${readiness.canApprove ? '' : 'disabled title="Resolve the blocking reasons before approval."'}>Approve</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const formatRequirementCount = (items) => {
    const total = items.length || 0;
    return `${total} ${total === 1 ? 'item' : 'items'}`;
  };

  const ensureActivePreview = (application) => {
    if (resolvePreviewItem(state.activePreviewToken, application)) return;
    const firstUpload = (application.requirements || []).find((item) => item.file?.url);
    if (firstUpload) {
      state.activePreviewToken = `upload:${String(firstUpload.key)}`;
      return;
    }
    const firstForm = (application.formRequirements || []).find((item) => item.reviewUrl);
    state.activePreviewToken = firstForm ? `form:${String(firstForm.id)}` : '';
  };

  const resolvePreviewItem = (token, application = state.activeApplication) => {
    if (!token || !application) return null;
    const [kind, rawId] = String(token).split(':');
    if (kind === 'upload') {
      const item = (application.requirements || []).find((entry) => String(entry.key) === rawId);
      return item ? { kind, item } : null;
    }
    if (kind === 'form') {
      const item = (application.formRequirements || []).find((entry) => String(entry.id) === rawId);
      return item ? { kind, item } : null;
    }
    return null;
  };

  const requirementStatusLabel = (status) => {
    const value = String(status || '').toLowerCase();
    if (['verified', 'approved'].includes(value)) return 'Approved';
    if (['rejected', 'needs correction'].includes(value)) return 'Rejected';
    if (['submitted', 'pending', 'unlocked', 'in progress'].includes(value)) return 'Pending';
    return value === 'missing' ? 'Missing' : (status || 'Pending');
  };

  const requirementStatusClass = (status) => {
    const value = requirementStatusLabel(status).toLowerCase();
    if (value === 'approved') return 'is-success';
    if (value === 'rejected' || value === 'missing') return 'is-danger';
    if (value === 'pending') return 'is-warning';
    return 'is-muted';
  };

  const requirementSubmissionLabel = (kind, item) => {
    if (kind === 'upload') return item.file?.url ? 'Submitted' : 'Missing';
    return ['submitted', 'verified', 'rejected', 'needs correction'].includes(String(item.status || '').toLowerCase()) ? 'Submitted' : 'Missing';
  };

  const requirementSubmissionClass = (kind, item) => requirementSubmissionLabel(kind, item) === 'Submitted' ? 'is-info' : 'is-danger';

  const getReviewItems = (application = state.activeApplication) => {
    if (!application) return [];
    return [
      ...(application.requirements || []).map((item) => ({ token: `upload:${String(item.key)}`, kind: 'upload', item })),
      ...(application.formRequirements || []).map((item) => ({ token: `form:${String(item.id)}`, kind: 'form', item })),
    ];
  };

  const renderRequirementNavigator = () => {
    const root = qs('#admin-requirement-nav');
    if (!root) return;
    const items = getReviewItems();
    if (!items.length) {
      setHTML(root, '<div class="po-preview-empty">No requirements loaded.</div>');
      return;
    }
    setHTML(root, items.map(({ token, kind, item }) => {
      const selected = state.activePreviewToken === token;
      const itemKey = String(kind === 'upload' ? item.key : item.id);
      const uploadedFormFile = kind === 'form' ? formRequirementFile(item) : null;
      const uploadControl = kind === 'form'
        ? `<div class="po-requirement-card__actions"><input class="po-review-upload-input" id="admin-form-upload-${escapeAttribute(itemKey)}" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" data-form-upload-input="${escapeAttribute(itemKey)}" hidden><button type="button" class="action-button action-button--quiet po-requirement-card__upload" data-trigger-form-upload="${escapeAttribute(itemKey)}">${uploadedFormFile?.url ? 'Replace uploaded file' : 'Upload file'}</button></div>`
        : '';
      return `<article class="po-requirement-card ${selected ? 'is-active' : ''}"><button type="button" class="po-requirement-card__select" data-select-requirement="${escapeAttribute(token)}"><div class="po-requirement-card__top"><strong>${escapeHtml(item.label || '--')}</strong><span class="po-status-pill ${requirementStatusClass(item.status)}">${escapeHtml(requirementStatusLabel(item.status))}</span></div><div class="po-requirement-card__meta"><span>${escapeHtml(item.typeLabel || '--')}</span><span class="po-status-pill ${requirementSubmissionClass(kind, item)}">${escapeHtml(requirementSubmissionLabel(kind, item))}</span></div></button>${uploadControl}</article>`;
    }).join(''));
  };

  const renderPreviewPanel = () => {
    const root = qs('#admin-app-preview');
    if (!root) return;
    const preview = resolvePreviewItem(state.activePreviewToken);
    const title = qs('#admin-preview-title');
    const chip = qs('#admin-preview-chip');
    if (!preview) {
      if (title) title.textContent = 'Select a requirement';
      if (chip) chip.textContent = 'No preview';
      setHTML(root, '<div class="po-preview-empty">Select an uploaded requirement or fill-up form to review it here.</div>');
      return;
    }

    const item = preview.item;
    if (title) title.textContent = preview.kind === 'upload' ? (item.file?.name || item.label || '--') : (item.label || '--');
    if (chip) chip.textContent = preview.kind === 'upload' ? 'Upload Requirement' : 'Fill-up Form Requirement';

    if (preview.kind === 'upload') {
      const url = item.file?.url || '';
      const mime = String(item.file?.type || '').toLowerCase();
      if (!url) {
        setHTML(root, '<div class="po-preview-empty">No file was submitted for this requirement.</div>');
        return;
      }
      if (mime.startsWith('image/')) {
        setHTML(root, `<div class="po-preview-frame po-preview-frame--image"><img src="${escapeHtml(url)}" alt="${escapeHtml(item.label || 'Requirement preview')}"></div>`);
        return;
      }
      if (mime.includes('pdf') || mime.startsWith('text/')) {
        setHTML(root, `<div class="po-preview-frame"><iframe src="${escapeHtml(url)}" title="${escapeHtml(item.label || 'Requirement preview')}"></iframe></div>`);
        return;
      }
      setHTML(root, `<div class="po-preview-file-card"><strong>${escapeHtml(item.file?.name || item.label || 'Requirement file')}</strong><span>${escapeHtml(item.file?.type || 'File preview is not available in-panel.')}</span><a class="action-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open file</a></div>`);
      return;
    }

    const uploadedFormFile = formRequirementFile(item);
    if (uploadedFormFile?.url) {
      renderPreviewFile(root, uploadedFormFile, item.label || 'Form file');
      return;
    }

    if (!item.reviewUrl) {
      setHTML(root, '<div class="po-preview-empty">Form preview is not available for this requirement.</div>');
      return;
    }
    setHTML(root, `<div class="po-native-form-preview"><div class="po-preview-loading">Loading form...</div><iframe class="po-native-form-loader" src="${escapeHtml(item.reviewUrl)}" title="${escapeHtml(item.label || 'Fill-up form review')}"></iframe><div class="po-native-form-content"></div></div>`);
    hydrateNativeFormPreview(root, state.activePreviewToken);
  };

  const hydrateNativeFormPreview = (root, token) => {
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
  };

  const renderRequirementInspector = () => {
    const root = qs('#admin-review-inspector');
    const title = qs('#admin-inspector-title');
    const chip = qs('#admin-inspector-chip');
    if (!root) return;
    const preview = resolvePreviewItem(state.activePreviewToken);
    if (!preview) {
      if (title) title.textContent = 'Select a requirement';
      if (chip) chip.textContent = 'No selection';
      setHTML(root, '<div class="po-preview-empty">Select a requirement from the navigator to review it.</div>');
      return;
    }

    const { kind, item } = preview;
    const itemKey = String(kind === 'upload' ? item.key : item.id);
    const statusLabel = requirementStatusLabel(item.status);
    const uploadedFormFile = kind === 'form' ? formRequirementFile(item) : null;
    if (title) title.textContent = item.label || 'Requirement';
    if (chip) chip.textContent = item.typeLabel || '--';
    setHTML(root, `<div class="po-inspector-summary"><div class="po-inspector-summary__row"><span>Submission State</span><strong><span class="po-status-pill ${requirementSubmissionClass(kind, item)}">${escapeHtml(requirementSubmissionLabel(kind, item))}</span></strong></div><div class="po-inspector-summary__row"><span>Requirement Status</span><strong><span class="po-status-pill ${requirementStatusClass(item.status)}">${escapeHtml(statusLabel)}</span></strong></div></div>${kind === 'form' ? `<div class="po-inspector-summary"><div class="po-inspector-summary__row"><span>Uploaded form file</span><strong>${escapeHtml(uploadedFormFile?.name || 'No file uploaded yet')}</strong></div><div class="po-inspector-summary__row"><span>Staff upload</span><strong>${uploadedFormFile?.uploadedAt ? escapeHtml(formatDate(uploadedFormFile.uploadedAt)) : '--'}</strong></div></div>` : ''}`);
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

  const refreshActiveApplication = async () => {
    if (!state.activeApplication?.id) return;
    const response = await apiGet('api/applications/show', { id: state.activeApplication.id });
    if (response.redirect) {
      window.location.href = routeUrl(response.redirect);
      return;
    }
    if (response.ok && response.application) {
      state.activeApplication = response.application;
      renderModal(state.activeApplication);
    }
  };

  const uploadFormFile = async (taskId, file) => {
    const formData = new FormData();
    formData.append('taskId', String(taskId));
    formData.append('fieldKey', 'reviewAttachment');
    formData.append('file', file);
    const response = await apiFormPost('api/post-approval-review/upload', formData);
    if (!response.ok) {
      showNotice(firstError(response.errors) || response.message || 'Unable to upload the form file.', 'danger');
      return;
    }
    await refreshActiveApplication();
    showNotice('Form file uploaded.', 'success');
  };

  const submitReview = async (decision) => {
    if (!state.activeApplication) return;
    const remarks = decision === 'reject' ? 'Application rejected by reviewer.' : '';
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
    state.activePreviewToken = '';
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
      if (event.target.id === 'applications-livelihood-category') {
        state.filters.livelihoodCategory = event.target.value;
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
        state.filters = { status: '', barangayId: '', assignedPdoId: '', livelihoodCategory: '', search: '' };
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

      const select = event.target.closest('[data-select-requirement]');
      if (select) {
        state.activePreviewToken = select.dataset.selectRequirement || '';
        renderRequirementNavigator();
        renderPreviewPanel();
        renderRequirementInspector();
        return;
      }

      const uploadTrigger = event.target.closest('[data-trigger-form-upload]');
      if (uploadTrigger) {
        document.getElementById(`admin-form-upload-${uploadTrigger.dataset.triggerFormUpload}`)?.click();
        return;
      }

      const action = event.target.closest('[data-review-action]');
      if (action) {
        submitReview(action.dataset.reviewAction);
      }
    });

    on(document, 'change', async (event) => {
      const input = event.target.closest('[data-form-upload-input]');
      if (!(input instanceof HTMLInputElement) || !input.files?.[0]) return;
      const taskId = Number(input.dataset.formUploadInput || 0);
      if (taskId <= 0) return;
      const file = input.files[0];
      input.value = '';
      await uploadFormFile(taskId, file);
    });
  };

  const statusClass = (status) => {
    const value = String(status || '').toLowerCase();
    if (['approved', 'approved for training', 'verified', 'completed', 'attended'].includes(value)) return 'is-success';
    if (['rejected', 'flagged', 'missing', 'missed'].includes(value)) return 'is-danger';
    if (['needs documents', 'needs correction', 'submitted', 'under review', 'pending', 'for assessment', 'requirements verified', 'notified', 'scheduled'].includes(value)) return 'is-warning';
    if (value === 'info') return 'is-info';
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

  const cssEscape = (value) => {
    if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
    return String(value).replace(/"/g, '\\"');
  };

  const formRequirementFile = (item) => (item && typeof item === 'object' && item.file ? item.file : null);

  const renderPreviewFile = (root, file, label) => {
    const url = file?.url || '';
    const mime = String(file?.type || '').toLowerCase();
    if (!url) {
      setHTML(root, '<div class="po-preview-empty">No file was uploaded for this form.</div>');
      return;
    }
    if (mime.startsWith('image/')) {
      setHTML(root, `<div class="po-preview-frame po-preview-frame--image"><img src="${escapeHtml(url)}" alt="${escapeHtml(label || 'Uploaded form preview')}"></div>`);
      return;
    }
    if (mime.includes('pdf') || mime.startsWith('text/')) {
      setHTML(root, `<div class="po-preview-frame"><iframe src="${escapeHtml(url)}" title="${escapeHtml(label || 'Uploaded form preview')}"></iframe></div>`);
      return;
    }
    setHTML(root, `<div class="po-preview-file-card"><strong>${escapeHtml(file?.name || label || 'Uploaded form file')}</strong><span>${escapeHtml(file?.type || 'File preview is not available in-panel.')}</span><a class="action-button" href="${escapeHtml(url)}" target="_blank" rel="noopener">Open file</a></div>`);
  };

  const init = () => {
    renderShell();
    bind();
    load();
  };

  const escapeAttribute = (value) => escapeHtml(value);

  window.App.modules = window.App.modules || {};
  window.App.modules.applications = { init };
})();

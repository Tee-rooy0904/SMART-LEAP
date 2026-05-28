(function () {
  const { qs, delegate, setHTML } = window.App.dom;
  const { formatDate } = window.App.format;

  const state = {
    data: {
      summary: {
        batchCapacity: 300,
        pending: 0,
        selected: 0,
        saved: 0,
        remaining: 300,
      },
      pending: [],
      selected: [],
      saved: [],
    },
    activeId: 0,
    activeTab: 'pending',
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
    } catch (_error) {
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
    } catch (_error) {
      return { ok: false, message: 'Unable to reach the server right now.' };
    }
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const section = () => qs('#validation-section');

  const statusClass = (statusKey) => {
    if (statusKey === 'selected') return 'is-success';
    if (statusKey === 'saved_next_batch') return 'is-muted';
    return 'is-warning';
  };

  const emailStatusClass = (record) => {
    if (record.selectionEmailNeedsResend) return 'is-danger';
    if (record.selectionEmailReady) return 'is-success';
    return 'is-muted';
  };

  const emailStatusLabel = (record) => {
    if (record.selectionEmailNeedsResend) return 'Needs Resend';
    if (record.selectionEmailReady) return 'Sent';
    return 'Not Required';
  };

  const emailStatusMeta = (record) => {
    if (record.selectionEmailSentAt) {
      return `Sent ${formatDate(record.selectionEmailSentAt)}`;
    }
    if (record.selectionEmailFailedAt) {
      return `Last failed ${formatDate(record.selectionEmailFailedAt)}`;
    }
    return record.statusKey === 'selected' ? 'Waiting for resend' : 'No Stage 2 email needed';
  };

  const emailStatusMarkup = (record, compact = false) => {
    if (record.statusKey !== 'selected') {
      return compact ? '--' : `
        <div class="validation-email-state">
          <span class="status-badge is-muted">Not Required</span>
        </div>
      `;
    }

    const badge = `<span class="status-badge ${emailStatusClass(record)}">${escapeHtml(emailStatusLabel(record))}</span>`;
    const meta = `<span class="${compact ? 'validation-email-state__meta' : 'validation-email-card__meta'}">${escapeHtml(emailStatusMeta(record))}</span>`;
    const error = record.selectionEmailNeedsResend && record.selectionEmailError
      ? `<span class="${compact ? 'validation-email-state__error' : 'validation-email-card__error'}">${escapeHtml(record.selectionEmailError)}</span>`
      : '';

    if (compact) {
      return `<div class="validation-email-state">${badge}${meta}</div>${error}`;
    }

    return `
      <div class="validation-email-card__state">
        ${badge}
        ${meta}
      </div>
      ${error}
    `;
  };

  const fileCardMarkup = (label, file) => {
    if (!file || !file.url) {
      return `
        <article class="validation-upload-card validation-upload-card--empty">
          <div>
            <span class="validation-upload-card__label">${escapeHtml(label)}</span>
            <strong>No file uploaded.</strong>
          </div>
        </article>
      `;
    }

    return `
      <article class="validation-upload-card">
        <div class="validation-upload-card__head">
          <span class="validation-upload-card__label">${escapeHtml(label)}</span>
          <a href="${escapeHtml(file.url)}" class="app-btn-outline validation-upload-card__link" target="_blank" rel="noopener">Open file</a>
        </div>
        ${file.isImage ? `<div class="validation-upload-card__preview"><img src="${escapeHtml(file.url)}" alt="${escapeHtml(label)}"></div>` : ''}
        <div class="validation-upload-card__meta">
          <strong>${escapeHtml(file.name || 'Uploaded file')}</strong>
          <span>${escapeHtml(file.mimeType || '--')}</span>
        </div>
      </article>
    `;
  };

  const renderSummary = () => {
    const summary = state.data.summary || {};
    const pairs = [
      ['validationBatchCapacity', summary.batchCapacity || 300],
      ['validationPendingCount', summary.pending || 0],
      ['validationApprovedCount', summary.selected || 0],
      ['validationDeferredCount', summary.saved || 0],
    ];
    pairs.forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(value);
    });

    const badgePairs = [
      ['validationPendingBadge', `${summary.pending || 0} pending`],
      ['validationSelectedBadge', `${summary.selected || 0} selected`],
      ['validationDeferredBadge', `${summary.saved || 0} saved`],
      ['validationTabPendingCount', summary.pending || 0],
      ['validationTabSelectedCount', summary.selected || 0],
      ['validationTabSavedCount', summary.saved || 0],
    ];
    badgePairs.forEach(([id, value]) => {
      const node = document.getElementById(id);
      if (node) node.textContent = String(value);
    });

    const emailFailureCount = Number(summary.selectionEmailFailures || 0);
    const emailMeta = document.getElementById('validationEmailFailureMeta');
    if (emailMeta) {
      emailMeta.textContent = emailFailureCount > 0 ? `${emailFailureCount} need resend` : 'All selected emails are up to date';
    }

    const emailBadge = document.getElementById('validationSelectedEmailBadge');
    if (emailBadge) {
      emailBadge.hidden = emailFailureCount <= 0;
      emailBadge.textContent = `${emailFailureCount} need resend`;
    }

    const navBadge = document.querySelector('[data-section-badge="validation"]');
    if (navBadge) {
      const pending = Number(summary.pending || 0);
      navBadge.textContent = pending > 0 ? String(pending) : '';
      navBadge.hidden = pending <= 0;
    }
  };

  const tableRowMarkup = (record, dateLabel, actionLabel = 'Open Validation', mode = 'pending') => `
    <tr>
      <td>
        <div class="validation-person-cell">
          <strong>${escapeHtml(record.fullName)}</strong>
        </div>
      </td>
      <td>${escapeHtml(record.completeAddress || '--')}</td>
      <td>${escapeHtml(record.contactNumber || '--')}</td>
      <td>${escapeHtml(record.email || '--')}</td>
      <td>${escapeHtml(dateLabel)}</td>
      ${mode === 'selected' ? `<td>${emailStatusMarkup(record, true)}</td>` : ''}
      <td class="actions">
        <button class="action-button action-button--review" data-open-validation="${record.id}">
          <i class="fas fa-folder-open"></i>
          <span>${escapeHtml(actionLabel)}</span>
        </button>
      </td>
    </tr>
  `;

  const renderTables = () => {
    const pendingBody = qs('#validationPendingTableBody');
    const selectedBody = qs('#validationApprovedTableBody');
    const savedBody = qs('#validationDeferredTableBody');
    if (!pendingBody || !selectedBody || !savedBody) return;

    setHTML(
      pendingBody,
      state.data.pending.length
        ? state.data.pending.map((record) => tableRowMarkup(record, formatDate(record.submittedAt), 'Open Validation', 'pending')).join('')
        : '<tr><td colspan="6">No pending registrations yet.</td></tr>'
    );

    setHTML(
      selectedBody,
      state.data.selected.length
        ? state.data.selected.map((record) => tableRowMarkup(record, formatDate(record.validatedAt || record.submittedAt), 'View Details', 'selected')).join('')
        : '<tr><td colspan="7">No selected registrations yet.</td></tr>'
    );

    setHTML(
      savedBody,
      state.data.saved.length
        ? state.data.saved.map((record) => tableRowMarkup(record, formatDate(record.validatedAt || record.submittedAt), 'View Details', 'saved')).join('')
        : '<tr><td colspan="6">No saved registrations yet.</td></tr>'
    );
  };

  const setActiveTab = (tabKey) => {
    const nextTab = ['pending', 'selected', 'saved'].includes(tabKey) ? tabKey : 'pending';
    state.activeTab = nextTab;

    document.querySelectorAll('[data-validation-tab]').forEach((button) => {
      const active = button.getAttribute('data-validation-tab') === nextTab;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.style.color = active ? '#ffffff' : '#18385b';
      button.style.webkitTextFillColor = active ? '#ffffff' : '#18385b';
      const badge = button.querySelector('span');
      if (badge instanceof HTMLElement) {
        badge.style.color = '#ffffff';
        badge.style.webkitTextFillColor = '#ffffff';
      }
    });

    document.querySelectorAll('[data-validation-panel]').forEach((panel) => {
      const active = panel.getAttribute('data-validation-panel') === nextTab;
      panel.hidden = !active;
    });
  };

  const renderNotice = (message = '', tone = 'info') => {
    const node = qs('#validationNotice');
    if (!node) return;
    if (!message) {
      node.hidden = true;
      node.textContent = '';
      node.className = 'notice info validation-notice';
      return;
    }

    node.hidden = false;
    node.textContent = message;
    node.className = `notice ${tone} validation-notice`;
  };

  const buildModalMarkup = (record) => `
    <div class="modal-overlay validation-review-modal" data-validation-modal>
      <div class="modal-card validation-review-modal__card" role="dialog" aria-modal="true" aria-labelledby="validationModalTitle">
        <div class="modal-header">
          <div class="validation-review-modal__title">
            <span class="admin-inline-pill">${record.statusKey === 'pending' ? 'Validation Review' : 'Registration Details'}</span>
            <h3 class="modal-title" id="validationModalTitle">${escapeHtml(record.fullName)}</h3>
            <small>Submitted ${formatDate(record.submittedAt)}</small>
          </div>
          <div class="validation-review-modal__status">
            <span class="status-badge ${statusClass(record.statusKey)}">${escapeHtml(record.statusLabel)}</span>
            <button class="modal-close" type="button" data-close-validation-modal aria-label="Close">&times;</button>
          </div>
        </div>
        <div class="modal-body validation-review-modal__body">
          <section class="validation-record-grid">
            <article class="validation-record-card">
              <span class="validation-record-card__label">Registrant Name</span>
              <strong>${escapeHtml(record.fullName)}</strong>
            </article>
            <article class="validation-record-card">
              <span class="validation-record-card__label">Email</span>
              <strong>${escapeHtml(record.email)}</strong>
            </article>
            <article class="validation-record-card">
              <span class="validation-record-card__label">Contact</span>
              <strong>${escapeHtml(record.contactNumber)}</strong>
            </article>
            ${record.statusKey === 'selected' ? `
            <article class="validation-record-card validation-email-card">
              <span class="validation-record-card__label">Stage 2 Email Invite</span>
              ${emailStatusMarkup(record)}
            </article>` : ''}
            <article class="validation-record-card validation-record-card--wide">
              <span class="validation-record-card__label">Complete Address</span>
              <strong>${escapeHtml(record.completeAddress)}</strong>
            </article>
          </section>

          <section class="validation-upload-grid">
            ${fileCardMarkup('Existing Business Photo', record.businessPhoto)}
            ${fileCardMarkup('Valid ID', record.validIdPhoto)}
          </section>
        </div>
        <div class="modal-footer validation-review-modal__footer">
          <button type="button" class="btn btn-outline-secondary" data-close-validation-modal>Close</button>
          ${record.statusKey === 'pending'
            ? `<button type="button" class="btn btn-warning" data-validation-action="hold" data-registration-id="${record.id}">Hold / Save for Next Batch</button>
          <button type="button" class="btn btn-success" data-validation-action="approve" data-registration-id="${record.id}">Approve for Current Batch</button>`
            : ''}
          ${record.statusKey === 'selected'
            ? `<button type="button" class="btn btn-outline-primary" data-validation-action="resend-email" data-registration-id="${record.id}">${record.selectionEmailNeedsResend ? 'Resend Stage 2 Email' : 'Send Stage 2 Email Again'}</button>`
            : ''}
        </div>
      </div>
    </div>
  `;

  const closeModal = () => {
    const root = qs('#modal-root');
    if (root) {
      setHTML(root, '');
    }
    state.activeId = 0;
  };

  const openModal = async (registrationId) => {
    const root = qs('#modal-root');
    if (!root) return;

    const response = await apiGet('api/validation/show', { id: registrationId });
    if (!response.ok || !response.registration) {
      renderNotice(response.message || 'Unable to load the registration.', 'danger');
      return;
    }

    state.activeId = registrationId;
    setHTML(root, buildModalMarkup(response.registration));
  };

  const refresh = async (noticeMessage = '', noticeTone = 'info') => {
    const response = await apiGet('api/validation');
    if (!response.ok) {
      renderNotice(response.message || 'Unable to load validation records.', 'danger');
      return;
    }

    state.data = response.data || state.data;
    renderSummary();
    renderTables();
    setActiveTab(state.activeTab);
    renderNotice(noticeMessage, noticeTone);
  };

  const handleReview = async (button) => {
    const registrationId = Number(button.dataset.registrationId || 0);
    const action = button.dataset.validationAction || '';
    if (!registrationId || !action) return;

    button.disabled = true;
    const response = action === 'resend-email'
      ? await apiPost('api/validation/resend-selection-email', { registrationId })
      : await apiPost('api/validation/review', {
        registrationId,
        action,
      });
    button.disabled = false;

    if (!response.ok) {
      renderNotice(response.message || 'Unable to update the validation email state.', 'danger');
      return;
    }

    state.data = response.state || state.data;
    renderSummary();
    renderTables();
    setActiveTab(state.activeTab);
    renderNotice(response.message || 'Validation decision saved.', 'info');

    if (action === 'resend-email') {
      if (state.activeId === registrationId) {
        const refreshed = await apiGet('api/validation/show', { id: registrationId });
        if (refreshed.ok && refreshed.registration) {
          const root = qs('#modal-root');
          if (root) {
            setHTML(root, buildModalMarkup(refreshed.registration));
          }
        }
      }
      return;
    }

    closeModal();
  };

  const bindEvents = () => {
    const target = section();
    if (!target || target.dataset.validationBound === 'true') return;

    delegate(target, 'click', '[data-open-validation]', (_event, trigger) => {
      openModal(Number(trigger.dataset.openValidation || 0));
    });

    delegate(target, 'click', '[data-validation-tab]', (_event, trigger) => {
      setActiveTab(trigger.dataset.validationTab || 'pending');
    });

    document.addEventListener('click', (event) => {
      const targetNode = event.target;
      if (!(targetNode instanceof HTMLElement)) return;

      if (targetNode.matches('[data-close-validation-modal]')) {
        closeModal();
      }

      const actionButton = targetNode.closest('[data-validation-action]');
      if (actionButton instanceof HTMLElement) {
        handleReview(actionButton);
      }
    });

    document.getElementById('validationRefreshButton')?.addEventListener('click', () => {
      refresh('Validation queue refreshed.');
    });

    target.dataset.validationBound = 'true';
  };

  window.App = window.App || {};
  window.App.modules = window.App.modules || {};
  window.App.modules.validation = {
    init() {
      bindEvents();
      setActiveTab(state.activeTab);
      refresh();
    },
    refresh,
  };
})();

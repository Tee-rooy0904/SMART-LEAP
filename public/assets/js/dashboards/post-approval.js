(function () {
    const state = {
        baseUrl: window.SMARTLEAP_BASE_URL || '',
        authUser: window.SMARTLEAP_AUTH_USER || null,
        tracker: null,
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        bindStaticEvents();
        await loadTrackerState();
    }

    function bindStaticEvents() {
        document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
        document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebarMenu);
        window.addEventListener('resize', syncSidebarMenuState);
        syncSidebarMenuState();
    }

    async function loadTrackerState() {
        try {
            const payload = await fetchJson('api/post-approval');
            if (!payload.ok) {
                throw new Error(payload.message || 'Unable to load post-approval tasks.');
            }

            state.tracker = payload.state || null;
            renderTracker();
        } catch (error) {
            renderFatalState(error.message || 'Unable to load post-approval tasks.');
        }
    }

    function renderTracker() {
        renderIdentity();

        if (!state.tracker) {
            renderFatalState('Post-approval tracker is unavailable.');
            return;
        }

        const tasks = Array.isArray(state.tracker.tasks) ? state.tracker.tasks : [];
        const summary = state.tracker.summary || {};
        const firstActionable = tasks.find((task) => task.interactive && ['Unlocked', 'In Progress', 'Needs Correction', 'Rejected'].includes(task.status))
            || tasks.find((task) => task.interactive)
            || tasks[0]
            || null;
        const remarkTask = tasks.find((task) => task.reviewerRemarks);

        setText('trackerUnlockState', state.tracker.isUnlocked ? 'Unlocked' : 'Locked');
        setText('trackerProgressValue', `${summary.verified || 0}/${summary.total || tasks.length} verified`);
        setText('trackerPriority', firstActionable ? firstActionable.title : 'Await training unlock');
        setText('trackerNextAction', firstActionable ? (firstActionable.interactive ? 'Open task form' : 'Review task status') : 'Open task when available');
        setText('trackerUnlockedAt', state.tracker.unlockedAt ? formatDateTime(state.tracker.unlockedAt) : 'Not unlocked');
        setText('trackerUnlockMeta', state.tracker.isUnlocked
            ? `Unlocked after training completion${state.tracker.unlockedAt ? ` on ${formatDateTime(state.tracker.unlockedAt)}` : ''}.`
            : 'Training completion has not unlocked your post-approval tasks yet.');
        setText('trackerTaskCount', `${tasks.length} task${tasks.length === 1 ? '' : 's'}`);
        setText('trackerTaskChip', `${tasks.length} task${tasks.length === 1 ? '' : 's'}`);
        setText('trackerProgressMeta', tasks.length > 0
            ? `${(summary.submitted || 0) + (summary.inProgress || 0) + (summary.needsCorrection || 0)} task${(((summary.submitted || 0) + (summary.inProgress || 0) + (summary.needsCorrection || 0)) === 1) ? '' : 's'} still need action or review.`
            : 'No post-approval tasks are currently available.');
        setText('trackerFeedbackSummary', remarkTask ? 'Has reviewer remarks' : 'No remarks');
        setText('trackerFeedbackMeta', remarkTask ? remarkTask.reviewerRemarks : 'Reviewer instructions and correction notes will be summarized here.');
        setText('trackerSubtitle', state.tracker.isUnlocked
            ? 'Choose a task below to open the dedicated form page. Your saved values and statuses remain intact.'
            : 'This tracker will activate once training completion unlocks the post-approval phase.');

        renderTaskCards(tasks);
    }

    function renderIdentity() {
        const authUser = state.authUser || {};
        const displayName = authUser.name || 'Applicant';
        const initial = (displayName.trim().charAt(0) || 'A').toUpperCase();

        setText('sidebarUserName', displayName);
        setText('trackerUserEmail', authUser.email || 'Complete your unlocked CSWDD forms from this dedicated tracker.');

        ['sidebarAvatar', 'bannerAvatar'].forEach((id) => {
            const node = document.getElementById(id);
            if (node) {
                node.textContent = initial;
            }
        });
    }

    function renderTaskCards(tasks) {
        const container = document.getElementById('trackerTaskCards');
        if (!container) {
            return;
        }

        if (tasks.length === 0) {
            container.innerHTML = '<article class="post-approval-taskcard is-empty">Post-approval tasks will appear here after training completion.</article>';
            return;
        }

        container.innerHTML = tasks.map((task) => {
            const href = task.interactive
                ? routeUrl(`post-approval-form?code=${encodeURIComponent(task.code)}`)
                : routeUrl(`post-approval-form?code=${encodeURIComponent(task.code)}`);

            return `
                <article class="post-approval-taskcard ${task.interactive ? '' : 'is-disabled'}">
                    <div class="post-approval-taskcard__meta">
                        <span class="post-approval-taskcard__status status-${slugify(task.status)}">${escapeHtml(task.status)}</span>
                        ${task.interactive ? '<span class="post-approval-taskcard__badge">Open form</span>' : '<span class="post-approval-taskcard__badge is-muted">Staged next</span>'}
                    </div>
                    <strong>${escapeHtml(task.title)}</strong>
                    <p>${escapeHtml(task.summary || task.helpText || '')}</p>
                    <div class="post-approval-taskcard__footer">
                        <span>${escapeHtml(`${task.completion || 0}% complete`)}</span>
                        ${task.reviewerRemarks ? '<span class="post-approval-taskcard__issue">Has remarks</span>' : '<span class="tracker-task-open">Open task</span>'}
                    </div>
                    <a class="post-approval-taskcard__overlay" href="${escapeAttribute(href)}" aria-label="Open ${escapeAttribute(task.title)}"></a>
                </article>
            `;
        }).join('');
    }

    function renderFatalState(message) {
        showToast(message, 'warning');
        setText('trackerSubtitle', message);
        const container = document.getElementById('trackerTaskCards');
        if (container) {
            container.innerHTML = `<article class="post-approval-taskcard is-empty">${escapeHtml(message)}</article>`;
        }
    }

    async function handleLogout() {
        try {
            const payload = await fetchJson('auth/logout', {
                method: 'POST',
                headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
            });
            window.location.href = routeUrl(payload.redirect || 'portal');
        } catch (error) {
            showToast(error.message || 'Unable to log out right now.', 'warning');
        }
    }

    async function fetchJson(path, options = {}) {
        const response = await fetch(routeUrl(path), {
            credentials: 'same-origin',
            headers: {
                Accept: 'application/json',
                ...options.headers,
            },
            ...options,
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            if (response.redirected) {
                window.location.href = response.url;
                throw new Error('Redirecting...');
            }

            throw new Error(`Unexpected response from ${path}.`);
        }

        const payload = await response.json();
        if (!response.ok) {
            if (payload.redirect) {
                window.location.href = routeUrl(payload.redirect);
                throw new Error('Redirecting...');
            }
            throw new Error(payload.message || 'Request failed.');
        }

        return payload;
    }

    function toggleSidebarMenu() {
        const sidebar = document.querySelector('.dash-sidebar');
        if (!sidebar) {
            return;
        }

        sidebar.classList.toggle('is-open');
        syncSidebarMenuState();
    }

    function syncSidebarMenuState() {
        const sidebar = document.querySelector('.dash-sidebar');
        const toggle = document.getElementById('sidebarToggle');
        if (!sidebar || !toggle) {
            return;
        }

        if (window.innerWidth > 960) {
            sidebar.classList.remove('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            return;
        }

        toggle.setAttribute('aria-expanded', sidebar.classList.contains('is-open') ? 'true' : 'false');
    }

    function routeUrl(path) {
        const base = state.baseUrl || '';
        return `${base}/${String(path || '').replace(/^\/+/, '')}`;
    }

    function setText(id, value) {
        const node = document.getElementById(id);
        if (node) {
            node.textContent = value ?? '';
        }
    }

    function formatDateTime(value) {
        if (!value) {
            return '--';
        }
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) {
            return String(value);
        }
        return date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    function showToast(message, tone) {
        const stack = document.getElementById('toastStack');
        if (!stack) {
            return;
        }
        const toast = document.createElement('div');
        toast.className = `toast ${tone || 'info'}`;
        toast.textContent = message;
        stack.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
        }, 2600);
        setTimeout(() => {
            toast.remove();
        }, 3400);
    }

    function escapeHtml(value) {
        const node = document.createElement('div');
        node.textContent = value == null ? '' : String(value);
        return node.innerHTML;
    }

    function escapeAttribute(value) {
        return escapeHtml(value).replace(/"/g, '&quot;');
    }
})();

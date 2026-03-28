(function () {
  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');

  const SECTION_META = {
    dashboard: {
      eyebrow: 'Admin Workspace',
      title: 'Dashboard',
      subtitle: '',
      state: 'Live Overview',
    },
    applications: {
      eyebrow: 'Admin Workspace',
      title: 'Applications',
      subtitle: '',
      state: 'Live Module',
    },
    training: {
      eyebrow: 'Admin Workspace',
      title: 'Training',
      subtitle: '',
      state: 'Live Module',
    },
    team: {
      eyebrow: 'Admin Workspace',
      title: 'Team',
      subtitle: '',
      state: 'Live Module',
    },
    beneficiaries: {
      eyebrow: 'Prepared Section',
      title: 'Beneficiaries',
      subtitle: '',
      state: 'Structured Only',
    },
    repayments: {
      eyebrow: 'Prepared Section',
      title: 'Repayments',
      subtitle: '',
      state: 'Partial Signals',
    },
    reports: {
      eyebrow: 'Prepared Section',
      title: 'Reports',
      subtitle: '',
      state: 'Structured Only',
    },
    notifications: {
      eyebrow: 'Prepared Section',
      title: 'Notifications',
      subtitle: '',
      state: 'Structured Only',
    },
  };

  function routeUrl(path) {
    return `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.from((root || document).querySelectorAll(selector));
  }

  function sectionElement(section) {
    return document.getElementById(`${section}-section`);
  }

  function closeSidebar() {
    const shell = document.getElementById('mainSystem');
    const toggle = document.querySelector('.sidebar-toggle');
    shell?.setAttribute('data-sidebar-open', 'false');
    toggle?.setAttribute('aria-expanded', 'false');
  }

  function setSidebarOpen(open) {
    const shell = document.getElementById('mainSystem');
    const toggle = document.querySelector('.sidebar-toggle');
    shell?.setAttribute('data-sidebar-open', open ? 'true' : 'false');
    toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function updateHeader(section) {
    const meta = SECTION_META[section] || SECTION_META.dashboard;
    const eyebrow = document.getElementById('adminSectionEyebrow');
    const title = document.getElementById('adminSectionTitle');
    const subtitle = document.getElementById('adminSectionSubtitle');
    const stateBadge = document.getElementById('adminSectionStateBadge');

    if (eyebrow) eyebrow.textContent = meta.eyebrow || 'Admin Workspace';
    if (title) title.textContent = meta.title;
    if (subtitle) {
      subtitle.textContent = meta.subtitle || '';
      subtitle.hidden = !meta.subtitle;
    }
    if (stateBadge) {
      stateBadge.textContent = meta.state || 'Live Overview';
      stateBadge.dataset.state = (meta.state || '').toLowerCase().replace(/\s+/g, '-');
    }
  }

  function setSection(nextSection) {
    const section = SECTION_META[nextSection] ? nextSection : 'dashboard';
    document.body.dataset.adminSection = section;

    qsa('[data-role-section]').forEach((panel) => {
      const active = panel.id === `${section}-section`;
      panel.hidden = !active;
      panel.style.display = active ? '' : 'none';
    });

    qsa('.nav-link[data-section]').forEach((button) => {
      button.classList.toggle('active', button.dataset.section === section);
    });

    updateHeader(section);
    closeSidebar();
    window.location.hash = section;
    sectionElement(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function triggerCommand(command) {
    switch (command) {
      case 'open-applications':
        setSection('applications');
        break;
      case 'create-training':
        setSection('training');
        requestAnimationFrame(() => {
          qs('#training-focus-create')?.click();
        });
        break;
      case 'add-staff':
        setSection('team');
        requestAnimationFrame(() => {
          qs('#team-form-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        break;
      case 'assign-pdo':
        setSection('team');
        requestAnimationFrame(() => {
          qs('#team-assignment-block')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        break;
      case 'open-repayments':
        setSection('repayments');
        break;
      default:
        break;
    }
  }

  function initNavigation() {
    qsa('.nav-link[data-section]').forEach((button) => {
      button.addEventListener('click', () => setSection(button.dataset.section || 'dashboard'));
    });

    qsa('[data-section-link]').forEach((trigger) => {
      trigger.addEventListener('click', () => setSection(trigger.dataset.sectionLink || 'dashboard'));
    });

    qsa('[data-quick-action]').forEach((trigger) => {
      trigger.addEventListener('click', () => triggerCommand(trigger.dataset.quickAction || ''));
    });

    const notificationButton = document.getElementById('adminNotificationsButton');
    notificationButton?.addEventListener('click', () => setSection('notifications'));

  }

  function initSidebar() {
    const toggle = document.querySelector('.sidebar-toggle');
    const backdrop = document.querySelector('[data-sidebar-close]');

    toggle?.addEventListener('click', () => {
      const shell = document.getElementById('mainSystem');
      const open = shell?.getAttribute('data-sidebar-open') === 'true';
      setSidebarOpen(!open);
    });

    backdrop?.addEventListener('click', () => closeSidebar());

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        closeSidebar();
      }
    });
  }

  function initAccountMenu() {
    const trigger = document.getElementById('adminAccountMenuTrigger');
    const panel = document.getElementById('adminAccountMenuPanel');
    if (!trigger || !panel) return;

    const setExpanded = (expanded) => {
      trigger.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      panel.hidden = !expanded;
    };

    trigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const expanded = trigger.getAttribute('aria-expanded') === 'true';
      setExpanded(!expanded);
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.admin-account-menu')) {
        setExpanded(false);
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setExpanded(false);
      }
    });
  }

  function initLogout() {
    const button = document.getElementById('system-logout');
    if (!button) return;

    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await fetch(routeUrl('auth/logout'), {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'same-origin',
        });
      } catch (error) {
        console.warn('Admin logout failed', error);
      } finally {
        window.location.href = routeUrl('login');
      }
    });
  }

  function initModules() {
    const modules = window.App?.modules || {};
    modules.applications?.init?.();
    modules.training?.init?.();
    modules.team?.init?.();
  }

  document.addEventListener('DOMContentLoaded', () => {
    initModules();
    initNavigation();
    initSidebar();
    initAccountMenu();
    initLogout();

    const initialSection = (window.location.hash || '').replace(/^#/, '');
    setSection(initialSection || 'dashboard');
  });
})();

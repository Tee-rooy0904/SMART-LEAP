(function () {
  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');

  function routeUrl(path) {
    return `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;
  }

  function showSection(section) {
    document.querySelectorAll('[data-role-section]').forEach((panel) => {
      panel.style.display = panel.id === `${section}-section` ? '' : 'none';
    });

    document.querySelectorAll('.admin-sidebar .nav-link[data-section]').forEach((link) => {
      link.classList.toggle('active', link.dataset.section === section);
    });
  }

  function initNavigation() {
    document.querySelectorAll('.admin-sidebar .nav-link[data-section]').forEach((link) => {
      link.addEventListener('click', (event) => {
        event.preventDefault();
        showSection(link.dataset.section || 'dashboard');
      });
    });
  }

  function initSidebar() {
    const shell = document.getElementById('mainSystem');
    const toggle = document.querySelector('.sidebar-toggle');
    const backdrop = document.querySelector('[data-sidebar-close]');
    const setOpen = (open) => {
      shell?.setAttribute('data-sidebar-open', open ? 'true' : 'false');
      toggle?.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    toggle?.addEventListener('click', () => {
      const open = shell?.getAttribute('data-sidebar-open') === 'true';
      setOpen(!open);
    });
    backdrop?.addEventListener('click', () => setOpen(false));
    window.addEventListener('resize', () => {
      if (window.innerWidth > 1024) {
        setOpen(false);
      }
    });
  }

  function initLogout() {
    const button = document.getElementById('sw-logout');
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
        console.warn('Social worker logout failed', error);
      } finally {
        window.location.href = routeUrl('login');
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSidebar();
    initLogout();
    showSection('dashboard');
  });
})();

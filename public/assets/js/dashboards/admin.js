(function () {
  const publicBase = () => {
    if (typeof window.SMARTLEAP_BASE_URL === 'string' && window.SMARTLEAP_BASE_URL.length > 0) {
      return window.SMARTLEAP_BASE_URL.replace(/\/+$/, '');
    }

    const match = window.location.pathname.match(/^(.*\/public)(?:\/.*)?$/);
    return match ? match[1] : '';
  };

  const routeUrl = (path) => {
    const trimmed = String(path || '').replace(/^\/+/, '');
    return `${publicBase()}/${trimmed}`;
  };

  const bindLogout = () => {
    const logoutButton = document.getElementById('system-logout');
    if (!logoutButton || logoutButton.dataset.logoutBound === 'true') {
      return;
    }

    logoutButton.dataset.logoutBound = 'true';

    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;

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
  };

  const bindQuickActions = () => {
    const trainingButton = document.getElementById('open-training-workspace');
    if (!trainingButton || trainingButton.dataset.bound === 'true') {
      return;
    }

    trainingButton.dataset.bound = 'true';
    trainingButton.addEventListener('click', () => {
      if (window.App && window.App.modules && window.App.modules.nav && window.App.modules.nav.setActiveSection) {
        window.App.modules.nav.setActiveSection('training');
      }
    });
  };

  const initModules = () => {
    bindLogout();
    bindQuickActions();

    if (!window.App) {
      return;
    }

    if (window.App.state) {
      window.App.state.activeSection = 'training';
    }

    const modules = window.App.modules || {};
    Object.keys(modules).forEach((key) => {
      if (modules[key] && modules[key].init) {
        try {
          modules[key].init();
        } catch (error) {
          console.error(`Admin module failed to initialize: ${key}`, error);
        }
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModules);
  } else {
    initModules();
  }
})();

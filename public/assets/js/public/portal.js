(function () {
    function publicBase() {
        const match = window.location.pathname.match(/^(.*\/public)(?:\/.*)?$/);
        return match ? match[1] : '';
    }

    function routeUrl(path) {
        const trimmed = String(path || '').replace(/^\/+/, '');
        return `${publicBase()}/${trimmed}`;
    }

    function resolveTargetId(targetId) {
        if (targetId === 'authShell') return 'signin';
        if (targetId === 'help') return 'support';
        return targetId;
    }

    function getSectionTarget(targetId) {
        const canonicalId = resolveTargetId(targetId);
        const target = document.getElementById(canonicalId);
        if (!target) return null;
        return { canonicalId, target };
    }

    function scrollToSectionWithOffset(targetId) {
        const resolved = getSectionTarget(targetId);
        if (!resolved) return false;
        try {
            resolved.target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch {
            resolved.target.scrollIntoView(true);
        }
        return true;
    }

    function updateNavState(targetId) {
        const canonicalId = resolveTargetId(targetId);
        document.querySelectorAll('.nav-link, .mobile-link, .help-link').forEach((link) => {
            link.classList.remove('is-active');
        });

        document.querySelectorAll(`.nav-link[href="#${canonicalId}"], .mobile-link[href="#${canonicalId}"], .help-link[href="#${canonicalId}"]`).forEach((link) => {
            link.classList.add('is-active');
        });
    }

    function closeMobileNav() {
        const mobileNav = document.getElementById('mobileNav');
        const menuBtn = document.getElementById('menuBtn');
        if (mobileNav && !mobileNav.hidden) {
            mobileNav.hidden = true;
            menuBtn?.setAttribute('aria-expanded', 'false');
            document.body.classList.remove('menu-open');
        }
    }

    function initHeaderMenu() {
        const menuBtn = document.getElementById('menuBtn');
        const mobileNav = document.getElementById('mobileNav');

        function toggleMenu(open) {
            if (!menuBtn || !mobileNav) return;
            mobileNav.hidden = !open;
            menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
            document.body.classList.toggle('menu-open', open);
        }

        menuBtn?.addEventListener('click', () => {
            toggleMenu(menuBtn.getAttribute('aria-expanded') !== 'true');
        });

        document.querySelectorAll('.mobile-cta').forEach((btn) => {
            btn.addEventListener('click', closeMobileNav);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') toggleMenu(false);
        });
    }

    function setupActiveNav() {
        const sections = ['program', 'guide', 'support']
            .map((id) => document.getElementById(id))
            .filter(Boolean);
        if (!sections.length) return;

        const headerHeight = document.querySelector('.site-header')?.offsetHeight ?? 0;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    updateNavState(entry.target.id);
                }
            });
        }, {
            rootMargin: `-${headerHeight + 12}px 0px -55% 0px`,
            threshold: 0.1
        });

        sections.forEach((section) => observer.observe(section));
    }

    function setupSectionNav() {
        document.querySelectorAll('.nav-link, .mobile-link, .help-link').forEach((link) => {
            link.addEventListener('click', (event) => {
                const href = link.getAttribute('href');
                if (!href || !href.startsWith('#')) return;

                const targetId = href.slice(1);
                const resolved = getSectionTarget(targetId);
                if (!resolved) return;

                event.preventDefault();
                if (!scrollToSectionWithOffset(targetId)) return;
                history.replaceState(null, '', `#${resolved.canonicalId}`);
                updateNavState(targetId);
                closeMobileNav();
            });
        });
    }

    function setupAuth() {
        const authError = document.querySelector('.auth-error');
        const form = document.getElementById('authForm');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const entryPoint = form?.querySelector('input[name="entryPoint"]');
        const toggle = document.querySelector('[data-action="toggle-password"]');
        const capsHint = document.getElementById('capsHint');
        const signInBtn = document.getElementById('signInBtn');

        document.querySelectorAll('[data-action="open-auth"], [data-action="focus-login"]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.preventDefault();
                scrollToSectionWithOffset('authShell');
                email?.focus({ preventScroll: true });
            });
        });

        toggle?.addEventListener('click', () => {
            if (!password) return;
            const isPassword = password.type === 'password';
            password.type = isPassword ? 'text' : 'password';
            toggle.textContent = isPassword ? 'Hide' : 'Show';
        });

        password?.addEventListener('keyup', (event) => {
            const isOn = event.getModifierState && event.getModifierState('CapsLock');
            if (capsHint) capsHint.hidden = !isOn;
        });

        password?.addEventListener('blur', () => {
            if (capsHint) capsHint.hidden = true;
        });

        const clearError = () => {
            if (authError) authError.hidden = true;
        };
        email?.addEventListener('input', clearError);
        password?.addEventListener('input', clearError);

        form?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const emailVal = email?.value.trim() ?? '';
            const passVal = password?.value ?? '';

            if (!emailVal || !passVal) {
                if (authError) {
                    authError.textContent = 'Email and password are required.';
                    authError.hidden = false;
                }
                return;
            }

            if (signInBtn) {
                signInBtn.disabled = true;
                signInBtn.textContent = 'Signing in...';
            }

            try {
                const response = await fetch(routeUrl('auth/login'), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        Accept: 'application/json'
                    },
                    credentials: 'same-origin',
                    body: new URLSearchParams({
                        email: emailVal,
                        password: passVal,
                        entryPoint: entryPoint?.value || 'portal'
                    }).toString()
                });

                const payload = await response.json();
                if (!response.ok || !payload.ok) {
                    if (authError) {
                        authError.textContent = payload.message || 'Incorrect email or password.';
                        authError.hidden = false;
                    }
                    return;
                }

                window.location.href = routeUrl(payload.redirect || 'applicant-dashboard#profile-page');
            } catch (error) {
                console.error('Portal login failed', error);
                if (authError) {
                    authError.textContent = 'Unable to sign in right now.';
                    authError.hidden = false;
                }
            } finally {
                if (signInBtn) {
                    signInBtn.disabled = false;
                    signInBtn.textContent = 'Sign in';
                }
            }
        });
    }

    function setupGuideSearch() {
        const input = document.getElementById('guideSearch');
        const accordion = document.getElementById('guideAccordion');
        if (!input || !accordion) return;

        const items = Array.from(accordion.querySelectorAll('.module'));
        const normalize = (value) => (value || '').toLowerCase().trim();

        const applyFilter = () => {
            const query = normalize(input.value);
            items.forEach((detail) => {
                const text = normalize(detail.innerText || '');
                detail.style.display = query === '' || text.includes(query) ? '' : 'none';
            });
        };

        input.addEventListener('input', applyFilter);
        document.querySelector('[data-action="search-guide"]')?.addEventListener('click', () => {
            applyFilter();
            scrollToSectionWithOffset('guide');
            updateNavState('guide');
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        initHeaderMenu();
        setupSectionNav();
        setupActiveNav();
        setupAuth();
        setupGuideSearch();
    });
})();

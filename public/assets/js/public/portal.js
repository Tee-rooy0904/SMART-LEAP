(function () {
    function publicBase() {
        const match = window.location.pathname.match(/^(.*\/public)(?:\/.*)?$/);
        return match ? match[1] : '';
    }

    function routeUrl(path) {
        const trimmed = String(path || '').replace(/^\/+/, '');
        return `${publicBase()}/${trimmed}`;
    }

    function setAuthLoading(active, message) {
        const overlay = document.getElementById('authLoadingScreen');
        const copy = document.getElementById('authLoadingCopy');
        if (!overlay) return;
        if (copy && message) {
            copy.textContent = message;
        }
        overlay.hidden = !active;
        document.body.classList.toggle('auth-loading', active);
    }

    function closeMobileNav() {
        const mobileNav = document.getElementById('mobileNav');
        const menuBtn = document.getElementById('menuBtn');
        if (!mobileNav) return;
        mobileNav.hidden = true;
        menuBtn?.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
    }

    function setupMobileNav() {
        const menuBtn = document.getElementById('menuBtn');
        const mobileNav = document.getElementById('mobileNav');
        if (!menuBtn || !mobileNav) return;

        menuBtn.addEventListener('click', () => {
            const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
            mobileNav.hidden = isOpen;
            menuBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
            document.body.classList.toggle('menu-open', !isOpen);
        });

        document.querySelectorAll('.mobile-link').forEach((link) => {
            link.addEventListener('click', closeMobileNav);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMobileNav();
        });
    }

    function setupAuth() {
        const form = document.getElementById('authForm');
        const email = document.getElementById('email');
        const password = document.getElementById('password');
        const authError = document.querySelector('.auth-error');
        const signInBtn = document.getElementById('signInBtn');
        const entryPoint = form?.querySelector('input[name="entryPoint"]');
        const capsHint = document.getElementById('capsHint');

        document.querySelectorAll('[data-action="open-auth"]').forEach((button) => {
            button.addEventListener('click', (event) => {
                const authShell = document.getElementById('authShell');
                if (!authShell) return;
                event.preventDefault();
                authShell.scrollIntoView({ behavior: 'smooth', block: 'center' });
                email?.focus({ preventScroll: true });
                closeMobileNav();
            });
        });

        document.querySelector('[data-action="toggle-password"]')?.addEventListener('click', (event) => {
            event.preventDefault();
            if (!password) return;
            const show = password.type === 'password';
            password.type = show ? 'text' : 'password';
            event.currentTarget.textContent = show ? 'Hide' : 'Show';
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
            setAuthLoading(true, 'Securing your SMART LEAP session...');

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
                    if (payload.requiresVerification && payload.redirect) {
                        window.location.href = routeUrl(payload.redirect);
                        return;
                    }
                    if (authError) {
                        authError.textContent = payload.message || 'Incorrect email or password.';
                        authError.hidden = false;
                    }
                    setAuthLoading(false);
                    return;
                }

                window.location.href = routeUrl(payload.redirect || 'applicant-dashboard#profile-page');
            } catch (error) {
                setAuthLoading(false);
                if (authError) {
                    authError.textContent = 'Unable to sign in right now.';
                    authError.hidden = false;
                }
            } finally {
                if (document.visibilityState !== 'hidden') {
                    setAuthLoading(false);
                }
                if (signInBtn) {
                    signInBtn.disabled = false;
                    signInBtn.textContent = 'Sign in';
                }
            }
        });
    }

    function setupAccordions() {
        document.querySelectorAll('[data-accordion-trigger]').forEach((trigger) => {
            const panel = trigger.querySelector('[data-accordion-panel]');
            if (!panel) return;

            trigger.addEventListener('click', () => {
                const isOpen = trigger.getAttribute('aria-expanded') === 'true';
                trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
                trigger.classList.toggle('is-open', !isOpen);
                panel.hidden = isOpen;
            });
        });
    }

    function setupSelectableCards() {
        const cards = Array.from(document.querySelectorAll('[data-select-card]'));
        if (!cards.length) return;

        const activate = (card) => {
            cards.forEach((item) => item.classList.toggle('is-active', item === card));
        };

        cards.forEach((card) => {
            card.addEventListener('click', () => activate(card));
            card.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate(card);
                }
            });
        });
    }

    function setupTimelineDetails() {
        const items = Array.from(document.querySelectorAll('[data-timeline-item]'));
        if (!items.length) return;

        const activate = (item) => {
            items.forEach((entry) => entry.classList.toggle('is-active', entry === item));
        };

        items.forEach((item) => {
            item.addEventListener('click', () => activate(item));
            item.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    activate(item);
                }
            });
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        setupMobileNav();
        setupAuth();
        setupAccordions();
        setupSelectableCards();
        setupTimelineDetails();
    });
})();

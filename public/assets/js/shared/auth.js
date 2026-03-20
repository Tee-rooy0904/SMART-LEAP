(function () {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) {
        return;
    }

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const entryPointInput = loginForm.querySelector('input[name="entryPoint"]');
    const submitButton = loginForm.querySelector('button[type="submit"], .login-btn');
    const showPasswordCheckbox = document.getElementById('showPassword');

    function publicBase() {
        const match = window.location.pathname.match(/^(.*\/public)(?:\/.*)?$/);
        return match ? match[1] : '';
    }

    function routeUrl(path) {
        const trimmed = String(path || '').replace(/^\/+/, '');
        return `${publicBase()}/${trimmed}`;
    }

    function removeAlert() {
        document.querySelector('.auth-inline-alert')?.remove();
    }

    function showAlert(message, type) {
        removeAlert();
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} auth-inline-alert mt-3`;
        alert.textContent = message;
        loginForm.appendChild(alert);
    }

    function setSubmitting(isSubmitting) {
        if (!submitButton) {
            return;
        }

        submitButton.disabled = isSubmitting;
        submitButton.textContent = isSubmitting ? 'Logging in...' : 'Login';
    }

    async function performLogin() {
        removeAlert();

        const email = emailInput?.value.trim() ?? '';
        const password = passwordInput?.value ?? '';

        if (!email || !password) {
            showAlert('Email and password are required.', 'danger');
            return;
        }

        setSubmitting(true);

        try {
            const response = await fetch(routeUrl('auth/login'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: new URLSearchParams({
                    email,
                    password,
                    entryPoint: entryPointInput?.value || 'staff',
                }).toString(),
            });

            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                showAlert(payload.message || 'Invalid credentials.', 'danger');
                return;
            }

            showAlert('Login successful. Redirecting...', 'success');
            window.setTimeout(() => {
                window.location.href = routeUrl(payload.redirect || 'profile-completion');
            }, 350);
        } catch (error) {
            console.error('Login request failed', error);
            showAlert('Unable to process login right now. Please try again.', 'danger');
        } finally {
            setSubmitting(false);
        }
    }

    window.login = performLogin;

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        performLogin();
    });

    showPasswordCheckbox?.addEventListener('change', () => {
        if (!passwordInput) {
            return;
        }

        passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password';
    });
})();

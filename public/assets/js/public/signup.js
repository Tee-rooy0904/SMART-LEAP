(function () {
    const form = document.getElementById('signupForm');
    if (!form) return;

    const fields = {
        fullName: document.getElementById('signupFullName'),
        email: document.getElementById('signupEmail'),
        password: document.getElementById('signupPassword'),
        confirmPassword: document.getElementById('signupPasswordConfirm')
    };

    const feedback = document.getElementById('signupFeedback');
    const passwordHints = document.getElementById('passwordHints');
    const submitBtn = document.getElementById('signupSubmit');
    const toggleButtons = document.querySelectorAll('.toggle-visibility');
    const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    toggleButtons.forEach((button) => {
        button.addEventListener('click', () => {
            const targetId = button.dataset.toggle;
            const input = document.getElementById(targetId);
            if (!input) return;
            const isPassword = input.getAttribute('type') === 'password';
            input.setAttribute('type', isPassword ? 'text' : 'password');
            button.setAttribute('aria-label', `${isPassword ? 'Hide' : 'Show'} password`);
            button.textContent = isPassword ? 'Hide' : 'Show';
            button.classList.toggle('is-visible', !isPassword);
        });
    });

    fields.password.addEventListener('focus', () => {
        togglePasswordHints(true);
    });

    fields.password.addEventListener('blur', () => {
        togglePasswordHints(Boolean(fields.password.value));
    });

    fields.password.addEventListener('input', () => {
        updatePasswordHints(fields.password.value);
        togglePasswordHints(Boolean(fields.password.value));
    });

    function togglePasswordHints(visible) {
        if (!passwordHints) return;
        passwordHints.classList.toggle('is-visible', visible);
    }

    function updatePasswordHints(value) {
        const hints = {
            length: value.length >= 8,
            number: /\d/.test(value),
            upper: /[A-Z]/.test(value),
            lower: /[a-z]/.test(value)
        };

        Object.entries(hints).forEach(([key, satisfied]) => {
            const hint = passwordHints.querySelector(`[data-hint="${key}"]`);
            if (hint) {
                hint.classList.toggle('is-valid', satisfied);
            }
        });
    }

    function resetErrors() {
        feedback.hidden = true;
        feedback.textContent = '';

        Object.values(fields).forEach((field) => {
            const error = form.querySelector(`[data-error-for="${field.id}"]`);
            if (error) {
                error.textContent = '';
                error.removeAttribute('data-visible');
            }
        });
    }

    function showFieldError(field, message) {
        const error = form.querySelector(`[data-error-for="${field.id}"]`);
        if (error) {
            error.textContent = message;
            error.setAttribute('data-visible', 'true');
        }
    }

    function setFeedback(type, message) {
        feedback.hidden = false;
        feedback.dataset.tone = type;
        feedback.textContent = message;
    }

    function validate() {
        let valid = true;
        resetErrors();

        if (!fields.fullName.value.trim() || fields.fullName.value.trim().length < 3) {
            valid = false;
            showFieldError(fields.fullName, 'Enter your complete name (at least 3 characters).');
        }

        if (!EMAIL_PATTERN.test(fields.email.value.trim())) {
            valid = false;
            showFieldError(fields.email, 'Enter a valid email address (e.g., juan@example.com).');
        }

        if (!fields.password.value || fields.password.value.length < 8) {
            valid = false;
            showFieldError(fields.password, 'Password must be at least 8 characters long.');
        }

        if (!/\d/.test(fields.password.value) || !/[A-Z]/.test(fields.password.value) || !/[a-z]/.test(fields.password.value)) {
            valid = false;
            showFieldError(fields.password, 'Include uppercase, lowercase, and numeric characters.');
        }

        if (fields.password.value !== fields.confirmPassword.value) {
            valid = false;
            showFieldError(fields.confirmPassword, 'Passwords do not match.');
        }

        return valid;
    }

    function disableForm(state) {
        submitBtn.disabled = state;
        submitBtn.textContent = state ? 'Creating account...' : 'Create account';
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitBtn.disabled) return;

        if (!validate()) {
            setFeedback('danger', 'Please fix the highlighted fields before continuing.');
            return;
        }

        disableForm(true);
        setAuthLoading(true, 'Creating your SMART LEAP account...');

        try {
            const response = await fetch(routeUrl('signup'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    Accept: 'application/json',
                },
                credentials: 'same-origin',
                body: new URLSearchParams({
                    fullName: fields.fullName.value.trim(),
                    email: fields.email.value.trim(),
                    password: fields.password.value,
                }).toString(),
            });

            const payload = await response.json();
            if (!response.ok || !payload.ok) {
                const fieldMap = {
                    fullName: fields.fullName,
                    email: fields.email,
                    password: fields.password,
                };

                Object.entries(payload.errors || {}).forEach(([key, message]) => {
                    if (fieldMap[key]) {
                        showFieldError(fieldMap[key], message);
                    }
                });

                setFeedback('danger', payload.errors?.general || payload.message || 'We could not create your account right now.');
                return;
            }

            setFeedback('success', payload.message || 'Account created successfully. Redirecting to verification...');
            window.setTimeout(() => {
                window.location.href = routeUrl(payload.redirect || 'verify-account');
            }, 1200);
        } catch (error) {
            console.error('Signup failed', error);
            setFeedback('danger', 'We could not create your account right now. Please try again.');
        } finally {
            if (document.visibilityState !== 'hidden') {
                setAuthLoading(false);
            }
            disableForm(false);
        }
    });
})();

(function () {
    const form = document.getElementById('stageOneForm');
    if (!form) return;

    const fields = {
        firstName: document.getElementById('stageOneFirstName'),
        middleName: document.getElementById('stageOneMiddleName'),
        lastName: document.getElementById('stageOneLastName'),
        email: document.getElementById('stageOneEmail'),
        contactNumber: document.getElementById('stageOneContactNumber'),
        completeAddress: document.getElementById('stageOneCompleteAddress'),
        businessPhoto: document.getElementById('stageOneBusinessPhoto'),
        validIdPhoto: document.getElementById('stageOneValidIdPhoto'),
    };

    const feedback = document.getElementById('stageOneFeedback');
    const submitBtn = document.getElementById('stageOneSubmit');
    const successPanel = document.getElementById('stageOneSuccess');
    const successMessage = document.getElementById('stageOneSuccessMessage');
    const card = form.closest('.stage-one-card');
    const AUTH_LOADER_MIN_MS = 2400;
    let authLoaderStartedAt = 0;

    function autoResizeTextarea(textarea) {
        if (!textarea) return;
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
    }

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
        if (active) {
            authLoaderStartedAt = Date.now();
        }
        overlay.hidden = !active;
        document.body.classList.toggle('auth-loading', active);
    }

    async function settleLoader() {
        const elapsed = Date.now() - authLoaderStartedAt;
        const remaining = Math.max(0, AUTH_LOADER_MIN_MS - elapsed);
        if (remaining > 0) {
            await new Promise((resolve) => window.setTimeout(resolve, remaining));
        }
        setAuthLoading(false);
    }

    function resetErrors() {
        feedback.hidden = true;
        feedback.textContent = '';
        Object.values(fields).forEach((field) => {
            if (!field) return;
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

    function updateFileLabel(input, labelId) {
        const label = document.getElementById(labelId);
        if (!label) return;
        const file = input?.files?.[0];
        label.textContent = file ? file.name : 'No file selected.';
        label.classList.toggle('is-selected', Boolean(file));
    }

    function validate() {
        resetErrors();
        let valid = true;

        if (!fields.firstName.value.trim() || fields.firstName.value.trim().length < 2) {
            valid = false;
            showFieldError(fields.firstName, 'Enter your first name.');
        }
        if (!fields.lastName.value.trim() || fields.lastName.value.trim().length < 2) {
            valid = false;
            showFieldError(fields.lastName, 'Enter your last name.');
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.value.trim())) {
            valid = false;
            showFieldError(fields.email, 'Enter a valid email address.');
        }

        const digits = fields.contactNumber.value.replace(/\D+/g, '');
        if (digits.length < 10) {
            valid = false;
            showFieldError(fields.contactNumber, 'Enter a valid contact number.');
        }

        if (!fields.completeAddress.value.trim() || fields.completeAddress.value.trim().length < 12) {
            valid = false;
            showFieldError(fields.completeAddress, 'Enter your complete address.');
        }

        if (!fields.businessPhoto.files || !fields.businessPhoto.files.length) {
            valid = false;
            showFieldError(fields.businessPhoto, 'Upload a photo of your existing business.');
        }

        if (!fields.validIdPhoto.files || !fields.validIdPhoto.files.length) {
            valid = false;
            showFieldError(fields.validIdPhoto, 'Upload a photo or copy of your valid ID.');
        }

        return valid;
    }

    function disableForm(disabled) {
        submitBtn.disabled = disabled;
        submitBtn.textContent = disabled ? 'Submitting Registration...' : 'Submit Registration';
    }

    function resetFormView() {
        card?.classList.remove('is-complete');
        form.hidden = false;
        successPanel.hidden = true;
        form.reset();
        updateFileLabel(fields.businessPhoto, 'stageOneBusinessPhotoName');
        updateFileLabel(fields.validIdPhoto, 'stageOneValidIdPhotoName');
        resetErrors();
        disableForm(false);
    }

    fields.businessPhoto.addEventListener('change', () => updateFileLabel(fields.businessPhoto, 'stageOneBusinessPhotoName'));
    fields.validIdPhoto.addEventListener('change', () => updateFileLabel(fields.validIdPhoto, 'stageOneValidIdPhotoName'));
    fields.completeAddress?.addEventListener('input', () => autoResizeTextarea(fields.completeAddress));
    autoResizeTextarea(fields.completeAddress);

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (submitBtn.disabled) return;

        if (!validate()) {
            setFeedback('danger', 'Please complete the required registration fields.');
            return;
        }

        disableForm(true);
        setAuthLoading(true, 'Submitting your registration...');

        try {
            const formData = new FormData();
            formData.append('firstName', fields.firstName.value.trim());
            formData.append('middleName', fields.middleName.value.trim());
            formData.append('lastName', fields.lastName.value.trim());
            formData.append('email', fields.email.value.trim());
            formData.append('contactNumber', fields.contactNumber.value.trim());
            formData.append('completeAddress', fields.completeAddress.value.trim());
            formData.append('businessPhoto', fields.businessPhoto.files[0]);
            formData.append('validIdPhoto', fields.validIdPhoto.files[0]);

            const response = await fetch(routeUrl('portal/apply'), {
                method: 'POST',
                headers: { Accept: 'application/json' },
                credentials: 'same-origin',
                body: formData,
            });
            const payload = await response.json().catch(() => ({}));

            await settleLoader();

            if (!response.ok || !payload.ok) {
                const fieldMap = {
                    firstName: fields.firstName,
                    middleName: fields.middleName,
                    lastName: fields.lastName,
                    email: fields.email,
                    contactNumber: fields.contactNumber,
                    completeAddress: fields.completeAddress,
                    businessPhoto: fields.businessPhoto,
                    validIdPhoto: fields.validIdPhoto,
                };

                Object.entries(payload.errors || {}).forEach(([key, message]) => {
                    if (fieldMap[key]) {
                        showFieldError(fieldMap[key], message);
                    }
                });
                setFeedback('danger', payload.message || 'Unable to submit the registration right now.');
                disableForm(false);
                return;
            }

            disableForm(false);
            resetErrors();
            if (successMessage) {
                successMessage.textContent = payload.message || 'Watch your email for the next steps if you are selected for the next application stage.';
            }
            card?.classList.add('is-complete');
            form.hidden = true;
            successPanel.hidden = false;
            successPanel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (error) {
            await settleLoader();
            console.error('Stage 1 registration failed', error);
            setFeedback('danger', 'Unable to submit the registration right now.');
            disableForm(false);
        }
    });
})();

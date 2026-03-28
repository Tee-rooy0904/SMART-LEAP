(function () {
    const FIELD_OWNER_APPLICANT = 'applicant';
    const FIELD_OWNER_STAFF = 'staff';
    const state = {
        baseUrl: window.SMARTLEAP_BASE_URL || '',
        authUser: window.SMARTLEAP_AUTH_USER || null,
        taskCode: window.SMARTLEAP_POST_APPROVAL_CODE || '',
        task: null,
        activePayload: null,
        formErrors: {},
        renderMode: window.innerWidth >= 1024 ? 'desktop' : 'mobile',
    };
    const MUNGKAHING_SECTOR_DEFINITIONS = [
        { key: 'sexFemale', label: 'Babaye' },
        { key: 'sexMale', label: 'Lalake' },
        { key: 'seniorFemale', label: 'Senior Citizen - Babaye' },
        { key: 'seniorMale', label: 'Senior Citizen - Lalake' },
        { key: 'pwdFemale', label: 'PWD - Babaye' },
        { key: 'pwdMale', label: 'PWD - Lalake' },
        { key: 'ipFemale', label: 'IP - Babaye' },
        { key: 'ipMale', label: 'IP - Lalake' },
        { key: 'soloParentFemale', label: 'Solo Parent - Babaye' },
        { key: 'soloParentMale', label: 'Solo Parent - Lalake' },
    ];
    const MUNGKAHING_SECTOR_GROUPS = [
        { key: 'pantawid', label: 'Pantawid' },
        { key: 'nonPantawid', label: 'Non-Pantawid' },
    ];

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        bindStaticEvents();
        await loadTask();
    }

    function bindStaticEvents() {
        document.getElementById('logoutButton')?.addEventListener('click', handleLogout);
        document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebarMenu);
        document.getElementById('sidebarClose')?.addEventListener('click', closeSidebarMenuOnMobile);
        document.getElementById('sidebarOverlay')?.addEventListener('click', closeSidebarMenuOnMobile);
        document.getElementById('postApprovalSaveButton')?.addEventListener('click', handleSave);
        document.getElementById('postApprovalForm')?.addEventListener('submit', handleSubmit);
        document.getElementById('postApprovalFormSections')?.addEventListener('click', handleRowAction);
        document.getElementById('postApprovalFormSections')?.addEventListener('input', handleBusinessPlanMirrorInput);
        document.getElementById('postApprovalFormSections')?.addEventListener('change', handleApplicantUploadChange);
        document.getElementById('postApprovalFormSections')?.addEventListener('change', handleMungkahingMobileSectorChange);
        window.addEventListener('resize', handleWindowResize);
        document.addEventListener('keydown', handleGlobalKeydown);
        syncSidebarMenuState();
    }

    function handleBusinessPlanMirrorInput(event) {
        if (!['business_plan', 'buhat_sa_pagpanumpa'].includes(state.task?.code || '')) {
            return;
        }

        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement)) {
            return;
        }

        const name = target.getAttribute('name');
        if (!name) {
            return;
        }

        const formSections = document.getElementById('postApprovalFormSections');
        if (!formSections) {
            return;
        }

        const mirrors = Array.from(formSections.querySelectorAll(`[name="${cssEscape(name)}"]`));
        if (mirrors.length < 2) {
            return;
        }

        mirrors.forEach((field) => {
            if (field === target) {
                return;
            }
            if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
                field.value = target.value;
            }
        });
    }

    async function loadTask() {
        renderIdentity();

        if (!state.taskCode) {
            renderFatalState('No application form was selected.');
            return;
        }

        try {
            const payload = await fetchJson(`api/post-approval/task?code=${encodeURIComponent(state.taskCode)}`);
            if (!payload.ok) {
                throw new Error(payload.message || 'Unable to load this application form.');
            }

            state.task = payload.task || null;
            state.activePayload = structuredCloneSafe(state.task?.payload || {});
            state.formErrors = {};
            renderTask();
        } catch (error) {
            renderFatalState(error.message || 'Unable to load this application form.');
        }
    }

    function normalizeFieldReference(reference) {
        return String(reference || '').trim();
    }

    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') {
            return window.CSS.escape(String(value || ''));
        }
        return String(value || '').replace(/["\\]/g, '\\$&');
    }

    function resolveFieldOwnership(reference) {
        const fieldRef = normalizeFieldReference(reference);
        if (!fieldRef) {
            return { owner: FIELD_OWNER_APPLICANT, editable: true };
        }

        const staffUploadFields = new Set([
            'pageOneCertification.signatureUpload',
            'physicalRequirements.foodRelatedCertification.signatureUpload',
            'psychoSocialRequirements.residencyAndCharacter.signatureUpload',
            'psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.signatureUpload',
            'validatorIdentity.signatureUpload',
            'recommendation.signatureUpload',
            'approval.signatureUpload',
        ]);

        if (
            fieldRef.startsWith('staffReview.')
            || fieldRef.startsWith('pageOneCertification.')
            || fieldRef.startsWith('physicalRequirements.')
            || fieldRef.startsWith('psychoSocialRequirements.')
            || fieldRef.startsWith('validatorIdentity.')
            || fieldRef.startsWith('approval.')
            || fieldRef.startsWith('recommendation.')
            || staffUploadFields.has(fieldRef)
        ) {
            return { owner: FIELD_OWNER_STAFF, editable: false };
        }

        return { owner: FIELD_OWNER_APPLICANT, editable: true };
    }

    function ownershipBadge(owner) {
        return owner === FIELD_OWNER_STAFF
            ? '<small class="paper-field__ownership">For CSWDD staff only</small>'
            : '';
    }

    function buildFieldOwnershipAttributes(reference, disabled = false, forceApplicant = false) {
        const ownership = forceApplicant
            ? { owner: FIELD_OWNER_APPLICANT, editable: true }
            : resolveFieldOwnership(reference);
        const shouldDisable = disabled || !ownership.editable;
        return {
            owner: ownership.owner,
            disabled: shouldDisable,
            attrs: `data-field-owner="${escapeAttribute(ownership.owner)}" data-field-ref="${escapeAttribute(reference || '')}"`,
            note: ownershipBadge(ownership.owner),
        };
    }

    function resolveElementOwnership(element) {
        if (!(element instanceof HTMLElement)) {
            return { owner: FIELD_OWNER_APPLICANT, editable: true };
        }

        const explicitOwner = normalizeFieldReference(element.dataset.fieldOwner);
        if (explicitOwner === FIELD_OWNER_APPLICANT) {
            return { owner: FIELD_OWNER_APPLICANT, editable: true };
        }
        if (explicitOwner === FIELD_OWNER_STAFF) {
            return { owner: FIELD_OWNER_STAFF, editable: false };
        }

        const fieldRef = element.dataset.fieldRef || element.getAttribute('name') || element.dataset.uploadField || '';
        return resolveFieldOwnership(fieldRef);
    }

    function renderIdentity() {
        const authUser = state.authUser || {};
        const displayName = authUser.name || 'Applicant';
        const initial = (displayName.trim().charAt(0) || 'A').toUpperCase();

        setText('sidebarUserName', displayName);
        ['sidebarAvatar', 'bannerAvatar'].forEach((id) => {
            const node = document.getElementById(id);
            if (node) {
                node.textContent = initial;
            }
        });
    }

    function deriveApplicantName(payload = {}) {
        const authName = String(state.authUser?.name || '').trim();
        if (authName) {
            return authName;
        }

        const participantName = String(payload?.participantSignature?.signedName || '').trim();
        if (participantName) {
            return participantName;
        }

        const applicant = payload?.applicantDetails || {};
        const fullName = [
            applicant.firstName,
            applicant.middleName,
            applicant.lastName,
        ].filter((part) => String(part || '').trim() !== '').join(' ').trim();

        return fullName;
    }

    function renderTask() {
        const task = state.task;
        const title = document.getElementById('postApprovalWorkspaceTitle');
        const subtitle = document.getElementById('postApprovalWorkspaceSubtitle');
        const status = document.getElementById('postApprovalWorkspaceStatus');
        const notice = document.getElementById('postApprovalWorkspaceNotice');
        const form = document.getElementById('postApprovalForm');
        const sections = document.getElementById('postApprovalFormSections');
        const staffSections = document.getElementById('postApprovalStaffSections');
        const saveButton = document.getElementById('postApprovalSaveButton');
        const submitButton = document.getElementById('postApprovalSubmitButton');

        if (!task) {
            renderFatalState('This application form is unavailable.');
            return;
        }

        setText('formPageTitle', task.title);
        setText('formPageSubtitle', task.summary || task.helpText || 'Complete the required sections below.');
        setText('formPageStatus', task.status);
        setText('formPageCompletion', `${task.completion || 0}%`);
        setText('formPageReview', buildReviewState(task));
        document.body.dataset.renderMode = state.renderMode;
        renderFormGuidance(task);

        title && (title.textContent = task.title);
        subtitle && (subtitle.textContent = task.summary || task.helpText || '');
        status && (status.textContent = task.status);

        if (!task.interactive) {
            notice && (notice.textContent = task.helpText || 'This task is staged for a later digital form pass.');
            form?.classList.add('is-hidden');
            if (sections) sections.innerHTML = '';
            if (staffSections) staffSections.innerHTML = renderStaffSections(task.staffSections || [], task.reviewerRemarks);
            return;
        }

        notice && (notice.textContent = buildPostApprovalNotice(task));
        form?.classList.remove('is-hidden');
        if (sections) {
            sections.innerHTML = `${renderFormErrorSummary(state.formErrors, task.code)}${renderTaskSections(task.code, state.activePayload || task.payload || {})}`;
        }
        if (staffSections) {
            staffSections.innerHTML = renderStaffSections(task.staffSections || [], task.reviewerRemarks);
        }
        if (saveButton) {
            saveButton.disabled = !isTaskEditable(task);
        }
        if (submitButton) {
            submitButton.disabled = !isTaskEditable(task);
        }

        applyFormEditability(task);
        applyFieldErrors(state.formErrors);
    }

    function renderTaskSections(code, payload) {
        if (code === 'availment_form') {
            return state.renderMode === 'desktop'
                ? renderAvailmentDesktop(payload)
                : renderAvailmentMobile(payload);
        }

        if (code === 'mungkahing_proyekto') {
            return state.renderMode === 'desktop'
                ? renderMungkahingDesktopPaper(payload)
                : renderMungkahingMobile(payload);
        }

        if (code === 'buhat_sa_pagpanumpa') {
            return state.renderMode === 'desktop'
                ? renderBuhatSaPagpanumpaDesktop(payload)
                : renderBuhatSaPagpanumpaMobile(payload);
        }

        if (code === 'business_plan') {
            return state.renderMode === 'desktop'
                ? renderBusinessPlanDesktop(payload)
                : renderBusinessPlanMobile(payload);
        }

        if (code === 'fund_release_evidence') {
            return state.renderMode === 'desktop'
                ? renderFundReleaseEvidenceDesktop(payload)
                : renderFundReleaseEvidenceMobile(payload);
        }

        return state.renderMode === 'desktop'
            ? renderValidationDesktop(payload)
            : renderValidationMobile(payload);
    }

    function renderFormGuidance(task) {
        const guidance = buildFormGuidance(task);
        setText('formGuidanceSummary', guidance.summary);
        setText('formGuidanceStep', guidance.step);
        setText('formGuidanceTime', guidance.time);
        setText('formGuidancePrep', guidance.prepare);
    }

    function renderAvailmentMobile(payload) {
        const data = payload || {};
        const familyMembers = Array.isArray(data.familyEnterprise?.members) && data.familyEnterprise.members.length > 0
            ? data.familyEnterprise.members
            : [{ name: '', age: '', activities: '' }];
        const incomeRows = Array.isArray(data.incomeEligibility?.rows) && data.incomeEligibility.rows.length > 0
            ? data.incomeEligibility.rows
            : [{ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' }];

        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Client identifying data</h4>
                    <p>Applicant-entered details from the SMART LEAP Availment Form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Client name', 'clientIdentifyingData.name', data.clientIdentifyingData?.name || '', 'text')}
                    ${renderField('Age', 'clientIdentifyingData.age', data.clientIdentifyingData?.age || '', 'number')}
                    ${renderField('Address', 'clientIdentifyingData.address', data.clientIdentifyingData?.address || '', 'text', true)}
                    ${renderField('Name of spouse', 'clientIdentifyingData.spouseName', data.clientIdentifyingData?.spouseName || '', 'text')}
                    ${renderReadOnlyField('City', data.clientIdentifyingData?.city || 'Butuan City')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Type of project: Family Enterprise</h4>
                    <p>List all family members participating in the enterprise and what each one will do.</p>
                </div>
                <div class="post-approval-repeatable" data-repeatable="familyMembers">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">Family members participating</span>
                        <button type="button" class="btn-outline small" data-row-action="add-family">Add family member</button>
                    </div>
                    ${familyMembers.map((row, index) => renderFamilyMemberRow(row, index)).join('')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Type of project: Individual Assistance</h4>
                    <p>Capture the applicant-facing narrative fields from the paper form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Clientele category', 'individualAssistance.clienteleCategory', data.individualAssistance?.clienteleCategory || '', 'text')}
                    ${renderTextarea('Nature of difficult circumstances', 'individualAssistance.natureOfDifficultCircumstances', data.individualAssistance?.natureOfDifficultCircumstances || '', true, 'Describe the circumstance that supports the availment request.')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Income eligibility requirement</h4>
                    <p>Provide the working family members and their monthly income details.</p>
                </div>
                <div class="post-approval-repeatable" data-repeatable="incomeRows">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">Monthly income rows</span>
                        <button type="button" class="btn-outline small" data-row-action="add-income">Add income row</button>
                    </div>
                    ${incomeRows.map((row, index) => renderIncomeRow(row, index)).join('')}
                </div>
                <div class="post-approval-fields">
                    ${renderField('Total family income', 'incomeEligibility.totalFamilyIncome', data.incomeEligibility?.totalFamilyIncome || '', 'number')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Social responsibility and willingness to save</h4>
                    <p>This covers the client-side commitment statements from page 2 of the paper availment form. Signature lines remain excluded for now.</p>
                </div>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToPolicies" ${commitments.agreedToPolicies ? 'checked' : ''}>
                    <span>I agree to abide by the SMART LEAP policies and guidelines set by CSWDD.</span>
                </label>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToRollBackSchedule" ${agreedToRollBackSchedule ? 'checked' : ''}>
                    <span>I promise to pay the SMART LEAP roll-back on the time stipulated in the program.</span>
                </label>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToWeeklySavings" ${agreedToWeeklySavings ? 'checked' : ''}>
                    <span>I will generate weekly savings to prepare for emergencies that may affect my family.</span>
                </label>
                ${renderTextarea('Optional applicant note', 'clientCommitment.notes', data.clientCommitment?.notes || '', false, 'Add any clarifying note related to your availment commitment.')}
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Applicant e-signature</h4>
                    <p>Attach the participant signature used for the paper availment form. This will remain with your saved draft and submission.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Signer name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderField('Date signed', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Participant signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            </section>
        `;
    }

    function renderValidationMobile(payload) {
        const data = payload || {};
        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Applicant details</h4>
                    <p>Fill the applicant-side information block from the SMART LEAP Validation Form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Date of validation', 'applicantDetails.validationDate', data.applicantDetails?.validationDate || '', 'date')}
                    ${renderField('Last name', 'applicantDetails.lastName', data.applicantDetails?.lastName || '', 'text')}
                    ${renderField('First name', 'applicantDetails.firstName', data.applicantDetails?.firstName || '', 'text')}
                    ${renderField('Middle name', 'applicantDetails.middleName', data.applicantDetails?.middleName || '', 'text')}
                    ${renderField('Purok', 'applicantDetails.purok', data.applicantDetails?.purok || '', 'text')}
                    ${renderField('Barangay', 'applicantDetails.barangay', data.applicantDetails?.barangay || '', 'text')}
                    ${renderField('Birthdate', 'applicantDetails.birthdate', data.applicantDetails?.birthdate || '', 'date')}
                    ${renderField('Educational attainment', 'applicantDetails.educationalAttainment', data.applicantDetails?.educationalAttainment || '', 'text')}
                    ${renderField('Contact number', 'applicantDetails.contactNumber', data.applicantDetails?.contactNumber || '', 'text')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Checklist</h4>
                    <p>Answer the membership checklist items exactly as required by the paper form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderSelectField('Pantawid member', 'membershipChecklist.pantawidMember', data.membershipChecklist?.pantawidMember || '', ['', 'Yes', 'No'])}
                    ${renderField('Pantawid specify', 'membershipChecklist.pantawidSpecify', data.membershipChecklist?.pantawidSpecify || '', 'text')}
                    ${renderSelectField('SLPA member', 'membershipChecklist.slpaMember', data.membershipChecklist?.slpaMember || '', ['', 'Yes', 'No'])}
                    ${renderField('SLPA specify', 'membershipChecklist.slpaSpecify', data.membershipChecklist?.slpaSpecify || '', 'text')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Validator-only assessment on the paper form</h4>
                    <p>The recommendation, assistance-process assessment, ANGAYAN / DILI ANGAYAN decision, and validator identity fields remain reserved for staff review.</p>
                </div>
                <div class="post-approval-helperlist">
                    <article class="post-approval-staffcard">
                        <strong>Validator recommendation</strong>
                        <p>CSWDD staff will complete the recommendation block after reviewing your submitted validation form.</p>
                    </article>
                    <article class="post-approval-staffcard">
                        <strong>Eligibility assessment</strong>
                        <p>Staff will record the applicant’s understanding of the assistance process and the ANGAYAN / DILI ANGAYAN decision after review.</p>
                    </article>
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Participant e-signature</h4>
                    <p>Attach the participant signature used for the paper validation form. Validator signature remains staff-only.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Signer name', 'participantSignature.signedName', data.participantSignature?.signedName || '', 'text')}
                    ${renderField('Date signed', 'participantSignature.signedDate', data.participantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Participant signature upload', 'participantSignature.signatureUpload', data.participantSignature?.signatureUpload || null)}
                </div>
            </section>
        `;
    }

    function renderFundReleaseEvidenceDesktop(payload) {
        const data = payload?.fundReleaseEvidence || {};
        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Proof of Fund Release</h4>
                    <p>This is the final requirement. You stay under applicant status until CSWDD verifies an uploaded attachment that proves the fund was released.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Release date', 'fundReleaseEvidence.releaseDate', data.releaseDate || '', 'date')}
                    ${renderTextarea('Applicant note', 'fundReleaseEvidence.notes', data.notes || '', true, 'Optional note describing the release or the attached evidence.')}
                    ${renderUploadField('Proof of fund release attachment', 'fundReleaseEvidence.releaseAttachment', data.releaseAttachment || null)}
                </div>
            </section>
        `;
    }

    function renderFundReleaseEvidenceMobile(payload) {
        return renderFundReleaseEvidenceDesktop(payload);
    }

    function renderBusinessPlanDesktop(payload) {
        const data = payload || {};
        const overview = data.overview || {};
        const products = ensureRows(data.productsServices?.rows, { name: '', description: '', price: '', targetMarket: '' });
        const scheduleRows = ensureRows(data.implementationSchedule?.rows, { activity: '', targetDate: '', responsiblePerson: '' });
        const market = data.marketStrategy || {};
        const operations = data.operationsPlan || {};
        const financial = data.financialPlan || {};
        const risks = data.riskManagement || {};
        const approval = data.staffReview?.approval || {};

        return `
            <div class="paper-document paper-document--business-plan">
                ${renderBusinessPlanPaperPage(1, `
                    <header class="bp-title-page">
                        <h2>BUSINESS PLAN</h2>
                        <div class="bp-title-subhead">EXECUTIVE SUMMARY (BUSINESS DESCRIPTION)</div>
                    </header>
                    ${renderBusinessPlanPromptBlock('1.', 'Brief Description of the Business/Project', 'Brief Description of the Project (What is the nature of the project?)', `
                        ${renderBusinessPlanHiddenField('overview.businessName', overview.businessName || '')}
                        ${renderBusinessPlanNarrativeField('executiveSummary', data.executiveSummary || '', 8)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.', 'Brief Profile of the Entrepreneur', 'Brief Profile of the Entrepreneur (What are the entrepreneur’s skills and qualifications?)', `
                        ${renderBusinessPlanHiddenField('overview.ownerName', overview.ownerName || '')}
                        ${renderBusinessPlanHiddenField('overview.contactNumber', overview.contactNumber || '')}
                        ${renderBusinessPlanHiddenField('overview.businessAddress', overview.businessAddress || '')}
                        ${renderBusinessPlanNarrativeField('overview.businessGoal', overview.businessGoal || '', 7)}
                    `)}
                    ${renderBusinessPlanPromptBlock('3.', 'Contributions of the Project to the Economy', 'Contributions of the Project to the Economy (What are the contributions of the project to the local and national economy?)', `
                        ${renderBusinessPlanNarrativeField('riskManagement.mitigation', risks.mitigation || '', 7)}
                    `)}
                    <div class="bp-section-heading">Part 1: Marketing Plan</div>
                    ${renderBusinessPlanPromptBlock('1.1', 'Description of the Product', 'Description of the Product (What is the product?)', `
                        ${renderBusinessPlanProductsRows(products)}
                    `, 'is-product-block')}
                `)}
                ${renderBusinessPlanPaperPage(2, `
                    ${renderBusinessPlanPromptBlock('1.2', 'Comparison of the Product with its Competitors', 'Comparison of the Product with its Competitors (How does it compare in quality and price with its competitors?)', `
                        ${renderBusinessPlanNarrativeField('marketStrategy.competitors', market.competitors || '', 7)}
                    `)}
                    ${renderBusinessPlanPromptBlock('1.3', 'Location', 'Location (Where will the business be located?)', `
                        ${renderBusinessPlanNarrativeField('operationsPlan.businessLocation', operations.businessLocation || '', 6)}
                    `)}
                    ${renderBusinessPlanPromptBlock('1.4', 'Market Area', 'Market Area (What geographic areas will the project cover?)', `
                        ${renderBusinessPlanNarrativeField('marketStrategy.salesChannel', market.salesChannel || '', 6)}
                    `)}
                    ${renderBusinessPlanPromptBlock('1.5', 'Primary Customers', 'Primary Customers (Within the market area, to whom will the business sell its products?)', `
                        ${renderBusinessPlanNarrativeField('marketStrategy.customerProfile', market.customerProfile || '', 6)}
                    `)}
                    ${renderBusinessPlanPromptBlock('1.6', 'Total Demand', 'Total Demand (Can it be estimated how much of the product is currently being sold?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.monthlySalesProjection', financial.monthlySalesProjection || '', 4)}
                    `)}
                    ${renderBusinessPlanPromptBlock('1.7', 'Selling Price', 'Selling Price (What is the selling price of the product?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.projectedNetIncome', financial.projectedNetIncome || '', 4)}
                    `)}
                `)}
                ${renderBusinessPlanPaperPage(3, `
                    ${renderBusinessPlanPromptBlock('1.8', 'Promotional Measures', 'Promotional Measures (What promotional measures will be used in selling the product?)', `
                        ${renderBusinessPlanNarrativeField('marketStrategy.marketingApproach', market.marketingApproach || '', 7)}
                    `)}
                    ${renderBusinessPlanPromptBlock('1.9', 'Marketing Strategy', 'Marketing Strategy (What marketing strategy is needed to ensure that the sales forecasts are achieved?)', `
                        ${renderBusinessPlanNarrativeField('marketStrategy.salesChannel', market.salesChannel || '', 7)}
                    `)}
                    ${renderBusinessPlanPromptBlock('1.10', 'Marketing Budget', 'Marketing Budget (How much do you need to promote and distribute your product?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.monthlyExpenseProjection', financial.monthlyExpenseProjection || '', 4)}
                    `)}
                    <div class="bp-section-heading">Part 2: Production Plan</div>
                    ${renderBusinessPlanPromptBlock('2.1', 'Production / Service Process', 'Production / Service Process (What is the production or service process?)', `
                        ${renderBusinessPlanNarrativeField('operationsPlan.productionProcess', operations.productionProcess || '', 7)}
                    `)}
                `)}
                ${renderBusinessPlanPaperPage(4, `
                    ${renderBusinessPlanPromptBlock('2.2', 'Fixed Capital', 'What buildings and machinery (fixed assets) are needed and what are their costs?', `
                        ${renderBusinessPlanNarrativeField('operationsPlan.equipmentNeeded', operations.equipmentNeeded || '', 7)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.3', 'Life of Fixed Capital', 'Life of Fixed Capital (What is the useful life of the building and machinery?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.breakEvenNotes', financial.breakEvenNotes || '', 6)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.4', 'Sources of Equipment', 'Sources of Equipment (When and where will the machinery be obtained?)', `
                        ${renderBusinessPlanNarrativeField('operationsPlan.equipmentNeeded', operations.equipmentNeeded || '', 6)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.5', 'Planned Capacity', 'Planned Capacity (How much capacity will be used?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.breakEvenNotes', financial.breakEvenNotes || '', 6)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.6', 'Future Capacity', 'Future Capacity (What are the plans for using extra capacity?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.breakEvenNotes', financial.breakEvenNotes || '', 6)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.7', 'Raw Materials', 'How many raw materials are needed?', `
                        ${renderBusinessPlanNarrativeField('operationsPlan.productionProcess', operations.productionProcess || '', 5)}
                    `)}
                `)}
                ${renderBusinessPlanPaperPage(5, `
                    ${renderBusinessPlanPromptBlock('2.8', 'Cost of Raw Materials', 'Cost of Raw Materials (What is the cost of the raw materials?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.projectedNetIncome', financial.projectedNetIncome || '', 4)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.9', 'Availability of Raw Materials', 'Availability of Raw Materials (What are the sources of raw materials? Are they available the whole year?)', `
                        ${renderBusinessPlanNarrativeField('riskManagement.risks', risks.risks || '', 7)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.10', 'Labor', 'Labor (How many direct and indirect jobs are required and what skills are needed?)', `
                        ${renderBusinessPlanNarrativeField('operationsPlan.staffingPlan', operations.staffingPlan || '', 7)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.11', 'Cost of Labor', 'Cost of Labor (What is the cost of labor?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.monthlyExpenseProjection', financial.monthlyExpenseProjection || '', 4)}
                    `)}
                    ${renderBusinessPlanPromptBlock('2.12', 'Availability of Labor', 'Availability of Labor (Are the workers available the whole year? If not, what is the effect on production?)', `
                        ${renderBusinessPlanNarrativeField('operationsPlan.staffingPlan', operations.staffingPlan || '', 6)}
                    `)}
                    <div class="bp-section-heading">Part 3: Organization and Management Plan</div>
                    ${renderBusinessPlanPromptBlock('3.1', 'Pre-operating Activities', 'Pre-operating Activities (What pre-operating activities need to be done before the business starts operating?)', `
                        ${renderBusinessPlanScheduleRows(scheduleRows)}
                    `)}
                `)}
                ${renderBusinessPlanPaperPage(6, `
                    ${renderBusinessPlanPromptBlock('3.2', 'Pre-operating Costs', 'Pre-operating Costs (What expenses will be incurred before operations begin?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.monthlyExpenseProjection', financial.monthlyExpenseProjection || '', 5)}
                    `)}
                    <div class="bp-section-heading">Part 4: Financial Plan</div>
                    ${renderBusinessPlanPromptBlock('4.1', 'Project Cost', 'Project Cost (What is the total capital requirement?)', `
                        ${renderBusinessPlanNarrativeField('financialPlan.startupCapital', financial.startupCapital || '', 5)}
                    `)}
                    <section class="bp-signoff">
                        <div class="bp-signoff-row">
                            <div class="bp-signoff-label">Giandam ni:</div>
                            <div class="bp-signoff-body">
                                ${renderBusinessPlanLineOnlyField('applicantSignature.signedName', data.applicantSignature?.signedName || '', 'bp-sign-line')}
                                <div class="bp-sign-caption">(Name sa Benes)</div>
                                ${renderBusinessPlanInlineField('Petsa sa pirma', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date', 'bp-line--short')}
                                ${renderBusinessPlanUploadInline('I-upload ang pirma sa aplikante', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                            </div>
                        </div>
                        <div class="bp-signoff-row bp-signoff-row--staff">
                            <div class="bp-signoff-label">Gisusi ni:</div>
                            <div class="bp-signoff-body">
                                ${renderBusinessPlanLineOnlyField('staffReview.approval.approverName', approval.approverName || '', 'bp-sign-line', true)}
                                <div class="bp-sign-caption">(Kamo)</div>
                                ${renderBusinessPlanUploadInline('I-upload ang pirma sa reviewer', 'approval.signatureUpload', approval.signatureUpload || null, true)}
                            </div>
                        </div>
                        <div class="bp-signoff-row bp-signoff-row--staff">
                            <div class="bp-signoff-label">Namatikdan ni:</div>
                            <div class="bp-signoff-body bp-signoff-body--noted">
                                <div class="bp-noted-fixed">GOLDA V. POCON, RSW, MSSW, CESE<br>CGHD-II/CSWDO</div>
                                ${renderBusinessPlanNotedSignatureSlot(approval.signatureUpload || null)}
                                ${approval.reviewSummary ? `<div class="bp-review-note"><strong>Sumaryo sa review:</strong> ${escapeHtml(approval.reviewSummary)}</div>` : ''}
                                ${approval.recommendedAction ? `<div class="bp-review-note"><strong>Girekomendang aksyon:</strong> ${escapeHtml(approval.recommendedAction)}</div>` : ''}
                            </div>
                        </div>
                    </section>
                `)}
            </div>
        `;
    }

    function renderBusinessPlanPaperPage(pageNumber, content) {
        return `
            <section class="paper-sheet paper-sheet--business-plan bp-page bp-page--${pageNumber}">
                ${content}
                <div class="bp-page-number">Page ${pageNumber} of 6</div>
            </section>
        `;
    }

    function renderBusinessPlanPromptBlock(number, title, subtitle, body, extraClass = '') {
        return `
            <section class="bp-prompt ${escapeAttribute(extraClass)}">
                <div class="bp-prompt__title">${escapeHtml(number)} ${escapeHtml(title)}</div>
                <div class="bp-prompt__subtitle">${escapeHtml(subtitle)}</div>
                <div class="bp-prompt__body">${body}</div>
            </section>
        `;
    }

    function renderBusinessPlanInlineField(label, name, value, type = 'text', className = '', disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="bp-inline ${escapeAttribute(className)}">
                <span class="bp-inline__label">${escapeHtml(label)}</span>
                ${ownership.note}
                <input class="bp-inline__input ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="${escapeAttribute(type || 'text')}" name="${escapeAttribute(name)}" value="${escapeAttribute(value ?? '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
            </label>
        `;
    }

    function renderBusinessPlanLineOnlyField(name, value, className = '', disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            ${ownership.note}
            <input class="bp-inline__input bp-inline__input--lineonly ${escapeAttribute(className)} ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="text" name="${escapeAttribute(name)}" value="${escapeAttribute(value ?? '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
        `;
    }

    function renderBusinessPlanHiddenField(name, value) {
        const ownership = buildFieldOwnershipAttributes(name, false);
        return `<input type="hidden" name="${escapeAttribute(name)}" value="${escapeAttribute(value ?? '')}" ${ownership.attrs}>`;
    }

    function renderBusinessPlanNarrativeField(name, value, rows = 7, disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <div class="bp-textarea-wrap">
                ${ownership.note}
                <textarea class="bp-textarea ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" name="${escapeAttribute(name)}" rows="${escapeAttribute(rows)}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>${escapeHtml(value ?? '')}</textarea>
            </div>
        `;
    }

    function renderBusinessPlanProductsRows(rows) {
        const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
        return `
            <div class="bp-essay-wrap" data-error-group="productsServices.rows">
                <div class="bp-required-note">At least one product or service description with real content is required to submit the Business Plan.</div>
                ${renderBusinessPlanNarrativeField('productsServices.rows.0.description', firstRow.description || '', 8)}
            </div>
        `;
    }

    function renderBusinessPlanScheduleRows(rows) {
        const firstRow = Array.isArray(rows) && rows.length > 0 ? rows[0] : {};
        return `
            <div class="bp-essay-wrap" data-error-group="implementationSchedule.rows">
                <div class="bp-required-note">At least one pre-operating activity with real content is required to submit the Business Plan.</div>
                ${renderBusinessPlanNarrativeField('implementationSchedule.rows.0.activity', firstRow.activity || '', 7)}
            </div>
        `;
    }

    function renderBusinessPlanUploadInline(label, fieldKey, metadata, disabled = false) {
        const ownership = buildFieldOwnershipAttributes(fieldKey, disabled);
        const fileName = metadata?.original_name || '';
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        return `
            <div class="bp-upload-inline">
                ${ownership.note}
                <label class="bp-upload-inline__label ${ownership.disabled ? 'is-disabled' : ''}">
                    <input type="file" class="upload-input" data-upload-field="${escapeAttribute(fieldKey)}" ${ownership.attrs} accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${ownership.disabled ? 'disabled' : ''}>
                    <span>${fileName ? 'Ilisi ang na-upload nga file' : (ownership.owner === FIELD_OWNER_STAFF ? 'Alang sa kawani sa CSWDD lamang' : escapeHtml(label))}</span>
                </label>
                ${fileUrl ? `<a class="upload-link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">Tan-awa ang na-upload nga file</a>` : ''}
            </div>
        `;
    }

    function renderBusinessPlanNotedSignatureSlot(metadata) {
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        const fileName = metadata?.original_name || '';
        return `
            <div class="bp-upload-inline bp-upload-inline--noted">
                <div class="bp-sign-caption">Pirma sa Noted by</div>
                <div class="bp-signature-slot ${fileUrl ? 'has-file' : ''}">
                    ${fileUrl
                        ? `<a class="upload-link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">${escapeHtml(fileName || 'Tan-awa ang na-upload nga pirma')}</a>`
                        : '<span>Alang sa upload sa application review</span>'}
                </div>
            </div>
        `;
    }

    function renderBusinessPlanMobile(payload) {
        const data = payload || {};
        const overview = data.overview || {};
        const products = ensureRows(data.productsServices?.rows, { name: '', description: '', price: '', targetMarket: '' });
        const scheduleRows = ensureRows(data.implementationSchedule?.rows, { activity: '', targetDate: '', responsiblePerson: '' });
        const market = data.marketStrategy || {};
        const operations = data.operationsPlan || {};
        const financial = data.financialPlan || {};
        const risks = data.riskManagement || {};

        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Business Plan</h4>
                    <p>Mobile version of the paper business plan using the same saved data.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderBusinessPlanHiddenField('overview.businessName', overview.businessName || '')}
                    ${renderBusinessPlanHiddenField('overview.ownerName', overview.ownerName || '')}
                    ${renderBusinessPlanHiddenField('overview.contactNumber', overview.contactNumber || '')}
                    ${renderBusinessPlanHiddenField('overview.businessAddress', overview.businessAddress || '')}
                    ${renderTextarea('1. Brief Description of the Business/Project', 'executiveSummary', data.executiveSummary || '', true, 'Brief Description of the Project (What is the nature of the project?)')}
                    ${renderTextarea('2. Brief Profile of the Entrepreneur', 'overview.businessGoal', overview.businessGoal || '', true, 'Brief Profile of the Entrepreneur (What are the entrepreneur’s skills and qualifications?)')}
                    ${renderTextarea('3. Contributions of the Project to the Economy', 'riskManagement.mitigation', risks.mitigation || '', true, 'Contributions of the Project to the Economy')}
                </div>
            </section>
            <section class="post-approval-section post-approval-section--mungkahing" data-error-group="productsServices.rows">
                <div class="post-approval-section__header">
                    <h4>1.1 Description of the Product</h4>
                    <p>Description of the Product (What is the product?)</p>
                    <small class="post-approval-repeatable__hint">At least one product or service description with real content is required.</small>
                </div>
                <div class="post-approval-fields">
                    ${renderTextarea('1.1 Description of the Product', 'productsServices.rows.0.description', products[0]?.description || '', true)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header"><h4>Part 1: Marketing Plan</h4><p>Reordered for mobile while keeping the paper prompt sequence.</p></div>
                <div class="post-approval-fields">
                    ${renderTextarea('1.2 Comparison of the Product with its Competitors', 'marketStrategy.competitors', market.competitors || '', true)}
                    ${renderTextarea('1.3 Location', 'operationsPlan.businessLocation', operations.businessLocation || '', true)}
                    ${renderTextarea('1.4 Market Area', 'marketStrategy.salesChannel', market.salesChannel || '', true)}
                    ${renderTextarea('1.5 Primary Customers', 'marketStrategy.customerProfile', market.customerProfile || '', true)}
                    ${renderTextarea('1.6 Total Demand', 'financialPlan.monthlySalesProjection', financial.monthlySalesProjection || '', true)}
                    ${renderTextarea('1.7 Selling Price', 'financialPlan.projectedNetIncome', financial.projectedNetIncome || '', true)}
                    ${renderTextarea('1.8 Promotional Measures', 'marketStrategy.marketingApproach', market.marketingApproach || '', true)}
                    ${renderTextarea('1.9 Marketing Strategy', 'marketStrategy.salesChannel', market.salesChannel || '', true)}
                    ${renderTextarea('1.10 Marketing Budget', 'financialPlan.monthlyExpenseProjection', financial.monthlyExpenseProjection || '', true)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header"><h4>Part 2: Production Plan</h4><p>Prompts covering production, capacity, materials, and labor.</p></div>
                <div class="post-approval-fields">
                    ${renderTextarea('2.1 Production / Service Process', 'operationsPlan.productionProcess', operations.productionProcess || '', true)}
                    ${renderTextarea('2.2 Fixed Capital', 'operationsPlan.equipmentNeeded', operations.equipmentNeeded || '', true)}
                    ${renderTextarea('2.3 Life of Fixed Capital', 'financialPlan.breakEvenNotes', financial.breakEvenNotes || '', true)}
                    ${renderTextarea('2.4 Sources of Equipment', 'operationsPlan.equipmentNeeded', operations.equipmentNeeded || '', true)}
                    ${renderTextarea('2.5 Planned Capacity', 'financialPlan.breakEvenNotes', financial.breakEvenNotes || '', true)}
                    ${renderTextarea('2.6 Future Capacity', 'financialPlan.breakEvenNotes', financial.breakEvenNotes || '', true)}
                    ${renderTextarea('2.7 Raw Materials', 'operationsPlan.productionProcess', operations.productionProcess || '', true)}
                    ${renderTextarea('2.8 Cost of Raw Materials', 'financialPlan.projectedNetIncome', financial.projectedNetIncome || '', true)}
                    ${renderTextarea('2.9 Availability of Raw Materials', 'riskManagement.risks', risks.risks || '', true)}
                    ${renderTextarea('2.10 Labor', 'operationsPlan.staffingPlan', operations.staffingPlan || '', true)}
                    ${renderTextarea('2.11 Cost of Labor', 'financialPlan.monthlyExpenseProjection', financial.monthlyExpenseProjection || '', true)}
                    ${renderTextarea('2.12 Availability of Labor', 'operationsPlan.staffingPlan', operations.staffingPlan || '', true)}
                </div>
            </section>
            <section class="post-approval-section post-approval-section--mungkahing" data-error-group="implementationSchedule.rows">
                <div class="post-approval-section__header">
                    <h4>3.1 Pre-operating Activities</h4>
                    <p>What pre-operating activities are required before the business can operate?</p>
                    <small class="post-approval-repeatable__hint">At least one pre-operating activity with real content is required.</small>
                </div>
                <div class="post-approval-fields">
                    ${renderTextarea('3.1 Pre-operating Activities', 'implementationSchedule.rows.0.activity', scheduleRows[0]?.activity || '', true)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header"><h4>Part 3: Organization and Management Plan</h4><p>Pre-operating activities and expenses.</p></div>
                <div class="post-approval-fields">
                    ${renderTextarea('3.2 Pre-operating Costs', 'financialPlan.monthlyExpenseProjection', financial.monthlyExpenseProjection || '', true)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header"><h4>Part 4: Financial Plan</h4><p>Final capital requirement and applicant signature.</p></div>
                <div class="post-approval-fields">
                    ${renderTextarea('4.1 Project Cost', 'financialPlan.startupCapital', financial.startupCapital || '', true)}
                    ${renderField('Ngalan sa mipirma', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderField('Petsa sa pirma', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('I-upload ang pirma sa aplikante', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            </section>
        `;
    }

    function renderBusinessPlanMobileRowsSection(title, description, rows, addAction, rowRenderer) {
        const errorGroup = addAction === 'add-bp-product'
            ? 'productsServices.rows'
            : (addAction === 'add-bp-schedule' ? 'implementationSchedule.rows' : '');
        const hint = addAction === 'add-bp-product'
            ? 'At least one row must contain actual content.'
            : (addAction === 'add-bp-schedule' ? 'At least one activity row must contain actual content.' : '');
        return `
            <section class="post-approval-section post-approval-section--mungkahing" ${errorGroup ? `data-error-group="${escapeAttribute(errorGroup)}"` : ''}>
                <div class="post-approval-section__header">
                    <h4>${escapeHtml(title)}</h4>
                    <p>${escapeHtml(description)}</p>
                    ${hint ? `<small class="post-approval-repeatable__hint">${escapeHtml(hint)}</small>` : ''}
                </div>
                <div class="post-approval-repeatable">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">${escapeHtml(title)}</span>
                        <button type="button" class="btn-outline small" data-row-action="${escapeAttribute(addAction)}">Add row</button>
                    </div>
                    ${rows.map((row, index) => rowRenderer(row, index)).join('')}
                </div>
            </section>
        `;
    }

    function renderBusinessPlanProductRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Produkto / Serbisyo', `productsServices.rows.${index}.name`, row.name || '', 'text')}
            ${renderField('Deskripsyon', `productsServices.rows.${index}.description`, row.description || '', 'text')}
            ${renderField('Presyo', `productsServices.rows.${index}.price`, row.price || '', 'number')}
            ${renderField('Target nga merkado', `productsServices.rows.${index}.targetMarket`, row.targetMarket || '', 'text')}
        `, 'remove-bp-product', index, 'Produkto');
    }

    function renderBusinessPlanScheduleRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Kalihokan', `implementationSchedule.rows.${index}.activity`, row.activity || '', 'text')}
            ${renderField('Target nga petsa', `implementationSchedule.rows.${index}.targetDate`, row.targetDate || '', 'date')}
            ${renderField('Responsableng tawo', `implementationSchedule.rows.${index}.responsiblePerson`, row.responsiblePerson || '', 'text')}
        `, 'remove-bp-schedule', index, 'Iskedyul');
    }

    function renderBuhatSaPagpanumpaDesktop(payload) {
        const data = payload || {};
        const beneficiary = data.beneficiary || {};
        const project = data.project || {};
        const coMaker = data.coMaker || {};
        const agreement = data.agreement || {};
        const applicantSignature = data.applicantSignature || {};
        const coMakerSignature = data.coMakerSignature || {};

        return `
            <div class="paper-document paper-document--buhat">
                <section class="paper-sheet paper-sheet--buhat">
                    <header class="buhat-paper__header">
                        <div class="buhat-paper__top">
                            <img src="${escapeAttribute(mungkahingAssetUrl('city-of-butuan-logo.png'))}" alt="City of Butuan Official Seal" class="buhat-paper__logo buhat-paper__logo--left">
                            <div class="buhat-paper__copy">
                                <div class="small">Republic of the Philippines</div>
                                <div class="big">CITY GOVERNMENT OF BUTUAN</div>
                                <div class="dept">City Social Welfare and Development Department</div>
                                <div class="addr">J.P. Rosales Ave., Tandang Sora, Butuan City</div>
                                <div class="bar"></div>
                            </div>
                            <img src="${escapeAttribute(mungkahingAssetUrl('dswd-logo.png'))}" alt="CSWDD Logo" class="buhat-paper__logo buhat-paper__logo--right">
                        </div>
                        <div class="buhat-paper__title">BUHAT SA PAGPANUMPA</div>
                    </header>
                    <div class="buhat-paper__body">
                        <p class="buhat-paper__paragraph">
                            Ako si
                            ${renderBuhatPaperInlineField('beneficiary.fullName', beneficiary.fullName || '', 'xl')}
                            <span class="buhat-paper__literal">naa sa saktong edad, Pilipino, ug nagpuyo sa</span>
                            ${renderBuhatPaperInlineField('beneficiary.addressLine', beneficiary.addressLine || '', 'lg')}
                            <span class="buhat-paper__literal">,</span>
                            ${renderBuhatPaperInlineField('beneficiary.barangay', beneficiary.barangay || '', 'md')}
                            <span class="buhat-paper__literal">,</span>
                            ${renderBuhatPaperInlineField('beneficiary.city', beneficiary.city || '', 'md')}
                            <span class="buhat-paper__literal">pagkahuman ug panumpa sumala sa balaod, misaysay sa pagtuman niining mga sumusunod:</span>
                        </p>

                        <ol class="buhat-paper__clauses">
                            <li>
                                Ako usa ka benepisyaryo sa
                                ${renderBuhatPaperInlineField('project.programName', project.programName || '', 'lg')}
                                Program;
                            </li>
                            <li>
                                Tungod sa
                                ${renderBuhatPaperInlineField('project.projectName', project.projectName || '', 'lg')}
                                Program, ako makadawat ug kantidad nga
                                <span class="buhat-paper__literal">(Php</span>
                                ${renderBuhatPaperInlineField('project.amountReceived', project.amountReceived || '', 'md')}
                                <span class="buhat-paper__literal">)</span>
                                ug ako kining gamiton sa saktong katuyuan base sa mga dokumento nga akong gisumitar didto sa ahensya;
                            </li>
                            <li>Nga ako andam mo sumite o mohatag sa CSWDD sa mga resibo (Official Receipt or Acknowledgement Receipt) sa akong tanan napalit nga gamit o kahimanan, produkto usa ka semana human nako madawat ang Livelihood Assistance.</li>
                            <li>Nga ang mga resibo sa akong mga pinalit nga akong isumiti o ihatag sa CSWDD kinahanglan hinlo og walay pinapaan.</li>
                            <li>Nga ako usab nag saad nga moatubang kanunay sa LTWG, Monitoring Team sa CSWDD og uban pang mga grupo sa gobyerno sa panahon nga sila mag pahigayon og monitoring o mangumusta kanako kabahin sa akong Negosyo.</li>
                            <li>Nga ako nag saad sa angay o hustong pagdumala sa akong panginabuhian nga gihatag kanako sa CSWDD.</li>
                            <li>
                                Nga kung kini nga kasabutan og dili nako matuman tungod sa mga musunod na buhat sama sa;
                                <ul class="buhat-paper__subclauses">
                                    <li>Pagsugal, pag-inom ug uban pang bisyo</li>
                                    <li>Pag-invest sa pyramiding scheme</li>
                                    <li>Pagpalit ug gadgets nga dili kinahanglanon sa negosyo,</li>
                                    <li>Pagpa-utang</li>
                                    <li>Uban pang mga butang nga wala nakalatid ug nakabutang sa akong mungkahing proyekto.</li>
                                </ul>
                            </li>
                            <li>
                                Sa kantidad nga nadawat ni
                                ${renderBuhatPaperInlineField('beneficiary.fullName', beneficiary.fullName || '', 'lg')}
                                ako si
                                ${renderBuhatPaperInlineField('coMaker.fullName', coMaker.fullName || '', 'lg')}
                                <span class="buhat-paper__literal">naa sa saktong edad, Pilipino, ug nagpuyo sa</span>
                                ${renderBuhatPaperInlineField('coMaker.addressLine', coMaker.addressLine || '', 'md')}
                                <span class="buhat-paper__literal">,</span>
                                ${renderBuhatPaperInlineField('coMaker.barangay', coMaker.barangay || '', 'sm')}
                                <span class="buhat-paper__literal">,</span>
                                ${renderBuhatPaperInlineField('coMaker.city', coMaker.city || '', 'sm')}
                                <span class="buhat-paper__literal">nagsaad na mahimong responsable JOINTLY AND SEVERALLY sa pag-uli o pagbayad sa kantidad nga nadawat sulod sa bente kwatro (24) ka bulan kung si</span>
                                ${renderBuhatPaperInlineField('beneficiary.fullName', beneficiary.fullName || '', 'md')}
                                <span class="buhat-paper__literal">dili makatuman sa iyang gi komitar sa ahensiya or mobuhat ug mga buluhaton nga lista sa taas.</span>
                            </li>
                        </ol>

                        <p class="buhat-paper__paragraph">
                            Ako andam modawat og mosunod sa mga lakang nga ipahigayon ug ihatag kanako sa maong ahensya sama sa mosunod nga;
                        </p>
                        <ol class="buhat-paper__clauses buhat-paper__clauses--lettered" type="a">
                            <li>Counselling</li>
                            <li>Pag uli sa ayudang nadawat nga nagkantidad ug Fifteen Thousand Pesos (P15,000.00) sulod sa bente kwatro (24) ka bulan pinaagi sa monthly nga pagbayad nagkantidad ug Six Hundred Twenty-five Pesos (P625.00)</li>
                            <li>Ang dili pagtuman sa sumusunod nga lakang mamahimong hinungdan sa pagka blacklist sa mosunod nga susamang ayuda.</li>
                        </ol>

                        <p class="buhat-paper__paragraph">
                            Isip sa pagmatuod sa akong pag-uyon og kumpletong pagsabot niining maong kasabutan, ako kining paga pirmahan ibabaw sa akong pangalan karong adlawa
                            ${renderBuhatPaperInlineField('agreement.dateSigned', agreement.dateSigned || '', 'md')}
                            ,
                            ${renderBuhatPaperInlineField('agreement.yearSigned', agreement.yearSigned || '', 'xs')}
                            <span class="buhat-paper__literal">.</span>
                        </p>

                        <section class="buhat-paper__signatures">
                            <div class="buhat-paper__signature-col">
                                <div class="buhat-paper__signature-head">Prepared by:</div>
                                ${renderBuhatPaperSignatureBlock(
                                    'applicantSignature.signedName',
                                    applicantSignature.signedName || '',
                                    'applicantSignature.signatureUpload',
                                    applicantSignature.signatureUpload || null,
                                    'Name and Signature of Beneficiary'
                                )}
                            </div>
                            <div class="buhat-paper__signature-col">
                                <div class="buhat-paper__signature-head">Co-maker:</div>
                                ${renderBuhatPaperSignatureBlock(
                                    'coMakerSignature.signedName',
                                    coMakerSignature.signedName || '',
                                    'coMakerSignature.signatureUpload',
                                    coMakerSignature.signatureUpload || null,
                                    'Name and Signature of Co-maker'
                                )}
                            </div>
                        </section>

                    </div>
                    <footer class="buhat-paper__footer">
                        <div class="buhat-paper__footer-left">
                            <div><strong>Phone:</strong> &nbsp; +639562241679 / +639816016317</div>
                            <div><strong>Email:</strong> &nbsp; cswdobutuan@gmail.com</div>
                            <div><strong>Website:</strong> &nbsp; http://www.butuan.gov.ph</div>
                        </div>
                        <div class="buhat-paper__footer-right">
                            <img src="${escapeAttribute(mungkahingAssetUrl('butuanon-logo.png'))}" alt="ButuanON logo">
                            <small>CSWDO.DPSD.F.59 REV01</small>
                        </div>
                    </footer>
                </section>
            </div>
        `;
    }

    function renderBuhatSaPagpanumpaMobile(payload) {
        const data = payload || {};
        const beneficiary = data.beneficiary || {};
        const project = data.project || {};
        const coMaker = data.coMaker || {};
        const agreement = data.agreement || {};
        const verification = data.staffReview?.verification || {};

        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Buhat sa Pagpanumpa</h4>
                    <p>Mobile nga bersyon sa kasulatan sa panumpa gamit ang parehas nga nasave nga datos sa desktop.</p>
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Impormasyon sa benepisyaryo</h4>
                    <p>Pun-a ang mga detalye nga gigamit sa pangunang linya sa kasulatan.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Tibuok nga ngalan', 'beneficiary.fullName', beneficiary.fullName || '', 'text')}
                    ${renderField('Edad', 'beneficiary.age', beneficiary.age || '', 'number')}
                    ${renderField('Address line', 'beneficiary.addressLine', beneficiary.addressLine || '', 'text', true)}
                    ${renderField('Barangay', 'beneficiary.barangay', beneficiary.barangay || '', 'text')}
                    ${renderField('Dakbayan', 'beneficiary.city', beneficiary.city || '', 'text')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Programa ug proyekto</h4>
                    <p>Mga detalye sa programa, proyekto, ug kantidad nga nadawat.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Ngalan sa programa', 'project.programName', project.programName || '', 'text')}
                    ${renderField('Ngalan sa proyekto', 'project.projectName', project.projectName || '', 'text', true)}
                    ${renderField('Kantidad nga nadawat', 'project.amountReceived', project.amountReceived || '', 'number')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Impormasyon sa co-maker</h4>
                    <p>Mga detalye sa tawo nga mopirma isip co-maker sa kasabutan.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Tibuok nga ngalan', 'coMaker.fullName', coMaker.fullName || '', 'text')}
                    ${renderField('Address line', 'coMaker.addressLine', coMaker.addressLine || '', 'text', true)}
                    ${renderField('Barangay', 'coMaker.barangay', coMaker.barangay || '', 'text')}
                    ${renderField('Dakbayan', 'coMaker.city', coMaker.city || '', 'text')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Petsa sa kasabutan</h4>
                    <p>Ibutang ang petsa sa pagpirma ug ang tuig nga isulat sa panumpa.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Petsa sa pagpirma', 'agreement.dateSigned', agreement.dateSigned || '', 'date')}
                    ${renderField('Tuig', 'agreement.yearSigned', agreement.yearSigned || '', 'number')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Pirma sa benepisyaryo</h4>
                    <p>Ibutang ang ngalan sa mipirma ug i-upload ang pirma sa benepisyaryo.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Ngalan sa mipirma', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderUploadField('I-upload ang pirma sa benepisyaryo', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Pirma sa co-maker</h4>
                    <p>Ibutang ang ngalan sa co-maker ug i-upload ang pirma alang sa kasabutan.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Ngalan sa mipirma', 'coMakerSignature.signedName', data.coMakerSignature?.signedName || '', 'text')}
                    ${renderUploadField('I-upload ang pirma sa co-maker', 'coMakerSignature.signatureUpload', data.coMakerSignature?.signatureUpload || null)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Verification sa CSWDD staff</h4>
                    <p>Kining bahina para lamang sa reviewer sa CSWDD ug dili editable sa aplikante.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Reviewer name', 'staffReview.verification.reviewerName', verification.reviewerName || '', 'text', false, true)}
                    ${renderField('Reviewer title', 'staffReview.verification.reviewerTitle', verification.reviewerTitle || '', 'text', false, true)}
                    ${renderField('Reviewer date', 'staffReview.verification.reviewerDate', verification.reviewerDate || '', 'date', false, true)}
                    ${renderTextarea('Remarks', 'staffReview.verification.remarks', verification.remarks || '', true, '', true)}
                </div>
            </section>
        `;
    }

    function renderBuhatPaperInlineField(name, value, size = 'md', type = 'text', disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `<input class="buhat-paper__inline buhat-paper__inline--${escapeAttribute(size)} ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="${escapeAttribute(type)}" name="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>`;
    }

    function renderBuhatPaperSignatureBlock(nameKey, nameValue, uploadField, metadata, caption) {
        const ownership = buildFieldOwnershipAttributes(nameKey, false);
        const fileName = metadata?.original_name || '';
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';

        return `
            <div class="buhat-paper__signature-block">
                <div class="buhat-paper__signature-upload">
                    <label class="buhat-paper__upload-btn">
                        <input type="file" class="upload-input" data-upload-field="${escapeAttribute(uploadField)}" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf">
                        <span>${fileName ? 'Ilisi ang pirma' : 'Upload pirma'}</span>
                    </label>
                    ${fileUrl ? `<a class="upload-link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">Tan-awa ang na-upload nga file</a>` : ''}
                </div>
                <input class="buhat-paper__signature-name ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="text" name="${escapeAttribute(nameKey)}" value="${escapeAttribute(nameValue || '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
                <div class="buhat-paper__signature-caption">${escapeHtml(caption)}</div>
            </div>
        `;
    }

    function renderMungkahingDesktop(payload) {
        const data = payload || {};
        const project = data.projectInformation || {};
        const sectoral = data.sectoralClassification || {};
        const pantawid = sectoral.pantawid || {};
        const nonPantawid = sectoral.nonPantawid || {};
        const modalityRows = ensureRows(data.modalityApplications?.rows, { fundSource: '', contributionType: '', amount: '' });
        const materialsRows = ensureRows(data.businessOperation?.materials?.rows, { material: '', quality: '', unit: '', unitPrice: '', cyclesPerProduction: '', projectedCost: '' });
        const laborRows = ensureRows(data.businessOperation?.labor?.rows, { workerName: '', position: '', dailyWage: '' });
        const equipmentRows = ensureRows(data.businessOperation?.toolsEquipment?.rows, { equipment: '', capacity: '', unit: '', quantityOrPrice: '', projectedAmount: '', usefulLifeDays: '', productionCycle: '', depreciationCost: '' });
        const expenseRows = ensureMungkahingExpenseRows(data.businessOperation?.operatingExpenses?.rows);
        const salesRows = ensureRows(data.businessOperation?.salesProjection?.rows, { product: '', capacity: '', unit: '', sellingPrice: '', projectedSales: '' });
        const spendingRows = ensureRows(data.spendingPlan?.rows, { expense: '', amount: '', usageSchedule: '' });
        const income = data.businessOperation?.incomeComputation || {};

        return `
            <div class="paper-document">
                <section class="paper-sheet">
                    <header class="paper-head">
                        <div class="paper-head__eyebrow">Mungkahing Proyekto</div>
                        <h3>Sustainable Market and Technology and Employment Assistance Program (SMART LEAP)</h3>
                    </header>
                    <section class="paper-block">
                        <h4>I. Kinatibuk-an Impormasyon Bahin sa Proyekto</h4>
                        <div class="paper-inline-grid paper-inline-grid--two">
                            ${renderDocumentField('Ngalan sa Partisipante', 'projectInformation.participantName', project.participantName || '', 'text')}
                            ${renderDocumentField('Lokasyon sa Proyekto', 'projectInformation.projectLocation', project.projectLocation || '', 'text')}
                            ${renderDocumentField('Ulohan sa Proyektong MD', 'projectInformation.projectTitle', project.projectTitle || '', 'text')}
                            ${renderDocumentField('Petsa sa Pagtukod', 'projectInformation.projectDate', project.projectDate || '', 'date')}
                            ${renderDocumentField('Kinatibuk-ang Kantidad', 'projectInformation.projectedAmount', project.projectedAmount || '', 'number')}
                            ${renderDocumentField('Savings Account No.', 'projectInformation.savingsAccountNumber', project.savingsAccountNumber || 'NONE', 'text')}
                            ${renderDocumentField('Kantidad gikan sa CSWDD', 'projectInformation.cswddAmount', project.cswddAmount || '', 'number')}
                            ${renderDocumentField('Laing kakuhaon sa pondo', 'projectInformation.otherFundingSource', project.otherFundingSource || '', 'text')}
                        </div>
                        ${renderDocumentMungkahingSectorTable(pantawid, nonPantawid)}
                    </section>
                    <section class="paper-block">
                        <h4>II. Rationale of the Proposed Project</h4>
                        ${renderDocumentTextarea('Rason sa mungkahing proyekto', 'rationale', data.rationale || '', 'span-2')}
                    </section>
                    <section class="paper-block">
                        <h4>III. Detalye sa Modality Application/s</h4>
                        <div class="paper-subtitle">Pondo nga gi-ambag sa mga partner/s: Self-Employment Assistance-Kaunlaran (SEA-K)</div>
                        ${renderPaperTableWithRows(
                            ['Kakuhuan sa Pondo', 'Gi-ambag', 'Kantidad', 'Actions'],
                            modalityRows.map((row, index) => [
                                `<input class="paper-table__input" type="text" name="modalityApplications.rows.${index}.fundSource" value="${escapeAttribute(row.fundSource || '')}">`,
                                `<input class="paper-table__input" type="text" name="modalityApplications.rows.${index}.contributionType" value="${escapeAttribute(row.contributionType || '')}">`,
                                `<input class="paper-table__input" type="number" name="modalityApplications.rows.${index}.amount" value="${escapeAttribute(row.amount || '')}">`,
                                `<button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-mp-contribution" data-row-index="${index}">Remove</button>`,
                            ])
                        )}
                        <div class="paper-table-toolbar">
                            <button type="button" class="btn-outline small" data-row-action="add-mp-contribution">Add contribution row</button>
                        </div>
                    </section>
                    <section class="paper-block">
                        <h4>IV. Pagdumala sa Negosyo</h4>
                        <div class="paper-subtitle">a.) Mga gikinahanglan nga Materyales</div>
                        ${renderPaperTableWithRows(
                            ['Materials', 'Kadaghanon', 'Yunit', 'Presyo sa matag yunit', 'Dalas sa paggamit/Siklo sa Produksyon', 'Kinatibuk-ang kantidad', 'Actions'],
                            materialsRows.map((row, index) => [
                                `<input class="paper-table__input" type="text" name="businessOperation.materials.rows.${index}.material" value="${escapeAttribute(row.material || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.materials.rows.${index}.quality" value="${escapeAttribute(row.quality || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.materials.rows.${index}.unit" value="${escapeAttribute(row.unit || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.materials.rows.${index}.unitPrice" value="${escapeAttribute(row.unitPrice || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.materials.rows.${index}.cyclesPerProduction" value="${escapeAttribute(row.cyclesPerProduction || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.materials.rows.${index}.projectedCost" value="${escapeAttribute(row.projectedCost || '')}">`,
                                `<button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-mp-material" data-row-index="${index}">Remove</button>`,
                            ])
                        )}
                        <div class="paper-inline-grid paper-inline-grid--one">
                            ${renderDocumentField('Kinatibuk-ang Total', 'businessOperation.materials.totalCost', data.businessOperation?.materials?.totalCost || '', 'number')}
                        </div>
                        <div class="paper-table-toolbar">
                            <button type="button" class="btn-outline small" data-row-action="add-mp-material">Add material row</button>
                        </div>
                        <div class="paper-subtitle">b.) Mga gikinahanglan na Trabahante</div>
                        ${renderPaperTableWithRows(
                            ['Ngalan sa Magtrabaho sa Negosyo', 'Posisyon sa Trabaho', 'Inadlaw na Suweldo', 'Actions'],
                            laborRows.map((row, index) => [
                                `<input class="paper-table__input" type="text" name="businessOperation.labor.rows.${index}.workerName" value="${escapeAttribute(row.workerName || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.labor.rows.${index}.position" value="${escapeAttribute(row.position || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.labor.rows.${index}.dailyWage" value="${escapeAttribute(row.dailyWage || '')}">`,
                                `<button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-mp-labor" data-row-index="${index}">Remove</button>`,
                            ])
                        )}
                        <div class="paper-inline-grid paper-inline-grid--two">
                            ${renderDocumentField('Kinatibuk-an na inadlaw na suweldo', 'businessOperation.labor.totalDailyWage', data.businessOperation?.labor?.totalDailyWage || '', 'number')}
                            ${renderDocumentField('Kinatibuk-an na suweldo base sa siglo sa produksyon', 'businessOperation.labor.totalProductionCycleWage', data.businessOperation?.labor?.totalProductionCycleWage || '', 'number')}
                        </div>
                        <div class="paper-table-toolbar">
                            <button type="button" class="btn-outline small" data-row-action="add-mp-labor">Add labor row</button>
                        </div>
                    </section>
                </section>
                <section class="paper-sheet">
                    <section class="paper-block">
                        <div class="paper-subtitle">c.) Mga Gikinahanglan nga Kagamitan</div>
                        ${renderPaperTableWithRows(
                            ['Kagamitan', 'Kadaghanon', 'Yunit', 'Kantidad o presyo sa matag usa', 'Kinatibuk-an nga kantidad o presyo', 'Gitas-on sa kinabuhi sa mga himan/kagamitan', 'Siklo sa Produksyon', 'Depreciation Cost', 'Actions'],
                            equipmentRows.map((row, index) => [
                                `<input class="paper-table__input" type="text" name="businessOperation.toolsEquipment.rows.${index}.equipment" value="${escapeAttribute(row.equipment || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.toolsEquipment.rows.${index}.capacity" value="${escapeAttribute(row.capacity || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.toolsEquipment.rows.${index}.unit" value="${escapeAttribute(row.unit || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.toolsEquipment.rows.${index}.quantityOrPrice" value="${escapeAttribute(row.quantityOrPrice || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.toolsEquipment.rows.${index}.projectedAmount" value="${escapeAttribute(row.projectedAmount || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.toolsEquipment.rows.${index}.usefulLifeDays" value="${escapeAttribute(row.usefulLifeDays || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.toolsEquipment.rows.${index}.productionCycle" value="${escapeAttribute(row.productionCycle || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.toolsEquipment.rows.${index}.depreciationCost" value="${escapeAttribute(row.depreciationCost || '')}">`,
                                `<button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-mp-equipment" data-row-index="${index}">Remove</button>`,
                            ])
                        )}
                        <div class="paper-inline-grid paper-inline-grid--one">
                            ${renderDocumentField('Kinatibuk-ang Total', 'businessOperation.toolsEquipment.totalCost', data.businessOperation?.toolsEquipment?.totalCost || '', 'number')}
                        </div>
                        <div class="paper-table-toolbar">
                            <button type="button" class="btn-outline small" data-row-action="add-mp-equipment">Add equipment row</button>
                        </div>
                        <div class="paper-subtitle">d.) Uban pang mga gastohanan</div>
                        ${renderPaperTableWithRows(
                            ['Regular na ginagastuhan', 'Dalas ng pagbayad', 'Kinatibuk-an na kantidad o presyo base sa siglo sa produksyon'],
                            expenseRows.map((row, index) => [
                                `<span class="paper-table__text">${escapeHtml(row.expenseName || '')}</span>`,
                                `<input class="paper-table__input" type="text" name="businessOperation.operatingExpenses.rows.${index}.paymentFrequency" value="${escapeAttribute(row.paymentFrequency || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.operatingExpenses.rows.${index}.projectedCost" value="${escapeAttribute(row.projectedCost || '')}">`,
                            ])
                        )}
                        <div class="paper-inline-grid paper-inline-grid--one">
                            ${renderDocumentField('Grand Total', 'businessOperation.operatingExpenses.grandTotal', data.businessOperation?.operatingExpenses?.grandTotal || '', 'number')}
                        </div>
                        <div class="paper-subtitle">e.) Pangunahing kita gikan sa puhunan alang sa mga sangkap</div>
                        ${renderPaperTableWithRows(
                            ['Produkto', 'Kadaghanon', 'Yunit', 'Kantidad sa pagpamaligya matag piraso', 'Kinatibuk-an na kantidad sa pagpamaligya base sa siglo sa produksyon', 'Actions'],
                            salesRows.map((row, index) => [
                                `<input class="paper-table__input" type="text" name="businessOperation.salesProjection.rows.${index}.product" value="${escapeAttribute(row.product || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.salesProjection.rows.${index}.capacity" value="${escapeAttribute(row.capacity || '')}">`,
                                `<input class="paper-table__input" type="text" name="businessOperation.salesProjection.rows.${index}.unit" value="${escapeAttribute(row.unit || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.salesProjection.rows.${index}.sellingPrice" value="${escapeAttribute(row.sellingPrice || '')}">`,
                                `<input class="paper-table__input" type="number" name="businessOperation.salesProjection.rows.${index}.projectedSales" value="${escapeAttribute(row.projectedSales || '')}">`,
                                `<button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-mp-sale" data-row-index="${index}">Remove</button>`,
                            ])
                        )}
                        <div class="paper-inline-grid paper-inline-grid--one">
                            ${renderDocumentField('Gross Sales', 'businessOperation.salesProjection.grossSales', data.businessOperation?.salesProjection?.grossSales || '', 'number')}
                        </div>
                        <div class="paper-table-toolbar">
                            <button type="button" class="btn-outline small" data-row-action="add-mp-sale">Add sales row</button>
                        </div>
                    </section>
                    <section class="paper-block">
                        <div class="paper-subtitle">f.) Kinatibuk-ang kita sa matag produkto o paghimo sa serbisyo</div>
                        <div class="paper-inline-grid paper-inline-grid--two">
                            ${renderDocumentField('Gilauman nga kita alang sa usa ka "siklo sa produksyon"', 'businessOperation.incomeComputation.projectedIncomePerCycle', income.projectedIncomePerCycle || '', 'number')}
                            ${renderDocumentField('Mga materyales (raw materials)', 'businessOperation.incomeComputation.rawMaterialsCost', income.rawMaterialsCost || '', 'number')}
                            ${renderDocumentField('Gikinahanglan na manpower ug labor', 'businessOperation.incomeComputation.manpowerLaborCost', income.manpowerLaborCost || '', 'number')}
                            ${renderDocumentField('Depreciation Cost', 'businessOperation.incomeComputation.depreciationCost', income.depreciationCost || '', 'number')}
                            ${renderDocumentField('Uban pang mga Gasto', 'businessOperation.incomeComputation.otherExpenses', income.otherExpenses || '', 'number')}
                            ${renderDocumentField('Kinatibuk-ang gasto sa pag-operate', 'businessOperation.incomeComputation.totalOperatingCost', income.totalOperatingCost || '', 'number')}
                            ${renderDocumentField('Kinatibuk-ang ginansya human sa gasto sa operasyon (Gross Profit)', 'businessOperation.incomeComputation.grossProfit', income.grossProfit || '', 'number')}
                            ${renderDocumentField('Net profit', 'businessOperation.incomeComputation.netProfit', income.netProfit || '', 'number', 'span-2')}
                        </div>
                    </section>
                    <section class="paper-block">
                        <h4>g.) Iskedyul o Plano sa Paggasto sa SEA-K Capital Fund (SCF)</h4>
                        ${renderPaperTableWithRows(
                            ['Mga Gasto', 'Kantidad', 'Iskedyul sa Paggamit', 'Actions'],
                            spendingRows.map((row, index) => [
                                `<input class="paper-table__input" type="text" name="spendingPlan.rows.${index}.expense" value="${escapeAttribute(row.expense || '')}">`,
                                `<input class="paper-table__input" type="number" name="spendingPlan.rows.${index}.amount" value="${escapeAttribute(row.amount || '')}">`,
                                `<input class="paper-table__input" type="text" name="spendingPlan.rows.${index}.usageSchedule" value="${escapeAttribute(row.usageSchedule || '')}">`,
                                `<button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-mp-spending" data-row-index="${index}">Remove</button>`,
                            ])
                        )}
                        <div class="paper-table-toolbar">
                            <button type="button" class="btn-outline small" data-row-action="add-mp-spending">Add spending row</button>
                        </div>
                    </section>
                    <section class="paper-block">
                        <h4>V. Rekomendasyon</h4>
                        ${renderPaperStatementBlock(
                            'Participant Sign-off',
                            renderPaperCertificationSentence('Gi-andam ni ug girepaso ingon nga mungkahing proyekto sa SMART LEAP.'),
                            renderPaperSignatureArea(
                                'Pirma ibabaw sa pangalan sa Partisipante',
                                `
                                    ${renderDocumentField('Signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                                    ${renderDocumentField('Date signed', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                                    ${renderDocumentUpload('Participant signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                                `
                            )
                        )}
                    </section>
                </section>
            </div>
        `;
    }

    function renderAvailmentDesktop(payload) {
        const data = payload || {};
        const familyMembers = Array.isArray(data.familyEnterprise?.members) && data.familyEnterprise.members.length > 0
            ? data.familyEnterprise.members
            : [{ name: '', age: '', activities: '' }];
        const incomeRows = Array.isArray(data.incomeEligibility?.rows) && data.incomeEligibility.rows.length > 0
            ? data.incomeEligibility.rows
            : [{ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' }];
        const commitments = data.clientCommitment || {};
        const agreedToRollBackSchedule = Boolean(commitments.agreedToRollBackSchedule ?? commitments.agreedToSavingsCommitment);
        const agreedToWeeklySavings = Boolean(commitments.agreedToWeeklySavings ?? commitments.agreedToSavingsCommitment);

        return `
            <div class="paper-document paper-document--availment">
                <section class="paper-sheet">
                    <div class="paper-head">
                        <p class="paper-head__eyebrow">SMART LEAP Availment Form</p>
                        <h3>City Social Welfare and Development Department</h3>
                        <p>City: Butuan City</p>
                    </div>

                    <div class="paper-block">
                        <h4>I. Client Identifying Data</h4>
                        <div class="paper-inline-grid paper-inline-grid--three">
                            ${renderDocumentField('Name', 'clientIdentifyingData.name', data.clientIdentifyingData?.name || '', 'text')}
                            ${renderDocumentField('Age', 'clientIdentifyingData.age', data.clientIdentifyingData?.age || '', 'number')}
                            ${renderDocumentField('Address', 'clientIdentifyingData.address', data.clientIdentifyingData?.address || '', 'text')}
                            ${renderDocumentField('Name of Spouse', 'clientIdentifyingData.spouseName', data.clientIdentifyingData?.spouseName || '', 'text', 'span-2')}
                            ${renderDocumentReadOnly('City', data.clientIdentifyingData?.city || 'Butuan City')}
                        </div>
                    </div>

                    <div class="paper-block">
                        <h4>II. Type of Project</h4>
                        <p class="paper-subtitle">A. Family Enterprise</p>
                        ${renderDocumentFamilyTable(familyMembers)}
                        <p class="paper-subtitle">B. Individual Assistance</p>
                        <div class="paper-inline-grid paper-inline-grid--two">
                            ${renderDocumentField('Clientele Category', 'individualAssistance.clienteleCategory', data.individualAssistance?.clienteleCategory || '', 'text')}
                            ${renderDocumentTextarea('Nature of difficult circumstances', 'individualAssistance.natureOfDifficultCircumstances', data.individualAssistance?.natureOfDifficultCircumstances || '', 'span-2')}
                        </div>
                    </div>

                    <div class="paper-block">
                        <h4>III. Income Eligibility Requirement</h4>
                        ${renderDocumentIncomeTable(incomeRows, data.incomeEligibility?.totalFamilyIncome || '')}
                    </div>
                </section>

                <section class="paper-sheet">
                    <div class="paper-block">
                        <h4>IV. Social Responsibility and Willingness to Save (Client)</h4>
                    </div>

                    <div class="paper-block">
                        <h4>Participant Signature</h4>
                        <div class="paper-inline-grid paper-inline-grid--three">
                            ${renderDocumentField('Signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                            ${renderDocumentField('Date signed', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                            ${renderDocumentUpload('Participant signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    function renderValidationDesktop(payload) {
        const data = payload || {};
        const checklist = data.membershipChecklist || {};
        const eligibility = data.staffReview?.eligibilityAssessment || {};
        const identity = data.staffReview?.validatorIdentity || {};

        return `
            <div class="paper-document paper-document--validation">
                <section class="paper-sheet">
                    <div class="paper-head">
                        <p class="paper-head__eyebrow">Sustainable Market and Technology and Employment Assistance Program</p>
                        <h3>Validation Form</h3>
                    </div>

                    <div class="paper-block">
                        <div class="paper-inline-grid paper-inline-grid--two">
                            ${renderDocumentField('Date of Validation', 'applicantDetails.validationDate', data.applicantDetails?.validationDate || '', 'date')}
                            <div class="paper-spacer"></div>
                            ${renderDocumentField('Last Name', 'applicantDetails.lastName', data.applicantDetails?.lastName || '', 'text')}
                            ${renderDocumentField('First Name', 'applicantDetails.firstName', data.applicantDetails?.firstName || '', 'text')}
                            ${renderDocumentField('Middle Name', 'applicantDetails.middleName', data.applicantDetails?.middleName || '', 'text', 'span-2')}
                            ${renderDocumentField('Address / Purok', 'applicantDetails.purok', data.applicantDetails?.purok || '', 'text')}
                            ${renderDocumentField('Barangay', 'applicantDetails.barangay', data.applicantDetails?.barangay || '', 'text')}
                            ${renderDocumentField('Birthdate', 'applicantDetails.birthdate', data.applicantDetails?.birthdate || '', 'date')}
                            ${renderDocumentField('Educational Attainment', 'applicantDetails.educationalAttainment', data.applicantDetails?.educationalAttainment || '', 'text')}
                            ${renderDocumentField('Contact Number', 'applicantDetails.contactNumber', data.applicantDetails?.contactNumber || '', 'text', 'span-2')}
                        </div>
                    </div>

                    <div class="paper-block">
                        <h4>Checklist</h4>
                        ${renderValidationChecklistTable(checklist)}
                    </div>

                    <div class="paper-block">
                        <h4>Validator's Recommendation</h4>
                        ${renderDocumentTextarea('Recommendation', 'staffReview.validatorRecommendation', data.staffReview?.validatorRecommendation || '', 'span-2', true)}
                    </div>

                    <div class="paper-block">
                        <h4>Eligibility Assessment</h4>
                        <div class="paper-certification">
                            <p>I am <span class="paper-fillline">${escapeHtml(eligibility.residentName || '')}</span>, <span class="paper-fillline paper-fillline--short">${escapeHtml(eligibility.age || '')}</span> years old, residing at Barangay <span class="paper-fillline">${escapeHtml(eligibility.barangay || '')}</span>, Butuan City, Agusan del Norte. I understand the assistance process and I am <span class="paper-fillline">${escapeHtml(eligibility.eligibilityDecision || '')}</span> to avail the SMART LEAP program.</p>
                        </div>
                        <div class="paper-inline-grid paper-inline-grid--two">
                            ${renderDocumentSelect('Understands assistance process', 'staffReview.eligibilityAssessment.understandsAssistanceProcess', eligibility.understandsAssistanceProcess || '', ['', 'Yes', 'No'], true)}
                            ${renderDocumentSelect('Eligibility decision', 'staffReview.eligibilityAssessment.eligibilityDecision', eligibility.eligibilityDecision || '', ['', 'ANGAYAN', 'DILI ANGAYAN'], true)}
                            ${renderDocumentTextarea('Assistance process understanding', 'staffReview.eligibilityAssessment.assistanceProcessUnderstanding', eligibility.assistanceProcessUnderstanding || '', 'span-2', true)}
                        </div>
                    </div>

                    <div class="paper-block">
                        <h4>Signatures</h4>
                        <div class="paper-inline-grid paper-inline-grid--two">
                            ${renderDocumentField('Participant signed name', 'participantSignature.signedName', data.participantSignature?.signedName || '', 'text')}
                            ${renderDocumentField('Date signed', 'participantSignature.signedDate', data.participantSignature?.signedDate || '', 'date')}
                            ${renderDocumentUpload('Participant signature upload', 'participantSignature.signatureUpload', data.participantSignature?.signatureUpload || null)}
                            ${renderDocumentField('Validator name', 'staffReview.validatorIdentity.validatorName', identity.validatorName || '', 'text', '', true)}
                            ${renderDocumentField('Validator title', 'staffReview.validatorIdentity.validatorTitle', identity.validatorTitle || '', 'text', '', true)}
                            ${renderDocumentField('Validator signed date', 'staffReview.validatorIdentity.signedDate', identity.signedDate || '', 'date', '', true)}
                            ${renderDocumentUpload('Validator signature upload', 'validatorIdentity.signatureUpload', identity.signatureUpload || null, true)}
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    // Override the earlier mobile renderers so mobile uses the same content set as desktop.
    function renderAvailmentMobile(payload) {
        const data = payload || {};
        const commitments = data.clientCommitment || {};
        const agreedToRollBackSchedule = Boolean(commitments.agreedToRollBackSchedule ?? commitments.agreedToSavingsCommitment);
        const agreedToWeeklySavings = Boolean(commitments.agreedToWeeklySavings ?? commitments.agreedToSavingsCommitment);
        const familyMembers = Array.isArray(data.familyEnterprise?.members) && data.familyEnterprise.members.length > 0
            ? data.familyEnterprise.members
            : [{ name: '', age: '', activities: '' }];
        const incomeRows = Array.isArray(data.incomeEligibility?.rows) && data.incomeEligibility.rows.length > 0
            ? data.incomeEligibility.rows
            : [{ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' }];
        const staffReview = data.staffReview || {};
        const physicalRequirements = staffReview.physicalRequirements || {};
        const healthRows = Array.isArray(physicalRequirements.healthAgeRows) && physicalRequirements.healthAgeRows.length > 0
            ? physicalRequirements.healthAgeRows
            : [];
        const foodRelatedCertification = physicalRequirements.foodRelatedCertification || {};
        const psychoSocialRequirements = staffReview.psychoSocialRequirements || {};
        const residencyAndCharacter = psychoSocialRequirements.residencyAndCharacter || {};
        const familyRelationships = psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration || {};
        const socialResponsibility = psychoSocialRequirements.socialResponsibility || {};

        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Client identifying data</h4>
                    <p>Applicant-entered details from the SMART LEAP Availment Form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Client name', 'clientIdentifyingData.name', data.clientIdentifyingData?.name || '', 'text')}
                    ${renderField('Age', 'clientIdentifyingData.age', data.clientIdentifyingData?.age || '', 'number')}
                    ${renderField('Address', 'clientIdentifyingData.address', data.clientIdentifyingData?.address || '', 'text', true)}
                    ${renderField('Name of spouse', 'clientIdentifyingData.spouseName', data.clientIdentifyingData?.spouseName || '', 'text')}
                    ${renderReadOnlyField('City', data.clientIdentifyingData?.city || 'Butuan City')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Type of project: Family Enterprise</h4>
                    <p>List all family members participating in the enterprise and what each one will do.</p>
                </div>
                <div class="post-approval-repeatable" data-repeatable="familyMembers">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">Family members participating</span>
                        <button type="button" class="btn-outline small" data-row-action="add-family">Add family member</button>
                    </div>
                    ${familyMembers.map((row, index) => renderFamilyMemberRow(row, index)).join('')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Type of project: Individual Assistance</h4>
                    <p>Capture the applicant-facing narrative fields from the paper form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Clientele category', 'individualAssistance.clienteleCategory', data.individualAssistance?.clienteleCategory || '', 'text')}
                    ${renderTextarea('Nature of difficult circumstances', 'individualAssistance.natureOfDifficultCircumstances', data.individualAssistance?.natureOfDifficultCircumstances || '', true, 'Describe the circumstance that supports the availment request.')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Income eligibility requirement</h4>
                    <p>Provide the working family members and their monthly income details.</p>
                </div>
                <div class="post-approval-repeatable" data-repeatable="incomeRows">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">Monthly income rows</span>
                        <button type="button" class="btn-outline small" data-row-action="add-income">Add income row</button>
                    </div>
                    ${incomeRows.map((row, index) => renderIncomeRow(row, index)).join('')}
                </div>
                <div class="post-approval-fields">
                    ${renderField('Total family income', 'incomeEligibility.totalFamilyIncome', data.incomeEligibility?.totalFamilyIncome || '', 'number')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Social responsibility and willingness to save</h4>
                    <p>This mirrors the client-side commitment section from the paper availment form.</p>
                </div>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToPolicies" ${commitments.agreedToPolicies ? 'checked' : ''}>
                    <span>I agree to abide by the SMART LEAP policies and guidelines set by CSWDD.</span>
                </label>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToRollBackSchedule" ${agreedToRollBackSchedule ? 'checked' : ''}>
                    <span>I promise to pay the SMART LEAP roll-back on the time stipulated in the program.</span>
                </label>
                <label class="checkbox-field">
                    <input type="checkbox" name="clientCommitment.agreedToWeeklySavings" ${agreedToWeeklySavings ? 'checked' : ''}>
                    <span>I will generate weekly savings to prepare for emergencies that may affect my family.</span>
                </label>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Applicant e-signature</h4>
                    <p>Attach the participant signature used for the paper availment form. This will remain with your saved draft and submission.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Signer name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderField('Date signed', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Participant signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>IV. Social Responsibility and Willingness to Save (Client)</h4>
                    <p>Applicant commitment details only.</p>
                </div>
            </section>
        `;
    }

    function renderValidationMobile(payload) {
        const data = payload || {};
        const checklist = data.membershipChecklist || {};
        const eligibility = data.staffReview?.eligibilityAssessment || {};
        const identity = data.staffReview?.validatorIdentity || {};

        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Applicant details</h4>
                    <p>Fill the applicant-side information block from the SMART LEAP Validation Form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Date of validation', 'applicantDetails.validationDate', data.applicantDetails?.validationDate || '', 'date')}
                    ${renderField('Last name', 'applicantDetails.lastName', data.applicantDetails?.lastName || '', 'text')}
                    ${renderField('First name', 'applicantDetails.firstName', data.applicantDetails?.firstName || '', 'text')}
                    ${renderField('Middle name', 'applicantDetails.middleName', data.applicantDetails?.middleName || '', 'text')}
                    ${renderField('Purok', 'applicantDetails.purok', data.applicantDetails?.purok || '', 'text')}
                    ${renderField('Barangay', 'applicantDetails.barangay', data.applicantDetails?.barangay || '', 'text')}
                    ${renderField('Birthdate', 'applicantDetails.birthdate', data.applicantDetails?.birthdate || '', 'date')}
                    ${renderField('Educational attainment', 'applicantDetails.educationalAttainment', data.applicantDetails?.educationalAttainment || '', 'text')}
                    ${renderField('Contact number', 'applicantDetails.contactNumber', data.applicantDetails?.contactNumber || '', 'text')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Checklist</h4>
                    <p>Answer the membership checklist items exactly as required by the paper form.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderSelectField('Pantawid member', 'membershipChecklist.pantawidMember', checklist.pantawidMember || '', ['', 'Yes', 'No'])}
                    ${renderField('Pantawid specify', 'membershipChecklist.pantawidSpecify', checklist.pantawidSpecify || '', 'text')}
                    ${renderSelectField('SLPA member', 'membershipChecklist.slpaMember', checklist.slpaMember || '', ['', 'Yes', 'No'])}
                    ${renderField('SLPA specify', 'membershipChecklist.slpaSpecify', checklist.slpaSpecify || '', 'text')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Validator recommendation</h4>
                    <p>The staff-only review sections remain visible on mobile so the same content appears in both render modes.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderTextarea('Recommendation', 'staffReview.validatorRecommendation', data.staffReview?.validatorRecommendation || '', true, '', true)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Eligibility assessment</h4>
                    <p>This staff-only section matches the desktop paper-style validation rendering.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Resident name', 'staffReview.eligibilityAssessment.residentName', eligibility.residentName || '', 'text', false, true)}
                    ${renderField('Age', 'staffReview.eligibilityAssessment.age', eligibility.age || '', 'text', false, true)}
                    ${renderField('Barangay', 'staffReview.eligibilityAssessment.barangay', eligibility.barangay || '', 'text', false, true)}
                    ${renderSelectField('Understands assistance process', 'staffReview.eligibilityAssessment.understandsAssistanceProcess', eligibility.understandsAssistanceProcess || '', ['', 'Yes', 'No'], true)}
                    ${renderSelectField('Eligibility decision', 'staffReview.eligibilityAssessment.eligibilityDecision', eligibility.eligibilityDecision || '', ['', 'ANGAYAN', 'DILI ANGAYAN'], true)}
                    ${renderTextarea('Assistance process understanding', 'staffReview.eligibilityAssessment.assistanceProcessUnderstanding', eligibility.assistanceProcessUnderstanding || '', true, '', true)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Participant e-signature</h4>
                    <p>Attach the participant signature used for the paper validation form. Validator signature remains staff-only.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Signer name', 'participantSignature.signedName', data.participantSignature?.signedName || '', 'text')}
                    ${renderField('Date signed', 'participantSignature.signedDate', data.participantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Participant signature upload', 'participantSignature.signatureUpload', data.participantSignature?.signatureUpload || null)}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Validator sign-off</h4>
                    <p>Validator identity and signature upload remain staff-only, but the same section appears on mobile for content parity.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Validator name', 'staffReview.validatorIdentity.validatorName', identity.validatorName || '', 'text', false, true)}
                    ${renderField('Validator title', 'staffReview.validatorIdentity.validatorTitle', identity.validatorTitle || '', 'text', false, true)}
                    ${renderField('Validator signed date', 'staffReview.validatorIdentity.signedDate', identity.signedDate || '', 'date', false, true)}
                    ${renderUploadField('Validator signature upload', 'validatorIdentity.signatureUpload', identity.signatureUpload || null, true)}
                </div>
            </section>
        `;
    }

    function renderStaffSections(sections, reviewerRemarks) {
        const cards = sections.map((section) => `
            <article class="post-approval-staffcard">
                <strong>${escapeHtml(section.title || 'Staff section')}</strong>
                <p>${escapeHtml(section.description || '')}</p>
            </article>
        `).join('');

        const remarks = reviewerRemarks
            ? `<article class="post-approval-staffcard is-warning"><strong>Reviewer remarks</strong><p>${escapeHtml(reviewerRemarks)}</p></article>`
            : '';

        return cards + remarks;
    }

    function renderDocumentReadOnly(label, value, spanClass = '') {
        return `
            <label class="paper-field ${escapeAttribute(spanClass)}">
                <span class="paper-field__label">${escapeHtml(label)}</span>
                <div class="paper-field__value">${escapeHtml(value ?? '') || '&nbsp;'}</div>
            </label>
        `;
    }

    function renderDocumentField(label, name, value, type, spanClass = '', disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="paper-field ${escapeAttribute(spanClass)}">
                <span class="paper-field__label">${escapeHtml(label)}</span>
                ${ownership.note}
                <input class="paper-field__input ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="${escapeAttribute(type || 'text')}" name="${escapeAttribute(name)}" value="${escapeAttribute(value ?? '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
            </label>
        `;
    }

    function renderDocumentTextarea(label, name, value, spanClass = '', disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="paper-field ${escapeAttribute(spanClass)}">
                <span class="paper-field__label">${escapeHtml(label)}</span>
                ${ownership.note}
                <textarea class="paper-field__textarea ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" name="${escapeAttribute(name)}" rows="4" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>${escapeHtml(value ?? '')}</textarea>
            </label>
        `;
    }

    function renderDocumentSelect(label, name, value, options, disabled = false, spanClass = '') {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="paper-field ${escapeAttribute(spanClass)}">
                <span class="paper-field__label">${escapeHtml(label)}</span>
                ${ownership.note}
                <select class="paper-field__input ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" name="${escapeAttribute(name)}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
                    ${(options || []).map((option) => `<option value="${escapeAttribute(option)}" ${String(value) === String(option) ? 'selected' : ''}>${escapeHtml(option || 'Select')}</option>`).join('')}
                </select>
            </label>
        `;
    }

    function renderDocumentCheckbox(label, name, checked, disabled = false, spanClass = '') {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="paper-checkbox ${escapeAttribute(spanClass)}">
                <input type="checkbox" name="${escapeAttribute(name)}" ${ownership.attrs} ${checked ? 'checked' : ''} ${ownership.disabled ? 'disabled' : ''}>
                <span>${escapeHtml(label)}</span>
            </label>
        `;
    }

    function renderDocumentUpload(label, fieldKey, metadata, disabled = false, spanClass = '') {
        const ownership = buildFieldOwnershipAttributes(fieldKey, disabled);
        const fileName = metadata?.original_name || '';
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        const uploadedAt = metadata?.uploaded_at ? formatDateTime(metadata.uploaded_at) : '';

        return `
            <div class="paper-field paper-upload ${escapeAttribute(spanClass)}">
                <span class="paper-field__label">${escapeHtml(label)}</span>
                ${ownership.note}
                <label class="paper-upload__card ${ownership.disabled ? 'is-disabled' : ''}">
                    <input type="file" class="upload-input" data-upload-field="${escapeAttribute(fieldKey)}" ${ownership.attrs} accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${ownership.disabled ? 'disabled' : ''}>
                    <span class="paper-upload__copy">
                        <strong>${fileName ? 'Replace uploaded file' : (ownership.owner === FIELD_OWNER_STAFF ? 'Reserved for CSWDD staff' : 'Upload file')}</strong>
                        <small>${fileName ? escapeHtml(fileName) : 'Accepted: JPG, PNG, WEBP, HEIC, HEIF, or PDF'}</small>
                    </span>
                </label>
                ${fileUrl ? `<a class="upload-link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">View uploaded file</a>` : ''}
                ${uploadedAt ? `<small class="field-hint">Uploaded ${escapeHtml(uploadedAt)}</small>` : ''}
            </div>
        `;
    }

    function renderDocumentFamilyTable(rows, options = {}) {
        const safeRows = Array.isArray(rows) && rows.length > 0 ? rows : [{ name: '', age: '', activities: '' }];
        const paperMode = Boolean(options.paperMode);
        return `
            <div class="paper-table-wrap">
                <table class="paper-table ${paperMode ? 'paper-table--govform' : ''}">
                    <thead>
                        <tr>
                            <th>Family Member Participating</th>
                            <th>Age</th>
                            <th>Activities</th>
                            ${paperMode ? '' : '<th class="paper-table__actions">Actions</th>'}
                        </tr>
                    </thead>
                    <tbody>
                        ${safeRows.map((row, index) => `
                            <tr>
                                <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="text" name="familyEnterprise.members.${index}.name" value="${escapeAttribute(row.name || '')}"></td>
                                <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="number" name="familyEnterprise.members.${index}.age" value="${escapeAttribute(row.age || '')}"></td>
                                <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="text" name="familyEnterprise.members.${index}.activities" value="${escapeAttribute(row.activities || '')}"></td>
                                ${paperMode ? '' : `<td class="paper-table__actions"><button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-family" data-row-index="${index}">Remove</button></td>`}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${paperMode
                ? renderMungkahingTableControls('add-family', 'remove-family', safeRows, 'Family row')
                : `<div class="paper-table-toolbar"><button type="button" class="btn-outline small" data-row-action="add-family">Add family member</button></div>`
            }
        `;
    }

    function renderDocumentIncomeTable(rows, totalFamilyIncome, options = {}) {
        const safeRows = Array.isArray(rows) && rows.length > 0 ? rows : [{ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' }];
        const paperMode = Boolean(options.paperMode);
        const headerHtml = paperMode
            ? `
                <tr>
                    <th rowspan="2">Name of Working Family Members</th>
                    <th colspan="3" class="center-text">Monthly Income</th>
                    <th rowspan="2">Total Family Income</th>
                </tr>
                <tr>
                    <th>Cash</th>
                    <th>Non-Cash</th>
                    <th>Total</th>
                </tr>
            `
            : `
                <tr>
                    <th>Name of Working Family Members</th>
                    <th>Cash Income</th>
                    <th>Non-Cash</th>
                    <th>Total</th>
                    <th class="paper-table__actions">Actions</th>
                </tr>
            `;
        return `
            <div class="paper-table-wrap">
                <table class="paper-table ${paperMode ? 'paper-table--govform paper-table--dense' : ''}">
                    <thead>
                        ${headerHtml}
                    </thead>
                    <tbody>
                        ${safeRows.map((row, index) => `
                            <tr>
                                <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="text" name="incomeEligibility.rows.${index}.memberName" value="${escapeAttribute(row.memberName || '')}"></td>
                                <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="number" name="incomeEligibility.rows.${index}.cashIncome" value="${escapeAttribute(row.cashIncome || '')}"></td>
                                <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="number" name="incomeEligibility.rows.${index}.nonCashIncome" value="${escapeAttribute(row.nonCashIncome || '')}"></td>
                                <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="number" name="incomeEligibility.rows.${index}.totalIncome" value="${escapeAttribute(row.totalIncome || '')}"></td>
                                ${paperMode ? '<td class="paper-table__blank"></td>' : `<td class="paper-table__actions"><button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-income" data-row-index="${index}">Remove</button></td>`}
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="4"><strong>Total Family Income</strong></td>
                            <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="number" name="incomeEligibility.totalFamilyIncome" value="${escapeAttribute(totalFamilyIncome || '')}"></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            ${paperMode
                ? renderMungkahingTableControls('add-income', 'remove-income', safeRows, 'Income row')
                : `<div class="paper-table-toolbar"><button type="button" class="btn-outline small" data-row-action="add-income">Add income row</button></div>`
            }
        `;
    }

    function renderDocumentHealthTable(rows) {
        const safeRows = Array.isArray(rows) && rows.length > 0 ? rows : [{ requirement: '', age: '', healthStatus: '' }];
        return `
            <div class="paper-table-wrap">
                <table class="paper-table paper-table--govform paper-table--dense">
                    <thead>
                        <tr>
                            <th>Health and Age Requirements</th>
                            <th>Age</th>
                            <th>Health Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${safeRows.map((row, index) => `
                            <tr>
                                <td><input class="paper-table__input paper-table__input--line" type="text" name="staffReview.physicalRequirements.healthAgeRows.${index}.requirement" value="${escapeAttribute(row.requirement || '')}" disabled></td>
                                <td><input class="paper-table__input paper-table__input--line" type="text" name="staffReview.physicalRequirements.healthAgeRows.${index}.age" value="${escapeAttribute(row.age || '')}" disabled></td>
                                <td><input class="paper-table__input paper-table__input--line" type="text" name="staffReview.physicalRequirements.healthAgeRows.${index}.healthStatus" value="${escapeAttribute(row.healthStatus || '')}" disabled></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderValidationChecklistTable(checklist, options = {}) {
        const paperMode = Boolean(options.paperMode);
        const rows = [
            ['Pantawid Member', 'membershipChecklist.pantawidMember', 'membershipChecklist.pantawidSpecify'],
            ['SLPA Member', 'membershipChecklist.slpaMember', 'membershipChecklist.slpaSpecify'],
        ];
        return `
            <div class="paper-table-wrap">
                <table class="paper-table ${paperMode ? 'paper-table--govform paper-table--validation' : 'paper-table--checklist'}">
                    <thead>
                        <tr>
                            <th>${paperMode ? 'Is He/She' : 'Checklist'}</th>
                            <th>Yes</th>
                            <th>No</th>
                            <th>Specify</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(([label, key, specifyKey]) => {
                            const value = checklist?.[key.split('.').pop()] || '';
                            const specifyValue = checklist?.[specifyKey.split('.').pop()] || '';
                            return `
                                <tr>
                                    <td>${escapeHtml(label)}</td>
                                    <td class="paper-table__choice"><input class="${paperMode ? 'paper-table__radio' : ''}" type="radio" name="${escapeAttribute(key)}" value="Yes" ${value === 'Yes' ? 'checked' : ''}></td>
                                    <td class="paper-table__choice"><input class="${paperMode ? 'paper-table__radio' : ''}" type="radio" name="${escapeAttribute(key)}" value="No" ${value === 'No' ? 'checked' : ''}></td>
                                    <td><input class="paper-table__input ${paperMode ? 'paper-table__input--line' : ''}" type="text" name="${escapeAttribute(specifyKey)}" value="${escapeAttribute(specifyValue)}"></td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderReadOnlyField(label, value) {
        return `
            <label class="form-field">
                <span>${escapeHtml(label)}</span>
                <input type="text" value="${escapeAttribute(value ?? '')}" readonly>
            </label>
        `;
    }

    function renderField(label, name, value, type, full = false, disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="form-field ${full ? 'full' : ''}">
                <span>${escapeHtml(label)}</span>
                ${ownership.note}
                <input class="${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="${escapeAttribute(type || 'text')}" name="${escapeAttribute(name)}" value="${escapeAttribute(value ?? '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
            </label>
        `;
    }

    function renderTextarea(label, name, value, full = false, hint = '', disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="form-field ${full ? 'full' : ''}">
                <span>${escapeHtml(label)}</span>
                ${ownership.note}
                <textarea class="${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" name="${escapeAttribute(name)}" rows="4" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>${escapeHtml(value ?? '')}</textarea>
                ${hint ? `<small class="field-hint">${escapeHtml(hint)}</small>` : ''}
            </label>
        `;
    }

    function renderUploadField(label, fieldKey, metadata, disabled = false) {
        const ownership = buildFieldOwnershipAttributes(fieldKey, disabled);
        const fileName = metadata?.original_name || '';
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        const uploadedAt = metadata?.uploaded_at ? formatDateTime(metadata.uploaded_at) : '';

        return `
            <div class="form-field full upload-field">
                <span>${escapeHtml(label)}</span>
                ${ownership.note}
                <label class="upload-card">
                    <input type="file" class="upload-input" data-upload-field="${escapeAttribute(fieldKey)}" ${ownership.attrs} accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${ownership.disabled ? 'disabled' : ''}>
                    <span class="upload-card__copy">
                        <strong>${fileName ? 'Replace uploaded file' : (ownership.owner === FIELD_OWNER_STAFF ? 'Signature upload handled in review' : 'Upload signature file')}</strong>
                        <small>${fileName ? escapeHtml(fileName) : 'Accepted: JPG, PNG, WEBP, HEIC, HEIF, or PDF'}</small>
                    </span>
                </label>
                ${fileUrl ? `<a class="upload-link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">View uploaded file</a>` : ''}
                ${uploadedAt ? `<small class="field-hint">Uploaded ${escapeHtml(uploadedAt)}</small>` : ''}
            </div>
        `;
    }

    function renderReadOnlyUpload(label, metadata) {
        if (!metadata?.file_path) {
            return '';
        }

        return `
            <article class="upload-preview">
                <strong>${escapeHtml(label)}</strong>
                <a class="upload-link" href="${escapeAttribute(routeUrl(metadata.file_path))}" target="_blank" rel="noopener">
                    ${escapeHtml(metadata.original_name || 'View uploaded file')}
                </a>
                ${metadata.uploaded_at ? `<small>${escapeHtml(formatDateTime(metadata.uploaded_at))}</small>` : ''}
            </article>
        `;
    }

    function renderSelectField(label, name, value, options, disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <label class="form-field">
                <span>${escapeHtml(label)}</span>
                ${ownership.note}
                <select class="${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" name="${escapeAttribute(name)}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
                    ${options.map((option) => `<option value="${escapeAttribute(option)}" ${String(value) === String(option) ? 'selected' : ''}>${escapeHtml(option || 'Select')}</option>`).join('')}
                </select>
            </label>
        `;
    }

    function renderFamilyMemberRow(row, index) {
        return `
            <div class="post-approval-repeatable__row">
                ${renderField('Family member', `familyEnterprise.members.${index}.name`, row.name || '', 'text')}
                ${renderField('Age', `familyEnterprise.members.${index}.age`, row.age || '', 'number')}
                ${renderField('Activities', `familyEnterprise.members.${index}.activities`, row.activities || '', 'text')}
                <div class="form-field">
                    <span>Remove row</span>
                    <button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-family" data-row-index="${index}">Remove</button>
                </div>
            </div>
        `;
    }

    function renderIncomeRow(row, index) {
        return `
            <div class="post-approval-repeatable__row">
                ${renderField('Working family member', `incomeEligibility.rows.${index}.memberName`, row.memberName || '', 'text')}
                ${renderField('Cash income', `incomeEligibility.rows.${index}.cashIncome`, row.cashIncome || '', 'number')}
                ${renderField('Non-cash income', `incomeEligibility.rows.${index}.nonCashIncome`, row.nonCashIncome || '', 'number')}
                ${renderField('Total income', `incomeEligibility.rows.${index}.totalIncome`, row.totalIncome || '', 'number')}
                <div class="form-field">
                    <span>Remove row</span>
                    <button type="button" class="btn-outline small post-approval-row-action" data-row-action="remove-income" data-row-index="${index}">Remove</button>
                </div>
            </div>
        `;
    }

    function handleRowAction(event) {
        const action = event.target.getAttribute('data-row-action');
        if (!action || !state.task) {
            return;
        }

        const payload = gatherFormData();
        if (!payload) {
            return;
        }

        if (action === 'add-family') {
            payload.familyEnterprise = payload.familyEnterprise || {};
            payload.familyEnterprise.members = Array.isArray(payload.familyEnterprise.members) ? payload.familyEnterprise.members : [];
            payload.familyEnterprise.members.push({ name: '', age: '', activities: '' });
        } else if (action === 'remove-family') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.familyEnterprise.members.splice(index, 1);
            if (payload.familyEnterprise.members.length === 0) {
                payload.familyEnterprise.members.push({ name: '', age: '', activities: '' });
            }
        } else if (action === 'add-income') {
            payload.incomeEligibility = payload.incomeEligibility || {};
            payload.incomeEligibility.rows = Array.isArray(payload.incomeEligibility.rows) ? payload.incomeEligibility.rows : [];
            payload.incomeEligibility.rows.push({ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' });
        } else if (action === 'remove-income') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.incomeEligibility.rows.splice(index, 1);
            if (payload.incomeEligibility.rows.length === 0) {
                payload.incomeEligibility.rows.push({ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' });
            }
        } else if (action === 'add-mp-contribution') {
            payload.modalityApplications = payload.modalityApplications || {};
            payload.modalityApplications.rows = Array.isArray(payload.modalityApplications.rows) ? payload.modalityApplications.rows : [];
            payload.modalityApplications.rows.push({ fundSource: '', contributionType: '', amount: '' });
        } else if (action === 'remove-mp-contribution') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.modalityApplications.rows.splice(index, 1);
            if (payload.modalityApplications.rows.length === 0) {
                payload.modalityApplications.rows.push({ fundSource: '', contributionType: '', amount: '' });
            }
        } else if (action === 'add-mp-material') {
            payload.businessOperation = payload.businessOperation || {};
            payload.businessOperation.materials = payload.businessOperation.materials || {};
            payload.businessOperation.materials.rows = Array.isArray(payload.businessOperation.materials.rows) ? payload.businessOperation.materials.rows : [];
            payload.businessOperation.materials.rows.push({ material: '', quality: '', unit: '', unitPrice: '', cyclesPerProduction: '', projectedCost: '' });
        } else if (action === 'remove-mp-material') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.businessOperation.materials.rows.splice(index, 1);
            if (payload.businessOperation.materials.rows.length === 0) {
                payload.businessOperation.materials.rows.push({ material: '', quality: '', unit: '', unitPrice: '', cyclesPerProduction: '', projectedCost: '' });
            }
        } else if (action === 'add-mp-labor') {
            payload.businessOperation = payload.businessOperation || {};
            payload.businessOperation.labor = payload.businessOperation.labor || {};
            payload.businessOperation.labor.rows = Array.isArray(payload.businessOperation.labor.rows) ? payload.businessOperation.labor.rows : [];
            payload.businessOperation.labor.rows.push({ workerName: '', position: '', dailyWage: '' });
        } else if (action === 'remove-mp-labor') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.businessOperation.labor.rows.splice(index, 1);
            if (payload.businessOperation.labor.rows.length === 0) {
                payload.businessOperation.labor.rows.push({ workerName: '', position: '', dailyWage: '' });
            }
        } else if (action === 'add-mp-equipment') {
            payload.businessOperation = payload.businessOperation || {};
            payload.businessOperation.toolsEquipment = payload.businessOperation.toolsEquipment || {};
            payload.businessOperation.toolsEquipment.rows = Array.isArray(payload.businessOperation.toolsEquipment.rows) ? payload.businessOperation.toolsEquipment.rows : [];
            payload.businessOperation.toolsEquipment.rows.push({ equipment: '', capacity: '', unit: '', quantityOrPrice: '', projectedAmount: '', usefulLifeDays: '', productionCycle: '', depreciationCost: '' });
        } else if (action === 'remove-mp-equipment') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.businessOperation.toolsEquipment.rows.splice(index, 1);
            if (payload.businessOperation.toolsEquipment.rows.length === 0) {
                payload.businessOperation.toolsEquipment.rows.push({ equipment: '', capacity: '', unit: '', quantityOrPrice: '', projectedAmount: '', usefulLifeDays: '', productionCycle: '', depreciationCost: '' });
            }
        } else if (action === 'add-mp-expense') {
            payload.businessOperation = payload.businessOperation || {};
            payload.businessOperation.operatingExpenses = payload.businessOperation.operatingExpenses || {};
            payload.businessOperation.operatingExpenses.rows = Array.isArray(payload.businessOperation.operatingExpenses.rows) ? payload.businessOperation.operatingExpenses.rows : [];
            payload.businessOperation.operatingExpenses.rows.push({ expenseName: '', paymentFrequency: '', projectedCost: '' });
        } else if (action === 'remove-mp-expense') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.businessOperation.operatingExpenses.rows.splice(index, 1);
            if (payload.businessOperation.operatingExpenses.rows.length === 0) {
                payload.businessOperation.operatingExpenses.rows.push({ expenseName: '', paymentFrequency: '', projectedCost: '' });
            }
        } else if (action === 'add-mp-sale') {
            payload.businessOperation = payload.businessOperation || {};
            payload.businessOperation.salesProjection = payload.businessOperation.salesProjection || {};
            payload.businessOperation.salesProjection.rows = Array.isArray(payload.businessOperation.salesProjection.rows) ? payload.businessOperation.salesProjection.rows : [];
            payload.businessOperation.salesProjection.rows.push({ product: '', capacity: '', unit: '', sellingPrice: '', projectedSales: '' });
        } else if (action === 'remove-mp-sale') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.businessOperation.salesProjection.rows.splice(index, 1);
            if (payload.businessOperation.salesProjection.rows.length === 0) {
                payload.businessOperation.salesProjection.rows.push({ product: '', capacity: '', unit: '', sellingPrice: '', projectedSales: '' });
            }
        } else if (action === 'add-mp-spending') {
            payload.spendingPlan = payload.spendingPlan || {};
            payload.spendingPlan.rows = Array.isArray(payload.spendingPlan.rows) ? payload.spendingPlan.rows : [];
            payload.spendingPlan.rows.push({ expense: '', amount: '', usageSchedule: '' });
        } else if (action === 'remove-mp-spending') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.spendingPlan.rows.splice(index, 1);
            if (payload.spendingPlan.rows.length === 0) {
                payload.spendingPlan.rows.push({ expense: '', amount: '', usageSchedule: '' });
            }
        } else if (action === 'add-bp-product') {
            payload.productsServices = payload.productsServices || {};
            payload.productsServices.rows = Array.isArray(payload.productsServices.rows) ? payload.productsServices.rows : [];
            payload.productsServices.rows.push({ name: '', description: '', price: '', targetMarket: '' });
        } else if (action === 'remove-bp-product') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.productsServices.rows.splice(index, 1);
            if (payload.productsServices.rows.length === 0) {
                payload.productsServices.rows.push({ name: '', description: '', price: '', targetMarket: '' });
            }
        } else if (action === 'add-bp-schedule') {
            payload.implementationSchedule = payload.implementationSchedule || {};
            payload.implementationSchedule.rows = Array.isArray(payload.implementationSchedule.rows) ? payload.implementationSchedule.rows : [];
            payload.implementationSchedule.rows.push({ activity: '', targetDate: '', responsiblePerson: '' });
        } else if (action === 'remove-bp-schedule') {
            const index = Number(event.target.getAttribute('data-row-index'));
            payload.implementationSchedule.rows.splice(index, 1);
            if (payload.implementationSchedule.rows.length === 0) {
                payload.implementationSchedule.rows.push({ activity: '', targetDate: '', responsiblePerson: '' });
            }
        } else {
            return;
        }

        state.activePayload = payload;
        renderTask();
    }

    async function handleApplicantUploadChange(event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'file') {
            return;
        }

        const fieldKey = input.dataset.uploadField || '';
        const file = input.files?.[0];
        if (!fieldKey || !file || !state.task) {
            return;
        }
        if (!isTaskEditable(state.task)) {
            showToast('This form is no longer editable in its current status.', 'warning');
            input.value = '';
            return;
        }

        input.disabled = true;
        try {
            const body = new FormData();
            body.append('code', state.task.code);
            body.append('fieldKey', fieldKey);
            body.append('file', file);

            const payload = await fetchJson('api/post-approval/upload', {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body,
            });

            if (payload.upload) {
                setNestedValue(state.activePayload, fieldKey, payload.upload);
                showToast('Signature file uploaded.', 'success');
                renderTask();
            }
        } catch (error) {
            showToast(error.message || 'Unable to upload this file right now.', 'warning');
        } finally {
            input.disabled = false;
            input.value = '';
        }
    }

    async function handleSave() {
        if (!state.task) {
            return;
        }
        if (!isTaskEditable(state.task)) {
            showToast('This form is no longer editable in its current status.', 'warning');
            return;
        }

        const form = gatherFormData();
        if (!form) {
            return;
        }

        try {
            const payload = await fetchJson('api/post-approval/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    code: state.task.code,
                    form,
                }),
            });
            if (!payload.ok) {
                throw new Error(payload.message || 'Unable to save form.');
            }

            state.formErrors = {};
            showToast('Post-approval form saved.', 'success');
            await loadTask();
        } catch (error) {
            showToast(error.message || 'Unable to save this form right now.', 'warning');
        }
    }

    async function handleSubmit(event) {
        event.preventDefault();
        if (!state.task) {
            return;
        }
        if (!isTaskEditable(state.task)) {
            showToast('This form is no longer editable in its current status.', 'warning');
            return;
        }

        const form = gatherFormData();
        if (!form) {
            return;
        }

        try {
            const payload = await fetchJson('api/post-approval/submit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    code: state.task.code,
                    form,
                }),
            });
            if (!payload.ok) {
                throw new Error(payload.message || 'Unable to submit form.');
            }

            state.formErrors = {};
            showToast('Post-approval form submitted.', 'success');
            await loadTask();
        } catch (error) {
            const errors = error?.payload?.errors;
            if (errors && typeof errors === 'object') {
                state.formErrors = errors;
                renderTask();
                document.getElementById('postApprovalFormErrorSummary')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                showToast('Submission blocked. Complete the required fields listed above.', 'warning');
                return;
            }

            showToast(error.message || 'Unable to submit this form right now.', 'warning');
        }
    }

    function gatherFormData() {
        const form = document.getElementById('postApprovalForm');
        if (!form || form.classList.contains('is-hidden')) {
            return null;
        }

        if (state.task?.code === 'business_plan') {
            const businessPlanData = buildBusinessPlanFormData(form);
            state.activePayload = businessPlanData;
            return businessPlanData;
        }

        const data = structuredCloneSafe(state.activePayload || {});
        form.querySelectorAll('input[name], select[name], textarea[name]').forEach((field) => {
            const name = field.getAttribute('name');
            if (!name) {
                return;
            }

            const ownership = resolveElementOwnership(field);
            if (ownership.owner !== FIELD_OWNER_APPLICANT) {
                return;
            }

            let value;
            if (field instanceof HTMLInputElement && field.type === 'file') {
                return;
            }
            if (field instanceof HTMLInputElement && field.type === 'radio') {
                if (!field.checked) {
                    return;
                }
                value = field.value;
            } else
            if (field instanceof HTMLInputElement && field.type === 'checkbox') {
                value = field.checked;
            } else {
                value = field.value;
            }

            setNestedValue(data, name, value);
        });

        state.activePayload = data;
        return data;
    }

    function buildBusinessPlanFormData(form) {
        const data = structuredCloneSafe(state.activePayload || {});
        const elements = Array.from(form.elements || []);
        const collected = new Map();

        elements.forEach((field) => {
            if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
                return;
            }

            const name = field.getAttribute('name');
            if (!name || field.type === 'file') {
                return;
            }

            const ownership = resolveElementOwnership(field);
            if (ownership.owner !== FIELD_OWNER_APPLICANT) {
                return;
            }

            let value;
            if (field instanceof HTMLInputElement && field.type === 'checkbox') {
                value = field.checked;
            } else if (field instanceof HTMLInputElement && field.type === 'radio') {
                if (!field.checked) {
                    return;
                }
                value = field.value;
            } else {
                value = String(field.value || '').trim();
            }

            if (!collected.has(name) || String(value).trim() !== '') {
                collected.set(name, value);
            }
        });

        collected.forEach((value, name) => {
            setNestedValue(data, name, value);
        });

        data.productsServices = data.productsServices || {};
        data.implementationSchedule = data.implementationSchedule || {};
        data.productsServices.rows = collectBusinessPlanRows(collected, 'productsServices.rows', ['name', 'description', 'price', 'targetMarket']);
        data.implementationSchedule.rows = collectBusinessPlanRows(collected, 'implementationSchedule.rows', ['activity', 'targetDate', 'responsiblePerson']);

        return data;
    }

    function collectBusinessPlanRows(collected, path, keys) {
        const rows = new Map();
        const prefix = `${path}.`;

        collected.forEach((value, name) => {
            if (!name.startsWith(prefix)) {
                return;
            }

            const parts = name.split('.');
            const rowIndex = Number(parts[2] || '');
            const key = parts[3] || '';
            if (!Number.isInteger(rowIndex) || !keys.includes(key)) {
                return;
            }

            const row = rows.get(rowIndex) || {};
            row[key] = String(value || '').trim();
            rows.set(rowIndex, row);
        });

        return Array.from(rows.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([, row]) => row)
            .filter((row) => keys.some((key) => String(row[key] || '').trim() !== ''));
    }

    function renderFatalState(message) {
        showToast(message, 'warning');
        setText('formPageTitle', 'Application Form');
        setText('formPageSubtitle', message);
        setText('formPageStatus', 'Unavailable');
        setText('formPageReview', 'Unavailable');
        setText('postApprovalWorkspaceTitle', 'Application form unavailable');
        setText('postApprovalWorkspaceSubtitle', message);
        setText('postApprovalWorkspaceStatus', 'Unavailable');
        setText('postApprovalWorkspaceNotice', message);
        document.getElementById('postApprovalForm')?.classList.add('is-hidden');
    }

    function buildReviewState(task) {
        if (task.status === 'Verified') {
            return task.reviewedAt ? `Done ${formatDateTime(task.reviewedAt)}` : 'Done';
        }
        if (task.status === 'Submitted') {
            return 'Waiting for review';
        }
        if (task.reviewerRemarks) {
            return 'Please read reviewer note';
        }
        return 'Still being filled out';
    }

    function buildPostApprovalNotice(task) {
        if (task.reviewerRemarks) {
            return `Please review this note before you continue: ${task.reviewerRemarks}`;
        }
        if (task.status === 'Submitted') {
            return 'You already submitted this form. Please wait while it is being reviewed.';
        }
        if (task.status === 'Verified') {
            return 'This form is already done and checked by CSWDD.';
        }
        if (task.status === 'Locked') {
            return 'This final requirement will open only after the earlier post-approval forms are verified.';
        }
        if (task.staged) {
            return task.helpText || 'This form will open later after the earlier steps are finished.';
        }
        return '';
    }

    function buildFormGuidance(task) {
        const taskGuides = {
            availment_form: {
                step: 'Application requirement',
                time: 'About 10 to 15 minutes',
                prepare: 'Personal details, family income details, and signature file',
                summary: 'This form records your basic application details and the information needed to continue your assistance record.',
            },
            validation_form: {
                step: 'Application requirement',
                time: 'About 10 minutes',
                prepare: 'Updated household details and supporting answers',
                summary: 'This form checks and updates your beneficiary information before the next documents are reviewed.',
            },
            business_plan: {
                step: 'Application requirement',
                time: 'About 20 to 30 minutes',
                prepare: 'Business idea, cost estimates, and income plan',
                summary: 'This form helps explain your livelihood plan in a clearer, structured way.',
            },
            mungkahing_proyekto: {
                step: 'Application requirement',
                time: 'About 20 to 30 minutes',
                prepare: 'Project details, budget estimates, and signature file',
                summary: 'This form captures the proposed project details that support your request for assistance.',
            },
            buhat_sa_pagpanumpa: {
                step: 'Application requirement',
                time: 'About 10 minutes',
                prepare: 'Final review of your answers and signature file',
                summary: 'This form is your final statement and confirmation before the task can move for review.',
            },
            fund_release_evidence: {
                step: 'Final requirement',
                time: 'About 3 to 5 minutes',
                prepare: 'Any attachment that proves the fund was released',
                summary: 'Upload the proof of fund release. You remain an applicant until this final attachment is reviewed and verified.',
            },
        };

        return taskGuides[task.code] || {
            step: 'Application requirement',
            time: 'Usually 10 to 20 minutes',
            prepare: 'Your details and any files mentioned in the form',
            summary: 'Read the task title, review the note below, and complete the form carefully before submitting.',
        };
    }

    function renderFormErrorSummary(errors, taskCode) {
        const entries = Object.entries(errors || {});
        if (entries.length === 0) {
            return '';
        }

        return `
            <section class="post-approval-error-summary" id="postApprovalFormErrorSummary" role="alert" aria-live="polite">
                <h4>Naay kulang o sayop sa form submission</h4>
                <p>Kompletoha ang mosunod nga kinahanglanon aron ma-submit ang porma.</p>
                <ul>
                    ${entries.map(([field, message]) => `<li><strong>${escapeHtml(resolveFieldLabel(field, taskCode))}</strong>: ${escapeHtml(String(message || 'Required field.'))}</li>`).join('')}
                </ul>
            </section>
        `;
    }

    function resolveFieldLabel(field, taskCode) {
        const businessPlanLabels = {
            'overview.businessName': 'Ngalan sa negosyo / proyekto',
            'overview.ownerName': 'Ngalan sa entrepreneur',
            'overview.businessAddress': 'Business address',
            'overview.contactNumber': 'Contact number',
            'overview.businessGoal': 'Brief Profile of the Entrepreneur',
            'executiveSummary': 'Brief Description of the Business/Project',
            'productsServices.rows': 'Description of the Product',
            'marketStrategy.customerProfile': 'Primary Customers',
            'operationsPlan.productionProcess': 'Production / Service Process',
            'financialPlan.startupCapital': 'Project Cost',
            'implementationSchedule.rows': 'Pre-operating Activities',
            'applicantSignature.signedName': 'Ngalan sa mipirma',
            'applicantSignature.signedDate': 'Petsa sa pirma',
            'applicantSignature.signatureUpload': 'Pirma sa aplikante',
            'fundReleaseEvidence.releaseDate': 'Release date',
            'fundReleaseEvidence.notes': 'Applicant note',
            'fundReleaseEvidence.releaseAttachment': 'Proof of fund release attachment',
        };

        if (['business_plan', 'fund_release_evidence'].includes(taskCode) && businessPlanLabels[field]) {
            return businessPlanLabels[field];
        }

        return field;
    }

    function applyFieldErrors(errors) {
        const form = document.getElementById('postApprovalForm');
        if (!form) {
            return;
        }

        form.querySelectorAll('.is-field-error').forEach((element) => element.classList.remove('is-field-error'));

        Object.keys(errors || {}).forEach((field) => {
            const fieldNodes = Array.from(form.querySelectorAll(`[name="${cssEscape(field)}"]`));
            fieldNodes.forEach((node) => {
                node.classList.add('is-field-error');
                node.closest('.form-field, .bp-inline, .bp-textarea-wrap, .bp-product-card, .bp-schedule-wrap, .upload-field')?.classList.add('is-field-error');
                node.closest('details')?.setAttribute('open', '');
            });

            form.querySelector(`[data-error-group="${cssEscape(field)}"]`)?.classList.add('is-field-error');
        });
    }

    function isTaskEditable(task) {
        return !['Submitted', 'Verified', 'Locked'].includes(String(task?.status || ''));
    }

    function applyFormEditability(task) {
        const form = document.getElementById('postApprovalForm');
        if (!form) {
            return;
        }

        const editable = isTaskEditable(task);
        form.querySelectorAll('input, select, textarea, button').forEach((field) => {
            if (!(field instanceof HTMLElement)) {
                return;
            }

            if (field.id === 'postApprovalSubmitButton' || field.id === 'postApprovalSaveButton') {
                return;
            }

            if (field.matches('[data-row-action]')) {
                field.toggleAttribute('disabled', !editable);
                return;
            }

            if (field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement || field instanceof HTMLButtonElement) {
                const ownership = resolveElementOwnership(field);
                const applicantEditable = editable && ownership.owner === FIELD_OWNER_APPLICANT && ownership.editable;
                field.classList.toggle('is-staff-locked', ownership.owner === FIELD_OWNER_STAFF);

                if (field.hasAttribute('readonly') && ownership.owner === FIELD_OWNER_APPLICANT) {
                    return;
                }
                field.disabled = !applicantEditable;
            }
        });
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
            const error = new Error(payload.message || 'Request failed.');
            error.payload = payload;
            error.status = response.status;
            throw error;
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
        const overlay = document.getElementById('sidebarOverlay');
        const closeButton = document.getElementById('sidebarClose');
        if (!sidebar || !toggle) {
            return;
        }

        if (window.innerWidth > 960) {
            sidebar.classList.remove('is-open');
            document.body.classList.remove('drawer-open');
            toggle.setAttribute('aria-expanded', 'false');
            overlay?.classList.remove('is-visible');
            overlay?.setAttribute('aria-hidden', 'true');
            sidebar.removeAttribute('aria-modal');
            sidebar.removeAttribute('aria-hidden');
            closeButton?.setAttribute('tabindex', '-1');
            return;
        }

        const isOpen = sidebar.classList.contains('is-open');
        toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        overlay?.classList.toggle('is-visible', isOpen);
        overlay?.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        sidebar.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
        if (isOpen) {
            sidebar.setAttribute('aria-modal', 'true');
        } else {
            sidebar.removeAttribute('aria-modal');
        }
        document.body.classList.toggle('drawer-open', isOpen);
        closeButton?.setAttribute('tabindex', isOpen ? '0' : '-1');
    }

    function renderPaperValueLine(value, options = {}) {
        const classes = ['paper-fillline'];
        if (options.short) {
            classes.push('paper-fillline--short');
        }
        if (options.long) {
            classes.push('paper-fillline--long');
        }
        return `<span class="${classes.join(' ')}">${escapeHtml(value ?? '') || '&nbsp;'}</span>`;
    }

    function renderPaperStatementBlock(title, bodyHtml, signatureHtml = '') {
        return `
            <section class="paper-statement-block">
                <div class="paper-statement-head">
                    <h4>${escapeHtml(title)}</h4>
                </div>
                <div class="paper-statement-body">
                    ${bodyHtml}
                </div>
                ${signatureHtml ? `<div class="paper-statement-signature">${signatureHtml}</div>` : ''}
            </section>
        `;
    }

    function renderPaperSignatureArea(label, fieldsHtml) {
        return `
            <div class="paper-signature-area">
                <div class="paper-signature-line"></div>
                <div class="paper-signature-label">${escapeHtml(label)}</div>
                ${fieldsHtml ? `<div class="paper-signature-fields">${fieldsHtml}</div>` : ''}
            </div>
        `;
    }

    function renderPaperCertificationSentence(textHtml) {
        return `<p class="paper-certification-sentence">${textHtml}</p>`;
    }

    function renderPaperMobileStatement(title, description, contentHtml) {
        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>${escapeHtml(title)}</h4>
                    ${description ? `<p>${escapeHtml(description)}</p>` : ''}
                </div>
                <div class="post-approval-statement">
                    ${contentHtml}
                </div>
            </section>
        `;
    }

    function renderGovernmentPaperHeader(documentTitle = '', subtitle = '') {
        const safeTitle = String(documentTitle || '').trim();
        const safeSubtitle = String(subtitle || '').trim();
        return `
            <header class="paper-gov-header">
                <div class="paper-gov-header__logos">
                    <img src="${escapeAttribute(mungkahingAssetUrl('city-of-butuan-logo.png'))}" alt="City of Butuan" class="paper-gov-header__logo">
                    <div class="paper-gov-header__copy">
                        <div>Republic of the Philippines</div>
                        <strong>CITY GOVERNMENT OF BUTUAN</strong>
                        <div>City Social Welfare and Development Department</div>
                        <div>J.P. Rosales Ave., Tandang Sora, Butuan City</div>
                    </div>
                    <img src="${escapeAttribute(mungkahingAssetUrl('dswd-logo.png'))}" alt="CSWDD" class="paper-gov-header__logo paper-gov-header__logo--right">
                </div>
                <div class="paper-gov-header__bar"></div>
                ${safeTitle ? `<div class="paper-gov-header__title">${escapeHtml(safeTitle)}</div>` : ''}
                ${safeSubtitle ? `<div class="paper-gov-header__subtitle">${escapeHtml(safeSubtitle)}</div>` : ''}
            </header>
        `;
    }

    function renderGovernmentPaperFooter(pageNumber, totalPages) {
        return `
            <div class="page-no">Page ${pageNumber} of ${totalPages}</div>
            <footer class="footer">
                <div class="footer-left">
                    <div><strong>Phone:</strong> &nbsp;&nbsp; +639562241679 / +639816016317</div>
                    <div><strong>Email:</strong> &nbsp;&nbsp; cswdobutuan@gmail.com</div>
                    <div><strong>Website:</strong> &nbsp; http://www.butuan.gov.ph</div>
                </div>
                <div class="footer-right">
                    <img src="${escapeAttribute(mungkahingAssetUrl('butuanon-logo.png'))}" alt="ButuanON logo">
                </div>
            </footer>
        `;
    }

    function renderGovernmentPaperTopStrip() {
        return `
            <header class="top-strip">
                <img src="${escapeAttribute(mungkahingAssetUrl('city-of-butuan-logo.png'))}" alt="City of Butuan Official Seal" class="logo logo-left">
                <div class="gov-header">
                    <div class="small">Republic of the Philippines</div>
                    <div class="big">CITY GOVERNMENT OF BUTUAN</div>
                    <div class="dept">City Social Welfare and Development Department</div>
                    <div class="addr">J.P. Rosales Ave., Tandang Sora, Butuan City</div>
                    <div class="blue-bar"></div>
                </div>
                <img src="${escapeAttribute(mungkahingAssetUrl('dswd-logo.png'))}" alt="CSWDD Logo" class="logo logo-right">
            </header>
        `;
    }

    function renderGovernmentPaperTitleBlock(title, subtitle) {
        return `
            <div class="title-wrap">
                <div class="title-main">${escapeHtml(title)}</div>
                <div class="title-sub">${escapeHtml(subtitle)}</div>
            </div>
        `;
    }

    function renderAvailmentDesktop(payload) {
        const data = payload || {};
        const staff = data.staffReview || {};
        const pageOneCertification = staff.pageOneCertification || {};
        const physical = staff.physicalRequirements || {};
        const food = physical.foodRelatedCertification || {};
        const psycho = staff.psychoSocialRequirements || {};
        const residency = psycho.residencyAndCharacter || {};
        const relationships = psycho.familyRelationshipsWorkHabitsAspiration || {};
        const commitments = data.clientCommitment || {};
        const agreedToRollBackSchedule = Boolean(commitments.agreedToRollBackSchedule ?? commitments.agreedToSavingsCommitment);
        const agreedToWeeklySavings = Boolean(commitments.agreedToWeeklySavings ?? commitments.agreedToSavingsCommitment);
        const familyMembers = Array.isArray(data.familyEnterprise?.members) && data.familyEnterprise.members.length > 0
            ? data.familyEnterprise.members
            : [{ name: '', age: '', activities: '' }];
        const incomeRows = Array.isArray(data.incomeEligibility?.rows) && data.incomeEligibility.rows.length > 0
            ? data.incomeEligibility.rows
            : [{ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' }];
        const healthRows = Array.isArray(physical.healthAgeRows) && physical.healthAgeRows.length > 0
            ? physical.healthAgeRows
            : [{ requirement: '', age: '', healthStatus: '' }];
        return `
            <div class="paper-document paper-document--availment">
                <section class="paper-sheet paper-sheet--govform">
                    ${renderGovernmentPaperHeader('SMART LEAP AVAILMENT FORM', 'CITY SOCIAL WELFARE AND DEVELOPMENT DEPARTMENT')}
                    <div class="paper-gov-cityline">City: Butuan City</div>
                    <section class="paper-page-section">
                        ${renderMungkahingPaperSectionTitle('I.', 'CLIENT IDENTIFYING DATA:')}
                        <div class="paper-line-grid paper-line-grid--two paper-line-grid--govform">
                            ${renderMungkahingLineField('Name', 'clientIdentifyingData.name', data.clientIdentifyingData?.name || '', 'text')}
                            ${renderMungkahingLineField('Age', 'clientIdentifyingData.age', data.clientIdentifyingData?.age || '', 'number')}
                            ${renderMungkahingLineField('Address', 'clientIdentifyingData.address', data.clientIdentifyingData?.address || '', 'text')}
                            ${renderMungkahingLineField('Name of Spouse', 'clientIdentifyingData.spouseName', data.clientIdentifyingData?.spouseName || '', 'text')}
                        </div>
                    </section>
                    <section class="paper-page-section">
                        ${renderMungkahingPaperSectionTitle('II.', 'TYPE OF PROJECT:')}
                        <div class="paper-page-subtitle paper-page-subtitle--plain">A. Family Enterprise:</div>
                        ${renderDocumentFamilyTable(familyMembers, { paperMode: true })}
                        <div class="paper-page-subtitle paper-page-subtitle--plain">B. Individual Assistance:</div>
                        <div class="paper-line-grid paper-line-grid--two paper-line-grid--govform">
                            ${renderMungkahingLineField('Clientele Category', 'individualAssistance.clienteleCategory', data.individualAssistance?.clienteleCategory || '', 'text')}
                            ${renderMungkahingLineField('Nature of difficult circumstances', 'individualAssistance.natureOfDifficultCircumstances', data.individualAssistance?.natureOfDifficultCircumstances || '', 'text')}
                        </div>
                        <div class="paper-gov-certification">
                            I certify that
                            ${renderPaperValueLine(pageOneCertification.eligibilityStatementName || data.clientIdentifyingData?.name || '', { long: true })}
                            is eligible to avail the Sustainable Market and Technology Driven Livelihood and Employment Assistance Program (SMART LEAP) based on the assessment.
                        </div>
                        <div class="paper-signature-table paper-signature-table--compact">
                            <div class="paper-signature-row paper-signature-row--staff">
                                <div class="paper-signature-row__label">Direct Worker</div>
                                <div class="paper-signature-row__body">
                                    ${renderDocumentField('Direct worker name', 'staffReview.pageOneCertification.directWorkerName', pageOneCertification.directWorkerName || '', 'text')}
                                    ${renderDocumentField('Direct worker title', 'staffReview.pageOneCertification.directWorkerTitle', pageOneCertification.directWorkerTitle || '', 'text')}
                                    ${renderDocumentField('Date signed', 'staffReview.pageOneCertification.signedDate', pageOneCertification.signedDate || '', 'date')}
                                    ${renderDocumentUpload('Direct worker signature upload', 'pageOneCertification.signatureUpload', pageOneCertification.signatureUpload || null)}
                                </div>
                            </div>
                        </div>
                    </section>
                    <section class="paper-page-section">
                        ${renderMungkahingPaperSectionTitle('III.', 'INCOME ELIGIBILITY REQUIREMENT:')}
                        ${renderDocumentIncomeTable(incomeRows, data.incomeEligibility?.totalFamilyIncome || '', { paperMode: true })}
                    </section>
                    ${renderGovernmentPaperFooter(1, 2)}
                </section>

                <section class="paper-sheet paper-sheet--govform">
                    ${renderGovernmentPaperHeader()}
                    <section class="paper-page-section">
                        ${renderMungkahingPaperSectionTitle('IV.', 'PHYSICAL REQUIREMENTS')}
                        <div class="paper-page-subtitle paper-page-subtitle--plain">A. Health Age Requirements</div>
                        ${renderDocumentHealthTable(healthRows)}
                        <div class="paper-page-subtitle paper-page-subtitle--plain">Food Related Projects:</div>
                        <div class="paper-gov-certification">
                            I certify that
                            ${renderPaperValueLine(food.applicantName || '', { long: true })}
                            has undergone medical check-up and is physically fit to run a food related projects.
                        </div>
                        <div class="paper-signature-table paper-signature-table--compact">
                            <div class="paper-signature-row paper-signature-row--staff">
                                <div class="paper-signature-row__label">Name and Signature of Certifying Officer</div>
                                <div class="paper-signature-row__body">
                                    ${renderDocumentField('Certifying officer name', 'staffReview.physicalRequirements.foodRelatedCertification.certifyingOfficerName', food.certifyingOfficerName || '', 'text')}
                                    ${renderDocumentField('Officer title', 'staffReview.physicalRequirements.foodRelatedCertification.certifyingOfficerTitle', food.certifyingOfficerTitle || '', 'text')}
                                    ${renderDocumentField('Date signed', 'staffReview.physicalRequirements.foodRelatedCertification.signedDate', food.signedDate || '', 'date')}
                                    ${renderDocumentUpload('Certifying officer signature upload', 'physicalRequirements.foodRelatedCertification.signatureUpload', food.signatureUpload || null)}
                                </div>
                            </div>
                        </div>
                    </section>
                    <section class="paper-page-section">
                        ${renderMungkahingPaperSectionTitle('V.', 'PSYCHO-SOCIAL REQUIREMENTS:')}
                        <div class="paper-page-subtitle paper-page-subtitle--plain">A. Residency and Character (for barangay captain, parish priest, etc.)</div>
                        <div class="paper-gov-certification">
                            I certify that
                            ${renderPaperValueLine(residency.residentName || '', { long: true })}
                            a bona fide resident of the barangay and is of good moral character and has no adverse reputation.
                        </div>
                        <div class="paper-signature-table paper-signature-table--compact">
                            <div class="paper-signature-row paper-signature-row--staff">
                                <div class="paper-signature-row__label">Name and Signature of Certifying Officer</div>
                                <div class="paper-signature-row__body">
                                    ${renderDocumentField('Certifying officer name', 'staffReview.psychoSocialRequirements.residencyAndCharacter.certifyingOfficerName', residency.certifyingOfficerName || '', 'text')}
                                    ${renderDocumentField('Officer title', 'staffReview.psychoSocialRequirements.residencyAndCharacter.certifyingOfficerTitle', residency.certifyingOfficerTitle || '', 'text')}
                                    ${renderDocumentField('Date signed', 'staffReview.psychoSocialRequirements.residencyAndCharacter.signedDate', residency.signedDate || '', 'date')}
                                    ${renderDocumentUpload('Certifying officer signature upload', 'psychoSocialRequirements.residencyAndCharacter.signatureUpload', residency.signatureUpload || null)}
                                </div>
                            </div>
                        </div>
                        <div class="paper-page-subtitle paper-page-subtitle--plain">B. Family Relationships, Work Habits, Aspirations</div>
                        <div class="paper-gov-certification">
                            I certify that through personal interview, home visit and collateral interview I have verified that
                            ${renderPaperValueLine(relationships.applicantName || '', { long: true })}
                            manifest positive relationships, good work habits and attitude as well as demonstrated capacity and adequate level of economic aspiration.
                        </div>
                        <div class="paper-signature-table paper-signature-table--compact">
                            <div class="paper-signature-row paper-signature-row--staff">
                                <div class="paper-signature-row__label">Name and Signature of Direct Worker</div>
                                <div class="paper-signature-row__body">
                                    ${renderDocumentField('Direct worker name', 'staffReview.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.directWorkerName', relationships.directWorkerName || '', 'text')}
                                    ${renderDocumentField('Direct worker title', 'staffReview.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.directWorkerTitle', relationships.directWorkerTitle || '', 'text')}
                                    ${renderDocumentField('Date signed', 'staffReview.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.signedDate', relationships.signedDate || '', 'date')}
                                    ${renderDocumentUpload('Direct worker signature upload', 'psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.signatureUpload', relationships.signatureUpload || null)}
                                </div>
                            </div>
                        </div>
                        <div class="paper-signature-table paper-signature-table--compact">
                            <div class="paper-signature-row">
                                <div class="paper-signature-row__label">Name and Signature of Participant</div>
                                <div class="paper-signature-row__body">
                                    ${renderDocumentField('Participant signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                                    ${renderDocumentField('Date signed', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                                    ${renderDocumentUpload('Participant signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                                </div>
                            </div>
                        </div>
                    </section>
                    ${renderGovernmentPaperFooter(2, 2)}
                </section>
            </div>
        `;
    }

    function renderValidationDesktop(payload) {
        const data = payload || {};
        const checklist = data.membershipChecklist || {};
        const recommendation = data.staffReview?.validatorRecommendation || {};
        const eligibility = data.staffReview?.eligibilityAssessment || {};
        const identity = data.staffReview?.validatorIdentity || {};
        const applicantDetails = data.applicantDetails || {};
        const applicantName = deriveApplicantName(data);

        return `
            <div class="paper-document paper-document--validation">
                <section class="paper-sheet paper-sheet--govform paper-sheet--validation paper-sheet--govpage">
                    ${renderGovernmentPaperTopStrip()}
                    ${renderGovernmentPaperTitleBlock(
                        'VALIDATION FORM',
                        'Sustainable Market and Technology and Employment Assistance Program (SMART LEAP)'
                    )}
                    <section class="paper-page-section">
                        <div class="paper-line-grid paper-line-grid--govform paper-line-grid--validation-date">
                            ${renderMungkahingLineField('Date of Validation', 'applicantDetails.validationDate', applicantDetails.validationDate || '', 'date')}
                        </div>
                        <div class="paper-validation-lines">
                            <div class="paper-validation-name-row">
                                <span class="paper-validation-label">Name:</span>
                                ${renderMungkahingLineField('Last Name', 'applicantDetails.lastName', applicantDetails.lastName || '', 'text')}
                                ${renderMungkahingLineField('First Name', 'applicantDetails.firstName', applicantDetails.firstName || '', 'text')}
                                ${renderMungkahingLineField('Middle Name', 'applicantDetails.middleName', applicantDetails.middleName || '', 'text')}
                            </div>
                            <div class="paper-validation-meta-row">
                                ${renderMungkahingLineField('Address: Purok', 'applicantDetails.purok', applicantDetails.purok || '', 'text')}
                                ${renderMungkahingLineField('Barangay', 'applicantDetails.barangay', applicantDetails.barangay || '', 'text')}
                            </div>
                            <div class="paper-validation-meta-row">
                                ${renderMungkahingLineField('Birthday', 'applicantDetails.birthdate', applicantDetails.birthdate || '', 'date')}
                                ${renderMungkahingLineField('Educational Attainment', 'applicantDetails.educationalAttainment', applicantDetails.educationalAttainment || '', 'text')}
                            </div>
                            <div class="paper-validation-contact-row">
                                ${renderMungkahingLineField('Contact number', 'applicantDetails.contactNumber', applicantDetails.contactNumber || '', 'text')}
                            </div>
                        </div>
                    </section>
                    <section class="paper-page-section">
                        ${renderValidationChecklistTable(checklist, { paperMode: true })}
                    </section>
                    <section class="paper-page-section">
                        <div class="paper-validation-inline-label">Validator's Recommendation:</div>
                        <div class="paper-validation-recommendation">
                            <textarea class="paper-validation-lines-input" name="staffReview.validatorRecommendation.recommendationText" data-field-owner="staff" data-field-ref="staffReview.validatorRecommendation.recommendationText" rows="3" disabled>${escapeHtml(recommendation.recommendationText || '')}</textarea>
                        </div>
                    </section>
                    <section class="paper-page-section paper-page-section--validation-closing">
                        <div class="paper-gov-certification paper-gov-certification--validation">
                            Ako si
                            ${renderPaperValueLine(eligibility.residentName || data.participantSignature?.signedName || '', { long: true })}
                            ,
                            ${renderPaperValueLine(eligibility.age || '', { short: true })}
                            anyos, lumulupyo sa Barangay
                            ${renderPaperValueLine(eligibility.barangay || applicantDetails.barangay || '', { long: true })}
                            , Butuan City, Agusan Del Norte. Ako nakasabot sa tumong ug proseso niining Livelihood Assistance kung diin ako
                            ${renderPaperInlineChoiceField('staffReview.eligibilityAssessment.eligibilityDecision', eligibility.eligibilityDecision || '', ['ANGAYAN', 'DILI ANGAYAN'], false, true)}
                            mamahimong benepisyo sa among program nga gidumala sa SMART LEAP ng City Social Welfare and Development Department (CSWDD).
                        </div>
                        <div class="paper-validation-signatures">
                            <div class="paper-validation-signature">
                                ${renderApplicantSignatureStamp(applicantName, 'participantSignature.signatureUpload', data.participantSignature?.signatureUpload || null)}
                            </div>
                            <div class="paper-validation-signature">
                                <div class="paper-validation-signature__line"></div>
                                <div class="paper-validation-signature__label">Ngalan/Perma sa Validator</div>
                            </div>
                        </div>
                    </section>
                    ${renderGovernmentPaperFooter(1, 1)}
                </section>
            </div>
        `;
    }

    function renderAvailmentMobile(payload) {
        const data = payload || {};
        const commitments = data.clientCommitment || {};
        const agreedToRollBackSchedule = Boolean(commitments.agreedToRollBackSchedule ?? commitments.agreedToSavingsCommitment);
        const agreedToWeeklySavings = Boolean(commitments.agreedToWeeklySavings ?? commitments.agreedToSavingsCommitment);
        const familyMembers = Array.isArray(data.familyEnterprise?.members) && data.familyEnterprise.members.length > 0
            ? data.familyEnterprise.members
            : [{ name: '', age: '', activities: '' }];
        const incomeRows = Array.isArray(data.incomeEligibility?.rows) && data.incomeEligibility.rows.length > 0
            ? data.incomeEligibility.rows
            : [{ memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' }];

        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>I. Client Identifying Data</h4>
                    <p>Same content and order as desktop, arranged vertically for mobile.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Name', 'clientIdentifyingData.name', data.clientIdentifyingData?.name || '', 'text')}
                    ${renderField('Age', 'clientIdentifyingData.age', data.clientIdentifyingData?.age || '', 'number')}
                    ${renderField('Address', 'clientIdentifyingData.address', data.clientIdentifyingData?.address || '', 'text', true)}
                    ${renderField('Name of spouse', 'clientIdentifyingData.spouseName', data.clientIdentifyingData?.spouseName || '', 'text', true)}
                    ${renderReadOnlyField('City', 'Butuan City')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>II. Type of Project</h4>
                    <p>A. Family Enterprise</p>
                </div>
                <div class="post-approval-repeatable" data-repeatable="familyMembers">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">Family members participating</span>
                        <button type="button" class="btn-outline small" data-row-action="add-family">Add family member</button>
                    </div>
                    ${familyMembers.map((row, index) => renderFamilyMemberRow(row, index)).join('')}
                </div>
                <div class="post-approval-subsection">
                    <h5>B. Individual Assistance</h5>
                    <div class="post-approval-fields">
                        ${renderField('Clientele category', 'individualAssistance.clienteleCategory', data.individualAssistance?.clienteleCategory || '', 'text')}
                        ${renderTextarea('Nature of difficult circumstances', 'individualAssistance.natureOfDifficultCircumstances', data.individualAssistance?.natureOfDifficultCircumstances || '', true)}
                    </div>
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>III. Income Eligibility Requirement</h4>
                    <p>Same content as desktop, stacked for smaller screens.</p>
                </div>
                <div class="post-approval-repeatable" data-repeatable="incomeRows">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">Monthly income rows</span>
                        <button type="button" class="btn-outline small" data-row-action="add-income">Add income row</button>
                    </div>
                    ${incomeRows.map((row, index) => renderIncomeRow(row, index)).join('')}
                </div>
                <div class="post-approval-fields">
                    ${renderField('Total family income', 'incomeEligibility.totalFamilyIncome', data.incomeEligibility?.totalFamilyIncome || '', 'number')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>IV. Social Responsibility and willingness to save (client)</h4>
                    <p>Applicant commitment block only.</p>
                </div>
                ${renderPaperMobileStatement(
                    'C. Social Responsibility and willingness to save (client)',
                    '',
                    `
                        <p>I will abide by all the policies and guidelines set by CSWDD for the SMART LEAP and I promise to pay the roll-back at the time stipulated and to generate weekly savings to meet emergencies that may affect my family.</p>
                        <div class="post-approval-fields">
                            ${renderField('Participant signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                            ${renderField('Date signed', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                            ${renderUploadField('Participant signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                        </div>
                    `
                )}
            </section>
        `;
    }

    function renderValidationMobile(payload) {
        const data = payload || {};
        const checklist = data.membershipChecklist || {};
        const recommendation = data.staffReview?.validatorRecommendation || {};
        const eligibility = data.staffReview?.eligibilityAssessment || {};
        const identity = data.staffReview?.validatorIdentity || {};

        return `
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Validation Form</h4>
                    <p>Same section order and content as desktop, arranged vertically for phone screens.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Date of validation', 'applicantDetails.validationDate', data.applicantDetails?.validationDate || '', 'date')}
                    ${renderField('Last name', 'applicantDetails.lastName', data.applicantDetails?.lastName || '', 'text')}
                    ${renderField('First name', 'applicantDetails.firstName', data.applicantDetails?.firstName || '', 'text')}
                    ${renderField('Middle name', 'applicantDetails.middleName', data.applicantDetails?.middleName || '', 'text')}
                    ${renderField('Purok', 'applicantDetails.purok', data.applicantDetails?.purok || '', 'text')}
                    ${renderField('Barangay', 'applicantDetails.barangay', data.applicantDetails?.barangay || '', 'text')}
                    ${renderField('Birthdate', 'applicantDetails.birthdate', data.applicantDetails?.birthdate || '', 'date')}
                    ${renderField('Educational attainment', 'applicantDetails.educationalAttainment', data.applicantDetails?.educationalAttainment || '', 'text')}
                    ${renderField('Contact number', 'applicantDetails.contactNumber', data.applicantDetails?.contactNumber || '', 'text')}
                </div>
            </section>
            <section class="post-approval-section">
                <div class="post-approval-section__header">
                    <h4>Checklist</h4>
                    <p>Same checklist items as desktop, stacked for mobile.</p>
                </div>
                <div class="post-approval-checklist">
                    <div class="post-approval-checklist__row">
                        <strong>Pantawid Member</strong>
                        ${renderSelectField('Response', 'membershipChecklist.pantawidMember', checklist.pantawidMember || '', ['', 'Yes', 'No'])}
                        ${renderField('Specify', 'membershipChecklist.pantawidSpecify', checklist.pantawidSpecify || '', 'text')}
                    </div>
                    <div class="post-approval-checklist__row">
                        <strong>SLPA Member</strong>
                        ${renderSelectField('Response', 'membershipChecklist.slpaMember', checklist.slpaMember || '', ['', 'Yes', 'No'])}
                        ${renderField('Specify', 'membershipChecklist.slpaSpecify', checklist.slpaSpecify || '', 'text')}
                    </div>
                </div>
            </section>
            ${renderPaperMobileStatement(
                `Validator's Recommendation`,
                '',
                `${renderReadOnlyField('Recommendation', recommendation.recommendationText || '')}`
            )}
            ${renderPaperMobileStatement(
                'Eligibility Assessment',
                '',
                `
                    <p>Ako si <strong>${escapeHtml(eligibility.residentName || '--')}</strong>, <strong>${escapeHtml(eligibility.age || '--')}</strong> anyos, lumulupyo sa Barangay <strong>${escapeHtml(eligibility.barangay || '--')}</strong>, Butuan City, Agusan Del Norte. Ako nakasabot sa tumong ug proseso niining Livelihood Assistance kung diin ako <strong>${escapeHtml(eligibility.eligibilityDecision || '--')}</strong> (ANGAYAN/DILI ANGAYAN) mamahimong benepisyo sa among program nga gidumala sa SMART LEAP ng City Social Welfare and Development Department (CSWDD).</p>
                    <div class="post-approval-fields">
                        ${renderReadOnlyField('Understands assistance process', eligibility.understandsAssistanceProcess || '')}
                        ${renderReadOnlyField('Assistance process understanding', eligibility.assistanceProcessUnderstanding || '')}
                        ${renderField('Participant signed name', 'participantSignature.signedName', data.participantSignature?.signedName || '', 'text')}
                        ${renderField('Date signed', 'participantSignature.signedDate', data.participantSignature?.signedDate || '', 'date')}
                        ${renderUploadField('Participant signature upload', 'participantSignature.signatureUpload', data.participantSignature?.signatureUpload || null)}
                        ${renderReadOnlyField('Validator name', identity.validatorName || '')}
                        ${renderReadOnlyField('Validator title', identity.validatorTitle || '')}
                        ${renderReadOnlyField('Validator signed date', identity.signedDate || '')}
                        ${renderUploadField('Validator signature upload', 'validatorIdentity.signatureUpload', identity.signatureUpload || null, true)}
                    </div>
                `
            )}
        `;
    }

    function renderMungkahingMobile(payload) {
        const data = payload || {};
        const project = data.projectInformation || {};
        const sectoral = data.sectoralClassification || {};
        const pantawid = sectoral.pantawid || {};
        const nonPantawid = sectoral.nonPantawid || {};
        const modalityRows = ensureRows(data.modalityApplications?.rows, { fundSource: '', contributionType: '', amount: '' });
        const materialsRows = ensureRows(data.businessOperation?.materials?.rows, { material: '', quality: '', unit: '', unitPrice: '', cyclesPerProduction: '', projectedCost: '' });
        const laborRows = ensureRows(data.businessOperation?.labor?.rows, { workerName: '', position: '', dailyWage: '' });
        const equipmentRows = ensureRows(data.businessOperation?.toolsEquipment?.rows, { equipment: '', capacity: '', unit: '', quantityOrPrice: '', projectedAmount: '', usefulLifeDays: '', productionCycle: '', depreciationCost: '' });
        const expenseRows = ensureMungkahingExpenseRows(data.businessOperation?.operatingExpenses?.rows);
        const salesRows = ensureRows(data.businessOperation?.salesProjection?.rows, { product: '', capacity: '', unit: '', sellingPrice: '', projectedSales: '' });
        const spendingRows = ensureRows(data.spendingPlan?.rows, { expense: '', amount: '', usageSchedule: '' });
        const income = data.businessOperation?.incomeComputation || {};

        return `
            <section class="post-approval-section post-approval-section--mungkahing">
                <div class="post-approval-section__header">
                    <h4>I. Kinatibuk-an Impormasyon Bahin sa Proyekto</h4>
                    <p>Kinatibuk-ang detalye sa partisipante ug sa proyekto.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Ngalan sa Partisipante', 'projectInformation.participantName', project.participantName || '', 'text')}
                    ${renderField('Lokasyon sa Proyekto', 'projectInformation.projectLocation', project.projectLocation || '', 'text')}
                    ${renderField('Ulohan sa Proyektong MD', 'projectInformation.projectTitle', project.projectTitle || '', 'text', true)}
                    ${renderField('Petsa sa Pagtukod', 'projectInformation.projectDate', project.projectDate || '', 'date')}
                    ${renderField('Kinatibuk-ang Kantidad', 'projectInformation.projectedAmount', project.projectedAmount || '', 'number')}
                    ${renderField('Kantidad gikan sa CSWDD', 'projectInformation.cswddAmount', project.cswddAmount || '', 'number')}
                    ${renderField('Laing kakuhaon sa pondo', 'projectInformation.otherFundingSource', project.otherFundingSource || '', 'text', true)}
                    ${renderField('Savings Account No.', 'projectInformation.savingsAccountNumber', project.savingsAccountNumber || 'NONE', 'text')}
                </div>
            </section>
            <section class="post-approval-section post-approval-section--mungkahing">
                <div class="post-approval-section__header">
                    <h4>Sectoral</h4>
                    <p>Pilia kung Pantawid o Non-Pantawid, dayon pilia ang hustong sex o sectoral classification.</p>
                </div>
                ${renderMungkahingMobileSectorSelectors(sectoral)}
            </section>
            <section class="post-approval-section post-approval-section--mungkahing">
                <div class="post-approval-section__header">
                    <h4>II. Rationale of the Proposed Project</h4>
                    <p>Rason ug katuyoan sa mungkahing proyekto.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderTextarea('Project rationale', 'rationale', data.rationale || '', true)}
                </div>
            </section>
            ${renderMungkahingMobileRowsSection('III. Detalye sa Modality Application/s', 'Pondo nga gi-ambag sa mga partner/s', modalityRows, 'add-mp-contribution', renderMungkahingContributionRow)}
            ${renderMungkahingMobileRowsSection('IV.a Mga gikinahanglan nga Materyales', 'Mga gikinahanglan nga materyales', materialsRows, 'add-mp-material', renderMungkahingMaterialRow)}
            ${renderMungkahingMobileTotalSection('IV.a Kinatibuk-ang Total', renderField('Kinatibuk-ang Total', 'businessOperation.materials.totalCost', data.businessOperation?.materials?.totalCost || '', 'number'))}
            ${renderMungkahingMobileRowsSection('IV.b Mga gikinahanglan na Trabahante', 'Mga trabahanteng kinahanglanon', laborRows, 'add-mp-labor', renderMungkahingLaborRow)}
            ${renderMungkahingMobileTotalSection('IV.b Kinatibuk-ang suweldo', `
                ${renderField('Kinatibuk-an na inadlaw na suweldo', 'businessOperation.labor.totalDailyWage', data.businessOperation?.labor?.totalDailyWage || '', 'number')}
                ${renderField('Kinatibuk-an na suweldo base sa siglo sa produksyon', 'businessOperation.labor.totalProductionCycleWage', data.businessOperation?.labor?.totalProductionCycleWage || '', 'number')}
            `)}
            ${renderMungkahingMobileRowsSection('IV.c Mga Gikinahanglan nga Kagamitan', 'Mga kagamitan ug depreciation', equipmentRows, 'add-mp-equipment', renderMungkahingEquipmentRow)}
            ${renderMungkahingMobileTotalSection('IV.c Kinatibuk-ang Total', renderField('Kinatibuk-ang Total', 'businessOperation.toolsEquipment.totalCost', data.businessOperation?.toolsEquipment?.totalCost || '', 'number'))}
            ${renderMungkahingMobileFixedExpenseSection(expenseRows, data.businessOperation?.operatingExpenses?.grandTotal || '')}
            ${renderMungkahingMobileRowsSection('IV.e Pangunahing kita gikan sa puhunan alang sa mga sangkap', 'Mga produkto ug kita sa pagpamaligya', salesRows, 'add-mp-sale', renderMungkahingSalesRow)}
            ${renderMungkahingMobileTotalSection('IV.e Gross Sales', renderField('Gross Sales', 'businessOperation.salesProjection.grossSales', data.businessOperation?.salesProjection?.grossSales || '', 'number'))}
            <section class="post-approval-section post-approval-section--mungkahing">
                <div class="post-approval-section__header">
                    <h4>IV.f Kinatibuk-ang kita sa matag produkto o paghimo sa serbisyo</h4>
                    <p>Kinatibuk-ang komputasyon sa kita ug gasto.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Gilauman nga kita alang sa usa ka "siklo sa produksyon"', 'businessOperation.incomeComputation.projectedIncomePerCycle', income.projectedIncomePerCycle || '', 'number')}
                    ${renderField('Mga materyales (raw materials)', 'businessOperation.incomeComputation.rawMaterialsCost', income.rawMaterialsCost || '', 'number')}
                    ${renderField('Gikinahanglan na manpower ug labor', 'businessOperation.incomeComputation.manpowerLaborCost', income.manpowerLaborCost || '', 'number')}
                    ${renderField('Depreciation Cost', 'businessOperation.incomeComputation.depreciationCost', income.depreciationCost || '', 'number')}
                    ${renderField('Uban pang mga Gasto', 'businessOperation.incomeComputation.otherExpenses', income.otherExpenses || '', 'number')}
                    ${renderField('Kinatibuk-ang gasto sa pag-operate', 'businessOperation.incomeComputation.totalOperatingCost', income.totalOperatingCost || '', 'number')}
                    ${renderField('Kinatibuk-ang ginansya human sa gasto sa operasyon (Gross Profit)', 'businessOperation.incomeComputation.grossProfit', income.grossProfit || '', 'number')}
                    ${renderField('Net profit', 'businessOperation.incomeComputation.netProfit', income.netProfit || '', 'number')}
                </div>
            </section>
            ${renderMungkahingMobileRowsSection('IV.g Iskedyul o Plano sa Paggasto sa SEA-K Capital Fund', 'Spending plan rows', spendingRows, 'add-mp-spending', renderMungkahingSpendingRow)}
            <section class="post-approval-section post-approval-section--mungkahing">
                <div class="post-approval-section__header">
                    <h4>V. Pirma sa Partisipante</h4>
                    <p>Ibutang ang pirma sa partisipante alang sa proposal package.</p>
                </div>
                <div class="post-approval-fields">
                    ${renderField('Pangalan nga gipirmahan', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderField('Petsa sa pagpirma', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Upload sa pirma sa partisipante', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            </section>
        `;
    }

    function renderMungkahingMobileSectorCard(title, keyPrefix, values) {
        return `
            <article class="post-approval-subsection post-approval-subsection--sectoral">
                <div class="post-approval-subsection__head">
                    <h5>${escapeHtml(title)}</h5>
                    <span class="post-approval-subsection__meta">Sex ug sectoral</span>
                </div>
                <div class="post-approval-chipgrid">
                    ${renderDocumentCheckbox('Babaye', `${keyPrefix}.sexFemale`, values.sexFemale)}
                    ${renderDocumentCheckbox('Lalake', `${keyPrefix}.sexMale`, values.sexMale)}
                    ${renderDocumentCheckbox('Senior Citizen - Babaye', `${keyPrefix}.seniorFemale`, values.seniorFemale)}
                    ${renderDocumentCheckbox('Senior Citizen - Lalake', `${keyPrefix}.seniorMale`, values.seniorMale)}
                    ${renderDocumentCheckbox('PWD - Babaye', `${keyPrefix}.pwdFemale`, values.pwdFemale)}
                    ${renderDocumentCheckbox('PWD - Lalake', `${keyPrefix}.pwdMale`, values.pwdMale)}
                    ${renderDocumentCheckbox('IP - Babaye', `${keyPrefix}.ipFemale`, values.ipFemale)}
                    ${renderDocumentCheckbox('IP - Lalake', `${keyPrefix}.ipMale`, values.ipMale)}
                    ${renderDocumentCheckbox('Solo Parent - Babaye', `${keyPrefix}.soloParentFemale`, values.soloParentFemale)}
                    ${renderDocumentCheckbox('Solo Parent - Lalake', `${keyPrefix}.soloParentMale`, values.soloParentMale)}
                </div>
            </article>
        `;
    }

    function renderMungkahingMobileSectorSelectors(sectoral) {
        const selection = resolveMungkahingMobileSectorSelection(sectoral);
        return `
            <div class="post-approval-fields" data-mungkahing-mobile-sector>
                <label class="form-field">
                    <span>Paglain-lain</span>
                    <select data-mp-sector-group>
                        <option value="">Pilia</option>
                        ${MUNGKAHING_SECTOR_GROUPS.map((group) => `
                            <option value="${escapeAttribute(group.key)}" ${selection.group === group.key ? 'selected' : ''}>${escapeHtml(group.label)}</option>
                        `).join('')}
                    </select>
                </label>
                <label class="form-field">
                    <span>Sex / Sectoral</span>
                    <select data-mp-sector-classification>
                        <option value="">Pilia</option>
                        ${MUNGKAHING_SECTOR_DEFINITIONS.map((option) => `
                            <option value="${escapeAttribute(option.key)}" ${selection.classification === option.key ? 'selected' : ''}>${escapeHtml(option.label)}</option>
                        `).join('')}
                    </select>
                </label>
                <div hidden>
                    ${renderMungkahingMobileSectorHiddenInputs(selection.group, selection.classification)}
                </div>
            </div>
        `;
    }

    function renderMungkahingMobileSectorHiddenInputs(selectedGroup, selectedClassification) {
        return MUNGKAHING_SECTOR_GROUPS.map((group) => MUNGKAHING_SECTOR_DEFINITIONS.map((definition) => {
            const checked = selectedGroup === group.key && selectedClassification === definition.key;
            const name = `sectoralClassification.${group.key}.${definition.key}`;
            return `<input type="checkbox" name="${escapeAttribute(name)}" ${checked ? 'checked' : ''}>`;
        }).join('')).join('');
    }

    function resolveMungkahingMobileSectorSelection(sectoral) {
        const source = sectoral || {};
        for (const group of MUNGKAHING_SECTOR_GROUPS) {
            const values = source[group.key] || {};
            for (const definition of MUNGKAHING_SECTOR_DEFINITIONS) {
                if (Boolean(values[definition.key])) {
                    return { group: group.key, classification: definition.key };
                }
            }
        }

        return { group: '', classification: '' };
    }

    function handleMungkahingMobileSectorChange(event) {
        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) {
            return;
        }

        const wrapper = target.closest('[data-mungkahing-mobile-sector]');
        if (!wrapper) {
            return;
        }

        const groupSelect = wrapper.querySelector('[data-mp-sector-group]');
        const classificationSelect = wrapper.querySelector('[data-mp-sector-classification]');
        if (!(groupSelect instanceof HTMLSelectElement) || !(classificationSelect instanceof HTMLSelectElement)) {
            return;
        }

        const selectedGroup = MUNGKAHING_SECTOR_GROUPS.some((group) => group.key === groupSelect.value) ? groupSelect.value : '';
        const selectedClassification = MUNGKAHING_SECTOR_DEFINITIONS.some((option) => option.key === classificationSelect.value) ? classificationSelect.value : '';

        if (!selectedGroup) {
            classificationSelect.value = '';
        }

        syncMungkahingMobileSectorHiddenInputs(wrapper, selectedGroup, selectedGroup ? selectedClassification : '');

        const payload = state.activePayload || {};
        applyMungkahingMobileSectorSelection(payload, selectedGroup, selectedGroup ? selectedClassification : '');
        state.activePayload = payload;
    }

    function syncMungkahingMobileSectorHiddenInputs(wrapper, selectedGroup, selectedClassification) {
        wrapper.querySelectorAll('input[type="checkbox"][name^="sectoralClassification."]').forEach((input) => {
            const name = input.getAttribute('name') || '';
            const expectedName = selectedGroup && selectedClassification
                ? `sectoralClassification.${selectedGroup}.${selectedClassification}`
                : '';
            input.checked = name === expectedName;
        });
    }

    function applyMungkahingMobileSectorSelection(payload, selectedGroup, selectedClassification) {
        payload.sectoralClassification = payload.sectoralClassification || {};

        MUNGKAHING_SECTOR_GROUPS.forEach((group) => {
            payload.sectoralClassification[group.key] = payload.sectoralClassification[group.key] || {};
            MUNGKAHING_SECTOR_DEFINITIONS.forEach((definition) => {
                payload.sectoralClassification[group.key][definition.key] = false;
            });
        });

        if (selectedGroup && selectedClassification) {
            payload.sectoralClassification[selectedGroup][selectedClassification] = true;
        }
    }

    function renderDocumentMungkahingSectorTable(pantawid, nonPantawid) {
        const sectorFields = MUNGKAHING_SECTOR_DEFINITIONS.map((definition) => [definition.label.replace(' - ', ' '), definition.key]);

        return `
            <div class="paper-table-wrap">
                <table class="paper-table">
                    <thead>
                        <tr>
                            <th>Paglain-lain</th>
                            <th>Pantawid</th>
                            <th>Non-Pantawid</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sectorFields.map(([label, key]) => `
                            <tr>
                                <td>${escapeHtml(label)}</td>
                                <td class="paper-table__choice"><input type="checkbox" name="sectoralClassification.pantawid.${key}" ${pantawid?.[key] ? 'checked' : ''}></td>
                                <td class="paper-table__choice"><input type="checkbox" name="sectoralClassification.nonPantawid.${key}" ${nonPantawid?.[key] ? 'checked' : ''}></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderPaperTableWithRows(headers, rows) {
        return `
            <div class="paper-table-wrap">
                <table class="paper-table">
                    <thead>
                        <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${rows.map((cells) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderMungkahingMobileRowsSection(title, description, rows, addAction, rowRenderer) {
        return `
            <section class="post-approval-section post-approval-section--mungkahing">
                <div class="post-approval-section__header">
                    <h4>${escapeHtml(title)}</h4>
                    <p>${escapeHtml(description)}</p>
                </div>
                <div class="post-approval-repeatable">
                    <div class="post-approval-repeatable__header">
                        <span class="post-approval-repeatable__title">${escapeHtml(description)}</span>
                        <button type="button" class="btn-outline small" data-row-action="${escapeAttribute(addAction)}">Add row</button>
                    </div>
                    ${rows.map((row, index) => rowRenderer(row, index)).join('')}
                </div>
            </section>
        `;
    }

    function renderMungkahingMobileTotalSection(title, fieldsHtml) {
        return `
            <section class="post-approval-section post-approval-section--mungkahing post-approval-section--total">
                <div class="post-approval-section__header">
                    <h4>${escapeHtml(title)}</h4>
                </div>
                <div class="post-approval-fields post-approval-fields--totals">
                    ${fieldsHtml}
                </div>
            </section>
        `;
    }

    function renderMungkahingRepeatableRow(fieldsHtml, removeAction, index, title = 'Row') {
        return `
            <div class="post-approval-repeatable__row post-approval-repeatable__row--mungkahing">
                <div class="post-approval-repeatable__row-head">
                    <span class="post-approval-repeatable__badge">${escapeHtml(title)} ${Number(index) + 1}</span>
                </div>
                ${fieldsHtml}
                <div class="form-field">
                    <span>Remove row</span>
                    <button type="button" class="btn-outline small post-approval-row-action" data-row-action="${escapeAttribute(removeAction)}" data-row-index="${index}">Remove</button>
                </div>
            </div>
        `;
    }

    function renderMungkahingContributionRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Kakuhuan sa Pondo', `modalityApplications.rows.${index}.fundSource`, row.fundSource || '', 'text')}
            ${renderField('Gi-ambag', `modalityApplications.rows.${index}.contributionType`, row.contributionType || '', 'text')}
            ${renderField('Kantidad', `modalityApplications.rows.${index}.amount`, row.amount || '', 'number')}
        `, 'remove-mp-contribution', index, 'Partner');
    }

    function renderMungkahingMaterialRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Material', `businessOperation.materials.rows.${index}.material`, row.material || '', 'text')}
            ${renderField('Kadaghanon', `businessOperation.materials.rows.${index}.quality`, row.quality || '', 'text')}
            ${renderField('Yunit', `businessOperation.materials.rows.${index}.unit`, row.unit || '', 'text')}
            ${renderField('Unit Price', `businessOperation.materials.rows.${index}.unitPrice`, row.unitPrice || '', 'number')}
            ${renderField('Siklo sa Produksyon', `businessOperation.materials.rows.${index}.cyclesPerProduction`, row.cyclesPerProduction || '', 'text')}
            ${renderField('Kinatibuk-ang kantidad', `businessOperation.materials.rows.${index}.projectedCost`, row.projectedCost || '', 'number')}
        `, 'remove-mp-material', index, 'Materyales');
    }

    function renderMungkahingLaborRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Worker name', `businessOperation.labor.rows.${index}.workerName`, row.workerName || '', 'text')}
            ${renderField('Position', `businessOperation.labor.rows.${index}.position`, row.position || '', 'text')}
            ${renderField('Daily wage', `businessOperation.labor.rows.${index}.dailyWage`, row.dailyWage || '', 'number')}
        `, 'remove-mp-labor', index, 'Trabahante');
    }

    function renderMungkahingEquipmentRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Kagamitan', `businessOperation.toolsEquipment.rows.${index}.equipment`, row.equipment || '', 'text')}
            ${renderField('Kadaghanon', `businessOperation.toolsEquipment.rows.${index}.capacity`, row.capacity || '', 'text')}
            ${renderField('Yunit', `businessOperation.toolsEquipment.rows.${index}.unit`, row.unit || '', 'text')}
            ${renderField('Kantidad o presyo sa matag usa', `businessOperation.toolsEquipment.rows.${index}.quantityOrPrice`, row.quantityOrPrice || '', 'number')}
            ${renderField('Kinatibuk-an nga kantidad o presyo', `businessOperation.toolsEquipment.rows.${index}.projectedAmount`, row.projectedAmount || '', 'number')}
            ${renderField('Gitas-on sa kinabuhi sa mga himan/kagamitan', `businessOperation.toolsEquipment.rows.${index}.usefulLifeDays`, row.usefulLifeDays || '', 'text')}
            ${renderField('Siklo sa Produksyon', `businessOperation.toolsEquipment.rows.${index}.productionCycle`, row.productionCycle || '', 'text')}
            ${renderField('Depreciation Cost', `businessOperation.toolsEquipment.rows.${index}.depreciationCost`, row.depreciationCost || '', 'number')}
        `, 'remove-mp-equipment', index, 'Kagamitan');
    }

    function renderMungkahingFixedExpenseRow(row, index) {
        return `
            <div class="post-approval-repeatable__row">
                ${renderReadOnlyField('Regular na ginagastuhan', row.expenseName || '')}
                ${renderField('Dalas ng pagbayad', `businessOperation.operatingExpenses.rows.${index}.paymentFrequency`, row.paymentFrequency || '', 'text')}
                ${renderField('Kinatibuk-an na kantidad o presyo base sa siglo sa produksyon', `businessOperation.operatingExpenses.rows.${index}.projectedCost`, row.projectedCost || '', 'number')}
            </div>
        `;
    }

    function renderMungkahingSalesRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Produkto', `businessOperation.salesProjection.rows.${index}.product`, row.product || '', 'text')}
            ${renderField('Kadaghanon', `businessOperation.salesProjection.rows.${index}.capacity`, row.capacity || '', 'text')}
            ${renderField('Yunit', `businessOperation.salesProjection.rows.${index}.unit`, row.unit || '', 'text')}
            ${renderField('Kantidad sa pagpamaligya matag piraso', `businessOperation.salesProjection.rows.${index}.sellingPrice`, row.sellingPrice || '', 'number')}
            ${renderField('Kinatibuk-an na kantidad sa pagpamaligya base sa siglo sa produksyon', `businessOperation.salesProjection.rows.${index}.projectedSales`, row.projectedSales || '', 'number')}
        `, 'remove-mp-sale', index, 'Produkto');
    }

    function renderMungkahingMobileFixedExpenseSection(rows, grandTotal) {
        return `
            <section class="post-approval-section post-approval-section--mungkahing">
                <div class="post-approval-section__header">
                    <h4>IV.d Uban pang mga gastohanan</h4>
                    <p>Regular na ginagastuhan nga permanente sa porma.</p>
                </div>
                <div class="post-approval-repeatable">
                    ${rows.map((row, index) => renderMungkahingFixedExpenseRow(row, index)).join('')}
                </div>
                <div class="post-approval-fields post-approval-fields--totals">
                    ${renderField('Grand Total', 'businessOperation.operatingExpenses.grandTotal', grandTotal || '', 'number')}
                </div>
            </section>
        `;
    }

    function defaultMungkahingExpenseRows() {
        return [
            { expenseName: 'Renta sa himuanan sa produkto/opisina', paymentFrequency: '', projectedCost: '' },
            { expenseName: 'Kuryente', paymentFrequency: '', projectedCost: '' },
            { expenseName: 'Tubig', paymentFrequency: '', projectedCost: '' },
            { expenseName: 'Pamilite', paymentFrequency: '', projectedCost: '' },
            { expenseName: 'Permit sa pag-operate', paymentFrequency: '', projectedCost: '' },
            { expenseName: 'Lain pang mga gastohanan', paymentFrequency: '', projectedCost: '' },
        ];
    }

    function ensureMungkahingExpenseRows(rows) {
        const source = Array.isArray(rows) ? rows : [];
        return defaultMungkahingExpenseRows().map((defaultRow, index) => ({
            expenseName: defaultRow.expenseName,
            paymentFrequency: source[index]?.paymentFrequency || '',
            projectedCost: source[index]?.projectedCost || '',
        }));
    }

    function renderMungkahingSpendingRow(row, index) {
        return renderMungkahingRepeatableRow(`
            ${renderField('Expense', `spendingPlan.rows.${index}.expense`, row.expense || '', 'text')}
            ${renderField('Amount', `spendingPlan.rows.${index}.amount`, row.amount || '', 'number')}
            ${renderField('Usage schedule', `spendingPlan.rows.${index}.usageSchedule`, row.usageSchedule || '', 'text')}
        `, 'remove-mp-spending', index, 'Gasto');
    }

    function renderMungkahingDesktopPaper(payload) {
        const data = payload || {};
        const project = data.projectInformation || {};
        const sectoral = data.sectoralClassification || {};
        const pantawid = sectoral.pantawid || {};
        const nonPantawid = sectoral.nonPantawid || {};
        const modalityRows = ensureRows(data.modalityApplications?.rows, { fundSource: '', contributionType: '', amount: '' });
        const materialsRows = ensureRows(data.businessOperation?.materials?.rows, { material: '', quality: '', unit: '', unitPrice: '', cyclesPerProduction: '', projectedCost: '' });
        const laborRows = ensureRows(data.businessOperation?.labor?.rows, { workerName: '', position: '', dailyWage: '' });
        const equipmentRows = ensureRows(data.businessOperation?.toolsEquipment?.rows, { equipment: '', capacity: '', unit: '', quantityOrPrice: '', projectedAmount: '', usefulLifeDays: '', productionCycle: '', depreciationCost: '' });
        const expenseRows = ensureMungkahingExpenseRows(data.businessOperation?.operatingExpenses?.rows);
        const salesRows = ensureRows(data.businessOperation?.salesProjection?.rows, { product: '', capacity: '', unit: '', sellingPrice: '', projectedSales: '' });
        const spendingRows = ensureRows(data.spendingPlan?.rows, { expense: '', amount: '', usageSchedule: '' });
        const income = data.businessOperation?.incomeComputation || {};
        const recommendation = data.staffReview?.recommendation || {};

        return `
            <div class="paper-document paper-document--mungkahing">
                ${renderMungkahingPaperPage(1, `
                    <div class="section">
                        <div class="roman">I.</div>
                        <div>
                            <div class="section-title">KINATIBUK-AN IMPORMASYON BAHIN SA PROYEKTO</div>
                            <div class="field-grid">
                                ${renderMungkahingSourceLineRow('Ngalan sa Partisipante', 'projectInformation.participantName', project.participantName || '', 'w-240')}
                                ${renderMungkahingSourceLineRow('Lokasyon sa Proyekto', 'projectInformation.projectLocation', project.projectLocation || '', 'w-260')}
                                ${renderMungkahingSourceLineRow('Ulohan sa Proyektong MD', 'projectInformation.projectTitle', project.projectTitle || '', 'w-220')}
                                ${renderMungkahingSourceLineRow('Petsa sa Pagtukod', 'projectInformation.projectDate', project.projectDate || '', 'w-250', true, 'date')}
                                ${renderMungkahingSourceLineRow('Kinatibuk-ang Kantidad', 'projectInformation.projectedAmount', project.projectedAmount || '', 'w-220')}
                                ${renderMungkahingSourceLineRow('Savings Account no.', 'projectInformation.savingsAccountNumber', project.savingsAccountNumber || 'NONE', 'w-250')}
                                ${renderMungkahingSourceLineRow('Kantidad gikan sa CSWDD', 'projectInformation.cswddAmount', project.cswddAmount || '', 'w-220')}
                                <div></div>
                                ${renderMungkahingSourceLineRow('Lain kakuhan sa pondo', 'projectInformation.otherFundingSource', project.otherFundingSource || '', 'w-220')}
                                <div></div>
                            </div>
                            ${renderMungkahingSectorMatrix(pantawid, nonPantawid)}
                        </div>
                    </div>
                    <div class="section">
                        <div class="roman">II.</div>
                        <div>
                            <div class="section-title">RATIONALE OF THE PROPOSED PROJECT</div>
                            <div class="rationale-lines">
                                ${renderMungkahingRationaleField(data.rationale || '')}
                            </div>
                        </div>
                    </div>
                    <div class="section">
                        <div class="roman">III.</div>
                        <div>
                            <div class="section-title">DETALYE SA MODALITY APPLICATION/S</div>
                            <div class="modality-head">PONDO NGA GI-AMBAG SA MGA PARTNER/S:</div>
                            <div class="note-line">Self-Employment Assistance-Kaunlaran (SEA-K)</div>
                            ${renderPaperTableMarkup('modality-table', `
                                <tr><th style="width:31%">Kakuhan sa Pondo</th><th style="width:39%">Gi-ambag</th><th style="width:30%">Kantidad</th></tr>
                            `, modalityRows.map((row, index) => `
                                <tr>
                                    <td>${renderMungkahingCellInput(`modalityApplications.rows.${index}.fundSource`, row.fundSource || '')}</td>
                                    <td>${renderMungkahingCellInput(`modalityApplications.rows.${index}.contributionType`, row.contributionType || '')}</td>
                                    <td>${renderMungkahingCellInput(`modalityApplications.rows.${index}.amount`, row.amount || '', 'number')}</td>
                                </tr>
                            `).join(''))}
                            ${renderMungkahingTableControls('add-mp-contribution', 'remove-mp-contribution', modalityRows, 'Partner row')}
                        </div>
                    </div>
                    <div class="section">
                        <div class="roman">IV.</div>
                        <div>
                            <div class="section-title">Pagdumala sa Negosyo</div>
                            <div class="sub-block-title">a.) Mga gikinahanglang Materyales</div>
                            ${renderPaperTableMarkup('materials-table', `
                                <tr><th>(Materyales)<br>(a)</th><th>(Kadaghanon)<br>(b)</th><th>(Yunit)<br>(c)</th><th>(Kantidad o presyo sa matag yunit)<br>(d)</th><th>(Dalas sa paggamit/Siklo sa Produksyon)<br>(e)</th><th>(Kinatibuk-an na kantidad o presyo)<br>(f)</th></tr>
                            `, materialsRows.map((row, index) => `
                                <tr>
                                    <td>${renderMungkahingCellInput(`businessOperation.materials.rows.${index}.material`, row.material || '')}</td>
                                    <td>${renderMungkahingCellInput(`businessOperation.materials.rows.${index}.quality`, row.quality || '')}</td>
                                    <td>${renderMungkahingCellInput(`businessOperation.materials.rows.${index}.unit`, row.unit || '')}</td>
                                    <td>${renderMungkahingCellInput(`businessOperation.materials.rows.${index}.unitPrice`, row.unitPrice || '', 'number')}</td>
                                    <td>${renderMungkahingCellInput(`businessOperation.materials.rows.${index}.cyclesPerProduction`, row.cyclesPerProduction || '')}</td>
                                    <td>${renderMungkahingCellInput(`businessOperation.materials.rows.${index}.projectedCost`, row.projectedCost || '', 'number')}</td>
                                </tr>
                            `).join(''), `<tr><td colspan="5" class="right-text">Kinatibuk-ang Total</td><td>${renderMungkahingCellInput('businessOperation.materials.totalCost', data.businessOperation?.materials?.totalCost || '', 'number')}</td></tr>`)}
                            ${renderMungkahingTableControls('add-mp-material', 'remove-mp-material', materialsRows, 'Material row')}
                            <div class="sub-block-title">b.) Mga Gikinahanglan na Trabahante</div>
                            ${renderPaperTableMarkup('workers-table', `
                                <tr><th>Ngalan sa Magtrabaho sa Negosyo</th><th>Posisyon sa Trabaho</th><th>Inadlaw na Sweldo</th></tr>
                            `, laborRows.map((row, index) => `
                                <tr>
                                    <td>${renderMungkahingCellInput(`businessOperation.labor.rows.${index}.workerName`, row.workerName || '')}</td>
                                    <td>${renderMungkahingCellInput(`businessOperation.labor.rows.${index}.position`, row.position || '')}</td>
                                    <td>${renderMungkahingCellInput(`businessOperation.labor.rows.${index}.dailyWage`, row.dailyWage || '', 'number')}</td>
                                </tr>
                            `).join(''), `
                                <tr><td colspan="2" class="right-text">Kinatibuk-an na inadlaw na sweldo</td><td>${renderMungkahingCellInput('businessOperation.labor.totalDailyWage', data.businessOperation?.labor?.totalDailyWage || '', 'number')}</td></tr>
                                <tr><td colspan="2" class="right-text">Kinatibuk-an na suweldo base sa siglo sa produksyon</td><td>${renderMungkahingCellInput('businessOperation.labor.totalProductionCycleWage', data.businessOperation?.labor?.totalProductionCycleWage || '', 'number')}</td></tr>
                            `)}
                            ${renderMungkahingTableControls('add-mp-labor', 'remove-mp-labor', laborRows, 'Labor row')}
                        </div>
                    </div>
                `, { showTitleBlock: true, bodyClass: 'content content--page1' })}
                ${renderMungkahingPaperPage(2, `
                        <div class="sub-block-title">c) Mga Gikinahanglan nga Kagamitan (Tools and Equipment)</div>
                        ${renderPaperTableMarkup('tools-table', `
                            <tr><th>Kagamitan<br>(a)</th><th>Kadaghanon<br>(b)</th><th>Yunit<br>(c)</th><th>Kantidad o presyo sa matag usa<br>(d)</th><th>Kantidad na kantidad o presyo<br>(e)</th><th>Gitas-on sa kinabuhi/kagamitan<br>(divide sa 365 days)<br>(f)</th><th>Siklo sa Produksyon<br>(in days/months/years)<br>(g)</th><th>Depreciation Cost<br>(h) = [(e)/(f)] x (g)</th></tr>
                        `, equipmentRows.map((row, index) => `
                            <tr>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.equipment`, row.equipment || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.capacity`, row.capacity || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.unit`, row.unit || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.quantityOrPrice`, row.quantityOrPrice || '', 'number')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.projectedAmount`, row.projectedAmount || '', 'number')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.usefulLifeDays`, row.usefulLifeDays || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.productionCycle`, row.productionCycle || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.toolsEquipment.rows.${index}.depreciationCost`, row.depreciationCost || '', 'number')}</td>
                            </tr>
                        `).join(''), `<tr><td colspan="7" class="total-label">Kinatibuk-ang Total</td><td>${renderMungkahingCellInput('businessOperation.toolsEquipment.totalCost', data.businessOperation?.toolsEquipment?.totalCost || '', 'number')}</td></tr>`)}
                        ${renderMungkahingTableControls('add-mp-equipment', 'remove-mp-equipment', equipmentRows, 'Equipment row')}
                        <div class="sub-block-title">d) Uban pang mga gastohanan</div>
                        ${renderPaperTableMarkup('other-expenses-table', `
                            <tr><th style="width:40%">Regular na ginagastuhan</th><th style="width:24%">Dalas ng pagbayad<br>(weekly, quarterly, monthly)</th><th style="width:36%">Kinatibuk-an na kantidad o presyo base sa siglo sa produksyon</th></tr>
                        `, expenseRows.map((row, index) => `
                            <tr>
                                <td><span class="fixed-cell">${escapeHtml(row.expenseName || '')}</span></td>
                                <td>${renderMungkahingCellInput(`businessOperation.operatingExpenses.rows.${index}.paymentFrequency`, row.paymentFrequency || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.operatingExpenses.rows.${index}.projectedCost`, row.projectedCost || '', 'number')}</td>
                            </tr>
                        `).join(''), `<tr><td colspan="2" class="total-label">Grand Total</td><td>${renderMungkahingCellInput('businessOperation.operatingExpenses.grandTotal', data.businessOperation?.operatingExpenses?.grandTotal || '', 'number')}</td></tr>`)}
                        <div class="sub-block-title">e) Pangunahing kita gikan sa puhunan alang sa mga sangkap</div>
                        ${renderPaperTableMarkup('gross-table', `
                            <tr><th>Produkto<br>(a)</th><th>Kadaghanon<br>(b)</th><th>Yunit<br>(c)</th><th>Kantidad sa pagpamaligya matag piraso<br>(d)</th><th>Kinatibuk-an na kantidad sa pagpamaligya base sa siglo sa produksyon<br>[(e)= (b) x (d)]</th></tr>
                        `, salesRows.map((row, index) => `
                            <tr>
                                <td>${renderMungkahingCellInput(`businessOperation.salesProjection.rows.${index}.product`, row.product || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.salesProjection.rows.${index}.capacity`, row.capacity || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.salesProjection.rows.${index}.unit`, row.unit || '')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.salesProjection.rows.${index}.sellingPrice`, row.sellingPrice || '', 'number')}</td>
                                <td>${renderMungkahingCellInput(`businessOperation.salesProjection.rows.${index}.projectedSales`, row.projectedSales || '', 'number')}</td>
                            </tr>
                        `).join(''), `<tr><td colspan="4" class="total-label">Gross Sales</td><td>${renderMungkahingCellInput('businessOperation.salesProjection.grossSales', data.businessOperation?.salesProjection?.grossSales || '', 'number')}</td></tr>`)}
                        ${renderMungkahingTableControls('add-mp-sale', 'remove-mp-sale', salesRows, 'Sales row')}
                        <div class="sub-block-title">f) Kinatibuk-ang kita sa matag produkto o paghimo sa serbisyo</div>
                        ${renderPaperTableMarkup('bottom-summary', `<tr><th style="width:64%"></th><th style="width:36%">PRESYO</th></tr>`, `
                            <tr><td>Gilauman nga kita alang sa usa ka "siklo sa produksyon" (production cycle) <em>(SEE TABLE E)</em></td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.projectedIncomePerCycle', income.projectedIncomePerCycle || '', 'number')}</td></tr>
                            <tr><td>Less:&nbsp; Mga materyales (raw materials) <em>(SEE TABLE A)</em></td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.rawMaterialsCost', income.rawMaterialsCost || '', 'number')}</td></tr>
                        `)}
                `, { bodyClass: 'content content--page2' })}
                ${renderMungkahingPaperPage(3, `
                        ${renderPaperTableMarkup('summary-table', `<tr><th style="width:64%"></th><th style="width:36%">PRESYO</th></tr>`, `
                            <tr><td class="summary-label">Gikinahanglan na manpower ug labor <em>(SEE TABLE B)</em></td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.manpowerLaborCost', income.manpowerLaborCost || '', 'number')}</td></tr>
                            <tr class="light-row"><td class="summary-label">Depreciation Cost <em>(SEE TABLE C)</em></td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.depreciationCost', income.depreciationCost || '', 'number')}</td></tr>
                            <tr><td class="summary-label">Uban pang mga Gasto <em>(SEE TABLE D)</em></td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.otherExpenses', income.otherExpenses || '', 'number')}</td></tr>
                            <tr class="light-row"><td class="summary-label">Kinatibuk-an na gasto sa pag-operate <em>(table B+C+D)</em></td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.totalOperatingCost', income.totalOperatingCost || '', 'number')}</td></tr>
                            <tr><td class="summary-label">Kinatibuk-an na ginansya human sa gasto sa operasyon (Gross Profit)</td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.grossProfit', income.grossProfit || '', 'number')}</td></tr>
                            <tr class="light-row"><td class="summary-label">Net profit</td><td>${renderMungkahingCellInput('businessOperation.incomeComputation.netProfit', income.netProfit || '', 'number')}</td></tr>
                        `)}
                        <div class="section-title section-title--plain">g) Iskedyul o Plano sa Paggasto sa SEA-K Capital Fund (SCF)</div>
                        ${renderPaperTableMarkup('scf-table', `
                            <tr>
                                <th><span class="th-main">Mga Gasto</span><span class="th-sub">(Mga kagamitan, materyales, etc.)</span></th>
                                <th><span class="th-main">Kantidad</span></th>
                                <th><span class="th-main">Iskedyul sa Paggamit</span></th>
                            </tr>
                        `, spendingRows.map((row, index) => `
                            <tr>
                                <td>${renderMungkahingCellInput(`spendingPlan.rows.${index}.expense`, row.expense || '')}</td>
                                <td>${renderMungkahingCellInput(`spendingPlan.rows.${index}.amount`, row.amount || '', 'number')}</td>
                                <td>${renderMungkahingCellInput(`spendingPlan.rows.${index}.usageSchedule`, row.usageSchedule || '')}</td>
                            </tr>
                        `).join(''))}
                        ${renderMungkahingTableControls('add-mp-spending', 'remove-mp-spending', spendingRows, 'Spending row')}
                        <div class="recommendation-section">
                            <div class="recommendation-title">V. &nbsp;&nbsp;&nbsp; REKOMENDASYON</div>
                            <div class="recommendation-text">
                                Kini nagrekomenda nga punduhan ang maong <span class="italic">Mungkahing Proyekto</span> alang sa Micro Enterprise Development alang sa proyektong
                                <span class="inline-line w-project">${escapeHtml(project.projectTitle || '')}</span>
                                nga adunay kinatibuk-ang kantidad na Php <span class="inline-line w-amount">${escapeHtml(recommendation.recommendedAmount || project.projectedAmount || '')}</span>.
                            </div>
                            <table class="signature-table">
                                <tbody>
                                    <tr>
                                        <td class="sig-left">GI-ANDAM NI</td>
                                        <td class="sig-mid">
                                            ${renderMungkahingSignatureBox('applicantSignature.signedName', data.applicantSignature?.signedName || '', 'Pirma ibabaw sa &nbsp; pangalan sa Partisipante', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null, false)}
                                        </td>
                                        <td class="sig-right">
                                            <div class="sig-date-wrap">
                                                <div class="sig-date-label">Petsa</div>
                                                ${renderMungkahingSignatureDate('applicantSignature.signedDate', data.applicantSignature?.signedDate || '', false)}
                                            </div>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td class="sig-left">GI ASSESSES<br>UG APRUBAHAN<br>NI</td>
                                        <td class="sig-mid">
                                            ${renderMungkahingSignatureBox('staffReview.recommendation.approverName', recommendation.approverName || '', 'Pirma ibabaw sa &nbsp; pangalan sa CSWDD staff', 'recommendation.signatureUpload', recommendation.signatureUpload || null, true, 'staffReview.recommendation.approverTitle', recommendation.approverTitle || 'CSWDO')}
                                        </td>
                                        <td class="sig-right">
                                            <div class="sig-date-wrap">
                                                <div class="sig-date-label">Petsa</div>
                                                ${renderMungkahingSignatureDate('staffReview.recommendation.approvedDate', recommendation.approvedDate || '', true)}
                                            </div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                `, { bodyClass: 'content content--page3' })}
            </div>
        `;
    }

    function renderMungkahingSourceLineRow(label, name, value, widthClass = '', showColon = true, type = 'text') {
        const ownership = buildFieldOwnershipAttributes(name, false);
        return `
            <div class="line-row ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-only' : ''}">
                <span>${escapeHtml(label)}</span>
                ${showColon ? '<span class="colon">:</span>' : ''}
                <input class="field ${escapeAttribute(widthClass)} ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="${escapeAttribute(type)}" name="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
                ${ownership.note}
            </div>
        `;
    }

    function renderMungkahingRationaleField(value) {
        const ownership = buildFieldOwnershipAttributes('rationale', false);
        return `
            <textarea class="rationale-area ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" name="rationale" rows="4" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>${escapeHtml(value || '')}</textarea>
            ${ownership.note}
        `;
    }

    function renderMungkahingCellInput(name, value, type = 'text', className = '') {
        const ownership = buildFieldOwnershipAttributes(name, false);
        return `<input class="cell-input ${className} ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="${escapeAttribute(type)}" name="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>${ownership.note}`;
    }

    function renderMungkahingTableControls(addAction, removeAction, rows, label) {
        return `
            <div class="paper-table-controls paper-table-controls--utility">
                <button type="button" class="paper-utility-btn" data-row-action="${escapeAttribute(addAction)}">Add ${escapeHtml(label)}</button>
                <div class="paper-table-controls__remove">
                    ${rows.map((_, index) => `<button type="button" class="paper-utility-btn paper-utility-btn--remove post-approval-row-action" data-row-action="${escapeAttribute(removeAction)}" data-row-index="${index}">Remove ${escapeHtml(label)} ${index + 1}</button>`).join('')}
                </div>
            </div>
        `;
    }

    function renderMungkahingPaperPage(pageNumber, content, options = {}) {
        const showTitleBlock = Boolean(options.showTitleBlock);
        const bodyClass = options.bodyClass || 'content';
        const pageModifierClass = ` page--page${pageNumber}`;
        return `
            <section class="paper-sheet paper-sheet--mungkahing page${pageModifierClass}">
                <header class="top-strip">
                    <img src="${escapeAttribute(mungkahingAssetUrl('city-of-butuan-logo.png'))}" alt="City of Butuan Official Seal" class="logo logo-left">
                    <div class="gov-header">
                            <div class="small">Republic of the Philippines</div>
                            <div class="big">CITY GOVERNMENT OF BUTUAN</div>
                            <div class="dept">City Social Welfare and Development Department</div>
                            <div class="addr">J.P. Rosales Ave., Tandang Sora, Butuan City</div>
                            <div class="blue-bar"></div>
                        </div>
                    <img src="${escapeAttribute(mungkahingAssetUrl('dswd-logo.png'))}" alt="CSWDD Logo" class="logo logo-right">
                </header>
                ${showTitleBlock ? `
                    <div class="title-wrap">
                        <div class="title-main">MUNGKAHING PROYEKTO</div>
                        <div class="title-sub">Sustainable Market and Technology and Employment Assistance Program<br />(SMART LEAP)</div>
                    </div>
                ` : ''}
                <div class="${escapeAttribute(bodyClass)}">${content}</div>
                <div class="page-no">Page ${pageNumber} of 3</div>
                <footer class="footer">
                    <div class="footer-left">
                        <div><strong>Phone:</strong> &nbsp;&nbsp; +639562241679 / +639816016317</div>
                        <div><strong>Email:</strong> &nbsp;&nbsp; cswdobutuan@gmail.com</div>
                        <div><strong>Website:</strong> &nbsp; http://www.butuan.gov.ph</div>
                    </div>
                    <div class="footer-right">
                        <img src="${escapeAttribute(mungkahingAssetUrl('butuanon-logo.png'))}" alt="ButuanON logo">
                    </div>
                </footer>
            </section>
        `;
    }

    function renderMungkahingPaperSectionTitle(index, title) {
        return `<div class="paper-page-section__title"><span>${escapeHtml(index)}</span><strong>${escapeHtml(title)}</strong></div>`;
    }

    function renderMungkahingLineField(label, name, value, type) {
        const ownership = buildFieldOwnershipAttributes(name, false);
        return `<label class="paper-line-field ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-only' : ''}"><span class="paper-line-field__label">${escapeHtml(label)}:</span><input class="paper-line-field__input ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" type="${escapeAttribute(type || 'text')}" name="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>${ownership.note}</label>`;
    }

    function renderPaperInlineChoiceField(name, value, options, disabled = false, forceApplicant = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled, forceApplicant);
        return `
            <span class="paper-inline-choice ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-only' : ''}">
                ${(options || []).map((option) => `
                    <label class="paper-inline-choice__item">
                        <input
                            type="radio"
                            name="${escapeAttribute(name)}"
                            value="${escapeAttribute(option)}"
                            ${value === option ? 'checked' : ''}
                            ${ownership.attrs}
                            ${ownership.disabled ? 'disabled' : ''}
                        >
                        <span>${escapeHtml(option)}</span>
                    </label>
                `).join('')}
                ${ownership.note}
            </span>
        `;
    }

    function renderApplicantSignatureStamp(name, uploadField, metadata) {
        const safeName = String(name || '').trim();
        const ownership = buildFieldOwnershipAttributes(uploadField, false);
        const fileName = metadata?.original_name || '';
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        return `
            <div class="paper-applicant-signature">
                <label class="paper-signature-upload ${ownership.disabled ? 'is-disabled' : ''}">
                    <input type="file" class="upload-input" data-upload-field="${escapeAttribute(uploadField)}" ${ownership.attrs} accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${ownership.disabled ? 'disabled' : ''}>
                    <span>${fileName ? 'Ilisi ang pirma' : 'Upload pirma'}</span>
                </label>
                ${fileUrl ? `<a class="paper-signature-upload__link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">${escapeHtml(fileName || 'Tan-awa ang uploaded nga pirma')}</a>` : ''}
                <input type="hidden" name="participantSignature.signedName" value="${escapeAttribute(safeName)}">
                <div class="paper-applicant-signature__name">${escapeHtml(safeName || ' ')}</div>
                <div class="paper-applicant-signature__line"></div>
                <div class="paper-applicant-signature__label">Pirma ibabaw sa &nbsp; pangalan sa Partisipante</div>
            </div>
        `;
    }

    function renderMungkahingSignatureBox(nameKey, nameValue, labelText, uploadField, metadata, disabled = false, titleKey = '', titleValue = '') {
        const nameOwnership = buildFieldOwnershipAttributes(nameKey, disabled);
        const uploadOwnership = buildFieldOwnershipAttributes(uploadField, disabled);
        const titleOwnership = titleKey ? buildFieldOwnershipAttributes(titleKey, disabled) : null;
        const fileName = metadata?.original_name || '';
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        const uploadedAt = metadata?.uploaded_at ? formatDateTime(metadata.uploaded_at) : '';

        return `
            <div class="sig-box ${disabled ? 'is-staff-only' : ''}">
                ${titleKey ? `<input type="text" name="${escapeAttribute(titleKey)}" class="sig-title ${titleOwnership?.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" value="${escapeAttribute(titleValue || '')}" ${titleOwnership?.attrs || ''} ${titleOwnership?.disabled ? 'disabled' : ''}>${titleOwnership?.note || ''}` : ''}
                <div class="signature-upload-inline ${uploadOwnership.disabled ? 'is-disabled' : ''}">
                    <label class="signature-launch signature-launch--upload ${uploadOwnership.disabled ? 'is-disabled' : ''}">
                        <input type="file" class="upload-input" data-upload-field="${escapeAttribute(uploadField)}" ${uploadOwnership.attrs} accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${uploadOwnership.disabled ? 'disabled' : ''}>
                        ${fileName ? 'Ilisi ang pirma' : (uploadOwnership.disabled ? 'For CSWDD staff only' : 'Upload pirma')}
                    </label>
                    ${fileUrl ? `<a class="signature-file-link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">Tan-awa ang uploaded nga pirma</a>` : ''}
                    ${uploadedAt ? `<span class="signature-status-text">Uploaded ${escapeHtml(uploadedAt)}</span>` : ''}
                </div>
                ${uploadOwnership.note}
                <input type="text" name="${escapeAttribute(nameKey)}" class="sig-name ${nameOwnership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" value="${escapeAttribute(nameValue || '')}" ${nameOwnership.attrs} ${nameOwnership.disabled ? 'disabled' : ''}>
                ${nameOwnership.note}
                <div class="sig-label">${labelText}</div>
            </div>
        `;
    }

    function renderMungkahingSignatureDate(name, value, disabled = false) {
        const ownership = buildFieldOwnershipAttributes(name, disabled);
        return `
            <input type="date" name="${escapeAttribute(name)}" class="sig-date ${ownership.owner === FIELD_OWNER_STAFF ? 'is-staff-locked' : ''}" value="${escapeAttribute(value || '')}" ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}>
            ${ownership.note}
        `;
    }

    function renderMungkahingSectorMatrix(pantawid, nonPantawid) {
        const columns = [['Babae', 'sexFemale'], ['Lalake', 'sexMale'], ['Babae', 'seniorFemale'], ['Lalake', 'seniorMale'], ['Babae', 'pwdFemale'], ['Lalake', 'pwdMale'], ['Babae', 'ipFemale'], ['Lalake', 'ipMale'], ['Babae', 'soloParentFemale'], ['Lalake', 'soloParentMale']];
        return renderPaperTableMarkup('sectoral-table', `
            <tr><th rowspan="2" style="width: 16%;">Paglain-lain</th><th colspan="2" style="width: 18%;">Sex</th><th colspan="8">SECTORAL</th></tr>
            <tr><th>Babae</th><th>Lalake</th><th colspan="2">Senior Citizens</th><th colspan="2">PWD</th><th colspan="2">IP</th><th colspan="2">Solo Parent</th></tr>
            <tr><th></th>${columns.map(([label]) => `<th>${escapeHtml(label)}</th>`).join('')}</tr>
        `, `
            ${renderMungkahingSectorMatrixRow('Pantawid', 'sectoralClassification.pantawid', pantawid, columns)}
            ${renderMungkahingSectorMatrixRow('Non-Pantawid', 'sectoralClassification.nonPantawid', nonPantawid, columns)}
        `);
    }

    function renderMungkahingSectorMatrixRow(label, keyPrefix, values, columns) {
        return `<tr><td><strong>${escapeHtml(label)}</strong></td>${columns.map(([, key]) => {
            const name = `${keyPrefix}.${key}`;
            const ownership = buildFieldOwnershipAttributes(name, false);
            return `<td class="paper-table__choice"><input type="checkbox" name="${escapeAttribute(name)}" ${values?.[key] ? 'checked' : ''} ${ownership.attrs} ${ownership.disabled ? 'disabled' : ''}></td>`;
        }).join('')}</tr>`;
    }

    function renderPaperTableMarkup(className, headHtml, bodyHtml, footHtml = '') {
        return `<div class="paper-table-wrap"><table class="${escapeAttribute(className)}"><thead>${headHtml}</thead><tbody>${bodyHtml}</tbody>${footHtml ? `<tfoot>${footHtml}</tfoot>` : ''}</table></div>`;
    }

    function mungkahingAssetUrl(fileName) {
        const root = String(state.baseUrl || '').replace(/\/public\/?$/, '');
        return `${root}/denzel-frontend-barbielat/htdocs/CSWD/${fileName}`;
    }

    function ensureRows(rows, fallbackRow) {
        return Array.isArray(rows) && rows.length > 0 ? rows : [fallbackRow];
    }

    function handleWindowResize() {
        const nextMode = window.innerWidth >= 1024 ? 'desktop' : 'mobile';
        if (nextMode !== state.renderMode && state.task?.interactive) {
            const payload = gatherFormData();
            if (payload) {
                state.activePayload = payload;
            }
            state.renderMode = nextMode;
            renderTask();
        } else {
            state.renderMode = nextMode;
        }

        syncSidebarMenuState();
    }

    function closeSidebarMenuOnMobile() {
        if (window.innerWidth > 960) {
            return;
        }

        const sidebar = document.querySelector('.dash-sidebar');
        sidebar?.classList.remove('is-open');
        syncSidebarMenuState();
    }

    function handleGlobalKeydown(event) {
        if (event.key === 'Escape') {
            closeSidebarMenuOnMobile();
        }
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

    function setNestedValue(target, path, value) {
        const segments = path.split('.');
        let cursor = target;
        segments.forEach((segment, index) => {
            const isLast = index === segments.length - 1;
            const nextSegment = segments[index + 1];
            const isArrayIndex = /^\d+$/.test(segment);

            if (isLast) {
                if (isArrayIndex && Array.isArray(cursor)) {
                    cursor[Number(segment)] = value;
                } else {
                    cursor[segment] = value;
                }
                return;
            }

            const containerIsArray = /^\d+$/.test(nextSegment);
            if (isArrayIndex) {
                const numericIndex = Number(segment);
                if (!Array.isArray(cursor)) {
                    return;
                }
                if (cursor[numericIndex] == null) {
                    cursor[numericIndex] = containerIsArray ? [] : {};
                }
                cursor = cursor[numericIndex];
                return;
            }

            if (!(segment in cursor)) {
                cursor[segment] = containerIsArray ? [] : {};
            }
            cursor = cursor[segment];
        });
    }

    function structuredCloneSafe(value) {
        try {
            return JSON.parse(JSON.stringify(value ?? {}));
        } catch (error) {
            return {};
        }
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

    function renderStaffSections(sections, reviewerRemarks) {
        return renderApplicantReviewerNote(reviewerRemarks);
    }

    function renderUploadField(label, fieldKey, metadata, disabled = false) {
        const ownership = buildFieldOwnershipAttributes(fieldKey, disabled);
        const fileName = metadata?.original_name || '';
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        const uploadedAt = metadata?.uploaded_at ? formatDateTime(metadata.uploaded_at) : '';

        return `
            <div class="form-field full upload-field">
                <span>${escapeHtml(label)}</span>
                ${ownership.note}
                <div class="upload-card upload-card--guided ${ownership.disabled ? 'is-disabled' : ''}">
                    <div class="upload-card__copy">
                        <strong>${escapeHtml(fileName || 'No file uploaded yet')}</strong>
                        <small>${fileName ? `Uploaded ${escapeHtml(uploadedAt || '')}` : 'Accepted: JPG, PNG, WEBP, HEIC, HEIF, or PDF'}</small>
                    </div>
                    <div class="upload-card__actions">
                        ${fileUrl ? `<a class="btn-outline small" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">View uploaded file</a>` : `
                            <label class="btn-primary small upload-trigger ${ownership.disabled ? 'is-disabled' : ''}">
                                <input type="file" class="upload-input" data-upload-field="${escapeAttribute(fieldKey)}" ${ownership.attrs} accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${ownership.disabled ? 'disabled' : ''}>
                                Upload file
                            </label>
                        `}
                        ${fileUrl ? `
                            <label class="btn-outline small upload-trigger ${ownership.disabled ? 'is-disabled' : ''}">
                                <input type="file" class="upload-input" data-upload-field="${escapeAttribute(fieldKey)}" ${ownership.attrs} accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf" ${ownership.disabled ? 'disabled' : ''}>
                                Replace file
                            </label>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    function renderFamilyMemberRow(row, index) {
        return renderRepeatableMiniCard(
            `Family member ${index + 1}`,
            `
                ${renderField('Family member name', `familyEnterprise.members.${index}.name`, row.name || '', 'text')}
                ${renderField('Age', `familyEnterprise.members.${index}.age`, row.age || '', 'number')}
                ${renderField('Activities', `familyEnterprise.members.${index}.activities`, row.activities || '', 'text', true)}
            `,
            'remove-family',
            index
        );
    }

    function renderIncomeRow(row, index) {
        return renderRepeatableMiniCard(
            `Income row ${index + 1}`,
            `
                ${renderField('Working family member', `incomeEligibility.rows.${index}.memberName`, row.memberName || '', 'text')}
                ${renderField('Cash income', `incomeEligibility.rows.${index}.cashIncome`, row.cashIncome || '', 'number')}
                ${renderField('Non-cash income', `incomeEligibility.rows.${index}.nonCashIncome`, row.nonCashIncome || '', 'number')}
                ${renderField('Total income', `incomeEligibility.rows.${index}.totalIncome`, row.totalIncome || '', 'number')}
            `,
            'remove-income',
            index
        );
    }

    function renderAvailmentMobile(payload) {
        const data = payload || {};
        const familyMembers = ensureRows(data.familyEnterprise?.members, { name: '', age: '', activities: '' });
        const incomeRows = ensureRows(data.incomeEligibility?.rows, { memberName: '', cashIncome: '', nonCashIncome: '', totalIncome: '' });
        return `
            ${renderBeforeYouStart(['Prepare your personal details.', 'Prepare family or project details.', 'Prepare your signature file.'])}
            ${renderGuidedSection('section-client-data', '1. Client Identifying Data', 'Basic personal details used in your application.', `
                <div class="post-approval-fields">
                    ${renderField('Name', 'clientIdentifyingData.name', data.clientIdentifyingData?.name || '', 'text')}
                    ${renderField('Age', 'clientIdentifyingData.age', data.clientIdentifyingData?.age || '', 'number')}
                    ${renderField('Address', 'clientIdentifyingData.address', data.clientIdentifyingData?.address || '', 'text', true)}
                    ${renderField('Name of spouse', 'clientIdentifyingData.spouseName', data.clientIdentifyingData?.spouseName || '', 'text')}
                    ${renderReadOnlyField('City', data.clientIdentifyingData?.city || 'Butuan City')}
                </div>
            `)}
            ${renderGuidedSection('section-project-type', '2. Type of Project', 'Describe the project and participating family members.', `
                <div class="post-approval-fields">
                    ${renderField('Project type', 'familyEnterprise.projectType', data.familyEnterprise?.projectType || '', 'text')}
                </div>
                <div class="post-approval-repeatable__header">
                    <span class="post-approval-repeatable__title">Family members participating</span>
                    <button type="button" class="btn-outline small" data-row-action="add-family">Add family member</button>
                </div>
                <div class="guided-repeatable-stack">${familyMembers.map((row, index) => renderFamilyMemberRow(row, index)).join('')}</div>
            `)}
            ${renderGuidedSection('section-income', '3. Income Eligibility Requirement', 'Add each working family member and income row.', `
                <div class="post-approval-repeatable__header">
                    <span class="post-approval-repeatable__title">Income rows</span>
                    <button type="button" class="btn-outline small" data-row-action="add-income">Add income row</button>
                </div>
                <div class="guided-repeatable-stack">${incomeRows.map((row, index) => renderIncomeRow(row, index)).join('')}</div>
                <div class="post-approval-fields">
                    ${renderField('Total family income', 'incomeEligibility.totalFamilyIncome', data.incomeEligibility?.totalFamilyIncome || '', 'number')}
                </div>
            `)}
            ${renderGuidedSection('section-signature', '4. Signature and Upload', 'Add the signature details used for this form.', `
                <div class="post-approval-fields">
                    ${renderField('Participant signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderField('Date signed', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Participant signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            `)}
            ${renderApplicantReviewerNote(state.task?.reviewerRemarks)}
        `;
    }

    function renderBusinessPlanMobile(payload) {
        const data = payload || {};
        return `
            ${renderBeforeYouStart(['Prepare your business idea.', 'Prepare sales and cost estimates.', 'Prepare your signature upload.'])}
            ${renderGuidedSection('section-overview', '1. Overview', 'Basic business or project overview.', `
                <div class="post-approval-fields">
                    ${renderTextarea('Brief description of business/project', 'executiveSummary', data.executiveSummary || '', true)}
                    ${renderTextarea('Brief profile of entrepreneur', 'overview.businessGoal', data.overview?.businessGoal || '', true)}
                    ${renderTextarea('Contribution of project to economy', 'overview.economicContribution', data.overview?.economicContribution || '', true)}
                    ${renderTextarea('Product description', 'overview.productDescription', data.overview?.productDescription || '', true)}
                </div>
            `, { collapsible: true })}
            ${renderGuidedSection('section-marketing-plan', '2. Marketing Plan', 'Customer, competitor, and promotion details.', `
                <div class="post-approval-fields">
                    ${renderTextarea('Comparison with competitors', 'marketStrategy.competitors', data.marketStrategy?.competitors || '', true)}
                    ${renderField('Location', 'marketStrategy.location', data.marketStrategy?.location || '', 'text')}
                    ${renderField('Market area', 'marketStrategy.marketArea', data.marketStrategy?.marketArea || '', 'text')}
                    ${renderTextarea('Primary customers', 'marketStrategy.customerProfile', data.marketStrategy?.customerProfile || '', true)}
                    ${renderField('Total demand', 'marketStrategy.totalDemand', data.marketStrategy?.totalDemand || '', 'text')}
                    ${renderField('Selling price', 'marketStrategy.sellingPrice', data.marketStrategy?.sellingPrice || '', 'text')}
                    ${renderTextarea('Promotional measures', 'marketStrategy.promotionalMeasures', data.marketStrategy?.promotionalMeasures || '', true)}
                    ${renderTextarea('Marketing strategy', 'marketStrategy.marketingStrategy', data.marketStrategy?.marketingStrategy || '', true)}
                    ${renderField('Marketing budget', 'marketStrategy.marketingBudget', data.marketStrategy?.marketingBudget || '', 'text')}
                </div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-production-plan', '3. Production Plan', 'Production process, materials, labor, and capacity.', `
                <div class="post-approval-fields">
                    ${renderTextarea('Production or service process', 'operationsPlan.productionProcess', data.operationsPlan?.productionProcess || '', true)}
                    ${renderField('Fixed capital', 'operationsPlan.fixedCapital', data.operationsPlan?.fixedCapital || '', 'text')}
                    ${renderField('Life of fixed capital', 'operationsPlan.fixedCapitalLife', data.operationsPlan?.fixedCapitalLife || '', 'text')}
                    ${renderField('Sources of equipment', 'operationsPlan.equipmentSources', data.operationsPlan?.equipmentSources || '', 'text')}
                    ${renderField('Planned capacity', 'operationsPlan.plannedCapacity', data.operationsPlan?.plannedCapacity || '', 'text')}
                    ${renderField('Future capacity', 'operationsPlan.futureCapacity', data.operationsPlan?.futureCapacity || '', 'text')}
                    ${renderTextarea('Raw materials', 'operationsPlan.rawMaterials', data.operationsPlan?.rawMaterials || '', true)}
                    ${renderField('Cost of raw materials', 'operationsPlan.rawMaterialCost', data.operationsPlan?.rawMaterialCost || '', 'text')}
                    ${renderTextarea('Availability of raw materials', 'operationsPlan.rawMaterialAvailability', data.operationsPlan?.rawMaterialAvailability || '', true)}
                    ${renderTextarea('Labor', 'operationsPlan.labor', data.operationsPlan?.labor || '', true)}
                    ${renderField('Cost of labor', 'operationsPlan.laborCost', data.operationsPlan?.laborCost || '', 'text')}
                    ${renderTextarea('Availability of labor', 'operationsPlan.laborAvailability', data.operationsPlan?.laborAvailability || '', true)}
                </div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-management-plan', '4. Organization and Management', 'Pre-operating activities and costs.', `
                <div class="post-approval-fields">
                    ${renderTextarea('Pre-operating activities', 'implementationSchedule.summary', data.implementationSchedule?.summary || '', true)}
                    ${renderField('Pre-operating costs', 'implementationSchedule.preOperatingCosts', data.implementationSchedule?.preOperatingCosts || '', 'text')}
                </div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-financial-plan', '5. Financial Plan', 'Project cost and financial plan details.', `
                <div class="post-approval-fields">
                    ${renderField('Project cost', 'financialPlan.startupCapital', data.financialPlan?.startupCapital || '', 'text')}
                </div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-signature', '6. Signature', 'Add the final signature details for your business plan.', `
                <div class="post-approval-fields">
                    ${renderField('Signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderField('Signed date', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            `)}
            ${renderApplicantReviewerNote(state.task?.reviewerRemarks)}
        `;
    }

    function renderBuhatSaPagpanumpaMobile(payload) {
        const data = payload || {};
        return `
            ${renderBeforeYouStart(['Review your answers first.', 'Prepare beneficiary signature file.', 'Prepare co-maker signature file.'])}
            ${renderGuidedSection('section-beneficiary-info', '1. Beneficiary Information', 'Review the beneficiary details.', `
                <div class="post-approval-fields">
                    ${renderField('Full name', 'beneficiary.fullName', data.beneficiary?.fullName || '', 'text')}
                    ${renderField('Age', 'beneficiary.age', data.beneficiary?.age || '', 'number')}
                    ${renderField('Address line', 'beneficiary.addressLine', data.beneficiary?.addressLine || '', 'text', true)}
                    ${renderField('Barangay', 'beneficiary.barangay', data.beneficiary?.barangay || '', 'text')}
                    ${renderField('City', 'beneficiary.city', data.beneficiary?.city || '', 'text')}
                </div>
            `)}
            ${renderGuidedSection('section-program-details', '2. Program and Project', 'Program details tied to this undertaking.', `
                <div class="post-approval-fields">
                    ${renderField('Program name', 'program.programName', data.program?.programName || '', 'text')}
                    ${renderField('Project name', 'program.projectName', data.program?.projectName || '', 'text')}
                    ${renderField('Awarded amount', 'program.awardedAmount', data.program?.awardedAmount || '', 'text')}
                </div>
            `)}
            ${renderGuidedSection('section-co-maker', '3. Co-maker Information', 'Review the co-maker details.', `
                <div class="post-approval-fields">
                    ${renderField('Co-maker full name', 'coMaker.fullName', data.coMaker?.fullName || '', 'text')}
                    ${renderField('Address line', 'coMaker.addressLine', data.coMaker?.addressLine || '', 'text', true)}
                    ${renderField('Barangay', 'coMaker.barangay', data.coMaker?.barangay || '', 'text')}
                    ${renderField('City', 'coMaker.city', data.coMaker?.city || '', 'text')}
                </div>
            `)}
            ${renderGuidedSection('section-dates', '4. Dates', 'Review the signing dates.', `
                <div class="post-approval-fields">
                    ${renderField('Date signed', 'documentDates.signedDate', data.documentDates?.signedDate || '', 'date')}
                    ${renderField('Year', 'documentDates.signedYear', data.documentDates?.signedYear || '', 'number')}
                </div>
            `)}
            ${renderGuidedSection('section-signatures', '5. Signatures', 'Upload the beneficiary and co-maker signatures.', `
                <div class="post-approval-fields">
                    ${renderField('Beneficiary signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderUploadField('Beneficiary signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                    ${renderField('Co-maker signed name', 'coMakerSignature.signedName', data.coMakerSignature?.signedName || '', 'text')}
                    ${renderUploadField('Co-maker signature upload', 'coMakerSignature.signatureUpload', data.coMakerSignature?.signatureUpload || null)}
                </div>
            `)}
            ${renderApplicantReviewerNote(state.task?.reviewerRemarks)}
        `;
    }

    function renderMungkahingMobile(payload) {
        const data = payload || {};
        const modalityRows = ensureRows(data.modalityApplication?.rows, { partnerSource: '', contribution: '', quantity: '' });
        const materialsRows = ensureRows(data.businessOperation?.materials?.rows, { material: '', quantity: '', unit: '', unitPrice: '', productionCycle: '', estimatedQuantity: '' });
        const laborRows = ensureRows(data.businessOperation?.labor?.rows, { workerName: '', position: '', dailyWage: '' });
        const toolRows = ensureRows(data.businessOperation?.toolsEquipment?.rows, { toolName: '', quantity: '', unit: '', currentCost: '', estimatedCost: '', usefulLife: '', productionCycle: '', depreciationCost: '' });
        const expenseRows = ensureRows(data.businessOperation?.operatingExpenses?.rows, { expenseType: '', paymentInterval: '', estimatedAmount: '' });
        const salesRows = ensureRows(data.businessOperation?.salesProjection?.rows, { product: '', quantity: '', unit: '', sellingQuantityPerPiece: '', estimatedSales: '' });
        const spendingRows = ensureRows(data.capitalFundSpendingPlan?.rows, { expense: '', amount: '', usageSchedule: '' });
        const mapRows = (rows, action, builder) => `<div class="guided-repeatable-stack">${rows.map((row, index) => builder(row, index, action)).join('')}</div>`;
        const basicRowCard = (title, fields, action, index) => renderRepeatableMiniCard(`${title} ${index + 1}`, fields, action, index);

        return `
            ${renderBeforeYouStart(['Prepare project details.', 'Prepare budget estimates.', 'Prepare your signature upload.'])}
            ${renderGuidedSection('section-project-info', '1. Project Information', 'Basic information about the proposed project.', `
                <div class="post-approval-fields">
                    ${renderField('Participant name', 'projectInformation.participantName', data.projectInformation?.participantName || '', 'text')}
                    ${renderField('Project location', 'projectInformation.projectLocation', data.projectInformation?.projectLocation || '', 'text')}
                    ${renderField('Project name', 'projectInformation.projectName', data.projectInformation?.projectName || '', 'text')}
                    ${renderField('Date', 'projectInformation.date', data.projectInformation?.date || '', 'date')}
                    ${renderField('Estimated quantity', 'projectInformation.estimatedQuantity', data.projectInformation?.estimatedQuantity || '', 'text')}
                    ${renderField('Amount from CSWDD', 'projectInformation.amountFromCSWDD', data.projectInformation?.amountFromCSWDD || '', 'text')}
                    ${renderField('Other funding', 'projectInformation.otherFunding', data.projectInformation?.otherFunding || '', 'text')}
                    ${renderField('Savings account number', 'projectInformation.savingsAccountNumber', data.projectInformation?.savingsAccountNumber || '', 'text')}
                </div>
            `, { collapsible: true })}
            ${renderGuidedSection('section-rationale', '2. Rationale', 'Explain why this project is needed.', `
                <div class="post-approval-fields">
                    ${renderTextarea('Project rationale', 'projectInformation.rationale', data.projectInformation?.rationale || '', true)}
                </div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-modality', '3. Modality Application / Partner Contribution', 'Add each partner or contribution row.', `
                <div class="post-approval-repeatable__header"><span class="post-approval-repeatable__title">Partner rows</span><button type="button" class="btn-outline small" data-row-action="add-mp-contribution">Add partner row</button></div>
                ${mapRows(modalityRows, 'remove-mp-contribution', (row, index, action) => basicRowCard('Partner row', `
                    ${renderField('Partner/source', `modalityApplication.rows.${index}.partnerSource`, row.partnerSource || '', 'text')}
                    ${renderField('Contribution', `modalityApplication.rows.${index}.contribution`, row.contribution || '', 'text')}
                    ${renderField('Quantity', `modalityApplication.rows.${index}.quantity`, row.quantity || '', 'text')}
                `, action, index))}
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-materials', '4. Materials', 'Add the materials needed for the project.', `
                <div class="post-approval-repeatable__header"><span class="post-approval-repeatable__title">Material rows</span><button type="button" class="btn-outline small" data-row-action="add-mp-material">Add material row</button></div>
                ${mapRows(materialsRows, 'remove-mp-material', (row, index, action) => basicRowCard('Material row', `
                    ${renderField('Material', `businessOperation.materials.rows.${index}.material`, row.material || '', 'text')}
                    ${renderField('Quantity', `businessOperation.materials.rows.${index}.quantity`, row.quantity || '', 'text')}
                    ${renderField('Unit', `businessOperation.materials.rows.${index}.unit`, row.unit || '', 'text')}
                    ${renderField('Unit price', `businessOperation.materials.rows.${index}.unitPrice`, row.unitPrice || '', 'number')}
                    ${renderField('Production cycle', `businessOperation.materials.rows.${index}.productionCycle`, row.productionCycle || '', 'text')}
                    ${renderField('Estimated quantity', `businessOperation.materials.rows.${index}.estimatedQuantity`, row.estimatedQuantity || '', 'text')}
                `, action, index))}
                <div class="post-approval-fields">${renderField('Materials total', 'businessOperation.materials.totalCost', data.businessOperation?.materials?.totalCost || '', 'number')}</div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-labor', '5. Labor', 'Add the labor rows for the project.', `
                <div class="post-approval-repeatable__header"><span class="post-approval-repeatable__title">Labor rows</span><button type="button" class="btn-outline small" data-row-action="add-mp-labor">Add labor row</button></div>
                ${mapRows(laborRows, 'remove-mp-labor', (row, index, action) => basicRowCard('Labor row', `
                    ${renderField('Worker name', `businessOperation.labor.rows.${index}.workerName`, row.workerName || '', 'text')}
                    ${renderField('Position', `businessOperation.labor.rows.${index}.position`, row.position || '', 'text')}
                    ${renderField('Daily wage', `businessOperation.labor.rows.${index}.dailyWage`, row.dailyWage || '', 'number')}
                `, action, index))}
                <div class="post-approval-fields">${renderField('Labor total', 'businessOperation.labor.totalWages', data.businessOperation?.labor?.totalWages || '', 'number')}</div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-tools', '6. Tools / Equipment', 'Add equipment rows with estimated costs.', `
                <div class="post-approval-repeatable__header"><span class="post-approval-repeatable__title">Tool rows</span><button type="button" class="btn-outline small" data-row-action="add-mp-equipment">Add tool row</button></div>
                ${mapRows(toolRows, 'remove-mp-equipment', (row, index, action) => basicRowCard('Tool row', `
                    ${renderField('Tool name', `businessOperation.toolsEquipment.rows.${index}.toolName`, row.toolName || '', 'text')}
                    ${renderField('Quantity', `businessOperation.toolsEquipment.rows.${index}.quantity`, row.quantity || '', 'text')}
                    ${renderField('Unit', `businessOperation.toolsEquipment.rows.${index}.unit`, row.unit || '', 'text')}
                    ${renderField('Current cost', `businessOperation.toolsEquipment.rows.${index}.currentCost`, row.currentCost || '', 'number')}
                    ${renderField('Estimated cost', `businessOperation.toolsEquipment.rows.${index}.estimatedCost`, row.estimatedCost || '', 'number')}
                    ${renderField('Useful life', `businessOperation.toolsEquipment.rows.${index}.usefulLife`, row.usefulLife || '', 'text')}
                    ${renderField('Production cycle', `businessOperation.toolsEquipment.rows.${index}.productionCycle`, row.productionCycle || '', 'text')}
                    ${renderField('Depreciation cost', `businessOperation.toolsEquipment.rows.${index}.depreciationCost`, row.depreciationCost || '', 'number')}
                `, action, index))}
                <div class="post-approval-fields">${renderField('Tools total', 'businessOperation.toolsEquipment.totalCost', data.businessOperation?.toolsEquipment?.totalCost || '', 'number')}</div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-expenses', '7. Operating Expenses', 'Add the operating expense entries.', `
                <div class="post-approval-repeatable__header"><span class="post-approval-repeatable__title">Expense rows</span><button type="button" class="btn-outline small" data-row-action="add-mp-expense">Add expense row</button></div>
                ${mapRows(expenseRows, 'remove-mp-expense', (row, index, action) => basicRowCard('Expense row', `
                    ${renderField('Expense type', `businessOperation.operatingExpenses.rows.${index}.expenseType`, row.expenseType || '', 'text')}
                    ${renderField('Payment interval', `businessOperation.operatingExpenses.rows.${index}.paymentInterval`, row.paymentInterval || '', 'text')}
                    ${renderField('Estimated amount', `businessOperation.operatingExpenses.rows.${index}.estimatedAmount`, row.estimatedAmount || '', 'number')}
                `, action, index))}
                <div class="post-approval-fields">${renderField('Grand total', 'businessOperation.operatingExpenses.grandTotal', data.businessOperation?.operatingExpenses?.grandTotal || '', 'number')}</div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-sales', '8. Product / Sales', 'Add product or sales entries.', `
                <div class="post-approval-repeatable__header"><span class="post-approval-repeatable__title">Product rows</span><button type="button" class="btn-outline small" data-row-action="add-mp-sale">Add product row</button></div>
                ${mapRows(salesRows, 'remove-mp-sale', (row, index, action) => basicRowCard('Product row', `
                    ${renderField('Product', `businessOperation.salesProjection.rows.${index}.product`, row.product || '', 'text')}
                    ${renderField('Quantity', `businessOperation.salesProjection.rows.${index}.quantity`, row.quantity || '', 'text')}
                    ${renderField('Unit', `businessOperation.salesProjection.rows.${index}.unit`, row.unit || '', 'text')}
                    ${renderField('Selling quantity per piece', `businessOperation.salesProjection.rows.${index}.sellingQuantityPerPiece`, row.sellingQuantityPerPiece || '', 'text')}
                    ${renderField('Estimated sales', `businessOperation.salesProjection.rows.${index}.estimatedSales`, row.estimatedSales || '', 'number')}
                `, action, index))}
                <div class="post-approval-fields">${renderField('Gross sales', 'businessOperation.salesProjection.grossSales', data.businessOperation?.salesProjection?.grossSales || '', 'number')}</div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-profit', '9. Profit Computation', 'Review the profit computation values.', `
                <div class="post-approval-fields">
                    ${renderField('Sales', 'profitComputation.sales', data.profitComputation?.sales || '', 'number')}
                    ${renderField('Raw materials', 'profitComputation.rawMaterials', data.profitComputation?.rawMaterials || '', 'number')}
                    ${renderField('Labor', 'profitComputation.labor', data.profitComputation?.labor || '', 'number')}
                    ${renderField('Depreciation', 'profitComputation.depreciation', data.profitComputation?.depreciation || '', 'number')}
                    ${renderField('Other expenses', 'profitComputation.otherExpenses', data.profitComputation?.otherExpenses || '', 'number')}
                    ${renderField('Operating cost', 'profitComputation.operatingCost', data.profitComputation?.operatingCost || '', 'number')}
                    ${renderField('Gross profit', 'profitComputation.grossProfit', data.profitComputation?.grossProfit || '', 'number')}
                    ${renderField('Net profit', 'profitComputation.netProfit', data.profitComputation?.netProfit || '', 'number')}
                </div>
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-capital-fund', '10. Capital Fund Spending Plan', 'Add the capital fund spending plan rows.', `
                <div class="post-approval-repeatable__header"><span class="post-approval-repeatable__title">Spending rows</span><button type="button" class="btn-outline small" data-row-action="add-mp-spending">Add spending row</button></div>
                ${mapRows(spendingRows, 'remove-mp-spending', (row, index, action) => basicRowCard('Spending row', `
                    ${renderField('Expense', `capitalFundSpendingPlan.rows.${index}.expense`, row.expense || '', 'text')}
                    ${renderField('Amount', `capitalFundSpendingPlan.rows.${index}.amount`, row.amount || '', 'number')}
                    ${renderField('Usage schedule', `capitalFundSpendingPlan.rows.${index}.usageSchedule`, row.usageSchedule || '', 'text')}
                `, action, index))}
            `, { collapsible: true, open: false })}
            ${renderGuidedSection('section-signature', '11. Participant Signature', 'Add your final signature details.', `
                <div class="post-approval-fields">
                    ${renderField('Signed name', 'applicantSignature.signedName', data.applicantSignature?.signedName || '', 'text')}
                    ${renderField('Signed date', 'applicantSignature.signedDate', data.applicantSignature?.signedDate || '', 'date')}
                    ${renderUploadField('Signature upload', 'applicantSignature.signatureUpload', data.applicantSignature?.signatureUpload || null)}
                </div>
            `, { collapsible: true, open: false })}
            ${renderApplicantReviewerNote(state.task?.reviewerRemarks)}
        `;
    }

    function renderValidationMobile(payload) {
        const data = payload || {};
        return `
            ${renderBeforeYouStart(['Review your personal details.', 'Prepare updated household answers.', 'Prepare your signature upload.'])}
            ${renderGuidedSection('section-applicant-info', '1. Applicant Information', 'Fill in the personal details requested in the validation form.', `
                <div class="post-approval-fields">
                    ${renderField('Date of validation', 'applicantDetails.validationDate', data.applicantDetails?.validationDate || '', 'date')}
                    ${renderField('Last name', 'applicantDetails.lastName', data.applicantDetails?.lastName || '', 'text')}
                    ${renderField('First name', 'applicantDetails.firstName', data.applicantDetails?.firstName || '', 'text')}
                    ${renderField('Middle name', 'applicantDetails.middleName', data.applicantDetails?.middleName || '', 'text')}
                    ${renderField('Purok', 'applicantDetails.purok', data.applicantDetails?.purok || '', 'text')}
                    ${renderField('Barangay', 'applicantDetails.barangay', data.applicantDetails?.barangay || '', 'text')}
                    ${renderField('Birthdate', 'applicantDetails.birthdate', data.applicantDetails?.birthdate || '', 'date')}
                    ${renderField('Educational attainment', 'applicantDetails.educationalAttainment', data.applicantDetails?.educationalAttainment || '', 'text')}
                    ${renderField('Contact number', 'applicantDetails.contactNumber', data.applicantDetails?.contactNumber || '', 'text')}
                </div>
            `)}
            ${renderGuidedSection('section-checklist', '2. Checklist', 'Answer the membership checklist items below.', `
                <div class="post-approval-fields">
                    ${renderSelectField('Pantawid Member', 'membershipChecklist.pantawidMember', data.membershipChecklist?.pantawidMember || '', ['', 'Yes', 'No'])}
                    ${renderField('Specify', 'membershipChecklist.pantawidSpecify', data.membershipChecklist?.pantawidSpecify || '', 'text')}
                    ${renderSelectField('SLPA Member', 'membershipChecklist.slpaMember', data.membershipChecklist?.slpaMember || '', ['', 'Yes', 'No'])}
                    ${renderField('Specify', 'membershipChecklist.slpaSpecify', data.membershipChecklist?.slpaSpecify || '', 'text')}
                </div>
            `)}
            ${renderGuidedSection('section-assessment', '3. Eligibility Assessment', 'Confirm the applicant-side assessment details only.', `
                <div class="post-approval-fields">
                    ${renderTextarea('Assistance process understanding', 'participantAssessment.assistanceUnderstanding', data.participantAssessment?.assistanceUnderstanding || '', true)}
                    ${renderField('Participant signed name', 'participantSignature.signedName', data.participantSignature?.signedName || '', 'text')}
                    ${renderField('Date signed', 'participantSignature.signedDate', data.participantSignature?.signedDate || '', 'date')}
                </div>
            `)}
            ${renderGuidedSection('section-signature', '4. Signature and Upload', 'Upload the participant signature for this form.', `
                <div class="post-approval-fields">
                    ${renderUploadField('Participant signature upload', 'participantSignature.signatureUpload', data.participantSignature?.signatureUpload || null)}
                </div>
            `)}
            ${renderApplicantReviewerNote(state.task?.reviewerRemarks)}
        `;
    }

    function renderGuidedSection(id, title, description, body, options = {}) {
        const tag = options.collapsible ? 'details' : 'section';
        const openAttr = options.collapsible && options.open !== false ? ' open' : '';
        const summary = options.collapsible
            ? `<summary class="guided-form-section__summary"><span>${escapeHtml(title)}</span><small>${escapeHtml(description || '')}</small></summary>`
            : `<div class="guided-form-section__header"><h3>${escapeHtml(title)}</h3>${description ? `<p>${escapeHtml(description)}</p>` : ''}</div>`;

        return `
            <${tag} class="guided-form-section${options.collapsible ? ' guided-form-section--accordion' : ''}" id="${escapeAttribute(id)}"${openAttr}>
                ${summary}
                <div class="guided-form-section__body">${body}</div>
            </${tag}>
        `;
    }

    function renderBeforeYouStart(items) {
        return `
            <section class="guided-form-start" id="section-before-you-start">
                <div class="guided-form-start__header">
                    <h3>Before you start</h3>
                    <p>Prepare these details first so the form is easier to complete on mobile.</p>
                </div>
                <ul class="guided-form-start__list">
                    ${(items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join('')}
                </ul>
            </section>
        `;
    }

    function renderRepeatableMiniCard(title, fieldsHtml, action, index) {
        return `
            <article class="guided-repeatable-card">
                <div class="guided-repeatable-card__header">
                    <strong>${escapeHtml(title)}</strong>
                    <button type="button" class="btn-outline small post-approval-row-action" data-row-action="${escapeAttribute(action)}" data-row-index="${index}">Remove entry</button>
                </div>
                <div class="post-approval-fields">${fieldsHtml}</div>
            </article>
        `;
    }

    function renderApplicantReviewerNote(remarks) {
        if (!remarks) {
            return '';
        }

        return `
            <section class="guided-review-note">
                <span class="overview-label">Review note</span>
                <p>${escapeHtml(remarks)}</p>
            </section>
        `;
    }

    function renderTask() {
        const task = state.task;
        const subtitle = document.getElementById('postApprovalWorkspaceSubtitle');
        const notice = document.getElementById('postApprovalWorkspaceNotice');
        const form = document.getElementById('postApprovalForm');
        const sections = document.getElementById('postApprovalFormSections');
        const staffSections = document.getElementById('postApprovalStaffSections');
        const saveButton = document.getElementById('postApprovalSaveButton');
        const submitButton = document.getElementById('postApprovalSubmitButton');

        if (!task) {
            renderFatalState('This application form is unavailable.');
            return;
        }

        setText('formPageTitle', task.title);
        setText('formPageSubtitle', task.summary || task.helpText || 'Complete the required sections below.');
        setText('formPageStatus', task.status);
        setText('formPageCompletion', `${task.completion || 0}%`);
        setText('formPageReview', buildReviewState(task));
        setText('postApprovalWorkspaceStatus', task.status);
        document.body.dataset.renderMode = state.renderMode;
        renderFormGuidance(task);
        renderSectionNavigator(task);

        if (subtitle) {
            subtitle.textContent = task.summary || task.helpText || '';
        }

        if (!task.interactive) {
            if (notice) {
                notice.hidden = false;
                notice.textContent = task.helpText || 'This requirement will open after the earlier application steps are complete.';
            }
            form?.classList.add('is-hidden');
            if (sections) sections.innerHTML = '';
            if (staffSections) {
                staffSections.innerHTML = renderStaffSections(task.staffSections || [], task.reviewerRemarks);
                staffSections.hidden = staffSections.innerHTML.trim() === '';
            }
            return;
        }

        if (notice) {
            const workspaceNotice = buildPostApprovalNotice(task);
            notice.hidden = workspaceNotice === '';
            notice.textContent = workspaceNotice;
        }
        form?.classList.remove('is-hidden');
        if (sections) {
            sections.innerHTML = `${renderFormErrorSummary(state.formErrors, task.code)}${renderTaskSections(task.code, state.activePayload || task.payload || {})}`;
        }
        if (staffSections) {
            staffSections.innerHTML = renderStaffSections(task.staffSections || [], task.reviewerRemarks);
            staffSections.hidden = staffSections.innerHTML.trim() === '';
        }
        if (saveButton) {
            saveButton.disabled = task.status === 'Submitted' || task.status === 'Verified';
        }
        if (submitButton) {
            submitButton.disabled = task.status === 'Submitted' || task.status === 'Verified';
        }

        applyFormEditability(task);
        applyFieldErrors(state.formErrors);
    }

    function renderSectionNavigator(task) {
        const nav = document.getElementById('formSectionNav');
        if (!nav) {
            return;
        }

        const sections = sectionDefinitionsForTask(task.code || '');
        if (sections.length === 0) {
            nav.hidden = true;
            nav.innerHTML = '';
            return;
        }

        nav.hidden = false;
        nav.innerHTML = sections.map((section) => `
            <a class="form-section-nav__link" href="#${escapeAttribute(section.id)}">${escapeHtml(section.label)}</a>
        `).join('');
    }

    function sectionDefinitionsForTask(code) {
        const map = {
            availment_form: [
                { id: 'section-client-data', label: 'Client Data' },
                { id: 'section-project-type', label: 'Project Type' },
                { id: 'section-income', label: 'Income' },
                { id: 'section-signature', label: 'Signature' },
            ],
            validation_form: [
                { id: 'section-applicant-info', label: 'Applicant Info' },
                { id: 'section-checklist', label: 'Checklist' },
                { id: 'section-assessment', label: 'Assessment' },
                { id: 'section-signature', label: 'Signature' },
            ],
            mungkahing_proyekto: [
                { id: 'section-project-info', label: 'Project Info' },
                { id: 'section-rationale', label: 'Rationale' },
                { id: 'section-modality', label: 'Modality' },
                { id: 'section-materials', label: 'Materials' },
                { id: 'section-labor', label: 'Labor' },
                { id: 'section-tools', label: 'Tools' },
                { id: 'section-expenses', label: 'Expenses' },
                { id: 'section-sales', label: 'Sales' },
                { id: 'section-profit', label: 'Profit' },
                { id: 'section-capital-fund', label: 'Capital Fund' },
                { id: 'section-signature', label: 'Signature' },
            ],
            business_plan: [
                { id: 'section-overview', label: 'Overview' },
                { id: 'section-marketing-plan', label: 'Marketing Plan' },
                { id: 'section-production-plan', label: 'Production Plan' },
                { id: 'section-management-plan', label: 'Organization & Management' },
                { id: 'section-financial-plan', label: 'Financial Plan' },
                { id: 'section-signature', label: 'Signature' },
            ],
            buhat_sa_pagpanumpa: [
                { id: 'section-beneficiary-info', label: 'Beneficiary Info' },
                { id: 'section-program-details', label: 'Program Details' },
                { id: 'section-co-maker', label: 'Co-maker' },
                { id: 'section-dates', label: 'Dates' },
                { id: 'section-signatures', label: 'Signatures' },
            ],
        };

        return map[code] || [];
    }
})();

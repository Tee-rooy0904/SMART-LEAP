(function () {
    const state = {
        baseUrl: window.SMARTLEAP_BASE_URL || '',
        queue: [],
        activeTask: null,
        initialTaskId: Number(window.SMARTLEAP_REVIEW_TASK_ID || 0),
        embedded: Boolean(window.SMARTLEAP_REVIEW_EMBEDDED),
    };

    document.addEventListener('DOMContentLoaded', init);

    async function init() {
        document.getElementById('refreshReviewQueue')?.addEventListener('click', loadQueue);
        document.getElementById('reviewTaskList')?.addEventListener('click', handleQueueClick);
        if (!state.embedded) {
            document.getElementById('reviewForm')?.addEventListener('submit', handleReviewSubmit);
        }
        document.getElementById('reviewStaffSections')?.addEventListener('change', handleReviewerUploadChange);
        await loadQueue();
    }

    async function loadQueue() {
        try {
            const payload = await fetchJson('api/post-approval-review');
            state.queue = payload.tasks || [];
            renderSummary(payload.summary || {});
            renderQueue();
            if (state.initialTaskId > 0) {
                const taskId = state.initialTaskId;
                state.initialTaskId = 0;
                await loadTask(taskId);
            } else if (state.activeTask) {
                await loadTask(state.activeTask.id);
            }
        } catch (error) {
            renderQueue(error.message || 'Unable to load the review queue.');
            showToast(error.message || 'Unable to load the review queue.', 'warning');
        }
    }

    function renderSummary(summary) {
        setText('summarySubmitted', String(summary.submitted || 0));
        setText('summaryNeedsCorrection', String(summary.needsCorrection || 0));
        setText('summaryVerified', String(summary.verified || 0));
        setText('summaryRejected', String(summary.rejected || 0));
    }

    function renderQueue(errorMessage) {
        const container = document.getElementById('reviewTaskList');
        if (!container) {
            return;
        }

        if (errorMessage) {
            container.innerHTML = `<article class="empty-state">${escapeHtml(errorMessage)}</article>`;
            return;
        }

        if (state.queue.length === 0) {
            container.innerHTML = '<article class="empty-state">No fill-up form requirements are available for review yet.</article>';
            return;
        }

        container.innerHTML = state.queue.map((task) => `
            <button type="button" class="task-card ${state.activeTask?.id === task.id ? 'is-active' : ''}" data-task-id="${task.id}">
                <div class="task-card__meta">
                    <span class="status-chip status-${slugify(task.status)}">${escapeHtml(task.status)}</span>
                    <span class="task-card__type">${escapeHtml(task.title)}</span>
                </div>
                <strong>${escapeHtml(task.applicant.name)}</strong>
                <p>${escapeHtml(task.applicant.barangay || 'No barangay')} | ${escapeHtml(task.applicant.businessName || 'No business name')}</p>
                <small>${escapeHtml(task.submittedAt ? `Submitted ${formatDateTime(task.submittedAt)}` : 'Not yet submitted')}</small>
            </button>
        `).join('');
    }

    async function handleQueueClick(event) {
        const card = event.target.closest('[data-task-id]');
        if (!card) {
            return;
        }
        await loadTask(Number(card.getAttribute('data-task-id')));
    }

    async function loadTask(taskId) {
        if (!taskId) {
            return;
        }

        try {
            const payload = await fetchJson(`api/post-approval-review/task?task_id=${taskId}`);
            state.activeTask = payload.task || null;
            renderQueue();
            renderWorkspace();
        } catch (error) {
            showToast(error.message || 'Unable to load that review task.', 'warning');
        }
    }

    function renderWorkspace() {
        const title = document.getElementById('reviewWorkspaceTitle');
        const meta = document.getElementById('reviewWorkspaceMeta');
        const status = document.getElementById('reviewWorkspaceStatus');
        const applicantCard = document.getElementById('reviewApplicantCard');
        const form = document.getElementById('reviewForm');
        const workspaceColumns = form?.querySelector('.workspace-columns');
        const applicantSections = document.getElementById('reviewApplicantSections');
        const staffSections = document.getElementById('reviewStaffSections');
        const history = document.getElementById('reviewSubmissionHistory');
        const decisionStatus = document.getElementById('reviewDecisionStatus');
        const decisionRemarks = document.getElementById('reviewDecisionRemarks');

        if (!state.activeTask) {
            title && (title.textContent = 'Select a submitted form');
            meta && (meta.textContent = 'Choose a task from the queue to inspect the applicant submission and complete staff review fields.');
            status && (status.textContent = 'Idle');
            applicantCard?.classList.add('is-hidden');
            form?.classList.add('is-hidden');
            workspaceColumns?.classList.remove('workspace-columns--document');
            workspaceColumns?.classList.remove('workspace-columns--buhat');
            return;
        }

        const task = state.activeTask;
        title && (title.textContent = task.title);
        meta && (meta.textContent = `${task.applicant.name} | ${task.applicant.barangay || 'No barangay'} | ${task.applicant.email}`);
        status && (status.textContent = task.status);
        applicantCard?.classList.remove('is-hidden');
        form?.classList.remove('is-hidden');
        workspaceColumns?.classList.toggle('workspace-columns--document', ['buhat_sa_pagpanumpa', 'business_plan'].includes(task.code));
        workspaceColumns?.classList.toggle('workspace-columns--buhat', task.code === 'buhat_sa_pagpanumpa');

        if (applicantCard) {
            applicantCard.innerHTML = `
                <div><strong>${escapeHtml(task.applicant.name)}</strong><span>${escapeHtml(task.applicant.email)}</span></div>
                <div><strong>Barangay</strong><span>${escapeHtml(task.applicant.barangay || '--')}</span></div>
                <div><strong>Contact</strong><span>${escapeHtml(task.applicant.contactNumber || '--')}</span></div>
                <div><strong>Business</strong><span>${escapeHtml(task.applicant.businessName || '--')}</span></div>
            `;
        }

        if (applicantSections) {
            applicantSections.innerHTML = task.code === 'availment_form'
                ? renderApplicantAvailment(task.payload || {})
                : task.code === 'buhat_sa_pagpanumpa'
                    ? renderApplicantBuhatSaPagpanumpa(task.payload || {})
                : task.code === 'business_plan'
                    ? renderApplicantBusinessPlan(task.payload || {})
                : task.code === 'mungkahing_proyekto'
                    ? renderApplicantMungkahingPaper(task.payload || {})
                    : renderApplicantValidation(task.payload || {});
        }

        if (staffSections) {
            staffSections.innerHTML = task.code === 'availment_form'
                ? renderStaffAvailment(task.payload?.staffReview || {})
                : task.code === 'buhat_sa_pagpanumpa'
                    ? renderStaffBuhatSaPagpanumpa(task.payload?.staffReview || {})
                : task.code === 'business_plan'
                    ? renderStaffBusinessPlan(task.payload?.staffReview || {})
                : task.code === 'mungkahing_proyekto'
                    ? renderStaffMungkahingPaper(task.payload?.staffReview || {}, task.payload || {})
                    : renderStaffValidation(task.payload?.staffReview || {});
        }

        if (history) {
            const submissions = Array.isArray(task.submissions) ? task.submissions : [];
            history.innerHTML = submissions.length === 0
                ? '<article class="history-item empty-state">No submission history available yet.</article>'
                : submissions.map((item) => `
                    <article class="history-item">
                        <strong>${escapeHtml(item.reviewStatus || 'Submitted')}</strong>
                        <div>${escapeHtml(item.submittedByName || 'Applicant')} | ${escapeHtml(formatDateTime(item.submittedAt))}</div>
                        ${state.embedded ? '' : `<div>${escapeHtml(item.reviewerRemarks || 'No reviewer remarks saved on this entry.')}</div>`}
                    </article>
                `).join('');
        }

        if (decisionStatus) {
            decisionStatus.value = ['Verified', 'Needs Correction', 'Rejected'].includes(task.status) ? task.status : 'Verified';
        }
        if (decisionRemarks) {
            decisionRemarks.value = task.reviewerRemarks || '';
        }
    }

    function renderApplicantAvailment(payload) {
        const familyMembers = payload.familyEnterprise?.members || [];
        const incomeRows = payload.incomeEligibility?.rows || [];
        const commitment = payload.clientCommitment || {};
        const agreedToRollBackSchedule = commitment.agreedToRollBackSchedule ?? commitment.agreedToSavingsCommitment;
        const agreedToWeeklySavings = commitment.agreedToWeeklySavings ?? commitment.agreedToSavingsCommitment;

        return `
            <div class="review-paper-document">
                ${renderReviewPaperPage(1, `
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('I.', 'CLIENT IDENTIFYING DATA')}
                        <div class="review-paper-line-grid review-paper-line-grid--two">
                            ${renderReviewPaperLineField('Name', payload.clientIdentifyingData?.name)}
                            ${renderReviewPaperLineField('Age', payload.clientIdentifyingData?.age)}
                            ${renderReviewPaperLineField('Address', payload.clientIdentifyingData?.address)}
                            ${renderReviewPaperLineField('Name of Spouse', payload.clientIdentifyingData?.spouseName)}
                        </div>
                    </section>
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('II.', 'TYPE OF PROJECT')}
                        <div class="review-paper-subtitle">A. Family Enterprise</div>
                        ${renderReviewPaperTable(`
                            <tr><th>Family Member Participating</th><th>Age</th><th>Activities</th></tr>
                        `, familyMembers.map((row) => `
                            <tr><td>${escapeHtml(row.name || '--')}</td><td>${escapeHtml(row.age || '--')}</td><td>${escapeHtml(row.activities || '--')}</td></tr>
                        `).join(''))}
                        <div class="review-paper-subtitle">B. Individual Assistance</div>
                        <div class="review-paper-line-grid review-paper-line-grid--two">
                            ${renderReviewPaperLineField('Clientele Category', payload.individualAssistance?.clienteleCategory)}
                            ${renderReviewPaperLineField('Nature of difficult circumstances', payload.individualAssistance?.natureOfDifficultCircumstances)}
                        </div>
                    </section>
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('III.', 'INCOME ELIGIBILITY REQUIREMENT')}
                        ${renderReviewPaperTable(`
                            <tr><th>Name of Working Family Members</th><th>Cash income</th><th>Non-cash income</th><th>Total</th></tr>
                        `, incomeRows.map((row) => `
                            <tr><td>${escapeHtml(row.memberName || '--')}</td><td>${escapeHtml(row.cashIncome || '--')}</td><td>${escapeHtml(row.nonCashIncome || '--')}</td><td>${escapeHtml(row.totalIncome || '--')}</td></tr>
                        `).join(''), `<tr><td colspan="3" class="review-paper-table__total-label">Total Family Income</td><td>${escapeHtml(payload.incomeEligibility?.totalFamilyIncome || '--')}</td></tr>`)}
                    </section>
                `)}
                ${renderReviewPaperPage(2, `
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('V.', 'SOCIAL RESPONSIBILITY AND WILLINGNESS TO SAVE (CLIENT)')}
                        <div class="review-paper-paragraph">
                            ${payload.clientCommitment?.agreedToPolicies ? 'Will abide by SMART LEAP policies' : 'Did not confirm SMART LEAP policies'}.
                            ${agreedToRollBackSchedule ? ' Will pay roll-back on time.' : ' Did not confirm roll-back schedule.'}
                            ${agreedToWeeklySavings ? ' Will generate weekly savings.' : ' Did not confirm weekly savings.'}
                            ${payload.clientCommitment?.notes ? ` Notes: ${escapeHtml(payload.clientCommitment.notes)}` : ''}
                        </div>
                    </section>
                    <section class="review-paper-section">
                        <div class="review-paper-signoff">
                            <div class="review-paper-signoff__label">Name and Signature of Participant</div>
                            <div class="review-paper-signoff__line">${escapeHtml(payload.applicantSignature?.signedName || '--')}</div>
                            <div class="review-paper-signoff__meta">Petsa: ${escapeHtml(payload.applicantSignature?.signedDate || '--')}</div>
                            ${renderReadOnlyUpload('Participant signature upload', payload.applicantSignature?.signatureUpload)}
                        </div>
                    </section>
                `)}
            </div>
        `;
    }

    function renderApplicantValidation(payload) {
        return `
            ${renderReadOnlySection('Applicant Details', [
                ['Date of validation', payload.applicantDetails?.validationDate],
                ['Last name', payload.applicantDetails?.lastName],
                ['First name', payload.applicantDetails?.firstName],
                ['Middle name', payload.applicantDetails?.middleName],
                ['Purok', payload.applicantDetails?.purok],
                ['Barangay', payload.applicantDetails?.barangay],
                ['Birthdate', payload.applicantDetails?.birthdate],
                ['Educational attainment', payload.applicantDetails?.educationalAttainment],
                ['Contact number', payload.applicantDetails?.contactNumber],
            ])}
            ${renderReadOnlySection('Checklist', [
                ['Pantawid Member', payload.membershipChecklist?.pantawidMember],
                ['Pantawid specify', payload.membershipChecklist?.pantawidSpecify],
                ['SLPA Member', payload.membershipChecklist?.slpaMember],
                ['SLPA specify', payload.membershipChecklist?.slpaSpecify],
            ])}
            ${renderReadOnlySection('Participant Signature', [
                ['Signed name', payload.participantSignature?.signedName],
                ['Date signed', payload.participantSignature?.signedDate],
            ], [renderReadOnlyUpload('Signature upload', payload.participantSignature?.signatureUpload)])}
        `;
    }

    function renderApplicantMungkahing(payload) {
        const sectoralRows = [
            ['Pantawid Babaye', payload.sectoralClassification?.pantawid?.sexFemale ? 'Checked' : ''],
            ['Pantawid Lalake', payload.sectoralClassification?.pantawid?.sexMale ? 'Checked' : ''],
            ['Pantawid Senior Citizens Babaye', payload.sectoralClassification?.pantawid?.seniorFemale ? 'Checked' : ''],
            ['Pantawid Senior Citizens Lalake', payload.sectoralClassification?.pantawid?.seniorMale ? 'Checked' : ''],
            ['Pantawid PWD Babaye', payload.sectoralClassification?.pantawid?.pwdFemale ? 'Checked' : ''],
            ['Pantawid PWD Lalake', payload.sectoralClassification?.pantawid?.pwdMale ? 'Checked' : ''],
            ['Pantawid IP Babaye', payload.sectoralClassification?.pantawid?.ipFemale ? 'Checked' : ''],
            ['Pantawid IP Lalake', payload.sectoralClassification?.pantawid?.ipMale ? 'Checked' : ''],
            ['Pantawid Solo Parent Babaye', payload.sectoralClassification?.pantawid?.soloParentFemale ? 'Checked' : ''],
            ['Pantawid Solo Parent Lalake', payload.sectoralClassification?.pantawid?.soloParentMale ? 'Checked' : ''],
            ['Non-Pantawid Babaye', payload.sectoralClassification?.nonPantawid?.sexFemale ? 'Checked' : ''],
            ['Non-Pantawid Lalake', payload.sectoralClassification?.nonPantawid?.sexMale ? 'Checked' : ''],
            ['Non-Pantawid Senior Citizens Babaye', payload.sectoralClassification?.nonPantawid?.seniorFemale ? 'Checked' : ''],
            ['Non-Pantawid Senior Citizens Lalake', payload.sectoralClassification?.nonPantawid?.seniorMale ? 'Checked' : ''],
            ['Non-Pantawid PWD Babaye', payload.sectoralClassification?.nonPantawid?.pwdFemale ? 'Checked' : ''],
            ['Non-Pantawid PWD Lalake', payload.sectoralClassification?.nonPantawid?.pwdMale ? 'Checked' : ''],
            ['Non-Pantawid IP Babaye', payload.sectoralClassification?.nonPantawid?.ipFemale ? 'Checked' : ''],
            ['Non-Pantawid IP Lalake', payload.sectoralClassification?.nonPantawid?.ipMale ? 'Checked' : ''],
            ['Non-Pantawid Solo Parent Babaye', payload.sectoralClassification?.nonPantawid?.soloParentFemale ? 'Checked' : ''],
            ['Non-Pantawid Solo Parent Lalake', payload.sectoralClassification?.nonPantawid?.soloParentMale ? 'Checked' : ''],
        ];
        const contributions = payload.modalityApplications?.rows || [];
        const materials = payload.businessOperation?.materials?.rows || [];
        const labor = payload.businessOperation?.labor?.rows || [];
        const equipment = payload.businessOperation?.toolsEquipment?.rows || [];
        const expenses = payload.businessOperation?.operatingExpenses?.rows || [];
        const sales = payload.businessOperation?.salesProjection?.rows || [];
        const spending = payload.spendingPlan?.rows || [];
        const income = payload.businessOperation?.incomeComputation || {};

        return `
            ${renderReadOnlySection('Kinatibuk-an Impormasyon Bahin sa Proyekto', [
                ['Ngalan sa Partisipante', payload.projectInformation?.participantName],
                ['Lokasyon sa Proyekto', payload.projectInformation?.projectLocation],
                ['Ulohan sa Proyektong MD', payload.projectInformation?.projectTitle],
                ['Petsa sa Pagtukod', payload.projectInformation?.projectDate],
                ['Kinatibuk-ang Kantidad', payload.projectInformation?.projectedAmount],
                ['Kantidad gikan sa CSWDD', payload.projectInformation?.cswddAmount],
                ['Laing kakuhaon sa pondo', payload.projectInformation?.otherFundingSource],
                ['Savings Account No.', payload.projectInformation?.savingsAccountNumber],
            ])}
            ${renderSimpleTable('Sectoral Classification', ['Classification', 'Value'], sectoralRows)}
            ${renderReadOnlySection('Rationale of the Proposed Project', [
                ['Rason sa proyekto', payload.rationale],
            ])}
            ${renderSimpleTable('Detalye sa Modality Application/s', ['Kakuhuan sa Pondo', 'Gi-ambag', 'Kantidad'], contributions.map((row) => [row.fundSource, row.contributionType, row.amount]))}
            ${renderSimpleTable('Mga gikinahanglan nga Materyales', ['Material', 'Kadaghanon', 'Yunit', 'Unit Price', 'Siklo sa Produksyon', 'Kinatibuk-ang kantidad'], materials.map((row) => [row.material, row.quality, row.unit, row.unitPrice, row.cyclesPerProduction, row.projectedCost]))}
            ${renderReadOnlySection('IV.a Kinatibuk-ang Total', [
                ['Kinatibuk-ang Total', payload.businessOperation?.materials?.totalCost],
            ])}
            ${renderSimpleTable('Mga gikinahanglan na Trabahante', ['Ngalan sa Magtrabaho sa Negosyo', 'Posisyon sa Trabaho', 'Inadlaw na Suweldo'], labor.map((row) => [row.workerName, row.position, row.dailyWage]))}
            ${renderReadOnlySection('IV.b Mga kinatibuk-ang suweldo', [
                ['Kinatibuk-an na inadlaw na suweldo', payload.businessOperation?.labor?.totalDailyWage],
                ['Kinatibuk-an na suweldo base sa siglo sa produksyon', payload.businessOperation?.labor?.totalProductionCycleWage],
            ])}
            ${renderSimpleTable('IV.c Mga Gikinahanglan nga Kagamitan', ['Kagamitan', 'Kadaghanon', 'Yunit', 'Kantidad o presyo sa matag usa', 'Kinatibuk-an nga kantidad o presyo', 'Gitas-on sa kinabuhi sa mga himan/kagamitan', 'Siklo sa Produksyon', 'Depreciation Cost'], equipment.map((row) => [row.equipment, row.capacity, row.unit, row.quantityOrPrice, row.projectedAmount, row.usefulLifeDays, row.productionCycle, row.depreciationCost]))}
            ${renderReadOnlySection('IV.c Kinatibuk-ang Total', [
                ['Kinatibuk-ang Total', payload.businessOperation?.toolsEquipment?.totalCost],
            ])}
            ${renderSimpleTable('IV.d Uban pang mga gastohanan', ['Regular na ginagastuhan', 'Dalas ng pagbayad', 'Kinatibuk-an na kantidad o presyo base sa siglo sa produksyon'], expenses.map((row) => [row.expenseName, row.paymentFrequency, row.projectedCost]))}
            ${renderReadOnlySection('IV.d Grand Total', [
                ['Grand Total', payload.businessOperation?.operatingExpenses?.grandTotal],
            ])}
            ${renderSimpleTable('IV.e Pangunahing kita gikan sa puhunan alang sa mga sangkap', ['Produkto', 'Kadaghanon', 'Yunit', 'Kantidad sa pagpamaligya matag piraso', 'Kinatibuk-an na kantidad sa pagpamaligya base sa siglo sa produksyon'], sales.map((row) => [row.product, row.capacity, row.unit, row.sellingPrice, row.projectedSales]))}
            ${renderReadOnlySection('IV.e Gross Sales', [
                ['Gross Sales', payload.businessOperation?.salesProjection?.grossSales],
            ])}
            ${renderReadOnlySection('IV.f Kinatibuk-ang kita sa matag produkto o paghimo sa serbisyo', [
                ['Gilauman nga kita alang sa usa ka "siklo sa produksyon"', income.projectedIncomePerCycle],
                ['Mga materyales (raw materials)', income.rawMaterialsCost],
                ['Gikinahanglan na manpower ug labor', income.manpowerLaborCost],
                ['Depreciation Cost', income.depreciationCost],
                ['Uban pang mga Gasto', income.otherExpenses],
                ['Kinatibuk-ang gasto sa pag-operate', income.totalOperatingCost],
                ['Kinatibuk-ang ginansya human sa gasto sa operasyon (Gross Profit)', income.grossProfit],
                ['Net profit', income.netProfit],
            ])}
            ${renderSimpleTable('IV.g Iskedyul o Plano sa Paggasto sa SEA-K Capital Fund', ['Mga Gasto', 'Kantidad', 'Iskedyul sa Paggamit'], spending.map((row) => [row.expense, row.amount, row.usageSchedule]))}
            ${renderReadOnlySection('Participant Signature', [
                ['Signed name', payload.applicantSignature?.signedName],
                ['Date signed', payload.applicantSignature?.signedDate],
            ], [renderReadOnlyUpload('Signature upload', payload.applicantSignature?.signatureUpload)])}
        `;
    }

    function renderStaffAvailment(staffReview) {
        const pageOne = staffReview.pageOneCertification || {};
        const physical = staffReview.physicalRequirements || {};
        const food = physical.foodRelatedCertification || {};
        const healthRows = physical.healthAgeRows || [];
        const psycho = staffReview.psychoSocialRequirements || {};
        const residency = psycho.residencyAndCharacter || {};
        const relationships = psycho.familyRelationshipsWorkHabitsAspiration || {};
        const social = staffReview.psychoSocialRequirements?.socialResponsibility || {};

        return `
            <div class="review-paper-document">
                ${renderReviewStatementBlock(
                    'Page 1 Eligibility Certification',
                    renderReviewCertificationSentence(`
                        I certify that <strong>${escapeHtml(pageOne.eligibilityStatementName || '________________')}</strong> is eligible to avail the Sustainable Market and Technology Driven Livelihood and Employment Assistance Program (SMART LEAP) based on the assessment.
                    `),
                    renderReviewSignatureArea('Direct Worker', `
                        <div class="row-grid">
                            ${renderInput('Direct worker name', 'staff.pageOneCertification.directWorkerName', pageOne.directWorkerName || '')}
                            ${renderInput('Direct worker title', 'staff.pageOneCertification.directWorkerTitle', pageOne.directWorkerTitle || '')}
                            ${renderInput('Date signed', 'staff.pageOneCertification.signedDate', pageOne.signedDate || '', 'date')}
                            ${renderUploadField('Direct worker signature upload', 'pageOneCertification.signatureUpload', pageOne.signatureUpload || null)}
                        </div>
                    `)
                )}
                ${renderReviewStatementBlock(
                    'IV. Physical Requirements',
                    `
                        ${renderSimpleTable('A. Health Age Requirements', ['Requirement', 'Age', 'Health Status'], healthRows.map((row) => [row.requirement, row.age, row.healthStatus]))}
                        ${renderReviewCertificationSentence(`
                            I certify that <strong>${escapeHtml(food.applicantName || '________________')}</strong> has undergone medical check-up and is physically fit to run a food related projects.
                        `)}
                        <div class="row-grid">
                            ${renderSelect('Requires medical clearance', 'staff.physicalRequirements.foodRelatedCertification.requiresMedicalClearance', food.requiresMedicalClearance || '', ['', 'Yes', 'No'])}
                            ${renderSelect('Medical check-up completed', 'staff.physicalRequirements.foodRelatedCertification.medicalCheckupCompleted', food.medicalCheckupCompleted || '', ['', 'Yes', 'No'])}
                            ${renderSelect('Medically fit', 'staff.physicalRequirements.foodRelatedCertification.medicallyFit', food.medicallyFit || '', ['', 'Yes', 'No'])}
                            ${renderInput('Applicant name', 'staff.physicalRequirements.foodRelatedCertification.applicantName', food.applicantName || '')}
                            ${renderInput('Certifying officer name', 'staff.physicalRequirements.foodRelatedCertification.certifyingOfficerName', food.certifyingOfficerName || '')}
                            ${renderInput('Certifying officer title', 'staff.physicalRequirements.foodRelatedCertification.certifyingOfficerTitle', food.certifyingOfficerTitle || '')}
                            ${renderInput('Date signed', 'staff.physicalRequirements.foodRelatedCertification.signedDate', food.signedDate || '', 'date')}
                            ${renderUploadField('Certifying officer signature upload', 'physicalRequirements.foodRelatedCertification.signatureUpload', food.signatureUpload || null)}
                        </div>
                    `
                )}
                ${renderReviewStatementBlock(
                    'V.A Residency and Character',
                    renderReviewCertificationSentence(`
                        I certify that <strong>${escapeHtml(residency.residentName || '________________')}</strong> a bona fide resident of the barangay and is of good moral character and has no adverse reputation.
                    `) + `
                        <div class="row-grid">
                            ${renderInput('Resident name', 'staff.psychoSocialRequirements.residencyAndCharacter.residentName', residency.residentName || '')}
                            ${renderInput('Barangay', 'staff.psychoSocialRequirements.residencyAndCharacter.barangay', residency.barangay || '')}
                            ${renderSelect('Bona fide resident', 'staff.psychoSocialRequirements.residencyAndCharacter.isBonaFideResident', residency.isBonaFideResident || '', ['', 'Yes', 'No'])}
                            ${renderSelect('Good moral character', 'staff.psychoSocialRequirements.residencyAndCharacter.goodMoralCharacter', residency.goodMoralCharacter || '', ['', 'Yes', 'No'])}
                            ${renderSelect('No adverse reputation', 'staff.psychoSocialRequirements.residencyAndCharacter.hasNoAdverseReputation', residency.hasNoAdverseReputation || '', ['', 'Yes', 'No'])}
                            ${renderInput('Certifying officer name', 'staff.psychoSocialRequirements.residencyAndCharacter.certifyingOfficerName', residency.certifyingOfficerName || '')}
                            ${renderInput('Certifying officer title', 'staff.psychoSocialRequirements.residencyAndCharacter.certifyingOfficerTitle', residency.certifyingOfficerTitle || '')}
                            ${renderInput('Date signed', 'staff.psychoSocialRequirements.residencyAndCharacter.signedDate', residency.signedDate || '', 'date')}
                            ${renderUploadField('Certifying officer signature upload', 'psychoSocialRequirements.residencyAndCharacter.signatureUpload', residency.signatureUpload || null)}
                        </div>
                    `
                )}
                ${renderReviewStatementBlock(
                    'V.B Family Relationships, Work Habits, Aspirations',
                    renderReviewCertificationSentence(`
                        I certify that through personal interview, home visit and collateral interview I have verified that <strong>${escapeHtml(relationships.applicantName || '________________')}</strong> manifest positive relationships, good work habits and attitude as well as demonstrated capacity and adequate level of economic aspiration.
                    `) + `
                        <div class="row-grid">
                            ${renderInput('Applicant name', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.applicantName', relationships.applicantName || '')}
                            ${renderSelect('Positive relationships', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.positiveRelationships', relationships.positiveRelationships || '', ['', 'Yes', 'No'])}
                            ${renderSelect('Good work habits and attitude', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.goodWorkHabitsAndAttitude', relationships.goodWorkHabitsAndAttitude || '', ['', 'Yes', 'No'])}
                            ${renderSelect('Adequate economic aspiration', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.adequateEconomicAspiration', relationships.adequateEconomicAspiration || '', ['', 'Yes', 'No'])}
                            ${renderTextarea('Finding / verification note', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.findingText', relationships.findingText || '')}
                            ${renderInput('Direct worker name', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.directWorkerName', relationships.directWorkerName || '')}
                            ${renderInput('Direct worker title', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.directWorkerTitle', relationships.directWorkerTitle || '')}
                            ${renderInput('Date signed', 'staff.psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.signedDate', relationships.signedDate || '', 'date')}
                            ${renderUploadField('Direct worker signature upload', 'psychoSocialRequirements.familyRelationshipsWorkHabitsAspiration.signatureUpload', relationships.signatureUpload || null)}
                        </div>
                    `
                )}
                ${renderReviewStatementBlock(
                    'V.C Social Responsibility and Willingness to Save (Client)',
                    renderReviewCertificationSentence(`
                        I will abide by the policies and guidelines set by CSWDD for the SMART LEAP and I promise to pay the roll-back at the time stipulated and to generate weekly savings to meet emergencies that may affect my family.
                    `) + `
                        <div class="row-grid">
                            ${renderSelect('Will abide by policies', 'staff.psychoSocialRequirements.socialResponsibility.abidePolicies', social.abidePolicies || '', ['', 'Yes', 'No'])}
                            ${renderSelect('Will pay roll-back on time', 'staff.psychoSocialRequirements.socialResponsibility.payRollBackOnTime', social.payRollBackOnTime || '', ['', 'Yes', 'No'])}
                            ${renderSelect('Will generate weekly savings', 'staff.psychoSocialRequirements.socialResponsibility.generateWeeklySavings', social.generateWeeklySavings || '', ['', 'Yes', 'No'])}
                        </div>
                        ${renderTextarea('Staff note', 'staff.psychoSocialRequirements.socialResponsibility.acknowledgementText', social.acknowledgementText || '')}
                    `
                )}
            </div>
        `;
    }

    function renderStaffValidation(staffReview) {
        const eligibility = staffReview.eligibilityAssessment || {};
        const identity = staffReview.validatorIdentity || {};
        return `
            ${renderReviewStatementBlock(
                'Validator Recommendation',
                renderReviewCertificationSentence(`
                    Validator's Recommendation:
                `) + renderTextarea('Recommendation', 'staff.validatorRecommendation', staffReview.validatorRecommendation || '')
            )}
            ${renderReviewStatementBlock(
                'Eligibility Assessment',
                `
                    <div class="row-grid">
                        ${renderInput('Resident name', 'staff.eligibilityAssessment.residentName', eligibility.residentName || '')}
                        ${renderInput('Age', 'staff.eligibilityAssessment.age', eligibility.age || '')}
                        ${renderInput('Barangay', 'staff.eligibilityAssessment.barangay', eligibility.barangay || '')}
                    </div>
                    ${renderReviewCertificationSentence(`
                        Ako si <strong>${escapeHtml(eligibility.residentName || '________________')}</strong>,
                        <strong>${escapeHtml(eligibility.age || '____')}</strong> anyos, lumulupyo sa Barangay
                        <strong>${escapeHtml(eligibility.barangay || '________________')}</strong>, Butuan City, Agusan Del Norte.
                        Ako nakasabot sa tumong ug proseso niining Livelihood Assistance kung diin ako
                        <strong>${escapeHtml(eligibility.assistanceProcessUnderstanding || '________________')}</strong>
                        (${escapeHtml(eligibility.eligibilityDecision || 'ANGAYAN/DILI ANGAYAN')}) mahimong benepisyo sa among program nga gidumala sa
                        SMART LEAP ng City Social Welfare and Development Department (CSWDD).
                    `)}
                    <div class="row-grid">
                        ${renderSelect('Understands assistance process', 'staff.eligibilityAssessment.understandsAssistanceProcess', eligibility.understandsAssistanceProcess || '', ['', 'Yes', 'No'])}
                        ${renderSelect('Eligibility decision', 'staff.eligibilityAssessment.eligibilityDecision', eligibility.eligibilityDecision || '', ['', 'ANGAYAN', 'DILI ANGAYAN'])}
                    </div>
                    ${renderTextarea('Assistance process understanding', 'staff.eligibilityAssessment.assistanceProcessUnderstanding', eligibility.assistanceProcessUnderstanding || '')}
                `,
                renderReviewSignatureArea('Ngalan/Perma sa Validator', `
                    <div class="row-grid">
                        ${renderInput('Validator name', 'staff.validatorIdentity.validatorName', identity.validatorName || '')}
                        ${renderInput('Validator title', 'staff.validatorIdentity.validatorTitle', identity.validatorTitle || '')}
                        ${renderInput('Date signed', 'staff.validatorIdentity.signedDate', identity.signedDate || '', 'date')}
                        ${renderUploadField('Validator signature upload', 'validatorIdentity.signatureUpload', identity.signatureUpload || null)}
                    </div>
                `)
            )}
        `;
    }

    function renderStaffMungkahing(staffReview) {
        const recommendation = staffReview.recommendation || {};

        return `
            ${renderReviewStatementBlock(
                'V. Rekomendasyon',
                `
                    <div class="row-grid">
                        ${renderInput('Project name', 'staff.recommendation.projectName', recommendation.projectName || '')}
                        ${renderInput('Recommended amount', 'staff.recommendation.recommendedAmount', recommendation.recommendedAmount || '', 'number')}
                        ${renderInput('Approver name', 'staff.recommendation.approverName', recommendation.approverName || '')}
                        ${renderInput('Approver title', 'staff.recommendation.approverTitle', recommendation.approverTitle || '')}
                        ${renderInput('Approved date', 'staff.recommendation.approvedDate', recommendation.approvedDate || '', 'date')}
                    </div>
                    ${renderTextarea('Recommendation text', 'staff.recommendation.recommendationText', recommendation.recommendationText || '')}
                    ${renderUploadField('Approval signature upload', 'recommendation.signatureUpload', recommendation.signatureUpload || null)}
                `
            )}
        `;
    }

    function renderApplicantMungkahingPaper(payload) {
        const project = payload.projectInformation || {};
        const sectoral = payload.sectoralClassification || {};
        const pantawid = sectoral.pantawid || {};
        const nonPantawid = sectoral.nonPantawid || {};
        const contributions = payload.modalityApplications?.rows || [];
        const materials = payload.businessOperation?.materials?.rows || [];
        const labor = payload.businessOperation?.labor?.rows || [];
        const equipment = payload.businessOperation?.toolsEquipment?.rows || [];
        const expenses = payload.businessOperation?.operatingExpenses?.rows || [];
        const sales = payload.businessOperation?.salesProjection?.rows || [];
        const spending = payload.spendingPlan?.rows || [];
        const income = payload.businessOperation?.incomeComputation || {};

        return `
            <div class="review-paper-document">
                ${renderReviewPaperPage(1, `
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('I.', 'KINATIBUK-AN IMPORMASYON BAHIN SA PROYEKTO')}
                        <div class="review-paper-line-grid review-paper-line-grid--two">
                            ${renderReviewPaperLineField('Ngalan sa Partisipante', project.participantName)}
                            ${renderReviewPaperLineField('Lokasyon sa Proyekto', project.projectLocation)}
                            ${renderReviewPaperLineField('Ulohan sa Proyektong MD', project.projectTitle)}
                            ${renderReviewPaperLineField('Petsa sa Pagtukod', project.projectDate)}
                            ${renderReviewPaperLineField('Kinatibuk-ang Kantidad', project.projectedAmount)}
                            ${renderReviewPaperLineField('Savings Account no.', project.savingsAccountNumber)}
                            ${renderReviewPaperLineField('Kantidad gikan sa CSWDD', project.cswddAmount)}
                            ${renderReviewPaperLineField('Lain kakuhan sa pondo', project.otherFundingSource)}
                        </div>
                        ${renderReviewMungkahingSectorMatrix(pantawid, nonPantawid)}
                    </section>
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('II.', 'RATIONALE OF THE PROPOSED PROJECT')}
                        ${renderReviewPaperParagraphBlock(payload.rationale || '')}
                    </section>
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('III.', 'DETALYE SA MODALITY APPLICATION/S')}
                        <div class="review-paper-note">PONDO NGA GI-AMBAG SA MGA PARTNER/S:</div>
                        <div class="review-paper-note review-paper-note--italic">Self-Employment Assistance-Kaunlaran (SEA-K)</div>
                        ${renderReviewPaperTable(`
                            <tr><th style="width:30%">Kakuhan sa Pondo</th><th style="width:34%">Gi-ambag</th><th style="width:36%">Kantidad</th></tr>
                        `, contributions.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.fundSource || '--')}</td>
                                <td>${escapeHtml(row.contributionType || '--')}</td>
                                <td>${escapeHtml(row.amount || '--')}</td>
                            </tr>
                        `).join(''))}
                    </section>
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('IV.', 'Pagdumala sa Negosyo')}
                        <div class="review-paper-subtitle">a.) Mga gikinahanglang Materyales</div>
                        ${renderReviewPaperTable(`
                            <tr><th>(Materyales)<br>(a)</th><th>(Kadaghanon)<br>(b)</th><th>(Yunit)<br>(c)</th><th>(Kantidad o presyo sa matag yunit)<br>(d)</th><th>(Dalas sa paggamit/Siklo sa Produksyon)<br>(e)</th><th>(Kinatibuk-an na kantidad o presyo)<br>(f)</th></tr>
                        `, materials.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.material || '--')}</td>
                                <td>${escapeHtml(row.quality || '--')}</td>
                                <td>${escapeHtml(row.unit || '--')}</td>
                                <td>${escapeHtml(row.unitPrice || '--')}</td>
                                <td>${escapeHtml(row.cyclesPerProduction || '--')}</td>
                                <td>${escapeHtml(row.projectedCost || '--')}</td>
                            </tr>
                        `).join(''), `<tr><td colspan="5" class="review-paper-table__total-label">Kinatibuk-ang Total</td><td>${escapeHtml(payload.businessOperation?.materials?.totalCost || '--')}</td></tr>`)}
                        <div class="review-paper-subtitle">b.) Mga Gikinahanglan na Trabahante</div>
                        ${renderReviewPaperTable(`
                            <tr><th>Ngalan sa Magtrabaho sa Negosyo</th><th>Posisyon sa Trabaho</th><th>Inadlaw na Sweldo</th></tr>
                        `, labor.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.workerName || '--')}</td>
                                <td>${escapeHtml(row.position || '--')}</td>
                                <td>${escapeHtml(row.dailyWage || '--')}</td>
                            </tr>
                        `).join(''), `
                            <tr><td colspan="2" class="review-paper-table__total-label">Kinatibuk-an na inadlaw na sweldo</td><td>${escapeHtml(payload.businessOperation?.labor?.totalDailyWage || '--')}</td></tr>
                            <tr><td colspan="2" class="review-paper-table__total-label">Kinatibuk-an na suweldo base sa siglo sa produksyon</td><td>${escapeHtml(payload.businessOperation?.labor?.totalProductionCycleWage || '--')}</td></tr>
                        `)}
                    </section>
                `)}
                ${renderReviewPaperPage(2, `
                    <section class="review-paper-section">
                        <div class="review-paper-subtitle">c.) Mga Gikinahanglan nga Kagamitan (Tools and Equipment)</div>
                        ${renderReviewPaperTable(`
                            <tr><th>Kagamitan (a)</th><th>Kadaghanon (b)</th><th>Yunit (c)</th><th>Kantidad o presyo (d)</th><th>Kinatibuk-ang kantidad (e)</th><th>Gitas-on sa kinabuhi (f)</th><th>Siklo sa Produksyon (g)</th><th>Depreciation Cost (h)</th></tr>
                        `, equipment.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.equipment || '--')}</td>
                                <td>${escapeHtml(row.capacity || '--')}</td>
                                <td>${escapeHtml(row.unit || '--')}</td>
                                <td>${escapeHtml(row.quantityOrPrice || '--')}</td>
                                <td>${escapeHtml(row.projectedAmount || '--')}</td>
                                <td>${escapeHtml(row.usefulLifeDays || '--')}</td>
                                <td>${escapeHtml(row.productionCycle || '--')}</td>
                                <td>${escapeHtml(row.depreciationCost || '--')}</td>
                            </tr>
                        `).join(''), `<tr><td colspan="7" class="review-paper-table__total-label">Kinatibuk-ang Total</td><td>${escapeHtml(payload.businessOperation?.toolsEquipment?.totalCost || '--')}</td></tr>`)}
                    </section>
                    <section class="review-paper-section">
                        <div class="review-paper-subtitle">d.) Uban pang mga gastohanan</div>
                        ${renderReviewPaperTable(`
                            <tr><th>Regular na ginagastuhan</th><th>Dalas ng pagbayad</th><th>Kinatibuk-an na kantidad o presyo base sa siglo sa produksyon</th></tr>
                        `, expenses.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.expenseName || '--')}</td>
                                <td>${escapeHtml(row.paymentFrequency || '--')}</td>
                                <td>${escapeHtml(row.projectedCost || '--')}</td>
                            </tr>
                        `).join(''), `<tr><td colspan="2" class="review-paper-table__total-label">Grand Total</td><td>${escapeHtml(payload.businessOperation?.operatingExpenses?.grandTotal || '--')}</td></tr>`)}
                    </section>
                    <section class="review-paper-section">
                        <div class="review-paper-subtitle">e.) Pangunahing kita gikan sa puhunan alang sa mga sangkap</div>
                        ${renderReviewPaperTable(`
                            <tr><th>Produkto (a)</th><th>Kadaghanon (b)</th><th>Yunit (c)</th><th>Kantidad sa pagpamaligya matag piraso (d)</th><th>Kinatibuk-an na kantidad sa pagpamaligya base sa siglo sa produksyon (e)</th></tr>
                        `, sales.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.product || '--')}</td>
                                <td>${escapeHtml(row.capacity || '--')}</td>
                                <td>${escapeHtml(row.unit || '--')}</td>
                                <td>${escapeHtml(row.sellingPrice || '--')}</td>
                                <td>${escapeHtml(row.projectedSales || '--')}</td>
                            </tr>
                        `).join(''), `<tr><td colspan="4" class="review-paper-table__total-label">Gross Sales</td><td>${escapeHtml(payload.businessOperation?.salesProjection?.grossSales || '--')}</td></tr>`)}
                    </section>
                    <section class="review-paper-section">
                        <div class="review-paper-subtitle">f.) Kinatibuk-ang kita sa matag produkto o paghimo sa serbisyo</div>
                        ${renderReviewPaperTable(`
                            <tr><th style="width:64%"></th><th style="width:36%">Presyo</th></tr>
                        `, `
                            <tr><td>Gilauman nga kita alang sa usa ka "siklo sa produksyon" <em>(SEE TABLE E)</em></td><td>${escapeHtml(income.projectedIncomePerCycle || '--')}</td></tr>
                            <tr><td>Less: Mga materyales <em>(SEE TABLE A)</em></td><td>${escapeHtml(income.rawMaterialsCost || '--')}</td></tr>
                        `)}
                    </section>
                `)}
                ${renderReviewPaperPage(3, `
                    <section class="review-paper-section">
                        ${renderReviewPaperTable(`
                            <tr><th style="width:64%"></th><th style="width:36%">Presyo</th></tr>
                        `, `
                            <tr><td>Gikinahanglan na manpower ug labor <em>(SEE TABLE B)</em></td><td>${escapeHtml(income.manpowerLaborCost || '--')}</td></tr>
                            <tr><td>Depreciation Cost <em>(SEE TABLE C)</em></td><td>${escapeHtml(income.depreciationCost || '--')}</td></tr>
                            <tr><td>Uban pang mga Gasto <em>(SEE TABLE D)</em></td><td>${escapeHtml(income.otherExpenses || '--')}</td></tr>
                            <tr><td>Kinatibuk-an na gasto sa pag-operate <em>(table B+C+D)</em></td><td>${escapeHtml(income.totalOperatingCost || '--')}</td></tr>
                            <tr><td>Kinatibuk-an na ginansya human sa gasto sa operasyon (Gross Profit)</td><td>${escapeHtml(income.grossProfit || '--')}</td></tr>
                            <tr><td>Net profit</td><td>${escapeHtml(income.netProfit || '--')}</td></tr>
                        `)}
                    </section>
                    <section class="review-paper-section">
                        <div class="review-paper-subtitle">g.) Iskedyul o Plano sa Paggasto sa SEA-K Capital Fund (SCF)</div>
                        ${renderReviewPaperTable(`
                            <tr><th>Mga Gasto</th><th>Kantidad</th><th>Iskedyul sa Paggamit</th></tr>
                        `, spending.map((row) => `
                            <tr>
                                <td>${escapeHtml(row.expense || '--')}</td>
                                <td>${escapeHtml(row.amount || '--')}</td>
                                <td>${escapeHtml(row.usageSchedule || '--')}</td>
                            </tr>
                        `).join(''))}
                    </section>
                    <section class="review-paper-section">
                        <div class="review-paper-signoff">
                            <div class="review-paper-signoff__label">GI-ANDAM NI</div>
                            <div class="review-paper-signoff__line">${escapeHtml(payload.applicantSignature?.signedName || '--')}</div>
                            <div class="review-paper-signoff__meta">Pangalan sa Partisipante</div>
                            <div class="review-paper-signoff__meta">Petsa: ${escapeHtml(payload.applicantSignature?.signedDate || '--')}</div>
                            ${renderReadOnlyUpload('Pirma sa Partisipante', payload.applicantSignature?.signatureUpload)}
                        </div>
                    </section>
                `)}
            </div>
        `;
    }

    function renderStaffMungkahingPaper(staffReview, payload) {
        const recommendation = staffReview.recommendation || {};
        const projectTitle = payload.projectInformation?.projectTitle || '';
        const amount = recommendation.recommendedAmount || '';

        return `
            <div class="review-paper-document">
                ${renderReviewPaperPage(3, `
                    <section class="review-paper-section">
                        ${renderReviewPaperSectionTitle('V.', 'REKOMENDASYON')}
                        <div class="review-certification-sentence">
                            Kini nagrekomenda nga punduhan ang maong <strong>Mungkahing Proyekto</strong> alang sa Micro Enterprise Development alang sa proyektong
                            <span class="review-paper-fillline review-paper-fillline--long">${escapeHtml(projectTitle || '________________')}</span>
                            nga adunay kinatibuk-ang kantidad na Php
                            ${renderReviewInlineInput('staff.recommendation.recommendedAmount', amount || '', 'number', 'review-paper-fillline-input')}
                            .
                        </div>
                    </section>
                    <section class="review-paper-section">
                        <div class="review-paper-signoff">
                            <div class="review-paper-signoff__label">GI ASSESSES UG APRUBAHAN NI</div>
                            <div class="row-grid">
                                ${renderInput('Pangalan sa PDO/Admin', 'staff.recommendation.approverName', recommendation.approverName || '')}
                                ${renderInput('Titulo', 'staff.recommendation.approverTitle', recommendation.approverTitle || '')}
                                ${renderInput('Petsa', 'staff.recommendation.approvedDate', recommendation.approvedDate || '', 'date')}
                                ${renderTextarea('Recommendation text', 'staff.recommendation.recommendationText', recommendation.recommendationText || '')}
                                ${renderUploadField('Pirma sa PDO/Admin', 'recommendation.signatureUpload', recommendation.signatureUpload || null)}
                            </div>
                        </div>
                    </section>
                `, true)}
            </div>
        `;
    }

    function renderApplicantBusinessPlan(payload) {
        const overview = payload.overview || {};
        const products = payload.productsServices?.rows || [];
        const market = payload.marketStrategy || {};
        const operations = payload.operationsPlan || {};
        const financial = payload.financialPlan || {};
        const risks = payload.riskManagement || {};
        const scheduleRows = payload.implementationSchedule?.rows || [];
        const approval = payload.staffReview?.approval || {};

        return `
            <div class="review-bp-document">
                ${renderReviewBusinessPlanPage(1, `
                    <header class="review-bp-titlepage">
                        <h2>BUSINESS PLAN</h2>
                        <div class="review-bp-titlepage__subhead">EXECUTIVE SUMMARY (BUSINESS DESCRIPTION)</div>
                    </header>
                    ${renderReviewBusinessPlanPrompt('1.', 'Brief Description of the Business/Project', 'Brief Description of the Project (What is the nature of the project?)', `
                        ${renderReviewBusinessPlanLineField('Business / project name', overview.businessName, 'review-bp-line--long')}
                        ${renderReviewBusinessPlanNarrative(payload.executiveSummary || '', 'review-bp-narrative--tall')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.', 'Brief Profile of the Entrepreneur', 'Brief Profile of the Entrepreneur (What are the entrepreneur’s skills and qualifications?)', `
                        <div class="review-bp-meta-grid">
                            ${renderReviewBusinessPlanLineField('Name of entrepreneur', overview.ownerName)}
                            ${renderReviewBusinessPlanLineField('Contact number', overview.contactNumber)}
                            ${renderReviewBusinessPlanLineField('Business address', overview.businessAddress, 'review-bp-line--long review-bp-line--span2')}
                        </div>
                        ${renderReviewBusinessPlanNarrative(overview.businessGoal || '', 'review-bp-narrative--medium')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('3.', 'Contributions of the Project to the Economy', 'Contributions of the Project to the Economy (What are the contributions of the project to the local and national economy?)', `
                        ${renderReviewBusinessPlanNarrative(risks.mitigation || '', 'review-bp-narrative--medium')}
                    `)}
                    <div class="review-bp-section-heading">Part 1: Marketing Plan</div>
                    ${renderReviewBusinessPlanPrompt('1.1', 'Description of the Product', 'Description of the Product (What is the product?)', `
                        ${renderReviewPaperTable(`
                            <tr><th style="width:24%">Name</th><th style="width:38%">Description</th><th style="width:14%">Selling price</th><th style="width:24%">Target market</th></tr>
                        `, products.length
                            ? products.map((row) => `
                                <tr>
                                    <td>${escapeHtml(row.name || '--')}</td>
                                    <td>${escapeHtml(row.description || '--')}</td>
                                    <td>${escapeHtml(row.price || '--')}</td>
                                    <td>${escapeHtml(row.targetMarket || '--')}</td>
                                </tr>
                            `).join('')
                            : '<tr><td colspan="4">No product or service row submitted.</td></tr>')}
                    `, 'review-bp-prompt--table')}
                `)}
                ${renderReviewBusinessPlanPage(2, `
                    ${renderReviewBusinessPlanPrompt('1.2', 'Comparison of the Product with its Competitors', 'Comparison of the Product with its Competitors (How does it compare in quality and price with its competitors?)', `
                        ${renderReviewBusinessPlanNarrative(market.competitors || '', 'review-bp-narrative--medium')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('1.3', 'Location', 'Location (Where will the business be located?)', `
                        ${renderReviewBusinessPlanNarrative(operations.businessLocation || '', 'review-bp-narrative--short')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('1.4', 'Market Area', 'Market Area (What geographic areas will the project cover?)', `
                        ${renderReviewBusinessPlanNarrative(market.salesChannel || '', 'review-bp-narrative--short')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('1.5', 'Primary Customers', 'Primary Customers (Within the market area, to whom will the business sell its products?)', `
                        ${renderReviewBusinessPlanNarrative(market.customerProfile || '', 'review-bp-narrative--short')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('1.6', 'Total Demand', 'Total Demand (Can it be estimated how much of the product is currently being sold?)', `
                        ${renderReviewBusinessPlanNarrative(financial.monthlySalesProjection || '', 'review-bp-narrative--compact')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('1.7', 'Selling Price', 'Selling Price (What is the selling price of the product?)', `
                        ${renderReviewBusinessPlanNarrative(financial.projectedNetIncome || '', 'review-bp-narrative--compact')}
                    `)}
                `)}
                ${renderReviewBusinessPlanPage(3, `
                    ${renderReviewBusinessPlanPrompt('1.8', 'Promotional Measures', 'Promotional Measures (What promotional measures will be used in selling the product?)', `
                        ${renderReviewBusinessPlanNarrative(market.marketingApproach || '', 'review-bp-narrative--medium')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('1.9', 'Marketing Strategy', 'Marketing Strategy (What marketing strategy is needed to ensure that the sales forecasts are achieved?)', `
                        ${renderReviewBusinessPlanNarrative(market.salesChannel || '', 'review-bp-narrative--medium')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('1.10', 'Marketing Budget', 'Marketing Budget (How much do you need to promote and distribute your product?)', `
                        ${renderReviewBusinessPlanNarrative(financial.monthlyExpenseProjection || '', 'review-bp-narrative--compact')}
                    `)}
                    <div class="review-bp-section-heading">Part 2: Production Plan</div>
                    ${renderReviewBusinessPlanPrompt('2.1', 'Production / Service Process', 'Production / Service Process (What is the production or service process?)', `
                        ${renderReviewBusinessPlanNarrative(operations.productionProcess || '', 'review-bp-narrative--medium')}
                    `)}
                `)}
                ${renderReviewBusinessPlanPage(4, `
                    ${renderReviewBusinessPlanPrompt('2.2', 'Fixed Capital', 'What buildings and machinery (fixed assets) are needed and what are their costs?', `
                        ${renderReviewBusinessPlanNarrative(operations.equipmentNeeded || '', 'review-bp-narrative--medium')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.3', 'Life of Fixed Capital', 'Life of Fixed Capital (What is the useful life of the building and machinery?)', `
                        ${renderReviewBusinessPlanNarrative(financial.breakEvenNotes || '', 'review-bp-narrative--short')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.4', 'Sources of Equipment', 'Sources of Equipment (When and where will the machinery be obtained?)', `
                        ${renderReviewBusinessPlanNarrative(operations.equipmentNeeded || '', 'review-bp-narrative--short')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.5', 'Planned Capacity', 'Planned Capacity (How much capacity will be used?)', `
                        ${renderReviewBusinessPlanNarrative(financial.breakEvenNotes || '', 'review-bp-narrative--short')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.6', 'Future Capacity', 'Future Capacity (What are the plans for using extra capacity?)', `
                        ${renderReviewBusinessPlanNarrative(financial.breakEvenNotes || '', 'review-bp-narrative--short')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.7', 'Raw Materials', 'How many raw materials are needed?', `
                        ${renderReviewBusinessPlanNarrative(operations.productionProcess || '', 'review-bp-narrative--compact')}
                    `)}
                `)}
                ${renderReviewBusinessPlanPage(5, `
                    ${renderReviewBusinessPlanPrompt('2.8', 'Cost of Raw Materials', 'Cost of Raw Materials (What is the cost of the raw materials?)', `
                        ${renderReviewBusinessPlanNarrative(financial.projectedNetIncome || '', 'review-bp-narrative--compact')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.9', 'Availability of Raw Materials', 'Availability of Raw Materials (What are the sources of raw materials? Are they available the whole year?)', `
                        ${renderReviewBusinessPlanNarrative(risks.risks || '', 'review-bp-narrative--medium')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.10', 'Labor', 'Labor (How many direct and indirect jobs are required and what skills are needed?)', `
                        ${renderReviewBusinessPlanNarrative(operations.staffingPlan || '', 'review-bp-narrative--medium')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.11', 'Cost of Labor', 'Cost of Labor (What is the cost of labor?)', `
                        ${renderReviewBusinessPlanNarrative(financial.monthlyExpenseProjection || '', 'review-bp-narrative--compact')}
                    `)}
                    ${renderReviewBusinessPlanPrompt('2.12', 'Availability of Labor', 'Availability of Labor (Are the workers available the whole year? If not, what is the effect on production?)', `
                        ${renderReviewBusinessPlanNarrative(operations.staffingPlan || '', 'review-bp-narrative--short')}
                    `)}
                    <div class="review-bp-section-heading">Part 3: Organization and Management Plan</div>
                    ${renderReviewBusinessPlanPrompt('3.1', 'Pre-operating Activities', 'Pre-operating Activities (What pre-operating activities need to be done before the business starts operating?)', `
                        ${renderReviewPaperTable(`
                            <tr><th style="width:40%">Activity</th><th style="width:28%">Target Date</th><th style="width:32%">Responsible Person</th></tr>
                        `, scheduleRows.length
                            ? scheduleRows.map((row) => `
                                <tr>
                                    <td>${escapeHtml(row.activity || '--')}</td>
                                    <td>${escapeHtml(row.targetDate || '--')}</td>
                                    <td>${escapeHtml(row.responsiblePerson || '--')}</td>
                                </tr>
                            `).join('')
                            : '<tr><td colspan="3">No implementation schedule row submitted.</td></tr>')}
                    `, 'review-bp-prompt--table')}
                `)}
                ${renderReviewBusinessPlanPage(6, `
                    ${renderReviewBusinessPlanPrompt('3.2', 'Pre-operating Costs', 'Pre-operating Costs (What expenses will be incurred before operations begin?)', `
                        ${renderReviewBusinessPlanNarrative(financial.monthlyExpenseProjection || '', 'review-bp-narrative--short')}
                    `)}
                    <div class="review-bp-section-heading">Part 4: Financial Plan</div>
                    ${renderReviewBusinessPlanPrompt('4.1', 'Project Cost', 'Project Cost (What is the total capital requirement?)', `
                        ${renderReviewBusinessPlanNarrative(financial.startupCapital || '', 'review-bp-narrative--short')}
                    `)}
                    <section class="review-bp-signoff">
                        <div class="review-bp-signoff__row">
                            <div class="review-bp-signoff__label">Giandam ni:</div>
                            <div class="review-bp-signoff__body">
                                <div class="review-bp-signline">${escapeHtml(payload.applicantSignature?.signedName || '--')}</div>
                                <div class="review-bp-signcaption">(Name sa Benes)</div>
                                <div class="review-bp-signmeta">Petsa sa pirma: ${escapeHtml(payload.applicantSignature?.signedDate || '--')}</div>
                                ${renderReviewBusinessPlanFileSlot('Pirma sa aplikante', payload.applicantSignature?.signatureUpload, 'Walay pirma nga na-upload.')}
                            </div>
                        </div>
                        <div class="review-bp-signoff__row">
                            <div class="review-bp-signoff__label">Gisusi ni:</div>
                            <div class="review-bp-signoff__body">
                                <div class="review-bp-signline">${escapeHtml(approval.approverName || '--')}</div>
                                <div class="review-bp-signcaption">(Kamo)</div>
                                ${renderReviewBusinessPlanFileSlot('Pirma sa reviewer', approval.signatureUpload, 'Alang sa upload sa reviewer side.')}
                            </div>
                        </div>
                        <div class="review-bp-signoff__row">
                            <div class="review-bp-signoff__label">Namatikdan ni:</div>
                            <div class="review-bp-signoff__body review-bp-signoff__body--noted">
                                <div class="review-bp-noted-fixed">GOLDA V. POCON, RSW, MSSW, CESE<br>CGHD-II/CSWDO</div>
                                ${renderReviewBusinessPlanFileSlot('Pirma sa Noted by', approval.signatureUpload, 'Alang sa upload sa post-approval review.')}
                                ${approval.reviewSummary ? `<div class="review-bp-note"><strong>Sumaryo sa review:</strong> ${escapeHtml(approval.reviewSummary)}</div>` : ''}
                                ${approval.recommendedAction ? `<div class="review-bp-note"><strong>Girekomendang aksyon:</strong> ${escapeHtml(approval.recommendedAction)}</div>` : ''}
                            </div>
                        </div>
                    </section>
                `)}
            </div>
        `;
    }

    function renderApplicantBuhatSaPagpanumpa(payload) {
        const beneficiary = payload.beneficiary || {};
        const project = payload.project || {};
        const coMaker = payload.coMaker || {};
        const agreement = payload.agreement || {};
        const applicantSignature = payload.applicantSignature || {};
        const coMakerSignature = payload.coMakerSignature || {};

        return `
            <div class="review-buhat-document">
                <section class="review-buhat-page">
                    <header class="review-buhat__header">
                        <div class="review-buhat__top">
                            <img src="${escapeAttribute(reviewBuhatAssetUrl('city-of-butuan-logo.png'))}" alt="City of Butuan Official Seal" class="review-buhat__logo review-buhat__logo--left">
                            <div class="review-buhat__copy">
                                <div class="small">Republic of the Philippines</div>
                                <div class="big">CITY GOVERNMENT OF BUTUAN</div>
                                <div class="dept">City Social Welfare and Development Department</div>
                                <div class="addr">J.P. Rosales Ave., Tandang Sora, Butuan City</div>
                                <div class="bar"></div>
                            </div>
                            <img src="${escapeAttribute(reviewBuhatAssetUrl('dswd-logo.png'))}" alt="CSWDD Logo" class="review-buhat__logo review-buhat__logo--right">
                        </div>
                        <div class="review-buhat__title">BUHAT SA PAGPANUMPA</div>
                    </header>

                    <div class="review-buhat__body">
                        <p class="review-buhat__paragraph">
                            Ako si
                            ${renderReviewBuhatInline(beneficiary.fullName, 'xl')}
                            <span class="review-buhat__literal">naa sa saktong edad, Pilipino, ug nagpuyo sa</span>
                            ${renderReviewBuhatInline(beneficiary.addressLine, 'lg')}
                            <span class="review-buhat__literal">,</span>
                            ${renderReviewBuhatInline(beneficiary.barangay, 'md')}
                            <span class="review-buhat__literal">,</span>
                            ${renderReviewBuhatInline(beneficiary.city, 'md')}
                            <span class="review-buhat__literal">pagkahuman ug panumpa sumala sa balaod, misaysay sa pagtuman niining mga sumusunod:</span>
                        </p>

                        <ol class="review-buhat__clauses">
                            <li>
                                Ako usa ka benepisyaryo sa
                                ${renderReviewBuhatInline(project.programName, 'lg')}
                                Program;
                            </li>
                            <li>
                                Tungod sa
                                ${renderReviewBuhatInline(project.projectName, 'lg')}
                                Program, ako makadawat ug kantidad nga
                                <span class="review-buhat__literal">(Php</span>
                                ${renderReviewBuhatInline(project.amountReceived, 'md')}
                                <span class="review-buhat__literal">)</span>
                                ug ako kining gamiton sa saktong katuyuan base sa mga dokumento nga akong gisumitar didto sa ahensya;
                            </li>
                            <li>Nga ako andam mo sumite o mohatag sa CSWDD sa mga resibo (Official Receipt or Acknowledgement Receipt) sa akong tanan napalit nga gamit o kahimanan, produkto usa ka semana human nako madawat ang Livelihood Assistance.</li>
                            <li>Nga ang mga resibo sa akong mga pinalit nga akong isumiti o ihatag sa CSWDD kinahanglan hinlo og walay pinapaan.</li>
                            <li>Nga ako usab nag saad nga moatubang kanunay sa LTWG, Monitoring Team sa CSWDD og uban pang mga grupo sa gobyerno sa panahon nga sila mag pahigayon og monitoring o mangumusta kanako kabahin sa akong Negosyo.</li>
                            <li>Nga ako nag saad sa angay o hustong pagdumala sa akong panginabuhian nga gihatag kanako sa CSWDD.</li>
                            <li>
                                Nga kung kini nga kasabutan og dili nako matuman tungod sa mga musunod na buhat sama sa;
                                <ul class="review-buhat__subclauses">
                                    <li>Pagsugal, pag-inom ug uban pang bisyo</li>
                                    <li>Pag-invest sa pyramiding scheme</li>
                                    <li>Pagpalit ug gadgets nga dili kinahanglanon sa negosyo,</li>
                                    <li>Pagpa-utang</li>
                                    <li>Uban pang mga butang nga wala nakalatid ug nakabutang sa akong mungkahing proyekto.</li>
                                </ul>
                            </li>
                            <li>
                                Sa kantidad nga nadawat ni
                                ${renderReviewBuhatInline(beneficiary.fullName, 'lg')}
                                ako si
                                ${renderReviewBuhatInline(coMaker.fullName, 'lg')}
                                <span class="review-buhat__literal">naa sa saktong edad, Pilipino, ug nagpuyo sa</span>
                                ${renderReviewBuhatInline(coMaker.addressLine, 'md')}
                                <span class="review-buhat__literal">,</span>
                                ${renderReviewBuhatInline(coMaker.barangay, 'sm')}
                                <span class="review-buhat__literal">,</span>
                                ${renderReviewBuhatInline(coMaker.city, 'sm')}
                                <span class="review-buhat__literal">nagsaad na mahimong responsable JOINTLY AND SEVERALLY sa pag-uli o pagbayad sa kantidad nga nadawat sulod sa bente kwatro (24) ka bulan kung si</span>
                                ${renderReviewBuhatInline(beneficiary.fullName, 'md')}
                                <span class="review-buhat__literal">dili makatuman sa iyang gi komitar sa ahensiya or mobuhat ug mga buluhaton nga lista sa taas.</span>
                            </li>
                        </ol>

                        <p class="review-buhat__paragraph">
                            Ako andam modawat og mosunod sa mga lakang nga ipahigayon ug ihatag kanako sa maong ahensya sama sa mosunod nga;
                        </p>
                        <ol class="review-buhat__clauses review-buhat__clauses--lettered" type="a">
                            <li>Counselling</li>
                            <li>Pag uli sa ayudang nadawat nga nagkantidad ug Fifteen Thousand Pesos (P15,000.00) sulod sa bente kwatro (24) ka bulan pinaagi sa monthly nga pagbayad nagkantidad ug Six Hundred Twenty-five Pesos (P625.00)</li>
                            <li>Ang dili pagtuman sa sumusunod nga lakang mamahimong hinungdan sa pagka blacklist sa mosunod nga susamang ayuda.</li>
                        </ol>

                        <p class="review-buhat__paragraph">
                            Isip sa pagmatuod sa akong pag-uyon og kumpletong pagsabot niining maong kasabutan, ako kining paga pirmahan ibabaw sa akong pangalan karong adlawa
                            ${renderReviewBuhatInline(agreement.dateSigned, 'md')}
                            ,
                            ${renderReviewBuhatInline(agreement.yearSigned, 'xs')}
                            <span class="review-buhat__literal">.</span>
                        </p>

                        <section class="review-buhat__signatures">
                            <div class="review-buhat__signature-col">
                                <div class="review-buhat__signature-head">Prepared by:</div>
                                ${renderReviewBuhatSignatureBlock('Name and Signature of Beneficiary', applicantSignature.signedName, applicantSignature.signatureUpload)}
                            </div>
                            <div class="review-buhat__signature-col">
                                <div class="review-buhat__signature-head">Co-maker:</div>
                                ${renderReviewBuhatSignatureBlock('Name and Signature of Co-maker', coMakerSignature.signedName, coMakerSignature.signatureUpload)}
                            </div>
                        </section>
                    </div>

                    <footer class="review-buhat__footer">
                        <div class="review-buhat__footer-left">
                            <div><strong>Phone:</strong> &nbsp; +639562241679 / +639816016317</div>
                            <div><strong>Email:</strong> &nbsp; cswdobutuan@gmail.com</div>
                            <div><strong>Website:</strong> &nbsp; http://www.butuan.gov.ph</div>
                        </div>
                        <div class="review-buhat__footer-right">
                            <img src="${escapeAttribute(reviewBuhatAssetUrl('butuanon-logo.png'))}" alt="ButuanON logo">
                            <small>CSWDO.DPSD.F.59 REV01</small>
                        </div>
                    </footer>
                </section>
            </div>
        `;
    }

    function renderStaffBusinessPlan(staffReview) {
        const approval = staffReview.approval || {};
        return `
            <section class="review-section">
                <h4>Business Plan Approval</h4>
                <div class="row-grid">
                    ${renderTextarea('Review summary', 'staff.approval.reviewSummary', approval.reviewSummary || '')}
                    ${renderInput('Recommended action', 'staff.approval.recommendedAction', approval.recommendedAction || '')}
                    ${renderInput('Approver name', 'staff.approval.approverName', approval.approverName || '')}
                    ${renderInput('Approver title', 'staff.approval.approverTitle', approval.approverTitle || '')}
                    ${renderInput('Approved date', 'staff.approval.approvedDate', approval.approvedDate || '', 'date')}
                    ${renderUploadField('Noted by signature upload (GOLDA V. POCON)', 'approval.signatureUpload', approval.signatureUpload || null)}
                </div>
            </section>
        `;
    }

    function renderReviewBusinessPlanPage(pageNumber, innerHtml) {
        return `
            <section class="review-bp-page">
                ${innerHtml}
                <footer class="review-bp-page__footer">Page ${pageNumber} of 6</footer>
            </section>
        `;
    }

    function renderReviewBusinessPlanPrompt(number, title, subtitle, body, extraClass = '') {
        return `
            <section class="review-bp-prompt ${escapeAttribute(extraClass)}">
                <div class="review-bp-prompt__title">${escapeHtml(number)} ${escapeHtml(title)}</div>
                <div class="review-bp-prompt__subtitle">${escapeHtml(subtitle)}</div>
                <div class="review-bp-prompt__body">${body}</div>
            </section>
        `;
    }

    function renderReviewBusinessPlanLineField(label, value, className = '') {
        return `
            <div class="review-bp-line ${escapeAttribute(className)}">
                <span class="review-bp-line__label">${escapeHtml(label)}</span>
                <span class="review-bp-line__value">${escapeHtml(value || '--')}</span>
            </div>
        `;
    }

    function renderReviewBusinessPlanNarrative(value, className = '') {
        return `<div class="review-bp-narrative ${escapeAttribute(className)}">${escapeHtml(value || '--')}</div>`;
    }

    function renderReviewBusinessPlanFileSlot(label, metadata, emptyText) {
        if (metadata?.file_path) {
            return `
                <div class="review-bp-file-slot has-file">
                    <span class="review-bp-file-slot__label">${escapeHtml(label)}</span>
                    <a class="upload-link" href="${escapeAttribute(routeUrl(metadata.file_path))}" target="_blank" rel="noopener">
                        ${escapeHtml(metadata.original_name || 'View uploaded file')}
                    </a>
                    ${metadata.uploaded_at ? `<small class="field-hint">${escapeHtml(formatDateTime(metadata.uploaded_at))}</small>` : ''}
                </div>
            `;
        }

        return `
            <div class="review-bp-file-slot">
                <span class="review-bp-file-slot__label">${escapeHtml(label)}</span>
                <span>${escapeHtml(emptyText || '--')}</span>
            </div>
        `;
    }

    function renderStaffBuhatSaPagpanumpa(staffReview) {
        const verification = staffReview.verification || {};
        return `
            <section class="review-section">
                <h4>Buhat sa Pagpanumpa Verification</h4>
                <div class="row-grid">
                    ${renderInput('Reviewer name', 'staff.verification.reviewerName', verification.reviewerName || '')}
                    ${renderInput('Reviewer title', 'staff.verification.reviewerTitle', verification.reviewerTitle || '')}
                    ${renderInput('Reviewer date', 'staff.verification.reviewerDate', verification.reviewerDate || '', 'date')}
                    ${renderTextarea('Verification remarks', 'staff.verification.remarks', verification.remarks || '')}
                    ${renderUploadField('Reviewer signature upload', 'verification.signatureUpload', verification.signatureUpload || null)}
                </div>
            </section>
        `;
    }

    function renderReviewBuhatInline(value, size = 'md') {
        const safeValue = escapeHtml(value || '');
        return `<span class="review-buhat__inline review-buhat__inline--${escapeAttribute(size)}">${safeValue || '&nbsp;'}</span>`;
    }

    function renderReviewBuhatSignatureBlock(caption, signedName, metadata) {
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        const fileName = metadata?.original_name || 'View uploaded file';
        const uploadedAt = metadata?.uploaded_at ? formatDateTime(metadata.uploaded_at) : '';

        return `
            <div class="review-buhat__signature-block">
                <div class="review-buhat__signature-name">${escapeHtml(signedName || '') || '&nbsp;'}</div>
                <div class="review-buhat__signature-caption">${escapeHtml(caption)}</div>
                ${fileUrl ? `
                    <div class="review-buhat__signature-upload">
                        <a class="upload-link" href="${escapeAttribute(fileUrl)}" target="_blank" rel="noopener">${escapeHtml(fileName)}</a>
                        ${uploadedAt ? `<small class="field-hint">${escapeHtml(uploadedAt)}</small>` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderReviewPaperPage(pageNumber, innerHtml, isStaffPage = false) {
        return `
            <section class="review-paper-page ${isStaffPage ? 'review-paper-page--staff' : ''}">
                <header class="review-paper-page__header">
                    <div class="review-paper-page__title">MUNGKAHING PROYEKTO</div>
                    <div class="review-paper-page__subtitle">Sustainable Market and Technology and Employment Assistance Program (SMART LEAP)</div>
                </header>
                <div class="review-paper-page__body">${innerHtml}</div>
                <footer class="review-paper-page__footer">Page ${pageNumber} of 3</footer>
            </section>
        `;
    }

    function renderReviewPaperSectionTitle(index, title) {
        return `<div class="review-paper-section__title"><span>${escapeHtml(index)}</span><strong>${escapeHtml(title)}</strong></div>`;
    }

    function renderReviewPaperLineField(label, value) {
        return `
            <div class="review-paper-line-field">
                <span class="review-paper-line-field__label">${escapeHtml(label)}</span>
                <span class="review-paper-line-field__value">${escapeHtml(value || '--')}</span>
            </div>
        `;
    }

    function renderReviewInlineInput(name, value, type = 'text', className = '') {
        return `<input type="${escapeAttribute(type)}" name="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}" class="${escapeAttribute(className)}">`;
    }

    function renderReviewPaperParagraphBlock(value) {
        return `<div class="review-paper-paragraph">${escapeHtml(value || '--')}</div>`;
    }

    function renderReviewPaperTable(headHtml, bodyHtml, footHtml = '') {
        return `
            <div class="table-wrap">
                <table class="simple-table simple-table--paper">
                    <thead>${headHtml}</thead>
                    <tbody>${bodyHtml || '<tr><td colspan="12">No data entered.</td></tr>'}</tbody>
                    ${footHtml ? `<tfoot>${footHtml}</tfoot>` : ''}
                </table>
            </div>
        `;
    }

    function renderReviewMungkahingSectorMatrix(pantawid, nonPantawid) {
        return renderReviewPaperTable(`
            <tr>
                <th rowspan="2">Paglain-lain</th>
                <th colspan="2">Sex</th>
                <th colspan="8">Sectoral</th>
            </tr>
            <tr>
                <th>Babaye</th><th>Lalake</th>
                <th colspan="2">Senior Citizens</th>
                <th colspan="2">PWD</th>
                <th colspan="2">IP</th>
                <th colspan="2">Solo Parent</th>
            </tr>
            <tr>
                <th></th>
                <th>Babaye</th><th>Lalake</th>
                <th>Babaye</th><th>Lalake</th>
                <th>Babaye</th><th>Lalake</th>
                <th>Babaye</th><th>Lalake</th>
                <th>Babaye</th><th>Lalake</th>
            </tr>
        `, `
            ${renderReviewMungkahingSectorMatrixRow('Pantawid', pantawid)}
            ${renderReviewMungkahingSectorMatrixRow('Non-Pantawid', nonPantawid)}
        `);
    }

    function renderReviewMungkahingSectorMatrixRow(label, group) {
        const mark = (value) => value ? '&#10003;' : '';
        return `
            <tr>
                <td>${escapeHtml(label)}</td>
                <td>${mark(group.sexFemale)}</td>
                <td>${mark(group.sexMale)}</td>
                <td>${mark(group.seniorFemale)}</td>
                <td>${mark(group.seniorMale)}</td>
                <td>${mark(group.pwdFemale)}</td>
                <td>${mark(group.pwdMale)}</td>
                <td>${mark(group.ipFemale)}</td>
                <td>${mark(group.ipMale)}</td>
                <td>${mark(group.soloParentFemale)}</td>
                <td>${mark(group.soloParentMale)}</td>
            </tr>
        `;
    }

    async function handleReviewSubmit(event) {
        event.preventDefault();
        if (!state.activeTask) {
            return;
        }

        const payload = gatherStaffForm();
        try {
            await fetchJson('api/post-approval-review/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body: JSON.stringify({
                    taskId: state.activeTask.id,
                    status: document.getElementById('reviewDecisionStatus')?.value || '',
                    remarks: document.getElementById('reviewDecisionRemarks')?.value || '',
                    staffForm: payload,
                }),
            });
            showToast('Review decision saved.', 'success');
            if (state.embedded && window.parent && window.parent !== window) {
                window.parent.postMessage({ type: 'smartleap-form-review-saved', taskId: state.activeTask.id }, '*');
            }
            await loadQueue();
            await loadTask(state.activeTask.id);
        } catch (error) {
            showToast(error.message || 'Unable to save the review decision.', 'warning');
        }
    }

    function gatherStaffForm() {
        const form = document.getElementById('reviewForm');
        const data = {};
        form?.querySelectorAll('input[name], select[name], textarea[name]').forEach((field) => {
            if (field.name.startsWith('review.')) {
                return;
            }
            if (field instanceof HTMLInputElement && field.type === 'file') {
                return;
            }
            setNestedValue(data, field.name.replace(/^staff\./, ''), field.value);
        });
        return data;
    }

    async function handleReviewerUploadChange(event) {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || input.type !== 'file') {
            return;
        }

        const fieldKey = input.dataset.uploadField || '';
        const file = input.files?.[0];
        if (!fieldKey || !file || !state.activeTask) {
            return;
        }

        input.disabled = true;
        try {
            const body = new FormData();
            body.append('taskId', String(state.activeTask.id));
            body.append('fieldKey', fieldKey);
            body.append('file', file);

            const payload = await fetchJson('api/post-approval-review/upload', {
                method: 'POST',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                },
                body,
            });

            if (payload.upload) {
                const currentPayload = state.activeTask.payload || {};
                currentPayload.staffReview = currentPayload.staffReview || {};
                setNestedValue(currentPayload.staffReview, fieldKey, payload.upload);
                showToast('Reviewer signature uploaded.', 'success');
                renderWorkspace();
            }
        } catch (error) {
            showToast(error.message || 'Unable to upload the reviewer signature right now.', 'warning');
        } finally {
            input.disabled = false;
            input.value = '';
        }
    }

    function renderReadOnlySection(title, rows, extras = []) {
        return `
            <section class="review-section">
                <h4>${escapeHtml(title)}</h4>
                <div class="read-only-grid">
                    ${rows.map(([label, value]) => `
                        <article class="read-only-item">
                            <span>${escapeHtml(label)}</span>
                            <strong>${escapeHtml(value || '--')}</strong>
                        </article>
                    `).join('')}
                </div>
                ${extras.length ? `<div class="review-extra">${extras.join('')}</div>` : ''}
            </section>
        `;
    }

    function renderReviewStatementBlock(title, bodyHtml, signatureHtml = '') {
        return `
            <section class="review-section review-statement-block">
                <div class="review-statement-head">${escapeHtml(title)}</div>
                <div class="review-statement-body">${bodyHtml}</div>
                ${signatureHtml ? `<div class="review-statement-signature">${signatureHtml}</div>` : ''}
            </section>
        `;
    }

    function renderReviewCertificationSentence(html) {
        return `<div class="review-certification-sentence">${html}</div>`;
    }

    function renderReviewSignatureArea(label, fieldsHtml) {
        return `
            <div class="review-signature-area">
                <div class="review-signature-line"></div>
                <div class="review-signature-label">${escapeHtml(label)}</div>
                <div class="review-signature-fields">${fieldsHtml}</div>
            </div>
        `;
    }

    function renderSimpleTable(title, headers, rows) {
        return `
            <section class="review-section">
                <h4>${escapeHtml(title)}</h4>
                <div class="table-wrap">
                    <table class="simple-table">
                        <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
                        <tbody>
                            ${rows.length === 0 ? `<tr><td colspan="${headers.length}">No data entered.</td></tr>` : rows.map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value || '--')}</td>`).join('')}</tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </section>
        `;
    }

    function renderInput(label, name, value, type = 'text') {
        return `
            <label class="form-field">
                <span>${escapeHtml(label)}</span>
                <input type="${escapeAttribute(type)}" name="${escapeAttribute(name)}" value="${escapeAttribute(value || '')}">
            </label>
        `;
    }

    function renderTextarea(label, name, value) {
        return `
            <label class="form-field full">
                <span>${escapeHtml(label)}</span>
                <textarea name="${escapeAttribute(name)}" rows="4">${escapeHtml(value || '')}</textarea>
            </label>
        `;
    }

    function renderSelect(label, name, value, options) {
        return `
            <label class="form-field">
                <span>${escapeHtml(label)}</span>
                <select name="${escapeAttribute(name)}">
                    ${options.map((option) => `<option value="${escapeAttribute(option)}" ${String(option) === String(value) ? 'selected' : ''}>${escapeHtml(option || 'Select')}</option>`).join('')}
                </select>
            </label>
        `;
    }

    function renderUploadField(label, fieldKey, metadata) {
        const fileUrl = metadata?.file_path ? routeUrl(metadata.file_path) : '';
        const fileName = metadata?.original_name || '';
        const uploadedAt = metadata?.uploaded_at ? formatDateTime(metadata.uploaded_at) : '';

        return `
            <div class="form-field full upload-field">
                <span>${escapeHtml(label)}</span>
                <label class="upload-card">
                    <input type="file" class="upload-input" data-upload-field="${escapeAttribute(fieldKey)}" accept=".jpg,.jpeg,.png,.webp,.heic,.heif,.pdf">
                    <span class="upload-card__copy">
                        <strong>${fileName ? 'Replace uploaded file' : 'Upload signature file'}</strong>
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

    document.addEventListener('click', (event) => {
        const button = event.target.closest('[data-add-row="healthAge"]');
        if (!button) {
            return;
        }
        const list = document.getElementById('healthAgeRows');
        if (!list) {
            return;
        }
        const index = list.querySelectorAll('.row-grid').length;
        list.insertAdjacentHTML('beforeend', `
            <div class="row-grid">
                ${renderInput('Requirement', `staff.physicalRequirements.healthAgeRows.${index}.requirement`, '')}
                ${renderInput('Age', `staff.physicalRequirements.healthAgeRows.${index}.age`, '')}
                ${renderInput('Health status', `staff.physicalRequirements.healthAgeRows.${index}.healthStatus`, '')}
            </div>
        `);
    });

    async function fetchJson(path, options = {}) {
        const response = await fetch(routeUrl(path), {
            credentials: 'same-origin',
            headers: { Accept: 'application/json', ...options.headers },
            ...options,
        });

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Unexpected response from ${path}.`);
        }

        const payload = await response.json();
        if (!response.ok) {
            throw new Error(payload.message || 'Request failed.');
        }
        return payload;
    }

    function routeUrl(path) {
        return `${state.baseUrl}/${String(path).replace(/^\/+/, '')}`;
    }

    function reviewBuhatAssetUrl(fileName) {
        const root = String(state.baseUrl || '').replace(/\/public\/?$/, '');
        return `${root}/denzel-frontend-barbielat/htdocs/CSWD/${String(fileName).replace(/^\/+/, '')}`;
    }

    function setNestedValue(target, path, value) {
        const segments = path.split('.');
        let cursor = target;
        segments.forEach((segment, index) => {
            const isLast = index === segments.length - 1;
            const isArrayIndex = /^\d+$/.test(segment);
            if (isLast) {
                if (isArrayIndex && Array.isArray(cursor)) {
                    cursor[Number(segment)] = value;
                } else {
                    cursor[segment] = value;
                }
                return;
            }

            const nextIsArray = /^\d+$/.test(segments[index + 1]);
            if (isArrayIndex) {
                const numeric = Number(segment);
                if (!Array.isArray(cursor)) {
                    return;
                }
                cursor[numeric] = cursor[numeric] ?? (nextIsArray ? [] : {});
                cursor = cursor[numeric];
                return;
            }

            cursor[segment] = cursor[segment] ?? (nextIsArray ? [] : {});
            cursor = cursor[segment];
        });
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
        return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }

    function showToast(message, tone) {
        const stack = document.getElementById('toastStack');
        if (!stack) return;
        const toast = document.createElement('div');
        toast.className = `toast ${tone || 'info'}`;
        toast.textContent = message;
        stack.appendChild(toast);
        setTimeout(() => { toast.style.opacity = '0'; }, 2600);
        setTimeout(() => toast.remove(), 3400);
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

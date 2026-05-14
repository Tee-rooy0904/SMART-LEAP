<section id="validation-section" class="admin-section" data-role-section hidden>
    <div class="validation-shell">
        <section class="section-header admin-layout-header validation-header">
            <div class="validation-header__copy">
                <span class="admin-inline-pill">Stage 1 Intake</span>
            </div>
            <div class="validation-header__actions">
                <button type="button" class="app-btn-outline" id="validationRefreshButton">Refresh</button>
            </div>
        </section>

        <div class="metric-grid metric-grid--compact validation-metrics">
            <article class="metric-card metric-card--soft">
                <div class="metric-card__body">
                    <span class="metric-card__label">Pending Validation</span>
                    <strong class="metric-card__value" id="validationPendingCount">0</strong>
                </div>
            </article>
            <article class="metric-card metric-card--soft">
                <div class="metric-card__body">
                    <span class="metric-card__label">Selected for Current Batch</span>
                    <strong class="metric-card__value" id="validationApprovedCount">0</strong>
                </div>
            </article>
            <article class="metric-card metric-card--soft">
                <div class="metric-card__body">
                    <span class="metric-card__label">Saved for Next Batch</span>
                    <strong class="metric-card__value" id="validationDeferredCount">0</strong>
                </div>
            </article>
        </div>

        <div class="notice info validation-notice" id="validationNotice" hidden></div>

        <div class="validation-tabs" role="tablist" aria-label="Validation queues">
            <button type="button" class="validation-tab is-active" id="validationTabPending" data-validation-tab="pending" role="tab" aria-selected="true">Pending <span id="validationTabPendingCount">0</span></button>
            <button type="button" class="validation-tab" id="validationTabSelected" data-validation-tab="selected" role="tab" aria-selected="false">Selected <span id="validationTabSelectedCount">0</span></button>
            <button type="button" class="validation-tab" id="validationTabSaved" data-validation-tab="saved" role="tab" aria-selected="false">Saved <span id="validationTabSavedCount">0</span></button>
        </div>

        <div class="validation-grid">
            <section class="table-card validation-table-card" data-validation-panel="pending">
                <div class="validation-table-card__head">
                    <h3>Pending</h3>
                    <span class="admin-inline-pill" id="validationPendingBadge">0 pending</span>
                </div>
                <div class="table-wrapper">
                    <table class="data-table validation-table">
                        <thead>
                            <tr>
                                <th>Registrant</th>
                                <th>Complete Address</th>
                                <th>Contact</th>
                                <th>Email</th>
                                <th>Submitted</th>
                                <th class="actions">Action</th>
                            </tr>
                        </thead>
                        <tbody id="validationPendingTableBody">
                            <tr><td colspan="6">No pending Stage 1 registrations yet.</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="table-card validation-table-card" data-validation-panel="selected" hidden>
                <div class="validation-table-card__head">
                    <h3>Selected</h3>
                    <span class="admin-inline-pill" id="validationSelectedBadge">0 selected</span>
                </div>
                <div class="table-wrapper">
                    <table class="data-table validation-table">
                        <thead>
                            <tr>
                                <th>Registrant</th>
                                <th>Complete Address</th>
                                <th>Contact</th>
                                <th>Email</th>
                                <th>Validated</th>
                                <th class="actions">Action</th>
                            </tr>
                        </thead>
                        <tbody id="validationApprovedTableBody">
                            <tr><td colspan="6">No selected Stage 1 registrants yet.</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="table-card validation-table-card" data-validation-panel="saved" hidden>
                <div class="validation-table-card__head">
                    <h3>Saved for Next Batch</h3>
                    <span class="admin-inline-pill" id="validationDeferredBadge">0 saved</span>
                </div>
                <div class="table-wrapper">
                    <table class="data-table validation-table">
                        <thead>
                            <tr>
                                <th>Registrant</th>
                                <th>Complete Address</th>
                                <th>Contact</th>
                                <th>Email</th>
                                <th>Validated</th>
                                <th class="actions">Action</th>
                            </tr>
                        </thead>
                        <tbody id="validationDeferredTableBody">
                            <tr><td colspan="6">No deferred Stage 1 registrants yet.</td></tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </div>
</section>

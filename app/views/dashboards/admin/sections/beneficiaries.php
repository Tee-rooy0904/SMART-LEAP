<section id="beneficiaries-section" class="admin-section" data-role-section hidden>
    <div class="section-header admin-layout-header">
        <div class="admin-layout-header__chips">
            <button type="button" class="app-btn-outline" id="adminBeneficiaryExport">Export CSV</button>
            <button type="button" class="app-btn-outline" id="adminBeneficiaryRefresh">Refresh</button>
        </div>
    </div>
    <div class="admin-beneficiaries-shell">
        <div class="metric-grid metric-grid--compact admin-beneficiaries-snapshots" id="adminBeneficiarySnapshots"></div>

        <div class="filters-row admin-beneficiaries-filters">
            <label class="filter-group filter-group--search">
                <span class="filter-label">Search</span>
                <div class="filter-search">
                    <i class="fas fa-search"></i>
                    <input type="search" id="adminBeneficiarySearch" placeholder="Name, business, email, barangay">
                </div>
            </label>
            <label class="filter-group">
                <span class="filter-label">Barangay</span>
                <select class="filter-select" id="adminBeneficiaryBarangayFilter">
                    <option value="">All barangays</option>
                </select>
            </label>
            <label class="filter-group">
                <span class="filter-label">Assigned PDO</span>
                <select class="filter-select" id="adminBeneficiaryPdoFilter">
                    <option value="">All PDOs</option>
                </select>
            </label>
            <label class="filter-group">
                <span class="filter-label">Repayment</span>
                <select class="filter-select" id="adminBeneficiaryRepaymentFilter">
                    <option value="">All repayment states</option>
                    <option value="no_upload">No Upload Yet</option>
                    <option value="under_review">Under Review</option>
                    <option value="needs_follow_up">Needs Follow-up</option>
                    <option value="partial_paid">Partial Paid</option>
                    <option value="fully_paid">Fully Paid</option>
                </select>
            </label>
            <div class="filter-group filter-group--actions admin-beneficiaries-filter-actions">
                <span class="filter-label">Actions</span>
                <button type="button" class="app-btn-outline" id="adminBeneficiaryClearFilters">Clear</button>
            </div>
        </div>

        <div class="table-card admin-beneficiaries-table-card">
            <div class="admin-beneficiaries-table-head">
                <h3>Beneficiary Roster</h3>
                <span class="admin-inline-pill" id="adminBeneficiaryRosterCount">0 records</span>
            </div>
            <div class="table-wrapper">
                <table class="data-table admin-beneficiaries-table">
                    <thead>
                        <tr>
                            <th>Beneficiary</th>
                            <th>Barangay / PDO</th>
                            <th>Program</th>
                            <th>Repayment</th>
                            <th>Last Activity</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody id="adminBeneficiaryTableBody">
                        <tr><td colspan="6">No beneficiary records yet.</td></tr>
                    </tbody>
                </table>
            </div>
        </div>

        <div class="admin-beneficiary-modal" id="adminBeneficiaryModal" hidden>
            <button type="button" class="admin-beneficiary-modal__backdrop" data-beneficiary-modal-close aria-label="Close beneficiary details"></button>
            <section class="admin-beneficiary-modal__panel" role="dialog" aria-modal="true" aria-labelledby="adminBeneficiaryModalTitle">
                <div class="admin-beneficiary-modal__header">
                    <div>
                        <span class="admin-inline-pill">Beneficiary</span>
                        <h3 id="adminBeneficiaryModalTitle">Beneficiary Details</h3>
                    </div>
                    <button type="button" class="app-btn-outline" data-beneficiary-modal-close>Close</button>
                </div>
                <div class="admin-beneficiary-modal__body" id="adminBeneficiaryModalBody"></div>
                <div class="admin-beneficiary-modal__footer">
                    <button type="button" class="team-action-button team-action-button--primary" id="adminBeneficiaryStatusSave">Save Status</button>
                    <button type="button" class="team-action-button team-action-button--soft" data-beneficiary-modal-close>Close</button>
                </div>
            </section>
        </div>
    </div>
</section>

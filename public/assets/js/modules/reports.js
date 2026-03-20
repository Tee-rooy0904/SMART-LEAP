(function () {
  const { qs, on, setHTML } = window.App.dom;
  const { state, textMatch, inDateRange } = window.App.state;
  const { formatCurrency, formatDate, formatPercent } = window.App.format;

  const sectors = ['PWD', 'Senior Citizen', 'Indigenous People', 'Solo Parent'];
  const reportsCharts = {
    repayment: null,
    gender: null,
    business: null,
    sector: null,
  };

  let bound = false;

  const getReportsFilteredBeneficiaries = () => {
    const filters = state.filters.reports;
    const beneficiaries = state.data.beneficiaries || [];
    return beneficiaries.filter((b) => {
      const sectorMatch = filters.sectors.length === 0 || filters.sectors.includes(b.sector);
      const barangayMatch = filters.barangay === 'All' || b.barangay === filters.barangay;
      const searchMatch = textMatch(b.name, filters.search) || textMatch(b.barangay, filters.search);
      const dateMatch = inDateRange(b.createdAt, filters.from, filters.to);
      return sectorMatch && barangayMatch && searchMatch && dateMatch;
    });
  };

  const getReportsFilteredApplications = () => {
    const filters = state.filters.reports;
    const applications = state.data.applications || [];
    return applications.filter((app) => {
      const sectorMatch = filters.sectors.length === 0 || filters.sectors.includes(app.sector);
      const barangayMatch = filters.barangay === 'All' || app.barangay === filters.barangay;
      const searchMatch = textMatch(app.name, filters.search) || textMatch(app.barangay, filters.search);
      const dateMatch = inDateRange(app.submittedAt, filters.from, filters.to);
      return sectorMatch && barangayMatch && searchMatch && dateMatch;
    });
  };

  const buildToolbar = () => {
    const filters = state.filters.reports;
    return `
      <div class="reports-toolbar">
        <div class="reports-toolbar__row">
          <div class="reports-filter-group">
            <span class="reports-label">Date range</span>
            <div class="reports-date-group">
              <input type="date" id="reports-from" value="${filters.from}">
              <span class="reports-date-sep">to</span>
              <input type="date" id="reports-to" value="${filters.to}">
            </div>
          </div>
          <div class="reports-filter-group">
            <span class="reports-label">Sectors</span>
            <div class="reports-chips" id="reports-sector-chips">
              ${sectors.map((sector) => `
                <button type="button" class="chip ${filters.sectors.includes(sector) ? 'is-active' : ''}" data-sector="${sector}">${sector}</button>
              `).join('')}
            </div>
          </div>
          <div class="reports-filter-group reports-search">
            <i class="fas fa-search"></i>
            <input type="search" id="reports-search" placeholder="Search by name or barangay" value="${filters.search}">
          </div>
          <div class="reports-field">
            <span class="reports-label">Barangay</span>
            <select id="reports-barangay">
              <option value="All">All barangays</option>
              ${(state.data.BARANGAYS || []).map((b) => `<option value="${b}">${b}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="reports-toolbar__row">
          <div class="reports-toolbar__actions">
            <button class="app-btn-ghost" id="reports-refresh">Refresh</button>
            <button class="app-btn-outline" id="reports-export-csv">Export CSV</button>
            <button class="app-btn-outline" id="reports-export-pdf">Export PDF</button>
          </div>
          <div class="reports-toolbar__summary" id="reports-summary-chips"></div>
        </div>
      </div>
    `;
  };

  const buildSummaryChips = (beneficiaries) => {
    const filters = state.filters.reports;
    const summary = [];

    if (filters.from || filters.to) {
      summary.push(`Date: ${filters.from || 'Any'} - ${filters.to || 'Any'}`);
    } else {
      summary.push('Date: All');
    }

    if (filters.sectors.length) {
      summary.push(`Sector: ${filters.sectors.join(', ')}`);
    } else {
      summary.push('Sector: All');
    }

    summary.push(`Results: ${beneficiaries.length}`);

    const container = qs('#reports-summary-chips');
    if (!container) return;

    container.innerHTML = summary.map((item) => `<span class="chip muted">${item}</span>`).join('');
  };

  const buildKpis = (beneficiaries) => {
    const total = beneficiaries.length;
    const requirementsCleared = beneficiaries.reduce((sum, b) => sum + b.requirementsCleared, 0);
    const requirementsTotal = beneficiaries.reduce((sum, b) => sum + b.requirementsTotal, 0);
    const trainingCompleted = beneficiaries.reduce((sum, b) => sum + b.trainingCompleted, 0);
    const trainingTotal = beneficiaries.reduce((sum, b) => sum + b.trainingTotal, 0);

    const complianceRate = requirementsTotal ? (requirementsCleared / requirementsTotal) * 100 : 0;
    const trainingRate = trainingTotal ? (trainingCompleted / trainingTotal) * 100 : 0;

    const repayments = state.data.repaymentRecords || [];
    const verified = repayments.filter((r) => r.status === 'Verified').length;
    const repaymentRate = repayments.length ? (verified / repayments.length) * 100 : 0;

    return `
      <div class="reports-kpis">
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--blue"><i class="fas fa-users"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Total Beneficiaries</div>
              <div class="kpi-card__value">${total}</div>
              <div class="kpi-card__meta">Filtered roster</div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--amber"><i class="fas fa-shield-check"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Compliance Rate</div>
              <div class="kpi-card__value">${formatPercent(complianceRate)}</div>
              <div class="kpi-card__meta">${requirementsCleared}/${requirementsTotal} cleared</div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--green"><i class="fas fa-chalkboard-user"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Training Completion</div>
              <div class="kpi-card__value">${formatPercent(trainingRate)}</div>
              <div class="kpi-card__meta">${trainingCompleted}/${trainingTotal} completed</div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--blue"><i class="fas fa-receipt"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Repayment Verification</div>
              <div class="kpi-card__value">${formatPercent(repaymentRate)}</div>
              <div class="kpi-card__meta">${verified}/${repayments.length} verified</div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const buildReportSummary = (beneficiaries) => {
    const repayments = state.data.repaymentRecords || [];
    const verified = repayments.filter((r) => r.status === 'Verified').length;
    const repaymentRate = repayments.length ? (verified / repayments.length) * 100 : 0;
    const overdueCount = repayments.filter((r) => r.status === 'Overdue').length;
    const assistanceReleased = beneficiaries.reduce((sum, b) => sum + (b.assistanceAmount || 0), 0);
    const trainingCompleted = beneficiaries.reduce((sum, b) => sum + (b.trainingCompleted || 0), 0);
    const trainingTotal = beneficiaries.reduce((sum, b) => sum + (b.trainingTotal || 0), 0);
    const trainingRate = trainingTotal ? (trainingCompleted / trainingTotal) * 100 : 0;

    return `
      <div class="content-card">
        <div class="section-header">
          <h4>Report Summary</h4>
          <p>Key indicators from the filtered dataset.</p>
        </div>
        <ul class="summary-list">
          <li><strong>Total beneficiaries:</strong> ${beneficiaries.length}</li>
          <li><strong>Total assistance released:</strong> ${formatCurrency(assistanceReleased)}</li>
          <li><strong>Repayment verification rate:</strong> ${formatPercent(repaymentRate)}</li>
          <li><strong>Overdue count:</strong> ${overdueCount}</li>
          <li><strong>Training completion rate:</strong> ${formatPercent(trainingRate)}</li>
        </ul>
      </div>
    `;
  };

  const buildCharts = () => {
    return `
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-card__header">
            <h4>Repayment Rate</h4>
            <p>Monthly repayment completion rate.</p>
          </div>
          <div class="chart-wrap"><canvas id="reports-repayment-rate"></canvas></div>
        </div>
        <div class="chart-card chart-card--narrow">
          <div class="chart-card__header">
            <h4>Gender Segregation</h4>
            <p>Male vs Female distribution.</p>
          </div>
          <div class="chart-wrap"><canvas id="reports-gender-pie"></canvas></div>
        </div>
        <div class="chart-card chart-card--wide">
          <div class="chart-card__header">
            <h4>Business Type</h4>
            <p>Business type distribution.</p>
          </div>
          <div class="chart-wrap tall"><canvas id="reports-business-bar"></canvas></div>
        </div>
        <div class="chart-card chart-card--wide">
          <div class="chart-card__header">
            <h4>Beneficiaries by Sector</h4>
            <p>Applicants vs beneficiaries.</p>
          </div>
          <div class="chart-wrap tall"><canvas id="reports-sector-bar"></canvas></div>
        </div>
      </div>
    `;
  };

  const buildTableTabs = () => {
    const tabs = [
      { key: 'repayments', label: 'Repayments' },
      { key: 'training', label: 'Training' },
      { key: 'compliance', label: 'Compliance' },
    ];
    return `
      <div class="reports-table">
        <div class="queue-tabs">
          ${tabs.map((tab) => `
            <button class="queue-tab ${tab.key === state.reports.activeTab ? 'is-active' : ''}" data-reports-tab="${tab.key}">${tab.label}</button>
          `).join('')}
        </div>
        <div class="table-card">
          <div class="table-wrapper">
            <table class="data-table" id="reports-table"></table>
          </div>
          <div class="table-toolbar table-toolbar--footer" id="reports-pagination"></div>
        </div>
      </div>
    `;
  };

  const getReportsTableRows = (tabKey, beneficiaries) => {
    if (tabKey === 'repayments') {
      const repayments = state.data.repaymentRecords || [];
      return repayments.map((r) => {
        const beneficiary = (state.data.beneficiaries || []).find((b) => b.id === r.beneficiaryId);
        return {
          name: beneficiary ? beneficiary.name : 'Unknown',
          barangay: beneficiary ? beneficiary.barangay : '--',
          amount: formatCurrency(r.amount),
          status: r.status,
          date: formatDate(r.date),
        };
      });
    }

    if (tabKey === 'training') {
      return beneficiaries.map((b) => ({
        name: b.name,
        barangay: b.barangay,
        amount: `${b.trainingCompleted}/${b.trainingTotal} sessions`,
        status: b.trainingCompleted === b.trainingTotal ? 'Completed' : 'Ongoing',
        date: formatDate(b.createdAt),
      }));
    }

    return beneficiaries.map((b) => ({
      name: b.name,
      barangay: b.barangay,
      amount: `${b.requirementsCleared}/${b.requirementsTotal} cleared`,
      status: b.requirementsCleared === b.requirementsTotal ? 'Cleared' : 'Pending',
      date: formatDate(b.createdAt),
    }));
  };

  const sortRows = (rows) => {
    const { key, dir } = state.reports.tableSort;
    return [...rows].sort((a, b) => {
      if (a[key] < b[key]) return dir === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const paginateRows = (rows) => {
    const start = (state.reports.page - 1) * state.reports.pageSize;
    return rows.slice(start, start + state.reports.pageSize);
  };

  const renderTable = (beneficiaries) => {
    const table = qs('#reports-table');
    const pagination = qs('#reports-pagination');
    if (!table || !pagination) return;

    const rows = getReportsTableRows(state.reports.activeTab, beneficiaries);
    const sorted = sortRows(rows);
    const paged = paginateRows(sorted);

    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort="name">Name ${state.reports.tableSort.key === 'name' ? (state.reports.tableSort.dir === 'asc' ? '?' : '?') : ''}</th>
          <th data-sort="barangay">Barangay ${state.reports.tableSort.key === 'barangay' ? (state.reports.tableSort.dir === 'asc' ? '?' : '?') : ''}</th>
          <th data-sort="amount">Amount/Status ${state.reports.tableSort.key === 'amount' ? (state.reports.tableSort.dir === 'asc' ? '?' : '?') : ''}</th>
          <th data-sort="status">Status ${state.reports.tableSort.key === 'status' ? (state.reports.tableSort.dir === 'asc' ? '?' : '?') : ''}</th>
          <th data-sort="date">Date ${state.reports.tableSort.key === 'date' ? (state.reports.tableSort.dir === 'asc' ? '?' : '?') : ''}</th>
        </tr>
      </thead>
      <tbody>
        ${paged.length ? paged.map((row) => `
          <tr>
            <td>${row.name}</td>
            <td>${row.barangay}</td>
            <td>${row.amount}</td>
            <td><span class="badge-theme">${row.status}</span></td>
            <td>${row.date}</td>
          </tr>
        `).join('') : '<tr><td colspan="5">No data available.</td></tr>'}
      </tbody>
    `;

    const pageCount = Math.ceil(sorted.length / state.reports.pageSize) || 1;
    pagination.innerHTML = `
      <div class="toolbar-actions">
        <button class="app-btn-ghost" data-page="prev">Prev</button>
        <span class="chip muted">Page ${state.reports.page} of ${pageCount}</span>
        <button class="app-btn-ghost" data-page="next">Next</button>
      </div>
    `;
  };

  const renderCharts = (beneficiaries, applications) => {
    const repaymentCanvas = qs('#reports-repayment-rate');
    const genderCanvas = qs('#reports-gender-pie');
    const businessCanvas = qs('#reports-business-bar');
    const sectorCanvas = qs('#reports-sector-bar');

    if (reportsCharts.repayment) reportsCharts.repayment.destroy();
    if (reportsCharts.gender) reportsCharts.gender.destroy();
    if (reportsCharts.business) reportsCharts.business.destroy();
    if (reportsCharts.sector) reportsCharts.sector.destroy();

    if (!window.Chart) {
      if (repaymentCanvas) repaymentCanvas.parentElement.innerHTML = '<p class="empty-state">Chart unavailable.</p>';
      if (genderCanvas) genderCanvas.parentElement.innerHTML = '<p class="empty-state">Chart unavailable.</p>';
      if (businessCanvas) businessCanvas.parentElement.innerHTML = '<p class="empty-state">Chart unavailable.</p>';
      if (sectorCanvas) sectorCanvas.parentElement.innerHTML = '<p class="empty-state">Chart unavailable.</p>';
      return;
    }

    if (repaymentCanvas) {
      reportsCharts.repayment = new Chart(repaymentCanvas, {
        type: 'line',
        data: {
          labels: (state.data.repaymentTrend || []).map((item) => formatDate(item.month)),
          datasets: [{
            label: 'Completion %',
            data: (state.data.repaymentTrend || []).map((item) => item.rate),
            borderColor: '#16a34a',
            backgroundColor: 'rgba(22,163,74,0.1)',
            tension: 0.3,
            fill: true,
            pointRadius: 3,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, max: 100, ticks: { callback: (value) => `${value}%` } },
          },
        },
      });
    }

    if (genderCanvas) {
      const maleCount = beneficiaries.filter((b) => b.gender === 'Male').length;
      const femaleCount = beneficiaries.filter((b) => b.gender === 'Female').length;
      reportsCharts.gender = new Chart(genderCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Male', 'Female'],
          datasets: [{
            data: [maleCount, femaleCount],
            backgroundColor: ['#2563eb', '#f472b6'],
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
          },
        },
      });
    }

    if (businessCanvas) {
      const businessTypes = ['Establishment', 'Buy & Sell', 'Homemade', 'Livestock', 'Services'];
      const counts = businessTypes.map((type) => beneficiaries.filter((b) => b.businessType === type).length);
      reportsCharts.business = new Chart(businessCanvas, {
        type: 'bar',
        data: {
          labels: businessTypes,
          datasets: [{
            label: 'Beneficiaries',
            data: counts,
            backgroundColor: '#2563eb',
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
            },
          },
        },
      });
    }

    if (sectorCanvas) {
      const applicantCounts = sectors.map((sector) => applications.filter((a) => a.sector === sector).length);
      const beneficiaryCounts = sectors.map((sector) => beneficiaries.filter((b) => b.sector === sector).length);
      reportsCharts.sector = new Chart(sectorCanvas, {
        type: 'bar',
        data: {
          labels: sectors,
          datasets: [
            { label: 'Applicants', data: applicantCounts, backgroundColor: '#2563eb' },
            { label: 'Beneficiaries', data: beneficiaryCounts, backgroundColor: '#16a34a' },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0 },
            },
          },
        },
      });
    }
  };

  const updateReportsView = () => {
    const beneficiaries = getReportsFilteredBeneficiaries();
    const applications = getReportsFilteredApplications();
    buildSummaryChips(beneficiaries);
    renderCharts(beneficiaries, applications);
    renderTable(beneficiaries);
  };

  const exportCSV = (rows, filename) => {
    if (!rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(',')].concat(
      rows.map((row) => headers.map((key) => `"${String(row[key]).replace(/"/g, '""')}"`).join(','))
    ).join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
  };

  const bindReportsEvents = () => {
    if (bound) return;
    bound = true;

    const section = qs('#reports-section');
    if (!section) return;

    on(section, 'click', (e) => {
      const sectorBtn = e.target.closest('[data-sector]');
      if (sectorBtn) {
        const sector = sectorBtn.dataset.sector;
        const sectorsSelected = state.filters.reports.sectors;
        if (sectorsSelected.includes(sector)) {
          state.filters.reports.sectors = sectorsSelected.filter((s) => s !== sector);
        } else {
          state.filters.reports.sectors = sectorsSelected.concat(sector);
        }
        state.reports.page = 1;
        renderReports();
        return;
      }

      const tabBtn = e.target.closest('[data-reports-tab]');
      if (tabBtn) {
        state.reports.activeTab = tabBtn.dataset.reportsTab;
        state.reports.page = 1;
        renderReports();
        return;
      }

      const sortBtn = e.target.closest('th[data-sort]');
      if (sortBtn) {
        const key = sortBtn.dataset.sort;
        const current = state.reports.tableSort;
        const dir = current.key === key && current.dir === 'asc' ? 'desc' : 'asc';
        state.reports.tableSort = { key, dir };
        renderReports();
        return;
      }

      const pageBtn = e.target.closest('[data-page]');
      if (pageBtn) {
        const action = pageBtn.dataset.page;
        const totalRows = getReportsTableRows(state.reports.activeTab, getReportsFilteredBeneficiaries());
        const pageCount = Math.ceil(totalRows.length / state.reports.pageSize) || 1;
        if (action === 'prev') state.reports.page = Math.max(1, state.reports.page - 1);
        if (action === 'next') state.reports.page = Math.min(pageCount, state.reports.page + 1);
        renderReports();
        return;
      }

      if (e.target.id === 'reports-export-csv') {
        const rows = getReportsTableRows(state.reports.activeTab, getReportsFilteredBeneficiaries());
        exportCSV(rows, 'reports-export.csv');
        return;
      }

      if (e.target.id === 'reports-export-pdf') {
        alert('PDF export is not yet wired.');
      }
    });

    const fromInput = qs('#reports-from');
    const toInput = qs('#reports-to');
    const searchInput = qs('#reports-search');
    const barangaySelect = qs('#reports-barangay');
    const refreshBtn = qs('#reports-refresh');

    on(fromInput, 'change', (e) => {
      state.filters.reports.from = e.target.value;
      state.reports.page = 1;
      renderReports();
    });

    on(toInput, 'change', (e) => {
      state.filters.reports.to = e.target.value;
      state.reports.page = 1;
      renderReports();
    });

    on(searchInput, 'input', (e) => {
      state.filters.reports.search = e.target.value;
      state.reports.page = 1;
      renderReports();
    });

    on(barangaySelect, 'change', (e) => {
      state.filters.reports.barangay = e.target.value;
      state.reports.page = 1;
      renderReports();
    });

    on(refreshBtn, 'click', () => {
      renderReports();
    });
  };

  const renderReports = () => {
    const section = qs('#reports-section');
    if (!section) return;

    const beneficiaries = getReportsFilteredBeneficiaries();

    setHTML(section, `
      <div class="section-header">
        <div>
          <h4>Reports & Analytics</h4>
          <p>Filters, KPIs, and detailed operational analytics.</p>
        </div>
      </div>
      ${buildReportSummary(beneficiaries)}
      ${buildToolbar()}
      ${buildKpis(beneficiaries)}
      ${buildCharts()}
      ${buildTableTabs()}
    `);

    const barangaySelect = qs('#reports-barangay');
    if (barangaySelect) barangaySelect.value = state.filters.reports.barangay;

    updateReportsView();
    bindReportsEvents();
  };

  const init = () => {
    renderReports();
  };

  window.App.modules = window.App.modules || {};
  window.App.modules.reports = { init, render: renderReports };
})();

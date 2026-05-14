(function () {
  window.App = window.App || {};
  window.App.modules = window.App.modules || {};
  window.App.state = window.App.state || {};

  const app = window.App;
  const dom = app.dom || {};
  const format = app.format || {};
  const qs = dom.qs || ((selector, root = document) => root.querySelector(selector));
  const setHTML = dom.setHTML || ((node, html) => { if (node) node.innerHTML = html; });
  const formatCurrency = format.formatCurrency || ((value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
  const formatDate = format.formatDate || ((value) => value ? new Date(value).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' }) : '--');
  const formatPercent = format.formatPercent || ((value) => `${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`);

  const baseUrl = (window.SMARTLEAP_BASE_URL || '').replace(/\/+$/, '');
  const chartPalette = ['#2563eb', '#16a34a', '#f97316', '#dc2626', '#7c3aed', '#0891b2', '#eab308', '#be185d', '#475569', '#65a30d'];
  const quarterLabels = [
    { value: '1', label: 'Q1' },
    { value: '2', label: 'Q2' },
    { value: '3', label: 'Q3' },
    { value: '4', label: 'Q4' },
  ];

  let bound = false;
  let reportData = null;
  let loading = false;
  let errorMessage = '';
  let requestId = 0;

  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentYear = String(today.getFullYear());
  const currentQuarter = '1';

  const state = app.state;
  state.filters = state.filters || {};
  state.filters.reports = {
    period: 'monthly',
    month: currentMonth,
    quarter: currentQuarter,
    year: currentYear,
    from: '',
    to: '',
    barangay: '',
    sector: '',
    serviceType: '',
    gender: '',
    ageGroup: '',
    pdo: '',
    repayment: '',
    search: '',
    ...(state.filters.reports || {}),
  };

  const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  const routeUrl = (path) => `${baseUrl}/${String(path || '').replace(/^\/+/, '')}`;

  const reportExportBase = () => {
    const path = window.location.pathname || '';
    return path.includes('social-worker') ? 'social-worker/reports/export' : 'admin/reports/export';
  };

  const selectedAttr = (current, value) => String(current || '') === String(value || '') ? 'selected' : '';

  const optionList = (values) => Array.isArray(values) ? values.filter((value) => String(value || '').trim() !== '') : [];

  const normalizeFilterValue = (value) => {
    const raw = String(value || '').trim();
    return raw === 'All' ? '' : raw;
  };

  const filterSearch = (items) => {
    const search = String(state.filters.reports.search || '').trim().toLowerCase();
    if (!search) return items;
    return items.filter((record) => [
      record.name,
      record.email,
      record.businessName,
      record.barangay,
      record.assignedPdo,
      record.serviceType,
      record.sector,
    ].some((value) => String(value || '').toLowerCase().includes(search)));
  };

  const records = () => filterSearch(Array.isArray(reportData?.records) ? reportData.records : []);

  const buildReportQuery = () => {
    const filters = state.filters.reports;
    const params = new URLSearchParams();
    [
      ['period', filters.period || 'monthly'],
      ['month', filters.month],
      ['quarter', filters.quarter],
      ['year', filters.year],
      ['from', filters.from],
      ['to', filters.to],
      ['barangay', normalizeFilterValue(filters.barangay)],
      ['sector', normalizeFilterValue(filters.sector)],
      ['serviceType', normalizeFilterValue(filters.serviceType)],
      ['gender', normalizeFilterValue(filters.gender)],
      ['ageGroup', normalizeFilterValue(filters.ageGroup)],
      ['pdo', normalizeFilterValue(filters.pdo)],
      ['repayment', normalizeFilterValue(filters.repayment)],
    ].forEach(([key, value]) => {
      if (String(value || '').trim() !== '') params.set(key, value);
    });
    return params;
  };

  const fetchReportData = async () => {
    const currentRequest = ++requestId;
    loading = true;
    errorMessage = '';
    renderStatus();

    const query = buildReportQuery();
    const url = query.toString() ? `${routeUrl('api/reports')}?${query}` : routeUrl('api/reports');

    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json') ? await response.json() : { ok: false, message: 'Unexpected server response.' };
      if (!response.ok || payload.ok === false || payload.success === false) {
        throw new Error(payload.message || 'Unable to load report data.');
      }
      if (currentRequest !== requestId) return;
      reportData = payload.data || {};
    } catch (error) {
      if (currentRequest !== requestId) return;
      reportData = null;
      errorMessage = error.message || 'Unable to load report data.';
    } finally {
      if (currentRequest === requestId) {
        loading = false;
        renderReportShell();
        updateReportsView();
      }
    }
  };

  const countBy = (items, resolver) => {
    const map = new Map();
    items.forEach((item) => {
      const label = String(resolver(item) || 'Not Set').trim() || 'Not Set';
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries()).map(([label, count]) => ({ label, count }));
  };

  const currentSummary = (items) => ({
    totalBeneficiaries: items.length,
    genderDistribution: countBy(items, (record) => record.gender),
    serviceTypeDistribution: countBy(items, (record) => record.serviceType || record.businessType),
    barangayDistribution: countBy(items, (record) => record.barangay),
  });

  const buildToolbar = () => {
    const filters = state.filters.reports;
    const options = reportData?.options || {};
    const period = filters.period || 'monthly';
    const years = optionList(options.years).length ? optionList(options.years) : [currentYear];

    const periodControls = period === 'monthly'
      ? `
        <div class="reports-field">
          <span class="reports-label">Month</span>
          <input type="month" id="reports-month" value="${escapeHtml(filters.month || currentMonth)}">
        </div>
        <div class="reports-field">
          <span class="reports-label">Year</span>
          <select id="reports-year">
            ${years.map((value) => `<option value="${escapeHtml(value)}" ${selectedAttr(filters.year || currentYear, value)}>${escapeHtml(value)}</option>`).join('')}
          </select>
        </div>
      `
      : period === 'quarterly'
        ? `
          <div class="reports-field">
            <span class="reports-label">Repayment Quarter</span>
            <select id="reports-quarter">
              ${quarterLabels.map((item) => `<option value="${item.value}" ${selectedAttr(filters.quarter || currentQuarter, item.value)}>${item.label}</option>`).join('')}
            </select>
          </div>
          <div class="reports-field">
            <span class="reports-label">Year</span>
            <select id="reports-year">
              ${years.map((value) => `<option value="${escapeHtml(value)}" ${selectedAttr(filters.year || currentYear, value)}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </div>
        `
        : period === 'yearly'
          ? `
            <div class="reports-field">
              <span class="reports-label">Year</span>
              <select id="reports-year">
                ${years.map((value) => `<option value="${escapeHtml(value)}" ${selectedAttr(filters.year || currentYear, value)}>${escapeHtml(value)}</option>`).join('')}
              </select>
            </div>
          `
          : `
            <div class="reports-field">
              <span class="reports-label">From</span>
              <input type="date" id="reports-from" value="${escapeHtml(filters.from)}">
            </div>
            <div class="reports-field">
              <span class="reports-label">To</span>
              <input type="date" id="reports-to" value="${escapeHtml(filters.to)}">
            </div>
          `;

    return `
      <div class="reports-toolbar reports-filter-card">
        <div class="reports-filter-grid reports-filter-grid--realtime">
          <div class="reports-filter-group reports-search">
            <span class="reports-label">Search</span>
            <i class="fas fa-search" aria-hidden="true"></i>
            <input type="search" id="reports-search" placeholder="Search beneficiary, barangay, business, or PDO" value="${escapeHtml(filters.search)}">
          </div>
          <div class="reports-field">
            <span class="reports-label">View Type</span>
            <select id="reports-period">
              <option value="monthly" ${selectedAttr(period, 'monthly')}>Monthly</option>
              <option value="quarterly" ${selectedAttr(period, 'quarterly')}>Quarterly</option>
              <option value="yearly" ${selectedAttr(period, 'yearly')}>Yearly</option>
              <option value="custom" ${selectedAttr(period, 'custom')}>Custom Range</option>
            </select>
          </div>
          ${periodControls}
          <div class="reports-field">
            <span class="reports-label">Barangay</span>
            <select id="reports-barangay">
              <option value="" ${selectedAttr(filters.barangay, '')}>All barangays</option>
              ${optionList(options.barangays).map((value) => `<option value="${escapeHtml(value)}" ${selectedAttr(filters.barangay, value)}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </div>
          <div class="reports-field">
            <span class="reports-label">Assigned PDO</span>
            <select id="reports-pdo">
              <option value="" ${selectedAttr(filters.pdo, '')}>All PDOs</option>
              ${optionList(options.pdos).map((value) => `<option value="${escapeHtml(value)}" ${selectedAttr(filters.pdo, value)}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </div>
          <div class="reports-field">
            <span class="reports-label">Service Type</span>
            <select id="reports-service-type">
              <option value="" ${selectedAttr(filters.serviceType, '')}>All service types</option>
              ${optionList(options.serviceTypes).map((value) => `<option value="${escapeHtml(value)}" ${selectedAttr(filters.serviceType, value)}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </div>
          <div class="reports-field">
            <span class="reports-label">Gender</span>
            <select id="reports-gender">
              <option value="" ${selectedAttr(filters.gender, '')}>All genders</option>
              ${optionList(options.genders).map((value) => `<option value="${escapeHtml(value)}" ${selectedAttr(filters.gender, value)}>${escapeHtml(value)}</option>`).join('')}
            </select>
          </div>
          <div class="reports-field">
            <span class="reports-label">Repayment State</span>
            <select id="reports-repayment">
              <option value="" ${selectedAttr(filters.repayment, '')}>All repayment states</option>
              ${(options.repaymentStates || []).map((item) => `<option value="${escapeHtml(item.key)}" ${selectedAttr(filters.repayment, item.key)}>${escapeHtml(item.label)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="reports-filter-actions">
          <span class="reports-result-count" id="reports-summary-chips"></span>
          <div class="reports-toolbar__actions">
            <button class="app-btn-ghost" id="reports-clear" type="button">Clear</button>
            <button class="app-btn-outline" id="reports-refresh" type="button">Refresh</button>
            <button class="app-btn-outline" id="reports-export-csv" type="button">Export CSV</button>
            <button class="app-btn-outline" id="reports-export-pdf" type="button">Export PDF</button>
          </div>
        </div>
      </div>
    `;
  };

  const buildSummaryChips = (items, metrics) => {
    const node = qs('#reports-summary-chips');
    if (!node) return;
    const label = metrics?.label || reportData?.filters?.periodLabel || 'Selected period';
    node.textContent = `${items.length} ${items.length === 1 ? 'record' : 'records'} shown - ${label}`;
  };

  const renderStatus = () => {
    const status = qs('#reports-status');
    if (!status) return;
    if (loading) {
      status.innerHTML = '<div class="admin-reports-loading">Loading live report data.</div>';
      return;
    }
    status.innerHTML = errorMessage ? `<div class="admin-alert admin-alert--danger">${escapeHtml(errorMessage)}</div>` : '';
  };

  const renderVerticalBars = (root, rows, options = {}) => {
    if (!root) return;
    const max = Math.max(...rows.map((row) => Number(row.count || row.value || 0)), 1);
    root.innerHTML = `
      <div class="reports-vertical-chart" role="img" aria-label="${escapeHtml(options.label || 'Vertical bar chart')}">
        <div class="reports-vertical-chart__plot">
          ${rows.length ? rows.map((row, index) => {
            const value = Number(row.count || row.value || 0);
            const height = Math.max(8, Math.round((value / max) * 100));
            return `
              <div class="reports-vertical-chart__item">
                <span class="reports-vertical-chart__value">${escapeHtml(options.formatValue ? options.formatValue(value, row) : String(value))}</span>
                <span class="reports-vertical-chart__bar" style="--bar-height:${height}%;--bar-color:${options.colors?.[index] || chartPalette[index % chartPalette.length]}"></span>
                <span class="reports-vertical-chart__label">${escapeHtml(row.label)}</span>
              </div>
            `;
          }).join('') : '<p class="reports-empty">No data available.</p>'}
        </div>
      </div>
    `;
  };

  const renderPie = (root, rows) => {
    if (!root) return;
    const total = rows.reduce((sum, row) => sum + Number(row.count || 0), 0);
    if (!rows.length || total <= 0) {
      root.innerHTML = '<p class="reports-empty">No data available.</p>';
      return;
    }

    let cumulative = 0;
    const segments = rows.map((row, index) => {
      const start = cumulative;
      cumulative += (Number(row.count || 0) / total) * 100;
      return `${chartPalette[index % chartPalette.length]} ${start}% ${cumulative}%`;
    }).join(', ');

    root.innerHTML = `
      <div class="reports-pie-chart" role="img" aria-label="Gender distribution pie chart">
        <div class="reports-pie-chart__graphic" style="background: conic-gradient(${segments});"></div>
        <div class="reports-pie-chart__legend">
          ${rows.map((row, index) => {
            const count = Number(row.count || 0);
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return `
              <span class="admin-v1-legend__item">
                <span class="admin-v1-legend__dot" style="background:${chartPalette[index % chartPalette.length]};"></span>
                <span>${escapeHtml(row.label)}</span>
                <strong>${count}</strong>
                <small>${percentage}%</small>
              </span>
            `;
          }).join('')}
        </div>
      </div>
    `;
  };

  const renderMonthlyPaymentChart = (root, rows) => {
    if (!root) return;
    if (!rows.length) {
      root.innerHTML = '<p class="reports-empty">No repayment records yet.</p>';
      return;
    }

    const series = [
      { key: 'targetAmount', label: 'Target', color: '#2563eb' },
      { key: 'actualCollectedAmount', label: 'Actual', color: '#16a34a' },
      { key: 'gapAmount', label: 'Gap', color: '#dc2626' },
    ];
    const rawMax = Math.max(...rows.flatMap((row) => series.map((item) => Number(row[item.key] || 0))), 1);
    const step = rawMax <= 5000
      ? 1000
      : rawMax <= 20000
        ? 5000
        : 20000;
    const maxValue = Math.max(step, Math.ceil(rawMax / step) * step);
    const ticks = [];
    for (let value = maxValue; value >= 0; value -= step) {
      ticks.push(value);
    }

    root.innerHTML = `
      <div class="reports-monthly-payment-chart" role="img" aria-label="Monthly payments of SMART LEAP beneficiaries">
        <div class="reports-monthly-payment-chart__body">
          <div class="reports-monthly-payment-chart__axis-title">Payments</div>
          <div class="reports-monthly-payment-chart__axis">
            ${ticks.map((value) => `<span>${escapeHtml(Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}</span>`).join('')}
          </div>
          <div class="reports-monthly-payment-chart__plot">
            <div class="reports-monthly-payment-chart__guides">
              ${ticks.map(() => '<i></i>').join('')}
            </div>
            <div class="reports-monthly-payment-chart__groups" style="--month-count:${rows.length};">
              ${rows.map((row) => `
                <article class="reports-monthly-payment-chart__group">
                  <div class="reports-monthly-payment-chart__bars">
                    ${series.map((item) => {
                      const value = Number(row[item.key] || 0);
                      const height = maxValue > 0 ? Math.max(value > 0 ? 3 : 0, (value / maxValue) * 100) : 0;
                      return `
                        <span class="reports-monthly-payment-chart__bar" style="--bar-height:${height}%;--bar-color:${item.color};" title="${escapeHtml(item.label)}: ${formatCurrency(value)}">
                          <strong>${escapeHtml(formatCurrency(value).replace(/^PHP\s?/, '₱'))}</strong>
                        </span>
                      `;
                    }).join('')}
                  </div>
                  <span class="reports-monthly-payment-chart__month">${escapeHtml(String(row.label || row.period || '').toUpperCase())}</span>
                </article>
              `).join('')}
            </div>
          </div>
          <div class="reports-monthly-payment-chart__legend">
            ${series.map((item) => `<span><i style="background:${item.color}"></i>${escapeHtml(item.label)}</span>`).join('')}
          </div>
        </div>
        <div class="reports-monthly-payment-chart__x-title">Months</div>
      </div>
    `;
  };

  const buildPerformanceSection = (metrics) => `
    <div class="charts-grid">
      <div class="chart-card chart-card--full">
        <div class="chart-card__header">
          <div>
            <h4>Repayment Performance</h4>
            <p>Targeted collections, actual collected repayments, reporting gap, and ROI for the selected period.</p>
          </div>
        </div>
        <div class="reports-repayment-status-kpis">
          ${[
            { label: 'Target Amount', value: formatCurrency(metrics.targetAmount || 0), meta: metrics.label || 'Selected period', color: '#2563eb' },
            { label: 'Actual Collected', value: formatCurrency(metrics.actualCollectedAmount || 0), meta: `${metrics.scopedBeneficiaries || 0} scoped beneficiaries`, color: '#16a34a' },
            { label: 'Gap', value: formatCurrency(metrics.gapAmount || 0), meta: `${metrics.obligationCount || 0} repayment months covered`, color: '#dc2626' },
            { label: 'ROI', value: formatPercent(metrics.roiPercent || 0), meta: 'Actual / target x 100', color: '#7c3aed' },
          ].map((card) => `
            <article class="reports-repayment-status-kpi" style="--kpi-color:${card.color}">
              <span>${escapeHtml(card.label)}</span>
              <strong>${escapeHtml(card.value)}</strong>
              <small>${escapeHtml(card.meta)}</small>
            </article>
          `).join('')}
        </div>
        <div class="chart-wrap reports-monthly-payment-chart-wrap" id="reports-performance-bars"></div>
      </div>
      <div class="chart-card chart-card--narrow">
        <div class="chart-card__header">
          <h4>Gender Segregation</h4>
        </div>
        <div class="chart-wrap" id="reports-gender-pie"></div>
      </div>
      <div class="chart-card chart-card--wide">
        <div class="chart-card__header">
          <h4>Service Type Distribution</h4>
        </div>
        <div class="chart-wrap tall" id="reports-business-bar"></div>
      </div>
    </div>
  `;

  const updateReportsView = () => {
    const content = qs('#reports-content');
    if (!content) return;

    const items = records();
    const summary = currentSummary(items);
    const metrics = reportData?.repaymentAnalytics?.periodMetrics || reportData?.summary?.repaymentPerformance || {
      label: 'Selected period',
      targetAmount: 0,
      actualCollectedAmount: 0,
      gapAmount: 0,
      roiPercent: 0,
      scopedBeneficiaries: items.length,
      obligationCount: 0,
    };
    const monthlyBreakdown = Array.isArray(reportData?.repaymentAnalytics?.monthlyBreakdown)
      ? reportData.repaymentAnalytics.monthlyBreakdown
      : [];

    content.innerHTML = `${buildToolbar()}${buildPerformanceSection(metrics)}`;
    buildSummaryChips(items, metrics);

    renderMonthlyPaymentChart(qs('#reports-performance-bars'), monthlyBreakdown);

    renderPie(qs('#reports-gender-pie'), summary.genderDistribution || []);
    renderVerticalBars(qs('#reports-business-bar'), summary.serviceTypeDistribution || [], {
      label: 'Service type distribution',
    });
  };

  const renderReportShell = () => {
    const section = qs('#reports-section');
    if (!section) return;
    renderStatus();
    const content = qs('#reports-content');
    if (content) return;
    section.innerHTML = `
      <div id="reports-status"></div>
      <div id="reports-content"></div>
    `;
    renderStatus();
  };

  const exportReport = (formatType) => {
    const query = buildReportQuery();
    const target = routeUrl(`${reportExportBase()}/${formatType}`);
    window.open(query.toString() ? `${target}?${query}` : target, '_blank', 'noopener');
  };

  const resetFilters = () => {
    state.filters.reports = {
      period: 'monthly',
      month: currentMonth,
      quarter: currentQuarter,
      year: currentYear,
      from: '',
      to: '',
      barangay: '',
      sector: '',
      serviceType: '',
      gender: '',
      ageGroup: '',
      pdo: '',
      repayment: '',
      search: '',
    };
  };

  const bindEvents = () => {
    if (bound) return;
    bound = true;

    const section = qs('#reports-section');
    if (!section) return;

    section.addEventListener('input', (event) => {
      const id = event.target?.id || '';
      if (id === 'reports-search') {
        state.filters.reports.search = event.target.value;
        updateReportsView();
      }
    });

    section.addEventListener('change', (event) => {
      const id = event.target?.id || '';
      if (!id.startsWith('reports-')) return;
      if (id === 'reports-period') {
        state.filters.reports.period = event.target.value;
        renderReportShell();
        updateReportsView();
        fetchReportData();
        return;
      }
      if (id === 'reports-month') state.filters.reports.month = event.target.value;
      else if (id === 'reports-quarter') state.filters.reports.quarter = event.target.value;
      else if (id === 'reports-year') state.filters.reports.year = event.target.value;
      else if (id === 'reports-from') state.filters.reports.from = event.target.value;
      else if (id === 'reports-to') state.filters.reports.to = event.target.value;
      else if (id === 'reports-barangay') state.filters.reports.barangay = event.target.value;
      else if (id === 'reports-pdo') state.filters.reports.pdo = event.target.value;
      else if (id === 'reports-sector') state.filters.reports.sector = event.target.value;
      else if (id === 'reports-service-type') state.filters.reports.serviceType = event.target.value;
      else if (id === 'reports-gender') state.filters.reports.gender = event.target.value;
      else if (id === 'reports-repayment') state.filters.reports.repayment = event.target.value;
      fetchReportData();
    });

    section.addEventListener('click', (event) => {
      const id = event.target?.id || '';
      if (id === 'reports-clear') {
        resetFilters();
        renderReportShell();
        updateReportsView();
        fetchReportData();
        return;
      }
      if (id === 'reports-refresh') {
        fetchReportData();
        return;
      }
      if (id === 'reports-export-csv') {
        exportReport('csv');
        return;
      }
      if (id === 'reports-export-pdf') {
        exportReport('pdf');
      }
    });
  };

  const init = () => {
    renderReportShell();
    bindEvents();
    fetchReportData();
  };

  const renderReports = () => {
    renderReportShell();
    bindEvents();
    if (!reportData && !loading) {
      fetchReportData();
      return;
    }
    updateReportsView();
  };

  window.App.modules.reports = { init, render: renderReports, refresh: fetchReportData };
})();

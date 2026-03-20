(function () {
  const { qs, on, setHTML } = window.App.dom;
  const { state } = window.App.state;
  const { formatCurrency, formatPercent, formatDate } = window.App.format;

  let trendChart = null;
  let sectorChart = null;
  let bound = false;

  const buildAlerts = (metrics) => {
    return `
      <div class="section-header">
        <h4>Attention Needed</h4>
        <p>Items that need follow-up today.</p>
      </div>
      <div class="alerts-chips" id="dashboard-alert-chips">
        <button class="alert-chip is-info" data-queue="pending" type="button">
          <span><i class="fas fa-receipt"></i> Pending proofs</span><strong>${metrics.pendingProofs}</strong>
        </button>
        <button class="alert-chip is-warning" data-queue="missing" type="button">
          <span><i class="fas fa-clipboard-check"></i> Missing requirements</span><strong>${metrics.missingRequirements}</strong>
        </button>
        <button class="alert-chip is-danger" data-queue="overdue" type="button">
          <span><i class="fas fa-triangle-exclamation"></i> Overdue repayments</span><strong>${metrics.overdueRepayments}</strong>
        </button>
        <button class="alert-chip is-success" data-queue="upcoming" type="button">
          <span><i class="fas fa-chalkboard-user"></i> Upcoming trainings</span><strong>${metrics.upcomingTrainings}</strong>
        </button>
      </div>
    `;
  };

  const buildExecutiveSummary = (metrics) => {
    return `
      <div class="reports-summary-panel exec-summary">
        <div class="exec-summary__top">
          <div>
            <h3 class="exec-summary__title">Executive Program Summary</h3>
            <p class="exec-summary__subtitle">At-a-glance health of the program pipeline.</p>
          </div>
        </div>

        <div class="exec-summary__section">
          <div class="exec-summary__sectionhead">
            <h4>Program Snapshot</h4>
            <span class="exec-summary__hint">Applications → Training → Beneficiary</span>
          </div>

          <div class="exec-grid">
            <div class="exec-tile">
              <div class="exec-tile__label">Total Applicants</div>
              <div class="exec-tile__value">${metrics.totalApplicants}</div>
            </div>

            <div class="exec-tile">
              <div class="exec-tile__label">Approved/Active Beneficiaries</div>
              <div class="exec-tile__value">${metrics.activeBeneficiaries}</div>
            </div>

            <div class="exec-tile">
              <div class="exec-tile__label">Training Completion Rate</div>
              <div class="exec-tile__value">${formatPercent(metrics.trainingCompletion)}</div>
            </div>

            <div class="exec-tile">
              <div class="exec-tile__label">Repayment Verification Rate</div>
              <div class="exec-tile__value">${formatPercent(metrics.repaymentVerificationRate)}</div>
            </div>
          </div>
        </div>

        <div class="exec-summary__section">
          <div class="exec-summary__sectionhead">
            <h4>Financial Snapshot</h4>
            <span class="exec-summary__hint">Release and remittance monitoring</span>
          </div>

          <div class="exec-grid">
            <div class="exec-tile">
              <div class="exec-tile__label">Total Assistance Released</div>
              <div class="exec-tile__value">${formatCurrency(metrics.totalAssistanceReleased)}</div>
            </div>

            <div class="exec-tile">
              <div class="exec-tile__label">Total Collected</div>
              <div class="exec-tile__value">${formatCurrency(metrics.totalCollected)}</div>
            </div>

            <div class="exec-tile">
              <div class="exec-tile__label">Outstanding Balance</div>
              <div class="exec-tile__value">${formatCurrency(metrics.outstandingBalance)}</div>
            </div>

            <div class="exec-tile exec-tile--danger">
              <div class="exec-tile__label">Overdue Cases</div>
              <div class="exec-tile__value">${metrics.overdueRepayments}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const buildKpis = (metrics) => {
    return `
      <div class="reports-kpis">
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--blue"><i class="fas fa-users"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Active Beneficiaries</div>
              <div class="kpi-card__value">${metrics.activeBeneficiaries}</div>
              <div class="kpi-card__meta">${metrics.totalBeneficiaries} total</div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--amber"><i class="fas fa-clipboard-check"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Requirements Completion</div>
              <div class="kpi-card__value">${formatPercent(metrics.requirementsCompliance)}</div>
              <div class="kpi-card__meta">${metrics.requirementsCleared}/${metrics.requirementsTotal} cleared</div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--green"><i class="fas fa-chalkboard-user"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Training Completion</div>
              <div class="kpi-card__value">${formatPercent(metrics.trainingCompletion)}</div>
              <div class="kpi-card__meta">${metrics.trainingCompleted}/${metrics.trainingTotal} completed</div>
            </div>
          </div>
        </div>
        <div class="kpi-card kpi-card--with-icon">
          <div class="kpi-card__header">
            <div class="kpi-card__icon kpi-card__icon--red"><i class="fas fa-triangle-exclamation"></i></div>
            <div class="kpi-card__content">
              <div class="kpi-card__title">Overdue Count</div>
              <div class="kpi-card__value">${metrics.overdueRepayments}</div>
              <div class="kpi-card__meta">Overdue repayments</div>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const buildQueue = (queueData, activeTab) => {
    const tabs = [
      { key: 'pending', label: 'Pending proofs' },
      { key: 'missing', label: 'Missing requirements' },
      { key: 'upcoming', label: 'Upcoming trainings' },
      { key: 'overdue', label: 'Overdue repayments' },
    ];

    const rows = queueData[activeTab] || [];

    const tableRows = rows.map((row) => {
      const statusText = String(row.status || '');
      let statusClass = 'badge-theme';
      if (statusText.includes('Overdue')) statusClass = 'badge-theme danger';
      else if (statusText.includes('Verified') || statusText.includes('Completed')) statusClass = 'badge-theme success';
      return `
        <tr>
          <td>${row.name}</td>
          <td>${row.meta}</td>
          <td>${row.amount || '--'}</td>
          <td><span class="${statusClass}">${row.status}</span></td>
          <td class="actions"><button class="queue-btn" data-queue-action="${row.action}">${row.actionLabel}</button></td>
        </tr>
      `;
    }).join('');

    return `
      <div class="dashboard-queue" id="dashboard-queue">
        <div class="section-header">
          <h4>Action Queue</h4>
          <p>Prioritized items that need attention today.</p>
        </div>
        <div class="queue-tabs">
          ${tabs.map((tab) => `
            <button class="queue-tab ${tab.key === activeTab ? 'is-active' : ''}" data-queue-tab="${tab.key}">${tab.label}</button>
          `).join('')}
        </div>
        <div class="table-card">
          <div class="table-wrapper">
            <table class="queue-table__table data-table">
              <thead>
                <tr>
                  <th>Beneficiary</th>
                  <th>Month/Date</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th class="actions">Action</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || '<tr><td colspan="5">No items in this queue.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  const buildActivity = (activityLog) => {
    const items = activityLog.map((entry) => {
      return `
        <li>
          <span>${entry.message}</span>
          <small>${entry.time}</small>
        </li>
      `;
    }).join('');

    return `
      <div class="activity-widget">
        <div class="section-header">
          <h4>Activity Log</h4>
          <p>Latest updates across modules.</p>
        </div>
        <ul class="activity-list">${items}</ul>
      </div>
    `;
  };


  const computeMetrics = () => {
    const data = state.data;
    const beneficiaries = data.beneficiaries || [];
    const repayments = data.repaymentRecords || [];
    const trainingSessions = data.trainingSessions || [];
    const applications = data.applications || [];

    const totalBeneficiaries = beneficiaries.length;
    let activeBeneficiaries = beneficiaries.filter((b) => b.status === 'Active' || b.status === 'Approved').length;
    if (!activeBeneficiaries && totalBeneficiaries) activeBeneficiaries = totalBeneficiaries;
    const inactiveBeneficiaries = totalBeneficiaries - activeBeneficiaries;

    const requirementsCleared = beneficiaries.reduce((sum, b) => sum + (b.requirementsCleared || 0), 0);
    const requirementsTotal = beneficiaries.reduce((sum, b) => sum + (b.requirementsTotal || 0), 0);
    let trainingCompleted = beneficiaries.reduce((sum, b) => sum + (b.trainingCompleted || 0), 0);
    let trainingTotal = beneficiaries.reduce((sum, b) => sum + (b.trainingTotal || 0), 0);

    if (!trainingTotal && trainingSessions.length) {
      trainingTotal = trainingSessions.length;
      trainingCompleted = trainingSessions.filter((t) => t.status === 'Completed').length;
    }

    const verifiedReceipts = repayments.filter((r) => r.status === 'Verified').length;
    const verifiedAmount = repayments.filter((r) => r.status === 'Verified').reduce((sum, r) => sum + r.amount, 0);
    const totalCollected = verifiedAmount;

    const pendingProofs = repayments.filter((r) => r.status === 'Pending').length;
    const overdueRepayments = repayments.filter((r) => r.status === 'Overdue').length;
    const missingRequirements = beneficiaries.filter((b) => b.requirementsTotal > 0 && b.requirementsCleared < b.requirementsTotal).length;
    const upcomingTrainings = trainingSessions.filter((t) => t.status === 'Upcoming').length;

    const totalAssistanceReleased = beneficiaries.reduce((sum, b) => sum + (b.assistanceAmount || 0), 0);
    const outstandingBalance = totalAssistanceReleased - totalCollected;
    const repaymentVerificationRate = repayments.length ? (verifiedReceipts / repayments.length) * 100 : 0;

    return {
      totalApplicants: applications.length,
      totalBeneficiaries,
      activeBeneficiaries,
      inactiveBeneficiaries,
      requirementsCleared,
      requirementsTotal,
      requirementsCompliance: requirementsTotal ? (requirementsCleared / requirementsTotal) * 100 : 0,
      trainingCompleted,
      trainingTotal,
      trainingCompletion: trainingTotal ? (trainingCompleted / trainingTotal) * 100 : 0,
      verifiedReceipts,
      verifiedAmount,
      totalCollected,
      totalAssistanceReleased,
      outstandingBalance,
      repaymentVerificationRate,
      pendingProofs,
      overdueRepayments,
      missingRequirements,
      upcomingTrainings,
    };
  };

  const buildQueueData = () => {
    const data = state.data;
    const beneficiaries = data.beneficiaries || [];
    const repayments = data.repaymentRecords || [];
    const trainingSessions = data.trainingSessions || [];

    const pending = repayments.filter((r) => r.status === 'Pending').map((r) => {
      const beneficiary = beneficiaries.find((b) => b.id === r.beneficiaryId);
      return {
        name: beneficiary ? beneficiary.name : 'Unknown',
        meta: formatDate(r.month),
        amount: formatCurrency(r.amount),
        status: r.status,
        action: 'repayments-pending',
        actionLabel: 'Review',
      };
    });

    const missing = beneficiaries.filter((b) => b.requirementsCleared < b.requirementsTotal).map((b) => ({
      name: b.name,
      meta: `${b.requirementsCleared}/${b.requirementsTotal} cleared`,
      amount: '--',
      status: 'Pending',
      action: 'applications-missing',
      actionLabel: 'Open profile',
    }));

    const upcoming = trainingSessions.filter((t) => t.status === 'Upcoming').map((t) => ({
      name: t.title,
      meta: formatDate(t.date),
      amount: `${t.participants} participants`,
      status: t.status,
      action: 'training-upcoming',
      actionLabel: 'View roster',
    }));

    const overdue = repayments.filter((r) => r.status === 'Overdue').map((r) => {
      const beneficiary = beneficiaries.find((b) => b.id === r.beneficiaryId);
      return {
        name: beneficiary ? beneficiary.name : 'Unknown',
        meta: formatDate(r.month),
        amount: formatCurrency(r.amount),
        status: r.status,
        action: 'repayments-overdue',
        actionLabel: 'Review',
      };
    });

    return { pending, missing, upcoming, overdue };
  };

  const renderCharts = () => {
    const data = state.data;
    const trendCanvas = qs('#dashboard-trend-chart');
    const sectorCanvas = qs('#dashboard-sector-chart');

    if (trendChart) trendChart.destroy();
    if (sectorChart) sectorChart.destroy();

    if (!window.Chart) {
      if (trendCanvas) trendCanvas.parentElement.innerHTML = '<p class="empty-state">Chart unavailable.</p>';
      if (sectorCanvas) sectorCanvas.parentElement.innerHTML = '<p class="empty-state">Chart unavailable.</p>';
      return;
    }

    if (trendCanvas) {
      trendChart = new Chart(trendCanvas, {
        type: 'line',
        data: {
          labels: (data.repaymentTrend || []).map((item) => formatDate(item.month)),
          datasets: [
            {
              label: 'Completion %',
              data: (data.repaymentTrend || []).map((item) => item.rate),
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22,163,74,0.12)',
              tension: 0.3,
              fill: true,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: (value) => `${value}%`,
              },
            },
          },
        },
      });
    }

    if (sectorCanvas) {
      const sectors = ['PWD', 'Senior Citizen', 'Indigenous People', 'Solo Parent'];
      const counts = sectors.map((sector) => (data.beneficiaries || []).filter((b) => b.sector === sector && b.status === 'Active').length);

      sectorChart = new Chart(sectorCanvas, {
        type: 'doughnut',
        data: {
          labels: sectors,
          datasets: [
            {
              data: counts,
              backgroundColor: ['#2563eb', '#f97316', '#22c55e', '#facc15'],
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
          },
        },
      });
    }
  };

  const renderDashboard = () => {
    const section = qs('#dashboard-section');
    if (!section) return;

    const metrics = computeMetrics();
    const queueData = buildQueueData();

    setHTML(section, `
      <div class="section-header">
        <div>
          <h4>Dashboard Overview</h4>
          <p>Operational snapshot for today.</p>
        </div>
        <div class="header-actions">
          <button class="app-btn-ghost" data-action="new-beneficiary">New Beneficiary</button>
          <button class="app-btn-primary" data-action="view-reports">View Full Reports</button>
        </div>
        <span class="dashboard-updated">Updated: just now</span>
      </div>
      ${buildExecutiveSummary(metrics)}
      ${buildAlerts(metrics)}
      ${buildKpis(metrics)}
      ${buildQueue(queueData, state.dashboard.activeQueueTab)}
      <div class="dashboard-bottom">
        ${buildActivity(state.data.activityLog || [])}
      </div>
    `);
  };

  const routeFromQueue = (action) => {
    if (!window.App.modules || !window.App.modules.nav) return;

    if (action === 'repayments-pending') {
      state.filters.repayments.status = 'Pending';
      window.App.modules.nav.setActiveSection('repayments');
      return;
    }

    if (action === 'repayments-overdue') {
      state.filters.repayments.status = 'Overdue';
      window.App.modules.nav.setActiveSection('repayments');
      return;
    }

    if (action === 'applications-missing') {
      state.filters.applications.status = 'Pending';
      window.App.modules.nav.setActiveSection('applications');
      return;
    }

    if (action === 'training-upcoming') {
      window.App.modules.nav.setActiveSection('training');
    }
  };

  const bindDashboardEvents = () => {
    if (bound) return;
    bound = true;

    const section = qs('#dashboard-section');
    if (!section) return;

    on(section, 'click', (e) => {
      const alertChip = e.target.closest('.alert-chip');
      if (alertChip) {
        state.dashboard.activeQueueTab = alertChip.dataset.queue || 'pending';
        renderDashboard();
        return;
      }

      const queueTab = e.target.closest('.queue-tab');
      if (queueTab) {
        state.dashboard.activeQueueTab = queueTab.dataset.queueTab;
        renderDashboard();
        return;
      }

      const queueAction = e.target.closest('[data-queue-action]');
      if (queueAction) {
        routeFromQueue(queueAction.dataset.queueAction);
        return;
      }

      const actionBtn = e.target.closest('[data-action]');
      if (actionBtn && actionBtn.dataset.action === 'view-reports') {
        window.App.modules.nav.setActiveSection('reports');
      }
    });
  };

  const init = () => {
    renderDashboard();
    bindDashboardEvents();
  };

  window.App.modules = window.App.modules || {};
  window.App.modules.dashboard = { init, render: renderDashboard };
})();

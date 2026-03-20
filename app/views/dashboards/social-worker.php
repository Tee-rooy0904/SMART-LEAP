<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMART LEAP &bull; Social Worker</title>
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/admin.css">
  <link rel="stylesheet" href="<?= $baseUrl ?>/assets/css/dashboards/social-worker.css">
</head>
<body>
  <div id="mainSystem" class="admin-shell social-worker-shell" data-sidebar-open="false">
    <aside id="adminSidebar" class="admin-sidebar" aria-label="Social worker navigation" aria-hidden="false">
      <div class="sidebar-brand">
        <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="SMART LEAP seal" class="brand-logo">
        <div class="brand-copy">
          <span class="brand-tag">City Government of Butuan</span>
          <h1 class="brand-title">Social Worker Console</h1>
        </div>
      </div>
      <nav class="sidebar-nav">
        <button type="button" class="nav-link active" data-section="dashboard"><i class="fas fa-gauge"></i><span>Dashboard</span></button>
      </nav>
      <div class="sidebar-footer">
        <span>Need assistance?</span>
        <strong>cswdd@butuan.gov.ph</strong>
      </div>
    </aside>

    <div class="sidebar-backdrop" data-sidebar-close></div>

    <div class="content-area">
      <header class="content-header">
        <button type="button" class="sidebar-toggle" aria-expanded="false" aria-controls="adminSidebar">
          <span class="sidebar-toggle-icon" aria-hidden="true"></span>
          <span class="sidebar-toggle-label">Menu</span>
        </button>
        <div class="content-headline">
          <h1>Welcome back, Social Worker</h1>
        </div>
        <div class="header-actions">
          <button type="button" class="btn-ghost" id="sw-refresh"><span>Refresh</span></button>

          <button type="button" class="btn-danger" id="sw-logout"><span>Logout</span></button>
        </div>
      </header>

      <main class="content-main">
        <section id="dashboard-section" class="content-card" data-role-section>
          <header class="section-header">
            <div class="section-header__copy">
              <h2>Beneficiary roster</h2>
              <p class="section-subtitle">Update beneficiary records and keep follow-up schedules current.</p>
            </div>
            <div class="data-tools__actions">
              <button type="button" class="sw-utility-btn" id="sw-roster-export"><span>Export CSV</span></button>
              <button type="button" class="sw-utility-btn" id="sw-roster-refresh"><span>Reload data</span></button>
            </div>
          </header>
          <div class="sw-stats">
            <article class="sw-stat">
              <span class="sw-stat__label">Total beneficiaries</span>
              <strong class="sw-stat__value" id="swStatTotal">0</strong>
              <span class="sw-stat__meta">Records in roster</span>
            </article>
            <article class="sw-stat">
              <span class="sw-stat__label">Under monitoring</span>
              <strong class="sw-stat__value" id="swStatMonitoring">0</strong>
              <span class="sw-stat__meta">Active follow-ups</span>
            </article>
            <article class="sw-stat">
              <span class="sw-stat__label">Visits due soon</span>
              <strong class="sw-stat__value" id="swStatDue">0</strong>
              <span class="sw-stat__meta">Within next 7 days</span>
            </article>
          </div>
          <div class="table-wrapper table-wrapper--compact">
            <table class="sw-table" id="swRosterTable">
              <thead>
                <tr>
                  <th scope="col">Beneficiary</th>
                  <th scope="col">Barangay</th>
                  <th scope="col">Contact</th>
                  <th scope="col" class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr class="empty">
                  <td colspan="4">No beneficiaries loaded yet.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

      </main>

      <footer class="content-footer">
        <span>SMART LEAP &bull; City Government of Butuan &amp; CSWDD</span>
      </footer>
    </div>
  </div>

  <div class="sw-modal" id="swEditModal" aria-hidden="true" role="dialog" aria-labelledby="swEditModalTitle">
    <div class="sw-modal__backdrop" data-close-modal></div>
    <div class="sw-modal__dialog" role="document">
      <header class="sw-modal__header">
        <h2 id="swEditModalTitle">Edit beneficiary record</h2>
        <button type="button" class="sw-modal__close" data-close-modal aria-label="Close">&times;</button>
      </header>
      <form id="swEditForm" class="sw-modal__body" novalidate>
        <div class="sw-modal__grid">
          <label>
            <span>Full name *</span>
            <input type="text" name="name" id="swEditName" required>
          </label>
          <label>
            <span>Email address</span>
            <input type="email" name="email" id="swEditEmail">
          </label>
          <label>
            <span>Contact number</span>
            <input type="tel" name="contact" id="swEditContact" placeholder="09XXXXXXXXX">
          </label>
          <label>
            <span>Barangay</span>
            <input type="text" name="barangay" id="swEditBarangay" placeholder="Barangay, City">
          </label>
          <label>
            <span>Full address</span>
            <input type="text" name="address" id="swEditAddress" placeholder="Street / Purok, Barangay, City">
          </label>
          <label>
            <span>Livelihood / Business</span>
            <input type="text" name="businessType" id="swEditBusiness">
          </label>
          
        </div>
        <p class="sw-modal__feedback" id="swEditFeedback" role="alert" hidden></p>
        <footer class="sw-modal__footer">
          <button type="button" class="btn-ghost" data-close-modal>Cancel</button>
          <button type="submit" class="btn-primary">Save changes</button>
        </footer>
      </form>
    </div>
  </div>

  <script src="<?= $baseUrl ?>/assets/js/dashboards/social-worker.js" defer></script>
</body>
</html>









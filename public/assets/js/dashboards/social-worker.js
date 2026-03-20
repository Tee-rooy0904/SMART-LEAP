// SMART LEAP � Social Worker tools

const APPLICATION_STORAGE_KEY = 'smartleap_admin_applications_v3';
const BENEFICIARY_STORAGE_KEY = 'smartleap_admin_beneficiaries_v3';

let swApplications = [];
let swBeneficiaries = [];
let editingBeneficiaryId = null;

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  initNavigation();
  initHeaderActions();
  initRosterActions();
  initEditModal();
  renderRoster();
  showSection('dashboard');
});

function loadState() {
  try { swApplications = JSON.parse(localStorage.getItem(APPLICATION_STORAGE_KEY) || '[]'); } catch { swApplications = []; }
  try { swBeneficiaries = JSON.parse(localStorage.getItem(BENEFICIARY_STORAGE_KEY) || '[]'); } catch { swBeneficiaries = []; }
  if (!Array.isArray(swApplications)) swApplications = [];
  if (!Array.isArray(swBeneficiaries)) swBeneficiaries = [];
}

function persistBeneficiaries() {
  try { localStorage.setItem(BENEFICIARY_STORAGE_KEY, JSON.stringify(swBeneficiaries)); } catch {}
}

function persistApplications() {
  try { localStorage.setItem(APPLICATION_STORAGE_KEY, JSON.stringify(swApplications)); } catch {}
}

function initNavigation() {
  document.querySelectorAll('.admin-sidebar .nav-link[data-section]').forEach((link) => {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      showSection(link.dataset.section || 'dashboard');
    });
  });
}

function initHeaderActions() {
  document.getElementById('sw-refresh')?.addEventListener('click', () => {
    loadState();
    renderRoster();
    showAlert('Roster refreshed', 'info');
  });

  document.getElementById('sw-logout')?.addEventListener('click', () => {
    try { localStorage.removeItem('currentUser'); } catch {}
    window.location.href = 'login';
  });

  showAlert('Case note logging is coming soon.', 'warning');
}

function initRosterActions() {
  document.getElementById('sw-roster-export')?.addEventListener('click', exportBeneficiaryRoster);
  document.getElementById('sw-roster-refresh')?.addEventListener('click', () => {
    loadState();
    renderRoster();
    showAlert('Roster reloaded', 'info');
  });

  document.getElementById('swRosterTable')?.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action="edit"]');
    if (!button) return;
    const id = Number(button.dataset.id);
    if (!Number.isNaN(id)) openBeneficiaryEditor(id);
  });
}

function renderRoster() {
  const table = document.getElementById('swRosterTable');
  const tbody = table?.querySelector('tbody');
  if (!table || !tbody) return;

  if (!swBeneficiaries.length) {
    tbody.innerHTML = '<tr class="empty"><td colspan="4">No beneficiaries loaded yet.</td></tr>';
    return;
  }

  const rows = swBeneficiaries.map((b) => {
    const name = escapeHtml(b.name || b.fullName || 'Beneficiary');
    const barangay = escapeHtml(b.barangay || '-');
    const contact = escapeHtml(b.contact || b.contactNumber || b.email || '');
    return `<tr>
      <td>${name}</td>
      <td>${barangay}</td>
      <td>${contact}</td>
      <td class="text-end"><button type="button" class="sw-table__action" data-action="edit" data-id="${Number(b.id) || ''}">Edit</button></td>
    </tr>`;
  }).join('');

  tbody.innerHTML = rows;
  updateSummaryMetrics();
}

function openBeneficiaryEditor(id) {
  const record = swBeneficiaries.find((b) => Number(b.id) === Number(id));
  if (!record) {
    showAlert('Beneficiary not found.', 'warning');
    return;
  }
  editingBeneficiaryId = Number(record.id);
  populateEditForm(record);
  toggleEditModal(true);
}

function exportBeneficiaryRoster() {
  if (!swBeneficiaries.length) {
    showAlert('No beneficiary data to export.', 'warning');
    return;
  }

  const rows = [
    ['Name', 'Barangay', 'Contact', 'Email'],
    ...swBeneficiaries.map((b) => [
      b.name || b.fullName || '',
      b.barangay || '',
      b.contact || b.contactNumber || '',
      b.email || '',
    ])
  ];

  const csv = rows.map((row) => row.map((cell) => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `smartleap-beneficiaries-${Date.now()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showAlert('Beneficiary roster exported.', 'success');
}

function showSection(section) {
  const targetId = `${section}-section`;
  document.querySelectorAll('[data-role-section]').forEach((el) => {
    el.style.display = el.id === targetId ? '' : 'none';
  });

  document.querySelectorAll('.admin-sidebar .nav-link[data-section]').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === section);
  });

}

function updateSummaryMetrics() {
  const total = swBeneficiaries.length;
  const monitoring = total;
  const dueSoon = countUpcomingVisits(swBeneficiaries, 7);

  setText('swStatTotal', total);
  setText('swStatMonitoring', monitoring);
  setText('swStatDue', dueSoon);
}

function countUpcomingVisits(list, days = 7) {
  if (!Array.isArray(list) || days <= 0) return 0;
  const today = startOfDay(new Date());
  const horizon = startOfDay(new Date());
  horizon.setDate(today.getDate() + days);

  return list.filter((record) => {
    const visit = parseDate(record.nextVisit || record.followUp || record.followUpDate || record.followupDate);
    if (!visit) return false;
    const day = startOfDay(visit);
    return day >= today && day <= horizon;
  }).length;
}

function parseDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDisplayDate(value) {
  if (!value) return '-';
  const parsed = parseDate(value);
  if (!parsed) return '-';
  return parsed.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = typeof value === 'number' ? value : String(value || 0);
}

function showAlert(message, tone = 'info') {
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `<div class="alert alert-${tone} alert-dismissible fade show position-fixed" style="top:20px; right:20px; z-index:9999; min-width:300px;">${message}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
  const node = wrapper.firstElementChild;
  document.body.appendChild(node);
  setTimeout(() => { try { node.remove(); } catch {} }, 4000);
}

function initEditModal() {
  const modal = document.getElementById('swEditModal');
  const form = document.getElementById('swEditForm');
  if (!modal || !form) return;

  modal.querySelectorAll('[data-close-modal]').forEach((control) => {
    control.addEventListener('click', () => toggleEditModal(false));
  });

  modal.addEventListener('click', (event) => {
    if (event.target === modal) toggleEditModal(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') {
      toggleEditModal(false);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    applyEditForm();
  });
}

function toggleEditModal(show) {
  const modal = document.getElementById('swEditModal');
  const feedback = document.getElementById('swEditFeedback');
  if (!modal) return;
  modal.setAttribute('aria-hidden', show ? 'false' : 'true');
  if (feedback) {
    if (show) {
      feedback.setAttribute('hidden', 'hidden');
    } else {
      feedback.setAttribute('hidden', 'hidden');
    }
  }
  if (!show) {
    editingBeneficiaryId = null;
  }
}

function populateEditForm(record) {
  const form = document.getElementById('swEditForm');
  if (!form) return;
  form.reset();
  setValue('swEditName', record.name || record.fullName || '');
  setValue('swEditEmail', record.email || '');
  setValue('swEditContact', record.contact || record.contactNumber || '');
  setValue('swEditBarangay', record.barangay || '');
  setValue('swEditAddress', record.location || record.address || '');
  setValue('swEditBusiness', record.businessType || '');
}

function setValue(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value || '';
}

function setTextarea(id, value) {
  const input = document.getElementById(id);
  if (input) input.value = value || '';
}

function applyEditForm() {
  if (editingBeneficiaryId == null) return;
  const record = swBeneficiaries.find(b => Number(b.id) === Number(editingBeneficiaryId));
  if (!record) {
    showEditFeedback('Beneficiary record not found in roster.', 'danger');
    return;
  }
  const updates = {
    name: document.getElementById('swEditName')?.value.trim(),
    email: document.getElementById('swEditEmail')?.value.trim(),
    contact: document.getElementById('swEditContact')?.value.trim(),
    barangay: document.getElementById('swEditBarangay')?.value.trim(),
    address: document.getElementById('swEditAddress')?.value.trim(),
    businessType: document.getElementById('swEditBusiness')?.value.trim(),
  };

  record.name = updates.name;
  record.fullName = updates.name;
  record.email = updates.email;
  record.contact = updates.contact;
  record.contactNumber = updates.contact;
  record.barangay = updates.barangay;
  record.location = updates.address;
  record.address = updates.address;
  record.businessType = updates.businessType;
  record.updatedAt = new Date().toISOString();

  persistBeneficiaries();

  updateLinkedApplication(record);
  renderRoster();
  showAlert('Beneficiary details updated.', 'success');
  toggleEditModal(false);
}

function showEditFeedback(message, tone = 'danger') {
  const feedback = document.getElementById('swEditFeedback');
  if (!feedback) return;
  feedback.textContent = message;
  feedback.dataset.tone = tone;
  feedback.removeAttribute('hidden');
}

function updateLinkedApplication(record) {
  const match = swApplications.find(app =>
    Number(app.beneficiaryId) === Number(record.id) ||
    (app.email && record.email && app.email.toLowerCase() === record.email.toLowerCase()) ||
    (app.applicantName && app.applicantName.toLowerCase() === (record.name || '').toLowerCase())
  );
  if (!match) {
    persistApplications();
    return;
  }
  match.applicantName = record.name || record.fullName || match.applicantName;
  if (record.email) match.email = record.email;
  if (record.contact) {
    match.contact = record.contact;
    match.contactNumber = record.contact;
  }
  if (record.barangay) match.barangay = record.barangay;
  if (record.businessType) match.businessType = record.businessType;
  match.updatedAt = new Date().toISOString();
  persistApplications();
}




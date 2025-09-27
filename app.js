const STORAGE_KEY = 'buildright-timesheets';
const state = loadState();

const navButtons = document.querySelectorAll('[data-route]');
const routes = document.querySelectorAll('[data-section]');
const entryForm = document.querySelector('#entryForm');
const filterForm = document.querySelector('#filterForm');
const employeeForm = document.querySelector('#employeeForm');
const projectForm = document.querySelector('#projectForm');
const entrySubmitButton = entryForm.querySelector('button[type="submit"]');
const entryList = document.querySelector('#entryList');
const entryEmptyState = document.querySelector('#entryEmptyState');
const employeeList = document.querySelector('#employeeList');
const projectList = document.querySelector('#projectList');
const totalHoursEl = document.querySelector('#totalHours');
const projectCountEl = document.querySelector('#projectCount');
const employeeCountEl = document.querySelector('#employeeCount');
const reportEntryCountEl = document.querySelector('#reportEntryCount');
const reportHourTotalEl = document.querySelector('#reportHourTotal');
const reportBillableEl = document.querySelector('#reportBillable');
const exportPayrollBtn = document.querySelector('#exportPayroll');
const exportClientBtn = document.querySelector('#exportClient');
const installButton = document.querySelector('#installButton');

init();

function init() {
  installButton.disabled = true;
  entryForm.date.value = today();
  syncSelectOptions();
  renderEmployees();
  renderProjects();
  renderEntries();
  updateSummary();
  registerEvents();
  registerServiceWorker();
  setupInstallPrompt();
}

function registerEvents() {
  navButtons.forEach(button => {
    button.addEventListener('click', () => {
      const target = button.dataset.route;
      navButtons.forEach(btn => btn.classList.toggle('active', btn === button));
      routes.forEach(section => {
        section.classList.toggle('active', section.dataset.section === target);
      });
    });
  });

  entryForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(entryForm);
    const entry = {
      id: randomId(),
      date: formData.get('date'),
      employeeId: formData.get('employeeId'),
      projectId: formData.get('projectId'),
      hours: Math.max(0, parseFloat(formData.get('hours')) || 0),
      task: formData.get('task').trim(),
      notes: formData.get('notes').trim(),
      billable: entryForm.billable.checked
    };

    if (!entry.date || !entry.employeeId || !entry.projectId || entry.hours <= 0) {
      return;
    }

    state.entries.push(entry);
    saveState();
    entryForm.reset();
    entryForm.date.value = today();
    entryForm.billable.checked = entry.billable;
    syncSelectOptions();
    entryForm.employeeId.value = entry.employeeId;
    entryForm.projectId.value = entry.projectId;
    renderEntries();
    updateSummary();
  });

  filterForm.addEventListener('input', () => {
    renderEntries();
  });

  filterForm.addEventListener('reset', () => {
    window.requestAnimationFrame(() => {
      renderEntries();
    });
  });

  employeeForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(employeeForm);
    const employee = {
      id: randomId(),
      name: formData.get('name').trim(),
      role: formData.get('role').trim()
    };

    if (!employee.name) return;

    state.employees.push(employee);
    saveState();
    employeeForm.reset();
    renderEmployees();
    syncSelectOptions();
    updateSummary();
  });

  projectForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(projectForm);
    const project = {
      id: randomId(),
      name: formData.get('name').trim(),
      client: formData.get('client').trim(),
      location: formData.get('location').trim()
    };

    if (!project.name) return;

    state.projects.push(project);
    saveState();
    projectForm.reset();
    renderProjects();
    syncSelectOptions();
    updateSummary();
  });

  exportPayrollBtn.addEventListener('click', () => {
    const entries = getFilteredEntries();
    if (!entries.length) {
      alert('No entries match your filters.');
      return;
    }
    const lines = buildPayrollInvoice(entries);
    downloadPdf(lines, `buildright-payroll-${today()}.pdf`);
  });

  exportClientBtn.addEventListener('click', () => {
    const entries = getFilteredEntries();
    if (!entries.length) {
      alert('No entries match your filters.');
      return;
    }
    const lines = buildClientInvoice(entries);
    downloadPdf(lines, `buildright-clients-${today()}.pdf`);
  });
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { employees: [], projects: [], entries: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      employees: parsed.employees || [],
      projects: parsed.projects || [],
      entries: parsed.entries || []
    };
  } catch (error) {
    console.error('Failed to load saved state', error);
    return { employees: [], projects: [], entries: [] };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function syncSelectOptions() {
  const employeeOptions = buildOptions(state.employees, 'Select crew');
  setSelectOptions(entryForm.employeeId, employeeOptions);
  setSelectOptions(filterForm.employeeId, [['', 'All crew'], ...employeeOptions.slice(1)]);

  const projectOptions = buildOptions(state.projects, 'Select project');
  setSelectOptions(entryForm.projectId, projectOptions);
  setSelectOptions(filterForm.projectId, [['', 'All projects'], ...projectOptions.slice(1)]);

  const canLog = state.employees.length > 0 && state.projects.length > 0;
  entryForm.employeeId.disabled = state.employees.length === 0;
  entryForm.projectId.disabled = state.projects.length === 0;
  entrySubmitButton.disabled = !canLog;
}

function buildOptions(items, placeholder) {
  const rows = [["", placeholder]];
  for (const item of items) {
    rows.push([item.id, item.name]);
  }
  return rows;
}

function setSelectOptions(select, options) {
  const current = select.value;
  select.innerHTML = '';
  for (const [value, label] of options) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  if (options.some(([value]) => value === current)) {
    select.value = current;
  }
}

function renderEmployees() {
  employeeList.innerHTML = '';
  if (!state.employees.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-row';
    const text = document.createElement('span');
    text.className = 'hint';
    text.textContent = 'No crew yet. Add your first teammate above.';
    empty.append(text);
    employeeList.append(empty);
    return;
  }

  for (const employee of state.employees) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('strong');
    name.textContent = employee.name;
    const role = document.createElement('span');
    role.textContent = employee.role || 'Role not set';
    info.append(name, role);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeEmployee(employee.id));

    li.append(info, remove);
    employeeList.append(li);
  }
}

function renderProjects() {
  projectList.innerHTML = '';
  if (!state.projects.length) {
    const empty = document.createElement('li');
    empty.className = 'empty-row';
    const text = document.createElement('span');
    text.className = 'hint';
    text.textContent = 'No projects yet. Log your jobs above to schedule hours.';
    empty.append(text);
    projectList.append(empty);
    return;
  }

  for (const project of state.projects) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    info.className = 'info';
    const name = document.createElement('strong');
    name.textContent = project.name;
    const details = document.createElement('span');
    const parts = [project.client, project.location].filter(Boolean);
    details.textContent = parts.length ? parts.join(' · ') : 'Client & site not set';
    info.append(name, details);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => removeProject(project.id));

    li.append(info, remove);
    projectList.append(li);
  }
}

function renderEntries() {
  const entries = getFilteredEntries();
  entryList.innerHTML = '';

  if (!entries.length) {
    entryEmptyState.classList.add('active');
  } else {
    entryEmptyState.classList.remove('active');
  }

  const groups = groupBy(entries, entry => entry.date);
  const fragment = document.createDocumentFragment();

  const sortedDates = Array.from(groups.keys()).sort((a, b) => (a > b ? -1 : 1));
  for (const date of sortedDates) {
    const section = document.createElement('section');
    section.className = 'entry-group';
    const heading = document.createElement('h4');
    heading.textContent = formatDisplayDate(date);
    section.append(heading);

    for (const entry of groups.get(date)) {
      section.append(buildEntryCard(entry));
    }

    fragment.append(section);
  }

  entryList.append(fragment);
  renderReportSummary(entries);
}

function buildEntryCard(entry) {
  const card = document.createElement('article');
  card.className = 'entry-card';

  const header = document.createElement('header');
  const title = document.createElement('strong');
  const employee = getEmployee(entry.employeeId);
  title.textContent = employee ? employee.name : 'Unknown crew';
  const hours = document.createElement('span');
  hours.className = 'badge';
  hours.textContent = `${entry.hours.toFixed(2)} hrs`;
  header.append(title, hours);

  const meta = document.createElement('div');
  meta.className = 'meta';
  const project = getProject(entry.projectId);
  if (project) {
    meta.append(tag(project.name));
  }
  if (entry.task) {
    meta.append(tag(entry.task));
  }
  if (!entry.billable) {
    const nonBillable = document.createElement('span');
    nonBillable.className = 'badge non-billable';
    nonBillable.textContent = 'Non-billable';
    meta.append(nonBillable);
  }

  const notes = document.createElement('p');
  notes.textContent = entry.notes || 'No notes added.';
  notes.className = 'hint';

  const footer = document.createElement('footer');
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Delete entry';
  remove.addEventListener('click', () => removeEntry(entry.id));
  footer.append(remove);

  card.append(header, meta, notes, footer);
  return card;
}

function tag(label) {
  const span = document.createElement('span');
  span.className = 'badge';
  span.textContent = label;
  return span;
}

function renderReportSummary(entries) {
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const billableHours = entries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);
  reportEntryCountEl.textContent = entries.length.toString();
  reportHourTotalEl.textContent = totalHours.toFixed(2);
  reportBillableEl.textContent = billableHours.toFixed(2);
}

function updateSummary() {
  const totalHours = state.entries.reduce((sum, entry) => sum + entry.hours, 0);
  totalHoursEl.textContent = totalHours.toFixed(2);
  projectCountEl.textContent = state.projects.length.toString();
  employeeCountEl.textContent = state.employees.length.toString();
}

function getFilteredEntries() {
  const formData = new FormData(filterForm);
  const employeeId = formData.get('employeeId');
  const projectId = formData.get('projectId');
  const billable = formData.get('billable');
  const from = formData.get('from');
  const to = formData.get('to');

  return state.entries.filter(entry => {
    if (employeeId && entry.employeeId !== employeeId) return false;
    if (projectId && entry.projectId !== projectId) return false;
    if (billable === 'true' && !entry.billable) return false;
    if (billable === 'false' && entry.billable) return false;
    if (from && entry.date < from) return false;
    if (to && entry.date > to) return false;
    return true;
  });
}

function removeEmployee(id) {
  if (!confirm('Remove crew member and their entries?')) return;
  state.employees = state.employees.filter(employee => employee.id !== id);
  state.entries = state.entries.filter(entry => entry.employeeId !== id);
  saveState();
  renderEmployees();
  renderEntries();
  syncSelectOptions();
  updateSummary();
}

function removeProject(id) {
  if (!confirm('Remove project and related entries?')) return;
  state.projects = state.projects.filter(project => project.id !== id);
  state.entries = state.entries.filter(entry => entry.projectId !== id);
  saveState();
  renderProjects();
  renderEntries();
  syncSelectOptions();
  updateSummary();
}

function removeEntry(id) {
  state.entries = state.entries.filter(entry => entry.id !== id);
  saveState();
  renderEntries();
  updateSummary();
}

function buildPayrollInvoice(entries) {
  const lines = [];
  const generatedOn = formatInvoiceDate(new Date());
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
  const billableHours = entries.filter(entry => entry.billable).reduce((sum, entry) => sum + entry.hours, 0);

  lines.push('BuildRight Construction');
  lines.push('Payroll Invoice');
  lines.push(`Generated: ${generatedOn}`);
  lines.push('');
  lines.push(`Total Entries: ${entries.length}`);
  lines.push(`Total Hours: ${totalHours.toFixed(2)}`);
  lines.push(`Billable Hours: ${billableHours.toFixed(2)}`);
  lines.push('');
  lines.push('Crew Summary');

  const entriesByEmployee = groupBy(entries, entry => entry.employeeId || 'unassigned');
  for (const [employeeId, employeeEntries] of entriesByEmployee.entries()) {
    const employee = getEmployee(employeeId);
    const hours = employeeEntries.reduce((sum, entry) => sum + entry.hours, 0);
    lines.push(`• ${(employee ? employee.name : 'Unknown Crew')} — ${hours.toFixed(2)} hrs`);
  }

  lines.push('');
  lines.push('Detailed Entries');
  lines.push('Date | Employee | Project | Hours | Billable | Task');
  lines.push('----------------------------------------------------------------');

  for (const entry of entries) {
    const project = getProject(entry.projectId);
    const employee = getEmployee(entry.employeeId);
    const row = [
      entry.date,
      truncateText(employee ? employee.name : 'Unknown', 18),
      truncateText(project ? project.name : 'Unassigned', 18),
      entry.hours.toFixed(2),
      entry.billable ? 'Yes' : 'No',
      truncateText(entry.task || '', 30)
    ].join(' | ');
    lines.push(row);
  }

  return lines;
}

function buildClientInvoice(entries) {
  const lines = [];
  const generatedOn = formatInvoiceDate(new Date());
  const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);

  lines.push('BuildRight Construction');
  lines.push('Client Billing Invoice');
  lines.push(`Generated: ${generatedOn}`);
  lines.push('');
  lines.push(`Total Entries: ${entries.length}`);
  lines.push(`Total Hours: ${totalHours.toFixed(2)}`);
  lines.push('');
  lines.push('Project Summary');

  const entriesByProject = groupBy(entries, entry => entry.projectId || 'unassigned');
  for (const [projectId, projectEntries] of entriesByProject.entries()) {
    const project = getProject(projectId);
    const hours = projectEntries.reduce((sum, entry) => sum + entry.hours, 0);
    const clientName = project?.client ? ` for ${project.client}` : '';
    lines.push(`• ${(project ? project.name : 'Unassigned Project')}${clientName} — ${hours.toFixed(2)} hrs`);
  }

  lines.push('');
  lines.push('Detailed Entries');
  lines.push('Date | Project | Crew | Hours | Task | Notes');
  lines.push('----------------------------------------------------------------');

  for (const entry of entries) {
    const project = getProject(entry.projectId);
    const employee = getEmployee(entry.employeeId);
    const row = [
      entry.date,
      truncateText(project ? project.name : 'Unassigned', 18),
      truncateText(employee ? employee.name : 'Unknown', 18),
      entry.hours.toFixed(2),
      truncateText(entry.task || '', 20),
      truncateText(entry.notes || '', 30)
    ].join(' | ');
    lines.push(row);
  }

  return lines;
}

function downloadPdf(lines, filename) {
  const pdfString = createPdfDocument(lines);
  const blob = new Blob([pdfString], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.click();
  URL.revokeObjectURL(url);
}

function createPdfDocument(lines) {
  const sanitizedLines = lines.length ? lines : [''];
  const contentStream = buildPdfStream(sanitizedLines);
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    createContentObject(contentStream),
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n'
  ];

  const header = '%PDF-1.4\n';
  const encoder = new TextEncoder();
  const parts = [header];
  const offsets = [];
  let currentOffset = encoder.encode(header).length;

  for (const object of objects) {
    offsets.push(currentOffset);
    parts.push(object);
    currentOffset += encoder.encode(object).length;
  }

  const xrefOffset = currentOffset;
  const xrefEntries = ['0000000000 65535 f \n'];
  for (const offset of offsets) {
    xrefEntries.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
  }
  const xref = `xref\n0 ${objects.length + 1}\n${xrefEntries.join('')}`;
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  parts.push(xref);
  parts.push(trailer);

  return parts.join('');
}

function createContentObject(stream) {
  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(stream);
  return `4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`;
}

function buildPdfStream(lines) {
  const textLines = lines.map((line, index) => {
    const prefix = index === 0 ? '' : 'T*\n';
    return `${prefix}(${escapePdfText(line)}) Tj`;
  }).join('\n');
  return `BT\n/F1 12 Tf\n14 TL\n1 0 0 1 72 750 Tm\n${textLines}\nET`;
}

function escapePdfText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function truncateText(value, length) {
  const text = value || '';
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function formatInvoiceDate(date) {
  const formatter = new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  return formatter.format(date);
}

function randomId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getEmployee(id) {
  return state.employees.find(employee => employee.id === id);
}

function getProject(id) {
  return state.projects.find(project => project.id === id);
}

function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key).push(item);
  }
  return map;
}

function formatDisplayDate(value) {
  const date = new Date(value + 'T00:00');
  const formatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  return formatter.format(date);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(error => {
      console.error('Service worker registration failed', error);
    });
  }
}

function setupInstallPrompt() {
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    installButton.disabled = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome !== 'accepted') {
      console.info('Install dismissed');
    }
    deferredPrompt = null;
    installButton.disabled = true;
  });
}

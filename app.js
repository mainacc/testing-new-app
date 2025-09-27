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
    const rows = buildPayrollCsv(entries);
    downloadCsv(rows, `buildright-payroll-${today()}.csv`);
  });

  exportClientBtn.addEventListener('click', () => {
    const entries = getFilteredEntries();
    if (!entries.length) {
      alert('No entries match your filters.');
      return;
    }
    const rows = buildClientCsv(entries);
    downloadCsv(rows, `buildright-clients-${today()}.csv`);
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

function buildPayrollCsv(entries) {
  const rows = [['Employee', 'Date', 'Project', 'Hours', 'Billable', 'Task', 'Notes']];
  for (const entry of entries) {
    const employee = getEmployee(entry.employeeId);
    const project = getProject(entry.projectId);
    rows.push([
      employee ? employee.name : 'Unknown',
      entry.date,
      project ? project.name : 'Unassigned',
      entry.hours.toFixed(2),
      entry.billable ? 'Yes' : 'No',
      entry.task || '',
      entry.notes || ''
    ]);
  }
  return rows;
}

function buildClientCsv(entries) {
  const rows = [['Client', 'Project', 'Date', 'Crew', 'Hours', 'Task', 'Notes']];
  for (const entry of entries) {
    const project = getProject(entry.projectId);
    const employee = getEmployee(entry.employeeId);
    rows.push([
      project?.client || '',
      project ? project.name : 'Unassigned',
      entry.date,
      employee ? employee.name : 'Unknown',
      entry.hours.toFixed(2),
      entry.task || '',
      entry.notes || ''
    ]);
  }
  return rows;
}

function downloadCsv(rows, filename) {
  const csvContent = rows.map(columns => columns.map(escapeCsv).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  link.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  if (value == null) return '';
  const stringValue = String(value);
  if (/[",\n]/.test(stringValue)) {
    return '"' + stringValue.replace(/"/g, '""') + '"';
  }
  return stringValue;
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

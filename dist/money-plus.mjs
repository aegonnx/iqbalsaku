import {SOURCES, today, validMonth, shiftMonth, incomeMetrics, validateIncome, validateEntry, mergeIncome, incomeCSV} from './money-plus-model.mjs';
import {IncomeRepository} from './money-plus-storage.mjs';
import {amountFromInput, amountText} from './amount-input.mjs';
import {installKeyboardLayout, installFooterActions} from './mobile-layout.mjs';
import {openDialog, closeDialog, dialogActive} from './motion.mjs';
import {rememberFocus, restoreFocus} from './focus.mjs';

const repo = new IncomeRepository();
const app = document.getElementById('money-app');
const dialog = document.getElementById('income-dialog');
const confirmation = document.getElementById('income-confirm');
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('saku-money-plus-data') : null;
const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const format = value => 'Rp'+new Intl.NumberFormat('id-ID',{maximumFractionDigits:0}).format(value);
const monthLabel = value => new Date(value+'-01T12:00:00').toLocaleDateString('en-GB',{month:'short',year:'numeric'});
const dateLabel = value => new Date(value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
const sourceFor = value => SOURCES.find(source => source.id === value);
const glyph = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${name === 'chart' ? '<path d="M5 20V10m7 10V4m7 16v-7M3 20h18"/>' : name === 'theme' ? '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16Z" fill="currentColor" stroke="none"/>' : '<path d="M6 18 18 6M6 6h12v12"/>'}</svg>`;
const sourceGlyph = source => ['salary','freelance','refund'].includes(source.id) ? glyph('income') : source.symbol;
let state, month = today().slice(0,7), page = location.hash === '#overview' ? 'overview' : 'income';
let search = '', sourceFilter = '', limit = 60, busy = false, timer;

function notify(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('visible'),4000);
}
function message(error) {
  return error?.name === 'QuotaExceededError' ? 'Device storage is full. Export a backup and free space, then try again.' : error?.message || 'Could not save. Please try again.';
}
async function commit(change) {
  if (busy) throw new Error('A save is in progress. Please wait.');
  busy = true;
  document.querySelectorAll('dialog button').forEach(button => { button.disabled = true; });
  try {
    state = await repo.update(change);
    channel?.postMessage('changed');
  } finally {
    busy = false;
    document.querySelectorAll('dialog button').forEach(button => { button.disabled = false; });
  }
}
function hero(metrics) {
  return `<section class="income-hero" aria-label="Monthly income">
    <p class="eyebrow">Money received this month</p>
    <div class="hero-number" data-testid="income-total"><span class="currency-prefix">Rp</span><span>${new Intl.NumberFormat('id-ID').format(metrics.total)}</span></div>
    <div class="income-subtotals"><div><span>Salary</span><strong>${format(metrics.salary)}</strong></div><div><span>Extra income</span><strong data-testid="income-extra">${format(metrics.extra)}</strong></div></div>
    <p class="income-comparison">${metrics.previousTotal === null ? 'Your monthly income journal.' : metrics.previousTotal === 0 ? 'No income recorded for '+monthLabel(shiftMonth(month,-1))+'.' : `<strong>${format(Math.abs(metrics.total-metrics.previousTotal))}</strong> ${metrics.total === metrics.previousTotal ? 'difference from' : metrics.total > metrics.previousTotal ? 'more than' : 'less than'} ${monthLabel(shiftMonth(month,-1))}.`}</p>
  </section>`;
}
function list(metrics) {
  const query = search.trim().toLocaleLowerCase();
  const rows = metrics.entries.filter(entry => (!sourceFilter || entry.source === sourceFilter) && (!query || [entry.title,entry.note,sourceFor(entry.source).name].join(' ').toLocaleLowerCase().includes(query)));
  const shown = rows.slice(0,limit), groups = new Map();
  for (const entry of shown) {
    if (!groups.has(entry.date)) groups.set(entry.date,[]);
    groups.get(entry.date).push(entry);
  }
  const totals = new Map();
  for (const entry of rows) totals.set(entry.date,(totals.get(entry.date) || 0)+entry.amount);
  return `<section aria-labelledby="income-history-title"><div class="section-head"><h2 id="income-history-title">Money coming in</h2><span class="muted">${metrics.entries.length} ${metrics.entries.length === 1 ? 'entry' : 'entries'}</span></div>
    <div class="income-toolbar"><label>Search<input id="income-search" type="search" placeholder="Title or note" value="${escape(search)}"></label><label>Source<select id="income-source-filter"><option value="">All sources</option>${SOURCES.map(source => `<option value="${source.id}" ${sourceFilter === source.id ? 'selected' : ''}>${source.name}</option>`).join('')}</select></label></div>
    <div class="income-list" id="income-results" style="margin-top:20px">${rows.length ? [...groups].map(([date,entries]) => `<section class="income-group"><div class="income-date"><h3>${dateLabel(date)}</h3><span>${search || sourceFilter ? 'Filtered total' : 'Daily total'}: ${format(totals.get(date))}</span></div>${entries.map(entry => `<button class="income-row" data-action="edit" data-id="${escape(entry.id)}" aria-label="Edit ${escape(entry.title)}, ${escape(format(entry.amount))}"><span class="income-symbol" aria-hidden="true">${sourceGlyph(sourceFor(entry.source))}</span><span class="income-row-info"><strong>${escape(entry.title)}</strong><small>${sourceFor(entry.source).name}${entry.note ? ' · '+escape(entry.note) : ''}</small></span><span class="income-row-amount">+${format(entry.amount)}</span></button>`).join('')}</section>`).join('') : `<div class="empty income-empty"><h3>${search || sourceFilter ? 'No matching income' : 'A fresh start for '+monthLabel(month)}</h3><p>${search || sourceFilter ? 'Try another search or source.' : 'Got paid? Received a work bonus? Add it here, whenever it arrives.'}</p>${search || sourceFilter ? '' : '<button class="primary" data-action="add">Add your first income</button>'}</div>`}</div>
    ${rows.length ? `<p class="muted" style="font-size:.75rem;margin-top:16px" role="status">${Math.min(limit,rows.length)} of ${rows.length} entries</p>` : ''}
    ${rows.length > limit ? '<button class="secondary full-width" style="margin-top:12px" data-action="more">Show more income</button>' : ''}
  </section>`;
}
function overview(metrics) {
  return `<section class="income-breakdown" aria-labelledby="source-heading"><div class="section-head"><h2 id="source-heading">Where it came from</h2></div>${metrics.total ? metrics.sources.filter(source => source.total > 0).sort((a,b) => b.total-a.total).map(source => `<div class="income-source"><div class="row"><span>${source.name}</span><strong>${format(source.total)}</strong></div><small>${(source.total/metrics.total*100).toFixed(1)}% of this month’s income</small><div class="progress" aria-hidden="true"><span style="width:${source.total/metrics.total*100}%"></span></div></div>`).join('') : '<p class="muted">Your income breakdown will appear after you add a record.</p>'}</section>
    <section class="income-total-card"><p class="eyebrow">All-time income recorded</p><p class="report-total" data-testid="income-lifetime">${format(metrics.lifetime)}</p><small>Across all months in Money Plus.</small></section>
    <section class="backup-panel" aria-labelledby="backup-heading"><h2 id="backup-heading">Keep a copy</h2><p>Money Plus saves on this device and works offline. Export a backup to move your income to another device.</p><div class="backup-buttons"><button class="secondary" data-action="export-json">Download JSON backup</button><button class="secondary" data-action="export-csv">Download income CSV</button><label class="secondary" for="income-import">Import Money Plus backup<input class="sr-only" id="income-import" type="file" accept=".json,application/json"></label></div><p class="data-boundary">Income stays separate from expense records, budgets, and expense account sync. Adding money here does not change your spending allowance.</p></section>`;
}
function render({focus = false} = {}) {
  const previousFocus = rememberFocus(app), metrics = incomeMetrics(state,month);
  const title = page === 'income' ? 'Money Plus' : 'Overview';
  app.innerHTML = `<div class="app-shell income-shell"><header class="topbar"><a class="brand" href="./" aria-label="Iqbal Saku home"><img src="./icon.svg" alt="">Iqbal Saku</a><button class="icon-button" data-theme-toggle aria-label="Dark theme" aria-pressed="${document.documentElement.dataset.theme === 'dark'}">${glyph('theme')}</button></header><a class="back-home" href="./">← All apps</a><main id="main-content" aria-labelledby="income-page-title" tabindex="-1"><div class="heading-row"><h1 id="income-page-title" tabindex="-1">${title}</h1><div class="month-control"><button data-action="month" data-direction="-1" aria-label="Previous month" ${month === '2000-01' ? 'disabled' : ''}>‹</button><label class="sr-only" for="income-month">Selected month</label><div class="month-picker"><span aria-hidden="true">${monthLabel(month)}</span><input id="income-month" type="month" min="2000-01" max="2100-12" value="${month}"></div><button data-action="month" data-direction="1" aria-label="Next month" ${month === '2100-12' ? 'disabled' : ''}>›</button></div></div>${hero(metrics)}${page === 'income' ? `<aside class="plus-tip"><span aria-hidden="true">+</span><div><strong>Good news belongs here.</strong><p>Add a bonus on payday, mid-month, or any day it arrives.</p></div></aside>${list(metrics)}` : overview(metrics)}</main><nav class="bottom-nav income-bottom" aria-label="Money Plus navigation"><button class="nav-item ${page === 'income' ? 'active' : ''}" data-action="page" data-page="income" ${page === 'income' ? 'aria-current="page"' : ''}>${glyph('income')}<span>Income</span></button><button class="nav-add" data-action="add" aria-label="Add income"><span aria-hidden="true">+</span><span>Add money</span></button><button class="nav-item ${page === 'overview' ? 'active' : ''}" data-action="page" data-page="overview" ${page === 'overview' ? 'aria-current="page"' : ''}>${glyph('chart')}<span>Overview</span></button></nav></div>`;
  if (focus) document.getElementById('income-page-title').focus({preventScroll:true});
  else if (previousFocus) restoreFocus(app,previousFocus);
}
function navigate(next) {
  if (!['income','overview'].includes(next) || next === page) return;
  page = next;
  location.hash = next;
  render({focus:true});
  window.scrollTo({top:0});
}
function assertUnchanged(current, snapshot) {
  const entry = current.entries.find(entry => entry.id === snapshot.id);
  if (!entry || JSON.stringify(entry) !== JSON.stringify(snapshot)) throw new Error('This income changed in another tab. Close this form and reopen the record.');
}
function edit(snapshot = null) {
  if (busy || dialogActive(dialog) || dialogActive(confirmation)) return;
  const isEdit = Boolean(snapshot);
  dialog.innerHTML = `<div class="dialog-inner"><div class="dialog-header"><h2 id="income-dialog-title">${isEdit ? 'Edit income' : 'Add money'}</h2><button class="icon-button" data-close aria-label="Close income form">×</button></div><form id="income-form" class="income-form" novalidate><label class="income-field" for="income-amount">Amount <input class="amount-input" id="income-amount" name="amount" type="text" inputmode="decimal" placeholder="500" autocomplete="off" value="${isEdit ? escape(amountText(snapshot.amount)) : ''}" aria-describedby="income-amount-help income-amount-preview income-error"></label><p class="amount-preview" id="income-amount-preview" aria-live="polite">${format(snapshot?.amount || 0)}</p><p class="amount-help" id="income-amount-help">Amounts are in thousands. 500 = Rp500.000 · 2.500 = Rp2.500.000</p><label class="income-field">Source<select id="income-source" name="source">${SOURCES.map(source => `<option value="${source.id}" ${(snapshot?.source || 'bonus') === source.id ? 'selected' : ''}>${source.name}</option>`).join('')}</select></label><label class="income-field">Date received<input name="date" type="date" min="2000-01-01" max="2100-12-31" value="${snapshot?.date || today()}"></label><details class="income-details" ${isEdit && (snapshot.title !== sourceFor(snapshot.source).name || snapshot.note) ? 'open' : ''}><summary>Title & note (optional)</summary><div class="income-details-content"><label class="income-field">Title<input name="title" maxlength="160" placeholder="e.g. Project completion bonus" value="${escape(snapshot?.title || '')}"></label><label class="income-field">Note<textarea name="note" maxlength="2000" rows="2" placeholder="Anything you’d like to remember">${escape(snapshot?.note || '')}</textarea></label></div></details><p id="income-error" class="error-message" role="alert"></p></form><div class="form-actions">${isEdit ? '<button class="secondary danger-action" data-delete>Delete</button>' : '<button class="secondary" data-close>Cancel</button>'}<button class="primary" data-submit-form="income-form">${isEdit ? 'Save changes' : 'Save income'}</button></div></div>`;
  const form = dialog.querySelector('form'), input = form.elements.amount;
  input.addEventListener('input', () => {
    const amount = amountFromInput(input.value);
    document.getElementById('income-amount-preview').textContent = Number.isSafeInteger(amount) && amount > 0 ? format(amount) : input.value.trim() ? 'Enter a valid amount' : format(0);
    input.removeAttribute('aria-invalid');
    document.getElementById('income-error').textContent = '';
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    try {
      const data = new FormData(form), source = data.get('source'), amount = amountFromInput(data.get('amount'));
      if (!Number.isSafeInteger(amount) || amount <= 0) { input.setAttribute('aria-invalid','true'); input.focus(); throw new Error('Enter an amount greater than zero. For Rp500.000, type 500.'); }
      const entry = validateEntry({id:snapshot?.id || crypto.randomUUID(),amount,source,date:data.get('date'),title:data.get('title').trim() || sourceFor(source)?.name,note:data.get('note'),createdAt:snapshot?.createdAt ?? Date.now()});
      await commit(current => {
        if (snapshot) { assertUnchanged(current,snapshot); current.entries[current.entries.findIndex(item => item.id === entry.id)] = entry; }
        else current.entries.push(entry);
      });
      month = entry.date.slice(0,7);
      search = ''; sourceFilter = ''; limit = 60;
      await closeDialog(dialog);
      render({focus:true});
      notify(isEdit ? 'Income updated' : 'Money added');
    } catch(error) { document.getElementById('income-error').textContent = message(error); }
  });
  dialog.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (busy) return;
    await closeDialog(dialog);
    confirm({title:'Delete this income?',copy:`${escape(snapshot.title)} · ${escape(format(snapshot.amount))}. This will remove the record from Money Plus.`,label:'Delete income',danger:true,action:async () => {
      await commit(current => { assertUnchanged(current,snapshot); current.entries = current.entries.filter(entry => entry.id !== snapshot.id); });
      notify('Income deleted');
    }});
  });
  openDialog(dialog,{focus:isEdit ? dialog.querySelector('[data-close]') : input});
}
function confirm({title,copy,label,action,danger = false,extra = ''}) {
  if (dialogActive(confirmation)) return;
  confirmation.innerHTML = `<div class="dialog-inner"><div class="dialog-header"><h2 id="income-confirm-title">${escape(title)}</h2></div><div class="confirmation-copy"><p>${copy}</p>${extra}</div><p class="error-message" role="alert" id="income-confirm-error"></p><div class="form-actions"><button class="secondary" data-close>Cancel</button><button class="primary ${danger ? 'danger-action' : ''}" data-confirm>${escape(label)}</button></div></div>`;
  confirmation.querySelector('[data-confirm]').addEventListener('click',async () => {
    if (busy) return;
    try { await action(); await closeDialog(confirmation); render({focus:true}); }
    catch(error) { document.getElementById('income-confirm-error').textContent = message(error); }
  });
  openDialog(confirmation,{focus:confirmation.querySelector('[data-close]')});
}
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content],{type})), link = document.createElement('a');
  link.href = url; link.download = filename;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url),30000);
}
async function importFile(file) {
  if (!file) return;
  if (busy || dialogActive(dialog) || dialogActive(confirmation)) return;
  try {
    if (file.size > 32*1024*1024) throw new Error('Choose a backup smaller than 32 MB.');
    const backup = validateIncome(JSON.parse((await file.text()).replace(/^\uFEFF/,'')));
    state = await repo.load();
    const preview = mergeIncome(state,backup,'current');
    if (!preview.added && !preview.conflicts) { notify('All records in this backup are already here.'); return; }
    confirm({title:'Import income backup?',copy:`Add ${preview.added} new ${preview.added === 1 ? 'record' : 'records'}. Your existing income will be kept. Expense records are unaffected.`,label:'Import income',extra:preview.conflicts ? `<fieldset style="margin-top:16px"><legend>${preview.conflicts} existing ${preview.conflicts === 1 ? 'record differs' : 'records differ'}. Which version should stay?</legend><label class="income-field" style="display:flex;margin-top:12px"><input type="radio" name="conflict" value="current" checked>Keep current versions</label><label class="income-field" style="display:flex;margin-top:12px"><input type="radio" name="conflict" value="backup">Use backup versions</label></fieldset>` : '',action:async () => {
      const choice = preview.conflicts ? confirmation.querySelector('[name="conflict"]:checked').value : '';
      let result;
      await commit(current => { result = mergeIncome(current,backup,choice); current.entries = result.state.entries; });
      notify(`Backup imported: ${result.added} new ${result.added === 1 ? 'record' : 'records'}.`);
    }});
  } catch(error) { notify(message(error)); }
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button || busy) return;
  const action = button.dataset.action;
  if (action === 'add') edit();
  else if (action === 'edit') { const entry = state.entries.find(entry => entry.id === button.dataset.id); if (entry) edit({...entry}); }
  else if (action === 'page') navigate(button.dataset.page);
  else if (action === 'month') { month = shiftMonth(month,Number(button.dataset.direction)); limit = 60; render(); }
  else if (action === 'more') { limit += 60; render(); }
  else if (action === 'export-json' || action === 'export-csv') {
    try {
      const latest = await repo.load();
      if (action === 'export-json') download(JSON.stringify(latest,null,2),`money-plus-backup-${today()}.json`,'application/json');
      else download('\uFEFF'+incomeCSV(latest),`money-plus-income-${today()}.csv`,'text/csv;charset=utf-8');
      notify('Download prepared');
    } catch(error) { notify(message(error)); }
  }
});
app.addEventListener('input',event => {
  if (event.target.id !== 'income-search') return;
  search = event.target.value; limit = 60; render();
});
app.addEventListener('change',event => {
  if (event.target.id === 'income-month') {
    if (validMonth(event.target.value)) { month = event.target.value; limit = 60; }
    render();
  } else if (event.target.id === 'income-source-filter') { sourceFilter = event.target.value; limit = 60; render(); }
  else if (event.target.id === 'income-import') { const file = event.target.files[0]; event.target.value = ''; importFile(file); }
});
for (const modal of [dialog,confirmation]) {
  modal.addEventListener('click',event => { if (event.target.closest('[data-close]') && !busy) closeDialog(modal); });
  modal.addEventListener('cancel',event => { event.preventDefault(); if (!busy) closeDialog(modal); });
}
window.addEventListener('hashchange',() => {
  const next = location.hash === '#overview' ? 'overview' : 'income';
  if (next !== page) { page = next; render({focus:true}); }
});
async function refresh() {
  if (busy) return;
  try { state = await repo.load(); if (!dialogActive(dialog) && !dialogActive(confirmation)) render(); }
  catch(error) { notify(message(error)); }
}
if (channel) channel.onmessage = refresh;
document.addEventListener('visibilitychange',() => { if (document.visibilityState === 'visible') refresh(); });
installKeyboardLayout();
installFooterActions();
try {
  state = await repo.load();
  render();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => notify('Offline cache unavailable. Income still saves on this device.'));
} catch(error) {
  app.innerHTML = `<div class="app-shell"><a class="back-home" href="./">← All apps</a><h1>Couldn’t open Money Plus</h1><p class="error-message">${escape(message(error))}</p><p class="muted" style="margin-top:12px">Enable browser storage and reload. Your records have not been reset.</p><button class="primary" style="margin-top:20px" onclick="location.reload()">Try again</button></div>`;
}

export const APP_ID = 'iqbal-saku-money-plus';
export const SOURCES = [
  {id:'salary', name:'Salary', symbol:'↗'},
  {id:'bonus', name:'Work bonus', symbol:'✦'},
  {id:'freelance', name:'Freelance', symbol:'⌁'},
  {id:'gift', name:'Gift', symbol:'◇'},
  {id:'refund', name:'Refund', symbol:'↩'},
  {id:'other', name:'Other income', symbol:'+'}
];
export function today(date = new Date()) {
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
}
export function validMonth(value) {
  return typeof value === 'string' && /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value);
}
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !validMonth(value.slice(0,7))) return false;
  return today(new Date(value+'T12:00:00')) === value;
}
export function emptyIncome() { return {app:APP_ID, version:1, entries:[]}; }
export function validateEntry(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Income record is invalid.');
  const {id, amount, date, source, title, note, createdAt} = raw;
  if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error('Income record ID is invalid.');
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 1000000000000) throw new Error('Enter an amount greater than zero, up to Rp1,000,000,000,000.');
  if (!validDate(date)) throw new Error('Choose a valid date from 2000 to 2100.');
  if (!SOURCES.some(item => item.id === source)) throw new Error('Choose an income source.');
  if (typeof title !== 'string' || !title.trim() || title.length > 160) throw new Error('Add a title of up to 160 characters.');
  if (typeof note !== 'string' || note.length > 2000) throw new Error('Notes must be 2,000 characters or fewer.');
  if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error('Income record timestamp is invalid.');
  return {id, amount, date, source, title:title.trim(), note:note.trim(), createdAt};
}
export function validateIncome(raw) {
  if (!raw || raw.app !== APP_ID || raw.version !== 1 || !Array.isArray(raw.entries)) throw new Error('Choose a Money Plus JSON backup. Expense backups belong in the Expenses app.');
  if (raw.entries.length > 100000) throw new Error('This backup has too many income records.');
  const entries = raw.entries.map(validateEntry), ids = new Set();
  let total = 0;
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error('This backup has duplicate income IDs.');
    ids.add(entry.id);
    total += entry.amount;
    if (!Number.isSafeInteger(total)) throw new Error('The income total exceeds the supported range.');
  }
  return {app:APP_ID, version:1, entries};
}
export function shiftMonth(month, direction) {
  if (!validMonth(month) || !Number.isInteger(direction)) throw new Error('Invalid month.');
  const [year, number] = month.split('-').map(Number);
  const next = today(new Date(year,number-1+direction,1)).slice(0,7);
  return validMonth(next) ? next : month;
}
export function incomeMetrics(state, month) {
  if (!validMonth(month)) throw new Error('Invalid month.');
  const entries = state.entries.filter(entry => entry.date.slice(0,7) === month)
    .sort((a,b) => b.date.localeCompare(a.date) || b.createdAt-a.createdAt || a.id.localeCompare(b.id));
  const sources = SOURCES.map(source => ({...source, total:entries.filter(entry => entry.source === source.id).reduce((sum,entry) => sum+entry.amount,0)}));
  const total = entries.reduce((sum,entry) => sum+entry.amount,0);
  const salary = sources.find(source => source.id === 'salary').total;
  const previousMonth = shiftMonth(month,-1);
  const previousTotal = previousMonth === month ? null : state.entries.filter(entry => entry.date.slice(0,7) === previousMonth).reduce((sum,entry) => sum+entry.amount,0);
  return {entries, sources, total, salary, extra:total-salary, previousTotal,
    lifetime:state.entries.reduce((sum,entry) => sum+entry.amount,0)};
}
// A repeated restore skips identical records; conflicting versions require an
// explicit choice instead of silently replacing a user's current record.
export function mergeIncome(current, backup, resolveConflict = '') {
  const clean = validateIncome(current), incoming = validateIncome(backup);
  const byId = new Map(clean.entries.map(entry => [entry.id,entry]));
  let added = 0, conflicts = 0;
  for (const entry of incoming.entries) {
    const old = byId.get(entry.id);
    if (!old) { byId.set(entry.id,entry); added++; }
    else if (JSON.stringify(old) !== JSON.stringify(entry)) {
      conflicts++;
      if (resolveConflict === 'backup') byId.set(entry.id,entry);
    }
  }
  if (conflicts && !['current','backup'].includes(resolveConflict)) throw new Error('Some records differ. Choose which version to keep.');
  return {state:validateIncome({...clean,entries:[...byId.values()]}), added, conflicts};
}
export function incomeCSV(state) {
  const quote = value => {
    let text = String(value ?? '');
    if (/^[=+\-@\t\r]/.test(text)) text = "'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  return [['Date','Title','Source','Amount','Currency','Note'],
    ...state.entries.slice().sort((a,b) => a.date.localeCompare(b.date)).map(entry =>
      [entry.date,entry.title,SOURCES.find(source => source.id === entry.source).name,entry.amount,'IDR',entry.note])]
    .map(row => row.map(quote).join(',')).join('\r\n');
}

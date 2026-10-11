try {
  document.documentElement.dataset.theme = localStorage.getItem('iqbal-saku-theme') === 'dark' ? 'dark' : 'light';
} catch { document.documentElement.dataset.theme = 'light'; }
function updateThemeControls() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#141a19' : '#ffffff';
  for (const button of document.querySelectorAll('[data-theme-toggle]')) {
    button.setAttribute('aria-pressed', String(dark));
    button.title = 'Switch to ' + (dark ? 'light' : 'dark') + ' theme';
  }
}
document.addEventListener('DOMContentLoaded', updateThemeControls);
document.addEventListener('click', event => {
  if (!event.target.closest('[data-theme-toggle]')) return;
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem('iqbal-saku-theme', theme); } catch {}
  updateThemeControls();
});

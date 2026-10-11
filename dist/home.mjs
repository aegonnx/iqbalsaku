// Preserve old bookmarks and installed-app links to expense screens.
function routeExpenseBookmark() {
  if (!['home', 'transactions', 'reports', 'settings'].includes(location.hash.slice(1))) return false;
  location.replace('./expenses.html' + location.hash);
  return true;
}
window.addEventListener('hashchange', routeExpenseBookmark);
if (!routeExpenseBookmark() && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

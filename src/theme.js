// Theme: 'system' (default) | 'light' | 'dark'
export function applyTheme() {
  let t = 'system';
  try { t = localStorage.getItem('abhyasa-theme') || 'system'; } catch {}
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

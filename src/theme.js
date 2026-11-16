// Theme: mode 'system' | 'light' | 'dark' and a colour palette the student picks
export const PALETTES = {
  sunny: { name: 'Sunny', emoji: '🌞', a: '#ffbf3c', b: '#ff8a1f' },
  ocean: { name: 'Ocean', emoji: '🐬', a: '#38bdf8', b: '#2563eb' },
  jungle: { name: 'Jungle', emoji: '🦜', a: '#4ade80', b: '#16a34a' },
  berry: { name: 'Berry', emoji: '🍓', a: '#f472b6', b: '#db2777' },
  galaxy: { name: 'Galaxy', emoji: '🚀', a: '#a78bfa', b: '#7c3aed' }
};
const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
export const getMode = () => get('abhyasa-theme', 'system');
export const getPalette = () => get('abhyasa-palette', 'sunny');
export function setTheme({ mode, palette }) {
  try { if (mode) localStorage.setItem('abhyasa-theme', mode); if (palette) localStorage.setItem('abhyasa-palette', palette); } catch {}
  applyTheme();
}
export function applyTheme() {
  const t = getMode();
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.color = getPalette();
}
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

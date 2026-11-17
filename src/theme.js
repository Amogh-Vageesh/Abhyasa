// Themes: white base everywhere (Kosha style); a theme changes the accent colours,
// level names and a few game words. Mode: 'light' (default) | 'dark' | 'system'.
const RANKS = ['Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master', 'Legend'];
export const THEMES = {
  clean: { name: 'Clean', tag: 'Kosha orange', a: '#f7b437', b: '#ee8a12', game: false,
    levels: ['Beginner', 'Learner', 'Achiever', 'Scholar', 'Expert', 'Master', 'Grandmaster', 'Legend'] },
  stealth: { name: 'Stealth', tag: 'Black & graphite', a: '#4b5563', b: '#111827', game: true, levels: RANKS },
  neon: { name: 'Neon', tag: 'Cyan → violet', a: '#22d3ee', b: '#7c3aed', game: true, levels: RANKS },
  esports: { name: 'Esports', tag: 'Red & black', a: '#f43f5e', b: '#be123c', game: true, levels: RANKS },
  synthwave: { name: 'Synthwave', tag: 'Purple → pink', a: '#c084fc', b: '#db2777', game: true, levels: RANKS },
  arctic: { name: 'Arctic', tag: 'Ice blue', a: '#7dd3fc', b: '#0284c7', game: true, levels: RANKS },
  pitch: { name: 'Pitch', tag: 'Stadium green', a: '#4ade80', b: '#15803d', game: true, levels: RANKS }
};
const GAME_WORDS = { routine: 'Daily Missions', weekly: 'Boss Fight', badges: 'Achievements' };
const PLAIN_WORDS = { routine: 'Today’s Routine', weekly: 'Weekly test', badges: 'Badges' };

const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
export const getMode = () => get('abhyasa-theme', 'light');
export const getThemeKey = () => { const k = get('abhyasa-palette', 'clean'); return THEMES[k] ? k : 'clean'; };
export const currentTheme = () => THEMES[getThemeKey()];
export const words = () => (currentTheme().game ? GAME_WORDS : PLAIN_WORDS);
export const levelNames = () => currentTheme().levels;

// Web (desktop) page backgrounds — illustrations are inline SVG/CSS, so they work offline
export const WEB_BGS = {
  plain: { name: 'White', tag: 'Clean white (default)' },
  sunrise: { name: 'Sunrise hills', tag: 'Warm sky & sun' },
  lavender: { name: 'Lavender peaks', tag: 'Soft mountains' },
  ocean: { name: 'Calm sea', tag: 'Sky blue waves' },
  aurora: { name: 'Glow', tag: 'Follows theme colour' },
  notebook: { name: 'Notebook', tag: 'Ruled paper' },
};
export const getWebBg = () => { const k = get('abhyasa-webbg-v2', 'plain'); return WEB_BGS[k] ? k : 'plain'; };

export function setTheme({ mode, palette, webBg }) {
  try { if (mode) localStorage.setItem('abhyasa-theme', mode); if (palette) localStorage.setItem('abhyasa-palette', palette); if (webBg) localStorage.setItem('abhyasa-webbg-v2', webBg); } catch {}
  applyTheme();
  window.dispatchEvent(new Event('abhyasa-theme'));
}
export function applyTheme() {
  const t = getMode();
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  const th = currentTheme();
  const r = document.documentElement;
  r.dataset.theme = dark ? 'dark' : 'light';
  r.dataset.color = getThemeKey();
  r.dataset.bg = getWebBg();
  r.style.setProperty('--accent-a', th.a);
  r.style.setProperty('--accent-b', th.b);
  // window / status bar colour follows the page background, not the accent
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
  m.content = dark ? '#17140f' : '#ffffff';
}
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

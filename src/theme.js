// Themes: white base everywhere; a theme changes the accent colour, heading font,
// a few game words and the level names. Mode: 'light' (default) | 'dark' | 'system'.
export const THEMES = {
  classic: { name: 'Classic', emoji: '⭐', a: '#ffb547', b: '#f97316', game: false,
    levels: ['Explorer', 'Learner', 'Achiever', 'Scholar', 'Champion', 'Genius', 'Legend', 'Master'] },
  pixel: { name: 'Pixel Quest', emoji: '🧱', a: '#4ade80', b: '#16a34a', game: true,
    levels: ['Rookie', 'Explorer', 'Builder', 'Crafter', 'Miner', 'Knight', 'Wizard', 'Legend'] },
  space: { name: 'Space Arcade', emoji: '🚀', a: '#818cf8', b: '#6d28d9', game: true,
    levels: ['Cadet', 'Pilot', 'Navigator', 'Captain', 'Commander', 'Admiral', 'Star Hero', 'Galaxy Master'] },
  racer: { name: 'Turbo Racer', emoji: '🏎️', a: '#f87171', b: '#dc2626', game: true,
    levels: ['Rookie', 'Driver', 'Racer', 'Pro', 'Pole Sitter', 'Champion', 'World Champ', 'Legend'] },
  ocean: { name: 'Ocean Explorer', emoji: '🐬', a: '#38bdf8', b: '#0369a1', game: true,
    levels: ['Swimmer', 'Diver', 'Explorer', 'Navigator', 'Captain', 'Admiral', 'Sea Hero', 'Ocean Master'] },
  candy: { name: 'Candy Land', emoji: '🍭', a: '#f9a8d4', b: '#db2777', game: true,
    levels: ['Sprinkle', 'Gummy', 'Lollipop', 'Cupcake', 'Candy Pro', 'Sugar Star', 'Candy King', 'Legend'] }
};
// Game words used when a game theme is on
const GAME_WORDS = { routine: 'Daily Quests', weekly: 'Boss Battle', badges: 'Trophies', level: 'Level', xp: 'XP' };
const PLAIN_WORDS = { routine: 'Today’s Routine', weekly: 'Weekly test', badges: 'Badges', level: 'Level', xp: 'XP' };

const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
export const getMode = () => get('abhyasa-theme', 'light');
export const getThemeKey = () => { const k = get('abhyasa-palette', 'classic'); return THEMES[k] ? k : 'classic'; };
export const currentTheme = () => THEMES[getThemeKey()];
export const words = () => (currentTheme().game ? GAME_WORDS : PLAIN_WORDS);
export const levelNames = () => currentTheme().levels;

export function setTheme({ mode, palette }) {
  try { if (mode) localStorage.setItem('abhyasa-theme', mode); if (palette) localStorage.setItem('abhyasa-palette', palette); } catch {}
  applyTheme();
  window.dispatchEvent(new Event('abhyasa-theme'));
}
export function applyTheme() {
  const t = getMode();
  const dark = t === 'dark' || (t === 'system' && window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.color = getThemeKey();
}
applyTheme();
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);

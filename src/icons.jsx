// Stroke icons in the same style as Kosha (24px grid, 1.8 stroke)
const P = {
  home: <><path d="M4 11l8-7 8 7v9H4z" /><path d="M10 20v-5h4v5" /></>,
  book: <><path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z" /><path d="M4 19V5M8 7h7" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  bell: <><path d="M6 16V11a6 6 0 0112 0v5l2 2H4z" /><path d="M10 20a2 2 0 004 0" /></>,
  flame: <path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z" />,
  alert: <><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17v.5" /></>,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 15h2M7 3h10" /></>,
  edit: <><path d="M4 20h4l10-10-4-4L4 16z" /><path d="M13 7l4 4" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".8" /></>,
  repeat: <><path d="M4 12a8 8 0 0114-5l2 2" /><path d="M20 4v5h-5" /><path d="M20 12a8 8 0 01-14 5l-2-2" /><path d="M4 20v-5h5" /></>,
  trophy: <><path d="M8 4h8v5a4 4 0 01-8 0z" /><path d="M8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8" /></>,
  chevR: <path d="M9 6l6 6-6 6" />,
  chevL: <path d="M15 6l-6 6 6 6" />,
  file: <><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>,
  users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0112 0" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14a5 5 0 015 5" /></>,
  settings: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  logout: <><path d="M14 4h5v16h-5" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  gift: <><rect x="3" y="9" width="18" height="4" rx="1" /><path d="M5 13v7h14v-7M12 9v11M12 9c-2-4-6-4-6-1s6 1 6 1c0 0 6 2 6-1s-4-3-6 1" /></>,
  send: <path d="M4 12l16-8-6 16-2-7z" />,
  check: <path d="M5 12l5 5 9-10" />,
  trash: <><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /><path d="M10 11v6M14 11v6" /></>,
  bulb: <><path d="M9 17h6M10 21h4" /><path d="M8 14a6 6 0 118 0c-1 1-1 2-1 3H9c0-1 0-2-1-3z" /></>,
  notebook: <><rect x="5" y="3" width="14" height="18" rx="2" /><path d="M9 3v18M12 8h4M12 12h4" /></>,
  mistake: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><path d="M8 16v-4M12 16V8M16 16v-6" /></>,
  rupee: <path d="M7 5h10M7 9h10M7 5c6 0 6 8 0 8l7 7" />,
  download: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>
};

export function Icon({ name, size = 22, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] || P.file}
    </svg>
  );
}

const TONES = {
  amber: '#f29a1d', green: '#1f9d55', red: '#e5484d', blue: '#2f7fe0', purple: '#8b5cf6', teal: '#0f9f9a', pink: '#d6457a', gray: '#6b7280'
};
export function Tile({ icon, tone = 'amber', round = false, size }) {
  const c = TONES[tone] || tone;
  return (
    <i className={`tile ${round ? 'round' : ''}`} style={{ '--tc': c, ...(size ? { width: size, height: size } : {}) }}>
      <Icon name={icon} size={round ? 22 : 20} />
    </i>
  );
}

export function Avatar({ name = '?', tone = 'purple', size = 40 }) {
  return <i className="ava" style={{ '--tc': TONES[tone] || tone, width: size, height: size, fontSize: size * 0.42 }}>{(name || '?').trim().charAt(0).toUpperCase()}</i>;
}

// Study-themed version of Kosha's hero illustration: sun, hills, a school and a stack of books
export const HeroArt = () => (
  <svg className="hero-art" viewBox="0 0 220 130" aria-hidden="true">
    <circle cx="150" cy="40" r="20" fill="#ffc163" opacity=".9" />
    <path d="M0 98 C40 70 70 78 104 90 C140 70 180 64 220 80 V130 H0z" fill="#bfe0a6" />
    <path d="M0 110 C50 92 90 100 130 108 C170 96 200 98 220 104 V130 H0z" fill="#8fcb7a" />
    <g transform="translate(118 62)">
      <path d="M0 24 L26 4 L52 24 V50 H0z" fill="#fff7ec" />
      <path d="M-4 26 L26 2 L56 26" fill="none" stroke="#e8743b" strokeWidth="5" strokeLinejoin="round" />
      <rect x="20" y="32" width="12" height="18" rx="1.5" fill="#e8743b" />
      <rect x="5" y="29" width="10" height="8" rx="1" fill="#7cc0e8" />
      <rect x="37" y="29" width="10" height="8" rx="1" fill="#7cc0e8" />
      <path d="M26 2 V-12" stroke="#8a5a3b" strokeWidth="2" />
      <path d="M26 -12 h12 l-3 4 3 4 h-12z" fill="#e5484d" />
    </g>
    <g transform="translate(184 92)">
      <rect x="0" y="12" width="26" height="6" rx="1.5" fill="#2f7fe0" />
      <rect x="2" y="6" width="22" height="6" rx="1.5" fill="#f29a1d" />
      <rect x="4" y="0" width="18" height="6" rx="1.5" fill="#1f9d55" />
    </g>
    <g fill="#5fae5f"><circle cx="100" cy="98" r="7" /><rect x="99" y="100" width="2.4" height="10" fill="#8a5a3b" /></g>
    <g fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" opacity=".9"><path d="M30 34c6-5 12-5 18 0M46 26c4-3 8-3 12 0" /></g>
  </svg>
);

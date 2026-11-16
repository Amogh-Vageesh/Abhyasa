import { useState } from 'react';
import { Card, PageHead } from './components';
import { THEMES, getMode, getThemeKey, setTheme } from './theme';

export function ThemePage() {
  const [mode, setMode] = useState(getMode());
  const [key, setKey] = useState(getThemeKey());
  return (
    <div>
      <PageHead title="Theme" />
      <Card title="Theme">
        <div className="themes">
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} className={`theme-tile ${key === k ? 'sel' : ''}`} style={{ '--pa': t.a, '--pb': t.b }} onClick={() => { setKey(k); setTheme({ palette: k }); }}>
              <span className="theme-bar" />
              <span className="theme-name">{t.name}</span>
              <small>{t.tag}</small>
              <span className="theme-rank">LVL 4 · {t.levels[3].toUpperCase()}</span>
            </button>
          ))}
        </div>
        <p className="muted small-text" style={{ marginTop: 10 }}>Game themes use ranked levels (Iron → Legend), Daily Missions and a weekly Boss Fight.</p>
      </Card>
      <Card title="Appearance" className="mt">
        <div className="seg" style={{ marginBottom: 0 }}>
          {[['light', 'Light'], ['dark', 'Dark'], ['system', 'System']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setTheme({ mode: k }); }}>{l}</button>)}
        </div>
      </Card>
    </div>
  );
}

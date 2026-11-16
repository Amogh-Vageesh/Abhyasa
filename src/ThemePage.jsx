import { useState } from 'react';
import { Card, PageHead } from './components';
import { THEMES, getMode, getThemeKey, setTheme } from './theme';

export function ThemePage() {
  const [mode, setMode] = useState(getMode());
  const [key, setKey] = useState(getThemeKey());
  return (
    <div>
      <PageHead title="Theme" />
      <Card title="Choose your game theme">
        <div className="palettes">
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} className={`palette ${key === k ? 'sel' : ''}`} style={{ '--pa': t.a, '--pb': t.b }} onClick={() => { setKey(k); setTheme({ palette: k }); }}>
              <span className="swatch">{t.emoji}</span><b>{t.name}</b>
              <small className="muted">{t.levels[0]} → {t.levels[t.levels.length - 1]}</small>
            </button>
          ))}
        </div>
        <p className="muted small-text" style={{ marginTop: 10 }}>Game themes change colours, heading style and level names, and turn your routine into Daily Quests and the weekly test into a Boss Battle.</p>
      </Card>
      <Card title="Light or dark" className="mt">
        <div className="seg" style={{ marginBottom: 0 }}>
          {[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['system', '📱 Like my phone']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setTheme({ mode: k }); }}>{l}</button>)}
        </div>
      </Card>
    </div>
  );
}

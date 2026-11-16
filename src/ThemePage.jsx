import { useState } from 'react';
import { Card, PageHead } from './components';
import { PALETTES, getMode, getPalette, setTheme } from './theme';

export function ThemePage() {
  const [mode, setMode] = useState(getMode());
  const [pal, setPal] = useState(getPalette());
  return (
    <div>
      <PageHead title="Theme" />
      <Card title="Pick your colours">
        <div className="palettes">
          {Object.entries(PALETTES).map(([k, p]) => (
            <button key={k} className={`palette ${pal === k ? 'sel' : ''}`} style={{ '--pa': p.a, '--pb': p.b }} onClick={() => { setPal(k); setTheme({ palette: k }); }}>
              <span className="swatch">{p.emoji}</span><b>{p.name}</b>
            </button>
          ))}
        </div>
      </Card>
      <Card title="Light or dark" className="mt">
        <div className="seg" style={{ marginBottom: 0 }}>
          {[['light', '☀️ Light'], ['dark', '🌙 Dark'], ['system', '📱 Like my phone']].map(([k, l]) => <button key={k} className={mode === k ? 'on' : ''} onClick={() => { setMode(k); setTheme({ mode: k }); }}>{l}</button>)}
        </div>
      </Card>
      <p className="muted small-text" style={{ marginTop: 12 }}>Theme is saved on this device.</p>
    </div>
  );
}

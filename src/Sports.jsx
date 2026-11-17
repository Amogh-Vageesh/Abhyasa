// Sports & achievements: pick games, log classes / matches / tournaments / practice, see time and results,
// and keep a record of achievements in and outside school (with certificate photos).
import { useMemo, useState } from 'react';
import { Card, Modal, PageHead } from './components';
import { Icon, Tile } from './icons';
import { saveItem, deleteItem, setFamilySports, savePhoto } from './lib/data';
import { addDays, ymd } from './lib/logic';
import { Photo } from './Written';

export const GAMES = [
  ['cricket', 'Cricket', '🏏'], ['football', 'Football', '⚽'], ['badminton', 'Badminton', '🏸'], ['chess', 'Chess', '♟️'],
  ['swimming', 'Swimming', '🏊'], ['tennis', 'Tennis', '🎾'], ['tabletennis', 'Table tennis', '🏓'], ['athletics', 'Athletics', '🏃'],
  ['basketball', 'Basketball', '🏀'], ['volleyball', 'Volleyball', '🏐'], ['skating', 'Skating', '⛸️'], ['karate', 'Karate', '🥋'],
  ['yoga', 'Yoga', '🧘'], ['cycling', 'Cycling', '🚴'], ['kabaddi', 'Kabaddi', '🤼'], ['hockey', 'Hockey', '🏑']
];
const TYPES = [['class', 'Class / coaching'], ['practice', 'Self practice'], ['match', 'Match'], ['tournament', 'Tournament']];
const LEVELS = [['school', 'School'], ['interschool', 'Inter-school'], ['club', 'Club / academy'], ['district', 'District'], ['state', 'State'], ['national', 'National'], ['international', 'International'], ['open', 'Open / online']];
const T_RESULTS = [['winner', '🥇 Winner'], ['runner', '🥈 Runner-up'], ['third', '🥉 3rd place'], ['semi', 'Semi-final'], ['quarter', 'Quarter-final'], ['participated', 'Participated']];
const A_CATS = [['sports', 'Sports'], ['academic', 'Academic'], ['olympiad', 'Olympiad / quiz'], ['arts', 'Arts & music'], ['leadership', 'Leadership'], ['other', 'Other']];
const A_RESULTS = [['gold', '🥇 1st / Gold'], ['silver', '🥈 2nd / Silver'], ['bronze', '🥉 3rd / Bronze'], ['merit', 'Merit / distinction'], ['special', 'Special award'], ['participation', 'Participation']];
const lbl = (list, k) => (list.find((x) => x[0] === k) || [])[1] || k;
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m || 0}m`);
const PERIODS = [['week', 'This week', 7], ['month', 'This month', 30], ['year', 'This year', 365], ['all', 'All time', 100000]];

export function sportName(F, id) {
  const g = GAMES.find((x) => x[0] === id) || (F.family?.sports || []).find((x) => x.id === id && x.custom);
  return g ? (Array.isArray(g) ? `${g[2]} ${g[1]}` : `${g.emoji || '🏅'} ${g.name}`) : id;
}
const mySports = (F) => (F.family?.sports || []).map((s) => (typeof s === 'string' ? { id: s } : s));

export function sportStats(logs, fromDate) {
  const inP = logs.filter((l) => l.date >= fromDate);
  const classes = inP.filter((l) => l.type === 'class');
  const attended = classes.filter((l) => l.attended !== false);
  const games = inP.filter((l) => l.type === 'match');
  const tours = inP.filter((l) => l.type === 'tournament');
  const w = games.filter((g) => g.result === 'win').length + tours.reduce((a, t) => a + (+t.won || 0), 0);
  const lo = games.filter((g) => g.result === 'loss').length + tours.reduce((a, t) => a + (+t.lost || 0), 0);
  const d = games.filter((g) => g.result === 'draw').length;
  const minutes = inP.reduce((a, l) => a + (l.type === 'class' && l.attended === false ? 0 : +l.minutes || 0), 0);
  const podiums = tours.filter((t) => ['winner', 'runner', 'third'].includes(t.result)).length;
  return { minutes, classes: classes.length, attended: attended.length, w, l: lo, d, tours: tours.length, podiums, games: w + lo + d };
}

export function SportsPage({ F, me }) {
  const [tab, setTab] = useState('overview');
  const [period, setPeriod] = useState('week');
  const [log, setLog] = useState(null);
  const [ach, setAch] = useState(null);
  const [pick, setPick] = useState(false);
  const [filter, setFilter] = useState('all');
  const today = ymd();
  const days = PERIODS.find((p) => p[0] === period)[2];
  const from = period === 'all' ? '0000' : addDays(today, -(days - 1));
  const sports = mySports(F);
  const st = useMemo(() => sportStats(F.sports, from), [F.sports, from]);
  const spanDays = period === 'all' ? Math.max(1, F.sports.length ? Math.round((new Date(today) - new Date(F.sports[F.sports.length - 1].date)) / 864e5) + 1 : 1) : days;
  const weeks = useMemo(() => Array.from({ length: 8 }, (_, k) => {
    const end = addDays(today, -7 * (7 - k)); const start = addDays(end, -6);
    const m = F.sports.filter((l) => l.date >= start && l.date <= end && !(l.type === 'class' && l.attended === false)).reduce((a, l) => a + (+l.minutes || 0), 0);
    return { label: end.slice(5).split('-').reverse().join('/'), m };
  }), [F.sports]);
  const maxW = Math.max(60, ...weeks.map((w) => w.m));
  const achList = F.achievements.filter((a) => filter === 'all' || (filter === 'school' ? a.where === 'school' : a.where === 'outside'));
  const newLog = (extra = {}) => setLog({ type: 'class', sport: sports[0]?.id || 'cricket', date: today, minutes: 60, attended: true, ...extra });

  return (
    <div>
      <PageHead title="Sports" right={<button className="primary small" onClick={() => (tab === 'achievements' ? setAch({ where: 'school', category: 'sports', result: 'gold', date: today }) : newLog())}><Icon name="plus" size={16} /> {tab === 'achievements' ? 'Achievement' : 'Log'}</button>} />
      <div className="seg" style={{ marginBottom: 12 }}>{[['overview', 'Overview'], ['activity', 'Activity'], ['achievements', 'Achievements']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab !== 'achievements' && <>
        <div className="chips sp-chips">
          {sports.map((s) => <span key={s.id} className="pill sp-pill">{sportName(F, s.id)}</span>)}
          <button className="small" onClick={() => setPick(true)}><Icon name="plus" size={14} /> {sports.length ? 'Edit games' : 'Choose games'}</button>
        </div>
        {!sports.length && <Card><p className="muted small-text">Choose the games {me.role === 'parent' ? 'he plays' : 'you play'} to start tracking classes, matches, tournaments and time.</p></Card>}
      </>}

      {tab === 'overview' && sports.length > 0 && <>
        <div className="seg" style={{ margin: '8px 0 12px' }}>{PERIODS.map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>
        <div className="kpis">
          <div><Tile icon="clock" tone="blue" /><small>Time on sports</small><b>{fmtMin(st.minutes)}</b><em>{fmtMin(Math.round(st.minutes / spanDays))} / day avg</em></div>
          <div><Tile icon="check" tone="green" /><small>Classes attended</small><b>{st.attended}/{st.classes}</b><em>{st.classes ? `${Math.round((st.attended / st.classes) * 100)}% attendance` : 'No classes'}</em></div>
          <div><Tile icon="target" tone="purple" /><small>Wins – losses</small><b>{st.w}–{st.l}{st.d ? `–${st.d}` : ''}</b><em>{st.games ? `${Math.round((st.w / st.games) * 100)}% win rate` : 'No matches'}</em></div>
          <div><Tile icon="trophy" tone="amber" /><small>Tournaments</small><b>{st.tours}</b><em>{st.podiums} podium finish{st.podiums === 1 ? '' : 'es'}</em></div>
        </div>
        <Card title="Weekly time — last 8 weeks" className="mt">
          <div className="sp-chart">{weeks.map((w, k) => (
            <div key={k} className="sp-bar"><span className="sp-val">{w.m ? fmtMin(w.m) : ''}</span><span className="sp-fill" style={{ height: `${(w.m / maxW) * 100}%` }} /><small>{w.label}</small></div>
          ))}</div>
          <p className="muted small-text" style={{ margin: '8px 0 0' }}>Average {fmtMin(Math.round(weeks.reduce((a, w) => a + w.m, 0) / 8))} per week · {fmtMin(Math.round(weeks.reduce((a, w) => a + w.m, 0) / 56))} per day.</p>
        </Card>
        <div className="sec-h"><h2>By game</h2></div>
        <div className="sp-grid">
          {sports.map((s) => {
            const x = sportStats(F.sports.filter((l) => l.sport === s.id), from);
            const last = F.sports.find((l) => l.sport === s.id && (l.type === 'match' || l.type === 'tournament'));
            return (
              <button key={s.id} className="card sp-card" onClick={() => newLog({ sport: s.id })}>
                <b className="sp-name">{sportName(F, s.id)}</b>
                <div className="sp-mini">
                  <span><small>Time</small>{fmtMin(x.minutes)}</span>
                  <span><small>Classes</small>{x.attended}/{x.classes}</span>
                  <span><small>W–L</small>{x.w}–{x.l}</span>
                  <span><small>Tourn.</small>{x.tours}</span>
                </div>
                {last && <small className="muted">Last: {last.type === 'match' ? `${lbl([['win', 'Won'], ['loss', 'Lost'], ['draw', 'Draw']], last.result)}${last.opponent ? ' vs ' + last.opponent : ''}` : `${last.name || 'Tournament'} — ${lbl(T_RESULTS, last.result)}`}</small>}
                <span className="sp-add">+ Log</span>
              </button>
            );
          })}
        </div>
      </>}

      {tab === 'activity' && <div className="card list">
        {!F.sports.length && <div className="muted small-text" style={{ padding: '12px 0' }}>Nothing logged yet. Tap “Log” to add a class, practice, match or tournament.</div>}
        {F.sports.slice(0, 120).map((l) => (
          <button key={l.id} className="lrow" onClick={() => setLog(l)}>
            <Tile icon={l.type === 'tournament' ? 'trophy' : l.type === 'match' ? 'target' : l.type === 'class' ? 'users' : 'repeat'} tone={l.type === 'class' && l.attended === false ? 'red' : l.type === 'tournament' ? 'amber' : l.type === 'match' ? 'purple' : 'blue'} />
            <div className="lt"><b>{sportName(F, l.sport)} · {l.type === 'tournament' ? l.name || 'Tournament' : lbl(TYPES, l.type)}</b>
              <small>{l.date}{l.minutes && !(l.type === 'class' && l.attended === false) ? ` · ${fmtMin(+l.minutes)}` : ''}{l.type === 'class' && l.attended === false ? ` · Missed${l.reason ? ' — ' + l.reason : ''}` : ''}{l.type === 'match' ? ` · ${lbl([['win', 'Won'], ['loss', 'Lost'], ['draw', 'Draw']], l.result)}${l.opponent ? ' vs ' + l.opponent : ''}${l.score ? ' (' + l.score + ')' : ''}` : ''}{l.type === 'tournament' ? ` · ${lbl(LEVELS, l.level)} · ${lbl(T_RESULTS, l.result)}` : ''}</small></div>
            <Icon name="chevR" className="chev" />
          </button>
        ))}
      </div>}

      {tab === 'achievements' && <>
        <div className="seg" style={{ marginBottom: 12 }}>{[['all', 'All'], ['school', 'In school'], ['outside', 'Outside school']].map(([k, l]) => <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div>
        <div className="kpis three">
          <div><Tile icon="trophy" tone="amber" /><small>Total</small><b>{achList.length}</b></div>
          <div><Tile icon="gift" tone="green" /><small>Medals (1st–3rd)</small><b>{achList.filter((a) => ['gold', 'silver', 'bronze'].includes(a.result)).length}</b></div>
          <div><Tile icon="chart" tone="purple" /><small>District level +</small><b>{achList.filter((a) => ['district', 'state', 'national', 'international'].includes(a.level)).length}</b></div>
        </div>
        <div className="card list mt">
          {!achList.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No achievements yet. Add certificates, medals and awards — in school or outside (sports, olympiads, quizzes, arts…).</div>}
          {achList.map((a) => (
            <button key={a.id} className="lrow" onClick={() => setAch(a)}>
              <span className="sp-medal">{{ gold: '🥇', silver: '🥈', bronze: '🥉' }[a.result] || '🏅'}</span>
              <div className="lt"><b>{a.title}</b><small>{a.date} · {a.where === 'school' ? 'In school' : 'Outside school'} · {lbl(A_CATS, a.category)} · {lbl(LEVELS, a.level || 'school')} · {lbl(A_RESULTS, a.result).replace(/^\S+\s/, '')}</small></div>
              {a.photo && <Icon name="camera" size={16} />}
            </button>
          ))}
        </div>
      </>}

      {pick && <GamesModal F={F} onClose={() => setPick(false)} />}
      {log && <SportLogModal F={F} me={me} entry={log} onClose={() => setLog(null)} />}
      {ach && <AchievementModal F={F} me={me} entry={ach} onClose={() => setAch(null)} />}
    </div>
  );
}

function GamesModal({ F, onClose }) {
  const [sel, setSel] = useState(mySports(F));
  const [custom, setCustom] = useState('');
  const has = (id) => sel.some((s) => s.id === id);
  const toggle = (id) => setSel(has(id) ? sel.filter((s) => s.id !== id) : [...sel, { id }]);
  return (
    <Modal title="Games I play" onClose={onClose}>
      <div className="sp-pick">{GAMES.map(([id, name, e]) => <button key={id} className={`small ${has(id) ? 'primary' : ''}`} onClick={() => toggle(id)}>{e} {name}</button>)}
        {sel.filter((s) => s.custom).map((s) => <button key={s.id} className="small primary" onClick={() => toggle(s.id)}>🏅 {s.name}</button>)}</div>
      <div className="row" style={{ marginTop: 10 }}>
        <input className="grow" placeholder="Another game (e.g. Archery)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <button className="small" disabled={!custom.trim()} onClick={() => { const n = custom.trim(); setSel([...sel, { id: 'c-' + n.toLowerCase().replace(/\W+/g, '-'), name: n, custom: true }]); setCustom(''); }}>Add</button>
      </div>
      <button className="primary" style={{ marginTop: 14, width: '100%' }} onClick={async () => { await setFamilySports(F.family.id, sel); onClose(); }}>Save</button>
    </Modal>
  );
}

function SportLogModal({ F, me, entry, onClose }) {
  const [e, setE] = useState(entry);
  const [addAch, setAddAch] = useState(!entry.id);
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setE({ ...e, [k]: v });
  const sports = mySports(F);
  const podium = e.type === 'tournament' && ['winner', 'runner', 'third'].includes(e.result);
  const valid = e.sport && e.date && (e.type !== 'tournament' || e.name?.trim());
  const save = async () => {
    setBusy(true);
    const data = { ...e, minutes: +e.minutes || 0, by: me.name };
    if (e.type !== 'class') delete data.attended;
    await saveItem(F.family.id, 'sports', data);
    if (podium && addAch) {
      await saveItem(F.family.id, 'achievements', { title: `${e.name} — ${lbl(T_RESULTS, e.result).replace(/^\S+\s/, '')}`, category: 'sports', sport: e.sport, where: e.level === 'school' || e.level === 'interschool' ? 'school' : 'outside', level: e.level || 'school', result: { winner: 'gold', runner: 'silver', third: 'bronze' }[e.result], date: e.date, by: me.name });
    }
    onClose();
  };
  return (
    <Modal title={e.id ? 'Edit sports entry' : 'Log sports'} onClose={onClose}>
      <div className="stack">
        <div className="seg scroll" style={{ marginBottom: 0 }}>{TYPES.map(([k, l]) => <button key={k} className={e.type === k ? 'on' : ''} onClick={() => set('type', k)}>{l}</button>)}</div>
        <div className="row" style={{ gap: 8 }}>
          <select className="grow" value={e.sport} onChange={(x) => set('sport', x.target.value)}>
            {(sports.length ? sports : GAMES.map(([id]) => ({ id }))).map((s) => <option key={s.id} value={s.id}>{sportName(F, s.id)}</option>)}
          </select>
          <input type="date" value={e.date} max={ymd()} onChange={(x) => set('date', x.target.value)} />
        </div>
        {e.type === 'class' && <div className="seg" style={{ marginBottom: 0 }}>{[[true, '✓ Attended'], [false, '✗ Missed']].map(([k, l]) => <button key={String(k)} className={e.attended === k ? 'on' : ''} onClick={() => set('attended', k)}>{l}</button>)}</div>}
        {e.type === 'class' && e.attended === false
          ? <input placeholder="Reason (optional) — exam, ill, rain…" value={e.reason || ''} onChange={(x) => set('reason', x.target.value)} />
          : <div>
              <small className="muted">Time spent</small>
              <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>{[30, 45, 60, 90, 120, 180].map((m) => <button key={m} className={`small ${+e.minutes === m ? 'primary' : ''}`} onClick={() => set('minutes', m)}>{fmtMin(m)}</button>)}
                <input type="number" inputMode="numeric" style={{ width: 90 }} value={e.minutes} onChange={(x) => set('minutes', x.target.value)} aria-label="Minutes" /><span className="small-text muted">min</span></div>
            </div>}
        {e.type === 'match' && <>
          <div className="seg" style={{ marginBottom: 0 }}>{[['win', 'Won'], ['loss', 'Lost'], ['draw', 'Draw']].map(([k, l]) => <button key={k} className={e.result === k ? 'on' : ''} onClick={() => set('result', k)}>{l}</button>)}</div>
          <div className="row" style={{ gap: 8 }}>
            <input className="grow" placeholder="Opponent / team (optional)" value={e.opponent || ''} onChange={(x) => set('opponent', x.target.value)} />
            <input style={{ width: 120 }} placeholder="Score" value={e.score || ''} onChange={(x) => set('score', x.target.value)} />
          </div>
        </>}
        {e.type === 'tournament' && <>
          <input placeholder="Tournament name (e.g. Inter-school U-14 Badminton)" value={e.name || ''} onChange={(x) => set('name', x.target.value)} />
          <select value={e.level || 'school'} onChange={(x) => set('level', x.target.value)}>{LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select value={e.result || 'participated'} onChange={(x) => set('result', x.target.value)}>{T_RESULTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <div className="row" style={{ gap: 8 }}>
            <label className="grow small-text muted">Matches won<input type="number" inputMode="numeric" value={e.won || ''} onChange={(x) => set('won', x.target.value)} /></label>
            <label className="grow small-text muted">Matches lost<input type="number" inputMode="numeric" value={e.lost || ''} onChange={(x) => set('lost', x.target.value)} /></label>
          </div>
          {podium && !e.id && <label className="row small-text" style={{ gap: 8 }}><input type="checkbox" checked={addAch} onChange={(x) => setAddAch(x.target.checked)} /> Also add to Achievements</label>}
        </>}
        <input placeholder="Note (optional) — what went well, what to improve" value={e.note || ''} onChange={(x) => set('note', x.target.value)} />
        <button className="primary" disabled={!valid || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        {e.id && <button className="danger" onClick={async () => { if (confirm('Delete this entry?')) { await deleteItem(F.family.id, 'sports', e.id); onClose(); } }}>Delete</button>}
      </div>
    </Modal>
  );
}

function AchievementModal({ F, me, entry, onClose }) {
  const [a, setA] = useState(entry);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setA({ ...a, [k]: v });
  const save = async () => {
    setBusy(true); setErr('');
    try {
      let photo = a.photo || null;
      if (file) photo = await savePhoto(F.family.id, file);
      await saveItem(F.family.id, 'achievements', { ...a, title: a.title.trim(), photo, by: a.by || me.name });
      onClose();
    } catch (x) { setBusy(false); setErr(String(x?.message || x)); }
  };
  return (
    <Modal title={a.id ? 'Edit achievement' : 'Add achievement'} onClose={onClose}>
      <div className="stack">
        <input placeholder="What did you achieve? (e.g. 1st in 100 m race, Science quiz winner)" value={a.title || ''} onChange={(x) => set('title', x.target.value)} />
        <div className="seg" style={{ marginBottom: 0 }}>{[['school', 'In school'], ['outside', 'Outside school']].map(([k, l]) => <button key={k} className={a.where === k ? 'on' : ''} onClick={() => set('where', k)}>{l}</button>)}</div>
        <div className="row" style={{ gap: 8 }}>
          <select className="grow" value={a.category} onChange={(x) => set('category', x.target.value)}>{A_CATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select className="grow" value={a.level || 'school'} onChange={(x) => set('level', x.target.value)}>{LEVELS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select className="grow" value={a.result} onChange={(x) => set('result', x.target.value)}>{A_RESULTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <input type="date" value={a.date} max={ymd()} onChange={(x) => set('date', x.target.value)} />
        </div>
        <input placeholder="Organised by / details (optional)" value={a.note || ''} onChange={(x) => set('note', x.target.value)} />
        <div className="row" style={{ gap: 10, alignItems: 'center' }}>
          {a.photo && !file && <Photo fid={F.family.id} id={a.photo} />}
          <label className="file-btn grow">{file ? `📷 ${file.name}` : a.photo ? '📷 Replace certificate photo' : '📷 Add certificate / medal photo (optional)'}
            <input type="file" accept="image/*" hidden onChange={(x) => setFile(x.target.files[0] || null)} /></label>
        </div>
        {err && <div className="feedback bad small-text">{err}</div>}
        <button className="primary" disabled={!a.title?.trim() || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        {a.id && <button className="danger" onClick={async () => { if (confirm('Delete this achievement?')) { await deleteItem(F.family.id, 'achievements', a.id); onClose(); } }}>Delete</button>}
      </div>
    </Modal>
  );
}

// Dashboard card
export function SportsSummary({ F, go }) {
  if (!mySports(F).length && !F.sports.length) return null;
  const s = sportStats(F.sports, addDays(ymd(), -6));
  return (
    <button className="note wr-note" style={{ border: 0, width: '100%', marginBottom: 12 }} onClick={() => go('sports')}>
      <Tile icon="trophy" tone="green" />
      <div style={{ textAlign: 'left' }}>
        <b>Sports this week: {fmtMin(s.minutes)}</b>
        <div className="small-text muted">{s.classes ? `${s.attended}/${s.classes} classes` : 'No classes'} · {s.games ? `${s.w}W ${s.l}L` : 'no matches'}{s.tours ? ` · ${s.tours} tournament${s.tours > 1 ? 's' : ''}` : ''} · {F.achievements.length} achievement{F.achievements.length === 1 ? '' : 's'}</div>
      </div>
    </button>
  );
}

export { SportLogModal, AchievementModal };

import { useMemo, useState } from 'react';
import { Card, Modal, PageHead, Progress } from './components';
import { Icon, Tile } from './icons';
import { deleteItem, saveItem } from './lib/data';
import { blocksFor, minutes, periodKey, recentPeriods, taskAppliesOn, taskStats, ymd } from './lib/logic';
import { CalendarPage } from './Shared';

const FREQS = [['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const KINDS = {
  school: { label: 'School', icon: 'home', tone: 'gray' },
  study: { label: 'Study', icon: 'book', tone: 'blue' },
  homework: { label: 'Homework', icon: 'notebook', tone: 'purple' },
  reading: { label: 'Reading', icon: 'bulb', tone: 'amber' },
  play: { label: 'Play / Sports', icon: 'trophy', tone: 'green' },
  hobby: { label: 'Hobby / Music', icon: 'target', tone: 'pink' },
  meals: { label: 'Meals / Break', icon: 'gift', tone: 'teal' },
  screen: { label: 'Screen time', icon: 'file', tone: 'red' },
  sleep: { label: 'Sleep', icon: 'calendar', tone: 'gray' }
};

export function PlannerPage({ F, me, sub, setSub }) {
  return (
    <div>
      <PageHead title="Planner" />
      <div className="seg">
        {[['tasks', 'Tasks'], ['timetable', 'Timetable'], ['calendar', 'Calendar']].map(([k, l]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>
        ))}
      </div>
      {sub === 'tasks' && <TasksView F={F} me={me} />}
      {sub === 'timetable' && <TimetableView F={F} me={me} />}
      {sub === 'calendar' && <CalendarPage F={F} me={me} embedded />}
    </div>
  );
}

// ---------------- Tasks ----------------
function periodLabel(freq, key) {
  if (freq === 'daily') return new Date(key).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
  if (freq === 'weekly') return 'W' + key.split('-W')[1];
  return new Date(key + '-01').toLocaleDateString('en-IN', { month: 'short' });
}

export function TasksView({ F, me }) {
  const today = ymd();
  const [freq, setFreq] = useState('daily');
  const [edit, setEdit] = useState(null);
  const key = periodKey(freq, today);
  const list = F.tasks.filter((t) => t.freq === freq && t.active !== false && taskAppliesOn(t, today));
  const doneN = list.filter((t) => t.done?.[key]).length;
  const history = taskStats(F.tasks, freq, today, freq === 'daily' ? 7 : 6).reverse();
  const toggle = (t) => saveItem(F.family.id, 'tasks', { id: t.id, done: { ...(t.done || {}), [key]: t.done?.[key] ? null : Date.now() } });
  const title = freq === 'daily' ? 'Today' : freq === 'weekly' ? 'This week' : 'This month';
  return (
    <div className="stack">
      <div className="seg" style={{ marginBottom: 0 }}>
        {FREQS.map(([k, l]) => <button key={k} className={freq === k ? 'on' : ''} onClick={() => setFreq(k)}>{l}</button>)}
      </div>
      <Card>
        <div className="row between"><div><div className="muted small-text">{title}</div><div className="big-score" style={{ fontSize: 26 }}>{doneN} / {list.length} done</div></div>
          <button className="primary small" onClick={() => setEdit({ freq, title: '', days: [] })}><Icon name="plus" size={16} /> Task</button></div>
        <Progress value={doneN} max={list.length || 1} color="linear-gradient(90deg, var(--accent-a), var(--accent-b))" />
        <div className="bars">
          {history.map((h) => (
            <div key={h.key} className="bar" title={`${h.key}: ${h.pct ?? '–'}%`}>
              <div className="bar-track"><div style={{ height: `${h.pct ?? 0}%`, background: h.pct >= 80 ? 'var(--good)' : h.pct >= 50 ? 'var(--accent-b)' : 'var(--bad)' }} /></div>
              <small>{periodLabel(freq, h.key)}</small>
            </div>
          ))}
        </div>
      </Card>
      <div className="card list">
        {!list.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No {freq} tasks yet. Tap “+ Task” to add one.</div>}
        {list.map((t) => (
          <div key={t.id} className={`lrow ${t.done?.[key] ? 'done' : ''}`}>
            <button className={`check-circle ${t.done?.[key] ? 'on' : ''}`} style={{ padding: 0 }} onClick={() => toggle(t)}>{t.done?.[key] && <Icon name="check" size={16} />}</button>
            <div className="lt" onClick={() => toggle(t)}><b>{t.title}</b><small>{t.byRole === 'parent' ? `Set by ${t.byName || 'parent'}` : 'My task'}{t.days?.length ? ' · ' + t.days.map((d) => WD[d]).join(', ') : ''}{t.reward ? ` · ₹${t.reward}` : ''}</small></div>
            {(me.role === 'parent' || t.byRole !== 'parent') && <button className="ghost small" onClick={() => setEdit(t)}>Edit</button>}
          </div>
        ))}
      </div>
      {edit && <TaskModal F={F} me={me} task={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function TaskModal({ F, me, task, onClose }) {
  const [t, setT] = useState({ freq: 'daily', days: [], ...task });
  const toggleDay = (d) => setT({ ...t, days: t.days.includes(d) ? t.days.filter((x) => x !== d) : [...t.days, d] });
  const save = async () => {
    await saveItem(F.family.id, 'tasks', { ...t, byRole: t.byRole || me.role, byName: t.byName || me.name, active: true, done: t.done || {} });
    onClose();
  };
  return (
    <Modal title={task.id ? 'Edit task' : 'New task'} onClose={onClose}>
      <div className="stack">
        <input placeholder="e.g. Read 20 pages, Practise tables, Clean study desk" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
        <div className="seg" style={{ marginBottom: 0 }}>{FREQS.map(([k, l]) => <button key={k} className={t.freq === k ? 'on' : ''} onClick={() => setT({ ...t, freq: k })}>{l}</button>)}</div>
        {t.freq === 'daily' && <>
          <div className="muted small-text">Which days? (none = every day)</div>
          <div className="row wrap">{WD.map((d, i) => <button key={d} className={`small ${t.days.includes(i) ? 'primary' : ''}`} onClick={() => toggleDay(i)}>{d}</button>)}</div>
        </>}
        <button className="primary" disabled={!t.title} onClick={save}>Save</button>
        {task.id && <button className="danger" onClick={async () => { if (confirm('Delete this task?')) { await deleteItem(F.family.id, 'tasks', task.id); onClose(); } }}>Delete task</button>}
      </div>
    </Modal>
  );
}

// ---------------- Timetable ----------------
const TEMPLATE = [
  { days: [1, 2, 3, 4, 5], start: '08:00', end: '15:30', kind: 'school', title: 'School' },
  { days: [1, 2, 3, 4, 5], start: '15:30', end: '16:30', kind: 'meals', title: 'Snack & rest' },
  { days: [1, 2, 3, 4, 5], start: '16:30', end: '17:30', kind: 'play', title: 'Play outside' },
  { days: [1, 2, 3, 4, 5], start: '17:45', end: '18:45', kind: 'homework', title: 'Homework + log classes' },
  { days: [1, 2, 3, 4, 5], start: '19:00', end: '19:45', kind: 'study', title: 'Abhyasa: learn, practice, revise' },
  { days: [1, 2, 3, 4, 5], start: '20:30', end: '21:00', kind: 'reading', title: 'Reading' },
  { days: [0, 1, 2, 3, 4, 5, 6], start: '21:30', end: '06:30', kind: 'sleep', title: 'Sleep' },
  { days: [0, 6], start: '10:00', end: '11:30', kind: 'study', title: 'Weekend test + fix mistakes' },
  { days: [0, 6], start: '16:00', end: '18:00', kind: 'play', title: 'Sports / outing' }
];

export function TimetableView({ F, me }) {
  const todayWd = new Date().getDay();
  const [wd, setWd] = useState(todayWd);
  const [edit, setEdit] = useState(null);
  const dateForWd = useMemo(() => { const d = new Date(); d.setDate(d.getDate() + ((wd - todayWd + 7) % 7)); return ymd(d); }, [wd]);
  const blocks = blocksFor(F.blocks, dateForWd);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const total = (kind) => blocks.filter((b) => b.kind === kind).reduce((a, b) => a + ((minutes(b.end) - minutes(b.start) + 1440) % 1440), 0);
  const useTemplate = async () => { for (const b of TEMPLATE) await saveItem(F.family.id, 'plan', { ...b, byRole: me.role }); };
  return (
    <div className="stack">
      <div className="daypick">{WD.map((d, i) => <button key={d} className={`${wd === i ? 'on' : ''} ${todayWd === i ? 'today' : ''}`} onClick={() => setWd(i)}>{d}</button>)}</div>
      <Card>
        <div className="row between">
          <div className="small-text muted">Study {total('study') + total('homework') + total('reading')} min · Play {total('play')} min · Screen {total('screen')} min</div>
          <button className="primary small" onClick={() => setEdit({ days: [wd], start: '17:00', end: '18:00', kind: 'study', title: '' })}><Icon name="plus" size={16} /> Block</button>
        </div>
      </Card>
      <div className="card list">
        {!blocks.length && <div style={{ padding: '12px 0' }}>
          <p className="muted small-text">No plan for {WD[wd]} yet. Add blocks for study, homework, play, reading and sleep.</p>
          {!F.blocks.length && <button className="small" onClick={useTemplate}>Start with a suggested school-week plan</button>}
        </div>}
        {blocks.map((b) => {
          const k = KINDS[b.kind] || KINDS.study;
          const now = wd === todayWd && minutes(b.start) <= nowMin && nowMin < minutes(b.end);
          return (
            <button key={b.id} className={`lrow ${now ? 'now' : ''}`} onClick={() => setEdit(b)}>
              <div className="time-col"><b>{b.start}</b><small>{b.end}</small></div>
              <Tile icon={k.icon} tone={k.tone} />
              <div className="lt"><b>{b.title || k.label}</b><small>{k.label}{now ? ' · now' : ''}{b.remind ? ' · 🔔' : ''}</small></div>
            </button>
          );
        })}
      </div>
      {edit && <BlockModal F={F} me={me} block={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function BlockModal({ F, me, block, onClose }) {
  const [b, setB] = useState({ remind: ['study', 'homework', 'reading'].includes(block.kind), ...block });
  const toggleDay = (d) => setB({ ...b, days: b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d] });
  return (
    <Modal title={block.id ? 'Edit block' : 'New time block'} onClose={onClose}>
      <div className="stack">
        <select value={b.kind} onChange={(e) => setB({ ...b, kind: e.target.value })}>
          {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <input placeholder="Title (e.g. Maths practice, Cricket, Piano)" value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} />
        <div className="row"><input type="time" value={b.start} onChange={(e) => setB({ ...b, start: e.target.value })} /><span>to</span><input type="time" value={b.end} onChange={(e) => setB({ ...b, end: e.target.value })} /></div>
        <div className="row wrap">{WD.map((d, i) => <button key={d} className={`small ${b.days.includes(i) ? 'primary' : ''}`} onClick={() => toggleDay(i)}>{d}</button>)}</div>
        <label className="check"><input type="checkbox" checked={!!b.remind} onChange={(e) => setB({ ...b, remind: e.target.checked })} /> Remind me when it starts (phone app)</label>
        <button className="primary" disabled={!b.days.length || !b.start || !b.end} onClick={async () => { await saveItem(F.family.id, 'plan', { ...b, byRole: b.byRole || me.role }); onClose(); }}>Save</button>
        {block.id && <button className="danger" onClick={async () => { await deleteItem(F.family.id, 'plan', block.id); onClose(); }}>Delete block</button>}
      </div>
    </Modal>
  );
}

export function TodayPlanCard({ F, go }) {
  const today = ymd();
  const blocks = blocksFor(F.blocks, today).filter((b) => b.kind !== 'sleep' && b.kind !== 'school');
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const now = blocks.find((b) => minutes(b.start) <= nowMin && nowMin < minutes(b.end));
  const next = blocks.find((b) => minutes(b.start) > nowMin);
  if (!F.blocks.length) {
    return <button className="note" style={{ width: '100%', border: 0 }} onClick={() => go('planner', 'timetable')}><Tile icon="calendar" tone="blue" /><div className="lt" style={{ textAlign: 'left' }}><b>Make your timetable</b><div className="small-text muted">Plan when to study, do homework and play</div></div></button>;
  }
  const show = [now, next].filter(Boolean);
  if (!show.length) return null;
  return (
    <div className="card list">
      {show.map((b) => { const k = KINDS[b.kind] || KINDS.study; return (
        <button key={b.id} className={`lrow ${b === now ? 'now' : ''}`} onClick={() => go('planner', 'timetable')}>
          <Tile icon={k.icon} tone={k.tone} />
          <div className="lt"><b>{b === now ? 'Now' : 'Next'}: {b.title || k.label}</b><small>{b.start}–{b.end}</small></div>
          <Icon name="chevR" className="chev" />
        </button>
      ); })}
    </div>
  );
}

export { recentPeriods };

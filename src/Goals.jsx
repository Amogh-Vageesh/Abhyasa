import { useState } from 'react';
import { Card, Modal, PageHead, Progress } from './components';
import { Icon, Tile } from './icons';
import { deleteItem, saveItem } from './lib/data';
import { daysBetween, mistakeAnalysis, ymd } from './lib/logic';
import { SUBJECTS } from './lib/syllabus';
import { subjectOfFactory, chapterTitle } from './Study';
import { celebrate } from './lib/celebrate';

const FEEL = ['😣', '😕', '😐', '🙂', '😎'];

// Ideas based on his data, so goals are specific
function suggestions(F) {
  const out = [];
  const a = mistakeAnalysis(F.mistakes, subjectOfFactory(F));
  if (a.top === 'careless') out.push('Make fewer careless slips — check every answer once');
  if (a.top === 'reading') out.push('Read every question twice before answering');
  if (a.gapChapters[0]) out.push(`Understand ${chapterTitle(F, a.gapChapters[0].id)} properly`);
  const p = (F.papers || []).filter((x) => x.total).sort((x, y) => y.date.localeCompare(x.date))[0];
  if (p && p.marks / p.total < 0.8) out.push(`Score 80%+ in the next ${SUBJECTS.find((s) => s.id === p.subject)?.name || ''} test`);
  out.push('Finish my routine before 8 pm', 'Read 20 minutes every day', 'Improve my handwriting', 'Learn times tables 12–20');
  return [...new Set(out)].slice(0, 6);
}

export function GoalsCard({ F, me, go }) {
  const active = F.goals.filter((g) => g.status !== 'done');
  const [edit, setEdit] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const kid = me.role !== 'parent';
  return (
    <>
      <div className="sec-h"><h2>{kid ? 'I want to improve' : 'His improvement goals'}</h2><button className="link" onClick={() => go('goals')}>All <Icon name="chevR" size={16} /></button></div>
      <div className="card list">
        {!active.length && <div className="lrow"><Tile icon="target" tone="amber" /><div className="lt"><b>{kid ? 'What do you want to get better at?' : 'No goals yet'}</b><small>{kid ? 'Write it down — e.g. “fewer careless slips in Maths”.' : 'He can add things he wants to improve.'}</small></div>{kid && <button className="small primary" onClick={() => setEdit({})}>Add</button>}</div>}
        {active.slice(0, 3).map((g) => <GoalRow key={g.id} g={g} onOpen={() => (kid ? setCheckin(g) : go('goals'))} />)}
        {kid && active.length > 0 && <button className="lrow" onClick={() => setEdit({})}><Tile icon="plus" tone="gray" /><div className="lt"><b>Add another</b></div></button>}
      </div>
      {edit && <GoalModal F={F} me={me} goal={edit} onClose={() => setEdit(null)} />}
      {checkin && <CheckinModal F={F} goal={checkin} onClose={() => setCheckin(null)} />}
    </>
  );
}

function goalProgress(g) {
  const steps = g.steps || [];
  if (steps.length) return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
  const c = g.checkins || [];
  return Math.min(100, c.length * 10);
}

function GoalRow({ g, onOpen }) {
  const pct = goalProgress(g);
  const last = (g.checkins || []).slice(-1)[0];
  const days = g.targetDate ? daysBetween(ymd(), g.targetDate) : null;
  return (
    <button className="lrow" onClick={onOpen}>
      <Tile icon="target" tone={SUBJECTS.find((s) => s.id === g.subject)?.color || 'amber'} />
      <div className="lt"><b>{g.title}</b>
        <small>{(g.steps || []).length ? `${(g.steps || []).filter((s) => s.done).length}/${g.steps.length} steps` : `${(g.checkins || []).length} check-ins`}{last ? ` · last ${FEEL[last.feel - 1]}` : ''}{days !== null ? ` · ${days >= 0 ? days + ' days left' : 'past target'}` : ''}</small>
        <Progress value={pct} max={100} color="var(--accent-b)" />
      </div>
    </button>
  );
}

export function GoalsPage({ F, me }) {
  const [edit, setEdit] = useState(null);
  const [checkin, setCheckin] = useState(null);
  const kid = me.role !== 'parent';
  const active = F.goals.filter((g) => g.status !== 'done');
  const done = F.goals.filter((g) => g.status === 'done');
  return (
    <div>
      <PageHead title={kid ? 'My goals' : 'His goals'} right={kid && <button className="primary small" onClick={() => setEdit({})}><Icon name="plus" size={16} /> Goal</button>} />
      <p className="muted small-text">{kid ? 'Write what you want to get better at, plan small steps, and check in on how it’s going. Your parents can see this and cheer you on.' : 'Things he wants to get better at, his plan and how he feels it’s going.'}</p>
      <div className="stack">
        {!active.length && <Card><p className="muted small-text">No active goals.</p></Card>}
        {active.map((g) => (
          <Card key={g.id}>
            <div className="row between"><b style={{ fontSize: 17 }}>{g.title}</b>{kid && <button className="ghost small" onClick={() => setEdit(g)}>Edit</button>}</div>
            <div className="muted small-text">{SUBJECTS.find((s) => s.id === g.subject)?.name || 'General'}{g.targetDate ? ` · by ${g.targetDate}` : ''}</div>
            {g.why && <p className="small-text"><span className="muted">Why: </span>{g.why}</p>}
            <Progress value={goalProgress(g)} max={100} color="var(--accent-b)" />
            {(g.steps || []).length > 0 && <div className="goal-steps">{g.steps.map((s, i) => (
              <label key={i} className="check"><input type="checkbox" disabled={!kid} checked={!!s.done} onChange={() => saveItem(F.family.id, 'goals', { id: g.id, steps: g.steps.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) })} /> {s.text}</label>
            ))}</div>}
            {(g.checkins || []).length > 0 && <div className="checkins">{g.checkins.slice(-4).reverse().map((c, i) => <div key={i} className="small-text"><span>{FEEL[c.feel - 1]}</span> <span className="muted">{c.date.slice(5)}</span> {c.note}</div>)}</div>}
            {kid && <div className="row wrap" style={{ marginTop: 8 }}>
              <button className="small" onClick={() => setCheckin(g)}>Check in</button>
              <button className="small primary" onClick={async () => { await saveItem(F.family.id, 'goals', { id: g.id, status: 'done', doneAt: ymd() }); celebrate(true); }}>I did it! 🎉</button>
            </div>}
          </Card>
        ))}
        {done.length > 0 && <>
          <div className="sec-h"><h2>Achieved 🏆</h2></div>
          <div className="card list">{done.map((g) => <div key={g.id} className="lrow"><Tile icon="trophy" tone="amber" /><div className="lt"><b>{g.title}</b><small>Done {g.doneAt}</small></div></div>)}</div>
        </>}
      </div>
      {edit && <GoalModal F={F} me={me} goal={edit} onClose={() => setEdit(null)} />}
      {checkin && <CheckinModal F={F} goal={checkin} onClose={() => setCheckin(null)} />}
    </div>
  );
}

export function GoalModal({ F, me, goal, onClose }) {
  const [g, setG] = useState({ title: '', subject: '', why: '', targetDate: '', steps: [], ...goal });
  const [step, setStep] = useState('');
  const ideas = suggestions(F);
  const save = async () => {
    const steps = step.trim() ? [...g.steps, { text: step.trim(), done: false }] : g.steps;
    await saveItem(F.family.id, 'goals', { ...g, steps, status: g.status || 'active', by: me.name, checkins: g.checkins || [] });
    onClose();
  };
  return (
    <Modal title={goal.id ? 'Edit goal' : 'What do you want to improve?'} onClose={onClose}>
      <div className="stack">
        <input placeholder="e.g. Fewer careless slips in Maths" value={g.title} onChange={(e) => setG({ ...g, title: e.target.value })} />
        {!goal.id && <div className="chips">{ideas.map((i) => <button key={i} className="small" onClick={() => setG({ ...g, title: i })}>{i}</button>)}</div>}
        <select value={g.subject} onChange={(e) => setG({ ...g, subject: e.target.value })}><option value="">General / all subjects</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <textarea rows={2} placeholder="Why does this matter to you? (optional)" value={g.why} onChange={(e) => setG({ ...g, why: e.target.value })} />
        <div className="muted small-text">Small steps to get there</div>
        {g.steps.map((s, i) => <div key={i} className="row"><span className="grow small-text">• {s.text}</span><button className="ghost small" onClick={() => setG({ ...g, steps: g.steps.filter((_, j) => j !== i) })}>✕</button></div>)}
        <div className="row"><input placeholder="e.g. Check each answer before moving on" value={step} onChange={(e) => setStep(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && step.trim()) { setG({ ...g, steps: [...g.steps, { text: step.trim(), done: false }] }); setStep(''); } }} />
          <button className="small" disabled={!step.trim()} onClick={() => { setG({ ...g, steps: [...g.steps, { text: step.trim(), done: false }] }); setStep(''); }}>Add</button></div>
        <label className="field"><span>Target date (optional)</span><input type="date" value={g.targetDate} onChange={(e) => setG({ ...g, targetDate: e.target.value })} style={{ maxWidth: 170 }} /></label>
        <button className="primary" disabled={!g.title.trim()} onClick={save}>Save goal</button>
        {goal.id && <button className="danger" onClick={async () => { if (confirm('Delete this goal?')) { await deleteItem(F.family.id, 'goals', goal.id); onClose(); } }}>Delete goal</button>}
      </div>
    </Modal>
  );
}

function CheckinModal({ F, goal, onClose }) {
  const [feel, setFeel] = useState(0);
  const [note, setNote] = useState('');
  return (
    <Modal title={goal.title} onClose={onClose}>
      <div className="stack">
        <p><b>How is it going?</b></p>
        <div className="faces">{FEEL.map((f, i) => <button key={f} className={`face ${feel === i + 1 ? 'sel' : ''}`} onClick={() => setFeel(i + 1)}><span>{f}</span></button>)}</div>
        <textarea rows={2} placeholder="What went well? What was hard? (🎤 to speak)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary" disabled={!feel} onClick={async () => { await saveItem(F.family.id, 'goals', { id: goal.id, checkins: [...(goal.checkins || []), { date: ymd(), feel, note: note.trim() }] }); onClose(); }}>Save check-in</button>
      </div>
    </Modal>
  );
}

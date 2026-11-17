// Plan my day — a planning COACH, not a planner. He decides what to do, how long and when; the app asks
// questions, shows what is pending, and gives tips when something in his plan looks risky. In the evening he
// reflects, and tomorrow's coach reminds him of what he said he would change. Builds planning skill over time.
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card } from './components';
import { Icon, Tile } from './icons';
import { saveItem } from './lib/data';
import { addDays, blocksFor, daysBetween, dueChapters, minutes, ymd } from './lib/logic';
import { chapterTitle, subjectOfFactory } from './Study';
import { SUBJECTS } from './lib/syllabus';
import { weekOf } from './Explore';

const toMin = (t) => (t ? minutes(t) : null);
const toTime = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(((m % 60) + 60) % 60).padStart(2, '0')}`;
const fmt = (m) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m}m`);
const OBSTACLES = ['Phone / TV', 'Took longer than I thought', 'Felt tired', 'Something unexpected came up', 'Forgot', 'Did not understand the work', 'Friends / play ran over'];
const KIND_TIPS = {
  homework: 'Homework due tomorrow usually comes first.',
  revise: 'Revising on the right day makes it stick — 15–20 minutes is enough.',
  test: 'A test coming up? Small daily practice beats one long session the night before.',
  fixit: 'Clearing a few fix-its each day stops mistakes piling up.',
  explore: 'Explore is your “beyond school” track — about 20 minutes.',
  sports: 'Exercise helps you focus — don’t drop it.',
  reading: 'Reading for fun counts too!',
  own: ''
};

// What the app knows is pending today — he chooses from these (and can add his own)
export function candidates(F, today) {
  const subjectOf = subjectOfFactory(F);
  const sName = (id) => SUBJECTS.find((s) => s.id === subjectOf(id))?.name || '';
  const out = [];
  const day = F.days?.[today] || {};
  if (!day.homework) out.push({ key: 'homework', kind: 'homework', label: 'School homework', hint: 'Due tomorrow?', hard: true });
  const taughtToday = Object.entries(F.chapters || {}).filter(([, c]) => c.lastTaught === today || c.taughtOn === today).map(([id]) => id);
  for (const id of taughtToday.slice(0, 3)) out.push({ key: `learn-${id}`, kind: 'revise', label: `Go over today’s class: ${chapterTitle(F, id)}`, hint: sName(id), subject: subjectOf(id) });
  for (const d of dueChapters(F.chapters, today).slice(0, 3)) if (!taughtToday.includes(d.id)) out.push({ key: `rev-${d.id}`, kind: 'revise', label: `Revise ${chapterTitle(F, d.id)}`, hint: `${sName(d.id)} · revision due`, subject: subjectOf(d.id) });
  for (const e of (F.events || []).filter((x) => x.type === 'test' && x.date >= today && daysBetween(today, x.date) <= 7)) {
    const gap = daysBetween(today, e.date);
    out.push({ key: `test-${e.id}`, kind: 'test', label: `Prepare: ${e.title}`, hint: gap === 0 ? 'today!' : `in ${gap} day${gap > 1 ? 's' : ''}`, testGap: gap, hard: true, subject: e.subject || subjectOf((e.chapters || [])[0]) });
  }
  if (day.noTeaching) out.unshift({ key: 'noteach', kind: 'revise', label: 'No class today — catch up or read ahead', hint: 'See ideas on your home screen' });
  const open = (F.mistakes || []).filter((m) => !m.resolved).length;
  if (open) out.push({ key: 'fixit', kind: 'fixit', label: `Clear fix-its (${open} open)`, hint: 'Practice → Fix-its' });
  if (weekOf(F) !== null) out.push({ key: 'explore', kind: 'explore', label: 'Explore challenge', hint: 'Beyond school · ~20 min' });
  const weak = (F.answers || []).filter((a) => a.status === 'marked' && (a.items || []).some((it) => (it.score ?? 0) < it.marks * 0.6));
  if (weak.length) out.push({ key: 'rewrite', kind: 'homework', label: 'Rewrite weak written answers', hint: 'Practice → Written' });
  for (const s of (F.family?.sports || []).slice(0, 2)) out.push({ key: `sport-${s.id || s}`, kind: 'sports', label: `Sports: ${s.name || (s.id || s)}`, hint: 'Practice or class' });
  out.push({ key: 'reading', kind: 'reading', label: 'Reading (story book / newspaper)', hint: 'Optional' });
  return out;
}

// The coach's probes: each returns a tip if something in HIS plan looks risky. He decides what to do about it.
export function coachTips(p, F, today, history) {
  const tips = [];
  const items = (p.items || []).filter((x) => x.start && x.est);
  const fixed = (p.fixed || []).filter((f) => f.start && f.end);
  const sleep = toMin(p.sleep) ?? 22 * 60;
  const freeFrom = toMin(p.free) ?? 16 * 60;
  for (const it of items) {
    const s = toMin(it.start), e = s + +it.est;
    const clash = fixed.find((f) => s < toMin(f.end) && e > toMin(f.start));
    if (clash) tips.push({ tone: 'bad', text: `“${it.label}” (${it.start}) overlaps with ${clash.label} (${clash.start}–${clash.end}). Which one should move?` });
    if (s < freeFrom) tips.push({ tone: 'warn', text: `“${it.label}” starts at ${it.start}, before you said you’d be free (${p.free}).` });
    if (e > sleep) tips.push({ tone: 'warn', text: `“${it.label}” ends at ${toTime(e)} — after your bedtime (${p.sleep}). Sleep is when your brain stores what you learnt.` });
    if (it.hard && s >= 20 * 60 + 30) tips.push({ tone: 'tip', text: `“${it.label}” is a hard task placed late (${it.start}). Most people focus better earlier — want to swap it with something easier?` });
  }
  const byTime = [...items].sort((x, y) => toMin(x.start) - toMin(y.start));
  for (let k = 1; k < byTime.length; k++) {
    const a = byTime[k - 1], b = byTime[k];
    const aEnd = toMin(a.start) + +a.est;
    if (toMin(b.start) < aEnd) tips.push({ tone: 'bad', text: `“${b.label}” starts at ${b.start} but “${a.label}” only ends at ${toTime(aEnd)}.` });
  }
  // long stretch without a break
  let run = 0, prevEnd = null;
  for (const it of [...items].sort((x, y) => toMin(x.start) - toMin(y.start))) {
    const s = toMin(it.start);
    run = prevEnd !== null && s - prevEnd < 5 ? run + +it.est : +it.est;
    prevEnd = s + +it.est;
    if (run > 70 && it.kind !== 'sports') { tips.push({ tone: 'tip', text: `You have about ${fmt(run)} of work in a row up to ${toTime(prevEnd)}. A 5–10 minute break every 40–50 minutes keeps you sharp.` }); break; }
  }
  const total = items.reduce((a, x) => a + +x.est, 0);
  const busy = fixed.reduce((a, f) => a + Math.max(0, toMin(f.end) - toMin(f.start)), 0);
  const free = Math.max(0, sleep - freeFrom - busy);
  if (total > free) tips.push({ tone: 'warn', text: `You planned ${fmt(total)} but have about ${fmt(free)} free before bed. What can move to tomorrow?` });
  const must = items.find((x) => x.must);
  if (must && items.length > 1 && toMin(must.start) === Math.max(...items.map((x) => toMin(x.start)))) tips.push({ tone: 'tip', text: `Your must-do (“${must.label}”) is last. If the evening runs late, it’s the one that gets dropped — put it earlier?` });
  if (!(p.items || []).some((x) => x.must)) tips.push({ tone: 'tip', text: 'Which ONE task must be done today no matter what? Tap ★ on it.' });
  for (const e of (F.events || []).filter((x) => x.type === 'test' && x.date >= today && daysBetween(today, x.date) <= 3))
    if (!(p.items || []).some((x) => x.key === `test-${e.id}`)) tips.push({ tone: 'warn', text: `${e.title} is in ${daysBetween(today, e.date) || 0} day(s) and isn’t in your plan. Is that a choice?` });
  if (items.length && !items.some((x) => ['sports', 'reading'].includes(x.kind)) && !fixed.some((f) => /play|sport|class|game/i.test(f.label))) tips.push({ tone: 'tip', text: 'No play or rest in your plan. Breaks and exercise actually help memory — add some?' });
  // learn from his own history: estimates
  const est = estimateBias(history);
  if (est && est.ratio > 1.25) tips.push({ tone: 'tip', text: `Last week your tasks took about ${Math.round((est.ratio - 1) * 100)}% longer than you guessed. Add a little extra time to your estimates?` });
  const seen = new Set();
  return tips.filter((t) => (seen.has(t.text) ? false : seen.add(t.text)));
}

export function estimateBias(history) {
  const done = (history || []).flatMap((d) => (d.items || []).filter((x) => x.actual && x.est));
  if (done.length < 3) return null;
  const est = done.reduce((a, x) => a + +x.est, 0), act = done.reduce((a, x) => a + +x.actual, 0);
  return { ratio: act / est, n: done.length };
}
const lastTook = (history, kind) => {
  for (const d of history || []) { const it = (d.items || []).find((x) => x.kind === kind && x.actual); if (it) return it; }
  return null;
};

export function PlanSkills(history) {
  const days = (history || []).filter((d) => d.committed);
  const items = days.flatMap((d) => d.items || []);
  const done = items.filter((x) => x.done);
  const est = estimateBias(history);
  const obstacles = {};
  for (const d of days) for (const o of d.reflection?.obstacles || []) obstacles[o] = (obstacles[o] || 0) + 1;
  return {
    planned: days.length,
    completion: items.length ? Math.round((done.length / items.length) * 100) : null,
    accuracy: est ? Math.max(0, Math.round(100 - Math.abs(est.ratio - 1) * 100)) : null,
    reflected: days.filter((d) => d.reflection).length,
    top: Object.entries(obstacles).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k)
  };
}

// ===================== the coach wizard =====================
export function PlanCoach({ F, me, onClose }) {
  const today = ymd();
  const existing = (F.dayplans || []).find((d) => d.id === today);
  const history = (F.dayplans || []).filter((d) => d.id < today).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 7);
  const yesterday = history.find((d) => d.id === addDays(today, -1));
  const fixedFromTimetable = blocksFor(F.blocks || [], today).filter((b) => !['study', 'homework', 'reading', 'sleep'].includes(b.kind)).map((b) => ({ label: b.title || b.kind, start: b.start, end: b.end }));
  const sleepBlock = blocksFor(F.blocks || [], today).find((b) => b.kind === 'sleep');
  const [p, setP] = useState(existing || { free: '', sleep: sleepBlock?.start || '', fixed: fixedFromTimetable, items: [] });
  const [step, setStep] = useState(0);
  const [own, setOwn] = useState('');
  const [busy, setBusy] = useState(false);
  const cands = useMemo(() => candidates(F, today), [F]);
  const set = (patch) => setP({ ...p, ...patch });
  const setItem = (k, patch) => set({ items: p.items.map((x, j) => (j === k ? { ...x, ...patch } : x)) });
  const has = (key) => p.items.some((x) => x.key === key);
  const toggle = (c) => set({ items: has(c.key) ? p.items.filter((x) => x.key !== c.key) : [...p.items, { ...c, est: '', start: '' }] });
  const move = (k, d) => { const a = [...p.items]; const j = k + d; if (j < 0 || j >= a.length) return; [a[k], a[j]] = [a[j], a[k]]; set({ items: a }); };
  const tips = coachTips(p, F, today, history);
  const save = async () => {
    setBusy(true);
    const items = [...p.items].sort((a, b) => (toMin(a.start) ?? 9999) - (toMin(b.start) ?? 9999));
    await saveItem(F.family.id, 'dayplans', { ...p, items, id: today, date: today, committed: true, by: me.name, at: Date.now() });
    onClose();
  };
  const STEPS = ['Your day', 'What needs doing?', 'How long?', 'When?', 'Check & commit'];
  const canNext = [!!p.free && !!p.sleep, p.items.length > 0, p.items.every((x) => +x.est > 0), p.items.every((x) => x.start), true][step];

  return createPortal(
    <div className="reader wr-screen">
      <div className="reader-head">
        <button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="chevL" size={24} /></button>
        <b className="grow">Plan my day · {STEPS[step]}</b>
        <span className="small-text muted">{step + 1}/5</span>
      </div>
      <div className="reader-body wr-body"><div className="wr-col">
        <div className="wr-dots">{STEPS.map((s, k) => <button key={s} aria-label={s} className={`${k === step ? 'cur' : ''} ${k < step ? 'done' : ''}`} onClick={() => k < step && setStep(k)} />)}</div>

        {step === 0 && <>
          {yesterday?.reflection?.change && <div className="note"><Tile icon="repeat" tone="purple" /><div><b>Yesterday you said you’d change:</b><div className="small-text">“{yesterday.reflection.change}”</div></div></div>}
          <div className="card pc-q"><b>When will you be free to start today?</b><small className="muted">After school, snack and a short rest.</small><input type="time" value={p.free} onChange={(e) => set({ free: e.target.value })} /></div>
          <div className="card pc-q"><b>What time will you go to sleep?</b><small className="muted">💡 At 13 you need about 9 hours of sleep. If you wake at 6:30, that means bed by about 9:30.</small><input type="time" value={p.sleep} onChange={(e) => set({ sleep: e.target.value })} /></div>
          <div className="card pc-q">
            <b>What’s already fixed today?</b><small className="muted">Tuition, sports class, dinner, a function… The coach checks your plan doesn’t clash with these.</small>
            {p.fixed.map((f, k) => (
              <div key={k} className="row pc-fixed">
                <input className="grow" value={f.label} onChange={(e) => set({ fixed: p.fixed.map((x, j) => (j === k ? { ...x, label: e.target.value } : x)) })} placeholder="What" />
                <input type="time" value={f.start} onChange={(e) => set({ fixed: p.fixed.map((x, j) => (j === k ? { ...x, start: e.target.value } : x)) })} />
                <input type="time" value={f.end} onChange={(e) => set({ fixed: p.fixed.map((x, j) => (j === k ? { ...x, end: e.target.value } : x)) })} />
                <button className="small icon-only" aria-label="Remove" onClick={() => set({ fixed: p.fixed.filter((_, j) => j !== k) })}>×</button>
              </div>
            ))}
            <button className="small" onClick={() => set({ fixed: [...p.fixed, { label: '', start: '', end: '' }] })}><Icon name="plus" size={14} /> Add something fixed</button>
          </div>
        </>}

        {step === 1 && <>
          <div className="note"><Tile icon="bulb" tone="amber" /><div><b>Pick what you’ll do today</b><div className="small-text muted">Here’s what’s pending. You choose — not everything has to be today. Tap ★ on the ONE thing that must get done.</div></div></div>
          <div className="card list">
            {cands.map((c) => {
              const on = has(c.key); const it = p.items.find((x) => x.key === c.key);
              return (
                <div key={c.key} className="lrow" role="button" onClick={() => toggle(c)}>
                  <span className={`check-circle ${on ? 'on' : ''}`}>{on && <Icon name="check" size={16} />}</span>
                  <div className="lt"><b>{c.label}</b><small>{c.hint}{c.testGap !== undefined && c.testGap <= 2 ? ' · ⚠️ soon' : ''}</small></div>
                  {on && <button className={`small pc-star ${it.must ? 'on' : ''}`} aria-label="Must do" onClick={(e) => { e.stopPropagation(); set({ items: p.items.map((x) => ({ ...x, must: x.key === c.key ? !x.must : false })) }); }}>★</button>}
                </div>
              );
            })}
            {p.items.filter((x) => x.kind === 'own').map((x) => (
              <div key={x.key} className="lrow"><span className="check-circle on"><Icon name="check" size={16} /></span><div className="lt"><b>{x.label}</b><small>Added by you</small></div>
                <button className={`small pc-star ${x.must ? 'on' : ''}`} onClick={() => set({ items: p.items.map((y) => ({ ...y, must: y.key === x.key ? !y.must : false })) })}>★</button>
                <button className="small icon-only" onClick={() => set({ items: p.items.filter((y) => y.key !== x.key) })}>×</button></div>
            ))}
          </div>
          <div className="row"><input className="grow" placeholder="Add your own (e.g. Finish science model)" value={own} onChange={(e) => setOwn(e.target.value)} />
            <button className="small" disabled={!own.trim()} onClick={() => { set({ items: [...p.items, { key: 'own-' + Date.now(), kind: 'own', label: own.trim(), est: '', start: '' }] }); setOwn(''); }}>Add</button></div>
          <p className="muted small-text">💡 A good order of importance: due tomorrow → test soon → revision due → everything else.</p>
        </>}

        {step === 2 && <>
          <div className="note"><Tile icon="clock" tone="blue" /><div><b>Guess how long each will take</b><div className="small-text muted">Be honest — tonight you’ll see how close your guesses were. Good planners get better at guessing.</div></div></div>
          {p.items.map((x, k) => {
            const prev = lastTook(history, x.kind);
            return (
              <div key={x.key} className="card pc-q">
                <b>{x.must ? '★ ' : ''}{x.label}</b>
                {prev && <small className="muted">Last time a similar task took you {fmt(+prev.actual)} (you guessed {fmt(+prev.est)}).</small>}
                {!prev && KIND_TIPS[x.kind] && <small className="muted">💡 {KIND_TIPS[x.kind]}</small>}
                <div className="row wrap" style={{ gap: 6 }}>{[10, 15, 20, 30, 45, 60, 90].map((m) => <button key={m} className={`small ${+x.est === m ? 'primary' : ''}`} onClick={() => setItem(k, { est: m })}>{fmt(m)}</button>)}</div>
              </div>
            );
          })}
          <p className="muted small-text">Total: {fmt(p.items.reduce((a, x) => a + (+x.est || 0), 0))}</p>
        </>}

        {step === 3 && <>
          <div className="note"><Tile icon="calendar" tone="purple" /><div><b>Now decide WHEN</b><div className="small-text muted">Put the tasks in your order (↑ ↓) and choose a start time for each. You’re free from {p.free}, bed at {p.sleep}.</div></div></div>
          {p.fixed.filter((f) => f.start).length > 0 && <div className="pc-fixedline small-text muted">Fixed: {p.fixed.filter((f) => f.start).map((f) => `${f.label} ${f.start}–${f.end}`).join(' · ')}</div>}
          {p.items.map((x, k) => (
            <div key={x.key} className="card pc-when">
              <div className="pc-order"><button className="small icon-only" disabled={k === 0} onClick={() => move(k, -1)} aria-label="Move up">↑</button><button className="small icon-only" disabled={k === p.items.length - 1} onClick={() => move(k, 1)} aria-label="Move down">↓</button></div>
              <div className="grow"><b>{x.must ? '★ ' : ''}{x.label}</b><small className="muted">{fmt(+x.est)}{x.start ? ` · ends ${toTime(toMin(x.start) + +x.est)}` : ''}</small></div>
              <input type="time" value={x.start} onChange={(e) => setItem(k, { start: e.target.value })} aria-label="Start time" />
              {k > 0 && p.items[k - 1].start && !x.start && <button className="small" onClick={() => setItem(k, { start: toTime(toMin(p.items[k - 1].start) + +p.items[k - 1].est + 5) })}>After previous</button>}
            </div>
          ))}
          {tips.filter((t) => t.tone === 'bad').map((t, k) => <div key={k} className="pc-tip bad">⚠️ {t.text}</div>)}
        </>}

        {step === 4 && <>
          <div className="card pc-timeline">
            {[...p.fixed.filter((f) => f.start).map((f) => ({ t: f.start, e: f.end, label: f.label, fixed: true })), ...p.items.map((x) => ({ t: x.start, e: toTime(toMin(x.start) + +x.est), label: x.label, must: x.must }))]
              .sort((a, b) => toMin(a.t) - toMin(b.t)).map((r, k) => (
                <div key={k} className={`pc-row ${r.fixed ? 'fixed' : ''}`}><span>{r.t}–{r.e}</span><b>{r.must ? '★ ' : ''}{r.label}</b></div>))}
            <div className="pc-row fixed"><span>{p.sleep}</span><b>Sleep 😴</b></div>
          </div>
          <div className="sec-h"><h2>Coach’s questions</h2></div>
          {!tips.length && <div className="pc-tip good">✅ Nice plan! No clashes, breaks look fine and your must-do is early. Go for it.</div>}
          {tips.map((t, k) => <div key={k} className={`pc-tip ${t.tone}`}>{t.tone === 'bad' ? '⚠️' : t.tone === 'warn' ? '🤔' : '💡'} {t.text}</div>)}
          {tips.length > 0 && <p className="muted small-text">You can go back and change things, or keep your plan — it’s your call.</p>}
        </>}
      </div></div>
      <div className="wr-foot"><div className="wr-col row">
        <button disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
        <span className="grow" />
        {step < 4 ? <button className="primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Next <Icon name="chevR" size={18} /></button>
          : <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Commit to my plan'}</button>}
      </div></div>
    </div>, document.body);
}

// ===================== today's plan: tick off, record actual time, reflect =====================
export function DayPlanCard({ F, me, compact = false, go }) {
  const today = ymd();
  const [coach, setCoach] = useState(false);
  const [reflect, setReflect] = useState(false);
  const [timing, setTiming] = useState(null); // {k, at}
  const plan = (F.dayplans || []).find((d) => d.id === today);
  const isParent = me.role === 'parent';
  const history = (F.dayplans || []).filter((d) => d.id <= today).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 14);
  const skills = PlanSkills(history);
  const upd = (items) => saveItem(F.family.id, 'dayplans', { id: today, items });
  const tick = (k) => { const it = plan.items[k]; const items = plan.items.map((x, j) => (j === k ? { ...x, done: !x.done, actual: x.actual || (x.done ? x.actual : x.est) } : x)); upd(items); if (!it.done && !it.actual) setTiming(null); };
  const setActual = (k, v) => upd(plan.items.map((x, j) => (j === k ? { ...x, actual: v } : x)));
  const stopTimer = () => { const m = Math.max(1, Math.round((Date.now() - timing.at) / 60000)); upd(plan.items.map((x, j) => (j === timing.k ? { ...x, actual: m, done: true } : x))); setTiming(null); };
  const done = plan ? plan.items.filter((x) => x.done).length : 0;
  const evening = new Date().getHours() >= 18;
  const stage = !plan ? 0 : plan.reflection ? 3 : done === plan.items.length || evening ? 2 : 1;
  if (compact && go) {
    return (
      <button className="card pc-card pc-compact" onClick={() => go('planner', 'day')}>
        <Tile icon="calendar" tone="purple" />
        <div className="grow" style={{ textAlign: 'left' }}>
          <small className="muted pc-kicker">Planner · today</small>
          <b className="pc-title">{!plan ? 'Plan my day' : stage === 3 ? 'Day done & reflected ✓' : `${done}/${plan.items.length} tasks done`}</b>
          <small className="muted" style={{ display: 'block' }}>{!plan ? (isParent ? 'No plan yet today' : 'Tap — 5 quick questions, you decide') : stage === 2 ? 'Time to reflect on your day' : (plan.items.find((x) => !x.done) ? `Next: ${plan.items.find((x) => !x.done).label} · ${plan.items.find((x) => !x.done).start}` : '')}</small>
          {plan && <div className="progress" style={{ marginTop: 8 }}><div style={{ width: `${(done / Math.max(1, plan.items.length)) * 100}%`, background: 'linear-gradient(90deg, var(--accent-a), var(--accent-b))' }} /></div>}
        </div>
        <Icon name="chevR" className="chev" />
      </button>
    );
  }

  return (
    <div className="card pc-card">
      {!compact && <div className="pc-steps">{[['Plan', 'Decide what, how long & when'], ['Do', 'Start, time & tick off'], ['Reflect', '1 minute in the evening']].map(([t, d], k) => (
        <div key={t} className={`pc-step ${stage === k ? 'cur' : ''} ${stage > k ? 'done' : ''}`}><span>{stage > k ? '✓' : k + 1}</span><div><b>{t}</b><small>{d}</small></div></div>
      ))}</div>}
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div><small className="muted pc-kicker">Plan my day</small>
          <h3 className="pc-title">{plan ? `${done}/${plan.items.length} done` : isParent ? 'No plan made yet today' : 'Make your plan for today'}</h3></div>
        {!isParent && <button className={plan ? 'small' : 'primary'} onClick={() => setCoach(true)}>{plan ? 'Change plan' : 'Start planning →'}</button>}
      </div>
      {!plan && !isParent && <p className="muted small-text" style={{ margin: '6px 0 0' }}>5 quick questions — you decide what to do and when; the coach checks your plan.</p>}
      {plan && <div className="pc-items">
        {plan.items.map((x, k) => (
          <div key={x.key} className={`pc-item ${x.done ? 'done' : ''}`}>
            {!isParent ? <button className={`check-circle ${x.done ? 'on' : ''}`} onClick={() => tick(k)} aria-label={x.done ? 'Mark not done' : 'Mark done'}>{x.done && <Icon name="check" size={14} />}</button>
              : <span className={`check-circle ${x.done ? 'on' : ''}`}>{x.done && <Icon name="check" size={14} />}</span>}
            <div className="grow"><b>{x.must ? '★ ' : ''}{x.label}</b><small className="muted">{x.start} · planned {fmt(+x.est)}{x.done && x.actual ? ` · took ${fmt(+x.actual)}` : ''}</small></div>
            {!isParent && !x.done && (timing?.k === k
              ? <button className="small primary" onClick={stopTimer}>⏹ {Math.max(0, Math.round((Date.now() - timing.at) / 60000))}m</button>
              : <button className="small" onClick={() => setTiming({ k, at: Date.now() })} disabled={!!timing}>▶ Start</button>)}
            {!isParent && x.done && !compact && <select className="pc-actual" value={x.actual || ''} onChange={(e) => setActual(k, +e.target.value)} aria-label="Actual time">{[5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120].map((m) => <option key={m} value={m}>{fmt(m)}</option>)}</select>}
          </div>
        ))}
      </div>}
      {plan && !isParent && (evening || done === plan.items.length) && !plan.reflection && <button className="primary" style={{ width: '100%', marginTop: 10 }} onClick={() => setReflect(true)}>How did today go? (1 min)</button>}
      {plan?.reflection && <div className="pc-refl small-text"><b>Reflection:</b> {plan.reflection.went}{plan.reflection.obstacles?.length ? ` · Got in the way: ${plan.reflection.obstacles.join(', ')}` : ''}{plan.reflection.change ? ` · Tomorrow: “${plan.reflection.change}”` : ''}</div>}
      {!compact && skills.planned > 0 && <div className="pc-skills">
        <span><small>Days planned</small><b>{skills.planned}</b></span>
        <span><small>Tasks done</small><b>{skills.completion ?? '—'}{skills.completion !== null ? '%' : ''}</b></span>
        <span><small>Time guesses</small><b>{skills.accuracy ?? '—'}{skills.accuracy !== null ? '%' : ''}</b></span>
        <span><small>Reflections</small><b>{skills.reflected}</b></span>
      </div>}
      {!compact && skills.top.length > 0 && <p className="muted small-text" style={{ margin: '8px 0 0' }}>Most common obstacle{skills.top.length > 1 ? 's' : ''}: {skills.top.join(', ')}.</p>}
      {coach && <PlanCoach F={F} me={me} onClose={() => setCoach(false)} />}
      {reflect && <Reflect F={F} plan={plan} onClose={() => setReflect(false)} />}
    </div>
  );
}

function Reflect({ F, plan, onClose }) {
  const [went, setWent] = useState('');
  const [obs, setObs] = useState([]);
  const [change, setChange] = useState('');
  const done = plan.items.filter((x) => x.done).length;
  const est = plan.items.filter((x) => x.done && x.actual).reduce((a, x) => ({ e: a.e + +x.est, a: a.a + +x.actual }), { e: 0, a: 0 });
  return createPortal(
    <div className="reader wr-screen">
      <div className="reader-head"><button className="icon-btn" onClick={onClose}><Icon name="chevL" size={24} /></button><b className="grow">How did today go?</b></div>
      <div className="reader-body wr-body"><div className="wr-col">
        <div className="card wr-summary">
          <div><small className="muted">Tasks done</small><b>{done}/{plan.items.length}</b></div>
          <div><small className="muted">Planned time</small><b>{fmt(est.e || 0)}</b></div>
          <div><small className="muted">Actual time</small><b>{fmt(est.a || 0)}</b></div>
        </div>
        {est.e > 0 && <p className="muted small-text">{est.a > est.e * 1.2 ? 'Tasks took longer than you guessed — that’s normal. Tomorrow, add a little extra time.' : est.a < est.e * 0.8 ? 'You finished faster than you guessed — nice! You can plan a bit more tomorrow.' : 'Your time guesses were close — great planning skill!'}</p>}
        <div className="card pc-q"><b>How did your plan go?</b>
          <div className="row wrap" style={{ gap: 6 }}>{['Went to plan 👍', 'Mostly OK', 'Some things slipped', 'Didn’t go well'].map((w) => <button key={w} className={`small ${went === w ? 'primary' : ''}`} onClick={() => setWent(w)}>{w}</button>)}</div></div>
        <div className="card pc-q"><b>What got in the way? (tap any)</b>
          <div className="row wrap" style={{ gap: 6 }}>{OBSTACLES.map((o) => <button key={o} className={`small ${obs.includes(o) ? 'primary' : ''}`} onClick={() => setObs(obs.includes(o) ? obs.filter((x) => x !== o) : [...obs, o])}>{o}</button>)}</div></div>
        <div className="card pc-q"><b>What ONE thing will you do differently tomorrow?</b>
          <small className="muted">💡 e.g. “Start homework before 5”, “Keep the phone in another room”, “Do the hard subject first”.</small>
          <input value={change} onChange={(e) => setChange(e.target.value)} placeholder="Tomorrow I will…" /></div>
        <button className="primary" disabled={!went} onClick={async () => { await saveItem(F.family.id, 'dayplans', { id: plan.id, reflection: { went, obstacles: obs, change: change.trim(), at: Date.now() } }); onClose(); }}>Save</button>
      </div></div>
    </div>, document.body);
}

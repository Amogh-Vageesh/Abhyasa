// Kid journey: Today → Capture my day → Study → Practice → Fix → Test goal → Trophy room.
// Designed from Amogh's side: one clear next step, everything else one tap away.
import { useEffect, useMemo, useState } from 'react';
import { Icon, Tile } from './icons';
import { Modal, PageHead, QuizRunner, useDesktop } from './components';
import { MissionCheck, LogModal } from './Student';
import { EventModal } from './Shared';
import { TaskModal } from './Planner';
import { SportLogModal, AchievementModal } from './Sports';
import { Photo } from './Written';
import { markStep, recordQuiz, STEPS } from './lib/actions';
import { buildPractice, buildRevise, openFixits, recentTaughtIds, todaysChapterIds } from './lib/runs';
import { loadChapter, questionPool, saveEvent, saveItem, savePhoto, setDay } from './lib/data';
import { addDays, currentStreak, daysBetween, dueChapters, pickQuestions, ymd } from './lib/logic';
import { CHAPTERS, SUBJECTS, chapterLabel } from './lib/syllabus';
import { chapterTitle } from './Study';

// ---------- home mode (new journey vs classic) ----------
const HOME_KEY = 'abhyasa-home';
export function getHomeMode() { try { return localStorage.getItem(HOME_KEY) || 'journey'; } catch { return 'journey'; } }
export function useHomeMode() {
  const [mode, setM] = useState(getHomeMode);
  useEffect(() => { const f = () => setM(getHomeMode()); window.addEventListener('abhyasa-home', f); return () => window.removeEventListener('abhyasa-home', f); }, []);
  const setMode = (m) => { try { localStorage.setItem(HOME_KEY, m); } catch {} window.dispatchEvent(new Event('abhyasa-home')); };
  return [mode, setMode];
}

// ---------- helpers ----------
const firstName = (F) => F.family.studentName?.split(' ')[0] || '';
const ENERGY = [['tired', 'Tired'], ['okay', 'Okay'], ['pumped', 'Pumped']];
export function energyCount(F, energy) {
  const n = F.settings.practiceCount || 10;
  return energy === 'tired' ? Math.max(5, Math.round(n / 2)) : energy === 'pumped' ? n + 5 : n;
}
const gapLabel = (g) => (g === 0 ? 'Today' : g === 1 ? 'Tomorrow' : `in ${g} days`);
const subjectName = (id) => SUBJECTS.find((s) => s.id === id)?.name.replace('Social Science', 'Social') || id;

function testSubjects(ev) {
  const fromCh = [...new Set((ev.chapters || []).map((c) => CHAPTERS[c]?.subject).filter(Boolean))];
  if (fromCh.length) return fromCh;
  const t = (ev.title || '').toLowerCase();
  return SUBJECTS.filter((s) => t.includes(s.name.toLowerCase().split(' ')[0]) || t.includes(s.id)).map((s) => s.id);
}

export function upcomingTests(F, today = ymd(), days = 30) {
  return F.events.filter((e) => e.type === 'test' && e.date >= today && daysBetween(today, e.date) <= days).sort((a, b) => a.date.localeCompare(b.date));
}

// % correct over the last 30 days on the chapters (or subjects) a test covers
export function testReadiness(F, ev, today = ymd()) {
  const chs = new Set(ev.chapters || []);
  const subs = new Set(testSubjects(ev));
  let right = 0, total = 0;
  for (const a of F.attempts) {
    if (!a.date || daysBetween(a.date, today) > 30) continue;
    for (const it of a.items || []) {
      const ok = chs.size ? chs.has(it.chapterId) : subs.size ? subs.has(CHAPTERS[it.chapterId]?.subject) : false;
      if (!ok) continue;
      total++; if (it.correct) right++;
    }
  }
  return total ? { pct: Math.round((right / total) * 100), total } : null;
}

// Tests + homework due in the next 7 days, and assigned tests
export function headsUp(F, today = ymd()) {
  const ev = F.events.filter((e) => ['test', 'homework'].includes(e.type) && e.date >= today && daysBetween(today, e.date) <= 7)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => ({ id: e.id, ev: e, title: e.title, gap: daysBetween(today, e.date), kind: e.type, chapters: e.chapters || [] }));
  return ev;
}

function inPlan(F, id) { return F.tasks.some((t) => t.fromEvent === id && t.active !== false); }

async function addToPlan(F, item, me) {
  const isTest = item.kind === 'test';
  await saveItem(F.family.id, 'tasks', {
    title: isTest ? `Revise for ${item.title}` : `Work on ${item.title}`,
    freq: 'daily', days: [], active: true, createdAt: Date.now(),
    until: item.ev.date, fromEvent: item.id, byRole: me.role, byName: me.name
  });
}

// ---------- shared bits ----------
function HeadsUpList({ F, me, list }) {
  const [busy, setBusy] = useState('');
  if (!list.length) return null;
  return (
    <div className="card j-card">
      <div className="j-h"><b>Heads up</b><span className="muted small-text">next 7 days</span></div>
      {list.map((x) => {
        const planned = inPlan(F, x.id);
        return (
          <div key={x.id} className="j-hu">
            <div className={`j-days ${x.gap <= 3 ? 'soon' : ''}`}><b>{x.gap}</b><span>{x.gap === 1 ? 'DAY' : 'DAYS'}</span></div>
            <div className="grow">
              <div>{x.title} <span className="muted small-text">· {gapLabel(x.gap)}</span></div>
              <small className="muted">{x.kind === 'test'
                ? (x.chapters.length ? `${'Ch ' + x.chapters.map((c) => CHAPTERS[c]?.no).join(' and ')} — start revising today?` : 'Start revising today?')
                : 'Break it into small steps?'}</small>
            </div>
            {planned ? <span className="j-pill ok"><Icon name="check" size={13} /> In plan</span>
              : <button className={x.gap <= 3 ? 'primary small' : 'small'} disabled={busy === x.id} onClick={async () => { setBusy(x.id); await addToPlan(F, x, me); setBusy(''); }}>{x.kind === 'test' ? 'Add to plan' : 'Plan it'}</button>}
          </div>
        );
      })}
    </div>
  );
}

function GoalHero({ F, onOpen }) {
  const today = ymd();
  const t = upcomingTests(F, today)[0];
  if (!t) return (
    <button className="j-hero calm" onClick={onOpen}>
      <div className="j-hero-txt"><b>No tests coming up</b><small>Got a test date in your diary? Add it and set a goal.</small></div>
      <Icon name="chevR" />
    </button>
  );
  const r = testReadiness(F, t, today);
  const goal = t.goalPct;
  const gap = daysBetween(today, t.date);
  const pct = r?.pct ?? 0;
  const ring = goal ? Math.min(100, Math.round((pct / goal) * 100)) : pct;
  return (
    <button className="j-hero" onClick={onOpen}>
      <svg width="52" height="52" viewBox="0 0 52 52" className="j-ring"><circle cx="26" cy="26" r="21" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="6" /><circle cx="26" cy="26" r="21" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(ring / 100) * 132} 132`} transform="rotate(-90 26 26)" /></svg>
      <div className="j-hero-txt">
        <b>{t.title} · {gap === 0 ? 'today' : gap === 1 ? 'tomorrow' : new Date(t.date).toLocaleDateString('en-IN', { weekday: 'long' })}</b>
        <small>{goal ? (r ? (pct >= goal ? `Goal ${goal}% · you’re at ${pct}% — on track!` : `Goal ${goal}% · you’re at ${pct}% — ${goal - pct} to go`) : `Goal ${goal}% · practise to see where you are`)
          : 'Tap to set your goal for this test'}</small>
      </div>
      <Icon name="chevR" />
    </button>
  );
}

// ---------- TODAY ----------
export function KidToday({ F, go }) {
  const today = ymd();
  const day = F.days[today] || {};
  const me = { role: 'student', name: F.family.studentName };
  const desktop = useDesktop();
  const [, setMode] = useHomeMode();
  const [quiz, setQuiz] = useState(null);
  const [study, setStudy] = useState(null);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const streak = currentStreak(F.days, today);
  const energy = day.energy || '';
  const count = energyCount(F, energy);
  const fix = openFixits(F, today).length;
  const due = dueChapters(F.chapters, today).length;
  const todays = todaysChapterIds(F, today);
  const hu = headsUp(F, today);
  const latestNote = F.notes[0] && Date.now() - F.notes[0].at < 3 * 86400000 ? F.notes[0] : null;

  const run = async (builder) => {
    setBusy(true);
    try {
      const q = await builder();
      if (q.empty || !q.questions.length) { if (q.onDone) await q.onDone(); alert(q.kind === 'revise' ? 'Nothing to fix right now — nice!' : 'No questions yet for these chapters. Log a class first.'); }
      else setQuiz(q);
    } finally { setBusy(false); }
  };

  const steps = [
    { key: 'logDone', title: 'Capture my day', sub: (day.logs || []).length ? `${(day.logs || []).length} class${(day.logs || []).length > 1 ? 'es' : ''} · ${(day.logs || []).map((l) => subjectName(l.subject)).join(', ')}` : day.noTeaching ? 'No class today — logged' : 'Diary, classes, sport — 1 min', go: () => go('capture') },
    { key: 'homework', title: 'Homework', sub: day.homework ? 'Done' : 'Tick when finished', go: () => markStep(F, 'homework', !day.homework) },
    { key: 'learnDone', title: todays.length ? 'Study today’s chapter' : 'Study a chapter', sub: todays.length ? `${todays.map((id) => chapterTitle(F, id)).slice(0, 2).join(' · ')}` : 'Short cards · about 10 min', go: () => setStudy(todays.length ? todays : recentTaughtIds(F, 1)) },
    { key: 'practiceDone', title: `Practice · ${count} questions`, sub: todays.length ? 'On today’s lessons' : 'On your recent chapters', go: () => run(() => buildPractice(F, count)) },
    { key: 'reviseDone', title: fix ? `Fix ${Math.min(fix, F.settings.mistakesPerRevise)} mistake${fix > 1 ? 's' : ''}` : 'Revise', sub: `${fix} fix-it${fix === 1 ? '' : 's'} · ${due} chapter${due === 1 ? '' : 's'} due`, go: () => run(() => buildRevise(F)) }
  ];
  const doneN = steps.filter((s) => day[s.key]).length;
  const next = steps.find((s) => !day[s.key]);

  if (quiz) return <QuizRunner title={quiz.title} questions={quiz.questions} onCancel={() => setQuiz(null)}
    onFinish={async (res) => { await recordQuiz(F, quiz.kind, res, quiz.extra); if (quiz.onDone) await quiz.onDone(); setQuiz(null); }} />;
  if (study) return <StudyCards F={F} chapters={study} onClose={() => setStudy(null)} />;

  const journey = (
    <div className="card j-card">
      <div className="j-h"><b>Today’s journey</b><span className="muted small-text">{doneN === 5 ? 'All done — free time!' : `${doneN} of 5 · then free time`}</span></div>
      {steps.map((s, i) => {
        const done = !!day[s.key];
        const isNext = next && next.key === s.key;
        return (
          <div key={s.key} className={`j-step ${done ? 'done' : ''} ${isNext ? 'next' : ''}`} onClick={done || s.key === 'homework' ? undefined : s.go} role="button">
            {done ? <MissionCheck done label={s.title} onToggle={() => markStep(F, s.key, false)} className="j-num ok" />
              : s.key === 'homework' ? <MissionCheck done={false} label={s.title} onToggle={() => markStep(F, 'homework', true)} className="j-num" />
              : <span className="j-num">{i + 1}</span>}
            <div className="grow"><div className="j-t">{s.title}</div><small className="muted">{s.sub}</small></div>
            {isNext && s.key !== 'homework' && <button className="primary small" disabled={busy} onClick={(e) => { e.stopPropagation(); s.go(); }}>Go</button>}
          </div>
        );
      })}
    </div>
  );

  const trophies = <TrophyCard F={F} go={go} />;
  const more = (
    <div className="j-more">
      {[['planner', 'calendar', 'Plan my day', () => go('planner', 'day')], ['explore', 'bulb', 'Explore', () => go('explore')], ['sports', 'trophy', 'Sports', () => go('sports')], ['wallet', 'wallet', 'Money', () => go('finance')]].map(([k, ic, l, fn]) => (
        <button key={k} onClick={fn}><Icon name={ic} size={20} /><span>{l}</span></button>
      ))}
    </div>
  );

  return (
    <div className="j-page">
      <div className="j-top">
        <div><small className="muted">Hey {firstName(F)}</small><h1>How’s your energy?</h1></div>
        <button className="j-streak" onClick={() => go('badges')}><Icon name="flame" size={15} /> {streak}</button>
      </div>
      <div className="seg j-energy">{ENERGY.map(([k, l]) => <button key={k} className={energy === k ? 'on' : ''} onClick={() => setDay(F.family.id, today, { energy: k })}>{l}</button>)}</div>
      {energy && <p className="muted small-text j-energy-tip">{energy === 'tired' ? `Short day: ${count} practice questions. Rest well tonight.` : energy === 'pumped' ? `Let’s go — ${count} questions today. Try a bonus Explore session after.` : `Normal day: ${count} practice questions.`}</p>}

      {latestNote && <div className="note j-note"><b>{latestNote.from}</b><div className="small-text">{latestNote.text}</div></div>}

      <div className={desktop ? 'j-grid' : ''}>
        <div>
          <GoalHero F={F} onOpen={() => setModal('goal')} />
          {journey}
          {!desktop && <HeadsUpList F={F} me={me} list={hu} />}
          {!desktop && trophies}
        </div>
        {desktop && <div>
          <HeadsUpList F={F} me={me} list={hu} />
          {trophies}
          {more}
        </div>}
      </div>
      {!desktop && more}
      <button className="ghost small j-classic" onClick={() => setMode('classic')}>Switch to the classic home</button>
      {modal === 'goal' && <TestGoalModal F={F} me={me} onClose={() => setModal(null)} onPractice={async (ev) => { setModal(null); const pool = await questionPool(ev.chapters || []); const qs = pickQuestions(pool, count); if (qs.length) setQuiz({ kind: 'practice', title: `Practice for ${ev.title}`, questions: qs }); else alert('No questions for these chapters yet.'); }} />}
    </div>
  );
}

function TrophyCard({ F, go }) {
  const list = [...(F.achievements || [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 2);
  return (
    <button className="card j-card j-trophy" onClick={() => go('sports', 'achievements')}>
      <span className="j-medals"><span className="m1"><Icon name="trophy" size={17} /></span><span className="m2"><Icon name="gift" size={17} /></span></span>
      <div className="grow"><div className="j-t">My trophy room</div><small className="muted">{list.length ? list.map((a) => a.title).join(' · ') : 'Sports, competitions, prizes — add your first'}</small></div>
      <Icon name="chevR" />
    </button>
  );
}

// ---------- TEST GOAL ----------
export function TestGoalModal({ F, me, onClose, onPractice }) {
  const today = ymd();
  const tests = upcomingTests(F, today, 60);
  const [id, setId] = useState(tests[0]?.id || '');
  const ev = tests.find((t) => t.id === id);
  const [goal, setGoal] = useState(ev?.goalPct || 80);
  const [newEv, setNewEv] = useState(false);
  useEffect(() => { if (ev) setGoal(ev.goalPct || 80); }, [id]);
  if (newEv) return <EventModal F={F} me={me} ev={{ type: 'test', date: addDays(today, 7), title: '', remind: [1, 0], chapters: [] }} onClose={() => setNewEv(false)} />;
  const r = ev ? testReadiness(F, ev, today) : null;
  const gap = ev ? daysBetween(today, ev.date) : 0;
  const need = r ? goal - r.pct : null;
  return (
    <Modal title="My test goal" onClose={onClose}>
      {!tests.length ? <div className="stack">
        <p className="muted">No tests in your calendar yet. Check your school diary and add the next one.</p>
        <button className="primary" onClick={() => setNewEv(true)}>Add a test</button>
      </div> : <div className="stack">
        {tests.length > 1 && <div className="chips">{tests.map((t) => <button key={t.id} className={`small ${t.id === id ? 'primary' : ''}`} onClick={() => setId(t.id)}>{t.title}</button>)}</div>}
        <div className="j-goal-head">
          <b>{ev.title}</b>
          <small className="muted">{gapLabel(gap)}{ev.chapters?.length ? ` · ${subjectName(CHAPTERS[ev.chapters[0]]?.subject)} Ch ${ev.chapters.map((c) => CHAPTERS[c]?.no).join(', ')}` : ''}</small>
        </div>
        <div className="j-goal-big"><span>{goal}%</span><small className="muted">What do you want to score?</small></div>
        <input type="range" min="40" max="100" step="5" value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
        <div className="j-goal-row">
          <div><small className="muted">Where you are now</small><b>{r ? `${r.pct}%` : '—'}</b><small className="muted">{r ? `from ${r.total} questions` : 'no practice yet'}</small></div>
          <div><small className="muted">To go</small><b>{r ? (need > 0 ? `${need}%` : 'On track') : '—'}</b><small className="muted">{gap} day{gap === 1 ? '' : 's'} left</small></div>
        </div>
        {r && need > 0 && <p className="small-text muted" style={{ margin: 0 }}>About {Math.max(1, Math.ceil(need / Math.max(1, gap)))}% better each day. Practise the test chapters and clear your fix-its.</p>}
        {!ev.chapters?.length && <p className="small-text muted" style={{ margin: 0 }}>Tip: add the test chapters (edit the test in the calendar) so practice focuses on them.</p>}
        <button className="primary" onClick={async () => { await saveEvent(F.family.id, { ...ev, goalPct: goal }); onClose(); }}>Save my goal</button>
        {ev.chapters?.length > 0 && <button onClick={() => onPractice(ev)}>Practise these chapters now</button>}
      </div>}
    </Modal>
  );
}

// ---------- STUDY CARDS ----------
export function StudyCards({ F, chapters, onClose }) {
  const [list, setList] = useState(chapters || []);
  const [cards, setCards] = useState(null);
  const [i, setI] = useState(0);
  const [example, setExample] = useState(false);
  const [quiz, setQuiz] = useState(null);
  const [subject, setSubject] = useState('');
  useEffect(() => {
    let live = true;
    Promise.all(list.map(async (id) => [id, await loadChapter(id)])).then((pairs) => {
      if (!live) return;
      setCards(pairs.flatMap(([id, p]) => (p?.explainer || []).map((e) => ({ ...e, id }))));
      setI(0);
    });
    return () => { live = false; };
  }, [list.join()]);
  const today = ymd();
  const finishLearn = () => markStep(F, 'learnDone');
  if (quiz) return <QuizRunner title="Quick check" questions={quiz} onCancel={() => setQuiz(null)}
    onFinish={async (res) => { await recordQuiz(F, 'practice', res, { title: 'Study check' }); await finishLearn(); onClose(); }} />;

  const c = cards?.[i];
  const end = cards && i >= cards.length;
  const say = (t) => { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(t)); } catch {} };
  const doubt = async () => {
    const d = F.days[today] || {};
    await setDay(F.family.id, today, { doubts: [...(d.doubts || []), { chapterId: c.id, heading: c.heading, at: Date.now() }] });
    alert('Saved — ask Appa or your teacher about it.');
  };

  return (
    <div className="j-study">
      <div className="j-study-top">
        <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="chevL" /></button>
        <div className="grow">
          <small className="muted">{c ? `${subjectName(CHAPTERS[c.id]?.subject)} · ${list.length > 1 ? 'today' : 'chapter'}`.toUpperCase() : 'STUDY'}</small>
          <h2>{c ? chapterTitle(F, c.id) : 'Study'}</h2>
        </div>
        {cards?.length > 0 && <span className="muted">{Math.min(i + 1, cards.length)} / {cards.length}</span>}
      </div>
      {cards?.length > 0 && <div className="j-seg">{cards.map((_, k) => <span key={k} className={k <= i ? 'on' : ''} />)}</div>}

      {cards === null && <p className="muted">Loading…</p>}
      {cards && !cards.length && <div className="card j-card">
        <p>No study cards for {list.length ? 'this chapter' : 'today'} yet. Pick another chapter, or read the textbook pages and your notes.</p>
        <select value={subject} onChange={(e) => setSubject(e.target.value)}><option value="">Subject…</option>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        {subject && <div className="chips" style={{ marginTop: 8 }}>{Object.values(CHAPTERS).filter((ch) => ch.subject === subject).map((ch) => <button key={ch.id} className="small" onClick={() => setList([ch.id])}>{chapterLabel(ch.id)}</button>)}</div>}
        <button className="primary" style={{ width: '100%', marginTop: 12 }} onClick={async () => { await finishLearn(); onClose(); }}>I studied from the book ✓</button>
      </div>}

      {c && <>
        <div className="card j-card j-learn">
          <span className="j-tag">{c.heading}</span>
          <p className="j-body">{c.body}</p>
          {example && c.example && <p className="j-ex">🌍 {c.example}</p>}
          {c.hook && <div className="j-hook"><small>REMEMBER IT</small><div>{c.hook}</div></div>}
          <button className="ghost small j-listen" onClick={() => say(`${c.heading}. ${c.body}${c.hook ? '. ' + c.hook : ''}`)}>🔈 Listen</button>
        </div>
        <div className="j-two">
          <button disabled={!c.example || example} onClick={() => setExample(true)}>{c.example ? 'Explain again' : 'No example'}</button>
          <button className="primary" onClick={() => { setExample(false); setI(i + 1); }}>Got it →</button>
        </div>
        <p className="muted small-text" style={{ textAlign: 'center' }}>{cards.length - i - 1 > 0 ? `${cards.length - i - 1} more card${cards.length - i - 1 > 1 ? 's' : ''} · then a 5-question check` : 'Last card · then a 5-question check'}</p>
        <div className="card j-card j-doubt"><span className="grow small-text">Something not clear? Ask Appa / your teacher</span><button className="small" onClick={doubt}>Note doubt</button></div>
      </>}

      {end && cards.length > 0 && <div className="card j-card" style={{ textAlign: 'center' }}>
        <h3 style={{ marginTop: 0 }}>Nice — all {cards.length} cards done</h3>
        <p className="muted">A quick 5-question check locks it in.</p>
        <button className="primary" style={{ width: '100%' }} onClick={async () => { const qs = pickQuestions(await questionPool(list), 5); if (qs.length) setQuiz(qs); else { await finishLearn(); onClose(); } }}>Start the check</button>
        <button className="ghost" style={{ width: '100%', marginTop: 8 }} onClick={async () => { await finishLearn(); onClose(); }}>Skip for now</button>
      </div>}
    </div>
  );
}

// ---------- CAPTURE MY DAY ----------
export function CapturePage({ F, me, go }) {
  const today = ymd();
  const day = F.days[today] || {};
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const diary = day.diary;
  const logged = new Map((day.logs || []).map((l) => [l.subject, l]));
  const noneSubs = day.noTeaching ? (day.noTeaching.subjects?.length ? day.noTeaching.subjects : SUBJECTS.map((s) => s.id)) : [];
  const hu = headsUp(F, today);
  const sportToday = (F.sports || []).filter((s) => s.date === today);
  const snap = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const id = await savePhoto(F.family.id, file);
      await setDay(F.family.id, today, { diary: { ...(diary || {}), photos: [...(diary?.photos || []), id], none: false, at: Date.now() } });
    } catch (e) { alert('Could not save the photo: ' + (e?.message || e)); }
    setBusy(false);
  };
  const plan = day.planAsk;
  const tomorrow = addDays(today, 1);
  const canFinish = (day.logs || []).length || day.noTeaching;

  return (
    <div className="j-page">
      <PageHead title="Capture my day" onBack={() => go('home')} right={<span className="muted small-text">1 min</span>} />

      <div className="card j-card">
        <div className="j-sec"><span className={`j-num ${diary ? 'ok' : ''}`}>{diary ? <Icon name="check" size={14} /> : 1}</span><div><div className="j-t">Check your school diary</div><small className="muted">New test date, homework, PTM, event?</small></div></div>
        {diary?.photos?.length > 0 && <div className="j-thumbs">{diary.photos.map((p) => <Photo key={p} fid={F.family.id} id={p} />)}</div>}
        <div className="j-chips">
          <label className={`button small ${diary ? '' : 'primary'}`}>{busy ? 'Saving…' : diary?.photos?.length ? 'Snap another page' : 'Snap diary page'}<input type="file" accept="image/*" capture="environment" hidden onChange={(e) => snap(e.target.files[0])} /></label>
          <button className="small" onClick={() => setModal({ t: 'event', ev: { type: 'homework', date: tomorrow, title: '', remind: [1], chapters: [] } })}>Add to calendar</button>
          {!diary && <button className="small ghost-b" onClick={() => setDay(F.family.id, today, { diary: { none: true, at: Date.now() } })}>Nothing new</button>}
          {diary?.none && <span className="j-pill ok"><Icon name="check" size={13} /> Nothing new</span>}
        </div>
      </div>

      <div className="j-sec out"><span className="j-num dark">2</span><div className="j-t">What happened in class?</div></div>
      <div className="j-subjects">
        {SUBJECTS.map((s) => {
          const l = logged.get(s.id);
          const none = !l && noneSubs.includes(s.id);
          return (
            <button key={s.id} className={l ? 'on' : none ? 'none' : ''} onClick={() => setModal({ t: 'log', subject: s.id })}>
              <span>{subjectName(s.id)}</span>
              <small>{l ? (l.chapterId ? `Ch ${CHAPTERS[l.chapterId]?.no || ''}` : 'logged') : none ? 'no class' : 'tap'}</small>
            </button>
          );
        })}
      </div>
      <div className="j-row3">
        <button onClick={() => setModal({ t: 'log' })}><Icon name="camera" size={17} /> Notes / photo</button>
        <button onClick={() => setModal({ t: 'none' })}>No class today</button>
      </div>
      <div className="j-row2">
        <button className={sportToday.length ? 'on' : ''} onClick={() => setModal({ t: 'sport' })}>
          <Icon name="trophy" size={18} /><div><div>{sportToday.length ? 'Sport logged' : 'Sport today?'}</div><small className="muted">{sportToday.length ? `${sportToday.reduce((a, s) => a + Number(s.minutes || 0), 0)} min` : 'class, practice or match'}</small></div>
        </button>
        <button onClick={() => setModal({ t: 'achv' })}>
          <Icon name="gift" size={18} /><div><div>I won something</div><small className="muted">add to trophies</small></div>
        </button>
      </div>

      <HeadsUpList F={F} me={me} list={hu} />

      {plan !== 'skip' && plan !== 'done' && <div className="card j-card j-soft">
        <div className="j-t">Anything you want to plan or track? <small className="muted">optional</small></div>
        <div className="j-chips">
          <button className="small" onClick={() => setModal({ t: 'event', ev: { type: 'homework', date: tomorrow, title: '', remind: [0], chapters: [] }, after: 'done' })}>Homework due tomorrow</button>
          <button className="small" onClick={() => setModal({ t: 'event', ev: { type: 'homework', date: addDays(today, 7), title: '', remind: [2, 1], chapters: [] }, after: 'done' })}>A new assignment</button>
          <button className="small" onClick={() => setModal({ t: 'task', after: 'done' })}>Something else</button>
          <button className="small ghost-b" onClick={() => setDay(F.family.id, today, { planAsk: 'skip' })}>Not today</button>
        </div>
      </div>}

      <button className="primary j-done" disabled={!canFinish} onClick={() => go('home')}>{canFinish ? 'Done · next: Study' : 'Log a class (or “No class today”) to finish'}</button>

      {modal?.t === 'log' && <LogModal F={F} go={go} initialSubject={modal.subject || ''} onClose={() => setModal(null)} />}
      {modal?.t === 'none' && <LogModal F={F} go={go} initialMode="none" onClose={() => setModal(null)} />}
      {modal?.t === 'event' && <EventModal F={F} me={me} ev={modal.ev} onClose={() => { if (modal.after) setDay(F.family.id, today, { planAsk: modal.after }); setModal(null); }} />}
      {modal?.t === 'task' && <TaskModal F={F} me={me} task={{ freq: 'daily', title: '', days: [] }} onClose={() => { setDay(F.family.id, today, { planAsk: 'done' }); setModal(null); }} />}
      {modal?.t === 'sport' && <SportLogModal F={F} me={me} entry={{ type: 'class', sport: (F.family?.sports || [])[0]?.id || 'cricket', date: today, minutes: 60, attended: true }} onClose={() => setModal(null)} />}
      {modal?.t === 'achv' && <AchievementModal F={F} me={me} entry={{ where: 'school', category: 'sports', result: 'gold', date: today }} onClose={() => setModal(null)} />}
    </div>
  );
}

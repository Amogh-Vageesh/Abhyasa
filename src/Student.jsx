import { useEffect, useMemo, useState } from 'react';
import { set as idbSet, get as idbGet } from 'idb-keyval';
import { Card, ChapterPicker, Modal, QuizRunner, Progress, rupees, PageHead } from './components';
import { Icon, Tile, Avatar, HeroArt } from './icons';
import { TodayPlanCard } from './Planner';
import { useInsights, InsightRow } from './Insights';
import { SubjectGrid, SubjectDetail } from './Subjects';
import { saveItem } from './lib/data';
import { periodKey, taskAppliesOn } from './lib/logic';
import { SUBJECTS } from './lib/syllabus';
import { STEPS, markStep, logClass, recordQuiz } from './lib/actions';
import { loadChapter, questionPool, questionsById, setChapter, setMistake, saveTest } from './lib/data';
import {
  addDays, currentStreak, daysBetween, dueChapters, isWeekend, pickQuestions, testWeights, walletSummary, ymd
} from './lib/logic';
import { CHAPTERS, chapterLabel } from './lib/syllabus';

export function StudentToday({ F, go }) {
  const today = ymd();
  const day = F.days[today] || {};
  const [modal, setModal] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const streak = currentStreak(F.days, today);
  const doneCount = STEPS.filter((s) => day[s.key]).length;
  const todaysChapters = [...new Set((day.logs || []).map((l) => l.chapterId).filter(Boolean))];
  const latestNote = F.notes[0] && Date.now() - F.notes[0].at < 3 * 86400000 ? F.notes[0] : null;
  const upcoming = F.events.filter((e) => e.date >= today && daysBetween(today, e.date) <= 7);
  const assigned = F.tests.filter((t) => t.assigned && !t.doneAt);
  const { balance } = walletSummary(F.wallet);

  const startPractice = async () => {
    let chIds = todaysChapters;
    if (!chIds.length) chIds = Object.values(F.chapters).filter((c) => c.taughtOn).sort((a, b) => (b.lastTaught || '').localeCompare(a.lastTaught || '')).slice(0, 3).map((c) => c.id);
    const pool = await questionPool(chIds);
    const recent = new Set(F.attempts.filter((a) => a.date === today).flatMap((a) => a.items.map((x) => x.qid)));
    const qs = pickQuestions(pool, F.settings.practiceCount, { exclude: recent, weights: testWeights(F.events, today) });
    setQuiz({ kind: 'practice', title: 'Practice', questions: qs, chIds, onDone: () => markStep(F, 'practiceDone') });
  };

  const startRevise = async () => {
    const due = dueChapters(F.chapters, today);
    const pool = await questionPool(due.map((d) => d.id));
    const qs = pickQuestions(pool, F.settings.reviseCount, { weights: testWeights(F.events, today) });
    const open = F.mistakes.filter((m) => !m.resolved && !m.manual && m.lastRightDate !== today)
      .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0)).slice(0, F.settings.mistakesPerRevise);
    const mq = [
      ...(await questionsById(open.filter((m) => !m.q).map((m) => m.id))).map((q) => ({ ...q, chapterId: q.chapterId || q.id.replace(/-q\d+$/, '') })),
      ...open.filter((m) => m.q).map((m) => m.q)
    ];
    const all = [...mq, ...qs.filter((q) => !mq.some((m) => m.id === q.id))];
    const finish = async () => {
      for (const d of due) {
        const ch = F.chapters[d.id];
        await setChapter(F.family.id, d.id, { reviewsDone: [...(ch.reviewsDone || []), ...d.pending], lastRevised: today, status: ch.status === 'taught' ? 'revised' : ch.status });
      }
      await markStep(F, 'reviseDone');
    };
    if (!all.length) { await finish(); return; }
    setQuiz({ kind: 'revise', title: 'Revise + Mistakes', questions: all, onDone: finish });
  };

  const startWeekly = async () => {
    const taught = Object.values(F.chapters).filter((c) => c.taughtOn);
    const week = taught.filter((c) => daysBetween(c.lastTaught || c.taughtOn, today) <= 7).map((c) => c.id);
    const older = taught.filter((c) => !week.includes(c.id)).map((c) => c.id);
    const n = F.settings.weeklyTestCount;
    const weights = { ...Object.fromEntries(week.map((id) => [id, 3])), ...testWeights(F.events, today) };
    const pool = await questionPool([...week, ...older]);
    const qs = pickQuestions(pool, n, { weights });
    setQuiz({ kind: 'test', title: 'Weekly test', questions: qs, extra: { title: `Weekly test ${today}` } });
  };

  const startAssigned = (t) => {
    if (t.kind === 'paper') { setModal({ type: 'paper', test: t }); return; }
    setQuiz({ kind: 'imported', title: t.title, questions: t.questions.map((q) => ({ ...q, id: `${t.id}-${q.id}`, imported: true, chapterId: t.chapterId || null })), extra: { title: t.title, testId: t.id }, onDone: () => saveTest(F.family.id, { id: t.id, doneAt: Date.now() }) });
  };

  if (quiz) {
    return <QuizRunner title={quiz.title} questions={quiz.questions} onCancel={() => setQuiz(null)}
      onFinish={async (res) => { await recordQuiz(F, quiz.kind, res, quiz.extra); if (quiz.onDone) await quiz.onDone(); setQuiz(null); }} />;
  }

  const greet = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const due = dueChapters(F.chapters, today);
  const openMistakes = F.mistakes.filter((m) => !m.resolved).length;
  const loggedSubjects = new Set((day.logs || []).map((l) => l.subject || CHAPTERS[l.chapterId]?.subject).filter(Boolean));
  const insights = useInsights(F);
  const todayTasks = F.tasks.filter((t) => t.active !== false && taskAppliesOn(t, today))
    .sort((a, b) => ['daily', 'weekly', 'monthly'].indexOf(a.freq) - ['daily', 'weekly', 'monthly'].indexOf(b.freq));
  const routine = [
    { ...STEPS[0], icon: 'edit', tone: 'blue', done: day.logDone,
      sub: (day.logs || []).length ? (day.logs || []).map((l) => l.chapterId ? chapterLabel(l.chapterId) : l.subjectName).join(' · ') : 'Subject, chapter, pages — speak or snap a photo',
      run: () => setModal({ type: 'log' }) },
    { ...STEPS[1], icon: 'notebook', tone: 'purple', done: day.homework, sub: day.homework ? 'Tap to undo' : 'Tick when finished', run: () => markStep(F, 'homework', !day.homework) },
    { ...STEPS[2], icon: 'bulb', tone: 'amber', done: day.learnDone, sub: todaysChapters.length ? `${todaysChapters.length} chapter(s) from today` : 'Pick any chapter', run: () => setModal({ type: 'learn', chapters: todaysChapters }) },
    { ...STEPS[3], icon: 'target', tone: 'green', done: day.practiceDone, sub: `${F.settings.practiceCount} questions on today’s lessons`, run: startPractice },
    { ...STEPS[4], icon: 'repeat', tone: 'teal', done: day.reviseDone, sub: `${due.length} chapter(s) due · ${openMistakes} mistakes open`, run: startRevise }
  ];

  return (
    <div>
      <div className="hero">
        <div className="hero-txt">
          <span>{greet}</span>
          <h1>{F.family.studentName?.split(' ')[0]} 👋</h1>
          <small>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</small>
        </div>
        <HeroArt />
      </div>

      <button className="summary" onClick={() => document.getElementById('routine')?.scrollIntoView({ behavior: 'smooth' })}>
        <Tile icon="target" tone="amber" size={52} />
        <div className="summary-main">
          <small>Today’s routine</small>
          <b>{doneCount === 5 ? 'All done! 🎉' : `${doneCount} of 5 done`}</b>
          <Progress value={doneCount} max={5} color="linear-gradient(90deg, var(--accent-a), var(--accent-b))" />
        </div>
        <div className="delta">🔥 {streak}<span>day streak</span></div>
      </button>

      <div className="stats">
        <button className="stat" style={{ '--tc': '#e5484d' }} onClick={() => go('study', 'mistakes')}><Tile icon="mistake" tone="red" /><small>Mistakes</small><b>{openMistakes} open</b></button>
        <button className="stat" style={{ '--tc': '#1f9d55' }} onClick={() => go('wallet')}><Tile icon="wallet" tone="green" /><small>Wallet</small><b>{rupees(balance)}</b></button>
        <button className="stat" style={{ '--tc': '#2f7fe0' }} onClick={startRevise}><Tile icon="repeat" tone="blue" /><small>Revision</small><b>{due.length} due</b></button>
      </div>

      {latestNote && <div className="note"><Avatar name={latestNote.from} tone="purple" size={34} /><div><b>{latestNote.from}</b><div className="small-text">{latestNote.text}</div></div></div>}

      <div className="sec-h"><h2>Today’s Classes</h2><span className="muted small-text">{loggedSubjects.size} logged</span></div>
      <div className="classes">
        {SUBJECTS.map((sj) => (
          <button key={sj.id} className={loggedSubjects.has(sj.id) ? 'logged' : ''} onClick={() => setModal({ type: 'log', subject: sj.id })}>
            {loggedSubjects.has(sj.id) && <span className="tick"><Icon name="check" size={12} /></span>}
            <Tile icon="book" tone={sj.color} />{sj.name.replace('Social Science', 'Social').replace('Other / 2nd Language', '2nd Lang')}
          </button>
        ))}
      </div>

      <div className="sec-h" id="routine"><h2>Today’s Routine</h2><span className="muted small-text">{doneCount}/5</span></div>
      <div className="card list">
        {routine.map((r) => (
          <button key={r.key} className={`lrow ${r.done ? 'done' : ''}`} onClick={r.run}>
            <Tile icon={r.icon} tone={r.tone} />
            <div className="lt"><b>{r.label}</b><small>{r.sub}</small></div>
            <span className={`check-circle ${r.done ? 'on' : ''}`}>{r.done && <Icon name="check" size={16} />}</span>
          </button>
        ))}
        {!day.logDone && <button className="lrow" onClick={() => markStep(F, 'logDone')}><Tile icon="calendar" tone="gray" /><div className="lt"><b>No school today</b><small>Holiday or weekend — skip logging</small></div><Icon name="chevR" className="chev" /></button>}
      </div>

      <div className="sec-h"><h2>My Plan</h2><button className="link" onClick={() => go('planner', 'timetable')}>Timetable <Icon name="chevR" size={16} /></button></div>
      <TodayPlanCard F={F} go={go} />

      <div className="sec-h"><h2>Today’s Tasks</h2><button className="link" onClick={() => go('planner', 'tasks')}>All tasks <Icon name="chevR" size={16} /></button></div>
      <div className="card list">
        {!todayTasks.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No tasks for today. Add daily, weekly and monthly tasks in Planner.</div>}
        {todayTasks.slice(0, 5).map((t) => { const k = periodKey(t.freq, today); const d = !!t.done?.[k]; return (
          <button key={t.id} className={`lrow ${d ? 'done' : ''}`} onClick={() => saveItem(F.family.id, 'tasks', { id: t.id, done: { ...(t.done || {}), [k]: d ? null : Date.now() } })}>
            <span className={`check-circle ${d ? 'on' : ''}`}>{d && <Icon name="check" size={16} />}</span>
            <div className="lt"><b>{t.title}</b><small>{t.freq === 'daily' ? 'Today' : t.freq === 'weekly' ? 'This week' : 'This month'}{t.byRole === 'parent' ? ` · from ${t.byName || 'parent'}` : ''}</small></div>
          </button>
        ); })}
      </div>


      {(assigned.length > 0 || isWeekend(today)) && <>
        <div className="sec-h"><h2>Tests for you</h2></div>
        <div className="card list">
          {isWeekend(today) && <button className="lrow" onClick={startWeekly}><Tile icon="trophy" tone="amber" /><div className="lt"><b>Weekly test</b><small>{F.settings.weeklyTestCount} questions · this week’s chapters + mistakes</small></div><Icon name="chevR" className="chev" /></button>}
          {assigned.map((t) => (
            <button key={t.id} className="lrow" onClick={() => startAssigned(t)}>
              <Tile icon="file" tone="purple" />
              <div className="lt"><b>{t.title}</b><small>{t.kind === 'paper' ? `Paper test · ${t.totalMarks || '?'} marks` : `${t.questions?.length || 0} questions`}</small></div>
              <Icon name="chevR" className="chev" />
            </button>
          ))}
        </div>
      </>}

      <div className="sec-h"><h2>Coming up</h2><button className="link" onClick={() => go('calendar')}>See all <Icon name="chevR" size={16} /></button></div>
      <div className="card list">
        {!upcoming.length && <div className="muted small-text" style={{ padding: '12px 0' }}>Nothing in the next 7 days.</div>}
        {upcoming.map((e) => {
          const gap = daysBetween(today, e.date);
          return (
            <button key={e.id} className="lrow" onClick={() => go('calendar')}>
              <div className={`event-date ${e.type === 'test' ? 'test' : ''}`} style={e.type === 'test' ? { background: 'color-mix(in srgb, var(--bad) 15%, transparent)', color: 'var(--bad)' } : {}}><b>{Number(e.date.slice(8))}</b><span>{new Date(e.date).toLocaleString('en-IN', { month: 'short' })}</span></div>
              <div className="lt"><b>{e.title}</b><small>{gap === 0 ? 'Today' : gap === 1 ? 'Tomorrow' : `In ${gap} days`}{e.time ? ` · ${e.time}` : ''}</small></div>
              <Icon name="chevR" className="chev" />
            </button>
          );
        })}
      </div>

      {insights[0] && <>
        <div className="sec-h"><h2>Insight</h2><button className="link" onClick={() => go('insights')}>More tips <Icon name="chevR" size={16} /></button></div>
        <div className="card list"><InsightRow i={insights[0]} onClick={() => go('insights')} /></div>
      </>}

      {modal?.type === 'log' && <LogModal F={F} initialSubject={modal.subject || ''} onClose={() => setModal(null)} />}
      {modal?.type === 'learn' && <LearnModal F={F} chapters={modal.chapters} onClose={() => setModal(null)} />}
      {modal?.type === 'paper' && <PaperTestModal F={F} test={modal.test} onClose={() => setModal(null)} />}
    </div>
  );
}

function Step({ s, done, detail, action }) {
  return (
    <div className={`step ${done ? 'done' : ''}`}>
      <div className="step-icon">{done ? '✅' : s.icon}</div>
      <div className="step-body"><b>{s.label}</b>{detail && <div className="muted small-text">{detail}</div>}</div>
      <div>{action}</div>
    </div>
  );
}

export function LogModal({ F, onClose, initialSubject = '' }) {
  const [subject, setSubject] = useState(initialSubject);
  const [chapterId, setChapterId] = useState('');
  const [pages, setPages] = useState('');
  const [note, setNote] = useState('');
  const [doubt, setDoubt] = useState(false);
  const [photos, setPhotos] = useState([]);
  const save = async () => {
    const photoKeys = [];
    for (const f of photos) {
      const key = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      await idbSet(key, f);
      photoKeys.push(key);
    }
    await logClass(F, { subject, subjectName: SUBJECTS.find((x) => x.id === subject)?.name || subject, chapterId: chapterId || null, pages, note, doubt, photoKeys });
    onClose();
  };
  return (
    <Modal title="What was taught today?" onClose={onClose}>
      <div className="stack">
        <ChapterPicker subject={subject} onSubject={setSubject} value={chapterId} onChange={setChapterId} />
        <input placeholder="Pages (e.g. 45–52)" value={pages} onChange={(e) => setPages(e.target.value)} />
        <textarea rows={3} placeholder="What did the teacher explain? Tip: tap the 🎤 mic on your keyboard and just speak." value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="check"><input type="checkbox" checked={doubt} onChange={(e) => setDoubt(e.target.checked)} /> I didn’t understand something</label>
        <label className="file-btn">📷 Add photos of book / notes ({photos.length})
          <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => setPhotos([...photos, ...e.target.files])} />
        </label>
        <p className="muted small-text">Photos stay on this device.</p>
        <button className="primary" disabled={!subject} onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

export function LearnModal({ F, chapters, onClose }) {
  const [subject, setSubject] = useState('');
  const [pick, setPick] = useState('');
  const [list, setList] = useState(chapters);
  const [packs, setPacks] = useState({});
  useEffect(() => { Promise.all(list.map(async (id) => [id, await loadChapter(id)])).then((e) => setPacks(Object.fromEntries(e))); }, [list.join()]);
  return (
    <Modal title="Learn" onClose={onClose}>
      {!list.length && <p className="muted">No classes logged today — pick a chapter to study.</p>}
      <div className="row wrap"><ChapterPicker subject={subject} onSubject={setSubject} value={pick} onChange={(v) => { setPick(v); if (v && !list.includes(v)) setList([...list, v]); }} /></div>
      {list.map((id) => {
        const p = packs[id];
        return (
          <div key={id} className="learn">
            <h4>{chapterLabel(id)}</h4>
            {p === undefined && <p className="muted">Loading…</p>}
            {p === null && <p className="muted">Study material for this chapter isn’t in the pack yet. Read the textbook pages and your notes, then mark done.</p>}
            {p?.explainer?.map((e, i) => (
              <div key={i} className="explain">
                <b>{e.heading}</b><p>{e.body}</p>
                {e.example && <p>🌍 <i>{e.example}</i></p>}
                {e.hook && <p className="hook">🧠 {e.hook}</p>}
              </div>
            ))}
          </div>
        );
      })}
      <button className="primary" onClick={async () => { await markStep(F, 'learnDone'); onClose(); }}>I’ve learned it ✓</button>
    </Modal>
  );
}

function PaperTestModal({ F, test, onClose }) {
  const [score, setScore] = useState('');
  const [wrong, setWrong] = useState('');
  const save = async () => {
    const total = Number(test.totalMarks) || 0;
    const s = Number(score) || 0;
    const wrongList = wrong.split(/[,\s]+/).filter(Boolean);
    const items = wrongList.map((n) => ({ qid: `${test.id}-p${n}`, chapterId: test.chapterId || null, correct: false }));
    await recordQuiz(F, 'imported', { items: [], score: s, total }, { title: test.title, testId: test.id, paper: true });
    for (const it of items) await setMistake(F.family.id, it.qid, { qid: it.qid, chapterId: it.chapterId, manual: true, text: `${test.title} — Q${it.qid.split('-p').pop()}`, wrongCount: 1, resolved: false });
    await saveTest(F.family.id, { id: test.id, doneAt: Date.now() });
    onClose();
  };
  return (
    <Modal title={test.title} onClose={onClose}>
      <div className="stack">
        {test.link && <a className="button" href={test.link} target="_blank" rel="noreferrer">Open test paper ↗</a>}
        {test.instructions && <p>{test.instructions}</p>}
        <p className="muted">Write your answers on paper. When finished, check with Appa/Amma and enter your marks.</p>
        <input inputMode="decimal" placeholder={`Marks scored (out of ${test.totalMarks || '?'})`} value={score} onChange={(e) => setScore(e.target.value)} />
        <input placeholder="Question numbers you got wrong (e.g. 3, 7, 12)" value={wrong} onChange={(e) => setWrong(e.target.value)} />
        <button className="primary" disabled={score === ''} onClick={save}>Save result</button>
      </div>
    </Modal>
  );
}

export function MistakeBook({ F }) {
  const open = F.mistakes.filter((m) => !m.resolved).sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
  const [qs, setQs] = useState({});
  useEffect(() => { questionsById(open.filter((m) => !m.q && !m.manual).map((m) => m.id)).then((list) => setQs(Object.fromEntries(list.map((q) => [q.id, q])))); }, [open.length]);
  const fixed = F.mistakes.length - open.length;
  return (
    <div className="stack">
      <Card title="Mistake Book" right={<span className="muted">{open.length} open · {fixed} fixed</span>}>
        <p className="muted">Each mistake comes back in “Revise” until you get it right on two different days.</p>
        {!open.length && <p>No open mistakes. 🎉</p>}
        {open.map((m) => {
          const q = m.q || qs[m.id];
          return (
            <div key={m.id} className="mistake">
              <div className="muted small-text">{m.chapterId ? chapterLabel(m.chapterId) : 'Imported test'} · wrong {m.wrongCount || 1}× · right streak {m.rightStreak || 0}/2</div>
              <b>{m.manual ? m.text : q?.q || 'Loading…'}</b>
              {!m.manual && q && <details><summary>Show answer</summary><div className="ok">{q.ans}</div>{q.why && <div className="muted">{q.why}</div>}</details>}
              {m.manual && <button className="small" onClick={() => setMistake(F.family.id, m.id, { resolved: true, lastRightDate: ymd() })}>I’ve fixed this ✓</button>}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

export function Progress7({ F }) {
  const today = ymd();
  const last = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  return (
    <div className="grid14">
      {last.map((d) => {
        const day = F.days[d];
        const n = day ? STEPS.filter((s) => day[s.key]).length : 0;
        return <div key={d} title={`${d}: ${n}/5`} className={`cell c${n} ${d === today ? 'today' : ''}`}>{Number(d.slice(8))}</div>;
      })}
    </div>
  );
}

export function StudyLibrary({ F }) {
  const [subject, setSubject] = useState('');
  const [ch, setCh] = useState('');
  const [quiz, setQuiz] = useState(null);
  const [pack, setPack] = useState(undefined);
  useEffect(() => { if (ch) loadChapter(ch).then(setPack); else setPack(undefined); }, [ch]);
  if (quiz) return <QuizRunner title={quiz.title} questions={quiz.questions} onCancel={() => setQuiz(null)} onFinish={async (r) => { await recordQuiz(F, 'practice', r); setQuiz(null); }} />;
  const status = F.chapters[ch];
  return (
    <div className="stack">
      <Card title="Study any chapter">
        <ChapterPicker subject={subject} onSubject={setSubject} value={ch} onChange={setCh} />
        {ch && <div className="muted small-text">Status: {status?.status || 'not started'}{status?.taughtOn ? ` · taught ${status.taughtOn}` : ''}</div>}
        {pack === null && <p className="muted">Not in the study pack yet.</p>}
        {pack && <>
          {pack.explainer.map((e, i) => <div key={i} className="explain"><b>{e.heading}</b><p>{e.body}</p>{e.example && <p>🌍 <i>{e.example}</i></p>}{e.hook && <p className="hook">🧠 {e.hook}</p>}</div>)}
          <button className="primary" onClick={() => setQuiz({ title: chapterLabel(ch), questions: pickQuestions(pack.questions.map((q) => ({ ...q, chapterId: ch })), 10) })}>Practice 10 questions</button>
        </>}
      </Card>
    </div>
  );
}

export function StudyPage({ F, me, sub = 'subjects', setSub }) {
  const [open, setOpen] = useState(null);
  const tests = F.attempts.slice(0, 12);
  if (open) return <SubjectDetail F={F} me={me} subjectId={open} onBack={() => setOpen(null)} />;
  return (
    <div>
      <PageHead title="Study" />
      <div className="seg">
        {[['subjects', 'Subjects'], ['mistakes', 'Mistakes'], ['progress', 'Progress']].map(([k, l]) => (
          <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>
        ))}
      </div>
      {sub === 'subjects' && <SubjectGrid F={F} open={setOpen} />}
      {sub === 'mistakes' && <MistakeBook F={F} />}
      {sub === 'progress' && <div className="stack">
        <Card title="Last 14 days"><Progress7 F={F} /></Card>
        <Card title="Recent scores">
          {!tests.length && <p className="muted small-text">No practice or tests yet.</p>}
          {tests.map((a) => (
            <div key={a.id} className="lrow">
              <Tile icon={a.kind === 'test' || a.kind === 'imported' ? 'trophy' : a.kind === 'revise' ? 'repeat' : 'target'} tone={a.pct >= 80 ? 'green' : a.pct >= 50 ? 'amber' : 'red'} />
              <div className="lt"><b>{a.title || ({ practice: 'Practice', revise: 'Revision', test: 'Weekly test', imported: 'Test' }[a.kind])}</b><small>{a.date}</small></div>
              <b>{a.score}/{a.total}</b>
            </div>
          ))}
        </Card>
      </div>}
    </div>
  );
}

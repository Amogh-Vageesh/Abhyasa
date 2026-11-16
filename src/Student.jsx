import { useEffect, useMemo, useState } from 'react';
import { set as idbSet, get as idbGet } from 'idb-keyval';
import { Card, ChapterPicker, Modal, QuizRunner, Progress, rupees } from './components';
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

  return (
    <div className="stack">
      <div className="hero">
        <div>
          <div className="muted">Hi {F.family.studentName?.split(' ')[0]} 👋</div>
          <h2>{doneCount === 5 ? 'All done today! 🎉' : `${doneCount}/5 done today`}</h2>
        </div>
        <div className="hero-stats">
          <div><b>🔥 {streak}</b><span>streak</span></div>
          <div onClick={() => go('wallet')}><b>{rupees(balance)}</b><span>wallet</span></div>
        </div>
      </div>
      <Progress value={doneCount} max={5} />

      {latestNote && <div className="note">💬 <b>{latestNote.from}:</b> {latestNote.text}</div>}

      {upcoming.length > 0 && (
        <Card title="Coming up">
          {upcoming.map((e) => <div key={e.id} className={`event-line ${e.type}`} onClick={() => go('calendar')}>
            <b>{daysBetween(today, e.date) === 0 ? 'Today' : daysBetween(today, e.date) === 1 ? 'Tomorrow' : `In ${daysBetween(today, e.date)} days`}</b> · {e.title}
          </div>)}
        </Card>
      )}

      {assigned.length > 0 && (
        <Card title="Tests for you">
          {assigned.map((t) => <div key={t.id} className="row between"><span>📄 {t.title}</span><button className="primary small" onClick={() => startAssigned(t)}>Start</button></div>)}
        </Card>
      )}

      <Card title="Today’s routine">
        <div className="steps">
          <Step s={STEPS[0]} done={day.logDone} detail={(day.logs || []).map((l) => l.chapterId ? chapterLabel(l.chapterId) : l.subjectName).join(' · ')}
            action={<div className="row"><button className="small" onClick={() => setModal({ type: 'log' })}>+ Add class</button>{!day.logDone && <button className="ghost small" onClick={() => markStep(F, 'logDone')}>No school today</button>}</div>} />
          <Step s={STEPS[1]} done={day.homework}
            action={<button className="small" onClick={() => markStep(F, 'homework', !day.homework)}>{day.homework ? 'Undo' : 'Mark done'}</button>} />
          <Step s={STEPS[2]} done={day.learnDone}
            action={<button className="small" onClick={() => setModal({ type: 'learn', chapters: todaysChapters })}>Open</button>} />
          <Step s={STEPS[3]} done={day.practiceDone}
            action={<button className="small" onClick={startPractice}>{day.practiceDone ? 'Practice more' : 'Start'}</button>} />
          <Step s={STEPS[4]} done={day.reviseDone}
            detail={`${dueChapters(F.chapters, today).length} chapter(s) due · ${F.mistakes.filter((m) => !m.resolved).length} mistakes open`}
            action={<button className="small" onClick={startRevise}>Start</button>} />
        </div>
      </Card>

      {isWeekend(today) && (
        <Card title="🏆 Weekend test">
          <p>Questions from this week’s chapters, older topics and your mistakes.</p>
          <button className="primary" onClick={startWeekly}>Take weekly test</button>
        </Card>
      )}

      {modal?.type === 'log' && <LogModal F={F} onClose={() => setModal(null)} />}
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

function LogModal({ F, onClose }) {
  const [subject, setSubject] = useState('');
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
    await logClass(F, { subject, subjectName: CHAPTERS[chapterId]?.subjectName || subject, chapterId: chapterId || null, pages, note, doubt, photoKeys });
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

function LearnModal({ F, chapters, onClose }) {
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
      <Card title="📕 Mistake Book" right={<span className="muted">{open.length} open · {fixed} fixed</span>}>
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
      <Card title="📚 Study any chapter">
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

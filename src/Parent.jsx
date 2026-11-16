import { useMemo, useState } from 'react';
import { Card, ChapterPicker, Modal, rupees } from './components';
import { STEPS } from './lib/actions';
import { addNote, deleteTest, saveTest, updateSettings } from './lib/data';
import { currentStreak, dueChapters, parseTestText, walletSummary, ymd } from './lib/logic';
import { chapterLabel, CHAPTERS } from './lib/syllabus';
import { Progress7 } from './Student';

export function ParentDashboard({ F, me, go }) {
  const today = ymd();
  const day = F.days[today] || {};
  const streak = currentStreak(F.days, today);
  const [note, setNote] = useState('');
  const { balance } = walletSummary(F.wallet);

  const chapterStats = useMemo(() => {
    const st = {};
    for (const a of F.attempts) for (const it of a.items || []) {
      if (!it.chapterId) continue;
      const s = (st[it.chapterId] ||= { right: 0, total: 0 });
      s.total++; if (it.correct) s.right++;
    }
    return Object.entries(st).filter(([, s]) => s.total >= 4).map(([id, s]) => ({ id, pct: Math.round((s.right / s.total) * 100), total: s.total })).sort((a, b) => a.pct - b.pct);
  }, [F.attempts]);

  const tests = F.attempts.filter((a) => a.kind === 'test' || a.kind === 'imported').slice(0, 8);
  const openMistakes = F.mistakes.filter((m) => !m.resolved);
  const last7 = Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - i); return ymd(d); });
  const doneDays = last7.filter((d) => F.days[d]?.completed).length;

  return (
    <div className="stack">
      <div className="hero">
        <div><div className="muted">{F.family.studentName}’s progress</div><h2>{STEPS.filter((s) => day[s.key]).length}/5 today</h2></div>
        <div className="hero-stats">
          <div><b>🔥 {streak}</b><span>streak</span></div>
          <div><b>{doneDays}/7</b><span>days done</span></div>
          <div onClick={() => go('wallet')}><b>{rupees(balance)}</b><span>to pay</span></div>
        </div>
      </div>

      <Card title="Today">
        {STEPS.map((s) => <div key={s.key} className="row between"><span>{day[s.key] ? '✅' : '⬜'} {s.label}</span></div>)}
        {(day.logs || []).length > 0 && <div className="logs">
          {(day.logs || []).map((l, i) => <div key={i} className="log">
            <b>{l.chapterId ? chapterLabel(l.chapterId) : l.subjectName}</b>{l.pages ? ` · p. ${l.pages}` : ''}
            {l.note && <div>{l.note}</div>}
            {l.doubt && <div className="bad-text small-text">⚠️ Had a doubt</div>}
          </div>)}
        </div>}
      </Card>

      <Card title="Last 14 days"><Progress7 F={F} /></Card>

      <Card title="Test scores">
        {!tests.length && <p className="muted">No tests yet.</p>}
        {tests.map((t) => <div key={t.id} className="row between"><span>{t.date} · {t.title || (t.kind === 'test' ? 'Weekly test' : 'Test')}</span><b className={t.pct >= 80 ? 'ok' : t.pct < 50 ? 'bad-text' : ''}>{t.score}/{t.total} ({t.pct}%)</b></div>)}
      </Card>

      <Card title="Weakest chapters">
        {!chapterStats.length && <p className="muted">Shows once he has answered enough questions.</p>}
        {chapterStats.slice(0, 5).map((c) => <div key={c.id} className="row between"><span>{chapterLabel(c.id)}</span><b className={c.pct < 60 ? 'bad-text' : ''}>{c.pct}% ({c.total} Qs)</b></div>)}
      </Card>

      <Card title={`Mistake book · ${openMistakes.length} open`}>
        {openMistakes.slice(0, 5).map((m) => <div key={m.id} className="small-text">• {m.manual ? m.text : chapterLabel(m.chapterId) || 'Imported test'} — wrong {m.wrongCount || 1}×</div>)}
        <div className="muted small-text">{dueChapters(F.chapters, today).length} chapter(s) due for revision today</div>
      </Card>

      <Card title="Send a note">
        <div className="row">
          <input placeholder="e.g. Great streak! Proud of you 💪" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="primary" disabled={!note} onClick={async () => { await addNote(F.family.id, { text: note, from: me.name }); setNote(''); }}>Send</button>
        </div>
      </Card>
    </div>
  );
}

const PROMPT = `Make a test for my son (Class 7, CBSE, NCERT 2026-27 books) in EXACTLY this format, no other text:

TEST: <title>
CHAPTER: <subject and chapter>
Q: <question>
A) <option>  B) <option>  C) <option>  D) <option>
ANS: <letter>
WHY: <one-line explanation>

For non-MCQ questions add a TYPE line after Q: — TYPE: tf (ANS: True/False), TYPE: fill, TYPE: num (ANS: a number), or TYPE: short (ANS: model answer).

Topic: <chapters>. Make <15> questions: mostly MCQ, a few fill/num, 2 short answers, mixed easy/medium/hard.`;

export function ParentTests({ F }) {
  const [modal, setModal] = useState(null);
  const [copied, setCopied] = useState(false);
  return (
    <div className="stack">
      <Card title="📄 Tests" right={<div className="row"><button className="primary small" onClick={() => setModal('import')}>Import test</button><button className="small" onClick={() => setModal('paper')}>Paper test</button></div>}>
        <p className="muted small-text">Paste tests made anywhere (e.g. in your Claude project) using the Abhyasa format. They’re auto-marked, and mistakes go into his Mistake Book.</p>
        <button className="small" onClick={() => { navigator.clipboard.writeText(PROMPT); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? 'Copied ✓' : 'Copy prompt template'}</button>
      </Card>
      <Card title="Library">
        {!F.tests.length && <p className="muted">No tests yet.</p>}
        {F.tests.map((t) => {
          const att = F.attempts.find((a) => a.testId === t.id);
          return (
            <div key={t.id} className="test-row">
              <div className="grow"><b>{t.kind === 'paper' ? '🗒️' : '📄'} {t.title}</b>
                <div className="muted small-text">{t.kind === 'paper' ? `Paper · ${t.totalMarks || '?'} marks` : `${t.questions?.length || 0} questions`}{t.chapterId ? ' · ' + chapterLabel(t.chapterId) : ''}
                  {att ? ` · scored ${att.score}/${att.total} (${att.pct}%)` : t.assigned && !t.doneAt ? ' · assigned, pending' : ''}</div></div>
              <div className="row">
                <button className="small" onClick={() => saveTest(F.family.id, { id: t.id, assigned: true, doneAt: null })}>{t.assigned && !t.doneAt ? 'Assigned ✓' : t.doneAt ? 'Assign again' : 'Assign'}</button>
                <button className="ghost small" onClick={() => confirm('Delete this test?') && deleteTest(F.family.id, t.id)}>✕</button>
              </div>
            </div>
          );
        })}
      </Card>
      {modal === 'import' && <ImportModal F={F} onClose={() => setModal(null)} />}
      {modal === 'paper' && <PaperModal F={F} onClose={() => setModal(null)} />}
    </div>
  );
}

function ImportModal({ F, onClose }) {
  const [text, setText] = useState('');
  const [subject, setSubject] = useState('');
  const [chapterId, setChapterId] = useState('');
  const [assign, setAssign] = useState(true);
  const parsed = useMemo(() => (text.trim() ? parseTestText(text) : null), [text]);
  const save = async () => {
    await saveTest(F.family.id, { kind: 'quiz', title: parsed.test.title, chapterId: chapterId || null, questions: parsed.test.questions, assigned: assign, doneAt: null });
    onClose();
  };
  return (
    <Modal title="Import test" onClose={onClose}>
      <div className="stack">
        <textarea rows={10} placeholder={'TEST: Science – Heat\nQ: Which mode needs no medium?\nA) Conduction  B) Convection  C) Radiation  D) None\nANS: C\nWHY: Radiation travels as waves.'} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="muted small-text">Link to a chapter (optional, helps the weak-chapter report):</div>
        <ChapterPicker subject={subject} onSubject={setSubject} value={chapterId} onChange={setChapterId} />
        {parsed && <div className={parsed.errors.length ? 'feedback bad' : 'feedback good'}>
          <b>{parsed.test.title}</b> — {parsed.test.questions.length} question(s) found
          {parsed.errors.map((e, i) => <div key={i}>⚠️ {e}</div>)}
        </div>}
        <label className="check"><input type="checkbox" checked={assign} onChange={(e) => setAssign(e.target.checked)} /> Assign to him now</label>
        <button className="primary" disabled={!parsed || !parsed.test.questions.length} onClick={save}>Save test</button>
      </div>
    </Modal>
  );
}

function PaperModal({ F, onClose }) {
  const [t, setT] = useState({ title: '', totalMarks: '', link: '', instructions: '' });
  const [subject, setSubject] = useState('');
  const [chapterId, setChapterId] = useState('');
  return (
    <Modal title="Paper test (PDF / worksheet)" onClose={onClose}>
      <div className="stack">
        <input placeholder="Title (e.g. Maths sample paper 2)" value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} />
        <input inputMode="numeric" placeholder="Total marks" value={t.totalMarks} onChange={(e) => setT({ ...t, totalMarks: e.target.value })} />
        <input placeholder="Link to PDF (Google Drive etc., optional)" value={t.link} onChange={(e) => setT({ ...t, link: e.target.value })} />
        <textarea rows={2} placeholder="Instructions (e.g. Do Q1–20, 45 minutes)" value={t.instructions} onChange={(e) => setT({ ...t, instructions: e.target.value })} />
        <ChapterPicker subject={subject} onSubject={setSubject} value={chapterId} onChange={setChapterId} />
        <button className="primary" disabled={!t.title} onClick={async () => { await saveTest(F.family.id, { ...t, kind: 'paper', chapterId: chapterId || null, assigned: true, doneAt: null }); onClose(); }}>Save & assign</button>
      </div>
    </Modal>
  );
}

export function ParentSettings({ F }) {
  const [s, setS] = useState(F.settings);
  const [saved, setSaved] = useState(false);
  const setR = (k, v) => setS({ ...s, rewards: { ...s.rewards, [k]: Number(v) || 0 } });
  const num = (k, v) => setS({ ...s, [k]: Number(v) || 0 });
  const save = async () => { await updateSettings(F.family.id, s); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="stack">
      <Card title="⚙️ Routine">
        <Field label="Practice questions per day"><input inputMode="numeric" value={s.practiceCount} onChange={(e) => num('practiceCount', e.target.value)} /></Field>
        <Field label="Revision questions per day"><input inputMode="numeric" value={s.reviseCount} onChange={(e) => num('reviseCount', e.target.value)} /></Field>
        <Field label="Mistakes per revision"><input inputMode="numeric" value={s.mistakesPerRevise} onChange={(e) => num('mistakesPerRevise', e.target.value)} /></Field>
        <Field label="Weekly test questions"><input inputMode="numeric" value={s.weeklyTestCount} onChange={(e) => num('weeklyTestCount', e.target.value)} /></Field>
        <Field label="Daily study reminder (his phone)"><input type="time" value={s.reminderTime} onChange={(e) => setS({ ...s, reminderTime: e.target.value })} /></Field>
      </Card>
      <Card title="💰 Rewards (₹)">
        <Field label="Full routine day"><input inputMode="numeric" value={s.rewards.dayComplete} onChange={(e) => setR('dayComplete', e.target.value)} /></Field>
        <Field label="7-day streak bonus"><input inputMode="numeric" value={s.rewards.streak7} onChange={(e) => setR('streak7', e.target.value)} /></Field>
        <Field label="Test 80%+"><input inputMode="numeric" value={s.rewards.test80} onChange={(e) => setR('test80', e.target.value)} /></Field>
        <Field label="Test 90%+"><input inputMode="numeric" value={s.rewards.test90} onChange={(e) => setR('test90', e.target.value)} /></Field>
        <Field label="Each mistake cleared"><input inputMode="numeric" value={s.rewards.mistakeCleared} onChange={(e) => setR('mistakeCleared', e.target.value)} /></Field>
        <Field label="Monthly cap"><input inputMode="numeric" value={s.rewards.monthlyCap} onChange={(e) => setR('monthlyCap', e.target.value)} /></Field>
      </Card>
      <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save settings'}</button>
      <Card title="Family">
        <p>Family code: <b className="code">{F.family.code}</b></p>
        <p className="muted small-text">Your wife can install Abhyasa, sign in with her Google account, choose “Parent” and enter this code.</p>
        <p className="muted small-text">Parents: {Object.values(F.family.parentNames || {}).join(', ')}</p>
      </Card>
    </div>
  );
}

function Field({ label, children }) {
  return <label className="field"><span>{label}</span>{children}</label>;
}

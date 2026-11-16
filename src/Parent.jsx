import { useMemo, useState } from 'react';
import { Card, ChapterPicker, Modal, rupees, PageHead, Progress } from './components';
import { Icon, Tile, Avatar, HeroArt } from './icons';
import { STEPS } from './lib/actions';
import { addNote, deleteTest, saveTest, updateSettings } from './lib/data';
import { currentStreak, dueChapters, parseTestText, taskStats, walletSummary, ymd, moneyBalances, formatMoney } from './lib/logic';
import { useInsights, InsightRow, ActionList } from './Insights';
import { MistakeReport } from './Probe';
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

  const insights = useInsights(F);
  const greet = new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const doneToday = STEPS.filter((s) => day[s.key]).length;
  const kid = F.family.studentName?.split(' ')[0] || 'Student';

  return (
    <div>
      <div className="hero">
        <div className="hero-txt">
          <span>{greet}</span>
          <h1>{me.name?.split(' ')[0]} 👋</h1>
          <small>{new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</small>
        </div>
        <HeroArt />
      </div>

      <div className="summary">
        <Avatar name={kid} tone="blue" size={52} />
        <div className="summary-main">
          <small>{kid}’s routine today</small>
          <b>{doneToday === 5 ? 'All done 🎉' : `${doneToday} of 5 done`}</b>
          <Progress value={doneToday} max={5} color="linear-gradient(90deg, var(--accent-a), var(--accent-b))" />
        </div>
        <div className="delta">🔥 {streak}<span>day streak</span></div>
      </div>

      <div className="stats">
        <button className="stat" style={{ '--tc': '#2f7fe0' }}><Tile icon="calendar" tone="blue" /><small>This week</small><b>{doneDays}/7 days</b></button>
        <button className="stat" style={{ '--tc': '#1f9d55' }} onClick={() => go('wallet')}><Tile icon="wallet" tone="green" /><small>To pay</small><b>{rupees(balance)}</b></button>
        <button className="stat" style={{ '--tc': '#e5484d' }} onClick={() => go('mistakes')}><Tile icon="mistake" tone="red" /><small>Mistakes</small><b>{openMistakes.length} open</b></button>
      </div>

      <div className="sec-h"><h2>Quick Actions</h2></div>
      <div className="quick">
        <button onClick={() => go('fab', 'import')}><Tile icon="file" tone="purple" round />Import test</button>
        <button onClick={() => go('fab', 'event')}><Tile icon="calendar" tone="blue" round />Add event</button>
        <button onClick={() => go('fab', 'note')}><Tile icon="send" tone="amber" round />Send note</button>
        <button onClick={() => go('fab', 'task')}><Tile icon="check" tone="teal" round />Add task</button>
      </div>

      <div className="home-grid"><div className="col">
      <div className="sec-h"><h2>Today</h2></div>
      <div className="card list">
        {STEPS.map((s) => (
          <div key={s.key} className={`lrow ${day[s.key] ? 'done' : ''}`}>
            <span className={`check-circle ${day[s.key] ? 'on' : ''}`}>{day[s.key] && <Icon name="check" size={16} />}</span>
            <div className="lt"><b>{s.label}</b></div>
          </div>
        ))}
        {(day.logs || []).map((l, i) => (
          <div key={i} className="lrow">
            <Tile icon="edit" tone={l.doubt ? 'red' : 'blue'} />
            <div className="lt"><b>{l.chapterId ? chapterLabel(l.chapterId) : l.subjectName}{l.pages ? ` · p. ${l.pages}` : ''}</b>
              <small>{l.note || 'No note'}{l.doubt ? ' · ⚠️ had a doubt' : ''}</small></div>
          </div>
        ))}
      </div>

      <div className="sec-h"><h2>Tasks</h2><button className="link" onClick={() => go('planner', 'tasks')}>Manage <Icon name="chevR" size={16} /></button></div>
      <div className="card list">
        {['daily', 'weekly', 'monthly'].map((fq) => { const st = taskStats(F.tasks, fq, today, 1)[0]; return (
          <div key={fq} className="lrow">
            <Tile icon="check" tone={st.pct === null ? 'gray' : st.pct >= 80 ? 'green' : st.pct >= 50 ? 'amber' : 'red'} />
            <div className="lt"><b>{fq === 'daily' ? 'Today' : fq === 'weekly' ? 'This week' : 'This month'}</b><small>{st.total ? `${st.done} of ${st.total} done` : `No ${fq} tasks yet`}</small></div>
            {st.pct !== null && <b>{st.pct}%</b>}
          </div>
        ); })}
      </div>

      <div className="sec-h"><h2>Last 14 days</h2></div>
      <div className="card"><Progress7 F={F} /></div>
      </div><div className="col">
      <div className="sec-h"><h2>His money</h2><button className="link" onClick={() => go('finance')}>Open <Icon name="chevR" size={16} /></button></div>
      <div className="card money-card">
        <div className="row between"><div><div className="muted small-text">He has</div><div className="big-score" style={{ fontSize: 24 }}>{formatMoney(moneyBalances(F.money).filter((b) => b.currency === 'INR').reduce((a, b) => a + b.balance, 0))}</div></div>
          <div style={{ textAlign: 'right' }}><div className="muted small-text">Spent this month (all payers)</div><b className="money-out">{formatMoney(F.money.filter((e) => e.type === 'out' && (e.currency || 'INR') === 'INR' && String(e.date).startsWith(today.slice(0, 7))).reduce((a, e) => a + Number(e.amount || 0), 0))}</b></div></div>
      </div>
      <div className="sec-h"><h2>Why mistakes happen</h2><button className="link" onClick={() => go('insights', 'mistakes')}>Report <Icon name="chevR" size={16} /></button></div>
      <MistakeReport F={F} compact go={go} />
      <div className="sec-h"><h2>What to do</h2><button className="link" onClick={() => go('insights')}>All <Icon name="chevR" size={16} /></button></div>
      <ActionList F={F} limit={3} parent />

      <div className="sec-h"><h2>Test scores</h2><button className="link" onClick={() => go('tests')}>Tests <Icon name="chevR" size={16} /></button></div>
      <div className="card list">
        {!tests.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No tests yet.</div>}
        {tests.map((t) => (
          <div key={t.id} className="lrow">
            <Tile icon="trophy" tone={t.pct >= 80 ? 'green' : t.pct >= 50 ? 'amber' : 'red'} />
            <div className="lt"><b>{t.title || (t.kind === 'test' ? 'Weekly test' : 'Test')}</b><small>{t.date}</small></div>
            <b>{t.score}/{t.total} · {t.pct}%</b>
          </div>
        ))}
      </div>

      <div className="sec-h"><h2>Weakest chapters</h2></div>
      <div className="card list">
        {!chapterStats.length && <div className="muted small-text" style={{ padding: '12px 0' }}>Shows once he has answered enough questions.</div>}
        {chapterStats.slice(0, 5).map((c) => (
          <div key={c.id} className="lrow">
            <Tile icon="chart" tone={c.pct < 60 ? 'red' : 'amber'} />
            <div className="lt"><b>{chapterLabel(c.id)}</b><small>{c.total} questions answered</small></div>
            <b className={c.pct < 60 ? 'bad-text' : ''}>{c.pct}%</b>
          </div>
        ))}
        <div className="muted small-text" style={{ padding: '10px 0' }}>{dueChapters(F.chapters, today).length} chapter(s) due for revision today</div>
      </div>
      </div></div>
    </div>
  );
}

export function NoteModal({ F, me, onClose }) {
  const [note, setNote] = useState('');
  return (
    <Modal title="Send a note" onClose={onClose}>
      <div className="stack">
        <textarea rows={3} placeholder="e.g. Great streak! Proud of you 💪" value={note} onChange={(e) => setNote(e.target.value)} />
        <button className="primary" disabled={!note} onClick={async () => { await addNote(F.family.id, { text: note, from: me.name }); onClose(); }}>Send</button>
      </div>
    </Modal>
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
      <PageHead title="Tests" right={<div className="row"><button className="primary small" onClick={() => setModal('import')}><Icon name="plus" size={16} /> Import</button><button className="small" onClick={() => setModal('paper')}>Paper</button></div>} />
      <Card>
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

export function ImportModal({ F, onClose }) {
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

export function ParentSettings({ F, go }) {
  const [s, setS] = useState(F.settings);
  const [saved, setSaved] = useState(false);
  const setR = (k, v) => setS({ ...s, rewards: { ...s.rewards, [k]: Number(v) || 0 } });
  const num = (k, v) => setS({ ...s, [k]: Number(v) || 0 });
  const save = async () => { await updateSettings(F.family.id, s); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="stack">
      <PageHead title="Settings" />
      <div className="card list">
        <button className="lrow" onClick={() => go('ebooks')}><Tile icon="file" tone="red" /><div className="lt"><b>Manage e-books</b><small>{F.ebooks.length} e-book(s) · links and offline PDFs per subject</small></div><Icon name="chevR" className="chev" /></button>
      </div>
      <Card title="Routine">
        <Field label="Practice questions per day"><input inputMode="numeric" value={s.practiceCount} onChange={(e) => num('practiceCount', e.target.value)} /></Field>
        <Field label="Revision questions per day"><input inputMode="numeric" value={s.reviseCount} onChange={(e) => num('reviseCount', e.target.value)} /></Field>
        <Field label="Mistakes per revision"><input inputMode="numeric" value={s.mistakesPerRevise} onChange={(e) => num('mistakesPerRevise', e.target.value)} /></Field>
        <Field label="Weekly test questions"><input inputMode="numeric" value={s.weeklyTestCount} onChange={(e) => num('weeklyTestCount', e.target.value)} /></Field>
        <Field label="Daily study reminder (his phone)"><input type="time" value={s.reminderTime} onChange={(e) => setS({ ...s, reminderTime: e.target.value })} /></Field>
      </Card>
      <Card title="Rewards (₹)">
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

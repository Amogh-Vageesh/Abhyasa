import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Modal, PageHead, Progress, QuizRunner } from './components';
import { Icon, Tile } from './icons';
import { addStudyTime, deleteItem, loadChapter, saveItem, setChapter } from './lib/data';
import { recordQuiz } from './lib/actions';
import { pickQuestions, studyStats, subjectInsights, ymd } from './lib/logic';
import { CHAPTERS, SUBJECTS } from './lib/syllabus';
import { EbookButtons } from './Ebooks';
import { LocalPhotos, storePhotos } from './Subjects';
import { InsightRow } from './Insights';

export const STATUS = {
  'not-started': { label: 'Not started', tone: 'gray' },
  taught: { label: 'Taught', tone: 'blue' },
  revised: { label: 'Revised', tone: 'amber' },
  'test-done': { label: 'Test done', tone: 'green' }
};

// Chapters for a subject: the NCERT list, plus lessons the family added (e.g. Kannada)
export function subjectChapters(F, subjectId) {
  const s = SUBJECTS.find((x) => x.id === subjectId);
  const custom = Object.entries(F.chapters || {}).filter(([, c]) => c.custom && c.subject === subjectId)
    .map(([id, c]) => ({ id, no: c.no, title: c.title, book: c.book || 'Lessons', subject: subjectId, custom: true }))
    .sort((a, b) => (a.no || 0) - (b.no || 0));
  return [...(s?.chapters || []).map((c) => ({ ...c, subject: subjectId })), ...custom];
}
export const subjectOfFactory = (F) => (id) => {
  if (!id) return null;
  return CHAPTERS[id]?.subject || F.chapters?.[id]?.subject || null;
};
export function chapterTitle(F, id) {
  const c = CHAPTERS[id] || F.chapters?.[id];
  return c ? `${c.no ? c.no + '. ' : ''}${c.title}` : id;
}
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

// ---------------- Overview (top of Study) ----------------
export function ProgressOverview({ F, period, setPeriod }) {
  const today = ymd();
  const subjectOf = subjectOfFactory(F);
  const st = studyStats(F, period, today, subjectOf);
  return (
    <Card className="overview">
      <div className="seg" style={{ marginBottom: 12 }}>{[['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>
      <div className="kpis">
        <div><Tile icon="calendar" tone="blue" /><small>Study time</small><b>{fmtMin(st.minutes)}</b></div>
        <div><Tile icon="target" tone="green" /><small>Accuracy</small><b>{st.accuracy ?? '—'}{st.accuracy !== null ? '%' : ''}</b><em>{st.questions} questions</em></div>
        <div><Tile icon="book" tone="purple" /><small>Chapters taught</small><b>{st.taught}</b><em>{st.logs} classes logged</em></div>
        <div><Tile icon="flame" tone="amber" /><small>Routine days</small><b>{st.routineDays}</b><em>{period === 'all' ? 'in total' : `of ${period === 'week' ? 7 : 30}`}</em></div>
      </div>
      <div className="subj-bars">
        {SUBJECTS.map((s) => {
          const x = st.perSubject[s.id] || {};
          const acc = x.questions ? Math.round((x.correct / x.questions) * 100) : null;
          const mins = Math.round((x.seconds || 0) / 60);
          return (
            <div key={s.id} className="subj-bar">
              <span className="dot" style={{ background: s.color }} />
              <span className="name">{s.name}</span>
              <div className="progress grow"><div style={{ width: `${acc ?? 0}%`, background: s.color }} /></div>
              <span className="val">{acc !== null ? `${acc}%` : '—'}</span>
              <span className="val muted">{fmtMin(mins)}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ---------------- Study tab ----------------
export function StudyPage({ F, me, nav, setNav }) {
  const [period, setPeriod] = useState('week');
  const today = ymd();
  const subjectOf = subjectOfFactory(F);
  if (nav?.chapter) return <ChapterPage F={F} me={me} id={nav.chapter} onBack={() => setNav({ subject: nav.subject })} />;
  if (nav?.subject) return <SubjectPage F={F} me={me} subjectId={nav.subject} onBack={() => setNav({})} openChapter={(id) => setNav({ subject: nav.subject, chapter: id })} />;
  return (
    <div>
      <PageHead title="Study" />
      <ProgressOverview F={F} period={period} setPeriod={setPeriod} />
      <div className="sec-h"><h2>Subjects</h2></div>
      <div className="subjects">
        {SUBJECTS.map((s) => {
          const chs = subjectChapters(F, s.id);
          const started = chs.filter((c) => (F.chapters[c.id]?.status || 'not-started') !== 'not-started').length;
          const ins = subjectInsights({ subjectId: s.id, subjectName: s.name, chapterIds: chs.map((c) => c.id), F, today, subjectOf });
          const tip = ins.find((i) => i.tone === 'warn') || ins.find((i) => i.tone === 'tip') || ins[0];
          return (
            <button key={s.id} className="subj" style={{ '--tc': s.color }} onClick={() => setNav({ subject: s.id })}>
              <div className="row between" style={{ width: '100%' }}><Tile icon="book" tone={s.color} /><span className="muted small-text">{chs.length ? `${started}/${chs.length}` : '+ lessons'}</span></div>
              <b>{s.name}</b>
              {chs.length > 0 && <div className="meter"><div style={{ width: `${(started / chs.length) * 100}%` }} /></div>}
              {tip && <small className={`subj-tip ${tip.tone}`}>{tip.tone === 'warn' ? '⚠️' : tip.tone === 'good' ? '✅' : '💡'} {tip.title}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------- Subject page ----------------
function SubjectPage({ F, me, subjectId, onBack, openChapter }) {
  const s = SUBJECTS.find((x) => x.id === subjectId);
  const today = ymd();
  const subjectOf = subjectOfFactory(F);
  const chs = subjectChapters(F, subjectId);
  const [period, setPeriod] = useState('month');
  const [addLesson, setAddLesson] = useState(false);
  const insights = subjectInsights({ subjectId, subjectName: s.name, chapterIds: chs.map((c) => c.id), F, today, subjectOf });
  const st = (studyStats(F, period, today, subjectOf).perSubject[subjectId]) || {};
  const acc = st.questions ? Math.round((st.correct / st.questions) * 100) : null;
  const started = chs.filter((c) => (F.chapters[c.id]?.status || 'not-started') !== 'not-started').length;
  const books = [...new Set(chs.map((c) => c.book))];
  const accBy = useMemo(() => {
    const m = {};
    for (const a of F.attempts) for (const it of a.items || []) { const x = (m[it.chapterId] ||= { r: 0, t: 0 }); x.t++; if (it.correct) x.r++; }
    return m;
  }, [F.attempts]);
  const logsBy = useMemo(() => {
    const m = {};
    for (const d of Object.values(F.days)) for (const l of d.logs || []) if (l.chapterId) m[l.chapterId] = (m[l.chapterId] || 0) + 1;
    return m;
  }, [F.days]);
  return (
    <div>
      <PageHead title={s.name} onBack={onBack} right={subjectId === 'other' || me.role === 'parent' ? <button className="small" onClick={() => setAddLesson(true)}><Icon name="plus" size={16} /> Lesson</button> : null} />
      <div className="subject-top">
        <Card>
          <div className="seg" style={{ marginBottom: 10 }}>{[['week', 'Week'], ['month', 'Month'], ['all', 'All time']].map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>
          <div className="kpis three">
            <div><small>Chapters</small><b>{started}/{chs.length}</b></div>
            <div><small>Accuracy</small><b style={{ color: s.color }}>{acc ?? '—'}{acc !== null ? '%' : ''}</b></div>
            <div><small>Time</small><b>{fmtMin(Math.round((st.seconds || 0) / 60))}</b></div>
          </div>
          {chs.length > 0 && <Progress value={started} max={chs.length} color={s.color} />}
        </Card>
        <div>
          <div className="sec-h" style={{ marginTop: 0 }}><h2>Insights & tips</h2></div>
          <div className="card list">{insights.slice(0, 4).map((i, n) => <InsightRow key={n} i={i} onClick={i.chapterId ? () => openChapter(i.chapterId) : undefined} />)}</div>
        </div>
      </div>

      <div className="sec-h"><h2>E-books</h2></div>
      {F.ebooks.some((b) => b.subject === subjectId) ? <EbookButtons F={F} subjectId={subjectId} /> : <p className="muted small-text">No e-books yet{me.role === 'parent' ? ' — add them in Settings → Manage e-books.' : '.'}</p>}

      {!chs.length && <Card><p className="muted small-text">No lessons yet. Tap “+ Lesson” to add the lessons from the textbook.</p></Card>}
      {books.map((b) => (
        <div key={b}>
          <div className="sec-h"><h2>{b}</h2></div>
          <div className="chapter-grid">
            {chs.filter((c) => c.book === b).map((c) => {
              const stt = STATUS[F.chapters[c.id]?.status || 'not-started'];
              const a = accBy[c.id];
              const pct = a ? Math.round((a.r / a.t) * 100) : null;
              const notes = F.snotes.filter((n) => n.chapterId === c.id).length;
              return (
                <button key={c.id} className={`chap ${stt.tone}`} style={{ '--tc': s.color }} onClick={() => openChapter(c.id)}>
                  <div className="row between" style={{ width: '100%' }}><span className="chap-no">{c.no}</span><span className={`pill ${stt.tone}`}>{stt.label}</span></div>
                  <b>{c.title}</b>
                  <div className="chap-meta">
                    {pct !== null && <span>🎯 {pct}%</span>}
                    {logsBy[c.id] ? <span>📝 {logsBy[c.id]}</span> : null}
                    {notes ? <span>🗒️ {notes}</span> : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {addLesson && <LessonModal F={F} subjectId={subjectId} next={chs.filter((c) => c.custom).length + 1} onClose={() => setAddLesson(false)} />}
    </div>
  );
}

function LessonModal({ F, subjectId, next, onClose }) {
  const [title, setTitle] = useState('');
  const [no, setNo] = useState(next);
  const [book, setBook] = useState(subjectId === 'other' ? 'Siri Kannada' : 'Extra lessons');
  return (
    <Modal title="Add lesson" onClose={onClose}>
      <div className="stack">
        <input placeholder="Book (e.g. Siri Kannada Bhaga-2)" value={book} onChange={(e) => setBook(e.target.value)} />
        <div className="row"><input inputMode="numeric" style={{ maxWidth: 90 }} value={no} onChange={(e) => setNo(Number(e.target.value) || '')} /><input placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <button className="primary" disabled={!title} onClick={async () => { await setChapter(F.family.id, `${subjectId}-c${Date.now()}`, { custom: true, subject: subjectId, title, no, book, status: 'not-started' }); onClose(); }}>Add</button>
      </div>
    </Modal>
  );
}

// ---------------- Chapter page ----------------
function ChapterPage({ F, me, id, onBack }) {
  const subjectOf = subjectOfFactory(F);
  const subject = subjectOf(id);
  const s = SUBJECTS.find((x) => x.id === subject);
  const [tab, setTab] = useState('taught');
  const [quiz, setQuiz] = useState(null);
  const [pack, setPack] = useState(undefined);
  const opened = useRef(Date.now());
  useEffect(() => { loadChapter(id).then(setPack); }, [id]);
  // count time spent on the chapter page as study time
  useEffect(() => () => { addStudyTime(F.family.id, ymd(), subject, Math.round((Date.now() - opened.current) / 1000)).catch(() => {}); }, []);
  const cur = F.chapters[id]?.status || 'not-started';
  const taught = Object.entries(F.days).flatMap(([d, day]) => (day.logs || []).filter((l) => l.chapterId === id).map((l) => ({ ...l, date: d }))).sort((a, b) => b.date.localeCompare(a.date));
  const acc = (() => { let r = 0, t = 0; for (const a of F.attempts) for (const it of a.items || []) if (it.chapterId === id) { t++; if (it.correct) r++; } return t ? Math.round((r / t) * 100) : null; })();
  const mistakes = F.mistakes.filter((m) => m.chapterId === id && !m.resolved).length;

  if (quiz) return <QuizRunner title={chapterTitle(F, id)} questions={quiz} onCancel={() => setQuiz(null)} onFinish={async (r) => { await recordQuiz(F, 'practice', r); setQuiz(null); }} />;
  return (
    <div>
      <PageHead title={chapterTitle(F, id)} onBack={onBack} />
      <Card>
        <div className="row between"><span className="muted small-text">{s?.name} · {CHAPTERS[id]?.book || F.chapters[id]?.book}</span><span className="small-text">{acc !== null ? `🎯 ${acc}%` : ''}{mistakes ? ` · ${mistakes} mistakes` : ''}</span></div>
        <div className="row wrap" style={{ marginTop: 10 }}>
          {Object.entries(STATUS).map(([k, v]) => <button key={k} className={`small ${cur === k ? 'primary' : ''}`} onClick={() => setChapter(F.family.id, id, { status: k, ...(k !== 'not-started' && !F.chapters[id]?.taughtOn ? { taughtOn: ymd(), lastTaught: ymd() } : {}) })}>{v.label}</button>)}
        </div>
        {pack && <button className="primary" style={{ marginTop: 12, width: '100%' }} onClick={() => setQuiz(pickQuestions(pack.questions.map((q) => ({ ...q, chapterId: id })), 10))}><Icon name="target" size={18} /> Practice this chapter</button>}
      </Card>
      <div className="seg" style={{ marginTop: 12 }}>{[['taught', `Taught (${taught.length})`], ['notes', 'Notes'], ['book', 'Book']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'taught' && <div className="card list">
        {!taught.length && <div className="muted small-text" style={{ padding: '12px 0' }}>Nothing logged for this chapter yet. Log it from Home → Today’s Classes.</div>}
        {taught.map((l, i) => (
          <div key={i} className="lrow" style={{ alignItems: 'flex-start' }}>
            <div className="event-date"><b>{Number(l.date.slice(8))}</b><span>{new Date(l.date).toLocaleString('en-IN', { month: 'short' })}</span></div>
            <div className="lt"><b>{l.pages ? `Pages ${l.pages}` : 'Class'}{l.doubt ? ' · ⚠️ doubt' : ''}</b><small style={{ whiteSpace: 'pre-wrap' }}>{l.note || 'No note'}</small><LocalPhotos keys={l.photoKeys || []} /></div>
          </div>
        ))}
      </div>}
      {tab === 'notes' && <ChapterNotes F={F} me={me} id={id} subject={subject} />}
      {tab === 'book' && <div className="stack">
        <EbookButtons F={F} subjectId={subject} />
        {pack === null && <Card><p className="muted small-text">Study notes for this chapter aren’t in the pack yet.</p></Card>}
        {pack?.explainer?.map((e, i) => <div key={i} className="explain"><b>{e.heading}</b><p>{e.body}</p>{e.example && <p>🌍 <i>{e.example}</i></p>}{e.hook && <p className="hook">🧠 {e.hook}</p>}</div>)}
      </div>}
    </div>
  );
}

function ChapterNotes({ F, me, id, subject }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]);
  const notes = F.snotes.filter((n) => n.chapterId === id);
  const add = async () => {
    const photoKeys = photos.length ? await storePhotos(photos) : [];
    await saveItem(F.family.id, 'snotes', { subject, chapterId: id, text, photoKeys, by: me.name, at: Date.now() });
    setText(''); setPhotos([]);
  };
  return (
    <div className="stack">
      <Card>
        <textarea rows={3} placeholder="Quick note: key point, formula, teacher’s tip… (🎤 on the keyboard to speak)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          <label className="button small">📷 {photos.length || ''}<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => setPhotos([...photos, ...e.target.files])} /></label>
          <span className="grow" />
          <button className="primary small" disabled={!text.trim() && !photos.length} onClick={add}>Save note</button>
        </div>
      </Card>
      <div className="card list">
        {!notes.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No notes yet.</div>}
        {notes.map((n) => (
          <div key={n.id} className="lrow" style={{ alignItems: 'flex-start' }}>
            <Tile icon="edit" tone="amber" />
            <div className="lt"><b style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{n.text}</b><small>{new Date(n.at).toLocaleDateString('en-IN')}{n.by ? ' · ' + n.by : ''}</small><LocalPhotos keys={n.photoKeys || []} /></div>
            <button className="ghost small" onClick={() => confirm('Delete note?') && deleteItem(F.family.id, 'snotes', n.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

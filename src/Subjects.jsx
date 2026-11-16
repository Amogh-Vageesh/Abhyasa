import { useEffect, useMemo, useState } from 'react';
import { set as idbSet, get as idbGet } from 'idb-keyval';
import { Card, Modal, PageHead, QuizRunner, Progress } from './components';
import { Icon, Tile } from './icons';
import { deleteItem, loadChapter, saveItem, setChapter } from './lib/data';
import { recordQuiz } from './lib/actions';
import { pickQuestions, ymd } from './lib/logic';
import { CHAPTERS, SUBJECTS, chapterLabel } from './lib/syllabus';
import { EXAM_GUIDES } from './lib/content';

const STATUS = [
  ['not-started', 'Not started', 'gray'], ['taught', 'Taught', 'blue'], ['revised', 'Revised', 'amber'], ['test-done', 'Test done', 'green']
];
const statusOf = (F, id) => F.chapters[id]?.status || 'not-started';

function subjectStats(F, s) {
  const chapters = s.chapters;
  const started = chapters.filter((c) => statusOf(F, c.id) !== 'not-started').length;
  let right = 0, total = 0;
  for (const a of F.attempts) for (const it of a.items || []) if (CHAPTERS[it.chapterId]?.subject === s.id) { total++; if (it.correct) right++; }
  const mistakes = F.mistakes.filter((m) => !m.resolved && CHAPTERS[m.chapterId]?.subject === s.id).length;
  const papers = F.papers.filter((p) => p.subject === s.id);
  return { started, count: chapters.length, acc: total ? Math.round((right / total) * 100) : null, mistakes, papers: papers.length };
}

export function SubjectGrid({ F, open }) {
  return (
    <div className="subjects">
      {SUBJECTS.map((s) => {
        const st = subjectStats(F, s);
        return (
          <button key={s.id} className="subj" style={{ '--tc': s.color }} onClick={() => open(s.id)}>
            <Tile icon="book" tone={s.color} />
            <b>{s.name}</b>
            <small>{s.chapters.length ? `${st.started}/${st.count} chapters` : 'Your notes & tests'}{st.acc !== null ? ` · ${st.acc}%` : ''}</small>
            {s.chapters.length > 0 && <div className="meter"><div style={{ width: `${(st.started / st.count) * 100}%` }} /></div>}
            <small>{st.mistakes ? `${st.mistakes} mistakes · ` : ''}{st.papers} test paper(s)</small>
          </button>
        );
      })}
    </div>
  );
}

export function SubjectDetail({ F, me, subjectId, onBack }) {
  const s = SUBJECTS.find((x) => x.id === subjectId);
  const [tab, setTab] = useState('book');
  const st = subjectStats(F, s);
  return (
    <div>
      <PageHead title={s.name} onBack={onBack} />
      <div className="summary" style={{ margin: '0 0 12px', cursor: 'default' }}>
        <Tile icon="book" tone={s.color} size={52} />
        <div className="summary-main">
          <small>{s.chapters[0]?.book?.replace(/ I+$/, '') || 'Second language'}</small>
          <b>{s.chapters.length ? `${st.started} of ${st.count} chapters` : 'Notes & tests'}</b>
          {s.chapters.length > 0 && <Progress value={st.started} max={st.count} color={s.color} />}
        </div>
        <div className="delta" style={{ color: s.color }}>{st.acc !== null ? `${st.acc}%` : '—'}<span>accuracy</span></div>
      </div>
      <div className="seg">{[['book', 'Book'], ['notes', 'Notes'], ['papers', 'Papers'], ['progress', 'Progress']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'book' && <BookTab F={F} s={s} />}
      {tab === 'notes' && <NotesTab F={F} me={me} s={s} />}
      {tab === 'papers' && <PapersTab F={F} me={me} s={s} />}
      {tab === 'progress' && <ProgressTab F={F} s={s} />}
    </div>
  );
}

function BookTab({ F, s }) {
  const [open, setOpen] = useState(null);
  if (!s.chapters.length) return <Card><p className="muted small-text">Add notes and test papers for your second language in the other tabs.</p></Card>;
  const books = [...new Set(s.chapters.map((c) => c.book))];
  return (
    <div className="stack">
      {books.map((b) => (
        <div key={b}>
          <div className="sec-h" style={{ marginTop: 4 }}><h2>{b}</h2></div>
          <div className="card list">
            {s.chapters.filter((c) => c.book === b).map((c) => {
              const stt = STATUS.find((x) => x[0] === statusOf(F, c.id));
              return (
                <button key={c.id} className="lrow" onClick={() => setOpen(c.id)}>
                  <i className="tile" style={{ '--tc': s.color, fontStyle: 'normal', fontWeight: 800 }}>{c.no}</i>
                  <div className="lt"><b>{c.title}</b><small>{F.chapters[c.id]?.taughtOn ? `Taught ${F.chapters[c.id].taughtOn}` : 'Not yet'}</small></div>
                  <span className={`pill ${stt[2]}`}>{stt[1]}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {open && <ChapterModal F={F} id={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ChapterModal({ F, id, onClose }) {
  const [pack, setPack] = useState(undefined);
  const [quiz, setQuiz] = useState(null);
  useEffect(() => { loadChapter(id).then(setPack); }, [id]);
  const cur = statusOf(F, id);
  const notes = F.snotes.filter((n) => n.chapterId === id);
  if (quiz) return <Modal title="Practice" onClose={() => setQuiz(null)}><QuizRunner title={chapterLabel(id)} questions={quiz} onCancel={() => setQuiz(null)} onFinish={async (r) => { await recordQuiz(F, 'practice', r); setQuiz(null); }} /></Modal>;
  return (
    <Modal title={chapterLabel(id)} onClose={onClose}>
      <div className="muted small-text">Status</div>
      <div className="row wrap" style={{ margin: '6px 0 12px' }}>
        {STATUS.map(([k, l]) => <button key={k} className={`small ${cur === k ? 'primary' : ''}`} onClick={() => setChapter(F.family.id, id, { status: k, ...(k === 'taught' && !F.chapters[id]?.taughtOn ? { taughtOn: ymd(), lastTaught: ymd() } : {}) })}>{l}</button>)}
      </div>
      {pack === null && <p className="muted small-text">Study material for this chapter isn’t in the pack yet.</p>}
      {pack?.explainer?.map((e, i) => <div key={i} className="explain"><b>{e.heading}</b><p>{e.body}</p>{e.example && <p>🌍 <i>{e.example}</i></p>}{e.hook && <p className="hook">🧠 {e.hook}</p>}</div>)}
      {pack && <button className="primary" onClick={() => setQuiz(pickQuestions(pack.questions.map((q) => ({ ...q, chapterId: id })), 10))}>Practice 10 questions</button>}
      {notes.length > 0 && <><div className="sec-h"><h2>My notes</h2></div>{notes.map((n) => <div key={n.id} className="explain">{n.text}</div>)}</>}
    </Modal>
  );
}

function NotesTab({ F, me, s }) {
  const [text, setText] = useState('');
  const [chapterId, setChapterId] = useState('');
  const notes = F.snotes.filter((n) => n.subject === s.id);
  const add = async () => { await saveItem(F.family.id, 'snotes', { subject: s.id, chapterId: chapterId || null, text, by: me.name, at: Date.now() }); setText(''); };
  return (
    <div className="stack">
      <Card>
        <textarea rows={3} placeholder="Quick note: formula, key point, teacher’s tip… (tap 🎤 on the keyboard to speak)" value={text} onChange={(e) => setText(e.target.value)} />
        <div className="row" style={{ marginTop: 8 }}>
          {s.chapters.length > 0 && <select value={chapterId} onChange={(e) => setChapterId(e.target.value)}><option value="">Any chapter</option>{s.chapters.map((c) => <option key={c.id} value={c.id}>{c.no}. {c.title}</option>)}</select>}
          <button className="primary" disabled={!text.trim()} onClick={add}>Save</button>
        </div>
      </Card>
      <div className="card list">
        {!notes.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No notes yet.</div>}
        {notes.map((n) => (
          <div key={n.id} className="lrow">
            <Tile icon="edit" tone={s.color} />
            <div className="lt"><b style={{ fontWeight: 500, whiteSpace: 'pre-wrap' }}>{n.text}</b><small>{n.chapterId ? chapterLabel(n.chapterId) + ' · ' : ''}{new Date(n.at).toLocaleDateString('en-IN')}</small></div>
            <button className="ghost small" onClick={() => confirm('Delete note?') && deleteItem(F.family.id, 'snotes', n.id)}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LocalPhotos({ keys = [] }) {
  const [urls, setUrls] = useState([]);
  useEffect(() => {
    let alive = true; const made = [];
    Promise.all(keys.map((k) => idbGet(k))).then((blobs) => { if (!alive) return; const u = blobs.filter(Boolean).map((b) => { const x = URL.createObjectURL(b); made.push(x); return x; }); setUrls(u); });
    return () => { alive = false; made.forEach(URL.revokeObjectURL); };
  }, [keys.join()]);
  if (!keys.length) return null;
  if (!urls.length) return <div className="muted small-text">📷 {keys.length} photo(s) on the other device</div>;
  return <div className="thumbs">{urls.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" /></a>)}</div>;
}

async function storePhotos(files) {
  const keys = [];
  for (const f of files) { const k = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; await idbSet(k, f); keys.push(k); }
  return keys;
}

function PapersTab({ F, me, s }) {
  const [edit, setEdit] = useState(null);
  const papers = F.papers.filter((p) => p.subject === s.id);
  return (
    <div className="stack">
      <Card>
        <div className="row between"><span className="muted small-text">School tests, worksheets and sample papers — with your answer sheets and marks.</span>
          <button className="primary small" onClick={() => setEdit({ subject: s.id, date: ymd(), title: '', chapters: [] })}><Icon name="plus" size={16} /> Paper</button></div>
      </Card>
      <div className="card list">
        {!papers.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No test papers yet.</div>}
        {papers.map((p) => {
          const pct = p.total ? Math.round((p.marks / p.total) * 100) : null;
          return (
            <button key={p.id} className="lrow" onClick={() => setEdit(p)}>
              <Tile icon="file" tone={pct === null ? 'gray' : pct >= 80 ? 'green' : pct >= 50 ? 'amber' : 'red'} />
              <div className="lt"><b>{p.title}</b><small>{p.date}{p.chapters?.length ? ' · ' + p.chapters.map((c) => 'Ch ' + (CHAPTERS[c]?.no || '')).join(', ') : ''}{(p.paperPhotos?.length || 0) + (p.answerPhotos?.length || 0) ? ` · 📷 ${(p.paperPhotos?.length || 0) + (p.answerPhotos?.length || 0)}` : ''}</small></div>
              {pct !== null && <b>{p.marks}/{p.total}</b>}
            </button>
          );
        })}
      </div>
      {edit && <PaperModal F={F} me={me} s={s} paper={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function PaperModal({ F, me, s, paper, onClose }) {
  const [p, setP] = useState({ paperPhotos: [], answerPhotos: [], ...paper });
  const set = (k, v) => setP({ ...p, [k]: v });
  const addPhotos = async (field, files) => set(field, [...(p[field] || []), ...(await storePhotos(files))]);
  const toggleCh = (id) => set('chapters', p.chapters.includes(id) ? p.chapters.filter((x) => x !== id) : [...p.chapters, id]);
  return (
    <Modal title={paper.id ? p.title : 'Add test paper'} onClose={onClose}>
      <div className="stack">
        <input placeholder="Title (e.g. Periodic Test 1, Worksheet 3)" value={p.title} onChange={(e) => set('title', e.target.value)} />
        <div className="row">
          <input type="date" value={p.date} onChange={(e) => set('date', e.target.value)} />
          <input inputMode="decimal" placeholder="Marks" value={p.marks ?? ''} onChange={(e) => set('marks', e.target.value === '' ? null : Number(e.target.value))} />
          <input inputMode="decimal" placeholder="Out of" value={p.total ?? ''} onChange={(e) => set('total', e.target.value === '' ? null : Number(e.target.value))} />
        </div>
        {s.chapters.length > 0 && <>
          <div className="muted small-text">Chapters covered</div>
          <div className="chips">{s.chapters.map((c) => <button key={c.id} className={`small ${p.chapters.includes(c.id) ? 'primary' : ''}`} onClick={() => toggleCh(c.id)}>{c.no}</button>)}</div>
        </>}
        <div className="muted small-text">Question paper</div>
        <LocalPhotos keys={p.paperPhotos} />
        <label className="file-btn">📷 Add question paper photos<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => addPhotos('paperPhotos', e.target.files)} /></label>
        <div className="muted small-text">My answer sheet</div>
        <LocalPhotos keys={p.answerPhotos} />
        <label className="file-btn">📷 Add answer sheet photos<input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => addPhotos('answerPhotos', e.target.files)} /></label>
        <textarea rows={3} placeholder="Where did I lose marks? What will I do differently?" value={p.reflection || ''} onChange={(e) => set('reflection', e.target.value)} />
        <p className="muted small-text">Photos stay on this device; marks and notes sync to the family.</p>
        <button className="primary" disabled={!p.title} onClick={async () => { await saveItem(F.family.id, 'papers', { ...p, by: p.by || me.name }); onClose(); }}>Save</button>
        {paper.id && <button className="danger" onClick={async () => { if (confirm('Delete this paper?')) { await deleteItem(F.family.id, 'papers', paper.id); onClose(); } }}>Delete</button>}
      </div>
    </Modal>
  );
}

function ProgressTab({ F, s }) {
  const papers = F.papers.filter((p) => p.subject === s.id && p.total).slice().reverse();
  const byCh = useMemo(() => {
    const m = {};
    for (const a of F.attempts) for (const it of a.items || []) if (CHAPTERS[it.chapterId]?.subject === s.id) { const x = (m[it.chapterId] ||= { r: 0, t: 0 }); x.t++; if (it.correct) x.r++; }
    return Object.entries(m).map(([id, v]) => ({ id, pct: Math.round((v.r / v.t) * 100), t: v.t })).sort((a, b) => a.pct - b.pct);
  }, [F.attempts, s.id]);
  const counts = STATUS.map(([k, l, tone]) => ({ k, l, tone, n: s.chapters.filter((c) => statusOf(F, c.id) === k).length }));
  const guide = EXAM_GUIDES[s.id];
  return (
    <div className="stack">
      <Card title="Test paper marks">
        {!papers.length && <p className="muted small-text">Add test papers with marks to see your trend.</p>}
        {papers.length > 0 && <div className="bars">{papers.slice(-8).map((p) => { const pct = Math.round((p.marks / p.total) * 100); return (
          <div key={p.id} className="bar" title={`${p.title}: ${pct}%`}><div className="bar-track" style={{ height: 90 }}><div style={{ height: `${pct}%`, background: pct >= 80 ? 'var(--good)' : pct >= 50 ? 'var(--accent-b)' : 'var(--bad)' }} /></div><small>{pct}%</small></div>
        ); })}</div>}
      </Card>
      {s.chapters.length > 0 && <Card title="Chapters">
        <div className="row wrap">{counts.map((c) => <span key={c.k} className={`pill ${c.tone}`}>{c.l}: {c.n}</span>)}</div>
      </Card>}
      <Card title="Practice accuracy by chapter">
        {!byCh.length && <p className="muted small-text">Practise in the app to see this.</p>}
        {byCh.map((c) => (
          <div key={c.id} style={{ margin: '8px 0' }}>
            <div className="row between small-text"><span>{CHAPTERS[c.id]?.no}. {CHAPTERS[c.id]?.title}</span><b className={c.pct < 60 ? 'bad-text' : ''}>{c.pct}%</b></div>
            <div className="progress"><div style={{ width: `${c.pct}%`, background: c.pct >= 80 ? 'var(--good)' : c.pct >= 60 ? 'var(--accent-b)' : 'var(--bad)' }} /></div>
          </div>
        ))}
      </Card>
      {guide && <Card title={`Top tips for ${guide.name}`}><ul className="tips">{guide.tips.slice(0, 3).map((t) => <li key={t}>{t}</li>)}</ul></Card>}
    </div>
  );
}

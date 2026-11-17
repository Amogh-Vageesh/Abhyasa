// Written answers: he answers by typing and/or photos of his notebook; a parent marks each answer
// against the model answer and marking points; he then sees marks, missed points and the model answer.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon, Tile } from './icons';
import { writtenPool, saveAnswers, deleteAnswers, savePhoto, loadPhoto } from './lib/data';
import { SUBJECTS } from './lib/syllabus';
import { subjectChapters } from './Study';

const pctOf = (a) => (a.total ? Math.round((a.score / a.total) * 100) : 0);
const half = (x) => Math.round(x * 2) / 2;
const fmt = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

function Screen({ title, onClose, right, children, footer }) {
  return createPortal(
    <div className="reader wr-screen">
      <div className="reader-head">
        <button className="icon-btn" onClick={onClose} aria-label="Back"><Icon name="chevL" size={24} /></button>
        <b className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</b>
        {right}
      </div>
      <div className="reader-body wr-body"><div className="wr-col">{children}</div></div>
      {footer && <div className="wr-foot"><div className="wr-col row">{footer}</div></div>}
    </div>, document.body);
}

// ===================== student: choose chapters and start =====================
export function WrittenStart({ F, me }) {
  const [subject, setSubject] = useState('');
  const [counts, setCounts] = useState({});
  const [picked, setPicked] = useState([]);
  const [howMany, setHowMany] = useState(3);
  const [run, setRun] = useState(null);
  const chapters = subject ? subjectChapters(F, subject) : [];
  useEffect(() => {
    if (!subject) return;
    let alive = true;
    Promise.all(chapters.map(async (c) => [c.id, (await writtenPool([c.id])).length])).then((e) => alive && setCounts(Object.fromEntries(e)));
    setPicked([]);
    return () => { alive = false; };
  }, [subject]);
  const withQs = chapters.filter((c) => counts[c.id]);
  const start = async () => {
    const pool = await writtenPool(picked);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const qs = (howMany === 'all' ? shuffled : shuffled.slice(0, howMany)).sort((a, b) => a.chapterId.localeCompare(b.chapterId, undefined, { numeric: true }));
    const s = SUBJECTS.find((x) => x.id === subject);
    setRun({ title: `${s.name} · written answers`, questions: qs, subject, chapterIds: picked });
  };
  return (
    <div className="stack">
      <div className="note"><Tile icon="edit" tone="purple" /><div><b>Write answers like the exam</b><div className="small-text muted">Type your answer or write in your notebook and add a photo. Appa/Amma mark it and you see what you missed.</div></div></div>
      <div className="chips">{SUBJECTS.map((s) => <button key={s.id} className={`small ${subject === s.id ? 'primary' : ''}`} onClick={() => setSubject(s.id)}>{s.name}</button>)}</div>
      {subject && <div className="card list">
        {!withQs.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No written questions for this subject yet — ask Appa to add a question pack.</div>}
        {withQs.map((c) => {
          const on = picked.includes(c.id);
          return (
            <button key={c.id} className="lrow" onClick={() => setPicked(on ? picked.filter((x) => x !== c.id) : [...picked, c.id])}>
              <span className={`check-circle ${on ? 'on' : ''}`}>{on && <Icon name="check" size={16} />}</span>
              <div className="lt"><b>{c.no ? `${c.no}. ` : ''}{c.title}</b><small>{counts[c.id]} written questions</small></div>
            </button>
          );
        })}
      </div>}
      {picked.length > 0 && <div className="card">
        <div className="row between wrap" style={{ gap: 10 }}>
          <div className="seg" style={{ margin: 0 }}>{[3, 5, 'all'].map((n) => <button key={n} className={howMany === n ? 'on' : ''} onClick={() => setHowMany(n)}>{n === 'all' ? 'All' : `${n} questions`}</button>)}</div>
          <button className="primary" onClick={start}>Start writing <Icon name="chevR" size={18} /></button>
        </div>
      </div>}
      {run && <WrittenRunner F={F} me={me} {...run} onClose={() => setRun(null)} />}
    </div>
  );
}

// ===================== student: answer the questions =====================
export function WrittenRunner({ F, me, title, questions, subject, chapterIds, onClose }) {
  const [i, setI] = useState(0);
  const [ans, setAns] = useState({}); // qid -> { text, files: [File] }
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState('');
  const q = questions[i];
  const cur = ans[q?.id] || { text: '', files: [] };
  const set = (patch) => setAns({ ...ans, [q.id]: { ...cur, ...patch } });
  const previews = useMemo(() => cur.files.map((f) => URL.createObjectURL(f)), [cur.files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);
  const total = questions.reduce((a, x) => a + (x.marks || 0), 0);
  const blank = questions.filter((x) => !(ans[x.id]?.text?.trim() || ans[x.id]?.files?.length)).length;

  const submit = async () => {
    if (blank && !confirm(`${blank} question${blank > 1 ? 's are' : ' is'} still empty. Submit anyway?`)) return;
    setErr('');
    try {
      const nPhotos = Object.values(ans).reduce((a, x) => a + (x.files?.length || 0), 0);
      let done = 0;
      setBusy(nPhotos ? `Uploading photos 0/${nPhotos}` : 'Sending…');
      const items = [];
      for (const x of questions) {
        const a = ans[x.id] || { text: '', files: [] };
        const photos = [];
        for (const f of a.files || []) { photos.push(await savePhoto(F.family.id, f)); done++; setBusy(`Uploading photos ${done}/${nPhotos}`); }
        items.push({ qid: x.id, chapterId: x.chapterId, q: x.q, marks: x.marks, model: x.model, points: x.points || [], text: (a.text || '').trim(), photos });
      }
      await saveAnswers(F.family.id, { title, subject, chapterIds, status: 'submitted', by: me.name, items, total, date: new Date().toISOString().slice(0, 10) });
      onClose(true);
    } catch (x) { setBusy(null); setErr(String(x?.message || x)); }
  };

  return (
    <Screen title={title} onClose={() => (!Object.keys(ans).length || confirm('Leave without submitting? Your answers will be lost.')) && onClose()}
      right={<span className="small-text muted" style={{ whiteSpace: 'nowrap' }}>{i + 1} / {questions.length}</span>}
      footer={<>
        <button disabled={i === 0 || !!busy} onClick={() => setI(i - 1)}>Back</button>
        <span className="grow" />
        {i < questions.length - 1
          ? <button className="primary" onClick={() => setI(i + 1)}>Next <Icon name="chevR" size={18} /></button>
          : <button className="primary" disabled={!!busy} onClick={submit}>{busy || `Submit for marking`}</button>}
      </>}>
      <div className="wr-dots">{questions.map((x, k) => <button key={x.id} aria-label={`Question ${k + 1}`} className={`${k === i ? 'cur' : ''} ${(ans[x.id]?.text?.trim() || ans[x.id]?.files?.length) ? 'done' : ''}`} onClick={() => setI(k)} />)}</div>
      <div className="card wr-q">
        <div className="row between"><span className="pill">Q{i + 1}</span><span className="pill marks">{q.marks} mark{q.marks > 1 ? 's' : ''}</span></div>
        <p className="wr-qtext kn">{q.q}</p>
        <small className="muted">{q.marks <= 2 ? 'Answer in 2–3 sentences.' : 'Answer in 6–8 sentences with all main points.'}</small>
      </div>
      <textarea className="wr-text kn" rows={q.marks <= 2 ? 4 : 8} placeholder="Type your answer here (or write in your notebook and add a photo below)…" value={cur.text} onChange={(e) => set({ text: e.target.value })} />
      <div className="wr-photos">
        {previews.map((u, k) => (
          <div key={u} className="wr-thumb"><img src={u} alt={`Answer photo ${k + 1}`} /><button className="wr-x" aria-label="Remove photo" onClick={() => set({ files: cur.files.filter((_, j) => j !== k) })}>×</button></div>
        ))}
        <label className="wr-add"><Icon name="camera" size={22} /><span>{cur.files.length ? 'Add another' : 'Photo of answer'}</span>
          <input type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => { set({ files: [...cur.files, ...Array.from(e.target.files || [])] }); e.target.value = ''; }} /></label>
      </div>
      {err && <div className="feedback bad small-text">{err}</div>}
      <p className="muted small-text">Total {total} marks. The model answer is shown after Appa/Amma mark it.</p>
    </Screen>
  );
}

// ===================== list (student and parent) =====================
export function WrittenList({ F, me }) {
  const [open, setOpen] = useState(null);
  const isParent = me.role === 'parent';
  const list = [...F.answers].sort((a, b) => (isParent ? (a.status === 'submitted' ? 0 : 1) - (b.status === 'submitted' ? 0 : 1) : 0) || (b.at || 0) - (a.at || 0));
  const pending = F.answers.filter((a) => a.status === 'submitted').length;
  const cur = open && F.answers.find((a) => a.id === open);
  return (
    <div className="stack">
      <div className="sec-h"><h2>{isParent ? (pending ? `To mark (${pending})` : 'Written answers') : 'My written answers'}</h2></div>
      <div className="card list">
        {!list.length && <div className="muted small-text" style={{ padding: '12px 0' }}>{isParent ? 'Nothing to mark yet. When he submits written answers they appear here.' : 'No written answers yet. Pick a subject above and start.'}</div>}
        {list.map((a) => {
          const marked = a.status === 'marked';
          const pct = pctOf(a);
          return (
            <button key={a.id} className="lrow" onClick={() => setOpen(a.id)}>
              <Tile icon={marked ? 'check' : 'edit'} tone={marked ? (pct >= 75 ? 'green' : pct >= 50 ? 'amber' : 'red') : 'purple'} />
              <div className="lt"><b>{a.title}</b><small>{a.date} · {a.items?.length} question{a.items?.length > 1 ? 's' : ''} · {a.total} marks</small></div>
              {marked ? <b className={pct >= 75 ? 'ok' : pct < 50 ? 'bad-text' : ''}>{fmt(a.score)}/{a.total}</b>
                : <span className={`pill ${isParent ? 'warn' : ''}`}>{isParent ? 'Mark now' : 'Waiting'}</span>}
            </button>
          );
        })}
      </div>
      {cur && <AnswerSheet F={F} me={me} a={cur} onClose={() => setOpen(null)} />}
    </div>
  );
}

// ===================== one answer set: mark (parent) or view result =====================
function AnswerSheet({ F, me, a, onClose }) {
  const isParent = me.role === 'parent';
  const [marking, setMarking] = useState(isParent && a.status !== 'marked');
  const [st, setSt] = useState(() => (a.items || []).map((it) => ({ got: it.got || (it.points || []).map(() => false), adj: it.adj || 0, comment: it.comment || '' })));
  const [busy, setBusy] = useState(false);
  const [rerun, setRerun] = useState(null);
  const scoreOf = (it, s) => {
    const n = (it.points || []).length;
    const base = n ? half((it.marks * s.got.filter(Boolean).length) / n) : 0;
    return Math.max(0, Math.min(it.marks, base + s.adj));
  };
  const total = (a.items || []).reduce((x, it, k) => x + scoreOf(it, st[k]), 0);
  const upd = (k, patch) => setSt(st.map((s, j) => (j === k ? { ...s, ...patch } : s)));
  const save = async () => {
    setBusy(true);
    const items = a.items.map((it, k) => ({ ...it, got: st[k].got, adj: st[k].adj, comment: st[k].comment.trim(), score: scoreOf(it, st[k]) }));
    await saveAnswers(F.family.id, { id: a.id, items, status: 'marked', score: total, markedAt: Date.now(), markedBy: me.name });
    setBusy(false); setMarking(false);
  };
  const weak = (a.items || []).filter((it) => a.status === 'marked' && (it.score ?? 0) < it.marks * 0.6);
  const retry = () => setRerun(weak.map((it) => ({ id: it.qid, chapterId: it.chapterId, q: it.q, marks: it.marks, model: it.model, points: it.points })));

  if (rerun) return <WrittenRunner F={F} me={me} title={`Rewrite · ${a.title.replace(/^Rewrite · /, '')}`} questions={rerun} subject={a.subject} chapterIds={a.chapterIds || []} onClose={(sent) => { setRerun(null); if (sent) onClose(); }} />;

  const marked = a.status === 'marked';
  return (
    <Screen title={a.title} onClose={onClose}
      right={marked && !marking ? <b className="wr-score">{fmt(a.score)}/{a.total}</b> : marking ? <b className="wr-score">{fmt(total)}/{a.total}</b> : null}
      footer={marking ? <>
        <span className="small-text muted grow">Tick each point he covered. Use −½ / +½ for spelling, handwriting or extra credit.</span>
        <button className="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : `Save marks · ${fmt(total)}/${a.total}`}</button>
      </> : <>
        {isParent && <button className="ghost danger-ghost" onClick={async () => { if (confirm('Delete this answer set and its photos?')) { await deleteAnswers(F.family.id, a); onClose(); } }}><Icon name="trash" size={16} /> Delete</button>}
        <span className="grow" />
        {isParent && marked && <button onClick={() => setMarking(true)}>Change marks</button>}
        {!isParent && marked && weak.length > 0 && <button className="primary" onClick={retry}>Rewrite {weak.length} weak answer{weak.length > 1 ? 's' : ''}</button>}
      </>}>
      {!marked && !isParent && <div className="note"><Tile icon="clock" tone="purple" /><div><b>Waiting for marking</b><div className="small-text muted">Appa/Amma will mark this. You’ll see your marks, what you missed and the model answer here.</div></div></div>}
      {marked && !marking && <div className="card wr-summary">
        <div><small className="muted">Score</small><b>{fmt(a.score)} / {a.total}</b></div>
        <div><small className="muted">Percent</small><b className={pctOf(a) >= 75 ? 'ok' : pctOf(a) < 50 ? 'bad-text' : ''}>{pctOf(a)}%</b></div>
        <div><small className="muted">Marked by</small><b>{a.markedBy || '—'}</b></div>
      </div>}
      {(a.items || []).map((it, k) => {
        const s = st[k];
        const showKey = marking || marked || isParent;
        return (
          <div key={k} className="card wr-item">
            <div className="row between"><span className="pill">Q{k + 1}</span>
              {marking ? <span className="pill marks">{fmt(scoreOf(it, s))} / {it.marks}</span>
                : marked ? <span className={`pill marks ${it.score >= it.marks * 0.75 ? 'good' : it.score < it.marks * 0.5 ? 'bad' : ''}`}>{fmt(it.score ?? 0)} / {it.marks}</span>
                : <span className="pill marks">{it.marks} marks</span>}
            </div>
            <p className="wr-qtext kn">{it.q}</p>
            <div className="wr-label">{isParent ? 'His answer' : 'Your answer'}</div>
            {it.text ? <div className="wr-answer kn">{it.text}</div> : !it.photos?.length && <div className="wr-answer muted">No answer written.</div>}
            {it.photos?.length > 0 && <div className="wr-photos">{it.photos.map((pid) => <Photo key={pid} fid={F.family.id} id={pid} />)}</div>}
            {showKey && <>
              <div className="wr-label">Marking points</div>
              <div className="wr-points">
                {(it.points || []).map((p, j) => {
                  const got = marking ? s.got[j] : (it.got || [])[j];
                  return marking
                    ? <button key={j} className={`wr-point ${got ? 'on' : ''}`} onClick={() => upd(k, { got: s.got.map((g, x) => (x === j ? !g : g)) })}>
                        <span className={`check-circle ${got ? 'on' : ''}`}>{got && <Icon name="check" size={14} />}</span><span className="kn">{p}</span>
                      </button>
                    : <div key={j} className={`wr-point ro ${marked ? (got ? 'on' : 'miss') : ''}`}>
                        <span className={`wr-mark ${got ? 'ok' : marked ? 'no' : ''}`}>{marked ? (got ? '✓' : '✗') : '•'}</span><span className="kn">{p}</span>
                      </div>;
                })}
              </div>
              <div className="wr-label">Model answer</div>
              <div className="wr-model kn">{it.model}</div>
            </>}
            {marking && <div className="row wrap" style={{ gap: 8, marginTop: 10 }}>
              <div className="seg" style={{ margin: 0 }}>
                <button onClick={() => upd(k, { adj: s.adj - 0.5 })}>−½</button>
                <button className="on" style={{ pointerEvents: 'none' }}>{s.adj > 0 ? `+${fmt(s.adj)}` : fmt(s.adj)}</button>
                <button onClick={() => upd(k, { adj: s.adj + 0.5 })}>+½</button>
              </div>
              <input className="grow" placeholder="Note for him (optional) — e.g. ‘write the poet’s full name’" value={s.comment} onChange={(e) => upd(k, { comment: e.target.value })} />
            </div>}
            {!marking && it.comment && <div className="wr-comment"><Icon name="edit" size={15} /> {it.comment}</div>}
          </div>
        );
      })}
    </Screen>
  );
}

export function Photo({ fid, id }) {
  const [url, setUrl] = useState(null);
  const [big, setBig] = useState(false);
  const [fail, setFail] = useState(false);
  useEffect(() => {
    let u, alive = true;
    loadPhoto(fid, id).then((b) => { if (!alive) return; if (!b) return setFail(true); u = URL.createObjectURL(b); setUrl(u); }).catch(() => alive && setFail(true));
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [id]);
  if (fail) return <div className="wr-thumb wr-missing small-text muted">Photo unavailable</div>;
  if (!url) return <div className="wr-thumb"><div className="spinner" /></div>;
  return <>
    <button className="wr-thumb" onClick={() => setBig(true)} aria-label="Open photo"><img src={url} alt="Answer photo" /></button>
    {big && createPortal(<div className="wr-lightbox" onClick={() => setBig(false)}><img src={url} alt="Answer photo" /><button className="wr-x big" aria-label="Close">×</button></div>, document.body)}
  </>;
}

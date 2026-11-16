import { useMemo, useState } from 'react';
import { useEffect } from 'react';
import { markAnswer } from './lib/logic';
import { celebrate } from './lib/celebrate';
import { CHAPTERS, SUBJECTS, chapterLabel } from './lib/syllabus';

export function Card({ title, right, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && <div className="card-head"><h3>{title}</h3>{right}</div>}
      {children}
    </section>
  );
}

export function PageHead({ title, right, onBack }) {
  return (
    <div className="page-head">
      {onBack && <button className="icon-btn back-btn" onClick={onBack} aria-label="Back"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg></button>}
      <h1>{title}</h1><span className="sp" />{right}
    </div>
  );
}

export function Modal({ title, onClose, children }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="card-head"><h3 style={{ fontSize: 19 }}>{title}</h3><button className="ghost small" onClick={onClose}>✕</button></div>
        {children}
      </div>
    </div>
  );
}

export function ChapterPicker({ value, onChange, subject, onSubject, allowAny = false, chaptersFor }) {
  const base = SUBJECTS.find((s) => s.id === subject);
  const subj = base && { ...base, chapters: chaptersFor ? chaptersFor(subject) : base.chapters };
  return (
    <div className="row wrap">
      <select value={subject || ''} onChange={(e) => { onSubject(e.target.value); onChange(''); }}>
        <option value="">Subject…</option>
        {SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {subj && subj.chapters.length > 0 && (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">{allowAny ? 'Any chapter' : 'Chapter…'}</option>
          {subj.chapters.map((c) => <option key={c.id} value={c.id}>{c.book?.includes('II') ? 'II-' : c.book?.includes(' I') ? 'I-' : ''}{c.no}. {c.title}</option>)}
        </select>
      )}
    </div>
  );
}

export function MultiChapterPicker({ value = [], onChange }) {
  const [subject, setSubject] = useState('');
  const subj = SUBJECTS.find((s) => s.id === subject);
  return (
    <div>
      <div className="chips">
        {value.map((id) => <span key={id} className="chip" style={{ borderColor: CHAPTERS[id]?.color }}>{chapterLabel(id)} <button className="ghost small" onClick={() => onChange(value.filter((v) => v !== id))}>✕</button></span>)}
      </div>
      <div className="row wrap">
        <select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">Add chapter — subject…</option>
          {SUBJECTS.filter((s) => s.chapters.length).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {subj && (
          <select value="" onChange={(e) => { if (e.target.value && !value.includes(e.target.value)) onChange([...value, e.target.value]); }}>
            <option value="">Chapter…</option>
            {subj.chapters.map((c) => <option key={c.id} value={c.id}>{c.no}. {c.title}</option>)}
          </select>
        )}
      </div>
    </div>
  );
}

export function Progress({ value, max, color = 'var(--accent)' }) {
  const pct = max ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return <div className="progress"><div style={{ width: pct + '%', background: color }} /></div>;
}

export function rupees(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN');
}

// ---------------- Quiz runner ----------------
// questions: [{id, type, q, options, ans, why, chapterId}]
// onFinish({ items:[{qid, chapterId, correct, q}], score, total })
export function QuizRunner({ title, questions, onFinish, onCancel, timed = false }) {
  const [i, setI] = useState(0);
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState(null); // null | true | false | 'self'
  const [items, setItems] = useState([]);
  const [startedAt] = useState(Date.now());
  const q = questions[i];
  const done = i >= questions.length;

  const check = () => {
    const r = markAnswer(q, answer);
    setChecked(r === null ? 'self' : r);
  };
  const record = (correct) => {
    setItems((its) => [...its, { qid: q.id, chapterId: q.chapterId || null, correct, q: q.imported ? q : undefined, given: answer }]);
    setChecked(correct);
  };
  const next = () => {
    if (checked === 'self') return;
    if (items.length === i) record(checked);
    setI(i + 1); setAnswer(''); setChecked(null);
  };

  const result = useMemo(() => {
    if (!done) return null;
    const score = items.filter((x) => x.correct).length;
    return { items, score, total: items.length, seconds: Math.round((Date.now() - startedAt) / 1000) };
  }, [done]);

  if (!questions.length) {
    return <Card title={title}><p>No questions available for this yet.</p><button onClick={onCancel}>Back</button></Card>;
  }

  useEffect(() => { if (done && result && result.total && result.score / result.total >= 0.8) celebrate(); }, [done]);
  if (done) {
    const pct = Math.round((result.score / result.total) * 100);
    const wrong = result.items.filter((x) => !x.correct);
    return (
      <Card title={`${title} — done!`}>
        <div className="big-score">{result.score}/{result.total} <span>{pct}%</span></div>
        <p>{pct >= 90 ? 'Outstanding! 🌟' : pct >= 70 ? 'Good work! 👍' : 'Keep going — wrong answers are now in your Fix-it list. 💪'}</p>
        {wrong.length > 0 && <details><summary>Review {wrong.length} wrong answer(s)</summary>
          {wrong.map((w) => { const qq = questions.find((x) => x.id === w.qid); return (
            <div key={w.qid} className="review"><b>{qq.q}</b><div>Your answer: {w.given || '—'}</div><div className="ok">Answer: {qq.ans}</div>{qq.why && <div className="muted">{qq.why}</div>}</div>
          ); })}
        </details>}
        <button className="primary" onClick={() => onFinish(result)}>Save & continue</button>
      </Card>
    );
  }

  return (
    <Card title={title} right={<span className="muted">{i + 1} / {questions.length}{q.chapterId ? ' · ' + (CHAPTERS[q.chapterId]?.subjectName || '') : ''}</span>}>
      <Progress value={i} max={questions.length} />
      <p className="question">{q.q}</p>
      {(q.type === 'mcq' || q.type === 'tf') ? (
        <div className="options">
          {(q.options || ['True', 'False']).map((o) => (
            <button key={o} disabled={checked !== null}
              className={`option ${answer === o ? 'sel' : ''} ${checked !== null && o === q.ans ? 'right' : ''} ${checked === false && answer === o ? 'wrong' : ''}`}
              onClick={() => setAnswer(o)}>{o}</button>
          ))}
        </div>
      ) : q.type === 'short' ? (
        <textarea rows={3} value={answer} disabled={checked !== null} onChange={(e) => setAnswer(e.target.value)} placeholder="Write your answer (or answer on paper and type a few words)" />
      ) : (
        <input value={answer} disabled={checked !== null} inputMode={q.type === 'num' ? 'decimal' : 'text'} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" onKeyDown={(e) => e.key === 'Enter' && answer && checked === null && check()} />
      )}

      {checked === null && <div className="row"><button className="primary" disabled={!answer} onClick={check}>Check</button><button className="ghost" onClick={onCancel}>Quit</button></div>}
      {checked === 'self' && (
        <div className="feedback">
          <div><b>Model answer:</b> {q.ans}</div>
          <p>Was your answer correct (main points covered)?</p>
          <div className="row"><button className="primary" onClick={() => record(true)}>Yes ✓</button><button onClick={() => record(false)}>Not quite ✗</button></div>
        </div>
      )}
      {(checked === true || checked === false) && (
        <div className={`feedback ${checked ? 'good' : 'bad'}`}>
          <b>{checked ? 'Correct! ✓' : 'Not quite ✗'}</b>
          {!checked && <div>Answer: {q.ans}</div>}
          {q.why && <div className="muted">{q.why}</div>}
          <button className="primary" onClick={next}>{i + 1 === questions.length ? 'Finish' : 'Next →'}</button>
        </div>
      )}
    </Card>
  );
}

// true on wide screens (web/desktop layout)
export function useDesktop() {
  const q = '(min-width: 960px)';
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches);
  useEffect(() => { const m = window.matchMedia(q); const f = () => setD(m.matches); m.addEventListener?.('change', f); return () => m.removeEventListener?.('change', f); }, []);
  return d;
}

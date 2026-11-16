import { useEffect, useMemo, useState } from 'react';
import { Card, Modal, PageHead } from './components';
import { Icon, Tile } from './icons';
import { loadChapter, questionsById, setMistake } from './lib/data';
import { DIAGNOSES, REASONS, diagnose, markAnswer, mistakeAnalysis, shuffle, updateMistake, ymd } from './lib/logic';
import { reward } from './lib/actions';
import { chapterTitle, subjectOfFactory } from './Study';
import { SUBJECTS } from './lib/syllabus';

const FACES = ['😣', '😕', '😐', '🙂', '😎'];
const KID_TIPS = {
  'concept-gap': 'Read the chapter explainer again and ask your teacher or Appa/Amma about the part that’s confusing.',
  memory: 'Write facts and formulas on small cards and read them for 5 minutes a day.',
  careless: 'Before moving on: re-read the question, check your working, check your answer.',
  reading: 'Underline what is given and circle what is asked before you answer.',
  time: 'Practise with a timer, skip hard questions and come back to them.'
};
const FACE_TEXT = ['Totally lost', 'Confused', 'Okay-ish', 'Mostly get it', 'I can teach it!'];

// ---------- the probe: understand WHY a mistake happened ----------
export function MistakeProbe({ F, mistake, onClose }) {
  const [q, setQ] = useState(mistake.q || null);
  const [pack, setPack] = useState(null);
  const [step, setStep] = useState(0);
  const [retry, setRetry] = useState('');
  const [retryCorrect, setRetryCorrect] = useState(null);
  const [reason, setReason] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [checks, setChecks] = useState([]);
  const [checkAns, setCheckAns] = useState({});
  const [ownWords, setOwnWords] = useState('');
  const [saved, setSaved] = useState(null);
  const chapterId = mistake.chapterId || q?.chapterId;

  useEffect(() => {
    (async () => {
      if (!q && !mistake.manual) { const [x] = await questionsById([mistake.id]); if (x) setQ(x); }
      if (chapterId) {
        const p = await loadChapter(chapterId);
        setPack(p);
        if (p) setChecks(shuffle(p.questions.filter((x) => x.id !== mistake.id && (x.type === 'mcq' || x.type === 'tf'))).slice(0, 2));
      }
    })();
  }, []);

  const example = useMemo(() => {
    if (!pack) return null;
    const words = (q?.q || '').toLowerCase().split(/\W+/).filter((w) => w.length > 4);
    const scored = pack.explainer.map((e) => ({ e, s: words.filter((w) => (e.heading + ' ' + e.body).toLowerCase().includes(w)).length }));
    return (scored.sort((a, b) => b.s - a.s)[0] || {}).e;
  }, [pack, q]);

  const finish = async () => {
    const checksRight = checks.filter((c) => markAnswer(c, checkAns[c.id])).length;
    const probe = { date: ymd(), reason, confidence, retryCorrect: !!retryCorrect, checksRight, checksTotal: checks.length, ownWords: ownWords.trim(), given: mistake.given || null };
    probe.diagnosis = diagnose(probe);
    const updated = retryCorrect ? updateMistake(mistake, true, ymd()) : mistake;
    await setMistake(F.family.id, mistake.id, { ...updated, probe, probes: [...(mistake.probes || []), probe] });
    if (updated.resolved && !mistake.resolved) await reward(F, `mistake-${mistake.id}-${ymd()}`, F.settings.rewards.mistakeCleared, 'Fix-it cleared');
    setSaved(probe);
  };

  const steps = ['Try again', 'What happened?', 'How well do you get it?', 'Quick check', 'Connect it'];
  const total = steps.length;
  if (mistake.manual) return <Modal title="Test paper fix-it" onClose={onClose}><p>{mistake.text}</p><p className="muted small-text">Look at your answer sheet with Appa/Amma and write what went wrong in the paper’s reflection.</p></Modal>;

  if (saved) {
    const d = DIAGNOSES[saved.diagnosis];
    return (
      <Modal title="Thanks — now we know! 🎉" onClose={onClose}>
        <div className="stack">
          <div className={`diag ${d.tone}`}><small>What happened</small><b>{d.label}</b></div>
          <p className="small-text">{{
            'concept-gap': 'This idea isn’t clear yet — that’s okay! Read the explainer again and ask your teacher or Appa/Amma about it. It will come back in Revise.',
            memory: 'You understand it but forgot. Write the fact/formula on a small card and read it daily this week.',
            careless: 'You know this! Slow down and check your answer before moving on.',
            reading: 'Read the question twice. Underline what’s given and circle what’s asked.',
            time: 'Don’t rush — skip hard ones and come back at the end.'
          }[saved.diagnosis]}</p>
          {example?.example && <div className="explain"><b>Real-life link</b><p>🌍 {example.example}</p>{example.hook && <p className="hook">🧠 {example.hook}</p>}</div>}
          <p className="muted small-text">Your parents will see a short summary so they can help.</p>
          <button className="primary" onClick={onClose}>Done</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={`Find out why · ${step + 1}/${total}`} onClose={onClose}>
      <div className="probe-steps">{steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div>
      <div className="muted small-text" style={{ margin: '6px 0' }}>{chapterId ? chapterTitle(F, chapterId) : 'Imported test'}</div>
      <p className="question">{q?.q || 'Loading…'}</p>

      {step === 0 && q && <div className="stack">
        <p className="muted small-text">Try it once more — no pressure!</p>
        {(q.type === 'mcq' || q.type === 'tf') ? (
          <div className="options">{(q.options || ['True', 'False']).map((o) => (
            <button key={o} disabled={retryCorrect !== null} className={`option ${retry === o ? 'sel' : ''} ${retryCorrect !== null && o === q.ans ? 'right' : ''} ${retryCorrect === false && retry === o ? 'wrong' : ''}`} onClick={() => setRetry(o)}>{o}</button>
          ))}</div>
        ) : <input value={retry} disabled={retryCorrect !== null} onChange={(e) => setRetry(e.target.value)} placeholder="Your answer" />}
        {retryCorrect === null
          ? <div className="row"><button className="primary" disabled={!retry} onClick={() => { const r = markAnswer(q, retry); setRetryCorrect(r === null ? false : r); }}>Check</button><button className="ghost" onClick={() => { setRetryCorrect(false); }}>I don’t know</button></div>
          : <div className={`feedback ${retryCorrect ? 'good' : 'bad'}`}><b>{retryCorrect ? 'Got it this time! ✓' : `Answer: ${q.ans}`}</b>{q.why && <div className="muted small-text">{q.why}</div>}<button className="primary" onClick={() => setStep(1)}>Next →</button></div>}
      </div>}

      {step === 1 && <div className="stack">
        <p><b>What happened the first time?</b></p>
        <div className="reason-grid">{Object.entries(REASONS).map(([k, r]) => <button key={k} className={`reason ${reason === k ? 'sel' : ''}`} onClick={() => setReason(k)}><span>{r.icon}</span>{r.label}</button>)}</div>
        <button className="primary" disabled={!reason} onClick={() => setStep(2)}>Next →</button>
      </div>}

      {step === 2 && <div className="stack">
        <p><b>How well do you understand this chapter?</b></p>
        <div className="faces">{FACES.map((f, i) => <button key={f} className={`face ${confidence === i + 1 ? 'sel' : ''}`} onClick={() => setConfidence(i + 1)}><span>{f}</span><small>{FACE_TEXT[i]}</small></button>)}</div>
        <button className="primary" disabled={!confidence} onClick={() => setStep(checks.length ? 3 : 4)}>Next →</button>
      </div>}

      {step === 3 && <div className="stack">
        <p><b>Two quick questions on the same chapter</b></p>
        {checks.map((c, n) => (
          <div key={c.id} className="check-q">
            <div className="small-text"><b>{n + 1}. {c.q}</b></div>
            <div className="options">{(c.options || ['True', 'False']).map((o) => <button key={o} className={`option ${checkAns[c.id] === o ? 'sel' : ''}`} onClick={() => setCheckAns({ ...checkAns, [c.id]: o })}>{o}</button>)}</div>
          </div>
        ))}
        <button className="primary" disabled={checks.some((c) => !checkAns[c.id])} onClick={() => setStep(4)}>Next →</button>
      </div>}

      {step === 4 && <div className="stack">
        <p><b>Connect it to real life</b></p>
        {example && <div className="explain"><b>{example.heading}</b><p>{example.body}</p>{example.example && <p>🌍 <i>{example.example}</i></p>}</div>}
        <p className="small-text">In your own words: what is the idea, and where do you see it in everyday life? <span className="muted">(tap 🎤 on the keyboard to speak)</span></p>
        <textarea rows={3} value={ownWords} onChange={(e) => setOwnWords(e.target.value)} placeholder="e.g. Hot air rises, that’s why…" />
        <button className="primary" onClick={finish}>Finish</button>
      </div>}
    </Modal>
  );
}

// ---------- parent summary ----------
export function MistakeReport({ F, compact = false, go, me }) {
  const kid = me?.role !== 'parent';
  const subjectOf = subjectOfFactory(F);
  const a = mistakeAnalysis(F.mistakes, subjectOf);
  const recent = F.mistakes.filter((m) => m.probe).sort((x, y) => (y.probe.date || '').localeCompare(x.probe.date || ''));
  const totalP = a.probed || 1;
  if (compact) {
    return (
      <div className="card list">
        {!a.probed && <div className="lrow"><Tile icon="mistake" tone="gray" /><div className="lt"><b>No fix-its checked yet</b><small>{a.unprobed ? `${a.unprobed} fix-its waiting for “Find out why”` : 'They appear when he checks his fix-its'}</small></div></div>}
        {a.probed > 0 && <>
          <div className="diag-bars">{Object.entries(DIAGNOSES).map(([k, d]) => a.byDiag[k] ? (
            <div key={k} className={`diag-bar ${d.tone}`} style={{ flex: a.byDiag[k] }} title={`${d.label}: ${a.byDiag[k]}`} />
          ) : null)}</div>
          {a.top && <div className="lrow"><Tile icon="bulb" tone={DIAGNOSES[a.top].tone} /><div className="lt"><b>Main cause: {DIAGNOSES[a.top].label} ({Math.round((a.byDiag[a.top] / totalP) * 100)}%)</b><small style={{ whiteSpace: 'normal' }}>{DIAGNOSES[a.top].parent}</small></div></div>}
          {a.gapChapters.slice(0, 2).map((c) => <div key={c.id} className="lrow"><Tile icon="alert" tone="red" /><div className="lt"><b>{chapterTitle(F, c.id)}</b><small>{c.gaps} concept gap{c.gaps > 1 ? 's' : ''} — help him with this chapter</small></div></div>)}
          {go && <button className="lrow" onClick={() => go('insights', 'mistakes')}><Tile icon="chart" tone="blue" /><div className="lt"><b>Full fix-it report</b><small>{a.probed} analysed · {a.unprobed} waiting</small></div><Icon name="chevR" className="chev" /></button>}
        </>}
      </div>
    );
  }
  if (!a.probed) {
    return (
      <div className="card empty-state">
        <span style={{ fontSize: 44 }}>🕵️</span>
        <h3>{kid ? 'No fix-its checked yet' : 'Nothing to report yet'}</h3>
        <p className="muted small-text">{kid
          ? 'Open your Fix-it list and tap “Find out why”. A few quick questions show whether it was a slip, something you forgot, or a topic to learn again.'
          : `This report fills in when he taps “Find out why” on his fix-its.${a.unprobed ? ` ${a.unprobed} fix-it${a.unprobed > 1 ? 's are' : ' is'} waiting.` : ''}`}</p>
        {go && <button className="primary" onClick={() => go('mistakes')}>{kid ? 'Open Fix-it list' : 'See his fix-its'}</button>}
      </div>
    );
  }
  return (
    <div className="stack">
      <Card>
        <div className="kpis three">
          <div><small>Analysed</small><b>{a.probed}</b></div>
          <div><small>Waiting</small><b>{a.unprobed}</b></div>
          <div><small>Avg. confidence</small><b>{a.avgConfidence ? FACES[Math.round(a.avgConfidence) - 1] + ' ' + a.avgConfidence : '—'}</b></div>
        </div>
      </Card>
      <Card title={kid ? 'Why my wrong answers happen' : 'Why wrong answers happen'}>
        {Object.entries(DIAGNOSES).filter(([k]) => a.byDiag[k]).sort((x, y) => a.byDiag[y[0]] - a.byDiag[x[0]]).map(([k, d]) => (
          <div key={k} className="diag-row">
            <div className="row between"><b>{d.label}</b><span className={`pill ${d.tone}`}>{a.byDiag[k]} · {Math.round((a.byDiag[k] / totalP) * 100)}%</span></div>
            <div className="progress"><div className={`bg-${d.tone}`} style={{ width: `${(a.byDiag[k] / totalP) * 100}%` }} /></div>
            <p className="small-text muted">{kid ? 'Tip: ' : 'What you can do: '}{kid ? KID_TIPS[k] : d.parent}</p>
          </div>
        ))}
      </Card>
      {a.gapChapters.length > 0 && <Card title="Chapters with concept gaps">
        {a.gapChapters.map((c) => <div key={c.id} className="row between" style={{ padding: '6px 0' }}><span>{chapterTitle(F, c.id)} <span className="muted small-text">· {SUBJECTS.find((s) => s.id === subjectOf(c.id))?.name}</span></span><b className="bad-text">{c.gaps}</b></div>)}
      </Card>}
      <div className="sec-h"><h2>{kid ? 'My answers' : 'His answers'}</h2></div>
      <div className="card list">
        {!recent.length && <div className="muted small-text" style={{ padding: '12px 0' }}>Nothing yet.</div>}
        {recent.slice(0, 20).map((m) => { const d = DIAGNOSES[m.probe.diagnosis]; return (
          <div key={m.id} className="lrow" style={{ alignItems: 'flex-start' }}>
            <Tile icon="mistake" tone={d.tone} />
            <div className="lt">
              <b>{d.label} · {m.chapterId ? chapterTitle(F, m.chapterId) : 'Test'}</b>
              <small style={{ whiteSpace: 'normal' }}>{m.q?.q ? `Q: ${m.q.q} · ` : ''}Said: “{REASONS[m.probe.reason]?.label}” · Understanding {FACES[(m.probe.confidence || 3) - 1]} · Retry {m.probe.retryCorrect ? '✓' : '✗'} · Checks {m.probe.checksRight}/{m.probe.checksTotal}</small>
              {m.probe.ownWords && <small style={{ whiteSpace: 'normal' }}>In his words: “{m.probe.ownWords}”</small>}
            </div>
            <span className="muted small-text">{m.probe.date?.slice(5)}</span>
          </div>
        ); })}
      </div>
    </div>
  );
}

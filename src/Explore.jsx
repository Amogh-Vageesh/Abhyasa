// Explore: a 12-week "beyond school" discovery phase across four tracks (maths, science, logic & coding,
// English & reasoning). Tracked separately from school work: accuracy, enjoyment, time and consistency
// combine into a "leaning" signal that guides the long-term (olympiad / JEE / abroad) plan.
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Card, PageHead, QuizRunner } from './components';
import { Icon, Tile } from './icons';
import { loadExplore, startExplore, saveExplore } from './lib/data';
import { daysBetween, ymd } from './lib/logic';
import { openExternal } from './Ebooks';

const FACES = ['😫', '🙁', '😐', '🙂', '🤩'];
const FACE_LABEL = ['Did not like it', 'Not much', 'Okay', 'Liked it', 'Loved it!'];

export function weekOf(F) {
  const st = F.family?.exploreStart;
  if (!st) return null;
  return Math.min(12, Math.floor(daysBetween(st, ymd()) / 7) + 1);
}

export function exploreStats(F, data) {
  if (!data) return [];
  const week = weekOf(F) || 0;
  const avail = data.weeks.filter((w) => !w.locked && w.no <= week);
  return data.tracks.map((t) => {
    const docs = (F.explore || []).filter((d) => d.track === t.id);
    const score = docs.reduce((a, d) => a + (d.score || 0), 0);
    const total = docs.reduce((a, d) => a + (d.total || 0), 0);
    const rated = docs.filter((d) => d.enjoy);
    const enjoy = rated.length ? rated.reduce((a, d) => a + d.enjoy, 0) / rated.length : null;
    const minutes = docs.reduce((a, d) => a + (d.minutes || 0), 0);
    const acc = total ? score / total : null;
    const completion = avail.length ? Math.min(1, docs.length / avail.length) : 0;
    const lean = docs.length ? Math.round(100 * (0.5 * (acc ?? 0) + 0.35 * (enjoy ? (enjoy - 1) / 4 : 0) + 0.15 * completion)) : null;
    return { ...t, done: docs.length, avail: avail.length, acc, enjoy, minutes, lean };
  });
}

export function ExplorePage({ F, me }) {
  const [data, setData] = useState(null);
  const [run, setRun] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const isParent = me.role === 'parent';
  useEffect(() => { loadExplore().then(setData).catch(() => setData({ tracks: [], weeks: [], roadmap: [] })); }, []);
  const week = weekOf(F);
  const stats = useMemo(() => exploreStats(F, data), [F.explore, data, week]);
  const doc = (w, t) => (F.explore || []).find((d) => d.id === `w${w}-${t}`);
  if (!data) return <div><PageHead title="Explore" /><Card><div className="spinner" /></Card></div>;

  const kid = isParent ? 'he' : 'you';
  const baselineDone = data.tracks.every((t) => doc(0, t.id));
  const cur = week !== null && (!baselineDone ? data.weeks.find((w) => w.no === 0) : data.weeks.filter((w) => !w.locked && w.no <= week).find((w) => data.tracks.some((t) => !doc(w.no, t.id))) || data.weeks.filter((w) => !w.locked && w.no <= week).slice(-1)[0]);
  const ranked = [...stats].filter((s) => s.lean !== null).sort((a, b) => b.lean - a.lean);
  const sessions = (F.explore || []).length;

  return (
    <div className="ex">
      <PageHead title="Explore" />
      <div className="ex-hero card">
        <div className="ex-hero-txt">
          <small>Beyond school · discovery phase</small>
          <h2>{week === null ? 'Find what you’re great at' : `Week ${week} of 12`}</h2>
          <p className="muted">{week === null
            ? `12 weeks of short challenges in four areas. The app tracks scores and how much ${kid} enjoy${isParent ? 's' : ''} each, then shows where ${kid} naturally lean${isParent ? 's' : ''} — before choosing olympiads, JEE or study-abroad paths.`
            : `About 20 minutes per track each week. ${sessions} session${sessions === 1 ? '' : 's'} done so far.`}</p>
          {week === null && <button className="primary" onClick={() => startExplore(F.family.id, ymd())}>Start the 12-week discovery <Icon name="chevR" size={18} /></button>}
          {week !== null && <div className="progress" style={{ marginTop: 10 }}><div style={{ width: `${(week / 12) * 100}%`, background: 'linear-gradient(90deg, var(--accent-a), var(--accent-b))' }} /></div>}
        </div>
        <div className="ex-tracks-mini">{data.tracks.map((t) => <span key={t.id} style={{ '--tc': t.color }}><Icon name={t.icon} size={18} /></span>)}</div>
      </div>

      {cur && <>
        <div className="sec-h"><h2>{cur.no === 0 ? 'Start here: baseline check' : `This week · ${cur.title}`}</h2></div>
        {cur.intro && <p className="muted small-text">{cur.intro}</p>}
        <div className="ex-grid">
          {data.tracks.map((t) => {
            const d = doc(cur.no, t.id);
            const c = cur.tracks[t.id];
            return (
              <button key={t.id} className="card ex-card" style={{ '--tc': t.color }} onClick={() => !isParent && setRun({ week: cur, track: t })} disabled={isParent && !d}>
                <span className="ex-ico"><Icon name={t.icon} size={22} /></span>
                <small>{t.name}</small>
                <b>{c.title}</b>
                {d ? <span className="ex-done">✓ {d.score}/{d.total} {d.enjoy ? FACES[d.enjoy - 1] : ''}</span>
                  : <span className="ex-todo">{isParent ? 'Not done yet' : `${c.questions.length} questions${c.minutes ? ` · ~${c.minutes} min` : ''}`}</span>}
              </button>
            );
          })}
        </div>
      </>}

      {week !== null && <>
        <div className="sec-h"><h2>{isParent ? 'How he is doing' : 'Your progress'}</h2></div>
        <div className="card ex-stats">
          <div className="ex-row ex-head"><span>Track</span><span>Score</span><span>Enjoys</span><span>Time</span><span>Leaning</span></div>
          {stats.map((s) => (
            <div key={s.id} className="ex-row">
              <span className="ex-name"><i style={{ background: s.color }} />{s.name}<small>{s.done}/{s.avail || 0} done</small></span>
              <span>{s.acc === null ? '—' : `${Math.round(s.acc * 100)}%`}</span>
              <span>{s.enjoy ? FACES[Math.round(s.enjoy) - 1] : '—'}</span>
              <span>{s.minutes ? `${s.minutes}m` : '—'}</span>
              <span className="ex-lean"><span className="w-bar"><span style={{ width: `${s.lean || 0}%`, background: s.color }} /></span><b>{s.lean ?? '—'}</b></span>
            </div>
          ))}
          <p className="muted small-text" style={{ margin: '10px 0 0' }}>Leaning = 50% score + 35% enjoyment + 15% consistency. It becomes reliable after about 6–8 weeks.</p>
        </div>
        <Signal ranked={ranked} week={week} isParent={isParent} sessions={sessions} />
      </>}

      {week !== null && <>
        <div className="sec-h"><h2>All weeks</h2><button className="link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Hide' : 'Show'}</button></div>
        {showAll && <div className="card list">
          {data.weeks.map((w) => {
            const open = !w.locked && w.no <= week;
            const n = data.tracks.filter((t) => doc(w.no, t.id)).length;
            return (
              <div key={w.no} className="lrow" style={{ opacity: open ? 1 : 0.55 }}>
                <i className="tile" style={{ '--tc': '#6b7280', fontStyle: 'normal', fontWeight: 800 }}>{w.no}</i>
                <div className="lt"><b>{w.no === 0 ? 'Baseline check' : w.title}</b><small>{w.locked ? 'Coming — written after reviewing his results' : open ? `${n}/4 tracks done` : `Opens in week ${w.no}`}</small></div>
                {open && !isParent && <div className="row" style={{ gap: 4 }}>{data.tracks.map((t) => <button key={t.id} className="small ex-dot" title={t.name} style={{ '--tc': t.color }} onClick={() => setRun({ week: w, track: t })}>{doc(w.no, t.id) ? '✓' : t.name[0]}</button>)}</div>}
              </div>
            );
          })}
        </div>}
      </>}

      <div className="sec-h"><h2>The 3–4 year roadmap</h2></div>
      <div className="card ex-road">
        {data.roadmap.map((r, k) => (
          <div key={k} className="ex-step">
            <span className="ex-pin" />
            <div><small>{r.when} · {r.cls}</small><b>{r.title}</b><p>{r.text}</p></div>
          </div>
        ))}
      </div>

      <div className="sec-h"><h2>Free resources</h2></div>
      <p className="muted small-text">Hand-picked, free and well known. Use them with a parent’s account where a sign-up is needed.</p>
      <div className="ex-grid">
        {data.tracks.map((t) => (
          <div key={t.id} className="card ex-res" style={{ '--tc': t.color }}>
            <b>{t.name}</b><small className="muted">{t.goal}</small>
            {t.resources.map((r) => <button key={r.url} className="link ex-link" onClick={() => openExternal(r.url)}>{r.name} ↗</button>)}
          </div>
        ))}
      </div>

      {run && <Session F={F} week={run.week} track={run.track} prev={doc(run.week.no, run.track.id)} onClose={() => setRun(null)} />}
    </div>
  );
}

function Signal({ ranked, week, isParent, sessions }) {
  if (sessions < 4 || !ranked.length) return <div className="note"><Tile icon="clock" tone="purple" /><div><b>Signal builds over time</b><div className="small-text muted">Finish the baseline and a few weeks — the leaning shows up after about 4 weeks and firms up by week 8.</div></div></div>;
  const [a, b] = ranked;
  const close = b && a.lean - b.lean < 8;
  const stage = week >= 12 ? 'Discovery report' : week >= 8 ? 'Clear leaning' : 'Early signal';
  return (
    <div className="card ex-signal" style={{ '--tc': a.color }}>
      <small>{stage}</small>
      <b>{close ? `${a.name} and ${b.name}` : a.name}</b>
      <p className="muted">{close
        ? `${isParent ? 'He is' : 'You are'} doing similarly well in both and enjoying them — keep both going for now.`
        : `${isParent ? 'His' : 'Your'} strongest mix of score and enjoyment so far.`}
        {week >= 12 ? ' Suggested focus for the next phase: ' + (close ? `${a.name} + ${b.name}.` : `${a.name} (with ${b ? b.name : 'one other track'} as a second).`) : ''}</p>
    </div>
  );
}

function Session({ F, week, track, prev, onClose }) {
  const c = week.tracks[track.id];
  const [step, setStep] = useState(c.learn && week.no > 0 ? 'learn' : 'quiz');
  const [mins, setMins] = useState(0);
  const [res, setRes] = useState(null);
  const [enjoy, setEnjoy] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const id = `w${week.no}-${track.id}`;
    await saveExplore(F.family.id, id, {
      week: week.no, track: track.id, score: res.score, total: res.total,
      best: Math.max(prev?.best || 0, res.score), attempts: (prev?.attempts || 0) + 1,
      minutes: (prev?.minutes || 0) + mins + Math.max(1, Math.round(res.seconds / 60)),
      enjoy, note: note.trim(), date: ymd(), at: Date.now(),
      wrong: res.items.filter((x) => !x.correct).map((x) => x.qid)
    });
    onClose();
  };
  return createPortal(
    <div className="reader wr-screen">
      <div className="reader-head">
        <button className="icon-btn" onClick={onClose} aria-label="Back"><Icon name="chevL" size={24} /></button>
        <b className="grow">{track.name} · {c.title}</b>
      </div>
      <div className="reader-body wr-body"><div className="wr-col">
        {step === 'learn' && <>
          <div className="card ex-learn" style={{ '--tc': track.color }}>
            <small>Idea of the week</small>
            <p>{c.learn}</p>
          </div>
          <div className="card">
            <b>Optional warm-up</b>
            <p className="muted small-text" style={{ margin: '4px 0 10px' }}>Spend a few minutes on one of these, then come back for the challenge.</p>
            {track.resources?.map((r) => <button key={r.url} className="link ex-link" onClick={() => openExternal(r.url)}>{r.name} ↗</button>)}
            <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
              <span className="small-text muted">Time spent:</span>
              {[0, 10, 20, 30, 45].map((m) => <button key={m} className={`small ${mins === m ? 'primary' : ''}`} onClick={() => setMins(m)}>{m ? `${m} min` : 'None'}</button>)}
            </div>
          </div>
          <button className="primary" onClick={() => setStep('quiz')}>Start the challenge · {c.questions.length} questions <Icon name="chevR" size={18} /></button>
        </>}
        {step === 'quiz' && <QuizRunner title={c.title} questions={c.questions} doneHint="Good try — challenges are meant to stretch you. 💪" onCancel={onClose} onFinish={(r) => { setRes(r); setStep('rate'); }} />}
        {step === 'rate' && res && <div className="card ex-rate">
          <div className="big-score">{res.score}/{res.total}</div>
          <b>How much did you enjoy this?</b>
          <div className="ex-faces">{FACES.map((f, k) => <button key={k} className={enjoy === k + 1 ? 'on' : ''} aria-label={FACE_LABEL[k]} onClick={() => setEnjoy(k + 1)}><span>{f}</span><small>{FACE_LABEL[k]}</small></button>)}</div>
          <input placeholder="What felt hard or interesting? (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="primary" disabled={!enjoy || busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
        </div>}
      </div></div>
    </div>, document.body);
}

// Small summary for dashboards
export function ExploreSummary({ F, go, isParent }) {
  const [data, setData] = useState(null);
  useEffect(() => { loadExplore().then(setData).catch(() => {}); }, []);
  const week = weekOf(F);
  const top = exploreStats(F, data).filter((s) => s.lean !== null).sort((a, b) => b.lean - a.lean)[0];
  return (
    <button className="note wr-note" style={{ border: 0, width: '100%', marginBottom: 12 }} onClick={() => go('explore')}>
      <Tile icon="bulb" tone="amber" />
      <div style={{ textAlign: 'left' }}>
        <b>{week === null ? 'Explore: beyond school' : `Explore · week ${week} of 12`}</b>
        <div className="small-text muted">{week === null ? '12-week discovery across maths, science, logic and English — tap to start' : top && (F.explore || []).length >= 4 ? `Leaning so far: ${top.name}` : `${(F.explore || []).length} sessions done${isParent ? '' : ' — keep going!'}`}</div>
      </div>
    </button>
  );
}

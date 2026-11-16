// Desktop (web) home — website-style layout: big greeting, today's missions,
// a stats strip, subject cards, coming up and next steps.
import { Icon } from './icons';
import { rupees } from './components';
import { usePlan } from './Insights';
import { SUBJECTS } from './lib/syllabus';
import { subjectChapters, subjectOfFactory } from './Study';
import { daysBetween, studyStats, ymd } from './lib/logic';
import { words } from './theme';
import { allEvents } from './Shared';
import { MissionCheck } from './Student';
import { markStep } from './lib/actions';

const SUBJ_COLORS = { maths: ['#2563eb', '#eff4ff'], science: ['#059669', '#ecfdf5'], social: ['#ea580c', '#fff4ed'], english: ['#7c3aed', '#f4f0ff'], other: ['#db2777', '#fdf0f6'] };

function Ring({ value, max, size = 84 }) {
  const r = size / 2 - 8; const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} of ${max} done`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--w-line2)" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--accent-b)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(c * value) / max} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy="7" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">{value}/{max}</text>
    </svg>
  );
}

const SHORT = { logDone: 'Log classes', homework: 'Homework', learnDone: 'Learn', practiceDone: 'Practice', reviseDone: 'Revise' };
const DONE_WORD = { logDone: 'logged your classes', homework: 'finished homework', learnDone: 'done your learning', practiceDone: 'practised', reviseDone: 'revised' };
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

export function DeskHome({ F, go, routine, doneCount, streak, greet, openMistakes, balance, onLog, onNoSchool }) {
  const today = ymd();
  const upcoming = allEvents(F).filter((e) => e.date >= today && daysBetween(today, e.date) <= 14).sort((a, b) => a.date.localeCompare(b.date));
  const name = F.family.studentName?.split(' ')[0] || '';
  const next = routine.find((r) => !r.done);
  const subjectOf = subjectOfFactory(F);
  const week = studyStats(F, 'week', today, subjectOf);
  const plan = usePlan(F).slice(0, 2);
  const dateLine = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
  const doneWords = routine.filter((r) => r.done).map((r) => DONE_WORD[r.key]);
  const nextName = next ? SHORT[next.key] || next.label : '';
  const nextSub = next ? next.sub.charAt(0).toLowerCase() + next.sub.slice(1) : '';
  const joined = doneWords.length > 1 ? `${doneWords.slice(0, -1).join(', ')} and ${doneWords.at(-1)}` : doneWords[0];
  const intro = !next ? 'Every mission is done for today. Take a break — you earned it.'
    : doneWords.length ? `You’ve ${joined}. ${nextName} is next: ${nextSub}.`
    : `Start with ${nextName.toLowerCase()}: ${nextSub}.`;

  const subjects = SUBJECTS.map((s) => {
    const chs = subjectChapters(F, s.id);
    const st = (id) => F.chapters[id]?.status || 'not-started';
    const started = chs.filter((c) => st(c.id) !== 'not-started').length;
    const nxt = chs.find((c) => st(c.id) === 'taught') || chs.find((c) => st(c.id) === 'not-started');
    const [c, bg] = SUBJ_COLORS[s.id] || ['#475569', '#f1f5f9'];
    return { ...s, total: chs.length, started, pct: chs.length ? Math.round((started / chs.length) * 100) : 0, next: nxt ? `${nxt.no ? `Ch ${nxt.no} · ` : ''}${nxt.title}` : chs.length ? 'All chapters started' : 'Add lessons', c, bg };
  });

  return (
    <div className="w-home">
      <section className="w-hero">
        <div className="w-hero-main">
          <p className="w-eyebrow">{dateLine}{streak ? ` · ${streak}-day streak` : ''}</p>
          <h1 className="w-h1">{greet}, {name}.<br /><span>{next ? `${nextName} is next.` : 'All done for today.'}</span></h1>
          <p className="w-lead">{intro}</p>
          <div className="w-ctas">
            {next && <button className="w-btn dark" onClick={next.run}>{next.key === 'logDone' ? 'Log classes' : next.key === 'homework' ? 'Mark homework done' : `Start ${nextName.toLowerCase()}`}<Icon name="chevR" size={18} /></button>}
            {next?.key === 'logDone'
              ? <button className="w-btn" onClick={onNoSchool}>No school today</button>
              : <button className="w-btn" onClick={onLog}>Log another class</button>}
          </div>
        </div>
        <div className="w-card w-missions">
          <div className="w-missions-top">
            <Ring value={doneCount} max={5} />
            <div><div className="w-label">{words().routine}</div><div className="w-big">{doneCount === 5 ? 'All done' : `${doneCount} of 5 done`}</div></div>
          </div>
          {routine.map((r) => (
            <button key={r.key} className={`w-mrow ${r.done ? 'done' : ''}`} onClick={r.run}>
              <MissionCheck className="w-dot" done={r.done} label={r.label} onToggle={() => markStep(F, r.key, !r.done)} />
              <span className="w-mlabel">{SHORT[r.key] || r.label}</span>
              <span className="w-mmeta">{r.done ? 'Done' : r === next ? 'Next' : ''}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="w-stats">
        <button onClick={() => go('study')}><span className="w-label">Study time this week</span><b>{fmtMin(week.minutes || 0)}</b></button>
        <button onClick={() => go('practice', 'progress')}><span className="w-label">Practice accuracy</span><b>{week.accuracy == null ? '—' : `${week.accuracy}%`}</b></button>
        <button onClick={() => go('mistakes')}><span className="w-label">Fix-its open</span><b>{openMistakes}</b></button>
        <button onClick={() => go('wallet')}><span className="w-label">Rewards to collect</span><b>{rupees(balance)}</b></button>
      </section>

      <section className="w-sec">
        <div className="w-sec-h"><h2>Your subjects</h2><button className="w-link" onClick={() => go('study')}>See all chapters →</button></div>
        <div className="w-subjects">
          {subjects.map((s) => (
            <button key={s.id} className="w-card w-subj" onClick={() => go('study', { subject: s.id })}>
              <span className="w-subj-ico" style={{ background: s.bg, color: s.c }}><Icon name="book" size={20} /></span>
              <span><b>{s.name}</b><small>{s.total ? `${s.started} of ${s.total} ${s.id === 'other' ? 'lessons' : 'chapters'}` : 'No lessons yet'}</small></span>
              <span className="w-bar"><span style={{ width: `${s.pct}%`, background: s.c }} /></span>
              <span className="w-next">Up next · {s.next}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="w-two">
        <div className="w-col-wide">
          <div className="w-sec-h"><h2>Coming up</h2><button className="w-link" onClick={() => go('calendar')}>Calendar →</button></div>
          <div className="w-card w-list">
            {!upcoming.length && <div className="w-empty">Nothing in the next two weeks.</div>}
            {upcoming.slice(0, 4).map((e) => {
              const gap = daysBetween(today, e.date);
              return (
                <button key={e.id} className="w-event" onClick={() => go('calendar')}>
                  <span className="w-date"><b>{Number(e.date.slice(8))}</b><small>{new Date(e.date).toLocaleString('en-IN', { month: 'short' })}</small></span>
                  <span className="w-ev-main"><b>{e.title}</b><small>{gap === 0 ? 'Today' : gap === 1 ? 'Tomorrow' : `In ${gap} days`}{e.time ? ` · ${e.time}` : ''}</small></span>
                  <span className={`w-pill ${e.type || ''}`}>{e.type === 'test' ? 'Test' : e.type === 'holiday' ? 'Holiday' : e.type === 'school' ? 'School' : 'Event'}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="w-col">
          <div className="w-sec-h"><h2>Next steps</h2><button className="w-link" onClick={() => go('insights')}>All →</button></div>
          <div className="w-card w-steps">
            {plan.map((p, i) => (
              <div key={i} className="w-step">
                <b>{p.title}</b>
                <p>{p.text}</p>
                {p.action && <button className="w-btn sm" onClick={() => go('act', p.action)}>{p.action.label}</button>}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

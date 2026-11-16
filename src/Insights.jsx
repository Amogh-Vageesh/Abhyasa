import { useState } from 'react';
import { Card, PageHead } from './components';
import { Icon, Tile } from './icons';
import { BEST_PRACTICES, buildInsights, actionPlan, ymd } from './lib/logic';
import { MistakeReport } from './Probe';
import { subjectOfFactory, chapterTitle } from './Study';
import { SUBJECTS } from './lib/syllabus';
import { EXAM_GUIDES, GENERAL_EXAM_TIPS } from './lib/content';

const TONE = { good: ['check', 'green'], warn: ['alert', 'red'], tip: ['bulb', 'amber'] };

export function useInsights(F) {
  return buildInsights({ days: F.days, attempts: F.attempts, tasks: F.tasks, blocks: F.blocks, mistakes: F.mistakes, today: ymd() });
}

export function usePlan(F) {
  return actionPlan(F, ymd(), { subjectOf: subjectOfFactory(F), chapterName: (id) => chapterTitle(F, id), subjectName: (s) => SUBJECTS.find((x) => x.id === s)?.name || s });
}

const ACT_TONE = { warn: 'red', tip: 'amber', good: 'green' };
export function ActionList({ F, go, limit = 20, parent = false }) {
  const plan = usePlan(F).slice(0, limit);
  return (
    <div className="card list">
      {plan.map((p, i) => (
        <div key={i} className={`action ${p.tone}`}>
          <Tile icon={p.icon} tone={ACT_TONE[p.tone] || 'amber'} />
          <div className="lt">
            <b>{p.title}</b>
            <small style={{ whiteSpace: 'normal' }}>{p.text}</small>
            {p.action && go && !parent && <button className="small primary act-btn" onClick={() => go('act', p.action)}>{p.action.label} →</button>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InsightsPage({ F, initial = 'insights', go, me }) {
  const [tab, setTab] = useState(initial === 'mistakes' ? 'mistakes' : initial);
  const [subject, setSubject] = useState('maths');
  const insights = useInsights(F);
  const g = EXAM_GUIDES[subject];
  return (
    <div>
      <PageHead title="Insights & Tips" />
      <div className="seg scroll">{[['insights', me?.role === 'parent' ? 'What to do' : 'My next steps'], ['mistakes', 'Mistakes'], ['habits', 'Habits'], ['exams', 'Exam prep']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'insights' && <div className="stack">
        <p className="muted small-text" style={{ margin: 0 }}>Made from {me?.role === 'parent' ? 'his' : 'your'} classes, practice, tests, mistakes, upcoming exams and timetable — most important first.</p>
        <ActionList F={F} go={go} parent={me?.role === 'parent'} />
        <div className="sec-h"><h2>How {me?.role === 'parent' ? 'he is' : 'you are'} doing</h2></div>
        <div className="card list">{insights.map((i, n) => <InsightRow key={n} i={i} />)}</div>
      </div>}
      {tab === 'mistakes' && <MistakeReport F={F} />}
      {tab === 'habits' && <div className="card list">
        {BEST_PRACTICES.map((b) => <div key={b.title} className="lrow"><Tile icon="bulb" tone="amber" /><div className="lt"><b>{b.title}</b><small style={{ whiteSpace: 'normal' }}>{b.text}</small></div></div>)}
      </div>}
      {tab === 'exams' && <div className="stack">
        <div className="chips">{Object.entries(EXAM_GUIDES).map(([k, v]) => <button key={k} className={`small ${subject === k ? 'primary' : ''}`} onClick={() => setSubject(k)}>{v.name}</button>)}</div>
        <Card title={`${g.name}: how to score high`}>
          <p className="small-text muted">{g.pattern}</p>
          <ol className="tips">{g.tips.map((t) => <li key={t}>{t}</li>)}</ol>
        </Card>
        <Card title="2 days before the test"><ul className="tips">{g.before.map((t) => <li key={t}>{t}</li>)}</ul></Card>
        <Card title="In the exam hall"><ul className="tips">{g.inExam.map((t) => <li key={t}>{t}</li>)}</ul></Card>
        <Card title="For every subject"><ul className="tips">{GENERAL_EXAM_TIPS.map((t) => <li key={t}>{t}</li>)}</ul></Card>
      </div>}
    </div>
  );
}

export function InsightRow({ i, onClick }) {
  const [icon, tone] = TONE[i.tone] || TONE.tip;
  return (
    <div className="lrow" onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      <Tile icon={icon} tone={tone} />
      <div className="lt"><b>{i.title}</b><small style={{ whiteSpace: 'normal' }}>{i.text}</small></div>
      {onClick && <Icon name="chevR" className="chev" />}
    </div>
  );
}

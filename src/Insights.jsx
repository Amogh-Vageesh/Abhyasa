import { useState } from 'react';
import { Card, PageHead } from './components';
import { Icon, Tile } from './icons';
import { BEST_PRACTICES, buildInsights, ymd } from './lib/logic';
import { EXAM_GUIDES, GENERAL_EXAM_TIPS } from './lib/content';

const TONE = { good: ['check', 'green'], warn: ['alert', 'red'], tip: ['bulb', 'amber'] };

export function useInsights(F) {
  return buildInsights({ days: F.days, attempts: F.attempts, tasks: F.tasks, blocks: F.blocks, mistakes: F.mistakes, today: ymd() });
}

export function InsightsPage({ F, initial = 'insights' }) {
  const [tab, setTab] = useState(initial);
  const [subject, setSubject] = useState('maths');
  const insights = useInsights(F);
  const g = EXAM_GUIDES[subject];
  return (
    <div>
      <PageHead title="Insights & Tips" />
      <div className="seg">{[['insights', 'For you'], ['habits', 'Habits'], ['exams', 'Exam prep']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'insights' && <div className="card list">
        <p className="muted small-text" style={{ margin: '10px 0 4px' }}>Based on the last 4 weeks of routine, practice, tasks and timetable.</p>
        {insights.map((i, n) => <InsightRow key={n} i={i} />)}
      </div>}
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

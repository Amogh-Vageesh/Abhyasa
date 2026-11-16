import { Card, PageHead, Progress } from './components';
import { badges, levelInfo } from './lib/xp';
import { words } from './theme';

export function BadgesPage({ F }) {
  const lv = levelInfo(F);
  const b = badges(F);
  const got = b.list.filter((x) => x.got).length;
  return (
    <div>
      <PageHead title={`${words().badges} & level`} />
      <Card className="level-card">
        <div className="level-ring">⭐<b>{lv.level}</b></div>
        <div className="grow">
          <div className="muted small-text">Level {lv.level}</div>
          <h2 style={{ margin: 0 }}>{lv.name}</h2>
          <Progress value={lv.into} max={lv.span} color="linear-gradient(90deg, var(--accent-a), var(--accent-b))" />
          <div className="muted small-text">{lv.xp} XP · {lv.next - lv.xp} XP to {lv.nextName}</div>
        </div>
      </Card>
      <div className="stats" style={{ marginTop: 12 }}>
        <div className="stat" style={{ '--tc': '#ee8a12' }}><small>Streak now</small><b>🔥 {b.current}</b></div>
        <div className="stat" style={{ '--tc': '#8b5cf6' }}><small>Best streak</small><b>🚀 {b.best}</b></div>
        <div className="stat" style={{ '--tc': '#1f9d55' }}><small>Badges</small><b>{got}/{b.list.length}</b></div>
      </div>
      <div className="sec-h"><h2>{words().badges}</h2></div>
      <div className="badge-grid">
        {b.list.map((x) => (
          <div key={x.id} className={`badge ${x.got ? 'got' : ''}`}>
            <span className="badge-icon">{x.icon}</span>
            <b>{x.title}</b>
            <small>{x.got ? 'Earned!' : x.how}</small>
          </div>
        ))}
      </div>
      <Card title="How to earn XP" className="mt">
        <ul className="tips">
          <li>Each routine step: +10 XP · full day: +20 XP</li>
          <li>Each class logged: +5 XP · each correct answer: +2 XP</li>
          <li>Each fix-it cleared or task done: +5 XP · test paper added: +10 XP · goal achieved: +50 XP</li>
        </ul>
      </Card>
    </div>
  );
}

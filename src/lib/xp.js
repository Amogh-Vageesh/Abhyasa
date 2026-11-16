// XP, levels and badges — computed from existing data (no extra storage)
import { currentStreak, ymd, addDays } from './logic';

export const LEVELS = ['Explorer', 'Learner', 'Achiever', 'Scholar', 'Champion', 'Genius', 'Legend', 'Master'];

export function xpOf(F) {
  let xp = 0;
  for (const d of Object.values(F.days || {})) {
    xp += ['logDone', 'homework', 'learnDone', 'practiceDone', 'reviseDone'].filter((k) => d[k]).length * 10;
    if (d.completed) xp += 20;
    xp += (d.logs || []).length * 5;
  }
  for (const a of F.attempts || []) for (const it of a.items || []) if (it.correct) xp += 2;
  xp += (F.mistakes || []).filter((m) => m.resolved).length * 5;
  for (const t of F.tasks || []) xp += Object.values(t.done || {}).filter(Boolean).length * 5;
  xp += (F.papers || []).length * 10;
  return xp;
}

// Level n needs 100 * n * (n-1) / 2 ... simple growing curve
export function levelInfo(F) {
  const xp = xpOf(F);
  let level = 1;
  while (xp >= need(level + 1)) level++;
  const cur = need(level), next = need(level + 1);
  return { xp, level, name: LEVELS[Math.min(level - 1, LEVELS.length - 1)], into: xp - cur, span: next - cur, next };
}
function need(level) { return 50 * (level - 1) * level; } // 0, 100, 300, 600, 1000, ...

export function badges(F) {
  const today = ymd();
  const days = F.days || {};
  // longest streak ever
  let best = 0, run = 0;
  const dates = Object.keys(days).sort();
  if (dates.length) {
    for (let d = dates[0]; d <= today; d = addDays(d, 1)) { if (days[d]?.completed) { run++; best = Math.max(best, run); } else run = 0; }
  }
  const correct = (F.attempts || []).reduce((a, x) => a + (x.items || []).filter((i) => i.correct).length, 0);
  const cleared = (F.mistakes || []).filter((m) => m.resolved).length;
  const topTest = Math.max(0, ...(F.attempts || []).filter((a) => a.kind === 'test' || a.kind === 'imported').map((a) => a.pct || 0));
  const logs = Object.values(days).reduce((a, d) => a + (d.logs || []).length, 0);
  const list = [
    ['first-log', '📝', 'First class logged', 'Log what was taught', logs >= 1],
    ['logs-50', '📚', 'Class reporter', 'Log 50 classes', logs >= 50],
    ['streak-3', '🔥', '3-day streak', 'Finish the routine 3 days in a row', best >= 3],
    ['streak-7', '🚀', '7-day streak', 'A full week of routine', best >= 7],
    ['streak-30', '👑', '30-day streak', 'A whole month!', best >= 30],
    ['q-100', '🎯', '100 correct answers', 'Keep practising', correct >= 100],
    ['q-500', '🏹', '500 correct answers', 'Sharpshooter', correct >= 500],
    ['fix-10', '🛠️', 'Mistake fixer', 'Clear 10 mistakes', cleared >= 10],
    ['test-90', '🏆', 'Top scorer', 'Score 90%+ in a test', topTest >= 90],
    ['plan', '🗓️', 'Planner', 'Make your timetable', (F.blocks || []).length >= 3],
    ['money', '💰', 'Money smart', 'Track 10 money entries', (F.money || []).length >= 10],
    ['papers', '🧾', 'Paper pro', 'Add 5 test papers', (F.papers || []).length >= 5]
  ];
  return { best, current: currentStreak(days, today), list: list.map(([id, icon, title, how, got]) => ({ id, icon, title, how, got })) };
}

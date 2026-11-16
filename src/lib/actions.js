import { celebrate } from './celebrate';
import { addAttempt, addWallet, setChapter, setDay, setMistake } from './data';
import { cappedAmount, currentStreak, testReward, updateMistake, ymd } from './logic';

// Give a reward once (deterministic id) and respect the monthly cap
export async function reward(F, id, amount, reason) {
  if (!amount || F.wallet.some((w) => w.id === id)) return 0;
  const today = ymd();
  const amt = cappedAmount(amount, F.wallet, today, F.settings.rewards.monthlyCap);
  if (amt <= 0) return 0;
  await addWallet(F.family.id, id, { type: 'earn', amount: amt, reason, date: today });
  return amt;
}

// Save a finished quiz: attempt, mistake book, mistake-cleared rewards
export async function recordQuiz(F, kind, result, extra = {}) {
  const fid = F.family.id;
  const today = ymd();
  const mistakes = Object.fromEntries(F.mistakes.map((m) => [m.id, m]));
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const ref = await addAttempt(fid, {
    kind, date: today, score: result.score, total: result.total, pct, seconds: result.seconds || 0,
    items: result.items.map(({ qid, chapterId, correct }) => ({ qid, chapterId, correct })), ...extra
  });
  for (const it of result.items) {
    const existing = mistakes[it.qid];
    if (!it.correct || (existing && !existing.resolved)) {
      const updated = updateMistake(existing, it.correct, today);
      await setMistake(fid, it.qid, { ...updated, qid: it.qid, chapterId: it.chapterId || null, ...(it.q ? { q: it.q } : {}), ...(!it.correct && it.given ? { given: it.given } : {}) });
      if (updated.resolved && existing && !existing.resolved) {
        await reward(F, `mistake-${it.qid}-${today}`, F.settings.rewards.mistakeCleared, 'Mistake cleared');
      }
    }
  }
  if (kind === 'test' || kind === 'imported') {
    const r = testReward(pct, F.settings.rewards);
    if (r) await reward(F, `test-${ref.id}`, r.amount, `${r.label}: ${extra.title || 'Test'}`);
  }
  return { id: ref.id, pct };
}

export const STEPS = [
  { key: 'logDone', label: 'Log today’s classes', icon: '📝' },
  { key: 'homework', label: 'Homework done', icon: '📒' },
  { key: 'learnDone', label: 'Learn (10 min)', icon: '💡' },
  { key: 'practiceDone', label: 'Practice', icon: '🎯' },
  { key: 'reviseDone', label: 'Revise + mistakes', icon: '🔁' }
];

export async function markStep(F, key, value = true) {
  const fid = F.family.id;
  const today = ymd();
  const day = { ...(F.days[today] || {}), [key]: value };
  const completed = STEPS.every((s) => day[s.key]);
  await setDay(fid, today, { [key]: value, [key + 'At']: Date.now(), completed, ...(completed && !F.days[today]?.completed ? { completedAt: Date.now() } : {}) });
  if (completed && !F.days[today]?.completed) {
    celebrate(true);
    await reward(F, `day-${today}`, F.settings.rewards.dayComplete, 'Full routine done');
    const streak = currentStreak({ ...F.days, [today]: { completed: true } }, today);
    if (streak > 0 && streak % 7 === 0) await reward(F, `streak-${today}`, F.settings.rewards.streak7, `${streak}-day streak!`);
  }
}

export async function logClass(F, entry) {
  const fid = F.family.id;
  const today = ymd();
  const logs = [...(F.days[today]?.logs || []), { ...entry, at: Date.now() }];
  await setDay(fid, today, { logs });
  if (entry.chapterId) {
    const ch = F.chapters[entry.chapterId];
    await setChapter(fid, entry.chapterId, {
      status: ch?.status && ch.status !== 'not-started' ? ch.status : 'taught',
      taughtOn: ch?.taughtOn || today,
      lastTaught: today,
      ...(ch?.taughtOn && ch.taughtOn !== today ? { reviewsDone: [], taughtOn: today } : {}) // re-taught: restart spacing
    });
  }
  await markStep(F, 'logDone', true);
}

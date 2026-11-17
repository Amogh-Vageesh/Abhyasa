// Shared "start a session" builders used by both the classic home and the kid journey.
import { questionPool, questionsById, setChapter } from './data';
import { markStep } from './actions';
import { daysBetween, dueChapters, pickQuestions, testWeights, ymd } from './logic';

export function todaysChapterIds(F, today = ymd()) {
  const day = F.days[today] || {};
  return [...new Set((day.logs || []).map((l) => l.chapterId).filter(Boolean))];
}

export function recentTaughtIds(F, n = 3) {
  return Object.values(F.chapters).filter((c) => c.taughtOn)
    .sort((a, b) => (b.lastTaught || '').localeCompare(a.lastTaught || '')).slice(0, n).map((c) => c.id);
}

// count: how many questions (energy check can change it)
export async function buildPractice(F, count = F.settings.practiceCount) {
  const today = ymd();
  let chIds = todaysChapterIds(F, today);
  if (!chIds.length) chIds = recentTaughtIds(F);
  const pool = await questionPool(chIds);
  const recent = new Set(F.attempts.filter((a) => a.date === today).flatMap((a) => a.items.map((x) => x.qid)));
  const qs = pickQuestions(pool, count, { exclude: recent, weights: testWeights(F.events, today) });
  return { kind: 'practice', title: 'Practice', questions: qs, chIds, onDone: () => markStep(F, 'practiceDone') };
}

export function openFixits(F, today = ymd()) {
  return F.mistakes.filter((m) => !m.resolved && !m.manual && m.lastRightDate !== today)
    .sort((a, b) => (b.wrongCount || 0) - (a.wrongCount || 0));
}

export async function buildRevise(F, { onlyMistakes = false } = {}) {
  const today = ymd();
  const due = onlyMistakes ? [] : dueChapters(F.chapters, today);
  const pool = due.length ? await questionPool(due.map((d) => d.id)) : [];
  const qs = pickQuestions(pool, F.settings.reviseCount, { weights: testWeights(F.events, today) });
  const open = openFixits(F, today).slice(0, F.settings.mistakesPerRevise);
  const mq = [
    ...(await questionsById(open.filter((m) => !m.q).map((m) => m.id))).map((q) => ({ ...q, chapterId: q.chapterId || q.id.replace(/-q\d+$/, '') })),
    ...open.filter((m) => m.q).map((m) => m.q)
  ];
  const all = [...mq, ...qs.filter((q) => !mq.some((m) => m.id === q.id))];
  const finish = async () => {
    for (const d of due) {
      const ch = F.chapters[d.id];
      await setChapter(F.family.id, d.id, { reviewsDone: [...(ch.reviewsDone || []), ...d.pending], lastRevised: today, status: ch.status === 'taught' ? 'revised' : ch.status });
    }
    await markStep(F, 'reviseDone');
  };
  return { kind: 'revise', title: onlyMistakes ? 'Fix my mistakes' : 'Revise + Fix-its', questions: all, onDone: finish, empty: !all.length };
}

export async function buildWeekly(F) {
  const today = ymd();
  const taught = Object.values(F.chapters).filter((c) => c.taughtOn);
  const week = taught.filter((c) => daysBetween(c.lastTaught || c.taughtOn, today) <= 7).map((c) => c.id);
  const older = taught.filter((c) => !week.includes(c.id)).map((c) => c.id);
  const weights = { ...Object.fromEntries(week.map((id) => [id, 3])), ...testWeights(F.events, today) };
  const pool = await questionPool([...week, ...older]);
  const qs = pickQuestions(pool, F.settings.weeklyTestCount, { weights });
  return { kind: 'test', title: 'Weekly test', questions: qs, extra: { title: `Weekly test ${today}` } };
}

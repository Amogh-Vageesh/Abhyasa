import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays, daysBetween, reviewSchedule, dueChapters, currentStreak, markAnswer,
  updateMistake, walletSummary, cappedAmount, parseTestText, pickQuestions, toICS, testWeights
} from '../src/lib/logic.js';

test('dates', () => {
  assert.equal(addDays('2026-11-30', 1), '2026-12-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(daysBetween('2026-11-16', '2026-11-28'), 12);
});

test('spaced revision', () => {
  assert.deepEqual(reviewSchedule('2026-11-16'), ['2026-11-17', '2026-11-19', '2026-11-23', '2026-12-07']);
  const due = dueChapters({ a: { taughtOn: '2026-11-16', reviewsDone: ['2026-11-17'] }, b: { taughtOn: '2026-11-18' } }, '2026-11-19');
  assert.deepEqual(due, [{ id: 'a', pending: ['2026-11-19'] }, { id: 'b', pending: ['2026-11-19'] }]);
});

test('streak', () => {
  const days = { '2026-11-14': { completed: true }, '2026-11-15': { completed: true } };
  assert.equal(currentStreak(days, '2026-11-16'), 2);
  assert.equal(currentStreak({ ...days, '2026-11-16': { completed: true } }, '2026-11-16'), 3);
  assert.equal(currentStreak(days, '2026-11-17'), 0);
});

test('marking', () => {
  assert.equal(markAnswer({ type: 'mcq', ans: 'Radiation' }, 'radiation'), true);
  assert.equal(markAnswer({ type: 'num', ans: '12.5' }, '12.50'), true);
  assert.equal(markAnswer({ type: 'num', ans: '1,00,000' }, '100000'), true);
  assert.equal(markAnswer({ type: 'fill', ans: 'crore|1 crore' }, 'Crore'), true);
  assert.equal(markAnswer({ type: 'short', ans: 'x' }, 'y'), null);
  assert.equal(markAnswer({ type: 'mcq', ans: 'A' }, ''), false);
});

test('mistakes need two right answers on different days', () => {
  let m = updateMistake(null, false, '2026-11-16');
  m = updateMistake(m, true, '2026-11-17');
  m = updateMistake(m, true, '2026-11-17');
  assert.equal(m.resolved, false);
  m = updateMistake(m, true, '2026-11-18');
  assert.equal(m.resolved, true);
  m = updateMistake(m, false, '2026-11-19');
  assert.equal(m.resolved, false);
});

test('wallet + cap', () => {
  const e = [{ type: 'earn', amount: 480, date: '2026-11-02' }, { type: 'payout', amount: 100, date: '2026-11-03' }, { type: 'bonus', amount: 50, date: '2026-11-04' }];
  assert.deepEqual(walletSummary(e), { earned: 480, bonus: 50, paid: 100, balance: 430 });
  assert.equal(cappedAmount(50, e, '2026-11-20', 500), 20);
  assert.equal(cappedAmount(50, e, '2026-12-01', 500), 50);
});

test('parse import format', () => {
  const { test: t, errors } = parseTestText(`TEST: Science – Ch 7 Heat Transfer
CHAPTER: sci-7
Q: Which mode of heat transfer needs no medium?
A) Conduction  B) Convection  C) Radiation  D) None
ANS: C
WHY: Radiation travels as waves.

Q: Why do we feel cooler near the sea in the afternoon?
TYPE: short
ANS: Sea breeze.

Q: Metals are good conductors of heat.
ANS: True

Q: 25 x 4 = ?
TYPE: num
ANS: 100`);
  assert.deepEqual(errors, []);
  assert.equal(t.title, 'Science – Ch 7 Heat Transfer');
  assert.equal(t.questions.length, 4);
  assert.equal(t.questions[0].ans, 'Radiation');
  assert.deepEqual(t.questions[0].options, ['Conduction', 'Convection', 'Radiation', 'None']);
  assert.equal(t.questions[1].type, 'short');
  assert.equal(t.questions[2].type, 'tf');
  assert.equal(t.questions[3].type, 'num');
});

test('parse reports bad answers', () => {
  const { errors } = parseTestText('Q: x?\nA) a\nB) b\nANS: Z');
  assert.equal(errors.length, 1);
});

test('pickQuestions spreads chapters and respects n', () => {
  const pool = [];
  for (const c of ['a', 'b']) for (let i = 0; i < 10; i++) pool.push({ id: c + i, chapterId: c });
  const p = pickQuestions(pool, 6);
  assert.equal(p.length, 6);
  assert.equal(new Set(p.map((q) => q.id)).size, 6);
  assert.ok(p.some((q) => q.chapterId === 'a') && p.some((q) => q.chapterId === 'b'));
});

test('ics + test weights', () => {
  const ics = toICS({ id: 'e1', title: 'Science test', date: '2026-11-28', time: '09:30' });
  assert.match(ics, /DTSTART;TZID=Asia\/Kolkata:20261128T093000/);
  assert.deepEqual(testWeights([{ type: 'test', date: '2026-11-20', chapters: ['sci-7'] }], '2026-11-16'), { 'sci-7': 3 });
});

import { weekKey, periodKey, taskStats, blocksFor, currentBlock, moneyBalances, spendSummary, buildInsights } from '../src/lib/logic.js';

test('periods + tasks', () => {
  assert.equal(weekKey('2026-11-16'), '2026-W47');
  assert.equal(weekKey('2027-01-01'), '2026-W53');
  assert.equal(periodKey('monthly', '2026-11-16'), '2026-11');
  const tasks = [{ freq: 'daily', done: { '2026-11-16': true } }, { freq: 'daily', days: [1], done: {} }, { freq: 'weekly', done: { '2026-W47': true } }];
  const s = taskStats(tasks, 'daily', '2026-11-16', 2);
  assert.deepEqual(s[0], { key: '2026-11-16', done: 1, total: 2, pct: 50 }); // Monday: both apply
  assert.equal(s[1].total, 1); // Sunday: only the every-day task
  assert.equal(taskStats(tasks, 'weekly', '2026-11-16', 1)[0].pct, 100);
});

test('timetable blocks', () => {
  const blocks = [{ days: [1], start: '17:00', end: '18:00', kind: 'study' }, { days: [1, 2], start: '16:00', end: '16:30', kind: 'play' }];
  assert.equal(blocksFor(blocks, '2026-11-16').length, 2);
  assert.equal(blocksFor(blocks, '2026-11-16')[0].kind, 'play');
  assert.equal(currentBlock(blocks, '2026-11-16', 17 * 60 + 5).kind, 'study');
  assert.equal(currentBlock(blocks, '2026-11-17', 17 * 60 + 5), null);
});

test('finance', () => {
  const e = [
    { type: 'in', amount: 500, account: 'Cash', currency: 'INR' },
    { type: 'out', amount: 100, account: 'Cash', currency: 'INR', paidBy: 'self', category: 'Snacks', date: '2026-11-10' },
    { type: 'out', amount: 300, account: 'Cash', currency: 'INR', paidBy: 'dad', category: 'Books', date: '2026-11-11' },
    { type: 'in', amount: 20, account: 'Cash', currency: 'AED' },
    { type: 'transfer', amount: 200, account: 'Cash', toAccount: 'Bank', currency: 'INR' }
  ];
  const b = moneyBalances(e);
  assert.deepEqual(b.find((x) => x.account === 'Cash' && x.currency === 'INR').balance, 200);
  assert.deepEqual(b.find((x) => x.account === 'Bank').balance, 200);
  assert.deepEqual(b.find((x) => x.currency === 'AED').balance, 20);
  const s = spendSummary(e, '2026-11');
  assert.equal(s.byCategory[0].name, 'Books');
  assert.deepEqual(s.byPayer.map((p) => p.name).sort(), ['dad', 'self']);
});

test('insights do not crash on empty data', () => {
  const out = buildInsights({ days: {}, attempts: [], tasks: [], blocks: [], mistakes: [], today: '2026-11-16' });
  assert.ok(Array.isArray(out));
  assert.ok(out.some((i) => i.title.includes('timetable')));
});

import { parseSchoolCalendar, HOLIDAYS } from '../src/lib/content.js';
test('school calendar import', () => {
  const { events, errors } = parseSchoolCalendar('2026-12-05 Annual Day\n15/12/2026 to 19/12/2026 Periodic Test 2\n2026-12-24 to 2027-01-01 Winter vacation\n10/01/2027 PTM\nnonsense');
  assert.equal(events.length, 4);
  assert.deepEqual(events[1], { date: '2026-12-15', endDate: '2026-12-19', title: 'Periodic Test 2', type: 'test' });
  assert.equal(events[2].type, 'holiday');
  assert.equal(events[3].type, 'ptm');
  assert.equal(errors.length, 1);
  assert.ok(HOLIDAYS.find((h) => h.date === '2026-11-27'));
});

import { studyStats, subjectInsights } from '../src/lib/logic.js';
test('study stats by period', () => {
  const sub = (id) => (id || '').startsWith('sc') ? 'science' : (id || '').startsWith('m') ? 'maths' : null;
  const F = {
    days: { '2026-11-16': { completed: true, logs: [{ subject: 'science', chapterId: 'sc-7' }], time: { science: 600 } }, '2026-09-01': { logs: [{ subject: 'maths' }] } },
    attempts: [{ date: '2026-11-15', seconds: 120, items: [{ chapterId: 'sc-7', correct: true }, { chapterId: 'm1-1', correct: false }] }],
    chapters: { 'sc-7': { taughtOn: '2026-11-16', status: 'taught' } }, papers: [], mistakes: [{ chapterId: 'm1-1', resolved: false }]
  };
  const w = studyStats(F, 'week', '2026-11-16', sub);
  assert.equal(w.questions, 2); assert.equal(w.accuracy, 50); assert.equal(w.logs, 1); assert.equal(w.minutes, 12);
  assert.equal(w.perSubject.science.seconds, 660);
  assert.equal(studyStats(F, 'all', '2026-11-16', sub).logs, 2);
  const ins = subjectInsights({ subjectId: 'science', subjectName: 'Science', chapterIds: ['sc-7'], F, today: '2026-11-16', subjectOf: sub });
  assert.ok(ins.length >= 2);
});

import { diagnose, mistakeAnalysis, actionPlan } from '../src/lib/logic.js';
test('mistake diagnosis', () => {
  assert.equal(diagnose({ reason: 'careless', retryCorrect: true, confidence: 4 }), 'careless');
  assert.equal(diagnose({ reason: 'careless', retryCorrect: false, checksRight: 0, checksTotal: 2, confidence: 2 }), 'concept-gap');
  assert.equal(diagnose({ reason: 'forgot', confidence: 4, checksRight: 2, checksTotal: 2 }), 'memory');
  assert.equal(diagnose({ reason: 'misread', confidence: 4, retryCorrect: true }), 'reading');
  assert.equal(diagnose({ reason: 'guess' }), 'concept-gap');
  const a = mistakeAnalysis([{ chapterId: 'sc-7', probe: { diagnosis: 'concept-gap', confidence: 2 } }, { chapterId: 'm1-1', probe: { diagnosis: 'careless', confidence: 4 } }, { chapterId: 'sc-7', probe: { diagnosis: 'concept-gap' } }, { chapterId: 'sc-7' }],
    (id) => (id.startsWith('sc') ? 'science' : 'maths'));
  assert.equal(a.top, 'concept-gap'); assert.equal(a.gapChapters[0].id, 'sc-7'); assert.equal(a.unprobed, 1);
});
test('action plan', () => {
  const F = { days: {}, attempts: [{ date: '2026-11-15', items: [{ chapterId: 'sc-7', correct: false }, { chapterId: 'sc-7', correct: true }] }],
    chapters: { 'sc-7': { taughtOn: '2026-11-10', status: 'taught' } }, mistakes: [{ chapterId: 'sc-7', resolved: false }],
    events: [{ type: 'test', title: 'Science test', date: '2026-11-19', chapters: ['sc-7'] }], papers: [], tasks: [], blocks: [] };
  const plan = actionPlan(F, '2026-11-16', { subjectOf: (id) => 'science', chapterName: (id) => id, subjectName: (s) => s });
  assert.match(plan[0].title, /Science test in 3 days/);
  assert.equal(plan[0].action.to, 'practice-chapters');
  assert.ok(plan.some((p) => p.title.startsWith('Find out why')));
});

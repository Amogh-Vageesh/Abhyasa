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

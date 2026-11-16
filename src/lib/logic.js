// Pure logic: no Firebase, no DOM. Unit-tested in tests/logic.test.js

export const REVIEW_GAPS = [1, 3, 7, 21];

export const DEFAULT_SETTINGS = {
  practiceCount: 8,
  reviseCount: 6,
  mistakesPerRevise: 4,
  weeklyTestCount: 15,
  reminderTime: '18:00',
  alertTime: '20:30',
  rewards: {
    dayComplete: 10,
    streak7: 50,
    test80: 25,
    test90: 50,
    mistakeCleared: 2,
    monthlyCap: 500
  }
};

// ---------- dates (local, YYYY-MM-DD) ----------
export function ymd(d = new Date()) {
  const dt = new Date(d);
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${m}-${day}`;
}
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return ymd(dt);
}
export function daysBetween(a, b) {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 86400000);
}
export function isWeekend(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return wd === 0 || wd === 6;
}

// ---------- spaced revision ----------
export function reviewSchedule(taughtOn) {
  return REVIEW_GAPS.map((g) => addDays(taughtOn, g));
}
// chapters: { [chapterId]: { taughtOn, reviewsDone: [dates] } }
export function dueChapters(chapters, today) {
  const due = [];
  for (const [id, c] of Object.entries(chapters || {})) {
    if (!c?.taughtOn) continue;
    const done = c.reviewsDone || [];
    const pending = reviewSchedule(c.taughtOn).filter((d) => d <= today && !done.includes(d));
    if (pending.length) due.push({ id, pending });
  }
  return due;
}

// ---------- streaks ----------
// days: { [date]: { completed: bool } }
export function currentStreak(days, today) {
  let streak = 0;
  let d = today;
  if (!days?.[d]?.completed) d = addDays(d, -1); // today not finished yet doesn't break streak
  while (days?.[d]?.completed) {
    streak++;
    d = addDays(d, -1);
  }
  return streak;
}

// ---------- question picking ----------
export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// pool: [{...question, chapterId}] ; picks n, spreading across chapters, skipping recently seen
export function pickQuestions(pool, n, { exclude = new Set(), weights = {}, rand = Math.random } = {}) {
  const fresh = pool.filter((q) => !exclude.has(q.id));
  const source = fresh.length >= n ? fresh : pool;
  const byCh = {};
  for (const q of shuffle(source, rand)) (byCh[q.chapterId] ||= []).push(q);
  const chIds = Object.keys(byCh);
  // weighted round robin: chapters with weight w get w turns per round
  const order = [];
  for (const id of chIds) for (let i = 0; i < (weights[id] || 1); i++) order.push(id);
  const picked = [];
  let guard = 0;
  while (picked.length < n && guard++ < 1000) {
    let progressed = false;
    for (const id of shuffle(order, rand)) {
      if (picked.length >= n) break;
      const q = byCh[id].shift();
      if (q) { picked.push(q); progressed = true; }
    }
    if (!progressed) break;
  }
  return picked;
}

// ---------- marking ----------
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ').replace(/[.。]$/, '');

// returns true/false for auto-markable, null for self-check (short answers)
export function markAnswer(q, answer) {
  if (answer === undefined || answer === null || answer === '') return false;
  switch (q.type) {
    case 'mcq':
    case 'tf':
      return norm(answer) === norm(q.ans);
    case 'num': {
      const a = parseFloat(String(answer).replace(/,/g, ''));
      const b = parseFloat(String(q.ans).replace(/,/g, ''));
      if (Number.isNaN(a) || Number.isNaN(b)) return false;
      const tol = q.tol ?? Math.max(1e-9, Math.abs(b) * 0.001);
      return Math.abs(a - b) <= tol;
    }
    case 'fill': {
      const accepted = String(q.ans).split('|').map(norm);
      return accepted.includes(norm(answer));
    }
    case 'short':
      return null;
    default:
      return norm(answer) === norm(q.ans);
  }
}

// ---------- mistakes ----------
// m: { wrongCount, rightStreak, lastRightDate, resolved }
export function updateMistake(m, correct, today) {
  const cur = { wrongCount: 0, rightStreak: 0, lastRightDate: null, resolved: false, ...(m || {}) };
  if (!correct) return { ...cur, wrongCount: cur.wrongCount + 1, rightStreak: 0, resolved: false, lastWrongDate: today };
  if (cur.lastRightDate === today) return cur; // must be right on two different days
  const rightStreak = cur.rightStreak + 1;
  return { ...cur, rightStreak, lastRightDate: today, resolved: rightStreak >= 2 };
}

// ---------- rewards ----------
export function monthKey(dateStr) { return dateStr.slice(0, 7); }

// entries: [{amount, type:'earn'|'bonus'|'payout', date}]
export function walletSummary(entries) {
  let earned = 0, paid = 0, bonus = 0;
  for (const e of entries || []) {
    if (e.type === 'payout') paid += e.amount;
    else if (e.type === 'bonus') bonus += e.amount;
    else earned += e.amount;
  }
  return { earned, bonus, paid, balance: earned + bonus - paid };
}
export function earnedThisMonth(entries, dateStr) {
  const mk = monthKey(dateStr);
  return (entries || []).filter((e) => e.type === 'earn' && monthKey(e.date) === mk)
    .reduce((s, e) => s + e.amount, 0);
}
// Clamp a new earning to the monthly cap
export function cappedAmount(amount, entries, dateStr, cap) {
  if (!cap) return amount;
  const left = cap - earnedThisMonth(entries, dateStr);
  return Math.max(0, Math.min(amount, left));
}
export function testReward(pct, rules) {
  if (pct >= 90) return { amount: rules.test90, label: 'Test 90%+' };
  if (pct >= 80) return { amount: rules.test80, label: 'Test 80%+' };
  return null;
}

// ---------- import test text format ----------
// TEST: title / CHAPTER: id-or-name / Q: ... / A) .. B) .. / TYPE: / ANS: / WHY:
export function parseTestText(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const test = { title: 'Imported test', chapter: '', questions: [] };
  let q = null;
  const errors = [];
  const flush = () => {
    if (!q) return;
    if (!q.type) q.type = q.options.length ? 'mcq' : (/^(true|false)$/i.test(q.ans) ? 'tf' : 'fill');
    if (q.type === 'mcq') {
      const letter = String(q.ans).trim().match(/^([A-Ha-h])\b\)?/);
      if (letter) {
        const idx = letter[1].toUpperCase().charCodeAt(0) - 65;
        if (q.options[idx] !== undefined) q.ans = q.options[idx];
      }
      if (!q.options.map(norm).includes(norm(q.ans))) errors.push(`Q${test.questions.length + 1}: answer "${q.ans}" not among options`);
    }
    if (q.type === 'tf') { q.options = ['True', 'False']; q.ans = /^t/i.test(q.ans) ? 'True' : 'False'; }
    if (!q.q) errors.push(`Q${test.questions.length + 1}: missing question text`);
    if (q.ans === '' && q.type !== 'short') errors.push(`Q${test.questions.length + 1}: missing ANS`);
    test.questions.push({ ...q, id: `imp-${test.questions.length + 1}` });
    q = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    let m;
    if ((m = line.match(/^TEST:\s*(.*)$/i))) { test.title = m[1]; continue; }
    if ((m = line.match(/^CHAPTER:\s*(.*)$/i))) { test.chapter = m[1]; continue; }
    if ((m = line.match(/^(?:Q\d*|\d+[.)])[:.]?\s+(.*)$/i)) && !/^ANS/i.test(line)) {
      flush(); q = { q: m[1], options: [], ans: '', why: '', type: '' }; continue;
    }
    if (!q) continue;
    if ((m = line.match(/^TYPE:\s*(\w+)/i))) {
      const t = m[1].toLowerCase();
      q.type = { mcq: 'mcq', tf: 'tf', truefalse: 'tf', fill: 'fill', blank: 'fill', num: 'num', numeric: 'num', number: 'num', short: 'short' }[t] || t;
      continue;
    }
    if ((m = line.match(/^ANS(?:WER)?:\s*(.*)$/i))) { q.ans = m[1].trim(); continue; }
    if ((m = line.match(/^(?:WHY|EXPLANATION|EXP):\s*(.*)$/i))) { q.why = m[1].trim(); continue; }
    // options: "A) x  B) y" on one line or one per line
    if (/^[A-H][).]\s*/.test(line)) {
      const parts = line.split(/\s*(?=\b[A-H][).]\s)/).filter(Boolean);
      for (const p of parts) {
        const om = p.match(/^[A-H][).]\s*(.*)$/);
        if (om) q.options.push(om[1].trim());
      }
      continue;
    }
    // continuation of question text
    if (!q.options.length && !q.ans) q.q += ' ' + line;
  }
  flush();
  if (!test.questions.length) errors.push('No questions found. Each question must start with "Q:".');
  return { test, errors };
}

// ---------- calendar export ----------
export function toICS(ev) {
  const d = ev.date.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const esc = (s) => String(s || '').replace(/[,;\\]/g, (c) => '\\' + c).replace(/\n/g, '\\n');
  let start, end;
  if (ev.time) {
    const t = ev.time.replace(':', '') + '00';
    start = `DTSTART;TZID=Asia/Kolkata:${d}T${t}`;
    const [h, mi] = ev.time.split(':').map(Number);
    const eh = String(Math.min(23, h + 1)).padStart(2, '0');
    end = `DTEND;TZID=Asia/Kolkata:${d}T${eh}${String(mi).padStart(2, '0')}00`;
  } else {
    start = `DTSTART;VALUE=DATE:${d}`;
    end = `DTEND;VALUE=DATE:${addDays(ev.date, 1).replace(/-/g, '')}`;
  }
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Abhyasa//EN', 'BEGIN:VEVENT',
    `UID:${ev.id || stamp}@abhyasa`, `DTSTAMP:${stamp}`, start, end,
    `SUMMARY:${esc(ev.title)}`, `DESCRIPTION:${esc(ev.notes)}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${esc(ev.title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n');
}

// ---------- family code ----------
export function makeCode(rand = Math.random) {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return s;
}

// Chapters with an upcoming test within `days` get extra weight
export function testWeights(events, today, days = 7) {
  const w = {};
  for (const e of events || []) {
    if (e.type !== 'test' || !e.chapters?.length) continue;
    const gap = daysBetween(today, e.date);
    if (gap >= 0 && gap <= days) for (const c of e.chapters) w[c] = 3;
  }
  return w;
}

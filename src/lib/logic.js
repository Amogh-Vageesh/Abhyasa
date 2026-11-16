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

// ---------- tasks (daily / weekly / monthly) ----------
// ISO week key like 2026-W47
export function weekKey(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const wk = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}
export function periodKey(freq, dateStr) {
  if (freq === 'weekly') return weekKey(dateStr);
  if (freq === 'monthly') return dateStr.slice(0, 7);
  return dateStr;
}
// recent period keys, newest first
export function recentPeriods(freq, today, n) {
  const out = [];
  let d = today;
  while (out.length < n) {
    const k = periodKey(freq, d);
    if (!out.includes(k)) out.push(k);
    d = addDays(d, freq === 'monthly' ? -28 : freq === 'weekly' ? -7 : -1);
    if (freq === 'monthly' && out.length && periodKey('monthly', d) === out[out.length - 1]) d = addDays(d, -7);
  }
  return out;
}
export function taskAppliesOn(task, dateStr) {
  if (task.freq !== 'daily' || !task.days?.length) return true;
  const [y, m, d] = dateStr.split('-').map(Number);
  return task.days.includes(new Date(y, m - 1, d).getDay());
}
// completion rate of a set of tasks over recent periods
export function taskStats(tasks, freq, today, n = 7) {
  const list = tasks.filter((t) => t.freq === freq && t.active !== false);
  return recentPeriods(freq, today, n).map((k) => {
    const existed = list.filter((t) => !t.createdAt || periodKey(freq, ymd(t.createdAt)) <= k);
    const applicable = freq === 'daily' ? existed.filter((t) => taskAppliesOn(t, k)) : existed;
    const done = applicable.filter((t) => t.done?.[k]).length;
    return { key: k, done, total: applicable.length, pct: applicable.length ? Math.round((done / applicable.length) * 100) : null };
  });
}

// ---------- timetable plan ----------
export function minutes(t) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; }
// blocks: [{days:[0..6], start:'16:00', end:'17:00', kind, title}]
export function blocksFor(blocks, dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const wd = new Date(y, m - 1, d).getDay();
  return (blocks || []).filter((b) => (b.days || []).includes(wd)).sort((a, b) => minutes(a.start) - minutes(b.start));
}
export function currentBlock(blocks, dateStr, nowMin) {
  return blocksFor(blocks, dateStr).find((b) => minutes(b.start) <= nowMin && nowMin < minutes(b.end)) || null;
}
export function plannedMinutesByKind(blocks) {
  const out = {};
  for (const b of blocks || []) out[b.kind] = (out[b.kind] || 0) + (minutes(b.end) - minutes(b.start)) * (b.days?.length || 0);
  return out;
}

// ---------- finance ----------
// entries: [{type:'in'|'out', amount, currency, account, paidBy:'self'|'dad'|'mom'|..., category}]
// Only money that is his (received, or spent by himself) changes his balance.
export function moneyBalances(entries) {
  const bal = {};
  for (const e of entries || []) {
    const key = `${e.account || 'Cash'}|${e.currency || 'INR'}`;
    if (e.type === 'in') bal[key] = (bal[key] || 0) + Number(e.amount || 0);
    else if (e.type === 'out' && (e.paidBy || 'self') === 'self') bal[key] = (bal[key] || 0) - Number(e.amount || 0);
    else if (e.type === 'transfer') {
      bal[key] = (bal[key] || 0) - Number(e.amount || 0);
      const to = `${e.toAccount || 'Cash'}|${e.currency || 'INR'}`;
      bal[to] = (bal[to] || 0) + Number(e.amount || 0);
    }
  }
  return Object.entries(bal).map(([k, v]) => { const [account, currency] = k.split('|'); return { account, currency, balance: Math.round(v * 100) / 100 }; });
}
export function spendSummary(entries, monthPrefix) {
  const byCat = {}, byPayer = {};
  for (const e of entries || []) {
    if (e.type !== 'out' || (monthPrefix && !String(e.date).startsWith(monthPrefix))) continue;
    const cur = e.currency || 'INR';
    const c = `${e.category || 'Other'}|${cur}`;
    byCat[c] = (byCat[c] || 0) + Number(e.amount || 0);
    const p = `${e.paidBy || 'self'}|${cur}`;
    byPayer[p] = (byPayer[p] || 0) + Number(e.amount || 0);
  }
  const split = (o) => Object.entries(o).map(([k, v]) => { const [name, currency] = k.split('|'); return { name, currency, amount: v }; }).sort((a, b) => b.amount - a.amount);
  return { byCategory: split(byCat), byPayer: split(byPayer) };
}
export function formatMoney(n, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(n);
  } catch { return `${currency} ${n}`; }
}

// ---------- insights ----------
const DAYNAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
// Returns [{tone:'good'|'warn'|'tip', title, text}] from usage history
export function buildInsights({ days, attempts, tasks, blocks, mistakes, today }) {
  const out = [];
  const last28 = Array.from({ length: 28 }, (_, i) => addDays(today, -i - 1));
  const tracked = last28.filter((d) => days[d]);
  // completion
  const done = last28.filter((d) => days[d]?.completed).length;
  if (tracked.length >= 5) {
    const pct = Math.round((done / 28) * 100);
    out.push(pct >= 70
      ? { tone: 'good', title: `Routine done ${done} of the last 28 days`, text: 'Great consistency. Small daily effort beats last-minute cramming.' }
      : { tone: 'warn', title: `Routine done only ${done} of the last 28 days`, text: 'Aim for at least 5 days a week. Start with the shortest step (homework or log) to get going.' });
    // weakest weekday
    const byWd = Array(7).fill(0).map(() => ({ done: 0, n: 0 }));
    for (const d of last28) { const [y, m, dd] = d.split('-').map(Number); const wd = new Date(y, m - 1, dd).getDay(); byWd[wd].n++; if (days[d]?.completed) byWd[wd].done++; }
    const worst = byWd.map((v, i) => ({ i, r: v.n ? v.done / v.n : 1 })).sort((a, b) => a.r - b.r)[0];
    if (worst.r < 0.5) out.push({ tone: 'tip', title: `${DAYNAMES[worst.i]}s are your toughest day`, text: `Plan a lighter, fixed study slot on ${DAYNAMES[worst.i]}s — even 30 minutes keeps the streak alive.` });
  }
  // time of day the routine gets finished
  const times = last28.map((d) => days[d]?.completedAt).filter(Boolean).map((t) => new Date(t).getHours());
  if (times.length >= 4) {
    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    if (avg >= 21) out.push({ tone: 'warn', title: 'You usually finish after 9 pm', text: 'Late study hurts sleep and memory. Try starting your routine right after a snack break after school.' });
    else out.push({ tone: 'good', title: `You usually finish around ${Math.round(avg) > 12 ? Math.round(avg) - 12 + ' pm' : Math.round(avg) + ' am'}`, text: 'Good timing — keep the evening free for rest and play.' });
  }
  // accuracy trend
  const recent = attempts.filter((a) => a.total && daysBetween(a.date, today) <= 14);
  const older = attempts.filter((a) => a.total && daysBetween(a.date, today) > 14 && daysBetween(a.date, today) <= 42);
  const acc = (list) => { const s = list.reduce((a, x) => a + x.score, 0), t = list.reduce((a, x) => a + x.total, 0); return t ? Math.round((s / t) * 100) : null; };
  const ra = acc(recent), oa = acc(older);
  if (ra !== null && oa !== null) {
    out.push(ra >= oa
      ? { tone: 'good', title: `Accuracy up: ${oa}% → ${ra}%`, text: 'Your revision is working. Keep clearing the Mistake Book.' }
      : { tone: 'warn', title: `Accuracy down: ${oa}% → ${ra}%`, text: 'Slow down and read each question twice. Revisit the explainer before practising.' });
  }
  // subject balance
  const bySub = {};
  for (const a of recent) for (const it of a.items || []) { if (!it.chapterId) continue; const s = it.chapterId.replace(/\d.*$/, '').replace(/-$/, ''); bySub[s] = (bySub[s] || 0) + 1; }
  const names = { m: 'Maths', sc: 'Science', ss: 'Social Science', en: 'English' };
  const missing = Object.keys(names).filter((k) => !bySub[k]);
  if (recent.length >= 3 && missing.length && missing.length < 4) out.push({ tone: 'tip', title: `No practice in ${missing.map((k) => names[k]).join(', ')} for 2 weeks`, text: 'Rotate subjects so nothing gets rusty before exams.' });
  // mistakes
  const open = (mistakes || []).filter((m) => !m.resolved).length;
  if (open >= 10) out.push({ tone: 'warn', title: `${open} mistakes waiting`, text: 'Fix 3–4 a day in Revise. Old mistakes are the fastest way to gain marks.' });
  // tasks
  const daily = taskStats(tasks || [], 'daily', today, 7).filter((x) => x.pct !== null);
  if (daily.length >= 3) { const avg = Math.round(daily.reduce((a, x) => a + x.pct, 0) / daily.length); out.push(avg >= 75 ? { tone: 'good', title: `Daily tasks: ${avg}% done this week`, text: 'Nice! You are building strong habits.' } : { tone: 'tip', title: `Daily tasks: ${avg}% done this week`, text: 'Too many tasks? Keep 3–5 important ones and tick them at the same time each day.' }); }
  // plan
  const planned = plannedMinutesByKind(blocks);
  const play = planned.play || 0, study = (planned.study || 0) + (planned.homework || 0) + (planned.reading || 0);
  if (!blocks?.length) out.push({ tone: 'tip', title: 'Make your weekly timetable', text: 'Students who plan their week finish more with less stress. Add study, homework, play and sleep blocks in Planner.' });
  else {
    if (study / 7 < 60) out.push({ tone: 'tip', title: `Only ${Math.round(study / 7)} min/day of study planned`, text: 'For Class 7, 1–2 hours a day of focused study (including homework) is a good target.' });
    if (!play) out.push({ tone: 'tip', title: 'No play time planned', text: 'Breaks and outdoor play improve focus. Add at least 45 minutes a day.' });
  }
  return out;
}

// Static best-practice tips shown alongside personal insights
export const BEST_PRACTICES = [
  { title: 'Study in 25–30 minute blocks', text: 'Work for 25–30 minutes, then take a 5-minute break. After 4 blocks, take a longer break.' },
  { title: 'Hardest subject first', text: 'Do the toughest work when your mind is fresh — usually the first study block of the day.' },
  { title: 'Revise within 24 hours', text: 'A quick 10-minute review the same day helps you remember much more of what was taught.' },
  { title: 'Test yourself, don’t just re-read', text: 'Answering questions from memory is far more effective than reading notes again.' },
  { title: 'Phone away while studying', text: 'Keep the phone in another room or on Do Not Disturb during study blocks.' },
  { title: 'Sleep 9–10 hours', text: 'Teens need lots of sleep. Memory is strengthened while you sleep.' },
  { title: 'Plan the week on Sunday', text: 'Check upcoming tests and events, and adjust your timetable for the week ahead.' }
];

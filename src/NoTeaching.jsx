// "Nothing was taught today" — log it with a reason, then suggest what to do with the time instead.
import { Icon, Tile } from './icons';
import { daysBetween, dueChapters, ymd } from './lib/logic';
import { chapterTitle, subjectChapters, subjectOfFactory } from './Study';
import { SUBJECTS } from './lib/syllabus';
import { weekOf } from './Explore';

export const NO_TEACH_REASONS = [
  ['exam', '📝 Exam / test day'], ['event', '🎉 School event / function'], ['sports', '🏃 Sports day'],
  ['absent', '🙋 Teacher absent / free period'], ['revision', '🔁 Only revision in class'], ['holiday', '🏖️ Holiday / no school']
];
const REASON_TIP = {
  exam: 'Exam day tip: while it’s fresh, write down any question you weren’t sure about — then check the answer in your book or add it as a fix-it.',
  event: 'Event day — keep it light: 20–30 minutes of revision is enough today.',
  sports: 'Sports day — great for your body! Do a short, easy revision in the evening.',
  absent: 'Free period? Read ahead the next chapter — you’ll understand it much faster when the teacher teaches it.',
  revision: 'Class was revision — test yourself on the same chapter to see what stuck.',
  holiday: 'Holiday — a good day to catch up on weak chapters and fix-its, then enjoy the rest of the day.'
};

export function noTeachSuggestions(F, today = ymd(), info = {}) {
  const subjectOf = subjectOfFactory(F);
  const sName = (id) => SUBJECTS.find((s) => s.id === id)?.name || id;
  const out = [];
  const add = (prio, icon, tone, title, text, act) => out.push({ prio, icon, tone, title, text, act });
  // upcoming tests
  for (const e of (F.events || []).filter((x) => x.type === 'test' && x.date >= today && daysBetween(today, x.date) <= 10)) {
    const gap = daysBetween(today, e.date);
    add(100 - gap * 4, 'alert', 'red', `Prepare for ${e.title}`, `${gap === 0 ? 'Today' : gap === 1 ? 'Tomorrow' : `In ${gap} days`} — practise its chapters for 20–30 min.`, e.chapters?.length ? { to: 'act', extra: { to: 'practice-chapters', extra: e.chapters, label: e.title } } : { to: 'calendar' });
  }
  // revision due
  const due = dueChapters(F.chapters, today);
  if (due.length) add(88, 'repeat', 'blue', `Revise ${due.length} chapter${due.length > 1 ? 's' : ''} that are due`, due.slice(0, 2).map((d) => chapterTitle(F, d.id)).join(', ') + (due.length > 2 ? '…' : ''), { to: 'act', extra: { to: 'practice-chapters', extra: due.map((d) => d.id), label: 'Revision' } });
  // weakest chapters by accuracy
  const acc = {};
  for (const a of F.attempts || []) for (const it of a.items || []) { if (!it.chapterId) continue; const x = (acc[it.chapterId] ||= { r: 0, t: 0 }); x.t++; if (it.correct) x.r++; }
  const weak = Object.entries(acc).filter(([, x]) => x.t >= 4).map(([id, x]) => ({ id, p: Math.round((x.r / x.t) * 100) })).filter((x) => x.p < 70).sort((a, b) => a.p - b.p).slice(0, 2);
  if (weak.length) add(84, 'chart', 'amber', `Strengthen weak chapters`, weak.map((w) => `${chapterTitle(F, w.id)} (${w.p}%)`).join(', '), { to: 'act', extra: { to: 'practice-chapters', extra: weak.map((w) => w.id), label: 'Weak chapters' } });
  // fix-its
  const open = (F.mistakes || []).filter((m) => !m.resolved).length;
  if (open) add(80, 'mistake', 'red', `Clear fix-its (${open} open)`, 'Redo the questions you got wrong — 10–15 minutes.', { to: 'mistakes' });
  // read ahead: the next chapter after the last one taught (prefer the subjects that had no class)
  const subs = (info.subjects?.length ? info.subjects : SUBJECTS.map((s) => s.id));
  const ahead = [];
  for (const sid of subs) {
    const list = subjectChapters(F, sid);
    let last = -1;
    list.forEach((c, k) => { if (F.chapters?.[c.id]?.taughtOn) last = k; });
    const next = list[last + 1];
    if (next && !F.chapters?.[next.id]?.taughtOn && last >= 0) ahead.push({ sid, c: next });
  }
  if (ahead.length) {
    const a = ahead[0];
    add(info.reason === 'absent' ? 95 : 70, 'book', 'purple', `Read ahead: ${sName(a.sid)} — ${a.c.title}`, 'Read the explainer before it’s taught — class will be much easier.', { to: 'act', extra: { to: 'chapter', extra: a.c.id } });
  }
  // written answers, explore, reading
  add(60, 'edit', 'purple', 'Write 3 exam-style answers', 'Practice → Written. Appa/Amma will mark them.', { to: 'practice', extra: 'written' });
  if (weekOf(F) !== null) add(58, 'bulb', 'amber', 'Do this week’s Explore challenge', 'Beyond school · about 20 minutes.', { to: 'explore' });
  add(40, 'book', 'teal', 'Read for 20 minutes', 'A story book, newspaper or magazine — builds vocabulary for every subject.', null);
  return { tip: REASON_TIP[info.reason] || '', items: out.sort((a, b) => b.prio - a.prio) };
}

export function SuggestionList({ F, info, go, limit = 6, onPick }) {
  const { tip, items } = noTeachSuggestions(F, ymd(), info);
  return (
    <div className="stack">
      {tip && <div className="note"><Tile icon="bulb" tone="amber" /><div className="small-text">{tip}</div></div>}
      <div className="card list">
        {items.slice(0, limit).map((s, k) => (
          <button key={k} className="lrow" onClick={() => { if (s.act && go) { go(s.act.to, s.act.extra); onPick?.(); } }} disabled={!s.act}>
            <Tile icon={s.icon} tone={s.tone} />
            <div className="lt"><b>{s.title}</b><small>{s.text}</small></div>
            {s.act && <Icon name="chevR" className="chev" />}
          </button>
        ))}
      </div>
    </div>
  );
}

// Home card on a no-teaching day
export function NoTeachingCard({ F, go }) {
  const info = F.days?.[ymd()]?.noTeaching;
  if (!info) return null;
  const label = (NO_TEACH_REASONS.find((r) => r[0] === info.reason) || [])[1] || 'No teaching today';
  return (
    <div className="nt-card">
      <div className="sec-h" style={{ marginTop: 0 }}><h2>No new lesson today</h2><span className="muted small-text">{label}</span></div>
      <SuggestionList F={F} info={info} go={go} limit={3} />
    </div>
  );
}

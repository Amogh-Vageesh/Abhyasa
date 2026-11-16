import { useState } from 'react';
import { Card, Modal, MultiChapterPicker, Progress, rupees, PageHead } from './components';
import { Icon, Tile } from './icons';
import { addWallet, deleteEvent, deleteWallet, saveEvent, saveItem } from './lib/data';
import { daysBetween, walletSummary, ymd } from './lib/logic';
import { chapterLabel } from './lib/syllabus';
import { downloadICS } from './lib/notify';
import { HOLIDAYS, parseSchoolCalendar } from './lib/content';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const TYPES = {
  test: { label: 'Test / Exam', icon: '📝' },
  function: { label: 'School function', icon: '🎭' },
  ptm: { label: 'PTM', icon: '👨‍👩‍👦' },
  homework: { label: 'Homework / project due', icon: '📒' },
  personal: { label: 'Personal', icon: '⭐' },
  school: { label: 'School event', icon: '🏫' },
  holiday: { label: 'Holiday', icon: '🎉' }
};

// All calendar items: family events + built-in Karnataka holidays (unless hidden)
export function allEvents(F) {
  const hidden = new Set(F.family?.hiddenHolidays || []);
  const hol = F.family?.showHolidays === false ? [] : HOLIDAYS.filter((h) => !hidden.has(h.id) && !F.events.some((e) => e.date === h.date && e.type === 'holiday'));
  return [...F.events, ...hol].sort((a, b) => a.date.localeCompare(b.date));
}

function gcalLink(ev) {
  const d = ev.date.replace(/-/g, '');
  let dates;
  if (ev.time) {
    const t = ev.time.replace(':', '') + '00';
    const [h, m] = ev.time.split(':').map(Number);
    dates = `${d}T${t}/${d}T${String(Math.min(23, h + 1)).padStart(2, '0')}${String(m).padStart(2, '0')}00`;
  } else {
    const n = new Date(ev.date); n.setDate(n.getDate() + 1);
    dates = `${d}/${n.toISOString().slice(0, 10).replace(/-/g, '')}`;
  }
  const p = new URLSearchParams({ action: 'TEMPLATE', text: ev.title, dates, details: ev.notes || '', ctz: 'Asia/Kolkata' });
  return `https://calendar.google.com/calendar/render?${p}`;
}

export function CalendarPage({ F, me, embedded = false }) {
  const today = ymd();
  const [edit, setEdit] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const [importing, setImporting] = useState(false);
  const [filter, setFilter] = useState('all');
  const events = allEvents(F).filter((e) => filter === 'all' || (filter === 'tests' ? e.type === 'test' : filter === 'holidays' ? e.type === 'holiday' : !['test', 'holiday'].includes(e.type)));
  const upcoming = events.filter((e) => (e.endDate || e.date) >= today);
  const past = events.filter((e) => (e.endDate || e.date) < today).reverse();
  const addBtn = <div className="row"><button className="small" onClick={() => setImporting(true)}>Import school dates</button><button className="primary small" onClick={() => setEdit({ type: 'test', date: today, title: '', remind: [1, 0], chapters: [] })}><Icon name="plus" size={16} /> Add</button></div>;
  // group upcoming by month
  const groups = [];
  for (const e of upcoming) { const m = e.date.slice(0, 7); if (!groups.length || groups[groups.length - 1].m !== m) groups.push({ m, items: [] }); groups[groups.length - 1].items.push(e); }
  return (
    <div className="stack">
      {embedded ? <div className="row between"><span className="muted small-text">Tests, holidays, PTMs & events</span>{addBtn}</div> : <PageHead title="Calendar" right={addBtn} />}
      <div className="chips">{[['all', 'All'], ['tests', 'Tests'], ['holidays', 'Holidays'], ['events', 'Events']].map(([k, l]) => <button key={k} className={`small ${filter === k ? 'primary' : ''}`} onClick={() => setFilter(k)}>{l}</button>)}</div>
      {!upcoming.length && <Card><p className="muted">Nothing coming up.</p></Card>}
      {groups.map((g) => (
        <div key={g.m}>
          <div className="sec-h" style={{ marginTop: 6 }}><h2>{new Date(g.m + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h2></div>
          <div className="card list">{g.items.map((e) => <EventRow key={e.id} e={e} today={today} onClick={() => !e.builtin && setEdit(e)} />)}</div>
        </div>
      ))}
      {past.length > 0 && <button className="ghost small" onClick={() => setShowPast(!showPast)}>{showPast ? 'Hide' : 'Show'} past ({past.length})</button>}
      {showPast && <div className="card list">{past.map((e) => <EventRow key={e.id} e={e} today={today} onClick={() => !e.builtin && setEdit(e)} />)}</div>}
      <p className="muted small-text">🎉 Karnataka Government general holidays 2026 are built in. CBSE schools follow their own calendar — import it with “Import school dates”.</p>
      {edit && <EventModal F={F} me={me} ev={edit} onClose={() => setEdit(null)} />}
      {importing && <ImportCalendarModal F={F} me={me} onClose={() => setImporting(false)} />}
    </div>
  );
}

function ImportCalendarModal({ F, me, onClose }) {
  const [text, setText] = useState('');
  const parsed = text.trim() ? parseSchoolCalendar(text) : null;
  const save = async () => {
    for (const e of parsed.events) await saveEvent(F.family.id, { ...e, remind: e.type === 'test' ? [2, 1, 0] : [1], chapters: [], byRole: me.role, byName: me.name, source: 'school' });
    onClose();
  };
  return (
    <Modal title="Import school calendar" onClose={onClose}>
      <div className="stack">
        <p className="muted small-text">Paste dates from the school diary or circular, one per line. Ranges work too. Tip: ask Claude to “convert this school calendar into lines of date and title” and paste the result.</p>
        <textarea rows={8} placeholder={'2026-12-05 Annual Day\n15/12/2026 to 19/12/2026 Periodic Test 2\n2026-12-24 to 2027-01-01 Winter vacation\n10/01/2027 PTM'} value={text} onChange={(e) => setText(e.target.value)} />
        {parsed && <div className={parsed.errors.length ? 'feedback bad' : 'feedback good'}>
          <b>{parsed.events.length} date(s) found</b>
          {parsed.events.slice(0, 6).map((e, i) => <div key={i} className="small-text">{TYPES[e.type]?.icon} {e.date}{e.endDate ? ' → ' + e.endDate : ''} · {e.title}</div>)}
          {parsed.errors.map((er, i) => <div key={i} className="small-text">⚠️ {er}</div>)}
        </div>}
        <button className="primary" disabled={!parsed?.events.length} onClick={save}>Add to calendar</button>
      </div>
    </Modal>
  );
}

function EventRow({ e, today, onClick }) {
  const gap = daysBetween(today, e.date);
  return (
    <div className={`event-row ${e.type}`} onClick={onClick}>
      <div className="event-date"><b>{Number(e.date.slice(8))}</b><span>{new Date(e.date).toLocaleString('en-IN', { weekday: 'short' })}</span></div>
      <div className="grow">
        <b>{TYPES[e.type]?.icon} {e.title}</b>
        <div className="muted small-text">{e.endDate ? `till ${e.endDate.slice(8)} ${new Date(e.endDate).toLocaleString('en-IN', { month: 'short' })}` : e.time || 'All day'}{gap >= 0 ? ` · ${gap === 0 ? 'today' : gap === 1 ? 'tomorrow' : `in ${gap} days`}` : ''}{e.byRole === 'parent' ? ' · from parent' : ''}</div>
        {e.chapters?.length > 0 && <div className="muted small-text">{e.chapters.map(chapterLabel).join(' · ')}</div>}
      </div>
    </div>
  );
}

export function EventModal({ F, me, ev, onClose }) {
  const [e, setE] = useState(ev);
  const set = (k, v) => setE({ ...e, [k]: v });
  const toggleRemind = (n) => set('remind', (e.remind || []).includes(n) ? e.remind.filter((x) => x !== n) : [...(e.remind || []), n]);
  const save = async () => {
    const data = { ...e, byRole: e.byRole || me.role, byName: e.byName || me.name };
    await saveEvent(F.family.id, data);
    onClose();
  };
  return (
    <Modal title={ev.id ? 'Edit event' : 'New event'} onClose={onClose}>
      <div className="stack">
        <select value={e.type} onChange={(x) => set('type', x.target.value)}>
          {Object.entries(TYPES).map(([k, t]) => <option key={k} value={k}>{t.icon} {t.label}</option>)}
        </select>
        <input placeholder="Title (e.g. Science unit test)" value={e.title} onChange={(x) => set('title', x.target.value)} />
        <div className="row">
          <input type="date" value={e.date} onChange={(x) => set('date', x.target.value)} />
          <input type="time" value={e.time || ''} onChange={(x) => set('time', x.target.value)} />
        </div>
        {e.type === 'test' && <>
          <div className="muted small-text">Chapters in this test — the app will give these extra practice in the week before.</div>
          <MultiChapterPicker value={e.chapters || []} onChange={(v) => set('chapters', v)} />
        </>}
        <textarea rows={2} placeholder="Notes" value={e.notes || ''} onChange={(x) => set('notes', x.target.value)} />
        <div className="row wrap">Remind:
          {[[2, '2 days before'], [1, '1 day before'], [0, 'On the day']].map(([n, l]) => (
            <label key={n} className="check"><input type="checkbox" checked={(e.remind || []).includes(n)} onChange={() => toggleRemind(n)} /> {l}</label>
          ))}
        </div>
        <button className="primary" disabled={!e.title || !e.date} onClick={save}>Save</button>
        {ev.id && <div className="row wrap">
          <a className="button small" href={gcalLink(e)} target="_blank" rel="noreferrer">Add to Google Calendar</a>
          <button className="small" onClick={() => downloadICS(e)}>Download .ics</button>
          <button className="danger small" onClick={async () => { if (confirm('Delete this event?')) { await deleteEvent(F.family.id, ev.id); onClose(); } }}>Delete</button>
        </div>}
      </div>
    </Modal>
  );
}

export function WalletPage({ F, me, embedded = false }) {
  const s = walletSummary(F.wallet);
  const goal = F.family.goal;
  const [modal, setModal] = useState(null);
  const isParent = me.role === 'parent';
  const month = ymd().slice(0, 7);
  const monthEarn = F.wallet.filter((w) => w.type === 'earn' && w.date?.startsWith(month)).reduce((a, w) => a + w.amount, 0);
  return (
    <div className="stack">
      {!embedded && <PageHead title="Rewards" />}
      <Card>
        <div className="row"><Tile icon="wallet" tone="green" /><div className="grow"><div className="muted small-text">To be paid</div><div className="big-score" style={{ fontSize: 30 }}>{rupees(s.balance)}</div></div></div>
        <div className="row between muted small-text"><span>Earned {rupees(s.earned + s.bonus)} total</span><span>Paid {rupees(s.paid)}</span><span>This month {rupees(monthEarn)} / {rupees(F.settings.rewards.monthlyCap)}</span></div>
        {goal?.amount > 0 && <div className="goal">
          <div className="row between"><b>🎯 {goal.name}</b><span>{rupees(Math.min(s.earned + s.bonus - (goal.startedAt || 0), goal.amount))} / {rupees(goal.amount)}</span></div>
          <Progress value={s.earned + s.bonus - (goal.startedAt || 0)} max={goal.amount} color="var(--good)" />
        </div>}
        <div className="row wrap">
          {!isParent && <button className="small" onClick={() => setModal('goal')}>{goal ? 'Change goal' : 'Set a savings goal'}</button>}
          {isParent && <button className="primary small" onClick={() => setModal('payout')}>Record payout</button>}
          {isParent && <button className="small" onClick={() => setModal('bonus')}>Add bonus</button>}
        </div>
      </Card>
      <Card title="How to earn">
        <ul className="rules">
          <li>Full routine done: <b>{rupees(F.settings.rewards.dayComplete)}</b></li>
          <li>7-day streak: <b>{rupees(F.settings.rewards.streak7)}</b></li>
          <li>Test 80%+: <b>{rupees(F.settings.rewards.test80)}</b> · 90%+: <b>{rupees(F.settings.rewards.test90)}</b></li>
          <li>Each mistake cleared: <b>{rupees(F.settings.rewards.mistakeCleared)}</b></li>
        </ul>
      </Card>
      <Card title="History">
        {!F.wallet.length && <p className="muted">No entries yet.</p>}
        {F.wallet.map((w) => (
          <div key={w.id} className="row between wallet-row">
            <span><span className="muted small-text">{w.date}</span> {w.reason}</span>
            <span className={w.type === 'payout' ? 'bad-text' : 'ok'}>{w.type === 'payout' ? '−' : '+'}{rupees(w.amount)}
              {isParent && <button className="ghost small" onClick={() => confirm('Delete this entry?') && deleteWallet(F.family.id, w.id)}>✕</button>}</span>
          </div>
        ))}
      </Card>
      {modal && <WalletModal F={F} kind={modal} me={me} onClose={() => setModal(null)} />}
    </div>
  );
}

export function WalletModal({ F, kind, me, onClose }) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState(kind === 'payout' ? 'Paid' : '');
  const save = async () => {
    const amt = Math.round(Number(amount));
    if (!amt) return;
    if (kind === 'goal') {
      const s = walletSummary(F.wallet);
      await updateDoc(doc(db, 'families', F.family.id), { goal: { name: reason, amount: amt, startedAt: s.earned + s.bonus } });
    } else {
      await addWallet(F.family.id, `${kind}-${Date.now()}`, { type: kind, amount: amt, reason: reason || (kind === 'bonus' ? 'Bonus' : 'Paid'), by: me.name });
      if (kind === 'payout') await saveItem(F.family.id, 'money', { type: 'in', amount: amt, currency: 'INR', account: 'Cash', category: 'Reward (Abhyasa)', from: me.name, note: 'Reward payout', date: ymd(), byRole: me.role });
    }
    onClose();
  };
  return (
    <Modal title={kind === 'goal' ? 'Savings goal' : kind === 'payout' ? 'Record payout' : 'Add bonus'} onClose={onClose}>
      <div className="stack">
        <input placeholder={kind === 'goal' ? 'What are you saving for? (e.g. Cricket bat)' : kind === 'bonus' ? 'Reason (e.g. Great PTM report)' : 'Note (cash / UPI)'} value={reason} onChange={(e) => setReason(e.target.value)} />
        <input inputMode="numeric" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <button className="primary" onClick={save}>Save</button>
      </div>
    </Modal>
  );
}

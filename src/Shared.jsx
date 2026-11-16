import { useState } from 'react';
import { Card, Modal, MultiChapterPicker, Progress, rupees, PageHead } from './components';
import { Icon, Tile } from './icons';
import { addWallet, deleteEvent, deleteWallet, saveEvent } from './lib/data';
import { daysBetween, walletSummary, ymd } from './lib/logic';
import { chapterLabel } from './lib/syllabus';
import { downloadICS } from './lib/notify';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const TYPES = {
  test: { label: 'Test / Exam', icon: '📝' },
  function: { label: 'School function', icon: '🎭' },
  ptm: { label: 'PTM', icon: '👨‍👩‍👦' },
  homework: { label: 'Homework / project due', icon: '📒' },
  personal: { label: 'Personal', icon: '⭐' }
};

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

export function CalendarPage({ F, me }) {
  const today = ymd();
  const [edit, setEdit] = useState(null);
  const [showPast, setShowPast] = useState(false);
  const upcoming = F.events.filter((e) => e.date >= today);
  const past = F.events.filter((e) => e.date < today).reverse();
  return (
    <div className="stack">
      <PageHead title="Calendar" right={<button className="primary small" onClick={() => setEdit({ type: 'test', date: today, title: '', remind: [1, 0], chapters: [] })}><Icon name="plus" size={16} /> Add</button>} />
      <Card>
        {!upcoming.length && <p className="muted">Nothing coming up. Add tests, PTMs, functions or anything to remember.</p>}
        {upcoming.map((e) => <EventRow key={e.id} e={e} today={today} onClick={() => setEdit(e)} />)}
        {past.length > 0 && <button className="ghost small" onClick={() => setShowPast(!showPast)}>{showPast ? 'Hide' : 'Show'} past events ({past.length})</button>}
        {showPast && past.map((e) => <EventRow key={e.id} e={e} today={today} onClick={() => setEdit(e)} />)}
      </Card>
      {edit && <EventModal F={F} me={me} ev={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EventRow({ e, today, onClick }) {
  const gap = daysBetween(today, e.date);
  return (
    <div className={`event-row ${e.type}`} onClick={onClick}>
      <div className="event-date"><b>{new Date(e.date).getDate()}</b><span>{new Date(e.date).toLocaleString('en-IN', { month: 'short' })}</span></div>
      <div className="grow">
        <b>{TYPES[e.type]?.icon} {e.title}</b>
        <div className="muted small-text">{e.time || 'All day'}{gap >= 0 ? ` · ${gap === 0 ? 'today' : gap === 1 ? 'tomorrow' : `in ${gap} days`}` : ''}{e.byRole === 'parent' ? ' · from parent' : ''}</div>
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

export function WalletPage({ F, me }) {
  const s = walletSummary(F.wallet);
  const goal = F.family.goal;
  const [modal, setModal] = useState(null);
  const isParent = me.role === 'parent';
  const month = ymd().slice(0, 7);
  const monthEarn = F.wallet.filter((w) => w.type === 'earn' && w.date?.startsWith(month)).reduce((a, w) => a + w.amount, 0);
  return (
    <div className="stack">
      <PageHead title="Wallet" />
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

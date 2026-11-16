import { useState } from 'react';
import { Card, Modal, PageHead } from './components';
import { Icon, Tile } from './icons';
import { deleteItem, saveItem } from './lib/data';
import { formatMoney, moneyBalances, spendSummary, ymd } from './lib/logic';

export const CURRENCIES = ['INR', 'USD', 'AED', 'EUR', 'GBP', 'SGD', 'SAR', 'QAR', 'OMR', 'KWD', 'BHD', 'MYR', 'THB', 'AUD', 'CAD', 'JPY'];
const IN_CATS = ['Pocket money', 'Gift', 'Reward (Abhyasa)', 'Birthday', 'Festival', 'Prize', 'Savings interest', 'Other'];
const OUT_CATS = ['Snacks & food', 'Stationery', 'Books', 'Toys & games', 'Clothes', 'Sports', 'Outings & movies', 'Travel', 'Gifts for others', 'Apps & games online', 'Donation', 'School fees / trips', 'Other'];
const DEFAULT_ACCOUNTS = ['Cash', 'Bank account', 'Debit / prepaid card', 'Piggy bank'];

function payerLabel(p, F) {
  if (!p || p === 'self') return 'Me';
  if (p === 'dad') return 'Appa';
  if (p === 'mom') return 'Amma';
  return p;
}

export function FinancePage({ F, me }) {
  const [edit, setEdit] = useState(null);
  const [tab, setTab] = useState('overview');
  const month = ymd().slice(0, 7);
  const balances = moneyBalances(F.money).filter((b) => b.balance !== 0);
  const byCur = {};
  for (const b of balances) byCur[b.currency] = (byCur[b.currency] || 0) + b.balance;
  const sum = spendSummary(F.money, month);
  const monthIn = F.money.filter((e) => e.type === 'in' && e.date?.startsWith(month));
  return (
    <div>
      <PageHead title="My Money" right={<button className="primary small" onClick={() => setEdit({ type: 'out' })}><Icon name="plus" size={16} /> Add</button>} />
      <div className="seg">{[['overview', 'Overview'], ['history', 'History']].map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'overview' && <div className="stack">
        <Card>
          <div className="muted small-text">My money</div>
          {!Object.keys(byCur).length && <div className="big-score" style={{ fontSize: 28 }}>{formatMoney(0)}</div>}
          {Object.entries(byCur).map(([c, v]) => <div key={c} className="big-score" style={{ fontSize: 28 }}>{formatMoney(v, c)}</div>)}
          <div className="row" style={{ marginTop: 8 }}>
            <button className="small" onClick={() => setEdit({ type: 'in' })}><Icon name="download" size={16} /> Received</button>
            <button className="small" onClick={() => setEdit({ type: 'out' })}><Icon name="rupee" size={16} /> Spent</button>
            <button className="small" onClick={() => setEdit({ type: 'transfer' })}><Icon name="repeat" size={16} /> Move</button>
          </div>
        </Card>
        <div className="sec-h" style={{ marginTop: 6 }}><h2>Where my money is</h2></div>
        <div className="card list">
          {!balances.length && <div className="muted small-text" style={{ padding: '12px 0' }}>Add money you receive (cash, gifts, pocket money) to start.</div>}
          {balances.map((b) => (
            <div key={b.account + b.currency} className="lrow">
              <Tile icon={/cash|piggy/i.test(b.account) ? 'wallet' : 'file'} tone={/cash|piggy/i.test(b.account) ? 'green' : 'blue'} />
              <div className="lt"><b>{b.account}</b><small>{b.currency}</small></div>
              <b>{formatMoney(b.balance, b.currency)}</b>
            </div>
          ))}
        </div>
        <div className="sec-h"><h2>This month</h2><span className="muted small-text">{new Date().toLocaleDateString('en-IN', { month: 'long' })}</span></div>
        <Card title="Spent on">
          {!sum.byCategory.length && <p className="muted small-text">No spending this month.</p>}
          {sum.byCategory.map((c) => { const max = sum.byCategory[0].amount; return (
            <div key={c.name + c.currency} style={{ margin: '8px 0' }}>
              <div className="row between small-text"><span>{c.name}</span><b>{formatMoney(c.amount, c.currency)}</b></div>
              <div className="progress"><div style={{ width: `${(c.amount / max) * 100}%`, background: 'var(--accent-b)' }} /></div>
            </div>
          ); })}
        </Card>
        <Card title="Who paid">
          {!sum.byPayer.length && <p className="muted small-text">—</p>}
          {sum.byPayer.map((p) => <div key={p.name + p.currency} className="row between" style={{ padding: '6px 0' }}><span>{payerLabel(p.name)}</span><b>{formatMoney(p.amount, p.currency)}</b></div>)}
          <p className="muted small-text">Only what you paid yourself comes out of your money. What Appa/Amma paid is tracked so you know what things cost.</p>
        </Card>
        <Card title="Received this month">
          {!monthIn.length && <p className="muted small-text">Nothing yet.</p>}
          {monthIn.map((e) => <div key={e.id} className="row between" style={{ padding: '6px 0' }}><span>{e.category}{e.from ? ` · from ${e.from}` : ''}</span><b className="money-in">+{formatMoney(e.amount, e.currency)}</b></div>)}
        </Card>
      </div>}
      {tab === 'history' && <div className="card list">
        {!F.money.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No entries yet.</div>}
        {F.money.map((e) => (
          <button key={e.id} className="lrow" onClick={() => setEdit(e)}>
            <Tile icon={e.type === 'in' ? 'download' : e.type === 'transfer' ? 'repeat' : 'rupee'} tone={e.type === 'in' ? 'green' : e.type === 'transfer' ? 'blue' : 'red'} />
            <div className="lt"><b>{e.note || e.category || (e.type === 'transfer' ? `${e.account} → ${e.toAccount}` : '')}</b>
              <small>{e.date} · {e.type === 'transfer' ? 'Moved' : e.account}{e.type === 'out' ? ` · paid by ${payerLabel(e.paidBy)}` : ''}{e.type === 'in' && e.from ? ` · from ${e.from}` : ''}</small></div>
            <span className={e.type === 'in' ? 'money-in' : e.type === 'out' && (e.paidBy || 'self') === 'self' ? 'money-out' : 'muted'}>
              {e.type === 'in' ? '+' : e.type === 'out' ? '−' : ''}{formatMoney(e.amount, e.currency)}
            </span>
          </button>
        ))}
      </div>}
      {edit && <MoneyModal F={F} me={me} entry={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

export function MoneyModal({ F, me, entry, onClose }) {
  const accounts = [...new Set([...DEFAULT_ACCOUNTS, ...F.money.flatMap((e) => [e.account, e.toAccount]).filter(Boolean)])];
  const [e, setE] = useState({ type: 'out', currency: 'INR', account: 'Cash', toAccount: 'Bank account', paidBy: me.role === 'parent' ? 'dad' : 'self', category: '', date: ymd(), ...entry });
  const [newAcc, setNewAcc] = useState('');
  const set = (k, v) => setE({ ...e, [k]: v });
  const cats = e.type === 'in' ? IN_CATS : OUT_CATS;
  const save = async () => {
    const amount = Number(String(e.amount).replace(/,/g, ''));
    if (!amount) return;
    await saveItem(F.family.id, 'money', { ...e, amount, account: newAcc || e.account, byRole: e.byRole || me.role, category: e.type === 'transfer' ? 'Move' : e.category || 'Other' });
    onClose();
  };
  return (
    <Modal title={entry.id ? 'Edit entry' : 'Add money entry'} onClose={onClose}>
      <div className="stack">
        <div className="seg" style={{ marginBottom: 0 }}>{[['in', 'Received'], ['out', 'Spent'], ['transfer', 'Move']].map(([k, l]) => <button key={k} className={e.type === k ? 'on' : ''} onClick={() => set('type', k)}>{l}</button>)}</div>
        <div className="row">
          <input inputMode="decimal" placeholder="Amount" value={e.amount || ''} onChange={(x) => set('amount', x.target.value)} style={{ flex: 2 }} />
          <select value={e.currency} onChange={(x) => set('currency', x.target.value)} style={{ flex: 1 }}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        {e.type !== 'transfer' && <select value={e.category} onChange={(x) => set('category', x.target.value)}>
          <option value="">{e.type === 'in' ? 'What is it? (pocket money, gift…)' : 'What for? (snacks, books…)'}</option>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>}
        {e.type === 'in' && <input placeholder="From whom? (Appa, Amma, Ajji, Uncle…)" value={e.from || ''} onChange={(x) => set('from', x.target.value)} />}
        {e.type === 'out' && <>
          <div className="muted small-text">Who paid?</div>
          <div className="row wrap">{[['self', 'Me'], ['dad', 'Appa'], ['mom', 'Amma'], ['other', 'Someone else']].map(([k, l]) => <button key={k} className={`small ${e.paidBy === k ? 'primary' : ''}`} onClick={() => set('paidBy', k)}>{l}</button>)}</div>
        </>}
        {(e.type !== 'out' || e.paidBy === 'self') && <>
          <div className="muted small-text">{e.type === 'in' ? 'Kept in' : e.type === 'out' ? 'Paid from' : 'From'}</div>
          <select value={newAcc ? '__new' : e.account} onChange={(x) => { if (x.target.value === '__new') setNewAcc('My account'); else { setNewAcc(''); set('account', x.target.value); } }}>
            {accounts.map((a) => <option key={a}>{a}</option>)}<option value="__new">+ New account / card…</option>
          </select>
          {newAcc && <input placeholder="Account name (e.g. SBI junior account)" value={newAcc} onChange={(x) => setNewAcc(x.target.value)} />}
        </>}
        {e.type === 'transfer' && <><div className="muted small-text">To</div><select value={e.toAccount} onChange={(x) => set('toAccount', x.target.value)}>{accounts.map((a) => <option key={a}>{a}</option>)}</select></>}
        <input placeholder="Note (optional)" value={e.note || ''} onChange={(x) => set('note', x.target.value)} />
        <input type="date" value={e.date} onChange={(x) => set('date', x.target.value)} />
        <button className="primary" onClick={save}>Save</button>
        {entry.id && <button className="danger" onClick={async () => { if (confirm('Delete this entry?')) { await deleteItem(F.family.id, 'money', entry.id); onClose(); } }}>Delete</button>}
      </div>
    </Modal>
  );
}

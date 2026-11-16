import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signIn, signOut, isNative } from './firebase';

const SITE = 'https://abhyasa-3fe1d.web.app';
const APK_URL = 'https://github.com/Amogh-Vageesh/Abhyasa/releases/latest';
import { createFamily, getProfile, joinFamily, useFamily } from './lib/data';
import { syncReminders } from './lib/notify';
import { Card, Modal, PageHead, rupees } from './components';
import { Icon, Tile, Avatar } from './icons';
import { walletSummary } from './lib/logic';
import { StudentToday, StudyPage, LogModal, LearnModal } from './Student';
import { ParentDashboard, ParentTests, ParentSettings, ImportModal, NoteModal } from './Parent';
import { CalendarPage, WalletPage, EventModal, WalletModal } from './Shared';

export default function App() {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u);
    setProfile(u ? await getProfile(u.uid).catch(() => null) : undefined);
  }), []);

  if (user === undefined || (user && profile === undefined)) return <Splash text="Loading…" />;
  if (!user) return <Login />;
  if (!profile) return <Onboarding user={user} onDone={setProfile} />;
  return <Main me={profile} />;
}

function Splash({ text }) {
  return <div className="splash"><img src="/icon.svg" alt="" width="72" /><h1>Abhyasa</h1><p className="muted">{text}</p></div>;
}

function Login() {
  const [err, setErr] = useState('');
  return (
    <div className="splash">
      <img src="/icon.svg" alt="" width="88" />
      <h1>Abhyasa</h1>
      <p className="muted">Daily routine · Practice · Tests · Revision</p>
      <button className="primary big" onClick={() => signIn().catch((e) => setErr(e.message))}>Sign in with Google</button>
      {err && <p className="bad-text small-text">{err}</p>}
      {!isNative && /Android/i.test(navigator.userAgent) && <a className="button small" href={APK_URL}>⬇️ Get the Android app</a>}
    </div>
  );
}


function UpdateBanner() {
  const [v, setV] = useState(null);
  useEffect(() => {
    if (!isNative) return;
    fetch(`${SITE}/download/version.json`, { cache: 'no-store' }).then((r) => r.json()).then((j) => { if (j.version > __BUILD__) setV(j.version); }).catch(() => {});
  }, []);
  if (!v) return null;
  return <a className="note update" href={APK_URL}>⬆️ A new version of Abhyasa is ready — tap to download</a>;
}

function Onboarding({ user, onDone }) {
  const [role, setRole] = useState('');
  const [name, setName] = useState(user.displayName || '');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true); setErr('');
    try {
      const familyId = role === 'student' ? await createFamily(user, name) : await joinFamily(user, name, code);
      onDone({ name, role, familyId });
    } catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <div className="onboard">
      <h2>Welcome to Abhyasa</h2>
      <Card title="Who is using this?">
        <div className="row">
          <button className={`option ${role === 'student' ? 'sel' : ''}`} onClick={() => setRole('student')}>🎒 I’m the student</button>
          <button className={`option ${role === 'parent' ? 'sel' : ''}`} onClick={() => setRole('parent')}>👨‍👩‍👦 I’m a parent</button>
        </div>
        {role && <div className="stack">
          <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
          {role === 'parent' && <input placeholder="Family code from the student’s app (e.g. K7M2QX)" value={code} onChange={(e) => setCode(e.target.value)} />}
          {role === 'student' && <p className="muted small-text">After setup you’ll get a family code to share with your parents.</p>}
          <button className="primary" disabled={busy || !name || (role === 'parent' && code.trim().length < 6)} onClick={go}>{busy ? 'Setting up…' : 'Continue'}</button>
          {err && <p className="bad-text small-text">{err}</p>}
        </div>}
      </Card>
      <button className="ghost small" onClick={signOut}>Use a different Google account</button>
    </div>
  );
}

const STUDENT_NAV = [['home', 'home', 'Home'], ['study', 'book', 'Study'], ['fab'], ['calendar', 'calendar', 'Calendar'], ['more', 'menu', 'More']];
const PARENT_NAV = [['home', 'home', 'Home'], ['tests', 'file', 'Tests'], ['fab'], ['calendar', 'calendar', 'Calendar'], ['more', 'menu', 'More']];

function Main({ me }) {
  const F = useFamily(me.familyId);
  const isParent = me.role === 'parent';
  const nav = isParent ? PARENT_NAV : STUDENT_NAV;
  const [tab, setTab] = useState('home');
  const [sub, setSub] = useState('chapters');
  const [sheet, setSheet] = useState(null); // 'fab' | action key

  useEffect(() => {
    if (F.family) syncReminders({ events: F.events, settings: F.settings, role: me.role }).catch(console.error);
  }, [F.family?.id, F.settings.reminderTime, JSON.stringify(F.events.map((e) => [e.id, e.date, e.time, e.remind]))]);

  if (!F.family) return <Splash text="Loading your family…" />;

  const go = (t, extra) => {
    if (t === 'fab') { setSheet(extra || 'fab'); return; }
    if (t === 'study' && extra) setSub(extra);
    setTab(t); window.scrollTo(0, 0);
  };
  const hasNote = !isParent && F.notes[0] && Date.now() - F.notes[0].at < 86400000;

  let page;
  if (tab === 'home') page = isParent ? <ParentDashboard F={F} me={me} go={go} /> : <StudentToday F={F} go={go} />;
  else if (tab === 'study') page = <StudyPage F={F} sub={sub} setSub={setSub} />;
  else if (tab === 'calendar') page = <CalendarPage F={F} me={me} />;
  else if (tab === 'wallet') page = <WalletPage F={F} me={me} />;
  else if (tab === 'tests') page = <ParentTests F={F} />;
  else if (tab === 'settings') page = <ParentSettings F={F} />;
  else if (tab === 'more') page = <MorePage F={F} me={me} go={go} />;

  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="app">
      <header className="appbar">
        <img src="/icon.svg" alt="" width="30" style={{ borderRadius: 9 }} />
        <span className="brand">Abhyasa</span>
        <span className="sp" />
        <button className="icon-btn" aria-label="Calendar" onClick={() => go('calendar')}><Icon name="bell" />{(hasNote || F.events.some((e) => e.date === today)) && <span className="dot" />}</button>
        <button className="icon-btn" aria-label="More" onClick={() => go('more')}><Avatar name={me.name} tone={isParent ? 'purple' : 'blue'} size={38} /></button>
      </header>
      <main key={tab}><UpdateBanner />{page}</main>
      <nav className="nav">
        {nav.map(([id, icon, label]) => id === 'fab'
          ? <button key="fab" className="fab" aria-label="Add" onClick={() => setSheet('fab')}><span className="fab-in"><Icon name="plus" size={28} /></span></button>
          : <button key={id} className={tab === id ? 'on' : ''} onClick={() => go(id)}><Icon name={icon} size={23} />{label}</button>)}
      </nav>
      {sheet === 'fab' && <FabSheet isParent={isParent} onPick={setSheet} onClose={() => setSheet(null)} />}
      {sheet === 'log' && <LogModal F={F} onClose={() => setSheet(null)} />}
      {sheet === 'learn' && <LearnModal F={F} chapters={[]} onClose={() => setSheet(null)} />}
      {sheet === 'event' && <EventModal F={F} me={me} ev={{ type: 'test', date: today, title: '', remind: [1, 0], chapters: [] }} onClose={() => setSheet(null)} />}
      {sheet === 'import' && <ImportModal F={F} onClose={() => setSheet(null)} />}
      {sheet === 'note' && <NoteModal F={F} me={me} onClose={() => setSheet(null)} />}
      {(sheet === 'payout' || sheet === 'bonus') && <WalletModal F={F} me={me} kind={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function FabSheet({ isParent, onPick, onClose }) {
  const items = isParent
    ? [['import', 'file', 'purple', 'Import a test', 'Paste a test made in your Claude project'],
       ['event', 'calendar', 'blue', 'Add to calendar', 'Test, PTM, function or reminder'],
       ['note', 'send', 'amber', 'Send a note', 'Shows on his home screen'],
       ['bonus', 'gift', 'green', 'Add a bonus', 'Reward something special'],
       ['payout', 'wallet', 'teal', 'Record a payout', 'Money given in cash / UPI']]
    : [['log', 'edit', 'blue', 'Log a class', 'What was taught today'],
       ['learn', 'bulb', 'amber', 'Learn a chapter', 'Open study material'],
       ['event', 'calendar', 'purple', 'Add to calendar', 'Test, function, PTM or anything to remember']];
  return (
    <Modal title="Add" onClose={onClose}>
      <div className="list" style={{ padding: 0 }}>
        {items.map(([k, icon, tone, label, sub]) => (
          <button key={k} className="lrow" onClick={() => onPick(k)}>
            <Tile icon={icon} tone={tone} />
            <div className="lt"><b>{label}</b><small>{sub}</small></div>
            <Icon name="chevR" className="chev" />
          </button>
        ))}
      </div>
    </Modal>
  );
}

function MorePage({ F, me, go }) {
  const isParent = me.role === 'parent';
  const { balance } = walletSummary(F.wallet);
  const rows = isParent
    ? [['wallet', 'wallet', 'green', 'Wallet', `${rupees(balance)} to pay`], ['settings', 'settings', 'gray', 'Settings', 'Routine and reward rules']]
    : [['wallet', 'wallet', 'green', 'Wallet', `${rupees(balance)} earned, unpaid`], ['study:mistakes', 'mistake', 'red', 'Mistake Book', `${F.mistakes.filter((m) => !m.resolved).length} open`], ['study:progress', 'chart', 'blue', 'My progress', 'Last 14 days and scores']];
  return (
    <div>
      <PageHead title="More" />
      <div className="card list">
        {rows.map(([k, icon, tone, label, sub]) => (
          <button key={k} className="lrow" onClick={() => { const [t, x] = k.split(':'); go(t, x); }}>
            <Tile icon={icon} tone={tone} /><div className="lt"><b>{label}</b><small>{sub}</small></div><Icon name="chevR" className="chev" />
          </button>
        ))}
      </div>
      <div className="sec-h"><h2>Family</h2></div>
      <div className="card list">
        <div className="lrow"><Avatar name={F.family.studentName} tone="blue" /><div className="lt"><b>{F.family.studentName}</b><small>Student</small></div></div>
        {Object.entries(F.family.parentNames || {}).map(([uid, n]) => <div key={uid} className="lrow"><Avatar name={n} tone="purple" /><div className="lt"><b>{n}</b><small>Parent</small></div></div>)}
        <div className="lrow"><Tile icon="users" tone="amber" /><div className="lt"><b>Family code</b><small>Parents enter this after signing in</small></div><span className="code">{F.family.code}</span></div>
      </div>
      <div className="sec-h"><h2>App</h2></div>
      <div className="card list">
        {!isNative && <a className="lrow" href={APK_URL} style={{ textDecoration: 'none' }}><Tile icon="download" tone="teal" /><div className="lt"><b>Get the Android app</b><small>Latest version on GitHub</small></div><Icon name="chevR" className="chev" /></a>}
        <div className="lrow"><Tile icon="file" tone="gray" /><div className="lt"><b>Version {__BUILD__ || 'dev'}</b><small>{SITE}</small></div></div>
        <button className="lrow" onClick={signOut}><Tile icon="logout" tone="red" /><div className="lt"><b>Sign out</b><small>{me.name} · {me.role}</small></div></button>
      </div>
    </div>
  );
}

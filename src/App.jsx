import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signIn, signOut, isNative } from './firebase';

const SITE = 'https://abhyasa-3fe1d.web.app';
const APK_URL = 'https://github.com/Amogh-Vageesh/Abhyasa/releases/latest';
import { createFamily, getProfile, joinFamily, useFamily } from './lib/data';
import { syncReminders } from './lib/notify';
import { Card } from './components';
import { StudentToday, MistakeBook, StudyLibrary } from './Student';
import { ParentDashboard, ParentTests, ParentSettings } from './Parent';
import { CalendarPage, WalletPage } from './Shared';

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

const STUDENT_TABS = [
  ['today', '🏠', 'Today'], ['mistakes', '📕', 'Mistakes'], ['calendar', '📅', 'Calendar'], ['wallet', '💰', 'Wallet'], ['more', '☰', 'More']
];
const PARENT_TABS = [
  ['dash', '📊', 'Progress'], ['tests', '📄', 'Tests'], ['calendar', '📅', 'Calendar'], ['wallet', '💰', 'Wallet'], ['settings', '⚙️', 'Settings']
];

function Main({ me }) {
  const F = useFamily(me.familyId);
  const isParent = me.role === 'parent';
  const tabs = isParent ? PARENT_TABS : STUDENT_TABS;
  const [tab, setTab] = useState(tabs[0][0]);

  useEffect(() => {
    if (F.family) syncReminders({ events: F.events, settings: F.settings, role: me.role }).catch(console.error);
  }, [F.family?.id, F.events.length, F.settings.reminderTime, JSON.stringify(F.events.map((e) => [e.id, e.date, e.time, e.remind]))]);

  if (!F.family) return <Splash text="Loading your family…" />;

  let page;
  if (tab === 'today') page = <StudentToday F={F} go={setTab} />;
  else if (tab === 'mistakes') page = <MistakeBook F={F} />;
  else if (tab === 'calendar') page = <CalendarPage F={F} me={me} />;
  else if (tab === 'wallet') page = <WalletPage F={F} me={me} />;
  else if (tab === 'dash') page = <ParentDashboard F={F} me={me} go={setTab} />;
  else if (tab === 'tests') page = <ParentTests F={F} />;
  else if (tab === 'settings') page = <><ParentSettings F={F} /><AccountCard me={me} /></>;
  else if (tab === 'more') page = <><StudyLibrary F={F} /><Card title="Family"><p>Family code for parents: <b className="code">{F.family.code}</b></p><p className="muted small-text">Version {__BUILD__ || 'dev'} · Web: {SITE}</p></Card><AccountCard me={me} /></>;

  return (
    <div className="app">
      <header className="topbar"><img src="/icon.svg" alt="" width="28" /><b>Abhyasa</b><span className="muted small-text">{isParent ? 'Parent' : ''}</span></header>
      <main><UpdateBanner />{page}</main>
      <nav className="tabbar">
        {tabs.map(([id, icon, label]) => (
          <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><span>{icon}</span>{label}</button>
        ))}
      </nav>
    </div>
  );
}

function AccountCard({ me }) {
  return (
    <Card title="Account">
      <p className="small-text">Signed in as {me.name} ({me.role})</p>
      <button className="small" onClick={signOut}>Sign out</button>
    </Card>
  );
}

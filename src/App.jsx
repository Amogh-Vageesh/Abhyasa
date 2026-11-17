import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, signIn, signOut, isNative } from './firebase';
import { applyTheme } from './theme';

const SITE = 'https://abhyasa-3fe1d.web.app';
const APK_URL = 'https://github.com/Amogh-Vageesh/Abhyasa/releases/latest';
import { createFamily, getProfile, joinFamily, useFamily } from './lib/data';
import { syncReminders } from './lib/notify';
import { Card, Modal, PageHead, rupees, useDesktop } from './components';
import { Icon, Tile, Avatar } from './icons';
import { walletSummary } from './lib/logic';
import { StudentToday, LogModal, LearnModal } from './Student';
import { StudyPage } from './Study';
import { PracticePage } from './Practice';
import { PaperModal } from './Subjects';
import { BadgesPage } from './Badges';
import { levelInfo } from './lib/xp';
import { subjectOfFactory } from './Study';
import { ThemePage } from './ThemePage';
import { getWebBg } from './theme';
import { GoalsPage, GoalModal } from './Goals';
import { words } from './theme';
import { ParentDashboard, ParentSettings, ImportModal, NoteModal } from './Parent';
import { WalletPage, EventModal, WalletModal, allEvents } from './Shared';
import { PlannerPage, TaskModal } from './Planner';
import { KidToday, CapturePage, useHomeMode } from './Journey';
import { FinancePage, MoneyModal } from './Finance';
import { InsightsPage } from './Insights';
import { ManageEbooks } from './Ebooks';
import { ExplorePage } from './Explore';
import { SportsPage, SportLogModal, AchievementModal } from './Sports';

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

const STUDENT_NAV = [['home', 'home', 'Home'], ['study', 'book', 'Study'], ['fab'], ['practice', 'target', 'Practice'], ['planner', 'calendar', 'Planner']];
const PARENT_NAV = [['home', 'home', 'Home'], ['study', 'book', 'Study'], ['fab'], ['practice', 'target', 'Practice'], ['planner', 'calendar', 'Planner']];
// Desktop sidebar shows every destination
const SIDE_STUDENT = [['home', 'home', 'Home'], ['study', 'book', 'Study'], ['practice', 'target', 'Practice'], ['planner', 'calendar', 'Planner'], ['finance', 'rupee', 'My Money'], ['goals', 'target', 'My goals'], ['insights', 'bulb', 'My next steps'], ['ebooks', 'file', 'My books'], ['explore', 'bulb', 'Explore'], ['sports', 'trophy', 'Sports'], ['badges', 'trophy', 'Badges'], ['theme', 'settings', 'Theme'], ['more', 'menu', 'More']];
const TOP_STUDENT = [['home', 'Home'], ['study', 'Study'], ['practice', 'Practice'], ['explore', 'Explore'], ['sports', 'Sports'], ['planner', 'Planner'], ['finance', 'Money'], ['ebooks', 'Books']];
const TOP_PARENT = [['home', 'Home'], ['study', 'Study'], ['practice', 'Practice'], ['explore', 'Explore'], ['sports', 'Sports'], ['planner', 'Planner'], ['finance', 'Money'], ['ebooks', 'E-books'], ['settings', 'Settings']];
const SIDE_PARENT = [['home', 'home', 'Home'], ['study', 'book', 'Study'], ['practice', 'target', 'Practice & tests'], ['explore', 'bulb', 'Explore'], ['sports', 'trophy', 'Sports'], ['planner', 'calendar', 'Planner'], ['finance', 'rupee', 'His money'], ['goals', 'target', 'His goals'], ['insights', 'bulb', 'What to do'], ['ebooks', 'file', 'E-books'], ['settings', 'settings', 'Settings'], ['more', 'menu', 'More']];

export function Main({ me }) {
  const [homeMode] = useHomeMode();
  const F = useFamily(me.familyId);
  const isParent = me.role === 'parent';
  const nav = isParent ? PARENT_NAV : STUDENT_NAV;
  const side = isParent ? SIDE_PARENT : SIDE_STUDENT;
  const [tab, setTab] = useState('home');
  const [studyNav, setStudyNav] = useState({});
  const [ptab, setPtab] = useState('practice');
  const [psub, setPsub] = useState('day');
  const [sportTab, setSportTab] = useState('overview');
  const [sheet, setSheet] = useState(null); // 'fab' | action key
  const [launch, setLaunch] = useState(null);
  const [finTab, setFinTab] = useState('overview');
  const [insTab, setInsTab] = useState('insights');
  const [, setThemeTick] = useState(0);
  useEffect(() => { const f = () => setThemeTick((x) => x + 1); window.addEventListener('abhyasa-theme', f); return () => window.removeEventListener('abhyasa-theme', f); }, []);

  useEffect(() => {
    if (F.family) syncReminders({ events: allEvents(F), blocks: F.blocks, settings: F.settings, role: me.role }).catch(console.error);
  }, [F.family?.id, F.settings.reminderTime, JSON.stringify(F.events.map((e) => [e.id, e.date, e.time, e.remind])), JSON.stringify(F.blocks.map((b) => [b.id, b.start, b.days, b.remind]))]);

  if (!F.family) return <Splash text="Loading your family…" />;

  const go = (t, extra) => {
    if (t === 'fab') { setSheet(extra || 'fab'); return; }
    if (t === 'act') {
      const a = extra || {};
      if (a.to === 'practice-chapters') { setLaunch({ type: 'chapters', ids: a.extra, title: a.label }); setPtab('practice'); t = 'practice'; }
      else if (a.to === 'weekly') { setLaunch({ type: 'weekly' }); setPtab('practice'); t = 'practice'; }
      else if (a.to === 'chapter') { const sid = subjectOfFactory(F)(a.extra); setStudyNav({ subject: sid, chapter: a.extra }); t = 'study'; }
      else if (a.to === 'log') { setSheet('log'); return; }
      else if (a.to === 'timetable') { setPsub('timetable'); t = 'planner'; }
      else if (a.to === 'papers') { setPtab('papers'); t = 'practice'; }
      else if (a.to === 'mistakes') { setPtab('mistakes'); t = 'practice'; }
      else t = a.to || 'home';
      setTab(t === 'calendar' ? 'planner' : t); if (t === 'calendar') setPsub('calendar'); window.scrollTo(0, 0); return;
    }
    if (t === 'wallet') { setFinTab('rewards'); t = 'finance'; }
    if (t === 'finance' && extra) setFinTab(extra);
    if (t === 'insights') setInsTab(extra || 'insights');
    if (t === 'study') setStudyNav(typeof extra === 'object' && extra ? extra : {});
    if (t === 'practice' && extra) setPtab(extra);
    if (t === 'mistakes') { setPtab('mistakes'); t = 'practice'; }
    if (t === 'tests') { setPtab('library'); t = 'practice'; }
    if (t === 'planner') setPsub(extra || 'day');
    if (t === 'sports') setSportTab(extra || 'overview');
    if (t === 'calendar') { setPsub('calendar'); t = 'planner'; }
    setTab(t); window.scrollTo(0, 0);
  };
  const hasNote = !isParent && F.notes[0] && Date.now() - F.notes[0].at < 86400000;

  let page;
  if (tab === 'home') page = isParent ? <ParentDashboard F={F} me={me} go={go} /> : homeMode === 'journey' ? <KidToday F={F} go={go} /> : <StudentToday F={F} go={go} />;
  else if (tab === 'capture') page = <CapturePage F={F} me={me} go={go} />;
  else if (tab === 'study') page = <StudyPage F={F} me={me} nav={studyNav} setNav={(n) => { setStudyNav(n); window.scrollTo(0, 0); }} />;
  else if (tab === 'practice') page = <PracticePage F={F} me={me} tab={ptab} setTab={setPtab} launch={launch} clearLaunch={() => setLaunch(null)} />;
  else if (tab === 'planner') page = <PlannerPage F={F} me={me} sub={psub} setSub={setPsub} />;
  else if (tab === 'finance') page = <FinancePage F={F} me={me} tab={finTab} setTab={setFinTab} />;
  else if (tab === 'insights') page = <InsightsPage key={insTab} F={F} me={me} go={go} initial={insTab} />;
  else if (tab === 'badges') page = <BadgesPage F={F} />;
  else if (tab === 'settings') page = <ParentSettings F={F} go={go} />;
  else if (tab === 'ebooks') page = <ManageEbooks F={F} me={me} onBack={() => go(isParent ? 'settings' : 'more')} />;
  else if (tab === 'more') page = <MorePage F={F} me={me} go={go} />;
  else if (tab === 'theme') page = <ThemePage />;
  else if (tab === 'goals') page = <GoalsPage F={F} me={me} />;
  else if (tab === 'explore') page = <ExplorePage F={F} me={me} />;
  else if (tab === 'sports') page = <SportsPage key={sportTab} F={F} me={me} initialTab={sportTab} />;

  const today = new Date().toISOString().slice(0, 10);
  const xp = isParent ? null : levelInfo(F);
  return (
    <div className="shell">
      <div className={`web-bg bgv-${getWebBg()}`} aria-hidden="true" />
      <header className="topnav">
        <div className="topnav-in">
          <button className="topnav-brand" onClick={() => go('home')}><img src="/icon.svg" alt="" width="32" height="32" style={{ borderRadius: 9 }} />Abhyasa</button>
          <nav className="topnav-links" aria-label="Main">
            {(isParent ? TOP_PARENT : TOP_STUDENT).map(([id, label]) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => go(id)}>{label}</button>)}
          </nav>
          <div className="topnav-right">
            <button className="topnav-add" onClick={() => setSheet('fab')}><Icon name="plus" size={18} /> Add</button>
            {xp && <button className="topnav-level" onClick={() => go('badges')}><Icon name="trophy" size={16} />Level {xp.level} · {xp.name}</button>}
            <button className="topnav-icon" aria-label="Calendar" onClick={() => go('calendar')}><Icon name="bell" size={19} />{(hasNote || allEvents(F).some((e) => e.date === today)) && <span className="dot" />}</button>
            <button className="topnav-me" aria-label="More" onClick={() => go('more')}><Avatar name={me.name} tone={isParent ? 'purple' : 'blue'} size={38} /></button>
          </div>
        </div>
      </header>
      <aside className="side">
        <div className="side-brand"><img src="/icon.svg" alt="" width="36" style={{ borderRadius: 11 }} /><b>Abhyasa</b></div>
        <button className="primary side-add" onClick={() => setSheet('fab')}><Icon name="plus" size={20} /> Add</button>
        {side.map(([id, icon, label]) => <button key={id} className={`side-item ${tab === id ? 'on' : ''}`} onClick={() => go(id)}><Icon name={icon} size={22} />{label}</button>)}
        <div className="side-me"><Avatar name={me.name} tone={isParent ? 'purple' : 'blue'} size={36} /><div className="lt"><b>{me.name}</b><small>{xp ? `Level ${xp.level} · ${xp.name}` : 'Parent'}</small></div></div>
      </aside>
      <div className="app">
        <header className="appbar">
          <img src="/icon.svg" alt="" width="32" style={{ borderRadius: 10 }} className="mobile-only" />
          <span className="brand mobile-only">Abhyasa</span>
          <span className="sp" />
          {xp && <button className="xp-head" onClick={() => go('badges')} aria-label="Level"><span className="xp-chip">⭐ {xp.level}</span><span className="xp-stack"><small>{xp.name}</small><span className="progress"><span style={{ width: `${Math.round((xp.into / xp.span) * 100)}%` }} /></span></span></button>}
          <button className="icon-btn" aria-label="Calendar" onClick={() => go('calendar')}><Icon name="bell" />{(hasNote || allEvents(F).some((e) => e.date === today)) && <span className="dot" />}</button>
          <button className="icon-btn mobile-only" aria-label="More" onClick={() => go('more')}><Avatar name={me.name} tone={isParent ? 'purple' : 'blue'} size={38} /></button>
        </header>
        <main key={tab}><UpdateBanner />{page}</main>
        <nav className="nav">
          {nav.map(([id, icon, label]) => id === 'fab'
            ? <button key="fab" className="fab" aria-label="Add" onClick={() => setSheet('fab')}><span className="fab-in"><Icon name="plus" size={28} /></span></button>
            : <button key={id} className={tab === id ? 'on' : ''} onClick={() => go(id)}><Icon name={icon} size={23} />{label}</button>)}
        </nav>
      </div>
      {sheet === 'fab' && <FabSheet isParent={isParent} onPick={setSheet} onClose={() => setSheet(null)} />}
      {sheet === 'log' && <LogModal F={F} go={go} onClose={() => setSheet(null)} />}
      {sheet === 'goal' && <GoalsQuickAdd F={F} me={me} onClose={() => setSheet(null)} />}
      {sheet === 'task' && <TaskModal F={F} me={me} task={{ freq: 'daily', title: '', days: [] }} onClose={() => setSheet(null)} />}
      {sheet === 'money' && <MoneyModal F={F} me={me} entry={{ type: 'out' }} onClose={() => setSheet(null)} />}
      {sheet === 'learn' && <LearnModal F={F} chapters={[]} onClose={() => setSheet(null)} />}
      {sheet === 'paper' && <PaperModal F={F} me={me} paper={{}} onClose={() => setSheet(null)} />}
      {sheet === 'event' && <EventModal F={F} me={me} ev={{ type: 'test', date: today, title: '', remind: [1, 0], chapters: [] }} onClose={() => setSheet(null)} />}
      {sheet === 'import' && <ImportModal F={F} onClose={() => setSheet(null)} />}
      {sheet === 'note' && <NoteModal F={F} me={me} onClose={() => setSheet(null)} />}
      {sheet === 'sport' && <SportLogModal F={F} me={me} entry={{ type: 'class', sport: (F.family?.sports || [])[0]?.id || 'cricket', date: today, minutes: 60, attended: true }} onClose={() => setSheet(null)} />}
      {sheet === 'achv' && <AchievementModal F={F} me={me} entry={{ where: 'school', category: 'sports', result: 'gold', date: today }} onClose={() => setSheet(null)} />}
      {(sheet === 'payout' || sheet === 'bonus') && <WalletModal F={F} me={me} kind={sheet} onClose={() => setSheet(null)} />}
    </div>
  );
}

function FabSheet({ isParent, onPick, onClose }) {
  const items = isParent
    ? [['import', 'file', 'purple', 'Import a test', 'Paste a test made in your Claude project'],
       ['task', 'check', 'teal', 'Add a task', 'Daily, weekly or monthly task for him'],
       ['event', 'calendar', 'blue', 'Add to calendar', 'Test, PTM, function or reminder'],
       ['note', 'send', 'amber', 'Send a note', 'Shows on his home screen'],
       ['bonus', 'gift', 'green', 'Add a bonus', 'Reward something special'],
       ['payout', 'wallet', 'teal', 'Record a payout', 'Money given in cash / UPI'],
       ['sport', 'trophy', 'green', 'Log sports', 'Class, match, tournament or practice'],
       ['achv', 'gift', 'amber', 'Add an achievement', 'Award or certificate — in or outside school']]
    : [['log', 'edit', 'blue', 'Log a class', 'What was taught today'],
       ['goal', 'target', 'amber', 'Something I want to improve', 'Set a goal with small steps'],
       ['task', 'check', 'teal', 'Add a task', 'Daily, weekly or monthly'],
       ['money', 'rupee', 'green', 'Add money / expense', 'Received, spent, who paid'],
       ['paper', 'file', 'red', 'Add a test paper', 'Question paper, answer sheet, marks'],
       ['event', 'calendar', 'purple', 'Add to calendar', 'Test, function, PTM or anything to remember'],
       ['learn', 'bulb', 'amber', 'Learn a chapter', 'Open study material'],
       ['sport', 'trophy', 'green', 'Log sports', 'Class, match, tournament or practice'],
       ['achv', 'gift', 'amber', 'Add an achievement', 'Award or certificate — in or outside school']];
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

function cycleTheme() {
  const order = ['system', 'light', 'dark'];
  const cur = localStorage.getItem('abhyasa-theme') || 'system';
  const next = order[(order.indexOf(cur) + 1) % 3];
  localStorage.setItem('abhyasa-theme', next);
  applyTheme();
}

function MorePage({ F, me, go }) {
  const isParent = me.role === 'parent';
  const { balance } = walletSummary(F.wallet);
  const rows = isParent
    ? [['finance', 'rupee', 'teal', 'His money & rewards', `${rupees(balance)} rewards to pay`], ['insights', 'bulb', 'amber', 'What to do', 'Action plan, fix-it report, exam tips'], ['theme', 'settings', 'gray', 'Theme', 'Light, dark or follow phone'], ['ebooks', 'file', 'red', 'E-books', 'Import textbook PDFs and links'], ['settings', 'settings', 'gray', 'Settings', 'Routine and reward rules']]
    : [['ebooks', 'file', 'red', 'My books', `${F.ebooks.length} textbook(s)`], ['theme', 'settings', 'gray', 'Theme', 'Light, dark or follow phone']];
  const desktop = useDesktop();
  const inTop = new Set((isParent ? TOP_PARENT : TOP_STUDENT).map(([k]) => k));
  const shown = desktop ? rows.filter(([k]) => !inTop.has(k.split(':')[0])) : rows;
  return (
    <div>
      <PageHead title="More" />
      <div className="card list">
        {shown.map(([k, icon, tone, label, sub]) => (
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

function GoalsQuickAdd({ F, me, onClose }) {
  // Reuse the goals page modal through a tiny wrapper
  const [open] = useState(true);
  return open ? <GoalModal F={F} me={me} goal={{}} onClose={onClose} /> : null;
}

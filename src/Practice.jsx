import { useEffect, useMemo, useState } from 'react';
import { Card, Modal, PageHead, QuizRunner } from './components';
import { Icon, Tile } from './icons';
import { questionPool, saveTest } from './lib/data';
import { recordQuiz } from './lib/actions';
import { daysBetween, periodStart, pickQuestions, testWeights, ymd } from './lib/logic';
import { SUBJECTS } from './lib/syllabus';
import { LocalPhotos, PaperModal } from './Subjects';
import { MistakeBook } from './Student';
import { ParentTests } from './Parent';
import { subjectChapters, subjectOfFactory, chapterTitle } from './Study';

const KIND = { practice: 'Practice', revise: 'Revision', test: 'Weekly test', imported: 'Test' };

export function PracticePage({ F, me, tab, setTab, launch, clearLaunch }) {
  const [period, setPeriod] = useState('month');
  const [quiz, setQuiz] = useState(null);
  const [paper, setPaper] = useState(null);
  const today = ymd();
  const subjectOf = subjectOfFactory(F);
  const from = periodStart(period, today);
  const attempts = F.attempts.filter((a) => a.date >= from);
  const tests = attempts.filter((a) => a.kind === 'test' || a.kind === 'imported');
  const papers = F.papers.filter((p) => p.date >= from && p.total);
  const allScores = [...tests.map((t) => t.pct), ...papers.map((p) => Math.round((p.marks / p.total) * 100))];
  const avg = allScores.length ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;
  const qs = attempts.reduce((a, x) => a + (x.total || 0), 0);
  const open = F.mistakes.filter((m) => !m.resolved).length;
  const cleared = F.mistakes.filter((m) => m.resolved && (m.lastRightDate || '') >= from).length;
  const isParent = me.role === 'parent';

  const run = (title, questions, kind = 'practice', extra = {}) => setQuiz({ title, questions, kind, extra });
  useEffect(() => {
    if (!launch) return;
    (async () => {
      if (launch.type === 'chapters') { const pool = await questionPool(launch.ids); run('Focused practice', pickQuestions(pool, 12, { weights: Object.fromEntries(launch.ids.map((id) => [id, 1])) })); }
      if (launch.type === 'weekly') {
        const taught = Object.entries(F.chapters).filter(([, c]) => c.taughtOn).map(([id, c]) => ({ id, ...c }));
        const week = taught.filter((c) => daysBetween(c.lastTaught || c.taughtOn, today) <= 7).map((c) => c.id);
        const pool = await questionPool(taught.map((c) => c.id));
        run('Weekly test', pickQuestions(pool, F.settings.weeklyTestCount, { weights: Object.fromEntries(week.map((id) => [id, 3])) }), 'test', { title: `Weekly test ${today}` });
      }
      clearLaunch?.();
    })();
  }, [launch]);
  if (quiz) return <QuizRunner title={quiz.title} questions={quiz.questions} onCancel={() => setQuiz(null)} onFinish={async (r) => { await recordQuiz(F, quiz.kind, r, quiz.extra); if (quiz.onDone) await quiz.onDone(); setQuiz(null); }} />;

  const tabs = [['practice', 'Practice'], ['papers', 'Papers'], ['mistakes', 'Fix-its'], ['history', 'Progress'], ...(isParent ? [['library', 'Test library']] : [])];
  return (
    <div>
      <PageHead title="Practice" />
      <Card>
        <div className="seg" style={{ marginBottom: 12 }}>{[['week', 'This week'], ['month', 'This month'], ['all', 'All time']].map(([k, l]) => <button key={k} className={period === k ? 'on' : ''} onClick={() => setPeriod(k)}>{l}</button>)}</div>
        <div className="kpis">
          <div><Tile icon="trophy" tone="amber" /><small>Tests & papers</small><b>{tests.length + papers.length}</b></div>
          <div><Tile icon="chart" tone="green" /><small>Average score</small><b>{avg ?? '—'}{avg !== null ? '%' : ''}</b></div>
          <div><Tile icon="target" tone="blue" /><small>Questions</small><b>{qs}</b></div>
          <div><Tile icon="mistake" tone="red" /><small>Fix-its</small><b>{open} open</b><em>{cleared} cleared</em></div>
        </div>
      </Card>
      <div className="seg scroll" style={{ marginTop: 12 }}>{tabs.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
      {tab === 'practice' && <PracticeStart F={F} run={run} setQuiz={setQuiz} />}
      {tab === 'papers' && <PapersList F={F} me={me} onEdit={setPaper} />}
      {tab === 'mistakes' && <MistakeBook F={F} />}
      {tab === 'history' && <History F={F} subjectOf={subjectOf} />}
      {tab === 'library' && isParent && <ParentTests F={F} />}
      {paper && <PaperModal F={F} me={me} paper={paper} onClose={() => setPaper(null)} />}
    </div>
  );
}

function PracticeStart({ F, run, setQuiz }) {
  const today = ymd();
  const [subject, setSubject] = useState('');
  const assigned = F.tests.filter((t) => t.assigned && !t.doneAt && t.kind !== 'paper');
  const taught = Object.entries(F.chapters).filter(([, c]) => c.taughtOn).map(([id, c]) => ({ id, ...c }));
  const weekly = async () => {
    const week = taught.filter((c) => daysBetween(c.lastTaught || c.taughtOn, today) <= 7).map((c) => c.id);
    const older = taught.filter((c) => !week.includes(c.id)).map((c) => c.id);
    const pool = await questionPool([...week, ...older]);
    run('Weekly test', pickQuestions(pool, F.settings.weeklyTestCount, { weights: { ...Object.fromEntries(week.map((id) => [id, 3])), ...testWeights(F.events, today) } }), 'test', { title: `Weekly test ${today}` });
  };
  const bySubject = async (sid, chapterId) => {
    const ids = chapterId ? [chapterId] : subjectChapters(F, sid).map((c) => c.id);
    const pool = await questionPool(ids);
    run(chapterId ? chapterTitle(F, chapterId) : `${SUBJECTS.find((s) => s.id === sid).name} practice`, pickQuestions(pool, 10, { weights: testWeights(F.events, today) }));
  };
  const upcoming = F.events.filter((e) => e.type === 'test' && e.date >= today && e.chapters?.length).slice(0, 2);
  return (
    <div className="stack">
      <div className="card list">
        <button className="lrow" onClick={weekly}><Tile icon="trophy" tone="amber" /><div className="lt"><b>Weekly test</b><small>{F.settings.weeklyTestCount} questions · this week’s chapters, older ones and mistakes</small></div><Icon name="chevR" className="chev" /></button>
      </div>
      <div className="sec-h" style={{ marginTop: 4 }}><h2>Practise a subject</h2></div>
      <div className="chips">{SUBJECTS.map((s) => <button key={s.id} className={`small ${subject === s.id ? 'primary' : ''}`} onClick={() => setSubject(s.id)}>{s.name}</button>)}</div>
      {subject && <div className="card list">
        <button className="lrow" onClick={() => bySubject(subject)}><Tile icon="target" tone="green" /><div className="lt"><b>Mixed practice</b><small>10 questions across chapters</small></div><Icon name="chevR" className="chev" /></button>
        {subjectChapters(F, subject).map((c) => (
          <button key={c.id} className="lrow" onClick={() => bySubject(subject, c.id)}>
            <i className="tile" style={{ '--tc': SUBJECTS.find((s) => s.id === subject).color, fontStyle: 'normal', fontWeight: 800 }}>{c.no}</i>
            <div className="lt"><b>{c.title}</b><small>{F.chapters[c.id]?.status || 'not started'}</small></div><Icon name="chevR" className="chev" />
          </button>
        ))}
      </div>}
      {upcoming.map((e) => (
        <button key={e.id} className="note" style={{ border: 0, width: '100%' }} onClick={async () => { const pool = await questionPool(e.chapters); run(`Prepare: ${e.title}`, pickQuestions(pool, 15)); }}>
          <Tile icon="alert" tone="red" /><div style={{ textAlign: 'left' }}><b>Prepare for {e.title}</b><div className="small-text muted">In {daysBetween(today, e.date)} days · {e.chapters.length} chapter(s)</div></div>
        </button>
      ))}
      {assigned.length > 0 && <>
        <div className="sec-h"><h2>Tests from parents</h2></div>
        <div className="card list">{assigned.map((t) => (
          <button key={t.id} className="lrow" onClick={() => setQuiz({ title: t.title, kind: 'imported', extra: { title: t.title, testId: t.id }, questions: t.questions.map((q) => ({ ...q, id: `${t.id}-${q.id}`, imported: true, chapterId: t.chapterId || null })), onDone: () => saveTest(F.family.id, { id: t.id, doneAt: Date.now() }) })}>
            <Tile icon="file" tone="purple" /><div className="lt"><b>{t.title}</b><small>{t.questions?.length} questions</small></div><Icon name="chevR" className="chev" />
          </button>
        ))}</div>
      </>}
    </div>
  );
}

function PapersList({ F, me, onEdit }) {
  const [subject, setSubject] = useState('all');
  const list = F.papers.filter((p) => subject === 'all' || p.subject === subject);
  return (
    <div className="stack">
      <div className="row between"><div className="chips" style={{ margin: 0 }}>{[['all', 'All'], ...SUBJECTS.map((s) => [s.id, s.name.replace('Social Science', 'Social')])].map(([k, l]) => <button key={k} className={`small ${subject === k ? 'primary' : ''}`} onClick={() => setSubject(k)}>{l}</button>)}</div></div>
      <button className="primary" onClick={() => onEdit({ subject: subject === 'all' ? 'maths' : subject })}><Icon name="plus" size={18} /> Add test paper + answer sheet</button>
      <div className="paper-grid">
        {!list.length && <Card><p className="muted small-text">No test papers yet. Add school tests, worksheets and sample papers with photos of the question paper and your answer sheet.</p></Card>}
        {list.map((p) => {
          const pct = p.total ? Math.round((p.marks / p.total) * 100) : null;
          const s = SUBJECTS.find((x) => x.id === p.subject);
          return (
            <button key={p.id} className="card paper" onClick={() => onEdit(p)}>
              <div className="row between" style={{ width: '100%' }}><span className="pill" style={{ '--tc': s?.color }}>{s?.name}</span>{pct !== null && <b className={pct >= 80 ? 'ok' : pct < 50 ? 'bad-text' : ''}>{pct}%</b>}</div>
              <b>{p.title}</b>
              <small className="muted">{p.date}{pct !== null ? ` · ${p.marks}/${p.total}` : ''}</small>
              <div className="row" style={{ gap: 6 }}><span className="small-text muted">Question paper</span></div>
              <LocalPhotos keys={(p.paperPhotos || []).slice(0, 3)} />
              <div className="row" style={{ gap: 6 }}><span className="small-text muted">Answer sheet</span></div>
              <LocalPhotos keys={(p.answerPhotos || []).slice(0, 3)} />
              {p.reflection && <small className="muted" style={{ whiteSpace: 'pre-wrap' }}>💭 {p.reflection}</small>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function History({ F, subjectOf }) {
  const items = [
    ...F.attempts.map((a) => ({ id: a.id, date: a.date, title: a.title || KIND[a.kind], pct: a.pct, score: `${a.score}/${a.total}`, kind: a.kind })),
    ...F.papers.filter((p) => p.total).map((p) => ({ id: 'p' + p.id, date: p.date, title: p.title, pct: Math.round((p.marks / p.total) * 100), score: `${p.marks}/${p.total}`, kind: 'paper' }))
  ].sort((a, b) => b.date.localeCompare(a.date));
  const chart = items.filter((i) => i.kind !== 'practice' && i.kind !== 'revise').slice(0, 10).reverse();
  const bySubject = useMemo(() => {
    const m = {};
    for (const a of F.attempts) for (const it of a.items || []) { const s = subjectOf(it.chapterId); if (!s) continue; const x = (m[s] ||= { r: 0, t: 0 }); x.t++; if (it.correct) x.r++; }
    return m;
  }, [F.attempts]);
  return (
    <div className="stack">
      <Card title="Tests & papers trend">
        {!chart.length && <p className="muted small-text">Take a weekly test or add test papers to see the trend.</p>}
        {chart.length > 0 && <div className="bars">{chart.map((i) => (
          <div key={i.id} className="bar" title={`${i.title}: ${i.pct}%`}><div className="bar-track" style={{ height: 100 }}><div style={{ height: `${i.pct}%`, background: i.pct >= 80 ? 'var(--good)' : i.pct >= 50 ? 'var(--accent-b)' : 'var(--bad)' }} /></div><small>{i.pct}%</small></div>
        ))}</div>}
      </Card>
      <Card title="Accuracy by subject">
        {SUBJECTS.map((s) => { const x = bySubject[s.id]; const pct = x ? Math.round((x.r / x.t) * 100) : null; return (
          <div key={s.id} style={{ margin: '8px 0' }}>
            <div className="row between small-text"><span>{s.name}</span><b>{pct !== null ? `${pct}% · ${x.t} Qs` : '—'}</b></div>
            <div className="progress"><div style={{ width: `${pct ?? 0}%`, background: s.color }} /></div>
          </div>
        ); })}
      </Card>
      <div className="card list">
        {!items.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No practice yet.</div>}
        {items.slice(0, 40).map((i) => (
          <div key={i.id} className="lrow">
            <Tile icon={i.kind === 'paper' ? 'file' : i.kind === 'test' || i.kind === 'imported' ? 'trophy' : i.kind === 'revise' ? 'repeat' : 'target'} tone={i.pct >= 80 ? 'green' : i.pct >= 50 ? 'amber' : 'red'} />
            <div className="lt"><b>{i.title}</b><small>{i.date}</small></div><b>{i.score}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

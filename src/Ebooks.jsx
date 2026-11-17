import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { get as idbGet, set as idbSet, del as idbDel, keys as idbKeys } from 'idb-keyval';
import { ref as sref, uploadBytesResumable, getDownloadURL, getBlob, deleteObject } from 'firebase/storage';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Card, Modal, PageHead } from './components';
import { Icon, Tile } from './icons';
import { storage, isNative, db } from './firebase';
import { doc, getDoc, setDoc, deleteDoc, Bytes } from 'firebase/firestore';
import { deleteItem, saveItem, loadPackIndex, setBookHidden } from './lib/data';
import { SUBJECTS } from './lib/syllabus';

// ===================== offline PDF store =====================
// Only parent-uploaded (or parent-linked) free PDFs are stored. Link e-books are never cached.
const pdfKey = (e) => `ebook-pdf:${e.id}:${e.fileId || e.storagePath || e.url}`;
export async function isPdfOffline(e) { return !!(await idbGet(pdfKey(e))); }
export async function removePdfOffline(e) {
  for (const k of await idbKeys()) if (String(k).startsWith(`ebook-pdf:${e.id}:`)) await idbDel(k);
}

function b64ToBlob(b64, type = 'application/pdf') {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

// PDFs imported into the app are kept in Firestore as ~700 KB chunks (works on the free plan, no Storage bucket needed)
const CHUNK = 700 * 1024;
const chunkRef = (fid, fileId, i) => doc(db, 'families', fid, 'ebookfiles', `${fileId}_${i}`);
export async function importPdfChunks(fid, file, onProgress) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const fileId = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const n = Math.ceil(buf.length / CHUNK);
  for (let i = 0; i < n; i++) {
    await setDoc(chunkRef(fid, fileId, i), { data: Bytes.fromUint8Array(buf.subarray(i * CHUNK, (i + 1) * CHUNK)), i, n });
    onProgress?.(Math.round(((i + 1) / n) * 100));
  }
  return { fileId, chunks: n };
}
async function deleteChunks(fid, e) {
  if (!e.fileId) return;
  await Promise.all(Array.from({ length: e.chunks || 0 }, (_, i) => deleteDoc(chunkRef(fid, e.fileId, i)).catch(() => {})));
}
async function downloadChunks(e) {
  const parts = await Promise.all(Array.from({ length: e.chunks }, async (_, i) => {
    const s = await getDoc(chunkRef(e.fid, e.fileId, i));
    if (!s.exists()) throw new Error('Part of this book is missing — ask a parent to import it again.');
    return s.data().data.toUint8Array();
  }));
  return new Blob(parts, { type: 'application/pdf' });
}

async function downloadPdf(e) {
  if (e.fileId) return downloadChunks(e);
  if (e.storagePath) {
    if (isNative) {
      // Native: fetch through the native HTTP stack (no browser CORS limits)
      const url = await getDownloadURL(sref(storage, e.storagePath));
      const r = await CapacitorHttp.get({ url, responseType: 'blob' });
      if (r.status >= 400) throw new Error(`Download failed (${r.status})`);
      return b64ToBlob(r.data);
    }
    return getBlob(sref(storage, e.storagePath));
  }
  if (isNative) {
    const r = await CapacitorHttp.get({ url: e.url, responseType: 'blob' });
    if (r.status >= 400) throw new Error(`Download failed (${r.status})`);
    return b64ToBlob(r.data);
  }
  const res = await fetch(e.url);
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  return res.blob();
}

export async function getPdf(e) {
  const k = pdfKey(e);
  const cached = await idbGet(k);
  if (cached) return cached;
  if (!navigator.onLine) throw new Error('offline');
  const blob = await downloadPdf(e);
  await removePdfOffline(e); // drop older versions
  await idbSet(k, blob);
  return blob;
}

// ===================== subject screen buttons =====================
export function EbookButtons({ F, subjectId }) {
  const books = F.ebooks.filter((b) => b.subject === subjectId);
  const [open, setOpen] = useState(null);
  const [offline, setOffline] = useState({});
  useEffect(() => {
    Promise.all(books.filter((b) => b.type === 'pdf').map(async (b) => [b.id, await isPdfOffline(b)])).then((e) => setOffline(Object.fromEntries(e)));
  }, [books.map((b) => b.id + (b.storagePath || b.url)).join(), open]);
  if (!books.length) return null;
  return (
    <>
      <div className="card list" style={{ marginBottom: 12 }}>
        {books.map((b) => (
          <button key={b.id} className="lrow" onClick={() => setOpen({ ...b, fid: F.family.id })}>
            <Tile icon={b.type === 'pdf' ? 'file' : 'book'} tone={b.type === 'pdf' ? 'red' : 'blue'} />
            <div className="lt"><b>Open e-book{b.part ? ` · ${b.part}` : ''}</b>
              <small>{b.title} · {b.type === 'pdf' ? (offline[b.id] ? 'PDF · available offline' : 'PDF · downloads once') : 'Online · needs internet'}</small></div>
            <Icon name="chevR" className="chev" />
          </button>
        ))}
      </div>
      {open && createPortal(open.type === 'pdf'
        ? <PdfScreen ebook={open} onClose={() => setOpen(null)} />
        : <LinkScreen ebook={open} onClose={() => setOpen(null)} />, document.body)}
    </>
  );
}

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

function ScreenHead({ title, onClose, right }) {
  return (
    <div className="reader-head">
      <button className="icon-btn" onClick={onClose} aria-label="Back"><Icon name="chevL" size={24} /></button>
      <b className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</b>
      {right}
    </div>
  );
}

async function openExternal(url) {
  if (isNative) {
    const { InAppBrowser } = await import('@capacitor/inappbrowser');
    await InAppBrowser.openInExternalBrowser({ url });
  } else window.open(url, '_blank', 'noopener');
}

// ===================== link e-books (live from publisher) =====================
function LinkScreen({ ebook, onClose }) {
  const online = useOnline();
  const [state, setState] = useState('loading'); // loading | open | closed | failed
  const [attempt, setAttempt] = useState(0);
  const title = `${ebook.title}${ebook.part ? ' · ' + ebook.part : ''}`;

  // Native: real in-app WebView (JS + DOM storage on), our screen stays behind it
  useEffect(() => {
    if (!isNative || !online) return;
    let handles = [], timer;
    (async () => {
      const { InAppBrowser, ToolbarPosition, AndroidViewStyle } = await import('@capacitor/inappbrowser');
      handles.push(await InAppBrowser.addListener('browserPageLoaded', () => { clearTimeout(timer); setState('open'); }));
      handles.push(await InAppBrowser.addListener('browserClosed', () => setState((s) => (s === 'failed' ? s : 'closed'))));
      setState('loading');
      timer = setTimeout(() => setState((s) => (s === 'loading' ? 'failed' : s)), 25000);
      try {
        await InAppBrowser.openInWebView({
          url: ebook.url,
          options: {
            showURL: false, showToolbar: true, clearCache: true, clearSessionCache: false,
            mediaPlaybackRequiresUserAction: false, closeButtonText: 'Close', toolbarPosition: ToolbarPosition.TOP,
            showNavigationButtons: true, leftToRight: false, customWebViewUserAgent: null,
            android: { allowZoom: true, hardwareBack: true, pauseMedia: true },
            iOS: { allowOverScroll: true, enableViewportScale: true, allowInLineMediaPlayback: true, surpressIncrementalRendering: false, viewStyle: 2, animationEffect: 2, allowsBackForwardNavigationGestures: true }
          }
        });
      } catch (err) { console.error(err); clearTimeout(timer); setState('failed'); }
    })();
    return () => { clearTimeout(timer); handles.forEach((h) => h.remove()); };
  }, [online, attempt]);

  return (
    <div className="reader">
      <ScreenHead title={title} onClose={onClose} right={<button className="small" onClick={() => openExternal(ebook.url)}>Open in browser</button>} />
      {!online ? (
        <div className="reader-msg"><Tile icon="alert" tone="red" size={56} /><h3>No internet</h3><p className="muted">This e-book loads live from the publisher, so it needs an internet connection.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>
      ) : isNative ? (
        <div className="reader-msg">
          {state === 'loading' && <><div className="spinner" /><p className="muted">Opening e-book…</p></>}
          {state === 'open' && <><div className="spinner" /><p className="muted">E-book is open.</p></>}
          {state === 'closed' && <><Tile icon="book" tone="blue" size={56} /><p className="muted">E-book closed.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Open again</button><button className="ghost" onClick={onClose}>Back to subject</button></>}
          {state === 'failed' && <><Tile icon="alert" tone="amber" size={56} /><h3>The page didn’t load here</h3><p className="muted">Some publisher sites only work in a full browser.</p><button className="primary" onClick={() => openExternal(ebook.url)}>Open in browser</button><button className="ghost" onClick={() => setAttempt(attempt + 1)}>Try again in app</button></>}
        </div>
      ) : (
        <WebFrame url={ebook.url} key={attempt} />
      )}
    </div>
  );
}

// Desktop / web: embedded view; publishers that block embedding fall back to the browser button
function WebFrame({ url }) {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 12000); return () => clearTimeout(t); }, []);
  return (
    <div className="reader-body">
      {!loaded && <div className="reader-overlay"><div className="spinner" /><p className="muted">Loading from publisher…</p>{slow && <><p className="muted small-text">Taking long? Some sites can’t be shown inside the app.</p><button className="primary small" onClick={() => window.open(url, '_blank', 'noopener')}>Open in browser</button></>}</div>}
      <iframe title="e-book" src={url} onLoad={() => setLoaded(true)} referrerPolicy="no-referrer-when-downgrade"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads" allow="fullscreen" />
      {loaded && <div className="reader-hint">Page blank or asking to open elsewhere? <button className="link" onClick={() => window.open(url, '_blank', 'noopener')}>Open in browser</button></div>}
    </div>
  );
}

// ===================== PDF e-books (offline) =====================
let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist/legacy/build/pdf.min.mjs'),
      import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')
    ]).then(([lib, worker]) => { lib.GlobalWorkerOptions.workerSrc = worker.default; return lib; });
  }
  return pdfjsPromise;
}

function PdfScreen({ ebook, onClose }) {
  const [doc, setDoc] = useState(null);
  const [err, setErr] = useState('');
  const [zoom, setZoom] = useState(1);
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('Opening…');
  const lastPageKey = `ebook-last-page:${ebook.id}`;
  useEffect(() => {
    let cancelled = false, loaded;
    setErr(''); setDoc(null);
    (async () => {
      try {
        const offline = await isPdfOffline(ebook);
        setStatus(offline ? 'Opening…' : 'Downloading once — after this it works offline…');
        const blob = await getPdf(ebook);
        const lib = await loadPdfjs();
        const data = new Uint8Array(await blob.arrayBuffer());
        loaded = await lib.getDocument({ data, cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', iccUrl: '/pdfjs/iccs/' }).promise;
        if (!cancelled) setDoc(loaded);
      } catch (e) {
        if (!cancelled) setErr(e.message === 'offline' ? 'offline' : (e.message || 'Could not open this PDF'));
      }
    })();
    return () => { cancelled = true; loaded?.destroy?.(); };
  }, [attempt]);

  useEffect(() => {
    if (!doc) return;
    const saved = Number(localStorage.getItem(lastPageKey) || 1);
    if (saved > 1) setTimeout(() => document.getElementById(`pdfp-${saved}`)?.scrollIntoView(), 300);
  }, [doc]);
  useEffect(() => { try { localStorage.setItem(lastPageKey, String(page)); } catch {} }, [page]);

  const title = `${ebook.title}${ebook.part ? ' · ' + ebook.part : ''}`;
  return (
    <div className="reader">
      <ScreenHead title={title} onClose={onClose} right={doc && <div className="row">
        <button className="small" onClick={() => setZoom(Math.max(0.6, zoom - 0.2))}>−</button>
        <button className="small" onClick={() => setZoom(Math.min(3, zoom + 0.2))}>+</button>
      </div>} />
      {err === 'offline' && <div className="reader-msg"><Tile icon="alert" tone="red" size={56} /><h3>No internet</h3><p className="muted">This PDF hasn’t been downloaded to this device yet. Connect once to download it — after that it opens offline.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>}
      {err && err !== 'offline' && <div className="reader-msg"><Tile icon="alert" tone="amber" size={56} /><h3>Couldn’t open the PDF</h3><p className="muted small-text">{err}</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button>{ebook.url && <button className="ghost" onClick={() => openExternal(ebook.url)}>Open in browser</button>}</div>}
      {!err && !doc && <div className="reader-msg"><div className="spinner" /><p className="muted">{status}</p></div>}
      {doc && <PdfPages doc={doc} zoom={zoom} onPage={setPage} />}
      {doc && <div className="page-pill">{page} / {doc.numPages}</div>}
    </div>
  );
}

function PdfPages({ doc, zoom, onPage }) {
  const box = useRef(null);
  const [width, setWidth] = useState(360);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (vis) onPage(Number(vis.target.dataset.page));
    }, { root: box.current, threshold: [0.3, 0.6] });
    box.current.querySelectorAll('.pdf-page').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [doc, zoom, width]);
  return (
    <div className="reader-body pdf-scroll" ref={box}>
      {Array.from({ length: doc.numPages }, (_, i) => <PdfPage key={i} doc={doc} n={i + 1} width={Math.max(200, width - 16) * zoom} root={box} />)}
    </div>
  );
}

function PdfPage({ doc, n, width, root }) {
  const holder = useRef(null);
  const canvas = useRef(null);
  const [visible, setVisible] = useState(n <= 2);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { root: root.current, rootMargin: '800px 0px' });
    io.observe(holder.current);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    let task, cancelled = false;
    doc.getPage(n).then((pg) => {
      if (cancelled) return;
      const base = pg.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = pg.getViewport({ scale: (width / base.width) * dpr });
      const c = canvas.current;
      c.width = vp.width; c.height = vp.height;
      c.style.width = `${width}px`; c.style.height = `${vp.height / dpr}px`;
      task = pg.render({ canvasContext: c.getContext('2d'), viewport: vp, canvas: c });
      task.promise.catch(() => {});
    });
    return () => { cancelled = true; task?.cancel?.(); };
  }, [visible, width]);
  return (
    <div className="pdf-page" data-page={n} id={`pdfp-${n}`} ref={holder} style={{ width, minHeight: width * ratio }}>
      <canvas ref={canvas} />
    </div>
  );
}

// ===================== parent: manage e-books =====================
export function ManageEbooks({ F, me, onBack }) {
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(null);
  const isParent = me.role === 'parent';
  return (
    <div>
      <PageHead title={isParent ? 'E-books' : 'My books'} onBack={onBack} right={isParent && <button className="primary small" onClick={() => setEdit({ subject: SUBJECTS[0].id, type: 'pdf', title: '', part: '', url: '' })}><Icon name="plus" size={16} /> Import book</button>} />
      <p className="muted small-text">{isParent
        ? 'Import a free textbook PDF (NCERT / KTBS) or add a publisher web link. PDFs download once to each device and then open offline; links always load live.'
        : 'Your textbooks, by subject. Tap to open. Books are added by Appa/Amma from their login (E-books → Import book).'}</p>
      {SUBJECTS.map((s) => {
        const list = F.ebooks.filter((b) => b.subject === s.id);
        if (!isParent && !list.length) return null;
        return (
          <div key={s.id}>
            <div className="sec-h"><h2>{s.name}</h2>{isParent && <button className="link" onClick={() => setEdit({ subject: s.id, type: 'link', title: '', part: '', url: '' })}><Icon name="plus" size={16} /> Add</button>}</div>
            <div className="card list">
              {!list.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No books yet.</div>}
              {list.map((b) => (
                <div key={b.id} role="button" className="lrow" onClick={() => isParent ? setEdit(b) : setOpen({ ...b, fid: F.family.id })}>
                  <Tile icon={b.type === 'pdf' ? 'file' : 'book'} tone={b.type === 'pdf' ? 'red' : 'blue'} />
                  <div className="lt"><b>{b.title}{b.part ? ` · ${b.part}` : ''}</b><small>{b.type === 'pdf' ? (b.fileId || b.storagePath ? `PDF · works offline${b.fileName ? ' · ' + b.fileName : ''}` : 'PDF link') : 'Online e-book'}</small></div>
                  {isParent ? <div className="row" style={{ gap: 6 }}>
                    <button className="small" onClick={(x) => { x.stopPropagation(); setOpen({ ...b, fid: F.family.id }); }}>Open</button>
                    <button className="small icon-only danger-ghost" aria-label={`Delete ${b.title}`} title="Delete book" onClick={(x) => { x.stopPropagation(); removeEbook(F, b); }}><Icon name="trash" size={16} /></button>
                  </div> : <Icon name="chevR" className="chev" />}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {isParent && <StudyMaterial F={F} />}
      {!isParent && !F.ebooks.length && <div className="card muted small-text">No books yet. Ask Appa/Amma to import your textbooks from their login.</div>}
      {edit && <EbookModal F={F} me={me} ebook={edit} onClose={() => setEdit(null)} />}
      {open && createPortal(open.type === 'pdf'
        ? <PdfScreen ebook={open} onClose={() => setOpen(null)} />
        : <LinkScreen ebook={open} onClose={() => setOpen(null)} />, document.body)}
    </div>
  );
}

async function removeEbook(F, e) {
  if (!confirm(`Delete “${e.title}${e.part ? ' · ' + e.part : ''}”?\n\nThe PDF is removed from the app and from every device. Study material and question banks are separate — manage them under “Study material” below.`)) return false;
  if (e.storagePath) await deleteObject(sref(storage, e.storagePath)).catch(() => {});
  await deleteChunks(F.family.id, e).catch(() => {});
  await removePdfOffline(e).catch(() => {});
  await deleteItem(F.family.id, 'ebooks', e.id);
  return true;
}

// Study material (explainers + question bank) is built from source books. Each book's material can be
// removed (hidden for this family) or restored — removing one book keeps other books for the same chapter.
function StudyMaterial({ F }) {
  const [books, setBooks] = useState(null);
  const [busy, setBusy] = useState('');
  useEffect(() => { loadPackIndex().then((i) => setBooks(i.books || [])); }, []);
  const hidden = F.settings.hiddenBooks || [];
  const toggle = async (b, hide) => {
    if (hide && !confirm(`Remove the study material made from “${b.title}”?\n\n${b.questions} questions and the explainers from this book will no longer appear in Learn, Practice or tests. Past scores stay. You can restore it any time.`)) return;
    setBusy(b.id);
    try { await setBookHidden(F.family.id, F.settings, b.id, hide); } finally { setBusy(''); }
  };
  if (!books) return null;
  const subj = (id) => SUBJECTS.find((s) => s.id === id)?.name || 'Mixed';
  return (
    <div>
      <div className="sec-h"><h2>Study material</h2></div>
      <p className="muted small-text">Explainers and questions in the app come from these source books (prepared from PDFs shared with Claude in chat — not from the books imported above). Remove any you don’t want him to use.</p>
      <div className="card list">
        {!books.length && <div className="muted small-text" style={{ padding: '12px 0' }}>No study material yet.</div>}
        {books.map((b) => {
          const off = hidden.includes(b.id);
          return (
            <div key={b.id} className={`lrow ${off ? 'is-off' : ''}`}>
              <Tile icon="book" tone={off ? 'gray' : 'green'} />
              <div className="lt"><b>{b.title}</b><small>{subj(b.subject)} · {b.chapters.length} chapter{b.chapters.length > 1 ? 's' : ''} · {b.questions} questions{off ? ' · removed' : ''}</small></div>
              {off
                ? <button className="small" disabled={busy === b.id} onClick={() => toggle(b, false)}>Restore</button>
                : <button className="small danger-ghost" disabled={busy === b.id} onClick={() => toggle(b, true)}><Icon name="trash" size={15} /> Remove</button>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EbookModal({ F, me, ebook, onClose }) {
  const [e, setE] = useState({ part: '', ...ebook });
  const [file, setFile] = useState(null);
  const [pdfSource, setPdfSource] = useState(ebook.url && ebook.type === 'pdf' && !ebook.fileId && !ebook.storagePath ? 'url' : 'upload');
  const [progress, setProgress] = useState(null);
  const [err, setErr] = useState('');
  const set = (k, v) => setE({ ...e, [k]: v });
  const valid = (e.title || file) && (e.type === 'link' ? /^https?:\/\//i.test(e.url || '') : pdfSource === 'url' ? /^https?:\/\//i.test(e.url || '') : (file || e.storagePath || e.fileId));

  const save = async () => {
    setErr('');
    try {
      let data = { ...e, order: e.order ?? Date.now(), by: me.name };
      const dropOld = async () => { await deleteChunks(F.family.id, e); if (e.storagePath) await deleteObject(sref(storage, e.storagePath)).catch(() => {}); };
      if (e.type === 'link' || pdfSource === 'url') { if (e.fileId || e.storagePath) await dropOld(); data = { ...data, storagePath: null, fileId: null, chunks: null }; }
      else if (file) {
        if (file.type && file.type !== 'application/pdf') throw new Error('Please choose a PDF file.');
        if (file.size > 60 * 1048576) throw new Error('That PDF is over 60 MB — import it chapter-wise instead.');
        setProgress(0);
        const { fileId, chunks } = await importPdfChunks(F.family.id, file, setProgress);
        await dropOld();
        data = { ...data, fileId, chunks, storagePath: null, url: null, fileName: file.name, size: file.size };
        if (!data.title) data.title = file.name.replace(/\.pdf$/i, '');
      }
      await saveItem(F.family.id, 'ebooks', data);
      onClose();
    } catch (x) {
      setProgress(null);
      const m = String(x?.code || x?.message || x);
      setErr(/storage\/(unknown|bucket-not-found|project-not-found)|404|no default bucket/i.test(m)
        ? 'File storage isn’t switched on in Firebase yet (it needs the Blaze plan). You can paste a direct PDF link instead, or enable Storage and try again.'
        : /unauthorized|permission/i.test(m) ? 'Upload not allowed — check you are signed in as a parent.' : m);
    }
  };
  const remove = async () => { if (await removeEbook(F, ebook)) onClose(); };
  return (
    <Modal title={ebook.id ? 'Edit book' : 'Import book'} onClose={onClose}>
      <div className="stack">
        <select value={e.subject} onChange={(x) => set('subject', x.target.value)}>{SUBJECTS.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <div className="seg" style={{ marginBottom: 0 }}>{[['link', 'Web link'], ['pdf', 'PDF (offline)']].map(([k, l]) => <button key={k} className={e.type === k ? 'on' : ''} onClick={() => set('type', k)}>{l}</button>)}</div>
        <input placeholder="Title (e.g. Siri Kannada)" value={e.title} onChange={(x) => set('title', x.target.value)} />
        <input placeholder="Part (e.g. Part 1, Bhaga-2) — optional" value={e.part || ''} onChange={(x) => set('part', x.target.value)} />
        {e.type === 'link' && <>
          <input inputMode="url" placeholder="https://… (publisher e-book link)" value={e.url || ''} onChange={(x) => set('url', x.target.value.trim())} />
          <p className="muted small-text">Opens inside the app and always loads live from the publisher — never saved on the device.</p>
        </>}
        {e.type === 'pdf' && <>
          <div className="row wrap">{[['upload', 'PDF from this device'], ['url', 'Direct PDF link']].map(([k, l]) => <button key={k} className={`small ${pdfSource === k ? 'primary' : ''}`} onClick={() => setPdfSource(k)}>{l}</button>)}</div>
          {pdfSource === 'upload' && <label className="file-btn">{file ? `📄 ${file.name} (${(file.size / 1048576).toFixed(1)} MB)` : (e.storagePath || e.fileId) ? `📄 ${e.fileName || 'Imported PDF'} — tap to replace` : '📄 Choose PDF file'}
            <input type="file" accept="application/pdf" hidden onChange={(x) => setFile(x.target.files[0] || null)} /></label>}
          {pdfSource === 'url' && <input inputMode="url" placeholder="https://…/book.pdf" value={e.url || ''} onChange={(x) => set('url', x.target.value.trim())} />}
          <p className="muted small-text">Only for free books (KTBS / NCERT). Downloads once to each device and then opens offline.</p>
        </>}
        {progress !== null && <div className="progress"><div style={{ width: `${progress}%`, background: 'var(--accent-b)' }} /></div>}
        {err && <div className="feedback bad small-text">{err}</div>}
        <button className="primary" disabled={!valid || progress !== null} onClick={save}>{progress !== null ? `Importing ${progress}%` : 'Save'}</button>
        {ebook.id && <button className="danger" onClick={remove}>Delete book</button>}
      </div>
    </Modal>
  );
}

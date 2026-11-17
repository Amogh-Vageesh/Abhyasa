import { useEffect, useState } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, orderBy, limit,
  addDoc, deleteDoc, serverTimestamp, arrayUnion, writeBatch, increment, Bytes
} from 'firebase/firestore';
import { db, isNative } from '../firebase';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { DEFAULT_SETTINGS, makeCode, ymd } from './logic';

// ---------- users & family ----------
export async function getProfile(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? s.data() : null;
}

export async function createFamily(user, name) {
  const familyRef = doc(collection(db, 'families'));
  const code = makeCode();
  const batch = writeBatch(db);
  batch.set(familyRef, {
    studentUid: user.uid, studentName: name, parentUids: [], parentNames: {},
    code, settings: DEFAULT_SETTINGS, createdAt: serverTimestamp()
  });
  batch.set(doc(db, 'joinCodes', code), { familyId: familyRef.id });
  batch.set(doc(db, 'users', user.uid), { name, role: 'student', familyId: familyRef.id, email: user.email || '' });
  await batch.commit();
  return familyRef.id;
}

export async function joinFamily(user, name, code) {
  const c = code.trim().toUpperCase();
  const s = await getDoc(doc(db, 'joinCodes', c));
  if (!s.exists()) throw new Error('Family code not found. Check the code shown on the student app.');
  const familyId = s.data().familyId;
  await updateDoc(doc(db, 'families', familyId), {
    parentUids: arrayUnion(user.uid), [`parentNames.${user.uid}`]: name, joinCode: c
  });
  await setDoc(doc(db, 'users', user.uid), { name, role: 'parent', familyId, email: user.email || '' });
  return familyId;
}

// ---------- live family data ----------
function useCollection(familyId, name, opts = {}) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!familyId) return;
    let q = collection(db, 'families', familyId, name);
    if (opts.order) q = query(q, orderBy(opts.order, opts.dir || 'asc'), ...(opts.limit ? [limit(opts.limit)] : []));
    return onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), (e) => console.error(name, e));
  }, [familyId, name]);
  return items;
}

export function useFamily(familyId) {
  const [family, setFamily] = useState(null);
  useEffect(() => {
    if (!familyId) return;
    return onSnapshot(doc(db, 'families', familyId), (s) => setFamily(s.exists() ? { id: s.id, ...s.data() } : null));
  }, [familyId]);
  const days = useCollection(familyId, 'days');
  const chapters = useCollection(familyId, 'chapters');
  const mistakes = useCollection(familyId, 'mistakes');
  const events = useCollection(familyId, 'events', { order: 'date' });
  const wallet = useCollection(familyId, 'wallet', { order: 'date', dir: 'desc' });
  const attempts = useCollection(familyId, 'attempts', { order: 'at', dir: 'desc', limit: 200 });
  const tests = useCollection(familyId, 'tests', { order: 'createdAt', dir: 'desc' });
  const notes = useCollection(familyId, 'notes', { order: 'at', dir: 'desc', limit: 20 });
  const tasks = useCollection(familyId, 'tasks', { order: 'createdAt' });
  const blocks = useCollection(familyId, 'plan');
  const money = useCollection(familyId, 'money', { order: 'date', dir: 'desc' });
  const snotes = useCollection(familyId, 'snotes', { order: 'at', dir: 'desc' });
  const papers = useCollection(familyId, 'papers', { order: 'date', dir: 'desc' });
  const ebooks = useCollection(familyId, 'ebooks', { order: 'order' });
  const goals = useCollection(familyId, 'goals', { order: 'createdAt' });
  const answers = useCollection(familyId, 'answers', { order: 'at', dir: 'desc', limit: 60 });
  const explore = useCollection(familyId, 'explore');
  const sports = useCollection(familyId, 'sports', { order: 'date', dir: 'desc', limit: 800 });
  const achievements = useCollection(familyId, 'achievements', { order: 'date', dir: 'desc' });
  const dayplans = useCollection(familyId, 'dayplans');
  const settings = { ...DEFAULT_SETTINGS, ...(family?.settings || {}), rewards: { ...DEFAULT_SETTINGS.rewards, ...(family?.settings?.rewards || {}) } };
  setHiddenBooks(settings.hiddenBooks);
  return {
    family, settings,
    days: Object.fromEntries(days.map((d) => [d.id, d])),
    chapters: Object.fromEntries(chapters.map((c) => [c.id, c])),
    mistakes, events, wallet, attempts, tests, notes, tasks, blocks, money, snotes, papers, ebooks, goals, answers, explore, sports, achievements, dayplans
  };
}

// ---------- writes ----------
const col = (fid, name) => collection(db, 'families', fid, name);
const dref = (fid, name, id) => doc(db, 'families', fid, name, id);

export const setDay = (fid, date, patch) => setDoc(dref(fid, 'days', date), patch, { merge: true });
export const setChapter = (fid, id, patch) => setDoc(dref(fid, 'chapters', id), patch, { merge: true });
export const setMistake = (fid, qid, data) => setDoc(dref(fid, 'mistakes', qid), data, { merge: true });
export const addAttempt = (fid, data) => addDoc(col(fid, 'attempts'), { ...data, at: Date.now() });
export const saveEvent = (fid, ev) => ev.id
  ? setDoc(dref(fid, 'events', ev.id), ev, { merge: true })
  : addDoc(col(fid, 'events'), ev);
export const deleteEvent = (fid, id) => deleteDoc(dref(fid, 'events', id));
// Deterministic ids make rewards idempotent (no double-paying the same day/test)
export const addWallet = (fid, id, entry) => setDoc(dref(fid, 'wallet', id), { date: ymd(), ...entry, at: Date.now() });
export const deleteWallet = (fid, id) => deleteDoc(dref(fid, 'wallet', id));
export const saveTest = (fid, t) => t.id
  ? setDoc(dref(fid, 'tests', t.id), t, { merge: true })
  : addDoc(col(fid, 'tests'), { ...t, createdAt: Date.now() });
export const deleteTest = (fid, id) => deleteDoc(dref(fid, 'tests', id));
export const addNote = (fid, note) => addDoc(col(fid, 'notes'), { ...note, at: Date.now() });
export const updateSettings = (fid, settings) => updateDoc(doc(db, 'families', fid), { settings });
export const setBookHidden = (fid, settings, bookId, hide) => {
  const cur = settings.hiddenBooks || [];
  const hiddenBooks = hide ? [...new Set([...cur, bookId])] : cur.filter((b) => b !== bookId);
  return updateDoc(doc(db, 'families', fid), { 'settings.hiddenBooks': hiddenBooks });
};

// ---------- study pack ----------
// The Android app reads the latest pack from the website, so new chapters / question papers appear
// without installing a new APK. Last good copy is kept on the device for offline use; the copy
// bundled inside the APK is the final fallback.
const PACK_SITE = 'https://abhyasa-3fe1d.web.app';
async function packJson(path) {
  if (isNative) {
    try {
      const r = await fetch(PACK_SITE + path, { cache: 'no-store' });
      if (r.ok && (r.headers.get('content-type') || '').includes('json')) { const j = await r.json(); idbSet('pack:' + path, j).catch(() => {}); return j; }
    } catch {}
    const saved = await idbGet('pack:' + path).catch(() => null);
    if (saved) return saved;
  }
  const r = await fetch(path);
  return r.json();
}
let packIndex = null;
const packCache = {};
export async function loadPackIndex() {
  if (packIndex) return packIndex;
  try {
    packIndex = await packJson('/pack/index.json');
  } catch { packIndex = { chapters: [] }; }
  return packIndex;
}
// Parent can remove a source book's material (family.settings.hiddenBooks). Questions keep a `src` book tag,
// so one book can be removed while other books for the same chapter stay.
let hiddenBooks = [];
export function setHiddenBooks(list) { hiddenBooks = Array.isArray(list) ? list : []; }
// pack.questions = auto-marked (MCQ) only; pack.written = answers a parent marks
function visible(p) {
  if (!p) return null;
  const keep = (x) => !hiddenBooks.includes(x.src || p.source);
  const all = (p.questions || []).filter(keep);
  const questions = all.filter((q) => q.type !== 'written');
  const written = all.filter((q) => q.type === 'written');
  const explainer = (p.explainer || []).filter(keep);
  if (!all.length && !explainer.length) return null;
  return { ...p, questions, written, explainer };
}
async function rawChapter(id) {
  if (packCache[id] !== undefined) return packCache[id];
  const idx = await loadPackIndex();
  if (!idx.chapters.includes(id)) return (packCache[id] = null);
  try {
    packCache[id] = await packJson(`/pack/${id}.json`);
  } catch { packCache[id] = null; }
  return packCache[id];
}
export async function loadChapter(id) { return visible(await rawChapter(id)); }
export async function questionPool(chapterIds) {
  const packs = await Promise.all(chapterIds.map(loadChapter));
  return packs.filter(Boolean).flatMap((p) => p.questions.map((q) => ({ ...q, chapterId: p.id })));
}
// ---------- Explore (beyond-school discovery track) ----------
let exploreCache = null;
export async function loadExplore() { if (!exploreCache) exploreCache = await packJson('/pack/explore.json'); return exploreCache; }
export const setFamilySports = (fid, list) => updateDoc(doc(db, 'families', fid), { sports: list });
export const startExplore = (fid, date) => updateDoc(doc(db, 'families', fid), { exploreStart: date });
export const saveExplore = (fid, id, data) => setDoc(dref(fid, 'explore', id), data, { merge: true });

export async function writtenPool(chapterIds) {
  const packs = await Promise.all(chapterIds.map(loadChapter));
  return packs.filter(Boolean).flatMap((p) => (p.written || []).map((q) => ({ ...q, chapterId: p.id })));
}

// ---------- written answers (photos kept in Firestore: works on the free plan) ----------
export const saveAnswers = (fid, a) => a.id
  ? setDoc(dref(fid, 'answers', a.id), a, { merge: true })
  : addDoc(col(fid, 'answers'), { ...a, at: Date.now() }).then((r) => r.id);
export const deleteAnswers = async (fid, a) => {
  for (const it of a.items || []) for (const pid of it.photos || []) await deleteDoc(dref(fid, 'answerphotos', pid)).catch(() => {});
  await deleteDoc(dref(fid, 'answers', a.id));
};
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) throw new Error('Could not read that photo.');
  let max = 1600, q = 0.75;
  for (let tries = 0; tries < 6; tries++) {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', q));
    if (blob && blob.size < 850 * 1024) return blob;
    max = Math.round(max * 0.8); q = Math.max(0.5, q - 0.08);
  }
  throw new Error('That photo is too large.');
}
export async function savePhoto(fid, file) {
  const blob = await shrinkImage(file);
  const ref = doc(col(fid, 'answerphotos'));
  await setDoc(ref, { b: Bytes.fromUint8Array(new Uint8Array(await blob.arrayBuffer())), type: 'image/jpeg', at: Date.now() });
  idbSet('aphoto:' + ref.id, blob).catch(() => {});
  return ref.id;
}
export async function loadPhoto(fid, id) {
  const cached = await idbGet('aphoto:' + id).catch(() => null);
  if (cached) return cached;
  const s = await getDoc(dref(fid, 'answerphotos', id));
  if (!s.exists()) return null;
  const blob = new Blob([s.data().b.toUint8Array()], { type: s.data().type || 'image/jpeg' });
  idbSet('aphoto:' + id, blob).catch(() => {});
  return blob;
}

export async function questionsById(ids) {
  // ids look like "<chapterId>-q<n>"; imported ones are stored on the mistake doc itself
  const chIds = [...new Set(ids.map((id) => id.replace(/-q\d+$/, '')))];
  const pool = await questionPool(chIds);
  const map = Object.fromEntries(pool.map((q) => [q.id, q]));
  return ids.map((id) => map[id]).filter(Boolean);
}

// ---------- generic docs (tasks, plan, money, notes, papers) ----------
export const saveItem = (fid, name, item) => {
  const { id, ...data } = item;
  return id ? setDoc(dref(fid, name, id), data, { merge: true }) : addDoc(col(fid, name), { ...data, createdAt: Date.now() });
};
export const deleteItem = (fid, name, id) => deleteDoc(dref(fid, name, id));

// Study time per subject per day (seconds), used for insights
export const addStudyTime = (fid, date, subject, seconds) => {
  if (!subject || seconds < 15) return Promise.resolve();
  return setDoc(dref(fid, 'days', date), { time: { [subject]: increment(Math.min(seconds, 3 * 3600)) } }, { merge: true });
};

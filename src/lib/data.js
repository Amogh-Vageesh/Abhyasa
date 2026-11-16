import { useEffect, useState } from 'react';
import {
  doc, getDoc, setDoc, updateDoc, collection, onSnapshot, query, orderBy, limit,
  addDoc, deleteDoc, serverTimestamp, arrayUnion, writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
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
  const settings = { ...DEFAULT_SETTINGS, ...(family?.settings || {}), rewards: { ...DEFAULT_SETTINGS.rewards, ...(family?.settings?.rewards || {}) } };
  return {
    family, settings,
    days: Object.fromEntries(days.map((d) => [d.id, d])),
    chapters: Object.fromEntries(chapters.map((c) => [c.id, c])),
    mistakes, events, wallet, attempts, tests, notes, tasks, blocks, money, snotes, papers, ebooks
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

// ---------- study pack ----------
let packIndex = null;
const packCache = {};
export async function loadPackIndex() {
  if (packIndex) return packIndex;
  try {
    const r = await fetch('/pack/index.json');
    packIndex = await r.json();
  } catch { packIndex = { chapters: [] }; }
  return packIndex;
}
export async function loadChapter(id) {
  if (packCache[id] !== undefined) return packCache[id];
  const idx = await loadPackIndex();
  if (!idx.chapters.includes(id)) return (packCache[id] = null);
  try {
    const r = await fetch(`/pack/${id}.json`);
    packCache[id] = await r.json();
  } catch { packCache[id] = null; }
  return packCache[id];
}
export async function questionPool(chapterIds) {
  const packs = await Promise.all(chapterIds.map(loadChapter));
  return packs.filter(Boolean).flatMap((p) => p.questions.map((q) => ({ ...q, chapterId: p.id })));
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

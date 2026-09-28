import { collection, doc, query, where, getDocs, getDoc, runTransaction, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase.js';
import { cleanItems, validateItems } from './utils/vocabulary.js';
import { validateBackup } from './utils/backup.js';
const ref = (name, id) => id ? doc(db, name, id) : doc(collection(db, name));
const uid = () => { if (!auth.currentUser) throw new Error('Sign in first.'); return auth.currentUser.uid; };
const safeError = message => Object.assign(new Error(message), { safe: true });
export async function loadLibrary() {
  const ownerId = uid();
  const [folders, sets] = await Promise.all(['folders', 'vocabularySets'].map(name => getDocs(query(collection(db, name), where('ownerId', '==', ownerId)))));
  return { folders: folders.docs.map(d => ({ ...d.data(), id: d.id })), sets: sets.docs.map(d => ({ ...d.data(), id: d.id })) };
}
export async function saveSet(input, existing = null) {
  const errors = validateItems(input.items).errors;
  if (errors.length) throw safeError(errors.join(' '));
  const ownerId = uid(), target = ref('vocabularySets', existing?.id);
  return runTransaction(db, async tx => {
    let previous = null;
    if (existing) {
      const snapshot = await tx.get(target); previous = snapshot.data();
      if (!previous || previous.revision !== existing.revision) throw Object.assign(new Error(), { code: 'conflict' });
    }
    const folderIds = new Set([previous?.folderId, input.folderId].filter(Boolean));
    const folderDocs = await Promise.all([...folderIds].map(async id => [id, await tx.get(ref('folders', id))]));
    if (folderDocs.some(([, d]) => !d.exists() || d.data().ownerId !== ownerId)) throw safeError('The folder no longer exists. Select another folder.');
    const data = { ownerId, title: input.title.trim(), unit: input.unit.trim(), folderId: input.folderId || null, items: cleanItems(input.items), published: input.published ?? previous?.published ?? false, shareId: previous?.shareId || crypto.randomUUID(), schemaVersion: 1, revision: (previous?.revision || 0) + 1, createdAt: previous?.createdAt || serverTimestamp(), updatedAt: serverTimestamp() };
    if (!data.title || data.title.length > 150 || data.unit.length > 150) throw safeError('Add a title; title and topic may contain up to 150 characters.');
    if (new TextEncoder().encode(JSON.stringify(data)).length > 700000) throw safeError('This set is too large to save safely. Split it into smaller sets.');
    for (const [id, folder] of folderDocs) {
      const delta = Number(data.folderId === id) - Number(previous?.folderId === id);
      if (delta) tx.update(folder.ref, { setCount: folder.data().setCount + delta, updatedAt: serverTimestamp() });
    }
    tx.set(target, data);
    const publicRef = ref('publicPractices', data.shareId);
    if (data.published) tx.set(publicRef, { title: data.title, unit: data.unit, items: data.items, schemaVersion: 1 });
    else if (previous?.published) tx.delete(publicRef);
    // The private grant authorises public writes without disclosing owner identity.
    tx.set(ref('publicationGrants', data.shareId), { ownerId, setId: target.id });
    return target.id;
  });
}
export async function deleteSet(set) {
  await runTransaction(db, async tx => {
    const current = await tx.get(ref('vocabularySets', set.id));
    if (!current.exists() || current.data().revision !== set.revision) throw Object.assign(new Error(), { code: 'conflict' });
    const data = current.data();
    const folder = data.folderId ? await tx.get(ref('folders', data.folderId)) : null;
    if (folder?.exists()) tx.update(folder.ref, { setCount: folder.data().setCount - 1, updatedAt: serverTimestamp() });
    tx.delete(current.ref);
    if (data.published) tx.delete(ref('publicPractices', data.shareId));
    tx.delete(ref('publicationGrants', data.shareId));
  });
}
export async function saveFolder(name, id = null) {
  name = name.trim(); if (!name || name.length > 100) throw safeError('Enter a folder name of 1–100 characters.');
  const target = ref('folders', id), ownerId = uid();
  await runTransaction(db, async tx => {
    if (id) { const current = await tx.get(target); if (!current.exists()) throw safeError('This folder no longer exists.'); tx.update(target, { name, updatedAt: serverTimestamp() }); }
    else tx.set(target, { name, ownerId, setCount: 0, schemaVersion: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  return target.id;
}
export async function deleteFolder(id) {
  await runTransaction(db, async tx => {
    const folder = await tx.get(ref('folders', id));
    if (!folder.exists() || folder.data().setCount !== 0) throw safeError('Move or delete the sets inside this folder first.');
    tx.delete(folder.ref);
  });
}
export async function loadPublic(id) { if (!/^[\w-]{1,100}$/.test(id)) return null; const snapshot = await getDoc(ref('publicPractices', id)); return snapshot.exists() ? snapshot.data() : null; }
export async function importLibrary(data) {
  validateBackup(data);
  const ownerId = uid(), batch = writeBatch(db), mapping = new Map();
  data.folders.forEach(f => {
    const target = ref('folders'); mapping.set(f.id, target.id);
    batch.set(target, { ownerId, name: f.name.trim(), setCount: data.vocabularySets.filter(s => s.folderId === f.id).length, schemaVersion: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  });
  data.vocabularySets.forEach(s => batch.set(ref('vocabularySets'), { ownerId, title: s.title.trim(), unit: s.unit.trim(), folderId: mapping.get(s.folderId) || null, items: cleanItems(s.items), published: false, shareId: crypto.randomUUID(), schemaVersion: 1, revision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() }));
  await batch.commit();
}

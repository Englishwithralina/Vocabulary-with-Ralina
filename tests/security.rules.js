import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, where, documentId, setDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, setLogLevel } from 'firebase/firestore';

let env, ownerId;
const outsiderId = 'unauthorised-account';
const items = ['one', 'two', 'three', 'four'].map(term => ({ term, meaning: term + ' meaning', example: '' }));
const folderData = (uid = ownerId) => ({ ownerId: uid, name: 'Folder', setCount: 0, schemaVersion: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const setData = (uid = ownerId) => ({ ownerId: uid, title: 'Words', unit: '', folderId: null, items, published: false, shareId: 'share-1', schemaVersion: 1, revision: 1, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const publicData = () => ({ title: 'Words', unit: '', items, schemaVersion: 1 });
const owner = () => env.authenticatedContext(ownerId).firestore();
const guests = () => [env.unauthenticatedContext().firestore(), env.authenticatedContext(outsiderId).firestore()];

before(async () => {
  const rules = await readFile('firestore.rules', 'utf8');
  ownerId = rules.match(/function ownerUid\(\)\s*\{\s*return '([^']+)'/u)?.[1];
  assert.ok(ownerId && ownerId !== '__OWNER_UID_NOT_CONFIGURED__', 'Insert the actual teacher UID before testing/deploying.');
  setLogLevel('silent');
  env = await initializeTestEnvironment({ projectId: 'demo-vocabulary-ralina', firestore: { rules, host: '127.0.0.1', port: 8080 } });
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); });

async function publish(db = owner()) {
  const batch = writeBatch(db);
  batch.set(doc(db, 'vocabularySets', 'set-1'), { ...setData(), published: true });
  batch.set(doc(db, 'publicationGrants', 'share-1'), { ownerId, setId: 'set-1' });
  batch.set(doc(db, 'publicPractices', 'share-1'), publicData());
  await assertSucceeds(batch.commit());
}

test('owner dashboard queries succeed on empty and populated collections', async () => {
  const db = owner();
  for (const name of ['folders', 'vocabularySets']) await assertSucceeds(getDocs(query(collection(db, name), where('ownerId', '==', ownerId))));
  await assertSucceeds(setDoc(doc(db, 'folders', 'f'), folderData()));
  await assertSucceeds(setDoc(doc(db, 'vocabularySets', 'set-1'), setData()));
  for (const name of ['folders', 'vocabularySets']) {
    const result = await assertSucceeds(getDocs(query(collection(db, name), where('ownerId', '==', ownerId))));
    assert.equal(result.size, 1);
  }
});

test('owner private CRUD preserves ownership, revisions and nonempty-folder protection', async () => {
  const db = owner();
  await assertSucceeds(setDoc(doc(db, 'folders', 'f'), folderData()));
  await assertSucceeds(getDoc(doc(db, 'folders', 'f')));
  await assertSucceeds(updateDoc(doc(db, 'folders', 'f'), { name: 'Renamed', updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'folders', 'f'), { ownerId: outsiderId, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db, 'folders', 'f'), { setCount: 1, updatedAt: serverTimestamp() }));
  await assertFails(deleteDoc(doc(db, 'folders', 'f')));
  await assertSucceeds(updateDoc(doc(db, 'folders', 'f'), { setCount: 0, updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(db, 'folders', 'f')));
  await assertSucceeds(setDoc(doc(db, 'vocabularySets', 'set-1'), setData()));
  await assertSucceeds(getDoc(doc(db, 'vocabularySets', 'set-1')));
  await assertFails(updateDoc(doc(db, 'vocabularySets', 'set-1'), { title: 'Stale', revision: 1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(db, 'vocabularySets', 'set-1'), { ownerId: outsiderId, revision: 2, updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(db, 'vocabularySets', 'set-1'), { title: 'Edited', revision: 2, updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(db, 'vocabularySets', 'set-1')));
  await assertFails(setDoc(doc(db, 'vocabularySets', 'foreign'), setData(outsiderId)));
});

test('student and outsider cannot create, read, list, update or delete private data', async () => {
  const db = owner();
  await setDoc(doc(db, 'folders', 'existing'), folderData());
  await setDoc(doc(db, 'vocabularySets', 'existing'), setData());
  for (const visitor of guests()) {
    for (const [name, data] of [['folders', folderData], ['vocabularySets', setData]]) {
      await assertFails(getDoc(doc(visitor, name, 'existing')));
      await assertFails(getDocs(collection(visitor, name)));
      await assertFails(getDocs(query(collection(visitor, name), where('ownerId', '==', ownerId))));
      await assertFails(getDocs(query(collection(visitor, name), where('ownerId', '==', outsiderId))));
      await assertFails(setDoc(doc(visitor, name, 'forged-owner'), data()));
      await assertFails(setDoc(doc(visitor, name, 'own-workspace'), data(outsiderId)));
      await assertFails(updateDoc(doc(visitor, name, 'existing'), { updatedAt: serverTimestamp() }));
      await assertFails(deleteDoc(doc(visitor, name, 'existing')));
    }
  }
});

test('public reads expose only a published projection; no public listing even by ID', async () => {
  await publish();
  for (const visitor of [...guests(), owner()]) {
    const result = await assertSucceeds(getDoc(doc(visitor, 'publicPractices', 'share-1')));
    assert.deepEqual(Object.keys(result.data()).sort(), ['items', 'schemaVersion', 'title', 'unit']);
    await assertFails(getDocs(collection(visitor, 'publicPractices')));
    await assertFails(getDocs(query(collection(visitor, 'publicPractices'), where(documentId(), '==', 'share-1'))));
  }
  for (const visitor of guests()) {
    await assertFails(getDoc(doc(visitor, 'publicationGrants', 'share-1')));
    await assertFails(getDocs(collection(visitor, 'publicationGrants')));
  }
});

test('students and outsiders cannot write public practices or forge publication grants', async () => {
  await publish();
  for (const visitor of guests()) {
    await assertFails(setDoc(doc(visitor, 'publicPractices', 'new'), publicData()));
    await assertFails(setDoc(doc(visitor, 'publicPractices', 'share-1'), publicData()));
    await assertFails(updateDoc(doc(visitor, 'publicPractices', 'share-1'), { title: 'Changed' }));
    await assertFails(deleteDoc(doc(visitor, 'publicPractices', 'share-1')));
    await assertFails(setDoc(doc(visitor, 'publicationGrants', 'forged'), { ownerId, setId: 'set-1' }));
    await assertFails(updateDoc(doc(visitor, 'publicationGrants', 'share-1'), { ownerId: outsiderId }));
    await assertFails(deleteDoc(doc(visitor, 'publicationGrants', 'share-1')));
  }
});

test('owner publication is atomic, rejects extra fields, and deletion revokes the link', async () => {
  const db = owner();
  await publish(db);
  await assertFails(updateDoc(doc(db, 'publicPractices', 'share-1'), { ownerId }));
  await assertFails(updateDoc(doc(db, 'publicPractices', 'share-1'), { title: 'Not the source title' }));
  await assertFails(updateDoc(doc(db, 'publicationGrants', 'share-1'), { setId: 'other' }));
  const edit = writeBatch(db);
  edit.update(doc(db, 'vocabularySets', 'set-1'), { title: 'Edited', revision: 2, updatedAt: serverTimestamp() });
  edit.set(doc(db, 'publicPractices', 'share-1'), { ...publicData(), title: 'Edited' });
  edit.set(doc(db, 'publicationGrants', 'share-1'), { ownerId, setId: 'set-1' });
  await assertSucceeds(edit.commit());
  const remove = writeBatch(db);
  remove.delete(doc(db, 'vocabularySets', 'set-1'));
  remove.delete(doc(db, 'publicPractices', 'share-1'));
  remove.delete(doc(db, 'publicationGrants', 'share-1'));
  await assertSucceeds(remove.commit());
  const result = await assertSucceeds(getDoc(doc(guests()[0], 'publicPractices', 'share-1')));
  assert.equal(result.exists(), false);
});

test('drafts cannot publish; unpublishing hides even a stale public copy', async () => {
  const db = owner(), draft = writeBatch(db);
  draft.set(doc(db, 'vocabularySets', 'set-1'), setData());
  draft.set(doc(db, 'publicationGrants', 'share-1'), { ownerId, setId: 'set-1' });
  draft.set(doc(db, 'publicPractices', 'share-1'), publicData());
  await assertFails(draft.commit());
  await publish(db);
  await updateDoc(doc(db, 'vocabularySets', 'set-1'), { published: false, revision: 2, updatedAt: serverTimestamp() });
  for (const visitor of guests()) await assertFails(getDoc(doc(visitor, 'publicPractices', 'share-1')));
  const revoke = writeBatch(db);
  revoke.update(doc(db, 'vocabularySets', 'set-1'), { published: false, revision: 3, updatedAt: serverTimestamp() });
  revoke.delete(doc(db, 'publicPractices', 'share-1'));
  await assertSucceeds(revoke.commit());
});

test('orphaned and legacy outsider publications cannot be read', async () => {
  const db = owner();
  await publish(db);
  await deleteDoc(doc(db, 'publicationGrants', 'share-1'));
  for (const visitor of guests()) await assertFails(getDoc(doc(visitor, 'publicPractices', 'share-1')));
  await env.withSecurityRulesDisabled(async context => {
    const admin = context.firestore();
    await setDoc(doc(admin, 'vocabularySets', 'legacy'), { ...setData(outsiderId), shareId: 'legacy', published: true });
    await setDoc(doc(admin, 'publicationGrants', 'legacy'), { ownerId: outsiderId, setId: 'legacy' });
    await setDoc(doc(admin, 'publicPractices', 'legacy'), publicData());
  });
  for (const visitor of [...guests(), db]) await assertFails(getDoc(doc(visitor, 'publicPractices', 'legacy')));
});

test('unused collections, nested documents and profile-based privilege escalation are denied', async () => {
  for (const visitor of [...guests(), owner()]) {
    for (const name of ['users', 'teachers', 'unknownCollection', 'folders/f/nested']) {
      await assertFails(getDoc(doc(visitor, name, ownerId)));
      await assertFails(getDocs(collection(visitor, name)));
      await assertFails(setDoc(doc(visitor, name, ownerId), { role: 'teacher', ownerId }));
      await assertFails(deleteDoc(doc(visitor, name, ownerId)));
    }
  }
});

test('owner folder/set atomic import remains allowed', async () => {
  const db = owner(), batch = writeBatch(db);
  batch.set(doc(db, 'folders', 'imported'), { ...folderData(), setCount: 1 });
  batch.set(doc(db, 'vocabularySets', 'imported'), { ...setData(), folderId: 'imported' });
  await assertSucceeds(batch.commit());
});

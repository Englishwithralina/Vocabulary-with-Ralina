import { validateItems, cleanItems } from './vocabulary.js';
export function makeBackup(folders, sets) {
  return { exportVersion: 1, exportedAt: new Date().toISOString(), folders: folders.map(({ id, name }) => ({ id, name })), vocabularySets: sets.map(({ id, title, folderId, unit, items, createdAt, updatedAt }) => ({ id, title, folderId, unit, items: cleanItems(items), createdAt: createdAt?.toDate?.().toISOString() || null, updatedAt: updatedAt?.toDate?.().toISOString() || null, schemaVersion: 1 })) };
}
export function validateBackup(data) {
  if (!data || data.exportVersion !== 1 || !Array.isArray(data.folders) || !Array.isArray(data.vocabularySets)) throw new Error('Choose a version 1 Vocabulary with Ralina backup.');
  // A single atomic batch prevents partially imported libraries.
  if (data.folders.length + data.vocabularySets.length > 400) throw new Error('This backup is too large for one safe import (400 records maximum).');
  if (new Set(data.vocabularySets.map(s => s?.folderId).filter(Boolean)).size > 18) throw new Error('A safe atomic import supports sets in up to 18 folders. Split this backup into smaller files.');
  const ids = new Set();
  for (const f of data.folders) {
    if (!f || typeof f.id !== 'string' || !f.id || ids.has(f.id) || typeof f.name !== 'string' || !f.name.trim() || f.name.length > 100) throw new Error('The backup contains an invalid or repeated folder.');
    ids.add(f.id);
  }
  for (const s of data.vocabularySets) {
    if (!s || s.schemaVersion !== 1 || typeof s.title !== 'string' || !s.title.trim() || s.title.length > 150 || typeof s.unit !== 'string' || s.unit.length > 150 || (s.folderId !== null && !ids.has(s.folderId)) || !Array.isArray(s.items) || s.items.some(x => !x || typeof x.example !== 'string') || validateItems(s.items).errors.length) throw new Error('The backup contains an invalid vocabulary set. No data was imported.');
    if (new TextEncoder().encode(JSON.stringify(s)).length > 700000) throw new Error('A set exceeds the safe document size.');
  }
  return data;
}

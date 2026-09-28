import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVocabulary, validateItems, normalize, shuffle } from '../src/utils/vocabulary.js';
import { optionsFor, createSession, answer, hint } from '../src/games/engine.js';
import { makeBackup, validateBackup } from '../src/utils/backup.js';
const items = [
  { term: 'reliable', meaning: 'надёжный', example: 'A reliable friend.' },
  { term: 'generous', meaning: 'щедрый', example: '' },
  { term: 'patient', meaning: 'терпеливый', example: '' },
  { term: 'self-aware', meaning: 'осознающий себя', example: '' },
];
test('bulk parser preserves hyphenated terms, Cyrillic and separator content', () => {
  const parsed = parseVocabulary(' self-aware | осознающий себя\r\nreliable - надёжный\npatient — терпеливый\ngenerous = щедрый\n\n');
  assert.equal(parsed.errors.length, 0); assert.equal(parsed.items.length, 4); assert.equal(parsed.items[0].term, 'self-aware');
  assert.equal(parseVocabulary('a | b | c').items[0].meaning, 'b | c');
  assert.equal(parseVocabulary('missing separator\na | ').errors.length, 2);
});
test('validation blocks missing fields and duplicate pairs, warns on repeated terms', () => {
  assert.equal(validateItems(items).errors.length, 0);
  assert.ok(validateItems([...items, { ...items[0], term: ' RELIABLE ' }]).errors.length);
  assert.ok(validateItems([...items, { ...items[0], meaning: 'dependable' }]).warnings.length);
  assert.ok(validateItems(items.slice(0, 3)).errors.length);
  assert.ok(validateItems([...items, { term: '', meaning: 'x' }]).errors.length);
});
test('normalization ignores only edge whitespace and case', () => {
  assert.equal(normalize(' Reliable '), 'reliable');
  assert.notEqual(normalize('self aware'), normalize('self-aware'));
  assert.notEqual(normalize('take  off'), normalize('take off'));
  assert.notEqual(normalize('reliabel'), normalize('reliable'));
});
test('shuffle preserves input and does not fix answer positions', () => {
  const input = [1, 2, 3, 4]; assert.deepEqual(shuffle(input, () => 0), [2, 3, 4, 1]); assert.deepEqual(input, [1, 2, 3, 4]);
  assert.deepEqual(shuffle(input, () => .999), input);
  const positions = new Set(Array.from({ length: 120 }, () => optionsFor(items, 0).options.indexOf('надёжный')));
  assert.equal(positions.size, 4);
});
test('distractors are unique and equivalent meanings never become false negatives', () => {
  const ambiguous = [...items, { term: 'reliable', meaning: 'dependable', example: '' }, { term: 'trustworthy', meaning: 'надёжный', example: '' }];
  for (let i = 0; i < 20; i++) {
    const { options, valid } = optionsFor(ambiguous, 0);
    assert.equal(new Set(options).size, options.length); assert.ok(!options.includes('dependable')); assert.ok(valid.includes('dependable'));
    const reverse = optionsFor(ambiguous, 0, true); assert.ok(!reverse.options.includes('trustworthy'));
  }
});
test('sessions cover all four rounds, reject repeat submissions, and isolate mistakes', () => {
  const session = createSession(items); assert.equal(session.queue.length, 16);
  for (let round = 0; round < 4; round++) assert.equal(new Set(session.queue.filter(q => q.round === round).map(q => q.index)).size, 4);
  const index = session.queue[0].index; assert.equal(answer(session, 'no match').correct, false); assert.equal(answer(session, 'ignored'), null);
  assert.deepEqual([...session.mistakes], [index]);
  const review = createSession(items, [...session.mistakes]); assert.deepEqual(review.queue, [{ round: 4, index }]);
  assert.equal(answer(review, ` ${items[index].term.toUpperCase()} `).correct, true);
  assert.equal(createSession(items).mistakes.size, 0);
});
test('supported recall preserves punctuation and reveals word starts', () => {
  assert.equal(hint('take off'), 't··· o··'); assert.equal(hint('self-aware'), 's···-·····');
});
test('backup excludes identity and sharing credentials; validation happens before import', () => {
  const backup = makeBackup([{ id: 'f', name: 'Folder', ownerId: 'private' }], [{ id: 's', title: 'Words', unit: '', folderId: 'f', items, ownerId: 'private', shareId: 'secret' }]);
  assert.equal(validateBackup(backup), backup); assert.ok(!JSON.stringify(backup).includes('private')); assert.ok(!JSON.stringify(backup).includes('secret'));
  assert.throws(() => validateBackup({ ...backup, exportVersion: 99 }));
  assert.throws(() => validateBackup({ ...backup, folders: [] }));
  assert.throws(() => validateBackup({ ...backup, folders: [...backup.folders, ...backup.folders] }));
  assert.throws(() => validateBackup({ ...backup, vocabularySets: [{ ...backup.vocabularySets[0], items: [] }] }));
  assert.throws(() => validateBackup({ ...backup, folders: [null] }), /invalid.*folder/);
  assert.throws(() => validateBackup({ ...backup, vocabularySets: [null] }), /invalid vocabulary set/);
});

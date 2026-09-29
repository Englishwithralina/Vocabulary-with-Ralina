import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import config from '../vite.config.js';

test('Pages mode uses the repository path without changing local or Firebase builds', () => {
  assert.equal(config({ mode: 'github-pages' }).base, '/Vocabulary-with-Ralina/');
  assert.equal(config({ mode: 'development' }).base, './');
  assert.equal(config({ mode: 'production' }).base, './');
});

test('CI stops when Firebase Web settings are missing and never logs their values', () => {
  const names = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
  const env = { ...process.env, ...Object.fromEntries(names.map(name => [name, ''])) };
  const absent = spawnSync(process.execPath, ['scripts/check-pages-env.mjs'], { env, encoding: 'utf8' });
  assert.equal(absent.status, 1);
  for (const name of names) assert.ok(absent.stderr.includes(name));
  const sample = 'test-value-must-not-be-logged';
  for (const name of names) env[name] = sample;
  const present = spawnSync(process.execPath, ['scripts/check-pages-env.mjs'], { env, encoding: 'utf8' });
  assert.equal(present.status, 0);
  assert.ok(!(present.stdout + present.stderr).includes(sample));
  env.VITE_FIREBASE_PROJECT_ID = '   ';
  assert.equal(spawnSync(process.execPath, ['scripts/check-pages-env.mjs'], { env }).status, 1);
});

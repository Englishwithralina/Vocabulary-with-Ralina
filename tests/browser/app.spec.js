import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const pairs = [['reliable','надёжный'],['generous','щедрый'],['patient','терпеливый'],['self-aware','осознающий себя']];
async function createEmulatorOwner(email, password) {
  // Fixed loopback URLs and demo project only: never touch a live account/database.
  const rules = await readFile('firestore.rules', 'utf8');
  const uid = rules.match(/function ownerUid\(\)\s*\{\s*return '([^']+)'/u)?.[1];
  expect(uid && uid !== '__OWNER_UID_NOT_CONFIGURED__').toBeTruthy();
  for (const url of [
    'http://127.0.0.1:9099/emulator/v1/projects/demo-vocabulary-ralina/accounts',
    'http://127.0.0.1:8080/emulator/v1/projects/demo-vocabulary-ralina/databases/(default)/documents',
  ]) expect((await fetch(url, { method: 'DELETE' })).ok).toBe(true);
  const registration = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-vocabulary-ralina/accounts', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: uid, email, password }),
  });
  expect(registration.ok).toBe(true);
}
// This route replaces configuration only inside the test browser; production never uses test credentials.
async function useEmulators(page) {
  await page.route('**/src/firebase.js*', async route => {
    const response = await route.fetch();
    let source = await response.text();
    source = source.replace(/const configured =[^;]+;/, 'const configured = true;');
    source = source.replace(/export const configured =[^;]+;/, 'export const configured = true;');
    source = source.replace(/initializeApp\(firebaseConfig\)/g, "initializeApp({ apiKey: 'emulator-only', authDomain: 'localhost', projectId: 'demo-vocabulary-ralina', appId: 'emulator-only' })");
    source = source.replace('import { getAuth }', 'import { getAuth, connectAuthEmulator }').replace('import { getFirestore }', 'import { getFirestore, connectFirestoreEmulator }');
    source += `\nconnectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });\nconnectFirestoreEmulator(db, '127.0.0.1', 8080);`;
    await route.fulfill({ response, body: source });
  });
}
test('unconfigured app and invalid student link remain useful at mobile sizes', async ({ page }) => {
  // Keep this setup-state test independent of the real .env.local.
  await page.route('**/src/firebase.js*', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace(/const configured =[^;]+;/, 'const configured = false;');
    await route.fulfill({ response, body: source });
  });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Your studio is nearly ready.' })).toBeVisible();
  await page.screenshot({ path: 'test-results/setup-desktop.png', fullPage: true });
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.screenshot({ path: 'test-results/setup-mobile.png', fullPage: true });
  await page.goto('/?practice=unavailable'); await expect(page.getByRole('heading', { name: 'A little pause.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible(); expect(errors).toEqual([]);
});
test('teacher library and student journey work end to end against Firebase emulators', async ({ page, browser }) => {
  test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'Run within Firebase emulators:exec');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const email = `teacher-${Date.now()}@example.test`, password = 'emulator-test-password';
  await createEmulatorOwner(email, password);
  await useEmulators(page); await page.goto('/');
  await expect(page.locator('#app'), () => errors.join('\n')).not.toBeEmpty({ timeout: 15000 });
  await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in to your studio' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Ralina!' })).toBeVisible();
  await page.screenshot({ path: 'test-results/dashboard-empty.png', fullPage: true });
  await page.locator('[data-nav="create"]').click(); await page.getByLabel('Practice title').fill('People & personality');
  await page.getByRole('button', { name: '+ Create folder', exact: true }).click(); await page.getByLabel('Folder name').fill('Focus 2'); await page.getByRole('dialog').getByRole('button', { name: 'Create folder', exact: true }).click();
  await expect(page.locator('#folder option:checked')).toHaveText('Focus 2');
  await page.getByLabel('Unit / topic').fill('Unit 1'); await page.getByLabel('One word and meaning per line').fill(pairs.map(p => p.join(' | ')).join('\n'));
  await page.getByRole('button', { name: 'Add to preview' }).click(); await expect(page.locator('.word-row')).toHaveCount(4);
  await page.locator('#example-0').fill('A reliable friend.'); await page.screenshot({ path: 'test-results/editor.png', fullPage: true });
  await page.getByRole('button', { name: 'Save practice', exact: true }).click(); await expect(page.locator('.set-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Share', exact: true }).click(); await page.getByRole('button', { name: 'Publish & get link' }).click();
  const link = await page.getByLabel('Student practice link').inputValue(); expect(link).toContain('?practice=');
  await page.getByRole('button', { name: 'Copy link', exact: true }).click(); await expect(page.locator('#copy-status')).not.toBeEmpty(); await page.getByRole('button', { name: 'Done', exact: true }).click();
  await page.reload(); await expect(page.locator('.set-card')).toHaveCount(1);
  await page.locator('[data-nav="library"]').click();
  await page.screenshot({ path: 'test-results/library.png', fullPage: true });
  await page.getByRole('button', { name: 'Actions for People & personality' }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Duplicate', exact: true }).click(); await expect(page.locator('.set-card')).toHaveCount(2);
  const original = page.locator('.set-card').filter({ has: page.getByRole('heading', { name: 'People & personality', exact: true }) });
  const duplicate = page.locator('.set-card').filter({ has: page.getByRole('heading', { name: 'People & personality (copy)', exact: true }) });
  await duplicate.getByRole('button', { name: 'Actions for' }).click(); await page.getByRole('button', { name: 'Edit practice', exact: true }).click();
  await page.getByLabel('Practice title').fill('Independent copy'); await page.getByRole('button', { name: 'Save practice', exact: true }).click();
  await expect(original).toHaveCount(1); await expect(page.getByRole('heading', { name: 'Independent copy', exact: true })).toBeVisible();
  await page.locator('[data-nav=dashboard]').click();
  await expect(page.locator('.recent-practices .set-card')).toHaveCount(2);
  await page.screenshot({ path: 'test-results/dashboard-populated.png', fullPage: true, animations: 'disabled' });
  await page.locator('#quick-folder').click(); await page.getByLabel('Folder name').fill('Temporary folder'); await page.getByRole('dialog').getByRole('button', {name:'Create folder',exact:true}).click();
  await expect(page.locator('.folder-tile')).toHaveCount(2);
  await page.locator('[data-nav=folders]').click();
  const temporaryFolder = page.locator('.folder-tile').filter({hasText:'Temporary folder'});
  await temporaryFolder.getByRole('button',{name:'Rename',exact:true}).click(); await page.getByLabel('Folder name').fill('Empty folder'); await page.getByRole('button',{name:'Save name',exact:true}).click();
  await page.locator('.folder-tile').filter({has:page.getByRole('button',{name:'Empty folder',exact:true})}).getByRole('button',{name:'Delete empty folder',exact:true}).click(); await page.getByRole('dialog').getByRole('button',{name:'Delete folder',exact:true}).click();
  await expect(page.locator('.folder-tile')).toHaveCount(1);
  await page.locator('[data-nav=folders]').click(); await expect(page.getByRole('heading', {name:'Folders',exact:true})).toBeVisible(); await expect(page.locator('.folder-tile')).toHaveCount(1);
  await expect(page.locator('.folder-tile').getByRole('button',{name:'Delete empty folder',exact:true})).toBeDisabled();
  await page.screenshot({path:'test-results/folders.png',fullPage:true,animations:'disabled'});
  await page.locator('[data-nav=backup]').click(); await expect(page.getByRole('heading', {name:'Backup',exact:true})).toBeVisible();
  await page.screenshot({path:'test-results/backup.png',fullPage:true,animations:'disabled'});
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export Backup', exact: true }).click(); const download = await downloadPromise;
  const backupPath = await download.path();
  await page.locator('#import-file').setInputFiles(backupPath); await page.getByRole('button', { name: 'Import backup', exact: true }).click(); await expect(page.locator('#toast')).toContainText('Saved to your library'); await page.locator('[data-nav=library]').click(); await expect(page.locator('.set-card')).toHaveCount(4);
  // A fresh browser context has no teacher session.
  const studentContext = await browser.newContext({ viewport: { width: 390, height: 844 } }); const student = await studentContext.newPage(); await useEmulators(student);
  student.on('pageerror', error => errors.push(error.message)); await student.goto(link);
  await expect(student.getByRole('heading', { name: 'People & personality', exact: true })).toBeVisible(); await expect(student.getByText('Teacher workspace')).toHaveCount(0);
  await student.screenshot({ path: 'test-results/student-landing.png', fullPage: true }); await student.getByRole('button', { name: 'Start Practice' }).click(); await student.locator('[name=world][value=uk]').check(); await student.locator('#begin').click();
  for (let q = 0; q < 16; q++) {
    const prompt = await student.locator('.prompt').innerText(); const round = Math.floor(q / 4);
    if (round < 2) {
      const pair = pairs.find(p => p[round === 0 ? 0 : 1] === prompt); const expected = pair[round === 0 ? 1 : 0];
      const options = student.locator('.answer-option');
      if (q === 0) await options.filter({ hasNotText: expected }).first().click();
      else await options.filter({ hasText: expected }).click();
      await expect(student.locator('#feedback')).toBeEmpty();
      await student.getByRole('button', { name: 'Check', exact: true }).click();
    } else {
      const pair = pairs.find(p => p[1] === prompt); await student.getByLabel('Your answer in English').fill(` ${pair[0].toUpperCase()} `); await student.getByRole('button', { name: 'Check', exact: true }).click();
    }
    await expect(student.locator('#feedback')).not.toBeEmpty();
    if (q === 0) await student.screenshot({ path: 'test-results/student-feedback.png', fullPage: true });
    expect(await student.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await student.getByRole('button', { name: 'Next word', exact: true }).click();
  }
  await expect(student.getByText('94%', { exact: true })).toBeVisible(); await student.getByRole('button', { name: /Review \d+ words?/ }).click();
  const reviewPrompt = await student.locator('.prompt').innerText(); await student.getByLabel('Your answer in English').fill(pairs.find(p => p[1] === reviewPrompt)[0]); await student.getByRole('button', { name: 'Check', exact: true }).click(); await student.getByRole('button', { name: 'Next word', exact: true }).click();
  await expect(student.getByText('94%', { exact: true })).toBeVisible(); await expect(student.getByRole('button', { name: /Review \d+ words?/ })).toHaveCount(0);
  await student.screenshot({ path: 'test-results/student-results.png', fullPage: true }); await student.getByRole('button', { name: 'Play again' }).click(); await expect(student.getByText('Round 1 of 4')).toBeVisible();
  // Unpublish the unique published original, not the imported private copy.
  const published = page.locator('.set-card').filter({ has: page.locator('.status.published') }); await published.getByRole('button', { name: 'Actions for' }).click(); await page.getByRole('button', { name: 'Unpublish link', exact: true }).click(); await page.getByRole('button', { name: 'Unpublish', exact: true }).click(); await expect(page.locator('.status.published')).toHaveCount(0);
  await student.reload(); await expect(student.getByRole('heading', { name: 'This practice isn’t available.' })).toBeVisible();
  const card = page.locator('.set-card').first(); await card.getByRole('button', { name: 'Actions for' }).click(); await page.getByRole('button', { name: 'Delete practice', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.locator('.set-card')).toHaveCount(4);
  await card.getByRole('button', { name: 'Actions for' }).click(); await page.getByRole('button', { name: 'Delete practice', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Delete practice', exact: true }).click(); await expect(page.locator('.set-card')).toHaveCount(3);
  await studentContext.close(); expect(errors).toEqual([]);
});

test('folder organisation, editable rows, unsaved protection and mobile teacher layout', async ({ page }) => {
  test.skip(!process.env.FIRESTORE_EMULATOR_HOST, 'Run within Firebase emulators:exec');
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const email = `organise-${Date.now()}@example.test`, password = 'emulator-test-password';
  await createEmulatorOwner(email, password);
  await useEmulators(page); await page.goto('/'); await page.getByLabel('Email address').fill(email); await page.getByLabel('Password', { exact: true }).fill(password); await page.getByRole('button', { name: 'Sign in to your studio' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back, Ralina!' })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('[data-nav="create"]').click();
  await page.getByRole('button', { name: '+ Create folder', exact: true }).click(); await page.getByRole('button', { name: 'Cancel', exact: true }).last().click(); await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByLabel('Practice title').fill('Manual words'); await page.getByRole('button', { name: 'Add word by word', exact: true }).click();
  for (let i = 0; i < pairs.length; i++) { await page.getByRole('button', { name: '+ Add a word', exact: true }).click(); await page.locator(`#term-${i}`).fill(pairs[i][0]); await page.locator(`#meaning-${i}`).fill(pairs[i][1]); }
  await page.getByRole('button', { name: 'Move word 2 up', exact: true }).click(); await expect(page.locator('#term-0')).toHaveValue('generous');
  await page.getByRole('button', { name: '+ Add a word', exact: true }).click(); await page.getByRole('button', { name: 'Delete word 5', exact: true }).click(); await expect(page.locator('.word-row')).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/editor-mobile.png', fullPage: true });
  await page.locator('[data-nav="library"]').click(); await expect(page.getByRole('heading', { name: 'Leave without saving?' })).toBeVisible(); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByLabel('Practice title')).toHaveValue('Manual words');
  await page.getByRole('button', { name: 'Save & Preview' }).click(); await expect(page.getByRole('button', { name: 'Start Practice' })).toBeVisible(); await page.getByRole('button', { name: 'Back to library' }).click();
  await page.getByRole('button', { name: '+ New folder', exact: true }).click(); await page.getByLabel('Folder name').fill('First folder'); await page.getByRole('dialog').getByRole('button', { name: 'Create folder', exact: true }).click();
  await expect(page.getByRole('button', {name:'▱ First folder',exact:true})).toBeVisible();
  await page.getByRole('button', { name: 'Actions for Manual words' }).click(); await page.getByRole('button', { name: 'Move to folder', exact: true }).click(); await page.getByLabel('Folder', { exact: true }).selectOption({ label: 'First folder' }); await page.getByRole('dialog').getByRole('button', { name: 'Move', exact: true }).click();
  await page.getByRole('button', { name: '▱ First folder', exact: true }).click(); await expect(page.locator('.set-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Rename folder', exact: true }).click(); await page.getByLabel('Folder name').fill('Renamed folder'); await page.getByRole('button', { name: 'Save name', exact: true }).click();
  await expect(page.locator('.card-folder')).toHaveText('Renamed folder');
  await page.getByRole('button', { name: 'Delete empty folder', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Delete folder', exact: true }).click(); await expect(page.locator('#toast')).toContainText('Move or delete the sets');
  await page.getByLabel('Search vocabulary sets').fill('reliable'); await expect(page.locator('.set-card')).toHaveCount(1); await page.getByLabel('Search vocabulary sets').fill('no match'); await expect(page.locator('.set-card')).toHaveCount(0); await page.getByLabel('Search vocabulary sets').fill(''); await page.getByLabel('Sort sets').selectOption('title');
  await page.getByRole('button', { name: 'Actions for Manual words' }).click(); await page.getByRole('button', { name: 'Move to folder', exact: true }).click(); await page.getByLabel('Folder', { exact: true }).selectOption(''); await page.getByRole('dialog').getByRole('button', { name: 'Move', exact: true }).click(); await expect(page.locator('.set-card')).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete empty folder', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Delete folder', exact: true }).click(); await expect(page.getByRole('button', { name: '▱ Renamed folder', exact: true })).toHaveCount(0); await expect(page.locator('.set-card')).toHaveCount(1);
  // A stale edit must not overwrite a set saved by another tab.
  const conflict = await page.evaluate(async () => { const { loadLibrary, saveSet } = await import('/src/firestore.js'); const { sets } = await loadLibrary(); const stale = sets[0]; await saveSet({ ...stale, unit: 'Newer edit' }, stale); try { await saveSet({ ...stale, unit: 'Stale edit' }, stale); return 'overwritten'; } catch (error) { return error.code; } });
  expect(conflict).toBe('conflict');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Welcome back.' })).toBeVisible(); await expect(page.getByText('Manual words', { exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});


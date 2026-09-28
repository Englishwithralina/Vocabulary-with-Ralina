import { signOut } from 'firebase/auth';
import { auth } from '../firebase.js';
import { loadLibrary, saveSet, deleteSet, saveFolder, deleteFolder, importLibrary } from '../firestore.js';
import { escape as e, dialog, confirmAction, toast, errorMessage } from '../ui/dom.js';
import { makeBackup, validateBackup } from '../utils/backup.js';
import { studioShell, dashboardView, foldersView, backupView } from '../ui/studio-views.js';
import { icon } from '../ui/icons.js';
import { renderEditor } from './editor.js';
import { renderPractice } from './practice.js';

export function teacherApp(root) {
  let library = { folders: [], sets: [] }, page = 'dashboard', dirty = false, folder = '', search = '', sort = 'recent', disposed = false, loaded = false, mutationBusy = false;
  const beforeUnload = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
  window.addEventListener('beforeunload', beforeUnload);
  const folderName = id => library.folders.find(f => f.id === id)?.name || 'Unfiled';
  const date = value => value?.toDate ? value.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Just now';
  async function mayLeave() { return !dirty || await confirmAction('Leave without saving?', 'Your unsaved vocabulary changes will be lost.', 'Leave'); }
  async function navigate(next, set = null) { if (mutationBusy || !await mayLeave()) return; dirty = false; page = next; render(set); }
  async function refresh() { const data = await loadLibrary(); if (!disposed) { library = data; loaded = true; } }
  function shell() {
    root.innerHTML = studioShell(page);
    root.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => navigate(b.dataset.nav));
    root.querySelector('#brand-home').onclick = event => { event.preventDefault(); navigate('dashboard'); };
    root.querySelectorAll('[data-sign-out]').forEach(button => button.onclick = async () => { if (!await mayLeave()) return; try { await signOut(auth); } catch (error) { toast(errorMessage(error)); } });
    return root.querySelector('#teacher-content');
  }
  function cards(sets) {
    if (!sets.length) return `<div class="empty-state"><span aria-hidden="true">✦</span><h2>${search || folder ? 'A little space for something new' : 'No vocabulary sets yet'}</h2><p>${search ? 'Try a different word, title, topic, or folder.' : 'Turn your next lesson’s words into lasting learning.'}</p><button class="button primary" data-create>Create practice ↗</button></div>`;
    return `<div class="set-grid">${sets.map((set, i) => `<article class="set-card tone-${i % 4}"><div class="card-top"><span class="set-symbol" aria-hidden="true">${icon('book')}</span><span class="status ${set.published ? 'published' : ''}">${set.published ? 'Published' : 'Draft'}</span></div><span class="eyebrow card-folder">${e(folderName(set.folderId))}</span><h3>${e(set.title)}</h3><p class="card-unit">${e(set.unit || 'Your next little breakthrough')}</p><div class="card-meta"><span>${set.items.length} words</span><span>${date(set.updatedAt)}</span></div><div class="card-actions"><button class="text-button" data-action="edit" data-id="${e(set.id)}">Edit</button><button class="text-button" data-action="duplicate" data-id="${e(set.id)}">Duplicate</button><button class="text-button" data-action="share" data-id="${e(set.id)}">Share</button><button class="icon-button" data-action="menu" data-id="${e(set.id)}" aria-label="Actions for ${e(set.title)}">•••</button></div></article>`).join('')}</div>`;
  }
  function bindCards(content) {
    content.querySelectorAll('[data-create]').forEach(b => b.onclick = () => navigate('create'));
    content.querySelectorAll('[data-action]').forEach(b => b.onclick = () => action(b.dataset.action, library.sets.find(s => s.id === b.dataset.id)));
  }
  function dashboard(content) {
    content.classList.add('dashboard-view');
    const recent = [...library.sets].sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)).slice(0, 4);
    content.innerHTML = dashboardView(library, cards(recent));
    content.querySelector('#view-library').onclick = () => navigate('library');
    content.querySelector('#view-folders').onclick = () => navigate('folders');
    content.querySelector('#quick-folder').onclick = () => folderAction();
    content.querySelector('#quick-backup').onclick = exportBackup;
    bindCards(content); bindFolders(content);
  }
  function bindFolders(content) {
    content.querySelectorAll('[data-open-folder]').forEach(button => button.onclick = () => { folder = button.dataset.openFolder; search = ''; navigate('library'); });
    content.querySelectorAll('[data-rename-folder]').forEach(button => button.onclick = () => folderAction(button.dataset.renameFolder));
    content.querySelectorAll('[data-delete-folder]').forEach(button => button.onclick = async () => {
      if (await confirmAction('Delete this empty folder?', 'Only an empty folder can be removed.', 'Delete folder')) await perform(() => deleteFolder(button.dataset.deleteFolder));
    });
  }
  function foldersPage(content) {
    content.innerHTML = '<div class="page-heading"><div><span class="eyebrow">ROOM FOR EVERY TOPIC</span><h1>Folders</h1><p>Keep your practices together, lesson by lesson.</p></div><button id="add-folder" class="button primary">+ Create Folder</button></div>' + foldersView(library);
    content.querySelector('#add-folder').onclick = () => folderAction(); bindFolders(content);
  }
  function backupPage(content) { content.innerHTML = backupView(library); bindBackup(content); }
  function libraryPage(content) {
    content.innerHTML = `<div class="page-heading"><div><span class="eyebrow">A HOME FOR EVERY WORD</span><h1>My library</h1><p>Your favourite lessons, ready for their next chapter.</p></div><button class="button primary" data-create>+ Create practice</button></div><div class="library-toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input type="search" id="search" aria-label="Search vocabulary sets" placeholder="Search titles, topics, or words…" value="${e(search)}"></label><select id="sort" aria-label="Sort sets"><option value="recent">Recently updated</option><option value="title">Title A–Z</option><option value="oldest">Oldest first</option></select><button class="button secondary" id="backup">Export</button><button class="button secondary" id="import">Import</button><input type="file" id="import-file" accept="application/json,.json" hidden></div><div class="folder-bar"><button class="folder-chip ${folder === '' ? 'selected' : ''}" data-folder="">All sets <b>${library.sets.length}</b></button><button class="folder-chip ${folder === 'unfiled' ? 'selected' : ''}" data-folder="unfiled">Unfiled</button>${library.folders.map(f => `<button class="folder-chip ${folder === f.id ? 'selected' : ''}" data-folder="${e(f.id)}">▱ ${e(f.name)}</button>`).join('')}<button class="text-button" id="add-folder">+ New folder</button></div><div class="library-subhead"><p id="result-count" class="small muted"></p>${folder && folder !== 'unfiled' ? '<div class="actions"><button class="text-button" id="rename-folder">Rename folder</button><button class="text-button danger" id="delete-folder">Delete empty folder</button></div>' : ''}</div><div id="set-results"></div>`;
    const results = content.querySelector('#set-results');
    function filter() {
      const term = search.toLocaleLowerCase();
      const sets = library.sets.filter(s => (!folder || (folder === 'unfiled' ? !s.folderId : s.folderId === folder)) && [s.title, s.unit, folderName(s.folderId), ...s.items.map(i => i.term)].some(v => v.toLocaleLowerCase().includes(term)));
      sets.sort(sort === 'title' ? (a, b) => a.title.localeCompare(b.title) : (a, b) => ((b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)) * (sort === 'oldest' ? -1 : 1));
      content.querySelector('#result-count').textContent = `${sets.length} ${sets.length === 1 ? 'practice' : 'practices'}`;
      results.innerHTML = cards(sets); bindCards(results);
    }
    content.querySelector('#sort').value = sort;
    content.querySelector('#sort').onchange = event => { sort = event.target.value; filter(); };
    content.querySelector('#search').oninput = event => { search = event.target.value; filter(); };
    content.querySelectorAll('[data-folder]').forEach(b => b.onclick = () => { folder = b.dataset.folder; libraryPage(content); });
    content.querySelector('#add-folder').onclick = () => folderAction();
    content.querySelector('#rename-folder')?.addEventListener('click', () => folderAction(folder));
    content.querySelector('#delete-folder')?.addEventListener('click', async () => {
      if (!await confirmAction('Delete this empty folder?', 'Only an empty folder can be removed.', 'Delete folder')) return;
      await perform(async () => { await deleteFolder(folder); folder = ''; });
    });
    bindBackup(content);
    bindCards(content); filter();
  }
  function exportBackup() {
      const blob = new Blob([JSON.stringify(makeBackup(library.folders, library.sets), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `vocabulary-with-ralina-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Library backup downloaded');
  }
  function bindBackup(content) {
    content.querySelector('#backup').onclick = exportBackup;
    content.querySelector('#import').onclick = () => content.querySelector('#import-file').click();
    content.querySelector('#import-file').onchange = async event => {
      const file = event.target.files[0]; if (!file) return;
      try {
        if (file.size > 8000000) throw new Error('Choose a backup smaller than 8 MB.');
        const data = validateBackup(JSON.parse(await file.text()));
        if (await confirmAction('Import as new copies?', `${data.vocabularySets.length} sets and ${data.folders.length} folders will be added as new private records. Existing data stays unchanged.`, 'Import backup')) await perform(() => importLibrary(data));
      } catch (error) { toast(error instanceof SyntaxError ? 'This file is not valid JSON.' : error.message); }
      event.target.value = '';
    };
  }
  async function perform(work) {
    if (mutationBusy) return;
    mutationBusy = true;
    // Keep actions from opening against an outdated library while a save refreshes it.
    const controls = [...root.querySelectorAll('button, input, select')].map(el => [el, el.disabled]);
    controls.forEach(([el]) => { el.disabled = true; });
    root.querySelector('#teacher-content')?.setAttribute('aria-busy', 'true');
    try { await work(); await refresh(); if (!disposed) render(); toast('Saved to your library'); }
    catch (error) { toast(errorMessage(error)); }
    finally {
      mutationBusy = false;
      controls.forEach(([el, disabled]) => { el.disabled = disabled; });
      root.querySelector('#teacher-content')?.removeAttribute('aria-busy');
    }
  }
  async function folderAction(id = null) {
    const result = await dialog(id ? 'Rename folder' : 'A home for your words', `<label for="name">Folder name</label><input id="name" name="name" required maxlength="100" value="${e(id ? folderName(id) : '')}" autofocus>`, id ? 'Save name' : 'Create folder');
    if (result) await perform(() => saveFolder(result.get('name'), id));
  }
  function preview(set) { renderPractice(root, set, () => { page = 'library'; render(); }); }
  async function action(name, set) {
    if (!set) return;
    if (name === 'preview') return preview(set);
    if (name === 'edit') return navigate('create', set);
    if (name === 'menu') {
      const el = document.createElement('dialog'); el.innerHTML = `<h2>${e(set.title)}</h2><div class="menu-actions">${[['preview', 'Preview'], ['edit', 'Edit practice'], ['duplicate', 'Duplicate'], ['move', 'Move to folder'], ...(set.published ? [['unpublish', 'Unpublish link']] : []), ['delete', 'Delete practice']].map(([key, label]) => `<button class="button secondary ${key === 'delete' ? 'danger' : ''}" data-menu="${key}">${label}</button>`).join('')}</div><form method="dialog"><button class="button ink">Close</button></form>`; document.body.append(el); el.showModal(); el.onclose = () => el.remove(); el.querySelectorAll('[data-menu]').forEach(b => b.onclick = () => { el.close(); action(b.dataset.menu, set); }); return;
    }
    if (name === 'duplicate') return perform(() => saveSet({ ...set, title: `${set.title.slice(0, 140)} (copy)`, published: false }));
    if (name === 'delete') { if (await confirmAction('Delete this practice?', 'The set and its student link will be removed permanently. Export a backup first if you need one.', 'Delete practice')) await perform(() => deleteSet(set)); return; }
    if (name === 'unpublish') { if (await confirmAction('Unpublish this practice?', 'The student link will stop working. Publishing again restores the same link.', 'Unpublish')) await perform(() => saveSet({ ...set, published: false }, set)); return; }
    if (name === 'move') {
      const result = await dialog('Move practice', `<label for="move-folder">Folder</label><select name="folder" id="move-folder"><option value="">Unfiled</option>${library.folders.map(f => `<option value="${e(f.id)}" ${set.folderId === f.id ? 'selected' : ''}>${e(f.name)}</option>`).join('')}</select>`, 'Move');
      if (result) await perform(() => saveSet({ ...set, folderId: result.get('folder') || null }, set)); return;
    }
    if (name === 'share') {
      try {
        if (!set.published) {
          if (!await confirmAction('Publish for your students?', 'Anyone with this link can practise these words. Your private library stays private.', 'Publish & get link')) return;
          await saveSet({ ...set, published: true }, set); await refresh(); set = library.sets.find(s => s.id === set.id); render();
        }
        const url = new URL(location.pathname, location.origin); url.searchParams.set('practice', set.shareId);
        const el = document.createElement('dialog'); el.innerHTML = `<h2>A little learning, shared.</h2><p>No accounts. Just your words and their next step.</p><label for="share-link">Student practice link</label><input id="share-link" readonly value="${e(url.href)}"><p id="copy-status" role="status"></p><div class="actions"><button class="button primary" id="copy-link">Copy link</button><a class="button secondary" href="${e(url.href)}" target="_blank" rel="noopener">Open practice ↗</a><form method="dialog"><button class="button secondary">Done</button></form></div>`; document.body.append(el); el.showModal(); el.onclose = () => el.remove(); el.querySelector('#copy-link').onclick = async () => { try { await navigator.clipboard.writeText(url.href); el.querySelector('#copy-status').textContent = 'Link copied'; } catch { el.querySelector('#share-link').select(); el.querySelector('#copy-status').textContent = 'Select and copy this link with Ctrl+C (or touch and hold).'; } };
      } catch (error) { toast(errorMessage(error)); }
    }
  }
  function render(existing = null) {
    if (disposed) return;
    const content = shell();
    if (!loaded) { content.innerHTML = '<div class="empty-state" role="status"><span class="loading-star">✦</span><p>Opening your library…</p></div>'; return; }
    if (page === 'create') renderEditor(content, { existing, folders: library.folders, setDirty: value => dirty = value, onCancel: () => navigate('library'), onSave: async (id, showPreview) => { page = 'library'; try { await refresh(); if (disposed) return; toast('Practice saved'); if (showPreview) preview(library.sets.find(s => s.id === id)); else render(); } catch { loaded = false; init(); toast('Practice saved. Reconnecting to your library…'); } } });
    else if (page === 'library') libraryPage(content);
    else if (page === 'folders') foldersPage(content);
    else if (page === 'backup') backupPage(content);
    else dashboard(content);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  async function init() {
    render();
    try { await refresh(); render(); }
    catch { if (!disposed) { const content = root.querySelector('#teacher-content'); content.innerHTML = '<div class="empty-state"><h1>Your library is taking a moment.</h1><p>Check your connection and Firebase access settings.</p><button class="button primary" id="retry">Try again</button></div>'; content.querySelector('#retry').onclick = init; } }
  }
  init();
  return () => { disposed = true; library = { folders: [], sets: [] }; window.removeEventListener('beforeunload', beforeUnload); };
}

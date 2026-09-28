import { parseVocabulary, validateItems, cleanItems } from '../utils/vocabulary.js';
import { escape as e, confirmAction, toast, errorMessage, dialog } from '../ui/dom.js';
import { saveSet, saveFolder } from '../firestore.js';
export function renderEditor(root, { existing, folders, onSave, onCancel, setDirty }) {
  let items = existing ? structuredClone(existing.items) : [], busy = false;
  root.innerHTML = `<div class="page-heading"><div><span class="eyebrow">MAKE WORDS MEMORABLE</span><h1>${existing ? 'Edit practice' : 'Create Practice'}</h1><p>Add your words. We’ll take care of the practice.</p></div><span class="heading-star" aria-hidden="true">✦</span></div><form id="editor" class="editor-layout"><div class="editor-main"><section class="panel"><div class="section-heading"><span class="step-dot">1</span><h2>The essentials</h2></div><label for="title">Practice title</label><input id="title" name="title" required maxlength="150" placeholder="Give these words a home" value="${e(existing?.title || '')}"><div class="field-grid"><div><label for="folder">Folder</label><select name="folder" id="folder"><option value="">Unfiled</option>${folders.map(f => `<option value="${e(f.id)}" ${existing?.folderId === f.id ? 'selected' : ''}>${e(f.name)}</option>`).join('')}</select><button type="button" class="text-button" id="new-folder">+ Create folder</button></div><div><label for="unit">Unit / topic <span class="optional">optional</span></label><input name="unit" id="unit" maxlength="150" value="${e(existing?.unit || '')}" placeholder="e.g. Unit 4 · People"></div></div></section><section class="panel"><div class="section-heading"><span class="step-dot violet">2</span><h2>Your vocabulary</h2></div><div class="input-tabs"><button type="button" id="bulk-tab" class="tab active" aria-pressed="true">Paste a list</button><button type="button" id="rows-tab" class="tab" aria-pressed="false">Add word by word</button></div><div id="bulk-panel"><label for="bulk">One word and meaning per line</label><textarea id="bulk" rows="7" placeholder="English word | meaning&#10;English phrase | translation" spellcheck="false"></textarea><div class="bulk-bottom"><p>Accepts <b>|</b>, <b>=</b>, or a spaced <b>–</b> / <b>-</b><br>6–20 words is a lovely starting point.</p><button type="button" id="parse" class="button secondary">Add to preview ↓</button></div><div id="parse-errors" role="alert"></div></div><div class="section-heading preview-heading"><h3>Review your words</h3><span id="word-count" class="tag">${items.length} words</span></div><p class="small muted">Everything below is editable. Examples are optional.</p><div id="word-rows"></div><button type="button" id="add-row" class="button dashed">+ Add a word</button><div id="validation" role="alert"></div></section><div class="editor-actions"><button type="button" class="button secondary" id="cancel">Cancel</button><div class="actions"><button type="submit" name="intent" value="save" class="button secondary">Save practice</button><button type="submit" name="intent" value="preview" class="button primary">Save & Preview ↗</button></div></div></div><aside class="editor-aside"><div class="tip-card"><span class="eyebrow">FROM WORDS TO CONFIDENCE</span><h2>One set.<br>Four ways to learn.</h2><ol class="learning-list"><li><b>Recognise</b><span>Connect words with meanings</span></li><li><b>Connect</b><span>Find the English word</span></li><li><b>Build</b><span>Recall with a little support</span></li><li><b>Recall</b><span>Make the words your own</span></li></ol><p>Plus a little extra practice for the words that need it.</p><span class="tip-star" aria-hidden="true">✦</span></div><p class="aside-note">Your teaching. Their progress.<br>No student accounts needed.</p></aside></form>`;
  const form = root.querySelector('#editor');
  const dirty = () => setDirty(true);
  form.addEventListener('input', dirty);
  form.addEventListener('change', dirty);
  function collect() {
    items = [...root.querySelectorAll('.word-row')].map(row => ({ term: row.querySelector('[data-field="term"]').value, meaning: row.querySelector('[data-field="meaning"]').value, example: row.querySelector('[data-field="example"]').value }));
  }
  function renderRows() {
    root.querySelector('#word-count').textContent = `${items.length} words`;
    root.querySelector('#word-rows').innerHTML = items.length ? items.map((item, i) => `<div class="word-row"><div class="row-number">${i + 1}</div><div class="row-fields"><div class="field-grid"><div><label for="term-${i}">English word / phrase</label><input id="term-${i}" data-field="term" value="${e(item.term)}" maxlength="200" required></div><div><label for="meaning-${i}">Meaning / translation</label><input id="meaning-${i}" data-field="meaning" value="${e(item.meaning)}" maxlength="500" required></div></div><label class="sr-only" for="example-${i}">Example for word ${i + 1}</label><input id="example-${i}" class="example-input" data-field="example" value="${e(item.example)}" maxlength="1000" placeholder="Optional example or context"></div><div class="row-controls"><button type="button" class="icon-button" data-up="${i}" aria-label="Move word ${i + 1} up" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="icon-button" data-delete="${i}" aria-label="Delete word ${i + 1}">×</button></div></div>`).join('') : '<div class="rows-empty">Your word list starts here.<br><span>Paste a list above or add your first word below.</span></div>';
    root.querySelectorAll('[data-delete]').forEach(button => button.onclick = async () => { collect(); const i = Number(button.dataset.delete); if ((items[i].term || items[i].meaning || items[i].example) && !await confirmAction('Remove this word?', 'This row will be removed from the preview.', 'Remove')) return; items.splice(i, 1); dirty(); renderRows(); });
    root.querySelectorAll('[data-up]').forEach(button => button.onclick = () => { collect(); const i = Number(button.dataset.up); [items[i - 1], items[i]] = [items[i], items[i - 1]]; dirty(); renderRows(); });
  }
  root.querySelector('#parse').onclick = () => {
    const result = parseVocabulary(root.querySelector('#bulk').value);
    root.querySelector('#parse-errors').innerHTML = result.errors.map(x => `<p class="error-text">${e(x)}</p>`).join('');
    if (result.errors.length) return;
    if (!result.items.length) { toast('Paste your vocabulary first.'); return; }
    collect(); items.push(...result.items); root.querySelector('#bulk').value = ''; dirty(); renderRows();
  };
  root.querySelector('#add-row').onclick = () => { collect(); items.push({ term: '', meaning: '', example: '' }); dirty(); renderRows(); root.querySelector(`#term-${items.length - 1}`).focus(); };
  function tab(rows) {
    root.querySelector('#bulk-panel').hidden = rows;
    for (const [id, active] of [['rows-tab', rows], ['bulk-tab', !rows]]) { root.querySelector(`#${id}`).classList.toggle('active', active); root.querySelector(`#${id}`).setAttribute('aria-pressed', active); }
  }
  root.querySelector('#rows-tab').onclick = () => tab(true);
  root.querySelector('#bulk-tab').onclick = () => tab(false);
  root.querySelector('#new-folder').onclick = async () => {
    const result = await dialog('A home for your words', '<label for="folder-name">Folder name</label><input id="folder-name" name="name" required maxlength="100" autofocus>', 'Create folder');
    if (!result) return;
    try { const name = result.get('name').trim(), id = await saveFolder(name); const option = new Option(name, id, true, true); root.querySelector('#folder').add(option); dirty(); toast('Folder created'); } catch (error) { toast(errorMessage(error)); }
  };
  root.querySelector('#cancel').onclick = onCancel;
  form.onsubmit = async event => {
    event.preventDefault(); if (busy) return;
    collect();
    const validation = validateItems(items);
    if (root.querySelector('#bulk').value.trim()) validation.errors.push('You have an unparsed list. Add it to the preview before saving.');
    root.querySelector('#validation').innerHTML = [...validation.errors.map(x => `<p class="error-text">${e(x)}</p>`), ...validation.warnings.map(x => `<p class="warning-text">${e(x)}</p>`)].join('');
    if (validation.errors.length) return;
    const input = { title: form.elements.title.value, unit: form.elements.unit.value, folderId: form.elements.folder.value || null, items: cleanItems(items) };
    const preview = event.submitter?.value === 'preview';
    busy = true; const controls = [...form.querySelectorAll('button, input, textarea, select')]; const states = controls.map(x => x.disabled); controls.forEach(x => x.disabled = true);
    try { const id = await saveSet(input, existing); setDirty(false); await onSave(id, preview); }
    catch (error) { root.querySelector('#validation').innerHTML += `<p class="error-text">${e(errorMessage(error))}</p>`; }
    finally { busy = false; controls.forEach((x, i) => x.disabled = states[i]); }
  };
  renderRows();
}

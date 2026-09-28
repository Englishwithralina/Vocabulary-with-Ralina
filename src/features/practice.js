import { answer, createSession, optionsFor, rounds, sessionResult, resultAfterReview } from '../games/engine.js';
import { validateItems } from '../utils/vocabulary.js';
import { escape as e, brand } from '../ui/dom.js';
import { flag, icon } from '../ui/icons.js';
import { landingView, roundProgress, spellingHint, resultsView } from '../ui/practice-views.js';
import { getWorld, worldStyle } from '../worlds.js';

export function validPractice(practice) {
  return !!practice && typeof practice.title === 'string' && !!practice.title.trim()
    && (practice.unit == null || typeof practice.unit === 'string')
    && !validateItems(practice.items).errors.length
    && practice.items.every(item => item.example == null || typeof item.example === 'string');
}

export function renderPractice(root, practice, onExit = null) {
  if (!validPractice(practice)) {
    root.innerHTML = '<main class="empty-state"><h1>This practice isn’t available.</h1><p>Ask your teacher for a current practice link.</p></main>';
    return;
  }
  let session, result, selectedWorld = null, world = getWorld('uk'), remainingReview;
  const shell = (content, home = false) => {
    root.innerHTML = `<div class="student-shell world-${world.id} ${home ? 'student-home' : ''}" style="${worldStyle(world)}">${home ? '' : `<header class="student-header"><div class="brand">${brand}</div><span class="world-badge">${flag(world.flag)}${world.name}</span></header>`}${onExit ? '<div class="preview-banner"><span>Teacher preview</span><button class="text-button" id="exit-preview">Back to library</button></div>' : ''}<main class="practice-main">${content}</main><footer>Learn English. Explore the World. <span aria-hidden="true">✦</span></footer></div>`;
    root.querySelector('#exit-preview')?.addEventListener('click', onExit);
  };
  function start(indices = null) {
    session = createSession(practice.items, indices);
    remainingReview = new Set(indices || []);
    if (!indices) result = null;
    question();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function landing() {
    shell(landingView(practice), true);
    root.querySelector('#start').onclick = () => { root.querySelector('#world-heading').focus({ preventScroll: true }); root.querySelector('#worlds').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }); };
    root.querySelectorAll('[name="world"]').forEach(input => input.onchange = () => {
      selectedWorld = input.value;
      root.querySelector('#begin').disabled = false;
      root.querySelector('#world-status').textContent = `${getWorld(selectedWorld).place} is ready for you.`;
    });
    root.querySelector('#begin').onclick = () => { if (!selectedWorld) return; world = getWorld(selectedWorld); start(); };
  }
  function question() {
    const { index, round } = session.queue[session.position], item = practice.items[index];
    const info = rounds[round] || { name: 'Review', instruction: 'Type the English word or phrase.', color: 'violet' };
    const count = session.review ? session.queue.length : practice.items.length;
    const number = session.review ? session.position + 1 : session.position % count + 1;
    const promptTag = session.review ? 'h2' : 'h1';
    const options = round < 2 ? optionsFor(practice.items, index, round === 1).options : [];
    shell(`${roundProgress(round, session.review)}<section class="question-card paper-card ${info.color}-accent ${session.review ? 'review-card' : ''}"><div class="question-meta"><span class="tag ${info.color}">${info.name}</span><span>Word ${number} of ${count}</span></div><div class="progress" role="progressbar" aria-label="Words completed in this ${session.review ? 'review' : 'round'}" aria-valuenow="${number - 1}" aria-valuemin="0" aria-valuemax="${count}"><div style="width:${(number - 1) / count * 100}%"></div></div>${session.review ? `<h1 class="review-heading">Time to review!</h1><p class="review-intro">A fresh chance to make these words stick.<br><span id="remaining-review">${remainingReview.size} ${remainingReview.size === 1 ? 'word' : 'words'} to practise</span></p>` : ''}<${promptTag} class="prompt" id="question-prompt" tabindex="-1">${e(round === 0 ? item.term : item.meaning)}</${promptTag}><p class="instruction" id="task-instruction">${info.instruction}</p>${round === 2 ? spellingHint(item.term) : ''}<form id="answer-form">${round < 2 ? `<fieldset class="answer-options"><legend class="sr-only">${info.instruction}</legend>${options.map((option, i) => `<label class="answer-option" data-option="${i}"><input type="radio" name="answer" value="${i}"><span>${e(option)}</span></label>`).join('')}</fieldset>` : '<label class="sr-only" for="typed-answer">Your answer in English</label><input id="typed-answer" class="recall-input" aria-describedby="question-prompt task-instruction" placeholder="Your answer…" autocomplete="off" autocapitalize="none" spellcheck="false" required maxlength="200">'}<button id="check-answer" class="button primary full" type="submit" disabled>Check <span aria-hidden="true">→</span></button></form><div id="feedback" aria-live="polite"></div><button id="next-question" class="button primary full" hidden>Next word <span aria-hidden="true">→</span></button></section><p class="practice-note">${icon('globe')} One word at a time. A world of possibilities.</p>`);
    const form = root.querySelector('#answer-form'), check = root.querySelector('#check-answer'), input = root.querySelector('#typed-answer');
    const value = () => round < 2 ? options[form.querySelector(':checked')?.value] : input.value;
    form.addEventListener('input', () => { check.disabled = !value()?.trim(); });
    form.addEventListener('change', () => { check.disabled = !value()?.trim(); });
    form.onsubmit = event => {
      event.preventDefault(); if (!value()?.trim()) return;
      const checked = answer(session, value()); if (!checked) return;
      form.querySelectorAll('input, button').forEach(el => { el.disabled = true; }); check.hidden = true;
      const progress = root.querySelector('.progress');
      progress.setAttribute('aria-valuenow', number);
      progress.firstElementChild.style.width = `${number / count * 100}%`;
      if (session.review && checked.correct) remainingReview.delete(index);
      if (session.review) root.querySelector('#remaining-review').textContent = `${remainingReview.size} ${remainingReview.size === 1 ? 'word' : 'words'} still to practise`;
      const feedback = root.querySelector('#feedback'); feedback.className = `feedback ${checked.correct ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = `<strong>${checked.correct ? '✦ Correct!' : 'Not quite — a little more practice.'}</strong>${!checked.correct ? `<p>Correct answer: <b>${e(checked.expected)}</b></p>` : ''}${item.example ? `<p class="example">${e(item.example)}</p>` : ''}`;
      const next = root.querySelector('#next-question'); next.hidden = false; next.focus({ preventScroll: true });
    };
    root.querySelector('#next-question').onclick = () => { session.position++; session.answered = false; if (session.position === session.queue.length) finish(); else question(); };
    (input || root.querySelector('.prompt')).focus({ preventScroll: true });
  }
  function finish() {
    result = session.review ? resultAfterReview(result, session) : sessionResult(session);
    shell(resultsView(practice, result));
    root.querySelector('#review')?.addEventListener('click', () => { if (result.remaining.length) start(result.remaining); });
    root.querySelector('#replay').onclick = () => start();
    root.querySelector('#finish').onclick = () => {
      shell(`<section class="results paper-card finished"><div class="result-emblem">${icon('globe')}</div><span class="eyebrow">THANK YOU FOR PRACTISING</span><h1 tabindex="-1">Your journey is complete.</h1><p class="lead">You can close this page. Your next adventure can wait.</p><p>${e(practice.title)}</p><button class="button secondary" id="another-journey">Practise again</button></section>`);
      root.querySelector('#another-journey').onclick = () => { selectedWorld = null; world = getWorld('uk'); landing(); };
      root.querySelector('h1').focus({ preventScroll: true });
    };
    root.querySelector('h1').focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  landing();
}


import './styles.css';
import { onAuthStateChanged, signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { auth, db } from './firebase.js';
import { brand, errorMessage } from './ui/dom.js';
import { loadPublic } from './firestore.js';
import { renderPractice, validPractice } from './features/practice.js';

const root = document.querySelector('#app');
const publicId = new URLSearchParams(location.search).get('practice');
function unavailable(retry = false) {
  root.innerHTML = `<div class="student-shell"><header class="student-header"><div class="brand">${brand}</div></header><main class="empty-state"><span aria-hidden="true">✦</span><h1>${retry ? 'A little pause.' : 'This practice isn’t available.'}</h1><p>${retry ? 'We couldn’t load your words. Check your connection and try again.' : 'Ask your teacher for a current practice link.'}</p>${retry ? '<button id="retry" class="button primary">Try again</button>' : ''}</main></div>`;
  root.querySelector('#retry')?.addEventListener('click', loadStudent);
}
async function loadStudent() {
  if (!db) { unavailable(true); return; }
  root.innerHTML = '<main class="empty-state" role="status"><span class="loading-star">✦</span><p>Getting your words ready…</p></main>';
  try { const practice = await loadPublic(publicId); if (!validPractice(practice)) unavailable(); else renderPractice(root, practice); } catch { unavailable(true); }
}
function login() {
  const setup = !auth;
  root.innerHTML = `<main class="login-layout"><section class="login-story"><div class="brand">${brand}</div><div class="login-story-copy"><span class="eyebrow">A NEW ADVENTURE IN EVERY WORD</span><h1>Learn English.<br>Explore the World<span>.</span></h1><p>Your words. Their next adventure.<br>Four worlds of thoughtful vocabulary practice.</p><div class="login-art" aria-hidden="true"><span>✦</span><div>recognise.<br>remember.<br><i>make it yours.</i></div></div></div><p class="login-footnote">YOUR WORDS. THEIR NEXT BREAKTHROUGH.</p></section><section class="login-form-side"><span class="studio-tag">✦ TEACHER STUDIO</span><div class="login-form-wrap"><span class="eyebrow">A LITTLE SPACE FOR YOUR BIG IDEAS</span><h2>${setup ? 'Your studio is nearly ready.' : 'Welcome back.'}</h2><p>${setup ? 'Connect your Firebase project to open your teaching workspace.' : 'Your words, your lessons, your next little breakthrough.'}</p>${setup ? '<div class="setup-box"><h3>One small setup step</h3><p>Add your Firebase web configuration to <code>.env.local</code>, then restart the app.</p><p>The step-by-step guide is in <strong>FIREBASE_SETUP.md</strong> in your project folder.</p></div><button class="button primary full" id="reload">Check connection again ↗</button>' : '<form id="login"><label for="email">Email address</label><input id="email" type="email" autocomplete="username" placeholder="you@example.com" required><label for="password">Password</label><input id="password" type="password" autocomplete="current-password" placeholder="Your password" required><p id="login-error" class="error-text" role="alert"></p><button class="button primary full" type="submit">Sign in to your studio ↗</button></form>'}<p class="login-help">A private space for teachers.<br>Students can jump straight in with a practice link.</p></div><span class="login-bottom">Made with care. Made for progress.</span></section></main>`;
  root.querySelector('#reload')?.addEventListener('click', () => location.reload());
  root.querySelector('#login')?.addEventListener('submit', async event => {
    event.preventDefault(); const button = event.target.querySelector('button'); button.disabled = true; button.textContent = 'Opening your studio…';
    try { await setPersistence(auth, browserSessionPersistence); await signInWithEmailAndPassword(auth, root.querySelector('#email').value.trim(), root.querySelector('#password').value); }
    catch (error) { const message = root.querySelector('#login-error'); if (message) message.textContent = errorMessage(error); }
    finally { button.disabled = false; button.textContent = 'Sign in to your studio ↗'; }
  });
}
if (publicId !== null) loadStudent();
else if (!auth) login();
else {
  root.innerHTML = `<main class="empty-state" role="status"><span class="loading-star">✦</span><p>Opening your studio…</p></main>`;
  let dispose, authEpoch = 0;
  onAuthStateChanged(auth, async user => {
    const epoch = ++authEpoch;
    dispose?.(); dispose = null;
    document.querySelectorAll('dialog').forEach(d => d.remove());
    if (!user) { login(); return; }
    try {
      const { teacherApp } = await import('./features/teacher.js');
      if (epoch === authEpoch) dispose = teacherApp(root);
    } catch {
      root.innerHTML = '<main class="empty-state"><h1>Your studio is taking a moment.</h1><p>Check your connection, then refresh this page.</p><button class="button primary" id="reload">Try again</button></main>';
      root.querySelector('#reload').onclick = () => location.reload();
    }
  }, () => login());
}

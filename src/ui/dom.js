export const escape = value => String(value ?? '').replace(/[&<>"']/g, x => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[x]));
export const brand = '<span class="brand-type">ENGLISH <span class="brand-script">with Ralina</span></span><span class="brand-star" aria-hidden="true">✦</span>';
export function toast(message) { const el = document.querySelector('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 4500); }
export function errorMessage(error) {
  if (error?.code?.includes('permission-denied')) return 'Access was denied. Check the teacher account and published security rules.';
  if (error?.code?.startsWith('auth/')) return 'Could not sign in. Check your email and password, connection, and authorised domain.';
  if (error?.code === 'conflict') return 'This practice changed in another tab. Copy your edits before reopening the latest version.';
  return error?.safe ? error.message : 'Could not complete this action. Check your connection and try again.';
}
export function dialog(title, content, accept = 'Continue') {
  return new Promise(resolve => {
    const previous = document.activeElement;
    const el = document.createElement('dialog');
    el.innerHTML = `<form method="dialog"><h2>${escape(title)}</h2>${content}<div class="actions"><button value="cancel" formnovalidate class="button secondary">Cancel</button><button value="ok" class="button primary">${escape(accept)}</button></div></form>`;
    document.body.append(el); el.showModal();
    el.addEventListener('close', () => { const result = el.returnValue === 'ok' ? new FormData(el.querySelector('form')) : null; el.remove(); previous?.focus(); resolve(result); }, { once: true });
  });
}
export async function confirmAction(title, message, label = 'Confirm') { return !!await dialog(title, `<p>${escape(message)}</p>`, label); }

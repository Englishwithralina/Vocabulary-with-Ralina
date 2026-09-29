// CI supplies only Firebase WEB configuration. Never print values or accept admin credentials.
const names = ['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID', 'VITE_FIREBASE_APP_ID'];
const missing = names.filter(name => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing GitHub Actions repository secrets: ${missing.join(', ')}. See GITHUB_PAGES_SETUP.md.`);
  process.exit(1);
}
console.log('All four Firebase Web build settings are present. Values are not logged.');

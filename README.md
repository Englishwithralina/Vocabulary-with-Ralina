# English with Ralina

A focused vocabulary studio for an English teacher. Create and organise reusable word sets, share account-free student practice, and guide learners from recognition to independent recall. Built with vanilla JavaScript modules, Vite, Firebase Authentication and Cloud Firestore. No student tracking, generated vocabulary, or localStorage database.

## Start locally

Install Node.js 22.12 or newer. Open a terminal in this folder:

```sh
npm install
npm run dev
```

Open the local address printed in the terminal. Without Firebase configuration, the app shows a setup screen. It does not pretend to save data. Add your web configuration using [FIREBASE_SETUP.md](FIREBASE_SETUP.md), then restart Vite.

On Windows, you can also double-click `start.cmd`. It uses installed Node.js, or the portable copy in `.tools` when present, and opens the site in your browser. `.tools` is local tooling only and is excluded from Git and deployment.

```sh
npm test
npm run build
npm run preview
```

Security integration tests require Java 21 and the Firestore emulator:

```sh
npx firebase emulators:exec --project demo-vocabulary-ralina --only firestore "node --test tests/security.rules.js"
```

`npm run test:rules` is the equivalent shortcut. `npm run test:e2e` runs browser journeys against local Auth/Firestore emulators; it needs Java 21 and Google Chrome. The test browser injects emulator-only configuration, so your real Firebase project is never used. Screenshots are saved to `test-results` (excluded from Git).

## How it works

Sign in with the teacher account created in Firebase Console. Sessions survive a refresh in the same browser tab. Dashboard, Create Practice, My Library, Folders and Backup are private. Add at least four pairs; 6–20 is recommended, not a limit. Bulk parsing supports `word | meaning`, `word = meaning`, and spaced hyphens or dashes. Parsing appends to the editable preview. Invalid lines leave the pasted text intact. Exact duplicate pairs block saving; repeated terms produce a warning.

Saving creates a draft. Share publishes only the title, topic and vocabulary into `publicPractices`. The stable URL uses `?practice=PUBLIC_ID` and needs no server routing. Editing a published practice updates that copy atomically. Unpublish disables its link; publishing again restores the same URL. Duplicate always creates a separate private draft with a new ID and link.

Students choose one of four illustrated worlds, then practise all words through Recognise, Connect, Build and Recall. The world is visual only and stays fixed throughout a session. Selecting a choice does not submit it; Check validates the answer. Answers ignore edge whitespace and case, but retain spelling, punctuation and internal spacing. Equivalent answers already present in the set are accepted. Choices use only the current set; ambiguous alternatives are excluded from distractors. If a set has fewer distinct meanings, fewer choices are shown rather than invented distractors. Results use first submissions across all four rounds. Review statistics are separate: a finite pass removes successfully recalled words and leaves missed words for an optional further pass. Replay resets the session. Finish provides a completion screen. Results live only in memory; refreshing restarts student practice.

See [DESIGN_IMPLEMENTATION.md](DESIGN_IMPLEMENTATION.md) for the reference interpretation, world assets, artwork prompts, local fonts and presentation modules.

## Project structure

```text
src/
  main.js                 Entry, sign-in and student routing
  firebase.js             Web configuration and SDK initialization
  firestore.js            Database operations and transactions
  features/
    teacher.js            Dashboard, library, folders, sharing
    editor.js             Bulk entry, editable preview, saving
    practice.js           Student interface and feedback
  games/engine.js         Pure question/session/scoring logic
  utils/vocabulary.js     Parsing, validation, shuffle, normalization
  utils/backup.js         Export shape and import validation
  ui/dom.js               Accessible dialogs, feedback, escaping
  ui/practice-views.js    Shared student view components
  ui/studio-views.js      Teacher Studio view components
  ui/icons.js             Decorative SVG icons and flags
  worlds.js               Presentation-only destination configuration
  assets/worlds/          Local background scenes and thumbnails
  assets/fonts/           Self-hosted fonts and licenses
  styles.css              Imports the modular presentation styles
  styles/                 Base, student, studio and editor styles
tests/                    Pure-function and Firestore rule tests
firestore.rules           Deployed database permissions
```

## Data model and security

The model separates teacher data from the public student projection:

| Collection | Content | Access |
| --- | --- | --- |
| `users/{uid}` | Unused in this version | Denied to everyone |
| `folders/{id}` | Owner, name, set count, timestamps, schema version | Configured teacher UID only; `ownerId` must match |
| `vocabularySets/{id}` | Owner, title, folder, unit, items, publication/link, revision, timestamps | Configured teacher UID only; `ownerId` must match |
| `publicationGrants/{shareId}` | Owner and source set ID | Private permission mapping |
| `publicPractices/{shareId}` | Title, unit, items, schema version | Public single-document get; no listing or student writes |

Document IDs are the IDs; they are attached on read and exported explicitly. An item is `{ term, meaning, example }`. No example is invented. The publication grant lets rules verify ownership without putting the teacher ID or email into public documents. Rules require the published payload to match the private source. This deployment has exactly one teacher: `ownerUid()` in `firestore.rules` must equal that account's Firebase Authentication UID. No email is used for authorisation. Authentication alone does not grant access: other signed-in accounts cannot create even their own library, or read/write the teacher's private data. Unused collections, user profiles and nested documents are denied to everyone. The UID is an identifier, not a password; do not substitute an API key or project ID. If the teacher account is deleted and recreated, its new UID must be deliberately configured and existing ownership considered before deploying rules again. An unconfigured UID fails closed. The data model remains unchanged and can support a future intentional multi-teacher rules migration.

Public access permits only a single document get, never a collection query (even filtered by document ID). Existing public copies are readable only while their private grant and source both belong to the configured teacher and the source is still published. This also prevents stale or orphaned public copies being read after revocation. Rules inspect the private documents internally; their contents are not returned to the student. These checks can incur additional Firestore document reads. A missing link may return “not found” without exposing data. Students and other signed-in users cannot write public copies or publication grants.

Transactions use a revision number to prevent silent overwrites from another browser tab. Folder counts and set moves are updated together, so a concurrent move into a folder conflicts with deletion. Rules protect ownership; folder-count consistency assumes use of this app by the owner (an owner with a custom client can alter their own count). Firestore rules cannot loop over arbitrary items; the app validates each item, while rules validate the document envelope and restrict writes to the owner. Public data is intentionally readable by anyone who has the opaque link; it is not suitable for confidential material. Already loaded practice cannot be recalled from a student's memory when unpublished.

Firebase-specific persistence is isolated from pure game logic. Collections use `schemaVersion: 1`. There are no analytics, ads or student names. Fonts are self-hosted with their open-source licenses; system fonts are the fallback.

## Backup and restore

My library → Export downloads JSON containing all loaded teacher-owned sets and folders, with `exportVersion`, `exportedAt`, items and original dates. No credentials, owner IDs or public links are exported. Import validates the whole file before writing and creates new IDs and private drafts, never overwriting existing content. Imported records get new creation timestamps; dates in the backup preserve original history. Import is one atomic batch (maximum 400 records, 18 populated folders and 8 MB file to stay within Firestore transaction/rule limits); a failed import creates no partial library. Export before large edits. Export is the current library snapshot: reload the app first if other tabs have made changes.

## Deploy

Firebase Hosting is the simplest option:

```sh
npm run build
npx firebase login
npx firebase use --add
npx firebase deploy --only firestore:rules,hosting
```

Select your existing project; do not invent a project ID. The hosting configuration serves `dist`. For GitHub Pages, build with your configuration and publish the contents of `dist` using GitHub Actions. Vite uses relative asset paths, and the practice query parameter works under repository subpaths. Add the hosting domain to Firebase Authentication's authorised domains. Web Firebase config is public by design; never add Admin SDK keys. Refer to the [official modular SDK setup](https://firebase.google.com/docs/web/setup) and [security rule conditions](https://firebase.google.com/docs/firestore/security/rules-conditions).

## Before production deployment

- [ ] Insert actual Firebase web configuration and create the initial teacher account.
- [ ] Verify `ownerUid()` in `firestore.rules` exactly matches that teacher's Authentication UID.
- [ ] Deploy the supplied rules to the correct project; keep Firestore in production mode.
- [ ] Run unit tests, emulator security tests and a production build.
- [ ] Test sign-in, CRUD, duplicate independence, folders and backup round trip against your project.
- [ ] Open a published link in an incognito window; confirm no teacher data appears and writes/listing are denied.
- [ ] Confirm editing updates the shared practice and unpublishing disables it.
- [ ] Check keyboard navigation and mobile practice on a real phone.
- [ ] Add the deployment domain to Authentication and configure Firebase usage/budget alerts.
- [ ] Keep a backup and commit source plus package-lock.json to your Git repository.

Never change rules to `allow read, write: if true`. Live Firebase behaviour cannot be verified until real configuration is supplied; automated emulator checks validate rules independently.

# Implementation verification

Initial implementation verified locally on Windows, 25 September 2026, with Node.js 22.16 and Google Chrome. Those implementation tests did not use production Firebase configuration.

## Single-owner security update — 26 September 2026

`firestore.rules` now authorises only the teacher UID supplied by the owner, plus the existing matching `ownerId` checks. No email-based authorisation or client-editable roles are used. All unused collections (including `users`) and nested documents are denied. Public single-document reads require the configured owner's live publication; missing links can return not found without returning data. Public listing and non-owner writes remain denied.

Ten security suites passed in the isolated Firestore emulator with the exact local rules file:

- Owner queries against empty/populated libraries and private CRUD.
- Ownership/revision validation and nonempty-folder protection.
- Denied private reads, queries, creates (including an outsider's own workspace), updates and deletes for anonymous and authenticated non-owner users.
- Public safe projection only, denied collection listing even when filtered by document ID, and hidden publication grants.
- Denied public writes and grant forgery by students and outsiders.
- Atomic owner publication/edit/deletion, strict projection fields and link revocation.
- Rejected publication of drafts; a stale public copy becomes inaccessible once its source is unpublished.
- Denied orphaned/legacy outsider publications, unused collections and self-assigned profile roles.
- Allowed atomic owner folder/set import.

All three browser suites also passed with the tightened rules: setup states, the complete teacher/student journey, and folder organisation/mobile editing. The account fixture used in browser tests is created only in the local Auth emulator with that same UID. No real account is created, modified or deleted. No rules or other changes have been deployed to Firebase. Live Dashboard access still depends on separately publishing the reviewed rules to the correct project.

## Passed

- Dependency installation and Vite production build.
- Eight unit tests: input formats, Cyrillic/hyphenated words, malformed lines, empty fields, duplicate validation, normalization, shuffle, unique distractors, equivalent answers, four-round coverage, double-submit protection, actual mistakes, replay, hint construction and backup validation.
- Two Firestore emulator security suites: owner access, other-owner rejection, anonymous private-read/write/delete rejection, public single-document access without listing, safe public payload, atomic publication, revocation, and nonempty folder protection.
- Browser journey: teacher sign-in, folder creation, bulk entry, example editing, cloud save, publication/copy link, refresh persistence, independent duplicate editing, export/import, anonymous student access, all 16 questions for a four-word set, first-attempt score, mistake review, clean replay, unpublish and confirmed deletion.
- Browser organisation journey: manual rows, reorder/delete, cancelling a blank dialog, unsaved-change cancellation, Save & Preview, folder moves/rename/delete, nonempty-folder rejection, search, sort, stale-revision protection, sign-out and private UI removal.
- Mobile overflow checks at 320/390/768 pixels; student practice completed at 390 pixels and teacher editor exercised at 320 pixels. Screenshots reviewed for dashboard, editor, setup and student feedback. Browser journeys recorded no uncaught JavaScript errors.
- The built production bundle was also opened in Chrome: setup and unavailable-practice screens render without JavaScript errors, including mobile viewport checks.

## Boundaries

Firebase web configuration and SDK initialisation were subsequently checked locally; the owner reported successful sign-in. Deployed rules, production URLs and real-device Safari have not been verified. Security and CRUD tests use isolated local Auth/Firestore emulators with a `demo-` project ID. Test fixtures appear only in tests, never in the application library. Follow the pre-production checklist in README before publishing.

## Repeat

```sh
npm test
npm run build
npm run test:rules
npm run test:e2e
```

The last two commands need Java 21; browser tests also need Google Chrome. Test results/screenshots, local tools, build output and emulator logs are excluded from Git. Source and the dependency lockfile are ready to commit to a repository; no remote repository has been created or published.

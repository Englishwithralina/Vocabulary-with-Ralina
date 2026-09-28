# English with Ralina — design implementation

The existing Vite/vanilla JavaScript/Firebase application is retained. `/` opens the private Teacher Studio sign-in/dashboard. An existing `?practice=…` link opens the illustrated student Home. Preview in the teacher library opens the same student interface with a return button. No sample practices, student accounts, analytics, or public library have been added.

## Presentation

- Four interchangeable world themes in `src/worlds.js`; one shared practice controller and one set of view components. The chosen world stays fixed through all rounds, results, replay and review. Finish → Practise again returns to world selection.
- Illustrated Home, actual radio controls for world choice, four learning stages and a separate Review explanation.
- Illustrated rounds with an opaque cream learning card, two levels of progress, native answer radios, a real disabled Check button, feedback, and Next word.
- Build uses a single accessible input plus a spelling hint. Spaces, hyphens and apostrophes remain visible. Recall and Review have no hint.
- Results preserve the initial four-round correct/total/accuracy. Review has separate statistics. A review pass visits each remaining word once; correctly recalled words leave the list, missed words remain available for another explicitly started pass.
- Teacher Studio has Dashboard, Create Practice, My Library, Folders and Backup. Recent practices expose Edit, Duplicate and Share; Preview, Move, Unpublish and Delete remain available in the menu. Counts come from the real library.
- Responsive layouts, native keyboard interaction, visible focus, real disabled states and reduced-motion support. All text and controls are HTML, not embedded in artwork.

## Files

- `src/styles.css` imports `styles/base.css`, `studio.css`, `editor.css` and `student.css`.
- `src/ui/practice-views.js`, `studio-views.js`, `icons.js` contain reusable presentation helpers.
- `src/assets/worlds/{uk,usa,canada,australia}.webp`: 1536 × 1024 scene assets, approximately 312–422 KiB each.
- `src/assets/worlds/{uk,usa,canada,australia}-card.webp`: 480 × 320 thumbnails, approximately 55–67 KiB each.
- `src/assets/fonts/` contains self-hosted Caveat, DM Sans and Lora, with their SIL Open Font Licenses. No runtime Google Fonts request is required.

Replace world assets/configuration to add a destination without changing game logic or database documents. World choice and student results are memory-only. Reload starts a new session from the shared link, as before.

## Reference interpretation

All eight files in `design-references` were inspected. They guide composition, palette, typography and framing; none is embedded as a page background. `04_Round3_Final.png.png` is a modal-verbs worksheet rather than a practice-screen reference. Round 3 therefore follows the written supported-recall specification and the visual system of the other approved rounds. No grammar module was introduced. Review is a separate follow-up, not a fifth numbered round, as required by the written specification.

## Artwork provenance and prompt set

Mode: **built-in image generation**, four separate generated illustrations, using `02_Round1_Final.png.png` only as an art-direction/edge-framing reference. Original generated PNG files remain in the generation output directory; project assets are local WebP encodings and proportional thumbnails. No screenshot controls or text were carried into the artwork.

Shared prompt specification:

> Use case: illustration-story. A text-free 1536 × 1024 panoramic website background. The input is a style and edge-framing reference, not an edit target. Create new richly detailed painterly storybook scenery: sunny blue sky, peach/ivory clouds, warm golden light, flowers at the edges, believable landmarks, magical but suitable for ages 8–14. Rich detail belongs in the outer thirds and bottom; the centre stays naturally airy because real HTML covers it. No text, numbers, logos, UI, cards, panels or people. No neon or babyish style.

World-specific prompt specifications:

1. **UK:** Thames and Westminster Palace/Elizabeth Tower to the right, Gothic silhouettes, Westminster Bridge and a red bus; red telephone box, black lanterns and pink flowers to the left; riverside path below. No London Eye.
2. **USA:** New York harbour atmosphere, Statue of Liberty to the left with the torch in her right hand; Manhattan skyline, including One World Trade Center, to the far right; turquoise harbour, flowers and coral stone foreground corners. No London landmarks.
3. **Canada:** Canadian Rockies with snow-capped peaks toward the outer thirds, emerald forests, a turquoise mountain lake, red canoe at lower right, flowers and berry foliage. Calm central sky; no foreign landmarks.
4. **Australia:** Sydney Opera House in the lower right, Harbour Bridge in the left background, plausible landmark proportions across the water, sunny aqua harbour and small ferries, flowers at the corners and a sandstone path. No landmarks from other worlds.

These are stylised motivational illustrations, not maps or geographical teaching material. Vocabulary remains exclusively teacher-entered.

## Verification

Run `npm test`, `npm run test:rules`, `npm run test:e2e`, and `npm run build`. Rules and full teacher/student integration tests use the isolated `demo-vocabulary-ralina` Auth/Firestore emulators, never the live project. UI fixture tests do not load Firebase. Screenshots are stored in ignored `test-results/`.

The Firebase initialization, database module, rules and `.env.local` are checked against their pre-redesign checksums. The redesign does not deploy rules, hosting, or data.

### Verified on 28 September 2026

- `npm test`: 12/12 passed.
- `npm run test:rules`: 10/10 passed against the local Firestore emulator.
- `npm run test:e2e`: 10/10 passed against local Auth/Firestore emulators, including teacher CRUD, folder protection, backups and account-free student links.
- After the final Review/Results presentation adjustments, all 7 student browser scenarios passed again.
- Final `npm run build`: passed.
- The built site opened in Chrome: sign-in ready, local fonts loaded, no JavaScript errors or failed assets, no horizontal overflow at widths 320, 390, 768 and 1440.
- The final checksum check confirmed `src/firebase.js`, `src/firestore.js`, `firestore.rules` and `.env.local` are unchanged from the pre-redesign baseline. `.env.local` remains ignored.
- A rapid-action issue found during integration testing was fixed in the teacher UI: actions wait for a library mutation and refresh before opening menus based on that library.

Local development URL: http://127.0.0.1:5173/ . Open a library practice's menu → Preview to inspect student Home and all four worlds without publishing a new link. Existing published student links still use `?practice=…`.

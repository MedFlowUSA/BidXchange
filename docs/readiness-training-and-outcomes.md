# Readiness continuation: training and outcomes

## Delivered

- Connected public rehearsal at `/pursuits/DEMO-001?workspace=demo`, discoverable from Today, Company and Pursuits. Ten fictional requirements, evidence review, insurance renewal/expiration, human sign-off, reasoned bid/no-bid, assigned tasks, placeholder outline, text export, version-bound simulated approval, fictional receipt and amendment invalidation. Historical exercise events remain visible until leaving/reload. No tenant writes, portal requests, paid AI calls or real submission.
- Removed old planned-tools pursuit cards from the public workflow. Updated inaccurate future-tense Passport copy.
- Live post-submission follow-up now collects outcome date, official source/reference, known awardee/amount, reason, debrief and explicit disclosure permission. Reuses the existing append-only `response_followup_history.note` through its authorized RPC. No new model or migration. Existing notes remain readable; unknowns remain unknown. Permission defaults to not granted; an award does not automatically become completed past performance.
- Final bid/no-bid UI now uses the same strict current-sign-off predicate as the register and checklist. Two missing contexts cannot enable the final options. Database enforcement remains unchanged.
- Updated the editable PowerPoint, tagged PDF, presenter notes and accessible HTML to 26 chapters. Covers scheduled in-app reminders, acknowledgment limits, the thirteen-step checklist, the rehearsal and documented outcomes. The existing in-app guide URLs are preserved.

## Main files

`demo-bid-rehearsal.tsx` and `workspace.tsx`: connected fictional UI. `outcome-note.ts`, `response-release.ts`, `response-release-actions.ts` and `response-release.tsx`: validated outcome fields persisted in existing history. `pursuit-decision.tsx`: missing-sign-off guard. `docs/presentations/build-current-howto.mjs` and `build-accessible-guide.mjs`: training sources. `scripts/verify-user-guide.mjs`: content/tagging checks driven by the chapter source.

## Security and data

No RLS, membership, storage, credentials or production schema changes. Live outcome writes retain membership checks, explicit role checks and the existing tenant-scoped RPC. The assembled note is capped at the database's 2,000-character limit; browser content is rendered as text. The demo stores no company information and explicitly asks for fictional inputs. Production approval/submission controls remain separate from the rehearsal.

## Remaining work

The subsequent [requirement correction release](requirement-corrections-release.md) implements atomic archive, merge and restore with preserved history and review invalidation. Outcome-to-past-performance promotion still requires a deliberate, permission-controlled workflow; collecting disclosure permission is not that promotion. Outcome details are readable history text, not normalized analytics fields. The rehearsal does not reproduce all production roles, dates, release gates or exports.

Real users must still validate onboarding time and day-to-day usefulness. Use the pilot exercise below; no automated result establishes customer acceptance or legal adequacy.

## Contractor pilot exercise

Use an authorized training organization and synthetic records. Ask a contractor bid lead to complete Level 1 without coaching; record elapsed time and every unclear label. Have a second authorized reviewer follow one notice through requirements, evidence, sign-off, decision and draft. Ask them to identify each answer's source. Test one missing evidence item and a mandatory meeting on a phone. Edit an approved version and verify renewed approval is needed. Add an amendment and expire linked evidence; confirm review is reopened. Record a clearly fictional submission and an outcome, then verify another organization cannot see it. Record pass/fail, participant role, date, observed problem and follow-up owner. Do not record a training submission in a customer pursuit.

## Validation

- `npm test -- --workers=4`: 218 passed after correcting obsolete demo assertions and the outcome control's accessible label.
- `npm test -- tests/demo-rehearsal.spec.ts --workers=2`: 2 passed after the final task/decision approval-invalidation adjustment, at 390px and 1440px.
- `node --test --test-isolation=none scripts/test-response-releases.mjs`: passed role matrix, tenant isolation, immutable versions/submissions and follow-up. Default isolated execution was blocked by local process permissions; the successful run used the same test without process isolation.
- `npm run build`: passed, including TypeScript. `npm run lint`: passed. `npm run test:secrets`: passed across 520 source files.
- `node scripts/verify-user-guide.mjs`: passed; 26 PDF pages with extractable text, structure tree/tagging metadata and matching HTML chapters. Native PowerPoint export found no text-height overflow; the new rehearsal slide was visually reviewed. PDF/UA conformance is not claimed.
- The live production outcome path was not exercised with customer records. Its UI/payload validation and existing database RPC were tested separately. No claim of real-contractor acceptance is made.

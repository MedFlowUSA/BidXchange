# BidXchange functionality audit — September 26, 2026

This audit combines scoped code review, automated browser/unit tests, isolated database tests and a live fictional-workspace acceptance check. It is not a certification that every possible workflow, customer configuration or browser is defect-free.

## Findings and changes

1. **Technical deadline entry across the bid workflow.** Opportunity, task, PEPMA, source registry, source-review and human-submission forms required users to type ISO timestamps and UTC offsets. That is unnecessary friction and invites seasonal offset mistakes. A shared date/time field now interprets the entered clock time in the stated zone, shows a readable preview, blocks nonexistent clock times and requires an explicit choice for a repeated hour. Existing records retain their exact instant and fractional precision when the date/zone is unchanged. Blank dates stay unknown. Failed saves keep the user's draft.
2. **Task instructions hidden from the people doing the work.** Saved notes, priority and source context were available in the bid lead's edit form but missing from the read-only task card. Task cards now show instructions with line breaks, priority and the linked requirement. The requirement must belong to the same pursuit. Missing/archived links have review guidance. Today shows priority alongside status. Team members keep their existing permissions.
3. **Regression fixtures used the old date-entry contract.** Updated submission and staging browser fixtures to use local date/time inputs and assert explicit saved instants. No server timestamp validation was weakened to accommodate the UI.

## Scope reviewed

| Area | Evidence |
| --- | --- |
| Company profile, Passport, Radar and onboarding | Existing loader/UI/structured-field tests; isolated company-creation/invitation and evidence-monitor tests |
| Opportunity intake and portal records | Capture validation, PEPMA/registry tests, new desktop/phone date-entry tests |
| Requirements and bid decisions | Candidate-only extraction, sign-off gates, requirement lifecycle, Decision Log and amendment-comparison tests |
| Task coordination | Capture actions, queue, task card, due-date conversion and read-only member behavior |
| Drafts, PDF/Word and handoff | Existing export, placeholder, scope, checksum and version-bound approval tests |
| Submission and outcomes | Human confirmation UI and isolated immutable submission/follow-up database tests |
| BidBuddy | Existing streaming, source-sharing, task-proposal, saved-chat, route/policy and organization-isolation regressions; no provider/model changes |
| Shared UI | Existing navigation, dialogs, keyboard, mobile containment and empty-state regressions |
| Product claims | Search for eligibility guarantees, automatic submission, win/profit scoring and AI approval; matches were limitations/policy text, not new affirmative claims |

## Architecture and security

- Existing Next.js/React, Supabase session clients, organization RLS, role restrictions and audit triggers retained.
- No migrations, new tables, dependencies, credentials, hosting purchases or feature-flag changes.
- Shared date controls submit existing explicit-offset fields through existing Server Actions. Client validation is usability; server validation and authorization remain authoritative.
- Source links remain manual. No new scraping, authenticated portal access or automatic submission.
- Task notes are existing workspace-visible data. This change does not fetch or expose restricted Passport evidence or change task mutation permissions.
- Database fixtures run locally and roll back or close their isolated stores. Live acceptance uses only a fictional workspace and blocks its login afterward; no Green Energy Solutions records are edited.

## Verification

Live deployment evidence is recorded after release acceptance completes.

Already completed:

- `npx playwright test --reporter=line` — final full run: **332 passed**, desktop and mobile projects, 2.2 minutes.
- `npx playwright test tests/zoned-date.spec.ts tests/deadline-ui.spec.ts --reporter=line` — **9 passed** on the final date safeguard/task instructions, including the year-range boundary.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed; production routes generated successfully.
- `npm run test:secrets` — passed; the scanner required normal child-process permission to run its read-only Git listing.
- `git diff --check` — passed.
- `npm run test:security:local` — 251 checks passed.
- `npm run test:ai:database` — 41 checks passed.
- `node --test --test-concurrency=2 scripts/test-workspace-onboarding.mjs scripts/test-register-signoff.mjs scripts/test-requirement-lifecycle.mjs scripts/test-evidence-monitor.mjs scripts/test-response-releases.mjs scripts/test-financial-access.mjs scripts/test-saved-conversations.mjs scripts/test-decision-memory.mjs scripts/test-amendment-comparison.mjs` — 10 tests passed.
- `npm run test:staging` — 5 tests passed, including migration inventory/checksum and isolated schema rehearsal. This is not a new production migration.
- Initial full Playwright run: 330 passed, two old submission fixtures failed because they supplied an ISO string to the new native picker. Those fixtures were corrected; final run follows below.
- One targeted run had a local test-server startup timeout; starting the same test server explicitly resolved startup. No app behavior was inferred from the timeout.

## Remaining limitations and next implementation

- Assigned estimators/contributors/viewers still cannot directly update task status; current RLS allows only bid leads and administrators. The UI now makes the handoff explicit. The highest-value next implementation is a narrowly authorized, version-checked **assignee progress update** with audit history, without allowing reassignment, requirement approval or bid decisions.
- Broad workspace views use bounded samples (commonly 500 records); detail loaders resolve selected records separately. This release does not add pagination or claim completeness beyond existing limits.
- Private-file scanning and external portal synchronization retain their existing activation boundaries. This audit does not enable them.
- AI regressions cover application boundaries and scripted behavior. This pass does not measure every possible live-model answer or call a paid provider again.
- Real contractor pilot feedback, Safari-specific date-picker testing and a production-scale load test remain distinct from this audit.

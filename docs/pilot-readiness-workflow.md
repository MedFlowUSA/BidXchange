# Pilot readiness: pursuit guidance

This pass closes concrete navigation and status-reporting gaps, not the entire commercial-readiness backlog.

## Changes

- Reuse the existing record-aware workspace guide directly inside each live pursuit, behind “Open this pursuit’s workflow checklist.” No duplicate workflow model or new tables.
- Add the missing Requirements Register sign-off step before the final bid/no-bid decision. The checklist now contains thirteen steps.
- Require an actual sign-off record and a nonempty matching context before displaying current sign-off. Previously, two missing values could compare equal.
- Restore sign-off enablement, sign-off history and amendment records when assembling tenant page data. The database loader fetched them, but the page assembly omitted them; hosted testing caught the missing sign-off control.
- Check the selected pursuit’s opportunity details. A different complete opportunity no longer makes its source step appear recorded.
- Treat a current human no-bid decision as recorded, and suppress recommended draft/approval/submission work while it remains current. Stale decisions require renewed review. These suggestions do not replace server-side permissions or gates.
- Remove obsolete “Planned pursuit tools” cards from live pursuits, including the unsupported blanket “Not submitted” label. Demo scaffolding stays explicitly fictional and no longer asserts a real submission state.

## Verification

- `npm test -- tests/workflow-guide.spec.ts tests/contractor-ui.spec.ts --workers=4`: 8 passed.
- `npm test -- --workers=4`: 213 passed.
- `npm run build`: passed, including TypeScript.
- `npm run lint`: passed.
- `npm run test:secrets`: passed across 514 source files before this report.
- `node scripts/staging/onboarding-browser.mjs` (with staging CA configured): passed against hosted staging after correcting omitted tenant page data. Checks obsolete live cards are absent and the checklist reaches the real sign-off section, plus signup, reminders, first opportunity/pursuit, invitations, viewer permissions and mobile layout. Synthetic accounts were banned and the test workspace suspended; no customer records or outbound email used.

## Remaining readiness work

Follow-up implementation replaces the scaffolded pursuit demo with a connected local rehearsal and regenerates the presentation/PDF/HTML for the thirteen-step checklist, scheduled reminders and outcome follow-up. See `readiness-training-and-outcomes.md`. The demo remains a fictional simulation, not an authenticated workflow or authorization test. The subsequent [requirement correction release](requirement-corrections-release.md) adds production archive, merge and restore. Outcome-to-past-performance promotion remains in the broader implementation backlog. Real contractor timing/usability validation and legal/commercial review cannot be established by automated tests.

No database migrations, role changes, payments, outbound messages, document submissions or external services were introduced. Unrelated local files remain untouched.

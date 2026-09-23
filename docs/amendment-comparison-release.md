# Amendment comparison release — September 22, 2026

## Implemented

Saved original and amended public-source excerpts; deterministic clause comparison for license, bonds, insurance, deadlines, job walks and scope; exact source quotes and line references; suggested requirement matches; immutable snapshots; human confirmation/dismissal and findings; stale-context rejection; repeated-confirmation protection; tenant and role enforcement; desktop/mobile review UI.

Confirmed amendments use the existing broad invalidation behavior. Candidate generation never changes requirement status. Existing final decisions and snapshots remain preserved. The new UI is in a pursuit's Opportunity amendments section and is restricted to organization administrators and capture managers.

## Main files

- `apps/web/lib/amendment-comparison.ts`: typed, versioned clause rules, intake and stored-candidate validation.
- `apps/web/app/amendment-comparison-actions.ts`: authenticated source comparison and human review actions.
- `apps/web/components/amendment-comparison.tsx` and its CSS module: source intake, side-by-side field review and human controls.
- `apps/web/lib/amendment-comparison-records.ts`: bounded, organization-scoped loading.
- `supabase/migrations/20260922003200_amendment_comparison.sql`: two additive tables, RLS, indexes, identifier-only audit events and role-checked RPCs.
- `scripts/amendment-comparison-release.mjs`: transactional migration release with existing-record preservation and RLS checks.
- `scripts/staging/amendment-comparison-browser.mjs`: authenticated hosted acceptance with fictional accounts and companies.

## Hosted acceptance

Migration 032 was applied to staging with existing record fields preserved and RLS enabled. Hosted acceptance passed using real Supabase authentication, PostgREST and database with the local application and Microsoft Edge. Covered source persistence, exact clause comparisons, unchanged candidate-stage status, human confirmation, stale register, immutable decision history, idempotence, viewer/cross-tenant denial, stale confirmation rejection, dismissal and desktop/mobile layout.

The browser fixture was corrected to compare Windows form line endings consistently and inspect an option element's actual disabled property. A final uninterrupted run passed. Synthetic accounts were banned and workspaces suspended. No production customer data was used for testing.

## Validation

- `node --test scripts/test-amendment-comparison.mjs scripts/test-decision-memory.mjs scripts/test-pursuit-decisions.mjs scripts/staging/prepare.test.mjs`: 9 passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `git diff --check`: passed.
- `npm test -- --workers=4`: 252 passed. An earlier run was interrupted by a Turbopack generated-cache crash. After moving that cache aside, two existing contractor-harness action stubs needed updating; the final complete run passed.
- `npm run build`: passed.
- `npm run test:secrets`: passed across 582 tracked/unignored source files.
- `node scripts/amendment-comparison-release.mjs production apply-approved`: migration 032 applied, existing record fields preserved and RLS enabled. Production application deployment follows this schema step; live deployment identification and smoke checks are reported after release.

## Limits and rollback

This is rule-based public-text comparison, not LLM extraction or an upload/portal-fetching integration. It retains clauses instead of asserting normalized numeric/legal equivalence. Missing clauses, time zones and conditions remain unknown. Five latest comparisons are displayed; older snapshots remain stored. Automated translation and aggregate insights are not part of this change.

Disable `BIDXCHANGE_AMENDMENT_COMPARISON_ENABLED` to roll back the UI; retain the additive schema and history. No existing Passport, bid-review or task schema is replaced. No pricing, signing, approval or submission automation is added.

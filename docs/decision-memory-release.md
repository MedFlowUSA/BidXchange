# Decision Log release validation — September 22, 2026

## Scope

Feature 1 adds Company Passport-linked no-bid history, immutable notice/requirement snapshots, structured reasons, explainable same-company matching and append-only human assessments. Feature 2 remains a design checkpoint in `amendment-diffing-proposal.md`.

## Hosted validation and migration

- `node scripts/decision-memory-release.mjs staging apply-approved`: migration 031 applied; original record fields preserved; all public tables retain RLS.
- `node scripts/staging/decision-memory-browser.mjs`: passed with real hosted staging auth, PostgREST and database, local application, Microsoft Edge desktop and 390px mobile viewport. Covered register sign-off, multi-reason no-bid, frozen history, matching, human assessment, concurrent-write rejection, viewer restrictions, cross-company denial, changed-notice staleness, search and pagination.
- Synthetic users were banned and synthetic workspaces suspended after testing. No emails were sent; no production business records were used as test fixtures.
- `node scripts/decision-memory-release.mjs production apply-approved`: migration 031 applied; original record fields preserved; RLS retained. Applied before the flag-enabled application deployment.

## Release checks

- `npm test -- --workers=4`: 247 passed, including real Edge browser tests.
- `node --test scripts/test-decision-memory.mjs scripts/test-pursuit-decisions.mjs scripts/staging/prepare.test.mjs`: 8 passed. Initial sandbox subprocess denial was resolved by running with authorized subprocess access.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- `npm run test:secrets`: passed across 570 tracked/unignored source files, including the release report and amendment proposal.
- `git diff --check`: passed.

## Security and limits

No new model calls, provider purchases, cross-company aggregation or automatic gap resolution. User notes are shared within their company; restricted evidence values must not be copied into them. Matching is deterministic, limited to stored agency/trade/requirement terms, and does not interpret exact thresholds, negation or legal equivalence. Assessments become stale conservatively after context changes. Legacy history without original notice metadata is labeled unavailable rather than reconstructed.

Hosted authenticated acceptance used staging, not a real customer's production session. Public production smoke checks and deployment identification are reported after deployment. Rollback disables `BIDXCHANGE_DECISION_MEMORY_ENABLED`; retain the additive schema and history.

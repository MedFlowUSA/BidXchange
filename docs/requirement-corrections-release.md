# Requirement corrections — September 22, 2026

Administrators and capture managers can correct the active Requirements Register without deleting its history. This extends the existing pursuit workspace, role model and Supabase authorization; it adds no parallel requirement model.

## Delivered

- Archive an incorrect row with a required reason and acknowledgment. Original text, citations, evidence links and tasks remain available.
- Merge two active requirements in the same pursuit. The user reviews the combined wording; both citations are retained, the source is archived, and the target requires human review.
- Restore an archived original as an active row needing review. Restoring does not undo later target edits.
- Preserve immutable before/after correction events with the acting user's identity and timestamp.
- Invalidate current register sign-off, bid/no-bid context and release approvals through the existing requirement version tokens. Frozen response and decision snapshots remain unchanged.
- Exclude archived rows from active register reads, assistant/research retrieval, new outlines, sign-off and release validation. Existing saved responses require reconciliation; historical releases remain intact.
- Warn that archiving is not a buyer waiver and linked tasks are not automatically completed.
- Update the editable presentation, tagged 27-page PDF and semantic HTML guide.

## Main files

- `apps/web/components/requirement-lifecycle.tsx`: correction forms, archived rows and history.
- `apps/web/app/requirement-lifecycle-actions.ts` and `apps/web/lib/requirement-lifecycle.ts`: authenticated server action and bounded input validation.
- `apps/web/lib/tenant-records.ts`, `tenant-types.ts`, `tenant.ts`: scoped, bounded active/archive/history retrieval.
- `apps/web/components/tenant-workspace.tsx`, `register-signoff.tsx`: integrated controls and review/task notices.
- `apps/web/lib/ai/tools.ts`, `lib/research/retrieve.ts`, `app/response-package-actions.ts`: active-only downstream reads.
- `scripts/test-requirement-lifecycle.mjs`, `scripts/staging/onboarding-browser.mjs` and targeted Playwright tests: database, hosted browser, validation and retrieval coverage.

## Database and release safety

Migration `20260922002900_requirement_lifecycle.sql` adds archive attribution and a merge target to `pursuit_requirements`, partial indexes, the append-only `requirement_lifecycle_history` table, membership RLS and the atomic `change_requirement_lifecycle` RPC. Existing register, release, evidence freshness, amendment and resolution functions become archive-aware.

Direct authenticated deletion and archive-column mutation are denied. The RPC requires administrator/capture access, matching organization and pursuit, current source/target versions and a bounded reason. Stable locking protects concurrent merges. Viewers, estimators, executive approvers without capture authority, anonymous callers and foreign organizations cannot perform corrections. No restricted evidence values are copied into shared history, and evidence approvals never transfer automatically.

The versioned migration manifest is updated. `scripts/requirement-lifecycle-release.mjs` applies only migration 029 in a transaction, checks prerequisites, compares existing-record digests and checks public-table RLS. Staging and production application succeeded with existing records preserved and RLS enabled. Roll back by disabling correction controls while retaining archive-aware reads and immutable history; do not drop or unarchive historical records automatically.

## Verification

Commands executed successfully:

```text
npm run typecheck
npm run lint
npm test -- --workers=4
node --test --test-isolation=none scripts/test-requirement-lifecycle.mjs scripts/test-response-releases.mjs
npm run build
npm run test:secrets
node scripts/verify-user-guide.mjs
git diff --check
```

Results: 222 Playwright tests passed; both local database suites passed; production build passed; secret scan passed. The guide has 27 pages, extractable text, a structure tree, tagging metadata and matching HTML chapters. PowerPoint text-bound checks passed and the new correction slide was visually reviewed. PDF/UA conformance is not claimed.

With the local Supabase CA certificate configured and `BIDXCHANGE_LIFECYCLE_TEST_STAGING=1`, the lifecycle database suite also passed against hosted staging inside a rolled-back transaction. It demonstrated invalidation of an authorized release while preserving the original frozen snapshot. `node scripts/staging/onboarding-browser.mjs` passed real signed-in archive/restore at 390px and merge at 1440px, plus onboarding, invitation and viewer-access checks. Only synthetic staging accounts were used; these were banned and their workspace suspended afterward. No customer records were used for test mutations.

## Limits and next step

The workspace displays the latest 100 archived rows and 50 correction events, with explicit limit notices; older records remain in scoped database history. Combined citations exceeding 2,000 characters must stay in separate requirements. Tasks and evidence links remain on original rows and require deliberate human review. Restore is not an automatic reversal of a merge. The fictional rehearsal does not reproduce the authenticated correction workflow.

The highest-value next validation is an observed contractor pilot using one real solicitation: company evidence, candidate review, corrections, sign-off, decision, tasks, outline and export. Record confusion and time-to-completion before expanding features. No real-contractor pilot or legal/commercial review is claimed by these automated checks.

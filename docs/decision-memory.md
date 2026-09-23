# Company Decision Log (feature 1)

## What is implemented

The existing decision history now links explicitly to the Company Passport and freezes notice identity, agency, source reference and versioned matching terms. The existing signed-off Requirements Register snapshot remains the historical source for blockers and unresolved requirements. Decisions can collect multiple reasons. A searchable, paginated Company Decision Log displays 25 decisions at a time; closing a pursuit does not remove its history.

Opening an opportunity or pursuit queries up to five similar historical no-bids within the same company. `contractor-memory-v1` matches normalized agency names, explicit `C-xx` trade codes in source text, and a small set of contractor requirement patterns. Each result explains its matching terms. This is deterministic text matching, not AI analysis or a determination that requirements are equivalent. No model requests or new provider charges are introduced. Agency aliases, negation, ambiguous classifications and exact financial thresholds are not interpreted in this release.

Administrators and executive approvers can reassess each historical reason for a specific new notice. Resolution is never inferred from a new Passport field or automatically applied to a requirement. Assessments require a human explanation, source/reference and acknowledgment. They are append-only and use compare-and-set protection. Missing or stale assessments show “Needs review.” A resolved bonding reason does not resolve a separate job-walk conflict.

## Schema and access

Migration `20260922003100_decision_memory.sql` adds Passport linkage and frozen opportunity/matching metadata to `pursuit_decision_history`, plus `decision_memory_reviews`, company/date and matching indexes, tenant foreign keys, RLS, audit triggers and bounded read/write RPCs. Existing public decision RPCs remain compatible; the new `record_company_decision` entry point requires structured no-bid reasons and a Passport. Register sign-off, user attribution and current-context checks remain enforced by the original workflow.

Legacy rows receive only an unambiguous Passport link. Original timestamps, reasons and existing snapshots remain intact. Missing historical notice metadata is labeled unavailable and is not reconstructed from today's notice. Such entries remain in the log but cannot produce source-based matches.

Current assessments are conservative: changes to the target notice/requirements, company evidence/Profile versions, relevant human findings, organization memberships or UTC review date require reassessment. This can require review even after an unrelated company edit. A source reference is a human-entered reference, not an automatically validated document attachment. Evidence values and sensitive financial records are not copied into matching data. Assessment notes and references are shared with company members, just like existing decision rationale. Existing audit access rules apply.

## Activation and rollback

Migration 031 and authenticated hosted staging acceptance passed on September 22. The staging test uses real Supabase authentication, PostgREST and database persistence with the local application and Microsoft Edge. It creates fictional companies and users, then suspends the companies and bans the accounts. No email is sent. Production rollout status is recorded separately in the release report.

1. Apply migration 031 to staging and verify the reviewed migration inventory (package revision 19).
2. Keep the existing decisions/register-signoff/resolution workflow enabled and set `BIDXCHANGE_DECISION_MEMORY_ENABLED=true` on the staging app.
3. Complete the manual checks below with synthetic users in two organizations.
4. After acceptance, apply the same additive migration to production, then enable the flag with the app release.

Rollback is to disable `BIDXCHANGE_DECISION_MEMORY_ENABLED` and return to the previous UI/RPC path. Keep historical rows and the additive schema; do not drop captured customer history. The new snapshots continue to be captured safely on existing decisions after the migration even if the UI flag is disabled.

## Manual acceptance

1. Sign off a synthetic Requirements Register; record no-bid with bond capacity and job-walk reasons. Confirm the original requirements and their source citations appear in Company → Decision Log.
2. Edit the old notice and requirements. Confirm the original snapshot remains unchanged. Confirm older records without snapshots explicitly say historical detail unavailable.
3. Add a new notice with the same agency or explicit trade/requirement terms. Open it and inspect the matching explanation. An unrelated notice should have no matching reminder.
4. Resolve only the bond reason with a human note and source reference. Confirm the job-walk reason still needs review and the requirement/bid statuses are unchanged.
5. Change company evidence or the new notice, then refresh. Confirm the earlier assessment is stale and the reviewer must reassess. Test two open tabs to confirm stale submissions cannot overwrite a newer assessment.
6. Test company-log search and next/previous pages with more than 25 decisions. Search matches stored agency, title and rationale; it does not search restricted evidence.
7. Confirm a viewer can read shared history but cannot record assessments. Switch organizations and try a foreign record ID: no history or mutation should be available.
8. Repeat the log and assessment workflow on a phone and using keyboard navigation.

## Remaining scope

Validation completed on September 22:

- `npm test -- --workers=4`: 247 passed.
- `node --test scripts/test-decision-memory.mjs scripts/test-pursuit-decisions.mjs scripts/staging/prepare.test.mjs`: 8 passed.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:secrets`, and `git diff --check`: passed.

Additional hosted validation: `node scripts/staging/decision-memory-browser.mjs` passed sign-off, multi-reason no-bid, frozen snapshots, matching, per-reason human assessment, concurrent-write protection, viewer and cross-company denial, notice staleness, search, pagination and desktop/mobile layout. The reviewed migration was applied using `node scripts/decision-memory-release.mjs staging apply-approved`; existing record fields and RLS were preserved.

The Decision Log itself is implemented, not a sample-data endpoint. The public fictional demo has not been expanded in this PR. Amendment diffing, requirement translation and anonymized aggregate insights are separate upcoming proposals/changes; no cross-company analytics or consent collection was added here.

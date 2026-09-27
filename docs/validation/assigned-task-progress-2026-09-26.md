# Assigned task progress

Assigned contributors, estimators and executive approvers can now report Not started, In progress or Complete from the existing pursuit task card. Administrators and bid leads keep their existing full task editor. Viewers and unassigned members remain read-only. Completion records work progress; it does not review evidence, change a requirement, approve a draft or submit a bid.

The new `update_pursuit_task_progress` RPC changes only status on an existing assigned task. It locks the organization, active membership and task, checks the exact record version, and uses the existing mutation limiter, completion/version triggers and actor-attributed audit history. Generic task UPDATE permissions and tenant RLS are unchanged. Reopening clears the current completion timestamp while preserving the prior event in the audit trail. Repeating an unchanged status preserves the record version and completion time.

Browser testing also found native form reset reverting a controlled select after a handled Server Action error. The shared CaptureForm now prevents that reset, preserving the visible draft for retry and review. Its original write version remains pinned until reload; refreshed parent data cannot authorize an older draft.

## Database release

- Additive migration `20260926003500_task_progress.sql`; no table/data transformation or new role.
- Migration manifest revision 23: 34 schema migrations and the separately excluded original company seed.
- Staging and production both had migration 034 before this release. Migration 035 was applied in a transaction, recorded in the existing migration ledger, and PostgREST was notified.
- Anonymous execution is denied; authenticated execution remains subject to the RPC's current membership, organization, assignment and version checks.
- Hosted staging tests use temporary fictional records in a rolled-back transaction. TLS verification remained enabled using the existing trusted Supabase CA.

## Verification

- `node --test scripts/test-task-progress.mjs`: passed locally and on staging with `BIDXCHANGE_TASK_PROGRESS_TEST_STAGING=1`. Covers five permitted assignee roles, viewer/non-assignee/foreign-organization/foreign-pursuit/anonymous denial, invalid statuses, missing/stale versions, membership/company suspension, reassignment, completion/reopening, no-op, preserved fields, audit actor, and unchanged requirement/decision.
- `node --test --test-concurrency=2 scripts/test-task-progress.mjs scripts/test-register-signoff.mjs scripts/test-requirement-lifecycle.mjs scripts/test-response-releases.mjs scripts/test-financial-access.mjs`: 5 passed.
- `npm run test:staging`: 5 passed, including migration inventory/checksums and fresh schema bootstrap.
- `npx playwright test tests/deadline-ui.spec.ts tests/contractor-ui.spec.ts --reporter=line`: 10 passed after the reset fix. Includes phone/desktop controls, permissions, pending states, failed-save retention, existing deadline forms and contractor workflows. Component harness actions are mocked; database authorization is tested separately.
- `npm run typecheck`, `npm run lint`, `npm run test:secrets`, `git diff --check`: passed.
- `npx playwright test --reporter=line`: all 334 tests passed.
- `npm run build`: passed; production Next.js build completed.

## Use and limits

Open a pursuit, go to Tasks, find your assigned task, and choose **Update my task progress**. After saving, use **Continue with saved records** before making another change. A changed or reassigned task requires a refresh before retry. Bid leads remain responsible for editing task instructions, deadlines and ownership. This release adds no messages, email notifications, file uploads, AI actions or approval authority.

Rollback can remove the UI/action or revoke authenticated execution of the new RPC. Existing tasks, completion history and audit rows should remain. Real-contractor usability feedback remains valuable; automated checks do not establish that every workflow is defect-free.

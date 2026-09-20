# Pursuit workflow release

## Delivered work

The Today page now lists open pursuit tasks by deadline, flags overdue work, filters assignments to the signed-in user, and links to the task inside its pursuit. Completed tasks disappear on refresh. The list discloses its 20-row display and 500-record authorized-view limits. Saved opportunities and new or existing planning workspaces provide a direct scoped record link.

The decision workflow is implemented behind `BIDXCHANGE_DECISIONS_ENABLED`, enabled in the approved Vercel release. Local development defaults off. It supports **Pursue bid**, **Do not bid**, and **Reopen review**, with a reason, conditions, actual actor and time, and the latest 20 historical entries. These are historical intent records, not pricing, certification, compliance or submission approvals. Reasons and conditions are explicitly shared with active workspace members; restricted evidence should not be pasted into them.

## Migration 010 — production approval required

`20260920001000_pursuit_decisions.sql` adds the append-only `pursuit_decision_history` table and two authenticated RPCs. Administrators and executive approvers can record decisions; all active members can read the shared decision history. Direct client writes to decision fields and history are denied. Capture users retain title, status and opportunity-link edits under their existing row policies. The existing decision guard is replaced with a guard that requires an attributed historical record; submission and other approval constraints remain intact.

The RPC locks the pursuit and checks its version, then compares an opaque context token captured before loading the page's review records. That token changes with the opportunity, requirement register, company fact versions, current evidence reviews, or UTC date. Concurrent or stale drafts must reload. Company-wide fact changes conservatively require another review, even if a changed fact was not used for this pursuit. The token carries no fact values or document content. It is a change detector, not a complete archived evidence snapshot or a qualification engine.

A changed token shows “Review again” while preserving the historical decision. A recorded decision is not advertised as continuing authority. Changes that commit after the decision snapshot will be detected on the next page load; this does not freeze the workspace. Reasons and conditions remain the decision maker's responsibility. No current bid eligibility is inferred from missing or role-filtered records.

The user explicitly approved migration 010 and decision activation. Migration 010 is now installed in **staging and production**; production checksum and permission checks passed transactionally. Its canonical checksum is pinned in staging package revision 6, excluding the real-company seed. `node scripts/decision-release.mjs migrate-staging` checks the staging target and applied SQL before performing a transactional migration. The approved `migrate-production` mode verifies the production project and host, rejects test database overrides and verifies read/write/RPC grants before commit.

## Validation

Local SQL tests cover administrators/executives, viewer and foreign-user denial, forged direct updates, attribution, immutable history, stale pursuit versions, changed requirements, no-bid/reopen transitions, revoked decision authority, suspended workspaces and unchanged submission restrictions. Browser validation uses synthetic staging records and normal user sessions, then removes the temporary records/account and suspends the fixture again.

Validation passed: seven migration/package test cases, fourteen focused brief/task/input/tenant regressions, type checking, lint, formatting, production build and secret scan. Hosted staging matches the local baseline for functions, column grants, policies, views, constraints, tables and triggers. The signed-in browser test passed decision transitions, retained stale drafts, history, restricted authority, mobile layout, task filtering/deep links/completion, and direct post-save navigation. Concurrent decision calls using the same version produced exactly one accepted record.

## Release and rollback

The Today queue and navigation improvements work without migration 010. Decision recording is approved for production and enabled by `BIDXCHANGE_DECISIONS_ENABLED=true` in `vercel.json`. Migration installation and grant verification preceded deployment.

Set the decision flag to `false` in `vercel.json` and redeploy to stop offering the UI. Preserve decision history and tighter grants. Do not drop history or restore the original pending-only guard: existing recorded decisions would then prevent unrelated pursuit updates. The flag is an application rollout switch, not database revocation; emergency suspension of RPC access requires revoking its authenticated EXECUTE grant as a separate operator action.

## Remaining product work

This release improves the evidence-to-decision handoff. A production-complete service still needs supporting-document upload/scanning/versioned provenance, requirement disposition and waiver authority, whole-proposal approvals, submission receipts, official opportunity ingestion/amendment handling, notification delivery, and the separately gated AI activation. Do not describe those as live capabilities.

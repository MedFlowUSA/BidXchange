# Requirement resolution release

## Outcome and status

Implemented and validated against hosted staging. Production remains on the existing workflow until the named migration and activation are approved. The application gate is `BIDXCHANGE_RESOLUTIONS_ENABLED`, disabled unless explicitly set to `true`.

Each requirement can receive an attributed human disposition: **Needs review**, **Supported by reviewed evidence**, **Blocked**, **Awaiting clarification**, or **Documented buyer waiver**. A reason is mandatory. Administrators and executive approvers may review requirements; only executive approvers may record a documented waiver, and must identify its issuing authority and source/scope. Recording a waiver does not give the workspace user authority to waive a buyer requirement or authenticate the buyer's document.

Supported findings require a current evidence-use approval for that exact requirement. This provides a human scope assessment, not an automatic determination of eligibility or authority to submit. A review can be superseded or reopened without erasing history. The page shows the latest outcome plus entries from the latest 100 historical reviews loaded for the pursuit.

The pursuit brief prioritizes unresolved items and replaces obsolete intake blockers with the current reviewed disposition. It separately identifies stale reviews and missing ownership/citations. Visible progress counts are not eligibility scores. Limits of 500 displayed requirements, 501 loaded resolution summaries, 500 evidence reviews and 100 history entries are disclosed where relevant; the brief warns when a summary/evidence limit is reached.

## Authority, privacy and invalidation

All active workspace members can read shared dispositions, rationale and waiver references. Reviewers are told not to paste restricted evidence into those fields. The underlying evidence retains its original visibility. The private evidence-review foreign key is not readable by authenticated clients; the shared current-status function exposes only whether the human finding remains current, after checking workspace membership. Audit access remains restricted to existing authorized roles.

Clients cannot insert, update or delete resolution history directly. The authenticated RPC verifies the actual role, stamps actor and time, checks the requirement version and expected preceding review, and applies the persistent mutation limit. Supported reviews lock the fact before the requirement, matching existing evidence-review lock order. Concurrent submissions against the same preceding review accept exactly one new entry.

Requirement changes invalidate the finding. Supported findings also become stale when the linked evidence approval is replaced or loses validity, including through evidence correction or expiration. Loss of reviewer authority invalidates the finding; a waiver requires the reviewer to retain executive-approver authority. Restoration of the same authorized role can make a version-matching historical finding current again; the latest disposition remains authoritative. This is a current-validity view, not an irrevocable revocation ledger.

Resolution changes and validity changes are included in the bid/no-bid context token, prompting a fresh decision review. The expanded token format conservatively flags existing bid decisions for review on rollout. The resolution itself does not update the requirement's source version, so recording a supported finding does not invalidate its own evidence approval.

## Named migration

`20260920001100_requirement_resolutions.sql` creates the resolution history table, column-level read grants, row policies, a security-invoker current-resolution view, a membership-checked private validity function and the attributed write RPC. It updates the existing pursuit decision-context function to include resolution state. It does not modify pricing, certification or submission authorization.

Migration 011 is installed in staging only. Staging package revision 7 pins the canonical UTF-8/LF checksum and continues excluding the real-company seed. `node scripts/resolution-release.mjs migrate-staging` verifies the target, checksum and applied SQL, uses a transaction with bounded timeouts, and checks grants before commit.

## Validation

Local SQL tests exercise supported evidence requirements, exact role restrictions, empty waiver authority, shared outcomes without private linkage, attribution, immutable history, source and requirement changes, stale preceding-review rejection, reviewer revocation and decision-token invalidation. They simulate Supabase's broad default table/sequence grants and verify those defaults do not leave extra access on the new objects.

The signed-in staging browser test passes evidence approval to requirement support, clarification/blocker transitions, executive waiver recording, history, stale-draft preservation, concurrent saves, changed-evidence invalidation, bid-decision review prompts, shared viewer outcomes, denied private linkage and denied viewer writes, plus mobile containment. Synthetic records and the temporary account were removed and the fixture organization was suspended again.

Hosted schema parity passes for view definitions/security, column grants, policies, functions, constraints, table grants, triggers and RLS. Final checks passed: eight migration/package/security test cases, fifteen focused input/brief/tenant regressions, type checking, lint, formatting, production build and secret scan.

## Production activation and rollback

The existing gate in `docs/demo-intake-release.md` requires named production migration approval. Request approval for migration 011 and `BIDXCHANGE_RESOLUTIONS_ENABLED=true` only after the tested implementation is ready. No production migration attempt has been made for this release.

After approval, apply the pinned migration transactionally to the verified production project, verify permissions and function definitions, enable the flag in the deployment configuration, and deploy. Check the signed-in requirement workflow using an authorized account when available; do not create production fixture users or business records as part of this release.

For application rollback, disable the flag and redeploy. Preserve shared review history, evidence links and tightened grants. Do not remove history or revert the context calculation as a routine application rollback. The flag hides the UI and prevents the server action; database RPC access must be revoked separately if an emergency requires stopping all authorized API writes.

## Remaining scope

This is requirement-level review, not whole-proposal authorization or a complete procurement compliance engine. Document uploads/scanning, immutable document snapshots, buyer-waiver authenticity/expiry verification, clarification delivery and tracking, final proposal approval, submission receipts and official amendment ingestion remain separate work.

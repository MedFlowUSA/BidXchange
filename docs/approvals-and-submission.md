# Approvals and submission

Status: implemented behind `BIDXCHANGE_RELEASES_ENABLED`; migration 015 is installed in production and activation is approved. Access remains role-controlled. No portal automation, legal e-signature, upload permission, AI quota change or scanner purchase is included.

## Immutable review version

`response_release_versions` binds organization, pursuit, saved response ID/version, the source/review context token, immutable snapshot, canonical JSON SHA-256 checksum, actor and time. The snapshot contains shared response text, source/deadline, company names/website, requirements/findings, bid decision, checklist and final-file manifest. Restricted company-fact values are not copied. Duplicate identical freezes return the same version.

Context includes source/bid changes, evidence/resolution freshness, organization identity, membership roles/statuses, linked observed source versions and the UTC review date. Package content and title are also compared. Any change invalidates current approval; re-review and freeze a new version. This is deliberately conservative and can invalidate a release after an unrelated membership or company-fact change.

## State rules

| State                     | Meaning                                                                                                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Not ready                 | Required records, checklist confirmations, current bid decision, answers or deadline checks are missing/blocked.                                                 |
| Needs review              | A frozen version or its reviewed context is no longer current.                                                                                                   |
| Ready for internal review | No automated blockers; required human approval gates remain. This does not certify compliance.                                                                   |
| Ready for final approval  | Pricing and compliance decisions are current. Final/submission review remains.                                                                                   |
| Authorized for submission | All four current gates bind this version; a named human still must deliver it.                                                                                   |
| Submitted                 | A human recorded actual delivery for this version. Buyer acceptance/receipt is not independently verified. Historical state does not revive stale authorization. |

Every recorded requirement needs a citation, active owner, current supported/waived finding and a current completed answer. Empty registers, stale saved-response context, placeholders, pending observed source changes, missing source/solicitation/deadline/timezone and expired deadlines block approval. Checklist statuses are confirmed, missing, needs review, not applicable or unknown. Confirmed/not-applicable require a reference or reason. Unknown cannot silently pass.

## Four human gates

| Gate                     | Authorized reviewer                   | Meaning                                                                                                    |
| ------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Pricing                  | Estimator, administrator or executive | Human review of the final pricing represented by the manifest. No prices are calculated or approved by AI. |
| Compliance               | Administrator or executive            | Human review of instructions, representations, requirements and evidence.                                  |
| Final response           | Administrator or executive            | Approval of this exact completed response after current pricing and compliance decisions.                  |
| Submission authorization | Administrator or executive            | Permission for the named submitter to deliver these exact files, after final approval.                     |

Each approve/reject/revoke event records role at decision, authenticated actor, time, rationale, conditions, checksum and upstream approval IDs. Replacing/revoking an upstream decision invalidates dependent final/submission decisions. Reapproving pricing does not resurrect an old final approval. Current approver membership is rechecked. One authorized person can perform several gates; four-person separation of duties is not enforced. Conditions are human review context, not machine-evaluated promises; reviewers must settle them before authorizing delivery.

## Handoff and submission

The private JSON handoff contains the immutable version, checklist, manifest, readiness and bounded approval/submission/follow-up history. It includes an explicit internal-use disclaimer. It is not an attachment bundle, buyer receipt or submission. Session and current state are rechecked before release; history exceeding the limit is refused.

Only the named active administrator, executive or capture manager can record submission. They must explicitly confirm actual delivery of the exact version. Record actual time with timezone, method/destination, confirmation number when issued, receipt reference or explicit absence limitation, notes and optional follow-up date. Portal passwords have no supported field and extra input keys are rejected. References/notes must not contain secrets.

Initial submission and resubmission require current authorization, zero blockers and a time after authorization. Submission-history ordering is serialized per pursuit. A correction references the latest record for the same version and retains its historical authorization. Neither original submission nor approval history can be overwritten or deleted. A correction is an administrative record, not a second delivery. Actual resubmission is a separate event.

Follow-up events cover agency questions, clarification, interviews, best-and-final-offer requests, award/loss/cancellation, debrief requests/results and lessons learned. They require a recorded submission and authorized capture/executive/admin action. No event automatically changes an award claim, sends correspondence or contacts a buyer.

## Limits

- Initial/resubmission recording is conservatively blocked once the deadline passes or the UTC review date/context changes, even if the human reports an earlier delivery. The current workflow therefore requires prompt recording. Correcting an existing submission remains possible. A future reviewed historical-recording design is needed for delayed first records; do not fabricate a new delivery time to bypass this limit.
- Files remain external, selected hashes are human-attested, and no signature/receipt authenticity is verified. Retain originals in approved storage.
- Shared release/history text is visible to active organization members, including viewers. Do not enter restricted pricing detail, sensitive personnel information or credentials in shared rationale/reference fields.
- No archive pagination, scheduled reminders, automated status polling, electronic signing or automatic portal submission is included. Views show latest 20 versions and up to 500 events per category; partial views pause UI mutations. Handoff refuses more than 1,000 events per category.
- The legacy `submission_records` placeholder is not used for this workflow. New authoritative events live in `response_submission_history`.

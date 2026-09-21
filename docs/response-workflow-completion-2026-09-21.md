# Guided response workflow — completion report

Prepared September 21, 2026. **Implemented and validated in staging; production is unchanged.** No production migration, deployment, upload activation, scanner purchase, AI quota change, paid demo activation, production user creation or GES record change was performed.

### Deployment follow-up

The user approved the original production migration and deployment. Production preflight then found optional migrations 012/013 absent. The unreleased 015 was refined to conditionally query connector tables only when installed; manual source changes remain tracked regardless. Both with-connector and without-connector SQL tests pass. The checksum below reflects this compatibility revision. The older 001–005 stored-SQL checksum differences were verified to be only statement-separator/whitespace serialization; 006–011 matched exactly.

Automatic approval review blocked applying the compatibility-modified migration because the exact revision was not covered by the user's original approval. No migration was applied. The application release can safely deploy with `BIDXCHANGE_RELEASES_ENABLED=false`; activation awaits approval of revised 015. No optional infrastructure will be installed.

## 1. Guide claims checked against code

Checked the existing guide against tenant loading, company-fact disclosure/autofill, evidence reviews, requirement findings, bid decisions, response saving/review/export, assistant command dispatch and navigation. Existing PDF/Word exports are drafts. Company verification, scoped evidence-use approval and human bid intent are separate operations. The model does not approve or submit documents.

## 2. Corrected guidance

The primary instruction is now “Create a response outline for this solicitation.” RFP/RFI/RFQ/bid/sources-sought/capability-statement response outlines are recognized; the legacy RFP command remains compatible. Autofill language now describes supported, current, sourced and shareable fields rather than blanket eligibility or every company field. The expanded 23-page guide distinguishes staged approvals from existing drafting features and teaches manual submission. It includes tagged PDF output and a semantic HTML reading alternative; PDF/UA certification is not claimed.

## 3. Architecture implemented

Authorized tenant data feeds pure guide/next-action functions. A progressively disclosed response-release component uses strict session-authenticated server actions. Six PostgreSQL RPCs independently enforce actual roles, tenant scope, exact snapshot/version/checksum, gate dependencies, named submitter and immutable histories. No service-role key is used in application mutations. A private handoff endpoint returns a bounded JSON review packet after session/state rechecks.

## 4. Files changed

- Application: `components/{app-shell,assistant,bid-review,response-package,tenant-workspace,workspace-guide,response-release}.tsx`; `lib/{tenant,tenant-types,response-command,response-package,workspace-guide,response-release}.ts`; `app/{assistant-document-actions,response-package-actions,response-release-actions}.ts`; response draft export route; new `app/api/response-releases/handoff/route.ts`; `app/globals.css`.
- Configuration: `.env.example` adds a disabled release flag; `.prettierignore` preserves generated slide HTML whitespace.
- Database/testing: migration 015; staging manifest/rehearsal expectations; release SQL tests; staging install/browser/isolated-runner scripts; guide verification script; workflow fixtures/browser tests; expanded response-command tests.
- Instructional assets: public PDF and HTML; presentation source JSON, generator, accessible HTML generator, PPTX, PDF, slide HTML, presenter notes and supporting demo images under `docs/presentations`.
- Documentation: README, architecture, security, database, pursuit workflow, response workspace, approvals/submission, role matrix, release runbook and this report.

Pre-existing `.gitignore` changes and the unrelated September 19 audit file were preserved. No commit was pushed to `main`, because that branch triggers production deployment.

## 5. Migration

`20260921001500_response_release_workflow.sql`, canonical LF SHA-256:

```text
71a4317a9170e7e715df22b46c1aaa0db7e17a8fb4f1ecd223606c2f641ac7c7
```

Manifest revision 11. Installed and checked on pinned staging project `svimdvbgtltmyaubfaux`. Production project `bcrxejydosltquspsutw` has not received this migration.

## 6. Database objects

Four RLS tables: `response_release_versions`, `response_approval_history`, `response_submission_history`, `response_followup_history`. Each has an active-member SELECT policy, no direct authenticated write/sequence permissions, an insert audit trigger and immutable update/delete protection. Six authenticated RPCs: `response_release_context`, `freeze_response_release`, `response_release_status`, `record_response_approval`, `record_response_submission`, `record_response_followup`. Anonymous execution is denied. The private immutable trigger function is not client callable. The complete schema rehearsal verifies 52 public RLS tables and 127 policies.

## 7. In-app guide

Twelve optional steps use saved authorized records, with role explanations and explicit unevaluated states when no pursuit is loaded. Dismissal is scoped browser preference; Workspace guide reopens it. A visit never completes a step or creates/approves a record. Primary navigation remains the five requested destinations; the PDF/help links are secondary.

## 8. Next actions

At most one primary and three secondary suggestions. Imminent/passed deadlines and unresolved/stale requirement findings precede due work and unfinished authorized steps. Company suggestions target the current fact needing review; opportunity suggestions reuse an existing pursuit. Links retain organization context and target exact records. Lists are bounded samples, not exhaustive workload or eligibility certification.

## 9. Readiness

Explicit states: Not ready, Needs review, Ready for internal review, Ready for final approval, Authorized for submission, Submitted. Counts describe requirements and writing, not a readiness percentage. Required source/deadline/timezone, current bid decision, cited/owned requirements, current findings/answers and checklist confirmations are checked. Pending source changes, stale context, missing answers and placeholders block approval. Unknown checklist items cannot pass.

## 10. Approval gates

Pricing: estimator/admin/executive. Compliance, final response and submission authorization: admin/executive. Each event binds the exact immutable version and checksum with actor, role, time, rationale, conditions and upstream event IDs. Changed response/source/checklist/reviewer context invalidates authority. Revoking or replacing an upstream approval invalidates downstream decisions; reapproval does not resurrect them. No legal signature or four-person separation of duties is implied.

## 11. Handoff

Final files are hashed locally without uploading bytes. The manifest records names, SHA-256 and storage references. The private JSON handoff contains the frozen response, checklist, manifest, readiness and history. It is an internal review artifact, not a file bundle or proof of buyer delivery. Draft exports remain separate working files.

## 12. Submission and follow-up

Only the named active submitter may explicitly confirm and record the actual exact-version delivery. Records capture actual time, method/destination, confirmation/receipt or its absence limitation, notes and follow-up. Initial delivery, correction and resubmission are separate immutable events ordered per pursuit. Follow-up supports agency questions, clarification, interviews, best-and-final offers, award/loss/cancellation, debriefs and lessons. No external correspondence or portal action occurs.

## 13. Authorization and isolation

Tested administrator, executive, capture manager, estimator, contributor, viewer, inactive, anonymous and foreign-tenant cases. Direct writes/deletes, unauthorized gates, wrong tenant/version/checksum, absent confirmation, unsupported credential-like fields and stale dependency paths fail closed. Review history and shared text remain visible to active organization members; restricted facts are not copied automatically. See [permissions](role-permissions.md) and [emergency disable](response-release-runbook.md).

## 14. Executed validation

`npm run format:check` passed across the configured repository paths. Generated slide HTML is excluded because its whitespace is part of the positioned text layout.

| Check                                                            | Result                                                                                                                                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full `npx playwright test`                                       | 138 passed across configured desktop/mobile projects.                                                                                               |
| Focused workflow/response suite after final UI changes           | 10 passed, including mobile overflow, guide dismissal/reopen, Escape, viewer controls and explicit submission confirmation.                         |
| Local release/evidence/decision/resolution/document/schema suite | 10 passed.                                                                                                                                          |
| Hosted staging release SQL suite                                 | Passed in a rollback-only transaction; all synthetic rows rolled back.                                                                              |
| Signed-in staging browser with real server actions/RPCs          | Passed: local hashes → freeze → four gates → private handoff → explicit submission → follow-up → guide.                                             |
| `npm run test:security:local`                                    | 251 checks passed using isolated fixtures.                                                                                                          |
| `npm run test:ai:database`                                       | 41 checks passed; no paid model call.                                                                                                               |
| `npm run typecheck` / `npm run lint`                             | Passed.                                                                                                                                             |
| Production build                                                 | Passed locally; no deployment.                                                                                                                      |
| Guide generator/verification                                     | 23 pages, no generated text overflow, extractable text, structure tree/tag metadata and 23 semantic HTML chapters. New chapters visually inspected. |
| Secret scan                                                      | Passed on tracked and unignored source files.                                                                                                       |
| `npm audit --audit-level=moderate`                               | Zero reported vulnerabilities, including development dependencies; production-only audit also zero.                                                 |

The initial tests found SQL variable collisions, timestamp-precision/transaction fixture issues, same-transaction source invalidation and select-label accessibility issues; these were corrected and rerun. Test cleanup preserves the last administrator membership while suspending synthetic organizations and banning test identities. Immutable browser-test history remains quarantined in staging. No production record was used for a write test.

## 15. Known limits

- Prompt recording is required: first submission/resubmission recording is blocked after the deadline or a UTC review-date/context change, even if delivery is reported as earlier. Existing records can still receive administrative corrections. Do not invent delivery times to work around this; delayed first-record handling needs a separately reviewed design.
- No portal automation, legal e-signing, upload/scan service, file retrieval, receipt authenticity verification, scheduled reminders or automatic award verification.
- Final files remain external and their hashes are human-attested. Shared notes/references must not contain restricted pricing detail, personnel information or credentials.
- Conditions require human judgment; the app does not interpret or prove them satisfied. One authorized person may perform several gates.
- Version/history views and exports are bounded. Partial history pauses UI mutation; large handoffs fail closed. Exhaustive archive pagination remains future work.
- Tagged PDF has an HTML alternative but is not certified PDF/UA. Full assistive-technology conformance has not been certified.

## 16. Production requirements

Explicitly approve migration 015 and deployment/activation. Verify prerequisites and backup/restore readiness, apply only the reviewed canonical migration transactionally, recheck grants, deploy with the release switch off, smoke-test, then activate the reviewed flag. Do not alter AI quotas, upload policies or other tenant data. The app flag alone does not revoke direct RPC execution; the runbook gives the four write-RPC revocations for emergency disable.

## 17. Recommendation

**GO for a controlled pilot of the reviewed workflow after explicit production approval**, with prompt submission recording and external-file limitations accepted. **NO-GO for production migration/deployment now**, because that approval has not yet been given for this concrete release. The workflow does not replace the buyer's portal or the organization's authorized human review.

## 18. Smallest next approval

“Approve production migration `20260921001500_response_release_workflow.sql` and deploy/enable the reviewed response workflow, accepting the documented prompt-recording and external-file limits. Keep uploads, scanner hosting, AI quotas and portal automation unchanged.”

See the [release runbook](response-release-runbook.md) for execution and disable steps.

# California contractor implementation report

This is the initial implementation report. The full implementation brief is **not complete**. Deployment was subsequently authorized; see `california-contractor-deployment.md` for rollout status.

## Implemented

### Slice 1 — Passport

Extended the existing Company Passport into six California onboarding areas: identity; SAM/UEI and DIR; CSLB; territory and classifications; bonding/insurance; three past projects. Added structured headquarters, source-check, bonding-band and disclosure fields without replacing `profile_facts`. Existing human attestation, role restrictions and audit controls remain authoritative. The Radar on Company and Today identifies expired records, 30/60/90-day expirations, stale source checks and missing dates. One GL policy cannot silently satisfy workers’ compensation or auto insurance.

### Slice 2 — Opportunity and requirements

Preserved manual intake and existing candidate extraction. Added versioned, source-quoted California checklist heuristics, dismissible in the current view, and labeled them nonbinding candidates. Expanded official portal shortcuts and labeled them external. Added amendment capture and attributed review, source-change invalidation, immutable register sign-off, and a reason-required human not-applicable finding distinct from a buyer waiver.

### Slice 3 — Decisions and tasks

Both final bid and no-bid decisions require current human register sign-off. Preliminary draft, leaning-bid and leaning-pass decisions remain possible without sign-off. Decision history stores reason codes, user-entered hours, sign-off reference, requirement/blocker snapshot, evidence-freshness counts and deadline snapshot. The UI currently captures one primary reason code; the database supports several.

Added the contractor task template and extended existing tasks with requirement links, priority, notes, creator and completion time. Human-confirmed blockers can lead to a linked teaming-partner research task. Opening an affected pursuit reopens requirements linked to expired/stale evidence and creates an idempotent follow-up task; prior decisions and histories are preserved. Amendments invalidate context and must be reviewed before register sign-off.

### Slice 4 — Draft and submission

Creation requires a nonempty requirements register. Assistant-prepared outlines include California contractor sections with human-input markers. Company identity requires a current attested entity record; missing identity remains visibly incomplete. Stale evidence is excluded from prefilling. Both client and database release validation recognize `[HUMAN INPUT REQUIRED]` as incomplete. Existing PDF/DOCX exports, immutable releases, version-bound approvals and user-recorded submissions were retained and regression-tested.

### Slice 5 — Assistant and access

Retained the existing private-record/general-mode separation, organization-scoped retrieval, role filtering and prompt-injection defenses. Workspace policy explicitly declines legal/license certification, autonomous pricing, signing, submission and guarantees, and specifies the missing-record phrase. No external portal automation, new data connector or training pipeline was introduced. The existing API request pattern uses `store: false`; provider/account data-retention settings were not independently audited.

### Slice 6 — Language and UI validation

Added the persistent human-review notice. Narrowed landing-page audience and copy to California field contractors. Replaced visible fictional-demo numeric fit scores with human-review findings while retaining legacy storage compatibility. Added desktop/mobile browser fixtures for Passport navigation, Radar, final-decision gating and amendment review. The complete connected Apex demo upgrade remains unfinished.

## Main files changed

- `IMPLEMENTATION_NOTES.md`: repository inventory, implementation status and explicit remaining scope.
- `apps/web/lib/california-passport.ts`, `company-fields.ts`, `company-readiness.ts`, `passport-records.ts`: Passport catalog, freshness and matching.
- `apps/web/components/company-passport.tsx`, `evidence-renewals.tsx`: California onboarding path and Radar.
- `apps/web/lib/california-rules.ts`, `components/notice-excerpt-review.tsx`, `portal-shortcuts.tsx`: candidate checklist and external portals.
- `app/register-signoff-actions.ts`, `app/amendment-actions.ts`, corresponding components: attributed human review.
- `app/decision-actions.ts`, `components/pursuit-decision.tsx`, `lib/decision-reasons.ts`: preliminary/final decision memo.
- `capture-actions.ts`, `capture-forms.tsx`, `contractor-task-template.tsx`, `requirement-resolution.tsx`: requirement-linked work and teaming follow-up.
- `lib/tenant-records.ts`, `tenant-types.ts`, `tenant.ts`: organization-scoped loading and gated schema activation.
- `response-autofill.ts`, `response-command.ts`, `response-progress.ts`, response actions/components: attested prefilling, outline and incomplete-content gates.
- `app-shell.tsx`, `app/page.tsx`, `workspace.tsx`, `lib/ai/policy.ts`: human-authority and California product language.
- Tests, schema builders and `scripts/staging/migrations.json`: regression coverage and checksum-controlled schema package.

## Database changes

- **020**: extends existing structured-fact validation; no new Passport table.
- **021**: `requirements_register_signoffs`, member-read RLS, audit trigger and index; decision history metadata/snapshots and sign-off-enforcing RPC. The previous decision implementation is private and direct execution is revoked.
- **022**: task metadata and organization-scoped requirement FK/index; `opportunity_amendments` with RLS, audit, actor stamping, source invalidation and amendment-review sign-off gate.
- **023**: current evidence view gains a 90-day source-freshness condition; requirements gain a freshness token and column-scoped update grants; bounded organization/pursuit refresh RPC reopens review and adds follow-up work.
- **024**: expands the existing resolution constraint and RPC to support reason-required not-applicable findings.
- **025**: extends the existing release-status validator to recognize new incomplete-field markers and not-applicable findings.

No customer rows were deleted, no RLS policy disabled, and no real customer data inserted into demo/test fixtures. New migrations passed local SQL tests and full schema bootstrap. The staging manifest now includes 017–025 and retains historical checksum protection and exclusion of the real-company seed. No hosted migration was applied.

Production/staging read-only migration audits were attempted with `node scripts/contractor-schema-audit.mjs production` and `staging`, then with `node --use-system-ca`. Both targets returned `SELF_SIGNED_CERT_IN_CHAIN`. TLS verification was preserved. Hosted migration status is therefore **unverified**, not inferred from local files.

## Product-language changes

Visible numeric demo fit scores became review findings. Company claims use human-attested evidence language in new onboarding/export surfaces. Portal shortcuts say external site. The landing page now names CSLB, DIR, bonding and job walks, and explicitly describes external submission. The persistent notice states that BidXchange does not determine eligibility, set pricing or submit bids. The legacy database status name `verified` remains for compatibility and does not certify legal eligibility.

## Tests run

- `npm run typecheck` — passed.
- `npm run lint` — passed. Corrected two existing test-variable names rejected by the Next lint rule.
- `npm test -- --workers=4` — **197 passed**, including existing assistant isolation/injection tests, export tests, desktop/mobile regressions and new contractor tests.
- `node --test scripts/test-register-signoff.mjs scripts/test-company-fields.mjs scripts/test-pursuit-decisions.mjs scripts/test-requirement-resolutions.mjs scripts/test-response-releases.mjs` — **5 passed**; these exercise real local SQL/RLS, not mocked database authorization.
- `npm run test:staging` — **5 passed**; offline packaging/checksum/bootstrap tests, not hosted staging. Every public table in the complete local schema has RLS enabled.
- `npm run test:secrets` — passed across tracked and unignored source files.
- `git diff --check` — passed.
- `npm run build` — passed; optimized production build and route generation completed.

Earlier runs exposed outdated fixtures/metadata expectations and a missing placeholder gate; fixes were followed by successful reruns. The new browser fixture exercises real components with stubbed server actions. It does not establish a full authenticated hosted workflow or ten-minute onboarding completion.

## Security review

New reads and mutations are organization-scoped. Database policies and RPCs enforce roles independently of browser fields. Sign-off/decision history cannot be directly inserted, edited or deleted by authenticated users. Actor identities and times are server-assigned. Amendment review uses optimistic version checks. Linked requirements/tasks use composite organization keys and pursuit checks. Snapshot metadata avoids exposing private financial fact values to ordinary pursuit members. General AI mode remains separated from private retrieval; existing cross-tenant and injection tests passed. No secrets or private uploads were added. No external submission action was introduced.

## Remaining limitations

The brief’s full definition of done is unmet. Remaining implementation includes self-service organization creation/joining; a measured short onboarding experience; normalized freshness metadata across all evidence kinds; complete evidence unlink and requirement merge/delete/restore controls; persisted heuristic dismissal/category/confidence; background propagation and notifications; finer bid-lead role mapping; assistant retrieval of all newly added records; complete outcome-to-permitted-past-performance promotion; and the full connected fictional Apex workflow.

Freshness propagation currently runs on pursuit access and can follow historical evidence links. Sign-off context includes the UTC review date, so it requires reaffirmation on later days. Structured insurance/bonding remain subject to existing sensitive-data restrictions and are not indiscriminately copied into exports. Hosted migration, authenticated end-to-end testing and deployment remain outstanding. See `california-contractor-rollout.md` for coordinated activation and non-destructive recovery.

## Recommended next implementation

Complete secure organization creation and invitation-based joining, then validate the entire first-user Passport-to-pursuit path. A new customer must be able to reach the workflow without manual account provisioning.

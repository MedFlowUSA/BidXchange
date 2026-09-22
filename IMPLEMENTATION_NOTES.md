# California contractor implementation

## Requirement correction slice — September 22

Extend `pursuit_requirements` with archive attribution and a same-pursuit merge reference; preserve records, evidence links, tasks, decision snapshots and release history. Add append-only lifecycle events with source/target snapshots under existing organization membership RLS. Administrator and capture-manager actions use an atomic, version-checked RPC; no direct delete or archive-column writes. Merge retains original citations, archives the source and requires human review of the target. Restore returns the original row for review; it does not silently undo a later merge target edit. Existing monotonic versions invalidate sign-off, decision context and release approval. Active-only requirement reads must cover register, outline/export, research, AI, sign-off, release validation and freshness jobs; archive/history views stay scoped and bounded. Add migration 029, local and hosted SQL tests (roles, cross-tenant/pursuit, stale writes, immutability, preserved links and invalidation), desktop/mobile UI tests, build and deployment checks. Apply the additive schema before the app; all existing rows remain active. Rollback disables correction controls while retaining archive-aware readers and all history. Expected files: tenant types/loaders, capture/response/AI/research reads, new lifecycle input/actions/component, migration manifest/release test scripts and training documentation. Real-contractor pilot participation remains external to automated checks.

## Readiness continuation — September 22

Preserve the Next/React and Supabase architecture, production role/RLS gates and existing demo routes. Extend the browser-only fictional workspace with a connected rehearsal (requirements, evidence freshness, sign-off, decisions, version-bound approval and user-recorded submission). Reuse its opportunity seed and existing visual classes; do not add production tables or treat rehearsal clicks as production authority. State resets when leaving/reloading the rehearsal and never reaches organization records. Add desktop/mobile transition tests, including invalidation and preserved history. Update the existing how-to generator, editable PowerPoint, accessible HTML and tagged PDF, with text/layout checks. No migrations or permission changes are proposed. Real-user usability and legal review remain external validation. Requirement merge/restore and production outcome promotion require separate database-backed work; the rehearsal must not claim those exist in production.

## Inventory

- Runtime: Node 24, npm lockfile, Next.js 16 App Router, React 19, TypeScript. Existing CSS modules/global styles and lucide icons; no new UI framework.
- Auth: Supabase passwordless server sessions, HTTP-only cookies, validated user/session clients. Organization membership/RLS and private role helpers enforce tenancy. Provisioned accounts currently required; self-service join/invitations remain missing.
- Roles: organization_admin = owner, capture_manager = bid lead, executive_approver = approver, estimator, viewer; retain contributor. Financial/sensitive facts retain existing restricted policies.
- Data: organizations, organization_memberships, company_profiles, profile_facts (structured_kind/fields, source_reference/note, verified_by/at, expiration/effective dates, sensitivity), opportunities, pursuits, pursuit_requirements, pursuit_tasks, evidence_use_reviews, requirement_resolution_history, pursuit_decision_history, response packages and release/approval/submission histories. Existing audit triggers and version/context checks are reusable.
- Migrations: additive SQL in supabase/migrations, currently 001–019; document/source migrations have separate production activation. Do not infer production schema from local files.
- Routes: public root/login/legal pages; dashboard/company/opportunities/pursuits/documents/settings; pursuit qualification workspace; assistant/research; existing source registry/portal shortcuts. Account security is separate and does not enforce MFA.
- Components: TenantWorkspace connects authenticated pages; Workspace and demo.ts provide browser-local fictional Apex data. CompanyPassport, CompanyRecordForm, EvidenceRenewals, NoticeExcerptReview, RequirementResolution, PursuitDecision, ResponsePackages and ResponseReleases already exist.
- AI: general mode and authorized structured-record mode with quotas and server-side OpenAI calls; deterministic notice excerpt candidates and explicit document commands; research searches bounded existing records. SAM operator connector exists but live production sync is not established. No portal scraping.
- Storage: private document version/scanner foundation is gated; keep external references and metadata. Do not enable uploads.
- Exports: existing PDF/Word response exports and immutable release/handoff workflow. Human submission recording only.
- Demo: Apex municipal retrofit and browser-local workflow; legacy illustrative numeric fit scoring requires removal from visible workflow. Real GES data must never be copied into demo.
- Tests: Playwright browser/unit fixtures, PGlite SQL/RLS tests, hosted staging scripts, secret scanner, TypeScript/lint/build. Existing environmental switches are documented in .env.example; do not print values.

## Implementation order and expected changes

0. Persistent human-authority notice; audit demo/marketing/AI claims and hide numeric eligibility/scoring and grant entry points.
1. Extend existing Passport templates and editor into a California Level-1 path; reuse profile_facts and verification as human attestation, add freshness Radar and tests.
2. Extend notice candidates with versioned California heuristics, requirement states and register sign-off; reuse evidence relationships and amendment history where equivalent.
3. Enforce sign-off in the existing decision RPC; immutable context/freshness snapshots and contractor task templates; expose stale decisions and factual pursuit load.
4. Extend existing outlines/prefill/approval/export/submission controls and disclaimers; preserve human placeholders.
5. Tighten AI bounded intents, citations and role/tenant tests.
6. Upgrade fictional demo and validate complete desktop/mobile workflows, SQL, exports and production build.

Expected areas: apps/web/lib/company-_, components/company-_, evidence-renewals, notice-excerpt, pursuit-decision, capture forms/actions, tenant loader/types, app-shell, demo/workspace, response and AI modules; tests and migration scripts. Extend rather than duplicate these.

## Proposed database work

Use additive changes to existing facts for explicit freshness/attestation metadata if current timestamps cannot represent it; extend structured field validation catalog consistently in SQL and TypeScript. Add register sign-off history only (no equivalent exists), link decisions to its context; keep current history immutable. Extend existing requirement/task/opportunity records for missing fields rather than new parallel entities. Validate exact changes with isolated SQL and hosted staging before production activation; document reversible rollout without deleting historical records.

## Risks and validation

Existing verified status means reviewed source evidence, not legal certification. Preserve compatibility while making visible language human-attested. Time-based staleness must invalidate decisions server-side, not solely in client projections. Existing decisions are context-bound but currently lack register sign-off. Avoid claiming notifications, exhaustive search, live feeds or completion where not implemented. Test SQL direct-call bypass, role restrictions, hidden evidence, expiration boundaries, amendment invalidation, export isolation, version approvals, and demo persistence. Preserve unrelated .gitignore and historical audit-file changes.

Implementation status: discovery completed; slices are tracked below as work proceeds. This document is not a completion claim.

## Implemented locally

- Phase 0: persistent human-authority notice; California landing-page audience; visible demo numeric scoring replaced with review findings. Legacy demo storage remains compatible.
- Slice 1: six-step California Passport path using existing structured facts; headquarters, SAM check dates, bonding bands and project disclosure fields; insurance matching safeguards; 30/60/90-day and stale/missing-date Radar on Company and Today. Existing attestation/audit controls retained.
- Slice 2: explainable, versioned California candidate checklist; external portal shortcuts; amendment capture and attributed review; immutable register sign-off; explicit reason-required not-applicable human finding.
- Slice 3: final bid and no-bid require current sign-off; preliminary leaning decisions, reason codes, human-entered hours, deadline/register/freshness snapshots; contractor task template, requirement-linked tasks and human-blocker teaming follow-up; stale evidence refresh opens a task on pursuit access.
- Slice 4: current human-attested entity prefilling, stale evidence exclusion, human placeholders, nonempty register gate and California response sections; existing Word/PDF and immutable release approvals retained. SQL release validator recognizes the new placeholders.
- Slice 5: existing organization-scoped retrieval retained; policy explicitly rejects legal/license certification, pricing, signing and submission authority, and uses the required missing-record phrase. No new external tools.
- Slice 6: existing demo numeric presentation corrected, browser regression fixtures added. Full connected Apex seed upgrade remains unfinished.

## Exact migrations and activation

020 updates existing structured-fact validation. 021 adds sign-off history and extends decision history/RPC with snapshots and preliminary metadata. 022 adds task metadata and amendment history/RLS/audit/review gates. 023 adds source-freshness checks and idempotent requirement/task refresh. 024 extends existing resolutions with not-applicable. 025 extends the existing release validator.

All changes are additive except narrowly replacing validation functions/views, expanding a disposition constraint, and replacing broad requirement UPDATE with existing editable-column grants. Existing customer rows and histories are retained. Migration manifest revision 13 includes previously unlisted 017–019 and new 020–025; historical checksums are protected by the manifest builder.

New server-only switches: BIDXCHANGE_REGISTER_SIGNOFF_ENABLED and BIDXCHANGE_CONTRACTOR_WORKFLOW_ENABLED. Do not enable until 020–025 have passed hosted staging and production migration verification. Deploy schema and application together: 021 enforces sign-off even when an old application has no sign-off UI. Disabling UI switches does not undo database gates. Do not deploy the new Passport catalog against the old SQL validator.

## Remaining brief requirements

Self-service create/join organization; measured ten-minute onboarding; normalized freshness timestamps for every evidence kind; complete evidence unlink/requirement merge/delete/restore workflows; persistent heuristic dismissals and candidate confidence/category metadata; background freshness propagation and notifications; finer bid-lead permission mapping; full assistant access to new sign-offs/amendments/tasks; full outcome/past-performance permission promotion; integrated Apex end-to-end demo; hosted staging and deployment. The current source-check fallback is the attestation date, and freshness propagation runs when a pursuit is opened, not on a scheduler.

These are implementation gaps, not features represented as live. Current manual intake, tenant isolation, external-link storage, exports, version-bound approvals and user-recorded submissions remain the foundation.

## Next slice: customer access and first-workspace onboarding

Extend Supabase passwordless auth with an explicit signup route, gated by BIDXCHANGE_SELF_SERVICE_ENABLED until migration and provider validation pass. Existing sign-in remains account-only. Add /onboarding outside the workspace loader to create a company or accept an invitation after email confirmation. Reuse organizations, company_profiles, organization_memberships, Passport steps and existing role controls.

Migration 027 adds private idempotent creation receipts and administrator-controlled invitations, with RLS, audit events, bounded creation, seven-day expiry, revocation and verified-email acceptance. Invitations are discoverable only by the named verified account; no bearer tokens or automatic invitation emails. Existing memberships are never silently elevated and suspended memberships cannot rejoin through this flow. Each new company receives an administrator and empty profile atomically; no attestations are invented.

Expected changes: auth/signup/onboarding pages and actions, account/Settings links, first-workspace checklist, safe return paths, schema manifest and SQL/browser tests. Primary risks: email spoofing, cross-tenant invitation access, role escalation, duplicate creation, abuse and incorrect provider signup configuration. Validate with local SQL/RLS, action/route and desktop/mobile tests, typecheck/lint/build, then hosted rollback checks before activation. Measure onboarding with a real user later; do not claim a ten-minute completion time from automated tests.

### Customer-access slice completion

Implemented /signup, verified-email /onboarding create/join, administrator invitations and revocation, and the first-workspace Passport checklist. Migration 027 is additive and applied to staging and production with existing-record preservation and RLS checks. Local SQL tests and hosted rollback checks passed. The complete hosted staging browser path now reaches a first Passport fact, opportunity, pursuit and invitation acceptance; viewer access to invitation administration is denied. Full application suite: 202 passed. The guide now includes signup and manual-share invitations. See docs/workspace-onboarding-release.md for test commands, delivery limits and remaining scope; earlier inventory sections are historical snapshots.

## Scheduled evidence monitoring slice

## Assistant record-accuracy audit (September 22)

Follow-up: extend read-only assistant tools with bounded pursuit release discovery and per-release summaries using existing response_release_versions, response_approval_history, response_submission_history and response_release_status. Existing member RLS remains in force. Exclude snapshots, amounts, free-text rationale/conditions, receipts and document links. Cite release IDs; reload status on source-detail access. Surface current versus historical approvals and user-recorded submission corrections. No migrations, new dependencies or write tools. Validate foreign IDs, stale/revoked decisions, racing status, model-record budgets, projection support and public regression tests.

Verified gaps: assistant facts omit source freshness, pursuits hardcode not_submitted, and saved decisions omit current-context validation. Extend existing read-only EvidenceTools and status policy; reuse pursuit_decision_history and pursuit_decision_context with the authenticated organization-scoped client. No migrations or writes. Return submission not checked until a dedicated source-authorized submission reader exists. Select only source-check date from structured JSON, retain sensitive-data exclusions, and use the same policy on citation detail pages. Test 90-day boundaries, invalid/future checks, stale/current/missing decision history, tenant scoping and no invented submission status; run regressions and production build. Broader demo, legal activation and connector gaps remain separately tracked.

Reuse profile_facts, Radar, evidence_use_reviews, pursuit_requirements, pursuit_tasks and decision/sign-off context invalidation. Existing freshness propagation runs only on pursuit access and considers historical links. Migration 028 will share a private freshness worker with the authorized public RPC, use only each pair’s latest applicable review, create deduplicated owner follow-up tasks and add source-permission-filtered in-app evidence reminders. Existing decision snapshots will not be changed. New private per-organization run state supports bounded daily processing, retry/backlog visibility and scheduler health. No email/SMS sending or additional hosting.

Use Supabase pg_cron (available, not yet installed) with a separately reviewed activation script; no service key or public cron endpoint. Run batches every 15 minutes with at most 25 organizations per invocation and one successful check per UTC day. Owner reminders remain subject to current source visibility; restricted labels/values never enter broadly visible tasks. Tests: local SQL expiry/freshness/idempotency/latest-link/role/audit checks, hosted staging rollback checks, desktop/mobile reminders, build/typecheck/lint, scheduler activation and live health verification. Deploy additive schema before enabling BIDXCHANGE_EVIDENCE_MONITOR_ENABLED. Preserve unrelated user changes, including next-env.d.ts.

# California contractor implementation

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

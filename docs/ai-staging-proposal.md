# BidXchange staging proposal — historical approved plan

The user approved these resources. See [staging validation](ai-staging-validation.md) for the created resources, actual test results, cleanup limitations and next approval gate. The proposal below records the pre-creation decision and is not current deployment status.

Production activation remains NO-GO. This phase only inspected configuration and prepared this proposal. No resource, deployment, migration, key retrieval, paid provider request or billing change was performed. Existing local tests and reports remain uncommitted and preserved.

## Verified starting point

The connected Supabase account has no `bidxchange-staging` project. Production project `bcrxejydosltquspsutw` is in AWS `us-east-1`. The existing Vercel `bidxchange` project has Production, Preview and Development environments, with no custom staging environment. Preview currently shares the Supabase URL and publishable-key variable definitions with Production. No values were retrieved.

Repository HEAD is `deaa512`. No root AGENTS.md exists; the web AGENTS.md was read completely. The latest validation report, security/architecture/runbooks and migration history were reviewed. Previous validation results are recorded in `ai-validation-followup.md`; they were not rerun during this read-only resource-planning phase.

## Exact resources proposed

1. Supabase project **bidxchange-staging**, in the same Supabase organization as production (`jgnhiknvfkarlxtgqtvy`), region **us-east-1**. Matching production keeps database geography consistent and close to the existing Vercel US-East runtime. Use the smallest appropriate allocation: free only if eligibility is confirmed; otherwise Micro only after explicit charge approval. Do not upgrade the organization plan or create/change billing.
2. Git branch **staging**, deployed using the existing Vercel project's **Preview** environment. No paid custom-environment feature or custom domain is required by this design. Configure branch-specific staging variables before any branch push/deployment so it cannot inherit the production database connection. Keep the root workspace linked to production; use an isolated staging checkout/workdir and explicit target checks for staging operations.
3. Staging-only Supabase connection/auth configuration, `SITE_URL`, AI switches and quota configuration. Start both AI switches disabled. Do not copy any production credential, including the OpenAI secret, into Preview. Normal quota/application testing will use a deterministic mocked provider with no OpenAI network access.
4. Synthetic organizations A/B and users covering all actual roles: organization_admin, executive_approver, capture_manager, estimator, contributor and viewer, plus suspended/revoked/anonymous cases. There is no separate manager/owner role. Use a staging-only ignored manifest containing fixture IDs, never tokens or passwords, and cleanup restricted to those IDs/project.

## Cost and approval scope

[Supabase's official compute schedule](https://supabase.com/docs/guides/platform/manage-your-usage/compute) lists Micro at **$0.01344/hour, approximately $10/month**, before taxes or other usage. Compute is billed while the project runs and is not covered by the usage spend cap. Paid organizations receive an organization-wide compute credit; it is not a fresh free allocation for each new project. Free availability or unused credits for this account have not been established, so this proposal does not promise a free project or a hard $10 invoice ceiling.

[Vercel Preview](https://vercel.com/docs/deployments/environments) is an existing default environment. The proposal requires no new Vercel plan or custom-environment purchase; build/runtime/traffic use still counts against the account's current allowances and billing. Account usage headroom has not been independently verified. No paid add-ons, plan changes, increased spend settings or unrelated resources are authorized by this proposal.

Approval must explicitly cover the project name, region, linking/configuration and any accepted resource charges. If only free creation is approved and no free allocation exists, stop without provisioning. Diagnostic deployment, paid execution and production activation each retain their separate approval gates.

## Migration conflict identified before staging creation

Migration `20260919000200_ges_onboarding.sql` is a data-only seed containing real GES company information. Applying the complete chain unchanged would violate the instruction to use synthetic staging data only. Preview's existing shared Supabase configuration would also be unsafe for this purpose.

Proposed resolution: bootstrap staging with the unchanged schema migrations **001, 003, 004 and 005**, recording their exact checksums. Explicitly exclude data-only migration **002** from the staging migration set, with an exclusion manifest; do not falsely mark it executed and do not edit production migration history. Compare the resulting schema, RLS, grants, functions and triggers with the reviewed schema baseline. Populate only synthetic fixtures. This yields schema parity without copying company data; it is an explicit exception to byte-for-byte migration-history parity and is included in the approval proposal.

An offline staging package builder is now implemented: `npm run staging:prepare`. It pins the reviewed migration inventory and SHA-256 checksums after UTF-8/LF line-ending normalization, includes only 001/003/004/005, and writes the exclusion manifest beside those files. It rejects changed or unexpected migration files, altered output, symlink redirection and linkage files in its output directory. It performs no database connection or migration application. The future hosted apply step must additionally verify an explicitly approved staging project reference; this local builder is not permission to apply SQL or create/link resources.

## Work after staging approval

Provision/link the approved isolated resources, prepare and verify the staging bootstrap, then configure staging before deployment. Run real JWT/browser role tests and revocation/source-link tests. Run concurrent reservations with synthetic enabled staging settings and a mocked provider; production settings remain disabled. Include user/org caps, duplicates, sliding-minute boundaries, cancellation/failure and nonrefundable reservations. Re-run relevant static, database, browser, build, secret and dependency checks and record actual results.

Design and review the fixed-payload provider diagnostic separately. The existing OpenAI secret is Production-only and must not be copied into staging, so an operator-only staging diagnostic cannot simply inherit it. A viable approved server-runtime mechanism must be established without secret export; until then the provider test remains blocked. Do not add a public/general-purpose proxy. Request diagnostic-deployment approval only after its concrete implementation/design is reviewable, then request paid-request approval immediately before execution.

Prepare operational sign-off for provider data handling (supported by current official documentation), log access and retention, usage metadata cleanup, pilot users/roles and incident handling. The handoff reports automatic reload enabled with no monthly reload limit; document that application quotas do not cap other project-key usage or account-wide reloads, and leave those settings unchanged.

## Pilot and rollback boundary

No pilot enablement is proposed for immediate execution. After every gate passes, identify one exact approved organization UUID, reviewed fact classifications and low pilot limits. Obtain separate approvals for organization/global enablement and production deployment. Keep anonymous paid AI disabled and preserve the no-live-procurement disclosure.

Emergency disable remains: set the global AI switch disabled and redeploy under authorization; an authorized operator may disable the explicitly selected organization for runtime checks. Preserve usage reservations and restrictive RLS/grants. An application rollback must not drop tables, restore broad fact access or restore TRUNCATE privileges. Staging cleanup must target only recorded synthetic IDs in the verified staging project; never delete production data.

## Current gate

Awaiting approval to create and link the proposed staging resources, including the recommended region, cost basis and exclusion of the real-company seed. No new JWT, concurrent-quota or provider result is claimed at this gate. Production remains disabled.

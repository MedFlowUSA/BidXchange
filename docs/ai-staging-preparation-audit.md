# Staging preparation audit

## Outcome

Prepared and locally tested a schema-only staging package. Production AI remains disabled. No cloud resources were created or linked, no database migrations were applied, no deployment occurred and no provider key was retrieved or API request sent. Resource creation/cost approval remains pending under the user's rollout instructions.

## Findings and work completed

1. **Real-company seed in the normal migration chain.** Migration 002 contains GES onboarding data. A blind staging migration push would introduce real company information. The new builder explicitly excludes it, records that exclusion, and never marks it executed. Production migration files/history remain unchanged.
2. **Preview shares production Supabase variable definitions.** This remains an external configuration blocker. Before the first staging deployment, configure staging branch-specific Supabase values and verify the effective target. No variable values were read or changed in this work.
3. **No verified staging package previously existed.** Added a pinned manifest and offline builder that checks the entire source inventory and normalized checksums. Unknown migrations require a new review. Existing output must exactly match expected contents; unexpected files, project linkage and symlinks are refused. There is no overwrite/delete or cloud-connection operation.
4. **Provider diagnostic still has a placement conflict.** The available OpenAI secret is Production-only and may not be copied to staging. Preparing the schema does not solve that constraint. A separately approved operator runtime is still required; no public diagnostic endpoint or proxy was added.

## Artifacts

- `scripts/staging/migrations.json`: reviewed inventory, include/exclude decisions, SHA-256 checksums using UTF-8 with LF line endings.
- `scripts/staging/prepare.mjs`: offline validation/package command, accepting no CLI target or credentials.
- `scripts/staging/prepare.test.mjs`: tamper/inventory/linkage/exclusion checks and isolated PostgreSQL schema rehearsal.
- `package.json`: `staging:prepare` and `test:staging` commands.
- `docs/ai-staging-proposal.md`: updated implementation status and limitations.
- Generated ignored directory: `.tmp/bidxchange-staging-package`, containing four SQL files, manifest and README. No environment files, project linkage, auth users or company seed are included.

The new files and earlier validation additions remain local and uncommitted. Unrelated `.gitignore` changes and the older audit artifact were preserved.

## Validation executed

`npm run test:staging`: **5 tests passed**. Checks cover idempotent package creation, changed checksum/new migration rejection, missing exclusion metadata rejection, existing linkage/output tamper rejection, and isolated schema construction. The rehearsal verified 31 RLS-enabled public tables, 111 policies, empty organization/membership/fact/AI tables, revoked authenticated TRUNCATE privileges, hidden prompt digests and a private document bucket. The excluded real-company seed was never executed.

`npm run staging:prepare`: passed; generated only migrations 001, 003, 004 and 005. This is an offline artifact, not an applied migration or proof of hosted JWT/concurrency behavior.

Formatting and source-secret checks were run for the final changes. Application runtime files and dependencies did not change, so the previously reported browser/build results were not rerun or relabeled as current results. Tests remain local and incur no provider charges.

## Next authorized work and pending approvals

The smallest next external step remains creating/linking the named `bidxchange-staging` project in the approved region/allocation and configuring its isolated Preview branch. That requires explicit resource/cost approval. Afterward, add a target-verified apply tool for this package, prove schema parity, configure synthetic identities and execute real JWT/revocation/concurrent-quota checks. Keep production disabled.

The package builder does not guard arbitrary manual SQL execution; its safety boundary is local preparation only. Never apply from the root production-linked migration directory to staging. Future remote automation must verify the staging project independently and refuse the production project before connecting or writing.

Activation recommendation remains **NO-GO** until hosted security checks, the separately approved provider test and operational sign-off are complete. No new production activation approval is implied by this audit.

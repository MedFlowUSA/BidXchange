# AI activation checkpoint — September 19, 2026

AI remains disabled. No paid OpenAI request was made, no credits were purchased, and no billing or recharge setting was changed. BidXchange still has no live procurement search.

## Repository and release

Reviewed baseline: `1cc0d92`. Security repair: `7e8361a`, pushed to `main`. Application TypeScript is unchanged in this checkpoint. The repair changes migration 005, its database regression suite, `docs/database.md`, and `docs/ai-operations.md`. This report records the checkpoint separately.

Existing user changes to `.gitignore` and the untracked `docs/BidXchange_Audit_for_ChatGPT_2026-09-19.md` were preserved and excluded from commits and deployment. Deployment uses an archive of the committed snapshot.

Production deployment `dpl_EoMimSMhCeXSPzVNLrEbge9o5Nz2` is READY at [bidxapp.vercel.app](https://bidxapp.vercel.app/), built from `7e8361a` with the completed Production configuration. Live checks passed for the homepage, disabled fictional assistant, mobile layout, protected-route sign-in redirect, anonymous assistant/status/usage denial, citation authorization and existing demo navigation. This report supersedes historical migration/deployment status in the implementation-phase completion notes. The subsequent report-only commit does not change deployed application behavior.

Review covered the repository inventory, web AGENTS instructions, architecture/security/AI documentation, migrations 001–005, server configuration/authentication/routes, tools/disclosure policy, engine, source links, client conversation handling, database tests, browser tests and deployment configuration.

## Environment and provider

Production presence was verified through Vercel metadata only:

| Variable                       | Presence                               |
| ------------------------------ | -------------------------------------- |
| OPENAI_API_KEY                 | Present, secret; value never retrieved |
| OPENAI_MODEL                   | Present                                |
| BIDXCHANGE_AI_ENABLED          | Present                                |
| BIDXCHANGE_AI_DEMO_ENABLED     | Present                                |
| BIDXCHANGE_AI_DAILY_ORG_LIMIT  | Present                                |
| BIDXCHANGE_AI_DAILY_USER_LIMIT | Present                                |
| SITE_URL                       | Present                                |
| SUPABASE_URL                   | Present                                |
| SUPABASE_PUBLISHABLE_KEY       | Present                                |

Selected model: `gpt-5.6-luna`. The two switches were explicitly set disabled and documented daily limits were configured. No environment values or credentials are reproduced in this report. The API key's validity, project association, expiry and permissions have not been independently verified; those details remain user-reported. Billing/credits remain unconfigured according to the handoff, not a fresh billing-dashboard inspection.

## Production migration and security repair

Applied identifier: **20260919000500**, file `20260919000500_ai_readonly.sql`, to linked Supabase project `bcrxejydosltquspsutw`. Reviewed file SHA-256 at application time: `12d89864cc831d7f5ffa819a38a5d01c7c38aa1903f4974d102f46c81911c0ca` (local file bytes).

Preflight confirmed migrations 001–004 and compared production catalogs with an isolated database built from the local migrations. All 263 columns, 109 policies, 7 private functions, 141 constraints, 58 triggers and 29 RLS tables matched. PostgreSQL-version differences in NOT NULL catalog representation and array decoding were normalized; nullability was independently compared with the columns.

One verified defect required repair: production retained eight excess authenticated grants on `organizations` and `organization_memberships`. Migration 005 now removes TRUNCATE/TRIGGER/REFERENCES on both tables and INSERT/DELETE on organizations, preserving intended application permissions. The local regression reproduces the broader hosted grants before applying the repair. No destructive privilege was exercised in production.

Postflight confirmed all five migration identifiers, 275 columns, 111 policies, 9 relevant functions, 152 constraints, 112 ordinary-role table grants, 58 triggers and 31 RLS tables matching the migrated local database. Separate live metadata checks confirmed anonymous RPC execution denial, hidden prompt digests, readable authorized metadata, and no direct authenticated accounting inserts or activation updates. Both AI tables contain organization ownership; accounting authorship comes from `auth.uid()`, with no browser write/reassignment grant. AI settings and usage tables both had zero rows. The private document bucket remains private with zero client storage policies.

Only one active administrator membership existed during compatibility review; no current lower-role user loses a company view. Unknown facts remain excluded from AI for every role. Future lower-role views require explicit safe classification. No unrelated users, memberships or company records were changed. Rollback keeps additive tables and restrictive permissions, disables AI, and redeploys reviewed application code; it must not restore broader reads or TRUNCATE privileges.

## Security boundaries reviewed

The key is read by a `server-only` module and supplied only to the server SDK. No public-prefixed key, client prop, raw provider error or prompt/evidence logging path was found. Responses use sanitized errors and metadata-only logs. Scans found no credential patterns in 119 tracked/unignored files, seven reachable Git commits (523 file revisions), or 16 generated browser artifacts. These are pattern/code checks, not proof against every possible encoding or a review of external historical logs. The secret itself was never fetched for comparison.

Tools use the authenticated session, organization filters, RLS, strict schemas and bounded allowlisted fields. There are no bid submission, pricing mutation, verification, approval, role/membership, deletion, messaging, SQL, web or private-document tools. Unknown facts fail closed; classified sensitive facts are available only to authorized sensitive-data roles. Other sensitive tables and source notes are not queried by the assistant. Citation pages reauthorize records. AI has no persisted conversation store or separate export endpoint; copying only uses the already-authorized answer. Public demo content is fictional and cannot invoke paid AI.

The model selects evidence; generated factual prose and instructions are discarded. Server code determines dates, expiration, permissions and freshness. Real eligibility/scoring remains explicitly unevaluated. Manual records, unavailable synchronization, missing evidence and human review are disclosed. Database reservations enforce tenant/user limits and duplicates before provider work; missing settings deny access. Configuration, provider errors, cancellation and outages fail without releasing unvalidated output. Actual key/billing failures were not exercised against OpenAI.

## Executed validation

| Check                                                                        | Result                         |
| ---------------------------------------------------------------------------- | ------------------------------ |
| Formatting, ESLint, TypeScript                                               | Passed                         |
| Playwright, AI tools, role disclosure, injection, cancellation, error states | 72 passed; OpenAI mocked       |
| AI database suite after repair                                               | 41 passed                      |
| Existing tenant/isolation database suite                                     | 251 passed                     |
| Production build                                                             | Passed locally and on Vercel   |
| Source/history/browser-artifact secret checks                                | Passed within scope above      |
| Dependency audit                                                             | Zero reported vulnerabilities  |
| Production catalog and protected-grant checks                                | Passed; read-only verification |

Local database tests use isolated PGlite with auth/storage stubs. They do not prove hosted JWT/PostgREST behavior or multiprocess quota contention. No production fixture users were created. The source scan initially hit sandbox process restrictions; its authorized rerun passed.

## Remaining activation steps

Billing is **not the only remaining gate**:

1. Manuel confirms billing/credits and approved project spend controls privately in OpenAI. This checkpoint does not purchase or change them.
2. Complete hosted staging checks for real sessions across roles, membership revocation, classified facts, concurrent quotas and source links. Review provider data handling, log access/retention and the usage-metadata cleanup schedule.
3. Obtain explicit approval for one isolated synthetic provider request with no tenant data. Validate key/model access, usage and failure handling while production AI remains disabled.
4. Review the exact pilot organization UUID, fact classifications and pilot limits. Do not bulk-classify unknown facts. Organization enablement requires its own explicit approval; none has been performed.
5. Only after those checks, obtain explicit approval to enable the global switch, enable the selected organization, redeploy and run a bounded authenticated pilot. Keep the public demo unpaid and procurement-feed claims unchanged.

Existing wider operational concerns, including privileged MFA, hosted recovery/restore rehearsal and production monitoring, remain documented in `security.md`; this checkpoint does not resolve them.

## Proposed smallest paid test — not executed

One Responses request: model `gpt-5.6-luna`, input `Reply with OK.`, `store:false`, `reasoning.effort:none`, `max_output_tokens:32`, no tools, no history, no tenant data and zero SDK retries. Confirm total input stays under 1,000 tokens before sending. Do not enable the application just to run this isolated test.

At the [official model pricing](https://developers.openai.com/api/docs/models/gpt-5.6-luna) reviewed for this checkpoint, input is $0.20/million and output $1.20/million; cache writes can cost 1.25 times the input rate. A conservative estimate using 1,000 input tokens at $0.25/million plus 32 output tokens is **$0.0002884**, below **$0.001** before taxes. This is an estimate for that bounded single request, not a platform billing cap or an estimate for the multi-round application assistant. Requested future approval should explicitly permit that one request with an estimated ceiling of $0.001. No such request was sent.

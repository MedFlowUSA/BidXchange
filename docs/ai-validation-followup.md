# BidXchange AI validation follow-up

September 19, 2026, America/Los_Angeles. Recommendation: **NO-GO for production activation**. Production AI and anonymous paid AI remain disabled. No billing changes, deployments, key retrievals or paid requests were performed.

## Inspected state and scope

Repository HEAD is `deaa512`. Production is READY at https://bidxapp.vercel.app, deployment `dpl_E471XMezx85L3kkCC82MwwdUdXzE`. Supabase project `bcrxejydosltquspsutw` contains migrations 001–005. Read-only catalog comparison still matches the reviewed baseline: 31 RLS tables, 111 policies, 275 columns, 152 constraints, 58 triggers, 112 ordinary-role table grants and nine relevant functions. AI settings and usage tables are empty after validation; the existing active administrator count remains one. Private storage remains closed.

No repository-root AGENTS.md exists. The web AGENTS.md was read completely. Review covered AI architecture/security/runbooks, migration 005 and prior migration dependencies, session/tenant authorization, disclosure policy, tools, deterministic statuses, source routes, quota reservation, accounting, feedback, browser conversations and available test/deployment tooling. Existing `.gitignore` changes and the untracked older audit document were preserved.

The handoff now reports $10 purchased credits and automatic reload ON ($10 reload, $5 trigger, no monthly reload limit). This supersedes the older report's unfunded status. These are user-reported account facts, not an independent billing-dashboard verification. Neither billing nor reload settings were changed.

## Synthetic provider test

**Not run.** No response/status/model-used/token-usage result exists; task-incurred OpenAI cost is $0. The requested payload is prepared below:

```json
{
  "model": "gpt-5.6-luna",
  "input": "Reply with OK.",
  "store": false,
  "reasoning": { "effort": "none" },
  "max_output_tokens": 32
}
```

The current deployment has no operator-only synthetic-test execution path. Its application route requires activation and tenant context. Available tools do not provide arbitrary execution inside that existing deployed runtime. Pulling the Vercel environment would retrieve the key, which is prohibited. A new server-side execution path would require separately approved deployment; no endpoint was added or deployed. Consequently, no paid-request approval was requested prematurely. Approval must be requested immediately before a viable single request is sent, with no retries/tools/history/tenant data and no persisted response. A provider success would not authorize production activation.

The earlier pricing estimate for this exact bounded request remains below $0.001; reconfirm pricing before seeking execution approval. The test must use the existing secret inside the approved server runtime, never export it to a local shell or dashboard transcript.

## Executed commands and results

| Command                                     | Result                                                             |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `npm run format:check`                      | Passed                                                             |
| `npm run lint`                              | Passed                                                             |
| `npm run typecheck`                         | Passed                                                             |
| `npm test`                                  | 81 passed; provider mocked throughout                              |
| `npm run test:ai:database`                  | 41 passed in isolated PostgreSQL/PGlite                            |
| `npm run test:security:local`               | 251 passed in isolated PostgreSQL/PGlite                           |
| `node scripts/test-ai-hosted-disabled.mjs`  | 39 passed against linked production, rollback-only                 |
| `npm run build`                             | Passed; no deployment                                              |
| `npm run test:secrets`                      | Passed; tracked/unignored source scan                              |
| `npm audit --json`                          | Zero reported vulnerabilities                                      |
| `node .tmp/assistant-deploy-smoke.mjs`      | Seven live smoke groups passed                                     |
| `node .tmp/ai-postflight.mjs`               | Read-only production catalog comparison and empty AI tables passed |
| `vercel inspect https://bidxapp.vercel.app` | Existing deployment READY                                          |
| `vercel env ls production`                  | Required names present; API key hidden and never retrieved         |
| `supabase projects list --output json`      | No dedicated BidXchange staging project found                      |

The first hosted attempt failed while seeding duplicate synthetic fact labels (SQLSTATE 23505). All its fixtures were rolled back. Labels were corrected to include sensitivity, and the complete rerun passed. This was a test-fixture defect, not an application failure.

Hosted assertions ran as authenticated/anonymous database roles with synthetic session claims. Operator SQL was used only to seed fixtures and change the synthetic membership under test; no service-role API key was used to bypass assertions. All writes occurred inside one transaction ending in ROLLBACK. No schema migration, organization activation, real company data mutation, persistent test account or model request occurred. Rollback was verified by querying the exact fixture IDs.

## Findings by boundary

**Tenant isolation:** Hosted viewers/contributors could not read foreign facts, opportunities, organizations, AI settings or usage metadata. Guessing a foreign opportunity UUID returned no record. Foreign reservations and feedback were denied. Local tool tests reject extra scope arguments and apply server-provided organization filters; browser request roles are rejected. The selected organization ID is accepted only after session membership validation, never as authorization by itself.

**Role disclosure:** Hosted fixtures cover unknown facts, explicitly safe licenses and restricted insurance, bonding, personnel, subcontractor, pricing and private-document fact categories, including pricing mislabeled workspace. Viewers/contributors saw only the safe license. Local tests cover all application roles and indirect readiness/citation disclosure. Unknown sensitivity is excluded from AI for every role. Source notes and private documents are outside the tool queries. Hosted checks exercise classified facts, not every separate sensitive table through actual JWT sessions; full API/browser role coverage remains outstanding.

**Membership/conversations:** Hosted suspension immediately prevented new reservations, protected record/usage reads and feedback. Mocked UI checks passed for clearing question/answer history on revoked status, role changes and page suspension; neither localStorage nor sessionStorage held conversation data. There is no server conversation store. Existing authorized browser content is cleared on a status check (15-second polling or focus), not magically erased at the instant of remote revocation. New requests are independently reauthorized server-side.

**Quotas:** Isolated SQL tests passed for daily caps, duplicate UUID/digest rejection, fail-closed settings, accounting ownership, no forged accounting or refunds and protected digests. Hosted checks confirm ordinary users cannot raise limits or reassign accounting. Accounting fixture rows were operator-seeded solely for access tests; this does not claim a hosted successful reservation. Concurrent paid-cap enforcement and all minute-boundary races remain unexecuted: they require a suitable staging environment with synthetic enabled settings. Production organization settings were never enabled, even temporarily.

**Grounding/citations:** Local tests verify scoped evidence, unknown-source rejection, manual entry/freshness and deterministic expiration/timezone behavior. Output prose from the model is discarded in favor of authorized extracted fields; live source pages reauthorize record access. No live procurement feeds exist. Real eligibility/fit remains explicitly unevaluated. Tools expose no SQL, writes, approvals, verification, pricing mutation, messaging or bid submission. Tool/prompt/schema budgets are exercised locally; provider output-token behavior is not live-validated.

**Injection:** Eleven mocked retrieved-text variants cover instruction override, other-tenant/restricted facts, system prompt, SQL, service-role key, verification, pricing, submission and external sending. Tests establish application-side tool/output boundaries; they are not measurements of the live selected model's attack resistance. No malicious instruction was executed.

**Public demo:** Live checks passed for disabled demo, homepage, mobile layout, protected-route redirect, anonymous assistant/status/usage denial, protected citation access and existing demo navigation. Local tests verify fictional labeling and guest workspace isolation. Suggested questions interpolate the selected company name; no production GES records are supplied to the fictional assistant.

**Errors/logs/privacy:** Provider failures are sanitized; prompts, tool evidence and raw provider errors are not intentionally logged by the reviewed paths. Tests cover mocked outage, timeout, cancellation, malformed output and disconnect states. No external historical log audit or real invalid-key/billing failure was performed. Successful source scanning is not proof against every possible secret encoding.

## Changes and remaining gates

Local changes only, not committed/pushed/deployed:

- `scripts/test-ai-hosted-disabled.mjs`: repeatable rollback-only hosted checks; refuses a different linked project or connection override.
- `tests/ai-tools.spec.ts`: three additional injection cases.
- `tests/assistant-stream.spec.ts`: access-change/page-suspension conversation privacy checks on desktop and mobile.
- This report.

No application security defect was newly reproduced, and no application code or migration was changed. The prior excess-grant repair remains applied and matched in the catalog review.

Remaining blockers: dedicated authorized hosted staging with real JWT/browser sessions; concurrent quota tests; a secure operator execution path and explicit approval for the single provider request; provider key/model validation; and operational sign-off for log/usage retention, provider data handling and pilot access. Existing wider MFA/recovery/monitoring concerns remain documented in `security.md`. Funding alone does not resolve these gates.

No dedicated BidXchange staging environment was identified. A project name/reference was requested; no credentials are needed in chat. Other products' staging databases must not be repurposed. `scripts/test-auth.mjs` and the broader `--linked` AI suite were not run because they use a different fixture/activation workflow. No concurrency or hosted authenticated-app result is claimed.

## Environment and local commands

Required Production names, all confirmed present: `OPENAI_API_KEY`, `OPENAI_MODEL`, `BIDXCHANGE_AI_ENABLED`, `BIDXCHANGE_AI_DEMO_ENABLED`, `BIDXCHANGE_AI_DAILY_ORG_LIMIT`, `BIDXCHANGE_AI_DAILY_USER_LIMIT`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SITE_URL`. No values are reproduced here. Model selected for the future test: `gpt-5.6-luna`.

Launch locally with existing local Supabase configuration; do not pull the Production secret:

```powershell
$env:BIDXCHANGE_AI_ENABLED='false'
npm run dev
```

Run the validation commands from the table individually. The hosted rollback-only command additionally needs the existing trusted database CA:

```powershell
$env:NODE_EXTRA_CA_CERTS=(Resolve-Path '.tmp/supabase-ca.crt').Path
node scripts/test-ai-hosted-disabled.mjs
```

The `.tmp` smoke/catalog scripts are existing local diagnostic artifacts, not portable checked-in test commands. The new hosted script is in `scripts/`; it intentionally has no paid-provider execution path. A production build can be served locally using `npm run build` followed by `npm run start`, with the global AI flag still disabled.

## Follow-up prompt — use only after all gates pass

```text
Review the latest BidXchange validation report and verify that hosted JWT/role,
revocation, concurrent-quota and approved synthetic provider checks all passed.
Stop if any result is missing. Confirm the exact pilot organization UUID and
approved daily limits from my instructions; do not infer them from a name.
Present the precise organization/global activation and deployment changes for
my explicit approval before executing them. Keep anonymous paid AI disabled,
leave billing/reload unchanged, preserve all tenant controls, and make no claim
of live procurement search. After the approved rollout, verify the bounded
pilot behavior and report usage plus the disable/rollback procedure.
```

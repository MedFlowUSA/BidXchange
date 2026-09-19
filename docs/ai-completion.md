# AI implementation report — September 19, 2026

## Outcome

Implemented the first read-only, tenant-scoped BidXchange assistant in the existing app. It is **not activated or deployed to production**. Local inspection confirmed all six AI environment variables are unset. Model choice remains a user decision; no model name or key was invented. No real API credits were spent.

The architecture uses the official server-side OpenAI SDK, Responses function calling, explicit disclosure policy, strict schemas, bounded queries, independent RLS and reauthorized citations. The model selects evidence; server-rendered facts prevent generated prose from changing qualification or inventing claims. No live procurement feeds, private documents, pricing changes, approvals or submissions are available.

Added `/assistant`, `/assistant/sources/[kind]/[id]`, `/api/assistant`, `/api/assistant/status`, `/api/assistant/feedback` and `/api/assistant/usage`. Dashboard and record pages have contextual panels; navigation has Assistant. The UI includes suggestions using the selected company name, private tab-memory conversation list, progress streaming, cancel/retry, citations, copy and feedback. The public demo is scripted fiction behind its own flag and cannot consume paid AI. Deadline displays include years; the broken demo back-link character is fixed. Homepage wording remains accurate for disabled production AI.

## Database and security

Created `20260919000500_ai_readonly.sql`, tested locally but **not applied to the linked project**. It adds explicit fact sensitivity, narrows lower-role fact reads, and creates organization AI settings and usage metadata with RLS. Unknown facts stay excluded from the model for all roles. No notes/document contents enter retrieval. Usage reservation and feedback functions do not expose business writes or service-role credentials.

Conversations are not persisted. No conversation/message/citation tables, shared history or stored prompts are added. User/role changes are rechecked during requests and periodically in the UI. Failed/cancelled work remains charged. Operational token totals are logged only on successful completed runs and require provider-billing reconciliation.

Limits: 3 requests/user/minute, 10/organization/minute, configurable daily ceilings, 3,000-character questions, 6 requested tool calls, 40 retrieved rows per evidence phase, 1,800 output tokens per provider round, 7 rounds and 45-second timeout. Tool-result JSON is capped at 24,000 characters and provider input history at 90,000 characters. Citation reauthorization performs additional bounded reads. No automatic provider retry occurs.

The 12 implemented tools, field restrictions, citation contract and deterministic boundaries are listed in [AI documentation](ai-assistant.md). The production scoring engine does not exist; the assistant reports this instead of repurposing fictional scoring. All original audit concerns outside this scope remain documented, including MFA, complete verification invalidation and operational recovery.

## Executed validation

| Check                                             | Result                                                |
| ------------------------------------------------- | ----------------------------------------------------- |
| Combined unit and desktop/mobile Playwright suite | 72 passed, 59.7 seconds                               |
| New AI migration/RLS suite                        | 34 checks passed in isolated PostgreSQL               |
| Existing database/security regression suite       | 251 checks passed in isolated PostgreSQL              |
| Production Next.js build                          | Passed                                                |
| TypeScript                                        | Passed                                                |
| ESLint                                            | Passed                                                |
| Prettier                                          | Passed                                                |
| Expanded secret scan                              | Passed, 119 tracked and unignored files               |
| Dependency audit                                  | Zero vulnerabilities                                  |
| Real OpenAI requests                              | Not run; all model tests mocked                       |
| Hosted authenticated AI / concurrency tests       | Not run; activation gate                              |
| Linked Supabase mutation rehearsal                | Blocked before execution by automatic approval review |

The blocked rehearsal would have temporarily changed the linked production-like database, despite rollback. Validation instead used local PGlite PostgreSQL with minimal auth/storage stubs and actual application migrations. These tests exercise real SQL/RLS semantics but do not prove hosted authentication, PostgREST or multi-process concurrency. No production users or data were changed.

## Files

New application files:

- `apps/web/app/(workspace)/assistant/page.tsx`
- `apps/web/app/(workspace)/assistant/sources/[kind]/[id]/page.tsx`
- `apps/web/app/api/assistant/route.ts`
- `apps/web/app/api/assistant/status/route.ts`
- `apps/web/app/api/assistant/feedback/route.ts`
- `apps/web/app/api/assistant/usage/route.ts`
- `apps/web/components/assistant.tsx`
- `apps/web/components/assistant.module.css`
- `apps/web/components/assistant-usage.tsx`
- `apps/web/lib/ai/config.ts`
- `apps/web/lib/ai/contracts.ts`
- `apps/web/lib/ai/display.ts`
- `apps/web/lib/ai/engine.ts`
- `apps/web/lib/ai/policy.ts`
- `apps/web/lib/ai/read-body.ts`
- `apps/web/lib/ai/server.ts`
- `apps/web/lib/ai/tools.ts`

Updated application/configuration: `.env.example`, `package.json`, `package-lock.json`, `playwright.config.ts`, `apps/web/app/robots.ts`, `apps/web/components/app-shell.tsx`, `tenant-workspace.tsx`, `workspace.tsx`, `apps/web/lib/route-view.tsx`, and `routes.ts`. Removed the obsolete `apps/web/components/ai-preview.tsx` placeholder.

Database/testing: migration 005; new `scripts/local-test-db.mjs`, `scripts/test-ai-database.mjs`, `tests/ai-tools.spec.ts`, `tests/assistant-ui.spec.ts`, `tests/assistant-stream.spec.ts`, `tests/fixtures/assistant-harness.tsx`, `tests/fixtures/link.tsx`; updated `scripts/test-database.mjs` and `scripts/scan-secrets.mjs`.

Documentation: updated `README.md`, `docs/security.md`; added `docs/architecture.md`, `docs/database.md`, `docs/ai-assistant.md`, `docs/ai-operations.md`, `docs/adr/003-readonly-ai-assistant.md`, and this report. The pre-existing full audit remains a separate untracked local artifact.

## Activation requirements and limitations

Required variables: `OPENAI_API_KEY`, `OPENAI_MODEL`, `BIDXCHANGE_AI_ENABLED`, `BIDXCHANGE_AI_DEMO_ENABLED`, `BIDXCHANGE_AI_DAILY_ORG_LIMIT`, `BIDXCHANGE_AI_DAILY_USER_LIMIT`. Existing Supabase settings and `SITE_URL` remain necessary. Keys must be configured server-side, not pasted into chat.

Before activation, approve a hosted staging/production migration target, validate real authenticated roles and concurrent limits, review fact classifications, configure the selected model/project key and spend controls, define operator metadata/log retention, enable an explicit organization setting and perform an authorized synthetic provider smoke test. See [operations](ai-operations.md).

This phase provides extracted evidence and fixed human-review guidance rather than fluent generative recommendations or persistent multi-turn memory. Requirement text and source notes remain excluded. No official publication dates, live-source coverage, secure document pipeline or production qualification engine are claimed. No deployment was triggered while these gates remain unresolved.

Exact local launch command:

```sh
npm run dev
```

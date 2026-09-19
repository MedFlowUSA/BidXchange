# BidXchange read-only assistant

## Release state

This is an evidence-selection assistant for existing structured workspace records, not live procurement search. Application implementation is behind a global environment switch and an operator-controlled organization switch. Neither credentials nor a model are supplied by source code. Missing configuration or migration fails closed. The public homepage continues to describe AI as planned until a configured production rollout is verified.

The first release deliberately renders extracted database fields, not unrestricted generated factual prose. The model chooses read-only tools and relevant evidence keys. Its freeform answer text, risks and recommendations are discarded; the server supplies source-backed record summaries, deterministic status/freshness fields and fixed human-review guidance. This limits fluent synthesis, but prevents a model from fabricating a qualification, deadline, citation, approval or award. Questions are independent; earlier conversation text is not resent to the model.

## Data flow and boundaries

1. The authenticated browser sends a bounded question, request UUID, selected organization UUID and optional opportunity/pursuit context ID to `POST /api/assistant`.
2. A server-only Supabase session validates the user, active membership, organization state and actual role. Browser claims of role, extra fields, demo IDs and invalid UUIDs are rejected. Origin is restricted to configured `SITE_URL` in production.
3. Context IDs are retrieved with both organization scope and RLS. No ordinary request uses a service-role key.
4. `reserve_ai_request` serializes organization and user reservations in PostgreSQL, checks activation, duplicates and limits, charges one request, and records an audit event without prompt content.
5. The official OpenAI JavaScript SDK calls the Responses API with explicit model, `store:false`, strict function schemas, bounded output and zero automatic retries. Only the approved structured tool results are supplied. No built-in web, file, computer or shell tool exists.
6. Membership and role are rechecked before each model/tool round and before completion. Organization activation is checked again. Citation records are refetched under current RLS/disclosure rules before release.
7. The browser receives NDJSON progress events and a validated answer event. Raw model deltas never leave the server. Cancellation aborts the provider request; the daily reservation remains charged.

The selected organization remains visible. Citation links open `/assistant/sources/[kind]/[id]?organization=...`, which reauthorize and fetch individual records without the existing workspace's 500-record list cap. Source pages expose only approved fields. They never open private storage or external source URLs.

## Disclosure policy

`lib/ai/policy.ts` is the centralized application policy. Migration `20260919000500_ai_readonly.sql` adds `profile_facts.sensitivity` with `unknown`, `workspace`, and `restricted`. Existing and new rows default to `unknown`; no GES fact is automatically classified or verified.

- Unknown sensitivity: excluded from AI for every role. Database reads remain available only to administrator, executive approver and estimator for review.
- Workspace sensitivity: viewer/contributor/capture-manager AI access is limited to explicitly allowed identity, license, registration, NAICS, service territory, capability and certification fact types.
- Restricted sensitivity: only administrator, executive approver and estimator may receive classified facts.
- Source notes, source references, arbitrary fact notes, document contents/metadata, pricing, proposal text and free-text requirement descriptions are excluded from tools. Restricted-category fact types remain restricted even if accidentally labeled `workspace`.
- Audit tools return only opportunity-change metadata for administrator/executive roles; previous/next JSON and actor identities are excluded.
- Every query has an injected organization filter, explicit field selection, deterministic ordering and bounded records. No arbitrary SQL, table-name argument or cross-tenant search exists.

Operators must review the entire fact and intended audience before classifying it. Classification is not verification. This migration intentionally tightens existing fact visibility for lower roles; it does not loosen other RLS. A follow-up admin classification UI is not included.

## Tools

| Tool                           | Scope and limitations                                                        |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `get_workspace_summary`        | Application evidence boundary; no fabricated pipeline counts                 |
| `search_opportunities`         | Up to 10 manual records; optional title query and UTC added-today filter     |
| `get_opportunity`              | One authorized UUID, source metadata, deadline and freshness                 |
| `get_opportunity_requirements` | Requirement status metadata through authorized pursuits; text excluded       |
| `get_upcoming_deadlines`       | Deterministic future window of 1–90 days; at most 10 records                 |
| `get_company_readiness`        | At most 10 explicitly classified facts; no inference from omitted categories |
| `get_authorized_company_facts` | Same role/disclosure allowlist                                               |
| `get_pursuit`                  | One authorized pursuit, recorded status and pending decision                 |
| `get_pursuit_tasks`            | Optional authorized pursuit, deterministic overdue filter, at most 10 tasks  |
| `compare_opportunities`        | Exactly two authorized IDs; no invented fit ranking                          |
| `get_recent_record_changes`    | Up to 5 authorized opportunity audit metadata events; no addendum claims     |
| `create_bid_no_bid_briefing`   | Read-only opportunity/fact bundle; no decision saved                         |

All argument objects reject unknown properties. Record/title/value text is untrusted evidence, not instructions. String fields are capped at 1,000 characters and source titles at 200. Retrieved free text never controls tool names, SQL, authorization, links or write actions.

## Deterministic boundary and freshness

The existing fictional scoring engine remains unchanged. Failed or unknown demo eligibility continues to suppress scores. The real workspace has no implemented production eligibility/fit engine, so tools return `not_evaluated` and `fitScore:null`; no model score is substituted.

Expiration and future-effective status are computed in application code using UTC calendar dates. Deadline windows use UTC instants; displayed deadlines contain year and timezone with defensive UTC fallback for invalid legacy timezone strings. Records older than 30 days are marked stale where update metadata is available. A recorded verification state is not a guarantee of current legal eligibility.

Every current opportunity is treated as manual. Added-to-BidXchange and last-updated timestamps are distinct from official publication and source synchronization, both unavailable in this phase. No answer claims SAM.gov, Cal eProcure, PlanetBids, OpenGov, utility or other portal coverage.

## Citation contract

Each server-created citation includes key, source type, title, record UUID, source date when present, last update, status and authorized internal route. Model-selected keys must exist in the current tool evidence map. Unknown keys fail the entire answer closed. Missing evidence displays: “I could not verify that from the records currently available to BidXchange.” Source pages independently validate membership, role, organization, UUID and fact classification.

## Configuration and activation

Required server environment variables:

```text
OPENAI_API_KEY
OPENAI_MODEL
BIDXCHANGE_AI_ENABLED
BIDXCHANGE_AI_DEMO_ENABLED
BIDXCHANGE_AI_DAILY_ORG_LIMIT
BIDXCHANGE_AI_DAILY_USER_LIMIT
```

Existing `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SITE_URL` are also required for authenticated operation. No `NEXT_PUBLIC` secret is used. `OPENAI_MODEL` must be an explicitly selected available model supporting Responses, strict function calls and structured output. There is no default model or automatic model substitution.

`BIDXCHANGE_AI_DEMO_ENABLED=true` enables only scripted fictional responses. It does not authorize paid anonymous calls. Both feature switches default off. Automated browser tests explicitly enable the scripted demo and disable real AI.

Before production activation:

1. Review and apply migration 005 in an authorized staging project; validate hosted JWT/PostgREST behavior and concurrent requests there.
2. Review the fact-classification impact, then apply the forward migration through an authorized production change. Do not bulk-label unknown facts as safe.
3. Configure an OpenAI project key, explicit model, project spend controls and acceptable provider data-handling settings. Do not paste the key into chat or commit it.
4. Configure integer daily limits: organization 1–1000 and user 1–100. Start with low pilot limits.
5. An authorized operator inserts the selected organization into `ai_organization_settings` with `enabled=true` and reviewed ceilings. No automatic organization provisioning occurs.
6. Enable the global flag, perform an explicitly authorized synthetic paid smoke test, and review answers/citations with the intended roles.
7. Update homepage availability wording only after activation is verified; keep the no-live-feed disclosure.

## Limits and accounting

Daily boundaries are UTC. Database settings cap environment limits; clients cannot increase the database ceiling. Limits apply across instances using advisory transaction locks: 3 reservations/user/minute, 10/organization/minute, plus configured daily user and organization caps. A request UUID cannot be reused. The same user/workspace/question/context digest is blocked for two minutes; HMAC digests are not selectable by ordinary clients. Cancellation, timeout and model failure still consume the request reservation.

Maximums: 3,000-character prompt; 14,000-byte request body; 6 requested tool calls; 40 retrieved rows per evidence phase; 10 rows for ordinary lists; 1,800 output tokens per model call; 7 model rounds; 45-second provider work timeout; zero SDK retries. Final citation authorization may fetch up to 40 additional rows but does not resend them to OpenAI. Up to three concurrent user requests can be in flight under the minute cap.

`ai_usage_events` persists charged request counts and optional helpful/unhelpful feedback, not prompts or answers. Only the requester or active organization administrator can read usage metadata. There are no browser-controlled token/cost columns. Successful model token totals are logged server-side with request ID/model/timing. These logs are operational estimates, not an authoritative billing ledger; failed/interrupted provider work may incur cost without completed usage totals. Reconcile provider billing and set project spend limits before activation. Public RPC callers can consume their own quota without calling the model, but cannot refund or increase paid HTTP-route limits.

## Privacy, retention and failure modes

Conversations exist only in the current tab's React memory, maximum ten questions, private to that session. No conversation, message or citation table, browser storage, analytics prompt event or shared history is created. Reload/navigation/workspace change or Clear conversations removes that memory. Earlier answers are not model context. Users should clear the tab when leaving a shared device. Copy explicitly places the approved answer and citations on the clipboard; there is no administrator conversation export or history access surface.

Operational usage metadata should be retained for 30 days, then removed by a reviewed operator retention job outside the active quota window. No deletion job is silently provisioned. Existing immutable audit retention remains governed by the application's broader policy; this task does not delete audit history. Configure restricted hosting log access and a 30-day operational log retention before activation. Feedback is a single enum per owned request, no free text.

OpenAI requests use `store:false`; this does not by itself promise zero retention or eliminate provider abuse-monitoring records. Do not claim Zero Data Retention without confirmed project controls. No files, vector stores, background responses or provider conversation resources are created. See the official [Responses function-calling guide](https://developers.openai.com/api/docs/guides/function-calling) and [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

Missing configuration/migration/activation returns unavailable. Invalid input/tool calls/citations, role revocation, provider failure, empty/malformed responses and tool exhaustion fail closed with sanitized codes. Timeout/cancel propagate abort. Streaming statuses are safe progress labels; factual content is released only after validation. No silent retries occur. Partial factual output is not retained after a failed generation.

## Validation and evaluation plan

Executed on September 19, 2026: the combined unit/desktop/mobile suite passed **72 tests in 59.7 seconds**. The isolated AI migration/RLS suite passed **34 checks**, and the independent existing-schema suite passed **251 checks**. Production build, TypeScript, ESLint and formatting passed. The expanded secret scan passed across **118 files** before adding the final completion report. The dependency audit reported **zero vulnerabilities**. No real OpenAI request was made.

The linked Supabase rehearsal was rejected by automatic approval review before execution. It was replaced with isolated local PostgreSQL validation. Migration 005 has not been applied to production; no production users, memberships, organization records or document policies were changed. No production deployment or activation was performed for this phase.

Normal tests mock OpenAI and spend no credits. `npm run test:ai:database` uses isolated PGlite PostgreSQL with minimal Supabase auth/storage schema stubs and the actual migrations. It tests database RLS/functions, not hosted GoTrue/PostgREST behavior or true multi-process concurrency. `npm run test:security:local` exercises the existing schema regression suite independently. No test-only authorization path is compiled into application routes. Browser component tests bundle only the existing component in an intercepted test page; their network responses are mocked and do not establish real authenticated end-to-end success.

Adversarial coverage includes cross-tenant UUIDs, role restrictions and indirect fact leakage, fabricated citation keys, arbitrary SQL/write requests, eight retrieved prompt-injection strings, model prose attempting to override qualification, stale/manual/expired data, empty/malformed responses, revocation, cancellation and tool budgets. Browser tests exercise demo behavior, anonymous denial, responsive layout, keyboard access, unavailable/error/retry states and validated answer rendering.

Before each model change, use a synthetic staging dataset with empty/unknown/expired credentials, failed eligibility, contradictory records, missing deadlines, two tenants and all six roles. Review source completeness, retrieval relevance, uncertainty, no-feed disclosure, revocation and malicious record handling. Require zero cross-tenant/restricted disclosure and invented citations before activation. Test actual timeout, provider rate limiting, billing reconciliation, duplicate concurrent requests and admin disable during generation against the configured provider in a separately authorized smoke evaluation.

## Known phase limits

- Extractive evidence summaries, not freeform procurement advice or conversational memory.
- No live source ingestion, official publication tracking, addendum comparison or private documents.
- No real eligibility mathematics or fit scoring; the fictional engine is not repurposed.
- No permanent conversation sharing, provider history, document uploads or generated decision writes.
- Requirement text and source notes remain excluded pending a reviewed disclosure model.
- Existing audit findings concerning MFA, complete verification invalidation, hosted operational monitoring and broader workspace pagination remain separate work.
- Hosted authenticated integration, multi-process quota contention and a paid model smoke test remain activation gates; local mocks do not prove these.

## Local launch

```sh
npm ci
npm run dev
```

Open `/assistant?workspace=demo` for the fictional route or `/assistant?organization=<authorized UUID>` for a signed-in workspace. The assistant safely shows unavailable until configuration and the organization setting exist.

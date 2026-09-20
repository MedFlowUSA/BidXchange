# BidXchange staging validation — September 19, 2026

**Production recommendation: NO-GO pending the separately approved provider diagnostic and operational sign-off.** Dedicated staging and real-session authorization/concurrency checks are now implemented and passing. Production AI remains disabled; no OpenAI request or secret retrieval occurred.

## Resources and isolation

| Resource               | Verified result                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Supabase staging       | `bidxchange-staging`, `svimdvbgtltmyaubfaux`, `us-east-1`, Micro, healthy                            |
| Cost approval          | User approved approximately $10/month plus usage/taxes; no billing/reload settings changed           |
| Vercel                 | Existing `bidxchange` project, Preview, branch `staging`, protected by Vercel sign-in                |
| Staging URL            | https://bidxchange-staging.vercel.app                                                                |
| Tested mock deployment | `dpl_5SJef3cKCpkEqLr5LEvzVoTGygir`, staging commit `86c1fd2`                                         |
| Production             | https://bidxapp.vercel.app; root link remains `bcrxejydosltquspsutw`; application baseline `deaa512` |
| Staging credentials    | Separate Supabase publishable key; no OpenAI key in deployment metadata                              |
| Auth redirects         | Staging site URL and exact `/auth/callback`; original MFA/email controls restored and verified       |

The four reviewed schema migrations 001, 003, 004 and 005 were applied only to staging, after pinned LF-normalized checksum verification. The real-company data seed 002 was excluded under the approved proposal, not falsely marked applied. No production schema/data migration was performed.

Schema parity passed for 275 columns, 111 policies, 9 functions, 152 constraints, 112 grants, 58 triggers and 31 RLS-enabled tables. The private storage bucket and absence of storage-object read policies were verified. The local comparison omits the real-company seed entirely.

Both normal AI switches remain false. The final staging branch uses a deterministic test provider guarded by Preview environment, exact staging database/site URLs, a staging-only flag and absence of an OpenAI key. It has no provider SDK/network implementation. Its synthetic digest key is not an API credential. It fails closed in Production or if a provider key appears. All test organization AI settings were removed after testing. **Do not merge staging's provider/config replacements into production.**

## Real hosted results

The first completed disabled-mode run passed **99 checks**. The expanded keyless mock run passed **124 checks** using actual Supabase Auth users/JWTs, PostgREST/RPC requests, Vercel routes and Edge browser sessions. Operator database/service-role access was used for fixture setup, controlled state changes, independent accounting inspection and cleanup; access assertions used ordinary authenticated or anonymous clients.

All six supported roles were covered: organization_admin, executive_approver, capture_manager, estimator, contributor and viewer. There is no extra owner/manager role. Every role resolved permitted browser citations and streamed evidence through the real application. Privileged roles saw classified restricted facts; lower roles did not. Unknown sensitivity was excluded from every AI source/answer, even where a privileged user could review the underlying raw fact. Insurance, bonding, personnel, subcontractor and private-document metadata obeyed their RLS role boundaries. Private source notes were absent from evidence. There is no separate pricing subsystem; generic restricted fact coverage applies, with pricing mutation/injection covered in local tests.

Foreign opportunity/organization UUIDs exposed no records or citations. Browser-supplied roles were rejected. Anonymous access to tenant records, assistant status and quota execution was denied. Real membership suspension cleared an existing browser conversation on the next focus/status check, left no local/session storage history, and blocked further reservations. Removing membership denied new requests and previously authorized citation URLs from the same browser session. Revocation during generation prevented answer release. This does not erase content a person previously saw or captured; polling/focus clearing is not instantaneous remote erasure.

Concurrent quota results used independent HTTP requests and real user JWTs:

| Scenario                                        | Observed                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| One user, daily cap 2                           | Exactly 2 of 12 reserved; 10 rate-limited                          |
| Four users, organization daily cap 4            | Exactly 4 of 20 reserved; 16 rate-limited                          |
| Eight concurrent duplicate request IDs          | One reserved, seven duplicates                                     |
| Eight concurrent duplicate digests              | One reserved, seven duplicates                                     |
| Same user across two organizations, daily cap 2 | Exactly 2 of 12 reserved                                           |
| Rolling user minute                             | Exactly 3 of 8 reserved                                            |
| Rolling organization minute                     | Exactly 10 of 16 reserved                                          |
| Minute expiry                                   | Entries aged to 61 seconds no longer consumed the minute allowance |
| Provider failure and browser cancellation       | Both reservations remained charged                                 |
| Abandoned reservations                          | Still counted; browser could not refund or forge accounting        |
| Audit attribution                               | Every reservation matched its actual authenticated user            |

The minute-expiry test ages only synthetic fixture timestamps; it is not a wall-clock boundary stress test. Mock-provider tests validate application behavior, not the live model's accuracy or attack resistance.

## Findings and cleanup

1. An initial CLI Preview lacked the `githubDeployment=1` marker and inherited the existing default Preview connection instead of the staging branch overrides. The staging JWT check failed before any authenticated app write; staging fixtures had been created only through the explicitly guarded staging connection. The deployment was removed. The corrected deployment uses both GitHub metadata fields, and real staging identity checks now pass. No production user/session was used. This is why metadata alone was not accepted as proof of isolation.
2. A browser assertion initially expected underscores that the existing display helper converts to spaces. Assertions now normalize that presentation consistently, including private-note exclusion. No application change was needed.
3. Last-administrator protection prevents deleting the final active admin membership, even during operator cleanup. No trigger, grant or policy was weakened. Four disposable administrator shells from the completed/failed runs remain: four suspended synthetic organizations, four banned auth users and their protected memberships/audit metadata. All synthetic facts, business records, AI settings and usage rows were removed. Full fixture deletion is **not** claimed. Ignored per-run quarantine manifests record exact IDs; eventual removal needs a reviewed operator decommission path or approved staging-project deletion.
4. The old Supabase CLI's first attempted confirmation-free config preview applied local defaults. This briefly changed staging MFA/email defaults after fixture accounts had been banned. The original TOTP enrollment/verification, email confirmation, one-minute email interval and eight-digit OTP settings were restored. A second config push confirmed no drift. Production Auth was untouched.

The final database check found zero active staging organizations, zero staging facts/settings/usage and four banned synthetic users. Production read-only checks found zero AI organization settings and zero usage rows.

## Validation

| Check                                               | Result                                                     |
| --------------------------------------------------- | ---------------------------------------------------------- |
| TypeScript and ESLint                               | Passed for normal application and staging provider changes |
| Normal Playwright/unit/tool/injection/privacy suite | 87 passed                                                  |
| AI database suite                                   | 41 passed                                                  |
| Local security/RLS suite                            | 251 passed                                                 |
| Staging package tests                               | 5 passed                                                   |
| Hosted disabled-mode suite                          | 99 passed                                                  |
| Hosted deterministic-provider suite                 | 124 passed                                                 |
| Staging provider isolation guard                    | 1 passed                                                   |
| Offline provider diagnostic tests                   | 4 passed; no real provider call                            |
| Production build                                    | Passed locally; staging builds passed on Vercel            |
| Dependency audit                                    | Zero vulnerabilities, including development dependencies   |
| Secret scan                                         | Passed across 141 tracked and unignored source files       |

Repeat hosted tests from the main workspace with `NODE_EXTRA_CA_CERTS` pointing to the trusted Supabase CA, then `node scripts/staging/hosted.mjs --mock`. The root project link is never changed; connection.mjs checks the staging workdir reference and database target. Do not run the older generic auth fixture script against production. Reports and identity-only manifests are under ignored `.tmp`; no tokens/passwords/browser traces are written.

New root tooling: `scripts/staging/{connection,cleanup,hosted,parity}.mjs`, the diagnostic review package and these reports. `scripts/local-test-db.mjs` now supports omitting company seed data. Existing staging preparation, record-access and test changes are preserved. Application/provider commits were pushed only to `staging`; unrelated `.gitignore` changes and the older user audit remain uncommitted and untouched. Main was not pushed or deployed.

## Operations and remaining decisions

Future provider data flow is browser question → server identity/tenant checks → scoped read-only evidence → Responses API → reauthorized extractive answer. Conversation state is browser memory only; at most ten entries, cleared on access/workspace/page lifecycle changes. Usage reservations persist UUIDs, organization/user IDs, HMAC digest, timestamp and optional rating; they do not store prompts or answers. Existing audit records can retain normal business-record change snapshots, independently of AI usage.

`store=false` prevents ordinary stored-response retrieval, but does **not** promise zero retention. Current [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data) describe default abuse-monitoring retention up to 30 days, with exceptions, and possible encrypted prompt-cache state lasting up to 24 hours. No special retention agreement for this account has been verified. Provider data handling needs explicit business acceptance before a pilot.

Application logging is limited to reviewed sanitized metadata; do not add questions, evidence, tokens, keys or raw provider errors to logs. External log-reader access, retention/export settings and incident ownership still need operator sign-off. No scheduled usage/audit deletion job is installed. Approve a retention schedule and audit policy before implementation; never delete current quota reservations to recover capacity. Failures/cancellations consume reservations, and recovery is by normal window expiry or explicit reviewed operator policy, not client refunds.

The account's reported $10 automatic reload at $5, without a monthly reload ceiling, remains unchanged. Application quotas do not limit unrelated project/API activity or account-wide reload charges. No live procurement feed is connected.

Next gate: review and explicitly approve the [separate diagnostic proposal](ai-provider-diagnostic-proposal.md). Deploy approval is not paid-request approval. Its SQL and route remain offline. Then obtain operational sign-off for data handling, log access/retention, usage retention, incident ownership, protected fixture decommissioning and exact pilot users/roles.

Minimal pilot proposal, **not executed**: after all gates pass, name one exact organization UUID and verified user list, review fact classifications, use proposed limits of 10 requests/org/day and 3/user/day, keep public-demo paid AI off, and obtain separate approval for organization/global enablement and production deployment. No organization UUID is inferred from a business name.

Emergency disable: an authorized operator sets the exact pilot organization's `ai_organization_settings.enabled=false` for runtime denial, and sets the Production global flag false with an approved redeploy. Preserve all RLS/grants, usage reservations and audit records. Application rollback restores the known-good deployment without dropping AI tables or restoring broad fact access. For staging, keep the keyless-provider guard and remove only manifest-recorded synthetic data; never promote the staging branch wholesale.

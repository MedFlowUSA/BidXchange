# SAM.gov connector operations

Authoritative contract reviewed September 20, 2026: [GSA Get Opportunities Public API](https://open.gsa.gov/api/get-opportunities-public-api/). The implementation uses `https://api.sam.gov/opportunities/v2/search`. The documentation also contains older example paths; a real bounded staging request must validate behavior before production. No live request has been made in this phase.

## Mapping

| SAM.gov field                                     | Normalized field / treatment                                                                       |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| noticeId                                          | Stable noticeId, required                                                                          |
| title, solicitationNumber                         | title required; solicitation optional                                                              |
| fullParentPathName                                | department/subtier/office hierarchy; deprecated fields used only as fallback                       |
| type, baseType                                    | noticeType, baseType                                                                               |
| typeOfSetAside, typeOfSetAsideDescription         | setAside, setAsideDescription; not company eligibility                                             |
| naicsCode, classificationCode                     | naics, classification                                                                              |
| postedDate                                        | published, preserving source value                                                                 |
| responseDeadLine / responseDeadline               | deadline preserves text; deadlineInstant only with an explicit timezone offset                     |
| active, type, archiveDate                         | active/inactive/cancelled/unknown; archiveDate retained without inferring archival from time alone |
| placeOfPerformance, officeAddress, pointOfContact | Bounded sanitized structured values                                                                |
| description                                       | Reference only; never downloaded                                                                   |
| resourceLinks                                     | Sorted/deduplicated HTTPS references; never downloaded                                             |
| award                                             | Source-supplied award object or null                                                               |
| uiLink                                            | HTTPS SAM.gov-domain URL only; unknown if missing                                                  |
| source modification timestamp                     | null: not guaranteed by this API contract                                                          |

Unknown values are explicit. Raw content is untrusted data, rendered as text, never executed or sent automatically to OpenAI. URL credentials, secret query parameters and credential-named fields are stripped; unexpected echoes of the configured key reject the record without logging it. Raw snapshots are sanitized rather than byte-for-byte archival copies.

## Private configuration

Do not paste keys into chat or put them in NEXT_PUBLIC variables. Configure the SAM.gov public API key privately in the approved worker/job environment. The job does not obtain credentials from a browser or another integration.

| Variable                          | Default / scope                                    |
| --------------------------------- | -------------------------------------------------- |
| SAM_GOV_API_KEY                   | Empty, operator job only                           |
| BIDXCHANGE_SOURCE_DATABASE_URL    | Empty; explicit approved target, operator job only |
| BIDXCHANGE_SOURCES_ENABLED        | false; web UI/data activation after migration      |
| BIDXCHANGE_SAM_SYNC_ENABLED       | false; operator network kill switch                |
| BIDXCHANGE_SAM_SYNC_LOOKBACK_DAYS | 7; 1–31                                            |
| BIDXCHANGE_SAM_SYNC_PAGE_LIMIT    | 100; 1–100                                         |
| BIDXCHANGE_SAM_SYNC_MAX_PAGES     | 5; 1–10                                            |
| BIDXCHANGE_SAM_SYNC_TIMEOUT_MS    | 10000; 1–30000                                     |
| BIDXCHANGE_SAM_SYNC_FROM / TO     | Optional bounded UTC date range for backfill       |

The source database `enabled` flag also defaults false. A missing key or disabled environment causes the job to exit without an API call. The web server need not have the SAM.gov key; it reads minimal database connection status. No production settings are changed by adding placeholders to `.env.example`.

## Commands

From repository root, after loading private variables through the approved environment:

```powershell
# Read-only operator state: no provider request.
npx tsx scripts/sources/operator.ts status
# Only after target-specific approval:
npx tsx scripts/sources/operator.ts enable --approved-change
npx tsx scripts/sources/run.ts --approved-sync
# Disable and retention maintenance require target-specific operator authorization:
npx tsx scripts/sources/operator.ts disable --approved-change
npx tsx scripts/sources/operator.ts prune-runs --approved-change
```

These scripts never infer a linked Supabase project. Do not run a blanket `supabase db push`: document migration 012 has a separate release gate.

Suggested initial schedule: one manually observed staging run, then one daily production run only after separate schedule approval. No cron, workflow schedule, or paid scheduler is installed. The script can run in an approved Node 22+ operator/CI job with a direct PostgreSQL connection. It is not a Vercel request handler and does not require the separate document-scanner server.

Default maximum: 5 discovery pages plus 10 old-notice rechecks; up to 3 HTTP attempts for timeout/5xx per request (45 worst-case attempts). A 429 stops immediately; never hammer the API. Actual account quotas must be verified privately before activation. Tighten staging to one discovery page with a small page size; tracked rechecks are empty for a clean staging dataset. Date filters are publication ranges, not universal modified-since filters.

## Recovery and safe disable

A dedicated session advisory lock prevents overlapping runs. PostgreSQL releases it when the connection closes. The next lock owner marks abandoned running rows interrupted. Per-notice transactions preserve completed progress across page failures. A page cap, malformed records, rate limit, capacity limit or missing tracked notice cannot produce a complete-success claim. Provider bodies/URLs/keys never enter error logs; classification codes and counts do.

SIGINT/SIGTERM cancels network work; keep the process alive long enough to record its outcome and release the connection. For emergency cancellation, stop the job; then disable the database flag and environment switch. The operator disable command serializes with the active run. A retry may repeat a bounded range safely; unchanged observations do not create duplicate versions or queue rows. A source returning nothing does not prove cancellation or archive state.

Monitor counts, last_success, partial runs, storage/capacity errors and record freshness. Record rechecks rotate by last_checked; failed rechecks do not refresh last_seen. Metadata freshness is distinct from successful completion of a discovery range and from human review currency.

## Activation gates

1. Review migration 013 and its local validation report.
2. Approve applying 013 to isolated staging and privately configuring the official key there.
3. Validate one bounded staging sync, hosted JWT/RLS, actual Server Actions, API pagination/status behavior and independent-session locking.
4. Separately approve production migration 013, production key configuration and connector activation.
5. Separately approve production scheduling after measuring quota use and freshness.

The existing AI quotas, document-upload flag, scanner hosting and GES company settings are outside this change.

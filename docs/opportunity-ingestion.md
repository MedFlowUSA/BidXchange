# Opportunity ingestion — implementation checkpoint

September 20, 2026. **Application deployment approved; source synchronization remains disabled.** Migration 013 is installed in isolated staging only, with restricted grants and independent-session locking verified. No SAM.gov credential was retrieved, configured, printed, or used. No real opportunity was imported. AI, document scanning, company settings, users, and paid services are unchanged.

## Architecture

The SAM.gov server/operator adapter implements a small connector interface. A bounded discovery job retrieves official metadata, sanitizes credential-bearing fields and URLs, normalizes it, and writes each observed record in a transaction. An external ID identifies a notice; a solicitation number or title never merges notices. The operator job uses a dedicated explicit database connection, not the application's user-session client and not a linked-project fallback.

The chain is source → immutable observed version → organization search/version → original match reasons → attributed human disposition → existing company opportunity. Conversion creates no pursuit, requirements, bid decision, certification, or submission. Existing manual intake remains available.

Organization administrators and capture managers create/review/activate searches. There is no GES seed filter or derivation from unverified company facts. Within a filter category alternatives are OR; configured categories are AND. Keywords/exclusions inspect title and solicitation only. Unknown fields produce a missing-information review candidate, not a claim of matching eligibility. Reasons refer to the original matched version/search; later source changes are separately flagged. Matching existing inbox records does not overwrite their disposition or original reasons.

## Database migration 013

`supabase/migrations/20260920001300_opportunity_sources.sql` adds:

| Table                  | Purpose / access                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| procurement_sources    | Disabled source configuration and latest run state; operator writes only                                 |
| source_sync_runs       | Bounded date range, counts, status and sanitized error class; operator only                              |
| source_sync_items      | Per-record outcomes and sanitized failure classes; operator only                                         |
| source_operator_events | Database-actor attribution for enable/disable operations; operator only                                  |
| source_records         | Stable source/external ID, first seen, last observed, last attempted recheck and current version         |
| source_record_versions | Immutable sanitized source snapshots, normalized metadata, checksums, parent version and change class    |
| opportunity_searches   | Organization filters, activation reviewer, original creator, last run and version timestamp              |
| source_inbox           | Organization match provenance, missing information, review assignment/disposition and conversion linkage |

Every table has RLS and explicit grants. Anonymous access is denied. Organization tables use `private.member_role`. Source record/version reads require an inbox association in an accessible organization. Raw snapshots/checksums are not granted to application users. The existing restricted audit table captures search and inbox changes transactionally. Cross-tenant composite foreign keys constrain searches, assignment, and converted opportunities.

Functions: `private.source_version_immutable`, `private.valid_source_filters`, `public.save_opportunity_search`, `public.review_source_item`, `public.source_connection_status`. Public RPCs revoke anonymous/PUBLIC execution and recheck membership. Writes require administrator/capture roles and consume the existing database mutation allowance. Direct client table writes are denied. NULL timestamps/version/confirmation cannot bypass the review gate. Saved search updates compare exact versions. Conversion locks the inbox/source, checks the observed version, records attribution, and returns the same opportunity on retry.

No prior migrations are modified. Offline staging manifest revision 9 includes the new migration; preparing that package does not apply it. Migration 013 has no dependency on document activation and must not accidentally promote pending migration 012.

## Versions, changes and limits

Raw and normalized SHA-256 checksums use deterministic key ordering. An unchanged sanitized payload updates last-observed time without creating a version. Raw changes with unchanged normalized fields create an informational observation with severity `none`. Earlier normalized versions are never rewritten, including when the source reverts to an earlier value.

- Critical: earlier or newly ambiguous deadline, cancellation/inactivation, set-aside changes, added/removed resource links.
- Material: other deadline/status changes, notice type, NAICS/classification, place, description-reference and award changes.
- Informational: title, contact, organization and other metadata changes.
- None: no normalized change.

Changes create a persistent inbox alert, including for already converted/dismissed records. Acknowledgment requires the latest source version. Saved requirements and converted opportunity fields are not automatically overwritten. Attachment replacement at the same URL cannot be detected; resource-link changes are not document-content or requirement-level analysis.

Hard bounds: 64 KiB received notice JSON; 8 MiB response body; 10,000 source records; 200 versions/record; 128 MiB aggregate serialized snapshots plus normalized metadata; 30 searches/organization; 300 active searches/job; 10,000 records evaluated/search/job. Reaching a bound reports a failure/partial run rather than claiming complete coverage. Counts exclude PostgreSQL/index/audit overhead. The aggregate byte check is a conservative application gate, not a provider billing cap.

Retain observed versions without destructive expiry, up to those hard caps; stop new versions when full. Purge completed sync runs/items older than 90 days with the explicit operator command. Run logs and operator-event growth require operational monitoring; no scheduled retention job is installed. Version disposal/long-term archival needs a separately reviewed policy because versions may support human decisions.

## UI and current limitations

`/opportunities/sources` is inside Opportunities, with server-filtered pages of 20 records and the latest 10 versions per record. Dates distinguish publication, first seen, queue entry, last observation and source-modified unknown. More history remains in the database for operator review. Freshness warns after 36 hours and does not certify source correctness. The Today panel shows pending reviews and disabled/incomplete/stale synchronization. Converted opportunity views link back to source history; local edits remain separately identified.

Review actions: needs review, save, dismiss, assign reviewer, and explicitly confirm conversion. Forms retain input after unsuccessful actions and disable repeated successful submissions. Members can read; administrator/capture roles see controls. Connector administration is intentionally an operator CLI, not a client-role synchronization button. The web app displays only minimal connection status.

Only official SAM.gov opportunity metadata is supported. No HTML scraping, descriptions/attachment fetching, AI ingestion, local-government feeds, automatic eligibility analysis or full document amendment comparison. The official public API's latest-version and publication-range behavior means coverage is bounded, not exhaustive. Old tracked notices are rechecked in small rotating batches; disappearance is unknown, not cancellation. There is no hosted integration or real API evidence yet.

See [SAM.gov configuration and operations](sam-gov-connector.md) and [validation report](source-ingestion-validation.md).

# Conversational Opportunity Research Assistant

Open **Assistant → Open Opportunity Research Assistant**. Ask about work, review the interpreted filters, and refine them with another question. Follow-ups reuse the prior filter plan; a new search resets it. Conversations are tab-local. Explicitly saved searches persist privately for the current user and company and can be rerun or removed.

## Implemented

- A separate authenticated research route uses the existing OpenAI model configuration, organization activation, user/organization quotas, request deduplication and same-origin controls.
- Structured model output translates the question into bounded keywords, codes, agency, geography, set-aside, notice type, publication/deadline dates, source/status, intent and result-count filters. No company records or opportunity content are sent to this model call. Unsupported outputs fail validation.
- Deterministic retrieval reads tenant-scoped workspace opportunities and current source versions reachable through the selected organization's source inbox, when source ingestion is activated. Source ingestion is not activated by this release.
- Only visible, currently reviewed company facts contribute to NAICS/PSC overlap. Other company categories report evidence availability and the need for solicitation-specific review. Code overlap is not a qualification finding.
- Results show source counts, reviewed-record counts, interpreted filters, last synchronization, record versions, URLs, unknown filter values, company-information gaps, observed changed fields and next actions. Missing fields do not silently pass a filter. The result order favors records without recorded blockers, fewer unknown filters and verified code overlap, followed by explicit filter matches. There is no overall win-probability percentage.
- Recorded pursuit blockers remain visible. Current human requirement resolutions take precedence over legacy workflow statuses when that feature is activated. A recorded blocker is not inferred to be a mandatory legal failure; its controlling notice still needs review.
- Users can inspect company citations, open official/source notices, enter the existing source-inbox conversion flow or open existing opportunity/pursuit tools for compliance reviews, tasks and response drafting. Research never creates a bid decision or external submission automatically.
- Migration 019 adds personal saved searches and append-only per-user research metadata. The audit stores request ID, user/company, filter HMAC, source IDs, counts, result IDs and timestamp. It does not store unsaved prompts, company values, API keys, model text or an authoritative qualification decision. Existing request reservation records track attempts; audit metadata tracks returned results. This is not a full archived copy of every report.

## Coverage and limits

Each request reads at most 200 current workspace opportunities, 200 source inbox entries and 200 visible-candidate company records. Additional requirements and pursuits are bounded too. The UI marks a partial snapshot when a limit is reached. Filtering a bounded snapshot is not an exhaustive market search. Publication dates refer to source dates, never workspace entry dates. Relative dates are interpreted in UTC and shown in the filters. Unknown dates remain unknown.

SAM.gov live ingestion remains blocked by the missing private API key, bounded staging validation and production migration/worker activation. The existing operator connector retains pagination, retries, sanitized errors, locking, immutable observations and quota controls. The research HTTP route searches its synchronized cache; it does not expose a SAM key or make unbounded provider requests. The generic ResearchNotice contract separates retrieval adapters from ranking and display so new source readers can reuse the assistant.

Distance-radius calculations, calibrated profitability forecasts, grant feeds, verified partner recommendations, automatically determined cure methods and full solicitation analysis are not implemented. Attachments are not downloaded or parsed by research. OCR, PDF/DOCX/XLSX extraction and attachment/page citations require the separate secure ingestion workflow. Saved searches run on demand; no scheduled worker or notification delivery is active, and no subscription is created. Therefore there are no active notifications to unsubscribe from in this release. Removing a saved search deletes the personal preference.

## Security and validation

Research uses the user's session client and current company membership. Company sensitivity rules are applied before comparison; unknown sensitivity is excluded. Company evidence is not part of model input. Links reject credentials and sensitive URL parameters. Context and model output never supply SQL, arbitrary tool names or database organization selectors. The server determines source IDs and record links. Authorization is checked before paid work and again before releasing results.

The new database tables use RLS and user/company ownership; no anonymous access, cross-user reading or audit mutation is granted. Saved-search metadata is user-managed data, not trusted approval evidence. Existing mutation limits control API saves.

Tests use synthetic provider responses and local data. They cover structured-plan rejection, code matching, expired/restricted evidence, explicit blockers, missing fields, grant/contract separation, archive uncertainty, tenant-scoped queries, conversation filters, saved-search handoff, responsive layout, RLS and suspended-member access. No real SAM request or paid OpenAI request is needed for these tests.

Implementation reference: [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The SDK response is validated again with the application schema; generated text is never treated as opportunity evidence.

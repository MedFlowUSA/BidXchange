# BidBuddy on-demand SAM.gov research

This extends the existing connector and opportunity form. It adds no tables, dependencies, or automated synchronization. Public-web browsing and restricted-portal automation are not included.

## Workflow

1. In an AI-enabled authenticated workspace, choose **Find bids on SAM.gov**, or ask BidBuddy to find bids on SAM.gov in workspace mode.
2. Prepare suggested public filters from the question. This uses the existing AI planner and makes no SAM request. Company facts are not sent to this planner.
3. Edit the title phrase, optional six-digit NAICS, state, notice type and publication dates. Optionally select a visible, current human-attested company NAICS code. Confirm the filters may be sent to SAM.gov; do not include confidential text.
4. Search the official API. The server sends only these reviewed filters and its server-only key. Company comparison occurs within BidXchange. Code overlap does not establish eligibility.
5. Review the official notice, source date, deadline and limitations. An administrator or bid lead can open the existing opportunity form and explicitly save after review. No requirements, decisions, tasks or submissions are changed by research.

The public demo offers a fixed, fictional Apex Energy walkthrough. It makes no AI or SAM request and cannot search real companies. General chat remains separate from this tool and does not claim live browsing.

## Activation

Configure `SAM_GOV_API_KEY` privately in the hosting environment and set `BIDXCHANGE_SAM_SEARCH_ENABLED=true`; redeploy. The existing global AI switch, model configuration, organization AI setting and membership checks also apply. The API key must never use a `NEXT_PUBLIC_` prefix or appear in a client, screenshot, log or commit. The operator bulk-sync flag remains independent and unchanged.

Before activation is considered accepted, use an authorized test workspace to perform one narrow official request, verify citations against SAM.gov and verify saving through the normal form. Test unavailable/invalid-key behavior without disclosing credentials. Without a configured key, filters can be prepared, but the Search button is disabled and the server rejects search requests.

## Limits and safeguards

- Official fixed endpoint: `https://api.sam.gov/opportunities/v2/search`. No arbitrary fetch URLs, redirects, attachments, authenticated portals or scraped pages.
- One page, at most ten records, at most 31 calendar publication dates, no future dates; title or exact NAICS required. Dates are publication dates, not response deadlines.
- Title is a literal provider filter, not semantic full-text search. Other requested filters are disclosed as unsupported; the provider's active-status filter is not assumed available. Partial results and omitted filters are visible.
- One provider attempt per search, 12-second provider timeout, bounded response size, sanitized normalization, no automatic retry on quota errors. SAM quotas depend on the key holder's account.
- AI reservation limits are reused (at most 100 organization / 20 user reservations daily, including preparation and search, potentially lower under deployment configuration). No background polling or market-wide synchronization.
- Organization membership, role and AI enablement are checked before and after external processing. Current company codes are fetched from explicitly scoped records and filtered by role, attestation and freshness. Query errors fail closed. Only the newest 100 applicable records are compared; truncation is disclosed.
- Same-origin POST, strict body schema, explicit consent, request-size limits, duplicate-request protection and no-store responses. Client results are memory-only and cleared on workspace/access changes and pagehide.
- Existing append-only `research_run_audit` stores actor, organization, HMAC digest, source and result counts. External SAM notice identifiers are included in the digest; `result_ids` remains empty because that field holds workspace UUIDs. Neither raw prompts nor company facts nor provider credentials are added to this audit.
- Role-controlled saving uses the existing server action and RLS. Demo and read-only users cannot save research results through this component. Saving never signs off requirements or approves a bid.

Response deadlines lacking an explicit time-zone offset remain unconfirmed. When an explicit instant is supplied, the review form uses UTC and retains the original source deadline in its note; a person must verify it.

## Verification

Run `npx playwright test tests/sam-research.spec.ts tests/sam-research-ui.spec.ts tests/public-demo-ui.spec.ts tests/assistant-stream.spec.ts`, the existing connector tests, typecheck, lint and production build. See the dated validation report for actual results and rollout status. Mocked provider tests verify behavior but do not establish live API access.

Official API contract: https://open.gsa.gov/api/get-opportunities-public-api/

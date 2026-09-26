# BidBuddy solicitation-text review — September 26, 2026

## Delivered

On an authenticated pursuit, organization admins and capture managers can open **BidBuddy → Review solicitation text**, paste public notice text, preview it, and explicitly authorize AI processing. Reviews contain up to 16 candidate requirements, exact source quotations, server-calculated pasted-text line references, related authorized company records and suggested human follow-up.

Each candidate opens the existing editable Requirements Register form. A person must inspect the quotation, confirm its source and save it. Nothing automatically changes a requirement, decision, sign-off, task or approval. The existing register, tenant authorization and audit path remain authoritative.

## Data and security

- No migration, dependency, model or environment-variable changes.
- Extends the existing organization-scoped assistant endpoint and read-only evidence tools.
- Public input is separate untrusted source data, not system instructions. Responses use strict structured output; the server additionally rejects invented/duplicate quotations and unknown or non-fact company citations.
- Source length is bounded at 40,000 characters without silent clipping. Quotes are at most 1,000 characters. CRLF is normalized before hashing and line calculation; repeated quotes identify their first occurrence.
- URLs are HTTPS metadata only, never fetched. No file uploads, scraping, OCR or attachment processing.
- Unsaved source and analysis stay in tab memory, are excluded from continuation/saved conversations, and are not stored in request logs. AI receives the text after consent. Individually saved candidates preserve their quote, source title, optional URL, line reference and SHA-256 through the existing requirement citation field.
- Existing final authorization and current-evidence checks run before answers are released. No task-action token is issued in this mode.

## Validation before deployment

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed; 33 pages generated.
- `npx playwright test tests/solicitation-review.spec.ts tests/ai-route-conversation.spec.ts tests/requirement-review.spec.ts tests/ai-tools.spec.ts tests/assistant-stream.spec.ts --project=desktop --reporter=line` — **75 passed**. Includes real engine with mocked provider, route authorization, existing conversation/retrieval regressions and 390/1440-pixel browser workflows.
- `npm run test:secrets` — passed, 643 tracked/unignored source files at test time.
- `git diff --check` — passed.
- Desktop and mobile screenshots inspected. Source preview, consent, editable candidates and no automatic save verified in browser tests.

Live provider acceptance and deployment identifiers will be recorded after rollout; these local results do not establish production acceptance.

## Manual acceptance

1. Open a pursuit as an admin/capture manager and open BidBuddy.
2. Expand **Review solicitation text**, enter a title/version and public notice text; optionally add its official HTTPS URL.
3. Preview the exact text. Confirm authorized sharing and run the review.
4. Compare each quotation and pasted-line reference with the source; review company citations and any expiry or missing evidence.
5. Expand **Review and add requirement**, edit if needed, confirm the quotation, then save. Confirm the register contains the chosen requirement and citation.
6. Dismiss/restore a candidate or discard the unsaved review. Confirm normal chat and saved conversations still work.

## Limits

This is bounded pasted-text analysis, not a complete solicitation or attachment review. The model can miss or misinterpret requirements. Related company records are not proof of compliance; retrieval is bounded. Text not supplied, linked pages and PDF attachments are outside coverage. Results require human review and are not saved as chat history.

Implementation reference: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Schema conformance does not establish semantic correctness; exact-source checks and human review remain necessary.

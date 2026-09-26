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

## Production acceptance

PR [19](https://github.com/MedFlowUSA/BidXchange/pull/19) delivered the feature. Live acceptance then exposed a phone overflow in the existing register: long source hashes and amendment fields exceeded their containers. PR [20](https://github.com/MedFlowUSA/BidXchange/pull/20) corrected wrapping and grid minimum widths. Neither change required a migration.

- Application commit tested: `3fb3a83`.
- Vercel deployment: `dpl_CVSmNVvgKfW4CTayzxyJWxkFjSQc`, Ready, production; alias `https://bidxapp.vercel.app` confirmed.
- `npx playwright test tests/amendment-preview.spec.ts tests/assistant-stream.spec.ts --project=desktop --reporter=line` — **24 passed** after the correction, including the new saved-citation/mobile regression. These overlap the earlier 75 tests and are not 99 distinct tests.
- Typecheck, lint, build, secret scan (644 files) and diff check passed again after the CSS correction.
- `node .tmp/solicitation-live.mjs` — **passed at 2026-09-26T22:06:26Z**, using the real production AI provider and an isolated fictional organization. This local acceptance script is intentionally untracked; no service credentials are persisted in it or its results.
- Verified consent, literal quotations, source hash/line references, preserved prime/subcontractor responsibilities, cited expired insurance, mandatory job walk, rejection of an embedded instruction, no automatic requirement/task writes, and absence of continuation/checkpoint/action tokens.
- Explicit human review saved one candidate through the actual register as `needs_review` with its source lineage. Full source was absent from browser storage and saved conversations. Guest review returned 401.
- Desktop (1440px) and mobile (390px) production screenshots inspected; no horizontal page overflow after saving.
- Fictional test organizations/AI were disabled and test logins blocked; audit history retained. No customer records changed.

Earlier live runs identified two issues before final acceptance: the test originally expected a transient save message after the parent instead refreshed to “already in the register”; that assertion was corrected after confirming the successful database write. The subsequent mobile overflow was a real UI defect and was fixed in PR 20. The complete acceptance script then passed without skips.

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

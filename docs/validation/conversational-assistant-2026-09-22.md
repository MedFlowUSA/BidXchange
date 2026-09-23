# Conversational assistant release

The assistant now preserves model explanations, suggestions and draft language instead of replacing them with record titles. Workspace factual claims use validated source keys; general guidance can be uncited and is labeled accordingly. Citation validation confirms that records were retrieved, not that every generated statement is correct.

## Conversation and privacy

- Up to four recent exchanges are carried in AES-GCM authenticated, encrypted continuation tokens. Tokens expire after 30 minutes without a successful continuation and are bound to user, organization, role, mode and selected opportunity/pursuit.
- Tokens contain recent text and hashes of up to 16 referenced records. Oversized context is not continued. They remain in tab memory; no local storage or chat database is added. Reload, new chat, company changes and access changes clear the displayed conversation.
- Before reusing history, the server rereads referenced records through existing authorization/classification filters. Changed or inaccessible evidence rejects continuation. Retrieved records and membership/activation are checked again before releasing the answer.
- General mode receives no workspace tools or records. Existing server-side quotas, same-origin enforcement, cancellation and `store:false` remain. No new migration, key or account is required.
- The configured model and daily request limits are unchanged. The per-call output cap increases from 1,800 to 3,000 tokens; conversational requests can therefore consume more tokens.

## User experience

Recent exchanges remain visible, the composer follows the answer, source details are collapsible and copying excludes the encrypted continuation. Switching modes resets continuity. Refreshing company records starts a fresh answer. Mobile controls wrap within the viewport and use readable input sizing. Explicit saved-outline commands remain separate from read-only conversation.

## Validation

- `npm test -- --workers=4`: 243 passed, including real mobile viewport coverage with application styles.
- Conversation tests cover tampering, expiry, identity/role/organization/mode/context binding, changed/revoked evidence and bounded context.
- Request-pipeline test confirms history replay, foreign-scope rejection before usage reservation and final access revocation.
- Existing retrieval and assistant tests cover tenant isolation, restricted records, invented citations, invalid operations, cancellation and outages. Explicit prohibited approval/eligibility claims are rejected; this is not a comprehensive semantic safety classifier.
- `npm run test:secrets`: passed across 554 tracked/unignored source files.
- Production build and opt-in provider results are recorded in deployment logs. The provider check sends three fictional questions using the real engine, including follow-up drafting; it never logs credentials, prompts, answers or customer records.

## Limits

No persistent chat history, voice, private-file ingestion or live web browsing is added. Earlier answers remain snapshots. Broad record retrieval may exceed the continuation limit and require a narrower question. Prompt-injection instructions and read-only tool enforcement reduce risk but do not guarantee accurate prose. Human decisions, pricing, signing and submission remain with the user. The public demo remains scripted.

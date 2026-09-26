# BidBuddy and shared application reliability — September 26, 2026

## Scope and findings

Reviewed the existing company-profile, pursuit, requirement, decision, task, document and assistant workflows through the repository's desktop/mobile regression suite, with targeted code and browser review of BidBuddy and the shared Dialog component. The initial 313-test suite passed. Additional inspection found gaps that existing tests did not cover:

1. Collapsing BidBuddy during source review or saved-chat operations could leave the parent busy state locked.
2. Separate client stream readers could discard a valid final event without a trailing newline, expose low-level parse errors and wait indefinitely for a stalled connection. Chat could display an answer before a later stream failure.
3. Conversation history and optional sharing fields preceded the question box on phones.
4. Shared dialogs treated interior padding clicks as backdrop dismissal, omitted disclosure summaries from the keyboard loop, and lost trigger focus after closing.

## Repairs

- Chat and solicitation review share a bounded response reader: split UTF-8 handling, final-line flushing, structured error propagation, 90-second deadline, cancellation/reader cleanup, byte/event limits, and no answer release until successful stream completion.
- Collapsing an active child cancels its request and releases its own busy state. Operation identity checks prevent late completion from resetting a replacement operation. Explicit source cancellation clears ownership before unlocking controls.
- The conversation comes before history on phones; the question box precedes optional requirement sharing. Suggested questions and detailed data-access explanations use disclosure controls, while human-review limits and company context remain visible.
- Dialog keyboard navigation includes summaries and excludes disabled/inert/hidden controls. Interior clicks stay open. Escape, the close button and true backdrop clicks dismiss the dialog and restore trigger focus.
- Availability wording gives users an administrator/support action without exposing implementation setup details.

## Data and security

No schema, model, provider, quota, role or environment-variable changes. Existing server-side authorization, organization isolation, source consent, quotation/citation validation and approval boundaries remain in place. The new client reader is a transport safeguard, not a replacement for server authorization. No automatic retries, customer-record edits, approvals or submissions were added. No raw source or conversations are placed in browser storage.

## Main files

- `apps/web/lib/ai/client-response.ts`: shared client transport and failure handling.
- `apps/web/components/assistant.tsx` and its CSS: conversational layout and shared transport integration.
- `assistant-solicitation-review.tsx`, `assistant-saved-conversation.tsx`: operation cancellation/ownership cleanup.
- `apps/web/components/dialog.tsx`: application-wide keyboard, focus and dismissal repairs.
- `tests/assistant-client-response.spec.ts`, `tests/assistant-stream.spec.ts`, `tests/dialog-accessibility.spec.ts`: added transport, interruption, layout and dialog regression coverage.

## Validation

- Initial `npx playwright test --reporter=line`: 313 passed.
- Targeted `npx playwright test tests/dialog-accessibility.spec.ts tests/assistant-client-response.spec.ts tests/assistant-stream.spec.ts tests/routes.spec.ts --project=desktop --reporter=line`: 32 passed after repairing the newly detected focus-restoration issue.
- Typecheck and lint passed during implementation.
- Secret scan and diff check passed during implementation.
- Final `npx playwright test --reporter=line`: **323 passed (2.7 minutes)** across desktop/mobile projects. Includes company profile, registration/evidence handling, requirements, decision gates, tasks, exports, conversation/privacy, tenant/access and public/demo regressions.
- Final `npm run typecheck`, `npm run lint`, and `npm run build` — passed; 33 pages generated.
- Final `npm run test:secrets` — passed across 648 tracked/unignored source files. `git diff --check` passed.
- Live acceptance is recorded after release below.

## Remaining limits

This is a reliability/usability release, not proof that the entire product is defect-free. Real-contractor usability, legal review and production scale testing remain separate. Source review still handles bounded pasted public text, not PDFs, attachments or fetched websites. Saved chats still require explicit saves; quotas and company activation still apply. Live portal synchronization and private-file scanning were not enabled.

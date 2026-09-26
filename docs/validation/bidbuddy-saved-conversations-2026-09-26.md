# BidBuddy private bid conversations

This release adds an explicit **Save conversation** action inside BidBuddy on a selected pursuit. It stores one private checkpoint per user and bid. Returning users can resume or delete it; a new save replaces their previous checkpoint. General chats and the public demo are not persisted.

Recent context increases from four to eight exchanges, subject to the existing byte limits. Saved copies expire for resume after 30 days. This is a bounded checkpoint, not an unlimited message archive. Unsaved messages still disappear when leaving/reloading. Users must save again after follow-ups to update the checkpoint.

## Implementation and security

- Existing assistant retrieval, Responses requests, mode separation, source citations, selected-excerpt consent and human task-saving controls remain.
- `saved-conversation.ts` issues authenticated AES-GCM encrypted payloads using a separate key-derivation purpose. User, organization, role and pursuit are bound into the content. API key rotation invalidates saved checkpoints.
- The new conversations route validates membership, pursuit access, AI activation, source hashes and selected excerpt versions before saving/resuming. Changed records or access prevent resume. No old task action token is restored.
- Migration `20260926003400_private_bid_conversations.sql` adds one RLS table with a composite organization/pursuit foreign key and private user ownership. The database stores encrypted payloads and timestamps, not plaintext prompts or answers. No transcript audit trigger is added; operational logs remain metadata-only.
- The UI saves only after an explicit click, stores nothing in browser storage, aborts pending restores on unmount and resets on access changes. The draft Privacy Policy describes the new storage behavior.
- Expired encrypted rows can remain until deleted or replaced. Automatic physical purging and account-wide chat deletion are not included. Saved conversations are not shared with coworkers.

## Verification

- `npx playwright test tests/ai-saved-conversation.spec.ts tests/ai-saved-route.spec.ts tests/ai-conversation.spec.ts tests/ai-route-conversation.spec.ts tests/assistant-stream.spec.ts --project=desktop --reporter=line` — 25 passed; covers encryption, scope tampering, expiry, source changes, role changes, mode boundaries, excerpt consent, save/reload/resume/follow-up/delete and 390px/1440px layouts.
- `node --test --test-isolation=none scripts/test-saved-conversations.mjs` — passed locally. The same test with `BIDX_SAVED_TEST_TARGET=staging` and `production` passed against hosted databases; all synthetic rows rolled back.
- `npm run test:staging` — 5 passed. Manifest revision 22 includes the migration checksum.
- `npm run typecheck`, `npm run lint`, `npm run build` — passed.
- `node scripts/contractor-release.mjs staging apply-approved` and `production apply-approved` — applied only migration 034; existing record digests unchanged and public-table RLS preserved.

## Manual acceptance

1. Open a pursuit, then BidBuddy. Ask about the selected bid in Workspace records mode.
2. Click Save conversation. Reload, reopen BidBuddy and click Resume saved conversation.
3. Ask a follow-up; save again to replace your saved copy.
4. Change a cited bid/company record, then try resuming the old copy. It should require a new conversation with current records.
5. Delete saved conversation; reopening should no longer offer Resume. Another user in the same company must not see your saved checkpoint.

Production browser acceptance uses an isolated fictional organization, a temporary login and at most two real AI requests. No customer is impersonated. AI and the test login are disabled afterward.

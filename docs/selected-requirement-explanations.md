# Selected requirement explanations

The pursuit assistant now supports a plain-English explanation of one explicitly selected requirement excerpt. An organization administrator or capture manager chooses the requirement, reviews the exact excerpt, confirms that they are authorized to share it with AI, and sends a question. The answer shows the excerpt alongside its source reference. The existing task review flow can turn suggested follow-up work into a human-reviewed task.

## Privacy and authority

- Nothing is selected or shared by default. Only the first 1,000 characters of the chosen requirement are eligible; truncation is visible in the preview and answer. Source notes, other clauses and document contents remain excluded.
- The server retrieves the excerpt through the user's authenticated, organization-scoped database client. It checks the selected pursuit, active requirement, exact record version, allowed role and explicit consent before reserving provider work. Client-supplied wording is not accepted.
- General mode rejects sharing. Viewers, contributors, estimators and executive approvers cannot initiate this disclosure; the existing administrator/capture-manager responsibility is reused.
- Conversation scope includes the selected requirement and version. Changing the selection, removing consent, starting a new conversation, changing organization or leaving the page clears sharing state. Switching a conversation containing a shared excerpt to general mode clears it. This does not retract data already sent to the provider.
- The excerpt is sent as untrusted user-level data, never developer instructions. Existing read-only tools, strict response validation, source citations, provider `store:false`, request limits and authorization rechecks remain in place. These controls reduce risk; they do not guarantee accurate interpretation or perfect prompt-injection resistance.
- The server rechecks the excerpt before releasing the answer. Changed versions require refreshing the pursuit and reviewing the current excerpt. Task review tokens include the requirement reference even if a suggested task cites another record, preserving stale-source rejection.
- Explanations are AI suggestions. They never attest evidence, determine legal eligibility, sign off requirements, approve a bid, set prices or submit anything. No requirement status changes automatically.

## How to use

1. Open a pursuit and its assistant in Workspace records mode.
2. Under **Explain a requirement**, choose one requirement.
3. Review the excerpt and confirm you may share it with AI. Leave restricted or confidential source material unshared.
4. Click **Use explanation question**, or write a question, then **Ask BidXchange**.
5. Compare the explanation with the full original notice. Review any proposed task before assigning and saving it.

## Implementation

No migrations, persistent disclosure classifications, new roles, new integrations or provider configuration changes are introduced. The request contract gains an optional requirement ID, version and consent flag. A scoped helper validates and reads the excerpt; the route binds it to conversation context and rechecks freshness. The engine requires the selected record citation. The UI provides preview, consent, reset behavior and stale-source recovery.

This is a selected-excerpt workflow, not automatic whole-solicitation interpretation or a saved translation-review/correction database. Long clauses may require additional human review because later exceptions can lie beyond the excerpt. Model quality and timing can vary.

Official implementation guidance reviewed: [OpenAI safety guidance](https://developers.openai.com/api/docs/guides/agent-builder-safety), particularly keeping untrusted input out of developer messages and retaining human control over actions.

## Automated validation

- `npm test`: 276 passed, including desktop/mobile preview, consent, selection reset, general-mode exclusion and stale-source recovery.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:secrets`, and `git diff --check`: passed.
- Server tests cover role and tenant/pursuit isolation, archived/changed requirements, bounded excerpts, source citations, source changes during generation, scope-bound continuation, and inclusion of the selected source in task review tokens.
- Early browser failures exposed an unnecessary conversation clear on ordinary mode changes and a missing test-harness mount. Both were corrected before the successful full run.

## Live acceptance and wording refinement

The first production acceptance on release `87ff75f` passed all twelve checks: real-provider explanation, source citation, explicit task review/save, ownership/deadline linkage, unchanged requirement status, mobile containment, general-mode exclusion, stale-selection rejection, tenant denial and test-fixture shutdown. Only fictional records were used.

Manual review of that answer found an inferred record-retention duty and unnecessary internal disclosure wording. The follow-up policy now explicitly separates literal clause meaning, unanswered questions and suggested follow-up work; it prohibits turning “collect” into “collect and retain” and keeps internal record IDs/disclosure markers out of prose. Human comparison with the original source remains required.

# Conversational bid planning

September 25, 2026

## What changed

The authenticated assistant can propose up to four follow-up tasks for a selected pursuit. Each proposal includes an explanation and references to authorized workspace records. The user can inspect sources, see existing related tasks, edit the title and notes, choose an owner and date, and explicitly confirm before saving. Proposals can also be dismissed or restored. The Assistant page links to the user's pursuit workspaces.

No task is saved when an answer is generated. Saving uses the existing task model, capture permissions, owner validation, audit logging and tenant policies. No migration, new provider or environment flag is required.

## How to use it

1. Open Assistant and choose a pursuit under “Plan work on a selected bid,” or open the assistant within a pursuit.
2. Use Workspace records mode and ask: “Help me plan this bid. Explain what needs review and propose follow-up tasks.”
3. Read the explanation and cited records. Inspect the linked requirement wording and existing tasks.
4. Expand “Review and save task.” Edit the proposed text, choose an owner and deadline, and check the review confirmation. An unassigned task or unspecified date is allowed if intentional.
5. Save the task and follow its link in the pursuit. Task titles and notes are shared with the pursuit team; remove restricted information before saving.

## Boundaries

- By default, raw requirement clauses and existing task notes remain excluded from AI input. The follow-up [selected requirement explanation](selected-requirement-explanations.md) adds explicit preview and consent for one bounded excerpt. It does not add automatic whole-register disclosure or saved translation correction history.
- General mode has no workspace access or task-save controls. Demo task saving is disabled. Viewers and estimators cannot save proposed tasks.
- Proposed tasks cannot change requirement status, approve a decision, set a price, sign or submit a bid.
- Encrypted review tokens bind the user, role, organization, pursuit and referenced evidence. Source changes, revoked access or token expiry require refreshing the answer. Tokens expire after 30 minutes and are distinct from conversation continuation tokens.
- The server rechecks authorization and source freshness before passing reviewed fields to the existing task action. It forces new tasks to `todo`. A stable creation ID prevents duplicate insertion when the same save is retried.
- Existing related tasks are displayed for human comparison. Semantic duplicate detection across separately generated answers is not guaranteed. Planning reads are bounded and do not establish that a solicitation is complete.

## Validation

- `npm test`: 270 passed.
- After the final source-count and interface guards, `npx playwright test tests/ai-planning.spec.ts tests/assistant-task-actions.spec.ts tests/ai-route-conversation.spec.ts tests/assistant-stream.spec.ts`: 32 passed.
- Tests cover source membership, organization/pursuit isolation, withheld clause text, strict output shape, encrypted token scope, human confirmation, changed/revoked sources, restricted roles, repeat saves, and desktop/mobile interaction.
- `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:secrets`, and `git diff --check`: passed. The secret scanner was rerun with process permission after the sandbox blocked its Git subprocess.
- Release-time automated provider responses were mocked. Subsequent [authenticated production acceptance](validation/bid-planning-live-2026-09-25.md) verified the real provider and reviewed task saving through the deployed application in a fictional workspace, without exporting the API key.

## Manual acceptance

With an authorized test workspace, ask for a plan on a pursuit containing requirements and tasks. Confirm source links, task relevance, owner/date edits and successful saving. Check that refreshing after a source edit produces a new plan, and that a viewer cannot save. No production customer records were altered for acceptance testing.

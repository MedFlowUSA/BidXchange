# Today task inbox

The old Today queue sorted the first 500 workspace task records and showed 20. Completed records could fill that sample, and newer or urgent work beyond it was unavailable. Today now reads the task table directly with company, completion, owner and deadline filters applied before pagination.

## Behavior

- Contributors, estimators and executive approvers start with their own assignments. Administrators, bid leads and viewers start with the team view.
- Owner filters: all team tasks, assigned to me, or needs an owner.
- Deadline filters: all open tasks, overdue, due in the next seven days, or needs a deadline. Seven days is a rolling interval from the displayed checked time; dates display in the saved task time zone with company-zone fallback.
- Pages contain 25 tasks, ordered by due instant (undated last) and ID for stable ties. Previous/next links and GET form filters remain bookmarkable and survive reload. Applying filters resets the page.
- Each card shows its scoped pursuit title, status, priority, ownership and deadline, and opens the existing task instructions/progress controls.
- Query failures show an explicit retry state, not a claim that there is no work. Concurrent edits may shift page positions; refresh guidance and an empty-page return link are provided.

## Architecture and boundaries

`task-inbox.ts` defines filter parsing, paging bounds and links. `task-inbox-records.ts` uses the authenticated Supabase client, an explicit organization filter on both queries, the authenticated user ID for the mine filter, a 26th-row next-page sentinel and one bounded batch of pursuit titles. It has no total-count query, N+1 lookup, administrator client or AI call. Query timeouts return a generic error without exposing internal details.

The existing authenticated `renderWorkspace` attaches the inbox only on Today after workspace access is resolved. The demo retains its fictional workflow. `TodayTaskQueue` and its scoped CSS provide the connected controls and responsive task cards. Other workspace search samples are retained and are not used as the inbox source.

No migrations, role/RLS changes, new tables, dependencies, environment variables, uploads, third-party integrations or automatic approvals/submissions. Task edits continue to use the existing detail page and version-checked assignee action.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx playwright test tests/task-inbox.spec.ts tests/task-inbox-ui.spec.ts tests/task-queue.spec.ts --reporter=line`: 7 passed. Tests cover more than 500 records, completion exclusion before paging, exact deadline boundaries, stable ties, company-scoped task/title queries, input validation, honest errors, GET filters, page links, task handoff, reload and 390/1440px containment.
- `node --import tsx scripts/test-task-inbox-hosted.mjs`: passed on staging with 581 fictional tasks using a real estimator session. Confirmed two pages of assigned upcoming work, no duplicates, scoped titles, unassigned/undated filtering, foreign-company denial and revoked-membership denial. Fictional workspaces were suspended and the login banned afterward; no email or provider requests.
- `npx playwright test --reporter=line`: all 341 tests passed (desktop/mobile projects).
- `npm run test:secrets` and `git diff --check`: passed.
- `npm run build`: passed; production Next.js routes generated successfully.
- Final navigation correction: `npx playwright test tests/task-inbox-ui.spec.ts --reporter=line` passed (4). A server page transition resets unapplied filter edits to the query actually being shown. Typecheck, lint and build were repeated for this correction.

Initial browser selectors matched the full implicit label and both the overdue option and badge. Tests were corrected to use named comboboxes and a list-item-scoped badge; no application behavior was weakened to make them pass.

## Limits

This is a refreshed, paginated view, not live push notifications or an immutable task snapshot. A maximum page index of 1000 bounds expensive offsets; the final page asks users to narrow filters. Other workspace lists retain their existing sampling limits. No production-scale load-test claim is made. Real-contractor pilot feedback remains the next validation beyond automated and fictional acceptance.

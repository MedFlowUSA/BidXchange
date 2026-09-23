# Bid-control workspace

Open a pursuit and choose **Open bid control**. This extends the existing qualification route rather than creating another workspace or database model.

- Decision memo and Requirements Register status show whether the saved context still matches. Stale records require human review; the page cannot approve or reaffirm them.
- Open, overdue and owner-needed task counts use only visible tasks for the selected pursuit. Completed tasks and tasks from other pursuits do not enter the open-work timeline.
- The timeline combines the recorded submission deadline and open task dates. Missing dates and invalid time zones remain explicit. Job walks, question deadlines and bonding reminders appear when entered as tasks; no dates are inferred from prose. Only the first eight entries appear, with a link to all pursuit tasks.
- Each requirement shows its existing linked follow-up tasks. Authorized users creating a follow-up now get the requirement preselected in the existing form. Viewers retain read-only access. Completing a task does not resolve a requirement.
- Existing release controls remain the place to review forms, signatures, attachments, version-bound approvals and user-recorded submission.

No migrations, new permissions, AI writes or customer-data seeds. The page uses existing authorized data and snapshot timestamps. Record limits and incomplete evidence remain disclosed.

Manual check: open a pursuit, compare the control summary with its tasks and decision; follow a requirement, inspect existing tasks, and add a dated/assigned follow-up with the correct requirement selected. Refresh after saving. Change a source through the existing amendment workflow and check that the decision/sign-off indicators become stale. Test with a viewer to confirm no task-creation controls appear. A real GES/PEPMA notice is still needed for customer acceptance.

Validation: `npm test` completed with 256 passed and one browser assertion failing because its selector matched two forms. After scoping that assertion to the opened requirement, `npx playwright test tests/qualification-map.spec.ts tests/bid-control.spec.ts` passed all 11 tests, including desktop/390px layout and viewer restrictions. `npm run typecheck`, `npm run lint`, `npm run test:secrets`, `git diff --check` and `npm run build` passed. No real customer bid was created, approved or submitted in these checks.

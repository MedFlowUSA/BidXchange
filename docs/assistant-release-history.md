# Assistant approval and submission records

The workspace assistant can discover up to ten recent response releases for a selected pursuit and read each release's current approval state and latest user-recorded submission. The pursuit-mode suggested question opens this workflow. Citation details reload the record and link to its pursuit workspace.

## Behavior

- Release IDs and sequence numbers identify the exact frozen version.
- Pricing, compliance, final and submission approval summaries show the latest recorded decision, actor ID, timestamp and whether the existing server-side validator still considers that approval current.
- Edited/stale releases never turn a historical approval into current authorization. Missing or revoked approvals are explicit.
- Submission summaries show the latest initial/correction/resubmission record, submitted and recorded timestamps, actor IDs and previous record ID. They are labeled user-recorded, not independently verified; no portal action is performed.
- List results are metadata only until the detailed reader runs. Missing submissions for one release do not prove no submission for the entire pursuit.
- General mode remains separate from private workspace retrieval.

## Access and limits

Uses existing authenticated organization-scoped reads and `response_release_status`; no migration, permissions change, dependency or write tool. Source pages reauthorize access. Response snapshots, pricing amounts, approval rationale/conditions, receipt details, portal URLs and document references are excluded. Users must open the workspace to review those details. Actor IDs are shown, not resolved display names.

Discovery is limited to ten recent releases and the existing forty-record/six-tool-call request budget. Each detailed release reads the latest event for each of four approval types and the latest submission. Earlier events remain available in the workspace history. Legacy `submission_records` are not included. Detected concurrent changes or unavailable status cause a retryable failure rather than a positive approval assertion. This is a read-time snapshot, not continuous monitoring or a substitute for the enforced release gates.

## Validation

Targeted `npm test -- tests/ai-tools.spec.ts --workers=4`: 34 passed. Cases cover current approval, revoked/stale release, correction chains, absent records, foreign organization IDs, inconsistent status, citation reload and private payload exclusion.

`npm test -- --workers=4`: 211 passed. `npm run build` and `npm run lint` passed. Hosted staging PostgREST checks accepted the three bounded projections with no customer rows returned. `npm run test:secrets` passed across 513 source files before this report. No real customer prompt was sent to a model during testing.

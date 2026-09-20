# Evidence stress test

## Product direction

Help teams explore the consequences of losing evidence before relying on it in a bid. A single license or project reference can support several notice requirements; reviewing each requirement separately makes that dependency easy to overlook.

Authenticated pursuit pages now offer a collapsible stress test. Select one or several currently approved evidence records to simulate their removal. Evidence is ordered by the number of connected requirements. Results prioritize affected requirements with no other loaded approved evidence and link back to the register for follow-up.

Remaining approvals are candidates for human review, not guaranteed replacements. The scenario does not infer which private evidence link underlies a saved requirement resolution.

## Boundaries

This is an in-memory exploration of an authorized snapshot. No database migration, new permission, external provider, or saved mutation is introduced. Evidence approvals, requirement resolutions, buyer waivers and bid decisions remain intact. Refresh clears the scenario; switching organizations or pursuits remounts it. Records no longer available after a data refresh are excluded from results.

Only current approvals attached to the selected pursuit and loaded evidence participate. Duplicate approvals count as one evidence record per requirement. The UI discloses its snapshot date, restricted visibility and record limits (500 requirements, reviews and facts). Partial results cannot establish overall readiness, eligibility, or absence of support. A documented waiver does not disappear when evidence is hypothetically removed.

## Validation

Nine focused tests cover combined losses, alternatives, deduplication, stale and missing evidence, pursuit scope, disabled reviews, lost visibility, incomplete views and existing requirement/brief rules. Type checking, lint and a production build passed.

The signed-in staging browser test exercises scenario selection, affected-requirement links, reset, refresh clearing, mobile containment and unchanged saved resolution text. After role revocation, restricted evidence is absent from scenario choices and content. Existing resolution, decision invalidation and concurrency checks also pass. Synthetic records and the temporary account were removed; no production business records were created.

## Proposed extensions

1. Cross-pursuit dependencies with explicit scoped pagination; the current snapshot must not be presented as the full portfolio.
2. Deadline-aware scenarios once official requirement dates and evidence-validity semantics support them. Do not guess whether expiration disqualifies a bid.
3. Retained before/after document snapshots and amendment acknowledgment to show actual changes and the human reviews affected.
4. A versioned handoff packet covering the human decision, assumptions, owners and unresolved conditions before final approval and submission evidence.

These are proposed extensions, not claims about capabilities already delivered or uniqueness relative to competitors.

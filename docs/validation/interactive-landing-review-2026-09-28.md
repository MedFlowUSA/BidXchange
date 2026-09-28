# Interactive landing review — September 28, 2026

The public page now demonstrates a fictional municipal-retrofit review instead of repeating separate capability, pain-point and workflow sections. The hero explains the contractor task directly: “Before you price the job, review what the bid requires.”

- One interactive panel connects company records, three selectable requirements, assigned follow-ups and a draft awaiting human review. Each requirement shows an illustrative source clause, available record, unresolved question and next task.
- Optional, explicitly separate later-stage scenarios explain amendment/expired-insurance re-review, stale decisions and preserved history. They do not claim an automated no-bid decision or approval.
- The main action is “Try a sample bid review.” Company-profile and full-demo links open existing fictional routes. Walkthrough contact retains the existing conditional intake and clearly labelled email fallback.
- A scripted BidBuddy answer gives specific bond, job-walk and license follow-ups. It is labelled fictional and not a live AI response. Workspace/general-mode boundaries, manual submission, legal draft notices, commercial status and no-award-guarantee disclosures remain available.

## Implementation and security

Root metadata/authentication remain server-rendered. Only the existing ProductPreview becomes a client component with local React state. No persistence, API/provider request, customer information, schema, RLS, permission, environment or storage changes. Existing demo records and workflow are unchanged. No dependencies added. Unrelated local files are excluded from the release.

Primary files: `app/page.tsx`, `product-preview.tsx`, `bid-preview.module.css`, `landing.module.css`, `marketing-header.tsx`, `interest-preview.tsx`, and `tests/marketing.spec.ts` under the existing web/tests directories.

## Executed validation

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx playwright test tests/marketing.spec.ts --reporter=line` — 18 passed initially.
- `npx playwright test tests/marketing.spec.ts tests/routes.spec.ts tests/workspace.spec.ts tests/demo-rehearsal.spec.ts tests/demo-bid-control.spec.ts tests/demo-request.spec.ts --reporter=line` — 41 passed after final changes. Covers keyboard controls, reset/reload, no preview writes/provider calls/browser storage, fictional boundaries, company/demo routes, protected-route behavior, intake validation, exports, navigation and responsive containment from 360 to 1440 px.
- `npm run test:secrets` — passed across 674 tracked/unignored source files. Initial sandbox execution could not spawn Git; the authorized rerun passed.
- `npm run build` — passed.
- `git diff --check` — passed.
- `node .tmp/landing-acceptance.mjs` — local desktop/phone interactions passed; no page errors. Hero, review and BidBuddy screenshots visually inspected. A CSS encoding issue found in the first screenshots was corrected; dark-panel contrast is now asserted in the browser tests.

At 1440×1000 the default page measures 3,798 px tall, down from 4,912; at 390×1000 it measures 6,196 px, down from 8,710. These are layout measurements, not conversion or usability-study results. Native disclosures expose additional detail on demand.

## Release and limits

Publish through the normal PR/CI/Vercel workflow and verify the public alias using the same read-only desktop/mobile acceptance script. The landing demonstration is a curated walkthrough, not the actual database-backed workspace or a live AI session. Full-app/database tests were not rerun for this public presentation-only change. No contact message was sent and no intake/provider feature was activated.

# Bid-control workspace release — September 26, 2026

## Delivered

- Demo entry opens the municipal retrofit directly. Navigation is This bid / Passport / All bids / Today, with mobile bottom navigation and attention counts. BidBuddy opens in a right drawer. Existing signed-in routes remain intact.
- One primary next action prioritizes cited stale evidence, register sign-off, a human decision and submission handoff. A recorded current no-bid stops response recommendations. Secondary tools remain under More on this bid.
- The fictional demo connects ten source-cited requirements, candidate extraction, dismissible California checklist suggestions, dispositions, sign-off, decision history, tasks, draft versions, approval, handoff and human submission recording. Amendments and expired insurance invalidate the applicable review/decision/approval state while preserving history.
- Fictional Apex Passport records include Redlands territory, CSLB/DIR/SAM, insurance, bonding bands and three projects. Its date-labeled Radar shows expired and 30/60/90-day examples; renewal/expiration simulation stays connected while navigating between Passport and the bid. Confirmation records reset when leaving the bid; all sample state resets on reload.
- Existing production Passport, evidence monitoring, register, decision, task, release approval and PDF/Word capabilities are reused. Overall profile percentages were removed from the UI; missing-field guidance remains.
- Submission handoff extends existing immutable release snapshots. An explicit external-completion checkbox is preserved in pricing/signature/certification references. Existing snapshots remain readable; the new ready-to-hand-off display requires this attestation and existing server readiness checks. Static versioned portal instructions and safe external links do not call buyer submission APIs.
- Workspace assistant retrieval is server-scoped to the selected organization, Passport and selected opportunity/pursuit. General mode cannot execute company document commands. Public demo AI remains general-only with its existing quota and no private records.

## Database and security

Migration `20260926003300_financial_passport_access.sql` adds restrictive administrator-only SELECT policy for raw financial Passport facts. Evidence reminders for those facts are assigned only to administrators, and acknowledgment checks enforce the same boundary. Existing tenant/classification RLS and other role mappings remain. No tables or customer records are removed. Migration manifest revision 21 includes the reviewed checksum.

The staging migration preserved existing records and RLS. A hosted rollback-only synthetic test checked all six existing roles, cross-organization access, reminder visibility and acknowledgment. Existing deliberately shared response text/snapshots are not retroactively erased by the raw-fact policy.

Production: `node scripts/contractor-release.mjs production apply-approved` applied only `20260926003300`; its transaction verified existing record digests unchanged and all public tables still protected by RLS. Gated migrations 012/013 were not applied.

## Validation

- `node --test scripts/test-financial-access.mjs scripts/test-evidence-monitor.mjs scripts/test-register-signoff.mjs scripts/test-response-releases.mjs scripts/staging/prepare.test.mjs` — 9 passed.
- `node --test scripts/test-financial-access.mjs --staging` — 1 passed with TLS verification and synthetic fixture rollback.
- `npm run test:ai:database` — 41 checks passed.
- `npm run test:security:local` — 251 checks passed.
- Desktop 1440px and phone 390px screenshots reviewed: next action above the fold, one register, drawer-only assistant, no horizontal overflow.
- Source search found none of the prohibited legacy phrases in `apps/web`: eligibility check, readiness score, training register, practice one bid, A clear path to your next pursuit.

- `npm test -- --reporter=line` — 294 passed; one mobile workspace-picker test timed out because it checked menu visibility before the streamed redirect completed. Corrected the test to wait for the bid heading and use the known viewport.
- `npx playwright test tests/routes.spec.ts tests/pursuit-next-step.spec.ts tests/contractor-ui.spec.ts tests/workflow-guide.spec.ts --reporter=line` — 18 passed after that correction, including the previously failing test and final authenticated presentation changes.
- `npm run typecheck`, `npm run lint`, `npm run build` — passed. Production build generated all 32 static pages and retained dynamic authenticated routes.
- `npm run test:secrets` — passed across 623 tracked/unignored source files before adding this report.
- `git diff --cached --check` — passed.

## Primary sources for static portal guidance

- [PlanetBids vendor support](https://home.planetbids.com/vendor-support)
- [Cal eProcure](https://caleprocure.ca.gov/)
- [SAM.gov contract opportunities](https://sam.gov/opportunities)

The issuing notice always governs. A sample PlanetBids-style notice has no real buyer submission destination.

## Limits and manual acceptance

- Demo exports text; authenticated response exports retain existing PDF/Word support. Demo records are in-memory illustrations, not database transactions or real attestations.
- No new portal integrations, uploads, model/provider changes, pricing tools or automatic submission. No fresh claim of AI legal eligibility or improved win probability.
- Existing feature flags still control authenticated workflow availability. This release does not silently activate gated storage or source synchronization migrations.
- The new handoff attestation is stored in the existing checklist references rather than a new database field. Existing release RPC authorization and readiness remain the database authority. There is no independent verification of receipt.
- Manually test with a contractor's own authorized account: update one cited insurance record, review/sign the register, record the decision, complete a draft, freeze/approve that exact version, and record the real external receipt only after submitting outside BidXchange. Confirm the named submitter and portal instructions against the actual notice.
- Highest-value next validation: observe one contractor completing that end-to-end workflow on a real solicitation, then address the specific friction they encounter.

# Readable handoff export

The signed-in pursuit's Submission handoff section now offers **Download handoff checklist (PDF)** for each frozen version. The existing JSON packet remains available. No migration, new dependency or buyer integration was introduced.

The PDF contains the frozen version/checksum, current readiness warnings, named submitter's workspace ID, destination and deadline/time zone, source review reference, checklist, file locations/hashes, frozen requirement findings, versioned portal guidance, approval history and user-recorded receipts. It excludes raw response content and does not query private Passport facts. Findings are explicitly historical; the first page states whether the version is ready at export time. Every page says this is an internal handoff, not a buyer submission.

A labeling defect was corrected: previously, zero checklist blockers and current context could display ready-for-handoff even with separate approvals missing. The screen, next-action selector and download now share a fail-closed check for pricing, compliance, final approval and submission authorization, plus the exact external-completion attestation and current version/checksum. Database mutation/approval gates are unchanged.

The existing export route preserves organization/release/checksum filtering, adds the established per-user rate limit, captures status before reading history, and checks identity, role and revision again after rendering. It refuses changed access or records rather than sending an outdated result. PDF limits: 100 requirements and 100 records per approval/submission history; JSON retains its existing 1,000-record history limit. Unsupported PDF glyphs produce a clear JSON fallback message. External files are referenced, not embedded. Current membership records do not provide a stable display name for every submitter, so IDs remain explicit rather than inventing names.

## Checks run

- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npx playwright test tests/handoff-export.spec.ts tests/handoff-route.spec.ts tests/response-package.spec.ts tests/workflow-guide.spec.ts tests/pursuit-next-step.spec.ts tests/demo-bid-control.spec.ts --project=desktop --reporter=line` — 21 passed, including PDF/Word export regression and desktop/390px workflow controls.
- `npx playwright test tests/handoff-export.spec.ts tests/handoff-route.spec.ts tests/workflow-guide.spec.ts --project=desktop --reporter=line` — 10 passed after adding the visible PDF link assertions and refining the sample fixture.
- `npm run build` — passed; 32 static pages generated. Font and logo tracing includes the new PDF route.
- Generated PDF text checked for source wording, missing approvals, stale evidence warnings, checksum, destination/time zone and receipt limitations. Cover and checklist pages visually reviewed for readable pagination.

Manual acceptance: open an authorized pursuit with a frozen response version, download its PDF, compare the deadline/destination/files with the actual notice, and confirm missing/revoked approvals remain visible. Recheck live status immediately before submitting outside BidXchange. A downloaded PDF cannot update itself after a new amendment or revocation.

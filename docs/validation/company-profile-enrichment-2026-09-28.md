# Company profile enrichment and branding — September 28, 2026

The requested production company profile was refreshed using the supplied CSLB and corporate-filing documents and the company's public team/awards pages. The existing evidence model and audit triggers were reused. The operator transaction compared a fresh pre-change snapshot, preserved unrelated records and original creation dates, updated existing entries rather than duplicating them, and kept every imported item pending human review with no attester identity. Source notes retain filenames, page references, document hashes and historical source dates. Residential officer addresses and signature images were not imported.

A separately named nonprofit corporation's attachment was excluded pending clarification of its relationship. A contractor's license bond was recorded separately from project bonding capacity. Corporate filing dates and secondary-directory status claims were not promoted to current verified standing. No classification-coverage or eligibility determination was made.

Dry-run transaction rolled back successfully; application committed 20 existing-record updates, six additions and a summary update, with 27 audit entries. A fresh read confirmed 59 total records, pending review status, source references, the license/insurance dates, correct mailing address, and exclusion of the separate entity. Private import snapshots, plans and verification results are under ignored `.tmp`, not source control. No schema changes or customer PDF publication.

The UI now displays an optional company logo from an already-authorized identity record named `Company logo`. Only a local `/company-brand/<filename>.png` path is accepted; external URLs, traversal, query strings and ambiguous duplicate records are rejected. The provided public logo is copied unchanged. Branding does not attest the identity record or affect eligibility. Demo workspaces without the record remain unchanged.

Validation:

- `npx playwright test tests/company-portal.spec.ts tests/company-logo.spec.ts tests/company-record-input.spec.ts tests/profile-completion.spec.ts --reporter=line` — 9 passed, including desktop/390px branding display and existing navigation/draft/history behavior.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- Scoped production import dry run, applied transaction and fresh-read assertions — passed.

The imported records still require an authorized person's review before being used as attested bid evidence. Do not infer bid/performance bond capacity, current corporate standing, permission to reuse staff information or nonprofit tax status from these documents.

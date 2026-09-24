# Company review and assistant service profile

Company presentation update: Overview leads with a bounded snapshot of contact, service and territory records and the existing completion checklist. Review queue is a separate section; record links still open Saved records, and profile forms remain mounted when switching sections. Completion describes recorded fields, not qualification. The layout uses only the existing authorized snapshot; no schema or permissions changed.

Company → Review queue provides a guided queue for visible records needing review. Expired/rejected records come first, then licenses, registrations, insurance and bonding. Each item explains what to check and opens the existing record editor and human-attestation controls. A separate disclosure lists missing Level-1 fields and links to the existing Passport steps. Counts concern visible saved records, not eligibility or overall qualification.

The workspace assistant has a read-only service-profile tool returning bounded identity, service and territory samples (3/6/3), preferring recently updated records. Follow-up searches remain available. Normalized provenance distinguishes website claims and user-supplied research without passing source notes or document URLs to the model. Record citations open the exact company record. General mode receives no company data. No migration, new role, automatic attestation or customer-data seed was added.

Validation: `npm test` passed 255 tests, including company desktop/390px navigation, assistant organization/role isolation, general-mode isolation, bounded record sizes and review priority. `npm run typecheck`, `npm run lint`, `npm run test:secrets`, `git diff --check` and `npm run build` passed. Initial browser harness failures were fixed by using the repository's existing Next Link adapter; the secret scan required permission to launch Git.

Manual acceptance:

1. Sign in and select the intended company. Open Company → Review queue, follow a queue item and compare its value with its source. Only an authorized person should attest it.
2. Ask “What work does our company perform, and what still needs review?” in workspace mode. Check citations and pending-claim wording; records are samples, not a complete company inventory.
3. Use Add a PEPMA notice, enter a real authorized notice, create a pursuit, review candidate requirements, link current evidence, sign off and record a human decision. Continue with tasks and a draft response; pending website claims must not become approved response evidence.

The real-notice customer walkthrough is still pending a selected notice. PEPMA's public contracting-opportunities page reported no available listings when checked on September 22, 2026. No private invitation was accessed, no real bid was invented and no GES qualification was attested during implementation. Existing fixture workflows and exports passed; that is not a claim of real-customer acceptance.

Company presentation validation (September 24): 17 targeted Playwright tests passed, including desktop/390px navigation, history, draft retention, pending-evidence labels, viewer empty states, field validation and completion logic. Typecheck, lint, secret scan and production build passed. Overview and review-queue screenshots were inspected at desktop and phone widths. Donn's local four-page walkthrough was regenerated with the new navigation. Authenticated production customer acceptance remains separate from these synthetic browser checks.

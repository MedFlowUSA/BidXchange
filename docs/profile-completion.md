# Company profile completion

The Company portal now has a guided Level-1 completion panel above its reminders and Radar. It shows an accessible progress bar, 60 explicit field checks across six sections, a next incomplete item, a missing-only filter, and links to existing Passport questions or saved records. Progress is calculated on read from authorized saved facts; there is no manually maintained score or new database table.

The percentage measures entry of the selected Level-1 fields, not qualification, current evidence, legal eligibility, approval or bid readiness. Review status appears separately. A complete set of expired or unreviewed records can show 100% entered while still requiring review. Unknown/placeholder values do not count. Negative answers such as “No” can count as recorded information. Applicable dates must parse as valid calendar dates. The fixed checklist does not auto-exempt fields for markets the user does not pursue.

Legacy data receives credit only for identifiable fields and sources. Each item uses one coherent record; duplicate or conflicting rows are not combined to fabricate completion. Structured rows take precedence once available. Legacy categories that cannot hold the current fields link to a Passport form, preserving the earlier record. Source notes count as recorded provenance, not independent verification. Nonadministrators see a visible-record percentage and explicit access limitations. The existing 500-record query bound is disclosed when reached.

Main files: `lib/profile-completion.ts` defines version `california-level-1-v1`; `components/profile-completion.tsx` presents guidance; `company-passport.tsx` supports completing legacy imports; `tenant-workspace.tsx` places the panel in Company. No migration, dependency, role or attestation behavior changes.

Validation covers empty/unknown fields, legacy recognition, exact denominator, duplicate resistance, conflicting records, preservation of source data and independence from evidence approval. Hosted staging checks confirm that a newly saved name/source shows 2/60 (3%), identifies Entity type as missing, and fits a 390px viewport. Only synthetic staging accounts were used and were disabled afterward.

Executed: `npm run typecheck`; `npm run lint`; `npm test -- --workers=4` (227 passed); `npm test -- tests/profile-completion.spec.ts --workers=2` (all four passed after adding the final policy-type guard); `npm run build`; `npm run test:secrets`; `node scripts/staging/onboarding-browser.mjs` with the configured CA certificate. The mobile screenshot was reviewed. The additional guard prevents a mislabeled policy from filling two insurance checklist items.

Recommended follow-up: owner-assigned information requests with due dates, linked to specific missing fields. Buyer-specific optional checklists and a permission-controlled reusable project library can follow. These are recommendations, not features delivered in this release.

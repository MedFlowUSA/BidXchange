# Authenticated walkthrough corrections

The supplied walkthrough was treated as an audit to validate against the existing implementation, not as proof that each described feature was absent.

## Findings addressed

- Intake and registry forms already existed behind native disclosure controls. Their fields now remain rendered inside the disclosure, avoiding the empty server-rendered control. Manual intake appears before portal links, has a prominent Add opportunity control and describes the save-to-pursuit next step. Existing authorization gates remain unchanged.
- Legacy imports used `federal`, `territory` and `naics`, or older labels, while Passport matching primarily expected newer structured records. Bounded category/label aliases now recognize related records. Onboarding counts unique related records and explicitly distinguishes presence from completion or attestation. SAM identifiers do not populate DIR and one insurance policy does not fill other policy types.
- Saved Company sections and records start collapsed. Search, a needs-review filter, per-section reviewed counts and Review next record reduce the continuous wall of forms. Fact links open the containing section and original record. The collection checklist is collapsed and puts license, registration, insurance, bond and approver questions first.
- Radar opens on expiration attention rather than every missing review date. Descriptive records in other views say to review their source, not that their expiration is missing. Standalone UEI/CAGE identifiers do not request renewal dates. Explicit expiration dates remain respected.
- Empty Pursuits links to record or choose an opportunity. Today presents a concrete intake/pursuit next action and states that users need not complete the entire Passport before recording a notice.
- Assistant suggestions use the available opportunity context. Empty company workspaces receive evidence-review questions. Research without saved notices offers intake and company-review links; suggested searches refer to saved records instead of promising new live notices.
- User-facing review choices describe human attestation; internal enum values and authorization behavior remain compatible. Response instructions use “Create a response outline.” Research, source comparison and autofill wording identify human-attested records.
- The authenticated and fictional workspace footer now says “Better evidence. Stronger pursuits.”
- Reports show recorded pipeline, open tasks and evidence review counts. Raw events are collapsed in an administrator audit panel; the shared tenant loader does not retrieve them for nonadministrators. Existing database RLS is unchanged.

## Validation and limits

New regression cases cover legacy category recognition, preservation of pending status, separation of SAM and DIR, and nonexpiring identifiers. The hosted staging browser script also checks onboarding recognition, collapsed Company sections, direct record links, search and the empty-pipeline action before exercising the existing opportunity/pursuit and correction workflow. Tests use synthetic staging records only.

Executed successfully: `npm run typecheck`, `npm run lint`, `npm test -- --workers=4` (224 passed), `npm run build`, `npm run test:secrets`, and `git diff --check`. With the local CA certificate configured, `node scripts/staging/onboarding-browser.mjs` passed against hosted staging; synthetic accounts were banned and their workspace suspended afterward. Initial regression failures were obsolete text selectors and selectors matching newly rendered hidden fields; selectors now target the disclosure or visible accessible control. No failed checks are being represented as passes.

No production company facts, attestation dates, opportunities or decisions are fabricated or changed by this release. No migration or new dependency is required. Native collapsible editors are used instead of introducing a parallel drawer or a new intake wizard. Bulk attestation and new assignment semantics are not added: individual evidence sources and authority still need review. Cross-pursuit outcome analytics and observed real-contractor usability remain follow-up work. The existing manual intake, candidate review, sign-off, decision and task workflow is preserved rather than rebuilt.

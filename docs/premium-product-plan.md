# Premium product direction

Source: user direction in attachment `261dcc3f-963c-4539-af7b-160e1952338c`. Treat the outcome examples and numerical scores as illustrations, not evidence about any customer or current service capability.

## Delivery sequence

1. Complete a client operating loop: Company Passport, reviewed evidence, requirement-level qualification, a human decision record, pursuit execution, final approval and submission evidence.
2. Add official opportunity supply with source/freshness disclosure, deduplication, retained snapshots, amendment detection and acknowledgment. SAM.gov is the first proposed connector; provider access, terms and implementation details must be validated before connection.
3. Enable grounded assistance only through the existing validation and activation gates. AI must not verify claims, establish eligibility, approve pricing, sign or submit.
4. Expand explicitly scoped operator assignments and queues, then portfolio reporting and service operations.
5. Add award intelligence and outcome learning when actual records can support the conclusions.

## First increment: guided Company Passport

The Company page now offers eleven interview areas with concrete suggested entries and an explanation of why each matters. Topics include identity/signatories, capabilities/classifications, geography, licenses, registrations/certifications, insurance/bonding, capacity/equipment, experience, personnel, safety/compliance and proposal materials.

Each suggested entry uses the existing tenant-authorized evidence mutation: value, source, owner, sensitivity, verification metadata, dates and notes remain in the existing record model. Unknown answers stay blank. Single-project and aggregate bonding prompts are separate. No new database permissions or customer records are introduced.

Navigation preserves open draft state between questions within the page. The URL fragment restores the selected question on return; only explicit saves persist evidence. Existing exact category/label matches link to their saved evidence for review. Suggested questions are not an applicability catalog or proof of completeness. The existing evidence list and custom entries remain available for multiple licenses, registrations and project references.

Shared evidence forms retain the version associated with their draft and require a fresh load after a successful correction. This avoids pairing old text with a refreshed edit timestamp.

Validation: 13 evidence/readiness/tenant-record regressions pass, as do type checking, linting, formatting and secret scanning. `scripts/staging/passport-local.mjs` passed against the staging database with a local isolated app: question-fragment resume, draft preservation between steps, save/reload, saved-evidence links, mobile containment, verification invalidation, stale-edit rejection and role revocation. Synthetic evidence and the temporary account were removed and the fixture was suspended again. No production customer information was entered or changed.

## Remaining acceptance criteria

### Renewal follow-up increment

Today and Company now show an authorized-view renewal queue for expired evidence and dates within 60 days, with owners and direct evidence-review links. Verified, otherwise supported claims automatically display as expiring within that window; missing verification still displays as needing review. Saved verification is never rewritten by these reminders. Urgent renewal dates are ordered before undated review work, and equal-priority evidence is sorted by expiration date.

Date comparisons use UTC calendar dates, disclosed in the UI. The expiration date itself displays as “Expires today,” not already expired. Invalid dates fail to Needs review and do not create invented countdowns. The list discloses the 500-entry authorized-view limit and does not count inaccessible evidence. This is an in-app queue, not email notification delivery or a readiness/eligibility score.

Eight focused readiness/input tests pass, covering the 60/61-day boundary, expiration day, invalid dates, ordering and preservation of unknown verification. The staging-backed Passport browser test also checks the 30-day reminder and removal of a restricted item from the renewal view after role revocation.

### Pursuit decision-review brief

Authenticated pursuit pages now summarize visible requirements for the bid/no-bid discussion. Blocked follow-up comes first, followed by stale evidence approvals and other unresolved items. Each entry links to its requirement and identifies missing citation, owner, information or current visible evidence approval. Current evidence approvals are counted only as supporting reviews, never as compliance or eligibility. “Not applicable” reviews do not waive requirements.

The brief uses the existing tenant-scoped records without new queries or migrations. It discloses the review date, restricted visibility and record limits, and gives explicit guidance for an empty register. Human bid-decision recording remains disabled by the existing database guard; this is preparation for that workflow, not a substitute for an attributed decision record.

Ten focused brief and tenant-loading tests pass, along with type checking, lint, production build and secret scanning. The staging browser test exercises current approvals, stale-source invalidation, direct requirement links, missing owners, restricted-view changes and mobile containment.

### Remaining decision model

The next operational increment adds a Today task queue and direct saved-record links. Attributed bid/no-bid/reopen decision recording is implemented and validated in staging, with production migration 010 awaiting named approval. See [the pursuit workflow release](pursuit-decision-release.md) for authority boundaries, context-change handling and remaining work.

The next increment is implemented and staged: evidence applicability and proposal-use reviews for a specific fact version and pursuit requirement. Production migrations and feature-flag activation have been approved, and migrations are installed; see [the release report](evidence-use-release.md). This provides pair-level approval and invalidation, not whole-proposal authorization or complete contextual qualification.

- Typed repeatable claims, applicability decisions and explicit field-level requiredness by pursuit context.
- Supporting-document relationships, scanned uploads, version history and authorized downloads.
- Whole-proposal approval built on the staged pair-level evidence reviews, with complete version history and document provenance.
- Deterministic eligibility factors with requirement-to-evidence links, reasons and unknown/failed states; no score from incomplete or role-filtered samples.
- Attributed human bid decisions and conditions, followed by versioned approval gates and submission receipts. Existing database decision/submission guards must not be removed casually.
- Persistent critical-action summaries, mandatory-event scheduling and meaningful notifications after the underlying deadlines/ownership model supports them.
- No blanket operator access, automatic certifications, automated submissions or unverified claims of production AI availability.

The guided Passport is an onboarding improvement, not completion of the full premium blueprint. The next data-model increment should establish repeatable claim identity, applicability, document provenance and proposal-use approval before claiming contextual readiness or automating qualification.

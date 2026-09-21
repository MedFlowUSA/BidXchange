# BidXchange Privacy Policy and Terms review

Prepared September 21, 2026. Status: **drafts, not yet effective**. The owner authorized deployment with draft labels intact; publication does not finalize or record acceptance of these proposed terms.

The source text is `apps/web/lib/legal-documents.ts`, rendered at `/privacy` and `/terms`.
Both pages carry a draft banner, exclude search indexing and remain outside the sitemap.
Links appear in the public footer, sign-in page and conditional demo-request form.
Viewing a draft or signing in does not record acceptance of these proposed Terms.

## Confirmed by the owner

- Operator: BidXchange LLC.
- Business location: Redlands, California 92373, United States.
- Contact: Manuel Rodriguez, mrodriguez@oaisinc.com.
- No street mailing address supplied. The drafts invite email contact to arrange postal correspondence; they do not invent an address or claim independent verification of entity registration.

## Review before making effective

These drafts need qualified legal review and confirmation of business practices beyond the repository. The following are proposed choices, not instructions already approved by the owner:

1. Terms section 12 proposes a liability cap of the greater of $100 or affected-service fees paid in the prior twelve months, with specified exclusions. Confirm suitability, enforceability, insurance and negotiated customer commitments.
2. Section 13 proposes California law and courts serving San Bernardino County, without mandatory arbitration or a class-action waiver. Confirm the entity's formation jurisdiction and intended customer markets.
3. Confirm adult-only business use, pilot availability, suspension, warranties, intellectual property, AI output rights and paid-plan terms. No fee, automatic renewal, uptime SLA or managed procurement service is created here.
4. Supply a complete business mailing address if appropriate or legally required. Confirm that the stated mailbox is monitored for privacy requests and legal notices.
5. Establish documented retention periods, deletion/export procedures, identity verification, response deadlines, legal holds and backup handling. Immutable application history is not a blanket exemption from privacy law. The app has no universal automated erasure process; member removal and clearing chat are not erasure.
6. Confirm actual provider contracts, processing locations, support access, email handling, AI project data-sharing settings and retention. No Zero Data Retention approval, regulatory certification or geographic hosting guarantee is asserted.
7. Confirm any off-platform marketing, CRM, analytics, data transfers or sales/sharing practices. The repository observation about absence of advertising integrations does not establish the company's entire conduct. Counsel should assess CalOPPA, CCPA/CPRA and other applicable law, notice-at-collection and signal/opt-out requirements; applicability is not established here.
8. Check customer/processor responsibilities and whether a data-processing agreement, subprocessors list, transfer terms or incident-notification provisions are needed for the actual markets served.
9. Once final wording is approved, assign an effective date and version, remove draft-specific language, update indexing deliberately and implement an appropriate notice/acceptance process for both existing and new customers. Preserve the accepted version and evidence of acceptance where required. Do not turn the current contact-permission checkbox into contractual acceptance implicitly.

## Implementation evidence used

- Authentication and app authorization: `apps/web/app/login`, `apps/web/lib/supabase`, organization roles and database row-level security.
- Conditional intake: `apps/web/components/demo-request-form.tsx`, `apps/web/app/demo-request-actions.ts`; the current public email fallback opens an email client and does not itself submit a request.
- AI: application assistant routes and provider requests, plus `docs/public-demo-ai.md`. General/demo prompts do not automatically attach private company records; user-entered text is still sent to the provider. Requests use `store: false`; metadata, feedback and keyed digests are distinct from chat display state. No universal application retention schedule is inferred from older suggested documentation.
- Demo state and guidance: `apps/web/components/workspace.tsx`, `apps/web/components/workspace-guide.tsx`; local storage is distinct from database records. Demo AI security cookie and usage controls are disclosed separately.
- Document review: browser-side final-file hashing, external references, human versioned approvals and manual submission records. Private file uploads and live connector coverage are not described as enabled.
- Company profiles: structured business evidence and authorized automatic population into working documents; personnel/reference records may contain third-party business contacts.

Recheck these facts whenever integrations or production flags change. These pages themselves do not change database access, enable AI, activate uploads, add tracking or implement deletion workflows.

## Primary references consulted

- [FTC consumer privacy guidance](https://www.ftc.gov/business-guidance/privacy-security/consumer-privacy): privacy representations must match actual practices.
- [California Attorney General CCPA guidance](https://www.oag.ca.gov/privacy/ccpa): rights and obligations depend on the statute's scope and applicable criteria.
- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data): response storage and provider retention controls are separate concepts; disabling storage is not an unconditional zero-retention promise.

The source review informs the drafts; it is not a determination that the business complies with every applicable law.

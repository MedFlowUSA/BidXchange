# Landing-page specificity revision — September 21, 2026

## Outcome and deployment

The existing public page now defines the government-contracting workspace, intended customer and concrete review outputs. The navy, sapphire and gold design, fictional bid-review illustration, authentication behavior and route structure are preserved. The revision was initially held locally under the supplied brief’s no-automatic-deployment instruction. The user subsequently explicitly requested deployment; this release commits and publishes the tested changes through the existing main-branch Vercel workflow.

## Copy replaced

Removed “A bid worth pursuing,” “A decision you can defend,” “Less chasing. A clearer bid review,” “For the people who put the bid together,” and “Put the workflow to the test.” Replaced the ambiguous statement that proposal submission is disabled with separate descriptions of working drafts, human approval/submission records and manual portal delivery. Removed the promotional “You Win” wording from the social-image alt text.

Final headline:

> Know whether a government bid fits—before your team spends days preparing it.

Supporting copy:

> BidXchange connects solicitation requirements with your company’s licenses, registrations, insurance, bonding, experience and supporting evidence. See possible disqualifiers, assign missing work and document the decision to pursue or pass.

## Page organization

The existing hero retains its fictional license/bond/site-visit example. A product definition and bid-board distinction follow it. Three deliverable groups replace the generic capability cards: qualification review, remaining work, and response/review records. Four contractor problems sit in one expandable section. Company Passport has its own compact section with additional categories behind disclosure. A six-step ordered workflow is followed by available/manual/not-enabled disclosures. Specific AI questions and mode boundaries precede the target-customer, prospective managed-support and FAQ section. The closing invitation is “Bring one opportunity. See the decision process.”

The page contains more detail than the previous compact version. Problems, secondary Passport categories, availability detail and FAQs use native disclosure controls to limit initial reading length. It adds no dashboard embed, stock imagery, animation or client-side marketing dependency.

## Capability evidence and limits

| Public statement                                                       | Implementation or release evidence                                                                                  | Qualification                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Company Passport categories and verification/expiration                | `lib/company-readiness.ts`, `lib/company-record-input.ts`, company components                                       | Equipment is information within capacity records, not a dedicated inventory tool. Sensitive categories remain restricted.                                                                                                |
| Requirements, evidence-use review, findings, tasks and human decisions | Tenant workflow, requirement-resolution, evidence-use and pursuit-decision components; `docs/pursuit-workflow.md`   | Recorded requirements can be incomplete. No automatic eligibility certification or real-world fit score is claimed.                                                                                                      |
| Response outline and working PDF/Word                                  | `lib/response-command.ts`, `lib/response-package.ts`, `lib/response-render.ts`; `docs/response-workspace.md`        | Selected pursuit and editing permission required for creation. Only permitted, current approved company information is reused. Technical content and prices remain human work.                                           |
| Version-bound approvals and human submission records                   | `components/response-release.tsx`, enabled flag in `vercel.json`; `docs/response-workflow-deployment-2026-09-21.md` | Role-controlled records, not portal delivery, signature or independent receipt verification.                                                                                                                             |
| AI workspace/general modes                                             | `lib/ai` implementation; `docs/ai-general-activation.md`, `docs/public-demo-ai.md`                                  | Workspace activation and quotas apply. General mode has no attached company records or live web browsing. Some requested assessments cannot be answered from the available evidence. Public-demo general AI is separate. |
| Manual opportunity intake; SAM.gov pending                             | `lib/sources/sam.ts`, source release documents and latest production migration checkpoint                           | Connector code is implemented. Official-source hosted validation and production activation are not represented as complete. Broad live feeds are not enabled.                                                            |
| External supporting files                                              | Document security and response workflow documentation                                                               | Private uploads remain disabled. No scanner hosting or storage settings changed.                                                                                                                                         |
| Organization-scoped information                                        | `docs/security.md`, existing validated-session loader, role checks and RLS                                          | No new security certification, universal confidentiality or MFA claim. Shared pursuit information remains visible to authorized workspace members.                                                                       |

Earlier architecture/product documents contain historical feature-status statements. Current release reports and implementation take precedence. No provider credentials, production records or activation settings were changed during this revision.

## Contact behavior

Header and hero use “Request a Bid Review”; the secondary CTA remains “Explore the Demo.” The primary CTA anchors to `#request-demo`. Its email link opens the visitor’s email application addressed to Manuel Rodriguez at `mrodriguez@oaisinc.com`, with the subject “BidXchange bid review request.” It does not send a message, save a lead or claim delivery.

A read-only production browser check found one existing email fallback link and zero forms. The conditional saved-intake component remains behind its existing configuration gate. Its public labels and staging selectors are updated; its field schema, consent, server action and storage behavior are unchanged. Requested trade/market/agency/link information can fit in the existing optional message field; no new data fields or migration were introduced. The public copy asks for only basic contact/business context and an optional public opportunity link/message, and explicitly says not to email confidential records.

Managed support and founding-customer pricing remain under development. No plan price, service-level promise, award guarantee or automatic enrollment was introduced.

## SEO and accessibility

Title: `BidXchange | Government Bid Qualification and Pursuit Workspace`.

Description: `BidXchange helps contractors connect solicitation requirements with company qualifications, identify missing evidence, assign follow-up work and document bid/no-bid decisions.`

Open Graph and Twitter use the same copy. Canonical URL, bare-root indexing, query noindex and protected/demo noindex remain unchanged. No JSON-LD structured data was present; none was added, avoiding invented offers, ratings or affiliation.

Native sections, headings, an ordered six-step list and keyboard-operable details/summary controls provide structure. The existing skip link, mobile menu Escape/focus behavior, focus outlines and reduced-motion rules remain. Mobile bid-review rows stack status beneath the requirement, with larger evidence/status text; the fictional-data notice and footer legal text are more readable. Headline text balances at responsive widths. Visual previews at 390 and 1440 pixels showed no horizontal overflow; automated bounds checks also covered 360, 768 and 1024 pixels. This is not a formal WCAG conformance audit.

## Files changed

- `apps/web/app/page.tsx`: positioning, sections, FAQs and metadata.
- `apps/web/components/landing.module.css`: compact section layouts, disclosures, responsive text and legal-copy sizes.
- `apps/web/components/bid-preview.module.css`: mobile example readability.
- `apps/web/components/marketing-header.tsx`: workflow anchor and bid-review CTA.
- `apps/web/components/interest-preview.tsx`: opportunity-specific invitation and contact instructions.
- `apps/web/components/demo-request-form.tsx`: matching labels on the gated form.
- `apps/web/lib/operations-contact.ts`: email subject.
- `scripts/staging/intake-hosted.mjs`: updated selectors; hosted intake was not rerun.
- `tests/marketing.spec.ts`: revised copy/metadata/contact assertions and capability-boundary keyboard tests.
- `docs/marketing-homepage.md`: points historical readers to this report.
- This report.

Unrelated `.gitignore` changes and the untracked September 19 audit were preserved.

## Executed checks

| Command or check                                                                                      | Result                                                                                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npx playwright test tests/marketing.spec.ts tests/routes.spec.ts --project desktop --project mobile` | 20 passed: copy, disclosures, keyboard, contact, mobile menu, bounds, SEO, demo and protected-route regressions.     |
| `npm run test:intake`                                                                                 | 1 passed: isolated database test of service-only intake, persisted quotas, operator permissions and versioned edits. |
| `npm run typecheck`                                                                                   | Passed.                                                                                                              |
| `npm run lint`                                                                                        | Passed.                                                                                                              |
| `npm run format:check`                                                                                | Passed.                                                                                                              |
| `npm run build`                                                                                       | Passed, 23 static pages generated and existing routes retained.                                                      |
| `npm run test:secrets`                                                                                | Passed, 340 files at execution.                                                                                      |
| `npm audit --audit-level=low`                                                                         | 0 vulnerabilities.                                                                                                   |
| `git diff --check`                                                                                    | Passed.                                                                                                              |
| Local desktop/mobile screenshot review                                                                | Passed at 1440 and 390 pixels; screenshots retained only in ignored `.tmp/landing-review`.                           |

No production message, lead, paid AI request, database migration or deployment was performed. Actual inbox delivery, a hosted intake submission and a signed-in production session were not tested by this copy revision.

After the final headline-balancing and legal-text sizing change, the responsive-content test was rerun on desktop and mobile: 2 passed, each covering 360, 390, 768, 1024 and 1440 pixels. The production build included these final style changes.

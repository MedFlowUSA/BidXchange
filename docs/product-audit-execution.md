# Product audit execution — September 19, 2026

Source: the user-supplied live audit in attachment `423d2393-94a4-45e0-8d2b-6ddc19798f43`. Its product recommendations are direction, not evidence that fictional-demo functionality is operational for authenticated companies. The separate AI diagnostic approval remains pending.

## First implemented slice: readiness guidance

Today now identifies one prioritized action from the user's visible saved facts, linking directly to its company record. Expired evidence precedes rejected, future-effective, unverified and expiring evidence. The action explains who supplies the records and who can review them. An empty authorized view does not imply the company lacks records or is ready to bid.

Company now groups existing facts into expandable review areas: company basics, capabilities, geography, registrations/certifications, licenses, insurance/bonding, capacity, experience, personnel, compliance and proposal assets. Existing nonstandard fact types remain available under Other company records. Document metadata is linked contextually; unavailable uploads are described accurately. The shared screen uses the selected organization's initials and refers to its authorized representative rather than a specific company's contact.

Readiness labels account for expiration/effective dates and require a value, evidence reference and human verification metadata before displaying Evidence reviewed. This is not a procurement eligibility determination or proposal-use approval. The loader supplies one evaluation timestamp for consistent server/browser rendering. Existing RLS and administrator-only review mutations remain unchanged.

No percentage is shown: the current query is role-filtered and limited to 500 facts, and the complete applicability/evidence model does not exist. An unsupported score would imply knowledge the application does not have. Empty areas explicitly say that no records are visible, not that private information is missing.

This is guidance over existing records, **not** the complete onboarding wizard. New field capture, save/resume, owners, applicability decisions, evidence uploads, proposal-use approval and a separate company-operations queue still require implementation. The current guidance is deployed; see the release checkpoint below.

## Ordered delivery plan

| Step                          | Concrete deliverable                                                                                                        | Acceptance boundary                                                                                                                |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 1. Structured onboarding      | Small saved steps for identity, work, geography and registrations, followed by restricted capacity/personnel/evidence steps | A permitted user can enter, resume and correct data; each field has source/owner/classification; unknown and not-applicable differ |
| 2. Human evidence review      | Reviewer queue, provenance, expiration, applicability and proposal-use decisions                                            | Role-scoped authorized review with audit history; expired or unsupported facts never imply eligibility                             |
| 3. Managed opportunity intake | Operator-created opportunity with source, buyer, dates and explicit requirements                                            | One real record persists under the correct tenant; no implied procurement connector                                                |
| 4. Qualification and decision | Evidence-linked disqualifiers, missing-information state and authorized bid/hold/no-bid decision                            | Missing evidence cannot become a pass; a score never overrides a disqualifier; decision records actor and reason                   |
| 5. Pursuit execution          | Persisted tasks, owners, deadlines, requirements and clarification tracking                                                 | Approved decision opens the correct pursuit; real actions survive reload and remain tenant-scoped                                  |
| 6. Evidence and final review  | Private validated/scanned uploads, scoped retrieval and review gates                                                        | Files stay inaccessible until authorized validation; pricing and submission require human approval                                 |
| 7. Submission/outcome         | Submission proof and authorized outcome entry                                                                               | Recorded proof is distinguishable from an actual submission action; no automatic bid submission                                    |

The first operational release should prove this journey for one approved organization and one manually entered opportunity before widening scope. The audit's entire field catalog is a backlog, not a requirement to expose one enormous form. Forms must be scoped by business relevance and sensitivity.

The user confirmed Manuel Rodriguez (`mrodriguez@oaisinc.com`) as the demo-request contact and initial operations owner. The homepage now has a direct email contact instead of the disabled form. A separately configured saved-request form and protected operator queue have been implemented locally, with minimal data collection, consent, persistent abuse limits, version-checked edits and contact-data erasure. No account permissions are inferred from the contact assignment. See [demo intake release](demo-intake-release.md) for the implementation, validation and activation steps. No email or external message was sent; hosted activation, operator enrollment and a retention schedule remain outstanding.

Navigation cleanup is implemented locally: the primary items are Today, Opportunities, Pursuits, Company and Assistant. Reports is under More, Settings is under Account and organization, and demo documents are reached from Company. The live Company readiness view already links authorized document records. Existing route URLs are preserved. Company/account avatars no longer contain hard-coded initials from a particular customer.

Live pursuit placeholder sections are collapsed under Planned pursuit tools, leaving the overview, human-decision boundary and visible tasks prominent. Placeholder wording no longer asserts that no saved records exist when the section has not queried those records. The fictional demo keeps its roadmap expanded for rehearsal. This does not enable live approvals, submissions or pursuit mutations.

Sixteen desktop/mobile workspace and route checks passed after navigation changes; type checking and lint also passed. These UI changes are separate from the reviewed intake deployment and are not deployed yet. Broad analytics, notifications, connectors and outcome learning remain deferred until there is reliable workflow data.

The saved-intake flow has since passed real staging browser/JWT tests and schema parity. Production migration 006 was applied after explicit approval; production application deployment is awaiting a separate explicit approval following automatic review rejection. The business-email account does not yet exist, so no operator grant was made. See the intake release report for exact status.

## Validation and boundaries

Five new readiness tests cover expired/future-effective evidence, incomplete verification, action priority, legacy/unknown categories and empty role-filtered views. Together with six existing direct-record tests, all 11 focused checks passed. TypeScript and ESLint passed. Build, formatting and secret checks are recorded in the task completion.

No new hosted role test is claimed for this UI change. The previous 124 hosted AI/staging checks belong to the earlier deployed staging build, not this local readiness work. No provider request, diagnostic deployment, billing change, organization activation or production data write was made. Approval for those actions cannot be inferred from the audit attachment.

## Latest release checkpoint

The preceding validation paragraphs describe earlier checkpoints. Following the user's deployment authorization, the readiness, navigation, pursuit-placeholder and direct-record improvements were released to `https://bidxapp.vercel.app` in deployment `dpl_F52ZeUbruvnKN2kkvTQ61PYNc36d`. Protected staging is deployment `dpl_CCac3sT3DcfiLwTY2pexYGGGBRUX` at `https://bidxchange-staging.vercel.app`.

All 93 local regression tests passed. A fresh real staging viewer/browser check confirmed that expired evidence becomes the dashboard's next action, links to the correct company record, and does not expose restricted facts. Authenticated secondary reports/settings links and mobile containment passed. Synthetic facts and viewer were removed; the pre-existing synthetic organization was returned to suspension without weakening the last-administrator guard. Production desktop/mobile checks confirmed five primary links, secondary Reports and contextual Documents; contact and disabled-AI safeguards remained intact.

The intake migration and public email contact are released. Saved intake and operator access still await the verified business-email account. Structured onboarding capture, live opportunity intake/qualification decisions, pursuit mutations, document scanning and submission proof remain open work; this release does not claim the full audit is complete.

## Evidence capture release

Company evidence capture and correction are now implemented and deployed in `dpl_76b5WMmEK6fjowbSTayd7dthkKPX`. Administrators can save individual records within readiness areas, assign an active owner, retain source and dates, choose permitted visibility, and return later. Every save through the editor clears prior verification and requires a fresh human review. Concurrent corrections use a saved timestamp and reject stale overwrites. The editor loads on demand and preserves entered text on failed saves.

Real staging administrator/browser tests passed creation/reload, verification stamping, correction invalidation, stale-edit rejection, role revocation and restricted-record isolation. The user-facing flow now supports basic persisted evidence onboarding; the audit's full typed field catalog, applicability and proposal-use approvals remain to be implemented. See [company evidence editor](company-evidence-editor.md) for exact scope and validation. This release uses existing permissions and needs no new migration.

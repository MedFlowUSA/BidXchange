# Phase 2 completion report

The existing beta now has routed demo pages and a separate authenticated organization foundation. This remains an onboarding beta; actual inbox delivery, privileged-browser workflow testing, MFA and operational hardening are still required before a production pilot.

## Architecture and routes

Preserved the branding, responsive design, fictional intake/scoring/checklists and local storage. Shared navigation now uses links. Real tenant pages use server-loaded Supabase data; demo state never seeds real records. Routes: `/`, `/dashboard`, `/opportunities`, `/opportunities/[opportunityId]`, `/pursuits`, `/pursuits/[pursuitId]`, `/company`, `/documents`, `/reports`, `/settings`, `/login`, `/auth/callback`.

The dedicated pursuit foundation includes overview, pending bid decision, source, deadlines/timezone, team, compliance, tasks, documents, questions, proposal sections, risks, reviews, approvals, submission and activity. Unimplemented actions are clearly labeled. Demo checklists remain functional. Export now produces a nonempty download and visible confirmation. Settings, authorized workspace selection, bounded global search and the future AI panel are implemented.

## Database and authorization

Applied migrations:

1. `20260919000100_tenant_foundation.sql`: normalized organizations/memberships/profiles/facts, structured company categories, operational pursuit tables, audit triggers, RLS and closed private storage.
2. `20260919000200_ges_onboarding.sql`: insert-only, idempotent GES facts/preferences/checklist.
3. `20260919000300_admin_mutation_limit.sql`: persistent per-user sensitive-action throttling.
4. `20260919000400_organization_identity.sql`: immutable organization identity and timezone validation.

All public tenant tables enforce active membership. Profile/membership administration is restricted to administrators; operational writes are administrator/capture-manager only; sensitive categories have narrower read access. Server actions additionally validate role and inputs. Composite foreign keys, immutable tenant IDs, final-administrator protection and client-immutable audit history are enforced in the database.

## Authentication and ownership

Passwordless magic links and email codes establish HttpOnly sessions. The server validates users, refreshes sessions through the proxy and protects organization routes. Callback templates and production/local callback configuration are applied. Application code does not handle passwords or service-role credentials.

Manuel's explicitly supplied email was provisioned through the protected setup command with an active GES `organization_admin` membership. Email remains unconfirmed until Manuel signs in. No generated link impersonated Manuel, and no sign-in email was sent by the setup/tests. Donn's account was not created; Settings has an honest invitation placeholder awaiting his exact email and the invitation implementation.

## GES data and verification

Organization: Green Energy Solutions; legal entity Peace Officers for a Green Environment; website https://www.gesfree.com/; Contractor; onboarding; America/Los_Angeles. There are 31 pending facts, 12 monitoring preferences and 27 missing-information items. The real pipeline and private document library start empty. No fictional awards, revenue, personnel, insurance, bonding, certifications or past-performance data were imported.

| Identifier or claim                        | Stored value                                  | Status                                                            |
| ------------------------------------------ | --------------------------------------------- | ----------------------------------------------------------------- |
| CSLB                                       | 936656                                        | pending_verification; current CSLB/company evidence required      |
| License classes                            | B General Building; C-53 Swimming Pool        | pending_verification; not represented as active                   |
| UEI                                        | WUVYAQA917S8                                  | pending_verification                                              |
| CAGE                                       | 9S2Z6                                         | pending_verification                                              |
| Primary NAICS                              | 238990, All Other Specialty Trade Contractors | pending_verification                                              |
| SAM registration activity                  | Not provided                                  | Needs information; no active claim                                |
| Operating history                          | Approximately since 2009                      | pending_verification; no formal years-in-business claim           |
| Identity, website, six service territories | Supplied working facts                        | pending_verification                                              |
| Fifteen capabilities                       | Supplied working categories                   | pending_verification                                              |
| Independent C-10 authority                 | Not provided                                  | Not claimed; EV work includes approved electrical-partner warning |

The complete fact values and source notes are in `packages/database/ges-seed.json`. An administrator must save evidence then explicitly verify a fact. Changing evidence/value invalidates prior verification.

## Information still needed from Donn/GES

1. Legal mailing address
2. Primary business phone
3. Authorized company email
4. Exact formation date
5. Current CSLB status
6. Current SAM.gov status
7. Secondary NAICS codes
8. NIGP/commodity codes
9. Insurance carrier and limits
10. Policy expiration dates
11. Single-project bonding capacity
12. Aggregate bonding capacity
13. Geographic restrictions
14. Minimum preferred project value
15. Maximum preferred project value
16. Current delivery capacity
17. Approved subcontractors
18. Electrical/C-10 partner
19. Key personnel/resumes
20. Safety record
21. Certifications
22. Public-agency references
23. Utility references
24. Approved past-performance projects
25. Standard pricing authority
26. Final bid approver
27. Final pricing approver

Donn's exact login email is separately required before any invitation.

## Executed checks

- Desktop/mobile/scoring Playwright suite: 20 passed. Covers routes, direct links, refresh, browser history, protected redirects, demo persistence, detail pages, Settings, search, export content, mobile menus, keyboard navigation and dialog focus.
- Authenticated browser suite: 14 checks passed locally using disposable accounts, both magic-link and code sign-in, authorized direct links, refresh, workspace switch, cross-tenant denial, viewer restrictions and sign-out. All fixtures removed.
- Database suite: 251 checks passed against the applied schema, including cross-tenant reads/updates/deletes, denied inserts and foreign references, role escalation, anonymous denial, administrator verification, audit protection, seed idempotency and pristine GES assertions. Fixtures rolled back.
- TypeScript, ESLint and production Next.js build passed.
- Formatting check and source-secret scan passed; the scan covered 78 tracked/unignored source files.

Automated tests did not send emails or validate Manuel's actual mailbox, administrator browser submissions, long-lived token expiry, or a production document workflow. Those are explicit remaining limits, not claimed passes.

## Environment, deployment and remaining work

Supabase URL/publishable key are configured. Production SITE_URL is now configured as https://bidxchange-beta.vercel.app. No additional application secrets are required for this phase. For reliable external email delivery, configure an owned sender/custom SMTP and verify its receipt; do not store provider secrets in Git. See [setup](setup.md) for commands, staging guidance and rollback, and [security](security.md) for remaining production limits.

Release sequence: run all checks, commit/push the reviewed changes, deploy the linked Vercel project, and verify production routes/auth with disposable accounts. Keep migrations and GES records intact if rolling back the application.

## Exact next recommended task

“Continue the existing BidXchange app. Complete the controlled GES onboarding pilot: verify SMTP delivery and Manuel's first sign-in, add and test administrator MFA, implement expiring organization invitations for explicitly supplied emails, and finish administrator edit/verification browser tests in a separate staging project. Preserve RLS, audit history, demo separation and all pending-verification labels. Do not enable uploads, live connectors, pricing, approvals or submission until their separate security gates pass.”

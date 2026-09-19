# Security boundaries

The public Apex demo remains fictional and browser-local. Real organization data is loaded through a validated Supabase user session and active database membership. Browser organization IDs are untrusted; unauthorized IDs render access denied without switching organization. Next.js streamed not-found responses can have HTTP 200; their content contains no protected record.

Every public tenant table has RLS. Server actions independently require administrator membership, validate inputs and invoke a persistent per-user mutation limit. Database policies enforce ownership and roles even for direct API calls. Tenant IDs are immutable, composite foreign keys prevent cross-organization parent references, and a serialized guard prevents removal/demotion of the final active administrator. No test-only bypass exists.

Ordinary members cannot create organizations, grant themselves membership or edit roles. Administrators control profile and membership changes; administrators/capture managers can write operational records under RLS. Sensitive insurance, bonding, personnel and similar tables restrict reads to administrator, executive approver and estimator roles. Audit reads are administrator/executive only; ordinary clients cannot insert, update or delete audit history. Audit triggers capture changes transactionally. Inspect migration 001 for exact table policies before expanding any role.

Fact verification requires an authenticated administrator, saved source evidence and database-stamped actor/time. Changing a fact or its source invalidates prior verification. Status alone is not a substitute for checking current evidence and expiration; no automatic expiration scheduler exists yet. GES seed facts are pending, not verified proposal credentials.

The app uses server-only Supabase clients and HttpOnly, SameSite=Lax cookies, with Secure cookies in production. Proxy refreshes sessions; server loaders validate the user. Responses are private/no-store. Redirect destinations are locally allowlisted and callback origins use configured SITE_URL. Passwords are neither requested nor handled. Auth errors log only a code, never a token. Development request logging is disabled to avoid callback tokens in logs. Configure hosting log redaction/retention for query strings before production.

Service-role keys are absent from application environment requirements. Protected operator scripts obtain them from the authenticated CLI into memory only. Restrict operator CLI access and run test suites in a dedicated test project. Never capture raw CLI key/dump output. Local environment files and CLI state are excluded from Git and Vercel uploads.

`company-private` is a private PDF bucket with a size limit and no client storage policies. Uploads/downloads remain unavailable pending malware scanning, content validation, tenant path policies and authorized expiring signed URLs. Private documents have not been uploaded or committed.

## Before production use

- Verify delivery to Manuel's actual inbox and complete his first sign-in. Hosted default SMTP has recipient restrictions and low quotas; configure an owned sender/custom SMTP before inviting external users. Automated tests do not exercise actual inbox delivery.
- Add privileged-user MFA enrollment/enforcement. Provider TOTP support remains enabled, but the app does not enforce MFA.
- Implement invitations with exact supplied emails, expiry/revocation and rate limits; Donn has no account.
- Add auth abuse protection, monitoring/alerting, backups and a rehearsed restore, retention/deletion policy and incident response.
- Add document scanning and private-download authorization tests before enabling storage policies.
- Add pagination and database search. Reads/search currently cover at most 500 records/category and 100 audit events; record routes use that bounded collection.
- Exercise administrator forms with dedicated staging accounts before an operational pilot. Database administrator policies/verification guards are tested; automated browser fixtures currently use viewer roles.
- Test actual token-expiry refresh over time, MFA and email-provider outage handling. Initial sessions/sign-out are tested, not every provider failure mode.
- Establish separate staging and production Supabase projects for ongoing development.

No live procurement connectors, AI analysis, automatic pricing, automated approvals or portal submission are enabled. Demo scoring is illustrative and does not authorize real bids.

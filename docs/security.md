# Security boundaries

The public Apex demo remains fictional and browser-local. Real organization data is loaded through a validated Supabase user session and active database membership. Browser organization IDs are untrusted; unauthorized IDs render access denied without switching organization. Next.js streamed not-found responses can have HTTP 200; their content contains no protected record.

Every public tenant table has RLS. Server actions independently require administrator membership, validate inputs and invoke a persistent per-user mutation limit. Database policies enforce ownership and roles even for direct API calls. Tenant IDs are immutable, composite foreign keys prevent cross-organization parent references, and a serialized guard prevents removal/demotion of the final active administrator. No test-only bypass exists.

Ordinary members cannot create organizations, grant themselves membership or edit roles. Administrators control profile and membership changes; administrators/capture managers can write operational records under RLS. Sensitive insurance, bonding, personnel and similar tables restrict reads to administrator, executive approver and estimator roles. Audit reads are administrator/executive only; ordinary clients cannot insert, update or delete audit history. Audit triggers capture changes transactionally. Inspect migration 001 for exact table policies before expanding any role.

Fact verification requires an authenticated administrator, saved source evidence and database-stamped actor/time. Changing a fact or its source invalidates prior verification. Status alone is not a substitute for checking current evidence and expiration; no automatic expiration scheduler exists yet. GES seed facts are pending, not verified proposal credentials.

The app uses server-only Supabase clients and HttpOnly, SameSite=Lax cookies, with Secure cookies in production. Proxy refreshes sessions; server loaders validate the user. Responses are private/no-store. Redirect destinations are locally allowlisted and callback origins use configured SITE_URL. Passwords are neither requested nor handled. Auth errors log only a code, never a token. Development request logging is disabled to avoid callback tokens in logs. Configure hosting log redaction/retention for query strings before production.

Tenant workspace reads and mutations use the authenticated user's client, never a service-role key. The separately gated public demo-intake feature uses a server-only service-role key solely for its bounded intake RPC, with HMAC-based abuse counters; it is configured only in dedicated staging at this checkpoint. Production uses the direct email fallback. Protected operator scripts obtain staging credentials from the authenticated CLI into memory only. Restrict operator CLI access and run test suites in the dedicated test project. Never capture raw CLI key/dump output. Local environment files and CLI state are excluded from Git and Vercel uploads.

`company-private` is a private PDF bucket with a size limit and no client storage policies. Uploads/downloads remain unavailable pending malware scanning, content validation, tenant path policies and authorized expiring signed URLs. Private documents have not been uploaded or committed.

## Before production use

- Verify delivery to Manuel's actual inbox and complete his first sign-in. Hosted default SMTP has recipient restrictions and low quotas; configure an owned sender/custom SMTP before inviting external users. Automated tests do not exercise actual inbox delivery.
- Add privileged-user MFA enrollment/enforcement. Provider TOTP support remains enabled, but the app does not enforce MFA.
- Implement invitations with exact supplied emails, expiry/revocation and rate limits; Donn has no account.
- Add auth abuse protection, monitoring/alerting, backups and a rehearsed restore, retention/deletion policy and incident response.
- Add document scanning and private-download authorization tests before enabling storage policies.
- Add pagination and database search. Workspace lists/search still use a sample of at most 500 records/category and 100 audit events. Opportunity/pursuit detail routes now retrieve the requested UUID independently under tenant scope and RLS, including the pursuit's source opportunity and up to 500 related tasks or pursuits. Detail context is merged into the search sample without changing authorization. This fixes inaccessible deep links beyond the workspace sample; it does not provide full-list pagination or exhaustive search.
- Exercise administrator forms with dedicated staging accounts before an operational pilot. Database administrator policies/verification guards are tested; automated browser fixtures currently use viewer roles.
- Test actual token-expiry refresh over time, MFA and email-provider outage handling. Initial sessions/sign-out are tested, not every provider failure mode.
- Establish separate staging and production Supabase projects for ongoing development.

No live procurement connectors, production AI activation, automatic pricing, automated approvals or portal submission are enabled. Demo scoring is illustrative and does not authorize real bids.

## Read-only assistant implementation

The assistant is gated by server configuration and an operator-controlled organization setting. It uses user-session Supabase clients, verified active membership, injected organization filters and existing RLS. Migration 005 adds explicit fact sensitivity: unknown facts are excluded from AI for every role, and database reads of unknown/restricted facts are narrowed to authorized sensitive-data roles. Lower roles require explicit workspace classification and a safe fact-type allowlist. Source notes, private documents, pricing and arbitrary evidence text never enter tools.

Strict read-only function calls expose no SQL, writes, approval, verification, messaging or submission action. Model prose is not accepted as factual output: selected records and citations are rendered from authorized evidence, then refetched before release. Usage is reserved atomically in the database; requests cannot refund themselves. The public demo never calls paid AI. Conversations are ephemeral private tab memory with no shared or persisted prompt/answer store; status checks clear them when access changes. No service-role key is required by ordinary application requests.

The new migration and existing RLS are tested in isolated PostgreSQL. Hosted JWT/PostgREST integration, multi-process concurrency, actual provider behavior and production activation require the additional gates described in [AI architecture](ai-assistant.md) and [operations](ai-operations.md). This implementation does not resolve unrelated privileged MFA, full verification-invalidation or operational-recovery audit findings.

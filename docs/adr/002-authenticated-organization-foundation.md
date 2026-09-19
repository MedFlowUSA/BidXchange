# ADR 002: Routed demo and authenticated organization foundation

Status: accepted for the onboarding beta. Supersedes ADR 001's demo-only infrastructure assumption; retains its design and human-control boundaries.

Use Next.js App Router pages and a shared shell. Demo pages retain the existing client component and local persistence. Authenticated pages use a separate tenant component supplied only with server-loaded records. URL context makes links, refresh and history reliable; tenant switches remount the workspace. Demo records are never imported into Supabase.

Use `@supabase/ssr` with server cookies, a proxy for session refresh, server-validated identity and RLS as the database boundary. There is no browser Supabase client or application service-role key. Passwordless email supports token-hash confirmation and PKCE code exchange; the checked-in email template uses token hashes and includes a one-time code. This follows [Supabase's passwordless server flow](https://supabase.com/docs/guides/auth/auth-email-passwordless).

Use normalized tenant tables with explicit organization ownership, composite foreign keys and append-only client audit access. `profile_facts` holds individually reviewed evidence/status; structured category records refer to facts. Verification is an explicit human action. The onboarding seed is deterministic and insert-only so reruns do not duplicate or overwrite human edits.

Provision initial membership through an operator-only command with an explicit user ID/email, never through client onboarding claims. Preserve the last-administrator guard during cleanup: database tests roll back transactions; browser fixtures use viewer memberships and remove only their generated UUIDs.

Pursuit pages expose the required workflow sections with unimplemented operations visibly pending. Real bid decisions, approvals and submission states are database-constrained to pending/not submitted. Private storage remains closed until scanning and authorization are tested.

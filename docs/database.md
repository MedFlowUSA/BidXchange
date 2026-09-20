# Database changes for the AI phase

Migration `20260919000500_ai_readonly.sql` is additive except for tightening the `profile_facts` SELECT policy. It creates no production identities, organizations, seed opportunities or document access.

The production preflight also found eight excess authenticated grants on the identity tables inherited from hosted defaults. Migration 005 resets those tables to the intended foundation grants: SELECT/UPDATE on organizations and SELECT/INSERT/UPDATE/DELETE on memberships. This removes TRUNCATE, TRIGGER and REFERENCES on both, plus INSERT/DELETE on organizations. RLS and mutation guards still apply. The isolated AI suite reproduces the broader grants before migration and checks their removal.

`profile_facts.sensitivity` defaults to `unknown`. Unknown/restricted records remain readable for administrator/executive/estimator review; lower roles require `workspace` classification plus an approved nonsensitive fact type. AI excludes unknown facts for all roles. No existing record is silently reclassified. Classification covers the whole row, including notes, and is separate from human verification.

`ai_organization_settings` contains organization UUID, disabled-by-default activation, per-day database ceilings and update time. Members can read; ordinary clients cannot write. Operators manage activation through protected database tooling.

`ai_usage_events` contains request UUID, organization, server-session user, private HMAC digest, reservation time and optional feedback enum. All rows have tenant ownership and RLS. Select grants exclude the digest. The creator and organization administrator can read metadata while membership is active. No direct client insert/update/delete grants exist. No token/cost fields or confidential messages are stored.

`reserve_ai_request` validates active membership, serializes user and organization counters with advisory transaction locks, enforces minute/day quotas and duplicates, and writes a metadata-only audit event. Authenticated callers may spend only their own reservation allowance; they cannot raise database ceilings or invoke OpenAI through the RPC itself. `ai_feedback` permits one bounded rating on an owned request. Both functions use an empty search path and deny anonymous execution.

No conversation/message/citation persistence is added. Existing audit JSON is not exposed to the model. The private storage bucket and its closed policies remain unchanged. Database quotas count failures/cancellations and use UTC boundaries.

Run `npm run test:ai:database` for an isolated migration rehearsal with exact SQLSTATE assertions. Run `npm run test:security:local` for existing policy regressions. These use real PostgreSQL semantics through PGlite with minimal auth/storage stubs; hosted Supabase API/JWT behavior and concurrent processes need staging validation. The linked-project rehearsal is explicitly opt-in with `node scripts/test-ai-database.mjs --linked` and must be authorized separately. A prior automatic approval review rejected that linked-project rehearsal; no linked database changes were performed.

Before applying this migration in production, review its effect on existing lower-role company views, classify intended facts individually, rehearse hosted integration and approve metadata retention. Do not remove tightened RLS as an application rollback shortcut.

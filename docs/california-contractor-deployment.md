# California contractor deployment

The user authorized deployment after the initial implementation report.

Resolved the database certificate issue using the public Supabase database CA from `https://supabase-downloads.s3.amazonaws.com/prod/ssl/prod-ca-2021.crt`, supplied through `NODE_EXTRA_CA_CERTS`. Certificate and hostname verification remain enabled; no insecure TLS override is used. The CA is a local operational artifact, not an application secret.

Read-only audits confirmed production has schema 001–011 and 014–019; production 012/013 are intentionally not activated. Staging had schema through 016 and now has 017–026. Existing record values and row-level security were preserved during staging migration.

Hosted testing exposed transaction-stable `now()` timestamps in the shared record-version trigger. Additive migration 026 makes versions monotonic using `clock_timestamp()` and the previous version. This ensures a material edit invalidates sign-off even within one transaction. Local SQL regression tests passed after the fix.

Rollout uses a clean archive of the release commit, a production deployment held without domain promotion, then the reviewed production schema migration and explicit promotion. The contractor sign-off and workflow flags are enabled in `vercel.json`. The rollout script validates migration checksums, preserves original column values, checks RLS and revokes the private decision bypass.

The initial implementation report remains the inventory of capabilities and unfinished scope. Deployment does not imply the full brief is complete.

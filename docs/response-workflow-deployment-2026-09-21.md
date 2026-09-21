# Response workflow deployment — September 21, 2026

## Approved activation

The user confirmed proceeding with the revised migration and activation. Migration 015 (SHA-256 `71a4317a9170e7e715df22b46c1aaa0db7e17a8fb4f1ecd223606c2f641ac7c7`) is now applied in production. Four RLS histories, six RPC execution grants and blocked direct/anonymous access were verified. Storage policies and AI activation settings were compared before/after and are unchanged. A read-only check confirmed migration presence; no suitable existing pursuit was available for a production context smoke test, so no fixture or user was created. Authenticated workflow coverage was performed in staging.

This activation release sets `BIDXCHANGE_RELEASES_ENABLED=true` and updates PDF/HTML/presentation availability labels. Buyer submission remains manual; prompt recording and external-file limitations remain documented. Existing quotas, scanner hosting and upload restrictions are preserved.

## Initial disabled deployment and resolved review hold

Commit `d9a4476` was pushed to `main` and deployed successfully as `dpl_GcStTaAPdCJaGeuwxi5j36f9jdjz` at https://bidxapp.vercel.app/.

Live checks passed for the public root, sign-in and protected pursuit redirect; the PDF and HTML guides match local SHA-256 hashes. Desktop/mobile help links, new-tab behavior and mobile menu closure passed. Existing demo AI availability remains true; no paid inference was invoked. The new handoff route correctly returns private/no-store 404 while `BIDXCHANGE_RELEASES_ENABLED=false`.

At the initial disabled deployment, no production migration had been executed. Production preflight found optional document/source migrations absent; unreleased migration 015 was refined to conditionally read optional connector tables. Local SQL tests passed with and without the optional schema, and staging received the function-only revision while preserving quarantined synthetic history.

Older production prerequisite checksum differences were confirmed to be SQL statement-separator and whitespace serialization only. Migrations 006–011 matched stored SQL exactly. Production has zero storage policies; no upload or AI configuration was changed.

Automatic approval review initially rejected revised 015 because its exact contents changed after the original user approval and the initial preflight reported prerequisite checksum differences. The formatting differences were resolved, the revised migration/checksum was presented to the user, and the user instructed proceeding. The approved migration subsequently applied successfully.

Rollback uses the application flag and, when needed, explicit write-RPC revocation from the release runbook. Preserve immutable histories rather than reversing or dropping the schema.

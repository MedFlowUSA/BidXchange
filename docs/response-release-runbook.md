# Response release operations

## Activation boundary

Migration: `supabase/migrations/20260921001500_response_release_workflow.sql`. Manifest revision 11 includes its canonical LF SHA-256. Staging target is pinned to `svimdvbgtltmyaubfaux`; production is `bcrxejydosltquspsutw`. Never infer approval from a linked CLI project. This release has not applied the production migration or deployed the app.

1. Review the completion report, migration, current grants and known delayed-recording limitation. Confirm retention/visibility of shared history text with the operator.
2. Run local checks and staging transaction tests. Staging-only schema installation: `node scripts/staging/release-workflow.mjs apply-reviewed-staging`. It validates the manifest, target and grants. Empty pre-release staging function bodies may be revised; populated history or structural changes require an additive migration.
3. Obtain explicit approval naming production migration 015 and deployment/activation. Do not push `main` early: the linked Vercel project automatically deploys that branch.
4. Verify production migration prerequisites 001–011 and canonical hashes, backup/restore readiness and current environment. Apply only reviewed 015 in a transaction with lock/statement timeouts. Recheck RLS, grants and all six RPC signatures. Record migration history with the exact canonical SQL. Do not change existing tenant data or AI/storage switches.
5. Deploy reviewed application code with `BIDXCHANGE_RELEASES_ENABLED=false`. Smoke-test sign-in, normal drafting, the secondary guide links and closed release actions/routes.
6. Enable `BIDXCHANGE_RELEASES_ENABLED=true` for the intended environment and deploy. Validate one approved synthetic staging workspace end to end before any live operational release. Do not create production test users or mutate GES records.

## Emergency disable

Setting the app flag false disables release UI loading, server mutations and handoff exports. It does **not** revoke the authenticated PostgREST RPC grants installed by the migration. For a write incident, an authorized operator must also revoke authenticated EXECUTE on `freeze_response_release(uuid,uuid,uuid,timestamptz,text,jsonb)`, `record_response_approval(uuid,uuid,text,text,text,text,text,uuid)`, `record_response_submission(uuid,uuid,text,jsonb,uuid,boolean)` and `record_response_followup(uuid,uuid,text,text,timestamptz)`. Preserve read/status access for investigation where appropriate. Regrant only after incident review and validation.

Do not drop tables, disable RLS or alter immutable-history triggers as an application rollback. Preserve history and audit records. Roll back app code or disable the feature; address schema defects with a reviewed additive migration after release. No ordinary role or application service key is allowed to rewrite history.

## Validation commands

```sh
npm run typecheck
npm run lint
npm run format:check
npx playwright test
node --test --test-isolation=none scripts/test-response-releases.mjs scripts/test-pursuit-decisions.mjs scripts/test-requirement-resolutions.mjs scripts/test-evidence-use.mjs scripts/test-document-versions.mjs scripts/staging/prepare.test.mjs
npm run test:security:local
npm run test:ai:database
npm run test:secrets
npm audit --omit=dev --audit-level=moderate
npm run build
```

For the same release SQL checks against staging, set `BIDXCHANGE_RELEASE_TEST_STAGING=1` and the staging CA path, then run `node --test --test-isolation=none scripts/test-response-releases.mjs`. All synthetic changes occur inside a rollback-only transaction with savepoints around expected failures. The helper has a fixed staging identity; it does not target production. Preserve PostgreSQL timestamp microseconds when asserting versions.

For the real signed-in browser flow, set the staging CA and run `node scripts/staging/check-release-browser.mjs`. It copies non-secret source into an isolated local app, enables the release flag only there, and runs `release-browser.mjs` against staging. It creates synthetic test identities and records, then suspends the test organization and bans those identities. Immutable history is retained in the quarantined staging organization; cleanup preserves the last administrator membership. No buyer is contacted.

## Guide maintenance

Source: `docs/presentations/guide-content.json`. `build-guide.mjs` creates slide-format PDF/PPTX/HTML and presenter notes, checks text overflow, and invokes `build-accessible-guide.mjs` for semantic, responsive public HTML. The current generator expects the existing local presentation-tools installation for PptxGenJS and Edge. Copy the validated PDF to `apps/web/public/guides/bidxchange-user-guide.pdf`. Tagged output is not a PDF/UA conformance claim; retain the HTML alternative. New release chapters say staged until production activation is verified.

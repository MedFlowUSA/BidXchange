# Evidence applicability and proposal-use review release

## Scope and status

Implemented behind `BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED`, disabled by default. Production migration and activation have not been performed. A local isolated app uses the hosted staging database for signed-in browser validation.

Authorized organization administrators and executive approvers can record applicability, proposal-use approval and a reason for one saved company fact and one cited pursuit requirement. The database stamps the actual reviewer and time. Review history is append-only for application users; the UI displays the latest visible review per pair. Notes follow the evidence's current visibility. Up to 500 current visible reviews are loaded for the pursuit's loaded requirements.

Approval requires verified evidence with a value, source, known sensitivity and valid dates. Source and requirement timestamps bind the review to the versions seen by the reviewer. Evidence changes, requirement changes, expiration, future effective dates or a reviewer without an active authorized role prevent the view from reporting a current approval. The form retains its original version and entered text when a stale save is rejected.

“Not applicable” describes the evidence/requirement pair; it does not waive the requirement. This feature does not approve a bid, pricing, certifications or submission, and does not enable AI. Typed claims, document provenance, full history browsing and whole-proposal approval remain future work.

## Named migrations

Apply all three in order in a single production release after explicit approval:

- `20260919000700_evidence_use_reviews.sql`: review table, tenant policies, restricted insert columns, human attribution, audit trigger, version checks and current-status view. Also resets fact verification after changes to identity/category/label/value/source metadata/dates/owner/notes/sensitivity, extending the existing correction safeguard.
- `20260919000800_evidence_review_grants.sql`: explicitly revokes hosted default privileges on the view and identity sequence, retaining authenticated SELECT and sequence USAGE only.
- `20260919000900_evidence_review_conflict.sql`: classifies stale versions as a business-rule rejection rather than a retryable database serialization failure. Hosted testing exposed a delayed response with the original error code; the corrected direct API check returns promptly.

Staging already has these migrations. Forward corrections preserve its applied migration history. `scripts/staging/migrations.json` pins all files using SHA-256 over UTF-8 with LF endings; staging package revision 5 excludes the real-company seed. `scripts/evidence-use-release.mjs migrate-staging` checks the target and applied SQL before changing anything. It deliberately has no production mode.

## Validation

- Local migration and package tests cover tenant isolation, denied viewer writes, forged attribution, immutable reviews, version conflicts, source correction invalidation, requirement changes, invalid applicability, expired facts and reviewer role revocation.
- Foundation security regression: 251 checks pass.
- Eighteen focused tenant-loading, pursuit-input and evidence regressions pass, including disabled-feature behavior and scoped review loading.
- Production build, type checking, lint, formatting and secret scanning pass.
- Hosted schema parity includes view security, column grants, policies, functions, constraints, table grants, triggers and RLS.
- Browser release checks pass in `scripts/staging/evidence-use-local.mjs`: signed-in approval and reload, actual reviewer attribution, source-change invalidation, prompt stale rejection with preserved draft, mobile containment, hidden restricted notes and denied direct writes after role revocation. Temporary synthetic records and account were cleaned up and the fixture organization was suspended again. No production customer records were used.

## Activation and rollback

The existing named-production-migration approval gate is documented in `docs/demo-intake-release.md`: broad permission did not satisfy the earlier automatic approval review. Obtain approval for the three migrations above and the evidence-review feature flag before production application. No fresh production attempt has been rejected in this release.

After approval, apply the checksum-verified migrations transactionally with bounded lock/statement timeouts, verify schema and grants, deploy the application with `BIDXCHANGE_EVIDENCE_REVIEWS_ENABLED=true`, and check the authenticated requirement workflow with an authorized account. Leave all AI and intake switches under their separate gates.

Operational rollback: disable the evidence-review flag and redeploy. Preserve review history and the stricter fact-verification trigger; do not drop the table or restore permissive grants as an application rollback. The schema adds foreign keys that prevent deleting referenced facts, requirements or reviewers while review history exists. No existing business records are rewritten by these migrations.

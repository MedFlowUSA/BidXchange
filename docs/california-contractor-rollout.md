# California contractor rollout

Status: local implementation and validation; not deployed. No production migrations have been applied in this work.

## Schema order

Apply reviewed migrations 020–025 in order to a separate staging database containing the existing schema. Use the checksum manifest in `scripts/staging/migrations.json`; never apply the real-company 002 seed to staging. Existing 012/013 activation restrictions remain in effect; a local migration file does not establish production availability.

020 extends existing Passport validation. 021 introduces Requirements Register sign-offs and requires one for final decisions. 022 adds amendment review and requirement-linked task metadata. 023 makes current evidence support time-sensitive. 024 adds reason-required not-applicable findings. 025 rejects human-input placeholders during release approval.

Verify migration history in the target database before applying anything. Validate both existing and new role policies with synthetic organizations. Test a current final decision, expired linked policy, amendment review and version-bound release through the authenticated browser before production rollout.

## Deployment sequence

Deploy the schema and app in a coordinated window: old clients cannot create final decisions after 021 until they use the sign-off interface. The expanded Passport catalog requires 020. Enable the existing decisions, resolutions and structured-profile flags plus `BIDXCHANGE_REGISTER_SIGNOFF_ENABLED=true` and `BIDXCHANGE_CONTRACTOR_WORKFLOW_ENABLED=true` only after target schema verification.

This work does not activate SAM synchronization, private uploads, scanners, background notifications or additional paid services.

## Recovery without data loss

Take a database backup and retain the pre-rollout deployment. Before any data are written, a failed transactional migration can roll back normally. After use, preserve all new sign-offs, decision snapshots, amendments and audit history; do not drop tables or columns to restore an older UI.

If a defect appears, disable the affected interface and keep the stricter database gate. Restore a compatible app version or ship a forward fix. Returning to an older schema validator can reject newly saved structured fields. Returning to the old decision function would weaken the new sign-off rule and is not an automatic rollback. Such a reversal needs a separately reviewed, non-destructive migration with the historical tables retained.

## Known limits

Freshness tasks are produced on pursuit access, not by a background scheduler. No email notification is sent. Source last-check uses a structured date when present, otherwise the human-attestation date. Historical evidence links can continue to trigger review until a complete unlink workflow is added. Sign-off context includes the UTC review date and therefore requires reaffirmation on a later day. Candidate heuristic dismissal currently lasts only in the open browser view. The full Apex demo and self-service organization onboarding remain unfinished.

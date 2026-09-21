# Structured Company Passport and document autofill

## Delivered increment

Fourteen structured record templates add dedicated inputs for mailing addresses, phone numbers, business email, representatives, legal entity information, registrations, UEI/CAGE, licenses, certifications, insurance, bonding, comparable projects, personnel and equipment. Records retain their existing category, editable label, owner, source, visibility, effective/expiration dates and verification workflow. Create separate labels for repeatable licenses, policies, projects and people.

The catalog lives in `apps/web/lib/company-fields.ts`. Numeric amounts use nonnegative decimal strings, up to 13 whole digits and two decimals; currency is an explicit uppercase three-letter code when money is entered. This validates shape, not exchange rates or membership in an official currency registry. Date, email, length, category and permitted-field checks run in the application and database. Unknown fields stay blank; empty entries do not become verified or complete automatically. Public identifiers and license numbers are recorded, not verified against external registries.

The new editor is integrated into the Passport interview, readiness areas and existing-record corrections. A legacy record stays free text until a person deliberately chooses a structured format and copies the relevant information. Its previous text is displayed during conversion and remains in audit history after saving. Once structured, its record kind cannot be changed in place. Evidence-use approvals remain separate, and the outdated Passport prompt has been corrected to say so.

## Data and security

Migration `20260921001600_structured_company_profiles.sql` adds nullable `structured_kind` and `structured_fields` columns to `profile_facts`. It uses the existing organization-scoped RLS, active-admin write path, optimistic update version, audit triggers and evidence-review references. It does not create a second independent review state in the older specialist tables. Those tables are not automatically synchronized or backfilled.

A database trigger validates the field catalog and derives the human-readable `value` from structured inputs in a fixed order. Structured-field, classification, label, effective-date, visibility and source-note changes reset verification before the existing verification guard executes. Existing value/source/expiration invalidation continues to apply. The same fact UUID and updated version remain the evidence-use reference; changes require fresh review. No new table privileges or service-role application access were introduced.

The generated migration is pinned in staging manifest revision 12. Its SHA-256 (canonical LF) is `7590671c5f3ac55ee7fb1a1c1a0d029de2b1297c1e49cf3de9db465bfddcdafa`. The generation script is for this unpublished catalog only; after release, catalog/schema changes require an additive migration rather than rewriting migration 016.

## Explicit document mapping

When structured profiles are enabled, required address, phone, email and representative checks use stable record kinds instead of editable label keywords. A valid current record can retain any descriptive label. Required address checks include line 1, city and country; reviewers must still check jurisdiction-specific address completeness. Representative checks require name, title and authority reference; the entry itself grants no authority.

Multiple current exportable records for a single contact slot are omitted and flagged for reconciliation; no arbitrary first record wins. Incomplete/invalid structured records and a conflicting structured legal name are also flagged. Legacy identity text remains saved but is omitted from structured identity autofill until deliberately mapped and reverified. Other legacy evidence retains its existing use/disclosure rules. No customer records are automatically converted.

Only current, verified, sourced, permitted facts can enter shared draft exports. Restricted company data remains excluded, including restricted insurance, bonding and personnel records. Qualification evidence still requires current requirement-specific proposal-use approval. This release does not mean every entered field is automatically copied into every document, nor does it fill buyer-specific forms or certify eligibility.

## Validation completed

- 12 targeted Playwright tests passed: structured input rules, stable-key and conflict-aware autofill, desktop/mobile editor save payloads, existing company input safeguards and PDF/Word export regressions.
- Seven isolated database/package tests passed, covering migration inventory/checksums, no seeded/activated tenants, canonical summaries, invalid field rejection, re-verification, role/tenant access and evidence-use regressions.
- The existing tenant security suite passed 251 checks; the dedicated migration test separately exercises the new columns and trigger.
- Migration 016 applied successfully to the pinned staging project only, retaining RLS and anonymous-read denial.
- A real synthetic staging session saved structured address fields through the actual Server Action, reloaded persisted values and canonical text, fit a 390px viewport, and rejected a save from the already-open editor after administrator access was revoked. The synthetic record and account were removed; the reused synthetic workspace was suspended again.
- Typecheck, lint, formatting and production build passed. Secret scanning passed across 352 files before the production rollout script was added.

## Rollout and remaining scope

The user subsequently approved proceeding with production rollout. Migration 016 is now installed in production; its pinned checksum, trigger, RLS and anonymous-read denial were verified. A before/after digest confirmed existing company fact values were preserved, and policy/AI-setting comparisons were unchanged. This release enables `BIDXCHANGE_STRUCTURED_PROFILES_ENABLED=true` through the production deployment configuration. No customer identity records were automatically converted or verified. The flag defaults off in other environments.

Before production activation: review the migration and legacy-identity export behavior, apply only migration 016, then deploy with the flag enabled. Keep shared evidence histories intact. Once structured records exist, prefer a forward fix: turning the flag off hides structured inputs, and the database still preserves structured fields as the authoritative content, so the old free-text editor cannot replace that content.

This is the structured-profile foundation, not the entire profile roadmap. Business-type-specific questionnaires, explicit applicability states, primary-contact selection, a dedicated partner directory, numeric insurance/bonding comparisons against solicitation thresholds, broader structured safety/capacity/classification forms, secure attachments and scheduled notifications remain future increments. Existing free-text categories cover those areas pending dedicated forms. No scanner purchase, procurement connector activation, AI configuration change, company auto-verification or portal automation is included.

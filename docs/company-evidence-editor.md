# Saved company evidence

September 21: [structured Company Passport and explicit autofill](structured-company-profiles.md) passed staging validation and the approved production migration is installed. The activation release enables dedicated fields alongside the existing free-text evidence editor described below.

Authorized organization administrators can now add and correct evidence records inside the relevant Company readiness area. Records persist in the existing tenant-scoped `profile_facts` table and use its existing RLS, audit triggers and verification guard. The editor does not use a service-role key or add database privileges.

Each record captures a category, label, known information, evidence reference, source/review notes, active member owner, effective/expiration dates and visibility. Unknown values may remain blank. New records default to restricted visibility. Insurance, bonding, personnel, finance and other sensitive categories cannot be reclassified as workspace-visible through the form. Editors load their controls only when opened, keeping large profiles lighter.

Every save through this action sets pending verification and clears the verifier/time, including changes to dates, notes, ownership or visibility. Human verification remains a separate existing action. Corrections require the last saved `updated_at` value; stale edits fail without overwriting newer work. Inputs are controlled so a failed save preserves the user's entered text. A record owner must be an active member of the same organization. A profile is created under the authenticated administrator's permission if one does not yet exist; a concurrent creation is safely re-read.

This is record capture and correction, not the audit's full structured field catalog or proposal-use approval workflow. Evidence is referenced by text/URL; files are not uploaded or scanned. No saved record alone establishes eligibility, certifies a company representation or authorizes submission. The raw database API continues to use its existing policies and triggers; these additional field-validation rules apply to the new server action.

## Validation

- TypeScript, ESLint, formatting and build passed.
- Two new input-validation tests cover unknown values, malformed/inverted dates, missing concurrency tokens, invalid owners, oversized text, sensitive-category classification and rejection of browser-supplied verification metadata. The five existing readiness checks also passed.
- On protected staging deployment `dpl_3AsknSnoEwJ6kyRJN7ndkVNjqPoF`, a real synthetic administrator created a record through the browser and reloaded it. Its owner, source, restricted classification and pending state persisted.
- Human verification stamped the authenticated reviewer. A later correction reset verification. A second stale browser tab could not overwrite the correction and retained its entered text after rejection.
- Downgrading the synthetic administrator to viewer immediately blocked the already-open save form. Restricted evidence and editor controls disappeared after reload, and direct PostgREST insertion was denied.
- Synthetic records and account were removed; the reused synthetic organization returned to suspension. No last-administrator guard was disabled. No production company record was edited during validation.

The first hosted run exposed ambiguous accessible textarea naming during editing; explicit accessible names resolved it before the successful full run. Production rollout uses an isolated checkout without staging-only AI code. No AI activation, provider request or new migration accompanies this editor.

Production deployment `dpl_76b5WMmEK6fjowbSTayd7dthkKPX` is live at `https://bidxapp.vercel.app`. The protected staging alias points to the validated build above. Company administrators reach the editor through Company and the relevant readiness area.

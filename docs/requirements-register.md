# Pursuit requirements and gaps

The live pursuit page includes a saved requirements register. Organization administrators and capture managers can enter or correct each requirement, cite its notice section or buyer clarification, assign an active organization member, and select Needs review, Missing information or Blocker identified. Viewers can read the register but cannot mutate it.

These states track follow-up only. There is no compliant, eligible or approved choice. Unknown legacy statuses render as Needs review. The empty state explicitly says that an empty register does not mean the notice has no requirements. Company evidence remains in its existing permission-controlled area; the register warns users that every workspace member can read its text. Linking and verifying evidence against a requirement is not implemented by this increment.

The detail loader fetches requirements by both organization and pursuit after authorizing the parent records. It reads at most 501 records and displays 500 with an explicit partial-register notice if needed. The workspace's unrelated 500-record sample does not determine which pursuit requirements can be found. Query errors fail the page rather than presenting a misleading empty register.

## Write boundaries

The Server Action validates IDs, bounded text, required citations, allowed follow-up states and the edit version. It rechecks capture/admin access, uses the existing persistent mutation allowance, verifies the parent and active owner under the user's session, and relies on existing RLS and composite tenant foreign keys. Updates compare organization, pursuit, record and original update timestamp. Existing audit triggers record the mutation. No service-role credentials or database migrations are needed.

The shared capture form now snapshots its record identity/version together with its draft. A parent refresh caused by another successful form must not attach a newer update timestamp to stale text. Failed edits retain the entered draft; successful forms require a fresh load before further edits.

## Validation

Input validation rejects missing citations, oversized requirements, malformed owners, missing edit versions and invented approval states. The direct-record tests include unrelated and foreign-tenant requirements. The full desktop/mobile suite passes 98 tests. Type checking, linting, formatting and the secret scan also pass.

The expanded staging capture script validates actual authenticated creation, reload, owner persistence, follow-up edits, stale requirement rejection after an unrelated task save refreshes the page, invalid owners, unavailable parents, legacy status normalization and revoked role enforcement. All test records and the temporary account are removed; the synthetic fixture is suspended afterward.

## Next work

Evidence-linked qualification, controlled human decisions, requirement applicability, private attachments and proposal/submission approvals remain separate work. This register does not enable production AI or change bid authority.

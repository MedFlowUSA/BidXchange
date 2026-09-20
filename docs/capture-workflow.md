# Manual opportunity intake and pursuit tasks

Organization administrators and capture managers can add and correct opportunities from the live Opportunities page. Title and a source URL or traceable source note are required. Buyer, solicitation number, scope and official deadline may remain unknown. Optional empty values are stored as null. Only HTTP(S) source URLs are accepted; they are recorded as evidence references, never fetched by this workflow.

The opportunity detail offers a planning workspace while the bid decision remains pending. Existing pursuits appear as links. A normal retry checks for an existing pursuit. This is not a database uniqueness guarantee: simultaneous starts can create separate pending workspaces because the existing schema permits multiple pursuits per opportunity. Consolidation and atomic idempotency need a separately reviewed migration; this release does not change the schema.

Within a pursuit, permitted users can add tasks and edit their title, owner, deadline and status (to do, in progress, complete). Owners must be active members of the selected organization at save time, or tasks can remain unassigned. Completion does not approve a bid, certify compliance or authorize submission. Member identifiers are shown where the existing directory provides no display name.

## Integrity and access

- Server Actions re-check the authenticated user's administrator/capture-manager membership on every request and consume the existing persistent mutation allowance.
- All tenant mutations use the user's Supabase session and existing RLS, composite organization/parent foreign keys, immutable-tenant triggers and audit triggers. No service credentials are used in app mutations.
- Opportunity and task corrections compare organization, record ID and the originally loaded update timestamp. Task edits also compare the pursuit ID. A stale or unavailable record is not overwritten; entered text remains available.
- Creation and editing only write an explicit field list. Browser-supplied bid decisions, pricing and submission fields are discarded. Pursuit creation sets pending/in-review server-side. Existing database decision and submission guards remain enforced.
- Timestamps require an explicit offset; the separately validated time zone controls display. Unknown dates stay blank. The UI explains that the offset fixes the instant.
- A successful form is disabled until the user continues with freshly loaded saved records, avoiding accidental repeated clicks. There is no claim of exactly-once request processing.

## Validation and release

Input tests cover missing sources, unsafe protocols, ambiguous/invalid dates, invalid zones, malformed identities, missing edit versions and injected authority fields. Existing direct-record tests cover organization scoping and records beyond the workspace sample. The desktop/mobile regression suite has 97 passing tests. Type checking, linting, formatting and the secret scan passed.

Staging deployment `dpl_4CAsqbv9vQxJEvXzC8z6qdU8ibKi` passed `scripts/staging/capture-hosted.mjs` using actual Server Actions with a temporary capture-manager session: create/reload/correct an opportunity, stale edits, pending pursuit creation, assigned task persistence/completion, role revocation and direct viewer write denial. The test checked mobile containment and removed its synthetic records/account, restoring the synthetic organization's suspended state. No production business records were used.

## Remaining audit scope

This release supplies manual intake and task management. Requirements/compliance evidence, applicability, qualification, authorized human bid decisions, proposal authoring, pricing approvals, scanned document uploads and submission proof remain separate work. Production AI activation and the verified demo-queue operator are also separate rollout items.

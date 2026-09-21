# Current architecture

Next.js App Router serves the public marketing root, fictional browser-local demo and authenticated Supabase organization workspaces. The server validates sessions; organization membership and database RLS independently scope real records. The existing workflow architecture is documented in [ADR 002](adr/002-authenticated-organization-foundation.md).

The read-only assistant adds server-only Responses API orchestration, narrow structured-data tools, explicit fact disclosure classification, database-backed reservation limits and independently authorized citations. It does not import the full tenant loader into model context. Conversation display is ephemeral private tab memory; only usage metadata and feedback persist. See [the assistant architecture and controls](ai-assistant.md) and [ADR 003](adr/003-readonly-ai-assistant.md).

The production activation boundary consists of migration 005, explicit OpenAI model/key configuration, a global switch and an operator-controlled organization switch. Public demo AI has separate activation controls. Procurement feeds, private documents, pricing, approvals and submissions remain outside the assistant's tools.

September 20 addition: the [source-ingestion implementation](opportunity-ingestion.md) adds a separate bounded SAM.gov operator job, immutable observations, tenant searches and human conversion into existing opportunities. Consult the source-specific release report for deployment status; this workflow release does not activate it. The [latest AI activation report](ai-general-activation.md) supersedes older disabled-AI checkpoints.

## Guided response architecture

`workspace-guide.ts` derives twelve steps and at most four next actions from the authorized tenant view. Dismissal is a user/organization browser preference, never completion evidence. Selected-pursuit records drive evidence, writing and release steps; unloaded stages remain unevaluated. Help stays outside the five primary navigation destinations.

The response release component progressively exposes source/readiness counts, a checklist, local file hashing, gates, submission and follow-up. Strict server actions validate current session roles before session-scoped RPC calls. PostgreSQL independently enforces membership, exact versions, dependencies, named submitter, immutable history and mutation limits. Snapshots contain shared response/source/checklist data and external file hashes; no restricted profile facts or file bytes are copied.

Migration 015 adds four RLS tables and six authenticated RPCs. Readiness includes source observations, saved response context and reviewer membership. The private handoff returns bounded JSON, rechecks session and state and refuses changed/partial history. It is an internal point-in-time artifact, not proof of buyer receipt.

`BIDXCHANGE_RELEASES_ENABLED` defaults false. With the flag off, normal draft pages do not query the new tables. The app switch does not revoke direct authenticated RPC grants; see the [emergency-disable runbook](response-release-runbook.md). Explicit outline commands use a deterministic authorized action, not model authority. The model cannot approve or submit.

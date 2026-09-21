# Current architecture

Next.js App Router serves the public marketing root, fictional browser-local demo and authenticated Supabase organization workspaces. The server validates sessions; organization membership and database RLS independently scope real records. The existing workflow architecture is documented in [ADR 002](adr/002-authenticated-organization-foundation.md).

The read-only assistant adds server-only Responses API orchestration, narrow structured-data tools, explicit fact disclosure classification, database-backed reservation limits and independently authorized citations. It does not import the full tenant loader into model context. Conversation display is ephemeral private tab memory; only usage metadata and feedback persist. See [the assistant architecture and controls](ai-assistant.md) and [ADR 003](adr/003-readonly-ai-assistant.md).

The production activation boundary consists of migration 005, explicit OpenAI model/key configuration, a global switch and an operator-controlled organization switch. Public demo behavior is predefined fiction and never invokes paid AI. Procurement feeds, private documents, pricing, approvals and submissions remain outside the assistant's tools.

September 20 addition: the [source-ingestion implementation](opportunity-ingestion.md) adds a separate bounded SAM.gov operator job, immutable observations, tenant searches and human conversion into existing opportunities. It is not activated or deployed. The [latest AI activation report](ai-general-activation.md) supersedes older disabled-AI checkpoints.

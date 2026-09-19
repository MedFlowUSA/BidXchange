# ADR 003: Authorized evidence selection before generative advice

Status: implemented behind disabled activation gates; hosted pilot validation pending.

Use the official server-side OpenAI SDK and Responses function calls. Every tool runs through an authenticated user Supabase client with injected organization scope and RLS. Explicit fact sensitivity defaults unknown and excludes unknown records from AI; notes/documents are excluded regardless of their parent row's visibility.

Use strict model output for evidence selection, then render factual values from the authorized records rather than accepting generated factual prose. Re-fetch selected citations before release. This sacrifices fluent synthesis to make factual output and authorization testable without trusting a model to honor instructions. Model selection is explicit configuration. The model has no write or external retrieval capability.

Keep conversations private and ephemeral in the current tab. Do not persist prompts, answers or provider conversation state. Each question retrieves new evidence, preventing history from becoming a role-disclosure bypass. Persist only rate-limit reservations and categorical feedback. Durable quotas use database advisory transaction locks; cancellations/errors remain charged. Provider token usage is server operational telemetry, not a browser-writable billing record.

Render streaming progress and validated answers instead of unvalidated token deltas. Browser cancellation aborts the model request. Fail closed on missing configuration, malformed output, invalid citations or changed membership. Test actual migrations in isolated PostgreSQL by default; hosted Supabase and paid-provider tests require separate authorization.

Consequences: no automatic production activation, no live procurement claims, no private documents, no generative eligibility scores, and no shared historical conversations. More expressive synthesis requires a separate evaluation and evidence-entailment design. See [AI documentation](../ai-assistant.md) for limits and operational requirements.

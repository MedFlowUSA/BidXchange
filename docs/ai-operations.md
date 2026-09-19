# AI operational runbook

## Disable globally

Set `BIDXCHANGE_AI_ENABLED=false` in the serving environment and redeploy/restart. The browser shows unavailable; the paid route refuses work. Revoking the provider key additionally stops use from older running deployments. Never disable authentication or RLS as a kill switch.

## Disable one organization

An authorized database operator sets `public.ai_organization_settings.enabled=false` for the explicitly selected organization UUID. Never infer the UUID from a display name. Membership and activation are checked during generation; later rounds/final checks fail closed. Requests already sent to the provider can still incur charges before cancellation/timeout. Other organizations retain their own settings.

## Investigate failures and usage

Use sanitized request IDs, outcome codes, timing and successful provider token totals in restricted server logs. Inspect `ai_usage_events` metadata as an organization administrator or authorized operator. Do not copy prompts, evidence, provider keys or auth tokens into logs/tickets. Reservations include cancelled and failed work. Reconcile model invoices rather than treating request counts as exact dollars.

Daily limits use UTC and the smaller environment/database ceiling. Lower limits or disable the organization during suspected abuse. Do not delete today's usage records to bypass a quota. The database serialization prevents concurrent HTTP instances from overspending the reservation limit; separately validate lock contention on hosted staging before activation.

## Retention and rollback

Schedule a reviewed operator task to remove usage metadata older than 30 days; retain the active-day quota window. Do not remove existing immutable audit history. Configure operational log retention/access before enabling real AI. No confidential conversation database exists to export or delete. Clear tab memory through the UI.

Rollback application code or turn off feature switches while preserving additive tables and tightened fact RLS. Do not roll back to broader fact reads as an application rollback shortcut. Classifications remain pending human review; private document storage remains closed.

## Release gates

Run formatting, lint, types, unit/browser tests, both isolated database suites, build, secret scan and dependency audit. Then run explicitly authorized hosted staging checks: real sessions for all roles, revoked membership, classified facts, concurrent quotas, context/citation links, selected-model streaming, cancellation, provider outage and cost totals. Apply migration 005 and activation only under an approved change. No production user creation is needed for local validation.

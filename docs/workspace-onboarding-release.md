# Company signup, invitations and first-workspace setup

## Delivered

- `/signup`: explicit account creation through the existing Supabase passwordless flow. Existing `/login` remains account-only. Both callback links and one-time codes preserve `/onboarding` as a safe destination.
- `/onboarding`: authenticated, confirmed-email company creation, existing-company selection, incoming invitations and a company-specific six-area Passport checklist. Checklist links reuse the existing record editors and lead into manual opportunity intake and pursuit creation.
- `/settings/team?organization=…`: company administrators create seven-day invitations with an explicit role, review recent invitations and revoke pending invitations. Recipients confirm the exact email and accept through `/onboarding`. Administrators share the join address themselves; no invitation email is automatically sent.
- New companies atomically receive one administrator and an empty existing company profile. Workspace names are not silently attested or copied into qualification evidence. Up to three company creations per account, with idempotent request handling; contact support for more.
- Company/Today setup links, Settings access links, signup discovery and matching updates to the 24-page PDF, PowerPoint and accessible text guide.

## Schema and security

Migration `20260921002700_workspace_onboarding.sql` adds private creation receipts, an RLS-protected invitation table, invitation audit/identity triggers, pending-email uniqueness and recipient lookup indexes, and narrow creation/list/invite/accept/revoke RPCs. It reuses organization memberships and current role policies rather than creating a second role system.

Email identity comes from the confirmed account in `auth.users`, never from form values or an untrusted JWT email claim. Invitations do not use bearer tokens. Acceptance serializes against revocation; expired/revoked invitations, suspended organizations/memberships and invitations from former administrators are refused. Existing active membership roles are preserved. Admin invitation creation is capped at 50 per company per day. No tenant policy is disabled, no service key is used by application code, and no existing customer data are removed.

Migration 027 passed local SQL/bootstrap checks, was applied to staging and passed hosted rollback tests. It was then applied to production with record fingerprints unchanged and all public-table RLS enabled. Activation uses `BIDXCHANGE_SELF_SERVICE_ENABLED=true`; the local example defaults to false. Disabling the UI flag hides entry points but does not remove created accounts, memberships or schema/RPC permissions.

## Verification

- `npm run typecheck` — passed.
- `npm run lint` — passed after moving the invitation review timestamp into the server record loader.
- `npm test -- --workers=4` — 202 passed, including new signup gating, input validation, desktop/mobile form and existing tenant/assistant/export regressions.
- `node --test --test-isolation=none scripts/test-workspace-onboarding.mjs scripts/staging/prepare.test.mjs` — 6 passed. Covers confirmed/unconfirmed identity, forged JWT email, tenant isolation, duplicate creation, creation limits, direct-write denial, role escalation, expiration, revocation, suspended access, former inviter authority and audit attribution.
- `BIDXCHANGE_ONBOARDING_TEST_STAGING=1 node --test scripts/test-workspace-onboarding.mjs` with the existing trusted CA — passed against hosted staging; test writes rolled back.
- `node scripts/staging/onboarding-browser.mjs` with the existing trusted CA — passed. Real Supabase signup-confirmation callback, company creation, first saved Passport evidence, manual opportunity and pursuit, invitation acceptance, viewer access denial and mobile layout. Synthetic staging accounts were banned and their new workspaces suspended afterward; histories retained. No customer fixture or production customer account was used.
- `npm run build` — passed locally before final activation; production deployment runs the same build with the self-service flag enabled.
- `npm run test:secrets` — passed.
- `git diff --check` — passed.
- Native PowerPoint export — 24 slides, zero detected text overflows; updated PDF copied to the existing in-app guide URL.

The first browser attempts used incorrect assertions for editors that disappear after a successful save and the app’s custom access-denied page. Those assertions were corrected and hosted timeouts increased; the complete rerun passed.

The first production smoke check caught prerendering of the new pages while the runtime-only activation flag was absent at build time. Signup, onboarding and team administration now call Next.js `connection()` before evaluating that flag so availability is determined at request time.

## Boundaries and remaining work

Supabase staging and production report signup allowed, email authentication enabled and email confirmation required. The browser test consumes a generated confirmation link without sending mail; real-inbox delivery and spam-folder placement were not tested. Existing provider rate limits and mail delivery configuration still apply. No custom mail provider, bulk invitation email service or new paid infrastructure was provisioned.

This is a guided setup path using existing Passport editors, not evidence of ten-minute onboarding completion. Real-user timing remains unmeasured. Automatic reminders, scheduled freshness propagation, complete AI retrieval of new contractor records, advanced requirement editing, connected Apex demo completion and outcome-to-permitted-past-performance promotion remain separate work.

## Next implementation

Schedule evidence-freshness checks and owner notifications so an expired policy can flag an affected pursuit without someone first opening it.

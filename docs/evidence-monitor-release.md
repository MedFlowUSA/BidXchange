# Scheduled evidence monitoring — September 22, 2026

## Delivered

Today and Company now show owner-assigned evidence reminders for expiration within 90, 60 and 30 days, expired evidence, and evidence last checked more than 90 days ago. Authorized owners or administrators can acknowledge a reminder without approving the evidence. Renewed evidence resolves its reminder on the next daily pass; linked tasks still require human completion.

Supabase's private database scheduler processes up to 25 organizations every 15 minutes, checking each active organization once per UTC day. Expired/stale linked evidence reopens requirements and invalidates the context behind prior sign-offs and final decisions. Original decisions and snapshots remain unchanged. Latest evidence-link reviews determine applicability; dismissed historical links do not reopen requirements. Repeated unchanged checks create no duplicate tasks or reminders.

## Files and data

- Migration `20260922002800_scheduled_evidence_monitor.sql`: source-authorized `evidence_reminders`, private run-health state, worker functions, acknowledgment RPC, scoped health RPC, audit triggers, open-reminder index and shared on-access freshness handling.
- `apps/web/lib/evidence-monitor*.ts`: typed reminder loader and run-health display.
- `apps/web/components/evidence-reminders.tsx`: mobile-compatible reminder list, assignment filter and acknowledgment.
- `apps/web/app/evidence-reminder-actions.ts`: authenticated server action with optimistic version checking.
- `scripts/evidence-monitor-schedule.mjs`: target-checked enable/status/run/disable operations.
- `scripts/test-evidence-monitor.mjs`, `tests/evidence-monitor.spec.ts`, and hosted onboarding browser test: database, interface and real authentication coverage.
- `vercel.json`: enables reminder screens. The application does not hold a scheduler secret or worker credential.

Migration 028 applied successfully to staging and production. The release tool confirmed existing records preserved and RLS enabled. Production schema audit reported no public tables without RLS. First manual production batch checked the active organization with no failures. An actual automatic staging cron tick also succeeded, after which its temporary one-minute schedule was restored to every 15 minutes.

## Verification

Passed:

```text
npm run typecheck
npm run lint
npm test -- --workers=4                         # 205 passed
npm run build                                 # production build succeeded
npm run test:secrets                           # 511 source files scanned
node --test --test-isolation=none scripts/test-evidence-monitor.mjs scripts/staging/prepare.test.mjs
                                               # 6 passed, including full schema bootstrap
BIDXCHANGE_MONITOR_TEST_STAGING=1 node --test scripts/test-evidence-monitor.mjs
                                               # 1 hosted integration test passed; rolled back
node scripts/staging/onboarding-browser.mjs    # real hosted sign-in, reminder read and acknowledgment,
                                               # onboarding, invitation, permissions, mobile layout
node scripts/contractor-schema-audit.mjs production
```

Hosted commands use the trusted Supabase CA through `NODE_EXTRA_CA_CERTS`. A browser assertion initially expected the wrong capitalization and was corrected before its successful rerun. The first secret scan was prevented from spawning Git by the local sandbox; the authorized rerun passed. Synthetic browser accounts were banned and their organizations suspended afterward; no emails were sent.

## Security and human authority

Authenticated clients cannot execute private workers or mutate reminder tables directly. Reminder SELECT policies inherit the source evidence's visibility and organization membership. Acknowledgment checks organization, current source access, ownership/reviewer role and record version. Hidden source labels never appear in shared follow-up tasks. Tests cover foreign-organization denial, restricted evidence, suspended organizations, retry backoff, per-organization failure rollback, and preservation of prior human decisions.

Acknowledgment is not evidence attestation, requirement approval, or a bid decision. No pricing, eligibility determination, signing, or submission was added. No new hosting or messaging service was purchased.

## Operations and rollback

Use `node scripts/evidence-monitor-schedule.mjs production status` to inspect the job and recent run outcomes. `disable` unschedules only `bidxchange-evidence-monitor`; it does not drop pg_cron or affect other jobs. Set `BIDXCHANGE_EVIDENCE_MONITOR_ENABLED=false` and redeploy to hide reminders while preserving their history. Existing pursuit-on-access freshness checks remain available.

Scheduler references: [Supabase Cron](https://supabase.com/docs/guides/cron), [installation](https://supabase.com/docs/guides/cron/install), [job management](https://supabase.com/docs/guides/cron/quickstart).

## Limits and next step

Reminders are in-app only, not email/SMS. Each view loads the latest 100 authorized unresolved reminders. Expiration dates use UTC day boundaries; missing dates remain in the existing Radar. Changes after a successful daily pass are reflected in reminders on the next daily pass, while opening a pursuit still checks linked evidence immediately. A failed or overdue check is displayed; there is no external paging service. Cron history retention is not automated by this release. The downloadable guide has not been regenerated for this new feature.

Next: add opt-in email digests with verified recipients, delivery tracking and an unsubscribe control, so owners can receive reminders without opening the app.

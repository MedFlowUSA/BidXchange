# Demo contact and operations queue

The business owner confirmed Manuel Rodriguez, `mrodriguez@oaisinc.com`, as the initial demo contact and operations owner. This is contact routing, not a tenant membership or account grant.

## Implemented

- Homepage demo calls to action reach an email contact immediately when hosted intake is not configured. The link opens the visitor's email app; it does not claim delivery or database persistence.
- A minimal saved-request form collects name, work email, company, optional message and explicit permission to respond. It warns against including confidential records. No browser storage or automatic email delivery is used.
- Migration `20260919000600_demo_intake.sql` creates an isolated prospect queue, explicit operator allowlist, status history without copies of contact details, persistent abuse counters, version-checked edits and operator erasure.
- Intake RPC execution is service-role only. Visitors and normal authenticated users cannot insert or read leads, grant operator access, or edit counters. Operators cannot bypass the mutation functions with direct updates.
- The server action uses a server-only key and HMAC hashes; raw IP addresses are not saved. Limits are 100 valid intake attempts globally per 24-hour window, five per IP and three per email. Quota denials persist their counters. Each window resets on the first attempt after expiration. Expired counter rows are removed during available-capacity traffic. Exhausted global capacity stops new per-IP allocations.
- `/operations` requires a signed-in, explicitly enrolled operator, paginates 25 requests at a time, supports status filtering and version-checked status changes or confirmed erasure. No cross-company access is granted.
- There is no outbound email provider or notification worker. A saved request and an email sent by an operator are separate events. Queue operators must check the queue and use their business mailbox.

The IP header is restricted to a Vercel runtime and its `x-vercel-forwarded-for` header, documented in [Vercel's request headers](https://vercel.com/docs/headers/request-headers). Deployments behind other infrastructure fail closed until a trusted client-IP source is implemented. Next Server Actions provide same-origin enforcement; database RPCs cannot be called with the public anon key.

## Activation sequence

Migration 006 is now installed in staging and production. Production installation followed the user's explicit approval of this named migration and conditional operator grant. No OpenAI key was accessed and no organization was enabled for AI. Application deployment has a separate pending approval, described below.

1. Apply the reviewed migration to the isolated staging project and validate with synthetic users and requests. Do not copy production contacts or company records.
2. Add staging-only `SUPABASE_SERVICE_ROLE_KEY`, a random `BIDXCHANGE_INTAKE_HASH_KEY` (at least 32 characters), and `BIDXCHANGE_DEMO_INTAKE_ENABLED=true` to the staging branch environment. Never put these values in `NEXT_PUBLIC_*`, checked-in files, logs or a client component. The hash key must remain stable between deployments for limits to remain effective.
3. Enroll a verified operator explicitly through an administrative database operation. For Manuel in production, resolve his confirmed `mrodriguez@oaisinc.com` account to a user UUID, check it is not banned, then insert that exact UUID into `private.demo_operators`. No account is created, matched automatically during migration, or assigned by accepting an email from a browser. If the verified account does not yet exist, retain the email contact and defer queue activation.
4. Validate successful save, blocked direct RPC, ordinary-user denial, operator access, stale update, quota limits, erasure and revocation with hosted JWTs. Also confirm the environment points only to its intended Supabase project.
5. Present the migration, deployment and operator grant for production review before enabling saved intake. Keep the email fallback until those steps and an operator queue-check routine are complete.

The full Privacy notice and Terms remain unpublished. The form's short data-use notice is not a substitute for business-approved legal terms. No retention duration is promised. Operators can erase contact data; choose and implement a retention schedule before broad marketing. Status history retains request UUID, actor UUID, action and timestamp, not request content. No automatic grant, retention purge, outbound test email or production deployment has occurred as of this checkpoint.

## Validation

Local Postgres-compatible tests exercise the actual migration and database roles: service-only submission, denied direct inserts and operator grants, unassigned-user read denial, explicit enrollment, rejected direct updates, version conflicts, persisted quota denial, expiration reset, global-cap allocation bounds, erasure, audit events and immediate operator revocation. They create no company rows. The versioned staging package includes the new reviewed checksum while retaining all existing checksums and excluding the real-company seed.

Type checking and lint passed. Local browser validation covers public contact routing, honest delivery wording, mobile layout, sign-in boundaries and existing workspace routes.

## Hosted validation and release checkpoint

Protected staging deployment `dpl_9iJcqBQv9YVURqpxwdHusbkhSnRZ` is available at `https://bidxchange-staging.vercel.app`. A real browser saved a synthetic request into the dedicated staging database. Anonymous direct RPC calls were denied. A real unassigned JWT could neither read nor change requests. An explicitly enrolled synthetic operator reviewed the request through the browser; the status persisted, stale writes failed, and removing the operator grant immediately blocked both the existing JWT and browser session. Synthetic leads, event rows and the account were removed afterward; rate counters were retained. No email or provider request was made.

The first staged build exposed an environment-name mismatch: intake expected a public-prefixed URL while this application uses server-only `SUPABASE_URL`. Intake now uses the existing `authConfig()` function. A subsequent test selector was corrected to locate the status combobox. The full hosted run then passed.

Schema parity passed for 287 columns, 112 policies, 13 functions, 161 constraints, 113 grants, 58 triggers and 32 tables with RLS. Staging uses a staging-only service key and HMAC key. Neither was logged or exported to a file.

Production lookup found no account for `mrodriguez@oaisinc.com`. The user has been asked to sign in and verify that business email. No other account has been substituted or granted access. The separately approved production migration was installed, but production saved intake remains unconfigured and disabled. Its email fallback is ready for deployment.

Automatic approval review rejected the initial production migration attempt because broad permission did not satisfy the prior named-migration gate. After the user explicitly approved migration 006 and the conditional verified-account grant, installation succeeded. Automatic review separately rejected the production application deployment; explicit approval for that exact release has been requested. No alternate deployment path was used to bypass either rejection.

# Setup, validation and deployment

## Environment

Set these application variables in Vercel and local ignored `.env.local`:

| Name                     | Value                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------- |
| SUPABASE_URL             | Linked project's HTTPS API URL                                                                    |
| SUPABASE_PUBLISHABLE_KEY | Project publishable key                                                                           |
| SITE_URL                 | Exact public origin: production https://bidxchange-beta.vercel.app or local http://127.0.0.1:3000 |

Do not use `NEXT_PUBLIC` service credentials. Build succeeds without credentials and sign-in shows setup guidance. Arbitrary preview domains are not automatically authorized for sign-in; configure a separate staging project/origin before authenticated preview testing.

## Database and email

```sh
supabase login
supabase link --project-ref bcrxejydosltquspsutw
supabase db push --linked
supabase config push --project-ref bcrxejydosltquspsutw
```

Review the config diff before accepting it; preserve unrelated remote settings. Migrations 001–004 create tenant tables/RLS/audit, seed GES, add mutation throttling and guard organization identity/timezone. The linked project has all four applied. Seed migration 002 is insert-only and safe to rerun.

Supabase config sets the production site URL, production/local callback allowlist and passwordless magic-link/confirmation templates. Templates link to production and include a one-time code that also works on the local login page. Provisioning and automated tests send no emails. Actual delivery requires a permitted SMTP recipient/sender configuration; configure custom SMTP for external pilot users.

## Initial administrator

GES and the explicitly supplied Manuel account are provisioned. The account has an active `organization_admin` membership and must verify email by signing in. No password is stored by the application; Donn has no account.

For a fresh environment, use an explicit existing user ID:

```powershell
$env:GES_ADMIN_USER_ID = '<exact Supabase auth user UUID>'
npm run ges:assign-admin
```

Alternatively set `GES_ADMIN_EMAIL` to the exact supplied address. If no account exists, `npm run ges:assign-admin -- --create-account` provisions an unconfirmed passwordless account without sending email. The command refuses replacement when a different administrator exists. Never invent or commit administrator email values.

Manuel's next step: open `/login`, enter the supplied email and request a sign-in email. Follow its one-time link or enter its code. The selector then exposes Green Energy Solutions. Verify company facts against authorized current evidence before marking them verified.

## Release checks

```sh
npm ci
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:security
npm run test:auth
npm run test:secrets
npm run build
```

Run dev on port 3000 for auth browser tests; `TEST_APP_URL` overrides that origin. Edge is required. `test:security` rolls back fictional fixtures and seed checks in one transaction; run when the GES onboarding fixture is still pristine or use a dedicated test project. `test:auth` creates two disposable organizations/users, generates sign-in credentials without sending mail, and deletes explicit fixture IDs in `finally`. Neither test impersonates Manuel.

The DB helper uses authenticated CLI temporary connection details held in memory. If TLS requires the Supabase CA, download the project's official public database CA and set `NODE_EXTRA_CA_CERTS` to its path. Never disable certificate verification. A dedicated connection may be supplied through `BIDXCHANGE_TEST_DATABASE_URL`; configure verified TLS there. Never echo connection strings, API key output or generated links.

## Deploy and rollback

After release checks pass, push to `main` or run `npx vercel --prod` from the linked root. Vercel uses the root config and builds `apps/web`. Verify production demo routes, login, protected redirects and disposable auth checks with `TEST_APP_URL` pointing to production. Set SITE_URL before deploying.

For an application regression, promote the prior Vercel deployment or revert the application commit. Keep additive migrations and private storage intact; do not drop tenant data as a rollback shortcut. Database rollback requires a reviewed backup/restore plan. Restore auth URL/templates separately if needed. In an access incident, suspend affected memberships/revoke sessions through protected tools instead of disabling RLS.

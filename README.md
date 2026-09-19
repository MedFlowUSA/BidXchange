# BidXchange

Next.js, React and TypeScript contracting workspace with a separate fictional demo and an authenticated Supabase organization foundation. The existing visual design and browser-local demo remain intact. This is an onboarding beta, not a production bid-submission system.

Live: https://bidxapp.vercel.app

## Run locally

Use Node.js 24, npm and Microsoft Edge for browser tests.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The public demo needs no credentials and uses `bidxchange-demo-v1` local storage. For authenticated work, copy `.env.example` to ignored `.env.local`, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SITE_URL=http://127.0.0.1:3000`, and apply the database setup below. The local dev/start wrapper loads root environment variables. Missing credentials show a safe sign-in setup state.

## Application

- `/` redirects to `/dashboard?workspace=demo`.
- `/dashboard`, `/opportunities`, `/opportunities/[opportunityId]`, `/pursuits`, `/pursuits/[pursuitId]`, `/company`, `/documents`, `/reports`, `/settings` are real routes.
- `?workspace=demo` selects the fictional Apex workspace. Real workspaces use `?organization=<authorized UUID>` and require email sign-in.
- `/login` supports magic links and one-time codes; `/auth/callback` establishes a server-managed session.
- GES has pending company facts, an onboarding checklist and procurement preferences. Its real pipeline starts empty.
- Settings allows administrators to edit organization details, review fact verification and change existing member roles. Invitations, upload/scanning, operational editors, approvals, connectors and AI remain explicitly labeled placeholders.

## Validation

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:security
npm run test:auth
npm run test:secrets
npm run build
```

`npm test` covers the public app in desktop/mobile Edge. Database tests require an authenticated, linked Supabase CLI or an explicit test database connection; browser auth tests additionally use the linked project's admin API to create and remove disposable accounts. Run these against a dedicated test project for routine CI. See [setup and testing](docs/setup.md) for prerequisites and exact commands.

## Infrastructure and documentation

Vercel builds from the root using `npm ci` and `npm run build`, with `apps/web/.next` as output. The linked GitHub production branch is `main`. `.vercelignore` excludes local credentials, CLI state and test artifacts.

- [Supabase](https://supabase.com/dashboard/project/bcrxejydosltquspsutw)
- [Vercel](https://vercel.com/manuel-rodriguezs-projects-f5946c44/bidxchange)
- [GitHub](https://github.com/MedFlowUSA/BidXchange)
- [Architecture](docs/adr/002-authenticated-organization-foundation.md)
- [Setup, deployment and rollback](docs/setup.md)
- [Security boundaries](docs/security.md)
- [Phase completion report](docs/phase2-completion.md)

App: `apps/web`; scoring: `packages/scoring`; GES seed: `packages/database`; migrations: `supabase/migrations`. Estimates are not awards or revenue. Final pricing, representations, certifications and submission authorization remain human-controlled.

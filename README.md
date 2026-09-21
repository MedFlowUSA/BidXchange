# BidXchange

Next.js, React and TypeScript contracting workspace with a separate fictional demo and an authenticated Supabase organization foundation. The existing visual design and browser-local demo remain intact. This is an onboarding beta, not a production bid-submission system.

Live: https://bidxapp.vercel.app

## Run locally

Prepared locally: [official SAM.gov opportunity ingestion](docs/opportunity-ingestion.md), [configuration/runbook](docs/sam-gov-connector.md), and [validation/activation gates](docs/source-ingestion-validation.md). Source sync remains disabled; no real SAM.gov key or import has been used. Existing manual intake and AI are preserved.

Use Node.js 24, npm and Microsoft Edge for browser tests.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The public demo needs no credentials and uses `bidxchange-demo-v1` local storage. For authenticated work, copy `.env.example` to ignored `.env.local`, set `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` and `SITE_URL=http://127.0.0.1:3000`, and apply the database setup below. The local dev/start wrapper loads root environment variables. Missing credentials show a safe sign-in setup state.

## Application

- `/` is the public marketing homepage. It explains the product and current capability stages, with distinct sign-in and fictional-demo links.
- `/dashboard`, `/opportunities`, `/opportunities/[opportunityId]`, `/pursuits`, `/pursuits/[pursuitId]`, `/company`, `/documents`, `/reports`, `/settings` are real routes.
- `?workspace=demo` selects the fictional Apex workspace. Real workspaces use `?organization=<authorized UUID>` and require email sign-in.
- `/login` supports magic links and one-time codes; `/auth/callback` establishes a server-managed session.
- GES has pending company facts, an onboarding checklist and procurement preferences. Its real pipeline starts empty.
- Settings allows administrators to edit organization details, review fact verification and change existing member roles. Invitations, upload/scanning, operational editors, approvals and connectors remain explicitly labeled placeholders.
- `/assistant` and contextual dashboard/opportunity/pursuit panels implement a read-only evidence assistant behind explicit configuration and organization activation. No live feeds or private document retrieval are provided. See [AI architecture and activation](docs/ai-assistant.md).
- The public demo-request/beta-interest form is a disabled preview; no lead information is collected. See [homepage launch requirements](docs/marketing-homepage.md) before enabling it.

## Validation

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run test:security
npm run test:security:local
npm run test:ai:database
npm run test:auth
npm run test:secrets
npm run build
```

`npm test` covers the public app in desktop/mobile Edge. Database tests require an authenticated, linked Supabase CLI or an explicit test database connection; browser auth tests additionally use the linked project's admin API to create and remove disposable accounts. Run these against a dedicated test project for routine CI. See [setup and testing](docs/setup.md) for prerequisites and exact commands.

## Infrastructure and documentation

AI tests mock model responses and spend no credits. The `:local` security suite and `test:ai:database` use isolated PostgreSQL and synthetic fixtures without connecting to production. Hosted validation and paid model evaluation remain separate activation gates. See [the AI operational runbook](docs/ai-operations.md).

Vercel builds from the root using `npm ci` and `npm run build`, with `apps/web/.next` as output. The linked GitHub production branch is `main`. `.vercelignore` excludes local credentials, CLI state and test artifacts.

- [Supabase](https://supabase.com/dashboard/project/bcrxejydosltquspsutw)
- [Vercel](https://vercel.com/manuel-rodriguezs-projects-f5946c44/bidxchange)
- [GitHub](https://github.com/MedFlowUSA/BidXchange)
- [Architecture](docs/adr/002-authenticated-organization-foundation.md)
- [Setup, deployment and rollback](docs/setup.md)
- [Security boundaries](docs/security.md)
- [Phase completion report](docs/phase2-completion.md)

App: `apps/web`; scoring: `packages/scoring`; GES seed: `packages/database`; migrations: `supabase/migrations`. Estimates are not awards or revenue. Final pricing, representations, certifications and submission authorization remain human-controlled.

# BidXchange

A government-contracting workspace built with Next.js, React, and TypeScript. This first increment is an interactive prototype with fictional sample data, not a production client system.

Live preview: https://bidxchange-beta.vercel.app

## Deployment

Vercel builds from the repository root using `npm ci` and `npm run build`. The committed `vercel.json` selects Next.js and the `apps/web/.next` output directory. The connected GitHub repository deploys the production branch `main`. `.vercelignore` excludes local credentials, extracted reference material, CLI state, and build/test artifacts from CLI uploads.

## Run locally

Use Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. No credentials are required for the demo. Changes persist in this browser; the workspace guide includes a reset button.

```sh
npm run typecheck
npm run lint
npm run format:check
npm test
npm run build
```

Browser tests use Microsoft Edge. Install Edge first, or change the Playwright channel to an installed Chromium browser. For a local production build, run `npm run start` after building.

## Included

- Today dashboard with sample opportunity, pursuit, task, and readiness summaries.
- Opportunity intake, search, category/stage filters, eligibility evidence and score breakdown.
- Demo pursuit stages and persistent response checklists.
- Fictional company profile, sample document previews, and brief export.
- Responsive navigation and accessible native modal dialogs.

App: `apps/web`. Pure scoring: `packages/scoring`. Browser and scoring tests: `tests`. Product scope, next increment, rollback, and security boundaries: `docs`.

## Connected infrastructure

- [Supabase BidXchange](https://supabase.com/dashboard/project/bcrxejydosltquspsutw)
- [Vercel bidxchange](https://vercel.com/manuel-rodriguezs-projects-f5946c44/bidxchange)
- [GitHub MedFlowUSA/BidXchange](https://github.com/MedFlowUSA/BidXchange)

The existing `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` settings remain configured in Vercel and ignored `.env.local`. This prototype does not call Supabase or expose environment variables. Authentication, row-level security, client records, private uploads, procurement feeds, AI, and real approvals are future increments. No database migration or deployment is performed by running the demo.

Opportunity estimates are not awards or BidXchange revenue. No portal submission action exists.

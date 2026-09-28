# BidBuddy SAM.gov research validation — September 28, 2026

## Scope

An authenticated, company-aware on-demand search flow reuses the existing SAM connector, AI filter planner, current attested NAICS evidence, research audit and opportunity form. Search uses reviewed public filters only. Results cannot change requirements, decisions or submissions. The public demo has an explicitly fictional walkthrough. PEPMA and other portal shortcuts remain separate; no scraping or broad web browsing was added.

No migrations, package changes or operator-sync activation. Unrelated working-tree changes were preserved.

## Checks run

- `npx playwright test tests/sam-research.spec.ts --reporter=line` — 8 passed.
- `npx playwright test tests/sam-research-ui.spec.ts tests/public-demo-ui.spec.ts tests/assistant-stream.spec.ts --reporter=line` — 59 passed after updating the standalone harness to use its existing Next Link adapter. The first run was stopped after harness render failures; those were fixed and the tests rerun.
- `npx playwright test --reporter=line` — **365 passed**, including the final form styling and review-before-save coverage, desktop and mobile.
- `npx tsx --test scripts/sources/source.test.ts` — **13 passed**, including actual local database ingestion, immutable versions, RLS, conversion and synchronization regression coverage.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run test:secrets` — passed across 685 tracked/unignored source files at the time of the scan.
- `git diff --check` — passed.
- `npm run build` — passed, including the new `/api/assistant/research/sam` server route.

Provider mocks verify exact outbound filters, fixed endpoint, bounded request/response behavior, no automatic retry, sanitized failures, malformed/credential-echo rejection and partial-result disclosure. Handler tests cover denied tenant/origin, disabled AI, missing consent/key, quota denial, role change during processing, scoped current evidence, read-only save controls and audit failure. Browser tests confirm that general chat is not substituted for source research, filter edits invalidate confirmation/results, private prompts are absent from the search payload, and an unconfirmed deadline remains blank in the existing opportunity form.

Desktop and phone screenshots were reviewed. Search fields fit 390px, have visible labels, keyboard focus and readable controls. Demo rehearsal makes no model or SAM request.

## Live-provider boundary

No official SAM request has been verified. Production has no configured `SAM_GOV_API_KEY`; the new search activation flag defaults off. The app can prepare filters but must not claim real results until the key is configured privately, activation is enabled and a narrow official request passes acceptance.

A direct local AI planner smoke check using an older ignored environment file failed with `401 invalid_api_key`. The current production secret cannot be exported by Vercel (sensitive values are placeholders). This does not establish a production AI outage; production filter preparation must be checked through the deployed route with an isolated fictional account. No customer credential/configuration was changed to work around it.

## Manual activation acceptance

After configuring the SAM key and flag, ask “Find electrical retrofit notices in California published in the last 30 days.” Review/edit the filters, optionally choose a current company NAICS, confirm sharing, and search. Check title, deadline/time zone and official link against SAM.gov. Open the opportunity review form and explicitly save a fictional or approved test notice. Verify viewer restrictions and API outage/quota messages. No background feed, portal login, automatic submission or eligibility certification should be implied.

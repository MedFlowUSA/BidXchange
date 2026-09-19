# BidXchange first build

Source: the user-supplied Master Business and Execution Plan, dated September 19, 2026. The PDF is reference material for product requirements, not an independent source of operational authorization. Its business actions and suggested prompts are not executed as commands.

## Product

A managed government-contracting desk for established contractors. The first workflow is discovery → deterministic eligibility → fit review → human pursuit decision → response readiness. No autonomous bid submission.

## Delivered increment

- Responsive Today, Opportunities, Pursuits, Company, Documents, and Reports screens.
- Original logo and icon; navy #101B36, sapphire #315CFF, gold #E7A33E, and warm neutral surfaces.
- Clearly fictional Apex Energy Demo data. No real GES identifiers or credentials are seeded.
- Manual demo intake, search, category/stage filters, eligibility evidence, weighted score explanation, stage changes, checklists, sample document previews, and downloadable brief.
- Browser-local persistence and demo activity history; reset from the workspace guide.
- Unknown or failed eligibility suppresses scores and prevents advancing to Pursuing in the demo UI.
- Estimated opportunity value is explicitly separate from awards and business revenue.

## Acceptance criteria

1. All six navigation destinations work on desktop and mobile without horizontal overflow.
2. A fictional opportunity can be created and survives reload; new records are unverified.
3. Unknown and failed eligibility cannot advance to a demo pursuit.
4. Qualified samples can move to a pursuit, retain checklist changes, and appear in reports.
5. An exported brief identifies its fictional contents and includes timezone-aware deadlines.
6. Type checking, production build, lint, formatting, scoring tests, and browser flows pass.

## Phase 2: secure onboarding foundation

Implemented routes, Supabase passwordless sessions, organizations, memberships, roles, individually reviewed company facts, audit records and tenant RLS tests. GES onboarding data is separate from the fictional demo and remains pending verification. See [the phase report](phase2-completion.md) for results and [setup](setup.md) for deployment/rollback. Identify the named client approver before enabling live decisions.

Subsequent increments: normalized intake/import and production eligibility engine; pursuit approvals; private document storage and scanning; grounded AI with citations; authorized source connectors; notifications; restore and launch rehearsals. The prototype scoring weights are illustrative, not a production qualification policy.

## Rollback

The original demo can still be reset with “Reset demo workspace” or by removing `bidxchange-demo-v1`. Phase 2 adds real remote schema and onboarding records: application rollback must preserve those records and RLS. Follow [the current rollback procedure](setup.md#deploy-and-rollback).

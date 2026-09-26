# Company profile visibility — September 26, 2026

The authenticated navigation used “Passport,” the company loader omitted the saved company summary, and the overview displayed only two records per category in their original order. Newer website-enriched records were therefore easy to miss.

A scoped, read-only production check confirmed Green Energy Solutions has a saved website-derived summary and company records. No customer facts, attestations, memberships, or organization status were changed.

## Changes

- Authenticated navigation now says **Company profile**. The fictional demo retains Passport terminology.
- The company page loads its authorized organization's saved summary, legal name, website and latest saved-update date. Other workspace pages do not preload profile summaries.
- The overview shows contact details, services, territory, licenses/registrations and experience/team records. Recent updates appear first, with expandable older records and full descriptions.
- A prominent **Edit company profile** action opens the existing editor. Existing section links and unsaved form behavior remain intact.
- Saved descriptions and evidence statuses remain subject to human review. Saving information does not attest it.

No database migration or customer-data backfill is needed. The loader uses the existing session client, membership validation, organization filter and RLS.

## Local validation

- `npx playwright test tests/company-profile-loader.spec.ts tests/company-portal.spec.ts tests/contractor-ui.spec.ts tests/demo-bid-control.spec.ts --project=desktop --reporter=line` — **9 passed**, including 390px and 1440px browser coverage.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run build` — passed.
- `npm run test:secrets` — passed.

Loader tests cover authorized profile access, foreign-organization denial and avoiding profile queries on unrelated routes. Browser tests cover saved summaries, newest-first records, expansion, editor links, form preservation and demo navigation.

## Production acceptance

After deployment, use an isolated fictional organization and temporary test login to check authenticated navigation, summary display, record expansion, editor access, mobile overflow and unauthenticated access denial. Suspend the test organization and block its login afterward. This checks the shared production UI without impersonating a customer or modifying Green Energy's records.

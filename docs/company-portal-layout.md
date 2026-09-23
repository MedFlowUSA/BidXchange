# Company portal layout

Company now has five sections: Overview, Edit profile, Saved records, Dates & reminders, and Requests. The overview combines the existing completion checklist with a company header and direct links to evidence review, open information requests and renewal dates. The six setup sections use compact cards. Saved records retain search, review filters and editors; longer access explanations sit in a disclosure. Inputs, spacing, borders, focus styles and mobile navigation are scoped to Company.

Section links use URL fragments and support browser history. Existing `#passport-*`, `#fact-*`, `#information-request-*`, `#company-readiness` and `#company-onboarding` links reveal the relevant panel. Inactive panels stay mounted, preserving unsaved drafts, but are hidden from the visual layout and keyboard navigation. No authorization, database schema, evidence attestation or completion calculation changed. The persistent human-review notice remains.

Main files: `components/company-portal.tsx` and its CSS module; Company composition in `tenant-workspace.tsx`; checklist card wrapper in `profile-completion.tsx`. The new browser harness checks direct links, keyboard navigation, browser Back, draft preservation and containment at 1440px and 390px. The hosted staging walkthrough exercises the real Company forms and request workflow with synthetic accounts.

Validation: `npm run typecheck`, `npm run lint`, `npm test -- --workers=4` (233 passed), `node scripts/staging/onboarding-browser.mjs` (hosted authentication, evidence save, request creation/closure/reopening, invitation and viewer checks passed), `npm run test:secrets`, and `git diff --check`. Desktop and mobile screenshots of the signed-in portal were visually reviewed. The PDF guide and separate fictional demo retain their prior layout; no new production capability is claimed for either.

`npm run build` completed successfully. No database migration is required.

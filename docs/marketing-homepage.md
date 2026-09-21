# Public marketing homepage — implementation and launch requirements

Current public copy and feature-status report: [September 21 landing-page revision](landing-page-specificity-2026-09-21.md). The sections below retain historical implementation and launch context; their old disabled-feature and contact statements are superseded by current release reports.

## Outcome

`/` now renders a public BidXchange marketing homepage instead of redirecting to the fictional demo. The existing logo and icon, authenticated routes, demo local storage, tenant loaders, Supabase policies, authentication redirects and old-domain redirect are preserved.

The four distinct destinations are:

- `/`: public product information.
- `/login`: existing-user sign-in.
- `/dashboard?workspace=demo`: fictional public demonstration.
- `/dashboard`: existing authenticated-workspace resolver.

Only a server-validated user identity causes the public header to include **Open Workspace**, pointing to `/dashboard`. No user email, organization name, membership list or GES company facts are loaded into the marketing page. The page checks `getUser()` rather than trusting a client-supplied flag; only its resulting boolean is passed to the header. Existing authorization remains responsible for `/dashboard` access. An identity-provider error leaves the public content available with the ordinary sign-in link.

## Sections

Responsive header and keyboard navigation; requested hero/headline/tagline; fictional representative dashboard frame; public-sector opportunity categories and no-affiliation disclosure; contractor problems; Find/Qualify/Pursue/Learn; twelve capability descriptions grouped as available, foundation or planned; planned assistant/example questions with no generated answers; seven audiences; expert-supported managed-service direction; security/human-control principles; founding-plan pricing without published prices; demo/beta-interest preview; existing-user link; footer and clearly pending legal/contact notices.

The hero positioning describes the product direction, immediately qualified by a phase disclosure. Eligibility checks and scoring are expressly fictional-demo functionality; real pursuit and compliance screens are foundations; live sourcing, matching, AI and addendum monitoring are planned. The preview uses fictional Apex demo examples, not real customer data or performance statistics. Managed-service components are prospective, not current commercial commitments.

## Interest form: disabled by design

**No submission endpoint, lead table, persistence, email delivery or analytics event exists for this form. No data destination exists.** The brief explicitly permitted a disabled preview if secure intake could not be implemented in the existing architecture.

The current application does not have a dedicated trusted public lead-ingestion path, approved privacy notice, retention rules or destination/recipient for inquiries. Existing server clients operate with the public key and a user's session; they are not an established anonymous lead-processing service. Enabling anonymous writes into existing tenant tables or automatically provisioning access would violate this task's boundaries. No database policies or production users were changed.

The complete visual form includes the requested fields and two intent choices. It is rendered as an accessible `role="form"` group with a disabled fieldset, not a native submitting `<form>`. Every input is disabled, and its disabled button has `type="button"`. There is no action URL or submit handler. This avoids a default browser GET submission leaking values into a URL. The preview is not saved in local/session storage or sent to analytics. It cannot report fake success or grant access.

Field definitions include appropriate input types, required indicators and maximum lengths: name 120, email 254, phone 40, company 200, website 500, geographic market 200 and message 1500. These are **preview markup constraints, not implemented server validation**. Server validation, normalization, spam prevention, persistence success/failure states, deduplication and lead-read authorization tests are deferred together until there is a real submission service. There is no active endpoint to rate-limit or expose leads through today.

The consent checkbox explicitly notes that the privacy notice is pending. Footer Privacy/Terms/Contact links lead to that honest status disclosure, not fabricated legal pages or an invented email address. “Request a Demo” and “Discuss Your Needs” anchors open the preview section, which clearly says requests are not accepted yet and offers the fictional demo as the current alternative.

## Requirements before accepting requests

1. Approve a privacy notice, responsible business identity, consent wording, inquiry purpose, retention/deletion schedule and contact channel. Publish appropriate Terms separately; placeholders are not legal terms.
2. Specify the controlled lead destination and who is authorized to read/respond. Do not reuse tenant company tables or create organizations/memberships from inquiries.
3. Design a server-only ingestion path. If a new table is chosen, add a reviewed forward migration, deny public reads, and independently test role restrictions. Do not put privileged keys in browser code.
4. Validate all inputs on the server, normalize email using trim/lowercase, enforce enum and length limits, validate optional website schemes, reject unknown fields and require consent. Treat free text as untrusted text; do not log message bodies.
5. Add server-verified bot protection, a honeypot where appropriate, persistent rate limiting, duplicate-rapid-request protection and an idempotent submission strategy. Client disabled/loading state alone is not abuse protection.
6. Record only necessary audit information, such as an internal request ID, timestamp, consent-notice version, requested intent and processing outcome. Define whether any anti-abuse network identifier is needed, how it is minimized and how quickly it is deleted. Keep personal form values and tokens out of request logs, analytics and browser storage.
7. Implement accessible field-level errors, generic processing failures, pending and truthful success states. Test failure/retry, invalid consent, bot rejection, rate limits, duplicate submissions and anonymous/unauthorized lead reads before enabling the form.
8. Use staging fixtures, not production-user provisioning, to exercise the full intake lifecycle. This task did not create a staging service or send communications.

## SEO, accessibility and performance

The homepage provides the requested title/description, production canonical URL, Open Graph and Twitter metadata using the existing brand icon. Bare `/` is indexable; query variants are noindex. The application layout defaults all other pages to noindex/nofollow. `/robots.txt` excludes workspace/login/auth/query paths, and `/sitemap.xml` contains only the canonical homepage. Robots directives are crawl guidance, not authorization; session checks and RLS remain unchanged.

The public header uses native links and an accessible menu button with expanded/controls state; Escape closes the mobile menu and returns focus. The page has a skip link, semantic sections/headings, visible focus states and reduced-motion CSS. No scroll-jacking, autoplay or heavy animations are added. CSS modules isolate its styles from existing workspaces. Next Image serves scaled versions of approved artwork without replacing the originals. Product illustrations are lightweight HTML/CSS; the large interactive demo is not embedded or imported.

Visual checks identified and corrected a mobile grid intrinsic-width issue. Regression tests measure actual hero, product-frame and form bounds instead of relying only on document scroll width, which can be misleading when overflow is clipped.

## Files and routes

- `apps/web/app/page.tsx`: public server page and page metadata.
- `apps/web/app/layout.tsx`: default noindex/nofollow for non-public routes.
- `apps/web/next.config.ts`: exact local-image allowlist for optimized approved brand assets; existing redirects/security headers preserved.
- `apps/web/app/robots.ts`, `sitemap.ts`: public crawler metadata routes.
- `apps/web/components/marketing-header.tsx`: public navigation and mobile behavior.
- `apps/web/components/public-workspace-access.tsx`: identity-flag-only workspace entry.
- `apps/web/components/product-preview.tsx`: explicitly fictional dashboard frame.
- `apps/web/components/interest-preview.tsx`: non-submitting interest-form preview.
- `apps/web/components/marketing.module.css`: isolated responsive design.
- `tests/marketing.spec.ts`, `tests/public-access.spec.ts`: homepage/preview/SEO/responsiveness and identity-entry coverage.
- `tests/workspace.spec.ts`: existing demo tests enter the explicit demo destination.
- `scripts/test-auth.mjs`: additional signed-in homepage-to-workspace checks, ready for a separately authorized staging run.
- `playwright.config.ts`: marketing scenarios included in mobile coverage.
- `README.md`, this document: changed root behavior and launch requirements.

No database migration, policy change, organization provisioning, user creation or lead persistence was introduced. The existing September 19 audit report is preserved as a separate local artifact and is not a public marketing asset.

## Validation

Executed results: Playwright reported **31 passed (55.3 seconds)** across unit and desktop/mobile browser coverage. Production build, ESLint, TypeScript, Prettier and the secret scan passed; the secret scan covered 89 tracked and unignored source files. The dependency audit reported **zero vulnerabilities**. Desktop, tablet and mobile visual checks were also completed.

The test suite includes the existing scoring unit tests, a conditional signed-in-entry component test, public homepage browser tests and existing desktop/mobile route/workflow tests. The disabled preview tests verify field constraints, disabled inputs, absent native submission and no resulting POST/browser-local persistence; they do not claim to validate a nonexistent server form endpoint.

The signed-in-entry component test checks its destination and lack of identity details. It is not a fresh authenticated end-to-end session test. The operator auth test now also covers the signed-in public homepage, absence of tenant details and successful workspace entry. That test creates users in its linked project and was not run for this task, because the user explicitly prohibited production-user creation. Run it only against a separately authorized staging project. No existing session was impersonated. Tenant/auth server code and policies were not changed.

## Local launch

From the repository root, after dependencies are installed:

```sh
npm run dev
```

Open http://127.0.0.1:3000 for the homepage or http://127.0.0.1:3000/dashboard?workspace=demo for the fictional workspace. `npm ci` installs the locked dependencies if needed. Existing `.env.local` conventions remain unchanged; the public page and demo do not need credentials, while authenticated sessions require the already documented Supabase settings.

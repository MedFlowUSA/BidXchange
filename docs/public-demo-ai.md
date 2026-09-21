# Live public-demo assistant

The user explicitly requested live AI in the public demo on September 20, 2026. This supersedes earlier statements that paid demo AI must remain disabled. The authenticated GES assistant and its quotas remain separate.

`/api/demo-assistant` answers general questions with the existing configured OpenAI model, no tools, no company data, no uploaded documents, and no web access. Apex examples remain fictional. It uses the [OpenAI Responses API](https://developers.openai.com/api/docs/guides/text), `store:false`, no SDK retries, a 30-second cancellation deadline, a 1,500-character prompt limit, and at most 600 output tokens. This is not a live procurement search or eligibility determination. Each question is independent; only the current answer is retained in component memory. Provider data policies still apply; store:false is not a claim of zero provider retention.

The browser receives an HttpOnly signed session cookie. Requests require the expected Origin and a valid cookie. The server HMAC-hashes visitor and Vercel edge network identifiers; raw IP addresses, prompts and answers are not stored in the application database. Cookies are Secure in production, SameSite Strict and scoped to the public endpoint. The global ceiling remains effective even if an attacker resets cookies or varies network identity.

Migration `20260920001400_public_demo_ai.sql` adds two RLS tables and a service-only atomic reservation RPC. Limits: 5/browser/day, 10/network/day, one request/minute per browser or network, and 100 total public-demo requests per UTC day. Failed/cancelled generations count. Daily reservations bound paid work independently of organization quotas; this is not a dollar-denominated billing cap. Old metadata is pruned after 14 days during subsequent reservations. Anonymous and authenticated clients cannot read these tables or call the reservation function directly.

Server-only configuration: `BIDXCHANGE_AI_PUBLIC_DEMO_ENABLED=true`, `BIDXCHANGE_DEMO_AI_SERVICE_KEY`, and the existing `OPENAI_API_KEY`, `OPENAI_MODEL`, `SUPABASE_URL`, `SITE_URL`. The service credential is used only to check the demo setting and reserve its quota. The old `BIDXCHANGE_AI_DEMO_ENABLED` flag controls the separate offline scripted fallback; it does not authorize paid requests.

Kill switch: set `demo_ai_settings.enabled=false` through protected operator access (checked before and after generation), or turn off the public feature flag and redeploy. No company membership or user is created. No document/source activation occurs.

Validation: local SQL tests cover disabled state, role denial, duplication, cooldown, visitor/network/global ceilings and settings write denial. Mocked route tests cover forged cookies, cross-origin requests, tenant-field injection, quota rejection before provider access, and no-tools/store:false provider requests. Desktop/mobile browser tests cover generated-answer rendering, clear controls, limits and absence of tenant IDs in requests. TypeScript, lint and production build are required before deployment.

Release commands use the existing verified staging/production database helpers and named migration 014 only; they never apply pending document or source migrations:

```powershell
node scripts/public-demo-release.mjs staging
node scripts/public-demo-release.mjs production
node scripts/configure-public-demo.mjs configure-production
node scripts/public-demo-release.mjs enable-production
```

Use the repository's official Supabase CA through `NODE_EXTRA_CA_CERTS`; never disable certificate verification. Credential transfer is in memory and stdin, never in chat, source files or command arguments. Live activation must be verified by an actual bounded public-demo request after deployment.

Release status (September 20, 2026): migration 014 is installed in staging and production with the production database switch enabled. SQL quota tests, mocked route tests, four public-demo browser tests, five migration-package tests, TypeScript, lint and production build passed. The existing scripted-demo UI test could not run successfully against the development server because its offline-demo flag is disabled. No live OpenAI demo request has been verified. Automatic approval review rejected transferring the Supabase service-role credential into Vercel without specific authorization for that destination. This key has broad database privileges despite the narrow use in this endpoint. The user subsequently authorized deployment in direct response to the specific credential-transfer question. Credential configuration and database activation then succeeded. Deployment and a live browser check are pending.

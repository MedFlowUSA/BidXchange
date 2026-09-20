# One-time provider diagnostic — prepared, not deployed

The reviewed implementation is in `scripts/provider-diagnostic/handler.mjs`, `staging-claim.sql`, `route.ts.template`, and two test files. No diagnostic route exists in the live app or staging app. The SQL has not been applied. No OpenAI request has been made and no existing OpenAI secret has been retrieved.

## Proposed execution boundary

The configured OpenAI secret is Production-only. Copying it into Preview would violate the rollout instructions. Instead, use a temporary **Production-target, unaliased deployment** in the existing Vercel project, based on production commit `deaa512`, with only the diagnostic handler and route added. Deploy with `--prod --skip-domain`; never promote it or assign the public app/staging aliases. This is a diagnostic deployment using the existing server secret, not production AI activation. It requires explicit diagnostic-deployment approval before execution.

Vercel's [Standard Protection](https://vercel.com/docs/deployment-protection) covers generated production deployment URLs. Before arming, verify the actual generated URL rejects anonymous requests, that the project has the expected protection, and that `bidxapp.vercel.app` still points to `dpl_E471XMezx85L3kkCC82MwwdUdXzE`. The handler additionally requires its exact generated hostname, POST with no body or query parameters, matching Origin, a real staging JWT verified through Auth, and an exact operator user UUID. The one-off operator account has no tenant memberships. Its random credentials and sessions must stay in memory. No email is sent.

Apply the reviewed claim SQL to staging only after deployment approval. It creates a private, RLS-enabled operational table with no browser grants and a narrow claim RPC. Create one disabled run tied to the exact operator UUID. Ordinary users cannot create, arm or reset runs. The SQL atomically changes an enabled, unexpired, unclaimed row to consumed before any provider request. A crash, timeout or ambiguous result consumes the attempt; retries are not allowed. Retain the consumed claim until the diagnostic deployment is deleted.

The handler is disabled by default. Deployment-specific configuration may enable its code gate, but the database run must remain disabled until the separately requested paid-execution approval. After that approval, arm the single row with at most a 15-minute expiry and immediately make one authenticated request. Use header/cookie authentication only, never a query-string secret. No global or tenant AI setting is enabled.

## Exact payload and result

```json
{
  "model": "gpt-5.6-luna",
  "input": "Reply with OK.",
  "store": false,
  "reasoning": { "effort": "none" },
  "max_output_tokens": 32
}
```

The SDK uses the existing server secret, the fixed OpenAI project `proj_uC3tLIZilUKSlZtrIhdQlQ34`, the fixed official API origin, a 15-second timeout and zero retries. There are no tools, tenant queries, conversation history or caller-provided prompts. The handler does not log or persist responses. It returns only a sanitized success/failure class, recognized model identifier, `OK` or `unexpected_output`, validated token counts, cost estimates, and the required no-retry/store/tenant-data confirmations. Headers and raw internal errors are never returned.

The [official model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna), checked September 19, 2026, documents Responses support, reasoning effort `none`, and standard rates of $0.20 per million input tokens and $1.20 per million output tokens. Cache writes cost 1.25 times uncached input. With a deliberately conservative allowance of 1,000 input tokens and 32 output tokens, the expected upper estimate is **$0.0002884**, below **$0.001**, at those rates. Actual account access and billing have not been provider-validated. This estimate is not an account-wide spend cap; automatic reload remains unchanged.

## Approval and removal

Approval requested: deploy this protected, unaliased diagnostic, apply its staging-only claim objects, and prepare a disabled run/operator account. **This does not authorize the paid request.** After deployment and negative-access checks, ask again immediately before arming and sending it.

After the attempt, keep the run consumed, delete the temporary diagnostic deployment, verify its URL is gone and both app aliases are unchanged, then remove the diagnostic RPC/table and disposable operator account from staging. Keep only the sanitized validation report. No production migration is required. Do not merge the diagnostic route into the normal application.

Four offline tests passed: deployment/input/identity gates, fixed payload and concurrent handler claims, sanitized failures/output, and the actual SQL's disabled/operator/expiry/consumption/grant rules. The concrete route also passed a complete local Next.js production build in `.tmp/diagnostic-app`; it has not been uploaded. The concurrent handler test uses a fake claim service; real hosted claim concurrency must be checked after deployment approval, with a separate no-provider fixture. No provider success is claimed.

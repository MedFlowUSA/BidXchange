# General questions and live AI activation

The user's September 20 request is to make the assistant live and able to answer general questions. This release adds a General questions mode as the default for signed-in users. It calls the existing configured OpenAI model with the user's prompt only, without tenant records, document content, tools, or live web search. Output is labeled as general AI assistance rather than verified company evidence. Questions remain independent; the tab's visible history is not model context.

Workspace records mode retains the existing extractive evidence workflow, authenticated retrieval, citation reauthorization, role restrictions and no-write boundary. Model-generated company claims are not substituted for verified records. General mode can explain, draft, brainstorm and answer knowledge questions, but cannot inspect files, browse live sources or take external actions.

Both modes require sign-in, active workspace membership, operator AI activation and persistent request quotas. Proposed activation is limited to the existing Green Energy Solutions workspace, 50 requests per organization per day and 10 per user per day. Public demo AI remains disabled. Document uploads remain separately disabled.

A temporary deployment opt-in runs one minimal Responses request using the existing production key, `gpt-5.6-luna`, `store:false`, no tools, `reasoning.effort:none`, 32 output tokens and zero SDK retries. The only prompt is “Reply with OK.” It sends no company records. Failure stops deployment; sanitized logs distinguish key, permission, model and quota errors without exposing secrets. Remove the preflight switch after the attempt so subsequent deployments do not spend on repeated checks. The existing key is never exported locally.

Production activation completed September 20, 2026. Deployment `dpl_3Rm22CPWqQp3wVF9wPWgBF2H8Csj` successfully executed the isolated provider check: 10 input tokens, 5 output tokens, expected response received, no tenant data sent. The Green Energy Solutions workspace (`7f459940-4240-439f-9b84-a2e92365cde6`) was then enabled with 50 daily organization requests and 10 per user. The global switch, model and request limits are configured in production; the public site origin is `https://bidxapp.vercel.app`.

The temporary provider invocation has been removed from the build command. The first deployment had skipped the check because a runtime-only flag was unavailable at build time; it sent no provider request. The corrected deployment used an explicit opt-in command and succeeded. No raw key or tenant record was exported for validation.

Forty-one focused engine/browser checks passed, including the fictional demo rerun on an isolated server with its test flag enabled. Type checking, lint, production build and secret scan passed. A signed-in production conversation was not performed on the user's behalf; API connectivity was verified by the isolated production request, with UI and access behavior covered by controlled tests.

Reference: [OpenAI text generation through the Responses API](https://developers.openai.com/api/docs/guides/text). General responses use separate instructions and no database tools; workspace mode retains its existing structured evidence contract.

# General questions and live AI activation

The user's September 20 request is to make the assistant live and able to answer general questions. This release adds a General questions mode as the default for signed-in users. It calls the existing configured OpenAI model with the user's prompt only, without tenant records, document content, tools, or live web search. Output is labeled as general AI assistance rather than verified company evidence. Questions remain independent; the tab's visible history is not model context.

Workspace records mode retains the existing extractive evidence workflow, authenticated retrieval, citation reauthorization, role restrictions and no-write boundary. Model-generated company claims are not substituted for verified records. General mode can explain, draft, brainstorm and answer knowledge questions, but cannot inspect files, browse live sources or take external actions.

Both modes require sign-in, active workspace membership, operator AI activation and persistent request quotas. Proposed activation is limited to the existing Green Energy Solutions workspace, 50 requests per organization per day and 10 per user per day. Public demo AI remains disabled. Document uploads remain separately disabled.

A temporary deployment opt-in runs one minimal Responses request using the existing production key, `gpt-5.6-luna`, `store:false`, no tools, `reasoning.effort:none`, 32 output tokens and zero SDK retries. The only prompt is “Reply with OK.” It sends no company records. Failure stops deployment; sanitized logs distinguish key, permission, model and quota errors without exposing secrets. Remove the preflight switch after the attempt so subsequent deployments do not spend on repeated checks. The existing key is never exported locally.

Activation order: validate tests, deploy with provider check, inspect its result, enable only the named production workspace after provider success, remove the temporary check switch, and verify the final deployment. Do not describe failed or untested provider access as live AI. A signed-in production conversation requires an authorized user session and is not implied by build-time provider validation.

Reference: [OpenAI text generation through the Responses API](https://developers.openai.com/api/docs/guides/text). General responses use separate instructions and no database tools; workspace mode retains its existing structured evidence contract.

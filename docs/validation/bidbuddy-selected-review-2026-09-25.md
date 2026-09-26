# BidBuddy selected-requirement review

Extends existing company records, pursuit requirements and human-reviewed task plans. Authorized administrators and capture managers can preview and explicitly share up to eight requirement excerpts. Each receives an AI explanation, company-record comparison, cited sources and a suggested next step. The server rejects missing/duplicate review rows and non-company sources used as company evidence. No database migration or automatic finding, decision, approval or submission writes.

Sharing stays organization/pursuit/role scoped. Source versions are checked before paid generation and before releasing the answer. Selection changes reset consent and conversation context. General mode rejects sharing. Exact excerpts are preserved; generated prose renders known requirement IDs and internal freshness labels readably.

Limits: 4,000 characters per excerpt; 20,000 combined; 80 retrieved rows and six tool calls per selected review; 6,000 output tokens; existing 45-second timeout. Source fingerprints expand to 32 for review follow-ups; ordinary chat retains 16. Conversations remain temporary (four recent turns, 30-minute expiry); no persistent history, uploads or web search was added. A selected review is not a complete solicitation review or eligibility finding.

## Automated checks actually run

- Initial targeted suite: 85 passed.
- `npm test`: 284 passed.
- `npx playwright test tests/requirement-review.spec.ts tests/ai-conversation.spec.ts tests/assistant-stream.spec.ts tests/assistant-task-actions.spec.ts`: 42 passed after the source-reference and display refinements.
- `npx playwright test tests/requirement-review.spec.ts tests/ai-tools.spec.ts tests/ai-route-conversation.spec.ts`: 49 passed after correcting presentation issues found in the live answer.
- Typecheck, lint, production build, secret scanning and whitespace checks passed for the initial release; the presentation follow-up was rebuilt and linted separately.

## Real-provider acceptance

The initial production release was exercised through the authenticated application using a newly created fictional organization, two requirements and expired insurance. No model response was mocked and no customer records were used. Nine checks passed: preview/consent; exact cited review coverage; prime/subcontractor responsibilities and expired insurance; hostile source instruction ignored; task proposals without automatic writes; desktop/mobile containment; general-mode rejection; stale selection rejection; and fixture shutdown.

The initial test harness needed a required organization name and browser-side capture of the streamed response. These were corrected before the successful run. The live answer exposed internal requirement IDs and a freshness enum in generated prose; the follow-up normalizes those display values while retaining original excerpts and citation identifiers.

Synthetic workspaces are suspended, AI is disabled and test logins are blocked after acceptance; audit history remains. Local artifacts under `.tmp/selected-review-*` contain fictional test results and screenshots and are not committed. Never publish authentication tokens from the answer artifact.

These checks establish a working bounded review and tested isolation controls. They do not establish universal model accuracy, complete coverage of a notice, or superior performance against competing tools. A broader contractor-question evaluation set remains the highest-value quality follow-up.

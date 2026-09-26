# Production bid-planning acceptance

Completed September 25, 2026, 6:23 PM Pacific (2026-09-26 01:23 UTC), against https://bidxapp.vercel.app/ after release `2aaf8d8`.

The authenticated production assistant was tested with a fictional organization, synthetic pursuit and one requirement needing review. The deployed application called its real configured AI provider; no provider response was mocked and no production key was exported. Green Energy Solutions and other customer records were not modified.

## Passed

1. Test account signs in to its own pursuit on production.
2. Assistant status reports available for that authorized workspace.
3. Real AI returns a proposed task, a citation to the recorded requirement, and a review token.
4. Generating an answer creates no task.
5. The proposal renders without horizontal overflow at a 390px mobile viewport.
6. Clicking Save without the human-review checkbox creates no task.
7. Explicitly reviewed task saves through the real server action. Database inspection confirms the edited title, selected owner, deadline, requirement link and `todo` status.
8. Saving the task leaves the requirement at `needs_review`.
9. An authenticated request for an unauthorized organization returns HTTP 403.
10. Test shutdown disables AI, suspends the fictional organization and disables its test login. Synthetic records and audit history are retained rather than deleting audit records.

## Execution and limitations

The final successful command was `node .tmp/planning-live-test.mjs --reuse`. All ten checks passed. The ignored local script keeps administrative credentials in memory and creates the test session without sending email. No credentials or session tokens are stored in the report.

Earlier attempts encountered an Edge response-body inspection failure; switching the test harness to clone the browser fetch stream resolved it. An immediate duplicate request was correctly rejected with HTTP 429. These attempts are not counted as successful acceptance runs. Direct database connectivity also had a certificate-chain error; the test used the authenticated Supabase HTTPS API with normal TLS verification instead.

This supersedes the release's statement that signed-in live provider acceptance was unverified. It validates one small synthetic workflow, not answer quality across all real solicitations or every permission/staleness scenario. Those broader cases remain covered by the release's automated tests where documented.

The assistant still receives requirement status metadata rather than private clause text. In this test it proposed reviewing the excluded requirement and its disclosure classification. It did not translate or analyze the underlying license clause. Broader clause interpretation remains outside this release.

Local evidence: `.tmp/planning-live-results.json` and `.tmp/planning-live-mobile.png`. Fictional fixture IDs are retained privately in `.tmp/planning-live-fixture.json` for operational traceability.

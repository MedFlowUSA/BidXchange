# Company records in the assistant

Authenticated assistants open in Workspace records mode. A visible company context notice links to the selected organization's Company page. General questions remain available without attaching company records; public demo behavior is unchanged.

## Using the connection

1. Save company information on Company. Unsaved form edits are not available to the assistant.
2. Open Assistant in the same organization and leave Answer mode on Workspace records.
3. Ask a specific question, such as “What is our business email?” or “Which insurance records need verification?”
4. Review the cited record, verification state and last-updated date. Workspace answers show the time the server finished checking their cited records.
5. After saving another change, ask again or choose **Refresh from company records** on the previous answer. Refresh creates a new request and uses normal AI quotas.

The assistant reads the application's current database records for each request; there is no separate profile copy or scheduled synchronization job. Structured fields saved through Company produce the readable record value used by the assistant. Existing answers remain snapshots. Refresh does not update previously exported documents or write anything back to the company profile.

## Retrieval and access

`search_company_records` supports record-label search, an optional exact category and bounded pagination, allowing targeted retrieval beyond the legacy first ten records. Label search is not semantic search or a search of attachments and source notes. A full page supplies the next possible offset; that next page may be empty. Existing record and tool-call budgets still apply, so results must not be represented as exhaustive.

Queries use the signed-in user's database client, organization scope, existing row-level security and AI disclosure rules. Unknown sensitivity is excluded for every role. Restricted records and categories remain limited by role. The assistant cannot see every record simply because a user selected Workspace records. Citations are re-read and authorized before release; a removed or newly restricted record fails closed. There is no atomic whole-company snapshot across multiple queries.

The connection does not bypass organization AI activation, availability or usage limits. It does not enable uploads, private files, external procurement feeds, automated verification, bid submission or AI writes to company data.

## Validation

Coverage includes current saved values after edits, later pages, targeted labels, cross-organization exclusion, unknown/restricted sensitivity, source revocation, General-mode isolation, refresh after a mode switch, and desktop/mobile controls. Tests use synthetic records and mocked model responses; no real company data or paid model requests are needed.

# Per-bid PDF report

In an authenticated bid/pursuit workspace, use **Bid report** near the top of the page. Select a saved response draft for its answers, or choose no draft to export the current review. Choose **Download bid report PDF**. Save response edits before exporting.

The report combines:

- Company identity, saved description and permitted company facts with sources, attestation status, check dates and expiration dates.
- Bid scope, buyer, solicitation, deadline/time zone, source references, recorded qualification criteria, job walks, question deadlines and submission instructions.
- Active requirements, source citations, latest human findings, linked evidence references and the selected saved draft's answers. Missing answers, placeholders and changed source versions remain flagged.
- Latest register sign-off and decision, tasks, recorded amendments, latest frozen-response approval status and its latest user-recorded submission.

This is a confidential internal review snapshot, not a buyer form, eligibility determination, completed response, approval or proof of submission. It neither creates answers nor changes record status. Human findings and authored answers are separate. Unreviewed company facts can appear with explicit status labels; their appearance does not grant proposal-use approval. The existing response draft and submission handoff exports are unchanged.

By default, the same workspace-safe company disclosure rule used for shared information excludes sensitive facts. Administrators, executive approvers and estimators can explicitly include restricted company facts already permitted by their role. Financial facts remain administrator-only. Unclassified facts are always omitted. Free-text bid answers and notes are included as saved, so review the entire report before sharing. Source documents are referenced rather than embedded. The public fictional demo does not call this authenticated export.

## Implementation and limits

`lib/bid-report.ts` assembles the report from existing tenant data; `api/bid-reports` uses authenticated Supabase/RLS reads and the existing mutation rate limiter; `components/bid-report.tsx` supplies the choices/download/error flow. `response-render.ts` reuses local Noto fonts and branding with report-specific cover, headers and footers. No migrations, dependencies, AI calls, provider credentials or stored report files are added.

The route validates organization/pursuit/draft version, checks the exact tenant record, and reauthorizes user/role after rendering. It then reloads the same source selection and refuses the download if its rendered content changed. Private/no-store headers prevent response caching. It fails visibly for unsupported PDF characters, oversized/incomplete source sets or missing draft versions rather than silently dropping text. Existing limits include 100 active requirements, fewer than 500 loaded company facts/tasks, fewer than 100 amendments and 180,000 report-text characters. The 20 most recent supported drafts are offered; older drafts can be opened and saved through the response workflow. Historical audit trails and previous release versions are not represented as a complete history.

## Validation — September 28, 2026

- `npx playwright test tests/bid-report.spec.ts tests/bid-report-route.spec.ts tests/bid-report-ui.spec.ts tests/response-package.spec.ts tests/handoff-export.spec.ts tests/handoff-route.spec.ts --reporter=line`: 17 passed.
- `npx playwright test tests/bid-report.spec.ts --reporter=line`: 5 passed after checking the existing `complete` task status in the open-work count.
- `npm run typecheck`, `npm run lint`, `npm run test:secrets`, `npm run build`: passed. Secret scan covered 752 source files.
- Actual multi-page PDF text and rendered pages checked; 1440px/390px download controls and retry behavior checked.
- Route tests cover anonymous/foreign access, restricted-role denial, stale draft IDs/versions, quotas, role loss and changes to facts, answers, review findings and company descriptions during rendering.

Manual check: open a real bid, select its saved answer draft, download the PDF, compare the requirement answers with the saved editor, and confirm every incomplete or stale item remains visible. Including restricted records is a deliberate confidential-export choice. A saved answer is not a reviewed qualification or approval.

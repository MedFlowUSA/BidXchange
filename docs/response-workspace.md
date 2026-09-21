# Response workspace

The recommended command is **Create a response outline for this solicitation**. Explicit RFP, RFI, RFQ, bid, sources-sought and capability-statement response outlines are supported. The legacy “create an RFP for this bid” command remains recognized. Commands create contractor response drafts, not buyer solicitations. Standalone intent and a selected authorized pursuit are required; quoted instructions, negation and compound submission requests do not create records.

Capture managers and administrators save the overview and requirement answers. Other active members may inspect shared response drafts and export them under RLS. Save before export. Review unanswered items, drafting placeholders, changed requirements and omitted/removed scope. A drafted-answer count is a writing aid, not compliance or readiness certification.

## Autofill and final files

Current supported company identity/contact/registration fields and saved bid/source information populate draft documents. Values must satisfy their disclosure, source, verification and date checks. Qualification evidence also needs current scoped proposal-use approval. Unknown, restricted, stale and unverified records do not automatically become claims. Not every company field has an export mapping. Inspect the draft and correct source records; never assume complete representation or eligibility.

PDF and Word exports refresh permitted automatic values. Written answers remain saved text. Word edits do not synchronize back into BidXchange. Generated files are draft working copies; they are not signed, finally approved or submitted.

In the activated release workflow, finish and review final files externally, then select them to calculate SHA-256 locally. No bytes are uploaded. Each manifest entry records file name, hash and an authorized storage reference. Do not enter credentials, access tokens or signed URLs. The browser caps selection at 30 files and 50 MB each; the RPC accepts a bounded 30-entry manifest. The system records the human's assertion about those files; it cannot independently retrieve or verify externally stored bytes.

Freeze the saved response with a checklist and a named active submitter. This creates an immutable version; correcting any checklist/file entry requires a new version. A draft export created later is not automatically the approved file. Match final bytes against the recorded hash.

## Readiness view

The pursuit shows source/deadline, recorded requirement and finding counts, unanswered/placeholder/stale answers, saved draft version, owner gaps and the checklist/approval state. Required forms, signatures, formats, limits and submitter remain unknown until reviewed and recorded. Missing or unknown entries block approval. Counts cannot certify that all obligations in the notice were captured.

See [exact state and approval meanings](approvals-and-submission.md), [role permissions](role-permissions.md), and the [HTML guide](../apps/web/public/guides/bidxchange-user-guide.html).

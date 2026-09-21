# BidXchange user guide — presenter notes

20–25 minutes plus a 10-minute practice exercise. Review workflow edition; approval and submission features enabled for authenticated production workspaces.

## 1. From opportunity to reviewed response

Audience: new BidXchange users and team leads. Plan for a 20–25 minute walkthrough plus a 10-minute exercise. This September 21 workflow edition distinguishes existing features from role-controlled approval and submission records. Open https://bidxapp.vercel.app/ before presenting. Explain that BidXchange organizes company evidence, bid review and response drafts. A draft export is not approval or proof of submission.

## 2. Follow one bid through the workspace

Define an opportunity as the source bid or notice. A pursuit is your team's workspace for assessing and responding to that opportunity. Company facts can be reused, but applicability and proposal-use reviews belong to specific requirements. Use the workflow in this order during the first session.

## 3. Sign in and choose the right workspace

Do not display credentials while presenting. A signed-in account still needs active organization membership. Never use another person's account to gain a missing control. The demo is useful for navigation, but it is not a live company workspace and does not save company response packages.

## 4. Learn the main navigation

Point to the sidebar in the screenshot. In a live workspace, Today provides the task queue. Company is the foundation for document autofill. Opportunities and Pursuits are different stages. Documents, Reports and Settings are also available in navigation; this session focuses on the active bid-to-response workflow. Menu visibility and controls depend on access.

## 5. Complete Company before drafting

An administrator manages company records. Use the Company setup prompts, including address, phone and email. Unknown values should remain unknown. UEI/CAGE identifiers can be recorded under registration. Do not paste passwords, tax identifiers or account credentials into shared records. Presence in the profile alone does not establish eligibility for a bid.

## 6. Understand what makes a fact reusable

Separate three questions: is the recorded fact supported, may workspace members see it, and does it apply to this requirement? A record can be verified without being approved for proposal use. Basic current verified identity and registration facts populate automatically. Licenses, capabilities and certifications require current applicable evidence-use approval for the pursuit. The workflow never treats a company fact as a whole-document approval. Autofill also excludes role-restricted fact types. Qualifications require current approved proposal use for the specific pursuit. Empty, unsourced, expired and unverified facts do not become claims.

## 7. Capture the source opportunity

The screenshot illustrates the opportunities area, not a production record. Manual opportunity entry is the reliable path covered by this training. A title and source reference are required. Unknown dates should not be guessed. When entering a deadline, follow the form's explicit-offset and time-zone instructions. Do not claim automatic discovery or continuous SAM.gov synchronization; connector activation is a separate rollout.

## 8. Create a pursuit for the bid

Demonstrate this in an authorized training workspace, not with an unrelated production opportunity. Use the existing pursuit link when one is present to avoid parallel copies of the same work. Capture managers and administrators can create planning workspaces. All subsequent response commands must be issued from the selected pursuit so the assistant knows which bid is intended.

## 9. Turn notice language into requirements

Keep each obligation and its conditions together when pasting. Do not paste restricted company information into public-notice capture. The excerpt stays in the tab, while saved requirement wording and citations become shared workspace records. Review tables, attachments, cross-references and amendments manually. A missing candidate does not mean the notice contains no obligation.

## 10. Connect each requirement to evidence

Administrators and executive approvers perform evidence-use reviews. Capture managers prepare the requirement register and coordinate follow-up. Requirement dispositions and bid intent are separate human decisions. Explain that changes to requirements, facts or dates can invalidate prior review context. Do not use a favorable label to infer pricing approval or submission authority.

## 11. Assign work and record bid intent

Administrators and capture managers manage pursuit tasks. Administrators and executive approvers record bid/no-bid decisions. The decision is attributed and historical; a changed review context means it needs renewed attention. Task counts and statuses support coordination rather than certification. Keep restricted information out of shared reasons and task text.

## 12. Choose the assistant mode for the job

Live AI availability depends on workspace activation and usage limits. The assistant has no live web browsing. Workspace answers use authorized evidence. Document creation is an explicit application action that prepares a saved outline; it does not mean the model wrote a complete proposal. The public demo assistant is separate and cannot create company response records.

## 13. Ask for a response, then open the draft

The exact example command is supported. Also try Draft an RFI response or Prepare an RFQ for the selected pursuit. Without a selected pursuit the app points the user to Pursuits. The resulting outline contains requirement sections and type-specific completion prompts. Narrative and pricing still need qualified human preparation. Repeated transport retries reuse the same creation request rather than overwriting another draft.

## 14. Check the information that fills itself

Restricted, expired, unverified and future-effective facts are not copied into shared documents. Basic profile names and website come from workspace settings; sourced company facts have separate verification requirements. Missing information is flagged rather than invented. Existing drafts benefit from current automatic sections, but old manually written narrative can still contain stale values and must be reviewed. Autofill is allowlisted; it is not every company field. Downloaded working drafts refresh permitted values, while frozen release snapshots and external final-file hashes remain immutable.

## 15. Finish the draft before downloading

TODO/TBD and bracketed drafting prompts are flagged. Ordinary references like [1] are not treated as placeholders. A written answer whose requirement changed is not counted as drafted against current wording. Review links focus the overview or affected answer. Save edits before relying on the saved preview and downloads. If the app asks for a fresh load after saving, use Open saved response packages.

## 16. Export a working copy for review

Exports include an internal review checklist and are not automatically buyer-ready. Keep the saved application draft current if changes made in Word should be reflected there. PDF may reject unsupported glyphs; Word is the alternative. Later source changes do not update files already downloaded. BidXchange does not currently perform final document approval, electronic signature or procurement-portal submission for this workflow.

## 17. Read readiness without assuming approval

Availability: the release workflow is enabled for authenticated production workspaces, subject to role permissions. States are determined by records; they do not necessarily occur in this order. Needs review means a frozen context changed. Submitted means a human recorded submission; it does not verify buyer receipt. Sources may have obligations absent from the local register. Unknown forms, signatures or file limits cannot silently pass.

## 18. Approve the exact response version

Available only where versioned release workflow is activated. Every approval binds an immutable response snapshot, current source context and SHA-256 file manifest. A new upstream decision invalidates downstream decisions even if the upstream decision again says approved. Current implementation uses a UTC-day review boundary; next-day recording may require fresh review. The same authorized reviewer can perform multiple gates; no four-person separation of duties is enforced.

## 19. Hand off, submit manually, keep the receipt

The workflow is enabled for authenticated workspaces with the required roles. The handoff is JSON and includes bounded immutable history, not file attachments. Hashing occurs in the browser, without uploading selected files. Submission requires explicit confirmation by the named active submitter after current authorization. If a receipt is unavailable, record that limitation. Append corrections; never overwrite original history. Recording after the deadline or a UTC review-date change is conservatively blocked unless recording a correction to an already recorded submission. Follow-up events support questions, clarifications, interviews, best-and-final-offer requests, award/loss/cancellation, debriefs and lessons learned.

## 20. Use help without adding another dashboard

Guidance is optional and does not create records or grant permissions. Records and counts are scoped to the organization, current role and loaded pursuit. Global lists are bounded samples; a guide cannot certify an entire company or a complete solicitation. The HTML guide is the accessible reading alternative; the PDF uses tagged text but is not certified PDF/UA.

## 21. Know who owns the next action

This is a workflow-oriented role summary, not a promise of unrestricted access. Visibility depends on organization membership, classification and record policies. Restricted company facts are not made public by including a document in a shared workspace. Users who can read shared response packages can review/export them, while creating and editing drafts requires capture or administrator permission.

## 22. Resolve the common stopping points

If an export reports changed company or bid information, reload and retry after reviewing the change. Large or incomplete source registers can prevent export and should be reviewed by a capture manager. An unavailable feature may be permission- or rollout-dependent. Source PDF upload/extraction, scanner-backed attachments and automatic portal submission are not prerequisites for the manual workflow taught here and should not be presented as live automation.

## 23. Practice once, then make it routine

Use synthetic information and label the record Training — not for submission. Do not invent an official citation; for this exercise cite the training brief and its numbered items. Have the trainee demonstrate the difference between missing data, verified evidence and approved use. Export a PDF or Word draft and identify its internal checklist. Coordinate cleanup of training records with the administrator. End by opening https://bidxapp.vercel.app/ and showing where the next real task will begin.

## Source and screenshot notes

App behavior was checked against the reviewed implementation, including response packages, saved review, assistant commands, company autofill, capture forms, evidence reviews and bid decisions. Screenshots show the public fictional demo at https://bidxapp.vercel.app/; they contain no private company workspace records. App paths and labels reflect the current implementation. Availability and controls depend on role and rollout settings.

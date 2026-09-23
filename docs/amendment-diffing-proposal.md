# Amendment Diffing — design checkpoint

This records the design checkpoint for feature 2. The user authorized implementation on September 22. The first delivered increment is documented in `amendment-comparison.md`: public pasted source versions, rule-based clause comparisons and human-confirmed amendment recording. LLM extraction and private-file processing remain deferred. Decision Log is feature 1.

## Existing architecture to extend

- `opportunity_amendments` already stores official amendment links, pasted text, summaries and human review attribution.
- `amendment-actions.ts` enforces organization-admin/capture-manager access and optimistic review updates.
- The existing amendment trigger invalidates requirements and decision/register context when a person records an amendment. Preserve that conservative behavior.
- `amendment-preview.ts` compares a single requirement's literal text; it does not extract document fields or interpret meaning.
- Existing requirement evidence findings, register sign-offs, decision snapshots and audit history remain authoritative. No replacement models are needed.

## Proposed additive schema

1. `solicitation_source_versions`: organization and opportunity foreign keys; optional amendment ID; source kind (original/amended), official HTTPS URL, user-supplied document name, immutable pasted/extracted text, text hash, capture method, captured by/at. Reuse an equivalent immutable source-version model if further inventory finds one. Do not reconstruct historical original text from today's edited notice.
2. `amendment_diff_runs`: organization/opportunity IDs, original and amended source-version IDs, status, extraction method/model/prompt version, created by/at and bounded failure code. Runs are immutable once completed; reruns create new records.
3. `amendment_diff_items`: run ID and organization, field category, old/new structured values, old/new exact source quotations and locations, confidence, and ambiguity/missing-source flags. Categories: license class, bond amount, insurance minimum, deadline/time zone, job walk, scope. Missing means unknown, not removed or zero. Preserve units, bond percentage versus dollar amount, insurance coverage type and conditional language.
4. `amendment_diff_requirement_links`: candidate item-to-existing-requirement associations with tenant-constrained foreign keys and the requirement revision used for comparison.
5. `amendment_diff_reviews`: append-only human confirmation, rejection or correction; reviewer, timestamp, explanation, corrected interpretation, confirmed affected requirement IDs and expected source/requirement revision references. Corrections do not overwrite model output.

Use tenant RLS and existing roles throughout. Read access must follow source-document sensitivity as well as organization membership; do not expose restricted source excerpts through generally visible diff rows. Keep sensitive source content out of operational logs. Preserve existing evidence-view permissions.

## Human boundary and implementation order

1. Ship linked/pasted source versions and side-by-side review first. A URL alone is a reference, not proof that its content has been retrieved. Do not introduce unsafe uploads, restricted portal scraping or arbitrary URL fetching.
2. Extract structured **candidate** values from both immutable source versions using the existing server-side AI boundary. Treat source text as untrusted data. Validate quotations against the supplied text and mark unsupported or ambiguous values for review. Show “AI-generated comparison — human review required” where applicable.
3. Display field, old value, new value, source quotations and suggested affected requirements. Extraction alone must never create an official amendment, change a requirement status, sign off a register or record a decision.
4. Add a transactional confirmation RPC using existing authorized capture roles. Recheck membership, organization, source hashes and requirement versions under lock. Record the human review and audit event before changing requirement review context. Reject stale or duplicate submissions safely.
5. For an already human-recorded amendment, retain its existing conservative invalidation. For a newly confirmed amendment, record it through the existing workflow, which conservatively invalidates all related requirements. Show that impact explicitly. Selective invalidation can be a subsequent reviewed change; do not weaken the current safeguard or imply only suggested rows changed status.
6. Keep “amendment reviewed,” requirement evidence reaffirmation, register sign-off and final bid decision as distinct human actions. No automatic restoration of Reviewed status.

## Acceptance tests

- Original and amended text remain immutable and company-scoped.
- An AI candidate cannot change requirement, sign-off or decision status.
- Missing source, conflicting dates, absent time zones, changed units, percentages, negation and ambiguous clauses stay unresolved.
- Confirming a changed field preserves previous evidence findings and decision snapshots while requiring renewed review.
- Old source or requirement versions reject confirmation; repeated confirmation is idempotent.
- Unauthorized roles and foreign IDs cannot retrieve source text or confirm a diff.
- Prompt-injection text cannot invoke actions or alter extraction instructions.
- Desktop/mobile show source citations, human controls and the actual invalidation scope clearly.

The accepted implementation keeps source versions, candidate items and requirement snapshots in one bounded comparison row and human reviews in a second append-only table, reusing the existing amendment records. This reduces unnecessary model duplication; the generalized five-table/LLM design above remains a possible extension rather than a claim about the delivered schema.

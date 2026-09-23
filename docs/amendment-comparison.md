# Saved amendment comparison

In a pursuit, open **Opportunity amendments → Create amendment comparison**. Supply the original and amended public excerpts, both official URLs and an amendment label. The tool saves the source versions and compares license, bond, insurance, deadline, job-walk and scope clauses. Exact source wording and line numbers remain visible alongside suggested existing requirements to inspect.

This release uses `contractor-clause-diff-v1`, a deterministic keyword/line comparison, not AI. It does not interpret legal equivalence, calculate normalized bond amounts, infer omitted conditions or fill absent time zones. Missing means not found in the supplied excerpt. Tables, attachments, synonyms and cross-references may be missed. The official URLs are references; BidXchange does not fetch them. Private upload processing and LLM extraction are not implemented here.

## Human review

Saving a candidate does not record an amendment or change requirements. An organization administrator or capture manager reviews the original sources, identifies affected requirements, writes findings/corrections, then confirms or dismisses the comparison.

Confirmation records an official amendment using the existing workflow. Its conservative safeguard marks **all** requirements associated with the opportunity as needing review and invalidates prior sign-off/decision context. Selected requirements document the specific human findings; they do not limit this broader safeguard. Prior decisions and evidence history remain unchanged. Actual requirement wording, deadline fields, pricing and approvals are never updated automatically. The recorded amendment itself still requires human review; requirements, sign-off and decisions remain separate steps.

Stale comparisons cannot be confirmed. Dismiss an obsolete comparison and create a new one from the current sources. Repeating the exact same confirmation does not create another amendment; a conflicting second review is rejected.

## Schema and access

Migration 032 adds `amendment_comparisons` and append-only `amendment_comparison_reviews`. Each run retains immutable source text/URLs/content fingerprints, versioned candidate fields, current requirement snapshots and the context token. The two-table implementation keeps the bounded snapshots together instead of introducing five generalized document/extraction tables. It reuses existing opportunities, requirements, amendments and decision context. No existing columns or customer rows are transformed.

Comparison source text is readable only by the existing administrator/capture-manager roles in its organization. Confirmation explicitly warns that the resulting public amendment excerpt and human summary are shared under the existing amendment permissions. New audit events contain record identifiers, not source text. The existing official-amendment audit behavior remains unchanged.

The server checks roles, tenant scoping, safe input bounds and literal quote/source correspondence. The confirmation RPC locks the comparison, opportunity, pursuits and requirements and rechecks current context. Direct authenticated updates/deletes of comparisons and reviews are not granted. Up to 24,000 characters per excerpt, 200 linked requirements, and the five latest saved comparisons are displayed; older records remain retained. Content fingerprints detect version differences and are not authenticity certifications.

## Rollout and rollback

Apply reviewed migration 032 to staging, run `scripts/staging/amendment-comparison-browser.mjs`, then apply the same additive migration to production before enabling `BIDXCHANGE_AMENDMENT_COMPARISON_ENABLED=true`. Rollback disables that flag; preserve source and human review history. No model calls, provider purchases or external messages are introduced.

## Manual acceptance

1. Compare an original 5% bond clause to a 10% amendment, with changed deadline and meeting clauses. Inspect the exact quotes and suggested requirements.
2. Verify candidate creation leaves requirement/sign-off/decision status unchanged.
3. Confirm the official amendment with specific human findings. Check the amendment, review flags and stale sign-off/decision context; original history must remain unchanged.
4. Change a requirement after saving another candidate. Confirm that it cannot be finalized and can still be dismissed.
5. Check viewer and different-company accounts cannot read or confirm saved comparisons.
6. Repeat the review on a phone. Check missing source clauses remain unknown and external links are labeled.

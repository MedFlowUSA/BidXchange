# Requirement amendment review

The first amendment increment is a human-entered, single-requirement change workflow. On a pursuit requirement, authorized capture users can open **Review an amendment**, compare saved and revised text, cite the amendment, inspect the review-impact explanation, and save the revised requirement with follow-up reset to **Needs review**.

The text preview highlights the common prefix/suffix and changed span. It preserves literal text and Unicode code points and makes no semantic interpretation of dates, thresholds, or buyer intent. Separated edits may appear as one changed span. The user must decide which requirements an amendment affects.

The form delegates to the existing `saveRequirement` server action: verified account, organization-admin/capture-manager access, mutation limit, active owner validation, pursuit scoping, RLS and optimistic `updated_at` matching. The original version is retained with the draft even when parent data refreshes. Conflicts retain draft text; success disables further submission until reload. The checkbox is a UI review reminder, not a separately persisted approval or buyer acknowledgment.

Saving changes the requirement version. Existing database validity checks then mark its evidence-use approvals and requirement findings for another review, and the bid-decision context changes. No review history is erased. The current citation is replaced; users must include references needed for the revised interpretation. Existing audit policies apply, but this feature does not introduce a user-facing amendment ledger or document snapshots.

No migration, new permission, document upload, official-source fetch, AI request, outbound acknowledgment, or automatic deadline update is introduced. Whole-document comparison, retained source versions, amendment-to-many-requirement links, and acknowledgment tracking remain separate work.

Validation includes focused text comparison/capture-input tests, type checking, lint, production build and signed-in staging coverage for saved changes, review invalidation, optimistic conflicts, mobile layout and role restrictions. The staging fixture is synthetic and cleaned up after the run; no production business records are used for testing.

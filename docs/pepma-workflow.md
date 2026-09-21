# PEPMA intake and pursuit workflow

PEPMA is an owner-identified primary bid source for Green Energy Solutions. This release adds a manual, authenticated workflow to the existing opportunity and pursuit system. It does not claim an API connection, private-account synchronization, automatic invitation discovery, document ingestion or portal submission.

## Use

1. In **Opportunities**, choose **Record PEPMA bid**. Record the bid name and number, sponsoring utility, category, IOU service area, business contact, invitation reference, scope, question deadline, proposal deadline and latest addendum/Q&A reference. Confirm the source and authority to share the entered details with the workspace.
2. Use an HTTPS PEPMA bid URL, or the home URL plus a traceable invitation reference. Do not include passwords or session credentials. Check for an existing opportunity before creating another entry.
3. Open the saved opportunity and start or open its pursuit. Source details are human-readable notes on the existing audited opportunity, not a separate synchronized profile. Edit opportunity to update these notes after checking the portal. Proposal deadline uses the existing deadline field and explicit UTC offset; question deadline is recorded in notes and must be assigned as a task to receive task follow-up.
4. The **PEPMA bid desk** provides review prompts for invitation/scope, questions/addenda, qualifications, business proposal, cost proposal, technical documentation/summary of offer, and submission confirmation. **Plan follow-up** opens an editable, assignable task draft. Nothing is saved merely by selecting a prompt.
5. Enter actual buyer requirements and exact citations in the requirement register. Use existing company-evidence review and resolution controls to document gaps and human findings. For changes to saved requirements, use the existing amendment control; no automated portal comparison runs.
6. Prepare working response drafts in Response packages. Company information uses the existing authorized autofill rules. Review buyer-required templates and keep business/cost/technical files separate when instructed; this release does not manufacture a cost workbook, cost-effectiveness model or complete proposal from the checklist.
7. Use existing versioned file review, approvals and named-submitter controls. Perform delivery in PEPMA, then record the portal confirmation and receipt reference in the submission record. Saved internal approval is not evidence of buyer receipt.

## Permissions and implementation

- Intake delegates to `saveOpportunity`, retaining authenticated organization-admin/capture-manager access, mutation limits, row-level security and existing audit history.
- Form validation fixes the source host to PEPMA, rejects URL credentials and ambiguous dates, and bounds all notes. The final mapped record is validated again by `opportunityInput`.
- No database migration, new service-role access, external account credentials or private tenant seed data is required.
- Viewer access is read-only. Task and requirement mutations reuse their existing authenticated actions and optimistic edit checks.
- Company-record AI access is unchanged. Source notes remain outside the AI disclosure boundary; this feature does not send private invitation notes or documents to the provider automatically.
- PEPMA labels mean the recorded source URL is PEPMA, not that the portal or invitation has been independently verified.
- No fictional PEPMA bids are inserted into a real company workspace.

## Integration still requiring external capability

A supported PEPMA API/export method and its authorized access terms have not been established. Private login sessions are not harvested. Automatic invitation/addendum synchronization remains unavailable. Secure document uploads remain dependent on the separate scanning-worker rollout; links and reviewed text can be recorded with existing tools meanwhile.

## Source and validation

The [PEPMA homepage](https://www.pepma-ca.com/Public/Default.aspx) and its linked **PEPMA User Instructions** describe invited account access, Bid Page/Quick Links, proposal categories and confirmation records. The actual bid-specific RFx overrides generic workflow prompts. The [public opportunity page](https://www.pepma-ca.com/Public/ContractingOpportunities.aspx) is not a complete inventory of private invitations.

Synthetic tests cover field mapping, explicit-offset dates, source host spoofing, review confirmation, bounded notes, intake action delegation, task drafts, viewer controls and mobile containment. Real-company write validation requires an authorized user's actual invitation; testing does not create production bids or invoke PEPMA submission.

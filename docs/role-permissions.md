# Response workflow role matrix

All rows require active organization membership. Anonymous, inactive and other-tenant users have no access. UI controls are convenience only; session actions and PostgreSQL independently enforce permissions.

| Action                                                          | Admin      | Executive  | Capture    | Estimator | Contributor | Viewer |
| --------------------------------------------------------------- | ---------- | ---------- | ---------- | --------- | ----------- | ------ |
| Read shared guide, readiness, draft/release/history and handoff | Yes        | Yes        | Yes        | Yes       | Yes         | Yes    |
| Verify company facts                                            | Yes        | No         | No         | No        | No          | No     |
| Edit opportunities, requirements, tasks and response drafts     | Yes        | No         | Yes        | No        | No          | No     |
| Record bid intent and ordinary requirement finding              | Yes        | Yes        | No         | No        | No          | No     |
| Record documented buyer waiver                                  | No         | Yes        | No         | No        | No          | No     |
| Freeze response/checklist/file manifest                         | Yes        | No         | Yes        | No        | No          | No     |
| Pricing approval/rejection/revocation                           | Yes        | Yes        | No         | Yes       | No          | No     |
| Compliance, final and submission-authorization decision         | Yes        | Yes        | No         | No        | No          | No     |
| Record actual submission or correction                          | Named only | Named only | Named only | No        | No          | No     |
| Record post-submission event                                    | Yes        | Yes        | Yes        | No        | No          | No     |
| Directly insert/update/delete release history                   | No         | No         | No         | No        | No          | No     |

Current membership and exact version are checked on every action. An asserted browser role is never accepted. Prior reviewers losing their required role invalidates current approvals. Cross-tenant IDs do not grant access. Restricted facts retain their existing policies and are not silently copied into shared release snapshots.

# Contract Passport, evidence graph and reverse qualification

## Using this release

Open a saved pursuit, then choose **Open qualification workspace** in its decision brief. The authenticated route is `/pursuits/[pursuitId]/qualification?organization=[organizationId]`.

The workspace prioritizes recorded blockers, evidence expiring on or before the submission deadline date, unresolved findings and changed response sections. Select an evidence record to see the requirements and saved response sections connected to it. Expand a requirement to inspect the source trail or assign follow-up work through the existing task action. An administrator or capture manager can save a task with an owner and deadline; viewers cannot. Review existing tasks first to avoid duplicates.

The Passport now recognizes renamed structured company records by stable type keys, shows all related visible records and their review status, and retains separate scopes for single-project and aggregate bonding. A generic vendor registration is not treated as a SAM registration. Related records are not a completeness determination.

## What the engine knows

- It consumes the existing tenant-authorized pursuit snapshot; no service-role read or new database table is introduced.
- Evidence edges are established only by recorded requirement-specific evidence-use reviews. It does not guess links from similar wording.
- Current evidence use requires the recorded approval, applicable scope and a currently reviewed company fact. Stale and inaccessible evidence cannot become current support.
- A current human requirement finding remains separate from evidence approval. Recorded blockers are prioritized even when other requirements have support.
- Response edges use saved requirement IDs and versions. Changed requirement versions, changed review contexts and unfinished answers trigger follow-up. They do not certify individual narrative claims.
- Expiration comparisons use the submission deadline's recorded time zone. A same-day expiration prompts review rather than asserting coverage through a particular hour. Missing or invalid deadlines remain unknown. Contract-performance coverage needs a separate assessment.
- Record limits, unavailable review features, unreadable response formats and invisible linked evidence are explicitly reported. There is no global eligibility percentage or win probability.
- Tasks reuse existing role checks, mutation limits, persistence and audit behavior. Completing a task does not approve a requirement, proposal or submission. Existing versioned release controls remain authoritative.

## Validation

Targeted tests cover blocker priority, shared dependencies, stale/hidden/disabled evidence, deadline time zones, amended response sections, incomplete views, Passport recognition, mobile layout, task handoff and viewer controls. Existing evidence, readiness, pursuit-brief and tenant-scoping regressions are included. Browser action tests use synthetic fixtures and a mocked action transport; production records are not created for testing.

## Broader brief: remaining work

This is the first connected view of the existing Passport and review records, not completion of the full contract-and-funding operating-system roadmap. The following remain separate workstreams:

- Grant applicant/project profiles, grant discovery and project-building workflows.
- Supported Cal eProcure imports, funding APIs, USAspending intelligence and amendment archives.
- Persistent remediation plans with confirmed cure methods, partner qualification, estimated cost/time and outcome tracking. This release provides human-assigned tasks, not a claim that a gap can be cured before a deadline.
- Market-wide reverse qualification and readiness-to-revenue estimates based on complete opportunity coverage and supported values. This release examines one recorded pursuit at a time.
- Sentence-level evidence attribution, document parsing and private-file ingestion with malware scanning.
- Field capture, pricing/margin analysis, authorized external-system connectors and post-award operations.

No new paid service, portal authentication, external submission or automated eligibility decision is activated by this release.

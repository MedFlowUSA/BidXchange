# Reliable record links as a workspace grows

Opportunity and pursuit detail pages previously depended on the workspace loader's first 500 records. A valid link could therefore show not found when its record fell outside that sample. A pursuit could also lose its source opportunity or show no tasks because unrelated records filled the shared sample.

The detail loader now queries the selected record UUID directly with the authenticated user's Supabase client and an explicit organization filter. It separately resolves a pursuit's source opportunity and scopes task retrieval to that pursuit. Opportunity pages retrieve pursuits related to that opportunity. Missing and unauthorized records both return no context; database errors remain sanitized failures. Invalid record IDs and unexpected selection fields are rejected before retrieval.

Direct records are merged into the existing workspace sample by ID, retaining the current workspace search behavior. No service-role access, new API, migration, provider request or production setting is introduced. All private queries remain subject to existing RLS and validated organization membership. The public demo follows its existing route path.

Files: `apps/web/lib/tenant-records.ts`, `apps/web/lib/tenant.ts`, `apps/web/lib/route-view.tsx`, `tests/tenant-records.spec.ts` and the current security documentation. Six regression cases cover records after 501 unrelated rows, pursuit parent/task retrieval, foreign UUIDs, foreign parents, malformed input and sanitized failures.

This change improves link reliability, not complete search or pagination. Workspace lists remain bounded; related lists are limited to 500 rows with stable ID ordering. Detail pages add focused queries to the existing workspace load. Full server-side search/pagination and page-specific loading remain separate improvements.

Changes are local pending release review; no deployment is authorized by this work. Production AI remains disabled and staging creation/cost approval remains pending.

Validation: `npm test` passed all 87 tests, including six new direct-record regressions. `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test:secrets` and `git diff --check` passed. The first type check identified an overly broad query-field type; preserving literal field types resolved it before the passing run. New retrieval tests use synthetic mocked database responses; no new hosted JWT coverage or live deployment validation is claimed.

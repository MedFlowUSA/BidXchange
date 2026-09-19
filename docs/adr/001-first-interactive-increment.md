# ADR 001: Interactive prototype before client data

Status: accepted for the first build.

Use Next.js, React, and TypeScript with application code in `apps/web` and deterministic qualification logic in `packages/scoring`. Dependencies and development commands are managed at the repository root. Extract shared UI and additional packages when an actual consumer exists.

Use custom CSS with shared variables for the initial design system instead of Tailwind. This keeps the small first increment independent of an additional styling integration while preserving the plan's palette and responsive shell.

The first increment is an explicitly labeled fictional prototype. It uses browser-local state, not the connected production Supabase database. Its UI gate demonstrates workflow logic; it is not an authorization boundary. A future authenticated release must independently enforce transitions in the server/database.

No live procurement integrations, AI calls, uploads, external notifications, billing, or submissions are activated. Existing Supabase and Vercel setup remains available for the next increment. Unknown eligibility is never represented as passing.

The first score is illustrative: scope 35%, geography 20%, capacity 25%, readiness 20%. Production rules must incorporate dated license/registration evidence, performance periods, bonding limits, mandatory events, official deadlines, and organization-specific weights before actual use.

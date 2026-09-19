# Preview data boundaries

Only fictional sample records belong in this prototype. The browser-local state is readable and editable by its user; there are no authenticated accounts or tenant boundaries in this increment.

The connected Supabase service is not called by the preview. No service-role credential is needed. Local environment files and CLI state are excluded from Git. The app renders input through React text nodes and validates local-storage shapes before loading. Native modal dialogs provide focus confinement and Escape dismissal.

The browser requests optional Google Fonts styles; system fonts remain usable if blocked. No procurement or company data is sent with that font request.

## Before a real client pilot

- Enforce organization membership and roles in database row-level security and server-side operations.
- Test cross-tenant reads, writes, document access, and privilege escalation.
- Make audit events immutable to ordinary users and append them transactionally.
- Enforce actual deadlines and mandatory events with evidence and explicit timezones.
- Keep storage private, validate size/type, scan uploads, and authorize expiring downloads.
- Add MFA for privileged accounts, rate limiting, monitoring, backups and restore testing.
- Define retention, deletion/export, incident response, and authorized source access.
- Ground AI in tenant-authorized evidence and evaluate prompt injection and unsupported claims.

Pricing, personnel, financial, and restricted procurement information require more restrictive access than ordinary opportunity notices. Classify and approve data categories before ingestion.

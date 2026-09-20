# Private document foundation

## Release status

Migration `20260920001200_document_versions.sql` is installed in staging only, with its UTF-8/LF checksum pinned in staging package revision 8. Production migration and `BIDXCHANGE_DOCUMENTS_ENABLED=true` activation have not been applied. Production remains on the existing closed document library.

This increment adds separate document libraries and immutable version metadata. Legacy `company_documents` rows are not treated as scanned versions and cannot grant access through the new download route.

## Workflow and authority

Organization administrators upload PDFs up to 2 MiB. The application checks the MIME type, header and byte limit, hashes the bytes, reserves a new version through an authenticated RPC, and writes to a unique private object path without overwrite permission. A service-only confirmation queues the upload. Interrupted reservations remain unavailable and consume quota; an operator must reconcile stored-but-unqueued files before confirming them. Retrying creates another version, not an overwrite.

Reservations are serialized per organization. Limits are 50 reservations per day and 100 MiB of reserved bytes per organization, including pending and rejected versions. The existing per-user mutation limit also applies. There is no user-facing erasure or quota-recovery workflow in this release.

Administrators, executive approvers and estimators can read document metadata; other tenant roles cannot. No client storage policies or signed upload/download URLs are introduced. The server download route checks user-session RLS before fetching, verifies size and SHA-256, rechecks access before releasing bytes, and responds as an attachment with private/no-store caching and sandbox headers. Fresh storage reads use a cache nonce. Revocation prevents subsequent requests; it cannot retract bytes already downloaded.

Administrators can link a scanned version to a requirement with a page/section reference. Links retain the exact version rather than following later uploads. The RPC checks tenant ownership and the expected requirement timestamp. A new link changes that timestamp, invalidating earlier evidence-use approvals, findings and bid-decision context through existing rules. Reference metadata is restricted to document-reader roles. A link is provenance, not verification of a claim or permission to submit.

Lists disclose the 500-record presentation limit. Version references remain downloadable through their exact authorized IDs even when that version is outside the loaded library sample. Reference supersession, unlinking, cross-pursuit impact analysis and a full provenance timeline remain future work.

## Scanner and deployment

The Node worker reads confirmed pending versions, verifies their bytes, and streams them to a private ClamAV daemon. Only the exact successful result releases a file. Signature databases older than 48 hours, errors and timeouts defer processing; detection and integrity failures reject it. Verdict updates are service-role-only and terminal. A clean version cannot be overwritten or relabeled by an application user. Scanner compromise or new threat intelligence requires an operator to disable document access while investigating; this increment has no user-facing quarantine recall.

The container package is in `scripts/documents/`: Dockerfile, Compose configuration, ClamAV policy and polling worker. No host port exposes the scanner. Logs contain queue counts, not file content. Supply the project URL and service key through the host secret environment; never put credentials in the repository. The worker uses the privileged Supabase service credential, so keep the host isolated and restrict administration. Pin a reviewed supported ClamAV image digest before deployment. The Docker package has not been executed on a real host in this session.

Official references: [ClamAV streaming protocol](https://docs.clamav.net/manual/Usage/ClamdProtocol.html), [ClamAV container operation and memory guidance](https://docs.clamav.net/manual/Installing/Docker.html), [Supabase immutable-path upload guidance](https://supabase.com/docs/guides/storage/uploads/standard-uploads), and [private downloads](https://supabase.com/docs/guides/storage/serving/downloads).

## Hosting proposal — no purchase made

The user requested a new private worker and a cost proposal before purchase. Proposed host: DigitalOcean Basic regular CPU, 8 GiB RAM, 4 vCPUs, 160 GiB SSD, listed at **$48/month**, excluding taxes and additional existing Supabase storage/egress usage. This gives the scanner its recommended memory plus space for Node and the operating system. See [current Droplet pricing](https://www.digitalocean.com/pricing/droplets). No optional paid backups or other services are included in the proposal. Provider availability and checkout pricing must be verified when provisioning.

The Stripe Projects provisioning skill was inspected and the installed CLI plugin upgraded, but its catalog query did not yield a usable service result. No project, provider resource, account, or paid plan was created.

## Validation and activation checklist

Local checks cover tenant isolation, denied browser scan verdicts and metadata changes, sequential version allocation, pending/clean transitions, hash matching, restricted references, stale requirement saves and access revocation. Scanner protocol tests cover exact INSTREAM framing, split responses, stale signatures and failure verdicts. Application checks cover PDF limits, tenant-loading regressions, type checking, lint and production build. Staging schema parity passes and confirms the bucket remains private with zero client storage policies.

The browser/storage staging test uses synthetic PDFs and explicitly injected scanner outcomes. It exercises upload, pending/rejected denial, a scanner outage, authorized byte-exact downloads, separate versions, requirement references, mobile layout, storage tampering and role revocation. This verifies the application contract, not malware detection. Synthetic objects, version records and temporary users are cleaned up.

After hosting approval: provision the private worker, validate the container and fresh signatures, test a valid benign PDF and the standard EICAR test signature against the actual scanner, and verify encrypted/oversized/failed scans remain unavailable. Rehearse the live worker against staging before requesting named production migration 012 and activation approval. Do not enable uploads merely because the simulated scanner tests pass.

Rollback: set `BIDXCHANGE_DOCUMENTS_ENABLED=false` and redeploy to close application upload, links and downloads. Stop the worker if scan integrity is uncertain. Preserve version records, objects, references and restrictive grants; do not drop the migration or expose storage as a rollback shortcut.

'use client';
import { useActionState, useState } from 'react';
import type { TenantData } from '../lib/tenant-types';
import type { MutationState } from '../app/actions';
import { uploadDocument, linkDocument } from '../app/document-actions';

function Reload() {
  return (
    <button type="button" className="button secondary" onClick={() => window.location.reload()}>
      Refresh document records
    </button>
  );
}
export function DocumentLibrary({ data }: { data: TenantData }) {
  const [state, submit, pending] = useActionState(uploadDocument, { message: '' } as MutationState);
  const [documentId, setDocumentId] = useState('');
  const admin = data.organization.role === 'organization_admin';
  return (
    <section className="panel document-library">
      <h2>Private document versions</h2>
      <p>
        Each upload retains a separate version. Only scanned versions can be downloaded or
        referenced. A passed scan does not verify the document’s claims.
      </p>
      {admin && (
        <details>
          <summary>Upload a PDF version</summary>
          <form action={submit} className="admin-form" aria-label="Upload document version">
            <input type="hidden" name="organization_id" value={data.organization.id} />
            <fieldset disabled={pending || state.success}>
              <legend>PDF upload · up to 2 MB</legend>
              <label>
                Document
                <select
                  aria-label="Document"
                  name="document_id"
                  value={documentId}
                  onChange={(e) => setDocumentId(e.target.value)}
                >
                  <option value="">New document</option>
                  {data.documentLibraries?.slice(0, 500).map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </label>
              {documentId ? (
                <input type="hidden" name="title" value="New version" />
              ) : (
                <label>
                  Document title
                  <input aria-label="Document title" name="title" maxLength={200} required />
                </label>
              )}
              <label>
                PDF file
                <input
                  aria-label="PDF file"
                  type="file"
                  name="file"
                  accept="application/pdf,.pdf"
                  required
                />
              </label>
              <p>
                Readable by this workspace’s administrators, executive approvers and estimators.
                Upload only documents intended for those roles. Limits: 50 reservations per day and
                100 MB per workspace, including pending and rejected versions.
              </p>
              <button className="button primary" type="submit">
                {pending ? 'Uploading…' : 'Upload for scanning'}
              </button>
            </fieldset>
            {state.message && <p role="status">{state.message}</p>}
            {state.success && <Reload />}
          </form>
        </details>
      )}
      {((data.documentVersions?.length ?? 0) > 500 ||
        (data.documentLibraries?.length ?? 0) > 500) && (
        <p role="status">
          Showing a partial library. Newest versions are listed first; additional records are not
          displayed.
        </p>
      )}
      {!data.documentVersions?.length && <p>No document versions are available to your role.</p>}
      <ul className="decision-brief-list">
        {data.documentVersions?.slice(0, 500).map((v) => (
          <li key={v.id}>
            <h3>
              {data.documentLibraries?.find((d) => d.id === v.document_id)?.title ?? 'Document'} ·
              version {v.version}
            </h3>
            <p>
              {v.scan_status === 'clean'
                ? 'Scan passed'
                : v.scan_status === 'rejected'
                  ? 'Rejected — unavailable'
                  : 'Awaiting scan — unavailable'}{' '}
              · {v.byte_size} bytes · uploaded {v.created_at}
            </p>
            <details>
              <summary>Version fingerprint</summary>
              <code>{v.sha256}</code>
            </details>
            {v.scan_status === 'clean' && (
              <a
                className="button secondary"
                href={`/api/documents/${v.id}?organization=${data.organization.id}`}
              >
                Download version {v.version}
              </a>
            )}
          </li>
        ))}
      </ul>
      <Reload />
    </section>
  );
}

export function RequirementDocuments({
  data,
  requirement,
}: {
  data: TenantData;
  requirement: NonNullable<TenantData['requirements']>[number];
}) {
  const [original] = useState(requirement);
  const [source, setSource] = useState(''),
    [reference, setReference] = useState('');
  const [state, submit, pending] = useActionState(linkDocument, { message: '' } as MutationState);
  const versions = data.documentVersions ?? [];
  const links = data.documentLinks?.filter((l) => l.requirement_id === requirement.id) ?? [];
  const admin = data.organization.role === 'organization_admin';
  const reader = ['organization_admin', 'executive_approver', 'estimator'].includes(
    data.organization.role,
  );
  if (!reader) return null;
  return (
    <details className="company-record-editor">
      <summary>Document source references</summary>
      <p>
        References pin a retained version, not whichever version was uploaded most recently. Adding
        one prompts a fresh requirement review.
      </p>
      {(data.documentLinks?.length ?? 0) > 500 && (
        <p>Only part of this pursuit’s source references is loaded.</p>
      )}
      {links.map((link) => (
        <p key={link.id}>
          {link.source_reference} ·{' '}
          <a
            href={`/api/documents/${link.document_version_id}?organization=${data.organization.id}`}
          >
            Download cited version
          </a>
        </p>
      ))}
      {!links.length && <p>No version references are visible for this requirement.</p>}
      {admin && (
        <form action={submit} className="admin-form" aria-label="Link document version">
          <input type="hidden" name="organization_id" value={data.organization.id} />
          <input type="hidden" name="requirement_id" value={original.id} />
          <input type="hidden" name="updated_at" value={original.updated_at} />
          <fieldset disabled={pending || state.success}>
            <legend>Reference a scanned version</legend>
            <label>
              Scanned document version
              <select
                aria-label="Scanned document version"
                name="document_version_id"
                required
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Choose a version</option>
                {versions
                  .filter((v) => v.scan_status === 'clean')
                  .slice(0, 500)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {data.documentLibraries?.find((d) => d.id === v.document_id)?.title ??
                        'Document'}{' '}
                      · v{v.version} · {v.id.slice(0, 8)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Page, section and relevance
              <textarea
                aria-label="Page, section and relevance"
                name="source_reference"
                maxLength={2000}
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </label>
            <button className="button primary" type="submit">
              {pending ? 'Saving…' : 'Save version reference'}
            </button>
          </fieldset>
          {state.message && <p role="status">{state.message}</p>}
          {state.success && <Reload />}
        </form>
      )}
    </details>
  );
}

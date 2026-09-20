import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { expect } from '@playwright/test';
import { scanPending } from '../documents/worker.mjs';

export async function documentChecks({
  db,
  admin,
  client,
  context,
  org,
  user,
  label,
  requirement,
  pursuit,
  base,
}) {
  const page = await context.newPage();
  const bytes = Buffer.from('%PDF-1.7\nSynthetic document fixture only.\n%%EOF');
  const docs = `${base}/documents?organization=${org}`;
  await page.goto(docs);
  await page.getByText('Upload a PDF version', { exact: true }).click();
  const form = page.getByRole('form', { name: 'Upload document version' });
  await form.getByLabel('Document title', { exact: true }).fill(label);
  await form
    .getByLabel('PDF file', { exact: true })
    .setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: bytes });
  await form.getByRole('button', { name: 'Upload for scanning' }).click();
  await expect(form.getByRole('status')).toContainText('awaiting scanning');
  const library = (await client.from('document_libraries').select('id').eq('title', label).single())
    .data.id;
  const first = (
    await client.from('document_versions').select('*').eq('document_id', library).single()
  ).data;
  const download = `${base}/api/documents/${first.id}?organization=${org}`;
  assert.equal((await context.request.get(download)).status(), 404);
  assert((await client.storage.from('company-private').download(`${org}/${first.id}.pdf`)).error);
  assert(
    (
      await client.rpc('finish_document_scan', {
        target: first.id,
        expected_hash: first.sha256,
        verdict: 'clean',
        engine: 'Forged',
      })
    ).error,
  );
  // Injected scanner is confined to this staging test; proves workflow, not real malware detection.
  await scanPending(
    admin,
    async () => {
      throw new Error('Synthetic scanner outage');
    },
    org,
  );
  assert.equal((await context.request.get(download)).status(), 404);
  await scanPending(
    admin,
    async () => ({
      verdict: 'clean',
      engine: 'Synthetic test scanner — not production validation',
    }),
    org,
  );
  const response = await context.request.get(download);
  assert.equal(response.status(), 200);
  assert.match(response.headers()['cache-control'], /private/);
  assert.match(response.headers()['cache-control'], /no-store/);
  assert.match(response.headers()['content-disposition'], /^attachment;/);
  assert.equal(
    createHash('sha256')
      .update(await response.body())
      .digest('hex'),
    first.sha256,
  );
  await page.reload();
  await page.getByText('Upload a PDF version', { exact: true }).click();
  await form.getByLabel('Document', { exact: true }).selectOption(library);
  await form.getByLabel('PDF file', { exact: true }).setInputFiles({
    name: 'synthetic-v2.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.7\nSecond synthetic version.\n%%EOF'),
  });
  await form.getByRole('button', { name: 'Upload for scanning' }).click();
  await expect(form.getByRole('status')).toContainText('awaiting scanning');
  const versions = (
    await client.from('document_versions').select('*').eq('document_id', library).order('version')
  ).data;
  assert.deepEqual(
    versions.map((v) => v.version),
    [1, 2],
  );
  assert.equal(versions[0].sha256, first.sha256);
  assert.equal((await context.request.get(download)).status(), 200);
  await scanPending(
    admin,
    async () => ({
      verdict: 'rejected',
      engine: 'Synthetic rejection scanner',
    }),
    org,
  );
  assert.equal(
    (
      await context.request.get(`${base}/api/documents/${versions[1].id}?organization=${org}`)
    ).status(),
    404,
  );
  await page.goto(`${base}/pursuits/${pursuit}?organization=${org}`);
  const card = page.locator(`#requirement-${requirement}`);
  await card.getByText('Document source references', { exact: true }).click();
  const link = card.getByRole('form', { name: 'Link document version' });
  await link.getByLabel('Scanned document version', { exact: true }).selectOption(first.id);
  await link
    .getByLabel('Page, section and relevance', { exact: true })
    .fill('Synthetic page 1, license scope');
  const versionBefore = (
    await client.from('pursuit_requirements').select('updated_at').eq('id', requirement).single()
  ).data.updated_at;
  await link.getByRole('button', { name: 'Save version reference' }).click();
  await expect(link.getByRole('status')).toContainText('Version reference saved');
  assert.notEqual(
    (await client.from('pursuit_requirements').select('updated_at').eq('id', requirement).single())
      .data.updated_at,
    versionBefore,
  );
  await page.reload();
  await card.getByText('Document source references', { exact: true }).click();
  await expect(card.getByRole('link', { name: 'Download cited version' })).toHaveAttribute(
    'href',
    `/api/documents/${first.id}?organization=${org}`,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.goto(docs);
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const tamper = await admin.storage
    .from('company-private')
    .upload(`${org}/${first.id}.pdf`, Buffer.from('%PDF-1.7\nTampered fixture\n%%EOF'), {
      contentType: 'application/pdf',
      upsert: true,
    });
  assert(!tamper.error);
  assert.equal((await context.request.get(download)).status(), 404);
  const restored = await admin.storage
    .from('company-private')
    .upload(`${org}/${first.id}.pdf`, bytes, { contentType: 'application/pdf', upsert: true });
  assert(!restored.error);
  await db.query(
    "update public.organization_memberships set role='viewer' where organization_id=$1 and user_id=$2",
    [org, user],
  );
  assert.equal((await context.request.get(download)).status(), 404);
  await page.reload();
  await expect(page.getByText('Upload a PDF version', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: `${label} · version 1` })).toHaveCount(0);
  console.log(
    'PASS staging upload, pending/rejected denial, immutable versions, cited-version linkage, byte integrity, private downloads, mobile and role revocation (scanner verdicts simulated).',
  );
}

export async function cleanupDocumentChecks(db, admin, org, label) {
  const docs = (
    await db.query(
      'select id from public.document_libraries where organization_id=$1 and title=$2',
      [org, label],
    )
  ).rows;
  for (const doc of docs) {
    const versions = (
      await db.query(
        'select id from public.document_versions where organization_id=$1 and document_id=$2',
        [org, doc.id],
      )
    ).rows;
    if (versions.length) {
      const removed = await admin.storage
        .from('company-private')
        .remove(versions.map((v) => `${org}/${v.id}.pdf`));
      if (removed.error) throw new Error('Synthetic document cleanup failed');
      await db.query(
        'delete from public.requirement_document_links where organization_id=$1 and document_version_id=any($2::uuid[])',
        [org, versions.map((v) => v.id)],
      );
    }
    await db.query(
      'delete from public.document_versions where organization_id=$1 and document_id=$2',
      [org, doc.id],
    );
    await db.query('delete from public.document_libraries where organization_id=$1 and id=$2', [
      org,
      doc.id,
    ]);
  }
}

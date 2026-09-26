import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { handoffFixture } from './fixtures/handoff-data';
import { handoffDocument } from '../apps/web/lib/handoff-document';
import { releaseHandoff, EXTERNAL_COMPLETION } from '../apps/web/lib/submission-handoff';
import { renderResponsePdf } from '../apps/web/lib/response-render';

test('handoff requires exact external confirmation and every current human approval', () => {
  const v = handoffFixture();
  const check = () => releaseHandoff(v.snapshot.checklist, v.checksum, v.status);
  expect(check().ready).toBe(true);
  for (const gate of ['pricing', 'compliance', 'final', 'submission']) {
    v.status!.approvals[gate] = false;
    expect(check().ready).toBe(false);
    expect(check().gaps.join(' ')).toContain('no longer current');
    v.status!.approvals[gate] = true;
  }
  v.snapshot.checklist.pricing.reference = `Not confirmed: ${EXTERNAL_COMPLETION}`;
  expect(check().externalComplete).toBe(false);
  v.snapshot.checklist.pricing.reference = EXTERNAL_COMPLETION;
  v.status!.current = false;
  expect(check().ready).toBe(false);
  v.status!.current = true;
  v.status!.checksum = 'c'.repeat(64);
  expect(check().ready).toBe(false);
  v.status!.checksum = v.checksum;
  v.status!.blockers = ['Expired insurance'];
  expect(check().gaps).toContain('Expired insurance');
  v.status = undefined;
  expect(check().ready).toBe(false);
});

test('PDF preserves unresolved work, source text, manifest and human receipt limitations without raw response data', async () => {
  const v = handoffFixture();
  v.status!.approvals.submission = false;
  v.status!.current = false;
  v.status!.blockers = ['Insurance expired; review the latest amendment.'];
  const submissions = [
    {
      submitted_by: v.created_by,
      recorded_by: v.created_by,
      submitted_at: '2026-09-25T10:00:00Z',
      recorded_at: '2026-09-25T11:00:00Z',
      details: {
        confirmation: 'SAMPLE-RECEIPT',
        receipt_limitation: 'User-entered; buyer receipt not checked.',
      },
    },
  ];
  const document = handoffDocument(v, v.status, [], submissions);
  const assets = {
    regular: readFileSync('apps/web/public/fonts/NotoSans-Regular.ttf'),
    bold: readFileSync('apps/web/public/fonts/NotoSans-Bold.ttf'),
    logo: readFileSync('apps/web/public/brand/bidxchange-logo.png'),
  };
  const bytes = await renderResponsePdf(document, assets, 'handoff');
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false });
  const pdf = await task.promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    text += (await page.getTextContent()).items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
  }
  for (const phrase of [
    'NOT READY FOR HANDOFF',
    'Insurance expired',
    'Submission authorization',
    'America/Los_Angeles',
    'Addendum 2',
    'response.pdf',
    'SAMPLE-RECEIPT',
    'does not verify buyer receipt',
    'Bring proof of active DIR registration.',
  ])
    expect(text).toContain(phrase);
  expect(text).not.toContain('DO NOT INCLUDE RAW RESPONSE');
  expect(text).not.toContain('RFI RESPONSE');
  expect(text).toContain(v.checksum);
  mkdirSync('.tmp/handoff-artifacts', { recursive: true });
  writeFileSync('.tmp/handoff-artifacts/handoff.pdf', bytes);
  const factory = pdf.canvasFactory as {
    create: (
      w: number,
      h: number,
    ) => { canvas: { toBuffer: (type: string) => Buffer }; context: CanvasRenderingContext2D };
  };
  for (const i of [1, 2]) {
    const page = await pdf.getPage(i),
      viewport = page.getViewport({ scale: 1.25 }),
      canvas = factory.create(viewport.width, viewport.height);
    await page.render({ canvas: null, canvasContext: canvas.context, viewport }).promise;
    writeFileSync(`.tmp/handoff-artifacts/page-${i}.png`, canvas.canvas.toBuffer('image/png'));
  }
  await task.destroy();
  expect(() =>
    handoffDocument(
      {
        ...v,
        snapshot: { ...v.snapshot, requirements: Array(101).fill(v.snapshot.requirements[0]) },
      },
      v.status,
      [],
      [],
    ),
  ).toThrow();
  await expect(
    renderResponsePdf({ ...document, title: 'Unsupported \u{1F600}' }, assets, 'handoff'),
  ).rejects.toThrow('JSON');
});

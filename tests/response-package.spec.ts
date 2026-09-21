import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import JSZip from 'jszip';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  responseDocument,
  responseDraftSchema,
  readResponseDraft,
  type SavedResponsePackage,
} from '../apps/web/lib/response-package';
import { renderResponsePdf, renderResponseDocx } from '../apps/web/lib/response-render';
import type { TenantData, Fact } from '../apps/web/lib/tenant-types';
const id = '11111111-1111-4111-8111-111111111111';
const stamp = '2026-09-20T00:00:00+00:00';
const now = new Date('2026-09-21T00:00:00Z');
function fixture() {
  const fact = (id: string, sensitivity: string, value: string): Fact => ({
    id,
    sensitivity,
    value,
    label: 'Relevant capability',
    fact_type: 'capability',
    verification_status: 'verified',
    source_reference: 'Approved capability statement, section 2',
    source_note: null,
    verified_by: 'reviewer',
    verified_at: stamp,
    expiration_date: '2027-12-31',
    updated_at: stamp,
  });
  const data = {
    organization: {
      id: 'org',
      legal_name: 'Synthetic Services, Inc.',
      operating_name: 'Synthetic Services',
      role: 'organization_admin',
    },
    reviewAsOf: now.toISOString(),
    decisionContext: 'current',
    evidenceReviewsEnabled: true,
    resolutionsEnabled: true,
    pursuits: [{ id: 'p', title: 'Facilities support information request', opportunity_id: 'o' }],
    opportunities: [
      {
        id: 'o',
        buyer: 'Synthetic Procurement Office',
        solicitation_number: 'SYN-RFI-001',
        source_note: 'Notice v1, section 3',
      },
    ],
    requirements: [
      {
        id,
        pursuit_id: 'p',
        requirement: 'Describe your facilities support capability.',
        citation: 'Notice v1, p. 3, question 1',
        owner_user_id: 'owner',
        updated_at: stamp,
        status: 'needs_review',
      },
    ],
    facts: [
      fact('public', 'workspace', 'Documented public capability'),
      fact('private', 'restricted', 'RESTRICTED MUST NOT EXPORT'),
    ],
    evidenceReviews: ['public', 'private'].map((fact_id) => ({
      id: `review-${fact_id}`,
      fact_id,
      requirement_id: id,
      applicability: 'applicable',
      proposal_use: 'approved',
      approval_current: true,
      reviewed_by: 'reviewer',
      reviewed_at: stamp,
    })),
    tasks: [],
  } as unknown as TenantData;
  const saved: SavedResponsePackage = {
    id: 'package',
    title: 'RFI response: Initial response',
    updated_at: stamp,
    status: 'draft',
    content: JSON.stringify({
      schema: 1,
      context: 'current',
      summary: 'Prepared for internal review. No bid or submission is authorized.',
      answers: [
        {
          requirementId: id,
          requirementVersion: stamp,
          text: 'Our response addresses the requested capability. Confirm scope with the reviewer.',
        },
      ],
    }),
  };
  return { data, saved };
}
test('response package copies only current approved workspace evidence and retains exact citations', () => {
  const { data, saved } = fixture();
  const text = JSON.stringify(responseDocument(data, 'p', saved, now));
  expect(text).toContain('Documented public capability');
  expect(text).not.toContain('RESTRICTED MUST NOT EXPORT');
  expect(text).toContain('Notice v1, p. 3, question 1');
  expect(text).toContain('review-public');
  data.facts[0].fact_type = 'insurance';
  expect(JSON.stringify(responseDocument(data, 'p', saved, now))).not.toContain(
    'Documented public capability',
  );
  data.facts[0].fact_type = 'capability';
  data.facts[0].expiration_date = '2026-09-20';
  expect(JSON.stringify(responseDocument(data, 'p', saved, now))).not.toContain(
    'Documented public capability',
  );
  data.facts[0].expiration_date = '2027-12-31';
  data.evidenceReviews![0].approval_current = false;
  expect(JSON.stringify(responseDocument(data, 'p', saved, now))).not.toContain(
    'Documented public capability',
  );
});
test('stale sources, missing answers, malformed packages and partial registers cannot imply readiness', () => {
  const { data, saved } = fixture();
  data.decisionContext = 'changed';
  data.requirements![0].updated_at = '2026-09-21T00:00:00+00:00';
  const text = JSON.stringify(responseDocument(data, 'p', saved, now));
  expect(text).toContain('source version changed');
  expect(text).toContain('review context changed');
  expect(readResponseDraft('{bad')).toBeNull();
  const draft = JSON.parse(saved.content!);
  draft.answers.push(draft.answers[0]);
  expect(responseDraftSchema.safeParse(draft).success).toBe(false);
  expect(() => responseDocument(data, 'p', { ...saved, status: 'approved' }, now)).toThrow();
  data.requirements = Array.from({ length: 101 }, (_, i) => ({
    ...data.requirements![0],
    id: String(i),
  }));
  expect(() => responseDocument(data, 'p', saved, now)).toThrow('limits');
});
test('PDF and Word preserve long answers, pagination, Unicode and draft markings', async () => {
  const { data, saved } = fixture();
  const draft = JSON.parse(saved.content!);
  draft.answers[0].text = 'Résumé — capability & availability. '.repeat(70) + 'END-OF-RESPONSE';
  saved.content = JSON.stringify(draft);
  const document = responseDocument(data, 'p', saved, now);
  const assets = {
    regular: readFileSync('apps/web/public/fonts/NotoSans-Regular.ttf'),
    bold: readFileSync('apps/web/public/fonts/NotoSans-Bold.ttf'),
    logo: readFileSync('apps/web/public/brand/bidxchange-logo.png'),
  };
  const pdf = await renderResponsePdf(document, assets);
  const loading = getDocument({ data: pdf.slice(), useSystemFonts: false });
  const parsed = await loading.promise;
  expect(parsed.numPages).toBeGreaterThanOrEqual(3);
  let text = '';
  for (let i = 1; i <= parsed.numPages; i++) {
    const page = await parsed.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
    expect(pageText).toContain('DRAFT');
    text += pageText;
    for (const item of content.items) {
      if ('str' in item && item.str) {
        expect(item.transform[4]).toBeGreaterThanOrEqual(47);
        expect(item.transform[5]).toBeGreaterThanOrEqual(29);
        expect(item.transform[5]).toBeLessThanOrEqual(754);
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(565);
      }
    }
  }
  expect(text).toContain('END-OF-RESPONSE');
  expect(text).toContain('Résumé');
  expect(text).not.toContain('RESTRICTED');
  const docx = await renderResponseDocx(document, assets.logo);
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file('word/document.xml')!.async('string');
  expect(xml).toContain('END-OF-RESPONSE');
  expect(xml).toContain('Résumé');
  expect(xml).toContain('&amp;');
  expect(xml).not.toContain('RESTRICTED');
  expect(await zip.file('word/footer1.xml')!.async('string')).toContain(
    'NOT APPROVED FOR SUBMISSION',
  );
  mkdirSync('.tmp/response-artifacts', { recursive: true });
  writeFileSync('.tmp/response-artifacts/rfi-draft.pdf', pdf);
  writeFileSync('.tmp/response-artifacts/rfi-draft.docx', docx);
  // Render a real PDF page for visual inspection using PDF.js's Node canvas factory.
  const factory = parsed.canvasFactory as {
    create: (
      width: number,
      height: number,
    ) => { canvas: { toBuffer: (type: string) => Buffer }; context: CanvasRenderingContext2D };
  };
  for (const number of [1, 2]) {
    const page = await parsed.getPage(number);
    const viewport = page.getViewport({ scale: 1.3 });
    const canvas = factory.create(viewport.width, viewport.height);
    await page.render({ canvas: null, canvasContext: canvas.context, viewport }).promise;
    writeFileSync(
      `.tmp/response-artifacts/page-${number}.png`,
      canvas.canvas.toBuffer('image/png'),
    );
  }
  await loading.destroy();
  await expect(
    renderResponsePdf({ ...document, title: 'Unsupported glyph 😀' }, assets),
  ).rejects.toThrow('Word');
  await expect(
    renderResponseDocx({ ...document, title: 'Invalid \u0000 text' }, assets.logo),
  ).rejects.toThrow('control characters');
});

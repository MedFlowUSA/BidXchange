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
import { responseCommand, prepareResponseDraft } from '../apps/web/lib/response-command';
import { responseAutofill } from '../apps/web/lib/response-autofill';
import { hasResponsePlaceholder, responseProgress } from '../apps/web/lib/response-progress';
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
test('document commands require explicit intent and prepare typed drafts without claims or prices', async () => {
  for (const [prompt, kind] of [
    ['create an rfp for this bid', 'RFP'],
    ['Please draft an RFI response', 'RFI'],
    ['Can you prepare an RFQ for the selected pursuit?', 'RFQ'],
  ])
    expect(responseCommand(prompt)).toBe(kind);
  for (const prompt of [
    'Do not create an RFP',
    'Explain how to create an RFP',
    'The notice says "create an RFP"',
    'create an RFP and submit it',
    'create an RFP for another bid',
    'What is an RFP?',
  ])
    expect(responseCommand(prompt)).toBeNull();
  const { data, saved } = fixture();
  expect(readResponseDraft(saved.content)?.kind).toBe('RFI');
  for (const kind of ['RFP', 'RFQ'] as const) {
    const draft = prepareResponseDraft(data, 'p', kind);
    expect(draft.kind).toBe(kind);
    expect(draft.answers[0].text).toBe('');
    expect(JSON.stringify(draft)).not.toContain('RESTRICTED MUST NOT EXPORT');
    expect(JSON.stringify(draft)).not.toContain('Documented public capability');
    const document = responseDocument(
      data,
      'p',
      { ...saved, title: `${kind} response: Test`, content: JSON.stringify(draft) },
      now,
    );
    expect(document.kind).toBe(kind);
    expect(document.title).toContain(`${kind} response`);
    expect(JSON.stringify(document)).toContain('missing');
    const bytes = await renderResponseDocx(
      document,
      readFileSync('apps/web/public/brand/bidxchange-logo.png'),
    );
    const zip = await JSZip.loadAsync(bytes);
    expect(await zip.file('word/header1.xml')!.async('string')).toContain(`${kind} RESPONSE`);
  }
  expect(() => prepareResponseDraft(data, 'other', 'RFP')).toThrow();
});
test('draft review distinguishes written answers, placeholders, changed requirements and missing scope', () => {
  const { data, saved } = fixture();
  const draft = readResponseDraft(saved.content)!;
  expect(responseProgress(draft, data, 'p').current).toBe(1);
  expect(hasResponsePlaceholder('See reference [1] for the approach.')).toBe(false);
  draft.summary = '[Complete technical approach]';
  draft.answers[0].text = 'TBD';
  let review = responseProgress(draft, data, 'p');
  expect(review.current).toBe(0);
  expect(review.overviewPlaceholder).toBe(true);
  expect(review.rows[0].placeholder).toBe(true);
  saved.content = JSON.stringify(draft);
  const doc = responseDocument(data, 'p', saved, now);
  expect(doc.reviewIssues).toContain('Response overview contains unfinished placeholders.');
  expect(doc.reviewIssues).toContain('Requirement 1: answer contains unfinished placeholders.');
  expect(doc.blocks.some((b) => b.text.includes('answer contains unfinished placeholders'))).toBe(
    true,
  );
  draft.answers[0].text = 'A written answer';
  data.requirements![0].updated_at = '2026-09-21T00:00:00+00:00';
  review = responseProgress(draft, data, 'p');
  expect(review.current).toBe(0);
  expect(review.rows[0].changed).toBe(true);
  draft.answers = [];
  expect(responseProgress(draft, data, 'p').rows[0].missing).toBe(true);
  expect(responseProgress(draft, data, 'another-pursuit').rows).toEqual([]);
  expect(responseProgress(readResponseDraft(saved.content)!, data, 'another-pursuit').removed).toBe(
    1,
  );
});
test('all response types autofill current company contacts, registrations and bid details without stale or restricted data', () => {
  const { data, saved } = fixture();
  data.organization.website = 'https://example.invalid';
  data.opportunities[0].summary = 'Maintain three public facilities';
  data.opportunities[0].official_deadline = '2026-10-01T20:00:00Z';
  data.opportunities[0].deadline_timezone = 'America/Los_Angeles';
  const fields = [
    ['identity', 'Mailing address', '100 Synthetic Street'],
    ['identity', 'Business phone', '555-0100'],
    ['identity', 'Business email', 'bids@example.invalid'],
    ['identity', 'Primary contact', 'Synthetic Contact'],
    ['registration', 'UEI', 'SYNTHETICUEI'],
    ['registration', 'CAGE', 'TEST1'],
  ];
  for (const [fact_type, label, value] of fields)
    data.facts.push({ ...data.facts[0], id: label, fact_type, label, value });
  data.facts.push({
    ...data.facts[0],
    id: 'expired',
    fact_type: 'identity',
    label: 'Old email',
    value: 'OLD-EMAIL-MUST-NOT-EXPORT',
    expiration_date: '2026-09-01',
  });
  data.facts.push({
    ...data.facts[0],
    id: 'pending',
    fact_type: 'registration',
    value: 'PENDING-MUST-NOT-EXPORT',
    verification_status: 'pending_verification',
  });
  data.facts.push({
    ...data.facts[0],
    id: 'future',
    fact_type: 'identity',
    value: 'FUTURE-MUST-NOT-EXPORT',
    verified_at: '2027-01-01T00:00:00Z',
  });
  for (const kind of ['RFI', 'RFP', 'RFQ']) {
    saved.content = JSON.stringify({ ...JSON.parse(saved.content!), kind });
    const text = JSON.stringify(responseDocument(data, 'p', saved, now));
    for (const [, , value] of fields) expect(text).toContain(value);
    expect(text).toContain('Maintain three public facilities');
    expect(text).toContain('America/Los_Angeles');
    expect(text).toContain('https://example.invalid');
    expect(text).not.toContain('MUST-NOT-EXPORT');
    expect(text).not.toContain('RESTRICTED MUST NOT EXPORT');
  }
  expect(responseAutofill(data, 'p', now).gaps.join(' ')).not.toContain('Business email:');
  data.facts.find((f) => f.label === 'Business email')!.value = 'updated@example.invalid';
  const fresh = JSON.stringify(responseDocument(data, 'p', saved, now));
  expect(fresh).toContain('updated@example.invalid');
  expect(fresh).not.toContain('bids@example.invalid');
  data.facts.find((f) => f.label === 'Business email')!.sensitivity = 'restricted';
  expect(JSON.stringify(responseDocument(data, 'p', saved, now))).not.toContain(
    'updated@example.invalid',
  );
  expect(responseAutofill(data, 'p', now).gaps.join(' ')).toContain('Business email:');
  data.facts = Array.from({ length: 500 }, () => data.facts[0]);
  expect(() => responseAutofill(data, 'p', now)).toThrow('incomplete');
});
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
  data.facts.push({
    ...data.facts[0],
    id: 'contact-email',
    fact_type: 'identity',
    label: 'Business email',
    value: 'response@example.invalid',
  });
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
  expect(text).toContain('response@example.invalid');
  expect(text).toContain('Résumé');
  expect(text).not.toContain('RESTRICTED');
  const docx = await renderResponseDocx(document, assets.logo);
  const zip = await JSZip.loadAsync(docx);
  const xml = await zip.file('word/document.xml')!.async('string');
  expect(xml).toContain('END-OF-RESPONSE');
  expect(xml).toContain('response@example.invalid');
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

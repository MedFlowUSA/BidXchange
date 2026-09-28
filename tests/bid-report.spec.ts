import { test, expect } from '@playwright/test';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { bidReport } from '../apps/web/lib/bid-report';
import { renderResponsePdf } from '../apps/web/lib/response-render';
import { qualificationData } from './fixtures/qualification-data';
import { pursuit } from './fixtures/workflow-data';
import { normalizedDetails } from '../apps/web/lib/sources/normalized';
const now = new Date('2026-09-28T19:00:00Z');
const selection = (data: ReturnType<typeof qualificationData>) => ({
  packageId: data.responsePackages![0].id,
  version: data.responsePackages![0].updated_at,
});
const body = (document: ReturnType<typeof bidReport>) =>
  document.blocks.map((b) => b.text).join('\n');

test('automatic report picks the newest supported saved draft and leaves missing answers explicit', () => {
  const data = qualificationData(),
    original = data.responsePackages![0];
  const newer = {
    ...original,
    id: 'newer',
    title: 'BID response: New answer',
    updated_at: '2026-09-28T18:00:00Z',
  };
  data.responsePackages = [original, { ...newer, id: 'unsupported', content: '{}' }, newer];
  const report = bidReport(data, pursuit, { latestDraft: true }, now);
  expect(report.version).toContain('answer draft newer');
  expect(body(report)).toContain('Automatically selected newest supported');
  expect(() => bidReport(data, pursuit, { latestDraft: true, ...selection(data) }, now)).toThrow(
    'not both',
  );
  data.responsePackages = [];
  expect(body(bidReport(data, pursuit, { latestDraft: true }, now))).toContain(
    'No supported saved answer draft',
  );
  data.responsePackages = Array(21).fill({ ...original, content: '{}' });
  expect(() => bidReport(data, pursuit, { latestDraft: true }, now)).toThrow('latest records');
});
test('report preserves saved answers, human findings, missing answers and user-provided company facts distinctly', () => {
  const data = qualificationData();
  data.tasks = [{ id: 'done', pursuit_id: pursuit, title: 'Completed task', status: 'complete' }];
  data.facts[0].verification_status = 'pending_verification';
  data.facts[0].verified_at = null;
  data.facts[0].verified_by = null;
  data.facts[0].expiration_date = null;
  const draft = JSON.parse(data.responsePackages![0].content!);
  draft.answers[1].text = '';
  data.responsePackages![0].content = JSON.stringify(draft);
  const text = body(bidReport(data, pursuit, selection(data), now));
  for (const phrase of [
    'pending verification',
    'Synthetic classification',
    'Synthetic answer',
    '[HUMAN INPUT REQUIRED: no saved answer]',
    'Human finding: Supported by reviewed evidence',
    'No bid/no-bid decision history',
    'not independently verified',
    'Other requirements needing an answer or answer review: 1',
    'Open tasks: 0',
  ])
    expect(text).toContain(phrase);
  expect(text).not.toContain('verified eligible');
  const empty = qualificationData();
  empty.requirements = [];
  empty.responsePackages = [];
  expect(body(bidReport(empty, pursuit, {}, now))).toContain('No requirements are recorded');
  expect(body(bidReport(empty, pursuit, {}, now))).toContain('No answer draft selected');
});
test('stale answers and placeholder answers are not counted as current answered requirements', () => {
  const data = qualificationData();
  data.decisionContext = 'amended';
  data.resolutions![0].review_current = false;
  const draft = JSON.parse(data.responsePackages![0].content!);
  draft.answers[1].text = '[HUMAN INPUT REQUIRED]';
  data.responsePackages![0].content = JSON.stringify(draft);
  const text = body(bidReport(data, pursuit, selection(data), now));
  for (const phrase of [
    'matching the current source context: 0',
    'REVIEW AGAIN',
    'INCOMPLETE ANSWER',
    'Finding current: No',
    'expired',
  ])
    expect(text).toContain(phrase);
  expect(() => bidReport(data, pursuit, { ...selection(data), version: 'wrong' }, now)).toThrow(
    'changed',
  );
  expect(() => bidReport(data, 'foreign', {}, now)).toThrow('unavailable');
});
test('restricted records require opt-in and role; unknown and other-bid records never leak', () => {
  for (const role of [
    'viewer',
    'capture_manager',
    'estimator',
    'executive_approver',
    'organization_admin',
  ]) {
    const data = qualificationData(role),
      base = data.facts[0];
    data.facts.push(
      {
        ...base,
        id: 'restricted',
        fact_type: 'insurance',
        sensitivity: 'restricted',
        value: 'CONFIDENTIAL INSURANCE',
      },
      {
        ...base,
        id: 'financial',
        fact_type: 'financial',
        sensitivity: 'restricted',
        value: 'CONFIDENTIAL FINANCIAL',
      },
      { ...base, id: 'unknown', sensitivity: 'unknown', value: 'UNCLASSIFIED SECRET' },
    );
    data.requirements!.push({
      ...data.requirements![0],
      id: 'foreign-req',
      pursuit_id: 'foreign',
      requirement: 'OTHER BID SECRET',
    });
    data.tasks.push({
      id: 'foreign-task',
      pursuit_id: 'foreign',
      title: 'OTHER TASK SECRET',
      status: 'open',
    });
    const normal = body(bidReport(data, pursuit, {}, now));
    for (const secret of [
      'CONFIDENTIAL INSURANCE',
      'CONFIDENTIAL FINANCIAL',
      'UNCLASSIFIED SECRET',
      'OTHER BID SECRET',
      'OTHER TASK SECRET',
    ])
      expect(normal).not.toContain(secret);
    if (['viewer', 'capture_manager'].includes(role))
      expect(() => bidReport(data, pursuit, { restricted: true }, now)).toThrow('role');
    else {
      const full = body(bidReport(data, pursuit, { restricted: true }, now));
      expect(full).toContain('CONFIDENTIAL INSURANCE');
      expect(full).not.toContain('UNCLASSIFIED SECRET');
      expect(full.includes('CONFIDENTIAL FINANCIAL')).toBe(role === 'organization_admin');
    }
  }
});
test('potentially truncated data is refused rather than labeled a complete report', () => {
  for (const kind of ['facts', 'requirements', 'tasks', 'amendments', 'release'] as const) {
    const data = qualificationData();
    if (kind === 'facts') data.facts = Array(500).fill(data.facts[0]);
    if (kind === 'requirements') data.requirements = Array(101).fill(data.requirements![0]);
    if (kind === 'tasks')
      data.tasks = Array(500).fill({
        id: 'task',
        pursuit_id: pursuit,
        title: 'Task',
        status: 'open',
      });
    if (kind === 'amendments') data.amendments = Array(100).fill({});
    if (kind === 'release') data.releaseWorkflow!.partial = true;
    expect(() => bidReport(data, pursuit, {}, now)).toThrow('incomplete source set');
  }
});
test('bid report PDF contains readable company, answers, tasks and status disclaimers across pages', async () => {
  const data = qualificationData();
  data.companyProfile = {
    id: 'profile',
    summary: 'Fictional energy-efficiency contractor.',
    updated_at: '2026-09-28T00:00:00Z',
  };
  data.opportunities[0].source_details = normalizedDetails.parse({
    schema: 1,
    sourceId: 'sam.gov',
    submissionUrl: 'https://example.invalid/submit',
    connectionMode: 'manual',
    lastSynchronizedAt: null,
    dataConfidence: null,
    siteVisit: '2026-10-01T17:00:00Z',
    questionDeadline: '2026-09-30T17:00:00Z',
    submissionMethod: 'Upload the signed buyer form',
    bonding: 'Five percent bid bond',
  });
  data.tasks = [
    {
      id: 't',
      pursuit_id: pursuit,
      title: 'Attend mandatory job walk',
      status: 'open',
      due_at: '2026-10-01T17:00:00Z',
      due_timezone: 'America/Los_Angeles',
    },
  ];
  data.amendments = [
    {
      id: 'a',
      label: 'Addendum 1',
      issued_on: '2026-09-27',
      summary: 'Job walk date changed',
      source_url: 'https://example.invalid/addendum',
      reviewed: false,
      reviewed_by: null,
      reviewed_at: null,
      updated_at: '2026-09-27T00:00:00Z',
    },
  ];
  const document = bidReport(data, pursuit, selection(data), now);
  const assets = {
    regular: readFileSync('apps/web/public/fonts/NotoSans-Regular.ttf'),
    bold: readFileSync('apps/web/public/fonts/NotoSans-Bold.ttf'),
    logo: readFileSync('apps/web/public/brand/bidxchange-logo.png'),
  };
  const bytes = await renderResponsePdf(document, assets, 'report');
  const task = getDocument({ data: bytes.slice(), useSystemFonts: false }),
    pdf = await task.promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    text += (await page.getTextContent()).items.map((x) => ('str' in x ? x.str : '')).join(' ');
  }
  for (const phrase of [
    'BID REPORT',
    'CONFIDENTIAL',
    'Synthetic classification',
    'Synthetic answer',
    'Attend mandatory job walk',
    'Addendum 1',
    'expired',
    'Fictional energy-efficiency contractor',
    'Five percent bid bond',
    'Upload the signed buyer form',
    'Questions due:',
    'Site visit / job walk:',
    'not independently verified',
  ])
    expect(text).toContain(phrase);
  expect(text).not.toContain('RFI RESPONSE');
  expect(pdf.numPages).toBeGreaterThan(2);
  mkdirSync('.tmp/bid-report-artifacts', { recursive: true });
  writeFileSync('.tmp/bid-report-artifacts/report.pdf', bytes);
  const factory = pdf.canvasFactory as {
    create(
      w: number,
      h: number,
    ): { canvas: { toBuffer(type: string): Buffer }; context: CanvasRenderingContext2D };
  };
  for (const i of [1, 2, 3, pdf.numPages]) {
    const page = await pdf.getPage(i),
      viewport = page.getViewport({ scale: 1.25 }),
      canvas = factory.create(viewport.width, viewport.height);
    await page.render({ canvas: null, canvasContext: canvas.context, viewport }).promise;
    writeFileSync(`.tmp/bid-report-artifacts/page-${i}.png`, canvas.canvas.toBuffer('image/png'));
  }
  await task.destroy();
  await expect(
    renderResponsePdf({ ...document, title: 'Unsupported \u{1F600}' }, assets, 'report'),
  ).rejects.toThrow('no text was silently removed');
});

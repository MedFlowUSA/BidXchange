import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import path from 'node:path';
let js = '',
  css = '';

test('bid plan stays unsaved until a human reviews and saves; viewer and general mode cannot save', async ({
  page,
}) => {
  const saves: Record<string, unknown>[] = [];
  await page.route('**/synthetic-task-save', async (route) => {
    saves.push(JSON.parse(route.request().postData()!));
    await route.fulfill({
      json: {
        success: true,
        message: 'Task saved after human review.',
        href: '/pursuits/synthetic#task-synthetic',
      },
    });
  });
  const answer = {
    answer: [
      {
        text: 'Review the recorded license question before deciding.',
        sources: ['requirement:55555555-5555-4555-8555-555555555555'],
      },
    ],
    risks: [],
    nextAction: 'Review the task proposal.',
    notice: 'AI suggestions require review.',
    evidence: [],
    citations: [
      {
        key: 'requirement:55555555-5555-4555-8555-555555555555',
        type: 'requirement',
        id: '55555555-5555-4555-8555-555555555555',
        title: 'Recorded requirement',
        href: '/pursuits/synthetic',
        status: 'needs_review',
        sourceDate: null,
        updatedAt: null,
      },
    ],
    actionToken: 'synthetic-review-token',
    proposedTasks: [
      {
        title: 'Review license evidence',
        explanation: 'A person needs to compare the saved requirement with the source.',
        sources: ['requirement:55555555-5555-4555-8555-555555555555'],
        requirementKey: 'requirement:55555555-5555-4555-8555-555555555555',
      },
    ],
  };
  await page.route('**/api/assistant', (route) =>
    route.fulfill({
      contentType: 'application/x-ndjson',
      body: JSON.stringify({ type: 'answer', answer }) + '\n',
    }),
  );
  await mount(page);
  await page.goto('/assistant-test?planning');
  const ask = async () => {
    await page.locator('#assistant-question').fill('Help me plan this bid');
    await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
    await expect(page.getByRole('region', { name: 'AI-proposed bid plan' })).toBeVisible();
  };
  await ask();
  const plan = page.getByRole('region', { name: 'AI-proposed bid plan' });
  expect(saves).toHaveLength(0);
  await plan.locator('summary').filter({ hasText: /^Review and save task$/ }).click();
  await plan
    .getByLabel('Task title', { exact: true })
    .fill('Confirm license question with reviewer');
  await expect(plan.getByLabel('Task owner', { exact: true })).toHaveValue('');
  await expect(plan.getByLabel('Task deadline with offset', { exact: true })).toHaveValue('');
  await plan.getByRole('button', { name: 'Review and save task', exact: true }).click();
  expect(saves).toHaveLength(0);
  await plan.getByRole('checkbox').check();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await plan.screenshot({ path: `.tmp/assistant-plan-${width}.png` });
  }
  await plan.getByRole('button', { name: 'Review and save task', exact: true }).click();
  await expect(plan.getByText('Task saved after human review.', { exact: true })).toBeVisible();
  expect(saves).toHaveLength(1);
  expect(saves[0]).toMatchObject({
    title: 'Confirm license question with reviewer',
    status: 'todo',
    review_confirmed: 'on',
    action_token: 'synthetic-review-token',
  });
  await page.goto('/assistant-test?planning&viewer');
  await ask();
  await expect(
    plan.getByText('A capture manager or administrator can review and save tasks.'),
  ).toBeVisible();
  await expect(plan.getByRole('button', { name: 'Review and save task' })).toHaveCount(0);
  await page.getByLabel('Answer mode', { exact: true }).selectOption('general');
  await page.locator('#assistant-question').fill('Give general advice');
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await expect(page.getByRole('region', { name: 'AI-proposed bid plan' })).toHaveCount(0);
});

test('follow-ups send opaque continuation and new chat or mode changes reset it', async ({
  page,
}) => {
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/assistant', (r) => {
    requests.push(r.request().postDataJSON());
    return r.fulfill({
      contentType: 'application/x-ndjson',
      body:
        JSON.stringify({
          type: 'answer',
          answer: {
            answer: [{ text: 'Helpful answer ' + requests.length, sources: [] }],
            evidence: [],
            citations: [],
            risks: [],
            nextAction: '',
            notice: 'Synthetic response',
            continuation: 'opaque-' + requests.length,
          },
        }) + '\n',
    });
  });
  await mount(page);
  const ask = async (text: string) => {
    const expected = requests.length + 1;
    await page.locator('#assistant-question').fill(text);
    if (requests.length === 0)
      await page.screenshot({ path: test.info().outputPath('before-send.png'), fullPage: true });
    await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
    await expect(page.getByRole('article')).toContainText('Helpful answer ' + expected);
  };
  await ask('Suggest a plan');
  await ask('Expand the second step');
  expect(requests[1].continuation).toBe('opaque-1');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath('conversation.png'), fullPage: true });
  await page.getByRole('button', { name: 'New conversation', exact: true }).click();
  await ask('A different topic');
  expect(requests[2].continuation).toBeUndefined();
  await page.getByLabel('Answer mode', { exact: true }).selectOption('general');
  await ask('Explain a term');
  expect(requests[3].continuation).toBeUndefined();
  expect(requests[3].context).toBeNull();
});
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/assistant-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/assistant-harness',
    jsx: 'automatic',
    alias: { 'next/link': path.resolve('tests/fixtures/link.tsx') },
    plugins: [
      {
        name: 'server-action-transport',
        setup(builder) {
          builder.onResolve({ filter: /assistant-task-actions$/ }, () => ({
            path: path.resolve('tests/fixtures/assistant-task-action.ts'),
          }));
          builder.onResolve({ filter: /capture-actions$/ }, () => ({
            path: path.resolve('tests/fixtures/pepma-actions.ts'),
          }));
          builder.onResolve({ filter: /assistant-document-actions$/ }, () => ({
            path: path.resolve('tests/fixtures/assistant-document-action.ts'),
          }));
        },
      },
    ],
    define: { 'process.env.NODE_ENV': '"production"' },
    platform: 'browser',
  });
  js = bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
async function mount(page: Page, available = true) {
  await page.route('https://fonts.googleapis.com/**', (r) =>
    r.fulfill({ contentType: 'text/css', body: '' }),
  );
  await page.route('**/assistant-test*', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/assistant-harness.css"></head><body><div id="root"></div><script src="/assistant-harness.js"></script></body></html>',
    }),
  );
  await page.route('**/assistant-harness.js', (r) =>
    r.fulfill({ contentType: 'application/javascript', body: js }),
  );
  await page.route('**/assistant-harness.css', (r) =>
    r.fulfill({ contentType: 'text/css', body: css }),
  );
  await page.route('**/api/assistant/status?*', (r) =>
    r.fulfill({ json: { available, access: 'synthetic-user:viewer' } }),
  );
  await page.goto('/assistant-test');
  await expect(page.getByLabel('Answer mode', { exact: true })).toHaveValue('workspace');
  await expect(page.getByLabel('Ask about Synthetic Test Company')).toBeVisible();
}
test('general mode sends no record context and displays uncited helpful prose', async ({
  page,
}) => {
  await page.route('**/api/assistant', (r) => {
    expect(r.request().postDataJSON()).toMatchObject({ mode: 'general', context: null });
    return r.fulfill({
      contentType: 'application/x-ndjson',
      body:
        JSON.stringify({
          type: 'answer',
          answer: {
            answer: [{ text: 'Here is a draft email you can adapt.', sources: [] }],
            evidence: [],
            citations: [],
            risks: [],
            nextAction: '',
            notice: 'General AI response. No company records or live web sources were used.',
          },
        }) + '\n',
    });
  });
  await mount(page);
  await page.getByLabel('Answer mode', { exact: true }).selectOption('general');
  await page.getByLabel('Ask a question', { exact: true }).fill('Draft an email');
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Here is a draft email');
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'Sources', exact: true }),
  ).toHaveCount(0);
});

test('company connection and refresh use a new workspace request even after switching modes', async ({
  page,
}) => {
  const requests: { requestId: string; mode: string }[] = [];
  await page.route('**/api/assistant', (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: 'application/x-ndjson',
      body:
        JSON.stringify({
          type: 'answer',
          answer: {
            answer: [
              {
                text: requests.length === 1 ? 'Previous saved email' : 'Current saved email',
                sources: ['fact:email'],
              },
            ],
            evidence: [],
            citations: [],
            risks: [],
            nextAction: '',
            notice: 'Saved records',
            recordsCheckedAt: '2026-09-21T12:00:00Z',
          },
        }) + '\n',
    });
  });
  await mount(page);
  await expect(page.getByLabel('Company records connection')).toContainText(
    'Synthetic Test Company',
  );
  await expect(page.getByRole('link', { name: 'Manage company records' })).toHaveAttribute(
    'href',
    '/company?organization=11111111-1111-4111-8111-111111111111',
  );
  await page.getByLabel('Ask about Synthetic Test Company').fill('What is our business email?');
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Previous saved email');
  await expect(page.getByRole('article')).toContainText('Records checked:');
  await page.getByLabel('Answer mode', { exact: true }).selectOption('general');
  await expect(page.getByLabel('Company records connection')).toContainText('Company records off');
  await page.getByRole('button', { name: 'Refresh from company records' }).click();
  await expect(page.getByRole('article')).toContainText('Current saved email');
  expect(requests.map((r) => r.mode)).toEqual(['workspace', 'workspace']);
  expect(requests[0].requestId).not.toBe(requests[1].requestId);
});
test('verified streamed event renders citations and copy/feedback controls', async ({ page }) => {
  await page.route('**/api/assistant', (r) =>
    r.fulfill({
      contentType: 'application/x-ndjson',
      body:
        JSON.stringify({ type: 'status', text: 'Retrieving scoped records…' }) +
        '\n' +
        JSON.stringify({
          type: 'answer',
          answer: {
            answer: [{ text: 'Synthetic opportunity — unverified', sources: ['opportunity:test'] }],
            evidence: [],
            risks: ['Unverified'],
            nextAction: 'Human review required.',
            notice: 'No live feeds.',
            citations: [
              {
                key: 'opportunity:test',
                type: 'opportunity',
                title: 'Synthetic opportunity',
                id: 'test',
                status: 'unverified',
                updatedAt: null,
                href: '/opportunities/test?organization=11111111-1111-4111-8111-111111111111',
              },
            ],
          },
        }) +
        '\n',
    }),
  );
  await mount(page);
  await page.getByLabel('Ask about Synthetic Test Company').fill('Review opportunities');
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await expect(page.getByRole('article')).toContainText('Synthetic opportunity — unverified');
  await expect(
    page.getByRole('link', { name: 'Synthetic opportunity', exact: true }),
  ).toHaveAttribute('href', /organization=11111111/);
  await expect(page.getByRole('button', { name: 'Copy answer' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
});
test('cancel aborts generation and exposes retry without saving partial output', async ({
  page,
}) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/assistant', async (r) => {
    await gate;
    await r.fulfill({ contentType: 'application/x-ndjson', body: '' }).catch(() => {});
  });
  await mount(page);
  await page.getByLabel('Ask about Synthetic Test Company').fill('Review');
  await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel generation' }).click();
  release();
  await expect(page.getByRole('alert')).toContainText('Generation cancelled.');
  await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(0);
});
for (const [label, status, body] of [
  ['rate limit', 429, JSON.stringify({ message: 'The assistant usage limit has been reached.' })],
  ['timeout', 200, JSON.stringify({ type: 'error', message: 'The assistant timed out.' }) + '\n'],
  ['disconnect', 200, ''],
  ['outage', 503, JSON.stringify({ message: 'The model service is unavailable.' })],
] as const) {
  test(`accessible ${label} state`, async ({ page }) => {
    await page.route('**/api/assistant', (r) =>
      r.fulfill({
        status,
        contentType: status === 200 ? 'application/x-ndjson' : 'application/json',
        body,
      }),
    );
    await mount(page);
    await page.getByLabel('Ask about Synthetic Test Company').fill('Review');
    await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Retry', exact: true })).toBeEnabled();
  });
}
test('unconfigured assistant remains safely unavailable', async ({ page }) => {
  await mount(page, false);
  await expect(page.getByText(/AI is unavailable for this workspace/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask BidXchange', exact: true })).toBeDisabled();
});

for (const change of ['revoked', 'role', 'pagehide'] as const) {
  test(`private conversation clears on ${change}`, async ({ page }) => {
    await page.route('**/api/assistant', (route) =>
      route.fulfill({
        contentType: 'application/x-ndjson',
        body:
          JSON.stringify({
            type: 'answer',
            answer: {
              answer: [{ text: 'SYNTHETIC PRIVATE ANSWER', sources: ['synthetic'] }],
              evidence: [],
              citations: [],
              risks: [],
              nextAction: 'Review.',
              notice: 'No live feeds.',
            },
          }) + '\n',
      }),
    );
    await mount(page);
    await page.getByLabel('Ask about Synthetic Test Company').fill('Synthetic private question');
    await page.getByRole('button', { name: 'Ask BidXchange', exact: true }).click();
    await expect(page.getByRole('article')).toContainText('SYNTHETIC PRIVATE ANSWER');
    if (change === 'pagehide') {
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    } else {
      await page.route('**/api/assistant/status?*', (route) =>
        route.fulfill({
          json: {
            available: change === 'role',
            access: change === 'role' ? 'synthetic-user:contributor' : null,
          },
        }),
      );
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    }
    await expect(page.getByRole('article')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /1\. Synthetic private question/ })).toHaveCount(
      0,
    );
    await expect(page.getByLabel('Ask about Synthetic Test Company')).toHaveValue('');
    if (change === 'revoked')
      await expect(
        page.getByRole('button', { name: 'Ask BidXchange', exact: true }),
      ).toBeDisabled();
    expect(
      await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
    ).toEqual({ local: 0, session: 0 });
  });
}

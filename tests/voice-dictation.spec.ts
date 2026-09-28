import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { appendDictation, speechText } from '../apps/web/lib/speech-recognition';
import { installSpeechFake } from './fixtures/speech-fake';
let js = '',
  css = '';
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ['tests/fixtures/voice-dictation-harness.tsx'],
    bundle: true,
    write: false,
    outdir: '.tmp/voice-harness',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  js = bundle.outputFiles.find((f) => f.path.endsWith('.js'))!.text;
  css = bundle.outputFiles.find((f) => f.path.endsWith('.css'))!.text;
});
async function mount(page: Page) {
  await page.route('**/voice-test', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>',
    }),
  );
  await page.goto('/voice-test');
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
}

test('transcripts separate interim speech, bound output and append without overwriting typed text', () => {
  const result = speechText(
    [
      { isFinal: true, length: 1, 0: { transcript: 'Find bids' } },
      { isFinal: false, length: 1, 0: { transcript: 'in California' } },
    ],
    1500,
  );
  expect(result).toEqual({ final: 'Find bids', interim: 'in California', limited: false });
  expect(appendDictation('Keep this', 'New words', 100)).toBe('Keep this\nNew words');
  expect(appendDictation('Keep this', 'New words', 10)).toBeNull();
  expect(appendDictation('Keep this', ' ', 100)).toBeNull();
  expect(
    speechText([{ isFinal: true, length: 1, 0: { transcript: 'a'.repeat(2000) } }], 1500),
  ).toMatchObject({ limited: true, final: 'a'.repeat(1500) });
});

for (const width of [1440, 390])
  test(`dictate, stop, edit and add are explicit and never send at ${width}px`, async ({
    page,
  }) => {
    await installSpeechFake(page, { support: 'prefixed' });
    await page.setViewportSize({ width, height: 900 });
    await mount(page);
    expect(await page.evaluate(() => window.__speech.stats().starts)).toBe(0);
    await page.getByLabel('Speech language').selectOption('es-US');
    await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
    expect(await page.evaluate(() => window.__speech.stats().language)).toBe('es-US');
    await expect(page.getByRole('button', { name: 'Ask BidBuddy', exact: true })).toBeDisabled();
    await page.evaluate(() =>
      window.__speech.results([
        { text: 'Buscar oportunidades', final: true },
        { text: 'en California', final: false },
      ]),
    );
    await expect(page.getByLabel('Question', { exact: true })).toHaveValue('Existing question');
    await page.evaluate(() =>
      window.__speech.results([
        { text: 'Buscar oportunidades', final: true },
        { text: 'en California', final: true },
      ]),
    );
    await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
    await expect(page.getByLabel('Review dictated text')).toHaveValue(
      'Buscar oportunidades en California',
    );
    await expect(page.getByRole('button', { name: 'Ask BidBuddy', exact: true })).toBeDisabled();
    await page.getByLabel('Review dictated text').fill('Find California bids.');
    await page.getByLabel('Question', { exact: true }).fill('Keep this edited question');
    await page.screenshot({ path: `.tmp/voice-review-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Add text to question', exact: true }).click();
    await expect(page.getByLabel('Question', { exact: true })).toHaveValue(
      'Keep this edited question\nFind California bids.',
    );
    await expect(page.getByLabel('Messages sent')).toHaveText('0');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Ask BidBuddy', exact: true }).click();
    await expect(page.getByLabel('Messages sent')).toHaveText('1');
  });

for (const boundary of ['discard', 'close', 'workspace', 'access', 'pagehide', 'hidden'])
  test(`dictation stops and rejects late results after ${boundary}`, async ({ page }) => {
    await installSpeechFake(page);
    await mount(page);
    await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
    await page.evaluate(() => {
      window.__speech.results([{ text: 'Private draft', final: true }]);
      window.__speech.remember();
    });
    if (boundary === 'discard')
      await page.getByRole('button', { name: 'Discard dictation' }).click();
    if (boundary === 'close') await page.getByRole('button', { name: 'Toggle panel' }).click();
    if (boundary === 'workspace')
      await page.getByRole('button', { name: 'Switch workspace' }).click();
    if (boundary === 'access') await page.getByRole('button', { name: 'Toggle access' }).click();
    if (boundary === 'pagehide')
      await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
    if (boundary === 'hidden')
      await page.evaluate(() => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
        document.dispatchEvent(new Event('visibilitychange'));
      });
    await page.evaluate(() =>
      window.__speech.late([{ text: 'Late confidential words', final: true }]),
    );
    await expect(page.getByLabel('Question', { exact: true })).toHaveValue('Existing question');
    await expect(page.getByLabel('Live dictation preview')).toHaveCount(0);
    await expect(page.getByLabel('Review dictated text')).toHaveCount(0);
    expect(await page.evaluate(() => window.__speech.stats().aborts)).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })),
    ).toEqual({ local: 0, session: 0 });
  });

test('unsupported browsers retain typed input and request no microphone', async ({ page }) => {
  await installSpeechFake(page, { support: 'none' });
  await mount(page);
  await expect(page.getByText(/Voice typing is not supported/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dictate question', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Ask BidBuddy', exact: true })).toBeEnabled();
  expect(await page.evaluate(() => window.__speech.stats().starts)).toBe(0);
});

for (const code of [
  'not-allowed',
  'audio-capture',
  'network',
  'no-speech',
  'language-not-supported',
])
  test(`speech error ${code} releases the microphone and preserves typing`, async ({ page }) => {
    await installSpeechFake(page);
    await mount(page);
    await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
    await page.evaluate((error) => window.__speech.error(error), code);
    await expect(page.getByRole('button', { name: 'Dictate question', exact: true })).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Ask BidBuddy', exact: true })).toBeEnabled();
    await expect(page.getByLabel('Question', { exact: true })).toHaveValue('Existing question');
    expect(await page.evaluate(() => window.__speech.stats().aborts)).toBe(1);
  });

test('length limits require editing before insertion and never truncate the existing question', async ({
  page,
}) => {
  await installSpeechFake(page);
  await mount(page);
  await page.getByLabel('Question', { exact: true }).fill('x'.repeat(1490));
  await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
  await page.evaluate(() => window.__speech.results([{ text: 'a'.repeat(1700), final: true }]));
  await expect(page.getByLabel('Review dictated text')).toHaveValue('a'.repeat(1500));
  await expect(page.getByText(/Only the shown text was kept/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Add text to question', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('Review dictated text').fill('hello');
  await page.getByRole('button', { name: 'Add text to question', exact: true }).click();
  await expect(page.getByLabel('Question', { exact: true })).toHaveValue(
    'x'.repeat(1490) + '\nhello',
  );
});

test('permission, listening and stop timeouts cannot leave a microphone session running', async ({
  page,
}) => {
  await installSpeechFake(page, { autoStart: false, autoEnd: false });
  await mount(page);
  await page.clock.install();
  await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
  await page.clock.fastForward(15001);
  await expect(page.getByText(/Microphone access did not start/)).toBeVisible();
  expect(await page.evaluate(() => window.__speech.stats().aborts)).toBe(1);
  await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
  await page.evaluate(() => window.__speech.results([{ text: 'Keep these words', final: true }]));
  await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
  await page.clock.fastForward(4001);
  await expect(page.getByLabel('Review dictated text')).toHaveValue('Keep these words');
  await page.getByRole('button', { name: 'Discard dictation' }).click();
});

test('one minute limit stops a continuous recognizer and requires review', async ({ page }) => {
  await installSpeechFake(page);
  await mount(page);
  await page.clock.install();
  await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
  await page.evaluate(() =>
    window.__speech.results([{ text: 'Check the bid deadline', final: true }]),
  );
  await page.clock.fastForward(60001);
  await expect(page.getByLabel('Review dictated text')).toHaveValue('Check the bid deadline');
  await expect(page.getByText(/one-minute dictation limit/)).toBeVisible();
  expect(await page.evaluate(() => window.__speech.stats().stops)).toBe(1);
});

test('synchronous start failures do not trap the composer', async ({ page }) => {
  await installSpeechFake(page, { throws: true });
  await mount(page);
  await page.getByRole('button', { name: 'Dictate question', exact: true }).click();
  await expect(page.getByText(/Dictation could not start/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask BidBuddy', exact: true })).toBeEnabled();
});

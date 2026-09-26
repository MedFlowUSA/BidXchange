import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

test('shared dialog keeps interior clicks open and includes disclosures in its keyboard loop', async ({
  page,
}) => {
  const bundle = await build({
    stdin: {
      contents: `import {useState} from 'react'; import {createRoot} from 'react-dom/client'; import Dialog from './apps/web/components/dialog'; import './apps/web/app/globals.css'; function App(){const [open,setOpen]=useState(false);return <><button onClick={()=>setOpen(true)}>Open test dialog</button>{open&&<Dialog title="Test dialog" close={()=>setOpen(false)}><input aria-label="Visible field"/><fieldset disabled><input aria-label="Disabled field"/></fieldset><div hidden><button>Hidden action</button></div><details><summary>Review sources</summary><button>Source action</button></details></Dialog>}</>};createRoot(document.getElementById('root')).render(<App/>);`,
      resolveDir: process.cwd(),
      loader: 'tsx',
    },
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    outfile: 'fixture.js',
  });
  await page.route('**/dialog-test', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div></body></html>',
    }),
  );
  await page.goto('/dialog-test');
  await page.addStyleTag({
    content: bundle.outputFiles.find((file) => file.path.endsWith('.css'))!.text,
  });
  await page.addScriptTag({
    content: bundle.outputFiles.find((file) => file.path.endsWith('.js'))!.text,
  });
  await page.getByRole('button', { name: 'Open test dialog' }).click();
  const dialog = page.getByRole('dialog', { name: 'Test dialog' });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  await page.mouse.click(box.x + 2, box.y + 2);
  await expect(dialog).toBeVisible();
  const close = dialog.getByRole('button', { name: 'Close dialog' });
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.locator('summary')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(close).toBeFocused();
  await dialog.locator('summary').click();
  await close.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Source action' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open test dialog' })).toBeFocused();
  await page.getByRole('button', { name: 'Open test dialog' }).click();
  await page.mouse.click(1, 1);
  await expect(dialog).toHaveCount(0);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const bytes = readFileSync('apps/web/public/guides/bidxchange-user-guide.pdf');
const chapters = JSON.parse(readFileSync('docs/presentations/how-to-content.json', 'utf8'));
const pdf = await PDFDocument.load(bytes);
assert.equal(pdf.getPageCount(), chapters.length);
assert(pdf.catalog.has(PDFName.of('StructTreeRoot')), 'PDF structure tree missing');
assert(pdf.catalog.has(PDFName.of('MarkInfo')), 'PDF tagging metadata missing');
const reader = await getDocument({ data: new Uint8Array(bytes), useSystemFonts: true }).promise;
let text = '';
for (let i = 1; i <= reader.numPages; i++) {
  const page = await reader.getPage(i),
    content = await page.getTextContent();
  assert(content.items.length > 0, `Page ${i} has no extractable text`);
  text += content.items.map((t) => t.str ?? '').join(' ') + '\n';
}
for (const phrase of [
  'Create a response outline for this solicitation',
  'Approve one specific response version',
  'Submit externally, then record the receipt',
  'Workspace guide',
  'thirteen-step pursuit checklist',
  'Fictional local exercise only',
])
  assert(text.includes(phrase), `Missing instructional phrase: ${phrase}`);
const html = readFileSync('apps/web/public/guides/bidxchange-user-guide.html', 'utf8');
assert.equal((html.match(/<section id="chapter-/g) ?? []).length, chapters.length);
assert(html.includes('<main>') && html.includes('<nav aria-label="Guide contents">'));
assert(html.includes('available in authenticated workspaces, subject to role permissions'));
assert(html.includes('once per UTC day') && html.includes('Acknowledging a reminder does not renew'));
console.log(
  `PASS: ${chapters.length} PDF pages with extractable text, structure tree and tagging metadata; matching semantic HTML chapters, current checklist and reminder instructions. PDF/UA conformance is not claimed.`,
);

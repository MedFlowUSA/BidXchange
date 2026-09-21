import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument, PDFName } from 'pdf-lib';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const bytes = readFileSync('apps/web/public/guides/bidxchange-user-guide.pdf');
const pdf = await PDFDocument.load(bytes);
assert.equal(pdf.getPageCount(), 23);
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
  'Approve the exact response version',
  'Hand off, submit manually',
  'Workspace guide',
])
  assert(text.includes(phrase), `Missing instructional phrase: ${phrase}`);
const html = readFileSync('apps/web/public/guides/bidxchange-user-guide.html', 'utf8');
assert.equal((html.match(/<section id="chapter-/g) ?? []).length, 23);
assert(html.includes('<main>') && html.includes('<nav aria-label="Guide contents">'));
assert(html.includes('staged and require production activation'));
console.log(
  'PASS: 23 PDF pages with extractable text, structure tree and tagging metadata; 23 semantic HTML chapters and explicit staged-feature labels. PDF/UA conformance is not claimed.',
);

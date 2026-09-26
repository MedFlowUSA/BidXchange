import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  Header,
  Footer,
  PageNumber,
  ImageRun,
  AlignmentType,
} from 'docx';
import type { ResponseDocument } from './response-package';

export class ResponseRenderError extends Error {}
type Assets = { regular: Uint8Array; bold: Uint8Array; logo: Uint8Array };
export async function renderResponsePdf(
  input: ResponseDocument,
  assets: Assets,
  purpose: 'response' | 'handoff' = 'response',
) {
  const handoff = purpose === 'handoff';
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const regular = await pdf.embedFont(assets.regular, { subset: true });
  const bold = await pdf.embedFont(assets.bold, { subset: true });
  const logo = await pdf.embedPng(assets.logo);
  pdf.setTitle(input.title);
  pdf.setAuthor(input.company);
  pdf.setSubject(
    handoff
      ? 'Internal submission handoff — not a buyer submission'
      : `Draft ${input.kind ?? 'RFI'} response — internal review`,
  );
  pdf.setCreator('BidXchange');
  const navy = rgb(0.05, 0.1, 0.2),
    gold = rgb(0.94, 0.65, 0.13),
    gray = rgb(0.33, 0.38, 0.45);
  const supported = new Set(regular.getCharacterSet());
  const clean = (text: string) => text.replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  for (const text of [
    input.title,
    input.draftName,
    input.company,
    input.buyer,
    input.solicitation,
    input.version,
    ...input.blocks.map((b) => b.text),
  ]) {
    if ([...clean(text)].some((c) => c !== '\n' && !supported.has(c.codePointAt(0)!)))
      throw new ResponseRenderError(
        handoff
          ? 'Some characters are not supported by the PDF font. Download the JSON packet to preserve the complete text.'
          : 'Some characters are not supported by the PDF font. Download the editable Word file to preserve the complete text.',
      );
  }
  let page: PDFPage,
    y = 0;
  const addPage = () => {
    if (pdf.getPageCount() >= 160)
      throw new ResponseRenderError('This response is too long for one PDF. Reduce its scope.');
    page = pdf.addPage([612, 792]);
    y = 718;
    page.drawText(
      handoff
        ? 'BIDXCHANGE  /  SUBMISSION HANDOFF'
        : `BIDXCHANGE  /  ${input.kind ?? 'RFI'} RESPONSE`,
      {
        x: 48,
        y: 752,
        size: 9,
        font: bold,
        color: navy,
      },
    );
    page.drawRectangle({ x: 48, y: 739, width: 516, height: 2, color: gold });
  };
  const write = (text: string, font: PDFFont, size: number, color = navy) => {
    const lineHeight = size * 1.5;
    const draw = (line: string) => {
      if (y < 65 + lineHeight) addPage();
      page.drawText(line, { x: 48, y, size, font, color });
      y -= lineHeight;
    };
    for (const paragraph of clean(text).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/ +/)) {
        if (!word) continue;
        const joined = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(joined, size) <= 516) {
          line = joined;
          continue;
        }
        if (line) {
          draw(line);
          line = '';
        }
        if (font.widthOfTextAtSize(word, size) <= 516) {
          line = word;
          continue;
        }
        for (const character of word) {
          if (font.widthOfTextAtSize(line + character, size) > 516) {
            draw(line);
            line = '';
          }
          line += character;
        }
      }
      draw(line);
    }
    y -= 8;
  };
  addPage();
  page!.drawImage(logo, { x: 48, y: 637, width: 240, height: (240 * logo.height) / logo.width });
  y = 606;
  write(handoff ? 'INTERNAL HANDOFF' : 'DRAFT', bold, 15, gold);
  write(input.title, bold, 24);
  write(input.draftName, regular, 12, gray);
  write(input.company, bold, 16);
  write(
    `${handoff ? 'Buyer' : 'Prepared for'}: ${input.buyer}\nSolicitation: ${input.solicitation}`,
    regular,
    11,
  );
  write(
    `${handoff ? 'Frozen version' : 'Saved draft'}: ${input.version}\nGenerated: ${input.generatedAt}`,
    regular,
    9,
    gray,
  );
  write(
    handoff
      ? (input.blocks[0]?.text ?? 'Review handoff status')
      : 'Internal working copy. Not approved for submission.',
    bold,
    12,
  );
  write(
    handoff
      ? 'For your submission team. Not a buyer submission or proof of receipt. Recheck live status before use; this copy does not update after export.'
      : 'Includes an internal review checklist. Verify the notice, responses and supporting evidence before sharing with the buyer.',
    regular,
    11,
    gray,
  );
  addPage();
  for (const block of input.blocks) {
    if (block.kind === 'heading' && y < 150) addPage();
    write(
      block.text,
      block.kind === 'heading' ? bold : regular,
      block.kind === 'heading' ? 14 : block.kind === 'note' ? 9 : 11,
      block.kind === 'note' ? gray : navy,
    );
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: 48, y: 48 }, end: { x: 564, y: 48 }, color: gold, thickness: 1 });
    p.drawText(
      handoff ? 'INTERNAL HANDOFF — NOT A BUYER SUBMISSION' : 'DRAFT — NOT APPROVED FOR SUBMISSION',
      {
        x: 48,
        y: 31,
        size: 8,
        font: bold,
        color: gray,
      },
    );
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: 520,
      y: 31,
      size: 8,
      font: regular,
      color: gray,
    });
  });
  return pdf.save();
}

export async function renderResponseDocx(input: ResponseDocument, logo: Uint8Array) {
  // XML 1.0 cannot preserve these control characters; report instead of corrupting the file.
  if (
    [
      input.title,
      input.draftName,
      input.company,
      input.buyer,
      input.solicitation,
      ...input.blocks.map((b) => b.text),
    ].some((text) =>
      [...text].some((c) => {
        const n = c.codePointAt(0)!;
        return (
          (n < 32 && ![9, 10, 13].includes(n)) ||
          (n >= 0xd800 && n <= 0xdfff) ||
          n === 0xfffe ||
          n === 0xffff
        );
      }),
    )
  )
    throw new ResponseRenderError(
      'The response contains unsupported control characters. Remove them before exporting.',
    );
  const paragraph = (text: string, heading = false) =>
    new Paragraph({
      spacing: { after: 160 },
      keepNext: heading,
      children: text.split(/\r?\n/).flatMap((line, i) => [
        new TextRun({
          text: line,
          break: i ? 1 : undefined,
          bold: heading,
          size: heading ? 28 : 22,
          color: heading ? '10203C' : '263345',
        }),
      ]),
    });
  const doc = new Document({
    creator: 'BidXchange',
    title: input.title,
    description: `Draft ${input.kind ?? 'RFI'} response, not approved for submission`,
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 960, bottom: 960, left: 960, right: 960 },
          },
        },
        headers: {
          default: new Header({
            children: [paragraph(`BidXchange | ${input.kind ?? 'RFI'} RESPONSE · DRAFT`)],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun('DRAFT — NOT APPROVED FOR SUBMISSION | '),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                  new TextRun(' / '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [
              new ImageRun({ type: 'png', data: logo, transformation: { width: 240, height: 80 } }),
            ],
          }),
          paragraph('DRAFT', true),
          paragraph(input.title, true),
          paragraph(input.draftName),
          paragraph(input.company, true),
          paragraph(`Prepared for: ${input.buyer}\nSolicitation: ${input.solicitation}`),
          paragraph(`Saved draft: ${input.version}\nGenerated: ${input.generatedAt}`),
          paragraph(
            'Internal working copy. Not approved for submission. Includes an internal review checklist. Verify the notice, responses and evidence before sharing with the buyer.',
          ),
          new Paragraph({ pageBreakBefore: true, text: 'Response package' }),
          ...input.blocks.map((b) => paragraph(b.text, b.kind === 'heading')),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

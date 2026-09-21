import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import './build-accessible-guide.mjs';
const require = createRequire(import.meta.url);
const PptxGenJS = require('../../.tmp/presentation-tools/node_modules/pptxgenjs');
const dir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, '$1'));
const slides = JSON.parse(fs.readFileSync(path.join(dir, 'guide-content.json'), 'utf8'));
const pptx = new PptxGenJS();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'BidXchange';
pptx.subject = 'How to use BidXchange';
pptx.title = 'BidXchange — User Guide';
pptx.company = 'BidXchange';
pptx.lang = 'en-US';
pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'en-US' };
const C = {
  navy: '0D1933',
  blue: '235AF5',
  gold: 'F2B337',
  ink: '14233D',
  muted: '54657A',
  paper: 'F3F6FB',
  white: 'FFFFFF',
  line: 'DBE3EF',
};
const esc = (s) =>
  String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const sections = [];
for (const [i, d] of slides.entries()) {
  const slide = pptx.addSlide();
  slide.background = { color: d.cover ? C.navy : C.paper };
  slide.addNotes(d.notes);
  let html = '';
  function rect(x, y, w, h, color, line = color) {
    slide.addShape(pptx.ShapeType.rect, {
      x,
      y,
      w,
      h,
      fill: { color },
      line: { color: line, width: 0.5 },
    });
    html += `<div style="position:absolute;left:${x * 96}px;top:${y * 96}px;width:${w * 96}px;height:${h * 96}px;background:#${color};border:0.5px solid #${line};box-sizing:border-box"></div>`;
  }
  function text(t, x, y, w, h, size, color = C.ink, bold = false, other = {}) {
    slide.addText(t, {
      x,
      y,
      w,
      h,
      fontFace: 'Arial',
      fontSize: size,
      color,
      bold,
      margin: 0,
      breakLine: false,
      paraSpaceAfter: 0,
      valign: 'top',
      ...other,
    });
    html += `<div class="text" ${t === d.title ? 'role="heading" aria-level="1"' : ''} style="position:absolute;left:${x * 96}px;top:${y * 96}px;width:${w * 96}px;height:${h * 96}px;font-size:${(size * 4) / 3}px;color:#${color};font-weight:${bold ? 700 : 400};line-height:1.15;white-space:pre-wrap;overflow-wrap:break-word;${other.align ? 'text-align:' + other.align : ''}">${esc(t)}</div>`;
  }
  function image(file, x, y, w, h) {
    slide.addImage({ path: file, x, y, w, h });
    html += `<img alt="${esc(path.basename(file))}" style="position:absolute;left:${x * 96}px;top:${y * 96}px;width:${w * 96}px;height:${h * 96}px" src="data:image/png;base64,${fs.readFileSync(file).toString('base64')}"/>`;
  }
  const logo = path.resolve('apps/web/public/brand/bidxchange-logo.png');
  if (d.cover) {
    rect(0.62, 0.52, 3.8, 1.23, C.white);
    image(logo, 0.77, 0.6, 3.5, 1.07);
    text(d.section, 0.68, 2.13, 10, 0.4, 13, C.gold, true);
    text(d.title, 0.65, 2.77, 11.8, 1.8, 43, C.white, true);
    text(d.subtitle, 0.68, 4.96, 11, 0.6, 23, 'D4DEEF');
    rect(0.68, 6.07, 0.72, 0.075, C.gold);
    text('USER GUIDE  /  SEPTEMBER 2026', 1.62, 5.99, 9, 0.35, 12, 'D4DEEF');
    text('bidxapp.vercel.app', 0.68, 6.8, 9, 0.4, 14, C.gold, false, {
      hyperlink: { url: 'https://bidxapp.vercel.app/' },
    });
  } else {
    rect(0, 0, 13.333, 0.1, C.blue);
    text(d.section, 0.62, 0.4, 11, 0.28, 11, C.blue, true);
    text(d.title, 0.62, 0.91, 12.05, 0.92, 29, C.navy, true);
    if (d.command) {
      rect(0.62, 1.94, 12.05, 0.66, C.navy);
      text('“' + d.command + '”', 0.86, 2.07, 11.5, 0.4, 20, C.white, true);
    }
    if (d.image) {
      const x = 0.62,
        y = 2,
        w = 3.62,
        h = 4.62;
      rect(x, y, w, h, C.white, C.line);
      text(d.cards[0][0], x + 0.23, y + 0.25, w - 0.46, 0.65, 18, C.navy, true);
      text(d.cards[0][1], x + 0.23, y + 1.05, w - 0.46, 3.35, 16, C.muted);
      image(path.join(dir, 'assets', d.image), 4.55, 1.94, 8.16, 4.307);
    } else {
      const y = d.command ? 2.92 : 2.14,
        h = d.command ? 3.05 : 3.85;
      d.cards.forEach(([title, body], j) => {
        const x = 0.62 + j * 4.08,
          w = 3.88;
        rect(x, y, w, h, C.white, C.line);
        rect(x, y, 0.055, h, j === 1 ? C.gold : C.blue);
        text(String(j + 1).padStart(2, '0'), x + 0.25, y + 0.22, 1, 0.4, 15, C.blue, true);
        text(title.replace(/^\d+\s+/, ''), x + 0.25, y + 0.77, w - 0.5, 0.67, 19, C.navy, true);
        text(body, x + 0.25, y + 1.55, w - 0.5, h - 1.7, 16, C.muted);
      });
    }
    if (d.takeaway) {
      rect(0.62, 6.3, 12.05, 0.53, 'E8EFFB');
      text(d.takeaway, 0.8, 6.4, 11.72, 0.35, 12, C.ink);
    }
    text('BIDXCHANGE  /  USER GUIDE', 0.62, 7.1, 6, 0.24, 9, C.muted);
    text(
      `${String(i + 1).padStart(2, '0')}  /  ${slides.length}`,
      11.64,
      7.08,
      1.05,
      0.26,
      10,
      C.blue,
      true,
      { align: 'right' },
    );
  }
  sections.push(
    `<section class="slide" data-slide="${i + 1}" style="background:#${d.cover ? C.navy : C.paper}">${html}</section>`,
  );
}
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>BidXchange User Guide</title><style>*{box-sizing:border-box}body{margin:0;background:#ccd4e0;font-family:Arial,sans-serif}.slide{position:relative;width:1280px;height:720px;overflow:hidden;break-after:page;margin:0 auto 20px}.slide:last-child{break-after:auto}@page{size:13.333333in 7.5in;margin:0}@media print{body{background:white}.slide{margin:0;page-break-after:always}.slide:last-child{page-break-after:auto}}</style></head><body>${sections.join('')}</body></html>`;
fs.writeFileSync(path.join(dir, 'BidXchange-User-Guide.html'), html);
fs.writeFileSync(
  path.join(dir, 'Presenter-Notes.md'),
  '# BidXchange user guide — presenter notes\n\n20–25 minutes plus a 10-minute practice exercise. Review workflow edition; new approval features pending production activation.\n\n' +
    slides.map((d, i) => `## ${i + 1}. ${d.title}\n\n${d.notes}\n`).join('\n') +
    '\n## Source and screenshot notes\n\nApp behavior was checked against the existing application source against the reviewed source; approval and submission workflow remains staged, including response packages, saved review, assistant commands, company autofill, capture forms, evidence reviews and bid decisions. Screenshots show the public fictional demo at https://bidxapp.vercel.app/; they contain no private company workspace records. App paths and labels reflect the current implementation. Availability and controls depend on role and rollout settings.\n',
);
await pptx.writeFile({ fileName: path.join(dir, 'BidXchange-User-Guide.pptx') });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  await page.goto(
    new URL('file:///' + path.join(dir, 'BidXchange-User-Guide.html').replaceAll('\\', '/')).href,
  );
  await page.evaluate(() => document.fonts.ready);
  const overflow = await page.locator('.text').evaluateAll((els) =>
    els
      .filter((el) => el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3)
      .map((el) => ({
        slide: el.closest('.slide').dataset.slide,
        text: el.textContent,
        scroll: el.scrollHeight,
        height: el.clientHeight,
      })),
  );
  if (overflow.length) throw new Error('Slide text overflow: ' + JSON.stringify(overflow));
  await page.pdf({
    path: path.join(dir, 'BidXchange-User-Guide.pdf'),
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    outline: true,
  });
  for (const num of [1, 4, 13, 15])
    await page
      .locator(`.slide[data-slide="${num}"]`)
      .screenshot({ path: path.join(dir, 'assets', `slide-${num}.png`) });
  console.log(
    `Created ${slides.length} slides; PowerPoint, PDF, HTML and presenter notes. No HTML text overflow.`,
  );
} finally {
  await browser.close();
}

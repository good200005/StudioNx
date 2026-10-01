// StudioNx_DB_Guide.md → StudioNx_DB_Guide.docx (이 문서에서 쓰는 md 문법만 지원)
// 사용: studionx/db/docs/_build 에서  npm install  (최초 1회) →  node md2docx.js
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType,
  ShadingType, BorderStyle, ImageRun, AlignmentType, LevelFormat, PageOrientation, Footer,
  Header, PageNumber, TableLayoutType,
} = require('docx');

const DIR = path.resolve(__dirname, '..');   // studionx/db/docs
const md = fs.readFileSync(path.join(DIR, 'StudioNx_DB_Guide.md'), 'utf8').replace(/\r/g, '');
const FONT = 'Malgun Gothic', MONO = 'Consolas';
const ACCENT = '4B3FD6';
const PORTRAIT_W = 11906 - 1134 * 2;     // A4, 2cm 여백
const LANDSCAPE_W = 16838 - 851 * 2;     // A4 가로, 1.5cm 여백

// 인라인: **굵게**, `코드`
function runs(text, opts = {}) {
  const out = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, ...opts }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, font: FONT, ...opts }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: MONO, color: 'B4235A', ...opts }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, ...opts }));
  return out;
}

function table(rows, width) {
  const cells = rows.map(r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  const n = cells[0].length;
  // 열 너비: 글자 길이 비례 (최소 비율 보장)
  // 한글은 영문보다 넓게 계산, 끊기면 안 되는 가장 긴 단어(테이블명 등)는 최소 너비로 보장
  const vis = t => [...t.replace(/[*`]/g, '')].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e80 ? 1.8 : 1), 0);
  const lens = Array.from({ length: n }, (_, i) => Math.max(...cells.map(r => vis(r[i] || '')), 4));
  const minW = Array.from({ length: n }, (_, i) => Math.min(Math.max(...cells.map(r =>
    Math.max(...(r[i] || '').replace(/[*`]/g, '').split(/\s+/).map(w => vis(w))))) * 110 + 220, width * 0.45));
  const tot = lens.reduce((a, b) => a + b, 0);
  let widths = lens.map((l, i) => Math.max(Math.round(width * l / tot), minW[i], 800));
  const s = widths.reduce((a, b) => a + b, 0);
  widths = widths.map(w => Math.round(w * width / s));
  widths[n - 1] += width - widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'BBBBBB' };
  return new Table({
    width: { size: width, type: WidthType.DXA },
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    rows: cells.map((r, ri) => new TableRow({
      tableHeader: ri === 0,
      cantSplit: true,
      children: r.map((c, ci) => new TableCell({
        width: { size: widths[ci], type: WidthType.DXA },
        shading: ri === 0 ? { type: ShadingType.CLEAR, fill: 'EEECFF', color: 'auto' } : undefined,
        borders: { top: border, bottom: border, left: border, right: border },
        margins: { top: 50, bottom: 50, left: 90, right: 90 },
        children: [new Paragraph({ children: runs(c, { size: 18, bold: ri === 0 ? true : undefined }) })],
      })),
    })),
  });
}

let listInstance = 0;
function build(lines, width) {
  const out = [];
  let prevNum = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    let m;
    if (!/^\d+\. /.test(line)) prevNum = false;
    if ((m = line.match(/^(#{1,3}) (.*)/))) {
      const lvl = [HeadingLevel.TITLE, HeadingLevel.HEADING_1, HeadingLevel.HEADING_2][m[1].length - 1];
      out.push(new Paragraph({ heading: lvl, children: runs(m[2]) }));
    } else if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (!/^\|[-| :]+\|$/.test(lines[i])) rows.push(lines[i]);
        i++;
      }
      i--;
      out.push(table(rows, width));
      out.push(new Paragraph({ spacing: { after: 60 }, children: [] }));
    } else if (line.startsWith('```')) {
      const code = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      code.forEach((c, k) => out.push(new Paragraph({
        shading: { type: ShadingType.CLEAR, fill: 'F4F4F6', color: 'auto' },
        spacing: { before: k === 0 ? 60 : 0, after: k === code.length - 1 ? 120 : 0 },
        indent: { left: 120 },
        children: [new TextRun({ text: c || ' ', font: MONO, size: 17 })],
      })));
    } else if ((m = line.match(/^!\[[^\]]*\]\(([^)]+)\)/))) {
      const buf = fs.readFileSync(path.join(DIR, m[1]));
      const pxW = buf.readUInt32BE(16), pxH = buf.readUInt32BE(20);   // PNG IHDR
      const w = Math.round(width / 1440 * 96);
      out.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({ type: 'png', data: buf, transformation: { width: w, height: Math.round(w * pxH / pxW) },
          altText: { title: 'ERD', description: 'Studio Nx ERD', name: 'ERD' } })],
      }));
    } else if ((m = line.match(/^(\d+)\. (.*)/))) {
      if (!prevNum) listInstance++;   // 새 번호 목록은 1부터 다시 시작
      out.push(new Paragraph({ numbering: { reference: 'num', level: 0, instance: listInstance }, children: runs(m[2]) }));
      prevNum = true;
      continue;
    } else if ((m = line.match(/^- (.*)/))) {
      out.push(new Paragraph({ numbering: { reference: 'bullet', level: 0 }, children: runs(m[1]) }));
    } else {
      out.push(new Paragraph({ children: runs(line) }));
    }
  }
  return out;
}

// "## 4. ERD" 구간만 가로 페이지
const lines = md.split('\n');
const erdStart = lines.findIndex(l => l.startsWith('## 4. ERD'));
const erdEnd = lines.findIndex((l, k) => k > erdStart && l.startsWith('## '));
const parts = [
  { lines: lines.slice(0, erdStart), landscape: false },
  { lines: lines.slice(erdStart, erdEnd), landscape: true },
  { lines: lines.slice(erdEnd), landscape: false },
];

const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: '888888' })] })] });
const header = new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
  children: [new TextRun({ text: 'Studio Nx — DB 스크립트 가이드', font: FONT, size: 16, color: '888888' })] })] });

const doc = new Document({
  creator: 'Studio Nx',
  title: 'Studio Nx DB 스크립트 가이드',
  styles: {
    default: { document: { run: { font: FONT, size: 20 }, paragraph: { spacing: { after: 80, line: 300 } } } },
    paragraphStyles: [
      { id: 'Title', name: 'Title', basedOn: 'Normal', run: { size: 40, bold: true, color: '2A2280', font: FONT },
        paragraph: { spacing: { after: 240 } } },
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 28, bold: true, color: '2A2280', font: FONT },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 0, keepNext: true,
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 2 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 23, bold: true, color: '333333', font: FONT },
        paragraph: { spacing: { before: 200, after: 80 }, outlineLevel: 1, keepNext: true } },
    ],
  },
  numbering: {
    config: [
      { reference: 'bullet', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 500, hanging: 260 } } } }] },
      { reference: 'num', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 500, hanging: 300 } } } }] },
    ],
  },
  sections: parts.map(p => ({
    properties: {
      page: p.landscape
        ? { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 851, bottom: 851, left: 851, right: 851 } }
        : { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } },
    },
    headers: { default: header },
    footers: { default: footer },
    children: build(p.lines, p.landscape ? LANDSCAPE_W : PORTRAIT_W),
  })),
});

Packer.toBuffer(doc).then(b => {
  fs.writeFileSync(path.join(DIR, 'StudioNx_DB_Guide.docx'), b);
  console.log('StudioNx_DB_Guide.docx', b.length, 'bytes');
});

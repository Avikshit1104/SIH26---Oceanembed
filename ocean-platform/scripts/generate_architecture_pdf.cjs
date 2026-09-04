const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'docs', 'FRONTEND_BACKEND_ARCHITECTURE.md'), 'utf8');
const output = path.join(root, 'docs', 'FRONTEND_BACKEND_ARCHITECTURE.pdf');
const lines = [];

for (const raw of source.split(/\r?\n/)) {
  const line = raw.replace(/^#+\s*/, '').replace(/^[-*]\s+/, '  • ').replace(/^\d+\.\s+/, '  $&');
  if (line.startsWith('```')) continue;
  if (!line.trim()) lines.push('');
  else {
    const width = line.startsWith('  •') || line.startsWith('  1.') ? 92 : 105;
    for (let i = 0; i < line.length; i += width) lines.push(line.slice(i, i + width));
  }
}

const pages = [];
const perPage = 48;
for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));

const objects = [];
const add = value => { objects.push(value); return objects.length; };
const catalog = add('');
const pagesObject = add('');
const font = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
const pageIds = [];

for (const pageLines of pages) {
  const content = ['BT', '/F1 9 Tf', '18 800 Td', '0 -14 Td'];
  pageLines.forEach((line, index) => {
    if (index === 0) content.push('/F1 14 Tf', `(${escapePdf(line)}) Tj`, '/F1 9 Tf', '0 -22 Td');
    else content.push(`(${escapePdf(line)}) Tj`, '0 -14 Td');
  });
  content.push('ET');
  const stream = content.join('\n');
  const contentId = add(`<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`);
  pageIds.push(add(`<< /Type /Page /Parent ${pagesObject} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${contentId} 0 R >>`));
}

objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObject} 0 R >>`;
objects[pagesObject - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

let pdf = '%PDF-1.4\n';
const offsets = [0];
objects.forEach((object, index) => {
  offsets.push(Buffer.byteLength(pdf, 'ascii'));
  pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
});
const xref = Buffer.byteLength(pdf, 'ascii');
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
fs.writeFileSync(output, pdf, 'ascii');
console.log(output);

function escapePdf(value) {
  return value.replace(/[^\x20-\x7E]/g, '?').replace(/[\\()]/g, '\\$&');
}
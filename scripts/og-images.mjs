// Рисует картинку-превью 1200×630 для каждой статьи (Telegram, WhatsApp, VK и т.д.).
// Запуск после `hugo`: node scripts/og-images.mjs public
// Hugo кладёт задания в public/og/<имя>.json, скрипт создаёт public/og/<имя>.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';
import { Resvg } from '@resvg/resvg-js';

const OUT = process.argv[2] || 'public';
const DIR = path.join(OUT, 'og');
const FONTS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fonts');
const F = {
  serif: path.join(FONTS, 'PT_Serif-Web-Bold.ttf'),
  sans: path.join(FONTS, 'PT_Sans-Web-Regular.ttf'),
  sansBold: path.join(FONTS, 'PT_Sans-Web-Bold.ttf'),
};
if (!fs.existsSync(DIR)) { console.log('Превью: заданий нет.'); process.exit(0); }
const serif = opentype.loadSync(F.serif);

const W = 1200, H = 630, PADX = 96, MAXW = W - PADX * 2;
const C = { bg: '#f6f3ec', ink: '#1d211f', muted: '#5d645f', accent: '#a8261b', soft: '#f4e0db' };
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function wrap(text, size, maxLines) {
  const words = text.split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (serif.getAdvanceWidth(t, size) <= MAXW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const cut = lines.slice(0, maxLines);
    let last = cut[maxLines - 1];
    while (serif.getAdvanceWidth(last + '…', size) > MAXW) last = last.replace(/\s*\S+$/, '');
    cut[maxLines - 1] = last.replace(/[,:;.\s—-]+$/, '') + '…';
    return cut;
  }
  return lines;
}

let n = 0;
for (const file of fs.readdirSync(DIR).filter(f => f.endsWith('.json'))) {
  const job = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  // Подбираем размер заголовка, чтобы он поместился в 4 строки
  let size = 72, lines;
  for (; size >= 46; size -= 2) { lines = wrap(job.title, size, 99); if (lines.length <= 4) break; }
  lines = wrap(job.title, size, 4);
  const lh = Math.round(size * 1.12);
  const blockH = lines.length * lh;
  const top = 150 + Math.max(0, (330 - blockH) / 2);
  const titleSvg = lines.map((l, i) => `<text x="${PADX}" y="${top + size + i * lh}" font-family="PT Serif" font-weight="700" font-size="${size}" fill="${C.ink}">${esc(l)}</text>`).join('');
  const tags = (job.tags || []).slice(0, 4);
  let tx = PADX;
  const tagSvg = tags.map(t => {
    const label = '#' + t;
    const w = Math.round(label.length * 13.5 + 32);
    const s = `<rect x="${tx}" y="528" width="${w}" height="44" rx="22" fill="${C.soft}"/><text x="${tx + w / 2}" y="557" text-anchor="middle" font-family="PT Sans" font-size="24" fill="${C.accent}">${esc(label)}</text>`;
    tx += w + 12; return s;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${C.bg}"/>
  <rect width="18" height="${H}" fill="${C.accent}"/>
  <rect x="${PADX}" y="64" width="56" height="56" rx="13" fill="${C.accent}"/>
  <path d="M${PADX + 19} ${64 + 14}v28M${PADX + 39} ${64 + 14} ${PADX + 21} ${64 + 28} ${PADX + 39} ${64 + 42}" stroke="#fffdf8" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <text x="${PADX + 76}" y="102" font-family="PT Sans" font-weight="700" font-size="30" fill="${C.ink}">${esc(job.site)}</text>
  <text x="${W - PADX}" y="102" text-anchor="end" font-family="PT Sans" font-size="26" fill="${C.muted}">${esc(job.date)} · ${job.minutes} мин чтения</text>
  ${titleSvg}
  ${tagSvg}
</svg>`;
  const png = new Resvg(svg, { font: { fontFiles: [F.serif, F.sans, F.sansBold], loadSystemFonts: false, defaultFontFamily: 'PT Sans' } }).render().asPng();
  fs.writeFileSync(path.join(DIR, file.replace(/\.json$/, '.png')), png);
  fs.unlinkSync(path.join(DIR, file));
  n++;
}
console.log(`Превью статей: ${n}`);

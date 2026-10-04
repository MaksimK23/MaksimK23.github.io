// Превращает формулы в PNG-картинки для Telegram Instant View.
// Запуск после `hugo`: node scripts/math-png.mjs public
// Hugo кладёт задания в public/math/<id>.json, скрипт рисует public/math/<id>.png
// и подставляет реальные размеры картинок в HTML (метки MATHW<id> / MATHH<id>).
import fs from 'node:fs';
import path from 'node:path';
import MathJax from 'mathjax';
import { Resvg } from '@resvg/resvg-js';

const OUT = process.argv[2] || 'public';
const MATH_DIR = path.join(OUT, 'math');
const EX_PX = { inline: 9, display: 10 };  // 1ex в пикселях: размер формулы в Telegram
const SCALE = 3;                           // PNG в 3 раза чётче (для экранов с высокой плотностью)
const PAD_EX = { inline: 0.25, display: 0.8 };
const COLOR = '#1d211f';
// Отдельные формулы уже этой ширины показываются в Telegram в натуральном размере (как <pic>),
// более широкие — картинкой на всю ширину экрана (иначе не влезут на телефон).
const WIDE_PX = 320;

if (!fs.existsSync(MATH_DIR)) { console.log('Формул нет — пропускаю.'); process.exit(0); }

await MathJax.init({
  loader: { load: ['input/tex', 'output/svg'] },
  startup: { typeset: false },
  svg: { fontCache: 'none' },
});

const sizes = {};
for (const file of fs.readdirSync(MATH_DIR).filter(f => f.endsWith('.json'))) {
  const id = file.slice(0, -5);
  const { tex, display } = JSON.parse(fs.readFileSync(path.join(MATH_DIR, file), 'utf8'));
  const kind = display ? 'display' : 'inline';
  try {
    const node = doc.convert(tex, { display });
    let svg = adaptor.innerHTML(node);
    const w = parseFloat(svg.match(/width="([\d.]+)ex"/)[1]);
    const h = parseFloat(svg.match(/height="([\d.]+)ex"/)[1]);
    const [vx, vy, vw, vh] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
    // Поля вокруг формулы (в единицах viewBox: 1ex ≈ vw / w)
    const unit = vw / w, pad = PAD_EX[kind];
    const nvb = [vx - pad * unit, vy - pad * unit, vw + 2 * pad * unit, vh + 2 * pad * unit].join(' ');
    const W = Math.round((w + 2 * pad) * EX_PX[kind]);
    const H = Math.round((h + 2 * pad) * EX_PX[kind]);
    svg = svg
      .replace(/viewBox="[^"]+"/, `viewBox="${nvb}"`)
      .replace(/width="[\d.]+ex"/, `width="${W}"`)
      .replace(/height="[\d.]+ex"/, `height="${H}"`)
      .replace(/style="[^"]*"/, '')
      .replaceAll('currentColor', COLOR);
    if (!svg.includes('xmlns=')) svg = svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    // Белый фон: формулы читаются и в светлой, и в тёмной теме Telegram
    const png = new Resvg(svg, {
      fitTo: { mode: 'width', value: W * SCALE },
      background: '#ffffff',
      font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Serif' },
    }).render().asPng();
    fs.writeFileSync(path.join(MATH_DIR, id + '.png'), png);
    sizes[id] = { W, H, K: display && W > WIDE_PX ? 'math-wide' : 'math-pic' };
  } catch (e) {
    console.error(`Ошибка в формуле ${id}: ${tex}\n  ${e.message}`);
  }
  fs.unlinkSync(path.join(MATH_DIR, file));
}

// Подставляем размеры в HTML
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.join(d, e.name)] : []);
let patched = 0;
for (const f of walk(OUT)) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('MATHW')) continue;
  const out = src.replace(/MATH([WHK])([0-9a-f]{16})/g, (m, k, id) => {
    const s = sizes[id];
    if (k === 'K') return s ? s.K : 'math-wide';
    return s ? String(k === 'W' ? s.W : s.H) : '0';
  });
  fs.writeFileSync(f, out); patched++;
}
console.log(`Формул: ${Object.keys(sizes).length}, страниц обновлено: ${patched}`);
MathJax.done();

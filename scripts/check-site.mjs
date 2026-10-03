#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'public');
const errors = [];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function cleanUrl(raw) {
  if (!raw || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:)/i.test(raw)) return null;
  const noHash = raw.split('#')[0].split('?')[0];
  if (!noHash) return null;
  return decodeURIComponent(noHash);
}

function targetFile(urlPath) {
  let rel = urlPath.replace(/^\/+/, '');
  if (!rel) return path.join(ROOT, 'index.html');
  if (rel.endsWith('/')) rel += 'index.html';
  if (!path.extname(rel)) rel += '.html';
  return path.join(ROOT, rel);
}

function targetFromImage(urlPath) {
  return path.join(ROOT, urlPath.replace(/^\/+/, ''));
}

const htmlFiles = walk(ROOT).filter(p => p.endsWith('.html'));
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map(m => m[1]));
  const anchors = new Set([...html.matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)].map(m => m[1]));
  for (const href of anchors) {
    if (href.startsWith('#')) {
      if (href.length > 1 && !ids.has(decodeURIComponent(href.slice(1)))) {
        errors.push(`${path.relative(ROOT, file)}: missing anchor ${href}`);
      }
      continue;
    }
    const clean = cleanUrl(href);
    if (clean === null) continue;
    if (clean.startsWith('/')) {
      const target = targetFile(clean);
      if (!fs.existsSync(target)) errors.push(`${path.relative(ROOT, file)}: missing local link ${href}`);
    }
  }

  for (const m of html.matchAll(/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)) {
    const clean = cleanUrl(m[1]);
    if (clean === null || !clean.startsWith('/')) continue;
    const target = targetFromImage(clean);
    if (!fs.existsSync(target)) errors.push(`${path.relative(ROOT, file)}: missing image ${m[1]}`);
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`Проверено HTML-страниц: ${htmlFiles.length}. Локальные ссылки, якоря и изображения: OK.`);

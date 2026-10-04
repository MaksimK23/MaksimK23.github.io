#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || 'content/articles');
const errors = [];
const seenSlugs = new Map();
const seenTitles = new Map();

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(file));
    else if (entry.isFile() && /\.md$/i.test(entry.name)) out.push(file);
  }
  return out;
}

function frontMatter(file) {
  const text = fs.readFileSync(file, 'utf8');
  const match = text.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  return match ? match[1] : null;
}

function scalar(front, key) {
  const match = front.match(new RegExp('^' + key + ':\\s*(.*)$', 'm'));
  if (!match) return null;
  const value = match[1].trim();
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1).trim();
  }
  return value;
}

function parseTags(front) {
  const value = scalar(front, 'tags');
  if (!value) return [];
  if (!value.startsWith('[') || !value.endsWith(']')) return null;
  const body = value.slice(1, -1).trim();
  if (!body) return [];
  return body
    .split(',')
    .map(item => item.trim().replace(/^['"]|['"]$/g, '').trim())
    .filter(Boolean);
}

const files = walk(ROOT);
if (!files.length) {
  console.error(`Не найдено Markdown-файлов в ${ROOT}`);
  process.exit(1);
}

for (const file of files) {
  const rel = path.relative(process.cwd(), file);
  const front = frontMatter(file);

  if (front === null) {
    errors.push(`${rel}: отсутствует YAML front matter`);
    continue;
  }

  const title = scalar(front, 'title');
  const date = scalar(front, 'date');
  const description = scalar(front, 'description');
  const slug = scalar(front, 'slug');
  const tags = parseTags(front);

  if (!title) errors.push(`${rel}: отсутствует непустое поле title`);

  if (!date) {
    errors.push(`${rel}: отсутствует поле date`);
  } else if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(date) || Number.isNaN(Date.parse(date))) {
    errors.push(`${rel}: date должен быть ISO-8601 с часовым поясом, получено: ${date}`);
  }

  if (!description) errors.push(`${rel}: отсутствует непустое поле description`);

  if (tags === null) {
    errors.push(`${rel}: tags должен быть YAML-массивом в формате ["tag1", "tag2"]`);
  } else if (!tags.length) {
    errors.push(`${rel}: tags не должен быть пустым`);
  }

  const draft = scalar(front, 'draft');
  if (draft !== null && !/^(true|false)$/.test(draft)) {
    errors.push(`${rel}: draft должен быть true или false`);
  }

  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push(`${rel}: slug должен содержать только a-z, 0-9 и дефисы: ${slug}`);
  }

  const effectiveSlug = slug || path.basename(file, '.md');
  const previousSlug = seenSlugs.get(effectiveSlug);
  if (previousSlug) {
    errors.push(`${rel}: дублирующийся slug "${effectiveSlug}" (также: ${previousSlug})`);
  } else {
    seenSlugs.set(effectiveSlug, rel);
  }

  if (title) {
    const previousTitle = seenTitles.get(title);
    if (previousTitle) {
      console.warn(`Предупреждение: ${rel}: дублирующийся title "${title}" (также: ${previousTitle})`);
    } else {
      seenTitles.set(title, rel);
    }
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Проверено статей: ${files.length}. Front matter, даты, tags, draft и slug: OK.`);

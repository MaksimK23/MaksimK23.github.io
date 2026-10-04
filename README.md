# Красный Кабан

Статический сайт статей на Hugo с Markdown-контентом, собственными шаблонами и JavaScript. Публикация выполняется через GitHub Pages.

Сайт: https://maksimk23.github.io/

## Что здесь есть

- статьи в Markdown в `content/articles/`;
- Hugo-шаблоны в `layouts/`;
- CSS и браузерный JavaScript в `assets/`;
- изображения и статические файлы в `static/`;
- LaTeX-формулы с последующей генерацией PNG для Telegram Instant View;
- OG-изображения для статей;
- Pagefind для поиска;
- RSS и sitemap;
- светлая/тёмная тема и адаптивный интерфейс;
- PR-preview для проверки изменений до merge.

## Структура проекта

```text
.
├── .github/workflows/
│   ├── hugo.yml          # production build + публикация на gh-pages
│   └── preview.yml       # сборка и preview для pull request
├── assets/
│   ├── css/              # стили сайта
│   └── js/
│       ├── main.js       # небольшой bootstrap
│       ├── site.js       # общесайтовый интерфейс
│       └── article.js    # логика страницы статьи
├── content/
│   ├── _index.md         # содержимое главной страницы
│   └── articles/         # статьи
├── layouts/
│   ├── _default/         # базовые шаблоны страниц
│   └── partials/         # переиспользуемые части шаблонов
├── scripts/
│   ├── math-png.mjs      # LaTeX → SVG → PNG
│   ├── og-images.mjs     # генерация OG-картинок
│   ├── check-site.mjs    # проверка ссылок, якорей и изображений
│   └── validate-content.mjs # проверка front matter
├── static/               # файлы, копируемые Hugo как есть
├── hugo.toml             # конфигурация сайта
├── package.json           # npm-скрипты и генераторы
└── package-lock.json      # зафиксированные версии npm-зависимостей
```

Hugo использует `content` для содержимого, `layouts` для шаблонов, `assets` для ресурсов asset pipeline и `static` для файлов, которые копируются в итоговый сайт. Каталоги `public/` и `resources/` являются генерируемыми и не нужны в исходниках проекта. citeturn0search2

## Добавление статьи

Создайте файл в `content/articles/`, например:

```text
content/articles/moya-statya.md
```

Минимальный front matter:

```yaml
---
title: "Название статьи"
date: 2026-10-04T12:00:00+02:00
description: "Краткое описание статьи."
tags: ["энергетика", "ветер"]
---
```

### Правила front matter

CI проверяет:

- наличие `title`, `date`, `description` и `tags`;
- ISO-8601 дату с часовым поясом;
- непустой массив `tags`;
- `draft`, если указан, должен быть `true` или `false`;
- `slug`, если указан, должен быть в формате `latin-lowercase-with-hyphens`;
- отсутствие двух опубликованных страниц с одинаковым эффективным slug.

Одинаковые заголовки сейчас только предупреждают CI, а не блокируют сборку.

### URL статьи

Обычно имя файла определяет URL:

```text
content/articles/moya-statya.md
→ /articles/moya-statya/
```

Не переименовывайте опубликованный файл без необходимости: URL — часть внешних ссылок. Если URL действительно нужно изменить, сначала проверьте необходимость alias/redirect.

## Изображения

Изображения, которые должны попасть в итоговый сайт как статические файлы, кладутся в `static/images/`.

В Markdown:

```markdown
![Описание изображения](/images/example.jpg)
```

Для обложки статьи:

```yaml
image: "images/example.jpg"
image_alt: "Описание изображения"
```

Если `image_alt` не указан, шаблон использует заголовок статьи как запасной alt-текст.

## Формулы

В статьях поддерживаются LaTeX:

```markdown
В строке: $E = mc^2$

Блок:

$$
E = mc^2
$$
```

Hugo сначала создаёт задания формул в `public/math/`. Затем `npm run math -- public` преобразует их в PNG.

Генератор использует MathJax 4.1.2 и асинхронный API `tex2svgPromise()`. Это отдельный build-time шаг; MathJax не загружается браузером посетителя.

## Локальная разработка

Нужны:

- Hugo Extended 0.167.0;
- Node.js 20;
- npm.

Установка зависимостей:

```bash
npm ci
```

Запуск Hugo с live reload:

```bash
hugo server
```

Для полного production-подобного build:

```bash
hugo --gc --minify --printPathWarnings --baseURL "https://maksimk23.github.io/"
npm run math -- public
node scripts/og-images.mjs public
npm run pagefind
npm run check-site
```

Проверка контента отдельно:

```bash
npm run validate-content
```

## npm-скрипты

| Команда | Назначение |
|---|---|
| `npm run math -- public` | генерация PNG формул |
| `npm run og -- public` | генерация OG-изображений |
| `npm run pagefind` | создание поискового индекса |
| `npm run check-site` | проверка локальных ссылок, anchors и изображений |
| `npm run validate-content` | проверка front matter статей |

## Как работает CI

### Production

Workflow `.github/workflows/hugo.yml` запускается при push в `main` или вручную.

Последовательность:

1. устанавливается Hugo Extended;
2. проверяется SHA-256 скачанного Hugo;
3. устанавливаются npm-зависимости через `npm ci`;
4. проверяется front matter;
5. выполняется Hugo build;
6. генерируются PNG формул;
7. генерируются OG-картинки;
8. строится Pagefind;
9. проверяются ссылки, anchors и изображения;
10. проверяются обязательные файлы итоговой сборки;
11. production публикуется в `gh-pages`.

Production deploy выполняется только для push в `main`.

### Pull requests

Для каждого PR в `main` workflow `preview.yml` сначала собирает сайт с отдельным base URL, выполняет те же проверки и сохраняет результат как artifact.

Публикация preview выполняется отдельным job с write permissions. Build job имеет только `contents: read`.

Это разделяет недоверенный код PR и операции записи в ветку публикации.

После закрытия PR его preview удаляется.

## Что проверять перед merge

Обычный порядок:

1. изменить код или статью;
2. убедиться, что front matter корректен;
3. локально запустить `hugo server`, если менялась разметка или стили;
4. открыть PR;
5. дождаться зелёного CI;
6. проверить PR preview для визуальных изменений;
7. только после этого merge в `main`.

Для изменений интерфейса особенно полезно вручную проверить:

- мобильную и desktop-ширину;
- светлую и тёмную тему;
- клавиатурную навигацию;
- оглавление;
- изображения и видео;
- фильтры статей;
- мини-плеер YouTube на странице статьи.

## Архитектура JavaScript

Точка входа — `assets/js/main.js`. Hugo собирает её через `js.Build`.

Она только запускает общесайтовую и article-specific инициализацию:

```text
main.js
├── site.js
└── article.js
```

`site.js` содержит тему, фильтры, навигацию и другие общесайтовые функции.

`article.js` содержит поведение страницы статьи: оглавление, кодовые блоки, sharing, YouTube и другие article-specific interactions.

При добавлении новой логики сначала определите, относится ли она ко всему сайту или только к статье. Не возвращайте большой монолитный `main.js`.

## GitHub Pages и домен

Сейчас сайт работает на:

```text
https://maksimk23.github.io/
```

Для custom domain его нужно указать в **Repository → Settings → Pages → Custom domain**, а DNS настроить у регистратора. GitHub рекомендует сначала верифицировать домен; для apex-домена используются A/AAAA либо ALIAS/ANAME, а для поддомена — CNAME. citeturn0search0turn0search4

Важно: этот проект публикуется через GitHub Actions. При таком способе публикации GitHub не требует `CNAME` файла в исходном репозитории; custom domain настраивается в Pages settings. citeturn0search0turn0search7

При переходе на новый домен также нужно обновить `baseURL` в `hugo.toml` и проверить абсолютные URL в SEO/OG/RSS.

## Принципы изменений

- Сначала маленький изолированный PR, затем следующий.
- Не менять рабочую архитектуру без необходимости.
- Не добавлять зависимости без конкретной причины.
- Для npm всегда коммитить `package-lock.json`.
- Build-time генераторы не должны требовать браузера.
- PR build не должен иметь write permissions, если они не нужны.
- Не использовать `pull_request_target` для сборки непроверенного кода PR.
- После инфраструктурных изменений проверять production build через CI.

## Лицензия и материалы

Перед публикацией чужого текста, изображения или другого материала проверьте права на его использование. Для собственного контента рекомендуется явно определить лицензию проекта и отдельно указать условия для сторонних материалов.

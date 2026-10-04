# Разработка

Этот документ описывает рабочий процесс для изменений сайта. README содержит краткую версию этих правил.

## 1. Быстрый цикл

```bash
npm ci
hugo server
```

Для проверки production-подобной сборки:

```bash
hugo --gc --minify --printPathWarnings --baseURL "https://maksimk23.github.io/"
npm run math -- public
npm run og -- public
npm run pagefind
npm run check-site
npm run validate-content
```

## 2. Где менять код

### Контент

- `content/articles/*.md` — статьи.
- `content/_index.md` — главная страница.
- Front matter проверяется `scripts/validate-content.mjs`.

### Шаблоны

- `layouts/_default/baseof.html` — базовый HTML-документ.
- `layouts/_default/single.html` — статья.
- `layouts/index.html` — главная.
- `layouts/partials/` — повторно используемые фрагменты.

### CSS

CSS находится в `assets/css/` и проходит через Hugo Pipes.

### JavaScript

Входная точка:

```text
assets/js/main.js
```

Модули:

```text
main.js
├── site.js
└── article.js
```

Общесайтовую логику держите в `site.js`, article-specific логику — в `article.js`.

### Build-time scripts

`scripts/` содержит Node.js-скрипты, которые запускаются после Hugo build:

- `math-png.mjs` — преобразование LaTeX в PNG;
- `og-images.mjs` — генерация Open Graph images;
- `check-site.mjs` — проверка локальных ссылок, anchors и изображений;
- `validate-content.mjs` — проверка article front matter.

## 3. Формулы

Формулы не генерируются браузером.

Поток:

```text
Markdown
   ↓
Hugo
   ↓
public/math/*.json
   ↓
MathJax 4
   ↓
SVG
   ↓
resvg
   ↓
public/math/*.png
```

После генерации скрипт заменяет служебные размеры в HTML на реальные значения.

Зависимость MathJax зафиксирована в `package.json` и `package-lock.json`. Не обновляйте её механически: генератор использует серверный API MathJax и должен проверяться реальной CI-сборкой.

## 4. CI

### Production

`.github/workflows/hugo.yml` запускается для `main`.

Только production job имеет права, необходимые для публикации. Build выполняется с проверкой контента и итогового сайта.

### Preview

`.github/workflows/preview.yml` запускается для PR.

Архитектура намеренно разделена:

```text
PR code
  ↓
build-preview (contents: read)
  ↓
artifact
  ↓
publish-preview (write permissions)
  ↓
gh-pages/pr-preview/
```

Build job не должен получать write permissions только ради публикации preview.

Не переносите сборку непроверенного PR-кода в `pull_request_target`.

## 5. Изменение зависимостей

При изменении `package.json`:

```bash
npm install
```

после чего обязательно коммитится обновлённый `package-lock.json`.

Перед merge необходимо дождаться успешного `npm ci` в GitHub Actions. Это особенно важно для native packages и генераторов изображений.

## 6. Изменение URL

URL опубликованных статей считаются стабильными.

Если статья действительно переезжает:

1. определить старый URL;
2. определить новый URL;
3. проверить внешние ссылки;
4. добавить Hugo alias только при реальной необходимости;
5. прогнать `npm run check-site`.

Не добавляйте aliases «на всякий случай» и не перенаправляйте удалённую статью на тематически похожую страницу без доказанной связи.

## 7. Accessibility

Для интерактивных элементов:

- используйте настоящий `button` или `a`, а не `div` с click handler;
- сохраняйте видимый focus;
- синхронизируйте состояние с `aria-pressed`, `aria-expanded`, `aria-current`, когда это применимо;
- модальные/выезжающие элементы должны иметь понятный focus management;
- Escape должен закрывать открываемые панели, если это ожидаемое поведение.

После изменений UI проверяйте клавиатурную навигацию вручную.

## 8. Performance

Не добавляйте lazy-loading для первого изображения статьи или других ресурсов, необходимых above the fold.

Тяжёлые внешние ресурсы, особенно YouTube, по возможности загружаются только после действия пользователя.

Перед оптимизацией измеряйте проблему. Не усложняйте код ради теоретического выигрыша.

## 9. Pull request

Рекомендуемый формат:

```text
audit: ...
perf: ...
security: ...
refactor: ...
docs: ...
fix: ...
```

Один PR должен иметь одну основную цель.

Перед merge:

- CI зелёный;
- preview проверен, если менялся UI;
- нет случайных generated files;
- lockfile соответствует `package.json`;
- описание PR отражает фактические изменения.

## 10. Generated files

Не коммитьте:

- `public/`;
- `resources/_gen/`;
- локальные npm caches;
- временные файлы генераторов.

Они создаются CI или локальной сборкой.

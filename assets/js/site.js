export function initSite() {
  // Тема
  var toggle = document.getElementById('theme-toggle');
  function syncThemeState() {
    if (toggle) toggle.setAttribute('aria-pressed', root.getAttribute('data-theme') === 'dark' ? 'true' : 'false');
  }
  syncThemeState();
  if (toggle) toggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    syncThemeState();
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

  // Поделиться
  document.querySelectorAll('.share').forEach(function (box) {
    var url = box.dataset.url || location.href, title = box.dataset.title || document.title;
    var shareBtn = box.querySelector('[data-share]'), copyBtn = box.querySelector('[data-copy]');
    if (shareBtn) {
      shareBtn.addEventListener('click', function () {
        if (navigator.share) {
          navigator.share({ title: title, url: url }).catch(function (err) {
            // Если пользователь отменил диалог вручную — не шумим
            if (err && err.name === 'AbortError') return;
            // Если возникла системная ошибка WebView или браузер заблокировал вызов — копируем ссылку
            copy(url).then(function () { notify('Ссылка скопирована'); });
          });
        } else {
          // Если navigator.share не поддерживается в текущем окружении
          copy(url).then(function () { notify('Ссылка скопирована'); });
        }
      });
    }
    if (copyBtn) copyBtn.addEventListener('click', function () {
      copy(url).then(function () { notify('Ссылка скопирована'); });
    });
  });

  // Таблицы с прокруткой на телефоне
  document.querySelectorAll('.prose table').forEach(function (t) {
    var w = document.createElement('div'); w.className = 'table-wrap';
    t.parentNode.insertBefore(w, t); w.appendChild(t);
  });

  // Кнопка «Копировать» у блоков кода
  document.querySelectorAll('.prose pre').forEach(function (pre) {
    var b = document.createElement('button'); b.type = 'button'; b.className = 'copy-code'; b.textContent = 'Копировать';
    b.addEventListener('click', function () {
      var code = pre.querySelector('code');
      copy((code || pre).innerText).then(function () { b.textContent = 'Скопировано'; setTimeout(function () { b.textContent = 'Копировать'; }, 1500); });
    });
    var box = pre.closest('.highlight') || pre;
    box.classList.add('code-box');
    box.appendChild(b);
  });

  /* ═════════ Размер текста ═════════ */
  document.querySelectorAll('[data-fs]').forEach(function (b) {
    if (b.tagName !== 'BUTTON') return;
    b.addEventListener('click', function () {
      var cur = parseInt(root.getAttribute('data-fs') || '0', 10);
      var next = Math.max(-1, Math.min(2, cur + parseInt(b.dataset.fs, 10)));
      if (next === 0) root.removeAttribute('data-fs'); else root.setAttribute('data-fs', String(next));
      try { localStorage.setItem('fs', String(next)); } catch (e) {}
      notify('Размер текста: ' + ['меньше', 'обычный', 'крупнее', 'крупный'][next + 1]);
    });
  });

  /* ═════════ Главная: фильтр по темам ═════════ */
  document.querySelectorAll('.chips').forEach(function (box) {
    var cards = document.querySelectorAll('.list .card[data-tags]');
    box.addEventListener('click', function (e) {
      var b = e.target.closest('.chip'); if (!b) return;
      box.querySelectorAll('.chip').forEach(function (c) {
        var active = c === b;
        c.classList.toggle('is-active', active);
        c.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      var f = b.dataset.filter;
      cards.forEach(function (c) { c.hidden = !!f && c.dataset.tags.split('|').indexOf(f) < 0; });
    });
  });
}

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function scrollOptions(block) { return { behavior: reduceMotion.matches ? 'auto' : 'smooth', block: block || 'nearest' }; }

  // Всплывающее уведомление
  var toast;
  function notify(msg) {
    if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; toast.setAttribute('role', 'status'); document.body.appendChild(toast); }
    toast.textContent = msg; toast.classList.add('show');
    clearTimeout(notify.t); notify.t = setTimeout(function () { toast.classList.remove('show'); }, 2000);
  }
  function copy(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    var ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    return Promise.resolve();
  }

export { notify, copy, scrollOptions };

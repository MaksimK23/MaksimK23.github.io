(function () {
  var root = document.documentElement;

  // Тема
  var toggle = document.getElementById('theme-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
  });

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

  // Поделиться
  document.querySelectorAll('.share').forEach(function (box) {
    var url = box.dataset.url || location.href, title = box.dataset.title || document.title;
    var shareBtn = box.querySelector('[data-share]'), copyBtn = box.querySelector('[data-copy]');
    if (shareBtn) {
      if (!navigator.share) shareBtn.hidden = true;
      shareBtn.addEventListener('click', function () { navigator.share({ title: title, url: url }).catch(function () {}); });
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
})();

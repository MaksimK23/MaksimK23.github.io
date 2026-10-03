(function () {
  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function scrollOptions(block) { return { behavior: reduceMotion.matches ? 'auto' : 'smooth', block: block || 'nearest' }; }

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
      box.querySelectorAll('.chip').forEach(function (c) { c.classList.toggle('is-active', c === b); });
      var f = b.dataset.filter;
      cards.forEach(function (c) { c.hidden = !!f && c.dataset.tags.split('|').indexOf(f) < 0; });
    });
  });

  var prose = document.querySelector('.prose');
  var article = document.querySelector('.article');
  if (!prose || !article) return;

  /* ═════════ Якоря у заголовков ═════════ */
  prose.querySelectorAll('.h-anchor').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var url = location.href.split('#')[0] + a.getAttribute('href');
      history.replaceState(null, '', a.getAttribute('href'));
      a.parentElement.scrollIntoView(scrollOptions());
      copy(url).then(function () { notify('Ссылка на раздел скопирована'); });
    });
  });

  /* ═════════ Время → секунды ═════════ */
  function toSec(t) {
    if (!t) return 0;
    if (/^\d+$/.test(t)) return +t;
    var m = String(t).match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
    return String(t).split(':').reduce(function (acc, x) { return acc * 60 + (+x || 0); }, 0);
  }

  /* ═════════ Видео: обложка → плеер, перемотка, мини-плеер ═════════ */
  var videos = {};   // id → { wrap, iframe, player, ready, queue }
  var apiPromise;
  function loadApi() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise(function (res) {
      if (window.YT && window.YT.Player) return res();
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); res(); };
      var s = document.createElement('script'); s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s);
    });
    return apiPromise;
  }
  function startVideo(v, sec, scroll) {
    if (scroll && !v.wrap.classList.contains('is-mini')) {
      var r = v.wrap.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight) v.wrap.parentElement.scrollIntoView(scrollOptions('center'));
    }
    if (v.player && v.ready) { v.player.seekTo(sec || 0, true); v.player.playVideo(); return; }
    if (v.loading) { v.pending = sec; return; }
    v.loading = true;
    var src = v.iframe.dataset.src.replace('www.youtube.com/', 'www.youtube-nocookie.com/') + '?enablejsapi=1&autoplay=1&rel=0&playsinline=1&origin=' + encodeURIComponent(location.origin) + (sec ? '&start=' + Math.floor(sec) : '');
    v.iframe.src = src;
    v.iframe.setAttribute('allow', (v.iframe.getAttribute('allow') || '') + '; autoplay');
    v.wrap.classList.add('is-loaded');
    loadApi().then(function () {
      v.player = new YT.Player(v.iframe, { events: {
        onReady: function () { v.ready = true; if (v.pending != null) { v.player.seekTo(v.pending, true); v.player.playVideo(); v.pending = null; } },
        onStateChange: function (e) { v.playing = e.data === 1 || e.data === 3; updateMini(); }
      } });
    });
  }
  var mainVideo = null;
  document.querySelectorAll('.video-wrap[data-yt]').forEach(function (wrap) {
    var v = { id: wrap.dataset.yt, wrap: wrap, iframe: wrap.querySelector('iframe'), slot: wrap.parentElement };
    videos[v.id] = v; if (!mainVideo) mainVideo = v;
    wrap.querySelector('.yt-facade').addEventListener('click', function () { startVideo(v, 0); });
    wrap.querySelector('[data-mini-close]').addEventListener('click', function () { v.miniOff = true; if (v.player && v.player.pauseVideo) v.player.pauseVideo(); updateMini(); });
    wrap.querySelector('[data-mini-back]').addEventListener('click', function () { v.slot.scrollIntoView(scrollOptions('center')); });
    new IntersectionObserver(function (en) { v.inView = en[0].isIntersecting; if (v.inView) v.miniOff = false; updateMini(); }, { threshold: 0.25 }).observe(v.slot);
  });
  function updateMini() {
    Object.keys(videos).forEach(function (k) {
      var v = videos[k];
      v.wrap.classList.toggle('is-mini', !!(v.playing && !v.inView && !v.miniOff));
    });
  }
  function ytInfo(href) {
    try {
      var u = new URL(href, location.href), id = null;
      if (/youtube\.com$/.test(u.hostname.replace(/^www\.|^m\./, ''))) id = u.searchParams.get('v');
      if (u.hostname === 'youtu.be') id = u.pathname.slice(1);
      if (!id) return null;
      return { id: id, t: toSec(u.searchParams.get('t') || u.searchParams.get('start') || (u.hash.match(/t=([^&]+)/) || [])[1]) };
    } catch (e) { return null; }
  }
  // Ссылки-таймкоды на встроенное видео перематывают плеер на странице
  prose.addEventListener('click', function (e) {
    var a = e.target.closest('a[href*="youtu"]');
    if (!a) return;
    var info = ytInfo(a.href);
    if (!info || !videos[info.id]) return;
    e.preventDefault();
    startVideo(videos[info.id], info.t, true);
  });

  /* ═════════ Цитаты из видео: карточки, таймкод, сворачивание ═════════ */
  prose.querySelectorAll('blockquote').forEach(function (bq) {
    var link = Array.prototype.find.call(bq.querySelectorAll('a'), function (a) { return /^\d{1,2}:\d{2}(:\d{2})?$/.test(a.textContent.trim()); });
    if (!link) return;
    bq.classList.add('quote-src');
    var prev = link.previousSibling, next = link.nextSibling;
    if (prev && prev.nodeType === 3) prev.textContent = prev.textContent.replace(/\s*\[\s*$/, '');
    if (next && next.nodeType === 3) next.textContent = next.textContent.replace(/^\s*\]/, '');
    var body = document.createElement('div'); body.className = 'quote-body';
    while (bq.firstChild) body.appendChild(bq.firstChild);
    var head = document.createElement('div'); head.className = 'quote-head';
    var label = document.createElement('span'); label.textContent = 'Цитата из видео'; head.appendChild(label);
    link.classList.add('quote-time'); link.setAttribute('aria-label', 'Смотреть с ' + link.textContent.trim());
    head.appendChild(link);
    bq.appendChild(head); bq.appendChild(body);
    if (body.textContent.length > 650) {
      bq.classList.add('is-clamped');
      var more = document.createElement('button'); more.type = 'button'; more.className = 'quote-more'; more.textContent = 'Показать полностью';
      more.addEventListener('click', function () {
        var c = bq.classList.toggle('is-clamped');
        more.textContent = c ? 'Показать полностью' : 'Свернуть';
      });
      bq.appendChild(more);
    }
  });

  /* ═════════ Заголовки «Блок N»: время → перемотка ═════════ */
  prose.querySelectorAll('.block-time[data-range]').forEach(function (el) {
    if (!mainVideo) return;
    var start = toSec(el.dataset.range.split(/[—–-]/)[0].trim());
    var b = document.createElement('button'); b.type = 'button'; b.className = 'block-time is-link'; b.textContent = el.textContent;
    b.title = 'Смотреть этот фрагмент видео';
    b.addEventListener('click', function () { startVideo(mainVideo, start, true); });
    el.replaceWith(b);
  });

  /* ═════════ Структурная карта: список «Блок N …» → ссылки на разделы ═════════ */
  prose.querySelectorAll('ol, ul').forEach(function (list) {
    var items = list.querySelectorAll(':scope > li');
    if (items.length < 3) return;
    var ok = Array.prototype.every.call(items, function (li) { return /^\s*Блок\s+\d+/.test(li.textContent); });
    if (!ok) return;
    list.classList.add('structure-map');
    items.forEach(function (li) {
      var m = li.textContent.trim().match(/^Блок\s+(\d+)\s*(?:\[([^\]]+)\])?\s*[:.—-]?\s*(.*)$/);
      if (!m) return;
      var h = prose.querySelector('.block-heading[data-block="' + m[1] + '"]');
      var a = document.createElement(h ? 'a' : 'div');
      if (h) a.href = '#' + h.id;
      var num = document.createElement('span'); num.className = 'sm-num'; num.textContent = 'Блок ' + m[1]; if (m[2]) { var time = document.createElement('span'); time.className = 'sm-time'; time.textContent = m[2]; num.appendChild(time); } var smTitle = document.createElement('span'); smTitle.className = 'sm-title'; smTitle.textContent = m[3]; a.appendChild(num); a.appendChild(smTitle);
      a.querySelector('.sm-title').textContent = m[3];
      li.innerHTML = ''; li.appendChild(a);
    });
  });

  /* ═════════ Оглавление: боковое + шторка на телефоне ═════════ */
  var heads = Array.prototype.slice.call(prose.querySelectorAll('h2[id], h3[id]'));
  var tocNodes = document.querySelectorAll('[data-toc]');
  var links = [];
  if (heads.length >= 3) {
    tocNodes.forEach(function (nav) {
      var rootOl = document.createElement('ol'), curLi = null, curSub = null;
      heads.forEach(function (h) {
        var li = document.createElement('li'), a = document.createElement('a');
        a.href = '#' + h.id;
        var num = h.querySelector('.block-num'), title = h.querySelector('.block-title');
        var text = (title ? title.textContent : h.textContent.replace(/#\s*$/, '')).trim();
        if (num) { var tocNum = document.createElement('span'); tocNum.className = 'toc-num'; tocNum.textContent = num.textContent; a.appendChild(tocNum); } var tocText = document.createElement('span'); tocText.className = 'toc-text'; a.appendChild(tocText);
        a.querySelector('.toc-text').textContent = text;
        a.dataset.target = h.id;
        li.appendChild(a);
        if (h.tagName === 'H2' || !curLi) { rootOl.appendChild(li); curLi = h.tagName === 'H2' ? li : null; curSub = null; }
        else { if (!curSub) { curSub = document.createElement('ol'); curLi.appendChild(curSub); } curSub.appendChild(li); }
        links.push(a);
      });
      nav.appendChild(rootOl);
    });
  } else {
    document.querySelectorAll('.toc-side, .toc-fab').forEach(function (el) { el.remove(); });
  }
  var sheet = document.querySelector('[data-toc-sheet]');
  function closeSheet() { if (sheet) sheet.hidden = true; }
  var fab = document.querySelector('[data-toc-open]');
  if (fab) fab.addEventListener('click', function () { sheet.hidden = false; var act = sheet.querySelector('a.is-active'); if (act) act.scrollIntoView({ block: 'center' }); });
  if (sheet) {
    sheet.addEventListener('click', function (e) { if (e.target === sheet || e.target.closest('[data-toc-close]') || e.target.closest('a')) closeSheet(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(); });
  }

  /* ═════════ Прогресс чтения, оставшееся время, активный раздел ═════════ */
  var bar = document.querySelector('.progress span');
  var leftEls = document.querySelectorAll('[data-time-left]');
  var data = {}; try { data = JSON.parse(document.getElementById('article-data').textContent); } catch (e) {}
  var total = data.minutes || 0;
  var ticking = false;
  function onScroll() {
    ticking = false;
    var r = prose.getBoundingClientRect();
    var span = r.height - innerHeight * 0.6;
    var p = Math.min(1, Math.max(0, (-r.top + innerHeight * 0.2) / span));
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    var left = Math.ceil(total * (1 - p));
    var txt = p >= 0.99 ? 'дочитано' : (p < 0.01 ? total + ' мин' : 'осталось ' + left + ' мин');
    var short = p >= 0.99 ? '✓' : left + ' мин';
    leftEls.forEach(function (el) { el.textContent = el.classList.contains('toc-fab-left') ? short : txt; });
    if (fab) fab.classList.toggle('is-hidden', r.top > innerHeight * 0.5 || r.bottom < innerHeight * 0.8);
    // активный раздел
    var active = null;
    for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < 120) active = heads[i]; else break; }
    var activeH2 = null;
    if (active) { for (var j = heads.indexOf(active); j >= 0; j--) if (heads[j].tagName === 'H2') { activeH2 = heads[j]; break; } }
    links.forEach(function (a) {
      var on = active && a.dataset.target === active.id;
      if (on !== a.classList.contains('is-active')) {
        a.classList.toggle('is-active', on);
        if (on && a.closest('.toc-side')) { var box = a.closest('.toc-side-inner'), ar = a.getBoundingClientRect(), br = box.getBoundingClientRect(); if (ar.top < br.top + 40 || ar.bottom > br.bottom - 40) box.scrollTop += ar.top - br.top - br.height / 3; }
      }
      var li = a.parentElement;
      if (li.parentElement.parentElement.tagName === 'NAV') li.classList.toggle('is-open', !!(activeH2 && a.dataset.target === activeH2.id));
    });
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();
})();

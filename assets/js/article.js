import { copy, notify, scrollOptions } from './site.js';

export function initArticle(prose, article) {
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
    v.miniOff = false;
    if (scroll && !v.wrap.classList.contains('is-mini')) {
      var r = v.wrap.getBoundingClientRect();
      if (r.top < 60 || r.bottom > innerHeight) v.wrap.parentElement.scrollIntoView(scrollOptions('center'));
    } else if (!v.inView) {
      v.miniActive = true;
      updateMini();
    }
    if (v.player && v.ready) { v.player.seekTo(sec || 0, true); v.player.playVideo(); return; }
    if (v.loading) { v.pending = sec; return; }
    v.loading = true;
    var src = v.iframe.dataset.src.replace('www.youtube.com/', 'www.youtube-nocookie.com/') + '?enablejsapi=1&autoplay=1&rel=0&playsinline=1&origin=' + encodeURIComponent(location.origin) + (sec ? '&start=' + Math.floor(sec) : '');
    v.iframe.src = src;
    v.iframe.setAttribute('allow', (v.iframe.getAttribute('allow') || '') + '; autoplay');
    v.wrap.classList.add('is-loaded');
    loadApi().then(function () {
      v.player = new window.YT.Player(v.iframe, { events: {
        onReady: function () { v.ready = true; if (v.pending != null) { v.player.seekTo(v.pending, true); v.player.playVideo(); v.pending = null; } },
        onStateChange: function (e) { v.playing = e.data === 1; v.ended = e.data === 0; if (v.playing && !v.inView && !v.miniOff) v.miniActive = true; if (v.ended) v.miniActive = false; updateMini(); }
      } });
    });
  }
  var mainVideo = null;
  document.querySelectorAll('.video-wrap[data-yt]').forEach(function (wrap) {
    var v = { id: wrap.dataset.yt, wrap: wrap, iframe: wrap.querySelector('iframe'), slot: wrap.parentElement };
    videos[v.id] = v; if (!mainVideo) mainVideo = v;
    wrap.querySelector('.yt-facade').addEventListener('click', function () { startVideo(v, 0); });
    wrap.querySelector('[data-mini-close]').addEventListener('click', function () { v.miniOff = true; v.miniActive = false; if (v.player && v.player.pauseVideo) v.player.pauseVideo(); updateMini(); });
    wrap.querySelector('[data-mini-back]').addEventListener('click', function () { v.slot.scrollIntoView(scrollOptions('center')); });
    new IntersectionObserver(function (en) { v.inView = en[0].isIntersecting; if (v.inView) v.miniOff = false; updateMini(); }, { threshold: 0.25 }).observe(v.slot);
  });
  function updateMini() {
    Object.keys(videos).forEach(function (k) {
      var v = videos[k];
      if (v.inView) v.miniActive = false;
      if (v.playing && !v.inView && !v.miniOff) v.miniActive = true;
      v.wrap.classList.toggle('is-mini', !!(v.miniActive && !v.miniOff && !v.ended));
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
    startVideo(videos[info.id], info.t, false);
  });

  /* ═════════ Цитаты из видео: карточки, таймкод, сворачивание ═════════ */
  prose.querySelectorAll('blockquote').forEach(function (bq) {
    var link = Array.prototype.find.call(bq.querySelectorAll('a'), function (a) { return /^\d{1,2}:\d{2}(:\d{2})?(?:\s*[—–-]\s*\d{1,2}:\d{2}(:\d{2})?)?$/.test(a.textContent.trim()); });
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
    b.addEventListener('click', function () { startVideo(mainVideo, start, false); });
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
      li.replaceChildren(a);
    });
  });

  /* ═════════ Временные отметки в тексте [MM:SS] / [HH:MM:SS — HH:MM:SS] → перемотка ═════════ */
  if (mainVideo) {
    var tsRe = /\[(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[—–-]\s*\d{1,2}:\d{2}(?::\d{2})?)?)\]/g;
    var walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        var p = node.parentElement;
        if (!p || p.closest('a, button, code, pre, script, style, .block-heading, .block-time, .quote-head, .structure-map')) {
          return NodeFilter.FILTER_REJECT;
        }
        tsRe.lastIndex = 0;
        return tsRe.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var tsNodes = [];
    while (walker.nextNode()) tsNodes.push(walker.currentNode);
    tsNodes.forEach(function (node) {
      tsRe.lastIndex = 0;
      var text = node.nodeValue;
      var frag = document.createDocumentFragment();
      var last = 0;
      var m;
      while ((m = tsRe.exec(text)) !== null) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        var rangeText = m[1];
        var startStr = rangeText.split(/[—–-]/)[0].trim();
        var startSec = toSec(startStr);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ts-link';
        btn.textContent = rangeText;
        btn.title = 'Смотреть этот фрагмент видео';
        btn.setAttribute('aria-label', 'Смотреть с ' + startStr);
        btn.addEventListener('click', (function (sec) {
          return function () { startVideo(mainVideo, sec, false); };
        })(startSec));
        frag.appendChild(btn);
        last = m.index + m[0].length;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

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
        if (num) { var tocNum = document.createElement('span'); tocNum.className = 'toc-num'; tocNum.textContent = num.textContent; a.appendChild(tocNum); } var tocText = document.createElement('span'); tocText.className = 'toc-text'; tocText.textContent = text; a.appendChild(tocText);
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
  var fab = document.querySelector('[data-toc-open]');
  var lastFocus = null;
  function closeSheet(skipFocus) {
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    document.body.classList.remove('is-sheet-open');
    if (fab) {
      fab.setAttribute('aria-expanded', 'false');
      if (!skipFocus) {
        if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus({ preventScroll: true });
        else fab.focus({ preventScroll: true });
      }
    }
  }
  function openSheet() {
    if (!sheet || !fab) return;
    lastFocus = document.activeElement;
    sheet.hidden = false;
    document.body.classList.add('is-sheet-open');
    fab.setAttribute('aria-expanded', 'true');
    var panel = sheet.querySelector('.toc-sheet-panel');
    var act = sheet.querySelector('a.is-active') || sheet.querySelector('li.is-open > a');
    if (panel && act) {
      var head = sheet.querySelector('.toc-sheet-head');
      var headH = head ? head.getBoundingClientRect().height : 0;
      var pr = panel.getBoundingClientRect();
      var ar = act.getBoundingClientRect();
      var actOffset = panel.scrollTop + (ar.top - pr.top);
      panel.scrollTop = Math.max(0, actOffset - headH - (panel.clientHeight - headH - ar.height) / 2);
    }
    var close = sheet.querySelector('[data-toc-close]');
    if (close) close.focus({ preventScroll: true });
  }
  if (fab) fab.addEventListener('click', openSheet);
  if (sheet) {
    sheet.addEventListener('click', function (e) {
      if (e.target.closest('a')) closeSheet(true);
      else if (e.target === sheet || e.target.closest('[data-toc-close]')) closeSheet(false);
    });
    document.addEventListener('keydown', function (e) {
      if (sheet.hidden) return;
      if (e.key === 'Escape') { e.preventDefault(); closeSheet(false); return; }
      if (e.key !== 'Tab') return;
      var focusable = sheet.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!focusable.length) { e.preventDefault(); sheet.querySelector('.toc-sheet-panel').focus(); return; }
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ═════════ Прогресс чтения, оставшееся время, активный раздел ═════════ */
  var bar = document.querySelector('.progress span');
  var leftEls = document.querySelectorAll('[data-time-left]');
  var data = {}; try { data = JSON.parse(document.getElementById('article-data').textContent); } catch (e) {}
  var total = data.minutes || 0;
  var ticking = false;
  function onScroll() {
    ticking = false;
    if (sheet && !sheet.hidden && innerWidth >= 1300) closeSheet(true);
    var r = prose.getBoundingClientRect();
    var span = r.height - innerHeight * 0.6;
    var p = Math.min(1, Math.max(0, (-r.top + innerHeight * 0.2) / span));
    if (bar) bar.style.transform = 'scaleX(' + p + ')';
    var left = Math.ceil(total * (1 - p));
    var txt = p >= 0.99 ? 'дочитано' : (p < 0.01 ? total + ' мин' : 'осталось ' + left + ' мин');
    var short = p >= 0.99 ? '✓' : left + ' мин';
    leftEls.forEach(function (el) { el.textContent = el.classList.contains('toc-fab-left') ? short : txt; });
    if (fab) fab.classList.toggle('is-hidden', r.bottom < innerHeight * 0.2);
    // активный раздел
    var active = null;
    for (var i = 0; i < heads.length; i++) { if (heads[i].getBoundingClientRect().top < 120) active = heads[i]; else break; }
    var activeH2 = null;
    if (active) { for (var j = heads.indexOf(active); j >= 0; j--) if (heads[j].tagName === 'H2') { activeH2 = heads[j]; break; } }
    links.forEach(function (a) {
      var on = active && a.dataset.target === active.id;
      if (on !== a.classList.contains('is-active')) {
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
        if (on && a.closest('.toc-side')) { var box = a.closest('.toc-side-inner'), ar = a.getBoundingClientRect(), br = box.getBoundingClientRect(); if (ar.top < br.top + 40 || ar.bottom > br.bottom - 40) box.scrollTop += ar.top - br.top - br.height / 3; }
      }
      var li = a.parentElement;
      if (li.parentElement.parentElement.tagName === 'NAV') li.classList.toggle('is-open', !!(activeH2 && a.dataset.target === activeH2.id));
    });
  }
  addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ═════════ Сноски на литературу: всплывающее окно при наведении ═════════ */
  var bibHead = Array.prototype.find.call(prose.querySelectorAll('h2, h3, h4'), function (h) {
    return /Библиографический список|Список литературы/i.test(h.textContent);
  });
  var bibList = null;
  if (bibHead) {
    var sib = bibHead.nextElementSibling;
    while (sib && !/^H[1-4]$/.test(sib.tagName)) {
      if (sib.tagName === 'OL') { bibList = sib; break; }
      sib = sib.nextElementSibling;
    }
  }
  if (bibList) {
    var refs = {};
    var startNum = parseInt(bibList.getAttribute('start') || '1', 10);
    bibList.classList.add('bib-list');
    Array.prototype.forEach.call(bibList.querySelectorAll(':scope > li'), function (li, idx) {
      var n = startNum + idx;
      if (!li.id) li.id = 'ref-' + n;
      refs[n] = { id: li.id, html: li.innerHTML.trim(), el: li };
    });

    var walker = document.createTreeWalker(prose, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || node.nodeValue.indexOf('[') < 0) return NodeFilter.FILTER_REJECT;
        var p = node.parentElement;
        if (!p || p.closest('a, button, pre, code, .math, script, style, h1, h2, h3, h4, .structure-map, .quote-head, .bib-list')) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);

    var fnPart = '\\d{1,3}(?:\\s*,\\s*(?:\\d{1,3}|(?:с|гл|ч|т|п|pp?|s)\\.[^;\\]]*))?';
    var fnPattern = new RegExp('\\[(' + fnPart + '(?:\\s*;\\s*' + fnPart + ')*)\\]', 'g');
    var fnLinks = [];
    textNodes.forEach(function (node) {
      var val = node.nodeValue;
      fnPattern.lastIndex = 0;
      var m, last = 0, frag = null;
      while ((m = fnPattern.exec(val)) !== null) {
        var nums = [];
        m[1].split(';').forEach(function (part) {
          part = part.trim();
          if (/^\d{1,3}(?:\s*,\s*\d{1,3})*$/.test(part)) {
            part.split(',').forEach(function (s) { nums.push(parseInt(s.trim(), 10)); });
          } else {
            var head = part.match(/^(\d{1,3})\b/);
            if (head) nums.push(parseInt(head[1], 10));
          }
        });
        nums = nums.filter(function (n, i, arr) { return arr.indexOf(n) === i; });
        if (!nums.length || !nums.every(function (n) { return !!refs[n]; })) continue;
        if (!frag) frag = document.createDocumentFragment();
        if (m.index > last) frag.appendChild(document.createTextNode(val.slice(last, m.index)));
        var a = document.createElement('a');
        a.id = 'fnref-' + (fnLinks.length + 1);
        a.className = 'fn-ref';
        a.href = '#' + refs[nums[0]].id;
        a.dataset.fn = nums.join(',');
        a.textContent = '[' + m[1] + ']';
        nums.forEach(function (n) {
          if (refs[n] && !refs[n].firstAnchor) {
            refs[n].firstAnchor = a;
            refs[n].currentAnchor = a;
          }
        });
        frag.appendChild(a);
        fnLinks.push(a);
        last = m.index + m[0].length;
      }
      if (frag) {
        if (last < val.length) frag.appendChild(document.createTextNode(val.slice(last)));
        node.parentNode.replaceChild(frag, node);
      }
    });

    if (fnLinks.length) {
      var pop = document.createElement('div');
      pop.className = 'fn-pop';
      pop.id = 'fn-pop';
      pop.setAttribute('role', 'tooltip');
      pop.hidden = true;
      document.body.appendChild(pop);

      var activeAnchor = null;
      var hideTimer = null;
      var targetTimer = null;
      var returnTimer = null;
      var touchQuery = window.matchMedia('(hover: none)');

      function hideAllBackLinks() {
        Object.keys(refs).forEach(function (key) {
          if (refs[key].backEl) refs[key].backEl.hidden = true;
        });
      }

      function jumpBackToAnchor(anchor, fromPopstate) {
        if (!anchor) return;
        closePop();
        clearTimeout(targetTimer);
        bibList.querySelectorAll('li.is-target').forEach(function (li) { li.classList.remove('is-target'); });
        hideAllBackLinks();
        if (!fromPopstate) {
          history.replaceState(null, '', '#' + anchor.id);
        }
        anchor.scrollIntoView(scrollOptions('center'));
        fnLinks.forEach(function (el) { el.classList.remove('is-returned'); });
        anchor.classList.add('is-returned');
        clearTimeout(returnTimer);
        returnTimer = setTimeout(function () {
          anchor.classList.remove('is-returned');
        }, 2600);
      }

      Object.keys(refs).forEach(function (key) {
        var item = refs[key];
        if (!item.firstAnchor) return;
        var backLink = document.createElement('a');
        backLink.className = 'bib-back';
        backLink.hidden = true;
        backLink.href = '#' + item.firstAnchor.id;
        backLink.title = 'Вернуться к месту сноски в тексте';
        backLink.textContent = '↩ К тексту';
        backLink.addEventListener('click', function (e) {
          e.preventDefault();
          jumpBackToAnchor(item.currentAnchor || item.firstAnchor, false);
        });
        item.backEl = backLink;
        var host = (item.el.lastElementChild && item.el.lastElementChild.tagName === 'P') ? item.el.lastElementChild : item.el;
        host.appendChild(document.createTextNode(' '));
        host.appendChild(backLink);
      });

      function jumpToRef(id, originAnchor) {
        var el = document.getElementById(id);
        if (!el) return;
        closePop();
        hideAllBackLinks();
        if (originAnchor) {
          originAnchor.dataset.fn.split(',').forEach(function (s) {
            var item = refs[parseInt(s.trim(), 10)];
            if (!item) return;
            item.currentAnchor = originAnchor;
            if (item.backEl) {
              item.backEl.href = '#' + originAnchor.id;
              if (item.id === id) item.backEl.hidden = false;
            }
          });
          history.replaceState({ fnOrigin: originAnchor.id }, '', '#' + originAnchor.id);
          history.pushState({ fnOrigin: originAnchor.id, fnTarget: id }, '', '#' + id);
        }
        el.scrollIntoView(scrollOptions('center'));
        bibList.querySelectorAll('li.is-target').forEach(function (li) { li.classList.remove('is-target'); });
        el.classList.add('is-target');
        clearTimeout(targetTimer);
        targetTimer = setTimeout(function () { el.classList.remove('is-target'); }, 8000);
      }

      function positionPop(anchor) {
        if (!anchor || pop.hidden) return;
        var rect = anchor.getBoundingClientRect();
        var pr = pop.getBoundingClientRect();
        var vw = document.documentElement.clientWidth;
        var vh = window.innerHeight;
        var left = rect.left + rect.width / 2 - pr.width / 2;
        left = Math.max(12, Math.min(vw - pr.width - 12, left));
        var top = rect.top - pr.height - 8;
        if (top < 68 && rect.bottom + 8 + pr.height <= vh - 12) {
          top = rect.bottom + 8;
        } else if (top < 68) {
          top = rect.bottom + 8 <= vh - 80 ? rect.bottom + 8 : 68;
        }
        pop.style.left = Math.round(left) + 'px';
        pop.style.top = Math.round(top) + 'px';
      }

      function openPop(anchor) {
        clearTimeout(hideTimer);
        if (activeAnchor && activeAnchor !== anchor) {
          activeAnchor.classList.remove('is-open');
          activeAnchor.removeAttribute('aria-describedby');
        }
        var nums = anchor.dataset.fn.split(',').map(function (s) { return parseInt(s, 10); });
        pop.replaceChildren();
        nums.forEach(function (n) {
          var item = refs[n];
          if (!item) return;
          var card = document.createElement('div');
          card.className = 'fn-pop-item';
          var head = document.createElement('div');
          head.className = 'fn-pop-head';
          var title = document.createElement('span');
          title.textContent = 'Источник [' + n + ']';
          var jump = document.createElement('a');
          jump.className = 'fn-pop-jump';
          jump.href = '#' + item.id;
          jump.textContent = 'К списку ↓';
          jump.addEventListener('click', function (e) {
            e.preventDefault();
            jumpToRef(item.id, anchor);
          });
          head.appendChild(title);
          head.appendChild(jump);
          var body = document.createElement('div');
          body.className = 'fn-pop-body';
          body.innerHTML = item.html;
          card.appendChild(head);
          card.appendChild(body);
          pop.appendChild(card);
        });
        activeAnchor = anchor;
        anchor.classList.add('is-open');
        anchor.setAttribute('aria-describedby', 'fn-pop');
        pop.hidden = false;
        pop.scrollTop = 0;
        positionPop(anchor);
      }

      function closePop() {
        clearTimeout(hideTimer);
        if (activeAnchor) {
          activeAnchor.classList.remove('is-open');
          activeAnchor.removeAttribute('aria-describedby');
          activeAnchor = null;
        }
        pop.hidden = true;
      }

      function scheduleHide() {
        clearTimeout(hideTimer);
        hideTimer = setTimeout(closePop, 160);
      }

      fnLinks.forEach(function (a) {
        a.addEventListener('mouseenter', function () {
          if (!touchQuery.matches) openPop(a);
        });
        a.addEventListener('mouseleave', function () {
          if (!touchQuery.matches) scheduleHide();
        });
        a.addEventListener('focusin', function () { openPop(a); });
        a.addEventListener('focusout', function () {
          setTimeout(function () {
            if (!pop.contains(document.activeElement) && document.activeElement !== a) scheduleHide();
          }, 80);
        });
        a.addEventListener('click', function (e) {
          e.preventDefault();
          if (touchQuery.matches && activeAnchor !== a) {
            openPop(a);
            return;
          }
          jumpToRef(a.getAttribute('href').slice(1), a);
        });
      });

      pop.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
      pop.addEventListener('mouseleave', function () {
        if (!touchQuery.matches) scheduleHide();
      });
      document.addEventListener('click', function (e) {
        if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('.fn-ref')) closePop();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !pop.hidden) closePop();
      });
      addEventListener('scroll', function () {
        if (!pop.hidden && activeAnchor) positionPop(activeAnchor);
      }, { passive: true });
      addEventListener('resize', function () {
        if (!pop.hidden && activeAnchor) positionPop(activeAnchor);
      });
      addEventListener('popstate', function () {
        if (location.hash && /^#fnref-\d+$/.test(location.hash)) {
          var backEl = document.getElementById(location.hash.slice(1));
          if (backEl) jumpBackToAnchor(backEl, true);
        }
      });
    }
  }
}

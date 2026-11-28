/* ============================================================
 * themes/zeek/source/js/main.js — 交互增强层（第九版）
 * 结构：全局一次绑定（主题/⌘K/抽屉/lightbox/统计/BGM/pjax 引擎）
 *      + initPage()（每次导航后对当前页面重新初始化）
 * 第九轮新增：
 *   - pjax 站内导航（fetch + 局部替换 #view/#sideTree/#toc），
 *     页面不整页刷新 → 背景音乐跨页不中断
 *   - 电台背景音乐播放器（playlist.json 节目单，顺序/单曲循环/选歌，
 *     localStorage 记忆曲目与进度，刷新后可一键续播）
 *   - ⌘K 搜索命中高亮（标题与正文片段 <mark>）
 * ============================================================ */
(function () {
  'use strict';

  var THEME_KEY = 'proto-theme';
  var root = document.documentElement;

  /* ==================== 主题三态（全局） ==================== */
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  var themeHooks = []; // 主题变化回调（giscus 换肤等）
  function applyTheme(mode) {
    if (mode === 'system') {
      delete root.dataset.theme;
      document.body && (document.body.style.colorScheme = mq.matches ? 'dark' : 'light');
      root.style.colorScheme = mq.matches ? 'dark' : 'light';
    } else {
      root.dataset.theme = mode;
      root.style.colorScheme = mode;
    }
    var btn = document.getElementById('themeBtn');
    if (btn) {
      var icon = mode === 'system' ? '◐' : mode === 'light' ? '☀' : '☾';
      var label = btn.querySelector('.t-label');
      if (label) label.textContent = icon; else btn.textContent = icon;
      btn.setAttribute('aria-label', '主题：' + mode);
    }
    themeHooks.forEach(function (fn) { try { fn(mode); } catch (e) {} });
  }
  function getTheme() { return localStorage.getItem(THEME_KEY) || 'system'; }
  function cycleTheme() {
    var order = ['system', 'light', 'dark'];
    var next = order[(order.indexOf(getTheme()) + 1) % order.length];
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  }
  applyTheme(getTheme());
  mq.addEventListener('change', function () { if (getTheme() === 'system') applyTheme('system'); });
  var themeBtn = document.getElementById('themeBtn');
  if (themeBtn) themeBtn.addEventListener('click', cycleTheme);

  /* ==================== ⌘K 搜索（全局 + 高亮） ==================== */
  var searchIndex = null;
  var cmdk = document.getElementById('cmdk');
  var cmdkInput = document.getElementById('cmdkQ');
  var cmdkResults = document.getElementById('cmdkResults');
  var selIdx = -1;

  function openSearch() {
    if (!cmdk) return;
    cmdk.hidden = false;
    if (!searchIndex) {
      var src = (document.querySelector('script[data-search]') || {}).dataset;
      fetch(src && src.search ? src.search : 'search.json')
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) { searchIndex = Array.isArray(data) ? data : []; renderResults(cmdkInput ? cmdkInput.value : ''); })
        .catch(function () { searchIndex = []; renderResults(''); });
    }
    if (cmdkInput) { cmdkInput.value = ''; renderResults(''); setTimeout(function () { cmdkInput.focus(); }, 0); }
  }
  function closeSearch() { if (cmdk) { cmdk.hidden = true; selIdx = -1; } }

  function matchEntry(e, q) {
    var hay = [e.title, e.description, (e.tags || []).join(' '), (e.categories || []).join(' '), e.text || ''].join(' ').toLowerCase();
    return q.split(/\s+/).every(function (w) { return w && hay.indexOf(w) !== -1; });
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  /* 第九轮：转义 + 关键词高亮（输出安全：先按字符转义，再对转义后文本做不区分大小写包裹） */
  function escHl(s, q) {
    var t = esc(s);
    if (!q) return t;
    /* 所有关键词合并成一条交替正则，避免逐个替换时把已插入的 <mark> 再包一层 */
    var words = String(q).toLowerCase().split(/\s+/).filter(Boolean).map(function (w) {
      return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    });
    if (!words.length) return t;
    return t.replace(new RegExp('(' + words.join('|') + ')', 'gi'), '<mark class="hl">$1</mark>');
  }
  function snippet(e, q) {
    var t = String(e.text || '');
    if (q) {
      var words = q.split(/\s+/).filter(Boolean);
      for (var i = 0; i < words.length; i++) {
        var p = t.toLowerCase().indexOf(words[i]);
        if (p >= 0) { var s = Math.max(0, p - 30); return t.slice(s, s + 70) + '…'; }
      }
    }
    return e.description || (t ? t.slice(0, 70) + (t.length > 70 ? '…' : '') : '');
  }
  function renderResults(q) {
    if (!cmdkResults) return;
    q = (q || '').trim().toLowerCase();
    var list = [];
    if (q) {
      var q0 = q.split(/\s+/)[0] || '';
      list = (searchIndex || [])
        .filter(function (e) { return matchEntry(e, q); })
        .sort(function (a, b) {
          var ra = String(a.title).toLowerCase().indexOf(q0) >= 0 ? 0 : 1;
          var rb = String(b.title).toLowerCase().indexOf(q0) >= 0 ? 0 : 1;
          return ra - rb;
        })
        .slice(0, 12);
    } else {
      list = (searchIndex || []).slice(0, 8);
    }
    selIdx = list.length ? 0 : -1;
    cmdkResults.innerHTML = list.map(function (e, i) {
      var cat = (e.tags && e.tags.length) ? e.tags[0] : (e.categories && e.categories[0]) || '文章';
      return '<a class="cmd-item' + (i === 0 ? ' sel' : '') + '" href="' + e.url + '" data-i="' + i + '">' +
        '<span class="cmd-ico">📄</span>' +
        '<span class="cmd-main"><b>' + escHl(e.title, q) + '</b><span>' + escHl(snippet(e, q), q) + '</span></span>' +
        '<span class="cmd-cat">' + esc(cat) + '</span></a>';
    }).join('') || '<div class="cmd-item" style="cursor:default"><span class="cmd-ico">🔍</span><span class="cmd-main"><b>没有匹配的结果</b></span></div>';
    var foot = document.getElementById('cmdkFoot');
    if (foot) foot.textContent = list.length ? (list.length + ' 条结果 · ↑↓ 选择 · Enter 打开 · Esc 关闭') : 'Esc 关闭';
  }
  function goSel() {
    if (selIdx < 0 || !cmdkResults) return;
    var a = cmdkResults.querySelectorAll('a.cmd-item')[selIdx];
    if (a) { closeSearch(); navigate(a.getAttribute('href')); }
  }
  document.addEventListener('keydown', function (ev) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement && document.activeElement.tagName);
    if ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k') { ev.preventDefault(); openSearch(); return; }
    if (ev.key === '/' && !typing && !(cmdk && !cmdk.hidden)) { ev.preventDefault(); openSearch(); return; }
    if (cmdk && !cmdk.hidden) {
      if (ev.key === 'Escape') { closeSearch(); return; }
      if (ev.key === 'Enter') { ev.preventDefault(); goSel(); return; }
      if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
        ev.preventDefault();
        var items = cmdkResults ? cmdkResults.querySelectorAll('a.cmd-item') : [];
        if (!items.length) return;
        selIdx = (selIdx + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items.forEach(function (el, i) { el.classList.toggle('sel', i === selIdx); });
        items[selIdx].scrollIntoView({ block: 'nearest' });
      }
    }
  });
  if (cmdk) {
    cmdk.addEventListener('click', function (ev) {
      if (ev.target.classList && ev.target.classList.contains('cmdk-backdrop')) closeSearch();
    });
    if (cmdkInput) cmdkInput.addEventListener('input', function () { renderResults(this.value); });
  }
  var sb = document.getElementById('searchBox');
  if (sb) sb.addEventListener('click', openSearch);
  var sbOpen = document.getElementById('openSearch');
  if (sbOpen) sbOpen.addEventListener('click', openSearch);
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' && document.activeElement === sbOpen) { openSearch(); }
  });

  /* ==================== 工具 ==================== */
  var CFG = window.ZEEK_CFG || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function loadScript(src, onload, onerror) {
    if (window.__loadedScripts && window.__loadedScripts[src]) { if (onload) onload(); return; }
    var s = document.createElement('script');
    s.src = src; s.defer = true;
    s.onload = function () { (window.__loadedScripts = window.__loadedScripts || {})[src] = 1; if (onload) onload(); };
    s.onerror = onerror || null;
    document.head.appendChild(s);
    return s;
  }
  function copyText(text, done, fail) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { legacy(); });
    } else legacy();
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(ta);
      ok ? done() : fail();
    }
  }

  /* ==================== initPage()：页面级初始化（每次导航后重跑） ==================== */
  var spyCleanups = [];

  function initPage() {
    spyCleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
    spyCleanups = [];
    var view = document.getElementById('view');

    /* ---- TOC scrollspy + 平滑滚动 ---- */
    var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[data-h]'));
    if (tocLinks.length) {
      var heads = tocLinks.map(function (a) {
        var el = document.getElementById(a.dataset.h);
        return el ? { a: a, el: el } : null;
      }).filter(Boolean);
      function spy() {
        var cur = null;
        for (var i = 0; i < heads.length; i++) {
          if (heads[i].el.getBoundingClientRect().top <= 96) cur = heads[i]; else break;
        }
        heads.forEach(function (h) { h.a.classList.toggle('on', h === cur); });
      }
      var ticking = false;
      var onSpyScroll = function () {
        if (!ticking) { requestAnimationFrame(function () { spy(); ticking = false; }); ticking = true; }
      };
      window.addEventListener('scroll', onSpyScroll, { passive: true });
      spyCleanups.push(function () { window.removeEventListener('scroll', onSpyScroll); });
      spy();
      tocLinks.forEach(function (a) {
        a.addEventListener('click', function (ev) {
          var t = document.getElementById(a.dataset.h);
          if (t) { ev.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#' + a.dataset.h); }
        });
      });
    }

    /* ---- 代码块：语言标签 + 复制按钮 ---- */
    function langOf(cls) {
      var m = /(?:language|lang|highlight)-([\w+#-]+)/.exec(cls || '');
      return m ? m[1].toLowerCase() : 'bash';
    }
    function enhanceCode(hostEl, getText, lang) {
      if (!hostEl || hostEl.dataset.cbDone) return;
      hostEl.dataset.cbDone = '1';
      var bar = document.createElement('div');
      bar.className = 'cb-bar';
      bar.innerHTML = '<span class="cb-lang"></span><button type="button" class="cb-copy">复制</button>';
      bar.querySelector('.cb-lang').textContent = lang;
      var btn = bar.querySelector('.cb-copy');
      btn.addEventListener('click', function () {
        copyText(getText(), function () {
          btn.textContent = '已复制'; btn.classList.add('ok');
          setTimeout(function () { btn.textContent = '复制'; btn.classList.remove('ok'); }, 1600);
        }, function () { btn.textContent = '复制失败'; setTimeout(function () { btn.textContent = '复制'; }, 1600); });
      });
      if (hostEl.classList.contains('codeblock')) {
        hostEl.insertBefore(bar, hostEl.firstChild);
      } else {
        var wrap = document.createElement('div');
        wrap.className = 'codeblock';
        hostEl.parentNode.insertBefore(wrap, hostEl);
        wrap.appendChild(bar);
        wrap.appendChild(hostEl);
      }
    }
    document.querySelectorAll('figure.highlight').forEach(function (fig) {
      var codePre = fig.querySelector('td.code pre') || fig.querySelector('pre');
      var cls = (fig.querySelector('td.code') || fig).className || fig.className;
      enhanceCode(fig, function () { return codePre ? codePre.textContent : fig.textContent; }, langOf(cls));
    });
    document.querySelectorAll('pre > code').forEach(function (code) {
      var pre = code.parentElement;
      if (pre.closest('figure.highlight') || pre.closest('.codeblock')) return;
      enhanceCode(pre, function () { return code.textContent; }, langOf(code.className));
    });

    /* ---- 阅读进度条（isPost 动态判定） ---- */
    var progress = document.querySelector('.progress');
    var progressBar = document.querySelector('.progress-bar');
    var backtop = document.getElementById('backtop');
    function onScroll() {
      var y = window.scrollY || document.documentElement.scrollTop;
      var isPost = document.body && document.body.dataset.page === 'post';
      if (progress && isPost && progressBar) {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        progressBar.style.width = (max > 0 ? Math.min(y / max * 100, 100) : 0) + '%';
      }
      if (backtop) backtop.classList.toggle('show', y > 400);
    }
    if (progress) progress.style.display = 'block';
    window.addEventListener('scroll', onScroll, { passive: true });
    spyCleanups.push(function () { window.removeEventListener('scroll', onScroll); });
    onScroll();
    if (backtop && !backtop.dataset.bound) {
      backtop.dataset.bound = '1';
      backtop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });
    }

    /* ---- 侧栏折叠（sideTree 整体替换后需重绑） ---- */
    document.querySelectorAll('.sidegroup > .sg-head').forEach(function (h) {
      h.addEventListener('click', function () { h.parentElement.classList.toggle('collapsed'); });
    });
    document.querySelectorAll('.sg-sub .subarrow').forEach(function (a) {
      var toggle = function () { a.closest('.sg-sub').classList.toggle('collapsed'); };
      a.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); toggle(); });
      a.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
    });
    (function () {
      var groups = document.querySelectorAll('.sidegroup');
      groups.forEach(function (g) { g.classList.add('collapsed'); });
      document.querySelectorAll('.sg-sub').forEach(function (s) { s.classList.add('collapsed'); });
      if (groups.length === 1) groups[0].classList.remove('collapsed');
      var activeA = document.querySelector('.sg-items a.active, .sg-items2 a.active, .sg-subhead a.active');
      if (activeA && activeA.closest) {
        var g = activeA.closest('.sidegroup');
        if (g) g.classList.remove('collapsed');
        var sub = activeA.closest('.sg-sub');
        if (sub) sub.classList.remove('collapsed');
      }
    })();

    /* ---- 归档页：分组切换 + 筛选 ---- */
    var archq = document.getElementById('archq');
    var archCount = document.getElementById('archCount');
    var modeBtns = document.querySelectorAll('[data-mode]');
    var listCat = document.getElementById('archlist-cat');
    var listYear = document.getElementById('archlist-year');
    var archEmpty = document.getElementById('arch-empty');
    function setMode(mode) {
      modeBtns.forEach(function (b) { b.classList.toggle('on', b.dataset.mode === mode); });
      if (listCat) listCat.hidden = mode !== 'cat';
      if (listYear) listYear.hidden = mode !== 'year';
    }
    modeBtns.forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
    if (modeBtns.length) setMode((listCat && !listCat.hidden) ? 'cat' : 'year');
    function filterArchive() {
      if (!archq) return;
      var q = archq.value.trim().toLowerCase();
      var containers = [listCat, listYear].filter(Boolean);
      var total = 0;
      containers.forEach(function (c) {
        var shown = 0;
        c.querySelectorAll('details.archgroup').forEach(function (g) {
          var n = 0;
          g.querySelectorAll('.archlist a').forEach(function (a) {
            var hit = !q || (a.textContent || '').toLowerCase().indexOf(q) !== -1 || (a.dataset.keywords || '').indexOf(q) !== -1;
            a.style.display = hit ? '' : 'none';
            if (hit) n++;
          });
          g.hidden = n === 0;
          g.open = !!q || g.open || n > 0 && !!q;
          if (!g.hidden) { shown += n; var cnt = g.querySelector('.cnt'); if (cnt) cnt.textContent = n + ' 篇'; }
        });
        c.querySelectorAll('.archdomain').forEach(function (d) {
          var any = Array.prototype.some.call(d.querySelectorAll('details.archgroup'), function (g) { return !g.hidden; });
          d.hidden = !any;
        });
        if (!c.hidden) total += shown;
      });
      if (archCount) archCount.textContent = '共 ' + total + ' 篇';
      if (archEmpty) archEmpty.hidden = total !== 0;
    }
    if (archq) archq.addEventListener('input', filterArchive);

    /* ---- fade-in ---- */
    if (view) {
      view.classList.remove('fade-in'); void view.offsetWidth; view.classList.add('fade-in');
    }

    /* ---- KaTeX（正文含 $ 时懒加载） ---- */
    if (CFG.katex && view) {
      var txt = view.textContent || '';
      if (txt.indexOf('$') !== -1 || txt.indexOf('\\(') !== -1) {
        var tryKatex = function () {
          if (!window.katex || !window.renderMathInElement) return;
          window.renderMathInElement(view, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\[', right: '\\]', display: true },
              { left: '\\(', right: '\\)', display: false },
              { left: '$', right: '$', display: false }
            ],
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
          });
        };
        loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js', function () {
          loadScript('https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js', tryKatex);
        });
      }
    }

    /* ---- mermaid（div.mermaid 构建期已生成 + 旧形态兜底） ---- */
    if (CFG.mermaid) {
      var mmDivs = [];
      document.querySelectorAll('div.mermaid').forEach(function (div) {
        if (!div.dataset.mmDone) { div.dataset.mmDone = '1'; mmDivs.push({ div: div, pre: null }); }
      });
      document.querySelectorAll('pre > code.language-mermaid').forEach(function (code) {
        var pre = code.parentElement;
        if (pre.closest('.codeblock') || pre.dataset.cbDone) return;
        if (pre.nextElementSibling && pre.nextElementSibling.classList.contains('mermaid')) return;
        var div = document.createElement('div');
        div.className = 'mermaid';
        div.textContent = code.textContent;
        pre.parentNode.insertBefore(div, pre);
        pre.style.display = 'none';
        mmDivs.push({ div: div, pre: pre });
      });
      if (mmDivs.length) loadScript('https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js', function () {
        if (!window.mermaid) return;
        var dark = (root.dataset.theme === 'dark') || (root.style.colorScheme === 'dark');
        try {
          window.mermaid.initialize({ startOnLoad: false, theme: dark ? 'dark' : 'neutral' });
          window.mermaid.run({ nodes: mmDivs.map(function (x) { return x.div; }) }).catch(fallback);
        } catch (e) { fallback(); }
        function fallback() { mmDivs.forEach(function (x) { if (x.pre) x.pre.style.display = ''; x.div.textContent = x.div.getAttribute('data-src') || x.div.textContent; x.div.classList.add('mermaid-err'); }); }
      }, function () {
        mmDivs.forEach(function (x) { x.div.remove(); if (x.pre) x.pre.style.display = ''; });
      });
    }

    /* ---- 滚动显现 ---- */
    (function () {
      if (reduceMotion || !('IntersectionObserver' in window) || !view) return;
      var targets = [];
      if (document.body.dataset.page === 'post') {
        Array.prototype.forEach.call(view.children, function (el) {
          if (!el.classList.contains('crumb') && !el.classList.contains('in')) targets.push(el);
        });
      } else {
        targets = Array.prototype.slice.call(view.querySelectorAll('.cat-card, .archdomain, .postlist, .hotlist, details.archgroup')).filter(function (el) { return !el.classList.contains('in'); });
      }
      if (!targets.length) return;
      targets.forEach(function (el) { el.classList.add('reveal'); });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
      targets.forEach(function (el) { io.observe(el); });
    })();

    /* ---- 复制本文链接（按钮在 #view 内，重绑） ---- */
    var cbtn = view && view.querySelector('.copy-link');
    if (cbtn && !cbtn.dataset.bound) {
      cbtn.dataset.bound = '1';
      cbtn.addEventListener('click', function () {
        var url = cbtn.getAttribute('data-url') || location.href;
        function done() {
          cbtn.classList.add('copied'); cbtn.textContent = '✓ 已复制';
          setTimeout(function () { cbtn.classList.remove('copied'); cbtn.textContent = '🔗 复制链接'; }, 1600);
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(done, function () { fallback(); });
        } else fallback();
        function fallback() {
          var ta = document.createElement('textarea');
          ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
          document.body.appendChild(ta); ta.select();
          try { document.execCommand('copy'); done(); } catch (e) {}
          document.body.removeChild(ta);
        }
      });
    }

    /* ---- giscus 评论（容器在 #view 内，重新懒加载） ---- */
    initGiscus();
  }

  /* ==================== giscus（可重复初始化） ==================== */
  function initGiscus() {
    var wrap = document.getElementById('giscusWrap');
    var box = document.getElementById('giscusBox');
    var g = CFG.giscus;
    if (!wrap || !box || !g || !g.repo || wrap.dataset.giscusInit) return;
    wrap.dataset.giscusInit = '1';
    function giscusTheme(mode) { return mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : (mq.matches ? 'dark' : 'light'); }
    function load() {
      var s = document.createElement('script');
      s.src = 'https://giscus.app/client.js';
      s.async = true; s.crossOrigin = 'anonymous';
      var params = {
        'data-repo': g.repo, 'data-repo-id': g.repoId,
        'data-category': g.category || 'Announcements', 'data-category-id': g.categoryId,
        'data-mapping': 'pathname', 'data-strict': '1',
        'data-reactions-enabled': '1', 'data-emit-metadata': '0',
        'data-input-position': 'top', 'data-theme': giscusTheme(getTheme()),
        'data-lang': g.lang || 'zh-CN', 'data-loading': 'lazy'
      };
      Object.keys(params).forEach(function (k) { s.setAttribute(k, params[k]); });
      box.innerHTML = '';
      box.appendChild(s);
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries, obs) {
        if (entries.some(function (e) { return e.isIntersecting; })) { load(); obs.disconnect(); }
      }, { rootMargin: '400px' }).observe(wrap);
    } else load();
  }
  /* 主题切换 → giscus 换肤（全局一次） */
  themeHooks.push(function () {
    var frame = document.querySelector('iframe.giscus-frame');
    if (!frame) return;
    var mode = getTheme();
    var t = mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : (mq.matches ? 'dark' : 'light');
    frame.contentWindow.postMessage({ giscus: { setConfig: { theme: t } } }, 'https://giscus.app');
  });

  /* ==================== 全局：抽屉 / skip-link / lightbox ==================== */
  var drawerBtn = document.getElementById('menuBtn');
  var sidebar = document.querySelector('.sidebar');
  if (drawerBtn && sidebar) {
    drawerBtn.addEventListener('click', function () { sidebar.classList.toggle('open'); });
    document.addEventListener('click', function (ev) {
      if (sidebar.classList.contains('open') && !sidebar.contains(ev.target) && ev.target !== drawerBtn && !drawerBtn.contains(ev.target)) {
        sidebar.classList.remove('open');
      }
    });
  }
  var skip = document.querySelector('.skip-link');
  if (skip) skip.addEventListener('click', function () {
    var t = document.getElementById(skip.getAttribute('href').slice(1));
    if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
  });

  (function () { /* lightbox（事件委托，全局一次） */
    var overlay = null;
    function open(src, alt) {
      close();
      overlay = document.createElement('div');
      overlay.className = 'lightbox';
      overlay.innerHTML = '<img alt="' + (alt || '') + '" src="' + src + '"><button type="button" class="lb-close" aria-label="关闭">×</button>';
      overlay.addEventListener('click', function (ev) { if (ev.target !== overlay.querySelector('img')) close(); });
      document.addEventListener('keydown', onKey);
      document.body.appendChild(overlay);
      document.body.style.overflow = 'hidden';
    }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    function close() {
      if (!overlay) return;
      document.removeEventListener('keydown', onKey);
      document.body.removeChild(overlay); overlay = null;
      document.body.style.overflow = '';
    }
    document.addEventListener('click', function (ev) {
      var img = ev.target && ev.target.closest ? ev.target.closest('.content img, .post-body img') : null;
      if (!img || ev.target.closest('a')) return;
      if (img.closest('.author-card, .avatar, #waifu, .logo')) return;
      ev.preventDefault();
      open(img.currentSrc || img.src, img.alt);
    });
  })();

  /* ==================== live2d（全局一次） ==================== */
  if (CFG.mascot && !reduceMotion && window.innerWidth > 900) {
    loadScript('https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/autoload.js');
  }

  /* ==================== 访问统计（全局一次） ==================== */
  (function () {
    var a = CFG.analytics;
    if (!a || a.indexOf('-') < 0) return;
    var kind = a.slice(0, a.indexOf('-'));
    var id = a.slice(a.indexOf('-') + 1);
    if (kind === 'ga4' && /^G-[A-Z0-9]+$/.test(id)) {
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + id);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', id, { anonymize_ip: true });
    } else if (kind === 'goatcounter' && /^[A-Za-z0-9-]+$/.test(id)) {
      window.goatcounter = { no_onload: false, allow_local: false };
      loadScript('https://gc.zgo.at/count.js?site=' + encodeURIComponent(id));
    }
  })();

  /* ==================== 电台背景音乐播放器（第九轮重写） ====================
   * CFG.bgm 两种形态：
   *   ① 以 .json 结尾 → 电台节目单模式（source/bgm/playlist.json，构建期抓取）
   *   ② 其他 → 单文件模式（旧行为：一个音频 URL 循环）
   * 站内导航走 pjax 不整页刷新 → 音频天然连续；
   * 整页刷新后从 localStorage 恢复曲目与进度（浏览器自动播放策略限制，需点一次 ▶）。 */
  var bgmAPI = (function () {
    var audio = null, tracks = [], idx = -1, mode = 'loop1', panel = null, saved = null;
    var httpsTried = Object.create(null);
    var STATE_KEY = 'bgm-state';
    var btn = document.getElementById('bgmBtn');

    function srcOf(t) { return 'https://music.163.com/song/media/outer/url?id=' + t.id + '.mp3'; }
    function saveState() {
      try {
        localStorage.setItem(STATE_KEY, JSON.stringify({
          i: idx, t: audio ? Math.floor(audio.currentTime) : 0,
          playing: audio ? !audio.paused : false, mode: mode
        }));
      } catch (e) {}
    }
    function fmt(s) {
      s = Math.max(0, Math.floor(s || 0));
      var m = Math.floor(s / 60); s = s % 60;
      return m + ':' + (s < 10 ? '0' : '') + s;
    }
    function cur() { return tracks[idx] || null; }

    function play(i) {
      if (!tracks.length) return;
      idx = ((i == null ? 0 : i) + tracks.length) % tracks.length;
      audio.src = srcOf(cur());
      audio.play().then(function () { render(); saveState(); }).catch(function () { render(); });
    }
    function toggle() {
      if (!tracks.length) return;
      if (audio.paused) {
        if (!audio.src) return play(idx < 0 ? 0 : idx);
        audio.play().catch(function () {});
      } else audio.pause();
    }
    function step(d) { play(idx + d); }

    function buildPanel() {
      panel = document.createElement('div');
      panel.className = 'bgm-panel';
      panel.hidden = true;
      panel.innerHTML =
        '<div class="bgm-head"><span class="bgm-title">电台</span>' +
        '<button type="button" class="bgm-mode" title="播放模式">🔂 单曲循环</button>' +
        '<button type="button" class="bgm-close" aria-label="收起播放器">×</button></div>' +
        '<div class="bgm-now"><b class="bgm-track">—</b><span class="bgm-time">0:00 / 0:00</span></div>' +
        '<div class="bgm-bar"><i></i></div>' +
        '<div class="bgm-ctrl">' +
        '<button type="button" class="bgm-prev" aria-label="上一首">⏮</button>' +
        '<button type="button" class="bgm-play" aria-label="播放/暂停">▶</button>' +
        '<button type="button" class="bgm-next" aria-label="下一首">⏭</button></div>' +
        '<div class="bgm-list" role="listbox" aria-label="节目列表"></div>';
      document.body.appendChild(panel);
      panel.querySelector('.bgm-close').addEventListener('click', function () { panel.hidden = true; });
      panel.querySelector('.bgm-mode').addEventListener('click', function () {
        mode = mode === 'seq' ? 'loop1' : 'seq';
        this.textContent = mode === 'seq' ? '🔁 顺序' : '🔂 单曲循环';
        saveState();
      });
      panel.querySelector('.bgm-play').addEventListener('click', toggle);
      panel.querySelector('.bgm-prev').addEventListener('click', function () { step(-1); });
      panel.querySelector('.bgm-next').addEventListener('click', function () { step(1); });
    }
    function renderList() {
      var list = panel.querySelector('.bgm-list');
      list.innerHTML = tracks.map(function (t, i) {
        return '<a class="bgm-item' + (i === idx ? ' on' : '') + '" data-i="' + i + '" href="javascript:void 0">' +
          '<span class="bi-name">' + esc(t.name) + '</span><span class="bi-dur">' + fmt(t.dur) + '</span></a>';
      }).join('');
      list.querySelectorAll('.bgm-item').forEach(function (a) {
        a.addEventListener('click', function () { play(parseInt(a.dataset.i, 10)); });
      });
    }
    function render() {
      if (!panel) return;
      var t = cur();
      panel.querySelector('.bgm-track').textContent = t ? t.name : '—';
      panel.querySelector('.bgm-play').textContent = (audio && !audio.paused) ? '⏸' : '▶';
      panel.querySelector('.bgm-mode').textContent = mode === 'seq' ? '🔁 顺序' : '🔂 单曲循环';
      btn.classList.toggle('on', audio && !audio.paused);
      renderList();
      var on = panel.querySelector('.bgm-item.on');
      if (on) on.scrollIntoView({ block: 'nearest' });
    }

    function init() {
      if (!CFG.bgm) return;
      if (!/\.json(\?|$)/.test(CFG.bgm)) {
        /* 旧：单文件模式 */
        if (!btn) return;
        var a1 = new Audio(CFG.bgm);
        a1.loop = true; a1.volume = 0.35;
        a1.addEventListener('error', function () { btn.hidden = true; });
        btn.addEventListener('click', function () {
          if (a1.paused) { a1.play().catch(function () { btn.hidden = true; }); btn.classList.add('on'); }
          else { a1.pause(); btn.classList.remove('on'); }
        });
        btn.hidden = false;
        return;
      }
      if (!btn) return;
      audio = new Audio();
      audio.preload = 'metadata';
      audio.volume = 0.35;
      buildPanel();
      btn.hidden = false;
      btn.addEventListener('click', function () { panel.hidden = !panel.hidden; if (!panel.hidden) render(); });

      audio.addEventListener('play', render);
      audio.addEventListener('pause', function () { render(); saveState(); });
      audio.addEventListener('error', function () {
        var t = cur();
        if (!t) return;
        /* 网易云外链 302 到 http://mN.music.126.net（https 页面 mixed-content 风险）。
         * 若浏览器已解析出最终 CDN 地址，改用 https 直连重试一次（签名未过期时可直接救回）。 */
        var resolved = '';
        try { resolved = audio.currentSrc || ''; } catch (e) {}
        if (!httpsTried[t.id] && /^http:\/\/m\d+\.music\.126\.net\//.test(resolved)) {
          httpsTried[t.id] = true;
          audio.src = resolved.replace(/^http:/, 'https:');
          audio.load();
          audio.play().catch(function () {});
          return;
        }
        t.err = true;
        render();
        /* 该集不可用 → 自动跳到下一集可播的；全部失效则停机并提示，避免死循环 */
        var next = -1;
        for (var k = 1; k <= tracks.length; k++) {
          var j = (idx + k) % tracks.length;
          if (j !== idx && !tracks[j].err) { next = j; break; }
        }
        if (next >= 0) play(next);
        else {
          btn.classList.remove('on');
          if (panel) panel.querySelector('.bgm-track').textContent = '音源暂不可用';
        }
      });
      audio.addEventListener('timeupdate', function () {
        if (!panel) return;
        panel.querySelector('.bgm-time').textContent = fmt(audio.currentTime) + ' / ' + fmt(audio.duration || (cur() ? cur().dur : 0));
        var pct = audio.duration ? Math.min(audio.currentTime / audio.duration * 100, 100) : 0;
        panel.querySelector('.bgm-bar i').style.width = pct + '%';
        if (Math.floor(audio.currentTime) % 5 === 0) saveState();
      });
      audio.addEventListener('ended', function () {
        if (mode === 'loop1') { audio.currentTime = 0; audio.play().catch(function () {}); }
        else step(1);
      });
      window.addEventListener('beforeunload', saveState);

      fetch(CFG.bgm).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (data) {
          tracks = (data && data.tracks) || [];
          panel.querySelector('.bgm-title').textContent = '电台 · ' + tracks.length + ' 集';
          /* 恢复上次状态（自动播放策略：恢复为暂停，点 ▶ 从上次进度续播） */
          try { saved = JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { saved = null; }
          if (saved && typeof saved.i === 'number' && tracks[saved.i]) {
            idx = saved.i;
            if (saved.mode === 'loop1' || saved.mode === 'seq') mode = saved.mode;
            audio.src = srcOf(cur());
            audio.addEventListener('loadedmetadata', function once() {
              audio.removeEventListener('loadedmetadata', once);
              try { audio.currentTime = saved.t || 0; } catch (e) {}
            });
            audio.load();
            if (saved.playing) btn.classList.add('resume'); /* 提示可续播 */
          }
          render();
        })
        .catch(function () { btn.hidden = true; });
    }
    init();
    return { saveState: saveState };
  })();

  /* ==================== pjax 站内导航（第九轮） ====================
   * 拦截同源链接 → fetch HTML → 替换 #view / #sideTree / #toc / 标题 → initPage()
   * 页面不重载 → 背景音乐连续播放。失败（网络/结构异常）回落整页跳转。 */
  var pjaxEnabled = true;
  function sameOrigin(u) {
    try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; }
  }
  function navigate(url, noPush) {
    if (!pjaxEnabled || !url || url.charAt(0) === '#' || !sameOrigin(url)) {
      if (url) location.href = url;
      return;
    }
    var u = new URL(url, location.href);
    if (u.pathname === location.pathname && u.hash) return; // 同页锚点
    if (u.origin + u.pathname === location.origin + location.pathname && u.search === location.search) return;
    fetch(u.href, { headers: { 'X-Pjax': '1' } })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status);
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var newView = doc.getElementById('view');
        var curView = document.getElementById('view');
        if (!newView || !curView) throw new Error('no #view');
        curView.innerHTML = newView.innerHTML;
        var newTree = doc.getElementById('sideTree');
        var curTree = document.getElementById('sideTree');
        if (newTree && curTree) curTree.innerHTML = newTree.innerHTML;
        var newToc = doc.getElementById('toc');
        var curToc = document.getElementById('toc');
        if (curToc && newToc) curToc.innerHTML = newToc.innerHTML;
        document.title = doc.title || document.title;
        if (doc.body.dataset.page) document.body.dataset.page = doc.body.dataset.page;
        else delete document.body.dataset.page;
        if (!noPush) history.pushState({ pjax: true }, '', u.href);
        window.scrollTo(0, 0);
        closeSearch();
        if (sidebar) sidebar.classList.remove('open');
        initPage();
        bgmAPI.saveState();
        /* pjax 切页 → GoatCounter 手动上报（count.js 默认只在整页 load 上报一次） */
        if (window.goatcounter && window.goatcounter.count) {
          try { window.goatcounter.count({ path: location.pathname + location.search, title: document.title }); } catch (e) {}
        }
      })
      .catch(function () { location.href = url; });
  }
  document.addEventListener('click', function (ev) {
    if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    var a = ev.target && ev.target.closest ? ev.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href');
    if (!href || href.charAt(0) === '#' || /^(mailto:|tel:|javascript:|blob:|data:)/i.test(href)) return;
    if (a.target && a.target !== '_self') return;
    if (a.download) return;
    if (a.rel && /(^|\s)external(\s|$)/.test(a.rel)) return;
    if (!sameOrigin(a.href)) return; // 站外新窗口由模板 target=_blank 处理
    ev.preventDefault();
    navigate(a.href);
  });
  window.addEventListener('popstate', function () {
    /* 回退/前进：同样走 pjax（无 push） */
    navigate(location.href, true);
  });

  /* ==================== 首次进入 ==================== */
  initPage();
})();

/* ==================== CAT-04：缩写全称提示（术语表三处消费之三） ==================== */
/* 单一数据源 = 内容库 70-索引/术语表.md → collect 生成 /glossary.json。
   对正文与索引页中的缩写首处加 <abbr title> hover 提示；pjax 场景用 MutationObserver 兜底。 */
(function () {
  'use strict';
  var GLOSS = null;
  var MAX_PER_PAGE = 12; // 每页最多标注 12 处，避免噪音
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, CODE: 1, PRE: 1, A: 1, ABBR: 1, TEXTAREA: 1 };

  function load(cb) {
    if (GLOSS) return cb(GLOSS);
    try {
      var x = new XMLHttpRequest();
      x.open('GET', '/glossary.json', true);
      x.onload = function () {
        try { GLOSS = JSON.parse(x.responseText) || []; } catch (e) { GLOSS = []; }
        GLOSS = GLOSS.filter(function (g) { return g && g.abbr && g.abbr.length >= 2; })
          .sort(function (a, b) { return b.abbr.length - a.abbr.length; });
        cb(GLOSS);
      };
      x.onerror = function () { GLOSS = []; cb(GLOSS); };
      x.send();
    } catch (e) { GLOSS = []; cb(GLOSS); }
  }

  function isZhBefore(node, idx) {
    if (idx <= 0) return false;
    return /[\u4e00-\u9fff]/.test(node.nodeValue.charAt(idx - 1));
  }

  function mark(root, list) {
    var marked = 0;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        if (!n.nodeValue || n.nodeValue.length < 2) return NodeFilter.FILTER_REJECT;
        var p = n.parentNode;
        if (!p || SKIP_TAGS[p.nodeName]) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var targets = [];
    while (walker.nextNode()) targets.push(walker.currentNode);
    for (var i = 0; i < targets.length && marked < MAX_PER_PAGE; i++) {
      var node = targets[i], text = node.nodeValue, best = null, bestIdx = -1;
      for (var j = 0; j < list.length; j++) {
        var g = list[j];
        var re = new RegExp('(^|[^A-Za-z0-9])' + g.abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![A-Za-z0-9])');
        var m = re.exec(text);
        if (m) {
          var at = m.index + m[1].length;
          if (!isZhBefore(node, at)) { best = g; bestIdx = at; break; }
        }
      }
      if (!best) continue;
      var abbrEl = document.createElement('abbr');
      abbrEl.className = 'zeek-abbr';
      abbrEl.title = best.full + (best.cn ? ' · ' + best.cn : '');
      abbrEl.textContent = best.abbr;
      var after = node.splitText(bestIdx + best.abbr.length);
      node.parentNode.insertBefore(abbrEl, after);
      marked++;
    }
  }

  function run() {
    var scope = document.querySelector('.content') || document.querySelector('main') || document.body;
    if (!scope || !scope.querySelector) return;
    if (scope.dataset.abbrDone) return;
    scope.dataset.abbrDone = '1';
    load(function (list) { if (list.length) mark(scope, list); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
  var mo = new MutationObserver(function () {
    var scope = document.querySelector('.content');
    if (scope && !scope.dataset.abbrDone) run();
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();

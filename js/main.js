/* ============================================================
 * themes/zeek/source/js/main.js — 交互增强层
 * 移植自 blog-ui-prototype（SPA）→ hexo 静态多页站点适配版。
 * 原型的 hash 路由 / 视图渲染逻辑已删除（由 hexo 生成的真实页面替代），
 * 仅保留：主题三态、⌘K 搜索、TOC scrollspy、代码块复制、阅读进度条、
 * backtop、移动端抽屉、归档切换/筛选、fade-in、skip-link。
 * ============================================================ */
(function () {
  'use strict';

  var THEME_KEY = 'proto-theme'; // 与原型一致
  var root = document.documentElement;

  /* ---------- 主题三态（system / light / dark） ---------- */
  var mq = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme(mode) {
    if (mode === 'system') {
      delete root.dataset.theme; // 跟随系统（CSS 默认浅色 + JS 同步暗色变量）
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

  /* ---------- ⌘K / Ctrl+K / / 唤起搜索面板 ---------- */
  var searchIndex = null; // [{title,url,date,description,tags,categories}]
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
    var hay = [e.title, e.description, (e.tags || []).join(' '), (e.categories || []).join(' ')].join(' ').toLowerCase();
    return q.split(/\s+/).every(function (w) { return w && hay.indexOf(w) !== -1; });
  }
  function renderResults(q) {
    if (!cmdkResults) return;
    q = (q || '').trim().toLowerCase();
    var list = [];
    if (q) {
      list = (searchIndex || []).filter(function (e) { return matchEntry(e, q); }).slice(0, 12);
    } else {
      // 空查询：展示最近 8 篇（search.json 按 date 降序生成）
      list = (searchIndex || []).slice(0, 8);
    }
    selIdx = list.length ? 0 : -1;
    cmdkResults.innerHTML = list.map(function (e, i) {
      var cat = (e.tags && e.tags.length) ? e.tags[0] : (e.categories && e.categories[0]) || '文章';
      return '<a class="cmd-item' + (i === 0 ? ' sel' : '') + '" href="' + e.url + '" data-i="' + i + '">' +
        '<span class="cmd-ico">📄</span>' +
        '<span class="cmd-main"><b>' + esc(e.title) + '</b><span>' + esc(e.description || '') + '</span></span>' +
        '<span class="cmd-cat">' + esc(cat) + '</span></a>';
    }).join('') || '<div class="cmd-item" style="cursor:default"><span class="cmd-ico">🔍</span><span class="cmd-main"><b>没有匹配的结果</b></span></div>';
    var foot = document.getElementById('cmdkFoot');
    if (foot) foot.textContent = list.length ? (list.length + ' 条结果 · ↑↓ 选择 · Enter 打开 · Esc 关闭') : 'Esc 关闭';
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function goSel() {
    if (selIdx < 0 || !cmdkResults) return;
    var a = cmdkResults.querySelectorAll('a.cmd-item')[selIdx];
    if (a) { closeSearch(); location.href = a.getAttribute('href'); }
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
  // 404 / 其他页的「搜索」按钮
  var sbOpen = document.getElementById('openSearch');
  if (sbOpen) sbOpen.addEventListener('click', openSearch);
  document.addEventListener('keydown', function (ev) { // 关闭搜索按钮的 Enter
    if (ev.key === 'Enter' && document.activeElement === sbOpen) { openSearch(); }
  });

  /* ---------- TOC scrollspy（判定线 top<=96）+ 平滑滚动 ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll('.toc a[data-h]'));
  if (tocLinks.length) {
    var heads = tocLinks.map(function (a) {
      var el = document.querySelector('#view h2[id], #view h3[id]') && document.getElementById(a.dataset.h);
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
    window.addEventListener('scroll', function () {
      if (!ticking) { requestAnimationFrame(function () { spy(); ticking = false; }); ticking = true; }
    }, { passive: true });
    spy();
    // 点击平滑滚动（html scroll-behavior 已为 smooth，这里兜底 offset）
    tocLinks.forEach(function (a) {
      a.addEventListener('click', function (ev) {
        var t = document.getElementById(a.dataset.h);
        if (t) { ev.preventDefault(); t.scrollIntoView({ behavior: 'smooth', block: 'start' }); history.replaceState(null, '', '#' + a.dataset.h); }
      });
    });
  }

  /* ---------- 代码块：包 cb-bar + 语言标签 + 复制按钮 ---------- */
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
    // 若宿主已是 .codeblock（hexo 包了 wrapper）则 bar 插到最前，否则外包一层
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
  // hexo highlight（含行号）：figure.highlight > table > td.code > pre
  document.querySelectorAll('figure.highlight').forEach(function (fig) {
    var codePre = fig.querySelector('td.code pre') || fig.querySelector('pre');
    var cls = (fig.querySelector('td.code') || fig).className || fig.className;
    enhanceCode(fig, function () {
      return codePre ? codePre.textContent : fig.textContent;
    }, langOf(cls));
  });
  // 裸 pre>code（无行号输出或非 highlight 语言）
  document.querySelectorAll('pre > code').forEach(function (code) {
    var pre = code.parentElement;
    if (pre.closest('figure.highlight') || pre.closest('.codeblock')) return;
    enhanceCode(pre, function () { return code.textContent; }, langOf(code.className));
  });

  /* ---------- 阅读进度条 + backtop ---------- */
  var progress = document.querySelector('.progress');
  var progressBar = document.querySelector('.progress-bar');
  var backtop = document.getElementById('backtop');
  var isPost = document.body && document.body.dataset.page === 'post';
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop;
    if (progress && isPost && progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.width = (max > 0 ? Math.min(y / max * 100, 100) : 0) + '%';
    }
    if (backtop) backtop.classList.toggle('show', y > 400);
  }
  if (progress) progress.style.display = 'block';
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (backtop) backtop.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }); });

  /* ---------- 移动端抽屉 ---------- */
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
  // 侧栏折叠（单监听，勿再叠加内联 onclick 否则双触发互相抵消）
  document.querySelectorAll('.sidegroup > .sg-head').forEach(function (h) {
    h.addEventListener('click', function () { h.parentElement.classList.toggle('collapsed'); });
  });
  // 二级细分分类：点击箭头展开/收起文章列表（点击分类名仍走导航）
  document.querySelectorAll('.sg-sub .subarrow').forEach(function (a) {
    var toggle = function () { a.closest('.sg-sub').classList.toggle('collapsed'); };
    a.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); toggle(); });
    a.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } });
  });
  // 默认折叠全部领域组与细分分类：仅展开当前页所在的领域组与细分分类；分类领域页（唯一分组）展开
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

  /* ---------- 归档页：分组方式切换 + 客户端筛选 ---------- */
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
      // 领域分组：全部细分组都无命中时整组隐藏
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

  /* ---------- fade-in（页面 load 触发一次） ---------- */
  var content = document.getElementById('view');
  if (content) {
    content.classList.add('fade-in');
    window.addEventListener('load', function () { content.classList.remove('fade-in'); void content.offsetWidth; content.classList.add('fade-in'); });
    // 首屏也做一次入场动画（DOMContentLoaded 即脚本执行时刻）
  }

  /* ---------- skip-link 聚焦 ---------- */
  var skip = document.querySelector('.skip-link');
  if (skip) skip.addEventListener('click', function () {
    var t = document.getElementById(skip.getAttribute('href').slice(1));
    if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
  });

  /* ============================================================
   * 装饰增强层（config.zeek 开关，_config.yml zeek 段 → window.ZEEK_CFG）
   * KaTeX 数学 / mermaid 图 / live2d 形象 / 背景音乐 / 滚动显现
   * 全部失败静默：CDN 不可达时页面退化为纯文本/代码块，不阻塞交互。
   * ============================================================ */
  var CFG = window.ZEEK_CFG || {};
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- KaTeX：正文含 $..$ / $$..$$ / \(..\) 时渲染 ---------- */
  function loadScript(src, onload, onerror) {
    var s = document.createElement('script');
    s.src = src; s.defer = true;
    s.onload = onload || null; s.onerror = onerror || null;
    document.head.appendChild(s);
    return s;
  }
  var view = document.getElementById('view');
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

  /* ---------- mermaid：渲染 div.mermaid（构建期已生成）+ 旧形态 pre>code.language-mermaid ---------- */
  if (CFG.mermaid) {
    var mmDivs = [];
    document.querySelectorAll('div.mermaid').forEach(function (div) {
      mmDivs.push({ div: div, pre: null });
    });
    document.querySelectorAll('pre > code.language-mermaid').forEach(function (code) {
      var pre = code.parentElement;
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

  /* ---------- live2d 形象（CDN widget，失败静默；窄屏/减少动效不加载） ---------- */
  if (CFG.mascot && !reduceMotion && window.innerWidth > 900) {
    loadScript('https://fastly.jsdelivr.net/gh/stevenjoezhang/live2d-widget@latest/autoload.js');
  }

  /* ---------- 背景音乐：顶部 🎵 开关，音频 404 时按钮自动隐藏 ---------- */
  (function () {
    if (!CFG.bgm) return;
    var btn = document.getElementById('bgmBtn');
    if (!btn) return;
    var audio = new Audio(CFG.bgm);
    audio.loop = true;
    audio.volume = 0.35;
    audio.addEventListener('error', function () { btn.hidden = true; });
    btn.addEventListener('click', function () {
      if (audio.paused) { audio.play().catch(function () { btn.hidden = true; }); btn.classList.add('on'); }
      else { audio.pause(); btn.classList.remove('on'); }
    });
    btn.hidden = false;
  })();

  /* ---------- 滚动显现：正文块 / 领域卡 / 归档组 进入视口后淡入上移 ---------- */
  (function () {
    if (reduceMotion || !('IntersectionObserver' in window)) return;
    var targets = [];
    if (view) {
      if (document.body.dataset.page === 'post') {
        // 文章：除面包屑外逐块显现
        Array.prototype.forEach.call(view.children, function (el) {
          if (!el.classList.contains('crumb')) targets.push(el);
        });
      } else {
        targets = Array.prototype.slice.call(view.querySelectorAll('.cat-card, .archdomain, .postlist, .hotlist, details.archgroup'));
      }
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

  /* ---------- 评论 giscus（第六轮）：进入视口懒加载，主题切换同步 ---------- */
  (function () {
    var wrap = document.getElementById('giscusWrap');
    var box = document.getElementById('giscusBox');
    var g = CFG.giscus;
    if (!wrap || !box || !g || !g.repo) return;
    var currentTheme = getTheme();
    function giscusTheme(mode) { return mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : (mq.matches ? 'dark' : 'light'); }
    var loaded = false;
    function load() {
      if (loaded) return; loaded = true;
      var s = document.createElement('script');
      s.src = 'https://giscus.app/client.js';
      s.async = true; s.crossOrigin = 'anonymous';
      var params = {
        'data-repo': g.repo, 'data-repo-id': g.repoId,
        'data-category': g.category || 'Announcements', 'data-category-id': g.categoryId,
        'data-mapping': 'pathname', 'data-strict': '1',
        'data-reactions-enabled': '1', 'data-emit-metadata': '0',
        'data-input-position': 'top', 'data-theme': giscusTheme(currentTheme),
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
    // 主题切换 → 通知 giscus iframe 换肤
    function pushTheme() {
      var frame = document.querySelector('iframe.giscus-frame');
      if (!frame) return;
      frame.contentWindow.postMessage({ giscus: { setConfig: { theme: giscusTheme(getTheme()) } } }, 'https://giscus.app');
    }
    var origApply = applyTheme;
    applyTheme = function (mode) { origApply(mode); pushTheme(); };
    mq.addEventListener('change', function () { if (getTheme() === 'system') pushTheme(); });
  })();

  /* ---------- 图片点击放大（第六轮，自研 lightbox 零依赖） ---------- */
  (function () {
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

  /* ---------- 复制本文链接（第六轮） ---------- */
  (function () {
    var btn = document.querySelector('.copy-link');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var url = btn.getAttribute('data-url') || location.href;
      function done() {
        btn.classList.add('copied'); btn.textContent = '✓ 已复制';
        setTimeout(function () { btn.classList.remove('copied'); btn.textContent = '🔗 复制链接'; }, 1600);
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
  })();
})();

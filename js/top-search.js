/**
 * top-search.js — 全站顶部搜索框
 * 挂载点：① source/index.html 里的 #qs-search-mount（动态主页）
 *         ② 其余主题页自动挂到 Butterfly 顶部导航 #nav
 * 数据源：/search.json（由流水线 collect.js 从已发布文档生成）
 * 检索：标题 / 描述 / 标签 / 分类，前缀匹配权重最高，回车跳转第一条
 */
(function () {
  var DATA = null;
  var box, input, res;

  function norm(s) { return String(s || '').toLowerCase(); }

  function loadData() {
    if (DATA) return Promise.resolve(DATA);
    return fetch('/search.json').then(function (r) { return r.json(); }).then(function (j) {
      DATA = Array.isArray(j) ? j : [];
      return DATA;
    });
  }

  function score(d, q) {
    var t = norm(d.title), desc = norm(d.description);
    var tg = norm((d.tags || []).join(' ')), cg = norm((d.categories || []).join(' ')), dt = norm(d.date);
    if (t.indexOf(q) === 0) return 100;
    if (t.indexOf(q) > -1) return 80;
    if (tg.indexOf(q) > -1) return 55;
    if (cg.indexOf(q) > -1) return 45;
    if (desc.indexOf(q) > -1) return 25;
    if (dt.indexOf(q) > -1) return 15;
    return -1;
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function show(list, q) {
    if (!list.length) {
      res.innerHTML = '<div class="qs-empty">没有匹配「' + esc(q) + '」的文档</div>';
      res.classList.add('open');
      return;
    }
    res.innerHTML = list.map(function (d) {
      var meta = [d.date, (d.categories || []).join(' / '), (d.tags || []).map(function (t) { return '#' + t; }).join(' ')]
        .filter(Boolean).join(' · ');
      return '<a href="' + esc(d.url) + '"><span class="qs-r-title">' + esc(d.title) + '</span>' +
        (meta ? '<span class="qs-r-meta">' + esc(meta) + '</span>' : '') + '</a>';
    }).join('');
    res.classList.add('open');
  }

  function oninput() {
    var q = norm(input.value).trim();
    if (!q) { res.classList.remove('open'); res.innerHTML = ''; return; }
    loadData().then(function (data) {
      if (norm(input.value).trim() !== q) return; // 输入已变化
      var scored = [];
      for (var i = 0; i < data.length; i++) {
        var s = score(data[i], q);
        if (s > -1) scored.push([s, data[i]]);
      }
      scored.sort(function (a, b) { return b[0] - a[0]; });
      show(scored.slice(0, 8).map(function (x) { return x[1]; }), q);
    }).catch(function () { });
  }

  function init() {
    var mount = document.getElementById('qs-search-mount') ||
                document.getElementById('nav') ||
                document.getElementById('page-header');
    if (!mount || document.getElementById('qs-search')) return;
    box = document.createElement('div');
    box.className = 'qs-search';
    box.id = 'qs-search';
    box.innerHTML = '<span class="qs-search-ico" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">' +
      '<circle cx="11" cy="11" r="7"></circle><line x1="21" y1="21" x2="16.5" y2="16.5"></line></svg></span>' +
      '<input type="text" placeholder="搜索文档：标题 / 标签 / 分类…" autocomplete="off" aria-label="站内搜索">';
    res = document.createElement('div');
    res.className = 'qs-results';
    box.appendChild(res);
    mount.insertBefore(box, mount.firstChild);
    input = box.querySelector('input');
    input.addEventListener('input', oninput);
    input.addEventListener('focus', oninput);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var first = res.querySelector('a');
        if (first) location.href = first.getAttribute('href');
      } else if (e.key === 'Escape') {
        input.value = ''; res.classList.remove('open'); input.blur();
      }
    });
    document.addEventListener('click', function (e) {
      if (!box.contains(e.target)) res.classList.remove('open');
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

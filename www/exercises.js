/* AE — Gym exercise library: search (Persian/English), filters, animated demo (start/end frames), details. */
(function () {
  'use strict';
  var A = window.AE; if (!A) return;
  var S = A.S, fa = A.fa;
  var host = document.getElementById('ex-card'), root = document.getElementById('ex');
  if (!host || !root) return;
  var CDN = ['https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/', 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/'];
  var MU = { abdominals: 'شکم', abductors: 'ران بیرونی', adductors: 'ران داخلی', biceps: 'جلو بازو', calves: 'ساق پا', chest: 'سینه', forearms: 'ساعد', glutes: 'باسن', hamstrings: 'همسترینگ', lats: 'زیربغل', 'lower back': 'کمر', 'middle back': 'میان‌کمر', neck: 'گردن', quadriceps: 'چهارسر ران', shoulders: 'سرشانه', traps: 'ذوزنقه', triceps: 'پشت بازو' };
  var EQ = { barbell: 'هالتر', dumbbell: 'دمبل', cable: 'کابل', machine: 'دستگاه', kettlebells: 'کتل‌بل', bands: 'کش', 'body only': 'وزن بدن', 'e-z curl bar': 'هالتر ای‌زد', 'medicine ball': 'توپ مدیسن', 'exercise ball': 'توپ سوئیسی', 'foam roll': 'فوم رولر', other: 'سایر', none: 'بدون وسیله' };
  var LV = { beginner: 'مبتدی', intermediate: 'متوسط', expert: 'پیشرفته' };
  var CT = { strength: 'قدرتی', stretching: 'کششی', plyometrics: 'پلایومتریک', powerlifting: 'پاورلیفتینگ', 'olympic weightlifting': 'وزنه‌برداری المپیک', strongman: 'استرانگ‌من', cardio: 'هوازی' };
  var MKEYS = ['chest', 'lats', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'glutes', 'calves', 'abdominals', 'lower back', 'middle back', 'traps', 'forearms', 'neck', 'adductors', 'abductors'];
  var EKEYS = ['body only', 'dumbbell', 'barbell', 'machine', 'cable', 'kettlebells', 'bands', 'e-z curl bar', 'exercise ball', 'medicine ball', 'foam roll', 'other', 'none'];

  var data = null, loading = null;
  var V = { open: false, q: '', mu: '', eq: '', ct: '', fav: false, sel: -1, n: 40 };
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function favs() { return (S.exfav = S.exfav || {}); }
  function norm(s) {
    return String(s || '').toLowerCase().replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[‌‍ً-ٟ]/g, '').replace(/[۰-۹]/g, function (d) { return d.charCodeAt(0) - 1776; }).replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 1632; }).replace(/[أإآ]/g, 'ا').replace(/ۀ|ة/g, 'ه').replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();
  }
  function img(it, k) { return CDN[0] + it.g + '/' + k + '.jpg'; }
  // hand-written search hints (synonyms Persians really use)
  var SYN = [[/curl/, 'جلو بازو بایسپس'], [/triceps|tricep/, 'پشت بازو ترایسپس'], [/bench press/, 'پرس سینه'], [/lat pulldown|pulldown/, 'زیربغل سیمکش لت'], [/row/, 'زیربغل روئینگ قایقی'], [/squat/, 'اسکات اسکوات'], [/deadlift/, 'ددلیفت ددلیفت'], [/lunge/, 'لانچ لانج'], [/push-up|pushup/, 'شنا سوئدی'], [/pull-up|pullup|chin/, 'بارفیکس'], [/crunch|sit-up/, 'کرانچ دراز نشست شکم'], [/calf/, 'ساق پا'], [/shoulder press|military/, 'پرس سرشانه پرس شانه'], [/lateral raise|side lateral/, 'نشر جانب نشر از طرفین'], [/fly|flye/, 'فلای قفسه'], [/hip thrust|bridge/, 'هیپ ترست هیپ تراست پل'], [/leg press/, 'پرس پا'], [/leg extension/, 'جلو پا لگ اکستنشن'], [/leg curl/, 'پشت پا لگ کرل'], [/shrug/, 'شراگ زیر کول'], [/plank/, 'پلانک']];
  function build() {
    data.forEach(function (it, i) {
      it.i = i;
      var syn = ''; SYN.forEach(function (s) { if (s[0].test(it.n.toLowerCase())) syn += ' ' + s[1]; });
      var mus = it.p.concat(it.s).map(function (m) { return MU[m] || m; }).join(' ');
      it.hay = norm(it.f + ' ' + it.n + ' ' + mus + ' ' + (EQ[it.e] || '') + ' ' + it.e + ' ' + (CT[it.c] || '') + ' ' + (LV[it.l] || '') + syn);
    });
  }
  function load() {
    if (data) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = 'exdata.js';
      s.onload = function () { data = window.AE_EX || []; build(); res(); }; s.onerror = function () { loading = null; rej(); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function filtered() {
    var toks = norm(V.q).split(' ').filter(Boolean), f = favs();
    return data.filter(function (it) {
      if (V.fav && !f[it.i]) return false;
      if (V.mu && it.p.indexOf(V.mu) < 0 && it.s.indexOf(V.mu) < 0) return false;
      if (V.eq && it.e !== V.eq) return false;
      if (V.ct && it.c !== V.ct) return false;
      for (var k = 0; k < toks.length; k++) if (it.hay.indexOf(toks[k]) < 0) return false;
      return true;
    }).sort(function (a, b) {
      if (!toks.length) return 0;
      var qa = norm(a.f).indexOf(toks[0]) === 0 || norm(a.n).indexOf(toks[0]) === 0 ? 0 : 1, qb = norm(b.f).indexOf(toks[0]) === 0 || norm(b.n).indexOf(toks[0]) === 0 ? 0 : 1;
      return qa - qb;
    });
  }
  function thumb(it, cls) {
    if (!it.g) return '<div class="xth ' + (cls || '') + ' none">🏋️</div>';
    return '<div class="xth ' + (cls || '') + '"><img loading="lazy" decoding="async" alt="" src="' + img(it, 0) + '" data-i="' + it.i + '"></div>';
  }
  function card(it) {
    var m = it.p.map(function (x) { return MU[x] || x; }).join('، ');
    return '<button type="button" class="xrow glass" data-i="' + it.i + '">' + thumb(it) + '<div class="xtx"><b>' + esc(it.f) + '</b><small dir="ltr">' + esc(it.n) + '</small><span>' + esc(m) + ' · ' + esc(EQ[it.e] || it.e) + '</span></div>' + (favs()[it.i] ? '<i class="xf">♥</i>' : '') + '</button>';
  }
  function chips(list, map, cur, attr) {
    return '<div class="xchips" data-a="' + attr + '"><button data-v="" class="' + (!cur ? 'on' : '') + '">همه</button>' + list.map(function (k) { return '<button data-v="' + k + '" class="' + (cur === k ? 'on' : '') + '">' + map[k] + '</button>'; }).join('') + '</div>';
  }
  function shell() {
    root.innerHTML = '<div class="m-bg"><i></i><i></i><i></i></div><div class="x-screen" id="x-screen"><div class="m-head"><button type="button" class="ib glass" id="x-close" aria-label="بستن"><svg viewBox="0 0 24 24"><use href="#mi-back"/></svg></button><h1 class="grow">حرکت‌ها</h1><button type="button" class="ib glass' + (V.fav ? ' fav' : '') + '" id="x-fav" aria-label="علاقه‌مندی‌ها"><svg viewBox="0 0 24 24"><use href="#mi-heart"/></svg></button></div>' +
      '<div class="m-search glass"><svg viewBox="0 0 24 24"><use href="#mi-search"/></svg><input id="x-q" placeholder="جستجو: جلو بازو، squat، پرس سینه…" autocomplete="off" value="' + esc(V.q) + '"></div>' +
      '<div class="xlbl">عضله</div>' + chips(MKEYS, MU, V.mu, 'mu') + '<div class="xlbl">وسیله</div>' + chips(EKEYS, EQ, V.eq, 'eq') + '<div class="xlbl">نوع</div>' + chips(['strength', 'stretching', 'plyometrics', 'cardio', 'powerlifting', 'olympic weightlifting', 'strongman'], CT, V.ct, 'ct') +
      '<div class="xcount" id="x-count"></div><div id="x-list"></div><div id="x-more"></div></div><div id="x-detail" class="x-detail hidden"></div>';
    $('#x-close').onclick = close; $('#x-fav').onclick = function () { V.fav = !V.fav; V.n = 40; this.classList.toggle('fav', V.fav); list(); };
    var q = $('#x-q'); var tm; q.oninput = function () { clearTimeout(tm); tm = setTimeout(function () { V.q = q.value; V.n = 40; list(); }, 150); };
    Array.prototype.forEach.call(root.querySelectorAll('.xchips'), function (c) {
      c.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; V[c.dataset.a] = b.dataset.v; V.n = 40; Array.prototype.forEach.call(c.children, function (x) { x.classList.toggle('on', x === b); }); list(); });
    });
    $('#x-list').addEventListener('click', function (e) { var r = e.target.closest('.xrow'); if (r) detail(+r.dataset.i); });
    $('#x-more').addEventListener('click', function () { V.n += 40; list(true); });
    list();
  }
  function $(s) { return root.querySelector(s); }
  function list() {
    var l = $('#x-list'); if (!l) return;
    var r = filtered(), shown = r.slice(0, V.n);
    $('#x-count').textContent = fa(r.length) + ' حرکت';
    l.innerHTML = shown.length ? shown.map(card).join('') : '<div class="m-hint">حرکتی پیدا نشد. اسم دیگه‌ای امتحان کن یا فیلترها رو بردار.</div>';
    $('#x-more').innerHTML = r.length > shown.length ? '<button type="button" class="m-btn ghost glass xmore">نمایش بیشتر (' + fa(r.length - shown.length) + ' حرکت دیگه)</button>' : '';
    Array.prototype.forEach.call(l.querySelectorAll('img'), function (im) { im.onerror = fallback; });
  }
  function fallback() {
    var im = this; if (im.dataset.fb) { im.style.display = 'none'; return; }
    im.dataset.fb = 1; var it = data[+im.dataset.i], k = (im.dataset.k || 0);
    im.src = CDN[1] + it.g + '/' + k + '.jpg';
  }
  function detail(i) {
    var it = data[i], d = $('#x-detail'); V.sel = i;
    var mp = it.p.map(function (x) { return '<span class="xtag on">' + (MU[x] || x) + '</span>'; }).join(''), ms = it.s.map(function (x) { return '<span class="xtag">' + (MU[x] || x) + '</span>'; }).join('');
    var anim = it.g ? '<div class="xanim"><img alt="" data-i="' + i + '" data-k="0" src="' + img(it, 0) + '"><img alt="" class="b" data-i="' + i + '" data-k="1" src="' + img(it, it.k > 1 ? 1 : 0) + '"><span class="xbadge">شروع ⇄ پایان</span></div>' : '<div class="xanim none">🏋️</div>';
    d.innerHTML = '<div class="x-dscroll"><div class="m-head"><button type="button" class="ib glass" id="xd-close" aria-label="بازگشت"><svg viewBox="0 0 24 24"><use href="#mi-back"/></svg></button><div class="grow"></div><button type="button" class="ib glass' + (favs()[i] ? ' fav' : '') + '" id="xd-fav" aria-label="علاقه‌مندی"><svg viewBox="0 0 24 24"><use href="#mi-heart"/></svg></button></div>' + anim +
      '<h2 class="xdn">' + esc(it.f) + '</h2><div class="xde" dir="ltr">' + esc(it.n) + '</div>' +
      '<div class="xlbl">عضله اصلی</div><div class="xtags">' + mp + '</div>' + (ms ? '<div class="xlbl">عضلات کمکی</div><div class="xtags">' + ms + '</div>' : '') +
      '<div class="xinfo glass"><div><small>وسیله</small><b>' + esc(EQ[it.e] || it.e) + '</b></div><div><small>سطح</small><b>' + esc(LV[it.l] || it.l) + '</b></div><div><small>نوع</small><b>' + esc(CT[it.c] || it.c) + '</b></div></div>' +
      '<div class="xlbl">طرز اجرا <em class="xen">(متن انگلیسی)</em></div><ol class="xsteps" dir="ltr">' + it.t.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<div class="m-hint sm">برای آموزش بیشتر با مربی مشورت کن. با وزنه‌ی سبک شروع کن و فرم درست رو به وزن بالاتر ترجیح بده.</div></div>';
    d.classList.remove('hidden');
    $('#xd-close').onclick = function () { d.classList.add('hidden'); V.sel = -1; };
    $('#xd-fav').onclick = function () { var f = favs(); if (f[i]) delete f[i]; else f[i] = 1; A.save(); this.classList.toggle('fav', !!f[i]); list(); };
    Array.prototype.forEach.call(d.querySelectorAll('.xanim img'), function (im) { im.onerror = fallback; });
  }
  function open() {
    V.open = true; root.classList.remove('hidden'); document.body.classList.add('music-open');
    root.innerHTML = '<div class="m-bg"><i></i><i></i><i></i></div><div class="m-hint" style="padding-top:40vh">در حال بارگذاری حرکت‌ها…</div>';
    load().then(shell).catch(function () { root.innerHTML = '<div class="m-hint" style="padding-top:40vh">بارگذاری نشد. <button type="button" class="m-btn" id="x-retry" style="margin-top:12px">تلاش دوباره</button></div>'; var b = root.querySelector('#x-retry'); if (b) b.onclick = open; });
  }
  function close() { V.open = false; root.classList.add('hidden'); document.body.classList.remove('music-open'); }
  function renderCard() {
    var n = Object.keys(favs()).length;
    host.innerHTML = '<button type="button" class="xcard glass" id="x-open"><span class="xic">🏋️</span><div class="grow"><b>حرکت‌ها</b><small>۸۷۶ حرکت با انیمیشن و توضیح · جستجو به فارسی و انگلیسی' + (n ? ' · ' + fa(n) + ' ♥' : '') + '</small></div><svg viewBox="0 0 24 24"><use href="#mi-back"/></svg></button>';
    host.querySelector('#x-open').onclick = open;
  }
  renderCard();
  window.AEEx = { open: open, close: close, renderCard: renderCard, _t: { norm: norm, filtered: function () { return filtered(); }, V: V } };
})();

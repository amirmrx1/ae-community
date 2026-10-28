/* AE — Water tracker ("آب بخور"). Lives inside the Tasks tab. All data local (S.water). */
(function () {
  'use strict';
  var A = window.AE;
  if (!A) return;
  var S = A.S, fa = A.fa;
  var root = document.getElementById('water');
  var cardRoot = document.getElementById('water-card');
  if (!root || !cardRoot) return;

  /* ---------- data ---------- */
  var DRINKS = [
    { id: 'water', n: 'آب', ico: '💧', f: 1 },
    { id: 'sparkling', n: 'آب گازدار', ico: '🫧', f: 1 },
    { id: 'tea', n: 'چای', ico: '🍵', f: 0.9 },
    { id: 'coffee', n: 'قهوه', ico: '☕', f: 0.8 },
    { id: 'juice', n: 'آبمیوه', ico: '🧃', f: 0.85 },
    { id: 'milk', n: 'شیر', ico: '🥛', f: 0.9 },
    { id: 'doogh', n: 'دوغ', ico: '🍶', f: 0.9 },
    { id: 'soda', n: 'نوشابه', ico: '🥤', f: 0.7 }
  ];
  var ACT = [{ n: 'کم', m: 0.9 }, { n: 'متوسط', m: 1 }, { n: 'زیاد', m: 1.15 }, { n: 'خیلی زیاد', m: 1.3 }];
  var CHARS = [
    { n: 'آبی', need: 0 }, { n: 'کلاه‌دار', need: 1 }, { n: 'عینکی', need: 3 }, { n: 'شاه‌قطره', need: 5 },
    { n: 'پاپیونی', need: 8 }, { n: 'موزیکی', need: 12 }, { n: 'گل‌گلی', need: 18 }, { n: 'ستاره‌دار', need: 25 }
  ];
  var CHEERS = ['آفرین! 💧', 'ایول، یه لیوان دیگه!', 'بدنت ازت ممنونه 🙌', 'همینه، ادامه بده!', 'عالی بود!'];
  var NOTES = [
    ['وقتشه یه لیوان آب بخوری 💧', 'آبی تشنه‌شه! یه لیوان آب بخور.'],
    ['یه استراحت آبی ☕➡️💧', 'چند قلپ آب، تمرکزت رو بالا می‌بره.'],
    ['آب بخور، خسته نشی', 'امروز تا اینجا چقدر نوشیدی؟ یه لیوان دیگه بخور.']
  ];

  function W() {
    var w = S.water = S.water || {};
    if (typeof w.goal !== 'number') w.goal = 2000;
    if (typeof w.weight !== 'number') w.weight = 70;
    w.gender = w.gender || 'm'; if (typeof w.act !== 'number') w.act = 1;
    w.auto = !!w.auto;
    if (typeof w.cup !== 'number') w.cup = 250;
    w.drink = w.drink || 'water';
    w.custom = w.custom || [];
    w.cups = w.cups || [150, 200, 250, 300, 400, 500];
    w.days = w.days || {}; w.ach = w.ach || {};
    w.rem = w.rem || { on: false, every: 90, from: 8, to: 22 };
    if (typeof w.char !== 'number') w.char = 0;
    w.tab = w.tab || 'today';
    return w;
  }
  function allDrinks() { return DRINKS.concat(W().custom); }
  function drinkOf(id) { var a = allDrinks(); for (var i = 0; i < a.length; i++) if (a[i].id === id) return a[i]; return DRINKS[0]; }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function key(off) { var d = new Date(); d.setDate(d.getDate() + (off || 0)); return A.dayKey(d); }
  function rec(k) { return W().days[k]; }
  function total(k) { var r = rec(k); if (!r) return 0; return r.items.reduce(function (s, x) { return s + Math.round(x.ml * x.f); }, 0); }
  function goalOf(k) { var r = rec(k); return (r && r.goal) || W().goal; }
  function hit(k) { return total(k) >= goalOf(k) && total(k) > 0; }
  function pct(k) { return Math.min(100, Math.round(total(k) / goalOf(k) * 100)); }
  function ml(n) { return fa(Math.round(n)); }
  function calcGoal(w) {
    var base = w.weight * 33 * (w.gender === 'f' ? 0.92 : 1) * (ACT[w.act] || ACT[1]).m;
    return Math.min(5000, Math.max(1200, Math.round(base / 50) * 50));
  }
  function streak() {
    var n = 0, off = hit(key(0)) ? 0 : -1;
    for (var i = off; i > -400; i--) { if (hit(key(i))) n++; else break; }
    return n;
  }
  function bestStreak() {
    var ks = Object.keys(W().days).sort(), best = 0, cur = 0, prev = null;
    ks.forEach(function (k) {
      if (!hit(k)) { cur = 0; prev = null; return; }
      var p = k.split('-'), t = Date.UTC(+p[0], +p[1] - 1, +p[2]);
      cur = prev !== null && t - prev === 86400000 ? cur + 1 : 1; prev = t; best = Math.max(best, cur);
    });
    return best;
  }
  function daysHit() { return Object.keys(W().days).filter(hit).length; }
  function totalLiters() { return Object.keys(W().days).reduce(function (s, k) { return s + total(k); }, 0) / 1000; }
  function unlockedChars() { var d = daysHit(); return CHARS.filter(function (c) { return d >= c.need; }).length; }

  /* ---------- achievements ---------- */
  var ACH = [
    { id: 'first', n: 'اولین لیوان', ico: '🥛', ok: function () { return Object.keys(W().days).some(function (k) { return rec(k).items.length; }); } },
    { id: 'goal1', n: 'هدف امروز', ico: '🎯', ok: function () { return daysHit() >= 1; } },
    { id: 's3', n: '۳ روز پشت‌سرهم', ico: '🔥', ok: function () { return bestStreak() >= 3; } },
    { id: 's7', n: 'یک هفته کامل', ico: '🏅', ok: function () { return bestStreak() >= 7; } },
    { id: 'l10', n: '۱۰ لیتر', ico: '🪣', ok: function () { return totalLiters() >= 10; } },
    { id: 'l50', n: '۵۰ لیتر', ico: '🌊', ok: function () { return totalLiters() >= 50; } },
    { id: 'd30', n: '۳۰ روز ثبت', ico: '📆', ok: function () { return Object.keys(W().days).filter(function (k) { return rec(k).items.length; }).length >= 30; } },
    { id: 'early', n: 'سحرخیز', ico: '🌅', ok: function () { return Object.keys(W().days).some(function (k) { return rec(k).items.some(function (x) { return new Date(x.t).getHours() < 8; }); }); } }
  ];
  function checkAch() {
    var w = W(), fresh = [];
    ACH.forEach(function (a) { if (!w.ach[a.id] && a.ok()) { w.ach[a.id] = Date.now(); fresh.push(a); } });
    return fresh;
  }

  /* ---------- mascot (original character: a water drop) ---------- */
  var DROP = 'M100 12C100 12 24 100 24 152a76 76 0 0 0 152 0C176 100 100 12 100 12Z';
  function acc(i) {
    return [
      '',
      '<path d="M62 78q38-44 76 0z" fill="#8342eb"/><rect x="54" y="76" width="92" height="9" rx="4.5" fill="#b69cf5"/>',
      '<g fill="none" stroke="#1b1033" stroke-width="4"><circle cx="76" cy="146" r="17"/><circle cx="124" cy="146" r="17"/><path d="M93 146h14"/></g>',
      '<path d="M66 70l10-26 24 18 24-18 10 26z" fill="#ffd166" stroke="#e6a817" stroke-width="3" stroke-linejoin="round"/>',
      '<path d="M100 196l-22-12v24zM100 196l22-12v24z" fill="#ff5a8a"/><circle cx="100" cy="196" r="6" fill="#d63a6a"/>',
      '<path d="M40 150q0-62 60-62t60 62" fill="none" stroke="#1b1033" stroke-width="7"/><rect x="30" y="140" width="16" height="30" rx="8" fill="#8342eb"/><rect x="154" y="140" width="16" height="30" rx="8" fill="#8342eb"/>',
      '<g transform="translate(138 66)"><circle r="7" fill="#ffd166"/><g fill="#ff8fb1"><circle cx="0" cy="-12" r="7"/><circle cx="11" cy="-4" r="7"/><circle cx="7" cy="10" r="7"/><circle cx="-7" cy="10" r="7"/><circle cx="-11" cy="-4" r="7"/></g><circle r="6" fill="#ffd166"/></g>',
      '<path d="M100 26l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill="#ffd166" stroke="#e6a817" stroke-width="2" stroke-linejoin="round"/>'
    ][i] || '';
  }
  function dropSVG(idx, uid, p) {
    var wave = 'M-200 0q50-12 100 0t100 0t100 0t100 0t100 0t100 0t100 0t100 0V320H-200z';
    return '<svg viewBox="0 0 200 250" class="w-drop" aria-hidden="true">' +
      '<defs><clipPath id="c' + uid + '"><path d="' + DROP + '"/></clipPath>' +
      '<linearGradient id="g' + uid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fd8ff"/><stop offset="1" stop-color="#3d6bff"/></linearGradient></defs>' +
      '<path d="' + DROP + '" class="wd-glass"/>' +
      '<g clip-path="url(#c' + uid + ')"><g class="wd-level" style="transform:translateY(' + (238 - p * 2.26) + 'px)">' +
      '<path class="wd-wave w2" d="' + wave + '" fill="#6fd8ff" opacity=".45"/>' +
      '<path class="wd-wave w1" d="' + wave + '" fill="url(#g' + uid + ')"/></g></g>' +
      '<path d="' + DROP + '" class="wd-rim"/>' +
      '<g class="wd-face">' +
        '<g class="eyes-open"><ellipse cx="76" cy="150" rx="8" ry="10" fill="#1b1033"/><ellipse cx="124" cy="150" rx="8" ry="10" fill="#1b1033"/><circle cx="79" cy="146" r="3" fill="#fff"/><circle cx="127" cy="146" r="3" fill="#fff"/></g>' +
        '<g class="eyes-sleep"><path d="M66 152q10 8 20 0M114 152q10 8 20 0" fill="none" stroke="#1b1033" stroke-width="4"/></g>' +
        '<g class="eyes-happy"><path d="M66 154q10-14 20 0M114 154q10-14 20 0" fill="none" stroke="#1b1033" stroke-width="4.5"/></g>' +
        '<circle cx="58" cy="172" r="9" fill="#ff8fb1" opacity=".55"/><circle cx="142" cy="172" r="9" fill="#ff8fb1" opacity=".55"/>' +
        '<path class="m-sleep" d="M92 178h16" stroke="#1b1033" stroke-width="4" fill="none"/>' +
        '<path class="m-ok" d="M88 176q12 12 24 0" stroke="#1b1033" stroke-width="4.5" fill="none"/>' +
        '<path class="m-happy" d="M84 172q16 22 32 0z" fill="#1b1033"/>' +
        '<text class="zzz" x="140" y="110" fill="#fff" font-size="22" font-weight="800">z</text>' +
      '</g><g class="wd-acc">' + acc(idx) + '</g></svg>';
  }
  function moodOf(p) { return p === 0 ? 'sleep' : p < 60 ? 'ok' : 'happy'; }
  function say(p) {
    return p === 0 ? 'آبی خوابه… یه لیوان آب بدی بیدار می‌شه 😴' : p < 35 ? 'تشنه‌ام! یه لیوان آب بیار 💧' :
      p < 70 ? 'داری خوب پیش می‌ری، ادامه بده!' : p < 100 ? 'خیلی نزدیکی! یه کم دیگه 🔥' : 'هدف امروز تموم شد! 🎉';
  }

  /* ---------- reminders (local notifications) ---------- */
  var remTimer = null;
  function scheduleReminders() {
    clearTimeout(remTimer);
    remTimer = setTimeout(function () {
      var p = A.plugin && A.plugin(); if (!p) return;
      var w = W(), ids = [], i;
      for (i = 0; i < 48; i++) ids.push({ id: 9100 + i });
      p.cancel({ notifications: ids }).catch(function () {}).then(function () {
        if (!w.rem.on) return;
        var list = [], now = Date.now(), step = Math.max(30, w.rem.every);
        for (var d = 0; d < 3 && list.length < 48; d++) {
          if (d === 0 && hit(key(0))) continue;
          var base = new Date(); base.setDate(base.getDate() + d); base.setHours(0, 0, 0, 0);
          for (var m = w.rem.from * 60; m <= w.rem.to * 60 && list.length < 48; m += step) {
            var at = base.getTime() + m * 60000;
            if (at > now + 30000) list.push(at);
          }
        }
        if (!list.length) return;
        var left = Math.max(0, goalOf(key(0)) - total(key(0)));
        p.schedule({ notifications: list.map(function (at, j) {
          var n = NOTES[j % NOTES.length];
          return { id: 9100 + j, title: n[0], body: n[1], schedule: { at: new Date(at), allowWhileIdle: true } };
        }) }).catch(function () {});
      });
    }, 400);
  }

  /* ---------- effects ---------- */
  function buzz(p) { try { if (navigator.vibrate) navigator.vibrate(p || 25); } catch (e) {} }
  function splash(host) {
    for (var i = 0; i < 7; i++) {
      var d = document.createElement('i'); d.className = 'w-dp';
      d.style.left = (42 + Math.random() * 16) + '%'; d.style.animationDelay = (i * 60) + 'ms';
      d.style.setProperty('--dx', (Math.random() * 40 - 20) + 'px');
      host.appendChild(d); setTimeout(function (x) { x.remove(); }.bind(null, d), 1200);
    }
  }
  function confetti() {
    var c = ['#6fd8ff', '#8342eb', '#ffd166', '#ff8fb1', '#3ddc84'];
    for (var i = 0; i < 34; i++) {
      var s = document.createElement('i'); s.className = 'w-conf';
      s.style.left = Math.random() * 100 + '%'; s.style.background = c[i % c.length];
      s.style.animationDelay = Math.random() * 300 + 'ms'; s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      root.appendChild(s); setTimeout(function (x) { x.remove(); }.bind(null, s), 2400);
    }
  }

  /* ---------- logging ---------- */
  function addDrink(vol, drinkId, silent) {
    var w = W(), k = key(0), dr = drinkOf(drinkId || w.drink), before = total(k) >= goalOf(k);
    var r = w.days[k] = w.days[k] || { goal: w.goal, items: [] };
    r.items.push({ id: A.uid ? A.uid() : String(Date.now()), t: Date.now(), ml: vol, d: dr.id, f: dr.f });
    A.save();
    var done = !before && total(k) >= goalOf(k);
    buzz(done ? [60, 40, 120] : 25);
    if (!silent) {
      A.toast(CHEERS[Math.floor(Math.random() * CHEERS.length)] + ' +' + ml(vol) + ' میلی‌لیتر');
      var hero = root.querySelector('.w-hero'); if (hero) { splash(hero); var dd = hero.querySelector('.w-drop'); if (dd) { dd.classList.remove('gulp'); void dd.offsetWidth; dd.classList.add('gulp'); } }
    }
    if (done) { confetti(); setTimeout(function () { A.toast('🎉 هدف امروز کامل شد!'); }, 900); }
    checkAch().forEach(function (a, i) { setTimeout(function () { A.toast('🏆 دستاورد جدید: ' + a.n); }, 1800 + i * 2200); });
    refresh(); scheduleReminders();
  }
  function removeItem(k, id) {
    var r = rec(k); if (!r) return;
    r.items = r.items.filter(function (x) { return x.id !== id; });
    if (!r.items.length) delete W().days[k];
    A.save(); refresh(); scheduleReminders();
  }

  /* ---------- summary card (inside Tasks) ---------- */
  function renderCard() {
    var k = key(0), p = pct(k), t = total(k), g = goalOf(k);
    var C = 2 * Math.PI * 24, off = C * (1 - p / 100);
    cardRoot.innerHTML =
      '<div class="card water-card" id="wc-open" role="button">' +
        '<div class="wc-ring"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="24" class="wc-bg"/><circle cx="30" cy="30" r="24" class="wc-fg" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><span>💧</span></div>' +
        '<div class="grow"><div class="rc-title">آب بخور</div>' +
        '<div class="rc-sub">' + ml(t) + ' از ' + ml(g) + ' میلی‌لیتر · ' + fa(p) + '٪' + (streak() ? ' · 🔥 ' + fa(streak()) + ' روز' : '') + '</div></div>' +
        '<button class="wc-add" id="wc-quick" type="button">+ ' + ml(W().cup) + '</button></div>';
    document.getElementById('wc-open').addEventListener('click', open);
    document.getElementById('wc-quick').addEventListener('click', function (e) { e.stopPropagation(); addDrink(W().cup, null, true); A.toast('+' + ml(W().cup) + ' میلی‌لیتر ثبت شد 💧'); });
  }

  /* ---------- full screen ---------- */
  var built = false, uid = 0;
  function build() {
    var w = W(); uid++;
    root.innerHTML =
      '<div class="w-top"><button type="button" class="w-back" id="w-close" aria-label="بستن"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M9 6l6 6-6 6"/></svg></button>' +
      '<div class="grow"><h2>آب بخور</h2><div class="w-date" id="w-date"></div></div></div>' +
      '<div class="w-scroll">' +
        '<div class="w-hero" id="w-hero"></div>' +
        '<div class="seg w-tabs" id="w-tabs"><button data-t="today">امروز</button><button data-t="stats">آمار</button><button data-t="set">تنظیمات</button></div>' +
        '<div id="w-body"></div>' +
      '</div>';
    document.getElementById('w-close').addEventListener('click', close);
    document.getElementById('w-tabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; W().tab = b.dataset.t; A.save(); refresh();
    });
    built = true;
  }
  function heroHTML() {
    var k = key(0), p = pct(k), t = total(k), g = goalOf(k), extra = t - g;
    var idx = Math.min(W().char, unlockedChars() - 1);
    return '<div class="wh-stage m-' + moodOf(p) + (p >= 100 ? ' full' : '') + '">' + dropSVG(idx, uid, p) + '</div>' +
      '<div class="wh-say">' + say(p) + '</div>' +
      '<div class="wh-num"><b>' + ml(t) + '</b><span> / ' + ml(g) + ' میلی‌لیتر</span></div>' +
      '<div class="wh-sub">' + (extra > 0 ? '+' + ml(extra) + ' بیشتر از هدف 💪' : fa(p) + '٪ از هدف · ' + ml(g - t) + ' میلی‌لیتر مونده') + '</div>';
  }
  function refresh() {
    if (!built) return;
    var w = W();
    document.getElementById('w-date').textContent = A.jalali(new Date(), { weekday: 'long', day: 'numeric', month: 'long' });
    var hero = document.getElementById('w-hero');
    var level = hero.querySelector('.wd-level');
    if (level && hero.dataset.char === String(Math.min(w.char, unlockedChars() - 1))) {
      // in place update so the water level animates smoothly
      var p = pct(key(0));
      level.style.transform = 'translateY(' + (238 - p * 2.26) + 'px)';
      var st = hero.querySelector('.wh-stage'); st.className = 'wh-stage m-' + moodOf(p) + (p >= 100 ? ' full' : '');
      hero.querySelector('.wh-say').textContent = say(p);
      hero.querySelector('.wh-num').innerHTML = '<b>' + ml(total(key(0))) + '</b><span> / ' + ml(goalOf(key(0))) + ' میلی‌لیتر</span>';
      var ex = total(key(0)) - goalOf(key(0));
      hero.querySelector('.wh-sub').textContent = ex > 0 ? '+' + ml(ex) + ' بیشتر از هدف 💪' : fa(p) + '٪ از هدف · ' + ml(goalOf(key(0)) - total(key(0))) + ' میلی‌لیتر مونده';
    } else {
      hero.innerHTML = heroHTML(); hero.dataset.char = String(Math.min(w.char, unlockedChars() - 1));
    }
    hero.style.display = w.tab === 'today' ? '' : 'none';
    Array.prototype.forEach.call(document.querySelectorAll('#w-tabs button'), function (b) { b.classList.toggle('on', b.dataset.t === w.tab); });
    var body = document.getElementById('w-body');
    body.innerHTML = '';
    if (w.tab === 'today') bodyToday(body); else if (w.tab === 'stats') bodyStats(body); else bodySettings(body);
    renderCard();
  }

  /* --- today tab --- */
  function bodyToday(el) {
    var w = W(), dr = drinkOf(w.drink), k = key(0);
    var h = '<button type="button" class="w-big" id="w-add"><span class="wb-ico">' + dr.ico + '</span><span class="wb-t">+ ' + ml(w.cup) + ' میلی‌لیتر</span><span class="wb-s">' + esc(dr.n) + (dr.f < 1 ? ' · ' + fa(Math.round(dr.f * 100)) + '٪ آبرسانی' : '') + '</span></button>';
    h += '<div class="w-lbl">اندازه‌ی لیوان</div><div class="w-chips" id="w-cups">' +
      w.cups.map(function (c) { return '<button type="button" data-c="' + c + '" class="' + (c === w.cup ? 'on' : '') + '">' + ml(c) + '</button>'; }).join('') +
      '<button type="button" data-c="x" class="plus">+ دلخواه</button></div>';
    h += '<div class="w-lbl">نوع نوشیدنی</div><div class="w-chips w-drinks" id="w-drinks">' +
      allDrinks().map(function (d) { return '<button type="button" data-d="' + d.id + '" class="' + (d.id === w.drink ? 'on' : '') + '"><span>' + d.ico + '</span>' + esc(d.n) + '</button>'; }).join('') +
      '<button type="button" data-d="x" class="plus">+ نوشیدنی جدید</button></div>';
    var r = rec(k), items = r ? r.items.slice().reverse() : [];
    h += '<div class="w-lbl">ثبت‌های امروز</div>';
    if (!items.length) h += '<div class="w-empty">هنوز چیزی ثبت نکردی. اولین لیوانت رو بزن 👆</div>';
    else h += '<div class="w-log">' + items.map(function (x) {
      var d = drinkOf(x.d);
      return '<div class="w-row"><span class="wr-ico">' + d.ico + '</span><div class="grow"><b>' + esc(d.n) + '</b><small>' +
        A.jalali(new Date(x.t), { hour: '2-digit', minute: '2-digit', hour12: false }) + '</small></div><span class="wr-ml" data-e="' + x.id + '">' + ml(x.ml) + ' <small>میلی‌لیتر</small></span>' +
        '<button type="button" class="wr-del" data-x="' + x.id + '" aria-label="حذف">✕</button></div>';
    }).join('') + '</div><div class="w-hint">روی عدد بزن تا مقدارش رو اصلاح کنی.</div>';
    h += recap();
    el.innerHTML = h;
    el.querySelector('#w-add').addEventListener('click', function () { addDrink(W().cup); });
    el.querySelector('#w-cups').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.c === 'x') { var v = parseInt(faToEn(prompt('حجم لیوان رو بنویس (میلی‌لیتر)', '350')), 10); if (v >= 30 && v <= 2000) { var ww = W(); if (ww.cups.indexOf(v) < 0) { ww.cups.push(v); ww.cups.sort(function (a, b2) { return a - b2; }); } ww.cup = v; A.save(); refresh(); } }
      else { W().cup = +b.dataset.c; A.save(); refresh(); }
    });
    el.querySelector('#w-drinks').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.dataset.d === 'x') newDrink(); else { W().drink = b.dataset.d; A.save(); refresh(); }
    });
    Array.prototype.forEach.call(el.querySelectorAll('.wr-del'), function (b) { b.addEventListener('click', function () { removeItem(k, b.dataset.x); A.toast('حذف شد'); }); });
    Array.prototype.forEach.call(el.querySelectorAll('.wr-ml'), function (b) {
      b.addEventListener('click', function () {
        var it = rec(k).items.filter(function (x) { return x.id === b.dataset.e; })[0]; if (!it) return;
        var v = parseInt(faToEn(prompt('مقدار درست (میلی‌لیتر)', it.ml)), 10);
        if (v >= 10 && v <= 3000) { it.ml = v; A.save(); refresh(); scheduleReminders(); }
      });
    });
  }
  function faToEn(s) { return String(s == null ? '' : s).replace(/[۰-۹]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d); }); }
  function newDrink() {
    var n = (prompt('اسم نوشیدنی؟ (مثلاً اسموتی)') || '').trim().slice(0, 14); if (!n) return;
    var f = parseInt(faToEn(prompt('چند درصدش آب حساب بشه؟ (۱۰ تا ۱۰۰)', '80')), 10);
    if (!(f >= 10 && f <= 100)) f = 80;
    var ico = (prompt('یه ایموجی برای نوشیدنی (اختیاری)', '🥤') || '🥤').trim().slice(0, 2) || '🥤';
    var d = { id: 'c' + Date.now(), n: n, ico: ico, f: f / 100 };
    W().custom.push(d); W().drink = d.id; A.save(); refresh();
  }
  function recap() {
    var k = key(0), r = rec(k);
    if (!r || !r.items.length) return '';
    var p = pct(k), eff = total(k), n = r.items.length, first = new Date(r.items[0].t), last = new Date(r.items[n - 1].t);
    var avg7 = 0, c = 0; for (var i = -6; i <= 0; i++) { if (rec(key(i))) { avg7 += total(key(i)); c++; } }
    avg7 = c ? Math.round(avg7 / c) : 0;
    var t = fa(n) + ' بار نوشیدی و ' + fa(p) + '٪ هدف رو رفتی. اولین ثبتت ساعت ' + A.jalali(first, { hour: '2-digit', minute: '2-digit', hour12: false }) + ' بود.';
    if (c > 1) t += ' میانگین هفته‌ات ' + ml(avg7) + ' میلی‌لیتر در روزه' + (eff >= avg7 ? ' و امروز بالاترشی 👏' : '.');
    return '<div class="w-lbl">خلاصه‌ی امروز</div><div class="card w-recap">' + t + '</div>';
  }

  /* --- stats tab --- */
  function bodyStats(el) {
    var w = W(), bars = [], mx = 1, i, k;
    for (i = -6; i <= 0; i++) { k = key(i); var dt = new Date(); dt.setDate(dt.getDate() + i); bars.push({ k: k, t: total(k), g: goalOf(k), d: dt }); mx = Math.max(mx, total(k), goalOf(k)); }
    var h = '<div class="w-stats"><div class="card ws"><b>🔥 ' + fa(streak()) + '</b><small>استریک فعلی</small></div><div class="card ws"><b>🏆 ' + fa(bestStreak()) + '</b><small>بهترین استریک</small></div>' +
      '<div class="card ws"><b>🎯 ' + fa(daysHit()) + '</b><small>روز رسیدن به هدف</small></div><div class="card ws"><b>🪣 ' + fa(Math.round(totalLiters() * 10) / 10) + '</b><small>لیتر در کل</small></div></div>';
    h += '<div class="w-lbl">هفته‌ی اخیر</div><div class="card w-chart"><div class="wc-grid">' + bars.map(function (b) {
      var hh = Math.max(3, Math.round(b.t / mx * 100)), ok = b.t >= b.g && b.t > 0;
      return '<div class="wc-col"><div class="wc-val">' + (b.t ? fa(Math.round(b.t / 100) / 10) : '') + '</div><div class="wc-bar"><i class="' + (ok ? 'ok' : '') + '" style="height:' + hh + '%"></i><u style="bottom:' + Math.round(b.g / mx * 100) + '%"></u></div><small>' + A.jalali(b.d, { weekday: 'short' }) + '</small></div>';
    }).join('') + '</div><div class="wc-leg">ستون‌ها به لیتر · خط = هدف روزانه</div></div>';
    h += '<div class="w-lbl">تقویم ۲۸ روز اخیر</div><div class="card"><div class="w-cal">';
    for (i = -27; i <= 0; i++) { k = key(i); var q = rec(k) ? Math.min(1, total(k) / goalOf(k)) : -1; h += '<i style="' + (q >= 0 ? 'background:rgba(111,216,255,' + (0.18 + q * 0.7).toFixed(2) + ')' : '') + '" class="' + (q >= 1 ? 'full' : '') + (i === 0 ? ' today' : '') + '"></i>'; }
    h += '</div></div>';
    var un = unlockedChars();
    h += '<div class="w-lbl">شخصیت‌ها <small>(با هر روز رسیدن به هدف بازتر می‌شن)</small></div><div class="w-chars">' + CHARS.map(function (c, j) {
      var open = j < un;
      return '<button type="button" class="wch ' + (open ? '' : 'lock') + (j === Math.min(w.char, un - 1) ? ' on' : '') + '" data-ch="' + j + '"><div class="wch-art">' + (open ? dropSVG(j, 'c' + j, 70) : '<span>🔒</span>') + '</div><small>' + (open ? c.n : fa(c.need) + ' روز هدف') + '</small></button>';
    }).join('') + '</div>';
    h += '<div class="w-lbl">دستاوردها</div><div class="w-ach">' + ACH.map(function (a) {
      var ok = !!w.ach[a.id]; return '<div class="wa ' + (ok ? 'on' : '') + '"><span>' + (ok ? a.ico : '🔒') + '</span><small>' + a.n + '</small></div>';
    }).join('') + '</div>';
    el.innerHTML = h;
    Array.prototype.forEach.call(el.querySelectorAll('.wch:not(.lock)'), function (b) { b.addEventListener('click', function () { W().char = +b.dataset.ch; A.save(); refresh(); A.toast('شخصیتت عوض شد'); }); });
  }

  /* --- settings tab --- */
  function bodySettings(el) {
    var w = W();
    var h = '<div class="card w-set"><div class="ws-t">هدف روزانه</div>' +
      '<div class="ws-r"><label>محاسبه‌ی خودکار از وزن و فعالیت</label><button type="button" class="sw ' + (w.auto ? 'on' : '') + '" id="s-auto"></button></div>';
    if (w.auto) {
      h += '<div class="ws-r"><label>وزن (کیلوگرم)</label><input class="input num" id="s-weight" inputmode="numeric" value="' + w.weight + '"></div>' +
        '<div class="ws-r"><label>جنسیت</label><div class="seg mini" id="s-gender"><button data-g="m" class="' + (w.gender === 'm' ? 'on' : '') + '">آقا</button><button data-g="f" class="' + (w.gender === 'f' ? 'on' : '') + '">خانم</button></div></div>' +
        '<div class="ws-r"><label>میزان فعالیت</label><select class="input" id="s-act">' + ACT.map(function (a, i) { return '<option value="' + i + '"' + (i === w.act ? ' selected' : '') + '>' + a.n + '</option>'; }).join('') + '</select></div>' +
        '<div class="ws-note">هدف پیشنهادی: <b>' + ml(calcGoal(w)) + '</b> میلی‌لیتر</div>';
    } else {
      h += '<div class="ws-r"><label>هدف (میلی‌لیتر)</label><input class="input num" id="s-goal" inputmode="numeric" value="' + w.goal + '"></div>';
    }
    h += '<div class="ws-note">این عدد یه تخمین عمومیه، نه توصیه‌ی پزشکی. نیاز بدن به آب با فعالیت، هوا، رژیم و بیماری‌ها فرق می‌کنه؛ اگه مشکل خاصی داری با پزشکت چک کن.</div></div>';
    h += '<div class="card w-set"><div class="ws-t">یادآوری</div>' +
      '<div class="ws-r"><label>اعلان یادآوری آب</label><button type="button" class="sw ' + (w.rem.on ? 'on' : '') + '" id="s-rem"></button></div>';
    if (w.rem.on) {
      h += '<div class="ws-r"><label>هر چند دقیقه</label><select class="input" id="s-every">' + [45, 60, 90, 120, 180].map(function (m) { return '<option value="' + m + '"' + (m === w.rem.every ? ' selected' : '') + '>' + fa(m) + ' دقیقه</option>'; }).join('') + '</select></div>' +
        '<div class="ws-r"><label>از ساعت</label><select class="input" id="s-from">' + hours(w.rem.from, 5, 14) + '</select></div>' +
        '<div class="ws-r"><label>تا ساعت</label><select class="input" id="s-to">' + hours(w.rem.to, 16, 24) + '</select></div>' +
        '<div class="ws-note">وقتی به هدف روز برسی، یادآوری‌های اون روز خودکار قطع می‌شه. اگه اعلان نیومد، اجازه‌ی نوتیفیکیشن اپ رو تو تنظیمات گوشی چک کن.</div>';
    }
    h += '</div><button type="button" class="btn-ghost" id="s-reset">پاک کردن ثبت‌های امروز</button>';
    el.innerHTML = h;
    var q = function (s) { return el.querySelector(s); };
    q('#s-auto').addEventListener('click', function () { w.auto = !w.auto; if (w.auto) { w.goal = calcGoal(w); } A.save(); refresh(); });
    if (w.auto) {
      var upd = function () { w.goal = calcGoal(w); A.save(); var n = q('.ws-note b'); if (n) n.textContent = ml(w.goal); renderCard(); };
      q('#s-weight').addEventListener('input', function () { var v = parseInt(faToEn(this.value), 10); if (v >= 20 && v <= 300) { w.weight = v; upd(); } });
      q('#s-act').addEventListener('change', function () { w.act = +this.value; upd(); });
      q('#s-gender').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; w.gender = b.dataset.g; upd(); refresh(); });
    } else {
      q('#s-goal').addEventListener('change', function () { var v = parseInt(faToEn(this.value), 10); if (v >= 500 && v <= 8000) { w.goal = v; A.save(); renderCard(); } else { this.value = w.goal; A.toast('هدف باید بین ۵۰۰ تا ۸۰۰۰ باشه'); } });
    }
    q('#s-rem').addEventListener('click', function () { w.rem.on = !w.rem.on; if (w.rem.on && A.ensurePerm) A.ensurePerm(); A.save(); scheduleReminders(); refresh(); });
    if (w.rem.on) {
      q('#s-every').addEventListener('change', function () { w.rem.every = +this.value; A.save(); scheduleReminders(); });
      q('#s-from').addEventListener('change', function () { w.rem.from = +this.value; A.save(); scheduleReminders(); });
      q('#s-to').addEventListener('change', function () { w.rem.to = +this.value; A.save(); scheduleReminders(); });
    }
    q('#s-reset').addEventListener('click', function () { if (confirm('همه‌ی ثبت‌های امروز پاک بشه؟')) { delete w.days[key(0)]; A.save(); scheduleReminders(); refresh(); } });
  }
  function hours(sel, a, b) { var s = ''; for (var i = a; i <= b; i++) s += '<option value="' + i + '"' + (i === sel ? ' selected' : '') + '>' + fa(i) + ':۰۰</option>'; return s; }

  /* ---------- open / close ---------- */
  function open() {
    var w = W();
    if (w.auto) { w.goal = calcGoal(w); }
    build(); w.tab = 'today';
    root.classList.remove('hidden'); root.classList.add('in');
    refresh();
    root.querySelector('.w-scroll').scrollTop = 0;
  }
  function close() {
    root.classList.add('hidden'); root.classList.remove('in'); built = false; root.innerHTML = '';
    renderCard();
  }

  window.AEWater = { renderCard: renderCard, open: open };
  renderCard(); scheduleReminders();
})();

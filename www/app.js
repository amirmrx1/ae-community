(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- storage ---------- */
  var KEY = 'ae:v1';
  var defaults = {
    name: 'امیر',
    notes: [], tasks: [],
    timer: { dur: 300, running: false, endAt: 0, remain: 300 },
    pomo: { mode: 'focus', running: false, endAt: 0, remain: 1500, cycle: 0, total: 0, days: {}, minutes: {},
            set: { focus: 25, short: 5, long: 15, auto: false } }
  };
  var S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
    S.name = S.name || defaults.name;
    S.notes = S.notes || []; S.tasks = S.tasks || [];
    S.timer = Object.assign({}, defaults.timer, S.timer || {});
    S.pomo = Object.assign({}, defaults.pomo, S.pomo || {});
    S.pomo.set = Object.assign({}, defaults.pomo.set, S.pomo.set || {});
    S.pomo.days = S.pomo.days || {}; S.pomo.minutes = S.pomo.minutes || {};
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
  load();

  /* ---------- helpers ---------- */
  var nf = new Intl.NumberFormat('fa-IR');
  function fa(n) { return nf.format(n); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function faTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    var t = (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(s);
    return t.replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; });
  }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function dayOfYear(d) { return Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000); }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }
  function jalali(d, opts) { return new Intl.DateTimeFormat('fa-IR-u-ca-persian', opts).format(d); }

  /* ---------- native bridge (optional) ---------- */
  var LN = null;
  function plugin() {
    if (LN) return LN;
    var C = window.Capacitor;
    if (C && C.Plugins && C.Plugins.LocalNotifications) LN = C.Plugins.LocalNotifications;
    return LN;
  }
  var permAsked = false;
  function ensurePerm() {
    var p = plugin(); if (!p || permAsked) return;
    permAsked = true;
    p.checkPermissions().then(function (r) {
      if (r.display !== 'granted') return p.requestPermissions();
    }).catch(function () {});
  }
  function schedule(id, title, body, at) {
    var p = plugin(); if (!p) return;
    p.schedule({ notifications: [{ id: id, title: title, body: body, schedule: { at: new Date(at), allowWhileIdle: true } }] }).catch(function () {});
  }
  function cancel(id) { var p = plugin(); if (p) p.cancel({ notifications: [{ id: id }] }).catch(function () {}); }
  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext, c = new Ctx();
      [0, .28, .56].forEach(function (t) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = 880; o.connect(g); g.connect(c.destination);
        var s = c.currentTime + t; g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.35, s + .02); g.gain.exponentialRampToValueAtTime(.0001, s + .22);
        o.start(s); o.stop(s + .25);
      });
    } catch (e) {}
    if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 400]);
  }

  /* ---------- navigation ---------- */
  var current = 'home';
  function go(name) {
    current = name;
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'v-' + name); });
    $$('#tabbar button').forEach(function (b) { b.classList.toggle('on', b.dataset.go === name); });
    var act = $('#v-' + name); if (act) act.scrollTop = 0;
    if (name === 'home') renderHome();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]'); if (!t) return;
    go(t.dataset.go);
    var a = t.dataset.action;
    if (a === 'new-note') openEditor();
    if (a === 'focus-task') setTimeout(function () { $('#task-input').focus(); }, 150);
  });

  /* ---------- quote ---------- */
  function todaysQuote() {
    var d = new Date(); var i = (dayOfYear(d) + d.getFullYear()) % window.QUOTES.length;
    return { i: i, q: window.QUOTES[i] };
  }

  /* ---------- home ---------- */
  function greeting() {
    var h = new Date().getHours();
    return h < 5 ? 'شب بخیر' : h < 12 ? 'صبح بخیر' : h < 16 ? 'ظهر بخیر' : h < 19 ? 'عصر بخیر' : 'شب بخیر';
  }
  function renderHome() {
    $('#greet').textContent = greeting();
    $('#uname').textContent = S.name;
    $('#today-pill').textContent = jalali(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });
    var tq = todaysQuote(); $('#hq-en').textContent = tq.q[0]; $('#hq-fa').textContent = tq.q[1];
    var tot = S.tasks.length, done = S.tasks.filter(function (t) { return t.done; }).length;
    $('#home-task-sub').textContent = tot ? fa(done) + ' از ' + fa(tot) + ' تسک انجام شده' : 'هنوز تسکی اضافه نکردی';
    $('#home-task-bar').style.width = (tot ? Math.round(done / tot * 100) : 0) + '%';
    $('#home-notes-sub').textContent = fa(S.notes.length) + ' یادداشت';
    $('#home-pomo-sub').textContent = fa(S.pomo.days[dayKey()] || 0) + ' پومودورو امروز';
  }
  $('#uname').addEventListener('click', function () {
    var n = prompt('اسمت چیه؟', S.name);
    if (n && n.trim()) { S.name = n.trim().slice(0, 24); save(); renderHome(); }
  });

  /* ---------- notes ---------- */
  var editing = null;
  function renderNotes() {
    var q = $('#note-search').value.trim().toLowerCase();
    var list = S.notes.slice().sort(function (a, b) { return (b.pin - a.pin) || (b.upd - a.upd); })
      .filter(function (n) { return !q || (n.title + ' ' + n.body).toLowerCase().indexOf(q) > -1; });
    var box = $('#notes-list'); box.innerHTML = '';
    if (!list.length) { box.innerHTML = '<div class="empty">' + (q ? 'چیزی پیدا نشد.' : 'هنوز یادداشتی نداری.<br>با دکمه‌ی + اولین یادداشتت رو بنویس.') + '</div>'; return; }
    list.forEach(function (n) {
      var el = document.createElement('div'); el.className = 'card note' + (n.pin ? ' pinned' : '');
      el.innerHTML = (n.pin ? '<svg class="n-pin" viewBox="0 0 24 24"><use href="#i-pin"/></svg>' : '') +
        '<div class="n-title"></div><div class="n-body"></div><div class="n-date"></div>';
      $('.n-title', el).textContent = n.title || 'بدون عنوان';
      $('.n-body', el).textContent = n.body;
      $('.n-date', el).textContent = jalali(new Date(n.upd), { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      el.addEventListener('click', function () { openEditor(n.id); });
      box.appendChild(el);
    });
  }
  function openEditor(id) {
    var n = S.notes.filter(function (x) { return x.id === id; })[0];
    if (!n) { n = { id: uid(), title: '', body: '', pin: 0, upd: Date.now(), isNew: true }; }
    editing = n;
    $('#ed-title').value = n.title; $('#ed-body').value = n.body;
    $('#ed-pin').classList.toggle('on', !!n.pin);
    updateFoot();
    $('#editor').classList.remove('hidden');
    if (n.isNew) $('#ed-title').focus();
  }
  function updateFoot() {
    var len = $('#ed-body').value.length;
    $('#ed-foot').textContent = fa(len) + ' کاراکتر';
  }
  function closeEditor() {
    if (!editing) return;
    var t = $('#ed-title').value.trim(), b = $('#ed-body').value;
    var exists = S.notes.indexOf(editing) > -1;
    if (!t && !b.trim()) { if (exists) S.notes.splice(S.notes.indexOf(editing), 1); }
    else {
      var changed = t !== editing.title || b !== editing.body;
      editing.title = t; editing.body = b; if (changed) editing.upd = Date.now();
      delete editing.isNew;
      if (!exists) S.notes.push(editing);
    }
    editing = null; save(); $('#editor').classList.add('hidden'); renderNotes(); renderHome();
  }
  $('#note-add').addEventListener('click', function () { openEditor(); });
  $('#ed-back').addEventListener('click', closeEditor);
  $('#ed-body').addEventListener('input', updateFoot);
  $('#ed-pin').addEventListener('click', function () { editing.pin = editing.pin ? 0 : 1; this.classList.toggle('on', !!editing.pin); });
  $('#ed-del').addEventListener('click', function () {
    if (!confirm('این یادداشت حذف بشه؟')) return;
    var i = S.notes.indexOf(editing); if (i > -1) S.notes.splice(i, 1);
    editing = null; save(); $('#editor').classList.add('hidden'); renderNotes(); renderHome(); toast('یادداشت حذف شد');
  });
  $('#note-search').addEventListener('input', renderNotes);

  /* ---------- tasks ---------- */
  var filter = 'all', prio = 1, PN = ['کم', 'متوسط', 'زیاد'];
  function renderTasks() {
    var box = $('#tasks-list'); box.innerHTML = '';
    var list = S.tasks.filter(function (t) { return filter === 'all' || (filter === 'done' ? t.done : !t.done); })
      .sort(function (a, b) { return (a.done - b.done) || (b.p - a.p) || (b.c - a.c); });
    var tot = S.tasks.length, done = S.tasks.filter(function (t) { return t.done; }).length;
    $('#task-bar').style.width = (tot ? Math.round(done / tot * 100) : 0) + '%';
    if (!list.length) { box.innerHTML = '<div class="empty">' + (tot ? 'تسکی توی این فیلتر نیست.' : 'لیست خالیه. اولین تسکت رو اضافه کن و شروع کن.') + '</div>'; return; }
    list.forEach(function (t) {
      var el = document.createElement('div'); el.className = 'card task' + (t.done ? ' done' : '');
      el.innerHTML = '<div class="cb"><svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg></div><div class="tt"></div><span class="dot" data-p="' + t.p + '"></span><button class="x" aria-label="حذف"><svg viewBox="0 0 24 24"><use href="#i-trash"/></svg></button>';
      $('.tt', el).textContent = t.text;
      $('.cb', el).addEventListener('click', function () { t.done = !t.done; t.dt = t.done ? Date.now() : 0; save(); renderTasks(); renderHome(); });
      $('.tt', el).addEventListener('click', function () { t.done = !t.done; t.dt = t.done ? Date.now() : 0; save(); renderTasks(); renderHome(); });
      $('.x', el).addEventListener('click', function () { S.tasks.splice(S.tasks.indexOf(t), 1); save(); renderTasks(); renderHome(); });
      box.appendChild(el);
    });
  }
  function addTask() {
    var i = $('#task-input'), v = i.value.trim(); if (!v) return;
    S.tasks.push({ id: uid(), text: v, done: false, p: prio, c: Date.now() });
    i.value = ''; save(); renderTasks(); renderHome();
  }
  $('#task-add').addEventListener('click', addTask);
  $('#task-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') addTask(); });
  $('#task-prio').addEventListener('click', function () { prio = (prio + 1) % 3; this.dataset.p = prio; this.textContent = PN[prio]; });
  $('#task-filter').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return; filter = b.dataset.f;
    $$('#task-filter button').forEach(function (x) { x.classList.toggle('on', x === b); }); renderTasks();
  });

  /* ---------- ring helper ---------- */
  var CIRC = 2 * Math.PI * 90;
  function setRing(el, frac) { el.style.strokeDasharray = CIRC; el.style.strokeDashoffset = CIRC * (1 - Math.max(0, Math.min(1, frac))); }

  /* ---------- timer ---------- */
  var T = S.timer;
  function timerLeft() { return T.running ? Math.max(0, (T.endAt - Date.now()) / 1000) : T.remain; }
  function renderTimer() {
    var left = timerLeft();
    $('#timer-time').textContent = faTime(left);
    setRing($('#timer-ring'), T.dur ? left / T.dur : 0);
    $('#timer-sub').textContent = T.running ? 'در حال شمارش…' : (left <= 0 ? 'تموم شد' : (left < T.dur ? 'متوقف شده' : 'آماده'));
    $('#timer-toggle').textContent = T.running ? 'توقف' : (left < T.dur && left > 0 ? 'ادامه' : 'شروع');
    $$('#timer-presets button').forEach(function (b) { b.classList.toggle('on', +b.dataset.m * 60 === T.dur); });
  }
  function setTimer(sec) {
    if (T.running) { cancel(1001); }
    T.running = false; T.dur = Math.max(1, sec); T.remain = T.dur; save(); renderTimer();
  }
  $('#timer-presets').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) setTimer(+b.dataset.m * 60); });
  $('#timer-set').addEventListener('click', function () {
    var m = Math.max(0, parseInt($('#timer-min').value) || 0), s = Math.max(0, Math.min(59, parseInt($('#timer-sec').value) || 0));
    if (m * 60 + s < 1) { toast('یه زمان وارد کن'); return; } setTimer(m * 60 + s);
  });
  $('#timer-toggle').addEventListener('click', function () {
    ensurePerm();
    if (T.running) { T.remain = timerLeft(); T.running = false; cancel(1001); }
    else {
      if (T.remain <= 0) T.remain = T.dur;
      T.endAt = Date.now() + T.remain * 1000; T.running = true;
      schedule(1001, 'AE · تایمر', 'زمان تایمرت تموم شد ⏰', T.endAt);
    }
    save(); renderTimer();
  });
  $('#timer-reset').addEventListener('click', function () { cancel(1001); T.running = false; T.remain = T.dur; save(); renderTimer(); });

  /* ---------- pomodoro ---------- */
  var P = S.pomo, MODE_LABEL = { focus: 'زمان تمرکز', short: 'استراحت کوتاه', long: 'استراحت بلند' };
  function modeSecs(m) { return P.set[m] * 60; }
  function pLeft() { return P.running ? Math.max(0, (P.endAt - Date.now()) / 1000) : P.remain; }
  function renderPomo() {
    var left = pLeft(), total = modeSecs(P.mode);
    $('#pomo-time').textContent = faTime(left);
    setRing($('#pomo-ring'), left / total);
    $('#pomo-sub').textContent = MODE_LABEL[P.mode] + (P.running ? '' : (left < total ? ' · متوقف' : ''));
    $('#pomo-toggle').textContent = P.running ? 'توقف' : (left < total ? 'ادامه' : 'شروع');
    document.body.classList.toggle('pomo-break', P.mode !== 'focus');
    $$('#pomo-modes button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === P.mode); });
    var dots = $('#pomo-dots'); dots.innerHTML = '';
    for (var i = 0; i < 4; i++) { var d = document.createElement('i'); if (i < (P.cycle % 4)) d.className = 'on'; dots.appendChild(d); }
    var k = dayKey();
    $('#ps-today').textContent = fa(P.days[k] || 0); $('#ps-minutes').textContent = fa(P.minutes[k] || 0); $('#ps-total').textContent = fa(P.total);
  }
  function switchMode(m, autostart) {
    cancel(1002); P.mode = m; P.running = false; P.remain = modeSecs(m);
    if (autostart) startPomo();
    save(); renderPomo();
  }
  function startPomo() {
    ensurePerm();
    if (P.remain <= 0) P.remain = modeSecs(P.mode);
    P.endAt = Date.now() + P.remain * 1000; P.running = true;
    var msg = P.mode === 'focus' ? 'جلسه‌ی تمرکز تموم شد 🔥 وقت استراحته' : 'استراحت تموم شد. برگرد سر کار 💪';
    schedule(1002, 'AE · پومودورو', msg, P.endAt);
  }
  function pomoDone() {
    P.running = false;
    if (P.mode === 'focus') {
      var k = dayKey(); P.days[k] = (P.days[k] || 0) + 1; P.minutes[k] = (P.minutes[k] || 0) + P.set.focus; P.total++; P.cycle++;
      toast('یک پومودورو کامل شد 🔥'); beep();
      switchMode(P.cycle % 4 === 0 ? 'long' : 'short', P.set.auto);
    } else {
      toast('استراحت تموم شد. بزن بریم 💪'); beep();
      switchMode('focus', P.set.auto);
    }
  }
  $('#pomo-toggle').addEventListener('click', function () {
    if (P.running) { P.remain = pLeft(); P.running = false; cancel(1002); } else startPomo();
    save(); renderPomo();
  });
  $('#pomo-reset').addEventListener('click', function () { cancel(1002); P.running = false; P.remain = modeSecs(P.mode); save(); renderPomo(); });
  $('#pomo-skip').addEventListener('click', function () {
    cancel(1002); P.running = false;
    if (P.mode === 'focus') switchMode(((P.cycle + 1) % 4 === 0) ? 'long' : 'short'); else switchMode('focus');
  });
  $('#pomo-modes').addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) switchMode(b.dataset.mode); });
  [['focus', '#set-focus'], ['short', '#set-short'], ['long', '#set-long']].forEach(function (p) {
    var el = $(p[1]); el.value = P.set[p[0]];
    el.addEventListener('change', function () {
      var v = Math.max(1, Math.min(180, parseInt(el.value) || P.set[p[0]])); el.value = v; P.set[p[0]] = v;
      if (!P.running && P.mode === p[0]) P.remain = v * 60; save(); renderPomo();
    });
  });
  $('#set-auto').checked = !!P.set.auto;
  $('#set-auto').addEventListener('change', function () { P.set.auto = this.checked; save(); });

  /* ---------- tick ---------- */
  function tick() {
    if (T.running && Date.now() >= T.endAt) {
      T.running = false; T.remain = 0; save(); beep(); toast('تایمر تموم شد ⏰');
    }
    if (P.running && Date.now() >= P.endAt) pomoDone();
    if (current === 'timer') renderTimer();
    if (current === 'pomo') renderPomo();
  }
  setInterval(tick, 500);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { tick(); renderTimer(); renderPomo(); } });

  /* ---------- boot ---------- */
  function initState() {
    if (!T.running && T.remain > T.dur) T.remain = T.dur;
    if (!P.running && !P.remain) P.remain = modeSecs(P.mode);
    renderHome(); renderNotes(); renderTasks(); renderTimer(); renderPomo();
  }
  initState();

  var tq = todaysQuote();
  $('#q-en').textContent = tq.q[0]; $('#q-fa').textContent = tq.q[1];
  $('#q-day').textContent = jalali(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  var SPLASH_MS = 2900;
  setTimeout(function () {
    $('#splash').classList.add('out');
    $('#quote-screen').classList.remove('hidden');
    $('#app').classList.remove('hidden');
    setTimeout(function () { $('#splash').remove(); }, 700);
  }, SPLASH_MS);
  $('#q-go').addEventListener('click', function () {
    var qs = $('#quote-screen'); qs.classList.add('out'); setTimeout(function () { qs.remove(); }, 450);
  });
})();

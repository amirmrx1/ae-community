(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- storage ---------- */
  var KEY = 'ae:v1';
  var defaults = {
    name: '', named: false, deck: [], last: -1,
    notes: [], tasks: [],
    timer: { dur: 300, running: false, endAt: 0, remain: 300 },
    pomo: { mode: 'focus', running: false, endAt: 0, remain: 1500, cycle: 0, total: 0, days: {}, minutes: {},
            set: { focus: 25, short: 5, long: 15, auto: false } }
  };
  var S;
  function load() {
    try { S = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { S = {}; }
    S.name = S.name || ''; S.named = !!S.named; S.deck = S.deck || []; if (typeof S.last !== 'number') S.last = -1;
    S.notes = S.notes || []; S.tasks = S.tasks || [];
    S.timer = Object.assign({}, defaults.timer, S.timer || {});
    S.pomo = Object.assign({}, defaults.pomo, S.pomo || {});
    S.pomo.set = Object.assign({}, defaults.pomo.set, S.pomo.set || {});
    S.pomo.days = S.pomo.days || {}; S.pomo.minutes = S.pomo.minutes || {};
    S.coach = Object.assign({ mode: 'goggins', answers: null, plan: null }, S.coach || {});
    S.coach.hist = S.coach.hist || {}; S.coach.hist.goggins = S.coach.hist.goggins || []; S.coach.hist.money = S.coach.hist.money || [];
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
    if (name === 'gym') renderGym();
    if (name === 'coach') renderCoach();
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go]'); if (!t) return;
    go(t.dataset.go);
    var a = t.dataset.action;
    if (a === 'new-note') openEditor();
    if (a === 'focus-task') setTimeout(function () { $('#task-input').focus(); }, 150);
  });

  /* ---------- quote (a fresh one on every launch, no repeats until all 100 are seen) ---------- */
  function nextQuote() {
    var n = window.QUOTES.length;
    S.deck = (S.deck || []).filter(function (i) { return i >= 0 && i < n; });
    if (!S.deck.length) {
      var d = []; for (var i = 0; i < n; i++) d.push(i);
      for (var k = n - 1; k > 0; k--) { var r = Math.floor(Math.random() * (k + 1)), t = d[k]; d[k] = d[r]; d[r] = t; }
      if (d[0] === S.last) { var t2 = d[0]; d[0] = d[n - 1]; d[n - 1] = t2; }
      S.deck = d;
    }
    var idx = S.deck.shift(); S.last = idx; save();
    return { i: idx, q: window.QUOTES[idx] };
  }
  var LQ = nextQuote();

  /* ---------- home ---------- */
  function greeting() {
    var h = new Date().getHours();
    return h < 5 ? 'شب بخیر' : h < 12 ? 'صبح بخیر' : h < 16 ? 'ظهر بخیر' : h < 19 ? 'عصر بخیر' : 'شب بخیر';
  }
  function renderHome() {
    $('#greet').textContent = greeting();
    $('#uname').textContent = S.name;
    $('#today-pill').textContent = jalali(new Date(), { year: 'numeric', month: '2-digit', day: '2-digit' });
    $('#hq-en').textContent = LQ.q[0]; $('#hq-fa').textContent = LQ.q[1];
    var tot = S.tasks.length, done = S.tasks.filter(function (t) { return t.done; }).length;
    $('#home-task-sub').textContent = tot ? fa(done) + ' از ' + fa(tot) + ' تسک انجام شده' : 'هنوز تسکی اضافه نکردی';
    $('#home-task-bar').style.width = (tot ? Math.round(done / tot * 100) : 0) + '%';
    $('#home-notes-sub').textContent = fa(S.notes.length) + ' یادداشت';
    $('#home-pomo-sub').textContent = fa(S.pomo.days[dayKey()] || 0) + ' پومودورو امروز';
    $('#home-coach-sub').textContent = S.coach.plan ? 'پلنت آماده‌ست. بریم سراغ قدم‌های امروز' : 'آزمون بده، هدفت رو به قدم‌های روزانه تبدیل کن';
  }
  $('#uname').addEventListener('click', function () {
    var n = prompt('اسمت چیه؟', S.name);
    if (n && n.trim()) { S.name = n.trim().slice(0, 24); S.named = true; save(); renderHome(); }
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

  /* ---------- gym (images kept in IndexedDB so they stay on the phone) ---------- */
  var DB = null;
  function idb() {
    return new Promise(function (res, rej) {
      if (DB) return res(DB);
      var r = indexedDB.open('ae-gym', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('imgs', { keyPath: 'id' }); };
      r.onsuccess = function () { DB = r.result; res(DB); };
      r.onerror = function () { rej(r.error); };
    });
  }
  function gymAll() {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var q = db.transaction('imgs').objectStore('imgs').getAll();
        q.onsuccess = function () { res(q.result.sort(function (a, b) { return a.added - b.added; })); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function gymPut(rec) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('imgs', 'readwrite'); tx.objectStore('imgs').put(rec);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function gymDel(id) {
    return idb().then(function (db) {
      return new Promise(function (res, rej) {
        var tx = db.transaction('imgs', 'readwrite'); tx.objectStore('imgs').delete(id);
        tx.oncomplete = res; tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function shrink(file) {
    return new Promise(function (res) {
      var url = URL.createObjectURL(file), im = new Image();
      im.onload = function () {
        var w = im.naturalWidth, h = im.naturalHeight, k = Math.min(1, 2200 / Math.max(w, h));
        if (k === 1 && file.size < 1500000) { URL.revokeObjectURL(url); return res(file); }
        var c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        c.toBlob(function (b) { URL.revokeObjectURL(url); res(b || file); }, 'image/jpeg', 0.88);
      };
      im.onerror = function () { URL.revokeObjectURL(url); res(file); };
      im.src = url;
    });
  }
  var gymList = [], gymUrls = [];
  function gymName(r, i) { return r.label || ('برنامه ' + fa(i + 1)); }
  function renderGym() {
    $('#gym-today').textContent = 'امروز ' + jalali(new Date(), { weekday: 'long' });
    gymAll().then(function (list) {
      gymList = list;
      gymUrls.forEach(function (u) { URL.revokeObjectURL(u); }); gymUrls = [];
      var box = $('#gym-grid'); box.innerHTML = '';
      $('#gym-empty').classList.toggle('hidden', list.length > 0);
      list.forEach(function (r, i) {
        var u = URL.createObjectURL(r.blob); gymUrls.push(u);
        var el = document.createElement('div'); el.className = 'card gym-card';
        el.innerHTML = '<img alt=""><div class="g-label"></div><div class="g-date"></div>';
        $('img', el).src = u;
        $('.g-label', el).textContent = gymName(r, i);
        $('.g-date', el).textContent = jalali(new Date(r.added), { month: 'long', day: 'numeric' });
        el.addEventListener('click', function () { openViewer(i); });
        box.appendChild(el);
      });
    }).catch(function () { toast('خواندن عکس‌ها ممکن نشد'); });
  }
  $('#gym-file').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files || []); this.value = '';
    if (!files.length) return;
    toast('در حال ذخیره…');
    var chain = Promise.resolve();
    files.forEach(function (f) {
      chain = chain.then(function () { return shrink(f); }).then(function (b) { return gymPut({ id: uid(), blob: b, label: '', added: Date.now() }); });
    });
    chain.then(function () { toast('برنامه ذخیره شد 💪'); renderGym(); }).catch(function () { toast('ذخیره نشد. فضای گوشی رو چک کن'); });
  });

  // viewer with pinch-zoom, pan, double-tap and swipe
  var vi = 0, vz = { s: 1, x: 0, y: 0 }, pts = {}, pinchD = 0, lastTap = 0, tapStart = null;
  function applyZ() { $('#gv-img').style.transform = 'translate(' + vz.x + 'px,' + vz.y + 'px) scale(' + vz.s + ')'; }
  function resetZ() { vz = { s: 1, x: 0, y: 0 }; applyZ(); }
  function showAt(i) {
    if (!gymList.length) return closeViewer();
    vi = (i + gymList.length) % gymList.length; resetZ();
    $('#gv-img').src = gymUrls[vi];
    $('#gv-title').textContent = gymName(gymList[vi], vi);
    $('#gv-count').textContent = fa(vi + 1) + ' از ' + fa(gymList.length);
    $('#gv-prev').style.visibility = $('#gv-next').style.visibility = gymList.length > 1 ? 'visible' : 'hidden';
  }
  function openViewer(i) { $('#gym-viewer').classList.remove('hidden'); showAt(i); }
  function closeViewer() { $('#gym-viewer').classList.add('hidden'); $('#gv-img').removeAttribute('src'); }
  $('#gv-close').addEventListener('click', closeViewer);
  $('#gv-next').addEventListener('click', function () { showAt(vi + 1); });
  $('#gv-prev').addEventListener('click', function () { showAt(vi - 1); });
  $('#gv-title').addEventListener('click', function () {
    var r = gymList[vi]; if (!r) return;
    var n = prompt('اسم این برنامه (مثلاً: روز ۱ - سینه و پشت بازو)', r.label || '');
    if (n === null) return; r.label = n.trim().slice(0, 40);
    gymPut(r).then(function () { $('#gv-title').textContent = gymName(r, vi); renderGym(); });
  });
  $('#gv-del').addEventListener('click', function () {
    var r = gymList[vi]; if (!r || !confirm('این عکس برنامه حذف بشه؟')) return;
    gymDel(r.id).then(function () { toast('حذف شد'); return gymAll(); }).then(function (list) {
      closeViewer(); renderGym();
    });
  });
  var stage = $('#gv-stage');
  stage.addEventListener('pointerdown', function (e) {
    stage.setPointerCapture(e.pointerId); pts[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (Object.keys(pts).length === 1) tapStart = { x: e.clientX, y: e.clientY, t: Date.now() };
    else tapStart = null;
    pinchD = 0;
  });
  stage.addEventListener('pointermove', function (e) {
    var p = pts[e.pointerId]; if (!p) return;
    var px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
    var ids = Object.keys(pts);
    if (ids.length === 1) { if (vz.s > 1) { vz.x += p.x - px; vz.y += p.y - py; applyZ(); } }
    else if (ids.length === 2) {
      var a = pts[ids[0]], b = pts[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchD) vz.s = Math.max(1, Math.min(6, vz.s * d / pinchD));
      pinchD = d; applyZ();
    }
  });
  function endPtr(e) {
    var p = pts[e.pointerId]; if (!p) return;
    delete pts[e.pointerId]; pinchD = 0;
    if (Object.keys(pts).length) return;
    if (vz.s <= 1.02) resetZ();
    if (tapStart && e.type === 'pointerup') {
      var dx = e.clientX - tapStart.x, dy = e.clientY - tapStart.y, dt = Date.now() - tapStart.t;
      if (vz.s <= 1.02 && Math.abs(dx) > 70 && Math.abs(dy) < 60 && dt < 600) { showAt(dx < 0 ? vi + 1 : vi - 1); }
      else if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 300) {
        var now = Date.now();
        if (now - lastTap < 320) { if (vz.s > 1.02) resetZ(); else { vz.s = 2.5; applyZ(); } lastTap = 0; } else lastTap = now;
      }
    }
    tapStart = null;
  }
  stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}

  /* ---------- coach (AI via your Cloudflare Worker) ---------- */
  var QUIZ = [
    { q: 'هدف اصلیت برای ۹۰ روز آینده چیه؟', h: 'دقیق بنویس. مثلاً «ساخت شرکت تولید محتوا و رسیدن به ۳ مشتری ثابت».', t: 'text' },
    { q: 'چرا این هدف برات مهمه؟', h: 'دلیل واقعی‌ت رو بنویس، نه جواب قشنگ. اینه که تو روزهای سخت نگهت می‌داره.', t: 'text' },
    { q: 'الان دقیقاً کجایی؟', h: 'وضعیت فعلی: مهارت‌ها، تیم، مشتری، درآمد یا هر چیزی که مربوطه.', t: 'text' },
    { q: 'روزی چند ساعت واقعاً می‌تونی برای این هدف وقت بذاری؟', t: 'choice', c: ['۱ تا ۲ ساعت', '۳ تا ۴ ساعت', '۵ تا ۶ ساعت', 'بیشتر از ۶ ساعت'] },
    { q: 'بزرگ‌ترین مانعت چیه؟', t: 'choice', c: ['اهمال‌کاری و بی‌انضباطی', 'نداشتن مشتری یا درآمد', 'نداشتن مهارت کافی', 'بی‌برنامگی و شلوغی ذهن', 'ترس از شکست یا قضاوت', 'نداشتن سرمایه یا ابزار'] },
    { q: 'چه مهارت‌ها و دارایی‌هایی داری؟', h: 'مهارت، تجربه، ابزار، شبکه‌ی آشنایان، هرچی که به هدفت کمک می‌کنه.', t: 'text' },
    { q: 'دفعه‌های قبل چرا رها کردی؟', h: 'صادق باش. این‌جا قراره نقطه‌ضعف رو پیدا کنیم، نه قضاوتت کنیم.', t: 'text' },
    { q: 'کدوم ساعت از روز بیشترین انرژی رو داری؟', t: 'choice', c: ['صبح زود', 'صبح تا ظهر', 'بعدازظهر', 'عصر تا شب', 'آخر شب'] },
    { q: '۹۰ روز دیگه اگه موفق شده باشی، چی تغییر کرده؟', h: 'اون روز رو تصور کن و بنویس چی می‌بینی: عدد، مشتری، عادت، حس.', t: 'text' }
  ];
  var qi = 0, qans = [], coachBusy = false;
  var MODE_NAME = { goggins: 'استمرار و رشد', money: 'پول‌سازی' };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function md(src) {
    var lines = String(src).replace(/\r/g, '').split('\n'), out = [], list = null;
    function close() { if (list) { out.push('</' + list + '>'); list = null; } }
    lines.forEach(function (ln) {
      var t = ln.trim(), m;
      if (!t) { close(); return; }
      if ((m = t.match(/^#{1,4}\s+(.*)$/))) { close(); out.push('<h4>' + inline(m[1]) + '</h4>'); return; }
      if ((m = t.match(/^[-*•]\s+(.*)$/))) { if (list !== 'ul') { close(); out.push('<ul>'); list = 'ul'; } out.push('<li>' + inline(m[1]) + '</li>'); return; }
      if ((m = t.match(/^(\d+|[۰-۹]+)[.)\-]\s+(.*)$/))) { if (list !== 'ol') { close(); out.push('<ol>'); list = 'ol'; } out.push('<li>' + inline(m[2]) + '</li>'); return; }
      close(); out.push('<p>' + inline(t) + '</p>');
    });
    close(); return out.join('');
  }
  function splitPlan(text) {
    var daily = null, shown = text, m = text.match(/```json\s*([\s\S]*?)```/i);
    if (m) {
      try { var o = JSON.parse(m[1]); if (o && Array.isArray(o.daily)) daily = o.daily; } catch (e) {}
      shown = text.replace(/```json[\s\S]*?```/i, '').trim();
    }
    return { text: shown, daily: daily };
  }
  function aiCall(body) {
    var cfg = window.AE_AI || {};
    if (!cfg.url) return Promise.reject({ code: 'noconf' });
    var ctl = new AbortController(), timer = setTimeout(function () { ctl.abort(); }, 70000);
    var headers = { 'Content-Type': 'application/json' }; if (cfg.key) headers['X-AE-Key'] = cfg.key;
    return fetch(cfg.url.replace(/\/+$/, '') + '/chat', { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) { clearTimeout(timer); if (!r.ok) throw { code: r.status }; return r.json(); })
      .then(function (j) { if (!j || !j.reply) throw { code: 'empty' }; return j.reply; })
      .catch(function (e) { clearTimeout(timer); if (e && e.name === 'AbortError') throw { code: 'timeout' }; if (e && e.code) throw e; throw { code: 'network' }; });
  }
  function errText(e) {
    var c = e && e.code;
    if (c === 'noconf') return 'مربی هنوز به سرور وصل نشده. آدرس Worker رو توی config.js بذار و اپ رو دوباره بیلد کن.';
    if (c === 429) return 'سهمیه‌ی رایگان امروز تموم شده. فردا دوباره برگرد، یا یه کم بعد امتحان کن.';
    if (c === 401) return 'کلید دسترسی اشتباهه. config.js و APP_KEY سرور باید یکی باشن.';
    if (c === 'timeout') return 'جواب دیر اومد. دوباره امتحان کن.';
    if (c === 'network') return 'به سرور وصل نشد. اینترنت (یا VPN) رو چک کن و دوباره بزن.';
    return 'یه مشکلی پیش اومد. دوباره امتحان کن.';
  }
  function histOf() { return S.coach.hist[S.coach.mode]; }
  function profileBody() { return { name: S.name, answers: S.coach.answers || [] }; }

  function addBubble(cls, html, raw) {
    var box = $('#coach-chat'), el = document.createElement('div');
    el.className = 'msg ' + cls; if (raw) el.innerHTML = html; else el.textContent = html;
    box.appendChild(el); box.scrollTop = box.scrollHeight; return el;
  }
  function showTyping(on) {
    var box = $('#coach-chat'), old = $('.typing', box); if (old) old.remove();
    if (on) { var t = document.createElement('div'); t.className = 'typing'; t.innerHTML = '<i></i><i></i><i></i>'; box.appendChild(t); box.scrollTop = box.scrollHeight; }
  }
  function renderCoach() {
    $('#coach-pill').textContent = S.coach.plan ? 'پلن فعال' : 'بدون پلن';
    $$('#coach-mode button').forEach(function (b) { b.classList.toggle('on', b.dataset.m === S.coach.mode); });
    $('#coach-quiz-btn').textContent = S.coach.plan ? 'آزمون دوباره' : 'آزمون و ساخت پلن';
    $('#coach-today-btn').classList.toggle('hidden', !(S.coach.plan && S.coach.plan.daily));
    var box = $('#coach-chat'); box.innerHTML = '';
    var h = histOf();
    if (!h.length) {
      addBubble('sys', S.coach.mode === 'goggins'
        ? 'حالت استمرار: بی‌بهانه، با انضباط و قدم‌های کوچیک ولی هر روز. هدفت رو بگو یا آزمون بده.'
        : 'حالت پول‌سازی: مشتری، پیشنهاد، فروش و عدد. هدف مالی‌ت رو بگو یا آزمون بده.');
    }
    h.forEach(function (m) {
      if (m.role === 'user') addBubble('me', m.content);
      else addBubble('ai', md(m.plan ? m.content : m.content), true);
    });
    box.scrollTop = box.scrollHeight;
  }
  function setBusy(b) { coachBusy = b; $('#coach-send').disabled = b; $('#qz-next').disabled = b; showTyping(b); }

  function sendChat() {
    if (coachBusy) return;
    var ta = $('#coach-text'), text = ta.value.trim(); if (!text) return;
    ta.value = ''; ta.style.height = 'auto';
    var h = histOf(); h.push({ role: 'user', content: text }); save(); addBubble('me', text);
    setBusy(true);
    aiCall({ mode: S.coach.mode, task: 'chat', messages: h.map(function (m) { return { role: m.role, content: m.plan ? m.content.slice(0, 1200) : m.content }; }),
             profile: profileBody(), plan: S.coach.plan ? S.coach.plan.text : '' })
      .then(function (reply) { h.push({ role: 'assistant', content: reply }); if (h.length > 40) h.splice(0, h.length - 40); save(); setBusy(false); addBubble('ai', md(reply), true); })
      .catch(function (e) { setBusy(false); h.pop(); save(); addBubble('err', errText(e)); });
  }
  $('#coach-send').addEventListener('click', sendChat);
  $('#coach-text').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(110, this.scrollHeight) + 'px'; });
  $('#coach-mode').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || coachBusy) return;
    S.coach.mode = b.dataset.m; save(); renderCoach();
  });

  /* quiz */
  function openQuiz() { qi = 0; qans = []; $('#quiz').classList.remove('hidden'); showQ(); }
  function closeQuiz() { $('#quiz').classList.add('hidden'); }
  function showQ() {
    var q = QUIZ[qi];
    $('#qz-q').textContent = q.q; $('#qz-hint').textContent = q.h || '';
    $('#qz-count').textContent = fa(qi + 1) + '/' + fa(QUIZ.length);
    $('#qz-prog').style.width = ((qi + 1) / QUIZ.length * 100) + '%';
    $('#qz-back').style.visibility = qi ? 'visible' : 'hidden';
    $('#qz-next').textContent = qi === QUIZ.length - 1 ? 'ساخت پلن' : 'بعدی';
    var ch = $('#qz-choices'), ta = $('#qz-text'); ch.innerHTML = '';
    var prev = qans[qi] || '';
    if (q.t === 'choice') {
      ta.classList.add('hidden');
      q.c.forEach(function (c) {
        var b = document.createElement('button'); b.textContent = c; if (prev === c) b.classList.add('on');
        b.addEventListener('click', function () { $$('button', ch).forEach(function (x) { x.classList.remove('on'); }); b.classList.add('on'); qans[qi] = c; });
        ch.appendChild(b);
      });
    } else { ta.classList.remove('hidden'); ta.value = prev; setTimeout(function () { ta.focus(); }, 200); }
  }
  function nextQ() {
    if (coachBusy) return;
    var q = QUIZ[qi];
    if (q.t === 'text') qans[qi] = $('#qz-text').value.trim();
    if (!qans[qi]) { toast(q.t === 'choice' ? 'یکی رو انتخاب کن' : 'یه چیزی بنویس'); return; }
    if (qi < QUIZ.length - 1) { qi++; showQ(); return; }
    buildPlan();
  }
  $('#qz-next').addEventListener('click', nextQ);
  $('#qz-back').addEventListener('click', function () { if (qi > 0 && !coachBusy) { if (QUIZ[qi].t === 'text') qans[qi] = $('#qz-text').value.trim(); qi--; showQ(); } });
  $('#qz-close').addEventListener('click', function () { if (!coachBusy) closeQuiz(); });
  $('#coach-quiz-btn').addEventListener('click', function () { if (S.coach.plan && !confirm('آزمون دوباره پلن قبلی رو عوض می‌کنه. ادامه بدیم؟')) return; openQuiz(); });

  function buildPlan() {
    S.coach.answers = QUIZ.map(function (q, i) { return { q: q.q, a: qans[i] }; });
    $('#qz-next').textContent = 'در حال چیدن پلن…'; setBusy(true);
    aiCall({ mode: S.coach.mode, task: 'plan', messages: [{ role: 'user', content: 'آزمون رو جواب دادم. پلنم رو بچین.' }], profile: profileBody() })
      .then(function (reply) {
        var p = splitPlan(reply);
        S.coach.plan = { text: p.text, daily: p.daily, mode: S.coach.mode, start: dayKey(), added: {} };
        var h = histOf(); h.push({ role: 'assistant', content: p.text, plan: true }); save();
        setBusy(false); closeQuiz(); go('coach'); renderCoach(); renderHome();
        toast('پلنت آماده شد 🔥');
      })
      .catch(function (e) { setBusy(false); $('#qz-next').textContent = 'ساخت پلن'; save(); toast(errText(e)); });
  }

  /* today's steps -> tasks */
  function todaySteps() {
    var pl = S.coach.plan; if (!pl || !pl.daily || !pl.daily.length) return [];
    var start = new Date(pl.start + 'T00:00:00'), n = Math.floor((new Date(dayKey() + 'T00:00:00') - start) / 86400000);
    var d = pl.daily[Math.max(0, Math.min(pl.daily.length - 1, n))];
    return (d && Array.isArray(d.steps) ? d.steps : []).filter(function (s) { return s && s.title; });
  }
  $('#coach-today-btn').addEventListener('click', function () {
    var steps = todaySteps(), k = dayKey(), pl = S.coach.plan; pl.added = pl.added || {};
    if (!steps.length) { toast('قدمی برای امروز پیدا نشد'); return; }
    var added = 0;
    steps.forEach(function (s) {
      var title = String(s.title).slice(0, 100) + (s.minutes ? ' (' + fa(Math.round(s.minutes)) + ' دقیقه)' : ''), id = k + '|' + title;
      if (pl.added[id]) return; pl.added[id] = 1;
      S.tasks.push({ id: uid(), text: title, done: false, p: 2, c: Date.now() + added }); added++;
    });
    save(); renderTasks(); renderHome();
    toast(added ? fa(added) + ' قدم به تسک‌ها اضافه شد 💪' : 'قدم‌های امروز قبلاً اضافه شدن');
  });

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
  document.addEventListener('visibilitychange', function () { if (!document.hidden) { tick(); renderTimer(); renderPomo(); renderHome(); } });
  setInterval(function () { if (current === 'home') renderHome(); }, 60000);

  /* ---------- boot ---------- */
  function initState() {
    if (!T.running && T.remain > T.dur) T.remain = T.dur;
    if (!P.running && !P.remain) P.remain = modeSecs(P.mode);
    renderHome(); renderNotes(); renderTasks(); renderTimer(); renderPomo();
  }
  initState();

  $('#q-en').textContent = LQ.q[0]; $('#q-fa').textContent = LQ.q[1];
  $('#q-day').textContent = jalali(new Date(), { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  function showQuote() { renderHome(); $('#quote-screen').classList.remove('hidden'); }
  function showWelcome() {
    var w = $('#welcome'); w.classList.remove('hidden');
    $('#w-name').placeholder = 'اسمت رو بنویس…';
    setTimeout(function () { $('#w-name').focus(); }, 600);
  }
  function finishWelcome() {
    var inp = $('#w-name'), v = inp.value.trim();
    if (!v) { inp.classList.add('shake'); setTimeout(function () { inp.classList.remove('shake'); }, 400); return; }
    S.name = v.slice(0, 24); S.named = true; save();
    var w = $('#welcome'); w.classList.add('out'); setTimeout(function () { w.remove(); }, 450);
    inp.blur(); showQuote();
  }
  $('#w-go').addEventListener('click', finishWelcome);
  $('#w-name').addEventListener('keydown', function (e) { if (e.key === 'Enter') finishWelcome(); });

  var SPLASH_MS = 2900;
  setTimeout(function () {
    $('#splash').classList.add('out');
    $('#app').classList.remove('hidden');
    if (S.named) showQuote(); else showWelcome();
    setTimeout(function () { $('#splash').remove(); }, 700);
  }, SPLASH_MS);
  $('#q-go').addEventListener('click', function () {
    var qs = $('#quote-screen'); qs.classList.add('out'); setTimeout(function () { qs.remove(); }, 450);
  });
})();

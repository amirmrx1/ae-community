/* AE — Gym music player. Songs the user imports live in IndexedDB on the phone. Own dynamic colour palette (taken from the cover art). */
(function () {
  'use strict';
  var A = window.AE;
  if (!A) return;
  var S = A.S, fa = A.fa;
  var root = document.getElementById('music'), gymHost = document.getElementById('music-card'), miniHost = document.getElementById('music-mini');
  if (!root || !gymHost || !miniHost) return;

  /* ---------- tiny helpers ---------- */
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function $(s, r) { return (r || root).querySelector(s); }
  function uid() { return A.uid ? A.uid() : Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fmt(s) { s = Math.max(0, Math.floor(s || 0)); return fa(Math.floor(s / 60)) + ':' + fa(('0' + (s % 60)).slice(-2)); }
  function mins(sec) { return fa(Math.max(1, Math.round(sec / 60))); }
  function hash(str) { var h = 0; for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return Math.abs(h); }
  var SPRITE = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>' +
    '<symbol id="mi-note" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></symbol>' +
    '<symbol id="mi-play" viewBox="0 0 24 24"><path d="M7 4l13 8-13 8z" fill="currentColor"/></symbol>' +
    '<symbol id="mi-pause" viewBox="0 0 24 24"><path d="M7 4h3v16H7zM14 4h3v16h-3z" fill="currentColor"/></symbol>' +
    '<symbol id="mi-next" viewBox="0 0 24 24"><path d="M5 5l10 7-10 7zM18 5v14"/></symbol>' +
    '<symbol id="mi-prev" viewBox="0 0 24 24"><path d="M19 5L9 12l10 7zM6 5v14"/></symbol>' +
    '<symbol id="mi-shuf" viewBox="0 0 24 24"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></symbol>' +
    '<symbol id="mi-rep" viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/></symbol>' +
    '<symbol id="mi-heart" viewBox="0 0 24 24"><path d="M20.8 5.6a5 5 0 00-7.1 0L12 7.3l-1.7-1.7a5 5 0 00-7.1 7.1L12 21.5l8.8-8.8a5 5 0 000-7.1z"/></symbol>' +
    '<symbol id="mi-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></symbol>' +
    '<symbol id="mi-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></symbol>' +
    '<symbol id="mi-eq" viewBox="0 0 24 24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></symbol>' +
    '<symbol id="mi-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>' +
    '<symbol id="mi-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></symbol>' +
    '<symbol id="mi-dots" viewBox="0 0 24 24"><path d="M12 5h.01M12 12h.01M12 19h.01" stroke-width="3"/></symbol>' +
    '<symbol id="mi-grip" viewBox="0 0 24 24"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke-width="3"/></symbol>' +
    '<symbol id="mi-back" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></symbol>' +
    '<symbol id="mi-down" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></symbol>' +
    '<symbol id="mi-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>' +
    '</defs></svg>';
  document.body.insertAdjacentHTML('beforeend', SPRITE);
  function ico(n, c) { return '<svg viewBox="0 0 24 24"' + (c ? ' class="' + c + '"' : '') + '><use href="#mi-' + n + '"/></svg>'; }

  /* ---------- state in localStorage (small) ---------- */
  function M() {
    var m = S.music = S.music || {};
    m.pls = m.pls || []; m.favs = m.favs || {};
    m.shuffle = !!m.shuffle; m.repeat = m.repeat || 0; m.speed = m.speed || 1;
    m.eq = m.eq || { p: 'flat', g: [0, 0, 0, 0, 0] };
    return m;
  }
  var EQP = [
    { id: 'flat', n: 'عادی', g: [0, 0, 0, 0, 0] }, { id: 'work', n: '🔥 تمرین', g: [5, 2, 0, 3, 4] },
    { id: 'bass', n: 'بیس', g: [8, 4, 0, -1, -1] }, { id: 'vocal', n: 'وکال', g: [-2, 0, 4, 3, 1] }, { id: 'calm', n: 'آرام', g: [2, 1, 0, -2, -3] }
  ];
  var EQF = [{ t: 'lowshelf', f: 60, n: '۶۰Hz' }, { t: 'peaking', f: 230, n: '۲۳۰Hz' }, { t: 'peaking', f: 910, n: '۹۱۰Hz' }, { t: 'peaking', f: 3600, n: '۳.۶kHz' }, { t: 'highshelf', f: 14000, n: '۱۴kHz' }];

  /* ---------- IndexedDB: tracks (meta) + blobs (audio) ---------- */
  var dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open('ae-music', 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore('tracks', { keyPath: 'id' }); d.createObjectStore('blobs'); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(store, mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), req = fn(t.objectStore(store));
        t.oncomplete = function () { res(req && req.result); };
        t.onerror = t.onabort = function () { rej(t.error); };
      });
    });
  }
  var lib = [], byId = {};
  function reindex() { byId = {}; lib.forEach(function (t) { byId[t.id] = t; }); }
  function loadLib() {
    return tx('tracks', 'readonly', function (os) { return os.getAll(); }).then(function (all) {
      lib = (all || []).sort(function (a, b) { return b.added - a.added; }); reindex();
    }).catch(function () { lib = []; reindex(); });
  }

  /* ---------- ID3 tags (cover, title, artist) ---------- */
  function synch(u, p) { return (u[p] << 21) | (u[p + 1] << 14) | (u[p + 2] << 7) | u[p + 3]; }
  function dec(u8, enc) {
    try {
      var n = u8.length; while (n > 0 && u8[n - 1] === 0) n--;
      var b = u8.subarray(0, n);
      if (enc === 1) { if (b[0] === 0xFE && b[1] === 0xFF) return new TextDecoder('utf-16be').decode(b.subarray(2)); if (b[0] === 0xFF && b[1] === 0xFE) return new TextDecoder('utf-16le').decode(b.subarray(2)); return new TextDecoder('utf-16le').decode(b); }
      if (enc === 2) return new TextDecoder('utf-16be').decode(b);
      if (enc === 3) return new TextDecoder('utf-8').decode(b);
      return new TextDecoder('windows-1252').decode(b);
    } catch (e) { return ''; }
  }
  function parseID3(buf) {
    var u = new Uint8Array(buf), out = {};
    if (u.length < 10 || u[0] !== 0x49 || u[1] !== 0x44 || u[2] !== 0x33) return out;
    var ver = u[3], flags = u[5], size = synch(u, 6), end = Math.min(10 + size, u.length), p = 10;
    var dv = new DataView(buf);
    if (flags & 0x40) { var es = ver === 4 ? synch(u, p) : dv.getUint32(p) + 4; p += es; }
    while (p + 10 <= end) {
      var id = String.fromCharCode(u[p], u[p + 1], u[p + 2], u[p + 3]);
      if (!/^[A-Z0-9]{4}$/.test(id)) break;
      var fs = ver === 4 ? synch(u, p + 4) : dv.getUint32(p + 4);
      p += 10;
      if (fs <= 0 || p + fs > end) break;
      var f = u.subarray(p, p + fs), enc = f[0];
      if (id === 'TIT2') out.title = dec(f.subarray(1), enc);
      else if (id === 'TPE1') out.artist = dec(f.subarray(1), enc);
      else if (id === 'TALB') out.album = dec(f.subarray(1), enc);
      else if (id === 'APIC' && !out.pic) {
        var q = 1, mime = '';
        while (q < f.length && f[q] !== 0) mime += String.fromCharCode(f[q++]);
        q += 2; // null + picture type
        if (enc === 1 || enc === 2) { while (q + 1 < f.length && !(f[q] === 0 && f[q + 1] === 0)) q += 2; q += 2; } else { while (q < f.length && f[q] !== 0) q++; q++; }
        if (q < f.length) out.pic = { mime: /^image\//.test(mime) ? mime : 'image/jpeg', data: f.slice(q) };
      }
      p += fs;
    }
    return out;
  }
  function readTags(file) {
    return file.slice(0, 10).arrayBuffer().then(function (h) {
      var u = new Uint8Array(h);
      if (u[0] !== 0x49 || u[1] !== 0x44 || u[2] !== 0x33) return {};
      var size = 10 + synch(u, 6);
      return file.slice(0, Math.min(size, 8 * 1024 * 1024)).arrayBuffer().then(parseID3);
    }).catch(function () { return {}; });
  }
  // cover → small jpeg + dominant colour
  function processCover(pic) {
    return new Promise(function (res) {
      try {
        var url = URL.createObjectURL(new Blob([pic.data], { type: pic.mime })), img = new Image();
        img.onload = function () {
          try {
            var c = document.createElement('canvas'), n = 256; c.width = c.height = n;
            var x = c.getContext('2d'), s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) / 2;
            x.drawImage(img, sx, sy, s, s, 0, 0, n, n);
            var d = x.getImageData(0, 0, n, n).data, R = 0, G = 0, B = 0, W = 0;
            for (var i = 0; i < d.length; i += 64) {
              var r = d[i], g = d[i + 1], b = d[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = mx ? (mx - mn) / mx : 0, w = sat * sat * (mx / 255) + 0.01;
              R += r * w; G += g * w; B += b * w; W += w;
            }
            URL.revokeObjectURL(url);
            res({ cover: c.toDataURL('image/jpeg', 0.8), rgb: [R / W, G / W, B / W] });
          } catch (e) { URL.revokeObjectURL(url); res(null); }
        };
        img.onerror = function () { URL.revokeObjectURL(url); res(null); };
        img.src = url;
      } catch (e) { res(null); }
    });
  }
  function rgbToHS(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h = Math.round(h * 60); if (h < 0) h += 360; }
    var l = (mx + mn) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return { h: h, s: s };
  }
  function probeDuration(file) {
    return new Promise(function (res) {
      var a = new Audio(), u = URL.createObjectURL(file), done = false;
      function fin(v) { if (done) return; done = true; URL.revokeObjectURL(u); a.removeAttribute('src'); res(v); }
      a.preload = 'metadata'; a.onloadedmetadata = function () { fin(isFinite(a.duration) ? a.duration : 0); }; a.onerror = function () { fin(-1); };
      setTimeout(function () { fin(0); }, 9000); a.src = u;
    });
  }
  function cleanName(n) { return String(n || '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim(); }

  /* ---------- import ---------- */
  var fileIn = document.createElement('input');
  fileIn.type = 'file'; fileIn.accept = 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.flac,.opus'; fileIn.multiple = true; fileIn.hidden = true; fileIn.id = 'm-file';
  document.body.appendChild(fileIn);
  var importTo = null; // playlist id to add the new songs to
  fileIn.addEventListener('change', function () {
    var files = Array.prototype.slice.call(fileIn.files || []); fileIn.value = '';
    if (files.length) importFiles(files, importTo); importTo = null;
  });
  function importFiles(files, plId) {
    var added = 0, dup = 0, bad = 0, ids = [];
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    return files.reduce(function (p, file, i) {
      return p.then(function () {
        A.toast('در حال افزودن ' + fa(i + 1) + ' از ' + fa(files.length) + '…');
        var key = file.name + ':' + file.size, ex = lib.filter(function (t) { return t.key === key; })[0];
        if (ex) { dup++; ids.push(ex.id); return; }
        return Promise.all([readTags(file), probeDuration(file)]).then(function (r) {
          var tags = r[0], dur = r[1];
          if (dur < 0) { bad++; return; }
          return (tags.pic ? processCover(tags.pic) : Promise.resolve(null)).then(function (cv) {
            var hs = cv ? rgbToHS(cv.rgb) : null, nm = cleanName(file.name);
            if (!hs || hs.s < 0.18) hs = { h: hash(nm) % 360, s: 0.7 };
            var t = { id: uid(), key: key, title: (tags.title || nm).trim().slice(0, 80) || 'بدون نام', artist: (tags.artist || '').trim().slice(0, 60), dur: dur, cover: cv ? cv.cover : '', h: hs.h, s: Math.max(0.5, Math.min(0.85, hs.s)), added: Date.now() + i };
            return tx('blobs', 'readwrite', function (os) { return os.put(file, t.id); }).then(function () {
              return tx('tracks', 'readwrite', function (os) { return os.put(t); });
            }).then(function () { lib.unshift(t); byId[t.id] = t; ids.push(t.id); added++; });
          });
        }).catch(function () { bad++; });
      });
    }, Promise.resolve()).then(function () {
      if (plId) { var pl = plById(plId); if (pl) { ids.forEach(function (id) { if (pl.ids.indexOf(id) < 0) pl.ids.push(id); }); A.save(); } }
      lib.sort(function (a, b) { return b.added - a.added; });
      var msg = added ? fa(added) + ' آهنگ اضافه شد 🎵' : 'آهنگ جدیدی اضافه نشد';
      if (dup) msg += ' · ' + fa(dup) + ' تکراری'; if (bad) msg += ' · ' + fa(bad) + ' فایل خراب/ناشناخته';
      A.toast(msg); renderAll();
    });
  }

  /* ---------- palette (own colours, from the cover) ---------- */
  var ROOT = document.documentElement;
  function setTheme(t) {
    var h = t ? t.h : 18, s = Math.round((t ? t.s : 0.85) * 100);
    ROOT.style.setProperty('--mc', 'hsl(' + h + ' ' + s + '% 60%)');
    ROOT.style.setProperty('--mc2', 'hsl(' + (h + 38) + ' ' + Math.min(95, s + 8) + '% 55%)');
    ROOT.style.setProperty('--mc3', 'hsl(' + (h - 70 + 360) % 360 + ' ' + s + '% 48%)');
    ROOT.style.setProperty('--mcd', 'hsl(' + h + ' ' + Math.min(80, s) + '% 12%)');
  }
  function gradFor(t) { return 'linear-gradient(135deg,hsl(' + t.h + ' ' + Math.round(t.s * 100) + '% 58%),hsl(' + ((t.h + 45) % 360) + ' ' + Math.round(t.s * 100) + '% 42%))'; }
  function cvr(t, cls, noIcon) {
    if (!t) return '<div class="mcv ' + (cls || '') + '" style="background:linear-gradient(135deg,#ff8a3d,#ff3d81)">' + (noIcon ? '' : ico('note')) + '</div>';
    if (t.cover) return '<div class="mcv ' + (cls || '') + '" style="background-image:url(\'' + t.cover + '\')"></div>';
    return '<div class="mcv ' + (cls || '') + '" style="background:' + gradFor(t) + '">' + (noIcon ? '' : ico('note')) + '</div>';
  }
  function collage(ids, plName) {
    var ts = ids.map(function (i) { return byId[i]; }).filter(Boolean).slice(0, 4);
    if (!ts.length) return '<div class="mcol one">' + cvr({ h: hash(plName || 'x') % 360, s: 0.6 }, '') + '</div>';
    if (ts.length < 4) return '<div class="mcol one">' + cvr(ts[0], '') + '</div>';
    return '<div class="mcol">' + ts.map(function (t) { return cvr(t, '', true); }).join('') + '</div>';
  }

  /* ---------- audio engine ---------- */
  var au = new Audio(); au.preload = 'auto'; au.setAttribute('playsinline', '');
  var ctx = null, filters = [], analyser = null, freq = null;
  var Q = { base: [], ids: [], i: -1, plId: null }, cur = null, loadTok = 0, curUrl = null, errRun = 0;
  function ensureGraph() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(function () {}); return; }
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      var src = ctx.createMediaElementSource(au), prev = src;
      filters = EQF.map(function (f) { var n = ctx.createBiquadFilter(); n.type = f.t; n.frequency.value = f.f; n.Q.value = 1; prev.connect(n); prev = n; return n; });
      analyser = ctx.createAnalyser(); analyser.fftSize = 64; analyser.smoothingTimeConstant = 0.78; freq = new Uint8Array(analyser.frequencyBinCount);
      prev.connect(analyser); analyser.connect(ctx.destination); applyEQ();
    } catch (e) { ctx = null; analyser = null; }
  }
  function applyEQ() { var g = M().eq.g; filters.forEach(function (n, i) { n.gain.value = g[i] || 0; }); }
  function curIdx() { return Q.ids.indexOf(cur && cur.id); }
  function shuffled(ids, first) {
    var rest = ids.filter(function (x) { return x !== first; });
    for (var i = rest.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = rest[i]; rest[i] = rest[j]; rest[j] = t; }
    return first ? [first].concat(rest) : rest;
  }
  function setQueue(ids, startId, plId) {
    Q.base = ids.filter(function (i) { return byId[i]; }); Q.plId = plId || null;
    var first = startId && Q.base.indexOf(startId) >= 0 ? startId : (M().shuffle ? null : Q.base[0]);
    Q.ids = M().shuffle ? shuffled(Q.base, first) : Q.base.slice();
    return first || Q.ids[0];
  }
  function blobUrl(id) {
    return tx('blobs', 'readonly', function (os) { return os.get(id); }).then(function (b) { if (!b) throw new Error('missing'); return URL.createObjectURL(b); });
  }
  function load(id, autoplay, pos) {
    var t = byId[id]; if (!t) return Promise.resolve();
    var tok = ++loadTok; cur = t; Q.i = curIdx(); setTheme(t); renderAll();
    return blobUrl(id).then(function (u) {
      if (tok !== loadTok) { URL.revokeObjectURL(u); return; }
      if (curUrl) URL.revokeObjectURL(curUrl);
      curUrl = u; au.src = u; au.playbackRate = M().speed; au.preservesPitch = true;
      if (pos) { var seekOnce = function () { try { au.currentTime = pos; } catch (e) {} au.removeEventListener('loadedmetadata', seekOnce); }; au.addEventListener('loadedmetadata', seekOnce); }
      mediaMeta();
      if (autoplay) return play();
    }).catch(function () { A.toast('این آهنگ پیدا نشد'); });
  }
  function play() {
    if (!cur) { if (!lib.length) return Promise.resolve(); var id = setQueue(lib.map(function (t) { return t.id; })); return load(id, true); }
    if (!au.src) return load(cur.id, true, M().last && M().last.pos);
    ensureGraph();
    return au.play().catch(function () {});
  }
  function pause() { au.pause(); }
  function toggle() { if (au.paused) play(); else pause(); }
  function playIds(ids, startId, plId) { if (!ids.length) { A.toast('اینجا آهنگی نیست'); return; } var s = setQueue(ids, startId, plId); errRun = 0; load(s, true); }
  function next(auto) {
    if (!Q.ids.length) return;
    var i = curIdx() + 1;
    if (i >= Q.ids.length) { if (M().repeat === 1 || !auto) i = 0; else { au.pause(); au.currentTime = 0; renderAll(); return; } }
    if (!auto && Q.ids.length === 1) { au.currentTime = 0; play(); return; }
    errRun = 0; load(Q.ids[i], true);
  }
  function prev() {
    if (!Q.ids.length) return;
    if (au.currentTime > 3) { au.currentTime = 0; return; }
    var i = curIdx() - 1; if (i < 0) i = M().repeat === 1 ? Q.ids.length - 1 : 0;
    load(Q.ids[i], true);
  }
  function jump(id) { errRun = 0; load(id, true); }
  au.addEventListener('ended', function () { if (M().repeat === 2) { au.currentTime = 0; play(); } else if (sleepEOT) { sleepEOT = false; stopSleepUI(); au.pause(); au.currentTime = 0; renderAll(); } else next(true); });
  au.addEventListener('play', function () { renderPlayState(); startViz(); });
  au.addEventListener('pause', function () { renderPlayState(); saveLast(true); });
  au.addEventListener('error', function () {
    if (!au.src) return; errRun++; A.toast('این فایل پخش نشد');
    if (errRun < Math.max(2, Q.ids.length)) setTimeout(function () { next(true); }, 500);
  });
  au.addEventListener('timeupdate', function () { tickTime(); saveLast(); });
  var lastSave = 0;
  function saveLast(force) {
    var now = Date.now(); if (!force && now - lastSave < 5000) return; lastSave = now;
    if (!cur) return; M().last = { base: Q.base, cur: cur.id, plId: Q.plId, pos: Math.floor(au.currentTime || 0) }; A.save();
  }
  function mediaMeta() {
    try {
      if (!('mediaSession' in navigator) || !cur) return;
      navigator.mediaSession.metadata = new MediaMetadata({ title: cur.title, artist: cur.artist || 'AE', album: 'AE', artwork: cur.cover ? [{ src: cur.cover, sizes: '256x256', type: 'image/jpeg' }] : [] });
      navigator.mediaSession.setActionHandler('play', play); navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('previoustrack', prev); navigator.mediaSession.setActionHandler('nexttrack', function () { next(false); });
      navigator.mediaSession.setActionHandler('seekto', function (d) { if (d && typeof d.seekTime === 'number') au.currentTime = d.seekTime; });
    } catch (e) {}
  }

  /* ---------- sleep timer ---------- */
  var sleepEnd = 0, sleepEOT = false, sleepIv = null;
  function stopSleepUI() { sleepEnd = 0; clearInterval(sleepIv); sleepIv = null; au.volume = 1; if (V.sheet) renderSheet(); }
  function setSleep(min) {
    clearInterval(sleepIv); sleepIv = null; sleepEOT = false; sleepEnd = 0; au.volume = 1;
    if (min === 'eot') { sleepEOT = true; A.toast('بعد از این آهنگ متوقف می‌شه 🌙'); }
    else if (min > 0) {
      sleepEnd = Date.now() + min * 60000; A.toast('پخش بعد از ' + fa(min) + ' دقیقه متوقف می‌شه 🌙');
      sleepIv = setInterval(function () {
        var left = sleepEnd - Date.now();
        if (left <= 0) { au.pause(); stopSleepUI(); A.toast('تایمر خواب تموم شد، شب بخیر 🌙'); }
        else if (left < 10000) au.volume = Math.max(0.05, left / 10000);
      }, 500);
    }
    if (V.sheet) renderSheet();
  }

  /* ---------- UI state ---------- */
  var V = { open: false, view: 'lib', tab: 'pls', plId: null, q: '', sheet: null, from: 'lib', stab: 'queue', menuId: null, pickPl: null, pickSel: {} };
  function plById(id) { var l = M().pls; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function plDur(pl) { return pl.ids.reduce(function (s, id) { return s + ((byId[id] && byId[id].dur) || 0); }, 0); }
  function plTracks(pl) { return pl.ids.map(function (i) { return byId[i]; }).filter(Boolean); }
  function isPlaying() { return !au.paused && !au.ended; }

  function open(view, tab) {
    V.open = true; V.view = view || 'lib'; if (tab) V.tab = tab; V.sheet = null;
    root.classList.remove('hidden'); root.classList.add('in'); document.body.classList.add('music-open');
    renderAll();
  }
  function close() { V.open = false; V.sheet = null; root.classList.add('hidden'); root.classList.remove('in'); document.body.classList.remove('music-open'); stopViz(); renderAll(); }
  function back() {
    if (V.sheet) { V.sheet = null; renderSheet(); return; }
    if (V.view === 'player') { if (V.from === 'pl' && V.plId && plById(V.plId)) V.view = 'pl'; else if (V.from === 'mini') { close(); return; } else V.view = 'lib'; renderAll(); return; }
    if (V.view === 'pl') { V.view = 'lib'; V.tab = 'pls'; renderAll(); return; }
    close();
  }

  function trackRow(t, o) {
    o = o || {}; var isCur = cur && cur.id === t.id;
    return '<div class="trk' + (isCur ? ' cur' : '') + '" data-tid="' + t.id + '">' +
      (o.grip ? '<button type="button" class="grip" aria-label="جابه‌جایی">' + ico('grip') + '</button>' : '') +
      cvr(t, 'sm') + '<div class="grow tx"><b>' + esc(t.title) + '</b><small>' + esc(t.artist || 'ناشناس') + '</small></div>' +
      (isCur && isPlaying() ? '<span class="bars"><i></i><i></i><i></i></span>' : '') +
      (M().favs[t.id] ? '<span class="fv">' + ico('heart') + '</span>' : '') +
      '<span class="d">' + (t.dur ? fmt(t.dur) : '') + '</span><button type="button" class="tm" data-menu="' + t.id + '" aria-label="گزینه‌ها">' + ico('dots') + '</button></div>';
  }
  function emptyLib() {
    return '<div class="m-empty glass">' + ico('note') + '<b>هنوز آهنگی نداری</b><span>آهنگ‌های گوشیت رو اضافه کن تا اینجا ذخیره بشن و بتونی پلی‌لیست بسازی.</span><label class="m-btn" for="m-file">+ افزودن آهنگ</label></div>';
  }

  /* --- library view --- */
  function viewLib() {
    var m = M(), h = '<div class="m-head"><button type="button" class="ib glass" id="m-close" aria-label="بستن">' + ico('back') + '</button><h1 class="grow">موزیک</h1><label class="m-add glass" for="m-file">' + ico('plus') + 'افزودن آهنگ</label></div>';
    h += '<div class="m-seg glass" id="m-tabs"><button data-t="pls" class="' + (V.tab === 'pls' ? 'on' : '') + '">پلی‌لیست‌ها</button><button data-t="tracks" class="' + (V.tab === 'tracks' ? 'on' : '') + '">آهنگ‌ها</button><button data-t="favs" class="' + (V.tab === 'favs' ? 'on' : '') + '">علاقه‌مندی‌ها</button></div>';
    if (V.tab === 'pls') {
      h += '<div class="m-grid"><button type="button" class="pl-new glass" id="m-newpl"><span class="ib glass">' + ico('plus') + '</span><b>پلی‌لیست جدید</b></button>';
      m.pls.forEach(function (pl) {
        h += '<button type="button" class="pl-card glass" data-pl="' + pl.id + '">' + collage(pl.ids, pl.name) + '<b>' + esc((pl.emoji || '🎵') + ' ' + pl.name) + '</b><small>' + fa(plTracks(pl).length) + ' آهنگ' + (plDur(pl) ? ' · ' + mins(plDur(pl)) + ' دقیقه' : '') + '</small></button>';
      });
      h += '</div>';
      if (!lib.length) h += emptyLib();
      else { h += '<div class="m-lbl">آهنگ‌های اخیر</div><div class="m-list">' + lib.slice(0, 5).map(function (t) { return trackRow(t); }).join('') + '</div>'; }
    } else {
      var list = lib.filter(function (t) { return V.tab === 'favs' ? m.favs[t.id] : true; });
      var q = V.q.trim().toLowerCase();
      if (q) list = list.filter(function (t) { return (t.title + ' ' + t.artist).toLowerCase().indexOf(q) >= 0; });
      h += '<div class="m-search glass">' + ico('search') + '<input id="m-q" placeholder="جستجو در آهنگ‌ها…" value="' + esc(V.q) + '" autocomplete="off"></div>';
      if (!lib.length) h += emptyLib();
      else if (!list.length) h += '<div class="m-hint">' + (V.tab === 'favs' ? 'هنوز آهنگی رو علاقه‌مندی نکردی. قلب ♥ تو پلیر رو بزن.' : 'چیزی پیدا نشد.') + '</div>';
      else h += '<div class="m-pr"><button type="button" class="m-btn" id="m-playall">' + ico('play') + 'پخش همه</button><button type="button" class="m-btn ghost glass" id="m-shufall">' + ico('shuf') + 'تصادفی</button></div><div class="m-list" id="m-tl">' + list.map(function (t) { return trackRow(t); }).join('') + '</div>';
    }
    return h;
  }
  function bindLib(el) {
    $('#m-close', el).onclick = back;
    Array.prototype.forEach.call(el.querySelectorAll('#m-tabs button'), function (b) { b.onclick = function () { V.tab = b.dataset.t; renderAll(); }; });
    var np = $('#m-newpl', el); if (np) np.onclick = newPlaylist;
    Array.prototype.forEach.call(el.querySelectorAll('.pl-card'), function (b) { b.onclick = function () { V.plId = b.dataset.pl; V.view = 'pl'; renderAll(); }; });
    var q = $('#m-q', el); if (q) q.oninput = function () { V.q = q.value; var pos = q.selectionStart; renderAll(); var n = $('#m-q'); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } };
    var list = lib.filter(function (t) { return V.tab === 'favs' ? M().favs[t.id] : true; });
    var qq = V.q.trim().toLowerCase(); if (qq) list = list.filter(function (t) { return (t.title + ' ' + t.artist).toLowerCase().indexOf(qq) >= 0; });
    var ids = V.tab === 'pls' ? lib.map(function (t) { return t.id; }) : list.map(function (t) { return t.id; });
    bindTracks(el, function (id) { V.from = 'lib'; playIds(ids, id, null); });
    var pa = $('#m-playall', el); if (pa) pa.onclick = function () { var sh = M().shuffle; M().shuffle = false; playIds(ids, ids[0], null); M().shuffle = sh; };
    var sa = $('#m-shufall', el); if (sa) sa.onclick = function () { var sh = M().shuffle; M().shuffle = true; playIds(ids, null, null); M().shuffle = sh; M().shuffle = true; A.save(); renderAll(); };
  }
  function bindTracks(el, onPlay) {
    Array.prototype.forEach.call(el.querySelectorAll('.trk'), function (r) {
      r.addEventListener('click', function (e) { if (e.target.closest('.tm') || e.target.closest('.grip')) return; onPlay(r.dataset.tid); });
    });
    Array.prototype.forEach.call(el.querySelectorAll('.tm'), function (b) { b.addEventListener('click', function (e) { e.stopPropagation(); V.sheet = 'menu'; V.menuId = b.dataset.menu; renderSheet(); }); });
  }

  /* --- playlist view --- */
  function viewPl() {
    var pl = plById(V.plId); if (!pl) { V.view = 'lib'; return viewLib(); }
    var ts = plTracks(pl);
    var h = '<div class="m-head"><button type="button" class="ib glass" id="m-close" aria-label="بازگشت">' + ico('back') + '</button><div class="grow"></div><button type="button" class="ib glass" id="m-plmenu" aria-label="گزینه‌های پلی‌لیست">' + ico('dots') + '</button></div>';
    h += '<div class="pl-hero">' + collage(pl.ids, pl.name) + '<h1>' + esc((pl.emoji || '🎵') + ' ' + pl.name) + '</h1><div class="m-sub">' + fa(ts.length) + ' آهنگ' + (plDur(pl) ? ' · ' + mins(plDur(pl)) + ' دقیقه' : '') + '</div></div>';
    h += '<div class="m-pr"><button type="button" class="m-btn" id="m-playpl">' + ico('play') + 'پخش</button><button type="button" class="m-btn ghost glass" id="m-shufpl">' + ico('shuf') + 'پخش تصادفی</button></div>';
    h += '<div class="m-row"><span class="m-lbl nm">آهنگ‌ها</span><button type="button" class="m-link" id="m-addto">' + ico('plus') + 'افزودن آهنگ</button></div>';
    if (!ts.length) h += '<div class="m-hint">این پلی‌لیست خالیه. «افزودن آهنگ» رو بزن.</div>';
    else h += '<div class="m-list glass pad" id="m-pll">' + ts.map(function (t) { return trackRow(t, { grip: true }); }).join('') + '</div><div class="m-hint sm">با کشیدن ⋮⋮ ترتیب رو عوض کن · برای حذف از ⋮ استفاده کن</div>';
    return h;
  }
  function bindPl(el) {
    var pl = plById(V.plId); if (!pl) return;
    $('#m-close', el).onclick = back;
    $('#m-plmenu', el).onclick = function () { V.sheet = 'plmenu'; renderSheet(); };
    $('#m-addto', el).onclick = function () { V.sheet = 'pick'; V.pickPl = pl.id; V.pickSel = {}; pl.ids.forEach(function (i) { V.pickSel[i] = 1; }); renderSheet(); };
    bindTracks(el, function (id) { V.from = 'pl'; playIds(pl.ids, id, pl.id); });
    $('#m-playpl', el).onclick = function () { var sh = M().shuffle; M().shuffle = false; V.from = 'pl'; playIds(pl.ids, pl.ids[0], pl.id); M().shuffle = sh; };
    $('#m-shufpl', el).onclick = function () { M().shuffle = true; A.save(); V.from = 'pl'; playIds(pl.ids, null, pl.id); };
    var lst = $('#m-pll', el); if (lst) reorder(lst, function (from, to) { var x = pl.ids.splice(from, 1)[0]; pl.ids.splice(to, 0, x); A.save(); renderAll(); });
  }
  function reorder(list, onMove) {
    Array.prototype.forEach.call(list.querySelectorAll('.grip'), function (g) {
      g.addEventListener('pointerdown', function (e) {
        e.preventDefault(); var row = g.closest('.trk'), rows = Array.prototype.slice.call(list.children), idx = rows.indexOf(row), h0 = row.offsetHeight, y0 = e.clientY;
        row.classList.add('drag'); g.setPointerCapture(e.pointerId);
        function mv(ev) { row.style.transform = 'translateY(' + (ev.clientY - y0) + 'px)'; }
        function up(ev) {
          g.removeEventListener('pointermove', mv); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up);
          var to = Math.max(0, Math.min(rows.length - 1, idx + Math.round((ev.clientY - y0) / h0)));
          row.classList.remove('drag'); row.style.transform = '';
          if (to !== idx) onMove(idx, to);
        }
        g.addEventListener('pointermove', mv); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
      });
    });
  }
  function newPlaylist() {
    var n = (prompt('اسم پلی‌لیست؟ (مثلاً تمرین سینه)') || '').trim().slice(0, 28); if (!n) return;
    var e = (prompt('یه ایموجی برای پلی‌لیست (اختیاری)', '🔥') || '').trim().slice(0, 2);
    var pl = { id: uid(), name: n, emoji: e || '🎵', ids: [] }; M().pls.push(pl); A.save();
    V.plId = pl.id; V.view = 'pl'; renderAll();
    if (lib.length) { V.sheet = 'pick'; V.pickPl = pl.id; V.pickSel = {}; renderSheet(); }
  }

  /* --- player view --- */
  var BARS = 18;
  function viewPlayer() {
    var t = cur, m = M();
    if (!t) { V.view = 'lib'; return viewLib(); }
    var pl = Q.plId ? plById(Q.plId) : null, ctxName = pl ? (pl.emoji || '🎵') + ' ' + pl.name : 'همه‌ی آهنگ‌ها';
    var bars = ''; for (var i = 0; i < BARS; i++) bars += '<i></i>';
    var h = '<div class="m-head"><button type="button" class="ib glass" id="m-close" aria-label="بازگشت">' + ico('down') + '</button><div class="grow ctr"><small>در حال پخش از</small><b>' + esc(ctxName) + '</b></div><button type="button" class="ib glass" id="m-pmenu" aria-label="گزینه‌ها">' + ico('dots') + '</button></div>';
    h += '<div class="pl-art">' + cvr(t, 'big') + '<div class="viz glass" id="m-viz">' + bars + '</div></div>';
    h += '<div class="pl-meta" dir="auto"><div class="grow"><b id="m-title">' + esc(t.title) + '</b><span>' + esc(t.artist || 'ناشناس') + '</span></div><button type="button" class="ib glass' + (m.favs[t.id] ? ' fav' : '') + '" id="m-fav" aria-label="علاقه‌مندی">' + ico('heart') + '</button></div>';
    h += '<div class="seek" dir="ltr"><div class="sk" id="m-seek"><div class="sf" id="m-sf"></div><div class="sd" id="m-sd"></div></div><div class="st"><span id="m-cur">' + fmt(au.currentTime) + '</span><span id="m-left">-' + fmt(Math.max(0, (t.dur || au.duration || 0) - au.currentTime)) + '</span></div></div>';
    h += '<div class="ctl" dir="ltr"><button type="button" class="ib ' + (m.shuffle ? 'act' : '') + '" id="m-shuf" aria-label="تصادفی">' + ico('shuf') + '</button><button type="button" class="ib glass md" id="m-prev" aria-label="قبلی">' + ico('prev') + '</button><button type="button" class="ib pp" id="m-pp" aria-label="پخش/توقف">' + ico(isPlaying() ? 'pause' : 'play') + '</button><button type="button" class="ib glass md" id="m-next" aria-label="بعدی">' + ico('next') + '</button><button type="button" class="ib ' + (m.repeat ? 'act' : '') + '" id="m-rep" aria-label="تکرار">' + ico('rep') + (m.repeat === 2 ? '<em>۱</em>' : '') + '</button></div>';
    h += '<div class="m-dock glass" dir="ltr"><button type="button" data-s="queue">' + ico('list') + '<small>صف</small></button><button type="button" data-s="eq">' + ico('eq') + '<small>اکولایزر</small></button><button type="button" data-s="speed"><span class="sp">' + fa(m.speed) + '×</span><small>سرعت</small></button><button type="button" data-s="sleep" class="' + (sleepEnd || sleepEOT ? 'act' : '') + '">' + ico('moon') + '<small>تایمر خواب</small></button></div>';
    return h;
  }
  function bindPlayer(el) {
    $('#m-close', el).onclick = back;
    $('#m-pmenu', el).onclick = function () { V.sheet = 'menu'; V.menuId = cur.id; renderSheet(); };
    $('#m-fav', el).onclick = function () { toggleFav(cur.id); };
    $('#m-pp', el).onclick = toggle; $('#m-prev', el).onclick = prev; $('#m-next', el).onclick = function () { next(false); };
    $('#m-shuf', el).onclick = function () { setShuffle(!M().shuffle); };
    $('#m-rep', el).onclick = function () { M().repeat = (M().repeat + 1) % 3; A.save(); A.toast(['تکرار خاموش', 'تکرار همه', 'تکرار همین آهنگ'][M().repeat]); renderAll(); };
    Array.prototype.forEach.call(el.querySelectorAll('.m-dock button'), function (b) {
      b.onclick = function () { V.sheet = b.dataset.s === 'queue' ? 'main' : 'main'; V.stab = b.dataset.s === 'queue' ? 'queue' : b.dataset.s === 'eq' ? 'eq' : 'sleep'; renderSheet(); };
    });
    seekBind($('#m-seek', el)); tickTime();
  }
  function setShuffle(on) {
    var m = M(); m.shuffle = on; A.save();
    if (cur && Q.base.length) { Q.ids = on ? shuffled(Q.base, cur.id) : Q.base.slice(); }
    A.toast(on ? 'پخش تصادفی روشن شد' : 'پخش تصادفی خاموش شد'); renderAll();
  }
  function toggleFav(id) { var f = M().favs; if (f[id]) delete f[id]; else { f[id] = 1; A.toast('به علاقه‌مندی‌ها اضافه شد ♥'); } A.save(); renderAll(); }
  function seekBind(sk) {
    if (!sk) return; var dragging = false;
    function ratio(e) { var r = sk.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); }
    function show(rt) { var d = dur(); $('#m-sf').style.width = (rt * 100) + '%'; $('#m-sd').style.left = (rt * 100) + '%'; $('#m-cur').textContent = fmt(rt * d); $('#m-left').textContent = '-' + fmt(d - rt * d); }
    sk.addEventListener('pointerdown', function (e) { dragging = true; sk.setPointerCapture(e.pointerId); sk.classList.add('on'); show(ratio(e)); });
    sk.addEventListener('pointermove', function (e) { if (dragging) show(ratio(e)); });
    function end(e) { if (!dragging) return; dragging = false; sk.classList.remove('on'); var d = dur(); if (d) au.currentTime = ratio(e) * d; tickTime(); }
    sk.addEventListener('pointerup', end); sk.addEventListener('pointercancel', function () { dragging = false; sk.classList.remove('on'); });
    sk._drag = function () { return dragging; };
  }
  function dur() { return (isFinite(au.duration) && au.duration) || (cur && cur.dur) || 0; }
  function tickTime() {
    var sk = $('#m-seek'); if (sk && sk._drag && sk._drag()) { miniProg(); return; }
    var d = dur(), p = d ? au.currentTime / d : 0;
    var sf = $('#m-sf'); if (sf) { sf.style.width = (p * 100) + '%'; $('#m-sd').style.left = (p * 100) + '%'; $('#m-cur').textContent = fmt(au.currentTime); $('#m-left').textContent = '-' + fmt(Math.max(0, d - au.currentTime)); }
    miniProg();
  }
  function miniProg() { var b = miniHost.querySelector('.mpb i'); if (b) { var d = dur(); b.style.width = (d ? au.currentTime / d * 100 : 0) + '%'; } }
  function renderPlayState() {
    var pp = $('#m-pp'); if (pp) pp.innerHTML = ico(isPlaying() ? 'pause' : 'play');
    var mp = miniHost.querySelector('.mpp'); if (mp) mp.innerHTML = ico(isPlaying() ? 'pause' : 'play');
    var gp = gymHost.querySelector('.gm-play'); if (gp) gp.innerHTML = ico(isPlaying() ? 'pause' : 'play');
    Array.prototype.forEach.call(document.querySelectorAll('.trk.cur'), function (r) {
      var b = r.querySelector('.bars'); if (isPlaying() && !b) { var s = document.createElement('span'); s.className = 'bars'; s.innerHTML = '<i></i><i></i><i></i>'; r.insertBefore(s, r.querySelector('.d')); } else if (!isPlaying() && b) b.remove();
    });
    root.classList.toggle('playing', isPlaying());
  }

  /* visualizer */
  var vizRaf = 0;
  function startViz() { if (vizRaf || !V.open || V.view !== 'player') return; vizRaf = requestAnimationFrame(vizTick); }
  function stopViz() { cancelAnimationFrame(vizRaf); vizRaf = 0; }
  var vz = [];
  function vizTick() {
    vizRaf = 0;
    var el = $('#m-viz'); if (!el || !V.open || V.view !== 'player') return;
    var bars = el.children;
    if (analyser && isPlaying()) { analyser.getByteFrequencyData(freq); for (var i = 0; i < bars.length; i++) { var v = freq[Math.min(freq.length - 1, i + 1)] / 255; bars[i].style.height = Math.max(8, Math.round(Math.pow(v, 1.25) * 100)) + '%'; } }
    else if (isPlaying()) { var tt = Date.now() / 220; for (var j = 0; j < bars.length; j++) bars[j].style.height = (25 + 60 * Math.abs(Math.sin(tt + j * 0.9))) + '%'; }
    else { for (var k = 0; k < bars.length; k++) bars[k].style.height = '10%'; return; }
    vizRaf = requestAnimationFrame(vizTick);
  }

  /* --- bottom sheets --- */
  function seg(items, on) { return '<div class="m-seg glass" id="s-tabs">' + items.map(function (x) { return '<button data-t="' + x[0] + '" class="' + (x[0] === on ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>'; }
  function renderSheet() {
    var sh = $('#m-sheet'); if (!sh) return;
    if (!V.sheet) { sh.className = 'sheet-wrap'; sh.innerHTML = ''; return; }
    sh.className = 'sheet-wrap on';
    var h = '<div class="sheet-bg" id="s-bg"></div><div class="sheet glass"><div class="grab"></div>', m = M();
    if (V.sheet === 'main') {
      h += seg([['queue', 'صف پخش'], ['eq', 'اکولایزر'], ['sleep', 'تایمر و سرعت']], V.stab);
      if (V.stab === 'queue') {
        h += '<div class="m-list sheetlist">' + (Q.ids.length ? Q.ids.map(function (id, i) { var t = byId[id]; if (!t) return ''; return '<div class="trk' + (cur && cur.id === id ? ' cur' : '') + '" data-q="' + id + '">' + cvr(t, 'sm') + '<div class="grow tx"><b>' + esc(t.title) + '</b><small>' + esc(t.artist || 'ناشناس') + '</small></div><span class="d">' + fmt(t.dur) + '</span><button type="button" class="tm" data-qx="' + id + '" aria-label="حذف از صف">' + ico('x') + '</button></div>'; }).join('') : '<div class="m-hint">صف خالیه.</div>') + '</div>';
      } else if (V.stab === 'eq') {
        h += '<div class="chips" id="s-pre">' + EQP.map(function (p) { return '<button data-p="' + p.id + '" class="' + (m.eq.p === p.id ? 'on' : '') + '">' + p.n + '</button>'; }).join('') + '</div>';
        h += '<div class="eqbox glass" dir="ltr">' + EQF.map(function (f, i) { return '<div class="eqc"><div class="eqv" id="ev' + i + '">' + (m.eq.g[i] > 0 ? '+' : '') + m.eq.g[i] + '</div><div class="eqs"><input type="range" min="-12" max="12" step="1" value="' + m.eq.g[i] + '" data-b="' + i + '" aria-label="' + f.n + '"></div><small>' + f.n + '</small></div>'; }).join('') + '</div>';
        h += '<div class="m-hint sm">اکولایزر روی همه‌ی آهنگ‌ها اعمال می‌شه. اگه صدا نداشت، یه بار پخش رو بزن.</div>';
      } else {
        var left = sleepEnd ? Math.max(0, Math.ceil((sleepEnd - Date.now()) / 60000)) : 0;
        h += '<div class="m-lbl">تایمر خواب' + (sleepEnd ? ' · ' + fa(left) + ' دقیقه مونده' : sleepEOT ? ' · پایان این آهنگ' : '') + '</div><div class="chips" id="s-sl">' + [[15, '۱۵ دقیقه'], [30, '۳۰ دقیقه'], [45, '۴۵ دقیقه'], [60, '۱ ساعت'], ['eot', 'پایان آهنگ'], [0, 'خاموش']].map(function (x) { return '<button data-m="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div>';
        h += '<div class="m-lbl">سرعت پخش</div><div class="chips" id="s-sp">' + [0.75, 1, 1.25, 1.5, 2].map(function (x) { return '<button data-v="' + x + '" class="' + (m.speed === x ? 'on' : '') + '">' + fa(x) + '×</button>'; }).join('') + '</div>';
      }
    } else if (V.sheet === 'menu') {
      var t = byId[V.menuId]; if (!t) { V.sheet = null; renderSheet(); return; }
      var pl = V.view === 'pl' ? plById(V.plId) : null;
      h += '<div class="trk static">' + cvr(t, 'sm') + '<div class="grow tx"><b>' + esc(t.title) + '</b><small>' + esc(t.artist || 'ناشناس') + '</small></div></div><div class="acts">' +
        '<button data-a="next">پخش بعدی</button><button data-a="queue">افزودن به صف</button><button data-a="pl">افزودن به پلی‌لیست…</button>' +
        '<button data-a="fav">' + (m.favs[t.id] ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها ♥') + '</button><button data-a="edit">ویرایش نام و خواننده</button>' +
        (pl ? '<button data-a="rmpl" class="warn">حذف از این پلی‌لیست</button>' : '') + '<button data-a="del" class="warn">حذف از کتابخونه</button></div>';
    } else if (V.sheet === 'plmenu') {
      h += '<div class="acts"><button data-a="plplay">پخش</button><button data-a="plren">تغییر نام و ایموجی</button><button data-a="pldel" class="warn">حذف پلی‌لیست</button></div>';
    } else if (V.sheet === 'pick') {
      var pl2 = plById(V.pickPl);
      h += '<div class="m-lbl nm">آهنگ‌ها رو انتخاب کن' + (pl2 ? ' · ' + esc(pl2.name) : '') + '</div>';
      h += '<div class="m-list sheetlist">' + (lib.length ? lib.map(function (t) { return '<div class="trk pick' + (V.pickSel[t.id] ? ' sel' : '') + '" data-pk="' + t.id + '">' + cvr(t, 'sm') + '<div class="grow tx"><b>' + esc(t.title) + '</b><small>' + esc(t.artist || 'ناشناس') + '</small></div><span class="chk">' + (V.pickSel[t.id] ? '✓' : '') + '</span></div>'; }).join('') : '<div class="m-hint">اول از «افزودن آهنگ» آهنگ اضافه کن.</div>') + '</div>';
      h += '<div class="m-pr"><button type="button" class="m-btn" id="pk-ok">تأیید</button><label class="m-btn ghost glass" for="m-file" id="pk-new">+ آهنگ جدید</label></div>';
    } else if (V.sheet === 'pls') {
      h += '<div class="m-lbl nm">افزودن به کدوم پلی‌لیست؟</div><div class="acts">' + m.pls.map(function (p) { return '<button data-pl="' + p.id + '">' + esc((p.emoji || '🎵') + ' ' + p.name) + (p.ids.indexOf(V.menuId) >= 0 ? ' ✓' : '') + '</button>'; }).join('') + '<button data-pl="new">+ پلی‌لیست جدید</button></div>';
    }
    h += '</div>';
    sh.innerHTML = h; bindSheet(sh);
  }
  function bindSheet(sh) {
    $('#s-bg', sh).onclick = function () { V.sheet = null; renderSheet(); };
    var tabs = $('#s-tabs', sh); if (tabs) Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.onclick = function () { V.stab = b.dataset.t; renderSheet(); }; });
    Array.prototype.forEach.call(sh.querySelectorAll('[data-q]'), function (r) { r.onclick = function (e) { if (e.target.closest('[data-qx]')) return; jump(r.dataset.q); }; });
    Array.prototype.forEach.call(sh.querySelectorAll('[data-qx]'), function (b) { b.onclick = function () { removeFromQueue(b.dataset.qx); }; });
    var pre = $('#s-pre', sh); if (pre) Array.prototype.forEach.call(pre.querySelectorAll('button'), function (b) { b.onclick = function () { var p = EQP.filter(function (x) { return x.id === b.dataset.p; })[0]; M().eq = { p: p.id, g: p.g.slice() }; A.save(); ensureGraph(); applyEQ(); renderSheet(); }; });
    Array.prototype.forEach.call(sh.querySelectorAll('.eqs input'), function (inp) {
      inp.oninput = function () { var i = +inp.dataset.b, v = +inp.value, e = M().eq; e.g[i] = v; e.p = 'custom'; var ev = document.getElementById('ev' + i); if (ev) ev.textContent = (v > 0 ? '+' : '') + v; ensureGraph(); applyEQ(); };
      inp.onchange = function () { A.save(); var pre2 = $('#s-pre'); if (pre2) Array.prototype.forEach.call(pre2.querySelectorAll('button'), function (b) { b.classList.remove('on'); }); };
    });
    var sl = $('#s-sl', sh); if (sl) Array.prototype.forEach.call(sl.querySelectorAll('button'), function (b) { b.onclick = function () { var v = b.dataset.m; if (v === 'eot') setSleep('eot'); else if (+v === 0) { setSleep(0); A.toast('تایمر خواب خاموش شد'); } else setSleep(+v); }; });
    var sp = $('#s-sp', sh); if (sp) Array.prototype.forEach.call(sp.querySelectorAll('button'), function (b) { b.onclick = function () { M().speed = +b.dataset.v; au.playbackRate = M().speed; A.save(); renderSheet(); renderAll(true); }; });
    Array.prototype.forEach.call(sh.querySelectorAll('.acts [data-a]'), function (b) { b.onclick = function () { action(b.dataset.a); }; });
    Array.prototype.forEach.call(sh.querySelectorAll('.acts [data-pl]'), function (b) {
      b.onclick = function () {
        var id = V.menuId;
        if (b.dataset.pl === 'new') { var n = (prompt('اسم پلی‌لیست جدید؟') || '').trim().slice(0, 28); if (!n) return; var pl = { id: uid(), name: n, emoji: '🎵', ids: [id] }; M().pls.push(pl); A.save(); A.toast('پلی‌لیست ساخته شد'); }
        else { var p = plById(b.dataset.pl); if (p.ids.indexOf(id) >= 0) { p.ids = p.ids.filter(function (x) { return x !== id; }); A.toast('از پلی‌لیست حذف شد'); } else { p.ids.push(id); A.toast('اضافه شد به ' + p.name); } A.save(); }
        V.sheet = null; renderAll();
      };
    });
    Array.prototype.forEach.call(sh.querySelectorAll('[data-pk]'), function (r) { r.onclick = function () { var id = r.dataset.pk; if (V.pickSel[id]) delete V.pickSel[id]; else V.pickSel[id] = 1; r.classList.toggle('sel'); r.querySelector('.chk').textContent = V.pickSel[id] ? '✓' : ''; }; });
    var ok = $('#pk-ok', sh); if (ok) ok.onclick = function () { var pl = plById(V.pickPl); if (pl) { var keep = pl.ids.filter(function (i) { return V.pickSel[i]; }); Object.keys(V.pickSel).forEach(function (i) { if (keep.indexOf(i) < 0 && byId[i]) keep.push(i); }); pl.ids = keep; A.save(); A.toast('پلی‌لیست به‌روز شد'); } V.sheet = null; renderAll(); };
    var pn = $('#pk-new', sh); if (pn) pn.onclick = function () { importTo = V.pickPl; };
  }
  function action(a) {
    var id = V.menuId, t = byId[id], pl = plById(V.plId);
    if (a === 'next') { var i = curIdx(); if (Q.ids.indexOf(id) >= 0) Q.ids.splice(Q.ids.indexOf(id), 1); Q.ids.splice(i + 1, 0, id); if (Q.base.indexOf(id) < 0) Q.base.push(id); A.toast('بعد از آهنگ فعلی پخش می‌شه'); if (!cur) playIds([id], id, null); }
    else if (a === 'queue') { if (!Q.ids.length) { playIds([id], id, null); } else { if (Q.ids.indexOf(id) < 0) { Q.ids.push(id); Q.base.push(id); } A.toast('به صف اضافه شد'); } }
    else if (a === 'pl') { V.sheet = 'pls'; renderSheet(); return; }
    else if (a === 'fav') { toggleFav(id); }
    else if (a === 'edit') { var nt = prompt('نام آهنگ', t.title); if (nt && nt.trim()) t.title = nt.trim().slice(0, 80); var na = prompt('نام خواننده', t.artist || ''); if (na !== null) t.artist = na.trim().slice(0, 60); tx('tracks', 'readwrite', function (os) { return os.put(t); }); if (cur && cur.id === id) mediaMeta(); }
    else if (a === 'rmpl') { pl.ids = pl.ids.filter(function (x) { return x !== id; }); A.save(); }
    else if (a === 'del') { if (!confirm('«' + t.title + '» از کتابخونه حذف بشه؟')) return; removeTrack(id); }
    else if (a === 'plplay') { V.sheet = null; renderSheet(); V.from = 'pl'; playIds(pl.ids, null, pl.id); return; }
    else if (a === 'plren') { var n = prompt('اسم پلی‌لیست', pl.name); if (n && n.trim()) pl.name = n.trim().slice(0, 28); var e = prompt('ایموجی', pl.emoji || '🎵'); if (e && e.trim()) pl.emoji = e.trim().slice(0, 2); A.save(); }
    else if (a === 'pldel') { if (!confirm('پلی‌لیست «' + pl.name + '» حذف بشه؟ (آهنگ‌ها می‌مونن)')) return; M().pls = M().pls.filter(function (x) { return x.id !== pl.id; }); A.save(); V.view = 'lib'; V.tab = 'pls'; }
    V.sheet = null; renderAll();
  }
  function removeFromQueue(id) {
    var wasCur = cur && cur.id === id; Q.ids = Q.ids.filter(function (x) { return x !== id; }); Q.base = Q.base.filter(function (x) { return x !== id; });
    if (wasCur) { if (Q.ids.length) next(false); else { au.pause(); } } renderSheet();
  }
  function removeTrack(id) {
    var wasCur = cur && cur.id === id;
    Q.ids = Q.ids.filter(function (x) { return x !== id; }); Q.base = Q.base.filter(function (x) { return x !== id; });
    M().pls.forEach(function (p) { p.ids = p.ids.filter(function (x) { return x !== id; }); }); delete M().favs[id];
    lib = lib.filter(function (t) { return t.id !== id; }); reindex();
    tx('tracks', 'readwrite', function (os) { return os.delete(id); }); tx('blobs', 'readwrite', function (os) { return os.delete(id); });
    if (wasCur) { au.pause(); au.removeAttribute('src'); if (Q.ids.length) load(Q.ids[0], false); else { cur = null; M().last = null; setTheme(null); if (V.view === 'player') V.view = 'lib'; } }
    A.save();
  }

  /* ---------- rendering ---------- */
  var held = false; // true when only the sheet/time should update
  function renderAll(soft) {
    renderGym(); renderMini();
    if (!V.open) return;
    var scr = $('#m-screen');
    if (!scr) {
      root.innerHTML = '<div class="m-bg"><i></i><i></i><i></i></div><div id="m-screen" class="m-screen"></div><div id="m-sheet" class="sheet-wrap"></div><div class="m-file-note"></div>';
      scr = $('#m-screen');
    }
    var top = scr.scrollTop;
    scr.className = 'm-screen v-' + V.view;
    scr.innerHTML = V.view === 'player' ? viewPlayer() : V.view === 'pl' ? viewPl() : viewLib();
    if (V.view === 'player') bindPlayer(scr); else if (V.view === 'pl') bindPl(scr); else bindLib(scr);
    scr.scrollTop = top; renderSheet(); renderPlayState();
    if (V.view === 'player') { stopViz(); startViz(); } else stopViz();
  }
  function renderMini() {
    var show = cur && !(V.open) ;
    document.body.classList.toggle('has-mini', !!show);
    if (!show) { miniHost.innerHTML = ''; miniHost.className = 'hidden'; return; }
    miniHost.className = 'm-mini glass';
    miniHost.innerHTML = '<div class="mm" id="mm-open">' + cvr(cur, 'mini') + '<div class="grow tx"><b>' + esc(cur.title) + '</b><small>' + esc(cur.artist || 'ناشناس') + '</small></div></div>' +
      '<button type="button" class="ib" id="mm-prev" aria-label="قبلی">' + ico('prev') + '</button><button type="button" class="ib pp mpp" id="mm-pp" aria-label="پخش/توقف">' + ico(isPlaying() ? 'pause' : 'play') + '</button><button type="button" class="ib" id="mm-next" aria-label="بعدی">' + ico('next') + '</button><div class="mpb"><i></i></div>';
    $('#mm-open', miniHost).onclick = function () { V.from = 'mini'; open('player'); };
    $('#mm-prev', miniHost).onclick = prev; $('#mm-pp', miniHost).onclick = toggle; $('#mm-next', miniHost).onclick = function () { next(false); };
    miniProg();
  }
  function renderGym() {
    var m = M(), t = cur || (m.last && byId[m.last.cur]) || null;
    var sub = fa(m.pls.length) + ' پلی‌لیست · ' + fa(lib.length) + ' آهنگ';
    var h = '<div class="gm glass" id="gm-card"><div class="gm-top">' + cvr(t, 'gm-cv') + '<div class="grow tx"><small>موزیک تمرین</small><b>' + (t ? esc(t.title) : 'پلی‌لیست‌ها و آهنگ‌هات') + '</b><span>' + (t ? esc(t.artist || sub) : sub) + '</span></div>' +
      '<button type="button" class="ib pp gm-play" id="gm-pp" aria-label="پخش">' + ico(isPlaying() ? 'pause' : 'play') + '</button></div>';
    h += '<div class="gm-chips" id="gm-chips">' + m.pls.map(function (p) { return '<button type="button" class="ch glass" data-pl="' + p.id + '">' + esc((p.emoji || '🎵') + ' ' + p.name) + '</button>'; }).join('') + '<button type="button" class="ch glass dash" id="gm-new">' + (m.pls.length ? '+ جدید' : '+ ساخت پلی‌لیست') + '</button></div></div>';
    gymHost.innerHTML = h;
    $('#gm-card', gymHost).onclick = function (e) {
      if (e.target.closest('#gm-pp')) { if (!lib.length) { open('lib', 'tracks'); return; } toggle(); return; }
      var c = e.target.closest('[data-pl]');
      if (c) { var pl = plById(c.dataset.pl); if (pl && pl.ids.length) { V.from = 'lib'; playIds(pl.ids, null, pl.id); } else { V.plId = c.dataset.pl; open('pl'); } return; }
      if (e.target.closest('#gm-new')) { open('lib', 'pls'); newPlaylist(); return; }
      open('lib', 'pls');
    };
  }

  /* ---------- boot ---------- */
  root.addEventListener('click', function () {}, false);
  setTheme(null);
  loadLib().then(function () {
    var l = M().last;
    if (l && byId[l.cur]) { Q.base = (l.base || []).filter(function (i) { return byId[i]; }); Q.plId = l.plId || null; Q.ids = M().shuffle ? shuffled(Q.base, l.cur) : Q.base.slice(); cur = byId[l.cur]; Q.i = curIdx(); setTheme(cur); mediaMeta(); }
    renderAll();
  });
  renderGym();
  window.AEMusic = { open: open, renderCard: renderGym, _t: { parseID3: parseID3, cleanName: cleanName, rgbToHS: rgbToHS, importFiles: importFiles, lib: function () { return lib; }, state: function () { return { cur: cur && cur.id, q: Q.ids.slice(), playing: isPlaying(), t: au.currentTime }; } } };
})();

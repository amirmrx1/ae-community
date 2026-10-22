(function () {
  'use strict';
  var A = window.AE;
  if (!A) return;
  var S = A.S, CFG = window.AE_CONFIG || {};
  var root = document.getElementById('coach-root');
  var view = document.getElementById('v-coach');
  var gen = null, chatBusy = false, chatErr = null, draft = '', genTimer = null;

  function fa(n) { return A.fa(n); }
  function h(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === 'class') e.className = props[k];
      else if (k === 'text') e.textContent = props[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), props[k]);
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { if (c == null) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function C() {
    var c = S.coach = S.coach || {};
    c.chat = c.chat || {}; c.chat.goggins = c.chat.goggins || []; c.chat.money = c.chat.money || [];
    c.mode = c.mode === 'money' ? 'money' : 'goggins';
    c.tab = c.tab || 'chat';
    c.dmap = c.dmap || {}; c.done = c.done || {}; c.pushed = c.pushed || {};
    c.ans = c.ans || {}; if (typeof c.qi !== 'number') c.qi = 0;
    return c;
  }
  function base() { return String(C().url || CFG.AI_URL || '').trim().replace(/\/+$/, ''); }

  /* ---------- network ---------- */
  function api(path, body, ms) {
    var u = base();
    if (!u) return Promise.reject({ code: 'nourl' });
    if (navigator.onLine === false) return Promise.reject({ code: 'offline' });
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, ms || 100000);
    return fetch(u + path, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', 'x-ae-key': CFG.KEY || '' },
      body: JSON.stringify(C().model ? Object.assign({}, body, { model: C().model }) : body)
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw { code: j.error || ('http' + r.status) };
        return j;
      });
    }).catch(function (e) {
      if (e && e.name === 'AbortError') throw { code: 'timeout' };
      if (e && e.code) throw e;
      throw { code: 'network' };
    }).then(function (v) { clearTimeout(t); return v; }, function (e) { clearTimeout(t); throw e; });
  }
  function errText(e) {
    var m = {
      nourl: 'مربی هنوز به سرور وصل نشده. از ⚙️ بالای همین صفحه آدرس سرور رو وارد کن.',
      offline: 'اینترنت نداری. وصل شو و دوباره امتحان کن.',
      network: 'به سرور نرسیدم. اینترنت (یا فیلترشکن) رو چک کن و دوباره بزن.',
      timeout: 'خیلی طول کشید. دوباره امتحان کن.',
      limit: 'سهمیه‌ی رایگان امروز تموم شد. ساعت ۳:۳۰ بامداد به وقت ایران ریست می‌شه؛ تا اون موقع کار امروزت رو انجام بده 💪',
      auth: 'کلید اپ با سرور نمی‌خونه. اپ رو از آخرین نسخه نصب کن.',
      ai: 'مدل هوش مصنوعی جواب درست نداد. یه بار دیگه بزن.',
      bad_input: 'ورودی درست نبود. دوباره امتحان کن.'
    };
    return m[e && e.code] || 'یه مشکلی پیش اومد. دوباره امتحان کن.';
  }

  /* ---------- day helpers ---------- */
  function ymd(k) { var a = k.split('-'); return Date.UTC(+a[0], +a[1] - 1, +a[2]); }
  function dayIdx() { var c = C(); return c.startKey ? Math.max(0, Math.round((ymd(A.dayKey()) - ymd(c.startKey)) / 86400000)) : 0; }
  function isDone(i, s) { var d = C().done[i]; return !!(d && d[s]); }
  function dayStats(i) {
    var d = C().dmap[i]; if (!d) return null;
    var n = d.steps.length, k = 0; for (var s = 0; s < n; s++) if (isDone(i, s)) k++;
    return { n: n, k: k };
  }
  function streak() {
    var c = C(), i = dayIdx(), n = 0, st;
    st = dayStats(i); if (st && st.k === st.n) n++;
    for (var j = i - 1; j >= 0; j--) { st = dayStats(j); if (st && st.k === st.n) n++; else break; }
    return n;
  }
  function histText() {
    var i = dayIdx(), a = 0, b = 0;
    for (var j = Math.max(0, i - 7); j < i; j++) { var st = dayStats(j); if (st) { a += st.k; b += st.n; } }
    return b ? ('last days: ' + a + ' of ' + b + ' planned steps were done') : '';
  }
  function weekFocus() {
    var c = C(); if (!c.plan || !c.plan.weeks) return '';
    var w = c.plan.weeks[Math.floor(dayIdx() / 7)] || c.plan.weeks[c.plan.weeks.length - 1];
    return w ? w.focus : '';
  }
  function chatCtx() {
    var c = C(), o = { clock: new Date().toTimeString().slice(0, 5) };
    try { o.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { /* default tz on the server */ }
    if (c.plan) { o.vision = c.plan.vision; o.weekFocus = weekFocus(); }
    var i = dayIdx(), d = c.dmap[i];
    if (d) { o.dayNumber = i + 1; o.today = d.steps.map(function (s, k) { return { t: s.t, done: isDone(i, k) }; }); }
    return o;
  }

  /* ---------- quiz ---------- */
  var SC = ['۱ · افتضاح', '۲ · ضعیف', '۳ · متوسط', '۴ · خوب', '۵ · عالی'];
  var Q = [
    { id: 'goal', t: 'هدف اصلیت دقیقاً چیه؟', hint: 'مثلاً: ساخت یه شرکت تولید محتوا که ماهی ۵۰ میلیون دربیاره', type: 'text', req: true },
    { id: 'area', t: 'این هدف توی کدوم حوزه‌ست؟', type: 'choice', opts: ['کسب‌وکار و پول', 'تناسب اندام و سلامت', 'مهارت و شغل', 'درس و تحصیل', 'عادت‌ها و ذهنیت', 'چند حوزه با هم'] },
    { id: 'why', t: 'چرا؟ دلیل واقعی‌ت چیه؟', hint: 'اونی که شب‌ها بیدارت نگه می‌داره، نه جواب قشنگ', type: 'text', req: true },
    { id: 'level', t: 'الان کجای مسیر هستی؟', type: 'choice', opts: ['از صفر شروع می‌کنم', 'یه کم بلدم و تجربه دارم', 'نیمه‌راهم و گیر کردم', 'حرفه‌ای‌ام و می‌خوام رشد کنم'] },
    { id: 'hours', t: 'روزی واقعاً چند ساعت می‌تونی برای این هدف وقت بذاری؟', hint: 'واقعی جواب بده، نه آرزویی', type: 'choice', opts: ['نیم ساعت', '۱ ساعت', '۲ ساعت', '۳ ساعت', '۴ ساعت یا بیشتر'], val: [0.5, 1, 2, 3, 4] },
    { id: 'deadline', t: 'می‌خوای تا کی به نتیجه‌ی اول برسی؟', type: 'choice', opts: ['۳۰ روز', '۹۰ روز', '۶ ماه', '۱ سال'] },
    { id: 'blockers', t: 'چی همیشه متوقفت می‌کنه؟', hint: 'چندتا می‌تونی انتخاب کنی', type: 'multi', opts: ['ترس از شکست', 'تنبلی و فرار', 'بی‌پولی', 'نداشتن دانش و مهارت', 'بی‌نظمی', 'حواس‌پرتی و گوشی', 'نداشتن تیم یا کمک', 'خستگی و کم‌انرژی'] },
    { id: 'wake', t: 'معمولاً کی بیدار می‌شی؟', type: 'choice', opts: ['قبل از ۶ صبح', '۶ تا ۸', '۸ تا ۱۰', 'بعد از ۱۰ (شب‌زنده‌دار)'] },
    { id: 'quit', t: 'آخرین باری که یه کار بزرگ رو نیمه‌کاره ول کردی چی بود و چرا؟', hint: 'اختیاری، ولی هرچی رک‌تر، نقشه دقیق‌تر', type: 'text', req: false },
    { id: 'assets', t: 'الان چی داری که می‌شه روش ساخت؟', hint: 'مهارت، پول، مخاطب، مشتری، تجهیزات… (اختیاری)', type: 'text', req: false },
    { id: 's1', t: 'خودت رو توی «استمرار» نمره بده', hint: 'تا حالا چقدر کارهات رو ادامه دادی؟', type: 'scale' },
    { id: 's2', t: 'خودت رو توی «تمرکز» نمره بده', hint: 'چقدر می‌تونی بدون گوشی و حواس‌پرتی کار کنی؟', type: 'scale' },
    { id: 's3', t: 'خودت رو توی «انرژی و سلامت» نمره بده', hint: 'خواب، ورزش، تغذیه', type: 'scale' }
  ];

  function quizNext() {
    var c = C();
    if (c.qi < Q.length - 1) { c.qi++; A.save(); render(); } else finishQuiz();
  }
  function finishQuiz() {
    var c = C(), a = c.ans;
    c.profile = {
      name: S.name || '', goal: a.goal || '', area: a.area || '', why: a.why || '', level: a.level || '',
      hours: a.hoursVal || 1, deadline: a.deadline || '', blockers: a.blockers || [], wake: a.wake || '',
      quit: a.quit || '', assets: a.assets || '',
      scores: { consistency: +a.s1 || 3, focus: +a.s2 || 3, energy: +a.s3 || 3 }, at: Date.now()
    };
    c.quizOn = false; c.showResult = true; c.tab = 'quiz'; A.save(); render();
  }
  function quizView() {
    var c = C(), box = h('div');
    if (gen) return loader();
    if (c.quizOn) {
      var q = Q[c.qi], card = h('div', { class: 'card co-q' });
      card.appendChild(h('div', { class: 'co-step', text: 'سؤال ' + fa(c.qi + 1) + ' از ' + fa(Q.length) }));
      card.appendChild(h('div', { class: 'progress' }, [h('i', { style: 'width:' + Math.round((c.qi + 1) / Q.length * 100) + '%' })]));
      card.appendChild(h('div', { class: 'co-qt', text: q.t }));
      if (q.hint) card.appendChild(h('div', { class: 'co-hint', text: q.hint }));
      var nextBtn = null;
      if (q.type === 'text') {
        var ta = h('textarea', { class: 'input co-ta', rows: '4', maxlength: '300', placeholder: 'اینجا بنویس…' });
        ta.value = c.ans[q.id] || '';
        ta.addEventListener('input', function () { c.ans[q.id] = ta.value; A.save(); });
        card.appendChild(ta);
        nextBtn = h('button', { class: 'btn-primary', text: c.qi === Q.length - 1 ? 'تموم' : 'بعدی', onclick: function () {
          if (q.req && !(c.ans[q.id] || '').trim()) { ta.classList.add('shake'); setTimeout(function () { ta.classList.remove('shake'); }, 400); return; }
          quizNext();
        } });
      } else if (q.type === 'choice') {
        q.opts.forEach(function (o, i) {
          card.appendChild(h('button', { class: 'co-opt' + (c.ans[q.id] === o ? ' on' : ''), text: o, onclick: function () {
            c.ans[q.id] = o; if (q.val) c.ans.hoursVal = q.val[i]; A.save(); setTimeout(quizNext, 140); render(true);
          } }));
        });
      } else if (q.type === 'multi') {
        var sel = c.ans[q.id] || [];
        q.opts.forEach(function (o) {
          card.appendChild(h('button', { class: 'co-opt' + (sel.indexOf(o) > -1 ? ' on' : ''), text: o, onclick: function () {
            var i = sel.indexOf(o); if (i > -1) sel.splice(i, 1); else sel.push(o); c.ans[q.id] = sel; A.save(); render(true);
          } }));
        });
        nextBtn = h('button', { class: 'btn-primary', text: 'بعدی', onclick: function () { if (!sel.length) { A.toast('حداقل یکی رو انتخاب کن'); return; } quizNext(); } });
      } else if (q.type === 'scale') {
        var row = h('div', { class: 'co-scale' });
        SC.forEach(function (l, i) {
          row.appendChild(h('button', { class: 'co-opt' + (+c.ans[q.id] === i + 1 ? ' on' : ''), text: l, onclick: function () {
            c.ans[q.id] = i + 1; A.save(); setTimeout(quizNext, 140); render(true);
          } }));
        });
        card.appendChild(row);
      }
      var nav = h('div', { class: 'co-nav' });
      if (c.qi > 0) nav.appendChild(h('button', { class: 'btn-ghost sm', text: 'قبلی', onclick: function () { c.qi--; A.save(); render(); } }));
      nav.appendChild(h('div', { class: 'grow' }));
      if (q.type === 'text' && !q.req) nav.appendChild(h('button', { class: 'btn-ghost sm', text: 'رد کردن', onclick: function () { c.ans[q.id] = ''; quizNext(); } }));
      if (nextBtn) nav.appendChild(nextBtn);
      card.appendChild(nav);
      box.appendChild(card);
      return box;
    }
    var p = c.profile;
    if (!p) {
      box.appendChild(h('div', { class: 'card co-intro' }, [
        h('div', { class: 'co-big', text: '🎯' }),
        h('div', { class: 'co-qt', text: 'آزمون هدف‌یابی' }),
        h('p', { class: 'co-p', text: 'چند تا سؤال رک و کوتاه. جواب‌هات رو می‌گیرم، هدفت رو دقیق می‌کنم و ازش یه نقشه‌ی راه از ماه تا قدم‌های روزانه می‌چینم. ' + fa(Q.length) + ' سؤال، حدود ۳ دقیقه.' }),
        h('button', { class: 'btn-primary', text: 'شروع آزمون', onclick: function () { c.quizOn = true; c.qi = 0; c.ans = {}; A.save(); render(); } })
      ]));
      return box;
    }
    var sc = p.scores, avg = (sc.consistency + sc.focus + sc.energy) / 3;
    var names = { consistency: 'استمرار', focus: 'تمرکز', energy: 'انرژی و سلامت' }, low = 'consistency';
    for (var k in sc) if (sc[k] < sc[low]) low = k;
    var verdict = avg < 2.5 ? 'نمره‌ت پایینه و خوبه که رک گفتی. یعنی ذهن و بدنت هنوز نرمن. مشکل استعداد نیست، تمرینه. از امروز با قدم‌های کوچیک ولی بی‌وقفه شروع می‌کنیم.'
      : avg < 3.8 ? 'وسط راهی. شروع کردن رو بلدی ولی توی روزهای بد جا می‌زنی. همون روزها تعیین می‌کنن تو کی هستی.'
      : 'نمره‌ت بالاست، پس بهونه‌ای نداری. فقط مواظب باش اعتمادبه‌نفس تبدیل به تنبلی نشه. سقف رو ببر بالاتر.';
    if (c.showResult) box.appendChild(h('div', { class: 'card co-res' }, [
      h('div', { class: 'co-big', dir: 'ltr', text: avg.toFixed(1).replace(/\d/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[d]; }) + ' / ۵' }),
      h('div', { class: 'co-qt', text: 'نتیجه‌ی آزمون' }),
      h('p', { class: 'co-p', text: verdict }),
      h('p', { class: 'co-p', text: 'ضعیف‌ترین نقطه‌ت: ' + names[low] })
    ]));
    var card2 = h('div', { class: 'card co-prof' }, [
      h('div', { class: 'co-qt', text: 'پرونده‌ی تو' }),
      h('div', { class: 'co-row' }, [h('b', { text: 'هدف: ' }), p.goal]),
      h('div', { class: 'co-row' }, [h('b', { text: 'دلیل: ' }), p.why]),
      h('div', { class: 'co-row' }, [h('b', { text: 'وقت روزانه: ' }), fa(p.hours) + ' ساعت']),
      h('div', { class: 'co-row' }, [h('b', { text: 'ددلاین: ' }), p.deadline]),
      h('div', { class: 'co-row' }, [h('b', { text: 'موانع: ' }), (p.blockers || []).join('، ') || '-'])
    ]);
    box.appendChild(card2);
    if (!c.plan) box.appendChild(h('button', { class: 'btn-primary co-wide', text: 'ساختن نقشه‌ی راه من 🔥', onclick: genPlan }));
    else box.appendChild(h('button', { class: 'btn-primary co-wide', text: 'دیدن نقشه‌ی راه', onclick: function () { c.tab = 'plan'; A.save(); render(); } }));
    box.appendChild(h('button', { class: 'btn-ghost co-wide', text: 'آزمون دوباره', onclick: function () {
      if (c.plan && !confirm('آزمون دوباره پرونده‌ات رو عوض می‌کنه. نقشه‌ی فعلی می‌مونه تا خودت دوباره نقشه بسازی. ادامه؟')) return;
      c.quizOn = true; c.qi = 0; c.ans = {}; c.showResult = false; A.save(); render();
    } }));
    return box;
  }

  /* ---------- plan generation ---------- */
  var LOAD = ['دارم هدفت رو تیکه‌تیکه می‌کنم…', 'بهونه‌هات رو می‌شمرم و ازشون رد می‌شم…', 'ماه‌ها، هفته‌ها، روزها…', 'قدم‌های امروز رو می‌چینم…', 'کمی صبر کن، ارزششو داره.'];
  function loader() {
    var el = h('div', { class: 'card co-load' }, [h('div', { class: 'co-spin' }), h('div', { class: 'co-qt', id: 'co-load-t', text: gen === 'days' ? 'در حال چیدن قدم‌های روزانه…' : 'در حال ساختن نقشه‌ی راه…' }), h('p', { class: 'co-p', id: 'co-load-s', text: LOAD[0] }), h('p', { class: 'co-hint', text: 'تا ۱ دقیقه طول می‌کشه. از اپ خارج نشو.' })]);
    return el;
  }
  function startLoadTicker() {
    clearInterval(genTimer); var i = 0;
    genTimer = setInterval(function () { var s = document.getElementById('co-load-s'); if (!s) return; i = (i + 1) % LOAD.length; s.textContent = LOAD[i]; }, 3500);
  }
  function stopLoadTicker() { clearInterval(genTimer); genTimer = null; }
  function genPlan() {
    var c = C(); if (gen) return;
    if (c.plan && !confirm('نقشه و قدم‌های روزانه‌ی فعلی پاک می‌شن و از نو ساخته می‌شن. ادامه؟')) return;
    gen = 'plan'; c.tab = 'quiz'; startLoadTicker(); render();
    api('/plan', { profile: c.profile }, 110000).then(function (r) {
      c.plan = r.plan; c.startKey = A.dayKey(); c.dmap = {}; c.done = {}; c.pushed = {}; A.save();
      gen = 'days'; render();
      return api('/days', { profile: c.profile, plan: c.plan, from_day: 0, history: '' }, 110000).then(saveDays);
    }).then(function () { c.tab = 'today'; c.showResult = false; }, function (e) {
      A.toast(errText(e)); if (c.plan) c.tab = 'plan';
    }).then(function () { gen = null; stopLoadTicker(); A.save(); render(); });
  }
  function saveDays(r) {
    var c = C();
    (r.days || []).forEach(function (d) { c.dmap[d.n - 1] = d; });
    A.save();
  }
  function genDays(from) {
    var c = C(); if (gen) return;
    gen = 'days'; startLoadTicker(); render();
    api('/days', { profile: c.profile, plan: c.plan, from_day: from, history: histText() }, 110000).then(saveDays).catch(function (e) { A.toast(errText(e)); })
      .then(function () { gen = null; stopLoadTicker(); render(); });
  }

  /* ---------- today ---------- */
  function todayView() {
    var c = C(), box = h('div');
    if (gen) return loader();
    if (!c.plan) {
      box.appendChild(h('div', { class: 'card co-intro' }, [h('div', { class: 'co-big', text: '📅' }), h('div', { class: 'co-qt', text: 'هنوز نقشه‌ای نداری' }),
        h('p', { class: 'co-p', text: 'اول آزمون هدف‌یابی بده تا قدم‌های روزانه‌ات رو بچینم.' }),
        h('button', { class: 'btn-primary', text: c.profile ? 'ساختن نقشه' : 'شروع آزمون', onclick: function () { if (c.profile) genPlan(); else { c.tab = 'quiz'; A.save(); render(); } } })]));
      return box;
    }
    var i = dayIdx(), d = c.dmap[i];
    if (!d) {
      box.appendChild(h('div', { class: 'card co-intro' }, [h('div', { class: 'co-big', text: '⚡' }), h('div', { class: 'co-qt', text: 'قدم‌های روز ' + fa(i + 1) + ' آماده نیست' }),
        h('p', { class: 'co-p', text: 'می‌خوای برات قدم‌های ۷ روز از همین روز رو بچینم؟ بر اساس پیشرفت اخیرت تنظیم می‌شه.' }),
        h('button', { class: 'btn-primary', text: 'بچین', onclick: function () { genDays(i); } })]));
      return box;
    }
    var st = dayStats(i);
    box.appendChild(h('div', { class: 'card co-day' }, [
      h('div', { class: 'co-dayhead' }, [h('div', { class: 'co-qt', text: 'روز ' + fa(i + 1) }), h('div', { class: 'pill', text: '🔥 ' + fa(streak()) + ' روز پشت‌سرهم' })]),
      d.theme ? h('div', { class: 'co-hint', text: d.theme }) : null,
      h('div', { class: 'progress big' }, [h('i', { style: 'width:' + Math.round(st.k / st.n * 100) + '%' })])
    ]));
    d.steps.forEach(function (s, k) {
      var done = isDone(i, k);
      var row = h('div', { class: 'card task' + (done ? ' done' : '') }, [
        h('div', { class: 'cb' }, [(function () { var sv = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); sv.setAttribute('viewBox', '0 0 24 24'); var p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', 'm5 12.5 4.5 4.5L19 7.5'); sv.appendChild(p); return sv; })()]),
        h('div', { class: 'tt', text: s.t }),
        h('span', { class: 'co-min', text: fa(s.min) + ' دقیقه' })
      ]);
      row.addEventListener('click', function () { c.done[i] = c.done[i] || {}; c.done[i][k] = !c.done[i][k]; A.save(); render(true); });
      box.appendChild(row);
    });
    if (st.k === st.n) box.appendChild(h('div', { class: 'card co-win', text: 'امروز رو بردی 🔥 همین‌طور ادامه بده. فردا دوباره سر وقت بیا.' }));
    var act = h('div', { class: 'co-actions' });
    act.appendChild(h('button', { class: 'btn-ghost', text: c.pushed[i] ? 'توی تسک‌ها هست ✓' : 'بریز توی تسک‌ها', onclick: function () {
      if (c.pushed[i]) { A.toast('قبلاً اضافه شده'); return; }
      d.steps.forEach(function (s, k) { if (!isDone(i, k)) S.tasks.push({ id: A.uid(), text: s.t, done: false, p: 1, c: Date.now() }); });
      c.pushed[i] = true; A.save(); A.refreshTasks(); A.toast('قدم‌ها به تسک‌ها اضافه شد'); render(true);
    } }));
    act.appendChild(h('button', { class: 'btn-primary', text: 'گزارش به مربی', onclick: function () {
      var left = d.steps.filter(function (s, k) { return !isDone(i, k); }).map(function (s) { return s.t; });
      draft = 'گزارش امروز: ' + fa(st.k) + ' از ' + fa(st.n) + ' قدم رو انجام دادم.' + (left.length ? ' انجام ندادم: ' + left.join('، ') + '.' : '') + ' نظرت چیه؟';
      c.tab = 'chat'; A.save(); render();
    } }));
    box.appendChild(act);
    if (!c.dmap[i + 2]) box.appendChild(h('button', { class: 'btn-ghost co-wide', text: 'ساخت قدم‌های روزهای بعد', onclick: function () { genDays(Math.max(i + 1, maxDay() + 1)); } }));
    return box;
  }
  function maxDay() { var m = -1; for (var k in C().dmap) if (+k > m) m = +k; return m; }

  /* ---------- plan view ---------- */
  function planView() {
    var c = C(), box = h('div');
    if (gen) return loader();
    if (!c.plan) { box.appendChild(h('div', { class: 'card co-intro' }, [h('div', { class: 'co-big', text: '🗺️' }), h('div', { class: 'co-qt', text: 'نقشه‌ای نیست' }),
      h('p', { class: 'co-p', text: 'با آزمون شروع کن تا نقشه‌ی راهت ساخته بشه.' }),
      h('button', { class: 'btn-primary', text: c.profile ? 'ساختن نقشه' : 'شروع آزمون', onclick: function () { if (c.profile) genPlan(); else { c.tab = 'quiz'; A.save(); render(); } } })])); return box; }
    var p = c.plan, cur = Math.floor(dayIdx() / 7);
    box.appendChild(h('div', { class: 'card quote-card' }, [h('div', { class: 'co-hint', text: 'چشم‌انداز' }), h('div', { class: 'co-vision', text: p.vision })]));
    box.appendChild(h('div', { class: 'sec-title', text: 'ماه‌ها' }));
    p.months.forEach(function (m, i) {
      box.appendChild(h('div', { class: 'card co-month' }, [h('div', { class: 'co-qt', text: (m.title || ('ماه ' + fa(i + 1))) }), h('div', { class: 'co-row', text: m.goal }), h('div', { class: 'co-kpi', text: '🎯 ' + m.kpi })]));
    });
    box.appendChild(h('div', { class: 'sec-title', text: 'هفته‌ها' }));
    p.weeks.forEach(function (w, i) {
      box.appendChild(h('div', { class: 'card co-week' + (i === cur ? ' now' : '') }, [h('div', { class: 'co-wn', text: fa(w.n) }), h('div', { class: 'grow' }, [h('div', { class: 'co-wf', text: w.focus }), h('div', { class: 'co-hint', text: '✔ ' + w.deliverable })])]));
    });
    if (p.rules && p.rules.length) {
      box.appendChild(h('div', { class: 'sec-title', text: 'قانون‌های غیرقابل‌مذاکره‌ی هر روز' }));
      var rc = h('div', { class: 'card' }); p.rules.forEach(function (r) { rc.appendChild(h('div', { class: 'co-rule', text: '• ' + r })); }); box.appendChild(rc);
    }
    box.appendChild(h('button', { class: 'btn-ghost co-wide', text: 'بازسازی نقشه', onclick: genPlan }));
    return box;
  }

  /* ---------- chat ---------- */
  var QUICK = {
    goggins: ['امروز دقیقاً چی کار کنم؟', 'حوصله ندارم، هلم بده', 'استمرارم رو چطور حفظ کنم؟', 'یه چالش برای امروز بده'],
    money: ['چطور اولین مشتری بگیرم؟', 'قیمت خدماتم رو چطور تعیین کنم؟', 'یه ایده‌ی درآمد برام بچین', 'چطور محتوا بفروشم؟']
  };
  var HELLO = {
    goggins: 'اینجام. بهونه‌هات رو بذار کنار و بگو چی توی ذهنته. هر سؤالی داری بپرس، هر چیزی که جلوت رو گرفته بگو. اگه هنوز آزمون هدف‌یابی ندادی، از تب «آزمون» شروع کن.',
    money: 'پول از ارزش میاد، نه از آرزو. بگو چی می‌فروشی، به کی، و چقدر. هر سؤالی درباره‌ی کسب‌وکار، فروش و درآمد داری بپرس. اگه هنوز آزمون ندادی، اول اونو بزن تا دقیق‌تر کمکت کنم.'
  };
  function chatView() {
    var c = C(), box = h('div', { class: 'co-chat' }), hist = c.chat[c.mode];
    box.appendChild(h('div', { class: 'seg' }, [
      h('button', { class: c.mode === 'goggins' ? 'on' : '', text: '🔥 استمرار و رشد', onclick: function () { c.mode = 'goggins'; A.save(); render(); } }),
      h('button', { class: c.mode === 'money' ? 'on' : '', text: '💰 پول و بیزینس', onclick: function () { c.mode = 'money'; A.save(); render(); } })
    ]));
    if (c.mode === 'money') box.appendChild(h('div', { class: 'co-hint co-center', text: 'آموزش عمومی است، توصیه‌ی مالی یا قول درآمد نیست.' }));
    var list = h('div', { class: 'co-msgs', id: 'co-msgs' });
    list.appendChild(h('div', { class: 'co-b ai', text: HELLO[c.mode] }));
    hist.forEach(function (m) { list.appendChild(h('div', { class: 'co-b ' + (m.role === 'user' ? 'me' : 'ai'), text: m.content })); });
    if (chatBusy) list.appendChild(h('div', { class: 'co-b ai co-typing' }, [h('i'), h('i'), h('i')]));
    if (chatErr) list.appendChild(h('div', { class: 'co-b err' }, [chatErr + ' ', h('button', { class: 'co-retry', text: 'تلاش دوباره', onclick: function () { chatErr = null; doRequest(); } })]));
    box.appendChild(list);
    if (!hist.length && !chatBusy) {
      var q = h('div', { class: 'co-chips' });
      QUICK[c.mode].forEach(function (t) { q.appendChild(h('button', { text: t, onclick: function () { send(t); } })); });
      box.appendChild(q);
    }
    var ta = h('textarea', { class: 'input co-in', rows: '1', placeholder: 'بنویس…', maxlength: '1500' });
    ta.value = draft;
    ta.addEventListener('input', function () { draft = ta.value; ta.style.height = 'auto'; ta.style.height = Math.min(120, ta.scrollHeight) + 'px'; });
    box.appendChild(h('div', { class: 'co-composer' }, [ta, h('button', { class: 'co-send', 'aria-label': 'ارسال', text: '➤', onclick: function () { send(ta.value); } })]));
    return box;
  }
  function send(text) {
    var c = C(); text = (text || '').trim(); if (!text || chatBusy) return;
    var hist = c.chat[c.mode]; hist.push({ role: 'user', content: text.slice(0, 1500) });
    if (hist.length > 40) hist.splice(0, hist.length - 40);
    draft = ''; chatErr = null; A.save(); doRequest();
  }
  function doRequest() {
    var c = C(), mode = c.mode, hist = c.chat[mode]; chatBusy = true; render(true);
    api('/chat', { mode: mode, profile: c.profile || null, context: chatCtx(), messages: hist.slice(-12) }, 80000).then(function (r) {
      hist.push({ role: 'assistant', content: r.reply || '…' }); if (hist.length > 40) hist.splice(0, hist.length - 40); A.save();
    }).catch(function (e) { chatErr = errText(e); }).then(function () { chatBusy = false; render(true); });
  }

  /* ---------- settings ---------- */
  function setView() {
    var c = C(), box = h('div');
    var inp = h('input', { class: 'input', dir: 'ltr', placeholder: 'https://ae-coach.xxxx.workers.dev' });
    inp.value = c.url || CFG.AI_URL || '';
    var out = h('div', { class: 'co-hint', text: base() ? 'آدرس فعلی: ' + base() : 'هنوز آدرسی تنظیم نشده.' });
    box.appendChild(h('div', { class: 'card' }, [
      h('div', { class: 'co-qt', text: 'اتصال به سرور مربی' }),
      h('p', { class: 'co-p', text: 'معمولاً خودکار تنظیم می‌شه. فقط اگه سرور رو جدا ساختی آدرسش رو اینجا بذار.' }),
      inp, out,
      h('div', { class: 'co-actions' }, [
        h('button', { class: 'btn-ghost', text: 'ذخیره', onclick: function () { c.url = inp.value.trim(); A.save(); A.toast('ذخیره شد'); out.textContent = base() ? 'آدرس فعلی: ' + base() : 'آدرس خالیه'; } }),
        h('button', { class: 'btn-primary', text: 'تست اتصال', onclick: function () {
          var u = (inp.value.trim() || base()).replace(/\/+$/, ''); if (!u) { out.textContent = 'اول آدرس بده'; return; }
          out.textContent = 'در حال تست…';
          fetch(u + '/').then(function (r) { return r.json(); }).then(function (j) { out.textContent = j && j.ok ? '✅ وصله' : '❌ جواب عجیب بود'; }).catch(function () { out.textContent = '❌ وصل نشد (اینترنت یا فیلترشکن رو چک کن)'; });
        } })
      ])
    ]));
    var sel = h('select', { class: 'input' }, [
      h('option', { value: '', text: 'خودکار (Gemma — سریع و کم‌مصرف)' }),
      h('option', { value: 'llama', text: 'Llama 70B — قوی‌تر، سهمیه‌ی بیشتری مصرف می‌کنه' }),
      h('option', { value: 'glm', text: 'GLM Flash' })
    ]);
    sel.value = c.model || '';
    sel.addEventListener('change', function () { c.model = sel.value; A.save(); A.toast(c.model ? 'مدل عوض شد' : 'مدل خودکار شد'); });
    box.appendChild(h('div', { class: 'card' }, [
      h('div', { class: 'co-qt', text: 'مدل هوش مصنوعی' }),
      h('p', { class: 'co-p', text: 'اگه جواب‌ها ضعیف بود مدل رو عوض کن و دوباره امتحان کن. اگه مدل انتخابی خطا بده، خودکار می‌ره سراغ بعدی.' }),
      sel
    ]));
    box.appendChild(h('button', { class: 'btn-ghost co-wide co-danger', text: 'پاک کردن همه‌ی اطلاعات مربی (پرونده، نقشه، چت)', onclick: function () {
      if (!confirm('همه‌ی اطلاعات مربی پاک بشه؟ یادداشت‌ها و تسک‌هات سر جاشون می‌مونن.')) return;
      var url = c.url, mdl = c.model; S.coach = { url: url, model: mdl }; chatErr = null; draft = ''; A.save(); render(); A.toast('پاک شد');
    } }));
    return box;
  }

  /* ---------- shell ---------- */
  var TABS = [['chat', 'چت'], ['today', 'امروز'], ['plan', 'نقشه'], ['quiz', 'آزمون']];
  function render(keepScroll) {
    if (!root) return;
    var c = C(), top = view.scrollTop;
    view.classList.toggle('chat-on', c.tab !== 'today' && c.tab !== 'plan' && c.tab !== 'quiz' && c.tab !== 'set');
    var kids = [];
    kids.push(h('header', { class: 'top' }, [
      h('button', { class: 'icon-btn' + (c.tab === 'set' ? ' on' : ''), 'aria-label': 'تنظیمات', text: '⚙️', onclick: function () { c.tab = c.tab === 'set' ? 'chat' : 'set'; A.save(); render(); } }),
      h('h1', { text: 'مربی هوشمند' })
    ]));
    if (!gen && !c.quizOn) {
      var seg = h('div', { class: 'seg co-tabs' });
      TABS.forEach(function (t) { seg.appendChild(h('button', { class: c.tab === t[0] ? 'on' : '', text: t[1], onclick: function () { c.tab = t[0]; A.save(); render(); } })); });
      kids.push(seg);
    }
    var body = c.tab === 'today' ? todayView() : c.tab === 'plan' ? planView() : c.tab === 'quiz' ? quizView() : c.tab === 'set' ? setView() : chatView();
    kids.push(body);
    root.innerHTML = ''; kids.forEach(function (k) { root.appendChild(k); });
    if (c.tab === 'chat') view.scrollTop = view.scrollHeight;
    else view.scrollTop = keepScroll ? top : 0;
  }
  window.AECoach = { render: render };
})();

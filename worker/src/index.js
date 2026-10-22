// AE Coach — Cloudflare Worker using Workers AI (free tier: 10,000 Neurons/day).
// Routes (POST, JSON): /chat  /plan  /days  /register  /login  /me  /logout (needs D1 binding DB)      GET /  -> health

const MODELS = [
  { key: 'gemma', id: '@cf/google/gemma-4-26b-a4b-it', lenParam: 'max_completion_tokens', think: true },
  { key: 'llama', id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', lenParam: 'max_tokens', think: false },
  { key: 'glm', id: '@cf/zai-org/glm-4.7-flash', lenParam: 'max_tokens', think: true },
];
const ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost']);
const MAX_BODY = 60000;

/* ---------------- persona prompts ---------------- */
const BASE = `You are "AE Coach", a personal-development coach inside the AE app.
LANGUAGE: Always answer in natural, casual spoken Persian (Farsi, محاوره‌ای), written in Persian script, like a straight-talking friend. Use English only for the phrase "Stay hard" or if the user writes in English.
FACTS: Only state what you actually know. Never invent facts, numbers, names, prices, laws, sources or quotes. If you are not sure, or the answer needs live data (prices, news, results), say so in a few words ("مطمئن نیستم") and give the best practical advice you can instead. The exact current date and time are given under CURRENT TIME at the end of this prompt: for any question about today, the weekday, the date or the time, use ONLY that and never guess.
You can answer ANY question the user asks (business, skills, habits, health basics, study, general knowledge), always in your persona's voice, accurate and practical first, motivational second.
SAFETY: If the user shows signs of despair, self-harm, abuse, an eating disorder, or a medical emergency, drop the tough tone completely, be calm and warm, take it seriously, and encourage them to reach a trusted person, a professional, or emergency services. Never give dangerous physical advice: build up gradually and see a doctor for pain, injury or medical conditions.
You are an AI in the spirit of the persona below. Never claim to be the real person, never invent quotes or personal stories of real people.`;

const CHAT_STYLE = `LENGTH (strict): reply in 2 to 4 short sentences, about 30 to 70 words in total. No headings, no bullet lists, no emojis, no long explanations, no multiple options. Give your single best answer, then ONE concrete action for today or ONE sharp question. Only when the user explicitly asks for details, a plan, steps or a list may you go longer (up to about 150 words).
Style examples (tone and length only, do not copy them):
User: امروز حس هیچ کاری ندارم.
Coach: حسش رو ولش کن، حس قرار نیست کار کنه. فقط ۱۰ دقیقه اولین کار لیستت رو شروع کن. بعد ۱۰ دقیقه ببین هنوز می‌خوای ولش کنی یا نه.
User: قیمت دلار الان چنده؟
Coach: قیمت لحظه‌ای رو ندارم و حدس هم نمی‌زنم. از یه منبع معتبر نگاه کن. بگو برای چه تصمیمی می‌خوای؟ بر اساس اون کمکت می‌کنم.`;

const PERSONAS = {
  goggins: `PERSONA "Stay Hard" (inspired by the no-excuses, extreme-discipline mindset of David Goggins): intense, raw, direct. Tough love: attack the excuse, never the person's worth. Push them to do the uncomfortable thing today, to callous the mind, to win the boring hours nobody sees. Consistency, discipline, accountability and mental toughness are your themes. Use "Stay hard" rarely and only when it lands.`,
  money: `PERSONA "Money Mindset" (a blunt, ambitious, business-first coach): confident and urgent, obsessed with value, offers, sales, leverage, skills, reputation, discipline with spending and compounding consistency. Challenge laziness and small thinking, and turn every idea into: who pays, for what, how do I reach them, what do I do today. HARD RULES: no misogyny and no contempt for any group of people; no scams, MLM, get-rich-quick, signals, pump-and-dump or anything illegal; never promise income; give only general education, not personal investment advice, and state real risks plainly.`,
};

/* ---------------- helpers ---------------- */
function cors(req) {
  const o = req.headers.get('Origin');
  const h = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, x-ae-key',
    'Access-Control-Max-Age': '86400',
  };
  if (o && ORIGINS.has(o)) h['Access-Control-Allow-Origin'] = o;
  return h;
}
function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const xa = new Uint8Array(x), ya = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < xa.length; i++) d |= xa[i] ^ ya[i];
  return d === 0;
}
const str = (v, n) => (typeof v === 'string' ? v : v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().slice(0, n || 300);
class BadInput extends Error { constructor(m) { super(m || 'bad_input'); this.code = 'bad_input'; } }

function cleanProfile(p) {
  p = p && typeof p === 'object' ? p : {};
  return {
    name: str(p.name, 40), goal: str(p.goal, 300), area: str(p.area, 60), why: str(p.why, 300),
    level: str(p.level, 80), hours: Math.min(12, Math.max(0.25, Number(p.hours) || 1)),
    deadline: str(p.deadline, 40),
    blockers: (Array.isArray(p.blockers) ? p.blockers : []).slice(0, 8).map((x) => str(x, 60)),
    wake: str(p.wake, 60), quit: str(p.quit, 300), assets: str(p.assets, 300),
    scores: {
      consistency: Math.min(5, Math.max(1, Number(p.scores && p.scores.consistency) || 3)),
      focus: Math.min(5, Math.max(1, Number(p.scores && p.scores.focus) || 3)),
      energy: Math.min(5, Math.max(1, Number(p.scores && p.scores.energy) || 3)),
    },
  };
}
function profileText(p) {
  return [
    `Name: ${p.name || '-'}`, `Main goal: ${p.goal || '-'}`, `Area: ${p.area || '-'}`, `Real reason: ${p.why || '-'}`,
    `Current level: ${p.level || '-'}`, `Hours per day available: ${p.hours}`, `Target for first result: ${p.deadline || '-'}`,
    `Usual blockers: ${p.blockers.join(', ') || '-'}`, `Wake-up time: ${p.wake || '-'}`,
    `Last thing they quit and why: ${p.quit || '-'}`, `Assets they already have: ${p.assets || '-'}`,
    `Self scores (1-5): consistency ${p.scores.consistency}, focus ${p.scores.focus}, energy ${p.scores.energy}`,
  ].join('\n');
}

// Exact date/time from the server clock in the user's timezone, so the model never has to guess the weekday.
function nowInfo(tzIn) {
  let tz = 'Asia/Tehran';
  try { if (tzIn) { new Intl.DateTimeFormat('en', { timeZone: String(tzIn) }); tz = String(tzIn); } } catch (_) { /* keep default */ }
  const d = new Date();
  const f = (loc, o) => new Intl.DateTimeFormat(loc, { timeZone: tz, ...o }).format(d);
  return `${f('fa-IR', { weekday: 'long' })} (${f('en-US', { weekday: 'long' })}), ${f('fa-IR-u-ca-persian', { day: 'numeric', month: 'long', year: 'numeric' })} (Gregorian ${f('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })}), ساعت ${f('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false })}, timezone ${tz}`;
}
const wantsDetail = (t) => /(مفصل|با جزئیات|کامل‌تر|کاملتر|توضیح بیشتر|توضیح بده|لیست|مرحله ?به ?مرحله|برنامه (بده|بریز|بنویس)|detail|step by step|plan)/i.test(String(t || ''));
// If the reply was cut by the token limit, end it at the last full sentence instead of mid-word.
function tidy(t) {
  t = String(t || '').trim();
  if (/[.!?؟…:)»"]$/.test(t)) return t;
  const i = Math.max(t.lastIndexOf('. '), t.lastIndexOf('؟'), t.lastIndexOf('!'), t.lastIndexOf('.\n'), t.lastIndexOf('؛'));
  return i > t.length * 0.4 ? t.slice(0, i + 1).trim() : t;
}

function extractText(out) {
  if (!out) return '';
  if (typeof out === 'string') return out.trim();
  const c = out.choices && out.choices[0] && out.choices[0].message;
  if (c && typeof c.content === 'string' && c.content.trim()) return c.content.trim();
  if (c && Array.isArray(c.content)) return c.content.map((x) => (x && x.text) || '').join('').trim();
  if (typeof out.response === 'string') return out.response.trim();
  if (out.result && typeof out.result.response === 'string') return out.result.response.trim();
  return '';
}
const isLimit = (e) => /(limit|quota|4006|3040|capacity|too many)/i.test(String((e && e.message) || e));
const isDailyQuota = (e) => /(4006|daily|allocation|quota)/i.test(String((e && e.message) || e));

const orderFor = (pref) => { const p = MODELS.find((m) => m.key === pref); return p ? [p, ...MODELS.filter((m) => m !== p)] : MODELS; };
async function runAI(env, messages, maxTokens, temperature, pref) {
  let last;
  for (const m of orderFor(pref)) {
    try {
      // enable_thinking:false -> no hidden reasoning tokens (faster, cheaper, fits the free daily quota)
      const input = { messages, [m.lenParam]: maxTokens, temperature: temperature ?? 0.7 };
      if (m.think) input.chat_template_kwargs = { enable_thinking: false };
      const out = await env.AI.run(m.id, input);
      const text = extractText(out).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (text) return text;
      last = new Error('empty');
    } catch (e) {
      last = e;
      // Only the daily free allocation (4006) ends the attempt; a busy/out-of-capacity model (3040) falls through to the next model.
      if (isDailyQuota(e)) throw e;
    }
  }
  throw last || new Error('ai');
}

function parseJSON(text) {
  let t = String(text || '').replace(/```(?:json)?/gi, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('no_json');
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (_) {
    // light repair: trailing commas
    return JSON.parse(t.replace(/,\s*([}\]])/g, '$1'));
  }
}
async function runJSON(env, system, user, maxTokens, normalize, pref) {
  let hint = '';
  for (let i = 0; i < 2; i++) {
    try {
      const text = await runAI(env, [{ role: 'system', content: system }, { role: 'user', content: user + hint }], maxTokens, 0.6, pref);
      return normalize(parseJSON(text));
    } catch (e) {
      if (isLimit(e)) throw e;
      hint = '\n\nIMPORTANT: your previous answer was not valid JSON in the required shape. Reply with ONLY the JSON object, nothing else.';
      if (i === 1) throw e;
    }
  }
}

/* ---------------- chat ---------------- */
async function chat(env, body) {
  const persona = body.mode === 'money' ? 'money' : 'goggins';
  const msgs = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-14).map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') throw new BadInput();

  let ctx = '';
  if (body.profile) ctx += `\nWHAT YOU KNOW ABOUT THE USER (from their intake quiz):\n${profileText(cleanProfile(body.profile))}\n`;
  const c = body.context && typeof body.context === 'object' ? body.context : {};
  if (c.vision) ctx += `\nTheir roadmap vision: ${str(c.vision, 300)}`;
  if (c.weekFocus) ctx += `\nThis week's focus: ${str(c.weekFocus, 200)}`;
  if (Array.isArray(c.today) && c.today.length) {
    ctx += `\nToday's planned steps (day ${Number(c.dayNumber) || '?'}): ` +
      c.today.slice(0, 8).map((s) => `${s && s.done ? '[done]' : '[not done]'} ${str(s && s.t, 120)}`).join(' | ');
  }
  ctx += `\n\nCURRENT TIME (authoritative): ${nowInfo(c.tz)}`;
  const system = `${BASE}\n\n${CHAT_STYLE}\n\n${PERSONAS[persona]}${ctx}`;
  const long = wantsDetail(msgs[msgs.length - 1].content);
  const reply = await runAI(env, [{ role: 'system', content: system }, ...msgs], long ? 700 : 300, 0.6, body.model);
  return { reply: tidy(reply).slice(0, 4000) };
}

/* ---------------- plan ---------------- */
function normalizePlan(o) {
  const arr = (v, n) => (Array.isArray(v) ? v.slice(0, n) : []);
  const plan = {
    vision: str(o.vision, 400),
    months: arr(o.months, 4).map((m) => ({ title: str(m && m.title, 80), goal: str(m && m.goal, 240), kpi: str(m && m.kpi, 160) })).filter((m) => m.title || m.goal),
    weeks: arr(o.weeks, 16).map((w, i) => ({ n: Number(w && w.n) || i + 1, focus: str(w && w.focus, 200), deliverable: str(w && w.deliverable, 200) })).filter((w) => w.focus),
    rules: arr(o.rules, 6).map((r) => str(r, 160)).filter(Boolean),
  };
  if (!plan.vision || !plan.months.length || !plan.weeks.length) throw new Error('bad_plan');
  return plan;
}
async function plan(env, body) {
  const p = cleanProfile(body.profile);
  if (!p.goal) throw new BadInput();
  const system = `${BASE}\n\nYou are now a planner. ${PERSONAS.goggins}\nYou design realistic, specific roadmaps from big picture down to small steps.`;
  const user = `USER PROFILE:\n${profileText(p)}\n
Create a roadmap for this user's main goal, from big picture to detail. Be specific to THEIR goal and level (no generic advice), respect the hours per day they have, and plan around their blockers and wake-up time.
Return ONLY valid JSON (no markdown, no comments) in exactly this shape:
{"vision":"1-2 sentences: what success looks like at the target date",
"months":[{"title":"short title","goal":"what must be true at the end of this month","kpi":"one measurable number or deliverable"}],
"weeks":[{"n":1,"focus":"main focus of the week","deliverable":"what is finished by the end of the week"}],
"rules":["3 to 5 daily non-negotiable habits"]}
Give 3 months and 12 weeks (week n=1..12). Every text value must be in casual Persian.`;
  return runJSON(env, system, user, 3500, normalizePlan, body.model);
}

/* ---------------- days ---------------- */
function normalizeDays(from, minutesBudget) {
  return (o) => {
    const days = (Array.isArray(o.days) ? o.days : []).slice(0, 7).map((d, i) => ({
      n: from + i + 1,
      theme: str(d && d.theme, 100),
      steps: (Array.isArray(d && d.steps) ? d.steps : []).slice(0, 6).map((s) => ({
        t: str(s && (s.t || s.text || s.step), 200),
        min: Math.min(minutesBudget, Math.max(5, Math.round(Number(s && s.min) || 30))),
      })).filter((s) => s.t),
    })).filter((d) => d.steps.length);
    if (!days.length) throw new Error('bad_days');
    return days;
  };
}
async function days(env, body) {
  const p = cleanProfile(body.profile);
  const from = Math.max(0, Math.min(400, parseInt(body.from_day, 10) || 0));
  const pl = body.plan && typeof body.plan === 'object' ? body.plan : {};
  const weeks = (Array.isArray(pl.weeks) ? pl.weeks : []).slice(0, 16);
  const w1 = weeks[Math.floor(from / 7)] || weeks[weeks.length - 1] || {};
  const budget = Math.round(p.hours * 60);
  const system = `${BASE}\n\nYou are now a daily-execution planner. ${PERSONAS.goggins}`;
  const user = `USER PROFILE:\n${profileText(p)}\n
ROADMAP VISION: ${str(pl.vision, 300)}
THIS WEEK'S FOCUS: ${str(w1.focus, 200)} (deliverable: ${str(w1.deliverable, 200)})
PROGRESS SO FAR: ${str(body.history, 300) || 'just starting'}
Write the daily action steps for 7 days, starting at day ${from + 1}.
Rules: 3 to 5 concrete steps per day, each starts with a verb and is small enough to finish in one sitting; step minutes must add up to at most ${budget} minutes per day; day ${from + 1} must be easy to start so momentum builds; every day ends with one visible output (something made, sent, posted, or published); if progress shows missed steps, lower the load slightly and name the excuse bluntly but respectfully.
Return ONLY valid JSON (no markdown) in exactly this shape:
{"days":[{"theme":"short theme of the day","steps":[{"t":"the step","min":30}]}]}
All text must be casual Persian.`;
  return { days: await runJSON(env, system, user, 3500, normalizeDays(from, budget), body.model) };
}

/* ---------------- accounts (D1: users, sessions) ---------------- */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const unhex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
const faDigits = (t) => String(t || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
async function hashPw(pw, saltBytes) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 100000 }, key, 256));
}
const sha = async (t) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)));
const bad = (code) => { const e = new Error(code); e.code = 'auth_' + code; return e; };
function cleanPhone(p) {
  let t = faDigits(p).replace(/[\s\-()]/g, '');
  if (t.startsWith('+98')) t = '0' + t.slice(3); else if (t.startsWith('0098')) t = '0' + t.slice(4); else if (/^9\d{9}$/.test(t)) t = '0' + t;
  return /^09\d{9}$/.test(t) ? t : '';
}
const cleanUser = (u) => String(u || '').trim().toLowerCase();
async function newSession(env, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const exp = Date.now() + 90 * 86400000;
  await env.DB.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await sha(token), userId, exp).run();
  await env.DB.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()).run();
  return token;
}

/* ---------------- SMS verification (Melipayamak pattern/template) ---------------- */
// Secrets: MELI_USER, MELI_PASS, MELI_BODY_ID (template id with ONE variable {0} = the code). If any is missing, registration works without SMS.
const smsOn = (env) => !!(env.MELI_USER && env.MELI_PASS && env.MELI_BODY_ID);
const OTP_TTL = 3 * 60000, OTP_GAP = 60000, OTP_HOUR_MAX = 5, OTP_TRIES = 5;
async function sendSms(env, phone, code) {
  const r = await fetch('https://rest.payamak-panel.com/api/SendSMS/BaseServiceNumber', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: String(env.MELI_USER), password: String(env.MELI_PASS), text: String(code), to: phone, bodyId: String(env.MELI_BODY_ID) }),
  });
  let j = {};
  try { j = await r.json(); } catch (_) {}
  if (!r.ok || Number(j.RetStatus) !== 1) {
    console.error(JSON.stringify({ sms: 'fail', http: r.status, ret: j.RetStatus, msg: String(j.StrRetStatus || '').slice(0, 60) }));
    throw bad('sms_failed');
  }
}
async function otpSend(env, b) {
  const phone = cleanPhone(b.phone);
  if (!phone) throw bad('phone');
  if (!smsOn(env)) return { skip: true };
  if (await env.DB.prepare('SELECT 1 FROM users WHERE phone=?').bind(phone).first()) throw bad('phone_taken');
  const now = Date.now();
  const row = await env.DB.prepare('SELECT * FROM otp WHERE phone=?').bind(phone).first();
  let winStart = now, winCount = 0;
  if (row) {
    if (now - row.last_sent < OTP_GAP) throw bad('too_soon');
    if (now - row.win_start < 3600000) { winStart = row.win_start; winCount = row.win_count; }
    if (winCount >= OTP_HOUR_MAX) throw bad('too_many');
  }
  const code = String(10000 + (crypto.getRandomValues(new Uint32Array(1))[0] % 90000));
  await env.DB.prepare('INSERT INTO otp (phone,code_hash,expires_at,tries,last_sent,win_start,win_count) VALUES (?,?,?,?,?,?,?) ON CONFLICT(phone) DO UPDATE SET code_hash=excluded.code_hash, expires_at=excluded.expires_at, tries=0, last_sent=excluded.last_sent, win_start=excluded.win_start, win_count=excluded.win_count')
    .bind(phone, await sha(phone + ':' + code), now + OTP_TTL, 0, now, winStart, winCount + 1).run();
  await sendSms(env, phone, code);
  return { sent: true, ttl: OTP_TTL / 1000, gap: OTP_GAP / 1000 };
}
async function otpCheck(env, phone, codeIn) {
  const code = faDigits(codeIn).replace(/\D/g, '');
  const row = await env.DB.prepare('SELECT * FROM otp WHERE phone=?').bind(phone).first();
  if (!row || row.expires_at < Date.now()) throw bad('otp_expired');
  if (row.tries >= OTP_TRIES) throw bad('otp_locked');
  if ((await sha(phone + ':' + code)) !== row.code_hash) {
    await env.DB.prepare('UPDATE otp SET tries=tries+1 WHERE phone=?').bind(phone).run();
    throw bad('otp_wrong');
  }
  await env.DB.prepare('DELETE FROM otp WHERE phone=?').bind(phone).run();
}
async function register(env, b) {
  const name = String(b.name || '').trim().slice(0, 24), phone = cleanPhone(b.phone), pw = String(b.password || ''), username = phone; // no separate username: the phone number is the login id
  if (!name) throw bad('name');
  if (!phone) throw bad('phone');
  if (pw.length < 6 || pw.length > 100) throw bad('password');
  if (smsOn(env)) await otpCheck(env, phone, b.otp);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const h = await hashPw(pw, salt);
  try {
    const r = await env.DB.prepare('INSERT INTO users (username,name,phone,pw_hash,salt,created_at) VALUES (?,?,?,?,?,?)').bind(username, name, phone, h, hex(salt), Date.now()).run();
    const id = r.meta.last_row_id;
    return { token: await newSession(env, id), user: { name, phone } };
  } catch (e) {
    if (/UNIQUE/i.test(String(e && e.message))) throw bad('phone_taken');
    throw e;
  }
}
async function login(env, b) {
  const phone = cleanPhone(b.phone), pw = String(b.password || '');
  const u = phone ? await env.DB.prepare('SELECT * FROM users WHERE phone=?').bind(phone).first() : null;
  if (!u) { await hashPw(pw, new Uint8Array(16)); throw bad('credentials'); }
  if (u.locked_until > Date.now()) throw bad('locked');
  const ok = (await hashPw(pw, unhex(u.salt))) === u.pw_hash;
  if (!ok) {
    const fails = u.fails + 1;
    await env.DB.prepare('UPDATE users SET fails=?, locked_until=? WHERE id=?').bind(fails >= 5 ? 0 : fails, fails >= 5 ? Date.now() + 10 * 60000 : 0, u.id).run();
    throw bad(fails >= 5 ? 'locked' : 'credentials');
  }
  await env.DB.prepare('UPDATE users SET fails=0, locked_until=0 WHERE id=?').bind(u.id).run();
  return { token: await newSession(env, u.id), user: { name: u.name, phone: u.phone } };
}
async function me(env, b) {
  const t = String(b.token || '');
  if (!/^[0-9a-f]{64}$/.test(t)) throw bad('session');
  const u = await env.DB.prepare('SELECT u.name,u.phone FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await sha(t), Date.now()).first();
  if (!u) throw bad('session');
  return { user: u };
}
async function logout(env, b) {
  const t = String(b.token || '');
  if (/^[0-9a-f]{64}$/.test(t)) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(t)).run();
  return { ok: true };
}

/* ---------------- entry ---------------- */
export default {
  async fetch(request, env) {
    const cx = cors(request);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cx });
    const url = new URL(request.url);
    if (request.method === 'GET') return json({ ok: true, name: 'ae-coach' }, 200, cx);
    if (request.method !== 'POST') return json({ error: 'method' }, 405, cx);

    if (env.APP_KEY) {
      const k = request.headers.get('x-ae-key') || '';
      if (!(await safeEqual(k, String(env.APP_KEY)))) return json({ error: 'auth' }, 401, cx);
    }
    let body;
    try {
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ error: 'too_big' }, 413, cx);
      body = JSON.parse(raw);
    } catch (_) { return json({ error: 'json' }, 400, cx); }
    if (!body || typeof body !== 'object') return json({ error: 'json' }, 400, cx);

    try {
      if (['/register', '/login', '/me', '/logout', '/otp'].includes(url.pathname)) {
        if (!env.DB) return json({ error: 'no_db' }, 503, cx);
        const fn = { '/register': register, '/login': login, '/me': me, '/logout': logout, '/otp': otpSend }[url.pathname];
        return json(await fn(env, body), 200, cx);
      }
      if (url.pathname === '/chat') return json(await chat(env, body), 200, cx);
      if (url.pathname === '/plan') return json({ plan: await plan(env, body) }, 200, cx);
      if (url.pathname === '/days') return json(await days(env, body), 200, cx);
      return json({ error: 'not_found' }, 404, cx);
    } catch (e) {
      console.error(JSON.stringify({ route: url.pathname, error: String((e && e.message) || e).slice(0, 200) }));
      if (e && String(e.code || '').startsWith('auth_')) return json({ error: e.code.slice(5) }, e.code === 'auth_session' || e.code === 'auth_credentials' ? 401 : ['auth_locked', 'auth_too_soon', 'auth_too_many', 'auth_otp_locked'].includes(e.code) ? 429 : e.code === 'auth_sms_failed' ? 502 : 400, cx);
      if (e && e.code === 'bad_input') return json({ error: 'bad_input' }, 400, cx);
      if (isLimit(e)) return json({ error: 'limit' }, 429, cx);
      return json({ error: 'ai' }, 502, cx);
    }
  },
};

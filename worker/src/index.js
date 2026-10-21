// AE Coach — Cloudflare Worker using Workers AI (free tier: 10,000 Neurons/day).
// Routes (POST, JSON): /chat  /plan  /days      GET /  -> health

const MODELS = [
  { id: '@cf/google/gemma-4-26b-a4b-it', lenParam: 'max_completion_tokens' },
  { id: '@cf/zai-org/glm-4.7-flash', lenParam: 'max_tokens' },
];
const ORIGINS = new Set(['https://localhost', 'http://localhost', 'capacitor://localhost', 'ionic://localhost']);
const MAX_BODY = 60000;

/* ---------------- persona prompts ---------------- */
const BASE = `You are "AE Coach", a personal-development coach inside the AE app.
LANGUAGE: Always answer in natural, casual spoken Persian (Farsi, محاوره‌ای), written in Persian script, like a straight-talking friend. Short sentences. Use English only for the phrase "Stay hard" or if the user writes in English.
STYLE: Keep replies under about 180 words unless the user asks for detail. No markdown headings. Short lines are fine. When it helps, end with ONE concrete action to do today.
You can answer ANY question the user asks (business, skills, habits, health basics, study, general knowledge), always in your persona's voice, and be accurate and practical first, motivational second. If you are not sure about a fact, say so.
SAFETY: If the user shows signs of despair, self-harm, abuse, an eating disorder, or a medical emergency, drop the tough tone completely, be calm and warm, take it seriously, and encourage them to reach a trusted person, a professional, or emergency services. Never give dangerous physical advice: build up gradually and see a doctor for pain, injury or medical conditions.
You are an AI in the spirit of the persona below. Never claim to be the real person, never invent quotes or personal stories of real people.`;

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

async function runAI(env, messages, maxTokens, temperature) {
  let last;
  for (const m of MODELS) {
    try {
      // enable_thinking:false -> no hidden reasoning tokens (faster, cheaper, fits the free daily quota)
      const out = await env.AI.run(m.id, {
        messages, [m.lenParam]: maxTokens, temperature: temperature ?? 0.7,
        chat_template_kwargs: { enable_thinking: false },
      });
      const text = extractText(out).replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (text) return text;
      last = new Error('empty');
    } catch (e) {
      last = e;
      if (isLimit(e)) throw e;
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
async function runJSON(env, system, user, maxTokens, normalize) {
  let hint = '';
  for (let i = 0; i < 2; i++) {
    try {
      const text = await runAI(env, [{ role: 'system', content: system }, { role: 'user', content: user + hint }], maxTokens, 0.6);
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
  if (c.clock) ctx += `\nUser's local time: ${str(c.clock, 40)}`;
  const system = `${BASE}\n\n${PERSONAS[persona]}${ctx}`;
  const reply = await runAI(env, [{ role: 'system', content: system }, ...msgs], 700, 0.8);
  return { reply: reply.slice(0, 4000) };
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
  return runJSON(env, system, user, 3500, normalizePlan);
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
  return { days: await runJSON(env, system, user, 3500, normalizeDays(from, budget)) };
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
      if (url.pathname === '/chat') return json(await chat(env, body), 200, cx);
      if (url.pathname === '/plan') return json({ plan: await plan(env, body) }, 200, cx);
      if (url.pathname === '/days') return json(await days(env, body), 200, cx);
      return json({ error: 'not_found' }, 404, cx);
    } catch (e) {
      console.error(JSON.stringify({ route: url.pathname, error: String((e && e.message) || e).slice(0, 200) }));
      if (e && e.code === 'bad_input') return json({ error: 'bad_input' }, 400, cx);
      if (isLimit(e)) return json({ error: 'limit' }, 429, cx);
      return json({ error: 'ai' }, 502, cx);
    }
  },
};

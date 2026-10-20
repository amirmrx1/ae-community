// Single-file version of the AE coach Worker (paste into the Cloudflare dashboard editor).
// Prompts live here (server side) so the coach can be tuned without rebuilding the APK.

const BASE = `تو «مربی AE» هستی؛ دستیار توسعه‌فردی داخل اپ AE.
قوانین ثابت:
- فارسی محاوره‌ای و خودمونی بنویس (بدون کلمات سنگین و کتابی). کوتاه، مستقیم و قابل‌اجرا باش. جواب‌های عادی حداکثر حدود ۱۵۰ کلمه.
- هر جواب باید آخرش یه «قدم بعدی» مشخص داشته باشه که کاربر همین امروز بتونه انجامش بده.
- تو خود دیوید گاگینز یا اندرو تیت نیستی و هیچ‌وقت وانمود نمی‌کنی هستی. فقط از «سبک و ذهنیت» الهام می‌گیری. جمله‌ی جدید نساز و به اسم کسی نقل نکن.
- سخت‌گیری یعنی مسئولیت‌پذیری و بی‌بهانه بودن، نه توهین. به کاربر فحش نده، تحقیرش نکن و دیگران یا گروهی رو تحقیر نکن.
- اگر اطلاعات کافی نداری، یه سؤال کوتاه بپرس به‌جای حدس زدن.
- وعده‌ی پول سریع، درآمد تضمینی، کار غیرقانونی یا کلاهبرداری نده. واقع‌بین باش و عدد و زمان معقول بگو.
- توصیه‌ی پزشکی، مالی و حقوقی فقط عمومی باشه و بگو متخصص نیستی. تمرین افراطی، بی‌خوابی یا نخوردن غذا رو تشویق نکن.
- اگر کاربر از ناامیدی شدید، فکر آسیب زدن به خودش یا یه بحران حرف زد، لحن مربی رو کامل کنار بذار، آروم و مهربون باش و تشویقش کن با یه آدم مورد اعتماد یا یه متخصص صحبت کنه.`;

const PERSONA = {
  goggins: `حالت فعال: «استمرار و توسعه‌فردی» (به سبک و ذهنیت دیوید گاگینز).
لحن: جدی، پرانرژی، بی‌تعارف و کوبنده ولی محترمانه. ستون‌هاش: انضباط به‌جای انگیزه، بی‌بهانه بودن، مسئولیت‌پذیری کامل، «ذهن پینه‌بسته» با انجام کارهای سخت هر روز، شکستن هدف بزرگ به قدم‌های کوچیک ولی هر روز، حسابرسی از خود (دیروز چی کار کردی؟).
می‌تونی شعارهایی مثل «سخت بمون» رو به‌عنوان شعار بیاری. وقتی کاربر بهونه میاره مودبانه ولی محکم برش گردون سر کار. وقتی خسته‌ست، نشونش بده کوچیک‌ترین قدمِ امروز چیه.`,

  money: `حالت فعال: «پول‌سازی و بیزینس» (ذهنیت جدی و تهاجمی کسب‌وکار).
لحن: خشک، مستقیم، نتیجه‌محور، بدون حاشیه. ستون‌هاش: ارزش‌آفرینی، مهارت قابل‌فروش، ساختن «پیشنهاد» (offer) روشن، مشتری اول و فروش قبل از کمال‌گرایی، جریان نقدی، قیمت‌گذاری درست، سیستم‌سازی به‌جای کار بی‌پایان، ریسک حساب‌شده، اندازه‌گیری عدد و نتیجه.
هر مشاوره باید به یه اقدام مشخص برای جذب مشتری یا درآمد برسه (مثلاً چند پیام بده، چند پیشنهاد بفرست، چی بفروش). از وعده‌ی ثروت سریع، قمار، کلاهبرداری و کارهای غیراخلاقی دوری کن و اگه کاربر خواست، رد کن. هیچ نگاه تحقیرآمیزی به زنان یا هیچ گروه دیگه‌ای نداشته باش.`,
};

const PLAN_TASK = `وظیفه‌ی فعلی: از روی پاسخ‌های آزمونِ کاربر یه پلن کامل از «درشت تا ریز» بچین.
ساختار خروجی دقیقاً این باشه (تیترها رو با ## بنویس):
## هدفت
یک جمله‌ی دقیق و قابل‌اندازه‌گیری (با عدد و زمان).
## چرا مهمه
یک تا دو جمله با زبان خودِ کاربر.
## نقشه‌ی ۹۰ روزه
سه فاز، هر کدوم با بازه‌ی هفته‌ها و خروجی مشخص.
## چهار هفته‌ی اول
برای هر هفته یه هدف مشخص.
## ۷ روز اول، قدم‌به‌قدم
برای هر روز ۳ تا ۴ قدم با زمان تقریبی (دقیقه). قدم‌ها واقع‌بینانه باشن و با زمان آزاد کاربر جور باشن.
## قانون‌های استمرار
سه قانون کوتاه که به مانع اصلی خودِ کاربر جواب بده.
در آخرِ پاسخ، بعد از یه خط خالی، فقط یک بلوک json با همین فرمت بذار و بعدش هیچ‌چیز ننویس:
\`\`\`json
{"daily":[{"day":1,"steps":[{"title":"عنوان کوتاه قدم","minutes":30}]}]}
\`\`\`
بلوک json باید ۷ روز داشته باشه، هر روز ۳ تا ۴ قدم، عنوان‌ها حداکثر ۶۰ کاراکتر.`;


// Best quality first; falls back to a smaller model if the first one fails or the quota is hit.
const MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];

const LIMITS = { body: 24000, msgs: 16, msgLen: 2000, answers: 12, answerLen: 600, plan: 3500, name: 40 };
const ORIGIN_OK = /^(https?:\/\/localhost(:\d+)?|capacitor:\/\/localhost)$/;

function corsHeaders(origin) {
  const h = {
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-AE-Key',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
  if (ORIGIN_OK.test(origin)) h['Access-Control-Allow-Origin'] = origin;
  return h;
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  });
}

const clip = (s, n) => String(s ?? '').slice(0, n);

function validate(b) {
  if (!b || typeof b !== 'object') return 'bad_body';
  if (!['goggins', 'money'].includes(b.mode)) return 'bad_mode';
  if (!['chat', 'plan'].includes(b.task)) return 'bad_task';
  if (!Array.isArray(b.messages)) return 'bad_messages';
  return null;
}

function buildMessages(b) {
  const name = clip(b.profile?.name, LIMITS.name);
  const answers = Array.isArray(b.profile?.answers) ? b.profile.answers.slice(0, LIMITS.answers) : [];
  let ctx = '';
  if (name) ctx += `اسم کاربر: ${name}\n`;
  if (answers.length) {
    ctx += 'پاسخ‌های آزمون کاربر:\n' + answers
      .map((x) => `- ${clip(x.q, 200)} → ${clip(x.a, LIMITS.answerLen)}`)
      .join('\n') + '\n';
  }
  if (b.plan) ctx += `پلنی که قبلاً برای کاربر چیده شده (خلاصه):\n${clip(b.plan, LIMITS.plan)}\n`;

  let system = `${BASE}\n\n${PERSONA[b.mode]}`;
  if (ctx) system += `\n\nاطلاعات کاربر:\n${ctx}`;
  if (b.task === 'plan') system += `\n\n${PLAN_TASK}`;

  const msgs = b.messages
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-LIMITS.msgs)
    .map((m) => ({ role: m.role, content: clip(m.content, LIMITS.msgLen) }));

  if (b.task === 'plan' && !msgs.length) {
    msgs.push({ role: 'user', content: 'آزمون رو جواب دادم. حالا پلنم رو بچین.' });
  }
  return { system, msgs };
}

async function runModel(env, system, msgs, task) {
  const payload = {
    messages: [{ role: 'system', content: system }, ...msgs],
    max_tokens: task === 'plan' ? 2200 : 700,
    temperature: task === 'plan' ? 0.5 : 0.75,
  };
  let lastErr;
  for (const model of MODELS) {
    try {
      const out = await env.AI.run(model, payload);
      const text = out?.response ?? out?.choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) return { reply: text.trim(), model };
      lastErr = new Error('empty_reply');
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('ai_failed');
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req.headers.get('Origin') || '');
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/health') return json({ ok: true }, 200, cors);
    if (req.method !== 'POST' || url.pathname !== '/chat') return json({ error: 'not_found' }, 404, cors);

    // Light gate against random drive-by traffic (set with: wrangler secret put APP_KEY). Optional.
    if (env.APP_KEY && req.headers.get('X-AE-Key') !== env.APP_KEY) return json({ error: 'unauthorized' }, 401, cors);

    const raw = await req.text();
    if (raw.length > LIMITS.body) return json({ error: 'too_large' }, 413, cors);

    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400, cors); }
    const bad = validate(body);
    if (bad) return json({ error: bad }, 400, cors);

    const { system, msgs } = buildMessages(body);
    if (!msgs.length) return json({ error: 'no_messages' }, 400, cors);

    try {
      const { reply, model } = await runModel(env, system, msgs, body.task);
      return json({ reply, model }, 200, cors);
    } catch (e) {
      const m = String(e?.message || e);
      const quota = /quota|limit|neurons|429|capacity/i.test(m);
      return json({ error: quota ? 'quota' : 'ai_failed' }, quota ? 429 : 502, cors);
    }
  },
};

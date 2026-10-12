// Cloudflare Worker: يحفظ مفتاح Anthropic بعيداً عن التطبيق
// الأسرار المطلوبة في إعدادات Worker: ANTHROPIC_API_KEY و APP_TOKEN

const SYSTEM = `أنت مستشار تحليل أسواق العملات الرقمية داخل تطبيق جوال، تتحدث بالعربية بإيجاز ووضوح.
تستلم بيانات حية في context: أفضل الإشارات الفنية، الرصيد الافتراضي، والصفقات المفتوحة.
القواعد:
- اعتمد على البيانات المرسلة فقط، ولا تخترع أسعاراً أو أخباراً.
- عند السؤال عن أين يستثمر: قدّم 2-3 خيارات مرتبة مع سبب كل خيار (الإشارة، الثقة، الأمان، السيولة) ونقاط الخطر ومستويات الدخول والوقف، وتوزيعاً مقترحاً للمخاطرة.
- وضّح أن الإشارات الفنية احتمالية وليست مضمونة، ولا تعد بأرباح.
- اسأل عن مدة الاستثمار وتحمل المخاطر إن لم يذكرها المستخدم.
- شجّع على إدارة المخاطر: لا تخاطر بأكثر من 1-2% من رأس المال في الصفقة، واستثمر فقط ما يمكن تحمل خسارته.
- اختم الاستثمارات الحقيقية بجملة قصيرة: هذا تحليل تعليمي وليس نصيحة مالية.`;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type,x-app-token', 'Access-Control-Allow-Methods': 'POST,OPTIONS' };
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'content-type': 'application/json' } });

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (req.headers.get('x-app-token') !== env.APP_TOKEN) return json({ error: 'غير مصرح' }, 401);
    try {
      const { messages, context } = await req.json();
      const msgs = messages.slice(-10).map(m => ({ role: m.role, content: String(m.content).slice(0, 2000) }));
      msgs[msgs.length - 1].content += `\n\n[بيانات السوق الحالية]\n${JSON.stringify(context)}`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: 'claude-sonnet-5-5', max_tokens: 1000, system: SYSTEM, messages: msgs }),
      });
      const d = await r.json();
      if (!r.ok) return json({ error: d.error?.message || 'خطأ من الخدمة' }, 502);
      return json({ reply: d.content.filter(b => b.type === 'text').map(b => b.text).join('\n') });
    } catch (e) { return json({ error: 'طلب غير صالح' }, 400); }
  },
};

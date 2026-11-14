// The ONLY file that knows about the provider. Swap Groq for Gemini here.
export async function callModel(messages) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw Object.assign(new Error('GROQ_API_KEY is not set'), { status: 500 });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      messages,
      temperature: 0.4,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(25_000), // server-side timeout -> TimeoutError
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw Object.assign(new Error(`Groq ${res.status}: ${body.slice(0, 200)}`), { status: res.status });
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// The ONLY file that knows about the provider (Groq, OpenAI-compatible API). Swap providers here.
// Streams the reply: onDelta gets each piece of JSON text, onReasoning fires while the model "thinks".

const URL = 'https://api.groq.com/openai/v1/chat/completions';

function providerError(status, body) {
  // Groq's JSON mode rejects output that isn't valid JSON. That's a model mistake, so we treat it
  // like any other invalid output (retry once) instead of as a service failure.
  if (status === 400 && body.includes('json_validate_failed'))
    return Object.assign(new Error('Model produced invalid JSON'), { invalidOutput: true });
  const err = new Error(`Groq ${status}: ${body.slice(0, 200)}`);
  return Object.assign(err, { status });
}

// Yields the `data:` payload of each server-sent event line.
async function* sseData(body) {
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const bytes of body) {
    buffer += decoder.decode(bytes, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop(); // the last line may be incomplete
    for (const line of lines) if (line.startsWith('data:')) yield line.slice(5).trim();
  }
  if (buffer.startsWith('data:')) yield buffer.slice(5).trim();
}

export async function streamModel(messages, { signal, onDelta, onReasoning } = {}) {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw Object.assign(new Error('GROQ_API_KEY is not set'), { code: 'NO_KEY' });
  const model = process.env.GROQ_MODEL?.trim() || 'openai/gpt-oss-120b';

  // One deadline for the whole attempt (connect + stream), plus the caller's signal (client went away).
  const timeout = AbortSignal.timeout(Number(process.env.MODEL_TIMEOUT_MS) || 30_000);
  const res = await fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
      max_tokens: 4096,
      stream: true,
      // Groq's JSON mode buffers the whole answer before sending it, which defeats streaming.
      // So it's opt-in: our own parser + Zod + one retry already handle invalid JSON.
      ...(process.env.GROQ_JSON_MODE === 'true' && { response_format: { type: 'json_object' } }),
      // Reasoning models think before answering; "low" keeps the wait short.
      ...(/gpt-oss|qwen3/.test(model) && { reasoning_effort: process.env.GROQ_REASONING || 'low' }),
    }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });

  if (!res.ok) throw providerError(res.status, await res.text().catch(() => ''));

  let text = '';
  for await (const data of sseData(res.body)) {
    if (data === '[DONE]') break;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue; // ignore a garbled keep-alive line; the final validation decides
    }
    if (event.error) throw providerError(event.error.status_code ?? 400, JSON.stringify(event.error));
    const delta = event.choices?.[0]?.delta ?? {};
    if (delta.reasoning) onReasoning?.();
    if (delta.content) {
      text += delta.content;
      onDelta?.(delta.content);
    }
  }
  return text;
}

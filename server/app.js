import express from 'express';
import { parseModelOutput, parseRecipe } from '../shared/recipeSchema.js';
import { PREF_IDS } from '../shared/prefs.js';
import { buildMessages, buildRefineMessages } from './prompt.js';
import { rateLimit } from './rateLimit.js';
import { openStream } from './sse.js';

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

// Turns the request body into model messages, or an error for the user. Never trust the client.
export function readRequest(body) {
  if (body?.mode === 'refine') {
    const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : '';
    if (!instruction) return { error: 'Say what to change, for example "make it vegetarian".' };
    if (instruction.length > 300) return { error: 'Keep the change under 300 characters.' };
    const recipe = parseRecipe(body.recipe);
    if (!recipe) return { error: 'The current recipe could not be read. Generate a new one.' };
    return { messages: buildRefineMessages(recipe, instruction) };
  }
  const input = typeof body?.ingredients === 'string' ? body.ingredients.trim() : '';
  if (!input) return { error: 'List the ingredients you have.' };
  if (input.length > 1000) return { error: 'Keep it under 1000 characters.' };
  const prefs = Array.isArray(body.prefs) ? body.prefs.filter((p) => PREF_IDS.includes(p)) : [];
  return { messages: buildMessages(input, prefs) };
}

// Maps a thrown error to something the user can act on.
export function describeError(err) {
  if (err.code === 'NO_KEY') return { code: 'NO_KEY', message: 'The server has no API key. Add GROQ_API_KEY to .env, or start it with AI_MOCK=ok.' };
  if (err.name === 'TimeoutError') return { code: 'TIMEOUT', message: 'The AI took too long to respond. Try again.' };
  if (err.status === 429) return { code: 'RATE_LIMITED', message: 'The AI is getting too many requests. Wait a minute and retry.' };
  if (err.status === 401 || err.status === 403) return { code: 'AUTH', message: "The server's API key was rejected." };
  return { code: 'UPSTREAM', message: 'The AI service is unavailable right now. Try again shortly.' };
}

// streamModel is injected so tests (and AI_MOCK) can replace the real AI.
export function createApp(streamModel, { rateLimitPerMinute = 10, pingMs } = {}) {
  const app = express();
  app.use(express.json({ limit: '32kb' })); // a refinement carries the current recipe
  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.post('/api/recipe', rateLimit({ max: rateLimitPerMinute }), async (req, res) => {
    const request = readRequest(req.body);
    if (request.error) return fail(res, 400, 'BAD_INPUT', request.error);

    // From here on the reply is a stream of events: status, chunk, reset, done | error.
    const stream = openStream(res, { pingMs });
    const clientGone = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) clientGone.abort(); // stop paying for tokens nobody will read
    });

    const messages = [...request.messages];
    try {
      for (let attempt = 1; attempt <= 2; attempt++) {
        let thinking = false;
        let writing = false;
        let text;
        try {
          text = await streamModel(messages, {
            signal: clientGone.signal,
            onReasoning: () => !thinking && ((thinking = true), stream.send('status', { phase: 'thinking' })),
            onDelta: (chunk) => {
              if (!writing) stream.send('status', { phase: 'writing' });
              writing = true;
              stream.send('chunk', { text: chunk });
            },
          });
        } catch (err) {
          if (!err.invalidOutput) throw err;
          text = '';
        }

        const result = parseModelOutput(text);
        if (result.valid) {
          stream.send('done', { result: result.data, warnings: result.warnings });
          return;
        }
        console.warn(`Attempt ${attempt}: invalid model output:`, result.error);
        if (attempt === 2) {
          stream.send('error', result.empty
            ? { code: 'EMPTY', message: 'The AI returned an empty answer twice. Try again.' }
            : { code: 'INVALID_OUTPUT', message: 'The AI returned a recipe the app could not read, even after a retry.' });
          return;
        }
        // One retry: tell the client to clear its preview, and show the model its own mistake.
        stream.send('reset', { reason: result.error });
        messages.push(
          { role: 'assistant', content: String(text).slice(0, 4000) || '(empty)' },
          { role: 'user', content: `That was invalid: ${result.error}. Reply with ONLY the corrected JSON object.` },
        );
      }
    } catch (err) {
      if (clientGone.signal.aborted) return; // the user cancelled or started a newer request
      console.error('Model call failed:', err.message);
      stream.send('error', describeError(err));
    } finally {
      stream.end();
    }
  });

  // Malformed JSON bodies from express.json(): answer in our error format, not an HTML page.
  app.use((err, _req, res, next) => {
    if (err.type === 'entity.parse.failed') return fail(res, 400, 'BAD_INPUT', 'The request body is not valid JSON.');
    if (err.type === 'entity.too.large') return fail(res, 413, 'BAD_INPUT', 'The request is too large.');
    next(err);
  });

  return app;
}

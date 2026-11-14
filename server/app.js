import express from 'express';
import { parseModelOutput } from '../shared/recipeSchema.js';
import { buildMessages } from './prompt.js';

const fail = (res, status, code, message) => res.status(status).json({ error: { code, message } });

// callModel is injected so tests can fake the AI.
export function createApp(callModel) {
  const app = express();
  app.use(express.json({ limit: '10kb' }));

  app.post('/api/recipe', async (req, res) => {
    const input = typeof req.body?.ingredients === 'string' ? req.body.ingredients.trim() : '';
    if (!input) return fail(res, 400, 'BAD_INPUT', 'List the ingredients you have.');
    if (input.length > 1000) return fail(res, 400, 'BAD_INPUT', 'Keep it under 1000 characters.');

    try {
      const messages = buildMessages(input);
      let text = await callModel(messages);
      let result = parseModelOutput(text);

      if (!result.valid) {
        // One retry: show the model its own mistake.
        console.warn('Invalid model output, retrying:', result.error);
        messages.push(
          { role: 'assistant', content: String(text).slice(0, 4000) },
          { role: 'user', content: `That was invalid: ${result.error}. Reply with ONLY the corrected JSON object.` },
        );
        text = await callModel(messages);
        result = parseModelOutput(text);
      }

      if (!result.valid) {
        console.error('Retry failed:', result.error);
        return fail(res, 502, 'INVALID_OUTPUT', 'The AI returned a recipe the app could not read. Try again.');
      }
      return res.json(result.data);
    } catch (err) {
      console.error('Model call failed:', err.message);
      if (err.name === 'TimeoutError' || err.name === 'AbortError')
        return fail(res, 504, 'TIMEOUT', 'The AI took too long to respond. Try again.');
      if (err.status === 429)
        return fail(res, 429, 'RATE_LIMITED', 'Too many requests right now. Wait a minute and retry.');
      return fail(res, 502, 'UPSTREAM', 'The AI service is unavailable. Try again shortly.');
    }
  });

  return app;
}

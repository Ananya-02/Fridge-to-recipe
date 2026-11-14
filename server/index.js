import 'dotenv/config';
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { streamModel } from './callModel.js';
import { createMockModel, MOCK_MODES } from './mock.js';

const mock = process.env.AI_MOCK?.trim();
if (mock && !MOCK_MODES.includes(mock)) {
  console.error(`Unknown AI_MOCK "${mock}". Use one of: ${MOCK_MODES.join(', ')}`);
  process.exit(1);
}
if (!mock && !process.env.GROQ_API_KEY) console.warn('GROQ_API_KEY is not set. Add it to .env, or run with AI_MOCK=ok.');

const app = createApp(mock ? createMockModel(mock) : streamModel, {
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE) || 10,
});

// In production one Node process serves both the API and the built React app (npm run build first).
const dist = fileURLToPath(new URL('../dist', import.meta.url));
if (process.env.NODE_ENV === 'production' && existsSync(dist)) {
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile('index.html', { root: dist }));
}

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`API on http://localhost:${port}${mock ? `  (mock mode: ${mock})` : ''}`));

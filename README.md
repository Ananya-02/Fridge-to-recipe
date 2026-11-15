# Fridge to Feast

Type what's in your fridge. An LLM returns a **structured JSON recipe**, and the app turns it into an interactive tool: scale servings, swap ingredients, check off steps, run step timers, tweak the recipe with follow-up prompts, and cook hands-free in cook mode.

**It is not a chatbot.** The model's text is never shown raw. It is parsed, validated and rendered as components.

**Brief chosen:** Fridge-to-recipe

> **Want to try it without an API key?** Add `AI_MOCK=ok` to your `.env` file (see [Setup](#setup)). The app then streams a built-in recipe, and other mock modes trigger every failure path on purpose.

## Setup

Requires **Node 20.3 or newer** and a free [Groq](https://console.groq.com/keys) API key.

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
# open .env and paste your GROQ_API_KEY
npm start                   # API on :8787, app on http://localhost:5173
npm test                    # 29 tests: schema, streaming API, retries, partial JSON, sessions, scaling
```

`npm install && npm start` is all it takes once `.env` has a key (or `AI_MOCK=ok`).

### Configuration (`.env`)

| Variable | Default | Purpose |
|---|---|---|
| `GROQ_API_KEY` | none | Your Groq key. It stays on the server and is never sent to the browser |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | Any Groq chat model |
| `GROQ_REASONING` | `low` | `low`, `medium` or `high` (only for reasoning models such as gpt-oss) |
| `GROQ_JSON_MODE` | `false` | `true` = provider-side JSON validation, but no live streaming (see [Why JSON mode is off](#why-json-mode-is-off)) |
| `PORT` | `8787` | API port |
| `MODEL_TIMEOUT_MS` | `30000` | Time limit for each model attempt |
| `RATE_LIMIT_PER_MINUTE` | `10` | Requests per IP per minute |
| `AI_MOCK` | off | Replaces the model: `ok`, `flaky`, `malformed`, `shape`, `empty`, `refuse`, `slow`, `fail`, `ratelimit`, `random` |

### Mock mode (no key needed, every failure on demand)

Put one line in `.env`, then run `npm start`. This works on every operating system:

```
AI_MOCK=ok          # a canned recipe, streamed like the real thing
AI_MOCK=flaky       # the first answer is broken, the automatic retry fixes it
AI_MOCK=malformed   # also: shape, empty, refuse, slow, fail, ratelimit, random
```

Or set it for one run only. macOS/Linux: `AI_MOCK=ok npm start`. Windows PowerShell: `$env:AI_MOCK="ok"; npm start`.

### Production build (one Node process serves the API and the app)

```bash
npm run serve                                   # macOS/Linux, then open http://localhost:8787
```

```powershell
npm run build                                   # Windows PowerShell
$env:NODE_ENV="production"; node server/index.js
```

The server only serves the built app when `NODE_ENV=production`.

### Deploying

Any Node host works (for example Render). Use build command `npm install --include=dev && npm run build` (the build needs Vite, a dev dependency) and start command `node server/index.js`. Set the environment variables `GROQ_API_KEY` and `NODE_ENV=production`. Free hosts may sleep when idle, so the first request can be slow.

## Assignment checklist

| Requirement | Where it is handled |
|---|---|
| React, hooks, function components | Every component is a function component; logic lives in custom hooks (`src/hooks/`) |
| Free-form text input | `IngredientForm`: free text with live ingredient chips and optional preferences |
| A real LLM API | Groq streaming chat completions (`server/callModel.js`) |
| Structured data, parsed and rendered as interactive, stateful UI | One shared Zod schema; recipe, ingredients, steps and blocks render as components with their own state |
| Bad output: malformed, wrong shape, empty, slow, failed, stale | [Handling bad AI output](#handling-bad-ai-output), covered by tests and mock modes |
| Loading, error and empty states | Streaming preview, error screen with retry, and an empty state when the input is not food |
| Works on mobile | Responsive layout, touch-friendly controls, swipe navigation in cook mode |
| README | This file: setup, AI usage, limitations, time spent |
| **Stretch:** different block types | Chart (nutrition), card (chef's tip), checklist (equipment) |
| **Stretch:** streaming | Server-sent events; the recipe appears while it is being written |
| **Stretch:** refinement loop | Follow-up prompts edit the current recipe, with version history |
| **Stretch:** save and reload sessions | Sessions saved to localStorage and restored on reload |
| **Stretch:** polish | Animations, dark mode, keyboard navigation |
| API key not in the browser | The key is read only on the server; the browser talks to `/api/recipe` |
| Submission | Public repo with small commits, this README, a screen recording, `npm install && npm start` |

## Features

| | |
|---|---|
| **Core** | Free-text input with live ingredient chips · optional preferences (quick, vegetarian, one pan…) · scalable servings with readable fractions (1 ½ cups) · ingredient swaps that update every step · steps to check off with a progress bar |
| **Typed blocks** | The AI picks extra blocks: a **chart** (nutrition), a **card** (chef's tip) and a **checklist** (equipment). Each type has its own component; broken or unknown blocks are dropped one by one |
| **Streaming** | The recipe appears while it is being written, parsed from partial JSON. The status moves through "thinking", "writing", and "retrying" if the first answer was broken |
| **Refinement loop** | "Make it vegetarian" edits the current recipe instead of starting over. Each result is a version you can switch back to. If a refinement fails, the current recipe stays |
| **Sessions** | Every recipe, with its versions, servings, swaps and ticked steps, is saved to localStorage and restored on reload. Data is re-validated when loaded |
| **Cooking tools** | Step timers (several at once, with a sound when done) · full-screen cook mode with big text, arrow keys and swipe, and the screen kept awake · copy / share with your servings and swaps |
| **Polish** | Light and dark theme · keyboard shortcuts (`?` lists them) · animations that respect *reduce motion* · hero photo with responsive sizes |

### Keyboard

`/` type ingredients · `Enter` generate (`Shift+Enter` new line) · `Esc` cancel / leave a field / close · `C` cook mode · `R` tweak · `+` `-` servings · `H` saved recipes · `T` theme · `←` `→` steps in cook mode · `?` all shortcuts. Shortcuts are ignored while typing or while a dialog is open.

## How it works

```
Browser (React)                         Server (Express)                     Groq
IngredientForm ──POST /api/recipe──▶   validate input, rate limit
                                        build prompt (shared schema)  ──▶   streaming chat completion
useRecipeRequest ◀── SSE events ──      status / chunk / reset / done|error ◀── tokens
  parsePartial(text) → live preview     parse + Zod-validate the full text
  validateResponse(done) → session      retry once with the error if invalid
```

1. The browser sends `{ingredients, prefs}` (or `{mode: "refine", recipe, instruction}`) to `POST /api/recipe`. **The API key only lives on the server.**
2. The server streams the answer back as server-sent events: `status` (thinking / writing), `chunk` (text), and a final `done` or `error`. A `ping` every 5 s lets the client tell a slow model apart from a dead connection.
3. When the model finishes, the server validates the whole text with Zod (`shared/recipeSchema.js`). It checks the shape first, then consistency: unique ids, and every `{{i1}}` placeholder in a step points to a real ingredient. If that fails, it sends `reset` and asks the model **once** more, showing it its own error.
4. The client validates the final result **again** (never trust the network), then stores it as a session. Quantities are numbers, so scaling is arithmetic. Steps use `{{id}}` placeholders, so swapping an ingredient or changing servings rewrites the step text.

### Project layout

```
shared/recipeSchema.js     The one definition of a valid recipe (Zod), used by server AND client
shared/prefs.js            Whitelisted preference toggles
server/app.js              Express app: input checks, retry loop, SSE, error mapping
server/callModel.js        The only provider-specific file (Groq streaming)
server/prompt.js           System prompt + create/refine messages
server/mock.js             AI_MOCK modes for demos and failure testing
server/rateLimit.js, sse.js
src/hooks/useRecipeRequest.js   Request lifecycle: streaming, abort, stale guard, timeouts, retry
src/hooks/useSessions.js        Saved sessions (pure logic in src/lib/sessions.js)
src/hooks/useTimers.js          Step timers
src/lib/partialJson.js          Turns half-streamed JSON into a preview
src/lib/scale.js                Fractions, scaling, swaps, step text
src/components/                 RecipeView, IngredientList, StepList, Blocks, RefineBar, CookMode, Status…
tests/                          API, schema, client logic and scaling tests (node:test)
```

### State design

- **Request state** lives in a reducer (`useRecipeRequest`): `idle | loading | success | empty | error`, plus the streaming phase and text.
- **Recipe state** lives in the session (`useSessions`): versions, current version, servings, swaps and checked steps. `RecipeView` is *controlled*: it sends patches up, so saving is a single `useEffect`.
- The streaming preview is *derived* from the raw text with `useMemo` and `useDeferredValue`, so it is never stored twice.

## Handling bad AI output

| Problem | What happens |
|---|---|
| Malformed JSON, ```json fences, chatter around the JSON | Extracted and parsed. If parsing fails, the server retries once and shows the model its error |
| Wrong shape, wrong types, broken `{{placeholders}}` | Rejected by Zod / `checkRecipe`, then the same single retry. The client clears the half-written preview (`reset` event) |
| Fixable mistakes | Lenient where it is safe: `"1 1/2"` → 1.5, `"4"` → 4, missing emoji → 🍽️, broken swaps → no swaps, unknown difficulty → easy. A bad extra block is dropped and a toast says so; the recipe survives |
| Empty answer | Its own error (`EMPTY`) with a retry button |
| Not food ("my car keys") | The model answers `ok:false`; the UI shows its reason with no retry, because retrying won't help |
| Slow model | 30 s per attempt on the server; on the client, 20 s without any event (pings included) or 80 s in total. Each has its own message and a retry |
| Provider down, rate limited, bad key, no key | Mapped to `UPSTREAM`, `RATE_LIMITED`, `AUTH`, `NO_KEY`, each with a specific message |
| Stream cut off mid-way | `DROPPED`: "the connection closed before the recipe was finished" |
| **Stale responses** | A new request aborts the old one **and** bumps a request id; every handler checks the id before touching state, so a late answer can never overwrite a newer one |
| Failed refinement | The current recipe stays on screen, with an inline error and a retry |
| User goes away | The server notices the closed connection and aborts the model call |
| Corrupt or edited localStorage | Every saved session is re-validated on load; bad ones are dropped, bad fields are repaired |
| Render bug | An error boundary shows a reload screen instead of a blank page |
| Abuse of the public demo | Per-IP limit (10 requests / min), 32 KB body limit, input length limits |

Each row is covered by a test in `tests/` or can be triggered with an `AI_MOCK` mode.

### Why JSON mode is off

Groq's JSON mode validates the output on the server, but it then sends the whole answer at once, which defeats streaming. Because the app already extracts, validates and retries itself, it streams without JSON mode by default. Set `GROQ_JSON_MODE=true` to trade streaming for provider-side validation. Both paths are handled (`json_validate_failed` counts as invalid output and is retried).

## AI Usage

I used AI tools as a development aid during this project to explore implementation approaches, get code suggestions for some frontend and backend components, and troubleshoot technical issues during development.

I reviewed and adapted the suggestions, configured the Groq API integration, and ran the application while testing and refining its functionality.

I have also focused on understanding the implementation and the technical decisions behind it so that I can explain, debug, and extend the application independently.

## Key Implementation Decisions

- Server-side Zod validation to ensure the AI-generated recipe follows the expected JSON structure before it reaches the UI.
- Using a request ID along with `AbortController` to prevent cancelled or outdated requests from overwriting newer results.
- Streaming the Groq response in JSON mode and parsing partial JSON for a live preview.
- Returning a complete updated recipe during refinement rather than a partial difference, allowing the updated result to go through the same validation process.

The model used in the application is Groq's `openai/gpt-oss-120b`.

## Known limitations

- The recipe comes from a model: quantities, nutrition and cooking times can be wrong. The UI says so.
- Scaling is linear; spices and baking times don't really scale that way. There is no unit conversion (cups ↔ grams).
- On a refinement, ticked steps and swaps reset, because the steps may have changed.
- Sessions live in one browser's localStorage (last 20 recipes, up to 8 versions each).
- The rate limit is in memory, so it resets on restart and isn't shared between server instances.
- Timers reset if you switch versions or reload the page.
- Tests cover the server, schema and client logic; there are no browser (end-to-end) or component tests.
- `npm audit` reports advisories for the Vite 5 dev server (esbuild, development only) and Zod 3. The request body is capped at 32 KB; moving to Zod 4 would remove the Zod one.
- On Windows, `npm run serve` does not work in cmd or PowerShell because of the `NODE_ENV=` prefix; use the two-step command in [Setup](#setup).

## What I would do next

Component tests with Testing Library, accounts and sync instead of localStorage, a smarter refinement merge that keeps ticked steps, unit conversion, a cross-platform `serve` script, and an "I'm missing this" button that asks for a substitute for one ingredient.

## Time spent

About 8 hours of focused work, spread over four days (Nov 12 to 15). This is an approximate breakdown, not a stopwatch count.

| Area | Hours |
|---|---|
| Setup and planning (brief, JSON shape, architecture) | 0.5 |
| API, streaming and validation | 2.5 |
| UI, animations and features | 3 |
| Tests, README and Git | 2 |
| **Total** | **8** |

---
Hero photo from [Unsplash](https://unsplash.com) (Unsplash License).
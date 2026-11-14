# Fridge to Feast

Type what's in your fridge. An LLM returns a **structured JSON recipe**, and the app turns it into an interactive tool: scale servings, swap ingredients, check off steps, run step timers, tweak the recipe with follow-up prompts, and cook hands-free in cook mode. It is not a chatbot: the model's text is never shown raw. It is parsed, validated, and rendered as components.

**Live demo:** _add link_ · **Screen recording:** _add link_

## Setup

Requires Node 20.3 or newer and a free [Groq](https://console.groq.com/keys) API key.

```bash
npm install
cp .env.example .env     # paste your GROQ_API_KEY
npm start                # API on :8787, app on http://localhost:5173
npm test                 # 29 tests: schema, streaming API, retries, partial JSON, sessions, scaling
```

**No key? Use mock mode.** It needs no API key and can also trigger each failure path on purpose:

```bash
AI_MOCK=ok npm start          # canned recipe, streamed like the real thing
AI_MOCK=flaky npm start       # first answer is broken, the automatic retry fixes it
# also: malformed, shape, empty, refuse, slow, fail, ratelimit, random
```

Production build (one Node process serves the API and the app): `npm run serve`, then open http://localhost:8787.

## Features

| | |
|---|---|
| **Core** | Free-text input with live ingredient chips · optional preferences (quick, vegetarian, one pan…) · scalable servings with readable fractions (1 ½ cups) · ingredient swaps that update every step · steps to check off with a progress bar |
| **Typed blocks** | The AI picks extra blocks: a **chart** (nutrition), a **card** (chef's tip) and a **checklist** (equipment). Each type has its own component; broken or unknown blocks are dropped one by one |
| **Streaming** | The recipe appears while it is being written, parsed from partial JSON. The status moves through "thinking", "writing", and "retrying" if the first answer was broken |
| **Refinement loop** | "Make it vegetarian" edits the current recipe instead of starting over. Each result is a version you can switch back to. If a refinement fails, the current recipe stays |
| **Sessions** | Every recipe, with its versions, servings, swaps and ticked steps, is saved to localStorage and restored on reload. Data is re-validated when loaded |
| **Cooking tools** | Step timers (several at once, with a sound when done) · full-screen cook mode with big text, arrow keys and swipe, and the screen kept awake · copy / share with your servings and swaps |
| **Polish** | Light and dark theme · keyboard shortcuts (`?` lists them) · animations that respect *reduce motion* · works on mobile |

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
2. The server streams the model's answer back as server-sent events: `status` (thinking / writing), `chunk` (text), and a final `done` or `error`. A `ping` every 5 s lets the client tell a slow model apart from a dead connection.
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

## Keyboard

`/` type ingredients · `Enter` generate (`Shift+Enter` new line) · `Esc` cancel / leave a field / close · `C` cook mode · `R` tweak · `+` `−` servings · `H` saved recipes · `T` theme · `←` `→` steps in cook mode · `?` all shortcuts. Shortcuts are ignored while typing or while a dialog is open.

## AI usage

_Edit this so it is true for you before submitting._ I used Claude (Claude Code) as a pair programmer: to plan the architecture, draft the code and tests, and review error handling and the UI. I read, ran and tested every part and can explain the decisions. The ones I would defend in an interview:

- Validating on the client **and** the server with one shared Zod schema.
- A request id **plus** `AbortController` for stale responses (abort alone is not enough: a response can already be in flight).
- Streaming without JSON mode, and parsing partial JSON for the preview, instead of asking the model for a line-based format.
- Returning a **full** recipe on refinement (not a diff), so it goes through the same validation.
- A mock mode, so every failure path can be shown on demand.

The model inside the app is Groq's `openai/gpt-oss-120b`.

## Known limitations

- The recipe comes from a model: quantities, nutrition and cooking times can be wrong. The UI says so.
- Scaling is linear; spices and baking times don't really scale that way. There is no unit conversion (cups ↔ grams).
- On a refinement, ticked steps and swaps reset, because the steps may have changed.
- Sessions live in one browser's localStorage (last 20 recipes, up to 8 versions each).
- The rate limit is in memory, so it resets on restart and isn't shared between server instances.
- Timers reset if you switch versions or reload the page.
- `npm audit` reports advisories for the Vite 5 dev server (it only affects local development) and Zod 3 (memory use on very large arrays). The latter is limited here by the 32 KB body limit and `.max()` on every array; moving to Zod 4 would remove it.

## What I would do next

Component tests with Testing Library, accounts and sync instead of localStorage, a smarter refinement merge that keeps ticked steps, unit conversion, and an "I'm missing this" button that asks for a substitute for one ingredient.

## Time spent

_Fill in honestly, e.g. setup 0.5h, API, streaming and validation 3h, UI and features 3.5h, tests and README 1h._

---
Hero photo from [Unsplash](https://unsplash.com) (`photo-1498837167922-ddd27525d352`, Unsplash License).

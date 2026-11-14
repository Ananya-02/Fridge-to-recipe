// AI_MOCK=<mode> replaces the real model. No API key needed, and every failure path can be demoed on purpose.
// It has the same signature as streamModel in callModel.js, so the rest of the server can't tell the difference.

export const MOCK_MODES = ['ok', 'flaky', 'malformed', 'shape', 'empty', 'refuse', 'slow', 'fail', 'ratelimit', 'random'];

export const SAMPLE = {
  title: 'Tomato Egg Fried Rice',
  emoji: '🍳',
  description: 'Jammy tomatoes, soft eggs and crispy rice, all in one hot wok.',
  difficulty: 'easy',
  baseServings: 2,
  prepMinutes: 10,
  cookMinutes: 12,
  ingredients: [
    { id: 'i1', name: 'cooked rice', quantity: 2, unit: 'cup', swaps: [{ name: 'cooked quinoa', quantity: 2, unit: 'cup' }, { name: 'cauliflower rice', quantity: 300, unit: 'g' }] },
    { id: 'i2', name: 'eggs', quantity: 3, unit: '', swaps: [{ name: 'firm tofu', quantity: 200, unit: 'g' }] },
    { id: 'i3', name: 'tomatoes', quantity: 2, unit: '', swaps: [{ name: 'cherry tomatoes', quantity: 12, unit: '' }, { name: 'canned tomatoes', quantity: 200, unit: 'g' }] },
    { id: 'i4', name: 'onion', quantity: 1, unit: '', swaps: [{ name: 'spring onions', quantity: 4, unit: '' }, { name: 'shallots', quantity: 2, unit: '' }] },
    { id: 'i5', name: 'garlic', quantity: 2, unit: 'clove', swaps: [{ name: 'garlic powder', quantity: 0.5, unit: 'tsp' }] },
    { id: 'i6', name: 'soy sauce', quantity: 2, unit: 'tbsp', swaps: [{ name: 'tamari', quantity: 2, unit: 'tbsp' }, { name: 'coconut aminos', quantity: 2, unit: 'tbsp' }] },
    { id: 'i7', name: 'vegetable oil', quantity: 2, unit: 'tbsp', swaps: [] },
    { id: 'i8', name: 'salt', quantity: null, unit: 'to taste', swaps: [] },
  ],
  steps: [
    { id: 's1', text: 'Dice {{i4}} and {{i3}}, and mince {{i5}}.', timerMinutes: null },
    { id: 's2', text: 'Beat {{i2}} with a pinch of {{i8}}.', timerMinutes: null },
    { id: 's3', text: 'Heat half of {{i7}} in a wok over high heat. Scramble the eggs until just set, then move them to a plate.', timerMinutes: 2 },
    { id: 's4', text: 'Add the rest of the oil. Fry the onion and garlic until fragrant, then add the tomatoes and cook until jammy.', timerMinutes: 4 },
    { id: 's5', text: 'Add {{i1}}, break up any clumps, and stir-fry until hot and a little crispy.', timerMinutes: 3 },
    { id: 's6', text: 'Stir in {{i6}} and the eggs. Taste, adjust the salt and serve hot.', timerMinutes: null },
  ],
  blocks: [
    { type: 'chart', title: 'Nutrition per serving', unit: 'g', items: [{ label: 'Protein', value: 15 }, { label: 'Carbs', value: 58 }, { label: 'Fat', value: 14 }, { label: 'Fiber', value: 4 }] },
    { type: 'card', icon: '💡', title: "Chef's tip", text: 'Day-old rice fries best: it is drier, so it crisps instead of steaming.' },
    { type: 'checklist', title: 'Equipment', items: ['Wok or large frying pan', 'Chopping board', 'Sharp knife', 'Small bowl', 'Spatula'] },
  ],
};

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true });
  });

async function streamText(text, onDelta, signal) {
  for (let i = 0; i < text.length; i += 14) {
    await sleep(15, signal);
    onDelta?.(text.slice(i, i + 14));
  }
  return text;
}

// For a refinement, echo the current recipe back with a visible change.
function refined(messages) {
  const content = messages.at(-1).content;
  const current = content.match(/<current_recipe>\n([\s\S]*?)\n<\/current_recipe>/);
  const change = content.match(/<change>\n([\s\S]*?)\n<\/change>/);
  if (!current) return SAMPLE;
  const recipe = JSON.parse(current[1]);
  const note = { type: 'card', icon: '✏️', title: 'Refined (mock)', text: `Applied: "${change?.[1] ?? ''}". A real model would rewrite the recipe.` };
  return { ...recipe, title: recipe.title.endsWith('(tweaked)') ? recipe.title : `${recipe.title} (tweaked)`, blocks: [note, ...recipe.blocks.filter((b) => b.title !== note.title)].slice(0, 4) };
}

export function createMockModel(mode) {
  return async function mockModel(messages, { signal, onDelta, onReasoning } = {}) {
    const timeout = AbortSignal.timeout(Number(process.env.MODEL_TIMEOUT_MS) || 30_000);
    const sig = signal ? AbortSignal.any([signal, timeout]) : timeout;
    const m = mode === 'random' ? MOCK_MODES[Math.floor(Math.random() * (MOCK_MODES.length - 1))] : mode;
    const isRetry = messages.some((x) => x.role === 'assistant');

    onReasoning?.();
    await sleep(700, sig);
    switch (m) {
      case 'slow':
        await sleep(10 * 60_000, sig); // the 30s timeout fires first
        return '';
      case 'fail':
        throw Object.assign(new Error('Mock: provider unavailable'), { status: 503 });
      case 'ratelimit':
        throw Object.assign(new Error('Mock: rate limited'), { status: 429 });
      case 'empty':
        return '';
      case 'malformed':
        return streamText('{"ok":true,"recipe":{"title":"Half a recipe","ingredients":[{"id":"i1"', onDelta, sig);
      case 'shape':
        return streamText(JSON.stringify({ ok: true, recipe: { title: 'Soup', ingredients: 'eggs, water', steps: 3 } }), onDelta, sig);
      case 'refuse':
        return streamText(JSON.stringify({ ok: false, reason: "That doesn't look like food. List a few ingredients, like eggs or rice." }), onDelta, sig);
      case 'flaky': // bad the first time, fine on the retry: shows the retry path
        if (!isRetry) return streamText('Sure! Here is your recipe: {"ok":true,"recipe":{"title":"Oops', onDelta, sig);
      // falls through
      default:
        return streamText(JSON.stringify({ ok: true, recipe: refined(messages) }), onDelta, sig);
    }
  };
}

// Shared by server AND client: one definition of "what a valid recipe is".
// Strict where the UI depends on it (ids, numbers, steps), lenient where a bad value is harmless
// (emoji, description, timers, extra blocks): those fall back to a default instead of failing the recipe.
import { z } from 'zod';

// Models sometimes write quantities as text. "1 1/2" -> 1.5, "0.5" -> 0.5, "" or "to taste" -> null.
// Anything else is returned unchanged so Zod rejects it.
export function toQuantity(v) {
  if (v == null || typeof v === 'number') return v ?? null;
  if (typeof v !== 'string') return v;
  const s = v.trim().toLowerCase();
  if (s === '' || s.includes('taste') || s === 'as needed') return null;
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  if (/^\d*\.?\d+$/.test(s)) return Number(s);
  return v;
}

// null = "to taste". Keeping it null (not 0, not NaN) means scaling can never produce NaN.
const qty = z.preprocess(toQuantity, z.number().finite().nonnegative().max(100000).nullable());
const unit = z.string().max(20).nullish().transform((u) => (u ?? '').trim());
const minutes = z.coerce.number().finite().nonnegative().max(1440).transform(Math.round);

const SwapSchema = z.object({ name: z.string().trim().min(1).max(80), quantity: qty, unit });

const IngredientSchema = z.object({
  id: z.string().regex(/^i\d+$/, 'id must look like i1, i2'),
  name: z.string().trim().min(1).max(80),
  quantity: qty,
  unit,
  swaps: z.array(SwapSchema).max(3).catch([]), // a broken swaps list costs the swaps, not the recipe
});

const StepSchema = z.object({
  id: z.string().regex(/^s\d+$/, 'id must look like s1, s2'),
  text: z.string().trim().min(1).max(600),
  timerMinutes: z.number().positive().max(600).nullable().catch(null),
});

// Extra blocks: the model picks which kinds to send; each kind has its own component.
const title = z.string().trim().min(1).max(60);
export const BlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('chart'),
    title,
    unit,
    items: z.array(z.object({ label: z.string().trim().min(1).max(30), value: z.number().finite().nonnegative().max(100000) })).min(1).max(8),
  }),
  z.object({ type: z.literal('card'), title, text: z.string().trim().min(1).max(400), icon: z.string().max(8).catch('💡') }),
  z.object({ type: z.literal('checklist'), title, items: z.array(z.string().trim().min(1).max(80)).min(1).max(12) }),
]);

// Invalid or unknown blocks are dropped one by one, never the whole recipe.
const blocks = z
  .array(z.unknown())
  .catch([])
  .transform((list) =>
    list
      .map((b) => BlockSchema.safeParse(b))
      .filter((r) => r.success)
      .map((r) => r.data)
      .slice(0, 4),
  );

export const RecipeSchema = z.object({
  title: z.string().trim().min(1).max(100),
  emoji: z.string().min(1).max(8).catch('🍽️'),
  description: z.string().max(240).catch(''),
  difficulty: z.enum(['easy', 'medium', 'hard']).catch('easy'),
  baseServings: z.coerce.number().int().min(1).max(12),
  prepMinutes: minutes,
  cookMinutes: minutes,
  ingredients: z.array(IngredientSchema).min(1).max(30),
  steps: z.array(StepSchema).min(1).max(20),
  blocks,
});

// The model may refuse (ok:false) for non-food input.
export const ResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), recipe: RecipeSchema }),
  z.object({ ok: z.literal(false), reason: z.string().trim().min(1).max(300) }),
]);

// Shape is valid, but is it *consistent*? Zod can't check cross-references.
export function checkRecipe(recipe) {
  const problems = [];
  const ids = recipe.ingredients.map((i) => i.id);
  if (new Set(ids).size !== ids.length) problems.push('ingredient ids must be unique');
  const stepIds = recipe.steps.map((s) => s.id);
  if (new Set(stepIds).size !== stepIds.length) problems.push('step ids must be unique');
  for (const s of recipe.steps)
    for (const m of s.text.matchAll(/\{\{(\w+)\}\}/g))
      if (!ids.includes(m[1])) problems.push(`step ${s.id} uses unknown ingredient ${m[1]}`);
  return problems;
}

// Models often wrap JSON in ```json fences or add chatter around it.
export function extractJson(text) {
  if (typeof text !== 'string' || !text.trim()) throw Object.assign(new Error('Empty response'), { empty: true });
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found');
  return JSON.parse(t.slice(start, end + 1)); // throws on malformed JSON
}

const describe = (issues) =>
  issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');

// Returns { valid: true, data, warnings } or { valid: false, error }. Never throws.
export function validateResponse(raw) {
  const r = ResponseSchema.safeParse(raw);
  if (!r.success) return { valid: false, error: describe(r.error.issues) };
  const warnings = [];
  if (r.data.ok) {
    const problems = checkRecipe(r.data.recipe);
    if (problems.length) return { valid: false, error: problems.join('; ') };
    const sent = Array.isArray(raw?.recipe?.blocks) ? raw.recipe.blocks.length : 0;
    const dropped = sent - r.data.recipe.blocks.length;
    if (dropped > 0) warnings.push(`Skipped ${dropped} extra block${dropped > 1 ? 's' : ''} the AI sent in a broken format.`);
  }
  return { valid: true, data: r.data, warnings };
}

export function parseModelOutput(text) {
  try {
    return validateResponse(extractJson(text));
  } catch (e) {
    return { valid: false, error: e.message, empty: Boolean(e.empty) };
  }
}

// For data that should already be a recipe (saved sessions, refine requests): recipe or null.
export function parseRecipe(raw) {
  const r = RecipeSchema.safeParse(raw);
  return r.success && checkRecipe(r.data).length === 0 ? r.data : null;
}

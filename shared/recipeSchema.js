// Shared by server AND client: one definition of "what a valid recipe is".
import { z } from 'zod';

const qty = z.number().nonnegative().nullable(); // null = "to taste", avoids NaN when scaling

const SwapSchema = z.object({ name: z.string().min(1), quantity: qty, unit: z.string() });

const IngredientSchema = z.object({
  id: z.string().regex(/^i\d+$/, 'id must look like i1, i2'),
  name: z.string().min(1),
  quantity: qty,
  unit: z.string(),
  swaps: z.array(SwapSchema).max(3).default([]),
});

const StepSchema = z.object({
  id: z.string().regex(/^s\d+$/, 'id must look like s1, s2'),
  text: z.string().min(1),
});

export const RecipeSchema = z.object({
  title: z.string().min(1),
  baseServings: z.number().int().min(1).max(12),
  prepMinutes: z.number().int().nonnegative(),
  cookMinutes: z.number().int().nonnegative(),
  ingredients: z.array(IngredientSchema).min(1),
  steps: z.array(StepSchema).min(1),
});

// The model may refuse (ok:false) for non-food input.
export const ResponseSchema = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), recipe: RecipeSchema }),
  z.object({ ok: z.literal(false), reason: z.string().min(1) }),
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
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty response');
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const start = t.indexOf('{');
  const end = t.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('No JSON object found');
  return JSON.parse(t.slice(start, end + 1)); // throws on malformed JSON
}

// Returns { valid: true, data } or { valid: false, error } -- never throws.
export function validateResponse(raw) {
  const r = ResponseSchema.safeParse(raw);
  if (!r.success) {
    const error = r.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('; ');
    return { valid: false, error };
  }
  if (r.data.ok) {
    const problems = checkRecipe(r.data.recipe);
    if (problems.length) return { valid: false, error: problems.join('; ') };
  }
  return { valid: true, data: r.data };
}

export function parseModelOutput(text) {
  try {
    return validateResponse(extractJson(text));
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

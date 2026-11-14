const FRACS = [[0.125, '⅛'], [0.25, '¼'], [1 / 3, '⅓'], [0.5, '½'], [2 / 3, '⅔'], [0.75, '¾']];

// 1.3333 -> "1 ⅓", 250 -> "250": readable amounts, never "1.3333333".
export function formatQty(n) {
  if (n == null || Number.isNaN(n)) return '';
  if (n === 0) return '0';
  if (n >= 10) return String(Math.round(n));
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.06) return String(whole || '⅛');
  if (frac > 0.94) return String(whole + 1);
  const hit = FRACS.find(([v]) => Math.abs(v - frac) < 0.04);
  if (hit) return (whole ? `${whole} ` : '') + hit[1];
  return String(Math.round(n * 10) / 10);
}

const PLURAL = { cup: 'cups', clove: 'cloves', slice: 'slices', piece: 'pieces', pinch: 'pinches', can: 'cans' };

// quantity null means "to taste": show the unit text only, so scaling never makes NaN.
export function amountText(quantity, unit, base, servings) {
  if (quantity == null) return unit || '';
  const n = (quantity * servings) / base;
  const u = n > 1.06 && PLURAL[unit] ? PLURAL[unit] : unit; // "2 cups", but "1 cup"
  return [formatQty(n), u].filter(Boolean).join(' ');
}

// The ingredient as currently chosen: original, or one of its swaps.
export function effective(ing, swapIndex) {
  const s = swapIndex == null ? null : ing.swaps[swapIndex];
  return s
    ? { name: s.name, quantity: s.quantity, unit: s.unit, swapped: true }
    : { name: ing.name, quantity: ing.quantity, unit: ing.unit, swapped: false };
}

// Splits "Beat the {{i1}}" into ["Beat the ", { id, amount, name }] so the UI can highlight ingredients.
export function stepParts(text, ingredients, swaps, base, servings) {
  return text.split(/(\{\{\w+\}\})/).filter(Boolean).map((part) => {
    const m = part.match(/^\{\{(\w+)\}\}$/);
    if (!m) return part;
    const ing = ingredients.find((i) => i.id === m[1]);
    if (!ing) return 'the ingredient'; // validation prevents this; still never crash
    const e = effective(ing, swaps[ing.id]);
    const amount = e.quantity == null ? '' : amountText(e.quantity, e.unit, base, servings);
    return { id: ing.id, amount, name: e.name, swapped: e.swapped };
  });
}

// Plain-text version of a step: "Beat the 400 g tofu".
export function fillStep(text, ingredients, swaps, base, servings) {
  return stepParts(text, ingredients, swaps, base, servings)
    .map((p) => (typeof p === 'string' ? p : [p.amount, p.name].filter(Boolean).join(' ')))
    .join('');
}

// The ingredient ids a step uses, for cook mode's "you need" list.
export const stepIngredientIds = (text) => [...text.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);

// The whole recipe as text, with the current servings and swaps (for copy / share).
export function recipeToText(recipe, servings, swaps) {
  const base = recipe.baseServings;
  const lines = [`${recipe.emoji} ${recipe.title}`, `Serves ${servings} · ${recipe.prepMinutes + recipe.cookMinutes} min`, '', 'Ingredients'];
  for (const ing of recipe.ingredients) {
    const e = effective(ing, swaps[ing.id]);
    lines.push(`- ${[amountText(e.quantity, e.unit, base, servings), e.name].filter(Boolean).join(' ')}`);
  }
  lines.push('', 'Steps');
  recipe.steps.forEach((s, i) => lines.push(`${i + 1}. ${fillStep(s.text, recipe.ingredients, swaps, base, servings)}`));
  return lines.join('\n');
}

// Optional preference toggles. The server only accepts these ids, so the prompt text is never user-controlled.
export const PREFS = [
  { id: 'quick', emoji: '⚡', label: 'Under 25 min', prompt: 'Total time 25 minutes or less' },
  { id: 'vegetarian', emoji: '🌱', label: 'Vegetarian', prompt: 'Vegetarian: no meat or fish' },
  { id: 'protein', emoji: '💪', label: 'High protein', prompt: 'High in protein' },
  { id: 'spicy', emoji: '🌶️', label: 'Spicy', prompt: 'Noticeably spicy' },
  { id: 'onepan', emoji: '🍳', label: 'One pan', prompt: 'Cooked in a single pan or pot' },
  { id: 'kids', emoji: '🧒', label: 'Kid friendly', prompt: 'Mild and kid friendly' },
];

export const PREF_IDS = PREFS.map((p) => p.id);

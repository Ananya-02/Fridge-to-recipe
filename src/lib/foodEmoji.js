// Decorative only: a matching emoji for an ingredient name. Order matters ("eggplant" before "egg").
const MAP = [
  [/eggplant|aubergine|brinjal/, '🍆'], [/egg/, '🥚'], [/cherry tomato|tomato/, '🍅'],
  [/onion|shallot|scallion/, '🧅'], [/garlic/, '🧄'], [/ginger/, '🫚'],
  [/rice/, '🍚'], [/noodle|ramen|udon/, '🍜'], [/pasta|spaghetti|penne|macaroni|fusilli/, '🍝'],
  [/bread|toast|bun|pita/, '🍞'], [/tortilla|wrap/, '🌮'], [/flour/, '🌾'], [/oat/, '🥣'],
  [/chicken|turkey/, '🍗'], [/bacon|ham|pork/, '🥓'], [/sausage/, '🌭'], [/beef|steak|mince|lamb|mutton/, '🥩'],
  [/shrimp|prawn/, '🦐'], [/crab|lobster/, '🦀'], [/fish|salmon|tuna|cod/, '🐟'],
  [/coconut/, '🥥'], [/peanut|almond|cashew|walnut|nut/, '🥜'], [/butter|ghee/, '🧈'],
  [/cheese|paneer|feta|mozzarella|parmesan|cheddar/, '🧀'], [/milk|cream|yogurt|yoghurt|curd/, '🥛'],
  [/sweet potato/, '🍠'], [/potato/, '🥔'], [/carrot/, '🥕'], [/bell pepper|capsicum/, '🫑'],
  [/chil+i|jalape|cayenne|chile/, '🌶️'], [/mushroom/, '🍄'], [/broccoli|cauliflower/, '🥦'],
  [/spinach|lettuce|kale|cabbage|greens|bok choy/, '🥬'], [/corn/, '🌽'], [/cucumber|zucchini|courgette/, '🥒'],
  [/avocado/, '🥑'], [/lemon|lime/, '🍋'], [/pineapple/, '🍍'], [/apple/, '🍎'], [/banana/, '🍌'],
  [/orange/, '🍊'], [/mango/, '🥭'], [/strawberr|berr/, '🍓'], [/grape/, '🍇'], [/peach/, '🍑'],
  [/bean|chickpea|lentil|dal|tofu|edamame/, '🫘'], [/\bpeas?\b/, '🫛'], [/olive/, '🫒'],
  [/basil|cilantro|coriander|parsley|mint|herb|thyme|rosemary|dill/, '🌿'],
  [/honey|sugar|syrup/, '🍯'], [/chocolate|cocoa/, '🍫'], [/salt|pepper|spice|cumin|turmeric|paprika|masala|curry/, '🧂'],
  [/oil/, '🫗'], [/soy|sauce|vinegar|ketchup|paste/, '🥫'], [/water|stock|broth/, '💧'], [/wine|beer/, '🍷'],
];

export function foodEmoji(name = '') {
  const n = String(name).toLowerCase();
  for (const [re, emoji] of MAP) if (re.test(n)) return emoji;
  return '🥄';
}

// "eggs, two tomatoes; rice" -> ["eggs", "two tomatoes", "rice"]
export const splitIngredients = (text) => text.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);

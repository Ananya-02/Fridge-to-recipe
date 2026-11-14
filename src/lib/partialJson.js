// Best-effort parse of JSON that is still streaming in, so the recipe can appear while it is written.
// Only used for the read-only preview: the final text is always validated with Zod before use.
//
// Idea: close whatever is open (string, objects, arrays) and try JSON.parse. If the text ends in the
// middle of a key or a literal (`"ste`, `tru`), that fails, so fall back to the last comma or opening
// bracket: everything before one of those is complete.
export function parsePartial(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  const s = text.slice(start);

  const closers = []; // what's needed to close each open container, innermost last
  let inString = false;
  let escaped = false;
  let safeEnd = 0; // s.slice(0, safeEnd) + safeClosers is complete JSON
  let safeClosers = '';

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') {
      closers.push(c === '{' ? '}' : ']');
      safeEnd = i + 1;
      safeClosers = [...closers].reverse().join('');
    } else if (c === '}' || c === ']') {
      closers.pop();
      if (closers.length === 0) return tryParse(s.slice(0, i + 1)); // the object is complete
    } else if (c === ',') {
      safeEnd = i;
      safeClosers = [...closers].reverse().join('');
    }
  }

  const closeAll = [...closers].reverse().join('');
  return tryParse(s + (inString ? '"' : '') + closeAll) ?? tryParse(s.slice(0, safeEnd) + safeClosers);
}

function tryParse(t) {
  try {
    return JSON.parse(t);
  } catch {
    return null;
  }
}

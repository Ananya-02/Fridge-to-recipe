// Minimal server-sent events reader for a fetch() response. (EventSource can't send a POST body.)
// The parser is separate from the network so it can be tested with plain strings.
export function createEventParser(onEvent) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.replace(/\r/g, ''); // JSON.stringify escapes \r inside data, so this is safe
    let end;
    while ((end = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      let event = 'message';
      let data = '';
      for (const line of raw.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      let parsed = null;
      try {
        parsed = data ? JSON.parse(data) : {};
      } catch {
        continue; // a garbled event is skipped; the final result is validated anyway
      }
      onEvent(event, parsed);
    }
  };
}

export async function readEvents(body, onEvent) {
  const feed = createEventParser(onEvent);
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return;
    feed(value);
  }
}

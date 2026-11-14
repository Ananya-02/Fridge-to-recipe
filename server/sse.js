// Opens a server-sent events stream to the browser.
// A ping every few seconds lets the client tell "slow model" apart from "dead connection".
export function openStream(res, { pingMs = 5000 } = {}) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // stop proxies like nginx from buffering the stream
  });
  const open = () => !res.writableEnded && !res.destroyed;
  const send = (event, data = {}) => {
    if (open()) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  const ping = setInterval(() => send('ping'), pingMs);
  return {
    send,
    end() {
      clearInterval(ping);
      if (open()) res.end();
    },
  };
}

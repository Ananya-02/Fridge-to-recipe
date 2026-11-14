import { useEffect, useState } from 'react';

const WORDS = ['dinner.', 'brunch.', 'a feast.', 'comfort food.', 'date night.'];

// [emoji, left %, top %, animation delay s] - drifting ingredients over the photo.
const FLOATERS = [
  ['🍅', 5, 22, 0], ['🥑', 90, 16, 1.2], ['🧄', 10, 74, 2.1], ['🍋', 84, 66, 0.6], ['🥕', 48, 6, 1.8],
  ['🌶️', 95, 42, 2.6], ['🧀', 2, 48, 3.1], ['🥚', 70, 86, 0.9], ['🍄', 28, 90, 2.4], ['🫑', 66, 10, 3.4],
];

function Rotator() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((n) => (n + 1) % WORDS.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="rotator" aria-hidden="true">
      <span key={i} className="rotator-word">{WORDS[i]}</span>
    </span>
  );
}

export default function Hero({ compact, children }) {
  return (
    <section className={`hero${compact ? ' hero--compact' : ''}`}>
      <div className="hero-photo" aria-hidden="true" />
      <div className="hero-floaters" aria-hidden="true">
        {FLOATERS.map(([e, x, y, d]) => (
          <span key={e} style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${d}s` }}>{e}</span>
        ))}
      </div>
      <div className="hero-inner">
        <p className="eyebrow"><span className="pulse" /> AI recipe studio · structured, not a chatbot</p>
        <h1>
          Open the fridge.
          <br />
          <span className="h1-get">Get</span> <Rotator />
          <span className="sr">Get dinner.</span>
        </h1>
        <p className="lead">List what you have. Get a recipe you can scale, swap, refine and cook step by step.</p>
        {children}
      </div>
    </section>
  );
}

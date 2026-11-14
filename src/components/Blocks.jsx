import { useState } from 'react';

// The AI chooses which extra blocks to send; each kind gets its own component.
// Unknown kinds never reach here: the schema drops them (see shared/recipeSchema.js).
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

function ChartBlock({ block }) {
  const max = Math.max(...block.items.map((i) => i.value), 1);
  return (
    <figure className="block block-chart">
      <figcaption>{block.title}<span className="muted small"> · estimate</span></figcaption>
      <ul className="bars">
        {block.items.map((it, i) => (
          <li key={i} style={{ '--w': `${(it.value / max) * 100}%`, '--i': i }} title={`${it.label}: ${fmt(it.value)} ${block.unit}`}>
            <span className="bar-label">{it.label}</span>
            <span className="bar-track"><span className="bar-fill" /></span>
            <span className="bar-val">{fmt(it.value)}{block.unit ? ` ${block.unit}` : ''}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function CardBlock({ block }) {
  return (
    <div className="block block-card">
      <span className="block-icon" aria-hidden="true">{block.icon}</span>
      <h4>{block.title}</h4>
      <p>{block.text}</p>
    </div>
  );
}

function ChecklistBlock({ block }) {
  const [done, setDone] = useState([]);
  const toggle = (i) => setDone((d) => (d.includes(i) ? d.filter((x) => x !== i) : [...d, i]));
  return (
    <div className="block block-check">
      <h4>{block.title} <span className="muted small">{done.length}/{block.items.length}</span></h4>
      <ul>
        {block.items.map((item, i) => (
          <li key={i}>
            <label className={done.includes(i) ? 'is-done' : ''}>
              <input type="checkbox" checked={done.includes(i)} onChange={() => toggle(i)} />
              <span>{item}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KINDS = { chart: ChartBlock, card: CardBlock, checklist: ChecklistBlock };

export default function Blocks({ blocks }) {
  return (
    <section className="blocks" aria-label="Extras from the chef">
      {blocks.map((b, i) => {
        const Block = KINDS[b.type];
        return Block ? <div key={i} className="block-wrap" style={{ '--i': i }}><Block block={b} /></div> : null;
      })}
    </section>
  );
}

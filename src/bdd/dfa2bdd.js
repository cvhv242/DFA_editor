// src/bdd/dfa2bdd.js
import BDD from './BDD.js';          // correct relative path & casing

/**
 * Build a BDD for the language accepted by a DFA.
 * @param {Object} dfa  – the DFA JSON your canvas already uses
 * @returns {{root: number, mgr: BDD}}
 */
export default function buildBDD(dfa) {
  const mgr   = new BDD();
  const varOf = new Map();           // "q,a" → var index

  const addVar = key => {
    if (!varOf.has(key)) varOf.set(key, varOf.size);
    return varOf.get(key);
  };

  /* ---------- 1. Transition relation T  ---------- */
  let T = mgr.FALSE;
  for (const e of dfa.links) {
    const [q, q2, labels] = [e.source, e.target, e.label.split(',')];
    for (const a of labels.map(s => s.trim())) {
      const v1   = addVar(`${q},${a}`);
      const v2   = addVar(`${q2},${a}`);
      const cube = mgr.and(
        mgr.mk(v1, mgr.FALSE, mgr.TRUE),
        mgr.mk(v2, mgr.FALSE, mgr.TRUE)
      );
      T = mgr.or(T, cube);
    }
  }

  /* ---------- 2. Accepting predicate S  ---------- */
  let S = mgr.FALSE;
  const symbols = new Set(
    dfa.links.flatMap(l => l.label.split(',').map(s => s.trim()))
  );
  for (const n of dfa.nodes.filter(n => n.isFinal)) {
    for (const a of symbols) {
      S = mgr.or(S, mgr.mk(addVar(`${n.id},${a}`), mgr.FALSE, mgr.TRUE));
    }
  }

  /* ---------- 3. Initial predicate I ------------- */
  const q0 = dfa.nodes.find(n => n.isInitial).id;
  let I = mgr.FALSE;
  for (const a of symbols) {
    I = mgr.or(I, mgr.mk(addVar(`${q0},${a}`), mgr.FALSE, mgr.TRUE));
  }

  /* ---------- 4. Language BDD  ------------------- */
  const root = mgr.and(mgr.and(I, T), S);
  return { root, mgr };
}
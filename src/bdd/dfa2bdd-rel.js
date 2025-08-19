// src/bdd/dfa2bdd-rel.js
import BDD from './BDD.js';

/**
 * Relational BDD builder: encodes a DFA with bit-vectors.
 * Returns { mgr, I, F, T, xBits, aBits, xpBits, encState, encSym, post, acceptsWord }
 */
export default function buildRelBDD(dfa) {
  const mgr = new BDD();

  // --- index states & symbols ------------------------------------
  const states = dfa.nodes.map(n => n.id);
  const idxOfQ = new Map(states.map((q,i) => [q,i]));
  const nQ     = states.length;
  const kQ     = Math.max(1, Math.ceil(Math.log2(nQ)));

  const symbols = [...new Set(
    dfa.links.flatMap(l => (l.label||'').split(',').map(s => s.trim()).filter(Boolean))
  )];
  const idxOfA  = new Map(symbols.map((a,i) => [a,i]));
  const nA      = Math.max(1, symbols.length); // ensure at least 1
  const kA      = Math.max(0, Math.ceil(Math.log2(nA)));

  // --- variable numbering: x[0..kQ-1], a[0..kA-1], x'[0..kQ-1] ----
  const xBits  = Array.from({length:kQ}, (_,i) => i);
  const aBase  = xBits.length;
  const aBits  = Array.from({length:kA}, (_,i) => aBase + i);
  const xpBase = aBase + aBits.length;
  const xpBits = Array.from({length:kQ}, (_,i) => xpBase + i);

  const lit = (v,bit) => mgr.lit ? mgr.lit(v,bit) : (bit ? mgr.mk(v, mgr.FALSE, mgr.TRUE)
                                                         : mgr.mk(v, mgr.TRUE,  mgr.FALSE));

  const codeNumber = (bits, num) => {
    let f = mgr.TRUE;
    for (let i=0; i<bits.length; i++) {
      const b = (num >> i) & 1;
      f = mgr.and(f, lit(bits[i], b));
    }
    return f;
  };

  const encState = qId => codeNumber(xBits, idxOfQ.get(qId));
  const encSym   = a   => kA === 0 ? mgr.TRUE : codeNumber(aBits, idxOfA.get(a));

  const encStatePrime = qId => codeNumber(xpBits, idxOfQ.get(qId));

  // --- T(x,a,x') --------------------------------------------------
  let T = mgr.FALSE;
  for (const e of dfa.links) {
    const from = typeof e.source === 'string' ? e.source : e.source.id;
    const to   = typeof e.target === 'string' ? e.target : e.target.id;
    const labs = (e.label||'').split(',').map(s => s.trim()).filter(Boolean);
    for (const a of labs) {
      const cube = mgr.and(
        mgr.and(encState(from), encSym(a)),
        encStatePrime(to)
      );
      T = mgr.or(T, cube);
    }
  }

  // --- I(x) & F(x) ------------------------------------------------
  const q0 = dfa.nodes.find(n => n.isInitial)?.id;
  const I  = q0 ? encState(q0) : mgr.FALSE;

  let F = mgr.FALSE;
  for (const n of dfa.nodes.filter(n => n.isFinal)) {
    F = mgr.or(F, encState(n.id));
  }

  // --- relational post-image: Post(S)(x') = ∃x,a. S(x) ∧ T(x,a,x') ----
  const XA = new Set([...xBits, ...aBits]);
  const renameXpToX = new Map(xpBits.map((xp,i) => [xp, xBits[i]]));

  const post = (S /* over xBits */) => {
    const conj = mgr.and(S, T);
    const elim = mgr.exists(conj, XA);           // function of x'
    return mgr.rename(elim, renameXpToX);        // back to x
  };

  // --- fixed-word membership -------------------------------------
  // returns BDD over xBits equal to the set of states reachable after reading `word`
  const runWord = (word) => {
    let S = I;
    for (const ch of word) {
      // constrain input to current letter
      const Aeq = encSym(ch);
      const step = mgr.and(S, mgr.and(T, Aeq));
      const elim = mgr.exists(step, XA);
      S = mgr.rename(elim, renameXpToX);
    }
    return S;
  };

  const acceptsWord = (word) => {
    const S = runWord(word);
    const Acc = mgr.and(S, F);
    return Acc !== mgr.FALSE;  // non-emptiness of reachable∩final
  };

  return { mgr, I, F, T, xBits, aBits, xpBits, encState, encSym, post, acceptsWord };
}

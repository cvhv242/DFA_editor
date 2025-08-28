import initialIcon from '../assets/download.png'

export function buildProduct(A, B, op) {
  // 1) Alphabets must match
  const ΣA = new Set(A.links.flatMap(l => (l.label || '').split(',').map(s => s.trim()).filter(Boolean)));
  const ΣB = new Set(B.links.flatMap(l => (l.label || '').split(',').map(s => s.trim()).filter(Boolean)));
  if ([...ΣA].some(a => !ΣB.has(a)) || [...ΣB].some(a => !ΣA.has(a))) {
    throw new Error('Alphabets differ – cannot build product');
  }
  const Σ = [...ΣA];

  // 2) Build transition maps for fast lookup
  const δA = buildMap(A.links);
  const δB = buildMap(B.links);

  const q0A = A.nodes.find(n => n.isInitial)?.id;
  const q0B = B.nodes.find(n => n.isInitial)?.id;
  if (!q0A || !q0B) throw new Error('Both DFAs need an initial state');

  const F_A = new Set(A.nodes.filter(n => n.isFinal).map(n => n.id));
  const F_B = new Set(B.nodes.filter(n => n.isFinal).map(n => n.id));

  // 3) BFS over reachable product states only
  const nodes = new Map();  // id -> node
  const links = [];
  const startId = `${q0A}|${q0B}`;

  nodes.set(startId, {
    id: startId,
    isInitial: true,
    isFinal: op === '∩' ? (F_A.has(q0A) && F_B.has(q0B)) : (F_A.has(q0A) || F_B.has(q0B)),
    shape: 'image',
    imageUrl: initialIcon,
  });

  const q = [startId];

  while (q.length) {
    const id = q.shift();
    const [p, qB] = id.split('|');

    for (const a of Σ) {
      const toP = δA[p]?.[a];
      const toQ = δB[qB]?.[a];
      // If inputs are supposed to be total, missing means the input DFA is broken.
      if (toP == null || toQ == null) {
        throw new Error(`Non-total input DFA: missing transition on "${a}" from ${toP == null ? p : qB}`);
      }

      const tid = `${toP}|${toQ}`;
      if (!nodes.has(tid)) {
        nodes.set(tid, {
          id: tid,
          isInitial: false,
          isFinal: op === '∩' ? (F_A.has(toP) && F_B.has(toQ)) : (F_A.has(toP) || F_B.has(toQ)),
        });
        q.push(tid);
      }
      links.push({ source: id, target: tid, label: a });
    }
  }

  return { nodes: [...nodes.values()], links };
}

function buildMap(links) {
  const δ = {};
  links.forEach(l => {
    const src = typeof l.source === 'string' ? l.source : l.source?.id;
    const tgt = typeof l.target === 'string' ? l.target : l.target?.id;
    (l.label || '').split(',')
      .map(s => s.trim())
      .filter(Boolean)
      .forEach(a => {
        δ[src] ??= {};
        δ[src][a] = tgt;
      });
  });
  return δ;
}

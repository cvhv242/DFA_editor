import initialIcon from '../assets/download.png'

export function buildProduct(A, B, op) {
  // 1) alphabet – assume every link label already split by commas
  const ΣA = new Set(A.links.flatMap(l => l.label.split(',').map(s=>s.trim())));
  const ΣB = new Set(B.links.flatMap(l => l.label.split(',').map(s=>s.trim())));
  if ([...ΣA].some(a => !ΣB.has(a)) || [...ΣB].some(a => !ΣA.has(a))) {
    throw new Error('Alphabets differ – cannot build product');
  }

  // 2) quick lookup tables
  const δA = buildMap(A.links);
  const δB = buildMap(B.links);
  const q0A = A.nodes.find(n => n.isInitial).id;
  const q0B = B.nodes.find(n => n.isInitial).id;
  const F_A = new Set(A.nodes.filter(n => n.isFinal).map(n => n.id));
  const F_B = new Set(B.nodes.filter(n => n.isFinal).map(n => n.id));

  // 3) FULL cartesian product |Q_A| × |Q_B|
  const Q     = new Map();
  const links = [];

  A.nodes.forEach(pNode => {
    B.nodes.forEach(qNode => {
      const p = pNode.id;
      const q = qNode.id;
      const id = `${p}|${q}`;

      const isFinal = op === '∩'
        ? (F_A.has(p) && F_B.has(q))
        : (F_A.has(p) || F_B.has(q));

      Q.set(id, { id, isInitial:false, isFinal });

      ΣA.forEach(a => {
        const toP = δA[p]?.[a];
        const toQ = δB[q]?.[a];
        if (!toP || !toQ) return;           // DFA should be total
        links.push({
          source: id,
          target: `${toP}|${toQ}`,
          label:  a
        });
      });
    });
  });

  // 4) mark product initial
  const first = Q.get(`${q0A}|${q0B}`);
  first.isInitial = true;
  first.shape     = 'image';
  first.imageUrl  = initialIcon;

  return { nodes:[...Q.values()], links };
}

function buildMap(links) {
  const δ = {};
  links.forEach(l => {
    const src = typeof l.source === 'string' ? l.source : l.source.id;
    const tgt = typeof l.target === 'string' ? l.target : l.target.id;
    l.label.split(',').forEach(a => {
      δ[src] ??= {};
      δ[src][a.trim()] = tgt;
    });
  });
  return δ;
}

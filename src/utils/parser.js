/**
 * Parses raw transition input into graph data,
 * returns { nodes, links, errors }.
 */
export function parseInput(raw) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const usedLabels = new Map();
  const linkGroups = new Map();
  let initialState = null;
  const errors = [];

  lines.forEach((line, idx) => {
    const [rawSource, target, label] = line.split(/\s+/) || [];
    if (!rawSource || !target || !label) {
      errors.push(`Line ${idx+1}: must be "from to label"`);
      return;
    }
    const source = rawSource.replace(/^>/, '');
    if (rawSource.startsWith('>')) initialState = source;

    // Duplicate check
    if (!usedLabels.has(source)) usedLabels.set(source, new Set());
    const srcLabels = usedLabels.get(source);
    if (srcLabels.has(label)) {
      errors.push(`Line ${idx+1}: duplicate label "${label}" on state "${source}"`);
      return;
    }
    srcLabels.add(label);

    // Group transitions
    const key = `${source}|${target}`;
    if (!linkGroups.has(key)) linkGroups.set(key, new Set());
    linkGroups.get(key).add(label);
  });

  // Build merged links
  const links = [];
  for (let [key, labelsSet] of linkGroups) {
    const [src, tgt] = key.split('|');
    links.push({ source: src, target: tgt, label: [...labelsSet].join(',') });
  }

  // Build nodes
  const nodeMap = new Map()

  // Collect all node IDs from links
  links.forEach(link => {
    [link.source, link.target].forEach(id => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          shape: 'circle',
          imageUrl: null,
          isInitial: false
        })
      }
    })
  })

  // Update initial state node to use a special image
  if (initialState && nodeMap.has(initialState)) {
    const initNode = nodeMap.get(initialState)
    initNode.shape = 'image'
    initNode.imageUrl = '/public/download.png'
    initNode.isInitial = true;
  } 

  const nodes = Array.from(nodeMap.values())

  return { nodes, links, errors };
}

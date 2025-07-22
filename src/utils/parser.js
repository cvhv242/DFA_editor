import { line } from "d3";

/**
 * Commands:
 * $from_state to_state input: add new transition between from_state and to_state with label input.
 * $chin from_state new_state: changes initial state from from_state to to_state 
 */
export function parseInput(raw, prev = { nodes: [], links: [] }) {
  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);

  const usedLabels = new Map();
  const linkGroups = new Map();
  const createdNodes = new Map();
  let initialState = null;
  const errors = [];

  lines.forEach((line, idx) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts[1].toLowerCase();

    // Handle changeinitial command
    switch(cmd) {
      case 'cnode': {
        if(!args) {
          return { ...prev, errors: ['Usage: cnode [>]?<id>[, [>]?<id>…]'] };
        }
        const rawIds = args.split(',').map(s => s.trim()).filter(Boolean);
        const initialCount = rawIds.filter(s => s.startsWith('>')).length;
        if (initialCount>1) {
          errors.push('Only one initial node may be marked with “>”.')
        } else {
          rawIds.forEach(raw => {
            const isInitial = raw.startsWith('>');
            const id = isInitial ? raw.slice(1) : raw;
            const exists = prev.nodes.some(n=>n.id===id) || createdNodes.has(id);
            if(exists) {
              errors.push(`Node "${id}" already exists`)
            } else {
              createdNodes.set(id,{
                id,
                shape: isInitial ? 'image' : 'circle',
                imageUrl: isInitial ? '/public/download.png' : null,
                isInitial,
                isFinal:false
              })
              if (isInitial) initialState = id;
            }
          })
        }
        return;
      }
      case 'chin': 
        if (parts.length !== 3) {
          errors.push(
            `Invalid changeinitial syntax; expected "chin CURRENT_INITIAL_STATE NEW_INITIAL_STATE"`
          );
        } else {
          const [, oldState, newState] = parts;
          if (initialState !== oldState && initialState!==null) {
            errors.push(
              `Cannot change initial from "${oldState}" because current initial is "${initialState}"`
            );
          } else {
            initialState = newState;
          }
        }
        return;
      case 'final': {
        return;
      }
      default:
        break;
    }

    const [rawSource, target, label] = line.split(/\s+/) || [];
    if (!rawSource || !target || !label) {
      errors.push(`Input must be "from_state to_state label"`);
      return;
    }
    const source = rawSource.replace(/^>/, '');
    if (rawSource.startsWith('>')) {
      if (initialState === null || initialState === source)  initialState = source
      else errors.push(`Multiple Initial states detected: "${initialState}" already set as initial state`)
    }

    // Duplicate check
    if (!usedLabels.has(source)) usedLabels.set(source, new Set());
    const srcLabels = usedLabels.get(source);
    if (srcLabels.has(label)) {
      errors.push(`Line ${idx+1}: duplicate label "${label}" from state "${source}"`);
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
  prev.nodes.forEach(n => nodeMap.set(n.id, { ...n }));
  createdNodes.forEach(n => nodeMap.set(n.id, n));

  // Collect all node IDs from links
  links.forEach(link => {
    [link.source, link.target].forEach(id => {
      if (!nodeMap.has(id)) {
        nodeMap.set(id, {
          id,
          shape: 'circle',
          imageUrl: null,
          isInitial: false,
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

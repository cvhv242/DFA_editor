import { line } from "d3";

/**
 * Commands:
 * $from_state to_state input: add new transition between from_state and to_state with label input.
 * $pinall: pins all the nodes into their current places 
 * $unpinall: unpins all nodes into free movement
 * $reset: clears the console and canvas data
 * $initial state_name: changes initial state_name from regular to initial state 
 * $cnode s1,>s2,s3,..: creates new nodes s1, s2, s3 ... and makes s2 an initial state
 * $dnode s1,s2,s3,..: deletes nodes s1, s2, s3 ...
 * $final s1,s2,s3,..: makes nodes s1, s2, s3 ... final states
 * $unfinal s1,s2,s3,..: makes final states s1, s2, s3 ... non-final states
 * $dtrans s1 s2: Deletes all transitions from s1 to s2
 * $dtrans s1 s2: Deletes only the transitions from s1 to s2 with 
 */
export function parseInput(raw, prev = { nodes: [], links: [], complementCount: 0}) {

  const lines = raw.trim().split('\n').map(l => l.trim()).filter(Boolean);

  const usedLabels = new Map();
  const linkGroups = new Map();
  const createdNodes = new Map();
  const deletedAt = new Map();
  const mentionedNodes = new Set();

  let initialState = null;
  const errors = [];  


  lines.forEach((line, idx) => {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts[1]?.toLowerCase().trim();

    switch(cmd) {
      case 'cnode': {
        if (!args) {
          return { ...prev, errors: ['Usage: cnode [>]?<id>[, [>]?<id>…]'] };
        }
        const rawIds = args.split(',').map(s => s.trim()).filter(Boolean);
        const initialCount = rawIds.filter(s => s.startsWith('>')).length;
        if (initialCount > 1) {
          errors.push('Only one initial node may be marked with “>”.');
        } else {
          rawIds.forEach(raw => {
            const isInitial = raw.startsWith('>');
            const id = isInitial ? raw.slice(1) : raw;
            const wasDeleted = deletedAt.has(id);
            const exists = (!wasDeleted && (prev.nodes.some(n => n.id === id) || createdNodes.has(id)));
            if (exists) {
              
              if (isInitial) {
                const n = createdNodes.get(id) || prev.nodes.find(p => p.id === id);
                if (n) n.isInitial = true;
                initialState = id; 
              } 
              return
            } else {
              if (wasDeleted) deletedAt.delete(id);
              createdNodes.set(id, {
                id,
                shape: isInitial ? 'image' : 'circle',
                imageUrl: isInitial ? '/public/download.png' : null,
                isInitial,
                isFinal: false
              });
              if (isInitial) initialState = id;
            }
          });
        }
        return;
      }
      case 'dnode': {
        if (!args) {
          errors.push('Usage: dnode <id>[,<id>…]');
        } else {
          const ids = args.split(',').map(s => s.trim()).filter(Boolean);
          ids.forEach(id => {
            const exists = prev.nodes.some(n => n.id === id)
              || createdNodes.has(id)
              || Array.from(linkGroups.keys()).some(key => {
                const [s, t] = key.split('|');
                return s === id || t === id;
              });
            if (exists) {
              deletedAt.set(id, idx);

              if (usedLabels.has(id)) {
                usedLabels.delete(id);
              }

              const keysToDelete = [];
              for (let [key, group] of linkGroups.entries()) {
                const [s, t] = key.split('|');
                if (s === id || t === id) {
                  if (usedLabels.has(s)) {
                    const srcLabels = usedLabels.get(s);
                    for (let l of group) {
                      srcLabels.delete(l);
                    }
                  }
                  keysToDelete.push(key);
                }
              }
              keysToDelete.forEach(k => linkGroups.delete(k));

              if (initialState === id) initialState = null;
            } else {
              errors.push(`Cannot delete "${id}" – node does not exist`);
            }
          });
        }
        return;
      }
      case 'initial': {
        if (parts.length !== 2) {
          errors.push(`Invalid syntax; expected "initial NEW_INITIAL_STATE"`);
        } else {
          const newInitial = parts[1];
          if (deletedAt.has(newInitial)) {
            errors.push(`Cannot set "${newInitial}" as initial — node was deleted`);
          } else {

            const existingNode = createdNodes.get(newInitial) || prev.nodes.find(n => n.id === newInitial);

            if(!existingNode) {
              errors.push(`State "${newInitial}" does not exist`);
              return;
            }

            if (existingNode?.isFinal) {
              errors.push(`Cannot set final "${newInitial}" as initial`);
              return;
            }
            prev.nodes.forEach(n => {
              if (n.isInitial && n.id !== newInitial) {
                createdNodes.set(n.id, { ...n, isInitial: false })
              }
            })
            
            initialState = newInitial;
          }
        }
        return;
      }
      case 'final': {
        if (!args) {
          errors.push('Usage: final <id>[,<id>…]');
        } else {
          const ids = args.split(',').map(s => s.trim()).filter(Boolean);
          ids.forEach(id => {
            if (deletedAt.has(id)) {
              errors.push(`Cannot mark "${id}" as final — node was deleted`);
            } else {
              const node = createdNodes.get(id) || prev.nodes.find(n => n.id === id);
              const isMentioned = mentionedNodes.has(id)

              const effectiveInitial = (initialState === id);
              if (!node && !isMentioned) {
                errors.push(`Cannot mark "${id}" as final — node does not exist`);
                return;
              }
              const currentNode = node ?? {
                id,
                shape: 'circle',
                imageUrl: null,
                isInitial: effectiveInitial,
                isFinal: false
              }

              
              if (effectiveInitial) {
                errors.push(`Cannot mark initial node "${id}" as final`);
                return;
              }

              if (currentNode?.isFinal) return;

              const newNode = { ...currentNode, isFinal: true };
              createdNodes.set(id, newNode);
              
            }
          });
        }
        return;
      }
      case 'unfinal': {
        if (!args) {
          errors.push('Usage: unfinal <id>[,<id>…]');
        } else {
          const ids = args.split(',').map(s => s.trim()).filter(Boolean);
          ids.forEach(id => {
            if (deletedAt.has(id)) {
              errors.push(`Cannot mark "${id}" as non-final — node was deleted`);
            } else {
              const node = createdNodes.get(id) || prev.nodes.find(n => n.id === id);
              const isMentioned = mentionedNodes.has(id)

              const effectiveInitial = (initialState === id);
              if (!node && !isMentioned) {
                errors.push(`Cannot mark "${id}" as non-final — node does not exist`);
                return;
              }
              const currentNode = node ?? {
                id,
                shape: 'circle',
                imageUrl: null,
                isInitial: effectiveInitial,
                isFinal: false
              }

              
              if (effectiveInitial) {
                errors.push(`Cannot mark initial node "${id}" as non-final`);
                return;
              }

              if (!currentNode?.isFinal)  return;

              const newNode = { ...currentNode, isFinal: false };
              createdNodes.set(id, newNode);
              
            }
          });
        }
        return;
      }
      case 'dtrans': {
        const parts = line.trim().split(/\s+/);
        const [_, from, to, label] = parts;

        if (!from || !to) {
          errors.push('Usage: dtrans <from> <to> [label]');
          return;
        }

        const key = `${from}|${to}`;
        if (!linkGroups.has(key)) {
          errors.push(`No edge from "${from}" to "${to}" exists.`);
          return;
        }

        if (!label) {
          // Delete entire edge
          const deletedLabels = linkGroups.get(key);
          linkGroups.delete(key);
          deletedLabels.forEach(lbl => {
            usedLabels.get(from)?.delete(lbl);
          });
        } else {
          // Delete only that label
          const group = linkGroups.get(key);
          if (!group.has(label)) {
            errors.push(`Label "${label}" does not exist on edge from "${from}" to "${to}".`);
          } else {
            group.delete(label);
            usedLabels.get(from)?.delete(label);
            if (group.size === 0) linkGroups.delete(key);
          }
        }

        return;
      }
      case 'chtrans': {
        const parts = line.trim().split(/\s+/);
        const [_, from, to, labelStr] = parts;
        if (!from || !to || !labelStr) {
          errors.push('Usage: chtrans <from> <to> <label1,label2,...>');
          return;
        }

        const key = `${from}|${to}`;
        if (!linkGroups.has(key)) {
          errors.push(`No edge from "${from}" to "${to}" exists.`);
          return;
        }

        const labels = labelStr.split(',').map(l => l.trim()).filter(Boolean);
        const srcLabels = usedLabels.get(from) || new Set();

        // Check for DFA non-determinism
        for (const lab of labels) {
          for (const otherKey of linkGroups.keys()) {
            if (otherKey.startsWith(from + '|') && otherKey !== key) {
              if (linkGroups.get(otherKey).has(lab)) {
                errors.push(`Changing transition would violate determinism: "${from}" already has "${lab}" transition`);
              }
            }
          }
        }

        // Clear old labels
        const group = linkGroups.get(key);
        group.forEach(lbl => srcLabels.delete(lbl));
        group.clear();

        // Add new labels
        for (const lab of labels) {
          group.add(lab);
          srcLabels.add(lab);
        }
        return;
      }
    }

    const [rawSource, target, labelsString] = line.split(/\s+/) || [];
    if (!rawSource || !target || !labelsString) {
      errors.push(`Input must be "from_state to_state label1,label2,..."`);
      return;
    }

    const source = rawSource.replace(/^>/, '');
    mentionedNodes.add(source);
    mentionedNodes.add(target);

    if (deletedAt.get(source) !== undefined && deletedAt.get(source) < idx) {
      deletedAt.delete(source);
    }
    if (deletedAt.get(target) !== undefined && deletedAt.get(target) < idx) {
      deletedAt.delete(target);
    }

    if (rawSource.startsWith('>')) {
      if (deletedAt.has(source)) {
        errors.push(`Cannot assign "${source}" as initial — node was previously deleted`);
      } else if (initialState === null || initialState === source) {
        initialState = source;
      } else {
        errors.push(`Multiple Initial states detected: "${initialState}" already set as initial state`);
      }
    }

    if (!usedLabels.has(source)) usedLabels.set(source, new Set());
    const srcLabels = usedLabels.get(source);
    const key = `${source}|${target}`;
    if (!linkGroups.has(key)) linkGroups.set(key, new Set());
    const group = linkGroups.get(key);
    
    const labels = labelsString.split(',').map(l => l.trim()).filter(Boolean);
    const seen = new Set();
    labels.forEach(lab => {
      if (seen.has(lab)) {
        errors.push(`Line ${idx + 1}: duplicate label "${lab}" in transition from "${source}" to "${target}"`);
        return;
      }
      seen.add(lab);

      if (group.has(lab)) {
        errors.push(`Duplicate label "${lab}" already exists on transition from "${source}" to "${target}"`);
        return;
      }

      if (srcLabels.has(lab)) {
        errors.push(`Duplicate input "${lab}" from state "${source}" (DFA requires determinism)`);
        return;
      }

      group.add(lab);
      srcLabels.add(lab);
    });

  });

  // Build merged links
  const links = [];
  for (let [key, labelsSet] of linkGroups) {
    const [src, tgt] = key.split('|');
    if (deletedAt.has(src) || deletedAt.has(tgt)) continue;
    links.push({ source: src, target: tgt, label: [...labelsSet].join(',') });
  }

  // Build nodes
  const nodeMap = new Map();
  prev.nodes
    .filter(n => !deletedAt.has(n.id))
     .forEach(n => nodeMap.set(n.id, { ...n }))
  createdNodes.forEach(n => {
    if (!deletedAt.has(n.id)) nodeMap.set(n.id, n);
  });

  // Add any mentioned but undeclared nodes
  mentionedNodes.forEach(id => {
    if (!deletedAt.has(id) && !nodeMap.has(id)) {
      nodeMap.set(id, {
        id,
        shape: 'circle',
        imageUrl: null,
        isInitial: false,
        isFinal: false
      });
    }
  });

  for (const node of nodeMap.values()) {
    if (node.isInitial) {
      node.isInitial = false;
      node.shape = 'circle';
      node.imageUrl = null;
      node.fx = null;
      node.fy = null;
    }
  }

  // Mark initial state if it exists
  for (const n of nodeMap.values()) {
    if (n.id === initialState && !deletedAt.has(n.id)) {
      n.isInitial = true;
      n.shape     = 'image';
      n.imageUrl  = '/download.png';
    } else {
      n.isInitial = false;
      n.shape     = 'circle';
      n.imageUrl  = null;
   }
  }
  
  const reminders = [];
  if (!Array.from(nodeMap.values()).some(n => n.isInitial)) {
    reminders.push(`DFA requires one initial state, but none is defined.`);
  }

  const allLabels = [...new Set(
    links.flatMap(l => (l.label || '').split(',').map(lbl => lbl.trim()).filter(Boolean))
  )];

  const labelMatrix = new Map();
  links.forEach(link => {
    const labelList = (link.label || '').split(',').map(lbl => lbl.trim()).filter(Boolean);
    labelList.forEach(lbl => {
      if (!labelMatrix.has(link.source)) labelMatrix.set(link.source, new Set());
      labelMatrix.get(link.source).add(lbl);
    });
  });

  for (const node of nodeMap.values()) {
    const outgoing = labelMatrix.get(node.id) || new Set();
    for (const lbl of allLabels) {
      if (!outgoing.has(lbl)) {
        reminders.push(`Node "${node.id}" is missing transition for label "${lbl}" (DFA requires totality)`);
      }
    }
  }

  createdNodes.clear(); // 🧼 cleanup to prevent pollution of future parse
  return { nodes: Array.from(nodeMap.values()), links, errors, reminders };
}

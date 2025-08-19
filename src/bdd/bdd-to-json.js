// bdd-to-json.js
import BDD from "./BDD.js";

/**
 * @param {number} root      – id of the BDD root
 * @param {BDD}    mgr       – the manager that owns the nodes[]
 * @returns {{nodes, links}} – ready for GraphCanvas
 */
export default function bddToJson(root, mgr) {
  const lvlGap = 120, colGap = 90;        // visual spacing only
  const byVar  = new Map();               // var → all node ids on that var
  const walk = (id) => {
    if (id <= 1 || byVar.has(id)) return;
    const { var:v, lo, hi } = mgr.nodes[id];
    if (!byVar.has(v)) byVar.set(v, []);
    byVar.get(v).push(id);
    walk(lo); walk(hi);
  };
  walk(root);

  // deterministic x,y for a tidy “layered” drawing
  const nodes = [];
  for (const [v, ids] of [...byVar.entries()].sort((a,b)=>a[0]-b[0])) {
    ids.forEach((id,i) =>
      nodes.push({ id:`n${id}`, label:`x${v}`, x: colGap*i, y: lvlGap*v }));
  }
  nodes.push({ id:'0', label:'0', x:-colGap*2, y:lvlGap*(byVar.size+1), shape:'box'});
  nodes.push({ id:'1', label:'1', x:0,         y:lvlGap*(byVar.size+1), shape:'box'});

  const links = [];
  nodes.forEach(n => {
    const src = parseInt(n.id.slice(1));   // skip 'n'
    if (isNaN(src)) return;                // constants
    const { lo, hi } = mgr.nodes[src];
    links.push({ source:`n${src}`, target: lo<=1?`${lo}`:`n${lo}`, style:'dashed' });
    links.push({ source:`n${src}`, target: hi<=1?`${hi}`:`n${hi}`,   style:'solid'  });
  });
  return { nodes, links };
};

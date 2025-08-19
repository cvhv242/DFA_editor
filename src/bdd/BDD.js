// bdd.js  –  ≈120 lines
class BDD {
  constructor() {
    this.nodes   = [];                     // {var, lo, hi}
    this.unique  = new Map();              // "var,lo,hi" ➜ id
    this.cache   = new Map();              // "op,f,g"     ➜ id
    this.FALSE   = this.mkConst(false);    // id 0
    this.TRUE    = this.mkConst(true);     // id 1
  }

  mkConst(bit) {                 // constants get ids 0 / 1
    const id = this.nodes.length;
    this.nodes.push({ var: Number.POSITIVE_INFINITY, lo: id, hi: id, bit });
    return id;
  }

  mk(varIndex, lo, hi) {         // reduction rule
    if (lo === hi) return lo;
    const key = `${varIndex},${lo},${hi}`;
    if (this.unique.has(key)) return this.unique.get(key);
    const id = this.nodes.length;
    this.unique.set(key, id);
    this.nodes.push({ var: varIndex, lo, hi });
    return id;
  }

  ite(f, g, h) {                 // Shannon expansion core
    if (g === h) return g;
    if (f === this.TRUE)  return g;
    if (f === this.FALSE) return h;
    const key = `I,${f},${g},${h}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const v  = Math.min(this.nodes[f].var, this.nodes[g].var, this.nodes[h].var)
    const f0 = this.low(f, v), f1 = this.high(f, v);
    const g0 = this.low(g, v), g1 = this.high(g, v);
    const h0 = this.low(h, v), h1 = this.high(h, v);

    const t  = this.ite(f1, g1, h1);
    const e  = this.ite(f0, g0, h0);
    const r  = this.mk(v, e, t);
    this.cache.set(key, r);
    return r;
  }

  // helpers ----------

  low(id, v)  { return this.nodes[id].var === v ? this.nodes[id].lo : id; }
  high(id, v) { return this.nodes[id].var === v ? this.nodes[id].hi : id; }

  and(f, g)   { return this.ite(f, g, this.FALSE); }
  or (f, g)   { return this.ite(f, this.TRUE, g); }
  not(f)      { return this.ite(f, this.FALSE, this.TRUE); }

  // --- Quantification & renaming ------------------------------------
  exists(f, vars) {                         // vars: Set<number> of var indices
    const key = `E,${f},${[...vars].sort().join(',')}`;
    if (this.cache.has(key)) return this.cache.get(key);
    let res;
    if (f <= 1) {
      res = f;                              // constants
    } else {
      const { var:v, lo, hi } = this.nodes[f];
      const loE = this.exists(lo, vars);
      const hiE = this.exists(hi, vars);
      if (vars.has(v)) {
        // ∃v. f = (f|v=0) ∨ (f|v=1)
        res = this.or(loE, hiE);
      } else {
        res = this.mk(v, loE, hiE);
      }
    }
    this.cache.set(key, res);
    return res;
  }

  // mapping: Map<number, number>  (oldVar → newVar)
  rename(f, mapping) {
    if (f <= 1) return f;
    // NB: mapping identity is not tracked; good enough for CLI scale.
    const mapStr = [...mapping.entries()].map(([a,b]) => `${a}:${b}`).join('|');
    const key = `R,${f},${mapStr}`;
    if (this.cache.has(key)) return this.cache.get(key);

    const { var:v, lo, hi } = this.nodes[f];
    const lo2 = this.rename(lo, mapping);
    const hi2 = this.rename(hi, mapping);
    const v2  = mapping.has(v) ? mapping.get(v) : v;
    const res = this.mk(v2, lo2, hi2);
    this.cache.set(key, res);
    return res;
  }

  // tiny literal helpers (optional)
  lit(v, bit) { return bit ? this.mk(v, this.FALSE, this.TRUE)
                          : this.mk(v, this.TRUE,  this.FALSE); }


  // ---- GraphViz dump
  toDot(root) {
    let dot = "digraph BDD{\n  rankdir=TB;\n";
    const seen = new Set();
    const dfs = id => {
      if (seen.has(id) || id == null || this.nodes[id] == null) return;
      seen.add(id);
      const { var: v, lo, hi } = this.nodes[id];
      dot += `  ${id} [label="x${v}"];\n`;
      dot += `  ${id} -> ${lo} [style=dashed];\n`;
      dot += `  ${id} -> ${hi} [style=solid];\n`;
      dfs(lo); dfs(hi);
    };
    dot += `  0 [shape=box,label="0"];  1 [shape=box,label="1"];\n`;
    dfs(root);
    return dot + "}\n";
  }
}
export default BDD;

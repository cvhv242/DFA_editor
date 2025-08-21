import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function GraphCanvas({ graphData, viewMode }) {
  const svgRef = useRef()
  useEffect(() => {
    const tooltip = d3.select('body')
      .append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('padding', '6px 8px')
      .style('background', 'black')
      .style('color', 'white')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('pointer-events', 'none')
      .style('opacity', 0)
    return () => tooltip.remove()
  }, [])

  const lastTransform = useRef(d3.zoomIdentity)

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.2, 4])
      .on('zoom', zoomed)
    svg.call(zoomBehavior)
      // .on('dblclick.zoom', null)
    const content = svg.append('g').attr('class','zoomable').attr('transform', lastTransform.current)

    if (!graphData || graphData.nodes.length === 0) {
      lastTransform.current = d3.zoomIdentity
      svg.call(zoomBehavior.transform, lastTransform.current)
      svg.selectAll('*').remove()
      return
    }
    

    const width = svgRef.current?.clientWidth || 800
    const height = svgRef.current?.clientHeight || 500
    const isBDD = viewMode === 'bdd';

    const nodes = graphData.nodes.map(n => ({
      ...n,
      fx: n.fx ?? undefined,
      fy: n.fy ?? undefined
    }))
    const links = graphData.links

    const r = 20
    const loopR = r-5
    const arrowlen = 10

    // ✅ Resolve source/target references from node IDs
    links.forEach(link => {
      const srcId = typeof link.source === 'string'
                  ? link.source
                  : link.source.id;           // ← object → id
      const tgtId = typeof link.target === 'string'
                  ? link.target
                  : link.target.id;

      link.source = nodes.find(n => n.id === srcId);
      link.target = nodes.find(n => n.id === tgtId);
    })

    const visibleNodes = nodes.filter(n => !n.invisible)

    const initialNode = visibleNodes.find(n => n.isInitial)
    if (initialNode && (initialNode.fx == null || initialNode.fy == null)) {
      initialNode.fx = 100   // x-position fixed to left side
      initialNode.fy = height / 2  // centered vertically
    }

    nodes.forEach(n => {
      if (n.fx === null) delete n.fx;
      if (n.fy === null) delete n.fy;
    });

    // If BDD: do a simple layered layout and pin nodes (no forces).
    if (isBDD) {
      layoutBdd(nodes, links, width, height);    // function added below
      nodes.forEach(n => {
        n.fx = n.x; n.fy = n.y; n.isPinned = true;
      });
    }

    // Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collision', d3.forceCollide().radius(r*2))
      .force('link', d3.forceLink(links).id(d => d.id).distance(150).strength(1))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .alphaDecay(0.005)
      .velocityDecay(0.3)
    
    if(isBDD) {
      simulation.stop();
    }


    // Arrowheads definition
    const defs = svg.append('defs')
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', r+arrowlen)
      .attr('refY', 0)
      .attr('markerWidth', arrowlen)
      .attr('markerHeight', arrowlen)
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#000')

    defs.append('marker')
      .attr('id', 'arrowLoop')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', r-arrowlen)               // use the same loop radius
      .attr('refY', 0)
      .attr('markerWidth', arrowlen)
      .attr('markerHeight', arrowlen)
      .attr('markerUnits', 'userSpaceOnUse')
      .attr('orient', 'auto')
      .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', '#000');

    // Link paths
    const linkG = content.append('g')
    const linkPaths = linkG.selectAll('path')
      .data(links)
      .enter()
      .append('path')
        .attr('id', (d, i) => `linkPath-${i}`)
        .attr('class', isBDD ? 'link bdd' : 'link')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .attr('fill', 'none')
        .attr('marker-end', d =>
          d.source.id === d.target.id ? 'url(#arrowLoop)' : 'url(#arrow)')
        linkPaths
        .attr('stroke-dasharray', d => d.style === 'dashed' ? '4 3' : null);
    const labelG = content.append('g')
    const edgeLabels = labelG.selectAll('text')
      .data(links)
      .enter()
      .append('text')
        .attr('class', 'edge-label')
        .attr('text-anchor', 'middle')
        .attr('dy', -2)  
        .attr('stroke', '#fff')            // white outline
        .attr('stroke-width', 1)           // outline thickness
        .attr('paint-order', 'stroke') 
        .text(d => d.label)
      .merge(linkPaths)


    // Nodes
    const BOX_W = 64;
    const BOX_H = 36;
    const w = BOX_W / 2;         
    const h = BOX_H;


    const nodeG = content.append('g')
    const node = nodeG.selectAll('g')
      .data(visibleNodes)
      .enter()
      .append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      )
      .on('click', function (_, d) {
        if(d.isInitial) return
        d.isPinned = !d.isPinned
        if (d.isPinned) {
          d.fx = d.x
          d.fy = d.y
        } else {
          d.fx = null
          d.fy = null
        }
        const shapeSel = d3.select(this).select(d.shape === 'box' ? 'rect' : 'circle');
        shapeSel
          .attr('stroke', d.isPinned ? '#000' : '#444')
          .attr('stroke-width', d.isPinned ? 2 : 1);
      })

    node.each(function (d) {
      const g = d3.select(this)
      if (d.shape === 'image' && d.imageUrl) {
        g.append('image')
          .attr('href', d.imageUrl)
          .attr('x', -30)
          .attr('y', -30)
          .attr('width', 55)
          .attr('height', 55)
          .attr('fill', '#fff')
      } else if(d.shape === 'box') {
        g.append('rect')
          .attr('x', -w / 2)
          .attr('y', -h / 2)
          .attr('width', w)
          .attr('height', h)
          .attr('rx', 0)
          .attr('ry', 0)
          .attr('fill', '#fff')
          .attr('stroke', d.isPinned ? '#000' : '#444')
          .attr('stroke-width', d.isPinned ? 2 : 1);
      } else {
        g.append('circle')
          .attr('r', 20)
          .attr('fill', '#fff')
          .attr('stroke', d.isPinned ? '#000' : '#444')
          .attr('stroke-width', d.isPinned ? 2 : 1);

        if (d.isFinal) {
          g.append('circle')
            .attr('r', 24)
            .attr('fill', 'none')
            .attr('stroke', '#000')
            .attr('stroke-width', 1.5);
        }

      }
    })

    node.append('text')
      .attr('dy', 5)
      .attr('y', d => d.shape === 'image' ? -3 : 0)
      .attr('x', d => d.shape === 'image' ? 3 : 0)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#000')
      .attr('stroke', '#fff')            // white outline
      .attr('stroke-width', 1)           // outline thickness
      .attr('paint-order', 'stroke') 
      .text(d => d.label ?? d.id)
    
    node.selectAll('circle, rect')
      .attr('stroke', d => d.isPinned ? '#000' : '#444')
      .attr('stroke-width', d => d.isPinned ? 2 : 1);

    const tooltip = d3.select('body').select('div.tooltip')
    
    node.on('mouseover', function (event, d) {
    if (d.isPinned) {
      tooltip
        .style('opacity', 0.5)
        .html('Pinned')
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 20) + 'px')
    }
    })

    node.on('mousemove', function (event) {
      tooltip
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 20) + 'px')
    })

    node.on('mouseout', function () {
      tooltip.style('opacity', 0)
    })

  

    function ticked() {
      linkPaths.attr('d', d => {
        if (!d.source || !d.target) return ''
        if (!isBDD && d.source.id === d.target.id) {
          // Self-loop
          const x = d.source.x
          const y = d.source.y
          return `M${x},${y - loopR} A${loopR},${loopR} 0 1,1 ${x + 0.1},${y - loopR}`
        }

        if (isBDD) {
          return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`;
        }

        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 2

        // Detect if the opposite edge exists
        const hasReverse = links.some(
          other =>
            other.source?.id === d.target?.id &&
            other.target?.id === d.source?.id
        );

        const isSameDir = d.sourceId < d.targetId
        const sweepFlag = hasReverse ? (isSameDir ? 1 : 0) : 1

        return `M${d.source.x},${d.source.y} A${dr},${dr} 0 0,${sweepFlag} ${d.target.x},${d.target.y}`
      })

      edgeLabels
        .each(function(d, i) {
          if(!d.source || !d.target)  return ''
          const me = d3.select(this);
          if (d.source.id === d.target.id) {
            me
              .attr('x', d.source.x + 15)
              .attr('y', d.source.y - 45)
            return
          }
          const path = document.getElementById(`linkPath-${i}`)
          if (!path) return;
          const L = path.getTotalLength();
          const pt = path.getPointAtLength(L / 2)
          me.attr('x', pt.x).attr('y', pt.y - 3);    
        });

        node.attr('transform', d => `translate(${d.x},${d.y})`)
    }

    // Tick updates
    simulation.on('tick', ticked)
    ticked()
    return () => simulation.stop()

    function dragstarted(event, d) {
      if(d.isInitial) return
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event, d) {
      if(d.isInitial) return
      d.fx = event.x
      d.fy = event.y
      ticked()
    }

    function dragended(event, d) {
      if(d.isInitial) return
      if (!event.active) simulation.alphaTarget(0)
      if (!d.isPinned) {
        d.fx = null
        d.fy = null
      }
      ticked()
    }
    function zoomed({ transform }) {
      lastTransform.current = transform
      content.attr('transform', transform)
    }
    
  }, [graphData, viewMode])

  return (
    <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }}></svg>
  )
}

function layoutBdd(nodes, links, width, height) {
  const PAD_L = 60, PAD_R = 60, PAD_T = 40, PAD_B = 40;
  const V_GAP = 90;   // vertical gap between layers
  const H_MIN = 80;   // minimum horizontal spacing

  // --- Build adjacency with ids ---
  const out = new Map(), inDeg = new Map();
  nodes.forEach(n => { out.set(n.id, []); inDeg.set(n.id, 0); });
  links.forEach(e => {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    if (!out.has(s)) out.set(s, []);
    out.get(s).push(t);
    inDeg.set(t, (inDeg.get(t) || 0) + 1);
  });

  // --- Prefer explicit var/level if provided ---
  const level = new Map();
  const parseLvl = v => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const m = v.match(/(\d+)/);
      if (m) return +m[1];
    }
    return null;
  };
  let anyExplicit = false;
  for (const n of nodes) {
    const lvl = parseLvl(n.var ?? n.level);
    if (lvl !== null) { level.set(n.id, lvl); anyExplicit = true; }
  }

  // --- If no explicit levels, compute longest-path layering from sources ---
  if (!anyExplicit) {
    const L = new Map(nodes.map(n => [n.id, 0]));
    const indegCopy = new Map(inDeg);
    const q = [];

    nodes.forEach(n => { if ((indegCopy.get(n.id) || 0) === 0) q.push(n.id); });
    if (q.length === 0 && nodes.length) q.push(nodes[0].id); // degenerate fallback

    while (q.length) {
      const u = q.shift();
      for (const v of (out.get(u) || [])) {
        L.set(v, Math.max(L.get(v), L.get(u) + 1));
        indegCopy.set(v, (indegCopy.get(v) || 0) - 1);
        if (indegCopy.get(v) === 0) q.push(v);
      }
    }
    L.forEach((val, k) => level.set(k, val));
  }

  // --- Terminals go to bottom layer + 1 ---
  let maxLvl = -Infinity;
  level.forEach(v => { if (v > maxLvl) maxLvl = v; });
  for (const n of nodes) {
    if ((out.get(n.id) || []).length === 0) level.set(n.id, maxLvl + 1);
  }
  maxLvl = -Infinity; level.forEach(v => { if (v > maxLvl) maxLvl = v; });

  // --- If still one layer, use a tidy grid to avoid the snake ---
  const unique = new Set(level.values());
  if (unique.size <= 1) {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    const cellW = (width  - PAD_L - PAD_R) / cols;
    const cellH = (height - PAD_T - PAD_B) / Math.max(1, rows);
    nodes.forEach((n, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      n.x = PAD_L + cellW * (c + 0.5);
      n.y = PAD_T + cellH * (r + 0.5);
    });
    return;
  }

  // --- Group by level ---
  const byLevel = new Map();
  nodes.forEach(n => {
    const lv = level.get(n.id) ?? 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv).push(n);
  });

  // --- Parents map for barycenter heuristic ---
  const parents = new Map();
  links.forEach(e => {
    const s = typeof e.source === 'object' ? e.source.id : e.source;
    const t = typeof e.target === 'object' ? e.target.id : e.target;
    if (!parents.has(t)) parents.set(t, new Set());
    parents.get(t).add(s);
  });

  const layers = Array.from(byLevel.keys()).sort((a,b) => a - b);
  const yMin = PAD_T, yMax = height - PAD_B;
  const layerGap = Math.min(V_GAP, (yMax - yMin) / Math.max(1, layers.length));

  let prevX = new Map(); // nodeId -> x
  layers.forEach((lv, idx) => {
    const row = byLevel.get(lv);
    // barycenter ordering
    const scored = row.map(n => {
      const ps = Array.from(parents.get(n.id) || []);
      const score = ps.length ? ps.reduce((s,p) => s + (prevX.get(p) ?? 0), 0) / ps.length : 0;
      return { n, score };
    }).sort((a,b) => a.score - b.score);

    const y = yMin + idx * layerGap;
    const span = Math.max(1, scored.length);
    const xStep = Math.max(H_MIN, (width - PAD_L - PAD_R) / (span + 1));
    scored.forEach((e, i) => {
      const x = PAD_L + xStep * (i + 1);
      e.n.x = x; e.n.y = y;
      prevX.set(e.n.id, x);
    });
  });
}


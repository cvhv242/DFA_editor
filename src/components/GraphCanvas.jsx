import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function GraphCanvas({ graphData, pinAll }) {
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
  const prevPin = useRef(pinAll)    
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
    // Simulation
    const simulation = d3.forceSimulation(nodes)
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collision', d3.forceCollide().radius(r*2))
      .force('link', d3.forceLink(links).id(d => d.id).distance(150).strength(1))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))
      .alphaDecay(0.005)
      .velocityDecay(0.3)


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
        .attr('class', 'link')
        .attr('stroke', '#000')
        .attr('stroke-width', 1)
        .attr('fill', 'none')
        .attr('marker-end', d =>
          d.source.id === d.target.id ? 'url(#arrowLoop)' : 'url(#arrow)')

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
        d3.select(this).select('circle')
          .attr('stroke', d.isPinned ? '#000' : '#444')
          .attr('stroke-width', d.isPinned ? 2 : 1)
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
      } else {
        g.append('circle')
          .attr('r', 20)
          .attr('fill', '#fff')
          .attr('stroke', d.isFinal ? 'green' : (d.isPinned ? '#000' : '#444'))
          .attr('stroke-width', d.isFinal ? 3 : (d.isPinned ? 4 : 2));

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
      .attr('fill', '#000')
      .attr('stroke', '#fff')            // white outline
      .attr('stroke-width', 1)           // outline thickness
      .attr('paint-order', 'stroke') 
      .text(d => d.id)
    
    node.select('circle')
      .attr('stroke', d => d.isPinned ? '#000' : '#444')
      .attr('stroke-width', d => d.isPinned ? 2 : 1)

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
        if (d.source.id === d.target.id) {
          // Self-loop
          const x = d.source.x
          const y = d.source.y
          return `M${x},${y - loopR} A${loopR},${loopR} 0 1,1 ${x + 0.1},${y - loopR}`
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
    
  }, [graphData, pinAll])

  return (
    <svg ref={svgRef} style={{ width: '100%', height: '100%', display: 'block' }}></svg>
  )
}

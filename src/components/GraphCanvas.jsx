import { useEffect, useRef } from 'react'
import * as d3 from 'd3'

export default function GraphCanvas({ graphData }) {
  const svgRef = useRef()

  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = svgRef.current.clientHeight

    const { nodes, links } = graphData

    svg.append('defs')
      .append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#999')

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))

    const linkGroup = svg.append('g')
    const nodeGroup = svg.append('g')
    const labelGroup = svg.append('g')

    const link = linkGroup.selectAll('path')
      .data(links)
      .enter()
      .append('path')
      .attr('class', 'link')
      .attr('stroke', '#999')
      .attr('stroke-width', 2)
      .attr('fill', 'none')
      .attr('marker-end', 'url(#arrow)')

    const edgeLabels = labelGroup.selectAll('text')
      .data(links)
      .enter()
      .append('text')
      .attr('font-size', '12px')
      .attr('text-anchor', 'middle')
      .text(d => d.label)

    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .call(d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended))

    node.append('circle')
      .attr('r', 20)
      .attr('fill', '#1f77b4')

    node.append('text')
      .attr('dy', 5)
      .attr('text-anchor', 'middle')
      .attr('fill', '#fff')
      .text(d => d.id)

    simulation.on('tick', () => {
      link.attr('d', d => {
        if (d.source.id === d.target.id) {
          const x = d.source.x
          const y = d.source.y
          const r = 40
          return `M${x},${y} A${r},${r} 0 1,1 ${x + 1},${y + 1}`
        } else {
          return `M${d.source.x},${d.source.y} L${d.target.x},${d.target.y}`
        }
      })

      edgeLabels
        .attr('x', d => (d.source.x + d.target.x) / 2)
        .attr('y', d => (d.source.y + d.target.y) / 2 - 5)

      node.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    }

    function dragged(event, d) {
      d.fx = event.x
      d.fy = event.y
    }

    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    }
  }, [graphData])

  return (
    <svg ref={svgRef} style={{ width: '100%', height: '500px', border: '1px solid #ccc' }}></svg>
  )
}

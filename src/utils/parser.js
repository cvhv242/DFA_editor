export function parseInput(raw) {
  const lines = raw.trim().split('\n').filter(Boolean)
  const links = lines.map(line => {
    const [source, target, label] = line.trim().split(/\s+/)
    return { source, target, label }
  })
  const nodes = [...new Set(links.flatMap(l => [l.source, l.target]))].map(id => ({ id }))
  return { nodes, links }
}

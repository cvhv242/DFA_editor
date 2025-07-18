export default function ControlPanel({ setGraphData }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <button onClick={() => {
        setGraphData(prev => {
            if (!prev.nodes) return prev
            const updatedNodes = prev.nodes.map(n => {
            if (n.invisible) return n
            return {
                ...n,
                fx: !n.isPinned ? n.x : null,
                fy: !n.isPinned ? n.y : null,
                isPinned: !n.isPinned,
            }
            })
            return { ...prev, nodes: updatedNodes }
        })
    }}>
        Toggle Pin All
    </button>

      <button onClick={() => {
        setGraphData({ nodes: [], links: [] })
        setPinAll(false)
        setInputValue('')
      }}>Reset</button>
      <button onClick={() => {
        // export logic
      }}>Download JSON</button>
    </div>
  )
}

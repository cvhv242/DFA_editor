import './styles/graph.css'
import InputBox from './components/InputBox'
import GraphCanvas from './components/GraphCanvas'
import { useState } from 'react'

function App() {

  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [pinAll, setPinAll] = useState(false)

  const handlePinAll = () => {
    setGraphData(prev => {
      const updatedNodes = prev.nodes.map(n => {
        if (n.invisible) return n
        if (pinAll) {
          n.fx = null
          n.fy = null
          n.isPinned = false
        } else {
          n.fx = n.x
          n.fy = n.y
          n.isPinned = true
        }
        return n
      })
      return { ...prev, nodes: updatedNodes }
    })
    setPinAll(!pinAll)
  }
  const handleReset = () => {
    setRawLines([])
    setInputValue('')
    setGraphData({ nodes: [], links: [] })
    setPinAll(false)
  }


  return (
    <div style={{
      display: 'flex',
      height: '100vh',  // Full viewport height
      overflow: 'hidden',
    }}>
      <div style={{
          width: '25%',
          minWidth: '200px',
          resize: 'horizontal',
          overflow: 'auto',
          borderRight: '1px solid #ccc',
          padding: '1rem',
          background: '#f5f5f5',
        }}>
        <h2>DFA Input</h2>
        <InputBox 
          setGraphData={setGraphData}
        />

      </div>

      <div style={{
          flexGrow: 1,
          position: 'relative',
          resize: 'horizontal',
          overflow: 'hidden',
        }}>
        <GraphCanvas graphData={graphData} />
      </div>
      <div style={{
          width: '15%',
          minWidth: '150px',
          resize: 'horizontal',
          overflow: 'auto',
          borderLeft: '1px solid #ccc',
          padding: '1rem',
          background: '#f0f0f0',
        }}>
        <h2>Controls</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button onClick={handlePinAll}>
            {pinAll ? 'Unpin All' : 'Pin All'}
          </button>
          <button onClick={handleReset}>
            Reset Layout
          </button>
          {/* Future buttons go here */}
        </div>
      </div>
    </div>
  )
}

export default App

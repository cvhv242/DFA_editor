import './styles/graph.css'
import './styles/app.css'
import InputBox from './components/InputBox'
import GraphCanvas from './components/GraphCanvas'
import { useState } from 'react'

function App() {

  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [pinAll, setPinAll] = useState(false)

  const handleUnpinAll = () => {
    setGraphData( prev => {
      prev.nodes.forEach(n => {
      n.isPinned = false
      n.fx = null
      n.fy = null
    })
    return {
      nodes: [...prev.nodes],
      links: prev.links
    }})
    setPinAll(false)
  }

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
    setGraphData({ nodes: [], links: [] })
    setPinAll(false)
  }


  return (
    <div className='app-container'>
      <div className='main-content'>
        <GraphCanvas graphData={graphData} pinAll={handlePinAll} />
      </div>
      <div className="footer">
        <InputBox 
          setGraphData={setGraphData} 
          graphData={graphData} 
          onPinAll={handlePinAll}
          onUnpinAll={handleUnpinAll}
          onReset={handleReset}
        />
      </div>
    </div>
  )
}

export default App

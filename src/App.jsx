import './styles/graph.css'
import InputBox from './components/InputBox.jsx'
import GraphCanvas from './components/GraphCanvas'
import { useState } from 'react'

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] })

  return (
    <div>
      <h1>DFA Graph Editor</h1>
      <InputBox setGraphData={setGraphData} />
      <GraphCanvas graphData={graphData} />
    </div>
  )
}

export default App
import './styles/graph.css'
import './styles/app.css'
import InputBox from './components/TerminalInput'
import GraphCanvas from './components/GraphCanvas'
import { useState } from 'react'
import TerminalInput from './components/TerminalInput'

function App() {

  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [pinAll, setPinAll] = useState(false)

  const handleReset = () => {
    setGraphData({ nodes: [], links: [] })
    setPinAll(false)
  }


  return (
    <div className='app-container'>
      <div className='main-content'>
        <GraphCanvas graphData={graphData} pinAll={pinAll} />
      </div>
      <div className="footer">
        <TerminalInput 
          setGraphData={setGraphData} 
          graphData={graphData} 
          onPinAll={() => setPinAll(true)}
          onUnpinAll={() => setPinAll(false)}
          onReset={handleReset}
        />
      </div>
    </div>
  )
}

export default App

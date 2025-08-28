import './styles/graph.css'
import './styles/app.css'
import GraphCanvas from './components/GraphCanvas'
import { useState, useRef, useEffect } from 'react'
import TerminalInput from './components/TerminalInput'
import ManualPage from './components/ManualPage'

function App() {
  document.title = "DFA CLI visualizer";

  const [graphData, setGraphData] = useState({ nodes: [], links: [] })
  const [pinAll, setPinAll] = useState(false)
  const [viewMode, setViewMode]   = useState('dfa');
  const containerRef = useRef(null)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  const [route, setRoute] = useState(() => (window.location.hash.slice(1) || '/'));
  useEffect(() => {
    const onHash = () => setRoute(window.location.hash.slice(1) || '/');
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const [termHeight, setTermHeight] = useState(() => {
    const saved = Number(localStorage.getItem('termHeight'))
    return Number.isFinite(saved) && saved > 0 ? saved : 240
  })
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    localStorage.setItem('termHeight', String(termHeight))
  }, [termHeight])


  const handleReset = () => {
    setGraphData({ nodes: [], links: [] })
    setPinAll(false)
  }

  const startDrag = (e) => {
    if (maximized) setMaximized(false)
    draggingRef.current = true
    startYRef.current = e.clientY
    startHeightRef.current = termHeight
    e.preventDefault()
  }

  // drag move / end
  useEffect(() => {
    const onMove = (e) => {
      if (!draggingRef.current) return
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()

      // terminal height = distance from mouse to container bottom
      const minH = 120
      const maxH = Math.max(160, rect.height - 100)  // keep some canvas visible
      const newH = Math.max(minH, Math.min(maxH, rect.bottom - e.clientY))
      setTermHeight(newH)
      // trigger xterm fit
      window.dispatchEvent(new Event('resize'))
    }
    const onUp = () => { draggingRef.current = false }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  return (
    <div className='app-container' ref={containerRef}>
      
      {route === '/manual' ? (
        <ManualPage />
      ) : (
        <>
          <button
            className="help-button"
            onClick={() => { window.location.hash = '/manual'; }}
            title="Open Manual"
          >
            Help
          </button>
          <div 
            className='main-content'
            style={{ height: maximized ? 0 : `calc(100% - ${termHeight}px - 6px)` }} // 6px splitter
          >
            <GraphCanvas graphData={graphData} viewMode = {viewMode} />
          </div>

          <div className="splitter" onMouseDown={startDrag} />

          <div
            className={`footer ${maximized ? 'max' : ''}`}
            style={{ height: maximized ? 'calc(100% - 6px)' : `${termHeight}px` }}
          >
            <div
              className="panel-header"
              onMouseDown={startDrag}
              title="Drag to resize"
            >
              <div className="panel-title">Input Terminal</div>
            </div>
            <div className="panel-body">
              <TerminalInput
                setGraphData={setGraphData}
                graphData={graphData}
                onReset={handleReset}
                setViewMode={setViewMode}
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default App
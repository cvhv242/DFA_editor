import { parseInput } from '../utils/parser'
import { useState } from 'react'

export default function InputBox({ setGraphData }) {
  const [errors, setErrors] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [rawLines, setRawLines] = useState([])

  function onLineSubmit() {
    const line = inputValue.trim()
    if (!line) return
    const newLines = [...rawLines, line]
    setRawLines(newLines)
    const { nodes, links, errors : parseErrors } = parseInput(newLines.join('\n'))
    if (parseErrors.length) {
      setErrors(parseErrors)
    } else {
      setGraphData({ nodes, links })
    }
    setInputValue('')  // clear for next line
  }

  return (
    <>
      <textarea 
        rows={2} 
        style={{ width: '100%' }}
        value={inputValue}
        onChange={e => setInputValue(e.target.value)} 
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onLineSubmit()
          }
        }}
        placeholder='a b 2'
      >
        </textarea>
      {/* <button onClick={handleRender}>Render Graph</button> */}
      {errors.length > 0 && (
        <div style={{ marginTop: 10, color: 'red' }}>
          <ul>
            {errors.map((e,i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
    </>
  )
}

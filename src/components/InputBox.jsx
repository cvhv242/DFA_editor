import { parseInput } from '../utils/parser'

export default function InputBox({ setGraphData }) {
  function handleRender() {
    const raw = document.getElementById('raw-input').value
    setGraphData(parseInput(raw))
  }

  return (
    <>
      <textarea id="raw-input" rows="5" style={{ width: '100%' }}></textarea>
      <button onClick={handleRender}>Render Graph</button>
    </>
  )
}

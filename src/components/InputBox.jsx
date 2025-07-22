import { useEffect, useRef } from 'react'
import { Terminal }        from 'xterm'
import { FitAddon }        from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { parseInput }      from '../utils/parser'

export default function TerminalInput({ graphData, setGraphData, onPinAll, onUnpinAll, onReset }) {
  const termRef     = useRef(null)
  const terminal    = useRef(null)
  const fitAddon    = useRef(null)
  const buffer      = useRef('')       // the current typing buffer
  const rawLines    = useRef([])       // only *good* lines go here
  const history     = useRef([])       // for display, if you still want it

  useEffect(() => {
    // 1) Create + open
    terminal.current = new Terminal({
      cursorBlink: true,
      rows: 10,
      theme: { background: '#1e1e1e', foreground: '#ffffff' },
    })
    fitAddon.current = new FitAddon()
    terminal.current.loadAddon(fitAddon.current)
    terminal.current.open(termRef.current)
    fitAddon.current.fit()

    // 2) Initial prompt
    terminal.current.write('\x1b[32m$ \x1b[0m')

    // 3) Key handling
    terminal.current.onKey(({ key, domEvent }) => {
      const t = terminal.current
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

      if (domEvent.key === 'Enter') {
        t.write('\r\n')
        const line = buffer.current.trim()
        buffer.current = ''            // reset for next line

        switch(line.toLowerCase()) {
          case 'pinall':
            onPinAll()
            history.current.push({ type: 'command', text: `$ ${line}` })
            t.write('\x1b[32m$ \x1b[0m')
            return
          case 'unpinall':
            onUnpinAll()
            history.current.push({ type: 'command', text: `$ ${line}` })
            t.write('\x1b[32m$ \x1b[0m')
            return
          case 'reset':
            onReset()
            rawLines.current=[]
            buffer.current=''
            history.current=[]
            terminal.current.clear()            
            t.write('\x1b[32m$ \x1b[0m')
            return
        }

        if (line) {
          // Try parsing *before* committing it
          const candidate = [...rawLines.current, line] // only good lines in rawLines
          const { nodes, links, errors } = parseInput(candidate.join('\n'))

          if (errors.length) {
            // Print errors, but do not add the bad line to rawLines
            errors.forEach(err => t.write(`\x1b[31m${err}\x1b[0m\r\n`))
            // if you want to keep error history for display:
            history.current.push(...errors.map(e => ({ type: 'error', text: e })))
          } else {
            // 🎉 success: now commit the line
            rawLines.current.push(line)
            history.current.push({ type: 'command', text: `$ ${line}` })
            setGraphData(prev => {
              const oldById = new Map(prev.nodes.map(n => [n.id, n]))

              const mergedNodes = nodes.map(n => {
                const old = oldById.get(n.id)
                if (old) {
                  // carry over the pinned state & fixed positions
                  return {
                    ...n,
                    isPinned: old.isPinned,
                    fx:       old.fx,
                    fy:       old.fy
                  }
                } else {
                  // brand-new node: if pinAll is on, pin it immediately,
                  // otherwise leave unpinned
                  if (prev.pinAll) {
                    // note: d.x/d.y aren’t set until the first tick,
                    // but you can pin in GraphCanvas after simulation init
                    return { ...n, isPinned: true, /* fx/fy set later */ }
                  }
                  return n
                }
              })

              return { 
                nodes: mergedNodes,
                links
              }
            })
          }
        }

        // always re-print prompt
        t.write('\x1b[32m$ \x1b[0m')
      }
      else if (domEvent.key === 'Backspace') {
        if (buffer.current.length > 0) {
          buffer.current = buffer.current.slice(0, -1)
          terminal.current.write('\b \b')
        }
      }
      else if (printable) {
        buffer.current += key
        terminal.current.write(key)
      }
    })

    // 4) Clean up
    window.addEventListener('resize', () => fitAddon.current.fit())
    return () => terminal.current.dispose()
  }, [setGraphData])

  return (
    <div
      ref={termRef}
      style={{
        width: '100%', height: '100%',
        background: '#1e1e1e', borderRadius: '4px',
        overflow: 'auto',
      }}
    />
  )
}

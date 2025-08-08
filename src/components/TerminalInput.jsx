import { useEffect, useRef } from 'react'
import { Terminal }        from 'xterm'
import { FitAddon }        from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { parseInput }      from '../utils/parser'

export default function TerminalInput({ graphData, setGraphData, onPinAll, onUnpinAll, onReset }) {
  const termRef       = useRef(null)
  const terminal      = useRef(null)
  const fitAddon      = useRef(null)

  const buffer        = useRef('')       // the current typing buffer
  const rawLines      = useRef([])       // only *good* lines go here
  const history       = useRef([])  
  const awaitingReset = useRef(false);
  const dataRef       = useRef(graphData)

  useEffect(() => { dataRef.current = graphData }, [graphData])
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
      if (awaitingReset.current) return;
      const t = terminal.current
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

      if (domEvent.key === 'Enter') {
        t.write('\r\n')
        const line = buffer.current.trim()
        const parts = line.trim().split(/\s+/)
        const command = parts[0].toLowerCase()
        const arg = parts[1] || ''
        buffer.current = ''            // reset for next line

        const { nodes, links } = dataRef.current
        switch(command) {
          // case 'pinall':
          //   onPinAll()
          //   history.current.push({ type: 'command', text: `$ ${line}` })
          //   t.write('\x1b[32m$ \x1b[0m')
          //   return
          // case 'unpinall':
          //   onUnpinAll()
          //   history.current.push({ type: 'command', text: `$ ${line}` })
          //   t.write('\x1b[32m$ \x1b[0m')
          //   return
          case 'reset': {
            if (awaitingReset.current) return;

            awaitingReset.current = true;
            terminal.current.writeln(`\x1b[33mAre you sure? This will clear all progress. Press Y to confirm, any other key to cancel.\x1b[0m`);

            const resetListener = terminal.current.onKey(({ key }) => {
              resetListener.dispose();  // ✅ Remove listener cleanly
              awaitingReset.current = false;

              if (key.toLowerCase() === 'y') {
                onReset();
                rawLines.current = [];
                buffer.current = '';
                history.current = [];
                terminal.current.clear();
                terminal.current.write('\x1b[32m$ \x1b[0m');
              } else {
                terminal.current.writeln(`\x1b[33mReset cancelled.\x1b[0m`);
                terminal.current.write('\x1b[32m$ \x1b[0m');
              }
            });

            return;
          }

          case 'undo':
            if (rawLines.current.length === 0) {
              t.write('\x1b[33mNothing to undo\x1b[0m\r\n')
            } else {
              rawLines.current.pop()
              const script = rawLines.current.join('\n')
              const { nodes, links, errors } = parseInput(script)
              if (errors.length) {
                errors.forEach(e => t.write(`\x1b[31m${e}\x1b[0m\r\n`))
              } else {
                setGraphData({ nodes, links })
                history.current.push({ type: 'command', text: `$ undo` })
              }
            }
            t.write('\x1b[32m$ \x1b[0m')
            return
          
          case 'allstates':
            
            if (nodes.length === 0) {
              terminal.current.writeln(`\x1b[31mNo states defined.\x1b[0m`)
            } else {
              const stateNames = nodes.map(n => n.id).join(', ')
              terminal.current.writeln(`\x1b[33mQ = {${stateNames}}\x1b[0m`)
            }
            t.write('\x1b[32m$ \x1b[0m')
            return

          case 'allfinal':
            const finals  = nodes.filter(n => n.isFinal)
            if (finals.length === 0) {
              terminal.current.writeln(`\x1b[31mNo final states defined.\x1b[0m`)
            } else {
              const finalSet = finals.map(n => n.id).join(', ')
              terminal.current.writeln(`\x1b[33mF = {${finalSet}}\x1b[0m`)
            }
            t.write('\x1b[32m$ \x1b[0m')
            return

          case 'allinitial':
            const initials = nodes.filter(n => n.isInitial)
            if (initials.length === 0) {
              terminal.current.writeln(`\x1b[31mNo initial state defined.\x1b[0m`)
            } else {
              terminal.current.writeln(`\x1b[33mq₀ = ${initials[0].id}\x1b[0m`)
            }
            
            t.write('\x1b[32m$ \x1b[0m')
            return

          case 'alphabet': {
            const labelSet = new Set()
            links.forEach(l => {
              l.label.split(',').map(x => x.trim()).forEach(lab => labelSet.add(lab))
            })
            if (labelSet.size === 0) {
              terminal.current.writeln(`\x1b[31mNo alphabet defined yet.\x1b[0m`)
            } else {
              terminal.current.writeln(`\x1b[33mΣ = {${[...labelSet].join(', ')}}\x1b[0m`)
            }
            t.write('\x1b[32m$ \x1b[0m')
            return
          }

          case 'alltransitions':
            if(links.length===0) {
              terminal.current.writeln(`\x1b[31mNo transitions defined.\x1b[0m`)
            } else {
              links.forEach(l => {
                const labels = l.label.split(',').map(s => s.trim())
                labels.forEach(lab => {
                  terminal.current.writeln(`\x1b[33mδ(${l.source}, ${lab}) → ${l.target}\x1b[0m`)
                })
              })
            }
            
            t.write('\x1b[32m$ \x1b[0m')
            return
          
          case 'save': {
            const fileName = arg || 'dfa'
            const { nodes, links, errors, reminders } = parseInput(rawLines.current.join('\n'), dataRef.current)
            if (reminders.length) {
              reminders.forEach(r => terminal.current.writeln(`\x1b[31m${r}\x1b[0m`))
              terminal.current.writeln(`\x1b[31mCannot save — DFA is incomplete.\x1b[0m`)
              t.write('\x1b[32m$ \x1b[0m')
              return
            }

            const json = JSON.stringify({ nodes, links }, null, 2)

            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `${fileName}.json`
            a.click()
            URL.revokeObjectURL(url)
            terminal.current.writeln(`\x1b[33mDFA saved to "${fileName}".json\x1b[0m`)
            t.write('\x1b[32m$ \x1b[0m')
            return
          }

          case 'load': {
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = async (e) => {
              const file = e.target.files[0]
              if (!file) return
              try {
                const text = await file.text()
                const { nodes, links } = JSON.parse(text)

                // Normalize loaded nodes
                const normalizedNodes = nodes.map(n => ({
                  ...n,
                  isPinned: n.isPinned || false,
                  fx: n.fx ?? null,
                  fy: n.fy ?? null,
                  shape: n.isInitial ? 'image' : 'circle',
                  imageUrl: n.isInitial ? '/download.png' : null
                }))

                setGraphData({ nodes: normalizedNodes, links })

                const initial = normalizedNodes.find(n => n.isInitial)
                const regular = normalizedNodes.filter(n => !n.isInitial)

                rawLines.current = [
                  `cnode ${initial ? '>' + initial.id : ''}${regular.length ? ',' + regular.map(n => n.id).join(',') : ''}`,
                  ...normalizedNodes.filter(n => n.isFinal).map(n => `final ${n.id}`),
                  ...links.flatMap(l => l.label.split(',').map(lbl => `${l.source} ${l.target} ${lbl.trim()}`))
                ]

                terminal.current.writeln(`\x1b[33mDFA loaded from "${file.name}"\x1b[0m`)
              } catch (err) {
                terminal.current.writeln(`\x1b[31mFailed to load DFA: ${err.message}\x1b[0m`)
              }
              t.write('\x1b[32m$ \x1b[0m')
            }
            input.click()
            return
          }

          case 'mydfa': {
            const { nodes, links } = dataRef.current
            const Q = nodes.map(n => n.id);
            const q0 = nodes.find(n => n.isInitial)?.id;
            const F = nodes.filter(n => n.isFinal).map(n => n.id);

            const Σ = new Set();
            const δ = [];

            links.forEach(l => {
              const from = typeof l.source === 'string' ? l.source : l.source.id;
              const to = typeof l.target === 'string' ? l.target : l.target.id;
              const labels = l.label.split(',').map(s => s.trim());
              labels.forEach(a => {
                Σ.add(a);
                δ.push(`δ(${from}, ${a}) → ${to}`);
              });
            });

            terminal.current.writeln(`\x1b[33mQ   = {${Q.join(', ')}}\x1b[0m`);
            terminal.current.writeln(`\x1b[33mΣ   = {${[...Σ].join(', ')}}\x1b[0m`);
            terminal.current.writeln(`\x1b[33mq₀  = ${q0 || 'undefined'}\x1b[0m`);
            terminal.current.writeln(`\x1b[33mF   = {${F.join(', ')}}\x1b[0m`);
            terminal.current.writeln(`\x1b[33mδ   = {\x1b[0m`);
            δ.forEach(line => terminal.current.writeln(`\x1b[33m   ${line}\x1b[0m`));
            terminal.current.writeln(`\x1b[33m}\x1b[0m`);
            t.write('\x1b[32m$ \x1b[0m');
            return;
          }

          case 'complement': {
            // 1) Parse the existing script (without the new line)
            const { nodes, links } = dataRef.current;
           

            // 2) Flip finality of every non-initial node *once*
            const flippedNodes = nodes.map(n =>
              n.isInitial ? n : { ...n, isFinal: !n.isFinal }
            );

            // 3) Push the new state to React (links stay the same)
            setGraphData({ nodes: flippedNodes, links });

            // 4) Echo command into history / prompt, but do *not* save it in rawLines
            history.current.push({ type:'command', text: '$ complement' });
            terminal.current.write('\x1b[32m$ \x1b[0m');
            return;              // ← important: skip the default fall-through
          }


          default:
            if (line) {
              // Try parsing *before* committing it
              const candidate = [...rawLines.current, line] // only good lines in rawLines
              const { nodes, links, errors, reminders } = parseInput(candidate.join('\n'), dataRef.current)

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
                      // if (prev.pinAll) {
                      //   // note: d.x/d.y aren’t set until the first tick,
                      //   // but you can pin in GraphCanvas after simulation init
                      //   return { ...n, isPinned: true, /* fx/fy set later */ }
                      // }
                      return n
                    }
                  })

                  return { 
                    nodes: mergedNodes,
                    links
                  }
                })
                reminders.forEach(r => t.write(`\x1b[33m${r}\x1b[0m\r\n`))
              }
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

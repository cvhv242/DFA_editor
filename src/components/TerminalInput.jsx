import { useEffect, useRef } from 'react'
import { Terminal }        from 'xterm'
import { FitAddon }        from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import { parseInput }      from '../utils/parser.js'
import { buildProduct } from '../utils/product.js'
import bddToJson from '../bdd/bdd-to-json.js';
import buildRelBDD from '../bdd/dfa2bdd-rel.js';

export default function TerminalInput({ graphData, setGraphData, onReset }) {
  const termRef       = useRef(null)
  const terminal      = useRef(null)
  const fitAddon      = useRef(null)
  const dfaLeft  = useRef(null);   // hold original DFAs
  const dfaRight = useRef(null);


  const buffer        = useRef('')       // the current typing buffer
  const rawLines      = useRef([])       // only *good* lines go here
  const history       = useRef([])  
  const awaitingReset = useRef(false)
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

          case 'manual':
          case 'help':
          case '?': {
            printManual(terminal.current);
            terminal.current.write('\x1b[32m$ \x1b[0m');
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
            const slot = parts[1]?.toLowerCase() ?? 'left';
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = async (e) => {
              const file = e.target.files[0]
              if (!file) return
              try {
                const text = await file.text()
                const { nodes, links } = JSON.parse(text)
                if (slot === 'left')  dfaLeft.current  = { nodes, links };
                if (slot === 'right') dfaRight.current = { nodes, links };

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

          case 'intersect':
          case 'union': {
            if (!dfaLeft.current || !dfaRight.current) {
              terminal.current.writeln('\x1b[31mLoad two DFAs first (left & right)\x1b[0m');
              break;
            }
            const op = command === 'intersect' ? '∩' : '∪';
            const product = buildProduct(dfaLeft.current, dfaRight.current, op);
            setGraphData(product);
            history.current.push({ type:'command', text:`$ ${command}`});
            terminal.current.write('\x1b[32m$ \x1b[0m');
            return;
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
            const { nodes, links } = dataRef.current;

            const flippedNodes = nodes.map(n =>
              n.isInitial ? n : { ...n, isFinal: !n.isFinal }
            );

            setGraphData({ nodes: flippedNodes, links });

            history.current.push({ type:'command', text: '$ complement' });
            terminal.current.write('\x1b[32m$ \x1b[0m');
            return;              
          }

          case 'showbdd': {                        // ⇢ replaces canvas with the BDD
            const dfa   = dataRef.current;
            const { T, mgr } = buildRelBDD(dfa);
            const { nodes, links } = bddToJson(T, mgr);
            setGraphData({ nodes, links });
            history.current.push({ type:'command', text:'$ showbdd+' });
            terminal.current.write('\x1b[32m$ \x1b[0m');
            return; 
          }

          case 'accept': {
            const word = (parts[1] || '').trim(); // e.g.,: accept ababa
            if (!word) {
              terminal.current.writeln('\x1b[31mUsage: accept <word>\x1b[0m');
            } else {
              const dfa = dataRef.current;
              const { acceptsWord } = buildRelBDD(dfa);
              const ok = acceptsWord(word.split(''));
              terminal.current.writeln(ok
                ? '\x1b[32maccepted\x1b[0m'
                : '\x1b[31mrejected\x1b[0m');
            }
            terminal.current.write('\x1b[32m$ \x1b[0m');
            return;
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

function printManual(t) {
  const header = s => `\x1b[1m\x1b[36m${s}\x1b[0m`;     // bold cyan
  const cmd    = s => `\x1b[33m${s}\x1b[0m`;             // yellow
  const note   = s => `\x1b[2m${s}\x1b[0m`;              // dim

  t.writeln(header('DFA CLI Manual'));

  t.writeln(header('Building & Editing'));
  t.writeln(cmd('$ s s\' <labels>') + ' : Add transition(s). <labels> can be comma-separated (e.g., "0,1").');
  t.writeln(cmd('$ cnode s1,>s2,s3') + ' : Create nodes s1, s2, s3; prefix ">" makes that node initial (e.g., >s2).');
  t.writeln(cmd('$ dnode s1,s2,...') + ' : Delete listed nodes and their incident edges.');
  t.writeln(cmd('$ initial s1') + ' : Mark listed node as initial.');
  t.writeln(cmd('$ final s1,s2,...') + ' : Mark listed nodes as final.');
  t.writeln(cmd('$ unfinal s1,s2,...') + ' : Unmark listed nodes as final.');
  t.writeln(cmd('$ dtrans s1 s2') + ' : Delete all transitions from s1 to s2.');
  t.writeln(cmd('$ dtrans s1 s2 i1,i2,...') + ' : Delete only s1→s2 transitions with these labels.');
  t.writeln(cmd('$ chtrans s1 s2 i1,i2,...') + ' : Replace ALL labels on s1→s2 with i1,i2,... (DFA totality validated).');

  t.writeln(header('Introspection'));
  t.writeln(cmd('$ mydfa') + ' : Print the 5-tuple (Q, Σ, q₀, F, δ).');
  t.writeln(cmd('$ allstates') + ' : List all states.');
  t.writeln(cmd('$ allfinal') + ' : List all final states.');
  t.writeln(cmd('$ allinitial') + ' : Show the initial state (if any).');
  t.writeln(cmd('$ alltransitions') + ' : List all transitions.');
  t.writeln(cmd('$ alphabet') + ' : List the alphabet (transition labels).');
  t.writeln(cmd('$ accept <word>') + ' : Check membership; prints "accepted" or "rejected".');

  t.writeln(header('Files'));
  t.writeln(cmd('$ save <name>') + ' : Save current DFA to <name>.json.');
  t.writeln(cmd('$ load') + ' : Load a DFA into the left slot (default).');
  t.writeln(cmd('$ load right') + ' : Load a DFA into the right slot.');

  t.writeln(header('Set Operations'));
  t.writeln(cmd('$ union') + ' : Build the union of left and right DFAs.');
  t.writeln(cmd('$ intersect') + ' : Build the intersection of left and right DFAs.');
  t.writeln(note('  (Use "intersect" — not "intersects" — per current implementation.)'));

  t.writeln(header('BDD / Symbolic'));
  t.writeln(cmd('$ showbdd') + ' : Show BDD equivalent of the current DFA');

  t.writeln(header('Session'));
  t.writeln(cmd('$ undo') + ' : Undo the last successful command.');
  t.writeln(cmd('$ reset') + ' : Clear terminal and canvas.');

  t.writeln(header('Manual'));
  t.writeln(cmd('$ manual') + ' : Print the command manual');

  t.writeln(header('Notes'));
  t.writeln('• To set an initial at creation time, use ' + cmd('cnode') + ' with a ' + cmd('>') + ' prefix (e.g., ' + cmd('cnode >a,b,c') + ' or ' + cmd('>a b 1') + ').');
  t.writeln('• To set an initial at creation time, mark source state initial and not destination state (e.g., ' + cmd('>a b 1') + ' not ' + cmd('a >b 1') + ').');
  t.writeln('');
}

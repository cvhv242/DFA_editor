import { useEffect, useRef } from 'react'
import { Terminal }        from 'xterm'
import { FitAddon }        from 'xterm-addon-fit'
import 'xterm/css/xterm.css'
import initialIcon from '../assets/download.png'
import { parseInput }      from '../utils/parser.js'
import { buildProduct }    from '../utils/product.js'
import bddToJson           from '../bdd/bdd-to-json.js'
import buildRelBDD         from '../bdd/dfa2bdd-rel.js'

const TERM_SINGLETON = (window.__TERM_SINGLETON__ ||= {
  term: null,
  fit: null,
  keySub: null,          // disposable for onKey
  didInitPrompt: false,  // so we don't double-print the first prompt
  rawLines: [],
  history: [],
  mode: 'dfa',           // 'dfa' | 'bdd'
  prevDfa: null,         // snapshot before entering BDD
  undoStack: [],
  dfaLeft: null,
  dfaRight: null,
});

export default function TerminalInput({ graphData, setGraphData, onReset, setViewMode }) {
  const termRef       = useRef(null)
  const terminal      = useRef(null)
  const fitAddon      = useRef(null)

  const dfaLeft  = useRef(null)
  const dfaRight = useRef(null)

  const buffer        = useRef('')
  const rawLines      = useRef([])      // only “good” DFA lines
  const history       = useRef([])
  const awaitingReset = useRef(false)
  const dataRef       = useRef(graphData)
  const prevDfaRef    = useRef(null)
  const undoStack     = useRef([]);
  const modeRef       = useRef('dfa')

  useEffect(() => { dataRef.current = graphData }, [graphData])
   // Create once, then reattach on every mount
  useEffect(() => {
    if (!TERM_SINGLETON.term) {
      TERM_SINGLETON.term = new Terminal({
        cursorBlink: true, rows: 10, scrollback: 2000,
        theme: { background: '#1e1e1e', foreground: '#ffffff' },
      });
      TERM_SINGLETON.fit = new FitAddon();
      TERM_SINGLETON.term.loadAddon(TERM_SINGLETON.fit);
    }
    terminal.current = TERM_SINGLETON.term;
    fitAddon.current = TERM_SINGLETON.fit;
    // Reattach to the new DOM container
    if (termRef.current) {
      termRef.current.innerHTML = '';
      terminal.current.open(termRef.current);
      try { fitAddon.current.fit(); } catch {}
      terminal.current.focus();
    }
    // Seed persistent refs from the singleton
    rawLines.current   = TERM_SINGLETON.rawLines;
    prevDfaRef.current = TERM_SINGLETON.prevDfa;
    undoStack.current  = TERM_SINGLETON.undoStack;
    modeRef.current    = TERM_SINGLETON.mode || 'dfa';
    if (!TERM_SINGLETON.didInitPrompt) { writePrompt(); TERM_SINGLETON.didInitPrompt = true; }

    // Bind exactly one key handler; dispose previous if any
    try { TERM_SINGLETON.keySub?.dispose(); } catch {}
    TERM_SINGLETON.keySub = terminal.current.onKey(({ key, domEvent }) => {
      if (awaitingReset.current) return
      const t = terminal.current
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

      if (domEvent.key === 'Enter') {
        t.write('\r\n')
        const line = buffer.current.trim()
        const parts = line.trim().split(/\s+/)
        const command = (parts[0] || '').toLowerCase()
        const arg = parts[1] || ''
        buffer.current = ''

        const { nodes, links } = dataRef.current

        // helpers
        const isEditCommand = (cmd, rawLine) => {
          // DFA-editing commands or raw transition lines
          const editSet = new Set(['cnode','dnode','initial','final','unfinal','dtrans','chtrans','complement','union','intersect'])
          if (editSet.has(cmd)) return true
          // treat “s t l1,l2” shape as edit
          if (!cmd || !cmd.startsWith('$')) {
            const toks = (rawLine || '').split(/\s+/)
            return toks.length >= 3 && !editSet.has(toks[0])
          }
          return false
        }
        const cannotEditBDD = () => {
          t.writeln('\x1b[31mCannot edit BDDs (read-only). Type \'back\' to return to DFA view.\x1b[0m')
          writePrompt()
        }
        const switchToDFA = () => {
          // rebuild from history (rawLines) into DFA
          const { nodes, links, errors } = parseInput(rawLines.current.join('\n'))
          if (errors?.length) {
            errors.forEach(e => t.writeln(`\x1b[31m${e}\x1b[0m`))
          } else {
            setGraphData({ nodes, links })
            modeRef.current = 'dfa'
            t.writeln('\x1b[35mReturned to DFA view.\x1b[0m')
          }
          writePrompt()
        }

        switch (command) {
          case 'reset': {
            if (awaitingReset.current) return
            awaitingReset.current = true
            t.writeln(`\x1b[33mAre you sure? This will clear all progress. Press Y to confirm, any other key to cancel.\x1b[0m`)
            const resetListener = terminal.current.onKey(({ key }) => {
              resetListener.dispose()
              awaitingReset.current = false
              if (key.toLowerCase() === 'y') {
                onReset()
                rawLines.current = []
                TERM_SINGLETON.rawLines = []
                buffer.current = ''
                history.current = []
                modeRef.current = 'dfa'
                TERM_SINGLETON.mode = 'dfa'
                prevDfaRef.current= null
                undoStack.current = []
                TERM_SINGLETON.prevDfa = null
                TERM_SINGLETON.undoStack = []
                setViewMode?.('dfa');
                terminal.current.clear()
              } else {
                t.writeln(`\x1b[33mReset cancelled.\x1b[0m`)
              }
              writePrompt()
            })
            return
          }

          case 'manual':
          case 'help':
          case '?': {
            printManual(terminal.current)
            writePrompt()
            return
          }

          case 'back': {
            if (prevDfaRef.current) {
              setGraphData(prevDfaRef.current);
              prevDfaRef.current = null;
              TERM_SINGLETON.prevDfa = null;
              modeRef.current = 'dfa';
              TERM_SINGLETON.mode = 'dfa'
              setViewMode?.('dfa');
              terminal.current.writeln('\x1b[35mReturned to DFA view.\x1b[0m');
              writePrompt();
              return;
            }
            switchToDFA(); // fallback
            modeRef.current='dfa';
            setViewMode?.('dfa');
            return;
          }

          case 'undo': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            if(undoStack.current.length === 0) {
              t.writeln('\x1b[33mNothing to undo\x1b[0m')
            } else {
              const prev = undoStack.current.pop()
              setGraphData(prev)
              rawLines.current = toScript(prev)
              TERM_SINGLETON.rawLines = rawLines.current
              TERM_SINGLETON.undoStack = undoStack.current
              try {
                const script = rawLines.current.join('\n')
                const { reminders = [], errors = [] } = parseInput(script, prev)
                errors.forEach(e => t.writeln(`\x1b[31m${e}\x1b[0m`))
                reminders.forEach(r => t.writeln(`\x1b[33m${r}\x1b[0m`))
              } catch (e) {
                t.writeln(`\x1b[31mUndo check failed: ${e.message}\x1b[0m`)
              }
              history.current.push({ type: 'command', text: `$ undo` });
            }
            writePrompt()
            return
          }

          case 'allstates': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            if (nodes.length === 0) t.writeln(`\x1b[31mNo states defined.\x1b[0m`)
            else t.writeln(`\x1b[33mQ = {${nodes.map(n => n.id).join(', ')}}\x1b[0m`)
            writePrompt()
            return
          }

          case 'allfinal': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            const finals = nodes.filter(n => n.isFinal)
            if (finals.length === 0) t.writeln(`\x1b[31mNo final states defined.\x1b[0m`)
            else t.writeln(`\x1b[33mF = {${finals.map(n => n.id).join(', ')}}\x1b[0m`)
            writePrompt()
            return
          }

          case 'allinitial': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            const initials = nodes.filter(n => n.isInitial)
            if (initials.length === 0) t.writeln(`\x1b[31mNo initial state defined.\x1b[0m`)
            else t.writeln(`\x1b[33mq₀ = ${initials[0].id}\x1b[0m`)
            writePrompt()
            return
          }

          case 'alphabet': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            const labelSet = new Set()
            links.forEach(l => (l.label || '').split(',').map(x => x.trim()).forEach(lab => lab && labelSet.add(lab)))
            if (labelSet.size === 0) t.writeln(`\x1b[31mNo alphabet defined yet.\x1b[0m`)
            else t.writeln(`\x1b[33mΣ = {${[...labelSet].join(', ')}}\x1b[0m`)
            writePrompt()
            return
          }

          case 'alltransitions': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            if (links.length === 0) {
              t.writeln(`\x1b[31mNo transitions defined.\x1b[0m`)
            } else {
              links.forEach(l => {
                const labels = (l.label || '').split(',').map(s => s.trim()).filter(Boolean)
                labels.forEach(lab => {
                  const from = typeof l.source === 'string' ? l.source : l.source.id
                  const to   = typeof l.target === 'string' ? l.target : l.target.id
                  t.writeln(`\x1b[33mδ(${from}, ${lab}) → ${to}\x1b[0m`)
                })
              })
            }
            writePrompt()
            return
          }

          case 'save': {
            // Save what's on screen.
            // DFA mode: enforce completeness reminders (old behavior)
            // BDD mode: just dump nodes/links as-is
            const fileName = arg || (modeRef.current === 'bdd' ? 'bdd' : 'dfa')

            if (modeRef.current === 'dfa') {
              const current = dataRef.current;
              const { reminders } = parseInput(rawLines.current.join('\n'), current)
              if (reminders.length) {
                reminders.forEach(r => t.writeln(`\x1b[31m${r}\x1b[0m`))
                t.writeln(`\x1b[31mCannot save — DFA is incomplete.\x1b[0m`)
                writePrompt()
                return
              }
              const json = JSON.stringify({ nodes: current.nodes, links: current.links }, null, 2)
              downloadJson(json, `${fileName}.json`)
              t.writeln(`\x1b[33mDFA saved to "${fileName}.json"\x1b[0m`)
            } else {
              const json = JSON.stringify({ nodes, links }, null, 2)
              downloadJson(json, `${fileName}.json`)
              t.writeln(`\x1b[33mBDD graph saved to "${fileName}.json"\x1b[0m`)
            }
            writePrompt()
            return
          }

          case 'load': {
            const slot = parts[1]?.toLowerCase() ?? 'left'
            const input = document.createElement('input')
            input.type = 'file'
            input.accept = '.json'
            input.onchange = async (e) => {
              const file = e.target.files[0]
              if (!file) return
              try {
                const text = await file.text()
                const parsed = JSON.parse(text)

                // Try to detect if it's a DFA-ish payload (has isInitial somewhere)
                const isProbablyDFA = Array.isArray(parsed?.nodes) && parsed.nodes.some(n => 'isInitial' in n)
                const nodesIn = parsed.nodes ?? []
                const linksIn = parsed.links ?? []

                if (isProbablyDFA) {
                  // normalize DFA visuals and switch to DFA mode
                  const normalizedNodes = nodesIn.map(n => ({
                    ...n,
                    isPinned: n.isPinned || false,
                    fx: n.fx ?? null,
                    fy: n.fy ?? null,
                    shape: n.isInitial ? 'image' : 'circle',
                    imageUrl: n.isInitial ? initialIcon : null
                  }))
                  setGraphData({ nodes: normalizedNodes, links: linksIn })
                  modeRef.current = 'dfa'

                  if (slot === 'left')  dfaLeft.current  = { nodes: normalizedNodes, links: linksIn }
                  if (slot === 'right') dfaRight.current = { nodes: normalizedNodes, links: linksIn }

                  rawLines.current = toScript({nodes: normalizedNodes, links: linksIn})
                  TERM_SINGLETON.rawLines = rawLines.current

                  modeRef.current = 'dfa';
                  TERM_SINGLETON.mode = 'dfa';
                  prevDfaRef.current = null
                  TERM_SINGLETON.prevDfa = null
                  setViewMode?.('dfa');
                  t.writeln(`\x1b[33mDFA loaded from "${file.name}"\x1b[0m`)
                } else {
                  // assume generic graph (possibly BDD); keep as-is and switch to BDD mode
                  setGraphData({ nodes: nodesIn, links: linksIn })
                  modeRef.current = 'bdd'
                  TERM_SINGLETON.mode = 'bdd'
                  prevDfaRef.current = null
                  TERM_SINGLETON.prevDfa = null
                  setViewMode?.('bdd');
                  t.writeln(`\x1b[33mGraph (BDD/Generic) loaded from "${file.name}"\x1b[0m`)
                }
              } catch (err) {
                t.writeln(`\x1b[31mFailed to load file: ${err.message}\x1b[0m`)
              }
              writePrompt()
            }
            input.click()
            return
          }

          case 'intersect':
          case 'union': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            if (!dfaLeft.current || !dfaRight.current) {
              terminal.current.writeln('\x1b[31mLoad two DFAs first (left & right)\x1b[0m')
              break
            }
            const op = command === 'intersect' ? '∩' : '∪'
            const product = buildProduct(dfaLeft.current, dfaRight.current, op)
            setGraphData(product)
            modeRef.current = 'dfa'
            TERM_SINGLETON.mode = 'dfa'
            history.current.push({ type:'command', text:`$ ${command}`})

            rawLines.current = toScript(product)
            TERM_SINGLETON.rawLines = rawLines.current

            writePrompt()
            return
          }


          case 'mydfa': {
            // Just print whatever is on screen (works for DFA; for BDD it will still print ids/edges)
            const Q = nodes.map(n => n.id)
            const q0 = nodes.find(n => n.isInitial)?.id
            const F  = nodes.filter(n => n.isFinal).map(n => n.id)
            const Σ  = new Set()
            const δ  = []
            links.forEach(l => {
              const from = typeof l.source === 'string' ? l.source : l.source.id
              const to   = typeof l.target === 'string' ? l.target : l.target.id
              const labels = (l.label || '').split(',').map(s => s.trim()).filter(Boolean)
              labels.forEach(a => { Σ.add(a); δ.push(`δ(${from}, ${a}) → ${to}`) })
            })
            terminal.current.writeln(`\x1b[33mQ   = {${Q.join(', ')}}\x1b[0m`)
            terminal.current.writeln(`\x1b[33mΣ   = {${[...Σ].join(', ')}}\x1b[0m`)
            terminal.current.writeln(`\x1b[33mq₀  = ${q0 || 'undefined'}\x1b[0m`)
            terminal.current.writeln(`\x1b[33mF   = {${F.join(', ')}}\x1b[0m`)
            terminal.current.writeln(`\x1b[33mδ   = {\x1b[0m`)
            δ.forEach(line => terminal.current.writeln(`\x1b[33m   ${line}\x1b[0m`))
            terminal.current.writeln(`\x1b[33m}\x1b[0m`)
            writePrompt()
            return
          }

          case 'complement': {
            if (modeRef.current === 'bdd') return cannotEditBDD()
            const flippedNodes = nodes.map(n => n.isInitial ? n : ({ ...n, isFinal: !n.isFinal }))
            setGraphData({ nodes: flippedNodes, links })
            modeRef.current = 'dfa'
            history.current.push({ type:'command', text: '$ complement' })
            writePrompt()
            return
          }

          case 'showbdd': {
            const dfa = dataRef.current
            prevDfaRef.current = JSON.parse(JSON.stringify(dataRef.current));
            TERM_SINGLETON.prevDfa = prevDfaRef.current;
            const { T, mgr, _ } = buildRelBDD(dfa)
            const { nodes, links } = bddToJson(T, mgr)
            setGraphData({ nodes, links })
            modeRef.current = 'bdd'
            TERM_SINGLETON.mode = 'bdd'
            history.current.push({ type:'command', text:'$ showbdd' })
            terminal.current.writeln(`\x1b[35mEntered BDD view (read-only). Type 'back' to return to DFA.\x1b[0m`)
            modeRef.current='bdd'
            setViewMode?.('bdd');
            writePrompt()
            return
          }

          case 'showmono': {
            if(modeRef.current==='dfa') return
            // Which part? default = 'all'
            const part = (parts[1] || 'all').toLowerCase();

            // Prefer rebuilding from successful history so this also works in BDD view
            const script = rawLines.current.join('\n');
            let snap;
            try {
              const { nodes, links } = parseInput(script);
              snap = dfaSnapshot(nodes, links);
            } catch {
              // Fallback: use whatever is currently on screen
              const { nodes, links } = dataRef.current;
              snap = dfaSnapshot(nodes, links);
            }

            const enc  = buildEnc(snap);      // lexical, stable encoding
            const mono = buildMonolithic(snap, enc); // { I, T, S }

            if (part === 'i' || part === 'all') terminal.current.writeln(colorMono('I(x) = ' + mono.I));
            if (part === 't' || part === 'all') terminal.current.writeln(colorMono('T(x,a,x′) = ' + mono.T));
            if (part === 's' || part === 'all') terminal.current.writeln(colorMono('S(x′) = ' + mono.S));

            modeRef.current='bdd'
            TERM_SINGLETON.mode = 'bdd'
            setViewMode?.('bdd');
            writePrompt();
            return;
          }


          case 'accept': {
            if (modeRef.current === 'bdd') {
              t.writeln('\x1b[31mCannot run accept in BDD view — type \'back\' to return to DFA.\x1b[0m')
              writePrompt()
              return
            }
            const word = (parts[1] || '').trim()
            if (!word) {
              t.writeln('\x1b[31mUsage: accept <word>\x1b[0m')
            } else {
              const dfa = dataRef.current
              const { acceptsWord } = buildRelBDD(dfa)
              const ok = acceptsWord(word.split(''))
              t.writeln(ok ? '\x1b[32maccepted\x1b[0m' : '\x1b[31mrejected\x1b[0m')
            }
            writePrompt()
            return
          }

          default: {
            if (!line) { writePrompt(); return }
            // block DFA edit attempts while in BDD view
            if (modeRef.current === 'bdd' && isEditCommand(command, line)) {
              return cannotEditBDD()
            }

            // Try parsing BEFORE committing
            const candidate = [...rawLines.current, line]
            const { nodes, links, errors, reminders } = parseInput(candidate.join('\n'), dataRef.current)

            if (errors.length) {
              errors.forEach(err => t.write(`\x1b[31m${err}\x1b[0m\r\n`))
              history.current.push(...errors.map(e => ({ type: 'error', text: e })))
            } else {
              const prevSnap = JSON.parse(JSON.stringify(dataRef.current));
              undoStack.current.push(prevSnap);
              TERM_SINGLETON.undoStack = undoStack.current;
              history.current.push({ type: 'command', text: `$ ${line}` })
              setGraphData(prev => {
                const oldById = new Map(prev.nodes.map(n => [n.id, n]))
                const mergedNodes = nodes.map(n => {
                  const old = oldById.get(n.id)
                  return old ? { ...n, isPinned: old.isPinned, fx: old.fx, fy: old.fy } : n
                })
                return { nodes: mergedNodes, links }
              })
              rawLines.current = toScript({ nodes, links });
              TERM_SINGLETON.rawLines = rawLines.current;
              reminders.forEach(r => t.write(`\x1b[33m${r}\x1b[0m\r\n`))
              modeRef.current = 'dfa'
              TERM_SINGLETON.rawLines = rawLines.current;
            }
            writePrompt()
          }
        }
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

    const onResize = () => { try { fitAddon.current.fit(); } catch {} };
    window.addEventListener('resize', onResize);
    // IMPORTANT: do not dispose the terminal; keep buffer alive
    return () => {
      try { TERM_SINGLETON.keySub?.dispose(); } catch {}
      TERM_SINGLETON.keySub = null;
      window.removeEventListener('resize', onResize);
    }
  }, [setGraphData])

  return (
    <div
      ref={termRef}
      style={{
        width: '100%', height: '100%',
        background: '#1e1e1e', borderRadius: '4px',
        overflow: 'hidden',
      }}
    />
  )

  function writePrompt() {
    const isBDD = modeRef.current === 'bdd'
    const prompt = isBDD ? '\x1b[35mBD$\x1b[0m ' : '\x1b[32m$ \x1b[0m'
    terminal.current.write(prompt)
  }
}

function printManual(t) {
  const header = s => `\x1b[1m\x1b[36m${s}\x1b[0m`
  const cmd    = s => `\x1b[33m${s}\x1b[0m`
  t.writeln(header('DFA CLI Manual'))
  t.writeln(header('Building & Editing'))
  t.writeln(cmd('$ s s\' <labels>') + ' : Add transition(s). <labels> can be comma-separated (e.g., "0,1").')
  t.writeln(cmd('$ cnode s1,>s2,s3') + ' : Create nodes s1, s2, s3; prefix ">" makes that node initial (e.g., >s2).')
  t.writeln(cmd('$ dnode s1,s2,...') + ' : Delete listed nodes and their incident edges.')
  t.writeln(cmd('$ initial s1') + ' : Mark listed node as initial.')
  t.writeln(cmd('$ final s1,s2,...') + ' : Mark listed nodes as final.')
  t.writeln(cmd('$ unfinal s1,s2,...') + ' : Unmark listed nodes as final.')
  t.writeln(cmd('$ dtrans s1 s2') + ' : Delete all transitions from s1 to s2.')
  t.writeln(cmd('$ dtrans s1 s2 i1,i2,...') + ' : Delete only s1→s2 transitions with these labels.')
  t.writeln(cmd('$ chtrans s1 s2 i1,i2,...') + ' : Replace ALL labels on s1→s2 with i1,i2,... (DFA totality validated).')
  t.writeln(header('Introspection'))
  t.writeln(cmd('$ mydfa') + ' : Print the 5-tuple (Q, Σ, q₀, F, δ).')
  t.writeln(cmd('$ allstates') + ' : List all states.')
  t.writeln(cmd('$ allfinal') + ' : List all final states.')
  t.writeln(cmd('$ allinitial') + ' : Show the initial state (if any).')
  t.writeln(cmd('$ alltransitions') + ' : List all transitions.')
  t.writeln(cmd('$ alphabet') + ' : List the alphabet (transition labels).')
  t.writeln(cmd('$ accept <word>') + ' : Check membership; prints "accepted" or "rejected".')
  t.writeln(header('Files'))
  t.writeln(cmd('$ save <name>') + ' : Save current view to <name>.json (DFA enforces completeness; BDD saves as-is).')
  t.writeln(cmd('$ load [right]') + ' : Load JSON; DFA goes to DFA view, generic/BDD goes to BDD view.')
  t.writeln(header('Set Operations'))
  t.writeln(cmd('$ union / intersect') + ' : Product of left & right DFAs (DFA view only).')
  t.writeln(header('BDD / Symbolic'))
  t.writeln(cmd('$ showbdd') + ' : Show BDD equivalent of the current DFA (enters read-only BDD view).')
  t.writeln(cmd('$ showmono [I|T|S|all]') + ' : Print monolithic I, T, S formula part(s).');
  t.writeln(cmd('$ back') + ' : Return from BDD view to DFA view.')
  t.writeln(header('Session'))
  t.writeln(cmd('$ undo') + ' : Undo the last successful command.')
  t.writeln(cmd('$ reset') + ' : Clear terminal and canvas.')
}

function downloadJson(json, name) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

// Build a compact DFA snapshot from nodes/links
function dfaSnapshot(nodes, links) {
  const Q  = nodes.map(n => n.id);
  const q0 = nodes.find(n => n.isInitial)?.id ?? null;
  const F  = nodes.filter(n => n.isFinal).map(n => n.id);
  const Σ  = [...new Set(
    (links || []).flatMap(l => (l.label || '')
      .split(',').map(s => s.trim()).filter(Boolean))
  )];
  const δ  = (links || []).flatMap(l => {
    const from = typeof l.source === 'string' ? l.source : l.source?.id;
    const to   = typeof l.target === 'string' ? l.target : l.target?.id;
    const labels = (l.label || '').split(',').map(s => s.trim()).filter(Boolean);
    return labels.map(a => [from, a, to]);
  });
  return { Q, Σ, q0, F, δ };
}

// Stable lexical encoding for states/labels
function buildEnc(snap) {
  const Qs = [...snap.Q].sort();
  const As = [...snap.Σ].sort();
  const qBits = Math.max(1, Math.ceil(Math.log2(Math.max(1, Qs.length))));
  const aBits = Math.max(1, Math.ceil(Math.log2(Math.max(1, As.length))));
  const encQ  = new Map(Qs.map((q,i) => [q, toBits(i, qBits)]));
  const encA  = new Map(As.map((a,i) => [a, toBits(i, aBits)]));
  return { qBits, aBits, encQ, encA };
}

function toBits(idx, width) {
  const bits = [];
  for (let b=0; b<width; b++) bits.push(((idx >> b) & 1) ? 1 : 0); // little-endian
  return bits;
}

// Conjunction like (x0 ∧ ¬x1 ∧ x2)
function cube(bits, base) {
  return bits.map((bit, i) => bit ? `${base}${i}` : `¬${base}${i}`).join(' ∧ ');
}

// Build I, T, S strings
function buildMonolithic(snap, enc) {
  // I(x)
  const q0bits = enc.encQ.get(snap.q0 ?? snap.Q[0]) || toBits(0, enc.qBits);
  const I = cube(q0bits, 'x');

  // S(x′)
  const finals = snap.F || [];
  const S = finals.length
    ? finals.map(f => `(${cube(enc.encQ.get(f), "x'")})`).join(' ∨ ')
    : 'false';

  // T(x,a,x′)
  const terms = snap.δ.map(([p,a,q]) => {
    const px = cube(enc.encQ.get(p), 'x');
    const aa = cube(enc.encA.get(a), 'a');
    const qx = cube(enc.encQ.get(q), "x'");
    return `(${px}) ∧ (${aa}) ∧ (${qx})`;
  });
  const T = terms.length ? terms.map(s => `(${s})`).join(' ∨ ') : 'false';

  return { I, T, S };
}

// Cyan output color for formulas
function colorMono(s) { return `\x1b[36m${s}\x1b[0m`; }

function toScript(graph) {
  const nodes = graph.nodes ?? [];
  const links = graph.links ?? [];
  const initial = nodes.find(n => n.isInitial)?.id || '';
  const regular = nodes.filter(n => !n.isInitial).map(n => n.id);
  const lines = [];

  // cnode line (initial first, then others)
  const cnodeArgs = [initial ? '>' + initial : null, ...regular].filter(Boolean).join(',');
  if (cnodeArgs) lines.push(`cnode ${cnodeArgs}`);

  // finals (don’t mark the initial as final to avoid parser conflict)
  nodes.filter(n => n.isFinal && !n.isInitial).forEach(n => lines.push(`final ${n.id}`));

  // transitions, one label per line
  links.forEach(l => {
    const from = typeof l.source === 'string' ? l.source : l.source.id;
    const to   = typeof l.target === 'string' ? l.target : l.target.id;
    (l.label || '').split(',').map(s => s.trim()).filter(Boolean)
      .forEach(lbl => lines.push(`${from} ${to} ${lbl}`));
  });

  return lines;
}
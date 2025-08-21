# DFA CLI Visualizer (React + D3 + xterm)

An interactive, terminal-driven tool to define, visualize, and manipulate Deterministic Finite Automata (DFA) — with optional Binary Decision Diagram (BDD) views.

## Features

- Terminal-first UX — create states, transitions, and run queries like a shell.

- Live DFA canvas (D3) — drag, pin/unpin, and see updates instantly.

- Determinism & totality helpers — duplicate-label checks and friendly reminders.

- Set operations — union, intersect, and complement.

- BDD views

- showbdd — relational BDD of T(x, a, x′) with symbolic steps.

- accept <word> — symbolic membership.

- Undo & Save/Load — undo last command; save/load DFAs as JSON.

- Resizable terminal panel — drag the terminal header to resize (VS Code-style).

- Inline Manual — click Help or visit #/manual.
// src/components/ManualPage.jsx
export default function ManualPage() {
  const goBack = () => { window.location.hash = ''; };

  return (
    <div className="manual-page">
      <div className="manual-header">
        <button className="back-btn" onClick={goBack}>← Back</button>
        <h1>Manual</h1>
      </div>

      <div className="manual-body">
        <p>
          This page mirrors the <code>$ manual</code> output with a few extras.
          DFA must be deterministic and total (one outgoing edge per label from each state).
        </p>

        <h2>Building & Editing</h2>
        <pre>
$ &lt;from&gt; &lt;to&gt; &lt;labels&gt;   Add transition(s). Labels comma-separated (e.g., 0,1).
$ cnode s1,&gt;s2,s3        Create nodes; prefix "&gt;" marks the initial.
$ dnode s1,s2,...         Delete nodes (and incident edges).
$ final s1,s2,...         Mark nodes final.
$ unfinal s1,s2,...       Unmark final.
$ dtrans s1 s2            Delete all s1→s2 transitions.
$ dtrans s1 s2 i1,i2,...  Delete only those labels.
$ chtrans s1 s2 i1,i2,... Replace labels on s1→s2 (keeps DFA total).
        </pre>

        <h2>Introspection</h2>
        <pre>
$ mydfa            Print 5-tuple (Q, Σ, q₀, F, δ).
$ allstates        List states.
$ allfinal         List final states.
$ allinitial       Show the initial state.
$ alltransitions   List transitions.
$ alphabet         List Σ (labels).
        </pre>

        <h2>Files</h2>
        <pre>
$ save &lt;name&gt;     Save DFA to &lt;name&gt;.json
$ load             Load into left slot (default).
$ load right       Load into right slot.
        </pre>

        <h2>Set Operations</h2>
        <pre>
$ union            Left ∪ Right
$ intersect        Left ∩ Right
        </pre>

        <h2>BDD / Symbolic</h2>
        <pre>
$ showbdd          Snapshot BDD (I ∧ T ∧ S).
$ showbdd+         Relational BDD T(x, a, x′).
$ bdd-js           Download BDD as Graphviz .dot.
$ accept &lt;word&gt;   Check membership ("accepted"/"rejected").
        </pre>

        <h2>Session</h2>
        <pre>
$ undo             Undo last successful command.
$ reset            Clear terminal and canvas.
        </pre>

        <p className="note">
          Tip: You can also mark initial inline in transitions:
          <code> &gt;a b 1 </code> or <code> a &gt;b 1 </code> (both supported by the parser fix).
        </p>
      </div>
    </div>
  );
}

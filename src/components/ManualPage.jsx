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
          This DFA CLI visualiser lets you use commands in a terminal-like input box to create, edit and store DFAs.
          The terminal will generate friendly reminders to achieve totality, report any violations in syntax or determinism.
          <br /> <h3>The exhaustive list of commands is given below:</h3>
        </p>

        <h2>Building & Editing</h2>
        <pre>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">&lt;from&gt;</span> <span className="arg">&lt;to&gt; &lt;labels&gt;</span>    <span className="desc">Add transition(s). Labels comma-separated (e.g., 0,1).</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">cnode</span> <span className="arg">s1,&gt;s2,s3</span>         <span className="desc">Create nodes; prefix “&gt;” marks the initial.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">dnode</span> <span className="arg">s1,s2,...</span>         <span className="desc">Delete nodes (and incident edges).</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">initial</span> <span className="arg">s1</span>              <span className="desc">Marks node initial or changes a previuos initial node to current argument.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">final</span> <span className="arg">s1,s2,...</span>         <span className="desc">Mark nodes final.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">unfinal</span> <span className="arg">s1,s2,...</span>       <span className="desc">Unmark final.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">dtrans</span> <span className="arg">s1 s2</span>            <span className="desc">Delete all s1→s2 transitions.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">dtrans</span> <span className="arg">s1 s2 i1,i2,...</span>  <span className="desc">Delete only those labels.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">chtrans</span> <span className="arg">s1 s2 i1,i2,...</span> <span className="desc">Replace labels on s1→s2.</span>
</span>
        </pre>

        <h2>Introspection</h2>
        <pre>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">mydfa</span>            <span className="desc">Print 5-tuple (Q, Σ, q₀, F, δ).</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">allstates</span>        <span className="desc">List states.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">allfinal</span>         <span className="desc">List final states.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">allinitial</span>       <span className="desc">Show the initial state.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">alltransitions</span>   <span className="desc">List transitions.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">alphabet</span>         <span className="desc">List Σ (labels).</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">accept</span> <span className="arg">&lt;word&gt;</span>    <span className="desc">Check membership (“accepted”/“rejected”).</span>
</span>
        </pre>

        <h2>Files</h2>
        <pre>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">save</span> <span className="arg">&lt;name&gt;</span>      <span className="desc">Save DFA to &lt;name&gt;.json</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">load</span>             <span className="desc">Load into left slot (default).</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">load</span> <span className="arg">right</span>       <span className="desc">Load into right slot.</span>
</span>
        </pre>

        <h2>Set Operations</h2>
        <pre>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">union</span>            <span className="desc">left ∪ right</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">intersect</span>        <span className="desc">left ∩ right</span>
</span>
        </pre>

        <h2>BDD / Symbolic</h2>
      <span className="note">The BDD represents the monolithic partition of the DFA. Where T is the </span>
        <pre>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">showbdd</span>                  <span className="desc">Relational BDD T(x, a, x′), corresponding to the monolithic representation of the DFA.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">showmono</span> <span className="arg">[I|T|S|all]</span>     <span className="desc">Print monolithic I, T, S formula part(s).</span>
</span>


        </pre>

        <h2>Session</h2>
        <pre>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">undo</span>             <span className="desc">Undo last successful command.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">reset</span>            <span className="desc">Clear terminal and canvas.</span>
</span>
        </pre>

        <h2>Help</h2>
        <pre>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">?</span>                 <span className="desc">Print command manual in terinal.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">help</span>              <span className="desc">Print command manual in terinal.</span>
</span>
<span className="ln">
  <span className="prompt">$</span> <span className="cmd">manual</span>            <span className="desc">Print command manual in terinal.</span>
</span>
        </pre>

        <p className="note">
          Tips: 
          <li>You can also mark initial inline in transitions:
          <code>&gt;a b 1 </code>.</li>
          <li><code>$save</code> is only possible when the created transition system is a DFA.</li>
        </p>
      </div>
    </div>
  );
}

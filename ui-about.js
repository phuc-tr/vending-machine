// About page: the story of the project. Facts (classes, objects, views, events,
// author, dates) are read live from the extracted jjodel model.
(function () {
  const html = htm.bind(React.createElement);
  const J = window.JJ.J;

  // ------------------------------------------------------------ metamodel diagram
  // Layers the classes left→right by reference depth from the root (the class nobody references).
  function layoutMetamodel() {
    const mm = J.metamodel, names = Object.keys(mm);
    const targets = new Set(names.flatMap(n => Object.values(mm[n].references).map(r => r.type)));
    const roots = names.filter(n => !targets.has(n) && Object.keys(mm[n].references).length);
    const depth = {};
    const queue = roots.map(r => [r, 0]);
    while (queue.length) {
      const [n, d] = queue.shift();
      if (depth[n] != null && depth[n] <= d) continue;
      depth[n] = d;
      Object.values(mm[n].references).forEach(r => mm[r.type] && queue.push([r.type, d + 1]));
    }
    names.forEach(n => { if (depth[n] == null) depth[n] = 0; });
    const W = 156, GX = 92, GY = 14, HEAD = 26, ROW = 15;
    const cols = [];
    names.forEach(n => (cols[depth[n]] ||= []).push(n));
    // order each column by where its parents sit (and the parent's reference order) to avoid crossings
    for (let ci = 1; ci < cols.length; ci++) {
      const rank = n => {
        let best = Infinity;
        cols[ci - 1].forEach((p, pi) => Object.values(mm[p].references).forEach((r, ri) => { if (r.type === n) best = Math.min(best, pi * 100 + ri); }));
        return best;
      };
      cols[ci].sort((a, b) => rank(a) - rank(b));
    }
    const boxes = {};
    let maxH = 0;
    cols.forEach((col, ci) => {
      let y = 0;
      col.forEach(n => {
        const h = HEAD + Math.max(1, Object.keys(mm[n].attributes).length) * ROW + 8;
        boxes[n] = { x: ci * (W + GX), y, w: W, h };
        y += h + GY;
      });
      maxH = Math.max(maxH, y - GY);
    });
    cols.forEach(col => { // centre each column vertically
      const colH = col.reduce((t, n) => t + boxes[n].h + GY, -GY);
      col.forEach(n => (boxes[n].y += (maxH - colH) / 2));
    });
    const edges = names.flatMap(n => Object.entries(mm[n].references).filter(([, r]) => boxes[r.type]).map(([f, r]) => ({ from: n, to: r.type, name: f, mult: r.upper === -1 ? `${r.lower}..*` : r.lower === r.upper ? `${r.lower}` : `${r.lower}..${r.upper}` })));
    return { boxes, edges, width: cols.length * (W + GX) - GX, height: maxH, HEAD, ROW };
  }

  function MetamodelDiagram() {
    const { boxes, edges, width, height, HEAD, ROW } = React.useMemo(layoutMetamodel, []);
    const mm = J.metamodel;
    const pad = 12;
    return html`
      <div className="mm-scroll">
        <div className="mm" style=${{ width: width + pad * 2, height: height + pad * 2 }}>
          <svg width=${width + pad * 2} height=${height + pad * 2} aria-hidden="true">
            <defs><marker id="mm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="currentColor"/></marker></defs>
            ${edges.map((e, i) => {
              const a = boxes[e.from], b = boxes[e.to];
              const x1 = pad + a.x + a.w, y1 = pad + a.y + 14, x2 = pad + b.x, y2 = pad + b.y + 14;
              return html`<g key=${i} className="mm-edge">
                <path d=${`M${x1} ${y1} C${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}`} fill="none" marker-end="url(#mm-arrow)" />
                <text x=${x2 - 6} y=${y2 - 5} text-anchor="end">${e.name} ${e.mult}</text>
              </g>`;
            })}
          </svg>
          ${Object.entries(boxes).map(([n, b]) => html`
            <div key=${n} className="mm-class" style=${{ left: pad + b.x, top: pad + b.y, width: b.w, height: b.h }}>
              <b style=${{ height: HEAD }}>${n}</b>
              <ul>${Object.keys(mm[n].attributes).length
                ? Object.entries(mm[n].attributes).map(([a, t]) => html`<li key=${a} style=${{ height: ROW }}>${a}<i>: ${t.type}${t.lower === 1 ? '' : ' [0..1]'}</i></li>`)
                : html`<li className="none" style=${{ height: ROW }}>—</li>`}</ul>
            </div>`)}
        </div>
      </div>`;
  }

  // ------------------------------------------------------------ the page
  function About({ open, onClose }) {
    const ref = React.useRef(null);
    React.useEffect(() => {
      if (!open) return;
      const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
      window.addEventListener('keydown', onKey, true);
      ref.current && ref.current.focus();
      return () => window.removeEventListener('keydown', onKey, true);
    }, [open]);
    if (!open) return null;

    const meta = J.meta || {};
    const classes = Object.keys(J.metamodel);
    const csViews = J.views.filter(v => v.jsx.trim());
    const events = J.views.flatMap(v => Object.entries(v.events || {}).map(([name, code]) => ({ name, code, cls: v.appliesTo })));
    const date = t => t ? new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const author = meta.author ? meta.author.replace(/([a-z])([A-Z])/g, '$1 $2') : null;
    const insert = events.find(e => e.name === 'insertCoin');
    // describe the model as authored in jjodel, not the app's restocked copy
    const original = J.originalObjects || window.JJ.pristine();
    const counts = {}; original.forEach(o => { if (o.class !== 'Product' || (o.features.name || []).length) counts[o.class] = (counts[o.class] || 0) + 1; });

    return html`
      <div className="about-backdrop" onClick=${e => e.target === e.currentTarget && onClose()}>
        <article className="about" role="dialog" aria-modal="true" aria-labelledby="about-title" tabIndex="-1" ref=${ref}>
          <button className="icon-btn about-close" onClick=${onClose} aria-label="Close">×</button>

          <header className="about-hero">
            <figure className="about-photo">
              <img src="assets/jjodel-class.jpg" alt="Holding jjodel stickers (“Metamodeling for all.”) in the lab during the MDE course at Univaq" draggable="false" />
              <figcaption>In the lab at Univaq</figcaption>
            </figure>
            <span className="about-kicker">Model-Driven Engineering</span>
            <h1 id="about-title">A vending machine, modelled first</h1>
            <p className="about-lede">
              I built this vending machine for my <b>Model-Driven Engineering (MDE)</b> course at the
              <b> University of L'Aquila (Univaq)</b>, using <b>jjodel</b>, a web-based platform for metamodelling
              and graphical modelling. The project received the top grade, <b>30/30</b>. I didn't start
              by writing an app. I described the domain as a <em>metamodel</em>, built a <em>model</em> that
              conforms to it, and then taught jjodel how that model should look and behave.
            </p>
            <p className="about-by">${author ? html`By <b>${author}</b> · ` : null}started ${date(meta.created)}${meta.jjodelVersion ? ` · jjodel ${meta.jjodelVersion}` : ''}</p>
          </header>

          <section>
            <h2>What I had to build</h2>
            <ol className="about-steps">
              <li><b>Metamodel</b><span>The language of vending machines: ${classes.length} classes such as Machine, Shelf, Slot, Product, CoinSlot and Denomination, with their attributes, references and multiplicities (a machine owns at most 4 shelves, a shelf at most 4 slots, a dispenser 1 to 5 coin slots).</span></li>
              <li><b>Model</b><span>One concrete machine that conforms to it: ${counts.Shelf || 0} shelves, ${counts.Slot || 0} slots, ${counts.Product || 0} products, ${counts.CoinSlot || 0} coin tubes and ${counts.Denomination || 0} denominations. (This app restocks it with ${window.JJ.pristine().filter(o => o.class === 'Product').length} products.)</span></li>
              <li><b>Concrete syntax</b><span>A “${(meta.viewpoints || [])[0] || 'Concrete Syntax'}” viewpoint with ${csViews.length} views written in JSX and CSS, one per class: ${csViews.map(v => v.appliesTo).join(', ')}. Each view only draws its own object and asks jjodel to render the objects it contains.</span></li>
              <li><b>Behaviour</b><span>A “${(meta.viewpoints || [])[1] || 'Behavior'}” viewpoint with events that change the model: ${events.map(e => html`<code key=${e.name}>${e.cls}.${e.name}</code>`).reduce((a, x, i) => i ? [...a, ', ', x] : [x], [])}. Inserting a coin or pressing OK edits attribute values, and every view updates by itself.</span></li>
            </ol>
          </section>

          <section>
            <h2>The metamodel</h2>
            <p className="muted">Drawn from the exported jjodel project: every class with its attributes, and every reference with its multiplicity.</p>
            <${MetamodelDiagram} />
          </section>

          <section>
            <h2>What was hard</h2>
            <div className="about-cards">
              <div className="about-card">
                <h3>🧩 Making it work at all</h3>
                <p>Thinking in models instead of code was the biggest shift. Everything has to be a class,
                  an attribute or a reference first, and only then can it be drawn or animated. Getting from an
                  empty canvas to a machine that actually sells something took a lot of trial and error.</p>
              </div>
              <div className="about-card">
                <h3>🪙 Denominations and change</h3>
                <p>Money is not just a number here. Each <code>Denomination</code> is its own object, and each
                  <code>CoinSlot</code> tube tracks <code>inStorage</code> and the customer's <code>balance</code>.
                  Credit is Σ balance × value. Change has to come from coins that are physically in the tubes,
                  and the machine has to know when it can't pay it out.</p>
              </div>
              <div className="about-card">
                <h3>🎨 CSS inside a modelling tool</h3>
                <p>Every view has its own scoped, nested stylesheet. Placing the display, keypad, coin box and
                  pickup flap inside the Machine view, stacking product images by <code>quantity</code>, and
                  drawing coils, metal and LED price tags all had to be done one view at a time.</p>
              </div>
              <div className="about-card">
                <h3>🧭 Navigating the model</h3>
                <p>Views and events only see their own object, so they have to walk the model to reach
                  anything else: <code>data.parent.parent</code> from the display to its panel, or
                  <code>allSubObjects.filter(…).first()</code> to find the machine that owns a coin insert.</p>
              </div>
              <div className="about-card">
                <h3>🗂 Model vs. UI state</h3>
                <p>Stock, prices and coins belong in the model. The keypad input, display messages and items
                  in the pickup box are transient, so they live in each node's <code>state</code>.
                  Deciding which is which took several attempts.</p>
              </div>
              <div className="about-card">
                <h3>✅ Keeping it valid</h3>
                <p>The Slot view checks its own data on every update (<code>quantity > capacity</code>). The
                  multiplicities in the metamodel say what a well-formed machine looks like. The Service → Model
                  tab of this app reports the same kind of problems.</p>
              </div>
            </div>
          </section>

          ${insert && html`
            <section>
              <h2>A piece of the behaviour</h2>
              <p className="muted">The actual <code>insertCoin</code> event from my model's Behavior viewpoint. This app still calls it every time you drop a coin in.</p>
              <pre className="about-code"><code>${insert.code}</code></pre>
            </section>`}

          <section>
            <h2>From jjodel to this page</h2>
            <p>The jjodel export is unpacked into the metamodel, model, views and events. A small runtime
              re-implements the parts of jjodel's API my views use (<code>data.$feature.value</code>,
              <code>node.events</code>, <code>state</code>…). The <b>jjodel views</b> tab renders my original
              views unchanged. I then built the <b>Machine</b> tab with Claude Code: a richer
              interface over the <em>same</em> model, so every coin, sale and restock is still a change to
              model objects.</p>
          </section>

          <footer className="about-foot">
            <span>Univaq · Model-Driven Engineering · built with jjodel · 30/30</span>
            <button className="btn primary" onClick=${onClose}>Back</button>
          </footer>
        </article>
      </div>`;
  }

  window.AboutUI = { About };
})();

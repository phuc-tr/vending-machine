// Service mode drawer: every edit writes straight into the jjodel model objects.
(function () {
  const html = htm.bind(React.createElement);
  const { useModel, onImgError, obj } = window.JJ;
  const VM = window.VM;
  const { useSession } = window.MachineUI;

  const num = v => (v === '' || v == null ? null : Number(v));
  const imgOf = p => (p && p.$image_url.value) || '';

  function Stepper({ value, onChange, min = 0, max, label }) {
    const v = value ?? 0;
    return html`
      <span className="stepper" role="group" aria-label=${label}>
        <button onClick=${() => onChange(Math.max(min, v - 1))} aria-label=${'Decrease ' + label}>−</button>
        <input type="number" value=${value ?? ''} min=${min} max=${max} onChange=${e => onChange(num(e.target.value))} aria-label=${label} />
        <button onClick=${() => onChange(max != null ? Math.min(max, v + 1) : v + 1)} aria-label=${'Increase ' + label}>+</button>
      </span>`;
  }

  // ------------------------------------------------------------ stock
  function SlotRow({ s, focused }) {
    const ref = React.useRef(null);
    React.useEffect(() => { if (focused && ref.current) { ref.current.scrollIntoView({ block: 'center', behavior: 'smooth' }); } }, [focused]);
    const p = s.$product.value, q = s.$quantity.value, cap = s.$capacity.value;
    const over = q != null && cap != null && q > cap;
    return html`
      <div ref=${ref} className=${'slot-row' + (focused ? ' focused' : '') + (over ? ' bad' : '')}>
        <div className="thumb">${p ? html`<img src=${imgOf(p)} alt="" onError=${onImgError} />` : html`<span>empty</span>`}</div>
        <div className="slot-fields">
          <label className="mini-field code"><span>Code</span>
            <input value=${s.$slot_id.value ?? ''} maxLength="3" onChange=${e => (s.$slot_id.value = e.target.value || null)} /></label>
          <label className="mini-field grow"><span>Product</span>
            <select value=${p ? p.id : ''} onChange=${e => (s.$product.value = e.target.value || null)}>
              <option value="">— empty —</option>
              ${VM.products().map(x => html`<option key=${x.id} value=${x.id}>${VM.productName(x) || x.name}</option>`)}
            </select></label>
          <label className="mini-field price"><span>Price $</span>
            <input type="number" min="0" step="0.5" value=${s.$price.value ?? ''} onChange=${e => (s.$price.value = num(e.target.value))} /></label>
          <div className="mini-field"><span>Stock</span>
            <${Stepper} label="quantity" value=${q} max=${cap ?? undefined} onChange=${v => (s.$quantity.value = v)} /></div>
          <div className="mini-field"><span>Capacity</span>
            <${Stepper} label="capacity" value=${cap} min=${0} onChange=${v => (s.$capacity.value = v)} /></div>
        </div>
        ${cap ? html`<i className="stock-bar"><i style=${{ width: Math.min(100, (q || 0) / cap * 100) + '%' }}></i></i>` : null}
      </div>`;
  }

  function Stock({ focus }) {
    const restock = () => window.JJ.batch(() => VM.slots().forEach(s => {
      if (!s.$product.value) return;
      const cap = s.$capacity.value;
      s.$quantity.value = cap != null ? cap : Math.max(s.$quantity.value || 0, 6);
    }));
    return html`
      <div className="svc-actions">
        <button className="btn primary" onClick=${restock}>Restock all</button>
        <span className="muted">Fills every slot that has a product up to its capacity.</span>
      </div>
      ${VM.shelves().map((sh, i) => html`
        <section key=${sh.id} className="svc-group">
          <h3>Shelf ${i + 1} <small>${sh.name}</small></h3>
          ${sh.$ownedSlots.values.map(s => html`<${SlotRow} key=${s.id} s=${s} focused=${focus === s.id} />`)}
        </section>`)}`;
  }

  // ------------------------------------------------------------ products
  function Products() {
    const add = () => window.JJ.create('Product', { name: 'New product', image_url: '' });
    const inUse = id => VM.slots().filter(s => s.$product.value && s.$product.value.id === id).map(VM.code);
    return html`
      <div className="svc-actions"><button className="btn primary" onClick=${add}>Add product</button></div>
      <div className="prod-grid">
        ${VM.products().map(p => html`
          <div key=${p.id} className="prod-card">
            <div className="prod-img">${imgOf(p) ? html`<img src=${imgOf(p)} alt="" onError=${onImgError} />` : html`<span>no image</span>`}</div>
            <label className="mini-field"><span>Name</span><input value=${p.$name.value ?? ''} onChange=${e => (p.$name.value = e.target.value)} /></label>
            <label className="mini-field"><span>Image URL</span><input value=${p.$image_url.value ?? ''} onChange=${e => (p.$image_url.value = e.target.value)} /></label>
            <div className="prod-foot">
              <span className="muted">${inUse(p.id).length ? 'In slots ' + inUse(p.id).join(', ') : 'Not stocked'}</span>
              ${!inUse(p.id).length && html`<button className="link danger" onClick=${() => window.JJ.remove(p.id)}>Delete</button>`}
            </div>
          </div>`)}
      </div>`;
  }

  // ------------------------------------------------------------ cash
  function Cash() {
    const sess = useSession();
    const tubes = VM.coinSlots();
    const stored = tubes.reduce((t, cs) => t + (cs.$inStorage.value || 0) * (VM.denomOf(cs) || 0), 0);
    const revenue = sess.sales.reduce((t, s) => t + (s.price || 0), 0);
    const collect = () => window.JJ.batch(() => tubes.forEach(cs => { cs.$inStorage.value = Math.min(cs.$inStorage.value || 0, 5); }));
    const float = () => window.JJ.batch(() => tubes.forEach(cs => { cs.$inStorage.value = Math.max(cs.$inStorage.value || 0, 10); }));
    return html`
      <div className="kpis">
        <div><span>In tubes</span><b>${VM.fmt(stored)}</b></div>
        <div><span>Credit inserted</span><b>${VM.fmt(VM.credit())}</b></div>
        <div><span>Revenue</span><b>${VM.fmt(revenue)}</b></div>
      </div>
      <div className="tubes">
        ${tubes.map(cs => {
          const d = VM.denomOf(cs), n = cs.$inStorage.value || 0, b = cs.$balance.value || 0;
          return html`
            <div key=${cs.id} className="tube">
              <div className="tube-glass">
                ${Array.from({ length: Math.min(n, 24) }, (_, i) => html`<i key=${'s' + i} className=${'coin coin-r' + VM.accepted().indexOf(d)}></i>`)}
                ${Array.from({ length: Math.min(b, 8) }, (_, i) => html`<i key=${'b' + i} className="coin balance"></i>`)}
              </div>
              <b>${VM.fmt(d)}</b>
              <${Stepper} label=${`$${d} coins in storage`} value=${n} onChange=${v => (cs.$inStorage.value = v)} />
              ${b ? html`<small className="muted">+${b} inserted</small>` : null}
            </div>`;
        })}
      </div>
      <div className="svc-actions">
        <button className="btn" onClick=${collect}>Collect cash (leave 5 each)</button>
        <button className="btn" onClick=${float}>Refill float to 10</button>
      </div>
      <p className="muted">Green coins are the current customer's credit (CoinSlot.balance). Gold coins are stored change (CoinSlot.inStorage). The EXACT CHANGE lamp is lit when the tubes can't pay out every amount below the largest coin.</p>`;
  }

  // ------------------------------------------------------------ sales
  function Sales() {
    const sess = useSession();
    const byProduct = {};
    sess.sales.forEach(s => { byProduct[s.product] = byProduct[s.product] || { n: 0, sum: 0 }; byProduct[s.product].n++; byProduct[s.product].sum += s.price || 0; });
    const rows = Object.entries(byProduct).sort((a, b) => b[1].sum - a[1].sum);
    const max = Math.max(1, ...rows.map(r => r[1].sum));
    return html`
      ${rows.length ? html`
        <div className="bars">
          ${rows.map(([name, r]) => html`<div key=${name} className="bar-row"><span>${name}</span><i><i style=${{ width: r.sum / max * 100 + '%' }}></i></i><b>${VM.fmt(r.sum)}</b><small>${r.n}×</small></div>`)}
        </div>` : html`<p className="muted">No sales yet.</p>`}
      <ol className="sales-log">
        ${sess.sales.slice().reverse().slice(0, 40).map((s, i) => html`
          <li key=${i}><time>${new Date(s.t).toLocaleTimeString()}</time><span>${s.code} ${s.product}</span><b>${VM.fmt(s.price)}</b></li>`)}
      </ol>
      ${sess.sales.length ? html`<div className="svc-actions"><button className="btn" onClick=${() => VM.set({ sales: [] })}>Clear sales log</button></div>` : null}`;
  }

  // ------------------------------------------------------------ model
  function ModelTab({ onFocus }) {
    const list = VM.issues();
    const fileRef = React.useRef(null);
    const counts = {};
    Object.values(window.JJ.raw).forEach(o => (counts[o.class] = (counts[o.class] || 0) + 1));
    const exportJson = () => {
      const blob = new Blob([JSON.stringify({ project: window.JJ.J.project, metamodel: window.JJ.J.metamodel, objects: window.JJ.snapshot() }, null, 2)], { type: 'application/json' });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'vending-machine.model.json' });
      a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const importJson = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(t => { const d = JSON.parse(t); if (Array.isArray(d.objects)) window.JJ.load(d.objects); else throw new Error('No objects'); })
        .catch(err => window.VM.say('IMPORT FAILED', 'error')).finally(() => (e.target.value = ''));
    };
    return html`
      <h3 className="svc-h">Health</h3>
      ${list.length ? html`<ul className="issues">${list.map((x, i) => html`
        <li key=${i} className=${'lvl-' + x.level}>
          <span>${x.text}</span>
          ${x.obj && window.JJ.raw[x.obj] && window.JJ.raw[x.obj].class === 'Slot' && html`<button className="link" onClick=${() => onFocus(x.obj)}>Fix</button>`}
        </li>`)}</ul>` : html`<p className="ok-line">✓ No problems found</p>`}
      <h3 className="svc-h">Model</h3>
      <p className="muted">${window.JJ.J.model} conforms to the metamodel of “${window.JJ.J.project}”. Objects by class:</p>
      <div className="class-chips">${Object.entries(counts).sort().map(([c, n]) => html`<span key=${c}>${c} <b>${n}</b></span>`)}</div>
      <div className="svc-actions wrap">
        <button className="btn" onClick=${exportJson}>Export JSON</button>
        <button className="btn" onClick=${() => fileRef.current.click()}>Import JSON</button>
        <input ref=${fileRef} type="file" accept="application/json" hidden onChange=${importJson} />
        <button className="btn danger" onClick=${() => confirm('Reset the machine, wallet and sales to the original model?') && VM.resetAll()}>Factory reset</button>
      </div>`;
  }

  const TABS = [['stock', 'Stock'], ['products', 'Products'], ['cash', 'Cash'], ['sales', 'Sales'], ['model', 'Model']];

  function ServicePanel({ open, onClose, focus, setFocus, tab, setTab }) {
    useModel(); useSession();
    const issues = VM.issues().filter(i => i.level !== 'info').length;
    return html`
      <aside className=${'svc' + (open ? ' open' : '')} aria-hidden=${!open} aria-label="Service panel">
        <div className="svc-head">
          <div><h2>Service</h2><p>Edits write straight to the model</p></div>
          <button className="icon-btn" onClick=${onClose} aria-label="Close service panel">×</button>
        </div>
        <nav className="tabs" role="tablist">
          ${TABS.map(([k, label]) => html`<button key=${k} role="tab" aria-selected=${tab === k} className=${tab === k ? 'on' : ''} onClick=${() => setTab(k)}>
            ${label}${k === 'model' && issues ? html`<span className="badge">${issues}</span>` : null}</button>`)}
        </nav>
        <div className="svc-body">
          ${tab === 'stock' && html`<${Stock} focus=${focus} />`}
          ${tab === 'products' && html`<${Products} />`}
          ${tab === 'cash' && html`<${Cash} />`}
          ${tab === 'sales' && html`<${Sales} />`}
          ${tab === 'model' && html`<${ModelTab} onFocus=${id => { setFocus(id); setTab('stock'); }} />`}
        </div>
      </aside>`;
  }

  window.ServiceUI = { ServicePanel };
})();

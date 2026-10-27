// App shell: top bar, view switch (machine / original jjodel views), fit-to-screen
// stage, wallet dock and service drawer.
(function () {
  const h = React.createElement;
  const html = htm.bind(h);
  const { J, obj, raw, DefaultNode, useModel } = window.JJ;
  const { Machine, Dock } = window.MachineUI;
  const { ServicePanel } = window.ServiceUI;
  const { About } = window.AboutUI;
  const VM = window.VM;

  // Fix for the model's Behavior: ok_action never clears the keypad, so the next
  // code would be appended to the previous one. Clear it after every OK.
  window.JJ.afterEvent('NumPad', 'ok_action', numPad => { numPad.state = { ...numPad.state, input: '' }; });

  const pref = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
  const setPref = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  // Pan & zoom camera for the canvas. Starts fitted to the space between the top bar
  // and the dock; wheel/pinch zooms at the pointer, dragging pans. A drag never
  // turns into a click, so the machine's buttons keep working.
  const MIN_ZOOM = 0.15, MAX_ZOOM = 4;
  function usePanZoom(canvasRef, stageRef, deps) {
    const cam = React.useRef({ x: 0, y: 0, s: 1, touched: false });
    const [zoom, setZoom] = React.useState(1);
    const apply = () => {
      const { x, y, s } = cam.current, stage = stageRef.current;
      if (stage) stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
      if (canvasRef.current) canvasRef.current.classList.toggle('cam-moved', cam.current.touched);
      setZoom(s);
    };
    const zoomAt = (s, px, py) => {
      const c = cam.current, ns = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s));
      c.x = px - (px - c.x) * (ns / c.s); c.y = py - (py - c.y) * (ns / c.s); c.s = ns; c.touched = true;
      apply();
    };
    const fit = React.useCallback(() => {
      const canvas = canvasRef.current, stage = stageRef.current; if (!canvas || !stage) return;
      const cs = getComputedStyle(canvas);
      const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight), pt = parseFloat(cs.paddingTop), pb = parseFloat(cs.paddingBottom);
      const availW = canvas.clientWidth - pl - pr, availH = canvas.clientHeight - pt - pb;
      stage.classList.remove('stacked');
      if (stage.offsetWidth > availW && availW < 1100) stage.classList.add('stacked');
      const main = stage.querySelector('.fit-main');
      const w = stage.offsetWidth, h = stage.classList.contains('stacked') && main ? main.offsetHeight : stage.offsetHeight;
      const s = Math.max(MIN_ZOOM, Math.min(1.15, availW / w, availH / h));
      Object.assign(cam.current, { s, x: pl + (availW - w * s) / 2, y: pt + Math.max(0, (availH - h * s) / 2) * (stage.classList.contains('stacked') ? 0 : 1), touched: false });
      apply();
    }, []);

    // fit on view/drawer change and on resize (until the user moves the camera)
    React.useLayoutEffect(() => {
      fit();
      const ro = new ResizeObserver(() => { if (!cam.current.touched) fit(); });
      ro.observe(canvasRef.current);
      return () => ro.disconnect();
    }, deps);

    React.useEffect(() => {
      const canvas = canvasRef.current;
      const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
      const onWheel = e => {
        e.preventDefault();
        const p = local(e), c = cam.current;
        const trackpadPan = !e.ctrlKey && e.deltaMode === 0 && (Math.abs(e.deltaX) > 0 || Math.abs(e.deltaY) < 40);
        if (trackpadPan) { c.x -= e.deltaX; c.y -= e.deltaY; c.touched = true; apply(); return; }
        const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
        zoomAt(c.s * Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)), p.x, p.y);
      };
      // pointers: one = pan, two = pinch
      const pts = new Map();
      let pan = null, pinch = null, suppressClick = false;
      const noPan = t => t.closest('input, select, textarea, .zoom-ctl, .side-card, .about-btn');
      const onDown = e => {
        if (e.button === 2 || noPan(e.target)) return;
        pts.set(e.pointerId, local(e));
        if (pts.size === 1) pan = { start: local(e), cam: { ...cam.current }, moved: e.button === 1, id: e.pointerId };
        if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: cam.current.s, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, cam: { ...cam.current } }; pan = null; }
        if (e.pointerType === 'mouse' && !e.target.closest('input, select, textarea')) e.preventDefault();
      };
      const onMove = e => {
        if (!pts.has(e.pointerId)) return;
        const p = local(e); pts.set(e.pointerId, p);
        if (pinch && pts.size >= 2) {
          const [a, b] = [...pts.values()];
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          Object.assign(cam.current, pinch.cam);
          zoomAt(pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, pinch.mid.x, pinch.mid.y);
          cam.current.x += mid.x - pinch.mid.x; cam.current.y += mid.y - pinch.mid.y; apply();
          suppressClick = true; return;
        }
        if (!pan || pan.id !== e.pointerId) return;
        const dx = p.x - pan.start.x, dy = p.y - pan.start.y;
        if (!pan.moved && Math.hypot(dx, dy) < 5) return;
        if (!pan.moved) { pan.moved = true; canvas.setPointerCapture(e.pointerId); canvas.classList.add('panning'); document.body.classList.add('panning'); window.getSelection()?.removeAllRanges(); }
        Object.assign(cam.current, { x: pan.cam.x + dx, y: pan.cam.y + dy, touched: true }); apply();
      };
      const onUp = e => {
        if (!pts.has(e.pointerId)) return;
        pts.delete(e.pointerId);
        if (pan && pan.moved) suppressClick = true;
        if (pts.size < 2) pinch = null;
        if (pts.size === 0) { pan = null; canvas.classList.remove('panning'); document.body.classList.remove('panning'); }
      };
      const onClick = e => { if (suppressClick) { e.stopPropagation(); e.preventDefault(); suppressClick = false; } };
      const onDbl = e => { if (!e.target.closest('button, input, select, .vm, .jj-node, .side-card, .zoom-ctl')) fit(); };
      const onKey = e => { if (document.querySelector('.about-backdrop')) return; if ((e.key === 'f' || e.key === 'F') && !e.ctrlKey && !e.metaKey && !e.target.closest('input, select, textarea')) fit(); };
      canvas.addEventListener('wheel', onWheel, { passive: false });
      canvas.addEventListener('pointerdown', onDown);
      canvas.addEventListener('pointermove', onMove);
      canvas.addEventListener('pointerup', onUp);
      canvas.addEventListener('pointercancel', onUp);
      canvas.addEventListener('click', onClick, true);
      canvas.addEventListener('dblclick', onDbl);
      window.addEventListener('keydown', onKey);
      return () => {
        canvas.removeEventListener('wheel', onWheel); canvas.removeEventListener('pointerdown', onDown);
        canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerup', onUp);
        canvas.removeEventListener('pointercancel', onUp); canvas.removeEventListener('click', onClick, true);
        canvas.removeEventListener('dblclick', onDbl); window.removeEventListener('keydown', onKey);
      };
    }, []);

    const zoomBy = f => { const c = canvasRef.current; zoomAt(cam.current.s * f, c.clientWidth / 2, c.clientHeight / 2); };
    const zoomTo = s => { const c = canvasRef.current; zoomAt(s, c.clientWidth / 2, c.clientHeight / 2); };
    return { zoom, fit, zoomBy, zoomTo };
  }

  function ZoomControls({ zoom, fit, zoomBy, zoomTo }) {
    return html`
      <div className="zoom-ctl" role="toolbar" aria-label="Zoom">
        <button onClick=${() => zoomBy(1 / 1.25)} aria-label="Zoom out" title="Zoom out">−</button>
        <button className="pct" onClick=${() => zoomTo(1)} title="Reset to 100%">${Math.round(zoom * 100)}%</button>
        <button onClick=${() => zoomBy(1.25)} aria-label="Zoom in" title="Zoom in">+</button>
        <button className="fit" onClick=${fit} title="Fit to screen (F)">Fit</button>
        <span className="zoom-hint">Scroll to zoom · drag to pan</span>
      </div>`;
  }

  // ------------------------------------------------------------ classic: the jjodel views, unchanged
  function Classic() {
    useModel();
    const m = Object.values(raw).filter(o => o.class === 'Machine').map(o => obj(o.id))[0];
    const dispenser = m.$coinDispenser.value, insert = m.$coinController.value.$coinInsert.value;
    const l = J.layout[m.id] || {};
    return html`
      <div className="machine-row">
        <section className="side side-left">
          <h2 className="side-title">Coin storage<small>coinDispenser view</small></h2>
          <${DefaultNode} data=${dispenser} style=${{ width: J.layout[dispenser.id]?.w }} />
        </section>
        <section className="fit-main"><${DefaultNode} data=${m} style=${{ width: l.w, minHeight: l.h }} /></section>
        <section className="side side-right">
          <${DefaultNode} data=${insert} />
          ${!(m.state && m.state.show_insert_coins) && html`<p className="hint">This is the model's own <b>Concrete Syntax</b> viewpoint rendered as-is. Click the coin box to insert coins, type a code, press OK.</p>`}
        </section>
      </div>`;
  }

  // ------------------------------------------------------------ side cards (wide screens)
  function Receipt() {
    const sess = window.MachineUI.useSession();
    const last = sess.sales.slice(-6).reverse();
    return html`
      <div className="receipt" aria-label="Recent purchases">
        <div className="receipt-head">*** RECEIPT ***</div>
        ${last.length ? last.map((s, i) => html`<div key=${s.t + ':' + i} className="receipt-line"><span>${s.code} ${s.product}</span><span>${VM.fmt(s.price)}</span></div>`)
          : html`<div className="receipt-line muted"><span>no purchases yet</span></div>`}
        <div className="receipt-total"><span>TOTAL</span><span>${VM.fmt(sess.sales.reduce((a, s) => a + (s.price || 0), 0))}</span></div>
        <div className="receipt-foot">thank you · come again</div>
      </div>`;
  }

  function HowTo() {
    return html`
      <div className="howto">
        <h3>How it works</h3>
        <ol>
          <li><b>Pay</b> by dragging a coin from your wallet into the slot, or tapping it.</li>
          <li><b>Choose</b> by typing the product's code on the keypad, then press <b>OK</b>.</li>
          <li><b>Collect</b> your item from the flap and your change from the cup.</li>
        </ol>
        <p className="muted">Keys: <kbd>0–9</kbd> code · <kbd>Enter</kbd> OK · <kbd>Esc</kbd> clear · <kbd>R</kbd> return coins · <kbd>Shift</kbd>+<kbd>1</kbd>/<kbd>2</kbd>/<kbd>5</kbd> insert coin</p>
        <p className="muted">Choose first and pay later if you like. The machine vends as soon as your credit covers the price.</p>
      </div>`;
  }

  function App() {
    const [view, setView] = React.useState(() => pref('vm.view', 'machine'));
    const [service, setService] = React.useState(false);
    const [focus, setFocus] = React.useState(null);
    const [tab, setTab] = React.useState('stock');
    const [theme, setTheme] = React.useState(() => pref('vm.theme', 'auto'));
    const [muted, setMuted] = React.useState(window.Sound.muted);
    // About page, linkable as #about
    const [about, setAbout] = React.useState(() => location.hash === '#about');
    React.useEffect(() => {
      const onHash = () => setAbout(location.hash === '#about');
      window.addEventListener('hashchange', onHash);
      return () => window.removeEventListener('hashchange', onHash);
    }, []);
    const openAbout = () => { history.pushState(null, '', '#about'); setAbout(true); };
    const closeAbout = () => { if (location.hash === '#about') history.pushState(null, '', location.pathname + location.search); setAbout(false); };
    const stageRef = React.useRef(null), canvasRef = React.useRef(null);
    const camera = usePanZoom(canvasRef, stageRef, [view, service]);

    React.useEffect(() => { setPref('vm.view', view); document.body.dataset.view = view; }, [view]);
    React.useEffect(() => {
      setPref('vm.theme', theme);
      if (theme === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = theme;
    }, [theme]);
    const nextTheme = { auto: 'light', light: 'dark', dark: 'auto' };
    const editSlot = id => { setFocus(id); setTab('stock'); setService(true); };

    return html`
      <div className=${`app view-${view}` + (service ? ' svc-open' : '')}>
        <header className="topbar">
          <div className="brand">
            <span className="logo" aria-hidden="true"></span>
            <div><h1>${J.project}</h1><p>Driven by the jjodel model <b>${J.model}</b></p></div>
          </div>
          <div className="seg" role="tablist" aria-label="View">
            <button role="tab" aria-selected=${view === 'machine'} className=${view === 'machine' ? 'on' : ''} onClick=${() => setView('machine')}>Machine</button>
            <button role="tab" aria-selected=${view === 'classic'} className=${view === 'classic' ? 'on' : ''} onClick=${() => setView('classic')}>jjodel views</button>
          </div>
          <div className="tools">
            <button className="tool" onClick=${() => { window.Sound.muted = !muted; setMuted(!muted); }} aria-label=${muted ? 'Unmute' : 'Mute'} title=${muted ? 'Sound off' : 'Sound on'}>${muted ? '🔇' : '🔊'}</button>
            <button className="tool" onClick=${() => setTheme(nextTheme[theme])} title=${'Theme: ' + theme} aria-label=${'Theme: ' + theme}>${theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</button>
            <button className=${'btn' + (service ? ' primary' : '')} onClick=${() => setService(s => !s)} aria-pressed=${service}>🔑 Service</button>
          </div>
        </header>
        <main className="canvas" ref=${canvasRef}>
          <div className="stage" ref=${stageRef}>
            ${view === 'machine' ? html`<div className="fit-main"><${Machine} service=${service} onEdit=${editSlot} /></div>` : html`<${Classic} />`}
          </div>
          ${view === 'machine' && html`<div className="side-card left"><${HowTo} /></div>`}
          ${view === 'machine' && html`<div className="side-card right"><${Receipt} /></div>`}
          <${ZoomControls} ...${camera} />
          <button className="about-btn" onClick=${openAbout} aria-label="About this project" title="About this project">?</button>
        </main>
        ${view === 'machine' && html`<${Dock} />`}
        <${ServicePanel} open=${service} onClose=${() => setService(false)} focus=${focus} setFocus=${setFocus} tab=${tab} setTab=${setTab} />
        <${Toasts} />
        <${About} open=${about} onClose=${closeAbout} />
      </div>`;
  }

  function Toasts() {
    const [list, setList] = React.useState([]);
    React.useEffect(() => window.JJ.setToast(msg => {
      const id = Math.random();
      setList(l => [...l, { id, msg }]);
      setTimeout(() => setList(l => l.filter(t => t.id !== id)), 3500);
    }), []);
    return html`<div className="toasts" aria-live="polite">${list.map(t => html`<div key=${t.id} className="toast">${t.msg}</div>`)}</div>`;
  }

  ReactDOM.createRoot(document.getElementById('root')).render(h(App));
})();

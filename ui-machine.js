// The customer-facing machine. Everything it shows comes from the model
// (shelves, slots, products, prices, stock, coin tubes) via vend.js.
(function () {
  const html = htm.bind(React.createElement);
  const { useModel, onImgError } = window.JJ;
  const VM = window.VM;

  function useSession() {
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => VM.subscribe(force), []);
    return VM.get();
  }

  // ------------------------------------------------------------ flying elements
  const center = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  function fly(el, from, to, { duration = 600, arc = -80, rotate = 0, endScale = 1, endScaleX, endOpacity = 1, gravity = false, delay = 0 } = {}) {
    Object.assign(el.style, { position: 'fixed', left: from.left + 'px', top: from.top + 'px', width: from.width + 'px', height: from.height + 'px',
      margin: 0, zIndex: 1000, pointerEvents: 'none' });
    document.body.appendChild(el);
    const a = center(from), b = center(to), dx = b.x - a.x, dy = b.y - a.y;
    const frames = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const x = dx * t, y = gravity ? dy * t * t : dy * t + arc * 4 * t * (1 - t);
      const s = 1 + (endScale - 1) * t, sx = endScaleX != null ? 1 + (endScaleX - 1) * t * t : 1;
      frames.push({ transform: `translate(${x}px, ${y}px) rotate(${rotate * t}deg) scale(${s * sx}, ${s})`, opacity: 1 + (endOpacity - 1) * t * t });
    }
    return el.animate(frames, { duration, delay, easing: 'linear', fill: 'forwards' }).finished.then(() => el.remove());
  }
  const coinEl = d => { const el = document.createElement('div'); el.className = `coin ${coinClass(d)}`; el.textContent = d; return el; };
  const coinClass = d => 'coin-r' + Math.max(0, VM.accepted().indexOf(d));
  const imgOf = p => (p && p.$image_url.value) || '';

  // product leaves the coil and drops into the bin
  VM.fx.fall = async (slotId, productId) => {
    const front = document.querySelector(`[data-slot="${slotId}"] .it1`);
    const mouth = document.querySelector('.vm-bin-drop');
    if (!front || !mouth) return;
    const from = front.getBoundingClientRect(), to = mouth.getBoundingClientRect();
    const el = document.createElement('img');
    el.src = front.src; el.className = 'falling-item';
    const target = { left: to.left + to.width / 2 - from.width / 2, top: to.top, width: from.width, height: from.height };
    await fly(el, from, target, { duration: 620, gravity: true, rotate: (Math.random() > .5 ? 1 : -1) * (20 + Math.random() * 25), endScale: 0.8 });
  };

  // ------------------------------------------------------------ slots
  function Slot({ s, sess, service, onEdit }) {
    const p = s.$product.value, q = s.$quantity.value || 0, cap = s.$capacity.value, price = s.$price.value;
    const img = imgOf(p);
    const selected = sess.selected === s.id, vending = sess.vending === s.id;
    const cls = ['vm-slot', selected && 'is-selected', vending && 'is-vending', p && q === 0 && 'is-soldout', !p && 'is-empty'].filter(Boolean).join(' ');
    const label = p ? `${VM.code(s)} ${VM.productName(p)} ${VM.fmt(price)}, ${q} left` : `Slot ${VM.code(s)} empty`;
    // customers choose with the keypad; only service mode makes slots clickable (to edit)
    const Tag = service ? 'button' : 'div';
    return html`
      <${Tag} className=${cls + (service ? ' editable' : '')} data-slot=${s.id} onClick=${service ? () => onEdit(s.id) : undefined}
        aria-label=${service ? 'Edit ' + label : label} role=${service ? undefined : 'img'}>
        <div className="vm-stack">
          ${p && q >= 3 && html`<img className="it it3" src=${img} alt="" onError=${onImgError} draggable="false" />`}
          ${p && q >= 2 && html`<img className="it it2" src=${img} alt="" onError=${onImgError} draggable="false" />`}
          ${p && html`<img className=${'it it1' + (q === 0 ? ' ghost' : '')} src=${img} alt="" onError=${onImgError} draggable="false" />`}
        </div>
        <svg className="vm-coil" viewBox="0 0 120 44" aria-hidden="true">
          <ellipse className="coil-back" cx="60" cy="24" rx="50" ry="14" />
          <ellipse className="coil-front" cx="60" cy="22" rx="52" ry="15" pathLength="100" />
        </svg>
        ${p && q === 0 && html`<span className="vm-soldout">SOLD OUT</span>`}
        ${p && html`
          <span className="vm-tip" role="presentation">
            <b>${VM.productName(p)}</b>
            <span>${VM.fmt(price)} · ${q} left</span>
            ${cap ? html`<i className="bar"><i style=${{ width: Math.min(100, q / cap * 100) + '%' }}></i></i>` : null}
          </span>`}
        ${service && html`<span className="vm-edit">✎ ${VM.code(s) || 'edit'}</span>`}
      </${Tag}>`;
  }

  function Shelf({ shelf, sess, service, onEdit }) {
    const ss = shelf.$ownedSlots.values;
    const cols = { gridTemplateColumns: `repeat(${Math.max(ss.length, 1)}, 1fr)` };
    return html`
      <div className="vm-shelf">
        <div className="vm-slots" style=${cols}>
          ${ss.map(s => html`<${Slot} key=${s.id} s=${s} sess=${sess} service=${service} onEdit=${onEdit} />`)}
        </div>
        <div className="vm-rail" style=${cols}>
          ${ss.map(s => {
            const p = s.$product.value, out = p && !(s.$quantity.value > 0);
            return html`<span key=${s.id} className=${'vm-tag' + (sess.selected === s.id ? ' on' : '') + (out ? ' out' : '')}>
              <b>${VM.code(s) || '--'}</b><i>${!p ? '—' : out ? 'SOLD OUT' : s.$price.value == null ? '$ -' : VM.fmt(s.$price.value)}</i>
            </span>`;
          })}
        </div>
      </div>`;
  }

  // ------------------------------------------------------------ display
  function Display({ sess }) {
    const credit = VM.credit();
    const sel = sess.selected && window.JJ.obj(sess.selected);
    let text, kind = 'info';
    if (sess.msg) ({ text, kind } = sess.msg);
    else if (sel && sel.$product.value) {
      const price = sel.$price.value || 0;
      text = `${VM.code(sel)} ${VM.productName(sel.$product.value).toUpperCase()} ${VM.fmt(price)}`;
      if (credit < price) text += ` · INSERT ${VM.fmt(price - credit)}`;
      else text += ' · PRESS OK';
    } else if (sess.input) text = `SELECT ${sess.input}${'_'.repeat(Math.max(0, 2 - sess.input.length))}`;
    else if (credit > 0) text = 'CHOOSE A PRODUCT';
    else text = 'HELLO! INSERT COINS AND CHOOSE A SNACK';
    const scroll = text.length > 17;
    return html`
      <div className=${'vm-display k-' + kind} role="status" aria-live="polite">
        <div className="vm-display-line">
          ${scroll
            ? html`<span className="marquee" key=${text}><span>${text}</span><span aria-hidden="true">${text}</span></span>`
            : html`<span key=${text} className="pop">${text}</span>`}
        </div>
        <div className="vm-display-row">
          <span>CREDIT <b>${VM.fmt(credit)}</b></span>
          <span>SEL <b>${sess.input || '--'}</b></span>
        </div>
      </div>`;
  }

  // ------------------------------------------------------------ coin tubes (coinDispenser → CoinSlot)
  function CoinTubes() {
    const tubes = VM.coinSlots();
    return html`
      <div className="vm-tubes" aria-label="Coins inside the machine">
        <span className="vm-tubes-title">COIN TUBES</span>
        <div className="vm-tubes-row">
          ${tubes.map(cs => {
            const d = VM.denomOf(cs), n = cs.$inStorage.value || 0, b = cs.$balance.value || 0;
            const shown = Math.min(n, 16), extra = Math.min(b, 6);
            return html`
              <div key=${cs.id} className="vm-tube" title=${`$${d}: ${n} stored${b ? `, ${b} just inserted` : ''}`}>
                <span className="vm-tube-count">${n}${b ? html`<em>+${b}</em>` : null}</span>
                <div className="vm-tube-glass">
                  ${Array.from({ length: shown }, (_, i) => html`<i key=${'s' + i} className=${'disc coin ' + coinClass(d)}></i>`)}
                  ${Array.from({ length: extra }, (_, i) => html`<i key=${'b' + i} className=${'disc coin new ' + coinClass(d)}></i>`)}
                </div>
                <b>$${d}</b>
              </div>`;
          })}
        </div>
      </div>`;
  }

  // ------------------------------------------------------------ controls
  function Keypad({ sess }) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
    return html`
      <div className="vm-keypad" role="group" aria-label="Keypad">
        ${keys.map(k => html`
          <button key=${k} className=${'vm-key' + (k === 'OK' ? ' ok' : k === 'CLR' ? ' clr' : '')}
            disabled=${sess.busy} onClick=${() => VM.press(k)}>${k}</button>`)}
      </div>`;
  }

  function CoinAcceptor({ sess }) {
    const credit = VM.credit(), exact = VM.exactChangeOnly();
    return html`
      <div className="vm-acceptor">
        <div className="vm-lamps">
          <span className=${'lamp amber' + (exact ? ' on' : '')}>EXACT<br/>CHANGE</span>
          <span className=${'lamp green' + (credit > 0 ? ' on' : '')}>CREDIT</span>
        </div>
        <div className="vm-coinslot" data-drop="coin" title="Drop coins here">
          <span className="slit"></span>
          <span className="lbl">INSERT COIN</span>
        </div>
        <div className="vm-accepts">${VM.accepted().map(d => html`<span key=${d} className=${'mini coin ' + coinClass(d)}>${d}</span>`)}</div>
        <button className="vm-return" onClick=${VM.refund} disabled=${sess.busy} title="Coin return (R)">
          <span className="knob"></span><span>COIN<br/>RETURN</span>
        </button>
      </div>`;
  }

  function Cup({ sess, onCollect }) {
    return html`
      <button className=${'vm-cup' + (sess.cup.length ? ' has' : '')} onClick=${onCollect}
        aria-label=${sess.cup.length ? `Collect ${VM.fmt(sess.cup.reduce((a, c) => a + c.d, 0))} change` : 'Change cup (empty)'}>
        <span className="vm-cup-inner">
          ${sess.cup.map((c, i) => html`<span key=${c.id} className=${'coin cup-coin ' + coinClass(c.d)} data-cup-coin=${c.d}
            style=${{ '--i': i, left: `${10 + (i * 37) % 60}%`, bottom: `${4 + Math.floor(i / 3) * 5}px` }}>${c.d}</span>`)}
        </span>
        <span className="vm-cup-label">${sess.cup.length ? 'TAKE CHANGE' : 'CHANGE'}</span>
      </button>`;
  }

  function Bin({ sess, onCollect }) {
    const items = sess.bin.map(id => window.JJ.obj(id)).filter(Boolean);
    return html`
      <button className=${'vm-bin' + (items.length ? ' has' : '')} onClick=${onCollect}
        aria-label=${items.length ? `Take ${items.length} item(s) from the bin` : 'Pickup bin (empty)'}>
        <span className="vm-bin-drop"></span>
        <span className="vm-bin-items">
          ${items.map((p, i) => html`<img key=${i} data-bin-item="1" src=${imgOf(p)} alt=${VM.productName(p)} onError=${onImgError}
            style=${{ '--i': i, left: `${12 + (i * 23) % 70}%`, transform: `rotate(${(i * 47) % 50 - 25}deg)` }} />`)}
        </span>
        <span className="vm-flap"><span>PUSH</span></span>
      </button>`;
  }

  // ------------------------------------------------------------ the machine
  function Machine({ service, onEdit }) {
    useModel(); const sess = useSession();
    const shelves = VM.shelves();

    const collectCup = () => {
      if (!sess.cup.length) return;
      const rects = [...document.querySelectorAll('[data-cup-coin]')].map(el => ({ d: +el.dataset.cupCoin, r: el.getBoundingClientRect() }));
      VM.collectCup();
      rects.forEach(({ d, r }, i) => {
        const target = document.querySelector(`[data-wallet="${d}"]`);
        if (!target) return;
        setTimeout(() => window.Sound.coin(), i * 70 + 380);
        fly(coinEl(d), r, target.getBoundingClientRect(), { duration: 520, delay: i * 70, arc: -120 });
      });
    };
    const collectBin = () => {
      if (!sess.bin.length) return;
      window.Sound.flap();
      const imgs = [...document.querySelectorAll('[data-bin-item]')].map(el => ({ src: el.src, r: el.getBoundingClientRect() }));
      VM.collectBin();
      const bag = document.querySelector('.dock-bag');
      imgs.forEach(({ src, r }, i) => {
        const el = document.createElement('img'); el.src = src; el.className = 'falling-item';
        if (bag) fly(el, r, bag.getBoundingClientRect(), { duration: 650, delay: i * 90, arc: -160, endScale: 0.4, rotate: 180 });
      });
    };

    return html`
      <div className=${'vm' + (service ? ' service' : '')}>
        <header className="vm-sign">
          <span className="bulbs" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => html`<i key=${i} style=${{ '--i': i }}></i>`)}</span>
          <h2>${service ? 'SERVICE MODE' : 'SNACKS & DRINKS'}</h2>
          <span className="bulbs" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => html`<i key=${i} style=${{ '--i': i + 9 }}></i>`)}</span>
        </header>
        <div className="vm-body">
          <div className="vm-window">
            <div className="vm-led" aria-hidden="true"></div>
            ${shelves.map(sh => html`<${Shelf} key=${sh.id} shelf=${sh} sess=${sess} service=${service} onEdit=${onEdit} />`)}
            <div className="vm-glass" aria-hidden="true"></div>
          </div>
          <aside className="vm-panel">
            <${Display} sess=${sess} />
            <${CoinAcceptor} sess=${sess} />
            <${Keypad} sess=${sess} />
            <${CoinTubes} />
            <div className="vm-plate">
              <span>${VM.machine().name}</span>
              <small>${window.JJ.J.model} · jjodel</small>
              <em>${VM.slots().filter(s => s.$product.value && s.$quantity.value > 0).length} items in stock</em>
            </div>
          </aside>
        </div>
        <div className="vm-bottom">
          <${Bin} sess=${sess} onCollect=${collectBin} />
          <${Cup} sess=${sess} onCollect=${collectCup} />
        </div>
        <div className="vm-grill" aria-hidden="true"></div>
      </div>`;
  }

  // ------------------------------------------------------------ wallet dock
  function DockCoin({ d, n }) {
    const ref = React.useRef(null);
    const insertFrom = (rect, el) => {
      const slot = document.querySelector('.vm-coinslot .slit');
      if (!slot) { el && el.remove(); return; }
      fly(el || coinEl(d), rect, slot.getBoundingClientRect(), { duration: el ? 170 : 480, arc: el ? 0 : -140, endScale: 0.6, endScaleX: 0.12 })
        .then(() => VM.insert(d));
    };
    // Drag: no React renders and no layout reads per move. The ghost rides on a
    // GPU transform updated once per frame; the wallet is only debited on drop.
    const onPointerDown = e => {
      if (!(n > 0) || e.button > 0) return;
      e.preventDefault();
      const btn = ref.current, rect = btn.getBoundingClientRect();
      const slotEl = document.querySelector('.vm-coinslot');
      const sr = slotEl && slotEl.getBoundingClientRect();
      const grab = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const start = { x: e.clientX, y: e.clientY };
      const isOver = (x, y) => sr && x > sr.left - 24 && x < sr.right + 24 && y > sr.top - 24 && y < sr.bottom + 24;
      let ghost = null, hot = false, frame = 0, last = start;
      try { btn.setPointerCapture(e.pointerId); } catch {}

      const render = () => {
        frame = 0;
        ghost.style.transform = `translate3d(${last.x - grab.x}px, ${last.y - grab.y}px, 0) scale(1.12) rotate(-8deg)`;
        const h = isOver(last.x, last.y);
        if (h !== hot) { hot = h; slotEl && slotEl.classList.toggle('hot', h); }
      };
      const move = ev => {
        last = { x: ev.clientX, y: ev.clientY };
        if (!ghost) {
          if (Math.hypot(last.x - start.x, last.y - start.y) < 3) return;
          ghost = coinEl(d); ghost.classList.add('dragging');
          Object.assign(ghost.style, { position: 'fixed', left: 0, top: 0, width: rect.width + 'px', height: rect.height + 'px', zIndex: 1000, pointerEvents: 'none', margin: 0, transition: 'none', willChange: 'transform' });
          document.body.appendChild(ghost);
          document.body.classList.add('coin-dragging');
          btn.classList.add('lifted');
        }
        if (!frame) frame = requestAnimationFrame(render);
      };
      const up = ev => {
        btn.removeEventListener('pointermove', move); btn.removeEventListener('pointerup', up); btn.removeEventListener('pointercancel', up);
        if (frame) cancelAnimationFrame(frame);
        document.body.classList.remove('coin-dragging');
        btn.classList.remove('lifted');
        slotEl && slotEl.classList.remove('hot');
        if (!ghost) { if (VM.takeWalletCoin(d)) insertFrom(rect); return; }   // plain tap
        const r = ghost.getBoundingClientRect(); ghost.remove();
        if (ev.type === 'pointerup' && isOver(ev.clientX, ev.clientY) && VM.takeWalletCoin(d)) insertFrom(r, coinEl(d));
        else fly(coinEl(d), r, rect, { duration: 220, arc: 0 });               // snap back
      };
      btn.addEventListener('pointermove', move); btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', up);
    };
    return html`
      <button ref=${ref} className=${'dock-coin coin ' + coinClass(d) + (n > 0 ? '' : ' empty')} data-wallet=${d}
        onPointerDown=${onPointerDown} onKeyDown=${e => (e.key === 'Enter' || e.key === ' ') && n > 0 && (e.preventDefault(), VM.takeWalletCoin(d) && insertFrom(ref.current.getBoundingClientRect()))}
        aria-label=${`Insert $${d} coin (${n} in wallet)`}>
        ${d}<span className="count" key=${n}>×${n}</span>
      </button>`;
  }

  function Dock() {
    useModel(); const sess = useSession();
    const [bagOpen, setBagOpen] = React.useState(false);
    const total = Object.entries(sess.wallet).reduce((t, [d, n]) => t + d * n, 0);
    const bagItems = Object.entries(sess.bag).map(([id, n]) => ({ p: window.JJ.obj(id), n })).filter(x => x.p);
    const bagCount = bagItems.reduce((a, x) => a + x.n, 0);
    const credit = VM.credit();
    const hint = sess.bin.length ? 'Your item is in the bin. Push the flap to take it.'
      : sess.cup.length ? 'Your change is in the cup. Tap it to collect.'
      : sess.busy ? 'Vending…'
      : credit === 0 && !sess.selected ? 'Drag a coin into the slot (or tap it), then type a product code on the keypad.'
      : !sess.selected ? 'Type the product code on the keypad (e.g. 14), then press OK.'
      : 'Press OK to buy. COIN RETURN gives your credit back.';
    const eat = (id, e) => {
      VM.eat(id);
      const r = e.currentTarget.getBoundingClientRect();
      for (let i = 0; i < 8; i++) {
        const el = document.createElement('span'); el.className = 'crumb'; el.textContent = ['✦', '•', '😋', '✧'][i % 4];
        const a = (i / 8) * Math.PI * 2;
        fly(el, r, { left: r.left + Math.cos(a) * 70, top: r.top + Math.sin(a) * 70 - 20, width: r.width, height: r.height }, { duration: 600, arc: -30, endOpacity: 0, endScale: 0.5 });
      }
    };
    return html`
      <div className="dock">
        <div className="dock-wallet" role="group" aria-label="Your wallet">
          <span className="dock-label">Wallet<b>${VM.fmt(total)}</b></span>
          ${VM.accepted().map(d => html`<${DockCoin} key=${d} d=${d} n=${sess.wallet[d] || 0} />`)}
          <button className="dock-atm" onClick=${VM.atm} title="Find more coins">+</button>
        </div>
        <p className="dock-hint" aria-live="polite">${hint}</p>
        <div className="dock-bag-wrap">
          <button className=${'dock-bag' + (bagCount ? ' has' : '')} onClick=${() => setBagOpen(o => !o)} aria-expanded=${bagOpen}>
            <span className="bag-icon" aria-hidden="true">🛍</span> Bag ${bagCount ? html`<b>${bagCount}</b>` : null}
          </button>
          ${bagOpen && html`
            <div className="bag-pop">
              ${bagItems.length ? bagItems.map(({ p, n }) => html`
                <div className="bag-item" key=${p.id}>
                  <img src=${imgOf(p)} alt="" onError=${onImgError} />
                  <span><b>${VM.productName(p)}</b><small>×${n}</small></span>
                  <button onClick=${e => eat(p.id, e)}>Eat</button>
                </div>`) : html`<p className="muted">Nothing yet. Buy something!</p>`}
            </div>`}
        </div>
      </div>`;
  }

  // ------------------------------------------------------------ keyboard
  window.addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, select, textarea, [contenteditable]')) return;
    if (document.body.dataset.view !== 'machine' || e.ctrlKey || e.metaKey || e.altKey || document.querySelector('.about-backdrop')) return;
    if (e.shiftKey && /^Digit\d$/.test(e.code)) {           // Shift+digit inserts that coin
      const d = +e.code.slice(5);
      const btn = document.querySelector(`[data-wallet="${d}"]`);
      if (btn && VM.takeWalletCoin(d)) fly(coinEl(d), btn.getBoundingClientRect(), document.querySelector('.vm-coinslot .slit').getBoundingClientRect(), { duration: 450, arc: -120, endScale: .6, endScaleX: .12 }).then(() => VM.insert(d));
      e.preventDefault(); return;
    }
    if (/^\d$/.test(e.key)) VM.press(e.key);
    else if (e.key === 'Enter') VM.press('OK');
    else if (e.key === 'Backspace') VM.press('BACK');
    else if (e.key === 'Escape') VM.press('CLR');
    else if (e.key.toLowerCase() === 'r') VM.refund();
    else return;
    e.preventDefault();
  });

  window.MachineUI = { Machine, Dock, useSession, fly };
})();

// Vending logic on top of the jjodel model (runtime.js).
// Model objects hold the machine's durable state (stock, prices, coin tubes,
// inserted credit). The session store holds what a customer sees and carries:
// display, selection, the change cup, the pickup bin, wallet, bag and sales.
(function () {
  const { obj, raw, batch } = window.JJ;
  const MODEL_KEY = 'vm.model.v2', SESSION_KEY = 'vm.session.v2';

  // ---------------------------------------------------------------- model queries
  const all = cls => Object.values(raw).filter(o => o.class === cls).map(o => obj(o.id));
  const machine = () => all('Machine')[0];
  const shelves = () => machine().$ownedShelves.values;
  const slots = () => shelves().flatMap(s => s.$ownedSlots.values);
  const products = () => all('Product');
  const coinSlots = () => machine().$coinDispenser.value.$ownedCoinSlots.values;
  const denomOf = cs => cs.$denomination.value ? cs.$denomination.value.$value.value : undefined;
  const accepted = () => [...new Set(coinSlots().map(denomOf).filter(Boolean))].sort((a, b) => a - b);
  const credit = () => coinSlots().reduce((t, cs) => t + (cs.$balance.value || 0) * (denomOf(cs) || 0), 0);
  const code = s => s.$slot_id.value == null ? '' : String(s.$slot_id.value);
  const slotByCode = c => slots().find(s => code(s) === c);
  const codeLength = () => Math.max(1, ...slots().map(s => code(s).length));
  const productName = p => (p && (p.$name.value || p.name)) || '';
  const fmt = v => '$' + Number(v || 0).toFixed(2);

  // storage counts per denomination (optionally including the inserted balance)
  function pool(includeBalance) {
    const m = {};
    for (const cs of coinSlots()) {
      const d = denomOf(cs); if (!d) continue;
      m[d] = (m[d] || 0) + (cs.$inStorage.value || 0) + (includeBalance ? cs.$balance.value || 0 : 0);
    }
    return m;
  }

  // Bounded change-making: fewest coins summing exactly to `amount` from `counts`, or null.
  function makeChange(amount, counts) {
    if (amount === 0) return [];
    const best = new Array(amount + 1).fill(null); best[0] = [];
    for (const d of Object.keys(counts).map(Number).sort((a, b) => b - a)) {
      for (let k = 0; k < counts[d]; k++) {
        let changed = false;
        for (let a = amount; a >= d; a--) {
          const prev = best[a - d];
          if (prev && (!best[a] || prev.length + 1 < best[a].length)) { best[a] = [...prev, d]; changed = true; }
        }
        if (!changed) break;
      }
    }
    return best[amount];
  }
  // lamp: lit when some amount below the largest coin can't be paid out from storage
  function exactChangeOnly() {
    const ds = accepted(); if (!ds.length) return false;
    const p = pool(false);
    for (let a = 1; a < ds[ds.length - 1]; a++) if (!makeChange(a, p)) return true;
    return false;
  }

  // ---------------------------------------------------------------- session store
  const listeners = new Set();
  const initialSession = () => {
    const ds = accepted();
    return {
      input: '', selected: null, pending: false, msg: null, busy: false, vending: null,
      cup: [], bin: [], bag: {}, sales: [],
      wallet: Object.fromEntries(ds.map((d, i) => [d, Math.max(2, 6 - i * 2)])),
    };
  };
  let S = initialSession();
  const get = () => S;
  const set = patch => { S = { ...S, ...(typeof patch === 'function' ? patch(S) : patch) }; save(); listeners.forEach(f => f()); };
  const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };

  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        const { msg, busy, vending, pending, ...keep } = S;
        localStorage.setItem(SESSION_KEY, JSON.stringify(keep));
        localStorage.setItem(MODEL_KEY, JSON.stringify({ sig: signature(), objects: window.JJ.snapshot() }));
      } catch {}
    }, 250);
  }
  // hash of the generated model: saved state is dropped when model.js is regenerated with changes
  const signature = () => {
    const s = JSON.stringify([window.JJ.J.metamodel, window.JJ.pristine()]);
    let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return window.JJ.J.project + ':' + h;
  };
  function restore() {
    try {
      const m = JSON.parse(localStorage.getItem(MODEL_KEY) || 'null');
      if (m && m.sig === signature()) window.JJ.load(m.objects);
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      if (s) S = { ...initialSession(), ...s, input: '', selected: null };
    } catch {}
  }
  restore();
  window.JJ.subscribe(save);

  // ---------------------------------------------------------------- display
  let msgTimer = null;
  function say(text, kind = 'info', ms = 2600) {
    clearTimeout(msgTimer);
    set({ msg: { text, kind, id: Math.random() } });
    if (ms) msgTimer = setTimeout(() => set({ msg: null }), ms);
  }

  // UI registers animations here; logic awaits them.
  const fx = { fall: async () => {}, coinToSlot: async () => {}, };

  // ---------------------------------------------------------------- actions
  function press(k) {
    if (S.busy) return;
    window.Sound.key();
    if (k === 'CLR') { set({ input: '', selected: null, pending: false, msg: null }); return; }
    if (k === 'OK') { buy(); return; }
    if (k === 'BACK') { set({ input: S.input.slice(0, -1), selected: null, pending: false }); return; }
    const input = (S.selected ? '' : S.input) + k;
    if (input.length < codeLength()) { set({ input, selected: null, pending: false, msg: null }); return; }
    const s = slotByCode(input);
    if (!s) { window.Sound.error(); set({ input: '', selected: null }); say(`NO SLOT ${input}`, 'error'); return; }
    select(s);
  }

  function select(s) {
    set({ input: code(s), selected: s.id, pending: false, msg: null });
    const p = s.$product.value;
    if (!p) { window.Sound.error(); say('EMPTY SLOT', 'error'); }
    else if (!(s.$quantity.value > 0)) { window.Sound.error(); say(`${productName(p).toUpperCase()} SOLD OUT`, 'error'); }
  }

  function selectedSlot() { return S.selected ? obj(S.selected) : null; }

  async function buy() {
    const s = selectedSlot();
    if (!s) { window.Sound.error(); say('SELECT AN ITEM', 'error'); return; }
    const p = s.$product.value, price = s.$price.value;
    if (!p) { window.Sound.error(); say('EMPTY SLOT', 'error'); return; }
    if (!(s.$quantity.value > 0)) { window.Sound.error(); say('SOLD OUT', 'error'); return; }
    if (price == null) { window.Sound.error(); say('NOT FOR SALE', 'error'); return; }
    const c = credit();
    if (c < price) { set({ pending: true }); say(`INSERT ${fmt(price - c)} MORE`, 'warn', 3500); return; }

    const change = makeChange(c - price, pool(true));
    if (!change) { window.Sound.error(); set({ pending: false }); say('CAN\'T MAKE CHANGE · USE SMALLER COINS', 'error', 4000); return; }

    set({ busy: true, pending: false, vending: s.id, msg: { text: 'VENDING…', kind: 'info', id: 1 } });
    window.Sound.motor(1.1);
    await wait(900);
    // the front item leaves the coil: commit the sale to the model
    const used = change.reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {});
    const fallDone = fx.fall(s.id, p.id);
    batch(() => {
      // inserted coins drop into their tube; change is paid out of the tubes
      for (const cs of coinSlots()) {
        const d = denomOf(cs);
        const available = (cs.$inStorage.value || 0) + (cs.$balance.value || 0);
        const take = Math.min(used[d] || 0, available);
        used[d] = (used[d] || 0) - take;
        cs.$inStorage.value = available - take;
        cs.$balance.value = 0;
      }
      s.$quantity.value = s.$quantity.value - 1;
    });
    await fallDone;
    window.Sound.thud();
    set(st => ({ bin: [...st.bin, p.id], vending: null,
      sales: [...st.sales, { t: Date.now(), code: code(s), product: productName(p), price }].slice(-200) }));
    await payOut(change);
    window.Sound.success();
    set({ busy: false, input: '', selected: null });
    say(change.length ? `ENJOY! CHANGE ${fmt(change.reduce((a, b) => a + b, 0))}` : 'ENJOY!', 'success', 3500);
  }

  async function payOut(coins) {
    for (const d of coins.slice().sort((a, b) => b - a)) {
      window.Sound.drop();
      set(st => ({ cup: [...st.cup, { d, id: Math.random() }] }));
      await wait(170);
    }
  }

  async function insert(d) {
    const ci = machine().$coinController.value.$coinInsert.value;
    // the model's own Behavior event (CoinInsert.insertCoin) books the coin
    if (ci && ci.node.events.insertCoin) ci.node.events.insertCoin(d);
    else { const cs = coinSlots().find(x => denomOf(x) === d); if (cs) cs.$balance.value += 1; }
    window.Sound.coin();
    set({ msg: null });
    const s = selectedSlot();
    if (S.pending && s && credit() >= (s.$price.value || 0)) buy();
  }

  async function refund() {
    if (S.busy) return;
    const coins = [];
    batch(() => { for (const cs of coinSlots()) { for (let i = 0; i < (cs.$balance.value || 0); i++) coins.push(denomOf(cs)); cs.$balance.value = 0; } });
    if (!coins.length) { window.Sound.key(); say('NO CREDIT', 'info', 1500); return; }
    set({ pending: false });
    say('RETURNING COINS', 'info', 1800);
    await payOut(coins);
  }

  function takeWalletCoin(d) {
    if (!(S.wallet[d] > 0)) return false;
    set(st => ({ wallet: { ...st.wallet, [d]: st.wallet[d] - 1 } }));
    return true;
  }
  const collectCup = () => { if (!S.cup.length) return []; const coins = S.cup; set(st => ({ cup: [], wallet: coins.reduce((w, c) => ({ ...w, [c.d]: (w[c.d] || 0) + 1 }), st.wallet) })); return coins; };
  const collectBin = () => { if (!S.bin.length) return []; const items = S.bin; set(st => ({ bin: [], bag: items.reduce((b, id) => ({ ...b, [id]: (b[id] || 0) + 1 }), st.bag) })); return items; };
  const eat = id => { if (!(S.bag[id] > 0)) return; window.Sound.crunch(); set(st => { const bag = { ...st.bag, [id]: st.bag[id] - 1 }; if (!bag[id]) delete bag[id]; return { bag }; }); };
  const atm = () => { const ds = accepted(); set(st => ({ wallet: { ...st.wallet, [ds[ds.length - 1]]: (st.wallet[ds[ds.length - 1]] || 0) + 2 } })); window.Sound.coin(); window.Sound.coin(0.12); };

  function resetAll() {
    window.JJ.reset();
    try { localStorage.removeItem(MODEL_KEY); localStorage.removeItem(SESSION_KEY); } catch {}
    S = initialSession(); listeners.forEach(f => f());
  }

  // ---------------------------------------------------------------- validation (service mode)
  function issues() {
    const out = [];
    const seen = {};
    for (const s of slots()) {
      const c = code(s), label = c ? `Slot ${c}` : s.name;
      if (!c) out.push({ level: 'warn', obj: s.id, text: `${s.name} has no slot_id (required 1..1) — customers can't select it` });
      else if (seen[c]) out.push({ level: 'error', obj: s.id, text: `Duplicate slot_id ${c}` });
      seen[c] = true;
      const q = s.$quantity.value, cap = s.$capacity.value;
      if (q != null && cap != null && q > cap) out.push({ level: 'error', obj: s.id, text: `${label}: quantity ${q} > capacity ${cap}` });
      if (s.$product.value && s.$price.value == null) out.push({ level: 'warn', obj: s.id, text: `${label} sells ${productName(s.$product.value)} but has no price` });
      if (cap == null && s.$product.value) out.push({ level: 'info', obj: s.id, text: `${label} has no capacity (required 1..1)` });
    }
    for (const p of products()) {
      if (!p.$name.value) out.push({ level: 'warn', obj: p.id, text: `${p.name} has no name` });
      if (!p.$image_url.value) out.push({ level: 'info', obj: p.id, text: `${productName(p) || p.name} has no image_url` });
    }
    if (exactChangeOnly()) out.push({ level: 'info', text: 'Coin storage is low: exact-change lamp is lit' });
    return out;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  window.VM = {
    get: () => S, set, subscribe, fx, say,
    machine, shelves, slots, products, coinSlots, denomOf, accepted, credit, code, slotByCode, productName, fmt,
    makeChange, pool, exactChangeOnly, issues,
    press, select, buy, insert, refund, takeWalletCoin, collectCup, collectBin, eat, atm, resetAll,
  };
})();

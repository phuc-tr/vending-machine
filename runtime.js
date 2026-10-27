// A tiny jjodel-compatible runtime: wraps model.js objects in the same API the
// views use (data.$feature.value, .values, data.state, node.events, ...),
// compiles each view's JSX with Babel and renders it with React.
(function () {
  const J = window.JJODEL;
  const h = React.createElement;

  // jjodel collections expose .first()
  if (!Array.prototype.first) {
    Object.defineProperty(Array.prototype, 'first', { value: function () { return this[0]; } });
  }

  // ---------------------------------------------------------------- store
  let pristine = JSON.parse(JSON.stringify(J.objects));
  const listeners = new Set();
  let batching = 0, dirty = false;
  const notify = () => { if (batching) { dirty = true; return; } listeners.forEach(fn => fn()); };
  const batch = fn => { batching++; try { return fn(); } finally { if (--batching === 0 && dirty) { dirty = false; runDataUpdates(); notify(); } } };

  const raw = {};        // id -> { id, name, class, features }
  const proxies = {};    // id -> proxy
  const states = {};     // id -> view state (jjodel's data.state)
  const parents = {};    // child id -> { owner, feature }

  // Initial transient state the views expect to exist (jjodel kept it on the nodes).
  const INITIAL_STATE = {
    CoinChange: () => ({ changes: [] }),
    PickUpBox: () => ({ products: [] }),
    NumPad: () => ({ input: '' }),
  };

  function load(objs) {
    for (const k of Object.keys(raw)) delete raw[k];
    for (const k of Object.keys(proxies)) delete proxies[k];
    for (const k of Object.keys(parents)) delete parents[k];
    for (const o of objs) raw[o.id] = JSON.parse(JSON.stringify(o));
    for (const o of Object.values(raw)) {
      states[o.id] = (INITIAL_STATE[o.class] || (() => ({})))();
      if (o.owner && raw[o.owner]) parents[o.id] = { owner: o.owner, feature: o.ownerFeature };
    }
  }
  load(pristine);

  const featureMeta = (cls, f) => {
    const m = J.metamodel[cls];
    return m.attributes[f] ? { kind: 'attr', ...m.attributes[f] } : m.references[f] ? { kind: 'ref', ...m.references[f] } : null;
  };
  // jjodel resolves $features case-insensitively (the views use $pickupBox for pickUpBox)
  const resolveFeature = (cls, name) => {
    const m = J.metamodel[cls];
    const all = [...Object.keys(m.attributes), ...Object.keys(m.references)];
    return all.find(f => f === name) || all.find(f => f.toLowerCase() === name.toLowerCase());
  };

  const coerce = (type, v) => {
    if (v === null || v === undefined || v === '') return v === '' ? undefined : v;
    if (type === 'EInt' || type === 'ELong' || type === 'EShort') { const n = parseInt(v, 10); return isNaN(n) ? undefined : n; }
    if (type === 'EFloat' || type === 'EDouble') { const n = parseFloat(v); return isNaN(n) ? undefined : n; }
    if (type === 'EBoolean') return v === true || v === 'true';
    return v;
  };

  // A feature value: .value / .values, assignable; $x delegates to the first referenced object.
  function valueWrapper(id, f) {
    const o = raw[id], fm = featureMeta(o.class, f);
    const read = () => (o.features[f] || []).map(x => fm.kind === 'ref' ? obj(x) : coerce(fm.type, x)).filter(x => x !== undefined);
    const target = {
      get value() { return read()[0]; },
      set value(v) { o.features[f] = v === undefined || v === null ? [] : [fm.kind === 'ref' ? (v.id || v) : v]; notify(); },
      get values() { return read(); },
      set values(vs) { o.features[f] = vs.map(v => fm.kind === 'ref' ? (v.id || v) : v); notify(); },
      get parent() { return obj(id); },
      valueOf() { return this.value; },
      toString() { return String(this.value); },
    };
    return new Proxy(target, {
      get(t, p) {
        if (p in t || typeof p === 'symbol') return Reflect.get(t, p);
        if (typeof p === 'string' && p.startsWith('$')) { const first = t.value; return first ? first[p] : undefined; }
        return undefined;
      },
      set(t, p, v) { if (p === 'value' || p === 'values') { t[p] = v; return true; } return false; },
    });
  }

  function obj(id) {
    if (!raw[id]) return undefined;
    if (proxies[id]) return proxies[id];
    const o = raw[id];
    const base = {
      get id() { return o.id; },
      get name() { return o.name; },
      get className() { return 'DObject'; },
      get instanceof() { return { name: o.class, id: o.class }; },
      get model() { return modelApi; },
      get node() { return nodeFor(id); },
      get parent() { const p = parents[id]; return p ? valueWrapper(p.owner, p.feature) : modelApi; },
      get father() { return this.parent; },
      get state() { return states[id]; },
      set state(v) { states[id] = v || {}; notify(); },
      [Symbol.toPrimitive]() { return o.name; },
    };
    return proxies[id] = new Proxy(base, {
      get(t, p) {
        if (p in t || typeof p === 'symbol') return Reflect.get(t, p);
        if (typeof p !== 'string') return undefined;
        const f = resolveFeature(o.class, p.startsWith('$') ? p.slice(1) : p);
        return f ? valueWrapper(id, f) : undefined;
      },
      set(t, p, v) {
        if (p === 'state') { t.state = v; return true; }
        const f = typeof p === 'string' && resolveFeature(o.class, p.startsWith('$') ? p.slice(1) : p);
        if (f) { valueWrapper(id, f).value = v; return true; }
        return false;
      },
    });
  }

  const modelApi = {
    get name() { return J.model; },
    get allSubObjects() { return Object.keys(raw).map(obj); },
    get parent() { return undefined; },
  };

  // ---------------------------------------------------------------- views
  const VIEW_SCOPE = new Set();
  const compileExpr = (code, label) => {
    try { return new Function('__scope', `with (__scope) { return (${code}\n); }`); }
    catch (e) { console.error(`[${label}] compile error`, e, code); return () => undefined; }
  };
  const compileJsx = (jsx, label) => {
    const src = Babel.transform(`function __view(){ return (\n${jsx}\n); }`, { presets: [['react', { pragma: '__h', pragmaFrag: '__Fragment' }]] }).code;
    try { return new Function('__scope', `with (__scope) { ${src}\n return __view(); }`); }
    catch (e) { console.error(`[${label}] compile error`, e, src); return () => null; }
  };

  const views = {};      // class -> { render, usage, onDataUpdate, events, css, ... }
  for (const v of J.views) {
    const c = views[v.appliesTo] || (views[v.appliesTo] = { cls: v.appliesTo, events: {} });
    const label = `${v.viewpoint} / ${v.name}`;
    if (v.jsx.trim()) {
      Object.assign(c, { name: v.name, css: v.css, adaptWidth: v.adaptWidth, adaptHeight: v.adaptHeight });
      c.render = compileJsx(v.jsx, label);
      if (v.usage.trim()) c.usage = compileExpr(v.usage, label + ' usage');
      if (v.onDataUpdate.trim()) c.onDataUpdate = compileExpr(`() => {\n${v.onDataUpdate}\n}`, label + ' onDataUpdate');
    }
    for (const [ev, code] of Object.entries(v.events || {})) c.events[ev] = compileExpr(code, `${label} event ${ev}`);
  }

  // Scoped view CSS: jjodel nests each view's stylesheet under its node, CSS nesting does the rest.
  const style = document.createElement('style');
  style.textContent = Object.values(views).filter(v => v.css)
    .map(v => `.jj-node.jj-${v.cls} {\n${v.css}\n}`).join('\n\n');
  document.head.appendChild(style);

  // Behaviour (events) run with the jjodel scope of their node.
  let toast = msg => console.log(msg);
  const afterHooks = {};  // `${class}.${event}` -> [fn(data)], app-level tweaks that run after a model event
  const nodes = {};
  function nodeFor(id) {
    if (nodes[id]) return nodes[id];
    const o = raw[id], v = views[o.class] || { events: {} };
    const node = { id: 'node_' + id, state: {}, events: {} };
    for (const [ev, fn] of Object.entries(v.events))
      node.events[ev] = (...args) => batch(() => {
        const data = obj(id);
        const result = fn({ data, node, view: v, alert: m => toast(String(m)), console })(...args);
        (afterHooks[`${o.class}.${ev}`] || []).forEach(hook => hook(data));
        return result;
      });
    return nodes[id] = node;
  }

  function runDataUpdates() {
    batching++;
    try {
      for (const id of Object.keys(raw)) {
        const v = views[raw[id].class];
        if (v && v.onDataUpdate) try { v.onDataUpdate({ data: obj(id), node: nodeFor(id), view: v })(); } catch (e) { console.warn(e); }
      }
    } finally { batching--; dirty = false; }
  }

  // ---------------------------------------------------------------- React glue
  const View = ({ className, children, ...rest }) => h('div', { className, ...rest }, children);
  const NullTag = ({ children }) => h(React.Fragment, null, children);
  // If a product image_url fails to load, draw a labelled placeholder instead of a broken image.
  const placeholder = src => {
    const p = Object.values(raw).find(o => o.class === 'Product' && (o.features.image_url || [])[0] === src);
    const label = (p && (p.features.name || [])[0]) || p?.name || '?';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect x="14" y="30" width="92" height="64" rx="8" fill="#b4232a"/><rect x="14" y="30" width="92" height="64" rx="8" fill="none" stroke="#7a1218" stroke-width="3"/><text x="60" y="68" font-family="Arial Black,Arial,sans-serif" font-size="17" fill="#fff" text-anchor="middle">${label.replace(/[<&]/g, '')}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  };
  const onImgError = e => { const img = e.currentTarget; if (!img.dataset.fallback) { img.dataset.fallback = '1'; img.src = placeholder(img.getAttribute('src')); } };
  const __h = (type, props, ...children) =>
    type === 'img' ? h('img', { ...props, onError: onImgError }, ...children)
      : h(type === 'null' ? NullTag : type, props, ...children);

  class Boundary extends React.Component {
    constructor(p) { super(p); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(e) { console.error(`[${this.props.label}]`, e); }
    render() { return this.state.error ? h('div', { className: 'jj-error', title: String(this.state.error) }, '⚠ ' + this.props.label) : this.props.children; }
  }

  function DefaultNode({ data, style: extraStyle }) {
    if (!data) return null;
    const o = raw[data.id], v = views[o.class];
    const st = states[o.id];
    const invalid = st && Object.keys(st).some(k => k.startsWith('error'));
    return h('div', { className: `jj-node jj-${o.class}${invalid ? ' jj-invalid' : ''}`, 'data-name': o.name, style: extraStyle,
      title: invalid ? Object.entries(st).filter(([k]) => k.startsWith('error')).map(([, m]) => m).join('\n') : undefined },
      h(Boundary, { label: o.name }, v && v.render ? h(ViewBody, { id: o.id, v }) : h('div', { className: 'jj-fallback' }, `${o.name} : ${o.class}`)));
  }

  function ViewBody({ id, v }) {
    const scope = { data: obj(id), node: nodeFor(id), view: v, state: states[id], constants: {}, decorators: null,
      View, DefaultNode, __h, __Fragment: React.Fragment, React };
    if (v.usage) { const ret = {}; v.usage(scope)(ret); Object.assign(scope, ret); }
    return v.render(scope);
  }

  function useModel() {
    const [, force] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => { listeners.add(force); return () => listeners.delete(force); }, []);
  }

  runDataUpdates();

  window.JJ = {
    J, obj, raw, states, views, DefaultNode, useModel, batch, notify, featureMeta, coerce,
    roots: () => Object.values(raw).filter(o => !parents[o.id]).map(o => obj(o.id)),
    onImgError,
    subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn); },
    load(objs) { load(objs); for (const k of Object.keys(nodes)) delete nodes[k]; runDataUpdates(); notify(); },
    pristine: () => JSON.parse(JSON.stringify(pristine)),
    // create a new top-level (or owned) object of a metaclass
    create(cls, features = {}, owner = null, ownerFeature = null) {
      const id = 'Local_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      const n = Object.values(raw).filter(o => o.class === cls).length;
      raw[id] = { id, name: features.__name || `${cls}_${n}`, class: cls, owner, ownerFeature, features: {} };
      for (const [f, v] of Object.entries(features)) if (f !== '__name') raw[id].features[f] = Array.isArray(v) ? v : [v];
      states[id] = (INITIAL_STATE[cls] || (() => ({})))();
      if (owner) { parents[id] = { owner, feature: ownerFeature }; (raw[owner].features[ownerFeature] ||= []).push(id); }
      runDataUpdates(); notify();
      return obj(id);
    },
    remove(id) {
      const p = parents[id];
      if (p) raw[p.owner].features[p.feature] = raw[p.owner].features[p.feature].filter(x => x !== id);
      for (const o of Object.values(raw)) for (const f of Object.keys(o.features)) o.features[f] = o.features[f].filter(x => x !== id);
      delete raw[id]; delete proxies[id]; delete parents[id];
      notify();
    },
    setToast: fn => { toast = fn; },
    afterEvent: (cls, ev, fn) => (afterHooks[`${cls}.${ev}`] ||= []).push(fn),
    reset() { load(pristine); for (const k of Object.keys(nodes)) delete nodes[k]; runDataUpdates(); notify(); },
    snapshot: () => JSON.parse(JSON.stringify(Object.values(raw))),
  };
})();

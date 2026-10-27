// Catalog seed: stocks every slot of the generated model with a product.
// Runs on the extracted model data (window.JJODEL) before runtime.js loads it,
// so the products are real Product objects and "Factory reset" keeps them.
// Product art is drawn here as SVG so it can't break like a hotlinked image.
(function () {
  const J = window.JJODEL;
  const objs = J.objects;
  J.originalObjects = JSON.parse(JSON.stringify(objs));   // the model as authored in jjodel (for the About page)
  const byId = id => objs.find(o => o.id === id);
  const uri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s.replace(/\s+/g, ' '));
  const FONT = 'font-family="Arial Black, Impact, Helvetica, sans-serif" font-weight="900"';
  const svg = (body, defs = '') => uri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 130" width="200" height="260"><defs>${defs}</defs>${body}</svg>`);
  const shine = `<linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".22" stop-color="#fff" stop-opacity=".38"/><stop offset=".34" stop-color="#fff" stop-opacity="0"/><stop offset=".85" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>`;
  const zig = (x1, x2, y, h, n = 10) => { let d = `M${x1} ${y}`; const w = (x2 - x1) / n; for (let i = 0; i < n; i++) d += ` l${w / 2} ${h} l${w / 2} ${-h}`; return d; };

  // ---------------------------------------------------------------- packaging shapes
  const bag = (c1, c2, art, title, sub, ink = '#fff') => {
    const body = 'M12 12 L88 12 Q95 66 88 118 L12 118 Q5 66 12 12 Z';
    return svg(`
      <path d="${body}" fill="url(#g)"/>
      <path d="${zig(12, 88, 12, 5)} L88 4 L12 4 Z" fill="${c1}"/>
      <path d="${zig(12, 88, 118, -5)} L88 126 L12 126 Z" fill="${c1}"/>
      <g clip-path="url(#c)">${art}</g>
      <text x="50" y="34" text-anchor="middle" ${FONT} font-size="${title.length > 8 ? 12 : 15}" fill="${ink}" stroke="rgba(0,0,0,.35)" stroke-width=".6">${title}</text>
      ${sub ? `<text x="50" y="45" text-anchor="middle" font-family="Arial, sans-serif" font-weight="700" font-size="7" fill="${ink}" opacity=".9">${sub}</text>` : ''}
      <path d="${body}" fill="url(#shine)"/>`,
      `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".5" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient><clipPath id="c"><path d="${body}"/></clipPath>${shine}`);
  };
  const can = (c1, c2, art, title, ink = '#fff') => svg(`
      <rect x="22" y="14" width="56" height="106" rx="7" fill="url(#g)"/>
      <g clip-path="url(#c)">${art}</g>
      <text x="50" y="40" text-anchor="middle" ${FONT} font-size="${title.length > 6 ? 10 : 12}" fill="${ink}">${title}</text>
      <rect x="22" y="14" width="56" height="106" rx="7" fill="url(#shine)"/>
      <ellipse cx="50" cy="15" rx="27" ry="5" fill="#d9dde2" stroke="#8b939c"/>
      <ellipse cx="50" cy="14" rx="9" ry="2" fill="#9aa3ac"/>
      <path d="M23 116 Q50 126 77 116 L77 119 Q50 129 23 119 Z" fill="#aab2ba"/>`,
      `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${c1}"/><stop offset=".45" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></linearGradient><clipPath id="c"><rect x="22" y="14" width="56" height="106" rx="7"/></clipPath>${shine}`);
  const box = (front, top, side, art, title, ink = '#fff') => svg(`
      <path d="M14 30 L28 16 L92 16 L78 30 Z" fill="${top}"/>
      <path d="M78 30 L92 16 L92 110 L78 124 Z" fill="${side}"/>
      <rect x="14" y="30" width="64" height="94" fill="${front}"/>
      <g clip-path="url(#c)">${art}</g>
      <text x="46" y="50" text-anchor="middle" ${FONT} font-size="${title.length > 7 ? 9.5 : 12}" fill="${ink}">${title}</text>
      <rect x="14" y="30" width="64" height="94" fill="url(#shine)" opacity=".6"/>`,
      `<clipPath id="c"><rect x="14" y="30" width="64" height="94"/></clipPath>${shine}`);

  // ---------------------------------------------------------------- the catalog
  const ART = {
    KitKat: svg(`
      <path d="${zig(26, 74, 10, 5, 6)} L74 4 L26 4 Z" fill="#b5121b"/>
      <rect x="26" y="10" width="48" height="110" fill="url(#g)"/>
      <path d="${zig(26, 74, 120, -5, 6)} L74 126 L26 126 Z" fill="#b5121b"/>
      <ellipse cx="50" cy="62" rx="20" ry="14" fill="#fff"/>
      <text x="50" y="66" text-anchor="middle" ${FONT} font-size="11" fill="#d0101b">KitKat</text>
      <text x="50" y="98" text-anchor="middle" font-family="Arial" font-weight="700" font-size="7" fill="#fff">4 FINGER</text>
      <rect x="26" y="10" width="48" height="110" fill="url(#shine)"/>`,
      `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#b5121b"/><stop offset=".5" stop-color="#ea1c24"/><stop offset="1" stop-color="#b5121b"/></linearGradient>${shine}`),

    'Moon Mochi': box('#1d2a5c', '#2b3c7a', '#121a3d', `
      <circle cx="58" cy="70" r="14" fill="#ffe7a3"/><circle cx="64" cy="66" r="12" fill="#1d2a5c"/>
      <circle cx="24" cy="64" r="1.2" fill="#fff"/><circle cx="34" cy="74" r=".9" fill="#fff"/><circle cx="70" cy="44" r="1" fill="#fff"/>
      <circle cx="30" cy="104" r="11" fill="#ffc2d6"/><circle cx="46" cy="108" r="11" fill="#fff6e8"/><circle cx="62" cy="104" r="11" fill="#b9e8a8"/>
      <circle cx="27" cy="101" r="3" fill="#fff" opacity=".6"/><circle cx="43" cy="105" r="3" fill="#fff" opacity=".8"/><circle cx="59" cy="101" r="3" fill="#fff" opacity=".6"/>`,
      'MOON MOCHI', '#ffe7a3'),

    'Lava Ramen': svg(`
      <path d="M18 40 L82 40 L72 122 L28 122 Z" fill="url(#g)"/>
      <path d="M22 70 Q30 56 36 70 Q42 50 50 68 Q58 52 64 70 Q70 58 78 70 L74 100 L26 100 Z" fill="#ff5a1f"/>
      <path d="M28 82 Q36 70 42 84 Q50 68 58 84 Q64 74 72 82 L70 100 L30 100 Z" fill="#ffc21f"/>
      <text x="50" y="114" text-anchor="middle" ${FONT} font-size="9" fill="#7a1100">LAVA RAMEN</text>
      <ellipse cx="50" cy="40" rx="34" ry="7" fill="#f2f2f2" stroke="#c8c8c8"/>
      <rect x="58" y="8" width="3" height="40" rx="1.5" fill="#c99a5b" transform="rotate(14 60 30)"/><rect x="64" y="8" width="3" height="40" rx="1.5" fill="#b78545" transform="rotate(20 66 30)"/>
      <path d="M36 30 q-4 -8 0 -14 M46 28 q-4 -8 0 -14" stroke="#fff" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>
      <path d="M18 40 L82 40 L72 122 L28 122 Z" fill="url(#shine)"/>`,
      `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#e9e3d8"/><stop offset=".5" stop-color="#fffaf0"/><stop offset="1" stop-color="#d6cfc2"/></linearGradient>${shine}`),

    'Cosmic Crunch': bag('#3b0f6b', '#7a2fd0', `
      <circle cx="62" cy="80" r="14" fill="#ff9d3b"/><ellipse cx="62" cy="80" rx="24" ry="5" fill="none" stroke="#ffd36e" stroke-width="2.5" transform="rotate(-18 62 80)"/>
      <path d="M26 66 l2 5 5 0 -4 3 2 5 -5 -3 -5 3 2 -5 -4 -3 5 0z" fill="#fff36e"/>
      <circle cx="80" cy="56" r="1.4" fill="#fff"/><circle cx="20" cy="94" r="1.2" fill="#fff"/><circle cx="44" cy="58" r="1" fill="#fff"/>
      <path d="M22 108 L40 96 L44 116 Z" fill="#f5b942"/><path d="M40 112 L58 104 L56 122 Z" fill="#e8a32e"/>`,
      'COSMIC', 'CRUNCH'),

    'Dill With It': bag('#1f6b2a', '#43b04f', `
      <rect x="30" y="56" width="40" height="58" rx="18" fill="#7cc242" stroke="#2f7a1f" stroke-width="2"/>
      <circle cx="38" cy="70" r="1.6" fill="#2f7a1f"/><circle cx="60" cy="96" r="1.6" fill="#2f7a1f"/><circle cx="44" cy="104" r="1.6" fill="#2f7a1f"/><circle cx="62" cy="68" r="1.6" fill="#2f7a1f"/>
      <rect x="31" y="74" width="16" height="9" rx="3" fill="#111"/><rect x="53" y="74" width="16" height="9" rx="3" fill="#111"/><rect x="46" y="76" width="8" height="2" fill="#111"/>
      <path d="M42 92 Q50 99 58 92" stroke="#1d4d12" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,
      'DILL WITH IT', 'PICKLE CHIPS'),

    'Kraken Jerky': bag('#08262e', '#145566', `
      <path d="M30 112 C14 104 12 84 22 74 C28 68 36 72 32 80" stroke="#e8505b" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M70 112 C86 104 88 84 78 74 C72 68 64 72 68 80" stroke="#e8505b" stroke-width="6" fill="none" stroke-linecap="round"/>
      <path d="M42 106 C38 92 46 86 44 72 C43 64 36 64 37 70" stroke="#ff6f78" stroke-width="5" fill="none" stroke-linecap="round"/>
      <path d="M58 106 C62 92 54 86 56 72 C57 64 64 64 63 70" stroke="#ff6f78" stroke-width="5" fill="none" stroke-linecap="round"/>
      <g fill="#ffd1d4"><circle cx="17" cy="90" r="1.3"/><circle cx="20" cy="80" r="1.3"/><circle cx="83" cy="90" r="1.3"/><circle cx="80" cy="80" r="1.3"/><circle cx="43" cy="88" r="1.1"/><circle cx="57" cy="88" r="1.1"/></g>
      <ellipse cx="50" cy="118" rx="24" ry="16" fill="#d63a47"/>
      <circle cx="41" cy="113" r="5.5" fill="#fff"/><circle cx="59" cy="113" r="5.5" fill="#fff"/>
      <circle cx="42" cy="114" r="2.6" fill="#111"/><circle cx="60" cy="114" r="2.6" fill="#111"/>`,
      'KRAKEN', 'SMOKED SEA JERKY', '#7ff0ff'),

    'Glitch Soda': can('#0a7d7b', '#19d3c5', `
      <rect x="22" y="52" width="9" height="9" fill="#ff2e88"/><rect x="40" y="62" width="9" height="9" fill="#ffe14d"/><rect x="58" y="54" width="9" height="9" fill="#ff2e88"/>
      <rect x="31" y="74" width="9" height="9" fill="#2e3cff"/><rect x="62" y="80" width="9" height="9" fill="#ffe14d"/><rect x="45" y="90" width="9" height="9" fill="#2e3cff"/>
      <rect x="22" y="96" width="56" height="3" fill="#ff2e88" opacity=".7"/><rect x="22" y="102" width="56" height="2" fill="#2e3cff" opacity=".6"/>`,
      'GL1TCH'),

    'Dragon Fizz': can('#a3104f', '#ff3d8b', `
      <ellipse cx="50" cy="80" rx="20" ry="22" fill="#ff4f9a" stroke="#c2185b" stroke-width="2"/>
      <ellipse cx="50" cy="82" rx="13" ry="15" fill="#fff7fb"/>
      <g fill="#222"><circle cx="45" cy="76" r="1"/><circle cx="54" cy="79" r="1"/><circle cx="48" cy="86" r="1"/><circle cx="55" cy="89" r="1"/><circle cx="44" cy="91" r="1"/></g>
      <path d="M33 66 l-6 -8 10 4 M66 66 l6 -8 -10 4 M50 58 l0 -9 4 8" stroke="#6ccf3d" stroke-width="3" fill="none" stroke-linecap="round"/>`,
      'DRAGON'),

    'Cloud Water': svg(`
      <path d="M40 8 h20 v12 h-20 z" fill="#2f86ff"/>
      <path d="M40 20 h20 q2 10 12 18 q10 8 10 22 v52 q0 10 -10 10 h-44 q-10 0 -10 -10 v-52 q0 -14 10 -22 q10 -8 12 -18z" fill="url(#g)" stroke="#9ccdf5" stroke-width="1.5"/>
      <rect x="18" y="62" width="64" height="38" fill="#ffffff" opacity=".92"/>
      <path d="M30 86 q0 -9 9 -8 q3 -9 12 -6 q8 -4 11 5 q8 0 7 9 z" fill="#bfe3ff"/>
      <text x="50" y="76" text-anchor="middle" ${FONT} font-size="10" fill="#2f86ff">CLOUD</text>
      <text x="50" y="96" text-anchor="middle" font-family="Arial" font-weight="700" font-size="6.5" fill="#5a9bd5">SPARKLING · 0 CAL</text>
      <circle cx="34" cy="112" r="2" fill="#fff" opacity=".7"/><circle cx="62" cy="50" r="2.5" fill="#fff" opacity=".7"/><circle cx="66" cy="112" r="1.5" fill="#fff" opacity=".7"/>
      <path d="M40 20 h20 q2 10 12 18 q10 8 10 22 v52 q0 10 -10 10 h-44 q-10 0 -10 -10 v-52 q0 -14 10 -22 q10 -8 12 -18z" fill="url(#shine)"/>`,
      `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#9fd3ff"/><stop offset=".5" stop-color="#e1f3ff"/><stop offset="1" stop-color="#8cc7f5"/></linearGradient>${shine}`),

    'Gummy Galaxy': bag('#0f1a3d', '#24408f', `
      <rect x="20" y="56" width="60" height="54" rx="12" fill="#ffffff" opacity=".22" stroke="#fff" stroke-opacity=".5"/>
      <circle cx="36" cy="72" r="8" fill="#ff5c8a"/><circle cx="58" cy="70" r="6" fill="#ffd93d"/><ellipse cx="58" cy="70" rx="11" ry="3" fill="none" stroke="#ffa53d" stroke-width="1.5"/>
      <circle cx="44" cy="94" r="9" fill="#4dd6a0"/><circle cx="66" cy="96" r="7" fill="#7d6cff"/><circle cx="28" cy="98" r="5" fill="#ff9d3b"/>
      <circle cx="33" cy="69" r="2" fill="#fff" opacity=".5"/><circle cx="41" cy="91" r="2.4" fill="#fff" opacity=".5"/>`,
      'GUMMY', 'GALAXY · GUMMIES'),

    'Choco Bricks': box('#5a3218', '#7a4a28', '#3e2210', `
      <g fill="#7b4a26" stroke="#3e2210" stroke-width="1.4">
        <rect x="16" y="60" width="20" height="10"/><rect x="36" y="60" width="20" height="10"/><rect x="56" y="60" width="20" height="10"/>
        <rect x="6" y="70" width="20" height="10"/><rect x="26" y="70" width="20" height="10"/><rect x="46" y="70" width="20" height="10"/><rect x="66" y="70" width="20" height="10"/>
        <rect x="16" y="80" width="20" height="10"/><rect x="36" y="80" width="20" height="10"/><rect x="56" y="80" width="20" height="10"/>
      </g>
      <rect x="14" y="98" width="64" height="16" fill="#e8b04a"/>
      <text x="46" y="109" text-anchor="middle" font-family="Arial" font-weight="900" font-size="7" fill="#3e2210">BUILD · BITE · REPEAT</text>`,
      'CHOCO BRICKS', '#ffd38a'),

    'Ducky Pops': svg(`
      <rect x="14" y="14" width="72" height="106" rx="8" fill="url(#g)" stroke="#e0a800" stroke-width="2"/>
      <circle cx="50" cy="22" r="4" fill="#fff" stroke="#e0a800"/>
      <text x="50" y="42" text-anchor="middle" ${FONT} font-size="12" fill="#e2570b">DUCKY</text>
      <text x="50" y="54" text-anchor="middle" ${FONT} font-size="9" fill="#e2570b">POPS</text>
      <g>${[[32, 80], [68, 80], [50, 98]].map(([x, y]) => `
        <rect x="${x - 1.5}" y="${y + 8}" width="3" height="18" fill="#fff" stroke="#ddd"/>
        <circle cx="${x}" cy="${y}" r="11" fill="#ffd400" stroke="#e0a800"/>
        <circle cx="${x - 3}" cy="${y - 3}" r="1.6" fill="#222"/>
        <path d="M${x + 2} ${y} q7 -1 8 3 q-5 3 -8 1z" fill="#ff8a00"/>`).join('')}</g>
      <rect x="14" y="14" width="72" height="106" rx="8" fill="url(#shine)"/>`,
      `<linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".5" stop-color="#fffbe0"/><stop offset="1" stop-color="#ffe680"/></linearGradient>${shine}`),

    'Mystery Box': box('#2a2a2a', '#3a3a3a', '#161616', `
      <g ${FONT} fill="#ffcc00" opacity=".18" font-size="16">
        <text x="18" y="74">?</text><text x="52" y="66">?</text><text x="34" y="96">?</text><text x="62" y="110">?</text><text x="20" y="118">?</text>
      </g>
      <rect x="40" y="30" width="12" height="94" fill="#c4162a"/><rect x="14" y="70" width="64" height="12" fill="#c4162a"/>
      <circle cx="46" cy="76" r="15" fill="#ffcc00" stroke="#c48f00" stroke-width="2"/>
      <text x="46" y="83" text-anchor="middle" ${FONT} font-size="20" fill="#2a2a2a">?</text>`,
      'MYSTERY', '#ffcc00'),
  };

  // shelf by shelf: [code, product, price, quantity, capacity]
  const PLAN = [
    [['01', 'KitKat', 2, 6, 8], ['02', 'Prime', 4, 5, 6], ['03', 'Moon Mochi', 4, 4, 6], ['04', 'Lava Ramen', 5, 3, 5]],
    [['11', 'Cosmic Crunch', 3, 7, 8], ['12', 'Dill With It', 3, 5, 8], ['13', 'Doritos', 3, 6, 8], ['14', 'Kraken Jerky', 6, 2, 6]],
    [['21', 'Glitch Soda', 2, 8, 10], ['22', 'Dragon Fizz', 2, 6, 10], ['23', 'Coke', 2, 9, 10], ['24', 'Cloud Water', 1, 10, 10]],
    [['31', 'Gummy Galaxy', 3, 6, 8], ['32', 'Choco Bricks', 4, 4, 6], ['33', 'Ducky Pops', 2, 7, 8], ['34', 'Mystery Box', 5, 1, 3]],
  ];

  const productId = name => {
    let p = objs.find(o => o.class === 'Product' && (o.features.name || [])[0] === name);
    if (!p) {
      p = { id: 'Seed_' + name.replace(/\W+/g, '_'), name: name.replace(/\W+/g, ''), class: 'Product', owner: null, ownerFeature: null,
        features: { name: [name], image_url: [] } };
      objs.push(p);
    }
    if (ART[name]) p.features.image_url = [ART[name]];
    return p.id;
  };

  const machine = objs.find(o => o.class === 'Machine');
  (machine.features.ownedShelves || []).map(byId).forEach((shelf, i) => {
    (shelf.features.ownedSlots || []).map(byId).forEach((slot, j) => {
      const row = PLAN[i] && PLAN[i][j]; if (!row) return;
      const [code, name, price, qty, cap] = row;
      Object.assign(slot.features, { slot_id: [code], product: [productId(name)], price: [price], quantity: [qty], capacity: [cap] });
    });
  });

  // drop products nothing refers to and that have no name (the model's empty Product_0)
  J.objects = objs.filter(o => !(o.class === 'Product' && !(o.features.name || []).length &&
    !objs.some(x => Object.values(x.features).some(v => v.includes(o.id)))));
})();

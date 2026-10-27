# Vending Machine

An interactive vending machine driven by the jjodel project `Vending Machine (3).jjodel`.
Shelves, slots, products, prices, stock and coin tubes all come from the model.
Every purchase or service edit writes back into the model objects.

## Run

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then http://localhost:8000
```

It needs internet access for React, htm, Babel, fonts and the product images. State
(model edits, wallet, bag, sales) is saved in the browser; **Service → Model → Factory reset** restores it.

## Using it

- **Pay:** drag a coin from the wallet dock into the coin slot, or tap it (`Shift`+`1`/`2`/`5`).
  The `+` button finds more coins.
- **Choose:** type the product's code on the keypad (`0–9`); hovering a product shows its code, price and stock. Then press **OK** (`Enter`). You can also choose
  first and pay after: the machine vends as soon as your credit covers the price.
- **Collect:** push the flap to put items in your bag, and tap the cup for your change. You can eat items from the bag.
- **COIN RETURN** (`R`) refunds your credit. **CLR** (`Esc`) clears the selection.
- **Service** (top right) has stock and prices, the product catalog (add, edit, delete), the coin tubes and float,
  sales charts, model health checks, and JSON import/export. In service mode, clicking a slot on the machine opens it for editing.
- **?** (bottom left, or `#about`) opens the project page: the MDE course context, the metamodel drawn live, and what was hard.
- **jjodel views** shows the model's original Concrete Syntax views, rendered unchanged and sharing the same model.

## How the machine behaves

- Change is paid from the coins actually in the tubes, using a bounded change-making search that always finds a
  solution when one exists. If no exact change is possible, the sale is refused and your credit is kept.
- The **EXACT CHANGE** lamp lights when the tubes can't pay every amount below the largest coin.
- Inserted coins are booked by the model's own Behavior event (`CoinInsert.insertCoin` → `CoinSlot.balance`).
  On a sale they move into `inStorage`.

## Files

| File | What it is |
|---|---|
| `model.js` | Generated from the .jjodel file: metamodel, objects, views, events, canvas sizes |
| `seed.js` | Stocks every slot: 16 products (12 original ones drawn as SVG), prices, stock and capacities, applied to the model before it loads |
| `runtime.js` | jjodel-compatible object API (`data.$feature.value`, `.values`, `state`, `node.events`…) that also renders the original JSX views |
| `vend.js` | Vending logic: model queries, change-making, purchase flow, session store, validation |
| `ui-machine.js`, `machine.css` | The machine and wallet dock |
| `ui-about.js` | About page; facts and the metamodel diagram are read from the extracted model |
| `ui-service.js` | Service drawer |
| `app.js`, `app.css` | Shell: top bar, view switch, fit-to-screen, theme, sound toggle |
| `sound.js` | Synthesized sounds (WebAudio) |
| `tools/extract.cjs` | Regenerates `model.js` from a `.jjodel` export |

After editing the model in jjodel, export it and run:

```sh
node tools/extract.cjs "/mnt/c/Users/phuc/Downloads/Vending Machine (3).jjodel"
```

Saved browser state is discarded automatically when the regenerated model doesn't match it.

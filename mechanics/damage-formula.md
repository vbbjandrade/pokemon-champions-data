<!-- TODO: remove redundant info -->

# Damage Formula

Documentation of the damage calculation engine in Pokémon Champions, derived from `sources/calc.ts` and the Champions stat system `stats.md`.

The formula is implemented in **AssemblyScript** at `data/mechanics/damage-formula.ts` — a typed language that compiles to WebAssembly. Running `bun run generate` compiles it to `dist/mechanics/damage-formula.wasm`, ready to embed in any application that can load a `.wasm` file.

---

## 1. Overview

Damage calculation in Pokémon Champions takes place in 5 sequential phases:

1. **In-Battle Stat Determination**: Calculating effective Attack and Defense stats from species base stats, SP investment, Stat Alignment, stage multipliers, and ability/item/weather stat modifiers.
2. **Base Power Determination**: Evaluating move base power, variable move mechanics (`lowkick`, `heavyslam`, `gyroball`), and Base Power modifiers (`bpMods`).
3. **Core Base Damage Calculation**: Computing base damage using the Champions Level 50 formula.
4. **Pre-Roll Multipliers**: Applying spread move penalties, weather adjustments, critical hit bonuses, and Parental Bond child penalties.
5. **Final Damage Rolls & Modifiers**: Generating 16 random damage rolls ($85\% \dots 100\%$) modified by STAB, type effectiveness, status conditions, screens, and held items.

---

## 2. In-Battle Stat Calculation

Before damage is computed, the attacker's `Attack` stat and defender's `Defense` stat are calculated.

### A. Champions Stat Formula
As detailed in [`stats.md`](file:///c:/Code/vbbjandrade/pokemon-champions-data/data/mechanics/stats.md), Champions replaces traditional EVs, IVs, and Natures with **Stat Points (SP)** (up to 32 per stat, 66 total) and **Stat Alignments**:

$$ \text{HP} = \text{Base} + \text{StatPoints} + 75 $$

$$ \text{Stat}_{\text{raw}} = (\text{Base} + \text{StatPoints} + 20) \times \text{Alignment} $$

Where $\text{Alignment} = 1.1$ (raised), $0.9$ (lowered), or $1.0$ (neutral).

### B. Stage Multipliers
Stat changes (stages $-6 \dots +6$) modify $\text{Stat}_{\text{raw}}$:

| Stage | -6 | -5 | -4 | -3 | -2 | -1 | 0 | +1 | +2 | +3 | +4 | +5 | +6 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Multiplier** | 2/8 | 2/7 | 2/6 | 2/5 | 2/4 | 2/3 | 2/2 | 3/2 | 4/2 | 5/2 | 6/2 | 7/2 | 8/2 |

* **Unaware (`unaware`)**: Defender's `unaware` ignores attacker's Attack stage boosts. Attacker's `unaware` ignores defender's Defense stage boosts.
* **Critical Hits**: Negative Attack stage modifiers on attacker and positive Defense stage modifiers on defender are ignored during critical hits.

### C. In-Battle Stat Modifiers (`atMods` & `dfMods`)
In-battle stat modifiers are chained using fixed 16-bit rounding (`pokeRound` and `chainMods`):

* **Attack Modifiers (`atMods`)**:
  * `hustle`: $1.5\times$ ($6144/4096$) for Physical moves.
  * `hugepower` / `purepower`: $2.0\times$ ($8192/4096$) for Physical moves.
  * `guts`: $1.5\times$ ($6144/4096$) when statused for Physical moves.
  * `solarpower`: $1.5\times$ ($6144/4096$) in Sun for Special moves.
  * `waterbubble`: $2.0\times$ ($8192/4096$) for Water moves.
  * `thickfat`: $0.5\times$ ($2048/4096$) against Fire/Ice moves.
  * `heatproof`: $0.5\times$ ($2048/4096$) against Fire moves.

* **Defense Modifiers (`dfMods`)**:
  * `sandstorm`: $1.5\times$ SpD boost for Rock-type Pokémon in Sandstorm weather.
  * `snow`: $1.5\times$ Def boost for Ice-type Pokémon in Snow weather.
  * `furcoat`: $2.0\times$ ($8192/4096$) for Physical moves.
  * `marvelscale`: $1.5\times$ ($6144/4096$) when statused against Physical moves.
  * `grasspelt`: $1.5\times$ ($6144/4096$) in Grassy Terrain against Physical moves.

$$ \text{Attack} = \max\left(1, \text{pokeRound}\left(\frac{\text{Stat}_{\text{modified}} \times \text{atMod}}{4096}\right)\right) $$

$$ \text{Defense} = \max\left(1, \text{pokeRound}\left(\frac{\text{Stat}_{\text{modified}} \times \text{dfMod}}{4096}\right)\right) $$

---

## 3. Base Power Calculation

### A. Variable Base Power Moves
Base power ($\text{BP}$) varies dynamically for specific moves:

| Move Primary Key | Mechanic / Calculation |
|---|---|
| `lowkick` / `grassknot` | Target weight $w$: $<10\text{kg} \to 20$, $<25\text{kg} \to 40$, $<50\text{kg} \to 60$, $<100\text{kg} \to 80$, $<200\text{kg} \to 100$, $\ge 200\text{kg} \to 120$ |
| `heavyslam` / `heatcrash` | Weight ratio $r = w_{\text{user}} / w_{\text{target}}$: $r \ge 5 \to 120$, $r \ge 4 \to 100$, $r \ge 3 \to 80$, $r \ge 2 \to 60$, else $40$ |
| `gyroball` | $\min(150, \lfloor (25 \times \text{Speed}_{\text{target}}) / \text{Speed}_{\text{user}} \rfloor + 1)$ |
| `electroball` | Speed ratio $r = \lfloor \text{Speed}_{\text{user}} / \text{Speed}_{\text{target}} \rfloor$: $r \ge 4 \to 150$, $r \ge 3 \to 120$, $r \ge 2 \to 80$, $r \ge 1 \to 60$, else $40$ |
| `hex` / `infernalparade` | $2.0\times \text{BP}$ if target has a status condition |
| `barbbarrage` | $2.0\times \text{BP}$ if target is poisoned (`psn`, `tox`) |
| `storedpower` / `powertrip` | $20 + 20 \times (\text{total positive stat stage boosts})$ |
| `flail` / `reversal` | User HP fraction $p = \lfloor 48 \times \text{HP}_{\text{cur}} / \text{HP}_{\text{max}} \rfloor$: $p \le 1 \to 200$, $p \le 4 \to 150$, $p \le 9 \to 100$, $p \le 16 \to 80$, $p \le 32 \to 40$, else $20$ |
| `eruption` / `waterspout` | $\max(1, \lfloor 150 \times \text{HP}_{\text{cur}} / \text{HP}_{\text{max}} \rfloor)$ |
| `tripleaxel` | Hit $1 \to 20$, Hit $2 \to 40$, Hit $3 \to 60$ |

### B. Base Power Modifiers (`bpMods`)
Base power modifiers are chained scaled by 4096:

* **Move Modifiers**: `facade` (statused), `venoshock` (poisoned), `lashout` (stat drops): $2.0\times$ ($8192/4096$). `knockoff`, `expandingforce`, `mistyexplosion`: $1.5\times$ ($6144/4096$).
* **Terrain Boosts**: Electric, Grassy, or Psychic Terrain for grounded user: $1.3\times$ ($5325/4096$).
* **Ability BP Boosts**: `technician` ($\text{BP} \le 60$), `strongjaw` (bite), `sharpness` (slicing), `megalauncher` (pulse), `steelyspirit` (Steel): $1.5\times$ ($6144/4096$). `charge` (Electric): $2.0\times$ ($8192/4096$). `aerilate`, `pixilate`, `refrigerate`, `dragonize`: $1.2\times$ ($4915/4096$).
* **Item BP Boosts**: Type gems (`firegem`, etc.): $1.3\times$ ($5325/4096$). Type items (`charcoal`, `softsand`, etc.): $1.2\times$ ($4915/4096$). `muscleband` / `wiseglasses`: $1.1\times$ ($4505/4096$).

$$ \text{BasePower}_{\text{final}} = \max\left(1, \text{pokeRound}\left(\frac{\text{BasePower} \times \text{bpMod}}{4096}\right)\right) $$

---

## 4. Base Damage Equation

In Pokémon Champions competitive play, all Pokémon battle at **Level 50**.

The base damage calculation simplifies as follows:

$$ \text{LevelFactor} = \left\lfloor \frac{2 \times 50}{5} + 2 \right\rfloor = 22 $$

$$ \text{BaseDamage} = \left\lfloor \frac{\left\lfloor \frac{22 \times \text{BasePower} \times \text{Attack}}{\text{Defense}} \right\rfloor}{50} \right\rfloor + 2 $$

### Pre-Roll Modifiers
1. **Spread Move Penalty**: If in Doubles and using a spread move (`allAdjacent`, `allAdjacentFoes`):
   $$ \text{BaseDamage} = \text{pokeRound}\left(\frac{\text{BaseDamage} \times 3072}{4096}\right) \quad (0.75\times) $$
2. **Parental Bond Child Hit**:
   $$ \text{BaseDamage} = \text{pokeRound}\left(\frac{\text{BaseDamage} \times 1024}{4096}\right) \quad (0.25\times) $$
3. **Weather Adjustment**:
   * Sun + Fire move / Rain + Water move: $1.5\times$ ($6144/4096$)
   * Sun + Water move / Rain + Fire move: $0.5\times$ ($2048/4096$)
4. **Critical Hit**:
   $$ \text{BaseDamage} = \lfloor \text{BaseDamage} \times 1.5 \rfloor $$

---

## 5. Final Damage Rolls & Variance

To determine the actual damage dealt in battle, 16 damage values are calculated corresponding to random variance values from $85\%$ to $100\%$ ($R_i = \lfloor 85 + i \rfloor / 100$ for $i \in [0, 15]$):

For each roll index $i \in [0 \dots 15]$:

1. **Initial Random Roll**:
   $$ D_i = \left\lfloor \text{BaseDamage} \times \frac{85 + i}{100} \right\rfloor $$

2. **STAB (Same Type Attack Bonus)**:
   $$ D_i = \text{pokeRound}\left(\frac{D_i \times \text{STAB}}{4096}\right) $$
   * Normal STAB: $1.5\times$ ($6144/4096$)
   * `adaptability`: $2.0\times$ ($8192/4096$)
   * Non-STAB: $1.0\times$ ($4096/4096$)

3. **Type Effectiveness**:
   $$ D_i = \lfloor D_i \times \text{TypeEffectiveness} \rfloor $$
   * $\text{TypeEffectiveness} \in \{0, 0.25, 0.5, 1.0, 2.0, 4.0\}$

4. **Burn Penalty**:
   If user is burned (`brn`), move is Physical, and user does not have `guts` or use `facade`:
   $$ D_i = \left\lfloor \frac{D_i}{2} \right\rfloor $$

5. **Final Modifiers (`finalMod`)**:
   $$ D_i = \text{pokeRound}\left(\frac{D_i \times \text{finalMod}}{4096}\right) $$
   * `reflect` / `lightscreen` / `auroraveil`: $0.5\times$ ($2048/4096$) in Singles, $0.667\times$ ($2732/4096$) in Doubles.
   * `sniper` (on critical hit): $1.5\times$ ($6144/4096$).
   * `multiscale` (at 100% HP): $0.5\times$ ($2048/4096$).
   * `fluffy` / `auraguard` (against contact moves): $0.5\times$ ($2048/4096$).
   * `solidrock` / `filter` (against super-effective moves): $0.75\times$ ($3072/4096$).
   * `friendguard`: $0.75\times$ ($3072/4096$).
   * `lifeorb`: $1.3\times$ ($5324/4096$).
   * `expertbelt` (against super-effective moves): $1.2\times$ ($4915/4096$).
   * Berry resist (`occaberry`, `passhoberry`, etc.): $0.5\times$ ($2048/4096$) [$0.25\times$ ($1024/4096$) with `ripen`].

6. **Damage Floor**:
   If $\text{TypeEffectiveness} > 0$:
   $$ D_i = \max(1, D_i) $$

---

## 6. Mathematical Helper Functions

### Fixed Rounding (`pokeRound`)
Standard Pokémon rounding logic used throughout Showdown:

```ts
function pokeRound(val: number): number {
  return Math.floor(val + 0.5);
}
```

### Modifier Chaining (`chainMods`)
Chaining multiple 4096-based integer modifiers:

```ts
function chainMods(mods: number[]): number {
  let mod = 4096;
  for (const m of mods) {
    mod = Math.floor((mod * m + 2048) / 4096);
  }
  return mod;
}
```

---

## 7. WebAssembly Engine (`damage-formula.wasm`)

The damage calculation logic above is implemented in **AssemblyScript** at `data/mechanics/damage-formula.ts`. AssemblyScript is a TypeScript-like language that compiles directly to WebAssembly — it uses the same syntax as TypeScript but with strict numeric types (`i32`, `f64`) and no JavaScript runtime dependency. The output is a standalone, zero-dependency binary.

Running `bun run generate` compiles `damage-formula.ts` and places the output at `dist/mechanics/damage-formula.wasm` (and inside each regulation folder at `dist/<regulation>/mechanics/damage-formula.wasm`). On pushes to `main`, GitHub Actions publishes these files to the orphan `data` branch alongside the compiled regulation datasets.

### Exported Functions

| Function | Signature | Description |
|---|---|---|
| `pokeRound` | `(val: f64) → i32` | Pokémon fixed rounding (`floor(x + 0.5)`) |
| `chainMods` | `(mods: StaticArray<i32>) → i32` | Chain $4096$-scaled integer modifiers |
| `calculateHP` | `(base: i32, sp: i32) → i32` | Champions HP stat (`Base + SP + 75`) |
| `calculateStat` | `(base: i32, sp: i32, alignment: f64, stage: i32) → i32` | Champions non-HP stat with stage |
| `getBaseDamage` | `(level: i32, basePower: i32, attack: i32, defense: i32) → i32` | Core Level 50 base damage |
| `calculateDamageRolls` | `(level, basePower, attack, defense, typeEffectiveness, stabMod, applyBurn, finalMod, isProtected, isSpread, isParentalBondChild, weatherMod, isCritical) → StaticArray<i32>` | All 16 damage rolls ($85\% \dots 100\%$) |

### Getting the binary

Build locally:
```bash
bun run generate
# Output: dist/mechanics/damage-formula.wasm
```

Or fetch directly from the `data` branch:
```
https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/mechanics/damage-formula.wasm
```

Or per-regulation:
```
https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/m-b/mechanics/damage-formula.wasm
```

### Usage Examples

#### JavaScript / TypeScript (Browser, Node.js, Bun)

No dependencies needed — `WebAssembly` is built into all modern JS runtimes:

```js
const url = 'https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/mechanics/damage-formula.wasm';
const { instance } = await WebAssembly.instantiateStreaming(fetch(url));
const calc = instance.exports;

// Base stats: Charizard (spa 109, max SP, neutral alignment, no stage)
const spa = calc.calculateStat(109, 32, 1.0, 0); // 161
const spd = calc.calculateStat(85, 0, 1.0, 0);   // 105 (no investment)

// Level 50, Flamethrower (BP 90)
const base = calc.getBaseDamage(50, 90, spa, spd); // 67
console.log('Min–max damage:', base * 85 / 100 | 0, '–', base);
```

#### Python (`wasmtime`)

Install: `pip install wasmtime`

```python
import urllib.request
from wasmtime import Store, Module, Instance

url = "https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/mechanics/damage-formula.wasm"
wasm_bytes = urllib.request.urlopen(url).read()

store = Store()
module = Module(store.engine, wasm_bytes)
instance = Instance(store, module, [])
exports = instance.exports(store)

# calculateStat(base, sp, alignment, stage) -> i32
spa = exports["calculateStat"](store, 109, 32, 1.0, 0)  # 161
spd = exports["calculateStat"](store, 85, 0, 1.0, 0)    # 105

base_dmg = exports["getBaseDamage"](store, 50, 90, spa, spd)
print(f"Base damage: {base_dmg}")
```

#### Rust (`wasmtime` crate)

Add to `Cargo.toml`:
```toml
[dependencies]
wasmtime = "20"
```

```rust
use wasmtime::*;

fn main() -> anyhow::Result<()> {
    let engine = Engine::default();
    let module = Module::from_file(&engine, "dist/mechanics/damage-formula.wasm")?;
    let mut store = Store::new(&engine, ());
    let instance = Instance::new(&mut store, &module, &[])?;

    let calculate_stat = instance
        .get_typed_func::<(i32, i32, f64, i32), i32>(&mut store, "calculateStat")?;
    let get_base_damage = instance
        .get_typed_func::<(i32, i32, i32, i32), i32>(&mut store, "getBaseDamage")?;

    let spa = calculate_stat.call(&mut store, (109, 32, 1.0, 0))?; // 161
    let spd = calculate_stat.call(&mut store, (85, 0, 1.0, 0))?;   // 105
    let base = get_base_damage.call(&mut store, (50, 90, spa, spd))?;

    println!("Base damage: {}", base);
    Ok(())
}
```

---

## Sources

- [`sources/calc.ts`](file:///c:/Code/vbbjandrade/pokemon-champions-data/sources/calc.ts) — Official Showdown Champions damage calculator module
- `data/mechanics/damage-formula.ts` — AssemblyScript source for the WebAssembly engine
- [`data/mechanics/stats.md`](file:///c:/Code/vbbjandrade/pokemon-champions-data/data/mechanics/stats.md) — Stat calculation formula & SP system documentation
- [`data/mechanics/effectiveness.json`](file:///c:/Code/vbbjandrade/pokemon-champions-data/data/mechanics/effectiveness.json) — Champions type effectiveness matrix

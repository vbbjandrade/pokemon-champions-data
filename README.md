# Pokemon Champions Data

> The first open, structured competitive dataset for Pokemon Champions.

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
<!-- [![Characters](https://img.shields.io/badge/Characters-258-blue.svg)]() -->
[![Last Updated](https://img.shields.io/badge/Last%20Updated-Aug%202026-green.svg)]()

Pokemon Champions launched on April 8th, 2026. This repository is the definitive data source for competitive play: every character's base stats, complete move and ability pool, the full item list, and detailed documentation of game mechanics unique to Champions — including the SP stat distribution system that replaces the traditional EV framework.

Data is drawn from Showdown's open-source files and continuously refined by community verification. If you are building a team builder, a damage calculator, a tier list tool, or anything else for the Champions competitive scene, this is where you start.

---

## What's Inside

| Location | Contents |
|---|---|
| `data/master/` | Unfiltered Showdown roster, moves, abilities, and items |
| `data/mechanics/` | Game formula and systems documentation |
| `data/regm-*/` | Regulation ruleset delta files |
| `data` branch | Compiled roster, learnsets, moves, abilities, and items for consumers (built locally in `dist/`) |

The playable characters include base forms, regional variants and other alternate forms. Every form with distinct relevant attributes is represented as a separate entry.

## Regulation data architecture

The editable data is split into an unfiltered Showdown baseline and small, regulation-specific deltas:

- `data/master/` contains all parsed Showdown roster, move, ability, and item entries.
- `data/regm-a/delta.json` and `data/regm-b/delta.json` define legal roster entries and only the resource properties changed by that regulation. Learnsets are regulation-owned and stored in the delta because Showdown provides their complete regulation-specific sets.
- `dist/regm-*/` contains compiled consumer files (`roster.json`, `learnsets.json`, `moves.json`, `abilities.json`, and `items.json`). On pushes to `main`, the GitHub Actions deployment workflow automatically publishes these compiled files to the dedicated orphan `data` branch.

Each regulation declares its `baseRegulationId` in `scripts/regulations.ts`. This is this repository's chronological ownership model, and though technically reliant on it, does not follow Showdown's mod inheritance structure. A regulation without a `baseRegulationId` overrides master data; a regulation with one applies on top of that base.
e.g. Reg M-C is compiled as `master → Reg M-A → Reg M-B → Reg M-C`.

Each generated `delta.json` repeats that `baseRegulationId` as build metadata. Every override collection is a chained patch: omitted entries are inherited unchanged, `{}` adds an available entry with unchanged data, a populated object replaces only the changed fields, and `null` removes an inherited entry. The base regulation contains full learnsets because master has none; later regulations contain only changed, added, or removed learnsets. Move and ability availability is derived from those learnsets and roster entries, respectively; items use Showdown availability without retaining its `isNonstandard` reason strings.

`overrides.roster` is the regulation's legal-species list: an empty object keeps a master Pokémon unchanged, while supplied properties patch it. `baseStats` patches by stat; all other override properties replace their master value.

Compiled moves and abilities are selected from the regulation roster and learnsets, so separate move or ability legality lists are unnecessary. Items use their Showdown `isNonstandard` status to omit regulation-illegal entries.

The updater preserves a manually maintained override when its `source` is not `smogon/pokemon-showdown`, and retains each delta's optional `begin` and `end` timestamps.

To regenerate data locally, run:

```bash
bun run fetch-sd          # download regulation mod overlays only
bun run generate          # rebuild master data + regulation deltas + dist files
```

`fetch-sd` is a zero-config, self-documenting fetcher driven by `scripts/regulations.ts`. By default, it **only** downloads regulation mod overlays — the base game files (`pokedex.ts`, `moves-main.ts`, etc.) are pinned to the ref configured in `SHOWDOWN_BASE_CONFIG` and are **never touched** unless explicitly requested. This prevents routine regulation fetches from overwriting the base game snapshot with stale commits.

To update base game files (e.g. after a new Showdown release), pass `--base`:

```bash
bun run fetch-sd --base           # Update base game files to SHOWDOWN_BASE_CONFIG ref
bun run fetch-sd --base-ref abc1  # Update base game files to a specific commit
bun run fetch-sd --all            # Fetch both base files + latest regulation mods
```

To target or reconstruct an older regulation snapshot, simply pass its regulation ID or directory name:

```bash
# Fetches Reg M-B mod and its base Reg M-A using their pinned Showdown commits
bun run fetch-sd regm-b
```

You can also override the commit SHA directly or test WIP branches:

```bash
# Test against a specific Showdown commit or branch for mods
bun run fetch-sd --ref <commit-sha>
```

Each regulation entry in `scripts/regulations.ts` tracks its pinned Showdown commit SHA and provides a direct link to the Showdown commit history for that mod. `SHOWDOWN_BASE_CONFIG` at the top of the same file pins the base game ref. This ensures complete auditability and reproducibility without hunting through external commit logs.

To rebuild consumer files without re-downloading Showdown files, run `bun run build-regulations`. The GitHub Actions workflow runs the full generation sequence on pushes to `main` and publishes the resulting `./dist` contents directly to the orphan `data` branch.

---

## Quick Start

### curl

Fetch the full roster directly from the raw GitHub URL on the `data` branch:

```bash
curl https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/regm-b/roster.json
```

Fetch a single character's base stats:

```bash
curl https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/regm-b/roster.json \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data['charizard'], indent=2))"
```

### JavaScript

```js
// Fetch and filter to Fire-type characters
const roster = await fetch(
  'https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/regm-b/roster.json'
).then(r => r.json());

const fireTypes = Object.values(roster).filter(p => p.types.includes('Fire'));
console.log(`Fire-type characters: ${fireTypes.length}`);
```

```js
// Load roster and find the fastest characters
const roster = await fetch(
  'https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data/regm-b/roster.json'
).then(r => r.json());

const bySpeed = Object.entries(roster)
  .sort(([, a], [, b]) => b.spe - a.spe)
  .slice(0, 10);

bySpeed.forEach(([name, stats]) => {
  console.log(`${name}: ${stats.spe} Speed`);
});
```

### Python

```python
import json, urllib.request

def fetch(path):
    base = "https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/data"
    with urllib.request.urlopen(f"{base}/{path}") as r:
        return json.load(r)

roster    = fetch("regm-b/roster.json")
learnsets = fetch("regm-b/learnsets.json")
moves     = fetch("regm-b/moves.json")

# Find all moves Charizard can learn
charizard_moves = learnsets["charizard"]["moves"]
print(charizard_moves)
```

---

## Data Format Examples

### `data/<regulation>/roster.json` — a single entry

```json
"venusaur": {
  "dexNumber": 3,
  "name": "Venusaur",
  "types": [
    "Grass",
    "Poison"
  ],
  "form": null,
  "abilities": {
    "0": "Overgrow",
    "H": "Chlorophyll"
  },
  "weightKg": 100,
  "requiredItem": null,
  "requiredMove": null,
  "canEvolve": false,
  "genders": [
    "M",
    "F"
  ],
  "baseStats": {
    "total": 525,
    "hp": 80,
    "atk": 82,
    "def": 83,
    "spa": 100,
    "spd": 100,
    "spe": 80
  },
  "sources": [
    "smogon/pokemon-showdown"
  ]
}
```

### `dist/<regulation>/moves.json` — a single move entry
```json
"accelerock": {
  "name": "Accelerock",
  "type": "Rock",
  "category": "Physical",
  "power": 40,
  "accuracy": 100,
  "pp": 20,
  "priority": 1,
  "target": "normal",
  "desc": "No additional effect.",
  "shortDesc": "Usually goes first.",
}
```

---

## SP System

Champions replaces the traditional 510 EV system with a streamlined **SP (Stat Points)** system:

- **66 total SP** to distribute across all six stats
- **Maximum 32 SP** per individual stat
- Fewer points mean harder tradeoffs — you cannot invest heavily in every stat simultaneously
- Speed tiers are compressed, making small SP differences more decisive than in standard games

Full documentation is in [`data/mechanics/sp-system.md`](data/mechanics/sp-system.md). Stat calculation details, including the SP-to-stat mapping, are in [`data/mechanics/stat-formula.md`](data/mechanics/stat-formula.md).

---

## Contributing

We welcome community contributions and verification! See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

- If you notice a data discrepancy in-game, please file an issue using our structured [Data Discrepancy Report template](.github/ISSUE_TEMPLATE/data-correction.yml).
- When submitting pull requests, edit the target regulation's `data/<regulation>/delta.json` file. All delta files feature real-time editor autocompletion and type validation powered by `schemas/delta.schema.json`.

---

## Data Sources

- **Showdown open-source data files (smogon/pokemon-showdown)** — base stats, moves, abilities, items, learnsets, and type chart. Showdown's data is well-maintained and serves as the starting point for all entries.
- **Community verification (community)** — Champions-specific corrections submitted by players with in-game evidence (screenshots, video, cross-player confirmation).
- **In-game data mining (datamine)** — where available, direct extraction from game files takes precedence over all other sources.

---

## Legal

The data in this repository consists of factual game information — stat values, move parameters, type matchups — structured and formatted by the contributors to this project.

Pokemon is a trademark of Nintendo / Game Freak / The Pokemon Company International. This project is not affiliated with or endorsed by any of these companies.

Licensed under [Creative Commons Attribution 4.0 International (CC BY 4.0)](LICENSE). You are free to use, share, and adapt this data for any purpose, including commercial applications, as long as you give appropriate credit.

**Credit line:** `Pokemon Champions Data — github.com/pokemon-champions-data/pokemon-champions-data (CC BY 4.0)`

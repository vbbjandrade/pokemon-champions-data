# Pokemon Champions Data

> The first open, structured competitive dataset for Pokemon Champions.

[![License: CC BY 4.0](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/)
<!-- [![Characters](https://img.shields.io/badge/Characters-258-blue.svg)]() -->
[![Last Updated](https://img.shields.io/badge/Last%20Updated-Aug%202026-green.svg)]()

Pokemon Champions launched on April 8th, 2026. This repository is the definitive data source for competitive play: every character's base stats, complete move and ability pool, the full item list, and detailed documentation of game mechanics unique to Champions — including the SP stat distribution system that replaces the traditional EV framework.

Data is drawn from Showdown's open-source files and continuously refined by community verification. If you are building a team builder, a damage calculator, a tier list tool, or anything else for the Champions competitive scene, this is where you start.

---

## What's Inside

|   Directory   |                     Contents                     |
|---------------|--------------------------------------------------|
| `pokemon/`    | Roster, base stats, types, abilitiesm learnsets  |
| `moves/`      | Move database (type, power, category, effects)   |
| `abilities/`  | Ability descriptions and effect data             |
| `items/`      | Item effects and competitive usage notes         |
| `natures/`    | Nature stat modifiers                            |
| `type-chart/` | 18x18 type effectiveness matrix                  |
| `meta/`       | Version info and data sources                    |
| `mechanics/`  | Game formula documentation and system guides     |

The playable characters include base forms, mega evolutions, and regional variants. Every form with distinct stats is represented as a separate entry.

---

## Quick Start

### curl

Fetch the full roster directly from the raw GitHub URL:

```bash
curl https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/main/pokemon/roster.json
```

Fetch a single character's base stats:

```bash
curl https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/main/pokemon/base-stats.json \
  | python3 -c "import sys, json; data = json.load(sys.stdin); print(json.dumps(data['charizard'], indent=2))"
```

### JavaScript

```js
// Fetch and filter to Fire-type characters
const roster = await fetch(
  'https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/main/pokemon/roster.json'
).then(r => r.json());

const fireTypes = roster.filter(p => p.types.includes('Fire'));
console.log(`Fire-type characters: ${fireTypes.length}`);
```

```js
// Load roster and find the fastest characters
const roster = await fetch(
  'https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/main/pokemon/roster.json'
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
    base = "https://raw.githubusercontent.com/pokemon-champions-data/pokemon-champions-data/main"
    with urllib.request.urlopen(f"{base}/{path}") as r:
        return json.load(r)

roster    = fetch("pokemon/roster.json")
learnsets = fetch("pokemon/learnsets.json")
moves     = fetch("moves/moves.json")

# Find all moves Charizard can learn
charizard_moves = learnsets.get("Charizard", [])
print([m["move"] for m in charizard_moves])
```

---

## Data Format Examples

### `pokemon/roster.json` — a single entry

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
  "source": "smogon/pokemon-showdown",
  "verified": true
}
```

### `moves/moves.json` — a single move entry
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

Full documentation is in [`mechanics/sp-system.md`](mechanics/sp-system.md). Stat calculation details, including the SP-to-stat mapping, are in [`mechanics/stat-formula.md`](mechanics/stat-formula.md).

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full guide.

The base data comes from Showdown's open-source files, which are accurate for the main series games. Pokemon Champions may have modified learnsets, stat values, ability assignments, and mega evolution parameters. Community verification of Champions-specific differences is the highest-priority contribution this project needs right now.

If you have found an error — wrong stats, a move a character cannot actually learn, an ability that does not match the in game behavior — please file an issue using the [data correction template](.github/ISSUE_TEMPLATE/data-correction.yml).

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

---

## Tournament Calendar

| Event | Location | Date |
|-------|----------|------|
| Indianapolis Regionals | Indianapolis, IN, USA | May 29, 2026 |
| Turin Regional | Turin, Italy | June 6-7, 2026 |
| North American International Championship (NAIC) | TBD | June 12-14, 2026 |
| World Championships | TBD | August 28-30, 2026 |

Tournament result data will be added to this repository as events conclude. If you have information about additional tournaments, open an issue or submit a pull request to `meta/tournaments.json`.

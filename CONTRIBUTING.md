# Contributing to Pokemon Champions Data

Thank you for helping build and maintain the premier competitive data resource for Pokémon Champions. Because Champions is a live-service competitive game with unique balance adjustments, custom mechanics, and distinct regulation formats, community verification is essential. Every verified learnset, stat correction, or move update directly benefits the community's team builders, calculators, and tournament tools.

---

## Table of Contents

1. [Reporting Data Discrepancies](#reporting-data-discrepancies)
2. [Champions-Specific Divergences](#champions-specific-divergences)
3. [Editing Regulation Deltas (delta.json)](#editing-regulation-deltas-deltajson)
4. [Pull Request Workflow](#pull-request-workflow)
5. [Data Standards](#data-standards)
6. [Code of Conduct](#code-of-conduct)

---

## Reporting Data Discrepancies

If you spot incorrect data (such as wrong stats, unverified moves, or inaccurate descriptions), please file an issue using the [Data Discrepancy Report template](.github/ISSUE_TEMPLATE/data-correction.yml).

To ensure reports can be quickly verified and merged into the appropriate delta files, each report should include:

1. **Target Regulation**: Which regulation format this discrepancy applies to (e.g. `Reg M-C`, `Reg M-B`, or `Baseline Game Mechanics`).
2. **Resource Category**: One of our six core data domains:
   - `moves`: Base power, PP, accuracy, priority, flags, descriptions.
   - `roster`: Base stats, typings, ability slots, form attributes, weight.
   - `learnsets`: Verified move pool additions or removals.
   - `abilities`: Effects, flags, or activation conditions.
   - `items`: Competitive effects, battle items, mega stones, legality.
   - `mechanics`: SP allocation system, stat formulas, damage formulas.
3. **Identifier / Key**: The exact identifier in the dataset (e.g. `courtchange`, `charizard`, `goodasgold`, `covertcloak`).
4. **Affected Field**: The exact property name (e.g. `power`, `pp`, `baseStats.spe`, `flags.contact`).
5. **Current vs. Correct Value**: What the dataset currently has versus what the game displays.
6. **In-game Verification Evidence**: Clear proof from the game (screenshot, video clip, or combat calculation test). Reports without verifiable evidence cannot be merged.

---

## Champions-Specific Divergences

Baseline data is drawn from Pokémon Showdown's open-source files and adapted for Pokémon Champions. Champions introduces several game-wide differences from mainline titles:

### Learnsets
Some Pokémon learn moves in Champions that were unavailable in prior main-series generations, and vice versa. When reporting a learnset discrepancy, verify the move in the in-game move reminder screen or TM compatibility list.

### Base Stats & Mega Evolutions
Champions features custom balance adjustments for certain species and exclusive Mega Evolution forms. If you notice a stat difference in-game, provide a screenshot of the Pokémon summary screen displaying its nature and stats.

### Move Attributes & Balance Patches
Many moves feature Champions-specific balance updates (e.g. altered Base Power, modified PP, or adjusted secondary effect chances). When reporting move discrepancies, consult the move detail screen or verify battle logs.

### The SP System
Champions replaces EVs with the **SP (Stat Points)** system (66 total SP, max 32 per stat). Formula documentation and alignments are maintained in [`data/mechanics/`](data/mechanics/).

---

## Editing Regulation Deltas (delta.json)

Manual balance adjustments, legal rosters, and regulation-specific patches are stored in `data/regulations/<regulation>/delta.json`. When making changes, keep in mind how our build engine processes overrides:

> **`baseStats` is the sole nested merge field; all other properties replace wholesale.**

### Override Behavior Cheatsheet

| Target Property | Behavior | How to specify in `delta.json` |
| :--- | :--- | :--- |
| `baseStats` | **Partial Merge** | Specify **only** the modified stat(s) (e.g. `{"spe": 105}`). Unmentioned stats remain inherited from base. |
| Scalar fields (`power`, `pp`, `accuracy`, `priority`, `desc`, etc.) | **Field Replacement** | Specify **only** the changed field (e.g. `{"pp": 12}`). |
| `flags` (move, ability, item) | **Object Replacement** | **Redeclare all** active flags. Providing an override object replaces the entire inherited flags object. |
| `abilities` (roster entry) | **Object Replacement** | **Redeclare all** active ability slots (`"0"`, `"1"`, `"H"`). |
| `types` (roster entry) | **Array Replacement** | **Redeclare all** types in the array (e.g. `["Grass", "Dragon"]`). |
| `sources` | **Array Merge** | Merges and deduplicates with inherited sources automatically. |

### Real-Time IDE Autocompletion & Error Detection

All delta files are bound to the repository schema at `schemas/delta.schema.json`:
- In VS Code and Antigravity IDE, typing quotes `"` inside an override object provides **instant autocompletion** for valid properties.
- Any misspelled property name, invalid flag, or incorrect type immediately displays a **red squiggly line** with diagnostic explanations.
- Hovering over fields displays built-in documentation and merge instructions directly in your editor.

---

## Pull Request Workflow

For larger contributions or direct data fixes, pull requests are welcome.

**Rule: One logical correction per PR.** Avoid bundling multiple unrelated fixes into a single PR so they can be independently reviewed.

### Steps

1. Fork and clone the repository.
2. Create a feature branch:
   ```bash
   git checkout -b fix/courtchange-pp
   ```
3. Edit the relevant regulation delta (`data/regulations/<regulation>/delta.json`) or mechanics file (`data/mechanics/`).
4. Validate your changes locally:
   ```bash
   bun run typecheck
   bun run generate
   ```
5. Commit your changes using conventional commit formatting:
   ```bash
   git commit -m "fix(moves): courtchange PP is 12 in Reg M-C"
   ```
6. Open a pull request against `main`.

### Commit Message Format

```text
fix(moves): courtchange PP is 12 in Reg M-C

Court Change has 12 PP in Pokemon Champions. Verified via in-game
move summary screen. Closes #42.
```

Allowed categories: `moves`, `roster`, `learnsets`, `abilities`, `items`, `mechanics`.

### Pull Request Checklist

- [ ] `bun run typecheck` passes with zero errors.
- [ ] `bun run generate` compiles without issues.
- [ ] In-game verification evidence is linked in the PR description.
- [ ] No unrelated files or unintended formatting changes included.

---

## Data Standards

- **Formatting**: 2-space indentation, UTF-8 encoding, no trailing commas.
- **Identifiers**: Identifiers in keys must use Showdown-style lowercase alphanumeric strings (`courtchange`, `charizard`, `dragapult`).
- **Display Names**: Capitalization and punctuation in `name` fields must match the in-game display exactly (`"Court Change"`, `"Double-Edge"`, `"Mega Charizard X"`).
- **Numeric values**: Use integers for power, PP, and priority. Use `null` when a value is not applicable (e.g. `power: null` for status moves, not `power: 0`).

---

## Code of Conduct

- Treat fellow contributors with respect.
- Always provide verifiable in-game evidence for data modifications.
- Speculation about unreleased or data-mined future content that is not active in the live game belongs in community forums, not in data pull requests.
- This repository tracks factual, structured game data. Tier lists, usage commentary, and team builds belong in dedicated community platforms.

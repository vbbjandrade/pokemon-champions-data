# Contributing to Pokemon Champions Data

Thank you for helping build the first competitive data resource for Pokemon Champions. Since the game launched April 8, 2026 and competitive play is just beginning, community verification is essential. Every corrected learnset, fixed move description, or identified stat discrepancy makes this dataset more useful for every builder, analyst, and competitor.

---

## Table of Contents

1. [Reporting Data Errors](#reporting-data-errors)
2. [Champions-Specific Corrections](#champions-specific-corrections)
3. [Pull Request Format](#pull-request-format)
4. [Verification Priority](#verification-priority)
5. [Data Standards](#data-standards)
6. [Code of Conduct](#code-of-conduct)

---

## Reporting Data Errors

Use the GitHub Issues system. Select the **Data Correction** issue template, which prompts you for all required fields.

**Before filing:**

- Search open and closed issues to avoid duplicates.
- If an error has already been reported and is awaiting a fix, leave a comment on the existing issue to confirm the error rather than filing a new one.

**Every valid report must include:**

- The character name (exact, including form if applicable), move, ability, or item name
- The incorrect data as it currently appears in the repository
- The correct data as it should appear
- Your source: in-game screenshot, video timestamp, or confirmation from multiple players. "I think" or "I remember" is not sufficient evidence for data changes.

---

## Champions-Specific Corrections

The base data in this repository comes from Showdown's open-source files, cross-referenced against Gen 9 data where Champions-specific values were unavailable at launch. Champions is a new standalone game and it diverges from prior titles in several ways. The following categories are the most likely to contain errors.

### Learnsets

Some characters learn moves in Champions that they cannot learn in recent main-series games, and vice versa. When filing a learnset correction, include:

- The character name and form
- The move name
- The correct learn method: level number, TM/TR, or breed-only
- Whether the move appears in the in-game move reminder or only on level-up

**How to verify learnsets in-game:**

For level-up moves, navigate to the character's summary screen and open the move reminder section. Record every available move and the level listed. For TM/TR compatibility, sort your TM/TR bag by compatibility while the target character is selected and record which items are marked as usable. A screenshot of the full learnset list is the gold standard evidence.

### Mega Evolution Stats

Champions includes Mega Evolution forms. Some Champions-exclusive Mega stats may differ from the Mega forms in prior games, or Champions may include Mega Evolutions for characters that never had them in the main series. If you have verified a Mega form's base stats in-game, submit a correction with a screenshot clearly showing all six stat values.

### Ability Assignments

A character's ability slots may differ from their assignments in prior games. If a character's available abilities do not match what `pokemon/roster.json` lists, file a correction with your in-game verification.

### Move Effects

Some moves may have Champions-specific behavior (different power, accuracy, PP, or effect) compared to prior games. When filing a move correction, specify the exact field that is wrong and how you measured it (damage calculator test, move description screen, observed behavior in battle).

---

## Pull Request Format

For small corrections (a single wrong value), filing an issue is preferred so the correction can be reviewed before merging. For larger contributions — verifying an entire character's learnset, adding a missing form — a pull request is welcome.

**One correction per PR.** Do not bundle multiple unrelated fixes into a single pull request.

### Steps

1. Fork the repository
2. Create a branch: `git checkout -b fix/venusaur-learnset`
3. Edit the relevant JSON file
4. Validate that your JSON is well-formed: `python3 -m json.tool path/to/file.json`
5. Commit with a descriptive message (see format below)
6. Open a pull request against `main`

### Commit message format

```
fix(learnsets): Venusaur cannot learn Hyper Voice in Champions

Removed Hyper Voice from Venusaur's learnset. Verified via in-game
move reminder screen. Source: screenshot attached to issue #42.
```

Prefix: `fix`, `add`, `update`, or `remove`. Category in parentheses: `learnsets`, `moves`, `abilities`, `items`, `pokemon`, `type-chart`, `natures`, `mechanics`.

### Pull request checklist

- [ ] JSON is valid (`python3 -m json.tool` passes)
- [ ] Format and indentation match existing records
- [ ] No unrelated changes included
- [ ] Evidence linked (screenshot, video, or issue number)

---

## Verification Priority

Community effort should focus on the areas most likely to differ from our source data, in this order:

1. **Learnsets** — most likely to diverge from standard games. Every character's move availability in Champions should be verified independently.
2. **Mega Evolution stats** — Champions-exclusive Mega forms may have unique stat distributions not present in any prior dataset.
3. **Ability assignments** — ability slot assignments may differ for some characters.
4. **Move effects** — check for Champions-specific modifications to power, accuracy, PP, or behavior.

---

## Data Standards

**JSON formatting:**

- 2-space indentation
- UTF-8 encoding, no BOM
- No trailing commas
- String values for names exactly as they appear in-game (capitalization matters)
- `null` for missing optional values — do not use `""` or `0` as null substitutes

**Character names:** Use the name as displayed in the Champions game UI. For forms, use the full display name (e.g., `"Mega Charizard X"`).

**Move and ability names:** Match the exact in-game capitalization and hyphenation. `"Double-Edge"` not `"Double Edge"`.

**Types:** Capitalize the first letter only: `"Fire"`, `"Water"`, `"Dragon"`.

**Numeric values:** Use integers for values that are always whole numbers (power, PP, priority). Use `null` for fields that are not applicable — `power: null` for status moves, not `power: 0`.

---

## Code of Conduct

- Be respectful in issues and pull request discussions.
- Cite your sources. Corrections without verifiable evidence will not be merged.
- Do not submit data you have not personally verified or cannot point to a credible source for.
- Speculation about unreleased content or future updates is out of scope for this repository.

This repository tracks static game data only. Tier lists, set recommendations, and competitive analysis belong in community discussion spaces, not in issues or pull requests here.

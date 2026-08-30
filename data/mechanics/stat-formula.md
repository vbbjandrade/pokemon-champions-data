# Stat Formula

## Base Stats

Every character in Pokemon Champions has 6 base stats: HP, Attack, Defense, Special Attack, Special Defense, and Speed. These are fixed values that define the character's strengths and weaknesses. Base stats are identical to the values used in standard Pokemon games.

## SP (Stat Points) System

Champions replaces the traditional EV (Effort Value) system with SP:

- **66 total SP** to distribute across all six stats
- **Maximum 32 SP** per individual stat
- Minimum 0 SP per stat

See [sp-system.md](sp-system.md) for detailed strategy implications.

## Nature Modifiers

Each nature modifies two stats (one up, one down) by 10%:

- **Beneficial nature**: x1.1 to one stat
- **Hindering nature**: x0.9 to one stat
- **Neutral natures** (Hardy, Docile, Serious, Bashful, Quirky): no modification

## Stat Calculation

The formulas below are adapted from the standard Pokemon formula. The exact mapping from SP (0-32) to the formula's EV equivalent is still being community-verified.

**HP:**
```
floor((2 * Base + IV + floor(EV/4)) * Level / 100 + Level + 10)
```

**Other stats:**
```
floor(((2 * Base + IV + floor(EV/4)) * Level / 100 + 5) * NatureModifier)
```

Where:
- `Base` = the character's base stat value
- `IV` = Individual Value (0-31) — how IVs map to Champions is unverified
- `EV` = the SP equivalent — the conversion from SP (0-32) to the 0-252 EV scale is unverified
- `Level` = battle level (see below)
- `NatureModifier` = 1.1 (beneficial), 0.9 (hindering), or 1.0 (neutral)

## Battle Level

Champions competitive play uses **Level 50** for all ranked battles. At Level 50:

- Every 4 EVs in a stat equals +1 to that stat's final value
- Base stats have approximately 2x impact on the final value compared to EVs
- Nature modifiers affect the final stat, not the base

## Verification Status

The stat calculation mechanics are being actively verified by the community. The standard Pokemon formula is used as a baseline. If you have verified the exact SP-to-stat mapping in Champions, please submit a correction via the [data correction template](../.github/ISSUE_TEMPLATE/data-correction.yml).

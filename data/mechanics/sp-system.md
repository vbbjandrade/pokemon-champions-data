# The SP (Stat Points) System

Pokemon Champions replaces the traditional EV (Effort Value) system with a streamlined SP system that forces harder tradeoffs in competitive team building.

## Key Differences from EVs

| Feature | Traditional EVs | Champions SP |
|---------|----------------|-------------|
| Total points | 510 | 66 |
| Max per stat | 252 | 32 |
| Min per stat | 0 | 0 |
| Stats affected | 6 | 6 |
| Granularity at Lv50 | 4 EVs = +1 stat point | Under verification |

## What This Means for Teambuilding

### Tighter Budget

With 510 EVs, the standard approach is to max two stats (252/252) and dump the remainder (4 into a third stat). This gives two fully invested stats with minimal tradeoff.

With 66 SP, maxing two stats (32/32) uses 64 points, leaving only 2 SP for everything else. This forces meaningful decisions:

- **Bulky attacker**: 32 HP / 20 Atk / 14 Def — solid but not maxed anywhere
- **Glass cannon**: 32 Atk / 32 Spe / 2 HP — maximum offense, paper-thin bulk
- **Balanced tank**: 22 HP / 22 Def / 22 SpD — spread defense, nothing maxed

### Speed Tiers Are Compressed

Small SP differences matter more when the total pool is smaller. A character with 32 Speed SP vs 28 Speed SP has a meaningful gap. In the EV system, 252 vs 244 is often negligible.

This makes speed control more nuanced and creates more viable speed tiers.

### Every Point Matters

In the EV system, odd EV values at Level 50 are wasted (only multiples of 4 produce stat gains). The SP system's smaller scale means every point allocation is more likely to be meaningful.

## Common Spread Patterns

The meta is still developing. Some early patterns emerging:

- **Max/Max/Min**: 32/32/2 — traditional two-stat investment. Viable for sweepers.
- **Balanced Offense**: 20/24/22 — distributed investment for mixed attackers.
- **Defensive Core**: 32/0/17/0/17/0 — max HP with split defenses.
- **Speed Control**: Invest just enough Speed SP to outrun specific threats, save rest for bulk.

## Verification Status

The SP system is unique to Champions. The exact formula mapping SP values to stat points is being community-verified. The standard EV formula is used as a baseline assumption until confirmed.

If you have tested specific SP allocations and recorded the resulting stats in-game, please submit your findings via the [data correction template](../.github/ISSUE_TEMPLATE/data-correction.yml).

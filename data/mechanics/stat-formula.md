# Stat Formula

## Base Stats

Every character in Pokemon Champions has 6 base stats: HP, Attack, Defense, Special Attack, Special Defense, and Speed. These are fixed values that define the character's strengths and weaknesses. The base stat system is identical to the values used in standard Pokemon games and for the most part characters should keep similar values to their mainline game counterparts.

## SP (Stat Points) System

Champions replaces the traditional EV (Effort Value) system with SP:

- **66 total SP** to distribute across all six stats
- **Maximum 32 SP** per individual stat
- Minimum 0 SP per stat

See [sp-system.md](sp-system.md) for more details.

## Stat Alignments

Stat Alignments are the replacement (in name only) for the nature system in the mainline games. Each stat alignment modifies two stats (one up, one down) by 10%:

- **Beneficial nature**: x1.1 to one stat
- **Hindering nature**: x0.9 to one stat
- **Neutral nature**: x1.1 and x0.9 to the same stat - no modification

## Stat Calculation

$$ HP=Base+StatPoints+75 $$

$$ OtherStat=(Base+StatPoints+20) \times Alignment $$

where:
    Base is 
    Alignment is .
     

Where:
- `Base` = the species' base value for that stat.
- `Alignment` = 0.9 if the Pokémon's stat alignment lowers that stat, 1.1 if it raises that stat, and 1 otherwise
- `StatPoints` = is the amount of stat points the Pokémon has in the respective stat.

## Battle Level

Champions competitive play uses **Level 50** for all ranked battles. At Level 50:

- Every 4 EVs in a stat equals +1 to that stat's final value
- Base stats have approximately 2x impact on the final value compared to EVs
- Nature modifiers affect the final stat, not the base

## Sources

- [Stat point - Bulbapedia, the community-driven Pokémon encyclopedia](https://bulbapedia.bulbagarden.net/wiki/Stat_point)
- [Pokémon Damage Calculator (Champions mode)](https://calc.pokemonshowdown.com/champions.html?mode=champions)
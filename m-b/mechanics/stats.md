# Stat Formula

## Base Stats

Pokémon have six stats: `HP`, `Attack`, `Defense`, `Sp. Atk`, `Sp. Def`, and `Speed`.

> **HP**

This number tells you how much damage your Pokémon can withstand.

A Pokémon's HP will go down when it takes damage.
Once its HP reaches zero, the Pokémon will faint.

> **Attack**

This number gives you and idea of how much damage your Pokémon can deal when it uses a [physical move]().

The higher the number, the more damage your Pokémon's physical moves will deal to targets.

> **Defense**

This number gives you an idea of how much damage your Pokémon can mitigate when hit by a [physical move]().

The higher the number, the less damage your Pokémon will take from [physical moves]().

> **Special Attack**

This number gives you an idea of how much damage your Pokémon can deal when it uses a [special move]().

The higher the number, the more damage your Pokémon's special moves will deal to targets.

> **Special Defense**

This number gives you an idea of how much damage your Pokémon can mitigate when hit by a [special move]().

The higher the number, the less damage your Pokémon will take from [special moves]().

> **Speed**

This number gives you and idea of the order in which Pokémon will move in battle.

The Pokémon with the highest Speed stat will usually get to move first. If two Pokémon have the same Speed stat, then the order in which those Pokémon move will be random.

## SP (Stat Points) System

You can change your Pokémon's stats by redistributing their stat points via training.

Each stat can be given `32` stat points at most.

In total, `66` stat points are available to be distributed across all the stats of a single Pokémon.

## Stat Alignments

Stat alignments typically raise one stat and lower another.

The raised stat will be **increased by 10%**, while the lowered stat will be **decreased by 10%**.

Most alignments raise one stat and lower another, but not every alignment will have such an effect.

Currently, the only stat alignment that lies outside of this rule is the `Serious` alignment, which acts as a neutral alignment, not raising or lowering any stats.

<details>
	<summary><code>Relation to Natures</code></summary>

> Stat alignments are Champions' version of **Natures** from other Pokémon games.
> 
> In the nature system, beyond the `Serious` nature, there are 4 other neutral natures:
`Hardy`, `Docile`, `Bashful`, and `Quirky`.
> 
> When transferring Pokémon from the other games to Champions, all neutral natures will be converted to the `Serious` alignment.
</details>

## Stat Calculation

$$ HP=Base+StatPoints+75 $$

$$ OtherStat=(Base+StatPoints+20) \times Alignment $$

Where:
- `Base` = the species' base value for that stat.
- `Alignment` = 0.9 if the Pokémon's stat alignment lowers that stat, 1.1 if it raises that stat, and 1 otherwise
- `StatPoints` = is the amount of stat points the Pokémon has in the respective stat.

## In-battle calculations

### Stat Changes

A Pokémon's stats can be boosted or lowered during a battle by effects from sources such as moves, Abilities, and held items.
This is called a **stat change**.

When a Pokémon is switched out of battle, all of its stat changes are reset.

HP is the only stat that cannot be boosted or lowered by stat changes.

#### Stages
Stat changes are measured in stages ranging from -6 to +6.

The negative numbers indicate that a stat has been lowered, while the positive numbers indicate that it has been boosted. Each stage corresponds to a given multiplier that will modify the stat when it is used in battle calculations. The exact multipliers for each stage are detailed in the section below.

#### Stage multipliers
When a move is used that increases or decreases a stat of a Pokémon in battle, it will be multiplied according to the following fractions:

|            |   |   |   |   |   |   |   |   |   |   |   |   |   |
|------------|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stage      |-6 |-5 |-4 |-3 |-2 |-1 | 0 |+1 |+2 |+3 |+4 |+5 |+6 |
| Multiplier |2/8|2/7|2/6|2/5|2/4|2/3|2/2|3/2|4/2|5/2|6/2|7/2|8/2|

## Sources

- [Stat - Bulbapedia, the community-driven Pokémon encyclopedia](https://bulbapedia.bulbagarden.net/wiki/Stat)
- [Stat point - Bulbapedia, the community-driven Pokémon encyclopedia](https://bulbapedia.bulbagarden.net/wiki/Stat_point)
- [Stat modifier - Bulbapedia, the community-driven Pokémon encyclopedia](https://bulbapedia.bulbagarden.net/wiki/Stat_modifier)
- [Pokémon Damage Calculator (Champions mode)](https://calc.pokemonshowdown.com/champions.html?mode=champions)
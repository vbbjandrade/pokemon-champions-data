TODO: Document moves (https://bulbapedia.bulbagarden.net/wiki/Move)
TODO: Document damage calculation (https://bulbapedia.bulbagarden.net/wiki/Damage#Damage_calculation)
TODO: Structure accuracy, evasion and critical-hit ratio boost sections

Stat changes can affect more than just a Pokémon's stats, such as Attack and Defense. They can also affect a Pokémon's evasiveness, accuracy and critial-hit ratio.

When your Pokémon's evasiveness is lowered, it will have a harder time evading moves. When its evasiveness is boosted, it becomes more likely that your opponents' moves will miss.

When your Pokémon's accuracy is lowered, it will have a harder time hitting targets with its moves. When its accuracy is boosted, it is more likely to be able to hit targets with its moves.

<details>
	<summary>Stage multipliers for <code>Accuracy</code> and <code>Evasion</code></summary>

|                  |   |   |   |   |   |   |   |   |   |   |   |   |   |
|------------------|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stage (accuracy) |-6 |-5 |-4 |-3 |-2 |-1 | 0 |+1 |+2 |+3 |+4 |+5 |+6 |
| Stage (evasion)  |+6 |+5 |+4 |+3 |+2 |+1 | 0 |-1 |-2 |-3 |-4 |-5 |-6 |
| Multiplier       |3/9|3/8|3/7|3/6|3/5|3/4|3/3|4/3|5/3|6/3|7/3|8/3|9/3|

</details>
<br>

The stages of the accuracy and evasion stats are combined before determining the multiplier, with the evasion stage subtracted from the accuracy stage.

Additionally, the combined stages are capped at -6 and +6, meaning that a Pokémon with minimum accuracy attacking a target with maximum evasion will have no lower than a 3/9 chance to hit.

Champions names the stages of critical-hit ratio as "Critical-Hit Ratio Boost". The stages of critical-hit ratio boost are capped from 0 to +4.

<details>
	<summary>Stage multipliers for <code>Critical-Hit Ratio Boost</code></summary>

|                        |    |   |   |   |   |
|------------------------|----|---|---|---|---|
| Stage                  | 0  |+1 |+2 |+3 |+4 |
| Chance of critical hit |1/24|1/8|1/2|1/1|1/1|

</details>
<br>
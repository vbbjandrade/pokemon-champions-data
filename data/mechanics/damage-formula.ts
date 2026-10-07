/**
 * WebAssembly Damage Calculation Engine for Pokémon Champions
 * Built with AssemblyScript
 */

/** Fixed Pokémon rounding: Math.floor(val + 0.5) */
export function pokeRound(val: f64): i32 {
  return <i32>Math.floor(val + 0.5);
}

/** Chained integer modifier calculation (scaled by 4096) */
export function chainMods(mods: StaticArray<i32>): i32 {
  let mod: i32 = 4096;
  for (let i = 0; i < mods.length; i++) {
    const m = unchecked(mods[i]);
    mod = <i32>Math.floor(<f64>(mod * m + 2048) / 4096.0);
  }
  return mod;
}

/** Calculates Pokémon Champions HP stat based on data/mechanics/stats.md */
export function calculateHP(base: i32, sp: i32): i32 {
  return base + sp + 75;
}

/** Calculates Pokémon Champions non-HP stat based on data/mechanics/stats.md */
export function calculateStat(base: i32, sp: i32, alignment: f64, stage: i32): i32 {
  const rawStat = <f64>(base + sp + 20) * alignment;

  let stageMultiplier: f64 = 1.0;
  if (stage > 0) {
    stageMultiplier = <f64>(2 + stage) / 2.0;
  } else if (stage < 0) {
    stageMultiplier = 2.0 / <f64>(2 - stage);
  }

  const statWithStage = rawStat * stageMultiplier;
  return <i32>Math.max(1, pokeRound(statWithStage));
}

/** Standard Pokémon level 50 core base damage calculation */
export function getBaseDamage(level: i32, basePower: i32, attack: i32, defense: i32): i32 {
  const levelFactor = <i32>Math.floor((2.0 * <f64>level) / 5.0 + 2.0);
  const step1 = <i32>Math.floor((<f64>(levelFactor * basePower * attack)) / <f64>defense);
  const step2 = <i32>Math.floor(<f64>step1 / 50.0);
  return step2 + 2;
}

/** Calculates base damage prior to random roll variance */
export function calculateBaseDamageChampions(
  level: i32,
  basePower: i32,
  attack: i32,
  defense: i32,
  isSpread: boolean,
  isParentalBondChild: boolean,
  weatherMod: i32,
  isCritical: boolean
): i32 {
  let baseDamage = getBaseDamage(level, basePower, attack, defense);

  if (isSpread) {
    baseDamage = pokeRound((<f64>(baseDamage * 3072)) / 4096.0);
  }

  if (isParentalBondChild) {
    baseDamage = pokeRound((<f64>(baseDamage * 1024)) / 4096.0);
  }

  if (weatherMod != 4096 && weatherMod > 0) {
    baseDamage = pokeRound((<f64>(baseDamage * weatherMod)) / 4096.0);
  }

  if (isCritical) {
    baseDamage = <i32>Math.floor(<f64>baseDamage * 1.5);
  }

  return baseDamage;
}

/**
 * Calculates the 16 random damage rolls (85% to 100%) for Pokémon Champions
 */
export function calculateDamageRolls(
  level: i32,
  basePower: i32,
  attack: i32,
  defense: i32,
  typeEffectiveness: f64,
  stabMod: i32,
  applyBurn: boolean,
  finalMod: i32,
  isProtected: boolean,
  isSpread: boolean,
  isParentalBondChild: boolean,
  weatherMod: i32,
  isCritical: boolean
): StaticArray<i32> {
  const rolls = new StaticArray<i32>(16);

  if (typeEffectiveness <= 0.0 || basePower <= 0 || attack <= 0 || defense <= 0) {
    for (let i = 0; i < 16; i++) {
      unchecked((rolls[i] = 0));
    }
    return rolls;
  }

  const baseDamage = calculateBaseDamageChampions(
    level,
    basePower,
    attack,
    defense,
    isSpread,
    isParentalBondChild,
    weatherMod,
    isCritical
  );

  for (let i = 0; i < 16; i++) {
    const rollFactor = 85 + i;
    let d = <i32>Math.floor((<f64>(baseDamage * rollFactor)) / 100.0);
    d = pokeRound((<f64>(d * stabMod)) / 4096.0);
    d = <i32>Math.floor(<f64>d * typeEffectiveness);

    if (applyBurn) {
      d = <i32>Math.floor(<f64>d / 2.0);
    }

    d = pokeRound((<f64>(d * finalMod)) / 4096.0);

    if (isProtected) {
      d = pokeRound((<f64>(d * 1024)) / 4096.0);
    }

    if (typeEffectiveness > 0.0) {
      d = <i32>Math.max(1, d);
    }

    unchecked((rolls[i] = d));
  }

  return rolls;
}

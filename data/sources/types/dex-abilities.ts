/**
 * AUTO-GENERATED — DO NOT EDIT MANUALLY
 * Synced from: https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/dex-abilities.ts
 * Synced at:   Sun, 30 Aug 2026 07:38:05 UTC
 * Branch:      master
 *
 * Runtime-only Showdown types (Battle, Pokemon, Side, etc.) and all import
 * statements have been removed. Stub types are provided where needed to keep
 * the interfaces we care about self-contained and importable without the full Showdown codebase.
 *
 * Use `bash scripts/sync_showdown_types.sh` to re-sync.
 */

// ---------------------------------------------------------------------------
// Stub types — replace complex Showdown runtime types with 'any' so the
// interfaces below remain importable without the rest of the codebase.
// ---------------------------------------------------------------------------
type SparseBoostsTable = Partial<Record<string, number>>;
type IDEntry = string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ID = string;
type StatIDExceptHP = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
// EffectData must be compatible with MoveEventMethods (both allow any values)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EffectData = Record<string, any>;
type ConditionData = Record<string, unknown>;
type ModdedConditionData = Record<string, unknown>;
type ModdedEffectText = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BasicEffect = Record<string, any>;
type Ability = {
  flags?: Record<string, 1 | undefined>;
  suppressWeather?: boolean;
};
type Item = {
  fling?: { basePower: number; status?: string; volatileStatus?: string };
  isBerry?: boolean;
  isChoice?: boolean;
  isGem?: boolean;
  isPokeball?: boolean;
  isPrimalOrb?: boolean;
  ignoreKlutz?: boolean;
  megaStone?: Record<string, string>;
  onDrive?: string;
  onMemory?: string;
  onPlate?: string;
  zMove?: true | string;
  zMoveType?: string;
  zMoveFrom?: string;
  itemUser?: string[];
  forcedForme?: string;
  naturalGift?: { basePower: number; type: string };
  boosts?: SparseBoostsTable;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type MoveEventMethods = Record<string, AnyFn | undefined>;
type AbilityEventMethods = Record<string, unknown>;
type PokemonEventMethods = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Battle = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pokemon = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Side = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Field = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonHandlers = Record<string, any>;

export interface AbilityFlags {
	breakable?: 1; // Can be suppressed by Mold Breaker and related effects
	cantsuppress?: 1; // Ability can't be suppressed by e.g. Gastro Acid or Neutralizing Gas
	failroleplay?: 1; // Role Play fails if target has this Ability
	failskillswap?: 1; // Skill Swap fails if either the user or target has this Ability
	noentrain?: 1; // Entrainment fails if user has this Ability
	noreceiver?: 1; // Receiver and Power of Alchemy will not activate if an ally faints with this Ability
	notrace?: 1; // Trace cannot copy this Ability
	notransform?: 1; // Disables the Ability if the user is Transformed
}

export interface AbilityData extends Partial<Ability>, AbilityEventMethods, PokemonEventMethods {
	name: string;
}

export type ModdedAbilityData = (AbilityData | Partial<AbilityData> & {
	inherit: true,
	condition?: ModdedConditionData,
}) & ModdedEffectText;
export interface AbilityDataTable { [abilityid: IDEntry]: AbilityData }
export interface ModdedAbilityDataTable { [abilityid: IDEntry]: ModdedAbilityData }

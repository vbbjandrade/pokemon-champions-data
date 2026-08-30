/**
 * AUTO-GENERATED — DO NOT EDIT MANUALLY
 * Synced from: https://raw.githubusercontent.com/smogon/pokemon-showdown/master/sim/dex-items.ts
 * Synced at:   Sun, 30 Aug 2026 16:40:38 UTC
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

export interface FlingData {
	basePower: number;
	status?: string;
	volatileStatus?: string;
	effect?: CommonHandlers['ResultMove'];
}

export interface ItemData extends Partial<Item>, PokemonEventMethods {
	name: string;
}

export type ModdedItemData = (ItemData | Partial<Omit<ItemData, 'name'>> & {
	inherit: true,
	onCustap?: (this: Battle, pokemon: Pokemon) => void,
	onWhiteHerb?: (this: Battle, pokemon: Pokemon) => void,
	condition?: ModdedConditionData,
}) & ModdedEffectText;

export interface ItemDataTable { [itemid: IDEntry]: ItemData }
export interface ModdedItemDataTable { [itemid: IDEntry]: ModdedItemData }

/**
 * Utility for parsing and transforming Showdown data structures into
 * pokemon-champions-data repository format.
 */

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spa: number;
  spd: number;
  spe: number;
}

export interface RepoPokemon {
  dexNumber: number;
  name: string;
  types: string[];
  form: string | null;
  abilities: Record<string, string> | null;
  weightKg: number;
  requiredItem: string | null;
  requiredMove: string | null;
  canEvolve: boolean;
  genders: string[];
  baseStats: BaseStats | null;
  source?: string;
  verified?: boolean;
}

export interface RepoLearnset {
  dexNumber: number;
  form: string | null;
  moves: string[];
  source?: string;
  verified?: boolean;
}

import type {
  AbilityFlags as ShowdownAbilityFlags,
} from '../data/sources/types/dex-abilities.ts';
import type {
  FlingData as ShowdownFlingData,
  ItemData as ShowdownItemData,
} from '../data/sources/types/dex-items.ts';
import type {
  MoveData as ShowdownMoveData,
  MoveFlags as ShowdownMoveFlags,
} from '../data/sources/types/dex-moves.ts';

export type StatName = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'accuracy' | 'evasion';

export interface RecoilEffect {
  percentage: number;
  id: string;
}

export interface ZMoveData {
  basePower?: number;
  effect?: string;
  boost?: Partial<Record<StatName, number>>;
}

export interface MaxMoveData {
  basePower: number;
}

/** Standard Showdown flags with excluded and overridden keys omitted */
export type CleanedShowdownFlags = Omit<
  ShowdownMoveFlags,
  'allyanim' | 'mustpressure' | 'nonsky' | 'distance' | 'heal'
>;

export interface MoveFlags extends CleanedShowdownFlags, Record<string, any> {
  // Overridden / enriched Showdown flags
  heal?: [number, number] | 1;

  // Stat alterations
  raisesTarget?: Partial<Record<StatName, number>>;
  lowersTarget?: Partial<Record<StatName, number>>;
  raisesUser?: Partial<Record<StatName, number>>;
  lowersUser?: Partial<Record<StatName, number>>;

  // Status and conditions
  status?: string[];
  volatileStatus?: string[];
  selfVolatileStatus?: string[];
  sideCondition?: string[];
  field?: string[];

  // Hit effects & battle mechanics (inferred from Showdown MoveData)
  ohko?: ShowdownMoveData['ohko'];
  thawsTarget?: true;
  forceSwitch?: true;
  selfSwitch?: ShowdownMoveData['selfSwitch'];
  selfdestruct?: ShowdownMoveData['selfdestruct'];
  breaksProtect?: true;
  recoil?: [number, number] | RecoilEffect;
  drain?: [number, number];
  stealsBoosts?: true;
  hasCrashDamage?: true;
  stallingMove?: true;

  // Hit effect modifiers (inferred from Showdown MoveData)
  critRatio?: number;
  multihit?: ShowdownMoveData['multihit'];
  damage?: number | 'level';
  overrideOffensiveStat?: StatName;
  overrideOffensivePokemon?: ShowdownMoveData['overrideOffensivePokemon'];
  overrideDefensiveStat?: StatName;
  ignoreDefensive?: true;
  ignoreEvasion?: true;
  ignoreAbility?: true;
  ignoreImmunity?: ShowdownMoveData['ignoreImmunity'];
  callsMove?: true;
  sleepUsable?: true;
  smartTarget?: true;
  tracksTarget?: true;

  // Z-Move and Max Move data
  isZ?: ShowdownMoveData['isZ'];
  zMove?: ZMoveData;
  isMax?: ShowdownMoveData['isMax'];
  maxMove?: MaxMoveData;
}

export interface RepoMove {
  name: string;
  type: string;
  category: string;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  priority: number;
  target: string | null;
  desc: string | null;
  shortDesc: string | null;
  flags?: MoveFlags;
  source?: string;
  verified?: boolean;
}

/** Internal type used during parsing/merging; `isNonstandard` is stripped before output. */
export type ParsedMove = RepoMove & { isNonstandard: string | null };

/** Declarative ability properties preserved from the synced Showdown types. */
export type AbilityEffectFlags = ShowdownAbilityFlags & {
  suppressWeather?: true;
};

/** @deprecated Use AbilityEffectFlags. */
export type AbilityFlags = AbilityEffectFlags;

export interface RepoAbility {
  name: string;
  desc: string | null;
  shortDesc: string | null;
  flags?: AbilityFlags;
  source?: string;
  verified?: boolean;
}

/** Declarative item properties preserved from the synced Showdown types. */
export type ItemEffectFlags = Omit<Pick<
  ShowdownItemData,
  | 'fling'
  | 'megaStone'
  | 'onDrive'
  | 'onMemory'
  | 'onPlate'
  | 'zMove'
  | 'zMoveType'
  | 'zMoveFrom'
  | 'itemUser'
  | 'forcedForme'
  | 'naturalGift'
  | 'boosts'
>, 'fling' | 'boosts'> & {
  fling?: ShowdownFlingData;
  isBerry?: true;
  isChoice?: true;
  isGem?: true;
  isPokeball?: true;
  isPrimalOrb?: true;
  ignoreKlutz?: true;
  megaStone?: Record<string, string>;
  onDrive?: string;
  onMemory?: string;
  onPlate?: string;
  zMove?: true | string;
  zMoveType?: string;
  zMoveFrom?: string;
  itemUser?: string[];
  forcedForme?: string;
  boosts?: Partial<Record<StatName, number>>;
};

/** @deprecated Use ItemEffectFlags. */
export type ItemFlags = ItemEffectFlags;

export interface RepoItem {
  name: string;
  desc: string | null;
  shortDesc: string | null;
  flags?: ItemFlags;
  isNonstandard?: string | null;
  source?: string;
  verified?: boolean;
}

export interface VersionInfo {
  version: string;
  lastUpdated: string;
  gameVersion: string;
  dataFormat: string;
  sources: string[];
  verification?: Record<string, any>;
  counts: {
    pokemon: number;
    moves?: number;
    movesInChampions?: number;
    movesTotal?: number;
    abilities: number;
    items: number;
    natures: number;
    types: number;
    [key: string]: any;
  };
  regulation: string;
  [key: string]: any;
}

export const SHOWDOWN_SOURCE = 'smogon/pokemon-showdown';

/**
 * Normalizes a string to a Showdown-style identifier (lowercase alphanumeric).
 */
export function toID(text: string): string {
  return text ? text.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

const REGIONAL_PREFIXES: Record<string, string> = {
  Alola: 'Alolan',
  Galar: 'Galarian',
  Hisui: 'Hisuian',
  Paldea: 'Paldean',
};

const FORM_SUFFIXES = new Set([
  'Heat', 'Wash', 'Frost', 'Fan', 'Mow', // Rotom forms
  'Midnight', 'Dusk',                    // Lycanroc forms
  'Small', 'Large', 'Super',             // Size-based forms (e.g. Gourgeist)
  'F',                                   // Gender-based forms (e.g. Basculegion, Indeedee)
  'Blaze', 'Aqua',                       // Paldean Tauros breeds
]);

/**
 * Converts a Showdown species name into standard repository display format.
 */
export function toRepoName(sdName: string): string {
  const megaXyzMatch = sdName.match(/^(.+)-Mega-([XYZ])$/);
  if (megaXyzMatch && megaXyzMatch[1] && megaXyzMatch[2]) {
    return `Mega ${megaXyzMatch[1]} ${megaXyzMatch[2]}`;
  }
  const megaMatch = sdName.match(/^(.+)-Mega$/);
  if (megaMatch && megaMatch[1]) {
    return `Mega ${megaMatch[1]}`;
  }
  const gmaxMatch = sdName.match(/^(.+)-Gmax$/);
  if (gmaxMatch && gmaxMatch[1]) {
    return `Gmax ${gmaxMatch[1]}`;
  }
  for (const [suffix, prefix] of Object.entries(REGIONAL_PREFIXES)) {
    if (sdName.endsWith(`-${suffix}`)) {
      return `${prefix} ${sdName.slice(0, -suffix.length - 1)}`;
    }
  }
  return sdName;
}

/**
 * Determines the category form for ordering or classification.
 */
export function repoForm(sdName: string): string {
  if (/-Mega(-[XYZ])?$/.test(sdName)) {
    return 'Mega';
  }
  for (const suffix of Object.keys(REGIONAL_PREFIXES)) {
    if (sdName.endsWith(`-${suffix}`)) {
      return 'Regional';
    }
  }
  const parts = sdName.split('-');
  const suffix = parts[parts.length - 1];
  if (suffix && FORM_SUFFIXES.has(suffix)) {
    return suffix;
  }
  return 'Base';
}

/**
 * Extracts possible genders from Showdown pokedex entry.
 */
export function parseGenders(entry: { gender?: string; genderRatio?: Record<string, number> }): string[] {
  if (entry.gender) {
    return [entry.gender];
  }
  if (entry.genderRatio) {
    return Object.keys(entry.genderRatio);
  }
  return ['M', 'F'];
}

/**
 * Parses and formats baseStats object.
 */
export function parseBaseStats(stats?: Record<string, number>): BaseStats | null {
  if (!stats) return null;
  const statKeys: (keyof BaseStats)[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
  for (const key of statKeys) {
    if (typeof stats[key] !== 'number') {
      return null;
    }
  }
  return {
    hp: stats.hp!,
    atk: stats.atk!,
    def: stats.def!,
    spa: stats.spa!,
    spd: stats.spd!,
    spe: stats.spe!,
  };
}

/**
 * Extracts legal species IDs from Showdown formats data (entries without isNonstandard).
 */
export function parseLegalSpecies(formatsData: Record<string, { isNonstandard?: string; tier?: string }>): Set<string> {
  const legal = new Set<string>();
  for (const [key, entry] of Object.entries(formatsData)) {
    if (!entry.isNonstandard) {
      legal.add(key);
    }
  }
  return legal;
}

/**
 * Resolves ability names to their Showdown ability IDs (keys in abilities-main.ts).
 */
export function mapAbilitiesToIds(
  abilities: Record<string, string> | undefined,
  nameToIdMap?: Map<string, string>
): Record<string, string> | null {
  if (!abilities || Object.keys(abilities).length === 0) return null;
  const out: Record<string, string> = {};
  for (const [slot, name] of Object.entries(abilities)) {
    if (!name) continue;
    const resolvedId = nameToIdMap?.get(name) ?? toID(name);
    out[slot] = resolvedId;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Extracts desc and shortDesc checking for Champions-specific overrides first.
 */
export function extractTextOverrides(textEntry?: any): { desc: string | null; shortDesc: string | null } {
  if (!textEntry) {
    return { desc: null, shortDesc: null };
  }
  const champ = textEntry.champions;
  const desc = champ?.desc ?? textEntry.desc ?? null;
  const shortDesc = champ?.shortDesc ?? textEntry.shortDesc ?? null;
  return { desc, shortDesc };
}

/**
 * Parses Pokedex entries into repository Pokemon structures.
 */
export function parsePokedex(
  rawPokedex: Record<string, any>,
  options?: {
    nameToIdMap?: Map<string, string>;
    aliases?: Record<string, string>;
  }
): Record<string, RepoPokemon> {
  const pokedex: Record<string, RepoPokemon> = {};
  const nameToKey: Record<string, string> = {};

  for (const [key, entry] of Object.entries(rawPokedex)) {
    if (entry.name) {
      nameToKey[entry.name] = key;
    }

    const repoName = options?.aliases?.[key] ?? toRepoName(entry.name ?? key);
    const abilities = mapAbilitiesToIds(entry.abilities, options?.nameToIdMap);

    pokedex[key] = {
      dexNumber: Number(entry.num ?? 0),
      name: repoName,
      types: Array.isArray(entry.types) ? [...entry.types] : [],
      form: entry.forme ?? null,
      abilities,
      weightKg: Number(entry.weightkg ?? 0),
      requiredItem: entry.requiredItem ?? null,
      requiredMove: entry.requiredMove ?? null,
      canEvolve: Boolean(entry.evos && entry.evos.length > 0),
      genders: parseGenders(entry),
      baseStats: parseBaseStats(entry.baseStats),
    };
  }

  // Second pass: resolve Gigantamax requiredMove from base species canGigantamax
  for (const [key, entry] of Object.entries(rawPokedex)) {
    const mon = pokedex[key];
    if (mon && !mon.requiredMove && mon.form === 'Gmax') {
      const baseSpeciesName = entry.baseSpecies;
      if (baseSpeciesName && nameToKey[baseSpeciesName]) {
        const baseKey = nameToKey[baseSpeciesName];
        const baseRaw = rawPokedex[baseKey!];
        if (baseRaw?.canGigantamax) {
          mon.requiredMove = baseRaw.canGigantamax;
        }
      }
    }
  }

  return pokedex;
}

/**
 * Extracts move IDs from learnsets data.
 */
export function parseLearnsets(rawLearnsets: Record<string, { learnset?: Record<string, any> }>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [key, data] of Object.entries(rawLearnsets)) {
    if (data?.learnset) {
      out[key] = Object.keys(data.learnset);
    }
  }
  return out;
}

const IGNORED_FLAGS = new Set(['allyanim', 'mustpressure', 'nonsky', 'distance']);

/**
 * Extracts searchable effect tags and standard flags from a raw Showdown move definition.
 */
export function extractMoveFlags(
  m: Record<string, any>,
  id?: string,
  onCallbackWarning?: (msg: string) => void
): MoveFlags {
  const flags: MoveFlags = {};

  if (m.flags) {
    for (const [k, v] of Object.entries(m.flags)) {
      if (!IGNORED_FLAGS.has(k) && v) {
        flags[k] = v;
      }
    }
  }

  // Status
  const statuses = new Set<string>();
  if (typeof m.status === 'string') statuses.add(m.status.toLowerCase());
  if (typeof m.secondary?.status === 'string') statuses.add(m.secondary.status.toLowerCase());
  if (Array.isArray(m.secondaries)) {
    for (const sec of m.secondaries) {
      if (typeof sec?.status === 'string') statuses.add(sec.status.toLowerCase());
    }
  }
  if (statuses.size > 0) {
    flags.status = Array.from(statuses).sort();
  }

  // Volatile status
  const targetVolatiles = new Set<string>();
  const userVolatiles = new Set<string>();

  if (typeof m.volatileStatus === 'string') {
    if (m.target === 'self') {
      userVolatiles.add(m.volatileStatus.toLowerCase());
    } else {
      targetVolatiles.add(m.volatileStatus.toLowerCase());
    }
  }
  if (typeof m.secondary?.volatileStatus === 'string') {
    targetVolatiles.add(m.secondary.volatileStatus.toLowerCase());
  }
  if (typeof m.self?.volatileStatus === 'string') {
    userVolatiles.add(m.self.volatileStatus.toLowerCase());
  }
  if (typeof m.secondary?.self?.volatileStatus === 'string') {
    userVolatiles.add(m.secondary.self.volatileStatus.toLowerCase());
  }
  if (Array.isArray(m.secondaries)) {
    for (const sec of m.secondaries) {
      if (typeof sec?.volatileStatus === 'string') {
        targetVolatiles.add(sec.volatileStatus.toLowerCase());
      }
      if (typeof sec?.self?.volatileStatus === 'string') {
        userVolatiles.add(sec.self.volatileStatus.toLowerCase());
      }
    }
  }

  if (targetVolatiles.size > 0) {
    flags.volatileStatus = Array.from(targetVolatiles).sort();
  }
  if (userVolatiles.size > 0) {
    flags.selfVolatileStatus = Array.from(userVolatiles).sort();
  }

  // Side condition
  const sideConditions = new Set<string>();
  if (typeof m.sideCondition === 'string') sideConditions.add(m.sideCondition.toLowerCase());
  if (typeof m.self?.sideCondition === 'string') sideConditions.add(m.self.sideCondition.toLowerCase());
  if (typeof m.secondary?.self?.sideCondition === 'string') sideConditions.add(m.secondary.self.sideCondition.toLowerCase());
  if (Array.isArray(m.secondaries)) {
    for (const sec of m.secondaries) {
      if (typeof sec?.sideCondition === 'string') sideConditions.add(sec.sideCondition.toLowerCase());
      if (typeof sec?.self?.sideCondition === 'string') sideConditions.add(sec.self.sideCondition.toLowerCase());
    }
  }
  if (sideConditions.size > 0) {
    flags.sideCondition = Array.from(sideConditions).sort();
  }

  // Field (terrain, weather, pseudoWeather)
  const fields = new Set<string>();
  if (typeof m.terrain === 'string') fields.add(m.terrain.toLowerCase());
  if (typeof m.weather === 'string') fields.add(m.weather.toLowerCase());
  if (typeof m.pseudoWeather === 'string') fields.add(m.pseudoWeather.toLowerCase());
  if (fields.size > 0) {
    flags.field = Array.from(fields).sort();
  }

  // Boosts
  const raisesTarget: Partial<Record<StatName, number>> = {};
  const lowersTarget: Partial<Record<StatName, number>> = {};
  const raisesUser: Partial<Record<StatName, number>> = {};
  const lowersUser: Partial<Record<StatName, number>> = {};

  function addBoosts(boosts: Record<string, number>, isUser: boolean) {
    for (const [stat, val] of Object.entries(boosts)) {
      if (typeof val !== 'number' || val === 0) continue;
      const s = stat as StatName;
      if (isUser) {
        if (val > 0) raisesUser[s] = val;
        else lowersUser[s] = Math.abs(val);
      } else {
        if (val > 0) raisesTarget[s] = val;
        else lowersTarget[s] = Math.abs(val);
      }
    }
  }

  if (m.boosts) {
    addBoosts(m.boosts, m.target === 'self');
  }
  if (m.selfBoost?.boosts) {
    addBoosts(m.selfBoost.boosts, true);
  }
  if (m.self?.boosts) {
    addBoosts(m.self.boosts, true);
  }
  if (m.secondary?.boosts) {
    addBoosts(m.secondary.boosts, false);
  }
  if (m.secondary?.self?.boosts) {
    addBoosts(m.secondary.self.boosts, true);
  }
  if (Array.isArray(m.secondaries)) {
    for (const sec of m.secondaries) {
      if (sec?.boosts) addBoosts(sec.boosts, false);
      if (sec?.self?.boosts) addBoosts(sec.self.boosts, true);
    }
  }

  if (Object.keys(raisesTarget).length > 0) flags.raisesTarget = raisesTarget;
  if (Object.keys(lowersTarget).length > 0) flags.lowersTarget = lowersTarget;
  if (Object.keys(raisesUser).length > 0) flags.raisesUser = raisesUser;
  if (Object.keys(lowersUser).length > 0) flags.lowersUser = lowersUser;

  // Hit effects & battle mechanics
  if (m.ohko !== undefined) flags.ohko = m.ohko;
  if (m.thawsTarget) flags.thawsTarget = true;
  if (Array.isArray(m.heal)) flags.heal = m.heal as [number, number];
  if (m.forceSwitch) flags.forceSwitch = true;
  if (m.selfSwitch !== undefined) flags.selfSwitch = m.selfSwitch;
  if (m.selfdestruct !== undefined) flags.selfdestruct = m.selfdestruct;
  if (m.breaksProtect) flags.breaksProtect = true;

  if (Array.isArray(m.recoil)) {
    flags.recoil = m.recoil as [number, number];
  } else if (m.mindBlownRecoil) {
    flags.recoil = { percentage: 50, id: 'mindBlown' };
  } else if (m.chloroblastRecoil) {
    flags.recoil = { percentage: 50, id: 'chloroblast' };
  } else if (m.struggleRecoil) {
    flags.recoil = { percentage: 25, id: 'struggle' };
  }

  if (Array.isArray(m.drain)) flags.drain = m.drain as [number, number];
  if (m.stealsBoosts) flags.stealsBoosts = true;
  if (m.hasCrashDamage) flags.hasCrashDamage = true;
  if (m.stallingMove) flags.stallingMove = true;

  // Hit effect modifiers
  if (typeof m.critRatio === 'number') {
    flags.critRatio = m.critRatio;
  } else if (m.willCrit) {
    flags.critRatio = 4;
  }

  if (m.multihit !== undefined) flags.multihit = m.multihit;
  if (m.damage !== undefined && m.damage !== false && m.damage !== null) flags.damage = m.damage;
  if (m.overrideOffensiveStat) flags.overrideOffensiveStat = m.overrideOffensiveStat;
  if (m.overrideOffensivePokemon) flags.overrideOffensivePokemon = m.overrideOffensivePokemon;
  if (m.overrideDefensiveStat) flags.overrideDefensiveStat = m.overrideDefensiveStat;
  if (m.ignoreDefensive) flags.ignoreDefensive = true;
  if (m.ignoreEvasion) flags.ignoreEvasion = true;
  if (m.ignoreAbility) flags.ignoreAbility = true;
  if (m.ignoreImmunity !== undefined) flags.ignoreImmunity = m.ignoreImmunity;
  if (m.callsMove) flags.callsMove = true;
  if (m.sleepUsable) flags.sleepUsable = true;
  if (m.smartTarget) flags.smartTarget = true;
  if (m.tracksTarget) flags.tracksTarget = true;

  // Z-Move and Max Move
  if (m.isZ !== undefined) flags.isZ = m.isZ;
  if (m.zMove !== undefined) flags.zMove = m.zMove;
  if (m.isMax !== undefined) flags.isMax = m.isMax;
  if (m.maxMove !== undefined) flags.maxMove = m.maxMove;

  // Check for callback-only moves
  if (id && onCallbackWarning) {
    const hasCallback = typeof m.onHit === 'function' ||
      typeof m.onAfterHit === 'function' ||
      typeof m.onAfterMove === 'function' ||
      typeof m.damageCallback === 'function' ||
      typeof m.basePowerCallback === 'function' ||
      typeof m.onTryHit === 'function';

    const hasExtractedEffect = flags.status ||
      flags.volatileStatus ||
      flags.selfVolatileStatus ||
      flags.sideCondition ||
      flags.field ||
      flags.raisesTarget ||
      flags.lowersTarget ||
      flags.raisesUser ||
      flags.lowersUser ||
      flags.drain ||
      flags.recoil ||
      flags.forceSwitch ||
      flags.selfSwitch ||
      flags.ohko ||
      flags.stealsBoosts ||
      flags.hasCrashDamage ||
      flags.damage ||
      flags.overrideOffensiveStat ||
      flags.overrideOffensivePokemon ||
      flags.overrideDefensiveStat ||
      flags.ignoreDefensive ||
      flags.ignoreEvasion ||
      flags.ignoreAbility ||
      flags.ignoreImmunity ||
      flags.callsMove;

    if (hasCallback && !hasExtractedEffect) {
      onCallbackWarning(`[CALLBACK-ONLY] ${id}: has callback handler but no declarative effect flags`);
    }
  }

  return flags;
}

/**
 * Normalizes main series moves from Showdown.
 */
export function parseMovesMain(
  rawMoves: Record<string, any>,
  textEntries?: Record<string, any>,
  onCallbackWarning?: (msg: string) => void
): Record<string, ParsedMove> {
  const out: Record<string, ParsedMove> = {};
  for (const [key, m] of Object.entries(rawMoves)) {
    if (m.isNonstandard === 'CAP') continue;
    const text = extractTextOverrides(textEntries?.[key]);
    const flags = extractMoveFlags(m, key, onCallbackWarning);
    out[key] = {
      name: m.name ?? '',
      type: m.type ?? '',
      category: m.category ?? '',
      power: typeof m.basePower === 'number' ? m.basePower : null,
      accuracy: typeof m.accuracy === 'number' ? m.accuracy : null,
      pp: typeof m.pp === 'number' ? m.pp : null,
      priority: typeof m.priority === 'number' ? m.priority : 0,
      target: m.target ?? null,
      desc: text.desc ?? m.desc ?? null,
      shortDesc: text.shortDesc ?? m.shortDesc ?? null,
      flags: Object.keys(flags).length > 0 ? flags : {},
      isNonstandard: m.isNonstandard ?? null,
    };
  }
  return out;
}

/**
 * Parses Champions move modifications and overrides.
 */
export function parseMoveMods(rawMods: Record<string, any>): Record<string, Partial<ParsedMove> & { inherit?: boolean }> {
  const out: Record<string, Partial<ParsedMove> & { inherit?: boolean }> = {};
  for (const [key, mod] of Object.entries(rawMods)) {
    const entry: Partial<ParsedMove> & { inherit?: boolean } = {
      inherit: mod.inherit === true,
    };
    if (mod.name !== undefined) entry.name = mod.name;
    if (mod.type !== undefined) entry.type = mod.type;
    if (mod.category !== undefined) entry.category = mod.category;
    if (mod.basePower !== undefined) entry.power = typeof mod.basePower === 'number' ? mod.basePower : null;
    if (mod.accuracy !== undefined) entry.accuracy = typeof mod.accuracy === 'number' ? mod.accuracy : null;
    if (mod.pp !== undefined) entry.pp = typeof mod.pp === 'number' ? mod.pp : null;
    if (mod.priority !== undefined) entry.priority = mod.priority;
    if (mod.target !== undefined) entry.target = mod.target;
    if (mod.desc !== undefined) entry.desc = mod.desc;
    if (mod.shortDesc !== undefined) entry.shortDesc = mod.shortDesc;
    if (mod.flags !== undefined) {
      const cleanFlags: Record<string, any> = {};
      for (const [k, v] of Object.entries(mod.flags)) {
        if (!IGNORED_FLAGS.has(k) && v) {
          cleanFlags[k] = v;
        }
      }
      entry.flags = cleanFlags;
    }
    if (mod.isNonstandard !== undefined) entry.isNonstandard = mod.isNonstandard;
    out[key] = entry;
  }
  return out;
}

/**
 * Extracts searchable effect tags and standard flags from a raw Showdown ability definition.
 */
export function extractAbilityFlags(
  a: Record<string, any>,
  id?: string,
  onCallbackWarning?: (msg: string) => void
): AbilityFlags {
  const flags: AbilityFlags = {};

  if (a.flags) {
    for (const [k, v] of Object.entries(a.flags)) {
      if (v) {
        Object.assign(flags, { [k]: v });
      }
    }
  }

  if (a.suppressWeather) {
    flags.suppressWeather = true;
  }
  if (id && onCallbackWarning) {
    let hasCallback = false;
    for (const [k, v] of Object.entries(a)) {
      if (typeof v === 'function' && k.startsWith('on')) {
        hasCallback = true;
        break;
      }
    }
    const hasExtractedEffect = Object.keys(flags).length > 0;
    if (hasCallback && !hasExtractedEffect) {
      onCallbackWarning(`[CALLBACK-ONLY] ${id}: has handler callbacks but no declarative effect flags`);
    }
  }

  return flags;
}

/**
 * Parses ability definitions from abilities source files.
 */
export function parseAbilitiesEntries(
  rawAbilities: Record<string, any>,
  textEntries?: Record<string, any>,
  onCallbackWarning?: (msg: string) => void
): Record<string, Partial<RepoAbility> & { inherit?: boolean; isNonstandard?: string | null }> {
  const out: Record<string, Partial<RepoAbility> & { inherit?: boolean; isNonstandard?: string | null }> = {};
  for (const [key, a] of Object.entries(rawAbilities)) {
    if (a.isNonstandard === 'CAP') continue;
    const text = extractTextOverrides(textEntries?.[key]);
    const flags = extractAbilityFlags(a, key, onCallbackWarning);
    const entry: Partial<RepoAbility> & { inherit?: boolean; isNonstandard?: string | null } = {
      inherit: a.inherit === true,
    };
    if (a.name !== undefined) entry.name = a.name;
    entry.desc = text.desc ?? a.desc ?? null;
    entry.shortDesc = text.shortDesc ?? a.shortDesc ?? null;
    if (Object.keys(flags).length > 0) entry.flags = flags;
    if (a.isNonstandard !== undefined) entry.isNonstandard = a.isNonstandard;
    out[key] = entry;
  }
  return out;
}

/**
 * Parses ability descriptions from text source files with support for Champions overrides.
 */
export function parseAbilitiesDescriptions(rawText: Record<string, any>): Record<string, { name?: string; desc: string | null; shortDesc: string | null }> {
  const out: Record<string, { name?: string; desc: string | null; shortDesc: string | null }> = {};
  for (const [key, entry] of Object.entries(rawText)) {
    const text = extractTextOverrides(entry);
    out[key] = {
      name: entry.name,
      desc: text.desc,
      shortDesc: text.shortDesc,
    };
  }
  return out;
}

/**
 * Extracts searchable effect tags and standard flags from a raw Showdown item definition.
 */
export function extractItemFlags(
  item: Record<string, any>,
  id?: string,
  onCallbackWarning?: (msg: string) => void
): ItemFlags {
  const flags: ItemFlags = {};

  if (item.fling) flags.fling = item.fling;
  if (item.isBerry) flags.isBerry = true;
  if (item.isChoice) flags.isChoice = true;
  if (item.isGem) flags.isGem = true;
  if (item.isPokeball) flags.isPokeball = true;
  if (item.isPrimalOrb) flags.isPrimalOrb = true;
  if (item.ignoreKlutz) flags.ignoreKlutz = true;
  if (item.megaStone) flags.megaStone = item.megaStone;
  if (item.onDrive) flags.onDrive = item.onDrive;
  if (item.onMemory) flags.onMemory = item.onMemory;
  if (item.onPlate) flags.onPlate = item.onPlate;
  if (item.zMove !== undefined) flags.zMove = item.zMove;
  if (item.zMoveType) flags.zMoveType = item.zMoveType;
  if (item.zMoveFrom) flags.zMoveFrom = item.zMoveFrom;
  if (item.itemUser) flags.itemUser = item.itemUser;
  if (item.forcedForme) flags.forcedForme = item.forcedForme;
  if (item.naturalGift) flags.naturalGift = item.naturalGift;
  if (item.boosts) flags.boosts = item.boosts;

  if (id && onCallbackWarning) {
    let hasCallback = false;
    for (const [k, v] of Object.entries(item)) {
      if (typeof v === 'function' && (k.startsWith('on') || k === 'condition')) {
        hasCallback = true;
        break;
      }
    }
    const hasExtractedEffect = Object.keys(flags).length > 0;
    if (hasCallback && !hasExtractedEffect) {
      onCallbackWarning(`[CALLBACK-ONLY] ${id}: has handler callbacks but no declarative effect flags`);
    }
  }

  return flags;
}

/**
 * Normalizes item definitions from Showdown sources.
 */
export function parseItems(
  rawItems: Record<string, any>,
  textEntries?: Record<string, any>,
  onCallbackWarning?: (msg: string) => void
): Record<string, Partial<RepoItem> & { inherit?: boolean }> {
  const out: Record<string, Partial<RepoItem> & { inherit?: boolean }> = {};
  for (const [key, item] of Object.entries(rawItems)) {
    if (item.isNonstandard === 'CAP') continue;
    const text = extractTextOverrides(textEntries?.[key]);
    const flags = extractItemFlags(item, key, onCallbackWarning);
    const entry: Partial<RepoItem> & { inherit?: boolean } = {
      inherit: item.inherit === true,
    };
    if (item.name !== undefined) entry.name = item.name;
    entry.desc = text.desc ?? item.desc ?? null;
    entry.shortDesc = text.shortDesc ?? item.shortDesc ?? null;
    if (Object.keys(flags).length > 0) entry.flags = flags;
    if (item.isNonstandard !== undefined) entry.isNonstandard = item.isNonstandard;
    out[key] = entry;
  }
  return out;
}

/**
 * Deep equality check ignoring object key ordering, matching Python dict/list equality.
 */
export function isDeepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) {
    return a === b;
  }
  if (typeof a !== typeof b) return false;

  if (typeof a !== 'object') {
    return a === b;
  }

  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!isDeepEqual(a[key], b[key])) return false;
  }

  return true;
}

export interface SyncLogEntry {
  type: 'NEW' | 'REMOVED_OR_MISSING' | 'UPDATED' | 'DIVERGENT' | 'UNCHANGED';
  collection: string;
  id: string;
  name?: string;
  message: string;
  diffDetails?: string;
}

export interface SyncResult<T> {
  result: Record<string, T>;
  logs: SyncLogEntry[];
  stats: {
    total: number;
    newCount: number;
    updatedCount: number;
    missingCount: number;
    unchangedCount: number;
    unverifiedCount: number;
  };
}

/**
 * Synchronizes Showdown-derived data against existing repository data adhering to verification rules:
 * - If NOT in repo but IS in Showdown: add with verified = false.
 * - If IS in repo but NOT in Showdown: mark verified = false.
 * - If IS in both: deep compare payloads (excluding source & verified).
 * - If identical: keep repo entry (and its verified flag).
 * - If different: update payload, keep custom source if present, mark verified = false.
 */
export function syncCollection<T extends { source?: string; verified?: boolean; name?: string;[key: string]: any }>(
  collectionName: string,
  repoData: Record<string, T>,
  showdownData: Record<string, T>,
  defaultSource = SHOWDOWN_SOURCE,
  keyOrder?: string[]
): SyncResult<T> {
  const result: Record<string, T> = {};
  const logs: SyncLogEntry[] = [];

  let newCount = 0;
  let updatedCount = 0;
  let missingCount = 0;
  let unchangedCount = 0;
  let unverifiedCount = 0;

  // 1. Check for items present in repo but missing from Showdown
  for (const [id, repoEntry] of Object.entries(repoData)) {
    if (!(id in showdownData)) {
      const unverifiedEntry = {
        ...repoEntry,
        verified: false,
      };
      result[id] = unverifiedEntry;
      missingCount++;
      unverifiedCount++;
      logs.push({
        type: 'REMOVED_OR_MISSING',
        collection: collectionName,
        id,
        name: repoEntry.name,
        message: `Exists in repo but missing from Showdown. Marked as unverified for review.`,
      });
    }
  }

  // 2. Process Showdown entries against repo entries
  for (const [id, sdEntry] of Object.entries(showdownData)) {
    if (!(id in repoData)) {
      // New entry from Showdown
      const newEntry = {
        ...sdEntry,
        source: sdEntry.source ?? defaultSource,
        verified: false,
      };
      result[id] = newEntry;
      newCount++;
      unverifiedCount++;
      logs.push({
        type: 'NEW',
        collection: collectionName,
        id,
        name: sdEntry.name,
        message: `New entry added from Showdown. Marked as unverified.`,
      });
    } else {
      // Entry exists in both: deep compare payloads ignoring source and verified
      const repoEntry = repoData[id]!;
      const { source: repoSource, verified: repoVerified, ...repoPayload } = repoEntry;
      const { source: _sdSource, verified: _sdVerified, ...sdPayload } = sdEntry;

      const identical = isDeepEqual(repoPayload, sdPayload);

      if (identical) {
        result[id] = {
          ...sdEntry,
          source: repoSource ?? defaultSource,
          verified: Boolean(repoVerified),
        };
        unchangedCount++;
        if (!repoVerified) unverifiedCount++;
        logs.push({
          type: 'UNCHANGED',
          collection: collectionName,
          id,
          name: sdEntry.name,
          message: `Identical to repo data. Kept existing verification (${Boolean(repoVerified)}).`,
        });
      } else {
        // Values changed
        const isCustomSource = repoSource && repoSource !== defaultSource;
        const finalSource = isCustomSource ? repoSource : defaultSource;

        result[id] = {
          ...sdEntry,
          source: finalSource,
          verified: false,
        };
        updatedCount++;
        unverifiedCount++;

        const logType = isCustomSource ? 'DIVERGENT' : 'UPDATED';
        const msg = isCustomSource
          ? `Divergent values found between repo (source: "${repoSource}") and Showdown. Marked as unverified for manual review.`
          : `Values updated from Showdown. Marked as unverified.`;

        logs.push({
          type: logType,
          collection: collectionName,
          id,
          name: sdEntry.name,
          message: msg,
        });
      }
    }
  }

  // Determine final key ordering: use custom keyOrder if provided, otherwise alphabetical
  const sortedResult: Record<string, T> = {};
  if (keyOrder && keyOrder.length > 0) {
    const keySet = new Set(Object.keys(result));
    for (const key of keyOrder) {
      if (keySet.has(key)) {
        sortedResult[key] = result[key]!;
        keySet.delete(key);
      }
    }
    // Append any remaining keys alphabetically
    for (const key of Array.from(keySet).sort()) {
      sortedResult[key] = result[key]!;
    }
  } else {
    for (const key of Object.keys(result).sort()) {
      sortedResult[key] = result[key]!;
    }
  }

  return {
    result: sortedResult,
    logs,
    stats: {
      total: Object.keys(sortedResult).length,
      newCount,
      updatedCount,
      missingCount,
      unchangedCount,
      unverifiedCount,
    },
  };
}

#!/usr/bin/env bun
/** Generates unfiltered master data and regulation-specific Showdown deltas. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  extractTextOverrides,
  isDeepEqual,
  parseAbilitiesEntries,
  parseItems,
  parseLegalSpecies,
  parseMoveMods,
  parseMovesMain,
  parsePokedex,
  type ParsedMove,
  type RegulationDelta,
  type RepoAbility,
  type RepoItem,
  type RepoLearnset,
  type RepoMove,
  type RepoPokemon,
  SHOWDOWN_SOURCE,
} from './showdown_parser.ts';
import { getRegulation, REGULATIONS, type RegulationDefinition } from './regulations.ts';

const ROOT_DIR = resolve(import.meta.dir, '..');
const SOURCES_DIR = join(ROOT_DIR, 'data', 'sources');
const MASTER_DIR = join(ROOT_DIR, 'data', 'master');
const MAIN_FILES = ['pokedex.ts', 'moves-main.ts', 'moves-text.ts', 'items-main.ts', 'items-text.ts', 'abilities-main.ts', 'abilities-text.ts', 'formats-data-main.ts', 'learnsets-main.ts'];
const MOD_FILES = ['formats-data.ts', 'learnsets.ts', 'moves.ts', 'items.ts', 'abilities.ts'];
// These forms only exist during battle and do not have standalone learnsets.
const COLLAPSED_FORMS = new Set([
  'aegislashblade',
  'castformrainy',
  'castformsnowy',
  'castformsunny',
  'meowsticf',
]);
const LEARNSET_FALLBACKS: Record<string, string> = { gourgeistsmall: 'gourgeist', gourgeistlarge: 'gourgeist', gourgeistsuper: 'gourgeist', floettemega: 'floetteeternal', meowsticmmega: 'meowstic' };
const SHOWDOWN_ALIASES: Record<string, string> = { meowsticmmega: 'Mega Meowstic', taurospaldeacombat: 'Paldean Tauros' };

type RawRecord = Record<string, any>;
type SourceManifest = {
  baseRef: string;
  regulations: Array<{ regulationId: string; sourceModId: string }>;
};
type ResolvedData = {
  roster: Record<string, RepoPokemon>;
  legalSpecies: Set<string>;
  learnsets: Record<string, RepoLearnset>;
  moves: Record<string, ParsedMove>;
  availableMoves: Set<string>;
  abilities: Record<string, RepoAbility>;
  availableAbilities: Set<string>;
  items: Record<string, RepoItem>;
  availableItems: Set<string>;
};

function writeJson(path: string, value: unknown, dryRun: boolean): void {
  if (dryRun) return void console.log(`  [dry-run] would write ${path.slice(ROOT_DIR.length + 1)}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  console.log(`  wrote ${path.slice(ROOT_DIR.length + 1)}`);
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function sorted<T>(entries: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
}

function withSources<T extends object>(entries: Record<string, T>): Record<string, T & { sources: string[] }> {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry, sources: [SHOWDOWN_SOURCE] }]));
}

function diffEntry(base: RawRecord | undefined, resolved: RawRecord): RawRecord {
  if (!base) return resolved;
  const delta: RawRecord = {};
  for (const [key, value] of Object.entries(resolved)) if (!isDeepEqual(base[key], value)) delta[key] = value;
  return delta;
}

function withoutNonstandard<T extends RawRecord>(entry: T): Omit<T, 'isNonstandard'> {
  const { isNonstandard: _ignored, ...output } = entry;
  return output;
}

function availabilityDelta<T extends RawRecord>(
  baseEntries: Record<string, T>,
  baseAvailable: Set<string>,
  currentEntries: Record<string, T>,
  currentAvailable: Set<string>
): Record<string, Partial<T> | null> {
  const delta: Record<string, Partial<T> | null> = {};
  for (const id of new Set([...baseAvailable, ...currentAvailable])) {
    if (!currentAvailable.has(id)) {
      delta[id] = null;
      continue;
    }
    const changes = diffEntry(baseEntries[id], currentEntries[id]!);
    if (!baseAvailable.has(id) || Object.keys(changes).length > 0) delta[id] = changes as Partial<T>;
  }
  return delta;
}

function preserveCustomDeltaValues(delta: RegulationDelta, path: string): RegulationDelta {
  if (!existsSync(path)) return delta;
  const existing = JSON.parse(readFileSync(path, 'utf-8')) as RegulationDelta;
  if (existing.regulationId !== delta.regulationId) return delta;
  delta.$schema = existing.$schema ?? '../../schemas/delta.schema.json';
  delta.begin = existing.begin;
  delta.end = existing.end;
  for (const resource of ['roster', 'learnsets', 'moves', 'abilities', 'items'] as const) {
    const generated = delta.overrides[resource] as RawRecord;
    const previous = existing.overrides?.[resource] as RawRecord | undefined;
    if (!previous) continue;
    for (const [id, override] of Object.entries(previous)) {
      const previousSources = override && Array.isArray((override as RawRecord).sources) ? (override as RawRecord).sources as string[] : [];
      if (previousSources.some((source) => source !== SHOWDOWN_SOURCE)) {
        if (resource !== 'roster' || generated[id]) {
          generated[id] = { ...generated[id], ...override, sources: [...new Set([...(generated[id]?.sources ?? []), ...previousSources])] };
        }
      }
    }
  }
  return delta;
}

function learnsetId(speciesId: string, learnsets: RawRecord): string {
  if (LEARNSET_FALLBACKS[speciesId]) return LEARNSET_FALLBACKS[speciesId]!;
  for (const suffix of ['megax', 'megay', 'megaz', 'mega', 'gmax']) {
    const candidate = speciesId.endsWith(suffix) ? speciesId.slice(0, -suffix.length) : '';
    if (candidate in learnsets) return candidate;
  }
  return speciesId;
}

function findLearnsetId(speciesId: string, pokemon: RepoPokemon, roster: Record<string, RepoPokemon>, learnsets: RawRecord): string {
  const direct = learnsetId(speciesId, learnsets);
  if (learnsets[direct]?.learnset) return direct;
  // Showdown often stores a form's learnset only under its base form. Prefer
  // that form, then any same-national-dex entry that actually has a learnset.
  const candidates = Object.entries(roster)
    .filter(([, entry]) => entry.dexNumber === pokemon.dexNumber)
    .sort(([, left], [, right]) => Number(left.form !== null) - Number(right.form !== null));
  const matching = candidates.find(([id]) => learnsets[learnsetId(id, learnsets)]?.learnset);
  return matching ? learnsetId(matching[0], learnsets) : direct;
}

function resolveMoves(master: Record<string, ParsedMove>, mods: ReturnType<typeof parseMoveMods>, text: RawRecord, textModId: string): Record<string, ParsedMove> {
  const result = { ...master };
  for (const [id, mod] of Object.entries(mods)) {
    const base = result[id] ?? { name: '', type: '', category: '', power: null, accuracy: null, pp: null, priority: 0, target: null, desc: null, shortDesc: null, flags: {}, isNonstandard: null };
    const entry: ParsedMove = mod.inherit
      ? { ...base, flags: { ...base.flags } }
      : { name: '', type: '', category: '', power: null, accuracy: null, pp: null, priority: 0, target: null, desc: null, shortDesc: null, flags: {}, isNonstandard: null };
    if (mod.name !== undefined) entry.name = mod.name;
    if (mod.type !== undefined) entry.type = mod.type;
    if (mod.category !== undefined) entry.category = mod.category;
    if (mod.power !== undefined) entry.power = mod.power;
    if (mod.accuracy !== undefined) entry.accuracy = mod.accuracy;
    if (mod.pp !== undefined) entry.pp = mod.pp;
    if (mod.priority !== undefined) entry.priority = mod.priority;
    if (mod.target !== undefined) entry.target = mod.target;
    if (mod.flags !== undefined) entry.flags = { ...entry.flags, ...mod.flags };
    const overrides = extractTextOverrides(text[id], textModId);
    entry.desc = mod.desc ?? overrides.desc ?? entry.desc ?? null;
    entry.shortDesc = mod.shortDesc ?? overrides.shortDesc ?? entry.shortDesc ?? null;
    if (mod.isNonstandard !== undefined) entry.isNonstandard = mod.isNonstandard;
    if (!entry.sources) {
      entry.sources = [SHOWDOWN_SOURCE];
    }
    result[id] = entry;
  }
  return result;
}

function resolveAbilities(master: Record<string, RepoAbility>, mods: ReturnType<typeof parseAbilitiesEntries>, text: RawRecord, textModId: string): Record<string, RepoAbility> {
  const result = { ...master };
  for (const [id, mod] of Object.entries(mods)) {
    const base = result[id] ?? { name: '', desc: null, shortDesc: null };
    const entry: RepoAbility = mod.inherit ? { ...base } : { name: '', desc: null, shortDesc: null };
    if (mod.name !== undefined) entry.name = mod.name;
    const overrides = extractTextOverrides(text[id], textModId);
    entry.desc = mod.desc ?? overrides.desc ?? entry.desc ?? null;
    entry.shortDesc = mod.shortDesc ?? overrides.shortDesc ?? entry.shortDesc ?? null;
    if (mod.flags !== undefined) entry.flags = { ...entry.flags, ...mod.flags };
    if (!entry.sources) {
      entry.sources = [SHOWDOWN_SOURCE];
    }
    result[id] = entry;
  }
  return result;
}

function resolveItems(master: Record<string, RepoItem>, mods: ReturnType<typeof parseItems>, text: RawRecord, textModId: string): Record<string, RepoItem> {
  const result = { ...master };
  for (const [id, mod] of Object.entries(mods)) {
    const base = result[id] ?? { name: '', desc: null, shortDesc: null };
    const entry: RepoItem = mod.inherit ? { ...base } : { name: '', desc: null, shortDesc: null, isNonstandard: null };
    if (mod.name !== undefined) entry.name = mod.name;
    const overrides = extractTextOverrides(text[id], textModId);
    entry.desc = mod.desc ?? overrides.desc ?? entry.desc ?? null;
    entry.shortDesc = mod.shortDesc ?? overrides.shortDesc ?? entry.shortDesc ?? null;
    if (mod.flags !== undefined) entry.flags = { ...entry.flags, ...mod.flags };
    if (mod.isNonstandard !== undefined) entry.isNonstandard = mod.isNonstandard;
    if (!entry.sources) {
      entry.sources = [SHOWDOWN_SOURCE];
    }
    result[id] = entry;
  }
  return result;
}

function parentSnapshotDir(regulationId: string): string {
  return join(SOURCES_DIR, regulationId, '_parent');
}

function hasParentSnapshot(regulationId: string): boolean {
  return MOD_FILES.every((file) => existsSync(join(parentSnapshotDir(regulationId), file)));
}

async function loadModDir(source: string) {
  const [{ FormatsData }, { Learnsets }, { Moves }, { Items }, { Abilities }] = await Promise.all([
    import(`${source}/formats-data.ts`),
    import(`${source}/learnsets.ts`),
    import(`${source}/moves.ts`),
    import(`${source}/items.ts`),
    import(`${source}/abilities.ts`),
  ]);
  return {
    formatsData: FormatsData as RawRecord,
    learnsets: Learnsets as RawRecord,
    moves: Moves as RawRecord,
    items: Items as RawRecord,
    abilities: Abilities as RawRecord,
  };
}

async function importMod(regulation: RegulationDefinition) {
  const mod = await loadModDir(`../data/sources/${regulation.regulationId}`);
  const useParentSnapshot = hasParentSnapshot(regulation.regulationId);
  const inherited = useParentSnapshot
    ? await loadModDir(`../data/sources/${regulation.regulationId}/_parent`)
    : await (async () => {
      const [{ FormatsData }, { Learnsets }] = await Promise.all([
        import('../data/sources/formats-data-main.ts'),
        import('../data/sources/learnsets-main.ts'),
      ]);
      return { formatsData: FormatsData as RawRecord, learnsets: Learnsets as RawRecord, moves: {}, items: {}, abilities: {} };
    })();
  /**
   * Showdown replaces a data entry unless it explicitly sets `inherit: true`.
   * A shallow merge for every entry kept old `isNonstandard` flags alive—for
   * example, Reg M-B's Raichu Mega entries remained unavailable despite their
   * replacement entries omitting that flag.
   */
  const overlay = (base: RawRecord, overrides: RawRecord): RawRecord => Object.fromEntries(
    new Set([...Object.keys(base), ...Object.keys(overrides)]).values().map((id) => {
      if (!(id in overrides)) return [id, base[id]];
      const override = overrides[id];
      return [id, override?.inherit === true ? { ...base[id], ...override } : override];
    })
  );
  return {
    formatsData: overlay(inherited.formatsData, mod.formatsData),
    learnsets: overlay(inherited.learnsets, mod.learnsets),
    moves: useParentSnapshot ? overlay(inherited.moves, mod.moves) : mod.moves,
    items: useParentSnapshot ? overlay(inherited.items, mod.items) : mod.items,
    abilities: useParentSnapshot ? overlay(inherited.abilities, mod.abilities) : mod.abilities,
  };
}

function makeDelta(regulation: RegulationDefinition, sourceModId: string, base: ResolvedData, master: ResolvedData, mod: Awaited<ReturnType<typeof importMod>>, text: { moves: RawRecord; abilities: RawRecord; items: RawRecord }): { delta: RegulationDelta; resolved: ResolvedData } {
  const textModId = sourceModId;
  const roster: RegulationDelta['overrides']['roster'] = {};
  const learnsets: RegulationDelta['overrides']['learnsets'] = {};
  const legalSpecies = new Set([...parseLegalSpecies(mod.formatsData)].filter((id) => !COLLAPSED_FORMS.has(id)));
  const baseLegalSpecies = regulation.baseRegulationId ? base.legalSpecies : new Set(Object.keys(base.roster));
  const resolvedRoster: Record<string, RepoPokemon> = { ...base.roster };
  const resolvedLearnsets: Record<string, RepoLearnset> = {};
  for (const id of [...legalSpecies].sort()) {
    // A progressive regulation can re-add a species its base removed. Its
    // immutable data comes from master; its prior regulation override, if any,
    // remains the preferred value.
    const pokemon = base.roster[id] ?? master.roster[id];
    if (!pokemon) throw new Error(`${regulation.regulationId}: legal species "${id}" is absent from master roster.`);
    if (!baseLegalSpecies.has(id)) {
      roster[id] = {};
      resolvedRoster[id] = pokemon;
    }
    const sourceId = findLearnsetId(id, pokemon, master.roster, mod.learnsets);
    const rawLearnset = mod.learnsets[sourceId]?.learnset;
    if (!rawLearnset) throw new Error(`${regulation.regulationId}: missing learnset for "${id}" (mapped to "${sourceId}").`);
    const learnset = { dexNumber: pokemon.dexNumber, form: pokemon.form, moves: Object.keys(rawLearnset).sort(), sources: [SHOWDOWN_SOURCE] } satisfies RepoLearnset;
    resolvedLearnsets[id] = learnset;
  }
  for (const id of baseLegalSpecies) {
    if (!legalSpecies.has(id)) {
      roster[id] = null;
      learnsets[id] = null;
      delete resolvedRoster[id];
    }
  }

  // Keep master records available for a later regulation to re-add unchanged
  // resources. Availability is tracked separately by the corresponding set.
  const resolvedMoves = resolveMoves({ ...master.moves, ...base.moves }, parseMoveMods(mod.moves), text.moves, textModId);
  for (const [id, learnset] of Object.entries(resolvedLearnsets)) {
    const knownMoves = learnset.moves.filter((moveId) => resolvedMoves[moveId]);
    if (knownMoves.length !== learnset.moves.length) {
      const omitted = learnset.moves.filter((moveId) => !resolvedMoves[moveId]);
      console.warn(`${regulation.regulationId}: omitting unknown moves from "${id}": ${omitted.join(', ')}`);
    }
    const next = { ...learnset, moves: knownMoves };
    resolvedLearnsets[id] = next;
    const learnsetDelta = diffEntry(base.learnsets[id] as RawRecord | undefined, next);
    if (!base.learnsets[id] || Object.keys(learnsetDelta).length > 0) learnsets[id] = learnsetDelta;
  }
  const availableMoves = new Set(Object.values(resolvedLearnsets).flatMap((learnset) => learnset.moves));
  const moveDeltas = availabilityDelta(
    Object.fromEntries(Object.entries(base.moves).map(([id, move]) => [id, withoutNonstandard(move)])),
    base.availableMoves,
    Object.fromEntries(Object.entries(resolvedMoves).map(([id, move]) => [id, withoutNonstandard(move)])),
    availableMoves
  );

  const resolvedAbilities = resolveAbilities({ ...master.abilities, ...base.abilities }, parseAbilitiesEntries(mod.abilities, text.abilities, undefined, textModId), text.abilities, textModId);
  const availableAbilities = new Set([...legalSpecies].flatMap((id) => Object.values(resolvedRoster[id]!.abilities ?? {})));
  const abilityDeltas = availabilityDelta(base.abilities, base.availableAbilities, resolvedAbilities, availableAbilities);

  const resolvedItems = resolveItems({ ...master.items, ...base.items }, parseItems(mod.items, text.items, undefined, textModId), text.items, textModId);
  const availableItems = new Set(Object.entries(resolvedItems).filter(([, item]) => !item.isNonstandard).map(([id]) => id));
  const itemDeltas = availabilityDelta(
    Object.fromEntries(Object.entries(base.items).map(([id, item]) => [id, withoutNonstandard(item)])),
    base.availableItems,
    Object.fromEntries(Object.entries(resolvedItems).map(([id, item]) => [id, withoutNonstandard(item)])),
    availableItems
  );

  return {
    delta: { $schema: '../../schemas/delta.schema.json', regulationId: regulation.regulationId, regulationName: regulation.regulationName, baseRegulationId: regulation.baseRegulationId ?? null, begin: null, end: null, overrides: { roster: sorted(roster), learnsets: sorted(learnsets), moves: sorted(moveDeltas), abilities: sorted(abilityDeltas), items: sorted(itemDeltas) } },
    resolved: { roster: resolvedRoster, legalSpecies, learnsets: resolvedLearnsets, moves: resolvedMoves, availableMoves, abilities: resolvedAbilities, availableAbilities, items: resolvedItems, availableItems },
  };
}

function applyOverride<T extends object>(base: T, override: Partial<T>): T {
  const output: RawRecord = { ...(base as RawRecord) };
  for (const [key, value] of Object.entries(override)) {
    if (key === 'sources' && Array.isArray(output[key]) && Array.isArray(value)) {
      output[key] = [...new Set([...output[key], ...value])];
    } else if (key === 'baseStats' && output[key] && typeof output[key] === 'object' && !Array.isArray(output[key]) && value && typeof value === 'object' && !Array.isArray(value)) {
      output[key] = { ...output[key], ...value };
    } else {
      output[key] = value;
    }
  }
  return output as T;
}

function applyResource<T extends object>(current: Record<string, T>, overrides: Record<string, Partial<T> | null>, master: Record<string, T>): Record<string, T> {
  const output = { ...current };
  for (const [id, override] of Object.entries(overrides)) {
    if (override === null) delete output[id];
    else {
      const base = output[id] ?? master[id];
      if (!base) throw new Error(`Resource override "${id}" is absent from master data.`);
      output[id] = applyOverride(base, override);
    }
  }
  return output;
}

/** Resolves a committed delta when its source snapshot was not fetched. */
function resolveStoredDelta(regulation: RegulationDefinition, base: ResolvedData): ResolvedData {
  const path = join(ROOT_DIR, 'data', regulation.directoryName, 'delta.json');
  if (!existsSync(path)) throw new Error(`Missing ${path.slice(ROOT_DIR.length + 1)}. Fetch this regulation from its historical Showdown ref before generating a descendant.`);
  const delta = loadJson<RegulationDelta>(path);
  if (delta.regulationId !== regulation.regulationId || delta.baseRegulationId !== (regulation.baseRegulationId ?? null)) {
    throw new Error(`${path.slice(ROOT_DIR.length + 1)} does not match the configured historical lineage. Regenerate ${regulation.regulationName} from its Showdown snapshot first.`);
  }
  const roster = applyResource(base.roster, delta.overrides.roster, base.roster);
  const learnsets: Record<string, RepoLearnset> = { ...base.learnsets };
  for (const [id, override] of Object.entries(delta.overrides.learnsets)) {
    if (override === null) delete learnsets[id];
    else learnsets[id] = applyOverride(learnsets[id] ?? ({} as RepoLearnset), override);
  }
  const moves = applyResource(base.moves, delta.overrides.moves, base.moves) as Record<string, ParsedMove>;
  const abilities = applyResource(base.abilities, delta.overrides.abilities, base.abilities);
  const items = applyResource(base.items, delta.overrides.items, base.items);
  return {
    roster,
    legalSpecies: new Set(Object.keys(roster)),
    learnsets,
    moves,
    availableMoves: new Set(Object.keys(moves)),
    abilities,
    availableAbilities: new Set(Object.values(roster).flatMap((pokemon) => Object.values(pokemon.abilities ?? {}))),
    items,
    availableItems: new Set(Object.keys(items)),
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { 'dry-run': { type: 'boolean', default: false }, regulation: { type: 'string' } } });
  const dryRun = Boolean(values['dry-run']);
  for (const file of MAIN_FILES) if (!existsSync(join(SOURCES_DIR, file))) throw new Error(`Missing data/sources/${file}. Run bun run fetch-sd --base first.`);
  const manifestPath = join(SOURCES_DIR, 'fetch-manifest.json');
  if (!existsSync(manifestPath)) throw new Error('Missing data/sources/fetch-manifest.json. Run bun run fetch-sd first.');
  const manifest = loadJson<SourceManifest>(manifestPath);
  const sourceModIds = new Map(manifest.regulations.map((entry) => [entry.regulationId, entry.sourceModId]));
  if (values.regulation && !sourceModIds.has(values.regulation) && !sourceModIds.has(getRegulation(values.regulation).regulationId)) {
    throw new Error(`Regulation "${values.regulation}" was not fetched. Check data/sources/fetch-manifest.json (base ref: ${manifest.baseRef}).`);
  }
  for (const regulationId of sourceModIds.keys()) {
    const regulation = REGULATIONS.find((entry) => entry.regulationId === regulationId);
    if (!regulation) {
      throw new Error(`Invalid data/sources/fetch-manifest.json: "${regulationId}" is not a configured repository regulation. Run fetch-sd with SHOWDOWN_CURRENT_REGULATION and SHOWDOWN_PREVIOUS_REGULATION set to repository IDs (for example, championsregmb and championsregma), not Showdown source-mod names such as "champions".`);
    }
    for (const file of MOD_FILES) if (!existsSync(join(SOURCES_DIR, regulation.regulationId, file))) throw new Error(`Missing data/sources/${regulation.regulationId}/${file}. Run bun run fetch-sd first.`);
    const sourceModId = sourceModIds.get(regulationId)!;
    if (sourceModId !== 'champions' && !hasParentSnapshot(regulation.regulationId)) {
      throw new Error(`Missing contemporaneous parent snapshot at data/sources/${regulation.regulationId}/_parent/. Run bun run fetch-sd so archived mods do not inherit the live Champions folder.`);
    }
  }
  console.log(`Using Showdown base ref ${manifest.baseRef}; fetched regulations: ${[...sourceModIds.entries()].map(([id, mod]) => `${id} (${mod})`).join(', ')}`);

  const [{ Pokedex }, { Moves: rawMoves }, { MovesText }, { Items: rawItems }, { ItemsText }, { Abilities: rawAbilities }, { AbilitiesText }] = await Promise.all([
    import('../data/sources/pokedex.ts'), import('../data/sources/moves-main.ts'), import('../data/sources/moves-text.ts'), import('../data/sources/items-main.ts'), import('../data/sources/items-text.ts'), import('../data/sources/abilities-main.ts'), import('../data/sources/abilities-text.ts'),
  ]);
  const abilityIds = new Map<string, string>();
  for (const [id, ability] of Object.entries(rawAbilities as RawRecord)) if (ability.name) abilityIds.set(ability.name, id);
  const parsedMoves = parseMovesMain(rawMoves as RawRecord, MovesText as RawRecord);
  const parsedAbilities = parseAbilitiesEntries(rawAbilities as RawRecord, AbilitiesText as RawRecord);
  const parsedItems = parseItems(rawItems as RawRecord, ItemsText as RawRecord);
  const master = {
    roster: withSources(parsePokedex(
      Object.fromEntries(Object.entries(Pokedex as RawRecord).filter(([, entry]) => Number(entry.num) > 0)),
      { nameToIdMap: abilityIds, aliases: SHOWDOWN_ALIASES }
    )),
    moves: withSources(Object.fromEntries(Object.entries(parsedMoves).map(([id, entry]) => { const { isNonstandard: _ignored, ...move } = entry; return [id, move]; })) as Record<string, RepoMove>),
    abilities: withSources(Object.fromEntries(Object.entries(parsedAbilities).map(([id, entry]) => [id, { name: entry.name ?? '', desc: entry.desc ?? null, shortDesc: entry.shortDesc ?? null, ...(entry.flags ? { flags: entry.flags } : {}) }])) as Record<string, RepoAbility>),
    items: withSources(Object.fromEntries(Object.entries(parsedItems).map(([id, entry]) => [id, { name: entry.name ?? '', desc: entry.desc ?? null, shortDesc: entry.shortDesc ?? null, ...(entry.flags ? { flags: entry.flags } : {}), isNonstandard: entry.isNonstandard ?? null }])) as Record<string, RepoItem>),
  };
  console.log('Writing unfiltered master data...');
  writeJson(join(MASTER_DIR, 'roster.json'), sorted(master.roster), dryRun);
  writeJson(join(MASTER_DIR, 'moves.json'), sorted(master.moves), dryRun);
  writeJson(join(MASTER_DIR, 'abilities.json'), sorted(master.abilities), dryRun);
  writeJson(join(MASTER_DIR, 'items.json'), sorted(Object.fromEntries(Object.entries(master.items).map(([id, item]) => [id, withoutNonstandard(item)]))), dryRun);
  const masterResolved: ResolvedData = {
    roster: master.roster,
    legalSpecies: new Set(),
    learnsets: {},
    moves: withSources(parsedMoves),
    availableMoves: new Set(Object.keys(parsedMoves)),
    abilities: master.abilities,
    availableAbilities: new Set(Object.keys(master.abilities)),
    items: master.items,
    availableItems: new Set(Object.keys(master.items)),
  };
  const resolvedByRegulation = new Map<string, ResolvedData>();
  const generatedRegulations = new Set<string>();
  const generatingRegulations = new Set<string>();

  function resolveCommittedRegulation(regulation: RegulationDefinition): ResolvedData {
    const base = regulation.baseRegulationId
      ? resolvedByRegulation.get(regulation.baseRegulationId) ?? resolveCommittedRegulation(getRegulation(regulation.baseRegulationId))
      : masterResolved;
    return resolveStoredDelta(regulation, base);
  }

  async function generateRegulation(regulation: RegulationDefinition): Promise<void> {
    if (generatedRegulations.has(regulation.regulationId)) return;
    if (generatingRegulations.has(regulation.regulationId)) {
      throw new Error(`Circular regulation base detected at "${regulation.regulationId}".`);
    }
    generatingRegulations.add(regulation.regulationId);

    let base = masterResolved;
    if (regulation.baseRegulationId) {
      const baseRegulation = getRegulation(regulation.baseRegulationId);
      if (sourceModIds.has(baseRegulation.regulationId)) await generateRegulation(baseRegulation);
      else base = resolveCommittedRegulation(baseRegulation);
      base = resolvedByRegulation.get(regulation.baseRegulationId) ?? base;
    }

    console.log(`Generating ${regulation.regulationId} delta...`);
    const deltaPath = join(ROOT_DIR, 'data', regulation.directoryName, 'delta.json');
    const sourceModId = sourceModIds.get(regulation.regulationId)!;
    const generated = makeDelta(regulation, sourceModId, base, masterResolved, await importMod(regulation), { moves: MovesText as RawRecord, abilities: AbilitiesText as RawRecord, items: ItemsText as RawRecord });
    writeJson(deltaPath, preserveCustomDeltaValues(generated.delta, deltaPath), dryRun);
    resolvedByRegulation.set(regulation.regulationId, generated.resolved);
    generatedRegulations.add(regulation.regulationId);
    generatingRegulations.delete(regulation.regulationId);
  }

  const selected = values.regulation ? [getRegulation(values.regulation)] : REGULATIONS.filter((regulation) => sourceModIds.has(regulation.regulationId));
  for (const regulation of selected) await generateRegulation(regulation);
}

main().catch((error) => {
  console.error(`\nFATAL ERROR during update: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

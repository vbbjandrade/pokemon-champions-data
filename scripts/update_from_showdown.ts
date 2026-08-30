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
const MAIN_FILES = ['pokedex.ts', 'moves-main.ts', 'moves-text.ts', 'items-main.ts', 'items-text.ts', 'abilities-main.ts', 'abilities-text.ts'];
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
type ResolvedData = {
  roster: Record<string, RepoPokemon>;
  moves: Record<string, ParsedMove>;
  abilities: Record<string, RepoAbility>;
  items: Record<string, RepoItem>;
};

function writeJson(path: string, value: unknown, dryRun: boolean): void {
  if (dryRun) return void console.log(`  [dry-run] would write ${path.slice(ROOT_DIR.length + 1)}`);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  console.log(`  wrote ${path.slice(ROOT_DIR.length + 1)}`);
}

function sorted<T>(entries: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
}

function withSource<T extends object>(entries: Record<string, T>): Record<string, T & { source: string; verified: boolean }> {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry, source: SHOWDOWN_SOURCE, verified: false }]));
}

function diffEntry(base: RawRecord | undefined, resolved: RawRecord): RawRecord {
  if (!base) return resolved;
  const delta: RawRecord = {};
  for (const [key, value] of Object.entries(resolved)) if (!isDeepEqual(base[key], value)) delta[key] = value;
  return delta;
}

function preserveCustomDeltaValues(delta: RegulationDelta, path: string): RegulationDelta {
  if (!existsSync(path)) return delta;
  const existing = JSON.parse(readFileSync(path, 'utf-8')) as RegulationDelta;
  if (existing.regulationId !== delta.regulationId) return delta;
  delta.begin = existing.begin;
  delta.end = existing.end;
  for (const resource of ['roster', 'learnsets', 'moves', 'abilities', 'items'] as const) {
    const generated = delta.overrides[resource] as RawRecord;
    const previous = existing.overrides?.[resource] as RawRecord | undefined;
    if (!previous) continue;
    for (const [id, override] of Object.entries(previous)) {
      if ((override as RawRecord).source && (override as RawRecord).source !== SHOWDOWN_SOURCE) {
        if (resource !== 'roster' || generated[id]) generated[id] = { ...generated[id], ...override };
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
    if (!entry.source) {
      entry.source = SHOWDOWN_SOURCE;
      entry.verified = false;
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
    if (!entry.source) {
      entry.source = SHOWDOWN_SOURCE;
      entry.verified = false;
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
    if (!entry.source) {
      entry.source = SHOWDOWN_SOURCE;
      entry.verified = false;
    }
    result[id] = entry;
  }
  return result;
}

async function importMod(regulation: RegulationDefinition) {
  const source = `../data/sources/${regulation.regulationId}`;
  const [{ FormatsData }, { Learnsets }, { Moves }, { Items }, { Abilities }] = await Promise.all([
    import(`${source}/formats-data.ts`), import(`${source}/learnsets.ts`), import(`${source}/moves.ts`), import(`${source}/items.ts`), import(`${source}/abilities.ts`),
  ]);
  return { formatsData: FormatsData as RawRecord, learnsets: Learnsets as RawRecord, moves: Moves as RawRecord, items: Items as RawRecord, abilities: Abilities as RawRecord };
}

function makeDelta(regulation: RegulationDefinition, base: ResolvedData, mod: Awaited<ReturnType<typeof importMod>>, text: { moves: RawRecord; abilities: RawRecord; items: RawRecord }): { delta: RegulationDelta; resolved: ResolvedData } {
  const textModId = regulation === REGULATIONS[0] ? 'champions' : regulation.regulationId;
  const roster: RegulationDelta['overrides']['roster'] = {};
  const learnsets: RegulationDelta['overrides']['learnsets'] = {};
  for (const id of [...parseLegalSpecies(mod.formatsData)].filter((id) => !COLLAPSED_FORMS.has(id)).sort()) {
    const pokemon = base.roster[id];
    if (!pokemon) throw new Error(`${regulation.regulationId}: legal species "${id}" is absent from master roster.`);
    roster[id] = {};
    const sourceId = learnsetId(id, mod.learnsets);
    const rawLearnset = mod.learnsets[sourceId]?.learnset;
    if (!rawLearnset) throw new Error(`${regulation.regulationId}: missing learnset for "${id}" (mapped to "${sourceId}").`);
    learnsets[id] = { dexNumber: pokemon.dexNumber, form: pokemon.form, moves: Object.keys(rawLearnset).sort(), source: SHOWDOWN_SOURCE, verified: false } satisfies RepoLearnset;
  }

  const moveDeltas: RegulationDelta['overrides']['moves'] = {};
  const resolvedMoves = resolveMoves(base.moves, parseMoveMods(mod.moves), text.moves, textModId);
  for (const [id, entry] of Object.entries(resolvedMoves)) {
    const { isNonstandard: _ignored, ...move } = entry;
    const delta = diffEntry(base.moves[id] as RawRecord | undefined, move);
    if (Object.keys(delta).length) moveDeltas[id] = delta;
  }

  const abilityDeltas: RegulationDelta['overrides']['abilities'] = {};
  const resolvedAbilities = resolveAbilities(base.abilities, parseAbilitiesEntries(mod.abilities, text.abilities, undefined, textModId), text.abilities, textModId);
  for (const [id, entry] of Object.entries(resolvedAbilities)) {
    const delta = diffEntry(base.abilities[id] as RawRecord | undefined, entry);
    if (Object.keys(delta).length) abilityDeltas[id] = delta;
  }

  const itemDeltas: RegulationDelta['overrides']['items'] = {};
  const resolvedItems = resolveItems(base.items, parseItems(mod.items, text.items, undefined, textModId), text.items, textModId);
  for (const [id, entry] of Object.entries(resolvedItems)) {
    const delta = diffEntry(base.items[id] as RawRecord | undefined, entry);
    if (Object.keys(delta).length) itemDeltas[id] = delta;
  }

  return {
    delta: { regulationId: regulation.regulationId, regulationName: regulation.regulationName, begin: null, end: null, overrides: { roster: sorted(roster), learnsets: sorted(learnsets), moves: sorted(moveDeltas), abilities: sorted(abilityDeltas), items: sorted(itemDeltas) } },
    resolved: { roster: base.roster, moves: resolvedMoves, abilities: resolvedAbilities, items: resolvedItems },
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({ args: process.argv.slice(2), options: { 'dry-run': { type: 'boolean', default: false } } });
  const dryRun = Boolean(values['dry-run']);
  for (const file of MAIN_FILES) if (!existsSync(join(SOURCES_DIR, file))) throw new Error(`Missing data/sources/${file}. Run scripts/fetch_sources.sh first.`);
  for (const regulation of REGULATIONS) for (const file of MOD_FILES) if (!existsSync(join(SOURCES_DIR, regulation.regulationId, file))) throw new Error(`Missing data/sources/${regulation.regulationId}/${file}. Run scripts/fetch_sources.sh first.`);

  const [{ Pokedex }, { Moves: rawMoves }, { MovesText }, { Items: rawItems }, { ItemsText }, { Abilities: rawAbilities }, { AbilitiesText }] = await Promise.all([
    import('../data/sources/pokedex.ts'), import('../data/sources/moves-main.ts'), import('../data/sources/moves-text.ts'), import('../data/sources/items-main.ts'), import('../data/sources/items-text.ts'), import('../data/sources/abilities-main.ts'), import('../data/sources/abilities-text.ts'),
  ]);
  const abilityIds = new Map<string, string>();
  for (const [id, ability] of Object.entries(rawAbilities as RawRecord)) if (ability.name) abilityIds.set(ability.name, id);
  const parsedMoves = parseMovesMain(rawMoves as RawRecord, MovesText as RawRecord);
  const parsedAbilities = parseAbilitiesEntries(rawAbilities as RawRecord, AbilitiesText as RawRecord);
  const parsedItems = parseItems(rawItems as RawRecord, ItemsText as RawRecord);
  const master = {
    roster: withSource(parsePokedex(Object.fromEntries(Object.entries(Pokedex as RawRecord).filter(([, entry]) => entry.isNonstandard !== 'CAP')), { nameToIdMap: abilityIds, aliases: SHOWDOWN_ALIASES })),    
    moves: withSource(Object.fromEntries(Object.entries(parsedMoves).map(([id, entry]) => { const { isNonstandard: _ignored, ...move } = entry; return [id, move]; })) as Record<string, RepoMove>),
    abilities: withSource(Object.fromEntries(Object.entries(parsedAbilities).map(([id, entry]) => [id, { name: entry.name ?? '', desc: entry.desc ?? null, shortDesc: entry.shortDesc ?? null, ...(entry.flags ? { flags: entry.flags } : {}) }])) as Record<string, RepoAbility>),
    items: withSource(Object.fromEntries(Object.entries(parsedItems).map(([id, entry]) => [id, { name: entry.name ?? '', desc: entry.desc ?? null, shortDesc: entry.shortDesc ?? null, ...(entry.flags ? { flags: entry.flags } : {}), isNonstandard: entry.isNonstandard ?? null }])) as Record<string, RepoItem>),
  };
  console.log('Writing unfiltered master data...');
  writeJson(join(MASTER_DIR, 'roster.json'), sorted(master.roster), dryRun);
  writeJson(join(MASTER_DIR, 'moves.json'), sorted(master.moves), dryRun);
  writeJson(join(MASTER_DIR, 'abilities.json'), sorted(master.abilities), dryRun);
  writeJson(join(MASTER_DIR, 'items.json'), sorted(master.items), dryRun);
  const masterResolved: ResolvedData = {
    roster: master.roster,
    moves: withSource(parsedMoves),
    abilities: master.abilities,
    items: master.items,
  };
  const resolvedByRegulation = new Map<string, ResolvedData>();
  const generatedRegulations = new Set<string>();
  const generatingRegulations = new Set<string>();

  async function generateRegulation(regulation: RegulationDefinition): Promise<void> {
    if (generatedRegulations.has(regulation.regulationId)) return;
    if (generatingRegulations.has(regulation.regulationId)) {
      throw new Error(`Circular regulation base detected at "${regulation.regulationId}".`);
    }
    generatingRegulations.add(regulation.regulationId);

    let base = masterResolved;
    if (regulation.baseRegulationId) {
      await generateRegulation(getRegulation(regulation.baseRegulationId));
      base = resolvedByRegulation.get(regulation.baseRegulationId)!;
    }

    console.log(`Generating ${regulation.regulationId} delta...`);
    const deltaPath = join(ROOT_DIR, 'data', regulation.directoryName, 'delta.json');
    const generated = makeDelta(regulation, base, await importMod(regulation), { moves: MovesText as RawRecord, abilities: AbilitiesText as RawRecord, items: ItemsText as RawRecord });
    writeJson(deltaPath, preserveCustomDeltaValues(generated.delta, deltaPath), dryRun);
    resolvedByRegulation.set(regulation.regulationId, generated.resolved);
    generatedRegulations.add(regulation.regulationId);
    generatingRegulations.delete(regulation.regulationId);
  }

  for (const regulation of REGULATIONS) {
    await generateRegulation(regulation);
  }
}

main().catch((error) => {
  console.error(`\nFATAL ERROR during update: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

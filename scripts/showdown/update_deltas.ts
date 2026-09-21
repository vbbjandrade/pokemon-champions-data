#!/usr/bin/env bun
/** Generates unfiltered master data and regulation-specific Showdown deltas. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import { deepEquals } from 'bun';

import {
  extractTextOverrides,
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
	type LearnsetDelta,
} from '../../utils/showdown_parser.ts';
import { getRegulation, REGULATIONS, type RegulationDefinition } from '../../utils/regulations.ts';
import { DATA_MASTER_DIR, DATA_REGULATIONS_DIR, SOURCES_MASTER_DIR, SOURCES_REGULATIONS_DIR } from '../../utils/directories.ts';
import { writeJson } from '../../utils/helpers.ts';
import { SHOWDOWN_SOURCE } from '../../utils/constants.ts';

const MASTER_FILES = ['pokedex.ts', 'moves-main.ts', 'moves-text.ts', 'items-main.ts', 'items-text.ts', 'abilities-main.ts', 'abilities-text.ts', 'formats-data-main.ts', 'learnsets-main.ts'];
const MOD_FILES = ['formats-data.ts', 'learnsets.ts', 'moves.ts', 'items.ts', 'abilities.ts'];

// These forms only exist during battle and do not have standalone learnsets.
const COLLAPSED_FORMS = new Set([
  'aegislashblade',
  'castformrainy',
  'castformsnowy',
  'castformsunny',
  'meowsticf',
]);
const LEARNSET_FALLBACKS: Record<string, string> = { 
	gourgeistsmall: 'gourgeist', 
	gourgeistlarge: 'gourgeist', 
	gourgeistsuper: 'gourgeist', 
	floettemega: 'floetteeternal', 
	meowsticmmega: 'meowstic',
	squawkabillyblue: 'squawkabilly',
	squawkabillyyellow: 'squawkabilly',
	squawkabillywhite: 'squawkabilly'
};
const SHOWDOWN_ALIASES: Record<string, string> = { 
	meowsticmmega: 'Mega Meowstic', 
	taurospaldeacombat: 'Paldean Tauros' 
};

type RawRecord = Record<string, any>;

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

function sorted<T>(entries: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(entries).sort(([a], [b]) => a.localeCompare(b)));
}

function withSources<T extends object>(entries: Record<string, T>): Record<string, T & { sources: string[] }> {
  return Object.fromEntries(Object.entries(entries).map(([id, entry]) => [id, { ...entry, sources: [SHOWDOWN_SOURCE] }]));
}

function diffEntry(previous: RawRecord | undefined, current: RawRecord): RawRecord {
  if (!previous) return current;
  const delta: RawRecord = {};

	Object.entries(current).forEach(([key, currValue]) => {
		if (!deepEquals(previous[key], currValue)) {
			delta[key] = currValue;
		}
	})

	return delta;
}

function diffLearnset(previous: RepoLearnset | undefined, current: RepoLearnset) {
	const delta: LearnsetDelta['moves'] = {}

	if (!previous) {
		current.moves.forEach((move) => delta[move] = true);
		return delta; 
	}

	previous.moves.forEach((move) => {
		if (current.moves.find((m) => m === move)) return;
		delta[move] = false;
	});

	current.moves.forEach((move) => {
		if (previous.moves.find((m) => m === move)) return;
		delta[move] = true;
	})

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
  if (existing.id !== delta.id) return delta;

  delta.$schema = existing.$schema ?? '../../../schemas/delta.schema.json';
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

function resolveMoves({ master, mods, text}: {
	master: Record<string, ParsedMove>, 
	mods: ReturnType<typeof parseMoveMods>, 
	text: RawRecord,
}): Record<string, ParsedMove> {
  const result = { ...master };1
  for (const [id, mod] of Object.entries(mods)) {
    const base = result[id] ?? { name: '', type: '', category: '', power: null, accuracy: null, pp: null, priority: 0, target: null, desc: null, shortDesc: null, flags: {}, isNonstandard: null, sources: [] };
    const entry: ParsedMove = mod.inherit
      ? { ...base, flags: { ...base.flags } }
      : { name: '', type: '', category: '', power: null, accuracy: null, pp: null, priority: 0, target: null, desc: null, shortDesc: null, flags: {}, isNonstandard: null, sources: [] };
    
		if (mod.name !== undefined) entry.name = mod.name;
    if (mod.type !== undefined) entry.type = mod.type;
    if (mod.category !== undefined) entry.category = mod.category;
    if (mod.power !== undefined) entry.power = mod.power;
    if (mod.accuracy !== undefined) entry.accuracy = mod.accuracy;
    if (mod.pp !== undefined) entry.pp = mod.pp;
    if (mod.priority !== undefined) entry.priority = mod.priority;
    if (mod.target !== undefined) entry.target = mod.target;
    if (mod.flags !== undefined) entry.flags = { ...entry.flags, ...mod.flags };

    const overrides = extractTextOverrides(text[id]);
    entry.desc = mod.desc ?? overrides.desc ?? entry.desc ?? null;
    entry.shortDesc = mod.shortDesc ?? overrides.shortDesc ?? entry.shortDesc ?? null;

    if (mod.isNonstandard !== undefined) entry.isNonstandard = mod.isNonstandard;
    if (!entry.sources) entry.sources = [SHOWDOWN_SOURCE];

    result[id] = entry;
  }

  return result;
}

function resolveAbilities(master: Record<string, RepoAbility>, mods: ReturnType<typeof parseAbilitiesEntries>, text: RawRecord): Record<string, RepoAbility> {
  const result = { ...master };

  for (const [id, mod] of Object.entries(mods)) {
    const base = result[id] ?? { name: '', desc: null, shortDesc: null, sources: [] };
    const entry: RepoAbility = mod.inherit ? { ...base } : { name: '', desc: null, shortDesc: null, sources: [] };

		if (mod.name !== undefined) entry.name = mod.name;

		const overrides = extractTextOverrides(text[id]);
    entry.desc = mod.desc ?? overrides.desc ?? entry.desc ?? null;
    entry.shortDesc = mod.shortDesc ?? overrides.shortDesc ?? entry.shortDesc ?? null;

		if (mod.flags !== undefined) entry.flags = { ...entry.flags, ...mod.flags };
    if (!entry.sources) entry.sources = [SHOWDOWN_SOURCE];

    result[id] = entry;
  }

  return result;
}

function resolveItems(master: Record<string, RepoItem>, mods: ReturnType<typeof parseItems>, text: RawRecord): Record<string, RepoItem> {
  const result = { ...master };

  for (const [id, mod] of Object.entries(mods)) {
    const base = result[id] ?? { name: '', desc: null, shortDesc: null, sources: [] };
    const entry: RepoItem = mod.inherit ? { ...base } : { name: '', desc: null, shortDesc: null, isNonstandard: null, sources: [] };
    
		if (mod.name !== undefined) entry.name = mod.name;
    
		const overrides = extractTextOverrides(text[id]);
    entry.desc = mod.desc ?? overrides.desc ?? entry.desc ?? null;
    entry.shortDesc = mod.shortDesc ?? overrides.shortDesc ?? entry.shortDesc ?? null;
    
		if (mod.flags !== undefined) entry.flags = { ...entry.flags, ...mod.flags };
    if (mod.isNonstandard !== undefined) entry.isNonstandard = mod.isNonstandard;
    if (!entry.sources) entry.sources = [SHOWDOWN_SOURCE];

    result[id] = entry;
  }
  return result;
}

function parentSnapshotDir(id: string): string {
  return join(SOURCES_REGULATIONS_DIR, id, '_parent');
}

function hasParentSnapshot(id: string): boolean {
  return MOD_FILES.every((file) => existsSync(join(parentSnapshotDir(id), file)));
}

async function loadModDir(modId: string, parent?: true) {
	const MOD_DIR = join(SOURCES_REGULATIONS_DIR, modId, parent ? "_parent" : '');

  const [
		{ FormatsData }, 
		{ Learnsets }, 
		{ Moves }, 
		{ Items }, 
		{ Abilities }
	] = await Promise.all([
    import(join(MOD_DIR, 'formats-data.ts')),
		import(join(MOD_DIR, 'learnsets.ts')),
		import(join(MOD_DIR, 'moves.ts')),
		import(join(MOD_DIR, 'items.ts')),
		import(join(MOD_DIR, 'abilities.ts'))
  ]);

  return {
    formatsData: FormatsData,
    learnsets: Learnsets,
    moves: Moves,
    items: Items,
    abilities: Abilities,
  };
}

async function importMod(regulation: RegulationDefinition) {
  const mod = await loadModDir(regulation.id);

	// Not using a parent snapshot means that the regulation derives directly from
	// showdown's master base game, meaning it most likely is the current regulation.
  const useParentSnapshot = hasParentSnapshot(regulation.id);
  const inherited = useParentSnapshot
    ? await loadModDir(regulation.id, true)
    : await (async () => {
      const [
				{ FormatsData }, 
				{ Learnsets },
				{ Moves },
				{ Items },
				{ Abilities }
			] = await Promise.all([
        import('@sources/master/formats-data-main.ts'),
        import('@sources/master/learnsets-main.ts'),
				import('@sources/master/moves-main.ts'),
        import('@sources/master/items-main.ts'),
				import('@sources/master/abilities-main.ts'),
      ]);
      return { 
				formatsData: FormatsData, 
				learnsets: Learnsets, 
				moves: Moves, 
				items: Items, 
				abilities: Abilities 
			};
    })();

  /**
   * Showdown replaces a data entry unless it explicitly sets `inherit: true`.
   * A shallow merge for every entry kept old `isNonstandard` flags alive—for
   * example, Reg M-B's Raichu Mega entries remained unavailable despite their
   * replacement entries omitting that flag. (TODO: ?)
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

function makeDelta({ regulation, previous, master, mod, text }: {
	regulation: RegulationDefinition, 
	previous: ResolvedData, 
	master: ResolvedData, 
	mod: Awaited<ReturnType<typeof importMod>>, 
	text: { moves: RawRecord; abilities: RawRecord; items: RawRecord }
}): { delta: RegulationDelta; resolved: ResolvedData } {
  const roster: RegulationDelta['overrides']['roster'] = {};
  const learnsets: RegulationDelta['overrides']['learnsets'] = {};

  const legalSpecies = new Set([...parseLegalSpecies(mod.formatsData)].filter((id) => !COLLAPSED_FORMS.has(id)));
  const previouslyLegalSpecies = regulation.previousRegulationId ? previous.legalSpecies : new Set(Object.keys(previous.roster));
  
	const resolvedRoster: Record<string, RepoPokemon> = { ...previous.roster };
  const resolvedLearnsets: Record<string, RepoLearnset> = {};
  
	[...legalSpecies].forEach((id) => {
    const pokemon = previous.roster[id] || master.roster[id];
    if (!pokemon) throw new Error(`${regulation.id}: legal species "${id}" is missing from master data.`);
    
		if (!previouslyLegalSpecies.has(id)) {
      roster[id] = {};
      resolvedRoster[id] = pokemon;
    }

    const sourceId = findLearnsetId(id, pokemon, previous.roster, mod.learnsets);
    const rawLearnset = mod.learnsets[sourceId]?.learnset;

    if (!rawLearnset) throw new Error(`${regulation.id}: missing learnset for "${id}" (mapped to "${sourceId}").`);

    const learnset = { 
			moves: Object.keys(rawLearnset).sort(), 
			sources: [SHOWDOWN_SOURCE] 
		} satisfies RepoLearnset;

    resolvedLearnsets[id] = learnset;
	})

  for (const id of previouslyLegalSpecies) {
    if (!legalSpecies.has(id)) {
      roster[id] = null;
      learnsets[id] = null;
      delete resolvedRoster[id];
    }
  }

	// TODO: change learnset format to support only adding or removing moves

  // Keep master records available for a later regulation to re-add unchanged
  // resources. Availability is tracked separately by the corresponding set.
	const resolvedMoves = resolveMoves({
		master: {...previous.moves},
		mods: parseMoveMods(mod.moves),
		text: text.moves
	})

	Object.entries(resolvedLearnsets).forEach(([id, learnset]) => {
    const knownMoves = learnset.moves.filter((moveId) => resolvedMoves[moveId]);
    if (knownMoves.length !== learnset.moves.length) {
      const omitted = learnset.moves.filter((moveId) => !resolvedMoves[moveId]);
      console.warn(`${regulation.id}: omitting unknown moves from "${id}": ${omitted.join(', ')}`);
    }

    const next = { ...learnset, moves: knownMoves };
    resolvedLearnsets[id] = next;
    const learnsetDelta = diffLearnset(previous.learnsets[id], next);
    if (!previous.learnsets[id] || Object.keys(learnsetDelta).length > 0) {
			learnsets[id] = {
				...next,
				moves: learnsetDelta
			}
		};
	})

  const availableMoves = new Set(Object.values(resolvedLearnsets).flatMap((learnset) => learnset.moves));
  const moveDeltas = availabilityDelta(
    Object.fromEntries(Object.entries(previous.moves).map(([id, move]) => [id, withoutNonstandard(move)])),
    previous.availableMoves,
    Object.fromEntries(Object.entries(resolvedMoves).map(([id, move]) => [id, withoutNonstandard(move)])),
    availableMoves
  );

  const resolvedAbilities = resolveAbilities({ ...previous.abilities }, parseAbilitiesEntries(mod.abilities, text.abilities, undefined), text.abilities);
  const availableAbilities = new Set([...legalSpecies].flatMap((id) => Object.values(resolvedRoster[id]!.abilities ?? {})));
  const abilityDeltas = availabilityDelta(previous.abilities, previous.availableAbilities, resolvedAbilities, availableAbilities);

  const resolvedItems = resolveItems({ ...previous.items }, parseItems(mod.items, text.items), text.items);
  const availableItems = new Set(Object.entries(resolvedItems).filter(([, item]) => !item.isNonstandard).map(([id]) => id));
  const itemDeltas = availabilityDelta(
    Object.fromEntries(Object.entries(previous.items).map(([id, item]) => [id, withoutNonstandard(item)])),
    previous.availableItems,
    Object.fromEntries(Object.entries(resolvedItems).map(([id, item]) => [id, withoutNonstandard(item)])),
    availableItems
  );

  return {
    delta: { 
			$schema: '../../../schemas/delta.schema.json', 
			id: regulation.id, regulationName: 
			regulation.name, previousRegulationId: 
			regulation.previousRegulationId ?? null, 
			overrides: { 
				roster: roster, 
				learnsets: learnsets, 
				moves: moveDeltas, 
				abilities: abilityDeltas, 
				items: itemDeltas
			} 
		},
    resolved: { 
			roster: resolvedRoster, 
			legalSpecies, 
			learnsets: resolvedLearnsets, 
			moves: resolvedMoves, 
			availableMoves, 
			abilities: resolvedAbilities, 
			availableAbilities, 
			items: resolvedItems, 
			availableItems 
		},
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

async function main(): Promise<void> {
  const { values } = parseArgs({ 
		args: process.argv.slice(2), 
		options: { 
			'dry-run': { type: 'boolean', default: false }, 
		} 
	});

  const dryRun = Boolean(values['dry-run']);

  for (const file of MASTER_FILES) {
		if (!existsSync(join(SOURCES_MASTER_DIR, file))) {
			throw new Error(`Missing data/sources/master/${file}. Run bun run fetch-sd --base first.`);
		}
	}
	
  const regulationMap = new Map(REGULATIONS.map((entry) => [entry.id, entry]));

	Object.entries(regulationMap).forEach(([id, regulation]) => {
		for (const file of MOD_FILES) if (!existsSync(join(SOURCES_REGULATIONS_DIR, id, file))) throw new Error(`Missing ${SOURCES_REGULATIONS_DIR}/${id}/${file}. Run bun run fetch-sd first.`);
    if (regulation.showdown.sourceModId !== 'champions' && !hasParentSnapshot(id)) {
      throw new Error(`Missing contemporaneous parent snapshot at ${SOURCES_REGULATIONS_DIR}/${id}/_parent/. Run bun run fetch-sd so archived mods do not inherit the live Champions folder.`);
    }
	})

  const [
		{ Pokedex }, 
		{ Moves: rawMoves }, 
		{ MovesText }, 
		{ Items: rawItems }, 
		{ ItemsText }, 
		{ Abilities: rawAbilities }, 
		{ AbilitiesText }
	] = await Promise.all([
    import('@sources/master/pokedex.ts'), 
		import('@sources/master/moves-main.ts'), 
		import('@sources/master/moves-text.ts'), 
		import('@sources/master/items-main.ts'), 
		import('@sources/master/items-text.ts'), 
		import('@sources/master/abilities-main.ts'), 
		import('@sources/master/abilities-text.ts'),
  ]);

  const masterAbilityIds = new Map<string, string>();
	Object.entries(rawAbilities as RawRecord).forEach(([id, ability]) => {
		if (ability.name) masterAbilityIds.set(ability.name, id);
	})
  const masterParsedMoves = parseMovesMain(rawMoves as RawRecord, MovesText as RawRecord);
  const masterParsedAbilities = parseAbilitiesEntries(rawAbilities as RawRecord, AbilitiesText as RawRecord);
  const masterParsedItems = parseItems(rawItems as RawRecord, ItemsText as RawRecord);

  const master = {
		// Filters entries with dex number < 0 (CAP Pokémon)
    roster: withSources(parsePokedex(
      Object.fromEntries(Object.entries(Pokedex as RawRecord).filter(([, entry]) => Number(entry.num) > 0)),
      { nameToIdMap: masterAbilityIds, aliases: SHOWDOWN_ALIASES }
    )),

    moves: withSources(Object.fromEntries(Object.entries(masterParsedMoves).map(([id, entry]) => { 
			const { isNonstandard: _ignored, ...move } = entry; 
			return [id, move]; 
		})) as Record<string, RepoMove>),

    abilities: withSources(Object.fromEntries(Object.entries(masterParsedAbilities).map(([id, entry]) => {
			return [
				id, 
				{ 
					name: entry.name ?? '', 
					desc: entry.desc ?? null, 
					shortDesc: entry.shortDesc ?? null, 
					...(entry.flags ? { flags: entry.flags } : {}) 
				}
			]
		})) as Record<string, RepoAbility>),

    items: withSources(Object.fromEntries(Object.entries(masterParsedItems).map(([id, entry]) => {
			return [
				id, 
				{ 
					name: entry.name ?? '', 
					desc: entry.desc ?? null, 
					shortDesc: entry.shortDesc ?? null, 
					...(entry.flags ? { flags: entry.flags } : {}), 
					isNonstandard: entry.isNonstandard ?? null 
				}
			]
		})) as Record<string, RepoItem>),
  };

  console.log('Writing unfiltered master data...');
  writeJson(join(DATA_MASTER_DIR, 'roster.json'), sorted(master.roster), dryRun);
  writeJson(join(DATA_MASTER_DIR, 'moves.json'), sorted(master.moves), dryRun);
  writeJson(join(DATA_MASTER_DIR, 'abilities.json'), sorted(master.abilities), dryRun);
  writeJson(join(DATA_MASTER_DIR, 'items.json'), sorted(Object.fromEntries(Object.entries(master.items).map(([id, item]) => [id, withoutNonstandard(item)]))), dryRun);
  
	const masterResolved: ResolvedData = {
    roster: master.roster,
    legalSpecies: new Set(),
    learnsets: {},
    moves: withSources(masterParsedMoves),
    availableMoves: new Set(Object.keys(masterParsedMoves)),
    abilities: master.abilities,
    availableAbilities: new Set(Object.keys(master.abilities)),
    items: master.items,
    availableItems: new Set(Object.keys(master.items)),
  };

  const resolvedRegulations = new Map<string, ResolvedData>();
  const generatedRegulations = new Set<string>();
  const generatingRegulations = new Set<string>();

  async function generateRegulation(regulation: RegulationDefinition): Promise<void> {
    if (generatedRegulations.has(regulation.id)) return;
    if (generatingRegulations.has(regulation.id)) {
      throw new Error(`Circular regulation base detected at "${regulation.id}".`);
    }
    generatingRegulations.add(regulation.id);

    let base = masterResolved;
    if (regulation.previousRegulationId) {
      const previousRegulation = getRegulation(regulation.previousRegulationId);
			
			if (regulationMap.has(previousRegulation.id)) await generateRegulation(previousRegulation);
      base = resolvedRegulations.get(regulation.previousRegulationId) ?? base;
    }

    console.log(`Generating ${regulation.id} delta...`);

    const deltaPath = join(DATA_REGULATIONS_DIR, regulation.id, 'delta.json');
		const generated = makeDelta({
			regulation,
			mod: await importMod(regulation),
			previous: base,
			master: masterResolved,
			text: { moves: MovesText as RawRecord, abilities: AbilitiesText as RawRecord, items: ItemsText as RawRecord },
		});

    writeJson(deltaPath, preserveCustomDeltaValues(generated.delta, deltaPath), dryRun);
    resolvedRegulations.set(regulation.id, generated.resolved);
    generatedRegulations.add(regulation.id);
    generatingRegulations.delete(regulation.id);
  }

  for (const reg of REGULATIONS) await generateRegulation(reg);
}

main().catch((error) => {
  console.error(`\nFATAL ERROR during update: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

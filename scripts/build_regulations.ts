#!/usr/bin/env bun
/** Compiles master data plus a regulation delta into consumer-ready JSON. */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import type {
  RegulationDelta,
  RepoAbility,
  RepoItem,
  RepoLearnset,
  RepoMove,
  RepoPokemon,
} from './showdown_parser.ts';
import { getRegulationChain, REGULATIONS, type RegulationDefinition } from './regulations.ts';

const ROOT_DIR = resolve(import.meta.dir, '..');
const MASTER_DIR = join(ROOT_DIR, 'data', 'master');
const DIST_DIR = join(ROOT_DIR, 'dist');

type JsonRecord = Record<string, any>;

function loadJson<T>(path: string): T {
  if (!existsSync(path)) throw new Error(`Missing ${path.slice(ROOT_DIR.length + 1)}. Run the Showdown updater first.`);
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

function writeJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  console.log(`  wrote ${path.slice(ROOT_DIR.length + 1)}`);
}

function sorted<T>(data: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
}

function isPlainObject(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** `baseStats` is the sole nested merge field; all other values replace. */
function applyOverride<T extends object>(base: T, override: Partial<T>): T {
  const baseValues = base as JsonRecord;
  const resolved: JsonRecord = { ...baseValues };
  for (const [key, value] of Object.entries(override)) {
    if (key === 'sources' && Array.isArray(baseValues[key]) && Array.isArray(value)) {
      resolved[key] = [...new Set([...baseValues[key], ...value])];
    } else {
      resolved[key] = key === 'baseStats' && isPlainObject(baseValues[key]) && isPlainObject(value)
        ? { ...baseValues[key], ...value }
        : value;
    }
  }
  return resolved as T;
}

function applyResource<T extends object>(current: Record<string, T>, overrides: Record<string, Partial<T> | null>, master: Record<string, T>): Record<string, T> {
  const output: Record<string, T> = { ...current };
  for (const [id, override] of Object.entries(overrides)) {
    if (override === null) {
      delete output[id];
      continue;
    }
    const base = output[id] ?? master[id];
    if (!base) throw new Error(`Resource override "${id}" is absent from master data.`);
    output[id] = applyOverride(base, override);
  }
  return sorted(output);
}

function selectEntries<T>(data: Record<string, T>, ids: Iterable<string>): Record<string, T> {
  const selected: Record<string, T> = {};
  for (const id of ids) {
    if (!data[id]) throw new Error(`Referenced resource "${id}" is absent from its resolved collection.`);
    selected[id] = data[id];
  }
  return sorted(selected);
}

function compile(regulation: RegulationDefinition): void {
  const masterRoster = loadJson<Record<string, RepoPokemon>>(join(MASTER_DIR, 'roster.json'));
  const masterMoves = loadJson<Record<string, RepoMove>>(join(MASTER_DIR, 'moves.json'));
  const masterAbilities = loadJson<Record<string, RepoAbility>>(join(MASTER_DIR, 'abilities.json'));
  const masterItems = loadJson<Record<string, RepoItem>>(join(MASTER_DIR, 'items.json'));

  const layers = getRegulationChain(regulation.regulationId).map((layer) => {
    const delta = loadJson<RegulationDelta>(join(ROOT_DIR, 'data', layer.directoryName, 'delta.json'));
    if (delta.regulationId !== layer.regulationId) {
      throw new Error(`${layer.directoryName}/delta.json has regulationId "${delta.regulationId}"; expected "${layer.regulationId}".`);
    }
    if (delta.baseRegulationId !== (layer.baseRegulationId ?? null)) {
      throw new Error(`${layer.directoryName}/delta.json has baseRegulationId "${delta.baseRegulationId}"; expected "${layer.baseRegulationId ?? null}".`);
    }
    return delta;
  });

  let resolvedRoster: Record<string, RepoPokemon> = { ...masterRoster };
  let resolvedLearnsets: Record<string, RepoLearnset> = {};
  let resolvedMoves = { ...masterMoves };
  let resolvedAbilities = { ...masterAbilities };
  let resolvedItems = { ...masterItems };
  for (const layer of layers) {
    for (const [id, override] of Object.entries(layer.overrides.roster)) {
      if (override === null) {
        delete resolvedRoster[id];
        continue;
      }
      const base = resolvedRoster[id] ?? masterRoster[id];
      if (!base) throw new Error(`${layer.regulationId}: roster override "${id}" is absent from master/roster.json.`);
      resolvedRoster[id] = applyOverride(base, override);
    }
    for (const [id, override] of Object.entries(layer.overrides.learnsets)) {
      if (override === null) {
        delete resolvedLearnsets[id];
        continue;
      }
      const base = resolvedLearnsets[id] ?? ({} as RepoLearnset);
      resolvedLearnsets[id] = applyOverride(base, override);
    }
    resolvedMoves = applyResource(resolvedMoves, layer.overrides.moves, masterMoves);
    resolvedAbilities = applyResource(resolvedAbilities, layer.overrides.abilities, masterAbilities);
    resolvedItems = applyResource(resolvedItems, layer.overrides.items, masterItems);

  }

  const roster = sorted(resolvedRoster);
  if (Object.keys(roster).length === 0) throw new Error(`${regulation.regulationId}: roster overrides must list every legal species.`);

  const learnsets: Record<string, RepoLearnset> = {};
  for (const id of Object.keys(roster)) {
    const learnset = resolvedLearnsets[id];
    if (!learnset) throw new Error(`${regulation.regulationId}: legal species "${id}" has no regulation learnset.`);
    learnsets[id] = learnset;
  }

  const legalMoveIds = new Set(Object.values(learnsets).flatMap((learnset) => learnset.moves));
  const legalAbilityIds = new Set(Object.values(roster).flatMap((pokemon) => Object.values(pokemon.abilities ?? {})));

  const outputDirectory = join(DIST_DIR, regulation.directoryName);
  console.log(`Building ${regulation.regulationId}...`);
  writeJson(join(outputDirectory, 'roster.json'), sorted(roster));
  writeJson(join(outputDirectory, 'learnsets.json'), sorted(learnsets));
  writeJson(join(outputDirectory, 'moves.json'), selectEntries(resolvedMoves, legalMoveIds));
  writeJson(join(outputDirectory, 'abilities.json'), selectEntries(resolvedAbilities, legalAbilityIds));
  writeJson(join(outputDirectory, 'items.json'), sorted(resolvedItems));
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { regulation: { type: 'string' }, all: { type: 'boolean', default: false } },
  });
  const selected = values.regulation
    ? REGULATIONS.filter((regulation) => regulation.regulationId === values.regulation || regulation.directoryName === values.regulation)
    : REGULATIONS;
  if (values.regulation && selected.length === 0) throw new Error(`Unknown regulation "${values.regulation}".`);
  if (!values.all && !values.regulation) console.log('Building all configured regulations...');
  for (const regulation of selected) compile(regulation);
}

try {
  main();
} catch (error) {
  console.error(`\nFATAL ERROR during regulation build: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
}

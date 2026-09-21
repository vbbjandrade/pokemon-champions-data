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
} from '../utils/showdown_parser.ts';
import { getRegulationChain, REGULATIONS, type RegulationDefinition } from '../utils/regulations.ts';
import { loadJson, sorted, writeJson } from '../utils/helpers.ts';
import { DATA_MASTER_DIR, DATA_REGULATIONS_DIR } from '../utils/directories.ts';

const ROOT_DIR = resolve(import.meta.dir, '..');
const MASTER_DIR = join(ROOT_DIR, 'data', 'master');
const DIST_DIR = join(ROOT_DIR, 'dist');

type JsonRecord = Record<string, any>;

function applyOverride<T extends object>(base: T, override: Partial<T>): T {
  const baseValues = base as JsonRecord;
  const resolved: JsonRecord = { ...baseValues };
  for (const [key, value] of Object.entries(override)) {
    if (key === 'sources' && Array.isArray(baseValues[key]) && Array.isArray(value)) {
      resolved[key] = [...new Set([...baseValues[key], ...value])];
    } else {
      resolved[key] = value;
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
  const masterRoster = loadJson<Record<string, RepoPokemon>>(join(DATA_MASTER_DIR, 'roster.json'));
  const masterMoves = loadJson<Record<string, RepoMove>>(join(DATA_MASTER_DIR, 'moves.json'));
  const masterAbilities = loadJson<Record<string, RepoAbility>>(join(DATA_MASTER_DIR, 'abilities.json'));
  const masterItems = loadJson<Record<string, RepoItem>>(join(DATA_MASTER_DIR, 'items.json'));

  let resolvedRoster: Record<string, RepoPokemon> = { ...masterRoster };
  let resolvedLearnsets: Record<string, RepoLearnset> = {};
  let resolvedMoves = { ...masterMoves };
  let resolvedAbilities = { ...masterAbilities };
  let resolvedItems = { ...masterItems };

	const layers = getRegulationChain(regulation.id).map((layer) => {
    const delta = loadJson<RegulationDelta>(join(DATA_REGULATIONS_DIR, layer.id, 'delta.json'));
    if (delta.id !== layer.id) {
      throw new Error(`${layer.id}/delta.json has id "${delta.id}"; expected "${layer.id}".`);
    }
    if (delta.previousRegulationId !== (layer.previousRegulationId ?? null)) {
      throw new Error(`${layer.id}/delta.json has previousRegulationId "${delta.previousRegulationId}"; expected "${layer.previousRegulationId ?? null}".`);
    }
    return delta;
  });

  for (const layer of layers) {
    for (const [id, override] of Object.entries(layer.overrides.roster)) {
      if (override === null) {
        delete resolvedRoster[id];
        continue;
      }
      const base = resolvedRoster[id] ?? masterRoster[id];
      if (!base) throw new Error(`${layer.id}: roster override "${id}" is absent from master/roster.json.`);
      resolvedRoster[id] = applyOverride(base, override);
    }

		Object.entries(layer.overrides.learnsets).forEach(([id, override]) => {
			console.log(`${layer.id} | learnset override for ${id}`, override)

      if (override === null) {
        delete resolvedLearnsets[id];
        return;
      }

      const base = resolvedLearnsets[id] || { moves: [], sources: [] };
			const newMoves: string[] = [...base.moves]

			Object.entries(override.moves).forEach(([id, operation]) => {
				const moveIndex = newMoves.findIndex((move) => move === id)

				if (operation === true) {
					if (moveIndex < 0) newMoves.push(id)
				} else {
					if (moveIndex >= 0) newMoves.splice(moveIndex, 1)
				}

			})

			const newLearnset: RepoLearnset = {
				sources: [...base.sources, ...override.sources],
				moves: newMoves
			}

			// console.log(`${id}`, newLearnset)

			override.moves
      resolvedLearnsets[id] = applyOverride(base, newLearnset);
		})

    resolvedMoves = applyResource(resolvedMoves, layer.overrides.moves, masterMoves);
    resolvedAbilities = applyResource(resolvedAbilities, layer.overrides.abilities, masterAbilities);
    resolvedItems = applyResource(resolvedItems, layer.overrides.items, masterItems);
  }

  const roster = sorted(resolvedRoster);
  if (Object.keys(roster).length === 0) throw new Error(`${regulation.id}: roster overrides must list every legal species.`);

  const learnsets: Record<string, RepoLearnset> = {};
  for (const id of Object.keys(roster)) {
    const learnset = resolvedLearnsets[id];
    if (!learnset) throw new Error(`${regulation.id}: legal species "${id}" has no regulation learnset.`);
    learnsets[id] = learnset;
  }

  const omittedMoveIds = new Set<string>();
  for (const [id, learnset] of Object.entries(learnsets)) {
    const knownMoves = learnset.moves.filter((moveId) => resolvedMoves[moveId]);
    for (const moveId of learnset.moves) if (!resolvedMoves[moveId]) omittedMoveIds.add(moveId);
    learnsets[id] = { ...learnset, moves: knownMoves };
  }
  if (omittedMoveIds.size > 0) {
    console.warn(`${regulation.id}: omitting unknown moves from compiled learnsets: ${[...omittedMoveIds].sort().join(', ')}`);
  }
  const legalMoveIds = new Set(Object.values(learnsets).flatMap((learnset) => learnset.moves));
  const legalAbilityIds = new Set(Object.values(roster).flatMap((pokemon) => Object.values(pokemon.abilities ?? {})));

  const outputDirectory = join(DIST_DIR, regulation.id);
  console.log(`Building ${regulation.id}...`);
  writeJson(join(outputDirectory, 'roster.json'), sorted(roster));
  writeJson(join(outputDirectory, 'learnsets.json'), sorted(learnsets));
  writeJson(join(outputDirectory, 'moves.json'), selectEntries(resolvedMoves, legalMoveIds));
  writeJson(join(outputDirectory, 'abilities.json'), selectEntries(resolvedAbilities, legalAbilityIds));
  writeJson(join(outputDirectory, 'items.json'), sorted(resolvedItems));
	// TODO: output .json and .md files from /data/mechanics to /dist
}

function main(): void {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: { regulation: { type: 'string' }, all: { type: 'boolean', default: false } },
  });
  const selected = values.regulation
    ? REGULATIONS.filter((regulation) => regulation.id === values.regulation || regulation.id === values.regulation)
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

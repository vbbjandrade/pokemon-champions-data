#!/usr/bin/env bun
/**
 * Downloads data update sources from smogon/pokemon-showdown into `data/sources/`.
 * Driven automatically by regulations metadata in `scripts/regulations.ts`.
 *
 * By default, only regulation mod overlays are fetched. Base game files
 * (pokedex, moves, items, abilities, learnsets, text) are pinned in
 * SHOWDOWN_BASE_CONFIG and only downloaded when explicitly requested
 * with --base or --all.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';

import {
	REGULATIONS,
  SHOWDOWN_BASE_CONFIG,
  getRegulation,
	type RegulationDefinition,
} from '../../utils/regulations.ts';
import { SOURCES_MASTER_DIR, ROOT_DIR, SOURCES_REGULATIONS_DIR } from '../../utils/directories.ts';

const MAIN_FILES: Array<{ remote: string; local: string }> = [
  { remote: 'pokedex.ts', local: 'pokedex.ts' },
  { remote: 'moves.ts', local: 'moves-main.ts' },
  { remote: 'items.ts', local: 'items-main.ts' },
  { remote: 'abilities.ts', local: 'abilities-main.ts' },
  { remote: 'formats-data.ts', local: 'formats-data-main.ts' },
  { remote: 'learnsets.ts', local: 'learnsets-main.ts' },
  { remote: 'text/abilities.ts', local: 'abilities-text.ts' },
  { remote: 'text/moves.ts', local: 'moves-text.ts' },
  { remote: 'text/items.ts', local: 'items-text.ts' },
];

const MOD_RESOURCES = ['formats-data', 'learnsets', 'items', 'moves', 'abilities'] as const;
/** Historical Champions mods overlay this live Showdown folder at the same commit. */
const SHOWDOWN_LIVE_MOD_ID = 'champions';

function formatHeader(remoteUrl: string, showdownRef: string, fetchedAt: string): string {
  return `// @ts-nocheck
/**
 * Auto-generated source snapshot from smogon/pokemon-showdown.
 * Do not edit directly; run 'bun run fetch-sd' to regenerate.
 *
 * Git Ref:    ${showdownRef}
 * Raw Remote URL: ${remoteUrl}
 * Fetched At: ${fetchedAt}
 * Commit Tree URL:	https://github.com/smogon/pokemon-showdown/tree/${showdownRef}
 */
`;
}

function emptyOverlay(resource: (typeof MOD_RESOURCES)[number], sourceModId: string, fetchedAt: string): string {
  const header = `// @ts-nocheck
/**
 * Empty overlay for mod: "${sourceModId}" (no direct overrides in upstream source).
 * Generated At: ${fetchedAt}
 */
`;
  switch (resource) {
    case 'formats-data':
      return `${header}export const FormatsData = {};\n`;
    case 'learnsets':
      return `${header}export const Learnsets = {};\n`;
    case 'moves':
      return `${header}export const Moves = {};\n`;
    case 'items':
      return `${header}export const Items = {};\n`;
    case 'abilities':
      return `${header}export const Abilities = {};\n`;
  }
}

async function fetchFile(
  url: string,
  showdownRef: string,
  fetchedAt: string
): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, status: response.status, text: '' };
    let raw = await response.text();
    // Strip existing header or ts-nocheck comments if already present
    raw = raw.replace(/^\/\/ @ts-nocheck\s*\n?/, '');
    const text = `${formatHeader(url, showdownRef, fetchedAt)}\n${raw}`;
    return { ok: true, status: response.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: String(error) };
  }
}

function writeFile(path: string, content: string, dryRun: boolean): string {
  const relPath = path.slice(ROOT_DIR.length + 1);
  if (dryRun) {
    console.log(`  [dry-run] would write ${relPath}`);
    return relPath;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`  wrote ${relPath}`);
  return relPath;
}

function needsParentSnapshot(sourceModId: string): boolean {
  return sourceModId !== SHOWDOWN_LIVE_MOD_ID;
}

async function fetchModOverlay(
  sourceModId: string,
  destDir: string,
  modRef: string,
  fetchedAt: string,
  dryRun: boolean
) {
	// TODO: add key-value conflict verification. Add conflicts to log file and abort.
  const modBaseUrl = `https://raw.githubusercontent.com/${SHOWDOWN_BASE_CONFIG.repo}/${modRef}/data`;
  for (const resource of MOD_RESOURCES) {
    const url = `${modBaseUrl}/mods/${sourceModId}/${resource}.ts`;
    const result = await fetchFile(url, modRef, fetchedAt);
    const destPath = join(destDir, `${resource}.ts`);
    if (result.ok) {
      writeFile(destPath, result.text, dryRun);
    } else {
      console.log(`  INFO: ${sourceModId}/${resource}.ts has no direct override; generating empty overlay.`);
      writeFile(destPath, emptyOverlay(resource, sourceModId, fetchedAt), dryRun);
    }
  }
}

async function fetchModResources(modRef: string, mod: RegulationDefinition, fetchedAt: string, dryRun: boolean) {
	const destDir = join(SOURCES_REGULATIONS_DIR, mod.id);

	console.log(`Fetching mod overlays for ${mod.name} (Showdown mod: "${mod}", ref: ${modRef})...`);
	await fetchModOverlay(mod.showdown.sourceModId, destDir, modRef, fetchedAt, dryRun);

	if (needsParentSnapshot(mod.showdown.sourceModId)) {
		console.log(`Fetching contemporaneous parent "${SHOWDOWN_LIVE_MOD_ID}" for ${mod.name} into _parent/ (ref: ${modRef})...`);
		await fetchModOverlay(SHOWDOWN_LIVE_MOD_ID, join(destDir, '_parent'), modRef, fetchedAt, dryRun);
	}
}

const HELP_TEXT = `Usage: bun run fetch-sd [regulation] [options]

Downloads Showdown source data into data/sources/.

Legacy Showdown mods (those not in data/mods/champions/ folder at the specified ref) 
also download data/mods/champions/ from the same ref into data/sources/<id>/_parent/.

Options:
  -r, --regulation <id>  Fetch specified target regulation.
      --ref <sha|branch> Override Showdown git ref/commit SHA for regulation mod overlays.
  -b  --base             Fetch base game files using SHOWDOWN_BASE_CONFIG ref. Without this flag, base files are never touched.
      --base-ref <ref>   Fetch base game files using a specific ref instead of the configured SHOWDOWN_BASE_CONFIG.ref.
      --all              Fetch both base game files and regulation mod overlays.
      --dry-run          Simulate downloading and inspect outputs without writing to disk.
  -h, --help             Show this help message.

Examples:
  bun run fetch-sd -r m-a            			# Fetch M-A mod at its REGULATIONS's entry ref
  bun run fetch-sd -r m-a --ref 10f47c9		# Fetch M-A mod at a specific ref
  bun run fetch-sd --base             		# Fetch base game files at SHOWDOWN_BASE_CONFIG's ref
  bun run fetch-sd --base-ref abc123  		# Fetch base game files at a specific ref
  bun run fetch-sd --all              		# Fetch base files + mods at their default refs
  bun run fetch-sd --dry-run          		# Preview fetch without modifying any files
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      regulation: { type: 'string', short: 'r' },
      ref: { type: 'string' },
      base: { type: 'boolean', default: false },
      'base-ref': { type: 'string' },
      all: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  const dryRun = Boolean(values['dry-run']);
	const fetchAll = Boolean(values.all)
  const fetchBase = fetchAll || Boolean(values.base) || Boolean(values['base-ref']);

	// Resolve target regulation
  const regQuery = values.regulation;
  const targetMods = (fetchAll && REGULATIONS) || (!!regQuery && getRegulation(regQuery));

  // Resolve Showdown git refs
  const baseRef = values['base-ref'] ?? SHOWDOWN_BASE_CONFIG.ref;
  const baseUrl = `https://raw.githubusercontent.com/${SHOWDOWN_BASE_CONFIG.repo}/${baseRef}/data`;
  const fetchedAt = new Date().toISOString();
  const writtenFiles: string[] = [];

  console.log('--- Showdown Source Fetcher ---');
  if (targetMods) {
		if (Array.isArray(targetMods)) {
			console.log(`Target Mods:   `);
			targetMods.forEach((mod) => console.log(`${mod.name} (${mod.id})`))
		} else {
			console.log(`Target Mods:   ${targetMods.name} (${targetMods.id})`);
		}
	} else {
		console.log(`Target Mods:		none (not requested — use --regulation or --all)`);
	}
  console.log(`Base Game Ref:		${baseRef} (${fetchBase ? 'fetching' : 'not requested — use --base or --all'})`);
  console.log(`Fetched Timestamp:	${fetchedAt}`);
  console.log('-------------------------------\n');

  // 1. Fetch base game files (only when explicitly requested)
  if (fetchBase) {
    console.log(`Fetching base game data from ref: ${baseRef} (pinned in SHOWDOWN_BASE_CONFIG)...`);
    for (const { remote, local } of MAIN_FILES) {
      const url = `${baseUrl}/${remote}`;
      const result = await fetchFile(url, baseRef, fetchedAt);
      if (!result.ok) {
        throw new Error(`Failed to fetch ${url} (HTTP ${result.status})`);
      }
      const baseFiles = writeFile(join(SOURCES_MASTER_DIR, local), result.text, dryRun);
      writtenFiles.push(baseFiles);
    }
  }

  // 2. Fetch regulation mod overlays (default behavior)
  if (targetMods) {
		let modRef
		if (Array.isArray(targetMods)) {
			targetMods.forEach(mod => {
				modRef = values.ref ?? mod.showdown.ref;
				fetchModResources(modRef, mod, fetchedAt, dryRun);
			})
		} else {
			modRef = values.ref ?? targetMods.showdown.ref;
			fetchModResources(modRef, targetMods, fetchedAt, dryRun);
		}
  }

  console.log('\nFetch completed successfully!');
}

main().catch((error) => {
  console.error(`\nFATAL ERROR during Showdown fetch: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

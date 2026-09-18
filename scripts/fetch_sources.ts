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
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  SHOWDOWN_BASE_CONFIG,
  findRegulation,
  getLatestRegulation,
  getRegulation,
  type RegulationDefinition,
} from './regulations.ts';

const ROOT_DIR = resolve(import.meta.dir, '..');
const SOURCES_DIR = join(ROOT_DIR, 'data', 'sources');

type ManifestEntry = {
  regulationId: string;
  regulationName: string;
  sourceModId: string;
  ref: string;
  historyUrl?: string;
};

type FetchManifest = {
  showdownRepo: string;
  baseRef: string;
  fetchedAt: string;
  targetRegulation: string;
  baseFetched: boolean;
  regulations: ManifestEntry[];
  files: string[];
};

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

function formatHeader(remoteUrl: string, showdownRef: string, fetchedAt: string): string {
  return `// @ts-nocheck
/**
 * Auto-generated source snapshot from smogon/pokemon-showdown.
 * Do not edit directly; run 'bun run fetch-sd' to regenerate.
 *
 * Remote URL: ${remoteUrl}
 * Git Ref:    ${showdownRef}
 * Fetched At: ${fetchedAt}
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

const HELP_TEXT = `Usage: bun run fetch-sd [regulation] [options]

Downloads Showdown source data into data/sources/.

By default, only regulation mod overlay files are fetched. Base game files
(pokedex, moves, items, abilities, learnsets, text) are pinned to the ref
configured in SHOWDOWN_BASE_CONFIG (scripts/regulations.ts) and are only
downloaded when explicitly requested with --base or --all.

Arguments:
  [regulation]           Target regulation ID (e.g. championsregmc) or folder (e.g. regm-c).
                         Defaults to the latest regulation in scripts/regulations.ts.

Options:
  -r, --regulation <id>  Same as positional argument: specify target regulation.
  -p, --previous <id>    Override preceding regulation.
                         Defaults to target's baseRegulationId from scripts/regulations.ts.
      --ref <sha|branch> Override Showdown git ref/commit SHA for regulation mod overlays.
      --base             Fetch base game files using SHOWDOWN_BASE_CONFIG ref.
                         Without this flag, base files are never touched.
      --base-ref <ref>   Fetch base game files using a custom ref instead of the
                         configured SHOWDOWN_BASE_CONFIG.ref.
      --all              Fetch both base game files and regulation mod overlays.
      --dry-run          Simulate downloading and inspect outputs without writing to disk.
  -h, --help             Show this help message.

Examples:
  bun run fetch-sd                    # Fetch latest regulation mods only
  bun run fetch-sd regm-a             # Fetch Reg M-A mods from its pinned commit
  bun run fetch-sd --base             # Update base game files to configured ref
  bun run fetch-sd --base-ref abc123  # Update base game files to a specific commit
  bun run fetch-sd --all              # Fetch base files + latest regulation mods
  bun run fetch-sd --all regm-b       # Fetch base files + Reg M-B mods
  bun run fetch-sd --ref 10f47c9      # Fetch using a custom Showdown commit for mods
  bun run fetch-sd --dry-run          # Preview fetch without modifying any files
`;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      regulation: { type: 'string', short: 'r' },
      previous: { type: 'string', short: 'p' },
      ref: { type: 'string' },
      base: { type: 'boolean', default: false },
      'base-ref': { type: 'string' },
      all: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(HELP_TEXT);
    return;
  }

  const dryRun = Boolean(values['dry-run']);
  const fetchBase = Boolean(values.base) || Boolean(values['base-ref']) || Boolean(values.all);
  const fetchMods = !values.base || Boolean(values.all);
  // If --base is passed alone (without --all), skip mods.
  // If --all is passed, fetch both. If neither, fetch only mods.

  // Resolve target regulation (defaults to latest configured regulation, i.e. REGULATIONS[0])
  const regQuery = values.regulation ?? positionals[0] ?? process.env.SHOWDOWN_CURRENT_REGULATION;
  const targetReg: RegulationDefinition = regQuery
    ? (findRegulation(regQuery) ?? getRegulation(regQuery))
    : getLatestRegulation();

  // Resolve previous regulation (defaults automatically to target's baseRegulationId)
  const prevQuery = values.previous ?? process.env.SHOWDOWN_PREVIOUS_REGULATION ?? targetReg.baseRegulationId;
  const prevReg: RegulationDefinition | undefined = prevQuery ? (findRegulation(prevQuery) ?? getRegulation(prevQuery)) : undefined;

  // Resolve Showdown git refs
  const baseRef = values['base-ref'] ?? SHOWDOWN_BASE_CONFIG.ref;
  const baseUrl = `https://raw.githubusercontent.com/${SHOWDOWN_BASE_CONFIG.repo}/${baseRef}/data`;
  const fetchedAt = new Date().toISOString();
  const writtenFiles: string[] = [];

  console.log('--- Showdown Source Fetcher ---');
  console.log(`Target Regulation:   ${targetReg.regulationName} (${targetReg.regulationId})`);
  if (prevReg) {
    console.log(`Previous Regulation: ${prevReg.regulationName} (${prevReg.regulationId}) [auto-resolved from base]`);
  } else {
    console.log(`Previous Regulation: None (root base)`);
  }
  console.log(`Base Game Ref:       ${baseRef} (${fetchBase ? 'fetching' : 'not requested — use --base or --all'})`);
  console.log(`Fetched Timestamp:   ${fetchedAt}`);
  if (targetReg.showdown?.historyUrl) {
    console.log(`Mod Commit History:  ${targetReg.showdown.historyUrl}`);
  }
  console.log('--------------------------------\n');

  // 1. Fetch base game files (only when explicitly requested)
  if (fetchBase) {
    console.log(`Fetching base game data from ref: ${baseRef} (pinned in SHOWDOWN_BASE_CONFIG)...`);
    for (const { remote, local } of MAIN_FILES) {
      const url = `${baseUrl}/${remote}`;
      const result = await fetchFile(url, baseRef, fetchedAt);
      if (!result.ok) {
        throw new Error(`Failed to fetch ${url} (HTTP ${result.status})`);
      }
      const saved = writeFile(join(SOURCES_DIR, local), result.text, dryRun);
      writtenFiles.push(saved);
    }
  }

  // 2. Fetch regulation mod overlays (default behavior)
  const manifestEntries: ManifestEntry[] = [];

  if (fetchMods) {
    const plannedRegulations: Array<{ reg: RegulationDefinition; sourceModId: string }> = [
      {
        reg: targetReg,
        sourceModId: targetReg.showdown?.sourceModId ?? targetReg.regulationId,
      },
    ];

    if (prevReg) {
      plannedRegulations.push({
        reg: prevReg,
        sourceModId: prevReg.showdown?.sourceModId ?? prevReg.regulationId,
      });
    }

    for (const { reg, sourceModId } of plannedRegulations) {
      const modRef = values.ref ?? reg.showdown?.ref ?? 'master';
      const modBaseUrl = `https://raw.githubusercontent.com/${SHOWDOWN_BASE_CONFIG.repo}/${modRef}/data`;

      console.log(`Fetching mod overlays for ${reg.regulationName} (Showdown mod: "${sourceModId}", ref: ${modRef})...`);
      for (const resource of MOD_RESOURCES) {
        const url = `${modBaseUrl}/mods/${sourceModId}/${resource}.ts`;
        const result = await fetchFile(url, modRef, fetchedAt);
        const destPath = join(SOURCES_DIR, reg.regulationId, `${resource}.ts`);

        if (result.ok) {
          const saved = writeFile(destPath, result.text, dryRun);
          writtenFiles.push(saved);
        } else {
          console.log(`  INFO: ${sourceModId}/${resource}.ts has no direct override; generating empty overlay.`);
          const saved = writeFile(destPath, emptyOverlay(resource, sourceModId, fetchedAt), dryRun);
          writtenFiles.push(saved);
        }
      }
      manifestEntries.push({
        regulationId: reg.regulationId,
        regulationName: reg.regulationName,
        sourceModId,
        ref: modRef,
        ...(reg.showdown?.historyUrl ? { historyUrl: reg.showdown.historyUrl } : {}),
      });
    }
  }

  // 3. Write data/sources/fetch-manifest.json
  const manifest: FetchManifest = {
    showdownRepo: SHOWDOWN_BASE_CONFIG.repo,
    baseRef,
    fetchedAt,
    targetRegulation: targetReg.regulationId,
    baseFetched: fetchBase,
    regulations: manifestEntries,
    files: writtenFiles,
  };
  writeFile(join(SOURCES_DIR, 'fetch-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, dryRun);

  console.log('\nFetch completed successfully!');
}

main().catch((error) => {
  console.error(`\nFATAL ERROR during Showdown fetch: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

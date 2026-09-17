#!/usr/bin/env bun
/**
 * Downloads data update sources from smogon/pokemon-showdown into `data/sources/`.
 * Driven automatically by regulations metadata in `scripts/regulations.ts`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  findRegulation,
  getLatestRegulation,
  getRegulation,
  type RegulationDefinition,
} from './regulations.ts';

const ROOT_DIR = resolve(import.meta.dir, '..');
const SOURCES_DIR = join(ROOT_DIR, 'data', 'sources');

type ManifestEntry = {
  regulationId: string;
  sourceModId: string;
};

type FetchManifest = {
  showdownRef: string;
  regulations: ManifestEntry[];
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

function emptyOverlay(resource: (typeof MOD_RESOURCES)[number]): string {
  switch (resource) {
    case 'formats-data':
      return '// @ts-nocheck\nexport const FormatsData = {};\n';
    case 'learnsets':
      return '// @ts-nocheck\nexport const Learnsets = {};\n';
    case 'moves':
      return '// @ts-nocheck\nexport const Moves = {};\n';
    case 'items':
      return '// @ts-nocheck\nexport const Items = {};\n';
    case 'abilities':
      return '// @ts-nocheck\nexport const Abilities = {};\n';
  }
}

async function fetchFile(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, status: response.status, text: '' };
    let text = await response.text();
    if (!text.startsWith('// @ts-nocheck')) {
      text = `// @ts-nocheck\n${text}`;
    }
    return { ok: true, status: response.status, text };
  } catch (error) {
    return { ok: false, status: 0, text: String(error) };
  }
}

function writeFile(path: string, content: string, dryRun: boolean): void {
  const relPath = path.slice(ROOT_DIR.length + 1);
  if (dryRun) {
    console.log(`  [dry-run] would write ${relPath}`);
    return;
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf-8');
  console.log(`  wrote ${relPath}`);
}

/**
 * CLI Options:
 *
 * positional[0] or -r, --regulation <id>:
 *   The target regulation ID (e.g. 'championsregmc') or directory name (e.g. 'regm-c').
 *   If omitted, defaults to the latest regulation defined in `scripts/regulations.ts` (the first entry in REGULATIONS).
 *
 * -p, --previous <id>:
 *   Explicit override for the preceding regulation.
 *   If omitted, automatically resolves from the target regulation's `baseRegulationId`.
 *
 * --ref <sha|branch>:
 *   Explicit override for the Pokémon Showdown git commit SHA, branch, or tag.
 *   If omitted, uses the regulation's pinned `showdown.ref` from `scripts/regulations.ts`
 *   (or falls back to SHOWDOWN_REF environment variable or 'master').
 *
 * --dry-run:
 *   Simulates the fetch process, printing every file that would be downloaded without writing to disk.
 *
 * -h, --help:
 *   Prints detailed usage instructions and examples.
 */
async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      regulation: { type: 'string', short: 'r' },
      previous: { type: 'string', short: 'p' },
      ref: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`Usage: bun run fetch-sd [regulation] [options]

Arguments:
  [regulation]           Target regulation ID (e.g. championsregmc) or folder (e.g. regm-c).
                         Defaults to the latest regulation in scripts/regulations.ts.

Options:
  -r, --regulation <id>  Same as positional argument: specify target regulation.
  -p, --previous <id>    Override preceding regulation.
                         Defaults to target's baseRegulationId from scripts/regulations.ts.
      --ref <sha|branch> Override Showdown git ref/commit SHA.
                         Defaults to regulation's pinned ref in regulations.ts (or 'master').
      --dry-run          Simulate downloading and inspect outputs without writing to disk.
  -h, --help             Show this help message.

Examples:
  bun run fetch-sd                    # Fetch latest regulation automatically
  bun run fetch-sd regm-b             # Fetch Reg M-B using its pinned commit & auto-resolved base
  bun run fetch-sd --ref 10f47c9      # Fetch using a custom Showdown commit SHA
  bun run fetch-sd --dry-run          # Preview fetch without modifying any files
`);
    return;
  }

  const dryRun = Boolean(values['dry-run']);

  // Resolve target regulation (defaults to latest configured regulation, i.e. REGULATIONS[0])
  const regQuery = values.regulation ?? positionals[0] ?? process.env.SHOWDOWN_CURRENT_REGULATION;
  const targetReg: RegulationDefinition = regQuery
    ? (findRegulation(regQuery) ?? getRegulation(regQuery))
    : getLatestRegulation();

  // Resolve previous regulation (defaults automatically to target's baseRegulationId)
  const prevQuery = values.previous ?? process.env.SHOWDOWN_PREVIOUS_REGULATION ?? targetReg.baseRegulationId;
  const prevReg: RegulationDefinition | undefined = prevQuery ? (findRegulation(prevQuery) ?? getRegulation(prevQuery)) : undefined;

  // Resolve Showdown git ref (defaults to pinned ref in regulations.ts, or env, or 'master')
  const showdownRef = values.ref ?? targetReg.showdown?.ref ?? process.env.SHOWDOWN_REF ?? 'master';
  const baseUrl = `https://raw.githubusercontent.com/smogon/pokemon-showdown/${showdownRef}/data`;

  console.log('--- Showdown Source Fetcher ---');
  console.log(`Target Regulation:   ${targetReg.regulationName} (${targetReg.regulationId})`);
  if (prevReg) {
    console.log(`Previous Regulation: ${prevReg.regulationName} (${prevReg.regulationId}) [auto-resolved from base]`);
  } else {
    console.log(`Previous Regulation: None (root base)`);
  }
  console.log(`Showdown Ref/Commit: ${showdownRef}`);
  if (targetReg.showdown?.historyUrl) {
    console.log(`Mod Commit History:  ${targetReg.showdown.historyUrl}`);
  }
  console.log('--------------------------------\n');

  // 1. Fetch main Showdown baseline files
  console.log(`Fetching main Showdown data from ref: ${showdownRef}...`);
  for (const { remote, local } of MAIN_FILES) {
    const url = `${baseUrl}/${remote}`;
    const result = await fetchFile(url);
    if (!result.ok) {
      throw new Error(`Failed to fetch ${url} (HTTP ${result.status})`);
    }
    writeFile(join(SOURCES_DIR, local), result.text, dryRun);
  }

  // 2. Fetch regulation mod overlays
  const plannedRegulations: Array<{ reg: RegulationDefinition; sourceModId: string }> = [
    {
      reg: targetReg,
      // The current/target regulation in Showdown is typically the live 'champions' mod
      sourceModId: targetReg.showdown?.sourceModId ?? 'champions',
    },
  ];

  if (prevReg) {
    plannedRegulations.push({
      reg: prevReg,
      // Predecessor regulations use their specific folder name unless configured
      sourceModId: prevReg.showdown?.sourceModId ?? prevReg.regulationId,
    });
  }

  const manifestEntries: ManifestEntry[] = [];

  for (const { reg, sourceModId } of plannedRegulations) {
    console.log(`\nFetching mod overlays for ${reg.regulationName} (Showdown mod: "${sourceModId}")...`);
    for (const resource of MOD_RESOURCES) {
      const url = `${baseUrl}/mods/${sourceModId}/${resource}.ts`;
      const result = await fetchFile(url);
      const destPath = join(SOURCES_DIR, reg.regulationId, `${resource}.ts`);

      if (result.ok) {
        writeFile(destPath, result.text, dryRun);
      } else {
        console.log(`  INFO: ${sourceModId}/${resource}.ts has no direct override; generating empty overlay.`);
        writeFile(destPath, emptyOverlay(resource), dryRun);
      }
    }
    manifestEntries.push({ regulationId: reg.regulationId, sourceModId });
  }

  // 3. Write data/sources/fetch-manifest.json
  const manifest: FetchManifest = {
    showdownRef,
    regulations: manifestEntries,
  };
  writeFile(join(SOURCES_DIR, 'fetch-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, dryRun);

  console.log('\nFetch completed successfully!');
}

main().catch((error) => {
  console.error(`\nFATAL ERROR during Showdown fetch: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});

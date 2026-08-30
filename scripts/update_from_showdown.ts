#!/usr/bin/env bun
/**
 * Update dataset from Pokemon Showdown source files.
 *
 * Usage:
 *   bun run scripts/update_from_showdown.ts [--dry-run] [--log-file <path>]
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

import {
  extractTextOverrides,
  isDeepEqual,
  parseAbilitiesDescriptions,
  parseAbilitiesEntries,
  parseItems,
  parseLearnsets,
  parseLegalSpecies,
  parseMoveMods,
  parseMovesMain,
  parsePokedex,
  type RepoAbility,
  type RepoItem,
  type RepoLearnset,
  type RepoMove,
  type ParsedMove,
  type RepoPokemon,
  SHOWDOWN_SOURCE,
  syncCollection,
  type SyncLogEntry,
  type SyncResult,
  toID,
  type VersionInfo,
} from './showdown_parser.ts';

// ---------------------------------------------------------------------------
// Path definitions
// ---------------------------------------------------------------------------
const ROOT_DIR = resolve(import.meta.dir, '..');
const DATA_DIR = join(ROOT_DIR, 'data');
const SOURCES_DIR = join(DATA_DIR, 'sources');
const LOGS_DIR = join(ROOT_DIR, 'logs');

const REQUIRED_SOURCES = [
  'pokedex.ts',
  'champions-formats-data.ts',
  'champions-learnsets.ts',
  'moves-main.ts',
  'moves-text.ts',
  'champions-moves.ts',
  'items-main.ts',
  'items-text.ts',
  'champions-items.ts',
  'abilities-main.ts',
  'abilities-text.ts',
  'champions-abilities.ts',
];

// Forms that should be collapsed into a single entry
const COLLAPSED_FORMS = new Set([
  'aegislashblade', // Form change only happens during battle
  'castformrainy', 'castformsnowy', 'castformsunny', // Form change only happens during battle
  'meowsticf', // Only Meowstic M is allowed as of Reg M-B
]);

// Forms with no learnset on Showdown that should inherit moves from other entries
const LEARNSET_FALLBACKS: Record<string, string> = {
  gourgeistsmall: 'gourgeist',
  gourgeistlarge: 'gourgeist',
  gourgeistsuper: 'gourgeist',
  floettemega: 'floetteeternal',
  meowsticmmega: 'meowstic',
};

// Mapping table for Showdown forms maintained under unique names in the repository
const SHOWDOWN_ALIASES: Record<string, string> = {
  meowsticmmega: 'Mega Meowstic',
  taurospaldeacombat: 'Paldean Tauros',
};

// ---------------------------------------------------------------------------
// Logger Helper
// ---------------------------------------------------------------------------
class UpdateLogger {
  private logEntries: string[] = [];
  private logFilePath: string;

  constructor(logFilePath: string) {
    this.logFilePath = logFilePath;
  }

  log(msg: string = '') {
    console.log(msg);
    this.logEntries.push(msg);
  }

  info(msg: string) {
    this.log(`  INFO: ${msg}`);
  }

  warn(msg: string) {
    this.log(`  WARN: ${msg}`);
  }

  error(msg: string) {
    console.error(`  ERROR: ${msg}`);
    this.log(`  ERROR: ${msg}`);
  }

  addSyncLogs(logs: SyncLogEntry[]) {
    for (const entry of logs) {
      if (entry.type === 'UNCHANGED') continue;
      const prefix = `[${entry.type}] ${entry.collection}: "${entry.id}"${entry.name ? ` (${entry.name})` : ''}`;
      this.log(`  ${prefix} -> ${entry.message}`);
    }
  }

  flush(dryRun: boolean) {
    const timestamp = new Date().toISOString();
    const header = [
      `================================================================================`,
      `Pokemon Champions Data Update Log`,
      `Executed at: ${timestamp}`,
      `Dry Run: ${dryRun ? 'YES' : 'NO'}`,
      `================================================================================`,
      '',
    ].join('\n');

    const content = `${header}${this.logEntries.join('\n')}\n`;
    mkdirSync(dirname(this.logFilePath), { recursive: true });
    writeFileSync(this.logFilePath, content, 'utf-8');
    this.log(`\nLog written to ${this.logFilePath}`);
  }
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------
function loadJson<T>(relativePath: string, fallback: T): T {
  const fullPath = join(ROOT_DIR, relativePath);
  if (!existsSync(fullPath)) return fallback;
  try {
    return JSON.parse(readFileSync(fullPath, 'utf-8')) as T;
  } catch (err) {
    console.warn(`Failed to parse ${relativePath}, using fallback.`);
    return fallback;
  }
}

function saveJson(relativePath: string, data: any, dryRun: boolean, logger: UpdateLogger): void {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  const fullPath = join(ROOT_DIR, relativePath);
  if (dryRun) {
    logger.log(`  [dry-run] would write ${relativePath}`);
  } else {
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, text, 'utf-8');
    logger.log(`  wrote ${relativePath}`);
  }
}

function resolveBaseSpeciesId(sid: string, learnsetsMod: Record<string, any>): string {
  if (LEARNSET_FALLBACKS[sid]) {
    return LEARNSET_FALLBACKS[sid]!;
  }
  for (const suffix of ['megax', 'megay', 'megaz', 'mega', 'gmax']) {
    if (sid.endsWith(suffix)) {
      const baseCandidate = sid.slice(0, -suffix.length);
      if (learnsetsMod[baseCandidate]) {
        return baseCandidate;
      }
    }
  }
  return sid;
}

// ---------------------------------------------------------------------------
// Main Execution
// ---------------------------------------------------------------------------
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      'dry-run': { type: 'boolean', default: false },
      'log-file': { type: 'string', default: join(LOGS_DIR, 'update.log') },
      help: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });

  if (values.help) {
    console.log(`
Usage: bun run scripts/update_from_showdown.ts [options]

Options:
  --dry-run            Run comparison and print changes without writing JSON files
  --log-file <path>    Specify output log file (default: logs/update.log)
  --help               Display this help message
    `);
    process.exit(0);
  }

  const dryRun = Boolean(values['dry-run']);
  const logFile = values['log-file']!;
  const logger = new UpdateLogger(logFile);

  logger.log(`\n========================================================`);
  logger.log(`Pokemon Champions Data Update from Showdown Sources`);
  logger.log(`Mode: ${dryRun ? 'DRY-RUN' : 'LIVE WRITE'}`);
  logger.log(`========================================================\n`);

  // 1. Verify sources exist
  for (const file of REQUIRED_SOURCES) {
    const fullPath = join(SOURCES_DIR, file);
    if (!existsSync(fullPath)) {
      logger.error(`Missing data source: data/sources/${file}. Run scripts/fetch_sources.sh first.`);
      process.exit(1);
    }
  }

  // 2. Load existing repository JSON data
  logger.log(`Loading existing repository data...`);
  const repoRoster = loadJson<Record<string, RepoPokemon>>('data/pokemon/roster.json', {});
  const repoLearnsets = loadJson<Record<string, RepoLearnset>>('data/pokemon/learnsets.json', {});
  const repoMoves = loadJson<Record<string, RepoMove>>('data/moves/moves.json', {});
  const repoAbilities = loadJson<Record<string, RepoAbility>>('data/abilities/abilities.json', {});
  const repoItems = loadJson<Record<string, RepoItem>>('data/items/items.json', {});
  const repoVersion = loadJson<VersionInfo>('data/meta/version.json', {
    version: '1.4.0',
    lastUpdated: '',
    gameVersion: 'Pokemon Champions',
    dataFormat: 'JSON',
    sources: [],
    counts: {
      pokemon: 0,
      abilities: 0,
      items: 0,
      natures: 25,
      types: 18,
    },
    regulation: 'M-B',
  });

  // 3. Dynamically import Showdown data files
  logger.log(`Importing Showdown data modules...`);
  const { Pokedex } = await import('../data/sources/pokedex.ts');
  const { FormatsData: ChampionsFormatsData } = await import('../data/sources/champions-formats-data.ts');
  const { Learnsets: ChampionsLearnsets } = await import('../data/sources/champions-learnsets.ts');
  const { Moves: MovesMain } = await import('../data/sources/moves-main.ts');
  const { MovesText } = await import('../data/sources/moves-text.ts');
  const { Moves: ChampionsMoves } = await import('../data/sources/champions-moves.ts');
  const { Items: ItemsMain } = await import('../data/sources/items-main.ts');
  const { ItemsText } = await import('../data/sources/items-text.ts');
  const { Items: ChampionsItems } = await import('../data/sources/champions-items.ts');
  const { Abilities: AbilitiesMain } = await import('../data/sources/abilities-main.ts');
  const { AbilitiesText } = await import('../data/sources/abilities-text.ts');
  const { Abilities: ChampionsAbilities } = await import('../data/sources/champions-abilities.ts');

  // Build ability name -> ability ID lookup map
  const abilityNameToIdMap = new Map<string, string>();
  for (const [id, data] of Object.entries(AbilitiesMain as Record<string, any>)) {
    if (data?.name) abilityNameToIdMap.set(data.name, id);
  }
  for (const [id, data] of Object.entries(ChampionsAbilities as Record<string, any>)) {
    if (data?.name) abilityNameToIdMap.set(data.name, id);
  }

  // ---------------------------------------------------------------------------
  // 4. Process Roster
  // ---------------------------------------------------------------------------
  logger.log(`\n--- Processing Roster ---`);
  const legalSpecies = parseLegalSpecies(ChampionsFormatsData);
  const uniqueRosterIds = Array.from(legalSpecies).filter((id) => !COLLAPSED_FORMS.has(id));

  // Determine dex ordering matching Showdown source file sequence
  const dexOrder = Object.keys(Pokedex).filter((id) => uniqueRosterIds.includes(id));

  const missingFromDex = uniqueRosterIds.filter((id) => !(id in Pokedex));
  if (missingFromDex.length > 0) {
    logger.error(`Species missing from Showdown pokedex: ${missingFromDex.join(', ')}`);
    process.exit(1);
  }

  const rawUniqueDex: Record<string, any> = {};
  for (const id of uniqueRosterIds) {
    rawUniqueDex[id] = (Pokedex as Record<string, any>)[id];
  }

  const sdParsedDex = parsePokedex(rawUniqueDex, {
    nameToIdMap: abilityNameToIdMap,
    aliases: SHOWDOWN_ALIASES,
  });

  const syncedRoster = syncCollection('Roster', repoRoster, sdParsedDex, SHOWDOWN_SOURCE, dexOrder);
  logger.addSyncLogs(syncedRoster.logs);
  logger.info(
    `Roster summary: ${syncedRoster.stats.total} total, ${syncedRoster.stats.newCount} new, ${syncedRoster.stats.updatedCount} updated, ${syncedRoster.stats.unchangedCount} unchanged, ${syncedRoster.stats.missingCount} missing from Showdown.`
  );

  // ---------------------------------------------------------------------------
  // 5. Process Moves & Learnsets
  // ---------------------------------------------------------------------------
  logger.log(`\n--- Processing Moves & Learnsets ---`);
  const movesMainParsed = parseMovesMain(
    MovesMain as Record<string, any>,
    MovesText as Record<string, any>,
    (msg) => logger.warn(msg)
  );
  const moveModsParsed = parseMoveMods(ChampionsMoves as Record<string, any>);

  const sdChampionsMovedex: Record<string, ParsedMove> = { ...movesMainParsed };
  for (const [mid, mod] of Object.entries(moveModsParsed)) {
    const base = sdChampionsMovedex[mid] ?? {
      name: '',
      type: '',
      category: '',
      power: null,
      accuracy: null,
      pp: null,
      priority: 0,
      target: null,
      desc: null,
      shortDesc: null,
      flags: {},
      isNonstandard: null,
    };
    const merged: ParsedMove = mod.inherit ? { ...base, flags: { ...base.flags } } : { ...base, flags: {} };
    if (mod.name !== undefined) merged.name = mod.name;
    if (mod.type !== undefined) merged.type = mod.type;
    if (mod.category !== undefined) merged.category = mod.category;
    if (mod.power !== undefined) merged.power = mod.power;
    if (mod.accuracy !== undefined) merged.accuracy = mod.accuracy;
    if (mod.pp !== undefined) merged.pp = mod.pp;
    if (mod.priority !== undefined) merged.priority = mod.priority;
    if (mod.target !== undefined) merged.target = mod.target;
    if (mod.flags !== undefined) merged.flags = { ...merged.flags, ...mod.flags };

    // Check mod descriptions or text overrides (including champions specific overrides)
    const textOverrides = extractTextOverrides((MovesText as Record<string, any>)[mid]);
    merged.desc = mod.desc ?? textOverrides.desc ?? merged.desc ?? null;
    merged.shortDesc = mod.shortDesc ?? textOverrides.shortDesc ?? merged.shortDesc ?? null;

    if (mod.isNonstandard !== undefined) merged.isNonstandard = mod.isNonstandard;
    sdChampionsMovedex[mid] = merged;
  }

  // Filter legal moves in Champions
  const legalChampionsMoves: Record<string, ParsedMove> = {};
  for (const [mid, m] of Object.entries(sdChampionsMovedex)) {
    if (!m.isNonstandard) {
      legalChampionsMoves[mid] = m;
    }
  }

  const sdLearnsets: Record<string, RepoLearnset> = {};
  const usedMoves: Record<string, RepoMove> = {};

  for (const [pid, pk] of Object.entries(syncedRoster.result)) {
    const mappedSpeciesId = resolveBaseSpeciesId(pid, ChampionsLearnsets);
    const lsEntry = (ChampionsLearnsets as Record<string, any>)[mappedSpeciesId];

    if (!lsEntry || !lsEntry.learnset) {
      logger.warn(`Missing Showdown learnset for ${pid} (mapped: ${mappedSpeciesId}).`);
      continue;
    }

    const moveList = Object.keys(lsEntry.learnset).sort();
    sdLearnsets[pid] = {
      dexNumber: pk.dexNumber,
      form: pk.form,
      moves: moveList,
      source: SHOWDOWN_SOURCE,
      verified: false,
    };

    for (const mid of moveList) {
      if (!legalChampionsMoves[mid]) {
        logger.error(`Move "${mid}" used by ${pid} is missing or non-standard in movedex.`);
      } else {
        const { isNonstandard: _drop, ...moveData } = legalChampionsMoves[mid]!;
        usedMoves[mid] = moveData as RepoMove;
      }
    }
  }

  const syncedLearnsets = syncCollection(
    'Learnsets',
    repoLearnsets,
    sdLearnsets,
    SHOWDOWN_SOURCE,
    dexOrder
  );
  logger.addSyncLogs(syncedLearnsets.logs);
  logger.info(
    `Learnsets summary: ${syncedLearnsets.stats.total} total, ${syncedLearnsets.stats.newCount} new, ${syncedLearnsets.stats.updatedCount} updated, ${syncedLearnsets.stats.unchangedCount} unchanged.`
  );

  const syncedMoves = syncCollection('Moves', repoMoves, usedMoves, SHOWDOWN_SOURCE);
  logger.addSyncLogs(syncedMoves.logs);
  logger.info(
    `Moves summary: ${syncedMoves.stats.total} total, ${syncedMoves.stats.newCount} new, ${syncedMoves.stats.updatedCount} updated, ${syncedMoves.stats.unchangedCount} unchanged.`
  );

  // ---------------------------------------------------------------------------
  // 6. Process Abilities
  // ---------------------------------------------------------------------------
  logger.log(`\n--- Processing Abilities ---`);
  const abilitiesMainParsed = parseAbilitiesEntries(
    AbilitiesMain as Record<string, any>,
    AbilitiesText as Record<string, any>,
    (msg) => logger.warn(msg)
  );
  const abilitiesModParsed = parseAbilitiesEntries(
    ChampionsAbilities as Record<string, any>,
    AbilitiesText as Record<string, any>,
    (msg) => logger.warn(msg)
  );

  const sdChampionsAbilitydex: Record<string, RepoAbility> = {};
  for (const [aid, a] of Object.entries(abilitiesMainParsed)) {
    sdChampionsAbilitydex[aid] = {
      name: a.name ?? '',
      desc: a.desc ?? null,
      shortDesc: a.shortDesc ?? null,
      ...(a.flags ? { flags: a.flags } : {}),
    };
  }

  for (const [aid, mod] of Object.entries(abilitiesModParsed)) {
    const base = sdChampionsAbilitydex[aid] ?? { name: '', desc: null, shortDesc: null };
    const merged: RepoAbility = mod.inherit ? { ...base } : { name: '', desc: null, shortDesc: null };
    if (mod.name !== undefined) merged.name = mod.name;

    const textOverrides = extractTextOverrides((AbilitiesText as Record<string, any>)[aid]);
    merged.desc = mod.desc ?? textOverrides.desc ?? merged.desc ?? null;
    merged.shortDesc = mod.shortDesc ?? textOverrides.shortDesc ?? merged.shortDesc ?? null;
    if (mod.flags !== undefined) merged.flags = { ...merged.flags, ...mod.flags };

    sdChampionsAbilitydex[aid] = merged;
  }

  // Filter out nonstandard abilities
  const legalAbilities: Record<string, RepoAbility> = {};
  for (const [aid, a] of Object.entries(sdChampionsAbilitydex)) {
    legalAbilities[aid] = {
      name: a.name,
      desc: a.desc,
      shortDesc: a.shortDesc,
      ...(a.flags ? { flags: a.flags } : {}),
    };
  }

  const syncedAbilities = syncCollection('Abilities', repoAbilities, legalAbilities, SHOWDOWN_SOURCE);
  logger.addSyncLogs(syncedAbilities.logs);
  logger.info(
    `Abilities summary: ${syncedAbilities.stats.total} total, ${syncedAbilities.stats.newCount} new, ${syncedAbilities.stats.updatedCount} updated, ${syncedAbilities.stats.unchangedCount} unchanged.`
  );

  // ---------------------------------------------------------------------------
  // 7. Process Items
  // ---------------------------------------------------------------------------
  logger.log(`\n--- Processing Items ---`);
  const itemsMainParsed = parseItems(
    ItemsMain as Record<string, any>,
    ItemsText as Record<string, any>,
    (msg) => logger.warn(msg)
  );
  const itemsModParsed = parseItems(
    ChampionsItems as Record<string, any>,
    ItemsText as Record<string, any>,
    (msg) => logger.warn(msg)
  );

  const sdChampionsItemdex: Record<string, RepoItem> = {};
  for (const [iid, item] of Object.entries(itemsMainParsed)) {
    sdChampionsItemdex[iid] = {
      name: item.name ?? '',
      desc: item.desc ?? null,
      shortDesc: item.shortDesc ?? null,
      ...(item.flags ? { flags: item.flags } : {}),
      isNonstandard: item.isNonstandard ?? null,
    };
  }

  for (const [iid, mod] of Object.entries(itemsModParsed)) {
    const base = sdChampionsItemdex[iid] ?? { name: '', desc: null, shortDesc: null, isNonstandard: null };
    const merged: RepoItem = mod.inherit ? { ...base } : { name: '', desc: null, shortDesc: null, isNonstandard: null };
    if (mod.name !== undefined) merged.name = mod.name;

    const textOverrides = extractTextOverrides((ItemsText as Record<string, any>)[iid]);
    merged.desc = mod.desc ?? textOverrides.desc ?? merged.desc ?? null;
    merged.shortDesc = mod.shortDesc ?? textOverrides.shortDesc ?? merged.shortDesc ?? null;
    if (mod.flags !== undefined) merged.flags = { ...merged.flags, ...mod.flags };

    if (mod.isNonstandard !== undefined) merged.isNonstandard = mod.isNonstandard;
    sdChampionsItemdex[iid] = merged;
  }

  const legalItems: Record<string, RepoItem> = {};
  for (const [iid, item] of Object.entries(sdChampionsItemdex)) {
    if (!item.isNonstandard) {
      legalItems[iid] = {
        name: item.name,
        desc: item.desc,
        shortDesc: item.shortDesc,
        ...(item.flags ? { flags: item.flags } : {}),
      };
    }
  }

  const syncedItems = syncCollection('Items', repoItems, legalItems, SHOWDOWN_SOURCE);
  logger.addSyncLogs(syncedItems.logs);
  logger.info(
    `Items summary: ${syncedItems.stats.total} total, ${syncedItems.stats.newCount} new, ${syncedItems.stats.updatedCount} updated, ${syncedItems.stats.unchangedCount} unchanged.`
  );

  // ---------------------------------------------------------------------------
  // 8. Process Meta / Version
  // ---------------------------------------------------------------------------
  const today = new Date().toISOString().split('T')[0]!;
  const updatedVersion: VersionInfo = {
    ...repoVersion,
    lastUpdated: today,
    sources: [
      'smogon/pokemon-showdown',
    ],
    counts: {
      pokemon: Object.keys(syncedRoster.result).length,
      moves: Object.keys(syncedMoves.result).length,
      movesInChampions: Object.keys(syncedMoves.result).length,
      movesTotal: Object.keys(MovesMain).length,
      abilities: Object.keys(syncedAbilities.result).length,
      items: Object.keys(syncedItems.result).length,
      natures: repoVersion.counts?.natures ?? 25,
      types: 18,
    },
  };

  // ---------------------------------------------------------------------------
  // 9. Save Files
  // ---------------------------------------------------------------------------
  logger.log(`\n--- Writing Outputs ---`);
  saveJson('data/pokemon/roster.json', syncedRoster.result, dryRun, logger);
  saveJson('data/pokemon/learnsets.json', syncedLearnsets.result, dryRun, logger);
  saveJson('data/moves/moves.json', syncedMoves.result, dryRun, logger);
  saveJson('data/abilities/abilities.json', syncedAbilities.result, dryRun, logger);
  saveJson('data/items/items.json', syncedItems.result, dryRun, logger);
  saveJson('data/meta/version.json', updatedVersion, dryRun, logger);

  // 10. Flush Log File
  logger.flush(dryRun);

  logger.log(`\n========================================================`);
  logger.log(`Update completed successfully!`);
  logger.log(`========================================================\n`);
}

main().catch((err) => {
  console.error('\nFATAL ERROR during update:', err);
  process.exit(1);
});

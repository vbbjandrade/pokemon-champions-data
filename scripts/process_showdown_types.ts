#!/usr/bin/env bun
/**
 * process_showdown_types.ts
 *
 * Post-processes a downloaded Showdown type definition file into a
 * self-contained, importable TypeScript file by:
 *   1. Stripping all import lines
 *   2. Dropping runtime-only interfaces (MoveEventMethods, ActiveMove, etc.)
 *   3. Adding stub types for unresolvable runtime references
 *   4. Exporting MoveFlags (private in original source)
 *   5. Collapsing excess blank lines
 *
 * Usage (called by sync_showdown_types.sh):
 *   bun run scripts/process_showdown_types.ts <inputFile> <sourceUrl> <branch>
 */

import { readFileSync, writeFileSync } from 'node:fs';

const [inputFile, sourceUrl, branch] = process.argv.slice(2);
if (!inputFile || !sourceUrl || !branch) {
  console.error('Usage: bun run scripts/process_showdown_types.ts <inputFile> <sourceUrl> <branch>');
  process.exit(1);
}

const timestamp = new Date().toUTCString().replace(/GMT$/, 'UTC');

const STUBS = `\
// ---------------------------------------------------------------------------
// Stub types — replace complex Showdown runtime types with 'any' so the
// interfaces below remain importable without the rest of the codebase.
// ---------------------------------------------------------------------------
type SparseBoostsTable = Partial<Record<string, number>>;
type IDEntry = string;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type ID = string;
type StatIDExceptHP = 'atk' | 'def' | 'spa' | 'spd' | 'spe';
// EffectData must be compatible with MoveEventMethods (both allow any values)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EffectData = Record<string, any>;
type ConditionData = Record<string, unknown>;
type ModdedConditionData = Record<string, unknown>;
type ModdedEffectText = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BasicEffect = Record<string, any>;
type Ability = {
  flags?: Record<string, 1 | undefined>;
  rating?: number;
  suppressWeather?: boolean;
};
type Item = {
  fling?: { basePower: number; status?: string; volatileStatus?: string };
  isBerry?: boolean;
  isChoice?: boolean;
  isGem?: boolean;
  isPokeball?: boolean;
  isPrimalOrb?: boolean;
  ignoreKlutz?: boolean;
  megaStone?: Record<string, string>;
  onDrive?: string;
  onMemory?: string;
  onPlate?: string;
  zMove?: true | string;
  zMoveType?: string;
  zMoveFrom?: string;
  itemUser?: string[];
  forcedForme?: string;
  naturalGift?: { basePower: number; type: string };
  boosts?: SparseBoostsTable;
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;
type MoveEventMethods = Record<string, AnyFn | undefined>;
type AbilityEventMethods = Record<string, unknown>;
type PokemonEventMethods = Record<string, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Battle = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pokemon = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Side = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Field = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommonHandlers = Record<string, any>;`;

const HEADER = `\
/**
 * AUTO-GENERATED — DO NOT EDIT MANUALLY
 * Synced from: ${sourceUrl}
 * Synced at:   ${timestamp}
 * Branch:      ${branch}
 *
 * Runtime-only Showdown types (Battle, Pokemon, Side, etc.) and all import
 * statements have been removed. Stub types are provided where needed to keep
 * the interfaces we care about self-contained and importable without the full Showdown codebase.
 *
 * Use \`bash scripts/sync_showdown_types.sh\` to re-sync.
 */

${STUBS}`;

// Interfaces/types to remove entirely (runtime-only, replaced by stubs or unused)
const DROP_INTERFACES = [
  'MoveEventMethods', 'MoveHitData', 'MutableMove', 'ActiveMove',
  'AbilityEventMethods', 'PokemonEventMethods',
];

// Runtime class/function export blocks to drop
const DROP_EXPORTS = ['DexMoves', 'DataMove', 'DexAbilities', 'Ability', 'DexItems', 'Item'];

let src = readFileSync(inputFile, 'utf8');

// 1. Strip all import lines
src = src.replace(/^import\b.*\n/gm, '');

// 2. Strip specific exported class blocks using brace-counting (handles nested braces)
function stripClassBlock(source: string, className: string): string {
  const marker = new RegExp(`(?:export\\s+)?class\\s+${className}\\b`);
  const match = marker.exec(source);
  if (!match) return source;

  const start = match.index;
  let depth = 0;
  let i = start;
  let foundOpen = false;

  while (i < source.length) {
    if (source[i] === '{') { depth++; foundOpen = true; }
    else if (source[i] === '}') {
      depth--;
      if (foundOpen && depth === 0) {
        // Also consume trailing const that references this class (e.g. EMPTY_MOVE, EMPTY_ABILITY, EMPTY_ITEM)
        let end = i + 1;
        const trailingConst = /^[\s\S]*?\n(?:const|export const)\s+\w+\s*=\s*\S[^\n]*new\s+(?:DataMove|Ability|Item)[^\n]*;/m.exec(source.slice(end));
        if (trailingConst && trailingConst.index === 0) {
          end += trailingConst[0].length;
        }
        return source.slice(0, start) + source.slice(end);
      }
    }
    i++;
  }
  return source;
}

for (const name of DROP_EXPORTS) {
  src = stripClassBlock(src, name);
}

// 3. Strip non-class export of runtime classes/functions (export const, export function)
src = src.replace(/^export (class|function|const) \w[\s\S]*?(?=\nexport |\ninterface |\n\/\*\*|\n\/\/ -)/gm, '');

// 4. Drop runtime-only interface/type blocks
for (const name of DROP_INTERFACES) {
  src = src.replace(
    new RegExp(`(?:export\\s+)?(?:interface|type)\\s+${name}\\b[\\s\\S]*?(?=\\n(?:export\\s+)?(?:interface|type|\\/\\*\\*|\\/\\/\\s*--)|\n*$)`, 'g'),
    ''
  );
}

// 5. Ensure private interfaces are exported
src = src.replace(/^interface MoveFlags\b/m, 'export interface MoveFlags');
src = src.replace(/^interface AbilityFlags\b/m, 'export interface AbilityFlags');
src = src.replace(/^interface FlingData\b/m, 'export interface FlingData');

// 6. Collapse excessive blank lines
src = src.replace(/\n{3,}/g, '\n\n').trim();

const output = `${HEADER}\n\n${src}\n`;
writeFileSync('/dev/stdout', output);

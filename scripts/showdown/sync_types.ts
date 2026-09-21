#!/usr/bin/env bun
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { ROOT_DIR, TYPES_DIR } from '../../utils/directories';
import { SHOWDOWN_BASE_CONFIG } from '../../utils/regulations';

const execFile = promisify(execFileCallback);

// ---------------------------------------------------------------------------
// Path & URL Setup
// ---------------------------------------------------------------------------

const PROCESSOR = join(ROOT_DIR, 'utils', 'process_showdown_types.ts');

// Remote relative path -> Local filename
const FILES: Record<string, string> = {
  'sim/dex-moves.ts': 'dex-moves.ts',
  'sim/dex-abilities.ts': 'dex-abilities.ts',
  'sim/dex-items.ts': 'dex-items.ts',
};

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------
function parseArgs(): { branch: string } {
  const args = process.argv.slice(2);
  let branch = 'master';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--branch') {
      if (i + 1 >= args.length) {
        console.error('Error: --branch requires a value');
        process.exit(1);
      }
			// TODO: fix this
			// @ts-ignore
      branch = args[++i];
    } else {
      console.error(`Unknown argument: ${args[i]}`);
      process.exit(1);
    }
  }

  return { branch };
}

// ---------------------------------------------------------------------------
// Main Logic
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Syncing Showdown type definitions (branch: ${SHOWDOWN_BASE_CONFIG.ref})...\n`);

  await mkdir(TYPES_DIR, { recursive: true });

  for (const [remotePath, localName] of Object.entries(FILES)) {
    const url = `https://raw.githubusercontent.com/${SHOWDOWN_BASE_CONFIG.repo}/${SHOWDOWN_BASE_CONFIG.ref}/${remotePath}`;
    const destFile = join(TYPES_DIR, localName);

    console.log(`  Fetching ${remotePath}...`);

    // Fetch remote type definitions
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`  ERROR: Failed to fetch ${url} (Status: ${response.status})`);
      process.exit(1);
    }

    const content = await response.text();

    // Create isolated temp directory and write temp file
    const tempDir = await mkdtemp(join(tmpdir(), 'showdown-sync-'));
    const tempFile = join(tempDir, 'temp.ts');

    try {
      await Bun.write(tempFile, content); // Or fs.writeFile(tempFile, content)

      // Run processor script via bun and capture stdout directly to output file
      const { stdout } = await execFile('bun', ['run', PROCESSOR, tempFile, url, SHOWDOWN_BASE_CONFIG.ref]);
      await Bun.write(destFile, stdout); // Or fs.writeFile(destFile, stdout)

      console.log(`  → saved to ${TYPES_DIR}/${localName}`);
    } catch (error) {
      console.error(`  ERROR processing ${remotePath}:`, error);
      process.exit(1);
    } finally {
      // Clean up temporary files
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  console.log(`\nDone. Type definitions saved to ${TYPES_DIR}/`);
  console.log('Remember to commit the updated files if types have changed.');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
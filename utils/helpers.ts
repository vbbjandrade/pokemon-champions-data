import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative } from 'node:path';
import { ROOT_DIR } from './directories';

export function sorted<T>(data: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b)));
}

export function isPlainObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function applyOverride<T extends object>(base: T, override: Partial<T>): T {
  const baseValues = base as Record<string, any>;
  const resolved: Record<string, any> = { ...baseValues };
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

/** Reads and parses a JSON file, throwing a descriptive error if missing. */
export function loadJson<T>(path: string): T {
  if (!existsSync(path)) {
    const relPath = relative(ROOT_DIR, path);
    throw new Error(`Missing file: ${relPath}.`);
  }
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

/** Formats and writes a JSON file, with optional dry-run logging. */
export function writeJson(path: string, value: unknown, dryRun = false): void {
  const relPath = relative(ROOT_DIR, path);
  
  if (dryRun) {
    console.log(`  [dry-run] would write ${relPath}`);
    return;
  }

  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf-8');
  console.log(`  wrote ${relPath}`);
}
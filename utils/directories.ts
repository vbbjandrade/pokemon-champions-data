import { join, resolve } from 'node:path';

export const ROOT_DIR = resolve(import.meta.dir, '..');

export const DATA_DIR = join(ROOT_DIR, 'data');
export const DATA_REGULATIONS_DIR = join(DATA_DIR, 'regulations')
export const DATA_MASTER_DIR = join(DATA_DIR, 'master');

export const SOURCES_DIR = join(ROOT_DIR, 'sources');
export const SOURCES_REGULATIONS_DIR = join(SOURCES_DIR, 'regulations');
export const SOURCES_MASTER_DIR = join(SOURCES_DIR, 'master');

export const TYPES_DIR = join(SOURCES_DIR, 'types');
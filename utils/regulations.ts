/**
 * Base game Showdown snapshot configuration.
 *
 * This pins the exact ref used to fetch the main game data files (pokedex,
 * moves, items, abilities, learnsets, and text files). Update this ref
 * explicitly when you want to upgrade the base game baseline — it will never
 * be re-downloaded automatically during routine regulation fetches.
 *
 * To update base files, run: `bun run fetch-sd --base`
 */
export const SHOWDOWN_BASE_CONFIG = {
  repo: 'smogon/pokemon-showdown',
  ref: 'master',
} as const;

export interface ShowdownSourceConfig {
  /** Pinned Pokemon Showdown commit SHA, branch, or tag representing this regulation snapshot. */
  ref: string;
  /** Showdown mod folder name at the time of ref. */
  sourceModId: string;
  /** Direct link to the Showdown commit history for this mod for auditing. */
  historyUrl?: string;
}

export interface RegulationDefinition {
  id: string;
  name: string;
	gameVersion: string;
	releaseDate: string;
  /** Regulation before this one; */
  previousRegulationId: string | null;
  /** Pokemon Showdown snapshot metadata for fetching and reproducibility. */
  showdown: ShowdownSourceConfig;
}

/**
 * Our historical lineage, ordered from newest to oldest.
 *
 * This is deliberately independent from Pokemon Showdown's mod inheritance.
 * Showdown's `champions` mod is only a source snapshot; it is not a regulation
 * base in this repository.
*/
export const REGULATIONS: RegulationDefinition[] = [
  {
    id: 'm-c',
    name: 'Reg M-C',
		gameVersion: '~1.2.0',
		releaseDate: '2026-09-09',
    previousRegulationId: 'm-b',
    showdown: {
      ref: 'master',
      sourceModId: 'champions',
      historyUrl: 'https://github.com/smogon/pokemon-showdown/commits/master/data/mods/champions',
    },
  },
  {
    id: 'm-b',
    name: 'Reg M-B',
		gameVersion: '~1.1.0',
		releaseDate: '2026-06-17',
    previousRegulationId: 'm-a',
    showdown: {
      ref: 'master',
			sourceModId: 'championsregmb',
      historyUrl: 'https://github.com/smogon/pokemon-showdown/commits/master/data/mods/championsregmb',
    },
  },
  {
    id: 'm-a',
    name: 'Reg M-A',
		gameVersion: '~1.0.0',
		releaseDate: '2026-04-08',
		previousRegulationId: null,
    showdown: {
			ref: '10f47c9de12a9eb15cc3db0fab9105a1d1f7149b',
			sourceModId: 'championsregma',
      historyUrl: 'https://github.com/smogon/pokemon-showdown/commits/master/data/mods/championsregma',
    },
  },
];

export function getRegulation(id: string): RegulationDefinition {
  const regulation = REGULATIONS.find((entry) => entry.id === id);
  if (!regulation) throw new Error(`Unknown regulation "${id}".`);
  return regulation;
}

export function getRegulationChain(id: string): RegulationDefinition[] {
  const chain: RegulationDefinition[] = [];
  const visited = new Set<string>();
  let current: RegulationDefinition | null = getRegulation(id);

  while (current) {
    if (visited.has(current.id)) {
      throw new Error(`Circular regulation base detected at "${current.id}".`);
    }
    visited.add(current.id);
    chain.unshift(current);
    current = current.previousRegulationId ? getRegulation(current.previousRegulationId) : null;
  }

  return chain;
}

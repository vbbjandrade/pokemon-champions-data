export interface ShowdownSourceConfig {
  /** Pinned Pokemon Showdown commit SHA, branch, or tag representing this regulation snapshot. */
  ref: string;
  /** Showdown mod folder name if it differs from default. Defaults to 'champions' for current active mod. */
  sourceModId?: string;
  /** Direct link to the Showdown commit history for this mod for auditing. */
  historyUrl?: string;
}

export interface RegulationDefinition {
  regulationId: string;
  regulationName: string;
  directoryName: string;
  /** Regulation applied before this one; omit to build directly on master data. */
  baseRegulationId?: string;
  /** Pokemon Showdown snapshot metadata for fetching and reproducibility. */
  showdown?: ShowdownSourceConfig;
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
    regulationId: 'championsregmc',
    regulationName: 'Reg M-C',
    directoryName: 'regm-c',
    baseRegulationId: 'championsregmb',
    showdown: {
      ref: 'master',
      historyUrl: 'https://github.com/smogon/pokemon-showdown/commits/master/data/mods/champions',
    },
  },
  {
    regulationId: 'championsregmb',
    regulationName: 'Reg M-B',
    directoryName: 'regm-b',
    baseRegulationId: 'championsregma',
    showdown: {
      ref: 'master',
      historyUrl: 'https://github.com/smogon/pokemon-showdown/commits/master/data/mods/championsregmb',
    },
  },
  {
    regulationId: 'championsregma',
    regulationName: 'Reg M-A',
    directoryName: 'regm-a',
    showdown: {
      ref: '10f47c9de12a9eb15cc3db0fab9105a1d1f7149b',
      historyUrl: 'https://github.com/smogon/pokemon-showdown/commits/master/data/mods/championsregma',
    },
  },
];

export function findRegulation(query: string): RegulationDefinition | undefined {
  return REGULATIONS.find((entry) => entry.regulationId === query || entry.directoryName === query);
}

export function getLatestRegulation(): RegulationDefinition {
  const latest = REGULATIONS[0];
  if (!latest) throw new Error('No regulations configured.');
  return latest;
}

export function getRegulation(regulationId: string): RegulationDefinition {
  const regulation = findRegulation(regulationId);
  if (!regulation) throw new Error(`Unknown regulation "${regulationId}".`);
  return regulation;
}

/** Returns layers in the order they must be applied, from master outward. */
export function getRegulationChain(regulationId: string): RegulationDefinition[] {
  const chain: RegulationDefinition[] = [];
  const visited = new Set<string>();
  let current: RegulationDefinition | undefined = getRegulation(regulationId);

  while (current) {
    if (visited.has(current.regulationId)) {
      throw new Error(`Circular regulation base detected at "${current.regulationId}".`);
    }
    visited.add(current.regulationId);
    chain.unshift(current);
    current = current.baseRegulationId ? getRegulation(current.baseRegulationId) : undefined;
  }

  return chain;
}

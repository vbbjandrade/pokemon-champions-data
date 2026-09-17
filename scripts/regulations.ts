export interface RegulationDefinition {
  regulationId: string;
  regulationName: string;
  directoryName: string;
  /** Regulation applied before this one; omit to build directly on master data. */
  baseRegulationId?: string;
}

/**
 * Our historical lineage, ordered from oldest to newest.
 *
 * This is deliberately independent from Pokemon Showdown's mod inheritance.
 * Showdown's `champions` mod is only a source snapshot; it is not a regulation
 * base in this repository.
 */
export const REGULATIONS: RegulationDefinition[] = [
  {
    regulationId: 'championsregma',
    regulationName: 'Reg M-A',
    directoryName: 'regm-a',
  },
  {
    regulationId: 'championsregmb',
    regulationName: 'Reg M-B',
    directoryName: 'regm-b',
    baseRegulationId: 'championsregma',
  },
  {
    regulationId: 'championsregmc',
    regulationName: 'Reg M-C',
    directoryName: 'regm-c',
    baseRegulationId: 'championsregmb',
  },
];

export function getRegulation(regulationId: string): RegulationDefinition {
  const regulation = REGULATIONS.find((entry) => entry.regulationId === regulationId);
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

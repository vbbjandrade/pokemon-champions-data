export interface RegulationDefinition {
  regulationId: string;
  regulationName: string;
  directoryName: string;
}

/** Newest first: Showdown exposes the first entry as the `champions` mod. */
export const REGULATIONS: RegulationDefinition[] = [
  {
    regulationId: 'championsregmb',
    regulationName: 'Reg M-B',
    directoryName: 'regm-b',
  },
  {
    regulationId: 'championsregma',
    regulationName: 'Reg M-A',
    directoryName: 'regm-a',
  },
];

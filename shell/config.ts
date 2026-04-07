import type { ConceptId } from './types';

export const projectName = 'Supergroups Reimagined';

export const complexity: 'simple' | 'complex' = 'simple';

export const conceptLabels: Record<ConceptId, { name: string; hypothesis: string }> = {
  A: {
    name: 'The Transparent Machine',
    hypothesis: 'Trust comes from making the system\'s logic visible — not from hiding complexity.',
  },
  B: {
    name: 'The People Bridge',
    hypothesis: 'Start from people, not rules — bridge the conceptual gap by meeting users where they are.',
  },
  C: {
    name: 'The Conversational Co-pilot',
    hypothesis: 'Natural language is the primary interface — if the AI always shows its work.',
  },
  D: {
    name: 'The Policy Control Plane',
    hypothesis: 'Groups are policy audiences, not people lists — organize by what the group controls.',
  },
  E: {
    name: 'The Obvious Default',
    hypothesis: 'The straightforward thing, built well — flat filters, live preview, transparent layers.',
  },
};

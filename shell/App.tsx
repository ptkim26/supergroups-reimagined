import React, { Suspense, useState } from 'react';
import type { ConceptId, EntryState } from './types';
import { conceptLabels, projectName } from './config';
import { createEntryState, createWrongRuleEntryState, createColdViewEntryState } from './mockData';
import ConceptSwitcher from './ConceptSwitcher';

const ConceptA = React.lazy(() => import('../concept-A/index'));
const ConceptB = React.lazy(() => import('../concept-B/index'));
const ConceptC = React.lazy(() => import('../concept-C/index'));
const ConceptD = React.lazy(() => import('../concept-D/index'));
const ConceptE = React.lazy(() => import('../concept-E/index'));
const ConceptF = React.lazy(() => import('../concept-F/index'));

const conceptComponents = { A: ConceptA, B: ConceptB, C: ConceptC, D: ConceptD, E: ConceptE, F: ConceptF };

type ScenarioKey = 'view' | 'edit' | 'create' | 'create-high-stakes' | 'inline-select' | 'wrong-rule' | 'cold-open' | 'view-advanced' | 'view-legacy';

const CONCEPT_C_SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: 'view',         label: 'View group' },
  { key: 'edit',         label: 'Edit group' },
  { key: 'create',       label: 'Create group' },
  { key: 'inline-select', label: 'Inline select' },
  { key: 'wrong-rule',   label: 'AI gets it wrong' },
  { key: 'cold-open',    label: 'Cold open (legacy)' },
];

const CONCEPT_E_SCENARIOS: { key: ScenarioKey; label: string }[] = [
  { key: 'view',              label: 'View group' },
  { key: 'edit',              label: 'Edit group' },
  { key: 'create',            label: 'Create group' },
  { key: 'create-high-stakes', label: 'High-stakes create' },
  { key: 'inline-select',     label: 'Inline select' },
  { key: 'view-legacy',       label: 'Legacy group' },
];

function buildEntryState(key: ScenarioKey): EntryState {
  switch (key) {
    case 'view':           return createEntryState('view', 'standalone');
    case 'edit':           return createEntryState('edit', 'standalone');
    case 'create':         return createEntryState('create', 'standalone');
    case 'create-high-stakes': {
      const base = createEntryState('create', 'standalone');
      return {
        ...base,
        scenario: {
          type: 'create',
          policyContext: { id: 'pol-1', name: 'US Payroll Run', domain: 'payroll', sensitivityTier: 1, affectedCount: 847 },
        },
      };
    }
    case 'inline-select':  return createEntryState('inline-select', 'inline');
    case 'wrong-rule':     return createWrongRuleEntryState();
    case 'cold-open':      return createColdViewEntryState();
    case 'view-advanced': {
      const base = createEntryState('view', 'standalone');
      return { ...base, scenario: { type: 'view', groupId: 'sg-advanced' } };
    }
    case 'view-legacy':    return createColdViewEntryState();
  }
}

export default function App() {
  const [activeConcept, setActiveConcept] = useState<ConceptId | null>(null);
  const [scenarioKey, setScenarioKey] = useState<ScenarioKey>('view');
  const [entryState, setEntryState] = useState<EntryState>(() => buildEntryState('view'));

  const handleScenarioChange = (key: ScenarioKey) => {
    setScenarioKey(key);
    setEntryState(buildEntryState(key));
  };

  if (activeConcept === null) {
    return <ConceptSwitcher activeConcept={null} onSelect={setActiveConcept} />;
  }

  const ActiveComponent = conceptComponents[activeConcept];

  return (
    <div style={styles.wrapper}>
      <header style={styles.header}>
        <button onClick={() => setActiveConcept(null)} style={styles.backButton}>
          ← All concepts
        </button>
        <div style={styles.headerLabel}>
          <span style={styles.conceptBadge}>{activeConcept}</span>
          <span style={styles.conceptName}>{conceptLabels[activeConcept].name}</span>
        </div>
        {activeConcept !== 'E' && activeConcept !== 'F' && (
          <ConceptSwitcher activeConcept={activeConcept} onSelect={setActiveConcept} />
        )}
      </header>
      {(activeConcept === 'C' || activeConcept === 'E') && (
        <div style={styles.scenarioPicker}>
          <span style={styles.scenarioLabel}>Scenario:</span>
          {(activeConcept === 'E' ? CONCEPT_E_SCENARIOS : CONCEPT_C_SCENARIOS).map(s => (
            <button
              key={s.key}
              onClick={() => handleScenarioChange(s.key)}
              style={{
                ...styles.scenarioBtn,
                ...(scenarioKey === s.key ? styles.scenarioBtnActive : {}),
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      <main style={styles.main}>
        <Suspense fallback={<Loading />}>
          <ActiveComponent entryState={entryState} />
        </Suspense>
      </main>
    </div>
  );
}

function Loading() {
  return (
    <div style={styles.loading}>
      <p>Loading concept…</p>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#fafafa',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
  },
  scenarioPicker: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 16px 8px',
    background: '#fff',
    borderBottom: '1px solid #e0e0e0',
    flexWrap: 'wrap',
  },
  scenarioLabel: {
    fontSize: '0.6875rem',
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginRight: 4,
  },
  scenarioBtn: {
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid #dedede',
    background: 'transparent',
    color: '#555',
    fontSize: '0.75rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.1s',
  },
  scenarioBtnActive: {
    background: '#2952cc',
    color: '#fff',
    border: '1px solid #2952cc',
    fontWeight: 600,
  },
  headerLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem 0',
  },
  backButton: {
    alignSelf: 'flex-start',
    padding: '0.5rem 1rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8125rem',
    color: '#555',
  },
  conceptBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '1.5rem',
    height: '1.5rem',
    borderRadius: '4px',
    background: '#111',
    color: '#fff',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  conceptName: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#111',
  },
  main: {
    flex: 1,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem',
    color: '#999',
  },
};

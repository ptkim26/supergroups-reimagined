import type { ConceptId } from './types';
import { conceptLabels, complexity, projectName } from './config';

interface Props {
  activeConcept: ConceptId | null;
  onSelect: (id: ConceptId) => void;
}

const earlierIds: ConceptId[] = ['A', 'B', 'C', 'D'];
const tabOrder: ConceptId[] = ['F', 'E', 'A', 'B', 'C', 'D'];

export default function ConceptSwitcher({ activeConcept, onSelect }: Props) {
  if (complexity === 'complex' || activeConcept !== null) {
    return <TabBar activeConcept={activeConcept} onSelect={onSelect} />;
  }
  return <SplashScreen onSelect={onSelect} />;
}

function SplashScreen({ onSelect }: { onSelect: (id: ConceptId) => void }) {
  return (
    <div style={styles.splash}>
      <h1 style={styles.title}>{projectName}</h1>
      <p style={styles.subtitle}>Six prototype explorations — two recommended directions</p>

      {/* Hero card for Concept F */}
      <button onClick={() => onSelect('F')} style={{ ...styles.heroCard, borderColor: '#7C3AED' }}>
        <div style={styles.heroTop}>
          <span style={{ ...styles.heroBadge, background: '#7C3AED' }}>F</span>
          <span style={{ ...styles.heroRecommended, color: '#7C3AED' }}>Latest exploration</span>
        </div>
        <span style={styles.heroName}>{conceptLabels.F.name}</span>
        <span style={styles.heroHypothesis}>{conceptLabels.F.hypothesis}</span>
      </button>

      {/* Hero card for Concept E */}
      <button onClick={() => onSelect('E')} style={{ ...styles.heroCard, marginTop: '0.75rem' }}>
        <div style={styles.heroTop}>
          <span style={styles.heroBadge}>E</span>
          <span style={styles.heroRecommended}>Validated direction</span>
        </div>
        <span style={styles.heroName}>{conceptLabels.E.name}</span>
        <span style={styles.heroHypothesis}>{conceptLabels.E.hypothesis}</span>
      </button>

      {/* Earlier paradigm explorations */}
      <div style={styles.sectionLabel}>Earlier paradigm explorations</div>
      <div style={styles.grid}>
        {earlierIds.map((id) => (
          <button key={id} onClick={() => onSelect(id)} style={styles.card}>
            <span style={styles.cardLetter}>{id}</span>
            <span style={styles.cardName}>{conceptLabels[id].name}</span>
            <span style={styles.cardHypothesis}>{conceptLabels[id].hypothesis}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function TabBar({ activeConcept, onSelect }: Props) {
  return (
    <nav style={styles.tabBar}>
      {tabOrder.map((id, i) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          style={{
            ...styles.tab,
            ...(activeConcept === id ? styles.tabActive : {}),
            ...(i === 0 ? styles.tabPrimary : {}),
            ...(i === 1 ? { marginLeft: 2 } : {}),
          }}
        >
          {i === 1 && <span style={styles.tabSeparator} aria-hidden />}
          <strong>{id}</strong>
          <span style={styles.tabLabel}>{conceptLabels[id].name}</span>
        </button>
      ))}
    </nav>
  );
}

const styles: Record<string, React.CSSProperties> = {
  splash: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
    background: '#fafafa',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#111',
    marginBottom: '0.25rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#666',
    marginBottom: '2rem',
  },
  heroCard: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.625rem',
    padding: '1.75rem 2rem',
    background: '#fff',
    border: '2px solid #111',
    borderRadius: '14px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'box-shadow 0.15s',
    maxWidth: '720px',
    width: '100%',
    boxSizing: 'border-box' as const,
    boxShadow: 'rgba(0,0,0,0.06) 0px 4px 18px',
  },
  heroTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
  },
  heroBadge: {
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
  heroRecommended: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#0075de',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
  },
  heroName: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#111',
    letterSpacing: '-0.01em',
  },
  heroHypothesis: {
    fontSize: '0.9375rem',
    color: '#555',
    lineHeight: 1.5,
  },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em',
    marginTop: '2.5rem',
    marginBottom: '0.75rem',
    alignSelf: 'flex-start',
    maxWidth: '720px',
    width: '100%',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.75rem',
    maxWidth: '720px',
    width: '100%',
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: '0.375rem',
    padding: '1.25rem',
    background: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  cardLetter: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  cardName: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#111',
  },
  cardHypothesis: {
    fontSize: '0.8125rem',
    color: '#555',
    lineHeight: 1.4,
  },
  tabBar: {
    display: 'flex',
    gap: '0',
    borderBottom: '1px solid #e0e0e0',
    background: '#fff',
    position: 'sticky' as const,
    top: 0,
    zIndex: 100,
  },
  tab: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    background: 'transparent',
    border: 'none',
    borderBottom: '2px solid transparent',
    cursor: 'pointer',
    fontSize: '0.875rem',
    color: '#555',
  },
  tabActive: {
    color: '#111',
    borderBottomColor: '#111',
  },
  tabPrimary: {
    flex: 1.2,
  },
  tabSeparator: {
    position: 'absolute' as const,
    left: -1,
    top: '25%',
    height: '50%',
    width: 1,
    background: '#e0e0e0',
  },
  tabLabel: {
    fontWeight: 500,
  },
};

import { useState, useMemo } from 'react';
import type {
  Person,
  RuleGroup,
  RuleCondition,
  RuleNode,
  EvaluationLayer,
  PolicyRef,
  SensitivityTier,
} from '../shell/types';

// ── Interface ────────────────────────────────────────────────────────────────

export interface PopulationDisplayProps {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  policies: PolicyRef[];
  compact?: boolean;
}

// ── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f6f5f4',
  border: 'rgba(0,0,0,0.1)',
  borderStrong: 'rgba(0,0,0,0.2)',
  text: 'rgba(0,0,0,0.95)',
  textSecondary: '#615d59',
  textMuted: '#a39e98',
  accent: '#0075de',
  accentHover: '#005bab',
  accentLight: '#f2f9ff',
  accentBorder: '#d0e8ff',
  green: '#2a9d99',
  greenLight: '#f0faf9',
  greenBorder: '#b2e2e0',
  amber: '#dd5b00',
  amberLight: '#fff7f0',
  amberBorder: '#fdd0a8',
  red: '#d32d2d',
  redLight: '#fef2f2',
  redBorder: '#fccaca',
  purple: '#7C3AED',
  purpleLight: '#f5f3ff',
  purpleBorder: '#ddd6fe',
};

const FONT = 'Inter, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif';

const S = {
  card: 'rgba(0,0,0,0.04) 0px 4px 18px, rgba(0,0,0,0.027) 0px 2.025px 7.85px, rgba(0,0,0,0.02) 0px 0.8px 2.93px, rgba(0,0,0,0.01) 0px 0.175px 1.04px',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contractor: 'Contractor',
};

const roleStateLabels: Record<string, string> = {
  active: 'Active',
  pending: 'Pending',
  terminated: 'Terminated',
};

const fieldLabels: Record<string, string> = {
  department: 'Department',
  location: 'Location',
  country: 'Country',
  employmentType: 'Employment type',
  roleState: 'Role status',
  startDate: 'Start date',
  title: 'Title',
};

function formatValue(field: string, val: string): string {
  if (field === 'employmentType') return employmentTypeLabels[val] || val;
  if (field === 'roleState') return roleStateLabels[val] || val;
  return val;
}

function tierLabel(tier: SensitivityTier): string {
  return tier === 1 ? 'Critical' : tier === 2 ? 'Moderate' : 'Low';
}

function tierColor(tier: SensitivityTier) {
  return tier === 1
    ? { bg: C.redLight, border: C.redBorder, text: C.red }
    : tier === 2
    ? { bg: C.amberLight, border: C.amberBorder, text: C.amber }
    : { bg: C.greenLight, border: C.greenBorder, text: C.green };
}

// ── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  ['#e8dfd5', '#6b5842'], ['#d5e3df', '#2d6b5e'], ['#e5d8d8', '#8b4a4a'],
  ['#ddd5e8', '#5b4280'], ['#e5ddd0', '#7a6540'], ['#d8dce5', '#4a5a7a'],
  ['#dfe8d5', '#4a6b3a'], ['#e8d5dd', '#804260'],
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xFFFF;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const [bg, fg] = getAvatarColor(name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.36, fontWeight: 600, flexShrink: 0,
      border: '1px solid rgba(0,0,0,0.1)',
    }}>
      {initials(name)}
    </div>
  );
}

// ── Person explanation ───────────────────────────────────────────────────────

function explainPerson(person: Person, rule: RuleGroup, layers: EvaluationLayer[]): { status: 'included' | 'excluded_by_layer' | 'excluded_by_rule'; text: string } {
  const layer = layers.find(l => l.excludedPeopleIds.includes(person.id));
  if (layer) {
    return {
      status: 'excluded_by_layer',
      text: `Excluded by "${layer.label}": ${layer.description}`,
    };
  }

  // Build an explanation from matching conditions
  const reasons: string[] = [];
  function walk(node: RuleNode) {
    if (node.type === 'condition') {
      const val = (person as any)[node.field];
      const display = formatValue(node.field, String(val));
      const label = fieldLabels[node.field] || node.field;
      reasons.push(`${label} is ${display}`);
    } else {
      node.children.forEach(walk);
    }
  }
  walk(rule);

  if (reasons.length > 0) {
    return { status: 'included', text: `Included because: ${reasons.join(', ')}` };
  }
  return { status: 'included', text: 'Matches the current rule conditions.' };
}

// ── Composition bar colors ───────────────────────────────────────────────────

const DEPT_COLORS = [
  '#94a3b8', '#7c9cb8', '#8ba89b', '#b8a07c', '#a8899b',
  '#9b8ba8', '#8b9ba8', '#a89b8b', '#8ba88b', '#a88b8b',
  '#8b8ba8', '#a8a88b',
];

function getDeptColor(index: number): string {
  return DEPT_COLORS[index % DEPT_COLORS.length];
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function SplitPanelLayout({
  members,
  allPeople,
  rule,
  layers,
  excludedByLayers,
  policies,
  compact = false,
}: PopulationDisplayProps) {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [exclusionsExpanded, setExclusionsExpanded] = useState(false);
  const [expandedPersonId, setExpandedPersonId] = useState<string | null>(null);
  const [expandedPolicyId, setExpandedPolicyId] = useState<string | null>(null);

  const perPage = compact ? 5 : 8;
  const showSearch = members.length > 30;

  const totalExcluded = useMemo(
    () => excludedByLayers.reduce((sum, g) => sum + g.people.length, 0),
    [excludedByLayers],
  );

  // Department breakdown for composition bar
  const deptBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of members) {
      counts[p.department] = (counts[p.department] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([dept, count]) => ({ dept, count, pct: count / members.length }));
  }, [members]);

  // Filtered + paginated members
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(
      p =>
        p.name.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q),
    );
  }, [members, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / perPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedMembers = filteredMembers.slice(currentPage * perPage, (currentPage + 1) * perPage);

  const totalAffected = useMemo(
    () => policies.reduce((sum, p) => sum + p.affectedCount, 0),
    [policies],
  );

  // Composition bar aria-label
  const compositionLabel = deptBreakdown
    .map(d => `${d.dept}: ${d.count} (${Math.round(d.pct * 100)}%)`)
    .join(', ');

  // ── Render ─────────────────────────────────────────────────────────────────

  const pad = compact ? 12 : 20;

  // ── Left panel: Population ─────────────────────────────────────────────────

  const leftPanel = (
    <div
      role="region"
      aria-label="Population"
      style={{
        flex: compact ? 'none' : '0 0 60%',
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        minWidth: 0,
      }}
    >
      {/* Match count + exclusion indicator */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 12,
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 20, fontWeight: 700, color: C.text, fontFamily: FONT,
          letterSpacing: '-0.01em',
        }}>
          {members.length.toLocaleString()} {members.length === 1 ? 'person' : 'people'}
        </span>
        {totalExcluded > 0 && (
          <button
            onClick={() => setExclusionsExpanded(v => !v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '2px 0', margin: 0,
              fontSize: 13, fontWeight: 500, color: C.amber, fontFamily: FONT,
              textDecoration: 'none',
              opacity: 0.9,
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '1'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.9'; }}
            aria-expanded={exclusionsExpanded}
          >
            {totalExcluded} excluded {exclusionsExpanded ? '▾' : '▸'}
          </button>
        )}
      </div>

      {/* Exclusion detail (expandable) */}
      {exclusionsExpanded && excludedByLayers.length > 0 && (
        <div style={{
          marginBottom: 12,
          padding: '10px 12px',
          background: C.amberLight,
          borderRadius: 8,
          border: `1px solid ${C.amberBorder}`,
        }}>
          {excludedByLayers.map(({ layer, people }) => (
            <div key={layer.id} style={{ marginBottom: 6 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: C.amber, fontFamily: FONT,
                marginBottom: 2,
              }}>
                {layer.label}
              </div>
              <div style={{ fontSize: 12, color: C.textSecondary, fontFamily: FONT, lineHeight: 1.4 }}>
                {layer.description}
              </div>
              <div style={{
                fontSize: 12, color: C.textMuted, fontFamily: FONT,
                marginTop: 3,
              }}>
                {people.length} {people.length === 1 ? 'person' : 'people'} excluded
                {people.length <= 5 && (
                  <span style={{ marginLeft: 6 }}>
                    — {people.map(p => p.name).join(', ')}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Composition bar */}
      {members.length > 0 && (
        <div
          role="img"
          aria-label={`Population by department: ${compositionLabel}`}
          style={{
            display: 'flex', height: 6, borderRadius: 3,
            overflow: 'hidden', marginBottom: 14,
            background: C.surfaceAlt,
          }}
        >
          {deptBreakdown.map((d, i) => (
            <div
              key={d.dept}
              title={`${d.dept}: ${d.count}`}
              style={{
                flex: `${d.pct} 0 0%`,
                background: getDeptColor(i),
                opacity: 0.6,
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.opacity = '0.85'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.opacity = '0.6'; }}
            />
          ))}
        </div>
      )}

      {/* Search (when > 30 members) */}
      {showSearch && (
        <div style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(0); }}
            placeholder="Filter people…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '7px 10px',
              fontSize: 13, fontFamily: FONT,
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              outline: 'none',
              color: C.text,
              background: C.surface,
            }}
            onFocus={e => { e.target.style.borderColor = C.accent; }}
            onBlur={e => { e.target.style.borderColor = C.border as string; }}
          />
        </div>
      )}

      {/* Member list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {pagedMembers.map((person, idx) => {
          const isExpanded = expandedPersonId === person.id;
          const isLast = idx === pagedMembers.length - 1;
          return (
            <div key={person.id}>
              <button
                onClick={() => setExpandedPersonId(isExpanded ? null : person.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', textAlign: 'left',
                  padding: '8px 4px',
                  background: isExpanded ? C.accentLight : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderRadius: 6,
                  borderBottom: isLast && !isExpanded ? 'none' : undefined,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (!isExpanded) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt;
                }}
                onMouseLeave={e => {
                  if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
                aria-expanded={isExpanded}
              >
                <Avatar name={person.name} size={compact ? 24 : 28} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500, color: C.text, fontFamily: FONT,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {person.name}
                  </div>
                  <div style={{
                    fontSize: 12, color: C.textSecondary, fontFamily: FONT,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {person.title} · {person.department} · {person.location}
                  </div>
                </div>
              </button>

              {/* Person explanation popover */}
              {isExpanded && (
                <div style={{
                  margin: '0 4px 4px 42px',
                  padding: '8px 12px',
                  background: C.accentLight,
                  border: `1px solid ${C.accentBorder}`,
                  borderRadius: 6,
                  fontSize: 12, color: C.textSecondary, fontFamily: FONT,
                  lineHeight: 1.5,
                }}>
                  {explainPerson(person, rule, layers).text}
                </div>
              )}
            </div>
          );
        })}

        {filteredMembers.length === 0 && searchQuery && (
          <div style={{
            padding: '16px 4px', fontSize: 13, color: C.textMuted, fontFamily: FONT,
          }}>
            No people match "{searchQuery}"
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 10, padding: '4px 4px 0',
        }}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{
              background: 'none', border: 'none', cursor: currentPage === 0 ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: FONT,
              color: currentPage === 0 ? C.textMuted : C.accent,
              padding: '4px 8px', borderRadius: 4,
            }}
          >
            ← Prev
          </button>
          <span style={{ fontSize: 12, color: C.textMuted, fontFamily: FONT }}>
            {currentPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage === totalPages - 1}
            style={{
              background: 'none', border: 'none', cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
              fontSize: 13, fontWeight: 500, fontFamily: FONT,
              color: currentPage === totalPages - 1 ? C.textMuted : C.accent,
              padding: '4px 8px', borderRadius: 4,
            }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );

  // ── Right panel: Downstream Impact ─────────────────────────────────────────

  const rightPanel = (
    <div
      role="region"
      aria-label="Downstream impact"
      style={{
        flex: compact ? 'none' : '0 0 40%',
        padding: pad,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        minWidth: 0,
      }}
    >
      {/* Header */}
      <div style={{
        fontSize: 11, fontWeight: 600, color: C.textMuted, fontFamily: FONT,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.5px',
        marginBottom: 6,
      }}>
        Downstream impact
      </div>

      {/* Total affected */}
      <div style={{
        fontSize: 16, fontWeight: 600, color: C.text, fontFamily: FONT,
        marginBottom: 16,
        letterSpacing: '-0.01em',
      }}>
        {totalAffected.toLocaleString()} people affected
      </div>

      {/* Policy list */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 0,
        maxHeight: policies.length > 5 ? 300 : undefined,
        overflowY: policies.length > 5 ? 'auto' : undefined,
        position: 'relative',
      }}>
        {policies.map((policy, idx) => {
          const tc = tierColor(policy.sensitivityTier);
          const isLast = idx === policies.length - 1;
          const isExpanded = expandedPolicyId === policy.id;
          return (
            <div key={policy.id}>
              <button
                onClick={() => setExpandedPolicyId(isExpanded ? null : policy.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  width: '100%', textAlign: 'left',
                  padding: '9px 4px',
                  background: isExpanded ? C.surfaceAlt : 'transparent',
                  border: 'none',
                  borderBottom: isLast ? 'none' : `1px solid ${C.border}`,
                  cursor: 'pointer',
                  borderRadius: isExpanded ? 6 : 0,
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => {
                  if (!isExpanded) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt;
                }}
                onMouseLeave={e => {
                  if (!isExpanded) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                {/* Tier badge */}
                <span style={{
                  display: 'inline-block',
                  padding: '2px 6px',
                  fontSize: 10, fontWeight: 600,
                  fontFamily: FONT,
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.3px',
                  color: tc.text,
                  background: tc.bg,
                  border: `1px solid ${tc.border}`,
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginTop: 1,
                }}>
                  {tierLabel(policy.sensitivityTier)}
                </span>

                {/* Policy info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 500, color: C.text, fontFamily: FONT,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {policy.name}
                  </div>
                  <div style={{
                    fontSize: 13, color: C.textSecondary, fontFamily: FONT,
                    marginTop: 1,
                  }}>
                    {policy.domain.charAt(0).toUpperCase() + policy.domain.slice(1)}
                  </div>
                </div>

                {/* Affected count */}
                <span style={{
                  fontSize: 13, color: C.textMuted, fontFamily: FONT,
                  whiteSpace: 'nowrap', flexShrink: 0,
                  marginTop: 1,
                }}>
                  {policy.affectedCount.toLocaleString()}
                </span>
              </button>

              {/* Expanded policy detail */}
              {isExpanded && (
                <div style={{
                  margin: '0 4px 6px 4px',
                  padding: '8px 12px',
                  background: C.surfaceAlt,
                  borderRadius: 6,
                  fontSize: 12, color: C.textSecondary, fontFamily: FONT,
                  lineHeight: 1.5,
                }}>
                  {policy.name}: Targets {policy.affectedCount.toLocaleString()} people
                  via {policy.domain} policy. Sensitivity: {tierLabel(policy.sensitivityTier)}.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Fade overlay for scrollable policy list */}
      {policies.length > 5 && (
        <div style={{
          height: 24,
          background: 'linear-gradient(transparent, rgba(255,255,255,0.9))',
          marginTop: -24,
          position: 'relative',
          pointerEvents: 'none',
          borderRadius: '0 0 8px 8px',
        }} />
      )}

      {policies.length === 0 && (
        <div style={{
          fontSize: 13, color: C.textMuted, fontFamily: FONT,
          padding: '8px 0',
        }}>
          No downstream policies reference this group.
        </div>
      )}
    </div>
  );

  // ── Card shell ─────────────────────────────────────────────────────────────

  if (compact) {
    return (
      <div style={{
        fontFamily: FONT,
        background: C.surface,
        borderRadius: 10,
        boxShadow: S.card,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}>
        {leftPanel}
        {/* Horizontal divider */}
        <div style={{
          height: 1,
          background: C.border,
          margin: '0 12px',
        }} />
        {rightPanel}
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: FONT,
      background: C.surface,
      borderRadius: 10,
      boxShadow: S.card,
      border: `1px solid ${C.border}`,
      display: 'flex',
      overflow: 'hidden',
      minHeight: 200,
    }}>
      {leftPanel}

      {/* Vertical divider */}
      <div
        aria-hidden="true"
        style={{
          width: 1,
          background: C.border,
          margin: '8px 0',
          borderRadius: 1,
          flexShrink: 0,
        }}
      />

      {rightPanel}
    </div>
  );
}

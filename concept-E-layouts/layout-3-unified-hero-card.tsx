import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type {
  Person,
  RuleGroup,
  RuleCondition,
  RuleNode,
  EvaluationLayer,
  PolicyRef,
  SensitivityTier,
} from '../shell/types';

// ── Interface contract ──────────────────────────────────────────────────────

export interface PopulationDisplayProps {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  policies: PolicyRef[];
  compact?: boolean;
}

// ── Design tokens ───────────────────────────────────────────────────────────

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

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  return tier === 1 ? { bg: C.redLight, border: C.redBorder, text: C.red }
    : tier === 2 ? { bg: C.amberLight, border: C.amberBorder, text: C.amber }
    : { bg: C.accentLight, border: C.accentBorder, text: C.accent };
}

// ── Avatar ──────────────────────────────────────────────────────────────────

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

// ── Person explanation popover ──────────────────────────────────────────────

function explainPersonInGroup(person: Person, rule: RuleGroup, layers: EvaluationLayer[]): string {
  const parts: string[] = [];
  function walk(node: RuleNode) {
    if (node.type === 'condition') {
      const val = (person as any)[node.field];
      const label = fieldLabels[node.field] || node.field;
      const displayVal = formatValue(node.field, String(val));
      parts.push(`${label} is ${displayVal}`);
    } else {
      node.children.forEach(walk);
    }
  }
  walk(rule);
  return parts.length > 0
    ? `Included because: ${parts.join(', ')}`
    : 'Matches the current rule criteria';
}

// ── Composition breakdown ───────────────────────────────────────────────────

function getComposition(members: Person[], maxPills: number): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const m of members) {
    counts.set(m.department, (counts.get(m.department) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, maxPills).map(([label, count]) => ({ label, count }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function UnifiedHeroCard({
  members,
  allPeople,
  rule,
  layers,
  excludedByLayers,
  policies,
  compact = false,
}: PopulationDisplayProps) {
  const count = members.length;
  const totalExcluded = excludedByLayers.reduce((sum, e) => sum + e.people.length, 0);
  const autoExpandMembers = count <= 10;

  const [showMembers, setShowMembers] = useState(autoExpandMembers);
  const [showExclusions, setShowExclusions] = useState(false);
  const [showImpact, setShowImpact] = useState(false);
  const [memberPage, setMemberPage] = useState(0);
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const memberListRef = useRef<HTMLDivElement>(null);
  const impactRef = useRef<HTMLDivElement>(null);

  // Reset states when members change significantly
  useEffect(() => {
    setShowMembers(count <= 10);
    setMemberPage(0);
    setExpandedPerson(null);
    setSearchQuery('');
  }, [count]);

  // Sizing
  const pad = compact ? 16 : 24;
  const heroSize = compact ? 36 : 48;
  const labelSize = compact ? 13 : 14;
  const pillMax = compact ? 3 : 5;
  const pillShowMax = compact ? 3 : 4;
  const avatarSize = compact ? 26 : 32;
  const avatarMax = compact ? 4 : 7;
  const avatarOverlap = compact ? -8 : -10;
  const pageSize = 20;

  // Composition pills
  const composition = useMemo(() => getComposition(members, pillMax), [members, pillMax]);
  const totalDepts = useMemo(() => {
    const s = new Set(members.map(m => m.department));
    return s.size;
  }, [members]);
  const showPercentages = count >= 500;

  // Filtered members for search
  const filteredMembers = useMemo(() => {
    if (!searchQuery) return members;
    const q = searchQuery.toLowerCase();
    return members.filter(m =>
      m.name.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q) ||
      m.title.toLowerCase().includes(q) ||
      m.location.toLowerCase().includes(q)
    );
  }, [members, searchQuery]);

  const totalPages = Math.ceil(filteredMembers.length / pageSize);
  const pagedMembers = filteredMembers.slice(memberPage * pageSize, (memberPage + 1) * pageSize);

  // Highest sensitivity tier for impact dot
  const highestTier = useMemo(() => {
    if (policies.length === 0) return null;
    return Math.min(...policies.map(p => p.sensitivityTier)) as SensitivityTier;
  }, [policies]);

  const totalAffected = useMemo(() => {
    return policies.reduce((sum, p) => sum + p.affectedCount, 0);
  }, [policies]);

  const handleShowMembers = useCallback(() => {
    setShowMembers(true);
    setMemberPage(0);
    setSearchQuery('');
    // Focus member list after render
    requestAnimationFrame(() => {
      memberListRef.current?.focus();
    });
  }, []);

  const handleCollapseMembers = useCallback(() => {
    setShowMembers(false);
    setExpandedPerson(null);
    setSearchQuery('');
  }, []);

  const handleToggleImpact = useCallback(() => {
    setShowImpact(prev => {
      if (!prev) {
        requestAnimationFrame(() => {
          impactRef.current?.focus();
        });
      }
      return !prev;
    });
  }, []);

  const handlePersonClick = useCallback((personId: string) => {
    setExpandedPerson(prev => prev === personId ? null : personId);
  }, []);

  return (
    <div style={{
      fontFamily: FONT,
      background: C.surface,
      borderRadius: 16,
      boxShadow: S.card,
      padding: pad,
      maxWidth: compact ? 480 : undefined,
    }}>

      {/* ── Hero number ──────────────────────────────────────────────── */}
      <div style={{ textAlign: 'center', marginBottom: totalExcluded > 0 ? 8 : 20 }}>
        <div
          aria-label={`${count} people`}
          style={{
            fontSize: heroSize,
            fontWeight: 800,
            color: C.text,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          {count}
        </div>
        <div style={{
          fontSize: labelSize,
          fontWeight: 400,
          color: C.textSecondary,
          marginTop: 2,
        }}>
          {count === 1 ? 'person' : 'people'}
        </div>

        {/* Exclusion link */}
        {totalExcluded > 0 && (
          <button
            onClick={() => setShowExclusions(prev => !prev)}
            aria-expanded={showExclusions}
            aria-label={`${totalExcluded} excluded by system filters. Click to ${showExclusions ? 'collapse' : 'expand'} details.`}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 0',
              marginTop: 4,
              cursor: 'pointer',
              fontSize: 13,
              color: C.amber,
              fontFamily: FONT,
              fontWeight: 500,
            }}
          >
            {totalExcluded} excluded by system filters
          </button>
        )}
      </div>

      {/* ── Exclusion detail (expandable) ────────────────────────────── */}
      {showExclusions && totalExcluded > 0 && (
        <div
          role="region"
          aria-label="Exclusion details"
          style={{
            background: C.amberLight,
            border: `1px solid ${C.amberBorder}`,
            borderRadius: 10,
            padding: compact ? 12 : 14,
            marginBottom: 16,
          }}
        >
          {excludedByLayers.map(({ layer, people }) => (
            <div key={layer.id} style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: C.amber,
                marginBottom: 3,
              }}>
                {layer.label}
              </div>
              <div style={{
                fontSize: 12,
                color: C.textSecondary,
                marginBottom: 6,
                lineHeight: 1.4,
              }}>
                {layer.description}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {people.map(p => (
                  <span key={p.id} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'rgba(255,255,255,0.7)',
                    borderRadius: 12,
                    padding: '2px 8px 2px 2px',
                    fontSize: 12,
                    color: C.textSecondary,
                  }}>
                    <Avatar name={p.name} size={18} />
                    {p.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Composition pills ────────────────────────────────────────── */}
      <div
        role="list"
        aria-label="Population composition"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 6,
          marginBottom: 16,
        }}
      >
        {composition.slice(0, pillShowMax).map(({ label, count: c }) => (
          <span
            key={label}
            role="listitem"
            style={{
              display: 'inline-block',
              background: C.surfaceAlt,
              border: `1px solid ${C.border}`,
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 12,
              fontWeight: 500,
              color: C.textSecondary,
              whiteSpace: 'nowrap',
            }}
          >
            {label} {showPercentages ? `${Math.round((c / count) * 100)}%` : c}
          </span>
        ))}
        {totalDepts > pillShowMax && (
          <span
            role="listitem"
            style={{
              display: 'inline-block',
              background: 'transparent',
              borderRadius: 999,
              padding: '3px 10px',
              fontSize: 12,
              fontWeight: 500,
              color: C.textMuted,
              whiteSpace: 'nowrap',
            }}
          >
            +{totalDepts - pillShowMax} more
          </span>
        )}
      </div>

      {/* ── Avatar row / Member list ─────────────────────────────────── */}
      {!showMembers ? (
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {/* Overlapping avatars */}
          <div
            aria-label={`Population preview. Showing ${Math.min(avatarMax, count)} of ${count} people.`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {members.slice(0, avatarMax).map((m, i) => (
              <div
                key={m.id}
                style={{
                  marginLeft: i === 0 ? 0 : avatarOverlap,
                  zIndex: avatarMax - i,
                  position: 'relative',
                  borderRadius: '50%',
                  boxShadow: '0 0 0 2px white',
                }}
              >
                <Avatar name={m.name} size={avatarSize} />
              </div>
            ))}
            {count > avatarMax && (
              <div style={{
                marginLeft: avatarOverlap,
                zIndex: 0,
                width: avatarSize,
                height: avatarSize,
                borderRadius: '50%',
                background: C.surfaceAlt,
                border: `1px solid ${C.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: avatarSize * 0.34,
                fontWeight: 600,
                color: C.textSecondary,
                boxShadow: '0 0 0 2px white',
                position: 'relative',
              }}>
                +{count - avatarMax}
              </div>
            )}
          </div>

          {/* "Show all" link */}
          <div style={{ marginTop: 8 }}>
            <button
              onClick={handleShowMembers}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                color: C.accent,
                fontFamily: FONT,
              }}
            >
              Show all {count} {count === 1 ? 'person' : 'people'}
            </button>
          </div>
        </div>
      ) : (
        /* ── Expanded member list ────────────────────────────────────── */
        <div
          ref={memberListRef}
          tabIndex={-1}
          role="region"
          aria-label={`Member list. ${filteredMembers.length} people.`}
          style={{
            marginBottom: 16,
            outline: 'none',
          }}
        >
          {/* Search (when > 50 members) */}
          {count > 50 && (
            <div style={{ marginBottom: 10 }}>
              <input
                type="text"
                placeholder="Search people..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setMemberPage(0); }}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '7px 10px',
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  fontFamily: FONT,
                  color: C.text,
                  background: C.surfaceAlt,
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Person rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {pagedMembers.map(person => (
              <div key={person.id}>
                <button
                  onClick={() => handlePersonClick(person.id)}
                  aria-expanded={expandedPerson === person.id}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '7px 8px',
                    background: expandedPerson === person.id ? C.accentLight : 'transparent',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: FONT,
                    transition: 'background 120ms ease',
                  }}
                  onMouseEnter={e => {
                    if (expandedPerson !== person.id) {
                      (e.currentTarget as HTMLElement).style.background = C.surfaceAlt;
                    }
                  }}
                  onMouseLeave={e => {
                    if (expandedPerson !== person.id) {
                      (e.currentTarget as HTMLElement).style.background = 'transparent';
                    }
                  }}
                >
                  <Avatar name={person.name} size={compact ? 24 : 28} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: C.text,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {person.name}
                    </div>
                    <div style={{
                      fontSize: 13,
                      color: C.textSecondary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {person.title} &middot; {person.department} &middot; {person.location}
                    </div>
                  </div>
                </button>

                {/* Explanation popover */}
                {expandedPerson === person.id && (
                  <div style={{
                    margin: '0 8px 4px 46px',
                    padding: '8px 12px',
                    background: C.accentLight,
                    border: `1px solid ${C.accentBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: C.textSecondary,
                    lineHeight: 1.5,
                  }}>
                    {explainPersonInGroup(person, rule, layers)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 10,
              fontSize: 13,
              color: C.textSecondary,
            }}>
              <button
                disabled={memberPage === 0}
                onClick={() => setMemberPage(p => p - 1)}
                style={{
                  background: 'none',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '3px 10px',
                  cursor: memberPage === 0 ? 'default' : 'pointer',
                  opacity: memberPage === 0 ? 0.4 : 1,
                  fontSize: 12,
                  fontFamily: FONT,
                  color: C.textSecondary,
                }}
              >
                Prev
              </button>
              <span>{memberPage + 1} / {totalPages}</span>
              <button
                disabled={memberPage >= totalPages - 1}
                onClick={() => setMemberPage(p => p + 1)}
                style={{
                  background: 'none',
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  padding: '3px 10px',
                  cursor: memberPage >= totalPages - 1 ? 'default' : 'pointer',
                  opacity: memberPage >= totalPages - 1 ? 0.4 : 1,
                  fontSize: 12,
                  fontFamily: FONT,
                  color: C.textSecondary,
                }}
              >
                Next
              </button>
            </div>
          )}

          {/* Collapse link (unless auto-expanded for small lists) */}
          {!autoExpandMembers && (
            <div style={{ textAlign: 'center', marginTop: 10 }}>
              <button
                onClick={handleCollapseMembers}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  fontSize: 13,
                  fontWeight: 500,
                  color: C.accent,
                  fontFamily: FONT,
                }}
              >
                Collapse
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Divider + Impact footer ──────────────────────────────────── */}
      {policies.length > 0 && (
        <>
          <div style={{
            height: 1,
            background: C.border,
            margin: `16px 0`,
          }} />

          <div>
            <button
              onClick={handleToggleImpact}
              aria-expanded={showImpact}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'none',
                border: 'none',
                padding: '4px 0',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: FONT,
              }}
            >
              {/* Tier indicator dot */}
              {highestTier && (
                <span style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: tierColor(highestTier).text,
                  flexShrink: 0,
                }} />
              )}

              {compact ? (
                <span style={{ fontSize: 14, color: C.textSecondary }}>
                  <strong style={{ color: C.text, fontWeight: 600 }}>{policies.length} {policies.length === 1 ? 'policy' : 'policies'}</strong>
                  {' '}&middot; {totalAffected.toLocaleString()} affected
                </span>
              ) : (
                <span style={{ fontSize: 14, color: C.textSecondary }}>
                  Feeds into{' '}
                  <strong style={{ color: C.text, fontWeight: 600 }}>{policies.length} {policies.length === 1 ? 'policy' : 'policies'}</strong>
                  {' '}affecting{' '}
                  <strong style={{ color: C.text, fontWeight: 600 }}>{totalAffected.toLocaleString()} people</strong>
                </span>
              )}

              {/* Chevron */}
              <span style={{
                marginLeft: 'auto',
                fontSize: 11,
                color: C.textMuted,
                transform: showImpact ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 150ms ease',
              }}>
                ▾
              </span>
            </button>

            {/* Impact expansion */}
            {showImpact && (
              <div
                ref={impactRef}
                tabIndex={-1}
                role="region"
                aria-label="Downstream policy impact"
                style={{
                  marginTop: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  outline: 'none',
                }}
              >
                {policies.map(p => {
                  const pc = tierColor(p.sensitivityTier);
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 10px',
                        background: C.surfaceAlt,
                        borderRadius: 8,
                      }}
                    >
                      {/* Tier badge */}
                      <span style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: pc.bg,
                        border: `1px solid ${pc.border}`,
                        color: pc.text,
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}>
                        {tierLabel(p.sensitivityTier)}
                      </span>

                      {/* Policy info */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: C.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {p.name}
                        </div>
                        <div style={{
                          fontSize: 12,
                          color: C.textSecondary,
                        }}>
                          {p.domain} &middot; {p.affectedCount.toLocaleString()} affected
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

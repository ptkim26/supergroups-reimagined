import { useState, useMemo, useCallback } from 'react';
import type {
  Person,
  RuleGroup,
  RuleNode,
  RuleCondition,
  EvaluationLayer,
  PolicyRef,
  SensitivityTier,
} from '../shell/types';

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

// ── Field / value display helpers ────────────────────────────────────────────

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

// ── Sensitivity tier helpers ─────────────────────────────────────────────────

function tierLabel(tier: SensitivityTier): string {
  return tier === 1 ? 'Critical' : tier === 2 ? 'Moderate' : 'Low';
}

function tierColor(tier: SensitivityTier) {
  return tier === 1 ? { bg: C.redLight, border: C.redBorder, text: C.red }
    : tier === 2 ? { bg: C.amberLight, border: C.amberBorder, text: C.amber }
    : { bg: C.accentLight, border: C.accentBorder, text: C.accent };
}

// ── Rule evaluation ──────────────────────────────────────────────────────────

function evaluateRule(person: Person, rule: RuleNode): boolean {
  if (rule.type === 'condition') {
    const val = (person as any)[rule.field];
    switch (rule.operator) {
      case 'is': return val === rule.value;
      case 'is_not': return val !== rule.value;
      case 'in': return Array.isArray(rule.value) && rule.value.includes(val);
      case 'contains': return typeof val === 'string' && val.toLowerCase().includes((rule.value as string).toLowerCase());
      case 'greater_than': return val > rule.value;
      case 'less_than': return val < rule.value;
      case 'after': return val > rule.value;
      case 'before': return val < rule.value;
      default: return false;
    }
  }
  const results = rule.children.map(c => evaluateRule(person, c));
  return rule.combinator === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

// ── Person explanation ───────────────────────────────────────────────────────

function explainPerson(person: Person, rule: RuleGroup, layers: EvaluationLayer[]): { status: 'included' | 'excluded_by_layer' | 'excluded_by_rule'; text: string } {
  const layer = layers.find(l => l.excludedPeopleIds.includes(person.id));
  if (layer) {
    return {
      status: 'excluded_by_layer',
      text: `Excluded by system filter "${layer.label}": ${layer.description}`,
    };
  }
  const matched = evaluateRule(person, rule);
  if (!matched) {
    const mismatches: string[] = [];
    function collect(node: RuleNode) {
      if (node.type === 'condition') {
        if (!evaluateRule(person, node)) {
          const fld = fieldLabels[node.field] || node.field;
          const actual = formatValue(node.field, (person as any)[node.field]);
          const expected = Array.isArray(node.value) ? node.value.map(v => formatValue(node.field, v)).join(', ') : formatValue(node.field, node.value as string);
          mismatches.push(`${fld} is "${actual}" (requires "${expected}")`);
        }
      } else {
        node.children.forEach(collect);
      }
    }
    collect(rule);
    return {
      status: 'excluded_by_rule',
      text: `Doesn't match: ${mismatches.join('; ')}`,
    };
  }
  const attrs: string[] = [];
  function collectMatch(node: RuleNode) {
    if (node.type === 'condition') {
      const fld = fieldLabels[node.field] || node.field;
      const val = Array.isArray(node.value) ? node.value.map(v => formatValue(node.field, v)).join(', ') : formatValue(node.field, node.value as string);
      attrs.push(`${fld} is ${val}`);
    } else {
      node.children.forEach(collectMatch);
    }
  }
  collectMatch(rule);
  return {
    status: 'included',
    text: `Matches: ${attrs.join(', ')}`,
  };
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

// ── Props ────────────────────────────────────────────────────────────────────

export interface PopulationDisplayProps {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  policies: PolicyRef[];
  compact?: boolean;
}

// ── Composition hint derivation ──────────────────────────────────────────────

function getCompositionHint(members: Person[], compact: boolean): string {
  if (members.length === 0) return '';
  if (compact) return '';

  // Find most common department
  const deptCounts: Record<string, number> = {};
  const locCounts: Record<string, number> = {};
  for (const p of members) {
    deptCounts[p.department] = (deptCounts[p.department] || 0) + 1;
    locCounts[p.location] = (locCounts[p.location] || 0) + 1;
  }

  const topDept = Object.entries(deptCounts).sort((a, b) => b[1] - a[1])[0];
  const topLoc = Object.entries(locCounts).sort((a, b) => b[1] - a[1])[0];
  const uniqueLocs = Object.keys(locCounts).length;

  const total = members.length;
  const parts: string[] = [];

  if (total <= 10) {
    // Small group: "All Engineering" or "Mostly Engineering"
    if (topDept[1] === total) {
      parts.push(`All ${topDept[0]}`);
    } else if (topDept[1] / total >= 0.6) {
      parts.push(`Mostly ${topDept[0]}`);
    } else {
      parts.push(`${Object.keys(deptCounts).length} departments`);
    }
  } else if (total >= 100) {
    // Large group: use percentages
    const pct = Math.round((topDept[1] / total) * 100);
    parts.push(`${pct}% ${topDept[0]}`);
  } else {
    // Medium group
    if (topDept[1] / total >= 0.5) {
      parts.push(`Mostly ${topDept[0]}`);
    } else {
      parts.push(`${Object.keys(deptCounts).length} departments`);
    }
  }

  if (uniqueLocs === 1) {
    parts.push(topLoc[0]);
  } else if (total >= 100) {
    parts.push(`${uniqueLocs} locations`);
  } else if (topLoc[1] / total >= 0.4) {
    parts.push(topLoc[0]);
  } else {
    parts.push(`${uniqueLocs} locations`);
  }

  return parts.join(' · ');
}

// ── Pagination helper ────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── Main component ───────────────────────────────────────────────────────────

type PanelType = 'count' | 'members' | 'policies' | null;

export default function CompositionStrip({
  members,
  allPeople,
  rule,
  layers,
  excludedByLayers,
  policies,
  compact = false,
}: PopulationDisplayProps) {
  const [expandedPanel, setExpandedPanel] = useState<PanelType>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [memberPage, setMemberPage] = useState(0);
  const [memberSearch, setMemberSearch] = useState('');

  const totalExcluded = useMemo(
    () => excludedByLayers.reduce((sum, e) => sum + e.people.length, 0),
    [excludedByLayers],
  );

  const compositionHint = useMemo(
    () => getCompositionHint(members, !!compact),
    [members, compact],
  );

  const totalAffected = useMemo(
    () => policies.reduce((sum, p) => sum + p.affectedCount, 0),
    [policies],
  );

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.toLowerCase();
    return members.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.department.toLowerCase().includes(q) ||
      p.location.toLowerCase().includes(q) ||
      p.title.toLowerCase().includes(q)
    );
  }, [members, memberSearch]);

  const totalPages = Math.ceil(filteredMembers.length / PAGE_SIZE);
  const pagedMembers = filteredMembers.slice(memberPage * PAGE_SIZE, (memberPage + 1) * PAGE_SIZE);

  const togglePanel = useCallback((panel: PanelType) => {
    setExpandedPanel(prev => prev === panel ? null : panel);
    setSelectedPerson(null);
    setMemberPage(0);
    setMemberSearch('');
  }, []);

  // How many avatars to show
  const maxAvatars = compact ? 3 : 5;
  const visibleMembers = members.slice(0, maxAvatars);
  const overflowCount = members.length - maxAvatars;

  const pad = compact ? 10 : 16;
  const avatarSize = compact ? 24 : 28;

  // ── Zone button wrapper ──────────────────────────────────────────────────

  const ZoneButton = ({ zone, children, ariaLabel, style: extraStyle }: {
    zone: PanelType;
    children: React.ReactNode;
    ariaLabel: string;
    style?: React.CSSProperties;
  }) => {
    const isExpanded = expandedPanel === zone;
    const isHovered = hoveredZone === zone;

    return (
      <button
        role="button"
        aria-expanded={isExpanded}
        aria-label={ariaLabel}
        onClick={() => togglePanel(zone)}
        onMouseEnter={() => setHoveredZone(zone)}
        onMouseLeave={() => setHoveredZone(null)}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: isHovered ? 'rgba(0,0,0,0.04)' : 'transparent',
          border: 'none',
          borderBottom: isExpanded ? `2px solid ${C.accent}` : '2px solid transparent',
          cursor: 'pointer',
          padding: `8px ${pad}px`,
          borderRadius: 8,
          transition: 'background 120ms ease, border-color 120ms ease',
          fontFamily: FONT,
          position: 'relative',
          ...extraStyle,
        }}
      >
        {children}
        {isHovered && (
          <span style={{
            position: 'absolute',
            right: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 10,
            color: C.textMuted,
            lineHeight: 1,
          }}>▾</span>
        )}
      </button>
    );
  };

  // ── Strip ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ fontFamily: FONT }}>
      {/* The horizontal strip */}
      <div
        role="toolbar"
        aria-label="Population summary"
        style={{
          display: 'flex',
          alignItems: 'center',
          background: C.surfaceAlt,
          borderRadius: 12,
          minHeight: compact ? 52 : 60,
          gap: 0,
          overflow: 'hidden',
        }}
      >
        {/* Left zone: Hero count */}
        <ZoneButton
          zone={totalExcluded > 0 ? 'count' : 'members'}
          ariaLabel={`${members.length} people${totalExcluded > 0 ? `, ${totalExcluded} excluded` : ''}`}
          style={{ flex: '0 0 auto' }}
        >
          <span style={{
            fontSize: compact ? 22 : 28,
            fontWeight: 700,
            color: C.text,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}>
            {members.length}
          </span>
          <span style={{
            fontSize: 12,
            color: C.textMuted,
            lineHeight: 1.3,
            marginTop: 1,
          }}>
            people
          </span>
          {totalExcluded > 0 && (
            <span style={{
              fontSize: 11,
              color: C.amber,
              lineHeight: 1.3,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 1,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: C.amber, flexShrink: 0,
              }} />
              {totalExcluded} excluded
            </span>
          )}
        </ZoneButton>

        {/* Thin separator */}
        <div style={{
          width: 1, height: 32,
          background: C.border,
          flexShrink: 0,
        }} />

        {/* Center zone: Avatar stack + composition hint */}
        <ZoneButton
          zone="members"
          ariaLabel={`View ${members.length} members`}
          style={{
            flex: 1,
            alignItems: 'center',
            minWidth: 0,
          }}
        >
          {/* Avatar row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
          }}>
            {visibleMembers.map((p, i) => (
              <div
                key={p.id}
                style={{
                  marginLeft: i > 0 ? -8 : 0,
                  zIndex: maxAvatars - i,
                  position: 'relative',
                }}
                title={p.name}
              >
                <Avatar name={p.name} size={avatarSize} />
              </div>
            ))}
            {overflowCount > 0 && (
              <div
                aria-label={`and ${overflowCount} more people`}
                style={{
                  marginLeft: -8,
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: '50%',
                  background: C.border,
                  color: C.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  flexShrink: 0,
                  border: '1px solid rgba(0,0,0,0.08)',
                  zIndex: 0,
                }}
              >
                +{overflowCount}
              </div>
            )}
          </div>

          {/* Composition hint */}
          {compositionHint && (
            <span style={{
              fontSize: 12,
              color: C.textMuted,
              lineHeight: 1.3,
              marginTop: 3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}>
              {compositionHint}
            </span>
          )}
        </ZoneButton>

        {/* Policy zone (only if policies exist) */}
        {policies.length > 0 && (
          <>
            <div style={{
              width: 1, height: 32,
              background: C.border,
              flexShrink: 0,
            }} />

            <ZoneButton
              zone="policies"
              ariaLabel={`${policies.length} downstream policies, ${totalAffected.toLocaleString()} affected`}
              style={{
                flex: '0 0 auto',
                alignItems: 'flex-end',
              }}
            >
              <span style={{
                fontSize: 13,
                fontWeight: 500,
                color: C.text,
                lineHeight: 1.3,
              }}>
                {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
              </span>
              {!compact && (
                <span style={{
                  fontSize: 12,
                  color: C.textMuted,
                  lineHeight: 1.3,
                  marginTop: 1,
                }}>
                  {totalAffected.toLocaleString()} affected
                </span>
              )}
            </ZoneButton>
          </>
        )}
      </div>

      {/* ── Expanded panel below the strip ──────────────────────────────────── */}
      {expandedPanel && (
        <div style={{ position: 'relative', marginTop: 8 }}>
          {/* Notch connector */}
          <div style={{
            position: 'absolute',
            top: -8,
            left: expandedPanel === 'count' ? (compact ? 30 : 40)
              : expandedPanel === 'members' ? '50%'
              : undefined,
            right: expandedPanel === 'policies' ? (compact ? 30 : 50) : undefined,
            transform: expandedPanel === 'members' ? 'translateX(-50%)' : undefined,
            width: 16, height: 8,
            overflow: 'hidden',
          }}>
            <div style={{
              width: 16, height: 16,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 3,
              transform: 'rotate(45deg)',
              transformOrigin: 'center center',
              marginTop: 4,
            }} />
          </div>

          <div style={{
            background: C.surface,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            boxShadow: S.card,
            overflow: 'hidden',
          }}>
            {/* ── Count / Exclusion panel ─────────────────────────────────── */}
            {expandedPanel === 'count' && (
              <div style={{ padding: compact ? 14 : 20 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 14,
                }}>
                  Evaluation layers
                </div>

                {excludedByLayers.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textMuted }}>
                    No exclusions — all matching people are included.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {excludedByLayers.map(({ layer, people: excluded }) => (
                      <div key={layer.id} style={{
                        padding: 12,
                        background: C.amberLight,
                        borderRadius: 8,
                        border: `1px solid ${C.amberBorder}`,
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          marginBottom: 6,
                        }}>
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.04em',
                            color: C.amber,
                          }}>
                            {layer.type.replace(/_/g, ' ')}
                          </span>
                          <span style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: C.amber,
                            background: 'rgba(221,91,0,0.1)',
                            padding: '1px 6px',
                            borderRadius: 4,
                          }}>
                            −{excluded.length}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 13,
                          color: C.textSecondary,
                          marginBottom: 8,
                        }}>
                          {layer.description}
                        </div>
                        <div style={{
                          display: 'flex',
                          flexWrap: 'wrap' as const,
                          gap: 6,
                        }}>
                          {excluded.map(p => (
                            <button
                              key={p.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPerson(selectedPerson === p.id ? null : p.id);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: '3px 8px 3px 3px',
                                background: selectedPerson === p.id ? C.amberBorder : 'rgba(255,255,255,0.7)',
                                border: `1px solid ${C.amberBorder}`,
                                borderRadius: 20,
                                cursor: 'pointer',
                                fontFamily: FONT,
                                fontSize: 12,
                                color: C.textSecondary,
                                transition: 'background 100ms',
                              }}
                            >
                              <Avatar name={p.name} size={20} />
                              {p.name}
                            </button>
                          ))}
                        </div>

                        {/* Inline explanation for selected excluded person */}
                        {excluded.some(p => p.id === selectedPerson) && selectedPerson && (() => {
                          const person = excluded.find(p => p.id === selectedPerson)!;
                          const explanation = explainPerson(person, rule, layers);
                          return (
                            <div style={{
                              marginTop: 8,
                              padding: '8px 10px',
                              background: 'rgba(255,255,255,0.85)',
                              borderRadius: 6,
                              fontSize: 12,
                              color: C.textSecondary,
                              lineHeight: 1.5,
                              borderLeft: `3px solid ${C.amber}`,
                            }}>
                              <strong>{person.name}</strong> — {person.title}, {person.department}
                              <br />
                              {explanation.text}
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Members panel ────────────────────────────────────────── */}
            {expandedPanel === 'members' && (
              <div style={{ padding: compact ? 14 : 20 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 12,
                }}>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: C.text,
                  }}>
                    {filteredMembers.length === members.length
                      ? `All ${members.length} members`
                      : `${filteredMembers.length} of ${members.length} members`}
                  </span>
                </div>

                {/* Search (shown for >50 members) */}
                {members.length > 50 && (
                  <input
                    type="text"
                    placeholder="Search members…"
                    value={memberSearch}
                    onChange={e => { setMemberSearch(e.target.value); setMemberPage(0); }}
                    style={{
                      width: '100%',
                      padding: '7px 10px',
                      fontSize: 13,
                      fontFamily: FONT,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      outline: 'none',
                      marginBottom: 12,
                      boxSizing: 'border-box' as const,
                      background: C.surfaceAlt,
                      color: C.text,
                    }}
                  />
                )}

                {/* Member rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {pagedMembers.map(p => {
                    const isSelected = selectedPerson === p.id;
                    return (
                      <div key={p.id}>
                        <button
                          onClick={() => setSelectedPerson(isSelected ? null : p.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            width: '100%',
                            padding: '6px 8px',
                            background: isSelected ? C.accentLight : 'transparent',
                            border: 'none',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontFamily: FONT,
                            textAlign: 'left' as const,
                            transition: 'background 80ms',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt;
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <Avatar name={p.name} size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: C.text,
                              lineHeight: 1.3,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {p.name}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: C.textMuted,
                              lineHeight: 1.3,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {p.title} · {p.department}{!compact ? ` · ${p.location}` : ''}
                            </div>
                          </div>
                        </button>

                        {/* Explanation popover inline */}
                        {isSelected && (() => {
                          const explanation = explainPerson(p, rule, layers);
                          const statusColor = explanation.status === 'included' ? C.green
                            : explanation.status === 'excluded_by_layer' ? C.amber
                            : C.red;
                          return (
                            <div style={{
                              margin: '2px 0 6px 46px',
                              padding: '8px 10px',
                              background: C.surfaceAlt,
                              borderRadius: 6,
                              fontSize: 12,
                              color: C.textSecondary,
                              lineHeight: 1.5,
                              borderLeft: `3px solid ${statusColor}`,
                            }}>
                              {explanation.text}
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: `1px solid ${C.border}`,
                  }}>
                    <button
                      disabled={memberPage === 0}
                      onClick={() => setMemberPage(p => p - 1)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontFamily: FONT,
                        border: `1px solid ${C.border}`,
                        borderRadius: 5,
                        background: C.surface,
                        color: memberPage === 0 ? C.textMuted : C.text,
                        cursor: memberPage === 0 ? 'default' : 'pointer',
                        opacity: memberPage === 0 ? 0.5 : 1,
                      }}
                    >
                      ← Prev
                    </button>
                    <span style={{ fontSize: 12, color: C.textMuted }}>
                      {memberPage + 1} of {totalPages}
                    </span>
                    <button
                      disabled={memberPage >= totalPages - 1}
                      onClick={() => setMemberPage(p => p + 1)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        fontFamily: FONT,
                        border: `1px solid ${C.border}`,
                        borderRadius: 5,
                        background: C.surface,
                        color: memberPage >= totalPages - 1 ? C.textMuted : C.text,
                        cursor: memberPage >= totalPages - 1 ? 'default' : 'pointer',
                        opacity: memberPage >= totalPages - 1 ? 0.5 : 1,
                      }}
                    >
                      Next →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* ── Policies panel ───────────────────────────────────────── */}
            {expandedPanel === 'policies' && (
              <div style={{ padding: compact ? 14 : 20 }}>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: C.text,
                  marginBottom: 14,
                }}>
                  Downstream policies
                </div>

                {policies.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textMuted }}>
                    No downstream policies reference this group.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {policies.map(p => {
                      const tc = tierColor(p.sensitivityTier);
                      return (
                        <div key={p.id} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 12px',
                          background: C.surfaceAlt,
                          borderRadius: 8,
                          border: `1px solid ${C.border}`,
                        }}>
                          {/* Tier badge */}
                          <span style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: tc.bg,
                            color: tc.text,
                            border: `1px solid ${tc.border}`,
                            flexShrink: 0,
                            textTransform: 'uppercase' as const,
                            letterSpacing: '0.03em',
                          }}>
                            {tierLabel(p.sensitivityTier)}
                          </span>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 500,
                              color: C.text,
                              lineHeight: 1.3,
                            }}>
                              {p.name}
                            </div>
                            <div style={{
                              fontSize: 12,
                              color: C.textMuted,
                              lineHeight: 1.3,
                              marginTop: 1,
                            }}>
                              {p.domain} · {p.affectedCount.toLocaleString()} affected
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import type {
  Person,
  RuleGroup,
  RuleNode,
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

// ── Shared helpers ───────────────────────────────────────────────────────────

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

// ── Props ────────────────────────────────────────────────────────────────────

export interface PopulationDisplayProps {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  policies: PolicyRef[];
  compact?: boolean;
  delta?: {
    added: Person[];
    removed: Person[];
  };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function PersonRow({ person, onClick, selected, compact }: {
  person: Person;
  onClick: () => void;
  selected?: boolean;
  compact?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: compact ? '6px 0' : '8px 0',
        borderRadius: 8, border: 'none', width: '100%', textAlign: 'left',
        background: selected ? C.accentLight : 'transparent',
        cursor: 'pointer', fontFamily: FONT,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = selected ? C.accentLight : 'transparent'; }}
    >
      <Avatar name={person.name} size={compact ? 26 : 30} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 14, fontWeight: 500, color: C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {person.name}
          {person.roleState === 'pending' && (
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.125, color: C.amber, background: C.amberLight, borderRadius: 9999, padding: '1px 7px' }}>Pending</span>
          )}
          {person.roleState === 'terminated' && (
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.125, color: C.red, background: C.redLight, borderRadius: 9999, padding: '1px 7px' }}>Terminated</span>
          )}
        </div>
        {!compact && (
          <div style={{ fontSize: 13, color: C.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
            {person.title} · {person.department} · {person.location}
          </div>
        )}
      </div>
    </button>
  );
}

function PaginationButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        background: disabled ? 'transparent' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${C.border}`, borderRadius: 4,
        padding: '3px 12px', fontSize: 13, fontFamily: FONT, fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? C.textMuted : C.textSecondary,
        opacity: disabled ? 0.5 : 1,
        transition: 'background 0.1s',
      }}
    >
      {label}
    </button>
  );
}

function DeltaPersonRow({ person, type, compact }: {
  person: Person;
  type: 'added' | 'removed';
  compact?: boolean;
}) {
  const accent = type === 'added' ? C.green : C.red;
  const bg = type === 'added' ? C.greenLight : C.redLight;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: compact ? '4px 8px' : '5px 8px',
      borderRadius: 8, background: bg,
      marginBottom: 2,
    }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: accent, width: 14, textAlign: 'center', flexShrink: 0 }}>
        {type === 'added' ? '+' : '−'}
      </span>
      <Avatar name={person.name} size={compact ? 22 : 24} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 500, color: C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {person.name}
        </div>
        {!compact && (
          <div style={{ fontSize: 12, color: C.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {person.title} · {person.department}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab button (Notion-style: icon-only resting, icon+label on hover/active) ─

function TabButton({ icon, label, isActive, onClick, badge }: {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badge?: { text: string; color: string; bg: string };
}) {
  const [hovered, setHovered] = useState(false);
  const showLabel = isActive || hovered;

  const bg = isActive
    ? C.surfaceAlt
    : hovered ? 'rgba(0,0,0,0.04)' : 'transparent';

  const color = isActive
    ? C.text
    : hovered ? C.textSecondary : C.textMuted;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: showLabel ? 5 : 0,
        padding: showLabel ? '5px 10px' : '5px 7px',
        borderRadius: 8,
        border: 'none',
        cursor: 'pointer',
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: isActive ? 600 : 500,
        color,
        background: bg,
        transition: 'all 0.2s ease',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <span style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, flexShrink: 0,
        opacity: isActive ? 1 : hovered ? 0.75 : 0.5,
        transition: 'opacity 0.15s ease',
      }}>
        {icon}
      </span>
      <span style={{
        maxWidth: showLabel ? 150 : 0,
        opacity: showLabel ? 1 : 0,
        overflow: 'hidden',
        transition: 'max-width 0.2s ease, opacity 0.15s ease',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        {label}
        {badge && (
          <span style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 0.2,
            color: badge.color, background: badge.bg,
            borderRadius: 9999, padding: '1px 6px',
            lineHeight: '16px',
          }}>
            {badge.text}
          </span>
        )}
      </span>
      {/* Badge dot when collapsed (not hovered, not active) — signals there's a delta */}
      {badge && !showLabel && (
        <span style={{
          position: 'absolute', top: 3, right: 3,
          width: 6, height: 6, borderRadius: '50%',
          background: badge.color,
        }} />
      )}
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function Layout7BaselineRefined({
  members,
  allPeople,
  rule,
  layers,
  excludedByLayers,
  policies,
  compact,
  delta,
}: PopulationDisplayProps) {
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const total = members.length;
  const totalAffected = policies.reduce((sum, p) => sum + p.affectedCount, 0);

  type Tab = 'members' | 'excluded' | 'impact';
  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = compact ? 6 : 8;
  const avatarStackCount = compact ? 3 : 5;

  const hasExcluded = totalExcluded > 0;
  const hasPolicies = policies.length > 0;
  const hasDelta = delta && (delta.added.length > 0 || delta.removed.length > 0);

  const membersBadge = hasDelta ? {
    text: `+${delta!.added.length} −${delta!.removed.length}`,
    color: delta!.added.length > 0 && delta!.removed.length > 0 ? C.amber
      : delta!.added.length > 0 ? C.green : C.red,
    bg: delta!.added.length > 0 && delta!.removed.length > 0 ? C.amberLight
      : delta!.added.length > 0 ? C.greenLight : C.redLight,
  } : undefined;

  const impactBadge = hasDelta && hasPolicies ? {
    text: 'affected',
    color: C.amber,
    bg: C.amberLight,
  } : undefined;

  const tabs: { id: Tab; icon: React.ReactNode; label: string; show: boolean; badge?: { text: string; color: string; bg: string } }[] = [
    {
      id: 'members',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="5" r="2.5" />
          <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
          <circle cx="11.5" cy="5.5" r="1.8" />
          <path d="M11.5 9.5c1.8 0 3.2 1.1 3.2 2.8" />
        </svg>
      ),
      label: `${total} people`,
      show: total > 0,
      badge: membersBadge,
    },
    {
      id: 'excluded',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M4.1 11.9L11.9 4.1" />
        </svg>
      ),
      label: `${totalExcluded} excluded`,
      show: hasExcluded,
    },
    {
      id: 'impact',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-2" />
          <path d="M9 2h5v5" />
          <path d="M14 2L7 9" />
        </svg>
      ),
      label: `${policies.length} ${policies.length === 1 ? 'policy' : 'policies'}`,
      show: hasPolicies,
      badge: impactBadge,
    },
  ];

  function handleTabClick(id: Tab) {
    if (activeTab === id) return;
    setActiveTab(id);
    setSelectedPerson(null);
    setPage(0);
  }

  if (total === 0) {
    return (
      <div
        role="region"
        aria-label="Population summary"
        style={{
          background: C.surface, borderRadius: 14, boxShadow: S.card,
          border: `1px solid ${C.border}`, padding: compact ? 14 : 18, fontFamily: FONT,
        }}
      >
        <div style={{ padding: '6px 0', color: C.textMuted, fontSize: 14 }}>
          No one matches these conditions.
        </div>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Population summary"
      style={{
        background: C.surface,
        borderRadius: 14,
        boxShadow: S.card,
        border: `1px solid ${C.border}`,
        fontFamily: FONT,
        overflow: 'hidden',
      }}
    >
      {/* ── Tab bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '10px 16px 0',
      }}>
        {tabs.filter(t => t.show).map(t => (
          <TabButton
            key={t.id}
            icon={t.icon}
            label={t.label}
            isActive={activeTab === t.id}
            onClick={() => handleTabClick(t.id)}
            badge={t.badge}
          />
        ))}
      </div>

      {/* ── Tab content ── */}
      <div style={{ padding: compact ? '10px 14px 14px' : '12px 16px 16px' }}>

        {/* Members tab */}
        {activeTab === 'members' && (
          <div>
            {/* Delta summary (edit mode) */}
            {hasDelta && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                {delta!.added.length > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: C.green,
                    background: C.greenLight, borderRadius: 9999, padding: '3px 10px',
                  }}>
                    +{delta!.added.length} joining
                  </span>
                )}
                {delta!.removed.length > 0 && (
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: C.red,
                    background: C.redLight, borderRadius: 9999, padding: '3px 10px',
                  }}>
                    −{delta!.removed.length} leaving
                  </span>
                )}
              </div>
            )}

            {/* Added people (edit mode) */}
            {hasDelta && delta!.added.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.green, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Joining
                </div>
                {delta!.added.slice(0, 4).map(p => (
                  <DeltaPersonRow key={p.id} person={p} type="added" compact={compact} />
                ))}
                {delta!.added.length > 4 && (
                  <div style={{ fontSize: 12, color: C.textMuted, padding: '3px 0 0 34px' }}>
                    +{delta!.added.length - 4} more
                  </div>
                )}
              </div>
            )}

            {/* Removed people (edit mode) */}
            {hasDelta && delta!.removed.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: C.red, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Leaving
                </div>
                {delta!.removed.slice(0, 4).map(p => (
                  <DeltaPersonRow key={p.id} person={p} type="removed" compact={compact} />
                ))}
                {delta!.removed.length > 4 && (
                  <div style={{ fontSize: 12, color: C.textMuted, padding: '3px 0 0 34px' }}>
                    +{delta!.removed.length - 4} more
                  </div>
                )}
              </div>
            )}

            {/* Separator between delta and full list */}
            {hasDelta && (
              <div style={{ height: 1, background: C.border, margin: '8px 0' }} />
            )}

            {/* Face pile summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {members.slice(0, avatarStackCount).map((p, i) => (
                  <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: avatarStackCount - i, position: 'relative' }}>
                    <Avatar name={p.name} size={26} />
                  </div>
                ))}
                {total > avatarStackCount && (
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: C.surfaceAlt, color: C.textSecondary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 600, marginLeft: -8,
                    border: '1px solid rgba(0,0,0,0.1)',
                  }}>
                    +{total - avatarStackCount}
                  </div>
                )}
              </div>
            </div>

            {/* Paginated member list with inline explanation */}
            <div style={{ marginTop: 6 }}>
              {members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(p => {
                const isSelected = selectedPerson?.id === p.id;
                const personExplanation = isSelected ? explainPerson(p, rule, layers) : null;
                return (
                  <div key={p.id}>
                    <PersonRow
                      person={p}
                      onClick={() => setSelectedPerson(isSelected ? null : p)}
                      selected={isSelected}
                      compact={compact}
                    />
                    {isSelected && personExplanation && (
                      <div style={{
                        margin: '0 0 4px 0',
                        padding: '8px 10px 8px 12px',
                        background: personExplanation.status === 'included' ? C.greenLight
                          : personExplanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
                        borderRadius: '0 0 10px 10px',
                        borderLeft: `2px solid ${
                          personExplanation.status === 'included' ? C.green
                            : personExplanation.status === 'excluded_by_layer' ? C.amber : C.red
                        }`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div style={{ color: C.text, fontSize: 12, lineHeight: 1.5 }}>
                            {personExplanation.text}
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedPerson(null); }}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: C.textMuted, fontSize: 14, padding: '0 2px', lineHeight: 1,
                              flexShrink: 0, marginLeft: 8,
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {total > PAGE_SIZE && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 0 0',
                }}>
                  <span style={{ fontSize: 12, color: C.textMuted }}>
                    {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <PaginationButton label="Prev" onClick={() => setPage(p => p - 1)} disabled={page === 0} />
                    <PaginationButton label="Next" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Excluded tab */}
        {activeTab === 'excluded' && hasExcluded && (
          <div>
            {excludedByLayers.map(({ layer, people }) => (
              <div key={layer.id} style={{ marginBottom: excludedByLayers.length > 1 ? 12 : 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 3 }}>
                  {layer.label}
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, marginBottom: 8 }}>
                  {layer.description}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {people.slice(0, 8).map(p => (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '5px 0',
                    }}>
                      <Avatar name={p.name} size={24} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.name}</span>
                      <span style={{
                        fontSize: 11, fontWeight: 600, color: C.amber,
                        background: C.amberLight, borderRadius: 9999, padding: '1px 7px',
                        marginLeft: 'auto',
                      }}>
                        Excluded
                      </span>
                    </div>
                  ))}
                  {people.length > 8 && (
                    <div style={{ fontSize: 12, color: C.textMuted, padding: '4px 0' }}>
                      +{people.length - 8} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Impact tab */}
        {activeTab === 'impact' && hasPolicies && (
          <div>
            {/* Delta warning banner */}
            {hasDelta && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 8,
                padding: '8px 10px', marginBottom: 10,
                background: C.amberLight, border: `1px solid ${C.amberBorder}`,
                borderRadius: 8, fontSize: 13, color: C.text, lineHeight: 1.45,
              }}>
                <span style={{ flexShrink: 0, fontSize: 15, marginTop: -1 }}>⚠</span>
                <span>
                  This change affects <strong>{policies.length} {policies.length === 1 ? 'policy' : 'policies'}</strong>.
                  {delta!.added.length > 0 && <> <strong style={{ color: C.green }}>+{delta!.added.length}</strong> {delta!.added.length === 1 ? 'person gains' : 'people gain'} coverage.</>}
                  {delta!.removed.length > 0 && <> <strong style={{ color: C.red }}>−{delta!.removed.length}</strong> {delta!.removed.length === 1 ? 'person loses' : 'people lose'} coverage.</>}
                </span>
              </div>
            )}

            <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 10 }}>
              {totalAffected.toLocaleString()} people affected across {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
            </div>
            {policies.map(p => {
              const pc = tierColor(p.sensitivityTier);
              return (
                <div key={p.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', marginBottom: 4,
                  background: C.surfaceAlt, borderRadius: 8,
                  fontSize: 13,
                }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 9999,
                    background: pc.bg, color: pc.text,
                    textTransform: 'uppercase', letterSpacing: 0.5,
                    flexShrink: 0,
                  }}>
                    {tierLabel(p.sensitivityTier)}
                  </span>
                  <span style={{ fontWeight: 500, color: C.text }}>{p.name}</span>
                  <span style={{ color: C.textMuted, marginLeft: 'auto', fontSize: 12 }}>
                    {p.affectedCount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

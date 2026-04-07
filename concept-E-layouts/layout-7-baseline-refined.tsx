import { useState } from 'react';
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

// ── Divider ──────────────────────────────────────────────────────────────────

function Divider({ compact }: { compact?: boolean }) {
  return (
    <div
      role="separator"
      style={{
        height: 1,
        background: C.border,
        margin: compact ? '8px 0' : '12px 0',
      }}
    />
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
}: PopulationDisplayProps) {
  const padding = compact ? 14 : 20;
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const total = members.length;

  // — Section 1: Exclusion detail expansion
  const [exclusionExpanded, setExclusionExpanded] = useState(false);

  // — Section 2: Population state
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = compact ? 5 : 8;
  const showFaces = total <= 20;
  const avatarStackCount = compact ? 3 : 5;

  const explanation = selectedPerson ? explainPerson(selectedPerson, rule, layers) : null;

  // — Section 3: Impact expansion
  const [impactExpanded, setImpactExpanded] = useState(false);
  const totalAffected = policies.reduce((sum, p) => sum + p.affectedCount, 0);

  // Determine if the card is "short" (few members, small overall) — use tighter divider margins
  const isShort = total <= 5;
  const dividerCompact = compact || isShort;

  return (
    <div
      role="region"
      aria-label="Population summary"
      style={{
        background: C.surface,
        borderRadius: 16,
        boxShadow: S.card,
        border: `1px solid ${C.border}`,
        padding,
        fontFamily: FONT,
      }}
    >
      {/* ═══ Section 1: Match count + exclusion indicator ═══ */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: 24,
        }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
            {total} {total === 1 ? 'person' : 'people'}
          </span>
          {totalExcluded > 0 && (
            <button
              onClick={() => setExclusionExpanded(!exclusionExpanded)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                padding: 0, fontFamily: FONT, fontSize: 14,
              }}
            >
              <span style={{
                fontWeight: 600, color: C.amber, background: C.amberLight,
                borderRadius: 9999, padding: '2px 9px', fontSize: 13, letterSpacing: 0.125,
              }}>
                {totalExcluded} excluded
              </span>
              <span style={{ fontSize: 13, color: C.accent, fontWeight: 500 }}>
                {exclusionExpanded ? 'Hide' : 'Details'}
              </span>
            </button>
          )}
        </div>

        {/* Exclusion detail expansion */}
        {exclusionExpanded && totalExcluded > 0 && (
          <div style={{ marginTop: 10 }}>
            {excludedByLayers.map(({ layer, people }) => (
              <div key={layer.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 3 }}>
                  {layer.label}
                </div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>
                  {layer.description}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {people.slice(0, 5).map(p => (
                    <span key={p.id} style={{
                      fontSize: 12, fontWeight: 600, letterSpacing: 0.125,
                      background: C.amberLight, color: C.amber,
                      borderRadius: 9999, padding: '2px 8px',
                    }}>
                      {p.name}
                    </span>
                  ))}
                  {people.length > 5 && (
                    <span style={{ fontSize: 12, color: C.textMuted, padding: '2px 4px' }}>
                      +{people.length - 5} more
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══ Divider 1 ═══ */}
      <Divider compact={dividerCompact} />

      {/* ═══ Section 2: Population member list ═══ */}
      <div>
        {total === 0 ? (
          <div style={{ padding: '10px 0', color: C.textMuted, fontSize: 14 }}>
            No one matches these conditions.
          </div>
        ) : (
          <>
            {/* Avatar stack header (only when >20 people, i.e. summary mode) */}
            {!showFaces && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {members.slice(0, avatarStackCount).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: avatarStackCount - i, position: 'relative' }}>
                      <Avatar name={p.name} size={28} />
                    </div>
                  ))}
                  {total > avatarStackCount && (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: C.surfaceAlt, color: C.textSecondary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, marginLeft: -8,
                      border: '1px solid rgba(0,0,0,0.1)',
                    }}>
                      +{total - avatarStackCount}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 14, fontWeight: 500, color: C.textSecondary }}>
                  {total} people
                </span>
              </div>
            )}

            {/* Person rows */}
            {showFaces ? (
              <>
                {members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(p => (
                  <PersonRow
                    key={p.id}
                    person={p}
                    onClick={() => setSelectedPerson(selectedPerson?.id === p.id ? null : p)}
                    selected={selectedPerson?.id === p.id}
                    compact={compact}
                  />
                ))}
                {total > PAGE_SIZE && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0 2px',
                  }}>
                    <span style={{ fontSize: 13, color: C.textSecondary }}>
                      {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <PaginationButton label="Prev" onClick={() => setPage(p => p - 1)} disabled={page === 0} />
                      <PaginationButton label="Next" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= total} />
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                {(showAll ? members : members.slice(0, 5)).map((p, _i, arr) => {
                  // When showAll + many members, cap the visible list and add internal scroll
                  return (
                    <PersonRow
                      key={p.id}
                      person={p}
                      onClick={() => setSelectedPerson(selectedPerson?.id === p.id ? null : p)}
                      selected={selectedPerson?.id === p.id}
                      compact={compact}
                    />
                  );
                })}
                {!showAll && total > 5 && (
                  <button
                    onClick={() => setShowAll(true)}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.accent, fontSize: 14, fontFamily: FONT, fontWeight: 500,
                      padding: '8px 0',
                    }}
                  >
                    Show all {total} people
                  </button>
                )}
                {showAll && total > 20 && (
                  <button
                    onClick={() => { setShowAll(false); setSelectedPerson(null); }}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: C.accent, fontSize: 14, fontFamily: FONT, fontWeight: 500,
                      padding: '8px 0',
                    }}
                  >
                    Show fewer
                  </button>
                )}
              </>
            )}

            {/* Person explanation popover */}
            {selectedPerson && explanation && (
              <div style={{
                marginTop: 8, padding: '12px 14px',
                background: explanation.status === 'included' ? C.greenLight : explanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
                border: `1px solid ${C.border}`,
                borderRadius: 12, boxShadow: S.card,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar name={selectedPerson.name} size={24} />
                    <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{selectedPerson.name}</span>
                  </div>
                  <button
                    onClick={() => setSelectedPerson(null)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16, padding: '2px 4px', lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
                <div style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>
                  {explanation.text}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ═══ Divider 2 (only if policies exist) ═══ */}
      {policies.length > 0 && <Divider compact={dividerCompact} />}

      {/* ═══ Section 3: Downstream impact ═══ */}
      {policies.length > 0 && (
        <div>
          <button
            onClick={() => setImpactExpanded(!impactExpanded)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: 0, fontSize: 14, fontFamily: FONT, fontWeight: 500,
              color: C.text, textAlign: 'left',
            }}
          >
            {compact ? (
              <>
                <span style={{ fontWeight: 600 }}>
                  {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
                </span>
                <span style={{ color: C.textSecondary, fontWeight: 400 }}>
                  · {totalAffected.toLocaleString()} affected
                </span>
              </>
            ) : (
              <>
                <span>
                  Referenced by <strong>{policies.length} {policies.length === 1 ? 'policy' : 'policies'}</strong>
                </span>
                <span style={{ color: C.textSecondary, fontWeight: 400 }}>
                  · {totalAffected.toLocaleString()} people affected
                </span>
              </>
            )}
            <span style={{ marginLeft: 'auto', fontSize: 13, color: C.accent, fontWeight: 500, flexShrink: 0 }}>
              {impactExpanded ? 'Hide' : 'Details'}
            </span>
          </button>

          {impactExpanded && (
            <div style={{ marginTop: 10, borderTop: '1px solid rgba(0,0,0,0.06)', paddingTop: 10 }}>
              {policies.map(p => {
                const pc = tierColor(p.sensitivityTier);
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 0', fontSize: 14,
                    flexWrap: compact ? 'wrap' : 'nowrap',
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                      background: pc.bg, color: pc.text,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                      flexShrink: 0,
                    }}>
                      {tierLabel(p.sensitivityTier)}
                    </span>
                    <span style={{ fontWeight: 500, color: C.text }}>{p.name}</span>
                    <span style={{
                      color: C.textSecondary, marginLeft: compact ? 0 : 'auto', fontSize: 13,
                      ...(compact ? { width: '100%', paddingLeft: 50 } : {}),
                    }}>
                      {p.domain} · {p.affectedCount.toLocaleString()} people
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

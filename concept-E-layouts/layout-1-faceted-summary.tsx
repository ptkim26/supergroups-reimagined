import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type {
  Person,
  RuleGroup,
  RuleCondition,
  RuleNode,
  EvaluationLayer,
  PolicyRef,
  SensitivityTier,
} from '../shell/types';

// ── PopulationDisplayProps (shared contract from README) ─────────────────────

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

// ── Facet color palette ──────────────────────────────────────────────────────
// Muted, cohesive palette inspired by Notion/Linear database chart colors.

const FACET_PALETTE = [
  '#5B8FF9', // blue
  '#61DDAA', // green
  '#F6BD16', // gold
  '#7262FD', // indigo
  '#78D3F8', // sky
  '#9661BC', // purple
  '#F6903D', // orange
  '#008685', // teal
  '#F08BB4', // pink
  '#7B9E89', // sage
  '#5D7092', // slate
  '#D4B106', // olive gold
];

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) & 0xFFFF;
  return hash;
}

function getFacetColor(value: string): string {
  return FACET_PALETTE[hashString(value) % FACET_PALETTE.length];
}

// ── Extract rule fields ──────────────────────────────────────────────────────

function extractRuleFields(rule: RuleNode): string[] {
  const fields: string[] = [];
  if (rule.type === 'condition') {
    if (rule.field && !fields.includes(rule.field)) fields.push(rule.field);
  } else {
    for (const child of rule.children) {
      for (const f of extractRuleFields(child)) {
        if (!fields.includes(f)) fields.push(f);
      }
    }
  }
  return fields;
}

// ── Facet computation ────────────────────────────────────────────────────────

interface FacetSegment {
  value: string;
  label: string;
  count: number;
  color: string;
}

interface Facet {
  field: string;
  label: string;
  segments: FacetSegment[];
  total: number;
}

const FACET_FIELDS = ['department', 'location', 'country', 'employmentType', 'roleState'];

function computeFacets(members: Person[], rule: RuleGroup, compact: boolean): Facet[] {
  // Determine which dimensions to show: rule fields + department as default
  const ruleFields = extractRuleFields(rule).filter(f => FACET_FIELDS.includes(f));
  const dimensions = [...ruleFields];
  if (!dimensions.includes('department')) dimensions.unshift('department');
  // Cap at 3 dimensions
  const dims = dimensions.slice(0, 3);

  return dims.map(field => {
    const counts: Record<string, number> = {};
    for (const p of members) {
      const val = String((p as any)[field]);
      counts[val] = (counts[val] || 0) + 1;
    }

    // Sort by count descending
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    // If all members have the same value, skip this facet (no variation)
    if (entries.length <= 1 && members.length <= 5) {
      // Still show it for larger populations
    }

    const segments: FacetSegment[] = entries.map(([val, count]) => ({
      value: val,
      label: formatValue(field, val),
      count,
      color: getFacetColor(val),
    }));

    return {
      field,
      label: fieldLabels[field] || field,
      segments,
      total: members.length,
    };
  }).filter(f => f.segments.length > 1 || members.length > 5);
}

// ── Person explanation ───────────────────────────────────────────────────────

function explainPerson(person: Person, rule: RuleGroup, layers: EvaluationLayer[]): { status: 'included' | 'excluded_by_layer'; text: string } {
  const layer = layers.find(l => l.excludedPeopleIds.includes(person.id));
  if (layer) {
    return {
      status: 'excluded_by_layer',
      text: `${person.name} matches the rule conditions but is excluded by "${layer.label}": ${layer.description}`,
    };
  }
  return {
    status: 'included',
    text: `${person.name} matches all rule conditions and passes all evaluation layers.`,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Facet Bar ────────────────────────────────────────────────────────────────

function FacetBar({ facet, compact, activeFilter, onSegmentClick }: {
  facet: Facet;
  compact: boolean;
  activeFilter: { field: string; value: string } | null;
  onSegmentClick: (field: string, value: string) => void;
}) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const barHeight = compact ? 6 : 10;
  const maxLegendItems = compact ? 2 : 4;

  const isFiltered = activeFilter !== null && activeFilter.field === facet.field;
  const topSegments = facet.segments.slice(0, maxLegendItems);
  const overflow = facet.segments.slice(maxLegendItems);
  const overflowCount = overflow.reduce((s, seg) => s + seg.count, 0);

  return (
    <div style={{ marginBottom: compact ? 12 : 16 }}>
      {/* Label */}
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: C.textSecondary,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.04em',
        marginBottom: 6,
        fontFamily: FONT,
      }}>
        {facet.label}
      </div>

      {/* Bar track */}
      <div
        role="img"
        aria-label={`${facet.label} breakdown: ${facet.segments.map(s => `${s.label} ${s.count}`).join(', ')}`}
        style={{
          width: '100%',
          height: barHeight,
          background: C.surfaceAlt,
          borderRadius: barHeight / 2,
          display: 'flex',
          overflow: 'hidden',
          gap: 1,
        }}
      >
        {facet.segments.map((seg) => {
          const pct = (seg.count / facet.total) * 100;
          const isActive = isFiltered && activeFilter!.value === seg.value;
          const isDimmed = isFiltered && !isActive;
          const isHovered = hoveredSegment === seg.value;

          return (
            <button
              key={seg.value}
              onClick={() => onSegmentClick(facet.field, seg.value)}
              onMouseEnter={() => setHoveredSegment(seg.value)}
              onMouseLeave={() => setHoveredSegment(null)}
              aria-label={`${seg.label}: ${seg.count} people`}
              style={{
                width: `${pct}%`,
                minWidth: pct > 0 ? 3 : 0,
                height: '100%',
                background: seg.color,
                opacity: isDimmed ? 0.3 : isHovered ? 1 : 0.8,
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                transition: 'opacity 150ms ease',
                outline: 'none',
                borderRadius: 0,
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: compact ? '4px 10px' : '4px 14px',
        marginTop: 6,
        fontSize: compact ? 11 : 12,
        fontFamily: FONT,
        color: C.textSecondary,
        lineHeight: '18px',
      }}>
        {topSegments.map((seg) => {
          const isActive = isFiltered && activeFilter!.value === seg.value;
          const isDimmed = isFiltered && !isActive;
          return (
            <button
              key={seg.value}
              onClick={() => onSegmentClick(facet.field, seg.value)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                background: 'none',
                border: 'none',
                padding: '1px 0',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: 'inherit',
                color: isDimmed ? C.textMuted : C.textSecondary,
                opacity: isDimmed ? 0.6 : 1,
                transition: 'opacity 150ms ease',
                outline: 'none',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: seg.color,
                flexShrink: 0,
                opacity: isDimmed ? 0.4 : 0.8,
              }} />
              <span style={{ fontWeight: isActive ? 600 : 400 }}>{seg.label}</span>
              <span style={{ color: C.textMuted, fontWeight: 500 }}>{seg.count}</span>
            </button>
          );
        })}
        {overflow.length > 0 && (
          <span style={{ color: C.textMuted }}>
            +{overflow.length} other{overflow.length > 1 ? 's' : ''} ({overflowCount})
          </span>
        )}
      </div>
    </div>
  );
}

// ── Member Row ───────────────────────────────────────────────────────────────

function MemberRow({ person, compact, rule, layers }: {
  person: Person;
  compact: boolean;
  rule: RuleGroup;
  layers: EvaluationLayer[];
}) {
  const [showExplanation, setShowExplanation] = useState(false);
  const explanation = useMemo(() => explainPerson(person, rule, layers), [person, rule, layers]);

  return (
    <div>
      <button
        onClick={() => setShowExplanation(!showExplanation)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: compact ? 8 : 10,
          width: '100%',
          padding: compact ? '5px 0' : '6px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontFamily: FONT,
          textAlign: 'left',
          outline: 'none',
          borderRadius: 6,
        }}
      >
        <Avatar name={person.name} size={compact ? 24 : 28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: compact ? 12 : 13,
            fontWeight: 500,
            color: C.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {person.name}
          </div>
          <div style={{
            fontSize: compact ? 10.5 : 11,
            color: C.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {person.title}{!compact && ` · ${person.department} · ${person.location}`}
          </div>
        </div>
      </button>

      {/* Explanation popover */}
      {showExplanation && (
        <div style={{
          margin: '2px 0 6px 38px',
          padding: '8px 10px',
          background: explanation.status === 'included' ? C.greenLight : C.amberLight,
          border: `1px solid ${explanation.status === 'included' ? C.greenBorder : C.amberBorder}`,
          borderRadius: 6,
          fontSize: 11.5,
          color: C.textSecondary,
          fontFamily: FONT,
          lineHeight: '16px',
        }}>
          {explanation.text}
        </div>
      )}
    </div>
  );
}

// ── Exclusion Detail ─────────────────────────────────────────────────────────

function ExclusionDetail({ excludedByLayers, compact }: {
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);

  if (totalExcluded === 0) return null;

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 9px',
          background: C.amberLight,
          border: `1px solid ${C.amberBorder}`,
          borderRadius: 10,
          fontSize: compact ? 11 : 12,
          fontWeight: 500,
          color: C.amber,
          cursor: 'pointer',
          fontFamily: FONT,
          outline: 'none',
          transition: 'background 120ms ease',
        }}
        aria-label={`${totalExcluded} excluded. Click to ${expanded ? 'hide' : 'show'} details.`}
      >
        {totalExcluded} excluded
        <span style={{
          display: 'inline-block',
          transition: 'transform 150ms ease',
          transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          fontSize: 10,
        }}>
          ▾
        </span>
      </button>

      {expanded && (
        <div style={{
          marginTop: 8,
          padding: compact ? '8px 10px' : '10px 12px',
          background: C.amberLight,
          border: `1px solid ${C.amberBorder}`,
          borderRadius: 8,
          fontFamily: FONT,
        }}>
          {excludedByLayers.map((x) => (
            <div key={x.layer.id} style={{ marginBottom: 8 }}>
              <div style={{
                fontSize: compact ? 11 : 12,
                fontWeight: 600,
                color: C.amber,
                marginBottom: 3,
              }}>
                {x.layer.label}
              </div>
              <div style={{
                fontSize: compact ? 10.5 : 11,
                color: C.textSecondary,
                marginBottom: 4,
                lineHeight: '15px',
              }}>
                {x.layer.description}
              </div>
              <div style={{
                fontSize: compact ? 10.5 : 11,
                color: C.textMuted,
              }}>
                {x.people.map(p => p.name).join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Policy Detail ────────────────────────────────────────────────────────────

function PolicyFooter({ policies, compact }: {
  policies: PolicyRef[];
  compact: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  if (policies.length === 0) return null;

  const totalAffected = policies.reduce((sum, p) => sum + p.affectedCount, 0);

  return (
    <div style={{
      borderTop: `1px solid ${C.border}`,
      paddingTop: compact ? 10 : 12,
      marginTop: compact ? 10 : 12,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: compact ? 11.5 : 12.5,
        fontFamily: FONT,
        color: C.textSecondary,
      }}>
        <span>
          {compact
            ? `${policies.length} ${policies.length === 1 ? 'policy' : 'policies'} · ${totalAffected.toLocaleString()} affected`
            : `Referenced by ${policies.length} ${policies.length === 1 ? 'policy' : 'policies'} · ${totalAffected.toLocaleString()} people affected`
          }
        </span>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            background: 'none',
            border: 'none',
            padding: '2px 6px',
            cursor: 'pointer',
            fontSize: compact ? 11 : 12,
            fontWeight: 500,
            color: C.accent,
            fontFamily: FONT,
            outline: 'none',
          }}
        >
          {expanded ? 'Hide' : 'Details'}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: 8 }}>
          {policies.map((policy) => {
            const tc = tierColor(policy.sensitivityTier);
            return (
              <div key={policy.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 0',
                borderBottom: `1px solid ${C.border}`,
                fontSize: compact ? 11 : 12,
                fontFamily: FONT,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  <span style={{
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    background: tc.bg,
                    color: tc.text,
                    border: `1px solid ${tc.border}`,
                    flexShrink: 0,
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.03em',
                  }}>
                    {tierLabel(policy.sensitivityTier)}
                  </span>
                  <span style={{
                    color: C.text,
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {policy.name}
                  </span>
                </div>
                <span style={{ color: C.textMuted, flexShrink: 0, marginLeft: 8 }}>
                  {policy.affectedCount.toLocaleString()} affected
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FacetedSummary({
  members,
  allPeople,
  rule,
  layers,
  excludedByLayers,
  policies,
  compact = false,
}: PopulationDisplayProps) {

  // ── State ──────────────────────────────────────────────────────────────────

  const [activeFilter, setActiveFilter] = useState<{ field: string; value: string } | null>(null);
  const [memberListOpen, setMemberListOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const memberListRef = useRef<HTMLDivElement>(null);

  // Auto-expand member list for small populations
  const autoExpand = members.length <= 5;

  // ── Computed ────────────────────────────────────────────────────────────────

  const facets = useMemo(() => computeFacets(members, rule, compact), [members, rule, compact]);

  const filteredMembers = useMemo(() => {
    let result = members;
    if (activeFilter) {
      result = result.filter(p => String((p as any)[activeFilter.field]) === activeFilter.value);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.department.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q)
      );
    }
    return result;
  }, [members, activeFilter, searchQuery]);

  const pageSize = compact ? 5 : members.length > 100 ? 20 : 8;
  const totalPages = Math.ceil(filteredMembers.length / pageSize);
  const pagedMembers = filteredMembers.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const showSearch = members.length > 50;
  const showMemberList = autoExpand || memberListOpen || activeFilter !== null;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSegmentClick = useCallback((field: string, value: string) => {
    if (activeFilter && activeFilter.field === field && activeFilter.value === value) {
      // Toggle off
      setActiveFilter(null);
      if (!autoExpand && !memberListOpen) {
        // Keep member list open after filter interaction
      }
    } else {
      setActiveFilter({ field, value });
      setMemberListOpen(true);
      setCurrentPage(0);
    }
  }, [activeFilter, autoExpand, memberListOpen]);

  const clearFilter = useCallback(() => {
    setActiveFilter(null);
    setCurrentPage(0);
    if (!autoExpand) {
      setMemberListOpen(false);
    }
  }, [autoExpand]);

  const toggleMemberList = useCallback(() => {
    setMemberListOpen(prev => !prev);
    setCurrentPage(0);
    if (activeFilter) setActiveFilter(null);
  }, [activeFilter]);

  // Scroll to member list on open
  useEffect(() => {
    if (showMemberList && memberListRef.current) {
      memberListRef.current.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
    }
  }, [showMemberList]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      fontFamily: FONT,
      background: C.surface,
      borderRadius: 12,
      border: `1px solid ${C.border}`,
      boxShadow: S.card,
      padding: compact ? '14px 16px' : '18px 22px',
      overflow: 'hidden',
    }}>

      {/* ─── Zone 1: Match summary line ─────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: compact ? 14 : 18,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
        }}>
          <span style={{
            fontSize: compact ? 20 : 26,
            fontWeight: 700,
            color: C.text,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}>
            {members.length}
          </span>
          <span style={{
            fontSize: compact ? 13 : 14,
            fontWeight: 500,
            color: C.textSecondary,
          }}>
            {members.length === 1 ? 'person' : 'people'}
          </span>
        </div>
        <ExclusionDetail excludedByLayers={excludedByLayers} compact={compact} />
      </div>

      {/* ─── Zone 2: Facet bars ─────────────────────────────────────────── */}
      {facets.length > 0 && (
        <div style={{ marginBottom: compact ? 10 : 14 }}>
          {facets.map((facet) => (
            <FacetBar
              key={facet.field}
              facet={facet}
              compact={compact}
              activeFilter={activeFilter}
              onSegmentClick={handleSegmentClick}
            />
          ))}
        </div>
      )}

      {/* ─── Zone 3: Member list ────────────────────────────────────────── */}
      <div ref={memberListRef}>
        {/* Toggle / filter chip */}
        {!autoExpand && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: showMemberList ? 8 : 0,
          }}>
            {activeFilter ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: C.accentLight,
                border: `1px solid ${C.accentBorder}`,
                borderRadius: 6,
                fontSize: compact ? 11 : 12,
                fontFamily: FONT,
                color: C.accent,
                fontWeight: 500,
              }}
                role="status"
                aria-label={`Filtered to ${formatValue(activeFilter.field, activeFilter.value)}, ${filteredMembers.length} people. Press escape or click x to clear.`}
              >
                Showing: {formatValue(activeFilter.field, activeFilter.value)} ({filteredMembers.length} {filteredMembers.length === 1 ? 'person' : 'people'})
                <button
                  onClick={clearFilter}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 13,
                    color: C.accent,
                    padding: '0 2px',
                    fontFamily: FONT,
                    fontWeight: 600,
                    lineHeight: 1,
                    outline: 'none',
                  }}
                  aria-label="Clear filter"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={toggleMemberList}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '3px 0',
                  cursor: 'pointer',
                  fontSize: compact ? 11.5 : 12.5,
                  fontWeight: 500,
                  color: C.accent,
                  fontFamily: FONT,
                  outline: 'none',
                }}
              >
                {showMemberList
                  ? 'Hide member list'
                  : `Show all ${members.length} people`
                }
              </button>
            )}
          </div>
        )}

        {/* Member list body */}
        <div style={{
          maxHeight: showMemberList ? 2000 : 0,
          opacity: showMemberList ? 1 : 0,
          overflow: 'hidden',
          transition: 'max-height 200ms ease-out, opacity 150ms ease-out',
        }}>
          {showMemberList && (
            <div>
              {/* Search */}
              {showSearch && (
                <div style={{ marginBottom: 8 }}>
                  <input
                    type="text"
                    placeholder="Search people..."
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(0); }}
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      fontSize: compact ? 11.5 : 12,
                      fontFamily: FONT,
                      color: C.text,
                      background: C.surfaceAlt,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              {/* People rows */}
              <div style={{
                borderTop: `1px solid ${C.border}`,
                paddingTop: 4,
              }}>
                {pagedMembers.map(person => (
                  <MemberRow
                    key={person.id}
                    person={person}
                    compact={compact}
                    rule={rule}
                    layers={layers}
                  />
                ))}

                {filteredMembers.length === 0 && (
                  <div style={{
                    padding: '12px 0',
                    fontSize: 12,
                    color: C.textMuted,
                    fontStyle: 'italic',
                  }}>
                    No matching people.
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  paddingTop: 8,
                  borderTop: `1px solid ${C.border}`,
                  marginTop: 4,
                }}>
                  <button
                    onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                    disabled={currentPage === 0}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: currentPage === 0 ? 'default' : 'pointer',
                      color: currentPage === 0 ? C.textMuted : C.accent,
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: FONT,
                      padding: '4px 8px',
                      borderRadius: 4,
                      outline: 'none',
                      opacity: currentPage === 0 ? 0.5 : 1,
                    }}
                  >
                    ← Prev
                  </button>
                  <span style={{
                    fontSize: 11.5,
                    color: C.textMuted,
                    fontFamily: FONT,
                  }}>
                    {currentPage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={currentPage === totalPages - 1}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
                      color: currentPage === totalPages - 1 ? C.textMuted : C.accent,
                      fontSize: 12,
                      fontWeight: 500,
                      fontFamily: FONT,
                      padding: '4px 8px',
                      borderRadius: 4,
                      outline: 'none',
                      opacity: currentPage === totalPages - 1 ? 0.5 : 1,
                    }}
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Zone 4: Downstream impact ──────────────────────────────────── */}
      <PolicyFooter policies={policies} compact={compact} />
    </div>
  );
}

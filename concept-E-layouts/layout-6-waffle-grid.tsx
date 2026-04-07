import { useState, useMemo, useRef, useEffect } from 'react';
import type {
  Person,
  RuleGroup,
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

// ── Department color palette ────────────────────────────────────────────────

const DEPT_COLORS: Record<string, string> = {
  Engineering: '#5B8DEF',
  Sales:       '#4CAF7D',
  Finance:     '#E8A838',
  Marketing:   '#D468C8',
  HR:          '#7C6FD4',
  Legal:       '#5CC0C0',
  Operations:  '#E07060',
};
const DEFAULT_DEPT_COLOR = '#A0A0A0';

function deptColor(dept: string): string {
  return DEPT_COLORS[dept] || DEFAULT_DEPT_COLOR;
}

// ── Avatar helpers (copied from concept-E) ──────────────────────────────────

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

// ── Field / value helpers (copied from concept-E) ───────────────────────────

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

// ── Sensitivity tier helpers ────────────────────────────────────────────────

function tierLabel(tier: SensitivityTier): string {
  return tier === 1 ? 'Critical' : tier === 2 ? 'Moderate' : 'Low';
}

function tierColor(tier: SensitivityTier) {
  return tier === 1 ? { bg: C.redLight, border: C.redBorder, text: C.red }
    : tier === 2 ? { bg: C.amberLight, border: C.amberBorder, text: C.amber }
    : { bg: C.accentLight, border: C.accentBorder, text: C.accent };
}

// ── Sorting ─────────────────────────────────────────────────────────────────

function sortByDepartmentThenName(people: Person[]): Person[] {
  return [...people].sort((a, b) => {
    const da = a.department.toLowerCase();
    const db = b.department.toLowerCase();
    if (da < db) return -1;
    if (da > db) return 1;
    return a.name.localeCompare(b.name);
  });
}

// ── Department stats ────────────────────────────────────────────────────────

interface DeptStat {
  dept: string;
  color: string;
  count: number;
}

function getDeptStats(people: Person[]): DeptStat[] {
  const map = new Map<string, number>();
  for (const p of people) {
    map.set(p.department, (map.get(p.department) || 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([dept, count]) => ({ dept, color: deptColor(dept), count }));
}

// ── Exclusion reason helper ─────────────────────────────────────────────────

function getExclusionReason(
  personId: string,
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[],
): string | null {
  for (const { layer, people } of excludedByLayers) {
    if (people.some(p => p.id === personId)) return layer.label;
  }
  return null;
}

// ── Bucketed summary mode (>200 members) ────────────────────────────────────

interface Bucket {
  dept: string;
  color: string;
  count: number;
  label: string;
}

function buildBuckets(people: Person[], bucketSize: number): Bucket[] {
  const stats = getDeptStats(people);
  const buckets: Bucket[] = [];
  for (const { dept, color, count } of stats) {
    const numBuckets = Math.max(1, Math.round(count / bucketSize));
    const perBucket = Math.round(count / numBuckets);
    for (let i = 0; i < numBuckets; i++) {
      const isLast = i === numBuckets - 1;
      const thisCount = isLast ? count - perBucket * (numBuckets - 1) : perBucket;
      buckets.push({
        dept,
        color,
        count: thisCount,
        label: `~${thisCount} people in ${dept}`,
      });
    }
  }
  return buckets;
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function WaffleGrid({
  members,
  allPeople,
  rule,
  layers,
  excludedByLayers,
  policies,
  compact = false,
}: PopulationDisplayProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredDept, setHoveredDept] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterDept, setFilterDept] = useState<string | null>(null);
  const [showExclusionDetail, setShowExclusionDetail] = useState(false);
  const [showImpactDetail, setShowImpactDetail] = useState(false);
  const [showFullGrid, setShowFullGrid] = useState(false);
  const [showExcludedCompact, setShowExcludedCompact] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  const totalExcluded = excludedByLayers.reduce((s, e) => s + e.people.length, 0);
  const allExcluded = excludedByLayers.flatMap(e => e.people);
  const sortedMembers = useMemo(() => sortByDepartmentThenName(members), [members]);
  const sortedExcluded = useMemo(() => sortByDepartmentThenName(allExcluded), [allExcluded]);
  const deptStats = useMemo(() => getDeptStats(members), [members]);

  const useSummaryMode = members.length > 200 && !showFullGrid;
  const bucketSize = 10;
  const buckets = useMemo(
    () => useSummaryMode ? buildBuckets(members, bucketSize) : [],
    [members, useSummaryMode],
  );

  // Cell sizing
  const cellSize = compact ? 18 : (members.length <= 5 ? 32 : 24);
  const gap = compact ? 2 : 3;

  // Resolve which person is hovered for department highlighting
  const activeDept = filterDept || hoveredDept;

  // Total affected count for policies
  const totalAffected = policies.reduce((s, p) => s + p.affectedCount, 0);

  // Selected person
  const selectedPerson = selectedId
    ? members.find(p => p.id === selectedId) || allExcluded.find(p => p.id === selectedId)
    : null;

  // Click outside to deselect
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (gridRef.current && !gridRef.current.contains(e.target as Node)) {
        setSelectedId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ── Cell renderer ───────────────────────────────────────────────────────

  function renderCell(
    person: Person,
    opts: { excluded?: boolean; dimmed?: boolean } = {},
  ) {
    const { excluded = false, dimmed = false } = opts;
    const color = deptColor(person.department);
    const isHovered = hoveredId === person.id;
    const isSelected = selectedId === person.id;
    const isDeptActive = activeDept != null;
    const isSameDept = activeDept === person.department;
    const shouldDim = (isDeptActive && !isSameDept) || dimmed;

    const exclusionReason = excluded
      ? getExclusionReason(person.id, excludedByLayers)
      : null;

    const tooltipText = excluded
      ? `${person.name} — ${person.title}, ${person.department}. Excluded: ${exclusionReason || 'system filter'}`
      : `${person.name} — ${person.title}, ${person.department}`;

    return (
      <div
        key={person.id}
        role="gridcell"
        aria-label={`${person.name}, ${person.title}, ${person.department} department${excluded ? `, excluded by ${exclusionReason || 'system filter'}` : ''}`}
        tabIndex={0}
        title={tooltipText}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedId(prev => prev === person.id ? null : person.id);
        }}
        onMouseEnter={() => {
          setHoveredId(person.id);
          setHoveredDept(person.department);
        }}
        onMouseLeave={() => {
          setHoveredId(null);
          setHoveredDept(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setSelectedId(prev => prev === person.id ? null : person.id);
          }
        }}
        style={{
          width: cellSize,
          height: cellSize,
          borderRadius: 4,
          background: color,
          opacity: excluded ? 0.3 : shouldDim ? 0.6 : 1,
          transform: isHovered ? 'scale(1.3)' : 'scale(1)',
          transition: 'transform 100ms ease, opacity 150ms ease, box-shadow 150ms ease',
          cursor: 'pointer',
          position: 'relative',
          zIndex: isHovered ? 10 : 1,
          boxShadow: isSelected
            ? `0 0 0 2px ${C.accent}`
            : isSameDept && isDeptActive && !excluded
              ? `0 0 0 1px ${color}`
              : 'none',
          outline: 'none',
        }}
      />
    );
  }

  // ── Bucket cell renderer (summary mode) ─────────────────────────────────

  function renderBucketCell(bucket: Bucket, index: number) {
    const isHovered = hoveredDept === bucket.dept;
    const isDeptActive = activeDept != null;
    const isSameDept = activeDept === bucket.dept;
    const shouldDim = isDeptActive && !isSameDept;

    return (
      <div
        key={`bucket-${bucket.dept}-${index}`}
        role="gridcell"
        aria-label={`Approximately ${bucket.count} people in ${bucket.dept}`}
        tabIndex={0}
        title={bucket.label}
        onMouseEnter={() => setHoveredDept(bucket.dept)}
        onMouseLeave={() => setHoveredDept(null)}
        style={{
          width: cellSize,
          height: cellSize,
          borderRadius: 4,
          background: bucket.color,
          opacity: shouldDim ? 0.6 : 1,
          transform: isHovered ? 'scale(1.15)' : 'scale(1)',
          transition: 'transform 100ms ease, opacity 150ms ease',
          cursor: 'default',
          position: 'relative',
          zIndex: isHovered ? 10 : 1,
          boxShadow: isSameDept && isDeptActive ? `0 0 0 1px ${bucket.color}` : 'none',
        }}
      />
    );
  }

  // ── Explanation card for selected person ─────────────────────────────────

  function renderExplanationCard() {
    if (!selectedPerson) return null;
    const isExcluded = allExcluded.some(p => p.id === selectedPerson.id);
    const reason = isExcluded
      ? getExclusionReason(selectedPerson.id, excludedByLayers)
      : null;

    return (
      <div style={{
        marginTop: 12,
        padding: '12px 14px',
        background: isExcluded ? C.amberLight : C.accentLight,
        border: `1px solid ${isExcluded ? C.amberBorder : C.accentBorder}`,
        borderRadius: 8,
        fontFamily: FONT,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Avatar name={selectedPerson.name} size={32} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {selectedPerson.name}
            </div>
            <div style={{ fontSize: 12, color: C.textSecondary }}>
              {selectedPerson.title} · {selectedPerson.department}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.5 }}>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>Employment:</span>{' '}
            {formatValue('employmentType', selectedPerson.employmentType)}
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>Location:</span>{' '}
            {selectedPerson.location}, {selectedPerson.country}
          </div>
          <div style={{ marginBottom: 4 }}>
            <span style={{ fontWeight: 500 }}>Role status:</span>{' '}
            {formatValue('roleState', selectedPerson.roleState)}
          </div>
          <div>
            <span style={{ fontWeight: 500 }}>Start date:</span>{' '}
            {selectedPerson.startDate}
          </div>
          {isExcluded && reason && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: `1px solid ${C.amberBorder}`,
              color: C.amber, fontWeight: 500,
            }}>
              Excluded: {reason}
            </div>
          )}
          {!isExcluded && (
            <div style={{
              marginTop: 8, paddingTop: 8,
              borderTop: `1px solid ${C.accentBorder}`,
              color: C.accent, fontWeight: 500,
            }}>
              Included — matches current rule criteria
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Legend ─────────────────────────────────────────────────────────────────

  function renderLegend() {
    if (compact) return null;

    return (
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 14px',
        marginTop: 14,
        paddingTop: 12,
        borderTop: `1px solid ${C.border}`,
      }}>
        {deptStats.map(({ dept, color, count }) => {
          const isActive = filterDept === dept;
          return (
            <button
              key={dept}
              onClick={() => setFilterDept(prev => prev === dept ? null : dept)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '3px 8px',
                borderRadius: 4,
                border: isActive ? `1.5px solid ${color}` : '1.5px solid transparent',
                background: isActive ? `${color}14` : 'transparent',
                cursor: 'pointer',
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                color: C.textSecondary,
                transition: 'all 120ms ease',
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: color, flexShrink: 0,
              }} />
              {dept} ({count})
            </button>
          );
        })}
      </div>
    );
  }

  // ── Exclusion detail ──────────────────────────────────────────────────────

  function renderExclusionDetail() {
    if (!showExclusionDetail) return null;

    return (
      <div style={{
        marginTop: 8, padding: '10px 12px',
        background: C.amberLight,
        border: `1px solid ${C.amberBorder}`,
        borderRadius: 6, fontSize: 12, color: C.textSecondary,
        fontFamily: FONT,
      }}>
        {excludedByLayers.map(({ layer, people }) => (
          <div key={layer.id} style={{ marginBottom: 6 }}>
            <span style={{ fontWeight: 600, color: C.amber }}>{layer.label}</span>
            <span style={{ color: C.textMuted }}> — {layer.description}</span>
            <div style={{ marginTop: 2, color: C.textMuted }}>
              {people.map(p => p.name).join(', ')} ({people.length})
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Impact footer ─────────────────────────────────────────────────────────

  function renderImpactFooter() {
    if (policies.length === 0) return null;

    const summaryText = compact
      ? `${policies.length} ${policies.length === 1 ? 'policy' : 'policies'} · ${totalAffected.toLocaleString()} affected`
      : `Referenced by ${policies.length} ${policies.length === 1 ? 'policy' : 'policies'} · ${totalAffected.toLocaleString()} people affected`;

    return (
      <div style={{
        marginTop: 14, paddingTop: 12,
        borderTop: `1px solid ${C.border}`,
        fontFamily: FONT,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          fontSize: 12, color: C.textSecondary,
        }}>
          <span>{summaryText}</span>
          <button
            onClick={() => setShowImpactDetail(v => !v)}
            style={{
              background: 'none', border: 'none', padding: '2px 6px',
              fontSize: 12, color: C.accent, cursor: 'pointer',
              fontFamily: FONT, fontWeight: 500,
            }}
          >
            {showImpactDetail ? 'Hide' : 'Details'}
          </button>
        </div>
        {showImpactDetail && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {policies.map(policy => {
              const tc = tierColor(policy.sensitivityTier);
              return (
                <div key={policy.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 10px',
                  background: tc.bg,
                  border: `1px solid ${tc.border}`,
                  borderRadius: 6,
                  fontSize: 12,
                }}>
                  <div>
                    <span style={{ fontWeight: 600, color: C.text }}>{policy.name}</span>
                    <span style={{ color: C.textMuted, marginLeft: 6 }}>{policy.domain}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: tc.text, textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}>
                      Tier {policy.sensitivityTier} · {tierLabel(policy.sensitivityTier)}
                    </span>
                    <span style={{ fontSize: 11, color: C.textSecondary }}>
                      {policy.affectedCount.toLocaleString()} affected
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <div
      ref={gridRef}
      style={{
        fontFamily: FONT,
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        boxShadow: S.card,
        padding: compact ? '16px 18px' : '20px 24px',
        maxWidth: compact ? 480 : undefined,
      }}
    >
      {/* Zone 1: Match count + exclusion indicator */}
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 10,
        marginBottom: compact ? 12 : 16,
      }}>
        <span style={{
          fontSize: 16, fontWeight: 600, color: C.text,
        }}>
          {useSummaryMode
            ? `${members.length.toLocaleString()} people`
            : `${members.length} ${members.length === 1 ? 'person' : 'people'}`}
        </span>
        {totalExcluded > 0 && (
          <button
            onClick={() => setShowExclusionDetail(v => !v)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 13, color: C.amber, cursor: 'pointer',
              fontFamily: FONT, fontWeight: 500,
            }}
          >
            {totalExcluded} excluded
          </button>
        )}
        {useSummaryMode && (
          <span style={{ fontSize: 11, color: C.textMuted }}>
            Each cell ≈ {bucketSize} people
          </span>
        )}
      </div>

      {showExclusionDetail && renderExclusionDetail()}

      {/* Zone 2: The waffle grid */}
      <div
        role="grid"
        aria-label={useSummaryMode ? `Population grid — approximately ${members.length} people` : `Population grid — ${members.length} people`}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: gap,
          lineHeight: 0,
        }}
      >
        {useSummaryMode
          ? buckets.map((b, i) => renderBucketCell(b, i))
          : sortedMembers.map(person => renderCell(person))
        }
      </div>

      {/* Summary mode: "Show full grid" toggle */}
      {members.length > 200 && (
        <button
          onClick={() => setShowFullGrid(v => !v)}
          style={{
            marginTop: 8, background: 'none', border: 'none',
            padding: '2px 0', fontSize: 11, color: C.accent,
            cursor: 'pointer', fontFamily: FONT, fontWeight: 500,
          }}
        >
          {showFullGrid ? 'Show summary' : 'Show full grid'}
        </button>
      )}

      {/* Excluded cells */}
      {!compact && sortedExcluded.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{
            fontSize: 11, color: C.textMuted, marginBottom: 4,
            fontFamily: FONT,
          }}>
            Excluded by system filters
          </div>
          <div
            role="grid"
            aria-label="People excluded by system filters"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: gap,
              lineHeight: 0,
            }}
          >
            {sortedExcluded.map(person => renderCell(person, { excluded: true }))}
          </div>
        </div>
      )}

      {/* Compact mode: text-only excluded indicator */}
      {compact && totalExcluded > 0 && (
        <div style={{ marginTop: 8 }}>
          <button
            onClick={() => setShowExcludedCompact(v => !v)}
            style={{
              background: 'none', border: 'none', padding: 0,
              fontSize: 11, color: C.textMuted, cursor: 'pointer',
              fontFamily: FONT,
            }}
          >
            {totalExcluded} excluded by system filters
            <span style={{ marginLeft: 4, fontSize: 9 }}>
              {showExcludedCompact ? '▲' : '▼'}
            </span>
          </button>
          {showExcludedCompact && (
            <div style={{
              marginTop: 6,
              display: 'flex', flexWrap: 'wrap', gap: gap, lineHeight: 0,
            }}>
              {sortedExcluded.map(person => renderCell(person, { excluded: true }))}
            </div>
          )}
        </div>
      )}

      {/* Explanation card for selected person */}
      {renderExplanationCard()}

      {/* Legend */}
      {renderLegend()}

      {/* Zone 3: Downstream impact footer */}
      {renderImpactFooter()}
    </div>
  );
}

import { useState, useMemo, useCallback, useRef } from 'react';
import type {
  Person,
  RuleGroup,
  EvaluationLayer,
  PolicyRef,
  SensitivityTier,
} from '../shell/types';

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

// ── Shared helpers ──────────────────────────────────────────────────────────

const AVATAR_COLORS: [string, string][] = [
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

// ── Props interface ─────────────────────────────────────────────────────────

export interface PopulationDisplayProps {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  policies: PolicyRef[];
  compact?: boolean;
}

// ── Sparkline data builder ──────────────────────────────────────────────────

interface SparklinePoint {
  date: string;
  count: number;
}

function buildSparklineData(members: Person[]): SparklinePoint[] {
  const today = new Date('2026-04-03');
  const points: SparklinePoint[] = [];

  for (let i = 30; i >= 0; i--) {
    const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().slice(0, 10);
    const count = members.filter(p => p.startDate <= dateStr).length;
    points.push({ date: dateStr, count });
  }

  return points;
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Sparkline SVG component ─────────────────────────────────────────────────

function Sparkline({
  data,
  compact,
  onHover,
  onLeave,
}: {
  data: SparklinePoint[];
  compact?: boolean;
  onHover?: (point: SparklinePoint, x: number, y: number) => void;
  onLeave?: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const height = compact ? 60 : 96;
  const paddingTop = 8;
  const paddingBottom = 4;

  const counts = data.map(d => d.count);
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const range = maxCount - minCount || 1;

  // Scale a count to y coordinate (inverted — high counts at top)
  const yScale = (count: number) => {
    const ratio = (count - minCount) / range;
    return height - paddingBottom - ratio * (height - paddingTop - paddingBottom);
  };

  // Build step-line path
  const stepPath = useMemo(() => {
    if (data.length === 0) return '';
    const xStep = 100 / (data.length - 1);
    const segments: string[] = [];
    segments.push(`M 0 ${yScale(data[0].count)}`);
    for (let i = 1; i < data.length; i++) {
      const x = i * xStep;
      const prevY = yScale(data[i - 1].count);
      const currY = yScale(data[i].count);
      // Step: horizontal to new x at old y, then vertical to new y
      segments.push(`L ${x} ${prevY}`);
      segments.push(`L ${x} ${currY}`);
    }
    return segments.join(' ');
  }, [data, height]);

  // Build filled area path (for gradient)
  const fillPath = useMemo(() => {
    if (data.length === 0 || compact) return '';
    const xStep = 100 / (data.length - 1);
    const segments: string[] = [];
    segments.push(`M 0 ${yScale(data[0].count)}`);
    for (let i = 1; i < data.length; i++) {
      const x = i * xStep;
      const prevY = yScale(data[i - 1].count);
      const currY = yScale(data[i].count);
      segments.push(`L ${x} ${prevY}`);
      segments.push(`L ${x} ${currY}`);
    }
    // Close: go down to baseline, back to start
    segments.push(`L 100 ${height}`);
    segments.push(`L 0 ${height}`);
    segments.push('Z');
    return segments.join(' ');
  }, [data, height, compact]);

  const lastPoint = data[data.length - 1];
  const lastX = 100;
  const lastY = yScale(lastPoint.count);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || !onHover) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(relX * (data.length - 1));
    const clamped = Math.max(0, Math.min(data.length - 1, idx));
    const xStep = 100 / (data.length - 1);
    onHover(data[clamped], clamped * xStep, yScale(data[clamped].count));
  }, [data, onHover]);

  const gradientId = 'sparkline-grad-' + (compact ? 'c' : 'f');

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Population trend over last 30 days. Started at ${data[0].count}, currently ${lastPoint.count}.`}
      style={{
        width: '100%',
        height,
        display: 'block',
        cursor: 'crosshair',
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={onLeave}
    >
      {!compact && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
          </linearGradient>
        </defs>
      )}

      {/* Baseline */}
      <line x1="0" y1={height - 1} x2="100" y2={height - 1} stroke={C.border} strokeWidth="0.3" />

      {/* Gradient fill */}
      {!compact && fillPath && (
        <path d={fillPath} fill={`url(#${gradientId})`} />
      )}

      {/* Step line */}
      <path
        d={stepPath}
        fill="none"
        stroke={C.accent}
        strokeWidth="0.8"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Endpoint circle */}
      <circle
        cx={lastX}
        cy={lastY}
        r="1.5"
        fill={C.accent}
        stroke={C.bg}
        strokeWidth="0.5"
      />
    </svg>
  );
}

// ── Hover tooltip ───────────────────────────────────────────────────────────

function SparklineTooltip({ point, x, containerWidth }: {
  point: SparklinePoint;
  x: number; // 0-100 percentage
  containerWidth: number;
}) {
  const pixelX = (x / 100) * containerWidth;
  const flipLeft = pixelX > containerWidth - 120;
  return (
    <div style={{
      position: 'absolute',
      left: flipLeft ? pixelX - 120 : pixelX + 8,
      top: -4,
      background: C.text,
      color: C.bg,
      fontSize: 11,
      fontFamily: FONT,
      padding: '3px 8px',
      borderRadius: 4,
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
      zIndex: 10,
    }}>
      {formatShortDate(point.date)}: {point.count} {point.count === 1 ? 'person' : 'people'}
    </div>
  );
}

// ── Recent changes derivation ───────────────────────────────────────────────

interface RecentChange {
  person: Person;
  type: 'joined' | 'left';
  date: string;
}

function getRecentChanges(members: Person[]): RecentChange[] {
  const today = new Date('2026-04-03');
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const changes: RecentChange[] = [];

  for (const p of members) {
    if (p.startDate >= thirtyDaysAgo && p.startDate <= '2026-04-03') {
      if (p.roleState === 'terminated') {
        // Terminated but started recently — treat as joined then left
        changes.push({ person: p, type: 'joined', date: p.startDate });
        changes.push({ person: p, type: 'left', date: '2026-03-19' }); // simulated
      } else {
        changes.push({ person: p, type: 'joined', date: p.startDate });
      }
    } else if (p.roleState === 'terminated' && p.startDate < thirtyDaysAgo) {
      // Longer-tenured person who was terminated recently
      changes.push({ person: p, type: 'left', date: '2026-03-19' }); // simulated departure
    }
  }

  return changes.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TemporalHeartbeat({
  members,
  allPeople,
  rule,
  layers,
  excludedByLayers,
  policies,
  compact = false,
}: PopulationDisplayProps) {
  const [showMembers, setShowMembers] = useState(false);
  const [showExclusions, setShowExclusions] = useState(false);
  const [showPolicies, setShowPolicies] = useState(false);
  const [hoverPoint, setHoverPoint] = useState<{ point: SparklinePoint; x: number } | null>(null);
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [cardWidth, setCardWidth] = useState(600);

  // Measure card width for tooltip positioning
  const measureRef = useCallback((el: HTMLDivElement | null) => {
    if (el) {
      (cardRef as any).current = el;
      setCardWidth(el.getBoundingClientRect().width);
    }
  }, []);

  const sparklineData = useMemo(() => buildSparklineData(members), [members]);
  const recentChanges = useMemo(() => getRecentChanges(members), [members]);

  const joiners = recentChanges.filter(c => c.type === 'joined');
  const leavers = recentChanges.filter(c => c.type === 'left');

  const totalExcluded = excludedByLayers.reduce((sum, e) => sum + e.people.length, 0);

  const startCount = sparklineData[0].count;
  const currentCount = sparklineData[sparklineData.length - 1].count;
  const netChange = currentCount - startCount;
  const isFlat = netChange === 0 && joiners.length === 0 && leavers.length === 0;

  // For large populations, show percentage
  const showPercentage = currentCount >= 100;
  const percentChange = startCount > 0 ? ((netChange / startCount) * 100).toFixed(1) : '0';

  const totalAffected = policies.reduce((sum, p) => sum + p.affectedCount, 0);

  const displayMembers = compact ? members.slice(0, 5) : members.slice(0, 5);
  const maxChangesShown = compact ? 0 : (currentCount >= 100 ? 5 : 20);

  return (
    <div
      ref={measureRef}
      style={{
        fontFamily: FONT,
        background: C.surface,
        borderRadius: 10,
        boxShadow: S.card,
        border: `1px solid ${C.border}`,
        overflow: 'hidden',
      }}
    >
      {/* ── Zone 1: Sparkline with hero count ─────────────────────────── */}
      <div style={{
        padding: compact ? '16px 16px 8px' : '20px 24px 10px',
        position: 'relative',
      }}>
        {/* Count labels positioned above the chart */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 6,
        }}>
          {/* Starting count (left) */}
          {!compact && (
            <span style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.textMuted,
              fontFamily: FONT,
            }}>
              {startCount}
            </span>
          )}

          {/* Current count (right, hero) */}
          <div style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            marginLeft: compact ? 0 : 'auto',
          }}>
            <span style={{
              fontSize: compact ? 20 : 24,
              fontWeight: 700,
              color: C.text,
              fontFamily: FONT,
              lineHeight: 1,
            }}>
              {currentCount}
            </span>
            <span style={{
              fontSize: 13,
              color: C.textMuted,
              fontFamily: FONT,
            }}>
              {currentCount === 1 ? 'person' : 'people'}
            </span>
            {netChange !== 0 && (
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: netChange > 0 ? C.green : C.red,
                fontFamily: FONT,
              }}>
                {netChange > 0 ? '+' : ''}{netChange}
                {showPercentage && ` (${netChange > 0 ? '+' : ''}${percentChange}%)`}
              </span>
            )}
          </div>
        </div>

        {/* Sparkline chart */}
        <div style={{ position: 'relative' }}>
          <Sparkline
            data={sparklineData}
            compact={compact}
            onHover={(point, x) => setHoverPoint({ point, x })}
            onLeave={() => setHoverPoint(null)}
          />

          {/* Hover tooltip */}
          {hoverPoint && (
            <SparklineTooltip
              point={hoverPoint.point}
              x={hoverPoint.x}
              containerWidth={cardWidth - (compact ? 32 : 48)}
            />
          )}

          {/* Hover vertical rule */}
          {hoverPoint && (
            <div style={{
              position: 'absolute',
              left: `${hoverPoint.x}%`,
              top: 0,
              bottom: 0,
              width: 1,
              background: C.borderStrong,
              pointerEvents: 'none',
            }} />
          )}
        </div>

        {/* "Last 30 days" label */}
        <div style={{
          textAlign: 'right',
          fontSize: 11,
          color: C.textMuted,
          fontFamily: FONT,
          marginTop: 4,
        }}>
          Last 30 days
          {isFlat && (
            <span style={{ marginLeft: 8 }}> &middot; No changes</span>
          )}
        </div>
      </div>

      {/* ── Zone 2: Recent changes annotation ────────────────────────── */}
      {(joiners.length > 0 || leavers.length > 0) && (
        <div style={{
          padding: compact ? '6px 16px 10px' : '4px 24px 14px',
          borderTop: `1px solid ${C.border}`,
        }}>
          {/* Joiners */}
          {joiners.length > 0 && (
            <div style={{ marginBottom: leavers.length > 0 ? 8 : 0 }}>
              <span style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 600,
                color: C.green,
                background: C.greenLight,
                border: `1px solid ${C.greenBorder}`,
                borderRadius: 10,
                padding: '1px 8px',
                marginRight: 8,
                fontFamily: FONT,
              }}>
                +{joiners.length} joined
              </span>
              {!compact && maxChangesShown > 0 && (
                <span style={{ fontSize: 13, color: C.textSecondary, fontFamily: FONT }}>
                  {joiners.slice(0, maxChangesShown).map((c, i) => (
                    <span key={c.person.id + '-j'}>
                      {i > 0 && ' \u00b7 '}
                      <span
                        onClick={() => setSelectedPerson(
                          selectedPerson?.id === c.person.id ? null : c.person
                        )}
                        style={{
                          color: C.accent,
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {c.person.name}
                      </span>
                      <span style={{ color: C.textMuted }}> {formatShortDate(c.date)}</span>
                    </span>
                  ))}
                  {joiners.length > maxChangesShown && (
                    <span style={{ color: C.textMuted }}>
                      {' '}+ {joiners.length - maxChangesShown} more
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Leavers */}
          {leavers.length > 0 && (
            <div>
              <span style={{
                display: 'inline-block',
                fontSize: 11,
                fontWeight: 600,
                color: C.red,
                background: C.redLight,
                border: `1px solid ${C.redBorder}`,
                borderRadius: 10,
                padding: '1px 8px',
                marginRight: 8,
                fontFamily: FONT,
              }}>
                -{leavers.length} left
              </span>
              {!compact && maxChangesShown > 0 && (
                <span style={{ fontSize: 13, color: C.textSecondary, fontFamily: FONT }}>
                  {leavers.slice(0, maxChangesShown).map((c, i) => (
                    <span key={c.person.id + '-l'}>
                      {i > 0 && ' \u00b7 '}
                      <span
                        onClick={() => setSelectedPerson(
                          selectedPerson?.id === c.person.id ? null : c.person
                        )}
                        style={{
                          color: C.accent,
                          cursor: 'pointer',
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {c.person.name}
                      </span>
                      <span style={{ color: C.textMuted }}>
                        {' '}&mdash; terminated {formatShortDate(c.date)}
                      </span>
                    </span>
                  ))}
                  {leavers.length > maxChangesShown && (
                    <span style={{ color: C.textMuted }}>
                      {' '}+ {leavers.length - maxChangesShown} more
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Selected person explanation popover */}
          {selectedPerson && (
            <div style={{
              marginTop: 10,
              padding: '10px 14px',
              background: C.accentLight,
              border: `1px solid ${C.accentBorder}`,
              borderRadius: 8,
              fontSize: 13,
              fontFamily: FONT,
              color: C.text,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Avatar name={selectedPerson.name} size={24} />
                <span style={{ fontWeight: 600 }}>{selectedPerson.name}</span>
                <span
                  onClick={() => setSelectedPerson(null)}
                  style={{
                    marginLeft: 'auto',
                    cursor: 'pointer',
                    color: C.textMuted,
                    fontSize: 16,
                    lineHeight: 1,
                  }}
                >
                  &times;
                </span>
              </div>
              <div style={{ color: C.textSecondary, lineHeight: 1.5 }}>
                <div>{selectedPerson.title} &middot; {selectedPerson.department}</div>
                <div>{selectedPerson.location}, {selectedPerson.country}</div>
                <div>
                  {formatValue('employmentType', selectedPerson.employmentType)} &middot; {formatValue('roleState', selectedPerson.roleState)}
                </div>
                <div style={{ color: C.textMuted, marginTop: 4 }}>
                  Start date: {formatShortDate(selectedPerson.startDate)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Zone 3: Exclusion indicator ──────────────────────────────── */}
      {totalExcluded > 0 && (
        <div style={{
          padding: compact ? '8px 16px' : '8px 24px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <div
            onClick={() => setShowExclusions(!showExclusions)}
            style={{
              fontSize: 13,
              color: C.amber,
              fontFamily: FONT,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
            role="button"
            aria-expanded={showExclusions}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
              <circle cx="8" cy="8" r="7" stroke={C.amber} strokeWidth="1.5" fill="none" />
              <line x1="8" y1="4.5" x2="8" y2="8.5" stroke={C.amber} strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="8" cy="11" r="0.8" fill={C.amber} />
            </svg>
            <span>
              {totalExcluded} excluded by system filters
            </span>
            <span style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: C.textMuted,
              transform: showExclusions ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}>
              &#9662;
            </span>
          </div>

          {showExclusions && (
            <div style={{ marginTop: 10 }}>
              {excludedByLayers.map(({ layer, people }) => (
                <div key={layer.id} style={{
                  marginBottom: 10,
                  padding: '8px 12px',
                  background: C.amberLight,
                  border: `1px solid ${C.amberBorder}`,
                  borderRadius: 6,
                  fontSize: 13,
                  fontFamily: FONT,
                }}>
                  <div style={{ fontWeight: 600, color: C.amber, marginBottom: 2 }}>
                    {layer.label}
                  </div>
                  <div style={{ color: C.textSecondary, marginBottom: 6 }}>
                    {layer.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {people.map(p => (
                      <div key={p.id} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: 12,
                        color: C.textSecondary,
                      }}>
                        <Avatar name={p.name} size={18} />
                        <span>{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Zone 4: Population + impact footer ───────────────────────── */}
      <div style={{
        padding: compact ? '10px 16px' : '12px 24px 16px',
        borderTop: `1px solid ${C.border}`,
        display: 'flex',
        flexDirection: compact ? 'column' : 'row',
        alignItems: compact ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: compact ? 10 : 16,
      }}>
        {/* Left: avatar stack + show all */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          {/* Overlapping avatar stack */}
          <div style={{ display: 'flex', marginRight: 4 }}>
            {displayMembers.map((p, i) => (
              <div
                key={p.id}
                style={{
                  marginLeft: i === 0 ? 0 : -8,
                  zIndex: displayMembers.length - i,
                  position: 'relative',
                }}
              >
                <Avatar name={p.name} size={26} />
              </div>
            ))}
          </div>
          <span
            onClick={() => setShowMembers(!showMembers)}
            style={{
              fontSize: 13,
              color: C.accent,
              cursor: 'pointer',
              fontFamily: FONT,
              fontWeight: 500,
              textDecoration: 'none',
            }}
            role="button"
            aria-expanded={showMembers}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            {showMembers ? 'Hide list' : `Show all ${members.length} people`}
          </span>
        </div>

        {/* Right: policy badge */}
        {policies.length > 0 && (
          <span
            onClick={() => setShowPolicies(!showPolicies)}
            style={{
              fontSize: 13,
              color: C.textSecondary,
              fontFamily: FONT,
              cursor: 'pointer',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
            role="button"
            aria-expanded={showPolicies}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            {policies.length} {policies.length === 1 ? 'policy' : 'policies'} &middot; {totalAffected.toLocaleString()} affected
          </span>
        )}
      </div>

      {/* ── Expanded: Member list ─────────────────────────────────────── */}
      {showMembers && (
        <div style={{
          padding: compact ? '0 16px 16px' : '0 24px 20px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{
            maxHeight: 320,
            overflowY: 'auto',
            paddingTop: 12,
          }}>
            {members.map(p => (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 0',
                  borderBottom: `1px solid ${C.border}`,
                  fontSize: 13,
                  fontFamily: FONT,
                }}
              >
                <Avatar name={p.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.name}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.title} &middot; {p.department}
                  </div>
                </div>
                <div style={{
                  fontSize: 11,
                  color: p.roleState === 'active' ? C.green : p.roleState === 'pending' ? C.amber : C.red,
                  fontWeight: 500,
                  flexShrink: 0,
                }}>
                  {roleStateLabels[p.roleState]}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expanded: Policy detail ──────────────────────────────────── */}
      {showPolicies && (
        <div style={{
          padding: compact ? '0 16px 16px' : '0 24px 20px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <div style={{ paddingTop: 12 }}>
            {policies.map(p => {
              const tc = tierColor(p.sensitivityTier);
              return (
                <div
                  key={p.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    marginBottom: 6,
                    background: tc.bg,
                    border: `1px solid ${tc.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    fontFamily: FONT,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500, color: C.text }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 1 }}>
                      {p.domain} &middot; {p.affectedCount.toLocaleString()} affected
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: tc.text,
                    background: C.bg,
                    border: `1px solid ${tc.border}`,
                    borderRadius: 10,
                    padding: '2px 8px',
                  }}>
                    {tierLabel(p.sensitivityTier)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

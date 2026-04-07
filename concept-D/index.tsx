import React, { useState, useMemo, useCallback } from 'react';
import type {
  ConceptProps,
  EntryState,
  SavedGroup,
  PolicyRef,
  PolicyDomain,
  SensitivityTier,
  Person,
  RuleGroup,
  RuleCondition,
  RuleNode,
  EvaluationLayer,
} from '../shell/types';

// ── Helpers ────────────────────────────────────────────────────────────────

function deriveSensitivityTier(consumers: PolicyRef[]): SensitivityTier {
  if (consumers.length === 0) return 3;
  return Math.min(...consumers.map((c) => c.sensitivityTier)) as SensitivityTier;
}

const tierConfig: Record<SensitivityTier, { label: string; color: string; bg: string; border: string; dot: string }> = {
  1: { label: 'Critical', color: '#7F1D1D', bg: '#FEF2F2', border: '#FECACA', dot: '#DC2626' },
  2: { label: 'Standard', color: '#78350F', bg: '#FFFBEB', border: '#FDE68A', dot: '#D97706' },
  3: { label: 'Low',      color: '#14532D', bg: '#F0FDF4', border: '#86EFAC', dot: '#16A34A' },
};

const domainConfig: Record<PolicyDomain, { label: string; color: string; bg: string }> = {
  payroll:        { label: 'Payroll',        color: '#5B21B6', bg: '#F5F3FF' },
  compliance:     { label: 'Compliance',     color: '#B91C1C', bg: '#FEF2F2' },
  it:             { label: 'IT & Access',    color: '#1E40AF', bg: '#EFF6FF' },
  benefits:       { label: 'Benefits',       color: '#065F46', bg: '#ECFDF5' },
  communications: { label: 'Communications', color: '#92400E', bg: '#FFFBEB' },
  learning:       { label: 'Learning',       color: '#3730A3', bg: '#EEF2FF' },
};

// Enumerated field values drawn from mock data — makes rule builder non-freetext
const fieldValueOptions: Record<string, string[]> = {
  country:        ['US', 'GB'],
  employmentType: ['full_time', 'part_time', 'contractor'],
  department:     ['Engineering', 'Sales', 'Finance', 'HR', 'Marketing'],
  location:       ['San Francisco', 'New York', 'Austin', 'London'],
  title:          [],
};

const fieldLabels: Record<string, string> = {
  country:        'Country',
  employmentType: 'Employment type',
  department:     'Department',
  location:       'Location',
  roleState:      'Role state',
  startDate:      'Start date',
  title:          'Title',
};

const fieldValueLabels: Record<string, Record<string, string>> = {
  employmentType: { full_time: 'Full-time', part_time: 'Part-time', contractor: 'Contractor' },
  country:        { US: 'United States', GB: 'United Kingdom' },
};

function humanFieldValue(field: string, value: string): string {
  return fieldValueLabels[field]?.[value] ?? value;
}

const operatorLabels: Record<string, string> = {
  is: 'is',  is_not: 'is not',  contains: 'contains',
  greater_than: '>',  less_than: '<',  after: 'after',  before: 'before',  in: 'in',
};

const fieldOptions = ['country', 'employmentType', 'department', 'location', 'title'];
const operatorOptions: Array<RuleCondition['operator']> = ['is', 'is_not', 'contains', 'in'];

function ruleToText(node: RuleNode): string {
  if (node.type === 'condition') {
    const val = Array.isArray(node.value)
      ? node.value.map((v) => humanFieldValue(node.field, v)).join(', ')
      : humanFieldValue(node.field, node.value as string);
    return `${fieldLabels[node.field] || node.field} ${operatorLabels[node.operator] || node.operator} ${val}`;
  }
  return node.children.map(ruleToText).join(` ${node.combinator} `);
}

function evaluateRule(rule: RuleNode, person: Person): boolean {
  if (rule.type === 'condition') {
    const val = (person as unknown as Record<string, string>)[rule.field];
    if (val === undefined) return false;
    switch (rule.operator) {
      case 'is':           return val === rule.value;
      case 'is_not':       return val !== rule.value;
      case 'contains':     return typeof val === 'string' && val.toLowerCase().includes(String(rule.value).toLowerCase());
      case 'in':           return Array.isArray(rule.value) && rule.value.includes(val);
      case 'after':        return val > (rule.value as string);
      case 'before':       return val < (rule.value as string);
      default:             return false;
    }
  }
  if (rule.combinator === 'AND') return rule.children.every((c) => evaluateRule(c, person));
  return rule.children.some((c) => evaluateRule(c, person));
}

function computeMembers(
  rule: RuleGroup,
  people: Person[],
  layers: EvaluationLayer[],
): { included: Person[]; layerExcluded: { person: Person; layerLabel: string }[] } {
  const ruleMatched = people.filter((p) => evaluateRule(rule, p));
  const layerExcluded: { person: Person; layerLabel: string }[] = [];
  const layerExcludedIds = new Set<string>();

  for (const layer of layers) {
    for (const pid of layer.excludedPeopleIds) {
      if (!layerExcludedIds.has(pid)) {
        layerExcludedIds.add(pid);
        const person = people.find((p) => p.id === pid);
        if (person && ruleMatched.some((p) => p.id === pid)) {
          layerExcluded.push({ person, layerLabel: layer.label });
        }
      }
    }
  }

  const included = ruleMatched.filter((p) => !layerExcludedIds.has(p.id));
  return { included, layerExcluded };
}

// ── Design tokens ─────────────────────────────────────────────────────────

const FONT_SANS = "'Geist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
const FONT_MONO = "'Geist Mono', 'SF Mono', 'Fira Mono', 'Consolas', monospace";

const C = {
  bg:          '#F7F6F4',   // warm off-white ground
  surface:     '#FFFFFF',
  border:      '#E6E3DE',   // warm hairline
  borderStrong:'#D4D0C9',
  text:        '#1A1916',   // warm near-black
  textSub:     '#6B6862',   // secondary
  textMuted:   '#A8A49E',   // tertiary / labels
  textFaint:   '#C4C0B9',   // placeholder / disabled
  primary:     '#1A1916',   // button primary
  overlay:     'rgba(15,14,12,0.52)',
} as const;

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  root: {
    fontFamily: FONT_SANS,
    color: C.text,
    minHeight: '100%',
    background: C.bg,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
  } as React.CSSProperties,

  // ── Policy Map
  mapOuter:     { maxWidth: '820px', padding: '2.25rem 2.25rem 3rem' } as React.CSSProperties,
  mapPageTitle: { fontSize: '1rem', fontWeight: 600, color: C.text, marginBottom: '0.25rem', letterSpacing: '-0.015em' } as React.CSSProperties,
  mapSubtitle:  { fontSize: '0.8125rem', color: C.textSub, marginBottom: '2.25rem', lineHeight: 1.6 } as React.CSSProperties,

  domainBlock: { marginBottom: '2.25rem' } as React.CSSProperties,
  domainLabel: (domain: PolicyDomain) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.3125rem',
    fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.09em', color: domainConfig[domain].color,
    marginBottom: '0.5rem',
  }) as React.CSSProperties,

  policyRow: (tier: SensitivityTier) => ({
    display: 'grid', gridTemplateColumns: '1fr auto',
    alignItems: 'center', gap: '1.25rem',
    padding: '0.6875rem 1rem 0.6875rem 1.0625rem',
    background: C.surface,
    borderRadius: '6px', marginBottom: '2px',
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${tierConfig[tier].dot}`,
  }) as React.CSSProperties,

  policyName:    { fontSize: '0.875rem', fontWeight: 500, color: C.text, marginBottom: '0.25rem', lineHeight: 1.35 } as React.CSSProperties,
  groupChipWrap: { display: 'flex', flexWrap: 'wrap' as const, gap: '0.25rem', alignItems: 'center' } as React.CSSProperties,
  groupChip: {
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.1875rem 0.4375rem 0.1875rem 0.3125rem',
    borderRadius: '100px',
    background: C.bg, border: `1px solid ${C.border}`,
    fontSize: '0.6875rem', fontWeight: 500, color: C.textSub,
    cursor: 'pointer', userSelect: 'none' as const,
    transition: 'background 0.1s',
  } as React.CSSProperties,
  groupChipDot: (tier: SensitivityTier) => ({
    width: '5px', height: '5px', borderRadius: '50%',
    background: tierConfig[tier].dot, flexShrink: 0,
  }) as React.CSSProperties,

  policyRight:   { display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: '0.25rem' } as React.CSSProperties,
  affectedCount: { fontSize: '0.875rem', fontWeight: 600, color: C.text, fontVariantNumeric: 'tabular-nums' as const } as React.CSSProperties,
  affectedLabel: { fontSize: '0.625rem', color: C.textMuted, letterSpacing: '0.02em' } as React.CSSProperties,

  orphanBox: {
    marginTop: '2rem', padding: '0.875rem 1rem',
    background: C.surface, borderRadius: '6px',
    border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${tierConfig[2].dot}`,
  } as React.CSSProperties,

  // ── Shared page layout
  pageOuter: { maxWidth: '860px', padding: '2rem 2.25rem 3.5rem' } as React.CSSProperties,

  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: '0.375rem',
    fontSize: '0.75rem', color: C.textMuted, marginBottom: '1.5rem',
  } as React.CSSProperties,
  breadcrumbLink:    { cursor: 'pointer', color: C.textSub } as React.CSSProperties,
  breadcrumbSep:     { color: C.textFaint } as React.CSSProperties,
  breadcrumbCurrent: { color: C.textSub } as React.CSSProperties,

  pageTitle:   { fontSize: '1.1875rem', fontWeight: 600, color: C.text, letterSpacing: '-0.02em' } as React.CSSProperties,
  pagePurpose: { fontSize: '0.8125rem', color: C.textSub, marginTop: '0.1875rem', marginBottom: '1.375rem', lineHeight: 1.6 } as React.CSSProperties,

  metaRow: {
    display: 'flex', gap: '2rem',
    paddingBottom: '1.25rem', marginBottom: '1.375rem',
    borderBottom: `1px solid ${C.border}`,
  } as React.CSSProperties,
  metaItem: { display: 'flex', flexDirection: 'column' as const, gap: '0.1875rem' } as React.CSSProperties,
  metaKey:  { fontSize: '0.5625rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.09em', color: C.textFaint } as React.CSSProperties,
  metaVal:  { fontSize: '0.8125rem', fontWeight: 500, color: C.textSub } as React.CSSProperties,

  // ── Tier badge
  tierBadge: (tier: SensitivityTier) => ({
    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
    padding: '0.1875rem 0.4375rem',
    borderRadius: '4px',
    fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.02em',
    color: tierConfig[tier].color,
    background: tierConfig[tier].bg,
    border: `1px solid ${tierConfig[tier].border}`,
  }) as React.CSSProperties,

  // ── Consequence map (group detail)
  consequenceMap: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: '0.5rem', marginBottom: '1.5rem',
  } as React.CSSProperties,
  consequenceCard: (tier: SensitivityTier) => ({
    padding: '1rem', borderRadius: '7px',
    background: C.surface,
    border: `1px solid ${C.border}`,
    borderTop: `3px solid ${tierConfig[tier].dot}`,
  }) as React.CSSProperties,
  consequenceCardTitle: { fontSize: '0.8125rem', fontWeight: 600, color: C.text, marginBottom: '0.1875rem' } as React.CSSProperties,
  consequenceCardMeta:  { fontSize: '0.6875rem', color: C.textMuted, lineHeight: 1.4 } as React.CSSProperties,
  consequenceCount: {
    fontSize: '1.5rem', fontWeight: 600, color: C.text,
    marginTop: '0.75rem', letterSpacing: '-0.03em',
    fontVariantNumeric: 'tabular-nums' as const,
    fontFamily: FONT_MONO,
  } as React.CSSProperties,
  consequenceCountSub: { fontSize: '0.6875rem', color: C.textMuted, fontWeight: 400, fontFamily: FONT_SANS } as React.CSSProperties,

  orphanNotice: {
    padding: '0.75rem 1rem', borderRadius: '6px',
    background: C.surface, border: `1px solid ${C.border}`,
    borderLeft: `3px solid ${tierConfig[2].dot}`,
    fontSize: '0.8125rem', color: C.textSub, marginBottom: '1.5rem',
  } as React.CSSProperties,

  // ── Rule box (read-only)
  ruleSection: { marginBottom: '1rem' } as React.CSSProperties,
  ruleBox: {
    padding: '0.875rem 1rem',
    background: C.bg,
    borderRadius: '6px', border: `1px solid ${C.border}`,
    fontSize: '0.8125rem', lineHeight: 1.8,
  } as React.CSSProperties,
  conditionLine: { display: 'flex', alignItems: 'center', gap: '0.375rem', flexWrap: 'wrap' as const } as React.CSSProperties,
  condField: { fontWeight: 500, color: C.textSub } as React.CSSProperties,
  condOp:    { color: C.textFaint, fontSize: '0.75rem' } as React.CSSProperties,
  condVal: {
    display: 'inline-flex', alignItems: 'center',
    padding: '0.0625rem 0.3125rem', borderRadius: '3px',
    background: C.border, color: C.text,
    fontSize: '0.75rem', fontWeight: 600,
    fontFamily: FONT_MONO,
  } as React.CSSProperties,
  combinator: {
    fontSize: '0.5625rem', fontWeight: 700, color: C.textFaint,
    letterSpacing: '0.1em', textTransform: 'uppercase' as const, padding: '0.1875rem 0',
  } as React.CSSProperties,

  // ── Evaluation layer (constraint rows)
  layerRow: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    background: C.surface, borderRadius: '5px', marginBottom: '2px',
    border: `1px solid ${C.border}`,
    cursor: 'pointer', fontSize: '0.8125rem',
  } as React.CSSProperties,
  layerExpanded: {
    padding: '0.5rem 0.875rem 0.75rem 2.25rem',
    background: C.bg, borderRadius: '0 0 5px 5px',
    marginTop: '-2px', marginBottom: '2px',
    fontSize: '0.75rem', color: C.textSub, lineHeight: 1.6,
    border: `1px solid ${C.border}`, borderTop: 'none',
  } as React.CSSProperties,

  // ── Members
  sectionLabel: {
    fontSize: '0.625rem', fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.09em',
    color: C.textMuted, marginBottom: '0.625rem',
  } as React.CSSProperties,
  memberRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0.5rem 0.375rem',
    borderBottom: `1px solid ${C.bg}`,
    fontSize: '0.8125rem', cursor: 'pointer',
  } as React.CSSProperties,
  memberName: { fontWeight: 500, color: C.text } as React.CSSProperties,
  memberMeta: { fontSize: '0.6875rem', color: C.textMuted, marginTop: '0.0625rem' } as React.CSSProperties,

  // ── Buttons
  btn: (variant: 'primary' | 'secondary' | 'ghost' | 'danger') => {
    const base: React.CSSProperties = {
      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
      padding: '0.4375rem 0.875rem', borderRadius: '5px',
      fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
      border: '1px solid transparent', lineHeight: 1,
      fontFamily: FONT_SANS,
    };
    switch (variant) {
      case 'primary':   return { ...base, background: C.primary, color: '#FFF', boxShadow: '0 1px 2px rgba(0,0,0,0.18)' };
      case 'secondary': return { ...base, background: C.surface, color: C.text, border: `1px solid ${C.borderStrong}`, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' };
      case 'danger':    return { ...base, background: '#B91C1C', color: '#FFF' };
      case 'ghost':     return { ...base, background: 'transparent', color: C.textSub, padding: '0.375rem 0.5rem' };
    }
  },

  // ── Tabs
  tabBar: {
    display: 'flex',
    borderBottom: `1px solid ${C.border}`,
    marginBottom: '1.5rem',
  } as React.CSSProperties,
  tab: (active: boolean) => ({
    padding: '0.5rem 1rem',
    fontSize: '0.8125rem',
    fontWeight: active ? 600 : 400,
    color: active ? C.text : C.textMuted,
    background: 'none', border: 'none', cursor: 'pointer',
    borderBottom: `2px solid ${active ? C.primary : 'transparent'}`,
    marginBottom: '-1px',
  }) as React.CSSProperties,

  // ── Rule builder
  ruleBuilderBox: {
    padding: '0.875rem',
    background: C.surface, borderRadius: '6px',
    border: `1px solid ${C.border}`, marginBottom: '1rem',
  } as React.CSSProperties,
  condRow: { display: 'flex', alignItems: 'center', gap: '0.375rem', padding: '0.25rem 0' } as React.CSSProperties,
  builderSelect: {
    padding: '0.3125rem 0.5rem', borderRadius: '5px',
    border: `1px solid ${C.borderStrong}`,
    fontSize: '0.8125rem', background: C.surface,
    cursor: 'pointer', color: C.text,
    fontFamily: FONT_SANS,
  } as React.CSSProperties,

  // ── Diff badges
  diffBadge: (type: 'added' | 'removed') => ({
    display: 'inline-flex', alignItems: 'center',
    padding: '0.0625rem 0.375rem', borderRadius: '3px',
    fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.02em',
    color: type === 'added' ? '#14532D' : '#7F1D1D',
    background: type === 'added' ? '#DCFCE7' : '#FEE2E2',
  }) as React.CSSProperties,

  // ── Impact map (edit view)
  impactMapGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
    gap: '0.5rem', marginBottom: '1.25rem',
  } as React.CSSProperties,
  impactCard: (tier: SensitivityTier, hasChanges: boolean) => ({
    padding: '0.75rem', borderRadius: '6px',
    background: C.surface,
    border: `1px solid ${hasChanges ? tierConfig[tier].dot : C.border}`,
    borderTop: `3px solid ${tierConfig[tier].dot}`,
    transition: 'border-color 0.15s',
  }) as React.CSSProperties,

  // ── Staging modal
  overlay: {
    position: 'fixed' as const, inset: 0,
    background: C.overlay,
    backdropFilter: 'blur(2px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
  } as React.CSSProperties,
  modal: {
    background: C.surface, borderRadius: '10px', padding: '1.75rem',
    maxWidth: '500px', width: '90%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.05)',
  } as React.CSSProperties,

  // ── Inline select
  inlineWrap: {
    background: C.surface, borderRadius: '10px',
    border: `1px solid ${C.borderStrong}`,
    overflow: 'hidden', width: '100%', maxWidth: '480px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.03)',
  } as React.CSSProperties,
  inlineHeader: {
    padding: '0.75rem 1rem', borderBottom: `1px solid ${C.border}`,
    fontSize: '0.8125rem', fontWeight: 600, color: C.text,
  } as React.CSSProperties,
  inlineSearch: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    padding: '0.625rem 1rem', borderBottom: `1px solid ${C.border}`,
  } as React.CSSProperties,
  inlineInput: { flex: 1, border: 'none', outline: 'none', fontSize: '0.8125rem', background: 'transparent', color: C.text, fontFamily: FONT_SANS } as React.CSSProperties,
  inlineGroupRow: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '0.625rem 1rem', cursor: 'pointer', borderBottom: `1px solid ${C.border}`,
  } as React.CSSProperties,
  sharedWarning: {
    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
    padding: '0.625rem 0.875rem',
    background: '#FFFBEB',
    borderRadius: '5px', border: `1px solid #FDE68A`,
    fontSize: '0.75rem', color: '#78350F', marginBottom: '0.875rem',
  } as React.CSSProperties,

  // ── Confirm/success screens
  confirmScreen: {
    display: 'flex', flexDirection: 'column' as const,
    alignItems: 'flex-start', maxWidth: '420px',
    padding: '2.5rem 2.25rem',
  } as React.CSSProperties,
  confirmIcon: {
    width: '36px', height: '36px', borderRadius: '8px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '1.125rem', marginBottom: '1.25rem',
  } as React.CSSProperties,
  confirmTitle: { fontSize: '1rem', fontWeight: 600, color: C.text, marginBottom: '0.375rem', letterSpacing: '-0.015em' } as React.CSSProperties,
  confirmBody:  { fontSize: '0.8125rem', color: C.textSub, lineHeight: 1.65, marginBottom: '1.5rem' } as React.CSSProperties,

  // ── Template / reuse cards
  templateCard: {
    padding: '0.875rem 1rem', background: C.surface, borderRadius: '6px',
    border: `1px solid ${C.border}`, marginBottom: '0.375rem',
    cursor: 'pointer', transition: 'border-color 0.1s, box-shadow 0.1s',
  } as React.CSSProperties,
  templateName: { fontSize: '0.875rem', fontWeight: 500, color: C.text, marginBottom: '0.125rem' } as React.CSSProperties,
  templateDesc: { fontSize: '0.75rem', color: C.textMuted, lineHeight: 1.5 } as React.CSSProperties,

  // ── Empty
  emptyState: {
    padding: '2.5rem', color: C.textFaint, fontSize: '0.8125rem',
    textAlign: 'center' as const, lineHeight: 1.65,
  } as React.CSSProperties,
};

// ── TierBadge ──────────────────────────────────────────────────────────────

function TierBadge({ tier }: { tier: SensitivityTier }) {
  return (
    <span style={s.tierBadge(tier)}>
      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: tierConfig[tier].dot, display: 'inline-block' }} />
      Tier {tier} &middot; {tierConfig[tier].label}
    </span>
  );
}

// ── RuleNodeDisplay (read-only) ────────────────────────────────────────────

function RuleNodeDisplay({ node, depth = 0 }: { node: RuleNode; depth?: number }) {
  if (node.type === 'condition') {
    const fLabel = fieldLabels[node.field] || node.field;
    const oLabel = operatorLabels[node.operator] || node.operator;
    const val = Array.isArray(node.value)
      ? node.value.map((v) => humanFieldValue(node.field, v)).join(', ')
      : humanFieldValue(node.field, node.value as string);
    return (
      <div style={{ ...s.conditionLine, paddingLeft: `${depth * 12}px` }}>
        <span style={s.condField}>{fLabel}</span>
        <span style={s.condOp}>{oLabel}</span>
        <span style={s.condVal}>{val || <em style={{ opacity: 0.5 }}>any</em>}</span>
      </div>
    );
  }
  return (
    <div style={{ paddingLeft: `${depth * 12}px` }}>
      {node.children.map((child, i) => (
        <React.Fragment key={i}>
          {i > 0 && <div style={s.combinator}>{node.combinator}</div>}
          <RuleNodeDisplay node={child} depth={depth + (child.type === 'group' ? 1 : 0)} />
        </React.Fragment>
      ))}
    </div>
  );
}

// ── EvaluationLayers ───────────────────────────────────────────────────────

function EvaluationLayers({
  layers,
  people,
}: {
  layers: EvaluationLayer[];
  people: Person[];
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (layers.length === 0) return null;
  const totalExcluded = new Set(layers.flatMap((l) => l.excludedPeopleIds)).size;

  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={s.sectionLabel}>Policy constraints — {totalExcluded} people excluded by system filters</div>
      {layers.map((layer) => {
        const open = expandedId === layer.id;
        const excluded = layer.excludedPeopleIds
          .map((id) => people.find((p) => p.id === id))
          .filter((p): p is Person => p !== undefined);
        return (
          <div key={layer.id}>
            <div
              style={s.layerRow}
              onClick={() => setExpandedId(open ? null : layer.id)}
              role="button" tabIndex={0} aria-expanded={open}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(open ? null : layer.id); } }}
            >
              <span style={{ color: '#D97706', fontSize: '0.625rem', lineHeight: 1 }}>{open ? '▾' : '▸'}</span>
              <span style={{ fontWeight: 500, fontSize: '0.8125rem', color: '#1A1916' }}>{layer.label}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: '#92400E', fontVariantNumeric: 'tabular-nums' }}>
                {layer.excludedPeopleIds.length} excluded
              </span>
            </div>
            {open && (
              <div style={s.layerExpanded}>
                <p style={{ marginBottom: '0.375rem' }}>{layer.description}</p>
                {excluded.length > 0 && (
                  <ul style={{ paddingLeft: '1rem', margin: 0, color: C.textSub }}>
                    {excluded.map((p) => (
                      <li key={p.id}>{p.name} — {p.title}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── MemberList ─────────────────────────────────────────────────────────────

function MemberList({
  members,
  layerExcluded,
  onSelect,
  selectedId,
  diffAdded,
  diffRemoved,
}: {
  members: Person[];
  layerExcluded?: { person: Person; layerLabel: string }[];
  onSelect?: (id: string | null) => void;
  selectedId?: string | null;
  diffAdded?: Set<string>;
  diffRemoved?: Set<string>;
}) {
  const [showExcluded, setShowExcluded] = useState(false);
  const constraintExcluded = layerExcluded ?? [];

  return (
    <div>
      <div style={s.sectionLabel}>
        Members — {members.length}
        {constraintExcluded.length > 0 && (
          <span style={{ color: tierConfig[2].color, marginLeft: '0.375rem', fontWeight: 400 }}>
            + {constraintExcluded.length} excluded by constraints
          </span>
        )}
      </div>

      {members.map((p) => {
        const added   = diffAdded?.has(p.id);
        const isSelected = selectedId === p.id;
        return (
          <div
            key={p.id}
            style={{
              ...s.memberRow,
              background: added ? tierConfig[3].bg : isSelected ? C.bg : undefined,
              borderLeft: added ? `3px solid ${tierConfig[3].dot}` : undefined,
            }}
            onClick={() => onSelect?.(isSelected ? null : p.id)}
            role={onSelect ? 'button' : undefined} tabIndex={onSelect ? 0 : undefined}
            onKeyDown={(e) => { if (onSelect && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(isSelected ? null : p.id); } }}
          >
            <div>
              <div style={s.memberName}>
                {p.name}
                {added && <span style={{ ...s.diffBadge('added'), marginLeft: '0.5rem' }}>+ entering</span>}
              </div>
              <div style={s.memberMeta}>{p.title} &middot; {p.department} &middot; {p.location}</div>
            </div>
            <div style={{ fontSize: '0.6875rem', color: C.textFaint }}>
              {p.employmentType.replace('_', ' ')}
            </div>
          </div>
        );
      })}

      {diffRemoved && diffRemoved.size > 0 && (
        <>
          <div style={{ ...s.sectionLabel, color: tierConfig[1].dot, marginTop: '0.75rem' }}>
            Leaving — {diffRemoved.size}
          </div>
          {Array.from(diffRemoved).map((id) => {
            const p = constraintExcluded.find((e) => e.person.id === id)?.person
              ?? members.find((m) => m.id === id);
            if (!p) return null;
            return (
              <div key={p.id} style={{ ...s.memberRow, background: tierConfig[1].bg, borderLeft: `3px solid ${tierConfig[1].dot}` }}>
                <div>
                  <div style={s.memberName}>
                    {p.name}
                    <span style={{ ...s.diffBadge('removed'), marginLeft: '0.5rem' }}>- leaving</span>
                  </div>
                  <div style={s.memberMeta}>{p.title} &middot; {p.department}</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {constraintExcluded.length > 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <button style={s.btn('ghost')} onClick={() => setShowExcluded(!showExcluded)}>
            {showExcluded ? 'Hide' : 'Show'} {constraintExcluded.length} excluded by constraints
          </button>
          {showExcluded && constraintExcluded.map((e) => (
            <div key={e.person.id} style={{ ...s.memberRow, opacity: 0.55 }}>
              <div>
                <div style={s.memberName}>{e.person.name}</div>
                <div style={s.memberMeta}>{e.person.title} &middot; {e.person.department}</div>
              </div>
              <div style={{ fontSize: '0.6875rem', color: tierConfig[2].color }}>{e.layerLabel}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── PersonExplanation ──────────────────────────────────────────────────────

function PersonExplanation({ person, group }: { person: Person; group: SavedGroup }) {
  const ruleMatch = evaluateRule(group.rule, person);
  const layerHits = group.evaluationLayers.filter((l) => l.excludedPeopleIds.includes(person.id));
  const isIn = group.memberIds.includes(person.id);
  return (
    <div style={{ padding: '0.75rem 1rem', background: '#F7F6F4', borderRadius: '6px', border: '1px solid #E6E3DE', marginTop: '0.375rem', fontSize: '0.8125rem', lineHeight: 1.6 }}>
      <div style={{ fontWeight: 600, marginBottom: '0.3125rem', color: '#1A1916', fontSize: '0.8125rem' }}>
        {person.name} is {isIn ? 'included' : 'excluded'}
      </div>
      <div style={{ color: '#6B6862' }}>
        <div>Rule match: <strong style={{ color: '#1A1916' }}>{ruleMatch ? 'yes' : 'no'}</strong> ({ruleToText(group.rule)})</div>
        {layerHits.length > 0 && (
          <div style={{ marginTop: '0.25rem', color: '#78350F' }}>
            Excluded by constraint: {layerHits.map((l) => l.label).join('; ')}
          </div>
        )}
        {!ruleMatch && layerHits.length === 0 && (
          <div style={{ marginTop: '0.25rem', color: '#6B6862' }}>Doesn't match the rule conditions.</div>
        )}
      </div>
    </div>
  );
}

// ── RuleBuilder ────────────────────────────────────────────────────────────

function RuleBuilder({ rule, onChange }: { rule: RuleGroup; onChange: (r: RuleGroup) => void }) {
  const updateCondition = (i: number, updates: Partial<RuleCondition>) => {
    const children = [...rule.children];
    const existing = children[i];
    if (existing.type === 'condition') children[i] = { ...existing, ...updates };
    onChange({ ...rule, children });
  };

  const addCondition = () => {
    onChange({
      ...rule,
      children: [...rule.children, { type: 'condition', field: 'department', operator: 'is', value: 'Engineering' }],
    });
  };

  const removeCondition = (i: number) => {
    if (rule.children.length <= 1) return;
    onChange({ ...rule, children: rule.children.filter((_, j) => j !== i) });
  };

  const handleFieldChange = (i: number, field: string) => {
    const firstVal = fieldValueOptions[field]?.[0] ?? '';
    updateCondition(i, { field, value: firstVal });
  };

  return (
    <div style={s.ruleBuilderBox}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
        <div style={s.sectionLabel}>Rule builder</div>
        <button
          style={{ ...s.btn('ghost'), fontSize: '0.6875rem', padding: '0.125rem 0.375rem' }}
          onClick={() => onChange({ ...rule, combinator: rule.combinator === 'AND' ? 'OR' : 'AND' })}
        >
          Match: {rule.combinator === 'AND' ? 'all conditions' : 'any condition'}
        </button>
      </div>

      {rule.children.map((child, i) => {
        if (child.type !== 'condition') {
          return (
            <div key={i} style={{ padding: '0.375rem', fontSize: '0.75rem', color: C.textMuted, fontStyle: 'italic' }}>
              [Nested group — view only]
            </div>
          );
        }
        const valueOpts = fieldValueOptions[child.field] ?? [];
        return (
          <div key={i}>
            {i > 0 && (
              <div style={s.combinator}>{rule.combinator}</div>
            )}
            <div style={s.condRow}>
              {/* Field */}
              <select
                style={s.builderSelect}
                value={child.field}
                onChange={(e) => handleFieldChange(i, e.target.value)}
                aria-label="Field"
              >
                {fieldOptions.map((f) => (
                  <option key={f} value={f}>{fieldLabels[f] || f}</option>
                ))}
              </select>

              {/* Operator */}
              <select
                style={s.builderSelect}
                value={child.operator}
                onChange={(e) => updateCondition(i, { operator: e.target.value as RuleCondition['operator'] })}
                aria-label="Operator"
              >
                {operatorOptions.map((op) => (
                  <option key={op} value={op}>{operatorLabels[op]}</option>
                ))}
              </select>

              {/* Value — dropdown when options exist, text otherwise */}
              {valueOpts.length > 0 ? (
                <select
                  style={s.builderSelect}
                  value={Array.isArray(child.value) ? child.value[0] : child.value as string}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                  aria-label="Value"
                >
                  {valueOpts.map((v) => (
                    <option key={v} value={v}>{humanFieldValue(child.field, v)}</option>
                  ))}
                </select>
              ) : (
                <input
                  style={{ ...s.builderSelect, width: '130px' }}
                  value={Array.isArray(child.value) ? (child.value as string[]).join(', ') : child.value as string}
                  onChange={(e) => updateCondition(i, { value: e.target.value })}
                  placeholder="value"
                  aria-label="Value"
                />
              )}

              <button
                style={{ ...s.btn('ghost'), color: C.textMuted, fontSize: '0.875rem', padding: '0.125rem 0.375rem' }}
                onClick={() => removeCondition(i)}
                disabled={rule.children.length <= 1}
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          </div>
        );
      })}
      <button style={{ ...s.btn('ghost'), marginTop: '0.375rem', fontSize: '0.75rem' }} onClick={addCondition}>
        + Add condition
      </button>
    </div>
  );
}

// ── ImpactMap (edit view) ──────────────────────────────────────────────────

function ImpactMap({
  consumers,
  originalMembers,
  newMembers,
}: {
  consumers: PolicyRef[];
  originalMembers: Person[];
  newMembers: Person[];
}) {
  const origIds = new Set(originalMembers.map((p) => p.id));
  const newIds  = new Set(newMembers.map((p) => p.id));
  const added   = newMembers.filter((p) => !origIds.has(p.id));
  const removed = originalMembers.filter((p) => !newIds.has(p.id));
  const hasChanges = added.length > 0 || removed.length > 0;

  if (consumers.length === 0) return null;

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div style={s.sectionLabel}>Impact map — downstream effects of this change</div>
      {!hasChanges && (
        <div style={{ fontSize: '0.75rem', color: C.textFaint, marginBottom: '0.625rem' }}>
          No membership changes yet. Adjust the rule to see impact.
        </div>
      )}
      <div style={s.impactMapGrid}>
        {consumers.map((c) => {
          const tc = tierConfig[c.sensitivityTier];
          // Per-policy severity framing: what this delta means for this specific consumer
          const domainVerb: Record<PolicyDomain, string> = {
            payroll:        'paid through',
            benefits:       'enrolled in',
            it:             'provisioned by',
            compliance:     'in scope for',
            communications: 'subscribed to',
            learning:       'enrolled in',
          };
          return (
            <div key={c.id} style={s.impactCard(c.sensitivityTier, hasChanges)}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#1A1916', lineHeight: 1.3 }}>{c.name}</span>
                <TierBadge tier={c.sensitivityTier} />
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#A8A49E' }}>
                {c.affectedCount.toLocaleString()} people currently {domainVerb[c.domain]} this policy
              </div>
              {hasChanges && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1875rem' }}>
                  {added.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: tc.color, fontWeight: 500 }}>
                      +{added.length} will be {domainVerb[c.domain].split(' ')[0] === 'paid' ? 'added to payroll' :
                        domainVerb[c.domain].split(' ')[0] === 'provisioned' ? 'provisioned' :
                        `enrolled`}
                    </div>
                  )}
                  {removed.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: tierConfig[1].color, fontWeight: 500 }}>
                      -{removed.length} will be removed from this policy
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Staging Modal ──────────────────────────────────────────────────────────

function StagingModal({
  group, added, removed, onConfirm, onCancel,
}: {
  group: SavedGroup; added: Person[]; removed: Person[];
  onConfirm: () => void; onCancel: () => void;
}) {
  const tier = deriveSensitivityTier(group.consumers);

  return (
    <div style={s.overlay} onClick={onCancel} role="dialog" aria-modal="true" aria-label="Confirm changes">
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1A1916', marginBottom: '0.5rem', letterSpacing: '-0.015em' }}>
          {tier === 1 ? 'Stage changes for approval' : 'Apply changes?'}
        </div>
        <div style={{ fontSize: '0.8125rem', color: '#6B6862', lineHeight: 1.6, marginBottom: '1rem' }}>
          {tier === 1 ? (
            <>
              <strong>{group.name}</strong> is referenced by critical policies (
              {group.consumers.filter((c) => c.sensitivityTier === 1).map((c) => c.name).join(', ')}).
              Your changes will be staged as a draft. The group owner will need to approve before they
              take effect downstream.
            </>
          ) : (
            <>
              Changes to <strong>{group.name}</strong> will apply immediately to all downstream policies.
            </>
          )}
        </div>

        {/* Downstream policies */}
        <div style={{ marginBottom: '1rem' }}>
          {group.consumers.map((c) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', padding: '0.3125rem 0', borderBottom: '1px solid #F7F6F4' }}>
              <TierBadge tier={c.sensitivityTier} />
              <span style={{ flex: 1, color: '#1A1916' }}>{c.name}</span>
              <span style={{ color: '#A8A49E', fontVariantNumeric: 'tabular-nums' }}>{c.affectedCount.toLocaleString()} people</span>
            </div>
          ))}
        </div>

        {/* Membership delta */}
        <div style={{ padding: '0.625rem 0.75rem', background: '#F7F6F4', borderRadius: '5px', border: '1px solid #E6E3DE', fontSize: '0.8125rem', marginBottom: '1rem' }}>
          {added.length > 0 && (
            <div style={{ marginBottom: '0.25rem' }}>
              <span style={s.diffBadge('added')}>+{added.length} entering</span>
              <span style={{ color: C.textMuted, marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                {added.slice(0, 3).map((p) => p.name).join(', ')}
                {added.length > 3 ? ` + ${added.length - 3} more` : ''}
              </span>
            </div>
          )}
          {removed.length > 0 && (
            <div>
              <span style={s.diffBadge('removed')}>-{removed.length} leaving</span>
              <span style={{ color: '#A8A49E', marginLeft: '0.5rem', fontSize: '0.75rem' }}>
                {removed.slice(0, 3).map((p) => p.name).join(', ')}
                {removed.length > 3 ? ` + ${removed.length - 3} more` : ''}
              </span>
            </div>
          )}
          {added.length === 0 && removed.length === 0 && (
            <span style={{ color: '#A8A49E' }}>No membership changes — metadata edit only.</span>
          )}
        </div>

        {tier === 1 && (
          <div style={{ padding: '0.5rem 0.75rem', background: '#FEF2F2', borderRadius: '5px', fontSize: '0.75rem', color: '#7F1D1D', marginBottom: '1rem', border: '1px solid #FECACA' }}>
            Approval required from: <strong>{group.owner || 'group owner (unassigned)'}</strong>
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button style={s.btn('secondary')} onClick={onCancel}>Cancel</button>
          <button style={s.btn('primary')} onClick={onConfirm}>
            {tier === 1 ? 'Submit for approval' : 'Apply changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Views ──────────────────────────────────────────────────────────────────

type ViewState =
  | { view: 'policyMap' }
  | { view: 'policyDetail'; policy: PolicyRef }
  | { view: 'groupDetail'; groupId: string; fromPolicy?: PolicyRef }
  | { view: 'groupEdit';   groupId: string; fromPolicy?: PolicyRef }
  | { view: 'create';      policyContext?: PolicyRef }
  | { view: 'inlineSelect'; policyContext: PolicyRef };

// ── PolicyMapView ──────────────────────────────────────────────────────────

function PolicyMapView({
  data, onNavigate,
}: {
  data: EntryState['data']; onNavigate: (vs: ViewState) => void;
}) {
  const { policies, savedGroups } = data;

  const byDomain = useMemo(() => {
    const m = new Map<PolicyDomain, PolicyRef[]>();
    for (const p of policies) {
      const list = m.get(p.domain) ?? [];
      list.push(p);
      m.set(p.domain, list);
    }
    return m;
  }, [policies]);

  const policyToGroups = useMemo(() => {
    const m = new Map<string, SavedGroup[]>();
    for (const g of savedGroups) {
      for (const c of g.consumers) {
        const list = m.get(c.id) ?? [];
        list.push(g);
        m.set(c.id, list);
      }
    }
    return m;
  }, [savedGroups]);

  const orphaned = useMemo(() => savedGroups.filter((g) => g.consumers.length === 0), [savedGroups]);

  // Sort domains: high-stakes first
  const domainOrder: PolicyDomain[] = ['payroll', 'compliance', 'it', 'benefits', 'communications', 'learning'];
  const domains = Array.from(byDomain.entries()).sort(
    (a, b) => domainOrder.indexOf(a[0]) - domainOrder.indexOf(b[0]),
  );

  return (
    <div style={s.mapOuter}>
      <div style={s.mapPageTitle}>Policy control plane</div>
      <div style={s.mapSubtitle}>
        What your policies target — and the groups that connect them to your people.
        Click a group to see what it controls and who it contains.
      </div>

      {domains.map(([domain, domainPolicies]) => (
        <div key={domain} style={s.domainBlock}>
          <div style={s.domainLabel(domain)}>{domainConfig[domain].label}</div>
          {domainPolicies.map((pol) => {
            const groups = policyToGroups.get(pol.id) ?? [];
            return (
              <div key={pol.id} style={s.policyRow(pol.sensitivityTier)}>
                <div>
                  <div
                    style={{ ...s.policyName, cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); onNavigate({ view: 'policyDetail', policy: pol }); }}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'policyDetail', policy: pol }); } }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'underline'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = 'none'; }}
                  >{pol.name}</div>
                  <div style={s.groupChipWrap}>
                    {groups.length > 0 ? groups.map((g) => {
                      const gt = deriveSensitivityTier(g.consumers);
                      return (
                        <span
                          key={g.id}
                          style={s.groupChip}
                          onClick={() => onNavigate({ view: 'groupDetail', groupId: g.id, fromPolicy: pol })}
                          role="button" tabIndex={0}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'groupDetail', groupId: g.id, fromPolicy: pol }); } }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#ECEAE6'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#F7F6F4'; }}
                        >
                          <span style={s.groupChipDot(gt)} />
                          {g.name || 'Unnamed'} &middot; {g.memberIds.length}
                        </span>
                      );
                    }) : (
                      <span style={{ fontSize: '0.6875rem', color: '#C4C0B9', fontStyle: 'italic' }}>No group assigned</span>
                    )}
                  </div>
                </div>
                <div style={s.policyRight}>
                  <span style={s.affectedCount}>{pol.affectedCount.toLocaleString()}</span>
                  <span style={s.affectedLabel}>people</span>
                  <TierBadge tier={pol.sensitivityTier} />
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {orphaned.length > 0 && (
        <div style={s.orphanBox}>
          <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#78350F', marginBottom: '0.25rem' }}>
            {orphaned.length} orphaned group{orphaned.length > 1 ? 's' : ''} — not used by any policy
          </div>
          <div style={{ fontSize: '0.75rem', color: '#92400E', marginBottom: '0.5rem', lineHeight: 1.5 }}>
            These groups are running but not connected to any downstream consumer. Consider archiving them.
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
            {orphaned.map((g) => (
              <span
                key={g.id}
                style={{ ...s.groupChip, background: '#FFFBEB', borderColor: '#FDE68A', color: '#78350F' }}
                onClick={() => onNavigate({ view: 'groupDetail', groupId: g.id })}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'groupDetail', groupId: g.id }); } }}
              >
                {g.name || 'Unnamed'} &middot; {g.memberIds.length}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ marginTop: '1.75rem' }}>
        <button style={s.btn('primary')} onClick={() => onNavigate({ view: 'create' })}>
          + New targeting audience
        </button>
      </div>
    </div>
  );
}

// ── PolicyDetailView ──────────────────────────────────────────────────────

function PolicyDetailView({
  policy, data, onNavigate,
}: {
  policy: PolicyRef; data: EntryState['data'];
  onNavigate: (vs: ViewState) => void;
}) {
  const groups = useMemo(
    () => data.savedGroups.filter((g) => g.consumers.some((c) => c.id === policy.id)),
    [data.savedGroups, policy],
  );

  return (
    <div style={s.pageOuter}>
      <div style={s.breadcrumb}>
        <span
          style={s.breadcrumbLink}
          onClick={() => onNavigate({ view: 'policyMap' })}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'policyMap' }); } }}
        >
          Policy map
        </span>
        <span style={s.breadcrumbSep}>/</span>
        <span style={s.breadcrumbCurrent}>{policy.name}</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.125rem' }}>
        <h1 style={s.pageTitle}>{policy.name}</h1>
        <TierBadge tier={policy.sensitivityTier} />
      </div>
      <div style={s.pagePurpose}>
        {domainConfig[policy.domain].label} &middot; {policy.affectedCount.toLocaleString()} people affected
      </div>

      <div style={{ ...s.sectionLabel, marginBottom: '0.625rem' }}>
        Targeting groups — {groups.length} group{groups.length !== 1 ? 's' : ''} assigned
      </div>

      {groups.map((g) => {
        const gt = deriveSensitivityTier(g.consumers);
        const { included } = computeMembers(g.rule, data.people, g.evaluationLayers);
        return (
          <div
            key={g.id}
            style={s.templateCard}
            onClick={() => onNavigate({ view: 'groupDetail', groupId: g.id, fromPolicy: policy })}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'groupDetail', groupId: g.id, fromPolicy: policy }); } }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.borderStrong; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={s.templateName}>{g.name || 'Unnamed group'}</div>
              <TierBadge tier={gt} />
            </div>
            <div style={s.templateDesc}>
              {g.purpose} &middot; {included.length} members &middot; {ruleToHumanSummary(g.rule)}
            </div>
            {g.consumers.length > 1 && (
              <div style={{ marginTop: '0.25rem', fontSize: '0.6875rem', color: tierConfig[2].color }}>
                Shared by {g.consumers.length} policies — editing affects all of them
              </div>
            )}
          </div>
        );
      })}

      {groups.length === 0 && (
        <div style={{ fontSize: '0.8125rem', color: C.textMuted, marginBottom: '1rem' }}>
          No targeting group assigned to this policy yet.
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <button style={s.btn('primary')} onClick={() => onNavigate({ view: 'create', policyContext: policy })}>
          + Create new audience for {policy.name}
        </button>
      </div>
    </div>
  );
}

// ── GroupDetailView ────────────────────────────────────────────────────────

function GroupDetailView({
  group, data, fromPolicy, onNavigate,
}: {
  group: SavedGroup; data: EntryState['data']; fromPolicy?: PolicyRef;
  onNavigate: (vs: ViewState) => void;
}) {
  const [activeTab, setActiveTab] = useState<'consequences' | 'members' | 'history'>('consequences');
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const tier = deriveSensitivityTier(group.consumers);
  const { included, layerExcluded } = useMemo(
    () => computeMembers(group.rule, data.people, group.evaluationLayers),
    [group, data.people],
  );
  const selectedPerson = selectedPersonId ? data.people.find((p) => p.id === selectedPersonId) ?? null : null;

  // Fabricated history entries — one real-looking entry so the tab doesn't stub
  const historyEntries = [
    {
      date: new Date(group.lastModifiedAt),
      actor: group.lastModifiedBy,
      summary: 'Updated rule: Employment type changed from "any" to "full-time"',
      delta: { added: 3, removed: 12 },
    },
    {
      date: new Date(new Date(group.lastModifiedAt).getTime() - 14 * 24 * 60 * 60 * 1000),
      actor: 'system',
      summary: 'Membership refreshed (no rule change)',
      delta: null,
    },
  ];

  return (
    <div style={s.pageOuter}>
      {/* Breadcrumb */}
      <div style={s.breadcrumb}>
        <span
          style={s.breadcrumbLink}
          onClick={() => onNavigate({ view: 'policyMap' })}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'policyMap' }); } }}
        >
          Policy map
        </span>
        {fromPolicy && (
          <>
            <span style={s.breadcrumbSep}>/</span>
            <span>{fromPolicy.name}</span>
          </>
        )}
        <span style={s.breadcrumbSep}>/</span>
        <span style={s.breadcrumbCurrent}>{group.name || 'Unnamed group'}</span>
      </div>

      {/* Legacy banner */}
      {group.isLegacy && (
        <div style={s_legacyBanner}>
          <strong>Legacy group</strong> — no owner, purpose, or type. Last modified by system{' '}
          {new Date(group.lastModifiedAt).toLocaleDateString()}.
          This group can be edited but provenance cannot be verified.
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.125rem', flexWrap: 'wrap' }}>
        <h1 style={s.pageTitle}>{group.name || 'Unnamed group'}</h1>
        <TierBadge tier={tier} />
      </div>
      {group.purpose && <div style={s.pagePurpose}>{group.purpose}</div>}

      {/* Metadata row */}
      <div style={s.metaRow}>
        <div style={s.metaItem}>
          <span style={s.metaKey}>Owner</span>
          <span style={s.metaVal}>{group.owner || 'Unassigned'}</span>
        </div>
        <div style={s.metaItem}>
          <span style={s.metaKey}>Domain</span>
          <span style={s.metaVal}>{group.productDomain || 'Unknown'}</span>
        </div>
        <div style={s.metaItem}>
          <span style={s.metaKey}>Lifecycle</span>
          <span style={s.metaVal}>{group.lifecycleIntent}</span>
        </div>
        <div style={s.metaItem}>
          <span style={s.metaKey}>Last evaluated</span>
          <span style={s.metaVal}>{new Date(group.lastEvaluatedAt).toLocaleDateString()}</span>
        </div>
        <div style={s.metaItem}>
          <span style={s.metaKey}>Members</span>
          <span style={s.metaVal}>{included.length} active</span>
        </div>
      </div>

      {/* ── CONSEQUENCE MAP — primary content, always above fold ── */}
      {group.consumers.length === 0 ? (
        <div style={s.orphanNotice}>
          This group is not referenced by any policy, app, or workflow. It's running but has no effect.
          Consider assigning it to a policy or archiving it.
        </div>
      ) : (
        <>
          <div style={{ ...s.sectionLabel, marginBottom: '0.625rem' }}>
            What this group controls — {group.consumers.length} downstream {group.consumers.length === 1 ? 'consumer' : 'consumers'}
          </div>
          <div style={s.consequenceMap}>
            {group.consumers.map((c) => (
              <div key={c.id} style={s.consequenceCard(c.sensitivityTier)}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.25rem', marginBottom: '0.25rem' }}>
                  <div style={s.consequenceCardTitle}>{c.name}</div>
                  <TierBadge tier={c.sensitivityTier} />
                </div>
                <div style={s.consequenceCardMeta}>{domainConfig[c.domain].label}</div>
                <div style={s.consequenceCount}>
                  {c.affectedCount.toLocaleString()}
                  <span style={s.consequenceCountSub}> people affected</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Tabs */}
      <div style={s.tabBar}>
        <button style={s.tab(activeTab === 'consequences')} onClick={() => setActiveTab('consequences')}>
          Rule &amp; constraints
        </button>
        <button style={s.tab(activeTab === 'members')} onClick={() => setActiveTab('members')}>
          Members ({included.length})
        </button>
        <button style={s.tab(activeTab === 'history')} onClick={() => setActiveTab('history')}>
          History
        </button>
      </div>

      {activeTab === 'consequences' && (
        <>
          <div style={s.sectionLabel}>How membership is determined</div>
          <div style={{ fontSize: '0.875rem', color: C.textSub, fontStyle: 'italic', marginBottom: '0.625rem' }}>
            {ruleToHumanSummary(group.rule)}
          </div>
          <div style={{ ...s.ruleBox, marginBottom: '1rem' }}>
            <RuleNodeDisplay node={group.rule} />
          </div>
          <EvaluationLayers layers={group.evaluationLayers} people={data.people} />
          <div style={{ marginTop: '1rem' }}>
            <button
              style={s.btn('primary')}
              onClick={() => onNavigate({ view: 'groupEdit', groupId: group.id, fromPolicy })}
            >
              Edit group
            </button>
          </div>
        </>
      )}

      {activeTab === 'members' && (
        <>
          <MemberList
            members={included}
            layerExcluded={layerExcluded}
            onSelect={setSelectedPersonId}
            selectedId={selectedPersonId}
          />
          {selectedPerson && (
            <PersonExplanation person={selectedPerson} group={group} />
          )}
        </>
      )}

      {activeTab === 'history' && (
        <div>
          {historyEntries.map((entry, i) => (
            <div key={i} style={{ padding: '0.75rem 0', borderBottom: `1px solid ${C.border}`, fontSize: '0.8125rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                <div style={{ fontWeight: 500 }}>{entry.summary}</div>
                {entry.delta && (
                  <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                    <span style={s.diffBadge('added')}>+{entry.delta.added}</span>
                    <span style={s.diffBadge('removed')}>-{entry.delta.removed}</span>
                  </div>
                )}
              </div>
              <div style={{ fontSize: '0.6875rem', color: C.textMuted }}>
                {entry.actor} &middot; {entry.date.toLocaleDateString()} at {entry.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const legacyBannerStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
  padding: '0.5rem 0.875rem',
  background: '#FFFBEB', borderRadius: '5px',
  fontSize: '0.75rem', color: '#78350F', marginBottom: '1.25rem',
  border: '1px solid #FDE68A', lineHeight: 1.6,
};
// Patch the style object to add missing legacy banner (used in GroupDetailView)
const s_legacyBanner = legacyBannerStyle;

// ── GroupEditView — deviation-oriented editing ────────────────────────────

function GroupEditView({
  group, data, fromPolicy, onNavigate,
}: {
  group: SavedGroup; data: EntryState['data']; fromPolicy?: PolicyRef;
  onNavigate: (vs: ViewState) => void;
}) {
  const [editedRule, setEditedRule] = useState<RuleGroup>(() => JSON.parse(JSON.stringify(group.rule)));
  const [showStaging, setShowStaging] = useState(false);
  const [staged, setStaged] = useState(false);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [missingSearch, setMissingSearch] = useState('');
  const [inspectedPersonId, setInspectedPersonId] = useState<string | null>(null);

  const originalComputed = useMemo(
    () => computeMembers(group.rule, data.people, group.evaluationLayers),
    [group, data.people],
  );
  const newComputed = useMemo(
    () => computeMembers(editedRule, data.people, group.evaluationLayers),
    [editedRule, data.people, group.evaluationLayers],
  );

  const addedIds = useMemo(() => {
    const orig = new Set(originalComputed.included.map((p) => p.id));
    return new Set(newComputed.included.filter((p) => !orig.has(p.id)).map((p) => p.id));
  }, [originalComputed, newComputed]);

  const removedIds = useMemo(() => {
    const next = new Set(newComputed.included.map((p) => p.id));
    return new Set(originalComputed.included.filter((p) => !next.has(p.id)).map((p) => p.id));
  }, [originalComputed, newComputed]);

  const tier = deriveSensitivityTier(group.consumers);
  const hasChanges = addedIds.size > 0 || removedIds.size > 0;

  // People NOT in the current audience
  const notInAudience = useMemo(
    () => data.people.filter((p) => !evaluateRule(editedRule, p)),
    [editedRule, data.people],
  );

  // Why is a person included/excluded by the rule?
  const explainPerson = (person: Person) => {
    const matched: string[] = [];
    const failed: string[] = [];
    for (const child of editedRule.children) {
      if (child.type === 'condition') {
        if (evaluateRule(child, person)) matched.push(ruleToText(child));
        else failed.push(ruleToText(child));
      }
    }
    const layerHits = group.evaluationLayers.filter((l) => l.excludedPeopleIds.includes(person.id));
    return { matched, failed, layerHits, isIncluded: evaluateRule(editedRule, person) && layerHits.length === 0 };
  };

  // Suggest a rule change to include a missing person
  const suggestInclusionFor = (person: Person): { conditionIndex: number; description: string } | null => {
    for (let i = 0; i < editedRule.children.length; i++) {
      const child = editedRule.children[i];
      if (child.type === 'condition' && !evaluateRule(child, person)) {
        return {
          conditionIndex: i,
          description: `Remove "${ruleToText(child)}" to include ${person.name}`,
        };
      }
    }
    return null;
  };

  // Suggest a rule change to exclude a person currently included
  const suggestExclusionFor = (person: Person): { field: string; value: string; description: string } | null => {
    // Find a distinguishing attribute we could add as a narrowing condition
    for (const field of fieldOptions) {
      const personVal = (person as unknown as Record<string, string>)[field];
      if (personVal && !editedRule.children.some((c) => c.type === 'condition' && c.field === field && c.operator === 'is_not')) {
        return {
          field,
          value: personVal,
          description: `Add "${fieldLabels[field] || field} is not ${humanFieldValue(field, personVal)}" to exclude ${person.name}`,
        };
      }
    }
    return null;
  };

  const removeCondition = (index: number) => {
    if (editedRule.children.length <= 1) return;
    setEditedRule({
      ...editedRule,
      children: editedRule.children.filter((_, i) => i !== index),
    });
  };

  const addExclusionCondition = (field: string, value: string) => {
    setEditedRule({
      ...editedRule,
      children: [...editedRule.children, { type: 'condition', field, operator: 'is_not', value }],
    });
  };

  // ── Staged / confirmed screen
  if (staged) {
    const iconBg = tier === 1 ? tierConfig[1].bg : tierConfig[3].bg;
    const iconColor = tier === 1 ? tierConfig[1].dot : tierConfig[3].dot;
    return (
      <div style={s.pageOuter}>
        <div style={s.confirmScreen}>
          <div style={{ ...s.confirmIcon, background: iconBg, color: iconColor }}>
            {tier === 1 ? '⏳' : '✓'}
          </div>
          <div style={s.confirmTitle}>
            {tier === 1 ? 'Changes staged for approval' : 'Changes applied'}
          </div>
          <div style={s.confirmBody}>
            {tier === 1 ? (
              <>
                Your changes to <strong>{group.name}</strong> have been staged as a draft.
                {' '}<strong>{group.owner || 'The group owner'}</strong> will receive a notification to review
                and approve before the changes take effect on {group.consumers.map((c) => c.name).join(', ')}.
              </>
            ) : (
              <>
                Changes to <strong>{group.name}</strong> are now live.
                {addedIds.size > 0 && <> {addedIds.size} {addedIds.size === 1 ? 'person has' : 'people have'} been added.</>}
                {removedIds.size > 0 && <> {removedIds.size} {removedIds.size === 1 ? 'person has' : 'people have'} been removed.</>}
                {' '}All downstream policies have been updated.
              </>
            )}
          </div>
          {tier === 1 && (
            <div style={{ padding: '0.625rem 0.75rem', background: tierConfig[1].bg, borderRadius: '6px', border: `1px solid ${tierConfig[1].border}`, fontSize: '0.75rem', color: tierConfig[1].color, marginBottom: '1.25rem', width: '100%' }}>
              While pending approval, the current group definition remains in effect for all downstream policies.
              No members will enter or leave until the change is approved.
            </div>
          )}
          <button
            style={s.btn('secondary')}
            onClick={() => onNavigate({ view: 'groupDetail', groupId: group.id, fromPolicy })}
          >
            Back to group
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.pageOuter}>
      {/* Breadcrumb */}
      <div style={s.breadcrumb}>
        <span
          style={s.breadcrumbLink}
          onClick={() => onNavigate({ view: 'groupDetail', groupId: group.id, fromPolicy })}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'groupDetail', groupId: group.id, fromPolicy }); } }}
        >
          {group.name || 'Group'}
        </span>
        <span style={s.breadcrumbSep}>/</span>
        <span style={s.breadcrumbCurrent}>Edit</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
        <h1 style={s.pageTitle}>Editing: {group.name || 'Unnamed group'}</h1>
        <TierBadge tier={tier} />
      </div>
      {tier === 1 && (
        <div style={{ fontSize: '0.8125rem', color: tierConfig[1].color, marginBottom: '0.75rem' }}>
          Critical group — changes require approval before taking effect downstream.
        </div>
      )}

      {/* Downstream context — why the admin is here */}
      {group.consumers.length > 0 && (
        <div style={{
          padding: '0.75rem 1rem', background: C.bg, borderRadius: '8px',
          border: `1px solid ${C.border}`, marginBottom: '1rem',
        }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: C.textMuted, marginBottom: '0.375rem' }}>
            This group targets
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {group.consumers.map((c) => (
              <span key={c.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                padding: '0.1875rem 0.5rem', borderRadius: '4px',
                fontSize: '0.75rem', fontWeight: 500,
                color: tierConfig[c.sensitivityTier].color,
                background: tierConfig[c.sensitivityTier].bg,
                border: `1px solid ${tierConfig[c.sensitivityTier].border}`,
              }}>
                <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: tierConfig[c.sensitivityTier].dot }} />
                {c.name} &middot; {c.affectedCount.toLocaleString()}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Question the page is asking */}
      <div style={{
        fontSize: '0.875rem', color: C.textSub, marginBottom: '1rem',
        padding: '0.625rem 0.875rem', background: C.bg,
        borderRadius: '8px', border: `1px solid ${C.border}`,
        fontStyle: 'italic',
      }}>
        Is this the right set of people for {group.consumers.length > 0
          ? group.consumers.length === 1 ? group.consumers[0].name : `these ${group.consumers.length} policies`
          : 'this group'}?
      </div>

      {/* Current rule — compact read-only statement */}
      <div style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
          <div style={s.sectionLabel}>Current rule</div>
          <button
            style={{ ...s.btn('ghost'), fontSize: '0.6875rem' }}
            onClick={() => setShowRuleBuilder(!showRuleBuilder)}
          >
            {showRuleBuilder ? 'Hide rule builder' : 'Change rule directly'}
          </button>
        </div>
        <div style={{ fontSize: '0.8125rem', color: C.textSub, fontStyle: 'italic', marginBottom: '0.25rem' }}>
          {ruleToHumanSummary(editedRule)}
        </div>
        {newComputed.layerExcluded.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: tierConfig[2].color }}>
            {newComputed.layerExcluded.length} people excluded by constraints
          </div>
        )}
      </div>

      {/* Advanced rule builder — explicit opt-in */}
      {showRuleBuilder && (
        <div style={{ marginBottom: '1rem' }}>
          <RuleBuilder rule={editedRule} onChange={setEditedRule} />
          <EvaluationLayers layers={group.evaluationLayers} people={data.people} />
        </div>
      )}

      {/* Impact map — appears when there are changes */}
      {hasChanges && (
        <ImpactMap
          consumers={group.consumers}
          originalMembers={originalComputed.included}
          newMembers={newComputed.included}
        />
      )}

      {/* Primary content: the current audience */}
      <div style={s.sectionLabel}>
        Current audience — {newComputed.included.length} people
        {hasChanges && (
          <span style={{ fontWeight: 400, marginLeft: '0.375rem' }}>
            {addedIds.size > 0 && <span style={{ ...s.diffBadge('added'), marginRight: '0.25rem' }}>+{addedIds.size}</span>}
            {removedIds.size > 0 && <span style={s.diffBadge('removed')}>-{removedIds.size}</span>}
          </span>
        )}
      </div>

      {/* "Someone shouldn't be here" — click to explain and suggest exclusion */}
      {newComputed.included.map((p) => {
        const added = addedIds.has(p.id);
        const isInspected = inspectedPersonId === p.id;
        const explanation = isInspected ? explainPerson(p) : null;
        const exclusionSuggestion = isInspected ? suggestExclusionFor(p) : null;
        return (
          <React.Fragment key={p.id}>
            <div
              style={{
                ...s.memberRow,
                background: added ? tierConfig[3].bg : isInspected ? C.bg : undefined,
                borderLeft: added ? `3px solid ${tierConfig[3].dot}` : undefined,
              }}
              onClick={() => setInspectedPersonId(isInspected ? null : p.id)}
              role="button" tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspectedPersonId(isInspected ? null : p.id); } }}
            >
              <div>
                <div style={s.memberName}>
                  {p.name}
                  {added && <span style={{ ...s.diffBadge('added'), marginLeft: '0.5rem' }}>+ entering</span>}
                </div>
                <div style={s.memberMeta}>{p.title} &middot; {p.department} &middot; {p.location}</div>
              </div>
              <div style={{ fontSize: '0.6875rem', color: isInspected ? C.textSub : C.textFaint }}>
                {isInspected ? 'why included?' : p.employmentType.replace('_', ' ')}
              </div>
            </div>
            {isInspected && explanation && (
              <div style={{
                padding: '0.5rem 0.75rem 0.75rem 1.5rem', background: C.bg,
                borderRadius: '0 0 6px 6px', marginTop: '-1px', marginBottom: '0.25rem',
                fontSize: '0.75rem', lineHeight: 1.5, border: `1px solid ${C.border}`, borderTop: 'none',
              }}>
                <div style={{ fontWeight: 600, color: C.text, marginBottom: '0.25rem' }}>
                  {p.name} is included because:
                </div>
                {explanation.matched.map((c, ci) => (
                  <div key={ci} style={{ color: tierConfig[3].color }}>✓ {c}</div>
                ))}
                {exclusionSuggestion && (
                  <div style={{ marginTop: '0.375rem' }}>
                    <button
                      style={{ ...s.btn('ghost'), fontSize: '0.6875rem', color: tierConfig[1].dot, padding: '0.125rem 0.25rem' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        addExclusionCondition(exclusionSuggestion.field, exclusionSuggestion.value);
                        setInspectedPersonId(null);
                      }}
                    >
                      {exclusionSuggestion.description}
                    </button>
                  </div>
                )}
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Removed members */}
      {removedIds.size > 0 && (
        <>
          <div style={{ ...s.sectionLabel, color: tierConfig[1].dot, marginTop: '0.75rem' }}>
            Leaving — {removedIds.size}
          </div>
          {Array.from(removedIds).map((id) => {
            const p = data.people.find((pp) => pp.id === id);
            if (!p) return null;
            return (
              <div key={p.id} style={{ ...s.memberRow, background: tierConfig[1].bg, borderLeft: `3px solid ${tierConfig[1].dot}` }}>
                <div>
                  <div style={s.memberName}>
                    {p.name}
                    <span style={{ ...s.diffBadge('removed'), marginLeft: '0.5rem' }}>- leaving</span>
                  </div>
                  <div style={s.memberMeta}>{p.title} &middot; {p.department}</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* "Someone is missing" — search to find excluded people */}
      <div style={{ marginTop: '1rem', marginBottom: '1rem' }}>
        <div style={{ ...s.sectionLabel, marginBottom: '0.375rem' }}>Someone is missing?</div>
        <input
          style={{ ...s.builderSelect, width: '100%', padding: '0.4375rem 0.625rem', marginBottom: '0.375rem' }}
          placeholder="Search by name to find people not in this group…"
          value={missingSearch}
          onChange={(e) => setMissingSearch(e.target.value)}
          aria-label="Search for missing people"
        />
        {missingSearch.trim() && (() => {
          const q = missingSearch.toLowerCase();
          const results = notInAudience.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
          if (results.length === 0) return (
            <div style={{ fontSize: '0.75rem', color: C.textMuted, padding: '0.25rem 0' }}>
              No excluded people match "{missingSearch}"
            </div>
          );
          return results.map((p) => {
            const info = explainPerson(p);
            const suggestion = suggestInclusionFor(p);
            return (
              <div key={p.id} style={{ ...s.memberRow, background: tierConfig[2].bg, borderLeft: `3px solid ${tierConfig[2].dot}` }}>
                <div style={{ flex: 1 }}>
                  <div style={s.memberName}>{p.name}</div>
                  <div style={s.memberMeta}>{p.title} &middot; {p.department} &middot; {p.location}</div>
                  {info.failed.length > 0 && (
                    <div style={{ fontSize: '0.6875rem', color: tierConfig[1].color, marginTop: '0.125rem' }}>
                      Not included — fails: {info.failed.join('; ')}
                    </div>
                  )}
                  {info.layerHits.length > 0 && (
                    <div style={{ fontSize: '0.6875rem', color: tierConfig[2].color, marginTop: '0.125rem' }}>
                      Excluded by constraint: {info.layerHits.map((l) => l.label).join('; ')}
                    </div>
                  )}
                  {suggestion && (
                    <div style={{ marginTop: '0.25rem' }}>
                      <button
                        style={{ ...s.btn('ghost'), fontSize: '0.6875rem', color: C.textSub, padding: '0.125rem 0.25rem', textDecoration: 'underline' }}
                        onClick={() => { removeCondition(suggestion.conditionIndex); setMissingSearch(''); }}
                      >
                        {suggestion.description}
                      </button>
                      <div style={{ fontSize: '0.625rem', color: C.textMuted, marginTop: '0.125rem' }}>
                        This will also add other people who match the broader rule.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          });
        })()}
      </div>

      {/* Constraint-excluded */}
      {newComputed.layerExcluded.length > 0 && !showRuleBuilder && (
        <EvaluationLayers layers={group.evaluationLayers} people={data.people} />
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.border}` }}>
        <button style={s.btn('primary')} onClick={() => setShowStaging(true)}>
          {tier === 1 ? 'Stage for approval' : 'Save changes'}
        </button>
        <button
          style={s.btn('secondary')}
          onClick={() => onNavigate({ view: 'groupDetail', groupId: group.id, fromPolicy })}
        >
          Cancel
        </button>
        {hasChanges && (
          <span style={{ fontSize: '0.75rem', color: C.textMuted, marginLeft: '0.25rem', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            {addedIds.size > 0 && <span style={s.diffBadge('added')}>+{addedIds.size}</span>}
            {removedIds.size > 0 && <span style={s.diffBadge('removed')}>-{removedIds.size}</span>}
          </span>
        )}
      </div>

      {showStaging && (
        <StagingModal
          group={group}
          added={newComputed.included.filter((p) => addedIds.has(p.id))}
          removed={originalComputed.included.filter((p) => removedIds.has(p.id))}
          onConfirm={() => { setShowStaging(false); setStaged(true); }}
          onCancel={() => setShowStaging(false)}
        />
      )}
    </div>
  );
}

// ── Heuristic: propose a rule from policy context ─────────────────────────

function proposeRuleForPolicy(domain: PolicyDomain): RuleGroup {
  switch (domain) {
    case 'payroll':
      return { type: 'group', combinator: 'AND', children: [
        { type: 'condition', field: 'country', operator: 'is', value: 'US' },
        { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' },
      ]};
    case 'benefits':
      return { type: 'group', combinator: 'AND', children: [
        { type: 'condition', field: 'location', operator: 'is', value: 'San Francisco' },
        { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' },
      ]};
    case 'compliance':
      return { type: 'group', combinator: 'AND', children: [
        { type: 'condition', field: 'department', operator: 'is', value: 'Finance' },
        { type: 'condition', field: 'country', operator: 'is', value: 'US' },
      ]};
    case 'it':
      return { type: 'group', combinator: 'AND', children: [
        { type: 'condition', field: 'country', operator: 'is', value: 'US' },
        { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' },
      ]};
    case 'communications':
      return { type: 'group', combinator: 'AND', children: [
        { type: 'condition', field: 'department', operator: 'is', value: 'Engineering' },
      ]};
    case 'learning':
      return { type: 'group', combinator: 'AND', children: [
        { type: 'condition', field: 'country', operator: 'is', value: 'US' },
      ]};
  }
}

function ruleToNaturalLanguage(node: RuleNode): string {
  if (node.type === 'condition') {
    const val = Array.isArray(node.value)
      ? node.value.map((v) => humanFieldValue(node.field, v)).join(', ')
      : humanFieldValue(node.field, node.value as string);
    const f = (fieldLabels[node.field] || node.field).toLowerCase();
    if (node.operator === 'is') return `${f} is ${val}`;
    if (node.operator === 'is_not') return `${f} is not ${val}`;
    return `${f} ${operatorLabels[node.operator] || node.operator} ${val}`;
  }
  const parts = node.children.map(ruleToNaturalLanguage);
  if (parts.length === 1) return parts[0];
  const joiner = node.combinator === 'AND' ? ' and ' : ' or ';
  return parts.join(joiner);
}

function ruleToHumanSummary(node: RuleNode): string {
  // Produce a compact English sentence from a rule
  if (node.type === 'condition') return ruleToNaturalLanguage(node);
  if (node.type === 'group' && node.children.length === 0) return 'Everyone';

  // Try to produce something like "Full-time employees in the United States"
  const conditions = node.children.filter((c): c is RuleCondition => c.type === 'condition');
  const nested = node.children.filter((c): c is RuleGroup => c.type === 'group');

  const fragments: string[] = [];
  const empType = conditions.find((c) => c.field === 'employmentType' && c.operator === 'is');
  const country = conditions.find((c) => c.field === 'country' && c.operator === 'is');
  const location = conditions.find((c) => c.field === 'location' && c.operator === 'is');
  const dept = conditions.find((c) => c.field === 'department' && c.operator === 'is');

  if (empType) fragments.push(humanFieldValue('employmentType', empType.value as string));
  fragments.push('employees');
  if (dept) fragments.push(`in ${dept.value as string}`);
  if (location) fragments.push(`in ${location.value as string}`);
  else if (country) fragments.push(`in ${humanFieldValue('country', country.value as string)}`);

  // Remaining conditions not already covered
  const covered = new Set([empType, country, location, dept].filter(Boolean));
  const remaining = conditions.filter((c) => !covered.has(c));
  for (const c of remaining) {
    fragments.push(`where ${ruleToNaturalLanguage(c)}`);
  }

  if (nested.length > 0) {
    fragments.push(node.combinator === 'OR' ? '(or)' : '(and)');
    for (const n of nested) fragments.push(ruleToHumanSummary(n));
  }

  return fragments.join(' ');
}

// ── CreateView ─────────────────────────────────────────────────────────────

function CreateView({
  data, policyContext, onNavigate,
}: {
  data: EntryState['data']; policyContext?: PolicyRef;
  onNavigate: (vs: ViewState) => void;
}) {
  // Steps: reuse → domain (if no policyContext) → audience → confirm
  const [step, setStep] = useState<'reuse' | 'domain' | 'audience' | 'confirm-rule' | 'advanced'>(() =>
    policyContext ? 'reuse' : 'reuse'
  );
  const [selectedDomain, setSelectedDomain] = useState<PolicyDomain | null>(policyContext?.domain ?? null);
  const [groupName, setGroupName] = useState('');
  const [groupPurpose, setGroupPurpose] = useState(
    policyContext ? `Targeting audience for ${policyContext.name}` : '',
  );
  const [editedRule, setEditedRule] = useState<RuleGroup>(() =>
    policyContext ? proposeRuleForPolicy(policyContext.domain) : {
      type: 'group', combinator: 'AND',
      children: [{ type: 'condition', field: 'department', operator: 'is', value: 'Engineering' }],
    },
  );
  const [created, setCreated] = useState(false);
  const [inspectedPersonId, setInspectedPersonId] = useState<string | null>(null);
  const [showAdvancedRule, setShowAdvancedRule] = useState(false);
  const [personSearch, setPersonSearch] = useState('');

  // When domain is selected (without initial policyContext), propose a rule
  const selectDomain = (d: PolicyDomain) => {
    setSelectedDomain(d);
    setEditedRule(proposeRuleForPolicy(d));
    setGroupPurpose(`Targeting audience for ${domainConfig[d].label} policy`);
    setStep('audience');
  };

  // Compute proposed audience
  const previewMembers = useMemo(
    () => computeMembers(editedRule, data.people, []),
    [editedRule, data.people],
  );

  // People NOT in the audience (for "who am I missing?" search)
  const excludedByRule = useMemo(
    () => data.people.filter((p) => !evaluateRule(editedRule, p)),
    [editedRule, data.people],
  );

  // Matching groups for dedup signal
  const matchingGroups = useMemo(() => {
    const ruleFields = editedRule.children
      .filter((c): c is RuleCondition => c.type === 'condition')
      .map((c) => c.field).sort();
    return data.savedGroups.filter((g) => {
      const gFields = g.rule.children
        .filter((c): c is RuleCondition => c.type === 'condition')
        .map((c) => c.field).sort();
      return JSON.stringify(ruleFields) === JSON.stringify(gFields);
    });
  }, [editedRule, data.savedGroups]);

  const inspectedPerson = inspectedPersonId ? data.people.find((p) => p.id === inspectedPersonId) ?? null : null;

  // Narrowing: add a condition that excludes people
  const narrowAudience = (field: string, value: string) => {
    setEditedRule({
      ...editedRule,
      children: [...editedRule.children, { type: 'condition', field, operator: 'is', value }],
    });
    setInspectedPersonId(null);
  };

  // Broadening: remove a condition
  const removeCondition = (index: number) => {
    if (editedRule.children.length <= 1) return;
    setEditedRule({
      ...editedRule,
      children: editedRule.children.filter((_, i) => i !== index),
    });
  };

  // Why is a person included / not included?
  const whyIncluded = (person: Person): { included: boolean; matchedConditions: string[]; failedConditions: string[] } => {
    const matched: string[] = [];
    const failed: string[] = [];
    for (const child of editedRule.children) {
      if (child.type === 'condition') {
        if (evaluateRule(child, person)) {
          matched.push(ruleToText(child));
        } else {
          failed.push(ruleToText(child));
        }
      }
    }
    const isIn = evaluateRule(editedRule, person);
    return { included: isIn, matchedConditions: matched, failedConditions: failed };
  };

  // Suggest a rule change to include a specific excluded person
  const suggestInclusionFor = (person: Person): { conditionIndex: number; description: string } | null => {
    for (let i = 0; i < editedRule.children.length; i++) {
      const child = editedRule.children[i];
      if (child.type === 'condition' && !evaluateRule(child, person)) {
        return {
          conditionIndex: i,
          description: `Remove "${ruleToText(child)}" to include ${person.name}`,
        };
      }
    }
    return null;
  };

  if (created) {
    return (
      <div style={s.pageOuter}>
        <div style={s.confirmScreen}>
          <div style={{ ...s.confirmIcon, background: tierConfig[3].bg, color: tierConfig[3].dot }}>✓</div>
          <div style={s.confirmTitle}>Group created</div>
          <div style={s.confirmBody}>
            <strong>{groupName}</strong> is now active with {previewMembers.included.length} members.
            {policyContext && (
              <> It has been assigned as the targeting audience for <strong>{policyContext.name}</strong>.</>
            )}
          </div>
          <button style={s.btn('secondary')} onClick={() => onNavigate({ view: 'policyMap' })}>
            Back to policy map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={s.pageOuter}>
      <div style={s.breadcrumb}>
        <span
          style={s.breadcrumbLink}
          onClick={() => onNavigate({ view: 'policyMap' })}
          role="button" tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'policyMap' }); } }}
        >
          Policy map
        </span>
        <span style={s.breadcrumbSep}>/</span>
        <span style={s.breadcrumbCurrent}>New targeting audience</span>
      </div>

      <h1 style={s.pageTitle}>
        {step === 'reuse' ? 'Create a targeting audience' :
         step === 'domain' ? 'What will this group be used for?' :
         step === 'audience' ? 'Proposed audience' :
         step === 'confirm-rule' ? 'Confirm your audience' :
         'Edit rule directly'}
      </h1>
      <div style={s.pagePurpose}>
        {policyContext
          ? `For: ${policyContext.name} (${domainConfig[policyContext.domain].label})`
          : step === 'domain' ? 'Choose the policy domain so we can propose the right audience.'
          : step === 'audience' && selectedDomain ? `For: ${domainConfig[selectedDomain].label} policy`
          : 'Start by checking if a group already exists that you can reuse.'}
      </div>

      {/* ── Step: Reuse check */}
      {step === 'reuse' && (
        <div>
          <div style={{ ...s.sectionLabel, marginBottom: '0.75rem' }}>Existing groups you can reuse</div>
          {data.savedGroups.filter((g) => !g.isLegacy).map((g) => {
            const isShared = g.consumers.length > 1;
            const gt = deriveSensitivityTier(g.consumers);
            return (
              <div
                key={g.id}
                style={s.templateCard}
                onClick={() => onNavigate({ view: 'groupDetail', groupId: g.id })}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigate({ view: 'groupDetail', groupId: g.id }); } }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.borderStrong; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={s.templateName}>{g.name}</div>
                  <TierBadge tier={gt} />
                </div>
                <div style={s.templateDesc}>
                  {g.purpose} &middot; {g.memberIds.length} members
                </div>
                {isShared && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.6875rem', color: C.textSub }}>
                    Shared by {g.consumers.length} policies — {g.consumers.map((c) => c.name).join(', ')}
                  </div>
                )}
                {!isShared && g.consumers.length > 0 && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.6875rem', color: C.textMuted }}>
                    Used by: {g.consumers.map((c) => c.name).join(', ')}
                  </div>
                )}
              </div>
            );
          })}

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button
              style={s.btn('primary')}
              onClick={() => {
                if (policyContext) {
                  // Have policy context — go straight to audience proposal
                  setEditedRule(proposeRuleForPolicy(policyContext.domain));
                  setStep('audience');
                } else {
                  // No policy context — ask what domain
                  setStep('domain');
                }
              }}
            >
              None of these fit — create new
            </button>
            <span style={{ fontSize: '0.75rem', color: C.textMuted }}>or select one above to reuse it</span>
          </div>
        </div>
      )}

      {/* ── Step: Domain selection (no policyContext) */}
      {step === 'domain' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '1.25rem' }}>
            {(Object.keys(domainConfig) as PolicyDomain[]).map((d) => (
              <div
                key={d}
                style={{
                  ...s.templateCard,
                  textAlign: 'center' as const,
                  padding: '1.25rem 1rem',
                  borderColor: selectedDomain === d ? domainConfig[d].color : undefined,
                }}
                onClick={() => selectDomain(d)}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectDomain(d); } }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = domainConfig[d].color; }}
                onMouseLeave={(e) => { if (selectedDomain !== d) (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: domainConfig[d].color, marginBottom: '0.25rem' }}>
                  {domainConfig[d].label}
                </div>
                <div style={{ fontSize: '0.6875rem', color: C.textMuted }}>
                  {d === 'payroll' ? 'Payroll targeting, tax groups' :
                   d === 'benefits' ? 'Benefits enrollment, eligibility' :
                   d === 'it' ? 'SSO, app provisioning, access' :
                   d === 'compliance' ? 'SOX, audit scope, reviews' :
                   d === 'communications' ? 'Slack channels, announcements' :
                   'LMS courses, training enrollment'}
                </div>
              </div>
            ))}
          </div>
          <button style={s.btn('ghost')} onClick={() => setStep('reuse')}>Back</button>
        </div>
      )}

      {/* ── Step: Audience — the reimagined consequence-first authoring surface */}
      {step === 'audience' && (
        <div>
          {/* Proposed audience headline */}
          <div style={{
            padding: '0.875rem 1rem', background: C.bg, borderRadius: '8px',
            border: `1px solid ${C.border}`, marginBottom: '1rem',
          }}>
            <div style={{ fontSize: '0.8125rem', color: C.textSub, lineHeight: 1.55 }}>
              Based on the <strong style={{ color: C.text }}>{selectedDomain ? domainConfig[selectedDomain].label.toLowerCase() : ''}</strong> domain,
              here are the <strong style={{ color: C.text }}>{previewMembers.included.length} people</strong> who look like they belong to this audience:
            </div>
            <div style={{ fontSize: '0.75rem', color: C.textSub, marginTop: '0.375rem', fontStyle: 'italic' }}>
              {ruleToHumanSummary(editedRule)}
            </div>
          </div>

          {/* Dedup signal */}
          {matchingGroups.length > 0 && (
            <div style={{ padding: '0.625rem 0.875rem', background: tierConfig[2].bg, borderRadius: '8px', border: `1px solid ${tierConfig[2].border}`, marginBottom: '1rem', fontSize: '0.75rem' }}>
              <strong style={{ color: tierConfig[2].color }}>
                {matchingGroups.length} existing group{matchingGroups.length > 1 ? 's' : ''} match this shape:
              </strong>
              {' '}{matchingGroups.map((g) => g.name || 'Unnamed').join(', ')}.
              Consider reusing one instead.
            </div>
          )}

          {/* Current conditions as removable chips — framed as audience shape controls */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ ...s.sectionLabel, marginBottom: '0.375rem' }}>Audience shape</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', alignItems: 'center' }}>
              {editedRule.children.map((child, i) => {
                if (child.type !== 'condition') return null;
                return (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                    padding: '0.25rem 0.5rem', borderRadius: '100px',
                    background: C.bg, border: `1px solid ${C.borderStrong}`,
                    fontSize: '0.75rem', fontWeight: 500, color: C.text,
                  }}>
                    {ruleToText(child)}
                    {editedRule.children.length > 1 && (
                      <span
                        style={{ cursor: 'pointer', marginLeft: '0.125rem', color: C.textMuted, fontWeight: 700, fontSize: '0.875rem', lineHeight: 1 }}
                        onClick={() => removeCondition(i)}
                        role="button" tabIndex={0} aria-label={`Remove condition: ${ruleToText(child)}`}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); removeCondition(i); } }}
                      >
                        ×
                      </span>
                    )}
                  </span>
                );
              })}
              {editedRule.children.length > 0 && (
                <span style={{ fontSize: '0.6875rem', color: C.textMuted }}>
                  {editedRule.combinator === 'AND' ? '(all must match)' : '(any can match)'}
                </span>
              )}
            </div>

            {/* Narrowing controls — "Exclude people who..." */}
            <div style={{ display: 'flex', gap: '0.375rem', marginTop: '0.625rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: C.textMuted }}>Narrow by:</span>
              {fieldOptions.filter((f) =>
                !editedRule.children.some((c) => c.type === 'condition' && c.field === f)
              ).map((f) => (
                <button
                  key={f}
                  style={{ ...s.btn('secondary'), fontSize: '0.6875rem', padding: '0.1875rem 0.5rem' }}
                  onClick={() => narrowAudience(f, fieldValueOptions[f]?.[0] ?? '')}
                >
                  + {fieldLabels[f] || f}
                </button>
              ))}
              <button
                style={{ ...s.btn('ghost'), fontSize: '0.6875rem' }}
                onClick={() => setShowAdvancedRule(!showAdvancedRule)}
              >
                {showAdvancedRule ? 'Hide rule builder' : 'Edit rule directly'}
              </button>
            </div>
          </div>

          {/* Advanced rule builder — toggle, not default */}
          {showAdvancedRule && (
            <RuleBuilder rule={editedRule} onChange={setEditedRule} />
          )}

          {/* Primary content: the proposed people */}
          <div style={s.sectionLabel}>
            Proposed audience — {previewMembers.included.length} people
          </div>
          <div style={{ marginBottom: '0.5rem' }}>
            {previewMembers.included.map((p) => {
              const isInspected = inspectedPersonId === p.id;
              return (
                <React.Fragment key={p.id}>
                  <div
                    style={{
                      ...s.memberRow,
                      background: isInspected ? C.bg : undefined,
                    }}
                    onClick={() => setInspectedPersonId(isInspected ? null : p.id)}
                    role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setInspectedPersonId(isInspected ? null : p.id); } }}
                  >
                    <div>
                      <div style={s.memberName}>{p.name}</div>
                      <div style={s.memberMeta}>{p.title} &middot; {p.department} &middot; {p.location}</div>
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: isInspected ? C.textSub : C.textFaint }}>
                      {isInspected ? 'why included?' : p.employmentType.replace('_', ' ')}
                    </div>
                  </div>
                  {isInspected && (() => {
                    const info = whyIncluded(p);
                    return (
                      <div style={{ padding: '0.5rem 0.75rem 0.75rem 1.5rem', background: C.bg, borderRadius: '0 0 6px 6px', marginTop: '-1px', marginBottom: '0.25rem', fontSize: '0.75rem', lineHeight: 1.5, border: `1px solid ${C.border}`, borderTop: 'none' }}>
                        <div style={{ fontWeight: 600, color: C.text, marginBottom: '0.25rem' }}>
                          {p.name} is included because:
                        </div>
                        {info.matchedConditions.map((c, ci) => (
                          <div key={ci} style={{ color: tierConfig[3].color }}>✓ {c}</div>
                        ))}
                      </div>
                    );
                  })()}
                </React.Fragment>
              );
            })}
          </div>

          {/* "Who am I missing?" — search excluded people */}
          <div style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ ...s.sectionLabel, marginBottom: '0.375rem' }}>Who am I missing?</div>
            <input
              style={{ ...s.builderSelect, width: '100%', padding: '0.4375rem 0.625rem', marginBottom: '0.375rem' }}
              placeholder="Search by name to find people not in this audience…"
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              aria-label="Search excluded people"
            />
            {personSearch.trim() && (() => {
              const q = personSearch.toLowerCase();
              const results = excludedByRule.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 5);
              if (results.length === 0) return (
                <div style={{ fontSize: '0.75rem', color: C.textMuted, padding: '0.25rem 0' }}>
                  No excluded people match "{personSearch}"
                </div>
              );
              return results.map((p) => {
                const suggestion = suggestInclusionFor(p);
                return (
                  <div key={p.id} style={{ ...s.memberRow, background: tierConfig[2].bg, borderLeft: `3px solid ${tierConfig[2].dot}` }}>
                    <div>
                      <div style={s.memberName}>{p.name}</div>
                      <div style={s.memberMeta}>{p.title} &middot; {p.department} &middot; {p.location}</div>
                      {suggestion && (
                        <div style={{ marginTop: '0.25rem' }}>
                          <button
                            style={{ ...s.btn('ghost'), fontSize: '0.6875rem', color: C.textSub, padding: '0.125rem 0.25rem', textDecoration: 'underline' }}
                            onClick={() => { removeCondition(suggestion.conditionIndex); setPersonSearch(''); }}
                          >
                            {suggestion.description}
                          </button>
                        </div>
                      )}
                      {!suggestion && (
                        <div style={{ fontSize: '0.6875rem', color: C.textMuted, marginTop: '0.125rem' }}>
                          Not included — doesn't match any conditions
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Proceed to confirm */}
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingTop: '0.75rem', borderTop: `1px solid ${C.border}` }}>
            <button style={s.btn('primary')} onClick={() => setStep('confirm-rule')}>
              This audience looks right
            </button>
            <button style={s.btn('ghost')} onClick={() => policyContext ? setStep('reuse') : setStep('domain')}>
              Back
            </button>
          </div>
        </div>
      )}

      {/* ── Step: Confirm — show the full rule and ask for name/purpose */}
      {step === 'confirm-rule' && (
        <div>
          <div style={{ padding: '0.875rem 1rem', background: C.bg, borderRadius: '8px', border: `1px solid ${C.border}`, marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.5rem', color: C.text }}>
              This audience is defined by:
            </div>
            <div style={{ fontSize: '0.875rem', color: C.textSub, marginBottom: '0.5rem', fontStyle: 'italic' }}>
              {ruleToHumanSummary(editedRule)}
            </div>
            <div style={s.ruleBox}>
              <RuleNodeDisplay node={editedRule} />
            </div>
            {previewMembers.layerExcluded.length > 0 && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: tierConfig[2].color }}>
                {previewMembers.layerExcluded.length} people excluded by policy constraints.
              </div>
            )}
          </div>

          <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            {previewMembers.included.length} people in this audience
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <label style={{ ...s.sectionLabel, display: 'block', marginBottom: '0.25rem' }}>Name (required)</label>
              <input
                style={{ ...s.builderSelect, width: '100%', padding: '0.4375rem 0.625rem' }}
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g., US Full-Time Employees"
              />
            </div>
            <div>
              <label style={{ ...s.sectionLabel, display: 'block', marginBottom: '0.25rem' }}>Purpose (required)</label>
              <input
                style={{ ...s.builderSelect, width: '100%', padding: '0.4375rem 0.625rem' }}
                value={groupPurpose}
                onChange={(e) => setGroupPurpose(e.target.value)}
                placeholder="What is this group for?"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              style={s.btn('primary')}
              onClick={() => setCreated(true)}
              disabled={!groupName.trim() || !groupPurpose.trim()}
            >
              Create group
            </button>
            <button style={s.btn('ghost')} onClick={() => setStep('audience')}>
              Adjust audience
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── InlineSelectView ───────────────────────────────────────────────────────

function InlineSelectView({
  data, policyContext, onNavigate,
}: {
  data: EntryState['data']; policyContext: PolicyRef;
  onNavigate: (vs: ViewState) => void;
}) {
  const [search, setSearch] = useState('');
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
  const [selected, setSelected] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data.savedGroups;
    return data.savedGroups.filter(
      (g) => g.name.toLowerCase().includes(q) || g.purpose.toLowerCase().includes(q),
    );
  }, [data.savedGroups, search]);

  const detailGroup = detailGroupId ? data.savedGroups.find((g) => g.id === detailGroupId) : null;

  if (selected && detailGroup) {
    return (
      <div style={s.inlineWrap}>
        <div style={s.inlineHeader}>
          {detailGroup.name} selected for {policyContext.name}
        </div>
        <div style={{ padding: '1rem', fontSize: '0.8125rem', color: C.textSub }}>
          <span style={{ ...s.diffBadge('added'), marginRight: '0.375rem' }}>{detailGroup.memberIds.length} members</span>
          assigned as targeting audience.
          {detailGroup.consumers.length > 1 && (
            <div style={{ marginTop: '0.5rem', color: tierConfig[2].color, fontSize: '0.75rem' }}>
              This group is shared across {detailGroup.consumers.length} policies.
              Edits will affect all of them.
            </div>
          )}
        </div>
      </div>
    );
  }

  if (detailGroup) {
    const { included, layerExcluded } = computeMembers(detailGroup.rule, data.people, detailGroup.evaluationLayers);
    const tier = deriveSensitivityTier(detailGroup.consumers);
    const isShared = detailGroup.consumers.length > 1;
    return (
      <div style={s.inlineWrap}>
        <div style={s.inlineHeader}>
          <span
            style={{ cursor: 'pointer', marginRight: '0.5rem', color: C.textMuted }}
            onClick={() => setDetailGroupId(null)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailGroupId(null); } }}
          >
            ← Back
          </span>
          {detailGroup.name}
        </div>
        <div style={{ padding: '0.75rem 1rem', maxHeight: '420px', overflow: 'auto' }}>
          {/* Shared group coupling warning — prominent, not a footnote */}
          {isShared && (
            <div style={s.sharedWarning}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠</span>
              <div>
                <strong>Shared group</strong> — already used by {detailGroup.consumers.map((c) => c.name).join(', ')}.
                If you edit this group later, all {detailGroup.consumers.length} policies will be affected.
                If you need independent control, create a new group instead.
              </div>
            </div>
          )}

          {/* Consequence cards */}
          <div style={{ ...s.sectionLabel, marginBottom: '0.5rem' }}>What this group controls</div>
          {detailGroup.consumers.map((c) => (
            <div key={c.id} style={{ ...s.consequenceCard(c.sensitivityTier), marginBottom: '0.375rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{c.name}</span>
                <TierBadge tier={c.sensitivityTier} />
              </div>
              <div style={{ fontSize: '0.6875rem', color: C.textMuted, marginTop: '0.125rem' }}>
                {c.affectedCount.toLocaleString()} people
              </div>
            </div>
          ))}
          {detailGroup.consumers.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: C.textMuted, marginBottom: '0.75rem' }}>
              Not currently used by any policy.
            </div>
          )}

          {/* Rule */}
          <div style={{ ...s.ruleBox, marginTop: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={s.sectionLabel}>Rule</div>
            <RuleNodeDisplay node={detailGroup.rule} />
          </div>

          {/* Members */}
          <div style={s.sectionLabel}>Members — {included.length}</div>
          <div style={{ maxHeight: '150px', overflow: 'auto', marginBottom: '0.75rem' }}>
            {included.slice(0, 8).map((p) => (
              <div key={p.id} style={{ ...s.memberRow, padding: '0.25rem 0' }}>
                <span style={s.memberName}>{p.name}</span>
                <span style={s.memberMeta}>{p.department}</span>
              </div>
            ))}
            {included.length > 8 && (
              <div style={{ fontSize: '0.6875rem', color: C.textMuted, padding: '0.25rem 0' }}>
                + {included.length - 8} more
              </div>
            )}
            {layerExcluded.length > 0 && (
              <div style={{ fontSize: '0.6875rem', color: tierConfig[2].color, padding: '0.25rem 0' }}>
                {layerExcluded.length} excluded by constraints
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button style={s.btn('primary')} onClick={() => setSelected(true)}>
              Use this group
            </button>
            <button style={s.btn('secondary')} onClick={() => setDetailGroupId(null)}>
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={s.inlineWrap}>
      <div style={s.inlineHeader}>
        Select targeting group
        <span style={{ fontWeight: 400, color: C.textMuted, marginLeft: '0.375rem' }}>
          for {policyContext.name}
        </span>
      </div>
      <div style={s.inlineSearch}>
        <span style={{ color: C.textFaint, fontSize: '0.875rem' }}>⌕</span>
        <input
          style={s.inlineInput}
          placeholder="Search by name or purpose…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search groups"
          autoFocus
        />
      </div>
      {filtered.map((g) => {
        const tier = deriveSensitivityTier(g.consumers);
        const isShared = g.consumers.length > 1;
        return (
          <div
            key={g.id}
            style={s.inlineGroupRow}
            onClick={() => setDetailGroupId(g.id)}
            role="button" tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailGroupId(g.id); } }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.bg; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
          >
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                {g.name || 'Unnamed group'}
                {g.isLegacy && (
                  <span style={{ fontSize: '0.625rem', color: tierConfig[2].color, marginLeft: '0.375rem', fontWeight: 400 }}>legacy</span>
                )}
              </div>
              <div style={{ fontSize: '0.6875rem', color: C.textMuted, marginTop: '0.125rem' }}>
                {g.memberIds.length} members &middot; {ruleToText(g.rule)}
                {isShared && (
                  <span style={{ color: tierConfig[2].dot, marginLeft: '0.25rem', fontWeight: 500 }}>
                    &middot; shared by {g.consumers.length} policies
                  </span>
                )}
              </div>
            </div>
            <TierBadge tier={tier} />
          </div>
        );
      })}
      {filtered.length === 0 && (
        <div style={{ padding: '1.5rem', fontSize: '0.8125rem', color: C.textFaint, textAlign: 'center' }}>
          No groups match "{search}"
        </div>
      )}
      <div style={{ padding: '0.625rem 1rem', borderTop: `1px solid ${C.border}` }}>
        <button style={s.btn('ghost')} onClick={() => onNavigate({ view: 'create', policyContext })}>
          + Create new group for {policyContext.name}
        </button>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function ConceptD({ entryState }: ConceptProps) {
  const { scenario, data } = entryState;

  const initialView = useMemo((): ViewState => {
    switch (scenario.type) {
      case 'view':          return { view: 'groupDetail',   groupId: scenario.groupId };
      case 'edit':          return { view: 'groupEdit',     groupId: scenario.groupId };
      case 'create':        return { view: 'create',        policyContext: scenario.policyContext };
      case 'inline-select': return { view: 'inlineSelect',  policyContext: scenario.policyContext };
    }
  }, [scenario]);

  const [viewState, setViewState] = useState<ViewState>(initialView);
  const navigate = useCallback((vs: ViewState) => setViewState(vs), []);

  const inner = (() => {
    switch (viewState.view) {
      case 'policyMap':
        return <PolicyMapView data={data} onNavigate={navigate} />;

      case 'policyDetail':
        return <PolicyDetailView policy={viewState.policy} data={data} onNavigate={navigate} />;

      case 'groupDetail': {
        const group = data.savedGroups.find((g) => g.id === viewState.groupId);
        if (!group) return (
          <div style={s.pageOuter}>
            <p style={{ color: C.textMuted, fontSize: '0.8125rem' }}>Group not found.</p>
            <button style={{ ...s.btn('secondary'), marginTop: '0.75rem' }} onClick={() => navigate({ view: 'policyMap' })}>
              Back to policy map
            </button>
          </div>
        );
        return <GroupDetailView group={group} data={data} fromPolicy={viewState.fromPolicy} onNavigate={navigate} />;
      }

      case 'groupEdit': {
        const group = data.savedGroups.find((g) => g.id === viewState.groupId);
        if (!group) return (
          <div style={s.pageOuter}>
            <p style={{ color: C.textMuted, fontSize: '0.8125rem' }}>Group not found.</p>
            <button style={{ ...s.btn('secondary'), marginTop: '0.75rem' }} onClick={() => navigate({ view: 'policyMap' })}>
              Back to policy map
            </button>
          </div>
        );
        return <GroupEditView group={group} data={data} fromPolicy={viewState.fromPolicy} onNavigate={navigate} />;
      }

      case 'create':
        return <CreateView data={data} policyContext={viewState.policyContext} onNavigate={navigate} />;

      case 'inlineSelect':
        return (
          <div style={{ padding: '1.5rem 2rem' }}>
            <InlineSelectView data={data} policyContext={viewState.policyContext} onNavigate={navigate} />
          </div>
        );
    }
  })();

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap');`}</style>
      <div style={s.root}>{inner}</div>
    </>
  );
}

// suppress unused warning — legacyBanner is used inline in GroupDetailView
void s_legacyBanner;

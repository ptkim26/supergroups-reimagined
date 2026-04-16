import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type {
  EntryState,
  Person,
  SavedGroup,
  RuleGroup,
  RuleCondition,
  RuleNode,
  EvaluationLayer,
  PolicyRef,
  SensitivityTier,
} from '../shell/types';

// ── Design tokens (copied from concept-E for visual consistency) ─────────────

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
  deep: 'rgba(0,0,0,0.01) 0px 1px 3px, rgba(0,0,0,0.02) 0px 3px 7px, rgba(0,0,0,0.02) 0px 7px 15px, rgba(0,0,0,0.04) 0px 14px 28px, rgba(0,0,0,0.05) 0px 23px 52px',
};

// ── Field / value helpers ─────────────────────────────────────────────────────

const employmentTypeLabels: Record<string, string> = { full_time: 'Full-time', part_time: 'Part-time', contractor: 'Contractor' };
const roleStateLabels: Record<string, string> = { active: 'Active', pending: 'Pending', terminated: 'Terminated' };
const fieldLabels: Record<string, string> = { department: 'Department', location: 'Location', country: 'Country', employmentType: 'Employment type', roleState: 'Role status', startDate: 'Start date', title: 'Title' };

function formatValue(field: string, val: string): string {
  if (field === 'employmentType') return employmentTypeLabels[val] || val;
  if (field === 'roleState') return roleStateLabels[val] || val;
  return val;
}

const FIELD_OPTIONS = [
  { value: 'department', label: 'Department' },
  { value: 'location', label: 'Location' },
  { value: 'country', label: 'Country' },
  { value: 'employmentType', label: 'Employment type' },
  { value: 'roleState', label: 'Role status' },
  { value: 'startDate', label: 'Start date' },
  { value: 'title', label: 'Title' },
];

const OPERATOR_OPTIONS: Record<string, { value: RuleCondition['operator']; label: string }[]> = {
  department: [{ value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' }],
  location: [{ value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' }],
  country: [{ value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' }],
  employmentType: [{ value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' }],
  roleState: [{ value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' }],
  startDate: [{ value: 'after', label: 'is after' }, { value: 'before', label: 'is before' }],
  title: [{ value: 'is', label: 'is' }, { value: 'is_not', label: 'is not' }, { value: 'contains', label: 'contains' }],
};

function getValueOptions(field: string, people: Person[]): string[] {
  const set = new Set<string>();
  for (const p of people) set.add(String((p as any)[field]));
  return [...set].sort();
}

// ── Extended mock data (same approach as concept-E) ──────────────────────────

const additionalPeople: Person[] = [
  { id: 'pf01', name: 'Liam Park', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-04-10', title: 'Staff Engineer' },
  { id: 'pf02', name: 'Nora Eriksson', department: 'Sales', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-07-05', title: 'Account Executive' },
  { id: 'pf03', name: 'Gabriel Costa', department: 'Finance', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-01-15', title: 'Senior Financial Analyst' },
  { id: 'pf04', name: 'Haruki Sato', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'contractor', roleState: 'active', startDate: '2024-06-01', title: 'Backend Engineer' },
  { id: 'pf05', name: 'Camille Dubois', department: 'Marketing', location: 'Berlin', country: 'DE', employmentType: 'full_time', roleState: 'active', startDate: '2023-09-18', title: 'Content Lead' },
  { id: 'pf06', name: 'Winston Brooks', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-11-01', title: 'HR Business Partner' },
  { id: 'pf07', name: 'Diana Petrova', department: 'Legal', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-02-28', title: 'Senior Counsel' },
  { id: 'pf08', name: 'Oscar Nilsson', department: 'Operations', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-05-22', title: 'Operations Manager' },
  { id: 'pf09', name: 'Mei-Ling Wu', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-08-12', title: 'Frontend Engineer' },
  { id: 'pf10', name: 'Santiago Reyes', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-10-30', title: 'Sales Engineer' },
  { id: 'pf11', name: 'Anya Volkov', department: 'Finance', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2024-03-15', title: 'Financial Controller' },
  { id: 'pf12', name: 'Tariq Hasan', department: 'Engineering', location: 'Toronto', country: 'CA', employmentType: 'contractor', roleState: 'active', startDate: '2024-09-01', title: 'Platform Engineer' },
  { id: 'pf13', name: 'Emily Zhao', department: 'Marketing', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-12-05', title: 'Growth Manager' },
  { id: 'pf14', name: 'Kofi Asante', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2023-08-14', title: 'Engineering Manager' },
  { id: 'pf15', name: 'Rebecca Liu', department: 'HR', location: 'New York', country: 'US', employmentType: 'part_time', roleState: 'active', startDate: '2024-04-01', title: 'Recruiter' },
  { id: 'pf16', name: 'Lukas Brandt', department: 'Engineering', location: 'Berlin', country: 'DE', employmentType: 'contractor', roleState: 'pending', startDate: '2026-03-10', title: 'ML Engineer' },
  { id: 'pf17', name: 'Yolanda Mensah', department: 'Sales', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2024-05-20', title: 'Enterprise Account Manager' },
  { id: 'pf18', name: 'Kevin Pham', department: 'Operations', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-06-07', title: 'IT Operations Lead' },
  { id: 'pf19', name: 'Isabelle Fournier', department: 'Legal', location: 'Toronto', country: 'CA', employmentType: 'full_time', roleState: 'active', startDate: '2024-07-22', title: 'Legal Operations Manager' },
  { id: 'pf20', name: 'Omar Farouk', department: 'Finance', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'pending', startDate: '2026-03-25', title: 'Treasury Analyst' },
  { id: 'pf21', name: 'Grace Okonkwo', department: 'Engineering', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-10-14', title: 'Security Engineer' },
  { id: 'pf22', name: 'Felix Bauer', department: 'Marketing', location: 'Berlin', country: 'DE', employmentType: 'part_time', roleState: 'active', startDate: '2024-11-01', title: 'Brand Designer' },
  { id: 'pf23', name: 'Linda Nakamura', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-02-15', title: 'HR Director' },
  { id: 'pf24', name: 'Marco Valenti', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'contractor', roleState: 'active', startDate: '2025-01-06', title: 'Solutions Consultant' },
  { id: 'pf25', name: 'Signe Lindqvist', department: 'Finance', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-04-10', title: 'VP Finance' },
  { id: 'pf26', name: 'Zara Ahmed', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2026-03-20', title: 'Software Engineer' },
  { id: 'pf27', name: 'Tomás Silva', department: 'Sales', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2026-03-28', title: 'Account Manager' },
];

function buildExtendedData(base: EntryState['data']): EntryState['data'] {
  const allPeople = [...base.people, ...additionalPeople];
  const updatedGroups = base.savedGroups.map(g => {
    const newMembers = allPeople
      .filter(p => evaluateRule(p, g.rule) && !g.evaluationLayers.some(l => l.excludedPeopleIds.includes(p.id)))
      .map(p => p.id);
    return { ...g, memberIds: newMembers };
  });
  return { people: allPeople, savedGroups: updatedGroups, policies: base.policies };
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

function getMembersForRule(people: Person[], rule: RuleGroup, layers: EvaluationLayer[]): Person[] {
  const excluded = new Set(layers.flatMap(l => l.excludedPeopleIds));
  return people.filter(p => evaluateRule(p, rule) && !excluded.has(p.id));
}

function getExcludedByLayers(people: Person[], rule: RuleGroup, layers: EvaluationLayer[]): { layer: EvaluationLayer; people: Person[] }[] {
  return layers.map(layer => ({
    layer,
    people: people.filter(p => evaluateRule(p, rule) && layer.excludedPeopleIds.includes(p.id)),
  })).filter(x => x.people.length > 0);
}

// ── Rule to plain-language summary ───────────────────────────────────────────

function ruleToSummary(rule: RuleNode, depth = 0): string {
  if (rule.type === 'condition') {
    const fl = fieldLabels[rule.field] || rule.field;
    const val = Array.isArray(rule.value)
      ? rule.value.map(v => formatValue(rule.field, v)).join(', ')
      : formatValue(rule.field, rule.value as string);
    const opLabel = rule.operator === 'is' ? 'is' : rule.operator === 'is_not' ? 'is not' : rule.operator === 'in' ? 'is one of' : rule.operator === 'contains' ? 'contains' : rule.operator === 'after' ? 'after' : rule.operator === 'before' ? 'before' : rule.operator;
    return `${fl} ${opLabel} ${val}`;
  }
  const parts = rule.children.map(c => ruleToSummary(c, depth + 1));
  const joiner = rule.combinator === 'AND' ? ' and ' : ' or ';
  const result = parts.join(joiner);
  return depth > 0 ? `(${result})` : result;
}

function ruleToCompactSummary(rule: RuleGroup, maxClauses = 2): { text: string; overflow: number } {
  const flatConditions: RuleCondition[] = [];
  let nestedCount = 0;
  for (const child of rule.children) {
    if (child.type === 'condition') flatConditions.push(child);
    else nestedCount++;
  }
  const shown = flatConditions.slice(0, maxClauses);
  const overflow = (flatConditions.length - shown.length) + nestedCount;
  const parts = shown.map(c => {
    const val = Array.isArray(c.value)
      ? c.value.map(v => formatValue(c.field, v)).join(', ')
      : formatValue(c.field, c.value as string);
    return val;
  });
  return { text: parts.join(rule.combinator === 'AND' ? ', ' : ' or '), overflow };
}

// ── Person explanation ────────────────────────────────────────────────────────

interface ConditionResult {
  field: string;
  fieldLabel: string;
  operator: string;
  expected: string;
  actual: string;
  passed: boolean;
}

interface ExplainResult {
  status: 'included' | 'excluded_by_layer' | 'excluded_by_rule';
  text: string;
  layerLabel?: string;
  layerDescription?: string;
  conditions: ConditionResult[];
}

function explainPerson(person: Person, rule: RuleGroup, layers: EvaluationLayer[]): ExplainResult {
  const layer = layers.find(l => l.excludedPeopleIds.includes(person.id));
  if (layer) {
    return { status: 'excluded_by_layer', text: `Excluded by "${layer.label}"`, layerLabel: layer.label, layerDescription: layer.description, conditions: [] };
  }
  const conditions: ConditionResult[] = [];
  function collect(node: RuleNode) {
    if (node.type === 'condition') {
      const fld = fieldLabels[node.field] || node.field;
      const actual = formatValue(node.field, (person as any)[node.field]);
      const expected = Array.isArray(node.value) ? node.value.map(v => formatValue(node.field, v)).join(', ') : formatValue(node.field, node.value as string);
      const opLabel = node.operator === 'is' ? 'is' : node.operator === 'is_not' ? 'is not' : node.operator === 'in' ? 'is one of' : node.operator === 'contains' ? 'contains' : node.operator === 'after' ? 'after' : node.operator === 'before' ? 'before' : node.operator;
      conditions.push({ field: node.field, fieldLabel: fld, operator: opLabel, expected, actual, passed: evaluateRule(person, node) });
    } else { node.children.forEach(collect); }
  }
  collect(rule);
  const matched = evaluateRule(person, rule);
  if (!matched) {
    const failed = conditions.filter(c => !c.passed);
    return { status: 'excluded_by_rule', text: `Doesn't match: ${failed.map(c => `${c.fieldLabel} is "${c.actual}"`).join('; ')}`, conditions };
  }
  return { status: 'included', text: 'Matches all conditions', conditions };
}

// ── Suggest rule adjustment ──────────────────────────────────────────────────

interface RuleAdjustment {
  description: string;
  newCondition: RuleCondition;
}

function suggestAdjustment(person: Person, members: Person[], rule: RuleGroup): RuleAdjustment | null {
  const candidateFields = ['department', 'location', 'employmentType', 'country'] as const;
  for (const field of candidateFields) {
    const personVal = (person as any)[field] as string;
    const othersWithSameVal = members.filter(m => m.id !== person.id && (m as any)[field] === personVal);
    if (othersWithSameVal.length <= 1) {
      const fl = fieldLabels[field] || field;
      const vl = formatValue(field, personVal);
      return {
        description: `Add "${fl} is not ${vl}" — ${person.name} is one of only ${othersWithSameVal.length + 1} with this value`,
        newCondition: { type: 'condition', field, operator: 'is_not', value: personVal },
      };
    }
  }
  return null;
}

// ── NL parser (self-contained, borrowed patterns from concept-E) ─────────────

const NEGATION_PATTERN = /\b(?:not|no|non|except|excluding|without|aren'?t|isn'?t|exclude|remove)\b/;

function isNegated(lower: string, keyword: string): boolean {
  const idx = lower.indexOf(keyword);
  if (idx < 0) return false;
  const before = lower.slice(Math.max(0, idx - 30), idx);
  return NEGATION_PATTERN.test(before) || /\bnon-?\s*$/.test(before);
}

const LOCATION_ALIASES: [RegExp, string][] = [
  [/\bsf\b|s\.f\./, 'San Francisco'],
  [/\bnyc\b/, 'New York'],
  [/\btexas\b|\btx\b/, 'Austin'],
  [/\bcalifornia\b|\bcalif\b|\bca\b(?!nad)/, 'San Francisco'],
];

const COUNTRY_PATTERNS: [RegExp, string][] = [
  [/\bus\b|united states|\busa\b|\bamerica\b/, 'US'],
  [/\buk\b|united kingdom|\bbritain\b/, 'GB'],
  [/\bcanada\b|\bcanadian\b/, 'CA'],
  [/\bgermany\b|\bgerman\b/, 'DE'],
];

const EMPLOYMENT_PATTERNS: [RegExp, string][] = [
  [/\bfull[- ]?time\b|\bftes?\b/, 'full_time'],
  [/\bpart[- ]?time\b/, 'part_time'],
  [/\bcontract(?:or|ors|)?\b/, 'contractor'],
];

function parseNL(text: string, people: Person[]): RuleCondition[] {
  const rows: RuleCondition[] = [];
  const lower = text.toLowerCase().trim();
  if (!lower) return rows;
  const seen = new Set<string>();
  const add = (field: string, operator: RuleCondition['operator'], value: string) => {
    const key = `${field}|${operator}|${value}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({ type: 'condition', field, operator, value });
  };

  const depts = [...new Set(people.map(p => p.department))];
  for (const dept of depts) {
    if (lower.includes(dept.toLowerCase())) {
      add('department', isNegated(lower, dept.toLowerCase()) ? 'is_not' : 'is', dept);
    }
  }

  const locs = [...new Set(people.map(p => p.location))];
  const matchedLocs = new Set<string>();
  for (const loc of locs) {
    if (lower.includes(loc.toLowerCase())) {
      add('location', isNegated(lower, loc.toLowerCase()) ? 'is_not' : 'is', loc);
      matchedLocs.add(loc.toLowerCase());
    }
  }
  for (const [re, city] of LOCATION_ALIASES) {
    if (matchedLocs.has(city.toLowerCase())) continue;
    if (re.test(lower)) add('location', 'is', city);
  }

  for (const [re, val] of EMPLOYMENT_PATTERNS) {
    if (re.test(lower)) {
      const match = lower.match(re);
      add('employmentType', match && isNegated(lower, match[0]) ? 'is_not' : 'is', val);
    }
  }

  for (const [re, code] of COUNTRY_PATTERNS) {
    if (re.test(lower)) {
      const match = lower.match(re);
      add('country', match && isNegated(lower, match[0]) ? 'is_not' : 'is', code);
    }
  }

  if (/\bactive\b/.test(lower)) add('roleState', isNegated(lower, 'active') ? 'is_not' : 'is', 'active');
  if (/\bpending\b/.test(lower)) add('roleState', isNegated(lower, 'pending') ? 'is_not' : 'is', 'pending');
  if (/\bterminated\b/.test(lower)) add('roleState', isNegated(lower, 'terminated') ? 'is_not' : 'is', 'terminated');

  if (rows.length === 0 && /\beveryone\b|\ball employees\b|\ball people\b/.test(lower)) {
    add('roleState', 'is', 'active');
  }

  return rows;
}

function searchSavedGroups(query: string, groups: SavedGroup[]): SavedGroup[] {
  const lower = query.toLowerCase().trim();
  if (!lower || lower.length < 2) return [];
  return groups.filter(g => {
    if (g.isLegacy) return false;
    if (g.name.toLowerCase().includes(lower)) return true;
    if (g.purpose.toLowerCase().includes(lower)) return true;
    const summary = ruleToSummary(g.rule).toLowerCase();
    if (summary.includes(lower)) return true;
    const words = lower.split(/\s+/);
    return words.every(w => g.name.toLowerCase().includes(w) || g.purpose.toLowerCase().includes(w) || summary.includes(w));
  });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

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

// ── Sensitivity helpers ──────────────────────────────────────────────────────

function tierLabel(tier: SensitivityTier): string {
  return tier === 1 ? 'Critical' : tier === 2 ? 'Moderate' : 'Low';
}

function tierColor(tier: SensitivityTier) {
  return tier === 1 ? { bg: C.redLight, border: C.redBorder, text: C.red }
    : tier === 2 ? { bg: C.amberLight, border: C.amberBorder, text: C.amber }
    : { bg: C.accentLight, border: C.accentBorder, text: C.accent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 1: THE GROUP CARD
// ═══════════════════════════════════════════════════════════════════════════════

function GroupCard({ group, people, onExpand, compact, selected, onSelect }: {
  group: SavedGroup;
  people: Person[];
  onExpand?: () => void;
  compact?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const members = useMemo(() => getMembersForRule(people, group.rule, group.evaluationLayers), [people, group]);
  const excludedByLayers = useMemo(() => getExcludedByLayers(people, group.rule, group.evaluationLayers), [people, group]);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const { text: summaryText, overflow } = useMemo(() => ruleToCompactSummary(group.rule), [group.rule]);

  const handleClick = onSelect || onExpand;

  return (
    <div
      onClick={handleClick}
      style={{
        padding: compact ? '10px 12px' : '14px 16px',
        background: selected ? C.accentLight : C.surface,
        border: `1px solid ${selected ? C.accentBorder : C.border}`,
        borderRadius: 12,
        cursor: handleClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        boxShadow: selected ? `0 0 0 2px ${C.accentBorder}` : S.card,
      }}
      onMouseEnter={e => { if (handleClick && !selected) e.currentTarget.style.borderColor = C.borderStrong; }}
      onMouseLeave={e => { if (handleClick && !selected) e.currentTarget.style.borderColor = C.border; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: compact ? 14 : 15, color: C.text, marginBottom: 2 }}>
            {group.name || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Unnamed group</span>}
          </div>
          <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.4 }}>
            {summaryText}
            {overflow > 0 && (
              <span style={{ color: C.textMuted }}> +{overflow} more {overflow === 1 ? 'condition' : 'conditions'}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Stacked avatars */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {members.slice(0, 3).map((p, i) => (
              <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i, position: 'relative' }}>
                <Avatar name={p.name} size={22} />
              </div>
            ))}
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{members.length}</span>
        </div>
      </div>

      {/* Evaluation layer indicator + consumer count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        {totalExcluded > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight,
            borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125,
          }}>
            {totalExcluded} excluded by system filters
          </span>
        )}
        {group.consumers.length > 0 && (
          <span style={{ fontSize: 12, color: C.textMuted }}>
            Used by {group.consumers.length} {group.consumers.length === 1 ? 'policy' : 'policies'}
          </span>
        )}
        {onExpand && (
          <button
            onClick={e => { e.stopPropagation(); onExpand(); }}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: C.accent, fontSize: 12, fontWeight: 500, cursor: 'pointer',
              fontFamily: FONT, padding: '2px 0',
            }}
          >
            View details →
          </button>
        )}
      </div>
    </div>
  );
}

// ── Disclosure Panel (shared progressive disclosure container) ───────────────

type DisclosureVariant = 'sheet' | 'slide' | 'accordion' | 'spatial' | 'conversational';

function DisclosurePanel({ variant, open, onClose, title, children }: {
  variant: DisclosureVariant;
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  if (variant === 'sheet') {
    return (
      <>
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.15)',
            backdropFilter: 'blur(2px)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        />
        {/* Sheet */}
        <div style={{
          position: 'fixed', bottom: 64, left: 0, right: 0, zIndex: 201,
          maxHeight: '45vh', display: 'flex', flexDirection: 'column',
          background: C.surface,
          borderRadius: '16px 16px 0 0',
          boxShadow: '0 -4px 32px rgba(0,0,0,0.12), 0 -1px 4px rgba(0,0,0,0.06)',
          animation: 'slideUp 0.2s ease-out',
        }}>
          {/* Handle + header */}
          <div style={{ padding: '10px 16px 6px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
            <div style={{ width: 32, height: 4, borderRadius: 2, background: C.borderStrong, margin: '0 auto 8px', opacity: 0.5 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{title}</span>
              <button onClick={onClose} style={{
                background: 'none', border: 'none', fontSize: 18, color: C.textMuted,
                cursor: 'pointer', fontFamily: FONT, padding: '0 2px', lineHeight: 1,
              }}>×</button>
            </div>
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
        <style>{`
          @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </>
    );
  }

  if (variant === 'slide') {
    return (
      <>
        {/* Backdrop */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(0,0,0,0.1)',
            animation: 'fadeIn 0.15s ease-out',
          }}
        />
        {/* Slide-over panel */}
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 201,
          width: 420, maxWidth: '85vw',
          background: C.surface,
          boxShadow: '-8px 0 32px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column',
          animation: 'slideIn 0.2s ease-out',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 16px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
          }}>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 14, fontWeight: 600,
              color: C.accent, cursor: 'pointer', fontFamily: FONT, padding: '2px 0',
            }}>← Back</button>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{title}</span>
          </div>
          {/* Content */}
          <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {children}
          </div>
        </div>
        <style>{`
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        `}</style>
      </>
    );
  }

  // accordion — inline, constrained height
  return (
    <div style={{
      border: `1px solid ${C.accentBorder}`,
      borderTop: 'none',
      borderRadius: '0 0 12px 12px',
      background: C.surface,
      overflow: 'hidden',
      maxHeight: 320,
      display: 'flex', flexDirection: 'column',
    }}>
      {children}
    </div>
  );
}

// Shared tab content renderer used by both ExpandableGroupCard and GroupDefinitionCard
function DisclosureTabContent({ members, allPeople, rule, layers, excludedByLayers, consumers, compact, onApplyAdjustment, activeTab, setActiveTab, conditions, groupOwner, groupDomain, lastEvaluatedAt }: {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  consumers: PolicyRef[];
  compact?: boolean;
  onApplyAdjustment?: (condition: RuleCondition) => void;
  activeTab: 'members' | 'layers' | 'policies';
  setActiveTab: (tab: 'members' | 'layers' | 'policies') => void;
  conditions?: RuleCondition[];
  groupOwner?: string;
  groupDomain?: string;
  lastEvaluatedAt?: string;
}) {
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);

  return (
    <>
      {/* Conditions pills (if provided) */}
      {conditions && conditions.length > 0 && (
        <div style={{ padding: '10px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Conditions
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {conditions.map((c, i) => {
              const opLabel = (OPERATOR_OPTIONS[c.field] || []).find(o => o.value === c.operator)?.label || c.operator;
              const val = Array.isArray(c.value) ? c.value.map(v => formatValue(c.field, v)).join(', ') : formatValue(c.field, c.value as string);
              return (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', fontSize: 13, borderRadius: 9999,
                  background: C.surfaceAlt, border: `1px solid ${C.border}`,
                }}>
                  <span style={{ fontWeight: 500, color: C.text }}>{fieldLabels[c.field] || c.field}</span>
                  <span style={{ color: C.textMuted }}>{opLabel}</span>
                  <span style={{ fontWeight: 500, color: C.text }}>{val}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
        {([
          { key: 'members' as const, label: `Members (${members.length})` },
          { key: 'layers' as const, label: `Filters${totalExcluded > 0 ? ` (${totalExcluded})` : ''}` },
          { key: 'policies' as const, label: `Policies (${consumers.length})` },
        ]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '8px 12px', background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${C.accent}` : '2px solid transparent',
              fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? C.accent : C.textMuted,
              cursor: 'pointer', fontFamily: FONT, transition: 'all 0.1s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — scrollable */}
      <div style={{ flex: 1, padding: '12px 16px', overflowY: 'auto' }}>
        {activeTab === 'members' && (
          <BidirectionalPreview
            members={members}
            allPeople={allPeople}
            rule={rule}
            layers={layers}
            onApplyAdjustment={onApplyAdjustment}
            compact={compact}
          />
        )}

        {activeTab === 'layers' && (
          <div>
            {excludedByLayers.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
                No system filters are affecting this group.
              </div>
            ) : (
              excludedByLayers.map(({ layer, people: excluded }) => (
                <div key={layer.id} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 2 }}>
                    {layer.label}
                  </div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>
                    {layer.description}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {excluded.map(p => (
                      <span key={p.id} style={{
                        fontSize: 12, fontWeight: 500, background: C.amberLight, color: C.amber,
                        borderRadius: 9999, padding: '2px 8px',
                      }}>
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'policies' && (
          <div>
            {consumers.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted, padding: '8px 0' }}>
                This group is not referenced by any policies.
              </div>
            ) : (
              consumers.map(p => {
                const pc = tierColor(p.sensitivityTier);
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                    fontSize: 14,
                  }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                      background: pc.bg, color: pc.text, textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>
                      {tierLabel(p.sensitivityTier)}
                    </span>
                    <span style={{ fontWeight: 500, color: C.text }}>{p.name}</span>
                    <span style={{ color: C.textSecondary, marginLeft: 'auto', fontSize: 13 }}>
                      {p.domain} · {p.affectedCount.toLocaleString()} people
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Metadata footer */}
      {(groupOwner || groupDomain || lastEvaluatedAt) && (
        <div style={{
          padding: '8px 16px', borderTop: `1px solid ${C.border}`, flexShrink: 0,
          fontSize: 12, color: C.textMuted, display: 'flex', gap: 12, flexWrap: 'wrap',
        }}>
          {groupOwner && <span>Owner: {groupOwner}</span>}
          {groupDomain && <span>Domain: {groupDomain}</span>}
          {lastEvaluatedAt && <span>Last evaluated {new Date(lastEvaluatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT D: THE SPATIAL CARD
// ═══════════════════════════════════════════════════════════════════════════════

type SpatialDepth = 'resting' | 'members' | 'layers' | 'policies' | 'person';

function SpatialGroupCard({ group, people, onDeselect }: {
  group: SavedGroup;
  people: Person[];
  onDeselect: () => void;
}) {
  const [depth, setDepth] = useState<SpatialDepth>('resting');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  const members = useMemo(() => getMembersForRule(people, group.rule, group.evaluationLayers), [people, group]);
  const excludedByLayers = useMemo(() => getExcludedByLayers(people, group.rule, group.evaluationLayers), [people, group]);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const { text: summaryText, overflow } = useMemo(() => ruleToCompactSummary(group.rule), [group.rule]);

  const explanation = useMemo(() =>
    selectedPerson ? explainPerson(selectedPerson, group.rule, group.evaluationLayers) : null,
  [selectedPerson, group.rule, group.evaluationLayers]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (depth === 'person') { setDepth('members'); setSelectedPerson(null); }
        else if (depth !== 'resting') setDepth('resting');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [depth]);

  const breadcrumb = (() => {
    const parts: { label: string; action: () => void }[] = [{ label: group.name, action: () => { setDepth('resting'); setSelectedPerson(null); } }];
    if (depth === 'members' || depth === 'person') parts.push({ label: 'Members', action: () => { setDepth('members'); setSelectedPerson(null); } });
    if (depth === 'layers') parts.push({ label: 'System filters', action: () => {} });
    if (depth === 'policies') parts.push({ label: 'Policies', action: () => {} });
    if (depth === 'person' && selectedPerson) parts.push({ label: selectedPerson.name, action: () => {} });
    return parts;
  })();

  return (
    <div>
      <div style={{
        background: C.accentLight,
        border: `1px solid ${C.accentBorder}`,
        borderRadius: 12,
        boxShadow: `0 0 0 2px ${C.accentBorder}`,
        height: depth === 'resting' ? 'auto' : 320,
        overflow: 'hidden',
        transition: 'height 0.25s ease',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Breadcrumb — visible when not resting */}
        {depth !== 'resting' && (
          <div style={{
            padding: '8px 14px', borderBottom: `1px solid ${C.accentBorder}`,
            fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4,
            flexShrink: 0, background: C.accentLight,
          }}>
            {breadcrumb.map((b, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
                <button
                  onClick={b.action}
                  style={{
                    background: 'none', border: 'none', fontFamily: FONT, fontSize: 12,
                    color: i < breadcrumb.length - 1 ? C.accent : C.text,
                    fontWeight: i < breadcrumb.length - 1 ? 500 : 600,
                    cursor: i < breadcrumb.length - 1 ? 'pointer' : 'default', padding: 0,
                  }}
                >{b.label}</button>
              </span>
            ))}
          </div>
        )}

        {/* Content area with cross-fade */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {/* RESTING */}
          <div style={{
            position: depth === 'resting' ? 'relative' : 'absolute', inset: 0,
            opacity: depth === 'resting' ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: depth === 'resting' ? 'auto' : 'none',
            padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 2 }}>{group.name}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.4 }}>
                  {summaryText}{overflow > 0 && <span style={{ color: C.textMuted }}> +{overflow} more</span>}
                </div>
              </div>
              <button onClick={() => setDepth('members')} style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0,
              }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  {members.slice(0, 3).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i, position: 'relative' }}>
                      <Avatar name={p.name} size={22} />
                    </div>
                  ))}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.accent }}>{members.length}</span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {totalExcluded > 0 && (
                <button onClick={() => setDepth('layers')} style={{
                  fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight,
                  borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125,
                  border: 'none', cursor: 'pointer', fontFamily: FONT,
                }}>{totalExcluded} excluded by system filters</button>
              )}
              {group.consumers.length > 0 && (
                <button onClick={() => setDepth('policies')} style={{
                  fontSize: 12, color: C.textMuted, background: 'none',
                  border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0,
                }}>Used by {group.consumers.length} {group.consumers.length === 1 ? 'policy' : 'policies'}</button>
              )}
            </div>
          </div>

          {/* MEMBERS */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: depth === 'members' ? 1 : 0,
            transform: depth === 'members' ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: depth === 'members' ? 'auto' : 'none',
            overflowY: 'auto', padding: '8px 12px',
          }}>
            {members.map(p => (
              <button key={p.id} onClick={() => { setSelectedPerson(p); setDepth('person'); }} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '5px 6px',
                borderRadius: 8, border: 'none', width: '100%', textAlign: 'left',
                background: 'transparent', cursor: 'pointer', fontFamily: FONT,
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <Avatar name={p.name} size={24} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary }}>{p.title} · {p.department}</div>
                </div>
              </button>
            ))}
          </div>

          {/* LAYERS */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: depth === 'layers' ? 1 : 0,
            transform: depth === 'layers' ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: depth === 'layers' ? 'auto' : 'none',
            overflowY: 'auto', padding: '12px 16px',
          }}>
            {excludedByLayers.map(({ layer, people: excluded }) => (
              <div key={layer.id} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 2 }}>{layer.label}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6, lineHeight: 1.4 }}>{layer.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {excluded.map(p => (
                    <span key={p.id} style={{ fontSize: 12, fontWeight: 500, background: C.amberLight, color: C.amber, borderRadius: 9999, padding: '2px 8px' }}>{p.name}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* POLICIES */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: depth === 'policies' ? 1 : 0,
            transform: depth === 'policies' ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: depth === 'policies' ? 'auto' : 'none',
            overflowY: 'auto', padding: '12px 16px',
          }}>
            {group.consumers.map(p => {
              const pc = tierColor(p.sensitivityTier);
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 14 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, background: pc.bg, color: pc.text, textTransform: 'uppercase', letterSpacing: 0.5 }}>{tierLabel(p.sensitivityTier)}</span>
                  <span style={{ fontWeight: 500, color: C.text }}>{p.name}</span>
                  <span style={{ color: C.textSecondary, marginLeft: 'auto', fontSize: 13 }}>{p.domain}</span>
                </div>
              );
            })}
          </div>

          {/* PERSON DETAIL */}
          <div style={{
            position: 'absolute', inset: 0,
            opacity: depth === 'person' ? 1 : 0,
            transform: depth === 'person' ? 'translateY(0)' : 'translateY(8px)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
            pointerEvents: depth === 'person' ? 'auto' : 'none',
            overflowY: 'auto', padding: '12px 16px',
          }}>
            {selectedPerson && explanation && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Avatar name={selectedPerson.name} size={32} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{selectedPerson.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary }}>{selectedPerson.title} · {selectedPerson.department} · {selectedPerson.location}</div>
                  </div>
                </div>
                <div style={{
                  padding: '8px 10px', borderRadius: 8, fontSize: 13, marginBottom: 8,
                  background: explanation.status === 'included' ? C.greenLight : explanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
                  color: explanation.status === 'included' ? C.green : explanation.status === 'excluded_by_layer' ? C.amber : C.red,
                  fontWeight: 600,
                }}>{explanation.text}</div>
                {explanation.conditions.map((cond, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 13 }}>
                    <span style={{ color: cond.passed ? C.green : C.red, fontWeight: 700, width: 16, textAlign: 'center' }}>{cond.passed ? '✓' : '✗'}</span>
                    <span style={{ fontWeight: 500, color: C.text }}>{cond.fieldLabel}</span>
                    <span style={{ color: C.textMuted }}>{cond.operator}</span>
                    <span style={{ color: C.text, fontWeight: 500 }}>{cond.expected}</span>
                    {!cond.passed && <span style={{ color: C.textMuted, marginLeft: 'auto', fontSize: 12 }}>actual: {cond.actual}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <button onClick={onDeselect} style={{ marginTop: 8, background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, padding: '4px 0' }}>
        ← Choose a different group
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT E: THE CONVERSATIONAL LENS
// ═══════════════════════════════════════════════════════════════════════════════

type InspectionIntent = { type: 'members' } | { type: 'layers' } | { type: 'policies' } | { type: 'person'; name: string } | null;

function detectInspection(text: string): InspectionIntent {
  const lower = text.toLowerCase().trim();
  if (!lower) return null;
  if (/\b(who|members|people|list\s*(them|all|members)?|show\s*(me\s*)?(members|people|everyone|all))\b/.test(lower)) return { type: 'members' };
  if (/\b(exclu|filter|system|hidden|layer|removed|blocked)\b/.test(lower)) return { type: 'layers' };
  if (/\b(polic|used\s*by|downstream|consumer|depends|referenced)\b/.test(lower)) return { type: 'policies' };
  const personMatch = lower.match(/(?:why\s+(?:is\s+)?|explain\s+|about\s+|show\s+|tell\s+me\s+about\s+)(.+?)(?:\s+here|\s+in\s+this|\s+included|\s+match|\s+in|\?)?$/);
  if (personMatch) return { type: 'person', name: personMatch[1].trim() };
  if (/^why\b/.test(lower)) return { type: 'members' };
  return null;
}

function ConversationalGroupCard({ group, people, onDeselect }: {
  group: SavedGroup;
  people: Person[];
  onDeselect: () => void;
}) {
  const [query, setQuery] = useState('');
  const [activeIntent, setActiveIntent] = useState<InspectionIntent>(null);
  const [selectedPersonName, setSelectedPersonName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const members = useMemo(() => getMembersForRule(people, group.rule, group.evaluationLayers), [people, group]);
  const excludedByLayers = useMemo(() => getExcludedByLayers(people, group.rule, group.evaluationLayers), [people, group]);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const { text: summaryText, overflow } = useMemo(() => ruleToCompactSummary(group.rule), [group.rule]);
  const allPeople = useMemo(() => [...members, ...excludedByLayers.flatMap(e => e.people)], [members, excludedByLayers]);

  const resolveIntent = useCallback((text: string) => {
    const intent = detectInspection(text);
    setActiveIntent(intent);
    setSelectedPersonName(intent?.type === 'person' ? intent.name : null);
  }, []);

  const handleChange = useCallback((text: string) => {
    setQuery(text);
    resolveIntent(text);
  }, [resolveIntent]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      resolveIntent(query);
    }
  }, [query, resolveIntent]);

  const clearLens = useCallback(() => {
    setQuery('');
    setActiveIntent(null);
    setSelectedPersonName(null);
    inputRef.current?.focus();
  }, []);

  const drillIntoPerson = useCallback((name: string) => {
    setQuery(`explain ${name}`);
    setActiveIntent({ type: 'person', name });
    setSelectedPersonName(name);
  }, []);

  const matchedPerson = useMemo(() => {
    if (!selectedPersonName) return null;
    return allPeople.find(p => p.name.toLowerCase().includes(selectedPersonName.toLowerCase())) || null;
  }, [selectedPersonName, allPeople]);

  const personExplanation = useMemo(() => {
    if (!matchedPerson) return null;
    return explainPerson(matchedPerson, group.rule, group.evaluationLayers);
  }, [matchedPerson, group.rule, group.evaluationLayers]);

  const lensLabel = activeIntent?.type === 'members' ? `Members (${members.length})`
    : activeIntent?.type === 'layers' ? `System filters (${totalExcluded} excluded)`
    : activeIntent?.type === 'policies' ? `Policies (${group.consumers.length})`
    : activeIntent?.type === 'person' ? (matchedPerson?.name || 'Not found')
    : '';

  return (
    <div>
      <div style={{
        background: C.accentLight,
        border: `1px solid ${C.accentBorder}`,
        borderRadius: 12,
        boxShadow: `0 0 0 2px ${C.accentBorder}`,
        overflow: 'hidden',
      }}>
        {/* Card head */}
        <div style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 2 }}>{group.name}</div>
              <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.4 }}>
                {summaryText}{overflow > 0 && <span style={{ color: C.textMuted }}> +{overflow} more</span>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {members.slice(0, 3).map((p, i) => (
                  <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i, position: 'relative' }}>
                    <Avatar name={p.name} size={22} />
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{members.length}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {totalExcluded > 0 && (
              <span style={{ fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight, borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125 }}>{totalExcluded} excluded by system filters</span>
            )}
            {group.consumers.length > 0 && (
              <span style={{ fontSize: 12, color: C.textMuted }}>Used by {group.consumers.length} {group.consumers.length === 1 ? 'policy' : 'policies'}</span>
            )}
          </div>
        </div>

        {/* Lens result area — rendered from data, not stored JSX */}
        {activeIntent && (
          <div style={{ borderTop: `1px solid ${C.accentBorder}`, padding: '8px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: C.accent, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>{lensLabel}</span>
              <button onClick={clearLens} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 14, cursor: 'pointer', fontFamily: FONT, padding: 0, lineHeight: 1 }}>×</button>
            </div>

            {activeIntent.type === 'members' && (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {members.map(p => (
                  <button key={p.id} onClick={() => drillIntoPerson(p.name)} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px',
                    borderRadius: 6, border: 'none', width: '100%', textAlign: 'left',
                    background: 'transparent', cursor: 'pointer', fontFamily: FONT,
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Avatar name={p.name} size={22} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 'auto' }}>{p.department}</span>
                  </button>
                ))}
              </div>
            )}

            {activeIntent.type === 'layers' && (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {excludedByLayers.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textMuted, padding: 8 }}>No system filters active.</div>
                ) : excludedByLayers.map(({ layer, people: exc }) => (
                  <div key={layer.id} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{layer.label}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{layer.description}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                      {exc.map(p => <span key={p.id} style={{ fontSize: 11, fontWeight: 500, background: C.amberLight, color: C.amber, borderRadius: 9999, padding: '1px 7px' }}>{p.name}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeIntent.type === 'policies' && (
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {group.consumers.length === 0 ? (
                  <div style={{ fontSize: 13, color: C.textMuted, padding: 8 }}>No policies reference this group.</div>
                ) : group.consumers.map(p => {
                  const pc = tierColor(p.sensitivityTier);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 13 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 9999, background: pc.bg, color: pc.text, textTransform: 'uppercase' }}>{tierLabel(p.sensitivityTier)}</span>
                      <span style={{ fontWeight: 500, color: C.text }}>{p.name}</span>
                      <span style={{ color: C.textSecondary, marginLeft: 'auto', fontSize: 12 }}>{p.domain}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {activeIntent.type === 'person' && matchedPerson && personExplanation && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Avatar name={matchedPerson.name} size={28} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{matchedPerson.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary }}>{matchedPerson.title} · {matchedPerson.department}</div>
                  </div>
                </div>
                <div style={{
                  padding: '6px 10px', borderRadius: 6, fontSize: 12, marginBottom: 6, fontWeight: 600,
                  background: personExplanation.status === 'included' ? C.greenLight : personExplanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
                  color: personExplanation.status === 'included' ? C.green : personExplanation.status === 'excluded_by_layer' ? C.amber : C.red,
                }}>{personExplanation.text}</div>
                {personExplanation.conditions.map((cond, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 0', fontSize: 12 }}>
                    <span style={{ color: cond.passed ? C.green : C.red, fontWeight: 700, width: 14, textAlign: 'center' }}>{cond.passed ? '✓' : '✗'}</span>
                    <span style={{ fontWeight: 500, color: C.text }}>{cond.fieldLabel}</span>
                    <span style={{ color: C.textMuted }}>{cond.operator}</span>
                    <span style={{ fontWeight: 500 }}>{cond.expected}</span>
                    {!cond.passed && <span style={{ color: C.textMuted, marginLeft: 'auto' }}>actual: {cond.actual}</span>}
                  </div>
                ))}
              </div>
            )}

            {activeIntent.type === 'person' && !matchedPerson && (
              <div style={{ fontSize: 13, color: C.textMuted, padding: 8 }}>No one named "{activeIntent.name}" found in this group.</div>
            )}
          </div>
        )}

        {/* Query bar */}
        <div style={{ borderTop: `1px solid ${C.accentBorder}`, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, color: C.textMuted, flexShrink: 0 }}>?</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Ask: "who", "excluded", "why is Sarah here?"'
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: FONT,
              background: 'transparent', color: C.text, padding: 0,
            }}
          />
        </div>
      </div>
      <button onClick={onDeselect} style={{ marginTop: 8, background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, padding: '4px 0' }}>
        ← Choose a different group
      </button>
    </div>
  );
}

// ── Expandable Group Card (progressive disclosure from head → full surface) ──

function ExpandableGroupCard({ group, people, expanded: isExpandedHost, onDeselect, disclosureVariant = 'accordion' }: {
  group: SavedGroup;
  people: Person[];
  expanded?: boolean;
  onDeselect: () => void;
  disclosureVariant?: DisclosureVariant;
}) {
  if (disclosureVariant === 'spatial') return <SpatialGroupCard group={group} people={people} onDeselect={onDeselect} />;
  if (disclosureVariant === 'conversational') return <ConversationalGroupCard group={group} people={people} onDeselect={onDeselect} />;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'layers' | 'policies'>('members');

  const members = useMemo(() => getMembersForRule(people, group.rule, group.evaluationLayers), [people, group]);
  const excludedByLayers = useMemo(() => getExcludedByLayers(people, group.rule, group.evaluationLayers), [people, group]);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const { text: summaryText, overflow } = useMemo(() => ruleToCompactSummary(group.rule), [group.rule]);
  const conditions = group.rule.children.filter(c => c.type === 'condition') as RuleCondition[];

  const showAccordionBorder = detailsOpen && disclosureVariant === 'accordion';

  return (
    <div>
      {/* The card head — always visible */}
      <div style={{
        padding: '14px 16px',
        background: detailsOpen ? C.accentLight : C.accentLight,
        border: `1px solid ${C.accentBorder}`,
        borderRadius: showAccordionBorder ? '12px 12px 0 0' : 12,
        boxShadow: `0 0 0 2px ${C.accentBorder}`,
        transition: 'border-radius 0.15s',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: C.text, marginBottom: 2 }}>
              {group.name}
            </div>
            <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.4 }}>
              {summaryText}
              {overflow > 0 && (
                <span style={{ color: C.textMuted }}> +{overflow} more</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {members.slice(0, 3).map((p, i) => (
                <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 3 - i, position: 'relative' }}>
                  <Avatar name={p.name} size={22} />
                </div>
              ))}
            </div>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{members.length}</span>
          </div>
        </div>

        {/* Interactive indicators row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          {totalExcluded > 0 && (
            <button
              onClick={() => { setDetailsOpen(true); setActiveTab('layers'); }}
              style={{
                fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight,
                borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125,
                border: 'none', cursor: 'pointer', fontFamily: FONT,
                transition: 'outline 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.outline = `2px solid ${C.amberBorder}`)}
              onMouseLeave={e => (e.currentTarget.style.outline = 'none')}
            >
              {totalExcluded} excluded by system filters
            </button>
          )}
          {group.consumers.length > 0 && (
            <button
              onClick={() => { setDetailsOpen(true); setActiveTab('policies'); }}
              style={{
                fontSize: 12, color: C.textMuted, background: 'none',
                border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0,
                transition: 'color 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = C.accent)}
              onMouseLeave={e => (e.currentTarget.style.color = C.textMuted)}
            >
              Used by {group.consumers.length} {group.consumers.length === 1 ? 'policy' : 'policies'}
            </button>
          )}
          <button
            onClick={() => setDetailsOpen(!detailsOpen)}
            style={{
              marginLeft: 'auto', background: 'none', border: 'none',
              color: C.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: FONT, padding: '2px 0',
            }}
          >
            {detailsOpen ? 'Collapse' : 'View details'}
          </button>
        </div>
      </div>

      {/* Disclosure panel — variant determines container */}
      <DisclosurePanel
        variant={disclosureVariant}
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        title={group.name}
      >
        <DisclosureTabContent
          members={members}
          allPeople={people}
          rule={group.rule}
          layers={group.evaluationLayers}
          excludedByLayers={excludedByLayers}
          consumers={group.consumers}
          compact={!isExpandedHost}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          conditions={conditions}
          groupOwner={group.owner}
          groupDomain={group.productDomain}
          lastEvaluatedAt={group.lastEvaluatedAt}
        />
      </DisclosurePanel>

      {/* Deselect action */}
      <button onClick={onDeselect}
        style={{ marginTop: 8, background: 'none', border: 'none', color: C.accent, fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: FONT, padding: '4px 0' }}>
        ← Choose a different group
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 2: NL-FIRST ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════════════

function NLEntryPoint({ people, savedGroups, onSelectGroup, onCreateFromConditions, onEditCommand, currentRule, placeholder }: {
  people: Person[];
  savedGroups: SavedGroup[];
  onSelectGroup: (group: SavedGroup) => void;
  onCreateFromConditions: (conditions: RuleCondition[]) => void;
  onEditCommand?: (text: string) => void;
  currentRule?: RuleGroup;
  placeholder?: string;
}) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matchingGroups = useMemo(() => searchSavedGroups(query, savedGroups), [query, savedGroups]);
  const parsedConditions = useMemo(() => query.length > 2 ? parseNL(query, people) : [], [query, people]);

  const isEditing = !!currentRule && currentRule.children.length > 0;
  const isEditCommand = isEditing && /^(add|remove|exclude|include|why is|why does)/.test(query.toLowerCase().trim());
  const showResults = focused && query.length > 1 && (matchingGroups.length > 0 || parsedConditions.length > 0 || isEditCommand);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (isEditCommand && onEditCommand) {
        onEditCommand(query);
        setQuery('');
      } else if (matchingGroups.length > 0) {
        // don't auto-select; let user pick
      } else if (parsedConditions.length > 0) {
        onCreateFromConditions(parsedConditions);
        setQuery('');
      }
    }
    if (e.key === 'Escape') {
      setQuery('');
      inputRef.current?.blur();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        border: `1.5px solid ${focused ? C.accent : C.border}`,
        borderRadius: 10,
        background: C.surface,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? `0 0 0 3px rgba(0,117,222,0.08)` : 'none',
      }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: C.textMuted }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || (isEditing ? 'Refine: "remove contractors", "add SF office", "why is Sarah here?"' : 'Describe who should be in this group...')}
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 14,
            fontFamily: FONT, color: C.text, background: 'transparent',
          }}
        />
        {query && (
          <button
            onClick={() => setQuery('')}
            style={{ background: 'none', border: 'none', color: C.textMuted, cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
          >
            ×
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: S.deep, zIndex: 50,
          maxHeight: 360, overflow: 'auto', padding: 6,
        }}>
          {/* Matching saved groups */}
          {matchingGroups.length > 0 && (
            <div style={{ padding: '4px 8px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                {matchingGroups.length} existing {matchingGroups.length === 1 ? 'group matches' : 'groups match'}
              </div>
              {matchingGroups.map(g => (
                <button
                  key={g.id}
                  onClick={() => { onSelectGroup(g); setQuery(''); }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '8px 10px', border: 'none',
                    borderRadius: 8, background: 'transparent', cursor: 'pointer',
                    fontFamily: FONT, textAlign: 'left', transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{g.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 1 }}>{g.purpose}</div>
                  </div>
                  <span style={{ fontSize: 13, color: C.textMuted, flexShrink: 0, marginLeft: 12 }}>
                    {g.memberIds.length} members
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Divider */}
          {matchingGroups.length > 0 && parsedConditions.length > 0 && (
            <div style={{ borderTop: `1px solid rgba(0,0,0,0.06)`, margin: '2px 8px' }} />
          )}

          {/* Generated conditions */}
          {parsedConditions.length > 0 && !isEditCommand && (
            <div style={{ padding: '4px 8px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Create from conditions
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8 }}>
                {parsedConditions.map((c, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 500, padding: '3px 8px',
                    background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}`,
                    borderRadius: 9999,
                  }}>
                    {fieldLabels[c.field] || c.field} {c.operator} {formatValue(c.field, c.value as string)}
                  </span>
                ))}
              </div>
              <button
                onClick={() => { onCreateFromConditions(parsedConditions); setQuery(''); }}
                style={{
                  background: C.accent, color: '#fff', border: 'none',
                  borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                  fontFamily: FONT, cursor: 'pointer',
                }}
              >
                Create with these conditions
              </button>
            </div>
          )}

          {/* Edit command */}
          {isEditCommand && onEditCommand && (
            <div style={{ padding: '4px 8px 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Edit command
              </div>
              <button
                onClick={() => { onEditCommand(query); setQuery(''); }}
                style={{
                  background: C.accent, color: '#fff', border: 'none',
                  borderRadius: 6, padding: '6px 14px', fontSize: 13, fontWeight: 600,
                  fontFamily: FONT, cursor: 'pointer',
                }}
              >
                Apply: "{query}"
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 3: BIDIRECTIONAL PREVIEW WITH REFINEMENT
// ═══════════════════════════════════════════════════════════════════════════════

function BidirectionalPreview({ members, allPeople, rule, layers, onApplyAdjustment, compact }: {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  onApplyAdjustment?: (condition: RuleCondition) => void;
  compact?: boolean;
}) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = compact ? 5 : 8;
  const total = members.length;

  const explanation = selectedPerson ? explainPerson(selectedPerson, rule, layers) : null;
  const adjustment = selectedPerson && explanation?.status === 'included'
    ? suggestAdjustment(selectedPerson, members, rule)
    : null;

  const excludedByLayers = useMemo(() => getExcludedByLayers(allPeople, rule, layers), [allPeople, rule, layers]);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);

  if (total === 0 && totalExcluded === 0) {
    return <div style={{ padding: '14px 0', color: C.textMuted, fontSize: 14 }}>No one matches these conditions.</div>;
  }

  return (
    <div>
      {/* Count + evaluation layer indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>
          {total} {total === 1 ? 'person' : 'people'}
        </span>
        {totalExcluded > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight,
            borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125,
          }}>
            {totalExcluded} excluded by system filters
          </span>
        )}
      </div>

      {/* Person list — clickable for bidirectional refinement */}
      {members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(p => (
        <button
          key={p.id}
          onClick={() => setSelectedPerson(selectedPerson?.id === p.id ? null : p)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: compact ? '5px 8px' : '7px 10px',
            borderRadius: 8, border: 'none', width: '100%', textAlign: 'left',
            background: selectedPerson?.id === p.id ? C.accentLight : 'transparent',
            cursor: 'pointer', fontFamily: FONT, transition: 'background 0.1s',
          }}
          onMouseEnter={e => { if (selectedPerson?.id !== p.id) e.currentTarget.style.background = C.surfaceAlt; }}
          onMouseLeave={e => { if (selectedPerson?.id !== p.id) e.currentTarget.style.background = 'transparent'; }}
        >
          <Avatar name={p.name} size={compact ? 24 : 28} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
              {p.name}
              {p.roleState === 'pending' && <span style={{ fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight, borderRadius: 9999, padding: '1px 7px' }}>Pending</span>}
            </div>
            {!compact && (
              <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 1 }}>
                {p.title} · {p.department} · {p.location}
              </div>
            )}
          </div>
        </button>
      ))}

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 500, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 4, background: 'transparent', cursor: page === 0 ? 'default' : 'pointer', color: C.textSecondary, opacity: page === 0 ? 0.4 : 1 }}>
              Prev
            </button>
            <button disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 500, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 4, background: 'transparent', cursor: (page + 1) * PAGE_SIZE >= total ? 'default' : 'pointer', color: C.textSecondary, opacity: (page + 1) * PAGE_SIZE >= total ? 0.4 : 1 }}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Explanation panel — per-condition pass/fail + suggest adjustment */}
      {selectedPerson && explanation && (
        <div style={{
          marginTop: 8, padding: '12px 14px',
          background: explanation.status === 'included' ? C.greenLight : explanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
          border: `1px solid ${C.border}`, borderRadius: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={selectedPerson.name} size={22} />
              <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{selectedPerson.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, letterSpacing: 0.125,
                background: explanation.status === 'included' ? C.greenLight : explanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
                color: explanation.status === 'included' ? C.green : explanation.status === 'excluded_by_layer' ? C.amber : C.red,
                border: `1px solid ${explanation.status === 'included' ? C.greenBorder : explanation.status === 'excluded_by_layer' ? C.amberBorder : C.redBorder}`,
              }}>
                {explanation.status === 'included' ? 'Included' : explanation.status === 'excluded_by_layer' ? 'Excluded by system' : 'No match'}
              </span>
            </div>
            <button onClick={() => setSelectedPerson(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16, padding: '0 4px' }}>
              ×
            </button>
          </div>

          {explanation.layerDescription && (
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 6 }}>
              {explanation.layerDescription}
            </div>
          )}

          {explanation.conditions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {explanation.conditions.map((cond, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '3px 8px', borderRadius: 6,
                  background: cond.passed ? 'rgba(42,157,153,0.06)' : 'rgba(211,45,45,0.06)',
                  fontSize: 13,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, width: 16, textAlign: 'center', color: cond.passed ? C.green : C.red }}>
                    {cond.passed ? '✓' : '✗'}
                  </span>
                  <span style={{ fontWeight: 500, color: C.text }}>{cond.fieldLabel}</span>
                  <span style={{ color: C.textMuted }}>{cond.operator}</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{cond.expected}</span>
                  {!cond.passed && (
                    <span style={{ color: C.textMuted, marginLeft: 'auto', fontSize: 12 }}>actual: {cond.actual}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Suggest adjustment action */}
          {adjustment && onApplyAdjustment && (
            <div style={{
              marginTop: 8, padding: '8px 10px', background: 'rgba(255,255,255,0.7)',
              borderRadius: 8, border: `1px dashed ${C.accent}`,
            }}>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
                {adjustment.description}
              </div>
              <button
                onClick={() => { onApplyAdjustment(adjustment.newCondition); setSelectedPerson(null); }}
                style={{
                  background: C.accent, color: '#fff', border: 'none',
                  borderRadius: 6, padding: '5px 12px', fontSize: 12, fontWeight: 600,
                  fontFamily: FONT, cursor: 'pointer',
                }}
              >
                Apply adjustment
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPACT FILTER BUILDER (for embedded use)
// ═══════════════════════════════════════════════════════════════════════════════

function CompactFilterRow({ condition, allPeople, onChange, onRemove, readOnly }: {
  condition: RuleCondition;
  allPeople: Person[];
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
  readOnly?: boolean;
}) {
  const valueOptions = useMemo(() => {
    if (!condition.field) return [];
    return getValueOptions(condition.field, allPeople).map(v => ({ value: v, label: formatValue(condition.field, v) }));
  }, [condition.field, allPeople]);
  const operators = OPERATOR_OPTIONS[condition.field] || [{ value: 'is' as const, label: 'is' }];

  if (readOnly) {
    const opLabel = operators.find(o => o.value === condition.operator)?.label || condition.operator;
    const val = Array.isArray(condition.value) ? condition.value.map(v => formatValue(condition.field, v)).join(', ') : formatValue(condition.field, condition.value as string);
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', fontSize: 13, borderRadius: 9999,
        background: C.surfaceAlt, border: `1px solid ${C.border}`,
      }}>
        <span style={{ fontWeight: 500, color: C.text }}>{fieldLabels[condition.field] || condition.field}</span>
        <span style={{ color: C.textMuted }}>{opLabel}</span>
        <span style={{ fontWeight: 500, color: C.text }}>{val}</span>
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0' }}>
      <select value={condition.field} onChange={e => onChange({ ...condition, field: e.target.value, operator: (OPERATOR_OPTIONS[e.target.value]?.[0]?.value || 'is'), value: '' })}
        style={{ padding: '5px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }}>
        <option value="">Field...</option>
        {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select value={condition.operator} onChange={e => onChange({ ...condition, operator: e.target.value as RuleCondition['operator'] })}
        style={{ padding: '5px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }}>
        {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {condition.field === 'startDate' ? (
        <input type="date" value={typeof condition.value === 'string' ? condition.value : ''} onChange={e => onChange({ ...condition, value: e.target.value })}
          style={{ flex: 1, padding: '5px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }} />
      ) : condition.field === 'title' && condition.operator === 'contains' ? (
        <input type="text" value={typeof condition.value === 'string' ? condition.value : ''} onChange={e => onChange({ ...condition, value: e.target.value })} placeholder="Enter text..."
          style={{ flex: 1, padding: '5px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }} />
      ) : (
        <select value={Array.isArray(condition.value) ? condition.value[0] || '' : condition.value as string} onChange={e => onChange({ ...condition, value: e.target.value })}
          style={{ flex: 1, padding: '5px 6px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }}>
          <option value="">Value...</option>
          {valueOptions.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      )}
      <button onClick={onRemove}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14, padding: '0 4px', opacity: 0.6 }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}>
        ×
      </button>
    </div>
  );
}

function CompactFilterBuilder({ rule, allPeople, onChange, readOnly }: {
  rule: RuleGroup;
  allPeople: Person[];
  onChange: (rule: RuleGroup) => void;
  readOnly?: boolean;
}) {
  const conditions = rule.children.filter(c => c.type === 'condition') as RuleCondition[];

  if (readOnly) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {conditions.map((c, i) => (
          <CompactFilterRow key={i} condition={c} allPeople={allPeople} onChange={() => {}} onRemove={() => {}} readOnly />
        ))}
      </div>
    );
  }

  return (
    <div>
      {rule.children.map((child, i) => {
        if (child.type !== 'condition') return null;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 36, fontSize: 12, fontWeight: 600, color: C.textSecondary, textAlign: 'right', flexShrink: 0 }}>
              {i === 0 ? 'Where' : rule.combinator}
            </span>
            <CompactFilterRow
              condition={child}
              allPeople={allPeople}
              onChange={updated => {
                const next = [...rule.children];
                next[i] = updated;
                onChange({ ...rule, children: next });
              }}
              onRemove={() => onChange({ ...rule, children: rule.children.filter((_, idx) => idx !== i) })}
            />
          </div>
        );
      })}
      <button
        onClick={() => onChange({ ...rule, children: [...rule.children, { type: 'condition', field: '', operator: 'is', value: '' } as RuleCondition] })}
        style={{
          marginTop: 4, background: 'none', border: `1px solid ${C.border}`,
          borderRadius: 6, padding: '5px 12px', fontSize: 13, fontWeight: 600,
          color: C.accent, cursor: 'pointer', fontFamily: FONT,
        }}
      >
        + Add condition
      </button>
    </div>
  );
}

// ── Group Definition Card (focused create-mode container) ────────────────────

function GroupDefinitionCard({ rule, allPeople, layers, members, hasValid, previewReady, onRuleChange, onEditCommand, onApplyAdjustment, savedGroups, onSelectGroup, expanded, disclosureVariant = 'accordion' }: {
  rule: RuleGroup;
  allPeople: Person[];
  layers: EvaluationLayer[];
  members: Person[];
  hasValid: boolean;
  previewReady: boolean;
  onRuleChange: (rule: RuleGroup) => void;
  onEditCommand: (text: string) => void;
  onApplyAdjustment: (condition: RuleCondition) => void;
  savedGroups: SavedGroup[];
  onSelectGroup: (g: SavedGroup) => void;
  expanded?: boolean;
  disclosureVariant?: DisclosureVariant;
}) {
  const [conditionsEditing, setConditionsEditing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'members' | 'layers' | 'policies'>('members');

  const excludedByLayers = useMemo(() => getExcludedByLayers(allPeople, rule, layers), [allPeople, rule, layers]);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const conditions = rule.children.filter(c => c.type === 'condition') as RuleCondition[];
  const hasConditions = conditions.some(c => c.field && c.value);

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      background: C.surface,
    }}>
      {/* NL input — always visible, primary editing surface */}
      <div style={{ padding: '12px 14px', borderBottom: hasConditions ? `1px solid ${C.border}` : 'none', position: 'relative', zIndex: 10 }}>
        <NLEntryPoint
          people={allPeople}
          savedGroups={savedGroups}
          onSelectGroup={onSelectGroup}
          onCreateFromConditions={conds => {
            onRuleChange({ type: 'group', combinator: 'AND', children: conds });
          }}
          onEditCommand={onEditCommand}
          currentRule={rule}
          placeholder='Describe who: "engineers in SF", "remove contractors"'
        />
      </div>

      {/* Conditions section — pills by default, dropdowns on edit */}
      {hasConditions && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Conditions
            </span>
            <button
              onClick={() => setConditionsEditing(!conditionsEditing)}
              style={{
                background: 'none', border: 'none', color: C.accent,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, padding: 0,
              }}
            >
              {conditionsEditing ? 'Done' : 'Edit'}
            </button>
          </div>
          {conditionsEditing ? (
            <CompactFilterBuilder rule={rule} allPeople={allPeople} onChange={onRuleChange} />
          ) : (
            <CompactFilterBuilder rule={rule} allPeople={allPeople} onChange={onRuleChange} readOnly />
          )}
        </div>
      )}

      {/* Preview summary — collapsed by default, opens DisclosurePanel */}
      {hasConditions && (
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none',
              cursor: 'pointer', fontFamily: FONT, padding: 0, textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {members.length} {members.length === 1 ? 'person' : 'people'}
              </span>
              {totalExcluded > 0 && (
                <span style={{
                  fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight,
                  borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125,
                }}>
                  {totalExcluded} excluded
                </span>
              )}
              <div style={{ display: 'flex', alignItems: 'center', marginLeft: 4 }}>
                {members.slice(0, 4).map((p, i) => (
                  <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 4 - i, position: 'relative' }}>
                    <Avatar name={p.name} size={20} />
                  </div>
                ))}
                {members.length > 4 && (
                  <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 4 }}>+{members.length - 4}</span>
                )}
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.accent }}>
              {previewOpen ? 'Hide' : 'Preview'}
            </span>
          </button>
        </div>
      )}

      {/* Disclosure panel for preview — variant determines container; interaction variants fall back to accordion */}
      <DisclosurePanel
        variant={(['sheet', 'slide', 'accordion'] as DisclosureVariant[]).includes(disclosureVariant) ? disclosureVariant : 'accordion'}
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Group preview"
      >
        <DisclosureTabContent
          members={members}
          allPeople={allPeople}
          rule={rule}
          layers={layers}
          excludedByLayers={excludedByLayers}
          consumers={[]}
          compact={!expanded}
          onApplyAdjustment={onApplyAdjustment}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />
      </DisclosurePanel>

      {/* Readiness indicator */}
      <div style={{
        padding: '8px 14px',
        borderTop: hasConditions ? `1px solid ${C.border}` : 'none',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {hasValid && previewReady ? (
          <>
            <span style={{ color: C.green, fontSize: 14, lineHeight: 1 }}>&#10003;</span>
            <span style={{ fontSize: 13, color: C.textSecondary }}>
              Group ready &middot; {members.length} {members.length === 1 ? 'person' : 'people'}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 13, color: C.textMuted }}>
            Describe who should be in this group
          </span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE 4: REIMAGINED HOST FLOW — SIMULATED POLICY BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

function PolicyBuilderShell({ children, policyName, width, variant }: {
  children: React.ReactNode;
  policyName: string;
  width: number;
  variant: 'drawer' | 'expanded';
}) {
  const [step, setStep] = useState(0);
  const steps = ['Plan details', 'Eligibility group', 'Plan options', 'Review'];

  return (
    <div style={{
      width: variant === 'drawer' ? width : '100%',
      maxWidth: variant === 'expanded' ? 1080 : width,
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 14,
      boxShadow: S.deep,
      overflow: 'visible',
      margin: '0 auto',
    }}>
      {/* Policy builder header */}
      <div style={{
        padding: '14px 20px', borderBottom: `1px solid ${C.border}`,
        background: C.surfaceAlt,
        borderRadius: '14px 14px 0 0',
      }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
          Benefits enrollment
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, letterSpacing: -0.25 }}>
          {policyName}
        </div>
      </div>

      {/* Step indicators */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '0 16px', borderBottom: `1px solid ${C.border}`,
      }}>
        {steps.map((s, i) => (
          <button
            key={s}
            onClick={() => setStep(i)}
            style={{
              padding: '10px 14px', background: 'none', border: 'none',
              borderBottom: i === step ? `2px solid ${C.accent}` : '2px solid transparent',
              fontSize: 13, fontWeight: i === step ? 600 : 400,
              color: i === step ? C.accent : C.textMuted,
              cursor: 'pointer', fontFamily: FONT,
              transition: 'all 0.1s',
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ padding: variant === 'expanded' ? '20px 24px' : '16px 20px', background: C.surface, borderRadius: '0 0 14px 14px' }}>
        {step === 0 && (
          <div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
              Configure the basics of your benefits plan. Name, effective date, and plan type.
            </div>
            <div style={{ padding: '20px', background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Plan name</label>
              <input type="text" defaultValue={policyName} readOnly style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface, boxSizing: 'border-box' }} />
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Effective date</label>
                <input type="date" defaultValue="2026-05-01" style={{ padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface }} />
              </div>
            </div>
            <button onClick={() => setStep(1)} style={{
              marginTop: 14, padding: '9px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
            }}>
              Next: Eligibility group →
            </button>
          </div>
        )}
        {step === 1 && (
          <div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 14, lineHeight: 1.5 }}>
              Define who is eligible for this plan. Search for an existing group or create a new one.
            </div>
            {children}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setStep(0)} style={{
                padding: '9px 20px', background: 'transparent', color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer',
              }}>
                ← Back
              </button>
              <button onClick={() => setStep(2)} style={{
                padding: '9px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
              }}>
                Next: Plan options →
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 14 }}>Configure plan options, deductibles, and coverage details.</div>
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}` }}>
              Plan options configuration...
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setStep(1)} style={{ padding: '9px 20px', background: 'transparent', color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer' }}>← Back</button>
              <button onClick={() => setStep(3)} style={{ padding: '9px 20px', background: C.accent, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Next: Review →</button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 14 }}>Review all settings before publishing.</div>
            <div style={{ padding: 40, textAlign: 'center', color: C.textMuted, background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}` }}>
              Review summary...
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setStep(2)} style={{ padding: '9px 20px', background: 'transparent', color: C.textSecondary, border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 14, fontWeight: 500, fontFamily: FONT, cursor: 'pointer' }}>← Back</button>
              <button style={{ padding: '9px 20px', background: C.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: FONT, cursor: 'pointer' }}>Publish plan</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE GROUP EXPERIENCE (used inside the host flow)
// ═══════════════════════════════════════════════════════════════════════════════

function InlineGroupExperience({ data, policyContext, expanded, disclosureVariant = 'accordion' }: {
  data: EntryState['data'];
  policyContext: PolicyRef;
  expanded?: boolean;
  disclosureVariant?: DisclosureVariant;
}) {
  const [selectedGroup, setSelectedGroup] = useState<SavedGroup | null>(null);
  const [mode, setMode] = useState<'search' | 'create' | 'selected'>('search');
  const [rule, setRule] = useState<RuleGroup>({ type: 'group', combinator: 'AND', children: [] });
  const [previewReady, setPreviewReady] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const ruleSnapshot = useMemo(() => JSON.stringify(rule), [rule]);

  useEffect(() => {
    setPreviewReady(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewReady(true), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ruleSnapshot]);

  const layers: EvaluationLayer[] = useMemo(() => [{
    id: 'el-rs', type: 'role_state' as const, label: 'Active employees only',
    description: 'System filter: only active employees included.',
    excludedPeopleIds: data.people.filter(p => p.roleState !== 'active').map(p => p.id),
  }], [data.people]);

  const members = useMemo(() =>
    rule.children.length > 0 ? getMembersForRule(data.people, rule, layers) : [],
    [data.people, rule, layers]);

  const hasValid = rule.children.some(c => c.type === 'condition' && (c as RuleCondition).field && (c as RuleCondition).value);

  const handleSelectGroup = (g: SavedGroup) => {
    setSelectedGroup(g);
    setMode('selected');
  };

  const handleCreateFromConditions = (conditions: RuleCondition[]) => {
    setRule({ type: 'group', combinator: 'AND', children: conditions });
    setMode('create');
  };

  const handleEditCommand = (text: string) => {
    const lower = text.toLowerCase().trim();
    const parsed = parseNL(lower, data.people);
    if (parsed.length > 0) {
      if (/^remove|^exclude/.test(lower)) {
        const newConditions = parsed.map(c => ({ ...c, operator: (c.operator === 'is' ? 'is_not' : c.operator) as RuleCondition['operator'] }));
        setRule(prev => ({ ...prev, children: [...prev.children, ...newConditions] }));
      } else {
        setRule(prev => ({ ...prev, children: [...prev.children, ...parsed] }));
      }
    }
  };

  const handleApplyAdjustment = (condition: RuleCondition) => {
    setRule(prev => ({ ...prev, children: [...prev.children, condition] }));
  };

  if (mode === 'selected' && selectedGroup) {
    return (
      <ExpandableGroupCard
        group={selectedGroup}
        people={data.people}
        expanded={expanded}
        onDeselect={() => { setSelectedGroup(null); setMode('search'); }}
        disclosureVariant={disclosureVariant}
      />
    );
  }

  if (mode === 'create') {
    return (
      <GroupDefinitionCard
        rule={rule}
        allPeople={data.people}
        layers={layers}
        members={members}
        hasValid={hasValid}
        previewReady={previewReady}
        onRuleChange={setRule}
        onEditCommand={handleEditCommand}
        onApplyAdjustment={handleApplyAdjustment}
        savedGroups={data.savedGroups}
        onSelectGroup={handleSelectGroup}
        expanded={expanded}
        disclosureVariant={disclosureVariant}
      />
    );
  }

  return (
    <div>
      <NLEntryPoint
        people={data.people}
        savedGroups={data.savedGroups}
        onSelectGroup={handleSelectGroup}
        onCreateFromConditions={handleCreateFromConditions}
      />

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
          Suggested groups
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {data.savedGroups.filter(g => !g.isLegacy).map(g => (
            <GroupCard key={g.id} group={g} people={data.people} onSelect={() => handleSelectGroup(g)} compact />
          ))}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 10, lineHeight: 1.5 }}>
          Describe who you need above to find a match or create a new group.
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDALONE FULL-SURFACE EXPERIENCE
// ═══════════════════════════════════════════════════════════════════════════════

function StandaloneSurface({ data, scenario }: {
  data: EntryState['data'];
  scenario: EntryState['scenario'];
}) {
  const [rule, setRule] = useState<RuleGroup>({ type: 'group', combinator: 'AND', children: [] });
  const [selectedGroup, setSelectedGroup] = useState<SavedGroup | null>(null);
  const [previewReady, setPreviewReady] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPurpose, setGroupPurpose] = useState('');
  const [saved, setSaved] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const ruleSnapshot = useMemo(() => JSON.stringify(rule), [rule]);

  useEffect(() => {
    setPreviewReady(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setPreviewReady(true), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ruleSnapshot]);

  const existingGroup = useMemo(() => {
    if (scenario.type === 'view' || scenario.type === 'edit') {
      return data.savedGroups.find(g => g.id === (scenario as any).groupId) || null;
    }
    return null;
  }, [scenario, data.savedGroups]);

  useEffect(() => {
    if (existingGroup) {
      setRule(existingGroup.rule);
      setGroupName(existingGroup.name);
      setGroupPurpose(existingGroup.purpose);
    }
  }, [existingGroup]);

  const isViewOnly = scenario.type === 'view';
  const layers: EvaluationLayer[] = existingGroup?.evaluationLayers || [{
    id: 'el-rs', type: 'role_state' as const, label: 'Active employees only',
    description: 'System filter: only active employees included.',
    excludedPeopleIds: data.people.filter(p => p.roleState !== 'active').map(p => p.id),
  }];

  const members = useMemo(() =>
    rule.children.length > 0 ? getMembersForRule(data.people, rule, layers) : [],
    [data.people, rule, layers]);

  const hasValid = rule.children.some(c => c.type === 'condition' && (c as RuleCondition).field && (c as RuleCondition).value);

  const handleSelectGroup = (g: SavedGroup) => {
    setSelectedGroup(g);
    setRule(g.rule);
    setGroupName(g.name);
    setGroupPurpose(g.purpose);
  };

  const handleCreateFromConditions = (conditions: RuleCondition[]) => {
    setRule({ type: 'group', combinator: 'AND', children: conditions });
    setSelectedGroup(null);
  };

  const handleEditCommand = (text: string) => {
    const lower = text.toLowerCase().trim();
    const parsed = parseNL(lower, data.people);
    if (parsed.length > 0) {
      if (/^remove|^exclude/.test(lower)) {
        const newConditions = parsed.map(c => ({ ...c, operator: (c.operator === 'is' ? 'is_not' : c.operator) as RuleCondition['operator'] }));
        setRule(prev => ({ ...prev, children: [...prev.children, ...newConditions] }));
      } else {
        setRule(prev => ({ ...prev, children: [...prev.children, ...parsed] }));
      }
    }
  };

  const handleApplyAdjustment = (condition: RuleCondition) => {
    setRule(prev => ({ ...prev, children: [...prev.children, condition] }));
  };

  if (saved) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 14, color: C.green }}>&#10003;</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: -0.25 }}>
          {scenario.type === 'edit' ? 'Group updated' : 'Group created'}
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary }}>
          "{groupName || 'Untitled group'}" with {members.length} members
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 660, margin: '0 auto' }}>
      {/* View mode: group card at top */}
      {isViewOnly && existingGroup && (
        <div style={{ marginBottom: 16 }}>
          <GroupCard group={existingGroup} people={data.people} />
        </div>
      )}

      {/* Header for view */}
      {isViewOnly && existingGroup && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.text, letterSpacing: -0.25, marginBottom: 4 }}>
            {existingGroup.name}
          </div>
          <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 8 }}>{existingGroup.purpose}</div>
          <div style={{ fontSize: 13, color: C.textMuted, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {existingGroup.owner && <span>Owner: {existingGroup.owner}</span>}
            {existingGroup.productDomain && <span>Domain: {existingGroup.productDomain}</span>}
            <span>Modified {new Date(existingGroup.lastModifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
        </div>
      )}

      {/* NL entry point */}
      {!isViewOnly && (
        <>
          {/* Name + purpose for create */}
          {scenario.type === 'create' && (
            <div style={{
              padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
              borderRadius: 12, boxShadow: S.card, marginBottom: 12,
            }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Group name</label>
                  <input type="text" value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="e.g. US Full-Time Employees"
                    style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 4 }}>Purpose</label>
              <input type="text" value={groupPurpose} onChange={e => setGroupPurpose(e.target.value)} placeholder="What is this group for?"
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <NLEntryPoint
              people={data.people}
              savedGroups={data.savedGroups}
              onSelectGroup={handleSelectGroup}
              onCreateFromConditions={handleCreateFromConditions}
              onEditCommand={rule.children.length > 0 ? handleEditCommand : undefined}
              currentRule={rule}
            />
          </div>
        </>
      )}

      {/* Conditions */}
      {rule.children.length > 0 && (
        <div style={{
          padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: S.card, marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Conditions
          </div>
          <CompactFilterBuilder rule={rule} allPeople={data.people} onChange={setRule} readOnly={isViewOnly} />
        </div>
      )}

      {/* Population preview with bidirectional refinement */}
      {(rule.children.length > 0 || isViewOnly) && (
        <div style={{
          padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: S.card, marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Population
          </div>
          <BidirectionalPreview
            members={members}
            allPeople={data.people}
            rule={rule}
            layers={layers}
            onApplyAdjustment={isViewOnly ? undefined : handleApplyAdjustment}
          />
        </div>
      )}

      {/* Downstream impact */}
      {existingGroup && existingGroup.consumers.length > 0 && (
        <div style={{
          padding: '14px 18px', background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: S.card, marginBottom: 12,
        }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Downstream policies
          </div>
          {existingGroup.consumers.map(p => {
            const pc = tierColor(p.sensitivityTier);
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 14 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                  background: pc.bg, color: pc.text, textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {tierLabel(p.sensitivityTier)}
                </span>
                <span style={{ fontWeight: 500, color: C.text }}>{p.name}</span>
                <span style={{ color: C.textSecondary, marginLeft: 'auto', fontSize: 13 }}>{p.domain}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Save gate */}
      {!isViewOnly && (
        <button
          onClick={() => setSaved(true)}
          disabled={!hasValid || !previewReady}
          style={{
            width: '100%', padding: '10px 16px',
            background: hasValid && previewReady ? C.accent : C.textMuted,
            color: '#fff', border: 'none', borderRadius: 6,
            fontSize: 14, fontWeight: 600, fontFamily: FONT,
            cursor: hasValid && previewReady ? 'pointer' : 'default',
            opacity: hasValid && previewReady ? 1 : 0.5,
          }}
        >
          {scenario.type === 'edit' ? 'Save changes' : 'Create group'}
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HUD — MODE/VARIANT SWITCHER
// ═══════════════════════════════════════════════════════════════════════════════

type ViewMode = 'drawer' | 'expanded' | 'standalone';
type ScenarioMode = 'create' | 'view' | 'edit' | 'inline-select';

function HUD({ viewMode, setViewMode, scenarioMode, setScenarioMode, disclosureVariant, setDisclosureVariant }: {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  scenarioMode: ScenarioMode;
  setScenarioMode: (s: ScenarioMode) => void;
  disclosureVariant: DisclosureVariant;
  setDisclosureVariant: (v: DisclosureVariant) => void;
}) {
  const hudBtnStyle = (active: boolean) => ({
    padding: '4px 10px' as const, borderRadius: 9999,
    border: 'none' as const, fontSize: 12, fontWeight: 600 as const, fontFamily: FONT, cursor: 'pointer' as const,
    background: active ? 'rgba(255,255,255,0.2)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.5)',
    transition: 'all 0.1s',
  });

  const hudLabel = { fontSize: 10, fontWeight: 600 as const, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginRight: 4 };

  return (
    <div style={{
      position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)',
      background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(12px)',
      borderRadius: 14, padding: '8px 14px',
      display: 'flex', alignItems: 'center', gap: 16,
      zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
    }}>
      {/* View mode */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={hudLabel}>Surface</span>
        {(['drawer', 'expanded', 'standalone'] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setViewMode(v)} style={hudBtnStyle(viewMode === v)}>
            {v === 'drawer' ? '480px drawer' : v === 'expanded' ? 'Expanded host' : 'Full surface'}
          </button>
        ))}
      </div>

      {/* Disclosure variant — only for embedded modes */}
      {viewMode !== 'standalone' && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={hudLabel}>Container</span>
            {(['sheet', 'slide', 'accordion', 'spatial', 'conversational'] as DisclosureVariant[]).map(v => (
              <button key={v} onClick={() => setDisclosureVariant(v)} style={hudBtnStyle(disclosureVariant === v)}>
                {v === 'sheet' ? 'Sheet' : v === 'slide' ? 'Drawer' : v === 'accordion' ? 'Accordion' : v === 'spatial' ? 'Spatial' : 'Convo'}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Scenario — only relevant for standalone/full-surface */}
      {viewMode === 'standalone' && (
        <>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={hudLabel}>Scenario</span>
            {(['create', 'view', 'edit'] as ScenarioMode[]).map(s => (
              <button key={s} onClick={() => setScenarioMode(s)} style={hudBtnStyle(scenarioMode === s)}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ConceptF({ entryState }: { entryState: EntryState }) {
  const data = useMemo(() => buildExtendedData(entryState.data), [entryState.data]);

  const initialScenario: ScenarioMode = entryState.scenario.type === 'inline-select' ? 'inline-select' : entryState.scenario.type as ScenarioMode;
  const initialView: ViewMode = entryState.context === 'inline' ? 'drawer' : 'standalone';

  const [viewMode, setViewModeRaw] = useState<ViewMode>(initialView);
  const [scenarioMode, setScenarioMode] = useState<ScenarioMode>(initialScenario);
  const [disclosureVariant, setDisclosureVariant] = useState<DisclosureVariant>('sheet');

  const setViewMode = (v: ViewMode) => {
    setViewModeRaw(v);
    if (v !== 'standalone') setScenarioMode('inline-select');
  };

  const policyContext: PolicyRef = data.policies[1]; // California Benefits

  const scenario: EntryState['scenario'] = useMemo(() => {
    switch (scenarioMode) {
      case 'create': return { type: 'create', policyContext };
      case 'view': return { type: 'view', groupId: 'sg-1' };
      case 'edit': return { type: 'edit', groupId: 'sg-1' };
      case 'inline-select': return { type: 'inline-select', policyContext };
    }
  }, [scenarioMode, policyContext]);

  const content = useMemo(() => {
    if (viewMode === 'standalone') {
      return (
        <div style={{ padding: 24, minHeight: '100vh', background: C.surfaceAlt }}>
          <StandaloneSurface data={data} scenario={scenario} />
        </div>
      );
    }

    const isExpanded = viewMode === 'expanded';

    return (
      <div style={{
        padding: isExpanded ? '32px 24px' : '24px 16px',
        minHeight: '100vh',
        background: '#e8e6e3',
        display: 'flex',
        justifyContent: 'center',
        alignItems: isExpanded ? 'flex-start' : 'flex-start',
        paddingTop: 40,
      }}>
        <PolicyBuilderShell
          policyName="California Health Plan"
          width={480}
          variant={isExpanded ? 'expanded' : 'drawer'}
        >
          <InlineGroupExperience
            data={data}
            policyContext={policyContext}
            expanded={isExpanded}
            disclosureVariant={disclosureVariant}
          />
        </PolicyBuilderShell>
      </div>
    );
  }, [viewMode, data, scenario, policyContext, disclosureVariant]);

  return (
    <div style={{ fontFamily: FONT, color: C.text, fontSize: 14, lineHeight: 1.5 }}>
      {content}
      <HUD
        viewMode={viewMode}
        setViewMode={setViewMode}
        scenarioMode={scenarioMode}
        setScenarioMode={setScenarioMode}
        disclosureVariant={disclosureVariant}
        setDisclosureVariant={setDisclosureVariant}
      />
    </div>
  );
}

import React, { useState, useMemo, useRef, useEffect, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
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
import BottomPillNav, { type BottomPillTabSpec } from './bottom-pill-nav';

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
  { id: 'pf01', name: 'Liam Park', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-04-10', title: 'Staff Engineer', entity: 'US Corp' },
  { id: 'pf02', name: 'Nora Eriksson', department: 'Sales', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-07-05', title: 'Account Executive', entity: 'US Corp' },
  { id: 'pf03', name: 'Gabriel Costa', department: 'Finance', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-01-15', title: 'Senior Financial Analyst', entity: 'US Corp' },
  { id: 'pf04', name: 'Haruki Sato', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'contractor', roleState: 'active', startDate: '2024-06-01', title: 'Backend Engineer', entity: 'UK Ltd' },
  { id: 'pf05', name: 'Camille Dubois', department: 'Marketing', location: 'Dublin', country: 'IE', employmentType: 'full_time', roleState: 'active', startDate: '2023-09-18', title: 'Content Lead', entity: 'Ireland Ltd' },
  { id: 'pf06', name: 'Winston Brooks', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-11-01', title: 'HR Business Partner', entity: 'US Corp' },
  { id: 'pf07', name: 'Diana Petrova', department: 'Legal', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-02-28', title: 'Senior Counsel', entity: 'US Corp' },
  { id: 'pf08', name: 'Oscar Nilsson', department: 'Operations', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-05-22', title: 'Operations Manager', entity: 'US Corp' },
  { id: 'pf09', name: 'Mei-Ling Wu', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-08-12', title: 'Frontend Engineer', entity: 'US Corp' },
  { id: 'pf10', name: 'Santiago Reyes', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-10-30', title: 'Sales Engineer', entity: 'US Corp' },
  { id: 'pf11', name: 'Anya Volkov', department: 'Finance', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2024-03-15', title: 'Financial Controller', entity: 'UK Ltd' },
  { id: 'pf12', name: 'Tariq Hasan', department: 'Engineering', location: 'Dublin', country: 'IE', employmentType: 'contractor', roleState: 'active', startDate: '2024-09-01', title: 'Platform Engineer', entity: 'Ireland Ltd' },
  { id: 'pf13', name: 'Emily Zhao', department: 'Marketing', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-12-05', title: 'Growth Manager', entity: 'US Corp' },
  { id: 'pf14', name: 'Kofi Asante', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2023-08-14', title: 'Engineering Manager', entity: 'UK Ltd' },
  { id: 'pf15', name: 'Rebecca Liu', department: 'HR', location: 'New York', country: 'US', employmentType: 'part_time', roleState: 'active', startDate: '2024-04-01', title: 'Recruiter', entity: 'US Corp' },
  { id: 'pf16', name: 'Lukas Brandt', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'contractor', roleState: 'pending', startDate: '2026-03-10', title: 'ML Engineer', entity: 'UK Ltd' },
  { id: 'pf17', name: 'Yolanda Mensah', department: 'Sales', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2024-05-20', title: 'Enterprise Account Manager', entity: 'UK Ltd' },
  { id: 'pf18', name: 'Kevin Pham', department: 'Operations', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-06-07', title: 'IT Operations Lead', entity: 'US Corp' },
  { id: 'pf19', name: 'Isabelle Fournier', department: 'Legal', location: 'Cork', country: 'IE', employmentType: 'full_time', roleState: 'active', startDate: '2024-07-22', title: 'Legal Operations Manager', entity: 'Ireland Ltd' },
  { id: 'pf20', name: 'Omar Farouk', department: 'Finance', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'pending', startDate: '2026-03-25', title: 'Treasury Analyst', entity: 'US Corp' },
  { id: 'pf21', name: 'Grace Okonkwo', department: 'Engineering', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-10-14', title: 'Security Engineer', entity: 'US Corp' },
  { id: 'pf22', name: 'Felix Bauer', department: 'Marketing', location: 'Dublin', country: 'IE', employmentType: 'part_time', roleState: 'active', startDate: '2024-11-01', title: 'Brand Designer', entity: 'Ireland Ltd' },
  { id: 'pf23', name: 'Linda Nakamura', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-02-15', title: 'HR Director', entity: 'US Corp' },
  { id: 'pf24', name: 'Marco Valenti', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'contractor', roleState: 'active', startDate: '2025-01-06', title: 'Solutions Consultant', entity: 'US Corp' },
  { id: 'pf25', name: 'Signe Lindqvist', department: 'Finance', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-04-10', title: 'VP Finance', entity: 'UK Ltd' },
  { id: 'pf26', name: 'Zara Ahmed', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2026-03-20', title: 'Software Engineer', entity: 'US Corp' },
  { id: 'pf27', name: 'Tomás Silva', department: 'Sales', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2026-03-28', title: 'Account Manager', entity: 'US Corp' },
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

// A draft condition (no field or no value yet) is skipped during evaluation so
// the live preview holds its prior valid population while the user is mid-edit.
function isCompleteCondition(c: RuleCondition): boolean {
  if (!c.field) return false;
  if (Array.isArray(c.value)) return c.value.length > 0;
  return c.value !== '' && c.value !== undefined && c.value !== null;
}

function evaluateRule(person: Person, rule: RuleNode): boolean {
  if (rule.type === 'condition') {
    if (!isCompleteCondition(rule)) return true;
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
  const completeChildren = rule.children.filter(c =>
    c.type === 'group' ? true : isCompleteCondition(c as RuleCondition)
  );
  if (completeChildren.length === 0) return true;
  const results = completeChildren.map(c => evaluateRule(person, c));
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

type OrgMode = 'standard' | 'multi-entity';
const ENTITY_ORDER = ['US Corp', 'UK Ltd', 'Ireland Ltd'];

const OrgModeContext = React.createContext<{ orgMode: OrgMode; context: 'standalone' | 'inline' }>({
  orgMode: 'standard',
  context: 'standalone',
});

const GroupValidityContext = React.createContext<{
  isValid: boolean;
  setValid: (v: boolean) => void;
}>({
  isValid: false,
  setValid: () => {},
});

function groupByEntity(members: Person[]): { entity: string; people: Person[] }[] {
  const buckets = new Map<string, Person[]>();
  for (const p of members) {
    const key = p.entity ?? 'Unassigned';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  const ordered: { entity: string; people: Person[] }[] = [];
  for (const e of ENTITY_ORDER) {
    if (buckets.has(e)) ordered.push({ entity: e, people: buckets.get(e)! });
  }
  for (const k of buckets.keys()) {
    if (!ENTITY_ORDER.includes(k)) ordered.push({ entity: k, people: buckets.get(k)! });
  }
  return ordered;
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
  const { orgMode } = React.useContext(OrgModeContext);
  const members = useMemo(() => getMembersForRule(people, group.rule, group.evaluationLayers), [people, group]);
  const excludedByLayers = useMemo(() => getExcludedByLayers(people, group.rule, group.evaluationLayers), [people, group]);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);
  const { text: summaryText, overflow } = useMemo(() => ruleToCompactSummary(group.rule), [group.rule]);
  const entityBreakdown = useMemo(() => groupByEntity(members), [members]);

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

      {/* Entity breakdown (multi-entity mode only) */}
      {orgMode === 'multi-entity' && members.length > 0 && (
        <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>
          <span style={{ color: C.textSecondary }}>{members.length} people</span>
          {entityBreakdown.map(({ entity, people: ep }) => (
            <span key={entity}> · {entity} {ep.length}</span>
          ))}
        </div>
      )}

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

type DisclosureVariant = 'sheet' | 'slide' | 'accordion' | 'spatial' | 'conversational' | 'sections' | 'overlay' | 'bottomNav';

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
function DisclosureTabContent({ members, allPeople, rule, layers, excludedByLayers, consumers, compact, onApplyAdjustment, activeTab, setActiveTab, conditions, groupOwner, groupDomain, lastEvaluatedAt, hideTabs }: {
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
  hideTabs?: boolean;
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

      {/* Tab switcher — hidden when an outer nav (Left tabs, Right rail) owns section switching */}
      {!hideTabs && (
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
      )}

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

function NLEntryPoint({ people, savedGroups, onSelectGroup, onCreateFromConditions, onEditCommand, currentRule, placeholder, unstyled, autoFocus, inlineResults }: {
  people: Person[];
  savedGroups: SavedGroup[];
  onSelectGroup: (group: SavedGroup) => void;
  onCreateFromConditions: (conditions: RuleCondition[]) => void;
  onEditCommand?: (text: string) => void;
  currentRule?: RuleGroup;
  placeholder?: string;
  unstyled?: boolean;
  autoFocus?: boolean;
  inlineResults?: boolean;
}) {
  const { orgMode, context } = React.useContext(OrgModeContext);
  const showScopeLine = orgMode === 'multi-entity' && context !== 'inline';
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matchingGroups = useMemo(() => searchSavedGroups(query, savedGroups), [query, savedGroups]);
  const parsedConditions = useMemo(() => query.length > 2 ? parseNL(query, people) : [], [query, people]);

  const isEditing = !!currentRule && currentRule.children.length > 0;
  const isEditCommand = isEditing && /^(add|remove|exclude|include|why is|why does)/.test(query.toLowerCase().trim());
  const showResults = (inlineResults || focused) && query.length > 1 && (matchingGroups.length > 0 || parsedConditions.length > 0 || isEditCommand);

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

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={unstyled ? {
        display: 'flex', alignItems: 'center', gap: 10,
        padding: 0, background: 'transparent',
      } : {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        border: `1.5px solid ${focused ? C.accent : C.border}`,
        borderRadius: 10,
        background: C.surface,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: focused ? `0 0 0 3px rgba(0,117,222,0.08)` : 'none',
      }}>
        <svg width={unstyled ? 18 : 16} height={unstyled ? 18 : 16} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: C.textMuted }}>
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
            flex: 1, border: 'none', outline: 'none',
            fontSize: unstyled ? 15 : 14,
            fontFamily: FONT, color: C.text, background: 'transparent',
            padding: unstyled ? '4px 0' : 0,
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

      {/* Entity scope line (multi-entity, non-inline only) */}
      {showScopeLine && (
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>
          Matching across all 3 entities · US Corp, UK Ltd, Ireland Ltd
        </div>
      )}

      {/* Results — dropdown when chrome, inline flow when embedded in a surface */}
      {showResults && (
        <div style={inlineResults ? {
          marginTop: 10,
          padding: 0,
        } : {
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: S.deep, zIndex: 50,
          maxHeight: 360, overflow: 'auto', padding: 6,
        }}>
          {/* Matching saved groups */}
          {matchingGroups.length > 0 && (
            <div style={{ padding: inlineResults ? '0' : '4px 8px 8px' }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: C.textMuted,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
                padding: inlineResults ? '0 2px' : '0',
              }}>
                {matchingGroups.length === 1 ? 'Matching group' : `${matchingGroups.length} matching groups`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: inlineResults ? 4 : 0 }}>
                {matchingGroups.map(g => (
                  <button
                    key={g.id}
                    onClick={() => { onSelectGroup(g); setQuery(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      width: '100%',
                      padding: inlineResults ? '10px 12px' : '8px 10px',
                      border: inlineResults ? `1px solid ${C.border}` : 'none',
                      borderRadius: inlineResults ? 10 : 8,
                      background: inlineResults ? C.surface : 'transparent',
                      cursor: 'pointer',
                      fontFamily: FONT, textAlign: 'left',
                      transition: 'background 0.1s, border-color 0.1s',
                    }}
                    onMouseEnter={e => {
                      if (inlineResults) {
                        (e.currentTarget as HTMLElement).style.borderColor = C.accentBorder;
                        (e.currentTarget as HTMLElement).style.background = C.accentLight;
                      } else {
                        (e.currentTarget as HTMLElement).style.background = C.surfaceAlt;
                      }
                    }}
                    onMouseLeave={e => {
                      if (inlineResults) {
                        (e.currentTarget as HTMLElement).style.borderColor = C.border;
                        (e.currentTarget as HTMLElement).style.background = C.surface;
                      } else {
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }
                    }}
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
            </div>
          )}

          {/* Divider */}
          {matchingGroups.length > 0 && parsedConditions.length > 0 && (
            <div style={{
              borderTop: `1px solid ${inlineResults ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.06)'}`,
              margin: inlineResults ? '14px 2px' : '2px 8px',
            }} />
          )}

          {/* Generated conditions */}
          {parsedConditions.length > 0 && !isEditCommand && (
            <div style={{ padding: inlineResults ? '0' : '4px 8px 8px' }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: C.textMuted,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
                padding: inlineResults ? '0 2px' : '0',
              }}>
                {inlineResults ? 'Or create new with' : 'Create from conditions'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: inlineResults ? 10 : 8 }}>
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
                  borderRadius: inlineResults ? 9999 : 6,
                  padding: inlineResults ? '7px 14px' : '6px 14px',
                  fontSize: 13, fontWeight: 600,
                  fontFamily: FONT, cursor: 'pointer',
                }}
              >
                Create new group
              </button>
            </div>
          )}

          {/* Edit command */}
          {isEditCommand && onEditCommand && (
            <div style={{ padding: inlineResults ? '0' : '4px 8px 8px' }}>
              <div style={{
                fontSize: 11, fontWeight: 600, color: C.textMuted,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
                padding: inlineResults ? '0 2px' : '0',
              }}>
                Refine
              </div>
              <button
                onClick={() => { onEditCommand(query); setQuery(''); }}
                style={{
                  background: C.accent, color: '#fff', border: 'none',
                  borderRadius: inlineResults ? 9999 : 6,
                  padding: inlineResults ? '7px 14px' : '6px 14px',
                  fontSize: 13, fontWeight: 600,
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
  const { orgMode } = React.useContext(OrgModeContext);
  const showEntityBadges = orgMode === 'multi-entity';

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [page, setPage] = useState(0);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const PAGE_SIZE = compact ? 5 : 8;

  const entityBreakdown = useMemo(() => groupByEntity(members), [members]);
  const showEntityTabs = orgMode === 'multi-entity' && entityBreakdown.length > 1;
  const visibleMembers = useMemo(
    () => (showEntityTabs && entityFilter !== 'all' ? members.filter(m => m.entity === entityFilter) : members),
    [members, showEntityTabs, entityFilter],
  );
  const total = members.length;
  const visibleTotal = visibleMembers.length;

  useEffect(() => { setPage(0); }, [entityFilter]);
  // Reset filter to 'all' when multi-entity is turned off so the count stays correct
  useEffect(() => { if (!showEntityTabs) setEntityFilter('all'); }, [showEntityTabs]);

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

      {/* Entity filter tabs — multi-entity, non-inline only */}
      {showEntityTabs && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
          {[{ key: 'all', label: 'All', count: total }, ...entityBreakdown.map(g => ({ key: g.entity, label: g.entity, count: g.people.length }))].map(t => {
            const active = entityFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setEntityFilter(t.key)}
                style={{
                  padding: '4px 10px', borderRadius: 9999, border: `1px solid ${active ? C.accentBorder : 'transparent'}`,
                  fontSize: 12, fontWeight: 500, fontFamily: FONT, cursor: 'pointer',
                  background: active ? C.accentLight : 'transparent',
                  color: active ? C.accent : C.textSecondary,
                  transition: 'all 0.1s',
                }}
              >
                {t.label} ({t.count})
              </button>
            );
          })}
        </div>
      )}

      {/* Person list — clickable for bidirectional refinement */}
      {visibleMembers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(p => (
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
              {showEntityBadges && p.entity && (
                <span style={{
                  fontSize: 11, fontWeight: 500, color: C.textSecondary,
                  background: C.surfaceAlt, borderRadius: 9999, padding: '1px 7px',
                }}>
                  {p.entity}
                </span>
              )}
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
      {visibleTotal > PAGE_SIZE && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
          <span style={{ fontSize: 13, color: C.textSecondary }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, visibleTotal)} of {visibleTotal}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 500, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 4, background: 'transparent', cursor: page === 0 ? 'default' : 'pointer', color: C.textSecondary, opacity: page === 0 ? 0.4 : 1 }}>
              Prev
            </button>
            <button disabled={(page + 1) * PAGE_SIZE >= visibleTotal} onClick={() => setPage(p => p + 1)}
              style={{ padding: '3px 10px', fontSize: 12, fontWeight: 500, fontFamily: FONT, border: `1px solid ${C.border}`, borderRadius: 4, background: 'transparent', cursor: (page + 1) * PAGE_SIZE >= visibleTotal ? 'default' : 'pointer', color: C.textSecondary, opacity: (page + 1) * PAGE_SIZE >= visibleTotal ? 0.4 : 1 }}>
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

  if (disclosureVariant === 'sections') {
    return (
      <GroupDefinitionSectionsLayout
        rule={rule}
        allPeople={allPeople}
        layers={layers}
        members={members}
        hasValid={hasValid}
        previewReady={previewReady}
        onRuleChange={onRuleChange}
        onEditCommand={onEditCommand}
        onApplyAdjustment={onApplyAdjustment}
        savedGroups={savedGroups}
        onSelectGroup={onSelectGroup}
        expanded={expanded}
        excludedByLayers={excludedByLayers}
        totalExcluded={totalExcluded}
        conditions={conditions}
        hasConditions={hasConditions}
        conditionsEditing={conditionsEditing}
        setConditionsEditing={setConditionsEditing}
      />
    );
  }

  if (disclosureVariant === 'overlay') {
    return (
      <GroupDefinitionOverlayLayout
        rule={rule}
        allPeople={allPeople}
        layers={layers}
        members={members}
        hasValid={hasValid}
        previewReady={previewReady}
        onRuleChange={onRuleChange}
        onEditCommand={onEditCommand}
        onApplyAdjustment={onApplyAdjustment}
        savedGroups={savedGroups}
        onSelectGroup={onSelectGroup}
        expanded={expanded}
        excludedByLayers={excludedByLayers}
        totalExcluded={totalExcluded}
        conditions={conditions}
        hasConditions={hasConditions}
        conditionsEditing={conditionsEditing}
        setConditionsEditing={setConditionsEditing}
      />
    );
  }

  if (disclosureVariant === 'bottomNav') {
    return (
      <GroupDefinitionBottomNavLayout
        rule={rule}
        allPeople={allPeople}
        layers={layers}
        members={members}
        hasValid={hasValid}
        previewReady={previewReady}
        onRuleChange={onRuleChange}
        onEditCommand={onEditCommand}
        onApplyAdjustment={onApplyAdjustment}
        savedGroups={savedGroups}
        onSelectGroup={onSelectGroup}
        expanded={expanded}
        excludedByLayers={excludedByLayers}
        totalExcluded={totalExcluded}
        conditions={conditions}
        hasConditions={hasConditions}
        conditionsEditing={conditionsEditing}
        setConditionsEditing={setConditionsEditing}
      />
    );
  }

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

      {/* Preview summary — collapsed by default, opens DisclosurePanel.
          Hidden for conversational (query bar is always-visible below). */}
      {hasConditions && disclosureVariant !== 'conversational' && (
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

      {/* Preview surface — container variant determines how impact is revealed.
          sheet/slide/accordion → DisclosurePanel (gated by previewOpen)
          spatial               → inline depth-explorer (gated by previewOpen)
          conversational        → inline query lens (always visible) */}
      {(['sheet', 'slide', 'accordion'] as DisclosureVariant[]).includes(disclosureVariant) && (
        <DisclosurePanel
          variant={disclosureVariant as 'sheet' | 'slide' | 'accordion'}
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
      )}

      {disclosureVariant === 'spatial' && hasConditions && previewOpen && (
        <LiveSpatialPreview
          rule={rule}
          layers={layers}
          members={members}
          excludedByLayers={excludedByLayers}
          totalExcluded={totalExcluded}
        />
      )}

      {disclosureVariant === 'conversational' && hasConditions && (
        <LiveConvoPreview
          rule={rule}
          layers={layers}
          members={members}
          excludedByLayers={excludedByLayers}
          totalExcluded={totalExcluded}
        />
      )}

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
// LIVE PREVIEWS — Spatial & Conversational adapted for in-progress authoring
// ═══════════════════════════════════════════════════════════════════════════════

function LiveSpatialPreview({ rule, layers, members, excludedByLayers, totalExcluded }: {
  rule: RuleGroup;
  layers: EvaluationLayer[];
  members: Person[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  totalExcluded: number;
}) {
  type Depth = 'summary' | 'members' | 'layers' | 'person';
  const [depth, setDepth] = useState<Depth>('summary');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (depth === 'person') { setDepth('members'); setSelectedPerson(null); }
      else if (depth !== 'summary') setDepth('summary');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [depth]);

  const explanation = useMemo(() =>
    selectedPerson ? explainPerson(selectedPerson, rule, layers) : null,
    [selectedPerson, rule, layers]);

  const breadcrumb: { label: string; action: () => void }[] = [
    { label: 'Preview', action: () => { setDepth('summary'); setSelectedPerson(null); } },
  ];
  if (depth === 'members' || depth === 'person') breadcrumb.push({ label: 'Members', action: () => { setDepth('members'); setSelectedPerson(null); } });
  if (depth === 'layers') breadcrumb.push({ label: 'System filters', action: () => {} });
  if (depth === 'person' && selectedPerson) breadcrumb.push({ label: selectedPerson.name, action: () => {} });

  return (
    <div style={{
      borderBottom: `1px solid ${C.border}`,
      background: C.surfaceAlt,
      height: depth === 'summary' ? 'auto' : 320,
      overflow: 'hidden',
      transition: 'height 0.25s ease',
      display: 'flex', flexDirection: 'column',
    }}>
      {depth !== 'summary' && (
        <div style={{
          padding: '8px 14px', borderBottom: `1px solid ${C.border}`,
          fontSize: 12, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4,
          flexShrink: 0, background: C.surface,
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

      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* SUMMARY — tappable row */}
        <div style={{
          position: depth === 'summary' ? 'relative' : 'absolute', inset: 0,
          opacity: depth === 'summary' ? 1 : 0,
          transition: 'opacity 0.2s ease',
          pointerEvents: depth === 'summary' ? 'auto' : 'none',
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <button onClick={() => setDepth('members')} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: FONT, padding: 0,
          }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {members.length} {members.length === 1 ? 'person' : 'people'}
            </span>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {members.slice(0, 4).map((p, i) => (
                <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 4 - i, position: 'relative' }}>
                  <Avatar name={p.name} size={22} />
                </div>
              ))}
              {members.length > 4 && <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 6 }}>+{members.length - 4}</span>}
            </div>
          </button>
          {totalExcluded > 0 && (
            <button onClick={() => setDepth('layers')} style={{
              fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight,
              borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125,
              border: 'none', cursor: 'pointer', fontFamily: FONT,
            }}>{totalExcluded} excluded by system filters</button>
          )}
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>Tap to explore</span>
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
          {members.length === 0 ? (
            <div style={{ fontSize: 13, color: C.textMuted, padding: 8 }}>No one matches yet.</div>
          ) : members.map(p => (
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
  );
}

function LiveConvoPreview({ rule, layers, members, excludedByLayers, totalExcluded }: {
  rule: RuleGroup;
  layers: EvaluationLayer[];
  members: Person[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  totalExcluded: number;
}) {
  const [query, setQuery] = useState('');
  const [activeIntent, setActiveIntent] = useState<InspectionIntent>(null);
  const [selectedPersonName, setSelectedPersonName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allPeople = useMemo(() => [...members, ...excludedByLayers.flatMap(e => e.people)], [members, excludedByLayers]);

  const resolveIntent = useCallback((text: string) => {
    const intent = detectInspection(text);
    // 'policies' intent isn't meaningful during authoring — fall back to members
    const effective: InspectionIntent = intent?.type === 'policies' ? { type: 'members' } : intent;
    setActiveIntent(effective);
    setSelectedPersonName(effective?.type === 'person' ? effective.name : null);
  }, []);

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
    return explainPerson(matchedPerson, rule, layers);
  }, [matchedPerson, rule, layers]);

  const lensLabel = activeIntent?.type === 'members' ? `Members (${members.length})`
    : activeIntent?.type === 'layers' ? `System filters (${totalExcluded} excluded)`
    : activeIntent?.type === 'person' ? (matchedPerson?.name || 'Not found')
    : '';

  return (
    <div style={{ borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
      {/* Default resting summary when no intent active */}
      {!activeIntent && (
        <div style={{
          padding: '10px 14px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          borderBottom: `1px solid ${C.border}`,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {members.length} {members.length === 1 ? 'person' : 'people'}
          </span>
          {totalExcluded > 0 && (
            <span style={{
              fontSize: 11, fontWeight: 600, color: C.amber, background: C.amberLight,
              borderRadius: 9999, padding: '2px 8px', letterSpacing: 0.125,
            }}>{totalExcluded} excluded</span>
          )}
          <span style={{ fontSize: 11, color: C.textMuted, marginLeft: 'auto' }}>Ask below to explore</span>
        </div>
      )}

      {/* Lens result area */}
      {activeIntent && (
        <div style={{ padding: '8px 14px', borderBottom: `1px solid ${C.border}`, maxHeight: 260, overflowY: 'auto' }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: C.accent,
            textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span>{lensLabel}</span>
            <button onClick={clearLens} style={{ background: 'none', border: 'none', color: C.textMuted, fontSize: 14, cursor: 'pointer', fontFamily: FONT, padding: 0, lineHeight: 1 }}>×</button>
          </div>

          {activeIntent.type === 'members' && (
            members.length === 0
              ? <div style={{ fontSize: 13, color: C.textMuted, padding: 4 }}>No one matches yet.</div>
              : members.map(p => (
                <button key={p.id} onClick={() => drillIntoPerson(p.name)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 6px',
                  borderRadius: 6, border: 'none', width: '100%', textAlign: 'left',
                  background: 'transparent', cursor: 'pointer', fontFamily: FONT,
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.surface)}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <Avatar name={p.name} size={22} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: C.textMuted, marginLeft: 'auto' }}>{p.department}</span>
                </button>
              ))
          )}

          {activeIntent.type === 'layers' && (
            excludedByLayers.length === 0 ? (
              <div style={{ fontSize: 13, color: C.textMuted, padding: 4 }}>No system filters active.</div>
            ) : excludedByLayers.map(({ layer, people: exc }) => (
              <div key={layer.id} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{layer.label}</div>
                <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{layer.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {exc.map(p => <span key={p.id} style={{ fontSize: 11, fontWeight: 500, background: C.amberLight, color: C.amber, borderRadius: 9999, padding: '1px 7px' }}>{p.name}</span>)}
                </div>
              </div>
            ))
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
            <div style={{ fontSize: 13, color: C.textMuted, padding: 4 }}>No one named "{activeIntent.name}" found in this group.</div>
          )}
        </div>
      )}

      {/* Query bar — always visible */}
      <div style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, color: C.textMuted, flexShrink: 0 }}>?</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); resolveIntent(e.target.value); }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); resolveIntent(query); } }}
          placeholder='Ask: "who", "excluded", "why is Sarah?"'
          style={{
            flex: 1, border: 'none', outline: 'none', fontSize: 13, fontFamily: FONT,
            background: 'transparent', color: C.text, padding: 0,
          }}
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTAINER VARIANT A — LEFT SECTIONS (segmented destinations)
// ═══════════════════════════════════════════════════════════════════════════════

interface GroupDefinitionLayoutProps {
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
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  totalExcluded: number;
  conditions: RuleCondition[];
  hasConditions: boolean;
  conditionsEditing: boolean;
  setConditionsEditing: (v: boolean) => void;
}

type SectionKey = 'authoring' | 'members' | 'layers' | 'policies';

function GroupDefinitionSectionsLayout(props: GroupDefinitionLayoutProps) {
  const {
    rule, allPeople, layers, members, hasValid, previewReady,
    onRuleChange, onEditCommand, onApplyAdjustment,
    savedGroups, onSelectGroup, expanded,
    excludedByLayers, totalExcluded, conditions, hasConditions,
    conditionsEditing, setConditionsEditing,
  } = props;

  const [section, setSection] = useState<SectionKey>('authoring');

  const sections: { key: SectionKey; label: string; hint: string; count?: number; disabled?: boolean }[] = [
    { key: 'authoring', label: 'Authoring',  hint: 'Rule & conditions' },
    { key: 'members',   label: 'People',     hint: 'Matched members', count: members.length, disabled: !hasConditions },
    { key: 'layers',    label: 'Exclusions', hint: 'System filters',  count: totalExcluded,  disabled: !hasConditions },
    { key: 'policies',  label: 'Policies',   hint: 'Downstream use',  count: 0, disabled: true },
  ];

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      background: C.surface,
      display: 'flex',
      minHeight: 320,
      overflow: 'hidden',
    }}>
      <nav style={{
        flex: '0 0 168px',
        borderRight: `1px solid ${C.border}`,
        background: C.surfaceAlt,
        padding: 8,
        display: 'flex', flexDirection: 'column', gap: 2,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: 0.8,
          padding: '6px 8px 6px',
        }}>
          Sections
        </div>
        {sections.map(s => {
          const active = section === s.key;
          return (
            <button
              key={s.key}
              onClick={() => !s.disabled && setSection(s.key)}
              disabled={s.disabled}
              style={{
                textAlign: 'left',
                padding: '8px 10px',
                border: 'none',
                borderRadius: 8,
                background: active ? C.accentLight : 'transparent',
                color: s.disabled ? C.textMuted : active ? C.accent : C.text,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: active ? 600 : 500,
                cursor: s.disabled ? 'default' : 'pointer',
                opacity: s.disabled ? 0.55 : 1,
                transition: 'background 0.1s, color 0.1s',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span>{s.label}</span>
                {typeof s.count === 'number' && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    color: active ? C.accent : C.textMuted,
                    background: active ? 'rgba(0,117,222,0.12)' : 'rgba(0,0,0,0.06)',
                    borderRadius: 9999, padding: '1px 7px',
                  }}>
                    {s.count}
                  </span>
                )}
              </div>
              <span style={{ fontSize: 11, fontWeight: 500, color: C.textMuted }}>
                {s.hint}
              </span>
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {section === 'authoring' && (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                <CompactFilterBuilder rule={rule} allPeople={allPeople} onChange={onRuleChange} readOnly={!conditionsEditing} />
              </div>
            )}
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
        )}

        {section !== 'authoring' && (
          <DisclosureTabContent
            members={members}
            allPeople={allPeople}
            rule={rule}
            layers={layers}
            excludedByLayers={excludedByLayers}
            consumers={[]}
            compact={!expanded}
            onApplyAdjustment={onApplyAdjustment}
            activeTab={section}
            setActiveTab={() => {}}
            hideTabs
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTAINER VARIANT B — RIGHT RAIL + SLIDE-IN OVERLAY
// ═══════════════════════════════════════════════════════════════════════════════

type OverlayKey = 'members' | 'layers' | 'policies';

function GroupDefinitionOverlayLayout(props: GroupDefinitionLayoutProps) {
  const {
    rule, allPeople, layers, members, hasValid, previewReady,
    onRuleChange, onEditCommand, onApplyAdjustment,
    savedGroups, onSelectGroup, expanded,
    excludedByLayers, totalExcluded, conditions, hasConditions,
    conditionsEditing, setConditionsEditing,
  } = props;

  const [openPanel, setOpenPanel] = useState<OverlayKey | null>(null);

  useEffect(() => {
    if (!openPanel) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenPanel(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openPanel]);

  const railItems: { key: OverlayKey; label: string; count?: number; disabled?: boolean; icon: React.ReactNode; careful?: boolean }[] = [
    {
      key: 'members', label: 'People', count: members.length, disabled: !hasConditions,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="5" r="2.5" />
          <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
          <circle cx="11.5" cy="5.5" r="1.8" />
          <path d="M11.5 9.5c1.8 0 3.2 1.1 3.2 2.8" />
        </svg>
      ),
    },
    {
      key: 'layers', label: 'Exclusions', count: totalExcluded, disabled: !hasConditions || totalExcluded === 0,
      careful: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M4.1 11.9L11.9 4.1" />
        </svg>
      ),
    },
    {
      key: 'policies', label: 'Policies', count: 0, disabled: true,
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-2" />
          <path d="M9 2h5v5" />
          <path d="M14 2L7 9" />
        </svg>
      ),
    },
  ];

  const panelTitle = openPanel === 'members' ? 'People' : openPanel === 'layers' ? 'Exclusions' : openPanel === 'policies' ? 'Policies' : '';
  const panelCareful = openPanel === 'layers';

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      background: C.surface,
      overflow: 'hidden',
      display: 'flex',
      minHeight: 320,
    }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {openPanel ? (
          <>
            <header style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px',
              borderBottom: `1px solid ${C.border}`,
              background: C.surfaceAlt,
              flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{panelTitle}</div>
                {panelCareful && (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 6px',
                    background: C.amberLight, color: C.amber,
                    borderRadius: 9999, textTransform: 'uppercase', letterSpacing: 0.5,
                  }}>
                    Careful
                  </span>
                )}
              </div>
              <button
                onClick={() => setOpenPanel(null)}
                style={{
                  border: 'none', background: 'transparent',
                  cursor: 'pointer', padding: '4px 6px', borderRadius: 6,
                  color: C.accent,
                  fontFamily: FONT, fontSize: 12, fontWeight: 600,
                }}
              >
                ← Back to authoring
              </button>
            </header>
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
              <DisclosureTabContent
                members={members}
                allPeople={allPeople}
                rule={rule}
                layers={layers}
                excludedByLayers={excludedByLayers}
                consumers={[]}
                compact={!expanded}
                onApplyAdjustment={onApplyAdjustment}
                activeTab={openPanel}
                setActiveTab={() => {}}
                hideTabs
              />
            </div>
          </>
        ) : (
          <>
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
                <CompactFilterBuilder rule={rule} allPeople={allPeople} onChange={onRuleChange} readOnly={!conditionsEditing} />
              </div>
            )}

            {hasConditions && (
              <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}` }}>
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
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: C.textMuted }}>
                    Use the rail →
                  </span>
                </div>
              </div>
            )}

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
          </>
        )}
      </div>

      <aside style={{
        flex: '0 0 54px',
        borderLeft: `1px solid ${C.border}`,
        background: C.surfaceAlt,
        display: 'flex', flexDirection: 'column', gap: 4,
        padding: 6,
      }}>
        <div style={{
          fontSize: 9, fontWeight: 700, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: 0.8,
          textAlign: 'center', padding: '2px 0 4px',
        }}>
          Panels
        </div>
        {railItems.map(r => {
          const isOpen = openPanel === r.key;
          const disabled = r.disabled;
          return (
            <button
              key={r.key}
              onClick={() => !disabled && setOpenPanel(prev => prev === r.key ? null : r.key)}
              disabled={disabled}
              title={r.label}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                padding: '7px 4px',
                border: 'none',
                borderRadius: 8,
                background: isOpen ? C.accentLight : 'transparent',
                color: disabled ? C.textMuted : isOpen ? C.accent : C.textSecondary,
                fontFamily: FONT,
                fontSize: 10,
                fontWeight: isOpen ? 600 : 500,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.45 : 1,
                transition: 'background 0.1s, color 0.1s',
                position: 'relative',
              }}
            >
              {r.icon}
              <span>{r.label}</span>
              {typeof r.count === 'number' && (
                <span style={{
                  position: 'absolute', top: 3, right: 3,
                  fontSize: 9, fontWeight: 700, color: '#fff',
                  background: isOpen ? C.accent : C.textMuted,
                  borderRadius: 9999, padding: '0 5px', lineHeight: '14px', minWidth: 14,
                  textAlign: 'center',
                }}>
                  {r.count}
                </span>
              )}
            </button>
          );
        })}
      </aside>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE EDITABLE CHIP — tap any segment to edit in place, no mode switching
// ═══════════════════════════════════════════════════════════════════════════════

type ChipSegment = 'field' | 'operator' | 'value';

interface ChipOption { value: string; label: string; hint?: string }

// Lightweight, accessible popover menu anchored to a segment — replaces the native <select>.
// Keyboard: ↑/↓ navigates, Enter selects, Esc closes, typing filters.
function SegmentMenu({
  anchorRef, options, selected, onSelect, onClose, width,
}: {
  anchorRef: React.RefObject<HTMLElement>;
  options: ChipOption[];
  selected: string;
  onSelect: (value: string) => void;
  onClose: () => void;
  width?: number;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState<number>(() => Math.max(0, options.findIndex(o => o.value === selected)));
  const filtered = useMemo(() =>
    options.filter(o => o.label.toLowerCase().includes(query.toLowerCase())),
    [options, query]
  );

  // Position the menu below the anchor
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 6 });
  }, [anchorRef]);

  // Close on click outside
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t)) return;
      if (anchorRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [onClose, anchorRef]);

  // Keyboard handling
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(filtered.length - 1, i + 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(0, i - 1)); return; }
      if (e.key === 'Home')      { e.preventDefault(); setActiveIdx(0); return; }
      if (e.key === 'End')       { e.preventDefault(); setActiveIdx(filtered.length - 1); return; }
      if (e.key === 'Enter')     {
        e.preventDefault();
        const opt = filtered[activeIdx];
        if (opt) onSelect(opt.value);
        return;
      }
      // Type-to-filter (printable chars)
      if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        setQuery(q => q + e.key);
        setActiveIdx(0);
      } else if (e.key === 'Backspace') {
        setQuery(q => q.slice(0, -1));
        setActiveIdx(0);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [activeIdx, filtered, onClose, onSelect]);

  // Auto-scroll active into view
  useEffect(() => {
    const item = menuRef.current?.querySelector<HTMLButtonElement>(`[data-idx="${activeIdx}"]`);
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const menuContent = (
    <div
      ref={menuRef}
      role="listbox"
      style={{
        position: 'fixed', left: pos.left, top: pos.top,
        minWidth: width ?? 180,
        maxHeight: 280, overflowY: 'auto',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 4px 10px rgba(0,0,0,0.06)',
        padding: 4,
        zIndex: 1000,
        fontFamily: FONT,
        animation: `chipMenuIn 220ms cubic-bezier(0.22, 1, 0.36, 1)`,
        transformOrigin: 'top left',
      }}
    >
      {query && (
        <div style={{
          padding: '4px 10px 6px', fontSize: 11, fontWeight: 600,
          color: C.textMuted, letterSpacing: 0.5, textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontFamily: '"SF Mono","Fira Code",Menlo,monospace',
            fontSize: 10, color: C.text, background: 'rgba(0,0,0,0.04)',
            borderRadius: 4, padding: '1px 5px', border: `1px solid rgba(0,0,0,0.06)`,
            textTransform: 'none', letterSpacing: 0,
          }}>
            {query}
          </span>
          <span>{filtered.length} match{filtered.length === 1 ? '' : 'es'}</span>
        </div>
      )}
      {filtered.length === 0 ? (
        <div style={{ padding: '10px 10px', fontSize: 13, color: C.textMuted }}>No matches.</div>
      ) : filtered.map((opt, i) => {
        const isActive = i === activeIdx;
        const isSelected = opt.value === selected;
        return (
          <button
            key={opt.value}
            data-idx={i}
            role="option"
            aria-selected={isSelected}
            onMouseEnter={() => setActiveIdx(i)}
            onClick={() => onSelect(opt.value)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '7px 10px',
              border: 'none', borderRadius: 6,
              background: isActive ? C.accentLight : 'transparent',
              color: isActive ? C.accent : C.text,
              fontFamily: FONT, fontSize: 13, fontWeight: isSelected ? 600 : 500,
              textAlign: 'left', cursor: 'pointer',
              transition: `background 120ms cubic-bezier(0.22, 1, 0.36, 1), color 120ms cubic-bezier(0.22, 1, 0.36, 1)`,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span>{opt.label}</span>
              {opt.hint && <span style={{ fontSize: 11, color: C.textMuted, fontWeight: 400 }}>{opt.hint}</span>}
            </span>
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: C.accent, flexShrink: 0, marginLeft: 8 }}>
                <path d="M2.5 6.5l2.5 2.5L9.5 3.5" />
              </svg>
            )}
          </button>
        );
      })}
    </div>
  );

  // Portal to document.body so fixed-positioning escapes any ancestor `transform` containing blocks
  if (typeof document === 'undefined') return null;
  return createPortal(menuContent, document.body);
}

function ChevronCaret({ open }: { open: boolean }) {
  return (
    <svg
      width="10" height="10" viewBox="0 0 10 10" fill="none"
      style={{
        transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        transition: `transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)`,
        flexShrink: 0,
        opacity: 0.75,
      }}
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 3.5l3 3 3-3" />
    </svg>
  );
}

function InlineEditableChip({ condition, allPeople, onChange, onRemove }: {
  condition: RuleCondition;
  allPeople: Person[];
  onChange: (c: RuleCondition) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState<ChipSegment | null>(null);
  const [hovered, setHovered] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<HTMLButtonElement>(null);
  const opRef = useRef<HTMLButtonElement>(null);
  const valueRef = useRef<HTMLButtonElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);

  const operators = OPERATOR_OPTIONS[condition.field] || [{ value: 'is' as const, label: 'is' }];
  const valueOptions = useMemo(() => {
    if (!condition.field) return [];
    return getValueOptions(condition.field, allPeople).map(v => ({ value: v, label: formatValue(condition.field, v) }));
  }, [condition.field, allPeople]);
  const opLabel = operators.find(o => o.value === condition.operator)?.label || condition.operator;
  const displayValue = Array.isArray(condition.value)
    ? condition.value.map(v => formatValue(condition.field, v)).join(', ')
    : formatValue(condition.field, condition.value as string);

  const isFreeText = editing === 'value' && (
    condition.field === 'startDate' ||
    (condition.field === 'title' && condition.operator === 'contains')
  );

  // Focus the free-text input when it mounts
  useLayoutEffect(() => {
    if (isFreeText) valueInputRef.current?.focus();
  }, [isFreeText]);

  // Segment pill styling — a soft background capsule signaling WHICH segment is being edited
  const segmentPill = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: active ? '3px 8px' : '3px 2px',
    borderRadius: 9999,
    background: active ? C.surface : 'transparent',
    boxShadow: active ? '0 1px 3px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,117,222,0.25)' : 'none',
    transition: `background 180ms cubic-bezier(0.22,1,0.36,1), padding 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms cubic-bezier(0.22,1,0.36,1)`,
  });

  // Soften non-editing segments when one is active, so the eye focuses on the active one
  const fade = (selfActive: boolean): number =>
    editing && !selfActive ? 0.45 : 1;

  const segBtnStyle = (selfActive: boolean, emphasis: 'strong' | 'muted'): React.CSSProperties => ({
    background: 'none', border: 'none', padding: 0, margin: 0,
    fontFamily: FONT, fontSize: 13,
    fontWeight: emphasis === 'strong' ? (selfActive ? 600 : 500) : 400,
    color: selfActive
      ? (emphasis === 'strong' ? C.accent : C.accent)
      : (emphasis === 'strong' ? C.text : C.textMuted),
    opacity: fade(selfActive),
    cursor: 'pointer', lineHeight: 1.3,
    display: 'inline-flex', alignItems: 'center', gap: 4,
    transition: `color 180ms cubic-bezier(0.22,1,0.36,1), opacity 180ms cubic-bezier(0.22,1,0.36,1), font-weight 180ms`,
  });

  // Chip shell
  const borderColor = editing ? 'rgba(0,117,222,0.35)' : hovered ? C.borderStrong : C.border;
  const bg = editing ? C.accentLight : hovered ? C.surface : C.surfaceAlt;

  return (
    <span
      ref={rootRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 2,
        padding: '3px 6px 3px 10px',
        fontSize: 13, borderRadius: 9999,
        background: bg,
        border: `1px solid ${borderColor}`,
        transition: `background 180ms cubic-bezier(0.22,1,0.36,1), border-color 180ms cubic-bezier(0.22,1,0.36,1), transform 180ms cubic-bezier(0.22,1,0.36,1), box-shadow 180ms cubic-bezier(0.22,1,0.36,1)`,
        transform: hovered && !editing ? 'translateY(-1px)' : 'translateY(0)',
        boxShadow: editing
          ? '0 4px 14px rgba(0,117,222,0.12), 0 0 0 3px rgba(0,117,222,0.08)'
          : hovered ? '0 1px 2px rgba(0,0,0,0.04)' : 'none',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes chipMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* ── Field segment ── */}
      <span style={segmentPill(editing === 'field')}>
        <button
          ref={fieldRef}
          type="button"
          onClick={e => { e.stopPropagation(); setEditing(editing === 'field' ? null : 'field'); }}
          style={segBtnStyle(editing === 'field', 'strong')}
        >
          {fieldLabels[condition.field] || condition.field}
          {editing === 'field' && <ChevronCaret open={true} />}
        </button>
      </span>

      {/* ── Operator segment ── */}
      <span style={segmentPill(editing === 'operator')}>
        <button
          ref={opRef}
          type="button"
          onClick={e => { e.stopPropagation(); setEditing(editing === 'operator' ? null : 'operator'); }}
          style={segBtnStyle(editing === 'operator', 'muted')}
        >
          {opLabel}
          {editing === 'operator' && <ChevronCaret open={true} />}
        </button>
      </span>

      {/* ── Value segment ── */}
      <span style={segmentPill(editing === 'value')}>
        {isFreeText ? (
          condition.field === 'startDate' ? (
            <input
              ref={valueInputRef}
              type="date"
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={e => onChange({ ...condition, value: e.target.value })}
              onBlur={() => setEditing(null)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(null); }}
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.accent,
                padding: 0, margin: 0, minWidth: 110,
              }}
            />
          ) : (
            <input
              ref={valueInputRef}
              type="text"
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={e => onChange({ ...condition, value: e.target.value })}
              onBlur={() => setEditing(null)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditing(null); }}
              placeholder="text…"
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                fontFamily: FONT, fontSize: 13, fontWeight: 600, color: C.accent,
                padding: 0, margin: 0, minWidth: 90,
              }}
            />
          )
        ) : (
          <button
            ref={valueRef}
            type="button"
            onClick={e => { e.stopPropagation(); setEditing(editing === 'value' ? null : 'value'); }}
            style={segBtnStyle(editing === 'value', 'strong')}
          >
            {displayValue || 'Value…'}
            {editing === 'value' && <ChevronCaret open={true} />}
          </button>
        )}
      </span>

      {/* ── Floating popover menus per segment ── */}
      {editing === 'field' && (
        <SegmentMenu
          anchorRef={fieldRef}
          options={FIELD_OPTIONS.map(f => ({ value: f.value, label: f.label }))}
          selected={condition.field}
          onSelect={v => {
            onChange({ ...condition, field: v, operator: (OPERATOR_OPTIONS[v]?.[0]?.value || 'is'), value: '' });
            setEditing('value');
          }}
          onClose={() => setEditing(null)}
          width={200}
        />
      )}
      {editing === 'operator' && (
        <SegmentMenu
          anchorRef={opRef}
          options={operators.map(o => ({ value: o.value, label: o.label }))}
          selected={condition.operator}
          onSelect={v => {
            onChange({ ...condition, operator: v as RuleCondition['operator'] });
            setEditing('value');
          }}
          onClose={() => setEditing(null)}
          width={140}
        />
      )}
      {editing === 'value' && !isFreeText && (
        <SegmentMenu
          anchorRef={valueRef}
          options={valueOptions}
          selected={Array.isArray(condition.value) ? condition.value[0] || '' : condition.value as string}
          onSelect={v => {
            onChange({ ...condition, value: v });
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
          width={200}
        />
      )}

      {/* Remove (appears on hover, never on edit) */}
      <button
        type="button"
        aria-label="Remove filter"
        onClick={e => { e.stopPropagation(); onRemove(); }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 18, height: 18, borderRadius: 9999,
          border: 'none', background: 'transparent',
          color: C.textMuted, cursor: 'pointer',
          opacity: hovered && !editing ? 1 : 0,
          transition: `opacity 160ms cubic-bezier(0.22,1,0.36,1), background 160ms cubic-bezier(0.22,1,0.36,1), color 160ms cubic-bezier(0.22,1,0.36,1)`,
          marginLeft: -2,
          flexShrink: 0,
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = C.text; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.textMuted; }}
        tabIndex={hovered || editing ? 0 : -1}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2 2l6 6M8 2l-6 6" />
        </svg>
      </button>
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPOTLIGHT — Tab-cycled unified authoring: NL / Builder / Suggest
// ═══════════════════════════════════════════════════════════════════════════════

type SpotlightMode = 'nl' | 'builder' | 'suggest';

interface FilterSuggestion {
  label: string;
  condition: RuleCondition;
}

function deriveSuggestions(people: Person[], existing: RuleNode[]): FilterSuggestion[] {
  const existingKeys = new Set<string>();
  for (const c of existing) {
    if (c.type === 'condition') existingKeys.add(`${c.field}:${c.operator}:${c.value}`);
  }

  const counts = (field: string) => {
    const m = new Map<string, number>();
    for (const p of people) {
      const v = String((p as unknown as Record<string, unknown>)[field] ?? '');
      if (v) m.set(v, (m.get(v) || 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const seed: FilterSuggestion[] = [];
  for (const [v] of counts('department').slice(0, 2)) {
    seed.push({ label: `${fieldLabels.department} is ${formatValue('department', v)}`, condition: { type: 'condition', field: 'department', operator: 'is', value: v } });
  }
  for (const [v] of counts('location').slice(0, 2)) {
    seed.push({ label: `${fieldLabels.location} is ${formatValue('location', v)}`, condition: { type: 'condition', field: 'location', operator: 'is', value: v } });
  }
  seed.push({ label: 'Employment type is Full-time', condition: { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' } });
  seed.push({ label: 'Role status is Active', condition: { type: 'condition', field: 'roleState', operator: 'is', value: 'active' } });
  seed.push({ label: 'Country is US', condition: { type: 'condition', field: 'country', operator: 'is', value: 'US' } });

  return seed.filter(s => !existingKeys.has(`${s.condition.field}:${s.condition.operator}:${s.condition.value}`));
}

const SPOTLIGHT_PLACEHOLDERS: Record<SpotlightMode, string> = {
  nl: 'Describe who should be in this group…',
  builder: 'Pick a field to filter by…',
  suggest: 'Or tap a suggestion below…',
};

const SPOT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const SPOT_BOUNCE = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

function SpotlightInput({
  people, savedGroups, existingChildren, currentRule,
  onSelectGroup, onCreateFromConditions, onAddCondition, onEditCommand,
  autoFocus,
}: {
  people: Person[];
  savedGroups: SavedGroup[];
  existingChildren: RuleNode[];
  currentRule?: RuleGroup;
  onSelectGroup: (g: SavedGroup) => void;
  onCreateFromConditions: (conds: RuleCondition[]) => void;
  onAddCondition: (condition: RuleCondition) => void;
  onEditCommand?: (text: string) => void;
  autoFocus?: boolean;
}) {
  const [mode, setMode] = useState<SpotlightMode>('nl');
  const [query, setQuery] = useState('');
  const [hintVisible, setHintVisible] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  const [bField, setBField] = useState<string>('');
  const [bOperator, setBOperator] = useState<RuleCondition['operator']>('is');
  const [bValue, setBValue] = useState<string>('');

  const matchingGroups = useMemo(() => searchSavedGroups(query, savedGroups), [query, savedGroups]);
  const parsedConditions = useMemo(() => query.length > 2 ? parseNL(query, people) : [], [query, people]);
  const suggestions = useMemo(() => deriveSuggestions(people, existingChildren), [people, existingChildren]);
  const isEditing = !!currentRule && currentRule.children.length > 0;
  const isEditCommand = isEditing && /^(add|remove|exclude|include|why is|why does)/.test(query.toLowerCase().trim());

  const bOps = OPERATOR_OPTIONS[bField] || [{ value: 'is' as const, label: 'is' }];
  const bValueOptions = useMemo(
    () => bField ? getValueOptions(bField, people).map(v => ({ value: v, label: formatValue(bField, v) })) : [],
    [bField, people]
  );

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const t = window.setTimeout(() => setHintVisible(false), 4200);
    return () => window.clearTimeout(t);
  }, []);

  const cycleMode = useCallback((direction: 1 | -1 = 1) => {
    const order: SpotlightMode[] = ['nl', 'builder', 'suggest'];
    const i = order.indexOf(mode);
    setMode(order[(i + direction + order.length) % order.length]);
  }, [mode]);

  const commitBuilder = () => {
    if (!bField || !bValue) return;
    onAddCondition({ type: 'condition', field: bField, operator: bOperator, value: bValue });
    setBField(''); setBOperator('is'); setBValue('');
    setMode('nl');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      cycleMode(e.shiftKey ? -1 : 1);
    } else if (e.key === 'Escape') {
      if (mode !== 'nl') { e.preventDefault(); setMode('nl'); }
      else { setQuery(''); inputRef.current?.blur(); }
    } else if (e.key === 'Enter') {
      if (mode === 'nl') {
        if (isEditCommand && onEditCommand) { onEditCommand(query); setQuery(''); }
        else if (parsedConditions.length > 0) { onCreateFromConditions(parsedConditions); setQuery(''); }
      } else if (mode === 'builder' && bField && bValue) {
        commitBuilder();
      }
    }
  };

  const commitSuggestion = (s: FilterSuggestion) => {
    onAddCondition(s.condition);
  };

  const modeIconBtn = (active: boolean): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 8,
    border: 'none',
    background: active ? C.accentLight : 'transparent',
    color: active ? C.accent : C.textMuted,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: `background 180ms ${SPOT_EASE}, color 180ms ${SPOT_EASE}`,
    flexShrink: 0,
  });

  const hasResultsArea =
    (mode === 'nl' && query.length > 1 && (matchingGroups.length > 0 || parsedConditions.length > 0 || isEditCommand)) ||
    mode === 'builder' ||
    (mode === 'suggest' && suggestions.length > 0);

  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        @keyframes spot_contentIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spot_pillIn { 0% { opacity: 0; transform: scale(0.86); } 60% { transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes spot_focusPulse { 0% { box-shadow: 0 0 0 0 rgba(0,117,222,0.25); } 70% { box-shadow: 0 0 0 6px rgba(0,117,222,0); } 100% { box-shadow: 0 0 0 0 rgba(0,117,222,0); } }
        @keyframes spot_hintNudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
      `}</style>

      {/* Input row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        animation: `spot_focusPulse 1200ms ${SPOT_EASE}`,
        borderRadius: 999,
      }}>
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: C.textMuted }}>
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M11 11L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setHintVisible(true)}
          placeholder={SPOTLIGHT_PLACEHOLDERS[mode]}
          style={{
            flex: 1, minWidth: 0,
            border: 'none', outline: 'none',
            fontSize: 15, fontFamily: FONT, color: C.text,
            background: 'transparent', padding: '4px 0',
          }}
        />
        <span style={{
          fontSize: 10, fontFamily: '"SF Mono","Fira Code",Menlo,monospace',
          color: C.textMuted, background: 'rgba(0,0,0,0.04)', borderRadius: 4,
          padding: '2px 5px', fontWeight: 500, letterSpacing: 0.5, flexShrink: 0,
          border: `1px solid rgba(0,0,0,0.06)`,
          opacity: hintVisible ? 0.85 : 0.35,
          transition: `opacity 600ms ${SPOT_EASE}`,
          animation: hintVisible ? `spot_hintNudge 1600ms ${SPOT_EASE}` : 'none',
        }}>
          tab
        </span>
        <div style={{ width: 1, height: 16, background: 'rgba(0,0,0,0.08)', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <button
            type="button"
            onClick={() => { setMode(mode === 'builder' ? 'nl' : 'builder'); inputRef.current?.focus(); }}
            title="Pick a field (Tab)"
            aria-label="Switch to builder mode"
            style={modeIconBtn(mode === 'builder')}
            onMouseEnter={e => { if (mode !== 'builder') { (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; (e.currentTarget as HTMLElement).style.color = C.textSecondary; } }}
            onMouseLeave={e => { if (mode !== 'builder') { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.textMuted; } }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <rect x="1" y="2" width="12" height="1.5" rx=".75" fill="currentColor" opacity=".45"/>
              <rect x="1" y="6.25" width="12" height="1.5" rx=".75" fill="currentColor" opacity=".45"/>
              <rect x="1" y="10.5" width="12" height="1.5" rx=".75" fill="currentColor" opacity=".45"/>
              <circle cx="4" cy="2.75" r="1.8" fill="currentColor"/>
              <circle cx="9" cy="7" r="1.8" fill="currentColor"/>
              <circle cx="6" cy="11.25" r="1.8" fill="currentColor"/>
            </svg>
          </button>
          <button
            type="button"
            onClick={() => { setMode(mode === 'suggest' ? 'nl' : 'suggest'); inputRef.current?.focus(); }}
            title="Suggestions (Tab)"
            aria-label="Switch to suggest mode"
            style={modeIconBtn(mode === 'suggest')}
            onMouseEnter={e => {
              if (mode !== 'suggest') {
                (e.currentTarget as HTMLElement).style.background = C.surfaceAlt;
                (e.currentTarget as HTMLElement).style.color = C.textSecondary;
              }
              const svg = e.currentTarget.querySelector('svg');
              if (svg) (svg as SVGElement).style.transform = 'rotate(24deg) scale(1.1)';
            }}
            onMouseLeave={e => {
              if (mode !== 'suggest') {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
                (e.currentTarget as HTMLElement).style.color = C.textMuted;
              }
              const svg = e.currentTarget.querySelector('svg');
              if (svg) (svg as SVGElement).style.transform = 'rotate(0deg) scale(1)';
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ transition: `transform 240ms ${SPOT_BOUNCE}` }}>
              <path d="M7 1l1.2 3.8L12 5l-3 2.7 1 3.8L7 9.2 4 11.5l1-3.8L2 5l3.8-.2L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Results area */}
      <div style={{
        display: 'grid',
        gridTemplateRows: hasResultsArea ? '1fr' : '0fr',
        transition: `grid-template-rows 280ms ${SPOT_EASE}`,
        marginTop: hasResultsArea ? 12 : 0,
      }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>

          {mode === 'nl' && (
            <div key="nl" style={{ animation: `spot_contentIn 240ms ${SPOT_EASE}` }}>
              {matchingGroups.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, padding: '0 2px' }}>
                    {matchingGroups.length === 1 ? 'Matching group' : `${matchingGroups.length} matching groups`}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {matchingGroups.map((g, i) => (
                      <button
                        key={g.id}
                        onClick={() => { onSelectGroup(g); setQuery(''); }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          width: '100%', padding: '10px 12px',
                          border: `1px solid ${C.border}`, borderRadius: 10,
                          background: C.surface, cursor: 'pointer',
                          fontFamily: FONT, textAlign: 'left',
                          transition: `background 160ms ${SPOT_EASE}, border-color 160ms ${SPOT_EASE}`,
                          animation: `spot_contentIn 260ms ${SPOT_EASE} ${i * 40}ms both`,
                        }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = C.accentBorder; (e.currentTarget as HTMLElement).style.background = C.accentLight; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.background = C.surface; }}
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
                </div>
              )}

              {matchingGroups.length > 0 && parsedConditions.length > 0 && (
                <div style={{ borderTop: `1px solid rgba(0,0,0,0.08)`, margin: '14px 2px' }} />
              )}

              {parsedConditions.length > 0 && !isEditCommand && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, padding: '0 2px' }}>
                    {matchingGroups.length > 0 ? 'Or create new with' : 'Create with'}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {parsedConditions.map((c, i) => (
                      <span key={`${c.field}-${c.value}-${i}`} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 13, fontWeight: 500, padding: '4px 10px',
                        background: C.accentLight, color: C.accent, border: `1px solid ${C.accentBorder}`,
                        borderRadius: 9999,
                        animation: `spot_pillIn 360ms ${SPOT_BOUNCE} ${i * 55}ms both`,
                      }}>
                        <span style={{ color: C.textSecondary, fontWeight: 400, fontSize: 12 }}>{fieldLabels[c.field] || c.field}</span>
                        <span style={{ color: C.textMuted, fontSize: 12 }}>{c.operator === 'is' ? '=' : c.operator}</span>
                        <span>{formatValue(c.field, c.value as string)}</span>
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() => { onCreateFromConditions(parsedConditions); setQuery(''); }}
                    style={{
                      background: C.accent, color: '#fff', border: 'none',
                      borderRadius: 9999, padding: '7px 16px',
                      fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      transition: `background 160ms ${SPOT_EASE}`,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.accentHover; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.accent; }}
                  >
                    Create new group
                    <span style={{ fontSize: 10, fontFamily: '"SF Mono","Fira Code",Menlo,monospace', background: 'rgba(255,255,255,0.18)', borderRadius: 3, padding: '1px 4px', letterSpacing: 0.5 }}>↵</span>
                  </button>
                </div>
              )}

              {isEditCommand && onEditCommand && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, padding: '0 2px' }}>
                    Refine current rule
                  </div>
                  <button
                    onClick={() => { onEditCommand(query); setQuery(''); }}
                    style={{
                      background: C.accent, color: '#fff', border: 'none',
                      borderRadius: 9999, padding: '7px 16px',
                      fontSize: 13, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
                    }}
                  >
                    Apply: "{query}"
                  </button>
                </div>
              )}
            </div>
          )}

          {mode === 'builder' && (
            <div key="builder" style={{ animation: `spot_contentIn 240ms ${SPOT_EASE}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, padding: '0 2px' }}>
                Build a filter
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <select
                  value={bField}
                  onChange={e => { setBField(e.target.value); setBOperator(OPERATOR_OPTIONS[e.target.value]?.[0]?.value || 'is'); setBValue(''); }}
                  style={{
                    padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
                    fontSize: 13, fontFamily: FONT, color: bField ? C.text : C.textMuted, background: C.surface,
                    outline: 'none', minWidth: 140, cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Field…</option>
                  {FIELD_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <select
                  value={bOperator}
                  onChange={e => setBOperator(e.target.value as RuleCondition['operator'])}
                  disabled={!bField}
                  style={{
                    padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
                    fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface,
                    outline: 'none', minWidth: 90, cursor: bField ? 'pointer' : 'default',
                    opacity: bField ? 1 : 0.5,
                    transition: `opacity 160ms ${SPOT_EASE}`,
                  }}
                >
                  {bOps.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {bField === 'startDate' ? (
                  <input
                    type="date"
                    value={bValue}
                    onChange={e => setBValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitBuilder(); }}
                    style={{ flex: 1, minWidth: 120, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }}
                  />
                ) : bField === 'title' && bOperator === 'contains' ? (
                  <input
                    type="text"
                    value={bValue}
                    onChange={e => setBValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') commitBuilder(); }}
                    placeholder="Text…"
                    style={{ flex: 1, minWidth: 120, padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }}
                  />
                ) : (
                  <select
                    value={bValue}
                    onChange={e => setBValue(e.target.value)}
                    disabled={!bField}
                    style={{
                      flex: 1, minWidth: 120,
                      padding: '7px 10px', border: `1px solid ${C.border}`, borderRadius: 8,
                      fontSize: 13, fontFamily: FONT, color: bValue ? C.text : C.textMuted, background: C.surface,
                      outline: 'none', cursor: bField ? 'pointer' : 'default',
                      opacity: bField ? 1 : 0.5,
                      transition: `opacity 160ms ${SPOT_EASE}`,
                    }}
                  >
                    <option value="" disabled>Value…</option>
                    {bValueOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                <button
                  onClick={commitBuilder}
                  disabled={!bField || !bValue}
                  style={{
                    background: (!bField || !bValue) ? C.textMuted : C.accent,
                    color: '#fff', border: 'none', borderRadius: 9999,
                    padding: '7px 14px', fontSize: 13, fontWeight: 600, fontFamily: FONT,
                    cursor: (!bField || !bValue) ? 'default' : 'pointer',
                    opacity: (!bField || !bValue) ? 0.45 : 1,
                    transition: `opacity 180ms ${SPOT_EASE}, background 180ms ${SPOT_EASE}`,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  Add
                  {bField && bValue && (
                    <span style={{ fontSize: 10, fontFamily: '"SF Mono","Fira Code",Menlo,monospace', background: 'rgba(255,255,255,0.18)', borderRadius: 3, padding: '1px 4px', letterSpacing: 0.5 }}>↵</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {mode === 'suggest' && (
            <div key="suggest" style={{ animation: `spot_contentIn 240ms ${SPOT_EASE}` }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, padding: '0 2px' }}>
                Suggested filters
              </div>
              {suggestions.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.condition.field}-${s.condition.value}`}
                      onClick={() => commitSuggestion(s)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: C.surfaceAlt, color: C.text,
                        border: `1px solid ${C.border}`, borderRadius: 9999,
                        padding: '6px 12px', fontSize: 13, fontWeight: 500, fontFamily: FONT,
                        cursor: 'pointer',
                        animation: `spot_pillIn 320ms ${SPOT_BOUNCE} ${i * 45}ms both`,
                        transition: `background 160ms ${SPOT_EASE}, border-color 160ms ${SPOT_EASE}, color 160ms ${SPOT_EASE}, transform 160ms ${SPOT_EASE}`,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.accentLight; (e.currentTarget as HTMLElement).style.borderColor = C.accentBorder; (e.currentTarget as HTMLElement).style.color = C.accent; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.text; (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.textMuted }}>All common filters are already applied.</div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTAINER VARIANT C — BOTTOM PILL NAV (horizontal slide between sections)
// ═══════════════════════════════════════════════════════════════════════════════

type BottomNavSection = 'authoring' | 'members' | 'layers' | 'policies';

function GroupDefinitionBottomNavLayout(props: GroupDefinitionLayoutProps) {
  const {
    rule, allPeople, layers, members, hasValid, previewReady,
    onRuleChange, onEditCommand, onApplyAdjustment,
    savedGroups, onSelectGroup, expanded,
    excludedByLayers, totalExcluded, hasConditions,
    conditionsEditing, setConditionsEditing,
  } = props;

  const [section, setSection] = useState<BottomNavSection>('authoring');

  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const sectionOrder: BottomNavSection[] = ['authoring', 'members', 'layers', 'policies'];
  const sectionsVisible: BottomNavSection[] = sectionOrder.filter(s => {
    if (s === 'authoring') return true;
    if (s === 'members') return true;
    if (s === 'layers') return true;
    if (s === 'policies') return true;
    return true;
  });

  // Build tab spec for the pill
  const tabs: BottomPillTabSpec[] = [
    {
      id: 'authoring',
      label: 'Conditions',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 4h12" />
          <path d="M4 8h8" />
          <path d="M6 12h4" />
        </svg>
      ),
    },
    {
      id: 'members',
      label: 'People',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="6" cy="5.5" r="2.5" />
          <path d="M1.5 14c0-2.5 2-4 4.5-4s4.5 1.5 4.5 4" />
          <circle cx="11.5" cy="5.8" r="1.8" />
          <path d="M11.5 9.8c1.8 0 3.2 1.1 3.2 2.8" />
        </svg>
      ),
      badge: hasConditions ? { text: String(members.length), tone: 'accent' } : undefined,
    },
    {
      id: 'layers',
      label: 'Exclusions',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="8" cy="8" r="5.5" />
          <path d="M4.1 11.9L11.9 4.1" />
        </svg>
      ),
      badge: hasConditions && totalExcluded > 0
        ? { text: String(totalExcluded), tone: 'amber' }
        : undefined,
    },
    {
      id: 'policies',
      label: 'Policies',
      icon: (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 3H4a1 1 0 00-1 1v8a1 1 0 001 1h8a1 1 0 001-1v-2" />
          <path d="M9 2h5v5" />
          <path d="M14 2L7 9" />
        </svg>
      ),
      badge: hasConditions ? { text: '0', tone: 'neutral' } : undefined,
    },
  ];

  const activeIndex = Math.max(0, sectionsVisible.indexOf(section));
  const N = sectionsVisible.length;

  // Height of embedded card — account for pill padding
  const panelHeight = 360;

  return (
    <div style={{
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      background: C.surface,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* Slide viewport */}
      <div style={{
        height: panelHeight,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          display: 'flex',
          height: '100%',
          width: `${N * 100}%`,
          transform: `translateX(-${(activeIndex / N) * 100}%)`,
          transition: reducedMotion ? 'none' : 'transform 280ms cubic-bezier(0.2,0,0,1)',
        }}>
          {sectionsVisible.map((s) => {
            const isActive = s === section;
            const panelStyle: React.CSSProperties = {
              flex: `0 0 ${100 / N}%`,
              height: '100%',
              overflowY: 'auto',
              boxSizing: 'border-box',
              outline: 'none',
            };
            const panelProps = {
              id: `bn-panel-${s}`,
              role: 'tabpanel' as const,
              'aria-labelledby': `bn-tab-${s}`,
              'aria-hidden': !isActive,
              tabIndex: isActive ? 0 : -1,
              style: panelStyle,
            };

            if (s === 'authoring') {
              return (
                <div key={s} {...panelProps}>
                  <div style={{ padding: '18px 18px 10px', position: 'relative', zIndex: 10 }}>
                    <SpotlightInput
                      people={allPeople}
                      savedGroups={savedGroups}
                      existingChildren={rule.children}
                      currentRule={rule}
                      onSelectGroup={onSelectGroup}
                      onCreateFromConditions={conds => {
                        onRuleChange({ type: 'group', combinator: 'AND', children: conds });
                      }}
                      onAddCondition={(cond) => {
                        onRuleChange({ ...rule, children: [...rule.children, cond] });
                      }}
                      onEditCommand={onEditCommand}
                    />
                  </div>
                  {hasConditions && (
                    <div style={{ padding: '6px 18px 10px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {rule.children.map((child, i) => {
                        if (child.type !== 'condition') return null;
                        return (
                          <InlineEditableChip
                            key={i}
                            condition={child}
                            allPeople={allPeople}
                            onChange={updated => {
                              const next = [...rule.children];
                              next[i] = updated;
                              onRuleChange({ ...rule, children: next });
                            }}
                            onRemove={() => onRuleChange({ ...rule, children: rule.children.filter((_, idx) => idx !== i) })}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Exclusions: gate the system-filter display behind "has conditions" — without a rule,
            // showing the org-wide list of excluded people is noise (they aren't excluded from "your group"
            // because your group doesn't exist yet).
            if (s === 'layers' && !hasConditions) {
              return (
                <div key={s} {...panelProps}>
                  <div style={{
                    padding: '40px 24px', textAlign: 'center',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9999,
                      background: C.surfaceAlt,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: C.textMuted,
                    }}>
                      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="8" cy="8" r="5.5" />
                        <path d="M4.1 11.9L11.9 4.1" />
                      </svg>
                    </div>
                    <div style={{ fontSize: 13, color: C.textSecondary, lineHeight: 1.5, maxWidth: 300 }}>
                      Add a condition in <strong style={{ color: C.text, fontWeight: 600 }}>Conditions</strong> to see who's excluded by system filters.
                    </div>
                    <button
                      type="button"
                      onClick={() => setSection('authoring')}
                      style={{
                        marginTop: 4,
                        background: 'transparent',
                        color: C.accent,
                        border: `1px solid ${C.accentBorder}`,
                        borderRadius: 9999,
                        padding: '6px 14px',
                        fontSize: 13, fontWeight: 600, fontFamily: FONT,
                        cursor: 'pointer',
                        transition: `background 160ms cubic-bezier(0.22,1,0.36,1), border-color 160ms cubic-bezier(0.22,1,0.36,1)`,
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = C.accentLight; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      Go to Conditions
                    </button>
                  </div>
                </div>
              );
            }

            // members / layers / policies — reuse DisclosureTabContent with one active tab + tab bar hidden
            return (
              <div key={s} {...panelProps}>
                <DisclosureTabContent
                  members={members}
                  allPeople={allPeople}
                  rule={rule}
                  layers={layers}
                  excludedByLayers={excludedByLayers}
                  consumers={[]}
                  compact={!expanded}
                  onApplyAdjustment={onApplyAdjustment}
                  activeTab={s as 'members' | 'layers' | 'policies'}
                  setActiveTab={() => {}}
                  hideTabs
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom pill nav — sticky at bottom of card */}
      <div style={{
        display: 'flex', justifyContent: 'center',
        padding: '10px 12px 14px',
        background: C.surface,
      }}>
        <BottomPillNav
          tabs={tabs}
          activeId={section}
          onChange={(id) => setSection(id as BottomNavSection)}
          scoped
        />
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
  const [groupValid, setGroupValid] = useState(false);
  const steps = ['Plan details', 'Eligibility group', 'Plan options', 'Review'];

  const validityValue = useMemo(() => ({ isValid: groupValid, setValid: setGroupValid }), [groupValid]);

  return (
    <GroupValidityContext.Provider value={validityValue}>
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
              <button
                onClick={() => { if (groupValid) setStep(2); }}
                disabled={!groupValid}
                title={!groupValid ? 'Select or define an eligibility group to continue' : undefined}
                style={{
                  padding: '9px 20px',
                  background: groupValid ? C.accent : C.surfaceAlt,
                  color: groupValid ? '#fff' : C.textMuted,
                  border: groupValid ? 'none' : `1px solid ${C.border}`,
                  borderRadius: 6, fontSize: 14, fontWeight: 600, fontFamily: FONT,
                  cursor: groupValid ? 'pointer' : 'not-allowed',
                  transition: 'background 120ms, color 120ms',
                }}
              >
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
    </GroupValidityContext.Provider>
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

  // Workspace variants (Left tabs, Right rail) are authoring-centric layouts —
  // auto-enter create mode so the layout renders instead of the search entry point
  // or the compact saved-group card.
  const isWorkspaceVariant = disclosureVariant === 'sections' || disclosureVariant === 'overlay' || disclosureVariant === 'bottomNav';
  useEffect(() => {
    if (!isWorkspaceVariant) return;
    if (mode === 'search') {
      setMode('create');
    } else if (mode === 'selected' && selectedGroup) {
      setRule(selectedGroup.rule);
      setMode('create');
    }
  }, [isWorkspaceVariant, mode, selectedGroup]);

  const layers: EvaluationLayer[] = useMemo(() => [{
    id: 'el-rs', type: 'role_state' as const, label: 'Active employees only',
    description: 'System filter: only active employees included.',
    excludedPeopleIds: data.people.filter(p => p.roleState !== 'active').map(p => p.id),
  }], [data.people]);

  const members = useMemo(() =>
    rule.children.length > 0 ? getMembersForRule(data.people, rule, layers) : [],
    [data.people, rule, layers]);

  const hasValid = rule.children.some(c => c.type === 'condition' && (c as RuleCondition).field && (c as RuleCondition).value);

  const { setValid: setGroupValid } = React.useContext(GroupValidityContext);
  const groupIsLegitimate =
    (mode === 'selected' && !!selectedGroup) ||
    (mode === 'create' && hasValid && previewReady);
  useEffect(() => {
    setGroupValid(groupIsLegitimate);
  }, [groupIsLegitimate, setGroupValid]);

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

const CONTAINER_LABELS: Record<DisclosureVariant, string> = {
  sheet: 'Sheet',
  slide: 'Drawer',
  accordion: 'Accordion',
  spatial: 'Spatial',
  conversational: 'Convo',
  sections: 'Left tabs',
  overlay: 'Right rail',
  bottomNav: 'Bottom pill',
};

const CONTAINER_PRIMARY: DisclosureVariant[] = ['bottomNav', 'slide', 'accordion'];
const CONTAINER_MORE_GROUPS: { label: string; items: DisclosureVariant[] }[] = [
  { label: 'Classic',   items: ['sheet'] },
  { label: 'Alternate', items: ['spatial', 'conversational'] },
  { label: 'Workspace', items: ['sections', 'overlay'] },
];

function ContainerDropdown({ value, onChange }: {
  value: DisclosureVariant;
  onChange: (v: DisclosureVariant) => void;
}) {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setMoreOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (moreOpen) setMoreOpen(false);
        else setOpen(false);
      }
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open, moreOpen]);

  useEffect(() => {
    if (!open) setMoreOpen(false);
  }, [open]);

  const isMoreActive = !CONTAINER_PRIMARY.includes(value);

  const itemButtonStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', textAlign: 'left',
    padding: '6px 10px',
    border: 'none',
    borderRadius: 6,
    background: active ? 'rgba(255,255,255,0.14)' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.75)',
    fontFamily: FONT,
    fontSize: 12,
    fontWeight: active ? 600 : 500,
    cursor: 'pointer',
    transition: 'background 0.1s, color 0.1s',
  });

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 8px 4px 10px',
          borderRadius: 9999,
          border: 'none',
          fontSize: 12, fontWeight: 600, fontFamily: FONT,
          cursor: 'pointer',
          background: open ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
          color: '#fff',
          transition: 'background 0.1s',
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{CONTAINER_LABELS[value]}</span>
        <svg
          width="10" height="10" viewBox="0 0 10 10"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
            opacity: 0.7,
          }}
          fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M2 3.5l3 3 3-3" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            minWidth: 180,
            background: 'rgba(20,20,20,0.96)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 10,
            padding: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
            zIndex: 5,
          }}
        >
          {CONTAINER_PRIMARY.map(item => {
            const active = value === item;
            return (
              <button
                key={item}
                onClick={() => { onChange(item); setOpen(false); }}
                role="option"
                aria-selected={active}
                style={itemButtonStyle(active)}
                onMouseEnter={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={e => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span>{CONTAINER_LABELS[item]}</span>
                {active && (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2.5 6.5l2.5 2.5L9.5 3.5" />
                  </svg>
                )}
              </button>
            );
          })}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 6px' }} />

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMoreOpen(o => !o)}
              aria-expanded={moreOpen}
              aria-haspopup="listbox"
              style={{
                ...itemButtonStyle(isMoreActive || moreOpen),
                background: moreOpen ? 'rgba(255,255,255,0.08)' : (isMoreActive ? 'rgba(255,255,255,0.14)' : 'transparent'),
              }}
              onMouseEnter={e => {
                if (!moreOpen && !isMoreActive) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={e => {
                if (!moreOpen && !isMoreActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span>
                More
                {isMoreActive && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontWeight: 500, marginLeft: 6 }}>
                    · {CONTAINER_LABELS[value]}
                  </span>
                )}
              </span>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
                <path d="M3.5 2l3 3-3 3" />
              </svg>
            </button>

            {moreOpen && (
              <div
                role="listbox"
                style={{
                  position: 'absolute',
                  left: 'calc(100% + 6px)',
                  bottom: 0,
                  minWidth: 180,
                  background: 'rgba(20,20,20,0.96)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  padding: 6,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)',
                  zIndex: 6,
                }}
              >
                {CONTAINER_MORE_GROUPS.map((group, gi) => (
                  <div key={group.label} style={{ marginTop: gi === 0 ? 0 : 4 }}>
                    <div style={{
                      fontSize: 9, fontWeight: 700,
                      color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase', letterSpacing: 0.8,
                      padding: '6px 10px 4px',
                    }}>
                      {group.label}
                    </div>
                    {group.items.map(item => {
                      const active = value === item;
                      return (
                        <button
                          key={item}
                          onClick={() => { onChange(item); setOpen(false); setMoreOpen(false); }}
                          role="option"
                          aria-selected={active}
                          style={itemButtonStyle(active)}
                          onMouseEnter={e => {
                            if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                          }}
                          onMouseLeave={e => {
                            if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent';
                          }}
                        >
                          <span>{CONTAINER_LABELS[item]}</span>
                          {active && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M2.5 6.5l2.5 2.5L9.5 3.5" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function HUD({ viewMode, setViewMode, scenarioMode, setScenarioMode, disclosureVariant, setDisclosureVariant, orgMode, setOrgMode }: {
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  scenarioMode: ScenarioMode;
  setScenarioMode: (s: ScenarioMode) => void;
  disclosureVariant: DisclosureVariant;
  setDisclosureVariant: (v: DisclosureVariant) => void;
  orgMode: OrgMode;
  setOrgMode: (m: OrgMode) => void;
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={hudLabel}>Container</span>
            <ContainerDropdown value={disclosureVariant} onChange={setDisclosureVariant} />
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

      {/* Org mode */}
      <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={hudLabel}>Org</span>
        {(['standard', 'multi-entity'] as OrgMode[]).map(m => (
          <button key={m} onClick={() => setOrgMode(m)} style={hudBtnStyle(orgMode === m)}>
            {m === 'standard' ? 'Standard' : 'Multi-entity'}
          </button>
        ))}
      </div>
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
  const [orgMode, setOrgMode] = useState<OrgMode>('standard');

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

  const contextValue = useMemo(
    () => ({ orgMode, context: viewMode === 'drawer' ? 'inline' as const : 'standalone' as const }),
    [orgMode, viewMode],
  );

  return (
    <OrgModeContext.Provider value={contextValue}>
      <div style={{ fontFamily: FONT, color: C.text, fontSize: 14, lineHeight: 1.5 }}>
        {content}
        <HUD
          viewMode={viewMode}
          setViewMode={setViewMode}
          scenarioMode={scenarioMode}
          setScenarioMode={setScenarioMode}
          disclosureVariant={disclosureVariant}
          setDisclosureVariant={setDisclosureVariant}
          orgMode={orgMode}
          setOrgMode={setOrgMode}
        />
      </div>
    </OrgModeContext.Provider>
  );
}

import { useState, useMemo, useRef, useEffect } from 'react';
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
import Layout1 from '../concept-E-layouts/layout-1-faceted-summary';
import Layout2 from '../concept-E-layouts/layout-2-composition-strip';
import Layout3 from '../concept-E-layouts/layout-3-unified-hero-card';
import Layout4 from '../concept-E-layouts/layout-4-temporal-heartbeat';
import Layout5 from '../concept-E-layouts/layout-5-split-panel';
import Layout6 from '../concept-E-layouts/layout-6-waffle-grid';
import Layout7 from '../concept-E-layouts/layout-7-baseline-refined';
import RuleGroupEditor, { createEmptyRuleGroup, ruleGroupHasValidConditions, canRenderInEditor, type FilterSuggestion } from './rule-group-editor';

// ── Design tokens (Notion-inspired) ──────────────────────────────────────────

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

const LAYOUTS = [
  { key: 1, label: 'Faceted Summary', icon: '◧' },
  { key: 2, label: 'Composition Strip', icon: '━' },
  { key: 3, label: 'Unified Hero', icon: '▣' },
  { key: 4, label: 'Temporal Heartbeat', icon: '〜' },
  { key: 5, label: 'Split Panel', icon: '◫' },
  { key: 6, label: 'Waffle Grid', icon: '⊞' },
  { key: 7, label: 'Baseline', icon: '▤' },
] as const;

// ── Field / value display helpers ─────────────────────────────────────────────

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

// ── Extended mock data ────────────────────────────────────────────────────────

const additionalPeople: Person[] = [
  { id: 'pe01', name: 'Liam Park', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-04-10', title: 'Staff Engineer' },
  { id: 'pe02', name: 'Nora Eriksson', department: 'Sales', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-07-05', title: 'Account Executive' },
  { id: 'pe03', name: 'Gabriel Costa', department: 'Finance', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-01-15', title: 'Senior Financial Analyst' },
  { id: 'pe04', name: 'Haruki Sato', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'contractor', roleState: 'active', startDate: '2024-06-01', title: 'Backend Engineer' },
  { id: 'pe05', name: 'Camille Dubois', department: 'Marketing', location: 'Berlin', country: 'DE', employmentType: 'full_time', roleState: 'active', startDate: '2023-09-18', title: 'Content Lead' },
  { id: 'pe06', name: 'Winston Brooks', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-11-01', title: 'HR Business Partner' },
  { id: 'pe07', name: 'Diana Petrova', department: 'Legal', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-02-28', title: 'Senior Counsel' },
  { id: 'pe08', name: 'Oscar Nilsson', department: 'Operations', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-05-22', title: 'Operations Manager' },
  { id: 'pe09', name: 'Mei-Ling Wu', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-08-12', title: 'Frontend Engineer' },
  { id: 'pe10', name: 'Santiago Reyes', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-10-30', title: 'Sales Engineer' },
  { id: 'pe11', name: 'Anya Volkov', department: 'Finance', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2024-03-15', title: 'Financial Controller' },
  { id: 'pe12', name: 'Tariq Hasan', department: 'Engineering', location: 'Toronto', country: 'CA', employmentType: 'contractor', roleState: 'active', startDate: '2024-09-01', title: 'Platform Engineer' },
  { id: 'pe13', name: 'Emily Zhao', department: 'Marketing', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-12-05', title: 'Growth Manager' },
  { id: 'pe14', name: 'Kofi Asante', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2023-08-14', title: 'Engineering Manager' },
  { id: 'pe15', name: 'Rebecca Liu', department: 'HR', location: 'New York', country: 'US', employmentType: 'part_time', roleState: 'active', startDate: '2024-04-01', title: 'Recruiter' },
  { id: 'pe16', name: 'Lukas Brandt', department: 'Engineering', location: 'Berlin', country: 'DE', employmentType: 'contractor', roleState: 'pending', startDate: '2026-03-10', title: 'ML Engineer' },
  { id: 'pe17', name: 'Yolanda Mensah', department: 'Sales', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2024-05-20', title: 'Enterprise Account Manager' },
  { id: 'pe18', name: 'Kevin Pham', department: 'Operations', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-06-07', title: 'IT Operations Lead' },
  { id: 'pe19', name: 'Isabelle Fournier', department: 'Legal', location: 'Toronto', country: 'CA', employmentType: 'full_time', roleState: 'active', startDate: '2024-07-22', title: 'Legal Operations Manager' },
  { id: 'pe20', name: 'Omar Farouk', department: 'Finance', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'pending', startDate: '2026-03-25', title: 'Treasury Analyst' },
  { id: 'pe21', name: 'Grace Okonkwo', department: 'Engineering', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-10-14', title: 'Security Engineer' },
  { id: 'pe22', name: 'Felix Bauer', department: 'Marketing', location: 'Berlin', country: 'DE', employmentType: 'part_time', roleState: 'active', startDate: '2024-11-01', title: 'Brand Designer' },
  { id: 'pe23', name: 'Linda Nakamura', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-02-15', title: 'HR Director' },
  { id: 'pe24', name: 'Marco Valenti', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'contractor', roleState: 'active', startDate: '2025-01-06', title: 'Solutions Consultant' },
  { id: 'pe25', name: 'Signe Lindqvist', department: 'Finance', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-04-10', title: 'VP Finance' },
  { id: 'pe26', name: 'Patrick Osei', department: 'Engineering', location: 'Toronto', country: 'CA', employmentType: 'full_time', roleState: 'active', startDate: '2024-12-02', title: 'Senior Backend Engineer' },
  { id: 'pe27', name: 'Clara Richter', department: 'Legal', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'pending', startDate: '2026-03-15', title: 'Associate Counsel' },
  { id: 'pe28', name: 'Derek Chang', department: 'Operations', location: 'San Francisco', country: 'US', employmentType: 'contractor', roleState: 'active', startDate: '2025-03-01', title: 'Project Manager' },
  { id: 'pe29', name: 'Amina Diallo', department: 'Engineering', location: 'London', country: 'GB', employmentType: 'full_time', roleState: 'active', startDate: '2025-02-14', title: 'Data Engineer' },
  { id: 'pe30', name: 'Ryan Gallagher', department: 'Sales', location: 'New York', country: 'US', employmentType: 'part_time', roleState: 'active', startDate: '2024-09-30', title: 'Sales Development Rep' },
  // Recent joiners (within last 30 days of 2026-04-03)
  { id: 'pe31', name: 'Zara Ahmed', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2026-03-20', title: 'Software Engineer' },
  { id: 'pe32', name: 'Tomás Silva', department: 'Sales', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2026-03-28', title: 'Account Manager' },
];

// Extra saved groups for concept-E
function buildExtendedData(base: EntryState['data']): EntryState['data'] {
  const allPeople = [...base.people, ...additionalPeople];

  // Build a large saved group with 25+ members (all US full-time active)
  const usFtIds = allPeople
    .filter(p => p.country === 'US' && p.employmentType === 'full_time' && p.roleState === 'active')
    .map(p => p.id);

  const largeGroup: SavedGroup = {
    id: 'sg-large',
    name: 'All US Full-Time Active',
    purpose: 'All active full-time employees in the United States',
    owner: 'Fatima Al-Hassan',
    productDomain: 'HR',
    lifecycleIntent: 'persistent',
    rule: {
      type: 'group',
      combinator: 'AND',
      children: [
        { type: 'condition', field: 'country', operator: 'is', value: 'US' },
        { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' },
        { type: 'condition', field: 'roleState', operator: 'is', value: 'active' },
      ],
    },
    memberIds: usFtIds,
    evaluationLayers: [
      { id: 'el-role-state', type: 'role_state', label: 'Active employees only', description: 'System filter: only employees with active role status are included.', excludedPeopleIds: allPeople.filter(p => p.roleState !== 'active').map(p => p.id) },
    ],
    consumers: [base.policies[0], base.policies[1], base.policies[2]],
    lastEvaluatedAt: '2026-04-02T08:00:00Z',
    lastModifiedBy: 'Fatima Al-Hassan',
    lastModifiedAt: '2026-03-01T10:00:00Z',
  };

  // Complex rule group: nested OR with sub-groups that can't render in flat filter model
  const advancedGroup: SavedGroup = {
    id: 'sg-advanced',
    name: 'Cross-Functional Senior Leaders',
    purpose: 'Senior leaders across engineering and finance, or any director-level in US offices',
    owner: 'Aisha Patel',
    productDomain: 'HR',
    lifecycleIntent: 'persistent',
    rule: {
      type: 'group',
      combinator: 'OR',
      children: [
        {
          type: 'group',
          combinator: 'AND',
          children: [
            { type: 'condition', field: 'department', operator: 'in', value: ['Engineering', 'Finance'] },
            { type: 'condition', field: 'title', operator: 'contains', value: 'Manager' },
          ],
        },
        {
          type: 'group',
          combinator: 'AND',
          children: [
            { type: 'condition', field: 'country', operator: 'is', value: 'US' },
            { type: 'condition', field: 'title', operator: 'contains', value: 'Director' },
          ],
        },
        {
          type: 'group',
          combinator: 'AND',
          children: [
            { type: 'condition', field: 'title', operator: 'contains', value: 'VP' },
          ],
        },
      ],
    },
    memberIds: allPeople
      .filter(p => {
        const t = p.title.toLowerCase();
        const isEngFin = p.department === 'Engineering' || p.department === 'Finance';
        if (isEngFin && t.includes('manager')) return true;
        if (p.country === 'US' && t.includes('director')) return true;
        if (t.includes('vp')) return true;
        return false;
      })
      .map(p => p.id),
    evaluationLayers: [
      { id: 'el-role-state', type: 'role_state', label: 'Active employees only', description: 'System filter: only employees with active role status are included.', excludedPeopleIds: allPeople.filter(p => p.roleState !== 'active').map(p => p.id) },
    ],
    consumers: [base.policies[3], base.policies[4]],
    lastEvaluatedAt: '2026-04-02T08:00:00Z',
    lastModifiedBy: 'Aisha Patel',
    lastModifiedAt: '2026-02-20T14:00:00Z',
  };

  // Update existing group memberIds to include extended people
  const updatedGroups = base.savedGroups.map(g => {
    const newMembers = allPeople
      .filter(p => evaluateRule(p, g.rule) && !g.evaluationLayers.some(l => l.excludedPeopleIds.includes(p.id)))
      .map(p => p.id);
    return { ...g, memberIds: newMembers };
  });

  return {
    people: allPeople,
    savedGroups: [...updatedGroups, largeGroup, advancedGroup],
    policies: base.policies,
  };
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

// ── Suggestion generation from saved groups ───────────────────────────────────

function generateSuggestions(savedGroups: SavedGroup[]): FilterSuggestion[] {
  const suggestions: FilterSuggestion[] = [];
  const seen = new Set<string>();

  const starters: FilterSuggestion[] = [
    { label: 'Full-time employees', condition: { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' } },
    { label: 'Active employees', condition: { type: 'condition', field: 'roleState', operator: 'is', value: 'active' } },
    { label: 'US-based', condition: { type: 'condition', field: 'country', operator: 'is', value: 'US' } },
    { label: 'Contractors', condition: { type: 'condition', field: 'employmentType', operator: 'is', value: 'contractor' } },
  ];
  for (const s of starters) {
    const key = `${s.condition.field}:${s.condition.operator}:${s.condition.value}`;
    if (!seen.has(key)) { seen.add(key); suggestions.push(s); }
  }

  for (const group of savedGroups) {
    const extract = (node: RuleNode) => {
      if (node.type === 'condition' && node.operator === 'is' && typeof node.value === 'string') {
        const key = `${node.field}:${node.operator}:${node.value}`;
        if (!seen.has(key)) {
          seen.add(key);
          const fl = fieldLabels[node.field] || node.field;
          const vl = formatValue(node.field, node.value);
          suggestions.push({ label: `${fl}: ${vl}`, condition: { type: 'condition', field: node.field, operator: node.operator, value: node.value } });
        }
      } else if (node.type === 'group') {
        node.children.forEach(extract);
      }
    };
    extract(group.rule);
  }
  return suggestions.slice(0, 12);
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
    return {
      status: 'excluded_by_layer',
      text: `Excluded by system filter "${layer.label}"`,
      layerLabel: layer.label,
      layerDescription: layer.description,
      conditions: [],
    };
  }

  const conditions: ConditionResult[] = [];
  function collect(node: RuleNode) {
    if (node.type === 'condition') {
      const fld = fieldLabels[node.field] || node.field;
      const actual = formatValue(node.field, (person as any)[node.field]);
      const expected = Array.isArray(node.value) ? node.value.map(v => formatValue(node.field, v)).join(', ') : formatValue(node.field, node.value as string);
      const opLabel = node.operator === 'is' ? 'is' : node.operator === 'is_not' ? 'is not' : node.operator === 'in' ? 'is one of' : node.operator === 'contains' ? 'contains' : node.operator === 'after' ? 'is after' : node.operator === 'before' ? 'is before' : node.operator;
      conditions.push({
        field: node.field,
        fieldLabel: fld,
        operator: opLabel,
        expected,
        actual,
        passed: evaluateRule(person, node),
      });
    } else {
      node.children.forEach(collect);
    }
  }
  collect(rule);

  const matched = evaluateRule(person, rule);
  if (!matched) {
    const failed = conditions.filter(c => !c.passed);
    return {
      status: 'excluded_by_rule',
      text: `Doesn't match: ${failed.map(c => `${c.fieldLabel} is "${c.actual}" (requires "${c.expected}")`).join('; ')}`,
      conditions,
    };
  }

  return {
    status: 'included',
    text: `Matches all conditions`,
    conditions,
  };
}

// ── Rule display (read-only fallback for complex rules) ──────────────────────

function ruleToReadableString(rule: RuleNode, depth: number = 0): string {
  if (rule.type === 'condition') {
    const fld = fieldLabels[rule.field] || rule.field;
    const val = Array.isArray(rule.value) ? rule.value.map(v => formatValue(rule.field, v)).join(', ') : formatValue(rule.field, rule.value as string);
    const opLabel = rule.operator === 'is' ? 'is' : rule.operator === 'is_not' ? 'is not' : rule.operator === 'in' ? 'is one of' : rule.operator === 'contains' ? 'contains' : rule.operator === 'after' ? 'is after' : rule.operator === 'before' ? 'is before' : rule.operator;
    return `${fld} ${opLabel} ${val}`;
  }
  const indent = '  '.repeat(depth);
  const parts = rule.children.map(c => ruleToReadableString(c, depth + 1));
  if (depth === 0) {
    return parts.join(`\n${rule.combinator} `);
  }
  return `(\n${indent}  ${parts.join(`\n${indent}  ${rule.combinator} `)}\n${indent})`;
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

// ── Reuse checking ────────────────────────────────────────────────────────────

function findMatchingGroups(rule: RuleGroup, savedGroups: SavedGroup[]): SavedGroup[] {
  // Simplified: check if any saved group has the same conditions
  const myConditions = new Set<string>();
  function extract(node: RuleNode) {
    if (node.type === 'condition') {
      myConditions.add(`${node.field}:${node.operator}:${JSON.stringify(node.value)}`);
    } else {
      node.children.forEach(extract);
    }
  }
  extract(rule);
  if (myConditions.size === 0) return [];

  return savedGroups.filter(g => {
    const gConditions = new Set<string>();
    function extractG(node: RuleNode) {
      if (node.type === 'condition') {
        gConditions.add(`${node.field}:${node.operator}:${JSON.stringify(node.value)}`);
      } else {
        node.children.forEach(extractG);
      }
    }
    extractG(g.rule);
    // At least half of conditions match
    let overlap = 0;
    for (const c of myConditions) {
      if (gConditions.has(c)) overlap++;
    }
    return overlap > 0 && overlap >= myConditions.size * 0.5;
  });
}

// ── Sensitivity tier helpers ──────────────────────────────────────────────────

function tierLabel(tier: SensitivityTier): string {
  return tier === 1 ? 'Critical' : tier === 2 ? 'Moderate' : 'Low';
}

function tierColor(tier: SensitivityTier) {
  return tier === 1 ? { bg: C.redLight, border: C.redBorder, text: C.red }
    : tier === 2 ? { bg: C.amberLight, border: C.amberBorder, text: C.amber }
    : { bg: C.accentLight, border: C.accentBorder, text: C.accent };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Evaluation layers indicator ──────────────────────────────────────────────

function EvaluationLayersIndicator({ matchCount, excludedByLayers, layers }: {
  matchCount: number;
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  layers: EvaluationLayer[];
}) {
  const [expanded, setExpanded] = useState(false);
  const totalExcluded = excludedByLayers.reduce((sum, x) => sum + x.people.length, 0);

  if (totalExcluded === 0) return null;

  return (
    <div style={{
      padding: '10px 14px', background: C.surfaceAlt, borderRadius: 8,
      border: `1px solid ${C.border}`, marginBottom: 14,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6, width: '100%',
          padding: 0, fontSize: 14, fontFamily: FONT, fontWeight: 500,
          color: C.textSecondary, textAlign: 'left',
        }}
      >
        <span style={{ fontWeight: 600, color: C.text }}>{matchCount}</span> match your filters.
        <span style={{
          fontWeight: 600, color: C.amber, background: C.amberLight,
          borderRadius: 9999, padding: '1px 8px', fontSize: 12, letterSpacing: 0.125,
        }}>{totalExcluded} excluded</span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.accent, fontWeight: 500 }}>
          {expanded ? 'Hide' : 'Details'}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid rgba(0,0,0,0.06)`, paddingTop: 10 }}>
          {excludedByLayers.map(({ layer, people }) => (
            <div key={layer.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 3 }}>
                {layer.label}
              </div>
              <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6 }}>
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
  );
}

// ── Population preview ──────────────────────────────────────────────────────

function PopulationPreview({ members, allPeople, rule, layers, compact }: {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  compact?: boolean;
}) {
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = compact ? 5 : 8;

  const total = members.length;
  const showFaces = total <= 20;

  if (total === 0) {
    return (
      <div style={{ padding: '18px 0', color: C.textMuted, fontSize: 14 }}>
        No one matches these conditions.
      </div>
    );
  }

  const explanation = selectedPerson ? explainPerson(selectedPerson, rule, layers) : null;

  return (
    <div>
      {/* Count header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        {!showFaces && (
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {members.slice(0, 5).map((p, i) => (
              <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 5 - i, position: 'relative' }}>
                <Avatar name={p.name} size={28} />
              </div>
            ))}
            {total > 5 && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: C.surfaceAlt, color: C.textSecondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 600, marginLeft: -8,
                border: '1px solid rgba(0,0,0,0.1)',
              }}>
                +{total - 5}
              </div>
            )}
          </div>
        )}
        <span style={{ fontSize: 16, fontWeight: 600, color: C.text }}>
          {total} {total === 1 ? 'person' : 'people'}
        </span>
      </div>

      {/* Person list */}
      {showFaces ? (
        <>
          {members.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(p => (
            <PersonRow key={p.id} person={p} onClick={() => setSelectedPerson(p)} selected={selectedPerson?.id === p.id} compact={compact} />
          ))}
          {total > PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
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
          {members.slice(0, showAll ? undefined : 5).map(p => (
            <PersonRow key={p.id} person={p} onClick={() => setSelectedPerson(p)} selected={selectedPerson?.id === p.id} compact={compact} />
          ))}
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
        </>
      )}

      {/* Explanation popover — structured per-condition pass/fail */}
      {selectedPerson && explanation && (
        <div style={{
          marginTop: 10, padding: '12px 14px',
          background: explanation.status === 'included' ? C.greenLight : explanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
          border: `1px solid ${C.border}`,
          borderRadius: 12, boxShadow: S.card,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={selectedPerson.name} size={24} />
              <span style={{ fontWeight: 600, fontSize: 14, color: C.text }}>{selectedPerson.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 0.125,
                padding: '2px 8px', borderRadius: 9999,
                background: explanation.status === 'included' ? C.greenLight : explanation.status === 'excluded_by_layer' ? C.amberLight : C.redLight,
                color: explanation.status === 'included' ? C.green : explanation.status === 'excluded_by_layer' ? C.amber : C.red,
                border: `1px solid ${explanation.status === 'included' ? C.greenBorder : explanation.status === 'excluded_by_layer' ? C.amberBorder : C.redBorder}`,
              }}>
                {explanation.status === 'included' ? 'Included' : explanation.status === 'excluded_by_layer' ? 'Excluded by system' : 'No match'}
              </span>
            </div>
            <button
              onClick={() => setSelectedPerson(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16 }}
            >
              ×
            </button>
          </div>

          {explanation.status === 'excluded_by_layer' && explanation.layerDescription && (
            <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 4 }}>
              {explanation.layerDescription}
            </div>
          )}

          {explanation.conditions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {explanation.conditions.map((cond, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', borderRadius: 6,
                  background: cond.passed ? 'rgba(42,157,153,0.06)' : 'rgba(211,45,45,0.06)',
                  fontSize: 13,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, width: 18, textAlign: 'center',
                    color: cond.passed ? C.green : C.red,
                  }}>
                    {cond.passed ? '✓' : '✗'}
                  </span>
                  <span style={{ fontWeight: 500, color: C.text }}>{cond.fieldLabel}</span>
                  <span style={{ color: C.textMuted }}>{cond.operator}</span>
                  <span style={{ color: C.text, fontWeight: 500 }}>{cond.expected}</span>
                  {!cond.passed && (
                    <span style={{ color: C.textMuted, marginLeft: 'auto', fontSize: 12 }}>
                      actual: {cond.actual}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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
        padding: compact ? '6px 8px' : '8px 10px',
        borderRadius: 8, border: 'none', width: '100%', textAlign: 'left',
        background: selected ? C.accentLight : 'transparent',
        cursor: 'pointer', fontFamily: FONT,
        transition: 'background 0.1s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
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

// ── Downstream impact / policies section ────────────────────────────────────

function DownstreamImpact({ policies, compact }: { policies: PolicyRef[]; compact?: boolean }) {
  if (policies.length === 0) return null;
  const [expanded, setExpanded] = useState(false);
  const totalAffected = policies.reduce((sum, p) => sum + p.affectedCount, 0);
  const highestTier = Math.min(...policies.map(p => p.sensitivityTier)) as SensitivityTier;
  const tc = tierColor(highestTier);

  return (
    <div style={{
      padding: compact ? '10px 12px' : '12px 16px',
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 12, boxShadow: S.card,
    }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          padding: 0, fontSize: 14, fontFamily: FONT, fontWeight: 500,
          color: C.text, textAlign: 'left',
        }}
      >
        <span style={{ fontWeight: 600 }}>
          Referenced by {policies.length} {policies.length === 1 ? 'policy' : 'policies'}
        </span>
        <span style={{ color: C.textSecondary, fontWeight: 400 }}>
          · {totalAffected.toLocaleString()} people affected
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 13, color: C.accent, fontWeight: 500 }}>
          {expanded ? 'Hide' : 'Details'}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: 10, borderTop: `1px solid rgba(0,0,0,0.06)`, paddingTop: 10 }}>
          {policies.map(p => {
            const pc = tierColor(p.sensitivityTier);
            return (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0',
                fontSize: 14,
              }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999,
                  background: pc.bg, color: pc.text,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                }}>
                  {tierLabel(p.sensitivityTier)}
                </span>
                <span style={{ fontWeight: 500, color: C.text }}>{p.name}</span>
                <span style={{ color: C.textSecondary, marginLeft: 'auto', fontSize: 13 }}>
                  {p.domain} · {p.affectedCount.toLocaleString()} people
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Population display (layout switcher) ────────────────────────────────────

interface PopulationDisplayProps {
  members: Person[];
  allPeople: Person[];
  rule: RuleGroup;
  layers: EvaluationLayer[];
  excludedByLayers: { layer: EvaluationLayer; people: Person[] }[];
  policies: PolicyRef[];
  compact?: boolean;
}

function PopulationDisplay({ variant, ...props }: PopulationDisplayProps & { variant: number }) {
  const Layout = [Layout1, Layout2, Layout3, Layout4, Layout5, Layout6, Layout7][variant - 1];
  if (!Layout) return null;
  return <Layout {...props} />;
}

// ── Change diff panel ───────────────────────────────────────────────────────

function ChangeDiff({ added, removed, policies }: {
  added: Person[];
  removed: Person[];
  policies: PolicyRef[];
}) {
  if (added.length === 0 && removed.length === 0) return null;

  const maxTier = policies.length > 0 ? Math.min(...policies.map(p => p.sensitivityTier)) as SensitivityTier : 3;
  const needsExplicitConfirm = maxTier === 1 || added.length + removed.length > 20;

  return (
    <div style={{
      padding: '14px 16px', background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: S.card,
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 12, letterSpacing: -0.125 }}>
        Changes preview
      </div>

      {added.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: 0.125,
            color: C.green, background: C.greenLight, borderRadius: 9999,
            display: 'inline-block', padding: '2px 10px', marginBottom: 6,
          }}>
            +{added.length} will be added
          </div>
          {added.slice(0, 5).map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
              <Avatar name={p.name} size={22} />
              <span style={{ color: C.text, fontWeight: 400 }}>{p.name}</span>
            </div>
          ))}
          {added.length > 5 && (
            <div style={{ fontSize: 13, color: C.textMuted, padding: '3px 0' }}>
              +{added.length - 5} more
            </div>
          )}
        </div>
      )}

      {removed.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, letterSpacing: 0.125,
            color: C.red, background: C.redLight, borderRadius: 9999,
            display: 'inline-block', padding: '2px 10px', marginBottom: 6,
          }}>
            −{removed.length} will be removed
          </div>
          {removed.slice(0, 5).map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 14 }}>
              <Avatar name={p.name} size={22} />
              <span style={{ color: C.text, fontWeight: 400 }}>{p.name}</span>
            </div>
          ))}
          {removed.length > 5 && (
            <div style={{ fontSize: 13, color: C.textMuted, padding: '3px 0' }}>
              +{removed.length - 5} more
            </div>
          )}
        </div>
      )}

      {policies.length > 0 && (
        <div style={{
          marginTop: 10, paddingTop: 10, borderTop: `1px solid rgba(0,0,0,0.06)`,
          fontSize: 13, color: C.textSecondary,
        }}>
          Affects {policies.length} downstream {policies.length === 1 ? 'policy' : 'policies'}
          {maxTier === 1 && (
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '2px 8px',
              background: C.redLight, color: C.red,
              borderRadius: 9999, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Critical
            </span>
          )}
        </div>
      )}

      {needsExplicitConfirm && (
        <div style={{
          marginTop: 12, padding: '10px 14px', background: C.amberLight,
          border: `1px solid ${C.border}`, borderRadius: 8,
          fontSize: 13, color: C.amber, fontWeight: 500,
        }}>
          This change requires explicit confirmation due to {maxTier === 1 ? 'critical policy impact' : 'large population change'}.
        </div>
      )}
    </div>
  );
}

// ── Reuse suggestions ───────────────────────────────────────────────────────

function ReuseSuggestions({ matches, onSelect }: {
  matches: SavedGroup[];
  onSelect: (group: SavedGroup) => void;
}) {
  if (matches.length === 0) return null;

  return (
    <div style={{
      padding: '12px 16px', background: C.purpleLight,
      border: `1px solid ${C.border}`, borderRadius: 12,
      marginBottom: 14,
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: C.purple, marginBottom: 8 }}>
        {matches.length} existing {matches.length === 1 ? 'group matches' : 'groups match'} these conditions
      </div>
      {matches.map(g => (
        <div key={g.id} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 0',
        }}>
          <div>
            <span style={{ fontWeight: 500, fontSize: 14, color: C.text }}>{g.name}</span>
            <span style={{ color: C.textSecondary, marginLeft: 8, fontSize: 13 }}>
              · {g.consumers.length} {g.consumers.length === 1 ? 'policy' : 'policies'}
            </span>
          </div>
          <button
            onClick={() => onSelect(g)}
            style={{
              background: C.purple, color: '#fff', border: 'none',
              borderRadius: 4, padding: '5px 12px', fontSize: 13, fontWeight: 600,
              fontFamily: FONT, cursor: 'pointer',
            }}
          >
            Use this group
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Read-only rule view (for rules the builder can't render) ────────────────

function ReadOnlyRuleView({ rule, onEditToggle }: {
  rule: RuleGroup;
  onEditToggle?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const ruleText = useMemo(() => ruleToReadableString(rule), [rule]);

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 12, fontWeight: 500, color: C.textSecondary,
          letterSpacing: 0.3,
        }}>
          This rule was authored via API and can't be edited in the builder.
        </span>
        {onEditToggle && (
          <button
            onClick={() => setEditing(!editing)}
            style={{
              background: 'transparent', border: 'none',
              padding: '4px 0', fontSize: 13, fontFamily: FONT, fontWeight: 500,
              color: C.accent, cursor: 'pointer',
            }}
          >
            {editing ? 'Cancel editing' : 'Edit rule'}
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            defaultValue={ruleText}
            style={{
              width: '100%', minHeight: 120, padding: 14, border: `1px solid ${C.border}`,
              borderRadius: 8, fontSize: 14, fontFamily: '"SF Mono", "Fira Code", monospace',
              color: C.text, background: C.surfaceAlt, outline: 'none', resize: 'vertical',
              boxSizing: 'border-box', lineHeight: 1.6,
            }}
          />
          <div style={{ fontSize: 13, color: C.textMuted, marginTop: 6 }}>
            Structured rule syntax. Changes will be validated before saving.
          </div>
        </div>
      ) : (
        <div style={{
          padding: '12px 16px', background: C.surfaceAlt,
          border: `1px solid ${C.border}`, borderRadius: 8,
          fontFamily: '"SF Mono", "Fira Code", monospace', fontSize: 14, color: C.text,
          whiteSpace: 'pre-wrap', lineHeight: 1.6,
        }}>
          {ruleText}
        </div>
      )}
    </div>
  );
}

// ── Legacy group banner ─────────────────────────────────────────────────────

function LegacyBanner() {
  return (
    <div style={{
      padding: '12px 16px', background: C.amberLight,
      border: `1px solid ${C.border}`, borderRadius: 8,
      marginBottom: 14,
    }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: C.amber, marginBottom: 4 }}>
        Legacy group — limited metadata
      </div>
      <div style={{ color: C.text, fontSize: 14, lineHeight: 1.5 }}>
        This group was created before the current system and is missing name, owner, and purpose metadata.
        Some features may be unavailable. Consider migrating to a new group with full metadata.
      </div>
    </div>
  );
}

// ── Group metadata header ───────────────────────────────────────────────────

function GroupHeader({ group, compact }: { group: SavedGroup; compact?: boolean }) {
  return (
    <div style={{ marginBottom: compact ? 10 : 16 }}>
      <div style={{
        fontSize: compact ? 18 : 22, fontWeight: 700, color: C.text,
        letterSpacing: -0.25, lineHeight: 1.27, marginBottom: 4,
      }}>
        {group.name || <span style={{ color: C.textMuted, fontStyle: 'italic' }}>Unnamed group</span>}
      </div>
      {group.purpose && (
        <div style={{ fontSize: 14, color: C.textSecondary, marginBottom: 6, lineHeight: 1.5 }}>
          {group.purpose}
        </div>
      )}
      {!compact && (
        <div style={{ fontSize: 13, color: C.textMuted, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {group.owner && <span>Owner: {group.owner}</span>}
          {group.productDomain && <span>Domain: {group.productDomain}</span>}
          <span>Modified {new Date(group.lastModifiedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
          <span>Evaluated {new Date(group.lastEvaluatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </div>
      )}
    </div>
  );
}

// ── Section wrapper ─────────────────────────────────────────────────────────

function Section({ label, children, style: extraStyle }: { label?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      padding: '14px 18px', background: C.surface,
      border: `1px solid ${C.border}`, borderRadius: 12,
      marginBottom: 12, boxShadow: S.card, ...extraStyle,
    }}>
      {label && (
        <div style={{
          fontSize: 12, fontWeight: 600, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: 0.5,
          marginBottom: 10,
        }}>
          {label}
        </div>
      )}
      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO VIEWS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Create mode ─────────────────────────────────────────────────────────────

function CreateView({ data, policyContext, inline, variant, highStakes }: {
  data: EntryState['data'];
  policyContext?: PolicyRef;
  inline?: boolean;
  variant: number;
  highStakes?: boolean;
}) {
  const [rule, setRule] = useState<RuleGroup>(() => createEmptyRuleGroup('AND'));
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [saved, setSaved] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);
  const [previewSnapshot, setPreviewSnapshot] = useState('');
  const [highStakesConfirmed, setHighStakesConfirmed] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const ruleSnapshot = useMemo(() => JSON.stringify(rule), [rule]);

  useEffect(() => {
    setPreviewReady(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewSnapshot(ruleSnapshot);
      setPreviewReady(true);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ruleSnapshot]);

  const layers: EvaluationLayer[] = useMemo(() => [
    {
      id: 'el-role-state',
      type: 'role_state' as const,
      label: 'Active employees only',
      description: 'System filter: only employees with active role status are included.',
      excludedPeopleIds: data.people.filter(p => p.roleState !== 'active').map(p => p.id),
    },
  ], [data.people]);

  const members = useMemo(() =>
    rule.children.length > 0 ? getMembersForRule(data.people, rule, layers) : [],
    [data.people, rule, layers]
  );
  const excludedByLayers = useMemo(() =>
    rule.children.length > 0 ? getExcludedByLayers(data.people, rule, layers) : [],
    [data.people, rule, layers]
  );
  const reuseMatches = useMemo(() =>
    rule.children.length > 0 ? findMatchingGroups(rule, data.savedGroups) : [],
    [rule, data.savedGroups]
  );

  const suggestions = useMemo(() => generateSuggestions(data.savedGroups), [data.savedGroups]);

  const hasValidConditions = ruleGroupHasValidConditions(rule);
  const canSave = hasValidConditions && previewReady && previewSnapshot === ruleSnapshot;
  const isHighStakes = highStakes || (policyContext && policyContext.sensitivityTier === 1);
  const saveBlocked = !canSave || (isHighStakes && !highStakesConfirmed);

  if (saved) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 14, color: C.green }}>&#10003;</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: -0.25 }}>
          Group created
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary }}>
          "{name || 'Untitled group'}" with {members.length} members
        </div>
      </div>
    );
  }

  return (
    <div>
      {policyContext && (
        <div style={{
          fontSize: 14, color: C.textSecondary, marginBottom: 12,
          padding: '8px 12px', background: C.surfaceAlt, borderRadius: 8,
        }}>
          Creating group for: <strong style={{ color: C.text }}>{policyContext.name}</strong>
          {isHighStakes && (
            <span style={{
              marginLeft: 8, fontSize: 11, fontWeight: 600, padding: '2px 8px',
              background: C.redLight, color: C.red,
              borderRadius: 9999, textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              Critical policy
            </span>
          )}
        </div>
      )}

      {!inline && (
        <Section>
          <div style={{ display: 'flex', gap: 12, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Group name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. US Full-Time Employees"
                style={{
                  width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                  borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.textMuted, display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Purpose</label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="What is this group for?"
              style={{
                width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
        </Section>
      )}

      <Section label="Conditions">
        <RuleGroupEditor
          group={rule}
          allPeople={data.people}
          onChange={setRule}
          suggestions={suggestions}
        />
      </Section>

      {/* Reuse suggestions */}
      {reuseMatches.length > 0 && (
        <ReuseSuggestions
          matches={reuseMatches}
          onSelect={g => {
            setName(g.name);
            setSaved(true);
          }}
        />
      )}

      {/* Population display */}
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        {LAYOUTS.find(l => l.key === variant)?.label ?? ''}
      </div>
      <PopulationDisplay
        variant={variant}
        members={members}
        allPeople={data.people}
        rule={rule}
        layers={layers}
        excludedByLayers={excludedByLayers}
        policies={policyContext ? [policyContext] : []}
        compact={inline}
      />

      {/* High-stakes confirmation */}
      {isHighStakes && hasValidConditions && (
        <div style={{
          padding: '12px 14px', background: C.redLight,
          border: `1px solid ${C.redBorder}`, borderRadius: 8,
          marginTop: 10, marginBottom: 4,
        }}>
          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            cursor: 'pointer', fontSize: 14, color: C.text, lineHeight: 1.5,
          }}>
            <input
              type="checkbox"
              checked={highStakesConfirmed}
              onChange={e => setHighStakesConfirmed(e.target.checked)}
              style={{ marginTop: 3, accentColor: C.red }}
            />
            <span>
              I confirm that this group will be used by a <strong>critical policy</strong>{policyContext ? ` (${policyContext.name})` : ''} and I have reviewed the {members.length}-person membership above.
            </span>
          </label>
        </div>
      )}

      {/* Save gate */}
      <div style={{ position: 'relative', marginTop: 4 }}>
        <button
          onClick={() => setSaved(true)}
          disabled={saveBlocked}
          style={{
            width: '100%', padding: '10px 16px',
            background: saveBlocked ? C.textMuted : C.accent,
            color: '#fff', border: 'none', borderRadius: 4,
            fontSize: 14, fontFamily: FONT, fontWeight: 600,
            cursor: saveBlocked ? 'default' : 'pointer',
            opacity: saveBlocked ? 0.5 : 1,
          }}
        >
          {inline ? 'Create & select group' : 'Create group'}
        </button>
        {!canSave && hasValidConditions && !previewReady && (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
            Computing membership preview…
          </div>
        )}
        {!hasValidConditions && (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
            Add at least one valid condition to create
          </div>
        )}
      </div>
    </div>
  );
}

// ── View mode ───────────────────────────────────────────────────────────────

function ViewMode({ group, data, inline, variant }: {
  group: SavedGroup;
  data: EntryState['data'];
  inline?: boolean;
  variant: number;
}) {
  const editorCanRender = canRenderInEditor(group.rule);
  const members = useMemo(() => getMembersForRule(data.people, group.rule, group.evaluationLayers), [data.people, group]);
  const excludedByLayers = useMemo(() => getExcludedByLayers(data.people, group.rule, group.evaluationLayers), [data.people, group]);

  return (
    <div>
      {group.isLegacy && <LegacyBanner />}

      <GroupHeader group={group} compact={inline} />

      {/* Rule display */}
      <Section label="Conditions">
        {editorCanRender ? (
          <RuleGroupEditor
            group={group.rule}
            allPeople={data.people}
            onChange={() => {}}
            readOnly
          />
        ) : (
          <ReadOnlyRuleView rule={group.rule} />
        )}
      </Section>

      {/* Population display */}
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        {LAYOUTS.find(l => l.key === variant)?.label ?? ''}
      </div>
      <PopulationDisplay
        variant={variant}
        members={members}
        allPeople={data.people}
        rule={group.rule}
        layers={group.evaluationLayers}
        excludedByLayers={excludedByLayers}
        policies={group.consumers}
        compact={inline}
      />
    </div>
  );
}

// ── Edit mode ───────────────────────────────────────────────────────────────

function EditMode({ group, data, inline, variant }: {
  group: SavedGroup;
  data: EntryState['data'];
  inline?: boolean;
  variant: number;
}) {
  const editorCanRender = canRenderInEditor(group.rule);

  const [currentRule, setCurrentRule] = useState<RuleGroup>(group.rule);
  const [saved, setSaved] = useState(false);
  const [previewReady, setPreviewReady] = useState(true);
  const [previewSnapshot, setPreviewSnapshot] = useState(() => JSON.stringify(group.rule));
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const ruleSnapshot = useMemo(() => JSON.stringify(currentRule), [currentRule]);

  useEffect(() => {
    setPreviewReady(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPreviewSnapshot(ruleSnapshot);
      setPreviewReady(true);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [ruleSnapshot]);

  const suggestions = useMemo(() => generateSuggestions(data.savedGroups), [data.savedGroups]);

  const layers = group.evaluationLayers;

  const originalMembers = useMemo(() => getMembersForRule(data.people, group.rule, layers), [data.people, group, layers]);
  const currentMembers = useMemo(() =>
    currentRule.children.length > 0 ? getMembersForRule(data.people, currentRule, layers) : [],
    [data.people, currentRule, layers]
  );
  const excludedByLayers = useMemo(() =>
    currentRule.children.length > 0 ? getExcludedByLayers(data.people, currentRule, layers) : [],
    [data.people, currentRule, layers]
  );

  const originalIds = useMemo(() => new Set(originalMembers.map(p => p.id)), [originalMembers]);
  const currentIds = useMemo(() => new Set(currentMembers.map(p => p.id)), [currentMembers]);
  const added = useMemo(() => currentMembers.filter(p => !originalIds.has(p.id)), [currentMembers, originalIds]);
  const removed = useMemo(() => originalMembers.filter(p => !currentIds.has(p.id)), [originalMembers, currentIds]);
  const hasChanges = added.length > 0 || removed.length > 0;

  const canSave = hasChanges && previewReady && previewSnapshot === ruleSnapshot;

  if (saved) {
    return (
      <div style={{ padding: 32, textAlign: 'center' }}>
        <div style={{ fontSize: 36, marginBottom: 14, color: C.green }}>&#10003;</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6, letterSpacing: -0.25 }}>
          Group updated
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary }}>
          "{group.name}" now has {currentMembers.length} members
          {added.length > 0 && <span style={{ color: C.green }}> (+{added.length})</span>}
          {removed.length > 0 && <span style={{ color: C.red }}> (−{removed.length})</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <GroupHeader group={group} compact={inline} />

      <Section label="Conditions">
        {editorCanRender ? (
          <RuleGroupEditor
            group={currentRule}
            allPeople={data.people}
            onChange={setCurrentRule}
            suggestions={suggestions}
          />
        ) : (
          <ReadOnlyRuleView rule={group.rule} onEditToggle={() => {}} />
        )}
      </Section>

      {/* Population display */}
      <div style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
        {LAYOUTS.find(l => l.key === variant)?.label ?? ''}
      </div>
      <PopulationDisplay
        variant={variant}
        members={currentMembers}
        allPeople={data.people}
        rule={currentRule}
        layers={layers}
        excludedByLayers={excludedByLayers}
        policies={group.consumers}
        compact={inline}
      />

      {/* Change diff */}
      {hasChanges && (
        <div style={{ marginBottom: 10 }}>
          <ChangeDiff added={added} removed={removed} policies={group.consumers} />
        </div>
      )}

      {/* Save gate */}
      <div style={{ position: 'relative', marginTop: 8 }}>
        <button
          onClick={() => setSaved(true)}
          disabled={!canSave}
          style={{
            width: '100%', padding: '10px 16px',
            background: canSave ? C.accent : C.textMuted,
            color: '#fff', border: 'none', borderRadius: 4,
            fontSize: 14, fontFamily: FONT, fontWeight: 600,
            cursor: canSave ? 'pointer' : 'default',
            opacity: canSave ? 1 : 0.5,
          }}
        >
          Save changes
        </button>
        {!previewReady && hasChanges && (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
            Computing membership preview…
          </div>
        )}
        {!hasChanges && (
          <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, textAlign: 'center' }}>
            Make changes to the conditions to save
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline select mode ──────────────────────────────────────────────────────

function InlineSelectMode({ data, policyContext, variant }: {
  data: EntryState['data'];
  policyContext: PolicyRef;
  variant: number;
}) {
  const [mode, setMode] = useState<'browse' | 'create'>('browse');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SavedGroup | null>(null);

  const filtered = useMemo(() => {
    if (!search) return data.savedGroups.filter(g => !g.isLegacy);
    const lower = search.toLowerCase();
    return data.savedGroups.filter(g =>
      !g.isLegacy && (g.name.toLowerCase().includes(lower) || g.purpose.toLowerCase().includes(lower))
    );
  }, [data.savedGroups, search]);

  if (selected) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 10, color: C.green }}>&#10003;</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4, letterSpacing: -0.125 }}>
          Group selected
        </div>
        <div style={{ fontSize: 14, color: C.textSecondary }}>
          "{selected.name}" assigned to {policyContext.name}
        </div>
      </div>
    );
  }

  if (mode === 'create') {
    return (
      <div>
        <button
          onClick={() => setMode('browse')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.accent, fontSize: 14, fontFamily: FONT, fontWeight: 500,
            padding: '4px 0', marginBottom: 10,
          }}
        >
          ← Back to browse
        </button>
        <CreateView data={data} policyContext={policyContext} inline variant={variant} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 10, letterSpacing: -0.125 }}>
        Select a group for {policyContext.name}
      </div>

      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search groups..."
        style={{
          width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`,
          borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface,
          outline: 'none', boxSizing: 'border-box', marginBottom: 10,
        }}
      />

      <div>
        {filtered.map(g => {
          const memberCount = getMembersForRule(data.people, g.rule, g.evaluationLayers).length;
          return (
            <button
              key={g.id}
              onClick={() => setSelected(g)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 14px', border: `1px solid ${C.border}`,
                borderRadius: 12, background: C.surface, cursor: 'pointer',
                marginBottom: 6, textAlign: 'left', fontFamily: FONT,
                boxShadow: S.card, transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
              onMouseLeave={e => (e.currentTarget.style.background = C.surface)}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{g.name}</div>
                <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 2 }}>{g.purpose}</div>
              </div>
              <div style={{
                fontSize: 13, color: C.textMuted, whiteSpace: 'nowrap', marginLeft: 10,
              }}>
                {memberCount} members
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={() => setMode('create')}
        style={{
          width: '100%', padding: '10px', marginTop: 10,
          background: 'rgba(0,0,0,0.04)', border: 'none',
          borderRadius: 4, color: C.accent, fontSize: 14, fontFamily: FONT, fontWeight: 600,
          cursor: 'pointer', transition: 'background 0.1s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.06)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.04)')}
      >
        + Create new group
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function ConceptE({ entryState }: { entryState: EntryState }) {
  const data = useMemo(() => buildExtendedData(entryState.data), [entryState.data]);
  const isInline = entryState.context === 'inline';
  const [layoutVariant, setLayoutVariant] = useState(7);

  const content = useMemo(() => {
    const scenario = entryState.scenario;

    switch (scenario.type) {
      case 'create':
        return (
          <CreateView
            data={data}
            policyContext={scenario.policyContext}
            inline={isInline}
            variant={layoutVariant}
          />
        );

      case 'view': {
        const group = data.savedGroups.find(g => g.id === scenario.groupId);
        if (!group) {
          return <div style={{ padding: 20, color: C.red }}>Group not found: {scenario.groupId}</div>;
        }
        return <ViewMode group={group} data={data} inline={isInline} variant={layoutVariant} />;
      }

      case 'edit': {
        const group = data.savedGroups.find(g => g.id === scenario.groupId);
        if (!group) {
          return <div style={{ padding: 20, color: C.red }}>Group not found: {scenario.groupId}</div>;
        }
        return <EditMode group={group} data={data} inline={isInline} variant={layoutVariant} />;
      }

      case 'inline-select':
        return (
          <InlineSelectMode
            data={data}
            policyContext={scenario.policyContext}
            variant={layoutVariant}
          />
        );

      default:
        return <div style={{ padding: 20, color: C.textMuted }}>Unknown scenario</div>;
    }
  }, [entryState.scenario, data, isInline, layoutVariant]);

  return (
    <div style={{
      maxWidth: isInline ? 480 : 660,
      margin: '0 auto',
      padding: isInline ? 14 : 24,
      fontFamily: FONT,
      color: C.text,
      fontSize: 14,
      lineHeight: 1.5,
      background: isInline ? C.bg : C.surfaceAlt,
      minHeight: '100vh',
      boxSizing: 'border-box',
    }}>
      {content}

      {/* Floating layout HUD */}
      <div style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
        background: '#ffffff', boxShadow: S.deep,
        borderRadius: 12, padding: 8,
      }}>
        <div style={{
          fontSize: 10, fontWeight: 600, color: C.textMuted,
          textTransform: 'uppercase', letterSpacing: '0.5px',
          marginBottom: 6, textAlign: 'center',
        }}>
          Layout
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {LAYOUTS.map(l => (
            <div key={l.key} style={{ position: 'relative' }}>
              <button
                onClick={() => setLayoutVariant(l.key)}
                title={l.label}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: 'none',
                  cursor: 'pointer', fontSize: 16, fontFamily: FONT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: layoutVariant === l.key ? C.accent : 'transparent',
                  color: layoutVariant === l.key ? '#ffffff' : C.textSecondary,
                  transition: 'background 0.15s, color 0.15s',
                }}
                onMouseEnter={e => {
                  if (layoutVariant !== l.key) {
                    (e.currentTarget as HTMLElement).style.background = C.surfaceAlt;
                  }
                }}
                onMouseLeave={e => {
                  if (layoutVariant !== l.key) {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                  }
                }}
              >
                {l.icon}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import type {
  EntryState,
  Person,
  SavedGroup,
  RuleGroup,
  RuleCondition,
  RuleNode,
  EvaluationLayer,
  PolicyRef,
} from '../shell/types';

// ── Color tokens ──────────────────────────────────────────────────────────────

const C = {
  bg: '#F8F7F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F3F2EF',
  border: '#E2E0DA',
  borderStrong: '#C8C5BD',
  text: '#1A1916',
  textSecondary: '#6B6860',
  textMuted: '#9B9890',
  accent: '#2563EB',
  accentLight: '#EFF6FF',
  accentBorder: '#BFDBFE',
  green: '#16A34A',
  greenLight: '#F0FDF4',
  greenBorder: '#BBF7D0',
  amber: '#D97706',
  amberLight: '#FFFBEB',
  amberBorder: '#FDE68A',
  red: '#DC2626',
  redLight: '#FEF2F2',
  redBorder: '#FECACA',
  purple: '#7C3AED',
  purpleLight: '#F5F3FF',
  purpleBorder: '#DDD6FE',
};

// ── Field labels ──────────────────────────────────────────────────────────────

const fieldLabels: Record<string, string> = {
  department: 'department',
  location: 'location',
  country: 'country',
  employmentType: 'employment type',
  roleState: 'role status',
  startDate: 'start date',
  title: 'title',
};

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

// ── Extended mock data (local only — do not touch ../shell/mockData.ts) ───────

const additionalPeople: Person[] = [
  { id: 'p-ext-01', name: 'Priya Sharma', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-03-12', title: 'Staff Engineer' },
  { id: 'p-ext-02', name: 'Marcus Thompson', department: 'Sales', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-07-05', title: 'Account Executive' },
  { id: 'p-ext-03', name: 'Elena Vasquez', department: 'Finance', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-01-15', title: 'Senior Financial Analyst' },
  { id: 'p-ext-04', name: 'James Okafor', department: 'Engineering', location: 'London', country: 'UK', employmentType: 'contractor', roleState: 'active', startDate: '2024-06-01', title: 'Backend Engineer' },
  { id: 'p-ext-05', name: 'Sophie Laurent', department: 'Marketing', location: 'Berlin', country: 'DE', employmentType: 'full_time', roleState: 'active', startDate: '2023-09-18', title: 'Content Lead' },
  { id: 'p-ext-06', name: 'David Kim', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-11-01', title: 'HR Business Partner' },
  { id: 'p-ext-07', name: 'Aisha Mohammed', department: 'Legal', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-02-28', title: 'Senior Counsel' },
  { id: 'p-ext-08', name: 'Tom Brennan', department: 'Operations', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-05-22', title: 'Operations Manager' },
  { id: 'p-ext-09', name: 'Yuki Tanaka', department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-08-12', title: 'Frontend Engineer' },
  { id: 'p-ext-10', name: 'Carlos Mendez', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-10-30', title: 'Sales Engineer' },
  { id: 'p-ext-11', name: 'Fiona Walsh', department: 'Finance', location: 'London', country: 'UK', employmentType: 'full_time', roleState: 'active', startDate: '2024-03-15', title: 'Financial Controller' },
  { id: 'p-ext-12', name: 'Raj Patel', department: 'Engineering', location: 'Toronto', country: 'CA', employmentType: 'contractor', roleState: 'active', startDate: '2024-09-01', title: 'Platform Engineer' },
  { id: 'p-ext-13', name: 'Natalie Chen', department: 'Marketing', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-12-05', title: 'Growth Manager' },
  { id: 'p-ext-14', name: 'Ben Adeyemi', department: 'Engineering', location: 'London', country: 'UK', employmentType: 'full_time', roleState: 'active', startDate: '2023-08-14', title: 'Engineering Manager' },
  { id: 'p-ext-15', name: 'Sarah Mitchell', department: 'HR', location: 'New York', country: 'US', employmentType: 'part_time', roleState: 'active', startDate: '2024-04-01', title: 'Recruiter' },
  { id: 'p-ext-16', name: 'Leo Gruber', department: 'Engineering', location: 'Berlin', country: 'DE', employmentType: 'contractor', roleState: 'pending', startDate: '2026-03-10', title: 'ML Engineer' },
  { id: 'p-ext-17', name: 'Amara Diallo', department: 'Sales', location: 'London', country: 'UK', employmentType: 'full_time', roleState: 'active', startDate: '2024-05-20', title: 'Enterprise Account Manager' },
  { id: 'p-ext-18', name: 'Kevin Park', department: 'Operations', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2023-06-07', title: 'IT Operations Lead' },
  { id: 'p-ext-19', name: 'Isabelle Fontaine', department: 'Legal', location: 'Toronto', country: 'CA', employmentType: 'full_time', roleState: 'active', startDate: '2024-07-22', title: 'Legal Operations Manager' },
  { id: 'p-ext-20', name: 'Omar Khalil', department: 'Finance', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'pending', startDate: '2026-03-25', title: 'Treasury Analyst' },
  { id: 'p-ext-21', name: 'Grace Nwosu', department: 'Engineering', location: 'Austin', country: 'US', employmentType: 'full_time', roleState: 'active', startDate: '2024-10-14', title: 'Security Engineer' },
  { id: 'p-ext-22', name: 'Daniel Richter', department: 'Marketing', location: 'Berlin', country: 'DE', employmentType: 'part_time', roleState: 'active', startDate: '2024-11-01', title: 'Brand Designer' },
  { id: 'p-ext-23', name: 'Mei Lin', department: 'HR', location: 'San Francisco', country: 'US', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-02-15', title: 'HR Director' },
  { id: 'p-ext-24', name: 'Alex Torres', department: 'Sales', location: 'Austin', country: 'US', employmentType: 'contractor', roleState: 'active', startDate: '2025-01-06', title: 'Solutions Consultant' },
  { id: 'p-ext-25', name: 'Nina Johansson', department: 'Finance', location: 'London', country: 'UK', employmentType: 'full_time', roleState: 'terminated', startDate: '2023-04-10', title: 'VP Finance' },
  { id: 'p-ext-26', name: 'Patrick Dube', department: 'Engineering', location: 'Toronto', country: 'CA', employmentType: 'full_time', roleState: 'active', startDate: '2024-12-02', title: 'Senior Backend Engineer' },
  { id: 'p-ext-27', name: 'Layla Hassan', department: 'Legal', location: 'New York', country: 'US', employmentType: 'full_time', roleState: 'pending', startDate: '2026-03-15', title: 'Associate Counsel' },
  { id: 'p-ext-28', name: 'Chris Wong', department: 'Operations', location: 'San Francisco', country: 'US', employmentType: 'contractor', roleState: 'active', startDate: '2025-03-01', title: 'Project Manager' },
  { id: 'p-ext-29', name: 'Fatima Al-Rashid', department: 'Engineering', location: 'London', country: 'UK', employmentType: 'full_time', roleState: 'active', startDate: '2025-02-14', title: 'Data Engineer' },
  { id: 'p-ext-30', name: 'Ryan O\'Sullivan', department: 'Sales', location: 'New York', country: 'US', employmentType: 'part_time', roleState: 'active', startDate: '2024-09-30', title: 'Sales Development Rep' },
];

// ── Core helpers ──────────────────────────────────────────────────────────────

function evaluateRule(person: Person, rule: RuleNode): boolean {
  if (rule.type === 'condition') {
    const val = (person as any)[rule.field];
    switch (rule.operator) {
      case 'is': return val === rule.value;
      case 'is_not': return val !== rule.value;
      case 'in': return Array.isArray(rule.value) && rule.value.includes(val);
      case 'contains': return typeof val === 'string' && val.includes(rule.value as string);
      case 'greater_than': return val > rule.value;
      case 'less_than': return val < rule.value;
      case 'after': return val > rule.value;
      case 'before': return val < rule.value;
      default: return false;
    }
  }
  const children = rule.children.map(c => evaluateRule(person, c));
  return rule.combinator === 'AND' ? children.every(Boolean) : children.some(Boolean);
}

function getMembersForRule(people: Person[], rule: RuleGroup, layers: EvaluationLayer[]): string[] {
  const excludedByLayers = new Set(layers.flatMap(l => l.excludedPeopleIds));
  return people
    .filter(p => evaluateRule(p, rule) && !excludedByLayers.has(p.id))
    .map(p => p.id);
}

function ruleToSentence(rule: RuleNode): string {
  if (rule.type === 'condition') {
    const field = fieldLabels[rule.field] || rule.field;
    const val = Array.isArray(rule.value)
      ? rule.value.map(v => formatValue(rule.field, v)).join(', ')
      : formatValue(rule.field, rule.value as string);
    switch (rule.operator) {
      case 'is': return `${field} is ${val}`;
      case 'is_not': return `${field} is not ${val}`;
      case 'in': return `${field} is one of ${val}`;
      case 'contains': return `${field} contains "${val}"`;
      case 'after': return `${field} is after ${val}`;
      case 'before': return `${field} is before ${val}`;
      default: return `${field} ${rule.operator} ${val}`;
    }
  }
  const parts = rule.children.map(c => ruleToSentence(c));
  const joiner = rule.combinator === 'AND' ? ' and ' : ' or ';
  if (parts.length === 1) return parts[0];
  return parts.join(joiner);
}

function formatValue(field: string, val: string): string {
  if (field === 'employmentType') return employmentTypeLabels[val] || val;
  if (field === 'roleState') return roleStateLabels[val] || val;
  return val;
}

function explainPersonMembership(person: Person, rule: RuleGroup, layers: EvaluationLayer[]): string {
  const layerExcluding = layers.find(l => l.excludedPeopleIds.includes(person.id));
  if (layerExcluding) {
    if (layerExcluding.type === 'role_state') {
      return `${person.name} is excluded by a system filter because their role status is "${roleStateLabels[person.roleState] || person.roleState}" — they haven't completed onboarding or are no longer active.`;
    }
    return `${person.name} is excluded by the "${layerExcluding.label}" filter: ${layerExcluding.description}`;
  }
  const matched = evaluateRule(person, rule);
  if (!matched) {
    const mismatches: string[] = [];
    function collectMismatches(node: RuleNode) {
      if (node.type === 'condition') {
        if (!evaluateRule(person, node)) {
          const field = fieldLabels[node.field] || node.field;
          const actual = formatValue(node.field, (person as any)[node.field]);
          const expected = Array.isArray(node.value)
            ? node.value.map(v => formatValue(node.field, v)).join(', ')
            : formatValue(node.field, node.value as string);
          mismatches.push(`their ${field} is "${actual}" (rule requires "${expected}")`);
        }
      } else {
        node.children.forEach(collectMismatches);
      }
    }
    collectMismatches(rule);
    return `${person.name} doesn't match because ${mismatches.join(' and ') || "they don't meet the rule conditions"}.`;
  }
  const attrs: string[] = [];
  function collectMatches(node: RuleNode) {
    if (node.type === 'condition') {
      const field = fieldLabels[node.field] || node.field;
      const val = Array.isArray(node.value)
        ? node.value.map(v => formatValue(node.field, v)).join(', ')
        : formatValue(node.field, node.value as string);
      attrs.push(`${field} is ${val}`);
    } else {
      node.children.forEach(collectMatches);
    }
  }
  collectMatches(rule);
  return `${person.name} is in this group because their ${attrs.join(', and their ')}.`;
}

function findSharedAttributes(people: Person[]): Array<{ field: string; value: string; count: number }> {
  if (people.length === 0) return [];
  const fields: Array<keyof Person> = ['department', 'location', 'country', 'employmentType', 'roleState'];
  const results: Array<{ field: string; value: string; count: number }> = [];
  for (const field of fields) {
    const valueCounts = new Map<string, number>();
    for (const p of people) {
      const v = String(p[field]);
      valueCounts.set(v, (valueCounts.get(v) || 0) + 1);
    }
    const sorted = [...valueCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      const [topVal, topCount] = sorted[0];
      if (topCount >= Math.ceil(people.length * 0.6)) {
        results.push({ field, value: topVal, count: topCount });
      }
    }
  }
  return results.sort((a, b) => b.count - a.count);
}

// ── Date helpers for living-population simulation ─────────────────────────────

const TODAY = new Date('2026-04-02');
const THIRTY_DAYS_AGO = new Date(TODAY.getTime() - 30 * 24 * 60 * 60 * 1000);

function isRecentlyJoined(person: Person): boolean {
  const d = new Date(person.startDate);
  return d >= THIRTY_DAYS_AGO && d <= TODAY;
}

function simulateRecentChanges(
  people: Person[],
  rule: RuleGroup,
  layers: EvaluationLayer[]
): { added: Person[]; removed: Person[] } {
  // "Added": people matching the rule who joined in the last 30 days
  const excluded = new Set(layers.flatMap(l => l.excludedPeopleIds));
  const added = people.filter(p =>
    evaluateRule(p, rule) && !excluded.has(p.id) && isRecentlyJoined(p) && p.roleState !== 'terminated'
  );
  // "Removed": simulate by finding terminated or role-changed people who matched the rule
  const removed = people.filter(p =>
    evaluateRule({ ...p, roleState: 'active' } as Person, rule) &&
    (p.roleState === 'terminated' || p.roleState === 'pending') &&
    new Date(p.startDate) < THIRTY_DAYS_AGO
  ).slice(0, 2);
  return { added, removed };
}

// ── Natural language rule parser ──────────────────────────────────────────────

interface ParsedCondition {
  field: string;
  operator: RuleCondition['operator'];
  value: string;
  label: string;
}

function parseAttributePhrase(text: string, people: Person[]): ParsedCondition[] {
  const conditions: ParsedCondition[] = [];
  const lower = text.toLowerCase().trim();

  // Departments
  const depts = [...new Set(people.map(p => p.department))];
  for (const dept of depts) {
    if (lower.includes(dept.toLowerCase())) {
      conditions.push({ field: 'department', operator: 'is', value: dept, label: `Department: ${dept}` });
    }
  }
  // Locations
  const locs = [...new Set(people.map(p => p.location))];
  for (const loc of locs) {
    if (lower.includes(loc.toLowerCase())) {
      conditions.push({ field: 'location', operator: 'is', value: loc, label: `Location: ${loc}` });
    }
  }
  // Employment type keywords
  if (lower.includes('full-time') || lower.includes('full time') || lower.includes('fulltime') || lower.includes('fte')) {
    conditions.push({ field: 'employmentType', operator: 'is', value: 'full_time', label: 'Employment: Full-time' });
  }
  if (lower.includes('part-time') || lower.includes('part time')) {
    conditions.push({ field: 'employmentType', operator: 'is', value: 'part_time', label: 'Employment: Part-time' });
  }
  if (lower.includes('contractor') || lower.includes('contract')) {
    conditions.push({ field: 'employmentType', operator: 'is', value: 'contractor', label: 'Employment: Contractor' });
  }
  // Country
  if (lower.includes(' us ') || lower.includes('united states') || lower.includes(' usa') || lower.endsWith(' us')) {
    conditions.push({ field: 'country', operator: 'is', value: 'US', label: 'Country: United States' });
  }
  if (lower.includes('uk') || lower.includes('united kingdom')) {
    conditions.push({ field: 'country', operator: 'is', value: 'UK', label: 'Country: United Kingdom' });
  }
  if (lower.includes('canada') || lower.includes(' ca ') || lower.includes(' ca')) {
    conditions.push({ field: 'country', operator: 'is', value: 'CA', label: 'Country: Canada' });
  }

  return conditions;
}

function conditionsToRule(conditions: ParsedCondition[]): RuleGroup | null {
  if (conditions.length === 0) return null;
  return {
    type: 'group',
    combinator: 'AND',
    children: conditions.map(c => ({
      type: 'condition' as const,
      field: c.field,
      operator: c.operator,
      value: c.value,
    })),
  };
}

// ── Avatar component ──────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  ['#DBEAFE', '#1D4ED8'], ['#D1FAE5', '#065F46'], ['#FEE2E2', '#991B1B'],
  ['#EDE9FE', '#5B21B6'], ['#FEF3C7', '#92400E'], ['#FCE7F3', '#9D174D'],
  ['#E0E7FF', '#3730A3'], ['#F0FDF4', '#166534'],
];

function getAvatarColors(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xFFFF;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function Avatar({ person, size = 32 }: { person: Person; size?: number }) {
  const [bg, fg] = getAvatarColors(person.name);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color: fg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.35, fontWeight: 600, flexShrink: 0,
      border: `1px solid ${fg}22`,
    }}>
      {initials(person.name)}
    </div>
  );
}

// ── Population canvas (attribute chips) ──────────────────────────────────────

function AttributeChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      background: C.accentLight, color: C.accent,
      border: `1px solid ${C.accentBorder}`,
      borderRadius: 6, padding: '3px 8px 3px 10px',
      fontSize: 13, fontWeight: 500,
    }}>
      {label}
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: C.accent, opacity: 0.7, padding: '0 2px',
        fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center',
      }}>×</button>
    </span>
  );
}

// ── Person row ────────────────────────────────────────────────────────────────

function PersonRow({
  person, onWhyClick, onFlagClick, trailing,
}: {
  person: Person;
  onWhyClick?: () => void;
  onFlagClick?: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
      borderBottom: `1px solid ${C.border}`,
    }}>
      <Avatar person={person} size={32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {person.name}
          {person.roleState === 'pending' && (
            <span style={{ marginLeft: 6, fontSize: 11, color: C.amber, background: C.amberLight, border: `1px solid ${C.amberBorder}`, borderRadius: 4, padding: '1px 5px' }}>Pending</span>
          )}
          {person.roleState === 'terminated' && (
            <span style={{ marginLeft: 6, fontSize: 11, color: C.red, background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 4, padding: '1px 5px' }}>Terminated</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: C.textSecondary }}>
          {person.title} · {person.department} · {person.location}
        </div>
      </div>
      {trailing}
      {onWhyClick && (
        <button onClick={onWhyClick} style={{
          background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '3px 8px', fontSize: 12, color: C.textSecondary, cursor: 'pointer',
        }}>
          Why?
        </button>
      )}
      {onFlagClick && (
        <button onClick={onFlagClick} style={{
          background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
          padding: '3px 8px', fontSize: 12, color: C.textSecondary, cursor: 'pointer',
        }}>
          Shouldn't be here
        </button>
      )}
    </div>
  );
}

// ── Population summary (scale transition) ────────────────────────────────────

function PopulationSummary({
  members, allPeople, onWhyClick, label,
}: {
  members: Person[];
  allPeople: Person[];
  onWhyClick?: (person: Person) => void;
  label?: string;
}) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 8;
  const total = members.length;
  const showFaces = total <= 20;

  if (total === 0) {
    return (
      <div style={{ padding: '16px 0', color: C.textMuted, fontSize: 14, fontStyle: 'italic' }}>
        No one matches these conditions yet.
      </div>
    );
  }

  if (showFaces) {
    const start = page * PAGE_SIZE;
    const paginated = members.slice(start, start + PAGE_SIZE);
    return (
      <div>
        {label && <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>{label}</div>}
        {paginated.map(p => (
          <PersonRow key={p.id} person={p} onWhyClick={onWhyClick ? () => onWhyClick(p) : undefined} />
        ))}
        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0' }}>
            <span style={{ fontSize: 13, color: C.textSecondary }}>{start + 1}–{Math.min(start + PAGE_SIZE, total)} of {total}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', opacity: page === 0 ? 0.4 : 1 }}>
                Prev
              </button>
              <button onClick={() => setPage(p => p + 1)} disabled={start + PAGE_SIZE >= total}
                style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer', opacity: start + PAGE_SIZE >= total ? 0.4 : 1 }}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Scale mode: show summary + sample
  const sample = members.slice(0, 5);
  const rest = total - sample.length;
  return (
    <div>
      {label && <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>{label}</div>}
      <div style={{
        display: 'flex', alignItems: 'center', gap: -6, marginBottom: 10,
      }}>
        {sample.map((p, i) => (
          <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: sample.length - i }}>
            <Avatar person={p} size={32} />
          </div>
        ))}
        {rest > 0 && (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: C.surfaceAlt, color: C.textSecondary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 600, marginLeft: -8,
            border: `1px solid ${C.border}`,
          }}>
            +{rest}
          </div>
        )}
        <span style={{ marginLeft: 12, fontSize: 14, fontWeight: 600, color: C.text }}>{total} people</span>
      </div>
      <div>
        {sample.map(p => (
          <PersonRow key={p.id} person={p} onWhyClick={onWhyClick ? () => onWhyClick(p) : undefined} />
        ))}
        {page === 0 && rest > 0 && (
          <button onClick={() => setPage(1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: C.accent, fontSize: 13, padding: '6px 0',
          }}>
            Show all {total} people
          </button>
        )}
        {page === 1 && members.slice(5).map(p => (
          <PersonRow key={p.id} person={p} onWhyClick={onWhyClick ? () => onWhyClick(p) : undefined} />
        ))}
      </div>
    </div>
  );
}

// ── Living population proof (Recent changes) ──────────────────────────────────

function RecentChangesSection({ added, removed }: { added: Person[]; removed: Person[] }) {
  if (added.length === 0 && removed.length === 0) {
    return (
      <div style={{
        borderRadius: 10, border: `1px solid ${C.greenBorder}`,
        background: C.greenLight, padding: '14px 16px', marginTop: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.green, marginBottom: 4 }}>
          Living population — stable last 30 days
        </div>
        <div style={{ fontSize: 13, color: '#166534' }}>
          No one would have been added or removed if this rule had been active for the past month. The population has been consistent.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      borderRadius: 10, border: `1px solid ${C.accentBorder}`,
      background: C.accentLight, padding: '14px 16px', marginTop: 16,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
        If this rule had been active for the last 30 days:
      </div>
      {added.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 6 }}>
            +{added.length} would have been added
          </div>
          {added.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <Avatar person={p} size={24} />
              <span style={{ fontSize: 13, color: C.text }}>
                <strong>{p.name}</strong> — joined {p.department} on {new Date(p.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
          ))}
        </div>
      )}
      {removed.length > 0 && (
        <div>
          <div style={{ fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 6 }}>
            -{removed.length} would have been removed
          </div>
          {removed.map(p => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <Avatar person={p} size={24} />
              <span style={{ fontSize: 13, color: C.text }}>
                <strong>{p.name}</strong> — {p.roleState === 'terminated' ? 'left the company' : 'transferred out of scope'}
              </span>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: C.accent, opacity: 0.8, borderTop: `1px solid ${C.accentBorder}`, paddingTop: 8 }}>
        This is what makes a dynamic group powerful — it would have stayed accurate automatically, without you updating it.
      </div>
    </div>
  );
}

// ── Blast radius warning ──────────────────────────────────────────────────────

function BlastRadiusWarning({ policies }: { policies: PolicyRef[] }) {
  if (policies.length === 0) return null;
  const total = policies.reduce((sum, p) => sum + p.affectedCount, 0);
  const maxTier = Math.max(...policies.map(p => p.sensitivityTier)) as 1 | 2 | 3;
  const colors = maxTier === 3
    ? { bg: C.redLight, border: C.redBorder, text: C.red }
    : maxTier === 2
    ? { bg: C.amberLight, border: C.amberBorder, text: C.amber }
    : { bg: C.accentLight, border: C.accentBorder, text: C.accent };

  return (
    <div style={{ borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.bg, padding: '12px 16px', marginTop: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
        {maxTier === 3 ? 'High-sensitivity' : maxTier === 2 ? 'Moderate-sensitivity' : 'Policy'} change — {total.toLocaleString()} people affected
      </div>
      <div style={{ fontSize: 13, color: C.text }}>
        This population feeds{' '}
        {policies.map((p, i) => (
          <span key={p.id}>
            <strong>{p.name}</strong>{i < policies.length - 1 ? ', ' : ''}
          </span>
        ))}
        . Changes take effect immediately.
      </div>
    </div>
  );
}

// ── Why tooltip ───────────────────────────────────────────────────────────────

function WhyCard({ explanation, onClose }: { explanation: string; onClose: () => void }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderRadius: 10, padding: '14px 16px', marginTop: 8,
      boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      position: 'relative',
    }}>
      <button onClick={onClose} style={{
        position: 'absolute', top: 8, right: 10,
        background: 'none', border: 'none', cursor: 'pointer',
        color: C.textMuted, fontSize: 18, lineHeight: 1,
      }}>×</button>
      <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 4, fontWeight: 600 }}>Why is this person here?</div>
      <div style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{explanation}</div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// INLINE FLOW — the centerpiece
// ══════════════════════════════════════════════════════════════════════════════

function InlineFlow({
  entryState,
  localPeople,
  localGroups,
  onSelect,
}: {
  entryState: EntryState;
  localPeople: Person[];
  localGroups: SavedGroup[];
  onSelect: (group: SavedGroup | null, description: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [conditions, setConditions] = useState<ParsedCondition[]>([]);
  const [seedPerson, setSeedPerson] = useState<Person | null>(null);
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonSearch, setShowPersonSearch] = useState(false);
  const [mode, setMode] = useState<'describe' | 'seed'>('describe');
  const [savedName, setSavedName] = useState('');
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeRule = useMemo(() => conditionsToRule(conditions), [conditions]);

  const matchingMembers = useMemo(() => {
    if (!activeRule) return [];
    return localPeople.filter(p => evaluateRule(p, activeRule) && p.roleState !== 'terminated');
  }, [activeRule, localPeople]);

  const matchingExistingGroup = useMemo(() => {
    if (!activeRule || matchingMembers.length === 0) return null;
    const matchIds = new Set(matchingMembers.map(p => p.id));
    for (const g of localGroups) {
      const gIds = new Set(g.memberIds);
      const overlap = [...matchIds].filter(id => gIds.has(id)).length;
      const similarity = overlap / Math.max(matchIds.size, gIds.size);
      if (similarity > 0.85) return g;
    }
    return null;
  }, [activeRule, matchingMembers, localGroups]);

  const personSearchResults = useMemo(() => {
    if (!personSearch || personSearch.length < 2) return [];
    const lower = personSearch.toLowerCase();
    return localPeople.filter(p =>
      p.name.toLowerCase().includes(lower) && p.roleState === 'active'
    ).slice(0, 5);
  }, [personSearch, localPeople]);

  const handleQueryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      const parsed = parseAttributePhrase(query, localPeople);
      if (parsed.length > 0) {
        const newConds = parsed.filter(p => !conditions.some(c => c.field === p.field && c.value === p.value));
        setConditions(prev => [...prev, ...newConds]);
        setQuery('');
      }
    }
  };

  const handleSeedPerson = (person: Person) => {
    setSeedPerson(person);
    setPersonSearch('');
    setShowPersonSearch(false);
    // Generate conditions from person attributes
    const generalized: ParsedCondition[] = [
      { field: 'department', operator: 'is', value: person.department, label: `Department: ${person.department}` },
      { field: 'employmentType', operator: 'is', value: person.employmentType, label: `Employment: ${employmentTypeLabels[person.employmentType]}` },
      { field: 'location', operator: 'is', value: person.location, label: `Location: ${person.location}` },
    ];
    setConditions(generalized);
  };

  const removeCondition = (field: string) => {
    setConditions(prev => prev.filter(c => c.field !== field));
  };

  const addSuggestion = (cond: ParsedCondition) => {
    if (!conditions.some(c => c.field === cond.field && c.value === cond.value)) {
      setConditions(prev => [...prev, cond]);
    }
  };

  // Quick attribute suggestions
  const quickSuggestions: ParsedCondition[] = [
    { field: 'employmentType', operator: 'is', value: 'full_time', label: 'Full-time' },
    { field: 'department', operator: 'is', value: 'Engineering', label: 'Engineering' },
    { field: 'department', operator: 'is', value: 'Sales', label: 'Sales' },
    { field: 'location', operator: 'is', value: 'San Francisco', label: 'San Francisco' },
    { field: 'country', operator: 'is', value: 'US', label: 'United States' },
  ].filter(s => !conditions.some(c => c.field === s.field && c.value === s.value));

  const policy = entryState.scenario.type === 'inline-select' ? entryState.scenario.policyContext : undefined;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text, maxWidth: 480 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.text, marginBottom: 4 }}>
          Who should this apply to?
        </div>
        {policy && (
          <div style={{ fontSize: 13, color: C.textSecondary }}>
            Defining the population for <strong>{policy.name}</strong>
          </div>
        )}
      </div>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 14, background: C.surfaceAlt, borderRadius: 8, padding: 3 }}>
        <button onClick={() => setMode('describe')} style={{
          flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: mode === 'describe' ? C.surface : 'transparent',
          color: mode === 'describe' ? C.text : C.textSecondary,
          fontSize: 13, fontWeight: mode === 'describe' ? 600 : 400,
          boxShadow: mode === 'describe' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}>
          Describe attributes
        </button>
        <button onClick={() => { setMode('seed'); setShowPersonSearch(true); }} style={{
          flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
          background: mode === 'seed' ? C.surface : 'transparent',
          color: mode === 'seed' ? C.text : C.textSecondary,
          fontSize: 13, fontWeight: mode === 'seed' ? 600 : 400,
          boxShadow: mode === 'seed' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
        }}>
          Start from a person
        </button>
      </div>

      {mode === 'describe' && (
        <>
          {/* Text input */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleQueryKeyDown}
              placeholder="e.g. full-time engineers in San Francisco"
              style={{
                width: '100%', padding: '10px 12px', borderRadius: 8,
                border: `1.5px solid ${C.border}`, fontSize: 14,
                outline: 'none', background: C.surface, color: C.text,
                boxSizing: 'border-box',
              }}
            />
            {query.trim() && (
              <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: C.textMuted }}>
                Press Enter
              </div>
            )}
          </div>

          {/* Quick suggestions */}
          {quickSuggestions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {quickSuggestions.slice(0, 4).map(s => (
                <button key={`${s.field}-${s.value}`} onClick={() => addSuggestion(s)} style={{
                  background: C.surfaceAlt, border: `1px solid ${C.border}`,
                  borderRadius: 16, padding: '4px 10px', fontSize: 12,
                  color: C.textSecondary, cursor: 'pointer',
                }}>
                  + {s.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'seed' && (
        <div style={{ marginBottom: 12 }}>
          {!seedPerson ? (
            <>
              <input
                value={personSearch}
                onChange={e => setPersonSearch(e.target.value)}
                placeholder="Search by name..."
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1.5px solid ${C.border}`, fontSize: 14,
                  outline: 'none', background: C.surface, color: C.text,
                  boxSizing: 'border-box', marginBottom: 8,
                }}
              />
              {personSearchResults.map(p => (
                <button key={p.id} onClick={() => handleSeedPerson(p)} style={{
                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '8px 4px', borderBottom: `1px solid ${C.border}`,
                  textAlign: 'left',
                }}>
                  <Avatar person={p} size={28} />
                  <div>
                    <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary }}>{p.title} · {p.department} · {p.location}</div>
                  </div>
                </button>
              ))}
            </>
          ) : (
            <div style={{ background: C.accentLight, border: `1px solid ${C.accentBorder}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar person={seedPerson} size={28} />
                <div>
                  <div style={{ fontSize: 13, color: C.accent, fontWeight: 600 }}>Seeded from {seedPerson.name}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary }}>Showing people with similar attributes</div>
                </div>
                <button onClick={() => { setSeedPerson(null); setConditions([]); }} style={{
                  marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
                  color: C.textMuted, fontSize: 16,
                }}>×</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Active condition chips */}
      {conditions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {conditions.map(c => (
            <AttributeChip key={`${c.field}-${c.value}`} label={c.label} onRemove={() => removeCondition(c.field)} />
          ))}
        </div>
      )}

      {/* Population result */}
      {activeRule && (
        <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: C.surface, overflow: 'hidden' }}>
          <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt }}>
            <div style={{ fontSize: 13, color: C.textSecondary }}>
              Population matching: <span style={{ color: C.text, fontWeight: 500 }}>{ruleToSentence(activeRule)}</span>
            </div>
          </div>
          <div style={{ padding: '10px 14px' }}>
            {matchingMembers.length === 0 ? (
              <div style={{ fontSize: 14, color: C.textMuted, fontStyle: 'italic', padding: '8px 0' }}>
                No one matches these conditions.
              </div>
            ) : (
              <>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 8 }}>
                  {matchingMembers.length} {matchingMembers.length === 1 ? 'person' : 'people'} match this population
                </div>
                <div style={{ display: 'flex', gap: -4, marginBottom: 8 }}>
                  {matchingMembers.slice(0, 6).map((p, i) => (
                    <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -6, zIndex: 10 - i }}>
                      <Avatar person={p} size={28} />
                    </div>
                  ))}
                  {matchingMembers.length > 6 && (
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      background: C.surfaceAlt, color: C.textSecondary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 600, marginLeft: -6,
                      border: `1px solid ${C.border}`,
                    }}>
                      +{matchingMembers.length - 6}
                    </div>
                  )}
                </div>
                {matchingMembers.slice(0, 3).map(p => (
                  <div key={p.id} style={{ fontSize: 13, color: C.textSecondary, marginBottom: 2 }}>
                    {p.name} · {p.title}
                  </div>
                ))}
                {matchingMembers.length > 3 && (
                  <div style={{ fontSize: 13, color: C.textMuted }}>and {matchingMembers.length - 3} more</div>
                )}
              </>
            )}
          </div>

          {/* Matching existing group */}
          {matchingExistingGroup && (
            <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.greenBorder}`, background: C.greenLight }}>
              <div style={{ fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 4 }}>
                An existing group already covers this population
              </div>
              <div style={{ fontSize: 13, color: '#166534', marginBottom: 8 }}>
                "{matchingExistingGroup.name}" has {matchingExistingGroup.memberIds.length} members and matches your description.
              </div>
              <button onClick={() => onSelect(matchingExistingGroup, ruleToSentence(activeRule))} style={{
                background: C.green, color: '#fff', border: 'none', borderRadius: 6,
                padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>
                Use this group
              </button>
            </div>
          )}

          {/* No match — offer to save */}
          {!matchingExistingGroup && matchingMembers.length > 0 && (
            <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}` }}>
              {!saved ? (
                <div>
                  <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 8 }}>
                    This is a new population. Give it a name to save it, or use it without saving.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      value={savedName}
                      onChange={e => setSavedName(e.target.value)}
                      placeholder="Population name (optional)"
                      style={{
                        flex: 1, padding: '7px 10px', borderRadius: 6,
                        border: `1px solid ${C.border}`, fontSize: 13,
                        outline: 'none', color: C.text,
                      }}
                    />
                    <button onClick={() => setSaved(true)} style={{
                      background: C.accent, color: '#fff', border: 'none', borderRadius: 6,
                      padding: '7px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}>
                      {savedName ? 'Save & use' : 'Use without saving'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, color: C.green, fontWeight: 600 }}>
                    Population {savedName ? `"${savedName}" ` : ''}selected
                  </span>
                  <button onClick={() => onSelect(null, ruleToSentence(activeRule))} style={{
                    background: C.accent, color: '#fff', border: 'none', borderRadius: 6,
                    padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  }}>
                    Confirm
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Existing populations to browse */}
      {conditions.length === 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 10 }}>
            Or browse existing populations
          </div>
          {localGroups.filter(g => !g.isLegacy).slice(0, 4).map(g => {
            const members = localPeople.filter(p => g.memberIds.includes(p.id));
            return (
              <button key={g.id} onClick={() => onSelect(g, ruleToSentence(g.rule))} style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: `1px solid ${C.border}`,
                borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                cursor: 'pointer',
              }}>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text, marginBottom: 2 }}>{g.name}</div>
                <div style={{ fontSize: 13, color: C.textSecondary }}>
                  {ruleToSentence(g.rule)} · {members.length} people
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// CREATE FLOW
// ══════════════════════════════════════════════════════════════════════════════

function CreateFlow({
  entryState,
  localPeople,
  localGroups,
}: {
  entryState: EntryState;
  localPeople: Person[];
  localGroups: SavedGroup[];
}) {
  const [query, setQuery] = useState('');
  const [conditions, setConditions] = useState<ParsedCondition[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPersonPicker, setShowPersonPicker] = useState(false);
  const [whyPerson, setWhyPerson] = useState<Person | null>(null);
  const [groupName, setGroupName] = useState('');
  const [saved, setSaved] = useState(false);
  const [showRuleEditor, setShowRuleEditor] = useState(false);

  const activeRule = useMemo(() => conditionsToRule(conditions), [conditions]);

  const layers: EvaluationLayer[] = useMemo(() => [{
    id: 'role-state-filter',
    type: 'role_state',
    label: 'Role state filter',
    description: 'Excludes people who are not active',
    excludedPeopleIds: localPeople.filter(p => p.roleState !== 'active').map(p => p.id),
  }], [localPeople]);

  const matchingMembers = useMemo(() => {
    if (!activeRule) {
      return selectedPeople.filter(p => p.roleState === 'active');
    }
    return localPeople.filter(p => evaluateRule(p, activeRule) && p.roleState === 'active');
  }, [activeRule, selectedPeople, localPeople]);

  const recentChanges = useMemo(() => {
    if (!activeRule) return { added: [], removed: [] };
    return simulateRecentChanges(localPeople, activeRule, layers);
  }, [activeRule, localPeople, layers]);

  const sharedAttrs = useMemo(() => {
    if (selectedPeople.length < 2) return [];
    return findSharedAttributes(selectedPeople);
  }, [selectedPeople]);

  const generalizableConditions: ParsedCondition[] = useMemo(() => {
    return sharedAttrs.map(a => ({
      field: a.field,
      operator: 'is' as const,
      value: a.value,
      label: `${fieldLabels[a.field] || a.field}: ${formatValue(a.field, a.value)} (${a.count} of ${selectedPeople.length} people)`,
    }));
  }, [sharedAttrs, selectedPeople]);

  const similarExistingGroup = useMemo(() => {
    if (!activeRule || matchingMembers.length === 0) return null;
    const matchIds = new Set(matchingMembers.map(p => p.id));
    for (const g of localGroups) {
      const gIds = new Set(g.memberIds);
      const overlap = [...matchIds].filter(id => gIds.has(id)).length;
      const similarity = overlap / Math.max(matchIds.size, gIds.size);
      if (similarity > 0.8) return g;
    }
    return null;
  }, [activeRule, matchingMembers, localGroups]);

  const personSearchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const lower = searchQuery.toLowerCase();
    return localPeople.filter(p =>
      p.name.toLowerCase().includes(lower) &&
      !selectedPeople.some(s => s.id === p.id)
    ).slice(0, 8);
  }, [searchQuery, localPeople, selectedPeople]);

  const handleQueryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim()) {
      const parsed = parseAttributePhrase(query, localPeople);
      if (parsed.length > 0) {
        const newConds = parsed.filter(p => !conditions.some(c => c.field === p.field && c.value === p.value));
        setConditions(prev => [...prev, ...newConds]);
        setQuery('');
      }
    }
  };

  const addGeneralizedCondition = (cond: ParsedCondition) => {
    if (!conditions.some(c => c.field === cond.field && c.value === cond.value)) {
      setConditions(prev => [...prev, { ...cond, label: `${fieldLabels[cond.field] || cond.field}: ${formatValue(cond.field, cond.value)}` }]);
    }
  };

  const whyExplanation = useMemo(() => {
    if (!whyPerson || !activeRule) return '';
    return explainPersonMembership(whyPerson, activeRule, layers);
  }, [whyPerson, activeRule, layers]);

  const excludedByLayers = layers.flatMap(l => l.excludedPeopleIds);
  const excludedCount = matchingMembers.length > 0
    ? localPeople.filter(p => activeRule && evaluateRule(p, activeRule) && excludedByLayers.includes(p.id)).length
    : 0;

  // Partial pattern for non-generalizable selections
  const strongestPartialAttr = useMemo(() => {
    if (selectedPeople.length < 3 || sharedAttrs.length > 0) return null;
    const deptCounts = new Map<string, number>();
    for (const p of selectedPeople) deptCounts.set(p.department, (deptCounts.get(p.department) || 0) + 1);
    const sorted = [...deptCounts.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0 && sorted[0][1] >= 2) {
      return { dept: sorted[0][0], count: sorted[0][1], total: selectedPeople.length };
    }
    return null;
  }, [selectedPeople, sharedAttrs]);

  const policy = entryState.scenario.type === 'create' ? entryState.scenario.policyContext : undefined;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text, maxWidth: 760 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
          Define a population
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: C.textSecondary }}>
          Describe who belongs in this group. The population will stay current automatically.
          {policy && <> · Will feed into <strong>{policy.name}</strong></>}
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 24, alignItems: 'start' }}>
        {/* LEFT: input surface */}
        <div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, display: 'block', marginBottom: 6 }}>
              Describe the population
            </label>
            <div style={{ position: 'relative' }}>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleQueryKeyDown}
                placeholder="e.g. full-time engineers in San Francisco"
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  border: `1.5px solid ${C.border}`, fontSize: 14,
                  outline: 'none', background: C.surface, color: C.text,
                  boxSizing: 'border-box',
                }}
              />
              {query.trim() && parseAttributePhrase(query, localPeople).length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 8, padding: '10px 12px', marginTop: 4,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}>
                  <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 6 }}>Parsed conditions:</div>
                  {parseAttributePhrase(query, localPeople).map(c => (
                    <div key={`${c.field}-${c.value}`} style={{ fontSize: 13, color: C.text, padding: '2px 0' }}>
                      · {c.label}
                    </div>
                  ))}
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 6 }}>Press Enter to apply</div>
                </div>
              )}
            </div>
          </div>

          {/* Active chips */}
          {conditions.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {conditions.map(c => (
                <AttributeChip
                  key={`${c.field}-${c.value}`}
                  label={c.label}
                  onRemove={() => setConditions(prev => prev.filter(x => x.field !== c.field))}
                />
              ))}
            </div>
          )}

          {/* Add specific people */}
          <div style={{ marginBottom: 14 }}>
            <button onClick={() => setShowPersonPicker(p => !p)} style={{
              background: 'none', border: `1px dashed ${C.border}`, borderRadius: 8,
              padding: '8px 12px', fontSize: 13, color: C.textSecondary, cursor: 'pointer',
              width: '100%', textAlign: 'left',
            }}>
              + Add specific people to seed a pattern
            </button>
            {showPersonPicker && (
              <div style={{ marginTop: 8 }}>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name..."
                  autoFocus
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6,
                    border: `1px solid ${C.border}`, fontSize: 13,
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
                {personSearchResults.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPeople(prev => [...prev, p]); setSearchQuery(''); }} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: '8px 4px', borderBottom: `1px solid ${C.border}`,
                    textAlign: 'left',
                  }}>
                    <Avatar person={p} size={26} />
                    <div>
                      <div style={{ fontSize: 13, color: C.text }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: C.textSecondary }}>{p.title} · {p.department}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected people */}
          {selectedPeople.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.textSecondary, marginBottom: 8 }}>
                {selectedPeople.length} specific {selectedPeople.length === 1 ? 'person' : 'people'} selected
              </div>
              {selectedPeople.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <Avatar person={p} size={26} />
                  <span style={{ fontSize: 13, color: C.text, flex: 1 }}>{p.name}</span>
                  <button onClick={() => setSelectedPeople(prev => prev.filter(x => x.id !== p.id))} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 16,
                  }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Generalization bridge */}
          {selectedPeople.length >= 2 && sharedAttrs.length > 0 && conditions.length === 0 && (
            <div style={{
              background: C.accentLight, border: `1px solid ${C.accentBorder}`,
              borderRadius: 10, padding: '14px 16px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 8 }}>
                These people share a pattern
              </div>
              <div style={{ fontSize: 13, color: C.text, marginBottom: 10, lineHeight: 1.5 }}>
                A rule using these attributes would capture all of them — and stay current as people join or leave.
              </div>
              {generalizableConditions.map(c => (
                <button key={`${c.field}-${c.value}`} onClick={() => addGeneralizedCondition(c)} style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  background: C.surface, border: `1px solid ${C.accentBorder}`,
                  borderRadius: 6, padding: '8px 10px', marginBottom: 6,
                  cursor: 'pointer', fontSize: 13, color: C.text,
                }}>
                  <span style={{ color: C.accent, marginRight: 8 }}>+ Add condition:</span>
                  {c.label}
                </button>
              ))}
            </div>
          )}

          {/* Partial pattern (no clean match) */}
          {strongestPartialAttr && (
            <div style={{
              background: C.amberLight, border: `1px solid ${C.amberBorder}`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.amber, marginBottom: 4 }}>
                No clean pattern found
              </div>
              <div style={{ fontSize: 13, color: C.text }}>
                {strongestPartialAttr.count} of your {strongestPartialAttr.total} people are in {strongestPartialAttr.dept}. Want to start with that and add the others manually?
              </div>
              <button onClick={() => addGeneralizedCondition({ field: 'department', operator: 'is', value: strongestPartialAttr.dept, label: `Department: ${strongestPartialAttr.dept}` })} style={{
                marginTop: 8, background: 'none', border: `1px solid ${C.amberBorder}`,
                borderRadius: 6, padding: '5px 12px', fontSize: 12,
                color: C.amber, cursor: 'pointer', fontWeight: 600,
              }}>
                Start with {strongestPartialAttr.dept}
              </button>
            </div>
          )}

          {/* Duplicate detection */}
          {similarExistingGroup && (
            <div style={{
              background: C.purpleLight, border: `1px solid ${C.purpleBorder}`,
              borderRadius: 10, padding: '12px 16px', marginBottom: 14,
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, marginBottom: 4 }}>
                Similar group already exists
              </div>
              <div style={{ fontSize: 13, color: C.text }}>
                "{similarExistingGroup.name}" covers a very similar population ({similarExistingGroup.memberIds.length} members). Consider using it instead.
              </div>
            </div>
          )}

          {/* Readable rule */}
          {activeRule && (
            <div style={{
              background: C.surfaceAlt, border: `1px solid ${C.border}`,
              borderRadius: 8, padding: '10px 14px', marginTop: 8,
            }}>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>Rule reads as:</div>
              <div style={{ fontSize: 14, color: C.text, fontStyle: 'italic' }}>"{ruleToSentence(activeRule)}"</div>
            </div>
          )}

          {/* Rule editor toggle */}
          <button onClick={() => setShowRuleEditor(p => !p)} style={{
            marginTop: 10, background: 'none', border: 'none', cursor: 'pointer',
            color: C.textSecondary, fontSize: 13, padding: 0,
          }}>
            {showRuleEditor ? '▲ Hide' : '▼ Advanced rule editor'}
          </button>
          {showRuleEditor && (
            <div style={{ marginTop: 8, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, color: C.textMuted }}>Rule editor (power user mode) — build conditions manually here.</div>
              {activeRule ? (
                <pre style={{ fontSize: 12, margin: '8px 0 0', color: C.text, overflow: 'auto' }}>{JSON.stringify(activeRule, null, 2)}</pre>
              ) : (
                <div style={{ fontSize: 13, color: C.textMuted, marginTop: 8 }}>No conditions yet.</div>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: live population */}
        <div>
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, background: C.surfaceAlt, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
                {activeRule
                  ? `${matchingMembers.length} people match`
                  : selectedPeople.length > 0
                  ? `${selectedPeople.length} people selected`
                  : 'Population preview'}
              </span>
              {excludedCount > 0 && (
                <span style={{ fontSize: 12, color: C.textMuted, background: C.border, borderRadius: 4, padding: '2px 7px' }}>
                  {excludedCount} excluded by filters
                </span>
              )}
            </div>
            <div style={{ padding: '12px 16px' }}>
              {activeRule ? (
                <PopulationSummary
                  members={matchingMembers}
                  allPeople={localPeople}
                  onWhyClick={setWhyPerson}
                />
              ) : selectedPeople.length > 0 ? (
                <div>
                  {selectedPeople.map(p => (
                    <PersonRow key={p.id} person={p} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: '20px 0', textAlign: 'center', color: C.textMuted, fontSize: 14 }}>
                  Start typing or add people above to see who's in this population.
                </div>
              )}
              {whyPerson && (
                <WhyCard explanation={whyExplanation} onClose={() => setWhyPerson(null)} />
              )}
            </div>
          </div>

          {/* Living population proof */}
          {activeRule && (
            <RecentChangesSection added={recentChanges.added} removed={recentChanges.removed} />
          )}

          {/* Save bar */}
          {(activeRule || selectedPeople.length > 0) && !saved && (
            <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
              <input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="Name this population (optional)"
                style={{
                  flex: 1, padding: '9px 12px', borderRadius: 8,
                  border: `1.5px solid ${C.border}`, fontSize: 14,
                  outline: 'none', color: C.text,
                }}
              />
              <button onClick={() => setSaved(true)} style={{
                background: C.accent, color: '#fff', border: 'none', borderRadius: 8,
                padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              }}>
                Save population
              </button>
            </div>
          )}
          {saved && (
            <div style={{ marginTop: 14, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 10, padding: '12px 16px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.green }}>
                Population "{groupName || 'Untitled'}" saved
              </div>
              <div style={{ fontSize: 13, color: '#166534', marginTop: 4 }}>
                It's live. New people who match these conditions will be added automatically.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// VIEW FLOW
// ══════════════════════════════════════════════════════════════════════════════

function ViewFlow({
  entryState,
  localPeople,
  localGroups,
}: {
  entryState: EntryState;
  localPeople: Person[];
  localGroups: SavedGroup[];
}) {
  const scenario = entryState.scenario as { type: 'view'; groupId: string };
  const group = localGroups.find(g => g.id === scenario.groupId) || localGroups[0];

  const [expandedMeta, setExpandedMeta] = useState(false);
  const [expandedLayers, setExpandedLayers] = useState(false);
  const [whyPerson, setWhyPerson] = useState<Person | null>(null);

  const layers = group.evaluationLayers || [];

  const memberPeople = useMemo(() => {
    const ids = new Set(group.memberIds);
    return localPeople.filter(p => ids.has(p.id));
  }, [group, localPeople]);

  const recentChanges = useMemo(() => {
    return simulateRecentChanges(localPeople, group.rule, layers);
  }, [group, localPeople, layers]);

  const whyExplanation = useMemo(() => {
    if (!whyPerson) return '';
    return explainPersonMembership(whyPerson, group.rule, layers);
  }, [whyPerson, group, layers]);

  const totalExcluded = [...new Set(layers.flatMap(l => l.excludedPeopleIds))].length;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text, maxWidth: 720 }}>
      {/* Legacy banner */}
      {group.isLegacy && (
        <div style={{
          background: C.amberLight, border: `1px solid ${C.amberBorder}`,
          borderRadius: 10, padding: '12px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.amber }}>Legacy group</div>
          <div style={{ fontSize: 13, color: C.text, marginTop: 2 }}>
            This group was created before the dynamic rule system. It still works, but consider migrating to a rule-based definition.
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>{group.name}</h2>
        <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
          {group.purpose}
        </div>
        <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 6, background: C.surfaceAlt, borderRadius: 6, padding: '6px 10px', display: 'inline-block' }}>
          "{ruleToSentence(group.rule)}"
        </div>
      </div>

      {/* FIRST: The population */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.text }}>
            Who's in this population
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
              {memberPeople.length} people
            </span>
            {totalExcluded > 0 && (
              <button onClick={() => setExpandedLayers(p => !p)} style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                padding: '3px 8px', fontSize: 12, color: C.textSecondary, cursor: 'pointer',
              }}>
                {totalExcluded} excluded by filters {expandedLayers ? '▲' : '▼'}
              </button>
            )}
          </div>
        </div>

        {expandedLayers && (
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
            {layers.map(layer => {
              const excluded = localPeople.filter(p => layer.excludedPeopleIds.includes(p.id));
              return (
                <div key={layer.id} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{layer.label}</div>
                  <div style={{ fontSize: 13, color: C.textSecondary }}>{layer.description}</div>
                  {excluded.length > 0 && (
                    <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
                      Affects: {excluded.map(p => p.name).join(', ')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <PopulationSummary members={memberPeople} allPeople={localPeople} onWhyClick={setWhyPerson} />

        {whyPerson && (
          <WhyCard explanation={whyExplanation} onClose={() => setWhyPerson(null)} />
        )}
      </div>

      {/* SECOND: Recent population changes */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: C.text }}>
          Recent population changes
        </h3>
        <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 12 }}>
          What's happened to this population over the last 30 days
        </div>
        <RecentChangesSection added={recentChanges.added} removed={recentChanges.removed} />
      </div>

      {/* THIRD: Downstream impact */}
      {group.consumers.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: C.text }}>
            Policies using this population
          </h3>
          {group.consumers.map(policy => (
            <div key={policy.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', border: `1px solid ${C.border}`,
              borderRadius: 8, marginBottom: 8, background: C.surface,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{policy.name}</div>
                <div style={{ fontSize: 12, color: C.textSecondary }}>
                  {policy.domain} · Sensitivity tier {policy.sensitivityTier}
                </div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.textSecondary }}>
                {policy.affectedCount.toLocaleString()} affected
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DEEP: Expandable metadata */}
      <button onClick={() => setExpandedMeta(p => !p)} style={{
        background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '8px 14px', fontSize: 13, color: C.textSecondary, cursor: 'pointer',
        width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Provenance & technical details</span>
        <span>{expandedMeta ? '▲' : '▼'}</span>
      </button>
      {expandedMeta && (
        <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '14px 16px', background: C.surfaceAlt }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
            {[
              ['Owner', group.owner],
              ['Product domain', group.productDomain],
              ['Lifecycle', group.lifecycleIntent],
              ['Last evaluated', new Date(group.lastEvaluatedAt).toLocaleDateString()],
              ['Last modified by', group.lastModifiedBy],
              ['Last modified', new Date(group.lastModifiedAt).toLocaleDateString()],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 12, color: C.textMuted }}>{label}</div>
                <div style={{ fontSize: 13, color: C.text }}>{value}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 4 }}>Full rule definition</div>
            <div style={{ fontSize: 13, color: C.text, background: C.surface, borderRadius: 6, padding: '8px 10px', fontFamily: 'monospace' }}>
              {ruleToSentence(group.rule)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EDIT FLOW
// ══════════════════════════════════════════════════════════════════════════════

type FlaggedPerson = {
  person: Person;
  type: 'shouldnt_be_here' | 'should_be_here';
  resolution?: 'exclude_all' | 'exclude_individual' | 'include_via_rule' | 'include_manually';
};

function EditFlow({
  entryState,
  localPeople,
  localGroups,
}: {
  entryState: EntryState;
  localPeople: Person[];
  localGroups: SavedGroup[];
}) {
  const scenario = entryState.scenario as { type: 'edit'; groupId: string };
  const group = localGroups.find(g => g.id === scenario.groupId) || localGroups[0];

  const [whyPerson, setWhyPerson] = useState<Person | null>(null);
  const [flagged, setFlagged] = useState<FlaggedPerson[]>([]);
  const [flagDialog, setFlagDialog] = useState<Person | null>(null);
  const [missingSearch, setMissingSearch] = useState('');
  const [showMissingSearch, setShowMissingSearch] = useState(false);
  const [showRuleEditor, setShowRuleEditor] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const layers = group.evaluationLayers || [];

  const memberPeople = useMemo(() => {
    const ids = new Set(group.memberIds);
    return localPeople.filter(p => ids.has(p.id));
  }, [group, localPeople]);

  const recentChanges = useMemo(() => {
    return simulateRecentChanges(localPeople, group.rule, layers);
  }, [group, localPeople, layers]);

  const whyExplanation = useMemo(() => {
    if (!whyPerson) return '';
    return explainPersonMembership(whyPerson, group.rule, layers);
  }, [whyPerson, group, layers]);

  // People NOT in the group who match something
  const nonMembers = useMemo(() => {
    const ids = new Set(group.memberIds);
    return localPeople.filter(p => !ids.has(p.id) && p.roleState === 'active');
  }, [group, localPeople]);

  const missingSearchResults = useMemo(() => {
    if (!missingSearch || missingSearch.length < 2) return [];
    const lower = missingSearch.toLowerCase();
    return nonMembers.filter(p => p.name.toLowerCase().includes(lower)).slice(0, 5);
  }, [missingSearch, nonMembers]);

  const flagPersonExplanation = (person: Person): string => {
    // Explain WHY they're in the group — what condition matched
    for (const child of group.rule.children) {
      if (child.type === 'condition') {
        if (evaluateRule(person, child)) {
          const field = fieldLabels[child.field] || child.field;
          const val = Array.isArray(child.value) ? child.value.join(', ') : formatValue(child.field, child.value as string);
          return `${person.name} is here because their ${field} is "${val}".`;
        }
      }
    }
    return `${person.name} matches the overall group rule.`;
  };

  const handleFlagShouldntBeHere = (person: Person, resolution: FlaggedPerson['resolution']) => {
    setFlagged(prev => [
      ...prev.filter(f => f.person.id !== person.id),
      { person, type: 'shouldnt_be_here', resolution },
    ]);
    setFlagDialog(null);
  };

  const handleFlagShouldBeHere = (person: Person) => {
    setFlagged(prev => [
      ...prev.filter(f => f.person.id !== person.id),
      { person, type: 'should_be_here', resolution: 'include_manually' },
    ]);
  };

  const clearFlag = (personId: string) => {
    setFlagged(prev => prev.filter(f => f.person.id !== personId));
  };

  const toRemove = flagged.filter(f => f.type === 'shouldnt_be_here');
  const toAdd = flagged.filter(f => f.type === 'should_be_here');

  const totalAffected = group.consumers.reduce((sum, p) => sum + p.affectedCount, 0);
  const maxTier = group.consumers.length > 0
    ? Math.max(...group.consumers.map(p => p.sensitivityTier)) as 1 | 2 | 3
    : 1;

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: C.text, maxWidth: 720 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.text }}>
          Editing: {group.name}
        </h2>
        <div style={{ fontSize: 14, color: C.textSecondary, marginTop: 4 }}>
          Who's in this population right now — flag anyone who shouldn't be here, or find people who are missing.
        </div>
      </div>

      {/* Before/after diff if there are flags */}
      {(toRemove.length > 0 || toAdd.length > 0) && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 12, padding: '16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 12 }}>
            Pending changes
          </div>
          {toRemove.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: C.red, fontWeight: 600, marginBottom: 6 }}>
                Will be removed ({toRemove.length})
              </div>
              {toRemove.map(f => (
                <div key={f.person.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <Avatar person={f.person} size={24} />
                  <span style={{ fontSize: 13, color: C.text, flex: 1 }}>
                    <strong>{f.person.name}</strong>
                    {f.resolution === 'exclude_individual' && ' — excluded individually'}
                    {f.resolution === 'exclude_all' && ` — and everyone matching the same condition`}
                  </span>
                  <button onClick={() => clearFlag(f.person.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14,
                  }}>Undo</button>
                </div>
              ))}
            </div>
          )}
          {toAdd.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: C.green, fontWeight: 600, marginBottom: 6 }}>
                Will be added ({toAdd.length})
              </div>
              {toAdd.map(f => (
                <div key={f.person.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <Avatar person={f.person} size={24} />
                  <span style={{ fontSize: 13, color: C.text, flex: 1 }}>
                    <strong>{f.person.name}</strong> — added manually
                  </span>
                  <button onClick={() => clearFlag(f.person.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer', color: C.textMuted, fontSize: 14,
                  }}>Undo</button>
                </div>
              ))}
            </div>
          )}

          {/* Blast radius */}
          <BlastRadiusWarning policies={group.consumers} />

          <button onClick={() => setPendingSave(true)} style={{
            marginTop: 14, background: C.accent, color: '#fff', border: 'none',
            borderRadius: 8, padding: '9px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
          }}>
            Save changes
          </button>
          {pendingSave && (
            <div style={{ marginTop: 10, fontSize: 13, color: C.green, fontWeight: 600 }}>
              Changes saved. Population will update within a few minutes.
            </div>
          )}
        </div>
      )}

      {/* Member list — entry point for edit */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Current population ({memberPeople.length})
          </h3>
        </div>

        {memberPeople.map(person => {
          const isFlagged = flagged.some(f => f.person.id === person.id);
          return (
            <div key={person.id}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: `1px solid ${C.border}` }}>
                <Avatar person={person} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{person.name}</div>
                  <div style={{ fontSize: 12, color: C.textSecondary }}>{person.title} · {person.department} · {person.location}</div>
                </div>
                {isFlagged ? (
                  <span style={{ fontSize: 12, color: C.red, background: C.redLight, border: `1px solid ${C.redBorder}`, borderRadius: 4, padding: '2px 7px' }}>
                    Flagged for removal
                  </span>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setWhyPerson(whyPerson?.id === person.id ? null : person)} style={{
                      background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                      padding: '3px 8px', fontSize: 12, color: C.textSecondary, cursor: 'pointer',
                    }}>
                      Why?
                    </button>
                    <button onClick={() => setFlagDialog(flagDialog?.id === person.id ? null : person)} style={{
                      background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                      padding: '3px 8px', fontSize: 12, color: C.textSecondary, cursor: 'pointer',
                    }}>
                      Shouldn't be here
                    </button>
                  </div>
                )}
              </div>

              {whyPerson?.id === person.id && (
                <WhyCard explanation={whyExplanation} onClose={() => setWhyPerson(null)} />
              )}

              {flagDialog?.id === person.id && (
                <div style={{
                  background: C.redLight, border: `1px solid ${C.redBorder}`,
                  borderRadius: 10, padding: '14px 16px', margin: '4px 0 8px',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.red, marginBottom: 6 }}>
                    Why shouldn't {person.name} be here?
                  </div>
                  <div style={{ fontSize: 13, color: C.text, marginBottom: 10 }}>
                    {flagPersonExplanation(person)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <button onClick={() => handleFlagShouldntBeHere(person, 'exclude_individual')} style={{
                      background: C.surface, border: `1px solid ${C.redBorder}`, borderRadius: 6,
                      padding: '8px 12px', fontSize: 13, cursor: 'pointer', textAlign: 'left', color: C.text,
                    }}>
                      Just remove {person.name} — keep everyone else who matches the rule
                    </button>
                    <button onClick={() => handleFlagShouldntBeHere(person, 'exclude_all')} style={{
                      background: C.surface, border: `1px solid ${C.redBorder}`, borderRadius: 6,
                      padding: '8px 12px', fontSize: 13, cursor: 'pointer', textAlign: 'left', color: C.text,
                    }}>
                      Remove everyone who matched the same condition (adjust the rule)
                    </button>
                    <button onClick={() => setFlagDialog(null)} style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: 13, color: C.textSecondary, padding: '4px 0',
                    }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Who's missing? */}
      <div style={{ marginBottom: 24 }}>
        <button onClick={() => setShowMissingSearch(p => !p)} style={{
          background: 'none', border: `1px dashed ${C.border}`, borderRadius: 8,
          padding: '10px 14px', fontSize: 13, color: C.textSecondary, cursor: 'pointer',
          width: '100%', textAlign: 'left', display: 'flex', gap: 8, alignItems: 'center',
        }}>
          <span style={{ fontSize: 16 }}>+</span>
          <span>Who's missing? Search people not in this group</span>
        </button>
        {showMissingSearch && (
          <div style={{ marginTop: 8 }}>
            <input
              value={missingSearch}
              onChange={e => setMissingSearch(e.target.value)}
              placeholder="Search by name..."
              autoFocus
              style={{
                width: '100%', padding: '9px 12px', borderRadius: 8,
                border: `1px solid ${C.border}`, fontSize: 13,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
            {missingSearchResults.map(p => {
              const isFlaggedToAdd = flagged.some(f => f.person.id === p.id && f.type === 'should_be_here');
              const whyExcluded = explainPersonMembership(p, group.rule, layers);
              return (
                <div key={p.id} style={{ padding: '10px 4px', borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar person={p} size={28} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: C.textSecondary }}>{p.title} · {p.department}</div>
                    </div>
                    {isFlaggedToAdd ? (
                      <span style={{ fontSize: 12, color: C.green, background: C.greenLight, border: `1px solid ${C.greenBorder}`, borderRadius: 4, padding: '2px 7px' }}>
                        Will be added
                      </span>
                    ) : (
                      <button onClick={() => handleFlagShouldBeHere(p)} style={{
                        background: 'none', border: `1px solid ${C.border}`, borderRadius: 6,
                        padding: '4px 10px', fontSize: 12, color: C.textSecondary, cursor: 'pointer',
                      }}>
                        Should be here
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.textMuted, marginTop: 4, marginLeft: 38 }}>
                    {whyExcluded}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent changes section */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>Recent population changes</h3>
        <RecentChangesSection added={recentChanges.added} removed={recentChanges.removed} />
      </div>

      {/* Rule editor (power user, collapsible) */}
      <button onClick={() => setShowRuleEditor(p => !p)} style={{
        background: 'none', border: `1px solid ${C.border}`, borderRadius: 8,
        padding: '8px 14px', fontSize: 13, color: C.textSecondary, cursor: 'pointer',
        width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Advanced: edit rule definition directly</span>
        <span>{showRuleEditor ? '▲' : '▼'}</span>
      </button>
      {showRuleEditor && (
        <div style={{ border: `1px solid ${C.border}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: 16, background: C.surfaceAlt }}>
          <div style={{ fontSize: 13, color: C.textSecondary, marginBottom: 10 }}>
            Rule: <em>{ruleToSentence(group.rule)}</em>
          </div>
          <div style={{ fontSize: 12, color: C.textMuted }}>
            Rule builder for power users. Changes here affect who's included directly.
          </div>
          <pre style={{ fontSize: 12, margin: '8px 0 0', color: C.text, overflow: 'auto', maxHeight: 200 }}>
            {JSON.stringify(group.rule, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ADDITIONAL LOCAL GROUPS
// ══════════════════════════════════════════════════════════════════════════════

function buildLocalGroups(basePeople: Person[], localPeople: Person[]): SavedGroup[] {
  const allEngineers = localPeople.filter(p => p.department === 'Engineering' && p.roleState === 'active');
  const usFtEngineers = localPeople.filter(p =>
    p.department === 'Engineering' &&
    p.employmentType === 'full_time' &&
    p.country === 'US' &&
    p.roleState === 'active'
  );
  const allSales = localPeople.filter(p => p.department === 'Sales' && p.roleState === 'active');

  const additionalGroups: SavedGroup[] = [
    {
      id: 'sg-local-engineering-all',
      name: 'All Engineering',
      purpose: 'Everyone in the Engineering department, regardless of location or type',
      owner: 'eng-leadership@company.com',
      productDomain: 'it',
      lifecycleIntent: 'persistent',
      rule: {
        type: 'group', combinator: 'AND', children: [
          { type: 'condition', field: 'department', operator: 'is', value: 'Engineering' },
        ],
      },
      memberIds: allEngineers.map(p => p.id),
      evaluationLayers: [{
        id: 'role-state', type: 'role_state', label: 'Role state filter',
        description: 'Excludes inactive employees', excludedPeopleIds: localPeople.filter(p => p.roleState !== 'active').map(p => p.id),
      }],
      consumers: [],
      lastEvaluatedAt: '2026-04-01T12:00:00Z',
      lastModifiedBy: 'system',
      lastModifiedAt: '2026-03-28T10:00:00Z',
    },
    {
      id: 'sg-local-us-ft-eng',
      name: 'US Full-Time Engineers',
      purpose: 'Full-time engineers based in the United States',
      owner: 'hrisops@company.com',
      productDomain: 'benefits',
      lifecycleIntent: 'persistent',
      rule: {
        type: 'group', combinator: 'AND', children: [
          { type: 'condition', field: 'department', operator: 'is', value: 'Engineering' },
          { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' },
          { type: 'condition', field: 'country', operator: 'is', value: 'US' },
        ],
      },
      memberIds: usFtEngineers.map(p => p.id),
      evaluationLayers: [],
      consumers: [
        { id: 'policy-benefits-us', name: 'US Benefits Plan', domain: 'benefits', sensitivityTier: 2, affectedCount: usFtEngineers.length },
      ],
      lastEvaluatedAt: '2026-04-01T08:00:00Z',
      lastModifiedBy: 'admin@company.com',
      lastModifiedAt: '2026-03-15T14:00:00Z',
    },
    {
      id: 'sg-local-sales',
      name: 'Global Sales Team',
      purpose: 'All active sales employees worldwide',
      owner: 'sales-ops@company.com',
      productDomain: 'compliance',
      lifecycleIntent: 'persistent',
      rule: {
        type: 'group', combinator: 'AND', children: [
          { type: 'condition', field: 'department', operator: 'is', value: 'Sales' },
        ],
      },
      memberIds: allSales.map(p => p.id),
      evaluationLayers: [],
      consumers: [],
      lastEvaluatedAt: '2026-04-01T06:00:00Z',
      lastModifiedBy: 'admin@company.com',
      lastModifiedAt: '2026-03-20T09:00:00Z',
    },
    {
      id: 'sg-legacy',
      name: 'Q4 Comp Review Committee',
      purpose: 'Legacy static list from Q4 2024 compensation review',
      owner: 'finance@company.com',
      productDomain: 'payroll',
      lifecycleIntent: 'temporary',
      rule: {
        type: 'group', combinator: 'AND', children: [
          { type: 'condition', field: 'roleState', operator: 'is', value: 'active' },
        ],
      },
      memberIds: localPeople.filter(p => p.roleState === 'active').slice(0, 8).map(p => p.id),
      evaluationLayers: [],
      consumers: [
        { id: 'policy-payroll', name: 'Annual Bonus Policy', domain: 'payroll', sensitivityTier: 3, affectedCount: 8 },
      ],
      lastEvaluatedAt: '2024-12-15T00:00:00Z',
      lastModifiedBy: 'cfo@company.com',
      lastModifiedAt: '2024-12-15T00:00:00Z',
      isLegacy: true,
    },
  ];

  return additionalGroups;
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════════════

export default function ConceptB({ entryState }: { entryState: EntryState }) {
  const localPeople: Person[] = useMemo(
    () => [...entryState.data.people, ...additionalPeople],
    [entryState.data.people]
  );

  const localGroups: SavedGroup[] = useMemo(() => {
    const base = entryState.data.savedGroups;
    const extra = buildLocalGroups(entryState.data.people, localPeople);
    return [...base, ...extra];
  }, [entryState.data.savedGroups, localPeople]);

  const [inlineResult, setInlineResult] = useState<{ group: SavedGroup | null; description: string } | null>(null);

  const scenario = entryState.scenario;
  const isInline = entryState.context === 'inline' || scenario.type === 'inline-select';

  const renderScenarioBadge = () => {
    const labels: Record<string, { label: string; color: string; bg: string }> = {
      'create': { label: 'Create', color: C.green, bg: C.greenLight },
      'view': { label: 'View', color: C.accent, bg: C.accentLight },
      'edit': { label: 'Edit', color: C.amber, bg: C.amberLight },
      'inline-select': { label: 'Inline select', color: C.purple, bg: C.purpleLight },
    };
    const s = labels[scenario.type] || { label: scenario.type, color: C.textSecondary, bg: C.surfaceAlt };
    return (
      <span style={{
        fontSize: 11, fontWeight: 600, color: s.color, background: s.bg,
        border: `1px solid ${s.color}33`, borderRadius: 4, padding: '2px 7px',
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {s.label}
      </span>
    );
  };

  const content = (() => {
    if (isInline) {
      if (inlineResult) {
        return (
          <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', padding: 16, background: C.greenLight, borderRadius: 10, border: `1px solid ${C.greenBorder}` }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.green, marginBottom: 4 }}>
              Population selected
            </div>
            <div style={{ fontSize: 13, color: C.text }}>
              {inlineResult.group
                ? <>Using group "<strong>{inlineResult.group.name}</strong>" ({inlineResult.group.memberIds.length} members)</>
                : <>New population: <em>{inlineResult.description}</em></>
              }
            </div>
            <button onClick={() => setInlineResult(null)} style={{
              marginTop: 10, background: 'none', border: `1px solid ${C.greenBorder}`,
              borderRadius: 6, padding: '4px 10px', fontSize: 12, color: C.green, cursor: 'pointer',
            }}>
              Change
            </button>
          </div>
        );
      }
      return (
        <InlineFlow
          entryState={entryState}
          localPeople={localPeople}
          localGroups={localGroups}
          onSelect={(group, description) => setInlineResult({ group, description })}
        />
      );
    }

    if (scenario.type === 'create') {
      return <CreateFlow entryState={entryState} localPeople={localPeople} localGroups={localGroups} />;
    }
    if (scenario.type === 'view') {
      return <ViewFlow entryState={entryState} localPeople={localPeople} localGroups={localGroups} />;
    }
    if (scenario.type === 'edit') {
      return <EditFlow entryState={entryState} localPeople={localPeople} localGroups={localGroups} />;
    }
    return (
      <div style={{ fontFamily: 'system-ui', padding: 24, color: C.textMuted }}>
        Unknown scenario: {(scenario as any).type}
      </div>
    );
  })();

  return (
    <div style={{
      background: C.bg,
      minHeight: isInline ? 'auto' : '100vh',
      padding: isInline ? 16 : 32,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {/* Scenario label */}
      <div style={{ marginBottom: isInline ? 12 : 20, display: 'flex', alignItems: 'center', gap: 10 }}>
        {renderScenarioBadge()}
        <span style={{ fontSize: 12, color: C.textMuted }}>
          Concept B · Population-first · {localPeople.length} people loaded
        </span>
      </div>

      <div style={{
        background: C.surface,
        borderRadius: isInline ? 12 : 16,
        border: `1px solid ${C.border}`,
        padding: isInline ? 16 : 28,
        maxWidth: isInline ? 480 : 860,
        boxShadow: isInline ? '0 2px 8px rgba(0,0,0,0.06)' : '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        {content}
      </div>
    </div>
  );
}

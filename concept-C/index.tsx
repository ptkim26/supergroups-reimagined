import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  department: 'Department', location: 'Location', country: 'Country',
  employmentType: 'Employment type', roleState: 'Role state',
  startDate: 'Start date', title: 'Title',
};
const VALUE_LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', contractor: 'Contractor',
  active: 'Active', pending: 'Pending', terminated: 'Terminated',
  US: 'United States', GB: 'United Kingdom',
};
const fl = (f: string) => FIELD_LABELS[f] || f;
const vl = (v: string) => VALUE_LABELS[v] || v;
const ol = (op: string): string => ({ is: 'is', is_not: 'is not', contains: 'contains', greater_than: '>', less_than: '<', after: 'after', before: 'before', in: 'in' }[op] || op);

function conditionToNL(c: RuleCondition): string {
  const val = Array.isArray(c.value) ? c.value.map(vl).join(', ') : vl(c.value);
  return `${fl(c.field)} ${ol(c.operator)} ${val}`;
}

function ruleToNL(node: RuleNode): string {
  if (node.type === 'condition') return conditionToNL(node);
  const parts = node.children.map(ruleToNL);
  if (parts.length === 1) return parts[0];
  return parts.join(node.combinator === 'AND' ? ' · ' : ' or ');
}

function ruleToSentence(rule: RuleGroup): string {
  if (rule.children.length === 0) return '';
  const flat = rule.children.filter(c => c.type === 'condition') as RuleCondition[];
  const nested = rule.children.filter(c => c.type === 'group') as RuleGroup[];
  const parts = [...flat.map(conditionToNL), ...nested.map(g => `(${ruleToNL(g)})`)];
  const joiner = rule.combinator === 'AND' ? ' and ' : ' or ';
  return 'Everyone where ' + parts.join(joiner);
}

function evaluateRule(person: Person, node: RuleNode): boolean {
  if (node.type === 'condition') {
    const val = (person as unknown as Record<string, unknown>)[node.field];
    if (val === undefined) return false;
    const pv = String(val);
    switch (node.operator) {
      case 'is': return pv === node.value;
      case 'is_not': return pv !== node.value;
      case 'contains': return pv.includes(String(node.value));
      case 'in': return Array.isArray(node.value) && node.value.includes(pv);
      case 'after': return pv > String(node.value);
      case 'before': return pv < String(node.value);
      case 'greater_than': return Number(pv) > Number(node.value);
      case 'less_than': return Number(pv) < Number(node.value);
      default: return false;
    }
  }
  const results = node.children.map(c => evaluateRule(person, c));
  return node.combinator === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

function computeMembers(
  people: Person[], rule: RuleGroup, layers: EvaluationLayer[],
): { included: Person[]; excluded: { person: Person; reason: string }[] } {
  if (rule.children.length === 0) return { included: [], excluded: [] };
  const excludedByLayer = new Map<string, string>();
  for (const layer of layers)
    for (const pid of layer.excludedPeopleIds)
      if (!excludedByLayer.has(pid)) excludedByLayer.set(pid, layer.label);
  const included: Person[] = [], excluded: { person: Person; reason: string }[] = [];
  for (const p of people) {
    const lr = excludedByLayer.get(p.id);
    if (lr) excluded.push({ person: p, reason: `System filter: ${lr}` });
    else if (!evaluateRule(p, rule)) excluded.push({ person: p, reason: 'Doesn\'t match rule' });
    else included.push(p);
  }
  return { included, excluded };
}

function explainPerson(person: Person, rule: RuleGroup, layers: EvaluationLayer[]): string {
  for (const layer of layers)
    if (layer.excludedPeopleIds.includes(person.id))
      return `${person.name} is excluded by a system filter: "${layer.label}"\n\n${layer.description}`;
  if (rule.children.length === 0) return 'No rule conditions are defined yet.';
  const matches = evaluateRule(person, rule);
  if (matches) {
    const reasons = rule.children.map(child => {
      if (child.type === 'condition') {
        const val = (person as unknown as Record<string, unknown>)[child.field];
        return `• ${fl(child.field)} = ${vl(String(val))}`;
      }
      return '• ' + ruleToNL(child);
    });
    return `${person.name} is included because they match:\n${reasons.join('\n')}`;
  }
  return `${person.name} does not match the current rule conditions.`;
}

function computeDiff(original: Person[], current: Person[]) {
  const origIds = new Set(original.map(p => p.id));
  const currIds = new Set(current.map(p => p.id));
  return { added: current.filter(p => !origIds.has(p.id)), removed: original.filter(p => !currIds.has(p.id)) };
}

function findMatchingGroup(rule: RuleGroup, savedGroups: SavedGroup[]): SavedGroup | null {
  const conditions = rule.children.filter((c): c is RuleCondition => c.type === 'condition');
  if (conditions.length === 0) return null;
  for (const group of savedGroups) {
    if (group.isLegacy) continue;
    const gc = group.rule.children.filter((c): c is RuleCondition => c.type === 'condition');
    if (gc.length !== conditions.length) continue;
    if (conditions.every(c => gc.some(g => g.field === c.field && g.operator === c.operator && g.value === c.value)))
      return group;
  }
  return null;
}

function generateGroupName(rule: RuleGroup): string {
  const conditions = rule.children.filter((c): c is RuleCondition => c.type === 'condition');
  const parts = conditions.map(c => c.operator === 'is' ? vl(String(c.value)) : c.operator === 'is_not' ? `Non-${vl(String(c.value))}` : '').filter(Boolean);
  return parts.length ? parts.join(' ') + ' Employees' : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// NL → Rule parser (simulated AI)
// ─────────────────────────────────────────────────────────────────────────────

interface ParseResult { rule: RuleGroup | null; response: string; confidence: 'high' | 'low' }

function parseNaturalLanguage(input: string, people: Person[]): ParseResult {
  const lower = input.toLowerCase().trim();
  const conditions: RuleCondition[] = [];
  let interpretation = '';

  const depts = ['engineering', 'sales', 'finance', 'hr', 'marketing'];
  for (const d of depts)
    if (lower.includes(d))
      conditions.push({ type: 'condition', field: 'department', operator: 'is', value: d.charAt(0).toUpperCase() + d.slice(1) });

  if (lower.includes('in the us') || lower.includes('in the united states') || lower.includes('us employees') || lower.includes('us entity'))
    conditions.push({ type: 'condition', field: 'country', operator: 'is', value: 'US' });
  if (lower.includes('in the uk') || lower.includes('in the united kingdom'))
    conditions.push({ type: 'condition', field: 'country', operator: 'is', value: 'GB' });

  const locs: Record<string, string> = { 'san francisco': 'San Francisco', 'new york': 'New York', 'austin': 'Austin', 'london': 'London' };
  for (const [k, v] of Object.entries(locs))
    if (lower.includes(k) && !conditions.some(c => c.field === 'location'))
      conditions.push({ type: 'condition', field: 'location', operator: 'is', value: v });

  if (lower.includes('full-time') || lower.includes('full time') || lower.includes('fte'))
    conditions.push({ type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' });
  if ((lower.includes('contractor') || lower.includes('contract worker')) && !lower.includes('except') && !lower.includes('excluding'))
    conditions.push({ type: 'condition', field: 'employmentType', operator: 'is', value: 'contractor' });
  if (lower.includes('part-time') || lower.includes('part time'))
    conditions.push({ type: 'condition', field: 'employmentType', operator: 'is', value: 'part_time' });
  if (lower.includes('except contractor') || lower.includes('excluding contractor') || lower.includes('no contractor'))
    conditions.push({ type: 'condition', field: 'employmentType', operator: 'is_not', value: 'contractor' });

  const afterMatch = lower.match(/(?:started|joined|hired)\s+after\s+(\w+\s+\d{4}|\d{4}-\d{2}-\d{2})/);
  if (afterMatch) {
    let dateStr = afterMatch[1];
    const mp = dateStr.match(/(\w+)\s+(\d{4})/);
    if (mp) {
      const months: Record<string, string> = { january: '01', february: '02', march: '03', april: '04', may: '05', june: '06', july: '07', august: '08', september: '09', october: '10', november: '11', december: '12' };
      const m = months[mp[1].toLowerCase()];
      if (m) dateStr = `${mp[2]}-${m}-01`;
    }
    conditions.push({ type: 'condition', field: 'startDate', operator: 'after', value: dateStr });
  }

  if (lower.includes('the team') && conditions.length === 0)
    return { rule: null, response: "Which team? I can filter by department: Engineering, Sales, Finance, HR, or Marketing.", confidence: 'low' };

  if (lower.includes('everyone') && conditions.length === 0 && !lower.includes('except')) {
    conditions.push({ type: 'condition', field: 'country', operator: 'is', value: 'US' });
    interpretation = 'I read "everyone" as all US employees. ';
  }

  if (conditions.length === 0) {
    const mentioned = people.filter(p => lower.includes(p.name.toLowerCase()));
    if (mentioned.length > 0)
      return { rule: null, response: `I see you mentioned ${mentioned.map(p => p.name).join(' and ')}. I work with rules, not named individuals. Try describing what they have in common — department, location, employment type.`, confidence: 'low' };
    return { rule: null, response: "I wasn't able to translate that into a rule. Try describing the group using attributes like department, location, employment type, or country.", confidence: 'low' };
  }

  const rule: RuleGroup = { type: 'group', combinator: 'AND', children: conditions };
  const { included } = computeMembers(people, rule, []);
  const sentence = ruleToSentence(rule);
  const response = `${interpretation}I translated that as: "${sentence}"\n\nThat matches ${included.length} ${included.length === 1 ? 'person' : 'people'} before system filters. Does this look right?`;
  return { rule, response, confidence: 'high' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Message types
// ─────────────────────────────────────────────────────────────────────────────

type MessageRole = 'system' | 'user' | 'assistant';
interface ChatMessage {
  id: string; role: MessageRole; content: string; timestamp: number;
  memberDiff?: { added: string[]; removed: string[] };
}
let msgIdCounter = 0;
function msg(role: MessageRole, content: string, extras?: Partial<ChatMessage>): ChatMessage {
  return { id: `msg-${++msgIdCounter}`, role, content, timestamp: Date.now(), ...extras };
}

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const p = {
  bg: '#ffffff',
  canvas: '#f6f6f7',      // artifact background — feels like paper
  surface: '#f0f0f2',
  surfaceHover: '#e8e8eb',
  border: '#dedee3',
  borderLight: '#eaeaed',
  text: '#111116',
  textSecondary: '#5c5c6e',
  textTertiary: '#9898aa',
  accent: '#2952cc',
  accentLight: '#dde6ff',
  accentSoft: '#eef2ff',
  accentMid: '#4a6ee0',
  danger: '#b91c1c',
  dangerLight: '#fef2f2',
  dangerBorder: '#fecaca',
  warning: '#b45309',
  warningLight: '#fffbeb',
  warningBorder: '#fde68a',
  success: '#15803d',
  successLight: '#f0fdf4',
};
const r = { xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '20px', full: '9999px' };
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

// ─────────────────────────────────────────────────────────────────────────────
// Micro components
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const hue = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `hsl(${hue},40%,90%)`, color: `hsl(${hue},40%,32%)`,
      fontSize: size * 0.37, fontWeight: 600, letterSpacing: '-0.01em',
      border: '2px solid #fff',
    }}>
      {initials}
    </div>
  );
}

function Chip({
  label, field, op, value, onRemove,
}: { label?: string; field?: string; op?: string; value?: string; onRemove?: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '6px 12px', borderRadius: r.full,
      background: p.accentSoft, border: `1px solid ${p.accentLight}`,
      fontSize: '0.8125rem', lineHeight: 1, whiteSpace: 'nowrap',
    }}>
      {field && <span style={{ color: p.textSecondary, fontWeight: 400 }}>{field}</span>}
      {op && <span style={{ color: p.textTertiary, fontSize: '0.6875rem', margin: '0 1px' }}>{op}</span>}
      <span style={{ color: p.accent, fontWeight: 600 }}>{value ?? label}</span>
      {onRemove && (
        <button onClick={onRemove} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: p.textTertiary, padding: '0 0 0 3px', fontSize: '0.875rem', lineHeight: 1,
          display: 'flex', alignItems: 'center',
        }} aria-label="Remove">×</button>
      )}
    </span>
  );
}

function SensitivityDot({ tier }: { tier: 1 | 2 | 3 }) {
  const color = tier === 1 ? p.danger : tier === 2 ? p.warning : p.textTertiary;
  return <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Add-condition form (lives in artifact, direct editing escape hatch)
// ─────────────────────────────────────────────────────────────────────────────

const FIELDS: { field: string; label: string; values: { value: string; label: string }[] }[] = [
  { field: 'department', label: 'Department', values: ['Engineering','Sales','Finance','HR','Marketing'].map(v => ({ value: v, label: v })) },
  { field: 'country', label: 'Country', values: [{ value: 'US', label: 'United States' }, { value: 'GB', label: 'United Kingdom' }] },
  { field: 'location', label: 'Location', values: ['San Francisco','New York','Austin','London'].map(v => ({ value: v, label: v })) },
  { field: 'employmentType', label: 'Employment type', values: [{ value: 'full_time', label: 'Full-time' }, { value: 'part_time', label: 'Part-time' }, { value: 'contractor', label: 'Contractor' }] },
  { field: 'roleState', label: 'Role state', values: [{ value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' }, { value: 'terminated', label: 'Terminated' }] },
];

function AddConditionForm({ onAdd }: { onAdd: (c: RuleCondition) => void }) {
  const [open, setOpen] = useState(false);
  const [field, setField] = useState('');
  const [op, setOp] = useState<'is' | 'is_not'>('is');
  const [value, setValue] = useState('');
  const fieldDef = FIELDS.find(f => f.field === field);

  const commit = () => {
    if (!field || !value) return;
    onAdd({ type: 'condition', field, operator: op, value });
    setOpen(false); setField(''); setValue(''); setOp('is');
  };

  const sel: React.CSSProperties = {
    border: `1px solid ${p.border}`, borderRadius: r.sm, padding: '5px 8px',
    fontSize: '0.8125rem', background: p.bg, color: p.text,
    fontFamily: sans, cursor: 'pointer', outline: 'none',
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '5px 12px', borderRadius: r.full,
      border: `1.5px dashed ${p.border}`, background: 'transparent',
      color: p.textTertiary, fontSize: '0.8125rem', cursor: 'pointer',
      fontFamily: sans, transition: 'border-color 0.15s, color 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = p.accent; e.currentTarget.style.color = p.accent; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = p.border; e.currentTarget.style.color = p.textTertiary; }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>+</span> Add condition
    </button>
  );

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6,
      padding: '8px 12px', borderRadius: r.md,
      background: p.surface, border: `1px solid ${p.border}`,
    }}>
      <select value={field} onChange={e => { setField(e.target.value); setValue(''); }} style={sel}>
        <option value="">Field…</option>
        {FIELDS.map(f => <option key={f.field} value={f.field}>{f.label}</option>)}
      </select>
      <select value={op} onChange={e => setOp(e.target.value as 'is' | 'is_not')} style={sel}>
        <option value="is">is</option>
        <option value="is_not">is not</option>
      </select>
      {fieldDef && (
        <select value={value} onChange={e => setValue(e.target.value)} style={sel}>
          <option value="">Value…</option>
          {fieldDef.values.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select>
      )}
      <button onClick={commit} disabled={!field || !value} style={{
        padding: '5px 14px', borderRadius: r.sm, border: 'none', fontFamily: sans,
        background: field && value ? p.accent : p.surface,
        color: field && value ? '#fff' : p.textTertiary,
        fontSize: '0.8125rem', fontWeight: 600,
        cursor: field && value ? 'pointer' : 'default',
      }}>Add</button>
      <button onClick={() => { setOpen(false); setField(''); setValue(''); }} style={{
        padding: '5px 8px', borderRadius: r.sm, border: 'none',
        background: 'none', color: p.textTertiary, fontSize: '0.8125rem',
        cursor: 'pointer', fontFamily: sans,
      }}>Cancel</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AvatarStack + member drawer
// ─────────────────────────────────────────────────────────────────────────────

function MemberDrawer({
  members, open, onClose, onAskWhy,
}: { members: Person[]; open: boolean; onClose: () => void; onAskWhy: (p: Person) => void }) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0, width: 280,
      background: p.bg, borderLeft: `1px solid ${p.border}`,
      display: 'flex', flexDirection: 'column', zIndex: 20,
      boxShadow: '-8px 0 24px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${p.borderLight}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{members.length} members</span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: p.textTertiary, fontSize: '1.125rem', lineHeight: 1, padding: 4,
        }}>×</button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {members.map(m => <MemberRow key={m.id} person={m} onAskWhy={p => { onClose(); onAskWhy(p); }} />)}
        {members.length === 0 && (
          <p style={{ color: p.textTertiary, fontSize: '0.8125rem', textAlign: 'center', padding: '24px 16px', fontStyle: 'italic' }}>
            No members match the current rule.
          </p>
        )}
      </div>
    </div>
  );
}

function MemberRow({ person, onAskWhy }: { person: Person; onAskWhy: (p: Person) => void }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px',
        background: hov ? p.accentSoft : 'transparent', cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onClick={() => onAskWhy(person)}
      role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onAskWhy(person)}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <Avatar name={person.name} size={28} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: p.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
        <div style={{ fontSize: '0.6875rem', color: p.textTertiary }}>{person.title} · {person.department}</div>
      </div>
      <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: hov ? p.accent : 'transparent', transition: 'color 0.1s', flexShrink: 0 }}>
        Why? →
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AND/OR combinator toggle — legible, shows both states
// ─────────────────────────────────────────────────────────────────────────────

function CombinatorToggle({ combinator, onChange, disabled }: { combinator: 'AND' | 'OR'; onChange: (c: 'AND' | 'OR') => void; disabled?: boolean }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={() => !disabled && onChange(combinator === 'AND' ? 'OR' : 'AND')}
      title={disabled ? undefined : 'Click to switch AND / OR'}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '3px 8px', borderRadius: r.xs, border: `1px solid ${hov ? p.accentLight : p.borderLight}`,
        background: hov ? p.accentSoft : p.surface,
        fontSize: '0.6875rem', fontWeight: 700, cursor: disabled ? 'default' : 'pointer',
        textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: sans,
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      <span style={{ color: combinator === 'AND' ? p.accent : p.textTertiary, fontWeight: combinator === 'AND' ? 800 : 400 }}>AND</span>
      <span style={{ color: p.borderLight }}>/</span>
      <span style={{ color: combinator === 'OR' ? p.accent : p.textTertiary, fontWeight: combinator === 'OR' ? 800 : 400 }}>OR</span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact panel — the "document" that the conversation produces
// ─────────────────────────────────────────────────────────────────────────────

function ArtifactPanel({
  groupName, groupPurpose, rule, layers, consumers, members, people,
  isEditing, hasRule, onRuleChange, onAskWhy, onGroupNameChange, onGroupPurposeChange,
  onConditionAdded, onCombinatorChanged, ruleVersion, metadata, onSave,
}: {
  groupName: string; groupPurpose: string; rule: RuleGroup;
  layers: EvaluationLayer[]; consumers: PolicyRef[];
  members: Person[]; people: Person[]; isEditing: boolean; hasRule: boolean;
  onRuleChange: (r: RuleGroup) => void;
  onAskWhy: (person: Person) => void;
  onGroupNameChange: (n: string) => void;
  onGroupPurposeChange: (pu: string) => void;
  onConditionAdded?: (c: RuleCondition) => void;
  onCombinatorChanged?: (from: 'AND' | 'OR', to: 'AND' | 'OR') => void;
  ruleVersion: number;
  metadata?: { owner: string; lastModifiedBy: string; lastModifiedAt: string; lifecycleIntent: string; productDomain: string };
  onSave?: () => void;
}) {
  const [combinator, setCombinator] = useState<'AND' | 'OR'>(rule.combinator);
  const [memberDrawerOpen, setMemberDrawerOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [saveFlash, setSaveFlash] = useState(false);
  const prevVersion = useRef(ruleVersion);

  // Pulse the rule area whenever the rule changes
  useEffect(() => {
    if (ruleVersion !== prevVersion.current) {
      prevVersion.current = ruleVersion;
      setFlashing(true);
      const t = setTimeout(() => setFlashing(false), 600);
      return () => clearTimeout(t);
    }
  }, [ruleVersion]);

  // Keep combinator in sync if rule is replaced from outside (e.g. NL parse)
  useEffect(() => {
    setCombinator(rule.combinator);
  }, [rule.combinator]);

  const handleCombinatorChange = (c: 'AND' | 'OR') => {
    onCombinatorChanged?.(combinator, c);
    setCombinator(c);
    onRuleChange({ ...rule, combinator: c });
  };

  const addCondition = (condition: RuleCondition) => {
    onRuleChange({ ...rule, children: [...rule.children, condition] });
    onConditionAdded?.(condition);
  };

  const removeCondition = (idx: number) => {
    const conditions = rule.children.filter((c): c is RuleCondition => c.type === 'condition');
    const nested = rule.children.filter((c): c is RuleGroup => c.type === 'group');
    conditions.splice(idx, 1);
    onRuleChange({ ...rule, children: [...conditions, ...nested] });
  };

  const conditions = rule.children.filter((c): c is RuleCondition => c.type === 'condition');
  const nestedGroups = rule.children.filter((c): c is RuleGroup => c.type === 'group');
  const totalExcluded = new Set(layers.flatMap(l => l.excludedPeopleIds)).size;
  const sentence = ruleToSentence(rule);

  // Avatar stack — show first 5, then +N
  const visibleAvatars = members.slice(0, 5);
  const overflow = members.length - visibleAvatars.length;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: p.canvas, position: 'relative', overflow: 'hidden',
    }}>
      {/* Backdrop for member drawer click-outside */}
      {memberDrawerOpen && (
        <div
          onClick={() => setMemberDrawerOpen(false)}
          style={{ position: 'absolute', inset: 0, zIndex: 19, background: 'transparent' }}
        />
      )}
      {/* Member drawer slides in from right */}
      <MemberDrawer
        members={members} open={memberDrawerOpen}
        onClose={() => setMemberDrawerOpen(false)} onAskWhy={onAskWhy}
      />

      {/* Scrollable document body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 40px' }}>

        {/* ── Group name & purpose ─────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          {isEditing && hasRule && onSave && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
              <button
                onClick={() => { onSave(); setSaveFlash(true); setTimeout(() => setSaveFlash(false), 1800); }}
                style={{
                  padding: '5px 14px', borderRadius: r.full, fontFamily: sans,
                  background: saveFlash ? p.successLight : p.accent,
                  color: saveFlash ? p.success : '#fff',
                  border: saveFlash ? `1px solid ${p.success}` : `1px solid ${p.accent}`,
                  fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                }}
              >
                {saveFlash ? 'Saved ✓ (prototype)' : 'Save group'}
              </button>
            </div>
          )}
          {isEditing ? (
            <input
              value={groupName}
              onChange={e => onGroupNameChange(e.target.value)}
              placeholder="Name this group"
              style={{
                width: '100%', border: 'none', background: 'transparent',
                fontSize: '1.5rem', fontWeight: 800, color: p.text, lineHeight: 1.2,
                outline: 'none', fontFamily: sans, letterSpacing: '-0.03em',
                borderBottom: groupName ? 'none' : `2px solid ${p.accentLight}`,
                paddingBottom: 2,
              }}
            />
          ) : (
            <h2 style={{
              margin: 0, fontSize: '1.5rem', fontWeight: 800, color: groupName ? p.text : p.textTertiary,
              letterSpacing: '-0.03em', lineHeight: 1.2, fontStyle: groupName ? 'normal' : 'italic',
            }}>
              {groupName || 'Untitled group'}
            </h2>
          )}
          {isEditing ? (
            <input
              value={groupPurpose}
              onChange={e => onGroupPurposeChange(e.target.value)}
              placeholder="What is this group for? (optional)"
              style={{
                width: '100%', border: 'none', background: 'transparent',
                fontSize: '0.875rem', color: p.textSecondary, outline: 'none',
                fontFamily: sans, marginTop: 6, lineHeight: 1.5,
                borderBottom: `1px solid ${p.borderLight}`, paddingBottom: 2,
              }}
            />
          ) : (
            groupPurpose && (
              <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: p.textSecondary, lineHeight: 1.5 }}>
                {groupPurpose}
              </p>
            )
          )}
          {metadata && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {[metadata.productDomain, metadata.lifecycleIntent, `Owner: ${metadata.owner}`].filter(Boolean).map((t, i) => (
                <span key={i} style={{
                  padding: '2px 9px', borderRadius: r.full,
                  background: p.bg, border: `1px solid ${p.border}`,
                  fontSize: '0.6875rem', color: p.textSecondary, fontWeight: 500,
                }}>{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Rule statement ───────────────────────────────────────── */}
        {!hasRule && isEditing ? (
          /* Empty state — inviting, not blank */
          <div style={{
            padding: '32px 24px', borderRadius: r.lg,
            border: `2px dashed ${p.accentLight}`, textAlign: 'center',
            background: p.bg,
          }}>
            <div style={{ fontSize: '1.75rem', marginBottom: 10 }}>✦</div>
            <div style={{ fontWeight: 700, color: p.text, fontSize: '0.9375rem', marginBottom: 6 }}>
              Your rule will appear here
            </div>
            <div style={{ color: p.textSecondary, fontSize: '0.8125rem', lineHeight: 1.6 }}>
              Describe the group in the conversation on the left, or add conditions directly below.
            </div>
          </div>
        ) : hasRule ? (
          <div style={{
            borderRadius: r.lg, overflow: 'hidden',
            border: `1px solid ${flashing ? p.accentLight : p.borderLight}`,
            background: flashing ? p.accentSoft : p.bg,
            transition: 'background 0.4s ease, border-color 0.4s ease',
          }}>
            {/* Rule sentence — the editorial headline */}
            <div style={{ padding: '16px 20px 12px' }}>
              <div style={{
                fontSize: '0.6875rem', fontWeight: 700, color: p.textTertiary,
                textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
              }}>
                Rule
              </div>
              {sentence && (
                <p style={{
                  margin: '0 0 14px', fontSize: '1.0625rem', fontWeight: 700,
                  color: p.text, lineHeight: 1.5, letterSpacing: '-0.015em',
                }}>
                  {sentence}
                </p>
              )}
              {/* Condition chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                {conditions.map((c, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {i > 0 && (
                      <CombinatorToggle
                        combinator={combinator}
                        onChange={c => handleCombinatorChange(c)}
                        disabled={!isEditing}
                      />
                    )}
                    <Chip
                      field={fl(c.field)} op={ol(c.operator)} value={Array.isArray(c.value) ? c.value.map(vl).join(', ') : vl(c.value)}
                      onRemove={isEditing ? () => removeCondition(i) : undefined}
                    />
                  </span>
                ))}
                {nestedGroups.map((g, i) => (
                  <span key={`g${i}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: r.full,
                    background: p.surface, border: `1px solid ${p.border}`,
                    fontSize: '0.75rem', color: p.textSecondary, fontStyle: 'italic',
                  }}>
                    ({ruleToNL(g)})
                  </span>
                ))}
                {isEditing && <AddConditionForm onAdd={addCondition} />}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: p.borderLight }} />

            {/* Member count hero + avatar stack */}
            <button
              onClick={() => setMemberDrawerOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 16, width: '100%',
                padding: '16px 20px', background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left', fontFamily: sans,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = p.surface)}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <div>
                <div style={{
                  fontSize: '2.5rem', fontWeight: 800, color: p.text,
                  lineHeight: 1, letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums',
                }}>
                  {members.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: p.textTertiary, marginTop: 3, fontWeight: 500 }}>
                  {members.length === 1 ? 'member' : 'members'}
                  {totalExcluded > 0 && ` · ${totalExcluded} excluded by filters`}
                </div>
              </div>
              {/* Overlapping avatar stack */}
              {members.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', marginLeft: 8 }}>
                  {visibleAvatars.map((m, i) => (
                    <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: visibleAvatars.length - i }}>
                      <Avatar name={m.name} size={32} />
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', marginLeft: -8,
                      background: p.surface, border: '2px solid #fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6875rem', fontWeight: 700, color: p.textSecondary,
                    }}>+{overflow}</div>
                  )}
                  <span style={{ marginLeft: 10, fontSize: '0.75rem', color: p.accent, fontWeight: 500 }}>
                    View all →
                  </span>
                </div>
              )}
            </button>
          </div>
        ) : null}

        {/* ── System filter indicator ──────────────────────────────── */}
        {layers.length > 0 && hasRule && (
          <SystemFiltersIndicator layers={layers} people={people} />
        )}

        {/* ── Details: consumers + metadata ───────────────────────── */}
        {(consumers.length > 0 || metadata) && hasRule && (
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setDetailsOpen(!detailsOpen)}
              onMouseEnter={e => (e.currentTarget.style.color = p.text)}
              onMouseLeave={e => (e.currentTarget.style.color = detailsOpen ? p.text : p.textSecondary)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                cursor: 'pointer', padding: '4px 0', fontFamily: sans,
                fontSize: '0.8125rem', color: detailsOpen ? p.text : p.textSecondary, fontWeight: 500,
                transition: 'color 0.1s',
              }}
            >
              <span style={{
                display: 'inline-block', transform: detailsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                transition: 'transform 0.15s', fontSize: '0.625rem', color: p.textTertiary,
              }}>▶</span>
              Details
              {!detailsOpen && consumers.length > 0 && (
                <span style={{
                  marginLeft: 4, padding: '1px 7px', borderRadius: r.full,
                  background: p.surface, border: `1px solid ${p.border}`,
                  fontSize: '0.6875rem', color: p.textSecondary,
                }}>
                  {consumers.length} {consumers.length === 1 ? 'policy' : 'policies'}
                </span>
              )}
            </button>
            {detailsOpen && (
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {consumers.length > 0 && (
                  <div style={{
                    borderRadius: r.md, background: p.bg, border: `1px solid ${p.borderLight}`,
                    padding: '14px 16px',
                  }}>
                    <div style={{
                      fontSize: '0.6875rem', fontWeight: 700, color: p.textTertiary,
                      textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10,
                    }}>Used by</div>
                    {consumers.map(c => (
                      <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <SensitivityDot tier={c.sensitivityTier} />
                        <span style={{ fontWeight: 500, fontSize: '0.8125rem', color: p.text }}>{c.name}</span>
                        <span style={{ fontSize: '0.75rem', color: p.textTertiary, marginLeft: 'auto' }}>{c.affectedCount.toLocaleString()} people</span>
                      </div>
                    ))}
                  </div>
                )}
                {metadata && (
                  <div style={{ fontSize: '0.6875rem', color: p.textTertiary, padding: '0 2px' }}>
                    Modified by {metadata.lastModifiedBy} · {new Date(metadata.lastModifiedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SystemFiltersIndicator({ layers, people }: { layers: EvaluationLayer[]; people: Person[] }) {
  const [expanded, setExpanded] = useState(false);
  const total = new Set(layers.flatMap(l => l.excludedPeopleIds)).size;
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
          padding: '9px 14px', borderRadius: r.md,
          background: p.warningLight, border: `1px solid ${p.warningBorder}`,
          cursor: 'pointer', textAlign: 'left', fontFamily: sans,
        }}
      >
        <span style={{ fontSize: '0.8125rem' }}>⚠</span>
        <span style={{ fontSize: '0.8125rem', color: p.warning, fontWeight: 600, flex: 1 }}>
          {total} additional {total === 1 ? 'person' : 'people'} excluded by {layers.length} system {layers.length === 1 ? 'filter' : 'filters'}
        </span>
        <span style={{ fontSize: '0.6875rem', color: p.warning, fontWeight: 400 }}>
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {layers.map(layer => {
            const excluded = people.filter(pp => layer.excludedPeopleIds.includes(pp.id));
            return (
              <div key={layer.id} style={{
                borderRadius: r.md, background: p.bg, border: `1px solid ${p.warningBorder}`,
                padding: '12px 14px',
              }}>
                <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: p.text, marginBottom: 3 }}>{layer.label}</div>
                <div style={{ fontSize: '0.8125rem', color: p.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>{layer.description}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {excluded.map(pp => (
                    <span key={pp.id} style={{
                      padding: '2px 8px', borderRadius: r.full, fontSize: '0.75rem',
                      background: p.dangerLight, color: p.danger, border: `1px solid ${p.dangerBorder}`,
                    }}>{pp.name}</span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Change confirmation — appears inline in chat
// ─────────────────────────────────────────────────────────────────────────────

function ChangeConfirmation({
  diff, consumers, onConfirm, onCancel,
}: { diff: { added: Person[]; removed: Person[] }; consumers: PolicyRef[]; onConfirm: () => void; onCancel: () => void }) {
  const sensitive = consumers.filter(c => c.sensitivityTier <= 2);
  const hot = sensitive.length > 0;
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      borderRadius: r.md, padding: '14px 16px',
      background: hot ? p.dangerLight : p.warningLight,
      border: `1px solid ${hot ? p.dangerBorder : p.warningBorder}`,
      fontSize: '0.8125rem',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    }}>
      <div style={{ fontWeight: 700, color: hot ? p.danger : p.warning, marginBottom: 8 }}>
        Review changes
      </div>
      <div style={{ color: p.text, marginBottom: 8 }}>
        This will <strong>add {diff.added.length}</strong> and <strong>remove {diff.removed.length}</strong> {diff.removed.length === 1 ? 'person' : 'people'}.
      </div>
      {diff.removed.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: p.textSecondary, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Being removed</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {diff.removed.map(pp => (
              <span key={pp.id} style={{
                padding: '2px 8px', borderRadius: r.full, fontSize: '0.75rem',
                background: p.bg, border: `1px solid ${hot ? p.dangerBorder : p.warningBorder}`,
              }}>{pp.name}</span>
            ))}
          </div>
        </div>
      )}
      {sensitive.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '0.6875rem', fontWeight: 600, color: p.danger, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Affected policies</div>
          {sensitive.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <SensitivityDot tier={c.sensitivityTier} />
              <span style={{ color: p.text }}>{c.name}</span>
              <span style={{ color: p.textTertiary, marginLeft: 'auto' }}>{c.affectedCount.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={onConfirm}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.88)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          style={{
            padding: '6px 16px', borderRadius: r.sm, border: 'none', fontFamily: sans,
            background: hot ? p.danger : p.accent, color: '#fff',
            fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            transition: 'filter 0.1s',
          }}>
          {hot ? 'Apply anyway' : 'Apply changes'}
        </button>
        <button onClick={onCancel}
          onMouseEnter={e => (e.currentTarget.style.background = p.surface)}
          onMouseLeave={e => (e.currentTarget.style.background = p.bg)}
          style={{
            padding: '6px 12px', borderRadius: r.sm, fontFamily: sans,
            border: `1px solid ${p.border}`, background: p.bg,
            color: p.textSecondary, fontSize: '0.8125rem', cursor: 'pointer',
            transition: 'background 0.1s',
          }}>Revert</button>
        <span style={{ fontSize: '0.6875rem', color: p.textTertiary }}>Prototype session only</span>
      </div>
    </div>
  );
}

function GroupSuggestion({ group, onUse, onDismiss }: { group: SavedGroup; onUse: () => void; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 10); return () => clearTimeout(t); }, []);
  return (
    <div style={{
      borderRadius: r.md, padding: '14px 16px',
      background: p.accentSoft, border: `1px solid ${p.accentLight}`, fontSize: '0.8125rem',
      opacity: visible ? 1 : 0, transform: visible ? 'translateY(0)' : 'translateY(6px)',
      transition: 'opacity 0.2s ease, transform 0.2s ease',
    }}>
      <div style={{ fontWeight: 700, color: p.accent, marginBottom: 4 }}>Existing group matches</div>
      <div style={{ color: p.text, marginBottom: 3 }}>
        <strong>"{group.name}"</strong> — {group.memberIds.length} members, used by {group.consumers.length} {group.consumers.length === 1 ? 'policy' : 'policies'}.
      </div>
      {group.purpose && <div style={{ color: p.textSecondary, marginBottom: 10, fontStyle: 'italic' }}>{group.purpose}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onUse}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.88)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          style={{
            padding: '6px 14px', borderRadius: r.sm, border: 'none', fontFamily: sans,
            background: p.accent, color: '#fff', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
            transition: 'filter 0.1s',
          }}>Use this group</button>
        <button onClick={onDismiss}
          onMouseEnter={e => (e.currentTarget.style.background = p.surface)}
          onMouseLeave={e => (e.currentTarget.style.background = p.bg)}
          style={{
            padding: '6px 12px', borderRadius: r.sm, fontFamily: sans,
            border: `1px solid ${p.border}`, background: p.bg,
            color: p.textSecondary, fontSize: '0.8125rem', cursor: 'pointer',
            transition: 'background 0.1s',
          }}>Create new</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Chat panel
// ─────────────────────────────────────────────────────────────────────────────

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  if (message.role === 'system') {
    return (
      <div style={{
        textAlign: 'center', fontSize: '0.6875rem', color: p.textTertiary,
        padding: '2px 16px', fontStyle: 'italic',
      }}>
        {message.content}
      </div>
    );
  }
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: isUser ? 'flex-end' : 'flex-start',
      paddingLeft: isUser ? 48 : 0, paddingRight: isUser ? 0 : 48,
    }}>
      {!isUser && (
        <div style={{
          fontSize: '0.6875rem', fontWeight: 600, color: p.textTertiary,
          marginBottom: 4, paddingLeft: 2, letterSpacing: '0.02em',
        }}>Co-pilot</div>
      )}
      <div style={{
        padding: '10px 14px', fontSize: '0.875rem', lineHeight: 1.55,
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? p.accent : p.bg,
        color: isUser ? '#fff' : p.text,
        border: isUser ? 'none' : `1px solid ${p.borderLight}`,
        maxWidth: '100%', wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
        boxShadow: isUser ? 'none' : '0 1px 2px rgba(0,0,0,0.04)',
      }}>
        {message.content}
      </div>
      {message.memberDiff && (message.memberDiff.added.length > 0 || message.memberDiff.removed.length > 0) && (
        <div style={{
          marginTop: 5, display: 'flex', gap: 8, fontSize: '0.75rem', fontWeight: 600,
        }}>
          {message.memberDiff.added.length > 0 && <span style={{ color: p.success }}>+{message.memberDiff.added.length} added</span>}
          {message.memberDiff.removed.length > 0 && <span style={{ color: p.danger }}>−{message.memberDiff.removed.length} removed</span>}
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  messages, onSend, suggestion, changeDiff, isInline,
}: {
  messages: ChatMessage[];
  onSend: (t: string) => void;
  suggestion?: { group: SavedGroup; onUse: () => void; onDismiss: () => void } | null;
  changeDiff?: { diff: { added: Person[]; removed: Person[] }; consumers: PolicyRef[]; onConfirm: () => void; onCancel: () => void } | null;
  isInline?: boolean;
}) {
  const [input, setInput] = useState('');
  const [promptsVisible, setPromptsVisible] = useState(true);
  const [promptsFading, setPromptsFading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasFailed = messages.some(m => m.role === 'assistant' && m.content.includes("wasn't able to translate"));
  const hasUserMsg = messages.some(m => m.role === 'user');

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, suggestion, changeDiff]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fade out quick prompts when first user message arrives
  useEffect(() => {
    if (hasUserMsg && promptsVisible && !promptsFading) {
      setPromptsFading(true);
      const t = setTimeout(() => setPromptsVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [hasUserMsg]);

  const send = () => {
    const t = input.trim(); if (!t) return;
    setInput(''); onSend(t);
    if (inputRef.current) inputRef.current.style.height = 'auto';
  };

  const quickPrompts = [
    'All full-time employees in the US',
    'Engineering team',
    'Everyone except contractors',
    'People who joined after January 2025',
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: p.bg }}>
      {/* Messages */}
      <div ref={scrollRef} style={{
        flex: 1, overflowY: 'auto', padding: '20px 18px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {messages.map(m => <ChatBubble key={m.id} message={m} />)}
        {suggestion && <GroupSuggestion {...suggestion} />}
        {changeDiff && <ChangeConfirmation {...changeDiff} />}

        {/* Quick starts — fade out when first user message arrives */}
        {promptsVisible && !isInline && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 4, opacity: promptsFading ? 0 : 1, transition: 'opacity 0.2s ease' }}>
            <div style={{ fontSize: '0.6875rem', color: p.textTertiary, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 2 }}>
              Try
            </div>
            {quickPrompts.map((q, i) => (
              <button key={i} onClick={() => onSend(q)} style={{
                padding: '9px 13px', borderRadius: r.md, textAlign: 'left', cursor: 'pointer',
                border: `1px solid ${p.borderLight}`, background: p.canvas,
                fontSize: '0.8125rem', color: p.text, fontFamily: sans,
                transition: 'background 0.1s, border-color 0.1s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = p.surface; e.currentTarget.style.borderColor = p.accent; }}
                onMouseLeave={e => { e.currentTarget.style.background = p.canvas; e.currentTarget.style.borderColor = p.borderLight; }}
              >
                "{q}"
              </button>
            ))}
          </div>
        )}

        {/* Vocabulary hint after first failure */}
        {hasFailed && (
          <div style={{
            padding: '12px 14px', borderRadius: r.md,
            background: p.canvas, border: `1px solid ${p.borderLight}`,
            fontSize: '0.75rem', color: p.textSecondary,
          }}>
            <div style={{ fontWeight: 700, color: p.text, marginBottom: 8 }}>
              This prototype understands:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                'Department — Engineering, Sales, Finance, HR, Marketing',
                'Country — US, United Kingdom',
                'Location — San Francisco, New York, Austin, London',
                'Employment type — full-time, part-time, contractor',
                'Start date — "started after January 2025"',
              ].map((t, i) => (
                <div key={i} style={{ display: 'flex', gap: 6 }}>
                  <span style={{ color: p.accent, flexShrink: 0 }}>·</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px 16px', background: p.bg, borderTop: `1px solid ${p.borderLight}` }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 12px',
          borderRadius: r.lg, border: `1.5px solid ${p.border}`,
          background: p.canvas, transition: 'border-color 0.15s',
        }}
          onFocusCapture={e => (e.currentTarget.style.borderColor = p.accent)}
          onBlurCapture={e => (e.currentTarget.style.borderColor = p.border)}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => {
              setInput(e.target.value);
              const el = e.target; el.style.height = 'auto';
              el.style.height = Math.min(el.scrollHeight, 120) + 'px';
            }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={'e.g. "all full-time employees in the US"'}
            rows={1}
            style={{
              flex: 1, border: 'none', outline: 'none', resize: 'none', background: 'transparent',
              fontSize: '0.875rem', color: p.text, fontFamily: sans, lineHeight: 1.5,
              padding: '2px 0', maxHeight: 120,
            }}
          />
          <button
            onClick={send} disabled={!input.trim()}
            style={{
              width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
              background: input.trim() ? p.accent : p.surface,
              color: input.trim() ? '#fff' : p.textTertiary,
              cursor: input.trim() ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9375rem', transition: 'background 0.15s',
            }}
            aria-label="Send"
          >↑</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Two-column shell
// ─────────────────────────────────────────────────────────────────────────────

function Shell({ chat, artifact }: { chat: React.ReactNode; artifact: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: sans, color: p.text, fontSize: '0.875rem' }}>
      {/* Chat — 42% */}
      <div style={{
        flex: '0 0 42%', minWidth: 0, display: 'flex', flexDirection: 'column',
        borderRight: `1px solid ${p.border}`,
      }}>
        <div style={{
          padding: '10px 18px', borderBottom: `1px solid ${p.borderLight}`, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8, background: p.bg,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: '50%', background: p.accent,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontSize: '0.5625rem', fontWeight: 800,
          }}>AI</div>
          <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Co-pilot</span>
          <span style={{ fontSize: '0.6875rem', color: p.textTertiary }}>
            — describe, ask questions, explain membership
          </span>
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>{chat}</div>
      </div>

      {/* Artifact — 58% */}
      <div style={{ flex: '0 0 58%', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '10px 18px', borderBottom: `1px solid ${p.border}`, flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 8, background: p.canvas,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="12" rx="2" stroke={p.textSecondary} strokeWidth="1.25" fill="none"/>
            <line x1="3.5" y1="4.5" x2="10.5" y2="4.5" stroke={p.textSecondary} strokeWidth="1.25" strokeLinecap="round"/>
            <line x1="3.5" y1="7" x2="10.5" y2="7" stroke={p.textSecondary} strokeWidth="1.25" strokeLinecap="round"/>
            <line x1="3.5" y1="9.5" x2="7.5" y2="9.5" stroke={p.textSecondary} strokeWidth="1.25" strokeLinecap="round"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: '0.8125rem' }}>Group definition</span>
          <span style={{
            marginLeft: 4, padding: '1px 7px', borderRadius: r.full,
            background: p.bg, border: `1px solid ${p.border}`,
            fontSize: '0.6875rem', color: p.textSecondary, fontWeight: 500,
          }}>editable</span>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{artifact}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared handler logic for Create / Edit / View
// ─────────────────────────────────────────────────────────────────────────────

function buildViewHandler(
  group: SavedGroup,
  members: Person[],
  people: Person[],
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
) {
  return (text: string) => {
    setMessages(prev => [...prev, msg('user', text)]);
    const lower = text.toLowerCase();

    const whyMatch = lower.match(/why.+?([\w\s'-]+?)(?:\s+(?:in|included|out|excluded|not in))/);
    if (whyMatch || lower.includes('why is')) {
      const name = whyMatch?.[1]?.trim();
      const person = name ? people.find(pp => pp.name.toLowerCase().includes(name)) : null;
      if (person) {
        setMessages(prev => [...prev, msg('assistant', explainPerson(person, group.rule, group.evaluationLayers))]);
        return;
      }
    }
    if (lower.includes('who') || lower.includes('member') || lower.includes('list')) {
      setMessages(prev => [...prev, msg('assistant', `This group has ${members.length} members:\n${members.map(m => `• ${m.name} (${m.title})`).join('\n')}`)]);
      return;
    }
    if (lower.includes('what') || lower.includes('explain') || lower.includes('describe')) {
      let r2 = `"${group.name || 'Untitled'}" — ${ruleToSentence(group.rule)}.`;
      if (group.evaluationLayers.length > 0) {
        const excluded = new Set(group.evaluationLayers.flatMap(l => l.excludedPeopleIds)).size;
        r2 += `\n\n${group.evaluationLayers.length} system filters apply, excluding ${excluded} additional people:\n` + group.evaluationLayers.map(l => `• ${l.label}`).join('\n');
      }
      if (group.consumers.length > 0)
        r2 += `\n\nUsed by: ${group.consumers.map(c => c.name).join(', ')}.`;
      setMessages(prev => [...prev, msg('assistant', r2)]);
      return;
    }
    if (lower.includes('filter') || lower.includes('hidden') || lower.includes('system')) {
      if (group.evaluationLayers.length === 0)
        setMessages(prev => [...prev, msg('assistant', 'No system filters are applied to this group.')]);
      else
        setMessages(prev => [...prev, msg('assistant',
          `${group.evaluationLayers.length} system filters:\n` +
          group.evaluationLayers.map(l => `• ${l.label}: ${l.description} (${l.excludedPeopleIds.length} people excluded)`).join('\n')
        )]);
      return;
    }
    setMessages(prev => [...prev, msg('assistant',
      `I can help you understand this group. Ask:\n• "What does this group do?"\n• "Why is [name] in this group?"\n• "What system filters are applied?"\n• "Who are the members?"`
    )]);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// View mode
// ─────────────────────────────────────────────────────────────────────────────

function ViewMode({ entryState }: { entryState: EntryState }) {
  const { data, scenario } = entryState;
  const group = data.savedGroups.find(g => g.id === (scenario as { groupId: string }).groupId);

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (!group) return [msg('assistant', 'Group not found.')];
    return [msg('assistant', group.isLegacy
      ? `This is a legacy system-managed group with no name or description. Its rule is: ${ruleToSentence(group.rule)}. It has ${group.memberIds.length} members. Ask me anything.`
      : `You're looking at "${group.name}." Rule: ${ruleToSentence(group.rule)}. ${group.memberIds.length} members.${group.evaluationLayers.length > 0 ? ` ${group.evaluationLayers.length} system filters also apply.` : ''} What would you like to know?`
    )];
  });

  const members = useMemo(() => group ? data.people.filter(pp => group.memberIds.includes(pp.id)) : [], [group, data.people]);

  if (!group) return <div style={{ padding: 40, color: p.textTertiary, fontFamily: sans }}>Group not found.</div>;

  const handleAskWhy = (person: Person) => {
    const explanation = explainPerson(person, group.rule, group.evaluationLayers);
    setMessages(prev => [...prev, msg('user', `Why is ${person.name} in this group?`), msg('assistant', explanation)]);
  };

  return (
    <Shell
      chat={<ChatPanel messages={messages} onSend={buildViewHandler(group, members, data.people, setMessages)} />}
      artifact={
        <ArtifactPanel
          groupName={group.name || '(Legacy)'} groupPurpose={group.purpose}
          rule={group.rule} layers={group.evaluationLayers} consumers={group.consumers}
          members={members} people={data.people} isEditing={false} hasRule={true}
          onRuleChange={() => {}} onAskWhy={handleAskWhy}
          onGroupNameChange={() => {}} onGroupPurposeChange={() => {}}
          ruleVersion={0}
          metadata={{ owner: group.owner || 'system', lastModifiedBy: group.lastModifiedBy, lastModifiedAt: group.lastModifiedAt, lifecycleIntent: group.lifecycleIntent, productDomain: group.productDomain || 'Unknown' }}
        />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Edit mode
// ─────────────────────────────────────────────────────────────────────────────

function EditMode({ entryState }: { entryState: EntryState }) {
  const { data, scenario } = entryState;
  const group = data.savedGroups.find(g => g.id === (scenario as { groupId: string }).groupId)!;
  const [rule, setRule] = useState<RuleGroup>(group.rule);
  const [groupName, setGroupName] = useState(group.name);
  const [groupPurpose, setGroupPurpose] = useState(group.purpose);
  const [ruleVersion, setRuleVersion] = useState(0);
  const [pendingChange, setPendingChange] = useState<{ diff: { added: Person[]; removed: Person[] }; consumers: PolicyRef[] } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    msg('assistant', `You're editing "${group.name}." Current rule: ${ruleToSentence(group.rule)}\n\nTell me what you'd like to change, ask questions about the current members, or edit the rule directly on the right.`),
  ]);

  const originalMembers = useMemo(() => data.people.filter(pp => group.memberIds.includes(pp.id)), [group, data.people]);
  const currentResult = useMemo(() => computeMembers(data.people, rule, group.evaluationLayers), [rule, data.people, group.evaluationLayers]);

  const applyRuleChange = useCallback((newRule: RuleGroup, source: 'chat' | 'builder') => {
    const result = computeMembers(data.people, newRule, group.evaluationLayers);
    const diff = computeDiff(originalMembers, result.included);
    setRule(newRule);
    setRuleVersion(v => v + 1);
    if (diff.added.length > 0 || diff.removed.length > 0) {
      setPendingChange({ diff, consumers: group.consumers });
      setMessages(prev => [...prev, msg('assistant', `I've paused — review the change summary above and confirm or revert.${source === 'builder' ? ' (Rule edited directly.)' : ''}`)]);
    }
  }, [data.people, group, originalMembers]);

  const handleSend = useCallback((text: string) => {
    setMessages(prev => [...prev, msg('user', text)]);
    const lower = text.toLowerCase();

    if ((lower.includes('apply') || lower.includes('yes') || lower.includes('confirm') || lower.includes('save')) && pendingChange) {
      setPendingChange(null);
      setMessages(prev => [...prev, msg('assistant', 'Changes applied.')]);
      return;
    }
    if ((lower.includes('cancel') || lower.includes('revert') || lower.includes('undo')) && pendingChange) {
      setRule(group.rule); setRuleVersion(v => v + 1); setPendingChange(null);
      setMessages(prev => [...prev, msg('assistant', 'Reverted to the previous rule.')]);
      return;
    }

    // "Why is X..." explanation
    const whyMatch = lower.match(/why.+?([\w\s'-]+?)(?:\s+(?:in|included|out|excluded|not))/);
    if (whyMatch || lower.includes('why is')) {
      const name = whyMatch?.[1]?.trim();
      const person = name ? data.people.find(pp => pp.name.toLowerCase().includes(name)) : null;
      if (person) { setMessages(prev => [...prev, msg('assistant', explainPerson(person, rule, group.evaluationLayers))]); return; }
    }

    if (lower.includes('impact') || lower.includes('what if') || lower.includes('what would') || lower.includes('happen')) {
      const diff = computeDiff(originalMembers, currentResult.included);
      setMessages(prev => [...prev, msg('assistant',
        `Current pending diff: +${diff.added.length} added, −${diff.removed.length} removed.` +
        (group.consumers.length > 0 ? `\nAffects: ${group.consumers.map(c => c.name).join(', ')}.` : '')
      )]);
      return;
    }

    const result = parseNaturalLanguage(text, data.people);
    if (result.rule) {
      const newMembers = computeMembers(data.people, result.rule, group.evaluationLayers);
      const diff = computeDiff(originalMembers, newMembers.included);
      applyRuleChange(result.rule, 'chat');
      setMessages(prev => [...prev, msg('assistant', result.response, {
        memberDiff: { added: diff.added.map(pp => pp.id), removed: diff.removed.map(pp => pp.id) },
      })]);
    } else {
      setMessages(prev => [...prev, msg('assistant', result.response)]);
    }
  }, [data.people, group, originalMembers, rule, currentResult, pendingChange, applyRuleChange]);

  const handleAskWhy = (person: Person) => {
    setMessages(prev => [...prev, msg('user', `Why is ${person.name} in this group?`), msg('assistant', explainPerson(person, rule, group.evaluationLayers))]);
  };

  return (
    <Shell
      chat={
        <ChatPanel
          messages={messages} onSend={handleSend}
          changeDiff={pendingChange ? {
            ...pendingChange,
            onConfirm: () => { setPendingChange(null); setMessages(prev => [...prev, msg('assistant', 'Changes applied.')]); },
            onCancel: () => { setRule(group.rule); setRuleVersion(v => v + 1); setPendingChange(null); setMessages(prev => [...prev, msg('assistant', 'Reverted.')]); },
          } : null}
        />
      }
      artifact={
        <ArtifactPanel
          groupName={groupName} groupPurpose={groupPurpose}
          rule={rule} layers={group.evaluationLayers} consumers={group.consumers}
          members={currentResult.included} people={data.people}
          isEditing={true} hasRule={true}
          onRuleChange={r2 => applyRuleChange(r2, 'builder')} onAskWhy={handleAskWhy}
          onGroupNameChange={setGroupName} onGroupPurposeChange={setGroupPurpose}
          onConditionAdded={c => setMessages(prev => [...prev, msg('assistant', `Condition added directly: ${conditionToNL(c)}. The member count has updated.`)])}
          onCombinatorChanged={(from, to) => setMessages(prev => [...prev, msg('assistant', `Logic changed from ${from} to ${to} — members must now match ${to === 'AND' ? 'all' : 'any'} conditions.`)])}
          ruleVersion={ruleVersion}
          metadata={{ owner: group.owner, lastModifiedBy: group.lastModifiedBy, lastModifiedAt: group.lastModifiedAt, lifecycleIntent: group.lifecycleIntent, productDomain: group.productDomain }}
        />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create mode
// ─────────────────────────────────────────────────────────────────────────────

// Wrong-rule scenario: pre-seeded wrong OR rule for Austin Engineering
const WRONG_RULE_SEED: RuleGroup = {
  type: 'group',
  combinator: 'OR',
  children: [
    { type: 'condition', field: 'department', operator: 'is', value: 'Engineering' },
    { type: 'condition', field: 'location', operator: 'is', value: 'Austin' },
  ],
};

function CreateMode({ entryState }: { entryState: EntryState }) {
  const { data, scenario } = entryState;
  const policyContext = scenario.type === 'create' ? scenario.policyContext : undefined;
  const isWrongDemo = policyContext?.id === 'pol-wrong-demo';

  const [rule, setRule] = useState<RuleGroup>(
    isWrongDemo ? WRONG_RULE_SEED : { type: 'group', combinator: 'AND', children: [] }
  );
  const [groupName, setGroupName] = useState(isWrongDemo ? 'Austin Engineering Onboarding' : '');
  const [groupPurpose, setGroupPurpose] = useState('');
  const [ruleVersion, setRuleVersion] = useState(isWrongDemo ? 1 : 0);
  const [layers] = useState<EvaluationLayer[]>(data.savedGroups[0]?.evaluationLayers || []);
  const [suggestion, setSuggestion] = useState<{ group: SavedGroup; onUse: () => void; onDismiss: () => void } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (isWrongDemo) {
      return [
        msg('user', 'All engineers in Austin'),
        msg('assistant',
          'I translated that as: "Everyone where Department is Engineering OR Location is Austin."\n\n' +
          'That matches 7 people before system filters. Does this look right?\n\n' +
          '⚠ Note: I used OR — so this includes everyone in Engineering (anywhere) plus everyone in Austin (any department). ' +
          'If you meant only engineers who are based in Austin, switch the logic to AND using the toggle on the right.'
        ),
      ];
    }
    return [
      msg('assistant', policyContext
        ? `Creating a group for "${policyContext.name}."\n\nDescribe who should be in it — for example, "all full-time employees in the US" or "engineering team."`
        : 'Describe who should be in this group.\n\nTry: "all full-time employees in the US," "engineering team," or "everyone except contractors."'
      ),
    ];
  });

  const hasRule = rule.children.length > 0;
  const currentResult = useMemo(() => computeMembers(data.people, rule, layers), [rule, data.people, layers]);

  const handleSend = useCallback((text: string) => {
    setMessages(prev => [...prev, msg('user', text)]);
    const lower = text.toLowerCase();

    if (lower.startsWith('name it ') || lower.startsWith('call it ')) {
      const name = text.slice(text.indexOf(' it ') + 4).replace(/^["']|["']$/g, '');
      setGroupName(name);
      setMessages(prev => [...prev, msg('assistant', `Name set to "${name}."`)]);
      return;
    }

    const result = parseNaturalLanguage(text, data.people);
    if (result.rule) {
      setRule(result.rule);
      setRuleVersion(v => v + 1);
      setSuggestion(null);
      if (!groupName) setGroupName(generateGroupName(result.rule));
      const match = findMatchingGroup(result.rule, data.savedGroups);
      if (match) {
        setSuggestion({
          group: match,
          onUse: () => {
            setRule(match.rule); setRuleVersion(v => v + 1);
            setGroupName(match.name); setGroupPurpose(match.purpose);
            setSuggestion(null);
            setMessages(prev => [...prev, msg('system', `Using existing group "${match.name}".`)]);
          },
          onDismiss: () => { setSuggestion(null); setMessages(prev => [...prev, msg('system', 'Creating new group.')]); },
        });
      }
      setMessages(prev => [...prev, msg('assistant', result.response)]);
    } else {
      setMessages(prev => [...prev, msg('assistant', result.response)]);
    }
  }, [data, groupName]);

  const handleAskWhy = (person: Person) => {
    setMessages(prev => [...prev, msg('user', `Why is ${person.name} included?`), msg('assistant', explainPerson(person, rule, layers))]);
  };

  return (
    <Shell
      chat={<ChatPanel messages={messages} onSend={handleSend} suggestion={suggestion} />}
      artifact={
        <ArtifactPanel
          groupName={groupName} groupPurpose={groupPurpose}
          rule={rule} layers={layers}
          consumers={policyContext ? [policyContext] : []}
          members={currentResult.included} people={data.people}
          isEditing={true} hasRule={hasRule}
          onRuleChange={r2 => { setRule(r2); setRuleVersion(v => v + 1); }} onAskWhy={handleAskWhy}
          onGroupNameChange={setGroupName} onGroupPurposeChange={setGroupPurpose}
          onConditionAdded={c => setMessages(prev => [...prev, msg('assistant', `Condition added: ${conditionToNL(c)}.`)])}
          onCombinatorChanged={(from, to) => {
            const newRule = { ...rule, combinator: to };
            const result = computeMembers(data.people, newRule, layers);
            const correction = isWrongDemo && from === 'OR' && to === 'AND'
              ? `\n\nGot it — AND is correct here. That now matches ${result.included.length} ${result.included.length === 1 ? 'person' : 'people'}: only engineers who are specifically based in Austin.`
              : '';
            setMessages(prev => [...prev, msg('assistant',
              `Logic changed from ${from} to ${to} — members must now match ${to === 'AND' ? 'all' : 'any'} conditions. ${result.included.length} people match.${correction}`
            )]);
          }}
          ruleVersion={ruleVersion}
          onSave={() => setMessages(prev => [...prev, msg('assistant', 'Group saved.')])}
        />
      }
    />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline variant (policy builder context)
// ─────────────────────────────────────────────────────────────────────────────

function InlineRulePreview({ rule, memberCount }: { rule: RuleGroup; memberCount: number }) {
  if (rule.children.length === 0) return null;
  const conditions = rule.children.filter((c): c is RuleCondition => c.type === 'condition');
  return (
    <div style={{
      borderTop: `1px solid ${p.borderLight}`, padding: '8px 14px',
      background: p.accentSoft, display: 'flex', alignItems: 'center',
      gap: 6, flexWrap: 'wrap', flexShrink: 0,
    }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: p.textTertiary, flexShrink: 0 }}>Rule:</span>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, flex: 1 }}>
        {conditions.map((c, i) => (
          <Chip key={i} field={fl(c.field)} op={ol(c.operator)} value={Array.isArray(c.value) ? c.value.map(vl).join(', ') : vl(c.value)} />
        ))}
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: p.accent, flexShrink: 0 }}>
        {memberCount} {memberCount === 1 ? 'member' : 'members'}
      </span>
    </div>
  );
}

function InlineMode({ entryState }: { entryState: EntryState }) {
  const { data, scenario } = entryState;
  const policyContext = scenario.type === 'inline-select' ? scenario.policyContext : undefined;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'browse' | 'create'>('browse');
  const [rule, setRule] = useState<RuleGroup>({ type: 'group', combinator: 'AND', children: [] });
  const [hasNewRule, setHasNewRule] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    msg('assistant', policyContext
      ? `Selecting for "${policyContext.name}." Browse existing groups or describe a new one.`
      : 'Browse saved groups or describe one.'),
  ]);

  const members = useMemo(() => {
    if (selectedId) {
      const g = data.savedGroups.find(sg => sg.id === selectedId);
      return g ? data.people.filter(pp => g.memberIds.includes(pp.id)) : [];
    }
    return computeMembers(data.people, rule, []).included;
  }, [selectedId, rule, data]);

  const handleSend = (text: string) => {
    setMessages(prev => [...prev, msg('user', text)]);
    const result = parseNaturalLanguage(text, data.people);
    if (result.rule) {
      setRule(result.rule); setSelectedId(null); setHasNewRule(true);
      const match = findMatchingGroup(result.rule, data.savedGroups);
      setMessages(prev => [...prev, msg('assistant',
        result.response + (match ? `\n\nI found a matching group: "${match.name}."` : '')
      )]);
    } else {
      setMessages(prev => [...prev, msg('assistant', result.response)]);
    }
  };

  const handleTabChange = (t: 'browse' | 'create') => {
    setTab(t);
    if (t === 'browse') { setHasNewRule(false); }
  };

  const selectedGroup = selectedId ? data.savedGroups.find(g => g.id === selectedId) : null;
  const showFooter = selectedId !== null || hasNewRule;
  const confirmLabel = hasNewRule && !selectedId
    ? `Use this rule (${members.length} ${members.length === 1 ? 'member' : 'members'})`
    : `Confirm (${members.length} ${members.length === 1 ? 'member' : 'members'})`;
  const confirmedName = selectedGroup?.name || (hasNewRule ? 'New group' : 'Selected group');

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 480,
      border: `1px solid ${p.border}`, borderRadius: r.lg, overflow: 'hidden',
      background: p.bg, fontFamily: sans,
    }}>
      {policyContext && (
        <div style={{
          padding: '8px 14px', background: p.accentSoft, borderBottom: `1px solid ${p.accentLight}`,
          fontSize: '0.75rem', color: p.accent, fontWeight: 600,
        }}>
          Selecting group for: {policyContext.name}
        </div>
      )}
      <div style={{ display: 'flex', borderBottom: `1px solid ${p.borderLight}`, padding: '0 12px' }}>
        {(['browse', 'create'] as const).map(t => (
          <button key={t} onClick={() => handleTabChange(t)} style={{
            padding: '9px 14px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: '0.8125rem', fontWeight: tab === t ? 700 : 400,
            color: tab === t ? p.accent : p.textSecondary, fontFamily: sans,
            borderBottom: tab === t ? `2px solid ${p.accent}` : '2px solid transparent',
          }}>
            {t === 'browse' ? 'Browse groups' : 'Describe with AI'}
          </button>
        ))}
      </div>

      {tab === 'browse' ? (
        <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
          {data.savedGroups.filter(g => !g.isLegacy).map(g => (
            <button key={g.id} onClick={() => { setSelectedId(g.id); setHasNewRule(false); }} style={{
              display: 'flex', flexDirection: 'column', gap: 3, width: '100%',
              padding: '11px 12px', borderRadius: r.md, marginBottom: 5, textAlign: 'left', fontFamily: sans,
              border: `1px solid ${selectedId === g.id ? p.accent : p.borderLight}`,
              background: selectedId === g.id ? p.accentSoft : p.bg,
              cursor: 'pointer', transition: 'border-color 0.12s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: p.text }}>{g.name}</span>
                <span style={{
                  padding: '2px 8px', borderRadius: r.full, fontSize: '0.6875rem',
                  background: p.surface, color: p.textSecondary,
                }}>{g.memberIds.length} members</span>
              </div>
              {g.purpose && <span style={{ fontSize: '0.75rem', color: p.textSecondary }}>{g.purpose}</span>}
              {g.consumers.length > 0 && (
                <span style={{ fontSize: '0.6875rem', color: p.textTertiary }}>Used by {g.consumers.length} policies</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <ChatPanel messages={messages} onSend={handleSend} isInline />
          </div>
          <InlineRulePreview rule={rule} memberCount={members.length} />
        </div>
      )}

      {/* Footer: confirm selection or new rule */}
      {showFooter && !confirmed && (
        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${p.borderLight}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: p.canvas, flexShrink: 0,
        }}>
          <span style={{ fontSize: '0.8125rem', color: p.textSecondary, fontStyle: 'italic' }}>
            {selectedGroup?.name || (hasNewRule ? ruleToSentence(rule).slice(0, 40) + '…' : '')}
          </span>
          <button
            onClick={() => setConfirmed(true)}
            style={{
              padding: '6px 16px', borderRadius: r.sm, border: 'none', fontFamily: sans,
              background: p.accent, color: '#fff', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer',
            }}
          >{confirmLabel}</button>
        </div>
      )}

      {/* Confirmed state — replaces footer */}
      {confirmed && (
        <div style={{
          padding: '10px 14px', borderTop: `1px solid ${p.borderLight}`,
          display: 'flex', alignItems: 'center', gap: 8,
          background: p.successLight, flexShrink: 0,
        }}>
          <span style={{ fontSize: '1rem' }}>✓</span>
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: p.success }}>
            "{confirmedName}" selected{policyContext ? ` for ${policyContext.name}` : ''}.
          </span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Root
// ─────────────────────────────────────────────────────────────────────────────

export default function ConceptC({ entryState }: { entryState: EntryState }) {
  const { scenario, context } = entryState;
  if (context === 'inline' || scenario.type === 'inline-select') return <InlineMode entryState={entryState} />;
  switch (scenario.type) {
    case 'create': return <CreateMode entryState={entryState} />;
    case 'view':   return <ViewMode entryState={entryState} />;
    case 'edit':   return <EditMode entryState={entryState} />;
    default:       return <CreateMode entryState={entryState} />;
  }
}

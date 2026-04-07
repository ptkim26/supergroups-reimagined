import React, { useState, useMemo, useCallback } from 'react';
import type {
  ConceptProps,
  EntryState,
  Person,
  SavedGroup,
  RuleGroup,
  RuleCondition,
  RuleNode,
  EvaluationLayer,
  PolicyRef,
} from '../shell/types';

// ── Font injection ────────────────────────────────────────────────────────

if (typeof document !== 'undefined') {
  const id = 'concept-a-fonts';
  if (!document.getElementById(id)) {
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap';
    document.head.appendChild(link);
  }
}

const FONT = '"DM Sans", system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

// ── Rule evaluation ────────────────────────────────────────────────────────

function evaluateCondition(person: Person, cond: RuleCondition): boolean {
  const val = person[cond.field as keyof Person];
  if (val === undefined) return false;
  switch (cond.operator) {
    case 'is': return val === cond.value;
    case 'is_not': return val !== cond.value;
    case 'contains': return typeof val === 'string' && val.toLowerCase().includes((cond.value as string).toLowerCase());
    case 'in': return Array.isArray(cond.value) && cond.value.includes(val as string);
    case 'greater_than': return val > cond.value;
    case 'less_than': return val < cond.value;
    case 'after': return val > cond.value;
    case 'before': return val < cond.value;
    default: return false;
  }
}

function evaluateRule(person: Person, node: RuleNode): boolean {
  if (node.type === 'condition') return evaluateCondition(person, node);
  const results = node.children.map(c => evaluateRule(person, c));
  return node.combinator === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

function computeMembers(
  people: Person[],
  rule: RuleGroup,
  layers: EvaluationLayer[],
): { matched: Person[]; excluded: Map<string, EvaluationLayer[]>; final: Person[] } {
  const matched = people.filter(p => evaluateRule(p, rule));
  const excluded = new Map<string, EvaluationLayer[]>();
  for (const layer of layers) {
    for (const pid of layer.excludedPeopleIds) {
      if (!excluded.has(pid)) excluded.set(pid, []);
      excluded.get(pid)!.push(layer);
    }
  }
  const final = matched.filter(p => !excluded.has(p.id));
  return { matched, excluded, final };
}

function flattenConditions(node: RuleNode): RuleCondition[] {
  if (node.type === 'condition') return [node];
  return node.children.flatMap(c => flattenConditions(c));
}

function cloneRule(rule: RuleGroup): RuleGroup {
  return JSON.parse(JSON.stringify(rule));
}

function findSimilarGroups(rule: RuleGroup, savedGroups: SavedGroup[], currentGroupId?: string): SavedGroup[] {
  const flat = flattenConditions(rule);
  if (flat.length === 0) return [];
  return savedGroups.filter(sg => {
    if (sg.id === currentGroupId) return false;
    const sgFlat = flattenConditions(sg.rule);
    let overlap = 0;
    for (const c of flat) {
      if (sgFlat.some(sc => sc.field === c.field && sc.operator === c.operator && JSON.stringify(sc.value) === JSON.stringify(c.value))) {
        overlap++;
      }
    }
    return overlap > 0 && overlap >= Math.min(flat.length, sgFlat.length) * 0.5;
  });
}

// ── Flat sequence helpers ─────────────────────────────────────────────────
// The AST stores one combinator per group. To allow per-connector toggling,
// we convert between a flat sequence (conditions + per-connector combinators)
// and the nested AST. AND takes precedence: "A or B and C" = "A or (B and C)".

type FlatSequence = { conditions: RuleCondition[]; connectors: ('AND' | 'OR')[] };

/** Try to flatten a RuleGroup into a linear sequence of conditions + connectors.
 *  Returns null for structures too complex to represent linearly (deeply nested legacy rules). */
function flattenToSequence(group: RuleGroup): FlatSequence | null {
  // All children are conditions — simple case
  if (group.children.every(c => c.type === 'condition')) {
    const conditions = group.children as RuleCondition[];
    const connectors: ('AND' | 'OR')[] = Array(Math.max(0, conditions.length - 1)).fill(group.combinator);
    return { conditions, connectors };
  }

  // OR group whose children are conditions or AND-groups-of-conditions
  if (group.combinator === 'OR') {
    const conditions: RuleCondition[] = [];
    const connectors: ('AND' | 'OR')[] = [];
    for (const child of group.children) {
      if (child.type === 'condition') {
        if (conditions.length > 0) connectors.push('OR');
        conditions.push(child);
      } else if (
        child.type === 'group' && child.combinator === 'AND' &&
        child.children.every(c => c.type === 'condition')
      ) {
        for (let j = 0; j < child.children.length; j++) {
          if (conditions.length > 0) connectors.push(j === 0 ? 'OR' : 'AND');
          conditions.push(child.children[j] as RuleCondition);
        }
      } else {
        return null; // too complex
      }
    }
    return { conditions, connectors };
  }

  // AND group — if it contains only conditions, already handled above.
  // If it contains sub-groups, we can't represent it as a flat AND-precedence sequence.
  return null;
}

/** Build a properly nested AST from a flat sequence. AND binds tighter than OR. */
function buildFromSequence(conditions: RuleCondition[], connectors: ('AND' | 'OR')[]): RuleGroup {
  if (conditions.length === 0) return { type: 'group', combinator: 'AND', children: [] };
  if (conditions.length === 1) return { type: 'group', combinator: 'AND', children: [conditions[0]] };

  // If all connectors are the same, one flat group
  if (connectors.every(c => c === connectors[0])) {
    return { type: 'group', combinator: connectors[0], children: [...conditions] };
  }

  // Mixed: split at OR boundaries. Each AND-connected run becomes a sub-group.
  const segments: RuleCondition[][] = [];
  let current: RuleCondition[] = [conditions[0]];
  for (let i = 0; i < connectors.length; i++) {
    if (connectors[i] === 'OR') {
      segments.push(current);
      current = [conditions[i + 1]];
    } else {
      current.push(conditions[i + 1]);
    }
  }
  segments.push(current);

  const children: (RuleCondition | RuleGroup)[] = segments.map(seg =>
    seg.length === 1
      ? seg[0]
      : { type: 'group' as const, combinator: 'AND' as const, children: seg }
  );

  return { type: 'group', combinator: 'OR', children };
}

// ── Labels ─────────────────────────────────────────────────────────────────

function fieldLabel(field: string): string {
  const map: Record<string, string> = {
    department: 'Department', location: 'Location', country: 'Country',
    employmentType: 'Employment type', roleState: 'Role state',
    startDate: 'Start date', title: 'Title', name: 'Name',
  };
  return map[field] || field;
}

function operatorLabel(op: string): string {
  const map: Record<string, string> = {
    is: 'is', is_not: 'is not', contains: 'contains', in: 'is one of',
    greater_than: '>', less_than: '<', after: 'after', before: 'before',
  };
  return map[op] || op;
}

function valueLabel(val: string | string[]): string {
  if (Array.isArray(val)) return val.join(', ');
  const map: Record<string, string> = {
    full_time: 'Full-time', part_time: 'Part-time', contractor: 'Contractor',
    active: 'Active', pending: 'Pending', terminated: 'Terminated',
    US: 'United States', GB: 'United Kingdom',
  };
  return map[val] || val;
}

function sensitivityColor(tier: 1 | 2 | 3): string {
  return tier === 1 ? C.red : tier === 2 ? C.amber : C.textMuted;
}

function sensitivityLabel(tier: 1 | 2 | 3): string {
  return tier === 1 ? 'Critical' : tier === 2 ? 'High' : 'Standard';
}

// ── Design tokens ──────────────────────────────────────────────────────────

const C = {
  bg: '#fafaf9',
  bgSurface: '#f3f2f0',
  bgHover: '#ebeae6',
  border: '#dedcd7',
  borderLight: '#e9e7e3',
  text: '#1c1b18',
  textSecondary: '#5c5a55',
  textMuted: '#97958f',
  accent: '#2c5ea3',
  accentLight: '#c8d7eb',
  accentBg: '#edf2f8',
  green: '#2e7a52',
  greenLight: '#c0dbcc',
  greenBg: '#eef5f1',
  red: '#b53c3c',
  redLight: '#e4c3c3',
  redBg: '#f9f1f1',
  amber: '#8c6d0c',
  amberLight: '#e2d28e',
  amberBg: '#f7f3e8',
  purple: '#6b47a3',
  purpleLight: '#ddd3ed',
};

const FIELD_OPTIONS = ['department', 'location', 'country', 'employmentType', 'startDate', 'title'];
const OPERATOR_OPTIONS: Record<string, string[]> = {
  department: ['is', 'is_not'],
  location: ['is', 'is_not'],
  country: ['is', 'is_not'],
  employmentType: ['is', 'is_not'],
  startDate: ['after', 'before'],
  title: ['is', 'contains'],
};

function getValueOptions(field: string, people: Person[]): string[] {
  const vals = new Set<string>();
  for (const p of people) {
    const v = p[field as keyof Person];
    if (typeof v === 'string') vals.add(v);
  }
  return Array.from(vals).sort();
}

const selectStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: `1px solid ${C.border}`,
  borderRadius: '3px',
  fontSize: '13px',
  fontFamily: FONT,
  background: C.bg,
  color: C.text,
  outline: 'none',
};

const LAYER_TYPE_COLORS: Record<string, string> = {
  role_state: '#8c6d0c',
  scope: '#6b47a3',
  provisioning_group: '#2c5ea3',
  parent_constraint: '#b53c3c',
  temporal: '#6b6963',
};

const DOMAIN_LABELS: Record<string, string> = {
  payroll: 'Payroll', benefits: 'Benefits', it: 'IT',
  compliance: 'Compliance', communications: 'Comms', learning: 'Learning',
};

// ── Shared styles ──────────────────────────────────────────────────────────

const btnPrimary: React.CSSProperties = {
  padding: '7px 16px',
  background: C.accent, color: '#fff',
  border: 'none', borderRadius: '4px',
  fontFamily: FONT,
  fontSize: '13px', fontWeight: 600, cursor: 'pointer',
  letterSpacing: '0.01em',
};

const btnSecondary: React.CSSProperties = {
  padding: '7px 16px',
  background: C.bg, color: C.text,
  border: `1px solid ${C.border}`, borderRadius: '4px',
  fontFamily: FONT,
  fontSize: '13px', fontWeight: 500, cursor: 'pointer',
};

const contentPad: React.CSSProperties = {
  maxWidth: '820px',
  margin: '0 auto',
  width: '100%',
  padding: '0 32px',
  boxSizing: 'border-box' as const,
};

// ── Condition chip ─────────────────────────────────────────────────────────
// Each connector between chips is independently clickable to toggle AND/OR.

function ConditionChip({
  condition,
  conditionKey,
  people,
  highlightedConditionKey,
  onSetHighlight,
  onRemove,
  onToggleCombinator,
  readOnly,
  isFirst,
  combinator,
}: {
  condition: RuleCondition;
  conditionKey: string;
  people: Person[];
  highlightedConditionKey: string | null;
  onSetHighlight: (key: string | null, condition: RuleCondition | null) => void;
  onRemove?: () => void;
  onToggleCombinator?: () => void;
  readOnly: boolean;
  isFirst: boolean;
  combinator: 'AND' | 'OR';
}) {
  const isHighlighted = highlightedConditionKey === conditionKey;
  const matchCount = people.filter(p => evaluateCondition(p, condition)).length;
  const canToggle = !readOnly && !!onToggleCombinator;

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      {/* Per-connector combinator — clickable to toggle */}
      {!isFirst && (
        <span
          onClick={canToggle ? (e) => { e.stopPropagation(); onToggleCombinator!(); } : undefined}
          role={canToggle ? 'button' : undefined}
          tabIndex={canToggle ? 0 : undefined}
          onKeyDown={canToggle ? (e) => { if (e.key === 'Enter') { e.stopPropagation(); onToggleCombinator!(); } } : undefined}
          title={canToggle ? `Click to switch to ${combinator === 'AND' ? 'or' : 'and'}` : undefined}
          style={{
            fontSize: '12px', fontWeight: 600,
            color: combinator === 'AND' ? C.accent : C.purple,
            userSelect: 'none',
            letterSpacing: '0.02em',
            cursor: canToggle ? 'pointer' : 'default',
            padding: canToggle ? '1px 4px' : undefined,
            borderRadius: '3px',
            transition: 'background 0.1s',
            ...(canToggle ? {
              borderBottom: `1px dashed ${combinator === 'AND' ? C.accentLight : C.purpleLight}`,
            } : {}),
          }}
        >
          {combinator.toLowerCase()}
        </span>
      )}
      {/* The chip */}
      <span
        onClick={() => onSetHighlight(isHighlighted ? null : conditionKey, isHighlighted ? null : condition)}
        role="button"
        tabIndex={0}
        aria-pressed={isHighlighted}
        onKeyDown={e => e.key === 'Enter' && onSetHighlight(isHighlighted ? null : conditionKey, isHighlighted ? null : condition)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '4px 10px',
          background: isHighlighted ? C.accentBg : C.bgSurface,
          border: `1px solid ${isHighlighted ? C.accentLight : C.border}`,
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          lineHeight: 1.4,
          transition: 'background 0.1s, border-color 0.1s',
        }}
      >
        <span style={{ color: C.textSecondary, fontWeight: 500 }}>{fieldLabel(condition.field)}</span>
        <span style={{ color: C.textMuted }}>{operatorLabel(condition.operator)}</span>
        <span style={{ color: C.text, fontWeight: 600 }}>{valueLabel(condition.value)}</span>
        <span style={{
          fontSize: '11px', color: isHighlighted ? C.accent : C.textMuted,
          marginLeft: '2px',
        }}>
          ({matchCount})
        </span>
      </span>
      {!readOnly && onRemove && (
        <button
          onClick={e => { e.stopPropagation(); onRemove(); }}
          aria-label={`Remove: ${fieldLabel(condition.field)} ${operatorLabel(condition.operator)} ${valueLabel(condition.value)}`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '18px', height: '18px',
            background: 'transparent',
            border: 'none',
            borderRadius: '2px',
            cursor: 'pointer',
            color: C.textMuted,
            fontSize: '14px',
            lineHeight: 1,
            padding: 0,
          }}
        >
          ×
        </button>
      )}
    </span>
  );
}

// ── Add condition form ────────────────────────────────────────────────────

function AddConditionForm({
  people,
  onAdd,
  onCancel,
}: {
  people: Person[];
  onAdd: (cond: RuleCondition) => void;
  onCancel: () => void;
}) {
  const [newField, setNewField] = useState(FIELD_OPTIONS[0]);
  const [newOp, setNewOp] = useState('is');
  const [newValue, setNewValue] = useState('');
  const valueOptions = getValueOptions(newField, people);

  const handleAdd = () => {
    if (!newValue) return;
    onAdd({ type: 'condition', field: newField, operator: newOp as RuleCondition['operator'], value: newValue });
  };

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px',
      padding: '10px 12px',
      background: C.bgSurface, border: `1px solid ${C.border}`,
      borderRadius: '4px',
    }}>
      <select
        value={newField}
        onChange={e => {
          setNewField(e.target.value);
          setNewOp(OPERATOR_OPTIONS[e.target.value]?.[0] || 'is');
          setNewValue('');
        }}
        style={selectStyle}
        autoFocus
      >
        {FIELD_OPTIONS.map(f => <option key={f} value={f}>{fieldLabel(f)}</option>)}
      </select>
      <select
        value={newOp}
        onChange={e => setNewOp(e.target.value)}
        style={selectStyle}
      >
        {(OPERATOR_OPTIONS[newField] || ['is']).map(op => (
          <option key={op} value={op}>{operatorLabel(op)}</option>
        ))}
      </select>
      {valueOptions.length > 0 ? (
        <select value={newValue} onChange={e => setNewValue(e.target.value)} style={selectStyle}>
          <option value="">Select...</option>
          {valueOptions.map(v => <option key={v} value={v}>{valueLabel(v)}</option>)}
        </select>
      ) : (
        <input
          type="text"
          value={newValue}
          onChange={e => setNewValue(e.target.value)}
          placeholder="Value..."
          style={{ ...selectStyle, minWidth: '100px' }}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
        />
      )}
      <button
        onClick={handleAdd}
        disabled={!newValue}
        style={{
          ...btnPrimary,
          padding: '5px 12px',
          opacity: newValue ? 1 : 0.4,
          cursor: newValue ? 'pointer' : 'not-allowed',
        }}
      >
        Add
      </button>
      <button
        onClick={onCancel}
        style={{ ...btnSecondary, padding: '5px 12px' }}
      >
        Cancel
      </button>
    </div>
  );
}

// ── Rule group editor ──────────────────────────────────────────────────────
// At depth 0 for non-legacy rules: renders flat with per-connector toggles.
// For legacy/complex rules: falls back to recursive rendering.

function RuleGroupEditor({
  group,
  people,
  onChange,
  readOnly,
  isLegacy,
  depth,
  path,
  highlightedConditionKey,
  onSetHighlight,
}: {
  group: RuleGroup;
  people: Person[];
  onChange: (g: RuleGroup) => void;
  readOnly: boolean;
  isLegacy?: boolean;
  depth: number;
  path: string;
  highlightedConditionKey: string | null;
  onSetHighlight: (key: string | null, condition: RuleCondition | null) => void;
}) {
  const [addingCondition, setAddingCondition] = useState(false);

  // Try flat rendering at depth 0 for non-legacy rules
  const flat = useMemo(
    () => (depth === 0 && !isLegacy) ? flattenToSequence(group) : null,
    [group, depth, isLegacy],
  );

  // ── Flat mode handlers ──

  const handleToggleConnector = useCallback((connectorIdx: number) => {
    if (!flat || readOnly) return;
    const newConnectors = [...flat.connectors];
    newConnectors[connectorIdx] = newConnectors[connectorIdx] === 'AND' ? 'OR' : 'AND';
    onChange(buildFromSequence(flat.conditions, newConnectors));
  }, [flat, readOnly, onChange]);

  const handleAddConditionFlat = useCallback((cond: RuleCondition) => {
    if (!flat) return;
    const newConditions = [...flat.conditions, cond];
    // New connector inherits the last connector, or defaults to AND
    const lastConn = flat.connectors.length > 0 ? flat.connectors[flat.connectors.length - 1] : 'AND' as const;
    const newConnectors: ('AND' | 'OR')[] = [...flat.connectors, lastConn];
    onChange(buildFromSequence(newConditions, newConnectors));
    setAddingCondition(false);
  }, [flat, onChange]);

  const handleRemoveConditionFlat = useCallback((condIdx: number) => {
    if (!flat) return;
    const newConditions = flat.conditions.filter((_, i) => i !== condIdx);
    const newConnectors = [...flat.connectors];
    // Remove the connector adjacent to the removed condition:
    // If removing first, drop connector[0]. Otherwise, drop connector[condIdx - 1].
    if (newConditions.length === 0) {
      onChange({ type: 'group', combinator: 'AND', children: [] });
      return;
    }
    if (condIdx === 0 && newConnectors.length > 0) {
      newConnectors.splice(0, 1);
    } else if (condIdx > 0) {
      newConnectors.splice(condIdx - 1, 1);
    }
    onChange(buildFromSequence(newConditions, newConnectors));
  }, [flat, onChange]);

  // ── Recursive mode handlers (for legacy / sub-groups) ──

  const handleAddConditionRecursive = useCallback((cond: RuleCondition) => {
    const updated = cloneRule(group);
    updated.children.push(cond);
    onChange(updated);
    setAddingCondition(false);
  }, [group, onChange]);

  const handleRemoveChild = useCallback((idx: number) => {
    const updated = cloneRule(group);
    updated.children.splice(idx, 1);
    onChange(updated);
  }, [group, onChange]);

  const handleUpdateChild = useCallback((idx: number, child: RuleNode) => {
    const updated = cloneRule(group);
    updated.children[idx] = child;
    onChange(updated);
  }, [group, onChange]);

  const handleToggleCombinatorRecursive = useCallback(() => {
    if (readOnly || group.children.length < 2) return;
    const updated = cloneRule(group);
    updated.combinator = updated.combinator === 'AND' ? 'OR' : 'AND';
    onChange(updated);
  }, [group, readOnly, onChange]);

  // ── FLAT RENDERING ──
  if (flat) {
    return (
      <div>
        <div style={{
          display: 'flex', flexWrap: 'wrap', alignItems: 'center',
          gap: '6px', lineHeight: 2.4,
        }}>
          {flat.conditions.map((cond, idx) => (
            <ConditionChip
              key={`${path}-flat-${idx}`}
              condition={cond}
              conditionKey={`${path}-flat-${idx}`}
              people={people}
              highlightedConditionKey={highlightedConditionKey}
              onSetHighlight={onSetHighlight}
              onRemove={!readOnly ? () => handleRemoveConditionFlat(idx) : undefined}
              onToggleCombinator={idx > 0 ? () => handleToggleConnector(idx - 1) : undefined}
              readOnly={readOnly}
              isFirst={idx === 0}
              combinator={idx > 0 ? flat.connectors[idx - 1] : 'AND'}
            />
          ))}
        </div>

        {!readOnly && (
          <div style={{ marginTop: '10px' }}>
            {!addingCondition ? (
              <button
                onClick={() => setAddingCondition(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '5px 10px',
                  background: 'transparent',
                  border: `1px dashed ${C.border}`,
                  borderRadius: '4px', cursor: 'pointer',
                  fontSize: '13px', color: C.textSecondary,
                  fontFamily: FONT,
                }}
              >
                + Add condition
              </button>
            ) : (
              <AddConditionForm
                people={people}
                onAdd={handleAddConditionFlat}
                onCancel={() => setAddingCondition(false)}
              />
            )}
          </div>
        )}
      </div>
    );
  }

  // ── RECURSIVE RENDERING (legacy / complex / sub-groups) ──
  return (
    <div style={{
      padding: depth > 0 ? '10px 12px' : '0',
      background: depth > 0 ? C.bgSurface : 'transparent',
      borderRadius: depth > 0 ? '4px' : 0,
      border: depth > 0 ? `1px solid ${C.borderLight}` : 'none',
    }}>
      <div style={{
        display: 'flex', flexWrap: 'wrap', alignItems: 'center',
        gap: '6px', lineHeight: 2.4,
      }}>
        {group.children.map((child, idx) => {
          const key = `${path}-${idx}`;
          if (child.type === 'condition') {
            return (
              <ConditionChip
                key={key}
                condition={child}
                conditionKey={key}
                people={people}
                highlightedConditionKey={highlightedConditionKey}
                onSetHighlight={onSetHighlight}
                onRemove={!readOnly ? () => handleRemoveChild(idx) : undefined}
                readOnly={readOnly}
                isFirst={idx === 0}
                combinator={group.combinator}
              />
            );
          }
          return (
            <div key={key} style={{ width: '100%', marginTop: '4px' }}>
              {idx > 0 && (
                <div style={{
                  fontSize: '12px', fontWeight: 600,
                  color: group.combinator === 'AND' ? C.accent : C.purple,
                  marginBottom: '4px',
                }}>
                  {group.combinator.toLowerCase()}
                </div>
              )}
              <RuleGroupEditor
                group={child}
                people={people}
                onChange={g => handleUpdateChild(idx, g)}
                readOnly={readOnly}
                depth={depth + 1}
                path={key}
                highlightedConditionKey={highlightedConditionKey}
                onSetHighlight={onSetHighlight}
              />
            </div>
          );
        })}

        {/* Group-level toggle — only in recursive mode */}
        {!readOnly && group.children.length >= 2 && (
          <button
            onClick={handleToggleCombinatorRecursive}
            title={`Switch all to ${group.combinator === 'AND' ? 'OR' : 'AND'}`}
            style={{
              fontSize: '11px', fontWeight: 500, cursor: 'pointer',
              padding: '2px 6px',
              background: 'transparent',
              border: `1px dashed ${C.border}`,
              color: C.textMuted,
              borderRadius: '3px',
              fontFamily: FONT,
            }}
          >
            switch all to {group.combinator === 'AND' ? 'or' : 'and'}
          </button>
        )}
      </div>

      {!readOnly && (
        <div style={{ marginTop: '10px' }}>
          {!addingCondition ? (
            <button
              onClick={() => setAddingCondition(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '4px',
                padding: '5px 10px',
                background: 'transparent',
                border: `1px dashed ${C.border}`,
                borderRadius: '4px', cursor: 'pointer',
                fontSize: '13px', color: C.textSecondary,
                fontFamily: FONT,
              }}
            >
              + Add condition
            </button>
          ) : (
            <AddConditionForm
              people={people}
              onAdd={handleAddConditionRecursive}
              onCancel={() => setAddingCondition(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Member row ─────────────────────────────────────────────────────────────

type MemberStatus = 'included' | 'added' | 'removed' | 'excluded';

function memberRowStyle(status: MemberStatus, isConditionHighlighted: boolean): {
  bg: string; stripe: string; nameColor: string; nameDecoration: string;
} {
  if (isConditionHighlighted) {
    return { bg: C.accentBg, stripe: C.accent, nameColor: C.text, nameDecoration: 'none' };
  }
  switch (status) {
    case 'added':    return { bg: C.greenBg, stripe: C.green, nameColor: C.text, nameDecoration: 'none' };
    case 'removed':  return { bg: C.redBg, stripe: C.red, nameColor: C.textMuted, nameDecoration: 'line-through' };
    case 'excluded': return { bg: C.bgSurface, stripe: C.amber, nameColor: C.textMuted, nameDecoration: 'none' };
    default:         return { bg: 'transparent', stripe: 'transparent', nameColor: C.text, nameDecoration: 'none' };
  }
}

function MemberRow({
  person,
  status,
  matchedConditions,
  excludedByLayers,
  isExpanded,
  onToggle,
  isConditionHighlighted,
}: {
  person: Person;
  status: MemberStatus;
  matchedConditions: RuleCondition[];
  excludedByLayers: EvaluationLayer[];
  isExpanded: boolean;
  onToggle: () => void;
  isConditionHighlighted: boolean;
}) {
  const colors = memberRowStyle(status, isConditionHighlighted);
  const initials = person.name.split(' ').map(n => n[0]).join('');

  return (
    <div style={{ borderBottom: `1px solid ${C.borderLight}` }}>
      <div
        onClick={onToggle}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={e => e.key === 'Enter' && onToggle()}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '8px 12px',
          background: colors.bg,
          borderLeft: `3px solid ${colors.stripe}`,
          cursor: 'pointer',
          transition: 'background 0.1s',
        }}
      >
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: C.bgSurface,
          border: `1px solid ${C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '10px', fontWeight: 600,
          color: C.textMuted,
          flexShrink: 0,
          letterSpacing: '0.02em',
        }}>
          {initials}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 500, fontSize: '13px',
            color: colors.nameColor,
            textDecoration: colors.nameDecoration,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {person.name}
          </div>
          <div style={{ fontSize: '12px', color: C.textMuted, marginTop: '1px' }}>
            {person.title} · {person.department}
          </div>
        </div>

        {status === 'added' && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: C.green, flexShrink: 0 }}>
            + added
          </span>
        )}
        {status === 'removed' && (
          <span style={{ fontSize: '11px', fontWeight: 600, color: C.red, flexShrink: 0 }}>
            − removed
          </span>
        )}
        {status === 'excluded' && (
          <span style={{ fontSize: '11px', fontWeight: 500, color: C.amber, flexShrink: 0 }}>
            filtered
          </span>
        )}

        <span style={{ color: C.textMuted, fontSize: '9px', flexShrink: 0, opacity: 0.6 }}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>

      {isExpanded && (
        <div style={{
          padding: '12px 16px 12px 53px',
          background: C.bgSurface,
          borderTop: `1px solid ${C.borderLight}`,
          borderLeft: `3px solid ${colors.stripe}`,
          fontSize: '13px',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '4px 24px', marginBottom: '10px',
            color: C.textSecondary, fontSize: '12px',
          }}>
            <div><span style={{ color: C.textMuted }}>Dept:</span> {person.department}</div>
            <div><span style={{ color: C.textMuted }}>Location:</span> {person.location}, {person.country}</div>
            <div><span style={{ color: C.textMuted }}>Type:</span> {valueLabel(person.employmentType)}</div>
            <div><span style={{ color: C.textMuted }}>Role state:</span>{' '}
              <span style={{
                fontWeight: 600,
                color: person.roleState === 'active' ? C.green : person.roleState === 'terminated' ? C.red : C.amber,
              }}>{valueLabel(person.roleState)}</span>
            </div>
          </div>

          {matchedConditions.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontWeight: 600, color: C.green, marginBottom: '4px', fontSize: '11px', letterSpacing: '0.02em' }}>
                Why in this group
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {matchedConditions.map((mc, i) => (
                  <span key={i} style={{
                    display: 'inline-flex', alignItems: 'center', gap: '4px',
                    padding: '2px 8px',
                    background: C.greenBg, border: `1px solid ${C.greenLight}`,
                    borderRadius: '3px', fontSize: '12px', color: C.textSecondary,
                  }}>
                    <span style={{ color: C.green, fontWeight: 600 }}>✓</span>
                    {fieldLabel(mc.field)} {operatorLabel(mc.operator)} {valueLabel(mc.value)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {excludedByLayers.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, color: C.amber, marginBottom: '4px', fontSize: '11px', letterSpacing: '0.02em' }}>
                Why not in final membership
              </div>
              {excludedByLayers.map(l => (
                <div key={l.id} style={{
                  padding: '4px 8px', marginBottom: '2px',
                  background: C.amberBg, border: `1px solid ${C.amberLight}`,
                  borderRadius: '3px', fontSize: '12px', color: C.textSecondary,
                }}>
                  <span style={{ fontWeight: 600, color: C.amber }}>{l.label}</span> — {l.description}
                </div>
              ))}
            </div>
          )}

          {matchedConditions.length === 0 && excludedByLayers.length === 0 && (
            <div style={{ color: C.textMuted, fontStyle: 'italic', fontSize: '12px' }}>
              No rule conditions matched.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Confirmation gate ──────────────────────────────────────────────────────

function ConfirmationGate({
  consumers,
  diffAdded,
  diffRemoved,
  onConfirm,
  onCancel,
}: {
  consumers: PolicyRef[];
  diffAdded: number;
  diffRemoved: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const criticalConsumers = consumers.filter(c => c.sensitivityTier === 1);
  const totalAffected = consumers.reduce((sum, c) => sum + c.affectedCount, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(28,27,24,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      fontFamily: FONT,
    }}>
      <div style={{
        background: C.bg, borderRadius: '6px',
        border: `1px solid ${C.border}`,
        padding: '28px',
        maxWidth: '420px', width: '100%',
        boxShadow: '0 16px 48px rgba(28,27,24,0.16)',
      }}>
        <div style={{ fontWeight: 600, fontSize: '16px', color: C.text, marginBottom: '12px' }}>
          Confirm this change
        </div>

        <p style={{ fontSize: '14px', color: C.textSecondary, lineHeight: 1.6, marginBottom: '16px' }}>
          This change will{' '}
          {diffAdded > 0 && <span style={{ fontWeight: 600, color: C.green }}>add {diffAdded}</span>}
          {diffAdded > 0 && diffRemoved > 0 && ' and '}
          {diffRemoved > 0 && <span style={{ fontWeight: 600, color: C.red }}>remove {diffRemoved}</span>}
          {' '}from this group and propagate to{' '}
          <strong style={{ color: C.text }}>{totalAffected.toLocaleString()} people</strong> across{' '}
          <strong style={{ color: C.text }}>{consumers.length} consumers</strong>.
        </p>

        {criticalConsumers.length > 0 && (
          <div style={{
            padding: '10px 12px', marginBottom: '16px',
            background: C.redBg, border: `1px solid ${C.redLight}`,
            borderRadius: '4px',
          }}>
            <div style={{ fontWeight: 600, color: C.red, fontSize: '12px', marginBottom: '4px' }}>
              Critical-tier consumers affected
            </div>
            {criticalConsumers.map(c => (
              <div key={c.id} style={{ fontSize: '13px', color: C.textSecondary, lineHeight: 1.5 }}>
                {c.name} — {c.affectedCount.toLocaleString()} affected
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={btnSecondary}>Go back</button>
          <button onClick={onConfirm} style={{ ...btnPrimary, background: C.red }}>Commit change</button>
        </div>
      </div>
    </div>
  );
}

// ── Inline select view ─────────────────────────────────────────────────────

function InlineSelectView({ entryState }: { entryState: EntryState }) {
  const { data, scenario } = entryState;
  const policyContext = scenario.type === 'inline-select' ? scenario.policyContext : undefined;
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = data.savedGroups.filter(sg => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      sg.name.toLowerCase().includes(term) ||
      sg.purpose.toLowerCase().includes(term) ||
      flattenConditions(sg.rule).some(c => valueLabel(c.value).toLowerCase().includes(term))
    );
  });

  const selectedGroup = selectedGroupId ? data.savedGroups.find(sg => sg.id === selectedGroupId) : null;

  return (
    <div style={{ padding: '16px', maxWidth: '440px', margin: '0 auto' }}>
      {policyContext && (
        <div style={{
          padding: '8px 12px', marginBottom: '12px',
          background: C.accentBg, border: `1px solid ${C.accentLight}`,
          borderRadius: '4px', fontSize: '13px', color: C.accent,
        }}>
          Selecting group for: <strong>{policyContext.name}</strong>
        </div>
      )}
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Search by name, purpose, or conditions..."
        autoFocus
        style={{
          width: '100%', padding: '10px 12px',
          border: `1px solid ${C.border}`, borderRadius: '4px',
          fontSize: '14px', marginBottom: '10px',
          outline: 'none', boxSizing: 'border-box',
          fontFamily: FONT, color: C.text,
        }}
      />
      <div style={{ fontSize: '12px', color: C.textMuted, marginBottom: '8px' }}>
        {filtered.length} saved {filtered.length === 1 ? 'group' : 'groups'}
      </div>
      {filtered.map(sg => (
        <div
          key={sg.id}
          onClick={() => setSelectedGroupId(sg.id)}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && setSelectedGroupId(sg.id)}
          style={{
            padding: '10px 12px',
            background: selectedGroupId === sg.id ? C.accentBg : C.bg,
            border: `1px solid ${selectedGroupId === sg.id ? C.accentLight : C.border}`,
            borderRadius: '4px', marginBottom: '4px',
            cursor: 'pointer',
            transition: 'background 0.1s, border-color 0.1s',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px', color: C.text }}>
                {sg.name || <span style={{ color: C.amber, fontStyle: 'italic' }}>Unnamed</span>}
              </div>
              <div style={{ fontSize: '12px', color: C.textSecondary, marginTop: '2px' }}>
                {sg.memberIds.length} members · {sg.purpose || 'No description'}
              </div>
            </div>
            {sg.isLegacy && (
              <span style={{
                fontSize: '11px', padding: '1px 6px',
                background: C.amberBg, color: C.amber, borderRadius: '2px',
                fontWeight: 600, flexShrink: 0,
              }}>Legacy</span>
            )}
          </div>
          {selectedGroupId === sg.id && (
            <div style={{
              marginTop: '8px', paddingTop: '8px',
              borderTop: `1px solid ${C.borderLight}`,
              fontSize: '12px', color: C.textMuted,
            }}>
              <div style={{ marginBottom: '2px', lineHeight: 1.5 }}>
                {flattenConditions(sg.rule).map((c, i) => (
                  <span key={i}>
                    {i > 0 && <span style={{ fontWeight: 600, color: C.accent }}> {sg.rule.combinator.toLowerCase()} </span>}
                    {fieldLabel(c.field)} {operatorLabel(c.operator)} <strong style={{ color: C.text }}>{valueLabel(c.value)}</strong>
                  </span>
                ))}
              </div>
              <div style={{ marginTop: '4px' }}>
                {sg.evaluationLayers.length} evaluation {sg.evaluationLayers.length === 1 ? 'layer' : 'layers'} ·{' '}
                {sg.consumers.length} {sg.consumers.length === 1 ? 'consumer' : 'consumers'}
              </div>
            </div>
          )}
        </div>
      ))}
      {selectedGroup && (
        <button style={{
          width: '100%', padding: '10px',
          background: C.accent, color: '#fff',
          border: 'none', borderRadius: '4px',
          fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          marginTop: '8px', fontFamily: FONT,
        }}>
          Select "{selectedGroup.name || 'Unnamed group'}"
        </button>
      )}
    </div>
  );
}

// ── Workspace ─────────────────────────────────────────────────────────────

function Workspace({ entryState }: { entryState: EntryState }) {
  const { scenario, data } = entryState;
  const isCreate = scenario.type === 'create';

  const groupId = 'groupId' in scenario ? scenario.groupId : undefined;
  const existingGroup = groupId ? data.savedGroups.find(g => g.id === groupId) : undefined;

  const [isEditing, setIsEditing] = useState(true);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [committed, setCommitted] = useState(false);

  const defaultRule: RuleGroup = existingGroup
    ? cloneRule(existingGroup.rule)
    : { type: 'group', combinator: 'AND', children: [] };

  const [editingRule, setEditingRule] = useState<RuleGroup>(defaultRule);
  const [committedRule] = useState<RuleGroup | null>(existingGroup ? existingGroup.rule : null);

  const layers = existingGroup?.evaluationLayers || [];
  const consumers = existingGroup?.consumers || [];

  // Highlight state: store both a key (for UI identity) and the condition (for evaluation).
  // This avoids walking the AST by path, which breaks when the tree restructures.
  const [highlightedConditionKey, setHighlightedConditionKey] = useState<string | null>(null);
  const [highlightedCondition, setHighlightedCondition] = useState<RuleCondition | null>(null);
  const [expandedMembers, setExpandedMembers] = useState<Set<string>>(new Set());
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [showMembers, setShowMembers] = useState(false);

  const handleSetHighlight = useCallback((key: string | null, condition: RuleCondition | null) => {
    setHighlightedConditionKey(key);
    setHighlightedCondition(condition);
  }, []);

  const toggleMember = useCallback((id: string) => {
    setExpandedMembers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleLayer = useCallback((id: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const currentResult = useMemo(
    () => computeMembers(data.people, editingRule, layers),
    [data.people, editingRule, layers],
  );

  const baselineResult = useMemo(
    () => committedRule ? computeMembers(data.people, committedRule, layers) : null,
    [data.people, committedRule, layers],
  );

  const diff = useMemo(() => {
    if (!baselineResult) return { added: new Set<string>(), removed: new Set<string>() };
    const baseIds = new Set(baselineResult.final.map(p => p.id));
    const currentIds = new Set(currentResult.final.map(p => p.id));
    const added = new Set<string>();
    const removed = new Set<string>();
    for (const id of currentIds) if (!baseIds.has(id)) added.add(id);
    for (const id of baseIds) if (!currentIds.has(id)) removed.add(id);
    return { added, removed };
  }, [baselineResult, currentResult]);

  // Resolve highlighted condition matches — uses stored condition directly
  const highlightedConditionMatchIds = useMemo((): Set<string> => {
    if (!highlightedCondition) return new Set();
    return new Set(data.people.filter(p => evaluateCondition(p, highlightedCondition)).map(p => p.id));
  }, [highlightedCondition, data.people]);

  type MemberEntry = {
    person: Person;
    status: MemberStatus;
    matchedConditions: RuleCondition[];
    excludedByLayers: EvaluationLayer[];
  };

  const memberList: MemberEntry[] = useMemo(() => {
    const entries: MemberEntry[] = [];
    const seen = new Set<string>();

    for (const p of currentResult.final) {
      seen.add(p.id);
      const matched = flattenConditions(editingRule).filter(c => evaluateCondition(p, c));
      entries.push({
        person: p,
        status: diff.added.has(p.id) ? 'added' : 'included',
        matchedConditions: matched,
        excludedByLayers: [],
      });
    }

    for (const p of currentResult.matched) {
      if (seen.has(p.id)) continue;
      if (currentResult.excluded.has(p.id)) {
        seen.add(p.id);
        entries.push({
          person: p,
          status: 'excluded',
          matchedConditions: flattenConditions(editingRule).filter(c => evaluateCondition(p, c)),
          excludedByLayers: currentResult.excluded.get(p.id) || [],
        });
      }
    }

    if (baselineResult) {
      for (const p of baselineResult.final) {
        if (!seen.has(p.id) && diff.removed.has(p.id)) {
          seen.add(p.id);
          entries.push({ person: p, status: 'removed', matchedConditions: [], excludedByLayers: [] });
        }
      }
    }

    return entries;
  }, [currentResult, baselineResult, editingRule, diff]);

  const displayMembers = useMemo(() => {
    if (highlightedConditionKey) {
      return [...memberList].sort((a, b) => {
        const aMatch = highlightedConditionMatchIds.has(a.person.id) ? 0 : 1;
        const bMatch = highlightedConditionMatchIds.has(b.person.id) ? 0 : 1;
        return aMatch - bMatch;
      });
    }
    return memberList;
  }, [memberList, highlightedConditionKey, highlightedConditionMatchIds]);

  const similarGroups = useMemo(
    () => findSimilarGroups(editingRule, data.savedGroups, groupId),
    [editingRule, data.savedGroups, groupId],
  );

  const handleAttemptCommit = () => {
    const hasCritical = consumers.some(c => c.sensitivityTier === 1);
    const hasChanges = diff.added.size > 0 || diff.removed.size > 0;
    if (hasCritical && hasChanges) {
      setShowConfirmation(true);
    } else {
      setCommitted(true);
      setIsEditing(false);
    }
  };

  const handleConfirmCommit = () => {
    setShowConfirmation(false);
    setCommitted(true);
    setIsEditing(false);
  };

  const handleCancelCommit = () => setShowConfirmation(false);

  const handleDiscard = () => {
    if (existingGroup) setEditingRule(cloneRule(existingGroup.rule));
    setIsEditing(false);
    handleSetHighlight(null, null);
  };

  const handleEditAgain = () => {
    setIsEditing(true);
    setCommitted(false);
  };

  const hasChanges = diff.added.size > 0 || diff.removed.size > 0;
  const criticalConsumers = consumers.filter(c => c.sensitivityTier === 1);
  const hasCritical = criticalConsumers.length > 0;
  const totalAffected = consumers.reduce((sum, c) => sum + c.affectedCount, 0);

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0,
      position: 'relative',
    }}>
      {showConfirmation && (
        <ConfirmationGate
          consumers={consumers}
          diffAdded={diff.added.size}
          diffRemoved={diff.removed.size}
          onConfirm={handleConfirmCommit}
          onCancel={handleCancelCommit}
        />
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>

        {/* ── 1. HEADER ── */}
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            ...contentPad,
            paddingTop: '24px', paddingBottom: '20px',
            display: 'flex', alignItems: 'flex-start', gap: '16px',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h1 style={{
                fontSize: '20px', fontWeight: 600, color: C.text,
                lineHeight: 1.2, margin: 0,
                letterSpacing: '-0.01em',
              }}>
                {existingGroup
                  ? (existingGroup.name || <span style={{ color: C.amber, fontStyle: 'italic' }}>Unnamed legacy group</span>)
                  : 'New group'
                }
              </h1>
              {existingGroup?.purpose && (
                <div style={{ fontSize: '14px', color: C.textSecondary, marginTop: '4px', lineHeight: 1.4 }}>
                  {existingGroup.purpose}
                </div>
              )}
              <div style={{
                display: 'flex', gap: '16px', fontSize: '12px',
                color: C.textMuted, marginTop: '8px', flexWrap: 'wrap',
              }}>
                {existingGroup?.owner && <span>{existingGroup.owner}</span>}
                {existingGroup && <span>Evaluated {new Date(existingGroup.lastEvaluatedAt).toLocaleDateString()}</span>}
                {existingGroup && <span style={{ textTransform: 'capitalize' }}>{existingGroup.lifecycleIntent}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0, paddingTop: '2px' }}>
              {committed && !isEditing && (
                <span style={{
                  fontSize: '12px', color: C.green, fontWeight: 500,
                  padding: '4px 10px',
                  background: C.greenBg, border: `1px solid ${C.greenLight}`,
                  borderRadius: '3px',
                }}>
                  Saved
                </span>
              )}
              {!isEditing && <button onClick={handleEditAgain} style={btnSecondary}>Edit</button>}
              {isEditing && (
                <>
                  {existingGroup && <button onClick={handleDiscard} style={btnSecondary}>Discard</button>}
                  <button onClick={handleAttemptCommit} style={btnPrimary}>Commit</button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── LEGACY WARNING ── */}
        {existingGroup?.isLegacy && (
          <div style={{ borderBottom: `1px solid ${C.amberLight}`, background: C.amberBg }}>
            <div style={{
              ...contentPad,
              paddingTop: '8px', paddingBottom: '8px',
              fontSize: '13px', color: C.textSecondary,
            }}>
              <span style={{ fontWeight: 600, color: C.amber }}>Legacy group</span>
              {' — no owner, type, or purpose on record. Rule shown as-is.'}
            </div>
          </div>
        )}

        {/* ── 2. RULE ── */}
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            ...contentPad,
            paddingTop: '20px', paddingBottom: '20px',
          }}>
            <div style={{
              fontSize: '11px', fontWeight: 500, color: C.textMuted,
              textTransform: 'uppercase', letterSpacing: '0.06em',
              marginBottom: '12px',
            }}>
              Rule
            </div>

            {editingRule.children.length === 0 && !isCreate ? (
              <div style={{ color: C.textMuted, fontSize: '14px', fontStyle: 'italic' }}>
                No conditions defined.
              </div>
            ) : (
              <RuleGroupEditor
                group={editingRule}
                people={data.people}
                onChange={rule => { setEditingRule(rule); handleSetHighlight(null, null); }}
                readOnly={!isEditing}
                isLegacy={existingGroup?.isLegacy}
                depth={0}
                path="root"
                highlightedConditionKey={highlightedConditionKey}
                onSetHighlight={handleSetHighlight}
              />
            )}

            {editingRule.children.length > 0 && !highlightedConditionKey && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: C.textMuted }}>
                Click a condition to highlight matching members
              </div>
            )}

            {/* Reuse suggestions */}
            {similarGroups.length > 0 && (
              <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid ${C.borderLight}` }}>
                <div style={{ fontSize: '12px', fontWeight: 500, color: C.textSecondary, marginBottom: '6px' }}>
                  {similarGroups.length} existing {similarGroups.length === 1 ? 'group matches' : 'groups match'} these conditions
                </div>
                {similarGroups.map(sg => (
                  <div key={sg.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 10px',
                    background: C.bgSurface, border: `1px solid ${C.border}`,
                    borderRadius: '4px', marginBottom: '4px',
                  }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: C.text }}>{sg.name || 'Unnamed group'}</div>
                      <div style={{ color: C.textMuted, fontSize: '12px' }}>
                        {sg.memberIds.length} members · {sg.purpose || 'No description'}
                      </div>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => setEditingRule(cloneRule(sg.rule))}
                        style={{ ...btnSecondary, padding: '4px 10px', fontSize: '12px' }}
                      >
                        Use this
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 3. EVALUATION LAYERS ── */}
        {layers.length > 0 && (
          <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bgSurface }}>
            <div style={{ ...contentPad, paddingTop: '10px', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px' }}>
                {layers.map((l, idx) => {
                  const color = LAYER_TYPE_COLORS[l.type] || C.textMuted;
                  const count = l.excludedPeopleIds.length;
                  const isOpen = expandedLayers.has(l.id);
                  return (
                    <React.Fragment key={l.id}>
                      {idx > 0 && (
                        <span style={{ width: '1px', height: '14px', background: C.border, margin: '0 4px', flexShrink: 0 }} />
                      )}
                      <button
                        onClick={() => toggleLayer(l.id)}
                        aria-expanded={isOpen}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '4px 8px',
                          background: isOpen ? C.bg : 'transparent',
                          border: isOpen ? `1px solid ${C.border}` : '1px solid transparent',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontSize: '13px', fontFamily: FONT,
                          color: C.textSecondary,
                        }}
                      >
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ fontWeight: 500 }}>{l.label}</span>
                        <span style={{ fontSize: '11px', color, fontWeight: 600 }}>−{count}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>

              {layers.filter(l => expandedLayers.has(l.id)).map(l => {
                const color = LAYER_TYPE_COLORS[l.type] || C.textMuted;
                const excludedPeople = data.people.filter(p => l.excludedPeopleIds.includes(p.id));
                return (
                  <div key={`detail-${l.id}`} style={{
                    marginTop: '8px', padding: '10px 12px',
                    background: C.bg,
                    borderLeft: `2px solid ${color}`,
                    borderRadius: '0 4px 4px 0', fontSize: '13px',
                  }}>
                    <p style={{ color: C.textSecondary, margin: '0 0 6px', lineHeight: 1.5 }}>{l.description}</p>
                    {excludedPeople.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {excludedPeople.map(p => (
                          <span key={p.id} style={{
                            padding: '2px 6px',
                            background: C.bgSurface, border: `1px solid ${C.border}`,
                            borderRadius: '2px', fontSize: '12px', color: C.textSecondary,
                          }}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 4. MEMBERS ── */}
        <div style={{ borderBottom: `1px solid ${C.border}` }}>
          <div style={{
            ...contentPad,
            paddingTop: '16px', paddingBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{
                fontSize: hasChanges ? '20px' : '16px',
                fontWeight: 600, color: C.text,
                letterSpacing: '-0.01em',
                transition: 'font-size 0.15s',
              }}>
                {currentResult.final.length}
              </span>
              <span style={{ fontSize: '14px', color: C.textSecondary }}>
                {currentResult.final.length === 1 ? 'member' : 'members'}
              </span>

              {hasChanges && (
                <>
                  {diff.added.size > 0 && (
                    <span style={{ fontSize: '14px', fontWeight: 600, color: C.green }}>+{diff.added.size}</span>
                  )}
                  {diff.removed.size > 0 && (
                    <span style={{ fontSize: '14px', fontWeight: 600, color: C.red }}>−{diff.removed.size}</span>
                  )}
                </>
              )}

              {currentResult.matched.length > currentResult.final.length && (
                <span style={{ fontSize: '12px', color: C.amber }}>
                  {currentResult.matched.length - currentResult.final.length} filtered
                </span>
              )}

              <button
                onClick={() => setShowMembers(!showMembers)}
                style={{
                  marginLeft: 'auto',
                  padding: '4px 12px',
                  background: showMembers ? C.text : 'transparent',
                  color: showMembers ? C.bg : C.textSecondary,
                  border: `1px solid ${showMembers ? C.text : C.border}`,
                  borderRadius: '3px',
                  fontSize: '12px', fontWeight: 500, cursor: 'pointer',
                  fontFamily: FONT,
                }}
              >
                {showMembers ? 'Hide' : 'Show'}
              </button>
            </div>

            {showMembers && (
              <div style={{
                marginTop: '12px',
                border: `1px solid ${C.border}`,
                borderRadius: '4px',
                overflow: 'hidden',
                maxHeight: '400px',
                overflowY: 'auto',
              }}>
                {highlightedConditionKey && (
                  <div style={{
                    padding: '6px 12px',
                    background: C.accentBg,
                    borderBottom: `1px solid ${C.accentLight}`,
                    fontSize: '11px', color: C.accent, fontWeight: 500,
                    letterSpacing: '0.02em',
                  }}>
                    Matches sorted first
                  </div>
                )}

                {editingRule.children.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>
                    Add conditions to see matches
                  </div>
                ) : displayMembers.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: C.textMuted, fontSize: '13px' }}>
                    No matches
                  </div>
                ) : (
                  displayMembers.map(m => (
                    <MemberRow
                      key={m.person.id}
                      person={m.person}
                      status={m.status}
                      matchedConditions={m.matchedConditions}
                      excludedByLayers={m.excludedByLayers}
                      isExpanded={expandedMembers.has(m.person.id)}
                      onToggle={() => toggleMember(m.person.id)}
                      isConditionHighlighted={highlightedConditionMatchIds.has(m.person.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 5. STICKY FOOTER ── */}
      <div style={{
        padding: '12px 0',
        background: C.bg,
        borderTop: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        <div style={{
          ...contentPad,
          display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
        }}>
          {consumers.length > 0 && (
            <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: C.textMuted, lineHeight: 1.5 }}>
              {hasCritical && hasChanges ? (
                <span style={{ color: C.red, fontWeight: 600 }}>
                  Critical: {criticalConsumers.map(c => c.name).join(', ')}
                  <span style={{ color: C.textMuted, fontWeight: 400 }}>
                    {' · '}{totalAffected.toLocaleString()} people · Confirmation required
                  </span>
                </span>
              ) : (
                <span>
                  {consumers.length} {consumers.length === 1 ? 'policy' : 'policies'}
                  {' · '}{totalAffected.toLocaleString()} people
                  {consumers.some(c => c.sensitivityTier === 1) && (
                    <span style={{ color: C.red }}>{' · '}includes critical</span>
                  )}
                </span>
              )}
            </div>
          )}

          {isEditing && (
            <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
              {existingGroup && <button onClick={handleDiscard} style={btnSecondary}>Discard</button>}
              <button onClick={handleAttemptCommit} style={btnPrimary}>Commit</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Root ───────────────────────────────────────────────────────────────────

export default function ConceptA({ entryState }: ConceptProps) {
  const isInlineSelect = entryState.scenario.type === 'inline-select';

  return (
    <div style={{
      height: entryState.context === 'inline' ? '480px' : 'calc(100vh - 80px)',
      display: 'flex', flexDirection: 'column',
      background: C.bg,
      color: C.text,
      fontFamily: FONT,
      fontSize: '14px',
      lineHeight: 1.5,
      WebkitFontSmoothing: 'antialiased',
      MozOsxFontSmoothing: 'grayscale',
    } as React.CSSProperties}>
      {isInlineSelect
        ? <InlineSelectView entryState={entryState} />
        : <Workspace entryState={entryState} />
      }
    </div>
  );
}

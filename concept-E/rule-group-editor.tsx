import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import type { RuleGroup, RuleCondition, RuleNode, Person } from '../shell/types';

// ── Design tokens (shared with concept-E/index.tsx) ────────────────────────

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
  purple: '#7C3AED',
  purpleLight: '#f5f3ff',
  purpleBorder: '#ddd6fe',
};

const FONT = 'Inter, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif';

const S = {
  card: 'rgba(0,0,0,0.04) 0px 4px 18px, rgba(0,0,0,0.027) 0px 2.025px 7.85px, rgba(0,0,0,0.02) 0px 0.8px 2.93px, rgba(0,0,0,0.01) 0px 0.175px 1.04px',
};

// ── Easing curves ──────────────────────────────────────────────────────────

const EASE = {
  spring: 'cubic-bezier(0.22, 1, 0.36, 1)',
  springBounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  out: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

// ── Field / operator constants ─────────────────────────────────────────────

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

function getValueOptions(field: string, people: Person[]): string[] {
  const set = new Set<string>();
  for (const p of people) {
    set.add(String((p as any)[field]));
  }
  return [...set].sort();
}

// ── ID generation ──────────────────────────────────────────────────────────

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ── NL parser (powers the Spotlight's natural-language mode) ────────────────

interface FilterRow {
  id: string;
  field: string;
  operator: RuleCondition['operator'];
  value: string | string[];
}

const NEGATION_PATTERN = /\b(?:not|no|non|except|excluding|without|aren'?t|isn'?t|exclude)\b/;

function isNegated(lower: string, keyword: string): boolean {
  const idx = lower.indexOf(keyword);
  if (idx < 0) return false;
  const before = lower.slice(Math.max(0, idx - 30), idx);
  if (NEGATION_PATTERN.test(before)) return true;
  if (/\bnon-?\s*$/.test(before)) return true;
  return false;
}

const DEPT_ABBREVIATIONS: Record<string, string> = {
  eng: 'Engineering',
  mktg: 'Marketing',
  mkt: 'Marketing',
};

const LOCATION_ALIASES: [RegExp, string][] = [
  [/\bsf\b|s\.f\./, 'San Francisco'],
  [/\bnyc\b/, 'New York'],
  [/\btexas\b|\btx\b/, 'Austin'],
  [/\bcalifornia\b|\bcalif\b|\bca\b(?!nad)/, 'San Francisco'],
];

const COUNTRY_PATTERNS: [RegExp, string][] = [
  [/\bus\b|united states|\busa\b|\bamerica\b|\bamerican\b/, 'US'],
  [/\buk\b|united kingdom|\bbritain\b|\bbritish\b/, 'GB'],
  [/\bcanada\b|\bcanadian\b/, 'CA'],
  [/\bgermany\b|\bgerman\b/, 'DE'],
  [/\bindia\b|\bindian\b/, 'IN'],
  [/\baustralia\b|\baustralian\b|\baussie\b/, 'AU'],
  [/\bfrance\b|\bfrench\b/, 'FR'],
  [/\bireland\b|\birish\b/, 'IE'],
  [/\bjapan\b|\bjapanese\b/, 'JP'],
  [/\bsingapore\b|\bsingaporean\b/, 'SG'],
  [/\bbrazil\b|\bbrazilian\b/, 'BR'],
];

const EMPLOYMENT_PATTERNS: [RegExp, string][] = [
  [/\bfull[- ]?time\b|\bftes?\b/, 'full_time'],
  [/\bpart[- ]?time\b/, 'part_time'],
  [/\bcontract(?:or|ors|)?\b/, 'contractor'],
];

const TITLE_KEYWORDS: [RegExp, string][] = [
  [/\bmanagers?\b/, 'Manager'],
  [/\bdirectors?\b/, 'Director'],
  [/\banalysts?\b/, 'Analyst'],
  [/\bleads?\b/, 'Lead'],
  [/\bseniors?\b/, 'Senior'],
  [/\bengineers?\b/, 'Engineer'],
];

const MONTH_MAP: Record<string, string> = {
  january: '01', jan: '01', february: '02', feb: '02', march: '03', mar: '03',
  april: '04', apr: '04', may: '05', june: '06', jun: '06',
  july: '07', jul: '07', august: '08', aug: '08', september: '09', sep: '09', sept: '09',
  october: '10', oct: '10', november: '11', nov: '11', december: '12', dec: '12',
};

function parseDatePhrase(lower: string): FilterRow | null {
  const afterMatch = lower.match(/(?:started|joined|hired|start(?:ing)?)\s+after\s+(\w+\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{4})/);
  if (afterMatch) {
    const date = normalizeDate(afterMatch[1]);
    if (date) return { id: uid(), field: 'startDate', operator: 'after', value: date };
  }

  const beforeMatch = lower.match(/(?:started|joined|hired|start(?:ing)?)\s+before\s+(\w+\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{4})/);
  if (beforeMatch) {
    const date = normalizeDate(beforeMatch[1]);
    if (date) return { id: uid(), field: 'startDate', operator: 'before', value: date };
  }

  if (/\bnew\s+hires?\b|\brecent\s+hires?\b|\brecently\s+(?:hired|joined|started)\b/.test(lower)) {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    return { id: uid(), field: 'startDate', operator: 'after', value: iso };
  }

  return null;
}

function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}$/.test(raw)) return `${raw}-01-01`;
  const parts = raw.toLowerCase().split(/\s+/);
  if (parts.length === 2) {
    const month = MONTH_MAP[parts[0]];
    const year = parts[1];
    if (month && /^\d{4}$/.test(year)) return `${year}-${month}-01`;
  }
  return null;
}

function stripFillerWords(text: string): string {
  return text
    .replace(/\b(?:who\s+are|that\s+are|employees?\s+(?:in|at|from)|people\s+(?:in|at|from)|workers?\s+(?:in|at|from)|based\s+in|located\s+in|working\s+(?:in|at|from)|employed\s+(?:in|at))\b/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseNL(text: string, people: Person[]): FilterRow[] {
  const rows: FilterRow[] = [];
  const raw = text.toLowerCase().trim();
  if (!raw) return rows;
  const lower = stripFillerWords(raw);

  const matchedDepts = new Set<string>();

  // --- Departments: full names from data ---
  const depts = [...new Set(people.map(p => p.department))];
  for (const dept of depts) {
    const dLower = dept.toLowerCase();
    if (lower.includes(dLower)) {
      const op = isNegated(lower, dLower) ? 'is_not' : 'is';
      rows.push({ id: uid(), field: 'department', operator: op, value: dept });
      matchedDepts.add(dLower);
    }
  }

  // --- Departments: abbreviations ---
  for (const [abbr, dept] of Object.entries(DEPT_ABBREVIATIONS)) {
    if (matchedDepts.has(dept.toLowerCase())) continue;
    const re = new RegExp(`\\b${abbr}\\b`);
    if (re.test(lower)) {
      const op = isNegated(lower, abbr) ? 'is_not' : 'is';
      rows.push({ id: uid(), field: 'department', operator: op, value: dept });
      matchedDepts.add(dept.toLowerCase());
    }
  }

  // --- Locations: full names from data ---
  const matchedLocs = new Set<string>();
  const locs = [...new Set(people.map(p => p.location))];
  for (const loc of locs) {
    if (lower.includes(loc.toLowerCase())) {
      const op = isNegated(lower, loc.toLowerCase()) ? 'is_not' : 'is';
      rows.push({ id: uid(), field: 'location', operator: op, value: loc });
      matchedLocs.add(loc.toLowerCase());
    }
  }

  // --- Locations: aliases (SF, NYC, state names) ---
  for (const [re, city] of LOCATION_ALIASES) {
    if (matchedLocs.has(city.toLowerCase())) continue;
    if (re.test(lower)) {
      rows.push({ id: uid(), field: 'location', operator: 'is', value: city });
      matchedLocs.add(city.toLowerCase());
    }
  }

  // --- Employment type ---
  for (const [re, val] of EMPLOYMENT_PATTERNS) {
    if (re.test(lower)) {
      const match = lower.match(re);
      const op = match ? isNegated(lower, match[0]) ? 'is_not' : 'is' : 'is';
      rows.push({ id: uid(), field: 'employmentType', operator: op, value: val });
    }
  }

  // --- Country ---
  for (const [re, code] of COUNTRY_PATTERNS) {
    if (re.test(lower)) {
      const match = lower.match(re);
      const op = match ? isNegated(lower, match[0]) ? 'is_not' : 'is' : 'is';
      rows.push({ id: uid(), field: 'country', operator: op, value: code });
    }
  }

  // --- Role status ---
  const ROLE_PATTERNS: [RegExp, string][] = [
    [/\bactive\b/, 'active'],
    [/\bpending\b/, 'pending'],
    [/\bterminated\b/, 'terminated'],
  ];
  for (const [re, val] of ROLE_PATTERNS) {
    if (re.test(lower)) {
      const match = lower.match(re);
      const op = match ? isNegated(lower, match[0]) ? 'is_not' : 'is' : 'is';
      rows.push({ id: uid(), field: 'roleState', operator: op, value: val });
    }
  }

  // --- Start date ---
  const dateRow = parseDatePhrase(lower);
  if (dateRow) rows.push(dateRow);

  // --- Title keywords (only if department didn't already capture the intent) ---
  for (const [re, keyword] of TITLE_KEYWORDS) {
    if (re.test(lower)) {
      if (keyword === 'Engineer' && matchedDepts.has('engineering')) continue;
      rows.push({ id: uid(), field: 'title', operator: 'contains', value: keyword });
    }
  }

  // --- "Everyone" / "all employees" fallback ---
  if (rows.length === 0 && /\beveryone\b|\ball employees\b|\ball people\b|\ball staff\b|\bwhole company\b/.test(raw)) {
    rows.push({ id: uid(), field: 'roleState', operator: 'is', value: 'active' });
  }

  // --- Deduplicate (same field+operator+value) ---
  const seen = new Set<string>();
  const deduped: FilterRow[] = [];
  for (const r of rows) {
    const key = `${r.field}|${r.operator}|${r.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  return deduped;
}

// ── Suggestion type (passed from parent) ────────────────────────────────────

export interface FilterSuggestion {
  label: string;
  condition: RuleCondition;
}

// ── Shared Select component ────────────────────────────────────────────────

function Select({ value, options, onChange, placeholder, style: extraStyle }: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        padding: '6px 8px',
        border: `1px solid ${C.border}`,
        borderRadius: 4,
        fontSize: 14,
        fontFamily: FONT,
        fontWeight: 500,
        color: value ? C.text : C.textMuted,
        background: C.surface,
        cursor: 'pointer',
        outline: 'none',
        minWidth: 0,
        ...extraStyle,
      }}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

// ── Condition row ──────────────────────────────────────────────────────────

function ConditionRow({ condition, allPeople, onChange, onRemove, isFirst, combinator, onCombinatorChange, readOnly }: {
  condition: RuleCondition;
  allPeople: Person[];
  onChange: (updated: RuleCondition) => void;
  onRemove: () => void;
  isFirst: boolean;
  combinator: 'AND' | 'OR';
  onCombinatorChange: (val: 'AND' | 'OR') => void;
  readOnly?: boolean;
}) {
  const valueOptions = useMemo(() => {
    if (!condition.field) return [];
    return getValueOptions(condition.field, allPeople).map(v => ({
      value: v,
      label: formatValue(condition.field, v),
    }));
  }, [condition.field, allPeople]);

  const operators = OPERATOR_OPTIONS[condition.field] || [{ value: 'is' as const, label: 'is' }];

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '7px 8px',
      borderRadius: 6,
      transition: 'background 0.1s',
    }}
      onMouseEnter={e => { if (!readOnly) (e.currentTarget as HTMLElement).style.background = C.surfaceAlt; }}
      onMouseLeave={e => { if (!readOnly) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div style={{
        width: 52, flexShrink: 0, textAlign: 'right', paddingRight: 4,
        fontSize: 14, color: C.textSecondary, fontWeight: 500,
      }}>
        {isFirst ? 'Where' : (
          readOnly ? (
            <span style={{
              fontSize: 12, fontWeight: 600, color: '#097fe8',
              background: '#f2f9ff', borderRadius: 9999, padding: '2px 8px',
              letterSpacing: 0.125,
            }}>{combinator}</span>
          ) : (
            <button
              onClick={() => onCombinatorChange(combinator === 'AND' ? 'OR' : 'AND')}
              style={{
                background: '#f2f9ff', color: '#097fe8', border: 'none',
                borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', letterSpacing: 0.125, fontFamily: FONT,
              }}
            >
              {combinator}
            </button>
          )
        )}
      </div>

      {readOnly ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, fontSize: 14 }}>
          <span style={{ fontWeight: 500, color: C.text }}>{fieldLabels[condition.field] || condition.field}</span>
          <span style={{ color: C.textMuted }}>{operators.find(o => o.value === condition.operator)?.label || condition.operator}</span>
          <span style={{
            background: C.surfaceAlt, border: `1px solid ${C.border}`,
            borderRadius: 4, padding: '2px 8px', fontWeight: 500, color: C.text,
          }}>
            {Array.isArray(condition.value) ? condition.value.map(v => formatValue(condition.field, v)).join(', ') : formatValue(condition.field, condition.value as string)}
          </span>
        </div>
      ) : (
        <>
          <Select
            value={condition.field}
            options={FIELD_OPTIONS}
            onChange={field => onChange({ ...condition, field, operator: (OPERATOR_OPTIONS[field]?.[0]?.value || 'is'), value: '' })}
            placeholder="Field..."
            style={{ flex: '0 0 130px' }}
          />
          <Select
            value={condition.operator}
            options={operators}
            onChange={op => onChange({ ...condition, operator: op as RuleCondition['operator'] })}
            style={{ flex: '0 0 90px' }}
          />
          {condition.field === 'startDate' ? (
            <input
              type="date"
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={e => onChange({ ...condition, value: e.target.value })}
              style={{
                flex: 1, padding: '6px 8px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface,
                outline: 'none',
              }}
            />
          ) : condition.field === 'title' && condition.operator === 'contains' ? (
            <input
              type="text"
              value={typeof condition.value === 'string' ? condition.value : ''}
              onChange={e => onChange({ ...condition, value: e.target.value })}
              placeholder="Enter text..."
              style={{
                flex: 1, padding: '6px 8px', border: `1px solid ${C.border}`,
                borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface,
                outline: 'none',
              }}
            />
          ) : (
            <Select
              value={Array.isArray(condition.value) ? condition.value[0] || '' : condition.value as string}
              options={valueOptions}
              onChange={v => onChange({ ...condition, value: v })}
              placeholder="Value..."
              style={{ flex: 1 }}
            />
          )}
          <button
            onClick={onRemove}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: C.textMuted, fontSize: 16, padding: '2px 6px', lineHeight: 1,
              display: 'flex', alignItems: 'center', borderRadius: 4,
              opacity: 0.6, transition: 'opacity 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
            title="Remove condition"
          >
            ×
          </button>
        </>
      )}
    </div>
  );
}

// ── M3-style split button (nested groups only) ─────────────────────────────

function AddFilterSplitButton({ onAddCondition, onAddGroup }: {
  onAddCondition: () => void;
  onAddGroup?: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex', marginTop: 6 }}>
      <div style={{
        display: 'inline-flex',
        border: `1px solid ${C.border}`, borderRadius: 8,
        overflow: 'hidden',
      }}>
        <button
          onClick={onAddCondition}
          style={{
            background: 'transparent', border: 'none',
            padding: '7px 14px', fontSize: 13, fontFamily: FONT, fontWeight: 600,
            color: C.accent, cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          + Add filter
        </button>

        {onAddGroup && (
          <>
            <span style={{ width: 1, alignSelf: 'stretch', background: C.border }} />
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="More add options"
              style={{
                background: menuOpen ? C.surfaceAlt : 'transparent',
                border: 'none',
                padding: '7px 8px', fontSize: 12,
                color: C.textSecondary, cursor: 'pointer',
                transition: 'background 0.1s',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { if (!menuOpen) (e.currentTarget.style.background = C.surfaceAlt); }}
              onMouseLeave={e => { if (!menuOpen) (e.currentTarget.style.background = 'transparent'); }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {menuOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)',
          zIndex: 10, minWidth: 220, padding: 4,
        }}>
          <button
            onClick={() => { onAddCondition(); setMenuOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '8px 12px',
              background: 'transparent', border: 'none', borderRadius: 6,
              fontSize: 13, fontFamily: FONT, fontWeight: 500,
              color: C.text, cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 4,
              background: C.accentLight, border: `1.5px solid ${C.accentBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0, lineHeight: 1,
            }}>
              +
            </span>
            <div>
              <div style={{ fontWeight: 600, color: C.text }}>Add filter</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Add a single field condition</div>
            </div>
          </button>
          {onAddGroup && (
            <button
              onClick={() => { onAddGroup(); setMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 12px',
                background: 'transparent', border: 'none', borderRadius: 6,
                fontSize: 13, fontFamily: FONT, fontWeight: 500,
                color: C.text, cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 4,
                background: C.purpleLight, border: `1.5px solid ${C.purpleBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: C.purple, flexShrink: 0, lineHeight: 1,
              }}>
                +
              </span>
              <div>
                <div style={{ fontWeight: 600, color: C.text }}>Add filter group</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Nest conditions with a separate AND/OR</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Spotlight keyframes ────────────────────────────────────────────────────

const SPOTLIGHT_KEYFRAMES = `
@keyframes spotlightExpand {
  0%   { opacity: 0; transform: scale(0.97) translateY(-2px); }
  40%  { opacity: 1; }
  100% { transform: scale(1) translateY(0); }
}
@keyframes spotlightContentIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes spotlightInputReveal {
  from { opacity: 0; transform: translateX(-8px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes pillIn {
  0%  { opacity: 0; transform: scale(0.86); }
  65% { transform: scale(1.04); }
  100%{ opacity: 1; transform: scale(1); }
}
@keyframes fadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes iconEnter {
  from { opacity: 0; transform: scale(0.8); }
  to   { opacity: 1; transform: scale(1); }
}
`;

const SPOTLIGHT_PLACEHOLDERS: Record<string, string> = {
  nl: 'Describe who, e.g. "full-time engineers in the US"',
  builder: 'Or use the field picker below to add a filter',
  suggest: 'Or choose from suggested filters below',
};

// ── Spotlight: unified filter entry ─────────────────────────────────────────

function FilterSpotlight({ allPeople, suggestions, existingChildren, onCommit, onAddGroup, onClose }: {
  allPeople: Person[];
  suggestions: FilterSuggestion[];
  existingChildren: (RuleCondition | RuleGroup)[];
  onCommit: (conditions: RuleCondition[]) => void;
  onAddGroup?: () => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'nl' | 'builder' | 'suggest'>('nl');
  const [nlText, setNlText] = useState('');
  const [parsedRows, setParsedRows] = useState<FilterRow[]>([]);
  const [noMatch, setNoMatch] = useState(false);

  const [bField, setBField] = useState('');
  const [bOperator, setBOperator] = useState<RuleCondition['operator']>('is');
  const [bValue, setBValue] = useState('');

  const nlInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => nlInputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const onCloseStable = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      if (mode !== 'nl') setMode('nl');
      else onCloseStable();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mode, onCloseStable]);

  useEffect(() => {
    if (!overflowOpen) return;
    const close = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) setOverflowOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [overflowOpen]);

  const handleNLInput = (val: string) => {
    if (mode !== 'nl') setMode('nl');
    setNlText(val);
    if (val.trim().length > 2) {
      const rows = parseNL(val, allPeople);
      setParsedRows(rows);
      setNoMatch(rows.length === 0);
    } else {
      setParsedRows([]);
      setNoMatch(false);
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && mode === 'nl' && parsedRows.length > 0) {
      commitNL();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const modes: ('nl' | 'builder' | 'suggest')[] = ['nl', 'builder', 'suggest'];
      const idx = modes.indexOf(mode);
      setMode(modes[(idx + 1) % modes.length]);
    }
  };

  const commitNL = () => {
    if (parsedRows.length === 0) return;
    onCommit(parsedRows.map(r => ({ type: 'condition' as const, field: r.field, operator: r.operator, value: r.value })));
    onClose();
  };

  const commitBuilder = () => {
    if (!bField || !bValue) return;
    onCommit([{ type: 'condition', field: bField, operator: bOperator, value: bValue }]);
    onClose();
  };

  const commitSuggestion = (s: FilterSuggestion) => {
    onCommit([s.condition]);
  };

  const filteredSuggestions = useMemo(() => {
    const keys = new Set<string>();
    for (const c of existingChildren) {
      if (c.type === 'condition') keys.add(`${c.field}:${c.operator}:${c.value}`);
    }
    return suggestions.filter(s => !keys.has(`${s.condition.field}:${s.condition.operator}:${s.condition.value}`));
  }, [suggestions, existingChildren]);

  const bValueOptions = useMemo(() => {
    if (!bField) return [];
    return getValueOptions(bField, allPeople).map(v => ({ value: v, label: formatValue(bField, v) }));
  }, [bField, allPeople]);
  const bOps = OPERATOR_OPTIONS[bField] || [{ value: 'is' as const, label: 'is' }];

  const modeBtnStyle = (m: 'builder' | 'suggest'): React.CSSProperties => ({
    width: 28, height: 28, borderRadius: 6,
    border: `1px solid ${mode === m ? C.accentBorder : 'transparent'}`,
    background: mode === m ? C.accentLight : 'transparent',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: mode === m ? C.accent : C.textMuted,
    flexShrink: 0,
    transition: `all 180ms ${EASE.spring}`,
    animation: `iconEnter 250ms ${EASE.springBounce} both`,
  });

  const hasResultsContent =
    (mode === 'nl' && (parsedRows.length > 0 || (noMatch && nlText.trim().length > 2))) ||
    mode === 'builder' ||
    mode === 'suggest';

  return (
    <div ref={containerRef} style={{
      borderRadius: 12,
      border: `1.5px solid ${C.accent}`,
      background: C.surface,
      boxShadow: `${S.card}, 0 0 0 4px rgba(0,117,222,0.06)`,
      overflow: 'visible',
      animation: `spotlightExpand 300ms ${EASE.spring}`,
      transformOrigin: 'top left',
      willChange: 'transform, opacity',
    }}>
      <style>{SPOTLIGHT_KEYFRAMES}</style>

      {/* ── Input row: NL input (distinct) + mode icons + overflow ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: 6,
      }}>
        {/* NL input — its own visual container */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: C.surfaceAlt, borderRadius: 8,
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.04)',
          overflow: 'hidden',
          animation: `spotlightInputReveal 320ms ${EASE.spring}`,
        }}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginLeft: 10, color: C.textMuted, opacity: 0.6 }}>
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.4"/>
            <path d="M9.5 9.5L12.5 12.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            ref={nlInputRef}
            type="text"
            value={nlText}
            onChange={e => handleNLInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={SPOTLIGHT_PLACEHOLDERS[mode]}
            style={{
              flex: 1, padding: '8px 10px', border: 'none', fontSize: 14,
              fontFamily: FONT, color: C.text, background: 'transparent', outline: 'none',
              minWidth: 0,
            }}
          />
          <span style={{
            fontSize: 10, fontFamily: '"SF Mono","Fira Code",Menlo,monospace',
            color: C.textMuted, background: 'rgba(0,0,0,0.04)', borderRadius: 4,
            padding: '2px 5px', fontWeight: 500, letterSpacing: 0.5, flexShrink: 0,
            border: `1px solid rgba(0,0,0,0.06)`, marginRight: 6,
            opacity: 0.7,
          }}>
            tab
          </span>
        </div>

        {/* Mode button group */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 2,
          flexShrink: 0, padding: '0 2px',
        }}>
          <button
            onClick={() => setMode(mode === 'builder' ? 'nl' : 'builder')}
            title="Build filter manually"
            style={modeBtnStyle('builder')}
            onMouseEnter={e => { if (mode !== 'builder') { e.currentTarget.style.background = C.surfaceAlt; e.currentTarget.style.color = C.accent; } }}
            onMouseLeave={e => { if (mode !== 'builder') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; } }}
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
            onClick={() => setMode(mode === 'suggest' ? 'nl' : 'suggest')}
            title="Smart suggestions"
            style={modeBtnStyle('suggest')}
            onMouseEnter={e => { if (mode !== 'suggest') { e.currentTarget.style.background = C.surfaceAlt; e.currentTarget.style.color = C.accent; } }}
            onMouseLeave={e => { if (mode !== 'suggest') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; } }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1l1.2 3.8L12 5l-3 2.7 1 3.8L7 9.2 4 11.5l1-3.8L2 5l3.8-.2L7 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"/>
            </svg>
          </button>

          {/* Overflow menu — replaces the old "or add filter group" text link */}
          {onAddGroup && (
            <div ref={overflowRef} style={{ position: 'relative' }}>
              <button
                onClick={() => setOverflowOpen(o => !o)}
                title="More options"
                style={{
                  width: 28, height: 28, borderRadius: 6,
                  border: `1px solid ${overflowOpen ? C.border : 'transparent'}`,
                  background: overflowOpen ? C.surfaceAlt : 'transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.textMuted, flexShrink: 0,
                  transition: `all 150ms ${EASE.spring}`,
                  animation: `iconEnter 250ms ${EASE.springBounce} 60ms both`,
                }}
                onMouseEnter={e => { if (!overflowOpen) { e.currentTarget.style.background = C.surfaceAlt; e.currentTarget.style.color = C.textSecondary; } }}
                onMouseLeave={e => { if (!overflowOpen) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.textMuted; } }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <circle cx="3" cy="7" r="1.2" fill="currentColor"/>
                  <circle cx="7" cy="7" r="1.2" fill="currentColor"/>
                  <circle cx="11" cy="7" r="1.2" fill="currentColor"/>
                </svg>
              </button>
              {overflowOpen && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 4px)', right: 0,
                  background: C.surface, border: `1px solid ${C.border}`,
                  borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
                  zIndex: 20, minWidth: 220, padding: 4,
                  animation: `slideDown 180ms ${EASE.spring}`,
                }}>
                  <button
                    onClick={() => { onAddGroup!(); onClose(); setOverflowOpen(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      width: '100%', padding: '8px 12px',
                      background: 'transparent', border: 'none', borderRadius: 6,
                      fontSize: 13, fontFamily: FONT, fontWeight: 500,
                      color: C.text, cursor: 'pointer', textAlign: 'left',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{
                      width: 20, height: 20, borderRadius: 4,
                      background: C.purpleLight, border: `1.5px solid ${C.purpleBorder}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: C.purple, flexShrink: 0, lineHeight: 1,
                    }}>+</span>
                    <div>
                      <div style={{ fontWeight: 600, color: C.text }}>Add filter group</div>
                      <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Nest conditions with a separate AND/OR</div>
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Results panel — animated height via CSS grid ─────────── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: hasResultsContent ? '1fr' : '0fr',
        transition: `grid-template-rows 280ms ${EASE.spring}`,
      }}>
        <div style={{ overflow: 'hidden' }}>

          {/* NL parsed results */}
          {mode === 'nl' && parsedRows.length > 0 && (
            <div style={{
              padding: '2px 10px 10px',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              paddingTop: 10,
              animation: `spotlightContentIn 220ms ${EASE.spring}`,
            }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {parsedRows.map((r, i) => (
                  <span key={`${r.field}-${r.value}`} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: C.accentLight, color: C.accent,
                    border: `1px solid ${C.accentBorder}`, borderRadius: 9999,
                    padding: '3px 10px', fontSize: 13, fontWeight: 600,
                    animation: `pillIn 280ms ${EASE.springBounce} ${i * 50}ms both`,
                    willChange: 'transform, opacity',
                  }}>
                    <span style={{ color: C.textSecondary, fontWeight: 400, fontSize: 12 }}>{fieldLabels[r.field] || r.field}</span>
                    <span style={{ color: C.textMuted, fontSize: 12 }}>{r.operator === 'is' ? '=' : r.operator}</span>
                    <span>{formatValue(r.field, r.value as string)}</span>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={commitNL}
                  style={{
                    background: C.accent, color: '#fff', border: 'none',
                    borderRadius: 6, padding: '5px 14px', fontSize: 13, fontWeight: 600,
                    fontFamily: FONT, cursor: 'pointer',
                    transition: `background 150ms ${EASE.spring}`,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = C.accentHover)}
                  onMouseLeave={e => (e.currentTarget.style.background = C.accent)}
                >
                  Apply
                </button>
                <span style={{ fontSize: 12, color: C.textMuted }}>or press ↵</span>
              </div>
            </div>
          )}

          {/* NL no-match hint */}
          {mode === 'nl' && noMatch && nlText.trim().length > 2 && (
            <div style={{ padding: '2px 10px 8px', animation: `fadeIn 200ms ease` }}>
              <div style={{
                padding: '6px 10px', background: C.surfaceAlt, borderRadius: 6,
                fontSize: 12, color: C.textSecondary, lineHeight: 1.4,
              }}>
                No conditions recognized. Try departments, locations, countries, "full-time," "contractor," "managers," or "joined after 2025."
              </div>
            </div>
          )}

          {/* Builder mode */}
          {mode === 'builder' && (
            <div style={{
              padding: '6px 10px 10px',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              animation: `spotlightContentIn 220ms ${EASE.spring}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Select
                  value={bField}
                  options={FIELD_OPTIONS}
                  onChange={f => { setBField(f); setBOperator(OPERATOR_OPTIONS[f]?.[0]?.value || 'is'); setBValue(''); }}
                  placeholder="Field..."
                  style={{ flex: '0 0 130px' }}
                />
                <Select value={bOperator} options={bOps} onChange={o => setBOperator(o as RuleCondition['operator'])} style={{ flex: '0 0 90px' }} />
                {bField === 'startDate' ? (
                  <input type="date" value={bValue} onChange={e => setBValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitBuilder(); }}
                    style={{ flex: 1, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }} />
                ) : bField === 'title' && bOperator === 'contains' ? (
                  <input type="text" value={bValue} onChange={e => setBValue(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') commitBuilder(); }} placeholder="Enter text..."
                    style={{ flex: 1, padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 14, fontFamily: FONT, color: C.text, background: C.surface, outline: 'none' }} />
                ) : (
                  <Select value={bValue} options={bValueOptions} onChange={v => setBValue(v)} placeholder="Value..." style={{ flex: 1 }} />
                )}
                <button
                  onClick={commitBuilder}
                  disabled={!bField || !bValue}
                  style={{
                    background: (!bField || !bValue) ? C.textMuted : C.accent,
                    color: '#fff', border: 'none', borderRadius: 6,
                    padding: '6px 12px', fontSize: 13, fontWeight: 600, fontFamily: FONT,
                    cursor: (!bField || !bValue) ? 'default' : 'pointer',
                    opacity: (!bField || !bValue) ? 0.4 : 1, flexShrink: 0,
                    transition: `opacity 150ms, background 150ms`,
                  }}
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Suggest mode */}
          {mode === 'suggest' && (
            <div style={{
              padding: '6px 10px 10px',
              borderTop: '1px solid rgba(0,0,0,0.05)',
              animation: `spotlightContentIn 220ms ${EASE.spring}`,
            }}>
              {filteredSuggestions.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingBottom: 2 }}>
                  {filteredSuggestions.map((s, i) => (
                    <button
                      key={`${s.condition.field}-${s.condition.value}`}
                      onClick={() => commitSuggestion(s)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        background: C.surfaceAlt, color: C.text,
                        border: `1px solid ${C.border}`, borderRadius: 9999,
                        padding: '5px 12px', fontSize: 13, fontWeight: 500, fontFamily: FONT,
                        cursor: 'pointer',
                        animation: `pillIn 280ms ${EASE.springBounce} ${i * 40}ms both`,
                        transition: `background 150ms, border-color 150ms, color 150ms`,
                        willChange: 'transform, opacity',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = C.accentLight; e.currentTarget.style.borderColor = C.accentBorder; e.currentTarget.style.color = C.accent; }}
                      onMouseLeave={e => { e.currentTarget.style.background = C.surfaceAlt; e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text; }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 13, color: C.textMuted, padding: '4px 0' }}>
                  No more suggestions available.
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Spotlight split-button (root level: morph trigger) ─────────────────────

function FilterSpotlightButton({ allPeople, suggestions, existingChildren, onCommit, onAddGroup, onOpenChange }: {
  allPeople: Person[];
  suggestions: FilterSuggestion[];
  existingChildren: (RuleCondition | RuleGroup)[];
  onCommit: (conditions: RuleCondition[]) => void;
  onAddGroup?: () => void;
  onOpenChange?: (open: boolean) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const open = useCallback(() => {
    setIsOpen(true);
    onOpenChange?.(true);
  }, [onOpenChange]);

  const close = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  if (isOpen) {
    return (
      <div style={{ marginTop: 6 }}>
        <FilterSpotlight
          allPeople={allPeople}
          suggestions={suggestions}
          existingChildren={existingChildren}
          onCommit={onCommit}
          onAddGroup={onAddGroup}
          onClose={close}
        />
      </div>
    );
  }

  return (
    <div ref={menuRef} style={{ position: 'relative', display: 'inline-flex', marginTop: 6 }}>
      <div style={{
        display: 'inline-flex',
        border: `1px solid ${C.border}`, borderRadius: 8,
        overflow: 'hidden',
        transition: `border-color 200ms ${EASE.spring}, box-shadow 200ms ${EASE.spring}`,
      }}>
        {/* Primary — opens Spotlight */}
        <button
          onClick={open}
          style={{
            background: 'transparent', border: 'none',
            padding: '7px 14px', fontSize: 13, fontFamily: FONT, fontWeight: 600,
            color: C.accent, cursor: 'pointer',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = C.accentLight)}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          + Add filter
        </button>

        {/* Chevron — dropdown with "Add filter group" */}
        {onAddGroup && (
          <>
            <span style={{ width: 1, alignSelf: 'stretch', background: C.border }} />
            <button
              onClick={() => setMenuOpen(o => !o)}
              aria-label="More add options"
              style={{
                background: menuOpen ? C.surfaceAlt : 'transparent',
                border: 'none',
                padding: '7px 8px', fontSize: 12,
                color: C.textSecondary, cursor: 'pointer',
                transition: 'background 0.1s',
                display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={e => { if (!menuOpen) (e.currentTarget.style.background = C.surfaceAlt); }}
              onMouseLeave={e => { if (!menuOpen) (e.currentTarget.style.background = 'transparent'); }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ display: 'block' }}>
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Split-button dropdown */}
      {menuOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0,
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          zIndex: 10, minWidth: 220, padding: 4,
          animation: `slideDown 180ms ${EASE.spring}`,
        }}>
          <style>{SPOTLIGHT_KEYFRAMES}</style>
          <button
            onClick={() => { open(); setMenuOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              width: '100%', padding: '8px 12px',
              background: 'transparent', border: 'none', borderRadius: 6,
              fontSize: 13, fontFamily: FONT, fontWeight: 500,
              color: C.text, cursor: 'pointer', textAlign: 'left',
              transition: 'background 0.1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{
              width: 20, height: 20, borderRadius: 4,
              background: C.accentLight, border: `1.5px solid ${C.accentBorder}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: C.accent, flexShrink: 0, lineHeight: 1,
            }}>+</span>
            <div>
              <div style={{ fontWeight: 600, color: C.text }}>Add filter</div>
              <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Describe or pick a filter condition</div>
            </div>
          </button>
          {onAddGroup && (
            <button
              onClick={() => { onAddGroup(); setMenuOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '8px 12px',
                background: 'transparent', border: 'none', borderRadius: 6,
                fontSize: 13, fontFamily: FONT, fontWeight: 500,
                color: C.text, cursor: 'pointer', textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = C.surfaceAlt)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{
                width: 20, height: 20, borderRadius: 4,
                background: C.purpleLight, border: `1.5px solid ${C.purpleBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, fontWeight: 700, color: C.purple, flexShrink: 0, lineHeight: 1,
              }}>+</span>
              <div>
                <div style={{ fontWeight: 600, color: C.text }}>Add filter group</div>
                <div style={{ fontSize: 12, color: C.textMuted, marginTop: 1 }}>Nest conditions with a separate AND/OR</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Recursive RuleGroupEditor ──────────────────────────────────────────────

export default function RuleGroupEditor({ group, allPeople, onChange, readOnly, depth = 0, suggestions }: {
  group: RuleGroup;
  allPeople: Person[];
  onChange: (updated: RuleGroup) => void;
  readOnly?: boolean;
  depth?: number;
  suggestions?: FilterSuggestion[];
}) {
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  const handleSpotlightCommit = useCallback((conditions: RuleCondition[]) => {
    const shouldNest = conditions.length > 1
      && (group.children.length > 0 || group.combinator === 'OR');
    if (shouldNest) {
      const nested: RuleGroup = { type: 'group', combinator: 'AND', children: conditions };
      onChange({ ...group, children: [...group.children, nested] });
    } else {
      onChange({ ...group, children: [...group.children, ...conditions] });
    }
  }, [group, onChange]);

  const updateChild = (index: number, updated: RuleNode) => {
    const next = [...group.children];
    next[index] = updated;
    onChange({ ...group, children: next });
  };

  const removeChild = (index: number) => {
    onChange({ ...group, children: group.children.filter((_, i) => i !== index) });
  };

  const addCondition = () => {
    const newCondition: RuleCondition = {
      type: 'condition',
      field: '',
      operator: 'is',
      value: '',
    };
    onChange({ ...group, children: [...group.children, newCondition] });
  };

  const addFilterGroup = () => {
    const newGroup: RuleGroup = {
      type: 'group',
      combinator: group.combinator === 'AND' ? 'OR' : 'AND',
      children: [
        { type: 'condition', field: '', operator: 'is', value: '' },
      ],
    };
    onChange({ ...group, children: [...group.children, newGroup] });
  };

  const toggleCombinator = () => {
    onChange({ ...group, combinator: group.combinator === 'AND' ? 'OR' : 'AND' });
  };

  const isRoot = depth === 0;

  return (
    <div style={{
      ...(isRoot ? {} : {
        marginLeft: 12,
        paddingLeft: 14,
        borderLeft: `2px solid ${C.accentBorder}`,
        marginTop: 6,
        marginBottom: 6,
        paddingTop: 4,
        paddingBottom: 4,
        background: depth % 2 === 1 ? 'rgba(0,117,222,0.02)' : 'transparent',
        borderRadius: '0 8px 8px 0',
      }),
    }}>
      {!isRoot && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
          padding: '2px 0',
        }}>
          {readOnly ? (
            <span style={{
              fontSize: 11, fontWeight: 700, color: C.accent,
              background: C.accentLight, borderRadius: 9999, padding: '2px 10px',
              textTransform: 'uppercase', letterSpacing: 0.5,
            }}>
              {group.combinator} group
            </span>
          ) : (
            <button
              onClick={toggleCombinator}
              style={{
                fontSize: 11, fontWeight: 700, color: C.accent,
                background: C.accentLight, border: `1px solid ${C.accentBorder}`,
                borderRadius: 9999, padding: '2px 10px',
                textTransform: 'uppercase', letterSpacing: 0.5,
                cursor: 'pointer', fontFamily: FONT,
              }}
            >
              {group.combinator} group
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => {/* removal handled by parent */}}
              style={{ display: 'none' }}
            />
          )}
        </div>
      )}

      {group.children.map((child, i) => {
        if (child.type === 'condition') {
          return (
            <ConditionRow
              key={i}
              condition={child}
              allPeople={allPeople}
              onChange={(updated) => updateChild(i, updated)}
              onRemove={() => removeChild(i)}
              isFirst={i === 0 && isRoot}
              combinator={group.combinator}
              onCombinatorChange={readOnly ? () => {} : toggleCombinator}
              readOnly={readOnly}
            />
          );
        }
        return (
          <div key={i} style={{ position: 'relative' }}>
            {i > 0 && !readOnly && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '2px 0 2px 60px',
              }}>
                <button
                  onClick={toggleCombinator}
                  style={{
                    background: '#f2f9ff', color: '#097fe8', border: 'none',
                    borderRadius: 9999, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', letterSpacing: 0.125, fontFamily: FONT,
                  }}
                >
                  {group.combinator}
                </button>
              </div>
            )}
            {i > 0 && readOnly && (
              <div style={{
                padding: '2px 0 2px 60px', fontSize: 12, fontWeight: 600,
                color: '#097fe8',
              }}>
                <span style={{
                  background: '#f2f9ff', borderRadius: 9999, padding: '2px 8px',
                  letterSpacing: 0.125,
                }}>
                  {group.combinator}
                </span>
              </div>
            )}
            <RuleGroupEditor
              group={child}
              allPeople={allPeople}
              onChange={(updated) => updateChild(i, updated)}
              readOnly={readOnly}
              depth={depth + 1}
            />
            {!readOnly && (
              <button
                onClick={() => removeChild(i)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: C.textMuted, fontSize: 14, padding: '2px 6px',
                  opacity: 0.5, transition: 'opacity 0.1s',
                  borderRadius: 4,
                }}
                onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                title="Remove group"
              >
                ×
              </button>
            )}
          </div>
        );
      })}

      {!readOnly && isRoot && (
        <FilterSpotlightButton
          allPeople={allPeople}
          suggestions={suggestions || []}
          existingChildren={group.children as (RuleCondition | RuleGroup)[]}
          onCommit={handleSpotlightCommit}
          onAddGroup={depth < 3 ? addFilterGroup : undefined}
          onOpenChange={setSpotlightOpen}
        />
      )}
      {!readOnly && !isRoot && (
        <AddFilterSplitButton
          onAddCondition={addCondition}
          onAddGroup={depth < 3 ? addFilterGroup : undefined}
        />
      )}

      {group.children.length === 0 && !readOnly && isRoot && !spotlightOpen && (
        <div style={{ padding: '6px 0 4px', color: C.textMuted, fontSize: 13, lineHeight: 1.5 }}>
          No conditions yet. Press <span style={{
            fontSize: 10, fontFamily: '"SF Mono","Fira Code",Menlo,monospace',
            background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 3,
            padding: '1px 4px', fontWeight: 500, color: C.textSecondary,
          }}>tab</span> inside the filter bar to switch between input modes.
        </div>
      )}
    </div>
  );
}

// ── Utilities exported for use by index.tsx ─────────────────────────────────

export function createEmptyRuleGroup(combinator: 'AND' | 'OR' = 'AND'): RuleGroup {
  return { type: 'group', combinator, children: [] };
}

export function ruleGroupHasValidConditions(group: RuleGroup): boolean {
  for (const child of group.children) {
    if (child.type === 'condition') {
      if (child.field && child.value !== '' && (Array.isArray(child.value) ? child.value.length > 0 : true)) {
        return true;
      }
    } else if (ruleGroupHasValidConditions(child)) {
      return true;
    }
  }
  return false;
}

export function canRenderInEditor(rule: RuleGroup): boolean {
  for (const child of rule.children) {
    if (child.type === 'condition') {
      if (child.operator === 'in') return false;
      if (!FIELD_OPTIONS.some(f => f.value === child.field)) return false;
    } else if (child.type === 'group') {
      if (!canRenderInEditor(child)) return false;
    }
  }
  return true;
}

export { fieldLabels, formatValue, FIELD_OPTIONS, OPERATOR_OPTIONS };

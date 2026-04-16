/**
 * Shared type contract for all five prototype concepts.
 * Every concept receives an EntryState on mount containing the scenario
 * to render and the mock data to render it with.
 *
 * Derived from the technical spec's data model:
 * - Rule representation as a structured AST (RuleGroup)
 * - Group metadata with provenance, lifecycle, and consumer references
 * - Evaluation layers that invisibly affect membership
 * - Downstream policy references with sensitivity tiers
 */

// ── Scenarios ────────────────────────────────────────────────────────────────

export type Scenario =
  | { type: 'create'; policyContext?: PolicyRef }
  | { type: 'view'; groupId: string }
  | { type: 'edit'; groupId: string }
  | { type: 'inline-select'; policyContext: PolicyRef };

export type InteractionContext = 'standalone' | 'inline';

// ── Entry state (passed to every concept on mount) ──────────────────────────

export interface EntryState {
  scenario: Scenario;
  context: InteractionContext;
  data: MockData;
}

export interface MockData {
  people: Person[];
  savedGroups: SavedGroup[];
  policies: PolicyRef[];
}

// ── People ──────────────────────────────────────────────────────────────────

export interface Person {
  id: string;
  name: string;
  avatarUrl?: string;
  department: string;
  location: string;
  country: string;
  employmentType: 'full_time' | 'part_time' | 'contractor';
  roleState: 'active' | 'pending' | 'terminated';
  startDate: string;
  title: string;
}

// ── Rule AST ────────────────────────────────────────────────────────────────

export interface RuleCondition {
  type: 'condition';
  field: string;
  operator: 'is' | 'is_not' | 'contains' | 'greater_than' | 'less_than' | 'after' | 'before' | 'in';
  value: string | string[];
}

export interface RuleGroup {
  type: 'group';
  combinator: 'AND' | 'OR';
  children: (RuleCondition | RuleGroup)[];
}

export type RuleNode = RuleCondition | RuleGroup;

// ── Evaluation layers ───────────────────────────────────────────────────────

export interface EvaluationLayer {
  id: string;
  type: 'role_state' | 'scope' | 'provisioning_group' | 'parent_constraint' | 'temporal';
  label: string;
  description: string;
  excludedPeopleIds: string[];
}

// ── Groups ──────────────────────────────────────────────────────────────────

export interface SavedGroup {
  id: string;
  name: string;
  purpose: string;
  owner: string;
  productDomain: string;
  lifecycleIntent: 'persistent' | 'temporary' | 'system_managed';
  rule: RuleGroup;
  memberIds: string[];
  evaluationLayers: EvaluationLayer[];
  consumers: PolicyRef[];
  lastEvaluatedAt: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  isLegacy?: boolean;
}

// ── Policies / downstream consumers ─────────────────────────────────────────

export type PolicyDomain =
  | 'payroll'
  | 'benefits'
  | 'it'
  | 'compliance'
  | 'communications'
  | 'learning';

export type SensitivityTier = 1 | 2 | 3;

export interface PolicyRef {
  id: string;
  name: string;
  domain: PolicyDomain;
  sensitivityTier: SensitivityTier;
  affectedCount: number;
}

// ── Concept component contract ──────────────────────────────────────────────

export type ConceptId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export interface ConceptProps {
  entryState: EntryState;
}

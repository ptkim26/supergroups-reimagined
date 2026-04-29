import type { Person, SavedGroup, PolicyRef, MockData, EvaluationLayer, EntryState } from './types';

const people: Person[] = [
  { id: 'p1',  name: 'Sarah Chen',        department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2022-03-15', title: 'Senior Engineer',        entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p2',  name: 'Marcus Johnson',     department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'pending',    startDate: '2026-04-01', title: 'Software Engineer',      entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p3',  name: 'Aisha Patel',        department: 'Engineering', location: 'New York',      country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-01-10', title: 'Engineering Manager',    entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p4',  name: 'James O\'Brien',     department: 'Sales',       location: 'New York',      country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2021-06-01', title: 'Account Executive',      entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p5',  name: 'Priya Sharma',       department: 'Sales',       location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-09-12', title: 'Sales Manager',          entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p6',  name: 'David Kim',          department: 'Finance',     location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2022-11-20', title: 'Financial Analyst',      entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p7',  name: 'Elena Rodriguez',    department: 'Finance',     location: 'Austin',        country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2024-02-14', title: 'Controller',             entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p8',  name: 'Chris Nakamura',     department: 'Engineering', location: 'Austin',        country: 'US', employmentType: 'contractor',  roleState: 'active',     startDate: '2025-06-01', title: 'Contract Engineer',      entity: 'US Corp' },
  { id: 'p9',  name: 'Fatima Al-Hassan',   department: 'HR',          location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2021-01-05', title: 'HR Director',            entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p10', name: 'Tom Williams',       department: 'Engineering', location: 'London',        country: 'GB', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-07-22', title: 'Staff Engineer',         entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  { id: 'p11', name: 'Rachel Foster',      department: 'Marketing',   location: 'New York',      country: 'US', employmentType: 'part_time',  roleState: 'active',     startDate: '2024-10-01', title: 'Content Strategist',     entity: 'US Corp' },
  { id: 'p12', name: 'Sam Okafor',         department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'terminated', startDate: '2020-08-15', title: 'Principal Engineer',     entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p13', name: 'Nina Kowalski',      department: 'Sales',       location: 'Austin',        country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2025-01-06', title: 'SDR',                    entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p14', name: 'Alex Rivera',        department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2022-05-30', title: 'Tech Lead',              entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p15', name: 'Jordan Lee',         department: 'Finance',     location: 'New York',      country: 'US', employmentType: 'contractor',  roleState: 'active',     startDate: '2025-11-01', title: 'Contract Accountant',    entity: 'US Corp' },
  // Additional US Corp (11) — expand to reach ~25 US Corp
  { id: 'p16', name: 'Maya Thompson',      department: 'Engineering', location: 'Seattle',       country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2022-08-01', title: 'Backend Engineer',       entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p17', name: 'Ethan Walker',       department: 'Engineering', location: 'Chicago',       country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-05-18', title: 'Frontend Engineer',      entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p18', name: 'Grace Liu',          department: 'Sales',       location: 'Chicago',       country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2024-03-22', title: 'Account Executive',      entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p19', name: 'Daniel Brooks',      department: 'Marketing',   location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2021-11-08', title: 'Brand Manager',          entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p20', name: 'Olivia Martinez',    department: 'HR',          location: 'Austin',        country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-02-14', title: 'People Partner',         entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p21', name: 'Noah Bennett',       department: 'Finance',     location: 'New York',      country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2022-06-27', title: 'Finance Manager',        entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p22', name: 'Hannah Schmidt',     department: 'Operations',  location: 'Seattle',       country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2024-09-03', title: 'Ops Lead',               entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p23', name: 'Liam Anderson',      department: 'Legal',       location: 'New York',      country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2022-04-11', title: 'Associate Counsel',      entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p24', name: 'Sofia Ramirez',      department: 'Engineering', location: 'Austin',        country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-10-02', title: 'Senior Engineer',        entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p25', name: 'Oscar Nguyen',       department: 'Engineering', location: 'San Francisco', country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2024-01-29', title: 'Platform Engineer',      entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  { id: 'p26', name: 'Isla Bennett',       department: 'Sales',       location: 'Seattle',       country: 'US', employmentType: 'full_time',  roleState: 'active',     startDate: '2025-03-17', title: 'SDR',                    entity: 'US Corp',   fullTimeHoursPerWeek: 40 },
  // UK Ltd (7 additional, 8 total with p10). Drift: full-time = 35hr/week. Two probationary.
  { id: 'p27', name: 'Oliver Hughes',      department: 'Engineering', location: 'London',        country: 'GB', employmentType: 'full_time',  roleState: 'active',      startDate: '2022-09-15', title: 'Engineering Manager',    entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  { id: 'p28', name: 'Amelia Clarke',      department: 'Sales',       location: 'London',        country: 'GB', employmentType: 'full_time',  roleState: 'active',      startDate: '2023-06-06', title: 'Account Executive',      entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  { id: 'p29', name: 'Harry Patel',        department: 'Finance',     location: 'London',        country: 'GB', employmentType: 'full_time',  roleState: 'active',      startDate: '2021-04-21', title: 'Finance Analyst',        entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  { id: 'p30', name: 'Emily Dawson',       department: 'HR',          location: 'Manchester',    country: 'GB', employmentType: 'full_time',  roleState: 'active',      startDate: '2024-02-26', title: 'HR Business Partner',    entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  { id: 'p31', name: 'George Wright',      department: 'Marketing',   location: 'London',        country: 'GB', employmentType: 'full_time',  roleState: 'probationary',startDate: '2026-02-01', title: 'Growth Marketer',        entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  { id: 'p32', name: 'Freya Sullivan',     department: 'Engineering', location: 'Manchester',    country: 'GB', employmentType: 'full_time',  roleState: 'probationary',startDate: '2026-01-15', title: 'Frontend Engineer',      entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  { id: 'p33', name: 'Jack Morgan',        department: 'Operations',  location: 'London',        country: 'GB', employmentType: 'full_time',  roleState: 'active',      startDate: '2022-07-19', title: 'Operations Manager',     entity: 'UK Ltd',    fullTimeHoursPerWeek: 35 },
  // Ireland Ltd (5). Drift: IE uses "Software Developer" not "Engineer" for engineering roles; department is stored as '—' and cost center is canonical.
  { id: 'p34', name: 'Siobhán Murphy',     department: '—',           location: 'Dublin',        country: 'IE', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-08-28', title: 'Staff Software Developer', entity: 'Ireland Ltd', fullTimeHoursPerWeek: 37, titleVariant: 'Engineer', costCenter: 'DUB-ENG-001' },
  { id: 'p35', name: 'Cillian Byrne',      department: '—',           location: 'Dublin',        country: 'IE', employmentType: 'full_time',  roleState: 'active',     startDate: '2024-05-13', title: 'Account Executive',      entity: 'Ireland Ltd', fullTimeHoursPerWeek: 37, costCenter: 'DUB-SLS-002' },
  { id: 'p36', name: 'Aoife Kelly',        department: '—',           location: 'Dublin',        country: 'IE', employmentType: 'full_time',  roleState: 'active',     startDate: '2022-10-07', title: 'Financial Controller',   entity: 'Ireland Ltd', fullTimeHoursPerWeek: 37, costCenter: 'DUB-FIN-001' },
  { id: 'p37', name: 'Liam Walsh',         department: '—',           location: 'Cork',          country: 'IE', employmentType: 'full_time',  roleState: 'active',     startDate: '2025-04-02', title: 'Software Developer',     entity: 'Ireland Ltd', fullTimeHoursPerWeek: 37, titleVariant: 'Engineer', costCenter: 'CRK-ENG-001' },
  { id: 'p38', name: 'Niamh O\'Sullivan',  department: '—',           location: 'Dublin',        country: 'IE', employmentType: 'full_time',  roleState: 'active',     startDate: '2023-03-20', title: 'People Operations',      entity: 'Ireland Ltd', fullTimeHoursPerWeek: 37, costCenter: 'DUB-HR-001' },
];

const roleStateLayer: EvaluationLayer = {
  id: 'el-role-state',
  type: 'role_state',
  label: 'Active employees only',
  description: 'System filter: only employees with active role status are included. Pending and terminated employees are excluded.',
  excludedPeopleIds: ['p2', 'p12'],
};

const scopeLayer: EvaluationLayer = {
  id: 'el-scope',
  type: 'scope',
  label: 'US entity scope',
  description: 'This group is scoped to the US entity. Employees in other entities are excluded.',
  excludedPeopleIds: ['p10', 'p27', 'p28', 'p29', 'p30', 'p31', 'p32', 'p33', 'p34', 'p35', 'p36', 'p37', 'p38'],
};

const provisioningLayer: EvaluationLayer = {
  id: 'el-provisioning',
  type: 'provisioning_group',
  label: 'Benefits eligibility provisioning',
  description: 'Provisioning rule: only full-time employees are eligible for benefits enrollment.',
  excludedPeopleIds: ['p8', 'p11', 'p15'],
};

// Admin per legal entity. Used by the cross-entity authority simulator
// to display "awaiting Tom Williams" / "visible to Aoife Kelly" messages
// when an admin's reach into another entity is limited.
export const ENTITY_ADMINS: Record<string, string> = {
  'US Corp':     'Fatima Al-Hassan',
  'UK Ltd':      'Tom Williams',
  'Ireland Ltd': 'Aoife Kelly',
};

const policies: PolicyRef[] = [
  { id: 'pol-1', name: 'US Payroll Run',                domain: 'payroll',        sensitivityTier: 1, affectedCount: 847 },
  { id: 'pol-2', name: 'California Benefits',           domain: 'benefits',       sensitivityTier: 2, affectedCount: 312 },
  { id: 'pol-3', name: 'Okta SSO Provisioning',         domain: 'it',             sensitivityTier: 1, affectedCount: 1243 },
  { id: 'pol-4', name: 'SOX Compliance Review',         domain: 'compliance',     sensitivityTier: 1, affectedCount: 89 },
  { id: 'pol-5', name: 'Engineering Slack Channel',     domain: 'communications', sensitivityTier: 3, affectedCount: 156 },
  { id: 'pol-6', name: 'Security Training (LMS)',       domain: 'learning',       sensitivityTier: 3, affectedCount: 1243 },
  { id: 'pol-wrong-demo', name: 'Austin Engineering Onboarding', domain: 'it',   sensitivityTier: 3, affectedCount: 3 },
];

const savedGroups: SavedGroup[] = [
  {
    id: 'sg-1',
    name: 'US Full-Time Employees',
    purpose: 'All full-time employees in the United States entity',
    owner: 'Fatima Al-Hassan',
    productDomain: 'HR',
    lifecycleIntent: 'persistent',
    rule: {
      type: 'group',
      combinator: 'AND',
      children: [
        { type: 'condition', field: 'country', operator: 'is', value: 'US' },
        { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' },
      ],
    },
    memberIds: ['p1', 'p3', 'p4', 'p5', 'p6', 'p7', 'p9', 'p13', 'p14'],
    evaluationLayers: [roleStateLayer, scopeLayer],
    consumers: [policies[0], policies[1], policies[2]],
    lastEvaluatedAt: '2026-03-31T08:00:00Z',
    lastModifiedBy: 'Fatima Al-Hassan',
    lastModifiedAt: '2026-02-15T14:30:00Z',
  },
  {
    id: 'sg-2',
    name: 'Engineering Team',
    purpose: 'All employees in the Engineering department',
    owner: 'Aisha Patel',
    productDomain: 'Engineering',
    lifecycleIntent: 'persistent',
    rule: {
      type: 'group',
      combinator: 'AND',
      children: [
        { type: 'condition', field: 'department', operator: 'is', value: 'Engineering' },
      ],
    },
    memberIds: ['p1', 'p3', 'p8', 'p10', 'p14'],
    evaluationLayers: [roleStateLayer],
    consumers: [policies[4]],
    lastEvaluatedAt: '2026-03-31T08:00:00Z',
    lastModifiedBy: 'Aisha Patel',
    lastModifiedAt: '2026-03-01T10:15:00Z',
  },
  {
    id: 'sg-3',
    name: 'California Benefits Eligible',
    purpose: 'Full-time employees in California eligible for state benefits',
    owner: 'Fatima Al-Hassan',
    productDomain: 'HR',
    lifecycleIntent: 'persistent',
    rule: {
      type: 'group',
      combinator: 'AND',
      children: [
        { type: 'condition', field: 'location', operator: 'is', value: 'San Francisco' },
        { type: 'condition', field: 'employmentType', operator: 'is', value: 'full_time' },
      ],
    },
    memberIds: ['p1', 'p5', 'p6', 'p9', 'p14'],
    evaluationLayers: [roleStateLayer, scopeLayer, provisioningLayer],
    consumers: [policies[1]],
    lastEvaluatedAt: '2026-03-31T08:00:00Z',
    lastModifiedBy: 'Fatima Al-Hassan',
    lastModifiedAt: '2026-01-20T09:45:00Z',
  },
  {
    id: 'sg-legacy',
    name: '',
    purpose: '',
    owner: '',
    productDomain: '',
    lifecycleIntent: 'system_managed',
    rule: {
      type: 'group',
      combinator: 'OR',
      children: [
        {
          type: 'group',
          combinator: 'AND',
          children: [
            { type: 'condition', field: 'department', operator: 'is', value: 'Finance' },
            { type: 'condition', field: 'country', operator: 'is', value: 'US' },
          ],
        },
        {
          type: 'group',
          combinator: 'AND',
          children: [
            { type: 'condition', field: 'department', operator: 'is', value: 'Engineering' },
            { type: 'condition', field: 'location', operator: 'is', value: 'San Francisco' },
          ],
        },
      ],
    },
    memberIds: ['p1', 'p6', 'p7', 'p14'],
    evaluationLayers: [roleStateLayer],
    consumers: [policies[3]],
    lastEvaluatedAt: '2026-03-31T08:00:00Z',
    lastModifiedBy: 'system',
    lastModifiedAt: '2024-06-10T00:00:00Z',
    isLegacy: true,
  },
];

const mockData: MockData = { people, savedGroups, policies };

export function createEntryState(
  scenarioType: 'create' | 'view' | 'edit' | 'inline-select' = 'view',
  context: 'standalone' | 'inline' = 'standalone',
): EntryState {
  const scenario =
    scenarioType === 'create'
      ? { type: 'create' as const }
      : scenarioType === 'inline-select'
        ? { type: 'inline-select' as const, policyContext: policies[1] }
        : { type: scenarioType as 'view' | 'edit', groupId: 'sg-1' };

  return { scenario, context, data: mockData };
}

/** AI-gets-it-wrong scenario: CreateMode pre-seeded with a wrong OR rule for Austin Engineering */
export function createWrongRuleEntryState(): EntryState {
  const wrongPolicy = policies.find(p => p.id === 'pol-wrong-demo')!;
  return {
    scenario: { type: 'create', policyContext: wrongPolicy },
    context: 'standalone',
    data: mockData,
  };
}

/** Cold-open view scenario: legacy unnamed group with no conversation history */
export function createColdViewEntryState(): EntryState {
  return {
    scenario: { type: 'view', groupId: 'sg-legacy' },
    context: 'standalone',
    data: mockData,
  };
}

export { mockData };

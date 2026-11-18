/** Default plan ticket subtitles per period (seeded when none exist). */
export const PLAN_TICKET_DEFAULTS_BY_PERIOD = {
  daily: [
    { key: 'EARNING_OUTCOME', title: 'Earning and Outcome result', sortOrder: 1 },
    { key: 'BITTENSOR_TASK', title: 'Working on Task (or Bittensor)', sortOrder: 2 },
    { key: 'NEW_CITIZEN', title: 'Getting new real citizen', sortOrder: 3 },
    { key: 'NEW_TASK_JOB', title: 'Getting new task / Getting new Job', sortOrder: 4 },
    { key: 'STUDYING_SELF', title: 'Studying self', sortOrder: 5 }
  ],
  weekly: [
    { key: 'EARNING_OUTCOME', title: 'Earning and Outcome result', sortOrder: 1 },
    { key: 'BITTENSOR_TASK', title: 'Working on Task (or Bittensor)', sortOrder: 2 },
    { key: 'NEW_CITIZEN', title: 'Getting new real citizen', sortOrder: 3 },
    { key: 'NEW_TASK_JOB', title: 'Getting new task / Getting new Job', sortOrder: 4 },
    { key: 'STUDYING_SELF', title: 'Studying self', sortOrder: 5 }
  ],
  monthly: [
    { key: 'EARNING_OUTCOME', title: 'Earning and Outcome result', sortOrder: 1 },
    { key: 'BITTENSOR_TASK', title: 'Working on Task (or Bittensor)', sortOrder: 2 },
    { key: 'NEW_CITIZEN', title: 'Getting new real citizen', sortOrder: 3 },
    { key: 'NEW_TASK_JOB', title: 'Getting new task / Getting new Job', sortOrder: 4 },
    { key: 'STUDYING_SELF', title: 'Studying self', sortOrder: 5 }
  ]
};

export const PLAN_TICKET_PERIODS = ['daily', 'weekly', 'monthly'];

/** Who a plan ticket set is for. */
export const PLAN_TICKET_AUDIENCES = ['member', 'admin'];

/**
 * Default admin plan tickets per period (seeded when none exist). Only the
 * super admin edits them afterwards. Keys start with ADMIN_ so they never
 * collide with member ticket keys.
 */
const ADMIN_TICKET_ROWS = [
  { key: 'ADMIN_TEAM_SUPPORT', title: 'Team management and member support', sortOrder: 1 },
  { key: 'ADMIN_REVIEW', title: 'Reviewing plans, reports and approvals', sortOrder: 2 },
  { key: 'ADMIN_OPERATIONS', title: 'System and operations work', sortOrder: 3 },
  { key: 'ADMIN_IMPROVEMENT', title: 'Process improvement', sortOrder: 4 },
  { key: 'ADMIN_STUDYING_SELF', title: 'Studying self', sortOrder: 5 }
];

export const ADMIN_PLAN_TICKET_DEFAULTS_BY_PERIOD = {
  daily: ADMIN_TICKET_ROWS,
  weekly: ADMIN_TICKET_ROWS,
  monthly: ADMIN_TICKET_ROWS
};

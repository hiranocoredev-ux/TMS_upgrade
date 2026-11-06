/**
 * Profile module constants — shared by User (one working role each) and Profile
 * (per-profile tabs with platform credentials).
 */

/** Every member fills exactly one of these. */
export const WORKING_ROLES = Object.freeze({
  NORMAL_WORKING: 'normal_working',
  BITTENSOR: 'bittensor',
  JOB_WORKING: 'job_working',
});

export const WORKING_ROLE_VALUES = Object.freeze(Object.values(WORKING_ROLES));

export const WORKING_ROLE_LABELS = Object.freeze({
  [WORKING_ROLES.NORMAL_WORKING]: 'Normal Working',
  [WORKING_ROLES.BITTENSOR]: 'Bittensor',
  [WORKING_ROLES.JOB_WORKING]: 'Job Working',
});

/**
 * The profile tabs each working role covers. A normal-working member works both
 * freelancing platforms and AI-training platforms, so their profiles carry both.
 * (These tab keys are what the Profile documents already use.)
 */
export const PROFILE_TAB_ROLES = Object.freeze({
  AI_TRAINING: 'ai_training',
  FREELANCING: 'freelancing',
  JOB_WORKING: 'job_working',
});

export const PROFILE_WORK_ROLE_VALUES = Object.freeze(Object.values(PROFILE_TAB_ROLES));

export const PROFILE_TABS_BY_WORKING_ROLE = Object.freeze({
  [WORKING_ROLES.NORMAL_WORKING]: [PROFILE_TAB_ROLES.FREELANCING, PROFILE_TAB_ROLES.AI_TRAINING],
  [WORKING_ROLES.JOB_WORKING]: [PROFILE_TAB_ROLES.JOB_WORKING],
  [WORKING_ROLES.BITTENSOR]: [],
});

/** Old multi-select values, mapped onto the single role. */
export const LEGACY_WORKING_ROLE_MAP = Object.freeze({
  ai_training: WORKING_ROLES.NORMAL_WORKING,
  freelancing: WORKING_ROLES.NORMAL_WORKING,
  others: WORKING_ROLES.NORMAL_WORKING,
  job_working: WORKING_ROLES.JOB_WORKING,
});

/**
 * Accounts a normal-working member can hold, in the order the summarize table
 * lists them. `short` is the column label, `reviews` marks the platforms that
 * track a review count.
 */
export const PROFILE_PLATFORMS = Object.freeze([
  { key: 'upwork_dev', label: 'Upwork Dev', short: 'Up/D', tab: PROFILE_TAB_ROLES.FREELANCING, reviews: true },
  { key: 'upwork_client', label: 'Upwork Client', short: 'Up/C', tab: PROFILE_TAB_ROLES.FREELANCING, reviews: true },
  { key: 'freelancer_dev', label: 'Freelancer Dev', short: 'Lancer', tab: PROFILE_TAB_ROLES.FREELANCING, reviews: true },
  { key: 'contra', label: 'Contra', short: 'Contra', tab: PROFILE_TAB_ROLES.FREELANCING, reviews: false },
  { key: 'snorkel', label: 'Snorkel', short: 'SN', tab: PROFILE_TAB_ROLES.AI_TRAINING, reviews: false },
  { key: 'handshake', label: 'Handshake', short: 'HS', tab: PROFILE_TAB_ROLES.AI_TRAINING, reviews: false },
  { key: 'dataannotation', label: 'DataAnnotation', short: 'DA', tab: PROFILE_TAB_ROLES.AI_TRAINING, reviews: false },
  { key: 'outlier', label: 'Outlier', short: 'OT', tab: PROFILE_TAB_ROLES.AI_TRAINING, reviews: false },
  { key: 'alignerr', label: 'Alignerr', short: 'AL', tab: PROFILE_TAB_ROLES.AI_TRAINING, reviews: false },
  { key: 'mercor', label: 'Mercor', short: 'MC', tab: PROFILE_TAB_ROLES.AI_TRAINING, reviews: false },
  { key: 'micro1', label: 'Micro1', short: 'M1', tab: PROFILE_TAB_ROLES.AI_TRAINING, reviews: false },
]);

export const PROFILE_PLATFORM_KEYS = Object.freeze(PROFILE_PLATFORMS.map((p) => p.key));

/** Accounts a job-working member holds. */
export const JOB_PROFILE_KINDS = Object.freeze([
  { key: 'caller', label: 'Caller' },
  { key: 'keeper', label: 'Keeper' },
]);

export const JOB_PROFILE_KIND_KEYS = Object.freeze(JOB_PROFILE_KINDS.map((k) => k.key));

/**
 * The profile tabs a member may work in, derived from their single working
 * role. The profile module reads these.
 */
export const workingRoleTabs = (workingRole) => [...(PROFILE_TABS_BY_WORKING_ROLE[workingRole] || [])];

/** The single role that matches an old multi-select list. */
export const workingRoleFromLegacy = (roles = []) => {
  const list = Array.isArray(roles) ? roles : [];
  if (list.includes(PROFILE_TAB_ROLES.JOB_WORKING)) return WORKING_ROLES.JOB_WORKING;
  const mapped = list.map((r) => LEGACY_WORKING_ROLE_MAP[r]).filter(Boolean);
  return mapped[0] || '';
};
/** Every account a citizen profile can hold: the platforms plus the job kinds. */
export const PROFILE_ACCOUNT_KEYS = Object.freeze([...PROFILE_PLATFORM_KEYS, ...JOB_PROFILE_KIND_KEYS]);

/** The platforms that track a review count (Upwork dev / client, Freelancer). */
export const REVIEW_PLATFORM_KEYS = Object.freeze(PROFILE_PLATFORMS.filter((p) => p.reviews).map((p) => p.key));
/** Every account is either an established profile or a fresh one. */
export const PROFILE_ACCOUNT_SIZES = Object.freeze(['big', 'new']);
export const DEFAULT_PROFILE_ACCOUNT_SIZE = 'new';

export const PROFILE_STATUSES = Object.freeze(['active', 'archived']);

/**
 * Lifecycle of a platform credential inside a working-role tab (Freelancing /
 * AI Training). Tracks whether the account is freshly created, actively worked,
 * parked, or banned/closed.
 */
export const PLATFORM_CREDENTIAL_STATUSES = Object.freeze([
  'new',
  'using',
  'not_using',
  'dead',
]);

export const DEFAULT_PLATFORM_CREDENTIAL_STATUS = 'new';

export const REMOTE_TOOLS = Object.freeze(['anydesk', 'chrome_remote_desktop', 'custom']);

export const BUYER_TYPES = Object.freeze(['user', 'client']);

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_CODES = Object.freeze([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'KRW', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD',
]);

export const PROFILE_SEX_VALUES = Object.freeze(['', 'male', 'female', 'other']);

export const PAYMENT_METHOD_KINDS = Object.freeze([
  'paypal',
  'payoneer',
  'wise',
  'crypto',
  'bank',
  'other',
]);

export const CONTACT_HANDLE_PLATFORMS = Object.freeze([
  'telegram',
  'gmail',
  'whatsapp',
  'discord',
  'custom',
]);

/**
 * Sensitive bits that can be revealed via audit-logged endpoints. Currently
 * only "tab_devices" — the encrypted remote credentials (id + password) on
 * device items inside each working-role tab.
 */
export const REVEALABLE_SECTIONS = Object.freeze([
  'tab_devices',
]);

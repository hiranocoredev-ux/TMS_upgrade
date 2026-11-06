/**
 * Profile module constants — mirrors server/src/constants/profiles.js.
 * Keep these in sync if you change the server enums.
 */

export const PROFILE_STATUSES = Object.freeze(['active', 'archived']);

/**
 * Lifecycle of a platform credential inside a working-role tab (Freelancing /
 * AI Training). Mirrors PLATFORM_CREDENTIAL_STATUSES on the server.
 */
export const PLATFORM_CREDENTIAL_STATUSES = Object.freeze([
  'new',
  'using',
  'not_using',
  'dead',
]);

export const DEFAULT_PLATFORM_CREDENTIAL_STATUS = 'new';

export const PLATFORM_CREDENTIAL_STATUS_LABELS = Object.freeze({
  new: 'New',
  using: 'Using',
  not_using: 'Not Using',
  dead: 'Dead',
});

/** Chip accent per credential status — blue new, green live, amber parked, red dead. */
export const PLATFORM_CREDENTIAL_STATUS_ACCENTS = Object.freeze({
  new: '#3b82f6',
  using: '#10b981',
  not_using: '#f59e0b',
  dead: '#ef4444',
});

export const STATUS_SCORE_MAX = 5;

export const PROFILE_SEX_VALUES = Object.freeze(['', 'male', 'female', 'other']);

/** Every member fills exactly one of these. */
export const WORKING_ROLES = Object.freeze({
  NORMAL_WORKING: 'normal_working',
  BITTENSOR: 'bittensor',
  JOB_WORKING: 'job_working',
});

export const WORKING_ROLE_VALUES = Object.freeze(Object.values(WORKING_ROLES));

/** The profile tabs a Profile document can carry. */
export const PROFILE_TAB_ROLES = Object.freeze({
  AI_TRAINING: 'ai_training',
  FREELANCING: 'freelancing',
  JOB_WORKING: 'job_working',
});

export const PROFILE_WORK_ROLE_VALUES = Object.freeze(Object.values(PROFILE_TAB_ROLES));

/** A normal-working member works freelancing and AI-training platforms together. */
export const PROFILE_TABS_BY_WORKING_ROLE = Object.freeze({
  [WORKING_ROLES.NORMAL_WORKING]: [PROFILE_TAB_ROLES.FREELANCING, PROFILE_TAB_ROLES.AI_TRAINING],
  [WORKING_ROLES.JOB_WORKING]: [PROFILE_TAB_ROLES.JOB_WORKING],
  [WORKING_ROLES.BITTENSOR]: [],
});

export const WORKING_ROLE_LABELS = Object.freeze({
  normal_working: 'Normal Working',
  bittensor: 'Bittensor',
  job_working: 'Job Working',
  // legacy values, still shown on old records
  ai_training: 'AI Training',
  freelancing: 'Freelancing',
  others: 'Others',
});

export const WORKING_ROLE_ICONS = Object.freeze({
  normal_working: '💼',
  bittensor: '⛓️',
  job_working: '🤝',
  ai_training: '🧠',
  freelancing: '💼',
  others: '✨',
});

/** Accounts a normal-working member can hold (mirrors the server catalog). */
export const PROFILE_PLATFORMS = Object.freeze([
  { key: 'upwork_dev', label: 'Upwork Dev', short: 'Up/D', tab: 'freelancing', reviews: true },
  { key: 'upwork_client', label: 'Upwork Client', short: 'Up/C', tab: 'freelancing', reviews: true },
  { key: 'freelancer_dev', label: 'Freelancer Dev', short: 'Lancer', tab: 'freelancing', reviews: true },
  { key: 'contra', label: 'Contra', short: 'Contra', tab: 'freelancing', reviews: false },
  { key: 'snorkel', label: 'Snorkel', short: 'SN', tab: 'ai_training', reviews: false },
  { key: 'handshake', label: 'Handshake', short: 'HS', tab: 'ai_training', reviews: false },
  { key: 'dataannotation', label: 'DataAnnotation', short: 'DA', tab: 'ai_training', reviews: false },
  { key: 'outlier', label: 'Outlier', short: 'OT', tab: 'ai_training', reviews: false },
  { key: 'alignerr', label: 'Alignerr', short: 'AL', tab: 'ai_training', reviews: false },
  { key: 'mercor', label: 'Mercor', short: 'MC', tab: 'ai_training', reviews: false },
  { key: 'micro1', label: 'Micro1', short: 'M1', tab: 'ai_training', reviews: false },
]);

/** Accounts a job-working member holds. */
export const JOB_PROFILE_KINDS = Object.freeze([
  { key: 'caller', label: 'Caller' },
  { key: 'keeper', label: 'Keeper' },
]);

/** Every account is either an established profile or a fresh one. */
export const PROFILE_ACCOUNT_SIZES = Object.freeze(['big', 'new']);
export const PROFILE_ACCOUNT_SIZE_LABELS = Object.freeze({ big: 'Big profile', new: 'New profile' });

export const REMOTE_TOOLS = Object.freeze(['anydesk', 'chrome_remote_desktop', 'custom']);

export const REMOTE_TOOL_LABELS = Object.freeze({
  anydesk: 'AnyDesk',
  chrome_remote_desktop: 'Chrome Remote Desktop',
  custom: 'Custom tool',
});

export const REMOTE_TOOL_ICONS = Object.freeze({
  anydesk: '🟦',
  chrome_remote_desktop: '🌐',
  custom: '🛠️',
});

export const BUYER_TYPES = Object.freeze(['user', 'client']);

export const BUYER_TYPE_LABELS = Object.freeze({
  user: 'Team member',
  client: 'Bought by client',
});

export const DEFAULT_CURRENCY = 'USD';

export const CURRENCY_CODES = Object.freeze([
  'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'INR', 'KRW', 'AUD', 'CAD', 'CHF', 'SGD', 'HKD',
]);

export const CURRENCY_SYMBOLS = Object.freeze({
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CNY: '¥', INR: '₹', KRW: '₩',
  AUD: 'A$', CAD: 'C$', CHF: 'Fr', SGD: 'S$', HKD: 'HK$',
});

export const PAYMENT_METHOD_KINDS = Object.freeze([
  'paypal',
  'payoneer',
  'wise',
  'crypto',
  'bank',
  'other',
]);

export const PAYMENT_METHOD_LABELS = Object.freeze({
  paypal: 'PayPal',
  payoneer: 'Payoneer',
  wise: 'Wise',
  crypto: 'Crypto wallet',
  bank: 'Bank transfer',
  other: 'Other',
});

export const CONTACT_HANDLE_PLATFORMS = Object.freeze([
  'telegram',
  'gmail',
  'whatsapp',
  'discord',
  'custom',
]);

export const CONTACT_HANDLE_LABELS = Object.freeze({
  telegram: 'Telegram',
  gmail: 'Gmail',
  whatsapp: 'WhatsApp',
  discord: 'Discord',
  custom: 'Custom',
});

/**
 * Brand-image paths for handle platforms. Files live under
 * `client/public/communication-icons/*.png` and resolve from the site root.
 * Custom falls back to an emoji glyph (no asset).
 */
export const CONTACT_HANDLE_ICON_URLS = Object.freeze({
  telegram: '/communication-icons/telegram.png',
  gmail: '/communication-icons/gmail.png',
  whatsapp: '/communication-icons/whatsapp.png',
  discord: '/communication-icons/discord.png',
});

/** Emoji fallback (used only when no PNG exists, i.e. `custom`). */
export const CONTACT_HANDLE_ICONS = Object.freeze({
  telegram: '✈️',
  gmail: '📧',
  whatsapp: '💬',
  discord: '🎮',
  custom: '🔗',
});

/** Color accents for handle badges, used as the chip background. */
export const CONTACT_HANDLE_ACCENTS = Object.freeze({
  telegram: '#0088cc',
  gmail: '#ea4335',
  whatsapp: '#25d366',
  discord: '#5865f2',
  custom: '#64748b',
});

export const REVEALABLE_SECTIONS = Object.freeze([
  'tab_devices',
]);

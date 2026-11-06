/**
 * Group constants (client)
 * Mirrors server/src/constants/groups.js for assignments, profiles, and users.
 */

/** Options for assignments, job profiles, freelancer accounts (value + label) */
export const ENTITY_GROUP_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'GROUP_1', label: 'Group 1' },
  { value: 'GROUP_2', label: 'Group 2' },
  { value: 'GROUP_3', label: 'Group 3' },
  { value: 'GROUP_4', label: 'Group 4' }
];

/** Options for user management (value + label) */
export const USER_GROUP_OPTIONS = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'GROUP_1', label: 'Group 1' },
  { value: 'GROUP_2', label: 'Group 2' },
  { value: 'GROUP_3', label: 'Group 3' },
  { value: 'GROUP_4', label: 'Group 4' }
];

/** Raw values for entity group (assignments, profiles) */
export const ENTITY_GROUP_VALUES = ENTITY_GROUP_OPTIONS.map((o) => o.value);

/** Raw values for user group */
export const USER_GROUP_VALUES = USER_GROUP_OPTIONS.map((o) => o.value);

export const DEFAULT_ENTITY_GROUP = 'NONE';
export const DEFAULT_USER_GROUP = 'GROUP_1';

/**
 * Format group value for display (e.g. GROUP_1 -> Group 1).
 * Safe for null/undefined.
 */
export function formatGroupLabel(group) {
  if (group == null || group === '') return '-';
  const option = ENTITY_GROUP_OPTIONS.find((o) => o.value === group)
    || USER_GROUP_OPTIONS.find((o) => o.value === group);
  if (option) return option.label;
  return String(group)
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

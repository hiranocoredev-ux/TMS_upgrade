/**
 * Group constants (server)
 *
 * - ENTITY_GROUPS: Used for Assignments, JobProfile, FreelancerAccount (NONE + GROUP_1..4)
 * - USER_GROUPS: Used for User model (SUPER_ADMIN, ADMIN + GROUP_1..4)
 * To add a new group, add the value here and to the client constants; then run any DB migrations if needed.
 */

export const ENTITY_GROUP_VALUES = ['NONE', 'GROUP_1', 'GROUP_2', 'GROUP_3', 'GROUP_4'];

export const USER_GROUP_VALUES = ['SUPER_ADMIN', 'ADMIN', 'GROUP_1', 'GROUP_2', 'GROUP_3', 'GROUP_4'];

/** Default group for new assignments/profiles when not specified */
export const DEFAULT_ENTITY_GROUP = 'NONE';

/** Default group for new users when not specified */
export const DEFAULT_USER_GROUP = 'GROUP_1';

/**
 * Canonical role model (3 roles)
 *
 * - SUPER_ADMIN: full system access (your “team boss” / platform owner)
 * - GROUP_BOSS: boss of one group (team lead within their group)
 * - GROUP_MEMBER: normal member within a group
 *
 * Legacy values in DB (ADMIN, BOSS, MEMBER, GUEST, TEAM_BOSS degree, etc.)
 * are normalized via normalizeRole().
 */

export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  GROUP_BOSS: 'GROUP_BOSS',
  GROUP_MEMBER: 'GROUP_MEMBER',
};

/** Old role strings still encountered in tokens / DB */
export const LEGACY_ROLES = {
  ADMIN: 'ADMIN',
  BOSS: 'BOSS',
  MEMBER: 'MEMBER',
  GUEST: 'GUEST',
};

const ALL_CANONICAL = Object.values(ROLES);

/**
 * Map stored role (+ optional legacy degree) to a canonical role.
 * @param {string} [role]
 * @param {string} [degree] legacy User.degree when still present in DB
 */
export const normalizeRole = (role, degree) => {
  const r = role ? String(role) : '';
  const d = degree ? String(degree) : '';

  if (r === ROLES.SUPER_ADMIN) return ROLES.SUPER_ADMIN;
  if (r === ROLES.GROUP_BOSS) return ROLES.GROUP_BOSS;
  if (r === ROLES.GROUP_MEMBER) return ROLES.GROUP_MEMBER;

  // Legacy fallback only when canonical role is not explicitly set.
  if (d === 'TEAM_BOSS') return ROLES.SUPER_ADMIN;
  if (d === 'SUPER_ADMIN') return ROLES.SUPER_ADMIN;

  if (r === LEGACY_ROLES.ADMIN || r === LEGACY_ROLES.BOSS) return ROLES.GROUP_BOSS;

  if (
    r === LEGACY_ROLES.MEMBER ||
    r === LEGACY_ROLES.GUEST ||
    r === ''
  ) {
    return ROLES.GROUP_MEMBER;
  }

  if (ALL_CANONICAL.includes(r)) return r;
  return ROLES.GROUP_MEMBER;
};

/** Super-admin only */
export const OVERRIDE_ROLES = [ROLES.SUPER_ADMIN];

/** Can manage users/groups / cross-cutting admin (not necessarily every module) */
export const PLATFORM_ADMIN_ROLES = [ROLES.SUPER_ADMIN];

/** Group-level leadership (old ADMIN/BOSS) */
export const GROUP_LEADER_ROLES = [ROLES.SUPER_ADMIN, ROLES.GROUP_BOSS];

export const isSuperAdminRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.SUPER_ADMIN;

export const isGroupBossRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.GROUP_BOSS;

export const isGroupMemberRole = (role, degree) =>
  normalizeRole(role, degree) === ROLES.GROUP_MEMBER;

export const isValidRole = (role) =>
  ALL_CANONICAL.includes(role);

/**
 * "Admin" in legacy terms: super admin or group boss (team lead).
 * Used for module-level management within a group.
 */
export const isAdminRole = (role, degree) =>
  GROUP_LEADER_ROLES.includes(normalizeRole(role, degree));

/** Only super admin may bypass ownership / global rules */
export const canOverrideOwnership = (role, degree) =>
  isSuperAdminRole(role, degree);

/** Can view team-level summaries (not necessarily unmasked PII) */
export const canViewTeamData = (role, degree) =>
  GROUP_LEADER_ROLES.includes(normalizeRole(role, degree));

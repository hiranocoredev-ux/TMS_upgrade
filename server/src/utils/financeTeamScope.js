import { ROLES, normalizeRole, isSuperAdminRole } from "../constants/roles.js";
import { hasAdminPrivileges } from "./roleMapper.js";
import User from "../models/User.js";

/** Groups that can see/edit finance across all teams */
export const FINANCE_META_GROUPS = new Set(["SUPER_ADMIN", "ADMIN"]);

export function isGlobalFinanceViewer(user) {
  if (!user) return false;
  if (isSuperAdminRole(user.role, user.degree)) return true;
  const g = user.group;
  return !!(g && FINANCE_META_GROUPS.has(g));
}

/**
 * Finance overview metrics + all-groups summary: platform admins and legacy Team Boss (maps to SUPER_ADMIN).
 */
export function isCrossTeamFinanceOverviewViewer(user) {
  if (!user) return false;
  if (isGlobalFinanceViewer(user)) return true;
  return isSuperAdminRole(user.role, user.degree);
}

export async function getUserIdsInGroup(group) {
  if (!group || FINANCE_META_GROUPS.has(group)) return [];
  const rows = await User.find({ group }).select("_id").lean();
  return rows.map((r) => r._id);
}

/**
 * Resolves MongoDB userId filter for finance list endpoints.
 * @param {string} [groupId] - When viewer is SUPER_ADMIN / meta-group admin: restrict to users in this team (code). Ignored for non-global viewers.
 * @returns {{ userId?: unknown } | null} null = respond 403 with body from error
 */
export async function resolveFinanceListUserIdFilter(
  user,
  memberId,
  groupId,
) {
  const globalViewer = isGlobalFinanceViewer(user);

  if (globalViewer) {
    const g =
      groupId && String(groupId).trim() && String(groupId).trim() !== "all"
        ? String(groupId).trim()
        : null;

    if (g) {
      const teamIds = await getUserIdsInGroup(g);
      if (teamIds.length === 0) {
        return { userId: { $in: [] } };
      }
      if (memberId) {
        const ok = teamIds.some((id) => id.toString() === String(memberId));
        if (!ok) {
          return null;
        }
        return { userId: memberId };
      }
      return { userId: { $in: teamIds } };
    }

    if (memberId) {
      return { userId: memberId };
    }
    return {};
  }

  // Group boss AND plain member: scoped to their own group. Members get
  // read-only visibility into their group's transactions (write endpoints stay
  // behind requireFinanceManager); a member can drill into any teammate.
  const teamIds = await getUserIdsInGroup(user.group);
  const idStrs = new Set(teamIds.map((id) => id.toString()));

  if (memberId) {
    if (!idStrs.has(memberId)) {
      return null;
    }
    return { userId: memberId };
  }

  if (teamIds.length === 0) {
    return { userId: user._id };
  }
  return { userId: { $in: teamIds } };
}

export async function assertTransactionOwnerInFinanceScope(reqUser, ownerUserId) {
  const globalViewer = isGlobalFinanceViewer(reqUser);
  if (globalViewer) return true;

  // Group boss AND plain member can view any transaction in their own group.
  const owner = await User.findById(ownerUserId).select("group").lean();
  if (!owner) return false;
  return owner.group === reqUser.group;
}

export async function assertUserIdInFinanceScope(reqUser, targetUserId) {
  if (!targetUserId) return false;
  const globalViewer = isGlobalFinanceViewer(reqUser);
  if (globalViewer) return true;

  const target = await User.findById(targetUserId).select("group").lean();
  if (!target) return false;

  const norm = normalizeRole(reqUser.role, reqUser.degree);
  if (norm === ROLES.GROUP_MEMBER) {
    return targetUserId.toString() === reqUser._id.toString();
  }

  const reqGroup = reqUser.group;
  if (reqGroup && !FINANCE_META_GROUPS.has(reqGroup)) {
    return target.group === reqGroup;
  }
  return true;
}

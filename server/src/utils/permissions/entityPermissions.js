/**
 * Entity-Specific Permission Helpers
 * 
 * Provides ownership-first permission checks for each entity type
 * Uses the base permission helpers from ../permissions.js
 */

import { 
  canView, 
  canEdit, 
  canDelete, 
  canCreate, 
  isOwner,
  getPermissions 
} from '../permissions.js';
import { ROLES } from '../../constants/roles.js';
import { hasAdminPrivileges } from '../roleMapper.js';
import dotenv from 'dotenv';

dotenv.config();

const BOSS_CAN_EDIT_PROJECTS = process.env.BOSS_CAN_EDIT_PROJECTS === 'true';

/**
 * Profile permission helpers (client profile module).
 *
 * Users can hold MULTIPLE working roles. The 4 personas drive access:
 *
 *   - SUPER_ADMIN              — full read/write everywhere.
 *   - GROUP_BOSS               — read/write all common sections (Base / Contact /
 *                                Contract); read/write any tab whose role appears
 *                                in their own `user.workingRoles[]`.
 *   - Hunting-profile user     — i.e. user whose `workingRoles[]` includes
 *                                `hunting_profile`. May CREATE new profiles, sees
 *                                common+credentials on any profile. Can edit common
 *                                only on profiles they OWN (huntingOwnerId === user._id).
 *                                Tabs are NOT accessible via the hunting role alone —
 *                                but a user who is e.g. hunting + freelancing still
 *                                gets freelancing-tab access via the freelancing role.
 *   - Regular GROUP_MEMBER     — read-only on Base Information. Hidden from
 *                                Contact / Contract. Can read a tab only if listed
 *                                as an ACTIVE manager of that tab.
 *
 * Per-tab platform credentials have a second-layer ACL: even a viewer of the tab
 * can only reveal a specific credential's gmail+password if they are listed as an
 * active member of that credential — OR if they're a tab editor (super admin or
 * group boss whose workingRoles includes the tab's role).
 */
const WORKING_ROLE_HUNTING = 'hunting_profile';

const userRoles = (user) => (user && Array.isArray(user.workingRoles)) ? user.workingRoles : [];
const isSuperAdmin = (user) => !!user && user.role === ROLES.SUPER_ADMIN;
const isGroupBoss = (user) => !!user && hasAdminPrivileges(user); // GROUP_BOSS + legacy ADMIN/BOSS
const isHuntingProfile = (user) => userRoles(user).includes(WORKING_ROLE_HUNTING);

/** Group boss who carries this specific role in their workingRoles[]. */
const isGroupBossOfRole = (user, role) => isGroupBoss(user) && userRoles(user).includes(role);

/** True if `user` originally hunted this profile (immutable `huntingOwnerId`). */
const isHuntingOwnerOf = (user, profile) => {
  if (!user || !profile) return false;
  const owner = profile.huntingOwnerId && profile.huntingOwnerId._id
    ? profile.huntingOwnerId._id
    : profile.huntingOwnerId;
  return !!owner && String(owner) === String(user._id);
};

/** True if `user` is the profile's current owner (the reassignable `ownerUserId`). */
const isCurrentOwnerOf = (user, profile) => {
  if (!user || !profile) return false;
  const owner = profile.ownerUserId && profile.ownerUserId._id
    ? profile.ownerUserId._id
    : profile.ownerUserId;
  return !!owner && String(owner) === String(user._id);
};

/**
 * Ownership for permission purposes. `ownerUserId` is reassignable, so handing a
 * profile to another hunting-profile member must actually grant them access.
 * `huntingOwnerId` still grants too: it records who originally hunted the client
 * and a reassignment shouldn't lock the creator out of their own record.
 */
const ownsProfile = (user, profile) =>
  isCurrentOwnerOf(user, profile) || isHuntingOwnerOf(user, profile);

/** True if `user` is listed as an active manager on the tab with this `role`. */
const isActiveManager = (user, profile, role) => {
  if (!user || !profile) return false;
  const tab = (profile.workingRoleTabs || []).find((t) => String(t.role) === String(role));
  if (!tab) return false;
  const uid = String(user._id);
  return (tab.managers || []).some((m) => {
    if (!m) return false;
    const mid = (m.userId && m.userId._id) ? String(m.userId._id) : String(m.userId || '');
    return mid === uid && !!m.isActive;
  });
};

/** True if `user` is listed as an active member of a specific platform credential. */
const isActivePlatformMember = (user, profile, role, credentialId) => {
  if (!user || !profile || !credentialId) return false;
  const tab = (profile.workingRoleTabs || []).find((t) => String(t.role) === String(role));
  if (!tab) return false;
  const cred = (tab.platformCredentials || []).find((c) => String(c._id) === String(credentialId));
  if (!cred) return false;
  const uid = String(user._id);
  return (cred.allowedMembers || []).some((m) => {
    if (!m) return false;
    const mid = (m.userId && m.userId._id) ? String(m.userId._id) : String(m.userId || '');
    return mid === uid && !!m.isActive;
  });
};

const canViewBase = () => true; // always

/**
 * Common-section edit gate. Super admin + group boss always. Hunting-profile
 * users can edit ONLY profiles they own (huntingOwnerId === their id).
 */
const canEditBase = (user, profile) => {
  if (isSuperAdmin(user) || isGroupBoss(user)) return true;
  if (isHuntingProfile(user) && profile && ownsProfile(user, profile)) return true;
  return false;
};

/**
 * Read access to private sections (Contact + Contract / credentials).
 * SUPER_ADMIN and GROUP_BOSS always; a hunting-profile user only on profiles
 * they own. Without the ownership gate, hunting users could read every
 * client's contact + contract info across the org.
 */
const canViewCredentials = (user, profile) => {
  if (isSuperAdmin(user) || isGroupBoss(user)) return true;
  if (isHuntingProfile(user) && profile && ownsProfile(user, profile)) return true;
  return false;
};
const canEditCredentials = (user, profile) => canEditBase(user, profile);

const canViewTab = (user, profile, role) => {
  if (isSuperAdmin(user)) return true;
  if (isGroupBossOfRole(user, role)) return true;
  return isActiveManager(user, profile, role);
};
const canEditTab = (user, profile, role) => {
  if (isSuperAdmin(user)) return true;
  return isGroupBossOfRole(user, role);
};
const canRevealTabDevices = (user, profile, role) => canEditTab(user, profile, role);
const canManageTabTransactions = (user, profile, role) => canEditTab(user, profile, role);

/** Reveal a single platform credential's gmail+password. */
const canRevealPlatformCredential = (user, profile, role, credentialId) => {
  if (canEditTab(user, profile, role)) return true;
  if (!canViewTab(user, profile, role)) return false;
  return isActivePlatformMember(user, profile, role, credentialId);
};

/**
 * Delete permission. Super admin + group boss always; hunting-profile users
 * can delete only profiles they own.
 */
const canDeleteProfile = (user, profile) => {
  if (isSuperAdmin(user) || isGroupBoss(user)) return true;
  if (isHuntingProfile(user) && profile && ownsProfile(user, profile)) return true;
  return false;
};

/**
 * Per-profile read gate used by the list/detail endpoints. Hunting-profile
 * users (without admin role) are restricted to profiles they own OR profiles
 * where they appear as an active tab manager (multi-role case). SUPER_ADMIN
 * and GROUP_BOSS see everything. Non-hunting users keep the existing "all
 * profiles' base info is visible" behaviour.
 */
const canViewProfile = (user, profile) => {
  if (isSuperAdmin(user) || isGroupBoss(user)) return true;
  if (!isHuntingProfile(user)) return true;
  if (!profile) return false;
  if (ownsProfile(user, profile)) return true;
  const uid = String(user && user._id);
  return (profile.workingRoleTabs || []).some((tab) =>
    (tab.managers || []).some((m) => {
      if (!m || !m.isActive) return false;
      const mid = (m.userId && m.userId._id) ? String(m.userId._id) : String(m.userId || '');
      return mid === uid;
    })
  );
};

/**
 * Mongo filter that scopes a Profile.find() to the records `user` is allowed
 * to read. Returns `{}` for admins. For a hunting-profile user, restricts to
 * profiles they own (current owner or original hunter) + profiles where they
 * are listed as an active tab manager.
 */
const listVisibilityFilter = (user) => {
  if (isSuperAdmin(user) || isGroupBoss(user)) return {};
  if (!isHuntingProfile(user)) return {};
  if (!user || !user._id) return { _id: null };
  return {
    $or: [
      { ownerUserId: user._id },
      { huntingOwnerId: user._id },
      { 'workingRoleTabs.managers': { $elemMatch: { userId: user._id, isActive: true } } },
    ],
  };
};

export const profilePermissions = {
  // Coarse gates ------------------------------------------------------------
  canView: canViewProfile,
  canCreate: (user) => isSuperAdmin(user) || isGroupBoss(user) || isHuntingProfile(user),
  canDelete: canDeleteProfile,
  listVisibilityFilter,

  /** Coarse "can edit at least one piece" gate for the /edit page. */
  canEdit: (user, profile) => {
    if (canEditBase(user, profile)) return { canEdit: true };
    const roles = (profile && profile.workingRoles) || [];
    if (roles.some((r) => canEditTab(user, profile, r))) return { canEdit: true };
    return { canEdit: false, reason: 'You do not have permission to edit this profile' };
  },

  // Fine-grained per-section ------------------------------------------------
  canViewBase,
  canEditBase,
  canViewContact: canViewCredentials,
  canEditContact: canEditCredentials,
  canViewContract: canViewCredentials,
  canEditContract: canEditCredentials,

  // Per-tab -----------------------------------------------------------------
  canViewTab,
  canEditTab,
  canRevealTab: canRevealTabDevices,
  canManageTransactions: canManageTabTransactions,

  // Platform credentials ----------------------------------------------------
  canRevealPlatformCredential,

  /** Single permissions object returned alongside the profile to drive UI. */
  getPermissions: (user, profile) => {
    const roles = (profile && profile.workingRoles) || [];
    const tabs = {};
    for (const r of roles) {
      tabs[r] = {
        canView: canViewTab(user, profile, r),
        canEdit: canEditTab(user, profile, r),
        canRevealDevices: canRevealTabDevices(user, profile, r),
        canManageTransactions: canManageTabTransactions(user, profile, r),
      };
    }
    const editBase = canEditBase(user, profile);
    return {
      canView: true,
      canCreate: isSuperAdmin(user) || isGroupBoss(user) || isHuntingProfile(user),
      canDelete: canDeleteProfile(user, profile),
      canEditBase: editBase,
      canViewContact: canViewCredentials(user, profile),
      canEditContact: canEditCredentials(user, profile),
      canViewContract: canViewCredentials(user, profile),
      canEditContract: canEditCredentials(user, profile),
      canManageTransactions: roles.some((r) => canManageTabTransactions(user, profile, r)),
      isHuntingOwner: isHuntingOwnerOf(user, profile),
      tabs,
      canEditAny: editBase || roles.some((r) => canEditTab(user, profile, r)),
    };
  },
};

/**
 * JobTicket Permission Helpers
 */
export const jobTicketPermissions = {
  canView: (user, ticket) => {
    // All authenticated users can view all tickets (no assignedUserId filtering)
    return true;
  },

  canEdit: (user, ticket) => {
    // Admin can edit
    if (hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN) {
      return { canEdit: true };
    }

    // All authenticated users can edit tickets
    return { canEdit: true };
  },

  canDelete: (user, ticket) => {
    // Only admin can delete
    return canDelete(user, ticket, {
      requireAdmin: true
    });
  },

  canCreate: (user) => {
    // Anyone authenticated can create tickets
    return canCreate(user, {
      allowMember: true,
      allowAdmin: true
    });
  },

  getPermissions: (user, ticket) => {
    return {
      canView: true,
      canEdit: jobTicketPermissions.canEdit(user, ticket).canEdit,
      canDelete: jobTicketPermissions.canDelete(user, ticket),
      isOwner: false
    };
  }
};

/**
 * Project Permission Helpers
 */
export const projectPermissions = {
  canView: (user, project) => {
    return canView(user, project, {
      ownerField: 'ownerUserId',
      collaboratorField: 'collaboratorUserIds',
      allowAdmin: true,
      allowCollaborator: true
    });
  },

  canEdit: (user, project) => {
    // Owner can always edit
    if (isOwner(user, project, 'ownerUserId')) {
      return { canEdit: true };
    }

    // Collaborators can edit (for tasks within the project)
    if (project.collaboratorUserIds && Array.isArray(project.collaboratorUserIds)) {
      const isCollaborator = project.collaboratorUserIds.some(
        id => id.toString() === user._id.toString()
      );
      if (isCollaborator) {
        return { canEdit: true, reason: 'Collaborator access' };
      }
    }

    // Admin can edit based on env
    if (hasAdminPrivileges(user)) {
      if (BOSS_CAN_EDIT_PROJECTS || user.role === ROLES.SUPER_ADMIN) {
        return { canEdit: true };
      }
    }

    return { canEdit: false, reason: 'Only owner, collaborator, or admin (if enabled) can edit' };
  },

  canDelete: (user, project) => {
    // Owner can delete
    if (isOwner(user, project, 'ownerUserId')) {
      return true;
    }

    // SUPER_ADMIN can delete
    if (user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    return false;
  },

  canCreate: (user) => {
    // Members can create their own projects
    return canCreate(user, {
      allowMember: true,
      allowAdmin: true
    });
  },

  getPermissions: (user, project) => {
    return getPermissions(user, project, {
      ownerField: 'ownerUserId',
      collaboratorField: 'collaboratorUserIds',
      allowAdmin: true,
      allowCollaborator: true
    });
  }
};

/**
 * Task Permission Helpers
 */
export const taskPermissions = {
  canView: (user, task, project) => {
    // Use project permissions for task access
    if (project) {
      return projectPermissions.canView(user, project);
    }
    // Fallback: anyone can view if project is accessible (will need project lookup)
    return true;
  },

  canEdit: (user, task, project) => {
    // Use project permissions for task edit
    if (project) {
      return projectPermissions.canEdit(user, project);
    }
    return { canEdit: false, reason: 'Project context required' };
  },

  canDelete: (user, task, project) => {
    // Use project permissions for task delete
    if (project) {
      return projectPermissions.canDelete(user, project);
    }
    return false;
  },

  canCreate: (user, project) => {
    // Use project permissions for task create
    if (project) {
      return projectPermissions.canEdit(user, project).canEdit;
    }
    return false;
  }
};

/**
 * Interview Permission Helpers
 */
export const interviewPermissions = {
  canView: (user, interview) => {
    // Admin can view all
    if (hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    // Creator can view
    if (interview.createdByUserId && interview.createdByUserId.toString() === user._id.toString()) {
      return true;
    }

    // All authenticated users can view all interviews
    return true;
  },

  canEdit: (user, interview) => {
    // Admin can edit
    if (hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN) {
      return { canEdit: true };
    }

    // Creator can edit
    if (interview.createdByUserId && interview.createdByUserId.toString() === user._id.toString()) {
      return { canEdit: true };
    }

    return { canEdit: false, reason: 'Insufficient permissions' };
  },

  canDelete: (user, interview) => {
    // Admin can delete
    if (hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    // Creator can delete
    if (interview.createdByUserId && interview.createdByUserId.toString() === user._id.toString()) {
      return true;
    }

    return false;
  },

  canCreate: (user) => {
    // Anyone authenticated can create interviews
    return canCreate(user, {
      allowMember: true,
      allowAdmin: true
    });
  }
};

/**
 * FinanceTransaction Permission Helpers
 */
export const financeTransactionPermissions = {
  canView: (user, transaction) => {
    // Owner can view
    if (isOwner(user, transaction, 'userId')) {
      return true;
    }

    // Admin can view all
    if (hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    return false;
  },

  canEdit: (user, transaction) => {
    // Owner can edit
    if (isOwner(user, transaction, 'userId')) {
      return { canEdit: true };
    }

    // Admin can edit
    if (hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN) {
      return { canEdit: true };
    }

    return { canEdit: false, reason: 'Insufficient permissions' };
  },

  canDelete: (user, transaction) => {
    // Owner can delete
    if (isOwner(user, transaction, 'userId')) {
      return true;
    }

    // Admin can delete
    if (hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN) {
      return true;
    }

    return false;
  },

  canCreate: (user) => {
    // Members can create their own transactions
    return canCreate(user, {
      allowMember: true,
      allowAdmin: true
    });
  },

  canApprove: (user, transaction) => {
    // Only admin can approve
    return hasAdminPrivileges(user) || user.role === ROLES.SUPER_ADMIN;
  }
};


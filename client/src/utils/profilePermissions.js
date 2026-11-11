/**
 * Profile Permission Helpers
 *
 * Centralized permission checking for JobProfile, FreelancerProfile, and PersonalProfile
 */

import { normalizeRole, ROLES } from '../constants/roles.js';

const isOwner = (user, profile) => {
  if (!user || !profile) return false;
  const ownerId = profile.ownerUserId?._id || profile.ownerUserId;
  return ownerId === user._id;
};

const isGroupBossOrSuper = (user) => {
  if (!user?.role) return false;
  const r = normalizeRole(user.role, user.degree);
  return r === ROLES.GROUP_BOSS || r === ROLES.SUPER_ADMIN || r === ROLES.SYSTEM_ADMIN;
};

export const canViewJobProfile = (user, profile) => {
  return !!user;
};

export const canEditJobProfile = (user, profile) => {
  if (!user || !profile) return false;
  const owner = isOwner(user, profile);
  return owner || isGroupBossOrSuper(user);
};

export const canDeleteJobProfile = (user, profile) => {
  if (!user || !profile) return false;
  const owner = isOwner(user, profile);
  return owner || isGroupBossOrSuper(user);
};

export const canCreateJobProfile = (user) => {
  return !!user;
};

export const canViewFreelancerProfile = (user, profile) => {
  if (!user || !profile) return false;
  const owner = isOwner(user, profile);
  return owner || isGroupBossOrSuper(user);
};

export const canEditFreelancerProfile = (user, profile) => {
  if (!user || !profile) return false;
  const owner = isOwner(user, profile);
  return owner || isGroupBossOrSuper(user);
};

export const canDeleteFreelancerProfile = (user, profile) => {
  if (!user || !profile) return false;
  const owner = isOwner(user, profile);
  return owner || isGroupBossOrSuper(user);
};

export const canCreateFreelancerProfile = (user) => {
  if (!user) return false;
  return isGroupBossOrSuper(user);
};

export const canViewPersonalProfile = (user, profile) => {
  if (!user || !profile) return false;
  const owner = isOwner(user, profile);
  return owner || isGroupBossOrSuper(user);
};

export const canEditPersonalProfile = (user, profile) => {
  if (!user || !profile) return false;
  return isOwner(user, profile);
};

export const canDeletePersonalProfile = (user, profile) => {
  if (!user || !profile) return false;
  return isOwner(user, profile);
};

export const canCreatePersonalProfile = (user) => {
  return !!user;
};

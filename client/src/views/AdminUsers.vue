<template>
  <div class="admin-users-view">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>User Management</h1>
          <p class="subtitle">Manage team members and permissions</p>
        </div>
        <div class="header-actions">
          <button @click="openCreateModal" class="btn-primary">
            + Add User
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading users...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadUsers" class="btn-retry">Retry</button>
    </div>

    <!-- Users Table -->
    <div v-else class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Hubstaff ID</th>
            <th>Group</th>
            <th>Role</th>
            <th>Status</th>
            <th>Working Role</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in sortedUsers" :key="user.id">
            <td>
              <div class="user-cell">
                <UserAvatar :name="user.name" :profile-image="user.avatarUrl" :size="28" :tooltip="false" />
                <span>{{ user.name }}</span>
              </div>
            </td>
            <td>{{ user.email }}</td>
            <td>
              <span v-if="user.hubstaff_id" class="hubstaff-id">{{ user.hubstaff_id }}</span>
              <span v-else class="hubstaff-id hubstaff-id--empty">-</span>
            </td>
            <td>{{ getGroupLabel(user.group, user.role) }}</td>
            <td>
            <span class="role-badge" :class="`role-${user.role.toLowerCase()}`">
              {{ formatRole(user.role) }}
            </span>
            </td>
            <td>
              <span class="status-badge" :class="`status-${user.status}`">
                {{ user.status }}
              </span>
            </td>
            <td>
              <div v-if="user.workingRole" class="working-roles-row">
                <span
                  v-if="user.workingRole"
                  class="working-role-chip"
                  :title="WORKING_ROLE_LABELS[user.workingRole] || user.workingRole"
                >
                  {{ WORKING_ROLE_ICONS[user.workingRole] || '•' }}
                  {{ WORKING_ROLE_LABELS[user.workingRole] || user.workingRole }}
                </span>
              </div>
              <span v-else class="badge-no">—</span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <button type="button" @click="openEditModal(user)" class="btn-edit">Edit</button>
                <button type="button" @click="handleResetPassword(user)" class="btn-reset">Reset Password</button>
                <button
                  v-if="canDeleteUser(user)"
                  type="button"
                  @click="openDeleteConfirm(user)"
                  class="btn-delete"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="8" class="empty-state">
              No users found. Click "Add User" to create one.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ editingUser ? 'Edit User' : 'Create User' }}</h2>
          <button @click="closeModal" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>Email *</label>
              <input v-model="form.email" type="email" required :disabled="editingUser !== null"
                placeholder="user@example.com" />
            </div>
            <div class="form-group">
              <label>Name *</label>
              <input v-model="form.name" type="text" required placeholder="Full Name" />
            </div>
            <div class="form-group">
              <label>Hubstaff ID</label>
              <input
                v-model="form.hubstaff_id"
                type="text"
                placeholder="e.g. 1234567 (leave blank if none)"
              />
              <small class="form-hint">Numeric Hubstaff user_id used to link time tracking data.</small>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Role *</label>
                <select v-model="form.role" required>
                  <option value="GROUP_MEMBER">Member</option>
                  <option value="GROUP_BOSS">Group Boss</option>
                  <option v-if="isSuperAdmin" value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>
              <div v-if="!isFormSuperAdmin" class="form-group">
                <label>Group *</label>
                <select v-model="form.group" required>
                  <option v-for="opt in userGroupOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Status *</label>
                <select v-model="form.status" required>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
            <div v-if="isSuperAdmin" class="form-group">
              <label>
                <input v-model="form.paymentRequestApprover" type="checkbox" />
                Payment request approver (may accept/reject group-boss payment requests to the platform)
              </label>
            </div>
            <div v-if="!isFormSuperAdmin" class="form-group">
              <label>Working Role <span class="form-label-hint">one per member</span></label>
              <div class="wr-chips">
                <button
                  v-for="wr in WORKING_ROLE_VALUES"
                  :key="wr"
                  type="button"
                  class="wr-chip"
                  :class="{ 'wr-chip--on': form.workingRole === wr }"
                  @click="setWorkingRole(wr)"
                >
                  <span class="wr-chip__icon">{{ WORKING_ROLE_ICONS[wr] }}</span>
                  <span>{{ WORKING_ROLE_LABELS[wr] }}</span>
                  <span v-if="form.workingRole === wr" class="wr-chip__check">✓</span>
                </button>
              </div>
              <small class="form-hint">
                Normal Working covers the freelancing and AI-training platforms, Job Working the
                caller / keeper profiles. Click the chosen role again to clear it.
              </small>
            </div>
            <div v-if="tempPassword" class="temp-password-alert">
              <div class="temp-password-row">
                <div class="temp-password-main">
                  <strong>Temporary Password:</strong>
                  <span class="temp-password-value">{{ tempPassword }}</span>
                  <small>Save this password! The user needs it to log in the first time.</small>
                </div>
                <button
                  type="button"
                  class="btn-copy-temp-password"
                  @click="copyCreateTempPassword"
                >
                  {{ createTempPasswordCopied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" @click="closeModal" class="btn-cancel">Cancel</button>
              <button
                type="submit"
                :disabled="saving || (!!tempPassword && !editingUser)"
                class="btn-save"
              >
                {{ saving ? 'Saving...' : (editingUser ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Reset password: confirm -->
    <div v-if="showResetConfirmModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Reset password?</h2>
          <button type="button" @click="closeResetConfirm" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text">
            Reset password for <strong>{{ resetConfirmUser?.name }}</strong>? A new temporary password will be generated.
          </p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeResetConfirm" class="btn-cancel" :disabled="resettingPassword">
              Cancel
            </button>
            <button type="button" @click="executeResetPassword" class="btn-reset-modal" :disabled="resettingPassword">
              {{ resettingPassword ? 'Resetting…' : 'Reset password' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset password: success (password copied + shown) -->
    <div v-if="showResetSuccessModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Password reset</h2>
          <button type="button" @click="closeResetSuccess" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text">
            A new temporary password for <strong>{{ resetSuccessUserName }}</strong> is below.
            {{ resetPasswordInitialCopyOk ? 'It has been copied to your clipboard.' : 'Copy it to share with the user.' }}
          </p>
          <div class="reset-password-box">
            <code>{{ resetSuccessPassword }}</code>
          </div>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="copyResetPasswordAgain" class="btn-secondary">
              {{ resetPasswordInitialCopyOk ? 'Copy again' : 'Copy password' }}
            </button>
            <button type="button" @click="closeResetSuccess" class="btn-save">Done</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset password: error -->
    <div v-if="showResetErrorModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Reset failed</h2>
          <button type="button" @click="closeResetError" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text reset-modal-error">{{ resetErrorMessage }}</p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeResetError" class="btn-save">OK</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete user: confirm -->
    <div v-if="showDeleteConfirmModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Delete user?</h2>
          <button type="button" @click="closeDeleteConfirm" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text">
            Permanently delete <strong>{{ deleteTargetUser?.name }}</strong> ({{ deleteTargetUser?.email }})? This cannot be undone.
          </p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeDeleteConfirm" class="btn-cancel" :disabled="deletingUser">
              Cancel
            </button>
            <button type="button" @click="executeDeleteUser" class="btn-delete-modal" :disabled="deletingUser">
              {{ deletingUser ? 'Deleting…' : 'Delete user' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete user: error -->
    <div v-if="showDeleteErrorModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Delete failed</h2>
          <button type="button" @click="closeDeleteError" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text reset-modal-error">{{ deleteErrorMessage }}</p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeDeleteError" class="btn-save">OK</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Management Modal (Super Admin only) -->
    <div v-if="showGroupModal" class="modal-overlay">
      <div class="modal modal-wide" @click.stop>
        <div class="modal-header">
          <h2>Manage Groups</h2>
          <button @click="closeGroupModal" class="close-btn">×</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="saveGroup" class="group-form">
            <div class="form-row">
              <div class="form-group">
                <label>Name *</label>
                <input v-model="groupForm.name" type="text" required placeholder="e.g. Group 1" />
              </div>
              <div class="form-group">
                <label>Code *</label>
                <input v-model="groupForm.code" type="text" required placeholder="e.g. GROUP_1" :disabled="!!editingGroup" />
                <small v-if="editingGroup" class="form-hint">Code cannot be changed</small>
              </div>
              <div class="form-group form-group-sm">
                <label>Sort</label>
                <input v-model.number="groupForm.sortOrder" type="number" min="0" />
              </div>
              <div class="form-group form-group-actions">
                <button type="submit" class="btn-save">{{ editingGroup ? 'Update' : 'Add' }}</button>
                <button v-if="editingGroup" type="button" @click="openGroupModal()" class="btn-cancel">Cancel Edit</button>
              </div>
            </div>
          </form>
          <div class="groups-list">
            <h4>Existing Groups</h4>
            <table class="groups-table">
              <thead>
                <tr><th>Name</th><th>Code</th><th>Sort</th><th>Actions</th></tr>
              </thead>
              <tbody>
                <tr v-for="g in groups" :key="g._id">
                  <td>{{ g.name }}</td>
                  <td><code>{{ g.code }}</code></td>
                  <td>{{ g.sortOrder }}</td>
                  <td>
                    <button @click="openGroupModal(g)" class="btn-edit btn-sm">Edit</button>
                    <button @click="deleteGroup(g)" class="btn-reset btn-sm">Delete</button>
                  </td>
                </tr>
                <tr v-if="groups.length === 0">
                  <td colspan="4" class="empty-state">No groups yet. Add one above.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue';
import { useAuthStore } from '../composables/useAuth';
import * as adminService from '../services/admin';
import { formatGroupLabel } from '../constants/groups.js';
import { ROLES, normalizeRole } from '../constants/roles.js';
import {
  WORKING_ROLE_VALUES,
  WORKING_ROLE_LABELS,
  WORKING_ROLE_ICONS,
} from '../constants/profiles.js';
import UserAvatar from '../components/UserAvatar.vue';

const authStore = useAuthStore();
const groups = ref([]);
const userGroupOptions = computed(() => groups.value.map(g => ({ value: g.code, label: g.name })));
const defaultUserGroup = computed(() => {
  const first = groups.value[0];
  return first ? first.code : 'GROUP_1';
});

const loading = ref(false);
const error = ref(null);
const users = ref([]);

/** Super admins first, then groups in directory order (sortOrder): boss, then members; unknown groups after. */
const sortedUsers = computed(() => {
  const list = users.value;
  if (!list.length) return [];

  const canon = (u) => normalizeRole(u.role, u.degree);
  const nameCmp = (a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base', numeric: true });

  const superAdmins = list.filter((u) => canon(u) === ROLES.SUPER_ADMIN);
  const others = list.filter((u) => canon(u) !== ROLES.SUPER_ADMIN);
  superAdmins.sort(nameCmp);

  const groupsByOrder = [...groups.value].sort((a, b) => {
    const so = Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0);
    if (so !== 0) return so;
    return String(a.code || '').localeCompare(String(b.code || ''), undefined, {
      sensitivity: 'base',
      numeric: true
    });
  });
  const configuredCodes = groupsByOrder.map((g) => String(g.code));

  const UNGROUPED = '__ungrouped__';
  const byGroup = new Map();
  for (const u of others) {
    const raw = String(u.group || '').trim();
    const code = raw || UNGROUPED;
    if (!byGroup.has(code)) byGroup.set(code, []);
    byGroup.get(code).push(u);
  }

  const bossFirstThenName = (a, b) => {
    const bossA = canon(a) === ROLES.GROUP_BOSS ? 0 : 1;
    const bossB = canon(b) === ROLES.GROUP_BOSS ? 0 : 1;
    if (bossA !== bossB) return bossA - bossB;
    return nameCmp(a, b);
  };
  for (const arr of byGroup.values()) {
    arr.sort(bossFirstThenName);
  }

  const used = new Set();
  const orderedKeys = [];
  for (const code of configuredCodes) {
    if (byGroup.has(code)) {
      orderedKeys.push(code);
      used.add(code);
    }
  }
  const leftovers = [...byGroup.keys()].filter((k) => !used.has(k));
  leftovers.sort((a, b) => {
    if (a === UNGROUPED) return 1;
    if (b === UNGROUPED) return -1;
    return String(a).localeCompare(String(b), undefined, { sensitivity: 'base', numeric: true });
  });
  orderedKeys.push(...leftovers);

  const out = [...superAdmins];
  for (const key of orderedKeys) {
    out.push(...(byGroup.get(key) || []));
  }
  return out;
});
const showModal = ref(false);
const editingUser = ref(null);
const saving = ref(false);
const tempPassword = ref('');
const createTempPasswordCopied = ref(false);

// Reset password flow (modal + clipboard)
const showResetConfirmModal = ref(false);
const resetConfirmUser = ref(null);
const resettingPassword = ref(false);
const showResetSuccessModal = ref(false);
const resetSuccessPassword = ref('');
const resetSuccessUserName = ref('');
const resetPasswordInitialCopyOk = ref(false);
const showResetErrorModal = ref(false);
const resetErrorMessage = ref('');

const showDeleteConfirmModal = ref(false);
const deleteTargetUser = ref(null);
const deletingUser = ref(false);
const showDeleteErrorModal = ref(false);
const deleteErrorMessage = ref('');

const isSuperAdmin = computed(
  () => normalizeRole(authStore.user?.role, authStore.user?.degree) === ROLES.SUPER_ADMIN
);
const isFormSuperAdmin = computed(() => form.value.role === ROLES.SUPER_ADMIN);

const canDeleteUser = (user) => {
  const selfId = authStore.user?.id;
  if (!selfId || !user?.id) return false;
  if (String(user.id) === String(selfId)) return false;
  if (user.role === 'SUPER_ADMIN' && !isSuperAdmin.value) return false;
  return true;
};

// Group management (super admin only)
const showGroupModal = ref(false);
const editingGroup = ref(null);
const groupForm = ref({ name: '', code: '', sortOrder: 0 });

const form = ref({
  email: '',
  name: '',
  group: '',
  role: 'GROUP_MEMBER',
  status: 'active',
  paymentRequestApprover: false,
  workingRole: '',
  hubstaff_id: ''
});

/** One role per member; clicking the active chip clears it. */
const setWorkingRole = (role) => {
  form.value.workingRole = form.value.workingRole === role ? '' : role;
};

watch(
  () => form.value.role,
  (role) => {
    if (role === ROLES.SUPER_ADMIN) {
      form.value.group = '';
      return;
    }
    if (!form.value.group) {
      form.value.group = defaultUserGroup.value || '';
    }
  }
);

const loadGroups = async () => {
  try {
    const res = await adminService.fetchGroups();
    if (res?.data?.groups) {
      groups.value = res.data.groups;
    }
  } catch (err) {
    console.error('Failed to load groups:', err);
  }
};

const loadUsers = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await adminService.fetchUsers({ limit: 1000 });
    if (response.ok && response.data) {
      users.value = response.data.users || [];
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load users';
    console.error('Error loading users:', err);
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  editingUser.value = null;
  form.value = {
    email: '',
    name: '',
    group: defaultUserGroup.value || 'GROUP_1',
    role: 'GROUP_MEMBER',
    status: 'active',
    paymentRequestApprover: false,
    workingRole: '',
    hubstaff_id: ''
  };
  tempPassword.value = '';
  createTempPasswordCopied.value = false;
  showModal.value = true;
};

const openEditModal = (user) => {
  editingUser.value = user;
  form.value = {
    email: user.email,
    name: user.name,
    group: user.role === ROLES.SUPER_ADMIN ? '' : user.group,
    role: user.role,
    status: user.status,
    paymentRequestApprover: !!user.paymentRequestApprover,
    workingRole: user.workingRole || '',
    hubstaff_id: user.hubstaff_id ?? ''
  };
  tempPassword.value = '';
  createTempPasswordCopied.value = false;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingUser.value = null;
  tempPassword.value = '';
  createTempPasswordCopied.value = false;
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = null;
  try {
    const trimmedHubstaffId = (form.value.hubstaff_id ?? '').toString().trim();
    const basePayload = {
      email: form.value.email,
      name: form.value.name,
      role: form.value.role,
      status: form.value.status,
      hubstaff_id: trimmedHubstaffId === '' ? null : trimmedHubstaffId
    };
    if (isSuperAdmin.value) {
      basePayload.paymentRequestApprover = !!form.value.paymentRequestApprover;
    }
    const roleScopedPayload = isFormSuperAdmin.value
      ? basePayload
      : {
          ...basePayload,
          group: form.value.group,
          workingRole: form.value.workingRole || '',
        };

    if (editingUser.value) {
      // Update user
      const response = await adminService.updateUser(editingUser.value.id, roleScopedPayload);
      if (response.ok) {
        await loadUsers();
        closeModal();
      }
    } else {
      // Create user
      const response = await adminService.createUser({
        email: form.value.email,
        name: form.value.name,
        ...roleScopedPayload
      });
      if (response.ok && response.data) {
        tempPassword.value = response.data.tempPassword || '';
        createTempPasswordCopied.value = false;
        await loadUsers();
      }
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save user';
    console.error('Error saving user:', err);
  } finally {
    saving.value = false;
  }
};

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const copyCreateTempPassword = async () => {
  if (!tempPassword.value) return;
  createTempPasswordCopied.value = await copyTextToClipboard(tempPassword.value);
};

const closeResetConfirm = () => {
  if (resettingPassword.value) return;
  showResetConfirmModal.value = false;
  resetConfirmUser.value = null;
};

const closeResetSuccess = () => {
  showResetSuccessModal.value = false;
  resetSuccessPassword.value = '';
  resetSuccessUserName.value = '';
  resetPasswordInitialCopyOk.value = false;
};

const closeResetError = () => {
  showResetErrorModal.value = false;
  resetErrorMessage.value = '';
};

const closeDeleteConfirm = () => {
  if (deletingUser.value) return;
  showDeleteConfirmModal.value = false;
  deleteTargetUser.value = null;
};

const closeDeleteError = () => {
  showDeleteErrorModal.value = false;
  deleteErrorMessage.value = '';
};

const openDeleteConfirm = (user) => {
  deleteTargetUser.value = user;
  showDeleteConfirmModal.value = true;
};

const executeDeleteUser = async () => {
  const user = deleteTargetUser.value;
  if (!user) return;
  deletingUser.value = true;
  error.value = null;
  try {
    const response = await adminService.deleteUser(user.id);
    if (response.ok) {
      showDeleteConfirmModal.value = false;
      deleteTargetUser.value = null;
      await loadUsers();
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Failed to delete user';
    error.value = msg;
    showDeleteConfirmModal.value = false;
    deleteTargetUser.value = null;
    deleteErrorMessage.value = msg;
    showDeleteErrorModal.value = true;
  } finally {
    deletingUser.value = false;
  }
};

const handleResetPassword = (user) => {
  resetConfirmUser.value = user;
  showResetConfirmModal.value = true;
};

const copyResetPasswordAgain = async () => {
  await copyTextToClipboard(resetSuccessPassword.value);
};

const executeResetPassword = async () => {
  const user = resetConfirmUser.value;
  if (!user) return;
  resettingPassword.value = true;
  error.value = null;
  try {
    const response = await adminService.resetUserPassword(user.id);
    if (response.ok && response.data) {
      const newPassword = response.data.tempPassword || '';
      const copied = await copyTextToClipboard(newPassword);
      showResetConfirmModal.value = false;
      resetConfirmUser.value = null;
      resetSuccessPassword.value = newPassword;
      resetSuccessUserName.value = user.name;
      resetPasswordInitialCopyOk.value = copied;
      showResetSuccessModal.value = true;
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Failed to reset password';
    error.value = msg;
    showResetConfirmModal.value = false;
    resetConfirmUser.value = null;
    resetErrorMessage.value = msg;
    showResetErrorModal.value = true;
  } finally {
    resettingPassword.value = false;
  }
};

const formatRole = (role) => {
  return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

onMounted(() => {
  loadGroups();
  loadUsers();
});

// Group CRUD
const openGroupModal = (group = null) => {
  editingGroup.value = group;
  groupForm.value = group
    ? { name: group.name, code: group.code, sortOrder: group.sortOrder ?? 0 }
    : { name: '', code: '', sortOrder: groups.value.length };
  showGroupModal.value = true;
};

const closeGroupModal = () => {
  showGroupModal.value = false;
  editingGroup.value = null;
};

const saveGroup = async () => {
  try {
    if (editingGroup.value) {
      await adminService.updateGroup(editingGroup.value._id, groupForm.value);
    } else {
      await adminService.createGroup(groupForm.value);
    }
    await loadGroups();
    closeGroupModal();
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save group';
  }
};

const getGroupLabel = (code, role) => {
  if (role === ROLES.SUPER_ADMIN) return '-';
  if (!code) return '-';
  const g = groups.value.find(x => x.code === code);
  if (g) return g.name;
  if (code === 'SUPER_ADMIN') return 'Super Admin';
  if (code === 'ADMIN') return 'Admin';
  return formatGroupLabel(code);
};

const deleteGroup = async (group) => {
  if (!confirm(`Delete group "${group.name}"? Users must be reassigned first.`)) return;
  try {
    await adminService.deleteGroup(group._id);
    await loadGroups();
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to delete group';
  }
};
</script>

<style scoped>
.admin-users-view {
  background: transparent;
  padding: 0;
  max-width: none;
  margin: 0;
  width: 100%;
}

.page-header {
  background: transparent;
  padding: 0;
  border-radius: 0;
  margin-bottom: 8px;
  box-shadow: none;
  border: none;
}

.header-content {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.btn-secondary {
  padding: 8px 12px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
}

.btn-secondary:hover {
  background: var(--border-medium);
  border-color: var(--color-primary);
}

.modal-wide {
  max-width: 640px;
}

.group-form {
  margin-bottom: var(--spacing-xl);
}

.groups-list h4 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-base);
  color: var(--text-secondary);
}

.groups-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.groups-table th,
.groups-table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.groups-table code {
  font-size: 0.85em;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  margin-right: var(--spacing-xs);
}

.form-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.form-group-sm {
  max-width: 80px;
}

.form-group-actions {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
}

.page-header h1 {
  display: none;
}

.subtitle {
  display: none;
}

.btn-primary {
  padding: 8px 12px;
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.loading-state,
.error-state {
  text-align: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.spinner {
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--spacing-lg);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.users-table-container {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table thead {
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
}

.users-table th {
  padding: var(--spacing-lg);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--border-light);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.users-table td {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.user-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.users-table tbody tr {
  transition: all var(--transition-fast);
}

.users-table tbody tr:hover {
  background: #f7fbff;
  transform: none;
}

.role-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
}

.role-super_admin {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%);
  color: var(--color-secondary);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.role-group_boss,
.role-group-boss,
.role-boss,
.role-admin {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
  color: var(--color-info);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.role-group_member,
.role-group-member,
.role-member {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.2) 0%, rgba(75, 85, 99, 0.2) 100%);
  color: var(--color-gray-600);
  border: 1px solid rgba(107, 114, 128, 0.3);
}

.status-active {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%);
  color: var(--color-success);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-pending {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%);
  color: var(--color-warning);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-disabled {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%);
  color: var(--color-error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-yes {
  color: var(--color-success);
  font-weight: var(--font-weight-semibold);
}

.badge-no {
  color: var(--text-tertiary);
}

.working-roles-row {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}
.working-role-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--color-primary-soft, rgba(59, 130, 246, 0.12));
  color: var(--color-primary, #2563eb);
  font-size: 0.74rem;
  font-weight: 600;
  white-space: nowrap;
}

.form-label-hint {
  text-transform: none;
  letter-spacing: normal;
  font-weight: 500;
  color: var(--text-tertiary, #94a3b8);
  font-size: 0.72rem;
  margin-left: 6px;
}
.wr-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.wr-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-medium, #cbd5e1);
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #0f172a);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.wr-chip:hover { border-color: var(--color-primary, #2563eb); color: var(--color-primary, #2563eb); }
.wr-chip__icon { font-size: 0.92rem; line-height: 1; }
.wr-chip__check {
  width: 14px; height: 14px; border-radius: 50%;
  background: rgba(255,255,255,0.3);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 0.62rem;
}
.wr-chip--on {
  background: var(--color-primary, #2563eb);
  border-color: var(--color-primary, #2563eb);
  color: #fff;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.btn-edit,
.btn-reset {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
}

.btn-edit {
  background: #1d4ed8;
  color: #ffffff;
  border: 1px solid #1e40af;
  box-shadow: 0 1px 2px rgba(29, 78, 216, 0.28);
}

.btn-edit:hover {
  background: #1e40af;
  border-color: #1e3a8a;
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(29, 78, 216, 0.34);
}

.btn-reset {
  background: #b9770e;
  color: var(--text-inverse);
  box-shadow: 0 1px 2px rgba(180, 120, 20, 0.28);
}

.btn-reset:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-delete {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
  background: #c62828;
  color: var(--text-inverse);
  box-shadow: 0 1px 2px rgba(198, 40, 40, 0.28);
}

.btn-delete:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-3xl);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
  padding: var(--spacing-md);
  animation: fadeIn var(--transition-base);
}

.modal {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  width: 520px;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-2xl);
  animation: slideUp var(--transition-slow);
  border: 1px solid var(--border-light);
}

@media (max-width: 560px) {
  .modal {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.close-btn {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--spacing-xs);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-content {
  padding: var(--spacing-xl);
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group select {
  width: 100%;
  padding: var(--spacing-md);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.form-group select {
  appearance: none;
  -webkit-appearance: none;
  -moz-appearance: none;
  padding-right: 2.25rem;
  background-image:
    linear-gradient(45deg, transparent 50%, #64748b 50%),
    linear-gradient(135deg, #64748b 50%, transparent 50%);
  background-position:
    calc(100% - 15px) calc(50% - 2px),
    calc(100% - 10px) calc(50% - 2px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-group input:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-group input[type="checkbox"] {
  margin-right: var(--spacing-sm);
  width: auto;
  cursor: pointer;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.temp-password-alert {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%);
  border: 1.5px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  color: #92400e;
}

.temp-password-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.temp-password-main {
  flex: 1;
  min-width: 0;
}

.temp-password-alert strong {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
}

.temp-password-value {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-family: ui-monospace, monospace;
  font-size: var(--font-size-sm);
  word-break: break-all;
  line-height: 1.4;
}

.temp-password-main small {
  display: block;
  line-height: 1.4;
}

.btn-copy-temp-password {
  flex-shrink: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1.5px solid rgba(217, 119, 6, 0.45);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: #92400e;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  align-self: center;
}

.btn-copy-temp-password:hover {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(217, 119, 6, 0.65);
}

@media (max-width: 400px) {
  .temp-password-row {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-copy-temp-password {
    align-self: stretch;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.btn-cancel,
.btn-save {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-base);
}

.btn-cancel {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1.5px solid var(--border-medium);
}

.btn-cancel:hover {
  background: var(--border-medium);
}

.btn-save {
  background: linear-gradient(135deg, var(--color-success) 0%, #059669 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-md);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-retry {
  padding: var(--spacing-md) var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-top: var(--spacing-lg);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}

.btn-retry:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.modal-reset {
  max-width: 440px;
}

.reset-modal-text {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.reset-modal-error {
  color: var(--color-error);
}

.reset-password-box {
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  word-break: break-all;
}

.reset-password-box code {
  font-size: var(--font-size-sm);
  font-family: ui-monospace, monospace;
  color: var(--text-primary);
}

.reset-modal-actions {
  margin-top: 0;
  flex-wrap: wrap;
}

.btn-reset-modal {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.btn-reset-modal:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-reset-modal:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-delete-modal {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.btn-delete-modal:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-delete-modal:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .page-header {
    padding: var(--spacing-lg);
  }

  .page-header h1 {
    font-size: var(--font-size-2xl);
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .users-table {
    font-size: var(--font-size-xs);
  }

  .users-table th,
  .users-table td {
    padding: var(--spacing-md);
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-edit,
  .btn-reset,
  .btn-delete {
    width: 100%;
  }

  .form-group select {
    padding-right: 2.05rem;
    background-position:
      calc(100% - 13px) calc(50% - 2px),
      calc(100% - 8px) calc(50% - 2px);
  }
}
</style>

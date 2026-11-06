<template>
  <div class="group-tree-page">
    <div class="page-header">
      <div>
        <h1>Group Tree Management</h1>
        <p class="subtitle">Create groups and manage group members</p>
      </div>
    </div>

    <section class="card create-group-card">
      <div class="section-title-row">
        <h2>Create New Group</h2>
        <small>Use clear names and unique codes</small>
      </div>
      <div class="create-group-inline">
        <p class="create-group-note">
          Add a new team group using a dedicated dialog form.
        </p>
        <button class="btn-primary" @click="openCreateGroupDialog">
          + Create Group
        </button>
      </div>
    </section>

    <section class="card tree-card">
      <div class="tree-header">
        <h2>Groups & Members Tree</h2>
        <input
          v-model.trim="search"
          type="text"
          class="search-input"
          placeholder="Search member by name/email"
        />
      </div>

      <div class="groups-grid">
        <article
          v-for="group in groupedData"
          :key="group.code"
          class="group-node"
          @dragover.prevent
          @drop="handleDrop(group.code)"
        >
          <header class="group-node-header">
            <h3>{{ group.label }}</h3>
            <div class="group-header-actions">
              <span v-if="group.type === 'job'" class="badge badge-job" title="Job team: scored on job interviews and job offers">Job</span>
              <span class="badge badge-info">{{ group.members.length }}</span>
              <button type="button" class="btn-group-edit" @click.stop="openEditGroupDialog(group)">
                Edit
              </button>
            </div>
          </header>

          <ul class="member-list">
            <li
              v-for="member in group.members"
              :key="member.id"
              class="member-item"
              draggable="true"
              @dragstart="handleDragStart(member)"
            >
              <div class="member-row">
                <UserAvatar
                  :name="member.name || member.email || 'User'"
                  :profile-image="member.avatarUrl || ''"
                  :size="36"
                  :tooltip="false"
                />
                <div class="member-main">
                  <strong>{{ member.name }}</strong>
                  <small>{{ member.email }}</small>
                </div>
              </div>
              <div class="member-actions">
                <span class="role-tag">{{ formatRole(member.role) }}</span>
                <button
                  type="button"
                  class="btn-member-edit"
                  @click.stop="openMemberGroupDialog(member)"
                >
                  Edit
                </button>
              </div>
            </li>
            <li v-if="group.members.length === 0" class="member-empty">Drop member here</li>
          </ul>
        </article>
      </div>
    </section>

    <div v-if="showCreateGroupDialog" class="modal-overlay" @click.self="closeCreateGroupDialog">
      <div class="modal-dialog" @click.stop>
        <div class="dialog-header">
          <h3>Create New Group</h3>
          <button class="dialog-close" @click="closeCreateGroupDialog" :disabled="savingGroup">×</button>
        </div>
        <form class="create-group-form" @submit.prevent="handleCreateGroup">
          <div class="create-field">
            <label>Group name</label>
            <input v-model.trim="newGroup.name" type="text" placeholder="Group 5" required />
          </div>
          <div class="create-field">
            <label>Group code</label>
            <input v-model.trim="newGroup.code" type="text" placeholder="GROUP_5" required />
          </div>
          <div class="create-field">
            <label>Group type</label>
            <select v-model="newGroup.type">
              <option v-for="opt in GROUP_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <small class="create-hint">{{ groupTypeHint(newGroup.type) }}</small>
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn-secondary" @click="closeCreateGroupDialog" :disabled="savingGroup">
              Cancel
            </button>
            <button type="submit" class="btn-primary create-btn" :disabled="savingGroup">
              {{ savingGroup ? 'Creating...' : 'Create Group' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <div v-if="showMemberGroupDialog && selectedMember" class="modal-overlay" @click.self="closeMemberGroupDialog">
      <div class="modal-dialog" @click.stop>
        <div class="dialog-header">
          <h3>Edit Member Group</h3>
          <button class="dialog-close" @click="closeMemberGroupDialog" :disabled="savingMove">×</button>
        </div>
        <div class="member-dialog-body">
          <p class="member-dialog-name">{{ selectedMember.name }}</p>
          <p class="member-dialog-email">{{ selectedMember.email }}</p>
          <label class="member-dialog-label">Group</label>
          <select v-model="selectedGroupCode" class="member-dialog-select">
            <option v-for="g in allGroupOptions" :key="g.value" :value="g.value">{{ g.label }}</option>
          </select>
          <div class="dialog-actions">
            <button type="button" class="btn-secondary" @click="closeMemberGroupDialog" :disabled="savingMove">
              Cancel
            </button>
            <button type="button" class="btn-primary create-btn" :disabled="savingMove" @click="applySelectedMemberGroup">
              {{ savingMove ? 'Updating...' : 'Update Group' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showEditGroupDialog && editingGroup" class="modal-overlay" @click.self="closeEditGroupDialog">
      <div class="modal-dialog" @click.stop>
        <div class="dialog-header">
          <h3>Edit Group</h3>
          <button class="dialog-close" @click="closeEditGroupDialog" :disabled="savingEditGroup">×</button>
        </div>
        <form class="create-group-form modal-edit-group-form" @submit.prevent="handleEditGroup">
          <div class="create-field">
            <label>Group name</label>
            <input v-model.trim="editGroupForm.name" type="text" required />
          </div>
          <div class="create-field">
            <label>Group code</label>
            <input v-model.trim="editGroupForm.code" type="text" required />
          </div>
          <div class="create-field">
            <label>Group type</label>
            <select v-model="editGroupForm.type">
              <option v-for="opt in GROUP_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <small class="create-hint">{{ groupTypeHint(editGroupForm.type) }}</small>
          </div>
          <div class="dialog-actions">
            <button type="button" class="btn-secondary" @click="closeEditGroupDialog" :disabled="savingEditGroup">
              Cancel
            </button>
            <button type="submit" class="btn-primary create-btn" :disabled="savingEditGroup">
              {{ savingEditGroup ? 'Updating...' : 'Update Group' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import * as adminService from '../services/admin';
import { ROLES, normalizeRole } from '../constants/roles.js';
import UserAvatar from '../components/UserAvatar.vue';

function compareMemberName(a, b) {
  return String(a.name || '').localeCompare(String(b.name || ''), undefined, {
    sensitivity: 'base',
    numeric: true
  });
}

/** Group boss first (includes legacy ADMIN/BOSS via normalizeRole), then members by name */
function sortGroupMembers(list) {
  const canon = (u) => normalizeRole(u.role, u.degree);
  return [...list].sort((a, b) => {
    const bossA = canon(a) === ROLES.GROUP_BOSS ? 0 : 1;
    const bossB = canon(b) === ROLES.GROUP_BOSS ? 0 : 1;
    if (bossA !== bossB) return bossA - bossB;
    return compareMemberName(a, b);
  });
}

const groups = ref([]);
const users = ref([]);
const savingGroup = ref(false);
const savingMove = ref(false);
const search = ref('');
const dragMember = ref(null);
const showCreateGroupDialog = ref(false);
const showMemberGroupDialog = ref(false);
const showEditGroupDialog = ref(false);
const savingEditGroup = ref(false);

const selectedMember = ref(null);
const selectedGroupCode = ref('');
const editingGroup = ref(null);
const editGroupForm = ref({
  name: '',
  code: '',
  type: 'normal'
});

const newGroup = ref({
  name: '',
  code: '',
  type: 'normal'
});

/** Group type drives the weekly Summarize columns of that team. */
const GROUP_TYPE_OPTIONS = [
  { value: 'normal', label: 'Normal team' },
  { value: 'job', label: 'Job team' }
];

const groupTypeHint = (type) =>
  type === 'job'
    ? 'Summarize scores this team on job interviews and job offers.'
    : 'Summarize scores this team on call counts and getting citizen.';

const allGroupOptions = computed(() => {
  return groups.value.map((g) => ({
    value: g.code,
    label: g.name,
    type: g.type || 'normal'
  }));
});

const filteredUsers = computed(() => {
  const q = search.value.toLowerCase();
  if (!q) return users.value;
  return users.value.filter((u) =>
    (u.name || '').toLowerCase().includes(q) ||
    (u.email || '').toLowerCase().includes(q)
  );
});

const groupedData = computed(() => {
  return allGroupOptions.value.map((group) => ({
    code: group.value,
    label: group.label,
    type: group.type,
    members: sortGroupMembers(filteredUsers.value.filter((u) => u.group === group.value))
  }));
});

const loadData = async () => {
  const [groupsRes, usersRes] = await Promise.all([
    adminService.fetchGroups(),
    adminService.fetchUsers({ limit: 5000 })
  ]);
  groups.value = groupsRes?.data?.groups || groupsRes?.groups || [];
  users.value = usersRes?.data?.users || usersRes?.users || [];
};

const handleCreateGroup = async () => {
  if (!newGroup.value.name || !newGroup.value.code) return;
  savingGroup.value = true;
  try {
    const payload = {
      name: newGroup.value.name.trim(),
      code: newGroup.value.code.trim(),
      type: newGroup.value.type,
      sortOrder: groups.value.length
    };

    // Keep create behavior aligned with the previous User Management group flow.
    await adminService.createGroup({
      ...payload
    });
    newGroup.value = { name: '', code: '', type: 'normal' };
    await loadData();
    showCreateGroupDialog.value = false;
  } finally {
    savingGroup.value = false;
  }
};

const openCreateGroupDialog = () => {
  newGroup.value = { name: '', code: '', type: 'normal' };
  showCreateGroupDialog.value = true;
};

const closeCreateGroupDialog = () => {
  if (savingGroup.value) return;
  showCreateGroupDialog.value = false;
};

const openMemberGroupDialog = (member) => {
  selectedMember.value = member;
  selectedGroupCode.value = member.group;
  showMemberGroupDialog.value = true;
};

const closeMemberGroupDialog = () => {
  if (savingMove.value) return;
  showMemberGroupDialog.value = false;
};

const openEditGroupDialog = (group) => {
  const source = groups.value.find((g) => g.code === group.code);
  if (!source) return;
  editingGroup.value = source;
  editGroupForm.value = {
    name: source.name || '',
    code: source.code || '',
    type: source.type || 'normal'
  };
  showEditGroupDialog.value = true;
};

const closeEditGroupDialog = () => {
  if (savingEditGroup.value) return;
  showEditGroupDialog.value = false;
};

const handleEditGroup = async () => {
  if (!editingGroup.value?._id) return;
  savingEditGroup.value = true;
  try {
    await adminService.updateGroup(editingGroup.value._id, {
      name: editGroupForm.value.name.trim(),
      code: editGroupForm.value.code.trim(),
      type: editGroupForm.value.type,
      sortOrder: editingGroup.value.sortOrder ?? 0
    });
    await loadData();
    showEditGroupDialog.value = false;
  } finally {
    savingEditGroup.value = false;
  }
};

const handleDragStart = (member) => {
  dragMember.value = member;
};

const moveMemberToGroup = async (member, targetGroup) => {
  if (!member || !targetGroup || member.group === targetGroup) return;
  savingMove.value = true;
  try {
    await adminService.updateUser(member.id, { group: targetGroup });
    const idx = users.value.findIndex((u) => u.id === member.id);
    if (idx >= 0) {
      users.value[idx] = { ...users.value[idx], group: targetGroup };
    }
    if (selectedMember.value?.id === member.id) {
      selectedMember.value = { ...selectedMember.value, group: targetGroup };
      selectedGroupCode.value = targetGroup;
    }
    showMemberGroupDialog.value = false;
  } finally {
    savingMove.value = false;
  }
};

const handleDrop = async (targetGroup) => {
  const member = dragMember.value;
  dragMember.value = null;
  await moveMemberToGroup(member, targetGroup);
};

const applySelectedMemberGroup = async () => {
  await moveMemberToGroup(selectedMember.value, selectedGroupCode.value);
};

const formatRole = (role) => {
  if (!role) return 'Member';
  return role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
};

onMounted(loadData);
</script>

<style scoped>
.create-field select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.create-hint {
  display: block;
  margin-top: 4px;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.badge-job {
  background: color-mix(in srgb, var(--color-primary) 14%, var(--bg-primary));
  color: var(--color-primary);
  border: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
  font-weight: var(--font-weight-semibold);
}

.group-tree-page {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.section-title-row h2 {
  font-size: 0.98rem;
}

.section-title-row small {
  font-size: 0.74rem;
  color: var(--text-tertiary);
}

.create-group-form {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.create-group-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.create-group-note {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.create-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.create-field label {
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.create-btn {
  min-width: 120px;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-modal-backdrop, 9000);
  background: rgba(15, 23, 42, 0.44);
  backdrop-filter: blur(2px);
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 18px;
}

.modal-dialog {
  width: 100%;
  max-width: 520px;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.modal-dialog .create-group-form {
  padding: 14px;
  gap: 10px;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 44px;
  padding: 10px 10px 10px 14px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-tertiary);
}

.dialog-header h3 {
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
}

.dialog-close {
  width: 28px;
  height: 28px;
  border: 1px solid var(--border-medium);
  border-radius: 7px;
  background: var(--bg-primary);
  color: var(--text-tertiary);
  font-size: 14px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition: all 0.15s ease;
}

.dialog-close:hover {
  border-color: var(--border-dark);
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.dialog-close:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
}

.tree-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.search-input {
  width: 260px;
  height: 34px;
}

.groups-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
  gap: 10px;
}

.group-node {
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: var(--bg-primary);
  min-height: 220px;
}

.group-node-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-tertiary);
}

.group-node-header h3 {
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-primary);
}

.group-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.btn-group-edit {
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 0.66rem;
  cursor: pointer;
}

.btn-group-edit:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.member-list {
  list-style: none;
  margin: 0;
  padding: 8px 7px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 320px;
  overflow: auto;
}

.member-item {
  border: 1px solid var(--border-light);
  border-radius: 7px;
  background: var(--bg-primary);
  padding: 7px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: grab;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.member-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.btn-member-edit {
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  color: var(--text-secondary);
  border-radius: 6px;
  padding: 3px 8px;
  font-size: 0.68rem;
  cursor: pointer;
}

.btn-member-edit:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}

.member-item:hover {
  border-color: var(--border-medium);
  box-shadow: var(--shadow-sm);
}

.member-item:active {
  cursor: grabbing;
}

.member-row .member-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.member-main strong {
  font-size: 0.8rem;
  color: var(--text-primary);
}

.member-main small {
  font-size: 0.72rem;
  color: var(--text-tertiary);
}

.role-tag {
  font-size: 0.64rem;
  padding: 2px 7px;
  border-radius: 999px;
  border: 1px solid var(--color-primary-soft);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.member-empty {
  padding: 12px;
  border: 1px dashed var(--border-medium);
  border-radius: 8px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.75rem;
}

.member-dialog-body {
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.member-dialog-name {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 700;
}

.member-dialog-email {
  margin: 0;
  font-size: 0.76rem;
  color: var(--text-tertiary);
}

.member-dialog-label {
  margin-top: 2px;
  font-size: 0.76rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.member-dialog-select {
  width: 100%;
}

.modal-edit-group-form {
  padding: 14px;
  gap: 10px;
}

@media (max-width: 980px) {
  .create-group-inline {
    flex-direction: column;
    align-items: stretch;
  }

  .search-input {
    width: 100%;
  }

  .tree-header {
    flex-direction: column;
    align-items: stretch;
  }

}

@media (max-width: 640px) {
  .modal-overlay {
    padding: 10px;
    align-items: flex-end;
  }

  .modal-dialog {
    max-width: none;
    border-radius: 12px 12px 0 0;
  }

  .modal-dialog .create-group-form {
    padding: 12px;
  }

  .dialog-actions {
    flex-direction: column-reverse;
    align-items: stretch;
  }

  .dialog-actions .btn-primary,
  .dialog-actions .btn-secondary {
    width: 100%;
  }
}
</style>

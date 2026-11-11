<template>
  <div class="wf-settings" :class="{ readonly: !canManageTargets }">
    <header class="settings-head">
      <div>
        <p class="eyebrow">WorkTime Management</p>
        <h1 class="title">Monthly Target Policy</h1>
        <p class="subtitle">
          Configure monthly per-user target hours used for penalty division from previous month results.
        </p>
      </div>
      <div class="month-select-wrap">
        <label class="label">Target Month</label>
        <TmsNativeCalendarField v-model="selectedMonth" type="month" class="month-select" />
      </div>
    </header>

    <section class="card preset-section">
      <div class="section-header">
        <h2 class="section-title">Monthly Target Presets</h2>
        <div class="section-actions">
          <button v-if="canManageTargets" class="btn btn-ghost" @click="openCreatePresetModal">+ New Custom Preset</button>
          <button v-if="canManageTargets" class="btn btn-primary" :disabled="bulkSaving" @click="applyPresetToAll">
            Apply Selected Preset To All Users
          </button>
          <span v-else class="readonly-badge">Read Only</span>
        </div>
      </div>
      <div class="preset-grid">
        <div
          v-for="preset in presets"
          :key="preset.key"
          class="preset-chip"
          :class="[{ active: selectedPresetMinutes === preset.minutes }, `tone-${presetMeta(preset.key).tone}`]"
          @click="canManageTargets && (selectedPresetMinutes = preset.minutes)"
        >
          <p class="preset-title">{{ presetMeta(preset.key).title }}</p>
          <strong>{{ preset.label }}</strong>
          <span>{{ preset.minutes }} mins</span>
          <small>{{ presetMeta(preset.key).note }}</small>
          <div v-if="canManageTargets && !isStaticPreset(preset.key)" class="preset-actions">
            <button class="mini-btn" @click.stop="openEditPresetModal(preset)">Edit</button>
            <button class="mini-btn danger" @click.stop="removePreset(preset)">Delete</button>
          </div>
        </div>
      </div>
    </section>

    <section class="card">
      <h2 class="section-title">User Target Assignment Board</h2>
      <div class="bucket-grid">
        <div
          v-for="bucket in groupedBuckets"
          :key="bucket.key"
          class="bucket"
          @dragover.prevent="canManageTargets"
          @drop="canManageTargets && onDropUserToBucket(bucket.minutes)"
        >
          <div class="bucket-head">
            <h3>{{ bucket.label }}</h3>
            <span>{{ bucket.users.length }}</span>
          </div>
          <div class="bucket-body">
            <div
              v-for="u in bucket.users"
              :key="u.userId"
              class="bucket-user"
              :style="{ '--group-accent': groupColor(u.group) }"
              :draggable="canManageTargets"
              @dragstart="canManageTargets && onDragUser(u)"
            >
              <UserAvatar
                :name="u.name"
                :profile-image="u.avatarUrl"
                :size="26"
                :tooltip="false"
              />
              <div class="bucket-meta">
                <strong>{{ u.name }}</strong>
                <small><b>{{ u.group || 'No Group' }}</b> · {{ toLabel(u.targetMinutes) }}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="canManageTargets" class="card">
      <div class="section-header">
        <h2 class="section-title">Hubstaff ID Management</h2>
      </div>
      <p class="section-note">
        Configure Hubstaff user IDs for all users except super admin. This mapping is used by worktime sync.
      </p>
      <div class="hubstaff-table-wrap">
        <table class="hubstaff-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Group</th>
              <th>Status</th>
              <th>Hubstaff ID</th>
              <th>Connection</th>
              <th v-if="canManageTargets">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="hubstaffLoading">
              <td :colspan="canManageTargets ? 6 : 5" class="hubstaff-empty">Loading users...</td>
            </tr>
            <tr v-else-if="!hubstaffRows.length">
              <td :colspan="canManageTargets ? 6 : 5" class="hubstaff-empty">No users found</td>
            </tr>
            <tr v-for="u in hubstaffRows" :key="u.userId">
              <td>
                <div class="hubstaff-user">
                  <UserAvatar :name="u.name" :profile-image="u.avatarUrl" :size="24" :tooltip="false" />
                  <div class="hubstaff-user-meta">
                    <strong>{{ u.name }}</strong>
                    <small>{{ u.email || 'No email' }}</small>
                  </div>
                </div>
              </td>
              <td>{{ u.group || 'No Group' }}</td>
              <td>
                <span class="status-pill">{{ u.status }}</span>
              </td>
              <td>
                <input
                  v-model.trim="u.hubstaffIdDraft"
                  class="input hubstaff-input"
                  placeholder="e.g. 123456"
                  :disabled="!canManageTargets"
                />
              </td>
              <td>
                <span :class="['connect-pill', u.hasHubstaffId ? 'ok' : 'missing']">
                  {{ u.hasHubstaffId ? 'Connected' : 'Missing' }}
                </span>
              </td>
              <td>
                <button
                  class="mini-btn"
                  :disabled="hubstaffSavingUserId === u.userId"
                  @click="saveHubstaffUser(u)"
                >
                  {{ hubstaffSavingUserId === u.userId ? 'Saving...' : 'Save' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <teleport to="body">
      <div v-if="presetModalOpen" class="modal-overlay" @click.self="presetModalOpen = false">
        <div class="modal">
          <div class="modal-head">
            <h3>{{ editingPresetId ? 'Edit Custom Preset' : 'Create Custom Preset' }}</h3>
            <button class="mini-btn" @click="presetModalOpen = false">Close</button>
          </div>
          <div class="modal-grid">
            <div class="field">
              <label class="label">Title</label>
              <input v-model="presetForm.title" class="input" placeholder="e.g. Night Shift Target" />
            </div>
            <div class="field">
              <label class="label">List Label</label>
              <input v-model="presetForm.label" class="input" placeholder="e.g. 14h 00m" />
            </div>
            <div class="field">
              <label class="label">Color</label>
              <input v-model="presetForm.color" class="input" type="color" />
            </div>
            <div class="field split">
              <div>
                <label class="label">Hours</label>
                <input v-model.number="presetForm.hours" class="input" type="number" min="0" max="24" />
              </div>
              <div>
                <label class="label">Minutes</label>
                <input v-model.number="presetForm.minutes" class="input" type="number" min="0" max="59" />
              </div>
            </div>
            <div class="field full">
              <label class="label">Description</label>
              <input v-model="presetForm.description" class="input" placeholder="Explain when this target should be used" />
            </div>
          </div>
          <div class="modal-actions">
            <button class="btn btn-primary" :disabled="presetSaving" @click="savePreset">
              {{ presetSaving ? 'Saving...' : 'Save Preset' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useToast } from 'vue-toastification';
import TmsNativeCalendarField from '../components/ui/TmsNativeCalendarField.vue';
import UserAvatar from '../components/UserAvatar.vue';
import { useAuthStore } from '../composables/useAuth';
import { hasAnyRole } from '../utils/permissions';
import { ROLES } from '../constants/roles';
import {
  deleteWorktimeTarget,
  deleteWorktimeTargetPreset,
  createWorktimeTargetPreset,
  getWorktimeHubstaffUsers,
  getWorktimeTargets,
  upsertWorktimeHubstaffId,
  upsertWorktimeTarget,
  updateWorktimeTargetPreset,
} from '../services/workflow';

const toast = useToast();
const authStore = useAuthStore();
const todayMonth = new Date().toISOString().slice(0, 7);

const selectedMonth = ref(todayMonth);
const loading = ref(false);
const bulkSaving = ref(false);
const presets = ref([]);
const selectedPresetMinutes = ref(13 * 60 + 30);
const editableRows = ref([]);
const draggedUser = ref(null);
const presetModalOpen = ref(false);
const presetSaving = ref(false);
const editingPresetId = ref('');
const hubstaffRows = ref([]);
const hubstaffLoading = ref(false);
const hubstaffSavingUserId = ref('');
const presetForm = ref({
  title: '',
  label: '',
  description: '',
  color: '#8b5cf6',
  hours: 13,
  minutes: 30,
});

const canManageTargets = computed(() =>
  hasAnyRole(authStore.user, [ROLES.SUPER_ADMIN, ROLES.SYSTEM_ADMIN])
);

const toLabel = (minutes) => {
  if (!minutes) return 'No Target';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const presetMeta = (key) => {
  const map = {
    NO_TARGET: { title: 'No Penalty', note: 'No monthly threshold', tone: 'neutral' },
    '12H': { title: 'Light Target', note: 'Lower minimum expected hours', tone: 'blue' },
    '13H_30M': { title: 'Standard Target', note: 'Default monthly baseline', tone: 'green' },
    '15H_30M': { title: 'Strict Target', note: 'Higher expected contribution', tone: 'amber' },
  };
  return map[key] || { title: 'Custom Target', note: 'Custom monthly policy', tone: 'purple' };
};

const getInitials = (name) =>
  (name || 'U')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

const groupColor = (groupName) => {
  const palette = ['#2563eb', '#059669', '#7c3aed', '#ea580c', '#0d9488', '#db2777', '#4f46e5'];
  const s = String(groupName || 'nogroup');
  const hash = s.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[hash % palette.length];
};

const isStaticPreset = (key) => ['NO_TARGET', '12H', '13H_30M', '15H_30M'].includes(key);

const loadTargets = async () => {
  loading.value = true;
  try {
    const res = await getWorktimeTargets(selectedMonth.value);
    const payload = res.data?.data || {};
    presets.value = payload.presets || [];
    editableRows.value = (payload.users || []).map((u) => ({
      ...u,
      avatarUrl: u.avatarUrl || '',
    }));
    selectedPresetMinutes.value = payload.defaultTargetMinutes ?? 810;
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to load targets');
    editableRows.value = [];
  } finally {
    loading.value = false;
  }
};

const loadHubstaffUsers = async () => {
  hubstaffLoading.value = true;
  try {
    const res = await getWorktimeHubstaffUsers();
    const users = res.data?.data?.users || [];
    hubstaffRows.value = users.map((u) => ({
      ...u,
      hubstaffIdDraft: u.hubstaffId || '',
    }));
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to load Hubstaff users');
    hubstaffRows.value = [];
  } finally {
    hubstaffLoading.value = false;
  }
};

const saveHubstaffUser = async (row) => {
  if (!canManageTargets.value) return;
  const value = String(row.hubstaffIdDraft || '').trim();
  if (value && !/^\d+$/.test(value)) {
    toast.warning('Hubstaff ID must contain digits only.');
    return;
  }
  hubstaffSavingUserId.value = row.userId;
  try {
    const res = await upsertWorktimeHubstaffId({
      userId: row.userId,
      hubstaffId: value || null,
    });
    row.hubstaffId = res.data?.data?.hubstaffId || '';
    row.hubstaffIdDraft = row.hubstaffId;
    row.hasHubstaffId = !!row.hubstaffId;
    toast.success(`Hubstaff ID updated for ${row.name}`);
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to save Hubstaff ID');
  } finally {
    hubstaffSavingUserId.value = '';
  }
};

const saveRowTarget = async (row) => {
  const targetMinutes = Number(row.targetMinutes) || 0;
  if (targetMinutes < 0 || targetMinutes > 24 * 60) {
    toast.warning('Target must be between 0 and 24 hours.');
    return;
  }

  try {
    await upsertWorktimeTarget({
      userId: row.userId,
      month: selectedMonth.value,
      targetMinutes,
    });
    row.targetMinutes = targetMinutes;
    row.targetLabel = toLabel(targetMinutes);
    row.isCustom = true;
    toast.success(`Updated ${row.name}`);
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to save target');
  }
};

const removeRowTarget = async (row) => {
  try {
    await deleteWorktimeTarget(row.userId, selectedMonth.value);
    row.targetMinutes = 13 * 60 + 30;
    row.targetLabel = toLabel(row.targetMinutes);
    row.isCustom = false;
    toast.success(`Reset ${row.name} to default target`);
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to reset target');
  }
};

const applyPresetToAll = async () => {
  if (!canManageTargets.value) return;
  if (!editableRows.value.length) return;
  bulkSaving.value = true;
  try {
    for (const row of editableRows.value) {
      const targetMinutes = selectedPresetMinutes.value;
      await upsertWorktimeTarget({
        userId: row.userId,
        month: selectedMonth.value,
        targetMinutes,
      });
      row.targetMinutes = targetMinutes;
      row.targetLabel = toLabel(targetMinutes);
      row.isCustom = true;
    }
    toast.success('Applied target to all users');
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to apply preset');
  } finally {
    bulkSaving.value = false;
  }
};

const groupedBuckets = computed(() => {
  const baseBuckets = [
    { key: 'NO_TARGET', label: 'No Target (0h)', minutes: 0 },
    { key: 'H12', label: '12h 00m', minutes: 12 * 60 },
    { key: 'H1330', label: '13h 30m', minutes: 13 * 60 + 30 },
    { key: 'H1530', label: '15h 30m', minutes: 15 * 60 + 30 },
  ];

  const customPresetBuckets = [];
  const seenMinutes = new Set(baseBuckets.map((b) => b.minutes));
  for (const p of presets.value) {
    if (isStaticPreset(p.key)) continue;
    const mins = Number(p.minutes) || 0;
    if (seenMinutes.has(mins)) continue;
    seenMinutes.add(mins);
    customPresetBuckets.push({
      key: p.key,
      label: p.label || toLabel(mins),
      minutes: mins,
    });
  }
  customPresetBuckets.sort((a, b) => a.minutes - b.minutes);

  const allPresetBuckets = [...baseBuckets, ...customPresetBuckets];
  const knownMinuteSet = new Set(allPresetBuckets.map((b) => b.minutes));
  allPresetBuckets.push({
    key: 'OTHER_CUSTOM',
    label: 'Other Custom',
    minutes: null,
    knownMinuteSet,
  });

  return allPresetBuckets.map((b) => {
    const users = editableRows.value
      .filter((u) => {
        if (b.minutes === null) return !knownMinuteSet.has(Number(u.targetMinutes) || 0);
        return (Number(u.targetMinutes) || 0) === b.minutes;
      })
      .sort((a, b2) => {
        const g1 = a.group || 'No Group';
        const g2 = b2.group || 'No Group';
        if (g1 !== g2) return g1.localeCompare(g2);
        return a.name.localeCompare(b2.name);
      });

    return {
      ...b,
      users,
    };
  });
});

const onDragUser = (u) => {
  draggedUser.value = u;
};

const onDropUserToBucket = async (minutes) => {
  if (!canManageTargets.value) return;
  if (!draggedUser.value || minutes === null) return;
  const row = editableRows.value.find((r) => r.userId === draggedUser.value.userId);
  if (!row) return;
  row.targetMinutes = minutes;
  await saveRowTarget(row);
  draggedUser.value = null;
};

const openCreatePresetModal = () => {
  if (!canManageTargets.value) return;
  editingPresetId.value = '';
  presetForm.value = {
    title: '',
    label: '',
    description: '',
    color: '#8b5cf6',
    hours: 13,
    minutes: 30,
  };
  presetModalOpen.value = true;
};

const openEditPresetModal = (preset) => {
  if (!canManageTargets.value) return;
  editingPresetId.value = preset._id || '';
  presetForm.value = {
    title: preset.title || '',
    label: preset.label || '',
    description: preset.description || '',
    color: preset.color || '#8b5cf6',
    hours: Math.floor((preset.minutes || 0) / 60),
    minutes: (preset.minutes || 0) % 60,
  };
  presetModalOpen.value = true;
};

const savePreset = async () => {
  if (!canManageTargets.value) return;
  const h = Number(presetForm.value.hours) || 0;
  const m = Number(presetForm.value.minutes) || 0;
  if (!presetForm.value.title.trim() || !presetForm.value.label.trim()) {
    toast.warning('Title and label are required.');
    return;
  }
  if (m < 0 || m > 59 || h < 0 || h > 24) {
    toast.warning('Enter valid hours/minutes.');
    return;
  }
  const minutes = h * 60 + m;
  if (minutes < 0 || minutes > 24 * 60) {
    toast.warning('Target must be between 0 and 24 hours.');
    return;
  }

  presetSaving.value = true;
  try {
    const payload = {
      title: presetForm.value.title.trim(),
      label: presetForm.value.label.trim(),
      description: presetForm.value.description.trim(),
      color: presetForm.value.color,
      minutes,
    };
    if (editingPresetId.value) {
      await updateWorktimeTargetPreset(editingPresetId.value, payload);
      toast.success('Preset updated');
    } else {
      await createWorktimeTargetPreset(payload);
      toast.success('Preset created');
    }
    presetModalOpen.value = false;
    await loadTargets();
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to save preset');
  } finally {
    presetSaving.value = false;
  }
};

const removePreset = async (preset) => {
  if (!canManageTargets.value) return;
  if (!preset?._id) return;
  try {
    await deleteWorktimeTargetPreset(preset._id);
    if (selectedPresetMinutes.value === preset.minutes) {
      selectedPresetMinutes.value = 13 * 60 + 30;
    }
    toast.success('Preset removed');
    await loadTargets();
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to remove preset');
  }
};

watch(selectedMonth, () => {
  loadTargets();
});

onMounted(() => {
  loadTargets();
  loadHubstaffUsers();
});
</script>

<style scoped>
.wf-settings {
  max-width: 1400px;
  margin: 0 auto;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.settings-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 12px;
}
.eyebrow {
  margin: 0;
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--text-tertiary);
}
.title {
  margin: 4px 0;
  font-size: 1.3rem;
}
.subtitle {
  margin: 0;
  color: var(--text-secondary);
  font-size: .9rem;
}
.month-select-wrap {
  min-width: 180px;
}
.month-select {
  margin-top: 4px;
}
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 12px;
}
.preset-section {
  margin-bottom: 0;
}

.preset-section .section-header {
  padding: 4px 4px 10px;
  margin-bottom: 6px;
}

.preset-section .section-actions {
  padding-right: 2px;
}

.preset-section .preset-grid {
  padding: 2px 4px 6px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}
.section-actions {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.readonly-badge {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border-medium);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
.section-title {
  margin: 0 0 10px;
  font-size: 1rem;
}
.section-note {
  margin: 0 0 10px;
  font-size: .85rem;
  color: var(--text-secondary);
}
.preset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
  gap: 8px;
}
.preset-chip {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.preset-actions {
  margin-top: 6px;
  display: inline-flex;
  gap: 6px;
}
.mini-btn {
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  border-radius: 6px;
  height: 28px;
  padding: 0 8px;
  font-size: .74rem;
  cursor: pointer;
}
.mini-btn.danger {
  color: #b42318;
}
.preset-title {
  margin: 0;
  font-size: .7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
}
.preset-chip.active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
}
.preset-chip span {
  color: var(--text-tertiary);
  font-size: .8rem;
}
.preset-chip small {
  font-size: .72rem;
  color: var(--text-tertiary);
}
.preset-chip.tone-neutral { border-left: 4px solid #64748b; }
.preset-chip.tone-blue { border-left: 4px solid #2563eb; }
.preset-chip.tone-green { border-left: 4px solid #10b981; }
.preset-chip.tone-amber { border-left: 4px solid #f59e0b; }
.preset-chip.tone-purple { border-left: 4px solid #8b5cf6; }
.wf-settings.readonly .preset-chip {
  cursor: default;
}
.wf-settings.readonly .bucket-user {
  cursor: default;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.label {
  font-size: .7rem;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-tertiary);
}
.input {
  height: 36px;
  border: 1px solid var(--border-medium);
  border-radius: 8px;
  padding: 0 10px;
  background: var(--bg-primary);
}
.avatar-fallback {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--color-primary-soft);
  color: var(--color-primary);
  font-size: .72rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.btn {
  height: 34px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  cursor: pointer;
  font-weight: 600;
}
.btn-primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}
.btn-ghost {
  color: var(--text-secondary);
}
.bucket-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}
.bucket {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: var(--bg-secondary);
}
.bucket-head {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border-light);
}
.bucket-head h3 {
  margin: 0;
  font-size: .86rem;
}
.bucket-body {
  min-height: 86px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.bucket-user {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid color-mix(in srgb, var(--group-accent, #94a3b8) 40%, var(--border-light));
  border-left: 4px solid var(--group-accent, #94a3b8);
  border-radius: 8px;
  background: var(--bg-primary);
  cursor: grab;
}
.bucket-meta {
  display: flex;
  flex-direction: column;
}
.bucket-meta small {
  color: var(--text-tertiary);
}
.hubstaff-table-wrap {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  overflow: auto;
}
.hubstaff-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 880px;
}
.hubstaff-table th,
.hubstaff-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border-light);
  text-align: left;
  vertical-align: middle;
}
.hubstaff-table thead th {
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .05em;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
}
.hubstaff-user {
  display: flex;
  align-items: center;
  gap: 8px;
}
.hubstaff-user-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hubstaff-user-meta small {
  color: var(--text-tertiary);
}
.hubstaff-input {
  min-width: 140px;
}
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  font-size: .72rem;
  font-weight: 700;
  text-transform: uppercase;
}
.connect-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: .72rem;
  font-weight: 700;
  border: 1px solid transparent;
}
.connect-pill.ok {
  color: #047857;
  background: color-mix(in srgb, #10b981 12%, var(--bg-primary));
  border-color: color-mix(in srgb, #10b981 40%, var(--border-light));
}
.connect-pill.missing {
  color: #b45309;
  background: color-mix(in srgb, #f59e0b 12%, var(--bg-primary));
  border-color: color-mix(in srgb, #f59e0b 40%, var(--border-light));
}
.hubstaff-empty {
  text-align: center;
  color: var(--text-tertiary);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(2, 8, 23, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal {
  width: min(620px, 95vw);
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 12px;
}
.modal-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.modal-head h3 {
  margin: 0;
  font-size: 1rem;
}
.modal-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.field.split {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.field.full {
  grid-column: 1 / -1;
}
.modal-actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
}
</style>

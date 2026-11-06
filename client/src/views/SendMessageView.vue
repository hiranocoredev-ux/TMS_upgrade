<template>
  <div class="send-page">
    <section class="card hero">
      <div>
        <h2>Send Message</h2>
        <p>Send manual notifications to all users, selected users, or group members.</p>
      </div>
      <button class="btn-primary" :disabled="sending || !canSend" @click="sendNow">
        {{ sending ? 'Sending...' : 'Send Message' }}
      </button>
    </section>

    <section class="card block">
      <div class="grid">
        <label class="field">
          <span>Target type</span>
          <select v-model="targetType">
            <option value="all">All users</option>
            <option value="users">Selected users</option>
            <option v-if="canTargetGroups" value="groups">Group members</option>
          </select>
        </label>
      </div>

      <label v-if="targetType === 'groups'" class="field">
        <span>Groups</span>
        <div class="selector">
          <label v-for="g in selectableGroups" :key="g" class="row">
            <input :checked="selectedGroups.includes(g)" type="checkbox" @change="toggleGroup(g, $event.target.checked)" />
            <span>{{ g }}</span>
          </label>
        </div>
      </label>

      <label v-if="targetType === 'users'" class="field">
        <span>Users</span>
        <input v-model="keyword" type="text" placeholder="Search users..." />
        <div class="selector selector--users">
          <label v-for="u in filteredUsers" :key="u.userId" class="row row--user">
            <input :checked="selectedUsers.includes(String(u.userId))" type="checkbox" @change="toggleUser(u.userId, $event.target.checked)" />
            <UserAvatar :name="u.name" :profile-image="u.avatarUrl" :size="24" :tooltip="false" />
            <span class="name">{{ u.name }}</span>
            <small>{{ u.group || 'No Group' }}</small>
          </label>
        </div>
      </label>

      <label class="field">
        <span>Message</span>
        <textarea v-model="message" rows="4" placeholder="Type your message..." />
      </label>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import UserAvatar from '../components/UserAvatar.vue';
import { getMessageTargets, sendManualNotification } from '../services/notifications';

const users = ref([]);
const groups = ref([]);
const canTargetGroups = ref(false);
const forceGroupCode = ref('');
const targetType = ref('all');
const selectedGroups = ref([]);
const selectedUsers = ref([]);
const keyword = ref('');
const message = ref('');
const sending = ref(false);

const selectableGroups = computed(() => (forceGroupCode.value ? [forceGroupCode.value] : groups.value));
const filteredUsers = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  if (!q) return users.value;
  return users.value.filter((u) => String(u.name || '').toLowerCase().includes(q) || String(u.group || '').toLowerCase().includes(q));
});

const canSend = computed(() => {
  if (!message.value.trim()) return false;
  if (targetType.value === 'groups') return selectedGroups.value.length > 0;
  if (targetType.value === 'users') return selectedUsers.value.length > 0;
  return true;
});

const toggleGroup = (group, checked) => {
  const set = new Set(selectedGroups.value);
  if (checked) set.add(group);
  else set.delete(group);
  selectedGroups.value = [...set];
};

const toggleUser = (userId, checked) => {
  const set = new Set(selectedUsers.value);
  if (checked) set.add(String(userId));
  else set.delete(String(userId));
  selectedUsers.value = [...set];
};

const sendNow = async () => {
  sending.value = true;
  try {
    await sendManualNotification({
      targetType: targetType.value,
      groupCodes: selectedGroups.value,
      userIds: selectedUsers.value,
      message: message.value,
    });
    message.value = '';
  } finally {
    sending.value = false;
  }
};

onMounted(async () => {
  const res = await getMessageTargets();
  users.value = res.data?.users || [];
  groups.value = res.data?.groups || [];
  canTargetGroups.value = !!res.data?.canTargetGroups;
  forceGroupCode.value = res.data?.forceGroupCode || '';
  if (forceGroupCode.value) selectedGroups.value = [forceGroupCode.value];
});
</script>

<style scoped>
.send-page { display: flex; flex-direction: column; gap: 12px; max-width: 1080px; margin: 0 auto; }
.hero { padding: 14px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.hero h2 { margin: 0; }
.hero p { margin: 4px 0 0; color: var(--text-secondary); font-size: 0.82rem; }
.block { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit,minmax(220px,1fr)); gap: 10px; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field span { font-size: 0.75rem; color: var(--text-secondary); font-weight: 700; }
.selector { border: 1px solid var(--border-light); border-radius: 10px; background: #fff; max-height: 230px; overflow: auto; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
.row { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; }
.row--user { border: 1px solid var(--border-light); border-radius: 8px; padding: 6px; }
.name { font-weight: 600; }
.row small { margin-left: auto; color: var(--text-secondary); font-size: 0.7rem; }
.send-page :is(input[type='text'], textarea, select) { width: 100%; border: 1px solid var(--border-light); border-radius: 10px; padding: 9px 10px; background: #fff; }
</style>


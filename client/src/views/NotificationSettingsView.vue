<template>
  <div class="notify-page">
    <section class="card page-head">
      <div class="page-head__copy">
        <div class="page-head__title-row">
          <h2>Notify Settings</h2>
          <span class="role-chip" :class="canEdit ? 'role-chip--admin' : 'role-chip--readonly'">
            {{ canEdit ? 'Super Admin Edit Mode' : 'Read-only Mode' }}
          </span>
        </div>
        <p>Professional notification control center for templates, schedules, channels, and manual broadcasts.</p>
      </div>
      <div class="head-actions">
        <button v-if="canEdit" class="btn-primary" :disabled="saving" @click="save">
          {{ saving ? 'Saving...' : 'Save Settings' }}
        </button>
      </div>
    </section>

    <section class="card section section--transport">
      <div class="section-head">
        <h3>IP Message Transport</h3>
        <p>Central transport used by scheduler and manual sends.</p>
      </div>
      <div class="grid">
        <label class="field field--toggle">
          <span>Enabled</span>
          <span class="toggle-row">
            <input v-model="form.ipMessage.enabled" :disabled="!canEdit" type="checkbox" />
            <em>{{ form.ipMessage.enabled ? 'On' : 'Off' }}</em>
          </span>
        </label>
        <label class="field">
          <span>ipcmd path (server)</span>
          <input v-model="form.ipMessage.ipcmdPath" :disabled="!canEdit" type="text" />
        </label>
        <label class="field">
          <span>Sender label</span>
          <input v-model="form.ipMessage.senderLabel" :disabled="!canEdit" type="text" />
        </label>
      </div>
    </section>

    <section class="card section">
      <div class="section-head">
        <h3>Connection States</h3>
        <p>Live per-user channel readiness and overall connection status.</p>
      </div>
      <div class="state-grid">
        <article v-for="u in visibleStateUsers" :key="u.userId" class="state-card">
          <div class="state-user">
            <UserAvatar :name="u.name" :profile-image="u.avatarUrl" :size="32" :tooltip="false" />
            <div class="state-user__meta">
              <strong>{{ u.name }}</strong>
              <small>{{ u.group || 'No Group' }}</small>
            </div>
            <span class="total-chip" :class="u.notifyState?.totalConnected ? 'total-chip--on' : 'total-chip--off'">
              {{ u.notifyState?.enabled ? 'Notify Enabled' : 'Notify Disabled' }}
            </span>
            <button
              v-if="canEdit && u.notifyState?.totalConnected"
              class="btn-secondary state-test-btn"
              :disabled="testingUserId === u.userId"
              @click="testUserNow(u.userId)"
            >
              {{ testingUserId === u.userId ? 'Testing...' : 'Test' }}
            </button>
          </div>
          <div class="state-tools">
            <span class="tool-chip tool-chip--provider" :class="u.notifyState?.slackConnected ? 'tool-chip--on' : 'tool-chip--off'">
              <span class="tool-icon" aria-hidden="true"><img src="/notify-icons/slack.png" alt="" /></span>
              <span>Slack</span>
            </span>
            <span class="tool-chip tool-chip--provider" :class="u.notifyState?.telegramConnected ? 'tool-chip--on' : 'tool-chip--off'">
              <span class="tool-icon" aria-hidden="true"><img src="/notify-icons/telegram.png" alt="" /></span>
              <span>Telegram</span>
            </span>
            <span class="tool-chip tool-chip--provider" :class="u.notifyState?.ipMessageConnected ? 'tool-chip--on' : 'tool-chip--off'">
              <span class="tool-icon" aria-hidden="true"><img src="/notify-icons/ipmessage.png" alt="" /></span>
              <span>IP Message</span>
            </span>
            <span class="tool-chip" :class="u.notifyState?.totalConnected ? 'tool-chip--on' : 'tool-chip--off'">
              {{ u.notifyState?.totalConnected ? 'Connection Ready' : 'Connection Missing' }}
            </span>
          </div>
        </article>
      </div>
    </section>

    <section class="card section">
      <div class="section-head">
        <h3>Report Reminders</h3>
        <p>Automated reminders for missing daily, weekly, and monthly report submissions.</p>
      </div>
      <div class="columns">
        <article class="mini">
          <h4>Daily</h4>
          <label class="inline-toggle"><input v-model="form.reportReminder.daily.enabled" :disabled="!canEdit" type="checkbox" /> Enabled</label>
          <label>Time EST <input v-model="form.reportReminder.daily.timeEst" :disabled="!canEdit" type="time" /></label>
          <label>Message <textarea v-model="form.reportReminder.daily.templateUser" :disabled="!canEdit" rows="3" /></label>
        </article>
        <article class="mini">
          <h4>Weekly (week end)</h4>
          <label class="inline-toggle"><input v-model="form.reportReminder.weekly.enabled" :disabled="!canEdit" type="checkbox" /> Enabled</label>
          <label>Time EST <input v-model="form.reportReminder.weekly.timeEst" :disabled="!canEdit" type="time" /></label>
          <label>Message <textarea v-model="form.reportReminder.weekly.templateUser" :disabled="!canEdit" rows="3" /></label>
        </article>
        <article class="mini">
          <h4>Monthly (month end)</h4>
          <label class="inline-toggle"><input v-model="form.reportReminder.monthly.enabled" :disabled="!canEdit" type="checkbox" /> Enabled</label>
          <label>Time EST <input v-model="form.reportReminder.monthly.timeEst" :disabled="!canEdit" type="time" /></label>
          <label>Message <textarea v-model="form.reportReminder.monthly.templateUser" :disabled="!canEdit" rows="3" /></label>
        </article>
      </div>
    </section>

    <section class="card section">
      <div class="section-head">
        <h3>Worktime Summarize Alert</h3>
        <p>End-of-day threshold alerts for users, group bosses, and super admins.</p>
      </div>
      <div class="grid">
        <label class="field field--toggle"><span>Enabled</span><span class="toggle-row"><input v-model="form.worktimeCheck.enabled" :disabled="!canEdit" type="checkbox" /><em>{{ form.worktimeCheck.enabled ? 'On' : 'Off' }}</em></span></label>
        <label class="field"><span>Check time (EST)</span><input v-model="form.worktimeCheck.timeEst" :disabled="!canEdit" type="time" /></label>
        <label class="field"><span>Threshold (%)</span><input v-model.number="form.worktimeCheck.thresholdPercent" :disabled="!canEdit" type="number" min="1" max="300" /></label>
      </div>
      <div class="columns">
        <article class="mini"><h4>User message</h4><textarea v-model="form.worktimeCheck.templateUser" :disabled="!canEdit" rows="3" /></article>
        <article class="mini"><h4>Group boss message</h4><textarea v-model="form.worktimeCheck.templateBoss" :disabled="!canEdit" rows="3" /></article>
        <article class="mini"><h4>Super admin message</h4><textarea v-model="form.worktimeCheck.templateAdmin" :disabled="!canEdit" rows="3" /></article>
      </div>
    </section>

    <section class="card section">
      <div class="section-head">
        <h3>Penalty Notification</h3>
        <p>Triggered instantly when penalty points are applied to a user.</p>
      </div>
      <label class="inline-toggle"><input v-model="form.penaltyNotify.enabled" :disabled="!canEdit" type="checkbox" /> Enabled</label>
      <div class="columns">
        <article class="mini"><h4>User message</h4><textarea v-model="form.penaltyNotify.templateUser" :disabled="!canEdit" rows="3" /></article>
        <article class="mini"><h4>Group boss message</h4><textarea v-model="form.penaltyNotify.templateBoss" :disabled="!canEdit" rows="3" /></article>
      </div>
    </section>

    <section v-if="canEdit" class="card section">
      <div class="section-head">
        <h3>Recent Delivery Logs</h3>
        <p>Recipient-focused view with user/group/all context.</p>
      </div>
      <button class="btn-secondary" @click="loadLogs">Refresh Logs</button>
      <div class="logs">
        <div v-for="row in logs" :key="row._id" class="log-row">
          <div class="log-recipient">
            <template v-if="row.recipientKind === 'user'">
              <UserAvatar
                :name="row.recipientUser?.name || row.recipientLabel || 'User'"
                :profile-image="row.recipientUser?.avatarUrl || ''"
                :size="28"
                :tooltip="false"
              />
              <div class="log-recipient__meta">
                <strong>{{ row.recipientUser?.name || row.recipientLabel }}</strong>
                <small>{{ row.recipientUser?.group || row.recipientGroup || 'No Group' }}</small>
              </div>
            </template>
            <template v-else-if="row.recipientKind === 'all'">
              <span class="target-chip target-chip--all">ALL</span>
              <div class="log-recipient__meta">
                <strong>All users</strong>
                <small>broadcast target</small>
              </div>
            </template>
            <template v-else>
              <span class="target-chip target-chip--group">GROUP</span>
              <div class="log-recipient__meta">
                <strong>{{ row.recipientLabel || 'Group target' }}</strong>
                <small>manual group send</small>
              </div>
            </template>
          </div>
          <span class="status-chip" :class="statusChipClass(row.status)">{{ row.status }}</span>
          <span class="log-type">{{ row.type }}</span>
          <span class="log-time">{{ formatLogTime(row.createdAt) }}</span>
          <span class="log-error">{{ row.error || '—' }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../composables/useAuth';
import { normalizeRole, ROLES, isFullAdminRole } from '../constants/roles';
import { sortUsersByGroup } from '../utils/userOrder';
import UserAvatar from '../components/UserAvatar.vue';
import {
  getNotificationLogs,
  getNotificationSettings,
  testUserConnectionByAdmin,
  updateNotificationSettingsAdmin,
} from '../services/notifications';

const auth = useAuthStore();
const canEdit = computed(() => isFullAdminRole(auth.user?.role, auth.user?.degree));
const saving = ref(false);
const testingUserId = ref('');
const logs = ref([]);
const users = ref([]);
const groups = ref([]);
const form = ref({
  ipMessage: { enabled: true, ipcmdPath: '', senderLabel: 'TMS System' },
  reportReminder: {
    daily: { enabled: true, timeEst: '23:00', templateUser: '' },
    weekly: { enabled: true, timeEst: '20:00', templateUser: '' },
    monthly: { enabled: true, timeEst: '20:00', templateUser: '' },
  },
  worktimeCheck: {
    enabled: true, timeEst: '23:15', thresholdPercent: 100, templateUser: '', templateBoss: '', templateAdmin: '',
  },
  penaltyNotify: { enabled: true, templateUser: '', templateBoss: '' },
  manualNotify: { enabled: true, templateDefault: '[TMS] {message}' },
});
const visibleStateUsers = computed(() => {
  if (canEdit.value) {
    // The system-wide order: by team, each team's boss first, then by name.
    return sortUsersByGroup(users.value, groups.value);
  }
  const me = String(auth.user?._id || auth.user?.id || '');
  return users.value.filter((u) => String(u.userId) === me);
});

const load = async () => {
  const res = await getNotificationSettings();
  form.value = res.data?.settings || form.value;
  users.value = res.data?.users || [];
  groups.value = res.data?.groups || [];
  if (canEdit.value) await loadLogs();
};

const save = async () => {
  if (!canEdit.value) return;
  saving.value = true;
  try {
    await updateNotificationSettingsAdmin(form.value);
  } finally {
    saving.value = false;
  }
};

const testUserNow = async (userId) => {
  if (!canEdit.value) return;
  testingUserId.value = String(userId);
  try {
    await testUserConnectionByAdmin(userId);
  } finally {
    testingUserId.value = '';
  }
};

const loadLogs = async () => {
  if (!canEdit.value) return;
  const res = await getNotificationLogs(120);
  logs.value = res.data?.logs || [];
};

const statusChipClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'sent') return 'status-chip--sent';
  if (s === 'failed') return 'status-chip--failed';
  return 'status-chip--skipped';
};

const formatLogTime = (iso) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '-');
  return d.toLocaleString();
};

onMounted(load);
</script>

<style scoped>
.notify-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1240px;
  margin: 0 auto;
  padding-bottom: 16px;
}
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 14px;
  padding: 18px;
  border: 1px solid color-mix(in srgb, var(--color-primary, #6366f1) 20%, var(--border-light, #e2e8f0));
  background:
    radial-gradient(circle at 12% 10%, color-mix(in srgb, var(--color-primary, #6366f1) 20%, transparent) 0%, transparent 58%),
    linear-gradient(180deg, #ffffff, #fbfdff);
  border-radius: 14px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  position: sticky;
  top: 0;
  z-index: 4;
}
.page-head__copy h2 {
  margin: 0;
  font-size: 1.2rem;
}
.page-head__title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.role-chip {
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.03em;
}
.role-chip--admin {
  background: #ecfdf3;
  color: #027a48;
  border: 1px solid #a6f4c5;
}
.role-chip--readonly {
  background: #fff7ed;
  color: #b54708;
  border: 1px solid #fed7aa;
}
.page-head__copy p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  font-size: 0.82rem;
  max-width: 70ch;
  line-height: 1.45;
}
.head-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.head-actions :is(.btn-primary, .btn-secondary) {
  min-height: 36px;
  border-radius: 10px;
  font-weight: 700;
  padding: 0 12px;
}
.section {
  padding: 15px;
  border-radius: 14px;
  border: 1px solid var(--border-light);
  background: linear-gradient(180deg, #ffffff, #fcfdff);
  box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
}
.section--transport {
  background:
    radial-gradient(circle at 100% 0%, rgba(59, 130, 246, 0.07), transparent 42%),
    linear-gradient(180deg, #ffffff, #fcfdff);
}
.section--manual {
  background:
    radial-gradient(circle at 0% 0%, rgba(99, 102, 241, 0.08), transparent 36%),
    linear-gradient(180deg, #ffffff, #fcfdff);
}
.section-head {
  margin-bottom: 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--border-light, #e2e8f0) 70%, transparent);
  padding-bottom: 8px;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
}
.section-head h3 {
  margin: 0;
  font-size: 1.02rem;
}
.section-head p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 0.76rem;
  line-height: 1.4;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.field--toggle {
  justify-content: center;
}
.toggle-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
}
.toggle-row em {
  font-style: normal;
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--text-secondary);
  background: #f1f5f9;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  padding: 2px 8px;
}
.inline-toggle {
  display: inline-flex !important;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 0.76rem !important;
  margin-bottom: 8px;
}
.field span {
  font-size: 0.74rem;
  color: var(--text-secondary);
  font-weight: 700;
  letter-spacing: 0.02em;
}
.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
  gap: 12px;
}
.mini {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 12px;
  background: linear-gradient(180deg, #ffffff, #fbfdff);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.6);
}
.mini h4 {
  margin: 0 0 7px;
  font-size: 0.84rem;
  padding-bottom: 6px;
  border-bottom: 1px dashed var(--border-light);
}
.mini label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 7px;
  font-size: 0.74rem;
}
.manual-box {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px solid color-mix(in srgb, var(--color-primary, #6366f1) 20%, var(--border-light, #e2e8f0));
  border-radius: 12px;
  background: linear-gradient(180deg, color-mix(in srgb, var(--color-primary, #6366f1) 4%, #fff), #fff);
}
.selector-list {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff, #fbfcff);
  max-height: 200px;
  overflow: auto;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.selector-list::-webkit-scrollbar { width: 8px; }
.selector-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 999px; }
.selector-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
}
.selector-list--users { max-height: 260px; }
.selector-item--user {
  border: 1px solid var(--border-light);
  border-radius: 9px;
  padding: 6px;
  background: #fff;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.selector-item--user:hover {
  background: color-mix(in srgb, var(--color-primary, #6366f1) 5%, #fff);
  border-color: color-mix(in srgb, var(--color-primary, #6366f1) 20%, var(--border-light, #e2e8f0));
}
.user-name { font-weight: 600; color: var(--text-primary); }
.user-group { margin-left: auto; font-size: 0.72rem; color: var(--text-secondary); }
.hint-text {
  color: var(--text-secondary);
  font-size: 0.72rem;
  font-weight: 600;
}
.btn-send {
  min-height: 40px;
  font-weight: 800;
  border-radius: 12px;
  box-shadow: 0 8px 18px rgba(79, 70, 229, 0.22);
}
.logs {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  max-height: 330px;
  overflow: auto;
}
.state-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 10px;
}
.state-card {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: linear-gradient(180deg, #ffffff, #f8fbff);
  padding: 10px;
}
.state-user {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.state-user__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.state-user__meta strong {
  font-size: 0.82rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.state-user__meta small {
  font-size: 0.7rem;
  color: var(--text-secondary);
}
.total-chip {
  margin-left: auto;
  border-radius: 999px;
  padding: 3px 9px;
  font-size: 0.67rem;
  font-weight: 800;
}
.total-chip--on {
  background: #ecfdf3;
  color: #027a48;
  border: 1px solid #a6f4c5;
}
.total-chip--off {
  background: #fff1f2;
  color: #b42318;
  border: 1px solid #fecdd3;
}
.state-test-btn {
  margin-left: auto;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
}
.state-tools {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.tool-chip {
  border-radius: 999px;
  padding: 3px 8px;
  font-size: 0.66rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.tool-chip--provider {
  padding-left: 6px;
}
.tool-icon {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #fff;
  border: 1px solid #dbe4ef;
}
.tool-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.tool-chip--on {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.tool-chip--off {
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
}
.log-row {
  display: grid;
  grid-template-columns: 1.3fr .65fr .9fr 1fr 1.5fr;
  gap: 8px;
  font-size: 0.73rem;
  border: 1px solid var(--border-light);
  border-radius: 9px;
  padding: 7px;
  background: #fff;
  align-items: center;
}
.log-recipient {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.log-recipient__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.log-recipient__meta strong {
  color: var(--text-primary);
  font-size: 0.76rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.log-recipient__meta small {
  color: var(--text-secondary);
  font-size: 0.68rem;
}
.target-chip {
  min-width: 36px;
  padding: 4px 7px;
  border-radius: 999px;
  text-align: center;
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}
.target-chip--all {
  background: #eff6ff;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
}
.target-chip--group {
  background: #f5f3ff;
  color: #6d28d9;
  border: 1px solid #ddd6fe;
}
.status-chip {
  width: fit-content;
  font-weight: 800;
  text-transform: uppercase;
  font-size: 0.66rem;
  border-radius: 999px;
  padding: 4px 8px;
  border: 1px solid transparent;
}
.status-chip--sent {
  color: #047857;
  background: #ecfdf3;
  border-color: #a7f3d0;
}
.status-chip--failed {
  color: #b42318;
  background: #fff1f2;
  border-color: #fecdd3;
}
.status-chip--skipped {
  color: #92400e;
  background: #fffbeb;
  border-color: #fde68a;
}
.log-type {
  font-weight: 700;
  color: var(--text-primary);
}
.log-time {
  color: var(--text-secondary);
}
.log-error {
  color: #b42318;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Coherent, professional form controls */
.notify-page :is(input[type='text'], input[type='time'], input[type='number'], textarea, select) {
  width: 100%;
  border: 1px solid var(--border-light);
  border-radius: 10px;
  background: #fff;
  color: var(--text-primary);
  padding: 9px 11px;
  font-size: 0.82rem;
  line-height: 1.35;
  transition: border-color 0.14s ease, box-shadow 0.14s ease;
}
.notify-page input[type='time'] {
  width: 11.25rem;
  max-width: 100%;
  min-height: 2.15rem;
  padding: 0.35rem 0.55rem;
  font-size: 0.78rem;
}
.notify-page select {
  background-image: linear-gradient(45deg, transparent 50%, #64748b 50%), linear-gradient(135deg, #64748b 50%, transparent 50%);
  background-position: calc(100% - 16px) calc(50% + 1px), calc(100% - 11px) calc(50% + 1px);
  background-size: 5px 5px, 5px 5px;
  background-repeat: no-repeat;
  appearance: none;
}
.notify-page textarea {
  min-height: 94px;
  resize: vertical;
}
.notify-page :is(input[type='text'], input[type='time'], input[type='number'], textarea, select):focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary, #6366f1) 20%, transparent);
}
.notify-page input[type='checkbox'] {
  accent-color: var(--color-primary, #4f46e5);
}

@media (max-width: 980px) {
  .page-head {
    flex-direction: column;
    align-items: stretch;
    position: static;
  }
  .head-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 760px) {
  .notify-page {
    gap: 10px;
  }
  .section {
    padding: 10px;
  }
  .columns {
    grid-template-columns: 1fr;
  }
  .grid {
    grid-template-columns: 1fr;
  }
  .log-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .notify-page input[type='time'] {
    width: 100%;
  }
  .log-error {
    white-space: normal;
  }
}
</style>


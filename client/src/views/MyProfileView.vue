<template>
  <div class="my-profile-view">
    <section class="card hero-card">
      <div class="profile-header-row">
        <UserAvatar :name="profile.name || 'User'" :profile-image="displayAvatar" :size="68" :tooltip="false" />
        <div class="profile-header-text">
          <h2>My Profile</h2>
          <p>Manage your account details and security settings.</p>
          <div class="meta-chips">
            <span class="meta-chip">{{ formatRole(profile.role) }}</span>
            <span class="meta-chip">{{ profile.group || 'No Group' }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-head">
        <h3>Profile Information</h3>
      </div>
      <div class="info-grid">
        <div class="info-item">
          <label>Name</label>
          <span class="info-value">{{ profile.name || '-' }}</span>
        </div>
        <div class="info-item">
          <label>Email</label>
          <span class="info-value">{{ profile.email || '-' }}</span>
        </div>
        <div class="info-item">
          <label>Role</label>
          <span class="info-value">{{ formatRole(profile.role) }}</span>
        </div>
        <div class="info-item">
          <label>Group</label>
          <span class="info-value">{{ profile.group || '-' }}</span>
        </div>
      </div>
    </section>

    <section class="card section-card">
      <div class="section-head">
        <h3>Notification Settings</h3>
        <p>Configure Slack, Telegram, or IP Message. At least one connection is required to enable notifications.</p>
      </div>
      <div class="notify-master-row">
        <div class="bool-field">
          <span>Enable notifications</span>
          <div class="bool-group" :class="{ 'bool-group--disabled': !hasAnyNotifyConnection }">
            <button
              type="button"
              class="bool-btn"
              :class="{ 'bool-btn--active': notificationForm.enabled }"
              :disabled="!hasAnyNotifyConnection"
              @click="notificationForm.enabled = true"
            >
              True
            </button>
            <button
              type="button"
              class="bool-btn"
              :class="{ 'bool-btn--active': !notificationForm.enabled }"
              :disabled="!hasAnyNotifyConnection"
              @click="notificationForm.enabled = false"
            >
              False
            </button>
          </div>
        </div>
        <span v-if="!hasAnyNotifyConnection" class="warn-badge">No connected channel</span>
      </div>

      <div class="notify-grid">
        <article class="notify-card">
          <header class="notify-card__head">
            <h4 class="provider-title">
              <img src="/notify-icons/slack.png" alt="" />
              <span>Slack</span>
            </h4>
            <span class="state-chip" :class="notificationForm.slack.webhookUrl ? 'state-chip--ok' : 'state-chip--warn'">
              {{ notificationForm.slack.webhookUrl ? 'Connected' : 'Not set' }}
            </span>
          </header>
          <div class="notify-help notify-help--guide">
            <p><strong>How to set up Slack (Incoming Webhook)</strong></p>
            <ol>
              <li>Open <a href="https://api.slack.com/apps" target="_blank" rel="noopener noreferrer">https://api.slack.com/apps</a>.</li>
              <li>Click <em>Create New App</em> and select your Slack workspace.</li>
              <li>Go to <em>Incoming Webhooks</em> and turn it <em>On</em>.</li>
              <li>Click <em>Add New Webhook to Workspace</em>, choose a channel, and allow access.</li>
              <li>Copy the generated webhook URL and paste it below.</li>
            </ol>
            <p class="notify-example">Example URL: <code>https://hooks.slack.com/services/T000/B000/XXXX</code></p>
          </div>
          <div class="form-group">
            <label>Incoming webhook URL</label>
            <input v-model.trim="notificationForm.slack.webhookUrl" type="text" placeholder="https://hooks.slack.com/services/..." />
          </div>
          <div class="bool-field bool-field--small">
            <span>Use Slack for notifications</span>
            <div class="bool-group" :class="{ 'bool-group--disabled': !notificationForm.slack.webhookUrl }">
              <button
                type="button"
                class="bool-btn"
                :class="{ 'bool-btn--active': notificationForm.slack.enabled }"
                :disabled="!notificationForm.slack.webhookUrl"
                @click="notificationForm.slack.enabled = true"
              >
                True
              </button>
              <button
                type="button"
                class="bool-btn"
                :class="{ 'bool-btn--active': !notificationForm.slack.enabled }"
                :disabled="!notificationForm.slack.webhookUrl"
                @click="notificationForm.slack.enabled = false"
              >
                False
              </button>
            </div>
          </div>
          <div class="channel-actions">
            <button class="btn-secondary" :disabled="testingChannel === 'slack' || !notificationForm.slack.webhookUrl" @click="runTest('slack')">
              {{ testingChannel === 'slack' ? 'Testing...' : 'Test Connection' }}
            </button>
          </div>
        </article>

        <article class="notify-card">
          <header class="notify-card__head">
            <h4 class="provider-title">
              <img src="/notify-icons/telegram.png" alt="" />
              <span>Telegram</span>
            </h4>
            <span class="state-chip" :class="telegramConnected ? 'state-chip--ok' : 'state-chip--warn'">
              {{ telegramConnected ? 'Connected' : 'Not set' }}
            </span>
          </header>
          <div class="notify-help notify-help--guide">
            <p><strong>How to set up Telegram Bot</strong></p>
            <ol>
              <li>Open Telegram and chat with <em>@BotFather</em>.</li>
              <li>Send <code>/newbot</code> and follow steps to create your bot.</li>
              <li>Copy the bot token from BotFather and paste into <em>Bot token</em>.</li>
              <li>Send at least one message to your bot from your target user/chat/channel.</li>
              <li>Open <code>https://api.telegram.org/bot&lt;BOT_TOKEN&gt;/getUpdates</code> in browser.</li>
              <li>Find <code>chat.id</code> in the response and paste into <em>Chat ID</em> (or use <code>@channelusername</code> for public channels).</li>
            </ol>
            <p class="notify-example">Send API used by system: <code>https://api.telegram.org/bot&lt;BOT_TOKEN&gt;/sendMessage</code></p>
          </div>
          <div class="form-group">
            <label>Bot token</label>
            <input v-model.trim="notificationForm.telegram.botToken" type="text" placeholder="123456:ABC..." />
          </div>
          <div class="form-group">
            <label>Chat ID (or @channelusername)</label>
            <input v-model.trim="notificationForm.telegram.chatId" type="text" placeholder="123456789 or @my_channel" />
          </div>
          <div class="bool-field bool-field--small">
            <span>Use Telegram for notifications</span>
            <div class="bool-group" :class="{ 'bool-group--disabled': !telegramConnected }">
              <button
                type="button"
                class="bool-btn"
                :class="{ 'bool-btn--active': notificationForm.telegram.enabled }"
                :disabled="!telegramConnected"
                @click="notificationForm.telegram.enabled = true"
              >
                True
              </button>
              <button
                type="button"
                class="bool-btn"
                :class="{ 'bool-btn--active': !notificationForm.telegram.enabled }"
                :disabled="!telegramConnected"
                @click="notificationForm.telegram.enabled = false"
              >
                False
              </button>
            </div>
          </div>
          <div class="channel-actions">
            <button class="btn-secondary" :disabled="testingChannel === 'telegram' || !telegramConnected" @click="runTest('telegram')">
              {{ testingChannel === 'telegram' ? 'Testing...' : 'Test Connection' }}
            </button>
          </div>
        </article>

        <article class="notify-card">
          <header class="notify-card__head">
            <h4 class="provider-title">
              <img src="/notify-icons/ipmessage.png" alt="" />
              <span>IP Message</span>
            </h4>
            <span class="state-chip" :class="ipMessageConnected ? 'state-chip--ok' : 'state-chip--warn'">
              {{ ipMessageConnected ? 'Connected' : 'Not set' }}
            </span>
          </header>
          <div class="notify-help notify-help--guide">
            <p><strong>How to set up IP Message</strong></p>
            <ol>
              <li>Install IP Messenger and confirm <code>ipcmd.exe</code> exists on your PC.</li>
              <li>Find your target receiver IP address in your LAN (example: <code>192.168.10.154</code>).</li>
              <li>Set <em>Receiver IP address</em> to that target machine IP.</li>
              <li>Set <em>Local ipcmd.exe path</em> to your real file path (example below).</li>
              <li>Open terminal and run: <code>"&lt;ipcmd-path&gt;" send &lt;ip-address&gt; "TMS test"</code>.</li>
              <li>If terminal send works, click <em>Test Connection</em> here.</li>
            </ol>
            <p class="notify-example">Example path: <code>C:\Users\YourName\AppData\Local\IPMsg\ipcmd.exe</code></p>
          </div>
          <div class="form-group">
            <label>Receiver IP address</label>
            <input v-model.trim="notificationForm.ipMessage.ipAddress" type="text" placeholder="192.168.1.23" />
          </div>
          <div class="form-group">
            <label>Local ipcmd.exe path</label>
            <input v-model.trim="notificationForm.ipMessage.ipcmdPath" type="text" placeholder="C:\\Program Files\\IPMsg\\ipcmd.exe" />
          </div>
          <div class="bool-field bool-field--small">
            <span>Use IP Message for notifications</span>
            <div class="bool-group" :class="{ 'bool-group--disabled': !ipMessageConnected }">
              <button
                type="button"
                class="bool-btn"
                :class="{ 'bool-btn--active': notificationForm.ipMessage.enabled }"
                :disabled="!ipMessageConnected"
                @click="notificationForm.ipMessage.enabled = true"
              >
                True
              </button>
              <button
                type="button"
                class="bool-btn"
                :class="{ 'bool-btn--active': !notificationForm.ipMessage.enabled }"
                :disabled="!ipMessageConnected"
                @click="notificationForm.ipMessage.enabled = false"
              >
                False
              </button>
            </div>
          </div>
          <div class="channel-actions">
            <button class="btn-secondary" :disabled="testingChannel === 'ipMessage' || !ipMessageConnected" @click="runTest('ipMessage')">
              {{ testingChannel === 'ipMessage' ? 'Testing...' : 'Test Connection' }}
            </button>
          </div>
        </article>
      </div>
      <div class="form-actions">
        <button class="btn-primary" :disabled="savingNotify" @click="saveNotificationSettings">
          {{ savingNotify ? 'Saving...' : 'Save Notification Settings' }}
        </button>
      </div>
    </section>

    <div class="security-grid">
      <section class="card section-card">
        <div class="section-head">
          <h3>Avatar</h3>
          <p>Upload a clear profile photo.</p>
        </div>
        <form class="form-block" @submit.prevent="handleAvatarUpload">
          <label class="file-picker">
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              @change="handleAvatarChange"
            />
            <span class="btn-secondary file-btn">Choose Image</span>
            <span class="file-name">{{ avatarFile ? avatarFile.name : 'No file selected' }}</span>
          </label>
          <div v-if="avatarPreviewUrl" class="avatar-preview-wrap">
            <span class="avatar-preview-label">Preview</span>
            <UserAvatar :name="profile.name || 'User'" :profile-image="avatarPreviewUrl" :size="64" :tooltip="false" />
          </div>
          <div class="form-actions">
            <button class="btn-primary" :disabled="!avatarFile || uploadingAvatar">
              {{ uploadingAvatar ? 'Uploading...' : 'Upload Avatar' }}
            </button>
          </div>
        </form>
      </section>

      <section class="card section-card">
        <div class="section-head">
          <h3>Change Password</h3>
          <p>Use a strong password with at least 8 characters.</p>
        </div>
        <form class="form-block" @submit.prevent="handlePasswordUpdate">
          <div class="form-group">
            <label>Current password</label>
            <input v-model="passwordForm.currentPassword" type="password" required />
          </div>
          <div class="form-group">
            <label>New password</label>
            <input v-model="passwordForm.newPassword" type="password" minlength="8" required />
          </div>
          <div class="form-actions">
            <button class="btn-primary" :disabled="updatingPassword">
              {{ updatingPassword ? 'Updating...' : 'Update Password' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useStore } from 'vuex';
import UserAvatar from '../components/UserAvatar.vue';
import {
  fetchMyProfile,
  sendMyNotificationTest,
  updateMyNotificationSettings,
  updateMyPassword,
  uploadMyAvatar
} from '../services/myProfile';

const store = useStore();
const profile = ref({});
const avatarFile = ref(null);
const avatarPreviewUrl = ref('');
const uploadingAvatar = ref(false);
const updatingPassword = ref(false);
const savingNotify = ref(false);
const testingChannel = ref('');
const passwordForm = ref({
  currentPassword: '',
  newPassword: ''
});
const notificationForm = ref({
  enabled: false,
  slack: { enabled: false, webhookUrl: '' },
  telegram: { enabled: false, botToken: '', chatId: '' },
  ipMessage: { enabled: false, ipAddress: '', ipcmdPath: '' }
});
const displayAvatar = computed(() => avatarPreviewUrl.value || profile.value.avatarUrl || '');
const telegramConnected = computed(
  () => !!notificationForm.value.telegram.botToken && !!notificationForm.value.telegram.chatId
);
const ipMessageConnected = computed(
  () => !!notificationForm.value.ipMessage.ipAddress && !!notificationForm.value.ipMessage.ipcmdPath
);
const hasAnyNotifyConnection = computed(
  () => !!notificationForm.value.slack.webhookUrl || telegramConnected.value || ipMessageConnected.value
);

const syncUser = (user) => {
  profile.value = user || {};
  const n = user?.notification || {};
  notificationForm.value = {
    enabled: !!n.enabled,
    slack: {
      enabled: !!n.slack?.enabled,
      webhookUrl: n.slack?.webhookUrl || ''
    },
    telegram: {
      enabled: !!n.telegram?.enabled,
      botToken: n.telegram?.botToken || '',
      chatId: n.telegram?.chatId || ''
    },
    ipMessage: {
      enabled: !!n.ipMessage?.enabled,
      ipAddress: n.ipMessage?.ipAddress || '',
      ipcmdPath: n.ipMessage?.ipcmdPath || ''
    }
  };
  store.commit('auth/SET_USER', user || null);
};

const loadProfile = async () => {
  const res = await fetchMyProfile();
  syncUser(res?.data?.user || null);
};

const handleAvatarChange = (event) => {
  avatarFile.value = event.target.files?.[0] || null;
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value);
    avatarPreviewUrl.value = '';
  }
  if (avatarFile.value) {
    avatarPreviewUrl.value = URL.createObjectURL(avatarFile.value);
  }
};

const handleAvatarUpload = async () => {
  if (!avatarFile.value) return;
  uploadingAvatar.value = true;
  try {
    const res = await uploadMyAvatar(avatarFile.value);
    syncUser(res?.data?.user || null);
    avatarFile.value = null;
    if (avatarPreviewUrl.value) {
      URL.revokeObjectURL(avatarPreviewUrl.value);
      avatarPreviewUrl.value = '';
    }
  } finally {
    uploadingAvatar.value = false;
  }
};

const handlePasswordUpdate = async () => {
  updatingPassword.value = true;
  try {
    await updateMyPassword(passwordForm.value);
    passwordForm.value = { currentPassword: '', newPassword: '' };
  } finally {
    updatingPassword.value = false;
  }
};

const saveNotificationSettings = async () => {
  savingNotify.value = true;
  try {
    const res = await updateMyNotificationSettings(notificationForm.value);
    syncUser(res?.data?.user || null);
  } finally {
    savingNotify.value = false;
  }
};

const runTest = async (channel) => {
  testingChannel.value = channel;
  try {
    await sendMyNotificationTest(channel, {
      slack: { webhookUrl: notificationForm.value.slack.webhookUrl },
      telegram: {
        botToken: notificationForm.value.telegram.botToken,
        chatId: notificationForm.value.telegram.chatId,
      },
      ipMessage: {
        ipAddress: notificationForm.value.ipMessage.ipAddress,
        ipcmdPath: notificationForm.value.ipMessage.ipcmdPath,
      },
    });
  } finally {
    testingChannel.value = '';
  }
};

const formatRole = (role) =>
  role ? role.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase()) : '-';

onMounted(loadProfile);
onBeforeUnmount(() => {
  if (avatarPreviewUrl.value) {
    URL.revokeObjectURL(avatarPreviewUrl.value);
  }
});
</script>

<style scoped>
.my-profile-view {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-card {
  padding: 14px 16px;
}

.profile-header-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-header-text h2 {
  margin: 0;
  font-size: 1.08rem;
  line-height: 1.15;
}

.profile-header-text p {
  margin: 4px 0 0;
  font-size: 0.81rem;
  color: var(--text-secondary);
}

.meta-chips {
  margin-top: 8px;
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.meta-chip {
  font-size: 0.71rem;
  color: #365270;
  border: 1px solid #c8d8ea;
  background: #f3f8ff;
  border-radius: 999px;
  padding: 2px 8px;
}

.section-card {
  padding: 12px 14px;
}

.section-head {
  margin-bottom: 10px;
}

.section-head h3 {
  margin: 0;
  font-size: 0.92rem;
}

.section-head p {
  margin: 4px 0 0;
  font-size: 0.76rem;
  color: var(--text-tertiary);
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-item label {
  font-size: 0.73rem;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.info-value {
  font-size: 0.84rem;
  color: var(--text-primary);
  padding: 8px 10px;
  border: 1px solid var(--border-light);
  border-radius: 8px;
  background: #fbfcff;
}

.security-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.form-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 100%;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.form-group label {
  font-size: 0.76rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.form-group input {
  height: 38px;
}

.file-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 38px;
}

.file-picker input {
  display: none;
}

.file-btn {
  min-width: 110px;
  text-align: center;
}

.file-name {
  font-size: 0.76rem;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-actions {
  display: flex;
  justify-content: flex-start;
}

.avatar-preview-wrap {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px dashed #c7d5e6;
  border-radius: 8px;
  background: #f9fcff;
}

.avatar-preview-label {
  font-size: 0.76rem;
  color: var(--text-secondary);
}

.notify-master-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.notify-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 10px;
  margin-bottom: 10px;
}

.notify-card {
  border: 1px solid var(--border-light);
  border-radius: 10px;
  padding: 10px;
  background: #fbfcff;
}

.notify-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.notify-card__head h4 {
  margin: 0;
  font-size: 0.86rem;
}
.provider-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}
.provider-title img {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  object-fit: cover;
  display: block;
}

.notify-help {
  margin: 0 0 8px;
  font-size: 0.72rem;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.notify-help--guide {
  background: #f8fbff;
  border: 1px solid #d8e5f6;
  border-radius: 8px;
  padding: 8px 9px;
}

.notify-help--guide p {
  margin: 0 0 6px;
}

.notify-help--guide ol {
  margin: 0 0 6px 16px;
  padding: 0;
}

.notify-help--guide li {
  margin: 0 0 3px;
}

.notify-help--guide a {
  color: #1d4ed8;
  text-decoration: underline;
}

.notify-example {
  margin-bottom: 0;
}

.bool-field {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  font-size: 0.78rem;
  color: var(--text-secondary);
  font-weight: 600;
  flex-wrap: wrap;
}

.bool-field--small {
  margin-top: 4px;
}

.bool-group {
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: 9px;
  border: 1px solid #d5deea;
  background: #f3f6fb;
  gap: 2px;
}

.bool-btn {
  min-width: 62px;
  height: 30px;
  border: none;
  border-radius: 7px;
  padding: 0 10px;
  font-size: 0.74rem;
  font-weight: 700;
  color: #4b5f7a;
  background: transparent;
  cursor: pointer;
}

.bool-btn--active {
  background: #1d4ed8;
  color: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.18);
}

.bool-group--disabled {
  opacity: 0.65;
}

.warn-badge {
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.7rem;
  background: #fff1f2;
  color: #b42318;
  border: 1px solid #fecdd3;
  font-weight: 700;
}

.state-chip {
  border-radius: 999px;
  padding: 2px 7px;
  font-size: 0.68rem;
  font-weight: 700;
}

.state-chip--ok {
  background: #ecfdf3;
  color: #027a48;
  border: 1px solid #a6f4c5;
}

.state-chip--warn {
  background: #fff7ed;
  color: #b54708;
  border: 1px solid #fed7aa;
}

.channel-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-start;
}

@media (max-width: 980px) {
  .security-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 680px) {
  .profile-header-row {
    align-items: flex-start;
  }

  .file-picker {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>

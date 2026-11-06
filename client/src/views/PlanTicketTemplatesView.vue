<template>
  <div class="plan-ticket-admin page-shell">
    <header class="page-header">
      <h1>{{ pageTitle }}</h1>
      <p class="page-subtitle">
        Default subtitles shown on {{ activePeriod }} plan submit pages. Add, edit, or remove tickets for this period.
      </p>
    </header>

    <nav class="period-tabs" aria-label="Switch period">
      <router-link
        v-for="p in periods"
        :key="p"
        :to="{ name: templateRouteName(p) }"
        class="period-tab"
        :class="{ 'is-active': activePeriod === p }"
      >
        {{ periodLabel(p) }}
      </router-link>
    </nav>

    <div v-if="loading" class="state-msg">Loading…</div>
    <div v-else class="panel">
      <table class="ticket-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Subtitle</th>
            <th>Status</th>
            <th class="col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row._id">
            <td>{{ row.sortOrder }}</td>
            <td>
              <input
                v-if="editingId === row._id"
                v-model="editTitle"
                type="text"
                class="input"
              />
              <span v-else>{{ row.title }}</span>
            </td>
            <td>
              <span class="badge" :class="row.active ? 'badge--on' : 'badge--off'">
                {{ row.active ? 'Active' : 'Hidden' }}
              </span>
            </td>
            <td class="col-actions">
              <template v-if="editingId === row._id">
                <button type="button" class="btn btn-primary btn-sm" @click="saveEdit(row)">Save</button>
                <button type="button" class="btn btn-neutral btn-sm" @click="cancelEdit">Cancel</button>
              </template>
              <template v-else>
                <button type="button" class="btn btn-neutral btn-sm" @click="startEdit(row)">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" @click="removeRow(row)">Delete</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="add-row">
        <input v-model="newTitle" type="text" class="input" placeholder="New ticket subtitle" />
        <button type="button" class="btn btn-primary" :disabled="!newTitle.trim()" @click="addRow">
          Add ticket
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useToast } from 'vue-toastification';
import {
  getPlanTicketTemplatesAdmin,
  createPlanTicketTemplate,
  updatePlanTicketTemplate,
  deletePlanTicketTemplate
} from '../services/planTicketTemplates';

const toast = useToast();
const route = useRoute();
const periods = ['daily', 'weekly', 'monthly'];
const activePeriod = ref('daily');

const TEMPLATE_ROUTE_BY_PERIOD = {
  daily: 'planTicketTemplatesDaily',
  weekly: 'planTicketTemplatesWeekly',
  monthly: 'planTicketTemplatesMonthly'
};

function templateRouteName(period) {
  return TEMPLATE_ROUTE_BY_PERIOD[period] || TEMPLATE_ROUTE_BY_PERIOD.daily;
}

function syncPeriodFromRoute() {
  const p = String(route.meta?.reportPeriod || 'daily');
  if (periods.includes(p)) activePeriod.value = p;
}

const pageTitle = computed(() => `${periodLabel(activePeriod.value)} plan ticket templates`);
const rows = ref([]);
const loading = ref(false);
const editingId = ref('');
const editTitle = ref('');
const newTitle = ref('');

function periodLabel(p) {
  return p.charAt(0).toUpperCase() + p.slice(1);
}

async function loadRows() {
  loading.value = true;
  try {
    const res = await getPlanTicketTemplatesAdmin(activePeriod.value);
    rows.value = res.data?.data || res.data || [];
  } catch (e) {
    toast.error(e?.response?.data?.message || 'Failed to load tickets');
    rows.value = [];
  } finally {
    loading.value = false;
  }
}

function startEdit(row) {
  editingId.value = row._id;
  editTitle.value = row.title;
}

function cancelEdit() {
  editingId.value = '';
  editTitle.value = '';
}

async function saveEdit(row) {
  const title = editTitle.value.trim();
  if (!title) return;
  try {
    await updatePlanTicketTemplate(row._id, { title });
    toast.success('Ticket updated');
    cancelEdit();
    await loadRows();
  } catch (e) {
    toast.error(e?.response?.data?.message || 'Update failed');
  }
}

async function removeRow(row) {
  if (!window.confirm(`Remove "${row.title}"?`)) return;
  try {
    await deletePlanTicketTemplate(row._id);
    toast.success('Ticket removed');
    await loadRows();
  } catch (e) {
    toast.error(e?.response?.data?.message || 'Delete failed');
  }
}

async function addRow() {
  const title = newTitle.value.trim();
  if (!title) return;
  try {
    await createPlanTicketTemplate({ period: activePeriod.value, title });
    toast.success('Ticket added');
    newTitle.value = '';
    await loadRows();
  } catch (e) {
    toast.error(e?.response?.data?.message || 'Add failed');
  }
}

watch(activePeriod, loadRows);
watch(() => route.meta?.reportPeriod, () => {
  syncPeriodFromRoute();
  loadRows();
});
onMounted(() => {
  syncPeriodFromRoute();
  loadRows();
});
</script>

<style scoped>
.plan-ticket-admin {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
}

.page-header h1 {
  margin: 0 0 0.35rem;
  font-size: 1.5rem;
}

.page-subtitle {
  margin: 0 0 1.25rem;
  color: var(--text-tertiary);
  font-size: 0.9rem;
}

.period-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.period-tab {
  padding: 0.45rem 1rem;
  border-radius: 999px;
  border: 1px solid var(--border-medium);
  background: var(--bg-primary);
  cursor: pointer;
  font-weight: 600;
  font-size: 0.8125rem;
  text-decoration: none;
  color: var(--text-secondary);
}

.period-tab:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.period-tab.is-active,
.period-tab.router-link-active {
  border-color: var(--color-primary);
  background: var(--color-primary-soft);
  color: var(--color-primary);
}

.panel {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 1rem;
}

.ticket-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.ticket-table th,
.ticket-table td {
  padding: 0.65rem 0.5rem;
  border-bottom: 1px solid var(--border-light);
  text-align: left;
}

.col-actions {
  white-space: nowrap;
}

.input {
  width: 100%;
  min-width: 200px;
  padding: 0.4rem 0.55rem;
  border: 1px solid var(--border-medium);
  border-radius: 6px;
}

.badge {
  font-size: 0.6875rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  font-weight: 700;
  text-transform: uppercase;
}

.badge--on {
  background: #ecfdf5;
  color: #166534;
}

.badge--off {
  background: #f1f5f9;
  color: #64748b;
}

.add-row {
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.add-row .input {
  flex: 1;
  min-width: 220px;
}

.btn-sm {
  padding: 0.35rem 0.65rem;
  font-size: 0.75rem;
  margin-right: 0.35rem;
}

.state-msg {
  padding: 2rem;
  text-align: center;
  color: var(--text-tertiary);
}
</style>

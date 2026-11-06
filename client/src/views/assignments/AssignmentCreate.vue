<template>
  <div class="assignment-create">
    <div class="page-header">
      <div>
        <h1>Create Assignment</h1>
        <p class="subtitle">
          Add a new assignment to track your work
        </p>
      </div>
    </div>

    <div class="card">
      <form @submit.prevent="handleSubmit">
        <!-- Title -->
        <div class="form-group">
          <label>Title *</label>
          <input v-model="form.title" type="text" required placeholder="e.g. Website payment from client" />
        </div>

        <!-- Description -->
        <div class="form-group">
          <label>Description</label>
          <textarea v-model="form.description" rows="3" placeholder="Optional description..." />
        </div>

        <!-- Collaborator -->
        <div class="form-group">
          <label>Collaborator</label>
          <input v-model="form.collaborator" type="text" placeholder="Optional collaborator name" />
        </div>
        <div class="form-group">
          <label>Group *</label>
          <select v-model="form.group">
            <option v-for="opt in entityGroupOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
    </div>

    <!-- Performance Type -->
    <div class="form-group">
      <label>Performance Type</label>
      <input v-model="form.performanceType" type="text" placeholder="e.g. Received partial payment" />
    </div>

    <!-- Finance -->
    <div class="form-row">
      <div class="form-group">
        <label>Amount</label>
        <input v-model.number="form.currencyAmount" type="number" min="0" placeholder="0" />
      </div>

      <div class="form-group">
        <label>Currency</label>
        <input v-model="form.currencyCode" type="text" placeholder="USD" />
      </div>
    </div>

    <div class="form-group">
      <label>Pay Method</label>
      <input v-model="form.payMethod" type="text" placeholder="PayPal, Bank, Crypto..." />
    </div>

    <!-- Note -->
    <div class="form-group">
      <label>Note</label>
      <textarea v-model="form.note" rows="2" placeholder="Optional note..." />
    </div>

    <!-- Actions -->
    <div class="form-actions">
      <router-link :to="{ name: 'Assignments' }" class="btn-cancel">
        Cancel
      </router-link>

      <button type="submit" class="btn-save" :disabled="saving || !form.title">
        {{ saving ? 'Creating...' : 'Create Assignment' }}
      </button>
    </div>
    </form>
  </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { createAssignment } from '../../services/assignments.js';
import { ENTITY_GROUP_OPTIONS, DEFAULT_ENTITY_GROUP } from '../../constants/groups.js';

const router = useRouter();
const entityGroupOptions = ENTITY_GROUP_OPTIONS;

const saving = ref(false);

const form = ref({
  title: '',
  description: '',
  collaborator: '',
  group: DEFAULT_ENTITY_GROUP,
  performanceType: '',
  currencyAmount: 0,
  currencyCode: 'USD',
  payMethod: '',
  note: ''
});

const handleSubmit = async () => {
  saving.value = true;
  try {
    await createAssignment(form.value);
    router.push({ name: 'Assignments' });
  } catch (err) {
    alert(err.response?.data?.message || 'Failed to create assignment');
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.assignment-create {
  max-width: 800px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.subtitle {
  color: #7f8c8d;
  margin-top: 4px;
}

.card {
  background: white;
  padding: 24px;
  border-radius: 8px;
}

.form-group {
  margin-bottom: 18px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  color: #2c3e50;
}

.form-group input,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}

.btn-save {
  background: #2ecc71;
  color: white;
  padding: 10px 18px;
  border-radius: 4px;
  border: none;
  font-weight: 500;
}

.btn-cancel {
  background: #95a5a6;
  color: white;
  padding: 10px 18px;
  border-radius: 4px;
  text-decoration: none;
  font-weight: 500;
}
</style>
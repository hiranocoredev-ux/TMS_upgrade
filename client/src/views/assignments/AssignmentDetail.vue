<template>
    <div class="assignment-detail">
        <!-- Header -->
        <div class="page-header">
            <div>
                <h1>{{ assignment?.title || 'Assignment' }}</h1>
                <p class="subtitle">
                    Status:
                    <span class="status-badge" :class="`status-${assignment?.status}`">
                        {{ assignment?.status }}
                    </span>
                </p>
            </div>

            <div class="header-actions">
                <button v-if="isOwner && !isEditing" class="btn-primary" @click="enableEdit">
                    Edit
                </button>
                <RouterLink to="/assignments" class="btn-primary">
                    <<< Back to </RouterLink>
                        <button v-if="isEditing" class="btn-save" :disabled="saving" @click="saveChanges">
                            {{ saving ? 'Saving...' : 'Save' }}
                        </button>

                        <button v-if="isEditing" class="btn-cancel" @click="cancelEdit">
                            Cancel
                        </button>
            </div>
        </div>

        <!-- Loading / Error -->
        <div v-if="loading" class="loading-state">
            <div class="spinner"></div>
            <p>Loading assignment...</p>
        </div>

        <div v-else-if="error" class="error-state">
            <p>{{ error }}</p>
        </div>

        <!-- Content -->
        <div v-else-if="assignment" class="content-grid">
            <!-- Main Info -->
            <div class="card">
                <div class="subject_group">
                    <h3>Details</h3>
                    <select v-if="isEditing" v-model="form.group" class="group-badge">
                        <option v-for="opt in entityGroupOptions" :key="opt.value" :value="opt.value">
                          {{ opt.label }}
                        </option>
                    </select>
                    <div v-else class="group-badge">
                        {{ formatGroupLabel(assignment.group) }}
                    </div>
                </div>

                <div class="field">
                    <label>Title</label>
                    <input v-if="isEditing" v-model="form.title" type="text" />
                    <div v-else>{{ assignment.title }}</div>
                </div>

                <div class="field">
                    <label>Description</label>
                    <textarea v-if="isEditing" v-model="form.description" rows="3" />
                    <div v-else class="muted">
                        {{ assignment.description || 'â€”' }}
                    </div>
                </div>

                <div class="field">
                    <label>Collaborator</label>
                    <input v-if="isEditing" v-model="form.collaborator" type="text" />
                    <div v-else class="muted">
                        {{ assignment.collaborator || 'â€”' }}
                    </div>
                </div>

                <div class="field">
                    <label>Performance Type</label>
                    <input v-if="isEditing" v-model="form.performanceType" type="text" />
                    <div v-else class="muted">
                        {{ assignment.performanceType || 'â€”' }}
                    </div>
                </div>
            </div>

            <!-- Status & Finance -->
            <div class="card">
                <h3>Status & Earnings</h3>

                <div class="field">
                    <label>Status</label>
                    <select v-if="isEditing" v-model="form.status">
                        <option value="progressing">Progressing</option>
                        <option value="completed">Completed</option>
                    </select>
                    <div v-else>
                        {{ assignment.status }}
                    </div>
                </div>

                <div class="field">
                    <label>Completed At</label>
                    <div class="muted">
                        {{ assignment.completedAt ? formatDateTime(assignment.completedAt) : 'â€”' }}
                    </div>
                </div>

                <div class="field">
                    <label>Amount</label>
                    <input v-if="isEditing" type="number" v-model.number="form.currencyAmount" />
                    <div v-else>
                        {{ assignment.currencyAmount || 'â€”' }}
                    </div>
                </div>

                <div class="field">
                    <label>Currency</label>
                    <input v-if="isEditing" v-model="form.currencyCode" type="text" />
                    <div v-else>
                        {{ assignment.currencyCode || 'â€”' }}
                    </div>
                </div>

                <div class="field">
                    <label>Pay Method</label>
                    <input v-if="isEditing" v-model="form.payMethod" type="text" />
                    <div v-else class="muted">
                        {{ assignment.payMethod || 'â€”' }}
                    </div>
                </div>

                <div class="field">
                    <label>Note</label>
                    <textarea v-if="isEditing" v-model="form.note" rows="2" />
                    <div v-else class="muted">
                        {{ assignment.note || 'â€”' }}
                    </div>
                </div>
            </div>

            <!-- Activity History -->
            <div class="card full-width">
                <h3>Activity History</h3>

                <ul class="activity-list">
                    <li v-for="(log, idx) in assignment.activityLogs" :key="idx">
                        <div class="activity-summary">{{ log.summary }}</div>
                        <div class="activity-time">
                            {{ formatDateTime(log.createdAt) }}
                        </div>
                    </li>

                    <li v-if="!assignment.activityLogs.length" class="muted">
                        No activity yet.
                    </li>
                </ul>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../composables/useAuth';
import {
    getAssignment,
    updateAssignment
} from '../../services/assignments';
import { ENTITY_GROUP_OPTIONS, formatGroupLabel } from '../../constants/groups.js';

const entityGroupOptions = ENTITY_GROUP_OPTIONS;
const route = useRoute();
const authStore = useAuthStore();

const assignment = ref(null);
const loading = ref(false);
const error = ref(null);
const saving = ref(false);
const isEditing = ref(false);

const form = ref({});
const isOwner = computed(() => {
    return assignment.value?.ownerUserId === authStore.user?._id;
});

const loadAssignment = async () => {
    loading.value = true;
    try {
        const res = await getAssignment(route.params.id);
        assignment.value = res.data.assignment;
        form.value = { ...assignment.value };
    } catch (err) {
        error.value = err.response?.data?.message || 'Failed to load assignment';
    } finally {
        loading.value = false;
    }
};

const enableEdit = () => {
    isEditing.value = true;
};

const cancelEdit = () => {
    form.value = { ...assignment.value };
    isEditing.value = false;
};

const saveChanges = async () => {
    saving.value = true;
    try {
        const payload = { ...form.value };
        delete payload._id;
        delete payload.ownerUserId;
        delete payload.activityLogs;
        delete payload.completedAt;
        delete payload.createdAt;
        delete payload.updatedAt;

        const res = await updateAssignment(assignment.value._id, payload);
        assignment.value = res.data.assignment;
        isEditing.value = false;
    } catch (err) {
        alert(err.response?.data?.message || 'Failed to update assignment');
    } finally {
        saving.value = false;
    }
};

const formatDateTime = (date) => {
    return new Date(date).toLocaleString();
};
watch(
    () => route.query.edit,
    (val) => {
        if (val === 'true' && isOwner.value) {
            isEditing.value = true;
        }
    },
    { immediate: true }
);
onMounted(loadAssignment);
</script>

<style scoped>
.assignment-detail {
    max-width: 1100px;
    margin: 0 auto;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
}

.title {
    font-size: 1.6rem;
    font-weight: 600;
}

.subtitle {
    color: #7f8c8d;
    margin-top: 4px;
}

.header-actions {
    display: flex;
    gap: 10px;
}

.content-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
}

.card {
    background: #fff;
    padding: 20px;
    border-radius: 8px;
}

.card.full-width {
    grid-column: span 2;
}

.field {
    margin-bottom: 14px;
}

.field label {
    font-size: 0.85rem;
    color: #7f8c8d;
    margin-bottom: 4px;
    display: block;
}

input,
textarea,
select {
    width: 100%;
    padding: 8px 10px;
    border-radius: 4px;
    border: 1px solid #ddd;
}

.status-badge {
    padding: 4px 10px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 500;
}

.status-progressing {
    background: #f39c12;
    color: #fff;
}

.status-completed {
    background: #2ecc71;
    color: #fff;
}

.activity-list {
    list-style: none;
    padding: 0;
}

.activity-summary {
    font-weight: 500;
}

.activity-time {
    font-size: 0.8rem;
    color: #7f8c8d;
}

.muted {
    color: #95a5a6;
}

.btn-primary {
    background: #3498db;
    color: white;
    padding: 8px 14px;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    text-decoration: none;
}

.btn-secondary {
    background: #ecf0f1;
    color: #2c3e50;
    padding: 8px 14px;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
}

.btn-save {
    background: #2ecc71;
    color: white;
    padding: 8px 14px;
    border-radius: 4px;
    cursor: pointer;
    text-decoration: none;
    border: none;
}

.btn-cancel {
    background: #95a5a6;
    color: white;
    cursor: pointer;
    border: none;
    padding: 8px 14px;
    border-radius: 4px;
    text-decoration: none;
}

.subject_group {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    margin-bottom: 10px;
}

.subject_group {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.subject_group {
    display: flex;
    align-items: center;
    gap: 12px;
    /* space between Details & badge */
}

.group-badge {
    width: auto;
    /* IMPORTANT */
    min-width: fit-content;
    padding: 6px 14px;
    border-radius: 8px;
    background: #4f46e5;
    color: #ffffff;
    font-weight: 700;
    border: none;
    outline: none;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    animation: pulse 2s ease-out infinite;
}

@keyframes pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(14, 1, 255, 0.7);
    }

    70% {
        box-shadow: 0 0 0 5px rgba(14, 2, 248, 0.3);
    }

    100% {
        box-shadow: 0 0 0 0 rgba(79, 70, 229, 0.2);
    }
}
</style>
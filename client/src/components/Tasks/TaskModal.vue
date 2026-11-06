<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal modal-large" @click.stop>
      <div class="modal-header">
        <h2>{{ editingTask ? 'Edit Task' : 'Create Task' }}</h2>
        <button @click="close" class="close-btn">✕</button>
      </div>
      <div class="modal-content">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label>Title *</label>
            <input
              v-model="form.title"
              type="text"
              required
              placeholder="e.g., Implement user authentication"
              maxlength="200"
              ref="firstInput"
            />
          </div>

          <div class="form-group">
            <label>Description</label>
            <textarea
              v-model="form.description"
              rows="4"
              placeholder="Task description..."
            ></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Status</label>
              <select v-model="form.status">
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </select>
            </div>
            <div class="form-group">
              <label>Priority</label>
              <select v-model="form.priority">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>Due Date</label>
              <TmsNativeCalendarField v-model="form.dueDate" type="date" />
            </div>
          </div>

          <div class="form-group">
            <label>Checklist Items</label>
            <div class="checklist-container">
              <div
                v-for="(item, index) in form.checklist"
                :key="index"
                class="checklist-item"
              >
                <input
                  type="checkbox"
                  v-model="item.done"
                  class="checklist-checkbox"
                />
                <input
                  v-model="item.text"
                  type="text"
                  placeholder="Checklist item"
                  class="checklist-input"
                />
                <button
                  type="button"
                  @click="removeChecklistItem(index)"
                  class="btn-remove-item"
                >
                  ✕
                </button>
              </div>
              <button
                type="button"
                @click="addChecklistItem"
                class="btn-add-item"
              >
                + Add Item
              </button>
            </div>
          </div>

          <div class="form-group">
            <label>Comments</label>
            <div class="comments-container">
              <div
                v-for="(comment, index) in form.comments"
                :key="index"
                class="comment-item"
              >
                <div class="comment-text">{{ comment.text }}</div>
                <div class="comment-meta">
                  <span>{{ comment.createdBy?.name || comment.createdBy?.email || 'Unknown' }}</span>
                  <span>{{ formatDate(comment.createdAt) }}</span>
                </div>
              </div>
              <div class="add-comment">
                <textarea
                  v-model="newComment"
                  rows="2"
                  placeholder="Add a comment..."
                  class="comment-input"
                ></textarea>
                <button
                  type="button"
                  @click="addComment"
                  class="btn-add-comment"
                  :disabled="!newComment.trim()"
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" @click="close" class="btn-cancel">Cancel</button>
            <button type="submit" :disabled="saving" class="btn-save">
              {{ saving ? 'Saving...' : (editingTask ? 'Update Task' : 'Create Task') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, nextTick, onMounted } from 'vue';
import TmsNativeCalendarField from '../ui/TmsNativeCalendarField.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  task: {
    type: Object,
    default: null
  },
  users: {
    type: Array,
    default: () => []
  },
  projectId: {
    type: String,
    required: true
  }
});

const emit = defineEmits(['close', 'saved']);

const saving = ref(false);
const newComment = ref('');

const form = ref({
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  checklist: [],
  comments: []
});

const editingTask = computed(() => props.task !== null);

watch(() => props.task, (newTask) => {
  if (newTask) {
    form.value = {
      title: newTask.title || '',
      description: newTask.description || '',
      status: newTask.status || 'todo',
      priority: newTask.priority || 'medium',
      dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString().split('T')[0] : '',
      checklist: newTask.checklist ? [...newTask.checklist] : [],
      comments: newTask.comments ? [...newTask.comments] : []
    };
  } else {
    resetForm();
  }
}, { immediate: true });

watch(() => props.show, (newShow) => {
  if (!newShow) {
    resetForm();
    newComment.value = '';
  }
});

const resetForm = () => {
  form.value = {
    title: '',
    description: '',
    status: 'todo',
    priority: 'medium',
    dueDate: '',
    checklist: [],
    comments: []
  };
};

const addChecklistItem = () => {
  form.value.checklist.push({ text: '', done: false });
};

const removeChecklistItem = (index) => {
  form.value.checklist.splice(index, 1);
};

const addComment = () => {
  if (!newComment.value.trim()) return;
  form.value.comments.push({
    text: newComment.value.trim(),
    createdAt: new Date().toISOString()
  });
  newComment.value = '';
};

const handleSubmit = () => {
  emit('saved', { ...form.value });
};

const close = () => {
  emit('close');
};

const firstInput = ref(null);

// Focus first input when modal opens
watch(() => props.show, async (show) => {
  if (show) {
    await nextTick();
    if (firstInput.value) {
      firstInput.value.focus();
    }
  }
});

onMounted(() => {
  if (props.show) {
    nextTick(() => {
      if (firstInput.value) {
        firstInput.value.focus();
      }
    });
  }
});

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleString();
};
</script>

<style scoped>
/* Modal styles match Projects.vue */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: var(--bg-primary);
  border-radius: 8px;
  width: 550px;
  max-width: 550px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

.modal-large {
  width: 650px;
  max-width: 650px;
}

@media (max-width: 600px) {
  .modal {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
  
  .modal-large {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 30px;
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 1.5rem;
}

.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.2s;
}

.close-btn:hover {
  background: var(--bg-tertiary);
}

.modal-content {
  padding: 30px;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  color: var(--text-primary);
  font-size: 0.9rem;
}

.form-group input,
.form-group select,
.form-group textarea {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.form-group input:focus,
.form-group select:focus,
.form-group textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

.form-group textarea {
  resize: vertical;
  font-family: inherit;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.checklist-container {
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  padding: 12px;
  background: var(--bg-tertiary);
}

.checklist-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.checklist-item:last-of-type {
  margin-bottom: 12px;
}

.checklist-checkbox {
  width: auto;
  flex-shrink: 0;
}

.checklist-input {
  flex: 1;
  margin: 0;
}

.btn-remove-item {
  padding: 4px 8px;
  background: #e74c3c;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-add-item {
  padding: 6px 12px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.comments-container {
  border: 1px solid var(--border-medium);
  border-radius: 4px;
  padding: 12px;
  background: var(--bg-tertiary);
  max-height: 300px;
  overflow-y: auto;
}

.comment-item {
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
}

.comment-item:last-of-type {
  margin-bottom: 0;
  border-bottom: none;
}

.comment-text {
  margin-bottom: 4px;
  color: var(--text-primary);
}

.comment-meta {
  font-size: 0.85rem;
  color: var(--text-secondary);
  display: flex;
  gap: 12px;
}

.add-comment {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0e0e0;
}

.comment-input {
  width: 100%;
  margin-bottom: 8px;
}

.btn-add-comment {
  padding: 6px 12px;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
}

.btn-add-comment:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 30px;
}

.btn-cancel,
.btn-save {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 500;
  transition: background 0.2s;
}

.btn-cancel {
  background: #95a5a6;
  color: white;
}

.btn-cancel:hover {
  background: #7f8c8d;
}

.btn-save {
  background: #2ecc71;
  color: white;
}

.btn-save:hover:not(:disabled) {
  background: #27ae60;
}

.btn-save:disabled {
  background: #bdc3c7;
  cursor: not-allowed;
}
</style>


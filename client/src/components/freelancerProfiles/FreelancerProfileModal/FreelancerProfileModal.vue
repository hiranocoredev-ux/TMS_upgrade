<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>{{ editingProfile ? 'Edit Freelancer Profile' : 'Create Freelancer Profile' }}</h2>
        <button @click="handleClose" class="close-btn">✕</button>
      </div>
      <div class="modal-content">
        <FreelancerProfileForm
          :profile="editingProfile"
          :saving="saving"
          @submit="handleSubmit"
          @cancel="handleClose"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, watch, nextTick, onMounted } from 'vue';
import FreelancerProfileForm from './FreelancerProfileForm.vue';

const props = defineProps({
  show: {
    type: Boolean,
    default: false
  },
  editingProfile: {
    type: Object,
    default: null
  },
  saving: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['close', 'submit']);

const handleClose = () => {
  emit('close');
};

const handleSubmit = (formData) => {
  emit('submit', formData);
};

// Focus first input when modal opens
watch(() => props.show, async (show) => {
  if (show) {
    await nextTick();
    const firstInput = document.querySelector('.modal input[type="text"], .modal input[type="email"], .modal select');
    if (firstInput) {
      firstInput.focus();
    }
  }
});

onMounted(() => {
  if (props.show) {
    nextTick(() => {
      const firstInput = document.querySelector('.modal input[type="text"], .modal input[type="email"], .modal select');
      if (firstInput) {
        firstInput.focus();
      }
    });
  }
});
</script>

<style scoped>
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
  width: 600px;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-xl);
  border: 1px solid var(--border-light);
}

@media (max-width: 650px) {
  .modal {
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
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  z-index: 10;
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
</style>

<template>
  <div v-if="show" class="modal-overlay">
    <div class="modal" @click.stop>
      <div class="modal-header">
        <h2>{{ editingProfile ? 'Edit Client Profile' : 'Create Client Profile' }}</h2>
        <button @click="handleClose" class="close-btn">✕</button>
      </div>
      <div class="modal-content">
        <ProfileForm
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
import ProfileForm from './ProfileForm.vue';

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
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
  padding: var(--spacing-md);
  animation: fadeIn var(--transition-base);
}

.modal {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  width: 600px;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-2xl);
  animation: slideUp var(--transition-slow);
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
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--border-light);
  position: sticky;
  top: 0;
  background: var(--bg-primary);
  z-index: 10;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
}

.close-btn {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--spacing-xs);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-content {
  padding: var(--spacing-xl);
}

@media (max-width: 768px) {
  .modal {
    width: 95%;
    max-height: 95vh;
  }
  
  .modal-header {
    padding: var(--spacing-lg);
  }
  
  .modal-header h2 {
    font-size: var(--font-size-xl);
  }
  
  .modal-content {
    padding: var(--spacing-lg);
  }
}
</style>

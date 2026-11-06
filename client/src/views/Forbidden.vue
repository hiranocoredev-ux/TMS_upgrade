<template>
  <div class="forbidden-view">
    <div class="forbidden-content">
      <div class="forbidden-icon">🔒</div>
      <h1>Access Forbidden</h1>
      <p class="message">You do not have permission to access this page.</p>
      <p class="details">This page requires special permissions that your account does not have.</p>
      <!-- <div class="actions">
        <router-link to="/" class="btn btn-primary">Go to Dashboard</router-link>
        <button @click="goBack" class="btn btn-secondary">Go Back</button>
      </div> -->
    </div>
  </div>
</template>

<script setup>
import { useRouter } from 'vue-router';

const router = useRouter();

const goBack = () => {
  router.go(-1);
};
</script>

<style scoped>
.forbidden-view {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 60vh;
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.forbidden-content {
  text-align: center;
  max-width: 500px;
}

.forbidden-icon {
  font-size: 5rem;
  margin-bottom: 24px;
}

.forbidden-content h1 {
  color: #2c3e50;
  margin: 0 0 16px 0;
  font-size: 2rem;
}

.message {
  color: #7f8c8d;
  font-size: 1.1rem;
  margin: 0 0 12px 0;
  font-weight: 500;
}

.details {
  color: #95a5a6;
  font-size: 0.95rem;
  margin: 0 0 32px 0;
  line-height: 1.6;
}

.actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn {
  padding: 12px 24px;
  border: none;
  border-radius: 5px;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
  transition: all 0.2s;
}

.btn-primary {
  background: #667eea;
  color: white;
}

.btn-primary:hover {
  background: #5568d3;
}

.btn-secondary {
  background: #ecf0f1;
  color: #2c3e50;
}

.btn-secondary:hover {
  background: #bdc3c7;
}
</style>


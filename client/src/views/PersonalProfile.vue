<template>
  <div class="personal-profile-view">
    <div class="page-header">
      <h1>Personal Profile</h1>
      <p class="subtitle">Your personal information and settings</p>
    </div>
    <div class="placeholder-content">
      <div class="placeholder-icon">⚙️</div>
      <h2>Personal Profile</h2>
      <p>Personal profile management functionality will be implemented here.</p>
      <p class="hint">Manage your personal information, documents, and preferences.</p>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.personal-profile-view {
  background: var(--bg-primary);
  padding: 30px;
  border-radius: 8px;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-light);
  min-height: 500px;
}

.page-header {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
}

.page-header h1 {
  color: var(--text-primary);
  margin: 0 0 8px 0;
  font-size: 1.8rem;
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: 0.95rem;
}

.placeholder-content {
  padding: 60px 40px;
  text-align: center;
  color: var(--text-tertiary);
}

.placeholder-icon {
  font-size: 4rem;
  margin-bottom: 20px;
}

.placeholder-content h2 {
  color: var(--text-secondary);
  margin-bottom: 12px;
}

.hint {
  font-size: 0.9rem;
  color: var(--text-tertiary);
  margin-top: 8px;
}
</style>


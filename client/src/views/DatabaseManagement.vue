<template>
  <div class="database-management">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>Database Management</h1>
          <p class="subtitle">Backup and restore your database</p>
        </div>
      </div>
    </div>

    <!-- Database Statistics -->
    <div class="card stats-card">
      <div class="card-header">
        <h2 class="card-title">Database Statistics</h2>
        <button @click="loadStats" class="btn-secondary btn-sm" :disabled="loadingStats">
          {{ loadingStats ? 'Loading...' : 'Refresh' }}
        </button>
      </div>
      <div v-if="stats" class="stats-content">
        <div class="stats-grid">
          <div v-for="(count, collection) in stats.stats" :key="collection" class="stat-item">
            <div class="stat-label">{{ collection }}</div>
            <div class="stat-value">{{ count.toLocaleString() }}</div>
          </div>
        </div>
        <div class="stats-total">
          <strong>Total Documents: {{ stats.totalDocuments.toLocaleString() }}</strong>
        </div>
      </div>
      <div v-else-if="loadingStats" class="loading-state">
        <div class="spinner"></div>
        <p>Loading statistics...</p>
      </div>
    </div>

    <!-- Export Section -->
    <div class="card export-card">
      <div class="card-header">
        <h2 class="card-title">Export Database</h2>
      </div>
      <div class="card-content">
        <p class="description">
          Export all database collections as a JSON backup file. This file can be used to restore your database later.
        </p>
        <button 
          @click="handleExport" 
          class="btn-primary"
          :disabled="exporting"
        >
          {{ exporting ? 'Exporting...' : '📥 Export Database' }}
        </button>
        <div v-if="exportError" class="error-message">
          {{ exportError }}
        </div>
      </div>
    </div>

    <!-- Import Section -->
    <div class="card import-card">
      <div class="card-header">
        <h2 class="card-title">Import Database</h2>
      </div>
      <div class="card-content">
        <p class="description warning">
          ⚠️ <strong>Warning:</strong> Importing a backup will replace all existing data in the database. 
          Make sure you have exported a backup before proceeding.
        </p>
        
        <div class="form-group">
          <label>
            <input 
              type="checkbox" 
              v-model="clearExisting"
              :disabled="importing"
            />
            Clear existing data before import
          </label>
        </div>

        <div class="file-upload-area" 
             :class="{ 'dragover': isDragging }"
             @drop="handleDrop"
             @dragover.prevent="isDragging = true"
             @dragleave="isDragging = false"
             @click="triggerFileInput">
          <input 
            ref="fileInput"
            type="file" 
            accept=".json"
            @change="handleFileSelect"
            style="display: none"
          />
          <div v-if="selectedFile" class="file-info">
            <span class="file-name">📄 {{ selectedFile.name }}</span>
            <button @click.stop="clearFile" class="btn-icon">✕</button>
          </div>
          <div v-else class="upload-placeholder">
            <p>📁 Drop backup file here or click to browse</p>
            <p class="upload-hint">Only JSON files are supported</p>
          </div>
        </div>

        <button 
          @click="handleImport" 
          class="btn-danger"
          :disabled="!selectedFile || importing"
        >
          {{ importing ? 'Importing...' : '📤 Import Database' }}
        </button>

        <div v-if="importError" class="error-message">
          {{ importError }}
        </div>
        <div v-if="importSuccess" class="success-message">
          ✅ {{ importSuccess }}
        </div>
        <div v-if="importResults" class="import-results">
          <h3>Import Results:</h3>
          <div class="results-grid">
            <div v-for="(result, collection) in importResults" :key="collection" class="result-item">
              <span class="collection-name">{{ collection }}:</span>
              <span class="result-badge success">{{ result.imported }} imported</span>
              <span v-if="result.skipped > 0" class="result-badge warning">{{ result.skipped }} skipped</span>
              <span v-if="result.error" class="result-badge error">{{ result.error }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { exportDatabase, importDatabase, getDatabaseStats } from '../services/database';
import { useToast } from 'vue-toastification';

const toast = useToast();

const loadingStats = ref(false);
const stats = ref(null);
const exporting = ref(false);
const importing = ref(false);
const exportError = ref(null);
const importError = ref(null);
const importSuccess = ref(null);
const importResults = ref(null);
const selectedFile = ref(null);
const fileInput = ref(null);
const isDragging = ref(false);
const clearExisting = ref(true);

const loadStats = async () => {
  loadingStats.value = true;
  try {
    const response = await getDatabaseStats();
    if (response.data?.ok && response.data?.data) {
      stats.value = response.data.data;
    }
  } catch (err) {
    console.error('Error loading stats:', err);
    toast.error('Failed to load database statistics');
  } finally {
    loadingStats.value = false;
  }
};

const handleExport = async () => {
  exporting.value = true;
  exportError.value = null;
  
  try {
    const response = await exportDatabase();
    
    // Extract backup data from response
    const backupData = response.data?.data || response.data;
    
    if (!backupData) {
      throw new Error('No backup data received');
    }
    
    // Create blob and download
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `database-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    toast.success('Database exported successfully');
    await loadStats(); // Refresh stats after export
  } catch (err) {
    console.error('Export error:', err);
    exportError.value = err.response?.data?.error?.message || err.message || 'Failed to export database';
    toast.error(exportError.value);
  } finally {
    exporting.value = false;
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (file) {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      toast.error('Please select a JSON file');
      return;
    }
    selectedFile.value = file;
    readFile(file);
  }
};

const handleDrop = (event) => {
  event.preventDefault();
  isDragging.value = false;
  
  const file = event.dataTransfer.files[0];
  if (file) {
    if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
      toast.error('Please drop a JSON file');
      return;
    }
    selectedFile.value = file;
    readFile(file);
  }
};

const readFile = (file) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const content = JSON.parse(e.target.result);
      selectedFile.value.backupData = content;
    } catch (err) {
      toast.error('Invalid JSON file');
      selectedFile.value = null;
    }
  };
  reader.readAsText(file);
};

const clearFile = () => {
  selectedFile.value = null;
  if (fileInput.value) {
    fileInput.value.value = '';
  }
  importError.value = null;
  importSuccess.value = null;
  importResults.value = null;
};

const handleImport = async () => {
  if (!selectedFile.value || !selectedFile.value.backupData) {
    toast.error('Please select a valid backup file');
    return;
  }

  if (!confirm(
    `⚠️ WARNING: This will ${clearExisting.value ? 'DELETE ALL existing data and ' : ''}restore from backup.\n\n` +
    `Are you absolutely sure you want to proceed?`
  )) {
    return;
  }

  importing.value = true;
  importError.value = null;
  importSuccess.value = null;
  importResults.value = null;

  try {
    const response = await importDatabase(selectedFile.value.backupData, clearExisting.value);
    
    if (response.data?.ok && response.data?.data) {
      importSuccess.value = `Successfully imported ${response.data.data.totalImported} documents`;
      importResults.value = response.data.data.importResults;
      toast.success(importSuccess.value);
      await loadStats(); // Refresh stats after import
    } else {
      throw new Error(response.data?.error?.message || 'Import failed');
    }
  } catch (err) {
    console.error('Import error:', err);
    importError.value = err.response?.data?.error?.message || 'Failed to import database';
    toast.error(importError.value);
  } finally {
    importing.value = false;
  }
};

onMounted(() => {
  loadStats();
});
</script>

<style scoped>
.database-management {
  padding: var(--spacing-xl);
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: var(--spacing-2xl);
}

.page-header h1 {
  font-size: var(--font-size-4xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.subtitle {
  color: var(--text-secondary);
  font-size: var(--font-size-base);
}

.card {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  padding: var(--spacing-xl);
  margin-bottom: var(--spacing-xl);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--border-light);
}

.card-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0;
}

.card-content {
  margin-top: var(--spacing-lg);
}

.description {
  color: var(--text-secondary);
  margin-bottom: var(--spacing-lg);
  line-height: var(--line-height-relaxed);
}

.description.warning {
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
  padding: var(--spacing-md);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-error);
}

/* Stats */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-item {
  padding: var(--spacing-md);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
  font-weight: var(--font-weight-medium);
}

.stat-value {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.stats-total {
  padding-top: var(--spacing-md);
  border-top: 2px solid var(--border-light);
  text-align: center;
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

/* File Upload */
.file-upload-area {
  border: 2px dashed var(--border-medium);
  border-radius: var(--radius-lg);
  padding: var(--spacing-2xl);
  text-align: center;
  cursor: pointer;
  transition: all var(--transition-base);
  margin-bottom: var(--spacing-lg);
  background: var(--bg-secondary);
}

.file-upload-area:hover,
.file-upload-area.dragover {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.05);
}

.upload-placeholder {
  color: var(--text-secondary);
}

.upload-hint {
  font-size: var(--font-size-sm);
  color: var(--text-tertiary);
  margin-top: var(--spacing-xs);
}

.file-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-light);
}

.file-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

/* Import Results */
.import-results {
  margin-top: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.import-results h3 {
  font-size: var(--font-size-lg);
  margin-bottom: var(--spacing-md);
  color: var(--text-primary);
}

.results-grid {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--radius-sm);
}

.collection-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  min-width: 150px;
}

.result-badge {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

.result-badge.success {
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
}

.result-badge.warning {
  background: rgba(245, 158, 11, 0.1);
  color: var(--color-warning);
}

.result-badge.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.error-message {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-error);
}

.success-message {
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  background: rgba(16, 185, 129, 0.1);
  color: var(--color-success);
  border-radius: var(--radius-md);
  border-left: 4px solid var(--color-success);
}

.loading-state {
  text-align: center;
  padding: var(--spacing-xl);
}

.spinner {
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--spacing-md);
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.btn-sm {
  padding: 0.5rem 1rem;
  font-size: var(--font-size-sm);
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  }
  
  .result-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>


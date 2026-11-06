<template>
  <button
    type="button"
    class="btn report-toolbar-icon-btn"
    title="Export as Word document"
    aria-label="Export as Word document"
    @click="$emit('export-doc')"
  >
    <svg
      class="report-toolbar-icon-btn__icon"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.75"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
      />
    </svg>
  </button>
  <button
    type="button"
    class="btn report-toolbar-icon-btn"
    title="Print this report"
    aria-label="Print this report"
    @click="$emit('print')"
  >
    <svg
      class="report-toolbar-icon-btn__icon"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="1.75"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M6.72 13.859A2.25 2.25 0 0 1 5.25 12h13.5a2.25 2.25 0 0 1-1.47 1.859M6.72 13.859l-1.05 3.16A1.875 1.875 0 0 0 6.72 19.5h10.56a1.875 1.875 0 0 0 1.47-3.481l-1.05-3.16M6.72 13.859V9.75a2.25 2.25 0 0 1 2.25-2.25h6.48a2.25 2.25 0 0 1 2.25 2.25v4.109M9 10.5h6"
      />
    </svg>
  </button>
</template>

<script setup>
defineEmits(['export-doc', 'print']);
</script>

<style scoped>
.report-toolbar-icon-btn {
  width: 34px;
  min-width: 34px;
  height: 34px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.report-toolbar-icon-btn:hover {
  color: var(--text-primary);
}

.report-toolbar-icon-btn__icon {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  display: block;
}
</style>

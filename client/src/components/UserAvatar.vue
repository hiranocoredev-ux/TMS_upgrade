<template>
  <div
    class="user-avatar"
    :class="{ 'user-avatar--no-tooltip': !tooltip }"
    :style="avatarStyle"
    :data-tooltip="tooltip ? name : null"
    role="img"
    :aria-label="name"
  >
    <img
      v-if="resolvedProfileImage && !imgError"
      :src="resolvedProfileImage"
      :alt="name"
      class="user-avatar__img"
      @error="imgError = true"
    />
    <span v-else class="user-avatar__initials">{{ initials }}</span>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue';
import { resolveUploadSrc } from '../utils/resolveUploadSrc';

const props = defineProps({
  name: { type: String, required: true },
  profileImage: { type: String, default: '' },
  size: { type: Number, default: 40 },
  tooltip: { type: Boolean, default: true },
});

const imgError = ref(false);

const resolvedProfileImage = computed(() => {
  const raw = (props.profileImage || '').trim();
  if (!raw) return '';
  return resolveUploadSrc(raw);
});

watch(resolvedProfileImage, () => {
  // Reset failed state when source changes so new uploads render immediately.
  imgError.value = false;
});

const initials = computed(() => {
  const n = (props.name || '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
});

const PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#a855f7',
  '#f97316', '#84cc16', '#0ea5e9', '#d946ef',
];

const bgColor = computed(() => {
  const n = props.name || '';
  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = (hash * 31 + n.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
});

const avatarStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  backgroundColor: resolvedProfileImage.value && !imgError.value ? 'transparent' : bgColor.value,
  fontSize: `${Math.max(10, Math.floor(props.size * 0.4))}px`,
}));
</script>

<style scoped>
.user-avatar {
  position: relative;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  user-select: none;
  cursor: pointer;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18), inset 0 0 0 2px rgba(255, 255, 255, 0.35);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.user-avatar:hover {
  transform: scale(1.1);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.25), inset 0 0 0 2px rgba(255, 255, 255, 0.5);
  z-index: 10;
}
.user-avatar__img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
}
.user-avatar__initials {
  line-height: 1;
}

/* ── Tooltip (pure CSS) ── */
.user-avatar::before,
.user-avatar::after {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease, transform 0.18s ease;
  position: absolute;
  left: 50%;
  z-index: 20;
}
.user-avatar::after {
  content: attr(data-tooltip);
  bottom: calc(100% + 10px);
  transform: translateX(-50%) translateY(4px);
  background: rgba(17, 24, 39, 0.96);
  color: #fff;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-transform: none;
  letter-spacing: 0;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
}
.user-avatar::before {
  content: '';
  bottom: calc(100% + 4px);
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-top-color: rgba(17, 24, 39, 0.96);
}
.user-avatar:hover::after {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.user-avatar:hover::before {
  opacity: 1;
}
.user-avatar--no-tooltip::before,
.user-avatar--no-tooltip::after {
  display: none;
}
</style>

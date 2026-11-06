<template>
  <div
    class="report-rich-editor"
    :class="{ 'is-disabled': disabled, 'report-rich-editor--composer': size === 'composer' }"
  >
    <div
      v-if="editor"
      class="editor-toolbar"
      :class="{ 'editor-toolbar--compact': size === 'composer' }"
    >
      <div class="toolbar-group toolbar-group--segmented" role="radiogroup" aria-label="Text type">
        <button
          type="button"
          class="seg-btn"
          :class="{ 'is-active': activeTextKind === 'body' }"
          :disabled="disabled"
          title="Body text"
          @click="setTextKind('body')"
        >
          <span class="seg-btn__icon">T</span>
          <span class="seg-btn__label">Body</span>
        </button>
        <button
          type="button"
          class="seg-btn"
          :class="{ 'is-active': activeTextKind === 'subtitle' }"
          :disabled="disabled"
          title="Subtitle text"
          @click="setTextKind('subtitle')"
        >
          <span class="seg-btn__icon seg-btn__icon--subtitle">H</span>
          <span class="seg-btn__label">Subtitle</span>
        </button>
      </div>

      <div class="toolbar-group toolbar-group--colors" aria-label="Text color">
        <button
          v-for="color in reportColors"
          :key="color.value"
          type="button"
          class="color-swatch-btn"
          :class="{ 'is-active': activeColor === color.value }"
          :style="{ '--swatch-color': color.value }"
          :title="color.label"
          :disabled="disabled"
          @click="setColor(color.value)"
        />
      </div>

      <div class="toolbar-group toolbar-group--emoji-popup">
        <button
          type="button"
          class="tool-btn tool-btn--icon"
          :class="{ 'is-active': isEmojiPanelOpen }"
          title="Insert emoticon"
          :disabled="disabled"
          aria-label="Insert emoticon"
          @click="toggleEmojiPanel"
        >
          <svg viewBox="0 0 24 24" class="tool-icon" aria-hidden="true">
            <circle cx="12" cy="12" r="8" />
            <circle cx="9" cy="10" r="1" />
            <circle cx="15" cy="10" r="1" />
            <path d="M8.5 14.3c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
          </svg>
        </button>
        <div v-if="isEmojiPanelOpen && !disabled" class="emoji-panel" role="dialog" aria-label="Emoticon picker">
          <button
            v-for="emoji in reportEmojis"
            :key="emoji.value"
            type="button"
            class="emoji-btn"
            :title="emoji.label"
            @click="insertEmoji(emoji.value)"
          >
            {{ emoji.value }}
          </button>
        </div>
      </div>

      <button type="button" class="tool-btn tool-btn--icon" title="Insert dotted divider" @click="insertDottedDivider" :disabled="disabled" aria-label="Insert dotted divider">
        <svg viewBox="0 0 24 24" class="tool-icon" aria-hidden="true">
          <path d="M4 12h16" />
          <circle cx="7" cy="12" r="1.4" />
          <circle cx="12" cy="12" r="1.4" />
          <circle cx="17" cy="12" r="1.4" />
        </svg>
      </button>
      <button type="button" class="tool-btn tool-btn--icon" title="Insert image" @click="pickImage" :disabled="disabled" aria-label="Insert image">
        <svg viewBox="0 0 24 24" class="tool-icon" aria-hidden="true">
          <rect x="3.5" y="5.5" width="17" height="13" rx="2.2" />
          <circle cx="9" cy="10" r="1.6" />
          <path d="M5.7 16.3l4.2-4.1a1.2 1.2 0 0 1 1.7.03l2.1 2.2 1.8-1.9a1.2 1.2 0 0 1 1.75.04l1.9 2.1" />
        </svg>
      </button>
      <input ref="imageInput" type="file" accept="image/*" class="hidden-input" @change="handleImageSelected" />
    </div>

    <editor-content v-if="editor" :editor="editor" class="editor-content" />
    <div v-else class="editor-loading">Loading editor...</div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style';
import ImageResize from 'tiptap-extension-resize-image';

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  /** Hint when the body is empty (also used in read-only carry-forward blocks). */
  placeholder: {
    type: String,
    default: 'Add notes for this section-plain text, bold, color, or images.'
  },
  /** `composer` uses a taller editing surface on submit pages. */
  size: { type: String, default: 'default' }
});

const placeholderLive = ref(props.placeholder);
watch(
  () => props.placeholder,
  (v) => {
    placeholderLive.value = v;
  }
);

const emit = defineEmits(['update:modelValue']);
const imageInput = ref(null);
const isEmojiPanelOpen = ref(false);
const reportColors = [
  { label: 'Default', value: '#111827' },
  { label: 'Blue', value: '#1d4ed8' },
  { label: 'Green', value: '#15803d' },
  { label: 'Orange', value: '#c2410c' },
  { label: 'Red', value: '#b91c1c' },
  { label: 'Gray', value: '#475569' }
];
const reportEmojis = [
  { label: 'Done', value: '✅' },
  { label: 'In Progress', value: '🔄' },
  { label: 'Blocked', value: '⛔' },
  { label: 'Warning', value: '⚠️' },
  { label: 'Attention', value: '❗' },
  { label: 'Info', value: 'ℹ️' },
  { label: 'Idea', value: '💡' },
  { label: 'Note', value: '📝' },
  { label: 'Action Required', value: '📌' },
  { label: 'Target', value: '🎯' },
  { label: 'Milestone', value: '🏁' },
  { label: 'Chart', value: '📊' },
  { label: 'Growth', value: '📈' },
  { label: 'Risk', value: '🚧' },
  { label: 'Success', value: '🚀' }
];

const editor = new Editor({
  content: props.modelValue || '<p></p>',
  editable: !props.disabled,
  enableInputRules: false,
  enablePasteRules: false,
  extensions: [
    StarterKit.configure({
      bulletList: false,
      orderedList: false,
      listItem: false,
      blockquote: false,
      codeBlock: false,
      heading: false,
      horizontalRule: {
        HTMLAttributes: {
          class: 'report-dot-divider'
        }
      }
    }),
    TextStyle,
    Color,
    FontSize,
    ImageResize.configure({
      minWidth: 80,
      maxWidth: 1200
    }),
    Placeholder.configure({
      placeholder: () => placeholderLive.value,
      showOnlyWhenEditable: false,
      emptyNodeClass: 'is-editor-empty',
      emptyEditorClass: 'is-editor-empty-root'
    })
  ],
  editorProps: {
    attributes: {
      class: 'tiptap-content',
    },
    handlePaste: (view, event) => {
      const clipboard = event?.clipboardData;
      if (!clipboard?.items?.length) return false;

      const imageItem = Array.from(clipboard.items).find((item) => item.type?.startsWith('image/'));
      if (!imageItem) return false;

      const file = imageItem.getAsFile();
      if (!file) return false;

      const reader = new FileReader();
      reader.onload = async () => {
        const src = String(reader.result || '');
        if (!src) return;
        const naturalWidth = await getImageNaturalWidth(src);
        const initialWidth = getInitialRenderWidth(naturalWidth, true);
        const { schema, tr } = view.state;
        const imageNodeType = schema.nodes.imageResize || schema.nodes.image;
        const node = imageNodeType?.create({
          src,
          alt: file.name || 'clipboard-image',
          width: initialWidth ? String(initialWidth) : undefined,
          containerStyle: initialWidth ? `width: ${initialWidth}px; height: auto; cursor: pointer;` : undefined
        });
        if (!node) return;
        view.dispatch(tr.replaceSelectionWith(node).scrollIntoView());
      };
      reader.readAsDataURL(file);
      return true;
    },
  },
  onUpdate: ({ editor: instance }) => {
    emit('update:modelValue', instance.getHTML());
  },
});

const activeColor = computed(() => {
  const color = editor.getAttributes('textStyle')?.color;
  return color || '#111827';
});

const activeTextKind = computed(() => {
  const attrs = editor.getAttributes('textStyle') || {};
  const isSubtitle = String(attrs.fontSize || '') === '16px'
    && String(attrs.color || '') === '#1d4ed8'
    && editor.isActive('bold');
  return isSubtitle ? 'subtitle' : 'body';
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor) return;
    const current = editor.getHTML();
    if ((value || '') !== current) {
      editor.commands.setContent(value || '<p></p>', false);
    }
  }
);

watch(
  () => props.disabled,
  (value) => {
    if (!editor) return;
    editor.setEditable(!value);
    if (value) isEmojiPanelOpen.value = false;
  },
  { immediate: true }
);

const setColor = (hex) => editor.chain().focus().setColor(hex).run();
const pickImage = () => imageInput.value?.click();
const setTextKind = (value) => {
  if (value === 'subtitle') {
    editor.chain().focus().setFontSize('16px').setColor('#1d4ed8').setBold().run();
    return;
  }
  editor.chain().focus().setFontSize('14px').setColor('#111827').unsetBold().run();
};
const insertEmoji = (value) => {
  const emoji = String(value || '');
  if (!emoji) return;
  editor.chain().focus().insertContent(`${emoji} `).run();
  isEmojiPanelOpen.value = false;
};
const insertDottedDivider = () => {
  editor.chain().focus().setHorizontalRule().run();
};
const toggleEmojiPanel = () => {
  isEmojiPanelOpen.value = !isEmojiPanelOpen.value;
};

const fileToDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result || ''));
  reader.onerror = () => reject(new Error('Failed to read image'));
  reader.readAsDataURL(file);
});

const getImageNaturalWidth = (src) => new Promise((resolve) => {
  const img = new Image();
  img.onload = () => resolve(img.naturalWidth || 0);
  img.onerror = () => resolve(0);
  img.src = src;
});

const getInitialRenderWidth = (naturalWidth, fromClipboard = false) => {
  if (!naturalWidth) return 0;
  if (!fromClipboard) return Math.round(naturalWidth);
  const dpr = window.devicePixelRatio || 1;
  // Clipboard screenshots are often stored in device pixels;
  // divide by DPR to keep the same on-screen visual size.
  return Math.max(1, Math.round(naturalWidth / dpr));
};

const handleImageSelected = async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const dataUrl = await fileToDataUrl(file);
    const naturalWidth = await getImageNaturalWidth(dataUrl);
    const initialWidth = getInitialRenderWidth(naturalWidth, false);
    editor.chain().focus().setImage({
      src: dataUrl,
      alt: file.name,
      width: initialWidth ? String(initialWidth) : undefined,
      containerStyle: initialWidth ? `width: ${initialWidth}px; height: auto; cursor: pointer;` : undefined
    }).run();
  } finally {
    event.target.value = '';
  }
};

onBeforeUnmount(() => {
  editor?.destroy();
});
</script>

<style scoped>
.report-rich-editor {
  min-height: 200px;
  border: 1px solid var(--border-medium);
  border-radius: 10px;
  overflow: visible;
  background: var(--bg-primary);
}

.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 10px;
  border-bottom: 1px solid var(--border-light);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bg-tertiary) 88%, #ffffff) 0%, var(--bg-secondary) 100%);
  overflow: visible;
  position: relative;
  z-index: 8;
}

.toolbar-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px;
  border: 1px solid color-mix(in srgb, var(--border-light) 86%, #dbe7f4);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-primary) 92%, #f8fafc);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.toolbar-group--emoji {
  max-width: 280px;
  overflow-x: auto;
}

.toolbar-group--emoji-popup {
  position: relative;
  padding: 0;
  border: none;
  background: transparent;
  box-shadow: none;
}

.tool-btn {
  height: 36px;
  min-width: 36px;
  border: 1px solid color-mix(in srgb, var(--border-medium) 82%, #cbd5e1);
  background: linear-gradient(180deg, var(--bg-primary) 0%, color-mix(in srgb, var(--bg-primary) 90%, #e2e8f0) 100%);
  color: var(--text-primary);
  border-radius: 10px;
  cursor: pointer;
  padding: 0 10px;
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  transition: all 0.16s ease;
}

.tool-btn:hover:not(:disabled) {
  background: color-mix(in srgb, var(--color-primary-soft) 45%, var(--bg-primary));
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--border-dark));
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(37, 99, 235, 0.12);
}

.tool-btn:active:not(:disabled) {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
}

.tool-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.tool-btn.is-active {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 34%, var(--border-medium));
  background: color-mix(in srgb, var(--color-primary-soft) 48%, var(--bg-primary));
}

.tool-btn--icon {
  width: 36px;
  min-width: 36px;
  padding: 0;
}

.tool-icon {
  width: 18px;
  height: 18px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.seg-btn {
  height: 30px;
  min-width: 88px;
  border: 1px solid color-mix(in srgb, var(--border-medium) 82%, #cbd5e1);
  border-radius: 9px;
  background: var(--bg-primary);
  color: var(--text-primary);
  padding: 0 10px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;
}

.seg-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-primary) 32%, var(--border-medium));
  background: color-mix(in srgb, var(--color-primary-soft) 34%, var(--bg-primary));
}

.seg-btn.is-active {
  color: var(--color-primary);
  border-color: color-mix(in srgb, var(--color-primary) 42%, var(--border-medium));
  background: color-mix(in srgb, var(--color-primary-soft) 60%, #eff6ff);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.65);
}

.seg-btn__icon {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 10px;
  color: #334155;
  background: #e2e8f0;
}

.seg-btn__icon--subtitle {
  color: #1d4ed8;
  background: #dbeafe;
  font-size: 11px;
}

.color-swatch-btn {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  border: 1.5px solid rgba(15, 23, 42, 0.18);
  background: var(--swatch-color);
  cursor: pointer;
  padding: 0;
  position: relative;
}

.color-swatch-btn.is-active::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 999px;
  border: 2px solid color-mix(in srgb, var(--color-primary) 55%, #1d4ed8);
}

.emoji-panel {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  width: calc((28px * 5) + (6px * 4) + (10px * 2));
  padding: 10px;
  box-sizing: border-box;
  align-items: center;
  border: 1px solid color-mix(in srgb, var(--border-light) 80%, #cbd5e1);
  border-radius: 12px;
  background: color-mix(in srgb, var(--bg-primary) 96%, #ffffff);
  box-shadow:
    0 10px 24px rgba(15, 23, 42, 0.16),
    0 1px 0 rgba(255, 255, 255, 0.8) inset;
}

.emoji-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  line-height: 1;
  outline: none;
}

.emoji-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--color-primary) 24%, var(--border-light));
  background: color-mix(in srgb, var(--color-primary-soft) 38%, var(--bg-primary));
}

.emoji-btn:focus-visible {
  border-color: color-mix(in srgb, var(--color-primary) 36%, var(--border-medium));
  background: color-mix(in srgb, var(--color-primary-soft) 48%, var(--bg-primary));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary-soft) 86%, #dbeafe);
}

.hidden-input {
  display: none;
}

.editor-content :deep(.tiptap-content hr.report-dot-divider) {
  border: 0;
  border-top: 2px dotted #cbd5e1;
  margin: 12px 0;
}

.editor-content {
  min-height: 180px;
  height: 320px;
  max-height: 900px;
  overflow-y: auto;
  overflow-x: hidden;
  resize: vertical;
}

.report-rich-editor--composer {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.report-rich-editor--composer {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.report-rich-editor--composer:focus-within {
  border-color: var(--color-primary, #2563eb);
  box-shadow:
    inset 0 1px 2px rgba(15, 23, 42, 0.04),
    0 0 0 3px color-mix(in srgb, var(--color-primary, #2563eb) 18%, transparent);
}

.report-rich-editor--composer .editor-toolbar--compact {
  padding: 5px 8px;
  gap: 6px;
  min-height: 0;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.report-rich-editor--composer .editor-toolbar--compact .toolbar-group {
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  gap: 4px;
}

.report-rich-editor--composer .editor-toolbar--compact .toolbar-group--segmented {
  padding: 2px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #fff;
}

.report-rich-editor--composer .editor-toolbar--compact .seg-btn {
  min-width: 0;
  width: 30px;
  height: 26px;
  padding: 0;
  border-radius: 5px;
  border: none;
  box-shadow: none;
  background: transparent;
}

.report-rich-editor--composer .editor-toolbar--compact .seg-btn__label {
  display: none;
}

.report-rich-editor--composer .editor-toolbar--compact .seg-btn__icon {
  width: 14px;
  height: 14px;
  font-size: 9px;
}

.report-rich-editor--composer .editor-toolbar--compact .seg-btn.is-active {
  background: #eff6ff;
  box-shadow: none;
}

.report-rich-editor--composer .editor-toolbar--compact .color-swatch-btn {
  width: 16px;
  height: 16px;
  border-width: 1px;
}

.report-rich-editor--composer .editor-toolbar--compact .tool-btn {
  height: 26px;
  min-width: 26px;
  padding: 0;
  border-radius: 6px;
  border-color: #e2e8f0;
  box-shadow: none;
  background: #fff;
}

.report-rich-editor--composer .editor-toolbar--compact .tool-btn:hover:not(:disabled) {
  transform: none;
  box-shadow: none;
  background: #f1f5f9;
}

.report-rich-editor--composer .editor-toolbar--compact .tool-btn--icon {
  width: 26px;
  min-width: 26px;
}

.report-rich-editor--composer .editor-toolbar--compact .tool-icon {
  width: 15px;
  height: 15px;
}

.report-rich-editor--composer .editor-content {
  flex: 1;
  height: auto;
  min-height: 132px;
  max-height: 480px;
  resize: vertical;
  background: #ffffff;
}

.report-rich-editor--composer .editor-content :deep(.tiptap-content) {
  min-height: 120px;
  padding: 10px 12px;
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--text-primary, #0f172a);
}

.editor-content :deep(.tiptap-content) {
  min-height: 100%;
  font-size: 14px;
  line-height: 1.6;
  padding: 14px 16px;
  outline: none;
  background: var(--bg-primary);
  color: var(--text-secondary);
}

.editor-content :deep(.tiptap-content p) {
  margin: 0;
}

.editor-content :deep(.tiptap-content p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
  color: var(--text-tertiary, #94a3b8);
  font-weight: var(--font-weight-normal, 400);
}

.report-rich-editor.is-disabled :deep(.tiptap-content p.is-editor-empty:first-child::before) {
  color: var(--text-tertiary, #94a3b8);
}

.editor-content :deep(.tiptap-content img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

/* Selected image state: blue mask for TipTap + resize-image wrappers */
.editor-content :deep(.tiptap-content img.ProseMirror-selectednode),
.editor-content :deep(.tiptap-content .ProseMirror-selectednode img),
.editor-content :deep(.tiptap-content div[style*="border: 1px dashed"] img),
.editor-content :deep(.tiptap-content figure[style*="border: 1px dashed"] img) {
  filter: brightness(0.88) saturate(1.15);
}

.editor-content :deep(.tiptap-content div[style*="border: 1px dashed"]),
.editor-content :deep(.tiptap-content figure[style*="border: 1px dashed"]) {
  position: relative !important;
}

.editor-content :deep(.tiptap-content div[style*="border: 1px dashed"]::after),
.editor-content :deep(.tiptap-content figure[style*="border: 1px dashed"]::after) {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(37, 99, 235, 0.24);
  pointer-events: none;
  border-radius: 6px;
}

.is-disabled {
  opacity: 0.9;
}

/* Read-only / disabled: no resize handle (avoids stray grip on carry-forward & review states). */
.report-rich-editor.is-disabled :deep(.editor-content) {
  resize: none;
}

.editor-loading {
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

@media (max-width: 640px) {
  .editor-toolbar {
    gap: 7px;
    padding: 8px;
  }

  .tool-btn {
    min-width: 34px;
    height: 34px;
    padding: 0 8px;
    font-size: 12px;
  }

  .seg-btn {
    min-width: 74px;
    height: 28px;
  }

  .toolbar-group {
    border-radius: 10px;
    padding: 2px;
  }

  .toolbar-group--emoji {
    max-width: 210px;
  }

  .emoji-panel {
    left: 50%;
    right: auto;
    transform: translateX(-50%);
    width: calc((28px * 4) + (6px * 3) + (10px * 2));
  }

  .emoji-btn {
    width: 26px;
    height: 26px;
    font-size: 14px;
  }

  .editor-content :deep(.tiptap-content) {
    min-height: 100%;
  }

  .editor-content {
    height: 240px;
    max-height: 640px;
  }
}
</style>

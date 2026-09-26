<template>
  <Teleport to="body">
    <Transition name="close-confirm-fade">
      <div v-if="visible" class="close-backdrop" @click.self="cancel">
        <section
          class="close-panel"
          role="dialog"
          aria-modal="true"
          aria-label="关闭确认"
          @keydown.esc="cancel"
        >
          <header class="close-header">
            <div>
              <h2>关闭 QZ Music</h2>
              <p>想直接退出，还是让音乐在后台继续？</p>
            </div>
            <button class="icon-btn" title="取消" @click="cancel">
              <Icon icon="lucide:x" />
            </button>
          </header>

          <div class="choice-row">
            <button class="choice-card quit" @click="choose('quit')">
              <Icon icon="lucide:door-open" class="choice-icon" />
              <span class="choice-title">退出程序</span>
              <span class="choice-desc">停止播放并关闭</span>
            </button>
            <button class="choice-card tray" @click="choose('tray')">
              <Icon icon="lucide:moon" class="choice-icon" />
              <span class="choice-title">最小化到托盘</span>
              <span class="choice-desc">在后台继续播放</span>
            </button>
          </div>

          <label class="remember-row">
            <input v-model="remember" type="checkbox" />
            <span>记住我的选择（可在 设置 → 播放 中修改）</span>
          </label>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Icon } from '@iconify/vue'

defineProps<{ visible: boolean }>()
const emit = defineEmits<{
  choose: [action: 'quit' | 'tray' | 'cancel', remember: boolean]
}>()

const remember = ref(false)

function choose(action: 'quit' | 'tray') {
  emit('choose', action, remember.value)
}

function cancel() {
  emit('choose', 'cancel', false)
}
</script>

<style scoped>
.close-backdrop {
  position: fixed;
  inset: 0;
  z-index: 7000;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.52);
}

.close-panel {
  width: min(380px, calc(100vw - 32px));
  padding: 22px;
  border-radius: 20px;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-elevated);
  outline: none;
}

.close-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.close-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--color-text-primary);
}

.close-header p {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--color-text-muted);
}

.icon-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: var(--radius-full);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 18px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.icon-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.choice-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.choice-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 16px 14px;
  border: 1px solid var(--color-border-light);
  border-radius: 14px;
  background: var(--color-bg-secondary);
  cursor: pointer;
  text-align: left;
  transition: var(--transition-fast);
}

.choice-card:hover {
  border-color: var(--color-accent);
  background: var(--color-accent-soft);
}

.choice-icon {
  font-size: 22px;
  color: var(--color-accent);
  margin-bottom: 6px;
}

.choice-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.choice-desc {
  font-size: 12px;
  color: var(--color-text-muted);
}

.remember-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  font-size: 13px;
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.remember-row input {
  accent-color: var(--color-accent);
  cursor: pointer;
}

.close-confirm-fade-enter-active,
.close-confirm-fade-leave-active {
  transition: opacity 0.18s ease;
}

.close-confirm-fade-enter-active .close-panel,
.close-confirm-fade-leave-active .close-panel {
  transition: transform 0.18s ease;
}

.close-confirm-fade-enter-from,
.close-confirm-fade-leave-to {
  opacity: 0;
}

.close-confirm-fade-enter-from .close-panel {
  transform: scale(0.96);
}
</style>

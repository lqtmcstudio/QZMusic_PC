<template>
  <Teleport to="body">
    <Transition name="whats-new-fade">
      <div v-if="visible" class="wn-backdrop" @click.self="close">
        <section class="wn-panel" role="dialog" aria-modal="true" aria-label="版本更新说明">
          <header class="wn-header">
            <div class="wn-title-wrap">
              <span class="wn-badge">NEW</span>
              <h2>QZ Music 已更新</h2>
            </div>
            <button class="icon-btn" title="关闭" @click="close">
              <Icon icon="lucide:x" />
            </button>
          </header>

          <p class="wn-version-line">
            当前版本 <span class="wn-version">v{{ appVersion }}</span>
            <span v-if="previousVersion" class="wn-prev">（从 v{{ previousVersion }} 升级）</span>
          </p>

          <div class="wn-changelog">
            <div v-for="(item, i) in changelog" :key="i" class="wn-item">
              <Icon icon="lucide:check" class="wn-check" />
              <div>
                <span class="wn-item-title">{{ item.title }}</span>
                <span class="wn-item-desc">{{ item.desc }}</span>
              </div>
            </div>
          </div>

          <div class="wn-actions">
            <button class="wn-primary" @click="close">知道了</button>
            <button class="wn-secondary" @click="openReleases">
              <Icon icon="lucide:globe" />
              查看完整更新日志
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'

defineProps<{ visible: boolean; appVersion: string; previousVersion?: string }>()
const emit = defineEmits<{ close: [] }>()

// 与 v1.0.4 相比的更新内容, 发新版时同步维护
const changelog = [
  { title: '修复启动闪退 / 窗口不显示', desc: '打包后窗口无法创建的问题已解决，重复打开会自动唤回窗口' },
  { title: '界面图标完全离线化', desc: '图标数据内置，断网环境界面图标照常显示' },
  { title: '全新关闭确认弹窗', desc: '可选「退出程序 / 最小化到托盘」，支持记住选择' },
  { title: '设置-关于页重做', desc: '动态版本号、运行信息卡片、可点击开发者主页、官网入口' },
  { title: '窗口 DPI / 分辨率自适应', desc: '按屏幕工作区自适应尺寸（5:4 比例），修复低分屏溢出' },
  { title: '安装包瘦身', desc: '仅打包运行产物，体积 147MB → 113MB，图标全尺寸清晰' },
]

function close() {
  emit('close')
}

function openReleases() {
  window.electronAPI?.openExternal('https://github.com/lqtmcstudio/QZMusic_PC/releases')
}
</script>

<style scoped>
.wn-backdrop {
  position: fixed;
  inset: 0;
  z-index: 7100;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.52);
}

.wn-panel {
  width: min(420px, calc(100vw - 32px));
  max-height: calc(100vh - 48px);
  overflow-y: auto;
  padding: 22px;
  border-radius: 20px;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-elevated);
}

.wn-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.wn-title-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}

.wn-title-wrap h2 {
  margin: 0;
  font-size: 19px;
  color: var(--color-text-primary);
}

.wn-badge {
  padding: 3px 9px;
  border-radius: var(--radius-full);
  background: var(--color-accent);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
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

.wn-version-line {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.wn-version {
  color: var(--color-accent);
  font-weight: 600;
}

.wn-prev {
  color: var(--color-text-muted);
}

.wn-changelog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 18px;
}

.wn-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
}

.wn-check {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 16px;
  color: var(--color-accent);
}

.wn-item-title {
  display: block;
  font-size: 13.5px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.wn-item-desc {
  display: block;
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--color-text-muted);
}

.wn-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
}

.wn-primary {
  flex: 1;
  padding: 10px 0;
  border: none;
  border-radius: var(--radius-md);
  background: var(--color-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: var(--transition-fast);
}

.wn-primary:hover {
  background: var(--color-accent-hover);
}

.wn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-md);
  background: transparent;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: var(--transition-fast);
}

.wn-secondary:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.whats-new-fade-enter-active,
.whats-new-fade-leave-active {
  transition: opacity 0.18s ease;
}

.whats-new-fade-enter-active .wn-panel,
.whats-new-fade-leave-active .wn-panel {
  transition: transform 0.18s ease;
}

.whats-new-fade-enter-from,
.whats-new-fade-leave-to {
  opacity: 0;
}

.whats-new-fade-enter-from .wn-panel {
  transform: scale(0.96);
}
</style>

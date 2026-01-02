<template>
  <div class="window-controls">
    <div class="settings-btn" @click="store.toggleSettings">
      <Icon icon="lucide:settings" width="22" />
    </div>

    <div class="divider"></div>

    <div class="traffic-lights">
      <div class="light minimize" @click="handleMinimize"></div>
      <div class="light maximize" @click="handleMaximize"></div>
      <div class="light close" @click="handleClose"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { usePlayerStore } from '../../stores/playerStore'

const store = usePlayerStore()

// ✅ 调用主进程暴露的 API
const handleClose = () => {
  window.electronAPI.closeWindow()
}

const handleMinimize = () => {
  window.electronAPI.minimizeWindow()
}

const handleMaximize = async () => {
  // 可选：切换图标（比如最大化/还原）
  await window.electronAPI.maximizeWindow()
}
</script>

<style scoped lang="scss">
.window-controls {
  display: flex;
  align-items: center;
  padding: 0 24px;
  height: 100%;
  gap: 24px; // 设置和红绿灯之间的距离
  -webkit-app-region: no-drag;

  .settings-btn {
      cursor: pointer;
      color: var(--text-tertiary);
      display: flex;
      align-items: center;
      transition: all 0.3s ease;

      &:hover {
        color: var(--text-primary);
        transform: rotate(45deg); // 简单的交互动画
      }
    }

    .divider {
      width: 1px;
      height: 18px;
      background-color: var(--border-color);
    }

  .traffic-lights {
    display: flex;
    gap: 10px; // 按钮间距拉大

    .light {
      width: 15px; // 放大按钮 (原12px)
      height: 15px;
      border-radius: 50%;
      cursor: pointer;
      position: relative;
      transition: transform 0.1s, opacity 0.2s;

      &:hover { opacity: 0.8; }
      &:active { transform: scale(0.9); }

      /* 调整了顺序: 最小化-最大化-关闭，符合一般习惯，也可按需调整 */
      &.close { background-color: #ff5f56; }
      &.minimize { background-color: #ffbd2e; }
      &.maximize { background-color: #27c93f; }
    }
  }
}
</style>

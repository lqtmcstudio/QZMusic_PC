<template>
  <div class="window-controls">
    <div class="traffic-lights">
      <div class="light minimize" @click="handleMinimize"></div>
      <div class="light maximize" @click="handleMaximize"></div>
      <div class="light close" @click="handleClose"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  -webkit-app-region: no-drag;

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

<template>
  <div class="app-container" :class="{ 'dark-mode': store.darkMode }">
    <SettingsOverlay />
    <SideBar />

    <main class="main-content">
      <header class="header-bar">
        <div class="header-left"></div>
        <WindowControls />
      </header>

      <div class="content-scrollable">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <footer class="footer-player">
      <PlayerBar />
    </footer>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from './stores/playerStore';
import SideBar from './components/layout/SideBar.vue';
import WindowControls from './components/layout/WindowControls.vue';
import PlayerBar from './components/layout/PlayerBar.vue';
import SettingsOverlay from "./components/layout/SettingsOverlay.vue";

const store = usePlayerStore();
</script>

<style lang="scss">
/* 主题变量系统 */
:root {
  /* 亮色主题变量 */
  --bg-primary: #ffffff;
  --bg-secondary: #f6f8fa;
  --bg-tertiary: #f9fafb;
  --text-primary: #333333;
  --text-secondary: #666666;
  --text-tertiary: #888888;
  --border-color: #e0e0e0;
  --border-light: #f0f0f0;
  --sidebar-bg: #f6f8fa;
  --sidebar-border: #e0e0e0;
  --header-bg: #ffffff;
  --content-bg: #ffffff;
  --player-bg: #ffffff;
  --card-bg: #ffffff;
  --overlay-bg: rgba(0, 0, 0, 0.4);
  --settings-modal-bg: white;
  --settings-sidebar-bg: #f9fafb;
  --settings-sidebar-border: #eee;
  --nav-item-hover: #eee;
  --nav-item-active: #333;
  --nav-item-active-text: white;
  --close-btn-color: #999;
  --close-btn-hover: #333;
  --dummy-option-border: #f0f0f0;
  --logo-placeholder-bg: linear-gradient(45deg, #ff6b6b, #4ecdc4);
}

/* 深色主题变量 */
.dark-mode {
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #333333;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
  --text-tertiary: #808080;
  --border-color: #404040;
  --border-light: #3a3a3a;
  --sidebar-bg: #2d2d2d;
  --sidebar-border: #404040;
  --header-bg: #1a1a1a;
  --content-bg: #1a1a1a;
  --player-bg: #1a1a1a;
  --card-bg: #2d2d2d;
  --overlay-bg: rgba(0, 0, 0, 0.7);
  --settings-modal-bg: #2d2d2d;
  --settings-sidebar-bg: #333333;
  --settings-sidebar-border: #404040;
  --nav-item-hover: #404040;
  --nav-item-active: #6366f1;
  --nav-item-active-text: white;
  --close-btn-color: #808080;
  --close-btn-hover: #ffffff;
  --dummy-option-border: #3a3a3a;
  --logo-placeholder-bg: linear-gradient(45deg, #6366f1, #8b5cf6);
}

/* 全局重置 */
html, body, #app {
  height: 100%;
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  overflow: hidden; /* 防止浏览器默认滚动 */
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.6s ease, color 0.6s ease;
}

/* 布局结构 */
.app-container {
  display: grid;
  grid-template-columns: 220px 1fr; /* 侧边栏宽度 | 主内容 */
  grid-template-rows: 1fr 80px;     /* 主体高度 | 播放器高度 */
  transition: background-color 0.6s ease;
}

/* 布局结构样式 */
.app-container {
  height: 100vh;
  width: 100vw;

  /* 侧边栏跨越第一行 */
  .sidebar {
    grid-column: 1 / 2;
    grid-row: 1 / 2;
  }

  /* 主内容区 */
  .main-content {
    grid-column: 2 / 3;
    grid-row: 1 / 2;
    display: flex;
    flex-direction: column;
    position: relative;
    background: var(--content-bg);

    /* 顶部拖拽区 */
    .header-bar {
      height: 60px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      -webkit-app-region: drag; /* Electron 拖拽 */
      background: var(--header-bg);
    }

    /* 路由视图滚动区 */
    .content-scrollable {
      flex: 1;
      overflow-y: auto;
      padding: 20px 40px;
      background: var(--content-bg);

      /* 隐藏滚动条但保留功能 */
      &::-webkit-scrollbar { width: 6px; }
      &::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 3px;
      }
      &::-webkit-scrollbar-track {
        background: var(--bg-secondary);
      }
    }
  }

  /* 底部播放器跨越两列 */
  .footer-player {
    grid-column: 1 / 3;
    grid-row: 2 / 3;
    z-index: 200;
    background: var(--player-bg);
  }
}

/* 路由动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

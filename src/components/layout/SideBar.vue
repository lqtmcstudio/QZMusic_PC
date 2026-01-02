<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo-placeholder">M</div>
      <span class="app-name">Muse Player</span>
    </div>

    <nav class="menu">
      <router-link to="/" class="menu-item" active-class="active">
        <Icon icon="lucide:home" width="20" />
        <span>主页</span>
      </router-link>
      <router-link to="/local" class="menu-item" active-class="active">
        <Icon icon="lucide:hard-drive" width="20" />
        <span>本地音乐</span>
      </router-link>
      <router-link to="/playlist" class="menu-item" active-class="active">
        <Icon icon="lucide:list-music" width="20" />
        <span>我的歌单</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';
</script>

<style scoped lang="scss">
.sidebar {
  width: 220px;
  height: 100%;
  background-color: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  padding: 20px 12px;
  border-right: 1px solid var(--sidebar-border);
  // 针对 Electron 的拖拽区域避免
  -webkit-app-region: drag;

  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 40px;
    padding-left: 12px;

    .logo-placeholder {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, #ff6b6b, #556270);
      border-radius: 8px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
    }

    .app-name {
      font-weight: 600;
      font-size: 18px;
      color: var(--text-primary);
    }
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    -webkit-app-region: no-drag; // 菜单项可点击，不可拖拽

    .menu-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-radius: 10px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.2s ease;
      font-size: 14px;

      &:hover {
        background-color: var(--nav-item-hover);
        color: var(--text-primary);
      }

      &.active {
        background-color: var(--bg-primary);
        color: var(--text-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        font-weight: 500;
      }
    }
  }
}
</style>

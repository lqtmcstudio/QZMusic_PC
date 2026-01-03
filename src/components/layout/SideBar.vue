<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="logo-placeholder">M</div>
      <span class="app-name">Muse Player</span>
    </div>

    <nav class="menu">
      <router-link 
        v-for="item in menuItems" 
        :key="item.path"
        :to="item.path" 
        class="menu-item"
        active-class="active"
        :title="item.label"
      >
        <Icon :icon="item.icon" width="20" />
        <span>{{ item.label }}</span>
      </router-link>
    </nav>
  </aside>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue';

const menuItems = [
  { path: '/', label: '主页', icon: 'lucide:home' },
  { path: '/local', label: '本地音乐', icon: 'lucide:hard-drive' },
  { path: '/playlist', label: '我的歌单', icon: 'lucide:list-music' }
];
</script>

<style scoped lang="scss">
.sidebar {
  width: 220px;
  height: 100%;
  background-color: var(--sidebar-bg);
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
  border-right: 1px solid var(--sidebar-border);
  -webkit-app-region: drag;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 0 0 rgba(0, 0, 0, 0.05);

  &:hover {
    box-shadow: 2px 0 12px rgba(0, 0, 0, 0.08);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 48px;
    padding-left: 12px;
    -webkit-app-region: no-drag;
    transition: all 0.3s ease;
    opacity: 0;
    animation: fadeInDown 0.6s ease forwards;

    .logo-placeholder {
      width: 36px;
      height: 36px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      border-radius: 12px;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 18px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);

      &:hover {
        transform: scale(1.05);
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.4);
      }
    }

    .app-name {
      font-weight: 600;
      font-size: 20px;
      color: var(--text-primary);
      letter-spacing: -0.02em;
    }
  }

  .menu {
    display: flex;
    flex-direction: column;
    gap: 8px;
    -webkit-app-region: no-drag;

    .menu-item {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 16px;
      border-radius: 12px;
      color: var(--text-secondary);
      text-decoration: none;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      font-size: 15px;
      font-weight: 400;
      position: relative;
      overflow: hidden;
      opacity: 0;
      animation: fadeInLeft 0.5s ease forwards;

      &:nth-child(1) { animation-delay: 0.2s; }
      &:nth-child(2) { animation-delay: 0.3s; }
      &:nth-child(3) { animation-delay: 0.4s; }

      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        width: 4px;
        height: 100%;
        background: linear-gradient(180deg, #6366f1, #8b5cf6);
        transform: scaleY(0);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 0 2px 2px 0;
      }

      &:hover {
        background-color: var(--nav-item-hover);
        color: var(--text-primary);
        transform: translateX(4px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);

        &::before {
          transform: scaleY(1);
        }
      }

      &.active {
        background-color: linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1));
        background: var(--bg-primary);
        color: #6366f1;
        font-weight: 500;
        box-shadow: 0 6px 16px rgba(99, 102, 241, 0.15);
        transform: translateX(4px);

        &::before {
          transform: scaleY(1);
        }

        .iconify {
          filter: drop-shadow(0 0 4px rgba(99, 102, 241, 0.5));
        }
      }

      span {
        transition: all 0.3s ease;
      }

      &:hover span {
        transform: translateX(2px);
      }
    }
  }
}

// 动画定义
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
</style>

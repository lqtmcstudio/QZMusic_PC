<template>
  <header class="topbar" :class="{ 'no-drag': isDragDisabled }">
    <div class="left-controls">
      <div class="nav-group">
        <button class="nav-btn" @click="goBack" title="返回">
          <Icon icon="lucide:chevron-left" />
        </button>
        <button class="nav-btn" @click="goForward" title="前进">
          <Icon icon="lucide:chevron-right" />
        </button>
      </div>

      <div class="search-wrapper">
        <div class="search-container">
          <Icon icon="lucide:search" class="search-icon" />
          <input
            type="text"
            placeholder="搜索音乐、歌手、专辑..."
            class="search-input"
            v-model="searchQuery"
            @keydown.enter="handleSearch"
          />
        </div>
      </div>
    </div>

    <div class="right-controls">
      <div class="user-menu-wrap">
        <button
          class="user-chip"
          @click="handleUserClick"
          @contextmenu.prevent="openUserMenu"
          @mousedown.left="startUserPress"
          @mouseup="cancelUserPress"
          @mouseleave="cancelUserPress"
          :title="authStore.isLoggedIn ? '账号' : '登录'"
        >
          <img v-if="authStore.avatar" :src="authStore.avatar" class="user-avatar" alt="" />
          <span v-else class="user-avatar fallback">
            <Icon icon="lucide:user" />
          </span>
          <span class="user-copy">
            <strong>{{ authStore.displayName }}</strong>
            <small>{{ authStore.isLoggedIn ? '云端已连接' : '点击登录' }}</small>
          </span>
        </button>
        <div v-if="showUserMenu" class="user-menu" @click.stop>
          <button @click="openProfileEdit">
            <Icon icon="lucide:pencil" />
            <span>编辑资料</span>
          </button>
          <button class="danger" @click="logout">
            <Icon icon="lucide:log-out" />
            <span>退出账号</span>
          </button>
        </div>
      </div>

      <button class="action-btn" title="设置" @click="openSettings">
        <Icon icon="lucide:settings" />
      </button>

      <div class="divider"></div>

      <div class="window-actions">
        <button class="win-btn" @click="handleMinimize" title="最小化">
          <Icon icon="lucide:minus" />
        </button>
        <button class="win-btn" @click="handleMaximize" :title="isMaximized ? '还原' : '最大化'">
          <Icon :icon="isMaximized ? 'lucide:copy' : 'lucide:square'" />
        </button>
        <button class="win-btn close" @click="handleClose" title="关闭">
          <Icon icon="lucide:x" />
        </button>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, inject } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { useAuthStore } from '../stores/auth'
import { usePlayerStore } from '../stores/player'

const router = useRouter()
const authStore = useAuthStore()
const playerStore = usePlayerStore()
const isMaximized = ref(false)
const searchQuery = ref('')
const showUserMenu = ref(false)
const ignoreNextUserClick = ref(false)
let userPressTimer: number | undefined

// Disable drag region when overlays are active to prevent conflicts
const settingsOpen = inject<import('vue').Ref<boolean>>('isSettingsOpen', ref(false))
const isDragDisabled = computed(() => playerStore.isPlayerFullScreen || settingsOpen.value)

const goBack = () => router.back()
const goForward = () => router.forward()

const handleSearch = () => {
  if (!searchQuery.value.trim()) return
  router.push({
    name: 'Search',
    query: { q: searchQuery.value }
  })
}

const openSettings = inject<() => void>('openSettings', () => {})
const openLoginDialog = inject<() => void>('openLoginDialog', () => authStore.login(false))

const handleUserClick = () => {
  if (ignoreNextUserClick.value) {
    ignoreNextUserClick.value = false
    return
  }
  if (!authStore.isLoggedIn) {
    openLoginDialog()
    return
  }
  router.push({ name: 'UserProfile', params: { id: authStore.state.userInfo?.id } })
}

const openUserMenu = () => {
  if (!authStore.isLoggedIn) return
  showUserMenu.value = true
}

const startUserPress = () => {
  if (!authStore.isLoggedIn) return
  cancelUserPress()
  userPressTimer = window.setTimeout(() => {
    ignoreNextUserClick.value = true
    showUserMenu.value = true
  }, 480)
}

const cancelUserPress = () => {
  if (userPressTimer) {
    window.clearTimeout(userPressTimer)
    userPressTimer = undefined
  }
}

const closeUserMenu = (event?: MouseEvent) => {
  const target = event?.target as HTMLElement | null
  if (target?.closest('.user-menu-wrap')) return
  showUserMenu.value = false
}

const openProfileEdit = () => {
  showUserMenu.value = false
  if (!authStore.state.userInfo?.id) return
  router.push({ name: 'UserProfile', params: { id: authStore.state.userInfo.id }, query: { edit: '1' } })
}

const logout = async () => {
  showUserMenu.value = false
  await authStore.logout()
}

const handleMinimize = () => window.electronAPI?.minimizeWindow()

const handleMaximize = async () => {
  window.electronAPI?.maximizeWindow()
  isMaximized.value = !isMaximized.value
  checkMaximizedState()
}

const handleClose = () => window.electronAPI?.closeWindow()

const checkMaximizedState = async () => {
  if (window.electronAPI) {
    setTimeout(async () => {
      isMaximized.value = await window.electronAPI!.isMaximized()
    }, 100)
  }
}

onMounted(() => {
  checkMaximizedState()
  window.addEventListener('resize', checkMaximizedState)
  window.addEventListener('click', closeUserMenu)
})

onUnmounted(() => {
  cancelUserPress()
  window.removeEventListener('resize', checkMaximizedState)
  window.removeEventListener('click', closeUserMenu)
})
</script>

<style scoped>
.topbar {
  box-sizing: border-box;
  height: 72px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 0 24px;
  background: transparent;
  border-bottom: none;
  position: sticky;
  top: 0;
  z-index: 100;
  -webkit-app-region: drag;
  user-select: none;
  backdrop-filter: none;
}

.topbar.no-drag {
  -webkit-app-region: no-drag;
}

.left-controls,
.right-controls,
.nav-group,
.window-actions {
  display: flex;
  align-items: center;
}

.left-controls {
  gap: 16px;
  min-width: 0;
}

.right-controls {
  gap: 3px;
  height: 100%;
}

.nav-group {
  gap: 8px;
}

.nav-btn,
.action-btn,
.win-btn {
  -webkit-app-region: no-drag;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-text-secondary);
  background: transparent;
  transition: background-color 160ms ease, color 160ms ease;
}

.nav-btn,
.action-btn {
  width: 36px;
  height: 36px;
}

.nav-btn svg,
.action-btn svg {
  width: 18px;
  height: 18px;
}

.nav-btn:hover,
.action-btn:hover,
.win-btn:not(.close):hover {
  color: var(--color-text-primary);
}

.user-chip:hover {
  color: var(--color-text-primary);
}

.search-wrapper,
.user-menu-wrap,
.user-chip {
  -webkit-app-region: no-drag;
}

.user-menu-wrap {
  position: relative;
}

.search-container {
  display: flex;
  align-items: center;
  height: 40px;
  width: 286px;
  padding: 0 14px;
  background: color-mix(in srgb, var(--color-bg-secondary) 72%, transparent);
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  transition: background-color 180ms ease, border-color 180ms ease, width 180ms ease;
  cursor: text;
}

.search-container:hover,
.search-container:focus-within {
  border-color: color-mix(in srgb, var(--color-accent) 26%, transparent);
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.search-container:focus-within {
  width: 352px;
}

.search-icon {
  color: var(--color-text-muted);
  margin-right: 10px;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  height: 100%;
  font-size: 14px;
  color: var(--color-text-primary);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.user-chip {
  height: 44px;
  padding: 0 8px 0 5px;
  border-radius: var(--radius-full);
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-text-secondary);
  transition: background-color 160ms ease, color 160ms ease;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.user-avatar.fallback {
  display: grid;
  place-items: center;
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.user-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.1;
}

.user-copy strong,
.user-copy small {
  max-width: 112px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-copy strong {
  font-size: 12px;
  color: var(--color-text-primary);
}

.user-copy small {
  margin-top: 3px;
  font-size: 10px;
  color: var(--color-text-muted);
}

.user-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 150;
  width: 142px;
  padding: 6px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-bg-primary) 94%, transparent);
  box-shadow: var(--shadow-elevated);
  border: 1px solid color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.user-menu button {
  width: 100%;
  min-height: 36px;
  padding: 0 10px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.user-menu button:hover {
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
  color: var(--color-text-primary);
}

.user-menu button.danger:hover {
  color: #ff6b6b;
}

.user-menu svg {
  width: 15px;
  height: 15px;
}

.divider {
  width: 1px;
  height: 24px;
  background: linear-gradient(180deg, transparent, color-mix(in srgb, var(--color-accent) 24%, transparent), transparent);
  margin: 0 6px;
}

.window-actions {
  gap: 5px;
}

.win-btn {
  width: 32px;
  height: 32px;
}

.win-btn svg {
  width: 15px;
  height: 15px;
}

.win-btn.close:hover {
  background: #e81123;
  color: white;
}
</style>

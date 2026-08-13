<template>
  <aside class="sidebar">
    <div class="brand">
      <div class="brand-mark">
        <img :src="brandIcon" alt="QZ Music" class="brand-icon" />
      </div>
      <div class="brand-copy">
        <div class="brand-name">QZ Music</div>
        <div class="brand-subtitle">Enjoy~</div>
      </div>
    </div>

    <nav class="nav-section">
      <router-link to="/" class="nav-item" active-class="active">
        <Icon icon="lucide:home" />
        <span>主页</span>
      </router-link>
      <router-link to="/local" class="nav-item" active-class="active">
        <Icon icon="lucide:hard-drive" />
        <span>本地音乐</span>
      </router-link>
      <router-link to="/liked" class="nav-item" active-class="active">
        <Icon icon="lucide:heart" />
        <span>我喜欢的</span>
      </router-link>
      <router-link to="/favorite-playlists" class="nav-item" active-class="active">
        <Icon icon="lucide:bookmark" />
        <span>收藏歌单</span>
      </router-link>
      <router-link to="/recent" class="nav-item" active-class="active">
        <Icon icon="lucide:clock-3" />
        <span>最近播放</span>
      </router-link>
      <router-link to="/together" class="nav-item" active-class="active">
        <Icon icon="lucide:users-round" />
        <span>一起听</span>
      </router-link>
      <router-link to="/listen-stats" class="nav-item" active-class="active">
        <Icon icon="lucide:activity" />
        <span>听歌足迹</span>
      </router-link>
      <router-link to="/listen-rank" class="nav-item" active-class="active">
        <Icon icon="lucide:trophy" />
        <span>排行</span>
      </router-link>
      <router-link to="/playlist-square" class="nav-item" active-class="active">
        <Icon icon="lucide:layout-grid" />
        <span>歌单广场</span>
      </router-link>
    </nav>

    <div class="section-divider"></div>

    <section class="playlist-section">
      <div class="section-header">
        <button class="section-title" @click="isPlaylistsOpen = !isPlaylistsOpen">
          <Icon icon="lucide:chevron-down" :class="{ collapsed: !isPlaylistsOpen }" />
          <span>我的歌单</span>
        </button>
        <div class="playlist-action-wrap">
          <button class="flat-icon" title="歌单操作" @click.stop="showPlaylistActionMenu = !showPlaylistActionMenu">
            <Icon icon="lucide:plus" />
          </button>
          <div v-if="showPlaylistActionMenu" class="playlist-action-menu" @click.stop>
            <button @click="openCreateDialog">
              <Icon icon="lucide:list-plus" />
              <span>新建歌单</span>
            </button>
            <button @click="importPlaylistFile">
              <Icon icon="lucide:upload" />
              <span>导入歌单</span>
            </button>
          </div>
        </div>
      </div>

      <div v-show="isPlaylistsOpen" class="playlist-list">
        <router-link
          v-for="playlist in playlistStore.all"
          :key="`${playlist.scope}:${playlist.id}`"
          :to="{ name: 'PlaylistDetail', params: { scope: playlist.scope, id: playlist.id } }"
          class="playlist-link"
          active-class="active"
        >
          <div class="mini-cover">
            <img v-if="playlist.info.img" :src="playlist.info.img" alt="" />
            <Icon v-else :icon="playlist.scope === 'cloud' ? 'lucide:cloud' : 'lucide:list-music'" />
          </div>
          <div class="playlist-copy">
            <span class="playlist-name">{{ playlist.info.name }}</span>
            <span class="playlist-meta">{{ playlist.scope === 'cloud' ? '云端' : '本地' }} · {{ playlist.total }} 首</span>
          </div>
        </router-link>

        <button v-if="playlistStore.all.length === 0" class="empty-create" @click="openCreateDialog">
          <Icon icon="lucide:plus" />
          <span>创建第一个歌单</span>
        </button>
      </div>
    </section>

    <Teleport to="body">
      <Transition name="fade">
        <div v-if="showCreateDialog" class="dialog-backdrop" @click.self="showCreateDialog = false">
          <div class="create-dialog">
            <div class="dialog-title">新建歌单</div>
            <input v-model="draftName" class="text-input" placeholder="歌单名称" />
            <textarea v-model="draftDesc" class="text-area" placeholder="简介，可选"></textarea>
            <div class="scope-tabs">
              <button :class="{ active: draftScope === 'local' }" @click="draftScope = 'local'">
                <Icon icon="lucide:hard-drive" />
                本地
              </button>
              <button :class="{ active: draftScope === 'cloud' }" :disabled="!authStore.isLoggedIn" @click="draftScope = 'cloud'">
                <Icon icon="lucide:cloud" />
                云端
              </button>
            </div>
            <label v-if="draftScope === 'cloud'" class="public-option">
              <input type="checkbox" v-model="draftIsPublic" />
              <span>公开歌单</span>
            </label>
            <div class="dialog-actions">
              <button class="ghost-btn" @click="showCreateDialog = false">取消</button>
              <button class="primary-btn" :disabled="!draftName.trim()" @click="createPlaylist">创建</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </aside>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { usePlaylistsStore, type PlaylistScope } from '../stores/playlists'
import brandIcon from '../assets/icon.png'

const router = useRouter()
const authStore = useAuthStore()
const playlistStore = usePlaylistsStore()

const isPlaylistsOpen = ref(true)
const showCreateDialog = ref(false)
const showPlaylistActionMenu = ref(false)
const draftName = ref('')
const draftDesc = ref('')
const draftScope = ref<PlaylistScope>('local')
const draftIsPublic = ref(false)

const closePlaylistActionMenu = (event?: MouseEvent) => {
  const target = event?.target as HTMLElement | null
  if (target?.closest('.playlist-action-wrap')) return
  showPlaylistActionMenu.value = false
}

const openCreateDialog = () => {
  showPlaylistActionMenu.value = false
  draftName.value = ''
  draftDesc.value = ''
  draftScope.value = 'local'
  draftIsPublic.value = false
  showCreateDialog.value = true
}

const importPlaylistFile = async () => {
  showPlaylistActionMenu.value = false
  const result = await playlistStore.importPlaylist()
  if (result?.success && result.playlist) {
    router.push({ name: 'PlaylistDetail', params: { scope: result.playlist.scope, id: result.playlist.id } })
  }
}

const createPlaylist = async () => {
  if (draftScope.value === 'cloud' && !authStore.isLoggedIn) {
    ElMessage.warning('请先登录后再创建云端歌单')
    return
  }
  const playlist = await playlistStore.create(draftScope.value, {
    name: draftName.value,
    desc: draftDesc.value,
    is_public: draftScope.value === 'cloud' ? draftIsPublic.value : false,
  })
  showCreateDialog.value = false
  router.push({ name: 'PlaylistDetail', params: { scope: playlist.scope, id: playlist.id } })
}

onMounted(() => {
  window.addEventListener('click', closePlaylistActionMenu)
})

onUnmounted(() => {
  window.removeEventListener('click', closePlaylistActionMenu)
})
</script>

<style scoped>
.sidebar {
  box-sizing: border-box;
  width: var(--sidebar-width);
  height: 100vh;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--color-bg-secondary) 94%, transparent), color-mix(in srgb, var(--color-bg-primary) 86%, transparent));
  border-right: none;
  display: flex;
  flex-direction: column;
  padding: 24px 18px;
  overflow-y: auto;
  flex-shrink: 0;
  position: relative;
  isolation: isolate;
}

.sidebar::before {
  content: '';
  position: absolute;
  inset: 0 0 auto;
  height: 220px;
  background: var(--color-atmosphere-gradient);
  opacity: 0.95;
  pointer-events: none;
  z-index: 0;
}

.sidebar > * {
  position: relative;
  z-index: 1;
}

.brand {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 2px 10px 26px;
}

.brand-mark {
  width: 48px;
  height: 48px;
  border-radius: 18px;
  background:
    linear-gradient(145deg, color-mix(in srgb, var(--color-accent) 16%, transparent), transparent),
    var(--color-bg-primary);
  color: var(--color-accent);
  display: grid;
  place-items: center;
}

.brand-mark svg {
  width: 23px;
  height: 23px;
}

.brand-icon {
  width: 36px;
  height: 36px;
  object-fit: contain;
}

.brand-copy {
  min-width: 0;
}

.brand-name {
  font-size: 17px;
  font-weight: 760;
  color: var(--color-text-primary);
}

.brand-subtitle {
  margin-top: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.nav-section,
.playlist-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.nav-item,
.playlist-link,
.empty-create,
.section-title {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  padding: 0 11px;
  border-radius: 14px;
  color: var(--color-text-secondary);
  text-decoration: none;
  transition: background-color 160ms ease, color 160ms ease;
}

.nav-item {
  font-size: 13px;
  font-weight: 560;
}

.nav-item svg,
.section-title svg,
.flat-icon svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
}

.flat-icon:hover,
.nav-item:hover,
.playlist-link:hover,
.empty-create:hover,
.section-title:hover {
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
  color: var(--color-text-primary);
}

.nav-item.active,
.playlist-link.active {
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
  color: var(--color-accent);
}

.section-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, color-mix(in srgb, var(--color-accent) 18%, transparent), transparent);
  margin: 18px 8px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 7px;
}

.section-title {
  flex: 1;
  min-height: 32px;
  padding: 0 10px;
  font-size: 11px;
  font-weight: 760;
  color: var(--color-text-muted);
}

.section-title svg {
  transition: transform 160ms ease;
}

.section-title svg.collapsed {
  transform: rotate(-90deg);
}

.flat-icon {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  transition: background-color 160ms ease, color 160ms ease;
  flex-shrink: 0;
}

.playlist-action-wrap {
  position: relative;
  flex-shrink: 0;
}

.playlist-action-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 20;
  width: 150px;
  padding: 6px;
  border-radius: 16px;
  background: color-mix(in srgb, var(--color-bg-primary) 94%, transparent);
  box-shadow: var(--shadow-elevated);
}

.playlist-action-menu button {
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

.playlist-action-menu button:hover {
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
  color: var(--color-text-primary);
}

.playlist-action-menu svg {
  width: 15px;
  height: 15px;
  flex-shrink: 0;
}

.playlist-link {
  min-height: 48px;
  padding: 0 10px;
}

.mini-cover {
  width: 32px;
  height: 32px;
  border-radius: 11px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.mini-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-copy {
  min-width: 0;
  flex: 1;
}

.playlist-name,
.playlist-meta {
  display: block;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.playlist-name {
  font-size: 12px;
  color: var(--color-text-primary);
}

.playlist-meta {
  margin-top: 3px;
  font-size: 10px;
  color: var(--color-text-muted);
}

.empty-create {
  width: 100%;
  justify-content: center;
  color: var(--color-text-muted);
  font-size: 12px;
}

.login-btn,
.primary-btn,
.ghost-btn {
  min-height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-full);
  transition: background-color 160ms ease, color 160ms ease, border-color 160ms ease;
}

.login-btn,
.primary-btn {
  background: var(--color-accent-gradient);
  color: white;
}

.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ghost-btn {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-secondary);
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
}

.create-dialog {
  width: min(380px, calc(100vw - 32px));
  padding: 22px;
  border-radius: 24px;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-elevated);
}

.dialog-title {
  font-size: 18px;
  font-weight: 750;
  margin-bottom: 16px;
}

.text-input,
.text-area {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--color-accent) 12%, transparent);
  background: var(--color-bg-secondary);
  border-radius: 16px;
  outline: none;
  padding: 12px 14px;
  margin-bottom: 10px;
}

.text-area {
  min-height: 88px;
  resize: none;
}

.text-input:focus,
.text-area:focus {
  border-color: color-mix(in srgb, var(--color-accent) 34%, transparent);
}

.scope-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 4px 0 18px;
}

.scope-tabs button {
  min-height: 42px;
  border-radius: 14px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.scope-tabs button.active {
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.scope-tabs button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.public-option {
  min-height: 32px;
  margin: -4px 0 16px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
}

.public-option input {
  width: 15px;
  height: 15px;
  accent-color: var(--color-accent);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

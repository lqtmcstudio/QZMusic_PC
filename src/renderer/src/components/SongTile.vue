<template>
  <div class="song-tile" :class="{ 'with-action': removable || reserveAction }" @click="$emit('play')" @contextmenu.prevent="openMenu">
    <div class="song-index">{{ displayIndex }}</div>
    <div class="song-cover">
      <img v-if="song.pic" :src="song.pic" loading="lazy" alt="" />
      <Icon v-else icon="lucide:music" />
    </div>
    <div class="song-info">
      <h4 class="song-title" v-html="renderText(song.name)"></h4>
      <p class="song-artist" v-html="renderText(song.artists)"></p>
    </div>
    <div class="song-album" v-html="renderText(song.albumName || '-')"></div>
    <div class="song-duration">{{ song.interval || '--:--' }}</div>
    <div v-if="removable || reserveAction" class="song-action">
      <button v-if="removable" class="remove-btn" title="移出歌单" @click.stop="$emit('remove')">
        <Icon icon="lucide:x" />
      </button>
    </div>

    <Teleport to="body">
      <Transition name="menu-fade">
        <div
          v-if="menuOpen"
          ref="menuRef"
          class="song-menu"
          :style="{ left: `${menuPosition.x}px`, top: `${menuPosition.y}px` }"
          @click.stop
        >
          <button class="menu-row" @click="playNext">
            <Icon icon="lucide:list-start" />
            <span>下一首播放</span>
          </button>
          <button class="menu-row" @click="appendToQueue">
            <Icon icon="lucide:list-plus" />
            <span>添加到播放列表末</span>
          </button>

          <div class="menu-divider"></div>
          <div class="menu-label">添加到歌单</div>
          <button
            v-for="playlist in writablePlaylists"
            :key="`${playlist.scope}:${playlist.id}`"
            class="menu-row"
            :disabled="addingPlaylistKey === `${playlist.scope}:${playlist.id}`"
            @click="addToPlaylist(playlist.scope, playlist.id)"
          >
            <div class="playlist-menu-cover">
              <img v-if="playlist.info.img" :src="playlist.info.img" alt="" />
              <Icon v-else :icon="playlist.scope === 'cloud' ? 'lucide:cloud' : 'lucide:hard-drive'" />
              <span class="playlist-source-badge" :class="playlist.scope === 'cloud' ? 'cloud' : 'local'">
                {{ playlist.scope === 'cloud' ? '云' : '本' }}
              </span>
              <span v-if="addingPlaylistKey === `${playlist.scope}:${playlist.id}`" class="cover-loading">
                <Icon icon="lucide:loader-2" class="spin" />
              </span>
            </div>
            <span>{{ playlist.info.name }}</span>
          </button>
          <div v-if="writablePlaylists.length === 0" class="menu-empty">暂无歌单</div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, toRaw } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import type { Song } from '../types/song'
import { usePlayerStore } from '../stores/player'
import { usePlaylistsStore, type AppPlaylist, type ManagedPlaylistScope } from '../stores/playlists'

const props = defineProps<{
  song: Song
  displayIndex: number
  highlight?: (text: string) => string
  removable?: boolean
  reserveAction?: boolean
}>()

defineEmits<{
  play: []
  remove: []
}>()

const playerStore = usePlayerStore()
const playlistStore = usePlaylistsStore()
const writablePlaylists = computed(() => (
  playlistStore.all.filter((playlist) => playlist.scope !== 'plugin') as Array<AppPlaylist & { scope: ManagedPlaylistScope }>
))
const menuOpen = ref(false)
const menuRef = ref<HTMLElement | null>(null)
const menuPosition = ref({ x: 0, y: 0 })
const addingPlaylistKey = ref('')
const MENU_EVENT = 'songtile:close-all-menus'

const renderText = (text: string) => props.highlight ? props.highlight(text) : text

const toPlainSong = (song: Song): Song => {
  const raw = toRaw(song) as Song & Record<string, any>
  return {
    id: String(raw.id ?? ''),
    name: String(raw.name ?? ''),
    artists: String(raw.artists ?? ''),
    source: String(raw.source ?? ''),
    pic: String(raw.pic ?? ''),
    sPic: raw.sPic,
    mPic: raw.mPic,
    interval: String(raw.interval ?? '--/--'),
    qualities: raw.qualities && typeof raw.qualities === 'object' ? { ...raw.qualities } : undefined,
    quality: raw.quality ?? null,
    albumId: raw.albumId ?? null,
    albumName: raw.albumName ?? null,
    url: typeof raw.url === 'string' ? raw.url : undefined,
    lyric: typeof raw.lyric === 'string' ? raw.lyric : undefined,
  }
}

const closeMenu = () => {
  menuOpen.value = false
  window.removeEventListener('click', closeMenu)
  window.removeEventListener('scroll', closeMenu, true)
  window.removeEventListener('resize', closeMenu)
  window.removeEventListener(MENU_EVENT, closeMenu)
}

const onMenuCloseAll = () => {
  if (menuOpen.value) closeMenu()
}

const clampMenuPosition = async () => {
  await nextTick()
  const menu = menuRef.value
  if (!menu) return
  const rect = menu.getBoundingClientRect()
  const margin = 12
  menuPosition.value = {
    x: Math.min(menuPosition.value.x, window.innerWidth - rect.width - margin),
    y: Math.min(menuPosition.value.y, window.innerHeight - rect.height - margin),
  }
}

const openMenu = async (event: MouseEvent) => {
  window.dispatchEvent(new Event(MENU_EVENT))
  menuPosition.value = { x: event.clientX, y: event.clientY }
  menuOpen.value = true
  window.addEventListener('click', closeMenu)
  window.addEventListener('scroll', closeMenu, true)
  window.addEventListener('resize', closeMenu)
  window.addEventListener(MENU_EVENT, onMenuCloseAll)
  playlistStore.refresh().catch((error) => console.warn('[SongTile] Failed to refresh playlists:', error))
  await clampMenuPosition()
}

const playNext = async () => {
  await playerStore.playNextInQueue(toPlainSong(props.song))
  closeMenu()
}

const appendToQueue = async () => {
  await playerStore.appendToQueue(toPlainSong(props.song))
  closeMenu()
}

const addToPlaylist = async (scope: ManagedPlaylistScope, id: string) => {
  const key = `${scope}:${id}`
  if (addingPlaylistKey.value) return
  addingPlaylistKey.value = key
  try {
    await playlistStore.addSong(scope, id, toPlainSong(props.song))
    closeMenu()
  } catch (error: any) {
    console.error('[SongTile] add to playlist failed:', error)
    ElMessage.error(error?.message || '添加到歌单失败')
  } finally {
    addingPlaylistKey.value = ''
  }
}

onBeforeUnmount(closeMenu)
</script>

<style scoped>
.song-tile {
  box-sizing: border-box;
  width: 100%;
  min-height: 62px;
  display: grid;
  grid-template-columns: 50px 40px minmax(0, 4fr) minmax(100px, 3fr) 60px;
  gap: 16px;
  align-items: center;
  padding: 10px 16px;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease;
}

.song-tile.with-action {
  grid-template-columns: 50px 40px minmax(0, 4fr) minmax(100px, 3fr) 60px 42px;
}

.song-tile:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.song-index {
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
}

.song-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-info {
  min-width: 0;
}

.song-title,
.song-artist,
.song-album {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-title {
  font-size: 15px;
  color: var(--color-text-primary);
  margin: 0 0 2px;
  font-weight: 650;
}

.song-artist {
  margin: 0;
  font-size: 12px;
  color: var(--color-text-muted);
}

.song-album {
  font-size: 13px;
  color: var(--color-text-muted);
}

.song-duration {
  text-align: right;
  font-size: 13px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.song-action {
  display: flex;
  justify-content: center;
}

.remove-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  opacity: 0;
  transition: opacity 160ms ease, background-color 160ms ease, color 160ms ease;
}

.song-tile:hover .remove-btn,
.remove-btn:focus-visible {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(255, 95, 95, 0.14);
  color: #ff7070;
}

.song-menu {
  position: fixed;
  width: 232px;
  max-height: min(360px, calc(100vh - 24px));
  overflow-y: auto;
  padding: 7px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-primary) 96%, white);
  border: 1px solid color-mix(in srgb, var(--color-border) 70%, transparent);
  box-shadow: var(--shadow-elevated);
  z-index: 10000;
}

.menu-row {
  width: 100%;
  min-height: 38px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  border-radius: 12px;
  color: var(--color-text-secondary);
  text-align: left;
  transition: background-color 160ms ease, color 160ms ease;
}

.menu-row:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.menu-row:disabled {
  opacity: 0.62;
  cursor: wait;
}

.menu-row span {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.playlist-menu-cover {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  background: var(--color-bg-tertiary);
  color: var(--color-text-muted);
}

.playlist-menu-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-menu-cover > svg {
  width: 16px;
  height: 16px;
}

.playlist-source-badge {
  position: absolute;
  right: -1px;
  bottom: -1px;
  min-width: 14px;
  height: 14px;
  padding: 0 2px;
  border-radius: 6px 0 8px 0;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 9px;
  font-weight: 800;
  line-height: 1;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--color-bg-primary) 90%, transparent);
}

.playlist-source-badge.cloud {
  background: #4d8dff;
}

.playlist-source-badge.local {
  background: #21a56b;
}

.cover-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: white;
  background: rgba(0, 0, 0, 0.45);
}

.menu-divider {
  height: 1px;
  margin: 6px 6px;
  background: color-mix(in srgb, var(--color-border) 80%, transparent);
}

.menu-label,
.menu-empty {
  padding: 7px 10px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.menu-label {
  font-weight: 700;
}

.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 150ms ease, transform 150ms ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(3px);
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

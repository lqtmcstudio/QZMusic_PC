<template>
  <transition name="slide-up">
    <div class="player-shell" v-if="hasSongs">
      <div
        class="player-bar"
        :class="{ seeking: isSeekDragging }"
        :style="playerBarStyle"
        @click="handleBarClick"
        @pointerdown="handleSeekPointerDown"
        @pointermove="handleSeekPointerMove"
        @pointerup="handleSeekPointerUp"
        @pointercancel="cancelSeekDrag"
      >
        <div class="player-left">
          <div class="cover-ring" :class="{ playing: isPlaying, 'shared-cover': !isPlayerFullScreen }">
            <img v-if="currentSong?.pic" :src="currentSong.pic" class="album-art" alt="" />
            <div v-else class="album-placeholder">
              <Icon icon="lucide:music" />
            </div>
          </div>

          <div class="track-info">
            <div class="track-name">{{ currentSong?.name || '未知歌曲' }}</div>
            <div class="track-artist">{{ currentSong?.artists || '未知歌手' }}</div>
          </div>
        </div>

        <div class="player-center">
          <div class="transport-controls">
            <button class="icon-btn transport-btn" @click.stop="prev" title="上一首">
              <Icon icon="fluent:previous-20-filled" />
            </button>
            <button class="play-btn" @click.stop="togglePlay" title="播放/暂停">
              <Icon :icon="isPlaying ? 'fluent:pause-20-filled' : 'fluent:play-20-filled'" class="play-glyph" />
            </button>
            <button class="icon-btn transport-btn" @click.stop="next" title="下一首">
              <Icon icon="fluent:next-20-filled" />
            </button>
          </div>
        </div>

        <div class="player-actions">
          <button class="icon-btn" :class="{ active: isLiked }" @click.stop="toggleLike" title="喜欢">
            <Icon icon="ph:heart-fill" />
          </button>
          <button class="icon-btn" @click.stop="toggleMode" :title="modeTitle">
            <Icon :icon="modeIcon" />
          </button>

          <div class="add-menu-wrap">
            <button class="icon-btn" title="添加到歌单" @click.stop="toggleAddMenu">
              <Icon icon="ph:list-plus-bold" />
            </button>
            <Transition name="fade-pop">
              <div v-if="showAddMenu" class="add-menu" @click.stop>
                <div class="menu-title">添加到歌单</div>
                <button
                  v-for="playlistItem in playlistStore.all"
                  :key="`${playlistItem.scope}:${playlistItem.id}`"
                  class="menu-row"
                  @click="addCurrentSong(playlistItem.scope, playlistItem.id)"
                >
                  <div class="playlist-menu-cover">
                    <img v-if="playlistItem.info.img" :src="playlistItem.info.img" alt="" />
                    <Icon v-else :icon="playlistItem.scope === 'cloud' ? 'lucide:cloud' : 'lucide:hard-drive'" />
                    <span class="playlist-source-badge" :class="playlistItem.scope === 'cloud' ? 'cloud' : 'local'">
                      {{ playlistItem.scope === 'cloud' ? '云' : '本' }}
                    </span>
                  </div>
                  <span>{{ playlistItem.info.name }}</span>
                </button>
                <div v-if="playlistStore.all.length === 0" class="menu-empty">暂无歌单</div>
              </div>
            </Transition>
          </div>

          <div class="volume-control">
            <button class="icon-btn" @click.stop="toggleMute" title="音量">
              <Icon :icon="volumeIcon" />
            </button>
            <div class="volume-popover" @click.stop>
              <div class="slider-container volume-slider">
                <input
                  type="range"
                  min="0"
                  max="100"
                  :value="volume"
                  class="custom-slider vertical-slider"
                  @input="onVolumeChange"
                  @click.stop
                >
                <div class="slider-track vertical-track" :style="{ height: volume + '%' }"></div>
              </div>
            </div>
          </div>

          <div class="queue-menu-wrap">
            <button
              class="icon-btn playlist-button"
              :class="{ active: showQueuePanel }"
              title="播放列表"
              @click.stop="togglePlaylist"
            >
              <Icon icon="ph:queue-bold" />
            </button>
            <Transition name="fade-pop">
              <div v-if="showQueuePanel" class="queue-panel" @click.stop>
                <div class="queue-header">
                  <div>
                    <div class="queue-title">播放队列</div>
                    <div class="queue-subtitle">{{ playlist.length }} 首</div>
                  </div>
                  <button class="queue-close" title="关闭" @click.stop="showQueuePanel = false">
                    <Icon icon="lucide:x" />
                  </button>
                </div>

                <PlayerQueueList variant="popover" />
              </div>
            </Transition>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { storeToRefs } from 'pinia'
import { usePlayerStore, PlayMode } from '../../stores/player'
import { usePlaylistsStore, type PlaylistScope } from '../../stores/playlists'
import PlayerQueueList from './PlayerQueueList.vue'

const playerStore = usePlayerStore()
const playlistStore = usePlaylistsStore()
const {
  isPlaying,
  isPlayerFullScreen,
  currentSong,
  currentTime,
  duration,
  volume,
  playMode,
  playlist,
} = storeToRefs(playerStore)

const hasSongs = computed(() => playlist.value.length > 0)
const isLiked = ref(false)
const showAddMenu = ref(false)
const showQueuePanel = ref(false)
const albumColor = ref('var(--color-accent)')
const seekPreviewPercent = ref<number | null>(null)
const isSeekDragging = ref(false)
const suppressNextBarClick = ref(false)

const SEEK_DRAG_THRESHOLD = 22

interface SeekDragState {
  pointerId: number
  startX: number
  startY: number
  rect: DOMRect
  previewTime: number
}

let seekDragState: SeekDragState | null = null

const modeIcon = computed(() => {
  switch (playMode.value) {
    case PlayMode.Single: return 'ph:repeat-once-bold'
    case PlayMode.Random: return 'ph:shuffle-bold'
    default: return 'ph:repeat-bold'
  }
})

const modeTitle = computed(() => {
  switch (playMode.value) {
    case PlayMode.Single: return '单曲循环'
    case PlayMode.Random: return '随机播放'
    default: return '列表循环'
  }
})

const volumeIcon = computed(() => {
  if (volume.value === 0) return 'ph:speaker-x-fill'
  if (volume.value < 50) return 'ph:speaker-low-fill'
  return 'ph:speaker-high-fill'
})

const progressPercent = computed(() => {
  if (!duration.value) return 0
  return Math.min(100, Math.max(0, (currentTime.value / duration.value) * 100))
})

const displayProgressPercent = computed(() => seekPreviewPercent.value ?? progressPercent.value)

const playerBarStyle = computed(() => ({
  '--album-color': albumColor.value,
  '--progress': `${displayProgressPercent.value}%`,
}))

const togglePlay = () => playerStore.togglePlay()
const next = () => playerStore.next()
const prev = () => playerStore.prev()
const toggleMode = () => playerStore.toggleMode()
const toggleLike = () => { isLiked.value = !isLiked.value }
const togglePlaylist = () => {
  showQueuePanel.value = !showQueuePanel.value
  showAddMenu.value = false
}
const toggleAddMenu = () => {
  showAddMenu.value = !showAddMenu.value
  showQueuePanel.value = false
}

const addCurrentSong = async (scope: PlaylistScope, id: string) => {
  if (!currentSong.value) return
  await playlistStore.addSong(scope, id, currentSong.value)
  showAddMenu.value = false
}

const onVolumeChange = (e: Event) => {
  playerStore.setVolume(Number((e.target as HTMLInputElement).value))
}

const toggleMute = () => {
  playerStore.setVolume(volume.value > 0 ? 0 : 50)
}

const isInteractiveTarget = (target: HTMLElement) => {
  return Boolean(
    target.closest('button') ||
    target.closest('input') ||
    target.closest('.add-menu') ||
    target.closest('.queue-panel') ||
    target.closest('.volume-popover')
  )
}

const handleBarClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (suppressNextBarClick.value) {
    suppressNextBarClick.value = false
    return
  }
  if (isInteractiveTarget(target)) return
  playerStore.toggleFullScreen()
}

const getSeekTimeFromX = (clientX: number, rect: DOMRect) => {
  if (!duration.value || rect.width <= 0) return 0
  const percent = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  seekPreviewPercent.value = percent * 100
  return percent * duration.value
}

const handleSeekPointerDown = (event: PointerEvent) => {
  const target = event.target as HTMLElement
  if ((event.pointerType === 'mouse' && event.button !== 0) || isInteractiveTarget(target) || !duration.value) return

  const bar = event.currentTarget as HTMLElement
  seekDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    rect: bar.getBoundingClientRect(),
    previewTime: currentTime.value,
  }
  bar.setPointerCapture?.(event.pointerId)
}

const handleSeekPointerMove = (event: PointerEvent) => {
  if (!seekDragState || event.pointerId !== seekDragState.pointerId) return

  const distanceX = event.clientX - seekDragState.startX
  const distanceY = event.clientY - seekDragState.startY
  const absX = Math.abs(distanceX)
  const absY = Math.abs(distanceY)

  if (!isSeekDragging.value) {
    if (absY > SEEK_DRAG_THRESHOLD && absY > absX) {
      cancelSeekDrag(event)
      return
    }
    if (absX < SEEK_DRAG_THRESHOLD || absX < absY * 1.45) return
    isSeekDragging.value = true
    showAddMenu.value = false
    showQueuePanel.value = false
  }

  event.preventDefault()
  seekDragState.previewTime = getSeekTimeFromX(event.clientX, seekDragState.rect)
}

const handleSeekPointerUp = async (event: PointerEvent) => {
  if (!seekDragState || event.pointerId !== seekDragState.pointerId) return

  const wasDragging = isSeekDragging.value
  const seekTime = seekDragState.previewTime
  const bar = event.currentTarget as HTMLElement
  bar.releasePointerCapture?.(event.pointerId)
  seekDragState = null
  isSeekDragging.value = false

  if (wasDragging) {
    suppressNextBarClick.value = true
    window.setTimeout(() => {
      suppressNextBarClick.value = false
    }, 0)
    await playerStore.seek(seekTime)
    seekPreviewPercent.value = null
  } else {
    seekPreviewPercent.value = null
  }
}

const cancelSeekDrag = (event?: PointerEvent) => {
  if (seekDragState && event?.pointerId === seekDragState.pointerId) {
    const bar = event.currentTarget as HTMLElement | null
    bar?.releasePointerCapture?.(event.pointerId)
  }
  seekDragState = null
  isSeekDragging.value = false
  seekPreviewPercent.value = null
}

const closeFloatingPanels = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (target.closest('.add-menu-wrap') || target.closest('.queue-menu-wrap')) return
  showAddMenu.value = false
  showQueuePanel.value = false
}

const pickAlbumColor = (url?: string) => {
  if (!url) {
    albumColor.value = 'var(--color-accent)'
    return
  }

  const image = new Image()
  image.crossOrigin = 'anonymous'
  image.decoding = 'async'
  image.onload = () => {
    try {
      const canvas = document.createElement('canvas')
      const size = 24
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) return
      ctx.drawImage(image, 0, 0, size, size)
      const pixels = ctx.getImageData(0, 0, size, size).data
      let r = 0
      let g = 0
      let b = 0
      let count = 0
      for (let i = 0; i < pixels.length; i += 16) {
        const alpha = pixels[i + 3]
        if (alpha < 180) continue
        r += pixels[i]
        g += pixels[i + 1]
        b += pixels[i + 2]
        count++
      }
      if (!count) return
      r = Math.round(r / count)
      g = Math.round(g / count)
      b = Math.round(b / count)
      albumColor.value = `rgb(${r}, ${g}, ${b})`
    } catch {
      albumColor.value = 'var(--color-accent)'
    }
  }
  image.onerror = () => {
    albumColor.value = 'var(--color-accent)'
  }
  image.src = url
}

watch(() => currentSong.value?.pic, (url) => pickAlbumColor(url), { immediate: true })

onMounted(() => {
  window.addEventListener('click', closeFloatingPanels)
})

onUnmounted(() => {
  window.removeEventListener('click', closeFloatingPanels)
  cancelSeekDrag()
})
</script>

<style scoped>
.player-shell {
  box-sizing: border-box;
  position: fixed;
  left: var(--sidebar-width);
  right: 0;
  bottom: 0;
  height: 92px;
  padding: 10px 18px 14px;
  z-index: 2400;
  pointer-events: none;
}

.player-bar {
  --album-color: var(--color-accent);
  --progress: 0%;
  height: 68px;
  pointer-events: auto;
  touch-action: pan-y;
  border-radius: 24px;
  background:
    linear-gradient(90deg, color-mix(in srgb, var(--album-color) 20%, transparent) 0 var(--progress), transparent var(--progress) 100%),
    linear-gradient(135deg, color-mix(in srgb, var(--album-color) 13%, transparent), transparent 48%),
    color-mix(in srgb, var(--color-bg-secondary) 72%, transparent);
  border: 1px solid color-mix(in srgb, var(--album-color) 14%, transparent);
  backdrop-filter: blur(24px) saturate(1.12);
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: clamp(10px, 1.8vw, 22px);
  padding: 0 18px;
  position: relative;
  overflow: visible;
  transition: background 260ms ease, border-color 260ms ease;
  view-transition-name: now-playing-bar;
}

.player-bar.seeking {
  cursor: ew-resize;
}

.player-bar::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    linear-gradient(110deg, transparent 12%, color-mix(in srgb, var(--album-color) 9%, transparent) 38%, transparent 62%);
  opacity: 0.55;
  pointer-events: none;
  animation: colorDrift 9s ease-in-out infinite alternate;
}

.player-bar > * {
  position: relative;
  z-index: 1;
}

@keyframes colorDrift {
  from { transform: translateX(-5%); }
  to { transform: translateX(5%); }
}

.player-left,
.player-center,
.player-actions,
.transport-controls,
.volume-control {
  display: flex;
  align-items: center;
}

.player-left {
  min-width: 0;
  gap: 12px;
  justify-self: start;
  max-width: min(100%, 380px);
}

.cover-ring {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  overflow: hidden;
  background: color-mix(in srgb, var(--album-color) 10%, var(--color-bg-secondary));
  flex-shrink: 0;
}

.cover-ring.shared-cover {
  view-transition-name: now-playing-cover;
}

.cover-ring.playing {
  outline: 2px solid color-mix(in srgb, var(--album-color) 34%, transparent);
}

.album-art,
.album-placeholder {
  width: 100%;
  height: 100%;
}

.album-art {
  object-fit: cover;
}

.album-placeholder {
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
}

.track-info {
  min-width: 0;
}

.track-name,
.track-artist {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.track-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.track-artist {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.player-center {
  min-width: 0;
  justify-content: center;
  align-self: stretch;
}

.transport-controls {
  display: grid;
  grid-template-columns: 34px 40px 34px;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.player-actions {
  justify-content: flex-end;
  justify-self: end;
  gap: 6px;
  min-width: 0;
}

.icon-btn,
.play-btn {
  display: grid;
  place-items: center;
  border-radius: 50%;
  transition:
    color 160ms ease,
    opacity 160ms ease;
  background: transparent;
  border: 0;
  box-shadow: none;
}

.icon-btn {
  width: clamp(28px, 3vw, 34px);
  height: 40px;
  color: color-mix(in srgb, var(--color-text-secondary) 88%, var(--album-color));
  font-size: clamp(21px, 2.2vw, 25px);
}

.player-actions .icon-btn {
  width: 34px;
  height: 40px;
  padding: 0;
  font-size: 21px;
  line-height: 1;
}

.player-actions .icon-btn :deep(svg) {
  width: 21px;
  height: 21px;
  display: block;
}

.icon-btn:hover,
.icon-btn.active {
  color: var(--color-text-primary);
}

.icon-btn:active,
.play-btn:active {
  opacity: 0.68;
}

.transport-btn {
  width: 34px;
  height: 40px;
  font-size: 25px;
}

.filled {
  fill: currentColor;
}

.play-btn {
  width: 40px;
  height: 42px;
  color: var(--color-text-primary);
  font-size: 30px;
}

.play-btn:hover {
  color: color-mix(in srgb, var(--color-text-primary) 82%, var(--album-color));
}

.play-glyph {
  width: 30px;
  height: 30px;
}

.slider-container {
  position: relative;
  height: 5px;
  flex: 1;
  border-radius: 999px;
  background: color-mix(in srgb, var(--album-color) 11%, transparent);
}

.custom-slider {
  appearance: none;
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  background: transparent;
  cursor: pointer;
  z-index: 2;
}

.custom-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--album-color) 65%, white);
  opacity: 0;
}

.slider-container:hover .custom-slider::-webkit-slider-thumb {
  opacity: 1;
}

.slider-track {
  position: absolute;
  inset: 0 auto 0 0;
  height: 100%;
  background: color-mix(in srgb, var(--album-color) 62%, var(--color-accent));
  border-radius: inherit;
  pointer-events: none;
}

.volume-control {
  width: 34px;
  height: 40px;
  justify-content: center;
  position: relative;
}

.volume-control::before {
  content: "";
  position: absolute;
  left: 50%;
  bottom: 100%;
  width: 52px;
  height: 14px;
  transform: translateX(-50%);
}

.volume-popover {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 6px);
  width: 38px;
  height: 132px;
  display: grid;
  place-items: center;
  transform: translateX(-50%) translateY(5px);
  opacity: 0;
  pointer-events: none;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-primary) 95%, var(--album-color));
  border: 1px solid color-mix(in srgb, var(--album-color) 18%, transparent);
  box-shadow: var(--shadow-elevated);
  transition: opacity 160ms ease, transform 160ms ease;
  z-index: 2900;
}

.volume-control:hover .volume-popover,
.volume-control:focus-within .volume-popover {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(-50%) translateY(0);
}

.volume-slider {
  width: 5px;
  height: 104px;
  flex: none;
}

.vertical-slider {
  width: 104px;
  height: 22px;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%) rotate(-90deg);
  transform-origin: center;
}

.vertical-track {
  inset: auto 0 0 0;
  width: 100%;
  height: 0;
}

.playlist-button {
  margin-left: 0;
}

.volume-control + .queue-menu-wrap {
  margin-left: -3px;
}

.add-menu-wrap,
.queue-menu-wrap {
  position: relative;
  z-index: 4;
}

.add-menu {
  position: absolute;
  right: 0;
  bottom: 46px;
  width: 230px;
  max-height: 300px;
  overflow-y: auto;
  padding: 8px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-primary) 96%, var(--album-color));
  border: 1px solid color-mix(in srgb, var(--album-color) 22%, transparent);
  box-shadow: var(--shadow-elevated);
  z-index: 2800;
}

.menu-title {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--color-text-muted);
  font-weight: 700;
}

.menu-row {
  width: 100%;
  min-height: 38px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 10px;
  color: var(--color-text-secondary);
  transition: background-color 160ms ease, color 160ms ease;
}

.menu-row:hover {
  background: color-mix(in srgb, var(--album-color) 10%, transparent);
  color: var(--color-text-primary);
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
  background: color-mix(in srgb, var(--album-color) 9%, var(--color-bg-secondary));
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

.menu-empty {
  padding: 12px 10px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.queue-panel {
  position: absolute;
  right: 0;
  bottom: 46px;
  width: min(380px, calc(100vw - var(--sidebar-width) - 42px));
  max-height: min(430px, 58vh);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 10px;
  border-radius: 22px;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--album-color) 10%, transparent), transparent 42%),
    color-mix(in srgb, var(--color-bg-primary) 96%, var(--album-color));
  border: 1px solid color-mix(in srgb, var(--album-color) 22%, transparent);
  box-shadow: var(--shadow-elevated);
  z-index: 2850;
}

.queue-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 8px 10px;
}

.queue-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--color-text-primary);
}

.queue-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.queue-close {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-text-muted);
  transition: background-color 160ms ease, color 160ms ease;
}

.queue-close:hover {
  background: color-mix(in srgb, var(--album-color) 12%, transparent);
  color: var(--color-text-primary);
}

.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 220ms ease, opacity 220ms ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.fade-pop-enter-active,
.fade-pop-leave-active {
  transition: opacity 160ms ease, transform 160ms ease;
}

.fade-pop-enter-from,
.fade-pop-leave-to {
  opacity: 0;
  transform: translateY(4px) scale(0.98);
}

@media (max-width: 1080px) {
  .player-bar {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 8px;
  }
}

@media (max-width: 760px) {
  .player-bar {
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    gap: 10px;
    padding: 0 12px;
  }

  .player-actions {
    gap: 2px;
  }

  .track-artist {
    display: none;
  }
}
</style>

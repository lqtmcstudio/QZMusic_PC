<template>
  <div class="queue-list" :class="variant">
    <div
      v-for="(song, index) in playlist"
      :key="`${song.id}:${index}`"
      class="queue-row"
      :class="{ active: index === currentIndex, dragging: index === draggingIndex }"
      :data-queue-index="index"
      role="button"
      tabindex="0"
      @click="playQueueItem(index)"
      @keydown.enter="playQueueItem(index)"
      @keydown.space.prevent="playQueueItem(index)"
      @pointerdown="startPress($event, index)"
    >
      <div class="queue-index">
        <span v-if="index === currentIndex" class="playing-indicator">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </span>
        <span v-else>{{ index + 1 }}</span>
      </div>
      <img v-if="song.pic" :src="song.pic" class="queue-cover" alt="" />
      <div v-else class="queue-cover queue-cover-placeholder">
        <Icon icon="lucide:music" />
      </div>
      <div class="queue-info">
        <div class="queue-name">{{ song.name }}</div>
        <div class="queue-artist">{{ song.artists }}</div>
      </div>
      <div class="queue-duration">{{ song.interval || '--:--' }}</div>
      <button class="queue-remove" title="移出播放列表" @click.stop="removeQueueItem(index)">
        <Icon icon="lucide:x" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { Icon } from '@iconify/vue'
import { usePlayerStore } from '../../stores/player'

withDefaults(defineProps<{
  variant?: 'popover' | 'fullscreen'
}>(), {
  variant: 'popover',
})

const playerStore = usePlayerStore()
const { playlist, currentIndex } = storeToRefs(playerStore)
const draggingIndex = ref<number | null>(null)
const suppressClick = ref(false)
let pressTimer: number | undefined

const clearPressTimer = () => {
  if (pressTimer !== undefined) {
    window.clearTimeout(pressTimer)
    pressTimer = undefined
  }
}

const startPress = (event: PointerEvent, index: number) => {
  const target = event.target as HTMLElement
  if (target.closest('.queue-remove')) return

  clearPressTimer()
  pressTimer = window.setTimeout(() => {
    draggingIndex.value = index
    suppressClick.value = true
    document.body.classList.add('queue-dragging')
    window.addEventListener('pointermove', handleDragMove)
    window.addEventListener('pointerup', stopDrag, { once: true })
    window.addEventListener('pointercancel', stopDrag, { once: true })
  }, 260)

  window.addEventListener('pointerup', clearPressTimer, { once: true })
  window.addEventListener('pointercancel', clearPressTimer, { once: true })
}

const handleDragMove = (event: PointerEvent) => {
  if (draggingIndex.value === null) return
  const element = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null
  const row = element?.closest<HTMLElement>('[data-queue-index]')
  if (!row) return

  const nextIndex = Number(row.dataset.queueIndex)
  if (!Number.isInteger(nextIndex) || nextIndex === draggingIndex.value) return
  playerStore.moveQueueItem(draggingIndex.value, nextIndex)
  draggingIndex.value = nextIndex
}

const stopDrag = async () => {
  clearPressTimer()
  window.removeEventListener('pointermove', handleDragMove)
  document.body.classList.remove('queue-dragging')
  draggingIndex.value = null
  await nextTick()
  window.setTimeout(() => {
    suppressClick.value = false
  }, 0)
}

const playQueueItem = (index: number) => {
  if (suppressClick.value) return
  playerStore.playQueueIndex(index)
}

const removeQueueItem = (index: number) => {
  playerStore.removeFromQueue(index)
}

onBeforeUnmount(() => {
  clearPressTimer()
  window.removeEventListener('pointermove', handleDragMove)
  document.body.classList.remove('queue-dragging')
})
</script>

<style scoped>
.queue-list {
  min-height: 0;
  overflow-y: auto;
  padding: 2px;
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--album-color, var(--color-accent)) 24%, transparent) transparent;
}

.queue-list::-webkit-scrollbar {
  width: 6px;
}

.queue-list::-webkit-scrollbar-track {
  background: transparent;
}

.queue-list::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--album-color, var(--color-accent)) 24%, transparent);
  border-radius: 999px;
}

.queue-row {
  width: 100%;
  min-height: 56px;
  display: grid;
  grid-template-columns: 28px 42px minmax(0, 1fr) auto 30px;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border-radius: 14px;
  color: var(--color-text-secondary);
  text-align: left;
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.queue-row:hover,
.queue-row.active {
  background: color-mix(in srgb, var(--album-color, var(--color-accent)) 11%, transparent);
  color: var(--color-text-primary);
}

.queue-row.dragging {
  opacity: 0.58;
  cursor: grabbing;
}

.queue-index {
  width: 28px;
  display: grid;
  place-items: center;
  font-size: 12px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.queue-cover {
  width: 42px;
  height: 42px;
  border-radius: 12px;
  object-fit: cover;
  background: color-mix(in srgb, var(--album-color, var(--color-accent)) 11%, var(--color-bg-secondary));
  overflow: hidden;
}

.queue-cover-placeholder {
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
}

.queue-info {
  min-width: 0;
}

.queue-name,
.queue-artist {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.queue-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.queue-artist {
  margin-top: 4px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.queue-duration {
  font-size: 12px;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
}

.queue-remove {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: var(--color-text-muted);
  opacity: 0;
  cursor: pointer;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.queue-row:hover .queue-remove,
.queue-row.active .queue-remove {
  opacity: 1;
}

.queue-remove:hover {
  background: color-mix(in srgb, var(--album-color, var(--color-accent)) 12%, transparent);
  color: var(--color-text-primary);
}

.playing-indicator {
  height: 14px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
}

.playing-indicator .bar {
  width: 3px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--album-color, var(--color-accent)) 70%, var(--color-accent));
  animation: queueBars 0.82s ease-in-out infinite;
}

.playing-indicator .bar:nth-child(1) {
  height: 8px;
  animation-delay: 0s;
}

.playing-indicator .bar:nth-child(2) {
  height: 14px;
  animation-delay: 0.14s;
}

.playing-indicator .bar:nth-child(3) {
  height: 10px;
  animation-delay: 0.28s;
}

.fullscreen {
  --color-text-primary: rgba(255, 255, 255, 0.95);
  --color-text-secondary: rgba(255, 255, 255, 0.72);
  --color-text-muted: rgba(255, 255, 255, 0.45);
  --color-bg-secondary: rgba(255, 255, 255, 0.08);
}

@keyframes queueBars {
  0%, 100% { transform: scaleY(0.55); }
  50% { transform: scaleY(1); }
}

@media (prefers-reduced-motion: reduce) {
  .playing-indicator .bar {
    animation: none;
  }
}

:global(.queue-dragging) {
  user-select: none;
  cursor: grabbing;
}
</style>

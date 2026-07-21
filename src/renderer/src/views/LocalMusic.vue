<template>
  <div class="local-view">
    <section class="local-hero">
      <div>
        <div class="eyebrow">
          <Icon icon="lucide:hard-drive" />
          <span>LOCAL MUSIC</span>
        </div>
        <h1>本地音乐</h1>
        <p>扫描电脑里的音频文件，按艺术家、专辑和修改时间整理播放。</p>
      </div>
      <div class="hero-actions">
        <button class="soft-btn" :disabled="scanning" @click="pickFolders">
          <Icon icon="lucide:folder-plus" />
          添加文件夹
        </button>
        <button class="primary-btn" :disabled="scanning || roots.length === 0" @click="scanRoots()">
          <Icon :icon="scanning ? 'lucide:loader-2' : 'lucide:scan-line'" :class="{ spin: scanning }" />
          {{ scanning ? '扫描中' : '重新扫描' }}
        </button>
      </div>
    </section>

    <section class="stats-row">
      <div class="stat-item">
        <span>{{ songs.length }}</span>
        <small>歌曲</small>
      </div>
      <div class="stat-item">
        <span>{{ artistCount }}</span>
        <small>艺术家</small>
      </div>
      <div class="stat-item">
        <span>{{ albumCount }}</span>
        <small>专辑</small>
      </div>
      <div class="stat-item wide" :title="roots.join('\n')">
        <span>{{ roots.length || 0 }}</span>
        <small>{{ roots.length ? roots[0] : '未选择目录' }}</small>
      </div>
    </section>

    <section class="root-list" v-if="roots.length > 0">
      <div class="root-title">扫描目录</div>
      <button
        v-for="root in roots"
        :key="root"
        class="root-chip"
        :title="root"
        :disabled="scanning"
        @click="removeRoot(root)"
      >
        <span>{{ root }}</span>
        <Icon icon="lucide:x" />
      </button>
    </section>

    <section class="toolbar">
      <div class="search-box">
        <Icon icon="lucide:search" />
        <input v-model="query" placeholder="搜索歌曲、艺术家、专辑" />
      </div>

      <div class="segmented">
        <button :class="{ active: groupBy === 'all' }" @click="groupBy = 'all'">全部</button>
        <button :class="{ active: groupBy === 'artist' }" @click="groupBy = 'artist'">艺术家</button>
        <button :class="{ active: groupBy === 'album' }" @click="groupBy = 'album'">专辑</button>
      </div>

      <select v-model="sortMode" class="sort-select">
        <option value="az">A-Z 正序</option>
        <option value="za">Z-A 倒序</option>
        <option value="modified-desc">修改日期 新到旧</option>
        <option value="modified-asc">修改日期 旧到新</option>
      </select>
    </section>

    <section v-if="scanning" class="state-panel">
      <Icon icon="lucide:loader-2" class="spin" />
      <span>正在读取音频标签...</span>
    </section>

    <section v-else-if="songs.length === 0" class="state-panel">
      <Icon icon="lucide:music-2" />
      <span>还没有本地歌曲</span>
      <button class="primary-btn compact" @click="pickFolders">扫描文件夹</button>
    </section>

    <section v-else class="local-content">
      <template v-if="groupBy === 'all'">
        <div class="list-header">
          <span>#</span>
          <span></span>
          <span>标题</span>
          <span>专辑</span>
          <span>时长</span>
          <span></span>
        </div>
        <TransitionGroup name="list-shift" tag="div" class="song-list">
          <SongTile
            v-for="(song, index) in pagedSongs"
            :key="song.id"
            :song="song"
            :display-index="pageStart + index + 1"
            removable
            reserve-action
            @play="playSong(pageStart + index)"
            @remove="removeSong(song.id)"
          />
        </TransitionGroup>
      </template>

      <template v-else>
        <TransitionGroup name="list-shift" tag="div" class="group-transition-list">
        <div v-for="group in pagedGroups" :key="group.name" class="group-block">
          <button class="group-header" @click="toggleGroup(group.name)">
            <div>
              <strong>{{ group.name }}</strong>
              <span>{{ group.songs.length }} 首</span>
            </div>
            <Icon :icon="collapsedGroups.has(group.name) ? 'lucide:chevron-right' : 'lucide:chevron-down'" />
          </button>
          <div v-if="!collapsedGroups.has(group.name)" class="group-list">
            <SongTile
              v-for="song in group.songs"
              :key="song.id"
              :song="song"
              :display-index="songGlobalIndex(song)"
              removable
              reserve-action
              @play="playSong(songGlobalIndex(song) - 1)"
              @remove="removeSong(song.id)"
            />
          </div>
        </div>
        </TransitionGroup>
      </template>

      <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" :disabled="currentPage <= 1" @click="currentPage--">
          <Icon icon="lucide:chevron-left" />
        </button>
        <button
          v-for="page in visiblePages"
          :key="page"
          class="page-btn"
          :class="{ active: page === currentPage }"
          @click="currentPage = page"
        >
          {{ page }}
        </button>
        <button class="page-btn" :disabled="currentPage >= totalPages" @click="currentPage++">
          <Icon icon="lucide:chevron-right" />
        </button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import SongTile from '../components/SongTile.vue'
import { usePlayerStore } from '../stores/player'
import type { Song } from '../types/song'

interface LocalSong extends Song {
  path: string
  albumName: string
  durationSeconds: number
  quality: string
  bitrate: number
  sampleRate: number
  channels: number
  size: number
  modifiedAt: number
  addedAt: number
}

type GroupMode = 'all' | 'artist' | 'album'
type SortMode = 'az' | 'za' | 'modified-desc' | 'modified-asc'

const playerStore = usePlayerStore()
const songs = ref<LocalSong[]>([])
const roots = ref<string[]>([])
const scanning = ref(false)
const query = ref('')
const groupBy = ref<GroupMode>('all')
const sortMode = ref<SortMode>('az')
const currentPage = ref(1)
const pageSize = 40
const collapsedGroups = ref(new Set<string>())

const toPlainRoots = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item)).filter(Boolean)
}

const pinyinCollator = new Intl.Collator('zh-Hans-CN-u-co-pinyin', {
  numeric: true,
  sensitivity: 'base',
})

const compareByPinyin = (left = '', right = '') => pinyinCollator.compare(left, right)

const loadLibrary = async () => {
  const library = await window.electronAPI.localMusic.getLibrary()
  roots.value = library.roots || []
  songs.value = (library.songs || []) as LocalSong[]
}

const pickFolders = async () => {
  const selected = await window.electronAPI.selectDirectories()
  if (selected.length === 0) return
  const library = await window.electronAPI.localMusic.setRoots(Array.from(new Set([...toPlainRoots(roots.value), ...toPlainRoots(selected)])))
  roots.value = library.roots || []
  ElMessage.success('已添加到扫描目录')
}

const removeRoot = async (root: string) => {
  const library = await window.electronAPI.localMusic.setRoots(toPlainRoots(roots.value).filter((item) => item !== root))
  roots.value = library.roots || []
  songs.value = (library.songs || []) as LocalSong[]
  ElMessage.success('已从扫描目录移除')
}

const scanRoots = async (nextRoots: unknown = roots.value) => {
  scanning.value = true
  try {
    const library = await window.electronAPI.localMusic.scan(toPlainRoots(nextRoots))
    roots.value = library.roots || []
    songs.value = (library.songs || []) as LocalSong[]
    currentPage.value = 1
    ElMessage.success(`扫描完成：${songs.value.length} 首歌曲`)
  } catch (error: any) {
    console.error('[LocalMusic] scan failed:', error)
    ElMessage.error(error?.message || '扫描失败')
  } finally {
    scanning.value = false
  }
}

const normalizedQuery = computed(() => query.value.trim().toLowerCase())
const filteredSongs = computed(() => {
  const q = normalizedQuery.value
  const list = q
    ? songs.value.filter((song) => (
        song.name.toLowerCase().includes(q) ||
        song.artists.toLowerCase().includes(q) ||
        (song.albumName || '').toLowerCase().includes(q)
      ))
    : songs.value.slice()

  return list.sort((a, b) => {
    if (sortMode.value === 'modified-desc') return b.modifiedAt - a.modifiedAt
    if (sortMode.value === 'modified-asc') return a.modifiedAt - b.modifiedAt
    const result = compareByPinyin(a.name, b.name)
    return sortMode.value === 'za' ? -result : result
  })
})

const artistCount = computed(() => new Set(songs.value.map((song) => song.artists)).size)
const albumCount = computed(() => new Set(songs.value.map((song) => song.albumName)).size)
const totalItems = computed(() => groupBy.value === 'all' ? filteredSongs.value.length : groupedSongs.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / pageSize)))
const pageStart = computed(() => (currentPage.value - 1) * pageSize)
const pagedSongs = computed(() => filteredSongs.value.slice(pageStart.value, pageStart.value + pageSize))

const groupedSongs = computed(() => {
  const map = new Map<string, LocalSong[]>()
  for (const song of filteredSongs.value) {
    const key = groupBy.value === 'artist' ? song.artists : song.albumName
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(song)
  }
  return Array.from(map.entries())
    .map(([name, groupSongs]) => ({ name, songs: groupSongs }))
    .sort((a, b) => {
      const result = compareByPinyin(a.name, b.name)
      return sortMode.value === 'za' ? -result : result
    })
})

const pagedGroups = computed(() => groupedSongs.value.slice(pageStart.value, pageStart.value + pageSize))
const visiblePages = computed(() => {
  const delta = 2
  const start = Math.max(1, Math.min(currentPage.value - delta, totalPages.value - delta * 2))
  const end = Math.min(totalPages.value, Math.max(currentPage.value + delta, 1 + delta * 2))
  const pages: number[] = []
  for (let page = start; page <= end; page++) pages.push(page)
  return pages
})

const playSong = (globalIndex: number) => {
  const song = filteredSongs.value[globalIndex]
  if (song) playerStore.playFromList(song, filteredSongs.value)
}

const removeSong = async (id: string) => {
  const library = await window.electronAPI.localMusic.remove(id)
  songs.value = (library.songs || []) as LocalSong[]
  ElMessage.success('已从本地列表移除')
}

const toggleGroup = (name: string) => {
  const next = new Set(collapsedGroups.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  collapsedGroups.value = next
}

const songGlobalIndex = (song: LocalSong) => filteredSongs.value.findIndex((item) => item.id === song.id) + 1

watch([query, groupBy, sortMode], () => {
  currentPage.value = 1
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

onMounted(loadLibrary)
</script>

<style scoped>
.local-view {
  min-height: 100%;
  padding: 28px 32px 148px;
  box-sizing: border-box;
  color: var(--color-text-primary);
}

.local-hero {
  min-height: 190px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  padding: 30px;
  border-radius: 30px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background:
    linear-gradient(135deg, color-mix(in srgb, var(--color-accent) 13%, transparent), transparent 52%),
    color-mix(in srgb, var(--color-bg-secondary) 76%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.local-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    radial-gradient(90% 90% at 0% 0%, color-mix(in srgb, var(--color-accent) 14%, transparent), transparent 58%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent);
  opacity: 0.8;
}

.eyebrow,
.hero-actions,
.toolbar,
.search-box,
.stats-row,
.pagination,
.group-header {
  display: flex;
  align-items: center;
}

.eyebrow {
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 760;
}

h1 {
  margin-top: 14px;
  font-size: 40px;
  line-height: 1.1;
}

p {
  margin-top: 10px;
  color: var(--color-text-secondary);
}

.hero-actions {
  gap: 10px;
  flex-wrap: wrap;
}

.primary-btn,
.soft-btn {
  min-height: 40px;
  padding: 0 16px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-weight: 700;
}

.primary-btn {
  background: var(--color-accent-gradient);
  color: white;
}

.primary-btn.compact {
  min-height: 36px;
}

.soft-btn {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-primary);
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 0.18fr)) minmax(240px, 1fr);
  gap: 12px;
  margin-top: 18px;
}

.root-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.root-title {
  color: var(--color-text-muted);
  font-size: 13px;
  font-weight: 700;
  margin-right: 2px;
}

.root-chip {
  max-width: min(360px, 100%);
  height: 34px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px 0 12px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg-secondary) 86%, transparent);
  color: var(--color-text-secondary);
}

.root-chip:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-accent) 9%, transparent);
}

.root-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-item {
  min-width: 0;
  min-height: 76px;
  padding: 14px 16px;
  border-radius: 20px;
  background: color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
}

.stat-item span {
  display: block;
  font-size: 24px;
  font-weight: 820;
}

.stat-item small {
  display: block;
  margin-top: 4px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.toolbar {
  gap: 12px;
  margin-top: 22px;
  flex-wrap: wrap;
}

.search-box {
  flex: 1;
  min-width: 240px;
  height: 42px;
  gap: 10px;
  padding: 0 14px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg-secondary) 86%, transparent);
  color: var(--color-text-muted);
}

.search-box input {
  flex: 1;
  min-width: 0;
  outline: none;
}

.segmented {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg-secondary) 86%, transparent);
}

.segmented button {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  color: var(--color-text-secondary);
}

.segmented button.active {
  background: var(--color-bg-primary);
  color: var(--color-accent);
}

.sort-select {
  height: 42px;
  padding: 0 14px;
  border: 0;
  outline: none;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg-secondary) 86%, transparent);
  color: var(--color-text-primary);
}

.state-panel {
  min-height: 300px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--color-text-muted);
}

.state-panel svg {
  width: 38px;
  height: 38px;
}

.local-content {
  margin-top: 18px;
}

.song-list,
.group-transition-list {
  position: relative;
}

.list-shift-move,
.list-shift-enter-active,
.list-shift-leave-active {
  transition:
    opacity 180ms cubic-bezier(0.2, 0, 0, 1),
    transform 180ms cubic-bezier(0.2, 0, 0, 1);
}

.list-shift-enter-from,
.list-shift-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

.list-shift-leave-active {
  position: absolute;
  width: 100%;
}

.list-header {
  height: 36px;
  display: grid;
  grid-template-columns: 50px 40px minmax(0, 4fr) minmax(100px, 3fr) 60px 42px;
  align-items: center;
  gap: 16px;
  color: var(--color-text-muted);
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);
}

.group-block {
  margin-bottom: 10px;
}

.group-header {
  width: 100%;
  min-height: 54px;
  justify-content: space-between;
  padding: 0 14px;
  border-radius: 18px;
  color: var(--color-text-primary);
}

.group-header:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.group-header strong,
.group-header span {
  display: block;
  text-align: left;
}

.group-header span {
  margin-top: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.group-list {
  padding-left: 12px;
}

.pagination {
  gap: 8px;
  margin-top: 24px;
}

.page-btn {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: 12px;
  color: var(--color-text-secondary);
}

.page-btn:hover:not(:disabled),
.page-btn.active {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-accent);
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 920px) {
  .local-hero {
    display: block;
  }

  .hero-actions {
    margin-top: 22px;
  }

  .stats-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (prefers-reduced-motion: reduce) {
  .list-shift-move,
  .list-shift-enter-active,
  .list-shift-leave-active {
    transition: none;
  }
}
</style>

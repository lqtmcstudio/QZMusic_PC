<template>
  <div class="playlist-square-view">
    <div class="content-wrapper">
      <section class="toolbar">
        <div>
          <h1>歌单广场</h1>
          <p>浏览其他用户公开的歌单</p>
        </div>
        <div class="toolbar-controls">
          <label class="search-box">
            <Icon icon="lucide:search" />
            <input v-model="query" placeholder="搜索歌单、简介或作者" />
          </label>
          <div class="sort-tabs">
            <button :class="{ active: sort === 'visit' }" @click="setSort('visit')">
              <Icon icon="lucide:trending-up" />
              访问量
            </button>
            <button :class="{ active: sort === 'like' }" @click="setSort('like')">
              <Icon icon="lucide:heart" />
              喜欢
            </button>
            <button :class="{ active: sort === 'total' }" @click="setSort('total')">
              <Icon icon="lucide:list-music" />
              歌曲数
            </button>
            <button :class="{ active: sort === 'name' }" @click="setSort('name')">
              <Icon icon="lucide:arrow-down-a-z" />
              名称
            </button>
          </div>
        </div>
      </section>

      <section class="result-section">
        <div class="section-meta">
          <span>{{ loading ? '加载中' : `${total} 个公开歌单` }}</span>
          <span>按{{ sortLabel }}排序 · 第 {{ page }} / {{ totalPages }} 页</span>
        </div>

        <div v-if="loading" class="playlist-grid">
          <div v-for="i in pageSize" :key="i" class="playlist-card skeleton"></div>
        </div>

        <div v-else-if="playlists.length === 0" class="empty-state">
          <Icon icon="lucide:library" />
          <span>暂无匹配的公开歌单</span>
        </div>

        <div v-else class="playlist-grid">
          <button
            v-for="playlist in playlists"
            :key="playlist.id"
            class="playlist-card"
            @click="openPlaylist(playlist.id)"
          >
            <div class="cover">
              <img v-if="playlist.info.img" :src="playlist.info.img" alt="" />
              <Icon v-else icon="lucide:cloud" />
            </div>
            <div class="playlist-name">{{ playlist.info.name || '云歌单' }}</div>
            <div class="playlist-desc">{{ playlist.info.desc || '没有简介' }}</div>
            <div class="playlist-meta">
              <span>
                <Icon icon="lucide:eye" />
                {{ Number(playlist.info.visit_count || playlist.info.play_count || 0) || 0 }}
              </span>
              <span>
                <Icon icon="lucide:heart" />
                {{ Number(playlist.info.like_count || 0) || 0 }}
              </span>
              <span>
                <Icon icon="lucide:music" />
                {{ playlist.total || 0 }}
              </span>
            </div>
          </button>
        </div>

        <div v-if="!loading && totalPages > 1" class="pagination">
          <button class="page-btn" :disabled="page <= 1" @click="changePage(page - 1)">
            <Icon icon="lucide:chevron-left" />
            上一页
          </button>
          <span>{{ page }} / {{ totalPages }}</span>
          <button class="page-btn" :disabled="page >= totalPages" @click="changePage(page + 1)">
            下一页
            <Icon icon="lucide:chevron-right" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { usePlaylistsStore, type AppPlaylist } from '../stores/playlists'

const router = useRouter()
const playlistStore = usePlaylistsStore()
const query = ref('')
const sort = ref<'visit' | 'like' | 'total' | 'name'>('visit')
const playlists = ref<AppPlaylist[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = 12
const loading = ref(false)
let timer: number | null = null
let requestId = 0

const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))

const sortLabel = computed(() => {
  if (sort.value === 'total') return '歌曲数'
  if (sort.value === 'name') return '名称'
  if (sort.value === 'like') return '喜欢数'
  return '访问量'
})

const loadPlaylists = async () => {
  const currentRequest = ++requestId
  loading.value = true
  try {
    const result = await playlistStore.publicList(query.value, sort.value, page.value, pageSize)
    if (currentRequest !== requestId) return
    playlists.value = result.items || []
    total.value = result.total || playlists.value.length
    if (page.value > totalPages.value) page.value = totalPages.value
  } catch (err: any) {
    if (currentRequest !== requestId) return
    playlists.value = []
    total.value = 0
    ElMessage.error(err?.message || '歌单广场加载失败')
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

const scheduleLoad = (delay = 600) => {
  if (timer != null) window.clearTimeout(timer)
  timer = window.setTimeout(loadPlaylists, delay)
}

watch(query, () => {
  page.value = 1
  scheduleLoad(600)
}, { immediate: true })

watch(page, () => scheduleLoad(120))

const setSort = (nextSort: 'visit' | 'like' | 'total' | 'name') => {
  if (sort.value === nextSort) return
  sort.value = nextSort
  page.value = 1
  scheduleLoad(120)
}

const changePage = (nextPage: number) => {
  page.value = Math.max(1, Math.min(totalPages.value, nextPage))
}

onBeforeUnmount(() => {
  if (timer != null) window.clearTimeout(timer)
})

const openPlaylist = (id: string) => {
  router.push({ name: 'PlaylistDetail', params: { scope: 'cloud', id } })
}
</script>

<style scoped>
.playlist-square-view {
  min-height: 100%;
  background: transparent;
}

.content-wrapper {
  box-sizing: border-box;
  max-width: 1180px;
  margin: 0 auto;
  padding: 30px 32px 132px;
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(360px, 520px);
  align-items: end;
  gap: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid var(--color-border);
}

h1 {
  font-size: 34px;
  color: var(--color-text-primary);
}

p,
.section-meta,
.playlist-desc,
.playlist-meta {
  color: var(--color-text-muted);
}

.toolbar p {
  margin-top: 8px;
}

.toolbar-controls {
  display: grid;
  gap: 12px;
}

.search-box {
  min-height: 44px;
  padding: 0 14px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
}

.search-box input {
  min-width: 0;
  flex: 1;
  border: 0;
  outline: none;
  background: transparent;
  color: var(--color-text-primary);
  font-size: 14px;
}

.sort-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.sort-tabs button,
.page-btn {
  min-height: 36px;
  padding: 0 13px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.sort-tabs button.active {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
}

.sort-tabs svg,
.playlist-meta svg,
.page-btn svg {
  width: 15px;
  height: 15px;
}

.result-section {
  margin-top: 24px;
}

.section-meta,
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}

.section-meta {
  margin-bottom: 16px;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
  gap: 18px;
}

.playlist-card {
  min-width: 0;
  padding: 0;
  text-align: left;
  border-radius: 18px;
  transition: transform 160ms ease;
}

.playlist-card:hover {
  transform: translateY(-1px);
}

.cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 18px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-accent) 10%, var(--color-bg-secondary));
  color: var(--color-accent);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover svg {
  width: 42px;
  height: 42px;
}

.playlist-name {
  margin-top: 10px;
  font-size: 14px;
  font-weight: 760;
  color: var(--color-text-primary);
}

.playlist-desc,
.playlist-name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.playlist-desc {
  margin-top: 4px;
  font-size: 12px;
}

.playlist-meta {
  margin-top: 8px;
  display: flex;
  gap: 12px;
  font-size: 12px;
}

.playlist-meta span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.pagination {
  max-width: 360px;
  margin: 24px auto 0;
  padding: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
}

.page-btn:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}

.empty-state {
  min-height: 260px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: var(--color-text-muted);
}

.empty-state svg {
  width: 46px;
  height: 46px;
  color: var(--color-accent);
}

.skeleton {
  height: 234px;
  background: linear-gradient(90deg, var(--color-bg-secondary), var(--color-bg-tertiary), var(--color-bg-secondary));
  background-size: 220% 100%;
  animation: shimmer 1.2s ease infinite;
}

@keyframes shimmer {
  to { background-position: -220% 0; }
}

@media (max-width: 900px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}
</style>

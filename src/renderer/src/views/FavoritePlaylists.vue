<template>
  <div class="favorite-playlists-view">
    <div class="content-wrapper">
      <section class="page-header">
        <div>
          <div class="eyebrow">COLLECTIONS</div>
          <h1>收藏歌单</h1>
          <p>插件与云端歌单会同步到你的账号。</p>
        </div>
        <button class="refresh-btn" :disabled="loading || !authStore.isLoggedIn" @click="loadFavorites">
          <Icon :icon="loading ? 'lucide:loader-2' : 'lucide:refresh-cw'" :class="{ spin: loading }" />
          刷新
        </button>
      </section>

      <div v-if="!authStore.isLoggedIn" class="empty-state">
        <Icon icon="lucide:log-in" />
        <span>登录后可同步收藏歌单</span>
      </div>
      <div v-else-if="loading" class="playlist-grid">
        <div v-for="index in 8" :key="index" class="playlist-card skeleton"></div>
      </div>
      <div v-else-if="favorites.length === 0" class="empty-state">
        <Icon icon="lucide:bookmark" />
        <span>还没有收藏歌单</span>
      </div>
      <div v-else class="playlist-grid">
        <article v-for="item in favorites" :key="`${item.source}:${item.id}`" class="playlist-card">
          <button class="card-main" @click="openPlaylist(item)">
            <div class="cover">
              <img v-if="item.playlist?.info.img" :src="item.playlist.info.img" alt="" />
              <Icon v-else :icon="item.source ? 'lucide:radio' : 'lucide:cloud'" />
            </div>
            <div class="card-copy">
              <h2>{{ item.playlist?.info.name || '不可用的收藏歌单' }}</h2>
              <p>{{ item.playlist?.info.desc || (item.source ? `插件 ${item.source} 暂不可用` : '云端歌单暂不可用') }}</p>
              <span>{{ item.source ? `插件 · ${item.source}` : '云端歌单' }}</span>
            </div>
          </button>
          <button class="remove-btn" title="取消收藏" @click="removeFavorite(item)">
            <Icon icon="lucide:bookmark-minus" />
          </button>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import type { AppPlaylist } from '../stores/playlists'

interface FavoritePlaylistItem {
  id: string
  source: string
  playlist: AppPlaylist | null
}

const router = useRouter()
const authStore = useAuthStore()
const loading = ref(false)
const favorites = ref<FavoritePlaylistItem[]>([])

const resolveFavorite = async (ref: { id: string; source: string }): Promise<FavoritePlaylistItem> => {
  try {
    const playlist = ref.source
      ? await window.electronAPI.plugin.getPlaylist(ref.source, ref.id, 1, 1)
      : await window.electronAPI.playlist.get('cloud', ref.id, false)
    return { ...ref, playlist }
  } catch {
    return { ...ref, playlist: null }
  }
}

const loadFavorites = async () => {
  if (!authStore.isLoggedIn) {
    favorites.value = []
    return
  }
  loading.value = true
  try {
    const refs = await window.electronAPI.playlist.getFavorites()
    favorites.value = await Promise.all(refs.map(resolveFavorite))
  } catch (err: any) {
    favorites.value = []
    ElMessage.error(err?.message || '收藏歌单加载失败')
  } finally {
    loading.value = false
  }
}

const openPlaylist = (item: FavoritePlaylistItem) => {
  if (item.source) {
    router.push({
      name: 'PluginCollection',
      params: { pluginId: item.source, kind: 'playlist', id: item.id },
    })
  } else {
    router.push({ name: 'PlaylistDetail', params: { scope: 'cloud', id: item.id } })
  }
}

const removeFavorite = async (item: FavoritePlaylistItem) => {
  try {
    const result = await window.electronAPI.playlist.uncollect(item.id, item.source)
    if (result.status !== 'success') throw new Error(result.message || '取消收藏失败')
    favorites.value = favorites.value.filter((current) =>
      current.id !== item.id || current.source !== item.source
    )
    ElMessage.success('已取消收藏')
  } catch (err: any) {
    ElMessage.error(err?.message || '取消收藏失败')
  }
}

watch(() => authStore.state.userInfo?.id, loadFavorites, { immediate: true })
</script>

<style scoped>
.favorite-playlists-view {
  min-height: 100%;
}

.content-wrapper {
  box-sizing: border-box;
  max-width: 1180px;
  margin: 0 auto;
  padding: 34px 32px 48px;
}

.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 28px;
}

.eyebrow {
  color: var(--color-accent);
  font-size: 11px;
  font-weight: 760;
  letter-spacing: 0.16em;
}

h1 {
  margin: 6px 0 8px;
  font-size: 30px;
}

.page-header p,
.card-copy p {
  margin: 0;
  color: var(--color-text-muted);
}

.refresh-btn {
  min-height: 38px;
  padding: 0 15px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: var(--color-accent-soft);
  color: var(--color-accent);
}

.refresh-btn:disabled {
  opacity: 0.45;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
}

.playlist-card {
  min-height: 118px;
  display: flex;
  align-items: stretch;
  border-radius: 22px;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-bg-secondary) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--color-accent) 9%, transparent);
}

.card-main {
  min-width: 0;
  flex: 1;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-align: left;
}

.cover {
  width: 82px;
  height: 82px;
  flex-shrink: 0;
  border-radius: 17px;
  overflow: hidden;
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover svg {
  width: 26px;
  height: 26px;
}

.card-copy {
  min-width: 0;
}

.card-copy h2,
.card-copy p,
.card-copy span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.card-copy h2 {
  margin: 0 0 8px;
  font-size: 15px;
}

.card-copy p {
  font-size: 12px;
}

.card-copy span {
  display: block;
  margin-top: 9px;
  color: var(--color-text-secondary);
  font-size: 11px;
}

.remove-btn {
  width: 42px;
  color: var(--color-text-muted);
}

.remove-btn:hover {
  color: var(--color-danger, #ef4444);
  background: color-mix(in srgb, #ef4444 8%, transparent);
}

.empty-state {
  min-height: 260px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--color-text-muted);
}

.empty-state svg {
  width: 34px;
  height: 34px;
}

.skeleton {
  animation: pulse 1.2s ease-in-out infinite alternate;
}

.spin {
  animation: spin 0.9s linear infinite;
}

@keyframes pulse {
  from { opacity: 0.45; }
  to { opacity: 0.85; }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

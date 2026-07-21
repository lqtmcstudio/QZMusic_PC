<template>
  <div class="home-view">
    <div class="content-wrapper">
      <section class="home-hero">
        <div class="hero-copy">
          <div class="eyebrow">{{ greeting }}</div>
          <h1>{{ authStore.isLoggedIn ? authStore.displayName : '准备好开始听歌了吗' }}</h1>
          <p>{{ authStore.isLoggedIn ? '云端功能已完整接入，准备好开始听歌了吗^_^' : '登录后可以同步云端歌单，也可以继续使用本地歌单。' }}</p>
          <div class="hero-actions">
            <button class="primary-btn" @click="continuePlaying" :disabled="!playerStore.currentSong">
              <Icon icon="lucide:play" />
              继续播放
            </button>
            <button v-if="!authStore.isLoggedIn" class="soft-btn" @click="openLoginDialog">
              <Icon icon="lucide:log-in" />
              登录账号
            </button>
          </div>
        </div>
        <div class="now-card">
          <img v-if="playerStore.currentSong?.pic" :src="playerStore.currentSong.pic" alt="" />
          <div v-else class="now-placeholder">
            <Icon icon="lucide:music-2" />
          </div>
          <div class="now-copy">
            <span>正在播放</span>
            <strong>{{ playerStore.currentSong?.name || '暂无歌曲' }}</strong>
            <small>{{ playerStore.currentSong?.artists || '从搜索或歌单里选一首' }}</small>
          </div>
        </div>
      </section>

      <section class="quick-grid">
        <button class="quick-tile" @click="router.push('/local')">
          <Icon icon="lucide:hard-drive" />
          <span>本地音乐</span>
          <small>扫描和播放本地文件</small>
        </button>
        <button class="quick-tile" @click="router.push('/liked')">
          <Icon icon="lucide:heart" />
          <span>我喜欢的</span>
          <small>收藏夹和常听歌曲</small>
        </button>
        <button class="quick-tile" @click="createLocalPlaylist">
          <Icon icon="lucide:list-plus" />
          <span>新建本地歌单</span>
          <small>保存在当前电脑</small>
        </button>
        <button class="quick-tile" :disabled="!authStore.isLoggedIn" @click="createCloudPlaylist">
          <Icon icon="lucide:cloud-plus" />
          <span>新建云端歌单</span>
          <small>{{ authStore.isLoggedIn ? '同步到账号' : '登录后可用' }}</small>
        </button>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>今日推荐歌曲</h2>
            <p>音乐是灵魂的私语，在寂静处与心灵对话</p>
          </div>
          <button class="soft-btn compact" @click="playAllRecommended">
            <Icon icon="lucide:play" />
            播放全部
          </button>
        </div>

        <div class="song-recommend-grid">
          <button
            v-for="(song, index) in recommendedSongs"
            :key="`${song.source}:${song.id}`"
            class="song-card"
            @click="playRecommendedSong(index)"
          >
            <span class="thumb-wrap small">
              <img :src="song.pic" alt="" />
            </span>
            <div class="song-card-copy">
              <span>{{ song.name }}</span>
              <small>{{ song.artists }}</small>
            </div>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>推荐歌单</h2>
            <p>让旋律随时启程，收入你的私藏角落，陪你每一个想听的时刻。</p>
          </div>
        </div>

        <div v-if="pluginPlaylistsLoading" class="playlist-grid">
          <div v-for="id in recommendedPlaylistIds" :key="id" class="playlist-card skeleton"></div>
        </div>

        <div v-else class="playlist-grid">
          <button
            v-for="playlist in recommendedPluginPlaylists"
            :key="`${playlist.source}:${playlist.id}`"
            class="playlist-card"
            :class="{ 'is-error': playlist.loadError }"
            :title="playlist.loadError || playlist.info.name"
            @click="playlist.loadError ? copyCollectionError(playlist.loadError) : openPluginCollection('playlist', playlist.id, playlist.source)"
          >
            <div class="playlist-cover thumb-wrap">
              <img v-if="playlist.info.img" :src="playlist.info.img" alt="" />
              <Icon v-else icon="lucide:radio" />
              <span class="play-float"><Icon icon="lucide:play" /></span>
            </div>
            <div class="playlist-name">{{ playlist.info.name }}</div>
            <div class="playlist-meta">网易云 · {{ playlist.total }} 首</div>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>推荐专辑</h2>
            <p>Pin</p>
          </div>
        </div>

        <div v-if="pluginAlbumsLoading" class="playlist-grid">
          <div v-for="id in recommendedAlbumIds" :key="id" class="playlist-card skeleton"></div>
        </div>

        <div v-else class="playlist-grid">
          <button
            v-for="album in recommendedPluginAlbums"
            :key="`${album.source}:${album.id}`"
            class="playlist-card"
            :class="{ 'is-error': album.loadError }"
            :title="album.loadError || album.info.name"
            @click="album.loadError ? copyCollectionError(album.loadError) : openPluginCollection('album', album.id, album.source)"
          >
            <div class="playlist-cover thumb-wrap">
              <img v-if="album.info.img" :src="album.info.img" alt="" />
              <Icon v-else icon="lucide:disc-3" />
              <span class="play-float"><Icon icon="lucide:play" /></span>
            </div>
            <div class="playlist-name">{{ album.info.name }}</div>
            <div class="playlist-meta">网易云 · {{ album.total }} 首</div>
          </button>
        </div>
      </section>

      <section class="section">
        <div class="section-header">
          <div>
            <h2>最近的歌单</h2>
            <p>本地和云端歌单会一起显示，点击即可继续整理。</p>
          </div>
        </div>

        <div v-if="playlistStore.loading" class="playlist-grid">
          <div v-for="i in 4" :key="i" class="playlist-card skeleton"></div>
        </div>

        <div v-else-if="recentPlaylists.length > 0" class="playlist-grid">
          <button
            v-for="playlist in recentPlaylists"
            :key="`${playlist.scope}:${playlist.id}`"
            class="playlist-card"
            @click="openPlaylist(playlist.scope, playlist.id)"
          >
            <div class="playlist-cover thumb-wrap">
              <img v-if="playlist.info.img" :src="playlist.info.img" alt="" />
              <Icon v-else :icon="playlist.scope === 'cloud' ? 'lucide:cloud' : 'lucide:list-music'" />
              <span class="play-float"><Icon icon="lucide:play" /></span>
            </div>
            <div class="playlist-name">{{ playlist.info.name }}</div>
            <div class="playlist-meta">{{ playlist.scope === 'cloud' ? '云端' : '本地' }} · {{ playlist.total }} 首</div>
          </button>
        </div>

        <div v-else class="empty-state">
          <Icon icon="lucide:list-music" />
          <span>还没有歌单，先创建一个吧。</span>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '../stores/auth'
import { usePlaylistsStore, type AppPlaylist, type PlaylistScope } from '../stores/playlists'
import { usePlayerStore } from '../stores/player'
import { formatDuration } from '../utils/songUtils'
import type { Song } from '../types/song'

type RecommendedCollection = AppPlaylist & { loadError?: string }

const router = useRouter()
const authStore = useAuthStore()
const playlistStore = usePlaylistsStore()
const playerStore = usePlayerStore()
const openLoginDialog = inject<() => void>('openLoginDialog', () => authStore.login(false))
const recommendedPlaylistIds = ['9348791294']
const recommendedAlbumIds = ['98418475', '360880312']
const pluginPlaylistsLoading = ref(false)
const pluginAlbumsLoading = ref(false)
const recommendedPluginPlaylists = ref<RecommendedCollection[]>([])
const recommendedPluginAlbums = ref<RecommendedCollection[]>([])

const recommendedSongs: Song[] = [
  {
    id: '1979009861',
    name: '光与影的对白',
    artists: '洛天依Official',
    pic: 'http://p1.music.126.net/G02hs1vJYJir359bx8wGhg==/109951167851086939.jpg?param=512y512',
    url: '',
    interval: formatDuration(248257),
    source: 'wy',
    albumId: '151073585',
    albumName: '依如初见',
    quality: 'auto',
    qualities: { jymaster: '165.47MB', hires: '53.85MB', lossless: '31.28MB', exhigh: '9.47MB', standard: '5.68MB', jyeffect: '92.07MB', sky: '28.79MB' },
  },
  {
    id: '2750754678',
    name: '蝴蝶',
    artists: '洛天依、桃小薇',
    pic: 'http://p2.music.126.net/385Py82eEhF5D7_8C9QUpA==/109951172078581753.jpg?param=512y512',
    url: '',
    interval: formatDuration(219669),
    source: 'wy',
    albumId: '286640710',
    albumName: '蝴蝶',
    quality: 'auto',
    qualities: { jymaster: '119.54MB', lossless: '21.14MB', exhigh: '8.38MB', standard: '5.03MB', jyeffect: '71.72MB', sky: '22.18MB' },
  },
  {
    id: '2604527599',
    name: '蝴蝶',
    artists: '洛天依Official',
    pic: 'http://p2.music.126.net/EjxfEQw8OjhssWUpJlDTBQ==/109951169745955001.jpg?param=512y512',
    url: '',
    interval: formatDuration(216104),
    source: 'wy',
    albumId: '241083511',
    albumName: '再生',
    quality: 'auto',
    qualities: { jymaster: '121.05MB', hires: '43.11MB', lossless: '23.47MB', exhigh: '8.25MB', standard: '4.95MB', jyeffect: '73.86MB', sky: '22.66MB' },
  },
  {
    id: '1854231422',
    name: 'モア！ジャンプ！モア！ (feat. 花里みのり&桐谷遥&桃井愛莉&日野森雫&初音ミク)',
    artists: 'ナユタン星人、MORE MORE JUMP！、初音ミク',
    pic: 'http://p1.music.126.net/PIZdmUbEUFLbfQy6rDm4sA==/109951166097068861.jpg?param=512y512',
    url: '',
    interval: formatDuration(182183),
    source: 'wy',
    albumId: '129194941',
    albumName: 'アイドル新鋭隊/モア！ジャンプ！モア！',
    quality: 'auto',
    qualities: { jymaster: '116.17MB', lossless: '37.57MB', exhigh: '6.95MB', standard: '4.17MB', jyeffect: '67.87MB', sky: '21.92MB' },
  },
  {
    id: '28815250',
    name: '平凡之路',
    artists: '朴树',
    pic: 'http://p1.music.126.net/W_5XiCv3rGS1-J7EXpHSCQ==/18885211718782327.jpg?param=512y512',
    url: '',
    interval: formatDuration(302119),
    source: 'wy',
    albumId: '35444067',
    albumName: '猎户星座',
    quality: 'auto',
    qualities: { jymaster: '182.38MB', lossless: '31.83MB', exhigh: '11.53MB', standard: '6.92MB', jyeffect: '106.63MB', sky: '31.58MB' },
  },
]

const greeting = computed(() => {
  const hour = new Date().getHours()
  if (hour < 11) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
})

const recentPlaylists = computed(() => playlistStore.all.slice(0, 8))

const continuePlaying = () => {
  if (playerStore.currentSong) playerStore.toggleFullScreen()
}

const openPlaylist = (scope: PlaylistScope, id: string) => {
  router.push({ name: 'PlaylistDetail', params: { scope, id } })
}

const openPluginCollection = (kind: 'playlist' | 'album', id: string, pluginId = 'wy') => {
  router.push({ name: 'PluginCollection', params: { pluginId, kind, id } })
}

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

const copyCollectionError = async (message?: string) => {
  if (!message) return
  await navigator.clipboard.writeText(message)
  ElMessage.success('错误原因已复制')
}

const playRecommendedSong = (index: number) => {
  const song = recommendedSongs[index]
  if (song) playerStore.playFromList(song, recommendedSongs)
}

const playAllRecommended = () => {
  playerStore.setPlaylist(recommendedSongs, 0)
}

const loadRecommendedPlaylists = async () => {
  pluginPlaylistsLoading.value = true
  try {
    const loaded = await Promise.all(recommendedPlaylistIds.map(async (id) => {
      try {
        return await window.electronAPI.plugin.getPlaylist('wy', id, 1, 8)
      } catch (error) {
        const loadError = getErrorMessage(error)
        console.warn(`[Home] Failed to load recommended playlist ${id}:`, error)
        return {
          id,
          scope: 'plugin',
          source: 'wy',
          kind: 'playlist',
          info: {
            id,
            name: `网易歌单 ${id}`,
            desc: '',
            img: '',
            author: '',
            play_count: '',
          },
          list: [],
          total: 0,
          loadError,
        } as RecommendedCollection
      }
    }))
    recommendedPluginPlaylists.value = loaded
  } finally {
    pluginPlaylistsLoading.value = false
  }
}

const loadRecommendedAlbums = async () => {
  pluginAlbumsLoading.value = true
  try {
    const loaded = await Promise.all(recommendedAlbumIds.map(async (id) => {
      try {
        return await window.electronAPI.plugin.getAlbum('wy', id, 1, 8)
      } catch (error) {
        const loadError = getErrorMessage(error)
        console.warn(`[Home] Failed to load recommended album ${id}:`, error)
        return {
          id,
          scope: 'plugin',
          source: 'wy',
          kind: 'album',
          info: {
            id,
            name: `网易专辑 ${id}`,
            desc: '',
            img: '',
            author: '',
            play_count: '',
          },
          list: [],
          total: 0,
          loadError,
        } as RecommendedCollection
      }
    }))
    recommendedPluginAlbums.value = loaded
  } finally {
    pluginAlbumsLoading.value = false
  }
}

const createLocalPlaylist = async () => {
  const playlist = await playlistStore.create('local', { name: '新建歌单' })
  openPlaylist(playlist.scope, playlist.id)
}

const createCloudPlaylist = async () => {
  const playlist = await playlistStore.create('cloud', { name: '新建云端歌单' })
  openPlaylist(playlist.scope, playlist.id)
}

onMounted(() => {
  loadRecommendedPlaylists()
  loadRecommendedAlbums()
})
</script>

<style scoped>
.home-view {
  min-height: 100%;
  background: transparent;
}

.content-wrapper {
  box-sizing: border-box;
  max-width: 1180px;
  margin: 0 auto;
  padding: 24px 32px 132px;
}

.home-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 28px;
  align-items: stretch;
  padding: 20px 0 34px;
  border-bottom: 1px solid var(--color-border);
}

.hero-copy {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
}

.eyebrow {
  font-size: 13px;
  font-weight: 750;
  color: var(--color-accent);
}

h1 {
  margin-top: 10px;
  font-size: 42px;
  line-height: 1.1;
  color: var(--color-text-primary);
}

p {
  margin-top: 12px;
  color: var(--color-text-secondary);
  max-width: 620px;
}

.hero-actions {
  display: flex;
  gap: 10px;
  margin-top: 24px;
}

.primary-btn,
.soft-btn {
  min-height: 42px;
  padding: 0 18px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.soft-btn.compact {
  min-height: 36px;
  padding: 0 14px;
  font-size: 13px;
}

.primary-btn {
  background: var(--color-accent-gradient);
  color: white;
}

.primary-btn:disabled,
.quick-tile:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.soft-btn {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.soft-btn:hover,
.quick-tile:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-primary);
}

.now-card {
  min-height: 220px;
  border-radius: 28px;
  background: var(--color-bg-secondary);
  padding: 16px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.now-card img,
.now-placeholder {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 22px;
}

.now-card img {
  object-fit: cover;
}

.now-placeholder {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
  color: var(--color-text-muted);
}

.now-placeholder svg {
  width: 48px;
  height: 48px;
}

.now-copy {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.now-copy span,
.now-copy small,
.playlist-meta,
.quick-tile small,
.section-header p {
  color: var(--color-text-muted);
}

.now-copy strong,
.playlist-name,
.quick-tile span {
  color: var(--color-text-primary);
}

.quick-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin: 24px 0 34px;
}

.quick-tile {
  min-height: 112px;
  border-radius: 22px;
  padding: 18px;
  background: var(--color-bg-secondary);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  text-align: left;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.quick-tile svg {
  width: 22px;
  height: 22px;
  color: var(--color-accent);
}

.quick-tile span {
  font-weight: 700;
}

.section {
  padding-top: 2px;
  margin-top: 34px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 18px;
}

.section-header h2 {
  font-size: 22px;
}

.section-header p {
  margin-top: 6px;
  font-size: 13px;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 16px;
}

.song-recommend-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 14px;
}

.song-card {
  min-width: 0;
  min-height: 74px;
  padding: 0;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  background: transparent;
  transition: transform 160ms ease;
}

.song-card:hover {
  transform: translateY(-1px);
}

.thumb-wrap {
  position: relative;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
  isolation: isolate;
}

.thumb-wrap::after {
  content: "";
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0);
  transition: background-color 160ms ease;
  z-index: 1;
}

.thumb-wrap.small {
  width: 54px;
  height: 54px;
  border-radius: 14px;
  flex-shrink: 0;
}

.thumb-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 180ms ease;
}

.play-float {
  position: absolute;
  z-index: 2;
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: transparent;
  border: 1.5px solid rgba(255, 255, 255, 0.92);
  color: white;
  opacity: 0;
  transform: scale(0.9);
  transition: opacity 160ms ease, transform 160ms ease;
  pointer-events: none;
}

.play-float svg {
  width: 18px;
  height: 18px;
  transform: translateX(1px);
}

.playlist-card:hover .thumb-wrap::after {
  background: rgba(0, 0, 0, 0.36);
}

.song-card:hover .thumb-wrap img,
.playlist-card:hover .thumb-wrap img {
  transform: scale(1.03);
}

.song-card:hover .play-float,
.playlist-card:hover .play-float {
  opacity: 1;
  transform: scale(1);
}

.song-card-copy {
  min-width: 0;
}

.song-card-copy span,
.song-card-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-card-copy span {
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 700;
}

.song-card-copy small {
  margin-top: 4px;
  color: var(--color-text-muted);
  font-size: 12px;
}

.playlist-card {
  padding: 0;
  text-align: left;
  border-radius: 18px;
  transition: transform 160ms ease;
}

.playlist-card:hover {
  transform: translateY(-1px);
}

.playlist-card.is-error {
  min-height: 206px;
  display: grid;
  place-items: center;
  padding: 18px;
  background: color-mix(in srgb, var(--color-accent) 6%, var(--color-bg-secondary));
  color: var(--color-text-muted);
  cursor: copy;
}

.playlist-card.is-error::before {
  content: "加载失败";
  color: var(--color-text-primary);
  font-weight: 760;
}

.playlist-card.is-error::after {
  content: "悬停查看原因，点击复制";
  margin-top: 6px;
  font-size: 12px;
}

.playlist-card.is-error > * {
  display: none;
}

.playlist-cover {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 18px;
}

.playlist-cover > svg {
  width: 36px;
  height: 36px;
}

.playlist-name {
  margin-top: 10px;
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.playlist-meta {
  margin-top: 3px;
  font-size: 12px;
}

.skeleton {
  height: 190px;
  background: linear-gradient(90deg, var(--color-bg-secondary), var(--color-bg-tertiary), var(--color-bg-secondary));
  background-size: 220% 100%;
  animation: shimmer 1.2s ease infinite;
}

.empty-state {
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--color-text-muted);
}

@keyframes shimmer {
  to { background-position: -220% 0; }
}

@media (max-width: 980px) {
  .home-hero {
    grid-template-columns: 1fr;
  }

  .now-card {
    max-width: 360px;
  }

  .quick-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

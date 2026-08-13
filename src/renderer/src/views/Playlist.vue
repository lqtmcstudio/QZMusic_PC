<template>
  <div class="playlist-view">
    <div class="content-wrapper">
      <section class="playlist-hero">
        <div class="cover" :class="{ editable: isEditablePlaylist }" @click="isEditablePlaylist && openCoverDialog()">
          <img v-if="playlist?.info.img" :src="playlist.info.img" alt="" />
          <Icon v-else :icon="heroIcon" />
          <button v-if="isEditablePlaylist" class="cover-edit" title="设置封面" @click.stop="openCoverDialog">
            <Icon icon="lucide:image-up" />
          </button>
        </div>
        <div class="hero-copy">
          <div class="eyebrow">{{ scopeLabel }}</div>
          <h1>{{ title }}</h1>
          <div class="description-wrap">
            <p class="description-text" :class="{ expanded: descriptionExpanded }">{{ description }}</p>
            <button
              v-if="canExpandDescription"
              class="description-toggle"
              @click="descriptionExpanded = !descriptionExpanded"
            >
              {{ descriptionExpanded ? '收起' : '展开' }}
            </button>
          </div>
          <div class="hero-meta">
            <span>{{ songCount }} 首歌曲</span>
            <router-link
              v-if="showAuthorLink && playlist?.owner"
              class="author-link"
              :to="{ name: 'UserProfile', params: { id: playlist.owner.id } }"
            >
              {{ playlist.owner.nickname || playlist.owner.username }}
            </router-link>
            <span v-else-if="playlist?.info.author">{{ playlist.info.author }}</span>
            <span v-if="isCloudPlaylist">访问 {{ accessCount }} 次</span>
            <span v-if="isCloudPlaylist && collectionCount >= 0">
              <Icon icon="lucide:bookmark" style="width:13px;height:13px;vertical-align:-1px" />
              {{ collectionCount }}
            </span>
          </div>
          <div class="hero-actions">
            <button class="primary-btn" :disabled="songs.length === 0" @click="playAll">
              <Icon icon="lucide:play" />
              播放全部
            </button>
            <button v-if="isEditablePlaylist" class="soft-btn" @click="openEditDialog">
              <Icon icon="lucide:pencil" />
              编辑
            </button>
            <button v-if="isManagedPlaylist" class="soft-btn" @click="exportPlaylistFile">
              <Icon icon="lucide:download" />
              导出
            </button>
            <button v-if="isCloudPlaylist" class="soft-btn" @click="saveAsLocal">
              <Icon icon="lucide:hard-drive-download" />
              另存本地
            </button>
            <button v-if="isCloudPlaylist && isEditablePlaylist" class="soft-btn" @click="openCoverDialog">
              <Icon icon="lucide:image-up" />
              封面
            </button>
            <button v-else-if="isEditablePlaylist" class="soft-btn" @click="convertPlaylistMode">
              <Icon :icon="targetScope === 'cloud' ? 'lucide:cloud-upload' : 'lucide:hard-drive-download'" />
              {{ targetScope === 'cloud' ? '转为云端' : '转为本地' }}
            </button>
            <button v-if="isEditablePlaylist" class="icon-btn danger" title="删除歌单" @click="deletePlaylist">
              <Icon icon="lucide:trash-2" />
            </button>
            <button
              v-if="showCollectButton"
              class="icon-btn collect-btn"
              :class="{ collected: isCollectedByUser }"
              :title="isCollectedByUser ? '取消收藏' : '收藏'"
              :disabled="collectingPlaylist"
              @click="toggleCollectPlaylist"
            >
              <Icon icon="lucide:bookmark" />
            </button>
          </div>
        </div>
      </section>

      <section class="songs-section">
        <div class="list-header">
          <span class="col-index">#</span>
          <span></span>
          <span class="col-title">标题</span>
          <span class="col-album">专辑</span>
          <span class="col-time">时长</span>
          <span class="col-action"></span>
        </div>

        <div v-if="loading" class="empty-state">
          <Icon icon="lucide:loader-2" class="spin" />
          <span>正在加载歌单...</span>
        </div>

        <div
          v-else-if="errorMessage"
          class="error-state"
          :title="errorMessage"
          @click="copyErrorMessage"
        >
          <Icon icon="lucide:cloud-alert" />
          <span>加载时有点问题</span>
          <small>悬停查看原因，点击复制错误详情</small>
        </div>

        <div v-else-if="songs.length === 0" class="empty-state">
          <Icon icon="lucide:list-plus" />
          <span>{{ isManagedPlaylist ? '这个歌单还没有歌曲' : '暂无歌曲' }}</span>
        </div>

        <div v-else class="song-list">
          <SongTile
            v-for="(song, index) in songs"
            :key="`${song.source}:${song.id}:${index}`"
            :song="song"
            :display-index="displayStartIndex + index + 1"
            :removable="isEditablePlaylist"
            reserve-action
            @play="playSong(index)"
            @remove="removeSong(index)"
          />
          <div
            v-if="pageMode === 'infinite' && canLoadMore"
            ref="loadMoreTrigger"
            class="load-more-sentinel"
          >
            <Icon v-if="loadingMore" icon="lucide:loader-2" class="spin" />
            <span>{{ loadingMore ? '继续加载中...' : '下滑加载更多' }}</span>
          </div>

          <div v-if="pageMode === 'pagination' && totalPages > 1" class="pagination">
            <button class="page-btn" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">
              <Icon icon="lucide:chevron-left" />
            </button>
            <button
              v-for="page in visiblePages"
              :key="page"
              class="page-btn"
              :class="{ active: page === currentPage }"
              @click="changePage(page)"
            >
              {{ page }}
            </button>
            <button class="page-btn" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">
              <Icon icon="lucide:chevron-right" />
            </button>
          </div>
        </div>
      </section>

      <Transition name="fade">
        <div v-if="showEditDialog" class="dialog-backdrop" @click.self="showEditDialog = false">
          <div class="edit-dialog">
            <div class="dialog-title">编辑歌单</div>
            <input v-model="draftName" class="text-input" placeholder="歌单名称" />
            <textarea v-model="draftDesc" class="text-area" placeholder="简介，可选"></textarea>
            <label v-if="routeScope === 'cloud'" class="public-option">
              <input type="checkbox" v-model="draftIsPublic" />
              <span>公开歌单</span>
            </label>
            <div class="dialog-actions">
              <button class="ghost-btn" @click="showEditDialog = false">取消</button>
              <button class="primary-btn compact" :disabled="!draftName.trim()" @click="saveEdit">保存</button>
            </div>
          </div>
        </div>
      </Transition>

      <Transition name="fade">
        <div v-if="showCoverDialog" class="dialog-backdrop" @click.self="showCoverDialog = false">
          <div class="edit-dialog cover-dialog">
            <div class="dialog-title">设置歌单封面</div>
            <div class="cover-preview">
              <img v-if="playlist?.info.img" :src="playlist.info.img" alt="" />
              <Icon v-else icon="lucide:image" />
            </div>
            <p class="cover-mode-text">
              {{ playlist?.info.cover_mode === 'custom' ? '当前为自定义封面' : '当前跟随最新添加的歌曲' }}
            </p>
            <div class="dialog-actions">
              <button class="ghost-btn" @click="showCoverDialog = false">取消</button>
              <button
                v-if="playlist?.info.cover_mode === 'custom'"
                class="soft-btn"
                :disabled="coverUploading"
                @click="followSongCover"
              >
                <Icon icon="lucide:refresh-cw" />
                跟随歌曲
              </button>
              <button class="primary-btn compact" :disabled="coverUploading" @click="uploadCoverImage">
                <Icon :icon="coverUploading ? 'lucide:loader-2' : 'lucide:image-up'" :class="{ spin: coverUploading }" />
                {{ coverUploading ? '上传中' : '选择图片' }}
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePlayerStore } from '../stores/player'
import { useAuthStore } from '../stores/auth'
import { usePlaylistsStore, type AppPlaylist, type ManagedPlaylistScope, type PlaylistScope } from '../stores/playlists'
import SongTile from '../components/SongTile.vue'
import type { Song } from '../types/song'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const authStore = useAuthStore()
const playlistStore = usePlaylistsStore()

const playlist = ref<AppPlaylist | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const errorMessage = ref('')
const showEditDialog = ref(false)
const showCoverDialog = ref(false)
const coverUploading = ref(false)
const draftName = ref('')
const draftDesc = ref('')
const draftIsPublic = ref(false)
const descriptionExpanded = ref(false)
const pageMode = ref<'infinite' | 'pagination'>('infinite')
const currentPage = ref(1)
const loadedPage = ref(1)
const loadMoreTrigger = ref<HTMLElement | null>(null)
const pageSize = 50
let loadMoreObserver: IntersectionObserver | null = null

// Playlist collection state
const isCollectedByUser = ref(false)
const collectionCount = ref(-1)
const collectingPlaylist = ref(false)

type PublicSong = Partial<Song> & {
  // 兼容云端 API 可能返回的旧字段名
  artist?: string
  picUrl?: string
  duration?: string
  types?: Record<string, string>
}

const routeScope = computed(() => route.params.scope as PlaylistScope | undefined)
const routeId = computed(() => route.params.id as string | undefined)
const routePluginId = computed(() => route.params.pluginId as string | undefined)
const routeKind = computed(() => route.params.kind as 'playlist' | 'album' | undefined)
const isPluginCollection = computed(() => route.name === 'PluginCollection' && Boolean(routePluginId.value && routeKind.value && routeId.value))
const isLiked = computed(() => route.name === 'Liked' || route.name === 'UserLikedPlaylist')
const isRecent = computed(() => route.path.includes('recent'))
const isManagedPlaylist = computed(() => Boolean(
  routeScope.value &&
  routeScope.value !== 'plugin' &&
  routeId.value &&
  playlist.value
))
const isCloudPlaylist = computed(() => isManagedPlaylist.value && routeScope.value === 'cloud')
const isPagedPluginCollection = computed(() => Boolean(isPluginCollection.value && playlist.value))
const isOwnPlaylist = computed(() => {
  if (!authStore.state.userInfo?.id || !playlist.value?.owner) return false
  return authStore.state.userInfo.id === playlist.value.owner.id
})
const isEditablePlaylist = computed(() =>
  routeScope.value === 'local' || (isCloudPlaylist.value && isOwnPlaylist.value)
)
const showAuthorLink = computed(() =>
  isCloudPlaylist.value &&
  !isOwnPlaylist.value &&
  playlist.value?.info.is_public &&
  playlist.value?.owner
)
const collectionSource = computed(() => isCloudPlaylist.value ? '' : String(routePluginId.value || ''))
const showCollectButton = computed(() => authStore.isLoggedIn && Boolean(
  (isCloudPlaylist.value && routeId.value) ||
  (isPluginCollection.value && routeKind.value === 'playlist' && routePluginId.value && routeId.value)
))
const targetScope = computed<ManagedPlaylistScope>(() => routeScope.value === 'local' ? 'cloud' : 'local')
const songCount = computed(() => playlist.value?.total ?? playlist.value?.list.length ?? 0)
const accessCount = computed(() => Number(playlist.value?.info.visit_count ?? playlist.value?.info.play_count ?? 0) || 0)
const totalPages = computed(() => Math.max(1, Math.ceil(songCount.value / pageSize)))
const displayStartIndex = computed(() => pageMode.value === 'pagination' ? (currentPage.value - 1) * pageSize : 0)
const songs = computed<Song[]>(() => {
  const list = playlist.value?.list || []
  if (isPagedPluginCollection.value) return list
  if (pageMode.value === 'pagination') {
    const start = (currentPage.value - 1) * pageSize
    return list.slice(start, start + pageSize)
  }
  return list.slice(0, currentPage.value * pageSize)
})
const canLoadMore = computed(() => pageMode.value === 'infinite' && songs.value.length < songCount.value)
const visiblePages = computed(() => {
  const current = currentPage.value
  const total = totalPages.value
  const delta = 2
  const start = Math.max(1, Math.min(current - delta, total - delta * 2))
  const end = Math.min(total, Math.max(current + delta, 1 + delta * 2))
  const pages: number[] = []
  for (let page = start; page <= end; page++) pages.push(page)
  return pages
})

const title = computed(() => {
  if (playlist.value) return playlist.value.info.name
  if (isLiked.value) return '我喜欢的音乐'
  if (isRecent.value) return '最近播放'
  return '歌单'
})

const description = computed(() => {
  if (playlist.value) return playlist.value.info.desc || '还没有简介'
  if (isLiked.value) return '收藏的歌曲会在这里汇总。'
  if (isRecent.value) return '最近播放记录会在这里展示。'
  return '选择一个歌单开始。'
})

const canExpandDescription = computed(() => {
  const text = description.value || ''
  return text.length > 120 || text.split('\n').length > 2
})

const scopeLabel = computed(() => {
  if (isLiked.value) return 'FAVORITES'
  if (playlist.value?.scope === 'plugin') return playlist.value.kind === 'album' ? 'PLUGIN ALBUM' : 'PLUGIN PLAYLIST'
  if (playlist.value?.scope === 'cloud') return 'CLOUD PLAYLIST'
  if (playlist.value?.scope === 'local') return 'LOCAL PLAYLIST'
  return 'PLAYLIST'
})

const heroIcon = computed(() => {
  if (isLiked.value) return 'lucide:heart'
  if (playlist.value?.scope === 'plugin') return playlist.value.kind === 'album' ? 'lucide:disc-3' : 'lucide:radio'
  if (playlist.value?.scope === 'cloud') return 'lucide:cloud'
  if (isRecent.value) return 'lucide:clock-3'
  return 'lucide:list-music'
})

const getErrorMessage = (err: unknown) => {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

const normalizePublicSong = (song: PublicSong): Song => ({
  id: String(song.id || ''),
  name: String(song.name || ''),
  artists: String(song.artists || song.artist || ''),
  source: String(song.source || ''),
  pic: String(song.pic || song.picUrl || ''),
  sPic: song.sPic,
  mPic: song.mPic,
  interval: String(song.interval || song.duration || '--/--'),
  qualities: song.qualities || song.types,
  quality: song.quality ?? null,
  albumId: song.albumId ?? null,
  albumName: song.albumName ?? null,
  lyric: song.lyric,
  url: typeof song.url === 'string' ? song.url : undefined,
})

const fetchLikedPlaylist = async (): Promise<AppPlaylist> => {
  const userId = route.name === 'UserLikedPlaylist'
    ? String(route.params.id || '')
    : String(authStore.state.userInfo?.id || '')
  if (!userId) {
    throw new Error('Not logged in')
  }
  const [profileResult, favResult] = await Promise.allSettled([
    window.electronAPI.user.getProfile(userId),
    window.electronAPI.user.getFavSongs(userId),
  ])
  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null
  const list = favResult.status === 'fulfilled'
    ? (favResult.value || []).map(normalizePublicSong).filter((song) => song.id && song.source)
    : []
  const displayName = profile?.nickname || profile?.username || (route.name === 'UserLikedPlaylist' ? '用户' : '我')
  return {
    id: userId,
    scope: 'plugin',
    source: 'user_fav',
    kind: 'playlist',
    info: {
      id: userId,
      name: `${displayName}喜欢的音乐`,
      desc: route.name === 'UserLikedPlaylist' ? 'TA喜欢的歌曲' : '收藏的歌曲会在这里汇总。',
      img: list.find((song) => song.pic)?.pic || '',
      author: displayName,
      play_count: '',
      visit_count: 0,
      is_public: true,
    },
    list,
    total: list.length,
  }
}

const loadPageMode = async () => {
  if (!window.electronAPI?.settings) return
  const settings = await window.electronAPI.settings.getAll()
  pageMode.value = settings.playlistPagingMode || 'infinite'
}

const fetchPluginCollectionPage = async (page: number, append = false) => {
  if (!routePluginId.value || !routeKind.value || !routeId.value) return
  const result = routeKind.value === 'album'
    ? await window.electronAPI.plugin.getAlbum(routePluginId.value, routeId.value, page, pageSize)
    : await window.electronAPI.plugin.getPlaylist(routePluginId.value, routeId.value, page, pageSize)

  playlist.value = append && playlist.value
    ? {
        ...result,
        list: [...playlist.value.list, ...(result.list || [])],
        total: result.total ?? playlist.value.total,
        info: result.info || playlist.value.info,
      }
    : result
  loadedPage.value = page
}

const loadPlaylist = async () => {
  errorMessage.value = ''
  descriptionExpanded.value = false
  currentPage.value = 1
  loadedPage.value = 1
  isCollectedByUser.value = false
  collectionCount.value = -1
  if (isLiked.value) {
    loading.value = true
    try {
      await loadPageMode()
      playlist.value = await fetchLikedPlaylist()
    } catch (err: any) {
      playlist.value = null
      errorMessage.value = getErrorMessage(err)
      console.error('[Playlist] load liked playlist failed:', err)
    } finally {
      loading.value = false
    }
    return
  }

  if (isRecent.value) {
    loading.value = true
    try {
      await loadPageMode()
      playlist.value = await loadRecentSongs()
    } catch (err: any) {
      playlist.value = null
      errorMessage.value = getErrorMessage(err)
      console.error('[Playlist] load recent plays failed:', err)
    } finally {
      loading.value = false
    }
    return
  }

  if (isPluginCollection.value && routePluginId.value && routeKind.value && routeId.value) {
    loading.value = true
    try {
      await loadPageMode()
      await fetchPluginCollectionPage(1, false)
      await loadCollectionState()
    } catch (err: any) {
      playlist.value = null
      errorMessage.value = getErrorMessage(err)
      console.error('[Playlist] load plugin collection failed:', err)
    } finally {
      loading.value = false
    }
    return
  }

  if (!routeScope.value || !routeId.value) {
    playlist.value = null
    return
  }
  loading.value = true
  try {
    await loadPageMode()
    playlist.value = await playlistStore.get(routeScope.value as ManagedPlaylistScope, routeId.value)
    if (isCloudPlaylist.value) await loadCollectionState()
  } catch (err: any) {
    playlist.value = null
    errorMessage.value = getErrorMessage(err)
    console.error('[Playlist] load failed:', err)
  } finally {
    loading.value = false
  }
}

const playAll = () => {
  if (songs.value.length === 0) return
  playerStore.setPlaylist(playlist.value?.list.length ? playlist.value.list : songs.value, 0)
}

const playSong = (index: number) => {
  const song = songs.value[index]
  if (song) playerStore.playFromList(song, songs.value)
}

const openEditDialog = () => {
  if (!playlist.value) return
  draftName.value = playlist.value.info.name
  draftDesc.value = playlist.value.info.desc
  draftIsPublic.value = Boolean(playlist.value.info.is_public)
  showEditDialog.value = true
}

const saveEdit = async () => {
  if (!routeScope.value || routeScope.value === 'plugin' || !routeId.value) return
  playlist.value = await playlistStore.update(routeScope.value, routeId.value, {
    name: draftName.value,
    desc: draftDesc.value,
    is_public: routeScope.value === 'cloud' ? draftIsPublic.value : false,
  })
  showEditDialog.value = false
}

const deletePlaylist = async () => {
  if (!routeScope.value || routeScope.value === 'plugin' || !routeId.value || !playlist.value) return
  await ElMessageBox.confirm(`确定删除「${playlist.value.info.name}」吗？`, '删除歌单', {
    confirmButtonText: '删除',
    cancelButtonText: '取消',
    type: 'warning',
  })
  await playlistStore.remove(routeScope.value, routeId.value)
  router.push('/')
}

const exportPlaylistFile = async () => {
  if (!routeScope.value || routeScope.value === 'plugin' || !routeId.value) return
  await playlistStore.exportPlaylist(routeScope.value, routeId.value)
}

const saveAsLocal = async () => {
  if (!isCloudPlaylist.value || !routeId.value) return
  const copied = await playlistStore.copyToLocal('cloud', routeId.value)
  router.push(`/playlist/local/${copied.id}`)
}

const openCoverDialog = () => {
  if (!isCloudPlaylist.value) return
  showCoverDialog.value = true
}

const uploadCoverImage = async () => {
  if (!isCloudPlaylist.value || !routeId.value) return
  coverUploading.value = true
  try {
    const result = await window.electronAPI.image.selectAndUpload()
    if (!result?.success || !result.url) {
      if (!result?.canceled) ElMessage.error(result?.message || '图片上传失败')
      return
    }
    playlist.value = await playlistStore.update('cloud', routeId.value, {
      img: result.url,
      cover_mode: 'custom',
    })
    showCoverDialog.value = false
  } finally {
    coverUploading.value = false
  }
}

const followSongCover = async () => {
  if (!isCloudPlaylist.value || !routeId.value) return
  playlist.value = await playlistStore.update('cloud', routeId.value, {
    cover_mode: 'auto',
  })
  showCoverDialog.value = false
}

const convertPlaylistMode = async () => {
  if (!routeScope.value || routeScope.value === 'plugin' || !routeId.value || !playlist.value) return
  const nextScope = targetScope.value
  const nextLabel = nextScope === 'cloud' ? '云端' : '本地'
  const sourceLabel = routeScope.value === 'cloud' ? '云端' : '本地'
  await ElMessageBox.confirm(
    `会先创建一个${nextLabel}歌单副本，然后删除当前${sourceLabel}歌单「${playlist.value.info.name}」。这个操作可能影响其他设备上的歌单，请确认后继续。`,
    '切换歌单模式',
    {
      confirmButtonText: `转为${nextLabel}`,
      cancelButtonText: '取消',
      type: 'warning',
    },
  )
  const converted = await playlistStore.convertScope(routeScope.value, routeId.value, nextScope)
  router.push(`/playlist/${converted.scope}/${converted.id}`)
}

const removeSong = async (index: number) => {
  if (!routeScope.value || routeScope.value === 'plugin' || !routeId.value) return
  playlist.value = await playlistStore.removeSong(routeScope.value, routeId.value, displayStartIndex.value + index)
}

// === Playlist Collection Feature ===

const loadCollectionState = async () => {
  if (!showCollectButton.value || !routeId.value) {
    isCollectedByUser.value = false
    collectionCount.value = isCloudPlaylist.value
      ? Number(playlist.value?.info.collection_count ?? 0) || 0
      : -1
    return
  }
  try {
    const favorites = await window.electronAPI.playlist.getFavorites()
    const source = collectionSource.value
    isCollectedByUser.value = favorites.some((item) =>
      String(item.id) === routeId.value && String(item.source || '') === source
    )
    collectionCount.value = isCloudPlaylist.value
      ? Number(playlist.value?.info.collection_count ?? 0) || 0
      : -1
  } catch {
    isCollectedByUser.value = false
    collectionCount.value = isCloudPlaylist.value
      ? Number(playlist.value?.info.collection_count ?? 0) || 0
      : -1
  }
}

const toggleCollectPlaylist = async () => {
  if (!routeId.value || collectingPlaylist.value || !showCollectButton.value) return
  collectingPlaylist.value = true
  try {
    const result = isCollectedByUser.value
      ? await window.electronAPI.playlist.uncollect(routeId.value, collectionSource.value)
      : await window.electronAPI.playlist.collect(routeId.value, collectionSource.value)
    if (result.status !== 'success') throw new Error(result.message || '收藏同步失败')
    isCollectedByUser.value = result.collected
    if (isCloudPlaylist.value && result.collection_count != null) {
      collectionCount.value = Number(result.collection_count) || 0
      if (playlist.value) playlist.value.info.collection_count = collectionCount.value
    }
    ElMessage.success(result.collected ? '已收藏歌单' : '已取消收藏')
  } catch (err: any) {
    ElMessage.error(err?.message || '操作失败')
  } finally {
    collectingPlaylist.value = false
  }
}

// === Recent Plays Feature ===

const loadRecentSongs = async (): Promise<AppPlaylist> => {
  const userId = String(authStore.state.userInfo?.id || '')
  if (!userId) throw new Error('Not logged in')
  const songs = await window.electronAPI.user.getRecentSongs(userId)
  const list = (songs || []).map(normalizePublicSong).filter((s) => s.id && s.source)
  return {
    id: userId,
    scope: 'plugin',
    source: 'recent',
    kind: 'playlist',
    info: {
      id: userId,
      name: '最近播放',
      desc: '最近播放记录会在这里展示。',
      img: '',
      author: '',
      play_count: '',
      visit_count: 0,
      is_public: false,
    },
    list,
    total: list.length,
  }
}

const changePage = async (page: number) => {
  if (page < 1 || page > totalPages.value || page === currentPage.value) return
  currentPage.value = page
  if (isPagedPluginCollection.value) {
    loading.value = true
    errorMessage.value = ''
    try {
      await fetchPluginCollectionPage(page, false)
    } catch (err) {
      playlist.value = null
      errorMessage.value = getErrorMessage(err)
    } finally {
      loading.value = false
    }
  }
}

const loadMore = async () => {
  if (!canLoadMore.value || loadingMore.value || loading.value) return
  if (isPagedPluginCollection.value) {
    loadingMore.value = true
    try {
      await fetchPluginCollectionPage(loadedPage.value + 1, true)
    } catch (err) {
      errorMessage.value = getErrorMessage(err)
    } finally {
      loadingMore.value = false
    }
    return
  }
  currentPage.value = Math.min(totalPages.value, currentPage.value + 1)
}

const setupLoadMoreObserver = () => {
  loadMoreObserver?.disconnect()
  loadMoreObserver = null
  if (pageMode.value !== 'infinite' || !canLoadMore.value || !loadMoreTrigger.value) return
  loadMoreObserver = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadMore()
    }
  }, { root: null, rootMargin: '220px 0px' })
  loadMoreObserver.observe(loadMoreTrigger.value)
}

const copyErrorMessage = async () => {
  if (!errorMessage.value) return
  await navigator.clipboard.writeText(errorMessage.value)
  ElMessage.success('错误详情已复制')
}

const handlePageModeChanged = (event: Event) => {
  const mode = (event as CustomEvent<'infinite' | 'pagination'>).detail
  if (!mode || mode === pageMode.value) return
  pageMode.value = mode
  currentPage.value = 1
  loadedPage.value = 1
  if (isPluginCollection.value) {
    loadPlaylist()
  }
}

watch(
  () => [route.name, route.params.scope, route.params.pluginId, route.params.kind, route.params.id, route.path, authStore.state.userInfo?.id],
  loadPlaylist,
  { immediate: true },
)

watch(
  () => [songs.value.length, canLoadMore.value, pageMode.value, loading.value, loadingMore.value],
  () => nextTick(setupLoadMoreObserver),
  { flush: 'post' },
)

onMounted(() => {
  window.addEventListener('qz-playlist-page-mode-changed', handlePageModeChanged)
})

onBeforeUnmount(() => {
  loadMoreObserver?.disconnect()
  window.removeEventListener('qz-playlist-page-mode-changed', handlePageModeChanged)
})
</script>

<style scoped>
.playlist-view {
  min-height: 100%;
  background: transparent;
}

.content-wrapper {
  box-sizing: border-box;
  max-width: 1180px;
  margin: 0 auto;
  padding: 30px 32px 44px;
}

.playlist-hero {
  display: flex;
  align-items: center;
  gap: 28px;
  padding: 28px 0 34px;
  border-bottom: 1px solid var(--color-border);
}

.cover {
  width: 176px;
  aspect-ratio: 1;
  border-radius: 26px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-bg-secondary));
  color: var(--color-accent);
  flex-shrink: 0;
  position: relative;
}

.cover.editable {
  cursor: pointer;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover svg {
  width: 58px;
  height: 58px;
}

.cover-edit {
  position: absolute;
  right: 10px;
  bottom: 10px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: white;
  background: rgba(0, 0, 0, 0.52);
  backdrop-filter: blur(10px);
}

.cover-edit svg {
  width: 18px;
  height: 18px;
}

.hero-copy {
  min-width: 0;
  flex: 1;
}

.eyebrow {
  font-size: 12px;
  font-weight: 750;
  color: var(--color-text-muted);
  letter-spacing: 0.08em;
}

h1 {
  margin-top: 8px;
  font-size: 42px;
  line-height: 1.1;
  color: var(--color-text-primary);
}

.description-wrap {
  margin-top: 12px;
  max-width: 650px;
}

.description-text {
  margin: 0;
  color: var(--color-text-secondary);
  white-space: pre-line;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.description-text.expanded {
  display: block;
  overflow: visible;
}

.description-toggle {
  margin-top: 8px;
  color: var(--color-accent);
  font-size: 13px;
  font-weight: 700;
}

.description-toggle:hover {
  color: var(--color-text-primary);
}

.hero-meta {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.author-link {
  color: var(--color-accent);
  text-decoration: none;
  font-weight: 600;
  transition: color 160ms ease;
}

.author-link:hover {
  color: var(--color-text-primary);
  text-decoration: underline;
}

.icon-btn.collect-btn {
  color: var(--color-text-muted);
}

.icon-btn.collect-btn:hover {
  color: #ff6b8a;
}

.icon-btn.collect-btn.collected {
  color: #ff4d6d;
}

.icon-btn.collect-btn.collected svg {
  fill: currentColor;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 24px;
}

.primary-btn,
.soft-btn,
.ghost-btn {
  min-height: 42px;
  padding: 0 18px;
  border-radius: var(--radius-full);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.primary-btn {
  background: var(--color-accent-gradient);
  color: white;
}

.primary-btn.compact {
  min-height: 38px;
}

.primary-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.soft-btn,
.ghost-btn {
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
}

.soft-btn:hover,
.ghost-btn:hover,
.icon-btn:hover,
.song-row:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-primary);
}

.icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  transition: background-color 160ms ease, color 160ms ease;
}

.icon-btn.danger:hover {
  color: #ff6b6b;
}

.songs-section {
  padding-top: 20px;
}

.list-header {
  display: grid;
  grid-template-columns: 50px 40px minmax(0, 4fr) minmax(100px, 3fr) 60px 42px;
  align-items: center;
  gap: 16px;
}

.list-header {
  height: 36px;
  color: var(--color-text-muted);
  font-size: 12px;
  border-bottom: 1px solid var(--color-border);
}

.song-list {
  display: flex;
  flex-direction: column;
  padding-top: 6px;
}

.empty-state {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--color-text-muted);
}

.error-state {
  min-height: 220px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 9px;
  color: var(--color-text-muted);
  cursor: copy;
  text-align: center;
}

.error-state svg {
  width: 36px;
  height: 36px;
  color: color-mix(in srgb, var(--color-accent) 72%, var(--color-text-muted));
}

.error-state span {
  color: var(--color-text-primary);
  font-weight: 720;
}

.error-state small {
  color: var(--color-text-muted);
}

.empty-state svg {
  width: 34px;
  height: 34px;
}

.load-more-sentinel {
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
  padding: 8px 0 4px;
}

.page-btn {
  min-width: 34px;
  height: 34px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.page-btn:hover:not(:disabled),
.page-btn.active {
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-text-primary);
}

.page-btn.active {
  color: var(--color-accent);
  font-weight: 760;
}

.page-btn:disabled {
  opacity: 0.38;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
}

.edit-dialog {
  width: min(390px, calc(100vw - 32px));
  padding: 22px;
  border-radius: 24px;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-elevated);
}

.cover-dialog {
  width: min(420px, calc(100vw - 32px));
}

.cover-preview {
  width: 128px;
  aspect-ratio: 1;
  margin: 0 auto 14px;
  border-radius: 20px;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--color-bg-secondary);
  color: var(--color-text-muted);
}

.cover-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-preview svg {
  width: 42px;
  height: 42px;
}

.cover-mode-text {
  margin: 0 0 16px;
  color: var(--color-text-secondary);
  text-align: center;
  font-size: 13px;
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
  min-height: 90px;
  resize: none;
}

.public-option {
  min-height: 32px;
  margin: -2px 0 14px;
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

.text-input:focus,
.text-area:focus {
  border-color: color-mix(in srgb, var(--color-accent) 34%, transparent);
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 820px) {
  .playlist-hero {
    align-items: flex-start;
    flex-direction: column;
  }

  .cover {
    width: 132px;
  }

  h1 {
    font-size: 32px;
  }

  .list-header {
    grid-template-columns: 50px 40px minmax(0, 1fr) 60px 42px;
  }

  .col-album,
  .col-time {
    display: none;
  }
}
</style>

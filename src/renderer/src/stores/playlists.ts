import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { ElMessage } from 'element-plus'
import type { Song } from '../types/song'

export type PlaylistScope = 'local' | 'cloud' | 'plugin'
export type ManagedPlaylistScope = 'local' | 'cloud'

export interface PlaylistInfo {
  id: string
  name: string
  desc: string
  img: string
  cover_mode?: 'auto' | 'custom' | string
  author?: string
  play_count?: string
  visit_count?: number
  collection_count?: number
  is_public?: boolean
}

export interface PlaylistOwner {
  id: string
  nickname: string
  username: string
  avatar?: string | null
}

export interface AppPlaylist {
  id: string
  scope: PlaylistScope
  source: string
  kind?: 'playlist' | 'album'
  info: PlaylistInfo
  list: Song[]
  total: number
  owner?: PlaylistOwner
}

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
    lyric: typeof raw.lyric === 'string' ? raw.lyric : undefined,
    url: typeof raw.url === 'string' ? raw.url : undefined,
  }
}

export const usePlaylistsStore = defineStore('playlists', () => {
  const local = ref<AppPlaylist[]>([])
  const cloud = ref<AppPlaylist[]>([])
  const loading = ref(false)

  const all = computed(() => [...local.value, ...cloud.value])

  const refresh = async () => {
    loading.value = true
    try {
      const result = await window.electronAPI.playlist.list()
      local.value = result.local || []
      cloud.value = result.cloud || []
    } catch (err: any) {
      console.error('[Playlist] refresh failed:', err)
      ElMessage.error(err?.message || '歌单加载失败')
    } finally {
      loading.value = false
    }
  }

  const publicList = async (search = '', sort = 'visit', page = 1, limit = 50) => {
    return await window.electronAPI.playlist.publicList(search, sort, page, limit)
  }

  const get = async (scope: PlaylistScope, id: string) => {
    return await window.electronAPI.playlist.get(scope as ManagedPlaylistScope, id) as AppPlaylist
  }

  const create = async (scope: ManagedPlaylistScope, data: { name: string; desc?: string; is_public?: boolean }) => {
    const playlist = await window.electronAPI.playlist.create(scope, data) as AppPlaylist
    await refresh()
    ElMessage.success(scope === 'local' ? '本地歌单已创建' : '云端歌单已创建')
    return playlist
  }

  const update = async (scope: ManagedPlaylistScope, id: string, info: Partial<PlaylistInfo>) => {
    const playlist = await window.electronAPI.playlist.update(scope, id, info) as AppPlaylist
    await refresh()
    ElMessage.success('歌单已更新')
    return playlist
  }

  const remove = async (scope: ManagedPlaylistScope, id: string) => {
    const result = await window.electronAPI.playlist.delete(scope, id)
    await refresh()
    if (result.success) ElMessage.success('歌单已删除')
    return result
  }

  const addSong = async (scope: ManagedPlaylistScope, id: string, song: Song, index = -1) => {
    const playlist = await window.electronAPI.playlist.addSong(scope, id, toPlainSong(song), index) as AppPlaylist
    await refresh()
    ElMessage.success('已添加到歌单')
    return playlist
  }

  const removeSong = async (scope: ManagedPlaylistScope, id: string, index: number) => {
    const playlist = await window.electronAPI.playlist.removeSong(scope, id, index) as AppPlaylist
    await refresh()
    ElMessage.success('已从歌单移除')
    return playlist
  }

  const exportPlaylist = async (scope: ManagedPlaylistScope, id: string) => {
    const result = await window.electronAPI.playlist.export(scope, id)
    if (result?.success) ElMessage.success('歌单已导出')
    return result
  }

  const importPlaylist = async () => {
    const result = await window.electronAPI.playlist.import()
    if (result?.success) {
      await refresh()
      ElMessage.success('歌单已导入')
    }
    return result
  }

  const convertScope = async (scope: ManagedPlaylistScope, id: string, targetScope: ManagedPlaylistScope) => {
    const playlist = await window.electronAPI.playlist.convertScope(scope, id, targetScope) as AppPlaylist
    await refresh()
    ElMessage.success(targetScope === 'cloud' ? '已转换为云端歌单' : '已转换为本地歌单')
    return playlist
  }

  const copyToLocal = async (scope: ManagedPlaylistScope, id: string) => {
    const playlist = await window.electronAPI.playlist.copyToLocal(scope, id) as AppPlaylist
    await refresh()
    ElMessage.success('已另存为本地歌单')
    return playlist
  }

  return {
    local,
    cloud,
    all,
    loading,
    refresh,
    publicList,
    get,
    create,
    update,
    remove,
    addSong,
    removeSong,
    exportPlaylist,
    importPlaylist,
    convertScope,
    copyToLocal,
  }
})

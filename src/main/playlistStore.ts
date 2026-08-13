import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { loadAuthState, qzFetch } from './authStore'

export type PlaylistScope = 'local' | 'cloud'

export interface PlaylistSong {
    id: string
    name: string
    artists?: string
    source: string
    pic?: string
    mPic?: string
    sPic?: string
    albumName?: string | null
    albumId?: string | null
    interval?: string
    url?: string
    qualities?: Record<string, string>
}

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
    source: PlaylistScope
    info: PlaylistInfo
    list: PlaylistSong[]
    total: number
    owner?: PlaylistOwner
}

type LocalPlaylistFile = Omit<AppPlaylist, 'scope' | 'source' | 'total'> & {
    id: string
    list: PlaylistSong[]
    info: PlaylistInfo
}

function getPlaylistsDir(): string {
    return path.join(app.getPath('userData'), 'playlists')
}

function getLocalPlaylistPath(id: string): string {
    return path.join(getPlaylistsDir(), `${id}.json`)
}

function ensurePlaylistsDir(): void {
    fs.mkdirSync(getPlaylistsDir(), { recursive: true })
}

function assertLocalId(id: string): void {
    if (!/^[a-z0-9._-]+$/i.test(id)) throw new Error('Invalid playlist id')
}

function normalizeSong(song: any): PlaylistSong {
    const id = String(song?.id ?? song?.songmid ?? '')
    const artist = song?.artists ?? song?.singer ?? ''
    const pic = song?.pic ?? song?.img ?? ''

    return {
        ...song,
        id,
        name: String(song?.name ?? ''),
        artists: Array.isArray(artist) ? artist.join('、') : String(artist),
        source: String(song?.source ?? 'local'),
        pic: String(pic),
        mPic: song?.mPic ?? song?.m_img ?? pic,
        sPic: song?.sPic ?? song?.s_img ?? pic,
        interval: String(song?.interval ?? '--/--'),
        qualities: song?.qualities ?? song?.types ?? {},
    }
}

function normalizeLocalPlaylist(raw: LocalPlaylistFile): AppPlaylist {
    const list = Array.isArray(raw.list) ? raw.list.map(normalizeSong) : []
    return {
        id: raw.id,
        scope: 'local',
        source: 'local',
        info: {
            id: raw.id,
            name: raw.info?.name || '新建歌单',
            desc: raw.info?.desc || '',
            img: raw.info?.img || list[0]?.pic || '',
            cover_mode: raw.info?.cover_mode || 'auto',
            author: raw.info?.author || '本地',
            play_count: raw.info?.play_count || '',
            visit_count: Number(raw.info?.visit_count ?? raw.info?.play_count ?? 0) || 0,
            is_public: Boolean(raw.info?.is_public),
        },
        list,
        total: list.length,
    }
}

function normalizeCloudPlaylist(raw: any): AppPlaylist {
    const info = raw?.info ?? raw
    const list = Array.isArray(raw?.list) ? raw.list.map(normalizeSong) : []
    const id = String(info?.id ?? raw?.id ?? '')
    const total = Number(raw?.total ?? info?.total ?? list.length) || list.length
    const owner = raw?.owner ? {
        id: String(raw.owner.id || ''),
        nickname: String(raw.owner.nickname || ''),
        username: String(raw.owner.username || ''),
        avatar: raw.owner.avatar || null,
    } : undefined
    return {
        id,
        scope: 'cloud',
        source: 'cloud',
        info: {
            id,
            name: info?.name || '云端歌单',
            desc: info?.desc || '',
            img: info?.img || info?.pic || list[0]?.pic || '',
            cover_mode: info?.cover_mode || info?.coverMode || 'auto',
            author: info?.author || '',
            play_count: info?.play_count || '',
            visit_count: Number(info?.visit_count ?? info?.play_count ?? 0) || 0,
            collection_count: Number(info?.collection_count ?? info?.like_count ?? 0) || 0,
            is_public: Boolean(info?.is_public ?? info?.public ?? false),
        },
        list,
        total,
        owner,
    }
}

function readLocalPlaylist(id: string): AppPlaylist {
    assertLocalId(id)
    const raw = JSON.parse(fs.readFileSync(getLocalPlaylistPath(id), 'utf8')) as LocalPlaylistFile
    return normalizeLocalPlaylist(raw)
}

function writeLocalPlaylist(playlist: AppPlaylist): AppPlaylist {
    ensurePlaylistsDir()
    assertLocalId(playlist.id)
    const normalized = normalizeLocalPlaylist({
        id: playlist.id,
        info: playlist.info,
        list: playlist.list,
    })
    fs.writeFileSync(getLocalPlaylistPath(playlist.id), JSON.stringify({
        id: normalized.id,
        info: normalized.info,
        list: normalized.list,
    }, null, 2), 'utf8')
    return normalized
}

function createLocalPlaylistCopy(playlist: AppPlaylist): AppPlaylist {
    const id = crypto.randomUUID()
    return writeLocalPlaylist({
        ...playlist,
        id,
        scope: 'local',
        source: 'local',
        info: {
            ...playlist.info,
            id,
            author: '本地',
        },
        list: playlist.list.map(normalizeSong),
        total: playlist.list.length,
    })
}

async function createCloudPlaylistCopy(playlist: AppPlaylist): Promise<AppPlaylist> {
    const list = playlist.list.map(normalizeSong)
    const info = {
        ...playlist.info,
        id: '',
        author: '',
        is_public: Boolean(playlist.info.is_public),
    }
    const result = await qzFetch('/playlist/', {
        method: 'POST',
        body: JSON.stringify({ info, list }),
    })
    if (result?.status !== 'success' || !result.id) {
        throw new Error(result?.message || 'Create cloud playlist failed')
    }

    const id = String(result.id)
    let created = await getPlaylist('cloud', id)
    if ((created.list?.length || 0) === 0 && list.length > 0) {
        for (const song of list) {
            const addResult = await qzFetch(`/playlist/${encodeURIComponent(id)}/list`, {
                method: 'POST',
                body: JSON.stringify({ data: song, index: -1 }),
            })
            if (addResult?.status !== 'success') throw new Error(addResult?.message || 'Add song failed')
        }
        created = await getPlaylist('cloud', id)
    }
    return created
}

function normalizeImportedPlaylist(raw: any): AppPlaylist {
    const payload = raw?.type === 'qzmusic-playlist' ? raw : raw?.playlist ? raw.playlist : raw
    const rawInfo = payload?.info ?? payload
    const list = Array.isArray(payload?.list) ? payload.list.map(normalizeSong) : []
    const id = crypto.randomUUID()
    return normalizeLocalPlaylist({
        id,
        info: {
            id,
            name: rawInfo?.name || '导入的歌单',
            desc: rawInfo?.desc || '',
            img: rawInfo?.img || rawInfo?.pic || list[0]?.pic || '',
            cover_mode: rawInfo?.cover_mode || rawInfo?.coverMode || 'auto',
            author: '本地',
            play_count: '',
            visit_count: 0,
        },
        list,
    })
}

export function listLocalPlaylists(): AppPlaylist[] {
    ensurePlaylistsDir()
    return fs.readdirSync(getPlaylistsDir(), { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
        .map((entry) => {
            try {
                return readLocalPlaylist(path.basename(entry.name, '.json'))
            } catch (err) {
                console.error('[Playlist] Failed to read local playlist:', entry.name, err)
                return null
            }
        })
        .filter((playlist): playlist is AppPlaylist => playlist !== null)
}

export async function listCloudPlaylists(): Promise<AppPlaylist[]> {
    const userId = loadAuthState().userInfo?.id
    if (!userId) return []
    const raw = await qzFetch(`/user/${encodeURIComponent(userId)}/playlists`)
    return Array.isArray(raw) ? raw.map(normalizeCloudPlaylist) : []
}

export async function listPublicPlaylists(
    search = '',
    sort = 'visit',
    page = 1,
    limit = 50,
): Promise<{ items: AppPlaylist[]; total: number; page: number; limit: number; sort: string }> {
    const query = new URLSearchParams({
        page: String(Math.max(1, Number(page) || 1)),
        limit: String(Math.max(1, Math.min(50, Number(limit) || 50))),
        sort: ['visit', 'name', 'total', 'collection'].includes(sort) ? sort : 'visit',
    })
    if (search.trim()) query.set('search', search.trim())
    const raw = await qzFetch(`/playlist/public?${query.toString()}`)
    const items = Array.isArray(raw?.items) ? raw.items.map(normalizeCloudPlaylist) : []
    return {
        items,
        total: Number(raw?.total ?? items.length) || items.length,
        page: Number(raw?.page ?? page) || page,
        limit: Number(raw?.limit ?? limit) || limit,
        sort: String(raw?.sort ?? sort),
    }
}

export async function getPlaylist(scope: PlaylistScope, id: string, recordVisit = true): Promise<AppPlaylist> {
    if (scope === 'local') return readLocalPlaylist(id)
    const raw = await qzFetch(`/playlist/${encodeURIComponent(id)}?record_visit=${recordVisit}`)
    return normalizeCloudPlaylist(raw)
}

export async function createPlaylist(scope: PlaylistScope, data: { name: string; desc?: string; is_public?: boolean }): Promise<AppPlaylist> {
    const id = scope === 'local' ? crypto.randomUUID() : ''
    const playlist: AppPlaylist = {
        id,
        scope,
        source: scope,
        info: {
            id,
            name: data.name.trim() || '新建歌单',
            desc: data.desc?.trim() || '',
            img: '',
            author: scope === 'local' ? '本地' : '',
            play_count: '',
            visit_count: 0,
            is_public: scope === 'cloud' ? Boolean(data.is_public) : false,
        },
        list: [],
        total: 0,
    }

    if (scope === 'local') return writeLocalPlaylist(playlist)

    const result = await qzFetch('/playlist/', {
        method: 'POST',
        body: JSON.stringify({ info: playlist.info, list: [] }),
    })
    if (result?.status !== 'success' || !result.id) {
        throw new Error(result?.message || 'Create cloud playlist failed')
    }
    return getPlaylist('cloud', String(result.id))
}

export async function updatePlaylist(scope: PlaylistScope, id: string, info: Partial<PlaylistInfo>): Promise<AppPlaylist> {
    if (scope === 'local') {
        const playlist = readLocalPlaylist(id)
        playlist.info = { ...playlist.info, ...info, id }
        return writeLocalPlaylist(playlist)
    }

    const result = await qzFetch(`/playlist/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(info),
    })
    if (result?.status !== 'success') throw new Error(result?.message || 'Update cloud playlist failed')
    return getPlaylist('cloud', id)
}

export async function copyPlaylistToLocal(scope: PlaylistScope, id: string): Promise<AppPlaylist> {
    const playlist = await getPlaylist(scope, id)
    return createLocalPlaylistCopy(playlist)
}

export async function deletePlaylist(scope: PlaylistScope, id: string): Promise<{ success: boolean }> {
    if (scope === 'local') {
        assertLocalId(id)
        const target = getLocalPlaylistPath(id)
        if (fs.existsSync(target)) fs.unlinkSync(target)
        return { success: true }
    }

    const result = await qzFetch(`/playlist/${encodeURIComponent(id)}`, { method: 'DELETE' })
    return { success: result?.status === 'success' }
}

export async function addSong(scope: PlaylistScope, id: string, song: PlaylistSong, index = -1): Promise<AppPlaylist> {
    const normalizedSong = normalizeSong(song)
    if (scope === 'local') {
        const playlist = readLocalPlaylist(id)
        const exists = playlist.list.some((item) => item.id === normalizedSong.id && item.source === normalizedSong.source)
        if (!exists) {
            if (index >= 0 && index <= playlist.list.length) playlist.list.splice(index, 0, normalizedSong)
            else playlist.list.push(normalizedSong)
        }
        playlist.info.img = playlist.info.img || normalizedSong.pic || ''
        return writeLocalPlaylist(playlist)
    }

    const result = await qzFetch(`/playlist/${encodeURIComponent(id)}/list`, {
        method: 'POST',
        body: JSON.stringify({ data: normalizedSong, index }),
    })
    if (result?.status !== 'success') throw new Error(result?.message || 'Add song failed')
    return getPlaylist('cloud', id)
}

export async function removeSong(scope: PlaylistScope, id: string, index: number): Promise<AppPlaylist> {
    if (scope === 'local') {
        const playlist = readLocalPlaylist(id)
        if (index >= 0 && index < playlist.list.length) playlist.list.splice(index, 1)
        playlist.info.img = playlist.list[0]?.pic || ''
        return writeLocalPlaylist(playlist)
    }

    const result = await qzFetch(`/playlist/${encodeURIComponent(id)}/list/${index}`, { method: 'DELETE' })
    if (result?.status !== 'success') throw new Error(result?.message || 'Remove song failed')
    return getPlaylist('cloud', id)
}

export async function exportPlaylist(scope: PlaylistScope, id: string, filePath: string): Promise<{ success: boolean; path: string }> {
    const playlist = await getPlaylist(scope, id)
    const payload = {
        type: 'qzmusic-playlist',
        version: 1,
        exportedAt: new Date().toISOString(),
        info: playlist.info,
        list: playlist.list.map(normalizeSong),
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf8')
    return { success: true, path: filePath }
}

export function importPlaylist(filePath: string): AppPlaylist {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    return writeLocalPlaylist(normalizeImportedPlaylist(raw))
}

export async function convertPlaylistScope(scope: PlaylistScope, id: string, targetScope: PlaylistScope): Promise<AppPlaylist> {
    if (scope === targetScope) return getPlaylist(scope, id)
    const playlist = await getPlaylist(scope, id)
    const converted = targetScope === 'local'
        ? createLocalPlaylistCopy(playlist)
        : await createCloudPlaylistCopy(playlist)

    const deleted = await deletePlaylist(scope, id)
    if (!deleted.success) throw new Error('Converted playlist, but failed to delete source playlist')
    return converted
}

import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import {
    addFavoriteSong,
    checkFavoriteSongs,
    getFavoriteSongs,
    loadAuthState,
    removeFavoriteSong,
} from './authStore'

/**
 * 喜欢歌曲本地缓存
 *
 * 目的: 断网时仍能展示"喜欢的歌"列表与喜欢状态。
 * 策略(与客户端约定):
 * - 全量刷新: 启动应用、打开喜欢歌页面时
 * - 单独查询: 切换歌曲时只查当前歌曲是否已喜欢(优先走网络, 失败回退缓存)
 * - 增删喜欢成功后同步更新缓存
 *
 * 存储位置: <userData>/liked_cache.json → { userId: Song[] }
 */

interface LikedCacheFile {
    [userId: string]: any[]
}

let cache: LikedCacheFile | null = null

function getCachePath(): string {
    return path.join(app.getPath('userData'), 'liked_cache.json')
}

function loadCache(): LikedCacheFile {
    if (cache) return cache
    try {
        const filePath = getCachePath()
        if (fs.existsSync(filePath)) {
            const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'))
            cache = parsed && typeof parsed === 'object' ? parsed : {}
        } else {
            cache = {}
        }
    } catch (err) {
        console.error('[LikedCache] Failed to load cache:', err)
        cache = {}
    }
    return cache!
}

function saveCache(): void {
    try {
        fs.writeFileSync(getCachePath(), JSON.stringify(cache || {}), 'utf-8')
    } catch (err) {
        console.error('[LikedCache] Failed to save cache:', err)
    }
}

function songKey(song: any): string {
    return `${String(song?.source ?? '').trim()}:${String(song?.id ?? '').trim()}`
}

function normalizeSongList(list: any): any[] {
    if (!Array.isArray(list)) return []
    const seen = new Set<string>()
    const result: any[] = []
    for (const song of list) {
        if (!song || typeof song !== 'object') continue
        const source = String(song.source ?? '').trim()
        const id = String(song.id ?? '').trim()
        if (!source || !id || source === 'local') continue
        const key = `${source}:${id}`
        if (seen.has(key)) continue
        seen.add(key)
        result.push({ ...song, source, id })
    }
    return result
}

function resolveUserId(userId?: string): string {
    const target = userId || loadAuthState().userInfo?.id || ''
    return String(target || '')
}

/** 读取本地缓存的喜欢列表(离线可用)。 */
export function getCachedLikedSongs(userId?: string): any[] {
    const targetUserId = resolveUserId(userId)
    if (!targetUserId) return []
    return loadCache()[targetUserId] || []
}

/** 用给定列表覆盖某用户的本地缓存。 */
export function setCachedLikedSongs(userId: string, list: any[]): void {
    if (!userId) return
    const data = loadCache()
    data[userId] = normalizeSongList(list)
    saveCache()
}

/**
 * 全量刷新: 从服务端拉取喜欢列表并写入缓存。
 * 网络失败时返回 null(调用方应回退到缓存), 保证离线可用。
 */
export async function refreshLikedSongs(userId?: string): Promise<any[] | null> {
    const targetUserId = resolveUserId(userId)
    if (!targetUserId) return null
    try {
        const list = await getFavoriteSongs(targetUserId)
        setCachedLikedSongs(targetUserId, list)
        return normalizeSongList(list)
    } catch (err) {
        console.warn('[LikedCache] Failed to refresh liked songs:', err)
        return null
    }
}

/**
 * 查询给定歌曲是否已喜欢(批量)。
 * 优先查询服务端; 失败时回退到本地缓存。
 * 返回以 `source:id` 为 key 的布尔映射。
 */
export async function checkLikedSongs(songs: Array<{ source?: string; id?: string }>): Promise<Record<string, boolean>> {
    const items = (songs || []).filter(
        (song) => song && String(song.source || '').trim() && String(song.id || '').trim() && song.source !== 'local'
    )
    const result: Record<string, boolean> = {}
    if (items.length === 0) return result

    const targetUserId = resolveUserId()
    if (!targetUserId) return result

    try {
        const liked = await checkFavoriteSongs(items)
        return liked
    } catch (err) {
        console.warn('[LikedCache] Server check failed, falling back to cache:', err)
    }

    // 离线回退: 用本地缓存判断
    const cached = new Set((loadCache()[targetUserId] || []).map(songKey))
    for (const song of items) {
        const key = songKey(song)
        result[key] = cached.has(key)
    }
    return result
}

/** 新增喜欢成功后更新缓存(单曲)。 */
export function applyAddLikedSong(song: any): void {
    const targetUserId = resolveUserId()
    if (!targetUserId || !song || song.source === 'local') return
    const data = loadCache()
    const list = normalizeSongList([song, ...(data[targetUserId] || [])])
    data[targetUserId] = list
    saveCache()
}

/** 取消喜欢成功后更新缓存(单曲)。 */
export function applyRemoveLikedSong(source: string, id: string): void {
    const targetUserId = resolveUserId()
    if (!targetUserId) return
    const key = `${String(source || '').trim()}:${String(id || '').trim()}`
    const data = loadCache()
    data[targetUserId] = (data[targetUserId] || []).filter((song: any) => songKey(song) !== key)
    saveCache()
}

/** 清空某用户的本地喜欢缓存。 */
export function clearLikedCache(userId?: string): void {
    if (userId) {
        const data = loadCache()
        delete data[userId]
        saveCache()
        return
    }
    cache = {}
    try {
        const filePath = getCachePath()
        if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
    } catch (err) {
        console.error('[LikedCache] Failed to clear cache:', err)
    }
}

// 重新导出, 方便 index.ts 统一注册
export { addFavoriteSong, removeFavoriteSong }

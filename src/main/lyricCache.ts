import fs from 'fs'
import path from 'path'
import { app } from 'electron'

/**
 * 歌词缓存
 *
 * 与手机端 MediaController.getLyric 的 KV 缓存 (music.cache.<source>.<id>.lyric) 行为对齐:
 * - 按 source + id 作为 key
 * - 仅缓存看起来有效(非空)的歌词内容
 * - local 源不缓存(歌词内嵌在本地文件里)
 *
 * 存储位置: <userData>/lyric_cache/<source>-<id>.json
 * 独立于音频缓存目录, 因此不受“缓存音乐到本地”开关 / 缓存位置 / 清理音频缓存 影响,
 * 仅能通过“清理歌词缓存”按钮或删除目录自行移除。
 *
 * 为保留翻译/罗马音等附加信息, 缓存以 JSON 形式保存插件的原始返回
 * (字符串或对象), 取用时还原成与插件返回一致的形态。
 */

const LYRIC_DIR_NAME = 'lyric_cache'

interface LyricCachePayload {
    /** 'string' 或 'object', 用于还原原始返回类型 */
    type: 'string' | 'object'
    data: unknown
}

function sanitizePart(value: string): string {
    return String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_')
}

function getLyricDir(): string {
    const dir = path.join(app.getPath('userData'), LYRIC_DIR_NAME)
    if (!fs.existsSync(dir)) {
        try {
            fs.mkdirSync(dir, { recursive: true })
        } catch (err) {
            console.error('[LyricCache] Failed to create lyric cache dir:', err)
        }
    }
    return dir
}

function getLyricPath(source: string, id: string): string {
    return path.join(getLyricDir(), `${sanitizePart(source)}-${sanitizePart(id)}.json`)
}

/** 判断插件返回是否包含可用的歌词内容。 */
function hasLyricContent(raw: unknown): boolean {
    if (typeof raw === 'string') return raw.trim().length > 0
    if (raw && typeof raw === 'object') {
        const record = raw as Record<string, unknown>
        for (const key of ['lyric', 'lrc', 'krc', 'qrc', 'yrc', 'ttml', 'elrc']) {
            const value = record[key]
            if (typeof value === 'string' && value.trim()) return true
        }
    }
    return false
}

/** 读取缓存的歌词; 不存在返回 null。 */
export function getCachedLyric(source: string, id: string): unknown | null {
    if (!source || !id || source === 'local') return null
    try {
        const filePath = getLyricPath(source, id)
        if (!fs.existsSync(filePath)) return null
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as LyricCachePayload
        if (parsed.type === 'string') {
            return typeof parsed.data === 'string' && parsed.data.trim() ? parsed.data : null
        }
        return hasLyricContent(parsed.data) ? parsed.data : null
    } catch (err) {
        console.error('[LyricCache] Failed to read lyric cache:', err)
        return null
    }
}

/** 写入歌词缓存; 内容无效时忽略。 */
export function setCachedLyric(source: string, id: string, raw: unknown): void {
    if (!source || !id || source === 'local') return
    if (!hasLyricContent(raw)) return

    const payload: LyricCachePayload = typeof raw === 'string'
        ? { type: 'string', data: raw }
        : { type: 'object', data: raw }

    try {
        fs.writeFileSync(getLyricPath(source, id), JSON.stringify(payload), 'utf-8')
    } catch (err) {
        console.error('[LyricCache] Failed to write lyric cache:', err)
    }
}

/** 删除单曲歌词缓存。 */
export function removeCachedLyric(source: string, id: string): void {
    if (!source || !id) return
    try {
        const filePath = getLyricPath(source, id)
        if (fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
    } catch (err) {
        console.error('[LyricCache] Failed to remove lyric cache:', err)
    }
}

/** 清空全部歌词缓存。 */
export function clearLyricCache(): void {
    try {
        const dir = path.join(app.getPath('userData'), LYRIC_DIR_NAME)
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true })
    } catch (err) {
        console.error('[LyricCache] Failed to clear lyric cache:', err)
    }
}

export function getLyricCacheSize(): number {
    const dir = path.join(app.getPath('userData'), LYRIC_DIR_NAME)
    if (!fs.existsSync(dir)) return 0
    let total = 0
    try {
        for (const file of fs.readdirSync(dir)) {
            const stat = fs.statSync(path.join(dir, file))
            if (stat.isFile()) total += stat.size
        }
    } catch (err) {
        console.error('[LyricCache] Failed to calculate lyric cache size:', err)
    }
    return total
}

/** 将字节数格式化为可读字符串。 */
export function formatLyricCacheSize(bytes = getLyricCacheSize()): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/** 为 getLyric 提供缓存包装: 命中直接返回, 未命中调用 loader 并写入缓存。 */
export async function withLyricCache(
    source: string,
    id: string,
    loader: () => Promise<unknown>
): Promise<unknown> {
    const cached = getCachedLyric(source, id)
    if (cached !== null) return cached

    let fetched: unknown
    try {
        fetched = await loader()
    } catch (err) {
        console.error('[LyricCache] Lyric loader failed:', err)
        return null
    }

    if (hasLyricContent(fetched)) {
        setCachedLyric(source, id, fetched)
        return fetched
    }
    return null
}

import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export interface UrlResponse {
    success: boolean
    url?: string
    error?: string
}

type PluginInfo = {
    info?: {
        id?: string
        name?: string
        description?: string
        version?: string | number
    }
    quality?: any[]
    supportFunc?: string[]
    env?: any[]
    ext?: any[]
}

type PluginModule = Record<string, any> & {
    default?: PluginModule
    pluginInfo?: PluginInfo
    info?: PluginInfo['info']
    getUrl?: (...args: any[]) => any
    getLyric?: (...args: any[]) => any
    getPlaylist?: (...args: any[]) => any
    getPlayList?: (...args: any[]) => any
    getAlbum?: (...args: any[]) => any
    musicSearch?: {
        search?: (...args: any[]) => any
    } | ((...args: any[]) => any)
    search?: (...args: any[]) => any
    songList?: Record<string, any>
    album?: Record<string, any>
}

type ModuleCacheEntry = {
    mtimeMs: number
    module: PluginModule
}

const moduleCache = new Map<string, ModuleCacheEntry>()

function getPluginsPath(): string {
    return path.join(app.getPath('userData'), 'plugins')
}

function getPluginEntry(pluginId: string): string {
    return path.join(getPluginsPath(), pluginId, 'index.js')
}

function unwrapModule(rawModule: any): PluginModule {
    if (
        rawModule?.default &&
        typeof rawModule.default === 'object' &&
        (
            rawModule.__esModule ||
            Object.keys(rawModule).length === 1 ||
            rawModule.default.pluginInfo ||
            rawModule.default.getUrl
        )
    ) {
        return rawModule.default
    }
    return rawModule
}

function loadPluginModule(pluginPath: string, forceReload = false): PluginModule {
    const resolvedPath = require.resolve(pluginPath)
    const mtimeMs = fs.statSync(pluginPath).mtimeMs
    const cached = moduleCache.get(resolvedPath)

    if (!forceReload && cached?.mtimeMs === mtimeMs) {
        return cached.module
    }

    delete require.cache[resolvedPath]
    const pluginModule = unwrapModule(require(resolvedPath))
    if (!pluginModule || (typeof pluginModule !== 'object' && typeof pluginModule !== 'function')) {
        throw new Error('Plugin entry must export an object')
    }

    moduleCache.set(resolvedPath, { mtimeMs, module: pluginModule })
    return pluginModule
}

function clearPluginModuleCache(pluginPath: string): void {
    try {
        const resolvedPath = require.resolve(pluginPath)
        moduleCache.delete(resolvedPath)
        delete require.cache[resolvedPath]
    } catch {
        // The module may not have been loaded yet.
    }
}

function getPluginInfo(pluginModule: PluginModule): PluginInfo {
    if (pluginModule.pluginInfo?.info) return pluginModule.pluginInfo
    if (pluginModule.info?.id) return { info: pluginModule.info }
    return {}
}

function getPluginId(pluginModule: PluginModule): string | null {
    const id = getPluginInfo(pluginModule).info?.id
    if (typeof id !== 'string' || !/^[a-z0-9._-]+$/i.test(id)) return null
    return id
}

async function unwrapPluginResult<T = any>(value: any): Promise<T> {
    const resolved = await value
    if (
        resolved &&
        typeof resolved === 'object' &&
        'promise' in resolved &&
        resolved.promise &&
        typeof resolved.promise.then === 'function'
    ) {
        return await resolved.promise
    }
    return resolved as T
}

/**
 * 插件返回的歌曲已是手机端 Music 格式(artists/pic/interval/qualities...),
 * 这里只做最小规整: id/source 字符串化、补默认值, 不做字段重命名。
 */
function normalizeSearchItem(item: any, pluginId: string): any {
    const id = item?.id ?? item?.songmid ?? ''
    const artist = item?.artists ?? item?.singer ?? ''
    const pic = item?.pic ?? item?.img ?? ''
    const qualities = item?.qualities ?? item?.types ?? {}

    return {
        ...item,
        id: String(id),
        artists: Array.isArray(artist) ? artist.join('、') : String(artist),
        source: item?.source || pluginId,
        pic: String(pic),
        sPic: String(item?.sPic ?? pic),
        mPic: String(item?.mPic ?? item?.m_img ?? pic),
        interval: String(item?.interval ?? '--/--'),
        qualities,
    }
}

function normalizeSearchResult(result: any, pluginId: string): any {
    const rawList = Array.isArray(result) ? result : result?.list
    const list = Array.isArray(rawList)
        ? rawList.filter(Boolean).map((item) => normalizeSearchItem(item, pluginId))
        : []

    if (Array.isArray(result)) {
        return {
            list,
            total: list.length,
            allPage: 1,
            limit: list.length,
            source: pluginId,
        }
    }

    return {
        ...result,
        list,
        total: result?.total ?? result?.songCount ?? list.length,
        allPage: result?.allPage ?? 1,
        source: result?.source ?? pluginId,
    }
}

function normalizeSongForApp(item: any, pluginId: string): any {
    // 插件返回已是 Music 格式, normalizeSearchItem 已规整, 直接透传
    return normalizeSearchItem(item, pluginId)
}

function normalizePluginCollection(result: any, pluginId: string, id: string, kind: 'playlist' | 'album'): any {
    const rawList = Array.isArray(result) ? result : result?.list
    const list = Array.isArray(rawList)
        ? rawList.filter(Boolean).map((item) => normalizeSongForApp(item, pluginId))
        : []
    const info = result?.info ?? result ?? {}
    const title = info.name || info.title || (kind === 'album' ? '插件专辑' : '插件歌单')
    const desc = info.desc || info.description || ''
    const img = info.img || info.pic || info.picUrl || info.cover || list[0]?.pic || ''
    const author = info.author || info.artist || info.creator || ''

    return {
        id: String(info.id ?? id),
        scope: 'plugin',
        source: pluginId,
        kind,
        info: {
            id: String(info.id ?? id),
            name: String(title),
            desc: String(desc),
            img: String(img),
            author: String(author),
            play_count: String(info.play_count || info.playCount || ''),
        },
        list,
        total: Number(result?.total ?? info.total ?? list.length) || list.length,
        page: Number(result?.page ?? 1) || 1,
        limit: Number(result?.limit ?? list.length) || list.length,
    }
}

async function callCandidate(candidates: Array<{ target: any; method: string; args: any[] }>): Promise<any> {
    for (const candidate of candidates) {
        const fn = candidate.target?.[candidate.method]
        if (typeof fn !== 'function') continue
        return await unwrapPluginResult(fn.apply(candidate.target, candidate.args))
    }
    throw new Error('Method not found')
}

export class PluginSystem {
    private readonly pluginId: string
    private plugin: PluginModule | null = null

    constructor(pluginId: string) {
        this.pluginId = pluginId
        this.loadPlugin()
    }

    private loadPlugin(): void {
        try {
            const pluginPath = getPluginEntry(this.pluginId)
            if (!fs.existsSync(pluginPath)) {
                throw new Error(`Plugin ${this.pluginId} not found`)
            }
            this.plugin = loadPluginModule(pluginPath)
        } catch (err) {
            console.error(`[PluginSystem] Failed to load ${this.pluginId}:`, err)
            this.plugin = null
        }
    }

    private getRequiredPlugin(): PluginModule {
        if (!this.plugin) {
            throw new Error(`Plugin ${this.pluginId} is unavailable`)
        }
        return this.plugin
    }

    async call(method: string, args: any[] = []): Promise<any> {
        if (method === 'search') {
            return this.search(String(args[0] ?? ''), Number(args[1]) || 1, Number(args[2]) || 30)
        }
        if (method === 'getLyric') {
            return this.getLyric(String(args[0] ?? ''))
        }
        if (method === 'getUrl') {
            return this.getUrl(String(args[0] ?? ''), String(args[1] ?? ''))
        }
        if (method === 'getPlaylist') {
            return this.getPlaylist(String(args[0] ?? ''), Number(args[1]) || 1, Number(args[2]) || 100)
        }
        if (method === 'getAlbum') {
            return this.getAlbum(String(args[0] ?? ''), Number(args[1]) || 1, Number(args[2]) || 100)
        }

        const plugin = this.getRequiredPlugin()
        const target = plugin[method]
        if (typeof target !== 'function') {
            throw new Error(`Method ${method} not found`)
        }
        const result = await unwrapPluginResult(target.apply(plugin, args))
        return Buffer.isBuffer(result) ? result.toString('utf8') : result
    }

    async getUrl(id: string, quality: string): Promise<UrlResponse> {
        try {
            const plugin = this.getRequiredPlugin()
            if (typeof plugin.getUrl !== 'function') {
                return { success: false, error: 'getUrl not implemented' }
            }

            const result = await unwrapPluginResult(plugin.getUrl.call(plugin, id, quality))
            const url = typeof result === 'string' ? result : result?.url

            if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) {
                return { success: false, error: 'Invalid URL returned by plugin' }
            }

            return { success: true, url }
        } catch (err: any) {
            return { success: false, error: err?.message || 'Plugin error' }
        }
    }

    async search(query: string, page: number, limit: number): Promise<any> {
        try {
            const plugin = this.getRequiredPlugin()
            let result: any

            if (plugin.musicSearch && typeof plugin.musicSearch === 'object' && typeof plugin.musicSearch.search === 'function') {
                result = await unwrapPluginResult(
                    plugin.musicSearch.search.call(plugin.musicSearch, query, page, limit),
                )
            } else if (typeof plugin.musicSearch === 'function') {
                result = await unwrapPluginResult(plugin.musicSearch.call(plugin, query, page, limit))
            } else if (typeof plugin.search === 'function') {
                result = await unwrapPluginResult(plugin.search.call(plugin, query, page, limit))
            } else {
                return {
                    list: [],
                    total: 0,
                    allPage: 0,
                    error: 'Search not implemented',
                }
            }

            return normalizeSearchResult(result, this.pluginId)
        } catch (err: any) {
            console.error(`[PluginSystem] Search failed for ${this.pluginId}:`, err)
            return {
                list: [],
                total: 0,
                allPage: 0,
                error: err?.message || 'Search failed',
            }
        }
    }

    async getLyric(id: string): Promise<any> {
        try {
            const plugin = this.getRequiredPlugin()
            if (typeof plugin.getLyric !== 'function') {
                return null
            }

            const result = await unwrapPluginResult(plugin.getLyric.call(plugin, id))
            if (Buffer.isBuffer(result)) return result.toString('utf8')
            return result
        } catch (err) {
            console.error(`[PluginSystem] Failed to get lyric from ${this.pluginId}:`, err)
            return null
        }
    }

    async getPlaylist(id: string, page = 1, limit = 100): Promise<any> {
        const plugin = this.getRequiredPlugin()
        const result = await callCandidate([
            { target: plugin, method: 'getPlaylist', args: [id, page, limit] },
            { target: plugin, method: 'getPlayList', args: [id, page, limit] },
            { target: plugin, method: 'getMusicSheet', args: [id, page, limit] },
            { target: plugin.songList, method: 'getListDetail', args: [id, page, limit] },
            { target: plugin.songList, method: 'getPlaylistDetail', args: [id, page, limit] },
        ])
        return normalizePluginCollection(result, this.pluginId, id, 'playlist')
    }

    async getAlbum(id: string, page = 1, limit = 100): Promise<any> {
        const plugin = this.getRequiredPlugin()
        const result = await callCandidate([
            { target: plugin, method: 'getAlbum', args: [id, page, limit] },
            { target: plugin, method: 'getMusicAlbum', args: [id, page, limit] },
            { target: plugin.album, method: 'getListDetail', args: [id, page, limit] },
            { target: plugin.songList, method: 'getAlbumDetail', args: [id, page, limit] },
        ])
        return normalizePluginCollection(result, this.pluginId, id, 'album')
    }

    static getAllPlugins(): any[] {
        const pluginsPath = getPluginsPath()
        if (!fs.existsSync(pluginsPath)) return []

        try {
            return fs.readdirSync(pluginsPath, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => {
                    const pluginPath = getPluginEntry(entry.name)
                    if (!fs.existsSync(pluginPath)) return null

                    try {
                        const pluginModule = loadPluginModule(pluginPath)
                        const pluginInfo = getPluginInfo(pluginModule)
                        const info = pluginInfo.info

                        return {
                            id: info?.id || entry.name,
                            name: info?.name || info?.id || entry.name,
                            description: info?.description || 'No description',
                            version: info?.version || '0.0.0',
                            quality: pluginInfo.quality || [],
                            supportFunc: pluginInfo.supportFunc || [],
                            _path: entry.name,
                        }
                    } catch (err) {
                        console.error(`[PluginSystem] Failed to inspect ${entry.name}:`, err)
                        return null
                    }
                })
                .filter((plugin) => plugin !== null)
        } catch (err) {
            console.error('[PluginSystem] Failed to enumerate plugins:', err)
            return []
        }
    }

    static async installPlugin(filePath: string): Promise<{
        success: boolean
        message: string
        pluginId?: string
        updated?: boolean
    }> {
        if (path.extname(filePath).toLowerCase() !== '.js') {
            return { success: false, message: 'Only bundled JavaScript plugin files are supported' }
        }

        const tempRoot = path.join(app.getPath('userData'), 'temp_plugins')
        const tempDir = path.join(tempRoot, `install_${Date.now()}_${Math.random().toString(36).slice(2)}`)
        const tempFile = path.join(tempDir, 'index.js')

        try {
            fs.mkdirSync(tempDir, { recursive: true })
            fs.copyFileSync(filePath, tempFile)

            const pluginModule = loadPluginModule(tempFile, true)
            const pluginId = getPluginId(pluginModule)
            if (!pluginId) {
                return {
                    success: false,
                    message: 'Plugin must export pluginInfo.info.id or info.id',
                }
            }

            const targetDir = path.join(getPluginsPath(), pluginId)
            const targetFile = path.join(targetDir, 'index.js')
            const stagedFile = path.join(targetDir, 'index.js.new')
            const isUpdate = fs.existsSync(targetFile)

            fs.mkdirSync(targetDir, { recursive: true })
            fs.copyFileSync(tempFile, stagedFile)
            clearPluginModuleCache(targetFile)
            removeFileIfExists(targetFile)
            fs.renameSync(stagedFile, targetFile)

            return {
                success: true,
                message: isUpdate ? `Plugin ${pluginId} updated` : `Plugin ${pluginId} installed`,
                pluginId,
                updated: isUpdate,
            }
        } catch (err: any) {
            console.error('[PluginSystem] Install failed:', err)
            return { success: false, message: err?.message || 'Plugin installation failed' }
        } finally {
            clearPluginModuleCache(tempFile)
            try {
                fs.rmSync(tempDir, { recursive: true, force: true })
            } catch {
                // Best-effort cleanup.
            }
        }
    }

    static uninstallPlugin(id: string): boolean {
        if (!/^[a-z0-9._-]+$/i.test(id)) return false

        const pluginPath = getPluginEntry(id)
        const pluginDir = path.dirname(pluginPath)
        try {
            clearPluginModuleCache(pluginPath)
            if (!fs.existsSync(pluginDir)) return false
            fs.rmSync(pluginDir, { recursive: true, force: true })
            return true
        } catch (err) {
            console.error(`[PluginSystem] Failed to uninstall ${id}:`, err)
            return false
        }
    }
}

function removeFileIfExists(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    } catch {
        // The caller will surface a later copy/rename failure with more context.
    }
}

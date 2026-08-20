import { app, BrowserWindow, Menu, ipcMain, dialog, powerSaveBlocker } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { QzpController } from './qzpController'
import { startProxyServer, cleanupCache, getCacheDir, getCacheSize, setPersistCache, clearCacheNow, refreshCacheDir } from './proxyServer'
import { PluginSystem } from './pluginSystem'
import { loadSettings, saveSettings, getSetting, AppSettings, BassSourceState, AudioOutputConfig } from './settingsStore'
import {
    acceptAuthCallback,
    cancelQrLoginSession,
    clearAuthState,
    createQrLoginSession,
    getLibraryPrivacy,
    getListenTogetherWsUrl,
    getListenRank,
    getValidAccessToken,
    getListenTime,
    getListenTimeRange,
    getUserProfile,
    getUserPublicFavSongs,
    getUserPublicPlaylists,
    loadAuthState,
    openLoginPage,
    pollQrLoginSession,
    refreshAuthState,
    sendPcHeartbeat,
    setLibraryPrivacy,
    updateCurrentUserProfile,
    uploadImage,
    getRecentSongs,
    addRecentSong,
    getFavoritePlaylists,
    collectPlaylist,
    uncollectPlaylist,
    toggleUserFollow,
    getUserSubscriptions,
    type AuthCallbackPayload,
} from './authStore'
import {
    addSong,
    copyPlaylistToLocal,
    convertPlaylistScope,
    createPlaylist,
    deletePlaylist as deleteStoredPlaylist,
    exportPlaylist,
    getPlaylist,
    importPlaylist,
    listCloudPlaylists,
    listLocalPlaylists,
    listPublicPlaylists,
    removeSong,
    updatePlaylist,
    type PlaylistScope,
} from './playlistStore'
import {
    clearMissingLocalSongs,
    getLocalMusicLibrary,
    removeLocalSong,
    scanLocalMusic,
    setLocalMusicRoots,
} from './localMusicStore'

// @ts-ignore
const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

path.join(process.env.APP_ROOT, 'out/main');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'out/renderer')

process.env.VITE_PUBLIC = process.env.ELECTRON_RENDERER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let qzplayer: QzpController | null

function notifyPluginsChanged(action: 'installed' | 'updated' | 'uninstalled', pluginId?: string): void {
    win?.webContents.send('plugin:changed', { action, pluginId })
}

const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
    app.quit()
}

function decodeAuthCallback(url: string): AuthCallbackPayload | null {
    try {
        const parsed = new URL(url)
        if (parsed.protocol !== 'qzmusic:' || parsed.hostname !== 'auth_result') return null
        const hexData = parsed.searchParams.get('data')
        if (!hexData) return null
        const jsonText = Buffer.from(hexData, 'hex').toString('utf8')
        return JSON.parse(jsonText)
    } catch (err) {
        console.error('[Auth] Failed to decode callback:', err)
        return null
    }
}

function handleAuthCallback(url: string): void {
    const payload = decodeAuthCallback(url)
    if (!payload) return

    try {
        const state = acceptAuthCallback(payload)
        win?.webContents.send('auth:changed', { status: 'success', state })
    } catch (err: any) {
        win?.webContents.send('auth:changed', {
            status: 'error',
            message: err?.message || 'Login failed',
            state: loadAuthState(),
        })
    }
    if (win?.isMinimized()) win.restore()
    win?.focus()
}

if (process.defaultApp) {
    if (process.argv.length >= 2) {
        app.setAsDefaultProtocolClient('qzmusic', process.execPath, [path.resolve(process.argv[1])])
    }
} else {
    app.setAsDefaultProtocolClient('qzmusic')
}

app.on('second-instance', (_event, argv) => {
    const callbackUrl = argv.find((arg) => arg.startsWith('qzmusic://auth_result'))
    if (callbackUrl) handleAuthCallback(callbackUrl)
    if (win) {
        if (win.isMinimized()) win.restore()
        win.focus()
    }
})

app.on('open-url', (event, url) => {
    event.preventDefault()
    handleAuthCallback(url)
})

// === Electron 窗口逻辑 ===

function createWindow() {
    win = new BrowserWindow({
        frame: false,
        minWidth: 950,
        minHeight: 800,
        width: 1000,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload/index.js'),
            sandbox: false,
            contextIsolation: true,
            webSecurity: false
        }
    })

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    // electron-vite sets ELECTRON_RENDERER_URL in dev mode
    if (process.env.ELECTRON_RENDERER_URL) {
        win.loadURL(process.env.ELECTRON_RENDERER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
    if (!app.isPackaged) {
        win.webContents.openDevTools();
    }
    registerZoomShortcuts(win)
}

// === IPC 监听 ===

ipcMain.on('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
ipcMain.on('window-maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize())
ipcMain.on('window-close', () => win?.close())
ipcMain.handle('window-is-maximized', () => win?.isMaximized() || false)
ipcMain.handle('window-toggle-fullscreen', () => {
    if (!win) return false
    win.setFullScreen(!win.isFullScreen())
    return win.isFullScreen()
})
ipcMain.handle('window:setProgressBar', (_event, progress: number, mode: 'normal' | 'paused' = 'normal') => {
    if (!win) return false
    const value = Number(progress)
    if (!Number.isFinite(value) || value < 0) {
        win.setProgressBar(-1)
        return true
    }
    win.setProgressBar(Math.max(0, Math.min(1, value)), { mode })
    return true
})

// --- 后台保活: 播放时阻止系统休眠/息屏, 避免黑屏后音频中断 ---
let keepAwakeId: number | null = null
ipcMain.handle('app:setKeepAwake', (_event, playing: boolean) => {
    try {
        if (playing && keepAwakeId === null) {
            keepAwakeId = powerSaveBlocker.start('prevent-display-sleep')
        } else if (!playing && keepAwakeId !== null) {
            powerSaveBlocker.stop(keepAwakeId)
            keepAwakeId = null
        }
    } catch (err) {
        console.warn('[KeepAwake] failed:', err)
    }
    return true
})
app.on('before-quit', () => {
    if (keepAwakeId !== null) {
        try { powerSaveBlocker.stop(keepAwakeId) } catch {}
        keepAwakeId = null
    }
})

// --- qzplayer IPC Handlers ---

// 低音增强预设 (满档 amount=100)。普通模式按 amount 线性缩放 gain/drive/mix。
const BASS_PRESETS = {
    speaker:   { crossover: 90,  gain: 3.5, drive: 10, exciter: true,  mix: 18, release: 250 }, // 心理声学: 干声82%(湿18%)
    headphone: { crossover: 100, gain: 8,   drive: 0,  exciter: false, mix: 70, release: 150 }, // 真实加成: 无激励
} as const

// 由源状态(普通/高级)算出下发给 C 核心的绝对参数
function computeBassConfig(s: BassSourceState): Record<string, unknown> {
    const enabled = s.enabled ? 1 : 0
    if (s.advanced) {
        return {
            enabled,
            exciter: s.exciter ? 1 : 0,
            crossover: s.crossover,
            gain: s.gain,
            drive: s.drive,
            mix: s.mix / 100,
            release: s.release,
        }
    }
    const p = BASS_PRESETS[s.mode]
    // 普通模式: 直接用预设满档值
    return {
        enabled,
        exciter: p.exciter ? 1 : 0,
        crossover: p.crossover,
        gain: p.gain,
        drive: p.drive,
        mix: p.mix / 100,
        release: p.release,
    }
}

ipcMain.handle('qzplayer-command', async (_, command: any[]) => {
    if (qzplayer) {
        qzplayer.send(command)
    }
})

// Quick Helpers
ipcMain.handle('qzplayer-load', (_, url) => qzplayer?.load(url))
ipcMain.handle('qzplayer-play', () => qzplayer?.play())
ipcMain.handle('qzplayer-pause', () => qzplayer?.pause())
ipcMain.handle('qzplayer-toggle-pause', () => qzplayer?.togglePause())
ipcMain.handle('qzplayer-stop', () => qzplayer?.stop())
ipcMain.handle('qzplayer-set-volume', (_, vol) => qzplayer?.setVolume(vol))
ipcMain.handle('qzplayer-set-bass-config', (_, source: BassSourceState) => {
    const effective = computeBassConfig(source)
    return qzplayer?.setBassConfig(effective)
})
ipcMain.handle('qzplayer-seek', (_, time) => qzplayer?.seek(time))

// PluginSystem
ipcMain.handle(
    'plugin:call',
    async (_event, pluginId: string, method: string, args: any[]) => {
        const plugin = new PluginSystem(pluginId)
        try {
            return await plugin.call(method, args)
        } catch (err: any) {
            return {
                success: false,
                error: err?.message || `Method ${method} failed`
            }
        }
    }
)

ipcMain.handle('plugin:getAll', () => {
    return PluginSystem.getAllPlugins()
})

ipcMain.handle('plugin:getPlaylist', async (_event, pluginId: string, id: string, page = 1, limit = 100) => {
    const plugin = new PluginSystem(pluginId)
    return plugin.getPlaylist(id, page, limit)
})

ipcMain.handle('plugin:getAlbum', async (_event, pluginId: string, id: string, page = 1, limit = 100) => {
    const plugin = new PluginSystem(pluginId)
    return plugin.getAlbum(id, page, limit)
})

ipcMain.handle('plugin:uninstall', (_, id: string) => {
    const success = PluginSystem.uninstallPlugin(id)
    if (success) notifyPluginsChanged('uninstalled', id)
    return success
})

ipcMain.handle('plugin:install', async () => {
    if (!win) return { success: false, message: 'Window is unavailable' }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: '选择插件文件',
        filters: [{ name: 'Bundled JavaScript Plugin', extensions: ['js'] }],
        properties: ['openFile']
    })

    if (canceled || filePaths.length === 0) {
        return { success: false, message: 'canceled' }
    }

    const result = await PluginSystem.installPlugin(filePaths[0])
    if (result.success) {
        notifyPluginsChanged(result.updated ? 'updated' : 'installed', result.pluginId)
    }
    return result
})

// Auth IPC Handlers
ipcMain.handle('auth:getState', () => loadAuthState())
ipcMain.handle('auth:getAccessToken', () => getValidAccessToken())
ipcMain.handle('listenTogether:getWsUrl', async (_event, params: Record<string, string>) => {
    const token = await getValidAccessToken()
    return getListenTogetherWsUrl({ token, ...params })
})
ipcMain.handle('auth:login', (_event, forcePrompt = false) => openLoginPage(Boolean(forcePrompt)))
ipcMain.handle('auth:qr:create', () => createQrLoginSession())
ipcMain.handle('auth:qr:poll', async (_event, sessionId: string, pollToken: string) => {
    const result = await pollQrLoginSession(String(sessionId), String(pollToken))
    if (result.status === 'success' && result.state) {
        win?.webContents.send('auth:changed', { status: 'success', state: result.state })
    }
    return result
})
ipcMain.handle('auth:qr:cancel', (_event, sessionId: string, pollToken: string) => {
    return cancelQrLoginSession(String(sessionId), String(pollToken))
})
ipcMain.handle('auth:refresh', () => refreshAuthState())
ipcMain.handle('auth:logout', () => {
    const state = clearAuthState()
    win?.webContents.send('auth:changed', { status: 'logout', state })
    return state
})

ipcMain.handle('privacy:getLibrary', () => getLibraryPrivacy())
ipcMain.handle('privacy:setLibrary', (_event, payload: { allow_public_library?: boolean; allow_public_profile?: boolean; allow_public_following?: boolean }) => {
    return setLibraryPrivacy({
        allow_public_library: typeof payload?.allow_public_library === 'boolean' ? payload.allow_public_library : undefined,
        allow_public_profile: typeof payload?.allow_public_profile === 'boolean' ? payload.allow_public_profile : undefined,
        allow_public_following: typeof payload?.allow_public_following === 'boolean' ? payload.allow_public_following : undefined,
    })
})

ipcMain.handle('user:getProfile', (_event, userId: string) => {
    return getUserProfile(String(userId || ''))
})
ipcMain.handle('user:getPlaylists', (_event, userId: string) => {
    return getUserPublicPlaylists(String(userId || ''))
})
ipcMain.handle('user:getFavSongs', (_event, userId: string) => {
    return getUserPublicFavSongs(String(userId || ''))
})
ipcMain.handle('user:updateProfile', (_event, payload: any) => {
    return updateCurrentUserProfile(payload || {})
})

// Recent Plays
ipcMain.handle('user:getRecentSongs', (_event, userId: string) => {
    return getRecentSongs(String(userId || ''))
})
ipcMain.handle('user:addRecentSong', (_event, userId: string, song: any) => {
    return addRecentSong(String(userId || ''), song || {})
})

// Favorite Playlists
ipcMain.handle('playlist:getFavorites', () => getFavoritePlaylists())
ipcMain.handle('playlist:collect', (_event, playlistId: string, source = '') => {
    return collectPlaylist(String(playlistId || ''), String(source || ''))
})
ipcMain.handle('playlist:uncollect', (_event, playlistId: string, source = '') => {
    return uncollectPlaylist(String(playlistId || ''), String(source || ''))
})

// User Follow
ipcMain.handle('user:toggleFollow', (_event, targetUserId: string) => {
    return toggleUserFollow(String(targetUserId || ''))
})
ipcMain.handle('user:getSubscriptions', (_event, targetUserId: string) => {
    return getUserSubscriptions(String(targetUserId || ''))
})

ipcMain.handle('heartbeat:pc', (_event, duration: number, timestamp?: number) => {
    return sendPcHeartbeat(duration, timestamp)
})

ipcMain.handle('stats:listenTime', (_event, detail = 1, userId?: string) => {
    return getListenTime(Number(detail) || 0, userId)
})

ipcMain.handle('stats:listenRange', (_event, start: string, end: string, userId?: string) => {
    return getListenTimeRange(String(start), String(end), userId)
})

ipcMain.handle('stats:listenRank', (_event, period: 'week' | 'month' | 'year' = 'week', limit = 200) => {
    return getListenRank(period, Number(limit) || 200)
})

// Playlist IPC Handlers
ipcMain.handle('playlist:list', async () => {
    const local = listLocalPlaylists()
    const cloud = await listCloudPlaylists().catch((err) => {
        console.error('[Playlist] Failed to load cloud playlists:', err)
        return []
    })
    return { local, cloud, items: [...local, ...cloud] }
})

ipcMain.handle('playlist:publicList', (_event, search = '', sort = 'visit', page = 1, limit = 50) => {
    return listPublicPlaylists(String(search || ''), String(sort || 'visit'), Number(page) || 1, Number(limit) || 50)
})

ipcMain.handle('playlist:get', (_event, scope: PlaylistScope, id: string, recordVisit = true) => {
    return getPlaylist(scope, id, Boolean(recordVisit))
})

ipcMain.handle('playlist:create', (_event, scope: PlaylistScope, data: { name: string; desc?: string; is_public?: boolean }) => {
    return createPlaylist(scope, data)
})

ipcMain.handle('playlist:update', (_event, scope: PlaylistScope, id: string, info: any) => {
    return updatePlaylist(scope, id, info)
})

ipcMain.handle('playlist:delete', (_event, scope: PlaylistScope, id: string) => {
    return deleteStoredPlaylist(scope, id)
})

ipcMain.handle('playlist:addSong', (_event, scope: PlaylistScope, id: string, song: any, index = -1) => {
    return addSong(scope, id, song, index)
})

ipcMain.handle('playlist:removeSong', (_event, scope: PlaylistScope, id: string, index: number) => {
    return removeSong(scope, id, index)
})

ipcMain.handle('playlist:export', async (_event, scope: PlaylistScope, id: string) => {
    if (!win) return { success: false, canceled: true }
    const playlist = await getPlaylist(scope, id)
    const safeName = (playlist.info.name || 'playlist').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '导出歌单',
        defaultPath: `${safeName}.qzplaylist.json`,
        filters: [
            { name: 'QZMusic Playlist', extensions: ['json'] },
            { name: 'JSON', extensions: ['json'] },
        ],
    })
    if (canceled || !filePath) return { success: false, canceled: true }
    return exportPlaylist(scope, id, filePath)
})

ipcMain.handle('playlist:import', async () => {
    if (!win) return { success: false, canceled: true }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: '导入歌单',
        properties: ['openFile'],
        filters: [
            { name: 'QZMusic Playlist', extensions: ['json'] },
            { name: 'JSON', extensions: ['json'] },
        ],
    })
    if (canceled || filePaths.length === 0) return { success: false, canceled: true }
    const playlist = importPlaylist(filePaths[0])
    return { success: true, playlist }
})

ipcMain.handle('playlist:convertScope', (_event, scope: PlaylistScope, id: string, targetScope: PlaylistScope) => {
    return convertPlaylistScope(scope, id, targetScope)
})

ipcMain.handle('playlist:copyToLocal', (_event, scope: PlaylistScope, id: string) => {
    return copyPlaylistToLocal(scope, id)
})

ipcMain.handle('image:selectAndUpload', async () => {
    if (!win) return { success: false, canceled: true }
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: '选择图片',
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif'] },
        ],
    })
    if (canceled || filePaths.length === 0) return { success: false, canceled: true }
    return uploadImage(filePaths[0])
})

// Cache IPC Handlers
ipcMain.handle('cache:getInfo', () => {
    const settings = loadSettings();
    return {
        path: settings.cachePath || getCacheDir(), // Use setting or fallback
        size: getCacheSize(),
        persistCache: settings.persistCache
    }
})

ipcMain.handle('cache:setPersist', (_, persist: boolean) => {
    setPersistCache(persist)
    saveSettings({ persistCache: persist })
})

ipcMain.handle('cache:openFolder', () => {
    const settings = loadSettings()
    const dir = settings.cachePath || getCacheDir()
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    require('electron').shell.openPath(dir)
})

ipcMain.handle('cache:clear', () => {
    clearCacheNow()
})

ipcMain.handle('dialog:openDirectory', async () => {
    if (!win) return null
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: 'Select Cache Directory',
        properties: ['openDirectory', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
})

ipcMain.handle('dialog:openDirectories', async () => {
    if (!win) return []
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
        title: '选择音乐文件夹',
        properties: ['openDirectory', 'multiSelections', 'createDirectory']
    })
    if (canceled || filePaths.length === 0) return []
    return filePaths
})

ipcMain.handle('localMusic:getLibrary', () => {
    return getLocalMusicLibrary()
})

ipcMain.handle('localMusic:scan', async (_event, roots: string[]) => {
    return scanLocalMusic(Array.isArray(roots) ? roots : [])
})

ipcMain.handle('localMusic:setRoots', (_event, roots: string[]) => {
    return setLocalMusicRoots(Array.isArray(roots) ? roots : [])
})

ipcMain.handle('localMusic:remove', (_event, id: string) => {
    return removeLocalSong(id)
})

ipcMain.handle('localMusic:clearMissing', () => {
    return clearMissingLocalSongs()
})

ipcMain.handle('cache:changeLocation', async (_, newPath: string) => {
    try {
        const settings = loadSettings()
        const oldPath = settings.cachePath || getCacheDir()

        if (oldPath === newPath) {
            return { success: true, message: 'Path is the same' }
        }

        // 1. Check permissions / Create new dir
        if (!fs.existsSync(newPath)) {
            try {
                fs.mkdirSync(newPath, { recursive: true })
            } catch (e) {
                return { success: false, message: 'Cannot create directory' }
            }
        }

        // 2. Migration: Move files from oldPath to newPath
        // We only move files if old path exists
        if (fs.existsSync(oldPath)) {
            try {
                const files = fs.readdirSync(oldPath);
                for (const file of files) {
                    const src = path.join(oldPath, file);
                    const dest = path.join(newPath, file);
                    // Copy then delete to be safe, or rename
                    // Simple rename might fail across partitions, so verify

                    try {
                        fs.renameSync(src, dest);
                    } catch (moveErr) {
                        // Fallback to copy and unlink if rename fails (e.g. cross-drive)
                        fs.copyFileSync(src, dest);
                        fs.unlinkSync(src);
                    }
                }
                // Try to remove old dir if empty
                try { fs.rmdirSync(oldPath); } catch (_) { }
            } catch (e) {
                console.error("[Cache] Migration failed partially:", e)
                // Continue anyway to set the new path? 
                // Better to warn user. But let's assume we proceed and just log.
            }
        }

        saveSettings({ cachePath: newPath })
        refreshCacheDir()

        return { success: true, message: 'Cache location updated', path: newPath }
    } catch (e: any) {
        return { success: false, message: e.message || 'Unknown error' }
    }
})


// Settings IPC Handlers
ipcMain.handle('settings:getAll', () => {
    return loadSettings()
})

ipcMain.handle('settings:set', (_, settings: Partial<AppSettings>) => {
    return saveSettings(settings)
})

ipcMain.handle('settings:getTheme', () => {
    return getSetting('theme')
})

ipcMain.handle('settings:setTheme', (_, theme: 'dark' | 'light') => {
    saveSettings({ theme })
})

ipcMain.handle('settings:getAccentColor', () => {
    return getSetting('accentColor')
})

ipcMain.handle('settings:setAccentColor', (_, color: string) => {
    saveSettings({ accentColor: color })
})

// --- Audio Output (独占模式 + 设备选择) ---
ipcMain.handle('audio:getDevices', async () => {
    if (qzplayer) {
        await qzplayer.getAudioDevices()
        // 响应会通过 event 返回
    }
})

ipcMain.handle('audio:setDevice', async (_event, deviceId: string | null, exclusive: boolean) => {
    const settings = loadSettings()
    const audioOutput: AudioOutputConfig = {
        ...settings.audioOutput,
        deviceId: deviceId || null,
        exclusive,
    }
    saveSettings({ audioOutput })
    if (qzplayer) {
        await qzplayer.setAudioDevice(deviceId, exclusive)
    }
})

ipcMain.handle('audio:getChain', async () => {
    if (qzplayer) {
        await qzplayer.getPlaybackChain()
    }
})

ipcMain.handle('audio:getLog', async (_event, maxCount?: number) => {
    if (qzplayer) {
        await qzplayer.getAudioLog(maxCount || 50)
    }
})

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('will-quit', () => {
    cleanupCache()
    if (qzplayer) {
        qzplayer.destroy()
    }
})

function registerZoomShortcuts(win: BrowserWindow) {
    win.webContents.on('before-input-event', (event, input) => {
        if (input.key === 'F11') {
            win.setFullScreen(!win.isFullScreen())
            event.preventDefault()
            return
        }

        if (input.control || input.meta) {
            if (input.key.toLowerCase() === '=' || input.key === '+') {
                let currentZoom = win.webContents.getZoomFactor();
                win.webContents.setZoomFactor(currentZoom + 0.1);
                event.preventDefault();
            } else if (input.key === '-' || input.key === '_') {
                let currentZoom = win.webContents.getZoomFactor();
                // Limit minimum zoom to avoid making it too small to see
                if (currentZoom > 0.5) {
                    win.webContents.setZoomFactor(currentZoom - 0.1);
                }
                event.preventDefault();
            } else if (input.key === '0') {
                win.webContents.setZoomFactor(1);
                event.preventDefault();
            }
        }
    });
}

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Test
app.whenReady().then(() => {
    // Ensure plugins directory exists
    const pluginsPath = path.join(app.getPath('userData'), 'plugins')
    if (!fs.existsSync(pluginsPath)) {
        fs.mkdirSync(pluginsPath, { recursive: true })
    }
    // ----------------------------------------
    Menu.setApplicationMenu(null)
    createWindow()

    const callbackUrl = process.argv.find((arg) => arg.startsWith('qzmusic://auth_result'))
    if (callbackUrl) handleAuthCallback(callbackUrl)

    // Start Proxy Server
    startProxyServer()

    // Start qzplayer
    qzplayer = new QzpController()
    const initialSettings = loadSettings()
    qzplayer.setBassConfig(computeBassConfig(initialSettings.bass))
    qzplayer.start()

    // 初始化音频输出设备设置
    if (initialSettings.audioOutput) {
        const ao = initialSettings.audioOutput
        if (ao.deviceId || ao.exclusive) {
            // 延迟一下等设备初始化完成
            setTimeout(() => {
                qzplayer?.setAudioDevice(ao.deviceId, ao.exclusive)
            }, 2000)
        }
    }

    qzplayer.on('event', (data) => {
        // Forward qzplayer events to Render Process
        if (win && !win.isDestroyed()) {
            win.webContents.send('qzplayer-event', data)
        }
    })
})

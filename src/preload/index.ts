import { contextBridge, ipcRenderer } from 'electron'

const toPlainStringArray = (value: unknown): string[] => {
    if (!Array.isArray(value)) return []
    return value.map((item) => String(item)).filter(Boolean)
}

const toCloneableObject = (value: unknown): any => {
    try {
        return JSON.parse(JSON.stringify(value ?? {}))
    } catch {
        return {}
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),
    setTaskbarProgress: (progress: number, mode: 'normal' | 'paused' = 'normal') => ipcRenderer.invoke('window:setProgressBar', progress, mode),
    setKeepAwake: (playing: boolean) => ipcRenderer.invoke('app:setKeepAwake', playing),

    // qzplayer Control
    qzplayer: {
        load: (url: string) => ipcRenderer.invoke('qzplayer-load', url),
        play: () => ipcRenderer.invoke('qzplayer-play'),
        pause: () => ipcRenderer.invoke('qzplayer-pause'),
        togglePause: () => ipcRenderer.invoke('qzplayer-toggle-pause'),
        stop: () => ipcRenderer.invoke('qzplayer-stop'),
        setVolume: (vol: number) => ipcRenderer.invoke('qzplayer-set-volume', vol),
        setBassConfig: (source: any) => ipcRenderer.invoke('qzplayer-set-bass-config', source),
        seek: (time: number) => ipcRenderer.invoke('qzplayer-seek', time),
        onEvent: (callback: (event: any, data: any) => void) => ipcRenderer.on('qzplayer-event', callback)
    },

    // Plugin System
    plugin: {
        call: (pluginId: string, method: string, args: any[]) => ipcRenderer.invoke('plugin:call', pluginId, method, args),
        search: (pluginId: string, query: string, page: number, limit: number) => ipcRenderer.invoke('plugin:call', pluginId, 'search', [query, page, limit]),
        getLyric: (pluginId: string, id: string) => ipcRenderer.invoke('plugin:call', pluginId, 'getLyric', [id]),
        getPlaylist: (pluginId: string, id: string, page = 1, limit = 100) => ipcRenderer.invoke('plugin:getPlaylist', pluginId, id, page, limit),
        getAlbum: (pluginId: string, id: string, page = 1, limit = 100) => ipcRenderer.invoke('plugin:getAlbum', pluginId, id, page, limit),
        getAll: () => ipcRenderer.invoke('plugin:getAll'),
        uninstall: (id: string) => ipcRenderer.invoke('plugin:uninstall', id),
        install: () => ipcRenderer.invoke('plugin:install'),
        onChanged: (callback: (change: { action: string; pluginId?: string }) => void) => {
            const listener = (
                _event: Electron.IpcRendererEvent,
                change: { action: string; pluginId?: string },
            ) => callback(change)
            ipcRenderer.on('plugin:changed', listener)
            return () => ipcRenderer.removeListener('plugin:changed', listener)
        },
    },

    auth: {
        getState: () => ipcRenderer.invoke('auth:getState'),
        getAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
        login: (forcePrompt = false) => ipcRenderer.invoke('auth:login', forcePrompt),
        qrCreate: () => ipcRenderer.invoke('auth:qr:create'),
        qrPoll: (sessionId: string, pollToken: string) => ipcRenderer.invoke('auth:qr:poll', sessionId, pollToken),
        qrCancel: (sessionId: string, pollToken: string) => ipcRenderer.invoke('auth:qr:cancel', sessionId, pollToken),
        refresh: () => ipcRenderer.invoke('auth:refresh'),
        logout: () => ipcRenderer.invoke('auth:logout'),
        onChanged: (callback: (payload: any) => void) => {
            const listener = (_event: Electron.IpcRendererEvent, payload: any) => callback(payload)
            ipcRenderer.on('auth:changed', listener)
            return () => ipcRenderer.removeListener('auth:changed', listener)
        },
    },

    listenTogether: {
        getWsUrl: (params: Record<string, string>) => ipcRenderer.invoke('listenTogether:getWsUrl', params),
    },

    heartbeat: {
        sendPc: (duration: number, timestamp?: number) => ipcRenderer.invoke('heartbeat:pc', duration, timestamp),
    },

    stats: {
        getListenTime: (detail = 1, userId?: string) => ipcRenderer.invoke('stats:listenTime', detail, userId),
        getListenRange: (start: string, end: string, userId?: string) => ipcRenderer.invoke('stats:listenRange', start, end, userId),
        getListenRank: (period: 'week' | 'month' | 'year' = 'week', limit = 200) => ipcRenderer.invoke('stats:listenRank', period, limit),
    },

    playlist: {
        list: () => ipcRenderer.invoke('playlist:list'),
        publicList: (search = '', sort = 'visit', page = 1, limit = 50) => ipcRenderer.invoke('playlist:publicList', search, sort, page, limit),
        get: (scope: 'local' | 'cloud', id: string) => ipcRenderer.invoke('playlist:get', scope, id),
        create: (scope: 'local' | 'cloud', data: { name: string; desc?: string; is_public?: boolean }) => ipcRenderer.invoke('playlist:create', scope, data),
        update: (scope: 'local' | 'cloud', id: string, info: any) => ipcRenderer.invoke('playlist:update', scope, id, info),
        delete: (scope: 'local' | 'cloud', id: string) => ipcRenderer.invoke('playlist:delete', scope, id),
        addSong: (scope: 'local' | 'cloud', id: string, song: any, index = -1) => ipcRenderer.invoke('playlist:addSong', scope, id, toCloneableObject(song), index),
        removeSong: (scope: 'local' | 'cloud', id: string, index: number) => ipcRenderer.invoke('playlist:removeSong', scope, id, index),
        export: (scope: 'local' | 'cloud', id: string) => ipcRenderer.invoke('playlist:export', scope, id),
        import: () => ipcRenderer.invoke('playlist:import'),
        convertScope: (scope: 'local' | 'cloud', id: string, targetScope: 'local' | 'cloud') => ipcRenderer.invoke('playlist:convertScope', scope, id, targetScope),
        copyToLocal: (scope: 'local' | 'cloud', id: string) => ipcRenderer.invoke('playlist:copyToLocal', scope, id),
        toggleLike: (playlistId: string) => ipcRenderer.invoke('playlist:toggleLike', playlistId),
        getLike: (playlistId: string) => ipcRenderer.invoke('playlist:getLike', playlistId),
    },

    image: {
        selectAndUpload: () => ipcRenderer.invoke('image:selectAndUpload'),
    },

    privacy: {
        getLibrary: () => ipcRenderer.invoke('privacy:getLibrary'),
        setLibrary: (payload: { allow_public_library?: boolean; allow_public_profile?: boolean; allow_public_following?: boolean }) => ipcRenderer.invoke('privacy:setLibrary', toCloneableObject(payload)),
    },

    user: {
        getProfile: (userId: string) => ipcRenderer.invoke('user:getProfile', userId),
        getPlaylists: (userId: string) => ipcRenderer.invoke('user:getPlaylists', userId),
        getFavSongs: (userId: string) => ipcRenderer.invoke('user:getFavSongs', userId),
        updateProfile: (payload: any) => ipcRenderer.invoke('user:updateProfile', toCloneableObject(payload)),
        getRecentSongs: (userId: string) => ipcRenderer.invoke('user:getRecentSongs', userId),
        addRecentSong: (userId: string, song: any) => ipcRenderer.invoke('user:addRecentSong', userId, toCloneableObject(song)),
        toggleFollow: (targetUserId: string) => ipcRenderer.invoke('user:toggleFollow', targetUserId),
        getSubscriptions: (targetUserId: string) => ipcRenderer.invoke('user:getSubscriptions', targetUserId),
    },

    // Cache Control
    getCacheInfo: () => ipcRenderer.invoke('cache:getInfo'),
    setCachePersist: (persist: boolean) => ipcRenderer.invoke('cache:setPersist', persist),
    openCacheFolder: () => ipcRenderer.invoke('cache:openFolder'),
    clearCache: () => ipcRenderer.invoke('cache:clear'),
    changeCacheLocation: (newPath: string) => ipcRenderer.invoke('cache:changeLocation', newPath),
    selectDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
    selectDirectories: () => ipcRenderer.invoke('dialog:openDirectories'),

    localMusic: {
        getLibrary: () => ipcRenderer.invoke('localMusic:getLibrary'),
        scan: (roots: string[]) => ipcRenderer.invoke('localMusic:scan', toPlainStringArray(roots)),
        setRoots: (roots: string[]) => ipcRenderer.invoke('localMusic:setRoots', toPlainStringArray(roots)),
        remove: (id: string) => ipcRenderer.invoke('localMusic:remove', String(id)),
        clearMissing: () => ipcRenderer.invoke('localMusic:clearMissing'),
    },

    // Settings
    settings: {
        getAll: () => ipcRenderer.invoke('settings:getAll'),
        set: (settings: any) => ipcRenderer.invoke('settings:set', settings),
        getTheme: () => ipcRenderer.invoke('settings:getTheme'),
        setTheme: (theme: 'dark' | 'light') => ipcRenderer.invoke('settings:setTheme', theme),
        getAccentColor: () => ipcRenderer.invoke('settings:getAccentColor'),
        setAccentColor: (color: string) => ipcRenderer.invoke('settings:setAccentColor', color)
    },

    // Audio Output (独占模式 + 设备选择)
    audioOutput: {
        getDevices: () => ipcRenderer.invoke('audio:getDevices'),
        setDevice: (id: string | null, exclusive: boolean) => ipcRenderer.invoke('audio:setDevice', id, exclusive),
        getChain: () => ipcRenderer.invoke('audio:getChain'),
        getLog: (maxCount?: number) => ipcRenderer.invoke('audio:getLog', maxCount || 50),
    }
})

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
    // 窗口控制
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    maximizeWindow: () => ipcRenderer.send('window-maximize'),
    closeWindow: () => ipcRenderer.send('window-close'),
    isMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // MPV 控制 (Renderer -> Main)
    mpvLoad: (url: string,autoPlay: boolean = true) => ipcRenderer.send('mpv-load', url, autoPlay),
    mpvPlay: () => ipcRenderer.send('mpv-play'),
    mpvPause: () => ipcRenderer.send('mpv-pause'),
    mpvSeek: (time: number) => ipcRenderer.send('mpv-seek', time),
    mpvSetVolume: (volume: number) => ipcRenderer.send('mpv-volume', volume),

    // MPV 事件 (Main -> Renderer)
    onMpvTimeUpdate: (callback: (time: number) => void) =>
        ipcRenderer.on('mpv-time-update', (_, time) => callback(time)),

    onMpvDuration: (callback: (duration: number) => void) =>
        ipcRenderer.on('mpv-duration', (_, duration) => callback(duration)),

    onMpvPlayState: (callback: (isPlaying: boolean) => void) =>
        ipcRenderer.on('mpv-play-state', (_, isPlaying) => callback(isPlaying)),

    onMpvEnded: (callback: () => void) =>
        ipcRenderer.on('mpv-ended', () => callback()),
})
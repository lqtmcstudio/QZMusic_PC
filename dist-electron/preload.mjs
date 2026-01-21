"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  // 窗口控制
  minimizeWindow: () => electron.ipcRenderer.send("window-minimize"),
  maximizeWindow: () => electron.ipcRenderer.send("window-maximize"),
  closeWindow: () => electron.ipcRenderer.send("window-close"),
  isMaximized: () => electron.ipcRenderer.invoke("window-is-maximized"),
  // MPV 控制 (Renderer -> Main)
  mpvLoad: (url, autoPlay = true) => electron.ipcRenderer.send("mpv-load", url, autoPlay),
  mpvPlay: () => electron.ipcRenderer.send("mpv-play"),
  mpvPause: () => electron.ipcRenderer.send("mpv-pause"),
  mpvSeek: (time) => electron.ipcRenderer.send("mpv-seek", time),
  mpvSetVolume: (volume) => electron.ipcRenderer.send("mpv-volume", volume),
  // MPV 事件 (Main -> Renderer)
  onMpvTimeUpdate: (callback) => electron.ipcRenderer.on("mpv-time-update", (_, time) => callback(time)),
  onMpvDuration: (callback) => electron.ipcRenderer.on("mpv-duration", (_, duration) => callback(duration)),
  onMpvPlayState: (callback) => electron.ipcRenderer.on("mpv-play-state", (_, isPlaying) => callback(isPlaying)),
  onMpvEnded: (callback) => electron.ipcRenderer.on("mpv-ended", () => callback())
});

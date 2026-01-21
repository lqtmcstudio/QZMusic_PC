var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { app, ipcMain, BrowserWindow, Menu } from "electron";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { spawn } from "node:child_process";
createRequire(import.meta.url);
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
let win;
class MpvController {
  // 用于处理 JSON 数据粘包
  constructor() {
    __publicField(this, "process", null);
    __publicField(this, "socket", null);
    __publicField(this, "socketPath");
    __publicField(this, "buffer", "");
    const socketName = `mpv-socket-${Date.now()}`;
    this.socketPath = process.platform === "win32" ? `\\\\.\\pipe\\${socketName}` : path.join(os.tmpdir(), socketName);
  }
  start(binaryPath) {
    console.log(`[MPV] Starting from: ${binaryPath}`);
    console.log(`[MPV] IPC Socket: ${this.socketPath}`);
    this.process = spawn(binaryPath, [
      "--idle",
      // 空闲时不退出
      "--no-video",
      // 纯音频模式
      "--keep-open=yes",
      // 播放结束不退出
      `--input-ipc-server=${this.socketPath}`
      // 指定 IPC 监听地址
    ]);
    this.process.on("error", (err) => {
      console.error("[MPV] Process Error:", err);
    });
    this.process.on("exit", (code) => {
      var _a;
      console.log(`[MPV] Process exited with code ${code}`);
      (_a = this.socket) == null ? void 0 : _a.destroy();
    });
    this.connectSocket();
  }
  connectSocket(retries = 10) {
    setTimeout(() => {
      const socket = net.createConnection(this.socketPath);
      socket.on("connect", () => {
        console.log("[MPV] IPC Connected!");
        this.socket = socket;
        this.setupObservers();
      });
      socket.on("data", (data) => this.handleData(data));
      socket.on("error", (err) => {
        if (retries > 0) {
          this.connectSocket(retries - 1);
        } else {
          console.error("[MPV] Failed to connect to IPC socket:", err);
        }
      });
    }, 500);
  }
  // 处理接收到的数据 (解决 TCP 数据包粘连或截断问题)
  handleData(data) {
    this.buffer += data.toString();
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() || "";
    lines.forEach((line) => {
      if (!line.trim()) return;
      try {
        const message = JSON.parse(line);
        console.log(message);
        this.handleMessage(message);
      } catch (e) {
        console.error("[MPV] JSON Parse Error:", e);
      }
    });
  }
  // 处理解析后的 JSON 消息
  handleMessage(msg) {
    if (!win) return;
    if (msg.event === "property-change") {
      switch (msg.name) {
        case "time-pos":
          win.webContents.send("mpv-time-update", msg.data);
          break;
        case "duration":
          win.webContents.send("mpv-duration", msg.data);
          break;
        case "pause":
          win.webContents.send("mpv-play-state", !msg.data);
          break;
      }
    }
    if (msg.event === "end-file") {
      win.webContents.send("mpv-ended");
      win.webContents.send("mpv-play-state", false);
    }
  }
  // 初始化监听属性
  setupObservers() {
    this.send(["observe_property", 1, "time-pos"]);
    this.send(["observe_property", 2, "duration"]);
    this.send(["observe_property", 3, "pause"]);
  }
  // 发送命令给 MPV
  send(command) {
    if (!this.socket || this.socket.destroyed) return;
    const payload = JSON.stringify({ command });
    this.socket.write(payload + "\n");
  }
  // === 业务方法 ===
  load(url, autoPlay) {
    if (autoPlay) {
      this.send(["set_property", "pause", false]);
      this.send(["loadfile", url, "replace"]);
    } else {
      this.send(["set_property", "pause", true]);
      this.send(["loadfile", url, "replace"]);
    }
  }
  play() {
    this.send(["set_property", "pause", false]);
  }
  pause() {
    this.send(["set_property", "pause", true]);
  }
  seek(time) {
    this.send(["seek", time, "absolute"]);
  }
  setVolume(volume) {
    this.send(["set_property", "volume", volume]);
  }
}
const mpv = new MpvController();
const mpvExecutablePath = app.isPackaged ? path.join(process.resourcesPath, "core", "mpv.exe") : path.join(process.env.APP_ROOT, "core", "mpv.exe");
function createWindow() {
  win = new BrowserWindow({
    frame: false,
    minWidth: 950,
    minHeight: 700,
    width: 1e3,
    height: 800,
    icon: path.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.on("window-minimize", (event) => {
  var _a;
  return (_a = BrowserWindow.fromWebContents(event.sender)) == null ? void 0 : _a.minimize();
});
ipcMain.on("window-maximize", () => (win == null ? void 0 : win.isMaximized()) ? win.unmaximize() : win == null ? void 0 : win.maximize());
ipcMain.on("window-close", () => win == null ? void 0 : win.close());
ipcMain.handle("window-is-maximized", () => (win == null ? void 0 : win.isMaximized()) || false);
ipcMain.on("mpv-load", (_, url, autoPlay = true) => mpv.load(url, autoPlay));
ipcMain.on("mpv-play", () => mpv.play());
ipcMain.on("mpv-pause", () => mpv.pause());
ipcMain.on("mpv-seek", (_, time) => mpv.seek(time));
ipcMain.on("mpv-volume", (_, volume) => mpv.setVolume(volume));
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  mpv.start(mpvExecutablePath);
  createWindow();
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};

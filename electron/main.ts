import { app, BrowserWindow, Menu, ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import { spawn, type ChildProcess } from 'node:child_process'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null


class MpvController {
    private process: ChildProcess | null = null;
    private socket: net.Socket | null = null;
    private socketPath: string;
    private buffer: string = '';

    constructor() {
        const socketName = `mpv-socket-${Date.now()}`;
        this.socketPath = process.platform === 'win32'
            ? `\\\\.\\pipe\\${socketName}`
            : path.join(os.tmpdir(), socketName);
    }

    start(binaryPath: string) {
        console.log(`[MPV] Starting from: ${binaryPath}`);
        console.log(`[MPV] IPC Socket: ${this.socketPath}`);

        // 启动 MPV 进程
        this.process = spawn(binaryPath, [
            '--idle',               // 空闲时不退出
            '--no-video',           // 纯音频模式
            '--keep-open=yes',      // 播放结束不退出
            `--input-ipc-server=${this.socketPath}`
        ]);

        this.process.on('error', (err) => {
            console.error('[MPV] Process Error:', err);
        });

        this.process.on('exit', (code) => {
            console.log(`[MPV] Process exited with code ${code}`);
            this.socket?.destroy();
        });

        this.connectSocket();
    }

    private connectSocket(retries = 10) {
        setTimeout(() => {
            const socket = net.createConnection(this.socketPath);

            socket.on('connect', () => {
                console.log('[MPV] IPC Connected!');
                this.socket = socket;
                this.setupObservers();
            });

            socket.on('data', (data) => this.handleData(data));

            socket.on('error', (err) => {
                if (retries > 0) {
                    // MPV 还没准备好，继续重试
                    this.connectSocket(retries - 1);
                } else {
                    console.error('[MPV] Failed to connect to IPC socket:', err);
                }
            });
        }, 500); // 500ms 重试间隔
    }

    // 处理接收到的数据
    private handleData(data: Buffer) {
        this.buffer += data.toString();

        // MPV 的消息以 \n 分隔
        const lines = this.buffer.split('\n');
        // 最后一个元素可能是不完整的行，留到下一次处理
        this.buffer = lines.pop() || '';

        lines.forEach(line => {
            if (!line.trim()) return;
            try {
                const message = JSON.parse(line);
                console.log(message);
                this.handleMessage(message);
            } catch (e) {
                console.error('[MPV] JSON Parse Error:', e);
            }
        });
    }

    // 处理解析后的 JSON 消息
    private handleMessage(msg: any) {
        if (!win) return;

        // 处理属性变更事件
        if (msg.event === 'property-change') {
            switch (msg.name) {
                case 'time-pos':
                    win.webContents.send('mpv-time-update', msg.data);
                    break;
                case 'duration':
                    win.webContents.send('mpv-duration', msg.data);
                    break;
                case 'pause':
                    win.webContents.send('mpv-play-state', !msg.data); // data=true 意味着暂停
                    break;
            }
        }

        // 处理播放结束事件
        if (msg.event === 'end-file') {
            win.webContents.send('mpv-ended');
            win.webContents.send('mpv-play-state', false);
        }
    }

    // 初始化监听属性
    private setupObservers() {
        this.send(['observe_property', 1, 'time-pos']);
        this.send(['observe_property', 2, 'duration']);
        this.send(['observe_property', 3, 'pause']);
    }

    // 发送命令给 MPV
    send(command: any[]) {
        if (!this.socket || this.socket.destroyed) return;

        const payload = JSON.stringify({ command });
        this.socket.write(payload + '\n');
    }

    // === 业务方法 ===

    load(url: string, autoPlay: boolean) {
        if (autoPlay) {
            // 确保取消暂停 (防止之前是暂停状态)
            this.send(['set_property', 'pause', false]);
            // 加载文件
            this.send(['loadfile', url, 'replace']);
        } else {
            // 先设置为暂停 (这样后续加载的文件会继承这个暂停状态)
            this.send(['set_property', 'pause', true]);
            // 加载文件
            this.send(['loadfile', url, 'replace']);
        }
    }

    play() { this.send(['set_property', 'pause', false]); }

    pause() { this.send(['set_property', 'pause', true]); }

    seek(time: number) { this.send(['seek', time, 'absolute']); }

    setVolume(volume: number) { this.send(['set_property', 'volume', volume]); }
}

const mpv = new MpvController();

// === Electron 窗口逻辑 ===

const mpvExecutablePath = app.isPackaged
    ? path.join(process.resourcesPath, 'core', 'mpv.exe')
    : path.join(process.env.APP_ROOT, 'core', 'mpv.exe');

function createWindow() {
    win = new BrowserWindow({
        frame: false,
        minWidth: 950,
        minHeight: 700,
        width: 1000,
        height: 800,
        icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            nodeIntegration: false,
            contextIsolation: true,
        },
    })

    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString())
    })

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL)
    } else {
        win.loadFile(path.join(RENDERER_DIST, 'index.html'))
    }
}

// === IPC 监听 ===

ipcMain.on('window-minimize', (event) => BrowserWindow.fromWebContents(event.sender)?.minimize())
ipcMain.on('window-maximize', () => win?.isMaximized() ? win.unmaximize() : win?.maximize())
ipcMain.on('window-close', () => win?.close())
ipcMain.handle('window-is-maximized', () => win?.isMaximized() || false)

// MPV 控制指令
ipcMain.on('mpv-load', (_, url, autoPlay = true) => mpv.load(url, autoPlay))
ipcMain.on('mpv-play', () => mpv.play())
ipcMain.on('mpv-pause', () => mpv.pause())
ipcMain.on('mpv-seek', (_, time) => mpv.seek(time))
ipcMain.on('mpv-volume', (_, volume) => mpv.setVolume(volume))


app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
        win = null
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    // 启动 MPV
    mpv.start(mpvExecutablePath);
    createWindow()
})
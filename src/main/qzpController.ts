import { spawn, type ChildProcess } from 'node:child_process';
import { Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import { app } from 'electron';

export class QzpController extends EventEmitter {
    private process: ChildProcess | null = null;
    private socket: Socket | null = null;
    private readonly ipcPath: string;
    private messageBuffer = '';
    private connectTimer: ReturnType<typeof setTimeout> | null = null;
    private restartTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingCommands: any[][] = [];
    private currentUrl: string | null = null;
    private lastKnownTime = 0;
    private desiredPause = true;
    private volume = 50;
    private bassConfig: Record<string, unknown> | null = null;
    private isConnected = false;
    private isRestarting = false;
    private isShuttingDown = false;

    private readonly connectRetryDelay = 250;
    private readonly maxConnectRetries = 20;
    private readonly maxPendingCommands = 50;
    private readonly restartDelay = 150;

    constructor(ipcPath?: string) {
        super();
        this.ipcPath = ipcPath || this.getIpcPath();
    }

    private getIpcPath(): string {
        if (process.platform === 'win32') {
            return '\\\\.\\pipe\\qzplayer';
        }
        return '/tmp/qzmusic_mpv_socket';
    }

    private getCorePath(): string {
        const appRoot = process.env.APP_ROOT || process.cwd();
        if (app.isPackaged) {
            return path.join(process.resourcesPath, 'core', 'qzplayer.exe');
        }
        return path.join(appRoot, 'core', 'qzplayer.exe');
    }

    start(): void {
        if (this.process || this.connectTimer || this.isRestarting) return;

        this.isShuttingDown = false;
        this.messageBuffer = '';

        const playerPath = this.getCorePath();
        console.log('Starting QZPlayer from:', playerPath);

        try {
            const child = spawn(playerPath, [], {
                stdio: 'ignore',
                windowsHide: true,
            });
            this.process = child;

            child.once('error', (err) => {
                if (this.process === child) this.process = null;
                console.error('Failed to start QZPlayer:', err);
                this.emitError(err);
                this.restart(`process error: ${err.message}`);
            });

            child.once('exit', (code, signal) => {
                if (this.process === child) this.process = null;
                console.log(`QZPlayer exited with code ${code} and signal ${signal}`);
                this.emit('exit', { code, signal });
                this.destroySocket();
                this.restart(`process exited: code=${code}, signal=${signal}`);
            });
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            console.error('Failed to spawn QZPlayer:', error);
            this.emitError(error);
            this.restart(`spawn failed: ${error.message}`);
            return;
        }

        this.tryConnect();
    }

    private tryConnect(retries = this.maxConnectRetries): void {
        if (this.isShuttingDown || this.isRestarting) return;

        this.clearConnectTimer();
        this.connectTimer = setTimeout(() => {
            this.connectTimer = null;
            if (this.isShuttingDown || this.isRestarting) return;

            const socket = new Socket();
            let connected = false;
            let handledConnectFailure = false;
            this.socket = socket;

            socket.once('connect', () => {
                connected = true;
                this.isConnected = true;
                this.messageBuffer = '';
                console.log('Connected to QZPlayer IPC socket');
                this.emit('ready');
                this.initPlayerState();
                this.restorePlaybackState();
                this.flushPendingCommands();
            });

            socket.on('data', (data) => {
                this.handleData(data);
            });

            socket.once('error', (err) => {
                if (!connected) {
                    handledConnectFailure = true;
                    this.destroySocket(socket);
                    if (retries > 1) {
                        this.tryConnect(retries - 1);
                    } else {
                        this.restart(`socket connect failed: ${err.message}`);
                    }
                    return;
                }

                console.warn('QZPlayer IPC socket error:', err);
                this.restart(`socket error: ${err.message}`);
            });

            socket.once('close', () => {
                if (this.socket === socket) {
                    this.socket = null;
                    this.isConnected = false;
                }

                if (this.isShuttingDown || this.isRestarting) return;

                if (connected) {
                    this.restart('socket closed');
                } else if (!handledConnectFailure) {
                    if (retries > 1) {
                        this.tryConnect(retries - 1);
                    } else {
                        this.restart('socket closed before connect');
                    }
                }
            });

            socket.connect(this.ipcPath);
        }, this.connectRetryDelay);
    }

    private initPlayerState(): void {
        this.send(['observe_property', 1, 'pause']);
        this.send(['observe_property', 2, 'time-pos']);
        this.send(['observe_property', 3, 'duration']);
        this.send(['observe_property', 4, 'idle-active']);
        this.send(['observe_property', 5, 'eof-reached']);
        this.send(['set_property', 'volume', this.volume]);
        if (this.bassConfig) this.send(['set_property', 'bass-config', this.bassConfig]);
    }

    private restorePlaybackState(): void {
        const hasPendingLoad = this.pendingCommands.some((command) => command[0] === 'loadfile');
        if (!this.currentUrl || hasPendingLoad) return;

        const restoreTime = this.lastKnownTime;
        this.send(['loadfile', this.currentUrl]);
        if (restoreTime > 0) {
            this.send(['seek', restoreTime, 'absolute']);
        }
        this.send(['set_property', 'pause', this.desiredPause]);
    }

    private restart(reason: string): void {
        if (this.isShuttingDown || this.isRestarting) return;

        console.warn(`Restarting QZPlayer: ${reason}`);
        this.isRestarting = true;
        this.emit('restart', { reason });

        this.clearConnectTimer();
        this.clearRestartTimer();
        this.destroySocket();
        this.killProcess();

        this.restartTimer = setTimeout(() => {
            this.restartTimer = null;
            this.isRestarting = false;
            if (!this.isShuttingDown) {
                this.start();
            }
        }, this.restartDelay);
    }

    private handleData(data: Buffer): void {
        const raw = data.toString();

        this.messageBuffer += raw;
        const messages = this.messageBuffer.split('\n');
        this.messageBuffer = messages.pop() || '';

        for (const msg of messages) {
            if (!msg.trim()) continue;
            try {
                const json = JSON.parse(msg);
                this.trackPlayerState(json);
                this.emit('message', json);

                if (json.event) {
                    this.emit('event', json);
                }
            } catch {
                console.error('Failed to parse QZPlayer message:', msg);
            }
        }
    }

    async send(command: any[]): Promise<void> {
        this.trackOutgoingCommand(command);

        if (!this.socket || this.socket.destroyed || !this.isConnected) {
            console.warn('QZPlayer socket not connected');
            this.queueCommand(command);
            if (!this.process && !this.isRestarting && !this.isShuttingDown) {
                this.start();
            }
            return;
        }

        this.sendNow(command);
    }

    private sendNow(command: any[]): void {
        if (!this.socket || this.socket.destroyed || !this.isConnected) {
            this.queueCommand(command);
            return;
        }

        const payload = JSON.stringify({ command });
        console.log('[QZPlayer TX]', payload);

        try {
            this.socket.write(payload + '\n');
        } catch (err) {
            const error = err instanceof Error ? err : new Error(String(err));
            this.queueCommand(command);
            this.restart(`socket write failed: ${error.message}`);
        }
    }

    async load(url: string): Promise<void> {
        return this.send(['loadfile', url]);
    }

    async play(): Promise<void> {
        return this.send(['set_property', 'pause', false]);
    }

    async pause(): Promise<void> {
        return this.send(['set_property', 'pause', true]);
    }

    async togglePause(): Promise<void> {
        return this.send(['cycle', 'pause']);
    }

    async stop(): Promise<void> {
        return this.send(['stop']);
    }

    async setVolume(vol: number): Promise<void> {
        return this.send(['set_property', 'volume', vol]);
    }

    async setBassConfig(effective: Record<string, unknown>): Promise<void> {
        this.bassConfig = effective;
        return this.send(['set_property', 'bass-config', effective]);
    }

    async seek(seconds: number): Promise<void> {
        return this.send(['seek', seconds, 'absolute']);
    }

    async getAudioDevices(): Promise<void> {
        return this.send(['audio_devices']);
    }

    async setAudioDevice(deviceId: string | null, exclusive: boolean): Promise<void> {
        return this.send(['set_audio_device', deviceId || '', exclusive ? 1 : 0]);
    }

    async getPlaybackChain(): Promise<void> {
        return this.send(['get_playback_chain']);
    }

    async getAudioLog(maxCount = 50): Promise<void> {
        return this.send(['get_audio_log', maxCount]);
    }

    destroy(): void {
        this.isShuttingDown = true;
        this.isRestarting = false;
        this.clearConnectTimer();
        this.clearRestartTimer();
        this.destroySocket();
        this.killProcess();
    }

    private destroySocket(socket = this.socket): void {
        if (!socket) return;

        if (this.socket === socket) {
            this.socket = null;
            this.isConnected = false;
        }

        socket.removeAllListeners('data');
        socket.removeAllListeners('error');
        socket.removeAllListeners('close');
        socket.destroy();
    }

    private killProcess(): void {
        const child = this.process;
        this.process = null;
        if (!child) return;

        console.log('Killing QZPlayer process...');
        child.removeAllListeners('error');
        child.removeAllListeners('exit');
        if (!child.killed) {
            child.kill('SIGKILL');
        }
    }

    private clearConnectTimer(): void {
        if (this.connectTimer) {
            clearTimeout(this.connectTimer);
            this.connectTimer = null;
        }
    }

    private clearRestartTimer(): void {
        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }
    }

    private queueCommand(command: any[]): void {
        if (command[0] === 'observe_property') return;
        this.pendingCommands.push(command);
        if (this.pendingCommands.length > this.maxPendingCommands) {
            this.pendingCommands.shift();
        }
    }

    private flushPendingCommands(): void {
        const commands = this.pendingCommands.splice(0);
        for (const command of commands) {
            this.sendNow(command);
        }
    }

    private trackPlayerState(json: any): void {
        if (json?.event !== 'property-change') return;

        if (json.name === 'pause') {
            this.desiredPause = Boolean(json.data);
        } else if (json.name === 'time-pos' && typeof json.data === 'number') {
            this.lastKnownTime = json.data;
        }
    }

    private trackOutgoingCommand(command: any[]): void {
        const [name, ...args] = command;

        if (name === 'loadfile' && typeof args[0] === 'string') {
            this.currentUrl = args[0];
            this.lastKnownTime = 0;
        } else if (name === 'seek' && typeof args[0] === 'number') {
            this.lastKnownTime = args[0];
        } else if (name === 'stop') {
            this.currentUrl = null;
            this.lastKnownTime = 0;
            this.desiredPause = true;
        } else if (name === 'cycle' && args[0] === 'pause') {
            this.desiredPause = !this.desiredPause;
        } else if (name === 'set_property') {
            if (args[0] === 'pause') {
                this.desiredPause = Boolean(args[1]);
            } else if (args[0] === 'volume' && typeof args[1] === 'number') {
                this.volume = args[1];
            } else if (args[0] === 'bass-config' && typeof args[1] === 'object' && args[1] !== null) {
                this.bassConfig = args[1] as Record<string, unknown>;
            }
        }
    }

    private emitError(err: Error): void {
        if (this.listenerCount('error') > 0) {
            this.emit('error', err);
        }
    }
}

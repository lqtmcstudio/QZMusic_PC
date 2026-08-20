import fs from 'fs';
import path from 'path';
import { app } from 'electron';

export type BassMode = 'speaker' | 'headphone';

export interface BassSourceState {
    enabled: boolean;          // 总开关, false=旁路(位级透明)
    mode: BassMode;            // 普通模式预设
    advanced: boolean;          // 高级模式开关
    // 高级模式手动参数:
    crossover: number;         // Hz
    gain: number;               // dB (lowshelf)
    drive: number;              // dB (exciter drive)
    mix: number;                // 0~100 湿声比例
    release: number;            // ms (限幅器释放)
    exciter: boolean;           // 谐波激励开关
}

export interface AudioOutputConfig {
    deviceId: string | null;    // null=系统默认
    exclusive: boolean;         // 独占模式开关
    autoMatch: boolean;         // 切歌自动匹配 ALT Setting
    logEnabled: boolean;        // 调试日志开关
}

export interface ShortcutBindings {
    togglePlay: string;
    previous: string;
    next: string;
    toggleMode: string;
}

export interface AppSettings {
    // Cache
    persistCache: boolean;
    cachePath: string; // [NEW] Custom cache path
    // Appearance
    theme: 'dark' | 'light';
    accentColor: string;
    // Playlist
    playlistPagingMode: 'infinite' | 'pagination';
    openPlayerOnSongClick: boolean;
    // Playback
    bass: BassSourceState; // 低音增强配置(普通/高级)
    audioOutput: AudioOutputConfig; // 音频输出设备 + 独占模式
    shortcuts: ShortcutBindings;
}

const DEFAULT_BASS: BassSourceState = {
    enabled: false,
    mode: 'speaker',
    advanced: false,
    crossover: 90,
    gain: 3.5,
    drive: 12,
    mix: 18,
    release: 250,
    exciter: true,
};

const DEFAULT_AUDIO_OUTPUT: AudioOutputConfig = {
    deviceId: null,
    exclusive: false,
    autoMatch: true,
    logEnabled: true,
};

const DEFAULT_SHORTCUTS: ShortcutBindings = {
    togglePlay: 'Space',
    previous: 'A',
    next: 'D',
    toggleMode: 'W',
};

const DEFAULT_SETTINGS: AppSettings = {
    persistCache: true,
    cachePath: path.join(app.getPath('userData'), 'cache'), // Default
    theme: 'light',
    accentColor: '#8289d3',
    playlistPagingMode: 'infinite',
    openPlayerOnSongClick: false,
    bass: { ...DEFAULT_BASS },
    audioOutput: { ...DEFAULT_AUDIO_OUTPUT },
    shortcuts: { ...DEFAULT_SHORTCUTS },
};

let settingsCache: AppSettings | null = null;

function getSettingsPath(): string {
    return path.join(app.getPath('userData'), 'settings.json');
}

export function loadSettings(): AppSettings {
    if (settingsCache) return settingsCache;

    const settingsPath = getSettingsPath();
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf-8');
            const stored = JSON.parse(data);
            settingsCache = {
                ...DEFAULT_SETTINGS,
                ...stored,
                shortcuts: { ...DEFAULT_SHORTCUTS, ...stored.shortcuts },
            };
            console.log('[Settings] Loaded from disk:', settingsCache);
            return settingsCache!;
        }
    } catch (e) {
        console.error('[Settings] Failed to load settings:', e);
    }

    settingsCache = { ...DEFAULT_SETTINGS };
    return settingsCache;
}

export function saveSettings(settings: Partial<AppSettings>): AppSettings {
    settingsCache = { ...loadSettings(), ...settings };

    const settingsPath = getSettingsPath();
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settingsCache, null, 2));
        console.log('[Settings] Saved to disk:', settingsCache);
    } catch (e) {
        console.error('[Settings] Failed to save settings:', e);
    }

    return settingsCache;
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return loadSettings()[key];
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    saveSettings({ [key]: value });
}

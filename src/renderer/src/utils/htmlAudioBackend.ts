// Keep the store's QZPlayer event contract (all positions/durations are milliseconds).
export type PlaybackEvent = {
    event: 'property-change' | 'end-file';
    name?: string;
    data?: any;
    reason?: 'eof' | 'error';
};

type Listener = (event: unknown, data: PlaybackEvent) => void;

export function toMediaUrl(value: string): string {
    // Local library entries contain raw absolute paths, not URLs. Encode #, %, ?, etc.
    if (value.startsWith('/')) return `file://${value.split('/').map(encodeURIComponent).join('/')}`;
    if (/^[a-z]:[\\/]/i.test(value)) {
        const [drive, ...parts] = value.replace(/\\/g, '/').split('/');
        return `file:///${drive}/${parts.map(encodeURIComponent).join('/')}`;
    }
    return value;
}

export class HtmlAudioBackend {
    private audio: HTMLAudioElement | null = null;
    private listeners = new Set<Listener>();
    private volume = 0.5;
    private pendingSeek: number | null = null;
    private wantsPlay = false;
    private playRequest = 0;
    private playingRequest: number | null = null;
    private failed = false;

    constructor(private createAudio: () => HTMLAudioElement = () => new Audio()) {}

    onEvent(callback: Listener): void {
        this.listeners.add(callback);
    }

    private emit(data: PlaybackEvent): void {
        for (const listener of this.listeners) listener(undefined, data);
    }

    private property(name: string, data: unknown): void {
        this.emit({ event: 'property-change', name, data });
    }

    async load(url: string): Promise<void> {
        this.release();
        // A fresh element isolates late events/play promises from the previous track.
        const audio = this.createAudio();
        this.audio = audio;
        this.failed = false;
        audio.preload = 'auto';
        audio.volume = this.volume;
        const on = (name: string, callback: () => void) => {
            audio.addEventListener(name, () => {
                if (this.audio === audio) callback();
            });
        };
        const reportDuration = () => {
            this.property('duration', Number.isFinite(audio.duration) ? audio.duration * 1000 : 0);
        };
        on('loadedmetadata', () => {
            reportDuration();
            if (this.pendingSeek !== null) {
                this.applySeek(this.pendingSeek);
                this.pendingSeek = null;
            }
        });
        on('durationchange', reportDuration);
        on('timeupdate', () => this.property('time-pos', audio.currentTime * 1000));
        on('seeked', () => this.property('time-pos', audio.currentTime * 1000));
        on('playing', () => this.property('pause', false));
        // Chromium emits pause before ended. EOF is not a user PAUSE command:
        // sending one would stop the listen-together server's automatic advance.
        on('pause', () => { if (!audio.ended) this.property('pause', true); });
        on('ended', () => {
            this.wantsPlay = false;
            this.emit({ event: 'end-file', reason: 'eof' });
        });
        on('error', () => {
            // While play() is pending its rejection is handled by playSong(), not twice
            // via both a rejected promise and an end-file event.
            if (!this.wantsPlay || this.playingRequest !== null || this.failed) return;
            this.failed = true;
            this.emit({ event: 'end-file', reason: 'error' });
        });
        this.property('time-pos', 0);
        this.property('duration', 0);
        this.property('loudness', 0);
        this.property('spectrum', []);
        audio.src = toMediaUrl(url);
        audio.load();
    }

    async play(): Promise<void> {
        const audio = this.audio;
        if (!audio) return;
        this.wantsPlay = true;
        const request = ++this.playRequest;
        this.playingRequest = request;
        try {
            await audio.play();
        } catch (error) {
            // Switching tracks or pausing while buffering aborts play normally.
            if (this.audio !== audio || !this.wantsPlay || request !== this.playRequest) return;
            this.failed = true;
            throw error;
        } finally {
            if (this.playingRequest === request) this.playingRequest = null;
        }
    }

    async pause(): Promise<void> {
        ++this.playRequest;
        this.playingRequest = null;
        this.wantsPlay = false;
        const alreadyPaused = !this.audio || this.audio.paused;
        this.audio?.pause();
        if (alreadyPaused) this.property('pause', true);
    }

    async togglePause(): Promise<void> {
        if (this.wantsPlay) await this.pause();
        else await this.play();
    }

    async stop(): Promise<void> {
        this.release();
        this.property('pause', true);
        this.property('time-pos', 0);
        this.property('duration', 0);
    }

    async setVolume(value: number): Promise<void> {
        this.volume = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) / 100 : 0.5;
        if (this.audio) this.audio.volume = this.volume;
    }

    async seek(milliseconds: number): Promise<void> {
        if (!Number.isFinite(milliseconds) || !this.audio) return;
        const position = Math.max(0, milliseconds);
        if (this.audio.readyState === 0) this.pendingSeek = position;
        else this.applySeek(position);
    }

    private applySeek(milliseconds: number): void {
        const audio = this.audio!;
        const seconds = milliseconds / 1000;
        audio.currentTime = Number.isFinite(audio.duration) ? Math.min(seconds, audio.duration) : seconds;
    }

    private release(): void {
        const previous = this.audio;
        this.audio = null;
        ++this.playRequest;
        this.playingRequest = null;
        this.wantsPlay = false;
        this.pendingSeek = null;
        if (previous) {
            previous.pause();
            previous.removeAttribute('src');
            previous.load();
        }
    }
}

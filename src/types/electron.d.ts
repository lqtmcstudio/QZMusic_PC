export interface IElectronAPI {
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    isMaximized: () => Promise<boolean>;

    mpvLoad: (url: string,autoPlay?: boolean) => void;
    mpvPlay: () => void;
    mpvPause: () => void;
    mpvResume: () => void;
    mpvSeek: (time: number) => void;
    mpvSetVolume: (volume: number) => void;

    onMpvTimeUpdate: (callback: (time: number) => void) => void;
    onMpvDuration: (callback: (duration: number) => void) => void;
    onMpvPlayState: (callback: (isPlaying: boolean) => void) => void;
    onMpvEnded: (callback: () => void) => void;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI
    }
}
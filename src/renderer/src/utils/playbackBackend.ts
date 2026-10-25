import { HtmlAudioBackend } from './htmlAudioBackend';

// The platform is exposed synchronously by preload, before the player store starts.
export const usesHtmlAudio = window.electronAPI.platform === 'darwin';
export const playbackBackend = usesHtmlAudio
    ? new HtmlAudioBackend()
    : window.electronAPI.qzplayer;

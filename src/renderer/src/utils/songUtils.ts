import type { Song } from '../types/song';

export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * 插件返回的歌曲 JSON 已是手机端 Music 格式(artists/pic/interval/qualities...),
 * 这里只做最小规整: id/source 字符串化, 缺省补默认值, 不做字段重命名。
 */
export function toSong(raw: any): Song {
    return {
        id: String(raw?.id ?? raw?.songmid ?? ''),
        name: String(raw?.name ?? ''),
        artists: String(raw?.artists ?? raw?.singer ?? ''),
        source: String(raw?.source ?? ''),
        pic: String(raw?.pic ?? raw?.img ?? ''),
        sPic: raw?.sPic ? String(raw.sPic) : undefined,
        mPic: raw?.mPic ? String(raw.mPic) : undefined,
        interval: String(raw?.interval ?? '--/--'),
        qualities: raw?.qualities ?? raw?.types,
        quality: raw?.quality ?? null,
        albumName: raw?.albumName ?? null,
        albumId: raw?.albumId ? String(raw.albumId) : null,
        playCount: Number(raw?.playCount) || 0,
        extra: raw?.extra,
        lyric: typeof raw?.lyric === 'string' ? raw.lyric : undefined,
        url: typeof raw?.url === 'string' ? raw.url : undefined,
    };
}

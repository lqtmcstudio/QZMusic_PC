import type { Song } from '../types/song';

export function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function normalizeInterval(val: unknown): string {
    const raw = String(val ?? '').trim();
    if (!raw || raw === '--' || raw === '--/--' || raw === '--:--') return '--:--';

    // 纯数字视为毫秒(插件规范 interval 应为 "MM:SS" 字符串, 部分插件返回毫秒数)
    if (/^\d+$/.test(raw)) {
        const total = Math.floor(Number(raw) / 1000);
        const m = Math.floor(total / 60);
        const s = total % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    // 已匹配 M:SS 或 MM:SS（允许更长分钟）
    const m = raw.match(/^(\d+):(\d{1,2})$/);
    if (m) {
        const minutes = Number(m[1]);
        const seconds = Number(m[2]);
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return raw;
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
        interval: normalizeInterval(raw?.interval),
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

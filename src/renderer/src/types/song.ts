// Song Type Definition
// 字段名与手机端 Music 模型(android QZ-Music models/music/Music.kt)一致,
// 插件返回的 JSON 可直接作为 Song 使用, 无需字段转换。

export type SongQualityMap = Record<string, string>; // key=音质标识, value=文件大小字符串(显示用)

export interface Song {
    id: string;
    name: string;
    artists: string;
    source: string;            // 'wy' | 'tx' | 'local' | ...
    pic: string;
    sPic?: string;
    mPic?: string;
    interval: string;          // 显示用 "MM:SS" 或 "--/--"
    qualities?: SongQualityMap;
    quality?: string | null;
    albumName?: string | null;
    albumId?: string | null;
    playCount?: number;
    extra?: any;
    lyric?: string;            // 本地歌词
    // 本地专属可选字段
    url?: string;             // 本地文件路径
    path?: string;
    durationSeconds?: number;
    bitrate?: number;
    sampleRate?: number;
    channels?: number;
    size?: number;
    modifiedAt?: number;
    addedAt?: number;
}

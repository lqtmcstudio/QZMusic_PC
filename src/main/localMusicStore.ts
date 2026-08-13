import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

const execFileAsync = promisify(execFile)

const AUDIO_EXTENSIONS = new Set([
    '.mp3',
    '.flac',
    '.m4a',
    '.mp4',
    '.aac',
    '.ogg',
    '.opus',
    '.wav',
    '.aiff',
    '.aif',
    '.ape',
    '.wv',
])

export interface LocalSong {
    id: string
    path: string
    name: string
    artists: string
    albumName: string
    interval: string
    durationSeconds: number
    source: 'local'
    url: string
    pic: string
    lyric: string
    quality: string
    bitrate: number
    sampleRate: number
    channels: number
    size: number
    modifiedAt: number
    addedAt: number
}

interface LocalMusicLibrary {
    roots: string[]
    songs: LocalSong[]
    updatedAt: number
}

function getLibraryPath(): string {
    return path.join(app.getPath('userData'), 'local-music.json')
}

function getReaderExe(): string {
    const binaryName = process.platform === 'win32' ? 'taglib_reader_cli.exe' : 'taglib_reader_cli';
    const candidates = [
        path.join(process.env.APP_ROOT || '', 'native', 'taglib_reader', 'build', binaryName),
        path.join(process.resourcesPath || '', 'native', binaryName),
    ]
    const target = candidates.find((candidate) => candidate && fs.existsSync(candidate))
    if (!target) throw new Error(`TagLib reader executable not found (${binaryName})`)
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(target, 0o755)
        } catch {}
    }
    return target
}

function getArtworkDir(): string {
    return path.join(app.getPath('userData'), 'local-music-artwork')
}

function getDefaultRoots(): string[] {
    const roots: string[] = []
    if (process.platform === 'win32') {
        const username = path.basename(app.getPath('home'))
        for (let code = 67; code <= 90; code++) {
            const drive = `${String.fromCharCode(code)}:\\`
            if (!fs.existsSync(drive)) continue
            const userRoot = path.join(drive, 'Users', username)
            for (const dirName of ['Music', '音乐', 'Downloads', '下载']) {
                const candidate = path.join(userRoot, dirName)
                if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) roots.push(candidate)
            }
        }
    } else {
        const home = app.getPath('home')
        for (const dirName of ['Music', '音乐', 'Downloads', '下载']) {
            const candidate = path.join(home, dirName)
            if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) roots.push(candidate)
        }
    }
    return Array.from(new Set(roots))
}

function loadLibrary(): LocalMusicLibrary {
    const file = getLibraryPath()
    try {
        if (fs.existsSync(file)) {
            const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as LocalMusicLibrary
            let changed = false
            const songs = Array.isArray(parsed.songs)
                ? parsed.songs
                    .filter((song) => {
                        const exists = fs.existsSync(song.path)
                        if (!exists) changed = true
                        return exists
                    })
                    .map((song) => {
                        if (!song.pic || !song.pic.startsWith('data:')) return song
                        changed = true
                        return { ...song, pic: '' }
                    })
                : []
            const library = {
                roots: Array.isArray(parsed.roots) ? parsed.roots : [],
                songs,
                updatedAt: Number(parsed.updatedAt) || 0,
            }
            if (changed || songs.length !== parsed.songs?.length) saveLibrary(library)
            return library
        }
    } catch (error) {
        console.error('[LocalMusic] Failed to load library:', error)
    }
    return { roots: getDefaultRoots(), songs: [], updatedAt: 0 }
}

function saveLibrary(library: LocalMusicLibrary): LocalMusicLibrary {
    fs.writeFileSync(getLibraryPath(), JSON.stringify(library, null, 2), 'utf8')
    return library
}

function isPathUnderRoots(filePath: string, roots: string[]): boolean {
    const normalizedFile = path.resolve(filePath).toLowerCase()
    return roots.some((root) => {
        const normalizedRoot = path.resolve(root).toLowerCase()
        return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}${path.sep}`)
    })
}

function fallbackName(filePath: string): string {
    return path.basename(filePath, path.extname(filePath))
}

function createLocalSong(filePath: string, metadata: any): LocalSong {
    const stat = fs.statSync(filePath)
    const title = String(metadata.title || '').trim()
    const artist = String(metadata.artist || '').trim()
    const album = String(metadata.album || '').trim()
    return {
        id: Buffer.from(filePath, 'utf8').toString('base64url'),
        path: filePath,
        name: title || fallbackName(filePath),
        artists: artist || '未知艺术家',
        albumName: album || '未知专辑',
        interval: String(metadata.duration || '00:00'),
        durationSeconds: Number(metadata.durationSeconds) || 0,
        source: 'local',
        url: filePath,
        pic: metadata.coverPath ? pathToFileURL(String(metadata.coverPath)).toString() : '',
        lyric: String(metadata.lyric || '').trim(),
        quality: String(metadata.quality || ''),
        bitrate: Number(metadata.bitrate) || 0,
        sampleRate: Number(metadata.sampleRate) || 0,
        channels: Number(metadata.channels) || 0,
        size: stat.size,
        modifiedAt: stat.mtimeMs,
        addedAt: Date.now(),
    }
}

export function getLocalMusicLibrary(): LocalMusicLibrary {
    return loadLibrary()
}

export function setLocalMusicRoots(roots: string[]): LocalMusicLibrary {
    const library = loadLibrary()
    const normalizedRoots = Array.from(new Set(
        roots
            .map((root) => path.resolve(root))
            .filter((root) => fs.existsSync(root) && fs.statSync(root).isDirectory())
    ))
    return saveLibrary({
        ...library,
        roots: normalizedRoots,
        songs: library.songs.filter((song) => fs.existsSync(song.path) && isPathUnderRoots(song.path, normalizedRoots)),
        updatedAt: Date.now(),
    })
}

export async function scanLocalMusic(roots: string[]): Promise<LocalMusicLibrary> {
    const normalizedRoots = Array.from(new Set(
        roots
            .map((root) => path.resolve(root))
            .filter((root) => fs.existsSync(root) && fs.statSync(root).isDirectory())
    ))
    const reader = getReaderExe()
    const artworkDir = getArtworkDir()
    fs.mkdirSync(artworkDir, { recursive: true })
    const { stdout, stderr } = await execFileAsync(reader, ['scan', '--artwork-dir', artworkDir, ...normalizedRoots], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
        windowsHide: true,
        timeout: 15 * 60 * 1000,
    })
    if (stderr?.trim()) console.warn('[LocalMusic] Scanner warnings:', stderr)

    const parsed = JSON.parse(stdout) as { songs?: any[] }
    const songs: LocalSong[] = []
    for (const metadata of parsed.songs || []) {
        const filePath = String(metadata?.path || '')
        if (!filePath || !fs.existsSync(filePath) || !AUDIO_EXTENSIONS.has(path.extname(filePath).toLowerCase())) continue
        try {
            songs.push(createLocalSong(filePath, metadata))
        } catch (error) {
            console.warn('[LocalMusic] Failed to normalize tags:', filePath, error)
        }
    }

    return saveLibrary({
        roots: normalizedRoots,
        songs,
        updatedAt: Date.now(),
    })
}

export function removeLocalSong(id: string): LocalMusicLibrary {
    const library = loadLibrary()
    return saveLibrary({
        ...library,
        songs: library.songs.filter((song) => song.id !== id),
        updatedAt: Date.now(),
    })
}

export function clearMissingLocalSongs(): LocalMusicLibrary {
    const library = loadLibrary()
    return saveLibrary({
        ...library,
        songs: library.songs.filter((song) => fs.existsSync(song.path)),
        updatedAt: Date.now(),
    })
}

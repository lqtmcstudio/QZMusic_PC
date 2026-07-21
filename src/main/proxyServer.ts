import http from 'node:http';
import { Readable, type Writable } from 'node:stream';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { PluginSystem } from './pluginSystem';
import { loadSettings } from './settingsStore';

const PORT = 5266;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
const URL_TTL_MS = 50 * 60 * 1000;
const STALE_TEMP_TTL_MS = 60 * 60 * 1000;
const MAX_ACTIVE_DOWNLOADS = 1;
const MIN_VALID_CACHE_SIZE = 1024;

let CACHE_DIR = '';
let persistCacheEnabled = true;
let serverInstance: http.Server | null = null;
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

interface CacheEntry {
    url: string;
    expiresAt: number;
}

interface CacheMetadata {
    totalSize: number;
    contentType: string;
    complete: boolean;
    createdAt: number;
}

interface DownloadTask {
    cacheFilePath: string;
    tempPath: string;
    currentSize: number;
    totalSize: number;
    contentType: string;
    abortController: AbortController;
    promise: Promise<void>;
}

interface RangeValue {
    start: number;
    end: number;
}

class ProxyHttpError extends Error {
    constructor(
        readonly statusCode: number,
        message: string,
    ) {
        super(message);
    }
}

const urlCache = new Map<string, CacheEntry>();
const pendingUrlResolves = new Map<string, Promise<string | null>>();
const downloadTasks = new Map<string, DownloadTask>();

function ensureCacheDir(): string {
    const settings = loadSettings();
    const nextDir = settings.cachePath || path.join(app.getPath('userData'), 'cache');

    if (CACHE_DIR !== nextDir) {
        CACHE_DIR = nextDir;
    }

    if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
        console.log(`[Proxy] Created cache directory: ${CACHE_DIR}`);
    }

    return CACHE_DIR;
}

export function refreshCacheDir(): string {
    CACHE_DIR = '';
    return ensureCacheDir();
}

function sanitizePart(value: string): string {
    return value.replace(/[^a-z0-9._-]/gi, '_');
}

function getCachePath(source: string, id: string, quality: string): string {
    const dir = ensureCacheDir();
    return path.join(dir, `${sanitizePart(source)}-${sanitizePart(id)}-${sanitizePart(quality)}`);
}

function getMetadataPath(cachePath: string): string {
    return `${cachePath}.meta`;
}

function getTempPath(cachePath: string): string {
    return `${cachePath}.tmp`;
}

function readMetadata(cachePath: string): CacheMetadata | null {
    try {
        const metaPath = getMetadataPath(cachePath);
        if (!fs.existsSync(metaPath)) return null;
        return JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as CacheMetadata;
    } catch (err) {
        console.warn('[Proxy] Failed to read cache metadata:', err);
        return null;
    }
}

function writeMetadata(cachePath: string, metadata: CacheMetadata): void {
    const metaPath = getMetadataPath(cachePath);
    const tempMetaPath = `${metaPath}.tmp`;
    fs.writeFileSync(tempMetaPath, JSON.stringify(metadata));
    fs.renameSync(tempMetaPath, metaPath);
}

function removeFileIfExists(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (err) {
        console.warn(`[Proxy] Failed to remove ${filePath}:`, err);
    }
}

function removeCacheFiles(cachePath: string): void {
    removeFileIfExists(cachePath);
    removeFileIfExists(getMetadataPath(cachePath));
    removeFileIfExists(getTempPath(cachePath));
    removeFileIfExists(`${getMetadataPath(cachePath)}.tmp`);
}

function getCachedUrl(cacheKey: string): string | null {
    const entry = urlCache.get(cacheKey);
    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) {
        urlCache.delete(cacheKey);
        return null;
    }

    return entry.url;
}

async function resolvePlayUrl(source: string, id: string, quality: string, forceRefresh = false): Promise<string | null> {
    const cacheKey = `${source}:${id}:${quality}`;

    if (!forceRefresh) {
        const cached = getCachedUrl(cacheKey);
        if (cached) return cached;
    } else {
        urlCache.delete(cacheKey);
    }

    const existing = pendingUrlResolves.get(cacheKey);
    if (existing) return existing;

    const promise = (async () => {
        try {
            const plugin = new PluginSystem(source);
            const result = await plugin.getUrl(id, quality);
            if (!result.success || !result.url) {
                console.error(`[Proxy] Failed to resolve URL for ${cacheKey}:`, result.error);
                return null;
            }

            urlCache.set(cacheKey, {
                url: result.url,
                expiresAt: Date.now() + URL_TTL_MS,
            });
            return result.url;
        } catch (err) {
            console.error(`[Proxy] URL resolve error for ${cacheKey}:`, err);
            return null;
        } finally {
            pendingUrlResolves.delete(cacheKey);
        }
    })();

    pendingUrlResolves.set(cacheKey, promise);
    return promise;
}

function isValidCacheFile(cachePath: string): boolean {
    try {
        const metadata = readMetadata(cachePath);
        if (!metadata?.complete || !fs.existsSync(cachePath)) return false;

        const stat = fs.statSync(cachePath);
        return stat.isFile() && stat.size === metadata.totalSize && stat.size > MIN_VALID_CACHE_SIZE;
    } catch {
        return false;
    }
}

function parseRangeHeader(rangeHeader: string | undefined, fileSize: number): RangeValue | null {
    if (!rangeHeader || fileSize <= 0) return null;

    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match) return null;

    const [, rawStart, rawEnd] = match;
    if (!rawStart && !rawEnd) return null;

    let start: number;
    let end: number;

    if (!rawStart) {
        const suffixLength = Number.parseInt(rawEnd, 10);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) return null;
        start = Math.max(fileSize - suffixLength, 0);
        end = fileSize - 1;
    } else {
        start = Number.parseInt(rawStart, 10);
        end = rawEnd ? Number.parseInt(rawEnd, 10) : fileSize - 1;
    }

    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    if (start < 0 || start >= fileSize || end < start) return null;

    return {
        start,
        end: Math.min(end, fileSize - 1),
    };
}

function isSeekRange(rangeHeader: string | undefined): boolean {
    if (!rangeHeader) return false;
    const range = /^bytes=(\d*)-/.exec(rangeHeader.trim());
    return !!range?.[1] && Number.parseInt(range[1], 10) > 0;
}

function sendError(res: http.ServerResponse, statusCode: number, message: string): void {
    if (res.destroyed || res.writableEnded) return;

    if (!res.headersSent) {
        res.writeHead(statusCode, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-store',
        });
    }

    res.end(message);
}

function setCommonHeaders(res: http.ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type');
}

function serveFromCache(req: http.IncomingMessage, res: http.ServerResponse, filePath: string): boolean {
    try {
        const metadata = readMetadata(filePath);
        if (!metadata) return false;

        const fileSize = fs.statSync(filePath).size;
        const range = parseRangeHeader(req.headers.range, fileSize);
        const contentType = metadata.contentType || 'audio/mpeg';

        if (req.method === 'HEAD') {
            res.writeHead(200, {
                'Content-Length': fileSize,
                'Content-Type': contentType,
                'Accept-Ranges': 'bytes',
                'X-Proxy-Cache': 'HIT',
            });
            res.end();
            return true;
        }

        if (req.headers.range && !range) {
            res.writeHead(416, {
                'Content-Range': `bytes */${fileSize}`,
                'Accept-Ranges': 'bytes',
            });
            res.end();
            return true;
        }

        const streamRange = range || { start: 0, end: fileSize - 1 };
        const statusCode = range ? 206 : 200;
        const contentLength = streamRange.end - streamRange.start + 1;
        const headers: http.OutgoingHttpHeaders = {
            'Content-Length': contentLength,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'X-Proxy-Cache': 'HIT',
        };

        if (range) {
            headers['Content-Range'] = `bytes ${range.start}-${range.end}/${fileSize}`;
        }

        res.writeHead(statusCode, headers);

        const fileStream = fs.createReadStream(filePath, streamRange);
        fileStream.once('error', (err) => {
            console.error('[Proxy] Cache read error:', err);
            sendError(res, 500, 'Cache read error');
        });
        res.once('close', () => fileStream.destroy());
        fileStream.pipe(res);
        return true;
    } catch (err) {
        console.error('[Proxy] Failed to serve cache:', err);
        return false;
    }
}

function serveFromPartialCache(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    task: DownloadTask,
): boolean {
    try {
        if (!req.headers.range || task.totalSize <= 0 || !fs.existsSync(task.tempPath)) return false;

        const range = parseRangeHeader(req.headers.range, task.totalSize);
        if (!range) return false;

        const actualSize = fs.statSync(task.tempPath).size;
        if (range.end >= actualSize) return false;

        res.writeHead(206, {
            'Content-Range': `bytes ${range.start}-${range.end}/${task.totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': range.end - range.start + 1,
            'Content-Type': task.contentType || 'audio/mpeg',
            'X-Proxy-Cache': 'PARTIAL',
        });

        const fileStream = fs.createReadStream(task.tempPath, range);
        fileStream.once('error', (err) => {
            console.error('[Proxy] Partial cache read error:', err);
            sendError(res, 500, 'Partial cache read error');
        });
        res.once('close', () => fileStream.destroy());
        fileStream.pipe(res);
        return true;
    } catch (err) {
        console.warn('[Proxy] Failed to serve partial cache:', err);
        return false;
    }
}

async function writeChunk(stream: Writable, chunk: Buffer): Promise<void> {
    if (stream.destroyed || stream.writableEnded) return;
    if (stream.write(chunk)) return;

    await new Promise<void>((resolve, reject) => {
        const onDrain = () => cleanup(resolve);
        const onError = (err: Error) => cleanup(() => reject(err));
        const cleanup = (done: () => void) => {
            stream.off('drain', onDrain);
            stream.off('error', onError);
            done();
        };

        stream.once('drain', onDrain);
        stream.once('error', onError);
    });
}

async function endWritable(stream: Writable): Promise<void> {
    if (stream.destroyed || stream.writableEnded) return;

    await new Promise<void>((resolve, reject) => {
        const onFinish = () => cleanup(resolve);
        const onError = (err: Error) => cleanup(() => reject(err));
        const cleanup = (done: () => void) => {
            stream.off('finish', onFinish);
            stream.off('error', onError);
            done();
        };

        stream.once('finish', onFinish);
        stream.once('error', onError);
        stream.end();
    });
}

function responseBodyToNodeStream(response: Response): Readable {
    if (!response.body) {
        throw new ProxyHttpError(502, 'Upstream response has no body');
    }

    return Readable.fromWeb(response.body as any);
}

function buildUpstreamHeaders(range?: string): Record<string, string> {
    const headers: Record<string, string> = {
        'User-Agent': USER_AGENT,
        'Accept': '*/*',
    };

    if (range) headers.Range = range;
    return headers;
}

async function proxyDirect(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetUrl: string,
    fallbackContentType = 'audio/mpeg',
): Promise<void> {
    const controller = new AbortController();
    let completed = false;

    const abortIfClientGone = () => {
        if (!completed) controller.abort();
    };
    res.once('close', abortIfClientGone);

    try {
        const response = await fetch(targetUrl, {
            method: req.method === 'HEAD' ? 'HEAD' : 'GET',
            headers: buildUpstreamHeaders(req.headers.range),
            signal: controller.signal,
        });

        if (!response.ok && response.status !== 206) {
            throw new ProxyHttpError(response.status, response.statusText || 'Upstream error');
        }

        const contentType = response.headers.get('content-type') || fallbackContentType;
        const contentLength = response.headers.get('content-length');
        const contentRange = response.headers.get('content-range');
        const headers: http.OutgoingHttpHeaders = {
            'Content-Type': contentType,
            'Accept-Ranges': response.headers.get('accept-ranges') || 'bytes',
            'X-Proxy-Cache': 'BYPASS',
        };

        if (contentLength) headers['Content-Length'] = contentLength;
        if (contentRange) headers['Content-Range'] = contentRange;

        res.writeHead(response.status === 206 ? 206 : 200, headers);

        if (req.method === 'HEAD') {
            completed = true;
            res.end();
            return;
        }

        const upstream = responseBodyToNodeStream(response);
        await new Promise<void>((resolve, reject) => {
            upstream.once('error', reject);
            upstream.once('end', resolve);
            upstream.pipe(res);
        });
        completed = true;
    } catch (err: any) {
        if (err?.name === 'AbortError') return;
        throw err;
    } finally {
        completed = true;
        res.off('close', abortIfClientGone);
    }
}

function cancelDownloadsExcept(exceptPath: string): void {
    for (const [cachePath, task] of downloadTasks) {
        if (cachePath === exceptPath) continue;

        console.log(`[Proxy] Cancelling stale download: ${cachePath}`);
        task.abortController.abort();
    }

    if (downloadTasks.size <= MAX_ACTIVE_DOWNLOADS) return;

    for (const [cachePath, task] of downloadTasks) {
        if (cachePath === exceptPath) continue;
        task.abortController.abort();
    }
}

function createDownloadTask(targetUrl: string, cacheFilePath: string): DownloadTask {
    const abortController = new AbortController();
    const tempPath = getTempPath(cacheFilePath);
    const task: DownloadTask = {
        cacheFilePath,
        tempPath,
        currentSize: 0,
        totalSize: 0,
        contentType: 'audio/mpeg',
        abortController,
        promise: Promise.resolve(),
    };

    task.promise = downloadToCache(targetUrl, task).finally(() => {
        if (downloadTasks.get(cacheFilePath) === task) {
            downloadTasks.delete(cacheFilePath);
        }
    });

    return task;
}

function startBackgroundDownload(targetUrl: string, cacheFilePath: string): DownloadTask {
    const existing = downloadTasks.get(cacheFilePath);
    if (existing) return existing;

    cancelDownloadsExcept(cacheFilePath);

    const task = createDownloadTask(targetUrl, cacheFilePath);
    downloadTasks.set(cacheFilePath, task);
    task.promise.catch((err) => {
        if (err?.name !== 'AbortError') {
            console.warn('[Proxy] Background cache download failed:', err);
        }
    });
    return task;
}

async function downloadToCache(targetUrl: string, task: DownloadTask): Promise<void> {
    removeFileIfExists(task.tempPath);

    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: buildUpstreamHeaders(),
        signal: task.abortController.signal,
    });

    if (!response.ok) {
        throw new ProxyHttpError(response.status, response.statusText || 'Cache download failed');
    }

    const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
    if (!contentLength) {
        console.warn('[Proxy] Upstream has no content-length; skipping cache');
        return;
    }

    task.totalSize = contentLength;
    task.contentType = response.headers.get('content-type') || 'audio/mpeg';

    const upstream = responseBodyToNodeStream(response);
    const fileStream = fs.createWriteStream(task.tempPath);

    console.log(`[Proxy] Cache download started: ${task.cacheFilePath} (${contentLength} bytes)`);

    try {
        for await (const chunk of upstream) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
            task.currentSize += buffer.length;
            await writeChunk(fileStream, buffer);
        }

        await endWritable(fileStream);
        finalizeCacheFile(task);
    } catch (err) {
        fileStream.destroy();
        removeFileIfExists(task.tempPath);
        throw err;
    }
}

function finalizeCacheFile(task: DownloadTask): void {
    const stat = fs.statSync(task.tempPath);
    if (stat.size !== task.totalSize || stat.size <= MIN_VALID_CACHE_SIZE) {
        removeFileIfExists(task.tempPath);
        throw new Error(`Incomplete cache file: ${stat.size}/${task.totalSize}`);
    }

    removeFileIfExists(task.cacheFilePath);
    fs.renameSync(task.tempPath, task.cacheFilePath);
    writeMetadata(task.cacheFilePath, {
        totalSize: task.totalSize,
        contentType: task.contentType,
        complete: true,
        createdAt: Date.now(),
    });
    console.log(`[Proxy] Cache download complete: ${task.cacheFilePath}`);
}

async function streamAndCache(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    targetUrl: string,
    cacheFilePath: string,
): Promise<void> {
    cancelDownloadsExcept(cacheFilePath);

    const existingTask = downloadTasks.get(cacheFilePath);
    if (existingTask) {
        if (serveFromPartialCache(req, res, existingTask)) return;
        await proxyDirect(req, res, targetUrl, existingTask.contentType);
        return;
    }

    const controller = new AbortController();
    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: buildUpstreamHeaders(),
        signal: controller.signal,
    });

    if (!response.ok) {
        throw new ProxyHttpError(response.status, response.statusText || 'Upstream error');
    }

    const contentLength = Number.parseInt(response.headers.get('content-length') || '0', 10);
    const contentType = response.headers.get('content-type') || 'audio/mpeg';

    if (!contentLength) {
        console.warn('[Proxy] Upstream has no content-length; streaming without cache');
        const upstream = responseBodyToNodeStream(response);
        let completed = false;
        const abortIfClientGone = () => {
            if (!completed) {
                controller.abort();
                upstream.destroy();
            }
        };

        res.once('close', abortIfClientGone);
        res.writeHead(200, {
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'X-Proxy-Cache': 'BYPASS',
        });

        try {
            await new Promise<void>((resolve, reject) => {
                upstream.once('error', reject);
                upstream.once('end', resolve);
                upstream.pipe(res);
            });
            completed = true;
        } finally {
            completed = true;
            res.off('close', abortIfClientGone);
        }
        return;
    }

    const tempPath = getTempPath(cacheFilePath);
    removeCacheFiles(cacheFilePath);

    const task: DownloadTask = {
        cacheFilePath,
        tempPath,
        currentSize: 0,
        totalSize: contentLength,
        contentType,
        abortController: controller,
        promise: Promise.resolve(),
    };
    downloadTasks.set(cacheFilePath, task);

    const upstream = responseBodyToNodeStream(response);
    const fileStream = fs.createWriteStream(tempPath);
    let clientConnected = true;
    let cacheWritable = true;

    res.once('close', () => {
        clientConnected = false;
    });

    res.writeHead(200, {
        'Content-Length': contentLength,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'X-Proxy-Cache': 'MISS',
    });

    try {
        for await (const chunk of upstream) {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
            task.currentSize += buffer.length;

            if (cacheWritable) {
                try {
                    await writeChunk(fileStream, buffer);
                } catch (err) {
                    cacheWritable = false;
                    fileStream.destroy();
                    removeFileIfExists(tempPath);
                    console.warn('[Proxy] Cache write failed; continuing response without cache:', err);
                }
            }

            if (clientConnected && !res.writableEnded) {
                await writeChunk(res, buffer);
            }
        }

        if (cacheWritable) {
            await endWritable(fileStream);
            finalizeCacheFile(task);
        }

        if (clientConnected && !res.writableEnded) {
            res.end();
        }
    } catch (err) {
        fileStream.destroy();
        removeFileIfExists(tempPath);
        if (!res.headersSent) {
            sendError(res, err instanceof ProxyHttpError ? err.statusCode : 502, 'Proxy stream error');
        } else if (!res.writableEnded) {
            res.destroy();
        }
        throw err;
    } finally {
        if (downloadTasks.get(cacheFilePath) === task) {
            downloadTasks.delete(cacheFilePath);
        }
    }
}

async function handleMusicRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const parsedUrl = new URL(req.url || '', `http://127.0.0.1:${PORT}`);
    const id = parsedUrl.searchParams.get('id');
    const source = parsedUrl.searchParams.get('source');
    const quality = parsedUrl.searchParams.get('quality') || 'standard';

    if (!id || !source) {
        sendError(res, 400, 'Missing id or source');
        return;
    }

    const cacheKey = `${source}:${id}:${quality}`;
    const cacheFilePath = getCachePath(source, id, quality);

    if (isValidCacheFile(cacheFilePath)) {
        if (serveFromCache(req, res, cacheFilePath)) return;
        console.warn('[Proxy] Cache metadata/file mismatch; removing stale cache');
        removeCacheFiles(cacheFilePath);
    }

    let playUrl = await resolvePlayUrl(source, id, quality);
    if (!playUrl) {
        sendError(res, 502, 'Failed to obtain playback URL');
        return;
    }

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const activeTask = downloadTasks.get(cacheFilePath);

            if (req.method === 'HEAD') {
                await proxyDirect(req, res, playUrl);
            } else if (activeTask) {
                if (!serveFromPartialCache(req, res, activeTask)) {
                    await proxyDirect(req, res, playUrl, activeTask.contentType);
                }
            } else if (isSeekRange(req.headers.range)) {
                startBackgroundDownload(playUrl, cacheFilePath);
                await proxyDirect(req, res, playUrl);
            } else {
                await streamAndCache(req, res, playUrl, cacheFilePath);
            }
            return;
        } catch (err: any) {
            // 响应已开始后客户端断开/abort (切歌/seek 取消下载): 属正常, 不刷屏
            const benign = err?.name === 'AbortError' ||
                /ECONNRESET|EPIPE|aborted|socket hang up/i.test(err?.message || '');
            if (res.headersSent || res.writableEnded || res.destroyed) {
                if (!benign) console.warn('[Proxy] Request failed after response started:', err);
                return;
            }

            if (benign) {
                // 客户端取消, 静默结束
                try { res.destroy(); } catch {}
                return;
            }

            console.warn(`[Proxy] Request failed (${attempt}/${maxAttempts}) for ${cacheKey}:`, err);

            if (attempt < maxAttempts) {
                playUrl = await resolvePlayUrl(source, id, quality, true);
                if (playUrl) continue;
            }

            const statusCode = err instanceof ProxyHttpError ? err.statusCode : 502;
            sendError(res, statusCode, 'Proxy Error');
            return;
        }
    }
}

export function getCacheDir(): string {
    return ensureCacheDir();
}

export function getCacheSize(): string {
    const dir = ensureCacheDir();
    if (!fs.existsSync(dir)) return '0 B';

    let totalSize = 0;
    try {
        for (const file of fs.readdirSync(dir)) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isFile()) totalSize += stat.size;
        }
    } catch (err) {
        console.error('[Proxy] Failed to calculate cache size:', err);
    }

    if (totalSize < 1024) return `${totalSize} B`;
    if (totalSize < 1024 * 1024) return `${(totalSize / 1024).toFixed(1)} KB`;
    if (totalSize < 1024 * 1024 * 1024) return `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
    return `${(totalSize / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function isPersistCacheEnabled(): boolean {
    return persistCacheEnabled;
}

export function setPersistCache(persist: boolean): void {
    persistCacheEnabled = persist;
    console.log(`[Proxy] Cache persistence set to: ${persist}`);
}

function abortAllDownloads(): void {
    for (const [, task] of downloadTasks) {
        task.abortController.abort();
    }
    downloadTasks.clear();
}

export function clearCacheNow(): void {
    const dir = ensureCacheDir();
    abortAllDownloads();
    urlCache.clear();

    try {
        fs.rmSync(dir, { recursive: true, force: true });
        fs.mkdirSync(dir, { recursive: true });
        console.log('[Proxy] Cache cleared');
    } catch (err) {
        console.error('[Proxy] Failed to clear cache:', err);
    }
}

export function cleanupCache(): void {
    abortAllDownloads();

    if (!persistCacheEnabled && CACHE_DIR && fs.existsSync(CACHE_DIR)) {
        try {
            fs.rmSync(CACHE_DIR, { recursive: true, force: true });
            console.log('[Proxy] Cache cleanup complete');
        } catch (err) {
            console.error('[Proxy] Failed to cleanup cache:', err);
        }
    }
}

function cleanupTempFiles(): void {
    const dir = ensureCacheDir();
    const now = Date.now();

    try {
        for (const file of fs.readdirSync(dir)) {
            if (!file.endsWith('.tmp')) continue;

            const tempPath = path.join(dir, file);
            const cachePath = tempPath.slice(0, -4);
            if (downloadTasks.has(cachePath)) continue;

            const stat = fs.statSync(tempPath);
            if (now - stat.mtimeMs > STALE_TEMP_TTL_MS) {
                removeFileIfExists(tempPath);
                console.log(`[Proxy] Removed stale temp cache: ${file}`);
            }
        }
    } catch (err) {
        console.warn('[Proxy] Failed to cleanup temp cache files:', err);
    }
}

export function startProxyServer(persistCache = true): http.Server {
    persistCacheEnabled = persistCache;
    ensureCacheDir();
    cleanupTempFiles();

    if (serverInstance) {
        return serverInstance;
    }

    if (!cleanupTimer) {
        cleanupTimer = setInterval(cleanupTempFiles, 30 * 60 * 1000);
        cleanupTimer.unref?.();
    }

    const server = http.createServer(async (req, res) => {
        setCommonHeaders(res);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method !== 'GET' && req.method !== 'HEAD') {
            sendError(res, 405, 'Method Not Allowed');
            return;
        }

        try {
            const parsedUrl = new URL(req.url || '', `http://127.0.0.1:${PORT}`);
            if (parsedUrl.pathname !== '/music') {
                sendError(res, 404, 'Not Found');
                return;
            }

            await handleMusicRequest(req, res);
        } catch (err) {
            console.error('[Proxy] Internal error:', err);
            sendError(res, 500, 'Internal Server Error');
        }
    });

    server.on('clientError', (err, socket) => {
        // ECONNRESET/EPIPE 等: 客户端切歌/seek 时主动断开, 属正常情况, 不当作错误刷屏
        const msg = err?.message || '';
        if (/ECONNRESET|EPIPE|aborted/i.test(msg)) {
            try { socket.end(); } catch {}
            return;
        }
        console.warn('[Proxy] Client socket error:', msg);
        socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
    });

    server.on('error', (err) => {
        console.error('[Proxy] Server error:', err);
    });

    server.listen(PORT, '127.0.0.1', () => {
        console.log(`[Proxy] Server running at http://127.0.0.1:${PORT}/music`);
        console.log(`[Proxy] Cache dir: ${CACHE_DIR}`);
        console.log(`[Proxy] Persist cache: ${persistCacheEnabled}`);
    });

    serverInstance = server;
    return server;
}

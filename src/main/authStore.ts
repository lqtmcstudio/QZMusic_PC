import { app, shell } from 'electron'
import fs from 'node:fs'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'
import QRCode from 'qrcode'

export const API_BASE_URL = 'https://api.qz.shiqianjiang.cn/app'
const AUTH_LOGIN_URL = `${API_BASE_URL}/auth/login`
const UPLOAD_ENDPOINT = 'https://picgo.re-link.top'
const UPLOAD_TOKEN_SECRET = 'pm9K2nBSseKihywiDH3hiaGJwzyTGQwj'

export interface UserInfo {
    id: string
    username: string
    avatar?: string | null
    nickname?: string | null
    gender?: string | null
    region?: string | null
    intro?: string | null
    birthday?: string | null
    subscribing?: boolean
}

export interface AuthState {
    accessToken: string
    refreshToken: string
    exp: number
    userInfo: UserInfo | null
}

export interface AuthCallbackPayload {
    status: string
    message?: string
    user_info?: UserInfo
    access_token?: string
    refresh_token?: string
    exp?: number
}

export interface QrLoginSession {
    status: string
    session_id: string
    poll_token: string
    qr_payload: string
    qr_data_url: string
    expires_at: number
    expires_in: number
    message?: string
}

export interface QrLoginPollResult extends AuthCallbackPayload {
    state?: AuthState
    device_name?: string
    expires_at?: number
}

const EMPTY_AUTH_STATE: AuthState = {
    accessToken: '',
    refreshToken: '',
    exp: 0,
    userInfo: null,
}

let authCache: AuthState | null = null

function getAuthPath(): string {
    return path.join(app.getPath('userData'), 'auth.json')
}

function normalizeAuthPayload(payload: AuthCallbackPayload): AuthState {
    const rawExp = Number(payload.exp) || 0
    const exp = rawExp > 0 && rawExp < 10_000_000_000 ? rawExp * 1000 : rawExp

    return {
        accessToken: payload.access_token || '',
        refreshToken: payload.refresh_token || '',
        exp,
        userInfo: payload.user_info || null,
    }
}

export function loadAuthState(): AuthState {
    if (authCache) return authCache

    try {
        const authPath = getAuthPath()
        if (fs.existsSync(authPath)) {
            const raw = JSON.parse(fs.readFileSync(authPath, 'utf8'))
            const nextState = { ...EMPTY_AUTH_STATE, ...raw }
            if (nextState.exp > 0 && nextState.exp < 10_000_000_000) {
                nextState.exp *= 1000
            }
            authCache = nextState
            return nextState
        }
    } catch (err) {
        console.error('[Auth] Failed to load auth state:', err)
    }

    const nextState = { ...EMPTY_AUTH_STATE }
    authCache = nextState
    return nextState
}

export function saveAuthState(nextState: AuthState): AuthState {
    authCache = { ...EMPTY_AUTH_STATE, ...nextState }
    try {
        fs.writeFileSync(getAuthPath(), JSON.stringify(authCache, null, 2), 'utf8')
    } catch (err) {
        console.error('[Auth] Failed to save auth state:', err)
    }
    return authCache
}

export function clearAuthState(): AuthState {
    authCache = { ...EMPTY_AUTH_STATE }
    try {
        if (fs.existsSync(getAuthPath())) fs.unlinkSync(getAuthPath())
    } catch (err) {
        console.error('[Auth] Failed to clear auth state:', err)
    }
    return authCache
}

export async function openLoginPage(forcePrompt = false): Promise<{ success: boolean; url: string }> {
    const url = forcePrompt ? `${AUTH_LOGIN_URL}?prompt=login` : AUTH_LOGIN_URL
    await shell.openExternal(url)
    return { success: true, url }
}

async function authQrFetch<T>(pathname: string, body: any): Promise<T> {
    const resp = await fetch(`${API_BASE_URL}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!resp.ok) {
        const message = await resp.text().catch(() => '')
        throw new Error(message || `Request failed: ${resp.status}`)
    }
    return resp.json() as Promise<T>
}

export async function createQrLoginSession(): Promise<QrLoginSession> {
    const deviceName = `${app.getName() || 'QZMusic'} on ${os.hostname() || process.platform}`
    const payload = await authQrFetch<Omit<QrLoginSession, 'qr_data_url'>>('/auth/qr/session', {
        device_name: deviceName,
        client: 'qzmusic-electron',
        platform: process.platform,
    })
    if (payload.status !== 'success') {
        throw new Error(payload.message || 'Create QR login session failed')
    }
    const qrDataUrl = await QRCode.toDataURL(payload.qr_payload, {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 256,
    })
    return { ...payload, qr_data_url: qrDataUrl }
}

export async function pollQrLoginSession(sessionId: string, pollToken: string): Promise<QrLoginPollResult> {
    const payload = await authQrFetch<QrLoginPollResult>('/auth/qr/poll', {
        session_id: sessionId,
        poll_token: pollToken,
    })
    if (payload.status === 'success' && payload.access_token) {
        const state = acceptAuthCallback(payload)
        return { ...payload, state }
    }
    return payload
}

export async function cancelQrLoginSession(sessionId: string, pollToken: string): Promise<any> {
    return authQrFetch('/auth/qr/cancel', {
        session_id: sessionId,
        poll_token: pollToken,
    })
}

export function acceptAuthCallback(payload: AuthCallbackPayload): AuthState {
    if (payload.status !== 'success') {
        throw new Error(payload.message || 'Login failed')
    }

    const nextState = normalizeAuthPayload(payload)
    if (!nextState.accessToken || !nextState.refreshToken || !nextState.userInfo?.id) {
        throw new Error('Invalid login response')
    }
    return saveAuthState(nextState)
}

export async function refreshAuthState(): Promise<AuthState> {
    const state = loadAuthState()
    if (!state.accessToken || !state.refreshToken) return state

    const resp = await fetch(`${API_BASE_URL}/auth/refresh_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            access_token: state.accessToken,
            refresh_token: state.refreshToken,
        }),
    })
    if (!resp.ok) {
        throw new Error(`Refresh token failed: ${resp.status}`)
    }

    const payload = await resp.json() as AuthCallbackPayload
    if (payload.status !== 'success') {
        throw new Error(payload.message || 'Login expired')
    }
    const refreshed = normalizeAuthPayload(payload)
    return saveAuthState({
        ...state,
        ...refreshed,
        userInfo: refreshed.userInfo || state.userInfo,
    })
}

export async function getValidAccessToken(): Promise<string> {
    const state = loadAuthState()
    if (!state.accessToken) return ''

    if (Date.now() > state.exp - 60_000) {
        const refreshed = await refreshAuthState()
        return refreshed.accessToken
    }
    return state.accessToken
}

export async function qzFetch(pathname: string, init: RequestInit = {}): Promise<any> {
    const token = await getValidAccessToken()
    const headers = new Headers(init.headers)
    headers.set('Content-Type', headers.get('Content-Type') || 'application/json')
    if (token) headers.set('Authorization', `Bearer ${token}`)

    const resp = await fetch(`${API_BASE_URL}${pathname}`, {
        ...init,
        headers,
    })
    if (!resp.ok) {
        const message = await resp.text().catch(() => '')
        throw new Error(message || `Request failed: ${resp.status}`)
    }
    if (resp.status === 204) return null
    return resp.json()
}

function mimeForImage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    if (ext === '.png') return 'image/png'
    if (ext === '.webp') return 'image/webp'
    if (ext === '.gif') return 'image/gif'
    return 'image/jpeg'
}

function uploadToken(userId: string, timestamp: string): string {
    return crypto
        .createHmac('sha256', UPLOAD_TOKEN_SECRET)
        .update(`${userId}.${timestamp}`)
        .digest('hex')
}

export async function uploadImage(filePath: string): Promise<{ success: boolean; url?: string; message?: string }> {
    const state = loadAuthState()
    const userId = state.userInfo?.id
    if (!userId) throw new Error('Not logged in')
    if (!fs.existsSync(filePath)) throw new Error('Image file not found')

    const timestamp = Math.floor(Date.now() / 1000).toString()
    const form = new FormData()
    form.append('userid', userId)
    form.append('timestamp', timestamp)
    form.append('token', uploadToken(userId, timestamp))
    form.append(
        'file',
        new Blob([new Uint8Array(fs.readFileSync(filePath))], { type: mimeForImage(filePath) }),
        path.basename(filePath),
    )

    const resp = await fetch(UPLOAD_ENDPOINT, {
        method: 'POST',
        headers: {
            Origin: 'https://re-link.top',
        },
        body: form,
    })
    const text = await resp.text()
    if (!resp.ok) {
        throw new Error(text || `Upload failed: ${resp.status}`)
    }
    const data = JSON.parse(text)
    if (!data?.ok) {
        throw new Error(data?.message || 'Upload failed')
    }
    const url = String(data.url || data.display_url || '')
    if (!url) throw new Error('Upload response missing url')
    return { success: true, url }
}

export function getListenTogetherWsUrl(params: Record<string, string>): string {
    const query = new URLSearchParams(params)
    return `wss://interface.qz.folltoshe.com/ws?${query.toString()}`
}

export async function sendPcHeartbeat(duration: number, timestamp = Date.now()): Promise<any> {
    return qzFetch('/heartbeat/pc', {
        method: 'POST',
        body: JSON.stringify({ duration, timestamp }),
    })
}

export async function getListenTime(detail = 1, userId?: string): Promise<any> {
    const state = loadAuthState()
    const targetUserId = userId || state.userInfo?.id
    if (!targetUserId) throw new Error('Not logged in')
    return qzFetch(`/user/${encodeURIComponent(targetUserId)}/stat/listen/time?detail=${detail}`)
}

export async function getListenTimeRange(start: string, end: string, userId?: string): Promise<any> {
    const state = loadAuthState()
    const targetUserId = userId || state.userInfo?.id
    if (!targetUserId) throw new Error('Not logged in')
    const query = new URLSearchParams({ start, end })
    return qzFetch(`/user/${encodeURIComponent(targetUserId)}/stat/listen/range?${query.toString()}`)
}

export async function getListenRank(period: 'week' | 'month' | 'year' = 'week', limit = 200): Promise<any> {
    const query = new URLSearchParams({ period, limit: String(Math.max(1, Math.min(200, limit))) })
    return qzFetch(`/user/stat/listen/rank?${query.toString()}`)
}

export async function getUserProfile(userId: string): Promise<UserInfo> {
    if (!userId) throw new Error('Missing user id')
    return qzFetch(`/user/${encodeURIComponent(userId)}/info`)
}

export async function getUserPublicPlaylists(userId: string): Promise<any[]> {
    if (!userId) throw new Error('Missing user id')
    const result = await qzFetch(`/user/${encodeURIComponent(userId)}/playlists`)
    return Array.isArray(result) ? result : []
}

export async function getUserPublicFavSongs(userId: string): Promise<any[]> {
    if (!userId) throw new Error('Missing user id')
    const result = await qzFetch(`/user/${encodeURIComponent(userId)}/fav/songs`)
    return Array.isArray(result) ? result : []
}

export async function updateCurrentUserProfile(payload: Partial<UserInfo>): Promise<UserInfo> {
    const state = loadAuthState()
    const userId = state.userInfo?.id
    if (!userId) throw new Error('Not logged in')
    await qzFetch(`/user/${encodeURIComponent(userId)}/info`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
    const userInfo = await getUserProfile(userId)
    saveAuthState({ ...state, userInfo })
    return userInfo
}

export async function getLibraryPrivacy(): Promise<{ status: string; allow_public_library: boolean; allow_public_profile: boolean; allow_public_following: boolean }> {
    const state = loadAuthState()
    const userId = state.userInfo?.id
    if (!userId) throw new Error('Not logged in')
    return qzFetch(`/user/${encodeURIComponent(userId)}/privacy/library`)
}

export async function setLibraryPrivacy(payload: { allow_public_library?: boolean; allow_public_profile?: boolean; allow_public_following?: boolean }): Promise<{ status: string; allow_public_library: boolean; allow_public_profile: boolean; allow_public_following: boolean }> {
    const state = loadAuthState()
    const userId = state.userInfo?.id
    if (!userId) throw new Error('Not logged in')
    return qzFetch(`/user/${encodeURIComponent(userId)}/privacy/library`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
    })
}

// === Recent Plays ===

export async function getRecentSongs(userId: string): Promise<any[]> {
    if (!userId) throw new Error('Missing user id')
    const result = await qzFetch(`/user/${encodeURIComponent(userId)}/recent/songs`)
    return Array.isArray(result) ? result : []
}

export async function addRecentSong(userId: string, song: any): Promise<any> {
    if (!userId) throw new Error('Missing user id')
    return qzFetch(`/user/${encodeURIComponent(userId)}/recent/songs`, {
        method: 'POST',
        body: JSON.stringify(song),
    })
}

// === Playlist Likes ===

export async function togglePlaylistLike(playlistId: string): Promise<{ status: string; liked: boolean; like_count: number }> {
    return qzFetch(`/playlist/${encodeURIComponent(playlistId)}/like`, {
        method: 'POST',
    })
}

export async function getPlaylistLike(playlistId: string): Promise<{ status: string; liked: boolean; like_count: number }> {
    return qzFetch(`/playlist/${encodeURIComponent(playlistId)}/like`)
}

// === User Follow ===

export async function toggleUserFollow(targetUserId: string): Promise<{ status: string; subscribing: boolean }> {
    return qzFetch(`/user/${encodeURIComponent(targetUserId)}/subscribes`, {
        method: 'PATCH',
    })
}

export async function getUserSubscriptions(targetUserId: string): Promise<{ status: string; fans: number; subs: number; fans_list?: string[]; subs_list?: string[]; can_view_subs?: boolean }> {
    return qzFetch(`/user/${encodeURIComponent(targetUserId)}/subscribes`)
}

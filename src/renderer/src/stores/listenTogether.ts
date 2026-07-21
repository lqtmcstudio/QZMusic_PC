import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { Song } from '../types/song'
import { calibrateTime } from './timeCalibrator'

type RoomMode = 'dual' | 'multi'
type ServerAction =
  | 'ROOM_CREATED'
  | 'SYNC_PROPERTIES'
  | 'PING'
  | 'UPDATE'
  | 'SYNC'
  | 'SUCCESS'
  | 'ROOM_CLOSED'
  | 'ERROR'

interface ServerMessage {
  action: ServerAction
  data?: any
}

let socket: WebSocket | null = null
let calibrateTimer: ReturnType<typeof setInterval> | null = null
// 加入房间时, room_id 只放进 WS 查询参数; 服务端对加入者只回 SYNC_PROPERTIES(不含 room_id),
// 故在此暂存, 等 SYNC_PROPERTIES 到达时补回 roomId(与移动端 tempTargetRoomId 同思路)。
let pendingRoomId: string | null = null
// 本端最近一次主动操作时间戳, 供心跳自愈宽限: 2s 内不应用心跳纠正, 避免回退自己刚发的乐观操作。
let lastActionAt = 0

export const useListenTogetherStore = defineStore('listenTogether', () => {
  const connecting = ref(false)
  const connected = ref(false)
  const roomId = ref('')
  const mode = ref<RoomMode>('multi')
  const permissionLevel = ref(0)
  const userList = ref<string[]>([])
  const allPermissions = ref<Record<string, number>>({})
  const listVersion = ref(0)
  const lastError = ref('')
  const isApplyingRemote = ref(false)
  // 刚应用的远端 playing 值。用于在 isApplyingRemote 窗口内区分「回声」(值=远端) 与「用户真实操作」
  // (值≠远端): 仅回声被抑制, 用户真实 play/pause 一律下发, 避免被时间窗吞掉。
  const lastAppliedPlaying = ref<boolean | null>(null)

  const canControl = computed(() => connected.value && permissionLevel.value >= 1)
  const isHost = computed(() => connected.value && permissionLevel.value >= 2)

  const resetRoomState = () => {
    connected.value = false
    connecting.value = false
    roomId.value = ''
    pendingRoomId = null
    permissionLevel.value = 0
    userList.value = []
    allPermissions.value = {}
    listVersion.value = 0
  }

  const sendRaw = (action: string, data: Record<string, any> = {}) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false
    console.log('[LT] →', action, data)
    socket.send(JSON.stringify({ action, data }))
    return true
  }

  const sendAction = (action: string, data: Record<string, any> = {}) => {
    if (!connected.value && action !== 'PONG') return false
    lastActionAt = Date.now()
    return sendRaw(action, data)
  }

  const getPlayer = async () => {
    const mod = await import('./player')
    return mod.usePlayerStore()
  }

  // 应用服务端权威同步包 (外推时间轴)。控制者(有写权)对心跳 PING 不应用, 避免与本地乐观操作竞态。
  const applyRemoteState = async (data: any, isHeartbeat = false) => {
    const player = await getPlayer()
    // 标记即将应用的远端 playing 值, 供 notifyTogetherPlayback 区分回声与用户真实操作
    lastAppliedPlaying.value = Boolean(data.playing)
    isApplyingRemote.value = true
    try {
      await player.applyTogetherState(data, isHeartbeat)
    } finally {
      window.setTimeout(() => {
        isApplyingRemote.value = false
      }, 120)
    }
  }

  // host 建房后把自己的当前播放状态播种到服务端时间轴
  const sendCurrentSnapshot = async () => {
    if (!canControl.value) return
    const player = await getPlayer()
    if (player.playlist.length > 0) {
      sendAction('SET', {
        baseListVersion: listVersion.value,
        list: player.playlist,
        currentIndex: Math.max(0, player.currentIndex),
      })
    }
    // 用 SEEK 意图锚定服务端位置基准, 再 PLAY/PAUSE
    sendAction('SEEK', { currentMs: Math.max(0, Math.floor(player.currentTime || 0)) })
    sendAction(player.isPlaying ? 'PLAY' : 'PAUSE')
  }

  const handleMessage = async (message: ServerMessage) => {
    const data = message.data || {}

    switch (message.action) {
      case 'ROOM_CREATED':
        roomId.value = data.room_id || ''
        connected.value = true
        connecting.value = false
        permissionLevel.value = 2
        lastError.value = ''
        ElMessage.success('一起听房间已创建')
        await sendCurrentSnapshot()
        break

      case 'SYNC_PROPERTIES':
        permissionLevel.value = Number(data.permission_level ?? permissionLevel.value)
        mode.value = data.mode === 'dual' ? 'dual' : 'multi'
        userList.value = Array.isArray(data.user_list) ? data.user_list : []
        allPermissions.value = data.all_permissions || {}
        // 加入者: 服务端不在 SYNC_PROPERTIES 里回 room_id, 用 pendingRoomId 补回
        if (!roomId.value && pendingRoomId) roomId.value = pendingRoomId
        break

      case 'PING':
        sendRaw('PONG')
        // 房主(level2)本地音频是时间轴基准不应用; 其余(level<2, 含二人房听众 level1)用心跳
        // 纠正漂移, 自愈漏掉的 SYNC。lastActionAt 宽限 2s, 避免回退自己刚发的乐观操作。
        if (permissionLevel.value < 2 && Date.now() - lastActionAt > 2000) await applyRemoteState(data, true)
        break

      case 'SYNC':
      case 'UPDATE':
        if (typeof data.listVersion === 'number') listVersion.value = data.listVersion
        await applyRemoteState(data, false)
        break

      case 'SUCCESS':
        if (typeof data.listVersion === 'number') listVersion.value = data.listVersion
        break

      case 'ROOM_CLOSED':
        ElMessage.info('一起听房间已关闭')
        disconnect(false)
        break

      case 'ERROR':
        lastError.value = data.msg || '一起听同步失败'
        ElMessage.warning(lastError.value)
        // 409 时服务端已附带 UPDATE 强制重同步, 无需再 GET
        break
    }
  }

  const connect = async (params: Record<string, string>) => {
    disconnect(false)
    connecting.value = true
    lastError.value = ''

    // 创建房间无 room_id(待服务端分配); 加入房间暂存目标 room_id 以便后续补回
    pendingRoomId = params.room_id || null

    calibrateTime().catch(() => {})

    // 周期性重校时钟, 抵抗长会话时钟漂移
    if (calibrateTimer) clearInterval(calibrateTimer)
    calibrateTimer = setInterval(() => {
      calibrateTime().catch(() => {})
    }, 120000)

    try {
      const url = await window.electronAPI.listenTogether.getWsUrl(params)
      socket = new WebSocket(url)

      socket.onopen = () => {
        connected.value = true
        connecting.value = false
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          console.log('[LT] ←', message.action, message.data)
          handleMessage(message).catch(console.error)
        } catch (error) {
          console.warn('[ListenTogether] Invalid message:', error)
        }
      }

      socket.onerror = () => {
        lastError.value = '一起听连接失败'
        connecting.value = false
      }

      socket.onclose = () => {
        socket = null
        if (calibrateTimer) {
          clearInterval(calibrateTimer)
          calibrateTimer = null
        }
        resetRoomState()
      }
    } catch (error: any) {
      connecting.value = false
      lastError.value = error?.message || '一起听连接失败'
      ElMessage.error(lastError.value)
    }
  }

  const createRoom = async (nextMode: RoomMode) => {
    mode.value = nextMode
    await connect({ mode: nextMode })
  }

  const joinRoom = async (targetRoomId: string) => {
    const normalized = targetRoomId.trim()
    if (!normalized) return
    await connect({ room_id: normalized })
  }

  const disconnect = (notifyServer = true) => {
    if (calibrateTimer) {
      clearInterval(calibrateTimer)
      calibrateTimer = null
    }
    if (notifyServer && socket?.readyState === WebSocket.OPEN && isHost.value) {
      sendRaw('CLOSE_ROOM')
    }
    if (socket) {
      socket.close(1000)
      socket = null
    }
    resetRoomState()
  }

  // ===== 事件发送 (intent): 客户端只发事件, 不写时间同步状态 =====

  const sendPlayback = (playing: boolean, currentMs?: number) => {
    if (!canControl.value) return
    if (playing) {
      sendAction('PLAY')
    } else {
      // PAUSE 携带控制器真实位置, 避免服务端用外推捕获到卡顿期膨胀位置
      sendAction('PAUSE', { currentMs: Math.max(0, Math.floor(currentMs ?? 0)) })
    }
  }

  const sendSeek = (currentMs: number) => {
    if (!canControl.value) return
    sendAction('SEEK', { currentMs: Math.max(0, Math.floor(currentMs || 0)) })
  }

  const sendSelect = (index: number) => {
    if (!canControl.value) return
    sendAction('SELECT', { index: Math.max(0, index) })
  }

  const sendNext = () => {
    if (!canControl.value) return
    sendAction('NEXT')
  }

  const sendPrev = () => {
    if (!canControl.value) return
    sendAction('PREV')
  }

  const sendSetList = (list: Song[], currentIndex?: number) => {
    if (!canControl.value) return
    const payload: Record<string, any> = {
      baseListVersion: listVersion.value,
      list,
    }
    if (typeof currentIndex === 'number') payload.currentIndex = currentIndex
    sendAction('SET', payload)
  }

  const sendAddSong = (song: Song) => {
    if (!canControl.value) return
    sendAction('ADD', { song })
  }

  const sendInsertSong = (song: Song, index: number) => {
    if (!canControl.value) return
    sendAction('INSERT', { index, song })
  }

  const sendRemoveSong = (song: Song, index: number) => {
    if (!canControl.value) return
    sendAction('REMOVE', { song, index })
  }

  // 上报解码时长(播放器加载后得到), 供服务端计算切歌
  const sendMediaLoaded = (index: number, durationMs: number) => {
    if (!connected.value) return
    sendAction('MEDIA_LOADED', { index, durationMs: Math.max(0, Math.floor(durationMs || 0)) })
  }

  // host 播放器真正播完的兜底信号
  const sendEof = (index: number) => {
    if (!canControl.value) return
    sendAction('EOF', { index })
  }

  const changePermission = (targetUserId: string, level: 0 | 1) => {
    if (!isHost.value) return
    sendAction('CHANGE_PERMISSION', { target_user_id: targetUserId, level })
  }

  return {
    connecting,
    connected,
    roomId,
    mode,
    permissionLevel,
    userList,
    allPermissions,
    listVersion,
    lastError,
    isApplyingRemote,
    lastAppliedPlaying,
    canControl,
    isHost,
    createRoom,
    joinRoom,
    disconnect,
    sendCurrentSnapshot,
    sendPlayback,
    sendSeek,
    sendSelect,
    sendNext,
    sendPrev,
    sendSetList,
    sendAddSong,
    sendInsertSong,
    sendRemoveSong,
    sendMediaLoaded,
    sendEof,
    changePermission,
  }
})

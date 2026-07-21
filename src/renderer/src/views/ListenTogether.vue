<template>
  <div class="together-page">
    <section class="room-hero" :style="{ '--room-hero-bg': `url('${roomHeroBg}')` }">
      <div class="hero-copy">
        <div class="eyebrow">
          <Icon icon="lucide:radio-tower" />
          <span>{{ together.connected ? '房间在线' : '一起听' }}</span>
        </div>
        <h1>{{ together.connected ? `房间 ${together.roomId}` : '同步播放室' }}</h1>
        <p>{{ statusText }}</p>
      </div>

      <div class="hero-actions">
        <button v-if="!authStore.isLoggedIn" class="primary-action" @click="openLoginDialog">
          <Icon icon="lucide:log-in" />
          登录
        </button>
        <template v-else-if="!together.connected">
          <button class="primary-action" :disabled="together.connecting" @click="createRoom">
            <Icon :icon="together.connecting ? 'lucide:loader-2' : 'lucide:plus'" :class="{ spin: together.connecting }" />
            创建房间
          </button>
          <button class="soft-action" :disabled="together.connecting || !normalizedJoinCode" @click="joinRoom">
            <Icon icon="lucide:door-open" />
            加入
          </button>
        </template>
        <template v-else>
          <button class="soft-action" :disabled="!together.canControl" @click="together.sendCurrentSnapshot()">
            <Icon icon="lucide:refresh-cw" />
            同步
          </button>
          <button class="danger-action" @click="leaveRoom">
            <Icon icon="lucide:log-out" />
            {{ together.isHost ? '关闭房间' : '离开' }}
          </button>
        </template>
      </div>
    </section>

    <div class="room-grid">
      <section class="control-panel">
        <div class="panel-heading">
          <div>
            <h2>房间</h2>
            <span>{{ permissionText }}</span>
          </div>
          <div class="mode-toggle" :class="{ disabled: together.connected }">
            <button :class="{ active: roomMode === 'multi' }" :disabled="together.connected" @click="roomMode = 'multi'">
              多人
            </button>
            <button :class="{ active: roomMode === 'dual' }" :disabled="together.connected" @click="roomMode = 'dual'">
              双人
            </button>
          </div>
        </div>

        <div v-if="!together.connected" class="join-box">
          <label>
            <span>房间码</span>
            <input v-model="joinText" placeholder="输入或粘贴分享文本" />
          </label>
          <div class="hint-row">
            <span>{{ normalizedJoinCode || '等待房间码' }}</span>
          </div>
        </div>

        <div v-else class="room-code">
          <span>{{ together.roomId }}</span>
          <button @click="copyRoomCode">
            <Icon icon="lucide:copy" />
          </button>
        </div>

        <div class="now-row">
          <div class="song-cover">
            <img v-if="player.currentSong?.pic" :src="player.currentSong.pic" alt="" />
            <Icon v-else icon="lucide:music-2" />
          </div>
          <div class="song-copy">
            <span>{{ player.currentSong?.name || '未播放' }}</span>
            <small>{{ player.currentSong?.artists || 'QZ Music' }}</small>
          </div>
          <div class="play-state" :class="{ playing: player.isPlaying }">
            {{ player.isPlaying ? '播放中' : '已暂停' }}
          </div>
        </div>
      </section>

      <section class="members-panel">
        <div class="panel-heading">
          <div>
            <h2>成员</h2>
            <span>{{ together.userList.length }} 人</span>
          </div>
        </div>

        <div class="member-list">
          <div v-for="uid in together.userList" :key="uid" class="member-item" :class="{ 'is-self': isSelf(uid) }">
            <div class="avatar">
              <img v-if="memberAvatar(uid)" :src="memberAvatar(uid)" alt="" />
              <span v-else>{{ uid.slice(0, 1).toUpperCase() }}</span>
            </div>
            <div class="member-copy">
              <span>{{ memberDisplayName(uid) }}</span>
              <small>{{ permissionLabel(together.allPermissions[uid] ?? 0) }}</small>
            </div>
            <button
              v-if="together.isHost && uid !== authStore.state.userInfo?.id"
              class="permission-btn"
              @click="togglePermission(uid)"
            >
              {{ (together.allPermissions[uid] ?? 0) >= 1 ? '旁听' : '控制' }}
            </button>
          </div>
          <div v-if="together.userList.length === 0" class="empty-state">暂无成员</div>
        </div>
      </section>

      <section class="queue-panel">
        <div class="panel-heading">
          <div>
            <h2>播放队列</h2>
            <span>{{ player.playlist.length }} 首</span>
          </div>
        </div>

        <div class="queue-list">
          <div
            v-for="(song, index) in player.playlist"
            :key="`${song.source}:${song.id}:${index}`"
            class="queue-item"
            :class="{ active: index === player.currentIndex }"
          >
            <span class="queue-index">{{ String(index + 1).padStart(2, '0') }}</span>
            <img v-if="song.pic" :src="song.pic" alt="" />
            <div v-else class="queue-placeholder"><Icon icon="lucide:music" /></div>
            <div class="queue-copy">
              <span>{{ song.name }}</span>
              <small>{{ song.artists }}</small>
            </div>
          </div>
          <div v-if="player.playlist.length === 0" class="empty-state">队列为空</div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject, reactive, ref, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import roomHeroBg from '../assets/long_width_bg.png'
import { useAuthStore, type UserInfo } from '../stores/auth'
import { useListenTogetherStore } from '../stores/listenTogether'
import { usePlayerStore } from '../stores/player'

const authStore = useAuthStore()
const together = useListenTogetherStore()
const player = usePlayerStore()
const openLoginDialog = inject<() => void>('openLoginDialog', () => authStore.login(false))

const roomMode = ref<'dual' | 'multi'>('multi')
const joinText = ref('')

// 成员资料缓存: uid -> UserInfo。自身直接用 authStore 资料, 不发请求。
const profileCache = reactive<Record<string, UserInfo>>({})

const fetchProfiles = async (uids: string[]) => {
  const myId = authStore.state.userInfo?.id
  await Promise.all(
    uids.map(async (uid) => {
      if (!uid || profileCache[uid] || uid === myId) return
      try {
        profileCache[uid] = await window.electronAPI.user.getProfile(uid)
      } catch {
        /* 失败静默, 列表仍显示 uid 占位 */
      }
    })
  )
}

watch(
  () => together.userList,
  (list) => { fetchProfiles(list) },
  { immediate: true, deep: true }
)

const memberDisplayName = (uid: string) => {
  if (uid === authStore.state.userInfo?.id) {
    const me = authStore.state.userInfo
    return me?.nickname || me?.username || uid
  }
  const p = profileCache[uid]
  return p?.nickname || p?.username || uid
}

const memberAvatar = (uid: string) => {
  if (uid === authStore.state.userInfo?.id) return authStore.state.userInfo?.avatar || ''
  return profileCache[uid]?.avatar || ''
}

const isSelf = (uid: string) => uid === authStore.state.userInfo?.id

const normalizedJoinCode = computed(() => {
  const text = joinText.value.trim()
  const shared = text.match(/#([a-z0-9]{6})#/i)
  if (shared) return shared[1].toLowerCase()
  const plain = text.match(/[a-z0-9]{6}/i)
  return plain ? plain[0].toLowerCase() : ''
})

const statusText = computed(() => {
  if (!authStore.isLoggedIn) return '登录后可创建或加入房间'
  if (together.connecting) return '正在连接房间'
  if (together.connected) return together.canControl ? '当前设备可控制播放' : '当前设备正在跟随播放'
  return '创建房间或加入已有房间'
})

const permissionText = computed(() => permissionLabel(together.permissionLevel))

const permissionLabel = (level: number) => {
  if (level >= 2) return '房主'
  if (level >= 1) return '管理员'
  return '旁听'
}

const createRoom = () => {
  if (!authStore.isLoggedIn) return openLoginDialog()
  together.createRoom(roomMode.value)
}

const joinRoom = () => {
  if (!authStore.isLoggedIn) return openLoginDialog()
  if (!normalizedJoinCode.value) return
  together.joinRoom(normalizedJoinCode.value)
}

const leaveRoom = () => {
  together.disconnect(true)
}

const copyRoomCode = async () => {
  if (!together.roomId) return
  const me = authStore.state.userInfo
  const name = me?.nickname || me?.username || ''
  const text = `${name}邀您一起听歌～\n复制这段文字打开QZMusic加入一起听歌#${together.roomId}#`
  await navigator.clipboard.writeText(text)
  ElMessage.success('邀请口令已复制')
}

const togglePermission = (uid: string) => {
  const current = together.allPermissions[uid] ?? 0
  together.changePermission(uid, current >= 1 ? 0 : 1)
}
</script>

<style scoped>
.together-page {
  min-height: 100%;
  padding: 28px 32px 132px;
  color: var(--color-text-primary);
}

.room-hero {
  min-height: 196px;
  border-radius: 30px;
  padding: 30px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background: color-mix(in srgb, var(--color-bg-secondary) 82%, transparent);
  box-shadow: none;
}

.room-hero::before {
  content: "";
  position: absolute;
  inset: -18px;
  z-index: -2;
  background: var(--room-hero-bg) center / cover no-repeat;
  filter: blur(12px) saturate(1.08);
  transform: scale(1.04);
}

.room-hero::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: -1;
  background:
    linear-gradient(90deg, rgba(18, 20, 32, 0.72) 0%, rgba(18, 20, 32, 0.38) 52%, rgba(18, 20, 32, 0.18) 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.10) 0%, rgba(255, 255, 255, 0.02) 100%);
}

.eyebrow,
.hero-actions,
.panel-heading,
.now-row,
.member-item,
.queue-item,
.room-code,
.hint-row {
  display: flex;
  align-items: center;
}

.eyebrow {
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.78);
}

.hero-copy h1 {
  margin-top: 14px;
  font-size: 36px;
  line-height: 1.1;
  letter-spacing: 0;
  color: #fff;
}

.hero-copy p {
  margin-top: 10px;
  color: rgba(255, 255, 255, 0.78);
}

.hero-actions {
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.primary-action,
.soft-action,
.danger-action,
.permission-btn,
.room-code button {
  height: 40px;
  border-radius: 999px;
  padding: 0 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 680;
}

.primary-action {
  background: var(--color-accent-gradient);
  color: #fff;
}

.soft-action,
.permission-btn,
.room-code button {
  background: color-mix(in srgb, var(--color-bg-primary) 72%, transparent);
  color: var(--color-text-primary);
}

.danger-action {
  background: rgba(255, 85, 85, 0.14);
  color: #ff7070;
}

button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.room-grid {
  display: grid;
  grid-template-columns: minmax(360px, 1.1fr) minmax(280px, 0.9fr);
  gap: 18px;
  margin-top: 18px;
}

.control-panel,
.members-panel,
.queue-panel {
  border-radius: 24px;
  padding: 22px;
  background: color-mix(in srgb, var(--color-bg-primary) 68%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.queue-panel {
  grid-column: 1 / -1;
}

.panel-heading {
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 18px;
}

.panel-heading h2 {
  font-size: 18px;
  letter-spacing: 0;
}

.panel-heading span,
.member-copy small,
.queue-copy small,
.song-copy small,
.hint-row {
  color: var(--color-text-muted);
  font-size: 12px;
}

.mode-toggle {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 4px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.mode-toggle button {
  min-width: 62px;
  height: 30px;
  border-radius: 999px;
  color: var(--color-text-secondary);
}

.mode-toggle button.active {
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
}

.join-box label {
  display: block;
}

.join-box label span {
  display: block;
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.join-box input {
  width: 100%;
  height: 44px;
  border-radius: 16px;
  padding: 0 14px;
  background: color-mix(in srgb, var(--color-bg-secondary) 82%, transparent);
  outline: none;
}

.hint-row {
  justify-content: space-between;
  min-height: 34px;
}

.room-code {
  justify-content: space-between;
  gap: 12px;
  height: 50px;
  padding-left: 16px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.room-code span {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: 0;
}

.room-code button {
  width: 42px;
  padding: 0;
  margin-right: 4px;
}

.now-row {
  gap: 14px;
  margin-top: 18px;
}

.song-cover,
.avatar,
.queue-placeholder {
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-accent);
  overflow: hidden;
  flex-shrink: 0;
}

.song-cover {
  width: 58px;
  height: 58px;
  border-radius: 18px;
}

.song-cover img,
.queue-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.song-copy,
.member-copy,
.queue-copy {
  min-width: 0;
  flex: 1;
}

.song-copy span,
.member-copy span,
.queue-copy span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.play-state {
  font-size: 12px;
  color: var(--color-text-muted);
}

.play-state.playing {
  color: var(--color-accent);
}

.member-list,
.queue-list {
  display: grid;
  gap: 8px;
}

.member-item {
  gap: 12px;
  min-height: 54px;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  font-weight: 800;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.member-item.is-self {
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
  border-radius: 14px;
  padding: 0 10px;
  margin: 0 -10px;
}

.member-item.is-self .member-copy span {
  color: var(--color-accent);
}

.self-tag {
  color: var(--color-accent);
  font-weight: 700;
  margin-left: 4px;
}

.permission-btn {
  height: 32px;
  padding: 0 12px;
}

.queue-list {
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
}

.queue-item {
  gap: 12px;
  min-width: 0;
  height: 62px;
  padding: 8px 10px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--color-bg-secondary) 66%, transparent);
}

.queue-item.active {
  background: color-mix(in srgb, var(--color-accent) 13%, transparent);
}

.queue-index {
  width: 24px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.queue-item img,
.queue-placeholder {
  width: 42px;
  height: 42px;
  border-radius: 13px;
}

.empty-state {
  min-height: 72px;
  display: grid;
  place-items: center;
  color: var(--color-text-muted);
  font-size: 13px;
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1050px) {
  .room-hero,
  .room-grid {
    display: block;
  }

  .hero-actions {
    justify-content: flex-start;
    margin-top: 24px;
  }

  .members-panel,
  .queue-panel {
    margin-top: 18px;
  }
}
</style>

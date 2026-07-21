<template>
  <div class="user-profile-view" :class="{ 'is-loading': loading }">
    <section class="profile-hero">
      <div v-if="loading" class="hero-loading">
        <Icon icon="lucide:loader-2" class="spin" />
      </div>
      <div class="avatar-wrap">
        <img v-if="profile?.avatar" :src="profile.avatar" alt="" />
        <Icon v-else icon="lucide:user" />
      </div>
      <div class="profile-copy">
        <div class="eyebrow">{{ isOwnProfile ? 'MY PROFILE' : 'USER PROFILE' }}</div>
        <h1>{{ displayName }}</h1>
        <p class="user-id">@{{ profile?.username || profile?.id || routeUserId }}</p>
        <p class="intro">{{ profile?.intro || '这个人还没有写简介。' }}</p>
        <div class="profile-meta">
          <span v-if="profile?.region">{{ profile.region }}</span>
          <span v-if="profile?.gender">{{ profile.gender }}</span>
          <span v-if="profile?.birthday && profile.birthday !== '????-??-??'">{{ profile.birthday }}</span>
        </div>
      </div>
      <button v-if="isOwnProfile" class="soft-btn" @click="openEditDialog">
        <Icon icon="lucide:pencil" />
        编辑资料
      </button>
      <button
        v-if="!isOwnProfile && authStore.isLoggedIn"
        class="soft-btn follow-btn"
        :class="{ following: profile?.subscribing }"
        :disabled="togglingFollow"
        @click="toggleFollow"
      >
        <Icon :icon="profile?.subscribing ? 'lucide:user-check' : 'lucide:user-plus'" />
        {{ profile?.subscribing ? '已关注' : '关注' }}
      </button>
    </section>

    <section class="stats-row">
      <button class="stat-item clickable" @click="openFansList">
        <Icon icon="lucide:users" />
        <span>{{ fansCount }} 粉丝</span>
      </button>
      <button
        class="stat-item"
        :class="{ clickable: canViewFollowing }"
        :disabled="!canViewFollowing"
        @click="openFollowingList"
      >
        <Icon icon="lucide:user-round-check" />
        <span>{{ followingCount }} 关注</span>
      </button>
    </section>

    <section class="profile-grid">
      <div class="profile-panel">
        <div class="panel-head">
          <div>
            <h2>{{ playlistPanelTitle }}</h2>
            <p>{{ playlists.length }} 个歌单</p>
          </div>
          <Icon icon="lucide:library" />
        </div>
        <div v-if="loading" class="panel-empty">
          <Icon icon="lucide:loader-2" class="spin" />
          <span>加载中...</span>
        </div>
        <div v-else-if="playlists.length === 0" class="panel-empty">{{ playlistEmptyText }}</div>
        <template v-else>
          <router-link
            v-for="playlist in playlists"
            :key="playlist.id"
            class="playlist-row"
            :to="{ name: 'PlaylistDetail', params: { scope: 'cloud', id: playlist.id } }"
          >
            <div class="mini-cover">
              <img v-if="playlist.img" :src="playlist.img" alt="" />
              <Icon v-else icon="lucide:cloud" />
            </div>
            <div>
              <strong>{{ playlist.name || '云歌单' }}</strong>
              <span>{{ playlist.desc || '没有简介' }}</span>
              <small>访问 {{ Number(playlist.visit_count || playlist.play_count || 0) || 0 }} 次</small>
            </div>
          </router-link>
        </template>
      </div>

      <div
        class="profile-panel clickable-panel"
        :class="{ disabled: loading || favSongs.length === 0 }"
        @click="openLikedPlaylist"
      >
        <div class="panel-head">
          <div>
            <h2>喜欢的歌</h2>
            <p>{{ favSongs.length }} 首歌曲</p>
          </div>
          <Icon icon="lucide:heart" />
        </div>
        <div v-if="loading" class="panel-empty">
          <Icon icon="lucide:loader-2" class="spin" />
          <span>加载中...</span>
        </div>
        <div v-else-if="favSongs.length === 0" class="panel-empty">喜欢列表暂不可见或为空</div>
        <template v-else>
          <div
            v-for="song in favSongs.slice(0, 12)"
            :key="`${song.source}:${song.id}`"
            class="song-row"
          >
            <div class="song-thumb">
              <img v-if="song.pic" :src="song.pic" alt="" />
              <Icon v-else icon="lucide:music" />
            </div>
            <div>
              <strong>{{ song.name || '未知歌曲' }}</strong>
              <span>{{ song.artists || '未知歌手' }}</span>
            </div>
          </div>
          <button v-if="favSongs.length > 12" class="show-more-btn" @click.stop="openLikedPlaylist">
            显示更多
          </button>
        </template>
      </div>
    </section>

    <Transition name="fade">
      <div v-if="showEditDialog" class="dialog-backdrop" @click.self="showEditDialog = false">
        <div class="edit-dialog">
          <div class="dialog-title">编辑资料</div>
          <input v-model="draft.nickname" class="text-input" placeholder="昵称" />
          <textarea v-model="draft.intro" class="text-area" placeholder="简介"></textarea>
          <div class="field-grid">
            <input v-model="draft.gender" class="text-input" placeholder="性别" />
            <input v-model="draft.region" class="text-input" placeholder="地区" />
            <input v-model="draft.birthday" class="text-input" placeholder="生日" />
            <input v-model="draft.avatar" class="text-input" placeholder="头像 URL" />
          </div>
          <div class="dialog-actions">
            <button class="ghost-btn" @click="showEditDialog = false">取消</button>
            <button class="primary-btn compact" :disabled="savingProfile" @click="saveProfile">
              <Icon v-if="savingProfile" icon="lucide:loader-2" class="spin" />
              保存
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'
import { useAuthStore, type UserInfo } from '../stores/auth'

type PublicPlaylist = {
  id: string
  name?: string
  desc?: string
  img?: string
  total?: number
  play_count?: string
  visit_count?: number
}

type PublicSong = {
  id: string
  name?: string
  artist?: string
  artists?: string
  source: string
  pic?: string
  picUrl?: string
  interval?: string
  duration?: string
  albumName?: string | null
  albumId?: string | null
  quality?: string
  qualities?: Record<string, string>
}

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const profile = ref<UserInfo | null>(null)
const playlists = ref<PublicPlaylist[]>([])
const favSongs = ref<PublicSong[]>([])
const loading = ref(false)
const showEditDialog = ref(false)
const savingProfile = ref(false)
const togglingFollow = ref(false)
const fansCount = ref(0)
const followingCount = ref(0)
const canViewFollowing = ref(false)

const draft = reactive({
  nickname: '',
  intro: '',
  gender: '',
  region: '',
  birthday: '',
  avatar: '',
})

const routeUserId = computed(() => String(route.params.id || authStore.state.userInfo?.id || ''))
const isOwnProfile = computed(() => Boolean(authStore.state.userInfo?.id && authStore.state.userInfo.id === routeUserId.value))
const displayName = computed(() => profile.value?.nickname || profile.value?.username || '用户')
const playlistPanelTitle = computed(() => isOwnProfile.value ? '我的歌单' : '公开歌单')
const playlistEmptyText = computed(() => isOwnProfile.value ? '还没有创建歌单' : '暂无可查看的公开歌单')

const loadProfile = async () => {
  if (!routeUserId.value) {
    router.replace('/')
    return
  }
  loading.value = true
  try {
    profile.value = await window.electronAPI.user.getProfile(routeUserId.value)
    const [playlistResult, favResult, subsResult] = await Promise.allSettled([
      window.electronAPI.user.getPlaylists(routeUserId.value),
      window.electronAPI.user.getFavSongs(routeUserId.value),
      window.electronAPI.user.getSubscriptions(routeUserId.value),
    ])
    playlists.value = playlistResult.status === 'fulfilled' ? playlistResult.value : []
    favSongs.value = favResult.status === 'fulfilled' ? favResult.value : []
    if (subsResult.status === 'fulfilled') {
      fansCount.value = subsResult.value?.fans ?? 0
      followingCount.value = subsResult.value?.subs ?? 0
      canViewFollowing.value = Boolean(isOwnProfile.value || subsResult.value?.can_view_subs)
    } else {
      fansCount.value = 0
      followingCount.value = 0
      canViewFollowing.value = isOwnProfile.value
    }
    if (route.query.edit === '1' && isOwnProfile.value) openEditDialog()
  } catch (err: any) {
    ElMessage.error(err?.message || '用户资料加载失败')
    profile.value = null
  } finally {
    loading.value = false
  }
}

const openEditDialog = () => {
  if (!isOwnProfile.value || !profile.value) return
  draft.nickname = profile.value.nickname || ''
  draft.intro = profile.value.intro || ''
  draft.gender = profile.value.gender || ''
  draft.region = profile.value.region || ''
  draft.birthday = profile.value.birthday || ''
  draft.avatar = profile.value.avatar || ''
  showEditDialog.value = true
}

const saveProfile = async () => {
  savingProfile.value = true
  try {
    const updated = await window.electronAPI.user.updateProfile({
      nickname: draft.nickname,
      intro: draft.intro,
      gender: draft.gender,
      region: draft.region,
      birthday: draft.birthday,
      avatar: draft.avatar,
    })
    profile.value = updated
    authStore.applyUserInfo(updated)
    showEditDialog.value = false
    ElMessage.success('资料已更新')
  } catch (err: any) {
    ElMessage.error(err?.message || '资料更新失败')
  } finally {
    savingProfile.value = false
  }
}

const openLikedPlaylist = () => {
  if (loading.value || favSongs.value.length === 0 || !routeUserId.value) return
  router.push({ name: 'UserLikedPlaylist', params: { id: routeUserId.value } })
}

const openFansList = () => {
  if (!routeUserId.value) return
  router.push({ name: 'UserConnections', params: { id: routeUserId.value, kind: 'fans' } })
}

const openFollowingList = () => {
  if (!routeUserId.value || !canViewFollowing.value) return
  router.push({ name: 'UserConnections', params: { id: routeUserId.value, kind: 'following' } })
}

const toggleFollow = async () => {
  if (!routeUserId.value || togglingFollow.value) return
  togglingFollow.value = true
  try {
    const result = await window.electronAPI.user.toggleFollow(routeUserId.value)
    if (profile.value) {
      profile.value = { ...profile.value, subscribing: result.subscribing }
    }
    // Refresh fans count
    const subs = await window.electronAPI.user.getSubscriptions(routeUserId.value)
    fansCount.value = subs?.fans ?? fansCount.value
    followingCount.value = subs?.subs ?? followingCount.value
    canViewFollowing.value = Boolean(isOwnProfile.value || subs?.can_view_subs)
  } catch (err: any) {
    ElMessage.error(err?.message || '关注操作失败')
  } finally {
    togglingFollow.value = false
  }
}

watch(() => [route.params.id, route.query.edit, authStore.state.userInfo?.id], loadProfile, { immediate: true })
</script>

<style scoped>
.user-profile-view {
  min-height: 100%;
  padding: 30px 32px 148px;
  box-sizing: border-box;
}

.profile-hero {
  min-height: 228px;
  padding: 30px;
  display: flex;
  align-items: flex-end;
  gap: 24px;
  border-radius: 30px;
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent 36%),
    color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 8%, transparent);
  position: relative;
  animation: profile-enter 260ms ease both;
}

.hero-loading {
  position: absolute;
  top: 22px;
  right: 22px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-accent);
}

.avatar-wrap {
  width: 116px;
  height: 116px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  overflow: hidden;
  background: var(--color-accent-soft);
  color: var(--color-accent);
  flex: 0 0 auto;
}

.avatar-wrap img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-wrap svg {
  width: 48px;
  height: 48px;
}

.profile-copy {
  min-width: 0;
  flex: 1;
}

.eyebrow {
  color: var(--color-text-muted);
  font-size: 12px;
  font-weight: 760;
}

h1 {
  margin-top: 8px;
  font-size: 42px;
  line-height: 1.08;
  color: var(--color-text-primary);
}

.user-id,
.intro,
.profile-meta,
.panel-head p,
.playlist-row span,
.playlist-row small,
.song-row span,
.panel-empty {
  color: var(--color-text-muted);
}

.user-id {
  margin-top: 5px;
}

.intro {
  max-width: 620px;
  margin-top: 12px;
  color: var(--color-text-secondary);
}

.profile-meta {
  margin-top: 12px;
  display: flex;
  gap: 10px;
  font-size: 13px;
}

.profile-grid {
  margin-top: 22px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.profile-panel {
  min-height: 320px;
  padding: 22px;
  border-radius: 26px;
  background: color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--color-accent) 7%, transparent);
  animation: profile-enter 280ms ease both;
}

.profile-panel:nth-child(2) {
  animation-delay: 45ms;
}

.clickable-panel {
  cursor: pointer;
  transition: background-color 160ms ease, transform 160ms ease;
}

.clickable-panel:hover {
  background: color-mix(in srgb, var(--color-accent) 7%, var(--color-bg-secondary));
  transform: translateY(-1px);
}

.clickable-panel.disabled {
  cursor: default;
  transform: none;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.panel-head h2 {
  font-size: 20px;
}

.panel-head svg {
  color: var(--color-accent);
}

.playlist-row,
.song-row {
  min-height: 58px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 10px;
  border-radius: 18px;
  text-decoration: none;
  color: var(--color-text-primary);
  transition: background-color 160ms ease;
}

.song-row {
  width: 100%;
  text-align: left;
}

.playlist-row:hover,
.song-row:hover {
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.mini-cover,
.song-thumb {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  overflow: hidden;
  flex: 0 0 auto;
  display: grid;
  place-items: center;
  background: color-mix(in srgb, var(--color-accent) 10%, transparent);
  color: var(--color-accent);
}

.song-thumb {
  border-radius: 50%;
}

.mini-cover img,
.song-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-row div:last-child,
.song-row div:last-child {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.playlist-row strong,
.playlist-row span,
.playlist-row small,
.song-row strong,
.song-row span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.playlist-row small {
  font-size: 12px;
}

.panel-empty {
  min-height: 210px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
  text-align: center;
}

.show-more-btn {
  width: 100%;
  min-height: 38px;
  margin-top: 8px;
  border-radius: 999px;
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.show-more-btn:hover {
  background: color-mix(in srgb, var(--color-accent) 13%, transparent);
}

.soft-btn,
.primary-btn,
.ghost-btn {
  min-height: 40px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.soft-btn,
.ghost-btn {
  padding: 0 16px;
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
  color: var(--color-text-secondary);
}

.soft-btn:hover,
.ghost-btn:hover {
  color: var(--color-text-primary);
}

.follow-btn.following {
  color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 14%, transparent);
}

.stats-row {
  display: flex;
  gap: 16px;
  padding: 12px 0;
  margin-top: 4px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--color-text-muted);
  font-size: 13px;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--color-accent) 7%, transparent);
}

.stat-item svg {
  width: 15px;
  height: 15px;
}

.stat-item.clickable {
  cursor: pointer;
}

.stat-item.clickable:hover {
  color: var(--color-text-primary);
  background: color-mix(in srgb, var(--color-accent) 12%, transparent);
}

.stat-item:disabled {
  opacity: 0.64;
  cursor: default;
}

.primary-btn {
  padding: 0 18px;
  background: var(--color-accent-gradient);
  color: white;
}

.primary-btn.compact {
  min-height: 38px;
}

.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  background: rgba(0, 0, 0, 0.45);
}

.edit-dialog {
  width: min(460px, calc(100vw - 32px));
  padding: 22px;
  border-radius: 24px;
  background: var(--color-bg-primary);
  box-shadow: var(--shadow-elevated);
}

.dialog-title {
  font-size: 18px;
  font-weight: 750;
  margin-bottom: 16px;
}

.text-input,
.text-area {
  width: 100%;
  border: 1px solid color-mix(in srgb, var(--color-accent) 12%, transparent);
  background: var(--color-bg-secondary);
  border-radius: 16px;
  outline: none;
  padding: 12px 14px;
  margin-bottom: 10px;
  color: var(--color-text-primary);
}

.text-area {
  min-height: 92px;
  resize: none;
}

.field-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 10px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes profile-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 180ms ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 900px) {
  .profile-hero {
    display: block;
  }

  .avatar-wrap {
    margin-bottom: 18px;
  }

  .soft-btn {
    margin-top: 18px;
  }

  .profile-grid {
    grid-template-columns: 1fr;
  }
}
</style>

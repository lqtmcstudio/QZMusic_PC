<template>
  <div class="connections-view">
    <header class="connections-head">
      <button class="icon-btn" @click="router.back()">
        <Icon icon="lucide:chevron-left" />
      </button>
      <div>
        <p>{{ ownerName }}</p>
        <h1>{{ title }}</h1>
      </div>
    </header>

    <section class="connections-panel">
      <div v-if="loading" class="empty-state">
        <Icon icon="lucide:loader-2" class="spin" />
        <span>加载中...</span>
      </div>
      <div v-else-if="message" class="empty-state">{{ message }}</div>
      <template v-else>
        <router-link
          v-for="user in users"
          :key="user.id"
          class="user-row"
          :to="{ name: 'UserProfile', params: { id: user.id } }"
        >
          <div class="avatar">
            <img v-if="user.avatar" :src="user.avatar" alt="" />
            <Icon v-else icon="lucide:user" />
          </div>
          <div>
            <strong>{{ user.nickname || user.username || '用户' }}</strong>
            <span>@{{ user.username || user.id }}</span>
          </div>
        </router-link>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Icon } from '@iconify/vue'
import type { UserInfo } from '../stores/auth'

const route = useRoute()
const router = useRouter()

const owner = ref<UserInfo | null>(null)
const users = ref<UserInfo[]>([])
const loading = ref(false)
const message = ref('')

const routeUserId = computed(() => String(route.params.id || ''))
const kind = computed(() => String(route.params.kind || 'fans'))
const isFollowing = computed(() => kind.value === 'following')
const title = computed(() => isFollowing.value ? '关注' : '粉丝')
const ownerName = computed(() => owner.value?.nickname || owner.value?.username || '用户')

const loadConnections = async () => {
  if (!routeUserId.value) {
    router.replace('/')
    return
  }
  loading.value = true
  message.value = ''
  users.value = []
  try {
    const [profile, subs] = await Promise.all([
      window.electronAPI.user.getProfile(routeUserId.value),
      window.electronAPI.user.getSubscriptions(routeUserId.value),
    ])
    owner.value = profile
    if (isFollowing.value && !subs?.can_view_subs) {
      message.value = 'TA 未公开关注列表'
      return
    }
    const ids = isFollowing.value ? (subs?.subs_list || []) : (subs?.fans_list || [])
    if (ids.length === 0) {
      message.value = `暂无${title.value}`
      return
    }
    const profiles = await Promise.allSettled(ids.map((id) => window.electronAPI.user.getProfile(id)))
    users.value = profiles
      .filter((item): item is PromiseFulfilledResult<UserInfo> => item.status === 'fulfilled' && Boolean(item.value?.id))
      .map((item) => item.value)
  } catch (err) {
    console.error('[UserConnections] load failed:', err)
    message.value = '列表加载失败'
  } finally {
    loading.value = false
  }
}

watch(() => [route.params.id, route.params.kind], loadConnections, { immediate: true })
</script>

<style scoped>
.connections-view {
  min-height: 100%;
  padding: 30px 32px 148px;
  box-sizing: border-box;
}

.connections-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 20px;
}

.connections-head p {
  color: var(--color-text-muted);
  font-size: 13px;
}

.connections-head h1 {
  font-size: 32px;
  line-height: 1.1;
}

.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--color-text-secondary);
  background: color-mix(in srgb, var(--color-accent) 8%, transparent);
}

.connections-panel {
  max-width: 760px;
  display: grid;
  gap: 10px;
}

.user-row {
  min-height: 68px;
  padding: 10px 12px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--color-text-primary);
  text-decoration: none;
  background: color-mix(in srgb, var(--color-bg-secondary) 78%, transparent);
  transition: background-color 160ms ease, transform 160ms ease;
}

.user-row:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--color-accent) 8%, var(--color-bg-secondary));
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.user-row div:last-child {
  min-width: 0;
  display: grid;
  gap: 3px;
}

.user-row strong,
.user-row span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.user-row span,
.empty-state {
  color: var(--color-text-muted);
}

.empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 8px;
}

.spin {
  animation: spin 900ms linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

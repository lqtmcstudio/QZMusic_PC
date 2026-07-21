import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'

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

const emptyState: AuthState = {
  accessToken: '',
  refreshToken: '',
  exp: 0,
  userInfo: null,
}

let removeAuthListener: (() => void) | undefined

export const useAuthStore = defineStore('auth', () => {
  const state = ref<AuthState>({ ...emptyState })
  const loading = ref(false)

  const isLoggedIn = computed(() => Boolean(state.value.accessToken && state.value.userInfo?.id))
  const displayName = computed(() => state.value.userInfo?.nickname || state.value.userInfo?.username || '未登录')
  const avatar = computed(() => state.value.userInfo?.avatar || '')

  const init = async () => {
    state.value = await window.electronAPI.auth.getState()
    if (!removeAuthListener) {
      removeAuthListener = window.electronAPI.auth.onChanged((payload) => {
        state.value = payload.state || { ...emptyState }
        if (payload.status === 'success') ElMessage.success('登录成功')
        if (payload.status === 'error') ElMessage.error(payload.message || '登录失败')
      })
    }
    if (state.value.accessToken) {
      try {
        state.value = await window.electronAPI.auth.refresh()
      } catch (err) {
        console.warn('[Auth] refresh failed:', err)
      }
    }
  }

  const login = async (forcePrompt = false) => {
    loading.value = true
    try {
      await window.electronAPI.auth.login(forcePrompt)
    } finally {
      loading.value = false
    }
  }

  const logout = async () => {
    state.value = await window.electronAPI.auth.logout()
    ElMessage.success('已退出登录')
  }

  const applyUserInfo = (userInfo: UserInfo) => {
    state.value = {
      ...state.value,
      userInfo,
    }
  }

  return {
    state,
    loading,
    isLoggedIn,
    displayName,
    avatar,
    init,
    login,
    logout,
    applyUserInfo,
  }
})

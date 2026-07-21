<template>
  <MainLayout />
  <FullScreenPlayer />
  <LoginDialog v-model:visible="showLoginDialog" />
  <Settings v-if="showSettings" @close="showSettings = false" />
</template>

<script setup lang="ts">
import { ref, provide, onMounted, onBeforeUnmount } from 'vue';
import { ElMessageBox } from 'element-plus';
import MainLayout from './layout/MainLayout.vue';
import Settings from './components/Settings.vue';
import FullScreenPlayer from './components/FullScreenPlayer.vue';
import LoginDialog from './components/LoginDialog.vue';
import { useAuthStore } from './stores/auth';
import { usePlaylistsStore } from './stores/playlists';
import { usePlayerStore } from './stores/player';
import { useListenTogetherStore } from './stores/listenTogether';

const showSettings = ref(false);
const showLoginDialog = ref(false);
const authStore = useAuthStore();
const playlistsStore = usePlaylistsStore();
const playerStore = usePlayerStore();
const together = useListenTogetherStore();

// Provide to child components
provide('openSettings', () => { showSettings.value = true; });
provide('openLoginDialog', () => { showLoginDialog.value = true; });

const isTypingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest('input, textarea, select, [contenteditable="true"]')
  );
};

const handleGlobalShortcut = (event: KeyboardEvent) => {
  if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;

  const key = event.key.toLowerCase();
  if (event.code === 'Space') {
    event.preventDefault();
    playerStore.togglePlay();
  } else if (key === 'a') {
    event.preventDefault();
    playerStore.prev();
  } else if (key === 'd') {
    event.preventDefault();
    playerStore.next();
  } else if (key === 'w') {
    event.preventDefault();
    playerStore.toggleMode();
  }
};

// ===== 一起听邀请口令: 剪贴板自动检测 =====
// 窗口聚焦/可见时读取剪贴板, 命中 "加入一起听歌#<code>#" 即:
//   1) 立即覆盖剪贴板为空, 防止持续重复捕获;
//   2) 已在一起听状态时无视(不弹窗);
//   3) 否则弹窗询问是否加入房间。
let invitePrompting = false;
const INVITE_RE = /加入一起听歌#([^#]+)#/;

const checkClipboardInvite = async () => {
  if (!authStore.isLoggedIn) return;
  if (together.connected || together.connecting) return;
  if (invitePrompting) return;
  invitePrompting = true;
  try {
    let text = '';
    try { text = await navigator.clipboard.readText(); } catch { return; }
    const match = text && text.match(INVITE_RE);
    if (!match) return;
    const code = match[1].trim();
    if (!code) return;
    // 一经发现先清空剪贴板, 防止重复捕获
    try { await navigator.clipboard.writeText(''); } catch { /* ignore */ }
    try {
      await ElMessageBox.confirm(
        `检测到一起听邀请（房间号 ${code}），是否立即加入房间？`,
        '一起听邀请',
        { confirmButtonText: '加入房间', cancelButtonText: '取消', type: 'success' }
      );
      together.joinRoom(code);
    } catch { /* 用户取消 */ }
  } finally {
    invitePrompting = false;
  }
};

const onVisibilityChange = () => {
  if (document.visibilityState === 'visible') checkClipboardInvite();
};

// Apply saved theme on app startup
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalShortcut);
  window.addEventListener('focus', checkClipboardInvite);
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (window.electronAPI?.settings) {
    const settings = await window.electronAPI.settings.getAll();
    document.documentElement.setAttribute('data-theme', settings.theme);
    const accentColor = settings.accentColor === '#b3c9df' ? '#8289d3' : settings.accentColor;
    document.documentElement.style.setProperty('--color-accent', accentColor);
    document.documentElement.style.setProperty('--color-accent-gradient', accentColor);
    const atmosphere = accentColor === '#8289d3'
      ? 'linear-gradient(180deg, rgba(176, 186, 235, 0.36) 0%, rgba(177, 191, 233, 0.31) 18%, rgba(179, 201, 223, 0.25) 38%, rgba(193, 192, 211, 0.18) 58%, rgba(223, 172, 185, 0.11) 78%, transparent 100%)'
      : 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, color-mix(in srgb, var(--color-accent) 7%, transparent) 44%, transparent 100%)';
    document.documentElement.style.setProperty('--color-atmosphere-gradient', atmosphere);
  }
  await authStore.init();
  await playlistsStore.refresh();
  // 启动后稍延迟检测一次(用户可能刚带着邀请口令打开应用)
  window.setTimeout(checkClipboardInvite, 800);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleGlobalShortcut);
  window.removeEventListener('focus', checkClipboardInvite);
  document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<style>
@import "styles/main.css";
</style>

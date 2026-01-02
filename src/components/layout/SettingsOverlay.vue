<template>
  <!-- 遮罩层独立动画 -->
  <transition name="fade-quick">
    <div v-if="store.showSettings" class="backdrop" @click="store.toggleSettings"></div>
  </transition>

  <!-- 弹窗动画 -->
  <transition name="fade-slide">
    <div v-if="store.showSettings" class="settings-overlay">
      <div class="settings-modal">
        <aside class="settings-sidebar">
          <div class="title">设置</div>
          <ul class="nav-list">
            <li v-for="item in menuItems" :key="item.id"
                :class="{ active: activeTab === item.id }"
                @click="activeTab = item.id">
              {{ item.name }}
            </li>
          </ul>
        </aside>

        <main class="settings-content">
          <button class="close-btn" @click="store.toggleSettings">
            <Icon icon="lucide:x" width="24" />
          </button>

          <transition name="fade" mode="out-in">
            <!-- 通用设置 -->
            <div v-if="activeTab === 'general'" class="section-content" key="general">
              <h2>{{ menuItems.find(i => i.id === activeTab)?.name }}</h2>
              <div class="dummy-option">
                <span>深色模式</span>
                <el-switch v-model="store.darkMode" @change="logSetting('darkMode', store.darkMode)" />
              </div>
              <div class="dummy-option">
                <span>自动播放</span>
                <el-switch v-model="settings.autoPlay" @change="logSetting('autoPlay', settings.autoPlay)" />
              </div>
            </div>

            <!-- 播放与音质 -->
            <div v-else-if="activeTab === 'audio'" class="section-content" key="audio">
              <h2>{{ menuItems.find(i => i.id === activeTab)?.name }}</h2>
              <div class="dummy-option">
                <span>启用高音质 (Hi-Res)</span>
                <el-switch v-model="settings.hiResAudio" @change="logSetting('hiResAudio', settings.hiResAudio)" />
              </div>
              <div class="dummy-option">
                <span>开启桌面歌词</span>
                <el-switch v-model="settings.desktopLyrics" @change="logSetting('desktopLyrics', settings.desktopLyrics)" />
              </div>
              <div class="dummy-option">
                <span>音量增强</span>
                <el-switch v-model="settings.volumeBoost" @change="logSetting('volumeBoost', settings.volumeBoost)" />
              </div>
            </div>

            <!-- 快捷键 -->
            <div v-else-if="activeTab === 'shortcut'" class="section-content" key="shortcut">
              <h2>{{ menuItems.find(i => i.id === activeTab)?.name }}</h2>
              <div class="dummy-option">
                <span>启用全局快捷键</span>
                <el-switch v-model="settings.globalShortcuts" @change="logSetting('globalShortcuts', settings.globalShortcuts)" />
              </div>
              <div class="dummy-option">
                <span>媒体键控制</span>
                <el-switch v-model="settings.mediaKeys" @change="logSetting('mediaKeys', settings.mediaKeys)" />
              </div>
            </div>

            <!-- 下载管理 -->
            <div v-else-if="activeTab === 'download'" class="section-content" key="download">
              <h2>{{ menuItems.find(i => i.id === activeTab)?.name }}</h2>
              <div class="dummy-option">
                <span>下载完成后通知</span>
                <el-switch v-model="settings.downloadNotify" @change="logSetting('downloadNotify', settings.downloadNotify)" />
              </div>
              <div class="dummy-option">
                <span>高质量下载</span>
                <el-switch v-model="settings.hqDownload" @change="logSetting('hqDownload', settings.hqDownload)" />
              </div>
            </div>

            <!-- 关于页面 -->
            <div v-else class="about-section" key="about">
              <div class="logo-animate">M</div>
              <h3>Muse Player</h3>
              <p class="version">Version 1.0.0 Beta</p>
              <div class="desc">
                Designed for music lovers.<br>
                Crafted with Vue 3 & Electron.
              </div>
              <div class="links">
                <a href="#">GitHub</a>
                <a href="#">Website</a>
              </div>
            </div>
          </transition>
        </main>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { usePlayerStore } from '../../stores/playerStore';
import { Icon } from '@iconify/vue';

const store = usePlayerStore();
const activeTab = ref('general');

// 其他设置的本地状态管理
const settings = reactive({
  autoPlay: true,
  hiResAudio: true,
  desktopLyrics: false,
  volumeBoost: false,
  globalShortcuts: true,
  mediaKeys: true,
  downloadNotify: true,
  hqDownload: true
});

// 切换时打印日志
const logSetting = (key: string, value: boolean) => {
  console.log(`[设置变更] ${key}: ${value ? '开启' : '关闭'}`);
  // 这里可以添加实际保存设置的逻辑
};

const menuItems = [
  { id: 'general', name: '通用' },
  { id: 'audio', name: '播放与音质' },
  { id: 'shortcut', name: '快捷键' },
  { id: 'download', name: '下载管理' },
  { id: 'about', name: '关于' },
];
</script>

<style scoped lang="scss">
/* 遮罩层 - 快速淡入淡出 */
.fade-quick-enter-active,
.fade-quick-leave-active {
  transition: opacity 0.1s ease;
}

.fade-quick-enter-from,
.fade-quick-leave-to {
  opacity: 0;
}

/* 遮罩层样式 */
.backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 998;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(4px);
}

/* 弹窗容器 */
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 999;
  display: flex;
  justify-content: center;
  align-items: center;
  pointer-events: none; /* 防止点击穿透 */

  .settings-modal {
        width: 70vw;
        height: 70vh;
        max-width: 900px;
        background: var(--settings-modal-bg);
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        display: flex;
        overflow: hidden;
        position: relative;
        pointer-events: auto; /* 恢复弹窗内的点击事件 */
      }

      .settings-sidebar {
        width: 200px;
        background: var(--settings-sidebar-bg);
        padding: 30px 20px;
        border-right: 1px solid var(--settings-sidebar-border);

        .title {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 30px;
          padding-left: 10px;
          color: var(--text-primary);
        }

        .nav-list {
          list-style: none;
          padding: 0;

          li {
            padding: 12px 16px;
            margin-bottom: 8px;
            border-radius: 8px;
            cursor: pointer;
            color: var(--text-secondary);
            font-weight: 500;
            transition: all 0.2s;

            &:hover {
              background: var(--nav-item-hover);
              color: var(--text-primary);
            }

            &.active {
              background: var(--nav-item-active);
              color: var(--nav-item-active-text);
            }
          }
        }
      }

  .settings-content {
    flex: 1;
    padding: 40px;
    position: relative;
    overflow-y: auto;
    background: var(--settings-modal-bg);

    .close-btn {
      position: absolute;
      top: 20px;
      right: 20px;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--close-btn-color);

      &:hover {
        color: var(--close-btn-hover);
      }
    }

    h2 {
      margin-top: 0;
      margin-bottom: 30px;
      font-size: 20px;
      color: var(--text-primary);
    }

    .dummy-option {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      border-bottom: 1px solid var(--dummy-option-border);

      &:last-child {
        border-bottom: none;
      }

      span {
        color: var(--text-primary);
      }
    }
  }

  /* 关于页面样式 */
  .about-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    text-align: center;

    .logo-animate {
      width: 80px;
      height: 80px;
      background: var(--logo-placeholder-bg);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 40px;
      font-weight: bold;
      margin-bottom: 20px;
      animation: float 6s ease-in-out infinite;
    }

    h3 {
      margin: 0;
      font-size: 24px;
      color: var(--text-primary);
    }

    .version {
      color: var(--text-tertiary);
      margin: 10px 0 30px;
      font-family: monospace;
    }

    .desc {
      line-height: 1.6;
      color: var(--text-secondary);
      margin-bottom: 40px;
    }

    .links {
      display: flex;
      gap: 20px;

      a {
        color: var(--text-primary);
        text-decoration: none;
        font-weight: 600;
        border-bottom: 1px solid transparent;
        transition: border 0.2s;

        &:hover {
          border-color: var(--text-primary);
        }
      }
    }
  }
}

/* 弹窗进入动画 - 遮罩已经独立 */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.fade-slide-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.fade-slide-leave-to {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(0);
  }

  50% {
    transform: translateY(-10px) rotate(5deg);
  }
}
</style>

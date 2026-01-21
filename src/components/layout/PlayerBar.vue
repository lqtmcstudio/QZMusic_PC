<template>
  <div class="player-bar" :style="dynamicBackground">
    <div class="noise-overlay"></div>
    <div class="glass-surface"></div>

    <div
        class="progress-container"
        @mousemove="handleHoverProgress"
        @mouseleave="isHoveringProgress = false"
        @click="handleSeek"
    >
      <div class="progress-track">
        <div
            class="progress-fill"
            :style="{
            width: store.progressPercentage + '%',
            backgroundColor: store.themeColors.secondary
          }"
        >
          <div class="progress-glow"></div>
        </div>
      </div>
    </div>

    <div class="bar-content">
      <div class="side-container left">
        <div class="track-info">
          <div class="album-cover">
            <img
                :src="store.currentSong.cover"
                crossorigin="anonymous"
                @load="handleImageLoad"
                alt="Cover"
            />
          </div>
          <div class="meta">
            <transition name="fade-slide" mode="out-in">
              <div :key="store.currentSong.title" class="song-title">
                {{ store.currentSong.title }}
              </div>
            </transition>
            <transition name="fade-slide" mode="out-in">
              <div :key="store.currentSong.artist" class="artist-name">
                {{ store.currentSong.artist }}
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div class="center-container">
        <div class="controls-wrapper">
          <button class="ctrl-btn sm">
            <Icon icon="lucide:skip-back" width="24" />
          </button>

          <button
              class="ctrl-btn play-btn"
              :class="{ playing: store.isPlaying }"
              @click="store.togglePlay"
          >
            <div class="play-btn-bg"></div>
            <Icon
                :icon="store.isPlaying ? 'lucide:pause' : 'lucide:play'"
                width="32"
                fill="currentColor"
                class="play-icon"
            />
          </button>

          <button class="ctrl-btn sm">
            <Icon icon="lucide:skip-forward" width="24" />
          </button>
        </div>
      </div>

      <div class="side-container right">
        <div class="extra-controls">
          <span class="time-display">
            {{ formatTime(store.currentTime) }} / {{ formatTime(store.currentSong.duration) }}
          </span>

          <div class="volume-box">
            <Icon v-if="store.volume === 0" icon="lucide:volume-x" width="18" />
            <Icon v-else-if="store.volume < 50" icon="lucide:volume-1" width="18" />
            <Icon v-else icon="lucide:volume-2" width="18" />

            <el-slider
                v-model="store.volume"
                size="small"
                class="apple-slider"
                :show-tooltip="false"
            />
          </div>

          <button
              class="icon-btn"
              :class="{ active: store.showPlaylist }"
              @click="store.showPlaylist = !store.showPlaylist"
          >
            <Icon icon="lucide:list-music" width="20" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { usePlayerStore } from '../../stores/playerStore';
import { Icon } from '@iconify/vue';

const store = usePlayerStore();
const isHoveringProgress = ref(false);

// 动态背景样式
const dynamicBackground = computed(() => {
  const { primary, secondary } = store.themeColors;
  // 使用 radial-gradient 模拟 Apple Music 的光斑效果
  return {
    background: `
      radial-gradient(circle at 0% 0%, ${primary} 0%, transparent 60%),
      radial-gradient(circle at 100% 100%, ${secondary} 0%, transparent 60%),
      linear-gradient(135deg, rgba(20,20,20,0.8) 0%, rgba(30,30,30,0.9) 100%)
    `,
    backgroundColor: '#1a1a1a' // 兜底色
  };
});

// 处理图片加载并取色
function handleImageLoad(e: Event) {
  const img = e.target as HTMLImageElement;
  // 调用优化后的取色函数 (建议将此函数移至 Store 或 Utils，这里演示直接调用)
  extractColorsBetter(img);
}

// 占位函数：进度条交互
function handleHoverProgress(e: MouseEvent) { isHoveringProgress.value = true; }
function handleSeek(e: MouseEvent) { /* 调用 store.seek */ }

function formatTime(val: number) {
  if (!val || isNaN(val)) return '0:00';
  const m = Math.floor(val / 60);
  const s = Math.floor(val % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}

/**
 * 优化版取色逻辑 (可放入 Store)
 * 逻辑：转 HSL，优先取高饱和度(S)和适中亮度(L)的颜色
 */
function extractColorsBetter(img: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const scale = 0.2; // 降低分辨率以提高性能
  canvas.width = Math.floor(img.width * scale);
  canvas.height = Math.floor(img.height * scale);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  // 简单的 HSL 转换工具
  const rgbToHsl = (r: number, g: number, b: number) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  };

  let bestPrimary = { r: 0, g: 0, b: 0, score: -Infinity };
  let bestSecondary = { r: 0, g: 0, b: 0, score: -Infinity };

  // 步长设为 16 加速遍历
  for (let i = 0; i < imageData.length; i += 16) {
    const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2];
    const [h, s, l] = rgbToHsl(r, g, b);

    // 过滤太黑、太白、太灰的颜色
    if (l < 0.1 || l > 0.9 || s < 0.2) continue;

    // 评分算法：饱和度越高分越高，亮度适中分越高
    // Apple Music 偏好鲜艳的颜色
    const score = s * 10 - Math.abs(l - 0.5) * 5;

    if (score > bestPrimary.score) {
      // 当前第一名降级为第二名
      bestSecondary = { ...bestPrimary };
      bestPrimary = { r, g, b, score };
    } else if (score > bestSecondary.score) {
      bestSecondary = { r, g, b, score };
    }
  }

  // 如果找不到颜色（比如全黑白封面），给默认值
  if (bestPrimary.score === -Infinity) {
    store.themeColors = { primary: '#555', secondary: '#333' };
    return;
  }

  store.themeColors = {
    primary: `rgb(${bestPrimary.r}, ${bestPrimary.g}, ${bestPrimary.b})`,
    // 如果第二颜色太弱，稍微调亮主色作为副色
    secondary: bestSecondary.score > -Infinity
        ? `rgb(${bestSecondary.r}, ${bestSecondary.g}, ${bestSecondary.b})`
        : `rgba(${bestPrimary.r}, ${bestPrimary.g}, ${bestPrimary.b}, 0.5)`
  };

  // 进度条颜色取主色的反白或高亮
  store.progressColor = `rgba(255,255,255,0.9)`;
}
</script>

<style scoped lang="scss">
// 引入字体 (推荐在全局 CSS 引入 SF Pro 或 Inter)
$font-stack: "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;

.player-bar {
  position: relative;
  height: 84px; // 稍微加高，显得大气
  width: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: background 1s ease; // 颜色切换要非常平滑
  font-family: $font-stack;
  user-select: none;

  // 玻璃表面层
  .glass-surface {
    position: absolute;
    inset: 0;
    // 关键：iOS 风格的毛玻璃 + 饱和度提升，让背景色透出来更鲜艳
    backdrop-filter: blur(50px) saturate(180%);
    -webkit-backdrop-filter: blur(50px) saturate(180%);
    background: rgba(30, 30, 30, 0.45);
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    z-index: 1;
  }

  // 噪点层
  .noise-overlay {
    position: absolute;
    inset: 0;
    opacity: 0.04;
    z-index: 2;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    pointer-events: none;
  }

  .bar-content {
    position: relative;
    z-index: 10;
    flex: 1;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 32px;
    color: rgba(255, 255, 255, 0.92);
  }

  /* --- 顶部进度条 (Apple 风格：极细 -> 悬浮变粗) --- */
  .progress-container {
    position: absolute;
    top: -1px; // 贴顶
    left: 0;
    width: 100%;
    height: 4px; // 热区高度
    z-index: 20;
    cursor: pointer;
    transition: height 0.2s ease;

    .progress-track {
      width: 100%;
      height: 100%;
      background: rgba(255, 255, 255, 0.1);
    }

    .progress-fill {
      position: relative;
      height: 100%;
      // 默认颜色，会被 inline-style 覆盖
      background: white;
      transition: width 0.1s linear;

      // 进度条末端的辉光
      .progress-glow {
        position: absolute;
        right: -4px;
        top: 50%;
        transform: translateY(-50%);
        width: 8px;
        height: 8px;
        background: inherit;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(255, 255, 255, 0.8);
        opacity: 0; // 默认隐藏
        transition: opacity 0.2s;
      }
    }

    &:hover {
      height: 6px; // 悬浮变粗
      .progress-fill .progress-glow { opacity: 1; }
    }
  }

  /* --- 左侧：信息 --- */
  .side-container {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0;
    &.right { justify-content: flex-end; }
  }

  .track-info {
    display: flex;
    align-items: center;
    gap: 16px;

    .album-cover {
      width: 52px;
      height: 52px;
      border-radius: 6px; // Apple Music 圆角较小
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3); // 更深邃的阴影
      background: #333;
      img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s; }

      &:hover img { transform: scale(1.05); } // 细微交互
    }

    .meta {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;

      .song-title {
        font-size: 15px;
        font-weight: 600;
        letter-spacing: -0.2px;
        // 长文字渐变消失遮罩
        mask-image: linear-gradient(90deg, #000 85%, transparent 100%);
      }

      .artist-name {
        font-size: 13px;
        color: rgba(255, 255, 255, 0.6);
        font-weight: 400;
      }
    }
  }

  /* --- 中间：控制 --- */
  .center-container {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);

    .controls-wrapper {
      display: flex;
      align-items: center;
      gap: 32px; // 更宽的间距
    }
  }

  .ctrl-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255, 255, 255, 0.7);
    transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover { color: white; transform: scale(1.05); }
    &:active { transform: scale(0.95); }

    &.play-btn {
      position: relative;
      width: 48px;
      height: 48px;
      color: white; // 播放图标始终高亮

      // 播放按钮背景 (毛玻璃圆)
      .play-btn-bg {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        transition: background 0.2s;
        z-index: -1;
      }

      &:hover .play-btn-bg { background: rgba(255, 255, 255, 0.25); }
      &.playing .play-icon { transform: scale(0.9); } // 细微视觉调整
    }
  }

  /* --- 右侧：功能 --- */
  .extra-controls {
    display: flex;
    align-items: center;
    gap: 24px;

    .time-display {
      font-variant-numeric: tabular-nums; // 数字等宽，防止跳动
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      letter-spacing: 0.5px;
    }

    .volume-box {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 120px;
      color: rgba(255, 255, 255, 0.7);
    }

    .icon-btn {
      background: none;
      border: none;
      color: rgba(255, 255, 255, 0.6);
      cursor: pointer;
      transition: color 0.2s;
      &.active, &:hover { color: white; }
    }
  }
}

/* --- Apple 风格 Slider --- */
:deep(.apple-slider) {
  --el-slider-height: 4px;
  --el-slider-button-size: 12px;
  --el-slider-main-bg-color: rgba(255, 255, 255, 0.9);
  --el-slider-runway-bg-color: rgba(255, 255, 255, 0.15);

  .el-slider__bar {
    border-radius: 2px;
  }

  .el-slider__button {
    background: white;
    border: none;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: transform 0.1s;
    opacity: 0; // 默认隐藏滑块圆点
  }

  // 悬浮时显示滑块圆点
  &:hover .el-slider__button {
    opacity: 1;
    transform: scale(1.2);
  }
}

/* --- Vue 动画 --- */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.3s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(5px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-5px);
}
</style>
<template>
  <div class="player-bar" :style="gradientStyle">
    <div class="glass-overlay"></div>

    <!-- 新增：顶部进度条，使用专辑图提取的最深色 -->
    <div class="top-progress">
      <div class="progress-fill" :style="{ width: store.progressPercentage + '%', backgroundColor: store.progressColor }"></div>
    </div>

    <div class="bar-content">
      <div class="side-container left">
        <div class="track-info">
          <div class="album-cover">
            <img :src="store.currentSong.cover" @load="store.extractColors"  alt="Album Pic"/>
          </div>
          <div class="meta">
            <div class="song-title">{{ store.currentSong.title }}</div>
            <div class="artist-name">{{ store.currentSong.artist }}</div>
          </div>
        </div>
      </div>

      <div class="center-container">
        <div class="controls-wrapper">
          <button class="ctrl-btn sm">
            <Icon icon="lucide:skip-back" width="22" />
          </button>
          <button class="ctrl-btn lg play-btn" @click="store.togglePlay">
            <Icon :icon="store.isPlaying ? 'lucide:pause' : 'lucide:play'" width="28" fill="currentColor" />
          </button>
          <button class="ctrl-btn sm">
            <Icon icon="lucide:skip-forward" width="22" />
          </button>
        </div>
      </div>

      <div class="side-container right">
        <div class="extra-controls">
          <!-- 美化后的时间显示，放在右侧最左侧 -->
          <div class="time-display">
            {{ formatTime(store.currentTime) }}&nbsp;/&nbsp;{{ formatTime(store.currentSong.duration) }}
          </div>

          <Icon icon="lucide:repeat" width="20" class="icon-btn" />
          <div class="volume-box">
            <Icon icon="lucide:volume-2" width="20" />
            <el-slider v-model="store.volume" size="small" class="custom-slider" />
          </div>
          <Icon icon="lucide:list-music" width="20"
                class="icon-btn"
                :class="{ active: store.showPlaylist }"
                @click="store.showPlaylist = !store.showPlaylist" />
        </div>
      </div>
    </div>

    <!-- 保留底部细进度条（鼠标悬停可变粗） -->
    <div class="bottom-progress">
      <div class="progress-fill" :style="{ width: store.progressPercentage + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePlayerStore } from '../../stores/playerStore';
import { Icon } from '@iconify/vue';

const store = usePlayerStore();

const gradientStyle = computed(() => {
  return {
    background: `linear-gradient(135deg, ${store.themeColors.primary}, ${store.themeColors.secondary})`
  };
});

function formatTime(val: number) {
  if (!val || isNaN(val)) return '0:00';
  const m = Math.floor(val / 60);
  const s = Math.floor(val % 60);
  return `${m}:${s < 10 ? '0' + s : s}`;
}
</script>

<style scoped lang="scss">
.player-bar {
  height: 80px; // 稍微增高以容纳布局
  width: 100%;
  position: relative;
  overflow: hidden;
  transition: background 0.5s ease; // 颜色切换动画

  .glass-overlay {
    position: absolute;
    inset: 0;
    background: rgba(255, 255, 255, 0.15); // 稍微提亮
    backdrop-filter: blur(20px); // 毛玻璃
    z-index: 1;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .bar-content {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 3%; // 使用百分比 padding 适应缩放
    color: white; // 假设提取的颜色较深，文字用白色，反之需计算反色
  }

  /* 左右容器，确保中间绝对居中 */
  .side-container {
    flex: 1;
    display: flex;
    align-items: center;
    min-width: 0; // 防止 flex item 溢出

    &.right {
      justify-content: flex-end;
    }
  }

  /* 左侧信息 */
  .track-info {
    display: flex;
    align-items: center;
    gap: 16px;

    .album-cover {
      width: 56px;
      height: 56px;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      flex-shrink: 0;
      img { width: 100%; height: 100%; object-fit: cover; }
    }

    .meta {
      overflow: hidden;
      white-space: nowrap;
      .song-title { font-size: 1.1rem; font-weight: 600; text-overflow: ellipsis; overflow: hidden; }
      .artist-name { font-size: 0.9rem; opacity: 0.8; margin-top: 4px; }
    }
  }

  /* 绝对居中容器 */
  .center-container {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    width: 200px; // 限制宽度

    .controls-wrapper {
      display: flex;
      align-items: center;
      gap: 24px;
    }
  }

  /* 按钮样式 */
  .ctrl-btn {
    background: transparent;
    border: none;
    color: rgba(255,255,255,0.9);
    cursor: pointer;
    padding: 0;
    transition: transform 0.2s, color 0.2s;

    &:hover { color: #fff; transform: scale(1.1); }
    &:active { transform: scale(0.95); }

    &.play-btn {
      width: 48px;
      height: 48px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      &:hover { background: rgba(255,255,255,0.3); }
    }
  }

  /* 右侧图标 */
  .extra-controls {
    display: flex;
    align-items: center;
    gap: 20px;

    .time-display {
      margin-right: auto;
      padding-right: 20px; // 与图标保持距离
    }

    .icon-btn {
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s;
      &:hover { opacity: 1; }
      &.active { color: #ffeb3b; opacity: 1; }
    }

    .volume-box {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100px;
    }
  }

  /* 底部微型进度条 */
  .bottom-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: rgba(255,255,255,0.1);
    z-index: 3;
    cursor: pointer;

    .progress-fill {
      height: 100%;
      background: rgba(255,255,255,0.6);
      transition: width 0.1s linear;
    }

    &:hover {
      height: 6px;
      .progress-fill { background: #fff; }
    }
  }
  /* 顶部进度条 */
  .top-progress {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 3px;
    background: rgba(0, 0, 0, 0.2);
    z-index: 4;

    .progress-fill {
      height: 100%;
      transition: width 0.2s ease;
      background-color: white; // fallback
    }
  }
  .time-display {
    font-family: 'SF Mono', 'Roboto Mono', Menlo, monospace;
    font-size: 12.5px;
    font-weight: 500;
    opacity: 0.9;
    letter-spacing: 0.5px;
    min-width: 100px;
    text-align: left;
  }

}

/* 覆盖 Element Slider 样式以适配深色背景 */
:deep(.custom-slider) {
  --el-slider-main-bg-color: rgba(255,255,255,0.8);
  --el-slider-runway-bg-color: rgba(255,255,255,0.2);
  .el-slider__bar { background-color: white; }
  .el-slider__button { border-color: white; width: 12px; height: 12px; }
}
</style>

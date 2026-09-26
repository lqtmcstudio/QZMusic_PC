<template>
  <div class="fullscreen-player" :class="{ active: isPlayerFullScreen }">
    <div class="background-container">
      <BackgroundRender
          :album="playerStore.currentSong?.pic"
          :album-is-video="false"
          ref="bgRef"
          style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
       />
    </div>

    <div v-if="isPlayerFullScreen" class="drag-bar"></div>

    <div class="horizontal-layout" :class="{ hideLyric: playerStore.hideLyricView }">
      <div class="drag-area" @dblclick="toggleMaximize"></div>
      <div class="thumb">
        <ControlThumb @click="toggleFullScreen" />
      </div>
      <Cover
        :class="['cover', { 'shared-cover': isPlayerFullScreen }]"
        :cover-url="playerStore.currentSong?.pic"
        :music-paused="!isPlaying"
        :cover-video-paused="!isPlaying"
        :pause-shrink-aspect="0.75"
      />
      <div class="controls">
        <div class="music-info-row">
          <MusicInfo
              :name="playerStore.currentSong?.name"
              :artists="playerStore.currentSong?.artists?.split('、')??undefined"
              class="music-info-container"
          />
          <button
              class="meta-like"
              :class="{ liked: playerStore.isCurrentSongLiked }"
              :title="playerStore.isCurrentSongLiked ? '取消喜欢' : '喜欢'"
              @click.stop="playerStore.toggleLike()"
          >
            <Icon :icon="playerStore.isCurrentSongLiked ? 'ph:heart-fill' : 'ph:heart-bold'" />
          </button>
        </div>
        <div class="progress-block">
            <BouncingSlider
                :value="playerStore.currentTime"
                :min="0"
                :max="playerStore.duration"
                :is-playing="isPlaying"
                @update:value="handleSeek"
            />
            <div class="progressBarLabels">
                <div class="time-label">
                    {{ formatTime(playerStore.currentTime) }}
                </div>
                <button
                    v-if="qualityTag"
                    class="meta-quality"
                    @click.stop="openQualityDialog"
                >
                  <img v-if="qualityIsLossless" :src="IconLossless" class="quality-icon" alt="" />
                  <span>{{ qualityTag }}</span>
                </button>
                <div
                    class="time-label remaining"
                    @click="showRemaining = !showRemaining"
                >
                    {{ showRemaining ? `-${formatTime(playerStore.duration - playerStore.currentTime)}` : formatTime(playerStore.duration) }}
                </div>
            </div>
        </div>
        <div class="mediaControlls">
          <MediaButton class="songMediaButton" @click="playerStore.toggleMode">
            <template v-if="playMode === 'random'">
              <img :src="IconShuffleActive" :style="iconStyle"/>
            </template>
            <template v-else>
              <img :src="IconShuffle" :style="iconStyle"/>
            </template>
          </MediaButton>

          <MediaButton class="songMediaButton" @click="()=>playerStore.prev()">
            <img :src="IconRewind" />
          </MediaButton>

          <MediaButton class="songMediaPlayButton" @click="playerStore.togglePlay">
            <img :src="isPlaying ? IconPause : IconPlay"/>
          </MediaButton>

          <MediaButton class="songMediaButton" @click="()=>playerStore.next()">
            <img :src="IconForward" />
          </MediaButton>

          <MediaButton class="songMediaButton" @click="playerStore.toggleMode">
            <template v-if="playMode === 'single'">
              <img :src="IconRepeatOneActive" :style="iconStyle" />
            </template>
            <template v-else-if="playMode === 'list'">
              <img :src="IconRepeatActive" :style="iconStyle" />
            </template>
            <template v-else>
              <img :src="IconRepeat" :style="iconStyle" />
            </template>
          </MediaButton>
        </div>
        <div class="volumeControllBar">
          <VolumeControl
              v-model="playerStore.volume"
              :min="0"
              :max="100"
              :on-update="value => {
                    playerStore.setVolume( Math.floor(value) )
                  }"
          />
        </div>
      </div>
      <div class="lyric" :class="{ 'show-playlist': showPlaylistPanel }">
        <!-- Playlist Panel -->
        <Transition name="playlist-fade">
          <div v-if="showPlaylistPanel" class="playlist-panel">
            <div class="playlist-header">
              <span class="playlist-title">播放队列</span>
              <div class="playlist-header-actions">
                <span class="playlist-count">{{ playerStore.playlist.length }} 首</span>
                <button
                  class="playlist-clear"
                  title="清空播放队列"
                  :disabled="playerStore.playlist.length === 0"
                  @click.stop="playerStore.clearQueue()"
                >
                  <Icon icon="lucide:trash-2" />
                </button>
              </div>
            </div>
            <PlayerQueueList class="playlist-scroll" variant="fullscreen" />
          </div>
        </Transition>
        <!-- Lyric Player: 常驻挂载(v-show), 避免每次开关列表时 AMLL(blur+spring) 重建卡顿 ~1s -->
        <LyricPlayer
            v-if="isPlayerFullScreen"
            v-show="!showPlaylistPanel"
            ref="lyricPlayerRef"
            :lyric-lines="toRaw(playerStore.lyrics.lines)"
            :current-time="playerStore.currentTime"
            :playing="isPlaying"
            :align-position="0.5"
            :wordFadeWidth="0.5"
            :enable-scale="false"
            :enable-blur="true"
            :enable-spring="true"
            @line-click="jumpTime"
            style="width:100%;height:100%;font-family: 'LyricFont',sans-serif"
        >
        </LyricPlayer>
      </div>
      <div class="bottomControls">
        <ToggleIconButton
            type="playlist"
            :checked="showPlaylistPanel"
            @click="togglePlaylistPanel"
        />
        <ToggleIconButton
            type="lyrics"
            :checked="!playerStore.hideLyricView"
            @click="playerStore.hideLyricView = !playerStore.hideLyricView"
        />
        <div style="flex: 1" />
        <ToggleIconButton
            type="airplay"
        />
      </div>
    </div>

    <canvas ref="canvasRef" class="spectrum-canvas"></canvas>

    <!-- 音质选择弹窗 (全屏居中 + mask) -->
    <Teleport to="body">
      <Transition name="quality-mask">
        <div v-if="showQualityDialog" class="quality-mask" @click="closeQualityDialog">
          <div class="quality-dialog" @click.stop>
            <div class="quality-dialog-title">
              插件音质选择-{{ pluginName }}
            </div>
            <div class="quality-dialog-list">
              <div
                  v-for="q in qualityOptions"
                  :key="q.id"
                  class="quality-row"
                  :class="{ current: q.id === playerStore.pluginQualityMap[currentSource] }"
                  @click="selectQuality(q.id)"
              >
                <span class="quality-row-badge" :class="{ supported: q.supported }">{{ q.ui || q.name }}</span>
                <span class="quality-row-name">{{ q.supported ? q.name + '(支持)' : q.name }}</span>
                <span v-if="q.id === playerStore.pluginQualityMap[currentSource]" class="quality-row-default">默认</span>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script lang="ts" setup>
import { computed, toRaw, watch, ref, onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '../stores/player';

import "@applemusic-like-lyrics/core/style.css";
import { LyricPlayer, type LyricPlayerRef, BackgroundRender, type BackgroundRenderRef} from "@applemusic-like-lyrics/vue";
import { LyricLineMouseEvent } from "@applemusic-like-lyrics/core";
import Cover from './player/Cover.vue';
import ControlThumb from './player/ControlThumb.vue';
import BouncingSlider from './player/BouncingSlider.vue';
import MusicInfo from './player/MusicInfo.vue';
import MediaButton from './player/MediaButton.vue';
import VolumeControl from './player/VolumeControl.vue';
import ToggleIconButton from './player/ToggleIconButton.vue';
import PlayerQueueList from './player/PlayerQueueList.vue';

// Icons
import IconRewind from '@assets/icon_rewind.svg';
import IconPlay from '@assets/icon_play.svg';
import IconPause from '@assets/icon_pause.svg';
import IconForward from '@assets/icon_forward.svg';
import IconShuffle from '@assets/shuffle.svg';
import IconShuffleActive from '@assets/shuffle-active.svg';
import IconRepeat from '@assets/repeat.svg';
import IconRepeatOneActive from '@assets/repeat-one-active.svg';
import IconRepeatActive from '@assets/repeat-active.svg';
import IconLossless from '@assets/icon_lossless.svg';
import { Icon } from '@iconify/vue';

const lyricPlayerRef = ref<LyricPlayerRef>()
const bgRef = ref<BackgroundRenderRef>();

const showRemaining = ref(false);
const showPlaylistPanel = ref(false);
const showQualityDialog = ref(false);

// --- 音质标签 ---
// 复刻手机端 AppleMusicLikeProgress.translateQuality: 将音质 id 映射为展示文案。
const translateQuality = (quality?: string | null): string => {
  switch ((quality || '').toLowerCase()) {
    case 'master':
    case 'jymaster':
    case 'tape_clear':
    case 'tape':
      return '至臻母带';
    case 'jyeffect':
      return '高清臻音';
    case 'sky':
      return '沉浸环绕声';
    case 'atmos':
    case 'dolby':
    case 'db':
      return '全景声';
    case 'atmos_plus':
      return '全景声+';
    case 'standard':
    case '128k':
    case 'medium':
      return '标准';
    case 'exhigh':
    case '320k':
    case 'higher':
      return '高品质';
    case 'highest':
      return '超高品质';
    default:
      return quality || '';
  }
};

// 当前生效的音质(优先用 autoGetQuality 结果)
const effectiveQuality = computed(() => playerStore.autoGetQuality());

const qualityTag = computed(() => {
  const q = effectiveQuality.value;
  if (!q) return '';
  const lower = q.toLowerCase();
  // 无损类音质用固定文案 + 波形图标
  if (['hires', 'zq', 'flac24bit'].includes(lower)) return '高解析度无损';
  if (['lossless', 'flac', 'sq'].includes(lower)) return '无损';
  const translated = translateQuality(q);
  return translated;
});

const qualityIsLossless = computed(() => {
  const lower = effectiveQuality.value.toLowerCase();
  return ['hires', 'zq', 'flac24bit', 'lossless', 'flac', 'sq'].includes(lower);
});

const currentSource = computed(() => playerStore.currentSong?.source || '');
const pluginName = computed(() => playerStore.pluginManifests?.[currentSource.value]?.name || currentSource.value);

// 与手机端 rememberQualityList 一致: 列出插件全部音质, 歌曲支持的标记 (支持)
const qualityOptions = computed(() => {
  const song = playerStore.currentSong;
  const source = song?.source;
  if (!song || !source || source === 'local') return [];
  const qualities = playerStore.availableQualities || [];
  const supported = song.qualities || {};
  return qualities.map((q: any) => ({
    ...q,
    supported: Object.prototype.hasOwnProperty.call(supported, q.id),
  }));
});

const openQualityDialog = () => {
  if (!qualityTag.value) return;
  showQualityDialog.value = true;
};

const closeQualityDialog = () => {
  showQualityDialog.value = false;
};

const selectQuality = async (qualityId: string) => {
  showQualityDialog.value = false;
  await playerStore.setQuality(qualityId);
};

const formatTime = (miliseconds: number) => {
  const seconds = miliseconds / 1000;
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec.toString().padStart(2, '0')}`;
};

const syncLyricPlayerSeek = (time: number) => {
  const lyricPlayer = lyricPlayerRef.value?.lyricPlayer.value;
  lyricPlayer?.resetScroll();
  lyricPlayer?.setCurrentTime(time, true);
};

const handleSeek = (val: number) => {
  playerStore.seek(val);
  syncLyricPlayerSeek(val);
};


const playerStore = usePlayerStore();
const isPlayerFullScreen = computed(() => playerStore.isPlayerFullScreen);
const isPlaying = computed(() => playerStore.isPlaying);
const playMode = computed(() => playerStore.playMode);

const iconStyle = {
    width: "1.3em",
    height: "1.3em",
};
const canvasRef = ref<HTMLCanvasElement | null>(null);
let animationId: number | null = null;
let currentData: number[] = new Array(32).fill(0); // For temporal smoothing

const drawSpectrum = () => {
  if (!canvasRef.value) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Adjust canvas size
  const dpr = window.devicePixelRatio || 1;

  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  ctx.clearRect(0, 0, width, height);

  const targetData = playerStore.spectrum;
  if (!targetData) return;

  // 1. Temporal Smoothing (LERP)
  // Adjust speed (0.1 - 0.3) for desired smoothness
  const lerpSpeed = 0.15;
  for (let i = 0; i < 32; i++) {
    const target = targetData[i] || 0;
    currentData[i] = currentData[i] + (target - currentData[i]) * lerpSpeed;
  }

  // 2. Draw Smooth Wave
  ctx.beginPath();
  ctx.moveTo(0, height);

  const pointCount = currentData.length;
  // Use a subset if desired, but 32 is fine.
  // We want the wave to be centered or span the width.
  const step = width / (pointCount - 1);

  // Start point
  let x = 0;
  let y = height - (currentData[0] * height * 0.5); // Scale 0.5
  ctx.lineTo(x, y);

  for (let i = 0; i < pointCount - 1; i++) {
    const xCurr = i * step;
    const yCurr = height - (currentData[i] * height * 0.5);

    const xNext = (i + 1) * step;
    const yNext = height - (currentData[i + 1] * height * 0.5);

    // Control point for quadratic curve (midpoint)
    const xMid = (xCurr + xNext) / 2;
    const yMid = (yCurr + yNext) / 2;

    ctx.quadraticCurveTo(xCurr, yCurr, xMid, yMid);
  }

  // Connect to last point
  const lastX = (pointCount - 1) * step;
  const lastY = height - (currentData[pointCount - 1] * height * 0.5);
  ctx.lineTo(lastX, lastY);

  // Close path to bottom
  ctx.lineTo(width, height);
  ctx.closePath();

  // Style
  const gradient = ctx.createLinearGradient(0, height - 200, 0, height);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0.05)');

  ctx.fillStyle = gradient;

  // Add blur effect
  ctx.shadowBlur = 20;
  ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';

  ctx.fill();

  // Reset shadow for next frame (performance)
  ctx.shadowBlur = 0;
};

const loop = () => {
  if (isPlayerFullScreen.value) {
    drawSpectrum();
    animationId = requestAnimationFrame(loop);
  }
};

watch(isPlayerFullScreen, (val) => {
  if (val) {
    loop();
  } else {
    if (animationId) cancelAnimationFrame(animationId);
  }
});

const handleQualityKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && showQualityDialog.value) {
    showQualityDialog.value = false;
  }
};

onMounted(() => {
  if (isPlayerFullScreen.value) loop();
  window.addEventListener('keydown', handleQualityKeydown);
});

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
  window.removeEventListener('keydown', handleQualityKeydown);
});

const toggleFullScreen = () => {
  playerStore.toggleFullScreen();
};

const toggleMaximize = () => {
  window.electronAPI?.maximizeWindow();
};

const jumpTime = (e: LyricLineMouseEvent) => {
  const time = e.line.getLine().startTime;
  playerStore.seek(time);
  syncLyricPlayerSeek(time);
}

const togglePlaylistPanel = () => {
  // 仅切换面板显隐; 不再触碰 hideLyricView, 避免关闭时整个横向布局(cover/controls 位移)重排卡顿。
  showPlaylistPanel.value = !showPlaylistPanel.value;
};

// watch(()=>playerStore.currentTime,(t)=>{
//   console.log(toRaw(t))
// })
</script>

<style scoped>
.fullscreen-player {
  --height: calc(100vh);
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: var(--height);
  z-index: 9999;
  opacity: 0;
  transform: translateY(100%) scale(0.985);
  transform-origin: bottom center;
  transition:
    transform 0.46s cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 0.28s ease;
  background: black; /* Default background if image fails */
  overflow: hidden;
  pointer-events: none;
}

.fullscreen-player.active {
  opacity: 1;
  transform: translateY(0) scale(1);
  pointer-events: auto;
}

.background-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  pointer-events: none;
}

.drag-area {
  grid-column: 1 / -1;
  grid-row: drag-area;
  -webkit-app-region: drag;
  z-index: 20;
  position: relative;
}

.drag-bar {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 50px;
  z-index: 10001;
  -webkit-app-region: drag;
  background: transparent;
}


.spectrum-canvas {
  width: 100%;
  height: 200px;
  position: absolute;
  bottom: 0;
  left: 0;
  pointer-events: none;
  z-index: 15;
  mask-image: linear-gradient(to top, black 0%, transparent 100%);
  -webkit-mask-image: linear-gradient(to top, black 0%, transparent 100%);
}

@font-face {
  font-family: 'LyricFont';
  src: url('@assets/lyricfont.ttf');
  font-weight: 350;
}

/* New Horizontal Layout Styles */
.horizontal-layout {
  /* --info-size-fract: 0.85fr; */
  /* --player-size-fract: 1fr; */
  width: 100%;
  height: 100%;

  position: relative;
  display: grid;
  grid-template-rows: [drag-area] minmax(20px, .20fr) [thumb] auto [cover] auto [music-info] 3fr [buttom-controls] 0fr .1fr;
  grid-template-columns: [info-side] .50fr [player-side] .50fr [side-controls] 0fr;
  gap: 8px;
  transition: all 0.5s ease-in-out;
  left: 0;

  --hide-lyric-left: 50%;

  --horizontal-layout-max-width: min(50vh, 38vw);
}

.horizontal-layout .thumb,
.horizontal-layout .cover,
.horizontal-layout .controls {
  transition: left 0.5s cubic-bezier(0.5, 0, 0.5, 1);
  left: 0;
}



.horizontal-layout.hideLyric .lyric {
  transition:
    opacity 0.25s cubic-bezier(0.5, 0, 0.5, 1),
    transform 0.5s cubic-bezier(0.5, 0, 0.5, 1);
  opacity: 0;
  pointer-events: none;
}

.horizontal-layout.hideLyric .thumb,
.horizontal-layout.hideLyric .cover,
.horizontal-layout.hideLyric .controls {
  left: var(--hide-lyric-left);
}

@media screen and (max-height: 1000px) {
  .horizontal-layout {
    --horizontal-layout-max-width: min(45vh, 38vw);
  }
}

@media screen and (max-height: 768px) {
  .horizontal-layout {
    font-size: 0.8em;
    gap: 2px;
    grid-template-rows: [drag-area] minmax(30px, 0.25fr) [thumb] auto [cover] auto [music-info] 3fr [buttom-controls] 0fr 0.2fr;
  }
}

.thumb {
  grid-column: info-side;
  grid-row: thumb;
  will-change: transform;
  justify-self: center;
  margin: 2vh;

  position: relative;
  z-index: 10;
  -webkit-app-region: no-drag;
}

.cover {
  margin: 0;
  aspect-ratio: 1 / 1;
  grid-column: info-side;
  grid-row: cover;
  align-self: center;
  justify-self: center;
  width: var(--horizontal-layout-max-width);
  height: var(--horizontal-layout-max-width);

  position: relative;
}

.cover.shared-cover {
  view-transition-name: now-playing-cover;
}

.controls {
  grid-area: music-info / info-side;
  will-change: transform;
  justify-self: center;

  mix-blend-mode: plus-lighter;
  min-width: 0;
  min-height: 0;
  width: var(--horizontal-layout-max-width);

  display: flex;
  flex-direction: column;
  justify-content: space-evenly;
  height: 100%;

  position: relative;
  margin-top: calc(-8px + 1.75em);
}

.progressBarLabels {
	display: flex;
	justify-content: space-between;
	align-items: center;
	font-weight: 500;
	font-size: max(1.2vh, 0.8em);
	margin-top: 4px;

	@media screen and (max-height: 768px) {
		margin-top: 0;
	}

	& > * {
		flex: 1;
	}

	& > .meta-quality {
		flex: 0 0 auto;
	}

	& > *:last-child {
		text-align: right;
	}
}

.time-label {
    font-variant-numeric: tabular-nums;
    color: white;
    opacity: 0.5;
}

.time-label.remaining {
    cursor: pointer;
    user-select: none;
}

.music-info-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.8em;
    margin-bottom: 2vh;
}

.music-info-container {
    flex: 1;
    min-width: 0;
    width: auto;
}

.meta-like {
	display: grid;
	place-items: center;
	background: transparent;
	border: 0;
	padding: 0;
	cursor: pointer;
	color: rgba(255, 255, 255, 0.58);
	font-size: 1.4em;
	flex: 0 0 auto;
	transition: color 160ms ease, transform 160ms ease;
}

.meta-like:hover {
	color: rgba(255, 255, 255, 0.9);
}

.meta-like:active {
	transform: scale(0.9);
}

.meta-like.liked {
	color: #fff;
}

/* 音质标签: 仿照 Android AppleMusicLikeProgress 的白色半透明胶囊 */
.meta-quality {
	display: inline-flex;
	align-items: center;
	gap: 0.35em;
	padding: 0.45em 0.75em;
	border-radius: 8px;
	border: 0;
	cursor: pointer;
	background: rgba(255, 255, 255, 0.2);
	color: #fff;
	font-size: max(1.2vh, 0.8em);
	font-weight: 100;
	line-height: 1;
	white-space: nowrap;
	transition: background 160ms ease;
  mix-blend-mode: plus-lighter;
}

.quality-icon {
	width: 1.15em;
	height: 0.75em;
	display: block;
	flex: 0 0 auto;
}

/* 音质选择弹窗 (全屏居中 + mask) */
.quality-mask {
	position: fixed;
	inset: 0;
	z-index: 10050;
	display: grid;
	place-items: center;
	background: rgba(0, 0, 0, 0.55);
	backdrop-filter: blur(6px);
	-webkit-backdrop-filter: blur(6px);
}

.quality-dialog {
	width: min(420px, 82vw);
	max-height: min(70vh, 560px);
	display: flex;
	flex-direction: column;
	overflow: hidden;
	padding: 1em 0.6em 0.7em;
	border-radius: 24px;
	background: rgba(26, 26, 26, 0.96);
	border: 1px solid rgba(255, 255, 255, 0.1);
	box-shadow: 0 24px 70px rgba(0, 0, 0, 0.55);
}

.quality-dialog-title {
	padding: 0.3em 1em 0.9em;
	font-size: 1.15em;
	font-weight: 700;
	color: rgba(255, 255, 255, 0.92);
}

.quality-dialog-list {
	flex: 1;
	overflow-y: auto;
	scrollbar-width: thin;
	scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.quality-row {
	display: flex;
	align-items: center;
	gap: 1em;
	padding: 0.7em 1em;
	border-radius: 14px;
	cursor: pointer;
	transition: background 160ms ease;
}

.quality-row:hover {
	background: rgba(255, 255, 255, 0.08);
}

.quality-row.current {
	background: rgba(255, 255, 255, 0.12);
}

.quality-row-badge {
	flex: 0 0 auto;
	width: 2.5em;
	height: 2.5em;
	display: grid;
	place-items: center;
	border-radius: 50%;
	background: rgba(255, 71, 0, 0.12);
	color: rgba(255, 148, 110, 0.65);
	font-size: 0.8em;
	font-weight: 800;
}

.quality-row-badge.supported {
	background: rgba(159, 207, 251, 0.2);
	color: rgba(196, 241, 255, 0.9);
}

.quality-row-name {
	flex: 1;
	min-width: 0;
	color: rgba(255, 255, 255, 0.9);
	font-size: 1em;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.quality-row-default {
	flex: 0 0 auto;
	color: rgba(255, 255, 255, 0.6);
	font-weight: 700;
	font-size: 0.9em;
}

.quality-mask-enter-active,
.quality-mask-leave-active {
	transition: opacity 220ms ease;
}

.quality-mask-enter-active .quality-dialog,
.quality-mask-leave-active .quality-dialog {
	transition: transform 240ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms ease;
}

.quality-mask-enter-from,
.quality-mask-leave-to {
	opacity: 0;
}

.quality-mask-enter-from .quality-dialog,
.quality-mask-leave-to .quality-dialog {
	opacity: 0;
	transform: scale(0.94);
}


.lyric {
  box-sizing: border-box;
  grid-column: player-side;
  grid-row: 2 / 5;
  width: 100%;
  height: 100%;
  transition: opacity 0.5s 0.25s cubic-bezier(0.5, 0, 0.5, 1);
  padding-right: 15%;

  mask-image: linear-gradient(transparent, black 10%, black 90%, transparent);

  contain: paint;
  pointer-events: none; /* Allow clicks to pass through to elements below */

  /* 修复呼吸点,不要删!*/
  :deep(.amll-lyric-player) {
    box-sizing: content-box;
    pointer-events: auto; /* Re-enable pointer events for the actual lyric player */
    [class*="interludeDots"] {
      box-sizing: content-box;
    }
  }
}

@media screen and (max-width: 1600px), (max-height: 1000px) {
  .lyric {
    padding-right: 8%;
  }
}

.lyric.show-playlist {
  mask-image: linear-gradient(black 0%, black 90%, transparent);
}

.bottomControls {
  grid-area: buttom-controls / 1 / buttom-controls / 4;
  gap: 2em;
  padding-left: 2em;
  padding-right: 2em;
  mix-blend-mode: plus-lighter;
  flex-direction: row-reverse;
  color: #fff;
  display: flex;
}

.songMediaButton,
.songMediaPlayButton {
	width: 18%;
	aspect-ratio: 1 / 1;
}

.songMediaButton > img {
    display: block;
	scale: 3;
	transition: scale 0.3s;

	@media screen and (max-height: 1080px) {
		scale: 2;
	}

	@media screen and (max-height: 768px) {
		scale: 1.5;
	}

	@media screen and (max-height: 512px) {
		scale: 1;
	}

	@media screen and (max-width: 480px) {
		scale: 0.5;
	}
}

.songMediaPlayButton > img {
	scale: 2;
	transition: scale 0.3s;

	@media screen and (max-height: 1080px) {
		scale: 1.1;
	}

	@media screen and (max-height: 768px) {
		scale: 0.8;
	}

	@media screen and (max-height: 512px) {
		scale: 0.5;
	}

	@media screen and (max-width: 480px) {
		scale: 0.5;
	}
}
.bigControls :deep(button) {
	height: 10vh !important;
	width: 10vh !important;
}

.mediaControlls {
  justify-content: space-between;
  align-items: center;
  display: flex;
  padding-right: 4px;
}
.volumeControllBar {
  touch-action: none;
  justify-content: stretch;
  align-items: center;
  min-height: 24px;
  display: flex;
}

/* Playlist Panel Styles */
.playlist-panel {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border-radius: 20px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  pointer-events: auto;
  margin-right: 15%;
}

@media screen and (max-width: 1600px), (max-height: 1000px) {
  .playlist-panel {
    margin-right: 8%;
  }
}

.playlist-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.playlist-title {
  font-size: 1.2em;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.playlist-count {
  font-size: 0.9em;
  color: rgba(255, 255, 255, 0.5);
}

.playlist-header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.playlist-clear {
  display: grid;
  place-items: center;
  width: 1.6em;
  height: 1.6em;
  border-radius: 50%;
  color: rgba(255, 255, 255, 0.5);
  transition: background-color 160ms ease, color 160ms ease, opacity 160ms ease;
}

.playlist-clear:hover:not(:disabled) {
  color: #ff9a9e;
}

.playlist-clear:disabled {
  opacity: 0.35;
  cursor: default;
}

.playlist-clear svg {
  width: 1.05em;
  height: 1.05em;
  display: block;
}

.playlist-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
}

.playlist-scroll::-webkit-scrollbar {
  width: 6px;
}

.playlist-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.playlist-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.playlist-scroll::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.playlist-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.playlist-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.playlist-item.active {
  background: rgba(255, 255, 255, 0.15);
}

.playlist-item.active .item-name {
  color: rgba(255, 255, 255, 1);
}

.item-index {
  width: 28px;
  text-align: center;
  font-size: 0.85em;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
}

.playlist-item.active .item-index {
  color: rgba(255, 255, 255, 0.9);
}

.playing-indicator {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 2px;
  height: 14px;
}

.playing-indicator .bar {
  width: 3px;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 2px;
  animation: soundBars 0.8s ease-in-out infinite;
}

.playing-indicator .bar:nth-child(1) {
  height: 60%;
  animation-delay: 0s;
}

.playing-indicator .bar:nth-child(2) {
  height: 100%;
  animation-delay: 0.2s;
}

.playing-indicator .bar:nth-child(3) {
  height: 40%;
  animation-delay: 0.4s;
}

@keyframes soundBars {
  0%, 100% {
    transform: scaleY(0.5);
  }
  50% {
    transform: scaleY(1);
  }
}

.item-cover {
  width: 40px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.item-cover-placeholder {
  background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
}

.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 0.95em;
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-artist {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.45);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-duration {
  font-size: 0.85em;
  color: rgba(255, 255, 255, 0.4);
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

/* Playlist Panel Transition */
.playlist-fade-enter-active,
.playlist-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.playlist-fade-enter-from,
.playlist-fade-leave-to {
  opacity: 0;
  transform: translateX(20px);
}

</style>

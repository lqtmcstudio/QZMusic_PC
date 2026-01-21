import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export const usePlayerStore = defineStore('player', () => {
  const currentSong = ref({
    id: 1,
    title: "Example Track",
    artist: "AI Artist",
    cover: "http://p2.music.126.net/h2vun-h_uGBYzGvQoLKiBw==/109951165966921437.jpg?param=130y130",
    url: "https://m704.music.126.net/20260115210245/494fafc7ecc89da85365b1e6533cdb30/jdyyaac/obj/w5rDlsOJwrLDjj7CmsOj/32280537391/40ea/84dd/db94/451cfc92afa4a12926f40b1183eca3cd.m4a?vuutv=yqFO4JPFSDRDeqVLCjH3fPvuLTHnPPNLPMIBbHWfYTZOmqP5/RFh7UnxA2sG1X9+MLdjYsrkG5vUIUjV6t+y1pniceMN5lePyr33C0D1Aho=&authSecret=0000019bc1a9710615420a3283920006&cdntag=bWFyaz1vc193ZWIscXVhbGl0eV9leGhpZ2g",
    duration: 0
  });

  const isPlaying = ref(false);
  const currentTime = ref(0);
  const volume = ref(80);
  const showPlaylist = ref(false);
  const showSettings = ref(false);
  const darkMode = ref(false);
  const themeColors = ref({ primary: '#6366f1', secondary: '#a855f7' });
  const progressColor = ref('#ffffff');

  // 标记是否已初始化监听器，防止重复绑定
  let isInitialized = false;

  // --- 初始化函数：在组件挂载时调用一次 ---
  function init() {
    if (isInitialized) return;

    // 监听时间更新
    window.electronAPI.onMpvTimeUpdate((time) => {
      currentTime.value = time;
    });

    // 监听时长更新 (MPV 加载完元数据后会发送)
    window.electronAPI.onMpvDuration((duration) => {
      currentSong.value.duration = duration;
    });

    // 监听播放状态 (用于同步 MPV 内部状态和 UI)
    window.electronAPI.onMpvPlayState((playing) => {
      isPlaying.value = playing;
    });

    // 监听结束
    window.electronAPI.onMpvEnded(() => {
      isPlaying.value = false;
      currentTime.value = 0;
      // 这里可以添加自动播放下一首的逻辑
    });

    // 初始化音量
    window.electronAPI.mpvSetVolume(volume.value);

    // 加载初始歌曲
    loadCurrentSong(false);

    isInitialized = true;
  }


  function loadCurrentSong(autoPlay:boolean=true) {
    if(currentSong.value.url) {
      window.electronAPI.mpvLoad(currentSong.value.url,autoPlay);
    }
  }

  function togglePlay() {
    if (isPlaying.value) {
      window.electronAPI.mpvPause();
    } else {
      window.electronAPI.mpvPlay();
    }
    isPlaying.value = !isPlaying.value;
  }

  function seek(time: number) {
    window.electronAPI.mpvSeek(time);
    currentTime.value = time; // 立即更新 UI 防止跳变
  }

  // 监听音量变化
  watch(volume, (newVol) => {
    window.electronAPI.mpvSetVolume(newVol);
  });

  // 监听歌曲 URL 变化 (切歌)
  watch(() => currentSong.value.url, () => {
    loadCurrentSong(true);
  });

  // 监听封面变化提取颜色 (保持原有逻辑不变)
  watch(() => currentSong.value.cover, () => {
    extractColors();
  }, { immediate: true });

  // --- 颜色提取逻辑 (保持不变) ---
  function extractColors() {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = currentSong.value.cover + '?t=' + Date.now();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const scale = 0.1;
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const colors: { r: number; g: number; b: number; brightness: number }[] = [];

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const brightness = (r + g + b) / 3;
        colors.push({ r, g, b, brightness });
      }

      const colorFrequency: Record<string, number> = {};
      colors.forEach(color => {
        const key = `${Math.floor(color.r / 16)}${Math.floor(color.g / 16)}${Math.floor(color.b / 16)}`;
        colorFrequency[key] = (colorFrequency[key] || 0) + 1;
      });

      const sortedColors = Object.entries(colorFrequency)
          .map(([key, count]) => {
            const r = parseInt(key[0], 16) * 16;
            const g = parseInt(key[1], 16) * 16;
            const b = parseInt(key[2], 16) * 16;
            return { r, g, b, count };
          })
          .sort((a, b) => b.count - a.count);

      if (sortedColors.length > 0) {
        const primary = sortedColors[0];
        const primaryColor = `rgb(${primary.r}, ${primary.g}, ${primary.b})`;

        let secondary = sortedColors[1] || sortedColors[0];
        let maxBrightnessDiff = Math.abs(primary.brightness - secondary.brightness);

        for (let i = 1; i < Math.min(10, sortedColors.length); i++) {
          const currentBrightness = (sortedColors[i].r + sortedColors[i].g + sortedColors[i].b) / 3;
          const brightnessDiff = Math.abs(primary.brightness - currentBrightness);

          if (brightnessDiff > maxBrightnessDiff) {
            maxBrightnessDiff = brightnessDiff;
            secondary = sortedColors[i];
          }
        }

        const secondaryColor = `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`;

        themeColors.value = {
          primary: primaryColor,
          secondary: secondaryColor
        };

        const darkPrimary = {
          r: Math.floor(primary.r * 0.7),
          g: Math.floor(primary.g * 0.7),
          b: Math.floor(primary.b * 0.7)
        };
        progressColor.value = `rgb(${darkPrimary.r}, ${darkPrimary.g}, ${darkPrimary.b})`;
      } else {
        themeColors.value = { primary: '#6366f1', secondary: '#a855f7' };
        progressColor.value = '#ffffff';
      }
    };
  }

  const progressPercentage = computed(() =>
      currentSong.value.duration ? (currentTime.value / currentSong.value.duration) * 100 : 0
  );

  return {
    currentSong, isPlaying, currentTime, volume, showPlaylist,
    themeColors, progressPercentage, progressColor,
    togglePlay, seek, extractColors,
    showSettings,
    darkMode,
    init
  };
});
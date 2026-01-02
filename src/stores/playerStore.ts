import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

export const usePlayerStore = defineStore('player', () => {
  const currentSong = ref({
    id: 1,
    title: "Example Track",
    artist: "AI Artist",
    cover: "http://p2.music.126.net/W3VMsSEjTdvhz7h3a0oxTg==/17782401556325576.jpg?param=130y130",
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    duration: 0
  });

  const isPlaying = ref(false);
  const currentTime = ref(0);
  const volume = ref(80);
  const showPlaylist = ref(false);
  const showSettings = ref(false);
  const darkMode = ref(false);
  const themeColors = ref({ primary: '#6366f1', secondary: '#a855f7' });

  // 新增：用于顶部进度条的最深色
  const progressColor = ref('#ffffff');

  const audio = new Audio(currentSong.value.url);
  audio.volume = volume.value / 100;

  // 颜色提取函数（轻量版，不依赖外部库）
  function extractColors() {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = currentSong.value.cover + '?t=' + Date.now(); // 避免缓存

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 缩小图片以提高性能
      const scale = 0.1;
      canvas.width = Math.floor(img.width * scale);
      canvas.height = Math.floor(img.height * scale);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        // 收集所有像素颜色
        const colors: { r: number; g: number; b: number; brightness: number }[] = [];
      
      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const brightness = (r + g + b) / 3;
        
        colors.push({ r, g, b, brightness });
      }
      
      // 计算颜色频率（简单实现）
      const colorFrequency: Record<string, number> = {};
      colors.forEach(color => {
        // 将颜色量化为 16 位色，减少颜色数量
        const key = `${Math.floor(color.r / 16)}${Math.floor(color.g / 16)}${Math.floor(color.b / 16)}`;
        colorFrequency[key] = (colorFrequency[key] || 0) + 1;
      });
      
      // 转换回 RGB 并按频率排序
      const sortedColors = Object.entries(colorFrequency)
        .map(([key, count]) => {
          const r = parseInt(key[0], 16) * 16;
          const g = parseInt(key[1], 16) * 16;
          const b = parseInt(key[2], 16) * 16;
          return { r, g, b, count };
        })
        .sort((a, b) => b.count - a.count);
      
      // 提取主色调和辅助色调
      if (sortedColors.length > 0) {
        // 主色调：频率最高的颜色
        const primary = sortedColors[0];
        const primaryColor = `rgb(${primary.r}, ${primary.g}, ${primary.b})`;
        
        // 辅助色调：选择与主色调亮度差异较大的颜色
        let secondary = sortedColors[1] || sortedColors[0];
        let maxBrightnessDiff = Math.abs(primary.brightness - secondary.brightness);
        
        // 在频率较高的颜色中寻找最合适的辅助色
        for (let i = 1; i < Math.min(10, sortedColors.length); i++) {
          const currentBrightness = (sortedColors[i].r + sortedColors[i].g + sortedColors[i].b) / 3;
          const brightnessDiff = Math.abs(primary.brightness - currentBrightness);
          
          if (brightnessDiff > maxBrightnessDiff) {
            maxBrightnessDiff = brightnessDiff;
            secondary = sortedColors[i];
          }
        }
        
        const secondaryColor = `rgb(${secondary.r}, ${secondary.g}, ${secondary.b})`;
        
        // 更新主题颜色
        themeColors.value = {
          primary: primaryColor,
          secondary: secondaryColor
        };
        
        // 提取进度条颜色（使用主色调的深色版本）
        const darkPrimary = {
          r: Math.floor(primary.r * 0.7),
          g: Math.floor(primary.g * 0.7),
          b: Math.floor(primary.b * 0.7)
        };
        progressColor.value = `rgb(${darkPrimary.r}, ${darkPrimary.g}, ${darkPrimary.b})`;
      } else {
        // 默认颜色
        themeColors.value = { primary: '#6366f1', secondary: '#a855f7' };
        progressColor.value = '#ffffff';
      }
    };
  }

  // 监听歌曲切换时重新提取颜色
  watch(() => currentSong.value.cover, () => {
    extractColors();
    console.log("!!")
  }, { immediate: true });

  audio.addEventListener('loadedmetadata', () => {
    currentSong.value.duration = audio.duration;
  });

  audio.addEventListener('timeupdate', () => {
    currentTime.value = audio.currentTime;
  });

  audio.addEventListener('ended', () => {
    isPlaying.value = false;
    currentTime.value = 0;
  });

  function togglePlay() {
    if (isPlaying.value) {
      audio.pause();
    } else {
      audio.play().catch(e => console.warn("播放失败，需用户交互:", e));
    }
    isPlaying.value = !isPlaying.value;
  }

  function seek(time: number) {
    audio.currentTime = time;
  }
  function toggleSettings() { console.log("!!");showSettings.value = !showSettings.value; }

  watch(volume, (newVol) => {
    audio.volume = newVol / 100;
  });

  const progressPercentage = computed(() =>
    currentSong.value.duration ? (currentTime.value / currentSong.value.duration) * 100 : 0
  );

  return {
    currentSong, isPlaying, currentTime, volume, showPlaylist,
    themeColors, progressPercentage, progressColor,
    togglePlay, seek, extractColors,
    showSettings, toggleSettings,
    darkMode
  };
});

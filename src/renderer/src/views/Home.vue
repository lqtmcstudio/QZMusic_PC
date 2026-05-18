<template>
  <div class="view-container home-view">
    <div class="content-wrapper">
      <!-- 每日推荐横幅 -->
      <div class="daily-recommend">
        <div class="banner-content" @click="openDailyRecommend">
          <div class="date-badge">
            <div class="day">{{ currentDate.day }}</div>
            <div class="month">{{ currentDate.month }}月</div>
          </div>
          <div class="banner-info">
            <h2 class="banner-title">每日推荐</h2>
            <p class="banner-desc">根据你的音乐口味，为你精选30首歌曲</p>
            <button class="play-btn" @click.stop="playDailyRecommend">
              <Icon icon="lucide:play" class="play-icon" />
              立即播放
            </button>
          </div>
        </div>
      </div>

      <!-- 推荐歌单 -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">推荐歌单</h3>
          <button class="more-btn">更多</button>
        </div>
        <div class="playlist-grid">
          <div 
            class="playlist-card" 
            v-for="playlist in playlists" 
            :key="playlist.id"
            @click="openPlaylist(playlist)"
          >
            <div class="playlist-cover" :style="{ background: playlist.gradient }">
              <div class="play-overlay">
                <Icon icon="lucide:play" class="overlay-icon" />
              </div>
            </div>
            <div class="playlist-info">
              <h4 class="playlist-name">{{ playlist.name }}</h4>
              <p class="playlist-desc">{{ playlist.songCount }}首歌曲</p>
            </div>
          </div>
        </div>
      </div>

      <!-- 热门歌手 -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">热门歌手</h3>
          <button class="more-btn">更多</button>
        </div>
        <div class="artist-grid">
          <div 
            class="artist-card" 
            v-for="artist in artists" 
            :key="artist.id"
            @click="openArtist(artist)"
          >
            <div class="artist-avatar" :style="{ background: artist.gradient }">
            </div>
            <p class="artist-name">{{ artist.name }}</p>
          </div>
        </div>
      </div>

      <!-- 新歌速递 -->
      <div class="section">
        <div class="section-header">
          <h3 class="section-title">新歌速递</h3>
          <button class="more-btn" @click="playAllNewSongs">播放全部</button>
        </div>
        <div class="song-list">
          <div 
            class="song-item" 
            v-for="(song, index) in newSongs" 
            :key="song.id"
            @click="playSong(song)"
          >
            <div class="song-index">{{ index + 1 }}</div>
            <div class="song-cover" :style="{ background: song.gradient }">
            </div>
            <div class="song-info">
              <h4 class="song-title">{{ song.title }}</h4>
              <p class="song-artist">{{ song.artist }}</p>
            </div>
            <div class="song-duration">{{ song.duration }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';

const router = useRouter();

const currentDate = computed(() => {
  const now = new Date();
  return {
    day: now.getDate(),
    month: now.getMonth() + 1
  };
});

// 模拟数据
const playlists = ref([
  { id: 1, name: '华语流行精选', songCount: 50, gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 2, name: '欧美金曲榜', songCount: 45, gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 3, name: '轻音乐助眠', songCount: 30, gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 4, name: '怀旧经典老歌', songCount: 60, gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 5, name: '电子舞曲', songCount: 40, gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 6, name: '民谣小调', songCount: 35, gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' }
]);

const artists = ref([
  { id: 1, name: '周杰伦', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 2, name: '林俊杰', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 3, name: '邓紫棋', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 4, name: '陈奕迅', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 5, name: 'Taylor Swift', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 6, name: 'Ed Sheeran', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 7, name: '薛之谦', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: 8, name: '李荣浩', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }
]);

const newSongs = ref([
  { id: 1, title: '稻香', artist: '周杰伦', duration: '03:45', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 2, title: '晴天', artist: '周杰伦', duration: '04:29', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 3, title: '夜曲', artist: '周杰伦', duration: '03:58', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 4, title: '江南', artist: '林俊杰', duration: '04:06', gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 5, title: '光年之外', artist: '邓紫棋', duration: '03:55', gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
  { id: 6, title: '十年', artist: '陈奕迅', duration: '03:25', gradient: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 7, title: '演员', artist: '薛之谦', duration: '04:16', gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: 8, title: '李白', artist: '李荣浩', duration: '03:43', gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 9, title: '七里香', artist: '周杰伦', duration: '04:58', gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 10, title: '可惜没如果', artist: '林俊杰', duration: '04:52', gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }
]);

// 交互函数
const openDailyRecommend = () => {
  router.push('/playlist');
};

const playDailyRecommend = () => {
  console.log('播放每日推荐');
};

const openPlaylist = (playlist: any) => {
  console.log('打开歌单:', playlist);
  router.push('/playlist');
};

const openArtist = (artist: any) => {
  console.log('打开歌手:', artist);
};

const playSong = (song: any) => {
  console.log('播放歌曲:', song);
};

const playAllNewSongs = () => {
  console.log('播放全部新歌');
};
</script>

<style scoped>
.home-view {
  width: 100%;
  height: 100%;
}

.content-wrapper {
  box-sizing: border-box;
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

/* 每日推荐横幅 */
.daily-recommend {
  margin-bottom: 40px;
}

.banner-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: var(--radius-2xl);
  -electron-corner-smoothing: 65%;
  padding: 40px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: 32px;
  box-shadow: var(--shadow-lg);
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.banner-content::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 400px;
  height: 400px;
  background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
  border-radius: 50%;
}

.date-badge {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(10px);
  border-radius: var(--radius-xl);
  padding: 16px 20px;
  text-align: center;
  min-width: 100px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.day {
  font-size: 48px;
  font-weight: 700;
  color: white;
  line-height: 1;
}

.month {
  font-size: var(--font-size-lg);
  color: rgba(255, 255, 255, 0.8);
  margin-top: 4px;
}

.banner-info {
  flex: 1;
}

.banner-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: white;
  margin-bottom: 12px;
}

.banner-desc {
  color: rgba(255, 255, 255, 0.8);
  font-size: var(--font-size-base);
  margin-bottom: 24px;
}

.play-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: white;
  color: #667eea;
  padding: 12px 32px;
  border-radius: var(--radius-full);
  border: none;
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
}

.play-btn:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.play-icon {
  width: 18px;
  height: 18px;
}

/* 区域样式 */
.section {
  margin-bottom: 48px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.more-btn {
  background: transparent;
  border: 1px solid var(--color-border-light);
  color: var(--color-text-secondary);
  padding: 8px 20px;
  border-radius: var(--radius-full);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-base);
}

.more-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
  background-color: var(--color-accent-soft);
}

/* 歌单网格 */
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.playlist-card {
  cursor: pointer;
  transition: transform var(--transition-base);
}

.playlist-card:hover {
  transform: translateY(-4px);
}

.playlist-cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 12px;
  background: var(--color-bg-tertiary);
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity var(--transition-base);
}

.playlist-card:hover .play-overlay {
  opacity: 1;
}

.overlay-icon {
  width: 48px;
  height: 48px;
  color: white;
  transform: scale(0.8);
  transition: transform var(--transition-base);
}

.playlist-card:hover .overlay-icon {
  transform: scale(1);
}

.playlist-info {
  padding: 4px 0;
}

.playlist-name {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* 歌手网格 */
.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 24px;
}

.artist-card {
  text-align: center;
  cursor: pointer;
  transition: transform var(--transition-base);
}

.artist-card:hover {
  transform: translateY(-4px);
}

.artist-avatar {
  width: 120px;
  height: 120px;
  border-radius: var(--radius-full);
  overflow: hidden;
  margin: 0 auto 12px;
  background: var(--color-bg-tertiary);
}

.artist-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 歌曲列表 */
.song-list {
  background-color: var(--color-bg-secondary);
  border-radius: var(--radius-xl);
  padding: 8px;
}

.song-item {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-lg);
  transition: all var(--transition-base);
  cursor: pointer;
  gap: 16px;
}

.song-item:hover {
  background-color: var(--color-bg-tertiary);
}

.song-index {
  width: 24px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.song-cover {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
  background: var(--color-bg-tertiary);
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  font-size: var(--font-size-base);
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-duration {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>

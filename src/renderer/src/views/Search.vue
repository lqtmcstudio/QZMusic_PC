<template>
  <div class="view-container search-view">
    <div class="content-wrapper">
      <div class="search-header">
         <div class="header-left">
            <h1 class="search-title">搜索: "{{ query }}"</h1>
            <span class="result-count">找到 {{ total }} 个结果</span>
         </div>
         <button class="icon-btn" @click="showSettings = !showSettings" :class="{ active: showSettings }" title="搜索设置">
             <Icon icon="lucide:settings-2" />
         </button>
      </div>

      <transition name="slide-fade">
        <div class="settings-panel" v-if="showSettings">
            <div class="limit-setting">
                <span class="setting-label">每页显示: {{ limit }} 首</span>
                <div class="slider-container">
                    <input type="range" min="10" max="100" step="10" v-model.number="limit" class="setting-slider">
                    <div class="slider-track" :style="{ width: ((limit - 10) / 90) * 100 + '%' }"></div>
                </div>
            </div>

            <!-- Plugin Selector -->
            <div class="plugin-select-container">
                <button class="select-trigger" @click.stop="toggleDropdown" :title="'当前源: ' + activePluginName">
                    <span>{{ activePluginName }}</span>
                    <Icon icon="lucide:chevron-down" class="dropdown-icon" :class="{ open: isDropdownOpen }" />
                </button>
                
                <transition name="fade">
                    <div class="select-options" v-if="isDropdownOpen">
                        <div 
                            v-for="plugin in plugins" 
                            :key="plugin.id" 
                            class="option" 
                            :class="{ active: plugin.id === activePlugin }"
                            @click="selectPlugin(plugin)"
                        >
                            {{ plugin.name }}
                            <Icon icon="lucide:check" v-if="plugin.id === activePlugin" class="check-icon" />
                        </div>
                    </div>
                </transition>
            </div>
        </div>
      </transition>

      <div class="error-state" v-if="!loading && error">
          <div class="icon-box">
            <Icon icon="lucide:alert-circle" class="state-icon" />
          </div>
          <p class="state-text">搜索出错了，请稍后重试</p>
          <button class="retry-btn" @click="fetchData">
            <Icon icon="lucide:refresh-cw" class="btn-icon" />
            重试
          </button>
      </div>

      <div class="song-list-container" v-else-if="!loading && songs.length > 0">
        <div class="list-header">
           <div class="col-index">#</div>
           <div class="col-title">标题</div>
           <div class="col-album">专辑</div>
           <div class="col-time">时长</div>
        </div>
        
        <div class="song-list">
          <SongTile
            v-for="(song, i) in songs"
            :key="`${song.source}:${song.id}:${i}`"
            :song="song"
            :display-index="(currentPage - 1) * limit + i + 1"
            :highlight="highlight"
            @play="handlePlaySong(i)"
          />
        </div>

        <!-- Pagination -->
        <div class="pagination">
             <button class="pagination-btn" :disabled="currentPage <= 1" @click="changePage(currentPage - 1)">
                 <Icon icon="lucide:chevron-left" />
             </button>
             
             <button 
                v-for="page in visiblePages" 
                :key="page"
                class="pagination-btn"
                :class="{ active: page === currentPage }"
                @click="changePage(page)"
             >
                {{ page }}
             </button>

             <button class="pagination-btn" :disabled="currentPage >= totalPages" @click="changePage(currentPage + 1)">
                 <Icon icon="lucide:chevron-right" />
             </button>
        </div>
      </div>

      <div class="loading-state" v-if="loading">
          <Icon icon="lucide:loader-2" class="spin" />
          <span>正在搜索...</span>
      </div>

      <div class="empty-state" v-if="!loading && !error && songs.length === 0">
          <span>未找到相关歌曲</span>
          <button class="retry-btn" @click="fetchData">
            <Icon icon="lucide:refresh-cw" class="btn-icon" />
            重试
          </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import { usePlayerStore } from '../stores/player';
import { toSong } from '../utils/songUtils';
import SongTile from '../components/SongTile.vue';
import type { Song } from '../types/song';

const route = useRoute();
const playerStore = usePlayerStore();

// --- State ---
const query = computed(() => route.query.q as string || '');
const currentPage = ref(1);
const showSettings = ref(false);
const savedLimit = localStorage.getItem('qz-search-limit');
const limit = ref(savedLimit ? Number(savedLimit) : 30);

const total = ref(0);
const loading = ref(false);
const error = ref(false);
const songs = ref<Song[]>([]);

// Plugin Selector State
const plugins = ref<any[]>([]);
const activePlugin = ref<string>(''); // Plugin ID
const isDropdownOpen = ref(false);
let removePluginChangeListener: (() => void) | undefined;

const activePluginName = computed(() => {
    const p = plugins.value.find(p => p.id === activePlugin.value);
    return p ? p.name : '选择源';
});

const toggleDropdown = () => {
    isDropdownOpen.value = !isDropdownOpen.value;
};

const selectPlugin = (plugin: any) => {
    if (activePlugin.value !== plugin.id) {
        activePlugin.value = plugin.id;
        sessionStorage.setItem('qz-active-plugin', plugin.id);
        isDropdownOpen.value = false;
    } else {
        isDropdownOpen.value = false;
    }
};

// Close dropdown on click outside
const closeDropdown = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.plugin-select-container')) {
        isDropdownOpen.value = false;
    }
};

// --- Computed ---
const totalPages = computed(() => {
    const t = Number(total.value) || 0;
    const l = Number(limit.value) || 30;
    return Math.ceil(t / l) || 1;
});

const visiblePages = computed(() => {
  const current = currentPage.value;
  const total = totalPages.value; 
  const delta = 2;
  
  let start = Math.max(1, current - delta);
  let end = Math.min(total, current + delta);
  
  if (current - delta < 1) {
    end = Math.min(total, end + (1 - (current - delta)));
  }
  if (current + delta > total) {
    start = Math.max(1, start - ((current + delta) - total));
  }
  
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  return pages;
});

// --- Methods ---
const loadPlugins = async () => {
    try {
        if (window.electronAPI?.plugin?.getAll) {
            const all = await window.electronAPI.plugin.getAll();
            // Filter valid plugins basically (have id and name)
            plugins.value = all.filter((p: any) => p.id && p.name);
            
            // Restore selection or default
            const saved = sessionStorage.getItem('qz-active-plugin');
            if (saved && plugins.value.find(p => p.id === saved)) {
                activePlugin.value = saved;
            } else if (plugins.value.length > 0) {
                // Default to 'wy' if present, else first
                const wy = plugins.value.find(p => p.id === 'wy');
                activePlugin.value = wy ? 'wy' : plugins.value[0].id;
            } else {
                activePlugin.value = '';
                songs.value = [];
                total.value = 0;
            }
        }
    } catch (e) {
        console.error("Failed to load plugins", e);
    }
};

const handlePluginsChanged = async () => {
    const previousPlugin = activePlugin.value;
    await loadPlugins();
    if (query.value && activePlugin.value && activePlugin.value === previousPlugin) {
        await fetchData();
    }
};

const fetchData = async () => {
    if (!query.value || !activePlugin.value) return;
    
    loading.value = true;
    error.value = false;
    songs.value = [];
    
    try {
        const result = await window.electronAPI.plugin.search(activePlugin.value, query.value, currentPage.value, limit.value);
        
        if (result && result.list) {
            songs.value = result.list.map((item: any) => toSong(item));
            total.value = result.songCount || result.total || 0;
        } else {
             total.value = 0;
        }
    } catch (e) {
        console.error("Search failed", e);
        error.value = true;
    } finally {
        loading.value = false;
    }
};

const changePage = (page: number) => {
    currentPage.value = page;
    fetchData();
};

const handlePlaySong = (index: number) => {
    playerStore.playFromList(songs.value[index], songs.value);
};

const getHighlightRegex = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return null;
    const escapeRegExp = (string: string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (trimmed.length <= 2) {
        return new RegExp(escapeRegExp(trimmed), 'gi');
    }
    const substrings = new Set<string>();
    substrings.add(trimmed);
    for (let i = 0; i < trimmed.length; i++) {
        for (let j = i + 2; j <= trimmed.length; j++) {
            substrings.add(trimmed.slice(i, j));
        }
    }
    const sorted = Array.from(substrings).sort((a, b) => b.length - a.length);
    const pattern = sorted.map(s => escapeRegExp(s)).join('|');
    return new RegExp(pattern, 'gi');
};

const highlight = (text: string) => {
    if (!query.value || !text) return text;
    const regex = getHighlightRegex(query.value);
    if (!regex) return text;
    return text.replace(regex, match => `<span class="highlight">${match}</span>`);
};

// --- Watchers & Lifecycle ---
watch(query, () => {
    currentPage.value = 1;
    // ensure plugins loaded before fetching? usually mounted happens first
    if (activePlugin.value) fetchData();
}, { immediate: false }); // Wait for mount init

watch(limit, (newLimit) => {
    localStorage.setItem('qz-search-limit', newLimit.toString());
    currentPage.value = 1;
    fetchData();
});

watch(activePlugin, (newVal, oldVal) => {
    if (newVal && newVal !== oldVal && query.value) {
        currentPage.value = 1;
        fetchData();
    }
});

onMounted(async () => {
    document.addEventListener('click', closeDropdown);
    removePluginChangeListener = window.electronAPI?.plugin?.onChanged?.(handlePluginsChanged);
    await loadPlugins();
    // After plugins loaded, if we have a query, fetch data
    if (query.value && activePlugin.value) {
        fetchData();
    }
});

onBeforeUnmount(() => {
    document.removeEventListener('click', closeDropdown);
    removePluginChangeListener?.();
});
</script>


<style scoped>
.view-container {
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.content-wrapper {
  box-sizing: border-box;
  /* 底部留白由 MainLayout .page-content 统一处理(播放栏 128px)，这里不再叠加 */
  padding: 20px 30px;
  width: 100%;
}

.search-header {
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.header-left {
    text-align: left;
}

.search-title {
    font-size: 24px;
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: 8px;
    position: relative;
    padding-left: 16px; 
}

.search-title::before {
    content: "";
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 4px;
    height: 70%; 
    background: var(--color-accent-gradient);
    border-radius: 4px;
}

.result-count {
    font-size: 13px;
    color: var(--color-text-muted);
}

.icon-btn {
    background: transparent;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    width: 36px;
    height: 36px;
    transition: all 0.2s;
}

.icon-btn:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}

.icon-btn.active {
    background: var(--color-bg-tertiary);
    color: var(--color-accent);
}

/* Settings Panel */
.settings-panel {
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    padding: 16px 20px;
    margin-bottom: 20px;
    border: 1px solid var(--color-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: relative; /* Context */
}

.limit-setting {
    display: flex;
    align-items: center;
    gap: 16px;
}

/* Plugin Selector */
.plugin-select-container {
    position: relative;
    /* ensure it stays on top when options open? No, options use absolute */
    z-index: 10;
}

.select-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--color-bg-primary);
    box-shadow: 0 0 4px rgba(0, 0, 0, 0.1);
    border-radius: var(--radius-md);
    color: var(--color-text-primary);
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;
    min-width: 120px;
    justify-content: space-between;
}

.select-trigger:hover {
    background: var(--color-bg-secondary);
    border-color: var(--color-text-muted);
}

.dropdown-icon {
    font-size: 16px;
    transition: transform 0.2s;
}

.dropdown-icon.open {
    transform: rotate(180deg);
}

.select-options {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    width: 160px;
    background: var(--color-bg-primary);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.option {
    padding: 8px 12px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 14px;
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: all 0.2s;
}

.option:hover {
    background: var(--color-bg-tertiary);
    color: var(--color-text-primary);
}

.option.active {
    background: var(--color-accent-soft);
    color: var(--color-accent);
    font-weight: 500;
}

.check-icon {
    font-size: 14px;
}

/* Fade util */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}



.setting-label {
    font-size: 14px;
    color: var(--color-text-secondary);
    min-width: 100px;
}

.slider-container {
    position: relative;
    width: 200px;
    height: 4px;
    background: var(--color-bg-tertiary);
    border-radius: 2px;
    display: flex;
    align-items: center;
}

.setting-slider {
    appearance: none;
    position: absolute;
    width: 100%;
    height: 100%;
    background: transparent;
    top: 0;
    left: 0;
    margin: 0;
    z-index: 2;
    cursor: pointer;
}

.setting-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-accent-gradient);
    cursor: pointer;
    box-shadow: 0 0 4px rgba(0,0,0,0.2);
}

.slider-track {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: var(--color-accent-gradient);
    border-radius: 2px;
    pointer-events: none;
    z-index: 1;
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: all 0.3s ease;
  max-height: 100px;
  overflow: hidden;
  opacity: 1;
}

.slide-fade-enter-from,
.slide-fade-leave-to {
  max-height: 0;
  opacity: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-width: 0;
}

/* List Grid Layout */
.list-header, .song-item {
  display: grid;
  /* Define columns: Index | Title (40%) | Album (30%) | Time */
  grid-template-columns: 50px 4fr 3fr 60px;
  gap: 16px;
  align-items: center;
  padding: 10px 16px;
  text-align: left;
}

.list-header {
  margin-bottom: 8px;
  color: var(--color-text-muted);
  font-size: 13px;
  /* Header doesn't need hover background usually, but padding ensures alignment */
}

/* Override existing mixins/styles if necessary */
.col-index, .col-title, .col-album, .col-time { 
    width: auto; /* Let grid handle width */
} 
.col-index { text-align: center; }
.col-time { text-align: right; }

.song-item {
  box-sizing: border-box;
  border-radius: var(--radius-lg);
  transition: background-color 0.2s;
  cursor: pointer;
  color: var(--color-text-secondary);
  width: 100%; /* Fill width */
}

.song-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.song-index {
  text-align: center;
  font-size: 14px;
  color: var(--color-text-muted);
}

.song-cover {
  /* Cover is not in the top grid definition, wait. 
     The previous request structure had a cover inside.
     The Grid should account for cover?
     Previous structure: Index | Cover | Info (Title+Artist) | Album | Time 
     Let's adjust Grid columns to: Index | Cover+Info | Album | Time?
     Or Index | Info (with Cover flow) | Album | Time.
     Let's stick to the structure:
     .song-item > .song-index
     .song-item > .song-cover (This was separate div in previous template)
     .song-item > .song-info
     .song-item > .song-album
     .song-item > .song-duration
     
     So we have 5 direct children in .song-item?
     Checking template:
     1. .song-index
     2. .song-cover
     3. .song-info
     4. .song-album
     5. .song-duration
     
     Yes, 5 columns.
     Updated Grid: Index(50px) Cover(40px) Info(4fr) Album(3fr) Time(60px)
  */
  display: flex; /* Reset for grid child if needed */
}

/* Refined Grid for 5 columns */
.list-header, .song-item {
    grid-template-columns: 50px 40px 4fr 3fr 60px;
}

/* Header has 4 children (Index, Title, Album, Time). 
   We need to make Title span 2 columns (Cover + Info area) or Insert a spacer?
   Title header usually aligns with Title text.
   Let's make Header Grid: 50px (Spacer 40px) Title ... 
   Actually, usually Cover doesn't have a header. 
   Let's align "Title" header to start of Info.
   
   List Header children:
   div.col-index
   div.col-title
   div.col-album
   div.col-time
   
   We need to adjust .col-title to span the Cover+Info space? Or just Info space?
   If we want "Title" label to align with Song Title text, we should skip the Cover column.
*/

.list-header {
    /* 50px | 40px spacer | 4fr | 3fr | 60px */
    grid-template-columns: 50px 40px 4fr 3fr 60px;
}
/* We need a phantom element or nth-child hacking for header? 
   Easiest is to add a spacer div in template or just use grid-column on col-title?
   If we say .col-title { grid-column: 3 / 4; } ?
*/
.list-header .col-title {
    grid-column: 3;
}
.list-header .col-album {
    grid-column: 4;
}
.list-header .col-time {
    grid-column: 5;
}


.song-cover {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: #333;
}

.song-cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.song-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding-left: 10px; /* Small gap between cover and text */
}

.song-title {
  font-size: 15px;
  color: var(--color-text-primary);
  margin-bottom: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-artist {
  font-size: 12px;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.song-album {
    font-size: 13px;
    color: var(--color-text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.song-duration {
    text-align: right;
    font-size: 13px;
}

/* Highlight */
:deep(.highlight) {
    color: var(--color-accent);
}

/* Pagination */
.pagination {
    display: flex;
    justify-content: flex-start; /* Alignment Change: Left Align */
    align-items: center;
    margin-top: 32px;
    gap: 8px; /* Closer gap */
}

.pagination-btn {
    min-width: 32px;
    height: 32px;
    padding: 0 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    border: 1px solid var(--color-border);
    color: var(--color-text-primary);
    background: transparent;
    transition: all 0.2s;
    font-size: 14px;
    cursor: pointer;
}

.pagination-btn:hover:not(:disabled) {
    background: var(--color-bg-tertiary);
    border-color: var(--color-text-muted);
}

.pagination-btn.active {
    background: var(--color-accent-gradient);
    color: #fff; /* Ensure readable text on accent */
    border-color: var(--color-accent);
    font-weight: bold;
}

.pagination-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
    border-color: transparent;
}

/* States */
.loading-state, .empty-state, .error-state {
    padding: 60px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    color: var(--color-text-muted);
    min-height: 300px;
}

.spin {
    animation: spin 1s linear infinite;
    font-size: 32px;
    color: var(--color-accent);
}

.error-state .icon-box {
    width: 64px;
    height: 64px;
    background: var(--color-bg-tertiary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
}

.state-icon {
    font-size: 32px;
    color: var(--color-accent);
}

.state-text {
    font-size: 15px;
    color: var(--color-text-secondary);
}

.retry-btn {
    margin-top: 8px;
    padding: 8px 24px;
    background: var(--color-accent-gradient);
    color: white; /* Ensure text is readable on accent color */
    border-radius: var(--radius-full);
    font-size: 14px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 8px;
    transition: all 0.2s;
    box-shadow: var(--shadow-sm);
}

.retry-btn:hover {
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
    filter: brightness(1.1);
}

.retry-btn:active {
    transform: translateY(0);
}

.retry-btn .btn-icon {
    font-size: 16px;
}

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>

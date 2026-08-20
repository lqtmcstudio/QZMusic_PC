<template>
  <Transition name="fade">
    <div class="settings-overlay" v-if="isLoaded" :class="{ 'player-open': playerStore.isPlayerFullScreen }">
      <div class="settings-container">
        <!-- Header -->
        <div class="settings-header">
          <h1 class="settings-title">设置</h1>
          <button class="close-btn" @click="$emit('close')">
            <Icon icon="lucide:x" class="close-icon" />
          </button>
        </div>

        <div class="settings-body">
          <!-- Left Sidebar -->
          <nav class="settings-nav">
            <div
              v-for="category in categories"
              :key="category.id"
              class="nav-item"
              :class="{ active: activeCategory === category.id }"
              @click="activeCategory = category.id"
            >
              <Icon :icon="category.icon" class="nav-icon" />
              <span>{{ category.name }}</span>
            </div>
          </nav>

          <!-- Right Content -->
          <div class="settings-content">
            <!-- 存储设置 -->
            <div v-if="activeCategory === 'storage'" class="section">
              <h2 class="section-title">存储设置</h2>

              <!-- 缓存开关 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">缓存音乐到本地</div>
                  <div class="setting-desc">开启后将在本地保存播放过的音乐，加快加载速度</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch" :class="{ 'no-transition': !enableTransition }">
                    <input type="checkbox" v-model="settings.persistCache" @change="onCacheToggle" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- 缓存位置 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">缓存位置</div>
                  <div class="setting-desc path-text">{{ cacheInfo.path || '加载中...' }}</div>
                </div>
                <div class="setting-control">
                  <button class="action-btn" @click="openCacheFolder">
                    <Icon icon="lucide:folder-open" />
                    打开目录
                  </button>
                  <button class="action-btn" @click="changeCacheLocation" :disabled="isChangingCache">
                    <Icon v-if="isChangingCache" icon="lucide:loader-2" class="spin" />
                    <Icon v-else icon="lucide:folder-edit" />
                    {{ isChangingCache ? '迁移中...' : '更改' }}
                  </button>
                </div>
              </div>

              <!-- 缓存大小 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">已占用空间</div>
                  <div class="setting-desc">{{ cacheInfo.size || '计算中...' }}</div>
                </div>
                <div class="setting-control">
                  <button class="action-btn danger" @click="clearCache">
                    <Icon icon="lucide:trash-2" />
                    清理缓存
                  </button>
                </div>
              </div>
            </div>

            <!-- 插件管理 -->
            <div v-else-if="activeCategory === 'privacy'" class="section">
              <h2 class="section-title">隐私设置</h2>
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">允许他人查看我的喜欢和歌单</div>
                  <div class="setting-desc">关闭后，公开歌单和喜欢的歌曲都只对自己可见</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch" :class="{ 'no-transition': !enableTransition }">
                    <input type="checkbox" v-model="allowPublicLibrary" :disabled="privacyLoading" @change="onPrivacyChange('library')" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">允许他人查看我的个人信息</div>
                  <div class="setting-desc">关闭后，地区、性别和生日只对自己可见</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch" :class="{ 'no-transition': !enableTransition }">
                    <input type="checkbox" v-model="allowPublicProfile" :disabled="privacyLoading" @change="onPrivacyChange('profile')" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">允许他人查看我的关注列表</div>
                  <div class="setting-desc">关闭后，别人只能看到你的关注数量，不能打开列表</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch" :class="{ 'no-transition': !enableTransition }">
                    <input type="checkbox" v-model="allowPublicFollowing" :disabled="privacyLoading" @change="onPrivacyChange('following')" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
            </div>

            <div v-else-if="activeCategory === 'plugins'" class="section">
              <div class="section-header">
                <div>
                    <h2 class="section-title" style="border:none;margin:0;padding:0">插件管理</h2>
                    <div class="setting-desc">管理已安装的音乐源插件</div>
                </div>
                <button class="action-btn primary" @click="installPluginFromFile">
                    <Icon icon="lucide:plus" />
                    安装插件
                </button>
              </div>

              <div class="plugin-grid">
                 <div v-if="plugins.length === 0" class="empty-state">
                    <Icon icon="lucide:package-open" class="empty-icon"/>
                    <p>暂无已安装的插件</p>
                    <button class="text-btn" @click="installPluginFromFile">点击安装</button>
                 </div>
                 <div v-for="plugin in plugins" :key="plugin.id" class="plugin-card">
                    <div class="plugin-info">
                        <div class="plugin-header">
                            <span class="plugin-name">{{ plugin.name || plugin.id }}</span>
                            <span class="plugin-version" v-if="plugin.version">v{{ plugin.version }}</span>
                        </div>
                        <p class="plugin-desc">{{ plugin.description || '暂无描述' }}</p>
                        <div class="plugin-tags" v-if="plugin.quality?.length">
                            <span v-for="q in plugin.quality" :key="q.id" class="tag" :title="q.name">{{ q.ui }}</span>
                        </div>
                    </div>
                    <div class="plugin-actions">
                        <button class="action-btn danger small" @click="confirmUninstall(plugin)">
                            <Icon icon="lucide:trash-2" />
                            卸载
                        </button>
                    </div>
                 </div>
              </div>
            </div>

            <!-- Uninstall Confirm Modal -->


            <!-- 外观设置 -->
            <div v-else-if="activeCategory === 'appearance'" class="section">
              <h2 class="section-title">外观设置</h2>

              <!-- 亮暗模式 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">主题模式</div>
                  <div class="setting-desc">选择深色或浅色主题</div>
                </div>
                <div class="setting-control">
                  <div class="theme-toggle">
                    <button 
                      class="theme-btn" 
                      :class="{ active: appearance.theme === 'dark' }"
                      @click="setTheme('dark')"
                    >
                      <Icon icon="lucide:moon" />
                      深色
                    </button>
                    <button 
                      class="theme-btn" 
                      :class="{ active: appearance.theme === 'light' }"
                      @click="setTheme('light')"
                    >
                      <Icon icon="lucide:sun" />
                      浅色
                    </button>
                  </div>
                </div>
              </div>

              <!-- 主题色 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">主题色</div>
                  <div class="setting-desc">选择你喜欢的强调色</div>
                </div>
                <div class="setting-control">
                  <div class="color-swatches">
                    <button
                      v-for="color in accentColors"
                      :key="color.value"
                      class="color-swatch"
                      :class="{ active: appearance.accentColor === color.value }"
                      :style="{ '--swatch-color': color.value, '--swatch-bg': color.gradient || color.value }"
                      :title="color.name"
                      @click="setAccentColor(color.value)"
                    >
                      <Icon v-if="appearance.accentColor === color.value" icon="lucide:check" class="check-icon" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 播放设置 -->
            <div v-else-if="activeCategory === 'playback'" class="section">
              <h2 class="section-title">播放设置</h2>
              
              <!-- 列表添加模式 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">列表添加模式</div>
                  <div class="setting-desc">选择点击歌曲时的播放行为</div>
                </div>
                <div class="setting-control">
                  <div class="radio-group">
                    <label class="radio-option">
                      <input type="radio" value="replace" v-model="playerStore.addListMode">
                      <span class="radio-label">替换当前列表</span>
                    </label>
                    <label class="radio-option">
                      <input type="radio" value="append" v-model="playerStore.addListMode">
                      <span class="radio-label">添加到列表末尾</span>
                    </label>
                  </div>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">歌单加载方式</div>
                  <div class="setting-desc">选择歌单和专辑页面的歌曲加载方式</div>
                </div>
                <div class="setting-control">
                  <div class="segmented-control">
                    <button
                      class="segment-btn"
                      :class="{ active: playlistPagingMode === 'infinite' }"
                      @click="setPlaylistPagingMode('infinite')"
                    >
                      下滑加载
                    </button>
                    <button
                      class="segment-btn"
                      :class="{ active: playlistPagingMode === 'pagination' }"
                      @click="setPlaylistPagingMode('pagination')"
                    >
                      页码分页
                    </button>
                  </div>
                </div>
              </div>

              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">点击歌曲后打开播放页</div>
                  <div class="setting-desc">从搜索、歌单、推荐里点击歌曲播放时，自动进入全屏播放页</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="openPlayerOnSongClick" @change="onOpenPlayerPreferenceChange" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- 低音增强 -->
              <div class="setting-item bass-boost-item">
                <div class="setting-info">
                  <div class="setting-label bass-label">
                    <span class="label-text">低音增强</span>
                    <span class="help-tip" aria-label="低音增强说明">
                      <Icon icon="lucide:help-circle" class="help-icon" />
                      <span class="help-tooltip" v-html="bassTooltip"></span>
                    </span>
                  </div>
                  <div class="setting-desc">让声音的低频部分更厚重、更有力，听感更震撼 (实验功能)</div>
                </div>
                <div class="setting-control bass-boost-control">
                  <div class="bass-mode-row">
                    <label class="mini-toggle">
                      <input type="checkbox" v-model="bass.enabled" @change="onBassChange" />
                      <span>{{ bass.enabled ? '已启用' : '已关闭' }}</span>
                    </label>
                    <label class="mini-toggle">
                      <input type="checkbox" v-model="bass.advanced" :disabled="!bass.enabled" @change="onBassChange" />
                      <span>高级模式</span>
                    </label>
                  </div>

                  <div class="bass-body" :class="{ 'bass-disabled': !bass.enabled }">
                  <!-- 普通模式: 预设 -->
                  <template v-if="!bass.advanced">
                    <div class="segmented-control bass-mode">
                      <button
                        class="segment-btn"
                        :class="{ active: bass.mode === 'speaker' }"
                        @click="setBassMode('speaker')"
                      >
                        <Icon icon="lucide:laptop" />
                        笔记本/扬声器
                      </button>
                      <button
                        class="segment-btn"
                        :class="{ active: bass.mode === 'headphone' }"
                        @click="setBassMode('headphone')"
                      >
                        <Icon icon="lucide:headphones" />
                        耳机/音响
                      </button>
                    </div>
                  </template>

                  <!-- 高级模式: 各参数滑块 -->
                  <template v-else>
                    <div class="bass-slider-row">
                      <span class="slider-cap">分频点</span>
                      <input type="range" min="40" max="250" step="1" class="bass-slider" v-model.number="bass.crossover" @input="onBassChange" />
                      <span class="bass-value">{{ bass.crossover }} Hz</span>
                    </div>
                    <div class="bass-slider-row">
                      <span class="slider-cap">增益</span>
                      <input type="range" min="0" max="12" step="0.1" class="bass-slider" v-model.number="bass.gain" @input="onBassChange" />
                      <span class="bass-value">+{{ bass.gain.toFixed(1) }} dB</span>
                    </div>
                    <div class="bass-slider-row">
                      <span class="slider-cap">激励</span>
                      <label class="mini-toggle">
                        <input type="checkbox" v-model="bass.exciter" @change="onBassChange" />
                        <span>{{ bass.exciter ? '开' : '关' }}</span>
                      </label>
                      <input v-if="bass.exciter" type="range" min="0" max="18" step="0.5" class="bass-slider" v-model.number="bass.drive" @input="onBassChange" />
                      <span v-if="bass.exciter" class="bass-value">+{{ bass.drive.toFixed(1) }} dB</span>
                    </div>
                    <div class="bass-slider-row">
                      <span class="slider-cap">湿声</span>
                      <input type="range" min="0" max="100" step="1" class="bass-slider" v-model.number="bass.mix" @input="onBassChange" />
                      <span class="bass-value">{{ bass.mix }}%</span>
                    </div>
                    <div class="bass-slider-row">
                      <span class="slider-cap">释放</span>
                      <input type="range" min="50" max="500" step="10" class="bass-slider" v-model.number="bass.release" @input="onBassChange" />
                      <span class="bass-value">{{ bass.release }} ms</span>
                    </div>
                  </template>
                  </div><!-- /.bass-body -->
                </div>
              </div>

              <!-- 音频输出设备 -->
              <div class="setting-item audio-device-item">
                <div class="setting-info">
                  <div class="setting-label">音频输出设备</div>
                  <div class="setting-desc">选择音频输出设备，支持 USB DAC 独占模式</div>
                </div>
                <div class="setting-control audio-device-control">
                  <select class="device-select" v-model="audioDevice.selectedId" @change="onDeviceChange">
                    <option value="">系统默认设备</option>
                    <option v-for="dev in audioDevice.devices" :key="dev.id" :value="dev.id">
                      {{ dev.name }}{{ dev.is_default ? ' (默认)' : '' }}
                    </option>
                  </select>
                  <button class="action-btn small" @click="refreshDevices" :disabled="audioDevice.loading">
                    <Icon v-if="audioDevice.loading" icon="lucide:loader-2" class="spin" />
                    <Icon v-else icon="lucide:refresh-cw" />
                    刷新
                  </button>
                </div>
              </div>

              <!-- 独占模式 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">独占模式 (WASAPI Exclusive)</div>
                  <div class="setting-desc">绕过 Windows 混音器，直接输出到设备，实现 bit-perfect 播放。独占期间其他应用无法使用该设备发声</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="audioDevice.exclusive" @change="onDeviceChange" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- 自动匹配采样率 -->
              <div class="setting-item">
                <div class="setting-info">
                  <div class="setting-label">自动匹配采样率</div>
                  <div class="setting-desc">切歌时根据歌曲音质自动选择设备最佳 ALT Setting，不匹配时 FFmpeg 重采样。仅独占模式有效</div>
                </div>
                <div class="setting-control">
                  <label class="toggle-switch">
                    <input type="checkbox" v-model="audioDevice.autoMatch" :disabled="!audioDevice.exclusive" @change="onAutoMatchChange" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <!-- 播放链路信息 -->
              <div class="setting-item chain-info-item">
                <div class="setting-info" style="width: 100%">
                  <div class="setting-label">
                    播放链路
                    <button class="action-btn small inline-btn" @click="refreshChain">
                      <Icon icon="lucide:refresh-cw" />
                    </button>
                  </div>
                  <div class="chain-display">
                    <div class="chain-text" v-if="chainInfo.chain">
                      {{ chainInfo.chain }}
                    </div>
                    <div class="chain-text" v-else>暂无播放</div>
                    <div class="chain-details" v-if="chainInfo.device_rate">
                      <span class="chain-tag" :class="{ 'tag-ok': !chainInfo.resampling, 'tag-warn': chainInfo.resampling }">
                        {{ chainInfo.resampling ? '重采样' : 'Bit-perfect' }}
                      </span>
                      <span class="chain-tag">源: {{ chainInfo.source_rate || '?' }}Hz / {{ chainInfo.source_bits || '?' }}bit</span>
                      <span class="chain-tag">设备: {{ chainInfo.device_rate || '?' }}Hz / {{ chainInfo.device_bits || '?' }}bit</span>
                      <span class="chain-tag">{{ chainInfo.exclusive ? '独占' : '共享' }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 独占调试日志 -->
              <div class="setting-item log-item">
                <div class="setting-info" style="width: 100%">
                  <div class="setting-label">
                    音频调试日志
                    <button class="action-btn small inline-btn" @click="refreshLog">
                      <Icon icon="lucide:refresh-cw" />
                    </button>
                    <button class="action-btn small inline-btn danger" @click="clearLog">
                      <Icon icon="lucide:trash-2" />
                    </button>
                    <button class="action-btn small inline-btn" @click="copyLog">
                      <Icon icon="lucide:copy" />
                      复制
                    </button>
                    <label class="mini-toggle" style="margin-left: 12px;">
                      <input type="checkbox" v-model="logExpanded" />
                      <span>{{ logExpanded ? '收起' : '展开' }}</span>
                    </label>
                  </div>
                  <div class="log-panel" v-if="logExpanded">
                    <div class="log-content" ref="logPanelRef">
                      <div v-if="audioLogs.length === 0" class="log-empty">暂无日志</div>
                      <div v-for="(line, idx) in audioLogs" :key="idx" class="log-line">{{ line }}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div class="placeholder-content" style="padding: 30px 0;">
                <Icon icon="lucide:headphones" class="placeholder-icon" style="width: 40px; height: 40px; margin-bottom: 8px;" />
                <p>淡入淡出等设置即将推出</p>
              </div>
            </div>

            <!-- 快捷键 -->
            <div v-else-if="activeCategory === 'shortcuts'" class="section shortcuts-section">
              <h2 class="shortcut-title">快捷键</h2>
              <div class="shortcut-list">
                <div v-for="item in shortcutRows" :key="item.id" class="shortcut-row">
                  <div>
                    <div class="setting-label">{{ item.name }}</div>
                    <div class="setting-desc">{{ item.desc }}</div>
                  </div>
                  <button
                    v-if="item.editable"
                    class="shortcut-key"
                    :class="{ recording: recordingShortcut === item.id }"
                    type="button"
                    @click="startShortcutRecording(item.id)"
                    @keydown="recordShortcut($event, item.id)"
                    @blur="stopShortcutRecording"
                  >{{ recordingShortcut === item.id ? '请按快捷键' : shortcutBindings[item.id] }}</button>
                  <kbd v-else>{{ item.key }}</kbd>
                </div>
              </div>
            </div>

            <!-- 关于 -->
            <div v-else-if="activeCategory === 'about'" class="section">
              <h2 class="section-title">关于</h2>
              <div class="about-content">
                <div class="app-logo">🎶</div>
                <h3>QZ Music</h3>
                <p class="version">版本 1.0.0</p>
                <p class="copyright">©2026 QZ <DEVELOPERS></DEVELOPERS></p>
              </div>
            </div>

            <!-- Uninstall Confirm Modal -->
             <Transition name="fade">
                <div class="modal-overlay" v-if="showUninstallModal">
                    <div class="modal-content">
                        <h3>卸载插件</h3>
                        <p>确定要卸载插件 "{{ pluginToUninstall?.name }}" 吗？此操作无法撤销。</p>
                        <div class="modal-actions">
                            <button class="action-btn" @click="showUninstallModal = false">取消</button>
                            <button class="action-btn danger" @click="executeUninstall">确认卸载</button>
                        </div>
                    </div>
                </div>
             </Transition>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, reactive, onBeforeMount, nextTick, watch, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import { usePlayerStore } from '../stores/player';

const playerStore = usePlayerStore();

defineEmits(['close']);

const categories = [
  { id: 'storage', name: '存储', icon: 'lucide:hard-drive' },
  { id: 'privacy', name: '隐私', icon: 'lucide:shield' },
  { id: 'plugins', name: '插件', icon: 'lucide:blocks' },
  { id: 'appearance', name: '外观', icon: 'lucide:palette' },
  { id: 'playback', name: '播放', icon: 'lucide:headphones' },
  { id: 'shortcuts', name: '快捷键', icon: 'lucide:keyboard' },
  { id: 'about', name: '关于', icon: 'lucide:info' },
];

const accentColors = [
    {
      name: '默认蓝紫',
      value: '#8289d3',
      gradient: 'linear-gradient(135deg, #b0baeb 0%, #b1bfe9 24%, #b3c9df 48%, #c1c0d3 72%, #dfacb9 100%)',
  },
  { name: '红色', value: '#ec4141' },
  { name: '橙色', value: '#f97316' },
  { name: '金色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '青色', value: '#06b6d4' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#8b5cf6' },
  { name: '粉色', value: '#ec4899' },
];

const activeCategory = ref('storage');
const isLoaded = ref(false);
const enableTransition = ref(false);
const plugins = ref<any[]>([]);
const playlistPagingMode = ref<'infinite' | 'pagination'>('infinite');
const openPlayerOnSongClick = ref(false);
const bass = reactive({
  enabled: false,
  mode: 'speaker' as 'speaker' | 'headphone',
  advanced: false,
  crossover: 90,
  gain: 3.5,
  drive: 10,
  mix: 18,
  release: 250,
  exciter: true,
});

// Audio Output State
const audioDevice = reactive({
  devices: [] as Array<{ id: string; name: string; is_default: boolean; formats: Array<{ sample_rate: number; channels: number; bits: number }> }>,
  selectedId: '',
  exclusive: false,
  autoMatch: true,
  loading: false,
});
const chainInfo = reactive({
  chain: '',
  exclusive: false,
  device_rate: 0,
  device_bits: 0,
  device_channels: 0,
  source_rate: 0,
  source_bits: 0,
  source_channels: 0,
  resampling: false,
  device_name: '',
});
const audioLogs = ref<string[]>([]);
const logExpanded = ref(false);
const logPanelRef = ref<HTMLElement | null>(null);
const allowPublicLibrary = ref(false);
const allowPublicProfile = ref(false);
const allowPublicFollowing = ref(false);
const privacyLoading = ref(false);
const shortcutRows = [
  { id: 'togglePlay', name: '播放 / 暂停', desc: '在非输入状态下切换当前播放状态', editable: true },
  { id: 'previous', name: '上一首', desc: '切换到播放队列里的上一首歌曲', editable: true },
  { id: 'next', name: '下一首', desc: '切换到播放队列里的下一首歌曲', editable: true },
  { id: 'toggleMode', name: '切换播放模式', desc: '在列表循环 / 单曲循环 / 随机之间切换', editable: true },
  { id: 'fullscreen', key: 'F11', name: '切换全屏', desc: '进入或退出应用窗口全屏', editable: false },
] as const;

const shortcutBindings = reactive({
  togglePlay: 'Space',
  previous: 'A',
  next: 'D',
  toggleMode: 'W',
});
const recordingShortcut = ref<keyof typeof shortcutBindings | null>(null);

const formatShortcut = (event: KeyboardEvent) => {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(event.key)) return '';
  const modifiers = [
    event.ctrlKey ? 'Ctrl' : '',
    event.altKey ? 'Alt' : '',
    event.shiftKey ? 'Shift' : '',
    event.metaKey ? 'Meta' : '',
  ].filter(Boolean);
  const key = event.code === 'Space' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [...modifiers, key].join('+');
};

const startShortcutRecording = (id: keyof typeof shortcutBindings) => {
  recordingShortcut.value = id;
};

const stopShortcutRecording = () => {
  recordingShortcut.value = null;
};

const recordShortcut = async (event: KeyboardEvent, id: keyof typeof shortcutBindings) => {
  event.preventDefault();
  event.stopPropagation();
  const shortcut = formatShortcut(event);
  if (!shortcut) return;
  const conflict = Object.entries(shortcutBindings).find(([key, value]) => key !== id && value === shortcut);
  if (conflict) {
    ElMessage.warning('该快捷键已被其他操作使用');
    return;
  }
  shortcutBindings[id] = shortcut;
  stopShortcutRecording();
  try {
    await window.electronAPI.settings.set({ shortcuts: { ...shortcutBindings } });
    ElMessage.success('快捷键已更新');
  } catch (e) {
    ElMessage.error('快捷键保存失败');
  }
};

const settings = reactive({
  persistCache: true,
});

const appearance = reactive({
  theme: 'dark' as 'dark' | 'light',
  accentColor: '#8289d3',
});

const cacheInfo = reactive({
  path: '',
  size: '',
});

const loadPlugins = async () => {
    try {
        if (window.electronAPI?.plugin?.getAll) {
             plugins.value = await window.electronAPI.plugin.getAll();
        }
    } catch (e) {
         console.error('Failed to load plugins', e);
    }
};

const uninstallPlugin = async (id: string) => {
    try {
        if (window.electronAPI?.plugin?.uninstall) {
            await window.electronAPI.plugin.uninstall(id);
            await loadPlugins();
        }
    } catch (e) {
        console.error('Failed to uninstall plugin', e);
    }
}

const installPluginFromFile = async () => {
    try {
        if (window.electronAPI?.plugin?.install) {
            const result = await window.electronAPI.plugin.install();
            if (result.success) {
                ElMessage.success(result.message || '安装成功');
                await loadPlugins();
            } else {
                if (result.message !== 'canceled') { // Assuming 'canceled' might be a thing, or just show whatever message comes back
                     ElMessage.error(result.message || '安装失败');
                }
            }
        }
    } catch (e) {
        console.error('Failed to install plugin', e);
        ElMessage.error('安装过程中发生错误');
    }
}

// Modal Logic
const showUninstallModal = ref(false);
const pluginToUninstall = ref<any>(null);

const confirmUninstall = (plugin: any) => {
    pluginToUninstall.value = plugin;
    showUninstallModal.value = true;
};

const executeUninstall = async () => {
    if (pluginToUninstall.value) {
        await uninstallPlugin(pluginToUninstall.value.id);
        showUninstallModal.value = false;
        pluginToUninstall.value = null;
    }
};

watch(activeCategory, (newVal) => {
    if (newVal === 'plugins') {
        loadPlugins();
    }
    if (newVal === 'playback') {
        loadAudioDevices();
        refreshChain();
    }
});


const loadCacheInfo = async () => {
  if (window.electronAPI) {
    const info = await window.electronAPI.getCacheInfo();
    cacheInfo.path = info.path;
    cacheInfo.size = info.size;
    settings.persistCache = info.persistCache;
  }
};

const loadAppearance = async () => {
  if (window.electronAPI?.settings) {
    const allSettings = await window.electronAPI.settings.getAll();
    appearance.theme = allSettings.theme;
    appearance.accentColor = allSettings.accentColor === '#b3c9df' ? '#8289d3' : allSettings.accentColor;
    playlistPagingMode.value = allSettings.playlistPagingMode || 'infinite';
    openPlayerOnSongClick.value = Boolean(allSettings.openPlayerOnSongClick);
    Object.assign(shortcutBindings, allSettings.shortcuts || {});
    const b = allSettings.bass;
    if (b && typeof b === 'object') {
      bass.enabled = b.enabled === true;
      bass.mode = b.mode === 'headphone' ? 'headphone' : 'speaker';
      bass.advanced = Boolean(b.advanced);
      bass.crossover = Number(b.crossover) || 90;
      bass.gain = Number(b.gain) || 0;
      bass.drive = Number(b.drive) || 0;
      bass.mix = Number(b.mix) || 0;
      bass.release = Number(b.release) || 250;
      bass.exciter = b.exciter !== false;
    }
    // 加载音频输出配置
    const ao = allSettings.audioOutput;
    if (ao && typeof ao === 'object') {
      audioDevice.selectedId = ao.deviceId || '';
      audioDevice.exclusive = Boolean(ao.exclusive);
      audioDevice.autoMatch = ao.autoMatch !== false;
    }
    applyTheme(appearance.theme);
    applyAccentColor(appearance.accentColor);
  }
};

const loadPrivacy = async () => {
  if (!window.electronAPI?.privacy?.getLibrary) return;
  try {
    privacyLoading.value = true;
    const data = await window.electronAPI.privacy.getLibrary();
    allowPublicLibrary.value = Boolean(data?.allow_public_library);
    allowPublicProfile.value = Boolean(data?.allow_public_profile);
    allowPublicFollowing.value = Boolean(data?.allow_public_following);
  } catch (e) {
    console.warn('Failed to load privacy settings', e);
  } finally {
    privacyLoading.value = false;
  }
};

// --- Audio Output ---
const loadAudioDevices = async () => {
  if (!window.electronAPI?.audioOutput) return;
  audioDevice.loading = true;
  try {
    await window.electronAPI.audioOutput.getDevices();
  } catch (e) {
    console.warn('Failed to load audio devices', e);
  } finally {
    audioDevice.loading = false;
  }
};

const refreshDevices = async () => {
  await loadAudioDevices();
};

const onDeviceChange = async () => {
  if (!window.electronAPI?.audioOutput) return;
  const deviceId = audioDevice.selectedId || null;
  await window.electronAPI.audioOutput.setDevice(deviceId, audioDevice.exclusive);
  await window.electronAPI.settings.set({
    audioOutput: {
      deviceId,
      exclusive: audioDevice.exclusive,
      autoMatch: audioDevice.autoMatch,
      logEnabled: true,
    },
  });
  // 刷新链路信息
  setTimeout(refreshChain, 500);
};

const onAutoMatchChange = async () => {
  await window.electronAPI.settings.set({
    audioOutput: {
      deviceId: audioDevice.selectedId || null,
      exclusive: audioDevice.exclusive,
      autoMatch: audioDevice.autoMatch,
      logEnabled: true,
    },
  });
};

const refreshChain = async () => {
  if (!window.electronAPI?.audioOutput) return;
  await window.electronAPI.audioOutput.getChain();
};

const refreshLog = async () => {
  if (!window.electronAPI?.audioOutput) return;
  await window.electronAPI.audioOutput.getLog(100);
};

const clearLog = () => {
  audioLogs.value = [];
};

const copyLog = () => {
  const text = audioLogs.value.join('\n');
  if (text) {
    navigator.clipboard.writeText(text).then(() => {
      ElMessage.success('日志已复制到剪贴板');
    }).catch(() => {
      ElMessage.error('复制失败');
    });
  }
};

// 监听 qzplayer 事件 (音频设备/链路/日志)
if (window.electronAPI?.qzplayer?.onEvent) {
  window.electronAPI.qzplayer.onEvent((_event: any, data: any) => {
    // 设备列表响应
    if (data.event === 'audio-devices' && Array.isArray(data.devices)) {
      audioDevice.devices = data.devices;
      // 自动选择默认设备
      if (!audioDevice.selectedId) {
        const defaultDev = data.devices.find((d: any) => d.is_default);
        if (defaultDev) audioDevice.selectedId = defaultDev.id;
      }
    }
    // 链路信息响应
    if (data.event === 'playback-chain' || data.event === 'property-change' && data.name === 'audio-chain') {
      const d = data.data || data;
      chainInfo.chain = d.chain || '';
      chainInfo.exclusive = Boolean(d.exclusive);
      chainInfo.device_rate = d.device_rate || 0;
      chainInfo.device_bits = d.device_bits || 0;
      chainInfo.device_channels = d.device_channels || 0;
      chainInfo.source_rate = d.source_rate || 0;
      chainInfo.source_bits = d.source_bits || 0;
      chainInfo.source_channels = d.source_channels || 0;
      chainInfo.resampling = Boolean(d.resampling);
      chainInfo.device_name = d.device_name || '';
    }
    // 日志响应
    if (data.event === 'audio-log' && data.data) {
      audioLogs.value = data.data.split('\n').filter((l: string) => l.trim());
      // 自动滚动到底部
      nextTick(() => {
        if (logPanelRef.value) {
          logPanelRef.value.scrollTop = logPanelRef.value.scrollHeight;
        }
      });
    }
  });
}

const onPrivacyChange = async (target: 'library' | 'profile' | 'following') => {
  if (!window.electronAPI?.privacy?.setLibrary) return;
  try {
    privacyLoading.value = true;
    const payload = target === 'library'
      ? { allow_public_library: allowPublicLibrary.value }
      : target === 'profile'
        ? { allow_public_profile: allowPublicProfile.value }
        : { allow_public_following: allowPublicFollowing.value };
    const data = await window.electronAPI.privacy.setLibrary(payload);
    allowPublicLibrary.value = Boolean(data?.allow_public_library);
    allowPublicProfile.value = Boolean(data?.allow_public_profile);
    allowPublicFollowing.value = Boolean(data?.allow_public_following);
    ElMessage.success('隐私设置已更新');
  } catch (e) {
    ElMessage.error('隐私设置更新失败');
    await loadPrivacy();
  } finally {
    privacyLoading.value = false;
  }
};

const applyTheme = (theme: 'dark' | 'light') => {
  document.documentElement.setAttribute('data-theme', theme);
};

const applyAccentColor = (color: string) => {
  document.documentElement.style.setProperty('--color-accent', color);
  document.documentElement.style.setProperty('--color-accent-gradient', color);
  const atmosphere = color === '#8289d3'
    ? 'linear-gradient(180deg, rgba(176, 186, 235, 0.36) 0%, rgba(177, 191, 233, 0.31) 18%, rgba(179, 201, 223, 0.25) 38%, rgba(193, 192, 211, 0.18) 58%, rgba(223, 172, 185, 0.11) 78%, transparent 100%)'
    : 'linear-gradient(180deg, color-mix(in srgb, var(--color-accent) 12%, transparent) 0%, color-mix(in srgb, var(--color-accent) 7%, transparent) 44%, transparent 100%)';
  document.documentElement.style.setProperty('--color-atmosphere-gradient', atmosphere);
};

const setTheme = async (theme: 'dark' | 'light') => {
  appearance.theme = theme;
  applyTheme(theme);
  if (window.electronAPI?.settings) {
    await window.electronAPI.settings.setTheme(theme);
  }
};

const setAccentColor = async (color: string) => {
  appearance.accentColor = color;
  applyAccentColor(color);
  if (window.electronAPI?.settings) {
    await window.electronAPI.settings.setAccentColor(color);
  }
};

const setPlaylistPagingMode = async (mode: 'infinite' | 'pagination') => {
  playlistPagingMode.value = mode;
  if (window.electronAPI?.settings) {
    await window.electronAPI.settings.set({ playlistPagingMode: mode });
  }
  window.dispatchEvent(new CustomEvent('qz-playlist-page-mode-changed', { detail: mode }));
};

const onOpenPlayerPreferenceChange = async () => {
  if (window.electronAPI?.settings) {
    await window.electronAPI.settings.set({ openPlayerOnSongClick: openPlayerOnSongClick.value });
  }
  window.dispatchEvent(new CustomEvent('qz-open-player-on-song-click-changed', {
    detail: openPlayerOnSongClick.value,
  }));
};

let bassApplyTimer: ReturnType<typeof setTimeout> | null = null;
const onBassChange = async () => {
  if (!window.electronAPI) return;
  // 持久化源状态 + 实时下发(节流, main 侧算出绝对参数下发 C 核心)
  if (bassApplyTimer) clearTimeout(bassApplyTimer);
  bassApplyTimer = setTimeout(async () => {
    try {
      await window.electronAPI.settings.set({ bass: { ...bass } });
      await window.electronAPI.qzplayer.setBassConfig({ ...bass });
    } catch (e) {
      console.error('Failed to apply bass config', e);
    }
  }, 60);
};

const setBassMode = async (mode: 'speaker' | 'headphone') => {
  bass.mode = mode;
  await onBassChange();
};

// 当前生效的绝对参数(供 "?" 显示)
const bassEffective = computed(() => {
  if (bass.advanced) {
    return {
      crossover: bass.crossover,
      gain: bass.gain,
      drive: bass.exciter ? bass.drive : 0,
      exciter: bass.exciter,
      mix: bass.mix,
      release: bass.release,
    };
  }
  const preset = bass.mode === 'headphone'
    ? { crossover: 100, gain: 8, drive: 0, exciter: false, mix: 70, release: 150 }
    : { crossover: 90, gain: 3.5, drive: 10, exciter: true, mix: 18, release: 250 };
  return {
    crossover: preset.crossover,
    gain: preset.gain,
    drive: preset.drive,
    exciter: preset.exciter,
    mix: preset.mix,
    release: preset.release,
  };
});

// "?" 悬浮说明: 展示当前生效参数
const bassTooltip = computed(() => {
  if (!bass.enabled) {
    return ['<b>低音增强：已关闭</b>', '当前为旁路（位级透明、零延迟），原始音频直通不处理。'].join('\n');
  }
  const e = bassEffective.value;
  const head = bass.advanced
    ? '<b>高级模式（自定义参数）</b>'
    : (bass.mode === 'speaker'
        ? '<b>笔记本/扬声器（心理声学）</b>'
        : '<b>耳机/音响（真实加成）</b>');
  const lines = [
    head,
    bass.advanced ? '手动设定各项绝对参数。' : (bass.mode === 'speaker'
      ? '设备无法发出低频时，生成谐波让大脑补全低音。'
      : '设备能真实还原低频，直接提升'),
    '',
    '<b>当前生效参数：</b>',
    `· 分频点：${e.crossover.toFixed(0)} Hz（LR4 低通 + lowshelf 截止）`,
    `· 谐波激励：${e.exciter ? '开，drive +' + e.drive.toFixed(1) + ' dB（tanh 软饱和）' : '<b>关</b>'}`,
    `· 低频搁架：+${e.gain.toFixed(1)} dB`,
    `· 湿声混合：${e.mix.toFixed(0)}%（干声 ${(100 - e.mix).toFixed(0)}%）`,
    `· 砖墙限幅：-1 dBFS，5 ms 前瞻 / 1 ms 起控 / ${e.release.toFixed(0)} ms 释放`,
  ];
  return lines.join('\n');
});

const onCacheToggle = async () => {
  if (window.electronAPI) {
    await window.electronAPI.setCachePersist(settings.persistCache);
  }
};

const openCacheFolder = async () => {
  if (window.electronAPI) {
    await window.electronAPI.openCacheFolder();
  }
};

const clearCache = async () => {
  if (window.electronAPI) {
    await window.electronAPI.clearCache();
    await loadCacheInfo();
  }
};

const isChangingCache = ref(false);

const changeCacheLocation = async () => {
    if (window.electronAPI && !isChangingCache.value) {
        try {
            const path = await window.electronAPI.selectDirectory();
            if (path) {
                isChangingCache.value = true;
                const result = await window.electronAPI.changeCacheLocation(path);
                if (result.success) {
                    ElMessage.success('缓存位置已修改');
                    await loadCacheInfo();
                } else {
                    ElMessage.error(result.message || '修改失败');
                }
            }
        } catch (e) {
            ElMessage.error('操作失败');
            console.error(e);
        } finally {
            isChangingCache.value = false;
        }
    }
}

// Load settings BEFORE mount to avoid visual flicker
onBeforeMount(async () => {
  await Promise.all([loadCacheInfo(), loadAppearance(), loadPrivacy()]);
  isLoaded.value = true;
  // Enable transition after initial render
  nextTick(() => {
    setTimeout(() => {
      enableTransition.value = true;
    }, 50);
  });
});
</script>

<style scoped>
/* Fade transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.settings-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-container {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

/* 全屏播放时取消 Settings 的 drag region, 避免遮挡播放页的关闭条 */
.settings-overlay.player-open .settings-header {
  -webkit-app-region: no-drag;
}

.settings-title {
  font-size: var(--font-size-xl);
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  -webkit-app-region: no-drag;
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.close-btn:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border-color: var(--color-text-muted);
}

.close-icon {
  width: 20px;
  height: 20px;
}

.settings-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Left Navigation */
.settings-nav {
  width: 200px;
  padding: 20px 12px;
  background-color: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  margin-bottom: 4px;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all var(--transition-base);
}

.nav-item:hover {
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.nav-item.active {
  background-color: var(--color-accent-soft);
  color: var(--color-accent);
}

.nav-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* Right Content */
.settings-content {
  flex: 1;
  padding: 32px 48px;
  overflow-y: auto;
}

.section-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

/* Setting Item */
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 0;
  border-bottom: 1px solid var(--color-border);
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  margin-bottom: 6px;
}

.setting-desc {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.setting-desc.path-text {
  font-family: monospace;
  background-color: var(--color-bg-tertiary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  display: inline-block;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.setting-control {
  margin-left: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* Toggle Switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 26px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--color-bg-tertiary);
  border-radius: 26px;
  transition: var(--transition-base);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 3px;
  bottom: 3px;
  background-color: var(--color-text-secondary);
  border-radius: 50%;
  transition: var(--transition-base);
}

/* Disable transition on initial load */
.toggle-switch.no-transition .toggle-slider,
.toggle-switch.no-transition .toggle-slider:before {
  transition: none;
}

input:checked + .toggle-slider {
  background: var(--color-accent-gradient);
}

input:checked + .toggle-slider:before {
  transform: translateX(22px);
  background-color: white;
}

/* Action Button */
.action-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-base);
}

.action-btn:hover {
  background-color: var(--color-bg-elevated);
  border-color: var(--color-text-muted);
}

.action-btn.danger {
  color: #ff6b6b;
}

.action-btn.danger:hover {
  background-color: rgba(255, 107, 107, 0.1);
  border-color: #ff6b6b;
}

/* Placeholder */
.placeholder-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 0;
  color: var(--color-text-muted);
}

.placeholder-icon {
  width: 64px;
  height: 64px;
  margin-bottom: 16px;
  opacity: 0.5;
}

/* About */
.about-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 0;
  text-align: center;
}

.app-logo {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, #ec4141, #ff6b6b);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  margin-bottom: 20px;
  box-shadow: var(--shadow-lg);
}

.about-content h3 {
  font-size: var(--font-size-2xl);
  color: var(--color-text-primary);
  margin-bottom: 8px;
}

.version {
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.copyright {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

/* Scrollbar */
.settings-content::-webkit-scrollbar {
  width: 6px;
}

.settings-content::-webkit-scrollbar-track {
  background: transparent;
}

.settings-content::-webkit-scrollbar-thumb {
  background: var(--color-border-light);
  border-radius: 3px;
}

.settings-content::-webkit-scrollbar-thumb:hover {
  background: var(--color-text-muted);
}

/* Theme Toggle */
.theme-toggle {
  display: flex;
  gap: 8px;
  background-color: var(--color-bg-tertiary);
  padding: 4px;
  border-radius: var(--radius-md);
}

.theme-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all 0.2s ease;
}

.theme-btn:hover {
  color: var(--color-text-primary);
}

.theme-btn.active {
  background-color: var(--color-bg-primary);
  color: var(--color-accent);
  box-shadow: var(--shadow-sm);
}

/* Color Swatches */
.color-swatches {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-full);
  border: 3px solid transparent;
  background: var(--swatch-bg);
  cursor: pointer;
  position: relative;
  transition: border-color 0.18s ease, outline-color 0.18s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: 1px solid color-mix(in srgb, var(--swatch-color) 22%, transparent);
  outline-offset: 2px;
}

.color-swatch:hover {
  border-color: color-mix(in srgb, var(--swatch-color) 34%, transparent);
}

.color-swatch.active {
  border-color: var(--color-bg-primary);
  outline-color: var(--swatch-color);
}

.check-icon {
  width: 18px;
  height: 18px;
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}

/* Radio Group */
.radio-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.radio-option {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.radio-option input[type="radio"] {
  accent-color: var(--color-accent);
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.segmented-control {
  display: flex;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
}

.segment-btn {
  min-height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-full);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  transition: background-color 160ms ease, color 160ms ease;
}

.segment-btn:hover {
  color: var(--color-text-primary);
}

.segment-btn.active {
  background: var(--color-bg-primary);
  color: var(--color-accent);
}

.shortcuts-section .placeholder-content {
  display: none;
}

.shortcuts-section > .section-title {
  display: none;
}

.shortcut-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 24px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--color-border);
}

.shortcut-list {
  display: grid;
  gap: 10px;
}

.shortcut-row {
  min-height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 14px 0;
  border-bottom: 1px solid var(--color-border);
}

kbd,
.shortcut-key {
  min-width: 58px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: var(--radius-md);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font: 700 13px var(--font-family-base);
}

.shortcut-key {
  cursor: pointer;
}

.shortcut-key:hover,
.shortcut-key:focus-visible,
.shortcut-key.recording {
  border-color: var(--color-accent);
  color: var(--color-accent);
  outline: none;
}

/* Plugin Card Styles */
.plugin-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.plugin-card {
    background: var(--color-bg-secondary);
    border-radius: 12px;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border: 1px solid var(--color-border);
    transition: all 0.2s ease;
}

.plugin-card:hover {
    border-color: var(--color-accent);
    box-shadow: var(--shadow-sm);
    transform: translateY(-2px);
}

.plugin-info {
    flex: 1;
}



.plugin-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}

.tag {
    font-size: 11px;
    background: var(--color-accent-soft);
    color: var(--color-accent);
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
}

.action-btn.small {
    padding: 6px 12px;
    font-size: 13px;
}

.section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--color-border);
}

.plugin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 16px;
}

.empty-state {
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 0;
    color: var(--color-text-muted);
}

.empty-icon {
    width: 48px;
    height: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
}

.text-btn {
    margin-top: 12px;
    color: var(--color-accent);
    background: none;
    border: none;
    cursor: pointer;
    font-size: 14px;
    text-decoration: underline;
}

/* Modal */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2000;
    backdrop-filter: blur(4px);
}

.modal-content {
    background: var(--color-bg-primary);
    padding: 24px;
    border-radius: 16px;
    width: 400px;
    box-shadow: var(--shadow-lg);
    border: 1px solid var(--color-border);
}

.modal-content h3 {
    margin-bottom: 16px;
    font-size: 18px;
    color: var(--color-text-primary);
}

.modal-content p {
    color: var(--color-text-secondary);
    margin-bottom: 24px;
    line-height: 1.5;
}

.modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
}

.plugin-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 4px;
}

.plugin-name {
    font-weight: 500;
    font-size: 16px;
    color: var(--color-text-primary);
}

.plugin-version {
    font-size: 12px;
    background: var(--color-bg-tertiary);
    padding: 2px 6px;
    border-radius: 4px;
    color: var(--color-text-secondary);
}

.plugin-desc {
    font-size: 13px;
    color: var(--color-text-secondary);
    padding-bottom: 8px;
}

.action-btn.small {
    padding: 6px 12px;
    font-size: 13px;
}

/* Bass Boost */
.bass-boost-control {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
  min-width: 260px;
}

.bass-mode .segment-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.bass-mode .segment-btn svg {
  width: 16px;
  height: 16px;
}

.bass-slider-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bass-mode-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.segmented-control.bass-mode {
  width: fit-content;
}

.bass-disabled {
  opacity: 0.45;
  pointer-events: none;
}

.slider-cap {
  flex-shrink: 0;
  width: 48px;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  text-align: right;
}

.mini-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  cursor: pointer;
  user-select: none;
}

.mini-toggle input[type="checkbox"] {
  accent-color: var(--color-accent);
  width: 15px;
  height: 15px;
  cursor: pointer;
}

.bass-slider {
  -webkit-appearance: none;
  appearance: none;
  flex: 1;
  min-width: 180px;
  height: 6px;
  border-radius: var(--radius-full);
  background: var(--color-bg-tertiary);
  outline: none;
  cursor: pointer;
}

.bass-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-accent-gradient);
  border: 2px solid var(--color-bg-primary);
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: transform 0.12s ease;
}

.bass-slider::-webkit-slider-thumb:hover {
  transform: scale(1.15);
}

.bass-slider::-moz-range-thumb {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-accent);
  border: 2px solid var(--color-bg-primary);
  cursor: pointer;
}

.bass-value {
  min-width: 38px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-accent);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-accent-soft);
}

.bass-value.off {
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  font-weight: 500;
}

/* "?" help tooltip */
.bass-label {
  display: flex;
  align-items: center;
  gap: 6px;
}

.help-tip {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  cursor: help;
}

.help-icon {
  width: 15px;
  height: 15px;
  color: var(--color-text-muted);
  transition: color 0.15s ease;
}

.help-tip:hover .help-icon {
  color: var(--color-accent);
}

.help-tooltip {
  position: absolute;
  z-index: 50;
  top: 22px;
  left: -8px;
  width: 320px;
  padding: 12px 14px;
  background: var(--color-bg-elevated);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  font-size: 12px;
  line-height: 1.7;
  white-space: pre-line;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-4px);
  transition: opacity 0.16s ease, transform 0.16s ease, visibility 0.16s;
  pointer-events: none;
}

.help-tip:hover .help-tooltip {
  opacity: 1;
  visibility: visible;
  transform: translateY(0);
}

.help-tooltip :deep(b) {
  color: var(--color-text-primary);
  font-weight: 600;
}

/* Audio Output Device */
.audio-device-control {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  min-width: 260px;
}

.device-select {
  width: 100%;
  padding: 8px 12px;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  outline: none;
  transition: border-color var(--transition-base);
}

.device-select:hover,
.device-select:focus {
  border-color: var(--color-accent);
}

.device-select option {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.inline-btn {
  display: inline-flex;
  padding: 4px 8px;
  margin-left: 8px;
  vertical-align: middle;
}

/* Chain Info */
.chain-info-item {
  flex-direction: column;
  align-items: stretch;
}

.chain-info-item .setting-info {
  width: 100%;
}

.chain-display {
  margin-top: 8px;
  padding: 12px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.chain-text {
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  word-break: break-all;
}

.chain-details {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.chain-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: 11px;
  font-family: monospace;
  border: 1px solid var(--color-border);
}

.chain-tag.tag-ok {
  color: #22c55e;
  border-color: rgba(34, 197, 94, 0.3);
  background: rgba(34, 197, 94, 0.08);
}

.chain-tag.tag-warn {
  color: #f97316;
  border-color: rgba(249, 115, 22, 0.3);
  background: rgba(249, 115, 22, 0.08);
}

/* Debug Log */
.log-item {
  flex-direction: column;
  align-items: stretch;
}

.log-item .setting-info {
  width: 100%;
}

.log-panel {
  margin-top: 8px;
}

.log-content {
  max-height: 250px;
  overflow-y: auto;
  padding: 8px 12px;
  background: #1a1a2e;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: 11px;
  line-height: 1.5;
  user-select: text;
  -webkit-user-select: text;
  cursor: text;
}

.log-line {
  color: #a8b5d1;
  white-space: pre-wrap;
  word-break: break-all;
}

.log-line:hover {
  background: rgba(255, 255, 255, 0.04);
}

.log-empty {
  color: var(--color-text-muted);
  text-align: center;
  padding: 20px;
}

.log-content::-webkit-scrollbar {
  width: 4px;
}

.log-content::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}
</style>

# QZ Music for Desktop

一款简洁美观的跨平台音乐播放器，提供优雅的桌面音乐体验
安卓版本请访问：[官方网站](https://music.qz.shiqianjiang.cn)

## 🛠 技术架构

| 技术             | 说明            |
|----------------|---------------|
| **Electron**   | 跨平台桌面应用框架     |
| **Vue 3**      | 响应式前端框架       |
| **TypeScript** | 类型安全的开发体验     |
| **Pinia**      | 轻量级状态管理       |
| **Vite**       | 现代化的前端构建工具    |
| **QZ Plugins** | 高拓展性的插件运行环境   |
| **AMLL**       | 背景渲染             |
| **QZPlayer**   | 基于WASAPI和FFmpeg的轻量级模块化音频播放器,使用C编写,IPC与主程序通信 |

## 🐧 Linux (amd64) 支持

```bash
# 安装 TagLib 开发库 (用于编译本地音乐标签扫描器)
# Debian / Ubuntu
sudo apt install -y libtag1-dev
# Fedora
sudo dnf install -y taglib-devel
# Arch Linux
sudo pacman -S --needed taglib

# 编译本地音乐标签扫描器
bash native/taglib_reader/build.sh

# 确保播放核心二进制有可执行位 (Windows 下提交的二进制会丢失该位)
chmod +x core/qzplayer native/taglib_reader/build/taglib_reader_cli

# 安装依赖并打包
bun install
bun run electron:build:linux
# 产物: release/*.AppImage 与 release/*.deb
```

### 运行时依赖

安装/运行 Linux 版时需要以下系统库（`libfftw3f.so.3` 已随安装包内置，无需手动安装）：

| 依赖 | Debian / Ubuntu | 说明 |
|------|----------------|------|
| ALSA | `libasound2` | 音频输出（必需） |
| TagLib | `libtag1` | 本地音乐标签扫描（不使用本地音乐可不装） |
| zlib | `zlib1g` | 通常已预装 |
| FFTW（单精度） | `libfftw3-3` | 已内置，无需安装 |

```bash
# Debian / Ubuntu
sudo apt install -y libasound2 libtag1

# Fedora
sudo dnf install -y alsa-lib taglib

# Arch Linux
sudo pacman -S --needed alsa-lib taglib
```

## 🍎 macOS 支持（Apple Silicon / Intel）

macOS 自动使用 Electron 内置的 **HTML `<audio>`** 播放，无需编译 Apple 版 QZPlayer。
Windows / Linux 仍使用原生 QZPlayer，不受影响。

- 在线音乐仍通过主进程的 `127.0.0.1:5266` 代理取流，保留插件解析、缓存和 Range 拖动。
- 支持本地音乐、音量、进度、自动切歌、歌词、一起听，以及 Media Session 播放控制。
- 使用系统默认音频设备；暂不提供原生核心的低音增强、独占输出、自动采样率匹配及频谱分析。
- 格式支持以当前 Electron/Chromium 解码器为准，不等同于 QZPlayer 的完整 FFmpeg 格式支持；不支持的格式会走现有重试/跳过流程。

### 在 Mac 上开发与打包

```bash
# 本地标签扫描器需要 Xcode Command Line Tools 与 TagLib；不是播放核心
xcode-select --install  # 已安装则跳过
brew install taglib pkg-config dylibbundler
bash native/taglib_reader/build.sh

npm install
npm run dev
# 或打包当前 Mac 的架构（arm64 / x64）
npm run electron:build:mac
# 产物：release/QZMusic-*-mac-*.dmg 和 *.zip
```

扫描器构建脚本会将所需的 Homebrew 动态库复制到 `build/lib/` 并改写加载路径，
打包时一起携带，用户不需要安装 Homebrew。请在目标架构的 Mac 上编译和打包，
不要复用 Linux 的扫描器或直接跨架构打包。本地扫描器未构建时，在线音乐仍可开发使用。

GitHub Actions 分别构建 arm64 和 x64 包。默认构建未配置 Developer ID 签名/公证，
首次运行可能受到 Gatekeeper 限制；正式分发建议配置 Apple 签名和公证凭据。
仅在确认安装包可信时，按 macOS“隐私与安全性”中的提示允许打开。

### 验证

```bash
npm run test:audio  # HTML Audio 后端回归测试，不需要 macOS
npm run test:audio:electron  # 真实 Chromium 音频元素冒烟测试（需桌面环境）
npm run build
```

Mac 实机验收：在线/本地播放与拖动进度、暂停恢复、切歌与列表循环、一起听同步、
系统媒体键、最小化/隐藏后持续播放、Dock 恢复、Cmd+Q 退出，以及安装包在无 Homebrew 环境下的本地扫描。

## 📖 项目说明

本项目为 **Vue + Electron** 的学习实践作品，旨在完善QZ Music的多平台生态。

> ⚠️ 注意：
> - QZPlugin 仅提供插件运行框架，不包含任何默认音乐插件
> - AMLL 提供功能接口，不关联具体音乐数据源

## 🛠 开发者(排名不分先后)
- (以下内容实时更新,更新日期:2026.1.21)
- -蜻蜓T-T ([B站](https://space.bilibili.com/3546554124209112) [Github](https://github.com/lqtmcstudio)) | 插件系统 音频系统 UI设计/开发 后端
- 时迁酱 ([个人主页](https://shiqianjiang.cn)) 登录/鉴权系统 

## 📄 开源协议

本项目采用 [**AGPL v3**](https://github.com/lqtmcstudio/QZMusic_PC/blob/master/LICENSE) 开源协议。

## 使用工具

[**WebStorm**](https://www.jetbrains.com/webstorm/): Make development more productive and enjoyable.
[**Antigravity**](https://antigravity.google/): Experience liftoff with the next-generation IDE

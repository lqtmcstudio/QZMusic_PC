# QZ Music for Windows

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

# QZ Music for Windows

一款简洁美观的跨平台音乐播放器，提供优雅的桌面音乐体验
安卓版本请访问：[官方网站](https://music.qz.shiqianjiang.cn)

## ⚠️ 项目状态

> 🔔 **重要提示**：
> 本项目**正在积极开发维护中**，目前仍处于早期阶段，可能存在以下问题：
> - 部分功能尚未完善或稳定
> - 可能存在 Bug 和兼容性问
> - UI/UX 可能在后续版本中调整
>
> 如果您在使用过程中遇到任何问题，欢迎提交 [Issue](https://github.com/miao-moe/QZMusic_PC/issues) 反馈，我们会尽快处理！
>
> 感谢您的理解与支持 🙏

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
## 📖 项目说明

本项目为 **Vue + Electron** 的学习实践作品，旨在完善QZ Music的多平台生态。

> ⚠️ 注意：
> - QZPlugin 仅提供插件运行框架，不包含任何默认音乐插件
> - AMLL 提供功能接口，不关联具体音乐数据源

## 🛠 开发者(排名不分先后)
- (以下内容实时更新,更新日期:2026.5.23)
- 蜻蜓T-T ([B站](https://space.bilibili.com/3546554124209112) [Github](https://github.com/lqtmcstudio)) | 插件系统 音频系统 UI设计/开发 后端
- 时迁酱 ([个人主页](https://shiqianjiang.cn)) 登录/鉴权系统 
- miao-moe ([GitHub](https://github.com/miao-moe) [博客](https://miao-moe.cn)) | 触控适配优化 UI/UX 改进

## 📄 开源协议

本项目采用 [**AGPL v3**](https://github.com/miao-moe/QZMusic_PC/blob/master/LICENSE) 开源协议。

## 使用工具

[**WebStorm**](https://www.jetbrains.com/webstorm/): Make development more productive and enjoyable.
[**Antigravity**](https://antigravity.google/): Experience liftoff with the next-generation IDE

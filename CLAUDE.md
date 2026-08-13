# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QZ Music is a cross-platform desktop music player (Electron + Vue 3 + TypeScript). The backend is a separate FastAPI Python project at `C:\Develop\SuperApi\app_api`. This repo is the Electron client only.

## Build & Dev Commands

```bash
# Install dependencies
npm install

# Development (hot reload)
npm run dev

# Production build
npm run build

# Build Windows installer
npm run electron:build
```

No test runner is configured. No linter is configured.

## Architecture

### Three-Process Model (Critical)

The app uses Electron's three-process architecture with strict separation:

```
Renderer (Vue)  →  Preload (IPC bridge)  →  Main Process  →  HTTP fetch  →  Backend API
```

**The renderer process NEVER makes HTTP requests directly.** All API calls go through this chain:

1. **Renderer** calls `window.electronAPI.xxx()` methods
2. **Preload** (`src/preload/index.ts`) maps each method to `ipcRenderer.invoke('channel:name', args)`
3. **Main process** (`src/main/index.ts`) registers `ipcMain.handle('channel:name', handler)`
4. **Main process** calls the backend via `qzFetch()` (defined in `src/main/authStore.ts`) which uses native `fetch()`

To add a new API feature, you must touch all 4 layers:
- Backend endpoint (FastAPI)
- Main process function (`src/main/authStore.ts` or similar)
- IPC handler (`src/main/index.ts`)
- Preload bridge (`src/preload/index.ts`)
- Type definition (`src/renderer/src/types/electron.d.ts`)

### Backend API

- Base URL: `https://api.qz.shiqianjiang.cn/app`
- Auth: JWT Bearer token, auto-refreshed via `getValidAccessToken()`
- `qzFetch(path, init)` is the universal API caller — attaches auth, handles errors

### Key Directories

```
src/main/           - Electron main process (window, IPC handlers, audio engine control)
  authStore.ts      - Auth state, token management, qzFetch(), user API calls
  playlistStore.ts  - Playlist CRUD (local JSON files + cloud API)
  qzpController.ts  - IPC controller for QZPlayer (C audio engine binary)
  proxyServer.ts    - Local HTTP proxy (:5266) that streams remote music to QZPlayer
  pluginSystem.ts   - Plugin framework for music source plugins
  settingsStore.ts  - App settings persistence

src/preload/        - Context bridge (ONLY file that can use both Node and browser APIs)
  index.ts          - Defines the complete window.electronAPI surface

src/renderer/src/   - Vue 3 frontend
  main.ts           - App entry, Vue Router config, Pinia setup
  stores/           - Pinia stores (player, playlists, auth, listenTogether)
  views/            - Page components (Playlist.vue is reused for 5+ routes)
  components/       - Shared UI components
  types/            - TypeScript interfaces (electron.d.ts is the IPC contract)
```

### Audio Pipeline

QZPlayer is a C binary (`core/` directory) that plays audio via WASAPI+FFmpeg. Communication:
- Main process sends commands via IPC (`src/main/qzpController.ts`)
- Music is streamed through a local HTTP proxy (`src/main/proxyServer.ts` on port 5266)
- URL format: `http://localhost:5266/music?source={source}&id={id}&quality={quality}`

### Local vs Cloud Playlists

- **Local** (`scope: 'local'`): JSON files in `userData/playlists/`, UUID-based IDs
- **Cloud** (`scope: 'cloud'`): Backend API at `/playlist/*`, auto-incrementing numeric IDs
- **Plugin** (`scope: 'plugin'`): Read-only collections from music source plugins

### AMLL (Apple Music-like Lyrics)

`amll-local/` is a local copy of the AMLL library (lyrics rendering + background effects). It's aliased in `electron.vite.config.ts` to resolve from source. Do not modify AMLL packages directly — they are a third-party dependency.

## Conventions

- Use `Icon` component from `@iconify/vue` for all icons (e.g. `<Icon icon="lucide:play" />`)
- UI component library: Element Plus (`ElMessage` for toasts, `ElMessageBox` for confirmations)
- State management: Pinia stores in `src/renderer/src/stores/`
- Routing: Vue Router with hash history, defined inline in `src/renderer/src/main.ts`
- CSS: Scoped styles with CSS custom properties (`--color-accent`, `--color-bg-*`, etc.)
- `Playlist.vue` is a monolithic view serving multiple routes (Liked, Recent, PlaylistDetail, UserLikedPlaylist, PluginCollection) — use `route.name` and computed properties to branch behavior

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **WildFireChat PC Client** — an Electron + Vue 3 desktop IM (instant messaging) application. It integrates the WildFireChat IM SDK (a paid native SDK distributed as `marswrapper.node`) with a Vue 3 frontend via Electron's IPC bridge. The project is on the `master` branch (Vue 3); `vue2` branch is in maintenance mode.

## Development Commands

```bash
# Start development (Electron + hot reload)
npm run dev

# Build/package for current platform
npm run package

# Cross-platform packaging
npm run cross-package-win          # Windows amd64
npm run cross-package-win32        # Windows x86
npm run cross-package-linux        # Linux amd64
npm run cross-package-linux-arm64  # Linux arm64
```

**Prerequisites before dev/package:**
- Node.js v18.19.0, npm v10.2.3
- `node-gyp@8.3.0` installed globally
- macOS: Xcode, Python 2.7.x
- Windows: `windows-build-tools` (VS2019), Python 2.7.x

**Recommended `.npmrc` settings (for China mirrors):**
```
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/
registry=https://registry.npmmirror.com/
```

Use `npm` not `cnpm`. Avoid Chinese characters in the project path.

## Architecture

### Process Model (Electron)
- **Main process**: `src/background.js` — manages windows, system tray, IPC handlers, native node addon (`marswrapper.node`), auto-updater, screenshots, and the open-platform local server.
- **Renderer process**: Vue 3 SPA loaded into Electron's BrowserWindow. Entry point: `src/main.js`.
- **IPC bridge**: Events defined in `src/ipcEventType.js`. Renderer uses `ipcRenderer` from `src/platform.js` (wraps Electron APIs); main process handles via `ipcMain`.
- **Preload script**: `src/ui/workspace/bridgeClientImpl.js` (for the workspace/H5 app bridge).

### State Management
- **`src/store.js`**: Legacy reactive store (Vue options-style) — handles conversations, messages, contacts, and most IM state. Fields prefixed `_` are UI-layer patches; `__` are internal-only.
- **`src/pstore.js`**: Pinia store — newer reactive state using Vue 3 Composition API. Both stores coexist.

### WFC SDK Layer (`src/wfc/`)
- **`client/wfc.js`**: Main SDK entry point. All IM operations go through this singleton.
- **`messages/`**: Message content type definitions (text, image, video, file, sound, notification types, streaming AI text, etc.).
- **`model/`**: Data models (Conversation, ConversationType, GroupType, etc.).
- **`proto/`**: Protocol layer — `proto.min.js` (renderer-side proto), `proto_main.js` (main process native binding), `proto_renderer_proxy.js` (IPC proxy between renderer and main).
- **`av/`**: Audio/video call support. `internal/engine.min.js` is the active AV SDK (swap with `engine-conference.min.js` for advanced 9-way calls, or `engine-multi.min.js` for standard 4-way).

### Routing (`src/routers.js`)
- `/` → `LoginPage`
- `/home` → `HomePage` with nested routes: conversation, contact, fav, setting, conference, AI, workspace
- `/voip/single`, `/voip/multi`, `/voip/conference` — call windows
- `/files`, `/composite`, `/message`, `/mmpreview`, `/collection/*`, `/poll/*` — feature sub-windows

### UI Structure (`src/ui/`)
- `main/` — primary views: HomePage, LoginPage, ConversationPage, ContactPage, SettingPage, and sub-panels
- `main/conversation/` — conversation panel, message input, message item rendering, message type views
- `main/contact/` — contact list, group/user/channel detail views
- `voip/` — Single/Multi call UI, conference UI, screen share
- `workspace/` — embedded H5 app workspace
- `collection/`, `poll/` — jielong (chain activity) and poll features
- `common/` — shared utilities: Alert, Forward, Picker dialogs, ListView, LoadingView

### Configuration (`src/config.js`)
Central `Config` class with static fields. Key settings to modify for private deployment:
- `APP_SERVER` — app-server address (default: `https://app.wildfirechat.net`)
- `ICE_SERVERS` — TURN server config for A/V calls
- `COLLECTION_SERVER`, `POLL_SERVER`, `ORGANIZATION_SERVER`
- Feature flags: `ENABLE_MULTI_VOIP_CALL`, `ENABLE_PTT`, `ENABLE_MIX_MEDIA_MESSAGE`, `ENABLE_WATER_MARK`, etc.

### API Layer (`src/api/`)
- `appServerApi.js` — REST calls to app-server (login, token exchange)
- `conferenceApi.js`, `collectionApi.js`, `pollApi.js` — feature-specific APIs
- `organizationServerApi.js` — org structure service

### Custom Messages (`src/wfc_custom_message/`)
Example implementations for extending the SDK with custom message types.

## Key Conventions

- The native SDK binary (`marswrapper.node`) must match the target platform/arch. The `scripts/copy-proto.js` script copies the correct binary for the target during build.
- Debug shortcut: `Ctrl+G` (macOS: `Cmd+G`) opens DevTools.
- `src/assets/twemoji/` contains emoji assets; for intranet deployments, host these and update `Config.emojiBaseUrl()`.
- AV SDK selection: replace content of `src/wfc/av/internal/engine.min.js` with either `engine-conference.min.js` (advanced) or `engine-multi.min.js` (standard).
- Linux Ubuntu 24: add `--no-sandbox` to dev command if SUID sandbox error appears.
- Windows 7 black screen fix: uncomment `app.disableHardwareAcceleration()` in `background.js`.

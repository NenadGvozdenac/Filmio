# Filmio

A desktop torrent client and player for movies and TV series, built with Electron and WebTorrent. Paste a magnet link or open a `.torrent` file, and Filmio downloads it, recognizes what it is (movie, series, season, episode) and lets you watch it while it downloads.

The sidebar has three main tabs:

- **Add**: paste magnet links or `.torrent` URLs (one per line), open `.torrent` files, or drag them anywhere onto the window. **Download and watch** starts streaming right away. **Recently added** shows what Filmio recognized.
- **Movies & Series**: your library. Movies appear as poster cards. Series are grouped by show and season, and a downloaded full season is shown as one set.
- **Downloads**: everything is saved to a single folder. You can pause and resume active downloads, stop or start seeding finished ones, and remove a download with or without deleting its files. Downloads resume after a restart.

Also in the sidebar:

- **Player**: watch while the file is still downloading; finished files play straight from disk. Controls include play/pause, seeking, ±10s skip, volume, speed, quality (when a torrent has several versions of the same file) and fullscreen. Season packs also get an episode picker and next/previous episode buttons.
- **Settings**: language (English / Srpski) and theme (System / Dark / Light); startup options **Start in fullscreen** and **Launch on system startup** (both off by default); keyboard shortcuts; download folder; TMDB key for posters.
- **Window**: opens at 2/3 of the screen width with navigation in a left sidebar. Use **Fullscreen** in the sidebar or press `F11` to toggle app fullscreen; `Esc` leaves it.

The UI follows the [shadcn/ui](https://ui.shadcn.com) design system: zinc theme tokens, the Inter font and [Lucide](https://lucide.dev) icons. It is implemented in plain CSS, without React or Tailwind.

> Only download content you have the right to download and share. Like any torrent client, Filmio also uploads (seeds) the pieces it downloads.

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer
- GNU Make (optional; you can also use npm directly)

## Getting started

```sh
make start
```

This installs dependencies (on first run) and launches the app. Other targets:

| Command        | Description                     |
| -------------- | ------------------------------- |
| `make install` | Install desktop dependencies    |
| `make start`   | Run the desktop app             |
| `make clean`   | Remove `node_modules`           |

Without Make:

```sh
cd desktop
npm install
npm start
```

> **VS Code terminal:** VS Code sets `ELECTRON_RUN_AS_NODE=1`, which makes Electron run as plain Node and fail with
> `The requested module 'electron' does not provide an export named ...`.
> `make start` unsets it automatically. If you use npm directly, unset it first
> (PowerShell: `Remove-Item Env:ELECTRON_RUN_AS_NODE`, bash: `unset ELECTRON_RUN_AS_NODE`).

## Recognizing movies and series

Once a torrent's metadata arrives, Filmio reads the torrent and file names:

| Name example | Recognized as |
| ------------ | ------------- |
| `The.Matrix.1999.1080p.BluRay.x264.mp4` | Movie *The Matrix (1999)*, 1080p |
| `Show.Name.S02E05.720p.WEB.mp4` | Series *Show Name*, S02E05 |
| `Show.Name.S03.COMPLETE.1080p` (many episode files) | Season 3 pack: every episode is downloaded |
| `[Group] Show Name - 09 (1080p).mkv` | Anime-style episode 9 of *Show Name* |
| `Show Name Episode 1 + 2` | Episodes 1-2 |

**Posters and descriptions (TMDB):**
- With a free [TMDB](https://www.themoviedb.org) API key (**Settings → Library info**; the v3 API key and the v4 read access token both work), each download is looked up once.
- TMDB provides the official title, poster and description shown in **Movies & Series**.
- Changing the key retries downloads that did not get a match.
- The key is stored only in the local settings file (`%APPDATA%\Filmio\state.json`), never in the repository.

## Downloading and seeding

- **What gets downloaded:** a movie or single episode downloads only its main video file. A season or series pack (a torrent with two or more episode files) downloads every episode.
- **Seeding:** finished downloads keep seeding until you click **Stop seeding** in Downloads. The files stay in your library, and **Start seeding** shares them again.
- **Web seed fix:** some torrents (for example from the Internet Archive) include metadata files that change after the torrent was made. A piece shared with such a file never passes the hash check, so the download would stop at about 99%. When only those boundary pieces are missing, Filmio downloads the missing bytes of the video directly from the torrent's HTTP web seed and marks the download complete.

## Keyboard shortcuts

Player shortcuts can be changed in **Settings → Keyboard shortcuts**: click a key, then press the new one (`Esc` cancels). If the new key is already used by another action, the two actions swap keys. **Reset to defaults** restores the table below.

| Default key | Action |
| ----------- | ------ |
| `Space` | Play / pause |
| `M` | Mute / unmute |
| `N` | Next episode (series only) |
| `B` | Previous episode (series only) |
| `←` / `→` | Back / forward 10 seconds |
| `↑` / `↓` | Volume up / down |
| `F` (or double-click) | Player fullscreen |

`F11` (app fullscreen) and `Esc` are fixed and cannot be reassigned.

**Next/previous episode** first looks at other episodes in the same torrent, such as a season pack. It also includes episodes of the same show from your other downloads.

## Logo, app icon and tray

The logo lives in `desktop/assets/`:

| File | Used for |
| ---- | -------- |
| `icon.svg` | Master logo; also shown in the sidebar |
| `icon.ico` / `icon.png` | Window and taskbar icon (Windows / other platforms) |
| `tray.svg` | Simplified mark for small sizes |
| `tray.ico` / `tray.png` / `tray@2x.png` | System tray icon |

After editing an SVG, run `npm run icons` in `desktop/` to regenerate the PNG and ICO files. The script renders them with Electron.

**Tray icon:** click to open the window; right-click for **Open Filmio** and **Quit Filmio**. Only one Filmio runs at a time: starting it again brings the open window to the front.

**Closing Filmio** (the window's X or **Quit Filmio** in the tray) shuts down everything: all downloads and seeding stop, the local stream server closes and the process exits. Nothing keeps running in the background. Unfinished downloads resume the next time Filmio starts.

## Dependencies and security

`npm audit` reports 0 vulnerabilities. The unmaintained `ip` package (advisory GHSA-2p57-rm9w-gvfp), pulled in by `bittorrent-tracker`, is replaced through npm `overrides` with a small local module in `desktop/shims/ip`. That module implements only `ip.toString()`, the one function the tracker uses. Do not run `npm audit fix --force`: it would downgrade WebTorrent to 0.7.3.

## Project structure

```
Filmio/
├── Makefile
└── desktop/                     Electron app
    ├── assets/                  Logo, app icon, tray icon (SVG sources + generated PNG/ICO)
    ├── scripts/build-icons.mjs  Regenerates the icon files (npm run icons)
    ├── shims/ip/                Local replacement for the vulnerable 'ip' package
    └── src/
        ├── main/                Main process (Node.js)
        │   ├── index.js         Entry point, wires everything together
        │   ├── config/          Paths and default settings
        │   ├── models/          Download, Settings, Quality
        │   ├── repositories/    JSON persistence (settings, downloads, .torrent cache)
        │   ├── providers/       TMDB (posters and titles)
        │   ├── services/        Downloads, WebTorrent, HTTP streaming, metadata, settings, startup
        │   ├── controllers/     Input validation, calls into services (downloads, settings, system, window)
        │   ├── routes/          IPC channel → controller mapping
        │   ├── utils/           Name parsing, video file rules, AppError
        │   └── window/          BrowserWindow and tray setup
        ├── preload/             Safe IPC bridge (window.bridge)
        └── renderer/            UI (plain HTML/CSS/ES modules)
            ├── index.html
            ├── styles/          shadcn/ui-style CSS (tokens + components)
            └── js/
                ├── api/         IPC client
                ├── services/    Downloads, settings, theme, keybinds, system, window
                ├── views/       Sidebar tabs, add, library, downloads, player, settings
                │   └── components/  Collapsible section, dialog
                ├── i18n/        Translations (en, sr) with plural rules
                └── utils/       DOM helpers, Lucide icons, formatting, toasts
```

### How it works

1. **Request flow:** renderer view → renderer service → IPC (`routes/ipcRoutes.js`) → controller → service → repository or provider.
2. **Responses:** each IPC response is either `{ ok, data }` or `{ ok: false, error: { code, message } }`. The renderer translates error codes into the selected language.
3. **Streaming:** `StreamService` runs a local HTTP server on `127.0.0.1` that supports Range requests. While a file is downloading, the `<video>` element streams from the torrent and WebTorrent downloads the pieces needed at the current playback position first. Finished files play straight from disk.
4. **Live progress:** the main process pushes download progress to the UI every second.

### Adding a language

1. Copy `desktop/src/renderer/js/i18n/locales/en.js` to a new file, for example `de.js`, and translate the values. Counted strings are objects with [plural categories](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), e.g. `{ one: '{count} file', other: '{count} files' }`.
2. Register it in `i18n/i18n.js` (`LOCALES`).
3. Add the code to `LANGUAGES` in `src/main/models/Settings.js`.
4. Add an `<option>` to `#set-language` in `index.html`.

## Data locations

| What | Where |
| ---- | ----- |
| Downloads | `~/Downloads/Filmio` by default (can be changed in Settings) |
| Settings, download list, cached `.torrent` files | Electron `userData` folder (Windows: `%APPDATA%\Filmio`) |

## Known limitations

- The built-in player plays MP4, M4V and WebM. MKV, AVI and HEVC/x265 files still download, so you can open them in an external player such as VLC.
- Magnet links with no active peers may never load their metadata. The player gives up after 90 seconds.
- The search that existed in earlier versions was removed; it is still in the git history (commit `4a7cb62`).

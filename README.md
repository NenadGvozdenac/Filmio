# Filmio

A desktop app for searching, downloading and watching movies and TV series over BitTorrent, built with Electron and WebTorrent.

The sidebar has three main tabs:

- **Search**: one search box. Each result is classified automatically as a movie or a series from markers like `S01E02`, `1x02`, `Season 1` or `Complete`. Movies are grouped by title, series by show → season → episode, and the best quality release is always listed first.
- **Movies & Series**: your library of downloaded content. Movies appear as cards. Series are grouped by show and season, and a downloaded full season is shown as one set.
- **Downloads**: everything is saved to a single folder. You can pause and resume active downloads, stop or start seeding finished ones, and remove a download with or without deleting its files. Downloads resume after a restart.

Also in the sidebar:

- **Player**: watch while the file is still downloading; finished files play straight from disk. Controls include play/pause, seeking, ±10s skip, volume, speed, quality and fullscreen. Season packs also get an episode picker.
- **Settings**: language (English / Srpski) and theme (System / Dark / Light); startup options **Start in fullscreen** and **Launch on system startup** (both off by default); keyboard shortcuts; download folder and MP4-only filter; search sources.
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

## Title recognition (TMDB)

With a free [TMDB](https://www.themoviedb.org) API key (**Settings → Search sources → TMDB API key**; either the v3 API key or the v4 read access token works), every search first asks TMDB what you mean:

1. **Identify:** "endgame" becomes **Avengers: Endgame (2019)**. TMDB supplies the poster, rating, overview and whether it is a movie or a series.
2. **Search:** your sources are searched with your query and, when it differs, with the official title.
3. **Match:** a release is attached to the title card only when its name matches the title (and, for movies, the year matches within one year). Trailers, teasers, reviews, reactions, scenes, fan edits and files too small to be the full movie or episode are left out.
4. **Show:** title cards come first, with the best quality release on top. Everything else appears under **Other results**.

**Series** get more from TMDB:

- **Season names are searchable.** "steel ball run" finds *JoJo's Bizarre Adventure* and focuses season 6, *Steel Ball Run*.
- **Latest episode on top.** The card shows the latest aired episode (for example S06E09 · Frightening Monsters (1)) with its releases, best quality first, followed by the date of the next episode.
- **Targeted search.** Sources are also searched for the show name with the season name, the season name alone, and the latest episode (`Show S06E09`).
- **Anime naming.** Fansub names like `[Group] JoJo no Kimyou na Bouken Part 7 - Steel Ball Run - 09 (1080p)` are recognized: the season comes from the season name and the episode from the absolute number.

Downloads started from a title card keep the TMDB poster, which the **Movies & Series** library shows. Without a key, search works as before, and a hint links to Settings.

The key is stored only in the local settings file (`%APPDATA%\Filmio\state.json`). It is never part of the repository.

## Search sources

| Source | Notes |
| ------ | ----- |
| **Internet Archive** | Built in and enabled by default. Public-domain and freely licensed films. Every item ships with HTTP web seeds, so it downloads even without peers. |
| **Torznab indexers** | Connect [Jackett](https://github.com/Jackett/Jackett) or [Prowlarr](https://github.com/Prowlarr/Prowlarr) in **Settings → Torznab indexers** with a name, API URL and API key. |

Example Jackett URL:

```
http://127.0.0.1:9117/api/v2.0/indexers/all/results/torznab/api
```

**Show MP4 results only** is on by default. Torznab results are kept only when their name mentions MP4, because the built-in player can't play most MKV/HEVC files.

## Quality ranking

Releases are parsed from their names and sorted in this order:

1. CAM/telesync rips always go last.
2. Resolution: 4K → 1440p → 1080p → 720p → 480p …
3. Source: REMUX → BluRay → WEB-DL → WEBRip → HDTV → DVD
4. Seeders
5. Size

In the player, the **quality** menu lists other video files of the same episode or movie in the torrent, plus other releases of the same title. Switching keeps the current playback position.

## Downloading and seeding

- **What gets downloaded:** a movie or single episode downloads only its main video file. A season or series pack (a torrent with two or more episode files) downloads every episode.
- **Seeding:** finished downloads keep seeding until you click **Stop seeding** in Downloads. The files stay in your library, and **Start seeding** shares them again.
- **Internet Archive fix:** Archive torrents often include metadata files (`*_meta.xml`, thumbnails) that change after the torrent was made. A piece shared with such a file never passes the hash check, so the download would stop at about 99%. When only those boundary pieces are missing, Filmio downloads the missing bytes of the video directly from the HTTP web seed and marks the download complete.

## Dependencies and security

`npm audit` reports 0 vulnerabilities. The unmaintained `ip` package (advisory GHSA-2p57-rm9w-gvfp), pulled in by `bittorrent-tracker`, is replaced through npm `overrides` with a small local module in `desktop/shims/ip`. That module implements only `ip.toString()`, the one function the tracker uses. Do not run `npm audit fix --force`: it would downgrade WebTorrent to 0.7.3.

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

**Next/previous episode** first looks at other episodes in the same torrent, such as a season pack. It also includes episodes of the same show from your other downloads. The player shows matching skip buttons when it is playing a series.

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
        │   ├── models/          Release, Download, Settings, Quality
        │   ├── repositories/    JSON persistence (settings, downloads, .torrent cache)
        │   ├── providers/       Search sources (Internet Archive, Torznab)
        │   ├── services/        Search, downloads, WebTorrent, HTTP streaming, settings
        │   ├── controllers/     Input validation, calls into services (search, downloads, settings, system, window)
        │   ├── routes/          IPC channel → controller mapping
        │   ├── utils/           Name parsing, grouping, video file rules, AppError
        │   └── window/          BrowserWindow setup
        ├── preload/             Safe IPC bridge (window.bridge)
        └── renderer/            UI (plain HTML/CSS/ES modules)
            ├── index.html
            ├── styles/          shadcn/ui-style CSS (tokens + components)
            └── js/
                ├── api/         IPC client
                ├── services/    Search, downloads, settings, theme, system, window
                ├── views/       Sidebar tabs, search, library, downloads, player, settings
                │   └── components/  Movie/series results, release list, dialog
                ├── i18n/        Translations (en, sr) with plural rules
                └── utils/       DOM helpers, Lucide icons, formatting, toasts
```

### How it works

1. **Request flow:** renderer view → renderer service → IPC (`routes/ipcRoutes.js`) → controller → service → repository or provider.
2. **Responses:** each IPC response is either `{ ok, data }` or `{ ok: false, error: { code, message } }`. The renderer translates error codes into the selected language.
3. **Streaming:** `StreamService` runs a local HTTP server on `127.0.0.1` that supports Range requests. While a file is downloading, the `<video>` element streams from the torrent and WebTorrent downloads the pieces needed at the current playback position first. Finished files play straight from disk.
4. **Live progress:** the main process pushes download progress to the UI every second.

### Adding a language

1. Copy `desktop/src/renderer/js/i18n/locales/en.js` to a new file, for example `de.js`, and translate the values. Counted strings are objects with [plural categories](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/PluralRules), e.g. `{ one: '{count} release', other: '{count} releases' }`.
2. Register it in `i18n/i18n.js` (`LOCALES`).
3. Add the code to `LANGUAGES` in `src/main/models/Settings.js`.
4. Add an `<option>` to `#set-language` in `index.html`.

## Data locations

| What | Where |
| ---- | ----- |
| Downloads | `~/Downloads/Filmio` by default (can be changed in Settings) |
| Settings, download list, cached `.torrent` files | Electron `userData` folder (Windows: `%APPDATA%\Filmio`) |

## Known limitations

- MKV and most HEVC/x265 files can't be played in the built-in player. They still download, so you can open them in an external player such as VLC.
- Magnet links with no active peers may never load their metadata. The player gives up after 90 seconds, and you can pick another release.

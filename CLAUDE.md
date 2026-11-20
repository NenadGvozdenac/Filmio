# Filmio

Electron desktop app (in `desktop/`) for searching, downloading and streaming movies/series over BitTorrent. Run with `make start`.

## Rules

- No emojis anywhere (code, UI strings, comments, docs, commits). Use Lucide icons via `renderer/js/utils/icons.js`.
- UI style follows shadcn/ui (https://ui.shadcn.com): zinc tokens and component classes in `renderer/styles/main.css` (`btn btn-default|secondary|outline|ghost|destructive`, `input`, `select`, `card`, `badge`, `tabs-list`, `switch`, `slider`, `dialog`, `toast`). Reuse these instead of adding ad-hoc styles.
- Code comments in English. User-facing text goes through i18n (`renderer/js/i18n/locales/en.js` and `sr.js`); never hard-code UI strings.
- Main process layers: `models` -> `repositories` / `providers` -> `services` -> `controllers` -> `routes/ipcRoutes.js`. Errors use `AppError` codes that the renderer translates.
- CSP forbids inline `style` attributes and inline scripts; use classes, and set styles from JS via CSSOM if needed.
- No Docker, no backend, no unit tests.

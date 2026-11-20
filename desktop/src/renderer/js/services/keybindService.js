// Player keyboard shortcuts (configurable in Settings).

/** Must match DEFAULT_KEYBINDS in src/main/models/Settings.js. */
export const DEFAULT_KEYBINDS = Object.freeze({
  playPause: 'Space',
  mute: 'M',
  nextEpisode: 'N',
  previousEpisode: 'B',
  seekBack: 'ArrowLeft',
  seekForward: 'ArrowRight',
  volumeUp: 'ArrowUp',
  volumeDown: 'ArrowDown',
  fullscreen: 'F',
});

export const KEYBIND_ACTIONS = Object.keys(DEFAULT_KEYBINDS);

// Keys that cannot be bound: they control the app or the system.
const RESERVED = new Set(['Escape', 'F11', 'Tab', 'Enter', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'ContextMenu']);

const LABELS = {
  Space: 'Space',
  ArrowLeft: '←',
  ArrowRight: '→',
  ArrowUp: '↑',
  ArrowDown: '↓',
};

let keybinds = { ...DEFAULT_KEYBINDS };
const listeners = new Set();

/** KeyboardEvent -> stored key name ('Space', 'M', 'ArrowLeft', 'F5'...), or null if not bindable. */
export function keyFromEvent(event) {
  if (event.ctrlKey || event.altKey || event.metaKey) return null;
  const key = event.key === ' ' ? 'Space' : event.key;
  if (!key || RESERVED.has(key) || key === 'Dead' || key === 'Unidentified') return null;
  return key.length === 1 ? key.toUpperCase() : key;
}

/** Human readable label for a stored key. */
export const keyLabel = (key) => LABELS[key] ?? key;

export const getKeybinds = () => ({ ...keybinds });

export function setKeybinds(next) {
  keybinds = { ...DEFAULT_KEYBINDS, ...(next ?? {}) };
  for (const listener of listeners) listener(getKeybinds());
}

export function onKeybindsChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns the action bound to the pressed key, or null. */
export function actionForEvent(event) {
  const key = keyFromEvent(event);
  if (!key) return null;
  return KEYBIND_ACTIONS.find((action) => keybinds[action] === key) ?? null;
}

// Renders assets/icon.svg and assets/tray.svg into the PNG / ICO files the app uses.
// Run with: npm run icons   (uses Electron's Chromium to rasterize the SVGs)
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/** Renders an SVG to PNG buffers at the given sizes inside a hidden window. */
async function rasterize(win, svgFile, sizes) {
  const svg = fs.readFileSync(path.join(ASSETS, svgFile), 'utf8');
  const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const pngs = await win.webContents.executeJavaScript(`(async () => {
    const img = new Image();
    img.src = ${JSON.stringify(dataUrl)};
    await img.decode();
    return ${JSON.stringify(sizes)}.map((size) => {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      return canvas.toDataURL('image/png');
    });
  })()`);
  return new Map(sizes.map((size, i) => [size, Buffer.from(pngs[i].split(',')[1], 'base64')]));
}

/** Builds a Windows .ico that embeds PNG images (supported since Windows Vista). */
function buildIco(images) {
  const entries = [...images.entries()].sort((a, b) => a[0] - b[0]);
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(([size, png], i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o); // width (0 = 256)
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1); // height
    dir.writeUInt8(0, o + 2); // palette
    dir.writeUInt8(0, o + 3); // reserved
    dir.writeUInt16LE(1, o + 4); // color planes
    dir.writeUInt16LE(32, o + 6); // bits per pixel
    dir.writeUInt32LE(png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map(([, png]) => png)]);
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, width: 64, height: 64 });
  await win.loadURL('data:text/html,<html><body></body></html>');

  const icon = await rasterize(win, 'icon.svg', [16, 24, 32, 48, 64, 128, 256, 512]);
  fs.writeFileSync(path.join(ASSETS, 'icon.png'), icon.get(512));
  fs.writeFileSync(path.join(ASSETS, 'icon.ico'), buildIco(new Map([...icon].filter(([s]) => s <= 256))));

  const tray = await rasterize(win, 'tray.svg', [16, 20, 24, 32, 40, 48, 64]);
  fs.writeFileSync(path.join(ASSETS, 'tray.png'), tray.get(32));
  fs.writeFileSync(path.join(ASSETS, 'tray@2x.png'), tray.get(64));
  fs.writeFileSync(path.join(ASSETS, 'tray.ico'), buildIco(new Map([...tray].filter(([s]) => s <= 48))));

  console.log('Icons written to', ASSETS);
  app.exit(0);
});

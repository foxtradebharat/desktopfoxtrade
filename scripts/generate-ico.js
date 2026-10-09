import { app, nativeImage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

app.whenReady().then(() => {
  try {
    // White monoline fox head logo on black
    const candidateLogos = [
      path.join(rootDir, 'src', 'assets', 'logo', 'foxtrade-square-matte-black-1024.png'),
      path.join(rootDir, 'src', 'assets', 'logo', 'foxtrade-square-icon-safe-transparent-1024.png')
    ];

    const srcPath = candidateLogos.find(p => fs.existsSync(p));
    if (!srcPath) {
      console.error('Source icon not found in src/assets/logo/');
      app.exit(1);
      return;
    }

    console.log('Using logo source:', srcPath);
    const baseImg = nativeImage.createFromPath(srcPath);
    if (baseImg.isEmpty()) {
      console.error('Failed to load image from', srcPath);
      app.exit(1);
      return;
    }

    const buildDir = path.join(rootDir, 'build');
    if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir, { recursive: true });

    // Generate 512x512 icon.png for window icon, notifications, and tray
    const img512 = baseImg.resize({ width: 512, height: 512, quality: 'best' });
    const buf512 = img512.toPNG();
    fs.writeFileSync(path.join(buildDir, 'icon.png'), buf512);
    fs.writeFileSync(path.join(rootDir, 'public', 'icon.png'), buf512);
    fs.writeFileSync(path.join(rootDir, 'public', 'foxtrade-square.png'), buf512);

    const distDir = path.join(rootDir, 'dist');
    if (fs.existsSync(distDir)) {
      fs.writeFileSync(path.join(distDir, 'icon.png'), buf512);
      fs.writeFileSync(path.join(distDir, 'foxtrade-square.png'), buf512);
    }

    // Build multi-resolution ICO containing 16, 24, 32, 48, 64, 128, and 256 px sizes
    const sizes = [16, 24, 32, 48, 64, 128, 256];
    const images = sizes.map(size => {
      const resized = baseImg.resize({ width: size, height: size, quality: 'best' });
      return {
        size,
        buffer: resized.toPNG()
      };
    });

    const headerLen = 6;
    const dirEntryLen = 16;
    const totalDirLen = dirEntryLen * images.length;
    let offset = headerLen + totalDirLen;

    const dirEntries = [];
    const payloadBuffers = [];

    for (const img of images) {
      const entry = Buffer.alloc(16);
      const w = img.size >= 256 ? 0 : img.size;
      const h = img.size >= 256 ? 0 : img.size;
      entry.writeUInt8(w, 0); // width
      entry.writeUInt8(h, 1); // height
      entry.writeUInt8(0, 2); // color count
      entry.writeUInt8(0, 3); // reserved
      entry.writeUInt16LE(1, 4); // color planes
      entry.writeUInt16LE(32, 6); // bits per pixel
      entry.writeUInt32LE(img.buffer.length, 8); // image size in bytes
      entry.writeUInt32LE(offset, 12); // offset in file
      dirEntries.push(entry);

      payloadBuffers.push(img.buffer);
      offset += img.buffer.length;
    }

    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // ICO type = 1
    header.writeUInt16LE(images.length, 4); // count

    const icoBuffer = Buffer.concat([header, ...dirEntries, ...payloadBuffers]);

    const targetIcoPaths = [
      path.join(buildDir, 'icon.ico'),
      path.join(rootDir, 'public', 'favicon.ico'),
      path.join(rootDir, 'public', 'icon.ico')
    ];

    if (fs.existsSync(distDir)) {
      targetIcoPaths.push(path.join(distDir, 'favicon.ico'));
      targetIcoPaths.push(path.join(distDir, 'icon.ico'));
    }

    for (const p of targetIcoPaths) {
      fs.writeFileSync(p, icoBuffer);
      console.log('Wrote multi-resolution ICO to:', p, '(', icoBuffer.length, 'bytes)');
    }

    console.log('Successfully generated 512x512 icon.png and multi-resolution icon.ico (16-256px)!');
    app.exit(0);
  } catch (err) {
    console.error('Error generating icons:', err);
    app.exit(1);
  }
});

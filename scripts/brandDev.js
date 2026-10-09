import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const rceditPath = path.join(rootDir, 'node_modules', 'electron-winstaller', 'vendor', 'rcedit.exe');
const electronExePath = path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe');
const iconPath = path.join(rootDir, 'build', 'icon.ico');

if (process.platform === 'win32' && fs.existsSync(rceditPath) && fs.existsSync(electronExePath) && fs.existsSync(iconPath)) {
  try {
    execFileSync(rceditPath, [
      electronExePath,
      '--set-icon', iconPath,
      '--set-version-string', 'ProductName', 'FoxTrade',
      '--set-version-string', 'FileDescription', 'FoxTrade Desktop'
    ]);
    console.log('[brandDev] Successfully branded electron.exe with FoxTrade icon and metadata.');
  } catch (err) {
    console.warn('[brandDev] Could not patch electron.exe (it may be running):', err.message);
  }
} else {
  console.log('[brandDev] Skipped (not Windows or missing files).');
}

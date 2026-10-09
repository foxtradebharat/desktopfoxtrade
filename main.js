import { app, BrowserWindow, shell, Menu, powerMonitor, ipcMain, session, nativeTheme, dialog, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

// ── Windows Taskbar & Notification Identity ──────────────────────────────────
// Must be set as early as possible so Windows groups and identifies the window
// with FoxTrade's identity and custom icon in the taskbar and notification center.
app.setName('FoxTrade');
if (process.platform === 'win32') {
  try {
    app.setAppUserModelId('com.foxtrade.app');
  } catch (_) {}
}
import http from 'node:http';
import crypto from 'node:crypto';
import { getDatabase, closeDatabase } from './electron-db/database.js';
import { registerIpcHandlers } from './electron-db/ipcHandlers.js';
import { initNotificationManager, stopNotificationManager } from './electron-db/notificationManager.js';
import { initAutoUpdater, stopAutoUpdater, checkForUpdates, installUpdate, getCurrentUpdateState } from './updater.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const devServerUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';

// ── Clean Google-compatible User-Agent ───────────────────────────────────────
// Google blocks OAuth in Electron if "Electron/" appears in the User-Agent header (Error 403: disallowed_useragent)
const cleanUserAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
app.userAgentFallback = cleanUserAgent;

let mainWindow = null;
let staticServer = null;
let staticServerPort = 39281;

// ── Embedded Production Static Server ─────────────────────────────────────────
// Serves dist/ on http://localhost:<port> so Firebase Auth recognizes localhost as an authorized domain
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
};

function startProductionServer() {
  return new Promise((resolve) => {
    const distDir = path.join(__dirname, 'dist');
    const server = http.createServer((req, res) => {
      try {
        const parsedUrl = new URL(req.url, 'http://localhost');

        // CORS Preflight
        if (req.method === 'OPTIONS') {
          res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
          });
          res.end();
          return;
        }

        // Handle Browser OAuth Completion Notification
        if (req.method === 'POST' && parsedUrl.pathname === '/api/auth-complete') {
          let body = '';
          req.on('data', chunk => { body += chunk; });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body);
              handleBrowserAuthPayload(payload);
              res.writeHead(200, {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              });
              res.end(JSON.stringify({ success: true }));
            } catch (err) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        let pathname = decodeURIComponent(parsedUrl.pathname);
        if (!pathname || pathname === '/') {
          pathname = '/index.html';
        } else if (pathname === '/desktop-login') {
          pathname = '/desktop-login.html';
        } else if (pathname === '/auth-browser') {
          pathname = '/auth-browser.html';
        }

        const safeRel = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
        let filePath = path.join(distDir, safeRel);

        if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
          const publicPath = path.join(__dirname, 'public', safeRel);
          if (fs.existsSync(publicPath) && !fs.statSync(publicPath).isDirectory()) {
            filePath = publicPath;
          } else {
            filePath = path.join(distDir, 'index.html');
          }
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        fs.createReadStream(filePath).pipe(res);
      } catch (err) {
        if (!res.headersSent) res.writeHead(500);
        res.end();
      }
    });

    server.listen(39281, '127.0.0.1', () => {
      staticServerPort = server.address().port;
      console.log(`[Main Process] Production server active at http://localhost:${staticServerPort}`);
      resolve(staticServerPort);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(0, '127.0.0.1', () => {
          staticServerPort = server.address().port;
          console.log(`[Main Process] Production server fallback port http://localhost:${staticServerPort}`);
          resolve(staticServerPort);
        });
      } else {
        console.error('[Main Process] Static server error:', err);
        resolve(39281);
      }
    });

    staticServer = server;
  });
}

// ── Register foxtrade:// Custom URI Protocol ─────────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('foxtrade', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('foxtrade');
}

let pendingAuthResolver = null;

function handleBrowserAuthPayload(payload) {
  if (!payload || !payload.user) return;
  console.log('[Main Process] Successfully authenticated user from browser:', payload.user.email);
  if (pendingAuthResolver) {
    pendingAuthResolver(payload);
    pendingAuthResolver = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.setAlwaysOnTop(true);
    mainWindow.show();
    mainWindow.focus();
    mainWindow.setAlwaysOnTop(false);
    mainWindow.webContents.send('auth:browser-success', payload);
  }
}

function handleProtocolUrl(urlStr) {
  try {
    if (!urlStr) return;
    const cleanStr = urlStr.replace(/^["']|["']$/g, '').trim();
    if (!cleanStr.startsWith('foxtrade://')) return;
    console.log('[Main Process] Received protocol URL:', cleanStr);

    const questionIndex = cleanStr.indexOf('?');
    if (questionIndex !== -1) {
      const queryStr = cleanStr.substring(questionIndex + 1);
      const params = new URLSearchParams(queryStr);
      const userParam = params.get('user');
      if (userParam) {
        const user = JSON.parse(decodeURIComponent(userParam));
        handleBrowserAuthPayload({ user });
      }
    }
  } catch (err) {
    console.error('[Main Process] Error parsing protocol URL:', err);
  }
}

// ── 1. Single-Instance Lock ──────────────────────────────────────────────────
// Prevent multiple Electron instances from locking or corrupting the SQLite DB.
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  console.log('[Main Process] Another instance of FoxTrade is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', (_event, commandLine) => {
    console.log('[Main Process] Second instance attempted. Focusing active window.');
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.setAlwaysOnTop(true);
      mainWindow.show();
      mainWindow.focus();
      mainWindow.setAlwaysOnTop(false);
    }
    const url = commandLine.find(arg => typeof arg === 'string' && (arg.startsWith('foxtrade://') || arg.startsWith('"foxtrade://')));
    if (url) {
      handleProtocolUrl(url);
    }
  });

  initAppLifecycle();
}

function resolveAppIcon() {
  const candidates = [
    // Packaged extraResources
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(process.resourcesPath || '', 'build', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.png'),
    // Local / Dev paths
    path.join(__dirname, 'build', 'icon.ico'),
    path.join(__dirname, 'public', 'favicon.ico'),
    path.join(__dirname, 'dist', 'favicon.ico'),
    path.join(__dirname, 'dist', 'icon.ico'),
    path.join(__dirname, 'public', 'icon.ico'),
    path.join(__dirname, 'build', 'icon.png'),
    path.join(__dirname, 'public', 'icon.png'),
    path.join(__dirname, 'public', 'foxtrade-square.png'),
    path.join(__dirname, 'dist', 'foxtrade-square.png'),
    path.join(__dirname, 'src', 'assets', 'logo', 'foxtrade-square-matte-black-1024.png'),
    path.join(__dirname, 'src', 'assets', 'logo', 'foxtrade-square-icon-safe-transparent-1024.png'),
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createWindow() {
  const iconPath = resolveAppIcon();
  let appIcon = undefined;
  if (iconPath) {
    try {
      appIcon = nativeImage.createFromPath(iconPath);
    } catch (err) {
      console.warn('[Main Process] Could not load nativeImage icon:', err);
    }
  }

  mainWindow = new BrowserWindow({
    title: 'FoxTrade',
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#181818' : '#ffffff',
    icon: (appIcon && !appIcon.isEmpty()) ? appIcon : iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (appIcon && !appIcon.isEmpty()) {
    try {
      mainWindow.setIcon(appIcon);
    } catch (_) {}
  }

  mainWindow.on('maximize', () => {
    mainWindow?.webContents.send('window:maximized-change', true);
  });

  mainWindow.on('unmaximize', () => {
    mainWindow?.webContents.send('window:maximized-change', false);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // Safety fallback: ensure window shows within 1.5 seconds
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1500);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Main Process] Window failed to load URL: ${validatedURL} (Error ${errorCode}: ${errorDescription})`);
  });

  // Handle external links: open in system default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocalHost = url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:');
    if (!isLocalHost && (url.startsWith('http:') || url.startsWith('https:'))) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  if (isDev) {
    mainWindow.loadURL(devServerUrl).catch(() => {
      mainWindow.loadURL(`http://localhost:${staticServerPort}`);
    });
  } else {
    mainWindow.loadURL(`http://localhost:${staticServerPort}`);
  }

  return mainWindow;
}

function registerSystemIpc() {
  // ── 2. Windows Startup Auto-Launch ─────────────────────────────────────────
  ipcMain.handle('system:getAutoLaunch', async () => {
    try {
      const settings = app.getLoginItemSettings();
      return settings.openAtLogin;
    } catch (err) {
      console.error('[IPC system:getAutoLaunch Error]', err);
      return false;
    }
  });

  ipcMain.handle('system:setAutoLaunch', async (_event, enabled) => {
    try {
      app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        openAsHidden: false,
      });
      const settings = app.getLoginItemSettings();
      console.log(`[Main Process] Windows Startup Auto-Launch set to: ${settings.openAtLogin}`);
      return settings.openAtLogin;
    } catch (err) {
      console.error('[IPC system:setAutoLaunch Error]', err);
      return false;
    }
  });

  // ── 5. System-Browser Google OAuth (Loopback Server Flow) ─────────────────
  let activeLoopbackServer = null;
  let activeLoopbackTimer = null;

  function cleanupLoopbackAuth() {
    if (activeLoopbackTimer) {
      clearTimeout(activeLoopbackTimer);
      activeLoopbackTimer = null;
    }
    if (activeLoopbackServer) {
      try {
        activeLoopbackServer.close();
      } catch (_) {}
      activeLoopbackServer = null;
    }
  }

  const handleDesktopAuthStart = () => {
    return new Promise((resolve) => {
      cleanupLoopbackAuth();

      // 1. Generate random state nonce
      const stateNonce = crypto.randomBytes(16).toString('hex');

      // 2. Start temporary local HTTP server on 127.0.0.1 with random free port (0)
      const loopbackServer = http.createServer((req, res) => {
        try {
          const loopbackPort = loopbackServer.address()?.port;
          const reqUrl = new URL(req.url, `http://127.0.0.1:${loopbackPort}`);

          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
          }

          if (reqUrl.pathname === '/callback') {
            const receivedState = reqUrl.searchParams.get('state');
            if (!receivedState || receivedState !== stateNonce) {
              console.warn('[Loopback Auth] State mismatch or missing nonce.');
              res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
              res.end(`
                <!DOCTYPE html>
                <html>
                <head><meta charset="utf-8"><title>FoxTrade - State Verification Failed</title></head>
                <body style="font-family: system-ui, sans-serif; padding: 40px; text-align: center;">
                  <h2>Security Verification Failed</h2>
                  <p>Invalid or expired state nonce. Please return to FoxTrade and try again.</p>
                </body>
                </html>
              `);
              return;
            }

            const idToken = reqUrl.searchParams.get('id_token') || '';
            const firebaseToken = reqUrl.searchParams.get('firebase_token') || '';
            const uid = reqUrl.searchParams.get('uid') || '';
            const email = reqUrl.searchParams.get('email') || '';
            const displayName = reqUrl.searchParams.get('displayName') || 'Trader';
            const photoURL = reqUrl.searchParams.get('photoURL') || '';

            // 3. Return clean "Login successful, return to app" HTML page
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <!DOCTYPE html>
              <html lang="en">
              <head>
                <meta charset="utf-8" />
                <meta name="viewport" content="width=device-width, initial-scale=1.0" />
                <title>FoxTrade - Login Successful</title>
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    margin: 0;
                    background-color: #f9fafb;
                    color: #111827;
                  }
                  .card {
                    background: #ffffff;
                    border: 1px solid #e5e7eb;
                    border-radius: 16px;
                    padding: 40px 32px;
                    text-align: center;
                    max-width: 420px;
                    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.06);
                  }
                  .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background-color: #ecfdf5;
                    color: #065f46;
                    border: 1px solid #a7f3d0;
                    padding: 6px 14px;
                    border-radius: 9999px;
                    font-size: 13px;
                    font-weight: 600;
                    margin-bottom: 16px;
                  }
                  h2 { margin: 0 0 8px 0; font-size: 20px; font-weight: 700; color: #111827; }
                  p { color: #6b7280; font-size: 14px; margin: 0; line-height: 1.5; }
                </style>
              </head>
              <body>
                <div class="card">
                  <div class="badge">✓ Authentication Successful</div>
                  <h2>Welcome to FoxTrade</h2>
                  <p>Login complete! You can return to FoxTrade now. You may close this tab.</p>
                </div>
                <script>
                  setTimeout(() => { window.close(); }, 2000);
                </script>
              </body>
              </html>
            `);

            const resultPayload = {
              success: true,
              idToken,
              firebaseToken,
              user: {
                uid,
                email,
                displayName,
                photoURL
              }
            };

            // 4. Close loopback server immediately
            cleanupLoopbackAuth();

            // 5. Bring app window to front
            if (mainWindow && !mainWindow.isDestroyed()) {
              if (mainWindow.isMinimized()) mainWindow.restore();
              mainWindow.setAlwaysOnTop(true);
              mainWindow.show();
              mainWindow.focus();
              mainWindow.setAlwaysOnTop(false);
              mainWindow.webContents.send('desktopAuth:result', resultPayload);
              mainWindow.webContents.send('auth:browser-success', resultPayload);
            }

            resolve(resultPayload);
          } else {
            res.writeHead(404);
            res.end('Not Found');
          }
        } catch (err) {
          console.error('[Main Process] Loopback auth request error:', err);
          if (!res.headersSent) res.writeHead(500);
          res.end();
        }
      });

      loopbackServer.listen(0, '127.0.0.1', () => {
        activeLoopbackServer = loopbackServer;
        const loopbackPort = loopbackServer.address().port;
        const staticPort = staticServerPort || 39281;

        // Open hosted login page with state and loopback callback port
        const authUrl = `http://localhost:${staticPort}/desktop-login.html?state=${stateNonce}&port=${loopbackPort}`;
        console.log(`[Main Process] Opening system browser for Google OAuth: ${authUrl}`);
        shell.openExternal(authUrl);

        // 2-minute safety timeout
        activeLoopbackTimer = setTimeout(() => {
          cleanupLoopbackAuth();
          resolve({ error: 'Authentication timed out. Please try again.' });
        }, 120000);
      });

      loopbackServer.on('error', (err) => {
        console.error('[Main Process] Failed to bind loopback server:', err);
        cleanupLoopbackAuth();
        resolve({ error: 'Failed to start authentication loopback server.' });
      });
    });
  };

  ipcMain.handle('desktopAuth:start', async () => handleDesktopAuthStart());
  ipcMain.handle('desktopAuth:cancel', async () => {
    cleanupLoopbackAuth();
    return { cancelled: true };
  });
  ipcMain.handle('auth:startBrowserLogin', async () => handleDesktopAuthStart());

  // ── 6. Window Controls (Frameless Title Bar) ───────────────────────────────
  ipcMain.handle('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  });

  ipcMain.handle('window:toggleMaximize', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    } else {
      mainWindow.maximize();
      return true;
    }
  });

  ipcMain.handle('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:isMaximized', () => {
    return mainWindow?.isMaximized() || false;
  });

  // ── 7. OS-Aware Appearance (System Theme Synchronization) ───────────────────
  ipcMain.handle('theme:getSystemTheme', () => {
    return { isDark: nativeTheme.shouldUseDarkColors };
  });

  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('theme:system-changed', {
        isDark: nativeTheme.shouldUseDarkColors
      });
    }
  });

}

function setupApplicationMenu() {
  const isMac = process.platform === 'darwin';
  const updateState = getCurrentUpdateState();
  const hasUpdateReady = updateState.status === 'downloaded' && updateState.version;

  const helpSubmenu = [
    ...(hasUpdateReady ? [
      {
        label: `Restart to update v${updateState.version}`,
        click: () => installUpdate()
      },
      { type: 'separator' }
    ] : []),
    { label: 'FoxTrade Website', click: () => shell.openExternal('https://foxtrade.in') },
    { label: 'Foxy AI Guide', click: () => mainWindow?.webContents.send('menu:foxy-guide') },
    { type: 'separator' },
    {
      label: 'Check for Updates...',
      click: () => {
        checkForUpdates(true);
        mainWindow?.webContents.send('menu:check-updates');
      }
    },
    {
      label: 'Open Logs Folder',
      click: () => {
        const logsDir = path.join(app.getPath('userData'), 'logs');
        if (fs.existsSync(logsDir)) {
          shell.openPath(logsDir);
        }
      }
    },
    { type: 'separator' },
    {
      label: `About FoxTrade (${app.getVersion()})`,
      click: () => {
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'About FoxTrade',
          message: `FoxTrade v${app.getVersion()}`,
          detail: `Electron: ${process.versions.electron}\nChromium: ${process.versions.chrome}\nNode.js: ${process.versions.node}\nOS: ${process.platform} ${process.arch}\n\nYour trading data and local database are backed up safely.`,
          buttons: ['OK']
        });
        mainWindow?.webContents.send('menu:about');
      }
    }
  ];

  const template = [
    ...(isMac ? [{
      label: 'FoxTrade',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { label: 'Check for Updates...', click: () => { checkForUpdates(true); mainWindow?.webContents.send('menu:check-updates'); } },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('menu:open-settings') },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : [{
      label: 'FoxTrade',
      submenu: [
        { label: `Version ${app.getVersion()}`, enabled: false },
        { label: 'Check for Updates...', click: () => { checkForUpdates(true); mainWindow?.webContents.send('menu:check-updates'); } },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => mainWindow?.webContents.send('menu:open-settings') },
        { type: 'separator' },
        { label: 'Exit FoxTrade', accelerator: 'Alt+F4', click: () => app.quit() }
      ]
    }]),
    {
      label: 'File',
      submenu: [
        { label: 'New Trade', accelerator: 'CmdOrCtrl+N', click: () => mainWindow?.webContents.send('menu:new-trade') },
        { label: 'Import Trades (CSV)...', accelerator: 'CmdOrCtrl+O', click: () => mainWindow?.webContents.send('menu:import-trades') },
        { type: 'separator' },
        { label: 'Backup to Google Drive', click: () => mainWindow?.webContents.send('menu:backup-drive') },
        { label: 'Restore from Backup', click: () => mainWindow?.webContents.send('menu:restore-backup') },
        { type: 'separator' },
        isMac ? { role: 'close' } : { label: 'Close Window', accelerator: 'CmdOrCtrl+W', click: () => mainWindow?.close() }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle Theme', click: () => mainWindow?.webContents.send('menu:toggle-theme') },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { role: 'reload' },
        { role: 'forceReload' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      label: 'Help',
      submenu: helpSubmenu
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function initAppLifecycle() {
  app.whenReady().then(async () => {
    // Intercept headers to ensure Google OAuth sees pure Chrome User-Agent
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = cleanUserAgent;
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    // Start local server to serve auth-browser.html and static assets
    try {
      await startProductionServer();
    } catch (err) {
      console.error('[Main Process] Failed to start local server:', err);
    }

    // Initialize local SQLite database & register IPC handlers
    try {
      getDatabase();
      registerIpcHandlers();
      registerSystemIpc();
      console.log('[Main Process] SQLite Database and IPC handlers initialized successfully.');
    } catch (err) {
      console.error('[Main Process] Failed to initialize SQLite database:', err);
    }

    createWindow();
    setupApplicationMenu();

    // ── 5. Production Auto-Update Engine ────────────────────────────────────
    try {
      initAutoUpdater(mainWindow);
      ipcMain.on('update:state-change', () => {
        setupApplicationMenu();
      });
    } catch (err) {
      console.error('[Main Process] Failed to initialize auto-updater:', err);
    }

    // ── 4. Native Windows Notifications & Market Scheduler ───────────────────
    try {
      initNotificationManager(mainWindow, resolveAppIcon);
    } catch (err) {
      console.error('[Main Process] Failed to initialize notification manager:', err);
    }

    // ── 3. Power & Sleep Resilience ──────────────────────────────────────────
    powerMonitor.on('suspend', () => {
      console.log('[PowerMonitor] System going to sleep. Suspending background sync & polling.');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system:power-suspend');
      }
    });

    powerMonitor.on('resume', () => {
      console.log('[PowerMonitor] System resumed from sleep. Resuming background sync & live feeds.');
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('system:power-resume');
      }
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('will-quit', () => {
    try {
      if (staticServer) {
        staticServer.close();
      }
      stopAutoUpdater();
      stopNotificationManager();
      closeDatabase();
    } catch (err) {
      console.error('[Main Process] Error closing SQLite database or notification manager:', err);
    }
  });
}

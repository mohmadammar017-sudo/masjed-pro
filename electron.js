const { app, BrowserWindow, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const url = require('url');
const fs = require('fs');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const express = require('express');
const { Server: SocketIOServer } = require('socket.io');
const QRCode = require('qrcode');
const fsp = require('fs/promises');
const packageJson = require('./package.json');

const STARTUP_LOG_FILE = path.join(os.tmpdir(), 'masjid-display-startup.log');

function appendStartupLog(message, error) {
  try {
    const details = error
      ? `\n${error && error.stack ? error.stack : String(error)}`
      : '';
    fs.appendFileSync(STARTUP_LOG_FILE, `[${new Date().toISOString()}] ${message}${details}\n`, 'utf8');
  } catch (_) {
    // Logging must never block app startup.
  }
}

process.on('uncaughtException', (error) => {
  appendStartupLog('Uncaught exception', error);
});

process.on('unhandledRejection', (reason) => {
  appendStartupLog('Unhandled rejection', reason);
});

// Keep mosque text crisp on large displays and let Chromium favor GPU-backed rasterization.
app.commandLine.appendSwitch('high-dpi-support', '1');
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('enable-zero-copy');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// --- CONSTANTS & CONFIG ---
const USER_DATA_PATH = app.getPath('userData');
const SETTINGS_FILE = path.join(USER_DATA_PATH, 'window-settings.json');
const ZOOM_LEVELS = [0.5, 0.67, 0.75, 0.8, 0.85, 0.9, 0.95, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0];
const RENDERER_DEV_PORT = Number(process.env.MASJID_RENDERER_DEV_PORT || 5173);
const RENDERER_DEV_URL = process.env.MASJID_RENDERER_DEV_URL || `http://localhost:${RENDERER_DEV_PORT}`;
const MOBILE_CONTROL_PORT = 3000;
const MOBILE_CONTROL_PIN = String(process.env.MASJID_REMOTE_PIN || '1234');
const REMOTE_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const APP_ICON_PATH = path.join(__dirname, 'public', 'icon.ico');
const resolveLaunchRoute = () => {
  const envRoute = String(process.env.MASJID_LAUNCH_ROUTE || '').trim().toLowerCase();
  if (envRoute === 'admin') return 'admin';

  const packageRoute = String(packageJson.masjidLaunchRoute || '').trim().toLowerCase();
  if (packageRoute === 'admin') return 'admin';

  return 'display';
};
const APP_LAUNCH_ROUTE = resolveLaunchRoute();
const IS_ADMIN_LAUNCH = APP_LAUNCH_ROUTE === 'admin';
const REMOTE_COMMAND_SET = new Set([
  'NEXT_SURAH',
  'PREVIOUS_SURAH',
  'PLAY_QURAN',
  'STOP_QURAN',
  'NEXT_DUA',
  'PREVIOUS_DUA',
  'CHANGE_MODE',
  'GO_HOME',
  'BACK',
  'NEXT_PAGE',
  'PREVIOUS_PAGE',
  'SET_DUA_ACTIVE',
  'PREVIEW_DUA',
  'MOVE_DUA',
  'SET_DUA_SLOTS',
  'SET_DUA_LINE_DURATION',
  'SET_DUA_FONT_SCALE',
  'SET_QURAN_RECITER',
  'SET_QURAN_TRACK_INDEX',
  'SET_IMAM_NAME',
  'SET_PRAYER_TIME',
  'SET_HOME_BACKGROUND_COLOR',
  'SET_HOME_OVERLAY_COLOR',
  'SET_HOME_OVERLAY_OPACITY',
  'SET_HOME_BACKGROUND_IMAGE_URL',
  'SET_APP_ZOOM'
]);
const REMOTE_MODE_SET = new Set(['PRAYER', 'DUA', 'QURAN']);

let mainWindow;
let remoteHttpServer = null;
let remoteSocketServer = null;
let remoteSessionCleanupTimer = null;
const remoteSessionTokens = new Map();

// --- ZOOM STATE MANAGEMENT ---
let zoomState = {
  factor: 1.0,
  auto: true
};

let saveSettingsTimer = null;

const remoteControlState = {
  running: false,
  ipAddress: '127.0.0.1',
  port: MOBILE_CONTROL_PORT,
  url: `http://127.0.0.1:${MOBILE_CONTROL_PORT}`,
  qrCodeDataUrl: null,
  pin: MOBILE_CONTROL_PIN,
  clientCount: 0
};
let remoteRendererState = {
  updatedAt: 0
};

// 1. Load Saved Settings on Startup
async function loadSettings() {
  try {
    const content = await fsp.readFile(SETTINGS_FILE, 'utf8');
    const data = JSON.parse(content);
    if (data.zoom) {
      zoomState = data.zoom;
      console.log(`[Zoom] Loaded saved zoom: ${zoomState.factor} (Auto: ${zoomState.auto})`);
    }
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      zoomState.factor = getSmartZoomFactor();
      zoomState.auto = true;
      await persistSettings();
      return;
    }

    console.error('[Zoom] Failed to load settings:', e);
    // Fallback
    zoomState.factor = 1.0;
  }
}

async function persistSettings() {
  try {
    await fsp.writeFile(SETTINGS_FILE, JSON.stringify({ zoom: zoomState }), 'utf8');
  } catch (e) {
    console.error('[Zoom] Failed to save settings:', e);
  }
}

function saveSettings() {
  if (saveSettingsTimer) clearTimeout(saveSettingsTimer);
  saveSettingsTimer = setTimeout(() => {
    void persistSettings();
  }, 120);
}

// 2. Smart Screen Detection
function getSmartZoomFactor() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width } = primaryDisplay.workAreaSize;

  console.log(`[Zoom] Detecting Screen Width: ${width}px`);

  if (width >= 3840) return 1.5; // 4K
  if (width >= 2560) return 1.25; // 2K
  if (width <= 1024) return 0.75; // 10-inch / Small Tablet
  if (width <= 1280) return 0.85; // Small Laptop

  return 1.0; // Standard Full HD
}

// 3. Apply Zoom to A Window
function applyZoom(win) {
  if (win && !win.isDestroyed()) {
    win.webContents.setZoomFactor(win.__masjidIsAdmin ? 1.0 : zoomState.factor);
  }
}

// 4. Global Zoom Setter
function setGlobalZoom(factor, isAuto = false) {
  // If manual adjustment is very precise (slider), use it. If keyboard, use snapped.
  zoomState.factor = factor;
  zoomState.auto = isAuto;

  saveSettings();

  // Apply to ALL windows (Main + Children)
  BrowserWindow.getAllWindows().forEach(applyZoom);

  if (remoteSocketServer) {
    remoteRendererState = {
      ...remoteRendererState,
      zoom: {
        factor: zoomState.factor,
        auto: zoomState.auto
      },
      updatedAt: Date.now()
    };
    remoteSocketServer.emit('state', remoteRendererState);
  }
}

// 5. Calculate Next/Prev Zoom Step
function adjustZoomStep(direction) {
  // Find closest current step index
  let currentIndex = ZOOM_LEVELS.findIndex((z) => z >= zoomState.factor);
  if (currentIndex === -1) currentIndex = ZOOM_LEVELS.length - 1;

  let newIndex = currentIndex + direction;

  // Clamp
  if (newIndex < 0) newIndex = 0;
  if (newIndex >= ZOOM_LEVELS.length) newIndex = ZOOM_LEVELS.length - 1;

  setGlobalZoom(ZOOM_LEVELS[newIndex], false);
}

function getLanIPv4Addresses() {
  const interfaces = os.networkInterfaces();
  const collected = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry) return;
      if (entry.family !== 'IPv4') return;
      if (entry.internal) return;
      if (entry.address.startsWith('169.254.')) return;
      collected.push(entry.address);
    });
  });

  const scoreAddress = (value) => {
    if (value.startsWith('192.168.')) return 1;
    if (value.startsWith('10.')) return 2;
    const match = value.match(/^172\.(\d+)\./);
    if (match) {
      const subnet = Number(match[1]);
      if (subnet >= 16 && subnet <= 31) return 3;
    }
    return 9;
  };

  return [...new Set(collected)].sort((left, right) => scoreAddress(left) - scoreAddress(right));
}

function getPreferredLanIPv4Address() {
  const addresses = getLanIPv4Addresses();
  return addresses[0] || '127.0.0.1';
}

function getRemoteControlStaticRoot() {
  const buildRoot = path.join(__dirname, 'build');
  const publicRoot = path.join(__dirname, 'public');
  const isDev = process.env.NODE_ENV === 'development';

  if (isDev && fs.existsSync(path.join(publicRoot, 'mobile-control.html'))) {
    return publicRoot;
  }

  if (fs.existsSync(path.join(buildRoot, 'mobile-control.html'))) {
    return buildRoot;
  }

  if (fs.existsSync(path.join(publicRoot, 'mobile-control.html'))) {
    return publicRoot;
  }

  return buildRoot;
}

function pruneExpiredRemoteSessions() {
  const now = Date.now();
  for (const [token, expiresAt] of remoteSessionTokens.entries()) {
    if (expiresAt <= now) {
      remoteSessionTokens.delete(token);
    }
  }
}

function createRemoteSessionToken() {
  pruneExpiredRemoteSessions();
  const token = crypto.randomBytes(24).toString('hex');
  remoteSessionTokens.set(token, Date.now() + REMOTE_SESSION_TTL_MS);
  return token;
}

function isValidRemoteSessionToken(token) {
  if (typeof token !== 'string' || !token) return false;
  const expiresAt = remoteSessionTokens.get(token);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    remoteSessionTokens.delete(token);
    return false;
  }
  return true;
}

function getRemoteControlStatusPayload() {
  return {
    running: remoteControlState.running,
    ipAddress: remoteControlState.ipAddress,
    port: remoteControlState.port,
    url: remoteControlState.url,
    qrCodeDataUrl: remoteControlState.qrCodeDataUrl,
    pin: remoteControlState.pin,
    clientCount: remoteControlState.clientCount
  };
}

function emitRemoteControlStatus() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('remote-control:status', getRemoteControlStatusPayload());
}

function emitRemoteControlCommand(commandPayload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('remote-control:command', commandPayload);
}

function getRemoteRendererStatePayload() {
  return {
    ...remoteRendererState,
    zoom: {
      factor: zoomState.factor,
      auto: zoomState.auto
    }
  };
}

function setRemoteRendererState(nextState) {
  if (!nextState || typeof nextState !== 'object' || Array.isArray(nextState)) return;
  remoteRendererState = {
    ...nextState,
    zoom: {
      factor: zoomState.factor,
      auto: zoomState.auto
    },
    updatedAt: Date.now()
  };

  if (remoteSocketServer) {
    remoteSocketServer.emit('state', remoteRendererState);
  }
}

function extractRemoteSessionTokenFromRequest(req) {
  const authHeader = typeof req.headers?.authorization === 'string' ? req.headers.authorization : '';
  if (authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const queryToken = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
  if (queryToken) return queryToken;

  const bodyToken = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  return bodyToken;
}

function normalizeRemoteCommandPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== 'object') return null;

  const command = typeof rawPayload.command === 'string' ? rawPayload.command.trim().toUpperCase() : '';
  if (!REMOTE_COMMAND_SET.has(command)) {
    return null;
  }

  const basePayload =
    rawPayload.payload && typeof rawPayload.payload === 'object' && !Array.isArray(rawPayload.payload)
      ? { ...rawPayload.payload }
      : {};

  const normalized = {
    command,
    payload: basePayload
  };

  if (command === 'CHANGE_MODE') {
    const candidateMode =
      typeof rawPayload.mode === 'string'
        ? rawPayload.mode
        : rawPayload.payload && typeof rawPayload.payload.mode === 'string'
          ? rawPayload.payload.mode
          : '';
    const mode = candidateMode.trim().toUpperCase();
    if (!REMOTE_MODE_SET.has(mode)) {
      return null;
    }
    normalized.payload.mode = mode;
  }

  return normalized;
}

async function startRemoteControlServer() {
  if (remoteHttpServer) return;

  const lanAddresses = getLanIPv4Addresses();
  const preferredAddress = getPreferredLanIPv4Address();
  remoteControlState.ipAddress = preferredAddress;
  remoteControlState.url = `http://${preferredAddress}:${MOBILE_CONTROL_PORT}`;
  remoteControlState.port = MOBILE_CONTROL_PORT;
  remoteControlState.pin = MOBILE_CONTROL_PIN;
  remoteControlState.qrCodeDataUrl = null;
  remoteControlState.clientCount = 0;
  remoteControlState.running = false;

  const remoteControlStaticRoot = getRemoteControlStaticRoot();
  const remoteControlApp = express();
  remoteControlApp.disable('x-powered-by');
  remoteControlApp.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  });
  remoteControlApp.use(express.json({ limit: '24kb' }));
  remoteControlApp.use(express.urlencoded({ extended: false }));
  remoteControlApp.use(express.static(remoteControlStaticRoot, { index: false, maxAge: 0 }));

  remoteControlApp.get('/', (req, res) => {
    res.sendFile(path.join(remoteControlStaticRoot, 'mobile-control.html'));
  });

  remoteControlApp.post('/api/auth', (req, res) => {
    const providedPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (providedPin !== MOBILE_CONTROL_PIN) {
      res.status(401).json({ ok: false, message: 'Invalid PIN.' });
      return;
    }

    const token = createRemoteSessionToken();
    res.json({
      ok: true,
      token,
      expiresInMs: REMOTE_SESSION_TTL_MS
    });
  });

  remoteControlApp.get('/api/health', (req, res) => {
    res.json({ ok: true, clients: remoteControlState.clientCount });
  });

  remoteControlApp.get('/api/state', (req, res) => {
    const token = extractRemoteSessionTokenFromRequest(req);
    if (!isValidRemoteSessionToken(token)) {
      res.status(401).json({ ok: false, message: 'Unauthorized.' });
      return;
    }

    res.json({
      ok: true,
      state: getRemoteRendererStatePayload()
    });
  });

  const server = http.createServer(remoteControlApp);
  const io = new SocketIOServer(server, {
    cors: {
      origin: true,
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const authToken = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : '';
    const queryToken = typeof socket.handshake.query?.token === 'string' ? socket.handshake.query.token : '';
    const token = authToken || queryToken;

    if (!isValidRemoteSessionToken(token)) {
      next(new Error('UNAUTHORIZED'));
      return;
    }

    next();
  });

  io.on('connection', (socket) => {
    remoteControlState.clientCount = io.engine.clientsCount;
    emitRemoteControlStatus();
    socket.emit('state', getRemoteRendererStatePayload());

    socket.on('command', (rawPayload) => {
      const normalized = normalizeRemoteCommandPayload(rawPayload);
      if (!normalized) return;
      emitRemoteControlCommand({
        ...normalized,
        source: socket.id,
        receivedAt: Date.now()
      });
    });

    socket.on('disconnect', () => {
      remoteControlState.clientCount = io.engine.clientsCount;
      emitRemoteControlStatus();
    });
  });

  await new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(MOBILE_CONTROL_PORT, '0.0.0.0');
  });

  remoteHttpServer = server;
  remoteSocketServer = io;
  remoteControlState.running = true;
  remoteControlState.clientCount = io.engine.clientsCount;

  try {
    remoteControlState.qrCodeDataUrl = await QRCode.toDataURL(remoteControlState.url, {
      margin: 1,
      width: 320,
      errorCorrectionLevel: 'M'
    });
  } catch (error) {
    console.error('[Mobile Control] Failed to generate QR code:', error);
  }

  if (remoteSessionCleanupTimer) {
    clearInterval(remoteSessionCleanupTimer);
  }
  remoteSessionCleanupTimer = setInterval(pruneExpiredRemoteSessions, 60 * 1000);
  if (typeof remoteSessionCleanupTimer.unref === 'function') {
    remoteSessionCleanupTimer.unref();
  }

  console.log('[Mobile Control] Server started.');
  if (lanAddresses.length > 0) {
    console.log('[Mobile Control] Connect from phone using:');
    lanAddresses.forEach((address) => {
      console.log(`  http://${address}:${MOBILE_CONTROL_PORT}`);
    });
  } else {
    console.log(`[Mobile Control] Connect from phone using: ${remoteControlState.url}`);
  }
  console.log(`[Mobile Control] PIN: ${MOBILE_CONTROL_PIN}`);

  emitRemoteControlStatus();
}

async function stopRemoteControlServer() {
  if (remoteSessionCleanupTimer) {
    clearInterval(remoteSessionCleanupTimer);
    remoteSessionCleanupTimer = null;
  }

  remoteSessionTokens.clear();

  if (remoteSocketServer) {
    await new Promise((resolve) => {
      remoteSocketServer.close(() => resolve());
    });
    remoteSocketServer = null;
  }

  if (remoteHttpServer) {
    await new Promise((resolve) => {
      remoteHttpServer.close(() => resolve());
    });
    remoteHttpServer = null;
  }

  remoteControlState.running = false;
  remoteControlState.clientCount = 0;
  emitRemoteControlStatus();
}

function createWindow() {
  const isAdminWindow = IS_ADMIN_LAUNCH;
  mainWindow = new BrowserWindow({
    width: isAdminWindow ? 1600 : 1200,
    height: isAdminWindow ? 980 : 800,
    minWidth: isAdminWindow ? 1280 : 1024,
    minHeight: isAdminWindow ? 820 : 768,
    frame: true,
    fullscreen: !isAdminWindow,
    focusable: true,
    autoHideMenuBar: true,
    backgroundColor: '#020617',
    icon: fs.existsSync(APP_ICON_PATH) ? APP_ICON_PATH : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  mainWindow.__masjidIsAdmin = isAdminWindow;

  const isDev = process.env.NODE_ENV === 'development';
  const baseUrl = isDev
    ? RENDERER_DEV_URL
    : url.format({
        pathname: path.join(__dirname, 'build/index.html'),
        protocol: 'file:',
        slashes: true
      });
  const startUrl = isAdminWindow ? `${baseUrl}#/admin` : baseUrl;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // --- CRITICAL ZOOM HANDLERS ---

  // A. Apply zoom immediately when content loads
  mainWindow.webContents.on('did-finish-load', () => {
    applyZoom(mainWindow);
    emitRemoteControlStatus();
    mainWindow.focus();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Renderer] Failed to load:', { errorCode, errorDescription, validatedURL });
  });

  // B. Native Keyboard Shortcuts (Chrome Behavior)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.type === 'keyDown') {
      if (isAdminWindow && (input.key === '+' || input.key === '=' || input.key === '-' || input.key === '0')) {
        event.preventDefault();
        return;
      }
      // Zoom In (Ctrl + or Ctrl =)
      if (input.key === '+' || input.key === '=') {
        event.preventDefault();
        adjustZoomStep(1);
      }
      // Zoom Out (Ctrl -)
      if (input.key === '-') {
        event.preventDefault();
        adjustZoomStep(-1);
      }
      // Reset Zoom (Ctrl 0)
      if (input.key === '0') {
        event.preventDefault();
        const smart = getSmartZoomFactor();
        setGlobalZoom(smart, true);
      }
    }
  });

  mainWindow.webContents.on('zoom-changed', (event) => {
    if (!isAdminWindow) return;
    event.preventDefault();
    mainWindow.webContents.setZoomFactor(1.0);
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// --- APP LIFECYCLE ---

app.whenReady().then(async () => {
  try {
    appendStartupLog(`Starting app. route=${APP_LAUNCH_ROUTE}`);
    await loadSettings(); // Load zoom before window creates
    if (!IS_ADMIN_LAUNCH) {
      try {
        await startRemoteControlServer();
      } catch (error) {
        console.error('[Mobile Control] Failed to start server on port 3000:', error);
        appendStartupLog('Failed to start mobile control server', error);
      }
    }
    createWindow();
    appendStartupLog('Window created');
  } catch (error) {
    appendStartupLog('Startup failed', error);
    dialog.showErrorBox('Masjid Display startup failed', error && error.stack ? error.stack : String(error));
    app.quit();
  }
});

app.on('window-all-closed', function () {
  if (saveSettingsTimer) {
    clearTimeout(saveSettingsTimer);
    saveSettingsTimer = null;
  }
  void persistSettings();
  void stopRemoteControlServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void stopRemoteControlServer();
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- IPC HANDLERS ---

ipcMain.handle('zoom:get', () => {
  return zoomState.factor;
});

ipcMain.handle('zoom:set', (event, factor) => {
  setGlobalZoom(factor, false);
  return zoomState.factor;
});

ipcMain.handle('zoom:smart-detect', () => {
  return getSmartZoomFactor();
});

ipcMain.handle('remote-control:get-status', () => {
  return getRemoteControlStatusPayload();
});

ipcMain.on('remote-control:publish-state', (event, state) => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (event.sender.id !== mainWindow.webContents.id) return;
  setRemoteRendererState(state);
});

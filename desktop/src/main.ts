import { ChildProcess, spawn } from 'child_process';
import { app, BrowserWindow, session, shell } from 'electron';
import * as path from 'path';

const isDev = process.env['NODE_ENV'] === 'development';
let backendProcess: ChildProcess | null = null;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    title: 'Server Manager',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Apply CSP so that file:// loaded Angular can reach localhost:3000
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; " +
            "script-src 'self'; " +
            "style-src 'self' 'unsafe-inline'; " +
            'connect-src http://localhost:3000 ws://localhost:3000; ' +
            "img-src 'self' data:; " +
            "font-src 'self' data:;",
        ],
      },
    });
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(
      path.join(
        __dirname,
        '..',
        '..',
        'dist',
        'frontend',
        'browser',
        'index.html',
      ),
    );
  }

  // Open external links in the system browser, not in Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startBackend(): Promise<void> {
  if (isDev) {
    // Backend is started externally by `nx serve backend` in dev
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const backendPath = path.join(
      __dirname,
      '..',
      '..',
      'dist',
      'backend',
      'main.js',
    );

    backendProcess = spawn(process.execPath, [backendPath], {
      env: {
        ...process.env,
        PORT: '3000',
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const timeout = setTimeout(() => {
      // Resolve anyway after 10s so the window still opens
      resolve();
    }, 10_000);

    backendProcess.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      console.log('[backend]', output.trim());
      if (output.toLowerCase().includes('running on')) {
        clearTimeout(timeout);
        resolve();
      }
    });

    backendProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[backend:err]', data.toString().trim());
    });

    backendProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    backendProcess.on('exit', (code) => {
      console.log('[backend] exited with code', code);
      backendProcess = null;
    });
  });
}

function killBackend(): void {
  if (backendProcess) {
    backendProcess.kill();
    backendProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    await startBackend();
  } catch (err) {
    console.error('Failed to start backend:', err);
  }
  createWindow();

  // macOS: re-create window when dock icon is clicked and no windows are open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// macOS: keep app alive when all windows are closed (stays in Dock)
// Windows/Linux: quit the app
app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  killBackend();
});

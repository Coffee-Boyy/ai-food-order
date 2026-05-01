const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { handleApiRequest } = require('./services/api-service');

const isDev = Boolean(process.env.ELECTRON_START_URL);

function createMainWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  ipcMain.handle('app:getVersion', () => app.getVersion());
  ipcMain.handle('api:request', async (_event, request) => {
    try {
      const data = await handleApiRequest(request.method, request.path, request.body);
      return { ok: true, data };
    } catch (error) {
      return {
        ok: false,
        error: {
          message: error.message || 'Desktop API request failed',
          status: error.status || 500
        }
      };
    }
  });
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

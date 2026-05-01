const path = require('path');
const { app, BrowserWindow, ipcMain, shell } = require('electron');

// Unpackaged Electron defaults can use the "Electron" app name, which moves userData and breaks persistence.
try {
  const pkg = require(path.join(__dirname, '..', 'package.json'));
  const appName = pkg.productName || pkg.name;
  if (appName && !app.isReady()) {
    app.setName(appName);
  }
} catch (_) {
  /* ignore */
}

const sessionPersistence = require('./services/session-persistence');
const ordersPersistence = require('./services/orders-persistence');
const predictionsPersistence = require('./services/predictions-persistence');
const {
  handleApiRequest,
  executeOrderSyncWithProgressForDefaultUser,
  restorePersistedUberSession,
  bootstrapPersistedOrders,
  bootstrapPersistedPredictions,
  refreshOrdersFromUberOnStartup,
  loadUberEatsUserOnStartup
} = require('./services/api-service');

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
  const userData = app.getPath('userData');
  sessionPersistence.setUserDataDirectory(userData);
  ordersPersistence.setUserDataDirectory(userData);
  predictionsPersistence.setUserDataDirectory(userData);
  ordersPersistence.init();
  predictionsPersistence.init();
  restorePersistedUberSession();
  bootstrapPersistedOrders();
  bootstrapPersistedPredictions();

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

  ipcMain.handle('orders:sync', async (event) => {
    try {
      const data = await executeOrderSyncWithProgressForDefaultUser((payload) => {
        event.sender.send('orders-sync-progress', payload);
      });
      event.sender.send('orders-sync-progress', {
        type: 'complete',
        pages: data.pages,
        cumulativeOrders: data.syncedCount,
        percent: 100
      });
      return { ok: true, data };
    } catch (error) {
      event.sender.send('orders-sync-progress', {
        type: 'error',
        message: error.message || 'Order sync failed',
        status: error.status || 500
      });
      return {
        ok: false,
        error: {
          message: error.message || 'Order sync failed',
          status: error.status || 500
        }
      };
    }
  });
  createMainWindow();

  setImmediate(() => {
    loadUberEatsUserOnStartup()
      .then((result) => {
        if (result?.ok) {
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('uber-profile-updated');
            }
          });
        }
      })
      .catch((e) => console.error('[uber] getUserV1 on startup', e));

    refreshOrdersFromUberOnStartup()
      .then((result) => {
        if (result?.updated) {
          BrowserWindow.getAllWindows().forEach((win) => {
            if (!win.isDestroyed()) {
              win.webContents.send('orders-background-refresh');
            }
          });
        }
      })
      .catch((e) => console.error('[orders] background refresh', e));
  });

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

app.on('before-quit', () => {
  try {
    ordersPersistence.close();
  } catch (_) {
    /* ignore */
  }
  try {
    predictionsPersistence.close();
  } catch (_) {
    /* ignore */
  }
});

const { BrowserWindow, session } = require('electron');

const PARTITION = 'persist:uber-login';
const UBER_FE_URL = 'https://www.ubereats.com';

/**
 * Opens an embedded login window on a dedicated session partition, then reads `sid` /
 * `csrf_token` after the user signs in (polling + navigation hooks for SPA flows).
 *
 * @returns {Promise<{ sid: string, csrfToken: string | null }>}
 */
async function captureUberSessionViaBrowser() {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ses = session.fromPartition(PARTITION);

    const win = new BrowserWindow({
      width: 900,
      height: 700,
      show: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: PARTITION
      },
      title: 'Connect your UberEats account'
    });

    let pollInterval = null;

    const cleanup = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const settleReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const settleResolve = (payload) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (!win.isDestroyed()) {
        win.close();
      }
      resolve(payload);
    };

    async function readSessionCookies() {
      let sidCookies = await ses.cookies.get({ url: UBER_FE_URL, name: 'sid' });
      if (sidCookies.length === 0) {
        sidCookies = await ses.cookies.get({ domain: '.ubereats.com', name: 'sid' });
      }
      if (sidCookies.length === 0) return null;

      const sid = sidCookies[0].value;
      let csrfCookies = await ses.cookies.get({ url: UBER_FE_URL, name: 'csrf_token' });
      if (csrfCookies.length === 0) {
        csrfCookies = await ses.cookies.get({ domain: '.ubereats.com', name: 'csrf_token' });
      }
      const csrfToken = csrfCookies[0]?.value || null;
      return { sid, csrfToken };
    }

    async function tryCapture() {
      if (settled || win.isDestroyed()) return;
      try {
        const creds = await readSessionCookies();
        if (creds) settleResolve(creds);
      } catch (err) {
        settleReject(err instanceof Error ? err : new Error(String(err)));
      }
    }

    win.webContents.on('did-finish-load', () => void tryCapture());
    win.webContents.on('did-navigate', () => void tryCapture());
    win.webContents.on('did-navigate-in-page', () => void tryCapture());

    pollInterval = setInterval(() => void tryCapture(), 2000);

    win.on('closed', () => {
      cleanup();
      if (!settled) {
        settleReject(new Error('Login window closed before UberEats session was detected'));
      }
    });

    win.loadURL(UBER_FE_URL).catch((err) => settleReject(err));
  });
}

module.exports = { captureUberSessionViaBrowser, PARTITION };

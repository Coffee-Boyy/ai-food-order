const fs = require('fs');
const path = require('path');

const FILE_NAME = 'uber-eats-session.json';

let userDataRoot = null;

function setUserDataDirectory(dir) {
  userDataRoot = dir;
}

function ensureUserDataRoot() {
  if (userDataRoot) return;
  try {
    const { app } = require('electron');
    if (app && typeof app.getPath === 'function' && app.isReady && app.isReady()) {
      userDataRoot = app.getPath('userData');
    }
  } catch (_) {
    /* not in Electron main or not ready */
  }
}

function getSessionFilePath() {
  if (userDataRoot) {
    return path.join(userDataRoot, FILE_NAME);
  }
  ensureUserDataRoot();
  if (userDataRoot) {
    return path.join(userDataRoot, FILE_NAME);
  }
  try {
    const { app } = require('electron');
    if (app?.getPath && app.isReady && app.isReady()) {
      return path.join(app.getPath('userData'), FILE_NAME);
    }
  } catch (_) {
    /* not in Electron */
  }
  return null;
}

function read() {
  const filePath = getSessionFilePath();
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    const sid = typeof data?.sid === 'string' ? data.sid.trim() : '';
    if (!data || !sid) return null;
    return { ...data, sid };
  } catch {
    return null;
  }
}

function write(session) {
  ensureUserDataRoot();
  const filePath = getSessionFilePath();
  const sid = typeof session?.sid === 'string' ? session.sid.trim() : '';
  if (!sid) {
    throw new Error('Cannot persist Uber session without a sid');
  }
  if (!filePath) {
    throw new Error('Cannot resolve user data path for session persistence (app not ready?)');
  }

  const payload = {
    version: 1,
    id: session.id,
    sid,
    csrfToken: session.csrfToken || null,
    createdAt: session.createdAt || new Date().toISOString()
  };

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload), { encoding: 'utf8' });

  try {
    fs.chmodSync(filePath, 0o600);
  } catch (_) {
    /* Windows or unsupported */
  }
}

function clear() {
  const filePath = getSessionFilePath();
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    /* ignore */
  }
}

module.exports = {
  setUserDataDirectory,
  getSessionFilePath,
  read,
  write,
  clear
};

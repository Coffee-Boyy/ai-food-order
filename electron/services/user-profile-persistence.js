const fs = require('fs');
const path = require('path');

const FILE_NAME = 'app-user-profile.json';

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

function getFilePath() {
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
  const filePath = getFilePath();
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    const pictureUrl =
      data.pictureUrl === null
        ? null
        : typeof data.pictureUrl === 'string'
          ? data.pictureUrl
          : null;
    return {
      firstName: typeof data.firstName === 'string' ? data.firstName : '',
      lastName: typeof data.lastName === 'string' ? data.lastName : '',
      email: typeof data.email === 'string' ? data.email : '',
      pictureUrl
    };
  } catch {
    return null;
  }
}

function writeFromUserSlice(user) {
  ensureUserDataRoot();
  const filePath = getFilePath();
  if (!filePath) {
    throw new Error('Cannot resolve user data path for profile persistence (app not ready?)');
  }

  const payload = {
    version: 1,
    firstName: typeof user?.firstName === 'string' ? user.firstName : '',
    lastName: typeof user?.lastName === 'string' ? user.lastName : '',
    email: typeof user?.email === 'string' ? user.email : '',
    pictureUrl: user?.pictureUrl === null || typeof user?.pictureUrl === 'string' ? user.pictureUrl : null
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
  const filePath = getFilePath();
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch (_) {
    /* ignore */
  }
}

module.exports = {
  setUserDataDirectory,
  getFilePath,
  read,
  writeFromUserSlice,
  clear
};

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DB_FILE = 'orders.sqlite';

let userDataRoot = null;
/** @type {import('better-sqlite3').Database | null} */
let db = null;

function setUserDataDirectory(dir) {
  userDataRoot = dir;
}

function getDbPath() {
  if (!userDataRoot) {
    throw new Error('Orders DB: user data directory not set');
  }
  return path.join(userDataRoot, DB_FILE);
}

function init() {
  if (db) {
    return;
  }
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS synced_orders (
      user_id TEXT NOT NULL,
      order_uuid TEXT NOT NULL,
      order_time TEXT NOT NULL,
      payload TEXT NOT NULL,
      PRIMARY KEY (user_id, order_uuid)
    );
    CREATE INDEX IF NOT EXISTS idx_synced_orders_user_time
      ON synced_orders (user_id, order_time DESC);
    CREATE TABLE IF NOT EXISTS app_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * @param {string} userId
 * @param {object[]} orders normalized orders from api-service
 */
function replaceOrdersForUser(userId, orders) {
  init();
  const del = db.prepare('DELETE FROM synced_orders WHERE user_id = ?');
  const insert = db.prepare(
    'INSERT INTO synced_orders (user_id, order_uuid, order_time, payload) VALUES (?, ?, ?, ?)'
  );
  const txn = db.transaction(() => {
    del.run(userId);
    for (const o of orders) {
      const uuid = typeof o.uuid === 'string' && o.uuid.length > 0 ? o.uuid : `anon_${Date.now()}_${Math.random()}`;
      const orderTime = typeof o.order_time === 'string' ? o.order_time : new Date().toISOString();
      insert.run(userId, uuid, orderTime, JSON.stringify(o));
    }
  });
  txn();
}

/**
 * @param {string} userId
 * @returns {object[]}
 */
function loadOrdersForUser(userId) {
  init();
  const rows = db
    .prepare(
      'SELECT payload FROM synced_orders WHERE user_id = ? ORDER BY order_time DESC'
    )
    .all(userId);
  return rows.map((r) => JSON.parse(r.payload));
}

function setLastSyncAt(userId, syncedAt) {
  init();
  db.prepare('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)').run(`lastSync:${userId}`, syncedAt);
}

/**
 * @param {string} userId
 * @returns {string | null}
 */
function getLastSyncAt(userId) {
  init();
  const row = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(`lastSync:${userId}`);
  return row && typeof row.value === 'string' ? row.value : null;
}

function clearOrdersForUser(userId) {
  init();
  db.prepare('DELETE FROM synced_orders WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM app_kv WHERE key = ?').run(`lastSync:${userId}`);
}

const DATA_SCOPE_KV = 'dataScopeUserId';

function getPersistedDataScopeUserId() {
  init();
  const row = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(DATA_SCOPE_KV);
  return row && typeof row.value === 'string' && row.value.length > 0 ? row.value : null;
}

function setPersistedDataScopeUserId(userId) {
  init();
  db.prepare('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)').run(DATA_SCOPE_KV, userId);
}

function clearPersistedDataScopeUserId() {
  init();
  db.prepare('DELETE FROM app_kv WHERE key = ?').run(DATA_SCOPE_KV);
}

/**
 * Move all synced orders + lastSync key from one user_id to another (first-time Uber scope upgrade).
 */
function migrateOrdersUserId(fromUserId, toUserId) {
  init();
  if (fromUserId === toUserId) return;
  const hasTarget =
    db.prepare('SELECT COUNT(*) as c FROM synced_orders WHERE user_id = ?').get(toUserId).c > 0;
  if (hasTarget) return;
  const txn = db.transaction(() => {
    db.prepare('UPDATE synced_orders SET user_id = ? WHERE user_id = ?').run(toUserId, fromUserId);
    const row = db.prepare('SELECT value FROM app_kv WHERE key = ?').get(`lastSync:${fromUserId}`);
    if (row && typeof row.value === 'string') {
      db.prepare('INSERT OR REPLACE INTO app_kv (key, value) VALUES (?, ?)').run(`lastSync:${toUserId}`, row.value);
      db.prepare('DELETE FROM app_kv WHERE key = ?').run(`lastSync:${fromUserId}`);
    }
  });
  txn();
}

module.exports = {
  setUserDataDirectory,
  init,
  close,
  replaceOrdersForUser,
  loadOrdersForUser,
  setLastSyncAt,
  getLastSyncAt,
  clearOrdersForUser,
  getPersistedDataScopeUserId,
  setPersistedDataScopeUserId,
  clearPersistedDataScopeUserId,
  migrateOrdersUserId
};

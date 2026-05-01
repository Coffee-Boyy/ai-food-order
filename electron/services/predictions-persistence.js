/**
 * Predictions persistence layer.
 *
 * Stores predictions in the same orders.sqlite file used by orders-persistence
 * so all local data lives in a single SQLite database.
 */

'use strict';

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
    throw new Error('Predictions DB: user data directory not set');
  }
  return path.join(userDataRoot, DB_FILE);
}

function init() {
  if (db) return;
  const dbPath = getDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS predictions (
      user_id       TEXT NOT NULL,
      prediction_id TEXT NOT NULL,
      created_at    TEXT NOT NULL,
      payload       TEXT NOT NULL,
      PRIMARY KEY (user_id, prediction_id)
    );
    CREATE INDEX IF NOT EXISTS idx_predictions_user_created
      ON predictions (user_id, created_at DESC);
  `);
}

function close() {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Insert or replace a single prediction.
 * @param {string} userId
 * @param {object} prediction  Must have an `id` and `created_at` field.
 */
function savePrediction(userId, prediction) {
  init();
  db.prepare(
    'INSERT OR REPLACE INTO predictions (user_id, prediction_id, created_at, payload) VALUES (?, ?, ?, ?)'
  ).run(userId, prediction.id, prediction.created_at, JSON.stringify(prediction));
}

/**
 * Update the `is_correct` field of an existing prediction in-place.
 * @param {string}  userId
 * @param {string}  predictionId
 * @param {boolean} isCorrect
 */
function updateFeedback(userId, predictionId, isCorrect) {
  init();
  const row = db
    .prepare('SELECT payload FROM predictions WHERE user_id = ? AND prediction_id = ?')
    .get(userId, predictionId);
  if (!row) return;
  const prediction = JSON.parse(row.payload);
  prediction.is_correct = isCorrect;
  db.prepare(
    'UPDATE predictions SET payload = ? WHERE user_id = ? AND prediction_id = ?'
  ).run(JSON.stringify(prediction), userId, predictionId);
}

/**
 * Load all predictions for a user, newest first.
 * @param {string} userId
 * @returns {object[]}
 */
function loadPredictionsForUser(userId) {
  init();
  const rows = db
    .prepare('SELECT payload FROM predictions WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);
  return rows.map((r) => JSON.parse(r.payload));
}

/**
 * Delete all predictions for a user (used during account clear).
 * @param {string} userId
 */
function clearPredictionsForUser(userId) {
  init();
  db.prepare('DELETE FROM predictions WHERE user_id = ?').run(userId);
}

module.exports = {
  setUserDataDirectory,
  init,
  close,
  savePrediction,
  updateFeedback,
  loadPredictionsForUser,
  clearPredictionsForUser
};

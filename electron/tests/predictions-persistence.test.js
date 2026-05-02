/**
 * Tests for predictions-persistence.js
 *
 * Run with: node electron/tests/predictions-persistence.test.js
 */

'use strict';

const assert = require('assert');
const os = require('os');
const path = require('path');
const fs = require('fs');

// ─── Setup / teardown ─────────────────────────────────────────────────────────

// better-sqlite3 is a native addon compiled against Electron's Node ABI.
// When this test is run with the system Node binary the module version won't
// match, so we skip gracefully rather than hard-crashing.
let persistence;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fp-test-'));
try {
  persistence = require(
    path.join(__dirname, '..', 'services', 'predictions-persistence')
  );
  persistence.setUserDataDirectory(tmpDir);
  persistence.init();
} catch (err) {
  try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}
  if (err.code === 'ERR_DLOPEN_FAILED') {
    console.log(
      '\npredictions-persistence\n' +
      '  (skipped — better-sqlite3 requires Electron\'s Node runtime)\n' +
      '  Run via `pnpm electron:dev` or rebuild with `pnpm rebuild` for the system Node.\n'
    );
    process.exit(0);
  }
  throw err;
}

const USER = 'test-user';

function makePrediction(id, restaurant = 'Thai Palace', isCorrect = undefined) {
  const p = {
    id,
    predicted_restaurant: restaurant,
    predicted_items: ['Pad Thai', 'Spring Rolls'],
    confidence_score: 0.85,
    reasoning: 'You often order Thai on Fridays.',
    source: 'apple-foundation-models',
    day_of_week: 5,
    time_of_day: 'dinner',
    created_at: new Date().toISOString()
  };
  if (isCorrect !== undefined) p.is_correct = isCorrect;
  return p;
}

// ─── Test runner ──────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

console.log('\npredictions-persistence');

test('loads empty array when no predictions stored', () => {
  const result = persistence.loadPredictionsForUser(USER);
  assert.deepStrictEqual(result, []);
});

test('saves a prediction and loads it back', () => {
  const p = makePrediction('pred_1', 'Burger Joint');
  persistence.savePrediction(USER, p);
  const loaded = persistence.loadPredictionsForUser(USER);
  assert.strictEqual(loaded.length, 1);
  assert.strictEqual(loaded[0].id, 'pred_1');
  assert.strictEqual(loaded[0].predicted_restaurant, 'Burger Joint');
});

test('multiple saves accumulate and return newest first', () => {
  // pred_2 has a later created_at
  const p1 = makePrediction('pred_1_a');
  p1.created_at = '2026-04-01T12:00:00.000Z';
  const p2 = makePrediction('pred_2_a');
  p2.created_at = '2026-04-02T12:00:00.000Z';

  persistence.savePrediction(USER, p1);
  persistence.savePrediction(USER, p2);

  const loaded = persistence.loadPredictionsForUser(USER);
  // Find by id to be order-independent with previous test data
  const ids = loaded.map((p) => p.id);
  assert.ok(ids.indexOf('pred_2_a') < ids.indexOf('pred_1_a'), 'Newer prediction should come first');
});

test('savePrediction is idempotent (INSERT OR REPLACE)', () => {
  const p = makePrediction('pred_idem');
  persistence.savePrediction(USER, p);
  persistence.savePrediction(USER, p);
  const loaded = persistence.loadPredictionsForUser(USER);
  const matches = loaded.filter((x) => x.id === 'pred_idem');
  assert.strictEqual(matches.length, 1, 'Should not duplicate on re-save');
});

test('updateFeedback sets is_correct = true', () => {
  const p = makePrediction('pred_fb_true');
  persistence.savePrediction(USER, p);
  persistence.updateFeedback(USER, 'pred_fb_true', true);
  const loaded = persistence.loadPredictionsForUser(USER);
  const updated = loaded.find((x) => x.id === 'pred_fb_true');
  assert.strictEqual(updated.is_correct, true);
});

test('updateFeedback sets is_correct = false', () => {
  const p = makePrediction('pred_fb_false');
  persistence.savePrediction(USER, p);
  persistence.updateFeedback(USER, 'pred_fb_false', false);
  const loaded = persistence.loadPredictionsForUser(USER);
  const updated = loaded.find((x) => x.id === 'pred_fb_false');
  assert.strictEqual(updated.is_correct, false);
});

test('updateFeedback on unknown id is a no-op', () => {
  assert.doesNotThrow(() => {
    persistence.updateFeedback(USER, 'nonexistent_id', true);
  });
});

test('deletePrediction removes one row', () => {
  persistence.savePrediction(USER, makePrediction('pred_to_delete'));
  persistence.savePrediction(USER, makePrediction('pred_to_keep'));
  persistence.deletePrediction(USER, 'pred_to_delete');
  const loaded = persistence.loadPredictionsForUser(USER);
  assert.strictEqual(loaded.some((p) => p.id === 'pred_to_delete'), false);
  assert.strictEqual(loaded.some((p) => p.id === 'pred_to_keep'), true);
});

test('deletePrediction on unknown id does not throw', () => {
  assert.doesNotThrow(() => {
    persistence.deletePrediction(USER, 'totally_missing');
  });
});

test('clearPredictionsForUser removes all predictions for user', () => {
  persistence.clearPredictionsForUser(USER);
  const loaded = persistence.loadPredictionsForUser(USER);
  assert.deepStrictEqual(loaded, []);
});

test('clearPredictionsForUser does not affect other users', () => {
  const OTHER = 'other-user';
  persistence.savePrediction(OTHER, makePrediction('pred_other'));
  persistence.clearPredictionsForUser(USER);
  const others = persistence.loadPredictionsForUser(OTHER);
  assert.strictEqual(others.length, 1, 'Other user predictions should be untouched');
});

// ─── Cleanup ──────────────────────────────────────────────────────────────────

persistence.close();
try { fs.rmSync(tmpDir, { recursive: true }); } catch (_) {}

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

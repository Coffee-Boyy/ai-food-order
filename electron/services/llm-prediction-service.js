/**
 * LLM Prediction Service
 *
 * Builds compact order-pattern summaries and calls the native Foundation Models
 * helper binary to generate on-device AI order recommendations.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Timeout for the Swift helper process (ms).
const HELPER_TIMEOUT_MS = 30_000;

// ─── Binary path resolution ───────────────────────────────────────────────────

/**
 * Returns the absolute path to the compiled FoodPredictor binary.
 * In packaged Electron builds the binary is copied next to the app resources;
 * in development it lives in the Swift package's release build output.
 */
function helperBinaryPath() {
  // Packaged location: <app>/Contents/Resources/FoodPredictor
  const resourcesPath = process.resourcesPath
    ? path.join(process.resourcesPath, 'FoodPredictor')
    : null;
  if (resourcesPath && fs.existsSync(resourcesPath)) return resourcesPath;

  // Development location: electron/native/foundation-model-predictor/.build/release/FoodPredictor
  const devPath = path.join(
    __dirname,
    '..',
    'native',
    'foundation-model-predictor',
    '.build',
    'release',
    'FoodPredictor'
  );
  if (fs.existsSync(devPath)) return devPath;

  return null;
}

// ─── Summary builder ─────────────────────────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const TIME_LABELS = {
  breakfast: 'morning (breakfast)',
  lunch: 'afternoon (lunch)',
  dinner: 'evening (dinner)',
  late_night: 'late night'
};

/**
 * Extracts item names from a normalized order object.
 * @param {object} order
 * @returns {string[]}
 */
function extractItems(order) {
  const raw = order.items || order.baseEaterOrder?.shoppingCart?.items || [];
  return raw
    .map((i) => i.title || i.name || '')
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Builds a compact order-pattern summary for the given day/time slot.
 * All ordering is recency-weighted but only aggregated counts/names are sent —
 * no raw order payloads or personal identifiers.
 *
 * @param {object[]} orders  Normalized orders from orders-persistence
 * @param {number}   dayOfWeek  0-6
 * @param {string}   timeOfDay  e.g. 'dinner'
 * @returns {import('../../types').OrderSummary}
 */
function buildOrderSummary(orders, dayOfWeek, timeOfDay) {
  if (!Array.isArray(orders) || orders.length === 0) {
    throw new Error('No orders available for summary');
  }

  // ── Top restaurants for the requested slot ────────────────────────────────
  const slotOrders = orders.filter(
    (o) => o.day_of_week === dayOfWeek && o.time_of_day === timeOfDay
  );
  const poolForSlot = slotOrders.length >= 3 ? slotOrders : orders;

  const restaurantMap = new Map();
  for (const o of poolForSlot) {
    const name = o.restaurant_name || 'Unknown';
    const entry = restaurantMap.get(name) || { count: 0, totalSpend: 0, items: new Map() };
    entry.count += 1;
    entry.totalSpend += o.total_amount || 0;
    for (const item of extractItems(o)) {
      entry.items.set(item, (entry.items.get(item) || 0) + 1);
    }
    restaurantMap.set(name, entry);
  }

  const topRestaurantsBySlot = [...restaurantMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([restaurant, e]) => ({
      restaurant,
      count: e.count,
      avgSpend: e.count > 0 ? Math.round((e.totalSpend / e.count) * 100) / 100 : 0,
      commonItems: [...e.items.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([item]) => item)
    }));

  // ── Top restaurants overall ───────────────────────────────────────────────
  const overallMap = new Map();
  for (const o of orders) {
    const name = o.restaurant_name || 'Unknown';
    const entry = overallMap.get(name) || { count: 0, totalSpend: 0, items: new Map() };
    entry.count += 1;
    entry.totalSpend += o.total_amount || 0;
    for (const item of extractItems(o)) {
      entry.items.set(item, (entry.items.get(item) || 0) + 1);
    }
    overallMap.set(name, entry);
  }

  const topRestaurantsOverall = [...overallMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([restaurant, e]) => ({
      restaurant,
      count: e.count,
      avgSpend: e.count > 0 ? Math.round((e.totalSpend / e.count) * 100) / 100 : 0,
      commonItems: [...e.items.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([item]) => item)
    }));

  // ── Recent orders (recency signal, no spend details beyond avg) ───────────
  const recentOrders = orders.slice(0, 10).map((o) => ({
    restaurant: o.restaurant_name || 'Unknown',
    items: extractItems(o).slice(0, 4),
    date: new Date(o.order_time).toISOString().slice(0, 10),
    spend: o.total_amount || 0
  }));

  const totalSpent = orders.reduce((s, o) => s + (o.total_amount || 0), 0);
  const avgSpend = orders.length > 0 ? Math.round((totalSpent / orders.length) * 100) / 100 : 0;

  return {
    topRestaurantsBySlot,
    topRestaurantsOverall,
    recentOrders,
    totalOrders: orders.length,
    avgSpend,
    dayName: DAY_NAMES[dayOfWeek] || 'Unknown',
    timeLabel: TIME_LABELS[timeOfDay] || timeOfDay
  };
}

// ─── Helper invocation ────────────────────────────────────────────────────────

/**
 * Calls the native Foundation Models helper, passing the request as JSON on
 * stdin and returning the parsed JSON response from stdout.
 *
 * @param {object} request  { dayOfWeek, timeOfDay, summary }
 * @returns {Promise<object>}  Parsed JSON from the helper
 */
function invokeHelper(request) {
  return new Promise((resolve, reject) => {
    const binaryPath = helperBinaryPath();
    if (!binaryPath) {
      return reject(
        Object.assign(new Error('FoodPredictor binary not found. Run `pnpm build:native` first.'), {
          code: 'helperNotFound'
        })
      );
    }

    const child = spawn(binaryPath, [], { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(
        Object.assign(new Error('Foundation Models helper timed out after 30 s.'), {
          code: 'helperTimeout'
        })
      );
    }, HELPER_TIMEOUT_MS);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (exitCode) => {
      clearTimeout(timer);

      if (stderr.trim()) {
        console.log('[FoodPredictor] swift stderr:\n' + stderr.trim());
      }

      let parsed;
      try {
        parsed = JSON.parse(stdout.trim());
      } catch {
        return reject(
          Object.assign(
            new Error(`Helper produced invalid JSON (exit ${exitCode}): ${stderr.slice(0, 200)}`),
            { code: 'helperBadOutput' }
          )
        );
      }

      console.log('[FoodPredictor] response:', JSON.stringify(parsed, null, 2));

      if (!parsed.ok) {
        const err = Object.assign(new Error(parsed.message || 'Helper error'), {
          code: parsed.error || 'helperError'
        });
        return reject(err);
      }

      resolve(parsed);
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(Object.assign(err, { code: 'helperSpawnError' }));
    });

    // Send the request JSON and close stdin so the helper reads EOF
    const input = JSON.stringify(request, null, 2);
    console.log('[FoodPredictor] request:', input);
    child.stdin.write(input);
    child.stdin.end();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generates an AI-powered food order recommendation using the on-device Foundation Models
 * helper.  Sends only compact pattern summaries — no raw order payloads.
 *
 * @param {object[]} orders     Normalized orders array
 * @param {number}   dayOfWeek  0–6
 * @param {string}   timeOfDay  'breakfast' | 'lunch' | 'dinner' | 'late_night'
 * @param {object[]|null} [previousPredictions]  Prior suggestions for this day/time (oldest first).
 *   When non-empty, the model must avoid repeating any of these restaurants/item sets.
 * @param {string} previousPredictions[].predicted_restaurant
 * @param {string[]} previousPredictions[].predicted_items
 * @param {string} [previousPredictions[].reasoning]
 * @returns {Promise<{
 *   predicted_restaurant: string,
 *   predicted_items: string[],
 *   confidence_score: number,
 *   reasoning: string,
 *   source: string,
 *   day_of_week: number,
 *   time_of_day: string,
 *   created_at: string
 * }>}
 */
async function generatePrediction(orders, dayOfWeek, timeOfDay, previousPredictions = null) {
  const summary = buildOrderSummary(orders, dayOfWeek, timeOfDay);
  const request = { dayOfWeek, timeOfDay, summary };
  if (Array.isArray(previousPredictions) && previousPredictions.length > 0) {
    request.previousRecommendations = previousPredictions.map((p) => ({
      recommendedRestaurant: p.predicted_restaurant,
      recommendedItems: p.predicted_items,
      reasoning: p.reasoning || null
    }));
  }
  const result = await invokeHelper(request);

  return {
    predicted_restaurant: result.recommendedRestaurant,
    predicted_items: result.recommendedItems,
    confidence_score: result.confidenceScore,
    reasoning: result.reasoning,
    source: result.source || 'apple-foundation-models',
    day_of_week: dayOfWeek,
    time_of_day: timeOfDay,
    created_at: new Date().toISOString()
  };
}

module.exports = { generatePrediction, buildOrderSummary, helperBinaryPath };

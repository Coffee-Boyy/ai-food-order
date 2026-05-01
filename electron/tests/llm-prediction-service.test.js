/**
 * Tests for llm-prediction-service.js
 *
 * Run with: node electron/tests/llm-prediction-service.test.js
 * (No external test framework required — uses Node assert.)
 */

'use strict';

const assert = require('assert');
const path = require('path');

// ─── Module under test ────────────────────────────────────────────────────────

const { buildOrderSummary } = require(
  path.join(__dirname, '..', 'services', 'llm-prediction-service')
);

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal normalized order factory. */
function makeOrder({ restaurant = 'Test Place', dayOfWeek = 5, timeOfDay = 'dinner', amount = 25, items = [] } = {}) {
  return {
    uuid: `order_${Math.random().toString(36).slice(2)}`,
    restaurant_name: restaurant,
    day_of_week: dayOfWeek,
    time_of_day: timeOfDay,
    total_amount: amount,
    order_time: new Date().toISOString(),
    items: items.map((name) => ({ title: name }))
  };
}

const FRIDAY_DINNER_ORDERS = [
  makeOrder({ restaurant: 'Thai Palace', dayOfWeek: 5, timeOfDay: 'dinner', amount: 28, items: ['Pad Thai', 'Spring Rolls'] }),
  makeOrder({ restaurant: 'Thai Palace', dayOfWeek: 5, timeOfDay: 'dinner', amount: 30, items: ['Green Curry', 'Mango Sticky Rice'] }),
  makeOrder({ restaurant: 'Thai Palace', dayOfWeek: 5, timeOfDay: 'dinner', amount: 26, items: ['Pad Thai', 'Tom Yum Soup'] }),
  makeOrder({ restaurant: 'Pizza Hub', dayOfWeek: 5, timeOfDay: 'dinner', amount: 22, items: ['Margherita', 'Garlic Bread'] }),
  makeOrder({ restaurant: 'Burger Joint', dayOfWeek: 3, timeOfDay: 'lunch', amount: 15, items: ['Double Burger'] }),
];

// ─── Test helpers ─────────────────────────────────────────────────────────────

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

// ─── Summary builder tests ────────────────────────────────────────────────────

console.log('\nbuildOrderSummary');

test('throws when orders array is empty', () => {
  assert.throws(
    () => buildOrderSummary([], 5, 'dinner'),
    /No orders available/
  );
});

test('throws when orders is not an array', () => {
  assert.throws(
    () => buildOrderSummary(null, 5, 'dinner'),
    /No orders available/
  );
});

test('returns required summary fields', () => {
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 5, 'dinner');
  assert.ok(Array.isArray(summary.topRestaurantsBySlot), 'topRestaurantsBySlot missing');
  assert.ok(Array.isArray(summary.topRestaurantsOverall), 'topRestaurantsOverall missing');
  assert.ok(Array.isArray(summary.recentOrders), 'recentOrders missing');
  assert.strictEqual(typeof summary.totalOrders, 'number', 'totalOrders not a number');
  assert.strictEqual(typeof summary.avgSpend, 'number', 'avgSpend not a number');
  assert.strictEqual(typeof summary.dayName, 'string', 'dayName not a string');
  assert.strictEqual(typeof summary.timeLabel, 'string', 'timeLabel not a string');
});

test('topRestaurantsBySlot ranks by frequency for the requested slot', () => {
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 5, 'dinner');
  // Thai Palace has 3 Friday-dinner orders; Pizza Hub has 1
  assert.strictEqual(summary.topRestaurantsBySlot[0].restaurant, 'Thai Palace');
  assert.strictEqual(summary.topRestaurantsBySlot[0].count, 3);
});

test('topRestaurantsBySlot uses full pool when slot has fewer than 3 orders', () => {
  // Only 1 Wednesday lunch order exists — should fall back to all orders
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 3, 'lunch');
  // Should still have data (from full pool)
  assert.ok(summary.topRestaurantsBySlot.length > 0);
});

test('topRestaurantsOverall includes orders from all slots', () => {
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 5, 'dinner');
  const restaurantNames = summary.topRestaurantsOverall.map((r) => r.restaurant);
  assert.ok(restaurantNames.includes('Burger Joint'), 'Burger Joint (Wed lunch) should appear in overall');
});

test('commonItems lists most-ordered items for the restaurant', () => {
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 5, 'dinner');
  const thai = summary.topRestaurantsBySlot.find((r) => r.restaurant === 'Thai Palace');
  assert.ok(thai, 'Thai Palace not found');
  assert.ok(thai.commonItems.includes('Pad Thai'), 'Pad Thai should be a common item');
});

test('recentOrders is capped at 10 entries', () => {
  const many = Array.from({ length: 20 }, (_, i) =>
    makeOrder({ restaurant: `Place ${i}`, dayOfWeek: 1, timeOfDay: 'lunch', amount: 20 })
  );
  const summary = buildOrderSummary(many, 1, 'lunch');
  assert.ok(summary.recentOrders.length <= 10);
});

test('avgSpend is computed correctly', () => {
  const orders = [
    makeOrder({ amount: 10 }),
    makeOrder({ amount: 20 }),
    makeOrder({ amount: 30 })
  ];
  const summary = buildOrderSummary(orders, 5, 'dinner');
  assert.strictEqual(summary.avgSpend, 20);
});

test('totalOrders reflects all input orders', () => {
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 5, 'dinner');
  assert.strictEqual(summary.totalOrders, FRIDAY_DINNER_ORDERS.length);
});

test('dayName is set correctly for Friday (index 5)', () => {
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 5, 'dinner');
  assert.strictEqual(summary.dayName, 'Friday');
});

test('timeLabel maps dinner to a human-readable label', () => {
  const summary = buildOrderSummary(FRIDAY_DINNER_ORDERS, 5, 'dinner');
  assert.ok(summary.timeLabel.toLowerCase().includes('dinner'));
});

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);

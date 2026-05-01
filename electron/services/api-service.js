const sessionPersistence = require('./session-persistence');
const ordersPersistence = require('./orders-persistence');
const predictionsPersistence = require('./predictions-persistence');
const { generatePrediction } = require('./llm-prediction-service');

const UBER_EATS_BASE_URL = 'https://www.ubereats.com';

/** Stable key for the single local profile and SQLite `user_id` (existing installs). */
const APP_USER_ID = 'local-user';

const store = {
  users: new Map(),
  uberSessions: new Map(),
  /** @type {Map<string, { data: object, raw: object, fetchedAt: string }>} */
  uberEatsUserByUserId: new Map(),
  ordersByUser: new Map(),
  predictionsByUser: new Map(),
  lastSyncByUser: new Map()
};

function ensureAppUser() {
  if (!store.users.has(APP_USER_ID)) {
    store.users.set(APP_USER_ID, {
      id: APP_USER_ID,
      email: '',
      firstName: '',
      lastName: '',
      created_at: new Date().toISOString(),
      preferences: {},
      pictureUrl: null
    });
  }
  return store.users.get(APP_USER_ID);
}

function getCurrentUser() {
  return ensureAppUser();
}

function getUberSession(userId) {
  return store.uberSessions.get(userId) || null;
}

function sessionFromPersistedRecord(rec) {
  return {
    id: rec.id || `sess_restored_${Date.now()}`,
    sid: rec.sid,
    csrfToken: rec.csrfToken || null,
    createdAt: rec.createdAt || new Date().toISOString()
  };
}

function restorePersistedUberSession() {
  const rec = sessionPersistence.read();
  if (!rec) return;
  store.uberSessions.set(APP_USER_ID, sessionFromPersistedRecord(rec));
}

/** Re-load from disk if memory was cleared (e.g. module reload) but the session file remains. */
function hydrateUberSessionFromDiskIfNeeded(userId) {
  if (store.uberSessions.has(userId)) return;
  const rec = sessionPersistence.read();
  if (!rec) return;
  store.uberSessions.set(userId, sessionFromPersistedRecord(rec));
}

function parseCookieHeader(rawCookie) {
  if (!rawCookie || typeof rawCookie !== 'string') return {};
  return rawCookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...rest] = part.split('=');
      if (!key || rest.length === 0) return acc;
      acc[key] = rest.join('=');
      return acc;
    }, {});
}

function buildCookieHeader(session) {
  const cookies = [];
  if (session.sid) cookies.push(`sid=${session.sid}`);
  if (session.csrfToken) cookies.push(`csrf_token=${session.csrfToken}`);
  return cookies.join('; ');
}

function buildUberWebHeaders(session) {
  return {
    'Content-Type': 'application/json',
    Cookie: buildCookieHeader(session),
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
    'x-csrf-token': session.csrfToken || 'x'
  };
}

/**
 * @returns {Promise<{ data: object, raw: object }>}
 */
async function fetchUberEatsUserV1(session) {
  const response = await fetch(`${UBER_EATS_BASE_URL}/_p/api/getUserV1`, {
    method: 'POST',
    headers: buildUberWebHeaders(session),
    body: JSON.stringify({})
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`UberEats getUserV1 failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const raw = await response.json();
  const data = raw?.data && typeof raw.data === 'object' ? raw.data : {};
  return { data, raw };
}

function splitFullName(fullName) {
  if (typeof fullName !== 'string' || !fullName.trim()) return { first: '', last: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/**
 * Map getUserV1 `data` into local profile fields.
 * Typical shape: firstName, lastName, pictureUrl on data; hashedEmail is not a usable email.
 */
function profilePatchFromUberUserData(data) {
  if (!data || typeof data !== 'object') return null;
  const nested =
    (data.user && typeof data.user === 'object' ? data.user : null) ||
    (data.eater && typeof data.eater === 'object' ? data.eater : null);
  const nameSrc = nested || data;

  let firstName =
    (typeof nameSrc.firstName === 'string' && nameSrc.firstName) ||
    (typeof nameSrc.givenName === 'string' && nameSrc.givenName) ||
    '';
  let lastName =
    (typeof nameSrc.lastName === 'string' && nameSrc.lastName) ||
    (typeof nameSrc.familyName === 'string' && nameSrc.familyName) ||
    '';

  if (!firstName && !lastName) {
    const full =
      (typeof nameSrc.fullName === 'string' && nameSrc.fullName) ||
      (typeof nameSrc.name === 'string' && nameSrc.name) ||
      (typeof data.fullName === 'string' && data.fullName) ||
      '';
    const sp = splitFullName(full);
    firstName = sp.first;
    lastName = sp.last;
  }

  const picFromData = typeof data.pictureUrl === 'string' ? data.pictureUrl.trim() : '';
  const picNested =
    nested && typeof nested.pictureUrl === 'string' ? nested.pictureUrl.trim() : '';
  const pictureUrl = picFromData || picNested;

  const emailRaw =
    (typeof nameSrc.email === 'string' && nameSrc.email) || (typeof data.email === 'string' && data.email) || '';
  const email = emailRaw.includes('@') ? emailRaw.trim() : '';

  const patch = {};
  if (firstName) patch.firstName = firstName.trim();
  if (lastName) patch.lastName = lastName.trim();
  if (email) patch.email = email;
  if (pictureUrl) patch.pictureUrl = pictureUrl;
  return Object.keys(patch).length > 0 ? patch : null;
}

function applyUberUserPayloadToStore(userId, { data, raw }) {
  const fetchedAt = new Date().toISOString();
  store.uberEatsUserByUserId.set(userId, { data, raw, fetchedAt });

  const user = store.users.get(userId);
  if (!user) return false;
  const patch = profilePatchFromUberUserData(data);
  if (!patch) return true;

  store.users.set(userId, {
    ...user,
    ...patch
  });
  return true;
}

const MAX_ORDER_SYNC_PAGES = 250;

function getCompletedAt(rawOrder) {
  const base = rawOrder?.baseEaterOrder || rawOrder;
  return base?.completedAt || base?.created_at || rawOrder?.created_at || '';
}

function extractWorkflowUuid(rawOrder) {
  const base = rawOrder?.baseEaterOrder || rawOrder;
  return (
    rawOrder?.workflowUUID ||
    rawOrder?.workflowUuid ||
    base?.workflowUUID ||
    base?.workflowUuid ||
    base?.uuid ||
    rawOrder?.uuid ||
    ''
  );
}

/** Same identity as merge keys / DB order_uuid for normalized rows (see normalizeOrder). */
function stableOrderId(rawOrder) {
  const k =
    extractWorkflowUuid(rawOrder) ||
    rawOrder?.baseEaterOrder?.uuid ||
    (typeof rawOrder?.uuid === 'string' ? rawOrder.uuid : '') ||
    '';
  if (k) return String(k);
  return `jsonslice_${JSON.stringify(rawOrder).slice(0, 80)}`;
}

function knownKeysFromStoredOrders(orders) {
  const s = new Set();
  for (const o of orders) {
    if (o?.uuid) s.add(String(o.uuid));
    const base = o?.baseEaterOrder;
    if (base?.uuid) s.add(String(base.uuid));
    const w = extractWorkflowUuid(o);
    if (w) s.add(String(w));
  }
  return s;
}

function extractNextWorkflowCursor(responseJson, rawOrders) {
  const data = responseJson?.data || {};
  const direct =
    data.lastWorkflowUUID ||
    data.nextLastWorkflowUUID ||
    data.nextWorkflowUUID ||
    data.pagination?.lastWorkflowUUID ||
    data.pagination?.nextCursor ||
    '';

  if (typeof direct === 'string' && direct.length > 0) {
    return direct;
  }

  if (!rawOrders.length) {
    return '';
  }

  // Uber returns a map; treat batch as newest-first and use the oldest row as the next cursor.
  const sorted = [...rawOrders].sort((a, b) => {
    const ta = new Date(getCompletedAt(a)).getTime() || 0;
    const tb = new Date(getCompletedAt(b)).getTime() || 0;
    return tb - ta;
  });
  const oldestInBatch = sorted[sorted.length - 1];
  return extractWorkflowUuid(oldestInBatch);
}

async function fetchPastOrdersPage(session, lastWorkflowUUID) {
  const response = await fetch(`${UBER_EATS_BASE_URL}/_p/api/getPastOrdersV1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: buildCookieHeader(session),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'x-csrf-token': 'x'
    },
    body: JSON.stringify({ lastWorkflowUUID })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`UberEats request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const responseJson = await response.json();
  const data = responseJson?.data || {};
  let rawOrders = Object.values(data.ordersMap || {});
  if (Array.isArray(data.orders) && data.orders.length > 0) {
    rawOrders = data.orders;
  }

  const nextCursor = extractNextWorkflowCursor(responseJson, rawOrders);
  return { rawOrders, nextCursor, responseJson };
}

function progressPercentForPage(pageIndex) {
  return Math.min(99, Math.round(100 * (1 - Math.pow(0.88, pageIndex))));
}

/** Paginate Uber past orders; with earlyStop, stops once a batch overlaps known order ids (newest-first). */
async function fetchUberOrdersPaginated(session, onProgress, options) {
  const { earlyStop, knownKeySet = new Set() } = options;
  const collected = new Map();
  let lastWorkflowUUID = '';
  let page = 0;

  while (page < MAX_ORDER_SYNC_PAGES) {
    const { rawOrders, nextCursor } = await fetchPastOrdersPage(session, lastWorkflowUUID);

    if (rawOrders.length === 0) {
      break;
    }

    const sorted = [...rawOrders].sort((a, b) => {
      const ta = new Date(getCompletedAt(a)).getTime() || 0;
      const tb = new Date(getCompletedAt(b)).getTime() || 0;
      return tb - ta;
    });

    const unknownInBatch = sorted.filter((o) => !knownKeySet.has(stableOrderId(o)));
    const entireBatchAlreadyKnown = sorted.length > 0 && unknownInBatch.length === 0;

    for (const o of unknownInBatch) {
      const k = stableOrderId(o);
      collected.set(k, o);
    }

    page += 1;
    onProgress({
      type: 'progress',
      page,
      batchSize: rawOrders.length,
      cumulativeOrders: collected.size,
      percent: progressPercentForPage(page)
    });

    if (earlyStop && entireBatchAlreadyKnown) {
      break;
    }

    const next = typeof nextCursor === 'string' ? nextCursor : '';
    if (!next || next === lastWorkflowUUID) {
      break;
    }
    lastWorkflowUUID = next;
  }

  return { rawByKey: collected, pages: page };
}

async function runFullOrderSync(session, onProgress) {
  const { rawByKey, pages } = await fetchUberOrdersPaginated(session, onProgress, { earlyStop: false });
  const normalizedOrders = [...rawByKey.values()].filter(isCompleteRawOrder).map(normalizeOrder);
  const syncedAt = new Date().toISOString();
  return { normalizedOrders, pages, syncedAt };
}

function mergeNormalizedOrders(existing, incoming) {
  const map = new Map();
  for (const o of existing) {
    if (o?.uuid) map.set(String(o.uuid), o);
  }
  for (const o of incoming) {
    if (o?.uuid) map.set(String(o.uuid), o);
  }
  return [...map.values()].sort((a, b) => new Date(b.order_time).getTime() - new Date(a.order_time).getTime());
}

async function runIncrementalOrderSync(session, userId, onProgress) {
  const existing = ordersPersistence.loadOrdersForUser(userId);
  const knownKeySet = knownKeysFromStoredOrders(existing);
  const { rawByKey, pages } = await fetchUberOrdersPaginated(session, onProgress, {
    earlyStop: knownKeySet.size > 0,
    knownKeySet
  });
  const newNormalized = [...rawByKey.values()].filter(isCompleteRawOrder).map(normalizeOrder);
  if (newNormalized.length === 0) {
    return { merged: existing, pages, newCount: 0, syncedAt: ordersPersistence.getLastSyncAt(userId) };
  }
  const merged = mergeNormalizedOrders(existing, newNormalized);
  const syncedAt = new Date().toISOString();
  return { merged, pages, newCount: newNormalized.length, syncedAt };
}

/**
 * Returns true only when the raw UberEats order has both a real timestamp
 * and a non-zero price.  Orders that fail either check are missing essential
 * data and would show up as $0 / today's date in the UI.
 */
function isCompleteRawOrder(rawOrder) {
  const base = rawOrder?.baseEaterOrder || rawOrder;
  const hasDate = Boolean(base?.completedAt || base?.created_at || rawOrder?.created_at);
  const fareInfo = rawOrder?.fareInfo || base?.fareInfo || null;
  const hasPrice = Boolean(fareInfo?.totalPrice && fareInfo.totalPrice > 0);
  return hasDate && hasPrice;
}

function normalizeOrder(rawOrder) {
  const base = rawOrder?.baseEaterOrder || rawOrder;
  const completedAt = base?.completedAt || base?.created_at || rawOrder?.created_at || new Date().toISOString();
  const fareInfo = rawOrder?.fareInfo || base?.fareInfo || null;
  const totalAmount = fareInfo?.totalPrice ? fareInfo.totalPrice / 100 : 0;
  const orderDate = new Date(completedAt);
  return {
    uuid: stableOrderId(rawOrder),
    baseEaterOrder: base,
    storeInfo: rawOrder?.storeInfo || base?.storeInfo || null,
    fareInfo,
    interactionType: rawOrder?.interactionType || null,
    restaurant_name:
      rawOrder?.storeInfo?.title ||
      base?.storeInfo?.title ||
      rawOrder?.restaurant?.name ||
      'Unknown Restaurant',
    total_amount: totalAmount,
    order_time: completedAt,
    time_of_day: orderDate.getHours() < 12 ? 'morning' : orderDate.getHours() < 17 ? 'lunch' : 'dinner',
    day_of_week: orderDate.getDay(),
    items: base?.shoppingCart?.items || rawOrder?.items || []
  };
}

function buildOrderStats(orders) {
  const total_orders = orders.length;
  const total_spent = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
  const avg_order_value = total_orders > 0 ? total_spent / total_orders : 0;
  const unique_restaurants = new Set(orders.map((order) => order.restaurant_name)).size;
  const order_days = new Set(orders.map((order) => new Date(order.order_time).toISOString().slice(0, 10))).size;
  return { total_orders, total_spent, avg_order_value, unique_restaurants, order_days };
}

function calculatePredictionAccuracy(predictions) {
  const total_predictions = predictions.length;
  const correct_predictions = predictions.filter((p) => p.is_correct === true).length;
  const scored = predictions.filter((p) => p.is_correct !== undefined).length;
  const accuracy_percentage = scored > 0 ? Math.round((correct_predictions / scored) * 100) : 0;
  return { total_predictions, correct_predictions, accuracy_percentage };
}

function buildAnalytics(orders) {
  const dayMap = new Map();
  const timeMap = new Map();
  const monthMap = new Map();
  const restaurantMap = new Map();

  for (const order of orders) {
    const dayKey = order.day_of_week ?? new Date(order.order_time).getDay();
    const timeKey = order.time_of_day || 'unknown';
    const monthKey = new Date(order.order_time).toISOString().slice(0, 7) + '-01';
    const restaurantKey = order.restaurant_name || 'Unknown';
    const amount = order.total_amount || 0;

    const dayEntry = dayMap.get(dayKey) || { day_of_week: dayKey, order_count: 0, total_spent: 0 };
    dayEntry.order_count += 1;
    dayEntry.total_spent += amount;
    dayMap.set(dayKey, dayEntry);

    const timeEntry = timeMap.get(timeKey) || { time_of_day: timeKey, order_count: 0, total_spent: 0 };
    timeEntry.order_count += 1;
    timeEntry.total_spent += amount;
    timeMap.set(timeKey, timeEntry);

    const monthEntry = monthMap.get(monthKey) || { month: monthKey, order_count: 0, total_spent: 0 };
    monthEntry.order_count += 1;
    monthEntry.total_spent += amount;
    monthMap.set(monthKey, monthEntry);

    const restEntry = restaurantMap.get(restaurantKey) || { restaurant_name: restaurantKey, order_count: 0, total_spent: 0 };
    restEntry.order_count += 1;
    restEntry.total_spent += amount;
    restaurantMap.set(restaurantKey, restEntry);
  }

  const withAvg = (entry) => ({ ...entry, avg_amount: entry.order_count > 0 ? entry.total_spent / entry.order_count : 0 });

  return {
    dayPatterns: Array.from(dayMap.values()).map(withAvg).sort((a, b) => a.day_of_week - b.day_of_week),
    timePatterns: Array.from(timeMap.values()).map(withAvg).sort((a, b) => b.order_count - a.order_count),
    monthlyTrends: Array.from(monthMap.values()).map(withAvg).sort((a, b) => (a.month < b.month ? 1 : -1)),
    favoriteCuisines: Array.from(restaurantMap.values()).map(withAvg).sort((a, b) => b.order_count - a.order_count)
  };
}

function error(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

async function handleApiRequest(method, path, body) {
  const user = getCurrentUser();
  const userId = user.id;
  hydrateUberSessionFromDiskIfNeeded(userId);
  const orders = store.ordersByUser.get(userId) || [];
  const predictions = store.predictionsByUser.get(userId) || [];

  if (method === 'GET' && path === '/api/auth/session') {
    const session = getUberSession(userId);
    const uberConnected = Boolean(session);
    return {
      user,
      sessionToken: session?.id || null,
      uberConnected,
      uberSession: {
        connected: uberConnected,
        lastImportedAt: session?.createdAt || null,
        lastSyncAt: store.lastSyncByUser.get(userId) || null
      }
    };
  }

  if (method === 'GET' && path === '/api/uber/session/status') {
    const session = getUberSession(userId);
    return {
      connected: Boolean(session),
      lastImportedAt: session?.createdAt || null,
      lastSyncAt: store.lastSyncByUser.get(userId) || null
    };
  }

  if (method === 'POST' && path === '/api/uber/session/import') {
    const parsedCookie = parseCookieHeader(body?.cookieHeader);
    const resolvedSid = body?.sid || parsedCookie.sid;
    const resolvedCsrf = body?.csrfToken || parsedCookie.csrf_token;
    if (!resolvedSid) throw error(400, 'Missing sid cookie. Provide sid directly or via cookieHeader.');

    const session = {
      id: `sess_${Date.now()}`,
      sid: resolvedSid,
      csrfToken: resolvedCsrf || null,
      createdAt: new Date().toISOString()
    };
    store.uberSessions.set(userId, session);
    sessionPersistence.write(session);
    try {
      await loadUberEatsUserForUserId(userId);
    } catch (err) {
      console.error('[uber] getUserV1 after import failed', err);
    }
    return { message: 'UberEats session imported', connected: true, createdAt: session.createdAt };
  }

  if (method === 'DELETE' && path === '/api/uber/session') {
    store.uberSessions.delete(userId);
    store.uberEatsUserByUserId.delete(userId);
    const localUser = store.users.get(userId);
    if (localUser) {
      store.users.set(userId, { ...localUser, pictureUrl: null });
    }
    store.ordersByUser.delete(userId);
    store.predictionsByUser.delete(userId);
    store.lastSyncByUser.delete(userId);
    try {
      ordersPersistence.clearOrdersForUser(userId);
    } catch (err) {
      console.error('[orders-persistence] Failed to clear orders', err);
    }
    sessionPersistence.clear();
    return { message: 'UberEats session removed' };
  }

  if (method === 'POST' && path === '/api/orders/sync') {
    return executeOrderSyncWithProgress(userId, () => {});
  }

  if (method === 'GET' && path === '/api/orders') return { orders };
  if (method === 'GET' && path === '/api/orders/stats') return { stats: buildOrderStats(orders) };

  if (method === 'GET' && path === '/api/orders/feed') {
    const restaurants = [];
    const seen = new Set();
    for (const order of orders) {
      const uuid = order?.storeInfo?.uuid || order.restaurant_name;
      if (!uuid || seen.has(uuid)) continue;
      seen.add(uuid);
      restaurants.push({
        uuid,
        title: order?.storeInfo?.title || order.restaurant_name,
        rating: null,
        image: order?.storeInfo?.heroImageUrl ? { url: order.storeInfo.heroImageUrl } : undefined,
        meta: [{ text: 'From your recent orders', type: 'description' }],
        signposts: [{ text: 'Order again', type: 'recommendation' }]
      });
    }
    return { feed: { source: 'order-history' }, restaurants, count: restaurants.length };
  }

  if (method === 'GET' && path === '/api/users/dashboard') {
    const stats = buildOrderStats(orders);
    return {
      recentOrders: orders.slice(0, 10),
      recentPredictions: predictions.slice(0, 10),
      stats: {
        total_orders: stats.total_orders,
        total_predictions: predictions.length,
        correct_predictions: predictions.filter((p) => p.is_correct).length,
        total_spent: stats.total_spent
      }
    };
  }

  if (method === 'GET' && path === '/api/users/profile') {
    const uber = store.uberEatsUserByUserId.get(userId) || null;
    return {
      user,
      uberEatsUser: uber ? { data: uber.data, fetchedAt: uber.fetchedAt } : null
    };
  }

  if (method === 'PUT' && path === '/api/users/profile') {
    const nextUser = {
      ...user,
      firstName: body?.firstName || user.firstName,
      lastName: body?.lastName || user.lastName
    };
    store.users.set(userId, nextUser);
    return { user: nextUser };
  }

  if (method === 'DELETE' && path === '/api/users/account') {
    store.users.set(userId, {
      ...user,
      firstName: '',
      lastName: '',
      email: '',
      pictureUrl: null
    });
    store.uberSessions.delete(userId);
    store.uberEatsUserByUserId.delete(userId);
    store.ordersByUser.delete(userId);
    store.predictionsByUser.delete(userId);
    store.lastSyncByUser.delete(userId);
    try {
      ordersPersistence.clearOrdersForUser(userId);
    } catch (err) {
      console.error('[orders-persistence] Failed to clear orders', err);
    }
    try {
      predictionsPersistence.clearPredictionsForUser(userId);
    } catch (err) {
      console.error('[predictions-persistence] Failed to clear predictions', err);
    }
    sessionPersistence.clear();
    return { message: 'Account data cleared' };
  }

  if (method === 'GET' && path === '/api/predictions') return { predictions };
  if (method === 'GET' && path === '/api/predictions/accuracy') return { accuracy: calculatePredictionAccuracy(predictions) };

  if (method === 'POST' && path === '/api/predictions/generate') {
    if (orders.length === 0) throw error(400, 'Sync orders before generating predictions');
    const dayOfWeek = body?.dayOfWeek ?? new Date().getDay();
    const timeOfDay = body?.timeOfDay || 'lunch';
    let llmResult;
    try {
      llmResult = await generatePrediction(orders, dayOfWeek, timeOfDay);
    } catch (llmErr) {
      const modelErrors = new Set([
        'deviceNotEligible',
        'appleIntelligenceNotEnabled',
        'modelNotReady',
        'modelUnavailable',
        'helperNotFound'
      ]);
      if (modelErrors.has(llmErr.code)) {
        throw Object.assign(error(503, llmErr.message), { model_status: llmErr.code });
      }
      throw error(500, `Prediction failed: ${llmErr.message}`);
    }
    const prediction = {
      id: `pred_${Date.now()}`,
      predicted_restaurant: llmResult.predicted_restaurant,
      predicted_items: llmResult.predicted_items,
      confidence_score: llmResult.confidence_score,
      reasoning: llmResult.reasoning,
      source: llmResult.source,
      day_of_week: dayOfWeek,
      time_of_day: timeOfDay,
      created_at: llmResult.created_at
    };
    store.predictionsByUser.set(userId, [prediction, ...predictions]);
    try {
      predictionsPersistence.savePrediction(userId, prediction);
    } catch (err) {
      console.error('[predictions-persistence] Failed to save prediction', err);
    }
    return { prediction };
  }

  if (method === 'POST' && path === '/api/predictions/feedback') {
    const isCorrect = Boolean(body?.isCorrect);
    const updated = predictions.map((prediction) =>
      prediction.id === body?.predictionId ? { ...prediction, is_correct: isCorrect } : prediction
    );
    store.predictionsByUser.set(userId, updated);
    try {
      predictionsPersistence.updateFeedback(userId, body?.predictionId, isCorrect);
    } catch (err) {
      console.error('[predictions-persistence] Failed to update feedback', err);
    }
    return { success: true };
  }

  if (method === 'GET' && path === '/api/analytics/patterns') {
    return buildAnalytics(orders);
  }

  throw error(404, `No desktop service route for ${method} ${path}`);
}

async function executeOrderSyncWithProgress(userId, onProgress) {
  const session = getUberSession(userId);
  if (!session) throw error(401, 'Connect UberEats session first');

  const { normalizedOrders, pages, syncedAt } = await runFullOrderSync(session, onProgress);
  store.ordersByUser.set(userId, normalizedOrders);
  store.lastSyncByUser.set(userId, syncedAt);
  try {
    ordersPersistence.replaceOrdersForUser(userId, normalizedOrders);
    ordersPersistence.setLastSyncAt(userId, syncedAt);
  } catch (err) {
    console.error('[orders-persistence] Failed to save orders', err);
  }

  return {
    message: 'Orders synced from UberEats',
    syncedCount: normalizedOrders.length,
    pages,
    syncedAt
  };
}

async function executeOrderSyncWithProgressForDefaultUser(onProgress) {
  const user = getCurrentUser();
  return executeOrderSyncWithProgress(user.id, onProgress);
}

function bootstrapPersistedOrders() {
  const userId = APP_USER_ID;
  try {
    const orders = ordersPersistence.loadOrdersForUser(userId);
    const lastSync = ordersPersistence.getLastSyncAt(userId);
    if (orders.length > 0) {
      store.ordersByUser.set(userId, orders);
    }
    if (lastSync) {
      store.lastSyncByUser.set(userId, lastSync);
    }
  } catch (err) {
    console.error('[orders-persistence] Failed to load orders from disk', err);
  }
}

function bootstrapPersistedPredictions() {
  const userId = APP_USER_ID;
  try {
    const predictions = predictionsPersistence.loadPredictionsForUser(userId);
    if (predictions.length > 0) {
      store.predictionsByUser.set(userId, predictions);
    }
  } catch (err) {
    console.error('[predictions-persistence] Failed to load predictions from disk', err);
  }
}

async function loadUberEatsUserForUserId(userId) {
  hydrateUberSessionFromDiskIfNeeded(userId);
  const session = getUberSession(userId);
  if (!session) {
    return { ok: false, reason: 'no_session' };
  }
  try {
    const payload = await fetchUberEatsUserV1(session);
    applyUberUserPayloadToStore(userId, payload);
    return { ok: true };
  } catch (err) {
    console.error('[uber] getUserV1 failed', err);
    return { ok: false, error: err };
  }
}

async function loadUberEatsUserOnStartup() {
  return loadUberEatsUserForUserId(APP_USER_ID);
}

async function refreshOrdersFromUberOnStartup() {
  const userId = APP_USER_ID;
  const session = getUberSession(userId);
  if (!session) {
    return { updated: false, newCount: 0 };
  }
  try {
    const { merged, pages, newCount, syncedAt } = await runIncrementalOrderSync(session, userId, () => {});
    if (newCount === 0) {
      return { updated: false, newCount: 0, pages };
    }
    store.ordersByUser.set(userId, merged);
    if (syncedAt) {
      store.lastSyncByUser.set(userId, syncedAt);
    }
    try {
      ordersPersistence.replaceOrdersForUser(userId, merged);
      if (syncedAt) {
        ordersPersistence.setLastSyncAt(userId, syncedAt);
      }
    } catch (err) {
      console.error('[orders-persistence] Failed to save orders after incremental refresh', err);
    }
    return { updated: true, newCount, pages };
  } catch (err) {
    console.error('[orders] Incremental refresh on startup failed', err);
    return { updated: false, newCount: 0 };
  }
}

module.exports = {
  handleApiRequest,
  executeOrderSyncWithProgressForDefaultUser,
  restorePersistedUberSession,
  bootstrapPersistedOrders,
  bootstrapPersistedPredictions,
  refreshOrdersFromUberOnStartup,
  loadUberEatsUserOnStartup
};

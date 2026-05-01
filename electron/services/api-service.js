const UBER_EATS_BASE_URL = 'https://www.ubereats.com';

const DEFAULT_USER_ID = process.env.DEMO_USER_ID || 'local-user';

const store = {
  users: new Map([
    [
      DEFAULT_USER_ID,
      {
        id: DEFAULT_USER_ID,
        email: process.env.DEMO_USER_EMAIL || 'local@example.com',
        firstName: 'Local',
        lastName: 'User',
        created_at: new Date().toISOString(),
        preferences: {}
      }
    ]
  ]),
  uberSessions: new Map(),
  ordersByUser: new Map(),
  predictionsByUser: new Map(),
  lastSyncByUser: new Map()
};

function getCurrentUser() {
  return store.users.get(DEFAULT_USER_ID);
}

function getUberSession(userId) {
  return store.uberSessions.get(userId) || null;
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

async function fetchPastOrdersFromUber(session, lastWorkflowUUID = '') {
  const response = await fetch(`${UBER_EATS_BASE_URL}/_p/api/getPastOrdersV1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: buildCookieHeader(session),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      'x-csrf-token': 'x',
    },
    body: JSON.stringify({ lastWorkflowUUID })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`UberEats request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const responseJson = await response.json();
  return Object.values(responseJson?.data?.ordersMap || {});
}

function normalizeOrder(rawOrder) {
  const base = rawOrder?.baseEaterOrder || rawOrder;
  const completedAt = base?.completedAt || base?.created_at || rawOrder?.created_at || new Date().toISOString();
  const fareInfo = rawOrder?.fareInfo || base?.fareInfo || null;
  const totalAmount = fareInfo?.totalPrice ? fareInfo.totalPrice / 100 : 0;
  const orderDate = new Date(completedAt);
  return {
    uuid: base?.uuid || rawOrder?.uuid || `order_${Date.now()}`,
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
  const orders = store.ordersByUser.get(userId) || [];
  const predictions = store.predictionsByUser.get(userId) || [];

  if (method === 'GET' && path === '/api/auth/session') {
    const session = getUberSession(userId);
    return { user, sessionToken: session?.id || null, uberConnected: Boolean(session) };
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
    return { message: 'UberEats session imported', connected: true, createdAt: session.createdAt };
  }

  if (method === 'DELETE' && path === '/api/uber/session') {
    store.uberSessions.delete(userId);
    store.ordersByUser.delete(userId);
    store.predictionsByUser.delete(userId);
    store.lastSyncByUser.delete(userId);
    return { message: 'UberEats session removed' };
  }

  if (method === 'POST' && path === '/api/orders/sync') {
    const session = getUberSession(userId);
    if (!session) throw error(401, 'Connect UberEats session first');
    const rawOrders = await fetchPastOrdersFromUber(session, body?.lastWorkflowUUID || '');
    const normalizedOrders = rawOrders.map(normalizeOrder);
    const syncTime = new Date().toISOString();
    store.ordersByUser.set(userId, normalizedOrders);
    store.lastSyncByUser.set(userId, syncTime);
    return { message: 'Orders synced from UberEats', syncedCount: normalizedOrders.length, syncedAt: syncTime };
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

  if (method === 'GET' && path === '/api/users/profile') return { user };

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
    store.users.set(userId, { ...user, firstName: 'Local', lastName: 'User' });
    store.uberSessions.delete(userId);
    store.ordersByUser.delete(userId);
    store.predictionsByUser.delete(userId);
    store.lastSyncByUser.delete(userId);
    return { message: 'Account data cleared' };
  }

  if (method === 'GET' && path === '/api/predictions') return { predictions };
  if (method === 'GET' && path === '/api/predictions/accuracy') return { accuracy: calculatePredictionAccuracy(predictions) };

  if (method === 'POST' && path === '/api/predictions/generate') {
    if (orders.length === 0) throw error(400, 'Sync orders before generating predictions');
    const scoped = orders.filter((o) => o.day_of_week === body?.dayOfWeek && o.time_of_day === body?.timeOfDay);
    const pool = scoped.length > 0 ? scoped : orders;
    const top = pool[0];
    const prediction = {
      id: `pred_${Date.now()}`,
      predicted_restaurant: top?.restaurant_name || 'Unknown Restaurant',
      predicted_items: (top?.items || []).slice(0, 3).map((i) => i.title || i.name).filter(Boolean),
      confidence_score: scoped.length > 0 ? 0.82 : 0.55,
      day_of_week: body?.dayOfWeek ?? new Date().getDay(),
      time_of_day: body?.timeOfDay || 'lunch',
      created_at: new Date().toISOString()
    };
    store.predictionsByUser.set(userId, [prediction, ...predictions]);
    return { prediction };
  }

  if (method === 'POST' && path === '/api/predictions/feedback') {
    const updated = predictions.map((prediction) =>
      prediction.id === body?.predictionId ? { ...prediction, is_correct: Boolean(body?.isCorrect) } : prediction
    );
    store.predictionsByUser.set(userId, updated);
    return { success: true };
  }

  if (method === 'GET' && path === '/api/analytics/patterns') {
    return buildAnalytics(orders);
  }

  throw error(404, `No desktop service route for ${method} ${path}`);
}

module.exports = { handleApiRequest };

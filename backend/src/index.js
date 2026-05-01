// Deprecated: backend API server removed in favor of Electron IPC services.
// Use `pnpm electron:dev` from the repository root.
console.error('This project no longer runs a standalone backend API server.');
process.exit(1);
require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT || 3001);
const UBER_EATS_BASE_URL = 'https://www.ubereats.com';
const DEFAULT_USER_ID = process.env.DEMO_USER_ID || 'local-user';

app.use(cors());
app.use(express.json());

const inMemoryStore = {
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
  lastSyncByUser: new Map()
};

function getCurrentUser() {
  return inMemoryStore.users.get(DEFAULT_USER_ID);
}

function getUberSession(userId) {
  return inMemoryStore.uberSessions.get(userId) || null;
}

function parseCookieHeader(rawCookie) {
  if (!rawCookie || typeof rawCookie !== 'string') {
    return {};
  }

  return rawCookie
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const [key, ...rest] = part.split('=');
      if (!key || rest.length === 0) {
        return acc;
      }
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
  const payload = { lastWorkflowUUID };

  const response = await fetch(`${UBER_EATS_BASE_URL}/_p/api/getPastOrdersV1`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: buildCookieHeader(session),
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`UberEats request failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const responseJson = await response.json();
  const ordersMap = responseJson?.data?.ordersMap || {};

  return Object.values(ordersMap);
}

function normalizeOrder(rawOrder) {
  const base = rawOrder?.baseEaterOrder || rawOrder;
  const completedAt = base?.completedAt || base?.created_at || rawOrder?.created_at || new Date().toISOString();
  const fareInfo = rawOrder?.fareInfo || base?.fareInfo || null;
  const totalAmount = fareInfo?.totalPrice ? fareInfo.totalPrice / 100 : 0;
  const orderDate = new Date(completedAt);

  return {
    uuid: base?.uuid || rawOrder?.uuid,
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
    time_of_day: orderDate.getHours() < 12 ? 'Morning' : orderDate.getHours() < 17 ? 'Afternoon' : 'Evening',
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

  return {
    total_orders,
    total_spent,
    avg_order_value,
    unique_restaurants,
    order_days
  };
}

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/auth/session', (_req, res) => {
  const user = getCurrentUser();
  const session = getUberSession(user.id);

  return res.status(200).json({
    user,
    sessionToken: session?.id || null,
    uberConnected: Boolean(session)
  });
});

app.get('/api/uber/session/status', (_req, res) => {
  const user = getCurrentUser();
  const session = getUberSession(user.id);

  res.status(200).json({
    connected: Boolean(session),
    lastImportedAt: session?.createdAt || null,
    lastSyncAt: inMemoryStore.lastSyncByUser.get(user.id) || null
  });
});

app.post('/api/uber/session/import', (req, res) => {
  const { sid, csrfToken, cookieHeader } = req.body || {};
  const user = getCurrentUser();
  const parsedCookie = parseCookieHeader(cookieHeader);

  const resolvedSid = sid || parsedCookie.sid;
  const resolvedCsrf = csrfToken || parsedCookie.csrf_token;

  if (!resolvedSid) {
    return res.status(400).json({
      message: 'Missing sid cookie. Provide sid directly or via cookieHeader.'
    });
  }

  const session = {
    id: `sess_${Date.now()}`,
    sid: resolvedSid,
    csrfToken: resolvedCsrf || null,
    createdAt: new Date().toISOString()
  };

  inMemoryStore.uberSessions.set(user.id, session);
  return res.status(200).json({
    message: 'UberEats session imported',
    connected: true,
    createdAt: session.createdAt
  });
});

app.delete('/api/uber/session', (_req, res) => {
  const user = getCurrentUser();
  inMemoryStore.uberSessions.delete(user.id);
  inMemoryStore.ordersByUser.delete(user.id);
  inMemoryStore.lastSyncByUser.delete(user.id);
  res.status(200).json({ message: 'UberEats session removed' });
});

app.post('/api/orders/sync', async (req, res) => {
  const user = getCurrentUser();
  const session = getUberSession(user.id);

  if (!session) {
    return res.status(401).json({ message: 'Connect UberEats session first' });
  }

  try {
    const rawOrders = await fetchPastOrdersFromUber(session, req.body?.lastWorkflowUUID || '');
    const normalizedOrders = rawOrders.map(normalizeOrder);
    inMemoryStore.ordersByUser.set(user.id, normalizedOrders);
    const syncTime = new Date().toISOString();
    inMemoryStore.lastSyncByUser.set(user.id, syncTime);

    return res.status(200).json({
      message: 'Orders synced from UberEats',
      syncedCount: normalizedOrders.length,
      syncedAt: syncTime
    });
  } catch (error) {
    return res.status(502).json({
      message: 'Failed to sync UberEats orders',
      error: error.message
    });
  }
});

app.get('/api/orders', (_req, res) => {
  const user = getCurrentUser();
  const orders = inMemoryStore.ordersByUser.get(user.id) || [];
  res.status(200).json({ orders });
});

app.get('/api/orders/stats', (_req, res) => {
  const user = getCurrentUser();
  const orders = inMemoryStore.ordersByUser.get(user.id) || [];
  res.status(200).json({ stats: buildOrderStats(orders) });
});

app.get('/api/orders/feed', (_req, res) => {
  const user = getCurrentUser();
  const orders = inMemoryStore.ordersByUser.get(user.id) || [];

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

  res.status(200).json({
    feed: { source: 'order-history' },
    restaurants,
    count: restaurants.length
  });
});

app.get('/api/users/dashboard', (_req, res) => {
  const user = getCurrentUser();
  const orders = inMemoryStore.ordersByUser.get(user.id) || [];
  const stats = buildOrderStats(orders);

  res.status(200).json({
    recentOrders: orders.slice(0, 10),
    recentPredictions: [],
    stats: {
      total_orders: stats.total_orders,
      total_predictions: 0,
      correct_predictions: 0,
      total_spent: stats.total_spent
    }
  });
});

app.get('/api/users/profile', (_req, res) => {
  const user = getCurrentUser();
  res.status(200).json({ user });
});

app.put('/api/users/profile', (req, res) => {
  const user = getCurrentUser();
  const nextUser = {
    ...user,
    firstName: req.body?.firstName || user.firstName,
    lastName: req.body?.lastName || user.lastName
  };
  inMemoryStore.users.set(user.id, nextUser);
  res.status(200).json({ user: nextUser });
});

app.delete('/api/users/account', (_req, res) => {
  const user = getCurrentUser();
  inMemoryStore.users.set(user.id, {
    ...user,
    firstName: 'Local',
    lastName: 'User'
  });
  inMemoryStore.uberSessions.delete(user.id);
  inMemoryStore.ordersByUser.delete(user.id);
  inMemoryStore.lastSyncByUser.delete(user.id);
  res.status(200).json({ message: 'Account data cleared' });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});


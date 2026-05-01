require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Minimal session endpoint expected by frontend useAuth hook.
app.get('/api/auth/session', (_req, res) => {
  const fakeUserId = process.env.DEMO_USER_ID || 'local-user';
  const fakeEmail = process.env.DEMO_USER_EMAIL || 'local@example.com';

  res.status(200).json({
    user: {
      id: fakeUserId,
      email: fakeEmail,
      firstName: 'Local',
      lastName: 'User'
    },
    sessionToken: 'local-dev-session-token'
  });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${port}`);
});


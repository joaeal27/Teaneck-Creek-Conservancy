import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient } from '@prisma/client';
import express from 'express';

for (const name of ['DATABASE_URL', 'GOOGLE_APPLICATION_CREDENTIALS']) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const firebaseApp =
  getApps()[0] ??
  initializeApp({
    credential: applicationDefault(),
  });
const firebaseAuth = getAuth(firebaseApp);
const prisma = new PrismaClient();
const app = express();

app.use(express.json({ limit: '16kb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

async function requireFirebaseUser(request, response, next) {
  const authorization = request.get('authorization');
  const [scheme, token] = authorization?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    response.status(401).json({ error: 'Sign in is required.' });
    return;
  }

  try {
    request.user = await firebaseAuth.verifyIdToken(token);
    next();
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    response.status(401).json({ error: 'Your session is invalid or expired.' });
  }
}

app.get('/api/trails', requireFirebaseUser, async (_request, response) => {
  try {
    const trails = await prisma.trail.findMany({
      orderBy: { createdAt: 'desc' },
    });
    response.json({ trails });
  } catch (error) {
    console.error('Failed to load trails:', error);
    response.status(500).json({ error: 'Unable to load trails.' });
  }
});

app.post('/api/trails', requireFirebaseUser, async (request, response) => {
  const { name, description } = request.body ?? {};

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 120) {
    response.status(400).json({ error: 'Trail name must be between 1 and 120 characters.' });
    return;
  }

  if (description != null && typeof description !== 'string') {
    response.status(400).json({ error: 'Trail description must be text.' });
    return;
  }

  try {
    const trail = await prisma.trail.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });
    response.status(201).json({ trail });
  } catch (error) {
    console.error('Failed to create trail:', error);
    response.status(500).json({ error: 'Unable to save trail.' });
  }
});

const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, '0.0.0.0', () => {
  console.log(`Trail API listening on port ${port}`);
});

async function shutdown() {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

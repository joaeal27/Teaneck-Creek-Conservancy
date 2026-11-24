import 'dotenv/config';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient } from '@prisma/client';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import express from 'express';
import { randomUUID } from 'node:crypto';

if (!process.env.DATABASE_URL) {
  throw new Error('Missing required environment variable: DATABASE_URL');
}

const firebaseAuth = process.env.GOOGLE_APPLICATION_CREDENTIALS
  ? getAuth(
      getApps()[0] ??
        initializeApp({
          credential: applicationDefault(),
        }),
    )
  : null;
const prisma = new PrismaClient();
const storageBucket = process.env.SUPABASE_S3_BUCKET ?? 'trail-photos';
const s3 =
  process.env.SUPABASE_S3_ENDPOINT &&
  process.env.SUPABASE_S3_REGION &&
  process.env.SUPABASE_S3_ACCESS_KEY_ID &&
  process.env.SUPABASE_S3_SECRET_ACCESS_KEY
    ? new S3Client({
        endpoint: process.env.SUPABASE_S3_ENDPOINT,
        region: process.env.SUPABASE_S3_REGION,
        forcePathStyle: true,
        credentials: {
          accessKeyId: process.env.SUPABASE_S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.SUPABASE_S3_SECRET_ACCESS_KEY,
          ...(process.env.SUPABASE_S3_SESSION_TOKEN
            ? { sessionToken: process.env.SUPABASE_S3_SESSION_TOKEN }
            : {}),
        },
      })
    : null;
const app = express();

app.use(express.json({ limit: '16mb' }));

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

async function requireFirebaseUser(request, response, next) {
  if (!firebaseAuth) {
    response.status(503).json({ error: 'Firebase authentication is not configured.' });
    return;
  }

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

app.get('/api/trails', async (_request, response) => {
  try {
    const trails = await prisma.trail.findMany({
      orderBy: { createdAt: 'desc' },
    });
    const trailsWithPhotos = await Promise.all(
      trails.map(async (trail) => {
        if (!trail.photoPath || !s3) {
          return { ...trail, photoUrl: null };
        }

        const photoUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: storageBucket,
            Key: trail.photoPath,
          }),
          { expiresIn: 60 * 60 },
        );
        return { ...trail, photoUrl };
      }),
    );
    response.json({ trails: trailsWithPhotos });
  } catch (error) {
    console.error('Failed to load trails:', error);
    response.status(500).json({ error: 'Unable to load trails.' });
  }
});

app.post('/api/trails', requireFirebaseUser, async (request, response) => {
  const { name, description, photo } = request.body ?? {};

  if (typeof name !== 'string' || name.trim().length === 0 || name.trim().length > 120) {
    response.status(400).json({ error: 'Trail name must be between 1 and 120 characters.' });
    return;
  }

  if (description != null && typeof description !== 'string') {
    response.status(400).json({ error: 'Trail description must be text.' });
    return;
  }

  if (photo != null) {
    if (
      typeof photo.base64 !== 'string' ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(photo.mimeType)
    ) {
      response.status(400).json({ error: 'Photo must be a JPEG, PNG, or WebP image.' });
      return;
    }
  }

  if (photo && !s3) {
    response.status(503).json({ error: 'Supabase S3-compatible storage is not configured.' });
    return;
  }

  try {
    let photoPath = null;

    if (photo) {
      const imageBuffer = Buffer.from(photo.base64, 'base64');
      if (imageBuffer.length === 0 || imageBuffer.length > 10 * 1024 * 1024) {
        response.status(400).json({ error: 'Photo must be no larger than 10 MB.' });
        return;
      }

      const extension =
        photo.mimeType === 'image/jpeg' ? 'jpg' :
        photo.mimeType === 'image/png' ? 'png' : 'webp';
      photoPath = `${request.user.uid}/${randomUUID()}.${extension}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: storageBucket,
          Key: photoPath,
          Body: imageBuffer,
          ContentType: photo.mimeType,
        }),
      );
    }

    const trail = await prisma.trail.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        photoPath,
      },
    });

    let photoUrl = null;
    if (photoPath) {
      photoUrl = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: storageBucket,
          Key: photoPath,
        }),
        { expiresIn: 60 * 60 },
      );
    }

    response.status(201).json({ trail: { ...trail, photoUrl } });
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

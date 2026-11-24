This will be the github for our 2026-27 Capstone project, Teaneck Creek Conservancy

Technologies used in our project:

This project will largely take the form of an android and ios app combining multiple databases. React Native + Expo + TypeScript --> Map Libre --> OpenStreetMap + GeoJSON --> 
Turf.js --> PostgreSQL --> Extension of PostGIS --> Prisma --> Node.js + Express --> OAuth2.0/OpenID Connect --> Google --> Supabase Storage --> SQLite -->

## Local Supabase and OrbStack

OrbStack runs the local Supabase containers. The Supabase stack provides PostgreSQL and a private `trail-photos` Storage bucket; the app's Express API uses Prisma to access PostgreSQL. The sample Prisma schema creates a `Trail` table with `name` and optional `description` fields. Replace or extend these placeholder fields to match the project database.

1. Make sure OrbStack is running and Docker uses its context (`docker context show` should print `orbstack`).
2. From the project root, run `supabase start`, then `supabase migration up` to create the private `trail-photos` bucket. Open Supabase Studio at `http://127.0.0.1:54323`.
3. Copy `backend/.env.example` to `backend/.env` if needed. Set `DATABASE_URL` to `postgresql://postgres:postgres@127.0.0.1:54322/postgres?schema=public`. If `backend/.env` already exists, update only `DATABASE_URL` and keep your Firebase credentials. Do not commit credentials.
4. From `backend/`, run `npm install`, `npm run db:generate`, and `npm run db:migrate:deploy` to create the sample trails table in Supabase PostgreSQL.
5. Start the API with `npm run dev`.
6. In the project root, copy `.env.example` to `.env`. For the iOS Simulator, set `EXPO_PUBLIC_API_URL=http://localhost:3000`; use your computer's LAN IP when testing on a physical phone.
7. Restart Expo with `npx expo start --dev-client`.

Trail photo uploads use Supabase Storage's S3-compatible API. Set `SUPABASE_S3_ENDPOINT`, `SUPABASE_S3_REGION`, `SUPABASE_S3_ACCESS_KEY_ID`, and `SUPABASE_S3_SECRET_ACCESS_KEY` in `backend/.env`; set `SUPABASE_S3_BUCKET` if the bucket is not `trail-photos`. For local Supabase, use `http://127.0.0.1:54321/storage/v1/s3`, region `local`, access key ID `stub`, and the local `ANON_KEY` as the secret access key. Set `SUPABASE_S3_SESSION_TOKEN` to a server-side JWT with Storage write access (the local service-role key works for local development). For hosted Supabase, use the endpoint, region, and S3 credentials from the project's Storage S3 settings; omit the session token when using generated S3 access keys. Keep all storage credentials backend-only. Photos remain private and the API returns short-lived S3-presigned URLs.

MapLibre React Native is installed for map views. After changing native dependencies, rebuild the development client:

- iOS: `npx expo run:ios`
- Android: `npx expo run:android`

Use `supabase status` to see the local service URLs and keys. Keep service-role keys on the backend; never put them in Expo `EXPO_PUBLIC_*` variables. The signed-in trail form reads and writes trail records through the API; adding a photo additionally requires the private Storage bucket and S3 credentials.
If you run `supabase db reset`, re-run `cd backend && npm run db:migrate:deploy` to restore the Prisma-managed trail table.

The login screen has a public, read-only PostgreSQL trail showcase and a local SQLite showcase, both available without Firebase sign-in. The SQLite button creates a local database, seeds two example trails once, and reads them from the device so they remain available offline. Trail creation still requires a valid Firebase ID token; the API verifies it before writing. Only publish trail names and descriptions that are intended to be public. For a database that already has tables, update `backend/prisma/schema.prisma` to match them before running a migration.

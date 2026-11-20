This will be the github for our 2026-27 Capstone project, Teaneck Creek Conservancy

Technologies used in our project:

This project will largely take the form of an android and ios app combining multiple databases. React Native + Expo + TypeScript --> Map Libre --> OpenStreetMap + GeoJSON --> 
Turf.js --> PostgreSQL --> Extension of PostGIS --> Prisma --> Node.js + Express --> OAuth2.0/OpenID Connect --> Google --> Supabase Storage --> SQLite -->

## Local trails API

The mobile app talks to PostgreSQL through the Express API in `backend/`; it does not connect to PostgreSQL directly. The sample Prisma schema creates a `Trail` table with `name` and optional `description` fields. Replace or extend these placeholder fields to match the project database.

1. Start PostgreSQL and create a database named `teaneck_creek`.
2. Copy `backend/.env.example` to `backend/.env`. Set `DATABASE_URL` to your local PostgreSQL connection string and `GOOGLE_APPLICATION_CREDENTIALS` to the path of a Firebase Admin service-account JSON file. Do not commit these files or credentials.
3. From `backend/`, run `npm install`, `npm run db:generate`, and `npm run db:migrate` to create the sample trails table.
4. Start the API with `npm run dev`.
5. In the project root, copy `.env.example` to `.env`. For the iOS Simulator, set `EXPO_PUBLIC_API_URL=http://localhost:3000`; use your computer's LAN IP when testing on a physical phone.
6. Restart Expo with `npx expo start --dev-client`.

The signed-in screen lists trails and lets authenticated users add one. The API verifies Firebase ID tokens before reading or writing trails. For a database that already has tables, update `backend/prisma/schema.prisma` to match them before running a migration.

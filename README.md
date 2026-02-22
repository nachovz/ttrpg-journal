# Bard's Journal App (React + Fastify + Firebase)

A multi-user journaling app with:
- Email/password account management
- Campaign creation/joining with unique join links
- Rich-text note editor
- Journal entries grouped by campaign
- Admin user visibility across all notes and admin note editing
- Note entry date + creation timestamp on every note

## Tech Stack
- Frontend: React + Vite + React Quill + Firebase Auth
- Backend: Fastify + Firebase Admin SDK
- Data: Cloud Firestore (`users`, `notes`)

## Project Structure
- `frontend/`: React app
- `backend/`: Fastify API

## 1) Firebase Setup
1. Create a Firebase project.
2. Enable **Authentication > Sign-in method > Email/Password**.
3. Create a **Cloud Firestore** database.
4. Create a **service account key** (Firebase Console > Project Settings > Service Accounts).
5. Add your admin email(s) to `ADMIN_EMAILS` in `backend/.env`.

## 2) Environment Variables

### Backend
Copy `backend/.env.example` to `backend/.env` and fill values.

### Frontend
Copy `frontend/.env.example` to `frontend/.env` and fill values from Firebase web app config.

## 3) Install and Run
From repository root:

```bash
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`

## 4) Local Mock Mode (No Firebase Quota Usage)
Use this mode for local development and manual testing without calling Firebase.

```bash
npm install
npm run dev:mock
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000`
- Local mock data file: `backend/.local-firebase-data.json`

### Fixed Playtest Users (local mock mode)
These users are intentionally stable across test runs so you can reuse them manually:

- `lina.stormrider.playtest@example.com` / `StrongPass123!`
  - Character name: `Lina Stormrider`
- `borin.emberforge.playtest@example.com` / `StrongPass123!`
  - Character name: `Borin Emberforge`
- `kael.nightbrook.playtest@example.com` / `StrongPass123!`
  - Character name: `Kael Nightbrook`
- `seraphina.valewind.playtest@example.com` / `StrongPass123!`
  - Character name: `Seraphina Valewind`

Notes:
- The Playwright mock-mode tests will create/login these accounts automatically.
- If you want a clean local state, stop the server and delete `backend/.local-firebase-data.json`.

## E2E Tests (Playwright)
Install browsers once:

```bash
npx playwright install
```

Set admin credentials (must match an admin email in `backend/.env`):

```bash
export E2E_ADMIN_EMAIL="your-admin-email@example.com"
export E2E_ADMIN_PASSWORD="your-admin-password"
```

Run tests:

```bash
npm run test:e2e
```

Default test policy in local development:
- Run tests against local mock mode unless you explicitly want to validate against Firebase.
- Prefer small batches (for example, a single Playwright spec) during iteration.

## API Summary
- `GET /health`
- `GET /api/me` (auth required): returns `{ uid, email, role }`
- `GET /api/campaigns` (auth required): returns campaigns where user is a member
- `POST /api/campaigns` (auth required, admin): create campaign
- `POST /api/campaigns/join` (auth required): join campaign via `joinCode`
- `GET /api/notes` (auth required):
  - `user` role: all notes in campaigns they belong to
  - `admin` role: all notes
- `POST /api/notes` (auth required): saves rich-text note in selected campaign with:
  - `entryDate` (YYYY-MM-DD)
  - `createdAt` (ISO timestamp)
- `PUT /api/notes/:id` (auth required, admin): edit a journal entry

## Firestore Collections
- `users/{uid}`:
  - `email`, `role`, `updatedAt`
- `notes/{id}`:
  - `userId`, `userEmail`, `username`, `characterName`, `dndBeyondUrl`
  - `campaignId`, `campaignName`
  - `contentHtml`, `entryDate`, `createdAt`, `updatedAt`
- `campaigns/{id}`:
  - `name`, `joinCode`, `createdBy`, `createdAt`, `memberIds[]`

## Admin Behavior
Role assignment is derived from backend `ADMIN_EMAILS` on `/api/me`. If a signed-in user's email matches that list, role is set to `admin`; otherwise `user`.

Admins can:
- Create campaigns and share campaign join links
- Edit any journal entry

## Notes
- This app stores HTML from the editor; if you plan to support untrusted rendering in other contexts, add sanitization.
- Configure Firestore indexes if prompted for compound queries.

# Setup and integration guide

For a first-time teammate installation, start with [the Windows team setup guide](team-setup.md). It covers the shared CAT304 project and the settings each developer must supply locally.

## Local development without credentials

Install Node.js 24.12+ for compatibility with the Firebase dependency engines. From the root run `npm ci`, copy `.env.example` to `.env` only if no environment file already exists, then run `npm run dev`. Open http://localhost:5173. The API uses port 4000 and binds to loopback. Individual commands are `npm run dev:web` and `npm run dev:api`. Local build/domain/API checks on this workstation used Node 22.12; authenticated Firebase operation remains a setup gate and should be verified on the supported version.

With `AUTH_REQUIRED=false` and blank `DATABASE_URL`, the browser creates a development session and the API persists its data in ignored `.local-data/` files. Clearing browser storage starts another workspace. This is a single-computer development mode, not account authentication or a public deployment.

## NLP and local model (no API key)

Install Python 3.12+ and run from the project root:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r services/nlp/requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --app-dir services/nlp --host 127.0.0.1 --port 8000
```

The first start downloads sentence-transformers/all-MiniLM-L6-v2. Network access is needed for installation/download. To reuse an existing model, set SENTENCE_TRANSFORMER_MODEL in .env to its absolute folder path. Do not commit weights. ENABLE_EMBEDDINGS=false runs phrase matching only. http://localhost:8000/health reports whether embeddings loaded. The interface identifies unavailable NLP and still provides coverage from accepted mappings. Candidate suggestions never automatically become accepted mappings.

## PostgreSQL (database credential required)

1. Install Docker Desktop or a native PostgreSQL server.
2. Choose POSTGRES_PASSWORD in .env and set DATABASE_URL to the matching connection URL, for example postgresql://laluan:YOUR_PASSWORD@localhost:5432/laluan. URL-encode special password characters.
3. With Docker run `docker compose up -d db`. With native PostgreSQL create the user/database and apply database/init.sql.
4. Restart the API. It creates student_state if missing without deleting existing tables. Check /api/config for PostgreSQL storage.
5. State is keyed by verified Firebase UID in shared mode. Transactions, row locks and revision checks protect updates. Keep database access behind the API.

Local files are not automatically migrated to PostgreSQL. Back up data before changing modes and re-enter development records after switching storage.

## Firebase Authentication (S001, project configuration required)

1. Create/select a Firebase project and add a Web app in Project settings.
2. Enable Email/Password in Authentication > Sign-in method. Add localhost to authorised domains for development and the deployed frontend hostname for hosting.
3. Copy the web app values into VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID and VITE_FIREBASE_APP_ID in .env. These identify the web project; they are not server credentials.
4. In Project settings > Service accounts, create a development Admin SDK service-account file. Store it outside this repository. Set GOOGLE_APPLICATION_CREDENTIALS to its absolute path and FIREBASE_PROJECT_ID to the same project ID.
5. Set AUTH_REQUIRED=true and configure PostgreSQL. Restart frontend and API.
6. Register and sign in through the app. The browser sends its ID token; the API verifies it and derives record ownership from the UID. No client-supplied UID is accepted.
7. Check that two accounts see separate records and missing/invalid tokens receive 401. Local development checks do not substitute for this credential-dependent check.

Never put an Admin SDK private key into a VITE variable. For shared hosting use HTTPS, server-managed credentials and an explicit WEB_ORIGIN. NODE_ENV=production refuses to start without Firebase enforcement and PostgreSQL. Set API_HOST only if the hosting environment requires a non-loopback bind. A production frontend is built with `npm run build:web`; serve apps/web/dist with your static host and route API requests to the backend.

Reference: https://firebase.google.com/docs/auth/admin/verify-id-tokens

## Gemini (L004/D005, API key and available model required)

1. Create/select a project in Google AI Studio and create a Gemini API key. Enable billing/quota if required for your project.
2. Set GEMINI_API_KEY only in the server .env or secret manager. Never paste it into chat or commit it.
3. Set GEMINI_MODEL to a model identifier available to your project with structured JSON output support. A stale model name can return 404; the app does not assume a particular model is available.
4. Restart the API. Save a profile with missing skills and choose **Generate learning plan**.
5. The API sends eligible catalogue IDs, skills, prerequisites and selections, not personal identity details. It validates generated IDs, uniqueness, skill relevance and prerequisite order, with one bounded retry. Keys and raw provider responses are never logged.
6. Failure preserves the previous valid plan, marks it as awaiting refresh and keeps newly calculated coverage. A retained plan from a previous role is labelled accordingly.

**Preview without AI** is the separately labelled rule-based path and does not test Gemini. Saved generated plans live only in the ignored local store or database.

Reference: https://ai.google.dev/gemini-api/docs/structured-output

## Prepare the course and career catalogue

services/api/src/catalogue.json contains illustrative records, not official USM courses, DOSM profiles or real schedules. Use an absolute CATALOGUE_PATH to load another JSON file with the same schema, or replace the fixture with publishable reviewed records. There is no admin import UI.

1. Obtain the USM handbook edition and separate course outlines if required for actual CLOs. Do not invent outcomes from descriptions.
2. Record code, title, description, outcome sentences, source and edition. Review course-to-skill evidence against selected occupational profiles and record its source/version.
3. Use stable unique course/resource/skill/career IDs. Each skills array represents accepted mappings; NLP candidates require review before insertion. Prerequisites contain activity IDs.
4. Maintain semester-specific offerings, class groups and all weekly lecture/tutorial/lab sessions, using day/start/end in HH:MM. A handbook without session times cannot provide timetable validation. Missing data produces Timetable not checked.
5. Add provider links and reviewed skill mappings to curated external resources. Completion is self-reported; the app does not verify certificates.
6. Restart the API after catalogue edits. Catalogue ID changes require review/migration of saved records. The app does not silently migrate obsolete mappings.

## Checks and collaboration

Run `npm test` and `npm run build:web`. Keep .env, service-account files, .local-data, model caches, reference/, nlp_benchmark/ and tmp/ out of Git. plan.md records scenario coverage and actual checks. Sample scores and clashes must not be reported as real USM or industry findings.

With a separate development-mode API (`AUTH_REQUIRED=false`), NLP and frontend running, `npm run test:browser` exercises fixture workflows in a fresh browser context. It requires Microsoft Edge by default. On other platforms run `npx playwright install chromium` and set `BROWSER_CHANNEL=chromium`. Set `BROWSER_TEST_URL` if the frontend uses a different address. Screenshots are saved under ignored `tmp/validation`. Set `API_TEST_URL` to the development API address before `npm test` to include the HTTP integration test; otherwise it is explicitly skipped. These tests do not automate real Firebase sign-in and must not be pointed at a shared production environment.

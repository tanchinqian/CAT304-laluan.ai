# Laluan.ai

Laluan.ai connects USM course outcomes to career skills with phrase and semantic matching.

## Stack

- Web: React, TypeScript, Vite
- API: Node.js, Express, Firebase Authentication
- NLP: Python, FastAPI, spaCy, Sentence Transformers
- Data: PostgreSQL
- Optional plan generation: Gemini API

## Run locally

Install Node.js 22+ and Python 3.12+. Copy `.env.example` to `.env` and adjust local settings. Start PostgreSQL with `docker compose up -d db`.

In separate terminals from the project root:

```powershell
npm install
npm run dev:web
```

```powershell
npm run dev:api
```

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r services\nlp\requirements.txt
cd services\nlp
uvicorn main:app --reload --port 8000
```

Open <http://localhost:5173>. The NLP service downloads the configured Sentence Transformer model on first start; set `ENABLE_EMBEDDINGS=false` to use spaCy phrase matching only. Analysis results are stored in PostgreSQL when `DATABASE_URL` is set.

The initial course outcomes and skills in the web form are placeholders; replace them with reviewed USM data before using results for the project.

## Optional services

- Gemini: set `GEMINI_API_KEY` in your local `.env` to enable learning-plan generation.
- Firebase: enable Email/Password in Firebase Authentication and set the `VITE_FIREBASE_*` values for web sign-in. Set `AUTH_REQUIRED=true`, `FIREBASE_PROJECT_ID`, and `GOOGLE_APPLICATION_CREDENTIALS` to verify Firebase tokens in the API. Local development defaults to unauthenticated mode.

## Project layout

`apps/web` is the React client; `services/api` is the Express API; `services/nlp` hosts skill matching; `database/init.sql` creates the PostgreSQL table. Existing proposal PDFs, HTML prototypes, and diagrams are kept under the ignored `reference/` folder. `nlp_benchmark/` and `tmp/` are local-only.

Only the web app, services, database schema, and setup files are needed for this scaffold. Do not commit `.env`, model caches, `reference/`, `nlp_benchmark/`, or `tmp/`.

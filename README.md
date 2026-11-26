# Laluan.ai

USM career-skill planning workspace: academic profile, skill evidence, recommendations, learning plan, completion tracker, progress and timetable checks.

React/TypeScript/Vite · Express · Python/FastAPI/spaCy/Sentence Transformers · PostgreSQL · Firebase Authentication · optional Gemini generation.

## Start

Install Node.js 24.12+ (the Firebase dependency requires this version). From the root:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Copy the environment example only on first setup. Open http://localhost:5173. Local development needs no keys and persists data in ignored .local-data files. Firebase and PostgreSQL are required for shared deployment. The separate NLP service supplies candidate evidence; accepted catalogue mappings determine coverage.

See [setup instructions](docs/setup.md) for Python/model installation, Firebase, PostgreSQL, Gemini, catalogue preparation and hosting. See [use-case plan](plan.md) for the 18 flows and validation results.

The catalogue is illustrative, not reviewed USM/DOSM data. Supply the academic handbook/CLOs and current schedules before meaningful evaluation. The score measures recorded coverage, not proficiency.

```powershell
npm test
npm run build:web
```

apps/web contains the frontend; services/api owns validation and storage; services/nlp provides matching; database contains the schema. Local secrets, saved generated plans, references and benchmarks are excluded from Git.

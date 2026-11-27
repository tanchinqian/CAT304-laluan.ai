# Teammate setup: Windows

Follow this guide once on each development computer. Run commands in PowerShell unless a step says otherwise. The examples use a fresh clone; replace folder paths with your own.

## 1. Know what is shared

| Component | Shared or individual? |
| --- | --- |
| Source code and sample catalogue | Shared through this repository. |
| Firebase project | Use the team's existing CAT304 project, `cat304-89545`. |
| Firebase web configuration | The coordinator supplies the same four web configuration values to everyone. |
| Firebase server credential JSON | Each backend developer obtains an authorised credential, stores it privately, and uses their own file path. It is not downloaded with Git. |
| PostgreSQL | Each teammate runs their own local database, normally in Docker. |
| Gemini | Use your own API key, or a team key explicitly authorised for your use. |
| Python environment and NLP model | Install/download on each computer. |
| `.env` | Each teammate creates their own local file. |

Firebase stores sign-in accounts. PostgreSQL stores academic profiles, activities, plans and progress. Sharing Firebase does not share your local PostgreSQL records: the same login can have a different academic profile on each teammate's computer.

The frontend calls Express on port 4000. Express connects to PostgreSQL on port 5432 and NLP on port 8000. Only PostgreSQL is containerised in the supplied Compose file.

## 2. Install the tools

- [Git for Windows](https://git-scm.com/downloads/win).
- [Node.js](https://nodejs.org/en/download): version **24.12 or later** to satisfy the current Firebase dependency requirements. npm is included.
- [Python](https://www.python.org/downloads/windows/): **3.12 or 3.13** is recommended for this project's NLP dependencies. Enable the Python launcher/PATH option during installation if offered.
- [Docker Desktop](https://docs.docker.com/desktop/setup/install/windows-install/): use its Linux-container/WSL 2 setup and open Docker Desktop before starting the database.

Open a new PowerShell window after installation and check:

```powershell
git --version
node --version
npm.cmd --version
python --version
docker --version
docker info --format '{{.ServerVersion}}'
```

The last command must print a server version, not just a client version or connection error. If PowerShell blocks `npm.ps1`, use `npm.cmd` for the commands in this guide; changing your execution policy is not necessary.

## 3. Clone and install the JavaScript dependencies

From a folder where you keep projects:

```powershell
git clone https://github.com/tanchinqian/CAT304-laluan.ai.git
cd CAT304-laluan.ai
npm.cmd ci
```

For an existing clone, save your work before pulling updates. Run `npm.cmd ci` again when the lockfile changes.

## 4. Create your private environment file

From the repository root:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Open `.env` in your editor. Keep `.env.example` as the committed blank/template version. Do not overwrite an existing `.env` when following later setup steps.

The defaults define these local addresses:

```env
API_PORT=4000
API_HOST=127.0.0.1
WEB_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:4000
NLP_API_URL=http://127.0.0.1:8000
```

Use `http://localhost:5173` in your browser so it matches `WEB_ORIGIN`. If you change ports, update the frontend/API origin settings together and restart both processes.

## 5. Start your own PostgreSQL database

For local development, the existing Compose defaults are:

```env
POSTGRES_DB=laluan
POSTGRES_USER=laluan
POSTGRES_PASSWORD=laluan_dev
DATABASE_URL=postgresql://laluan:laluan_dev@127.0.0.1:5432/laluan
```

The password above is a public development example. If you choose another password, update both `POSTGRES_PASSWORD` and the password segment of `DATABASE_URL`. Special URL characters in a password must be percent-encoded in the URL.

With Docker Desktop running, execute from the repository root:

```powershell
docker compose up -d db
docker compose ps db
```

Wait for the database to show **healthy**. The first run downloads PostgreSQL 16, creates a persistent Docker volume and runs `database/init.sql`. The API also ensures its `student_state` table exists when it starts.

For later sessions, open Docker Desktop and run `docker compose up -d db` again. The existing volume preserves records. `docker compose stop db` stops the database without deleting that volume.

Changing `POSTGRES_PASSWORD` after the database has already been created does not change the existing database user's password. Use the original settings or arrange a database password update. Avoid deleting a volume that contains work you need.

The schema and example data are in Git. The running database files, passwords and your saved student records are not. Existing `.local-data` file records are not automatically imported into PostgreSQL.

## 6. Connect to the team's Firebase project

### Web configuration — shared team values

Ask the coordinator for the registered web app configuration from **Firebase Console → Project settings → General → Your apps**. Put the corresponding values in your `.env`:

```env
VITE_FIREBASE_API_KEY=REPLACE_WITH_TEAM_WEB_API_KEY
VITE_FIREBASE_AUTH_DOMAIN=REPLACE_WITH_TEAM_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID=cat304-89545
VITE_FIREBASE_APP_ID=REPLACE_WITH_TEAM_WEB_APP_ID
FIREBASE_PROJECT_ID=cat304-89545
```

Replace all `REPLACE_WITH_...` placeholders. These are the Firebase web app settings, not the Gemini key or Admin SDK private key. The Firebase API key should be restricted to the intended Firebase services.

The coordinator enables **Authentication → Sign-in method → Email/Password** once for the shared project. For local development, the coordinator adds `localhost` under **Authentication → Settings → Authorized domains** if missing. Each teammate can then register their own student account in the website.

### Server credentials — local private file

1. Ask the coordinator for authorised access to the same CAT304 project if you will manage Firebase or create server credentials. Signing up as a website user alone does not grant console access.
2. Creating a service-account JSON key needs permission to create keys on the relevant service account. Viewer access alone does not provide this permission. The coordinator should grant only the needed access; project Owner access is not required for every teammate. Organisation policies may prohibit key creation.
3. Use **Project settings → Service accounts → Firebase Admin SDK → Generate new private key** if your access permits it. A service account's **Keys** tab in Google Cloud IAM is another authorised route. Ask the coordinator to resolve missing permissions rather than creating an unrelated Firebase project.
4. Save the JSON outside the repository, for example `C:\Users\Alice\firebase-private\cat304-admin.json`. The file can keep its original downloaded filename.
5. In your `.env`, set the actual path on your computer:

```env
GOOGLE_APPLICATION_CREDENTIALS=C:/Users/Alice/firebase-private/cat304-admin.json
AUTH_REQUIRED=true
```

`Alice` is only an example. The JSON file must exist at that exact path and belong to the same project. The path alone is not a credential and does not download the file. Use forward slashes in `.env` to avoid backslash-escape issues.

The Admin SDK file contains a private key. Keep it outside Git and ordinary group-chat messages. The API uses it to verify student tokens and derives record ownership from the verified UID.

References: [Firebase project access](https://firebase.google.com/docs/projects/iam/overview), [service-account key permissions](https://docs.cloud.google.com/iam/docs/keys-create-delete), [server token verification](https://firebase.google.com/docs/auth/admin/verify-id-tokens).

## 7. Install Python dependencies and the NLP model

From the repository root:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install --upgrade pip
.venv\Scripts\python.exe -m pip install -r services/nlp/requirements.txt
```

These commands call the virtual environment directly; activation is optional. If `python` points to the wrong version, use the Python launcher for an installed version, for example `py -3.13 -m venv .venv`.

Keep these settings in `.env`:

```env
SENTENCE_TRANSFORMER_MODEL=sentence-transformers/all-MiniLM-L6-v2
ENABLE_EMBEDDINGS=true
SIMILARITY_THRESHOLD=0.55
```

The NLP service downloads the model on its first start. Internet access and sufficient disk space are required. Allow the download and model-loading messages to finish before testing analysis. It can run on a CPU; a GPU is not required for the fixture workflow.

If you already have the model, set `SENTENCE_TRANSFORMER_MODEL` to its absolute local folder path. Do not copy another teammate's Windows path. Model weights are not included in Git. If the model cannot load, the service can still use phrase matching; semantic suggestions will be unavailable. Accepted catalogue mappings determine the readiness score, not unreviewed NLP suggestions.

## 8. Configure Gemini, or use the preview

For AI plan generation:

1. Open [Google AI Studio API keys](https://aistudio.google.com/apikey).
2. Create a key for a project you are authorised to use, or obtain a team key through an agreed private channel. The Gemini project may be separate from the Firebase project.
3. Set the following in your local `.env`:

```env
GEMINI_API_KEY=REPLACE_WITH_YOUR_AUTHORISED_KEY
GEMINI_MODEL=gemini-3.5-flash-lite
```

The model above passed a live application test on **26 November 2026**. Availability and quota depend on the project; check AI Studio if it later returns 404, permission or quota errors. The backend requests structured output and validates the returned activity IDs, mappings and prerequisite order.

Keep the Gemini key server-side. Each person's usage consumes the quota/billing of the project associated with their key. Restart the API after changing these settings.

You can leave both Gemini variables blank and use **Preview without AI**. This produces a rule-based plan; it does not test the Gemini integration.

## 9. Run the application

Keep Docker Desktop and the database running. Open two PowerShell terminals in the repository root.

**Terminal 1 — NLP service:**

```powershell
.venv\Scripts\python.exe -m uvicorn main:app --app-dir services/nlp --host 127.0.0.1 --port 8000
```

Wait for `Application startup complete`.

**Terminal 2 — frontend and API:**

```powershell
npm.cmd run dev
```

Open **http://localhost:5173**. Both terminals must remain running. The expected ports are frontend 5173, API 4000, NLP 8000 and PostgreSQL 5432.

After editing `.env`, press Ctrl+C in the relevant terminals and restart the services. The combined launcher uses a fixed frontend port and reports a startup error if an earlier server still occupies it.

## 10. Confirm setup with these checks

### Service checks

In a third PowerShell terminal:

```powershell
docker compose ps db
Invoke-RestMethod http://127.0.0.1:4000/api/config
Invoke-RestMethod http://127.0.0.1:4000/api/health
Invoke-RestMethod http://127.0.0.1:8000/health
```

Expected results:

- Docker reports the database as healthy.
- `/api/config` reports `authRequired: true`, `storage: PostgreSQL` and whether a Gemini key is configured. This endpoint does not print the keys.
- `/api/health` reports the API and NLP status. Database startup is checked by the API's store initialisation; the storage label alone is not a full database diagnostic.
- The NLP health response reports `embeddingAvailable: true` after a successful model load.

### Website checks

1. Register/sign in with your own account. The coordinator can confirm the account under **Firebase Authentication → Users**.
2. In **Academic Profile**, choose a role and completed sample courses, then select **Save & analyse**.
3. Refresh the page. Your programme, career and course selections should remain.
4. In **Skill-Gap Analysis**, inspect matched-skill evidence and missing skills.
5. In **Recommendations**, inspect course/resource details and save selected activities.
6. In **Learning Plan**, select **Generate learning plan**, or **Preview without AI** if Gemini is not configured. Those controls require an analysis first.
7. Mark a mapped activity Completed. Coverage should update; selecting a pending activity alone must not increase it.
8. In **My Semester Timetable**, add/save a session. Conflicting recommendations stay visible with the overlapping course/time; missing schedule data shows **Timetable not checked**.

The current catalogue is illustrative. Sample course codes, skill coverage and schedules demonstrate the workflows and are not real USM/DOSM evaluation results. Reviewed handbook/CLO and occupational data is a shared project task, not a separate setup job for each teammate.

### Code checks

```powershell
npm.cmd test
npm.cmd run build:web
```

The HTTP integration test is opt-in and expects a separate development-mode API, not the Firebase-protected API you just configured. It is skipped when `API_TEST_URL` is unset. The full workflow browser test also expects a development workspace and fixture catalogue; it does not automate real Firebase sign-in. `node scripts/validate-layout.cjs` checks layout with isolated fixture responses against a running frontend and requires Microsoft Edge. See [the validation report](validation.md) for what was actually exercised.

## 11. Common problems

| Symptom | Check or action |
| --- | --- |
| `docker` command not found | Finish Docker Desktop installation and reopen PowerShell. |
| Docker cannot connect to its engine | Open Docker Desktop and wait for the engine to start. |
| Docker says the Windows hypervisor is not running | Follow the Windows checks below. |
| Database authentication fails | Ensure the URL matches the credentials used when the database volume was first created. |
| API stops at startup | Read the startup message; check database readiness, Firebase file path and occupied ports. |
| Port 5173 or 4000 is already in use | Stop the earlier project terminal with Ctrl+C before starting another copy. |
| Sign-in configuration is missing | Fill all four `VITE_FIREBASE_*` settings and restart Vite. |
| Server credential file is missing | Check your own `GOOGLE_APPLICATION_CREDENTIALS` path and downloaded JSON filename. |
| Signed in, but API returns 401 | Check frontend/backend project IDs match, then sign out and back in. |
| NLP is unavailable | Keep the NLP terminal running; check port 8000, dependencies and model download. |
| Plan controls are disabled | Save a career and learning records to create an analysis first. |
| Gemini cannot refresh a plan | Check the key, available model, quota and network; use the preview while resolving access. |
| No profile after switching to PostgreSQL | Local files were not migrated; re-enter development records or arrange a migration. |

### Windows hypervisor checks

Docker's WSL 2 backend needs Windows virtualisation support. Firmware virtualisation being Enabled in Task Manager does not prove the Windows hypervisor is running.

Open **Terminal/PowerShell as administrator** and run these read-only checks:

```powershell
Get-WindowsOptionalFeature -Online -FeatureName VirtualMachinePlatform
bcdedit /enum
```

If Virtual Machine Platform is enabled but the current Windows boot entry explicitly shows `hypervisorlaunchtype Off`, and you are authorised to change this computer's configuration, enable startup:

```powershell
bcdedit /set hypervisorlaunchtype auto
```

Save your work and **restart Windows**, then reopen Docker Desktop. Restarting Docker alone does not apply a Windows boot-setting change. If the feature is disabled, firmware support is unavailable or you still see errors, follow the [official Docker troubleshooting guide](https://docs.docker.com/desktop/troubleshoot-and-support/troubleshoot/topics/) instead of changing unrelated boot options.

## 12. What to commit

Commit code, schema/migrations, publishable sample data, tests and documentation. Keep `.env`, private credential JSON, local records, model weights, generated responses, logs, reference documents and benchmark artifacts excluded. `git status --short` lets you review pending files before staging them.

For more implementation detail, see [setup.md](setup.md), [plan.md](../plan.md), and [validation.md](validation.md).

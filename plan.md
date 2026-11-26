# Laluan.ai implementation plan

Source: [Final Report, section 3.7.3](https://docs.google.com/document/d/10-Fbg1mfRjbF9zVlu0XIyGbKxWjn_mvVgODuzlXIPQI/edit?tab=t.pv8x6bwn6s1q) (18 detailed use cases), read 25 November 2026.

## Goal and boundaries

Deliver a working React/TypeScript client, Express API, PostgreSQL persistence and Python NLP service. Keep Firebase authentication and Gemini generation explicit integrations. Sample catalogue records demonstrate the workflows; they are not reviewed USM CLOs, DOSM profiles or actual course schedules. No real proficiency or registration claim is made.

## Work sequence

1. Inspect existing scaffold and read all detailed scenarios. **Done.**
2. Implement catalogue, student state, validation, evidence-based coverage, recommendations, progress and timetable domain functions. **Done.**
3. Connect authenticated API routes, durable storage and validated Gemini plan generation. **Implemented; live Firebase/Gemini/PostgreSQL verification requires external setup.**
4. Build profile, analysis, recommendation, tracker, timetable and progress screens. **Done.**
5. Document local startup, integration setup and catalogue preparation in `docs/setup.md`. **Done.**
6. Run domain/API/build checks; ask an independent agent to exercise the running website; resolve findings. **Done; browser fallback passed after fixing selected-activity inclusion.**

## Coverage matrix

| Case | Main scenario implementation                                                                                               | External dependency                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| S001 | Register/sign in/out; attach ID token; API verifies identity                                                               | Firebase project and web config; server credentials |
| S002 | Load/edit/save programme and year; ownership-scoped persistence                                                            | PostgreSQL for shared deployment                    |
| S003 | Search course code/name, select/remove, validate/deduplicate/save                                                          | Reviewed catalogue                                  |
| S004 | Choose/update career; persist and refresh analysis                                                                         | Reviewed occupational skill profiles                |
| N001 | Review saved inputs, run sentence/token phrase and semantic candidate analysis                                             | Python spaCy and local Sentence Transformer         |
| N002 | Covered skills with course outcomes or activity mapping evidence                                                           | Accepted mappings, separate from NLP candidates     |
| N003 | Missing skills from the same coverage set used by scoring                                                                  | Valid career profile                                |
| N004 | Distinct covered/required skills percentage; zero coverage and unavailable states                                          | No API key                                          |
| L001 | Rank gap coverage; exclude completed courses; prerequisites; timetable warnings                                            | Semester/group session catalogue                    |
| L002 | Curated external recommendations by gaps and role                                                                          | Reviewed resource records                           |
| L003 | Expand details, mappings, prerequisites, source/provider link and relevance                                                | Provider link; no enrolment integration             |
| L004 | Send eligible records, parse structured plan, validate IDs/mappings/order, save atomically                                 | Gemini key/model; local preview labelled separately |
| L005 | Select/save activities; duplicates rejected; no score increase on selection                                                | No API key                                          |
| D001 | Saved role, coverage, course counts, plan and timetable warnings                                                           | API/store                                           |
| D002 | Dated role-specific chart and milestone log                                                                                | Stored snapshots                                    |
| D003 | Pending/In Progress/Completed; self-reported completion; accepted mappings only                                            | No certificate-verification service                 |
| D004 | Manual semester timetable CRUD; automatic same-day interval checks per offering group; retain clashes and unknowns         | Maintained semester-specific sessions               |
| D005 | S003/S004/completion changes recalculate unique coverage, snapshot and refresh plan; failures preserve previous valid plan | Gemini for generated refresh; NLP failure labelled  |

## Validation and handoff

Track actual commands, browser evidence and remaining setup gates here after implementation. Never include credentials or generated Gemini payloads in committed reports. No automatic commit or push is part of this request.

### Automated checks completed

- `npm run build:web` passes TypeScript checking and the production bundle build.
- `API_TEST_URL=http://127.0.0.1:4001 npm test` (set the variable with PowerShell `$env:API_TEST_URL=...`) passes all five checks. Without API_TEST_URL, the external HTTP workflow test is explicitly skipped.
- Domain checks cover distinct-skill scoring, completion gating, career denominators, prerequisites, invalid/duplicate plan IDs, adjacent sessions, clashes and unknown schedules.
- HTTP checks exercise profile persistence, separate development sessions, revision conflicts, completion updates, timetable saves without score changes, local plan generation and role-specific snapshots.
- Gemini output validation is tested with mocked provider responses, including bounded retry and preservation of the previous valid plan. This is not a live Gemini call.
- The existing local all-MiniLM-L6-v2 model loaded successfully. Actual phrase/alias matching and three embedding candidates returned supporting outcome sentences. One differently worded example stayed below the configured threshold, illustrating why candidates require review.
- `git diff --check` passes. Local records, logs, benchmark files and reference materials remain ignored.

### Setup still required for a shared deployment

1. Supply reviewed USM handbook/CLO records, occupational profiles, accepted mappings and semester offering sessions. Current records are illustrative fixtures.
2. Configure Firebase web values, a server credential and AUTH_REQUIRED=true; test two real accounts and revoked/expired sessions.
3. **Local PostgreSQL configured on 26 November 2026.** Docker now runs the healthy PostgreSQL container, and the local `.env` contains its connection URL. A real database save/reload and stale-revision rejection passed; the temporary test record was removed. Restart the app to load the new connection. Shared-host configuration and combined multi-account database testing remain deployment checks.
4. **Local Gemini generation verified on 26 November 2026.** The user supplied a key in the ignored root `.env`; `gemini-3.5-flash-lite` returned HTTP 200 and a three-activity sample plan that passed ID, mapping and prerequisite validation and included both selected sample activities. The tested model was saved locally; restart the API to load it. An older model listed by the API returned 404 and was not selected. No raw response or key was printed or committed.
5. Set production hosts, HTTPS and NODE_ENV=production. Public hosting is not configured by this task.

### Independent validation

The requested separate validation agent completed a headless Edge/Playwright pass against the running app and wrote `docs/validation.md`. It exercised saved profiles, evidence, recommendations, plan selections, completion updates, timetable checks and career-specific progress. Desktop 1365×900 and mobile 390×844 screenshots showed no horizontal overflow; no uncaught browser errors were recorded. The agent identified selected activities not being guaranteed in generated plans; this was fixed in both generators and covered by a regression check and the browser pass. Validation uses ports 5174/4001/8001 because the original processes could not be reached across this chat's restricted network environment; normal startup remains 5173/4000/8000. Firebase, PostgreSQL and live Gemini remain explicitly unverified integration gates.

# Independent validation report

Date: 25 November 2026 (Asia/Singapore).

## Result

The independent agent completed a browser acceptance pass using headless Microsoft Edge through Playwright against frontend http://127.0.0.1:5174, API port4001 and NLP port8001. The pass succeeded with no uncaught browser page errors. This validates the local demonstration workflow; it does not validate live Firebase, PostgreSQL or Gemini accounts.

Reproducible test: `scripts/validate-browser.cjs`. Its default URL is http://localhost:5173 for normal project startup. Set BROWSER_TEST_URL to another runtime URL when needed. Browser launch and navigation are bounded to15 seconds. Install the project's development dependencies and Microsoft Edge before running it.

## Browser flows exercised

| Cases                     | Observed result                                                                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S002/S003/S004/N004/D001  | Saved programme, year2, software role and DEMO101; dashboard showed25% coverage. Reload retained programme and selected course.                                                   |
| N001/N002/N003            | Opened Python View Evidence and saw the exact course-outcome sentence. Missing-skills section was visible. Run Analysis showed phrase matching and semantic similarity available. |
| L001/L002/L003            | Completed DEMO101 was excluded from recommendations. External SQL resource details expanded and showed the PostgreSQL provider URL.                                               |
| L005                      | Selected Web services and external SQL resource, saved and verified the score remained25%.                                                                                        |
| D003/D005                 | Marked EXT-SQL Completed. Dashboard updated to75% coverage. Selection alone had not increased coverage.                                                                           |
| L004 local path           | Generated the explicitly labelled local preview. The selected eligible Web services activity appeared as the first plan activity. This is not a live Gemini result.               |
| D004                      | Added CAT304 Monday10:00-11:00 for2026/27-1. Web services retained its named overlap warning. Warnings appeared in timetable, overview and plan/tracker views. Score remained75%. |
| D004 editing/unknown data | Edited the saved session to09:00-10:00 and observed No conflict detected for adjacent intervals. Removed/saved the session and observed Timetable not checked.                    |
| D002/D005                 | Switched to the data-analyst sample role; coverage changed to50% and the chart heading/history represented that career.                                                           |

A desktop1365x900 screenshot and mobile390x844 screenshot were captured and visually inspected together. On mobile, Academic Profile and My Semester Timetable were reachable and document width did not exceed viewport width. Screenshots are ignored local artifacts at `tmp/validation/desktop.png` and `tmp/validation/mobile.png`.

This was a bounded check of the shipped fixture flows. It does not imply a full accessibility audit, physical-device testing, all browsers, all error scenarios or every combination of inputs. Provider URLs were checked in the UI; no external enrolment or certification was attempted.

## Other checks independently executed

- `npm test` at the time of review passed4 tests with0 failures and1 skipped HTTP test. It covered accepted-skill uniqueness/completion status, timetable boundaries and validation, recommendation/plan prerequisite rules, and mocked Gemini validation with old-plan preservation.
- `npm run build:web` passed TypeScript checking and the Vite production build (39 modules transformed).
- The primary implementation agent separately ran the opt-in HTTP integration workflow and live local NLP model checks. See its command evidence for those checks; they are separate from the UI pass.

## Finding corrected during validation

Source review found that local plan generation originally ignored saved selections and Gemini validation did not require selected eligible activities. This was reported to the primary agent. The implementation was corrected to include selected eligible activities and their eligible prerequisites, reject Gemini omission of required selections, and mark old plans as awaiting regeneration when selections change. The final browser pass observed selected Web services in the local plan preview. The primary agent added a regression test for the rule.

The primary agent also corrected timetable warning visibility on the overview and tracker before the final pass. The browser pass verified those displays.

## Browser tooling fallback

The initial CUA in-app browser attempt at localhost:5173 returned ERR_CONNECTION_TIMED_OUT. Native Firefox selection then hung and was aborted. A later CUA retry returned Browser is not available: iab. Playwright/installed Edge was then used successfully for testing this local application. These tool failures were not classified as application defects.

## Setup gates not validated live

- Firebase registration/sign-in, revocation and isolation between real accounts.
- PostgreSQL persistence, row locking and transactions against a running database.
- Live Gemini model access, quota and structured generation. A local preview and mocked test do not validate API credentials.
- Real USM/DOSM catalogue accuracy, accepted skill mappings, actual CLO evidence and semester timetable data. Current records are illustrative.

No .env secrets, service-account credentials or raw Gemini responses were read or included in this report.

## PostgreSQL follow-up — 26 November 2026

After Windows hypervisor startup was enabled and Windows restarted, Docker became available. The primary agent started the project's PostgreSQL 16 container, confirmed its healthy state and the `student_state`/`analysis_history` tables, and configured the ignored local `.env` without displaying credentials. A real save/reload and stale-revision rejection passed through the application's store; only the temporary setup-check record was removed afterward. This follow-up verifies local PostgreSQL storage, not shared cloud deployment or a new independent browser pass with multiple Firebase accounts. Earlier local-file data was preserved and was not automatically migrated.

## Gemini follow-up — 26 November 2026

Using the user's locally configured key, the primary agent listed models and exercised the application's actual generator with illustrative catalogue data in memory. `gemini-3.5-flash-lite` returned HTTP 200. The generated three-activity plan passed the application's ID, relevance and prerequisite-order checks and included both selected sample activities. The tested model identifier was saved in the ignored root `.env`; the API requires a restart to load the setting. The older listed `gemini-2.5-flash-lite` returned 404, demonstrating that listing alone did not establish working generation. No credentials, raw Gemini output or user records were included in logs or committed reports. This verifies one live generator request, not production quotas or a new authenticated browser acceptance pass.

## Sidebar layout follow-up — 26 November 2026

The section navigation now appears in a left sidebar on desktop, with a collapsible menu on narrow screens. Visible branding is lowercase `laluan.ai`; the marketing headline and subtitle were removed. The production build passed. `scripts/validate-layout.cjs` used isolated fixture responses to verify all six navigation views, the sidebar's position to the left of main content, removed hero copy, lowercase wordmark, mobile menu open/select/close behaviour, and no mobile horizontal overflow or uncaught page errors. Desktop 1365×900 and mobile 390×844 screenshots were inspected at `tmp/validation/sidebar-desktop.png` and `sidebar-mobile.png`. This layout check did not access real accounts or make Gemini calls. The full workflow browser script was updated to open the mobile menu before choosing a section.

## Interface copy cleanup — 26 November 2026

Removed the development-catalogue banner, storage/technology footer, workspace-mode label and always-visible NLP implementation status. Skill suggestions are available in a disclosure with their review requirement; source records and sample names remain identifiable. Plan controls use “Generate learning plan” and “Preview without AI”, with no explanatory developer paragraph. Operational errors, progress feedback and useful form instructions remain. The build and isolated desktop/mobile layout check passed; screenshots were inspected. This pass did not make new authenticated or Gemini requests.

const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");
const baseURL = process.env.BROWSER_TEST_URL || "http://localhost:5173";
const results = [];
(async () => {
  const browser = await chromium.launch({
    channel: process.env.BROWSER_CHANNEL || "msedge",
    headless: true,
    timeout: 15000,
  });
  const context = await browser.newContext({
    viewport: { width: 1365, height: 900 },
  });
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(15000);
  page.setDefaultTimeout(15000);
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const section = async (name) => {
    const target = page.getByRole("button", { name, exact: true });
    if (!(await target.isVisible()))
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    await target.click();
  };
  const save = async (name, suffix) => {
    const response = page.waitForResponse(
      (r) => r.url().endsWith(suffix) && r.request().method() !== "OPTIONS",
    );
    await page.getByRole("button", { name, exact: true }).click();
    expect((await response).status()).toBe(200);
    await expect(
      page.getByText("Changes saved.", { exact: true }),
    ).toBeVisible();
  };
  try {
    await page.goto(baseURL);
    await page
      .getByRole("button", { name: "Academic Profile", exact: true })
      .waitFor();
    await section("Academic Profile");
    await page
      .getByLabel("Programme", { exact: true })
      .fill("Computer Science test");
    await page.getByLabel("Year of study").selectOption("2");
    await page.getByLabel("Target career").selectOption("software");
    await page.getByRole("checkbox", { name: /DEMO101/ }).check();
    await save("Save & analyse", "/api/profile");
    await section("Overview & progress");
    await expect(page.getByText("25%", { exact: true })).toBeVisible();
    results.push(
      "S002/S003/S004/N004/D001: profile and role save yields 25% unique accepted coverage",
    );
    await page.reload();
    await page
      .getByRole("button", { name: "Academic Profile", exact: true })
      .waitFor();
    await section("Academic Profile");
    await expect(page.getByLabel("Programme", { exact: true })).toHaveValue(
      "Computer Science test",
    );
    await expect(page.getByRole("checkbox", { name: /DEMO101/ })).toBeChecked();
    results.push(
      "Profile selections and account-local state persist across browser reload",
    );
    await section("Skill-Gap Analysis");
    await expect(
      page.getByRole("heading", { name: "Matched Skills" }),
    ).toBeVisible();
    await page.getByText("Python — View Evidence", { exact: true }).click();
    await expect(
      page
        .getByText("Develop Python programs to solve computational problems.", {
          exact: true,
        })
        .nth(1),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Missing Skills" }),
    ).toBeVisible();
    await save("Run Analysis", "/api/analyze");
    await page.getByText("Suggested skill matches", { exact: true }).click();
    await expect(
      page.getByText(
        "Suggestions require review before they count towards your score.",
        { exact: true },
      ),
    ).toBeVisible();
    results.push(
      "N001/N002/N003: saved evidence, missing skills and expandable skill suggestions displayed",
    );
    await section("Recommendations");
    await expect(
      page.getByText("Programming foundations", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("checkbox", { name: "Web services", exact: true })
      .check();
    await page
      .getByRole("checkbox", {
        name: "SQL practice resource (sample)",
        exact: true,
      })
      .check();
    await page
      .getByText("View details — SQL practice resource (sample)", {
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("link", {
        name: "Open PostgreSQL documentation resource",
      }),
    ).toHaveAttribute(
      "href",
      "https://www.postgresql.org/docs/current/tutorial.html",
    );
    await save("Save selected activities", "/api/activities");
    await section("Overview & progress");
    await expect(page.getByText("25%", { exact: true })).toBeVisible();
    results.push(
      "L001/L002/L003/L005: completed-course exclusion, external provider details and persisted selection without score gain",
    );
    await section("Learning Plan");
    await page.getByLabel("Status for EXT-SQL").selectOption("Completed");
    await expect(
      page.getByText("Saving and updating your results…"),
    ).toHaveCount(0, { timeout: 60000 });
    await section("Overview & progress");
    await expect(page.getByText("75%", { exact: true })).toBeVisible();
    await section("Learning Plan");
    await save("Preview without AI", "/api/plan");
    await expect(
      page.getByText("Preview ready", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "1. Web services", exact: true }),
    ).toBeVisible();
    results.push(
      "D003/D005/L004 local substitute: self-reported mapped completion raises score to 75%; selected eligible activity appears in preview",
    );
    await section("My Semester Timetable");
    await page.getByLabel("Course", { exact: true }).fill("CAT304");
    await page.getByLabel("Start", { exact: true }).fill("10:00");
    await page.getByLabel("End", { exact: true }).fill("11:00");
    await page
      .getByRole("button", { name: "Add session", exact: true })
      .click();
    await save("Save timetable & check conflicts", "/api/timetable");
    await expect(page.getByText(/Group A: Timetable conflict/)).toBeVisible();
    await expect(
      page.getByText("Monday 10:00–12:00 overlaps CAT304 (A) 10:00–11:00", {
        exact: true,
      }),
    ).toBeVisible();
    await section("Overview & progress");
    await expect(page.getByText("75%", { exact: true })).toBeVisible();
    await page
      .getByText("Timetable checks for recommended courses", { exact: true })
      .click();
    await expect(page.getByText(/Group A: Timetable conflict/)).toBeVisible();
    await section("Learning Plan");
    await expect(
      page.getByText(/Group A: Timetable conflict/).first(),
    ).toBeVisible();
    results.push(
      "D004: named timetable clash remains visible in timetable, overview and plan/tracker; score unchanged",
    );
    await section("My Semester Timetable");
    await page
      .getByRole("button", { name: "Edit session 1", exact: true })
      .click();
    await page.getByLabel("Start", { exact: true }).fill("09:00");
    await page.getByLabel("End", { exact: true }).fill("10:00");
    await page
      .getByRole("button", { name: "Add session", exact: true })
      .click();
    await save("Save timetable & check conflicts", "/api/timetable");
    await expect(page.getByText(/Group A: No conflict detected/)).toBeVisible();
    await page
      .getByRole("button", { name: "Remove session 1", exact: true })
      .click();
    await save("Save timetable & check conflicts", "/api/timetable");
    await expect(
      page.getByText(/Group A: Timetable not checked/),
    ).toBeVisible();
    results.push(
      "D004: edit/delete session works; adjacent intervals do not clash; absent timetable remains explicitly unchecked",
    );
    await section("Academic Profile");
    await page.getByLabel("Target career").selectOption("data");
    await save("Save & analyse", "/api/profile");
    await section("Overview & progress");
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Progress for Data analyst (sample)" }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", {
        name: "Recorded skill coverage over time, for the selected career",
      }),
    ).toBeVisible();
    results.push(
      "D002/D005: role switch recalculates denominator and displays separate role-specific progress",
    );
    await fs.mkdir(path.join("tmp", "validation"), { recursive: true });
    await page.screenshot({
      path: "tmp/validation/desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await section("Academic Profile");
    await expect(page.getByLabel("Target career")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await section("My Semester Timetable");
    await expect(page.getByLabel("Course", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "tmp/validation/mobile.png",
      fullPage: true,
    });
    results.push(
      "Desktop1365x900 and mobile390x844 render; profile/timetable navigation accessible, no horizontal overflow at mobile width",
    );
    expect(pageErrors).toEqual([]);
    results.push("No uncaught browser page errors during the pass");
    console.log(JSON.stringify({ status: "PASS", results }, null, 2));
  } catch (error) {
    await fs.mkdir("tmp/validation", { recursive: true });
    await page
      .screenshot({ path: "tmp/validation/failure.png", fullPage: true })
      .catch(() => {});
    console.error(
      JSON.stringify(
        {
          status: "FAIL",
          results,
          error: error.message,
          body: await page.locator("body").innerText(),
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

const { chromium, expect } = require("@playwright/test");
const fs = require("node:fs/promises");
const D = require("../services/api/src/domain");

(async () => {
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    timeout: 15000,
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1365, height: 900 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const s = D.initial();
    s.profile = {
      programme: "Computing",
      year: "2",
      careerId: "software",
      courses: ["DEMO101", "DEMO201"],
    };
    s.analysis = D.coverage(s);
    s.analysisStatus = "Current accepted mappings";
    s.recommendations = D.recommendations(s);
    s.activityChecks = {};
    // Isolate layout testing from real accounts, keys, generation and persisted student records.
    await page.route("**/api/**", (route) => {
      const pathname = new URL(route.request().url()).pathname;
      const data = pathname.endsWith("/config")
        ? {
            authRequired: false,
            storage: "Layout fixture",
            geminiConfigured: false,
          }
        : pathname.endsWith("/catalogue")
          ? D.catalog
          : s;
      return route.fulfill({ json: data });
    });
    await page.goto(process.env.BROWSER_TEST_URL || "http://localhost:5173");
    const nav = page.getByRole("navigation", { name: "Workspace sections" });
    await expect(nav).toBeVisible();
    await expect(page.getByRole("link", { name: "laluan.ai home" })).toHaveText(
      "laluan.ai",
    );
    await expect(
      page.getByText("Make your next course count.", { exact: true }),
    ).toHaveCount(0);
    await expect(page.locator(".intro")).toHaveCount(0);
    await expect(page.locator(".catalogue-notice, footer")).toHaveCount(0);
    await expect(
      page.getByText("Local development workspace", { exact: true }),
    ).toHaveCount(0);
    const side = await page.locator(".sidebar").boundingBox();
    const main = await page.locator("main").boundingBox();
    expect(main.x).toBeGreaterThanOrEqual(side.x + side.width);
    const buttons = nav.getByRole("button");
    expect(await buttons.count()).toBe(6);
    for (let i = 0; i < 6; i++) {
      await buttons.nth(i).click();
      await expect(buttons.nth(i)).toHaveAttribute("aria-current", "page");
    }
    await nav
      .getByRole("button", { name: "Overview & progress", exact: true })
      .click();
    await fs.mkdir("tmp/validation", { recursive: true });
    await page.screenshot({
      path: "tmp/validation/sidebar-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(nav).toBeHidden();
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(nav).toBeVisible();
    await nav
      .getByRole("button", { name: "Academic Profile", exact: true })
      .click();
    await expect(nav).toBeHidden();
    await expect(
      page.getByRole("heading", { name: "Academic Profile", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: "tmp/validation/sidebar-mobile.png",
      fullPage: true,
    });
    expect(errors).toEqual([]);
    console.log(
      "PASS: desktop left sidebar, all six navigation views, lowercase wordmark, removed hero, mobile menu and no overflow/page errors. Fixture responses only; no authentication/backend flow was exercised.",
    );
  } finally {
    await browser.close();
  }
})().catch(() => {
  console.error(
    "Layout check failed. Inspect the test assertions and local screenshots.",
  );
  process.exitCode = 1;
});

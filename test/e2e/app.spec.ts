import { test, expect } from "@playwright/test";

test.describe("App Health", () => {
  test("page loads without crashing", async ({ page }) => {
    await page.goto("/");
    // Page should render — not a blank white screen
    await expect(page.locator("body")).not.toBeEmpty();
    // Nav should be present
    await expect(page.locator("nav")).toBeVisible();
  });

  test("no unhandled console errors on load", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        errors.push(msg.text());
      }
    });

    await page.goto("/");
    // Wait for hydration to settle
    await page.waitForTimeout(3000);

    // Filter out known benign errors (third-party scripts, network errors from
    // external services that may be unavailable in test environments)
    const criticalErrors = errors.filter(
      (e) =>
        !e.includes("googletagmanager") &&
        !e.includes("posthog") &&
        !e.includes("ERR_CONNECTION_REFUSED") &&
        !e.includes("Failed to fetch") &&
        !e.includes("net::") &&
        !e.includes("favicon")
    );

    expect(criticalErrors).toEqual([]);
  });

  test("document title contains Elitra", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Elitra/);
  });

  test("logo is visible in nav", async ({ page }) => {
    await page.goto("/");
    const logo = page.locator('img[alt="Elitra"]');
    await expect(logo).toBeVisible();
  });

  test("logo links to home page", async ({ page }) => {
    await page.goto("/");
    const logoLink = page.locator('a[href="/"]').filter({ has: page.locator('img[alt="Elitra"]') });
    await expect(logoLink).toBeVisible();
    await logoLink.click();
    await expect(page).toHaveURL("/");
  });

  test("connect wallet button is visible", async ({ page }) => {
    await page.goto("/");
    // RainbowKit renders a connect button
    const connectBtn = page.getByRole("button", { name: /connect/i });
    await expect(connectBtn).toBeVisible();
  });

  test("opportunities content renders on home page", async ({ page }) => {
    await page.goto("/");
    // The opportunities page should show portfolio content
    // Look for key UI elements that indicate the page loaded
    await expect(page.locator("nav")).toBeVisible();
    // The page should have some meaningful content (not just a spinner forever)
    await page.waitForTimeout(2000);
    const bodyText = await page.locator("body").textContent();
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(100);
  });
});

test.describe("Responsive Layout", () => {
  test("mobile viewport (375px) — no horizontal overflow", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForTimeout(2000);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    // Allow 1px tolerance for sub-pixel rendering
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });

  test("mobile viewport — nav elements visible", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // Logo should still be visible
    const logo = page.locator('img[alt="Elitra"]');
    await expect(logo).toBeVisible();

    // Connect button should still be visible
    const connectBtn = page.getByRole("button", { name: /connect/i });
    await expect(connectBtn).toBeVisible();
  });

  test("mobile viewport — content is not clipped", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.waitForTimeout(2000);

    // Verify the body has visible, non-zero-height content
    const bodyBBox = await page.locator("body").boundingBox();
    expect(bodyBBox).toBeTruthy();
    expect(bodyBBox!.height).toBeGreaterThan(200);
  });
});

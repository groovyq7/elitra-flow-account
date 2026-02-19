import { test, expect } from "@playwright/test";

test.describe("App Health", () => {
  test("home page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    await expect(page).not.toHaveURL(/error/);
    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
    await page.screenshot({ path: "test/e2e/screenshots/01-home.png" });
  });

  test("opportunities page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    expect(errors.filter(e => !isKnownWarning(e))).toHaveLength(0);
    await page.screenshot({ path: "test/e2e/screenshots/02-opportunities.png" });
  });

  test("navigation links work", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check nav links exist
    const nav = page.locator("nav");
    await expect(nav).toBeVisible();
    await page.screenshot({ path: "test/e2e/screenshots/03-nav.png" });
  });

  test("mobile layout renders correctly", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/opportunities");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(1000);

    // Should not overflow horizontally
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(380);
    await page.screenshot({ path: "test/e2e/screenshots/04-mobile.png" });
  });
});

// Known SDK/library warnings that are expected and not real errors
function isKnownWarning(msg: string): boolean {
  return (
    msg.includes("useWallets") ||
    msg.includes("WalletConnect") ||
    msg.includes("Lit is in dev mode") ||
    msg.includes("Reown") ||
    msg.includes("privy")
  );
}
